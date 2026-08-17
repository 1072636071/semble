# install/verify → Node

**Status:** ready-for-agent

**Blocked by:** 01

**构建内容：** 把根目录 `install.ps1`/`verify.ps1` 重写为配置驱动的 `install.mjs`/`verify.mjs`：源/目标目录与安装清单外置为 `skills.config.json`，消除硬编码路径；保留"递归安装 + SHA256 校验 + 残留清理"全部能力；支持 `--user-home` 重定向与 `--dry-run` 预演，可在临时 fixture 上端到端测试（node:test 范式，复用共享工具层的 fs-cli）。

**验收标准：**

- [ ] `install.mjs`/`verify.mjs` 用 `node xxx.mjs` 可跑，行为覆盖原 PS 脚本（安装、逐平台哈希比对 OK/MISMATCH/MISSING、清理残留）
- [ ] 路径与清单全部来自 `skills.config.json`，脚本内零硬编码；仓库下 PS 脚本退役
- [ ] 测试通过 fixture 注入（配置 + `--user-home` + `--dry-run`）在 `node:test` 下验证端到端，无第三方依赖

## 评论

（评论与对话历史追加于此，新内容置于最前。）