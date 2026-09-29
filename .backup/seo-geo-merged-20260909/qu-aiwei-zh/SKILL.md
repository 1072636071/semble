---
name: qu-aiwei-zh
version: 1.0.0
display_name: 去AI味·中文
display_name_en: De-AI-Flavor ZH
description_zh: |
  中文文档去 AI 味三合一技能：检测 + 量化评分 + 改写建议。
  专门覆盖中文官方腔、模板口水、营销黑话、模糊归因、伪深度、结尾升华等中文 AI 写作特征。
  含纯 stdlib 检测脚本（无需联网、无需第三方依赖），可单文件扫描、管道集成或批量处理。
  适用于公众号、小红书、知乎、工作汇报、产品文案等中文场景。
description_en: |
  Chinese document AI-flavor removal skill: three-in-one detection + quantitative scoring + rewrite suggestions.
  Specifically covers Chinese AI writing tells: officialese, template phrasing, internet buzzwords, vague attribution, fake depth, grandiose endings.
  Bundles a pure-stdlib scanner script (no network, no third-party deps), supports single-file scan, pipe integration, or batch processing.
  Designed for WeChat articles, Xiaohongshu, Zhihu, work reports, product copy, and other Chinese-language scenarios.
  Trigger when user asks to "remove AI flavor", "make it sound human", "humanize", "去掉 AI 味", "改得像人写的", "人话化", "去掉机器味", or "优化文案".
description: |
  中文文档去 AI 味技能。检测 + 改写 + 量化评分三合一，专门针对中文场景（公众号/小红书/知乎/工作汇报/产品文案）。
  覆盖官方腔、互联网黑话、模板口水、模糊归因、伪深度、结尾升华等中文 AI 写作特征。
  含纯 stdlib 检测脚本（无需联网、无需第三方依赖），可单文件检测、批量扫描或管道集成。
  应在用户要求"去掉 AI 味"、"AI 味太重"、"改得像人写的"、"人话化"、"去掉机器味"、"优化文案"时触发。
agent_created: true
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - AskUserQuestion
metadata:
  trigger:
    - 去掉 AI 味
    - AI 味太重
    - 改得像人写的
    - 人话化
    - 优化文案
    - 检测 AI 味
    - 改写机器文
    - 去除机器味
  source: 基于 Wikipedia:Signs of AI writing 增强版 + 中文特色模式库
---

# Qu-Aiwei-ZH · 中文文档去 AI 味

> **定位：** 三合一工具 = 中文 AI 味检测 + 量化评分 + 改写建议。区别于 `humanizer-zh`（更偏直译英文版），本技能专门覆盖中文官方腔、互联网黑话、模板口水、四字成语串等中文特色场景。

---

## 何时使用本技能

用户的中文文档/文案**读起来像机器写的**，要求：
- **"去掉 AI 味"、"像人写的"、"人话化"** → 全流程处理
- **"测一下 AI 味指数"、"打个分"** → 检测 + 评分（不改写）
- **"改改这段"、"改得不那么机器"** → 改写 + 复评

---

## 工作流程

```
1. 扫描 → 2. 定位 → 3. 评分 → 4. 改写 → 5. 复评
```

### Step 1：扫描（自动化）

```bash
# 单文件：输出 Markdown 报告到 stdout
python3 scripts/scan_ai_flavor.py article.md

# 输出 JSON 供程序处理
python3 scripts/scan_ai_flavor.py --json article.md

# 写入文件
python3 scripts/scan_ai_flavor.py article.md -o report.md

# 管道输入
cat article.md | python3 scripts/scan_ai_flavor.py -
```

### Step 2：定位（自动）

报告里会列出每个命中的：
- **类别**（A1-A10）
- **命中内容**（截断预览）
- **行号**
- **严重度**（high/mid/low）
- **扣分**

按扣分从高到低排序，优先改 Top 3。

### Step 3：评分（自动）

- **总分：** 0-100，**100 分 = 完全人话**
- **分项：** 词面命中扣分 + 结构问题扣分
- **等级：**
  - 🟢 85-100 人话
  - 🟡 70-84 微 AI 味
  - 🟠 50-69 中度 AI 味
  - 🔴 30-49 重度 AI 味
  - ⚫ 0-29 完全 AI 体

