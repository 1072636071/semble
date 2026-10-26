---
name: jxx-wait-what
description: "当 agent 刚说过什么而用户没听懂时，用更简单的说法重讲上一段回答。当用户说没看懂、wait what 时触发。"
disable-model-invocation: false
metadata:
  version: 1.0.0
x-install: false
---

用简化的技术英语解释你刚才的回答，使用 `CONTEXT.md`（若存在）中的共享词汇（shared vocabulary）。
