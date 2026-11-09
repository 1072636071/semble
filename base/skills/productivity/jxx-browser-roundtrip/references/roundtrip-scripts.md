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

## 三、多媒体探测（2026-11-09 实证）

| 站点 | 图片 | 视频 | 备注 |
| --- | --- | --- | --- |
| 元宝 yuanbao.tencent.com | ✅ 拿到 2 个 `cdn-pro.yuanbao.tencent.com/public/pro/*.webp` 链接，约 3s | ❌ 首页无视频入口（已补测） | 首页有「AI 生图」「AI 创作」；展开「更多」后按钮清单仍只有深度研究/专业写作/PPT/AI 生图/数据分析等，无生视频；输入框是 `div.ql-editor[contenteditable]` |
| 豆包 doubao.com | ✅ 拿到 6 个 `p*-flow-imagex-sign.byteimg.com/*.png` 链接，约 100s | ❌ 首页无视频入口（已补测） | 输入框是 `div.tiptap.ProseMirror`；展开「更多」后可见「AI 创作」但按钮清单无生视频；签名 URL 带 `x-expires` 会过期 |
| 千问 qianwen.com | ✅ 拿到 2 个 `images.quark.cn/.../*.webp` 链接，约 9s | ✅ 拿到 mp4（第二轮） | 「AI生视频」入口可点进；首次 120s 内排队未完成（报「当前访问火爆…预计 2-5 分钟…消耗 30 积分」）；约 10 分钟后页面显示「已经生成好啦～请查收 00:05」，从 `workspace-zb-cdn.qianwen.com/*.mp4` 与 `quark-aistudio-cdn.quark.cn/*.mp4` 拿到 8 个链接（含带水印版与封面图） |

要点：
- 图片 URL 都是**页面 DOM 里 `img[src]` 的新增值**（对比生成前快照 + 排除 icon/logo/avatar 域名），不需要下载事件即可拿到链接。
- 视频在千问是**异步排队 + 积分消耗**（30 积分/5s，720P），等 2–5 分钟且要够积分；**脚本超时不等于没有产物**，隔几分钟重新打开同一会话取即可。视频 URL 从 `video/source/a[href]` 与页面 HTML 里的 `.mp4` 直链一起抓，别只等 `<video>` 标签。
- 元宝/豆包的首页按钮清单里**没有独立生视频入口**，所以补测判为「无入口」而非「生成失败」；这不排除藏在「AI 创作」二级页里，需要时再展开测。
- 三站输入框都不是 `<textarea>`：用 `div[contenteditable=true]`，`page.click` → `keyboard.insertText` → `page.press(..., "Enter")`。
- 判断「新产物」用生成前 URL 快照做差集，别把页面自带的装饰图当产物。

## 三·旧、多媒体探测骨架（保留作模板）

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
