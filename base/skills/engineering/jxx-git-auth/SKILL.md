---
name: jxx-git-auth
description: 加载 Git 平台访问令牌（cnb / GitHub / Gitee），供 push、clone 私有仓库、调用平台 API 或 gh CLI 等需要凭据的操作使用。当遇到 push/clone 报 401/403、认证失败、需要 token / 密钥 / 凭据 / 访问令牌，或要操作私有仓库时使用。
x-install: true
metadata:
  version: 1.2.0
---

# Git 凭据加载

取令牌、注入、闭嘴。不教 git。

## 令牌源

仓库外，永不入库。用户名不硬编码：

```
%USERPROFILE%\Nutstore\1\我的坚果云\项目机密\Secret\git-tools.md
```

解析顺序：`USERPROFILE` / `HOME` → 运行时 homedir API → 按当前用户名拼 `C:\Users\<用户名>`。禁止在任何技能文件里写具体用户名。

源文件是结构化凭据清单（YAML 块），字段：

| 字段 | 含义 |
|---|---|
| `host` | remote host，用它判定平台 |
| `remote_user` | remote 用户名位填什么；`@token` = 令牌即身份 |
| `token` | 访问令牌 |
| `auth` | `bearer` = `Authorization: Bearer <token>` |
| `api_base` / `cli_env` / `query_param` | API 根地址 / CLI 环境变量名 / 查询参数认证形式 |

平台清单不写在此。读源文件。新增平台在源文件追加一条，技能不动。

## 流程

1. 按上节顺序定位并读取源文件。
2. 用目标 remote 的 host 匹配 `host` 字段，选中条目。
3. 注入，按操作类型三选一：
   - HTTPS remote：`https://<remote_user>:<token>@<host>/<owner>/<repo>.git`
   - API：`Authorization: Bearer <token>`（或 `?access_token=<token>`）
   - `gh` CLI：`GH_TOKEN=<token>`
4. 用完即止。不持久化、不落仓库文件。

## 硬约束

- 令牌明文禁止进入仓库文件、commit message、日志、回复。
- 令牌禁止出现在 `git remote -v`、命令回显、错误输出。报错先脱敏再展示。
- 令牌失效 → 提示用户更新令牌源文件。不猜、不编造、不用占位符。
