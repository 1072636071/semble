---
name: jxx-grill-me
description: 一场 relentless 的 grill 追问，用以打磨（sharpen）计划或设计。
disable-model-invocation: true
metadata:
  version: 1.0.1
---

启动 `/jxx-grilling` 会话。

## 输入
- 用户的计划或设计（在对话中直接提供，无文件参数要求）。

## 输出
- 由 `/jxx-grilling` 会话产出：逐条追问记录与共同确认后的方案。

## 前置条件
- 依赖同仓库的 `/jxx-grilling` skill，需其可被宿主触发。
- 用户需提供待 review 的计划或设计。

## 异常处理
- `/jxx-grilling` 不存在或不可触发：提示用户确认 `/jxx-grilling` skill 已安装。
- 用户未提供计划/设计：先请用户给出待 review 的内容，再启动会话。

## 错误处理与日志
- 本 skill 为启动型薄封装，无本地日志；异常信息由宿主会话直接反馈给用户。

## 反模式

- **本技能直接执行 grill** — 它是启动型封装，实际追问交给 `/jxx-grilling` 会话。
- **不校验前置条件** — 用户未提供计划/设计时先请用户给出内容，再启动会话。
