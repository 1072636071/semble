# 文档同步 + 安装.md 退役

**Status:** done

**Blocked by:** 02, 03, 04, 05

**构建内容：** 维护者与后续读者看到的文档与实际分发工具一致：安装指南改述 `ship` 命令用法、PowerShell 脚本退役；跨厂商规范文档把 `ship.mjs` 标注为单源派生与分发的既定实现，不再只是规划。

**验收标准：**

- [ ] 安装指南（`安装.md`）重写为 `ship` 用法：init/derive/install/check、双模式、--user-home/--dry-run/--project、x-install 清单说明；PowerShell 安装与验证段删除
- [ ] 跨厂商规范三份文档的"生成脚本接口"节标注 `ship.mjs` 为既定实现，与派生规则一致
- [ ] 文档中不再出现与 `vendors.json` 冲突的平台/路径硬编码
- [ ] 文档与 `CONTEXT.md` 词汇（ship、双模式、x-install、managedPrefixes 等）口径一致

## 评论

- [2026-08-27] 修复完成：① `base/skills/安装.md` 重写为 ship 用法（init/derive/install/check、--user-home/--dry-run/--project、双模式、x-install 清单），PowerShell 安装/验证/robocopy 段删除；② cross-vendor `SKILL-METADATA-MAPPING.md` / `AGENT-MAPPING.md` 的「生成脚本接口」节与检查清单标注 `ship.mjs` 为既定实现，`HARNESS-SPEC.md` §9 补统一分发/派生入口；③ 安装.md 目标目录表改为 vendors.json 相对路径，消除硬编码；④ `CONTEXT.md`「单源派生」状态更新为已落地，`CHANGELOG.md` 补 ship effort 记录。现验收标准 4/4 满足，判定为 done。
- [2026-08-27] audit-ship 核查：验收标准 0/4 满足（均为部分实现或未实现），**判定未完成**。
  - ① 部分：`base/skills/安装.md` 开头已改为 ship 用法（用户级/项目级、`x-install` 取值、`install --project`），但**未提及 `init`/`derive`/`check` 子命令，未提及 `--user-home`/`--dry-run`**；且 **PowerShell 安装与验证段未删除**（「安装方式」L55-117、「验证」L173-221、「robocopy」L223-242 仍是 PowerShell 脚本）。
  - ② 未满足：`base/docs/cross-vendor/SKILL-METADATA-MAPPING.md` 与 `AGENT-MAPPING.md` 的「生成脚本接口」节仍引用 `gen-skill-meta.mjs`/`gen-agent-meta.mjs`（SKILL-METADATA-MAPPING.md L131-176、AGENT-MAPPING.md L145-147），**未标注 `ship.mjs` 为既定实现**；`base/docs/HARNESS-SPEC.md` 全文无 `ship.mjs` 引用。
  - ③ 部分：`base/skills/安装.md` 目标目录表（L45-51）仍硬编码 `C:\Users\jxc123\...` 路径，与 `vendors.json` 的相对 `~/.` 路径存在漂移风险。
  - ④ 部分：`CONTEXT.md` 词汇（ship/双模式/x-install/managedPrefixes）口径与实现一致，但「单源派生」词条状态标为**「暂缓落地」**（CONTEXT.md L10，2026-08-25），与 `ship.mjs` 已实现双模式派生矛盾，未同步更新。另 `base/CHANGELOG.md` 无本次 ship effort 的变更记录。
  建议：删除安装.md 的 PowerShell 安装/验证段并补齐 ship 子命令/选项说明；mapping 两文档与 HARNESS-SPEC 标注 ship.mjs；更新 CONTEXT.md 单源派生状态；补 CHANGELOG。

（评论与对话历史追加于此，新内容置于最前。）
