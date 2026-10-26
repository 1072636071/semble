---
name: jxx-agnes-image
description: Agnes Image 生图与改图。当用户要生成图片、画图、改图、多图合成、风格迁移、做海报封面时触发。触发词：生图、画图、改图、图生图、agnes 绘图。
version: 1.0.1
---

<!--en-->
# Agnes Image 2.5 Flash

Client skill for the Agnes Image 2.5 Flash API. One zero-dependency Node script covers every documented
capability: text-to-image, image-to-image, multi-image composition, size tiers with aspect ratios, URL or
Base64 output, and automatic Data URI conversion for local files.

## When to use

Use when the user wants to generate, edit, restyle or compose images with the Agnes image model, or mentions
agnes-image-2.5-flash. The script enforces the documented request shape and returns a JSON result with the
output path, byte size and sha256.

## Quick start

```bash
export AGNES_API_KEY="sk-..."   # or pass --key <key>
node scripts/agnes-image.mjs sizes                    # size tier x ratio pixel table
node scripts/agnes-image.mjs text --prompt "..." --size 2K --ratio 16:9
node scripts/agnes-image.mjs img2img --prompt "..." --image input.png
node scripts/agnes-image.mjs compose --prompt "..." --image a.png --image b.png
```

Reference images are supported; failures are usually HTTP 503 `image queue is full` (server-side congestion), not a
restriction on reference images. Back off and retry, or generate a text-only variant meanwhile.

Keep in sync with the Chinese body below.
<!--/en-->

# Agnes Image 2.5 Flash：生图 / 改图 / 多图合成

> **单一维护源**：源在 JwikisSkills `base/skills/productivity/jxx-agnes-image/`，由
> `node base/scripts/ship.mjs install` 分发到各 harness 技能目录。改脚本或文档改这里，改完重跑 `ship install`。
>
> **凭据纪律**：API key 只从环境变量 `AGNES_API_KEY` 或 `--key` 现取现用，**不要写进仓库、文档、回显或日志**。
> 官方文档明确要求：不要在前端代码、日志或公开仓库中暴露 API Key。

## 何时用

用户要**生成图片 / 画图 / 改图 / 多图合成 / 风格迁移**，或点名 Agnes 图像模型（`agnes-image-2.5-flash`）。
触发词：生图、画图、生成图片、改图、图生图、多图合成、风格迁移、海报、封面图、产品图、社交媒体素材、agnes 绘图。

不适用：要做视频 → `jxx-agnes-video`；要查图片资产/知识库 → `weknora-kb-ops`。

## 前置条件

- Node.js >= 18（用内置 `fetch`，零依赖，不需要 `npm install`）
- Agnes AI API key（免费档即可，当前所有分辨率与参考图均免费）
- 图生图输入图：公共 HTTPS URL，或本地文件路径（脚本自动转 Data URI Base64）

## 三步跑通

### 1. 设 key

```bash
export AGNES_API_KEY="sk-..."
```

### 2. 选命令

| 需求 | 命令 |
|---|---|
| 文生图 | `node scripts/agnes-image.mjs text --prompt "..." [--size 2K] [--ratio 16:9]` |
| 图生图（1 张输入） | `node scripts/agnes-image.mjs img2img --prompt "..." --image input.png` |
| 多图合成（2..N 张） | `node scripts/agnes-image.mjs compose --prompt "..." --image a.png --image b.png` |
| 查尺寸表 | `node scripts/agnes-image.mjs sizes` |
| 看全部参数 | `node scripts/agnes-image.mjs help` |

### 3. 读结果

成功时 stdout 输出 JSON：`mode` / `url` / `file`（落盘路径）/ `bytes` / `sha256` / `revised_prompt`。
失败时 stderr 输出 `{ ok:false, error, hints[] }`——`hints` 是按官方文档的「常见错误」表逐条生成的修复建议，先看它再动手。

## 参数速查（与官方文档一致）

