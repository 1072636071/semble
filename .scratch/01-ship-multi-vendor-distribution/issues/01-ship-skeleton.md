# ship 骨架 + 厂商注册表 + init 模板脚手架

**Status:** done

**Blocked by:** 无——可立即开始

**构建内容：** 维护者敲 `ship init --type skill --name <x>` 即得到一个结构合法、name 与目录一致的源文件骨架；`ship` 命令能识别零参数与 `init`/`derive`/`install`/`check` 子命令；平台清单可从 `vendors.json` 读出 7 家平台及其用户级/项目级目录、派生规则有无。

**验收标准：**

- [ ] `init --type skill --name <x>` 生成目录与 `SKILL.src.md`，frontmatter 含 name（满足 openCode 正则、≤64）、精剪 description、`x-vendors` 默认骨架、`x-install` 缺省 true
- [ ] `init --type agent --name <x>` 生成 `AGENT.src.md` 对应骨架
- [ ] `init` 缺必填参数时报用法错误并无副作用
- [ ] 缺省参数 `ship`（零参数）触发全流程入口并给出可解析的摘要输出
- [ ] `vendors.json` 声明 7 家：4 家带派生规则，3 家无（走原样复制 fallback）；每家含用户级/项目级目录；agents 目录仅已调研 4 家声明
- [ ] 未知子命令/未知参数报错且非零退出
- [ ] 本切片配套 `node:test` 用例在临时目录通过（`--user-home` 重定向生效）

## 评论

- [2026-08-27] audit-ship 核查：验收标准逐项结论（7/7 满足）。① `ship init --type skill --name <x>` 生成 `SKILL.src.md`，frontmatter 含 name/x-vendors 骨架/x-install:true（`base/scripts/ship.mjs:616-645`、`templates/skill/SKILL.src.md`）；② agent 同理生成 `AGENT.src.md`（ship.mjs L633-634、templates/agent）；③ 缺必填参数报用法无副作用（ship.mjs L617-618）；④ 零参数 `all` 全流程输出可解析摘要（ship.mjs L682/L712-733）；⑤ `vendors.json` 7 家、4 家 derive、3 家无，agents 目录仅前 4 家声明（`base/scripts/vendors.json`）；⑥ 未知子命令/选项非零退出（ship.mjs L689/L692）；⑦ `node --test base/scripts/test/ship.test.mjs` 23/23 通过（工单 01 对应用例 1-7），`--user-home` 重定向生效。判定为已完成第一轮开发，待代码审查。

（评论与对话历史追加于此，新内容置于最前。）
