import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { createConnection } from 'node:net';
import process from 'node:process';
import test from 'node:test';
import { LoginStore } from '../server/lib/login-store.ts';

// A real Redis-compatible server executes the production Lua scripts.
// Set REDIS_TEST_URL to a disposable Redis instance; never point at production.
const redisUrl = process.env.REDIS_TEST_URL;
const integration = { skip: !redisUrl };

function command(parts) {
  const url = new URL(redisUrl);
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: url.hostname, port: Number(url.port || 6379) });
    let buffer = Buffer.alloc(0);
    socket.setTimeout(5000, () => socket.destroy(new Error('Redis test timeout')));
    socket.on('error', reject);
    socket.on('connect', () => {
      socket.write(`*${parts.length}\r\n${parts.map((part) => {
        const text = String(part);
        return `$${Buffer.byteLength(text)}\r\n${text}\r\n`;
      }).join('')}`);
    });
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      const end = buffer.indexOf('\r\n');
      if (end < 0)
        return;
      const line = buffer.subarray(1, end).toString();
      const prefix = String.fromCharCode(buffer[0]);
      if (prefix === '$' && Number(line) >= 0 && buffer.length < end + 2 + Number(line) + 2)
        return;
      socket.end();
      if (prefix === '-')
        reject(new Error(line));
      else if (prefix === ':')
        resolve(Number(line));
      else if (prefix === '$')
        resolve(Number(line) < 0 ? null : buffer.subarray(end + 2, end + 2 + Number(line)).toString());
      else if (prefix === '_')
        resolve(null);
      else
        resolve(line);
    });
  });
}

function store() {
  const redis = { eval: (script, keys, args) => command(['EVAL', script, keys.length, ...keys, ...args]) };
  return new LoginStore(redis, 'test-only-secret-with-more-than-32-characters', `test-${randomUUID()}`);
}

test('concurrent verification consumes a code exactly once', integration, async () => {
  const login = store();
  const code = await login.issue('openid-a', 'message-1');
  assert.match(code, /^\d{6}$/);
  const results = await Promise.all(Array.from({ length: 12 }, () => login.consume(code)));
  assert.equal(results.filter(Boolean).length, 1);
});

test('concurrent messages from one user return one active code', integration, async () => {
  const login = store();
  const codes = await Promise.all(Array.from({ length: 12 }, (_, index) => login.issue('openid-a', `message-${index}`)));
  assert.equal(new Set(codes).size, 1);
  assert.ok(await login.consume(codes[0]));
});

test('callback retries never resurrect consumed codes', integration, async () => {
  const login = store();
  const code = await login.issue('openid-a', 'message-1');
  await login.consume(code);
  assert.equal(await login.issue('openid-a', 'message-1'), code);
  assert.equal(await login.consume(code), '');
});

test('used codes remain reserved until expiry so they cannot log in another user', integration, async () => {
  const login = store();
  const code = await login.issue('openid-a', 'message-1');
  await login.consume(code);
  const reassigned = await command(['SET', login.key('code', code), 'another-user', 'EX', 300, 'NX']);
  assert.equal(reassigned, null);
  assert.equal(await login.consume(code), '');
});

test('new logins preserve identity while different users stay separate', integration, async () => {
  const login = store();
  const first = await login.consume(await login.issue('openid-a', 'message-1'));
  const second = await login.consume(await login.issue('openid-a', 'message-2'));
  const other = await login.consume(await login.issue('openid-b', 'message-3'));
  assert.ok(first);
  assert.equal(first, second);
  assert.notEqual(first, other);
  assert.notEqual(first, 'openid-a');
});

test('expired codes cannot authenticate', integration, async () => {
  const login = store();
  const code = await login.issue('openid-a', 'message-1');
  await command(['PEXPIRE', login.key('code', code), 1]);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(await login.consume(code), '');
});

test('rate limits apply across instances and reset after expiry', integration, async () => {
  const login = store();
  const results = await Promise.all(Array.from({ length: 12 }, () => login.limited('ip', 10, 300)));
  assert.equal(results.filter(Boolean).length, 2);
  await command(['PEXPIRE', login.key('limit', 'ip'), 1]);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(await login.limited('ip', 10, 300), false);
});
