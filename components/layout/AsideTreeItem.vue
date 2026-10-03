<template>
  <li>
    <!-- Folder -->
    <div v-if="link.children">
      <template v-if="link.styleCategoryGroup">
        <div class="flex items-center gap-1 rounded-md" :class="containsActivePage && 'bg-muted/60'">
          <NuxtLinkLocale
            :to="link.redirect"
            class="text-foreground/80 hover:bg-muted hover:text-primary flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-sm font-medium"
            :class="containsActivePage && 'text-primary'"
            @click="isOpen = true"
          >
            <span class="min-w-0 flex-1 leading-5">{{ link.title }}</span>
            <span class="text-muted-foreground shrink-0 text-xs tabular-nums">{{ link.children.length }}</span>
          </NuxtLinkLocale>
          <button
            type="button"
            class="text-muted-foreground hover:bg-muted hover:text-foreground flex size-8 shrink-0 items-center justify-center rounded-md"
            :aria-label="`${isOpen ? '收起' : '展开'}${link.title}`"
            :aria-expanded="isOpen"
            :aria-controls="childrenId"
            @click="isOpen = !isOpen"
          >
            <SmartIcon name="lucide:chevron-down" class="transition-transform" :class="!isOpen && '-rotate-90'" :size="14" />
          </button>
        </div>
        <div v-show="isOpen" :id="childrenId">
          <LayoutAsideTree :links="link.children" :level="level + 1" />
        </div>
      </template>
      <template v-else-if="folderStyle === 'group'">
        <div
          class="text-foreground/70 mt-2 flex items-center gap-2 rounded-md px-2 text-xs font-semibold outline-none"
          :class="[link.navTruncate !== false && 'h-8']"
        >
          <LayoutAsideTreeItemButton :link />
        </div>
        <LayoutAsideTree :links="link.children" :level="level" />
      </template>
      <template v-else>
        <button
          class="text-foreground/80 hover:bg-muted hover:text-primary flex w-full cursor-pointer items-center gap-2 rounded-md p-2 text-left text-sm"
          :class="[link.navTruncate !== false && 'h-8']"
          @click="isOpen = !isOpen"
        >
          <SmartIcon
            v-if="folderStyle === 'tree'"
            name="lucide:chevron-down"
            class="transition-transform"
            :class="[!isOpen && '-rotate-90']"
          />
          <LayoutAsideTreeItemButton :link />
          <SmartIcon
            v-if="folderStyle === 'default'"
            name="lucide:chevron-down"
            class="ml-auto transition-transform"
            :class="[!isOpen && '-rotate-90']"
          />
        </button>
        <div v-show="isOpen">
          <LayoutAsideTree :links="link.children" :level="level + 1" />
        </div>
      </template>
    </div>
    <!-- Page -->
    <NuxtLinkLocale
      v-else
      :to="link._path"
      :title="link.title"
      class="text-foreground/80 hover:bg-muted hover:text-primary flex items-center gap-2 rounded-md p-2 text-sm"
      :class="[
        isActive && 'bg-muted !text-primary font-medium',
        link.navTruncate !== false && 'h-8',
      ]"
    >
      <LayoutAsideTreeItemButton :link />
    </NuxtLinkLocale>
  </li>
</template>

<script setup lang="ts">
import type { NavItem } from '@ztl-uwu/nuxt-content';

const { link, level } = defineProps<{
  link: NavItem;
  level: number;
}>();

const { collapse, collapseLevel, folderStyle: defaultFolderStyle } = useConfig().value.aside;

const collapsed = useCollapsedMap();
const route = useRoute();
const childrenId = useId();

const containsActivePage = computed(() => link.children?.some(child => normalizePath(child._path) === normalizePath(route.path)) ?? false);

function defaultOpen() {
  if (containsActivePage.value)
    return true;
  if (route.path.includes(link._path))
    return true;
  if (link.collapse !== undefined)
    return !link.collapse;

  return level < collapseLevel && !collapse;
}

const isOpen = ref(containsActivePage.value || (collapsed.value.get(link._path) ?? defaultOpen()));

watch(() => route.path, () => {
  if (containsActivePage.value)
    isOpen.value = true;
});

watch(isOpen, (v) => {
  collapsed.value.set(link._path, v);
});

function normalizePath(p: string) {
  const out = p.replace(/\/+$/, '');
  return out === '' ? '/' : out;
}
const isActive = computed(() => normalizePath(link._path) === normalizePath(route.path));

const folderStyle = computed(() => link.sidebar?.style ?? defaultFolderStyle);
</script>
