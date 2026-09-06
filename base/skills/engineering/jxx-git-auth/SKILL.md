---
name: jxx-git-auth
description: 加载 Git 平台访问令牌（cnb / GitHub / Gitee），供 push、clone 私有仓库、调用平台 API 或 gh CLI 等需要凭据的操作使用。当遇到 push/clone 报 401/403、认证失败、需要 token / 密钥 / 凭据 / 访问令牌，或要操作私有仓库时使用。
metadata:
  version: 1.0.0
---

# Git 凭据加载

只做一件事：把令牌取到手，注入当前操作，然后闭嘴。

## 令牌源

唯一来源，位于仓库之外（永不入库）：

```
C:\Users\jxc123\Nutstore\1\我的坚果云\项目机密\Secret\git-tools.md
```

需要凭据时读取该文件。它含三个平台：

| 平台 | 用户名 | 令牌位置 |
|---|---|---|
| cnb | 固定为 `cnb` | 文件中 `Token:` 行 |
| GitHub | 令牌即身份（`ghp_` 前缀） | 文件中「我的github超级秘药」行 |
| Gitee | 令牌即身份 | 文件中 `gitee：` 行 |

## 流程

1. 读令牌文件。
2. 按目标判定平台：`cnb.cool` → cnb，`github.com` → GitHub，`gitee.com` → Gitee。
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
