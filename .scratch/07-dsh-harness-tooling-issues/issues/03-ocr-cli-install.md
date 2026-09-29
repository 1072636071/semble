# 安装 ocr CLI 恢复 3 维度审查

**Status:** ready-for-agent

**Blocked by:** 无——可立即开始

**构建内容：** 在开发机安装 `@alibaba-group/open-code-review`，让 `/jxx-code-review` 恢复 3 维度（标准 + spec + 规则）。

**验收标准：**

- [ ] `ocr --version` 有输出
- [ ] `/jxx-code-review` 不再降级为 2 维度

## 评论

- [2026-09-29] 创建：75-b04 / 76-b01b 会话实证本机无 ocr，审查恒为 2 维度，缺「规则」维度（NPE、线程安全、XSS、SQL 注入等）。
