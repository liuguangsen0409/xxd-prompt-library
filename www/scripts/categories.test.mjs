import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { classifyStyle, groupStyleNavigation } from '../../lib/style-categories.ts';

test('primary prompt language outranks a misleading copied title and negative constraints', () => {
  assert.equal(classifyStyle({
    title: '摄影与数码混合媒介拼贴海报',
    prompt: '下半部分重构为新中式专色版画插画。图形采用木刻、丝网印刷与孔版印刷感的版画语言。避免水彩、粉彩、剪纸、刺绣、3D模型。',
  }).category, 'printmaking');
  assert.equal(classifyStyle({
    title: '摄影与数码混合媒介拼贴海报',
    prompt: '下半部分重构为字体图形装置。文字采用 Typography as Image 的逻辑，让文字本身承担结构骨架。避免木刻版画。',
  }).category, 'type-pixel');
});

test('unknown styles require review rather than silently defaulting into a category', () => {
  assert.equal(classifyStyle({ title: '新风格', prompt: '保持原物身份，重新设计画面。' }).category, null);
});

test('grouping keeps every page once, sorts numerically, and links groups to real first articles', () => {
  const links = [
    { _path: '/prompts/xxd-panel-010', title: '十', styleCategory: 'line-watercolor' },
    { _path: '/prompts/xxd-panel-002', title: '二', styleCategory: 'line-watercolor' },
    { _path: '/prompts/xxd-panel-221', title: '版画', styleCategory: 'printmaking' },
  ];
  const groups = groupStyleNavigation(links);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].redirect, '/prompts/xxd-panel-002');
  assert.deepEqual(groups[0].children.map(x => x._path), ['/prompts/xxd-panel-002', '/prompts/xxd-panel-010']);
  assert.equal(groups[0].children[0].title, '002 · 二');
  assert.equal(groups.flatMap(x => x.children).length, 3);
  assert.equal(links[1].title, '二');
});

test('unclassified pages remain reachable and non-prompt navigation stays intact', () => {
  const guide = { _path: '/usage', title: '使用指南' };
  const groups = groupStyleNavigation([guide, { _path: '/prompts/new-style', title: '新风格' }]);
  assert.equal(groups[0], guide);
  assert.equal(groups[1].children[0]._path, '/prompts/new-style');
  assert.equal(groups[1].redirect, '/prompts/new-style');
});

test('collection command persists missing categories, preserves prompt bytes, and checks without writing', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'xxd-categories-'));
  const file = join(dir, '1.xxd-panel-001.md');
  const original = '---\ntitle: 羊毛毡小品\n---\n\n::prompt-builder\n```text\n下半部分重构为手工羊毛毡插画，保留纤维与针毡质感。避免真实3D模型。\n```\n::\n';
  const run = (...args) => spawnSync(process.execPath, ['--experimental-strip-types', 'www/scripts/classify-styles.mjs', '--content-dir', dir, ...args], { encoding: 'utf8' });
  try {
    await writeFile(file, original);
    assert.equal(run('--check').status, 1);
    assert.equal(await readFile(file, 'utf8'), original);
    const classified = run();
    assert.equal(classified.status, 0, classified.stderr);
    const result = await readFile(file, 'utf8');
    assert.match(result, /styleCategory: textile-craft/);
    assert.equal(result.replace('styleCategory: textile-craft\n', ''), original);
    assert.equal(run().status, 0);
    assert.equal(await readFile(file, 'utf8'), result);
    assert.equal(run('--check').status, 0);
    assert.equal(run('xxd-panel-999', '--check').status, 1);
    await writeFile(file, result.replace('textile-craft', 'invalid-category'));
    assert.equal(run('--check').status, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
