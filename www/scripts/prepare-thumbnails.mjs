import { mkdir, open, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { collectImages, cooldownMs, downloadImage, readJson, RECIPE, runBatch, syncImage, uploadImage } from './thumbnails-lib.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const { values, positionals } = parseArgs({
  options: {
    'check': { type: 'boolean' },
    'all': { type: 'boolean' },
    'limit': { type: 'string', default: '10' },
    'interval-seconds': { type: 'string', default: '10' },
  },
  allowPositionals: true,
});
const check = values.check;
const slug = positionals[0];
const limit = Number(values.limit);
const intervalMs = Number(values['interval-seconds']) * 1000;
if (positionals.length > 1 || (slug && !/^xxd-panel-\d+$/.test(slug)) || (slug && values.all) || (!values.all && !slug && !check)
  || !Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isFinite(intervalMs) || intervalMs < 1000 || intervalMs > 60000) {
  console.error('Usage: pnpm thumbnails <xxd-panel-NNN|--all> [--check] [--limit 10] [--interval-seconds 10]');
  process.exit(1);
}
const contentDir = join(root, 'www/content/2.prompts');
const files = (await readdir(contentDir)).filter(file => /\.xxd-panel-\d+\.md$/.test(file) && (!slug || file.endsWith(`.${slug}.md`))).sort((a, b) => Number.parseInt(a) - Number.parseInt(b));
if (!files.length)
  throw new Error('No matching articles');
const urls = [...new Set((await Promise.all(files.map(async file => collectImages(await readFile(join(contentDir, file), 'utf8'))))).flat())];
const publicPath = join(root, 'www/data/style-thumbnails.json');
const manifestPath = join(root, 'imgbb-manifest.json');
const mapping = await readJson(publicPath);
const missing = urls.filter(url => mapping[url]?.recipe !== RECIPE || !mapping[url]?.src);
console.log(`${files.length} articles, ${urls.length} images, ${missing.length} missing thumbnails`);
if (check) {
  process.exitCode = missing.length ? 1 : 0;
} else if (missing.length) {
  try {
    process.loadEnvFile(join(root, '.env'));
  } catch (error) {
    if (error.code !== 'ENOENT')
      throw error;
  }
  const key = process.env.IMGBB_API_KEY;
  if (!key)
    throw new Error('IMGBB_API_KEY is required (root .env or environment)');
  await mkdir(join(root, 'www/data'), { recursive: true });
  const stateDir = join(root, '.cache');
  await mkdir(stateDir, { recursive: true });
  const statePath = join(stateDir, 'thumbnail-upload-state.json');
  const lockPath = join(stateDir, 'thumbnail-upload.lock');
  let lock;
  try {
    lock = await open(lockPath, 'wx');
  } catch (error) {
    if (error.code === 'EEXIST')
      throw new Error('Another thumbnail run holds .cache/thumbnail-upload.lock. If a previous process crashed, confirm it has stopped before removing the lock.');
    throw error;
  }
  try {
    const state = await readJson(statePath);
    if (state.nextAttemptAt && Date.parse(state.nextAttemptAt) > Date.now()) {
      console.log(`Cooling down until ${state.nextAttemptAt}; no upload attempted.`);
      process.exitCode = 2;
    } else {
      let complete = 0;
      console.log(`Batch: up to ${Math.min(limit, missing.length)} images, serial, ${intervalMs / 1000}s between images.`);
      try {
        await runBatch(missing, async (url) => {
          const status = await syncImage(url, { manifestPath, publicPath, download: downloadImage, upload: (buffer, file) => uploadImage(buffer, file, key) });
          console.log(`${++complete}/${Math.min(limit, missing.length)} ${status}`);
        }, { limit, intervalMs });
        await writeFile(statePath, `${JSON.stringify({ checkedAt: new Date().toISOString(), remaining: missing.length - complete, status: 'batch-complete' }, null, 2)}\n`);
        console.log(`Batch complete; ${missing.length - complete} thumbnails still missing.`);
      } catch (error) {
        if (error.rateLimited) {
          const consecutiveRateLimits = complete ? 1 : (state.consecutiveRateLimits ?? (state.status === 'rate-limited' ? 1 : 0)) + 1;
          const backoff = Math.min(24, 2 ** Math.min(consecutiveRateLimits - 1, 5)) * 60 * 60 * 1000;
          const nextAttemptAt = new Date(Date.now() + Math.max(cooldownMs(error.retryAfter), backoff)).toISOString();
          await writeFile(statePath, `${JSON.stringify({ checkedAt: new Date().toISOString(), remaining: missing.length - complete, status: 'rate-limited', consecutiveRateLimits, nextAttemptAt, limitHeaders: error.limitHeaders }, null, 2)}\n`);
          console.error(`Rate limited; headers: ${JSON.stringify(error.limitHeaders)}. Next attempt no earlier than ${nextAttemptAt} (conservative backoff; honors Retry-After when provided).`);
          process.exitCode = 2;
        } else {
          console.error(`${error.message}. Completed uploads are checkpointed; inspect the failure before rerunning.`);
          process.exitCode = 1;
        }
      }
    }
  } finally {
    await lock.close();
    await unlink(lockPath);
  }
}
