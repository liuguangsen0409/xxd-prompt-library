<template>
  <main ref="board" class="bg-background text-foreground px-1 pb-4" aria-label="风格看板">
    <header class="flex flex-wrap items-center justify-between gap-4 pb-5 pt-2">
      <div class="flex items-center gap-3">
        <h2 class="text-base font-semibold tracking-tight">
          全部风格
        </h2>
        <span class="text-muted-foreground rounded-full bg-muted px-2.5 py-0.5 text-xs tabular-nums" aria-live="polite">{{ totalStyles }}</span>
      </div>
      <div class="flex w-full items-center gap-2 sm:w-auto">
        <div class="relative min-w-0 flex-1 sm:w-60">
          <Icon name="lucide:search" class="text-muted-foreground pointer-events-none absolute left-2.5 top-2 size-4" />
          <input v-model="search" type="search" aria-label="搜索风格" placeholder="搜索风格、关键词或编号" class="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring h-8 w-full rounded-md border pl-8 pr-2 text-sm outline-none focus-visible:ring-2">
        </div>
        <button type="button" class="border-input hover:bg-muted focus-visible:ring-ring flex h-8 shrink-0 items-center gap-2 rounded-md border px-3 text-sm outline-none focus-visible:ring-2" @click="shuffle">
          <Icon name="lucide:shuffle" class="size-4" />换个顺序
        </button>
      </div>
    </header>

    <div v-if="error" class="bg-muted flex min-h-64 flex-col items-center justify-center gap-4 rounded-lg">
      <p class="text-muted-foreground text-sm">
        风格暂时没有加载出来。
      </p>
      <UiButton variant="outline" @click="refreshStyles">
        重新加载
      </UiButton>
    </div>
    <div v-else-if="!filtered.length" class="bg-muted flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg text-center">
      <Icon name="lucide:search-x" class="text-muted-foreground size-7" />
      <p class="font-medium">
        没有找到这个风格
      </p>
      <p class="text-muted-foreground text-sm">
        试试「水彩」「复古」，或者提示词编号。
      </p>
      <UiButton variant="outline" @click="search = ''">
        查看全部风格
      </UiButton>
    </div>
    <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <a
        v-for="(style, index) in visible"
        :key="style.path"
        :href="style.path"
        target="_top"
        class="group focus-visible:ring-ring relative block overflow-hidden rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        :aria-label="`${style.title}：${style.description} 查看提示词`"
      >
        <div class="bg-muted grid aspect-[2/1] grid-cols-3 overflow-hidden">
          <div v-for="(image, imageIndex) in style.images" :key="image.src" class="relative h-full min-w-0 overflow-hidden">
            <picture>
              <source
                :srcset="`${proxyImageUrl(image.src, 480, 'webp')} 480w, ${proxyImageUrl(image.src, 720, 'webp')} 720w, ${proxyImageUrl(image.src, 960, 'webp')} 960w`"
                type="image/webp"
                sizes="(max-width: 640px) 33vw, 25vw"
              >
              <img
                :src="proxyImageUrl(image.src, 640, 'jpeg')"
                :srcset="`${proxyImageUrl(image.src, 480, 'jpeg')} 480w, ${proxyImageUrl(image.src, 720, 'jpeg')} 720w, ${proxyImageUrl(image.src, 960, 'jpeg')} 960w`"
                sizes="(max-width: 640px) 33vw, 25vw"
                :alt="`${style.title}，参考样图 ${imageIndex + 1}`"
                loading="lazy"
                decoding="async"
                :fetchpriority="index === 0 && imageIndex === 0 ? 'high' : 'auto'"
                :width="index === 0 && imageIndex === 0 ? 800 : 480"
                :height="index === 0 && imageIndex === 0 ? 450 : 270"
                class="h-full w-full object-cover transition-transform duration-500 motion-reduce:transition-none"
                :style="{ objectPosition: image.position ?? 'center' }"
                @error="imageError($event, style.fallbackImage)"
                @load="checkImage($event, style.fallbackImage)"
              >
            </picture>
          </div>
        </div>
        <div class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-4 pb-4 pt-14 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 max-sm:opacity-100 motion-reduce:transition-none [@media(hover:none)]:opacity-100">
          <div class="mb-1.5 flex items-center justify-between gap-2">
            <h3 class="text-base font-semibold tracking-wide">{{ style.title }}</h3>
            <Icon name="lucide:arrow-up-right" class="size-4 shrink-0" />
          </div>
          <p class="line-clamp-1 text-xs leading-relaxed text-white/85">{{ style.description }}</p>
        </div>
      </a>
    </div>

    <footer v-if="visible.length && !error" class="flex flex-col items-center gap-3 pb-3 pt-8">
      <button
        v-if="canLoadMore"
        type="button"
        class="border-input hover:bg-muted focus-visible:ring-ring flex items-center gap-2 rounded-full border px-7 py-2.5 text-sm outline-none focus-visible:ring-2"
        @click="loadMore"
      >
        加载更多风格<Icon name="lucide:arrow-down" class="size-4" />
      </button>
      <p class="text-muted-foreground text-xs tabular-nums" aria-live="polite">
        已展示 {{ visible.length }} / {{ totalStyles }} 个风格
      </p>
    </footer>
  </main>
