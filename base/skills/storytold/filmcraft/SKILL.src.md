---
name: filmcraft
description: FilmCraft 视频剪辑——建序列/导入素材/渲染导出。当要剪视频、建 sequence、导出 h264/png 序列时使用。触发词：filmcraft、视频、剪辑、序列、渲染。不用于：音频混音与转码（soundcraft）、合成特效（effectcraft）；手上没有真实素材时先问用户要文件，不要拿空序列当交付。
version: 0.2.0
disable-model-invocation: true
x-install: false  # 2026-10-28 起不外装：原文在 WeKnora 库 dfaaf6fc 的 craft/<name>，本地技能目录不再安装
x-vendors:
  codearts:
    product: codebuddy
    tags: [filmcraft, video, edit, premiere, codebuddy]
    description-en: |-
      1. FilmCraft video editing: build sequences, import media, render and export.
      2. Triggered by: filmcraft, video editing, sequence, render, premiere.
      3. CLI runs a jsonl command script; export is an async job that needs wait:true.
      4. Usage: run script.jsonl with file.newProject → file.newSequence → file.exportMedia(wait:true).
      5. Requires D:\storytoldExe\FilmCraft\filmcraft-cli.exe (Windows).
  codebuddy:
    allowed-tools: [read_file, search_content]
  opencode:
    license: MIT
  trae: {}
---

<!--en-->
# filmcraft (English)

FilmCraft is a headless Premiere-style editor driven by `filmcraft-cli.exe` (701 commands, measured 2026-10-28).
State lives inside one process, so project + sequence + export must share one jsonl script (`run s.jsonl` / `run -`).
`file.exportMedia` is an async job: pass `"wait":true` or the process exits and the file never appears.
Measured: a 320×240 still clip exports to 277,531 bytes / 150 frames; PNG sequences get a `0000` frame suffix.
<!--/en-->

# FilmCraft：视频剪辑

Premiere 式引擎（headless），`commands` 实测 **701** 条命令。CLI：`D:\storytoldExe\FilmCraft\filmcraft-cli.exe`
（目录名 `FilmCraft` **无尾随空格**，exe 全小写）。

## 何时用 / 不用于

- 用：建序列并导出 h264/png/tiff/gif 序列；导入素材、在序列上插入/覆盖、查工程树；
  按导出预设或格式出片；`inspect` 读回工程与序列结构。
- 不用于：音频混音与转码（用 soundcraft）、合成与特效（用 effectcraft）；
  需要真实镜头时先问用户要文件，空序列只能验证管线，不能当成品。

## 输入

- 需要给：素材文件或文件夹路径（`file.import` 的 `paths`）、目标宽高/fps、导出路径与格式。
- 可选：`--preset`（`export --list-presets` 列）、`--scale`、`--quality 0-100`、`--no-audio`、
  `--range entire|inOut|workArea` 或秒区间。
- 导出路径优先用相对路径（相对当前工作目录），Windows 反斜杠在 jsonl 里要写成 `\\`。

## 最小闭环（2026-10-28 实测）

```sh
F=/d/storytoldExe/FilmCraft/filmcraft-cli.exe
mkdir -p .temp/craft-runs/filmcraft && cd .temp/craft-runs/filmcraft
cat > s.jsonl <<'EOF'
{"id":"file.newProject","params":{"name":"probe"}}
{"id":"file.newSequence","params":{"name":"seq","width":320,"height":240,"fps":30}}
{"id":"file.exportMedia","params":{"path":"f.png","format":"png","range":"entire","wait":true}}
EOF
timeout 180 "$F" run s.jsonl
# → {"id":"file.exportMedia","line":3,"ok":true,"result":{"job":1,"offlineMedia":[],
#    "path":"f.png","result":{"bytes":2098,"frames":1,"render_fps":131.2,"seconds":0.0076}}}
```

空序列只出 **1 帧**；`f.png` 实际落到 `f000.png`（2,098 字节 / 320×240）。

带素材才有片长（同一轮实测，150 帧）：

```sh
cat > s-still.jsonl <<'EOF'
{"id":"file.newProject","params":{"name":"probe"}}
{"id":"file.import","params":{"paths":["../effectcraft/frame.png"]}}
{"id":"file.newSequence","params":{"name":"seq","width":320,"height":240,"fps":30}}
{"id":"source.open","params":{"item":1}}
{"id":"source.insert","params":{}}
{"id":"file.exportMedia","params":{"path":"still.mp4","format":"h264","range":"entire","wait":true}}
EOF
timeout 180 "$F" run s-still.jsonl
# → {"items":[1]} … {"clips":[9]} … {"bytes":277531,"frames":150,"render_fps":189.2,"seconds":0.793}
```

