---
name: vectorcraft
description: VectorCraft 矢量编辑——品牌资产/描边变形/布尔/路径简化。当要用 vectorcraft 改矢量图、批量导出、或跑 569 条引擎命令时使用。触发词：vectorcraft、矢量编辑、Illustrator。
---

<!--en-->
# vectorcraft (English)

Keep this block in sync with the Chinese body below.
<!--/en-->

# VectorCraft：矢量编辑

Illustrator 式矢量编辑器，569 条命令，409 KB 命令注册表。CLI：
`D:\\storytoldExe\\VectorCraft \\vectorcraft-cli.exe`。

## 两种驱动方式

```sh
# 1) headless 进程内会话（默认 fallback）
vectorcraft-cli mcp --headless --automation-write-root D:\\storytold\\tmp

# 2) 驱动已运行的 GUI 应用
vectorcraft.exe --control 7979
vectorcraft-cli mcp --connect 127.0.0.1:7979
```

## 文件访问围栏

`--automation-read-root DIR` / `--automation-write-root DIR`（可重复）把 open/place/save/export/library
限制在目录内，符号链接会跟随。**留空一个 = 那类访问为零**（不给 write root 就连保存都拒绝）。
围栏对 `mcp` 与普通子命令同时生效；连 `--connect` 时由 GUI 进程自己执行自己的围栏。

## 常用命令族（在 figcraft 技能里已列基础形，这里只列 vectorcraft 特有）

| 族 | 例 | 用途 |
|---|---|---|
| `vector.flatten` / `vector.outlineStroke` | 描边转填充 | 印刷前处理 |
| `vector.reverse` / `vector.simplify` / `vector.join` / `vector.smoothJoin` | 路径清理 | 清冗余点 |
| `vector.offset` | 偏移轮廓 | 做描边效果 |
| `select.sameText` / `selection.colors` / `selection.setPaint` | 批量改色 | 换主题色 |

- **`mcp` 默认先尝试连 `127.0.0.1:7979` 上运行中的 app，失败才回落 headless**；要确定 headless 必须显式加 `--headless`（其他 12 个 CLI 的 `mcp` 默认就是 headless，不用加）。
## 坑

- `--automation-*` 与 `--connect` 语义互斥（connect 时用 GUI 自己的围栏）。
- 命令几百条，先 `commands` 列表 + `describe <id>` 看参数，别猜。
