# Keyword Prioritization Framework

按战略价值对关键词进行系统评分的方法。

## Relationship to Opportunity Score

**用哪个分**：初始关键词 triage 与入围用 Priority Score（下文）。最终内容日历排序用 Opportunity Score（主工作流 Step 6）。

## Priority Scoring Matrix

每个关键词按 1-5 评分，再计算加权总分：

| Factor | Weight | Score 1 (Low) | Score 5 (High) |
|--------|--------|---------------|----------------|
| Search Volume | 20% | <100/月 | >9.9.9/月 |
| Keyword Difficulty | 25% | KD >80（难） | KD <20（易） |
| Business Relevance | 30% | 与产品擦边 | 产品核心 |
| Search Intent Match | 15% | 仅 informational | Transactional/commercial |
| Trend Direction | 10% | 下降 | 上升 |

**Priority Score** = Sum(Factor Weight × Score) / 5

## Priority Categories

| Priority | Score Range | Action |
|----------|------------|--------|
| P0 — Must Target | 4.0-5.0 | 立即产出内容 |
| P1 — High Value | 3.0-3.9 | 排入下一内容冲刺 |
| P2 — Opportunity | 2.0-2.9 | 纳入未来内容日历 |
| P3 — Monitor | 1.0-1.9 | 跟踪但不优先 |

## Seasonal Keyword Patterns

| Season Trigger | Example Keywords | Planning Lead Time | Content Strategy |
|---------------|-----------------|-------------------|-----------------|
| 日历事件 | "Black Friday SEO"、"New Year marketing plan" | 提前 3-4 月 | 峰值前 6-8 周发布 |
| 行业事件 | "[Conference] takeaways"、"Google algorithm update" | 提前 1-2 月 / 反应式 | 预备模板、快速反应 |
| 预算周期 | "marketing budget template Q1"、"SEO ROI report" | 提前 2-3 月 | 瞄准规划季（10-12 月） |
| 季节性需求 | "summer marketing ideas"、"holiday email campaigns" | 提前 2-3 月 | 每年用新数据刷新 |
