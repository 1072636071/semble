---
name: effectcraft
description: EffectCraft 动态特效——合成/渲染单帧。当要做特效合成、渲帧、跑 731 条引擎命令时使用。触发词：effectcraft、特效、合成、AE。不用于：视频剪辑与序列导出（filmcraft）、音频混音（soundcraft）；创意方向与调色审美不替用户决定，先给参考或参数。
version: 0.2.0
disable-model-invocation: true
x-install: false  # 2026-10-28 起不外装：原文在 WeKnora 库 dfaaf6fc 的 craft/<name>，本地技能目录不再安装
x-vendors:
  codearts:
    product: codebuddy
    tags: [effectcraft, vfx, after effects, codebuddy]
    description-en: |-
      1. EffectCraft VFX: compositions, single-frame rendering, engine commands.
      2. Triggered by: effectcraft, VFX, compositing, after-effects-like tasks.
      3. CLI runs engine commands and renders frames; one render-frame call needs no project file.
      4. Usage: effectcraft-cli render-frame --out f.png; exec file.newProject; props/get/set on layers.
      5. Requires D:\storytoldExe\EffectCraft\effectcraft-cli.exe (Windows).
  codebuddy:
    allowed-tools: [read_file, search_content]
  opencode:
    license: MIT
  trae: {}
---

<!--en-->
# effectcraft (English)

EffectCraft is a headless After Effects-style compositor driven by `effectcraft-cli.exe` (731 commands, 307 effects, engine 0.13.0).
Use it to render a single frame, walk a layer's property tree, set one property and re-render to check the result.
`render-frame --out f.png` on the built-in project gives 1920×1080 / 614,510 bytes in 190 ms; `--max-side 480` gives 480×270 / 97,468 bytes.
Property paths print with slashes (`transform/position`); `get`/`set` accept both `/` and `.`. Quote `'#1'` — bare `#` starts a shell comment.
<!--/en-->

# EffectCraft：动态特效

After Effects 式合成引擎（headless），`commands` 实测 **731** 条命令、**307** 个特效，引擎 **0.13.0**。
CLI：`D:\storytoldExe\EffectCraft\effectcraft-cli.exe`（目录名 `EffectCraft` **无尾随空格**，exe 全小写）。

## 何时用 / 不用于

- 用：渲单帧 PNG（`render-frame`）；渲视频（`render`，h264/hevc/prores/webm/png…）；
  读/写图层属性（`props` → `get`/`set`）做快速迭代；跑引擎命令与 JSX 脚本（`exec`/`run`/`script`）。
- 不用于：整条片子的剪辑与序列导出（用 filmcraft）、音频混音（用 soundcraft）；
  创意方向、配色审美不替用户拍板，先要参考图或明确参数。

## 输入

- 需要给：工程文件（`.ecproj`）或什么都不给（默认内置工程 + 活动合成 `502 "EffectCraft Intro"`）；
  要渲自己的东西就给合成 id/名字、图层、属性路径。
- 可选：`--time S` / `--frame N`（时间点）、`--max-side PX` / `--scale K`（缩图）、`--transparent`、
  `--resolution quarter|half|full|K`、`--quality best|draft`、`--progress`（非终端时往 stderr 打进度）。
- `--empty` 给空工程：那时没有 `#1` 图层，`props`/`get` 会直接报错。

## 最小闭环（2026-10-28 实测）

```sh
E=/d/storytoldExe/EffectCraft/effectcraft-cli.exe
mkdir -p .temp/craft-runs/effectcraft && cd .temp/craft-runs/effectcraft
timeout 180 "$E" info                     # 731 commands, 307 effects, active comp 502 1920x1080 @29.97, 10.01 s
timeout 180 "$E" render-frame --out frame.png
# → rendered 1920x1080 at 2.502s in 190.7 ms -> frame.png
timeout 180 "$E" render-frame --max-side 480 --out small.png
# → rendered 480x270 at 2.502s in 18.8 ms -> small.png
```

真实产物：`frame.png` = **614,510 字节** / 1920×1080 / 190.7 ms；
`small.png` = **97,468 字节** / 480×270 / 18.8 ms。空工程也能渲帧，试手不需要先建文件。

出视频（缩到 1 秒、quarter 分辨率，同一轮实测）：

```sh
timeout 300 "$E" render --comp 502 --out clip.mp4 --format h264 \
  --start 0 --end 1 --resolution quarter --progress
# → EffectCraft Intro → clip.mp4 (480×270, 30 frames, H.264 - Match Render Settings - 15 Mbps)
# → done in 0.21s；clip.mp4 = 136,760 字节
```

