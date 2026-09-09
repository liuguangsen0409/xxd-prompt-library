import type { H3Event } from 'h3';
import type { StylePreview, StylePreviewPage } from '../../../types/style-board';
import { getQuery } from 'h3';
import { serverQueryContent } from '#content/server';

interface ContentNode {
  tag?: string;
  props?: { 'images'?: string[] | string; ':images'?: string };
  children?: ContentNode[];
}

interface StyleCache {
  at: number;
  list: StylePreview[];
}

function sampleImages(node: ContentNode): string[] {
  if (node.tag === 'sample-grid') {
    const images = node.props?.images ?? node.props?.[':images'];
    if (Array.isArray(images))
      return images;
    if (typeof images === 'string') {
      try {
        return JSON.parse(images);
      } catch {
        return [];
      }
    }
  }
  for (const child of node.children ?? []) {
    const images = sampleImages(child);
    if (images.length)
      return images;
  }
  return [];
}

let styleCache: StyleCache | undefined;
const CACHE_TTL_MS = 5 * 60 * 1000;

function clampLimit(input?: string | string[], fallback = 24) {
  const parsed = Number.parseInt(String(input ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0)
    return fallback;
  return Math.min(parsed, 60);
}

async function loadStyles(event: H3Event) {
  const now = Date.now();
  if (styleCache && now - styleCache.at < CACHE_TTL_MS)
    return styleCache.list;

  const articles = await serverQueryContent(event, '/prompts').find() as {
    _path?: string;
    title?: string;
    description?: string;
    body?: ContentNode;
    gallery?: { description?: string; images?: StylePreview['images'] };
  }[];
  const list = articles.flatMap((article) => {
    if (!article._path || !/\/xxd-panel-\d+$/.test(article._path))
      return [];
    const gallery = article.gallery as { description?: string; images?: { src: string; position?: string }[] } | undefined;
    const samples = sampleImages(article.body ?? {});
    const images = gallery?.images?.length
      ? gallery.images.slice(0, 3)
      : samples.slice(0, 3).map(src => ({ src, position: 'center' }));
    if (!images.length)
      return [];
    return [{
      path: article._path,
      title: article.title ?? '',
      description: gallery?.description ?? (article.description ?? '').replace(/的生图提示词[。.]?$/, '。'),
      number: Number(article._path.match(/\d+$/)?.[0]),
      images,
      fallbackImage: samples[3],
    }];
  }).sort((a, b) => a.number - b.number);

  styleCache = { at: now, list };
  return list;
}

export default defineEventHandler(async (event): Promise<StylePreviewPage> => {
  const query = getQuery(event);
  const all = query.all === '1' || query.all === 'true';
  const queryLimit = Array.isArray(query.limit) ? query.limit[0] : query.limit;
  const queryPage = Array.isArray(query.page) ? query.page[0] : query.page;
  const limit = clampLimit(queryLimit);
  const page = Math.max(1, Number.parseInt(String(queryPage ?? '1'), 10) || 1);
  const styles = await loadStyles(event);
  const total = styles.length;
  if (all)
    return { items: styles, page: 1, limit: total, total, hasMore: false };

  const start = (page - 1) * limit;
  const items = styles.slice(start, start + limit);
  return { items, page, limit, total, hasMore: start + items.length < total };
});
