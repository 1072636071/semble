# Changelog

## 1.1.0 — 2026-09-17

新增**委托模式**（Delegation Mode）作为内置执行模式之一：

- 流程新增「步骤 0：选择执行模式」——按环境是否安装 `ocr` CLI 自动选择。
- **委托模式**（检测到 `ocr` 时启用）：**3 维度审查** —— 标准 + spec + **规则**。OCR 负责确定性工程（文件筛选、规则解析、范围判定），宿主 Agent 用自身 LLM 执行实际审查，OCR 端无需配置 LLM。流程为 `ocr delegate preview` → `ocr delegate rule` → git 取 diff → 逐文件 3 维度审查 → 按 Critical/High/Medium/Low 分级报告。
- **内置模式**（未检测到 `ocr` 时降级）：**2 维度审查** —— 沿用原有双轴（标准 / spec）并行子 agent 流程，无「规则」维度。
- 「规则」维度是 OCR 的工程产出，没有 `ocr` 时该维度不存在，故降级为 2 维度。

## 1.0.0 — 2026-07-06

初始版本，翻译自 mattpocock/skills。
