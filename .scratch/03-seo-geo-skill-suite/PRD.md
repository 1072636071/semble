# seo-geo-skill-suite：SEO/GEO 通用技能族（模板 + 五件套 + 路由器）

Status: ready-for-agent

来源：memorial `docs/memorial/archived/001-seo-geo-skill-templates/`（14 轮 grill、16 项决策、2 份 ADR 已回写为 docs/adr/0005、0006）。

## 问题陈述

营销域（SEO/GEO）技能目前以手工特化方式散落在各项目中（如 official-domestic-website 的 `spz-seo-*` 五件套、`geo-super-geo-agent-readiness`、`news-x`、`news-review`）：英文为主、每开一个项目就要手工复制改造一遍、GEO 能力只存在于个别技能、没有统一的入口与升级路径。仓库需要一个可复用的通用技能族：一次建设，多项目按参数生成使用。

## 解决方案

在 `seo-geo` 桶下建设 8 个通用技能（中文、SEO+GEO 双视角、直写 `SKILL.md`）：**审查模板**与**写作模板**两个 skill-as-generator（追问收集项目参数 → 在项目级生成固定名子技能 `seo-geo-audit` / `blog-writer`，带版本戳与升级模式）、**五件套中文版**（关键词/竞品/外链/内容写作/技术审计，每件内嵌 GEO 维度）、**`seo-router`** 族内路由器（模型可调用，兼任项目内安装器）。整族仅项目级分发：`ship --project` 首次哑拷贝（`x-install: project` 新语义），进场后生命周期由 `seo-router` 管理。

## 用户故事

1. 作为技能仓库维护者，我想要一个 `seo-geo` 桶统一承载营销域技能族，以便工程族与营销族物理分离、一眼可辨。
2. 作为技能仓库维护者，我想要 `seo-` 前缀注册进 `managedPrefixes`，以便 ship 的残留清理覆盖该族、不产生脏目录。
3. 作为技能仓库维护者，我想要 ship 支持 `x-install: project`，以便声明"仅项目级安装"的技能不被装进用户级目录。
4. 作为项目所有者，我想要对新项目执行一次 ship 项目级安装即获得整套 SEO 套件，以便零手工复制开工。
5. 作为项目所有者，我想要套件只装进项目级目录，以便不同项目间版本与参数互不干扰。
6. 作为营销人员，我想要用中文与 SEO 技能交互，以便不用阅读英文提示词。
7. 作为营销人员，我想要每个技能的产出同时覆盖传统搜索（百度/Google/Bing）与 AI 引擎（ChatGPT/Perplexity/豆包/DeepSeek 等）双视角，以便一份劳动两头受益。
8. 作为营销人员，我想要一个 `seo-router` 作为族内统一入口，以便不用记忆 9 个技能名，用自然语言（"帮我查关键词""审查这篇文章""写一篇博客"）即可被路由到正确技能。
9. 作为营销人员，我想要在套件缺失的项目里调用 `seo-router` 时被引导完成安装，以便自助修复环境。
10. 作为项目所有者，我想要审查模板追问收集项目参数（项目代号、域名、语言/地区、目标搜索引擎、目标 AI 引擎、品牌口吻、行业主题域、竞品列表），以便生成的审查子技能贴合本项目。
11. 作为项目所有者，我想要生成固定名 `seo-geo-audit` 子技能，以便跨项目肌肉记忆一致、升级路由逻辑简单。
12. 作为内容运营，我想要写作模板生成固定名 `blog-writer` 子技能，以便按项目口吻与样式规范写博客/资讯。
13. 作为内容运营，我想要写作子技能内置样式模板、审查子技能内置样式一致性检查且两者共用同一样式基准，以便写与审不打架。
14. 作为内容运营，我想要审查子技能覆盖真实性、SEO/GEO、样式一致性三个维度并给出结构化报告与评分，以便发布前把关。
15. 作为营销人员，我想要关键词研究同时产出"搜索词 + 被 AI 引用的问题句式"，以便内容同时命中两类引擎。
16. 作为营销人员，我想要技术审计同时检查传统爬虫可访问性与 llms.txt / JSON-LD / agent readiness，以便技术底座对 AI 友好。
17. 作为项目所有者，我想要子技能 frontmatter 带 `x-template: <模板>@<版本>` 与生成参数快照，以便升级时不必重答所有问题。
18. 作为项目所有者，我想要模板检测到既有子技能时进入升级模式（比对版本、用旧参数重新生成、diff 展示待我确认后覆盖），以便手工微调不被无声吞掉。
19. 作为项目所有者，我想要子技能间以 `Primary next skill` 互链（审查 → 写作 → 五件套），以便工作流自然衔接。
20. 作为营销人员，我想要五件套作为独立技能可被单独调用（如只做外链分析），以便不必每次都走完整审计。
21. 作为技能仓库维护者，我想要 geo-super 的 10 个 references 全量中文化并入审查模板，以便 GEO 论据链（含 ahrefs 实证研究）完整保留。
22. 作为技能仓库维护者，我想要五件套的 GEO 增量素材取自 geo-super 译文，以便同一论据不翻译两次。
23. 作为技能仓库维护者，我想要子技能骨架遵循统一范式（Quick Start + Skill Contract + 数据源表），以便生成物质量稳定。
24. 作为试点用户，我想要在 official-domestic-website 跑通"安装 → 生成 → 使用 → 升级"全流程，以便验证体系后再推广到其他项目。
25. 作为试点用户，我想要旧手工技能（spz-seo-*、geo-super、news-x、news-review）在试用期间保留，以便新旧对比、确认无回归后自行删除。
26. 作为技能仓库维护者，我想要新技能经过 skill-reviewer 合规检查与 skill-tester 触发测试，以便入库质量有门禁。
27. 作为技能仓库维护者，我想要桶 README、安装文档、CHANGELOG 同步更新，以便文档与实现不漂移。

