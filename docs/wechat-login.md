# 公众号验证码登录

网站继续向游客开放浏览、搜索和复制。顶部登录弹窗展示「中登前端自救之旅」二维码；用户向公众号发送「登录」，收到 6 位、5 分钟有效的验证码，回网站输入后保持登录 30 天。使用公众号用户标识建立稳定的网站身份，不读取微信昵称、头像，不要求 AppSecret。

## 实现

- Nuxt 服务端部署在 Vercel，`nuxt-auth-utils` 管理加密的 HttpOnly 会话 Cookie。
- `/api/wechat` 负责 URL 验证和 XML 消息回调，支持公众号安全模式的签名验证、AES 解密及加密回复。拒绝过期或伪造消息。
- Upstash Redis 保存验证码、消息去重和限流数据。Lua 脚本原子发码、消费验证码，支持 Vercel 多实例；不使用进程内存作为验证码存储。
- 网站用户 ID 由公众号 AppID、OpenID 与服务端密钥派生，浏览器不会收到 OpenID。
- 验码接口校验请求来源，设置 IP 和全局限流，错误不泄漏具体用户。未配置时返回友好提示，游客功能照常可用。
- 登录状态不影响公共页面缓存；会话和认证接口禁止缓存。用户可主动退出，不做取关封禁。

## 验证计划

测试微信签名、时间窗口、AES 格式及 AppID 校验、非法 XML、输入校验与原子消费。执行 ESLint、类型检查、构建与本地页面验证。正式账号回调和 Redis 连接必须部署后实测，不能以本地测试代替。

## Vercel 环境变量

| 名称 | 内容 |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` | Upstash 集成提供的 HTTPS REST 地址 |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash 集成提供的 REST Token |
| `NUXT_SESSION_PASSWORD` | 随机生成且至少 32 字符的独立会话密钥 |
| `NUXT_WECHAT_APP_ID` | 公众号的 AppID |
| `NUXT_WECHAT_TOKEN` | 自行生成的 3–32 位字母数字，与公众号 Token 一致 |
| `NUXT_WECHAT_ENCODING_AES_KEY` | 公众号表单随机生成的 43 位 EncodingAESKey |
| `NUXT_WECHAT_ORIGIN` | `https://xxd-prompt.unclejiwa.com` |

若 Vercel 集成使用 `KV_REST_API_URL` / `KV_REST_API_TOKEN` 命名，代码也支持这两个别名。凭据仅保存在服务端环境变量，禁止写入公开配置或提交仓库。更换会话密钥会使旧登录状态和用户派生 ID 失效，应长期保留并安全备份。

## 上线顺序

本机 `www/.env` 已准备公众号 AppID、Token、EncodingAESKey、会话密钥和正式站点 Origin，可逐项复制到 Vercel 的 Production 环境变量。此文件被 Git 忽略，不能提交或截图分享密钥。Redis 凭据沿用 Vercel 集成提供的环境变量。修改环境变量后需重新部署才会生效。

1. Vercel 使用 `pnpm build` 构建 Nuxt 服务端；不要使用 `pnpm generate` 部署登录功能。
2. 关联 Redis 并补齐以上 Production 环境变量，重新部署。
3. 在公众号「消息推送」填写 `https://xxd-prompt.unclejiwa.com/api/wechat`、匹配的 Token 和 EncodingAESKey，选择安全模式、XML，然后提交。
4. 从微信发送「登录」，收到验证码后在网站验证。验证同一验证码第二次不能使用；重新发送关键词可获取新的可用码；刷新页面仍登录，退出后恢复游客状态。
5. 启用消息推送可能影响公众号已有自动回复，本实现只处理登录关键词，其他消息不自动回复。已有运营回复规则需另行迁移。

Vercel 冷启动和微信到部署区域的网络延迟需通过真实消息测试；出现超时应检查函数日志及部署区域。不要记录验证码、OpenID、密钥或完整回调正文。

## 本地验证

- `pnpm test:wechat`：签名、加解密和输入检查；没有 `REDIS_TEST_URL` 时，Redis 集成测试会明确标记为跳过。
- `REDIS_TEST_URL=redis://127.0.0.1:6379 pnpm test:wechat`：连接专用、可丢弃的本地 Redis，额外验证并发发码、一次性消费、消息去重、过期和限流。不要连接生产数据库。CI 使用 Redis 7 服务运行完整测试。
- `pnpm typecheck`、`pnpm lint`、`pnpm build`：实际 `www` 站点的类型、代码规范和生产构建检查。