真实产物：`still.mp4` = **277,531 字节 / 150 帧**（静止帧默认 5 s @30 fps）；
同一序列导 PNG 序列 → `g000.png … g149.png` 共 **150 个文件、8,788,650 字节**（`g000.png` 58,591 字节）。

## 命令怎么发现

- `filmcraft-cli commands`：701 行纯文本；`commands --json` 是**逐条缩进的多行 JSON**，`grep -c '"id"'` 也正好 701。
- `commands <filter> --json` 按 id 子串过滤（如 `commands export --json`）。
- `describe <id>`：`{params, enabled, why, shortcut, menu}`——`enabled:false` 时 `why` 直说当前缺什么
  （例：`file.exportMedia` → "no sequence is open"）。
- `run <script.jsonl | ->`：一行一条 `{"id","params"}`，`#` 注释行允许，`-` 读 stdin（实测可用）。

## 常用命令族

| 族 | 代表 id | 要点 |
|---|---|---|
| 工程 | `file.newProject` `file.save` `file.projectSettings` | 新进程必须重开工程 |
| 序列 | `file.newSequence` `sequence.settings` `sequence.open` | `sequence.settings` **没有 duration 参数**，片长由素材决定 |
| 素材 | `file.import` `source.open` `source.insert` `source.overwrite` | import 回 `{items,errors}`；source.open 后 source.insert 才回 `{clips}` |
| 导出 | `file.exportMedia`（jsonl 内）/ `export` 子命令 | jsonl 内必须 `wait:true` |
| 查看 | `inspect [project\|sequence]` `jobs.list` `jobs.wait` | `inspect` 也是独立进程，看不到别的进程的会话 |

## 输出与校验

- 每条命令一行 JSON：`{"id","line","ok":true,"result":…}`；`ok:false` 带 `error`（如 ``unknown command `x` ``）。
- 导出结果在 `result.result`：`bytes/frames/path/render_fps/seconds`——**断言 `bytes>0` 且 `frames` 符合预期**。
- `offlineMedia` 非空表示有素材缺失/离线，渲染成占位帧；`[]` 才是干净导出。
- 出片后自己核对：`ls -l` 看字节数、PNG 序列数文件个数（150 帧就应有 150 个文件）。

## 失败出口

| 症状 | 原因 | 处置 |
|---|---|---|
| `No such file`，路径看着没错 | 旧文档把目录写成 `FilmCraft \`（尾随空格） | 用 `D:\storytoldExe\FilmCraft\filmcraft-cli.exe` |
| `no sequence is open` | 每个子命令都是新进程，状态不跨进程 | 把建工程+建序列+导出写进同一个 jsonl，用 `run` 跑 |
| `export` 子命令报 `not available right now` | 该进程里没有打开的序列 | 改用 jsonl 里的 `file.exportMedia`，或先在脚本里建序列 |
| jsonl 报 `invalid escape` | 路径里的反斜杠没转义（`\w` 不是合法转义） | 用相对路径，或写成 `\\` |
| 命令 `ok:false` + `unknown command` | 抄了别的 app 的命令 id（如 `layer.addItem` 属 effectcraft） | 先 `describe <id>` 确认存在 |
| 导出没报错但文件不存在 | 少了 `wait:true`，job 随进程退出丢失 | 一律加 `"wait":true`；只拿到 `{job,poll}` 就是没等 |

## 坑（实测）

- **不传 `wait:true` 就一定丢**：返回值变成 `{"cancel":"jobs.cancel","job":1,"path":"nowait.mp4","poll":"jobs.list"}`，
  进程退出后文件始终不出现（本轮实测 `ls nowait.mp4` 直接不存在）。
- **PNG 序列带 4 位帧号**：`f.png` → `f000.png`，`pngseq/g.png` → `pngseq/g000.png`；空序列也出 1 帧。
- **`sequence.settings` 无 duration**：片长由素材撑开；静止帧默认 5 s，所以「导出只有 1 帧」通常是序列里没东西。
- 格式表：`h264|hevc|prores|dnxhr|apv|mjpeg|mxf-op1a|mxf-opatom|png|tiff|bmp|gif|wav|aiff|aac|flac`，
  按扩展名猜，猜不出用 `--format`。
- `exec` 的 `key=value` 里第二个词会被当成下一条命令，多命令一律用 jsonl `run`。
- 离线素材（缺失/被离线）渲染成占位帧，导出会在 `offlineMedia` 里列出并退出非零，除非 `--allow-offline`。

## MCP / 连 GUI

- `--bridge PORT` 连正在跑的 GUI（`filmcraft-cli --bridge 8080 inspect` 之类）：**需先起 GUI，本轮 headless 未验证**。
- headless 走 `run`/`exec`/`export` 三个入口即可覆盖导入—剪辑—导出的全部实测路径。
