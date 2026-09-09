# PromptBuilder 交互组件实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Prompt 文章页新增 `PromptBuilder.vue` MDC 组件：用户选择画布比例、输出模式、文字模式后实时拼装运行适配器文本，支持「复制追加部分」和「复制完整请求」。

**Architecture:** 单个 Vue SFC 内容组件（`components/content/PromptBuilder.vue`），适配器文本模板硬编码在组件内；原始提示词通过 MDC slot 传入、挂载后读取 textContent；拼装结果为 computed，预览常显。设计 spec 见 `docs/superpowers/specs/2026-09-03-prompt-builder-design.md`。

**Tech Stack:** Nuxt 4 / Vue 3.5 `<script setup>`、Tailwind v4（主题 token）、shadcn-vue（UiButton）、@vueuse（useClipboard）、shadcn toast。

**关于测试的说明:** 本项目没有单元测试基建（package.json 无 test script），CLAUDE.md 规定的验证方式是 dev server 页面验证 + `pnpm lint`。因此本计划用显式的人工验证步骤替代 TDD 的断言步骤，每步给出具体操作与预期结果。

**环境前置:** 所有命令前先 `nvm use 22.22.2`（Node 20 的 corepack 跑不了 pnpm 11）。

---

## Task 1: 创建 PromptBuilder.vue 组件（完整实现）

**Files:**
- Create: `components/content/PromptBuilder.vue`

- [ ] **Step 1: 创建组件文件，写入以下完整内容**

