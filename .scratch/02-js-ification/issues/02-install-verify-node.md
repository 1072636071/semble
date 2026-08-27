# install/verify → 收敛 ship.mjs

**Status:** done

**Blocked by:** 01

**构建内容：** 把根目录 `install.ps1`/`verify.ps1` 的能力收敛进 `ship.mjs` 既有 `install`/`check` 子命令（对齐 ADR 0001/0003 单一入口决策，**不新建**平行 `install.mjs`/`verify.mjs`）：源/目标目录与安装清单外置为配置（`skills.config.json` 或并入 `vendors.json`，实施时定），消除硬编码路径；保留"递归安装 + SHA256 校验 + 残留清理"全部能力；补齐 `--user-home` 重定向与 `--dry-run` 预演，可在临时 fixture 上端到端测试（node:test 范式，复用共享工具层的 fs-utils）。

**验收标准：**

- [ ] `node base/scripts/ship.mjs install|check` 行为覆盖原 PS 脚本（安装、逐平台哈希比对 OK/MISMATCH/MISSING、清理残留）
- [ ] 路径与清单全部来自外部配置，脚本内零硬编码；仓库下 PS 脚本退役
- [ ] 测试通过 fixture 注入（配置 + `--user-home` + `--dry-run`）在 `node:test` 下验证端到端，无第三方依赖

## 评论

- [2026-08-27] 修复完成：`base/skills/install.ps1`、`base/skills/verify.ps1` 已删除（能力已收敛进 `ship.mjs install|check`），安装指南已同步改为 ship 用法。现验收标准 3/3 满足，判定为 done。
- [2026-08-27] audit-js 核查：验收标准 2/3 满足、1 项未满足，判定为部分完成。满足项：① `node base/scripts/ship.mjs install|check` 已覆盖原 PS 脚本能力（递归安装 + SHA256 逐平台比对 OK/MISMATCH/MISSING + managedPrefixes 残留清理），`base/scripts/test/ship.test.mjs` 用 --config/--user-home/--dry-run fixture 注入端到端验证，`node --test` 全绿；③ 零第三方依赖。未满足项：② 路径/清单已外置到 `base/scripts/vendors.json` 零硬编码（满足），但「仓库下 PS 脚本退役」未落地——`base/skills/install.ps1`、`base/skills/verify.ps1` 仍存在且被 git 跟踪（未删除）。缺失项：退役根/仓库下 install.ps1/verify.ps1。

（评论与对话历史追加于此，新内容置于最前。）
