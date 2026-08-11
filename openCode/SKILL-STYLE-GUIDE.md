# openCode 技能风格规范

本文件是针对 openCode（opencode）技能（SKILL.md）风格的经验文档，用于指导 `openCode/` 目录下 jxx 系列技能的优化。

## 1. openCode SKILL.md 解析规范（源码事实）

来源：`packages/opencode/src/skill/index.ts`（`isSkillFrontmatter` 函数，第 53-59 行）。

```ts
function isSkillFrontmatter(data: unknown): data is { name: string; description?: string } {
  return (
    isRecord(data) &&
    typeof data.name === "string" &&
    (data.description === undefined || typeof data.description === "string")
  )
}
```

**硬性事实**：

- frontmatter **只识别两个字段**：`name`（必需，字符串）和 `description`（可选，字符串）。
- 其他字段（`metadata`、`version`、`disable-model-invocation`、`argument-hint`、`license`、`language` 等）**被静默忽略**，不报错也不生效。
- `description` 缺失时该技能仍加载，但不会出现在 `/available_skills` 列表中（`fmt` 函数过滤 `description !== undefined`）。
- 目录发现模式：`{skill,skills}/**/SKILL.md`、`skills/**/SKILL.md`（外部）、`**/SKILL.md`（自定义路径）。
- 文件名**固定**为 `SKILL.md`（大写）。

## 2. openCode 技能正文风格特征

从 openCode 源码内置的两个技能（`effect`、`rtl-aware-development`）提炼：

### 2.1 结构

```
---
name: kebab-case-name
description: 详尽的触发场景描述，一句话覆盖所有使用情形。
---

# 标题

简短总纲段（1-3 句，点明技能本质）。

## Guidelines / Source Of Truth / Testing Patterns / References

- 指令式要点（Prefer / Use / Do not / Keep / Avoid）。
- 具体代码示例用 ```代码块```。
- 引用外部资料用 markdown 链接。
```

### 2.2 风格要点

| 维度 | openCode 风格 | 原 jxx 风格（需优化） |
|------|--------------|---------------------|
| frontmatter | 仅 `name` + `description` | 含 `metadata.version`、`disable-model-invocation`、`argument-hint` 等冗余字段 |
| description | 单行字符串，详尽列出触发场景 | 单行或多行（`>`），含触发词 |
| 标题 | `# 标题`（简短） | `# 标题` 或无标题 |
| 总纲 | 1-3 句点明本质 | 常无总纲，直接进流程 |
| 何时使用 | **无此章节**（在 description 里） | 常有 `## 何时使用` / `## 输入` / `## 输出` |
| 工作流 | `## Guidelines` 要点列表 | `## 工作流` + `### 第 N 步` 繁琐流程 |
| 语气 | 指令式（Prefer/Use/Do not） | 描述式、叙述式 |
| emoji | 无 | 偶有 |
| 引用其他技能 | 自包含，少引用 | 频繁引用 `/jxx-xxx` |
| References | `## References` 章节 + markdown 链接 | `## 参考资源` + 相对路径 |
| 长度 | 紧凑（30-60 行） | 较长（40-110 行） |

### 2.3 典型范例（effect 技能）

```markdown
---
name: effect
description: Work with Effect v4 / effect-smol TypeScript code in this repo
---

# Effect

This codebase uses Effect for typed, composable TypeScript services.

## Source Of Truth

Use the current Effect v4 / effect-smol source, not memory or older examples.

1. If `.opencode/references/effect-smol` is missing, clone it there.
2. Search it for exact APIs before answering.
3. Prefer answers backed by specific source files.

## Guidelines

- Prefer current Effect v4 APIs over old blog posts.
- Use `Effect.gen(function* () { ... })` for multi-step workflows.
- Do not introduce `any` or unchecked casts.
- Do not answer from memory. Verify against source first.

## Testing Patterns

- Use `testEffect(...)` for tests that exercise Effect services.
- Run tests from package directories, never from repo root.
```