```vue
<template>
  <div class="not-prose my-6 space-y-6 rounded-lg border border-muted bg-muted/30 p-4 text-sm md:p-6">
    <div class="space-y-1">
      <p class="flex items-center gap-2 text-base font-semibold text-foreground">
        <SmartIcon name="lucide:sliders-horizontal" :size="18" class="shrink-0 text-primary" />
        运行适配器拼装
      </p>
      <p class="text-muted-foreground">
        选项已按<a
          href="/usage"
          class="font-medium text-primary underline underline-offset-4 hover:opacity-80"
        >使用指南</a>的默认值预选，改动后复制即可。原始提示词管审美，适配器只管交付容器。
      </p>
    </div>

    <section class="space-y-2">
      <p class="text-xs font-medium tracking-wide text-muted-foreground">
        原始提示词
      </p>
      <div ref="originalRef">
        <slot />
      </div>
    </section>

    <section class="space-y-3">
      <p class="text-xs font-medium tracking-wide text-muted-foreground">
        ① 最终画布
      </p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="r in RATIOS"
          :key="r"
          type="button"
          :class="pillClass(!isCustomRatio && selectedRatio === r)"
          @click="isCustomRatio = false; selectedRatio = r"
        >
          {{ r }}
        </button>
        <button
          type="button"
          :class="pillClass(isCustomRatio)"
          @click="isCustomRatio = true"
        >
          自定义
        </button>
      </div>
      <input
        v-if="isCustomRatio"
        v-model="customCanvas"
        placeholder="如 16:10 或 1920x1080"
        class="w-full rounded-md border border-muted bg-transparent px-3 py-2 text-sm outline-none focus:border-primary"
      >
    </section>

    <section class="space-y-3">
      <p class="text-xs font-medium tracking-wide text-muted-foreground">
        ② 输出模式
      </p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="m in OUTPUT_MODES"
          :key="m.value"
          type="button"
          :class="pillClass(outputMode === m.value)"
          @click="outputMode = m.value"
        >
          {{ m.label }}
        </button>
      </div>
      <div v-if="outputMode === 'WALLPAPER_PACK'" class="space-y-3 rounded-md border border-muted p-3">
        <div class="space-y-2">
          <p class="text-xs text-muted-foreground">
            设备
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="d in DEVICES"
              :key="d.value"
              type="button"
              :class="pillClass(device === d.value)"
              @click="device = d.value"
            >
              {{ d.label }}
            </button>
          </div>
        </div>
        <div class="space-y-2">
          <p class="text-xs text-muted-foreground">
            壁纸关系
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="r in WALLPAPER_RELATIONS"
              :key="r.value"
              type="button"
              :class="pillClass(wallpaperRelation === r.value)"
              @click="wallpaperRelation = r.value"
            >
              {{ r.label }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <section class="space-y-3">
      <p class="text-xs font-medium tracking-wide text-muted-foreground">
        ③ 文字模式
      </p>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="m in TEXT_MODES"
          :key="m.value"
          type="button"
          :class="pillClass(textMode === m.value)"
          @click="textMode = m.value"
        >
          {{ m.label }}
        </button>
      </div>
      <div v-if="textMode !== 'NONE'" class="flex items-center gap-2">
        <span class="text-xs text-muted-foreground">语言</span>
        <select
          v-model="language"
          class="rounded-md border border-muted bg-transparent px-2 py-1 text-sm outline-none focus:border-primary"
        >
          <option v-for="lang in LANGUAGES" :key="lang" :value="lang">
            {{ lang }}
          </option>
        </select>
      </div>
      <input
        v-if="textMode === 'USER_EXACT'"
        v-model="userText"
        placeholder="画面文案（逐字使用）"
        class="w-full rounded-md border border-muted bg-transparent px-3 py-2 text-sm outline-none focus:border-primary"
      >
    </section>

    <section class="space-y-2">
      <p class="text-xs font-medium tracking-wide text-muted-foreground">
        ④ 其他要求（可选）
      </p>
      <textarea
        v-model="extraRequirements"
        rows="2"
        placeholder="逐字追加在全部内容末尾；留空则不加"
        class="w-full resize-y rounded-md border border-muted bg-transparent px-3 py-2 text-sm outline-none focus:border-primary"
      />
    </section>

    <section class="space-y-2">
      <p class="text-xs font-medium tracking-wide text-muted-foreground">
        预览（追加部分）
      </p>
      <pre class="max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-muted bg-background p-3 font-mono text-xs leading-relaxed">{{ adapterText }}</pre>
    </section>

    <div class="flex flex-wrap gap-3">
      <UiButton size="sm" @click="copyText(adapterText)">
        复制追加部分
      </UiButton>
      <UiButton size="sm" variant="outline" @click="copyText(fullRequest)">
        复制完整请求
      </UiButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToast } from '@/components/ui/toast/use-toast';
import { cn } from '@/lib/utils';

type OutputMode = 'TOP_BOTTOM' | 'LEFT_RIGHT' | 'DESIGN_ONLY' | 'WALLPAPER_PACK';
type TextMode = 'ORIGINAL_PROMPT_GENERATED' | 'USER_EXACT' | 'NONE';

const RATIOS = ['1:1', '3:4', '4:3', '4:5', '5:4', '2:3', '3:2', '9:16', '16:9', '21:9', '5:7', '7:5'];
const LANGUAGES = ['简体中文', '繁體中文', 'English', '日本語'];
const OUTPUT_MODES: { value: OutputMode; label: string }[] = [
  { value: 'TOP_BOTTOM', label: '上下分栏' },
  { value: 'LEFT_RIGHT', label: '左右分栏' },
  { value: 'DESIGN_ONLY', label: '纯设计稿' },
  { value: 'WALLPAPER_PACK', label: '壁纸包' },
];
const DEVICES: { value: string; label: string }[] = [
  { value: 'PHONE', label: '手机' },
  { value: 'IPAD', label: '平板' },
  { value: 'DESKTOP', label: '桌面' },
  { value: 'WATCH', label: '手表' },
];
const WALLPAPER_RELATIONS: { value: string; label: string }[] = [
  { value: 'INDEPENDENT', label: '独立' },
  { value: 'LINKED', label: '联动' },
];
const TEXT_MODES: { value: TextMode; label: string }[] = [
  { value: 'ORIGINAL_PROMPT_GENERATED', label: '模型生成' },
  { value: 'USER_EXACT', label: '自定义文案' },
  { value: 'NONE', label: '不要文字' },
];

const selectedRatio = ref('3:4');
const isCustomRatio = ref(false);
const customCanvas = ref('');
const outputMode = ref<OutputMode>('TOP_BOTTOM');
const device = ref('PHONE');
const wallpaperRelation = ref('INDEPENDENT');
const textMode = ref<TextMode>('ORIGINAL_PROMPT_GENERATED');
const language = ref('简体中文');
const userText = ref('');
const extraRequirements = ref('');

const canvas = computed(() => {
  if (!isCustomRatio.value) {
    return selectedRatio.value;
  }
  return customCanvas.value.trim() || '<比例>';
});

const originalRef = useTemplateRef<HTMLElement>('originalRef');
const originalPrompt = ref('');

onMounted(() => {
  originalPrompt.value = (originalRef.value?.textContent ?? '')
    .replaceAll(/\s*\/\/\s*\[!code (focus|\+\+|--|error|warning)\]/g, '')
    .trim();
});

function preamble() {
  return `【本次模式交付覆盖｜当前成品】

本段是当前展示模式、现实来源可见性、最终画布与设备交付的最终依据，
完整替换原始提示词中关于旧 3:4、上下位置、等分区域和旧上下容器的描述。
原始提示词关于设计转译、主体身份、颜色、材料、质感、内部构图、留白、
文字气质与排版的规则继续保持有效。

REALITY VIEW 指原始提示词定义的真实照片或事实场景。
TRANSFORMED DESIGN 指原始提示词定义的设计转译结果。

