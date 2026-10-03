import type { Redis } from '@upstash/redis';
import { createHmac, randomInt } from 'node:crypto';

// All transitions are atomic across serverless instances, including replay handling.
export const issueScript = `
local replay = redis.call('GET', KEYS[3])
if replay then return replay end
local active = redis.call('GET', KEYS[2])
if active then
  local value = cjson.decode(active)
  redis.call('SET', KEYS[3], value.code, 'EX', 300)
  return value.code
end
local claimed = redis.call('SET', KEYS[1], ARGV[1], 'EX', 300, 'NX')
if not claimed then return '' end
redis.call('SET', KEYS[2], ARGV[2], 'EX', 300)
redis.call('SET', KEYS[3], ARGV[3], 'EX', 300)
return ARGV[3]
`;

export const consumeScript = `
local raw = redis.call('GET', KEYS[1])
if not raw or raw == 'used' then return '' end
redis.call('SET', KEYS[1], 'used', 'KEEPTTL')
local value = cjson.decode(raw)
local active = redis.call('GET', value.userKey)
if active and cjson.decode(active).codeKey == KEYS[1] then
  redis.call('DEL', value.userKey)
end
return value.id
`;

export const limitScript = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return count
`;

export function privateId(secret: string, value: string) {
  return createHmac('sha256', secret).update(value).digest('hex');
}

export class LoginStore {
  private redis: Pick<Redis, 'eval'>;
  private secret: string;
  private appId: string;

  constructor(redis: Pick<Redis, 'eval'>, secret: string, appId: string) {
    this.redis = redis;
    this.secret = secret;
    this.appId = appId;
  }

  key(kind: string, value: string) {
    return `xxd:wechat:${this.appId}:${kind}:${privateId(this.secret, value)}`;
  }

  async limited(bucket: string, maximum: number, seconds: number) {
    const count = await this.redis.eval<number[], number>(limitScript, [this.key('limit', bucket)], [seconds]);
    return count > maximum;
  }

  async issue(openId: string, messageId: string) {
    const id = privateId(this.secret, `${this.appId}:${openId}`);
    const userKey = this.key('active', id);
    const messageKey = this.key('message', `${id}:${messageId}`);
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomInt(0, 1000000).toString().padStart(6, '0');
      const codeKey = this.key('code', code);
      const result = await this.redis.eval<string[], string>(issueScript, [codeKey, userKey, messageKey], [JSON.stringify({ id, userKey }), JSON.stringify({ code, codeKey }), code]);
      if (result)
        return result;
    }
    throw new Error('Code allocation failed');
  }

  async consume(code: string) {
    return this.redis.eval<string[], string>(consumeScript, [this.key('code', code)], []);
  }
}
