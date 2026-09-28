---
name: jxx-retro
description: "对一次编码会话做回顾（retrospective），提出对 agent 环境的改进建议。触发词：retro、复盘、回顾这次会话、session retrospective。"
disable-model-invocation: true
metadata:
  version: 1.0.0
---

用户要求做**回顾**。你要做的是给编码 agent 的**环境**提出改进建议，让未来的运行更好。

## 步骤

1. 调用 Skill 工具使用 `jxx-writing-for-agents`，遵循其写作风格指南。

2. 阅读用户指定的那次会话的第一手资料。可能需要在本机搜索会话日志。用户未指定时，默认回顾当前会话。

3. 在以下类别中寻找改进候选。

- **导航（Navigation）**：agent 找到正确文件容易吗？文件间有隐藏依赖吗？加**导航指针**（navigation pointer）会不会更容易？_适用时机_：会话花了很长时间才找到某条信息。
- **自动化检查（Automated checks）**：有没有自动化检查能抓住 agent 犯的错？lint、类型、测试、文件系统 linter？先读仓库自己的 check 命令（`package.json`/构建工具的 `lint`/`check` 脚本、CI workflow），已经存在但没接线或静默失效的检查本身就是发现项，而不是重新发明。仓库没有任何**护栏**（没有 pre-commit hook、没有跑 lint/typecheck/test 的 CI job）本身就是一条发现：没接 lint 的仓库是长期错失的机会，不是中性默认。_适用时机_：agent 犯了自动化检查本可抓住的错，或仓库根本没有护栏。
- **编码标准（Coding standards）**：该给**审查 agent** 新增一条规则吗？该删除或澄清现有规则吗？先给违例分类：**机械性**违例（固定的语法模式、被禁 API、import 形态、文件位置规则）就该配确定性检查，没有例外：在仓库自己的 linter 里加自定义规则、加 pre-commit hook、或加 CI job，选仓库语言和现有护栏下最便宜的那个。默认是**建检查**而不是**写规则**。`CODING_STANDARDS.md` 只留给真正的**判断题**（跨文件一致性、"贴合周边风格"、任何护栏都替代不了的判断）。_适用时机_：审查 agent 没能抓住某个错误。
- **全局 AGENTS.md**：有没有该移到编码标准（或自动化检查）里的 steering 指令？_适用时机_：仓库内或用户全局的 AGENTS.md 文件特别大。
- **工具经济性（Tool economy）**：agent 有没有做出本可精简的昂贵工具调用？有没有特别浪费 token 的自定义工具（CLI、MCP）？_适用时机_：agent 做出了昂贵的工具调用。
- **无效指令（No-ops）**：steering 文件里找不改变 agent 行为的指令。_适用时机_：steering 文件大而臃肿。
- **信息可达性（Information access）**：寻找提升 agent 信息可达性的机会。例如 tee 出 dev server 日志、对第三方服务开放只读访问。_适用时机_：某条关键信息 agent 根本拿不到。

4. 按严重程度排序，把这些候选呈现给用户。

## 参考

### 实现与审查

所有工作都经过两个阶段：实现和审查。实现 agent 的**上下文压力**最大——它负责探索、写代码、调试失败。

审查 agent 的上下文压力最小——它拿到的是 diff，不需要探索，通常也不需要写代码或调试。

所以应该由**审查 agent**负责执行编码标准，而不是实现 agent。

### 文件

仓库里有几类文件可供你使用：

- `CLAUDE.md`/`AGENTS.md`：会被推送到在本仓库工作的任何 agent 的上下文窗口。必须极其节制地使用，通常只放指向其他文件的**导航指针**。
- `CODING_STANDARDS.md`：在审查阶段而非实现阶段读取。标准文件超过 1,000 行时，把导航指针指到 docs 目录。
- 文档：文档作为参考文件，由其他文件指向。写新文档前先找已有的。
- 技能：说明性内容放进技能（description 会进入 agent 的上下文窗口），或做成用户调用的命令。写法遵循 `jxx-writing-for-agents` 技能。
