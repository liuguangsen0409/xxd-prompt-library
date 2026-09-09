<template>
  <div class="not-prose grid grid-cols-2 gap-3 [&:not(:first-child)]:mt-6">
    <ProseImg
      v-for="(img, i) in images"
      :key="i"
      :src="img"
      :alt="alt ? `${alt} ${i + 1}` : `样张 ${i + 1}`"
    />
  </div>
</template>

<script setup lang="ts">
import ProseImg from './ProseImg.vue';

defineProps<{
  images: string[];
  alt?: string;
}>();
</script>
