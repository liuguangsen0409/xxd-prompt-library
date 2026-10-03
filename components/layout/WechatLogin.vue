<template>
  <ClientOnly>
    <UiDropdownMenu v-if="loggedIn">
      <UiDropdownMenuTrigger as-child>
        <UiButton variant="ghost" class="gap-2" aria-label="已登录，打开账号菜单">
          <Icon name="lucide:circle-user-round" class="size-4" />
          <span class="hidden sm:inline">已登录</span>
        </UiButton>
      </UiDropdownMenuTrigger>
      <UiDropdownMenuContent align="end">
        <UiDropdownMenuLabel>欢迎回来</UiDropdownMenuLabel>
        <UiDropdownMenuSeparator />
        <UiDropdownMenuItem :disabled="busy" @select.prevent="logout">
          {{ busy ? '正在退出…' : '退出登录' }}
        </UiDropdownMenuItem>
      </UiDropdownMenuContent>
    </UiDropdownMenu>
    <UiDialog v-else v-model:open="open">
      <UiDialogTrigger as-child>
        <UiButton variant="outline" size="sm" class="my-auto ml-2">
          登录
        </UiButton>
      </UiDialogTrigger>
      <UiDialogContent class="max-h-[90dvh] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-xl">
        <UiDialogHeader>
          <UiDialogTitle>用公众号验证码登录</UiDialogTitle>
          <UiDialogDescription>关注「中登前端自救之旅」，发送「登录」获取验证码。</UiDialogDescription>
        </UiDialogHeader>
        <div class="flex flex-col items-center gap-2">
          <img src="/images/wechat-qr.png" alt="中登前端自救之旅微信公众号二维码" width="200" height="200" class="size-44 rounded-lg sm:size-48">
          <p class="text-muted-foreground text-center text-xs">
            微信扫码；手机上可保存二维码后在微信中识别。
          </p>
          <a href="/images/wechat-qr.png" download="中登前端自救之旅.png" class="text-primary text-xs underline underline-offset-4">保存公众号二维码</a>
        </div>
        <form class="grid gap-3" @submit.prevent="login">
          <label for="wechat-login-code" class="text-sm font-medium">公众号验证码</label>
          <input
            id="wechat-login-code"
            v-model="code"
            name="code"
            inputmode="numeric"
            autocomplete="one-time-code"
            pattern="[0-9]{6}"
            maxlength="6"
            placeholder="输入 6 位数字验证码"
            :disabled="busy"
            :aria-invalid="!!error"
            aria-describedby="wechat-login-message"
            class="border-input bg-background ring-offset-background focus-visible:ring-ring h-11 w-full rounded-md border px-3 text-center text-base tracking-widest focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50"
          >
          <p id="wechat-login-message" class="text-muted-foreground min-h-5 text-sm" :class="{ 'text-destructive': error }" aria-live="polite">
            {{ error || (available === false ? '登录功能正在准备中，你可以继续浏览和复制提示词。' : '验证码自生成起 5 分钟有效，请勿转发给他人。') }}
          </p>
          <UiButton type="submit" class="w-full" :disabled="busy || available !== true || !/^\d{6}$/.test(code)">
            {{ busy ? '正在登录…' : '登录' }}
          </UiButton>
          <UiButton type="button" variant="ghost" @click="open = false">
            暂不登录，继续浏览
          </UiButton>
        </form>
      </UiDialogContent>
    </UiDialog>
    <span v-if="logoutError" role="alert" class="text-destructive self-center text-xs">退出失败，请重试</span>
    <template #fallback>
      <UiButton variant="outline" size="sm" disabled class="my-auto ml-2">
        登录
      </UiButton>
    </template>
  </ClientOnly>
</template>

<script setup lang="ts">
const { loggedIn, fetch: refreshSession, clear } = useUserSession();
const open = useState('wechat-login-open', () => false);
const code = ref('');
const busy = ref(false);
const error = ref('');
const logoutError = ref(false);
const available = ref<boolean | null>(null);

watch(open, async (isOpen) => {
  if (!isOpen)
    return;
  code.value = '';
  error.value = '';
  available.value = null;
  try {
    const status = await $fetch<{ available: boolean }>('/api/login/status');
    available.value = status.available;
  } catch {
    available.value = false;
    error.value = '暂时无法连接登录服务，请稍后再试。';
  }
});

async function login() {
  if (busy.value || available.value !== true)
    return;
  error.value = '';
  busy.value = true;
  try {
    await $fetch('/api/login/verify', { method: 'POST', body: { code: code.value }, retry: 0 });
    await refreshSession();
    if (!loggedIn.value)
      throw new Error('Session unavailable');
    open.value = false;
    code.value = '';
  } catch (cause: unknown) {
    const failure = cause as { data?: { data?: { message?: string } } };
    error.value = failure.data?.data?.message || '登录暂时不可用，请稍后重新获取验证码再试。';
  } finally {
    busy.value = false;
  }
}

async function logout() {
  busy.value = true;
  logoutError.value = false;
  try {
    await clear();
  } catch {
    logoutError.value = true;
  } finally {
    busy.value = false;
  }
}
</script>
