# Agent Skills 搜索平台清单（2026-10）

> 用途：找 agent skill 时的可信渠道速查。按可信度排序，不是按量排序。
> 核实时间：2026-10-21。skills.sh 当时全站累计 1,405,184 安装，榜单首位 `vercel-labs/skills` 的 find-skills 约 4.0M 安装。

## 一、按可信度排序

### 1. skills.sh —— 官方生态主站（首选）

- 站点：https://skills.sh/
- 排序依据是**真实安装量** + 8 周活跃度，不是推广位；有 Official / Audits / Docs 分区。
- 命令
  - 搜索：`npx skills find <query>`（可加 `--owner <owner>` 限定作者）
  - 安装：`npx skills add <owner/repo>`
  - 只看不装：`npx skills use <owner/repo>@<skill>`
  - 已装检查：`npx skills list` / `npx skills check` / `npx skills update`
- 支持 Claude Code、Codex、Cursor、OpenCode 等 70+ agent，含本机 `~/.agents/skills` 归一化路径。

### 2. 源头仓库（最可审计）

| 仓库 | 内容 | 说明 |
|---|---|---|
| https://github.com/anthropics/skills | pdf / docx / mcp-builder / skill-creator | Anthropic 官方 |
| https://github.com/vercel-labs/agent-skills | React / Next.js / 前端设计 | 安装量最大的一档 |
| https://github.com/obra/superpowers | TDD、系统化调试、git worktree、代码审查 | 实战派合集，20+ 技能 |

优点：直接读 `SKILL.md` 与 `scripts/`，真假一眼可辨，无需信任中间商。

### 3. 聚合站（量大，需自查）

| 平台 | 规模 | 特点 | 判断 |
|---|---|---|---|
| https://github.com/zhuyansen/agent-skills-hub （AgentSkillsHub） | 117k+ 项目 | 10 维质量分 + 安全分级，每 8 小时同步，带 trending / rising / top-rated API | 聚合站里最值得用的，有质量信号 |
| https://skillsmp.com （SkillsMP） | 声称 3,000,000+ | 纯 GitHub 爬取，分类 + 职业筛选，免费 REST API 与 MCP | 只当检索器，无审核 |
| https://github.com/dukelyuu/skills-marketplace | 自建源 | 开源可自托管，FTS5 全文搜索，12 平台标注 | 适合团队内自建目录 |

### 4. 本机内网渠道

- 技能 `find-skills` 已在本会话技能表中，加载后按其流程执行（含 skills.sh 榜单 + CLI 搜索 + 内网库）。
- 两个 WeKnora 知识库（存第三方官方 SKILL.md 原件与生成技能）：
  - 第三方官方 skills：`dfaaf6fc-1e5d-4385-a290-58c847d71bcb`
  - 生成技能：`b822071a-fb95-4e98-b05d-aa33da685a42`
- 检索方式：MCP `hybrid_search(kb_id, query)`。

## 二、选型建议

1. 先看 skills.sh 榜单：常见需求（TDD、调试、前端设计、文档处理、PR 审查）大概率已有高安装量成品。
2. 榜单没有再看官方 / 知名作者源头仓库。
3. 还找不到才用聚合站 + 关键词，横向比质量分与更新时间。
4. 都没有就自己写：本仓 `jxx-skill-init` 生成骨架。

## 三、风险提醒（必读）

- skill 是**能携带脚本和 prompt** 的包，装它等于装依赖 + 注入指令。风险面大于普通 npm 包。
- 聚合站（SkillsMP 等）抓 GitHub，无人工审核；先读 `SKILL.md` 和 `scripts/` 再装。
- 不要对聚合站来源执行 `--all -y` 一把刷全量。
- 安装前留意 frontmatter 声明的 `allowed-tools` 与网络权限；skill 正文本身就是提示注入面。

## 四、参考链接

- skills.sh 榜单：https://skills.sh/
- skills CLI 仓库：https://github.com/vercel-labs/skills
- AgentSkillsHub：https://github.com/zhuyansen/agent-skills-hub
- SkillsMP：https://skillsmp.com
- Skill Marketplace（自托管）：https://github.com/dukelyuu/skills-marketplace
- Anthropic 官方 skills：https://github.com/anthropics/skills