## 3. 优化策略

### 3.1 frontmatter 优化（机械、安全、可批量化）

对每个 `SKILL.md`：

1. **保留** `name` 字段不变（用户要求不修改技能名）。
2. **保留** `description` 字段，但：
   - 多行 `description: >` 折叠为单行字符串。
   - 保留触发词和场景描述（这是 openCode 路由的依据）。
3. **删除** `metadata`（含 `version`）、`disable-model-invocation`、`argument-hint`、`license`、`language` 等非 openCode 字段。

### 3.2 正文优化（语义、需逐个处理）

1. **删除** `## 何时使用` / `## 输入` / `## 输出` / `## 前置条件` 等元数据章节——触发场景已在 description。
2. **合并** `## 工作流` + `### 第 N 步` 为 `## Guidelines` 风格的要点列表。
3. **改写**叙述式为指令式（Prefer / Use / Do not / Keep / Avoid）。
4. **删除** emoji。
5. **保留** `references/` 子目录引用，但改为 `## References` 章节 + 相对路径链接。
6. **减少**对其他 `/jxx-xxx` 技能的引用，改为自包含描述。
7. **保留**核心语义和护栏规则，不丢失原有约束。

### 3.3 不优化项

- **技能名**（`name` 字段和目录名）不变——用户明确要求。
- **references/ 子目录**内容不变——仅调整 SKILL.md 中对它们的引用方式。
- **核心语义**不变——优化的是风格，不是技能的行为。

## 4. 验证方法

优化后可用以下方式验证：

1. **frontmatter 合法性**：检查每个 SKILL.md 的 frontmatter 只含 `name` + `description`。
2. **openCode 加载**：将 `openCode/` 目录作为技能路径配置到 openCode，确认技能被识别（`/available_skills` 列表出现）。
3. **语义保留**：对比优化前后，确认核心约束、触发场景、护栏规则未丢失。

## 5. openCode 技能发现路径

openCode 按以下顺序发现技能（`discoverSkills` 函数）：

1. 全局外部目录：`~/.claude/skills/`、`~/.agents/skills/`（`skills/**/SKILL.md`）。
2. 项目外部目录：向上查找 `.claude/`、`.agents/`（`skills/**/SKILL.md`）。
3. 配置目录：`config.directories()` 下的 `{skill,skills}/**/SKILL.md`。
4. 自定义路径：`opencode.jsonc` 中 `skills.paths`（`**/SKILL.md`）。
5. URL 拉取：`skills.urls`（先 clone 再扫描）。

**本目录用法**：在 `opencode.jsonc` 中添加：

```jsonc
{
  "skills": {
    "paths": ["D:/work/space/jwikis-skills/openCode"]
  }
}
```

或软链到 `~/.agents/skills/` 下。

## 6. 与原 jxx 体系的兼容性

优化后的技能**仅保证 openCode 可加载**。原 jxx 体系（CodeBuddy 等）若依赖以下字段，会失效：

- `disable-model-invocation`（原控制是否允许模型自动调用）→ openCode 用 `permission` 控制。
- `metadata.version`（原用于版本追踪）→ openCode 无此概念。
- `argument-hint`（原用于参数提示）→ openCode 无此概念。

若需同时兼容原体系，可保留这些字段作为"额外 frontmatter"——openCode 会静默忽略，不报错。但本优化按 openCode 风格执行，**删除**这些字段以保持 frontmatter 简洁。

## 7. 参考来源

- openCode 源码：`D:\work\space\open-code-mm\opencode\packages\opencode\src\skill\index.ts`
- openCode 内置技能范例：
  - `D:\work\space\open-code-mm\opencode\.opencode\skills\effect\SKILL.md`
  - `D:\work\space\open-code-mm\opencode\.opencode\skills\rtl-aware-development\SKILL.md`
- openCode 配置：`D:\work\space\open-code-mm\opencode\.opencode\opencode.jsonc`