| 参数 | 必填 | 说明 |
|---|---|---|
| `--prompt` | 是 | 生成或编辑指令 |
| `--size` | 否 | `1K` / `2K` / `3K` / `4K`，默认 `1K`；也接受 `1024x768` 历史写法（不受支持的会被标准化） |
| `--ratio` | 否 | `1:1` `3:4` `4:3` `16:9` `9:16` `2:3` `3:2` `21:9`，默认 `1:1` |
| `--image` | img2img/compose 必填 | 输入图，可重复传多张；本地路径自动转 Data URI |
| `--format` | 否 | `url`（默认）或 `b64` |
| `--out` | 否 | 输出文件或目录，默认 `.temp/agnes-image/agnes-<时间戳>.<ext>` |
| `--no-download` | 否 | 只打印 URL 不下载 |
| `--b64-stdout` | 否 | 把纯 Base64 串写到 stdout（管道喂给别的 API） |
| `--timeout-ms` | 否 | 默认 360000（文档建议 60s–360s） |
| `--verbose` | 否 | 打印实际请求体（Data URI 会截断） |
| `--dry-run` | 否 | 只打印将要发送的请求体，不实际调用（核对参数用，不花配额） |

## 能力覆盖（官方文档全量）

| 文档能力 | 脚本落点 |
|---|---|
| 文生图 | `text` 子命令 |
| 图生图 | `img2img` 子命令（`extra_body.image` 传 1 张） |
| 多图合成 | `compose` 子命令（`extra_body.image` 传 2..N 张） |
| 尺寸档位 1K/2K/3K/4K | `--size` |
| 8 种宽高比 | `--ratio` |
| URL 输出 | 默认（`extra_body.response_format: "url"`） |
| Base64 输出 | `--format b64`（文生图走 `return_base64: true`） |
| Data URI 输入 | 本地文件自动转 `data:image/...;base64,...` |
| 输出尺寸速查表 | `sizes` 子命令 |
| 请求体自检 | `--dry-run`（不发送，打印将发出的 JSON） |

## 请求体形状（脚本已固化，别手改）

```json
{
  "model": "agnes-image-2.5-flash",
  "prompt": "...",
  "size": "2K",
  "ratio": "16:9",
  "return_base64": false,
  "extra_body": {
    "image": ["https://.../input.png"],
    "response_format": "url"
  }
}
```

三条官方红线，脚本已内置，手写 curl 时别踩：

1. **`response_format` 绝不能放请求体顶层**，必须放 `extra_body.response_format`。
2. **图生图输入图必须放 `extra_body.image`**，不是顶层 `image`。
3. **不要传 `tags: ["img2img"]`**——该模型不需要。

## 尺寸 × 宽高比输出像素表

`node scripts/agnes-image.mjs sizes` 随时可查。要点：

- `size` 是**档位**（1K/2K/3K/4K），实际像素由 `size` × `ratio` 共同决定。
- `1920x1080` / `2560x1440` 是显示器分辨率，**不是**该模型原生输出尺寸；不受支持的精确尺寸可能被标准化
  （例如映射成 16:9 的 1K 输出 `1312x736`）。
- 要 16:9 全屏素材：请求 `--size 2K --ratio 16:9`（得 `2624x1472`），再在下游裁剪。

## 提示词结构（官方推荐）

| 工作流 | 结构 |
|---|---|
| 文生图 | `[主体] + [场景/环境] + [风格] + [光照] + [构图] + [质量要求]` |
| 图生图 | `[改变要求] + [新风格/场景] + [要增删的元素] + [要保留的元素]` |
| 多图合成 | `[每张参考图的角色] + [目标场景] + [图间关系] + [风格/光照/构图]` |
| 高信息密度 | 说清视觉层级：主要主体、背景环境、重要次要细节、风格、光照、构图约束 |

图生图想保留构图，就在提示词里显式写「保留原始构图 / 相机角度 / 主体布局」。

## 错误处理与已知限制

### 官方文档记载

