import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import sharp from 'sharp';
import { parse } from 'yaml';

export const RECIPE = 'webp-w480-q72-v1';

export async function runBatch(urls, upload, { limit = 10, intervalMs = 10000, wait = delay } = {}) {
  let completed = 0;
  for (const url of urls.slice(0, limit)) {
    if (completed)
      await wait(intervalMs);
    await upload(url);
    completed++;
  }
  return completed;
}

export function cooldownMs(retryAfter, now = Date.now()) {
  if (retryAfter && /^\d+$/.test(retryAfter))
    return Math.max(1000, Number(retryAfter) * 1000);
  const date = retryAfter ? Date.parse(retryAfter) : Number.NaN;
  return Number.isFinite(date) && date > now ? date - now : 60 * 60 * 1000;
}

export function collectImages(article) {
  const frontmatter = article.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const metadata = frontmatter ? parse(frontmatter[1]) : {};
  const grid = article.match(/^::sample-grid\s*\n---\r?\n([\s\S]*?)\r?\n---/m);
  const samples = grid ? parse(grid[1]).images ?? [] : [];
  if (!Array.isArray(samples) || samples.length < 4 || samples.some(src => typeof src !== 'string' || !src))
    throw new Error('Expected at least four original images in sample-grid');
  const images = metadata?.gallery?.images?.length
    ? metadata.gallery.images.slice(0, 3).map(image => image.src)
    : samples.slice(0, 3);
  return [...new Set([...images, samples[3]].filter(Boolean))];
}

export async function createThumbnail(input) {
  const metadata = await sharp(input).metadata();
  if (metadata.width === 180 && metadata.height === 180)
    throw new Error('Source is a 180×180 placeholder; restore the original before continuing');
  return sharp(input).rotate().resize({ width: 480, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
}

export async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT')
      return {};
    throw error;
  }
}

async function writeJson(path, data) {
  await writeFile(`${path}.tmp`, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  await rename(`${path}.tmp`, path);
}

// Serialize checkpoints while allowing a small number of network jobs in parallel.
let checkpoint = Promise.resolve();
function save(task) {
  const next = checkpoint.then(task);
  checkpoint = next.catch(() => {});
  return next;
}

function publicRecord(record) {
  return { src: record.url, width: record.width, height: record.height, bytes: record.bytes, recipe: record.recipe };
}

export async function syncImage(originalUrl, { manifestPath, publicPath, download, upload }) {
  const publicData = await readJson(publicPath);
  if (publicData[originalUrl]?.recipe === RECIPE && publicData[originalUrl]?.src)
    return 'skipped';
  const manifest = await readJson(manifestPath);
  const previous = manifest.uploads?.find(item => item.originalUrl === originalUrl && item.recipe === RECIPE);
  if (previous) {
    await save(async () => {
      const current = await readJson(publicPath);
      current[originalUrl] = publicRecord(previous);
      await writeJson(publicPath, current);
    });
    return 'recovered';
  }
  const original = manifest.uploads?.find(item => item.url === originalUrl);
  const output = await createThumbnail(await download(originalUrl, original?.source));
  const metadata = await sharp(output).metadata();
  const file = `xxd-${createHash('sha256').update(originalUrl).digest('hex').slice(0, 16)}-${RECIPE}.webp`;
  const uploaded = await upload(output, file);
  const record = {
    file,
    source: original?.source ?? originalUrl,
    desc: '首页缩略图；详情页保留原图',
    originalUrl,
    url: uploaded.url,
    thumb: uploaded.thumb ?? '',
    deleteUrl: uploaded.deleteUrl,
    uploadedAt: new Date().toISOString(),
    width: metadata.width,
    height: metadata.height,
    bytes: output.length,
    recipe: RECIPE,
  };
  await save(async () => {
    const currentManifest = await readJson(manifestPath);
    currentManifest.uploads ??= [];
    currentManifest.uploads.push(record);
    // Save the deletion link before writing any public data.
    await writeJson(manifestPath, currentManifest);
    const currentPublic = await readJson(publicPath);
    currentPublic[originalUrl] = publicRecord(record);
    await writeJson(publicPath, currentPublic);
  });
  return 'uploaded';
}

export async function downloadImage(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!response.ok)
    throw new Error(`Image download HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

export async function uploadImage(buffer, file, key) {
  const form = new FormData();
  form.set('key', key);
  form.set('image', new Blob([buffer], { type: 'image/webp' }), file);
  // Do not retry POST automatically: a lost response may still mean a successful upload.
  const response = await fetch('https://api.imgbb.com/1/upload', {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(90000),
  });
  if (!response.ok) {
    const failure = await response.json().catch(() => ({}));
    const message = String(failure.error?.message ?? 'Upload rejected').replaceAll(key, '[redacted]').slice(0, 200);
    const error = new Error(`ImgBB upload HTTP ${response.status}: ${message}`);
    error.rateLimited = response.status === 429 || /rate limit/i.test(message);
    error.retryAfter = response.headers.get('retry-after');
    error.limitHeaders = Object.fromEntries(['retry-after', 'ratelimit-limit', 'ratelimit-remaining', 'ratelimit-reset', 'x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset']
      .map(name => [name, response.headers.get(name)]).filter(([, value]) => value !== null));
    throw error;
  }
  const result = await response.json();
  if (!result.success || !result.data?.image?.url || !result.data?.delete_url)
    throw new Error('ImgBB did not return a complete upload record');
  return { url: result.data.image.url, thumb: result.data.thumb?.url, deleteUrl: result.data.delete_url };
}
