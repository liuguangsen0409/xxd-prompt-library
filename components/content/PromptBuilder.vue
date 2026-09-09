<template>
  <div class="not-prose my-6 space-y-6 text-sm">
    <div class="space-y-1">
      <p class="flex items-center gap-2 text-lg font-semibold text-foreground">
        <SmartIcon name="lucide:sliders-horizontal" :size="18" class="shrink-0 text-primary" />
        运行适配器拼装
      </p>
      <p class="text-muted-foreground">
        调整参数后，自动生成完整提示词，复制即可使用。
      </p>
    </div>

    <section class="space-y-2">
      <p class="text-base font-semibold text-foreground">
        原始提示词
      </p>
      <div ref="originalRef" class="[&_pre]:whitespace-pre-wrap">
        <slot />
      </div>
    </section>

    <section class="space-y-4 border-t border-dashed border-muted pt-6">
      <p class="text-base font-semibold text-foreground">
        自定义设置
      </p>

      <div class="space-y-2">
        <p class="text-sm text-muted-foreground">
          画布尺寸
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="opt in RATIO_OPTIONS"
            :key="opt.value"
            type="button"
            class="relative w-20 rounded-lg border p-2.5 text-left transition-colors"
            :class="isCustomRatio ? opt.value === '自定义' ? 'border-primary bg-primary/5' : 'border-muted bg-transparent hover:border-primary/50' : selectedRatio === opt.value ? 'border-primary bg-primary/5' : 'border-muted bg-transparent hover:border-primary/50'"
            @click="isCustomRatio = opt.value === '自定义'; if (opt.value !== '自定义') selectedRatio = opt.value"
          >
            <span
              class="block text-sm font-medium"
              :class="isCustomRatio ? opt.value === '自定义' ? 'text-primary' : 'text-foreground' : selectedRatio === opt.value ? 'text-primary' : 'text-foreground'"
            >{{ opt.value }}</span>
            <span class="block text-sm text-muted-foreground">{{ opt.label }}</span>
            <span
              v-if="isCustomRatio ? opt.value === '自定义' : selectedRatio === opt.value"
              class="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <Icon name="lucide:check" class="size-3" />
            </span>
          </button>
        </div>
        <input
          v-if="isCustomRatio"
          v-model="customCanvas"
          placeholder="如 16:10 或 1920x1080"
          class="w-full rounded-md border border-muted bg-transparent px-3 py-2 text-sm outline-none focus:border-primary"
        >
      </div>

      <div class="space-y-2">
        <p class="text-sm text-muted-foreground">
          输出模式
        </p>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            v-for="m in OUTPUT_MODES"
            :key="m.value"
            type="button"
            class="relative rounded-lg border p-3 text-left transition-colors"
            :class="outputMode === m.value ? 'border-primary bg-primary/5' : 'border-muted bg-transparent hover:border-primary/50'"
            @click="outputMode = m.value"
          >
            <span class="flex items-center gap-2">
              <Icon
                :name="m.icon"
                class="size-4"
                :class="outputMode === m.value ? 'text-primary' : 'text-muted-foreground'"
              />
              <span
                class="text-sm font-medium"
                :class="outputMode === m.value ? 'text-primary' : 'text-foreground'"
              >{{ m.label }}</span>
            </span>
            <span class="mt-1 block text-sm text-muted-foreground">{{ m.desc }}</span>
            <span
              v-if="outputMode === m.value"
              class="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <Icon name="lucide:check" class="size-3" />
            </span>
          </button>
        </div>
        <div v-if="outputMode === 'WALLPAPER_PACK'" class="space-y-3 rounded-md border border-muted p-3">
          <div class="space-y-2">
            <p class="text-sm text-muted-foreground">
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
            <p class="text-sm text-muted-foreground">
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
      </div>

      <div class="space-y-2">
        <p class="text-sm text-muted-foreground">
          文字模式
        </p>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            v-for="m in TEXT_MODES"
            :key="m.value"
            type="button"
            class="relative rounded-lg border p-3 text-left transition-colors"
            :class="textMode === m.value ? 'border-primary bg-primary/5' : 'border-muted bg-transparent hover:border-primary/50'"
            @click="textMode = m.value"
          >
            <span class="flex items-center gap-2">
              <Icon
                :name="m.icon"
                class="size-4"
                :class="textMode === m.value ? 'text-primary' : 'text-muted-foreground'"
              />
              <span
                class="text-sm font-medium"
                :class="textMode === m.value ? 'text-primary' : 'text-foreground'"
              >{{ m.label }}</span>
            </span>
            <span class="mt-1 block text-sm text-muted-foreground">{{ m.desc }}</span>
            <span
              v-if="textMode === m.value"
              class="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <Icon name="lucide:check" class="size-3" />
            </span>
          </button>
        </div>
        <input
          v-if="textMode === 'USER_EXACT'"
          v-model="userText"
          placeholder="画面文案（逐字使用）"
          class="w-full rounded-md border border-muted bg-transparent px-3 py-2 text-sm outline-none focus:border-primary"
        >
      </div>

      <div class="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div v-if="textMode !== 'NONE'" class="space-y-2 md:col-span-1">
          <p class="text-sm text-muted-foreground">
            语言
          </p>
          <select
            v-model="language"
            class="w-full rounded-md border border-muted bg-transparent px-2 py-1 text-sm outline-none focus:border-primary"
          >
            <option v-for="lang in LANGUAGES" :key="lang" :value="lang">
              {{ lang }}
            </option>
          </select>
        </div>
        <div
          class="space-y-2"
          :class="textMode === 'NONE' ? 'md:col-span-4' : 'md:col-span-3'"
        >
          <p class="text-sm text-muted-foreground">
            其他要求（可选）
          </p>
          <textarea
            v-model="extraRequirements"
            rows="3"
            maxlength="200"
            placeholder="逐字追加在全部内容末尾；留空则不加"
            class="w-full resize-y rounded-md border border-muted bg-transparent px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <div class="text-right text-sm text-muted-foreground">
            {{ extraRequirements.length }} / 200
          </div>
        </div>
      </div>
    </section>

    <section class="space-y-2 border-t border-dashed border-muted pt-6">
      <p class="text-base font-semibold text-foreground">
        生成结果
      </p>
      <p class="text-sm text-muted-foreground">
        根据以上设置自动拼装的完整提示词
      </p>
      <UiCard class="bg-[#FBFBFB] dark:bg-[#121215] relative overflow-hidden [&:not(:first-child)]:mt-5 [&:not(:last-child)]:mb-5">
        <div class="absolute right-2 top-2 z-10">
          <CodeCopy :code="adapterText" />
        </div>
        <div class="max-h-96 overflow-y-auto py-3 text-sm">
          <pre class="language-text whitespace-pre-wrap"><code>{{ adapterText }}</code></pre>
        </div>
      </UiCard>
    </section>

    <div class="grid grid-cols-1 gap-3 border-t border-dashed border-muted pt-6 sm:grid-cols-2">
      <UiButton variant="outline" class="h-auto flex-col gap-0.5 py-3" @click="copyText(adapterText)">
        <span class="flex items-center justify-center gap-2 text-sm">
          <Icon name="lucide:copy" class="size-4" />
          复制追加部分
        </span>
        <span class="text-sm font-normal text-muted-foreground">仅复制追加的设置内容</span>
      </UiButton>
      <UiButton class="h-auto flex-col gap-0.5 py-3" @click="copyText(fullRequest)">
        <span class="flex items-center justify-center gap-2 text-sm">
          <Icon name="lucide:copy" class="size-4" />
          复制完整请求
        </span>
        <span class="text-sm font-normal opacity-80">复制完整拼装后的提示词（推荐）</span>
      </UiButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToast } from '@/components/ui/toast/use-toast';
