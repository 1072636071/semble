# Changelog

## 1.1.2 — 2026-09-17

模式探测改为**直接运行二进制自证存在**，彻底规避 shell 写法陷阱：

- 步骤 0 的探测统一为 `ocr --version`（bash 与 PowerShell 语法一致），不再依赖 `which` / `command -v` / `where`，也不含 stderr 重定向。
- 修掉曾导致误降级的混写陷阱 `where ocr 2>$null; command -v ocr 2>$null` —— bash 下 `$null` 展开为空触发 `ambiguous redirect` 致整条命令不执行；PowerShell 下 `where` 是 `Where-Object` 别名、`command -v` 不存在 —— 两者都零输出，被误判为「未检测到 ocr」而错误降级为内置模式。
- 全量同步修复到所有厂商安装目录（8 处），清除遗留的 v1.1.0 旧副本。

## 1.1.1 — 2026-09-17

- 步骤 0 探测从 `which ocr || command -v ocr || where ocr` 改为 POSIX 优先 + 运行时验证，并补充 PowerShell 变体与 shell 陷阱警示。（1.1.2 进一步简化为 `ocr --version`。）

## 1.1.0 — 2026-09-17

新增**委托模式**（Delegation Mode）作为内置执行模式之一：

- 流程新增「步骤 0：选择执行模式」——按环境是否安装 `ocr` CLI 自动选择。
- **委托模式**（检测到 `ocr` 时启用）：**3 维度审查** —— 标准 + spec + **规则**。OCR 负责确定性工程（文件筛选、规则解析、范围判定），宿主 Agent 用自身 LLM 执行实际审查，OCR 端无需配置 LLM。流程为 `ocr delegate preview` → `ocr delegate rule` → git 取 diff → 逐文件 3 维度审查 → 按 Critical/High/Medium/Low 分级报告。
- **内置模式**（未检测到 `ocr` 时降级）：**2 维度审查** —— 沿用原有双轴（标准 / spec）并行子 agent 流程，无「规则」维度。
- 「规则」维度是 OCR 的工程产出，没有 `ocr` 时该维度不存在，故降级为 2 维度。

## 1.0.0 — 2026-07-06

初始版本，翻译自 mattpocock/skills。