最终画布：${canvas.value}
构图方式：一次生成一张连贯的完整画布
精确分区：仅在用户明确要求时启用

颜色完全服从原始提示词已有的颜色处理逻辑。
除非用户明确提出颜色修改，否则不要增加、替换、概括或重新规划任何色盘。`;
}

function modeBlock() {
  if (outputMode.value === 'WALLPAPER_PACK') {
    return `输出模式：WALLPAPER_PACK
设备：${device.value}
壁纸关系：${wallpaperRelation.value}
为当前设备创作一张完整画布的 TRANSFORMED DESIGN 壁纸。REALITY VIEW 只作不可见参考；根据设备画布与可用屏幕空间重新构图，每个可见元素都属于设计成品。`;
  }
  if (outputMode.value === 'LEFT_RIGHT') {
    return `输出模式：LEFT_RIGHT
整张画面的主结构只有左右两个主要部分：REALITY VIEW 在左，TRANSFORMED DESIGN 在右，从画布顶部到底部共同形成完整的左右构图。所有可见内容与文字都融入这套左右结构；由图像模型自主决定不对称宽度、内部裁切或环境延展与留白。`;
  }
  if (outputMode.value === 'DESIGN_ONLY') {
    return `输出模式：DESIGN_ONLY
整张画面完全使用 TRANSFORMED DESIGN 的设计转译语言。REALITY VIEW 只作为不可见的主体身份、结构关系、颜色逻辑与事实依据；每个可见元素都属于原始提示词规定的设计转译结果，而不是未经转译的原始照片展示。`;
  }
  return `输出模式：TOP_BOTTOM
整张画面的主结构只有上下两个主要部分：REALITY VIEW 在上，TRANSFORMED DESIGN 在下，共同组织完整画布。由图像模型根据原图、原始提示词和最终画布决定两部分的视觉比例、内部裁切或环境延展、留白与文字布局。`;
}

function textModeBlock() {
  if (textMode.value === 'USER_EXACT') {
    return `TEXT MODE: USER_EXACT
TEXT LANGUAGE: ${language.value}
TEXT: 「${userText.value.trim() || '<用户准确文字>'}」

逐字使用，不改写、不翻译、不纠错、不添加其他文案。
排版方式与字体气质继续服从原始提示词。`;
  }
  if (textMode.value === 'NONE') {
    return `TEXT MODE: NONE
画面中不得出现任何字母、文字、数字、标题、标签、Logo 或伪文字。`;
  }
  return `TEXT MODE: ORIGINAL_PROMPT_GENERATED
TEXT LANGUAGE: ${language.value}

由图像模型按照原始提示词已有的文字生成逻辑生成。所有可见文字都应从
当前图片的内容、气质或隐喻中自然生长。任何以事实或资料形式呈现的信息，
必须来自用户提供、图片清晰可见或已经核实的真实信息；没有事实依据时，
使用诗意而非事实性的表达。运行层本身不是画面文案的来源。`;
}

const adapterText = computed(() => {
  const parts = [preamble(), modeBlock(), textModeBlock(), extraRequirements.value.trim()];
  return parts.filter(Boolean).join('\n\n');
});

const fullRequest = computed(() =>
  originalPrompt.value ? `${originalPrompt.value}\n\n${adapterText.value}` : adapterText.value,
);

const { toast } = useToast();
const { copy } = useClipboard({ legacy: true });

async function copyText(text: string) {
  await copy(text);
  toast({ description: '已复制到剪贴板' });
}

function pillClass(active: boolean) {
  return cn(
    'cursor-pointer rounded-full border px-3 py-1 text-xs transition-colors',
    active
      ? 'border-primary bg-primary text-primary-foreground'
      : 'border-muted bg-transparent text-muted-foreground hover:border-primary/50 hover:text-foreground',
  );
}
</script>
```

- [ ] **Step 2: 启动 dev server 验证组件可被解析**

组件在没被任何文章引用前页面不会渲染它，此步先确认 dev server 正常启动且无编译错误：

```bash
nvm use 22.22.2 && pnpm dev
```

Expected: 终端显示 `Local: http://localhost:3000`，无 Vue SFC 编译报错（若 dev server 已在跑，确认其热更新无报错即可）。

- [ ] **Step 3: 跑 lint 修复格式问题**

```bash
pnpm lint:fix && pnpm lint
```

Expected: lint 通过（若报模板属性顺序等问题，`lint:fix` 已自动修复）。

- [ ] **Step 4: Commit**

```bash
git add components/content/PromptBuilder.vue
git commit -m "feat: add PromptBuilder adapter assembly component"
```

---

## Task 2: 在 XXD Panel 001 文章中启用组件

**Files:**
- Modify: `www/content/2.prompts/1.xxd-panel-001.md:44-54`

- [ ] **Step 1: 用 `::prompt-builder` 包裹原始提示词代码块**

