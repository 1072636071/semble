---
name: jxx-implement
description: 基于 spec 或一组 ticket 实现用户描述的工作，包含 TDD、类型检查与强制代码审查出口。当用户要求按 spec/ticket 落地实现时使用。触发词："implement""实现""按 spec 做""按 ticket 做""落地"。不适用于方案审查（改用 jxx-plan-review 技能）、不适用于自主长任务循环（改用 jxx-goal-execute 技能）。
metadata:
  version: 1.1.0
---

# Implement

实现用户在 spec 或工单中描述的工作。

尽可能在预先约定的接缝（seam）处使用 jxx-tdd 技能。

定期运行类型检查和单个测试文件，结束时运行完整测试套件。

## 完成步骤（不可跳过）

以下两步是实现的硬出口——不执行视为未完成：

- [ ] **代码审查**：调用 jxx-code-review 技能审查所有变更。在审查通过前不得提交。
- [ ] **提交**：将工作 commit 到当前 branch。commit message 遵循 conventional commits 格式，body 说明变更原因。

### 审查发现问题时的处理流程

当 jxx-code-review 返回的报告中存在发现项时，按以下步骤执行：

1. **禁止提交**：审查有发现项，不得执行提交步骤。
2. **输出审查报告**：将 jxx-code-review 的输出原样呈现给用户，不做格式转换或摘要。
3. **用户决策**：在报告末尾追加选项：

```
请选择处理方式：
A. 修复审查发现的问题后重新审查
B. 无视问题，直接提交（需用户明确确认）
```

4. **选项 A — 修复**：逐项修复审查报告中的发现项，修复后重新执行 jxx-code-review 技能，重复此流程直到审查无发现项或用户选择 B。
5. **选项 B — 无视提交**：用户明确确认后，跳过审查要求直接提交。commit message 中注明"代码审查未通过，用户确认无视"。
