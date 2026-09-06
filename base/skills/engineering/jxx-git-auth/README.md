# jxx-git-auth

加载 Git 平台访问令牌（cnb / GitHub / Gitee）并注入当前操作。只做凭据，不教 git。

## 何时使用

- push / clone 报 401、403、认证失败
- 操作私有仓库
- 需要调用平台 API 或使用 `gh` CLI

模型可自动调用，也可手动 `@`。

## 工作流

1. **读令牌源** — 仓库外的机密文件（路径见 `SKILL.md`），令牌值永不入库
2. **判平台** — 按 remote host：`cnb.cool` / `github.com` / `gitee.com`
3. **注入** — HTTPS remote 内嵌 / `Authorization` 头 / `GH_TOKEN` 环境变量，按操作类型选一种
4. **闭嘴** — 用完即止，不持久化

## 平台映射

令牌源文件是一份结构化凭据清单（YAML 块），每条含 `host` / `remote_user` / `token` / `auth` 等字段：

| 平台 | `host` | `remote_user` | 认证 |
| --- | --- | --- | --- |
| cnb | `cnb.cool` | 固定 `cnb` | Bearer |
| GitHub | `github.com` | `@token`（令牌即身份，`ghp_` 前缀） | Bearer + `GH_TOKEN` |
| Gitee | `gitee.com` | `@token`（令牌即身份） | Bearer 或 `?access_token=` |

新增平台按同样结构在源文件追加一条即可，技能无需改动。

## 分发

`x-install: true` —— 随 `ship install` **默认分发**到全部平台的用户级技能目录。需要装进某个项目时用 `ship install --project`。

## 硬约束

- 令牌不得写入仓库文件、commit message、日志
- 不在回复中原样回显令牌
- git 报错输出先脱敏再展示
- 令牌失效 → 提示用户更新令牌源，不猜、不编造

## 相关技能

- `/jxx-resolving-merge-conflicts` — 合并冲突解决（需要远端操作时可能先经过本技能）
