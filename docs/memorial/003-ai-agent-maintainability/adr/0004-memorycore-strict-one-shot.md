# ADR-0004 · MemoryCore 一次性开 strict，不做渐进

状态：已接受（memorial 020 内部）
日期：2026-09-13

## 背景

`MemoryCore` 占全仓源码 49%（353 个主源码文件），却是 7 个包中**唯一零类型检查**的包：无根 `tsconfig.json`、无 `typecheck` script、`tsdown.config.ts` 设 `dts: false`（构建期也不检查）、CI 只跑 `npm pack` 不跑测试。

实测（工单 002，tsc 6.0.3 全量编译 353 文件，无取样外推）：

| 口径 | 错误条数 | 有错文件 |
|---|---|---|
| 仅主源码 | **254** | 53（15%） |
| 含 109 个测试文件 | 708 | 80 |

- **错误密度 0.72 条/文件，300/353 文件已零错误**；src 下 **零 TS7006 / 零 TS7031**（几乎无隐式 any）。
- 结论：代码是「写的时候带类型标注、但从未跑过 tsc」，不是「无类型」。
- 错误双峰分布：`src/gateway` 32 文件扛 106 条（密度 3.31），`src/core` 185 文件只扛 92 条（密度 0.50）。

用户拍板：**一次性严格**（`strict: true`，一次修完存量错误），否决了主 agent 推荐的「宽松起步 + 增量收敛」。

## 决策

**给 `MemoryCore` 补根 `tsconfig.json`，`strict: true`，一次性修完 254 条存量错误。**

配套（均来自实测结论）：

1. **不做「按目录分批开 strict」** —— 机制上做不到。实测证据：`exclude` 掉 `src/core` + `src/metadata` 后仍有 204 个文件进入编译、109 条错误照报；只 `include src/utils`（18 文件）实际编译 82 文件、23 条错误里 12 条在目录外。原因 = tsc 的 `exclude` 只作用于 glob 展开，管不住 import 传递闭包。⇒ 改用**逻辑分批**：批 0 根因 → 叶子 → 核心。
2. **批 0 优先**（一个动作消 37%）：① 重新生成 `src/gateway/generated`（51 条根因是 OpenAPI spec 缺 wiki/codeGraph path，生成物文件头写着 "Do not edit manually"，不能手改）；② `SQLInputValue` **不放宽**（见下）。
3. **测试文件一并纳入** strict —— `pi-plugin/tsconfig.json` 的 include 已含 `__tests__`，仓库既定做法就是测试也查；且 454 条测试错误中 **342 条来自 `task-router.test.ts` 一个文件的同一处签名不匹配**，真实增量仅约 112 条。
4. **不放宽 `SQLInputValue` 接受 `undefined | null`** —— 虽可一次消 44 条，但这是「改类型定义让报错消失」，会把「某处真的可能传 `undefined` 进 SQL」的真 bug 一起放行；且它会成为**后续所有 agent 的默认行为模板**。
5. **真 bug 与类型错误分开处置** —— 已实测出非类型问题：`add-handler.ts:276/311` 对象字面量重复键（运行期静默覆盖）、`gateway/server.ts` 6 处 `SkillCoreError` 未 import（走到即 `ReferenceError`）、`services/pipeline-worker.ts:806` 未定义符号、`mongodb-adapter.ts:144` / `sqlite-adapter.ts:137` 找不到 `IMetadataStore`（`implements` 形同虚设）、`offload/index.ts` 11 个属性构造未赋值。**加 `!` 或加标注会掩盖这些，必须真修。**
6. **断链 import 需设计决策而非类型修复** —— `src/integrations/` 目录在仓库中不存在，但被 11 处 `try { await import() } catch { ... }` 引用（故意的可选依赖，闭源构建才有）。需决定：`@ts-expect-error` 豁免，还是抽接口 + 空实现。

## 理由

- **实测证明代价远小于预估**（254 条、中等偏小），「一次性严格」在此规模下可行，不必背「宽松 tsconfig 形同虚设」的债。
- **渐进宽松在无人值守下更危险**：宽松期内 agent 仍可写错类型而不被拦，且「哪些目录已严格」成为需要长期维护的隐性知识。
- **闸门是 ADR-0001 的前置**：验收框要附的「证据」（用例名 / 命令 / exit code）来源就是机器闸门；没有 typecheck 与可跑测试，证据无从产生。

## 被否决的替代方案

- **宽松起步（`strict: false`）+ 增量收敛** —— 主 agent 原推荐。被否：实测规模不需要渐进，且宽松期留下「绿灯有水份」的信任缺口。
- **按目录分批开 strict** —— 机制上不可行（import 传递闭包），见决策 1。
- **放弃类型闸门，改补集成测试** —— 类型层错误测不出来；且补测成本同样高。
- **放宽 `SQLInputValue` 以消 44 条** —— 见决策 4。
- **上 project references 以实现真分批** —— 353 个文件拆 composite 的成本远高于修 254 条错误。

## 影响

- 新增 `MemoryCore/tsconfig.json`（模板取 `openclaw-plugin/tsconfig.json`：`ESNext` + `bundler` + `skipLibCheck` + `types: ["node"]`），并补 `noUnusedLocals: false` / `noUnusedParameters: false` 以避免数百条无关噪声。
- 新增 `typecheck` script；CI 的 MemoryCore job 增加 typecheck + test（现状只 `npm pack`）。
- 修复顺序：批 0（根因，−95 条）→ 批 1 叶子（cli / offload-client / api-trace / offload_server / services / adapters + 断链 import）→ 批 2（utils / metadata）→ 批 3（offload，需重构构造流程）→ 批 4（core，185 文件可并行）→ 批 5（gateway，含 6 处真 bug）。
