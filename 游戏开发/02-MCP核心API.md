# MCP 核心 API（godot-core）

> Godot 编辑器通过 MCP 插件暴露在 9080 端口，以下为可调用的工具。

## 前提
- Godot Editor 已打开
- 状态栏显示 `MCP: Listening on port 9080`

---

## 节点操作

| 工具 | 参数 | 说明 |
|------|------|------|
| `create_node` | `parent_path`, `node_type`, `node_name` | 在指定父节点下创建新节点 |
| `delete_node` | `node_path` | 删除指定节点 |
| `update_node_property` | `node_path`, `property`, `value` | 更新节点属性 |
| `get_node_properties` | `node_path` | 获取节点的所有属性 |
| `list_nodes` | `scene_path?` | 列出场景中所有节点 |

## 场景操作

| 工具 | 参数 | 说明 |
|------|------|------|
| `get_current_scene` | — | 获取当前打开场景信息 |
| `open_scene` | `scene_path` | 打开指定场景（`res://` 路径） |
| `save_scene` | — | 保存当前场景 |
| `create_scene` | `scene_path`, `root_node_type?` | 创建新场景文件 |

## 脚本操作

| 工具 | 参数 | 说明 |
|------|------|------|
| `create_script` | `script_path`, `content` | 创建新 GDScript 文件 |
| `edit_script` | `script_path`, `content` | 编辑已有脚本内容 |
| `get_script` | `script_path` | 读取脚本文件内容 |
| `create_script_template` | `node_type` | 为指定节点类型生成标准脚本模板 |

## 编辑器操作

| 工具 | 参数 | 说明 |
|------|------|------|
| `run_project` | — | 运行项目（F5） |
| `stop_project` | — | 停止运行中的项目 |
| `get_editor_state` | — | 获取编辑器当前状态 |
| `execute_editor_script` | `script` | 在编辑器中执行 GDScript 代码 |

## 调试工具

| 工具 | 用途 | 何时调 |
|------|------|--------|
| `get_debug_errors` | 全项目扫描，返回所有 GDScript 编译错误 + 编辑器日志错误 | 每次激活第一步 |
| `get_script_errors` | 单个脚本详细错误（行号/列号/代码片段/上下文/修复建议/完整脚本） | 拿到 debug_errors 后，对每个有问题脚本各调一次 |
| `get_editor_output` | 读取 Godot 编辑器 Output 面板原始日志 | 编译无问题但运行时崩溃时调用 |

## 场景构建工具

```
build_godot_scene({
  scenePath: "res://scenes/<场景名>.tscn",
  root: {
    name: "<根节点名>",
    type: "<Godot 节点类型，如 Node2D / CharacterBody2D / Control>",
    properties: { ... },
    script: { path: "res://scripts/<x>.gd", content: "<完整 GDScript>" },
    children: [ ... ]
  },
  saveAfter:    true,
  openInEditor: true
})
```

## 路径约定

| 类型 | 格式 | 示例 |
|------|------|------|
| 资源路径 | `res://...` | `res://scenes/main.tscn` |
| 节点路径 | 从根开始 | `/root/Main/Player` |
| 脚本扩展名 | `.gd` | `res://scripts/player.gd` |
| 场景扩展名 | `.tscn` | `res://scenes/main.tscn` |

## 属性值格式

| 类型 | 格式 | 示例 |
|------|------|------|
| Vector2/3 | 数组 | `[100, 200]` / `[1, 2, 3]` |
| Color | RGBA 数组 0-1 | `[1, 0.5, 0.5, 1]` |
| 旋转单位 | 弧度 | `1.5708` |

## 连接失败处理

1. Godot Editor 是否已打开？
2. 状态栏是否显示 `MCP: Listening on port 9080`？
3. `Project Settings → Plugins → GodotMCP` 检查 Enable
4. 禁用后重新启用（等2秒）
5. 检查端口：`netstat -ano | findstr :9080`