## 命令怎么发现

- `commands`：731 行纯文本（一行一条）；`commands --json` 是**一整行大 JSON 数组**，
  所以 `grep -c '"id"'` 只会得到 **1**——数命令用 `grep -o '"id"' | wc -l`（=731）或纯文本 `| wc -l`。
- `commands [--filter TEXT] [--enabled]` 过滤；`exec --list` 等价于 `commands`。
- `exec <id> --params '{"…"}'` 跑一条（参数是一整段 JSON）；`run <id> <json> <id> <json>` 顺序跑多条。
- `script FILE.jsx` / `script --eval CODE`：After Effects 风格对象模型（`app.project`、comps、layers、properties）。

## 常用命令族

| 族 | 代表 id | 要点 |
|---|---|---|
| 工程 | `file.newProject` `file.openDemoProject` `file.saveAs` | 默认内置工程，可直接操 |
| 合成 | `comp.new` `comp.open` `comp.settings` | `comp.new` 回 `{"comp":880}`，用 id 而非名字引用 |
| 图层 | `layer.newText` `layer.newSolid` `layer.newShape` `layer.addItem` | 参数全是 JSON 对象 |
| 属性 | `props` / `get` / `set`（CLI 子命令，不是命令 id） | 路径形如 `transform/position` |
| 渲染 | `render-frame` / `render` / `bench` | `bench` 给逐图层耗时 |

## 输出与校验

- `render-frame` 一行文本：`rendered <W>x<H> at <time>s in <ms> ms -> <file>`；随即 `ls -l` 核字节数。
- `render` 一行摘要 + `progress <done> <total> <elapsed> <left>` + `done: … in <s>`；核 `frames` 与 `--end - --start × fps` 相符。
- `props <comp> <layer> --flat` 每行 `路径 / 类型 / 值`，首行给图层 id 与时间点；`get` 回 JSON（`value` `type` `keys` `match`）。
- `exec`/`run` 回 JSON 结果（如 `{"comp":880}`）；`script` 打印 `writeLn` 输出与表达式结果。

## 失败出口

| 症状 | 原因 | 处置 |
|---|---|---|
| 只打印 usage、exit 2 | bash 把 `#1` 的 `#` 当注释，参数少了一个 | 图层参数加引号：`props - '#1' --flat` |
| `No such file`，路径看着没错 | 旧文档把目录写成 `EffectCraft \`（尾随空格） | 用 `D:\storytoldExe\EffectCraft\effectcraft-cli.exe` |
| `get`/`props` 报找不到属性 | 路径写错，或 `--empty` 工程里没有该图层 | 先 `props --flat` 抄真实路径；路径 `/` 与 `.` 都能用 |
| `set` 报类型错 | 值按属性类型解析，不做静默转换 | 按 `get` 回的 `type` 给值：`vec3` → `'[960,540]'`，标量 → 裸数字 |
| 命令计数得到 1 或 731？ | `--json` 是单行数组 | 用 `grep -o '"id"' \| wc -l`；别用 `grep -c` |
| 渲染很慢 | full 分辨率 + 重特效 | 先 `--max-side` 或 `--resolution quarter` 迭代，定了再 full |

## 坑（实测）

- **`#n` 在 bash 里必须加引号**：`props - #1` 会被截成 `props -`，报 usage（exit 2）。
- **`commands --json` 是单行数组**：按行数命令会永远得 1；`--filter` 也一样。
- **默认不是空工程**：`info` 显示内置 demo（合成 502 / 879 / 92 等），活动合成 1920×1080 @29.97003 fps / 10.01 s；
  想干净起手加 `--empty`。
- **属性路径两种写法都收**：`props` 打印 `transform/position`，`get - '#1' transform.position` 同样命中（`match: position`）。
- `exec` 的参数是 `--params JSON`（整段），不是 `key=value`；`run` 的 `<id> <json>` 成对出现，裸数字/`true` 也算合法 JSON。
- `script --eval` 在本轮实测可跑（`writeLn(app.project.numItems)` 打印 0），说明它跑在独立进程的默认上下文里，别指望拿到别的进程的工程状态。

## MCP / 连 GUI

- `effectcraft-cli mcp`：stdio MCP server（JSON-RPC），`--automation-read-root` / `--automation-write-root` 圈定文件访问。
- `--bridge PORT`：连正在跑的 GUI——**需先起 GUI，本轮 headless 未验证**。
