# open-code-review-delegate

OCR（open-code-review）官方**委托模式**技能。OCR 只负责确定性工程（文件筛选、规则解析、范围判定），由**宿主 Agent 用自身 LLM** 执行实际代码审查 —— OCR 端不调用任何 LLM，因此无需配置 API Key 或模型端点。

适用于订阅制 AI 编码代理（Claude Code、Codex、Cursor、Open Code、Qoder 等），复用宿主已有的 LLM 额度完成审查。

## 来源

- 上游：https://github.com/alibaba/open-code-review
- 许可证：Apache-2.0
- 上游版本：1.0.0

本副本由下述命令下载后入库。**请勿手工改写本文件** —— 需改动请提上游，或另建衍生技能。

## 安装 / 更新

```bash
npx skills add alibaba/open-code-review --skill open-code-review-delegate
```

## 前置条件

只需 `ocr` CLI：

```bash
which ocr || npm install -g @alibaba-group/open-code-review
```

委托模式**不需要** `ocr config set` 或任何 LLM 环境变量。

## 工作流程

1. `ocr delegate preview` — 确定审查范围（mode、ref 元数据、可审文件、已排除文件及原因）
2. `ocr delegate rule <path...>` — 获取按规则内容分组的规则
3. 按 mode 用 git 取 diff（range / commit / workspace）
4. 宿主 Agent 逐文件审查
5. 按 Critical / High（必报）、Medium（带上下文）、Low（静默丢弃）分级报告

## 相关技能

- `/jxx-code-review` — 本项目自己的代码审查技能，已内置委托模式：检测到 `ocr` 时启用 3 维度审查（标准 + spec + 规则），未检测到时降级为 2 维度。
