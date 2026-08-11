# Godot 游戏开发 — 技能与API总览

> 基于 `Skills技能库/技能市场参考/游戏开发/` 下 20+ 个 Godot 技能整理。
> 适用引擎：Godot 4.x (4.6 stable)

---

## 一、技能体系架构

```
godot-dev (统一入口，三场景分流)
├── godot-deploy     — 环境部署（Node.js → MCP Server → .mcp.json → Godot Editor → 9080）
├── godot-new        — 新建项目（模板推断 → 复制 → 注入 addons → 写 active-game.json）
├── godot-debug      — 错误诊断（get_debug_errors → get_script_errors → get_editor_output）
│
├── Level 0: Foundation（基础层）
│   ├── godot-core        — 核心操作：节点/场景/脚本的 MCP 工具调用
│   ├── file-manager      — 文件管理
│   └── external-api      — 外部 API 集成
│
├── Level 1: Generators（生成器层）
│   ├── code-generator    — 代码生成
│   ├── asset-generator   — 资源生成
│   └── config-generator  — 配置生成
│
├── Level 2: Modules（模块层）
│   ├── input-system      — 输入系统
│   ├── player-system     — 玩家系统
│   ├── camera-system     — 相机系统
│   ├── ui-system         — UI 系统
│   ├── save-system       — 存档系统
│   ├── audio-system      — 音频系统
│   └── animation-system  — 动画系统
│
└── Level 3: Orchestrators（编排层）
    ├── game-planning     — 策划流程（需求 → 交互 → 玩法 → 关卡 → 数值）
    ├── project-scaffold  — 项目脚手架（目录结构 + 核心脚本 + InputMap）
    └── build-pipeline    — 构建部署
```

---

## 二、独立辅助技能

| 技能 | 用途 |
|------|------|
| `godot-gdscript-patterns` | GDScript 设计模式：状态机、Autoload、资源数据、对象池、组件、场景管理、存档 |
| `gdscript-codegen` | GDScript 代码生成规范与编辑器警告规避 |
| `godot-utils` | 10 大类 GDScript 工具函数库（数学/向量/随机/时间/字符串/数组/节点/文件/调试/缓动） |
| `godot-tscn-format` | .tscn 场景文件格式规范（AI 可直接读写） |
| `godot-tres-format` | .tres 资源文件格式规范（材质/环境/物理材质/渐变/曲线/着色器/动画/粒子） |
| `godot-data-driven-config` | 数据驱动配置系统（JSON spec → Resource class → .tres → DataManager Autoload → CLI 验证） |
| `godot-headless-verify` | 无头模式验证：缓存清理/场景烟雾测试/脚本解析检查/文件夹重导入/维护脚本 |
| `godot-asset-path-surgery` | 资产路径修复：修复二进制资源中硬编码的过期 ExtResource 路径 |

---

## 三、Quick Index

- [01-开发流程](./01-开发流程.md)
- [02-MCP核心API](./02-MCP核心API.md)
- [03-节点类型速查](./03-节点类型速查.md)
- [04-GDScript编码规范](./04-GDScript编码规范.md)
- [05-设计模式](./05-设计模式.md)
- [06-工具函数库](./06-工具函数库.md)
- [07-文件格式规范-tscn](./07-文件格式规范-tscn.md)
- [08-文件格式规范-tres](./08-文件格式规范-tres.md)
- [09-数据驱动配置](./09-数据驱动配置.md)
- [10-调试与验证](./10-调试与验证.md)
- [11-资产管理](./11-资产管理.md)
