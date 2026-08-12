# 文档同步 + 安装.md 退役

**Status:** ready-for-agent

**Blocked by:** 02, 03, 04, 05

**构建内容：** 维护者与后续读者看到的文档与实际分发工具一致：安装指南改述 `ship` 命令用法、PowerShell 脚本退役；跨厂商规范文档把 `ship.mjs` 标注为单源派生与分发的既定实现，不再只是规划。

**验收标准：**

- [ ] 安装指南（`安装.md`）重写为 `ship` 用法：init/derive/install/check、双模式、--user-home/--dry-run/--project、x-install 清单说明；PowerShell 安装与验证段删除
- [ ] 跨厂商规范三份文档的"生成脚本接口"节标注 `ship.mjs` 为既定实现，与派生规则一致
- [ ] 文档中不再出现与 `vendors.json` 冲突的平台/路径硬编码
- [ ] 文档与 `CONTEXT.md` 词汇（ship、双模式、x-install、managedPrefixes 等）口径一致

## 评论

（评论与对话历史追加于此，新内容置于最前。）
