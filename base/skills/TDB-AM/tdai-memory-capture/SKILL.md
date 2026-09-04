---
name: tdai-memory-capture
description: 记忆写入通道（对话上传 / 精华直落 / 技能管理 / 实验联系）。由用户显式调用，不参与自动触发。
version: 0.2.0
---

## 目的与适用

用户显式说「记住这段 / 把这个存到记忆里」时，agent 按本 skill 指导把内容上传给记忆内核：**原始对话走内核蒸馏管线，整理后的精华按类型分流落库，上传的技能可改可删（全生命周期）**——不再「能生不能养」。

**由用户显式调用，不做自动触发**——不与自动蒸馏、其他 skill 抢触发词。

读写分工（与 `memory-mcp` 互指，ADR-0022/0023）：

| 动作 | 走哪条通道 |
| --- | --- |
| 查询记忆 / 技能（检索、读） | **memory-mcp**（MCP，`sk-mcp-` 只读 token） |
| 写入（对话上传 / 精华直落 / 技能增删改） | **本 skill**（REST，`sk-mem-` user_key） |
| 实验联系（用户报「标记编码」→ 真实工作区验证 → 自动应用/撤销） | **本 skill**（REST，`references/experiment-link.md`；MCP 机体走 `/v3/agent/experiment/*`） |

依据：`docs/adr/0023-agent-upload-channel.md`、`.scratch/07-mcp-agent-interface/PRD.md`。术语见 `CONTEXT.md`「Agent 能力接入」节。

---

## 凭据供给

写入动作需要 `sk-mem-` user_key（MCP 的 `sk-mcp-` token 固定只读，**不能**用于本 skill 的任何写操作）：

| 占位符 | 含义 | 来源 |
| --- | --- | --- |
| `$PANEL` | Panel 管理面基址（如 `http://127.0.0.1:8123/api/v1`） | 向导收集 |
| `$SID` | service id（`x-tdai-service-id` 头值） | 向导收集 |
| `$UK` | user key（`x-tdai-user-key` 头值，`sk-mem-` 前缀） | 向导收集 |

凭据**复用 panel-admin 的三级供给与向导**（不另建第二套）：①探测坚果云同步根下的密钥子目录复用既有配置；②导入既有配置文件；③交互手填。运行时读取，不落客户端配置。

```bash
# <panel-admin 目录> = 本仓库 docs/skills/panel-admin（权威源），或已安装的 panel-admin skill 产物目录
node <panel-admin 目录>/scripts/setup-credentials.mjs
```

向导探测路径同时认**本仓库权威位**（坚果云同步根 `项目机密/TencentDB-Agent-Memory/panel-admin-credentials.json`）与 **JwikisSkills 遗留位**（`Secret/tdai-panel-admin.json`），两套配置都能直接复用，无需迁移。

**凭据缺失场景**：不猜测凭据、不在对话里索要明文，引导用户运行上述向导后重试。

**密钥纪律**：`user_key` 等同密钥——不进文档、不进对话回显、不进仓库、不进日志。

---

## 双通道与分流（核心决策）

用户说完「记住这段」后，按两步走：

### 第 1 步：判定走哪条通道

| 内容形态 | 通道 | 落点 |
| --- | --- | --- |
| 用户直接贴一段**原始对话**（或多轮往来原文），想整体存档 | **原始通道** | `POST $KS/conversation/add` → 内核异步入 L0 → 蒸馏管线自动提炼 L1/L2/L3 |
| 用户/agent 已经**整理好的精华**（一句话结论、一条经验、一个做法） | **精华通道** | 按类型分流（见第 2 步） |

两步可叠加：先走原始通道存档，再手动补一条精华直落。

### 第 2 步：精华按类型分流（判定标准）

| 判定 | 落点 | 端点 |
| --- | --- | --- |
| **经验 / 做法**：怎么做某件事（流程、技巧、偏好、坑）——可复用的「程序性知识」，未来以技能形式注入工作区 | 技能库 | `POST $KS/skill/create` |
| **事实 / 结论**：是什么（事实、决定、约束、结论）——原子事实，进 L1 参与检索与召回 | L1 | `POST $KS/atomic/create` |

