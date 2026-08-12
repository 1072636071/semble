# ship 骨架 + 厂商注册表 + init 模板脚手架

**Status:** ready-for-agent

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

（评论与对话历史追加于此，新内容置于最前。）
