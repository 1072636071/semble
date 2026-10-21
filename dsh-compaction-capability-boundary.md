# DSH 会话压缩现状能力边界（对照 headroom / paritok）

> 基于 E:\work\sp\deepseek-harness\packages\compaction\* 源码逐文件核对，非外部文档转述。
> 结论先放：DSH 原生压缩 = 内嵌式 LLM 摘要 + 确定性工具结果截断 + 图片卸载，历史压缩能力 >= headroom，唯一实质弱点是工具结果压缩无结构感知。

## 0. 先纠偏一个误解

dsh-trim-cot-leakage 不是压缩插件。它是 prose 质量技能，删文档/注释里的思考泄漏（如 (decision 7)、used to、review 痕迹）。零 token 作用，与省 token 无关。DSH 真正的压缩是以下整套 Cordis 插件。

## 1. 压缩子系统总览

| 插件 | 作用对象 | 机制 | 是否有损 | 模型无关？ |
|---|---|---|---|---|
| compaction (core) | 框架 | 把一段 history 替换成 1 个 summary 节点；provider 决定触发时机 | 框架 | — |
| compaction-basic | 陈旧 history | 真 LLM 调用做结构化摘要 | 有损（LLM 摘要） | 否（用 LLM） |
| compaction-tool-result-pruner | 工具返回结果 | 确定性头/中/尾字符截断 | 有损截断 | 是 |
| compaction-image-offload | 图片 block | 从上下文延迟/卸载，图仍留痕 | 无损 | 是 |
| compaction-command-compact | 手动 | /compact 命令 | — | — |

支撑性架构（不在插件层，但决定质量）：KV-cache 前缀复用、SQLite 物理行压缩（opt-in）、instruction dedup、token-meter 阴影计价。

## 2. 自动触发逻辑（compaction-basic）

- 触发源：CompactionTrigger = 'pressure' | 'context-overflow'
  - pressure：请求 token 压力达到阈值比例时。
  - context-overflow：真正撞到 CONTEXT_WINDOW_EXCEEDED 时。
  - 外加手动 /compact。
- 关键默认值（config.ts）：
  - thresholdRatio = 0.8 —— 压力阈值 = 上下文窗口的 80%（再扣除预留 output + headroomTokens）。
  - headroomTokens = 65536 —— 压力缓冲。
  - retainRatio = 0.16 —— 最近上下文按窗口 16% 逐字保留为 tail。
  - maxTokens —— 摘要生成上限，默认 = headroomTokens (65536)。
  - compactionRetries = 1、maxOverflowRetries = 1。
  - 支持按 provider/model 精确覆盖（modelPolicies）。
- 结论：DSH 是上下文窗口压力驱动压缩，不是每 N 轮。真正长对话才会自动触发。

## 3. 历史摘要的真实机制（这是强项）

它不是简单丢老消息，而是一次有设计的 LLM 摘要调用：

1. Replay 前缀以复用 KV-cache：摘要调用 = replay 上一路请求的 system + tools + 前导消息，再把 COMPACTION_INSTRUCTION 作为最后一条 user 消息追加。于是这次辅助调用是上一路请求的真前缀 → 复用 provider 已热的 KV-cache，不失效。
2. 固定结构化模板：强制输出 8 段 Markdown（Primary Request / Key Technical Concepts / Files and Code / Errors and Fixes / Pending Jobs / Current Work / Next Step / Critical Context），空段写 (none)，用 terse bullets 而非散文。
3. 保真规则：明确要求保留精确路径、命令、错误串、标识符、数值、函数签名、语法片段。
4. 检查点合并：已有 compacted-summary 块时合并而非照抄，丢弃 stale 事实。
5. 可指定更便宜的摘要模型：summarizationProvider/Model 可独立设（默认继承对话目标）。

→ 质量评估：这是高质量 LLM 冷凝，能力面不弱于 headroom 的 Kompress 文本模型，且带 checkpoint/合并/replay。设计目标就是无本质上下文损失（instruction 原文：no loss of essential context）。损失 = 典型 LLM 摘要损失（个别细节在合并中淡出），但无公开 benchmark 数字。

## 4. 工具结果压缩的真实机制（这是弱项）

完全确定性、零模型：

  thresholdChars = 8192   // 超过才处理
  headChars      = 4096   // 保留头部
  tailChars      = 1024   // 保留尾部
  middle  ->  '[... tool result middle pruned ...]'

- 按 Unicode 码点截断（不拆 surrogate pair），但可能拆 grapheme cluster。
- 无结构感知：不看 JSON 结构、不解析 AST、不识别 stack trace。一个 10KB JSON 砍中间、一个 10KB 报错也砍中间——同样的规则。
- 可恢复性：被剪中间段作为 shadowed node 留在持久日志，replay 可恢复；替换前插入 compaction/prune 阴影计价事件。
- 但不向模型暴露 live retrieve 工具：没有 headroom_retrieve / paritok read_original 那种模型随时取原文的入口。原文在 harness 日志里，模型本回合看不到。

## 5. 与 headroom 的能力边界对照

| 维度 | DSH 原生 | headroom | 谁优 |
|---|---|---|---|
| 历史摘要 | 真 LLM + replay 前缀 + 结构化模板 + 合并 | Kompress HF 文本模型 | DSH 略优/持平 |
| 工具结果 | 朴素头/中/尾截断，无结构 | 按类型路由：JSON→SmartCrusher、代码→CodeCompressor(AST)、文本→Kompress | headroom 明显优 |
| 原文恢复 | shadowed node 留持久日志，replay 恢复，模型不可 live 取 | headroom_retrieve 模型可实时调 | DSH 更彻底但不可 live 取 |
| KV-cache | 摘要调用 replay 前缀复用（设计内建） | CacheAligner 只标记易变、绝不改写 | 思路一致 |
| 图片 | image-offload 原生 | 未涉及 | DSH |
| 公开 loss eval | 无 | 有（GSM8K/SQuAD/BFCL） | headroom 透明 |
| 接入形态 | 内嵌 harness 运行时 | 外部网关/MCP（MITM） | 不同定位 |

## 6. 结论：headroom 进 DSH 该补什么

- 不要整体当 baseURL 网关塞进 DSH——会和原生 LLM 摘要重复，且 MITM 拿不到 DSH 持久日志，反而丢掉 shadowed node 可 replay 恢复这个 DSH 更干净的能力。
- 唯一值得补的缺口 = 结构感知的工具结果压缩。把 headroom 的 SmartCrusher(JSON)/CodeCompressor(AST) 逻辑抽成 DSH 原生插件，替换/增强 compaction-tool-result-pruner 的朴素截断（用 dsh-plugin-dev 实现，订阅同一 toolResultPruner 注入点）。
- 历史摘要、图片卸载、原文恢复三块 DSH 已自给且更契合自身日志模型，无需引入 headroom。

## 7. 待补事实（源码未给）

- 无公开端到端 eval 数字（DSH 摘要保真率无量化）。
- pruner 的 8192/4096/1024 默认值是否随模型窗口自适应？源码是固定常数，未见按窗口缩放逻辑。
- 自动摘要的 pressure 确切定义为上一路请求投影 token 数 vs 窗口——具体投影公式在 projected-token-usage-and-request-context 笔记中，本文未展开。