# 让 AI Agent 操作浏览器的技术方案调研（截至 2026-10）

> 调研方式：按本仓库 `jxx-research` 技能的自由模式，启动 4 个并行调研子 agent，每个负责一个流派，对既有二手盘点（2026-10）逐条用**一手来源**（官方仓库 / 官方博客 / GitHub 页面 / 规范库）核实。本文所有论断均标注来源，无法用一手来源证实的标注 ❓/❌，不臆测。
>
> 二手论断核实结论图例：✅ 属实 ｜ ⚠️ 部分属实（注明偏差） ｜ ❌ 未找到证据（疑似编造） ｜ ❓ 无法验证。

---

## 0. 总览：四大流派

| 流派 | 定位 | 成熟度 | 代表方案 | 适合谁 |
|---|---|---|---|---|
| **MCP Server** | 把浏览器能力暴露成标准 MCP 工具，供任意 Agent 接 | 成熟可用 | Playwright MCP、Chrome DevTools MCP、Skyvern | 集成进现有 MCP Agent |
| **专用 Agent 框架** | 端到端"自然语言→浏览器操作"开箱即用 | 成熟、生态最大 | Browser Use、Stagehand、Skyvern、UI-TARS、Comet | 快速搭浏览器 Agent / 终端用户 |
| **浏览器原生能力** | 浏览器/网页官方协议，未来形态 | 实验 / 灰度 | WebMCP（实验）、Chrome Skills（灰度） | 前瞻、等标准落地 |
| **CLI / Skills 工具** | 解决反爬、验证码、真实登录态复用等痛点 | 混合（商用为主） | BrowserAct Skills、BrowserSkill、VCP 生态 | 强反爬采集 / 复用个人登录态 |

---

## 1. 🏆 MCP Server 流派（通用标准首选）

### 1.1 推荐方案清单

- **Playwright MCP（Microsoft）** — 开源，`@playwright/mcp` 微软官方｜<https://github.com/microsoft/playwright-mcp>
  25+ 工具，accessibility-tree 快照（无需视觉模型），跨 Chromium/Firefox/WebKit；原生接入 Claude Code / Cursor / Codex / GitHub Copilot。last commit 2026-09-28。最稳健、通用的浏览器自动化底座；缺点是无像素级渲染、纯 DOM/可访问性树视角。

- **Chrome DevTools MCP（Google Chrome DevTools 团队）** — 开源｜repo <https://github.com/ChromeDevTools/chrome-devtools-mcp> ｜ 官方博客 <https://developer.chrome.com/blog/chrome-devtools-mcp>
  基于 CDP 连接"活着"的真实 Chrome，可读 console / 网络请求 / 性能数据、在页面执行 JS；支持 Claude Code / Cursor / Gemini CLI / Copilot / Cline。v1.10.1（2026-09-23），commit 2026-10-07（**极活跃**）。延迟最低、调试信息最全；偏调试/观测，非通用任务编排。**官方版已取代老的第三方 Chrome DevTools MCP。**

- **Browser Use** — 开源（主仓 Python）+ 商业云｜<https://github.com/browser-use/browser-use>
  AI agent 驱动 Chrome over CDP，自然语言端到端任务；社区最大之一。缺点：DOM 为主、视觉为辅、token 成本偏高。

- **agent-browser（Vercel Labs）** — 开源（Rust, Apache-2.0）｜<https://github.com/vercel-labs/agent-browser> ｜ 官网 <https://agent-browser.dev>
  快照+refs（`@eN`）范式，`agent-browser mcp` stdio server；CDP 连真实 Chrome，支持 Browserbase / Browserless 云浏览器；约 43.5k stars。高吞吐、低资源占用的生产自动化；生态较新。

- **Skyvern** — 开源（AGPL）+ 商业云｜<https://github.com/Skyvern-AI/skyvern> ｜ MCP 文档 <https://github.com/Skyvern-AI/skyvern/blob/main/docs/skill.md>
  LLM + 计算机视觉，Playwright 兼容 SDK，结构化数据抽取、复杂表单、非结构化网页；MCP 包 `@anthropic-ai/skyvern-mcp`；约 21k stars。视觉路线对动态布局鲁棒；AGPL 商用需注意、视觉 token 贵。

