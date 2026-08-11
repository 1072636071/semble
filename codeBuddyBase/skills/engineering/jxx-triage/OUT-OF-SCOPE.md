# 超范围知识库

仓库中的 `.out-of-scope/` 目录存储被拒绝功能请求的持久记录。它有两个用途：

1. **制度记忆** — 功能为何被拒绝，这样关闭 issue 后推理不会丢失
2. **去重** — 当新 issue 匹配先前拒绝时，技能可以显示之前的决策而非重新讨论

## 目录结构

```
.out-of-scope/
├── dark-mode.md
├── plugin-system.md
└── graphql-api.md
```

每个**概念**一个文件，不是每个 issue 一个。多个请求同一功能的 issue 归入同一文件。

## 文件格式

文件应以轻松、可读的风格编写——更像简短设计文档而非数据库条目。使用段落、代码示例和示例使推理清晰且对首次接触者有用。

````markdown
# Dark Mode

本项目不支持暗色模式或面向用户的主题系统。

## Why this is out of scope

渲染管线假设在 `ThemeConfig` 中定义的单一调色板。
支持多主题需要：

- 包裹整个组件树的主题上下文 provider
- 每个组件的主题感知样式解析
- 用户主题偏好的持久化层

这是一个重大架构变更，与项目聚焦内容创作的方向不一致。
主题是下游消费者在嵌入或分发输出时的关注点。

```ts
// 当前 ThemeConfig 接口不支持运行时切换：
interface ThemeConfig {
  colors: ColorPalette; // 单一调色板，构建时解析
  fonts: FontStack;
}
```
````

## Prior requests

- #42 — "Add dark mode support"
- #87 — "Night theme for accessibility"
- #134 — "Dark theme option"

```

### 文件命名

使用简短、描述性的 kebab-case 概念名：`dark-mode.md`、`plugin-system.md`、`graphql-api.md`。名称应足够可识别，让人浏览目录时不打开文件就能理解被拒绝的是什么。

### 编写原因

原因应实质化——不是"我们不想要这个"，而是为什么。好的原因参考：

- 项目范围或理念（"本项目聚焦 X；主题是下游关注点"）
- 技术约束（"支持此功能需要 Y，与我们的 Z 架构冲突"）
- 战略决策（"我们选择使用 A 而非 B，因为..."）

原因应持久。避免引用临时情况（"我们现在太忙了"）——那些不是真正的拒绝，是推迟。

## 何时检查 `.out-of-scope/`

在 triage 期间（步骤 1：收集上下文），读取 `.out-of-scope/` 中所有文件。评估新 issue 时：

- 检查请求是否匹配现有的超范围概念
- 匹配按概念相似性，非关键词——"night theme" 匹配 `dark-mode.md`
- 如果有匹配，向维护者展示："这与 `.out-of-scope/dark-mode.md` 相似——我们之前拒绝了，因为[原因]。你还持相同看法吗？"

维护者可以：

- **确认** — 新 issue 被添加到现有文件的 "Prior requests" 列表，然后关闭
- **重新考虑** — 超范围文件被删除或更新，issue 进入正常 triage
- **不同意** — issue 相关但不同，继续正常 triage

## 何时写入 `.out-of-scope/`

仅在 **enhancement**（非 bug）被 *拒绝* 为 `wontfix` 时。被拒绝的 enhancement 记录在此，防止相同请求以新 issue 形式回归。

当某项因**已实现**而被关闭为 `wontfix` 时，**不要**写入此处。那是已构建的功能，不是被拒绝的；记录它会使去重检查出现假阳性。关闭评论应指向功能已存在的位置。

流程：

1. 维护者决定功能请求超范围
2. 检查匹配的 `.out-of-scope/` 文件是否已存在
3. 如果是：将新 issue 追加到 "Prior requests" 列表
4. 如果否：创建新文件，包含概念名、决策、原因和首个先前请求
5. 在 issue 上发布评论解释决策并提及 `.out-of-scope/` 文件
6. 以 `wontfix` 标签关闭 issue

## 更新或删除超范围文件

如果维护者改变了对先前被拒绝概念的看法：

- 删除 `.out-of-scope/` 文件
- 技能无需重新打开旧 issue——它们是历史记录
- 触发重新考虑的新 issue 进入正常 triage
```
