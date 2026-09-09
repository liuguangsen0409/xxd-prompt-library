# CLAUDE.md

本项目是一个 prompt library 文档站，基于开源模板 [shadcn-docs-nuxt](https://github.com/ZTL-UwU/shadcn-docs-nuxt) (v1.2.2, MIT) 改造。所有开发由 AI 辅助完成，本文档是 AI 协作的唯一规范来源，需要更新时直接修改此文件。

## 常用命令

```bash
nvm use 22.22.2        # 本机必须（Node 20 的 corepack 跑不了 pnpm 11）
pnpm dev               # 开发服务器，http://localhost:3000（实际执行 nuxt dev www）
pnpm build             # 生产构建（SSR）
pnpm generate          # 静态站生成（SSG）
pnpm lint              # ESLint 检查
pnpm lint:fix          # ESLint 自动修复
pnpm typecheck         # vue-tsc 类型检查
```

包管理器只用 pnpm（corepack 按 package.json 的 packageManager 字段锁定版本），不要用 npm/yarn。

## 架构：双目录结构

这是理解本项目的关键。仓库分两层：

- **根目录 = 模板源码层**：UI 组件、布局、composables、lib、插件。本身不可直接运行。
- **`www/` = 站点层**：实际运行的 Nuxt 应用，通过 `extends: ['..']` 继承根目录的一切。**站点的实际内容（markdown）、站点配置（`www/nuxt.config.ts`、`www/app.config.ts`）、server API（`www/server/`）、embed 页面（`www/pages/`）都在这一层。**

改动规则：
- 改 UI / 组件 / 布局 / 通用逻辑 → 根目录（`components/`、`composables/`、`lib/`）
- 改站点内容 / 站点配置 / 文案 → `www/`

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Nuxt 4.5（SSR/SSG）、Vue 3.5 `<script setup>` |
| 样式 | Tailwind CSS v4：入口 `www/assets/css/tailwind.css`（`@import 'tailwindcss'` + `@config` 桥接旧版 `www/tailwind.config.js`，主题色 token 在根 `assets/css/themes.css`） |
| UI 组件 | shadcn-vue（经 shadcn-nuxt 模块，组件带 `Ui` 前缀放 `components/ui/`，底层 reka-ui） |
| 内容 | `@ztl-uwu/nuxt-content`（Nuxt Content 分叉）+ `@nuxtjs/mdc`，内容源在 `www/content/`，MDC 语法 |
| 国际化 | `@nuxtjs/i18n`，策略 `prefix_except_default`，唯一 locale 是 `zhcn`（模板自带的 en/fr/it/km 演示内容已删除，语言切换器已关闭） |
| 图标 | `@nuxt/icon` + lucide / vscode-icons（本地 bundle） |
| 其他 | color-mode（暗色模式）、nuxt-og-image、@vueuse、mermaid、shiki 代码高亮 |

## 目录速查

```
components/
  ui/          # shadcn-vue 基础组件（button、card、dialog…），Ui 前缀自动导入
  content/     # MDC 内容组件（在 markdown 里用的：Callout、CodeGroup、Tabs、Steps、FileTree…）
               #   以及 Prose* 组件（markdown 元素的渲染覆盖）
  layout/      # 页面骨架（Header、Aside 侧边栏、Toc 目录、Footer、SearchDialog…）
composables/    # useConfig（读取 app.config）、useThemes、useScrollspy、useI18nDocs…
lib/           # utils.ts 的 cn()（clsx + tailwind-merge）、themes.ts（主题预设）
pages/         # index.vue + [...slug].vue（document-driven 模式，markdown 自动生成路由）
assets/css/    # themes.css（主题色 token / CSS 变量）
www/
  content/     # 站点 markdown 内容（单一默认 locale，无 locale 子目录；编号前缀定顺序）
  assets/css/tailwind.css   # Tailwind 入口；www/tailwind.config.js 为其桥接的旧版 JS 配置
  nuxt.config.ts / app.config.ts   # 站点层配置
  pages/embed/ # 非文档路由（styles.vue：首页画板的 iframe 内页）
  server/api/  # 站点层 Nitro API（styles、image-proxy）
  i18n/        # 仅 i18n.config.ts（自定义 locale 解析），无 locales 文案目录
```

> 注：根 nuxt.config 里 css 数组引用的 `~/assets/css/tailwind.css`，`~` 别名在 www 站点上下文中解析到 `www/`，即上面的入口文件。根目录下没有这个文件，dev 日志里的相关 WARN 是无害的。

## 编码规范

遵循根目录 `eslint.config.js`（@antfu 配置），提交前跑 `pnpm lint`：

- 2 空格缩进、单引号、带分号、1tbs 花括号风格
- Vue SFC block 顺序：`<template>` → `<script setup>` → `<style>`
- TypeScript 严格模式；组件 props 用 `defineProps<{...}>()` 类型声明，不传运行时对象
- 组件自动导入（不需要手动 import 本项目组件和 composables）
- 样式只用 Tailwind 工具类 + CSS 变量（主题色用 `--primary`、`--muted` 等 token，禁止写死颜色值，否则暗色模式和主题切换会失效）
- class 拼接统一用 `cn()`（`lib/utils.ts`）
- 图标用 `<Icon>` 组件 + iconify 名称（如 `lucide:rocket`），不引入新图标库

## 内容（markdown）规范

- 文件放 `www/content/`，frontmatter 至少含 `title`；用 MDC 语法（`::callout`、`::code-group`、`:icon` props 等）
- 代码块高亮语言需在 `www/nuxt.config.ts` 的 `content.highlight.langs` 里注册过
- 目录名数字前缀决定侧边栏顺序
- `www/content/**/*.md` 被 eslint 忽略，不受 lint 约束

## 首页画板（style-board embed）架构

首页中部的风格画板是本项目唯一的非文档路由，由 iframe 嵌套构成，改动时注意整条链路：

- **外层组件** `components/content/StyleBoardEmbed.vue`：在 `index.md` 里以 `::style-board-embed` 使用，负责渲染 iframe（`/embed/styles`）并监听 iframe 的 postMessage 动态调高度、同步明暗主题
- **iframe 内页** `www/pages/embed/styles.vue`：`documentDriven: false`、noindex；浏览器直接访问（非 iframe 上下文）会被 `location.replace('/#styles')` 弹回首页
- **嵌入模式**：`app.vue` 里 `isEmbed`（路径为 `/embed/styles`）时不渲染 Header/Footer/Banner，只渲染页面本身；iframe 内主题靠 postMessage 同步（不依赖 color-mode）
- **postMessage 协议**：iframe → 外层 `styles:ready` / `styles:height`（ResizeObserver 上报内容高度，外层据此调 iframe 高度）；外层 → iframe `styles:theme`（`light`/`dark`）
- **数据**：`www/server/api/styles.get.ts`（`/api/styles`）——从 `/prompts` 内容提取每篇的 sample-grid 前三张图，5 分钟内存缓存；支持 `page`/`limit` 分页（默认页大小 12）与 `all=1` 全量；分页大小上限 60
- **图片**：`www/server/api/image-proxy.get.ts`（`/api/image-proxy`）——imgBB 原图经 sharp 压缩转 webp/jpeg，磁盘缓存在 `/tmp/xxd-style-image-cache`；sharp 是 `www/package.json` 的显式依赖，不要移除
- **画板内交互**：搜索框是本地过滤（输入即筛，搜索时在全量池里匹配标题/描述/编号）；「换个顺序」会拉全量（`all=1`，结果缓存于组件内）整体洗牌后客户端分窗展示
- **预渲染**：`www/nuxt.config.ts` 的 nitro prerender 包含 `/embed/styles` 与 `/api/styles`，新增相关路由时记得同步

## 新增 Prompt 文章流程（SOP，已跑通）

以 xxd-panel-001（`www/content/2.prompts/1.xxd-panel-001.md`）为标准范例，新文章按以下顺序操作：

1. **抓原仓库**：确认出处（repo URL、作者）、协议声明（有则记下，如 PolyForm Noncommercial License 1.0.0）、原始提示词文件路径（原仓库一般在 `references/original-prompt/zh-CN.md`）、可用样张图。
2. **上传样张**：见下方 imgBB 规则；样张优先选 3:4 上下双联款，记录进 `imgbb-manifest.json`。
3. **建文章文件**：`www/content/2.prompts/<序号>.<panel-slug>.md`，frontmatter 含 `title`（取原仓库 README 顶部标题「｜」后的风格名，如「复古稚趣志」「俏皮包豪斯」）、`description`、`icon`。
4. **写正文**，固定结构：`::sample-grid`（顶部样张）→ `## 它是什么`（一段概述 + 适用场景列表）→ `## 风格速览`（可选，特征列表）→ `## 提示词与运行适配器`（一句话引言 + `::prompt-builder` 组件）→ `::prompt-source`（来源与致谢）。
5. **自查**：中文标点检查（见下）、逐字比对原始提示词、`pnpm lint`。
6. **dev server 验证**：访问新文章页，确认渲染正常、PromptBuilder 预览默认拼装正确。

文章本体规则：

- **原始提示词必须逐字引用**，放进 `::prompt-builder` 组件的默认 slot（组件提供运行适配器拼装、预览与复制，不要在文章里重复适配器内容，也不要再加默认模式的 callout 说明）；原始提示词文件的**首行归档标题**（如 `# Original XXD Panel 001 style brief`）是仓库内部标签，不进入生图请求，抓取时不要放进正文，也不要额外说明
- **Panel 名称写法**：文章正文（如「它是什么」）与样张 `alt` 中引用 Panel 一律用仓库小写连字符形式（如 `xxd-panel-001`），不用「XXD Panel 001」这类展示名
- 运行适配器、使用方法等各仓库共有的内容**不要写进单篇文章**，统一放 `www/content/1.usage.md`（使用指南）
- **中文标点检查（写完必查）**：中文文章的正文与 frontmatter `description` 一律用全角标点（。，；：？！）。检查命令：`grep -n '[一-鿿][.:;,!?]' <文件>`（需人工排除代码块行），发现即改成全角
  - 例外：代码块内逐字引用保持原文标点**不动**；数字比例（`3:4`、`16:9`、`1:1`）、URL、文件路径、markdown 语法保持半角

图片与来源规则：

- **样张图不进本地仓库**，统一上传 imgBB（免费、不限量、永不过期）。API key 在项目根 `.env` 的 `IMGBB_API_KEY`（已 gitignore，严禁提交或外泄）
- 上传命令：`curl -s "https://api.imgbb.com/1/upload?key=$IMGBB_API_KEY" -F "image=@图片文件"`，取响应 `data.image.url` 作为文章直链
- 上传记录（直链、删除链接、**原仓库出处**）写入项目根 `imgbb-manifest.json`（已 gitignore——删除链接能删图，绝不能提交；链接失效时可从原仓库重新上传）
- 文章顶部样张用 `::sample-grid` 组件（`components/content/SampleGrid.vue`）：frontmatter 传 `images`（URL 数组）与 `alt`，自动两列网格 + 点击放大
- 来源与致谢用 `::prompt-source` 组件（`components/content/PromptSource.vue`）：props 传 `url` / `name` / `author`，可选 `license` / `licenseUrl`（原仓库声明了开源协议时传入，渲染版权声明行），默认 slot 写「整理自原仓库哪个文件、是否逐字引用」

## 本机环境注意

- devDependencies 里的 `@shikijs/core` 是为了对抗家目录 `~/node_modules` 残留的旧版本遮蔽问题而显式加入的，不要移除（除非 `~/node_modules` 已清理）
- 家目录若仍有 `~/node_modules`，模块解析可能被其干扰，遇到诡异的依赖报错先想到它

## 改码后验证页面（强制）

每次改完代码（`.vue` / `.ts` / `.js` / `.css` 等站点相关文件），必须验证页面仍可正常访问，验证通过才能宣布任务完成：

- dev server 未运行时先启动 `pnpm dev`（后台运行），确认页面能打开
- 至少访问 http://localhost:3000 及受改动影响的页面，确认返回正常且渲染无报错（控制台/终端无 SSR 错误）
- 本仓库已配置 PostToolUse hook（`.claude/settings.json` + `.claude/hooks/verify-page.py`）：dev server 运行期间每次 Edit/Write 代码文件后自动 curl 冒烟检查，若返回 HTTP 非 200 会把警告注入上下文——收到警告必须先排查修复，不得忽略
- 若 dev server 本来就没在跑（hook 静默跳过），改完代码后仍需按前两条手动验证
