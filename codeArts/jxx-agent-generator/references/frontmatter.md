# Frontmatter 字段约定（openCode）

`~/.opencode/agent/<名字>.md` 的 frontmatter 遵循 openCode agent schema（源码 `packages/core/src/v1/config/agent.ts`）。所有 agent 统一，保证自动匹配与配对调用可靠。

## 模板

```yaml
---
description: <职责 + 扮演角色 + 触发词 + 分工边界，一段话，含引号触发词>
mode: subagent
permission:
  read: allow
  edit: allow
  glob: allow
  grep: allow
  list: allow
  bash: allow
  lsp: allow
  task: allow
---
```

## 字段说明

| 字段 | 规则 |
|------|------|
| `description` | 三要素缺一不可：**① 职责**（专职做什么）；**② 扮演角色**（姜某·角色名）；**③ 触发词**（用引号列出，供自动匹配）。必要时补**分工边界**（如"与姜履约并行、互不污染""与 jxx-research 不同"）。描述越具体，越容易被正确触发。 |
| `mode` | `subagent`（姜姓 agent 都是被主控派发的子 agent）。可选值：`subagent` / `primary` / `all`。 |
| `permission` | **按需裁剪**，只留该 agent 实际用到的键，值为 `allow`。探索/审查类去掉 `edit`。需要联网再补 `webfetch`/`websearch`。需要调技能补 `skill`。 |

## 已识别字段（openCode KNOWN_KEYS）

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | **从文件路径推导**，frontmatter 中的 `name` 会被覆盖。**省略**。 |
| `model` | string | 模型 ID。可选。 |
| `variant` | string | 模型变体。可选。 |
| `description` | string | 描述何时使用。**必填**。 |
| `mode` | "subagent" \| "primary" \| "all" | 模式。可选。 |
| `hidden` | boolean | 从 `@` 菜单隐藏（仅对 subagent 生效）。可选。 |
| `color` | #hex 或主题色名 | 颜色。可选。 |
| `steps` | positive int | 最大迭代步数。可选。 |
| `temperature` | finite | 采样温度。可选。 |
| `top_p` | finite | nucleus 采样。可选。 |
| `permission` | PermissionConfig | 权限规则。**替代 `tools`**。 |
| `disable` | boolean | 禁用。可选。 |

## 需删除的 CodeBuddy 特有字段

以下字段 openCode 不识别，会被静默塞入 `options`，应删除：

- `name` — openCode 从文件路径推导。
- `tools` — 已废弃，用 `permission` 代替。
- `agentMode` — CodeBuddy 的 agent 模式（openCode 用 `mode`）。
- `enabled` — CodeBuddy 的启用开关（openCode 用 `disable` 反向控制）。
- `enabledAutoRun` — CodeBuddy 的自动运行开关（openCode 无对应概念）。

## permission 已知键

| 键 | 说明 | CodeBuddy 工具映射 |
|----|------|-------------------|
| `read` | 读文件 | `read_file`, `read_lints` |
| `edit` | 编辑/写入/删除文件 | `replace_in_file`, `write_to_file`, `delete_file` |
| `glob` | 文件名搜索 | `search_file` |
| `grep` | 内容搜索 | `search_content` |
| `list` | 列目录 | `list_dir` |
| `bash` | 执行命令 | `execute_command` |
| `lsp` | 语言服务器协议 | `lsp` |
| `task` | 子任务 | `task` |
| `webfetch` | 抓取 URL | `web_fetch` |
| `websearch` | 网络搜索 | `web_search` |
| `skill` | 调用技能 | `use_skill` |
| `todowrite` | 写待办 | — |
| `question` | 向用户提问 | — |

permission 值为 `"allow"` / `"deny"` / `"ask"`。

## description 示例

**审查判断型**：
```
代码审查（标准维度）专责 agent。扮演刑律司主审官，审 diff 是否违反仓库编码标准 + Fowler 代码异味基线。触发词："标准审查""审查标准""code review 标准轴"。与姜履约（spec 维度）配对并行运行，上下文互不污染。
```

**具体事务型**：
```
文档整理专责 agent。扮演翰林院编修，把散乱笔记/文档整理成结构化报告，保留原意、补全目录、统一格式。触发词："整理文档""归纳笔记""梳理资料""帮我理一理"。与 jxx-research（调研）不同：本 agent 只做整理归纳，不做外部调研。
```

## 校验清单

- [ ] **不含 `name`**（openCode 从路径推导）
- [ ] **不含 `tools`**（已废弃，用 `permission`）
- [ ] **不含 `agentMode`/`enabled`/`enabledAutoRun`**（CodeBuddy 特有）
- [ ] description 含职责 + 角色 + 触发词
- [ ] `mode: subagent`
- [ ] permission 键全是已知键，值全是 `allow`
