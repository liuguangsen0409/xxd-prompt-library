<template>
  <div
    ref="root"
    class="prompt-flow not-prose relative w-full"
    :class="{ 'is-paused': !running, 'is-still': reducedMotion || !ready }"
    :style="{ '--atlas': `url('${currentSource.url}')` }"
    role="region"
    aria-label="三张原图与四种提示词的风格演示，图片为 AI 生成，卡片展示风格摘要"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
  >
    <div class="flow-stage">
      <div class="connector one" aria-hidden="true">
        <i class="pulse" />
      </div>
      <div class="connector two" aria-hidden="true">
        <i class="pulse" />
      </div>
      <div class="flow-column input-column">
        <div class="source-ghost" aria-hidden="true" />
        <div ref="sourceCard" class="source-card">
          <div class="art original" role="img" :aria-label="`${currentSource.subject}原图（AI 演示素材）`" />
          <div class="source-caption">
            <span>{{ currentSource.name }}</span>
          </div>
        </div>
        <div class="source-picker flex items-center justify-center gap-2" role="group" aria-label="选择原图">
          <button
            v-for="(source, index) in sources"
            :key="source.url"
            type="button"
            class="thumbnail"
            :aria-label="`选择${source.subject}原图`"
            :aria-pressed="index === scene.source"
            :disabled="!ready"
            @click="selectSource(index)"
          >
            <span class="art original block" :style="{ '--atlas': `url('${source.url}')` }" />
          </button>
          <button
            v-if="!reducedMotion"
            type="button"
            class="pause-button text-muted-foreground hover:text-foreground inline-flex size-7 items-center justify-center rounded-md"
            :aria-label="paused ? '播放动效' : '暂停动效'"
            :aria-pressed="paused"
            :disabled="!ready"
            @click="togglePlayback"
          >
            <ClientOnly><Icon :name="paused ? 'lucide:play' : 'lucide:pause'" class="size-3" /></ClientOnly>
          </button>
        </div>
      </div>
      <div class="flow-column prompt-column">
        <div class="prompt-deck">
          <article
            v-for="(prompt, index) in prompts"
            :key="prompt.id"
            class="prompt-card"
            :class="{ active: index === scene.active }"
            :style="promptPosition(index)"
          >
            <div class="prompt-top flex items-center gap-2">
              <span class="prompt-icon inline-flex items-center justify-center"><ClientOnly><Icon :name="prompt.icon" class="size-3.5" /></ClientOnly></span>
              <span>{{ prompt.name }}</span>
              <span class="prompt-id ml-auto">#{{ prompt.id }}</span>
            </div>
            <p>{{ prompt.details }}<br>{{ prompt.description }}<span class="cursor" aria-hidden="true" /></p>
          </article>
        </div>
      </div>
      <div class="flow-column output-column">
        <div class="outputs">
          <NuxtLinkLocale
            v-for="(prompt, index) in prompts"
            :key="prompt.id"
            :to="`/prompts/xxd-panel-${prompt.id}`"
            :aria-label="`查看${prompt.name}提示词`"
            :inert="index >= scene.count"
            class="result"
            :class="{ shown: index < scene.count, latest: index === scene.count - 1 }"
          >
            <div class="art" :class="prompt.art" role="img" :aria-label="`${currentSource.subject}的${prompt.name}风格演示`" />
            <div class="result-caption flex items-center justify-between">
              {{ prompt.name }}<span>{{ prompt.id }} ↗</span>
            </div>
          </NuxtLinkLocale>
        </div>
      </div>
    </div>
    <p v-if="failed" class="text-muted-foreground mt-2 text-center text-xs" role="status">
      演示图片加载失败。<button type="button" class="underline underline-offset-4" @click="loadImages">
        重试
      </button>
    </p>
  </div>
</template>

<script setup lang="ts">
import type { CSSProperties } from 'vue';

