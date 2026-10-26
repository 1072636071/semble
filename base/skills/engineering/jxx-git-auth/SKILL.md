---
name: jxx-git-auth
description: "加载 Git 平台访问令牌。当 push/clone 报 401/403、认证失败、需要 token，或要操作私有仓库时触发。令牌源在仓库外，技能内只存路径。"
x-install: true
metadata:
  version: 1.4.0
---

# Git 凭据加载

取令牌、注入、闭嘴。不教 git。

## 脚本

`scripts/resolve-token.mjs`（零依赖）。优先用它，不要手抄令牌。

| 用法 | 输出 |
|---|---|
| 无参数 | 全部平台，令牌**掩码** |
| `--host <host>` | 单条，令牌**掩码** |
| `--token <host>` | 明文令牌 |
| `--remote <host> <owner/repo>` | 带凭据的 HTTPS remote |

明文模式（后两行）只用于**直接接进命令或变量**，禁止先打印再看。令牌源缺失退出码 2，未知 host 退出码 3。脚本不写任何文件。

## 令牌源

仓库外，永不入库。用户名不硬编码。**定位与主仓 `resolveSecretDir` / 灵枢 `resolve_secret_dir` 同款四级链**：

```
env TDAI_SECRET_DIR  >  ~/.tdai/secret-dir.json 指针  >  默认布局 <home>/Nutstore/1/我的坚果云/项目机密  >  全目录扫描兜底
```

扫描兜底只收「下面真有 `registry.yaml`」的根（过滤 `坚果云同步冲突` 假命中）；命中即写指针缓存，后续零扫描。本技能脚本把这套解析内联了一份（技能仓跨仓零依赖，与主仓/灵枢**同款口径**而非同一份实现——主仓那份在 `tools/lib/memory-mcp-core.mjs#resolveSecretDir`，本仓不可 import）。

源文件是机密根下的 `Secret/git-tools.md`，registry 条目 id = `secret-git-tools`。

**读源文件的两条路**（都可用，脚本走第 ① 条）：

1. **脚本**（推荐，掩码默认）：`node scripts/resolve-token.mjs [--host <host> | --token <host> | --remote <host> <owner/repo>]`。
2. **`secret-store` MCP 工具面**（harness 内已挂载 `secret-store` 时）：`mcp__secret-store__secret_store_get { ref: "secret-git-tools" }` 取内容，返回带 `sha256` 可自证；查条目元信息用 `mcp__secret-store__secret_store_list { query: "git" }`（**永不返回密钥值**）。缺该 MCP 时回落裸文件读（路径按上面四级链解析）。

源文件是结构化凭据清单（YAML 块），字段：

| 字段 | 含义 |
|---|---|
| `host` | remote host，用它判定平台 |
| `remote_user` | remote 用户名位填什么；`@token` = 令牌即身份（生成时用户名位固定填 `oauth2`，密码位填令牌） |
| `token` | 访问令牌 |
| `auth` | `bearer` = `Authorization: Bearer <token>` |
| `api_base` / `cli_env` / `query_param` | API 根地址 / CLI 环境变量名 / 查询参数认证形式 |

平台清单不写在此。读源文件。新增平台在源文件追加一条，技能不动。

## 流程

1. 按上节顺序定位并读取源文件。
2. 用目标 remote 的 host 匹配 `host` 字段，选中条目。
3. 注入，按操作类型三选一：
   - HTTPS remote：`https://<userinfo>:<token>@<host>/<owner>/<repo>.git`；`remote_user` 为 `@token` 时 userinfo 取 `oauth2`（实测 gitee / github 均接受；直接用令牌当用户名会被 gitee 拒为 `token username invalid` → 403）
   - API：`Authorization: Bearer <token>`（或 `?access_token=<token>`）
   - `gh` CLI：`GH_TOKEN=<token>`
4. 用完即止。不持久化、不落仓库文件。

## 硬约束

- 令牌明文禁止进入仓库文件、commit message、日志、回复。
- 令牌禁止出现在 `git remote -v`、命令回显、错误输出。报错先脱敏再展示。
- 令牌失效 → 提示用户更新令牌源文件。不猜、不编造、不用占位符。
