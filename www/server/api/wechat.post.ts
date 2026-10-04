import { randomBytes } from 'node:crypto';
import { decryptMessage, encryptMessage, parseMessage, signatureFor, verifySignature, xmlMessage } from '../lib/wechat';

export default defineEventHandler(async (event) => {
  const settings = wechatSettings(event);
  const query = getQuery(event);
  const value = (name: string) => typeof query[name] === 'string' ? query[name] as string : '';
  const body = await smallRequestBody(event, 16384);
  let message: Record<string, string>;
  try {
    const envelope = parseMessage(body);
    if (value('encrypt_type') !== 'aes' || !envelope.Encrypt || !verifySignature(settings.token, value('timestamp'), value('nonce'), value('msg_signature'), envelope.Encrypt))
      throw new Error('Invalid signature');
    message = parseMessage(decryptMessage(envelope.Encrypt, settings.encodingAesKey, settings.appId));
    if (!message.FromUserName || !message.ToUserName || envelope.ToUserName !== message.ToUserName)
      throw new Error('Invalid sender');
  } catch {
    throw createError({ statusCode: 403, statusMessage: 'Invalid WeChat message' });
  }
  const keyword = message.Content?.trim();
  if (message.MsgType !== 'text' || (keyword !== '登录' && keyword !== '测试'))
    return 'success';
  if (!message.MsgId || !/^\d+$/.test(message.MsgId))
    throw createError({ statusCode: 400, statusMessage: 'Invalid message ID' });
  let content: string;
  if (keyword === '测试') {
    content = '消息接收正常';
    // eslint-disable-next-line no-console -- Explicit diagnostic keyword; never log message contents or credentials.
    console.info('[wechat] diagnostic reply prepared');
  } else {
    try {
      const store = wechatStore(settings);
      if (await store.limited(`issue:${message.FromUserName}`, 10, 300)) {
        content = '获取验证码过于频繁，请 5 分钟后再试。';
      } else {
        const code = await store.issue(message.FromUserName, message.MsgId);
        content = `你的登录验证码：${code}\n验证码自生成起 5 分钟内有效，只能使用一次，请勿转发。\n请回到提示词网站输入验证码，完成登录。\n如果不是你本人操作，请忽略本消息。`;
      }
    } catch {
      throw createError({ statusCode: 503, statusMessage: 'Login temporarily unavailable' });
    }
  }
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomBytes(12).toString('hex');
  const reply = xmlMessage({ ToUserName: message.FromUserName, FromUserName: message.ToUserName, CreateTime: timestamp, MsgType: 'text', Content: content });
  const encrypted = encryptMessage(reply, settings.encodingAesKey, settings.appId);
  setHeader(event, 'content-type', 'application/xml; charset=utf-8');
  return xmlMessage({ Encrypt: encrypted, MsgSignature: signatureFor(settings.token, timestamp, nonce, encrypted), TimeStamp: timestamp, Nonce: nonce });
});
