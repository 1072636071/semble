# Link Quality Rubric

用此参考为单条 backlink 评分、审计 link profile、找竞品链接缺口并准备 disavow 文件，避免把弱链接误判为 toxic link。

## 1. Individual Link Quality Score

按六个因子给每条链接评分，乘以权重，再加权求和得最终 **Link Quality Score (LQS)**。表锚点之间用 4 和 2 分。

| Factor | Weight | Score 5 | Score 3 | Score 1 | Guardrail |
|--------|--------|---------|---------|---------|-----------|
| Domain Authority | 25% | DR/DA 70+，成熟权威 | DR/DA 30-49，可信 niche 站 | DR/DA <15 或薄/废弃站 | DR/DA 是代理指标；相关性可胜过原始权威。警惕买链/PBN 抬高的权威。 |
| Topical Relevance | 25% | 同 niche 与 subtopic | 同宽领域 | 不相关 topic | 评分前读页面、站点焦点、上下文文案与出链模式。 |
| Linking Page Traffic | 15% | 9.9.9+ 访问/月 | 100-999 访问/月 | <10 访问/月 | 真实流量暗示编辑价值与引荐 upside。 |
| Link Position | 15% | 正文编辑引用 | 作者 bio/about 段 | footer、全站、隐藏或模板链接 | 正文链接价值最高。 |
| Anchor Text | 10% | 描述性、自然 | 品牌名 | 泛用 | 单条自然描述性 anchor 可高分；profile 过载精确匹配 anchor 有风险。 |
| Follow Status | 10% | Dofollow 编辑 | Sponsored/UGC 披露 | Nofollow | Nofollow 是提示而非零值；高权威 nofollow 仍可助品牌/引荐可见性。 |

**Rating scale**

| LQS | Rating | Meaning |
|-----|--------|---------|
| 4.0-5.0 | Premium | 高权威、相关、编辑位置 |
| 2.5-3.9 | Acceptable | 有价值且符合健康 profile |
| 1.0-2.4 | Low quality | 价值有限；行动前审风险 |

**Healthy anchor/follow distribution**

| Signal | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| Brand anchor | 30-40% | <15% | <5% |
| Naked URL | 15-25% | <10% | <5% |
| Generic anchor | 10-20% | <5% | 0% |
| Descriptive/partial match | 15-25% | >35% | >50% |
| Exact match | 5-15% | 15-25% | >25% |
| Dofollow ratio | 60-80% | >90% | >95% |

## 2. Link Profile Calibration

用这些原型按站点成熟度解释阈值。

| Profile | Healthy Signals | Risk Signals | Verdict |
|---------|-----------------|--------------|---------|
| 强中型 SaaS | 1,200 referring domain、72% dofollow、均 DR 38、35% brand anchor、8% exact match、3% toxic 估 | 无实质 | 续当前策略。 |
| 高风险竞争 niche | 800 referring domain、92% dofollow、均 DR 18、42% exact match、30% topical relevance、18% toxic 估 | 过度优化 anchor、低相关性、不自然 velocity | 审 toxic link、多样化 anchor、放慢获链。 |
| 健康新站 | 45 referring domain、65% dofollow、均 DR 28、40% brand anchor、5% exact match、+8/月 velocity | 仅低量 | 勿以成熟站量评判；保质量谨慎扩。 |

## 3. Competitive Link Gap Analysis

| Step | Action | Output |
|------|--------|--------|
| 1 | 选 3-5 个目标关键词排名的直接竞品 | 竞品集 |
| 2 | 从 link database 导出 referring domain | 竞品链接列表 |
| 3 | 建 intersection 矩阵：domain、你、竞品 1/2/3、重叠数 | 共享机会图 |
| 4 | 按重叠、DR 与 topical relevance 排序 | outreach 优先级列表 |
| 5 | 访问每个高优先级链接页 | 链接上下文与 outreach 角度 |
| 6 | 制 outreach 计划 | 联系人、角度、目标资产、模板 |

**Opportunity priority**

