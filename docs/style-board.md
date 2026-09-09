# 首页风格看板

首页通过 `StyleBoardEmbed` 嵌入 `/embed/styles`。这个 Vue 路由不进入 Markdown 导航或站内全文索引，带 `noindex, nofollow`。浏览器独立打开时跳回 `/#styles`；这只是入口控制，不是鉴权或 URL 保密。

看板从 `/api/styles` 读取文章标题、描述和 `sample-grid` 中前三张样张。第四张作为图床加载失败时的备用图片。默认按编号排列，搜索覆盖标题、描述和编号，每批显示 12 个风格。卡片链接在顶层窗口打开详情。

`ResizeObserver` 把内容高度传给首页，首页和 iframe 都校验消息来源与 origin。主题同步不修改用户保存的主题偏好。触屏设备常显文字，键盘聚焦和鼠标悬停显示渐变说明层。

## 自定义封面

在文章顶部 frontmatter 添加可选配置，图片地址沿用图床资源：

```yaml
gallery:
  description: 轻盈、稚拙、复古的手绘编辑插画。
  images:
    - src: https://i.ibb.co/vvzXfqp2/sample-09.png
      position: center
    - src: https://i.ibb.co/YTTj15zD/sample-10.png
      position: center
    - src: https://i.ibb.co/20BPz86D/sample-11.png
      position: center
```

`position` 对应 `object-position`，用于微调主体位置。若要只展示上下对照图中的效果区域，应提供单独的效果图封面地址；默认使用完整样张，不统一截取下半部分。详情中的原始图片不会受看板配置影响。

SSR 可直接运行。SSG 配置显式预渲染 `/embed/styles` 和 `/api/styles`，因为默认链接爬虫未必会发现 iframe 的 src。
