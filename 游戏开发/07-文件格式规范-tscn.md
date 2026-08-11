# .tscn 场景文件格式（godot-tscn-format）

> Godot 场景文件是纯文本，AI 可直接通过 `write_to_file` / `replace_in_file` 操作。

---

## 文件结构

```
[gd_scene load_steps=N format=3 uid="uid://xxx"]     ← 头部（必需）

[ext_resource type="Type" path="res://..." id="ID"]   ← 外部资源引用（可选）
[ext_resource ...]

[sub_resource type="Type" id="ID"]                    ← 内嵌资源定义（可选）
property = value

[node name="Name" type="Type"]                        ← 根节点（必需）
property = value

[node name="Child" type="Type" parent="."]            ← 子节点
property = value

[connection signal="sig" from="Node" to="Target" method="func"]  ← 信号连接（可选）
```

---

## 头部

```
[gd_scene load_steps=4 format=3]
```

- `load_steps` = ext_resource 数 + sub_resource 数 + 1（场景本身）
- `format` = 固定 `3`（Godot 4.x）
- `uid` = 可选，Godot 自动生成

---

## ext_resource 外部资源引用

```
[ext_resource type="Script" path="res://scripts/player.gd" id="1_script"]
[ext_resource type="Texture2D" path="res://textures/icon.png" id="2_texture"]
[ext_resource type="PackedScene" path="res://scenes/bullet.tscn" id="3_bullet_scene"]
```

| type | 文件类型 |
|------|----------|
| `Script` | GDScript |
| `PackedScene` | 场景 |
| `Material` | 材质资源 |
| `Texture2D` | 2D 纹理 |
| `AudioStream` | 音频 |
| `Shader` | 着色器 |

---

## sub_resource 内嵌资源

### 碰撞形状

```
[sub_resource type="CapsuleShape3D" id="CapsuleShape3D_player"]
radius = 0.35
height = 1.8

[sub_resource type="SphereShape3D" id="SphereShape3D_001"]
radius = 0.5

[sub_resource type="BoxShape3D" id="BoxShape3D_floor"]
size = Vector3(10, 0.2, 10)

[sub_resource type="RectangleShape2D" id="RectangleShape2D_001"]
size = Vector2(32, 32)

[sub_resource type="CircleShape2D" id="CircleShape2D_001"]
radius = 16.0
```

### 网格

```
[sub_resource type="BoxMesh" id="BoxMesh_001"]
size = Vector3(1, 1, 1)

[sub_resource type="SphereMesh" id="SphereMesh_001"]
radius = 0.5; height = 1.0

[sub_resource type="CapsuleMesh" id="CapsuleMesh_001"]
radius = 0.5; height = 2.0

[sub_resource type="PlaneMesh" id="PlaneMesh_001"]
size = Vector2(10, 10)
```

### 材质（内嵌）

```
[sub_resource type="StandardMaterial3D" id="Material_red"]
albedo_color = Color(1, 0, 0, 1)
roughness = 0.8
metallic = 0.2
```

---

## node 节点声明

### 根节点

```
[node name="Player" type="CharacterBody3D"]
script = ExtResource("1_player_script")
```

### 子节点

```
[node name="ChildName" type="NodeType" parent="."]
property = value
```

parent 值：
- `.` = 根节点的直接子节点
- `ParentName` = 指定父节点名
- `Parent/Child` = 嵌套路径

### 资源引用

```
script = ExtResource("1_script")          # 引用外部资源
shape = SubResource("CapsuleShape3D_001")  # 引用内嵌资源
```

### 实例化场景

```
[node name="Enemy1" parent="Enemies" instance=ExtResource("4_enemy_scene")]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 5, 0, -10)
```

---

## Transform

### Transform3D（3D）

```
transform = Transform3D(bx.x, bx.y, bx.z, by.x, by.y, by.z, bz.x, bz.y, bz.z, ox, oy, oz)
```

| 参数 | 含义 |
|------|------|
| bx (1-3) | X 轴基向量 |
| by (4-6) | Y 轴基向量 |
| bz (7-9) | Z 轴基向量 |
| o (10-12) | 位置 origin |

