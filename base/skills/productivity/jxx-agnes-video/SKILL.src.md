---
name: jxx-agnes-video
description: Agnes Video 2.5 Flash 视频生成技能——一条命令覆盖文生视频、首尾帧控制、图片/音频参考三种模式，创建任务后自动轮询到底并下载 mp4，内置 Flash 专属参数预校验（720P、图片≤5、音频≤3、禁参考视频）与队列满/限流退避重试。当用户要生成视频、做短片、图生视频、首尾帧动画、参考图/参考音频生成视频，或提到 agnes video、agnes-video-2.5-flash、Agnes 视频时使用。触发词：生成视频、做视频、文生视频、图生视频、首尾帧、视频参考、agnes 视频。
version: 1.0.0
x-install: true
x-vendors:
  codearts:
    product: codebuddy
    tags: [jxx-agnes-video, codebuddy, video-generation]
    description-en: |-
      1. Agnes Video 2.5 Flash client skill covering text-to-video, keyframe control and image/audio reference modes.
      2. Triggered by: generate video, text to video, image to video, keyframe animation, agnes video.
      3. Value: async task creation plus automatic polling and download, with Flash-only validation built in.
      4. Usage: set AGNES_API_KEY, then `node scripts/agnes-video.mjs run text|keyframe|reference --prompt ...`.
      5. Prerequisite: Node.js >= 18, an Agnes AI API key, and publicly reachable media URLs.
  codebuddy:
    allowed-tools: [run_terminal_command, read_file, write_file]
  opencode:
    license: MIT
  trae: {}
---

<!--en-->
# Agnes Video 2.5 Flash

Client skill for the Agnes Video 2.5 Flash API. One zero-dependency Node script covers every documented
capability: text-to-video, first/last frame control, image and audio reference generation, the 720P size
rule, the reference limits, async task polling and mp4 download.

## When to use

Use when the user wants to generate video with the Agnes video model, or mentions agnes-video-2.5-flash.
The script validates Flash-specific rules locally before spending an API round trip, then polls the async
task until it completes or fails.

## Quick start

```bash
export AGNES_API_KEY="sk-..."   # or pass --key <key>
node scripts/agnes-video.mjs ratios                          # aspect_ratio -> pixels
node scripts/agnes-video.mjs run text --prompt "..." --seconds 5
node scripts/agnes-video.mjs run keyframe --prompt "..." --first-frame a.png
node scripts/agnes-video.mjs run reference --prompt "..." --image ref.png
```

Keep in sync with the Chinese body below.
<!--/en-->

# Agnes Video 2.5 Flash：文生视频 / 首尾帧 / 参考生成

> **单一维护源**：源在 JwikisSkills `base/skills/productivity/jxx-agnes-video/`，由
> `node base/scripts/ship.mjs install` 分发到各 harness 技能目录。改脚本或文档改这里，改完重跑 `ship install`。
>
> **凭据纪律**：API key 只从环境变量 `AGNES_API_KEY` 或 `--key` 现取现用，**不要写进仓库、文档、回显或日志**。
> 官方接入检查清单明确要求：不要在前端代码、日志或公开仓库中暴露 API Key。

## 何时用

用户要**生成视频 / 做短片 / 图生视频 / 首尾帧动画 / 用参考图或参考音频生成视频**，或点名 Agnes 视频模型
（`agnes-video-2.5-flash`）。触发词：生成视频、做视频、文生视频、图生视频、首尾帧、视频参考、音频参考、agnes 视频。

不适用：要生成图片 → `jxx-agnes-image`。

## 前置条件

- Node.js >= 18（内置 `fetch`，零依赖）
- Agnes AI API key（免费档即可，当前限时免费）
- **所有媒体 URL 必须公网可访问**，且在任务完成前保持有效。视频接口**不支持** Data URI——本地文件要先上传到公开地址
  （图片接口的 Data URI 能力见 `jxx-agnes-image`）。

## 三步跑通

### 1. 设 key

```bash
export AGNES_API_KEY="sk-..."
```

### 2. 选模式，一条命令到底

`run` = 创建任务 + 自动轮询 + 下载 mp4，最常用：