详细算法见 `references/scoring-rubric.md`。

### Step 4：改写（人工/模型）

按优先级处理：

1. **结尾段**（A4）—— 影响最大，最容易识别
2. **官腔形容词**（A3）—— 砍掉"高度重视""深入推进"等
3. **营销黑话**（A6）—— "赋能""抓手""底层逻辑"换成大白话
4. **开头套话**（A1）—— "在当今社会""众所周知"等模板开头
5. **模糊归因**（A7）—— "专家指出""研究表明"换具体出处
6. **伪深度**（A8）—— "是 XX 的体现/象征"删掉

每个类别的具体词库和 before/after 改写范例：**`references/zh-patterns.md`**

完整对照范例：**`assets/example-diff.md`**

### Step 5：复评（自动）

改写后再跑一次扫描脚本，分数应该提升。如果没提升，说明改写没到位，回头检查 Top 3 建议项。

---

## 触发后立即做什么

1. **收到用户文本/文件**，先确认是纯文本还是 Markdown/Word。Word 格式转 .txt 再扫描。
3. **如有文件路径** → 直接跑 `python3 scripts/scan_ai_flavor.py <file>`
4. **如果是粘贴的文本** → 写入临时文件再扫描
5. **输出报告 + 给出 Top 3 改写建议**
6. **改写示例（人工 + 模型）** —— 实际改写时，对照 `references/zh-patterns.md` 的 before/after
7. **改写后跑一次扫描确认**

---

## 关键原则

**改写不只是删词，是要"有声音"。** 一篇删完 AI 套话但依然没声音的文章 = 从"AI 体"变成"新闻通稿"——同样没人味。

参考 `assets/example-diff.md` 中"改写后"的部分，对照"声音"指标：

- 有"我"、有"我们"、有具体场景
- 有具体数字、时间、人名、产品名
- 有不确定性表达（"其实"、"不过"、"还在想"）
- 有节奏变化（不是每句 18 字）
- 有真实细节（不是"很多人"、"大多数"）

---

## 输出模板（每次使用都要按这个格式回复）

```markdown
## AI 味检测报告

**总分：** XX / 100  <emoji> <等级>

### Top 3 命中
| # | 类别 | 命中 | 位置 | 扣分 |
|---|---|---|---|---|
| 1 | A4 结尾升华 | `让我们共同…` | 第 N 段 | -X |
| 2 | ... | | | |
| 3 | ... | | | |

### 改写建议
1. [具体改法，参考 zh-patterns.md 类别]
2. ...
3. ...

### 改写后（可直接替换原文）
> 改写后的文本……

### 复评
（重跑扫描脚本，分数提升到 XX）
```

---

## 与 humanizer-zh 的差异

| 维度 | humanizer-zh | qu-aiwei-zh（本技能） |
|---|---|---|
| 语言 | 中英混合 | **纯中文** |
| 工作流 | 检测 + 改写 | **检测 + 评分 + 改写 + 复评** |
| 自动化 | 无 | **含扫描脚本** |
| 中文特色 | 部分翻译英文指南 | **独立中文模式库**（官方腔/黑话/成语串） |
| 量化评分 | 1-10 五维 | **0-100 总分 + 五级** |

**建议并存：** 改写时两个 skill 都加载。本技能负责"扫描打分 + 定位 + 触发人工/模型改写"，`humanizer-zh` 负责"提供英文版的改写思路参考"。

---

## 资源清单

- **`scripts/scan_ai_flavor.py`** —— 检测脚本（纯 stdlib，无第三方依赖）
- **`references/zh-patterns.md`** —— 中文 AI 模式词库（A1-A10 + B1-B7）
- **`references/scoring-rubric.md`** —— 评分算法与等级表
- **`assets/example-diff.md`** —— 改写前后对照范例（4 个真实场景）

---

## 适用范围 vs 不适用

**适用：**
- 公众号文章、产品文案、工作汇报、技术博客
- 知乎/小红书/微博长文
- 新闻稿、学术摘要（轻量润色）

**不适用：**
- 文学创作（需要保留作者风格）
- 学术论文（术语格式有规范）
- 法律文书（用词需严谨）
- 翻译稿（保留原文结构优先）