- **Stagehand（Browserbase）** — 开源 + 商业｜<https://github.com/browserbase/stagehand>
  在 Playwright 上叠加 AI 原语 `act / observe / extract`（自愈选择器）；约 25.5k stars。与 Playwright 平滑衔接；Browserbase 体验最佳、强绑定。

- **BrowserSkill（Tencent）** — 开源（MIT）｜<https://github.com/Tencent/BrowserSkill>
  让 AI 用你"已登录"的真实 Chrome/Edge，CLI（`bsk`）+ 浏览器扩展，不打断你工作；Rust 实现。需真实登录态、不想另开无头浏览器时最省事；较新、星数少。

- **Obscura** — 开源（Rust, Apache-2.0）｜<https://github.com/h4ckf0r0day/obscura>
  内置 V8 的 headless 引擎，`obscura mcp`，CDP 兼容，stealth。反爬/隐身抓取；个人维护、有合规风险。

- **Page-Agent（Alibaba）** — 开源（MIT, TypeScript）｜<https://github.com/alibaba/page-agent> ｜ 官网 <https://alibaba.github.io/page-agent/>
  把 AI agent 嵌进网页内部（在页 JS 读 DOM），含 Beta 的 `packages/mcp-server/`。给自有网站加 AI 副驾；非外部浏览器控制、MCP 仍 Beta。

- **（补充）Cloudflare Playwright MCP** — 开源｜<https://github.com/cloudflare/playwright-mcp>
  跑在 Cloudflare Workers + Browser Rendering 上的无服务器 Playwright MCP（约 249 stars）。边缘/无服务器部署的浏览器自动化。

### 1.2 二手论断核实（MCP 流派）

