# mattpocock/skills

面向真实工程师的 AI 编码代理技能集合。小而精、可组合、易定制。每天用于实际工程开发的 Claude Code / Codex 技能。

- **GitHub**: https://github.com/mattpocock/skills
- **License**: MIT
- **Stars**: 150k
- **Shell** (SKILL.md 指令集)
- 官网: https://skills.sh/mattpocock/skills

## 快速安装

```bash
npx skills@latest add mattpocock/skills
```

选择需要的技能，然后让 Agent 运行 `/setup-matt-pocock-skills` 完成配置。

## 技能列表

### 工程类（用户触发）

| 技能 | 用途 |
|------|------|
| `/ask-matt` | 根据情况推荐合适的技能 |
| `/grill-with-docs` | 追问式需求对齐 + 构建领域模型 + 更新 CONTEXT.md 和 ADR |
| `/triage` | 问题分诊状态机 |
| `/improve-codebase-architecture` | 扫描代码架构问题，生成 HTML 报告 |
| `/to-issues` | 将计划/PRD 拆解为独立可领取的 Issue |
| `/to-prd` | 将对话内容转为 PRD 并发布到 Issue 跟踪器 |
| `/prototype` | 构建可丢弃的快速原型 |

### 工程类（模型自动触发）

| 技能 | 用途 |
|------|------|
| `diagnosing-bugs` | 系统性调试循环：复现→最小化→假设→检测→修复→回归测试 |
| `tdd` | 红-绿-重构 TDD 循环 |
| `domain-modeling` | 构建和打磨领域模型 |
| `codebase-design` | 设计深模块的共享规范 |

### 生产力类

| 技能 | 用途 |
|------|------|
| `/grill-me` | 对计划/设计层层追问直到决策树完全解决 |
| `/handoff` | 将当前对话压缩为交接文档 |
| `/teach` | 多会话教学 |
| `/writing-great-skills` | 编写优秀 SKILL.md 的参考指南 |
| `grilling` | 追问循环引擎（grill-me/grill-with-docs 的后端） |

### 杂项

| 技能 | 用途 |
|------|------|
| `git-guardrails-claude-code` | 阻止危险 git 命令（push/reset --hard 等） |
| `migrate-to-shoehorn` | 迁移测试文件的类型断言 |
| `scaffold-exercises` | 创建练习目录结构 |
| `setup-pre-commit` | 配置 Husky + lint-staged 钩子 |

## 核心理念

解决 AI 编码代理的 4 个常见失败模式：

1. **代理没做对事** → `/grill-me` 需求对齐追问
2. **代理太啰嗦** → `CONTEXT.md` 统一语言，减少 token 消耗
3. **代码不工作** → `tdd` 红绿重构 + `diagnosing-bugs` 调试循环
4. **代码变成泥球** → `improve-codebase-architecture` 定期架构重构
