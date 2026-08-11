# GDScript 编码规范（godot-gdscript-patterns + gdscript-codegen）

> 适用 Godot 4.x

---

## 命名约定

| 项目 | 格式 | 示例 |
|------|------|------|
| 类名 | PascalCase | `PlayerController` |
| 变量名 | snake_case | `player_speed` |
| 私有变量 | _snake_case | `_health` |
| 常量 | UPPER_SNAKE_CASE | `MAX_SPEED` |
| 信号 | snake_case | `health_changed` |
| 函数 | snake_case | `take_damage()` |
| 虚函数 | _snake_case | `_process()` |

---

## 类型标注（强制）

```gdscript
# ✅ 推荐：显式类型
var health: int = 100
var speed: float = 10.0
var player_name: String = "Player"
var position: Vector3 = Vector3.ZERO
var enemies: Array[Node3D] = []
var weapon_data: Dictionary = {}

# ✅ 推荐：函数参数和返回值标注
func take_damage(amount: int) -> void:
    health -= amount

func get_health_ratio() -> float:
    return float(health) / float(max_health)

# ❌ 避免：无类型标注
var health = 100  # 编译器警告
```

## 类型推断陷阱

```gdscript
# ❌ for 循环迭代变量无法推断
for x in [-1.0, 1.0]:
    var pos := center + Vector2(x, 0) * radius  # 报错

# ✅ 显式标注
for x: float in [-1.0, 1.0]:
    var pos := center + Vector2(x, 0) * radius

# ❌ 字典值类型无法推断
var data = {"a": 1, "b": 2}
var value := data["a"]  # 报错

# ✅ 显式标注
var value: int = data["a"]
var value := data["a"] as int
```

## 导出变量

```gdscript
# 基础类型
@export var health: int = 100
@export var speed: float = 10.0

# 范围限制
@export_range(0, 100, 1) var health: int = 100
@export_range(0.0, 10.0, 0.1) var speed: float = 5.0

# 枚举
@export_enum("Easy", "Normal", "Hard") var difficulty: int = 1

# 资源引用
@export var weapon_resource: WeaponResource
@export var projectile_scene: PackedScene

# 分组
@export_group("Combat")
@export var damage: int = 10
@export var fire_rate: float = 0.5
```

## @onready 和节点引用

```gdscript
# ✅ 推荐：@onready 延迟初始化
@onready var animation_player: AnimationPlayer = $AnimationPlayer
@onready var health_bar: ProgressBar = $UI/HealthBar

# ✅ 推荐：运行时获取（更灵活）
func _ready() -> void:
    player = get_tree().get_first_node_in_group("player")

# ❌ 避免：硬编码路径
var health_label = $"../UI/GameHUD/HealthPanel/HealthLabel"
```

## 信号

```gdscript
# 声明
signal health_changed(current: int, maximum: int)
signal died
signal damage_taken(amount: int, remaining: int)

# 连接（推荐方法引用）
button.pressed.connect(_on_button_pressed)

# Lambda（简单逻辑）
timer.timeout.connect(func(): print("Timeout!"))

# 带参数绑定
enemy.died.connect(_on_enemy_died.bind(spawn_point, enemy))

# 一次性连接
button.pressed.connect(_on_one_time_press, CONNECT_ONE_SHOT)

# 发射
health_changed.emit(current_health, max_health)
```

## 编辑器警告规避（真实踩过的高频坑）

### 变量名与内置函数重名

```gdscript
# ❌ 警告
var hash := _hash_cell(x, z)

# ✅ 改名避开
var cell_hash := _hash_cell(x, z)
```

触发名单：`hash`/`len`/`str`/`int`/`float`/`bool`/`print`/`abs`/`sin`/`cos`/`min`/`max`/`clamp`/`lerp`/`sign`/`type_of`/`range`/`load`/`preload`

### 局部变量 shadow 基类属性

```gdscript
# ❌ extends Node3D 时
var basis := Basis(Vector3.UP, yaw)
var transform := ...

# ✅ 改名
var cell_basis := Basis(Vector3.UP, yaw)
```

高风险：`Node3D`→basis/transform/position/rotation/scale；`CanvasItem`→visible/modulate/material；`Node`→name/owner

### 函数参数未使用

```gdscript
# ❌ 警告
func compute(value: float, threshold: float) -> float:
    return value * 2.0

# ✅ 接口需保留签名时加下划线
func compute(value: float, _threshold: float) -> float:
    return value * 2.0
```

### 整数除法警告

```gdscript
# ❌ int / int 产生警告
var x_groups := int((size.x - 1) / 8) + 1

# ✅ 方案A：标记有意为之
@warning_ignore("integer_division")
var x_groups := int((size.x - 1) / 8) + 1

# ✅ 方案B：用浮点
var x_groups_f := (size.x - 1) / 8.0
```

### @warning_ignore 使用守则

只在三种情况使用：
1. 故意如此（整数除法 / shadow 有意对齐 API）
2. 接口约束（签名必须保留某参数）
3. 占位待办（signal/field 下个版本才接）

禁止：用 `@warning_ignore` 压住自己没搞清的警告。

## 性能提示

```gdscript
# 1. 缓存节点引用
@onready var sprite := $Sprite2D  # Good
# $Sprite2D in _process()  # Bad - 重复查找

# 2. 频繁生成物体用对象池（见设计模式-对象池）

# 3. 热路径避免分配
var _reusable_array: Array = []
func _process(_delta: float) -> void:
    _reusable_array.clear()  # 复用

# 4. 静态类型加速
func calculate(value: float) -> float:  # Good
    return value * 2.0

# 5. 不需要时禁用处理
func _on_off_screen() -> void:
    set_process(false)
    set_physics_process(false)
```

## 生成前自查清单

- [ ] 所有变量有类型标注
- [ ] for 循环迭代变量有类型标注
- [ ] 函数参数和返回值有类型标注
- [ ] 没有与内置函数重名的变量
- [ ] 没有 shadow 基类属性的变量
- [ ] 函数参数全部有用/接口参数加 `_` 前缀
- [ ] `int / int` 表达式明确处理
- [ ] signal 全部会被 emit()
- [ ] 缩进使用 Tab（不是空格）
