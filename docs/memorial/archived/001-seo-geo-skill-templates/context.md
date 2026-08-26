# Memorial 001: 整合通用 SEO/GEO 技能体系（模板技能 + 子技能 + 路由）

状态：已完成

> 2026-08-25 收尾，C1–C5 全绿；CONTEXT.md 术语与 docs/adr/0005、0006 已回写。

## 诉求

> 我想整合一些通用技能：
> 一个审查SEO/GEO的技能的模板技能。可以根据不同的项目生成不同的子技能，项目中会使用子技能去做事。
> 一个可以写博客文章的模板技能，可以根据不同的项目生成不同的子技能，项目中会使用子技能去做事。
> E:\work\sp\official-domestic-website\.codebuddy\skills\geo-super-geo-agent-readiness
> E:\work\sp\official-domestic-website\.codebuddy\skills\news-review
> E:\work\sp\official-domestic-website\.codebuddy\skills\news-x
> 下面的这几个，改造中文版，并保证符合哲学：
> E:\work\sp\official-domestic-website\.codebuddy\skills\spz-seo-backlink-analysis
> E:\work\sp\official-domestic-website\.codebuddy\skills\spz-seo-competitor-analysis
> E:\work\sp\official-domestic-website\.codebuddy\skills\spz-seo-content-writing
> E:\work\sp\official-domestic-website\.codebuddy\skills\spz-seo-keyword-research
> E:\work\sp\official-domestic-website\.codebuddy\skills\spz-seo-technical-audit
> 还有一个路由技能作为分发入口。
> 并且所有技能都是支持SEO和GEO能力的。
> 你看看还有什么补充的和问题。

## 追问记录

### 2026-08-25 事实调查（发起前自查）

- **本仓库哲学（CONTEXT.md）**：单源派生（`SKILL.src.md` 一份源、多厂商派生到 `.generated/<vendor>/`）、桶组织（`base/skills/<bucket>/`）、`x-install` 分发开关、`ship` 统一分发、厂商注册表。文档语言规范：准确第一、中英混杂、术语保留英文、简短贴切。
- **现状落差**：`base/skills/` 下目前**没有任何 `SKILL.src.md`**（搜索 0 命中），单源派生规范尚未实际落地，现有技能全是直接 `SKILL.md`。
- **已有空目录**：`base/skills/SEO2GEO/` 存在但为空——疑似此前已规划该桶但未填充。
- **源技能清单**（位于 `official-domestic-website/.codebuddy/skills/`，项目级）：
  - `geo-super-geo-agent-readiness`：英文，GEO+agent readiness 大全套，SKILL.md 19.7KB + 10 个 references（content-strategy/structured-data/ai-crawlers/technical/agent-readiness/platforms/measurement/audit-checklist/templates/ahrefs-studies）。
  - `news-review`：SKILL.md 11.5KB + 3 个 checklist references（真实性/SEO-GEO/风格一致性）。
  - `news-x`：SKILL.md 9.5KB + references/news-images.md + assets/issue-template.md。
  - `spz-seo-*` 五件套：英文，各自 SKILL.md 6~9KB + 3~8 个 references（backlink/competitor/content-writing/keyword-research/technical-audit）。
- **重叠观察**：`spz-seo-technical-audit` 与 `geo-super` 的 audit-checklist/technical-implementation 存在能力重叠；`spz-seo-content-writing` 与博客写作模板、news-x 存在重叠。整合时需要决定归属。

## 决策汇总

1. **生成机制 = skill-as-generator**（2026-08-25）：模板技能本身不直接干活，被调用时追问收集项目参数，在目标项目 `.codebuddy/skills/` 下生成静态子技能；项目日常使用子技能。需配套"重新生成/升级"路径（细节待定）。
   - 附带假设（待确认）：子技能产出落点为**项目级** `.codebuddy/skills/`，不生成到用户级。
2. **五件套中文改造后保留为独立通用技能，模板以 references 指针引用**（2026-08-25）：子技能不自包含，依赖五件套全局安装在场。模板 references 做指针而非复制。
   - 附带假设（待确认）：映射关系——审查模板 ← geo-super + news-review(seo-geo-checklist) + spz 四件；写作模板 ← news-x + news-review(authenticity/style) + spz-content-writing。news-review 拆分归两边。

3. **桶与前缀：启用 `seo-geo/` 桶 + `seo-` 前缀，注册进 managedPrefixes**（2026-08-25）：现有大写 `SEO2GEO/` 空桶改名为小写 `seo-geo/` 对齐桶名风格；`vendors.json` 的 managedPrefixes 增加 `seo-`；五件套中文版用家族命名（`seo-keyword-research` 等），去除 `spz-` 项目代号。

4. **不做单源派生：新技能直写 `SKILL.md`，走原样复制 fallback**（2026-08-25）：派生计划整体暂缓，不是仅本批技能豁免。用户明确要求在相关文档记录此事 → 已在项目全局 `CONTEXT.md` 的「单源派生」词条标注暂缓状态。

5. **路由 = 族内模型可调用路由器**（2026-08-25）：触发词覆盖 SEO/GEO/博客/外链/关键词全域意图，路由到审查模板、写作模板、五件套；项目场景下检测已有子技能并路由去用。与工程族 `jxx-ask-matt`（用户调用）并列，一族一路由。

