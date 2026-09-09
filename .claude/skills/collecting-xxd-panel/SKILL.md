---
name: collecting-xxd-panel
description: Use when 用户要求收录新的 xxd-panel 仓库（如 xxd-panel-002、xxd-panel-003）、抓取 xxd-panel 原仓库、新增 Prompt 文章，或问「下一篇提示词文章怎么加」时使用
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
- 上传：`curl -s "https://api.imgbb.com/1/upload?key=$IMGBB_API_KEY" -F "image=@<文件>"`（key 在项目根 `.env`）
- **追加**进 `imgbb-manifest.json` 的 `uploads[]`，字段与现有条目一致：`file`（**记改名后的本地文件名**，如 `xxd-panel-002-sample-09.png`）/ `source`（原仓库 blob 链接）/ `desc` / `url` / `thumb` / `deleteUrl`（上传响应里当场取，不补记）/ `uploadedAt`
- 验证：每个直链 `curl -I` 返回 200

### 4. 创建文章

`www/content/2.prompts/<下一个序号>.<slug>.md`，结构完全镜像 `1.xxd-panel-001.md`：

frontmatter（title / description / icon）→ `::sample-grid`（imgBB 直链 + `alt: <slug> 样张`）→ `## 它是什么` → `## 风格速览` → `## 提示词与运行适配器`（一句话引言 + `::prompt-builder` 包 ```text 代码块）→ `::prompt-source`。

关键点：

- 原始提示词逐字粘贴：首行若是归档标题（`# Original XXD Panel 002 style brief` 之类）去掉该行，首行直接是正文则全文引用；其余一字不动，包括结尾没有句号也不要补
- `::prompt-source` 传 `url` / `name` / `author` / `license` / `licenseUrl`
- 不写适配器内容、不加默认模式 callout（`::prompt-builder` 组件已覆盖）

### 5. 逐字校验

先看原文件首行：是形如 `# Original XXD Panel 002 style brief` 的归档标题就去掉再比，**首行直接是正文则全文比对**（新批次仓库多数没有归档标题）。`diff` 文章代码块内容与原文件：仅末尾空行/换行差异可归一后再比，**其余任何字符差异零容忍**。

### 6. 自查与验证

- 中文标点检查：`grep -n '[一-鿿][.:;,!?]' <文章>`（代码块、比例、URL 除外），正文与 description 改全角
- `pnpm dev` 访问新文章页：200、样张渲染、PromptBuilder 预览默认拼装正确、无 SSR 报错
- `pnpm lint`

### 7. 收尾

- 首页画板（`/embed/styles`）从内容自动提取新文章，不需要改任何索引或导航配置
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

## Red Flags - 停下来问用户

- 仓库结构对不上（找不到 `references/original-prompt/zh-CN.md` 或样张目录）
- 样张不足 4 张 3:4 上下双联款
- 协议与 PolyForm Noncommercial 不同
