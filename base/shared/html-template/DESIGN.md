# Jxx Fresh — 统一 HTML 设计模板

本项目所有「生成 HTML」的技能共用的一套视觉与结构基线。风格：**小清新 · 现代**——薄荷青主色、大圆角、柔和阴影、留白充足、零外部依赖。

## 单一源与分发

| 角色 | 路径 |
|---|---|
| 样式源 | `base/shared/html-template/html-design.css` |
| 交互源 | `base/shared/html-template/html-design.js` |
| 页面骨架源 | `base/shared/html-template/template.html`（占位符 `{{CSS}}` `{{JS}}` `{{TITLE}}` `{{BODY}}`） |
| 示例内容源 | `base/shared/html-template/demo-body.html` |
| 分发脚本 | `base/scripts/sync-html-template.mjs` |

同步到每个目标技能目录（**自包含**，随技能一起 ship）：

```
<skill>/assets/html-design.css        # 样式源副本
<skill>/assets/html-design.js         # 交互源副本
<skill>/references/html-template.html # 完整示例页（CSS/JS 已内联，双击可看）
```

```bash
node base/scripts/sync-html-template.mjs           # 同步到全部目标技能
node base/scripts/sync-html-template.mjs --check   # 只校验，不一致退出码 1
node base/scripts/sync-html-template.mjs --skill jxx-tool-intro
```

新增会产出 HTML 的技能时：把目录名加进脚本的 `TARGETS`，跑一次同步，再在 SKILL.md 里加「HTML 设计模板」小节。

## 硬性约定

1. **自包含**：单个 `.html` 文件可直接双击打开。禁止 CDN、外链字体、外链图片。样式与脚本内联。
2. `<html lang="zh-CN">` + `<meta name="viewport">` + `<meta name="color-scheme" content="light dark">`。
3. 图标一律用 emoji 或内联 SVG，不用图标字体。
4. 深浅色靠 `prefers-color-scheme` 自动切换，不写死背景色。
5. 支持打印（`@media print` 已内置）。
6. 尊重 `prefers-reduced-motion`。

## 设计令牌（浅色）

| 令牌 | 值 | 用途 |
|---|---|---|
| `--paper` | `#f7faf8` | 页面底 |
| `--surface` | `#ffffff` | 卡片/区块 |
| `--surface-2` | `#f2f7f5` | 次级填充、代码底 |
| `--ink` | `#16302b` | 正文主色（墨绿黑） |
| `--ink-2` | `#3f5450` | 次级正文 |
| `--muted` | `#7d918c` | 说明、元信息 |
| `--line` | `#e4ece9` | 分隔线、边框 |
| `--brand` | `#12a594` | 薄荷青主色 |
| `--brand-ink` | `#0b7d70` | 主色文字（链接） |
| `--brand-soft` | `#e3f5f1` | 主色浅底 |
| `--sky` / `--lilac` / `--gold` / `--coral` | 蓝 / 紫 / 琥珀 / 珊瑚 | 辅色，用于分类与状态 |
| `--r` · `--r-lg` · `--r-xl` | 14 / 20 / 28px | 圆角梯度 |
| `--sh-1` · `--sh-2` · `--sh-3` | 逐级柔和 | 阴影（永远轻量） |

暗色模式只覆盖令牌值，不改结构。

## 组件速查

| 组件 | 类 | 说明 |
|---|---|---|
| 站点头 | `.site-header` / `.site-header__brand` / `.site-header__dot` | sticky + 毛玻璃 |
| Hero | `.hero` / `.hero__eyebrow` / `.hero__lead` | 渐变底 + 右上柔光斑 |
| 统计 | `.stats` > `.stat` / `.stat__num` / `.stat__label` | 自适应列 |
| 徽章 | `.badge` + `--brand --sky --lilac --gold --coral --muted` | 胶囊 |
| 胶囊按钮 | `.pills` > `.pill` / `.pill__count` | 导航与筛选，`.is-active` 高亮 |
| 搜索 | `.search` > `input[data-filter-input]` | 配 `[data-filter-item]` 实时过滤 |
| 卡片 | `.card` / `.card__title` / `.card__desc` / `.card__meta` / `.card__cta` | 顶部渐变高光 + 悬停上浮 |
| 评分 | `.rating` / `.rating--lg` / `.rating__num` | ★ 星与数字 |
| 区块 | `.section` + `h2.sec-title` | 白卡 + 竖条标题 |
| 分组 | `.group` / `.group__head` / `.group__title` / `.group__count` | 汇总页分区 |
| 列表 | `ul.list` / `ol.list` | 圆点 / 序号圆 |
| 表格 | `.table-wrap` > `table.tbl` | 首列 `th[scope=row]` 强调 |
| 代码块 | `.codeblk` / `.codeblk__bar` / `.codeblk__lang` / `pre>code` | 自动注入复制按钮 |
| 提示 | `.callout` + `--tip --info --warn --danger` | 带图标 |
| 空状态 | `.empty` / `.empty__title` | 配 `[data-filter-empty]` |
| 面包屑 | `.crumbs` | 详情页返回 |
| 页脚 | `.site-footer` | |
| 返回顶部 | `.to-top` | 滚动 > 400px 显示 |
| 入场 | `.rise` | 轻微上浮淡入 |

## 过滤协议（零依赖 JS）

- `[data-filter-input]`：搜索输入框
- `[data-filter-chip="<值>"]`：分类胶囊，可切换
- `[data-filter-item]` + `data-filter-cat="<值>"` + `data-filter-text="<检索文本>"`：可筛条目
- `[data-filter-group]`：条目容器，全被过滤时自动隐藏
- `[data-filter-empty]`：无结果时的空状态

## 生成方式

- **脚本生成**（如 `jxx-tool-intro`）：读取技能内 `assets/html-design.css`、`assets/html-design.js` 内联进页面，保证与模板同源。
- **模型直接写 HTML**（如 `jxx-teach` 的课程页）：先读 `references/html-template.html`，沿用其类名与 `<style>` 区块，再替换内容。
