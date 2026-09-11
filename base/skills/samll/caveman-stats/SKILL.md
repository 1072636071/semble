---
name: caveman-stats
description: >
  显示当前会话的真实 Token 用量和预估节省量。
  直接读取 Claude Code 会话日志，非 AI 估算。
  触发方式：/caveman-stats。输出由 mode-tracker 钩子注入；
  模型本身不计算这些数值。
---

本技能由 `hooks/caveman-stats.js` 提供（在 `/caveman-stats` 时由 `hooks/caveman-mode-tracker.js` 读取）。此技能触发时，模型无需执行任何操作——钩子返回 `decision: "block"` 并将格式化的统计数据作为 reason 传入。用户立即看到数值。