| 模式 | 命令 | 说明 |
|---|---|---|
| 文生视频 | `node scripts/agnes-video.mjs run text --prompt "..."` | 不传任何媒体 |
| 首尾帧 | `node scripts/agnes-video.mjs run keyframe --prompt "..." --first-frame a.png [--last-frame b.png]` | 首帧与尾帧至少一个 |
| 图片参考 | `node scripts/agnes-video.mjs run reference --prompt "..." --image r1.png [--image r2.png]` | 图片 ≤ 5 张 |
| 音频参考 | `node scripts/agnes-video.mjs run reference --prompt "..." --audio a.mp3` | 音频 ≤ 3 段 |
| 图片+音频参考 | `run reference --image r.png --audio a.mp3` | 两类可同时用 |

只想创建任务、稍后自己查：把 `run` 换成 `create`；查询用
`node scripts/agnes-video.mjs query --video-id <ID> [--wait] [--download <路径>]`。

### 3. 读结果

- 创建成功：stdout JSON 含 `video_id`（**查询要用它，不是 `id`/`task_id`**）。
- 轮询日志走 stderr：`[poll] status=... progress=...`，建议 1–2s 一次。
- 完成时 stdout JSON 含 `status: "completed"`、`url` 与 `download: { file, bytes }`。
- `internal_status` / `internal_progress` 是**内部字段**，即使还是 `pending`/`0` 也以 `status` / `progress` 为准。

## 参数速查（与官方文档一致）

### 公共参数

| 参数 | 必填 | 说明 |
|---|---|---|
| `--prompt` | 是 | 视频内容描述；reference 模式可用 `<Picture N>` / `<Audio N>` 指代素材 |
| mode（子命令） | 是 | `text` / `keyframe` / `reference` |
| `--seconds` | 否 | 字符串 `"4"`–`"12"`，默认 `"5"` |
| `--aspect-ratio` | 否 | 默认 `16:9`，支持 `21:9` `16:9` `4:3` `1:1` `3:4` `9:16` |
| `--seed` | 否 | 随机种子（整数） |
| `n` | — | 当前仅支持 1，脚本固定为 1 |

### 模式专用参数

| 参数 | 适用模式 | 说明 |
|---|---|---|
| `--first-frame` | keyframe | 首帧图片 URL，与 `--last-frame` 至少提供一个 |
| `--last-frame` | keyframe | 尾帧图片 URL |
| `--image` | reference | 参考图片 URL 列表，Flash 最多 5 张 |
| `--audio` | reference | 参考音频 URL 列表，Flash 最多 3 段 |
| `videos` | — | **Flash 不支持**，传入有效内容返回 HTTP 400 |

### 查询 / 轮询选项

| 选项 | 说明 |
|---|---|
| `--wait` | 阻塞轮询到 `completed` / `failed` |
| `--download <路径>` | 完成后下载 mp4（默认 `.temp/agnes-video/agnes-<时间戳>.mp4`） |
| `--no-download` | 只拿 URL 不下载 |
| `--poll-ms <ms>` | 轮询间隔，默认 1500 |
| `--quiet` | 轮询过程不打日志 |
| `--dry-run` | 只打印将要发送的请求体，不实际调用（核对参数用，不花配额） |

## 能力覆盖（官方文档全量）

| 文档能力 | 脚本落点 |
|---|---|
| 文生视频（mode=text） | `run/create text` |
| 首帧 / 尾帧 / 首尾帧控制 | `run/create keyframe` + `--first-frame` / `--last-frame` |
| 图片参考生成 | `run/create reference` + `--image`（≤5） |
| 音频参考生成 | `run/create reference` + `--audio`（≤3） |
| 图片 + 音频同时参考 | `reference` 模式两类同传 |
| 720P 固定尺寸 | 脚本常量，客户端预校验 |
| aspect_ratio 6 种画幅 | `--aspect-ratio` + `ratios` 子命令 |
| seconds `"4"`–`"12"` | `--seconds`（字符串语义） |
| seed / n=1 | `--seed`；`n` 固定 1 |
| 异步任务查询 | `query` 子命令（video_id + model_name） |
| 轮询到完成并下载 | `run` 子命令 / `query --wait` |
| Flash 专属错误预校验 | `flashValidate` + 模式规则表 |
| 请求体自检 | `--dry-run`（不发送，打印将发出的 JSON） |
| `<Picture N>` / `<Audio N>` 指代 | 提示词原样透传（官方约定写法） |

## 模式规则（违反即拒）

| mode | 必需媒体 | 不允许的媒体字段 |
|---|---|---|
| `text` | 无 | `first_frame` `last_frame` `images` `audios` `videos` |
| `keyframe` | `first_frame` 与 `last_frame` 至少一个 | `images` `audios` `videos` |
| `reference` | `images` 或 `audios` 至少一类非空 | `first_frame` `last_frame` `videos` |

