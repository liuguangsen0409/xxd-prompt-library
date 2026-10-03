import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createCipheriv, createHash } from 'node:crypto';
import test from 'node:test';

import { decryptMessage, encryptMessage, normalizeCode, parseMessage, verifySignature } from '../server/lib/wechat.ts';

const appId = 'wx-test-account';
const key = Buffer.alloc(32, 7).toString('base64').slice(0, 43);

// Construct the incoming wire format independently of the production encoder.
function fixture(message, recipient = appId, corruptPadding = false) {
  const content = Buffer.from(message);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(content.length);
  const raw = Buffer.concat([Buffer.alloc(16, 1), length, content, Buffer.from(recipient)]);
  const padding = 32 - raw.length % 32;
  const padded = Buffer.concat([raw, Buffer.alloc(padding, padding)]);
  if (corruptPadding)
    padded[padded.length - 2] = 0;
  const cipher = createCipheriv('aes-256-cbc', Buffer.alloc(32, 7), Buffer.alloc(16, 7));
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(padded), cipher.final()]).toString('base64');
}

test('decrypts WeChat wire format including multibyte text', () => {
  assert.equal(typeof decryptMessage, 'function');
  assert.equal(decryptMessage(fixture('登录'), key, appId), '登录');
});

test('rejects another account and malformed PKCS7 padding', () => {
  assert.throws(() => decryptMessage(fixture('登录', 'wx-other'), key, appId));
  assert.throws(() => decryptMessage(fixture('登录', appId, true), key, appId));
  assert.throws(() => decryptMessage('invalid', key, appId));
});

test('encrypted replies preserve XML content', () => {
  const reply = '<xml><Content>验证码 012345</Content></xml>';
  assert.equal(decryptMessage(encryptMessage(reply, key, appId), key, appId), reply);
});

test('only accepts matching signatures within the timestamp window', () => {
  const timestamp = '1700000000';
  const nonce = 'nonce';
  const encrypted = fixture('hello');
  const signature = createHash('sha1').update(['token', timestamp, nonce, encrypted].sort().join('')).digest('hex');
  assert.equal(verifySignature('token', timestamp, nonce, signature, encrypted, 1700000000), true);
  assert.equal(verifySignature('token', timestamp, nonce, signature, 'changed', 1700000000), false);
  assert.equal(verifySignature('token', timestamp, nonce, signature, encrypted, 1700000601), false);
  assert.equal(verifySignature('token', timestamp, nonce, 'bad', encrypted, 1700000000), false);
});

test('keeps numeric codes and message IDs as strings', () => {
  const parsed = parseMessage('<xml><Content><![CDATA[012345]]></Content><MsgId>9876543210987654321</MsgId></xml>');
  assert.equal(parsed.Content, '012345');
  assert.equal(parsed.MsgId, '9876543210987654321');
});

test('rejects unsafe or structurally invalid XML', () => {
  for (const xml of ['<!DOCTYPE xml [<!ENTITY x "test">]><xml>&x;</xml>', '<xml><Content>x</xml>', '<xml><Content>a</Content><Content>b</Content></xml>', '<xml><Content><nested>x</nested></Content></xml>'])
    assert.throws(() => parseMessage(xml));
});

test('accepts exactly six ASCII digits without losing leading zeroes', () => {
  assert.equal(normalizeCode(' 012345 '), '012345');
  for (const input of [123456, null, {}, '12345', '1234567', '１２３４５６', '12e345'])
    assert.equal(normalizeCode(input), null);
});
