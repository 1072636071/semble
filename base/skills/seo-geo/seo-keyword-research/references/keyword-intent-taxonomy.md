# Keyword Intent Taxonomy

将每个关键词按 **4 种主要 intent 类型** 分类，再映射到内容格式、漏斗阶段、CTA 与转化预期。最终 intent 应对照 live SERP 验证（可得时）。

## Primary Intent Matrix

| Intent | User goal | Sub-categories | Signal words | Best formats | Typical length |
|--------|-----------|----------------|--------------|--------------|----------------|
| Informational | 学点什么 | educational、instructional、exploratory、troubleshooting | what、how、why、guide、tutorial、examples、tips、definition、checklist、steps、pros and cons | explainer、tutorial、listicle、FAQ、debug guide | 依深度 800-4,000 词 |
| Navigational | 找已知站点/资源 | brand search、product/feature search、login/access、support/docs | brand name、login、sign in、pricing、support、help、docs、official、download | 首页、产品页、docs、support、branded landing page | 尽可能短 |
| Commercial investigation | 购买前调研 | comparison、review-seeking、best-of、evaluation | best、top、vs、comparison、review、alternative、worth it、features、pricing、cost、for [audience] | X vs Y、review、buying guide、ranked roundup、calculator | 2,000-5,000 词 |
| Transactional | 完成动作 | purchase、signup/trial、download、hire/engage | buy、purchase、price、discount、coupon、free trial、demo、signup、download、hire、book、near me | pricing 页、landing 页、signup 页、本地服务页 | 以转化为焦点 |

## Sub-Category Examples

| Intent | Sub-category | Query examples |
|--------|--------------|----------------|
| Informational | Educational | `what is SEO`、`content marketing explained` |
| Informational | Instructional | `how to set up Google Analytics`、`how to do keyword research` |
| Informational | Troubleshooting | `why is my site not ranking`、`404 error fix` |
| Navigational | Brand/product | `Ahrefs`、`GSC coverage report`、`Ahrefs API documentation` |
| Commercial | Comparison | `Ahrefs vs Semrush`、`WordPress vs Squarespace for SEO` |
| Commercial | Best-of | `best SEO tools`、`top keyword research tools` |
| Transactional | Purchase/signup | `buy Ahrefs subscription`、`Semrush pricing plans`、`SEO agency near me` |

## Funnel Mapping

| Funnel stage | Dominant intent | Content goal | Typical CTA | Conversion potential |
|--------------|-----------------|--------------|-------------|----------------------|
| Awareness | Informational | 吸引并教育 | Newsletter、相关 guide | 0.5-2% |
| Interest | Informational | 加深参与 | Download、webinar、内部 guide | 0.5-2% |
| Consideration | Commercial | 建立偏好 | Comparison、free trial、demo | 2-5% |
| Evaluation | Commercial | 克服异议 | Demo、case study、ROI calculator | 2-5% |
| Decision | Transactional | 转化 | Buy、subscribe、hire、book | 5-15% |
| Retention | Navigational | 支持与留存 | Login、docs、feature access | 已参与 |

## Mixed Intent Handling

| Query pattern | Primary | Secondary | Content strategy |
|---------------|---------|-----------|------------------|
| `best [product] for [use case]` | Commercial | Informational | 带教育语境的 buying guide |
| `how to [task] with [product]` | Informational | Navigational | 含产品专属步骤的 tutorial |
| `[product] review and pricing` | Commercial | Transactional | Review + 明确 pricing CTA |
| `what is [concept] tools` | Informational | Commercial | 过渡到工具选项的 explainer |

混合 intent 规则：先答主导问题，自然桥接次要 intent，镜像 SERP 格式，并按读者就绪度分段 CTA。

## Classification Process

1. 字面读查询：用户想做什么？
2. 将 signal words 匹配到 intent 矩阵。
3. 可得时对照 live SERP；视其为 ground truth。
4. 选定 primary intent 与 sub-category。
5. 记下任何次要 intent。
6. 选内容格式与目标深度。
7. 映射漏斗阶段与 CTA。
8. 设定转化预期。

## Common Mistakes

| Mistake | Example | Correct handling |
|---------|---------|------------------|
| 把所有 `best` 查询当 informational | `best CRM software` | Commercial investigation |
| 把所有问题当 informational | `how much does Ahrefs cost` | Commercial 或 transactional |
| 忽略本地 intent | `SEO services` | Transactional/local |
| 漏掉 navigational intent | `HubSpot blog` | Navigational |
| 假设单一 intent | `SEO tools` | 混合；对照 SERP 验证 |
