/**
 * 插件自有消息来源（PRD 111 工单 05 构建内容 5 / B3）——**全插件单一真源**。
 *
 * 为什么必须有这个模块（而不是每处各写一遍对象字面量）：
 * R1 三维审查（spec）发现项 1 实录——B3 只改了 `orchestrator.mjs` 的 `notify` 面，**现役入口
 * `src/index.mjs` 的 `agent.steer(...)` 仍在伪造 `{ kind: 'user' }`**，而交付自报写的是
 * 「本插件无 steer 调用点」。同一类伪造散落在 7 处真实代码点（index.mjs + index-v3..v6 热更新
 * 载体），逐处手改必然再漏。故收敛为**一处常量 + 引用**，并用全 `src/` 扫描的防回退用例钉住。
 *
 * 宿主契约取证（`deepseek-harness` @ `d94ac777`，只读取证，禁 checkout 对方分支）：
 *  ① `packages/llm/llm/src/message.ts:103-115` —— `MessageSourceMap` 是 **merge-extensible 求和
 *     类型**，其上方注释逐字写「each producer declares its own `kind` in its own module; there is
 *     no shared catch-all `plugin` kind」；`user: { kind: 'user' }` 仅是其中一个成员。
 *  ② `packages/llm/llm/src/message.ts:86-95` —— `ContextFormed`（source 可混入的可选 `form`
 *     判别；省略即「未声明上下文」的既有默认）。
 *  ③ `packages/api/session-controller/src/commands.ts:331-335` + `src/types.ts:415-420` ——
 *     `kind: 'user'` 的真实生产方是**浏览器 `session/prompt` RPC**（`{ kind:'user', rpcId }`）
 *     ⇒ 它是真人输入的专用 kind。
 *  ④ **`packages/goal/tool-goal/README.md:72`**（规范依据，逐字）：「**`{ kind: 'user' }` is
 *     assigned by `Agent.followup()` and `steer()` when their caller omits a source, so plugins,
 *     schedulers, and other non-human producers must pass their own source rather than inheriting
 *     human authority.**」⇒ 省略 source 会让插件通知**继承人类权限**；伪造同理。
 *  ⑤ `packages/core/agent/src/runtime-types.ts:218-231` —— `followup(message)` 与 `steer(message)`
 *     均要求消息带「the source that supplied it」⇒ 两个注入面（notify / steer）同罪同判据。
 *  ⑥ 插件自声明 kind 的现役范式三例：`packages/goal/tool-goal/src/index.ts:14-16`（`'tool-goal'`）、
 *     `packages/context/time-context/src/index.ts:15-17`（`'time-context'`）、
 *     `packages/guard/repeat-tool-reminder/src/index.ts:15-17`（`'repeat-tool-reminder'`）。
 *
 * 本仓是纯 JS（无 TS 构建），故以运行时对象传值；上列 `declare module` 坐标仅作类型面说明。
 */

/**
 * 本插件注入消息时使用的 source。**只读**（冻结）：注入点不得就地改写它，
 * 否则等于绕过单一真源；需要带 `form` 等附加字段时请 spread 出新对象再传。
 */
export const PLUGIN_SOURCE = Object.freeze({ kind: 'jxx-driver' })

/** 插件 kind 名（供断言/日志引用，避免再次散落字符串字面量）。 */
export const PLUGIN_SOURCE_KIND = PLUGIN_SOURCE.kind