const sources = [
  { name: '夏日，海与帆船', subject: '帆船', url: '/images/hero/boat.webp' },
  { name: '花开，自有形状', subject: '花朵', url: '/images/hero/flower.webp' },
  { name: '午后，白色小教堂', subject: '建筑', url: '/images/hero/chapel.webp' },
];
const prompts = [
  { id: '027', name: '纸上浮雕', icon: 'lucide:layers', art: 'relief', details: '乳白纸面 · 浅浮雕 · 克制留白', description: '让光影，重新勾勒记忆。' },
  { id: '039', name: '刺绣意象', icon: 'lucide:flower', art: 'silk', details: '真实针法 · 丝线光泽 · 东方留白', description: '把灵感，藏进一针一线。' },
  { id: '063', name: '像素隐喻志', icon: 'lucide:grid-2x2', art: 'pixel', details: '像素形体 · 色块构成 · 聪明隐喻', description: '用最少的方块，装下想象。' },
  { id: '018', name: '手工剪纸志', icon: 'lucide:scissors', art: 'cutpaper', details: '层叠纸艺 · 精密裁切 · 柔和投影', description: '让平面的记忆，长出层次。' },
];
const root = ref<HTMLElement>();
const sourceCard = ref<HTMLElement>();
const ready = ref(false);
const failed = ref(false);
const paused = ref(false);
const focused = ref(false);
const inView = ref(true);
const motionPreference = usePreferredReducedMotion();
const reducedMotion = computed(() => motionPreference.value === 'reduce');
const visibility = useDocumentVisibility();
const running = computed(() => ready.value && !paused.value && !focused.value && inView.value && visibility.value === 'visible' && !reducedMotion.value);
// Render a complete scene during SSR, while images load, and for reduced motion.
const scene = ref({ source: 0, active: 0, count: 4 });
const currentSource = computed(() => sources[scene.value.source]!);
const duration = 14000;
let elapsed = 0;
let lastTimestamp: number | undefined;
let disposed = false;

function renderScene() {
  const time = elapsed % duration;
  const source = Math.floor(elapsed / duration) % sources.length;
  const active = Math.min(3, Math.max(0, Math.floor((time - 1800) / 2400)));
  const count = Math.min(4, Math.max(0, Math.floor((time - 3000) / 2400) + 1));
  const animation = sourceCard.value?.getAnimations()[0];
  if (animation)
    animation.currentTime = time;
  if (scene.value.source !== source || scene.value.active !== active || scene.value.count !== count)
    scene.value = { source, active, count };
}

const { pause: stopFrames, resume: startFrames } = useRafFn(({ timestamp }) => {
  if (lastTimestamp !== undefined)
    elapsed += timestamp - lastTimestamp;
  lastTimestamp = timestamp;
  renderScene();
}, { immediate: false });

watch(running, (value) => {
  lastTimestamp = undefined;
  if (value)
    startFrames();
  else
    stopFrames();
});
watch(reducedMotion, (value) => {
  if (value) {
    elapsed = scene.value.source * duration + 11500;
    renderScene();
  }
});
useIntersectionObserver(root, ([entry]) => {
  inView.value = entry?.isIntersecting ?? false;
});

function promptPosition(index: number): CSSProperties {
  const distance = (index - scene.value.active + 4) % 4;
  return {
    transform: `translateY(${[93, -23, -139, 209][distance]}px)`,
    visibility: distance === 2 ? 'hidden' : 'visible',
    transitionDuration: distance === 2 ? '0s' : undefined,
  };
}

function selectSource(index: number) {
  // Manual selection shows the full comparison; automatic playback resumes
  // after focus leaves the controls, allowing keyboard users to inspect it.
  elapsed = index * duration + 11500;
  lastTimestamp = undefined;
  renderScene();
}

function onFocusOut(event: FocusEvent) {
  if (!root.value?.contains(event.relatedTarget as Node | null))
    focused.value = false;
}

function onFocusIn(event: FocusEvent) {
  focused.value = event.target instanceof HTMLElement && event.target.matches(':focus-visible');
}

function togglePlayback() {
  paused.value = !paused.value;
  if (!paused.value)
    focused.value = false;
}

async function loadImages() {
  failed.value = false;
  try {
    await Promise.all(sources.map(source => new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve();
      image.onerror = reject;
      image.src = source.url;
    })));
    if (disposed)
      return;
    elapsed = reducedMotion.value ? 11500 : 0;
    renderScene();
    ready.value = true;
  } catch {
    if (!disposed)
      failed.value = true;
  }
}

onMounted(loadImages);
onBeforeUnmount(() => {
  disposed = true;
  stopFrames();
});
</script>