import { cn } from '@/lib/utils';

type OutputMode = 'TOP_BOTTOM' | 'LEFT_RIGHT' | 'DESIGN_ONLY' | 'WALLPAPER_PACK';
type TextMode = 'ORIGINAL_PROMPT_GENERATED' | 'USER_EXACT' | 'NONE';

const RATIO_OPTIONS: { value: string; label: string }[] = [
  { value: '1:1', label: '正方形' },
  { value: '3:4', label: '竖版' },
  { value: '4:3', label: '横版' },
  { value: '4:5', label: '竖版' },
  { value: '5:4', label: '横版' },
  { value: '2:3', label: '竖版' },
  { value: '3:2', label: '横版' },
  { value: '9:16', label: '手机竖屏' },
  { value: '16:9', label: '宽屏' },
  { value: '21:9', label: '超宽屏' },
  { value: '5:7', label: '竖版' },
  { value: '7:5', label: '横版' },
  { value: '自定义', label: '自定义尺寸' },
];
const LANGUAGES = ['简体中文', '繁體中文', 'English', '日本語'];
const OUTPUT_MODES: { value: OutputMode; label: string; desc: string; icon: string }[] = [
  { value: 'TOP_BOTTOM', label: '上下分栏', desc: '上下结构展示', icon: 'lucide:panels-top-bottom' },
  { value: 'LEFT_RIGHT', label: '左右分栏', desc: '左右结构展示', icon: 'lucide:columns-2' },
  { value: 'DESIGN_ONLY', label: '纯设计稿', desc: '只输出设计稿', icon: 'lucide:square' },
  { value: 'WALLPAPER_PACK', label: '壁纸包', desc: '多图壁纸集合', icon: 'lucide:infinity' },
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
const TEXT_MODES: { value: TextMode; label: string; desc: string; icon: string }[] = [
  { value: 'ORIGINAL_PROMPT_GENERATED', label: '模型生成', desc: 'AI 智能生成文案', icon: 'lucide:zap' },
  { value: 'USER_EXACT', label: '自定义文案', desc: '自定义输入文案', icon: 'lucide:pencil' },
  { value: 'NONE', label: '不要文字', desc: '不添加任何文字', icon: 'lucide:ban' },
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
  const clone = originalRef.value?.cloneNode(true) as HTMLElement | undefined;
  clone?.querySelectorAll('style, script').forEach(n => n.remove());
  originalPrompt.value = (clone?.textContent ?? '')
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

由图像模型按照原始提示词已有的文字生成逻辑生成。所有可见文字都应从当前图片的内容、气质或隐喻中自然生长。任何以事实或资料形式呈现的信息，必须来自用户提供、图片清晰可见或已经核实的真实信息；没有事实依据时，使用诗意而非事实性的表达。运行层本身不是画面文案的来源。`;
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
