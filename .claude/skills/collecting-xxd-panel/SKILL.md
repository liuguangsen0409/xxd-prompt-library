---
name: collecting-xxd-panel
description: Use when 用户要求收录新的 xxd-panel 仓库（如 xxd-panel-002、xxd-panel-003）、抓取 xxd-panel 原仓库、新增 Prompt 文章，或问「下一篇提示词文章怎么加」时使用；也响应 collecting-xxd-prompt 的称呼，自动完成原图与首页缩略图收录
---

# 收录 xxd-panel 文章

## Overview

把 GitHub 上 `nevertoday/xxd-panel-XX` 系列仓库收录为本站 Prompt 文章。核心原则：**原始提示词逐字引用，是唯一审美权威**；站点规则（标点、组件、命名）以项目 CLAUDE.md「新增 Prompt 文章流程」为准，本 skill 是其操作程序。标准范例：`www/content/2.prompts/1.xxd-panel-001.md`。

## 操作步骤

### 1. 抓取原仓库

用 curl 抓 `https://raw.githubusercontent.com/nevertoday/<slug>/main/` 下的：

- `README.md` — 风格定位、特征（写「它是什么」「风格速览」的素材）
- `LICENSE` — 协议（系列内已知为 PolyForm Noncommercial License 1.0.0）
- `references/original-prompt/zh-CN.md` — 原始提示词权威源
- `assets/examples/` 目录列表（GitHub API `repos/nevertoday/<slug>/contents/assets/examples`）— 候选样张

若仓库不存在或目录结构不同，如实汇报并向用户确认，不要猜。

### 2. 定 title

title 直接用**原仓库 README 顶部标题「｜」之后的风格名**（如 001「复古稚趣志」、002「俏皮包豪斯」），不含 Panel 编号。README 缺失或没有这种格式时，再从内容提炼并给用户 2-3 个候选。

### 3. 样张上传 imgBB

- 只选 **4 张 3:4 上下双联款**（惯例为 `sample-09.png` ~ `sample-12.png`，文件名不同时按图片内容判断），不收 16:9 组
- 下载到 /tmp 并改名 `<slug>-sample-XX.png`（各仓库样张同名，防覆盖混淆）
- 上传原图到 ImgBB，key 从项目根 `.env` 读取；取 `data.image.url` 作为详情页直链。不要打印凭据、完整上传响应或删除链接。不要将默认 `thumb` 当作本站首页缩略图。
- **追加**进 `imgbb-manifest.json` 的 `uploads[]`，字段与现有条目一致：`file`（**记改名后的本地文件名**，如 `xxd-panel-002-sample-09.png`）/ `source`（原仓库 blob 链接）/ `desc` / `url` / `thumb` / `deleteUrl`（上传响应里当场取，不补记）/ `uploadedAt`
- 验证：每个直链 `curl -I` 返回 200

### 4. 创建文章

`www/content/2.prompts/<下一个序号>.<slug>.md`，结构完全镜像 `1.xxd-panel-001.md`：

frontmatter（title / description / icon / styleCategory）→ `::sample-grid`（imgBB 直链 + `alt: <slug> 样张`）→ `## 它是什么` → `## 风格速览` → `## 提示词与运行适配器`（一句话引言 + `::prompt-builder` 包 ```text 代码块）→ `::prompt-source`。

关键点：

- 原始提示词逐字粘贴：首行若是归档标题（`# Original XXD Panel 002 style brief` 之类）去掉该行，首行直接是正文则全文引用；其余一字不动，包括结尾没有句号也不要补
- `::prompt-source` 传 `url` / `name` / `author` / `license` / `licenseUrl`
- 不写适配器内容、不加默认模式 callout（`::prompt-builder` 组件已覆盖）

### 5. 自动风格分类（每次收录必做）

- 阅读原始提示词，按 `docs/style-categories.md` 的主风格规则归类。每篇只能有一个主分类；具体媒材优先于通用留白、纸感和排版要求，混合风格以最主要的视觉语言为准。
- 执行 `pnpm categories <slug>`：规则会优先读取原始提示词，自动补齐缺失的 `styleCategory`，不会覆盖已有人工判断。
- 规则报告待判断时，由收录助手阅读全文，自行从既有 12 类选定最合适的一类并写入 frontmatter；这属于常规收录工作，不需要用户再次提醒或确认。复核自动结果，尤其注意正文里的否定要求和上游重复标题。
- 执行 `pnpm categories <slug> --check`，确认目录能显示该文章并归入正确分类。

### 6. 自动生成首页缩略图（每次收录必做）

文章写好后，从项目根执行：

