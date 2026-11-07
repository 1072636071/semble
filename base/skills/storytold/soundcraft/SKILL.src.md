---
name: soundcraft
description: SoundCraft 音频——多轨工程/混音/bounce 导出。当要处理音频、建多轨、导出 wav 时使用。触发词：soundcraft、音频、多轨、混音、bounce。不用于：视频剪辑、特效合成、语音转写；用户没给音频文件或工程路径时先问清再动手。
version: 0.2.0
disable-model-invocation: true
x-install: false  # 2026-10-28 起不外装：原文在 WeKnora 库 dfaaf6fc 的 craft/<name>，本地技能目录不再安装
x-vendors:
  codearts:
    product: codebuddy
    tags: [soundcraft, audio, daw, codebuddy]
    description-en: |-
      1. SoundCraft audio: multi-track sessions, mixing, bounce to wav.
      2. Triggered by: soundcraft, audio, DAW, mix, bounce.
      3. CLI runs commands on a session and bounces audio; a demo session needs no input.
      4. Usage: soundcraft-cli run --demo --cmd transport.play --bounce out.wav; commands/describe ID.
      5. Requires D:\storytoldExe\SoundCraft\soundcraft-cli.exe (Windows).
  codebuddy:
    allowed-tools: [read_file, search_content]
  opencode:
    license: MIT
  trae: {}
---

<!--en-->
# soundcraft (English)

SoundCraft is a headless DAW engine driven by `soundcraft-cli.exe` (480 commands, measured 2026-10-28).
Use it to read audio / `.scraft` summaries (`info`), convert bit depth or sample rate, run engine commands and bounce a mix.
Minimal loop: `run --demo --cmd transport.play --bounce out.wav` → 16,094,696 bytes, 55.884 s at 48 kHz Int24; `info out.wav` reads it back.
`commands` is plain text only (`--json` prints nothing); `commands | wc -l` = 480.
<!--/en-->

# SoundCraft：音频 / 多轨

DAW 引擎（headless），`commands` 实测 **480** 条命令。CLI：`D:\storytoldExe\SoundCraft\soundcraft-cli.exe`
（目录名 `SoundCraft` **无尾随空格**，exe 全小写）。默认 headless，不弹 GUI。

## 何时用 / 不用于

- 用：读音频或 `.scraft` 工程摘要（`info`）；转码（`convert --bit-depth/--rate/--normalize`）；
  跑引擎命令并 bounce 出 wav/aiff；把 demo 或工程存成 `.scraft`；查插件与命令面。
- 不用于：视频剪辑与序列导出（用 filmcraft）、合成与特效（用 effectcraft）、语音转写。
- `--demo` 只是自检入口；要处理用户素材就先拿到真实文件路径，别拿 demo 当交付。

## 输入

- 需要给：输入文件（wav/aiff/`.scraft`）**或** `--demo`（程序化演示工程，零输入文件）。
- 可选：`--cmd ID[=JSON]`（可重复，按顺序执行）、`--start/--end`（秒）、`--save OUT.scraft`、
  `--bit-depth 16|24|32f`、`--rate HZ`、`--normalize`。
- 落盘位置先跟用户确认：产物写当前工作目录，别写仓库根。

## 最小闭环（2026-10-28 实测）

```sh
CLI=/d/storytoldExe/SoundCraft/soundcraft-cli.exe
mkdir -p .temp/craft-runs/soundcraft && cd .temp/craft-runs/soundcraft
timeout 180 "$CLI" run --demo --cmd transport.play --bounce out.wav
# → {"bytes":16094696,"lufs":-19.370912551879883,"peak_db":-4.347385406494141,
#    "true_peak_db":-4.324906349182129,"seconds":55.884,"path":"out.wav"}   墙钟 2.86 s
timeout 180 "$CLI" info out.wav
# → {"channels":2,"sample_rate":48000,"sample_format":"Int24","frames":2682432,"seconds":55.884}
```

真实产物：`out.wav` = **16,094,696 字节**、55.884 秒、48 kHz / Int24 / 2 声道；
度量 LUFS **−19.37**、峰值 −4.35 dBFS、真峰 −4.32 dBFS。

裁剪、存工程、转码、脚本（同一轮实测）：