把文章中「原始提示词」一节现有的裸代码块：

````markdown
```text
请将我上传的每一张照片分别制作成一张独立的高级设计海报，不多图拼接，每张照片单独输出。整体采用3:4竖版构图，上下两个区域高度严格1:1，各占画面50%。
……（中间内容不变）……
整体参考旧时尚绘本、旅行插画、艺术出版物和高级编辑设计，呈现温柔、复古、松弛、时髦、幽默、略带笨拙与古怪自信的气质，避免卡通感、廉价感、电商感和模板
```
````

改为（代码块内容逐字不动，只在外面加 MDC 组件包裹）：

````markdown
::prompt-builder
```text
请将我上传的每一张照片分别制作成一张独立的高级设计海报，不多图拼接，每张照片单独输出。整体采用3:4竖版构图，上下两个区域高度严格1:1，各占画面50%。
……（中间内容不变）……
整体参考旧时尚绘本、旅行插画、艺术出版物和高级编辑设计，呈现温柔、复古、松弛、时髦、幽默、略带笨拙与古怪自信的气质，避免卡通感、廉价感、电商感和模板
```
::
````

- [ ] **Step 2: 浏览器验证页面渲染**

访问 http://localhost:3000/prompts/xxd-panel-001 （dev server 未跑则先 `nvm use 22.22.2 && pnpm dev`），逐项确认：

1. 文章正常渲染，无 SSR 报错（dev 终端无错误输出）；
2. 原始提示词代码块样式与改动前一致（仍走 ProseCode 高亮）；
3. 卡片在代码块外围出现：标题「运行适配器拼装」、说明行、比例药丸（默认 3:4 选中）、输出模式（默认上下分栏）、文字模式（默认模型生成、语言简体中文）、预览、两个复制按钮；
4. 预览内容 = 使用指南「公共交付前言」+ TOP_BOTTOM 块 + 模型生成块，逐字对照 `www/content/1.usage.md`，`最终画布：3:4`、`TEXT LANGUAGE: 简体中文`。

- [ ] **Step 3: Commit**

```bash
git add www/content/2.prompts/1.xxd-panel-001.md
git commit -m "feat: use PromptBuilder in XXD Panel 001 article"
```

---

## Task 3: 交互矩阵全面验证

**Files:** 无新增修改（验证任务；发现问题则修复后重跑本任务）

- [ ] **Step 1: 选项交互验证（浏览器，http://localhost:3000/prompts/xxd-panel-001）**

逐项操作并检查预览实时变化：

1. 比例切 `16:9` → 预览 `最终画布：16:9`；
2. 比例切「自定义」→ 输入框出现；输入 `1920x1080` → 预览 `最终画布：1920x1080`；清空输入 → 预览显示 `最终画布：<比例>`；
3. 输出模式切「壁纸包」→ 设备/壁纸关系子面板出现；选设备「平板」、关系「联动」→ 预览出现 `设备：IPAD`、`壁纸关系：LINKED`；
4. 输出模式切「左右分栏」→ 子面板消失，预览为 LEFT_RIGHT 块，且 `设备：` 行不再出现（切回壁纸包时「平板/联动」选择保留）；
5. 输出模式切「纯设计稿」→ 预览为 DESIGN_ONLY 块；
6. 文字模式切「自定义文案」→ 语言下拉保留、文字输入框出现；输入 `秋日市集` → 预览 `TEXT: 「秋日市集」`；清空 → 预览 `TEXT: 「<用户准确文字>」`；
7. 文字模式切「不要文字」→ 语言下拉与文字输入框消失，预览为 `TEXT MODE: NONE` 块；
8. 文字模式切「模型生成」、语言切 `English` → 预览 `TEXT LANGUAGE: English`；
9. 其他要求输入 `不要出现任何水印` → 预览末尾追加该行；清空 → 追加行消失。

- [ ] **Step 2: 复制功能验证**

1. 点「复制追加部分」→ toast「已复制到剪贴板」，粘贴内容 = 预览全文；
2. 点「复制完整请求」→ 粘贴内容以 `请将我上传的每一张照片` 开头，后接空行和 `【本次模式交付覆盖｜当前成品】`，结尾与追加部分一致（验证 slot textContent 读取正确）。

- [ ] **Step 3: 全站回归**

访问 http://localhost:3000 与 http://localhost:300/usage，确认正常返回、无 SSR 报错（dev 终端无错误）。

- [ ] **Step 4: 最终 lint**

```bash
pnpm lint
```

Expected: 通过。若有修复，把修复一起 commit：

```bash
git add -A components/content/PromptBuilder.vue www/content/2.prompts/1.xxd-panel-001.md
git commit -m "fix: PromptBuilder verification fixes"
```

（无修复则跳过 commit。）
