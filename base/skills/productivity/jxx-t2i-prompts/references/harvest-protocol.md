# 沉淀协议

好模板只有被写下来才算数。什么时候收、写成什么样、写到哪里，三件事定死。

## 什么时候收

满足任一即收：

- 用户说「这张好」「记住这个」「以后都按这个来」。
- 同一提示词连出 3 张以上可用图（自己数，不猜）。
- 用户改了你的稿，改完效果明显更好——收**用户改后的版本**，不是你原来的。
- 从外部搜到成熟模板，且你已验证可跑。

不收：一次性效果、未验证的转述、平台已废弃语法的老模板。

## 写成什么样

一条模板 = 一个 markdown 文件，字段固定（脚本按此校验）：

```
---
id: portrait-guofeng-3d          # kebab-case，与文件名一致
name: 3D 写实国风美女             # 人读名字
category: portrait               # portrait|character|product|scene|illustration|poster|other
tags: [国风, 3d, cg, 美女]        # 检索用，3-6 个
source: 用户提供 / <URL>          # 出处，编的不算
verified: 2026-10-21             # 你亲手跑通/用户认可的日期
quality: 4                       # 1-5，自评
---

## 骨架      ← 槽位结构
## 模块词库   ← 每格的候选词
## 完整示例   ← 可直接投喂，≥40 字符
## 负面提示词  ← 平台吃负面词才写
## 调参备注   ← 会怎么漂、怎么改回
## 来源      ← 出处 + 验证事实（模型+版本、参数、几张、命中率）
```

`## 来源` 里的「验证」必须是一行事实，不是「效果不错」。带上**模型 + 版本 + 关键参数**（CFG、步数、采样器、画幅、LoRA）——版本一换写法就变，没有这些复现不了。

## 写到哪里

| 库 | 路径 | 谁写 |
| --- | --- | --- |
| 内置库 | `<skill>/references/templates/` | 仅维护技能的人；随版本分发，装了会被覆盖 |
| 全局用户库 | `~/.agents/t2i-prompts/`（`T2I_PROMPT_HOME` 可改） | agent 随时写，跨项目跨厂商保留 |
| 项目副本 | `<项目根>/.scratch/t2i-prompts/`（随仓库提交） | agent 写全局库后自动镜像一份 |

**agent 一律写全局库，不改内置库。** 改完全局库**必须**在项目里留一份：全局库不在任何仓库里，换机器、换人、review 都看不到；项目副本随代码走，评审能看见、能回滚。

- `add` / `copy` 默认自动镜像到项目副本（cwd 向上找 `.git` 或 `AGENTS.md` 定根），并重建项目的 `index.md`。
- 项目没有 `.scratch` 约定时用 `--project-home <dir>`（例如 `docs/agents/prompts`）。
- 不想镜像加 `--no-mirror`；只补镜像（不改全局库）用 `mirror` 子命令。
- `check` 会比对项目副本与全局库，输出不一致的文件名——漂移了就重新 `mirror`。项目副本里多出来的、全局库没有的文件不会被删（可能是项目专属模板）。

## 命令

```bash
node <skill>/scripts/prompt-lib.mjs new <id> "名字"     # 从零生成骨架
node <skill>/scripts/prompt-lib.mjs copy <id> <新id> "名字"  # 拿内置模板 fork 一个变体
node <skill>/scripts/prompt-lib.mjs add <file.md>       # 校验 → 入库 → 重建索引
node <skill>/scripts/prompt-lib.mjs mirror              # 全局库 → 项目副本
node <skill>/scripts/prompt-lib.mjs check               # 全库校验 + 重建索引 + 项目副本漂移
node <skill>/scripts/prompt-lib.mjs list 国风            # 检索
```

add 的校验会拦：frontmatter 缺字段、id 与文件名不一致、缺骨架/示例/来源小节、示例过短、id 冲突（`--force` 覆盖）。

## 索引

用户库 `index.md` 由脚本重建，勿手改。它在 `check` / `add` 时刷新；待修条目会列在索引末尾。
