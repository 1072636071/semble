# wecom-cli 生态（官方/半官方）说明与安装

> 文档生成时间：2026-07-03  
> 适用场景：企业微信 AI Agent 开发、自动化办公、Claude Code / OpenClaw / Codex / WorkBuddy 等 Agent 接入企业微信

---

## 一、生态概览

`wecom-cli` 是企业微信官方/半官方推出的命令行工具，旨在把企业微信的核心能力（消息、日程、文档、智能表格、会议、待办、通讯录）搬到终端，并面向 AI Agent 提供标准化的 Skill 接口。

| 项目 | 定位 | 仓库地址 | 适合场景 |
|------|------|----------|----------|
| `wecom-cli` | 核心 CLI 引擎 | https://github.com/WecomTeam/wecom-cli | 所有企业微信 API 操作、AI Agent 调用 |
| `wecom-unified` | 全能套件（基于 wecom-cli） | https://github.com/WecomTeam/wecom-unified | 覆盖 7 大业务域的完整能力 |
| `wecomcli_crm` | Agent 工作台示例 | https://github.com/liangdabiao/wecomcli_crm | 自然语言操作企业微信 |
| `clawrelay-wecom-server` | 企业微信 ↔ Claude Code 中转 | https://github.com/wxkingstar/clawrelay-wecom-server | 把企业微信机器人变成 Claude 对话入口 |

---

## 二、wecom-cli 核心能力

### 2.1 覆盖业务域

1. **消息** — 发送应用消息、群机器人消息、接收回调消息
2. **通讯录** — 查询/更新部门、成员、标签
3. **日程** — 创建/查询日程、会议
4. **文档** — 创建/编辑文档
5. **智能表格** — 读写智能表格
6. **待办** — 创建/查询待办
7. **会议** — 创建/查询会议

### 2.2 架构特点

- **Rust 核心引擎**：负责与企业微信 API 交互、性能与稳定性。
- **Node.js 外围生态**：通过 npm 分发，安装与跨平台兼容性好。
- **Skill 机制**：为 Claude Code / OpenClaw 等 AI Agent 提供标准化调用接口。
- **人机协同**：既适合人类在终端使用，也适合 Agent 自动化调用。

### 2.3 为什么用 npm 安装 Rust 项目？

```bash
npm install -g @wecom/cli
```

Rust 是核心引擎，npm 负责外围包装与分发。安装后，核心引擎会在首次使用时自动拉取或编译，无需手动处理 Rust 环境。

---

## 三、安装方式

### 3.1 环境准备

- Node.js ≥ 18（推荐 LTS 版本）
- npm 或 pnpm
- 企业微信管理员权限，用于获取 `corp_id`、`agent_id`、`secret` 等凭证

### 3.2 安装 wecom-cli

#### 方式 A：全局安装（推荐）

```bash
npm install -g @wecom/cli
```

#### 方式 B：通过 npx 临时使用

```bash
npx @wecom/cli --help
```

#### 方式 C：安装为 Skill（Claude Code / OpenClaw）

```bash
npx skills add WeComTeam/wecom-cli -y -g
```

> 说明：`-g` 表示全局安装（用户级），`-y` 表示跳过确认。

### 3.3 初始化配置

```bash
wecom-cli init
```

按提示交互式输入：

- `corp_id`：企业 ID
- `agent_id`：应用 ID
- `secret`：应用密钥
- 其他可选配置

首次使用时，AI Agent 会自动创建智能表格并保存配置。

### 3.4 验证安装

```bash
wecom-cli --version
wecom-cli contact get_userlist
```

如果能正确返回企业通讯录，说明安装和配置成功。

---

## 四、wecom-unified 全能套件

`wecom-unified` 是在 `wecom-cli` 之上封装的企业微信 CLI 全能套件，覆盖 7 大业务域，适合直接作为 AI Agent 的 Skill 使用。

### 4.1 安装

```bash
npx skills add WecomTeam/wecom-unified -y -g
```

或克隆仓库后手动安装：

```bash
git clone https://github.com/WecomTeam/wecom-unified.git
cd wecom-unified
npm install
npm run build
```

### 4.2 使用方式

安装完成后，在 Claude Code / OpenClaw 中可以直接用自然语言调用，例如：

- "帮我查一下张明的部门信息"
- "给销售部群发一条本周会议纪要"
- "创建一个明天下午 3 点的项目评审会议"
- "把待办任务清单导出到智能表格"

---

## 五、常见使用示例

### 5.1 终端命令示例

```bash
# 查询通讯录
wecom-cli contact get_userlist

# 发送应用消息
wecom-cli message send --user_id zhangming --msg "下午三点开会"

# 创建日程
wecom-cli schedule create --title "项目评审" --start "2026-07-04 15:00" --duration 60

# 导出待办
wecom-cli todo list --export todo.xlsx
```

### 5.2 Claude Code / OpenClaw 中自然语言调用

安装 Skill 后，直接说：

> "用企业微信给 zhangming 发一条消息：今天下午三点开会。"

AI 会自动识别意图并调用对应工具。

---

## 六、与其他 Skill 的对比

| Skill / 工具 | 定位 | 推荐场景 |
|--------------|------|----------|
| `wecom-cli` | 官方核心引擎 | 全面企业微信 API 操作 |
| `wecom-unified` | 全能套件 | 快速搭建企业微信 Agent |
| `wecom-bot-skill` | 群机器人推送 | 只发群消息，轻量需求 |
| `clawrelay-wecom-server` | 中转服务 | 企业微信机器人 ↔ Claude 对话 |
| `wecomcli_crm` | 示例项目 | 学习 Agent 工作台 |

---

## 七、注意事项

1. **权限要求**：企业微信 API 需要管理员在后台配置应用权限，尤其是通讯录、消息、会议等敏感接口。
2. **凭证安全**：`corp_id`、`secret` 等不要硬编码，建议通过环境变量或安全凭证管理。
3. **网络环境**：国内企业微信 API 走 `https://qyapi.weixin.qq.com`，通常无需特殊网络配置。
4. **Rust 编译**：如果首次运行需要编译 Rust 核心，可能需要 Git 和 Rust 工具链（大部分情况下 npm 会处理）。
5. **Skill 安装失败**：如果 `npx skills` 在你的环境中有问题，可以手动克隆仓库并把 `SKILL.md` 放到对应 skills 目录。

---

## 八、相关链接

- wecom-cli 主仓库：https://github.com/WecomTeam/wecom-cli
- wecom-unified 仓库：https://github.com/WecomTeam/wecom-unified
- wecomcli_crm 示例：https://github.com/liangdabiao/wecomcli_crm
- clawrelay-wecom-server 中转：https://github.com/wxkingstar/clawrelay-wecom-server
- 企业微信开发者文档：https://developer.work.weixin.qq.com/

---

## 九、快速开始清单

- [ ] 确认 Node.js 版本 ≥ 18
- [ ] 安装 `wecom-cli`：`npm install -g @wecom/cli`
- [ ] 安装 Skill（可选）：`npx skills add WeComTeam/wecom-cli -y -g`
- [ ] 运行初始化：`wecom-cli init`
- [ ] 验证：`wecom-cli contact get_userlist`
- [ ] 在 Claude Code / OpenClaw 中尝试自然语言指令