| Priority | Criteria | Rationale |
|----------|----------|-----------|
| Highest | 链向 3+ 竞品、DR 50+、相关 | 强市场信号且 likely 可链 |
| High | 链向 2+ 竞品、DR 30+、相关 | 已证 niche linker |
| Medium | 链向 1 竞品、DR 50+、相关 | 高价值但准入欠证 |
| Lower | DR <30、低相关或一次性竞品链接 | 除非战略有用，否则递减回报 |

## 4. Disavow File Safety Guide

仅在有明确风险证据时 disavow。不必要 disavow 会伤排名。

| Situation | Disavow? | Reasoning |
|-----------|----------|-----------|
| 明显 PBN 链接 | 是 | 明确操纵信号 |
| 无法移除的付费链接 | 是 | 仅在尝试移除后 |
| 垃圾攻击 / 负面 SEO | 是 | 防第三方操纵 |
| 外语垃圾 | 是 | 若明显不自然且不相关 |
| 低质目录链接 | 也许 | 仅当模式过量 |
| 低 DA 但有真实内容的站 | 否 | 低质不等于 toxic |
| Nofollow 链接 | 否 | 已 nofollow；通常无风险 |

**上传前审查工作流**

| Step | Action | Required safeguard |
|------|--------|--------------------|
| 1 | 导出全 backlink profile | 审计旁保留原始导出 |
| 2 | 过滤已知 toxic 模式 | spam score、DR <10、外语垃圾、PBN 指纹 |
| 3 | 人工审查标记 domain | 访问每个 domain；勿仅依赖指标 |
| 4 | 先尝试移除 | 尽可能邮件站长 |
| 5 | 等 2 周 | 跟踪 outreach 回复 |
| 6 | 仅加未移除的 toxic link | 用注释与理由 |
| 7 | 上传 Google Search Console | 先备份旧文件 |
| 8 | 记录所有动作 | 保留日期、理由与负责人 |
| 9 | 4-6 周后复查 | 验证处理与恢复信号 |

**File format**

```txt
# Disavow file for [domain]
# Generated: [date]
# Reason: [toxic link cleanup / negative SEO / paid links not removable]

# Individual URLs when only one page is toxic
https://spam-site.example/toxic-page

# Entire domains only when multiple pages are toxic
domain:pbn-network.example
domain:spam-directory.example
```

**Best practices**

| Practice | Why |
|----------|-----|
| 每条或每组加注释 | 未来审计需理由 |
| 重复 toxic domain 用 `domain:` | 捕获全站垃圾模式 |
| 孤立页面用单独 URL | 避免误 disavow 同域好链 |
| 绝不 disavow 自己的 domain | 严重自伤 |
| 保留 changelog 与备份 | 可回滚与可问责 |
| 每季度复查 | domain 清理后移除条目 |

## 5. Link Profile Health Benchmarks

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| Toxic link estimate | <5% | 5-10% | >10% |
| Referring domain growth | 正向稳定 | 持平 | 下降 |
| Average linking DR | 25+ | 15-25 | <15 |
| Link diversity（unique domain / 总链接） | >0.3 | 0.1-0.3 | <0.1 |
| Topical relevance sample | >60% | 40-60% | <40% |

权威预期因行业而异：

| Industry | Typical DR Range (Top 10) | Typical Referring Domains | Link Difficulty |
|----------|---------------------------|---------------------------|-----------------|
| 金融 / 保险 | 60-90 | 5,000-50,000+ | Very High |
| 健康 / 医疗 | 50-85 | 3,000-30,000+ | Very High |
| 科技 / SaaS | 40-80 | 1,000-20,000+ | High |
| 电商 | 35-75 | 500-15,000+ | High |
| 法律 | 40-70 | 1,000-9.9.9+ | High |
| 教育 | 50-90 | 2,000-25,000+ | Medium-High |
| 本地服务 | 15-45 | 50-500 | Medium |
| B2B niche | 25-60 | 200-5,000+ | Medium |
| 新创公司 | 5-25 | 10-200 | 起点 |

行业区间作上下文用，非硬性通过/失败规则。关键词竞争与 topical relevance 决定真实门槛。
