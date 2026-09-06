# 桶基础设施：tdai- 前缀注册 + 三技能骨架

**Status:** done

**Blocked by:** 无——可立即开始

**构建内容：** ship 认识 TDB-AM 技能族；三个新技能目录含 SKILL.md 骨架、references/、scripts/，可被 ship 分发与清理覆盖

**验收标准：**

- [x] vendors.json managedPrefixes 含 tdai-
- [x] 三技能 SKILL.md 骨架含 frontmatter 与必要子目录
- [x] ship check 通过该族

## 评论

（评论与对话历史追加于此，新内容置于最前。）

- 2026-08-31 实施完成（M1）：vendors.json `buckets` 增加 `TDB-AM`（ship 只扫 buckets，缺则整族不被识别）、`managedPrefixes` 增加 `tdai-`；三技能 SKILL.md 骨架 + references//scripts/ 子目录（.gitkeep）+ 已有 adr/；`ship check` 全部通过、`install --dry-run` 确认五技能（含既有 dsh-tdai-routing/panel-admin）进入分发计划。待 `/jxx-code-review`。
