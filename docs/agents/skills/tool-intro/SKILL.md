---
name: tool-intro
description: "记录并介绍开发工具（GitHub 项目），生成中文工具档案与 HTML 汇总页。当用户要记录工具、介绍工具、把工具加进工具目录时触发。不改工具本身。"
disable-model-invocation: true
---

<!--en-->
# tool-intro

Record and introduce a developer tool (typically a GitHub repository) as a structured Chinese tool profile that always includes **installation** and **usage**, and render it as beautiful, self-contained HTML.

Workflow:
1. Gather info — from the GitHub URL the user gives, fetch the repo page and `https://api.github.com/repos/<owner>/<repo>` for stars / forks / license / language / description / homepage.
2. Distill content — summary, core features, integrations, install steps, usage steps, notes; assign a `rating` (1–5, 5 = strongly recommended).
3. Write data — create `docs/guide/<slug>/tool.json` (see references/schema.md for the field list). This is the single source of truth.
4. Render — from the **target project root**, run `node <本技能目录>/scripts/gen-tool-page.mjs`. It reads `docs/guide/*/tool.json` and generates `docs/guide/index.html` (summary) and `docs/guide/<slug>/index.html` (detail). The root is resolved from cwd upward (`.git` / `docs`); override with `--root` / `--src` / `--out`.
5. Verify — open the generated HTML and confirm it renders correctly.

Keep the `tool.json` as the single source of truth; re-running the script regenerates all pages under `docs/guide/`.
<!--/en-->

# tool-intro

为开发工具（通常是 GitHub 仓库）生成中文「工具介绍」档案，**必须包含安装与使用**，并渲染成精美的自包含 HTML：一个汇总页 + 每个工具一个详情页。

## 何时使用

- 用户说「记录这个工具」「介绍下 XXX」「把 XXX 加进工具目录」「给这个仓库写个工具介绍」
- 用户要沉淀一批常用工具的档案（含安装/使用），并以网页形式汇总

## 工作流

### 第 1 步 — 抓取工具信息

拿到用户给的 GitHub 地址后，并行获取：

- 仓库主页（WebFetch）：定位、特性、集成形态、安装与使用要点
- GitHub API：`https://api.github.com/repos/<owner>/<repo>`，取 `stargazers_count`、`forks_count`、`license.spdx_id`、`language`、`description`、`homepage`、`pushed_at`（判断活跃度）

`slug` 取仓库名（如 `alibaba/open-code-review` → `open-code-review`）。

### 第 2 步 — 整理内容

提炼以下板块，落到 `tool.json`：

- `summary` / `description`：一句话定位 + 完整描述
- `features`：核心特性列表
- `integrations`：集成形态（CLI / Action / 插件 / MCP 等）表格
- `install`：安装步骤（含 Shell / PowerShell / npm 等多种方式）
- `usage`：使用步骤（命令、配置片段、典型指令）
- `notes`：备注（可控项、跨平台、性能等）
- `rating`：1–5，强烈推荐给 **5**；写入后会显示在汇总页与详情页
- `category`：分类（如 `浏览器自动化` / `AI 智能体与框架` / `知识与记忆` 等，见 schema.md「分类清单」）；汇总页按此分组，详情页展示分类徽章

字段完整定义见 [references/schema.md](references/schema.md)。

### 第 3 步 — 写 tool.json

写到 `docs/guide/<slug>/tool.json`。它是**唯一数据源**，HTML 全由它生成。

```json
{
  "slug": "open-code-review",
  "name": "open-code-review（OCR）",
  "github": "https://github.com/alibaba/open-code-review",
  "homepage": "https://open-codereview.ai",
  "description": "……",
  "license": "Apache-2.0",
  "stars": "23.9k",
  "language": "Go",
  "rating": 5,
  "category": "代码审查",
  "tags": ["code-review", "agent"],
  "summary": "……",
  "features": ["……"],
  "integrations": [["CLI", "……"]],
  "install": [{ "title": "npm", "lang": "bash", "code": "npm i -g ……" }],
  "usage": [{ "title": "本地审查", "lang": "bash", "code": "ocr review" }],
  "notes": ["……"]
}
```

### 第 4 步 — 生成 HTML

在**目标项目的根目录**下执行（脚本从 cwd 向上找含 `.git` / `docs` 的项目根，取其 `docs/guide`）：

```bash
node <本技能目录>/scripts/gen-tool-page.mjs
```

脚本会扫描 `docs/guide/*/tool.json`（数据源），把 HTML 渲染到 `docs/guide/`：

- `docs/guide/index.html` — 汇总页（按 `category` 分组，组内按 rating→stars 排序，顶部有分类导航，★ 标注推荐度）
- `docs/guide/<slug>/index.html` — 该工具详情页（简介 / 核心特性 / 集成方式 / 安装 / 使用 / 备注）

只重渲染某个工具加 `--slug <slug>` 即可；输出目录可用 `--out <dir>` 覆盖，数据源用 `--src <dir>` 覆盖，项目根用 `--root <dir>` 覆盖（另有环境变量 `SRC_DIR` / `OUT_DIR`）。**脚本不锚定自身安装位置**——技能会被分发到各平台的 `skills/<skill>/scripts/` 下，固定层级的相对路径会指到无关目录，所以在别的项目里必须站到项目根执行或显式传 `--root`。

### 第 5 步 — 校验

打开生成的 HTML，确认无模板残留、代码块转义正确、链接可达。

## 深入

- **字段schema** — 见 [references/schema.md](references/schema.md)：`tool.json` 每个字段的含义、类型、是否必填。写数据前读。
- **生成器实现** — `scripts/gen-tool-page.mjs`：纯 node，无第三方依赖，浅色主题、自包含 CSS。改版式时改这里。

## 与相邻技能分工

- `tool-intro`（本技能）：把**外部工具**沉淀成带安装/使用的中文 HTML 档案
- `jxx-skill-init`：从零创建**技能**骨架（不是记录工具）
