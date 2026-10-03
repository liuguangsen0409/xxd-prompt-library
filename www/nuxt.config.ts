import process from 'node:process';
import { fileURLToPath } from 'node:url';
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  extends: ['..'],
  modules: ['nuxt-auth-utils'],
  auth: {
    loadStrategy: 'client-only',
  },
  alias: {
    '@': fileURLToPath(new URL('..', import.meta.url)),
  },
  runtimeConfig: {
    wechat: {
      appId: '',
      token: '',
      encodingAesKey: '',
      origin: 'https://xxd-prompt.unclejiwa.com',
    },
    session: {
      password: '',
      maxAge: 60 * 60 * 24 * 30,
      cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' },
    },
  },
  nitro: {
    prerender: {
      routes: ['/embed/styles'],
    },
  },
  routeRules: {
    // Pagination and full-list requests must not share a static response.
    '/api/styles': { prerender: false },
    '/api/wechat': { prerender: false, headers: { 'cache-control': 'no-store' } },
    '/api/login/**': { prerender: false, headers: { 'cache-control': 'no-store' } },
    '/api/_auth/**': { prerender: false, headers: { 'cache-control': 'no-store' } },
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