脚本在发请求前就按上表拦一遍，错误信息直接指出是哪个字段、哪条规则。

## Flash 专属校验（4 个 HTTP 400）

| 校验项 | Flash 规则 | 服务端响应 |
|---|---|---|
| `size` | 仅支持字符串 `"720P"` | `size must be 720P` |
| 参考图片数 | `images` 最多 5 张 | `images length must not exceed 5` |
| 参考音频数 | `audios` 最多 3 段 | `audios length must not exceed 3` |
| 参考视频 | 不支持有效 `videos` 内容 | `videos is not supported` |

同一次请求有多个错误时，服务端按 `size` → `images` → `audios` → `videos` 顺序返回**第一个**。
这些校验在任务创建、排队、计费和推理**之前**执行，失败的请求不创建任务、不产生费用。

## 尺寸与画幅

`size` 固定 `"720P"`，输出像素由 `aspect_ratio` 决定：

| aspect_ratio | 输出像素 |
|---|---|
| 21:9 | 1680x720 |
| 16:9 | 1280x704 |
| 4:3 | 960x720 |
| 1:1 | 720x720 |
| 3:4 | 720x960 |
| 9:16 | 720x1280 |

16:9 的输出以实际生成文件为准（2026-09 官方实测 720P 为 `1280x704`）。

## 查询任务：两种方式的适用边界

| 方式 | 适用模式 | 建议 |
|---|---|---|
| `video_id` + `model_name=agnes-video-2.5-flash` | text / keyframe / reference 全部 | **推荐**，脚本默认走这条 |
| 仅 `video_id` | 仅 `mode: "text"` | keyframe / reference 必须带 `model_name` |

查询端点：`GET https://apihub.agnes-ai.com/agnesapi?video_id=<ID>&model_name=agnes-video-2.5-flash`
（注意在 `/v1` 之外，与创建端点不同域路径）。

## 错误处理与已知限制

### 官方文档记载

| 现象 | 处理 |
|---|---|
| 400 + 上述四个 Flash 错误 | 按上表改参数；脚本已提前拦下 |
| 任务失败 | 响应 `error` 字段非 null，`status: "failed"` |

### 2026-10-20 实测发现（官方文档未记载）

| 现象 | 脚本行为 |
|---|---|
| HTTP 503 `{"code":"video_queue_full"}` 生成队列满 | `create`/`run` 自动退避重试 5 次（每次 20s） |
| HTTP 429 `rate_limit_exceeded` 免费用户限流 | 自动退避重试 3 次（每次 30s）；仍失败建议错峰或升级 Token Plan |

重试与轮询日志走 stderr，不污染 stdout 的 JSON 结果。

**实测状态（2026-10-20）**：三种模式的请求体已用 `--dry-run` 逐字段比对文档示例一致，
Flash 四项专属校验与模式规则均在本机验证可正确拦下。任务创建接口当日受 503 队列满与 429 免费限流影响，
未能跑通一次完整生成；脚本的退避重试与轮询逻辑已按文档实现，配额恢复后可直接用。

## 计费

公式：`输出秒数 × 输出分辨率单价 + 输入视频秒数 × 单价 + max(0, 图片数 - 5) × 图片超额单价`。
当前**限时免费**：720P 原价 `$0.025/秒`、现价 `$0/秒`，输出秒数、输入视频秒数与参考图片均按 `$0` 计费。
免费政策如有调整以 Agnes AI 平台公告为准，脚本不做计费假设。

## 检查清单

- [ ] 模型 ID 用 `agnes-video-2.5-flash`
- [ ] `size` 固定字符串 `"720P"`
- [ ] `mode=reference` 时 `images` ≤ 5、`audios` ≤ 3、不传 `videos`
- [ ] `seconds` 用字符串 `"4"`–`"12"`，`n` 固定 1
- [ ] 查询用 `video_id` + `model_name`（keyframe/reference 必须带）
- [ ] 媒体 URL 公网可访问且任务完成前有效
- [ ] key 没进仓库/日志/回显

## 参考

- 官方文档：<https://www.agnes-ai.com/zh-Hans/docs/agnes-video-25-flash>
- 同族模型：Agnes Video 2.5（Flash 复用其能力与异步接口，仅限制不同）
- 图片生成姊妹技能：`jxx-agnes-image`