```bash
pnpm thumbnails xxd-panel-225 # 换成正在收录的实际 slug
pnpm thumbnails xxd-panel-225 --check
```

- 脚本 `www/scripts/prepare-thumbnails.mjs` 自动读取文章选图，分别生成 480px 宽、quality 72 的 WebP，保留比例且不放大小图，然后上传 ImgBB。不合并三张图。
- 默认处理前三张首页图片及第四张备用图；存在 `gallery.images` 时按实际首页选图生成。详情页 `sample-grid.images` 不改，仍是高清原图。
- 每次上传立即追加本地 `imgbb-manifest.json`（含 `originalUrl`、`recipe`、尺寸、deleteUrl），公开映射写入 `www/data/style-thumbnails.json`。映射必须随文章提交，但本地 manifest 和 `.env` 绝不提交。
- 已处理图片会跳过，支持断点恢复。首次迁移或补齐全站用 `pnpm thumbnails --all --limit 10 --interval-seconds 10`，每次只处理一批，不代表全站完成；全站完成以 `pnpm thumbnails:check` 为准。
- 上传失败后查看错误及 ImgBB 后台记录再重跑，禁止无上限重试或手工猜测缩略图地址。网络或凭据阻塞时保留已完成记录，并明确报告尚未完成；不能只上传原图就声称收录完成。
- 收录收尾前必须通过指定 slug 的离线完整性检查；构建本身不会在 CI 中上传。全站历史迁移未完成时如实报告进度，不要把兼容回退当成收录完成。

默认每批最多 10 张、单线程、两张之间间隔 10 秒；`--limit` 控制每次最多处理的数量，`--interval-seconds` 控制间隔。这是保守策略，不是 ImgBB 官方配额。限流立即停止，记录公开限流响应头及下次允许尝试时间到 `.cache/thumbnail-upload-state.json`；无恢复时间时按 1、2、4、8、16、24 小时逐步退避，冷却期间运行不发上传请求。网络超时等结果不确定的上传不自动重试。每日仍持续被限流时应检查账户限制，不更换 key 或网络绕过限额。

### 7. 逐字校验

先看原文件首行：是形如 `# Original XXD Panel 002 style brief` 的归档标题就去掉再比，**首行直接是正文则全文比对**（新批次仓库多数没有归档标题）。`diff` 文章代码块内容与原文件：仅末尾空行/换行差异可归一后再比，**其余任何字符差异零容忍**。

### 8. 自查与验证

- 中文标点检查：`grep -n '[一-鿿][.:;,!?]' <文章>`（代码块、比例、URL 除外），正文与 description 改全角
- `pnpm dev` 访问新文章页：200、样张渲染、PromptBuilder 预览默认拼装正确、无 SSR 报错
- 首页验证：新风格的三张图请求 ImgBB 缩略图直链，不经过 `/api/image-proxy`；详情页和放大仍使用原图。
- `pnpm categories <slug> --check`、`pnpm thumbnails <slug> --check` 与 `pnpm lint`；全站迁移使用 `pnpm thumbnails:check` 查看剩余量

### 9. 收尾

- 首页画板（`/embed/styles`）从内容自动提取新文章；缩略图映射由脚本维护，不需要手工改索引或导航配置
- 按用户指示 commit（`feat: add <slug> article` 风格；`.claude/settings.local.json` 是 gitignore 的个人配置，不要 stage）

## Common Mistakes

| 陷阱 | 正确做法 |
|---|---|
| 把归档标题写进正文或额外说明 | 只去掉，不解释 |
| 「优化」原始提示词（补句号、改标点） | 逐字引用，diff 零差异 |
| 上游原文含整段重复（粘贴事故，如 024） | 保留第一份完整版本并删去重复，在 `::prompt-source` 的 slot 里注明；两个版本有措辞差异时保留信息更全的一份，必要时问用户 |
| 提交 `imgbb-manifest.json` 或 `.env` | 已 gitignore，绝不提交 |
| 改 `1.usage.md` 来适配新文章 | usage 是全系列通用页，新文章不需要动它 |
| 忘记 manifest 追加记录 | 每张图上传后立即写入，含 deleteUrl |
| 只上传原图，遗漏首页小图 | 建文章后执行 `pnpm thumbnails <slug>` 并通过 `--check` |
| 把小图地址写进 sample-grid | 详情页保留原图；小图只进入公开缩略图映射 |

## Red Flags - 停下来问用户

- 仓库结构对不上（找不到 `references/original-prompt/zh-CN.md` 或样张目录）
- 样张不足 4 张 3:4 上下双联款
- 协议与 PolyForm Noncommercial 不同
