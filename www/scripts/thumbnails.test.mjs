import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { collectImages, cooldownMs, createThumbnail, runBatch, syncImage } from './thumbnails-lib.mjs';

test('honors retry-after seconds or dates and uses conservative fallback if absent', () => {
  assert.equal(cooldownMs('120'), 120000);
  assert.equal(cooldownMs('Sat, 26 Sep 2026 03:00:00 GMT', Date.parse('2026-09-26T02:00:00Z')), 3600000);
  assert.equal(cooldownMs(null), 3600000);
});

test('limits each batch and waits between serial uploads', async () => {
  const events = [];
  await runBatch(['a', 'b', 'c'], async url => events.push(url), {
    limit: 2,
    intervalMs: 10000,
    wait: async ms => events.push(ms),
  });
  assert.deepEqual(events, ['a', 10000, 'b']);
});

test('stops a batch immediately when an upload is rejected', async () => {
  const seen = [];
  await assert.rejects(runBatch(['a', 'b', 'c'], async (url) => {
    seen.push(url);
    throw new Error('Rate limit reached');
  }, { limit: 3, intervalMs: 0 }), /Rate limit/);
  assert.deepEqual(seen, ['a']);
});

test('reads gallery overrides and sample fallback without treating prompt URLs as images', () => {
  const article = '---\ntitle: Test\ngallery:\n  images:\n    - src: https://example.com/custom.png\n      position: bottom\n---\n::sample-grid\n---\nimages: [https://example.com/a.png, https://example.com/b.png, https://example.com/c.png, https://example.com/d.png]\n---\n::\n```text\nhttps://example.com/not-an-image.png\n```';
  assert.deepEqual(collectImages(article), ['https://example.com/custom.png', 'https://example.com/d.png']);
});

test('creates a smaller WebP without changing aspect ratio or enlarging small originals', async () => {
  const large = await sharp({ create: { width: 1200, height: 1600, channels: 3, background: 'red' } }).png().toBuffer();
  const result = await createThumbnail(large);
  const metadata = await sharp(result).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, 480);
  assert.equal(metadata.height, 640);
  const small = await sharp({ create: { width: 90, height: 120, channels: 3, background: 'red' } }).png().toBuffer();
  assert.equal((await sharp(await createThumbnail(small)).metadata()).width, 90);
});

test('does not report an article with missing sample data as complete', () => {
  assert.throws(() => collectImages('---\ntitle: Missing samples\n---\n正文'), /sample/i);
});

test('checkpoints uploads privately and resumes without uploading twice', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'xxd-thumbnails-test-'));
  try {
    const manifestPath = join(dir, 'manifest.json');
    const publicPath = join(dir, 'public.json');
    await writeFile(manifestPath, JSON.stringify({ uploads: [{ url: 'https://example.com/original.png', source: 'https://github.com/example/image.png' }] }));
    await writeFile(publicPath, '{}');
    const input = await sharp({ create: { width: 600, height: 800, channels: 3, background: 'blue' } }).png().toBuffer();
    let uploads = 0;
    const options = {
      manifestPath,
      publicPath,
      download: async () => input,
      upload: async () => {
        uploads++;
        return { url: 'https://i.ibb.co/example/small.webp', deleteUrl: 'private-delete-token' };
      },
    };
    await syncImage('https://example.com/original.png', options);
    // Simulate interruption after the private checkpoint, before publishing the mapping.
    await writeFile(publicPath, '{}');
    await syncImage('https://example.com/original.png', options);
    assert.equal(uploads, 1);
    const publicText = await readFile(publicPath, 'utf8');
    assert.equal(JSON.parse(publicText)['https://example.com/original.png'].src, 'https://i.ibb.co/example/small.webp');
    assert.ok(!publicText.includes('private-delete-token'));
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    assert.equal(manifest.uploads.length, 2);
    assert.equal(manifest.uploads[1].source, 'https://github.com/example/image.png');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