| 现象 | 处理 |
|---|---|
| 400 + `response_format` 相关 | 移到 `extra_body.response_format` |
|---|---|
| 图生图缺 `image` | `--image` 必填（img2img/compose） |
| 输入图 URL 打不开 | 换公共 HTTPS URL，或用本地文件路径让脚本转 Data URI |
| 请求超时 | 客户端超时设 60s–360s；`--timeout-ms` 可调 |

### 2026-10-20 实测发现（官方文档未记载）

| 现象 | 脚本行为 |
|---|---|
| HTTP 503 `image queue is full` | 自动退避重试 4 次（每次 15s）；仍失败则报错并提示稍后再试 |
| HTTP 429 `rate_limit_exceeded`（免费用户限流） | 自动退避重试 3 次（每次 30s） |
| HTTP 400 `invalid_request`：`image must be a public http(s) URL or valid image base64` | 服务端抓不到参考图 URL（实测 wikimedia 图床被拒）。脚本不做预检，改用本地文件（自动转 Data URI）或 Agnes 自己的输出 URL |

重试日志走 stderr（`[retry] ...`），不污染 stdout 的 JSON 结果，可放心 `| jq`。

### 2026-10-21 实测：参考图可用，瓶颈是队列

**结论：带参考图的调用没有被禁用。** 图生图与多图合成都能出图；失败几乎全部是 503 队列容量问题，
不是权限、账号、参数或「参考图不让用」。

| 事实 | 实测证据（2026-10-21 16:50–17:15，同一 key 同一时段） |
|---|---|
| 参考图可用 | `img2img` 4 次探测 2 次成功（均靠内置 503 退避翻盘）；另一轮 1 次直接成功；`compose` 2 张参考图 1 次成功（经 1 次退避） |
| 文生图队列健康 | `text` 2/2 首次请求即成功，零重试 |
| 参考图队列常年拥堵 | 同一时段带参考图的 5 次调用**全部先吃 503**，靠退避成功 3 次，耗尽 4×15s 仍失败 2 次 |
| 输入形态不影响成败 | Agnes storage HTTPS URL 与本地 Data URI 都出现过 503；8×8 像素的极小 Data URI 也照吃 503 |

处置顺序：

1. 看 `message`：`image queue is full` = 容量，错峰重试；`image must be a public http(s) URL ...` = 参考图抓不到，换输入。
2. 参考图优先**本地文件路径**（脚本转 Data URI），别用第三方图床；Agnes 自己的输出 URL 也可用。
3. 退避 4×15s 仍失败就别连续重压，隔几分钟再跑；同一时段文生图往往照常可用，可先出 text 版占位。
4. 不要为了绕 503 去改 `model` / `size` / `extra_body` 形状——参数是对的，重试才是解法。

## 计费

当前**所有输出分辨率档位和输入参考图片均免费**（前 3 张参考图按刊例价也不收费）。
免费政策如有调整以 Agnes AI 平台公告为准，因此脚本**不做任何计费假设**，也不缓存价格。

## 检查清单

- [ ] model 用 `agnes-image-2.5-flash`
- [ ] 端点 `POST https://apihub.agnes-ai.com/v1/images/generations`
- [ ] 文生图含 `model` + `prompt` + `size`
- [ ] 要可预期尺寸就用档位式 `size` + `ratio`
- [ ] 图生图/多图合成的输入图放 `extra_body.image`
- [ ] 没有把 `response_format` 放顶层，没有传 `tags: ["img2img"]`
- [ ] 参考图用本地文件（自动 Data URI）或 Agnes 输出 URL，不用第三方图床
- [ ] 报 503 `image queue is full` 先重试/错峰，不改参数、不换模型
- [ ] key 没进仓库/日志/回显

## 参考

- 官方文档：<https://www.agnes-ai.com/zh-Hans/docs/agnes-image-25-flash>
- 参考模型（能力/价格同档）：Agnes Image 2.1 Flash、Agnes Image 2.0 Flash
- 视频生成姊妹技能：`jxx-agnes-video`

