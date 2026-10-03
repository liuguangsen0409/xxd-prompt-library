import { decryptMessage, verifySignature } from '../lib/wechat';

export default defineEventHandler((event) => {
  const settings = wechatSettings(event);
  const query = getQuery(event);
  const value = (name: string) => typeof query[name] === 'string' ? query[name] as string : '';
  const echo = value('echostr');
  if (!echo || echo.length > 4096)
    throw createError({ statusCode: 400, statusMessage: 'Invalid challenge' });
  setHeader(event, 'content-type', 'text/plain; charset=utf-8');
  if (value('msg_signature')) {
    if (!verifySignature(settings.token, value('timestamp'), value('nonce'), value('msg_signature'), echo))
      throw createError({ statusCode: 403, statusMessage: 'Invalid signature' });
    try {
      return decryptMessage(echo, settings.encodingAesKey, settings.appId);
    } catch {
      throw createError({ statusCode: 400, statusMessage: 'Invalid challenge' });
    }
  }
  // Official-account URL verification also uses an unencrypted GET challenge in safe mode.
  if (!verifySignature(settings.token, value('timestamp'), value('nonce'), value('signature')))
    throw createError({ statusCode: 403, statusMessage: 'Invalid signature' });
  return echo;
});
