export default defineEventHandler((event) => {
  try {
    wechatSettings(event);
    return { available: true };
  } catch {
    return { available: false };
  }
});
