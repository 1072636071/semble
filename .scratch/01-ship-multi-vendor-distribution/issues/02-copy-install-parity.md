# 原样复制安装全流程 + x-install 清单（安装.md parity）

**Status:** ready-for-agent

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

（评论与对话历史追加于此，新内容置于最前。）
