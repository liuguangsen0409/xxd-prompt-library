import type { NavItem } from '@ztl-uwu/nuxt-content';

// Order is also the sidebar order. Specific media win over generic layout words.
export const STYLE_CATEGORIES = [
  { id: 'naive-illustration', title: '稚趣手绘与绘本', terms: ['稚拙', '童趣', '童真', '绘本', '涂鸦', '丑萌', '民艺', '手绘编辑插画', 'naïve', 'doodle', 'picture-book'] },
  { id: 'line-watercolor', title: '线描速写与淡彩', terms: ['线描', '线稿', '单线', '连续线条', '钢笔', '淡彩', '水彩', '速写', '石墨', '铅笔素描', '观察图谱', '技术图解', 'line-art'] },
  { id: 'pastel-painting', title: '粉彩蜡笔与厚涂', terms: ['粉彩', '蜡笔', '蜡粉笔', '油画棒', '厚涂', '水粉', '干性笔触', '干媒介', '丙烯', 'pastel', 'impasto'] },
  { id: 'printmaking', title: '版画章印与网点', terms: ['版画', '木刻', '雕版', '蚀刻', '凸版', '孔版', '丝网', '橡皮章', '章印', '印章', '网点', '套印', '错版', '拓片', '墨拓', '点刻', 'risograph', 'halftone'] },
  { id: 'geometric', title: '几何抽象与现代主义', terms: ['几何构成', '几何秩序', '几何色块', '几何图形', '几何抽象', '几何块面', '现代主义', '包豪斯', '硬边', '切面', '抽象图形', 'geometric', 'flat-vector'] },
  { id: 'collage', title: '拼贴摄影与档案', terms: ['摄影拼贴', '数字拼贴', '数码混合媒介', '档案', '蒙太奇', '照片碎片', '摄影切片', '纸本综合', '拼贴', 'collage', 'scrapbook', 'photomontage'] },
  { id: 'paper-art', title: '纸艺剪纸与浮雕', terms: ['纸艺', '纸雕', '剪纸', '折纸', '纸层', '撕纸', '纸片层叠', '纸张浮雕', '纸雕凹凸', 'paper-craft', 'paper-cut', 'paper relief'] },
  { id: 'textile-craft', title: '纺织刺绣与材质手作', terms: ['纺织', '刺绣', '拼布', '布艺', '布片', '针迹', '羊毛毡', '针毡', '珐琅', '金箔', '纯金', '贝壳', '自然材料', '皂沫', 'embroidery', 'fabric'] },
  { id: 'miniature', title: '微缩模型与空间构成', terms: ['等距', '轴测', '微缩', '模型', '沙盘', '积木', '体素', '立体装置', '雕塑', 'isometric', 'diorama', 'axonometric'] },
  { id: 'oriental-ink', title: '东方水墨与写意', terms: ['水墨', '彩墨', '文人画', '中国写意', '东方写意', '东方框景', '东方极简平面', '工笔', 'ink wash'] },
  { id: 'type-pixel', title: '字体图形与像素实验', terms: ['字体图形', '字体插画', '字体图像', '文字造型', '文字即图像', '文字编码', '字形', '字标', '像素', '位图', '字符', '文本景观', 'typography as image', 'pixel', 'typographic'] },
  { id: 'conceptual', title: '观念超现实与视觉隐喻', terms: ['观念', '超现实', '哲思', '哲学', '不可能空间', '格式塔', '隐藏意象', '情绪窗口', '视觉命题', '柔焦投影', '饭盒化', 'surrealism', 'surreal', 'bento-fication'] },
] as const;

export type StyleCategoryId = typeof STYLE_CATEGORIES[number]['id'];

export function isStyleCategory(value: unknown): value is StyleCategoryId {
  return STYLE_CATEGORIES.some(category => category.id === value);
}

function positiveText(text: string) {
  return text.toLowerCase().replace(/\*\*/g, '').replace(/(?:避免|不要|不得|禁止|不做|不是|而非|不追求|不制作|不采用|不再使用|avoid\b)[^。；;！!\n]*/giu, '');
}

export function classifyStyle(input: { title?: string; description?: string; prompt: string }) {
  const prompt = positiveText(input.prompt);
  // A named transformation is more informative than incidental texture/layout references.
  const direction = [...prompt.matchAll(/(?:重构为|转译为|转化为|风格[为是]|图形采用|文字采用)([^。\n]{0,150})/g)].map(match => match[1]).join('\n');
  const metadata = positiveText(`${input.title ?? ''}\n${input.description ?? ''}`);
  const ranked = STYLE_CATEGORIES.map(({ id, terms }) => ({
    id,
    score: terms.reduce((score, term) => score + (direction.includes(term) ? 8 : 0) + (prompt.includes(term) ? 3 : 0) + (metadata.includes(term) ? 1 : 0), 0),
  })).sort((a, b) => b.score - a.score);
  const first = ranked[0]!;
  const second = ranked[1]!;
  const confident = first.score >= 11 && first.score - second.score >= 3;
  return { category: confident ? first.id : null, candidates: ranked.filter(item => item.score > 0).slice(0, 3) };
}

/** Group only prompt leaves; keep routes and unrelated documentation untouched. */
export function groupStyleNavigation(links: NavItem[]): NavItem[] {
  const ordinary: NavItem[] = [];
  const buckets = new Map<string, NavItem[]>();
  for (const link of links) {
    if (link.children) {
      ordinary.push({ ...link, children: groupStyleNavigation(link.children) });
      continue;
    }
    if (!/^\/prompts\/[^/]+\/?$/.test(link._path)) {
      ordinary.push(link);
      continue;
    }
    const id = isStyleCategory(link.styleCategory) ? link.styleCategory : 'unclassified';
    const children = buckets.get(id) ?? [];
    const number = link._path.match(/xxd-panel-(\d+)\/?$/)?.[1];
    children.push({ ...link, title: number ? `${number.padStart(3, '0')} · ${link.title}` : link.title });
    buckets.set(id, children);
  }
  const categories = [...STYLE_CATEGORIES, { id: 'unclassified', title: '待分类' }];
  return [...ordinary, ...categories.flatMap((category) => {
    const children = buckets.get(category.id);
    if (!children?.length)
      return [];
    children.sort((a, b) => a._path.localeCompare(b._path, 'en', { numeric: true }));
    return [{
      _id: `style-category-${category.id}`,
      _path: `/prompts/categories/${category.id}`,
      title: category.title,
      styleCategoryGroup: true,
      redirect: children[0]!._path,
      children,
      collapse: true,
    }];
  })];
}
