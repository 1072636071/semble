# 单源派生引擎（derive 子命令 + 双模式接通）

**Status:** ready-for-agent

**Blocked by:** 01

**构建内容：** 维护者敲 `ship derive` 后，含 `SKILL.src.md` 的技能按各家派生规则产出 4 份适配版——CodeArts 获得合法 name 前缀、5 行编号 description、英文内容；openCode 版不再带 frontmatter name；CodeBuddy/Trae 正确透传并按需注入专属字段。`--dry-run` 可预演不落盘。

**验收标准：**

- [ ] `SKILL.src.md` 技能派生为 4 家适配版，产物结构与规范 §2 布局一致
- [ ] CodeArts 版：name 映射为 `huawei-cloud-<product>-<name>` 且目录名一致；description 为 5 行编号列表；英文块正确提取
- [ ] openCode 版：frontmatter 无 name 键，目录路径即 ID
- [ ] CodeBuddy/Trae 版：name 透传；`x-vendors` 专属字段仅注入对应厂商派生版且源 frontmatter 剔除
- [ ] `x-install: false` 技能的派生产物标记为不安装（或跳过派生）
- [ ] `--dry-run` 派生不产生任何落盘
- [ ] 无 `SKILL.src.md` 的技能不受影响（原样复制路径不变，双模式接通）
- [ ] 本切片配套 `node:test` 用例在临时目录通过

## 评论

（评论与对话历史追加于此，新内容置于最前。）
