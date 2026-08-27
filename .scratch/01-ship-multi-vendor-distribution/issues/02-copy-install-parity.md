# 原样复制安装全流程 + x-install 清单（安装.md parity）

**Status:** done

**Blocked by:** 01

**构建内容：** 维护者运行 `ship`（或 `install` 子命令）后，所有未迁移的存量技能被复制到 7 家用户级目录并做 SHA256 验证、残留清理——与现有 PowerShell 安装流程逐字节等价的 .mjs 实现；5 个被排除的 productivity 技能经 `x-install: false` 声明后默认不再安装，清单属性就近可见。

**验收标准：**

- [ ] 无 `SKILL.src.md` 的存量技能在 7 家用户级目录全部安装成功
- [ ] 每个已装技能输出 OK/MISMATCH/MISSING 三态 SHA256 验证结果
- [ ] 目标中匹配 managedPrefixes 且源中已不存在的目录被清理；不匹配前缀的目录绝不动
- [ ] 5 个排除项技能 frontmatter 已补 `x-install: false`，全流程下不再安装；其余默认安装（缺省 true）
- [ ] `--user-home <dir>` 重定向生效，默认路径与现状安装目录一致
- [ ] 本切片配套 `node:test` 用例在临时目录通过（含验证与清理断言）

## 评论

- [2026-08-27] 修复完成：5 个 productivity 排除项技能（jxx-teach/jxx-wait-what/skill-creator/skill-reviewer/skill-tester）SKILL.md frontmatter 已补 `x-install: false`；`ship.mjs getXInstall` 缺省 'user' 语义不变，全流程下这些技能不再安装。现验收标准 6/6 满足，判定为 done。
- [2026-08-27] audit-ship 核查：验收标准 5/6 满足，**判定部分完成**。满足项：① 无 src 存量技能装到 7 家用户级目录（ship.mjs runInstall L530-537、测试 8 通过）；② OK/MISMATCH/MISSING 三态 SHA256（ship.mjs runVerify L592-603）；③ managedPrefixes 残留清理、不匹配前缀不动（ship.mjs L541-550、测试 10/14 通过）；⑤ --user-home 重定向、默认路径与现状一致（测试 8 断言 `.agents/skills` 等）；⑥ node:test 用例通过（测试 8-15）。**缺失项 ④**：5 个被排除的 productivity 技能（jxx-teach/jxx-wait-what/skill-creator/skill-reviewer/skill-tester）frontmatter 均**未补 `x-install: false`**——`base/skills/productivity` 下所有 SKILL.md 搜索 `x-install` 返回 0 结果，`getXInstall`（ship.mjs L330-336）缺省返回 'user'，故这些技能全流程下**仍会被安装**到各平台，与"默认不再安装"目标不符（测试 9 仅用 fixture 的 jxx-skip 验证了开关逻辑，未覆盖真实 5 技能）。待补 `x-install: false` 后复查。

（评论与对话历史追加于此，新内容置于最前。）
