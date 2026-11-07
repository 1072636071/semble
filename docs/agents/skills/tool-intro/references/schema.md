# tool.json 字段定义

`docs/guide/<slug>/tool.json` 是工具记录的唯一数据源，生成器据此渲染汇总页与详情页。

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `slug` | string | 是 | 目录名 / URL 片段，取 GitHub 仓库名（如 `open-code-review`） |
| `name` | string | 是 | 展示名（可带中文别名，如 `open-code-review（OCR）`） |
| `github` | string | 否 | 仓库地址，详情页顶部展示链接 |
| `homepage` | string | 否 | 官网地址 |
| `description` | string | 是 | 完整描述（仓库简介级） |
| `summary` | string | 否 | 一句话定位；缺省回退到 `description` |
| `license` | string | 否 | 许可证（如 `Apache-2.0`、`MIT`） |
| `stars` | string | 否 | star 数，带单位（如 `23.9k`）；用于排序 |
| `forks` | string | 否 | fork 数 |
| `language` | string | 否 | 主语言（如 `Go`、`C`） |
| `rating` | number | 否 | 1–5，强烈推荐给 5；默认 5 |
| `category` | string | 否 | 分类，用于汇总页分组；取值见下方「分类清单」，缺省归入「其他」 |
| `tags` | string[] | 否 | 标签，展示为徽章 |
| `features` | string[] | 否 | 核心特性列表 |
| `integrations` | [string, string][] | 否 | 集成形态表格：`[名称, 说明]` |
| `install` | {title,lang,code}[] | 是 | 安装步骤；`lang` 仅用于代码块标注 |
| `usage` | {title,lang,code}[] | 是 | 使用步骤 |
| `notes` | string[] | 否 | 备注列表 |

## 生成规则

- 汇总页按 `category` 分组（分组顺序见下方「分类清单」）→ 组内按 `rating` 降序 → `stars` 数值降序 → 名称排序。
- 分类清单（顺序即汇总页分组顺序；未列出或缺失的分类归入「其他」）：
  1. 浏览器自动化
  2. AI 智能体与框架
  3. 知识与记忆
  4. 上下文与 Token 优化
  5. 代码审查
  6. AI 平台与推理
  7. 文档与数据
  8. 开发工具
  9. 云与自托管
- `stars` 解析：`23.9k` → 23900，`1.8k` → 1800，`2m` → 2000000。
- 代码块内容会做 HTML 转义（`& < > "`），无需手动转义。
- 缺省 `rating` 按 5 处理；缺省 `summary` 用 `description`；缺省 `category` 归入「其他」。
