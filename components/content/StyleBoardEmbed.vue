<template>
  <section id="styles" class="not-prose scroll-mt-24" aria-label="提示词风格看板">
    <iframe
      ref="frame"
      src="/embed/styles"
      title="浏览提示词风格"
      loading="lazy"
      scrolling="no"
      class="block w-full border-0"
      :style="{ height: `${height}px` }"
      @load="syncTheme"
    />
  </section>
</template>

<script setup lang="ts">
const frame = ref<HTMLIFrameElement>();
const height = ref(1100);
const colorMode = useColorMode();

function syncTheme() {
  frame.value?.contentWindow?.postMessage({ type: 'styles:theme', value: colorMode.value }, window.location.origin);
}

function onMessage(event: MessageEvent) {
  if (event.origin !== window.location.origin || event.source !== frame.value?.contentWindow)
    return;
  if (event.data?.type === 'styles:height' && Number.isFinite(event.data.height))
    height.value = Math.max(240, Math.min(50000, Math.ceil(event.data.height)));
  if (event.data?.type === 'styles:ready')
    syncTheme();
}

watch(() => colorMode.value, syncTheme);
onMounted(() => window.addEventListener('message', onMessage));
onBeforeUnmount(() => window.removeEventListener('message', onMessage));
</script>
