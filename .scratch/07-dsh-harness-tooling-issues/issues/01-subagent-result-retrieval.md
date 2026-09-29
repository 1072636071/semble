# subagent 后台结论取回通道

**Status:** ready-for-agent

**Blocked by:** 无——可立即开始

**构建内容：** 给 `subagent({run_in_background:true})` 的 continuable 子代理一个取回结论的通道，或文档化规避方案。

**验收标准：**

- [ ] `subagent({run_in_background:true})` 后能通过某种机制（job_output / send_message / 轮询）取回子代理结论
- [ ] 或：文档明确「需要就地消费结论就用 `run_in_background: false`」并在 starter/dev.md 固化

## 评论

- [2026-09-29] 创建：75-b04 会话实证 `subagent({run_in_background:true})` 只回 `{"kind":"continuable","subagentId":"…"}`，`job_list` 返回空数组，`send_message` 报 active teammate not found。产出全废。