<style scoped>
.prompt-flow {
  --flow-ink: hsl(var(--foreground));
  --flow-muted: hsl(var(--muted-foreground));
  --flow-line: hsl(var(--border));
  --flow-card: hsl(var(--card));
  --flow-soft: hsl(var(--muted));
  --flow-accent: hsl(var(--primary));
  --flow-shadow: 0 12px 35px hsl(var(--foreground) / 0.06);
  color: var(--flow-ink);
}
.flow-stage { position: relative; height: 435px; display: grid; grid-template-columns: 26% 30% 44%; isolation: isolate; }
.flow-stage::before { content: ''; position: absolute; inset: 0; background-image: radial-gradient(var(--flow-line) 0.65px, transparent 0.65px); background-size: 18px 18px; mask-image: linear-gradient(90deg, transparent, black 20%, black 80%, transparent); opacity: 0.55; z-index: -1; }
.flow-column { position: relative; min-width: 0; }
.source-card { position: absolute; left: 15%; top: 54px; width: 70%; max-width: 211px; transform: rotate(-7deg); background: var(--flow-card); padding: 7px 7px 0; border: 1px solid var(--flow-line); border-radius: 11px; box-shadow: var(--flow-shadow); animation: source-flight 14s cubic-bezier(0.22, 0.8, 0.22, 1) infinite paused; z-index: 2; }
.art { aspect-ratio: 4 / 3; background-image: var(--atlas); background-size: 300% 200%; background-repeat: no-repeat; border-radius: 6px; background-color: var(--flow-soft); }
.original { background-position: 0 0; }
.relief { background-position: 50% 0; }
.silk { background-position: 100% 0; }
.pixel { background-position: 0 100%; }
.cutpaper { background-position: 50% 100%; }
.source-caption { padding: 12px 3px; font-size: 11px; }
.source-ghost { position: absolute; left: 9%; top: 58px; width: 67%; height: 145px; background: var(--flow-soft); border: 1px solid var(--flow-line); border-radius: 11px; transform: rotate(-15deg); opacity: 0.8; }
.source-picker { position: absolute; top: 285px; left: 0; right: 0; }
.thumbnail { width: 43px; padding: 3px; background: var(--flow-card); border: 1px solid var(--flow-line); border-radius: 7px; opacity: 0.5; transition: opacity 0.25s, transform 0.25s, border-color 0.25s; cursor: pointer; }
.thumbnail[aria-pressed='true'] { opacity: 1; border-color: var(--flow-accent); transform: translateY(-3px); }
.thumbnail:hover { opacity: 1; }
.thumbnail .art { border-radius: 3px; }
button:focus-visible, a:focus-visible { outline: 2px solid var(--flow-accent); outline-offset: 4px; }
.connector { position: absolute; top: 138px; height: 1px; background: var(--flow-line); z-index: 0; }
.connector.one { left: 22%; width: 11%; }
.connector.two { left: 53%; width: 12%; }
.connector::after { content: ''; position: absolute; right: 0; top: -3px; width: 6px; height: 6px; border-top: 1px solid var(--flow-muted); border-right: 1px solid var(--flow-muted); transform: rotate(45deg); }
.pulse { position: absolute; top: -1px; height: 3px; width: 28px; background: linear-gradient(90deg, transparent, var(--flow-accent)); animation: travel 2.4s linear infinite; opacity: 0.65; }
.prompt-deck { position: absolute; top: 0; left: 6%; width: 88%; height: 282px; mask-image: linear-gradient(transparent, black 23%, black 76%, transparent); }
.prompt-card { position: absolute; inset: 0 0 auto; background: var(--flow-card); border: 1px solid var(--flow-line); border-radius: 10px; padding: 17px 17px 15px; height: 104px; transition: transform 0.8s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.8s, border-color 0.8s, box-shadow 0.8s; opacity: 0.35; }
.prompt-card.active { opacity: 1; border-color: hsl(var(--primary) / 0.4); box-shadow: 0 8px 25px hsl(var(--primary) / 0.06); }
.prompt-top { font-size: 12px; font-weight: 600; }
.prompt-icon { width: 24px; height: 24px; border-radius: 5px; background: var(--flow-soft); color: var(--flow-accent); flex-shrink: 0; }
.prompt-id { font-size: 9px; color: var(--flow-muted); }
.prompt-card p { font-size: 10px; line-height: 1.8; color: var(--flow-muted); margin: 9px 0 0; }
.cursor { display: inline-block; width: 4px; height: 10px; background: var(--flow-accent); vertical-align: middle; margin-left: 3px; animation: blink 1s steps(2) infinite; }
.outputs { position: absolute; inset: 0 0 0 25px; }
.result { position: absolute; width: 44%; background: var(--flow-card); padding: 6px 6px 0; border-radius: 10px; border: 1px solid var(--flow-line); box-shadow: var(--flow-shadow); opacity: 0; transform: translate(-45px, 10px) scale(0.8); transition: opacity 0s, transform 0.85s cubic-bezier(0.16, 1, 0.3, 1); z-index: 1; }
.result:nth-child(1) { left: 4%; top: 1px; --rotation: -4deg; }
.result:nth-child(2) { left: 53%; top: 28px; --rotation: 5deg; }
.result:nth-child(3) { left: 4%; top: 205px; --rotation: 3deg; }
.result:nth-child(4) { left: 53%; top: 225px; --rotation: -3deg; }
.result.shown { transition: opacity 0.65s, transform 0.85s cubic-bezier(0.16, 1, 0.3, 1); opacity: 1; transform: translate(0, 0) rotate(var(--rotation)) scale(1); }
.result.latest { z-index: 3; }
.result-caption { height: 32px; padding: 0 4px; font-size: 10px; }
.result-caption span { color: var(--flow-accent); font-size: 9px; }
.result:hover, .result:focus-visible { z-index: 5; transform: translateY(-7px) rotate(0) scale(1.06); }
.is-paused .pulse, .is-paused .cursor { animation-play-state: paused; }
.is-still .source-card { animation: none; }
.is-still .prompt-card, .is-still .result { transition: none; }
@keyframes source-flight {
  0% { opacity: 0; transform: translateX(-160px) rotate(-18deg) scale(0.85); }
  12%, 83% { opacity: 1; transform: translateX(0) rotate(-7deg) scale(1); }
  92%, 100% { opacity: 0; transform: translateX(65px) rotate(0) scale(0.9); }
}
@keyframes travel { from { left: 0; opacity: 0; } 30% { opacity: 0.9; } to { left: 85%; opacity: 0; } }
@keyframes blink { to { opacity: 0; } }
@media (max-width: 800px) {
  .flow-stage { grid-template-columns: 26% 32% 42%; height: 345px; }
  .prompt-card { padding: 12px 9px; }
  .prompt-id { display: none; }
  .prompt-card p { font-size: 9px; }
  .prompt-top { font-size: 10px; gap: 5px; }
  .outputs { left: 12px; }
  .result-caption { font-size: 9px; }
  .result-caption span { display: none; }
  .result:nth-child(3) { top: 167px; }
  .result:nth-child(4) { top: 182px; }
  .source-card { top: 68px; width: 82%; left: 4%; }
  .source-ghost { width: 77%; left: 1%; top: 64px; height: 110px; }
  .source-caption { font-size: 9px; padding: 9px 2px; }
  .source-picker { top: 235px; gap: 5px; }
  .thumbnail { width: 32px; }
}
@media (max-width: 540px) {
  .flow-stage { display: block; height: 635px; }
  .flow-column { position: absolute; }
  .input-column { left: 4%; top: 0; width: 38%; height: 285px; }
  .prompt-column { right: 1%; top: 0; width: 55%; height: 285px; }
  .output-column { left: 0; right: 0; top: 300px; height: 335px; }
  .source-ghost { height: 108px; }
  .prompt-top { font-size: 11px; }
  .prompt-card p { font-size: 9px; }
  .connector.one { left: 36%; top: 136px; width: 17%; }
  .connector.two { left: 72%; top: 263px; width: 1px; height: 28px; }
  .connector.two::after { transform: rotate(135deg); top: auto; bottom: 0; right: -3px; }
  .connector.two .pulse { display: none; }
  .outputs { inset: 0 8px; }
  .result { width: 43%; }
  .result:nth-child(1) { left: 3%; top: 0; }
  .result:nth-child(2) { left: 53%; top: 12px; }
  .result:nth-child(3) { left: 3%; top: 162px; }
  .result:nth-child(4) { left: 53%; top: 174px; }
  .source-picker { top: 227px; gap: 4px; }
  .thumbnail { width: 30px; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
  .source-card { opacity: 1; }
}
</style>
