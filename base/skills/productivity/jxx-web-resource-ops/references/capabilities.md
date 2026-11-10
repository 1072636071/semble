# 能力注册表（已实证投影）

本表只登记**已在浏览器实证过**的能力。站点能力会变，本表是投影不是承诺；**不代表覆盖站点全部能力**。
浏览器操作细节一律指向 [jxx-browser-roundtrip](../SKILL.src.md) 的 `references/roundtrip-scripts.md`，本表不复制。

登记日期：2026-11-10。新增或变更一行前必须先在浏览器实证，并在本行写明证据文件与日期。

| 站点 id | 站点 | 能力 | 触发方式 | 产物可得性 | 依据 |
| --- | --- | --- | --- | --- | --- |
| `deepseek-web` | chat.deepseek.com | `web-search` | 纯文字提问；智能搜索开关默认 `aria-pressed=true`，**不要点** | 回答 + 来源链接可得 | 往返技能 §二 |
| `deepseek-web` | chat.deepseek.com | `chat` | `textarea[name=search]` + Enter | 文本可得 | 往返技能 §一 |
| `yuanbao` | yuanbao.tencent.com | `image` | 纯文字；`div.ql-editor[contenteditable]` | 图片链接可得 | 往返技能 §三 |
| `yuanbao` | yuanbao.tencent.com | `video` | 纯文字「请生成一段…视频」 | **已生成但产物取不到，交用户手动下载** | 往返技能 §三 + 用户裁定边界 |
| `doubao` | doubao.com | `image` | 纯文字；`div.tiptap.ProseMirror` | 图片链接可得（签名 URL 会过期） | 往返技能 §三 |
| `doubao` | doubao.com | `video` | **新对话发完整参数句 +「无需确认，直接开始生成」**；不要点确认按钮 | **已生成但产物取不到，交用户手动下载** | 往返技能 §三 + 用户裁定边界 |
| `qianwen` | qianwen.com | `image` | 纯文字 | 图片链接可得 | 往返技能 §三 |
| `qianwen` | qianwen.com | `video` | 「AI生视频」入口或纯文字；异步排队、消耗积分 | mp4 直链可得 | 往返技能 §三 |

## 登记新能力

1. 由 agent 在浏览器实证：能触发、能观察到结果、记录页面原话与来源 URL 或会话 id。
2. 在本表追加一行，写站点 id、能力、触发方式、产物可得性、依据文件与日期。
3. 同步在 evals 里加一条正例。
4. 未实证的能力不登记；登记了但后续失效，用「修正」流程改本行并注明日期与原因，不删历史说明。

## 已知边界（不再重试）

- 元宝、豆包视频产物封在自定义播放器里：页面文案确认生成，DOM 无 mp4/直链/下载控件。用户 2026-11-10 裁定「抓不到就抓不到，让用户自己操作下载」。任何能力调用撞到这条即停。
- 额度类数字不写进本表；额度在运行时台账里，按观测追加。
