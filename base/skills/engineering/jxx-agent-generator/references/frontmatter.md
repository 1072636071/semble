# Frontmatter 字段约定

`~/.codebuddy/agents/<名字>.md` 的 frontmatter 遵循如下约定。所有 agent 统一，保证自动匹配与配对调用可靠。

## 范式统一开头

所有 agent 正文第一句固定为：`你是超级AI助理<名字>，正在扮演<角色名>`。名字用 frontmatter 的 `name`（如 `姜清规`），角色名用其扮演角色（如 `刑部律例主事`）。其余正文按 references/identity.md 的句式 A/B 组织。

## 模板

```yaml
---
name: 姜某-官署职官
description: <职责 + 扮演角色 + 触发词 + 分工边界，一段话，含引号触发词>
tools: list_dir, search_file, search_content, read_file, read_lints, replace_in_file, write_to_file, execute_command, delete_file, lsp, task
agentMode: agentic
enabled: true
enabledAutoRun: false
---
```

## 字段说明

| 字段             | 规则                                                                                                                                                                                                                                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`           | 与**文件名一致**，格式 `姜<两字>-<官署+职官>`（如 `姜清规-刑部律例主事`）。不加空格，用连字符分隔。姓后缀两字古典意象，角色名为赛博大明官署+职官，详见 references/identity.md 取名逻辑。                                                                                                                                          |
| `description`    | 三要素缺一不可：**① 职责**（专职做什么）；**② 扮演角色**（姜某·角色名）；**③ 触发词**（用引号列出，供自动匹配）。必要时补**分工边界**（如"与姜履约并行、互不污染""与 jxx-research 不同"）。描述越具体，越容易被正确触发。                                                                                                         |
| `tools`          | **按需裁剪**，只留该 agent 实际用到的。探索/审查类去掉 `connect_cloud_service`、`automation_update`、`preview_url` 等无关项。常用保留：`list_dir, search_file, search_content, read_file, read_lints, replace_in_file, write_to_file, execute_command, delete_file, lsp, task`。需要联网再补 `web_fetch, web_search, use_skill`。 |
| `agentMode`      | `agentic`                                                                                                                                                                                                                                                                                                                         |
| `enabled`        | `true`                                                                                                                                                                                                                                                                                                                            |
| `enabledAutoRun` | 审查/探索类设为 `false`（由主控按需派发）；独立工具类 agent 可设 `true`。                                                                                                                                                                                                                                                         |

## description 示例（供改写）

**审查判断型**：

```
代码审查（标准维度）专责 agent。扮演刑部律例主事，审 diff 是否违反仓库编码标准 + Fowler 代码异味基线。触发词："标准审查""审查标准""code review 标准轴"。与姜履约（spec 维度）配对并行运行，上下文互不污染。
```

**具体事务型**：

```
文档整理专责 agent。扮演翰林院编修，把散乱笔记/文档整理成结构化报告，保留原意、补全目录、统一格式。触发词："整理文档""归纳笔记""梳理资料""帮我理一理"。与 jxx-research（调研）不同：本 agent 只做整理归纳，不做外部调研。
```

## 校验清单

- [ ] `name` 与文件名一致
- [ ] description 含职责 + 角色 + 触发词
- [ ] tools 无多余项
- [ ] `agentMode: agentic`、`enabled: true`
