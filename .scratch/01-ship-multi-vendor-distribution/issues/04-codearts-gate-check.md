# CodeArts 硬门禁 + check 子命令

**Status:** done

**Blocked by:** 03

**构建内容：** 维护者能预先知道哪些技能会被 CodeArts 质量门禁拒收：`ship check` 不落盘地预检全部技能/agent 的派生与门禁，失败时非零退出（CI 可用）；实际安装时 CodeArts 英文内容缺失的技能在该平台被跳过并报结构化错误，其余厂商不受影响照常安装。

**验收标准：**

- [ ] CodeArts 英文 5 行 description 或英文正文块缺失时：该技能对 CodeArts 不安装、错误信息含文件与缺失字段、命令非零退出
- [ ] 上述门禁失败不阻塞其他厂商安装（其余平台全部正常）
- [ ] `check` 子命令在不安装的情况下完成全部门禁/派生预检，有失败项即非零退出
- [ ] `check` 对全部门禁通过的技能返回成功（零退出）
- [ ] 门禁校验与 `install` 共用同一实现（单一事实源）
- [ ] 本切片配套 `node:test` 用例在临时目录通过（含门禁失败/成功双路径）

## 评论

- [2026-08-27] audit-ship 核查：验收标准逐项结论（6/6 满足）。① 缺 description-en 或英文块 → CodeArts 不安装、错误含文件与缺失字段、非零退出（ship.mjs L347-349 deriveError、L509-511 failures；测试 18/19 通过）；② 门禁失败不阻塞其他厂商（ship.mjs runInstall 逐厂商独立、测试 19 通过）；③ `check` 预检派生/门禁、失败非零退出（ship.mjs L607-612 runCheck、L735-743）；④ 门禁全通过返回零（ship.mjs L737-739）；⑤ 门禁与 install 共用 deriveSkill/deriveAgent 单一实现（ship.mjs 单一事实源）；⑥ 门禁失败/成功双路径 node:test 用例通过（测试 18-20）。`node --test base/scripts/test/ship.test.mjs` 23/23 通过。判定为已完成第一轮开发，待代码审查。

（评论与对话历史追加于此，新内容置于最前。）
