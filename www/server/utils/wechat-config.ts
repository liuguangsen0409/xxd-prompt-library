import type { H3Event } from 'h3';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { Redis } from '@upstash/redis';
import { LoginStore } from '../lib/login-store';

export function wechatSettings(event: H3Event) {
  const runtime = useRuntimeConfig(event);
  const settings = runtime.wechat;
  const secret = String(runtime.session.password || '');
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
  if (!settings.appId || !/^[a-z0-9]{3,32}$/i.test(settings.token) || !/^[\w+/]{43}$/.test(settings.encodingAesKey) || secret.length < 32 || !redisUrl.startsWith('https://') || !redisToken)
    throw createError({ statusCode: 503, statusMessage: 'Login is not configured', data: { message: '登录功能正在准备中，请稍后再试。你可以继续浏览和复制提示词。' } });
  return { ...settings, secret, redisUrl, redisToken };
}

export function wechatStore(settings: ReturnType<typeof wechatSettings>) {
  const redis = new Redis({ url: settings.redisUrl, token: settings.redisToken, automaticDeserialization: false, retry: false });
  return new LoginStore(redis, settings.secret, settings.appId);
}

export async function smallRequestBody(event: H3Event, maximum: number) {
  const parts: Buffer[] = [];
  let size = 0;
  for await (const part of event.node.req) {
    const buffer = Buffer.isBuffer(part) ? part : Buffer.from(part);
    size += buffer.length;
    if (size > maximum)
      throw createError({ statusCode: 413, statusMessage: 'Request too large' });
    parts.push(buffer);
  }
  return Buffer.concat(parts).toString('utf8');
}