常见:
```
# 单位变换
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)

# 仅位置
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 5, 2, -10)

# 绕 Y 轴旋转 90°
transform = Transform3D(0, 0, 1, 0, 1, 0, -1, 0, 0, 0, 0, 0)
```

### Transform2D（2D）

```
transform = Transform2D(cos, sin, -sin, cos, x, y)

# 单位变换
transform = Transform2D(1, 0, 0, 1, 100, 200)

# 旋转 45° 位于 (100, 200)
transform = Transform2D(0.707, 0.707, -0.707, 0.707, 100, 200)
```

---

## 属性值格式

```ini
# 布尔
visible = true; enabled = false

# 数值
health = 100; speed = 10.5

# 字符串
name = "Player"

# Vector2 / Vector3
position = Vector2(100, 200)
position = Vector3(0, 1.5, 0)

# Color (R, G, B, A) 范围 0.0-1.0
light_color = Color(1, 0.85, 0.3, 1)
modulate = Color(1, 1, 1, 0.5)

# 数组
polygon = PackedVector2Array(0, 0, 100, 0, 100, 100, 0, 100)
groups = ["enemy", "damageable"]
```

---

## 连接信号

```
[connection signal="timeout" from="ShootCooldown" to="." method="_on_shoot_cooldown_timeout"]
[connection signal="body_entered" from="HitArea" to="." method="_on_hit_area_body_entered"]
[connection signal="pressed" from="Button" to="." method="_on_button_pressed" flags=1]
```

---

## 完整示例

### 3D 角色场景

```
[gd_scene load_steps=3 format=3]

[ext_resource type="Script" path="res://scripts/player.gd" id="1_script"]

[sub_resource type="CapsuleShape3D" id="CapsuleShape3D_001"]
radius = 0.35
height = 1.8

[node name="Player" type="CharacterBody3D"]
script = ExtResource("1_script")

[node name="CollisionShape3D" type="CollisionShape3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0.9, 0)
shape = SubResource("CapsuleShape3D_001")

[node name="Camera3D" type="Camera3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1.6, 0)
fov = 75.0
```

### 2D 角色场景

```
[gd_scene load_steps=3 format=3]

[ext_resource type="Script" path="res://scripts/player_2d.gd" id="1_script"]
[ext_resource type="Texture2D" path="res://sprites/player.png" id="2_texture"]

[sub_resource type="RectangleShape2D" id="RectangleShape2D_001"]
size = Vector2(32, 48)

[node name="Player" type="CharacterBody2D"]
script = ExtResource("1_script")

[node name="Sprite2D" type="Sprite2D" parent="."]
texture = ExtResource("2_texture")

[node name="CollisionShape2D" type="CollisionShape2D" parent="."]
shape = SubResource("RectangleShape2D_001")
```

### UI 场景

```
[gd_scene load_steps=2 format=3]

[ext_resource type="Script" path="res://scripts/hud.gd" id="1_script"]

[node name="HUD" type="CanvasLayer"]
script = ExtResource("1_script")

[node name="MarginContainer" type="MarginContainer" parent="."]
anchors_preset = 15
offset_left = 20.0; offset_top = 20.0; offset_right = -20.0; offset_bottom = -20.0

[node name="ScoreLabel" type="Label" parent="MarginContainer/VBoxContainer"]
layout_mode = 2
text = "Score: 0"
```

---

## AI 操作指南

```python
# 创建新场景
write_to_file("res://scenes/new_scene.tscn", """
[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
""")

# 修改属性
replace_in_file("res://scenes/player.tscn",
    old_str='fov = 75.0',
    new_str='fov = 90.0')

# 添加节点（在信号连接之前插入）
replace_in_file("res://scenes/player.tscn",
    old_str='[connection signal=',
    new_str='''[node name="NewChild" type="Node3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)

[connection signal=''')
```

## 常见错误

| 错误 | 原因 | 修复 |
|------|------|------|
| `load_steps` 不匹配 | 资源数计算错误 | 重新计算 ext + sub + 1 |
| `id not found` | 引用了不存在的资源 ID | 检查 ExtResource/SubResource ID |
| 场景无法加载 | parent 路径错误 | 检查节点层级关系 |
| 属性无效 | 类型拼写错误 | 查阅 Godot 文档确认属性名 |
