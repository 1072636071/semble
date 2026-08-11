# design.md

Google Labs 出品的设计规范格式。通过 DESIGN.md 文件向 AI 编码代理描述视觉身份，让 Agent 持续、结构化地理解设计系统。

- **GitHub**: https://github.com/google-labs-code/design.md
- **License**: Apache-2.0
- **Stars**: 22.9k
- **TypeScript**, npm 包

## 安装

```bash
npm install @google/design.md
```

Windows PowerShell 需引号：

```bash
npm install "@google/design.md"
```

## CLI 命令

### lint — 验证 DESIGN.md

```bash
npx @google/design.md lint DESIGN.md
```

Windows 用 `designmd` 别名（避免 `.md` 后缀与文件关联冲突）：

```bash
npx -p @google/design.md designmd lint DESIGN.md
```

### diff — 对比两个设计规范版本

```bash
npx @google/design.md diff DESIGN.md DESIGN-v2.md
```

### export — 导出为其他格式

```bash
# Tailwind v3
npx @google/design.md export --format json-tailwind DESIGN.md > tailwind.theme.json

# Tailwind v4 CSS
npx @google/design.md export --format css-tailwind DESIGN.md > theme.css

# W3C Design Tokens
npx @google/design.md export --format dtcg DESIGN.md > tokens.json
```

### spec — 输出规范文档（注入 Agent Prompt）

```bash
npx @google/design.md spec
```

## 文件格式

DESIGN.md = YAML front matter（设计令牌）+ Markdown 正文（设计原理）

```yaml
---
name: Heritage
colors:
  primary: "#1A1C1E"
  secondary: "#6C7278"
  tertiary: "#B8422E"
  neutral: "#F7F5F2"
typography:
  h1:
    fontFamily: Public Sans
    fontSize: 3rem
rounded:
  sm: 4px
  md: 8px
spacing:
  sm: 8px
  md: 16px
---
```

## 使用场景

- 在项目中创建 `DESIGN.md`，让 AI 编码代理自动读取并遵循设计规范
- 做 UI 开发时，Agent 能获取准确的色值、字体、间距等令牌
- 设计系统版本对比、回归检测
- 导出到 Tailwind / W3C DTCG 格式
