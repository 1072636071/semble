---
name: jxx-scaffold-exercises
description: 创建包含 sections、problems、solutions、explainers 且通过 lint 的练习目录结构（scaffold exercises）。当用户想要搭建练习骨架（stub）或设置新的 course section 时使用。
metadata:
  version: 1.0.0
---

# 脚手架练习

创建能通过 `pnpm ai-hero-cli internal lint` 的练习目录结构，然后执行 `git commit`。

## 目录命名

- **章节**：`exercises/` 内的 `XX-section-name/`（例如 `01-retrieval-skill-building`）
- **练习**：章节内的 `XX.YY-exercise-name/`（例如 `01.03-retrieval-with-bm25`）
- 章节编号 = `XX`，练习编号 = `XX.YY`
- 名称使用 dash-case（小写、连字符）

## 练习变体

每个练习至少需要以下子文件夹之一：

- `problem/` — 学生工作区，含 TODO
- `solution/` — 参考实现
- `explainer/` — 概念材料，无 TODO

创建骨架时，默认使用 `explainer/`，除非计划中另有指定。

## 必需文件

每个子文件夹（`problem/`、`solution/`、`explainer/`）需要一个 `readme.md`：

- **不可为空**（必须有实际内容，即使只有一行标题也行）
- 不能有损坏的链接

创建骨架时，生成一个包含标题和描述的最简 readme：

```md
# Exercise Title

Description here
```

如果子文件夹有代码，还需要一个 `main.ts`（>1 行）。骨架阶段允许仅有 readme。

## 工作流

1. **解析计划** — 提取章节名称、练习名称和变体类型
2. **创建目录** — 为每个路径执行 `mkdir -p`
3. **创建 readme 骨架** — 每个变体文件夹一个 `readme.md`，包含标题
4. **运行 lint** — `pnpm ai-hero-cli internal lint` 验证
5. **修复错误** — 迭代直到 lint 通过

## Lint 规则摘要

linter（`pnpm ai-hero-cli internal lint`）检查：

- 每个练习有子文件夹（`problem/`、`solution/`、`explainer/`）
- `problem/`、`explainer/` 或 `explainer.1/` 至少存在一个
- 主子文件夹中 `readme.md` 存在且非空
- 没有 `.gitkeep` 文件
- 没有 `speaker-notes.md` 文件
- readme 中没有损坏的链接
- readme 中没有 `pnpm run exercise` 命令
- 每个子文件夹需要 `main.ts`，除非是仅 readme 的练习

## 移动/重命名练习

重新编号或移动练习时：

1. 使用 `git mv`（而非 `mv`）重命名目录 — 保留 git 历史
2. 更新数字前缀以维持顺序
3. 移动后重新运行 lint

示例：

```bash
git mv exercises/01-retrieval/01.03-embeddings exercises/01-retrieval/01.04-embeddings
```

## 示例：从计划创建骨架

给定如下计划：

```
Section 05: Memory Skill Building
- 05.01 Introduction to Memory
- 05.02 Short-term Memory (explainer + problem + solution)
- 05.03 Long-term Memory
```

创建：

```bash
mkdir -p exercises/05-memory-skill-building/05.01-introduction-to-memory/explainer
mkdir -p exercises/05-memory-skill-building/05.02-short-term-memory/{explainer,problem,solution}
mkdir -p exercises/05-memory-skill-building/05.03-long-term-memory/explainer
```

然后创建 readme 骨架：

```
exercises/05-memory-skill-building/05.01-introduction-to-memory/explainer/readme.md -> "# Introduction to Memory"
exercises/05-memory-skill-building/05.02-short-term-memory/explainer/readme.md -> "# Short-term Memory"
exercises/05-memory-skill-building/05.02-short-term-memory/problem/readme.md -> "# Short-term Memory"
exercises/05-memory-skill-building/05.02-short-term-memory/solution/readme.md -> "# Short-term Memory"
exercises/05-memory-skill-building/05.03-long-term-memory/explainer/readme.md -> "# Long-term Memory"
```
