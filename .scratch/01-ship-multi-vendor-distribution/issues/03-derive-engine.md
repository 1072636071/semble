# 单源派生引擎（derive 子命令 + 双模式接通）

**Status:** done

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

- [2026-08-27] 修复完成：`runDerive` 在 skill 派生、agent 派生、辅助文件复制三处循环均增加 `getXInstall(...) === false` 跳过（x-install: false 技能不派生产物、不复制辅助文件）；`ship.test.mjs` 新增用例「derive：x-install: false 的 src 技能跳过派生」，`node --test` 24/24 通过。现验收标准 8/8 满足，判定为 done。
- [2026-08-27] audit-ship 核查：验收标准 7/8 满足，**判定部分完成**。满足项：① src 技能派生 4 家、产物结构与规范 §2 布局一致（ship.mjs runDerive L439-484、测试 16 通过）；② CodeArts name 前缀 `huawei-cloud-<product>-<name>` 且目录一致、5 行编号 description、英文块提取（ship.mjs L369-378、测试 16 codearts 断言）；③ openCode 无 name 键、目录即 ID（ship.mjs L360-363、测试 16）；④ CodeBuddy/Trae name 透传 + x-vendors 专属字段仅注入对应派生版、源剔除 x-vendors（ship.mjs stripXVendors L221-228、测试 16 codebuddy allowed-tools）；⑥ --dry-run 不落盘（ship.mjs runDerive L458、测试 15 install--dry-run）；⑦ 无 src 技能原样复制、双模式接通（ship.mjs L530-537）；⑧ node:test 用例通过（测试 16-17）。**缺失项 ⑤**：`x-install: false` 技能的派生产物在 derive 层**未标记为不安装、也未跳过派生**——`runDerive`（ship.mjs L439-484）对 srcMode 技能遍历全部 vendor 派生，不读取 `x-install`；该开关仅在 install 层过滤（ship.mjs L500 shouldInstallForTarget）。故 .generated/ 下仍会生成 x-install:false 技能的派生产物，仅靠安装层拦截。若验收意图为"不生成派生产物"，需在 runDerive 增加过滤。待澄清后复查。

（评论与对话历史追加于此，新内容置于最前。）