</template>

<script setup lang="ts">
import type { StylePreview, StylePreviewPage } from '../../../types/style-board';

const PAGE_SIZE = 12;

definePageMeta({ documentDriven: false });
defineI18nRoute(false);
useSeoMeta({ title: '提示词风格看板', robots: 'noindex, nofollow' });

const board = ref<HTMLElement>();
const search = ref('');
const isSearchMode = computed(() => search.value.trim().length > 0);
const page = ref(1);
const styles = ref<StylePreview[]>([]);
const allStyles = ref<StylePreview[] | null>(null);
const shuffled = ref(false);

const query = computed(() => {
  if (isSearchMode.value) {
    return {
      all: '1',
      page: '1',
    };
  }
  return {
    page: String(page.value),
    limit: String(PAGE_SIZE),
  };
});

const { data: pageData, error, refresh } = await useFetch<StylePreviewPage>('/api/styles', {
  query,
  default: () => ({ items: [], page: 1, limit: PAGE_SIZE, total: 0, hasMore: false }),
});

const order = ref<string[]>([]);

const filtered = computed(() => {
  const pool: StylePreview[] = shuffled.value && allStyles.value ? allStyles.value : styles.value;
  const queryText = search.value.trim().toLowerCase();
  const results = pool.filter(style => `${style.title} ${style.description} ${style.path}`.toLowerCase().includes(queryText));
  if (!order.value.length)
    return results;
  const ranks = new Map(order.value.map((path, index) => [path, index]));
  return [...results].sort((a, b) => (ranks.get(a.path) ?? 0) - (ranks.get(b.path) ?? 0));
});

const visible = computed(() => {
  if (shuffled.value && !isSearchMode.value)
    return filtered.value.slice(0, page.value * PAGE_SIZE);
  return filtered.value;
});

const canLoadMore = computed(() => {
  if (isSearchMode.value || error.value)
    return false;
  if (shuffled.value)
    return filtered.value.length > visible.value.length;
  return pageData.value?.hasMore ?? false;
});

const totalStyles = computed(() => {
  if (isSearchMode.value)
    return filtered.value.length;
  return pageData.value?.total ?? filtered.value.length;
});

watch([pageData, isSearchMode], ([payload]) => {
  if (!payload || shuffled.value)
    return;
  if (isSearchMode.value || page.value === 1)
    styles.value = payload.items;
  else
    styles.value = [...styles.value, ...payload.items];
}, { immediate: true });

watch(search, () => {
  page.value = 1;
  if (shuffled.value)
    return;
  order.value = [];
  if (isSearchMode.value)
    styles.value = [];
});

function refreshStyles() {
  refresh();
}

function loadMore() {
  if (!canLoadMore.value)
    return;
  page.value += 1;
}

async function shuffle() {
  let all: StylePreview[] | null = allStyles.value;
  if (!all) {
    all = (await $fetch<StylePreviewPage>('/api/styles', { params: { all: '1' } })).items;
    allStyles.value = all;
  }
  const paths = all.map(style => style.path);
  for (let i = paths.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [paths[i], paths[j]] = [paths[j]!, paths[i]!];
  }
  order.value = paths;
  shuffled.value = true;
  page.value = 1;
}

function imageError(event: Event, fallback?: string) {
  const image = event.target as HTMLImageElement;
  const fallbackUrl = fallback ? proxyImageUrl(fallback, 640, 'jpeg') : undefined;
  if (fallbackUrl && image.src !== fallbackUrl) {
    image.src = fallbackUrl;
    return;
  }
  image.classList.add('object-contain', 'p-3', 'text-xs');
}

function checkImage(event: Event, fallback?: string) {
  const image = event.target as HTMLImageElement;
  if (image.naturalWidth === 180 && image.naturalHeight === 180)
    imageError(event, fallback);
}

function proxyImageUrl(src: string, width = 640, format: 'webp' | 'jpeg' = 'webp') {
  if (!src || src.startsWith('/'))
    return src;
  return `/api/image-proxy?src=${encodeURIComponent(src)}&w=${Math.max(180, Math.min(960, width))}&q=70&format=${format}`;
}

function onMessage(event: MessageEvent) {
  if (event.origin !== window.location.origin || event.source !== window.parent)
    return;
  if (event.data?.type === 'styles:theme' && ['light', 'dark'].includes(event.data.value)) {
    document.documentElement.classList.toggle('dark', event.data.value === 'dark');
    document.documentElement.classList.toggle('light', event.data.value === 'light');
  }
}

let observer: ResizeObserver | undefined;
onMounted(() => {
  if (window.self === window.top) {
    window.location.replace('/#styles');
    return;
  }
  window.addEventListener('message', onMessage);
  window.parent.postMessage({ type: 'styles:ready' }, window.location.origin);
  observer = new ResizeObserver(() => {
    if (board.value)
      window.parent.postMessage({ type: 'styles:height', height: Math.ceil(board.value.getBoundingClientRect().height) + 1 }, window.location.origin);
  });
  if (board.value)
    observer.observe(board.value);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  window.removeEventListener('message', onMessage);
});
</script>
