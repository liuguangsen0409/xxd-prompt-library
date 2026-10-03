import { fileURLToPath } from 'node:url';
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  extends: ['..'],
  alias: {
    '@': fileURLToPath(new URL('..', import.meta.url)),
  },
  nitro: {
    prerender: {
      routes: ['/embed/styles'],
    },
  },
  routeRules: {
    // Pagination and full-list requests must not share a static response.
    '/api/styles': { prerender: false },
  },
  i18n: {
    defaultLocale: 'zhcn',
    locales: [
      {
        code: 'zhcn',
        name: '简体中文',
        language: 'zh-CN',
      },
    ],
  },
  content: {
    navigation: {
      fields: ['styleCategory'],
    },
    highlight: {
      langs: ['mdc', 'mermaid', 'tsx'],
    },
  },
  compatibilityDate: '2025-05-13',
});
