---
description: FilmCraft 视频剪辑——建序列/导入素材/渲染导出。当要剪视频、建 sequence、导出 h264/png 序列时使用。触发词：filmcraft、视频、剪辑、序列、渲染。
version: 0.1.0
disable-model-invocation: true
---

<!--en-->
# filmcraft (English)

Keep this block in sync with the Chinese body below.
<!--/en-->

# FilmCraft：视频剪辑

Premiere 式引擎，701 条命令。CLI：`D:\\storytoldExe\\FilmCraft \\filmcraft-cli.exe`。

## 会话是**每进程一次**

`exec`/`run`/`export`/`import`/`inspect` 各是一次进程，**状态不跨进程保留**：
`exec file.newProject` 之后另起一个 `exec file.exportMedia` 会报 `no sequence is open`。
所以**建工程 + 建序列 + 导出必须写在同一个 jsonl 里**。

## 最小闭环（实测通过）

```json
{"id":"file.newProject","params":{"name":"probe"}}
{"id":"file.newSequence","params":{"name":"seq","width":320,"height":240,"fps":30}}
{"id":"file.exportMedia","params":{"path":"D:\\out\\f.png","format":"png","range":"entire","wait":true}}
```

```sh
filmcraft-cli run s.jsonl
# → {"id":"file.exportMedia","ok":true,"result":{"job":1,"offlineMedia":[],"path":"...","result":{"bytes":2098,"frames":1,"render_fps":122.5,"seconds":0.008}}}
```

## 子命令

| 子命令 | 用途 |
|---|---|
| `exec <id> [key=value ...]` / `exec <id> '<json params>'` | 单条命令 |
| `run <script.jsonl \| ->` | jsonl 脚本（`#` 注释行允许） |
| `commands [filter] [--json]` / `describe <id>` | 列命令 / 单条（含 `enabled` 当前可用性） |
| `inspect [project\|sequence]` | 工程树 / 序列 JSON |
| `import <file>...` | 导入素材 |
| `export <out> [--preset name] [--format f] [--range r] [--scale f] [--quality 0-100] [--no-audio] [--queue] [--allow-offline]` | 导出并等待 |
| `help <subcommand>` | 子命令详解 |

## 导出的两种写法

- **`export` 子命令**：`filmcraft-cli export out.mp4 --range entire --allow-offline`，它自己等待渲染完成。
  但它**只能导出当前进程里打开的序列**，所以实际用法是配合 jsonl。
- **`file.exportMedia` 命令**（jsonl 内）：参数含 `wait`（bool，**默认 false**）。不传 `wait:true`
  则导出是后台 job，**进程一退 job 就丢**（实测 `jobs.list` 变空、文件不出现）。

## 坑

- **`export` 的格式表**：h264|hevc|prores|dnxhr|apv|mjpeg|mxf-op1a|mxf-opatom|png|tiff|bmp|gif|wav|aiff|aac|flac，
  按扩展名猜，猜不出用 `--format`。
- **PNG 序列输出带帧号后缀**：`out.png` 实际写成 `out0000.png`（空序列一帧也如此）。
- 离线素材（缺失/被离线）渲染成占位帧，导出会在 `offlineMedia` 里列出并 **exit 1**，除非 `--allow-offline`。
- `exec` 的 `key=value` 里**第二个词会被当成下一个命令**，多命令用 jsonl `run`。