```sh
timeout 180 "$CLI" run --demo --cmd transport.play --start 0 --end 10 --bounce part.wav
# → bytes 2,880,104 / seconds 10.0 / lufs −28.52
timeout 180 "$CLI" run --demo --cmd transport.play \
  --cmd 'session.save_as={"path":"demo.scraft"}' --bounce multi.wav
# → session.save_as: {"audio_files_written":5,"path":"demo.scraft"}；demo.scraft = 93,823 字节
timeout 180 "$CLI" convert out.wav conv24.wav --bit-depth 16 --rate 44100 --normalize
# → wrote conv24.wav (2 ch, 44100 Hz, 55.88 s)；9,858,016 字节 / Int16
printf 'transport.play\n' > s.txt
timeout 180 "$CLI" script s.txt --demo --bounce script.wav      # 16,094,696 字节，与 run 等价
```

## 命令怎么发现

- `soundcraft-cli commands`：**480 行纯文本，一行一条命令、没有参数续行**，`| wc -l` 即命令数。
- `commands --json`：本机**返回 0 字节**（exit 0、不报错、不出 JSON）——别用它数命令或解析。
- `commands <FILTER>` 按 id 子串过滤；`describe <ID>` 出 `{id,label,menu,shortcut,params,enabled,disabled_reason}`。
- `plugins`：内置插件三列（id / 名称 / 分类），如 `eq_7band` `compressor` `room_reverb`。

## 常用命令族

| 族 | 代表 id | 要点 |
|---|---|---|
| 会话 | `session.new` `session.open` `session.save` `session.save_as` | `--save` 落 `.scraft`；`save_as` 要 `{"path":…}` |
| 导入 | `file.import_audio` `file.import_midi` `file.import_video` | demo 工程已带 5 个音频文件 |
| 导出 | `file.bounce_mix` / `--bounce OUT` | 容器由扩展名定（wav/aiff…） |
| 走带 | `transport.play` `transport.stop` | `describe` 给 `{from?: position}` |
| 自动化 | `edit.automation_coalesce_volume_to_clip_gain` 等 | id 超宽，纯文本表里会和列名挤成一格 |

## 输出与校验

- bounce 的 stdout 是一行 JSON：`bytes/lufs/peak_db/true_peak_db/seconds/path`——**先断言 `bytes` 与 `seconds`**。
- `info FILE` 读回 `channels/sample_rate/sample_format/frames/seconds`；两个 `seconds` 对齐即算成功。
- `.scraft` 是目录化工程（本机 93,823 字节，含 `audio_files_written` 个音频文件）。
- `run --inspect` 打印会话 JSON（`bit_depth` `busses` `length_samples` `markers`…），用来核工程状态而非靠肉眼。

## 失败出口

| 症状 | 原因 | 处置 |
|---|---|---|
| `No such file`，路径看着没写错 | 旧文档把目录写成 `SoundCraft \`（尾随空格） | 用 `D:\storytoldExe\SoundCraft\soundcraft-cli.exe`，反斜杠后不留空格 |
| `commands --json` 什么都不输出 | 本版未实现 JSON 输出（实测 0 字节、exit 0） | 退回纯文本 `commands \| wc -l` |
| bounce 后没有文件 | 输出目录不存在 / 扩展名不认识 | 先 `mkdir -p`，容器用 wav 或 aiff |
| `--cmd` 报 JSON 错 | `=` 后必须是合法 JSON | 整段加单引号：`--cmd 'session.save_as={"path":"a.scraft"}'` |
| 首次运行明显慢 | 建索引 / 解压资源 | 用 `timeout 180` 包住；慢不等于卡死，别中途杀 |
| 产物想写到别处 | 默认写当前工作目录 | 先与用户确认落点，再 `cd` 到该目录执行 |

## 坑（实测）

- `parity --write parity.md` 出对齐报告：本机 **77.5%（397/512）**、4,731 字节。
  **512 是引擎命令面，480 才是 CLI 暴露的命令数**，别混用。
- `--start/--end` 单位是**秒**，裁剪会改度量：10 s 片段 LUFS −28.52，全曲 −19.37。
- `convert --normalize` 真的改电平，别在不该动的素材上顺手加。
- `mcp` 的 `--automation-read-root` / `--automation-write-root` 与 `--connect` 互斥；
  两个 root 分别管读与写，省略一个等于放弃那一侧的访问权。
- demo 工程固定 55.884 秒 / 2682432 帧，任何「时长不对」先怀疑 `--start/--end` 而不是引擎。

## MCP / 连 GUI

- `soundcraft-cli mcp`：stdio MCP server（进程内，headless），配 root 参数圈定可读写目录。
- `soundcraft-cli app [--port P] METHOD [JSON]`：打正在跑的 GUI 控制通道——**需先起 GUI，本轮 headless 未验证**。