## 实现决策

- **桶与前缀**（D3）：现有大写 `SEO2GEO/` 空桶改名为小写 `seo-geo/`；`vendors.json` 的 `managedPrefixes` 增加 `seo-`；五件套家族命名（`seo-keyword-research` 等），去除 `spz-` 项目代号。
- **生成机制**（D1，ADR 0006）：skill-as-generator。模板被调用时追问收集项目参数，在目标项目项目级技能目录生成静态子技能。否决：运行时配置文件参数化、脚本渲染生成。
- **子技能粒度与命名**（D8/D9）：一模板 → 一子技能；固定名 `seo-geo-audit` / `blog-writer`（项目级隔离，无名字污染，不带项目代号前缀）；子技能内部用路由表按需加载 references。
- **升级机制**（D7）：子技能 frontmatter 写 `x-template: <模板>@<版本>` + 生成参数快照；模板升级模式 = 比对版本 → 用旧参数重新生成 → diff 展示 → 用户确认后覆盖。模板技能 frontmatter 须声明版本号作为版本戳源头。
- **分发模型**（D9/D11/D14，ADR 0005）：整族仅项目级。ship 支持 `x-install: project`（新取值，用户级跳过）；首次进场由 `ship --project` 哑拷贝；进场后参数化生成、升级、缺失修复由项目内 `seo-router` 兼任，不做独立安装脚本。
- **路由器**（D5）：`seo-router` 模型可调用，中英双语触发词覆盖 SEO/GEO/博客/外链/关键词全域意图；路由目标 = 审查模板、写作模板、五件套；检测到项目已有子技能时直接路由去用；检测套件缺失时引导安装。与工程族 `jxx-ask-matt`（用户调用）并列，一族一路由。
- **双视角**（D6）：每个技能输出物同时覆盖 SEO + GEO。五件套中文改造不是纯翻译——每件新增 GEO 维度（关键词研究产出"搜索词 + AI 引用问句式"；技术审计加查 llms.txt/JSON-LD/agent readiness 等）。
- **内容映射**（D12/D13）：审查模板 ← geo-super 全量中文化（SKILL.md + 10 个 references，含 ahrefs 实证研究作 grounding）+ news-review 三维度审查模型；写作模板 ← news-x 抽象（ Astro 项目知识抽象为生成参数）+ spz-seo-content-writing + 样式模板。样式能力写审共享同一基准，不拆分。
- **子技能骨架范式**：参照 news-review 实例结构——Quick Start + Skill Contract（Expected output / Reads / Writes / Done when / Primary next skill）+ 真实路径数据源表；`Primary next skill` 互链（审查 → 写作 → 五件套）。
- **语言规范**：准确第一、中英混杂、术语保留英文（GEO、llms.txt、E-E-A-T 等）、解释用中文；description 与 triggers 中英双语覆盖。
- **单源派生**（D4）：本批技能直写 `SKILL.md` 走原样复制 fallback；派生计划整体暂缓（CONTEXT.md 已标注）。
- **落地顺序**（D15）：基础设施（桶改名 + vendors.json + `x-install: project`）→ 审查模板（geo-super 翻译先行）→ 五件套（GEO 增量取自译文）→ 写作模板 → `seo-router` → 试点。
- **试点**（D15/D16）：official-domestic-website；旧技能保留并存，用户试用确认后自行删除；验收标准之一是模板追问能收集到 news-x 级项目知识（架构事实表、缩略图映射、分类枚举），生成物不得比手工版"笨"。
- **文档同步**：桶 README 增加 `seo-geo/` 条目；安装文档补该族项目级安装说明；ship 与 vendors.json 改动记 CHANGELOG。

