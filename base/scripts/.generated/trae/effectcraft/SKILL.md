---
name: effectcraft
description: EffectCraft 动态特效——合成/渲染单帧。当要做特效合成、渲帧、跑 731 条引擎命令时使用。触发词：effectcraft、特效、合成、AE。
version: 0.1.0
disable-model-invocation: true
---

<!--en-->
# effectcraft (English)

Keep this block in sync with the Chinese body below.
<!--/en-->

# EffectCraft：动态特效

After Effects 式合成引擎，731 条命令。CLI：`D:\\storytoldExe\\EffectCraft \\effectcraft-cli.exe`。

## 子命令

```
effectcraft-cli info                                       # 工程 + 引擎摘要
effectcraft-cli commands [--filter TEXT] [--enabled]       # 列引擎命令
effectcraft-cli exec <command-id> [--params JSON]          # 跑一条
effectcraft-cli run <id> <json> [<id> <json> ...]          # 顺序跑多条
effectcraft-cli props <comp> <layer> [--flat] [--time S]   # 图层属性树（带路径）
effectcraft-cli get <comp> <layer> <path> [--time S]       # 读一个属性
effectcraft-cli set <comp> <layer> <path> <value> [--time S]
effectcraft-cli render-frame ...                           # 渲单帧
effectcraft-cli render ...
effectcraft-cli script FILE ...
effectcraft-cli mcp
```

## 最小闭环（实测通过）

```sh
effectcraft-cli render-frame --out frame.png
# → rendered 1920x1080 at 2.502s in 143.1 ms -> frame.png
```

**空工程也能渲帧**（1920×1080 默认合成），所以试手不需要先建文件。

## 属性寻址

`props` 给出**带路径的属性树**（如 `transform.position`），`get`/`set` 用同一路径 + `--time`（秒）
读/写某一时刻的值。改属性 → `render-frame` 看结果，这是最快的迭代环。

## 坑

- `exec` 的参数是 `--params JSON`（一个整体），不是 `key=value`。
- `run` 的多命令是 `<id> <json>` 成对出现，**json 必须是合法 JSON**（裸数字/true 也可以）。
- `set` 的 value 按属性类型解析，写错类型会报错而不是静默转换。
