---
name: jxx-implement
description: 基于 spec 或一组 ticket 实现（implement）用户描述的工作。
disable-model-invocation: true
metadata:
  version: 1.0.0
---

实现用户在 spec 或工单中描述的工作。

尽可能在预先约定的接缝（seam）处使用 `/jxx-tdd`。

定期运行类型检查和单个测试文件，结束时运行完整测试套件。

## 完成步骤（不可跳过）

以下三步是实现的硬出口——不执行视为未完成：

- [ ] **标记待审查**：第一轮功能开发完成（代码写完、本地类型检查与单测通过）后，将工单 `Status:` 置为 `pending-review`（待审查），在提交前保存。
- [ ] **代码审查**：调用 `/jxx-code-review` 审查所有变更。审查通过前不得提交；审查有发现项时按下方流程修复后重新审查。
- [ ] **标记结束并提交**：代码审查通过（或无发现项、用户明确确认无视）后，将工单 `Status:` 置为 `done`（结束），再将工作 commit 到当前 branch。commit message 遵循 conventional commits 格式，body 说明变更原因。

工单状态流转：`ready-for-agent` → `pending-review`（功能开发完）→ `done`（审查通过）。完整生命周期见 `docs/agents/issue-tracker.md` 的「工单状态与生命周期」节。

### 审查发现问题时的处理流程

当 `/jxx-code-review` 返回的报告中存在发现项时，按以下步骤执行：

1. **禁止提交**：审查有发现项，不得执行提交步骤。
2. **输出审查报告**：将 `/jxx-code-review` 的输出原样呈现给用户，不做格式转换或摘要。
3. **用户决策**：在报告末尾追加选项：

```
请选择处理方式：
A. 修复审查发现的问题后重新审查
B. 无视问题，直接提交（需用户明确确认）
```

4. **选项 A — 修复**：逐项修复审查报告中的发现项，修复后重新执行 `/jxx-code-review`，重复此流程直到审查无发现项或用户选择 B。
5. **选项 B — 无视提交**：用户明确确认后，跳过审查要求直接提交。commit message 中注明"代码审查未通过，用户确认无视"。
