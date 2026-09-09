import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createError, getQuery } from 'h3';
import sharp from 'sharp';

interface ImageQuery {
  src?: string;
  w?: string;
  q?: string;
  format?: string;
}

function toInt(value: string | undefined, fallback: number, min = 1, max = 1600) {
  if (!value)
    return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed))
    return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event) as ImageQuery;
  const rawSrc = typeof query.src === 'string' ? query.src : '';
  const width = toInt(typeof query.w === 'string' ? query.w : '', 640, 180, 1600);
  const quality = toInt(typeof query.q === 'string' ? query.q : '', 70, 40, 90);
  const format = query.format === 'webp' ? 'webp' : 'jpeg';

  if (!rawSrc)
    throw createError({ statusCode: 400, statusMessage: 'Missing src' });

  let sourceUrl: URL;
  try {
    sourceUrl = new URL(rawSrc);
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Invalid image URL' });
  }
  if (!['http:', 'https:'].includes(sourceUrl.protocol))
    throw createError({ statusCode: 400, statusMessage: 'Unsupported image protocol' });

  const cacheDir = resolve('/tmp/xxd-style-image-cache');
  if (!existsSync(cacheDir))
    mkdirSync(cacheDir, { recursive: true });

  const key = createHash('sha256')
    .update(`${rawSrc}|w=${width}|q=${quality}|f=${format}`)
    .digest('hex');
  const file = join(cacheDir, `${key}.${format}`);

  if (existsSync(file)) {
    event.node.res.setHeader('Content-Type', format === 'webp' ? 'image/webp' : 'image/jpeg');
    event.node.res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    return await readFile(file);
  }

  const response = await fetch(rawSrc);
  if (!response.ok)
    throw createError({ statusCode: 502, statusMessage: 'Upstream image failed' });

  const input = Buffer.from(await response.arrayBuffer());
  let output: Buffer;
  try {
    const encoder = format === 'webp'
      ? sharp(input).webp({ quality })
      : sharp(input).jpeg({ quality, mozjpeg: true });
    output = await encoder
      .rotate()
      .resize({
        width,
        withoutEnlargement: true,
        fit: 'inside',
      })
      .toBuffer();
  } catch {
    throw createError({ statusCode: 415, statusMessage: 'Invalid image data' });
  }

  await writeFile(file, output);
  event.node.res.setHeader('Content-Type', format === 'webp' ? 'image/webp' : 'image/jpeg');
  event.node.res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
  return output;
});