6. **双视角内嵌：每个技能输出物同时覆盖 SEO + GEO**（2026-08-25）：五件套中文改造不是纯翻译，需为每件新增 GEO 维度（如关键词研究产出"搜索词 + AI 引用问句式"；技术审计加查 llms.txt/JSON-LD/agent readiness）。
   - 附带假设（待确认）：geo-super 并入审查模板时一并中文化，遵循仓库语言规范（准确第一、术语保留英文、解释用中文）。

7. **升级机制 = 版本戳 + 模板内置升级模式**（2026-08-25）：子技能 frontmatter 写 `x-template: <模板名>@<版本>` + 生成参数快照；模板检测到项目已有同族子技能时进入升级模式——比对版本、用旧参数重新生成、diff 展示待用户确认后覆盖，防止手工微调无声丢失。

8. **子技能粒度 = 一模板 → 一子技能**（2026-08-25）：审查模板生成审查子技能、写作模板生成写作子技能，子技能内部用路由表按需加载 references。
9. **⚠️ 全域修正：整套 SEO 技能族只存在于项目级，无任何全局安装**（2026-08-25，用户强调"基本套件也不是全局安装"）：五件套基本能力随整套技能落在各自项目中；因项目级隔离，**名字污染问题不存在，子技能无需 `<项目代号>-` 前缀**。
   - 此决策**修订决策 2**：references 指针不再指向"全局安装的五件套"，而是指向**同项目内的 sibling 五件套**——每个项目自包含。
   - 此决策**收缩决策 3 的语义**：`seo-geo/` 桶 + `seo-` 前缀 + managedPrefixes 仍用于仓库内组织与 ship 生命周期管理，但该族技能的安装目标是**项目级**（ship `--project`），用户级默认不装（`x-install` 语义待细化）。
   - ~~待定：项目代号前缀~~ 已确认：子技能用**固定名** `seo-geo-audit` / `blog-writer`（归属由所在项目目录表达，升级路由逻辑可写死）。
10. **全景架构确认 + 专用项目级安装工具**（2026-08-25）：Q9 全景图用户确认无误；新增需求——为 SEO 套件做**专门的项目级安装工具**（不走通用 ship --project）。
11. **安装工具形态 = 路由技能本身兼任**（2026-08-25，用户指示"单纯路由技能就行了"）：`seo-router` 在项目中被调用时检测套件缺失 → 引导安装/生成；不做独立安装脚本。已提示风险：安装逻辑写成技能提示词确定性较差，用户接受该取舍。

### 2026-08-25 补充事实调查（news-x / news-review 细读）

- **news-x 本质就是"写作子技能"的一个已生成实例**：深绑 official-domestic-website 的 Astro Content Collection 架构（`src/content/news/{category}/{slug}.md`、NewsSchema frontmatter 契约、prose-body 渲染约定、分类枚举）。验证了 skill-as-generator 模式的可行性——模板要做的是把这类项目架构事实抽象成生成参数。
- **news-review 本质就是"审查子技能"实例**：三维度审查（真实性/SEO-GEO/风格一致性）+ Skill Contract 块（Expected output / Reads / Writes / Done when / Primary next skill）+ Quick Start + 真实路径数据源表。**它的结构可作为生成子技能的骨架范式**。
- news-review 的 `Primary next skill` 字段指向 `news-x` 和 `spz-seo-content-writing`——子技能间互链已有先例，新体系应保留此约定（审查子技能 → 写作子技能 → 五件套）。

12. **geo-super 全量吸收中文化**（2026-08-25）：10 个 references + SKILL.md 全部翻译并入审查模板，术语保留英文、解释中文。
13. **⚠️ 修订决策 2 的映射假设：news-review 不拆分，审查保持全维度**（2026-08-25）：审查子技能三维度齐全（真实性 + SEO/GEO + **样式一致性**）；写作侧同样内置**样式模板**，写与审共用同一套样式基准保持一致。即样式能力是**写审共享**，不是归某一边。

14. **Bootstrap = ship `--project` 首次哑拷贝 + `x-install: project` 新语义 + router 管进场后生命周期**（2026-08-25）：ship 对该族只做项目级文件复制（不装用户级）；`x-install` 增加 `project` 取值（ship 小改动点）；进场后参数化生成、升级、缺失修复由项目内 `seo-router` 完成。决策 9 的"x-install 语义待细化"由此闭环。

15. **落地顺序：基础设施 → 审查模板（geo-super 全量中文化先行）→ 五件套（GEO 增量取自 geo-super 译文，避免二次翻译）→ 写作模板 → seo-router → 试点**（2026-08-25）。
   - 附带假设（待确认）：试点项目 = `official-domestic-website`，与已有手工版技能对比验证。

16. **旧技能处置：先保留，用户试用新体系无问题后自行删除**（2026-08-25）：试点阶段新旧并存于 `official-domestic-website`；模板追问设计需确保能收集到 news-x 级的项目知识（Astro 架构事实、thumbs 映射、分类枚举），否则生成物会比手工版"笨"——列为试点验收标准之一。

## 待澄清

（无）
