import process from 'node:process';
import { normalizeCode } from '../../lib/wechat';

export default defineEventHandler(async (event) => {
  const settings = wechatSettings(event);
  const origin = getHeader(event, 'origin');
  const expectedOrigin = import.meta.dev ? getRequestURL(event).origin : settings.origin;
  if (origin !== expectedOrigin)
    throw createError({ statusCode: 403, statusMessage: 'Invalid origin' });
  if (!getHeader(event, 'content-type')?.startsWith('application/json'))
    throw createError({ statusCode: 415, statusMessage: 'JSON required' });
  let code: string | null = null;
  try {
    code = normalizeCode(JSON.parse(await smallRequestBody(event, 1024))?.code);
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid input' });
  }
  if (!code)
    throw createError({ statusCode: 400, statusMessage: 'Invalid code', data: { message: '请输入 6 位数字验证码。' } });
  // Vercel overwrites x-forwarded-for with the connecting client's IP.
  const ip = process.env.VERCEL ? getRequestIP(event, { xForwardedFor: true }) : getRequestIP(event);
  const store = wechatStore(settings);
  let limited: boolean;
  try {
    limited = await store.limited(`verify:${ip || 'unknown'}`, 10, 300)
      || await store.limited('verify:global', 200, 60);
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'Login temporarily unavailable' });
  }
  if (limited) {
    setHeader(event, 'retry-after', 300);
    throw createError({ statusCode: 429, statusMessage: 'Too many attempts', data: { message: '尝试次数过多，请 5 分钟后再试。' } });
  }
  let id: string;
  try {
    id = await store.consume(code);
  } catch {
    throw createError({ statusCode: 503, statusMessage: 'Login temporarily unavailable' });
  }
  if (!id)
    throw createError({ statusCode: 400, statusMessage: 'Invalid code', data: { message: '验证码不正确、已过期或已使用，请向公众号重新发送「登录」。' } });
  await replaceUserSession(event, { user: { id }, loggedInAt: new Date().toISOString() });
  return { ok: true };
});