判定口诀：**「教我怎么做的」进技能，「告诉我是什么的」进事实**。同一段内容两种成分都有时拆开分别落。拿不准时问用户一句，不猜。

端点级细节（字段、约束、错误码、curl 示例）：见 `references/capture-endpoints.md`。

---

## 技能全生命周期（乐观锁纪律）

上传的技能**可改可删**，全部走 `/v3/skill/*`：

- `create` → 首次上传；`update`（整篇替换）/ `patch`（局部替换）/ `delete`（软删归档）→ 后续维护。
- **乐观锁纪律**：除 `create` 外，写操作必须带 `expected_version`（先 `skill/get` 拿当前 version）。
- 收到 **`code:40901`（SKILL_VERSION_STALE，HTTP 409）** 时：响应 `data.current_version` 已带最新版本——用它重试一次；再冲突则停下重新 `skill/get` 对比内容，不要盲目循环重试。
- 版本号过期不可恢复（`code:41001` SKILL_VERSION_EXPIRED）时，先 `skill/get` 读最新版再基于它改。

细节见 `references/capture-endpoints.md` §技能全生命周期。

---

## 实验联系（验证「标记编码」→ 自动应用 / 撤销标注）

用户把偏差/优化点的**标记编码**（`dev-…`，面板偏差队列可见）报给 agent 时，走四步闭环：

1. `POST $KS/experiment/run { report_id }` → 领实验指示（含三类验证：实际操作 / 新旧对照 / 关联核实；记下回显的 `skill_version`）。
2. **在真实工作区执行**（真实命令、真实环境——不用沙箱、不编造证据），逐条留可复核证据。
3. `POST $KS/experiment/result` 回传：`verified` 可带 `change`（patch/update，**带上 `expected_version`**）与 `verified_section`；`falsified` 只回 `evidence`。
4. 内核落地：通过 → 自动应用 + 段落打 `verified` 免反思标记 + 偏差置 applied；证伪 → 撤销标注（dismissed，资产不动）。

未 run 不能回传（400）；一条编码只闭环一次（终态再 run 400）。端点字段、错误码、
agent 面（`sk-mcp-`）变体见 `references/experiment-link.md`。

---

## 通用约定

与 panel-admin 共用同一套契约（同一内核）：

- **鉴权头**：`x-tdai-service-id: $SID` 必填；写操作另带 `x-tdai-user-key: $UK`。
- **隔离头**（直连 KS 数据面时）：`x-tdai-team-id` / `x-tdai-agent-id` / `x-tdai-user-id`——conversation/add 与 atomic/create 的身份由这些头解析（resolveIsolation），不在 body 传。
- **响应信封**：`{ "code": 0, "message": "ok", "request_id": "...", "data": {...} }`；`code===0` 成功。技能域错误码：`40901` 版本冲突（带 `data.current_version`）、`42201` 技能名重复、`40401` 技能不存在、`40301` 非 owner。
- **技能名唯一性**：`(team_id, agent_id, name)` 唯一，重复创建返回 `42201`——先 `skill/get-by-name` 判断是否应走 `update`。
- **内容上限**：`atomic/create` content ≤ 8192 字符；`conversation/add` 单批 ≤ 100 条消息、单条 ≤ 8192 字符。

## 域路由表

| 内容 | 参考文件 |
| --- | --- |
| 三写入口 + 技能全生命周期端点细节 | `references/capture-endpoints.md` |
| 端到端演练清单（双通道 + 两类落点各走通一次） | `references/capture-dryrun.md` |
| 实验联系（run/result 契约 + 三类验证 + 错误码） | `references/experiment-link.md` |
| 实验联系演练清单（verified 应用 / falsified 撤销 / 乐观锁 / agent 面） | `references/experiment-dryrun.md` |

## 验收

`references/capture-dryrun.md` 为人工执行清单：原始通道 → `conversation/add`；精华经验类 → `skill/create`；事实类 → `atomic/create`（dryrun 通过），外加技能 `update`/`patch`/`delete` 与 409 乐观锁恢复各走通一次。实验联系演练见 `references/experiment-dryrun.md`（verified → 自动应用 + verified 标记；falsified → 撤销标注）。
