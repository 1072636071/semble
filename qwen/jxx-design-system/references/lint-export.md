# CLI 工具链：lint / diff / export / spec

`@google/design.md` 提供 4 个命令，配合 DESIGN.md 完成验证、对比、导出与规范注入。

## 安装

```bash
npm install @google/design.md
# 或直接运行（无需安装）
npx @google/design.md <command>
```

> **Windows PowerShell 注意**：`.md` 后缀会与 Markdown 文件关联冲突。使用 `designmd` 别名：
> ```bash
> npx -p @google/design.md designmd lint DESIGN.md
> ```

## 1. lint — 验证与检查

校验 DESIGN.md 的结构正确性、令牌引用、WCAG 对比度等，输出结构化 JSON：

```bash
npx @google/design.md lint DESIGN.md
```

输出含 `findings`（发现项）、`severity`（error/warning/info）、`summary`。规则详见 [design-md-spec.md](design-md-spec.md) 的"9 条 Lint 规则"。

**编程式 API**（需在生成流程中校验时）：

```javascript
import { lint } from '@google/design.md/linter';
const report = lint(markdownString);
console.log(report.findings);       // Finding[]
console.log(report.summary);        // { errors, warnings, info }
```

## 2. diff — 版本对比

比较两个 DESIGN.md，检测令牌级与文本回归。检测到回归（"after" 文件有更多错误或警告）时退出码为 1：

```bash
npx @google/design.md diff DESIGN.md DESIGN-v2.md
```

设计系统迭代时用它防止无意回归。

## 3. export — 格式导出

将 DESIGN.md 令牌导出为框架配置，是连接"设计源"与"代码消费"的桥梁：

| 格式 | 输出 | 用途 |
|------|------|------|
| `json-tailwind` | JSON | Tailwind v3 `theme.extend` 配置对象 |
| `css-tailwind` | CSS | Tailwind v4 `@theme { ... }` 块（CSS 自定义属性） |
| `css-vars` | CSS | 原生 CSS 自定义属性 |
| `tailwind` | JSON | `json-tailwind` 的别名 |
| `dtcg` | JSON | W3C Design Tokens Format Module 标准格式 |

```bash
npx @google/design.md export --format css-tailwind DESIGN.md > theme.css
npx @google/design.md export --format json-tailwind DESIGN.md > tailwind.theme.json
npx @google/design.md export --format css-vars DESIGN.md > variables.css
npx @google/design.md export --format dtcg DESIGN.md > tokens.json
```

**选择导出格式的依据**（步骤 2 询问的技术栈）：
- Tailwind v4 → `css-tailwind`
- Tailwind v3 → `json-tailwind`
- 纯 CSS / 设计令牌跨工具流转 → `css-vars` 或 `dtcg`

## 4. spec — 输出规范

将 DESIGN.md 格式规范注入代理上下文，确保代理理解格式：

```bash
npx @google/design.md spec
npx @google/design.md spec --rules              # 附加 linting 规则表
npx @google/design.md spec --rules-only --format json   # 仅输出规则表（JSON）
```

在生成 DESIGN.md 前，可先运行 `spec` 将规范注入上下文，减少格式错误。

## 典型工作流

```
确立设计系统（询问 + 选预设 + 定制）
  → 生成 DESIGN.md（项目根）
  → lint（校验结构与对比度）
  → export（导出为框架配置：theme.css / tailwind.theme.json）
  → 后续生成 UI 时引用令牌，不硬编码
```