| 论断（来自 2026-10 二手盘点） | 结论 | 来源 |
|---|---|---|
| Playwright MCP 最稳健/兼容、全 API、原生集成 Claude Code / Cursor | ✅ 属实 | [playwright-mcp README](https://github.com/microsoft/playwright-mcp) ｜ [Cursor 接入示例](https://bug0.com/blog/playwright-mcp-servers-ai-testing) |
| Browser Use 社区热度第一 | ✅ 属实（排行榜 #1，~108k 量级） | [Scrapfly 2026 盘点](https://scrapfly.io/blog/posts/best-ai-browser-agents) ｜ [GitHub](https://github.com/browser-use/browser-use) |
| Browser Use 有 **11 万+（110k+）stars** | ❌ 未证实（公开可查约 79k–85k） | [Medium ~79,000](https://jess-writes-about-tech.medium.com/an-open-source-browser-agent-called-browser-use-the-most-important-ai-tool-for-2026-d86c028d4516) ｜ [对比表 85k](https://dev.to/stevengonsalvez/browser-tools-for-ai-agents-part-2-the-framework-wars-browser-use-stagehand-skyvern-4gn) |
| Browser Use 视觉 + DOM 双模 | ⚠️ 部分属实（核心为 DOM/可访问性树，视觉经 `ChatBrowserUse` 辅助） | [browser-use FAQ](https://github.com/browser-use/browser-use) ｜ [digitalapplied](https://www.digitalapplied.com/blog/open-source-browser-computer-use-agents-2026) |
| Browser Use 开源 **jev-ultrafast**，决策/生成解耦、10x 提速 | ⚠️ 部分属实（repo 存在、用 TypeSafe Jev 动态索引动作空间；"10x"无一手基准） | [jev-ultrafast repo](https://github.com/browser-use/jev-ultrafast) ｜ [Browser Use SUPERFAST](https://browser-use.com/ultrafast) |
| Chrome DevTools MCP 基于 CDP、最低延迟、调试/轻量 | ✅ 属实 | [Chrome DevTools MCP repo](https://github.com/ChromeDevTools/chrome-devtools-mcp) ｜ [官方博客](https://developer.chrome.com/blog/chrome-devtools-mcp) |
| Skyvern LLM+CV、复杂表单/数据抽取/非结构化网页、NL 描述 | ✅ 属实 | [Skyvern repo](https://github.com/Skyvern-AI/skyvern) ｜ [MCP skill 文档](https://github.com/Skyvern-AI/skyvern/blob/main/docs/skill.md) |
| （本地）agent-browser 有 42.5k stars | ✅ 属实（约 43.5k） | [vercel-labs stargazers 43,469](https://github.com/vercel-labs/agent-browser) |
| （本地）Obscura 有 26.9k stars | ❓ 无法验证（GitHub API 限流，未取到独立星数；repo 与描述属实） | [Obscura repo](https://github.com/h4ckf0r0day/obscura) |
| （本地）Page-Agent 有 29.1k stars | ❓ 无法验证（未取到独立星数；MIT / 在页 JS 描述属实） | [Page-Agent repo](https://github.com/alibaba/page-agent) |
| （本地）BrowserSkill 可借真实已登录浏览器 | ✅ 属实（MIT，CLI + 扩展） | [Tencent/BrowserSkill repo](https://github.com/Tencent/BrowserSkill) |

---

## 2. 🚀 专用浏览器 Agent 框架（开箱即用）

### 2.1 推荐方案清单

- **Browser Use** — <https://github.com/browser-use/browser-use> ｜ 官网 <https://browser-use.com/>
  最受欢迎的开源浏览器 Agent（Python + TypeScript），"自然语言→浏览器操作"闭环 + 商业云（托管 Agent API、隐身、CAPTCHA 破解、住宅代理，$0.02/浏览器小时）。极活跃（2026-10-07 仍有提交，10k+ commits）。生态最大、文档全；依赖外部 LLM（延迟/成本/不稳定）。

- **Stagehand（Browserbase）** — <https://github.com/browserbase/stagehand> ｜ 官网 <https://www.stagehand.dev/>
  面向 Agent 的浏览器 SDK（act/observe/extract 语义 API，非脆弱 CSS 选择器）。跨 TS/Python/Go，v4(2026) 将核心移入浏览器扩展、2x 速度、省 80% token、自修复选择器。比 Browser Use 更工程化、确定性更强；v4 移除了内置 agent() 编排器需自行编排。

- **Skyvern** — <https://github.com/Skyvern-AI/skyvern> ｜ 官网 <https://www.skyvern.com/>
  LLM + 计算机视觉的浏览器工作流自动化，任务→规划器→执行器(LLM+视觉)→校验器 流水线，适配任意网站、表单填写、多步流程（WebVoyager 85.8%）。无需写选择器、可视化；AI 步骤更慢更贵，反爬处理有限。

- **Midscene（字节 web-infra-dev）** — <https://github.com/web-infra-dev/midscene> ｜ 文档 <https://midscenejs.com/>
  视觉驱动的 GUI Agent，截图→视觉模型定位元素→点击/输入/滚动；同一 Agent API 覆盖 Web、移动(iOS/Android/HarmonyOS)、PC 桌面。视觉定位不依赖 DOM、跨端；偏测试场景，纯浏览器 Agent 编排弱于 Browser Use/Stagehand。

- **Perplexity Comet** — 官网 <https://www.perplexity.ai/comet>
  AI 原生浏览器（消费级产品，非开发框架），把搜索与执行融合进浏览器侧边助手，跨标签页自然语言搜索/摘要/执行。开箱即用、零代码；不可嵌入自有系统，且有合规/TOS 风险。

- **AgentQL** — 官网 <https://agentql.com/>
  以查询式抽取网页数据 + 轻量交互的 AI 浏览器层。结构化数据抽取稳定；更偏"数据抽取"而非完整 Agent 编排。

### 2.2 二手论断核实（框架流派）

| 论断 | 结论 | 来源 |
|---|---|---|
| Browser Use：当前最流行的开源浏览器 Agent 框架 | ✅ 属实（~108k stars、排行榜 #1） | [Scrapfly 2026 盘点](https://scrapfly.io/blog/posts/best-ai-browser-agents) ｜ [GitHub](https://github.com/browser-use/browser-use) |
| Browser Use：核心理念是"观察-决策-执行"循环 | ⚠️ 部分属实（循环范式真实，但该描述非其专属术语） | [GitHub README](https://github.com/browser-use/browser-use) |
| Browser Use：支持多标签、文件上传下载、验证码处理 | ⚠️ 部分属实（多标签支持；文件上传/下载存在但曾有限制；CAPTCHA 破解是**云侧付费**功能，非纯开源） | [CAPTCHA 破解(云)](https://browser-use.com/captcha-solving) ｜ [上传 issue](https://github.com/browser-use/browser-use/issues/136) |
| UI-TARS Desktop（字节）：36K Star | ⚠️ 部分属实（star-history 约 **38.7k**，36K 偏低估） | [star-history](https://www.star-history.com/bytedance/ui-tars-desktop/) ｜ [GitHub](https://github.com/bytedance/ui-tars-desktop) |
| UI-TARS Desktop：视觉语言模型直接理解屏幕、跨应用/桌面自动化、不限浏览器 | ✅ 属实（原生 GUI Agent，UI-TARS/Seed-VL 模型驱动，操作本地桌面软件） | [GitHub README](https://github.com/bytedance/ui-tars-desktop) ｜ [UI-TARS 论文](https://arxiv.org/abs/2501.12326) |
| UI-TARS Desktop：支持 Win/Mac/Linux | ❌ 部分不实（官方 README 列 **Windows/MacOS/Browser**，未列 Linux） | [GitHub README 特性段](https://github.com/bytedance/ui-tars-desktop) |
| Comet（Perplexity）：AI 原生浏览器，搜索与执行深度融合 | ✅ 属实 | [Perplexity Comet](https://www.perplexity.ai/comet) ｜ [USAII 实测](https://www.usaii.org/ai-insights/perplexity-comet-in-action-real-examples-of-ai-browser-assistance) |
| Comet：曾因合规被亚马逊起诉 | ✅ 属实（亚马逊 2025-11 起诉，2026-03 联邦法官签发**临时禁令**禁止抓取亚马逊，案件仍在继续，非终审） | [CNBC 2026-03-10](https://www.cnbc.com/2026/03/10/amazon-wins-court-order-to-block-perplexitys-ai-shopping-agent.html) ｜ [CNBC 起诉 2025-11-04](https://www.cnbc.com/2025/11/04/perplexity-ai-amazon-bullying-comet-browser.html) |
| Comet：使用时需注意目标网站 TOS | ✅ 属实（亚马逊即以"未经授权访问"为由胜诉临时禁令） | 同上 CNBC 来源 |

---

## 3. 🌐 浏览器原生能力（未来趋势）

### 3.1 方案清单与成熟度

- **WebMCP（Web Model Context Protocol）** — Google（Chromium 团队）主导、Microsoft 共写，W3C WebML 社区组（CG）孵化｜[Chrome 文档](https://developer.chrome.com/docs/ai/webmcp) ｜ [Chrome Status](https://chromestatus.com/feature/5117755740913664) ｜ [GitHub 规范库](https://github.com/webmachinelearning/webmcp) ｜ [规范草案](https://webmachinelearning.github.io/webmcp)
  **当前阶段：预览/实验期**——Chrome 146 仅 Dev Trial（`navigator.modelContext` 需 flag），**Origin Trial 149→162**（需网站 opt-in 注册工具）。声明式（HTML 表单注解）+ 命令式（JS）两套 API，暴露结构化工具给 Agent。仅开发者实验通道 + 源试验，仍未正式发布，Firefox/WebKit 均 "No signal"。

- **Chrome Skills（Skills in Chrome）** — Google 官方博客 <https://blog.google/products-and-platforms/products/chrome/skills-in-chrome/>（2026-04-14）
  **当前阶段：已发布（逐步灰度）**。用户级 AI 提示词/工作流保存复用，内置于 Gemini in Chrome，用 `/` 或 `+` 在当前页或所选多个标签页运行，登录设备间同步。仅桌面端（Mac/Windows/ChromeOS）、仅 English-US、须 Gemini in Chrome。**本质为终端用户提示词库，并非面向第三方 Agent 的浏览器协议。**

### 3.2 二手论断核实（原生能力流派）

| 论断 | 结论 | 来源 |
|---|---|---|
| WebMCP：2026-02 Chrome 146 预览版引入官方协议；AI 可经 API 直接调用网页底层功能，效率和准确性远超传统方案；未来终极形态，仍早期 | ⚠️ 部分属实（偏差见下） | [Chrome Status](https://chromestatus.com/feature/5117755740913664) ｜ [WebMCP 文档](https://developer.chrome.com/docs/ai/webmcp) ｜ [VentureBeat](https://venturebeat.com/infrastructure/google-chrome-ships-webmcp-in-early-preview-turning-every-website-into-a) ｜ [discoveredlabs 指南](https://discoveredlabs.com/blog/google-webmcp-explained-the-complete-guide-to-web-model-context-protocol-for-ai-agents)
 偏差：①"Chrome 146 引入"准确（146 为 Dev Trial），但广义可用要等 Origin Trial 149+；②"官方协议"过度宣称——实为 W3C WebML CG **孵化中提案**，非定稿标准；③"效率和准确性远超"为厂商主张，无独立基准。 |
| WebMCP 由 Google + Microsoft 共同开发 | ✅ 属实（背靠二手报道，非 Chrome Status 主页单列） | [VentureBeat](https://venturebeat.com/infrastructure/google-chrome-ships-webmcp-in-early-preview-turning-every-website-into-a) ｜ [discoveredlabs](https://discoveredlabs.com/blog/google-webmcp-explained-the-complete-guide-to-web-model-context-protocol-for-ai-agents) |
| Chrome Skills：2026-04 上线；保存复用 AI 技能模板，跨标签页协作和设备同步；适合个人效率，弱于 MCP | ✅ 属实（"弱于 MCP"为编辑性对比，非官方声明） | [Google 官方博客](https://blog.google/products-and-platforms/products/chrome/skills-in-chrome/) ｜ [fonearena 报道](https://www.fonearena.com/blog/479974/google-chrome-skills-turn-ai-prompts-into-reusable-workflows.html) |

---

## 4. 🛠️ CLI / Skills 工具（解决痛点）

### 4.1 推荐方案清单

- **BrowserAct Skills** — 商业（SaaS）｜<https://github.com/browser-act/skills> ｜ <https://www.browseract.com>
  真实浏览器 + 反爬自动化 CLI。README 逐字列出 stealth fingerprints / TLS rotation / 住宅代理 / CAPTCHA 破解 / 稳定指纹-代理绑定登录态、跨平台人工接管、并发多任务、多账号隔离。强反爬站点采集、多账号运营；缺点是 SaaS 商业、需付费/API key，本地可控性弱。

- **Tencent/BrowserSkill** — 开源（MIT）｜<https://github.com/Tencent/BrowserSkill>
  `bsk` CLI + 浏览器扩展，连接 Chrome/Edge 已有账号；读页、填表、长截图；Agent 窗可见、可显式借用/归还标签。复用用户真实登录态、个人办公自动化；依赖本机浏览器开着，不适合大规模并发爬取。

- **bitsky-tech/bridgic-browser** — 开源｜<https://github.com/bitsky-tech/bridgic-browser>
  基于 Playwright 的 LLM 驱动浏览器自动化库，**67 个 CLI/SDK 工具、默认隐身模式**。

- **browserbase/open-operator** — 开源（云商业）｜<https://github.com/browserbase/open-operator>
  基于 Stagehand + Browserbase 云浏览器构建 Web Agent 的模板。

- **pipeworx-io/mcp-hyperbrowser** — 开源（云商业）｜<https://github.com/pipeworx-io/mcp-hyperbrowser>
  封装 Hyperbrowser「AI Agent 浏览 API」的 MCP（stealth/反爬浏览、抓取、提取）。

- **Claude Code Skills / .claude-plugin** — 开源规范｜MCP 官方仓库 <https://github.com/modelcontextprotocol/modelcontextprotocol> 含 `.claude-plugin/marketplace.json`
  把技能以命令/子代理/agent 形式一键导入 Claude Code 等 Shell-capable Agent。

- **jhh562yy/NmoIAIgenTo** — 开源｜<https://github.com/jhh562yy/NmoIAIgenTo>
  本地优先 Agent 桌面，内置 **VCP 插件生态** + 浏览器网关。

### 4.2 二手论断核实（CLI/Skills 流派）

| 论断 | 结论 | 来源 |
|---|---|---|
| **BrowserAct Skills**：给 Agent 的 CLI，解决反爬/captcha/无 Cookie 痛点，支持指纹伪装、TLS 轮换、人工接管续跑 | ✅ 属实（核心项均证实） | [browser-act/skills README](https://github.com/browser-act/skills)（组织已验证、创建于 2026-01） |
| **Agent Skills Plugin（VCP 生态）**：兼容 Lobster/Claude Skill 生态，一键导入 B站/Excel/PDF 技能包 | ⚠️ 部分属实（VCP 生态 + 兼容 Claude Skill 有真实一手证据；但"一键导入 B站/Excel/PDF 技能包"在公开一手来源未见对应官方清单，留疑） | [VCP: NmoIAIgenTo](https://github.com/jhh562yy/NmoIAIgenTo) ｜ [Claude Skills: MCP 官方仓库](https://github.com/modelcontextprotocol/modelcontextprotocol) ｜ [Lobster 个人 skill](https://github.com/eamanc-lab/openclaw-persona-forge) |
| **（全局）2026-07 MCP 协议更新为无状态版，支持云部署与异步任务，可扩展 Agent 必须选新无状态 MCP 服务器** | ⚠️ 部分属实（`2026-07-28` schema 版本号确凿，无状态化是主流实现部署形态；但"必须迁移"属二手渲染，官方未下强制令） | [MCP 官方仓库 README](https://github.com/modelcontextprotocol/modelcontextprotocol) ｜ [schema 目录](https://github.com/modelcontextprotocol/modelcontextprotocol/tree/main/schema/2026-07-28) ｜ [FastMCP 4 标注](https://github.com/jschuller/mcp-server-servicenow) |

---

## 5. 选型建议（修订版，基于一手复核）

| 你的需求 | 推荐方案 | 理由（复核后） |
|---|---|---|
| 开发/集成到现有 MCP Agent（最稳） | **Playwright MCP** | 微软官方、稳定、文档全、原生接入主流 IDE |
| 调试/读真实登录态页面（最低延迟观测） | **Chrome DevTools MCP**（官方版） | Google 官方接手、v1.10.1 极活跃，取代第三方旧版 |
| 快速搭建浏览器 Agent（社区最大） | **Browser Use** | 生态/文档最成熟；注意 CAPTCHA 破解是付费云能力 |
| 工程化、确定性强的浏览器操作 SDK | **Stagehand** | act/observe/extract 语义 API + 自愈选择器 |
| 复杂表单/数据抽取 | **Skyvern** | LLM+CV 结合，自然语言驱动；注意 AGPL 与 token 成本 |
| 跨应用桌面自动化 | **UI-TARS Desktop** | 视觉理解强，不限浏览器；注意官方列 Win/Mac/Browser（无 Linux） |
| 强反爬/多账号采集 | **BrowserAct Skills** 或 **Hyperbrowser/Stagehand 云 stealth** | 指纹/TLS/代理/人工接管一条龙（BrowserAct 为商业 SaaS） |
| 复用个人真实登录态办公 | **Tencent BrowserSkill** | 用你已登录的 Chrome/Edge，本地开源、免重建 Cookie |
| 追求原生/未来兼容（前瞻） | **WebMCP** | 官方原生方向，但 2026-10 仍实验期、需网站 opt-in，**不可用于生产** |

### 关键风险提示

1. **合规是头号风险**：亚马逊诉 Perplexity（2026-03 临时禁令）确立"AI Agent 未经授权抓取/操作网站可能违法"先例；亚马逊还封锁了数十个 Agent（含 OpenAI ChatGPT）。操作第三方站点前务必评估目标站 TOS 与反爬策略。
2. **"开源框架"与"商业云"是两回事**：Browser Use 核心库开源，但隐身/CAPTCHA/住宅代理是付费云能力；Stagehand 依赖 Browserbase 商业基础设施。选型要把 LLM token + 浏览器托管成本算进去。
3. **WebMCP 被过度宣称**：实为 W3C WebML CG 孵化提案（Firefox/WebKit "No signal"），"官方协议/终极形态/准确率远超"均缺独立基准，2026-10 仅 Dev Trial + Origin Trial。
4. **星数是流动指标、二手数多失真**：Browser Use "11万+"未证实（公开 ~79k–85k）；UI-TARS 实为 ~38.7k（非 36k）；Obscura/Page-Agent 星数因 GitHub API 限流未能独立核实。
5. **营销表述缺一手基准**："视觉+DOM 双模""10x 提速""必须迁移到无状态 MCP"等按宣传语决策风险大；务实选型以官方 benchmark / 自有复现为先。

---

## 6. 调研过程说明

- 采用本仓库 `jxx-research` 自由模式：4 个并行调研子 agent 分流派核查，每个 agent 对其负责的方案与二手论断逐条附一手来源。
- 部分 agent 遇 GitHub REST API 速率限制，星数改用 GitHub 页面 / star-history / 第三方 2026 盘点交叉核对，并在对应单元格标注 ❓。
- 所有 URL 均为已访问并返回真实内容的官方域名或 GitHub 仓库，无虚构链接。"未找到证据"的论断按规则标注 ❌/❓，未臆测补充。
