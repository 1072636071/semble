---
name: setup-ts-deep-modules
description: 将 dependency-cruiser 接入 TypeScript 仓库，使每个包都是深模块——实现隐藏在子文件夹中，只能通过其入口文件访问。用户调用。
disable-model-invocation: true
---

# 设置 TS 深模块

让本仓库中的每个包都成为**深模块**：大量行为隐藏在小型接口之后。一个包的公开表面是其**入口点**——包根目录下的文件——而子文件夹中的一切都被隐藏。此技能安装 [dependency-cruiser](https://github.com/sverweij/dependency-cruiser) 以及使入口点成为唯一入口的规则，然后证明这些规则确实有效。

如需词汇表（深模块、接口、接缝、深度），运行 `/codebase-design` 技能——全程使用它的语言。

## 本技能强制执行的形态

```
src/packages/
  <name>/
    index.ts        ← 一个入口点（公开）。从外部导入它。
    client.ts       ← 另一个入口点。包可以暴露多个入口点。
    lib/            ← 实现：对外部隐藏，可以自由相互导入。
    tests/          ← 同地的测试 + 夹具（一个子文件夹，因此是私有的）。
```

公开表面是包的**根目录文件**——而不是某个指定的 `index.ts`。按约定，实现位于 `lib/`、测试位于 `tests/`，使每个包具有相同的两文件夹形态。不过规则本身是通用的：*任何*子文件夹中的*任何*内容都是私有的，所以你永远不需要扩展配置来添加文件夹。

四条规则，全部为 `error`：

1. **入口点边界** — 包外的代码（应用代码或其他包）只能导入该包的入口点（其根目录文件），绝不能导入其子文件夹中的任何内容。
2. **包内自由** — 包自己的文件可以自由相互导入。
3. **通过入口点测试** — `<pkg>/tests/` 下的文件可以导入任何包的入口点以及它们自己的 `tests/` 夹具，但绝不能导入任何包的子文件夹内部（即使是它们自己的也不行）。跨包的集成测试没问题；深层导入不行。
4. **无循环** — 不允许依赖循环。

**入口点，而非 barrel 文件。**因为公开表面是*每一个*根目录文件，一个包可以暴露多个小入口点（`index.ts`、`client.ts`、`server.ts`），而不是把所有东西都汇聚到一个巨大的 `index.ts` 中。不鼓励重新导出整个子树的 barrel 文件——保持入口点小而将实现隐藏在子文件夹中。

分层（哪些包可以依赖哪些包）是一个*不同*的关注点，在配置中留作注释存根，供本仓库自行填写。

## 步骤

### 1. 检测环境

- **包管理器** — `pnpm-lock.yaml` → pnpm，`yarn.lock` → yarn，`bun.lockb` → bun，否则为 npm。对下方每个命令都使用它（`pnpm`/`yarn`/`npm run`/`bunx`）。
- **包根目录** — 如果存在 `src/` 则使用 `src/packages`，否则使用 `packages`。如果仓库已有不同的明显约定，请与用户确认这一选择。
- **现有配置** — 检查是否存在 `.dependency-cruiser.*` 文件。如果存在，**不要**覆盖它：将四条规则和选项合并进去，并告诉用户你添加了什么。

**完成标准：** 包管理器、包根目录和现有配置状态都已知。

### 2. 安装 dependency-cruiser

使用检测到的包管理器将 `dependency-cruiser` 安装为 devDependency。

**完成标准：** `dependency-cruiser` 位于 `devDependencies` 中。

### 3. 编写配置

将 [`dependency-cruiser.config.cjs`](./dependency-cruiser.config.cjs) 复制到仓库根目录，命名为 `.dependency-cruiser.cjs`。将 `PACKAGES_ROOT` 设置为第 1 步检测到的根目录。规则基于路径深度且与扩展名无关，所以其他内容无需调整。

**完成标准：** `.dependency-cruiser.cjs` 存在，具有正确的 `PACKAGES_ROOT`，并且四条禁止规则都齐全。

### 4. 将其接入检查

- 添加 `lint:boundaries` 脚本：`depcruise <packages-root>`（或 `depcruise src`）。
- 将其并入仓库的总检查命令——即已经运行类型检查的那个命令（例如 `check` / `ci` / `validate` 脚本）。**不要**改动 `tsconfig` 或添加路径别名。
- 如果没有总脚本，添加 `lint:boundaries` 并告诉用户将其纳入 CI。

**完成标准：** `lint:boundaries` 存在，并与类型检查在同一命令中运行。

### 5. 搭建示例包

创建一个已提交的 `<packages-root>/example/` 作为复制即用的模板：

- `index.ts` — 一个入口点。导出一个委托给内部文件的函数（这样包能明显看到是*深*的，而不是透传）。
- `lib/impl.ts` — 位于**子文件夹**中的内部文件，由 `index.ts` 导入，外部无法访问。
- `tests/example.test.ts` — 只导入 `../index`（一个入口点），并针对公开函数进行断言。

告诉用户这是一个可复制或删除的入门模板。

**完成标准：** 示例包存在，通过根目录入口点暴露其行为，并将 `impl` 隐藏在子文件夹中。

### 6. 证明规则有效

这是整个技能的完成标准——一个在违规时不报错的配置毫无价值。

1. 运行 `lint:boundaries`。它必须在干净的示例上**通过**。
2. 临时在 `tests/example.test.ts` 中添加一个深层导入（例如 `import { thing } from "../lib/impl"`）。再次运行 `lint:boundaries`——它必须**失败**，报 `tests-through-entrypoints`。
3. 还原深层导入。再运行一次——它必须**通过**。

**完成标准：** 你观察到一次通过、然后在深层导入上报错、然后又通过。如果第 2 步没有报错，说明规则接线不正确——在完成前修复。

### 7. 记录约定

在**包文件夹**中写一个 `README.md`（`<packages-root>/README.md`）——位于它所管理的包旁边——涵盖：`src/packages/<name>/` 布局（入口点在根目录，`lib/` 存放实现，`tests/` 存放测试）、"只通过包的入口点（其根目录文件）导入"，以及如何运行 `lint:boundaries`。**明确劝阻 barrel 文件**——暴露几个小入口点，而不是通过一个 index 重新导出整个子树。将其精简为复制即用的片段加上四条规则，每条一段。

然后从仓库的 agent 指令文件中添加一个**上下文指针**指向它——优先 `CLAUDE.md`，否则 `AGENTS.md`（如果两者都不存在则创建 `AGENTS.md`）。一行就足够了，例如 `包是深模块——在添加或导入一个包之前，请参见 [src/packages/README.md](./src/packages/README.md)。`这是让 agent 发现边界规则而不是绊倒它的方式。

**完成标准：** `<packages-root>/README.md` 存在并劝阻 barrel 文件，且仓库的 `CLAUDE.md`/`AGENTS.md` 链接到它。

## 备注

- 配置中的 `$1` 反向引用（dependency-cruiser 的分组匹配）正是让一个包能够访问自己的内部、而外部无法访问的机制——不要将它们摊平为按包的独立规则。
- 公开与私有由**深度**决定：包的根目录文件是入口点；子文件夹中的任何内容都是私有的。约定俗成的子文件夹是 `lib/`（实现）和 `tests/`，但规则并不硬编码它们——任何子文件夹都是私有的，所以新文件夹永远不需要改配置。添加一个入口点就是添加一个根目录文件——无需 barrel。
- 包是**扁平的**：根目录下一层直接子目录。包的内部可以任意嵌套；但一个包不能包含另一个包。
- 使用 `.cjs`（而非 `.js`），这样即使仓库是 `"type": "module"`，配置的 `module.exports` 也能正常工作。
