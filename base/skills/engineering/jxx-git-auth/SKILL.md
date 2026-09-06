---
name: jxx-git-auth
description: 加载 Git 平台访问令牌（cnb / GitHub / Gitee），供 push、clone 私有仓库、调用平台 API 或 gh CLI 等需要凭据的操作使用。当遇到 push/clone 报 401/403、认证失败、需要 token / 密钥 / 凭据 / 访问令牌，或要操作私有仓库时使用。
x-install: true
metadata:
  version: 1.1.2
---

# Git 凭据加载

只做一件事：把令牌取到手，注入当前操作，然后闭嘴。

## 令牌源

唯一来源，位于仓库之外（永不入库）。**路径中的用户名随机器而变，不要硬编码**：

```
%USERPROFILE%\Nutstore\1\我的坚果云\项目机密\Secret\git-tools.md
```

即 `C:\Users\<当前用户名>\Nutstore\1\我的坚果云\项目机密\Secret\git-tools.md`（POSIX 写作 `~/Nutstore/1/我的坚果云/项目机密/Secret/git-tools.md`）。

解析顺序：

1. `USERPROFILE`（Windows）/ `HOME`（POSIX）—— 优先
2. `os.homedir()` 等运行时 API
3. 以上都拿不到时，才用当前登录用户名拼 `C:\Users\<用户名>`

**不要把具体用户名写进任何技能文件**——技能会分发到多台机器，写死即失效。

需要凭据时读取该文件。它是一份结构化的平台凭据清单（YAML 块），每条含 `name` / `host` / `api_base` / `remote_user` / `token` / `auth`，可选 `cli_env` 与 `query_param`：

| 平台 | `host` | `remote_user` | 认证 |
|---|---|---|---|
| cnb | `cnb.cool` | 固定 `cnb` | Bearer |
| GitHub | `github.com` | `@token`（令牌即身份，`ghp_` 前缀） | Bearer + `GH_TOKEN` |
| Gitee | `gitee.com` | `@token`（令牌即身份） | Bearer 或 `?access_token=` |

字段含义以令牌源文件中的「字段说明」为准；新增平台按同样结构追加一条即可，本技能无需改动。

## 流程

1. 按上述解析顺序定位并读取令牌文件（用户名不硬编码）。
2. 按目标 remote 的 host 匹配源文件中的 `host` 字段，选中平台条目（不写死平台清单）。
3. 注入：
   - **HTTPS remote**：`https://<user>:<token>@<host>/<owner>/<repo>.git`
     - cnb：`<user>` 填 `cnb`
     - GitHub / Gitee：`<user>` 填令牌本身
   - **平台 API**：`Authorization: Bearer <token>`（Gitee 亦支持 `?access_token=<token>`）
   - **`gh` CLI**：环境变量 `GH_TOKEN=<token>`
4. 用完即止。不持久化、不落任何仓库文件。

## 硬约束

- **禁止**把令牌明文写入仓库文件、commit message、日志，或在回复中原样展示给用户。
- **禁止**让令牌出现在 `git remote -v`、命令回显、错误输出中——报错信息先脱敏再展示。
- 令牌失效/过期 → 让用户更新令牌文件。不猜、不编造、不用占位符。
- 本技能不提供 git 操作教学，只管凭据。
