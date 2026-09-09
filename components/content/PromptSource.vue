<template>
  <div class="not-prose my-6 space-y-3 rounded-lg border border-muted bg-muted/30 p-4 text-sm text-muted-foreground md:p-6">
    <p class="flex items-center gap-2 text-base font-semibold text-foreground">
      <SmartIcon name="lucide:heart-handshake" :size="18" class="shrink-0 text-primary" />
      来源与致谢
    </p>
    <p>
      原仓库：<a
        :href="url"
        target="_blank"
        rel="noopener noreferrer"
        class="font-medium text-primary underline underline-offset-4 hover:opacity-80"
      >{{ name ?? url }}</a>
    </p>
    <p v-if="author">
      感谢原作者 <span class="font-medium text-foreground">{{ author }}</span> 的开源分享。
    </p>
    <p v-if="license">
      版权声明：原文以
      <a
        :href="licenseUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="font-medium text-primary underline underline-offset-4 hover:opacity-80"
      >{{ license }}</a>
      授权发布，仅供学习研究等非商业用途；如需商业使用，请向原作者取得书面许可。
    </p>
    <slot />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  url: string;
  name?: string;
  author?: string;
  license?: string;
  licenseUrl?: string;
}>();
</script>
