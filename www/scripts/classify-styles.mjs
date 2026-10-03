import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { classifyStyle, isStyleCategory, STYLE_CATEGORIES } from '../../lib/style-categories.ts';

const args = process.argv.slice(2);
const directoryIndex = args.indexOf('--content-dir');
const directory = directoryIndex < 0
  ? resolve(dirname(fileURLToPath(import.meta.url)), '../content/2.prompts')
  : resolve(args.splice(directoryIndex, 2)[1]);
const check = args.includes('--check');
const selected = args.filter(arg => arg !== '--check');
if (selected.some(arg => arg.startsWith('--')))
  throw new Error(`未知参数：${selected.join(' ')}`);
const names = (await readdir(directory)).filter(name => name.endsWith('.md'));
const files = selected.length ? names.filter(name => selected.some(slug => name === slug || name.endsWith(`.${slug}.md`))) : names;
const missing = selected.filter(slug => !files.some(name => name === slug || name.endsWith(`.${slug}.md`)));
let errors = missing.length;
for (const slug of missing)
  console.error(`未找到文章：${slug}`);
let updated = 0;
const counts = new Map();
for (const name of files) {
  const path = resolve(directory, name);
  const source = await readFile(path, 'utf8');
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatter) {
    console.error(`${name}：缺少 frontmatter。`);
    errors++;
    continue;
  }
  const metadata = parse(frontmatter[1]);
  let category = metadata?.styleCategory;
  if (category !== undefined && !isStyleCategory(category)) {
    console.error(`${name}：无效分类 ${category}，请参考 docs/style-categories.md。`);
    errors++;
    continue;
  }
  if (!category) {
    if (check) {
      console.error(`${name}：缺少 styleCategory，请运行 pnpm categories。`);
      errors++;
      continue;
    }
    const prompt = source.match(/::prompt-builder\s*\n```text\r?\n([\s\S]*?)\r?\n```/)?.[1] ?? '';
    const result = classifyStyle({ title: metadata?.title, description: metadata?.description, prompt });
    category = result.category;
    if (!category) {
      console.error(`${name}：需要结合原文判断主风格，候选：${result.candidates.map(item => item.id).join('、') || '无'}。请写入 styleCategory 后重跑。`);
      errors++;
      continue;
    }
    const newline = source.includes('\r\n') ? '\r\n' : '\n';
    // Insert just one metadata line; never serialize or rewrite the quoted prompt.
    const end = frontmatter[0].lastIndexOf(`${newline}---`);
    await writeFile(path, `${source.slice(0, end)}${newline}styleCategory: ${category}${source.slice(end)}`);
    console.log(`${name} → ${STYLE_CATEGORIES.find(item => item.id === category).title}`);
    updated++;
  }
  counts.set(category, (counts.get(category) ?? 0) + 1);
}
console.log(`分类${check ? '检查' : '整理'}：${files.length} 篇，新增 ${updated} 篇，${errors} 项需处理。`);
for (const category of STYLE_CATEGORIES) {
  if (counts.has(category.id))
    console.log(`  ${category.title}：${counts.get(category.id)}`);
}
if (errors)
  process.exitCode = 1;
