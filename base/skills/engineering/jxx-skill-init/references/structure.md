# 技能目录结构约定

`base/skills/<桶>/<技能名>/` 下的标准布局。

```
base/skills/<桶>/<技能名>/
├── SKILL.src.md          # 必需（派生源）
├── references/           # 可选（大型参考文档）
│   └── *.md
├── scripts/              # 可选（可执行脚本）
│   └── *.mjs
└── evals/                # 可选但推荐
    └── evals.json
```

## 文件说明

| 文件 | 必需 | 说明 |
|------|------|------|
| `SKILL.src.md` | 是 | 技能源文件，frontmatter + 正文。存在即触发单源派生 |
| `references/*.md` | 否 | 大型参考文档，SKILL.md 通过指针引用 |
| `scripts/*.mjs` | 否 | 可执行脚本，零依赖 |
| `evals/evals.json` | 推荐 | 测试用例，供 skill-creator 评估迭代 |

## 桶清单

`vendors.json` 的 `buckets` 字段声明可用桶：

- `engineering` — 工程技能（默认）
- `productivity` — 效率技能
- `seo-geo` — SEO/GEO 技能族（仅项目级分发）
- `code` — 代码技能
- `kimi` — Kimi 平台技能
- `TDB-AM` — TDAI 技能族