## 测试决策

- **Seam（测试接缝）**：优先复用已有接缝——
  1. ship 的 `x-install` 过滤逻辑：在 install/check 子命令层面做行为测试（"标记 `project` 的技能不出现在用户级安装结果中，出现在 `--project` 结果中"），不测内部解析细节。先例：ship 既有子命令的行为验证方式。
  2. 技能触发与路由：用本仓库已有的 `skill-tester` JSON 测试套件对 `seo-router` 与两模板做触发测试（外部行为：给定用户措辞 → 命中正确技能/路由目标）。
  3. 技能合规：用 `skill-reviewer` 对 8 个新技能做结构/命名/frontmatter 合规检查。
  4. 试点端到端：在 official-domestic-website 以真实对话走"安装 → 生成 → 使用 → 升级"，人工验收（对齐 D16 验收标准）。
- 好测试的标准：只断言外部可观察行为（安装了哪些目录、触发了哪个技能、生成的子技能 frontmatter 含版本戳与参数快照），不耦合提示词内部措辞。
- 不新建测试基础设施；无单元测试框架需求（本仓库脚本为零依赖 .mjs，行为测试沿用既有先例）。

## 超出范围

- 单源派生（`SKILL.src.md`）落地——整体暂缓（CONTEXT.md 已标注）。
- official-domestic-website 旧技能的删除——用户试用后自行处理（D16）。
- 其他项目的接入——试点成功后另行规划。
- 五件套英文原版在源项目中的任何改动——中文改造产物在本仓库新建，不动源项目。
- 新增厂商平台接入。

## 补充说明

- 全部决策过程与追问记录见 memorial（已归档）：`docs/memorial/archived/001-seo-geo-skill-templates/`。
- 架构约束：docs/adr/0005（仅项目级分发 + router 兼任安装器）、docs/adr/0006（skill-as-generator + 版本戳升级）；同时遵守 0001（配置驱动）、0002（双模式，但派生暂缓期间仅走 fallback）。
- 风险提示（已在 grill 中披露并被接受）：安装逻辑写在 `seo-router` 提示词中，确定性弱于脚本方案；模板升级覆盖依赖 diff 确认兜底。
- 内容工作量预估：geo-super 全量中文化约 150KB（SKILL.md 19.7KB + 10 references 约 130KB），为最大单项。
