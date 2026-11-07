# 项目技能目录

本目录是**本仓项目技能的唯一存放处**：一个技能一个子目录，目录名即技能名，入口文件是 `SKILL.md`。

## 目录约定

```
docs/agents/skills/
├── README.md        ← 本文件（生成部分由 jxx-setup-skills 维护）
└── <skill-name>/
    ├── SKILL.md      ← 必需。frontmatter 至少写 name + description
    ├── references/   ← 可选。较长的参考资料，按需再拆子文档
    ├── scripts/      ← 可选。零依赖脚本（Node/Python）
    └── assets/       ← 可选。模板、图片等素材
```

- `SKILL.md` 的 frontmatter `name` 必须与目录名一致；`description` 写「什么时候加载这个技能」，它会进 `AGENTS.md` 的技能清单。
- 技能之间用相对本目录的路径互相引用（如 `../<skill-name>/references/playbook.md`），保证整目录可整体拷走。
- 一个子目录里没有 `SKILL.md` 就不是技能（如只放 `references/` 的辅助目录会被忽略）。

## 当前技能

| 技能 | 何时加载 |
| --- | --- |
| `tool-intro` | 记录并介绍开发工具（GitHub 项目），生成中文工具档案与 HTML 汇总页 |

## 改动后必须同步清单

新增、删除或改动任一技能后，重跑：

```bash
node <jxx-setup-skills 目录>/scripts/setup.mjs sync-skills --root <仓库根>
```

它重新扫描本目录，重写 `AGENTS.md` 里 `### 项目技能` 小节中标记之间的表格（下方分界标记之后的手写内容不会被覆盖），并把 `AGENTS.md` 逐字节同步到 `CODEBUDDY.md`。

<!-- jxx-setup-skills:hand-written -->
