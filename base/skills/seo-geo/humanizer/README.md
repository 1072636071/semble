# Humanizer · 去 AI 味

中英双语的 AI 写作痕迹去除技能。融合自 `humanizer`、`humanizer-zh`、`qu-aiwei-zh`、`de-ai-flavor` 四个技能，统一为**一个流程、一套评分**。

## 三阶段

| 阶段 | 做什么 | 谁做 |
|---|---|---|
| 1 扫描 | 词面 + 结构模式检测，0-100 打分 | 脚本自动 + 模型语义判断 |
| 2 改写 | 砍套话、换具体、注入声音 | 模型 |
| 3 验收 | 复评，分数必须上涨 | 脚本 + 模型 |

## 和融合前的差异

| 维度 | 融合前 | 融合后 |
|---|---|---|
| 技能数 | 4 个，触发词互相打架 | 1 个 |
| 语言 | 中/英各管一半，需双加载 | 中英一套词库，自动识别 |
| 评分 | 两套（0-100 脚本分 / 5 维 50 分人工分） | 单一 0-100，脚本 + 模型叠加 |
| 脚本 | 只扫中文，无类别封顶 | 中英都扫，类别封顶防爆分 |
| 交付线 | 各自不同 | 统一 70 分 |

## 目录

```
humanizer/
├── SKILL.md                      # 主入口：铁律、路由、三阶段、输出模板
├── README.md
├── scripts/scan_ai_flavor.py     # 检测脚本（纯 stdlib，无依赖）
├── references/
│   ├── patterns-zh.md            # 中文模式库 A1-A10（词面）+ B1-B7（语义）
│   ├── patterns-en.md            # 英文模式库 E1-E21 + F1-F7
│   └── scoring.md                # 评分算法、等级、JSON 结构
└── assets/examples.md            # 中英改写前后对照
```

## 用法

```bash
python3 scripts/scan_ai_flavor.py article.md          # Markdown 报告
python3 scripts/scan_ai_flavor.py --json article.md   # JSON
python3 scripts/scan_ai_flavor.py article.md -o r.md  # 写文件
cat article.md | python3 scripts/scan_ai_flavor.py -  # 管道
```

或直接跟 agent 说：去AI味 / 人话化 / 检测AI味 / humanize this。

## 触发词

去AI味 · 降AI味 · AI味太重 · 人话化 · 改得像人写的 · 去掉机器味 · AI痕迹 · 检测AI味 · AI味指数 · 优化文案
humanize · remove AI writing · sound more human · make this less robotic

## 不适用

通用润色、翻译、语法检查、风格改写、缩写扩写。

## 来源

基于 [Wikipedia:Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing)（WikiProject AI Cleanup），叠加中文场景独立模式库（官腔八股、互联网黑话、模板口水、结尾升华、假大空成语串）。
