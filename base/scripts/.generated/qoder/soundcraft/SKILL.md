---
name: soundcraft
description: SoundCraft 音频——多轨工程/混音/bounce 导出。当要处理音频、建多轨、导出 wav 时使用。触发词：soundcraft、音频、多轨、混音、bounce。
version: 0.1.0
disable-model-invocation: true
---

<!--en-->
# soundcraft (English)

Keep this block in sync with the Chinese body below.
<!--/en-->

# SoundCraft：音频 / 多轨

DAW 引擎，480 条命令。CLI：`D:\\storytoldExe\\SoundCraft \\soundcraft-cli.exe`。

## 子命令

```
soundcraft-cli info FILE                        # 音频文件或 .scraft 摘要
soundcraft-cli convert IN OUT [--bit-depth 16|24|32f] [--rate HZ] [--normalize]
soundcraft-cli run [--in S.scraft | --demo] [--cmd ID[=JSON]]... [--bounce OUT] [--start T --end T] [--save S.scraft] [--inspect]
soundcraft-cli script FILE [--in S | --demo] [--save S] [--bounce OUT]   # 一行一命令
soundcraft-cli commands [FILTER] / describe ID
soundcraft-cli app [--port P] METHOD [JSON]     # 控制通道
soundcraft-cli mcp [--connect PORT] [--demo] [--automation-read-root DIR] [--automation-write-root DIR]
soundcraft-cli parity [--write PATH]            # 对齐报告
soundcraft-cli plugins
```

## 最小闭环（实测通过）

```sh
soundcraft-cli run --demo --cmd transport.play --bounce out.wav
# → {"bytes":16094696,"lufs":-19.37,"peak_db":-4.35,"path":"...","seconds":55.88,"true_peak_db":-4.32}
```

`--demo` 起程序化生成的演示工程，**不需要任何输入文件**。bounce 顺带给出 LUFS / peak /
true-peak，母带向度量直接可用。

## 坑

- `--bounce` 的容器由扩展名定（wav/aiff…）。
- `--start/--end` 裁一段时间再 bounce。
- `mcp` 的 `--automation-*` 与 `--connect` 互斥（同 vectorcraft 语义）。
