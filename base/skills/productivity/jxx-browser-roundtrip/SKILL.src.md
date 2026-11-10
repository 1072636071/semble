---
name: jxx-browser-roundtrip
description: 用 ego-browser 在已登录的 AI 网页端做「贴入 → 生成 → 读回」往返采集。当用户要把 DSH 会话内容贴进网页端、让网页版搜索或生成图片/视频并取回结果时触发，触发词：网页版搜索、贴到网页端、往返测试、多媒体能不能拿到。不包含自建私有接口客户端、PoW/SSE 解析、也不替用户研判行业数据真伪；浏览器通用操作交给 ego-browser。
disable-model-invocation: true
user-invocable: true
x-install: true
metadata:
  version: 0.1.0
x-vendors:
  codearts:
    product: codebuddy
    tags: [jxx-browser-roundtrip, codebuddy]
    description-en: |-
      1. Round-trip collection against logged-in AI web chats via ego-browser.
      2. Triggered by: web search, paste into web chat, roundtrip test, media output probe.
      3. Avoids private API clients, PoW, and SSE parsing by driving the real page.
      4. Usage: open page → check login → fill → press Enter → wait → extract → finish.
      5. Requires ego lite with a logged-in profile; all scripts run as UTF-8 .mjs files.
  codebuddy:
    allowed-tools: [read_file, write_file, run_command]
  opencode:
    license: MIT
  trae: {}
---

<!--en-->
# jxx-browser-roundtrip

Drive a logged-in AI web chat with ego-browser and read the result back. Use one
background script per round; write the result to a file and read that file.

## Input
A target URL, a text payload to paste, and an optional probe (search, image, video).

## Workflow
1. Run `ego-browser skill` once and follow the printed guide for the installed version.
2. Write the whole round as one UTF-8 `.mjs` file under the temp directory. Never pass
   Chinese text through a `-e` argument; keep it inside the file.
3. In the script: create/resume one TaskSpace, go to the URL, check `localStorage.userToken`
   for login state, then act on the page with `page.fill()` and `page.press()`.
4. Do not toggle a switch that is already on: read `aria-pressed` first. A toggle that is
   already `true` becomes `false` when clicked and disables the feature.
5. Wait on an observable condition, then write `{ login, sent, completed, answer, links }`
   as JSON to an absolute temp file. A `waitForFunction` timeout does not mean no answer
   was produced; still extract and report.
6. Call `task.finish({ keep: [] })` exactly once. Keep test sessions and browser state
   unless the user asks to remove them.
7. Read the result file with the read tool and report only what it contains.

## Output format
A short Chinese report: whether login, send, generation, and read-back each succeeded;
the extracted answer; any source links; and an explicit note when numbers came from the
model rather than verified sources.

## Boundaries and failures
- Do not build or run a private-API client, solve PoW, or parse SSE frames.
- Do not paste user profile data, tokens, cookies, or credentials to any web chat.
- Do not claim a number is true because the page printed it; mark it as unverified.
- Media output: report whether a link or download is obtainable; do not promise quality, copyright, or availability. **When a page says a video is ready but exposes no direct URL or download control, report it and stop — hand the session to the user to download manually.** Do not keep polling, swapping selectors, or probing the player. Confirmed by the user on 2026-11-10.
- On `EGO_TASK_SPACE_NAME_IN_USE` pick another space name; never start a second space
  to recover from a stuck page.
- Long rounds run as background jobs; collect them with `job_list` before the final answer.
- If the browser is not logged in, stop and report `ERR_NOT_LOGGED_IN`; ask the user to
  sign in. Never attempt to automate a login.
<!--/en-->

# jxx-browser-roundtrip

用 ego-browser 驱动**已登录**的 AI 网页端，把内容贴进去、让页面自己生成、再把结果读回来。请求由页面发出，不自建私有接口客户端。

## 输入

- 目标 URL（必填）。
- 要贴入的文本（必填）。
- 探测目标（可选）：搜索 / 图片 / 视频 / 纯往返。

## 前置

先跑一次 `ego-browser skill`，按它打印的、与本机版本匹配的指南执行。本机 ego lite 已装时直接开工；未装或报未知命令时读 `references/install.md`。

## 流程

1. **一个任务空间一个目标**：`taskSpace("<目标名-日期>")` 建一次，后续轮用同名或 `spaceId` 续，不另开空间救卡住的页。
2. **整轮写成一个 UTF-8 `.mjs` 文件**放临时目录，用 `ego-browser nodejs -e "await import('file:///...')"` 执行。中文只能放文件里，不进 `-e` 参数；PowerShell 无 heredoc、5.1 会破坏双引号。每轮写新文件，不改旧文件（旧文件会重放已跑过的步骤）。
3. **先验登录态**：`page.goto(url)` 后用 `page.evaluate()` 读 `localStorage.userToken` 与页面有无登录入口。未登录 ⇒ 停，报 `ERR_NOT_LOGGED_IN`，让用户自己登；不代登、不自动化登录。
4. **别乱点开关**：先读开关的 `aria-pressed`。已为 `true`（class 常带 `--selected`）就别点——点一下会关掉功能。实证：智能搜索本来开着，多点一次导致模型只能凭记忆估数字、自述「无法网络」。
5. **贴入与发送**：`page.fill(selector, text)` → 回读输入框确认逐字进去了 → `page.press(selector, "Enter")`。
6. **等可观察结果**：用 `waitForFunction` 等回答完成标记，别用固定长睡。超时也要继续提取再报告——超时不等于没生成。
7. **提取并落文件**：把 `{ loggedIn, sent, completed, answer, externalLinks, media }` 写成 JSON 到**绝对路径**临时文件。DOM 精确取不到时退回 `document.body.innerText` 切片，并在结果里标明 `source`。
8. **收尾**：`task.finish({ keep: [] })` 只调一次。**测试会话按用户习惯保留，不删**；想留结果页才 `keep: [label]`。
9. **读文件回话**：用 read 工具读结果文件，只报文件里有的事实。

## 输出格式

中文短报，逐项给结论：登录 / 贴入 / 生成 / 读回 各自是否成功；提取到的回答；来源链接；数字若来自模型而未独立核验，明写「未经核验」。

## 边界与失败

- 不写私有接口客户端、不解 PoW、不解析 SSE 帧、不抓 token。
- **不把用户画像、token、cookie、凭据贴进任何网页端**；只用无害技术结论做样本。
- 不因为页面打印了数字就说它为真；只报「网页端给出」，核验另算。
- 长轮次用后台作业（`run_in_background`），收尾前用 `job_list` 确认作业已结算；`job_output` 的增量读法会消费流，必要时让脚本把结果写文件再读。
- `EGO_TASK_SPACE_NAME_IN_USE` ⇒ 换空间名，或问用户是否接管；不擅自 claim。
- 网页端改版导致选择器失效 ⇒ 报 `ERR_SELECTOR_CHANGED`，附当前 snapshot，不猜新选择器。
- 多媒体产物只判断「能否拿到链接 / 能否下载」，不承诺画质、版权或可用性。
- **取不到就停**：页面确认已生成、但 DOM 里没有直链/下载按钮时，回报「已生成、产物需用户自行下载」，把会话留给用户操作。不轮询、不换选择器重试、不深挖播放器内部——继续试不改变结果。用户已确认这条边界（2026-11-10）。

## 参考

- `references/roundtrip-scripts.md` —— 已实证的脚本骨架（往返、联网搜索核验、多媒体探测）与踩坑清单。
