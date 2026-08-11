---
name: jxx-setup-pre-commit
description: 在当前仓库设置 Husky pre-commit hooks，配合 lint-staged（Prettier）、type checking 与 tests；当用户想添加 pre-commit hooks、配置 Husky/lint-staged，或在 commit 时做格式化/类型检查/测试时使用。
metadata:
  version: 1.0.0
---

# 设置 Pre-Commit Hooks

## 此技能设置的内容

- **Husky** pre-commit hook
- **lint-staged** 对所有暂存文件运行 Prettier
- **Prettier** 配置（如果缺失）
- pre-commit hook 中的 **typecheck** 和 **test** 脚本

## 步骤

### 1. 检测包管理器

检查 `package-lock.json`（npm）、`pnpm-lock.yaml`（pnpm）、`yarn.lock`（yarn）、`bun.lockb`（bun）。使用检测到的包管理器。如不明确，默认使用 npm。

### 2. 安装依赖

作为 devDependencies 安装：

```
husky lint-staged prettier
```

### 3. 初始化 Husky

```bash
npx husky init
```

这会创建 `.husky/` 目录，并在 package.json 中添加 `prepare: "husky"`。

### 4. 创建 `.husky/pre-commit`

写入此文件（Husky v9+ 不需要 shebang）：

```
npx lint-staged
npm run typecheck
npm run test
```

**适配**：将 `npm` 替换为检测到的包管理器。如果仓库的 package.json 中没有 `typecheck` 或 `test` 脚本，省略那些行并告知用户。

### 5. 创建 `.lintstagedrc`

```json
{
  "*": "prettier --ignore-unknown --write"
}
```

### 6. 创建 `.prettierrc`（如果缺失）

仅在不存在 Prettier 配置时创建。使用以下默认值：

```json
{
  "useTabs": false,
  "tabWidth": 2,
  "printWidth": 80,
  "singleQuote": false,
  "trailingComma": "es5",
  "semi": true,
  "arrowParens": "always"
}
```

### 7. 验证

- [ ] `.husky/pre-commit` 存在且可执行
- [ ] `.lintstagedrc` 存在
- [ ] package.json 中的 `prepare` 脚本为 `"husky"`
- [ ] `prettier` 配置存在
- [ ] 运行 `npx lint-staged` 验证其正常工作

### 8. Commit

暂存所有变更和新建文件，commit 消息为：`Add pre-commit hooks (husky + lint-staged + prettier)`

这将通过新的 pre-commit hooks 运行——一次很好的冒烟测试。

## 备注

- Husky v9+ 的 hook 文件不需要 shebang
- `prettier --ignore-unknown` 会跳过 Prettier 无法解析的文件（图片等）
- pre-commit 先运行 lint-staged（快速、仅暂存文件），然后运行完整的 typecheck 和测试
