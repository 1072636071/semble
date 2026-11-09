# 已实证的脚本骨架与踩坑清单

本文件只放实证过的形态，不复制 ego-browser 官方指南。每次开工先跑 `ego-browser skill`。

## 一、最小往返（2026-11-09 实证通过）

要点：`taskSpace` 一次；`page.fill('textarea[name="search"]', text)`；`page.press(..., "Enter")`；
`page.evaluate` 读 `document.body.innerText`，判用户原文与回答标记都在；`task.finish({ keep: [] })`。
结果：`FILL_OK=true`、用户消息原文在、助手回答在、自定义标记在。

## 二、联网搜索核验（2026-11-09 实证通过）

- 开关状态：`aria-pressed="true"`、class 含 `ds-toggle-button--selected` = 已开。**不要点**。
- 提问里明写「请联网搜索…并附上来源网页链接」。
- 成功判据（都从页面取）：`搜索到 N 个网页`、`浏览 N 个页面`、`本回答由 AI 生成`、
  外链 `a[href^=http]` 里出现非 deepseek.com 域名、思考链里没有「无法网络 / 凭知识」。
- 失败形态：多点开关后，模型思考链写「我们无法网络，但可凭知识」「不能瞎编」，给的数字是估算，无外链。

## 三、多媒体探测（待实测，骨架）

对每个目标站点分别判：
1. 输入框附近有无「图片 / 视频 / 生成」入口（snapshot 取 ref）。
2. 生成后页面出现 `img` / `video` / `<a href$=".png|.jpg|.mp4">` 或下载事件。
3. 能否用 `page.waitForEvent("download")` 拿产物，或至少拿到资源 URL。
4. 结果写 `{ site, image: {found, urls[]}, video: {found, urls[]}, note }`。

## 四、踩坑

| 坑 | 处置 |
| --- | --- |
| PowerShell 无 heredoc、5.1 吃双引号 | 整轮写 UTF-8 `.mjs`，`file:///` 正向斜杠导入；中文只放文件 |
| 每轮新进程、变量不保留 | 结果写文件；用同名 TaskSpace / spaceId 续 |
| `waitForFunction` 超时 | 仍提取再报；超时 ≠ 没生成 |
| `job_output` 增量读 | 第一次消费流，必要时让脚本落 JSON 文件再 read |
| 长任务 | `run_in_background: true` + `job_list` 确认结算 |
| 站点开关已开 | 读 `aria-pressed`，别点 |
| 测试会话 | 用户习惯不删，保留 |
| 输出混入 token | 结果落文件前脱敏；口令绝不进仓库或回复 |
