import { Buffer } from 'node:buffer';
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { XMLBuilder, XMLParser, XMLValidator } from 'fast-xml-parser';

export function signatureFor(token: string, timestamp: string, nonce: string, encrypted = '') {
  return createHash('sha1').update([token, timestamp, nonce, encrypted].sort().join('')).digest('hex');
}

export function verifySignature(token: string, timestamp: string, nonce: string, signature: string, encrypted = '', now = Math.floor(Date.now() / 1000)) {
  if (!/^\d{10}$/.test(timestamp) || Math.abs(now - Number(timestamp)) > 300 || !nonce || nonce.length > 128 || !/^[a-f0-9]{40}$/i.test(signature))
    return false;
  return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(signatureFor(token, timestamp, nonce, encrypted), 'hex'));
}

function aesKey(value: string) {
  if (!/^[\w+/]{43}$/.test(value))
    throw new Error('Invalid AES key');
  const key = Buffer.from(`${value}=`, 'base64');
  if (key.length !== 32)
    throw new Error('Invalid AES key');
  return key;
}

export function decryptMessage(encrypted: string, encodingKey: string, appId: string) {
  if (!/^[\w+/]+={0,2}$/.test(encrypted))
    throw new Error('Invalid ciphertext');
  const key = aesKey(encodingKey);
  const decipher = createDecipheriv('aes-256-cbc', key, key.subarray(0, 16));
  decipher.setAutoPadding(false);
  const padded = Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]);
  const padding = padded[padded.length - 1];
  if (!padding || padding > 32 || padded.length < 32 || !padded.subarray(-padding).every(byte => byte === padding))
    throw new Error('Invalid padding');
  const raw = padded.subarray(0, -padding);
  if (raw.length < 20)
    throw new Error('Invalid message');
  const length = raw.readUInt32BE(16);
  if (20 + length > raw.length || raw.subarray(20 + length).toString('utf8') !== appId)
    throw new Error('Invalid recipient');
  return raw.subarray(20, 20 + length).toString('utf8');
}

export function encryptMessage(message: string, encodingKey: string, appId: string) {
  const key = aesKey(encodingKey);
  const content = Buffer.from(message);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(content.length);
  const raw = Buffer.concat([randomBytes(16), length, content, Buffer.from(appId)]);
  const padding = 32 - raw.length % 32;
  const cipher = createCipheriv('aes-256-cbc', key, key.subarray(0, 16));
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(Buffer.concat([raw, Buffer.alloc(padding, padding)])), cipher.final()]).toString('base64');
}

export function parseMessage(body: string): Record<string, string> {
  if (Buffer.byteLength(body) > 16384 || /<!DOCTYPE|<!ENTITY/i.test(body) || XMLValidator.validate(body) !== true)
    throw new Error('Invalid XML');
  const parsed = new XMLParser({ parseTagValue: false, ignoreAttributes: false, processEntities: false }).parse(body);
  const message = parsed.xml;
  if (!message || typeof message !== 'object' || Array.isArray(message) || Object.values(message).some(value => typeof value !== 'string'))
    throw new Error('Invalid message');
  return message;
}

export function xmlMessage(fields: Record<string, string | number>) {
  return new XMLBuilder({ format: false }).build({ xml: fields }) as string;
}

export function normalizeCode(value: unknown) {
  return typeof value === 'string' && /^\d{6}$/.test(value.trim()) ? value.trim() : null;
}
