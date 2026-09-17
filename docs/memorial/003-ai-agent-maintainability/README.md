# 003 · AI agent 维护改造（溯源材料）

**来源**：`E:\work\sp\TencentDB-Agent-Memory\docs\memorial\020-ai-agent-maintainability`（该项目 memorial 020），2026-09-13 原样同步。

**用途**：为 `docs/agents/quality-charter.md`（质量宪章）提供**溯源** —— 宪章每条规则都能在此找到原始追问、实测数据与被否决的替代方案。

**内容**：

| 文件 | 内容 |
|---|---|
| `context.md` | 11 轮追问的完整记录 + 10 条决策 + checklist（C1–C5 全绿） |
| `PLAN.md` | 改造清单（P0 闸门 / P1 证据 / P2 并行卫生 + 已否决项 + 捞出的真 bug） |
| `adr/0001` | **证据优先** —— 质量结论不得建立在执行者自述之上 |
| `adr/0002` | **验证职责分界** —— 机器管「有没有／能不能用」，人管「好不好用／体验」 |
| `adr/0003` | **不可机器验证项必须显式入人工验证清单** |
| `adr/0004` | MemoryCore 一次性开 strict（含「按目录分批机制上做不到」的实测证据） |
| `sub-task/001` | 各包「机器可验证性」实测（7 包逐包清单 + Top 5 缺口） |
| `sub-task/002` | MemoryCore strict 错误实测（254 条 / 53 文件 / 密度 0.72，无取样外推） |
| `sub-task/003` | 并行隔离与共享单例资源实测（第一因 = 端口 / 数据目录 / SQLite 锁） |

> ⚠️ **阅读注意**：文中的文件路径与命令（`.scratch/27-board-quickwins/...`、`MemoryCore/...`、`MEMORY.md:24`、`tsc` 输出、`node_modules` 体积等）**均指 TencentDB-Agent-Memory 仓库**，在本仓库不可达，仅作溯源证据。其中 0004 为该项目专属决策，前三条为**跨项目通用**。

**本仓库的落地情况（2026-09-13）**：

- ✅ 已落：`docs/agents/quality-charter.md`（质量宪章，五条纪律的唯一权威源）。
- ⏳ 待落：宪章的**执行层接线**（让 `jxx-implement` / `jxx-code-review` / `issue-tracker.md` 真的引用并执行它）——
  工单 = `.scratch/06-quality-charter-integration/issues/01-bind-charter-to-skill-layer.md`（`Status: ready-for-agent`）。

