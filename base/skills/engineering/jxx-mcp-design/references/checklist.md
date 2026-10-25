# MCP 设计检查清单

设计或审查 MCP Server 时，逐条检查：

## 工具面

- [ ] **没有 1:1 API 映射** — 工具按用户意图/工作流组织，而非按 API 文档；高频链路合并成单工具
- [ ] **原语选对了** — 被动数据走 resources、可复用模板走 prompts，只有模型要自主决定的动作才做 tool
- [ ] **命名合规** — 1–128 字符，仅 `A-Za-z0-9_-.`，server 内唯一；按 service/resource 加前缀自带命名空间
- [ ] **每个工具都有 `outputSchema`** — code mode 的类型来源；缺了就退化 `any`
- [ ] **参数名无歧义 + 有 description** — `user_id` 而非 `user`；隐含的格式/术语/关系在描述里显式化
- [ ] **返回值包含下一步提示** — 每个工具的 response 成为下一个发现的起点
- [ ] **返回高信号内容** — 丢掉 `uuid` / `256px_image_url` / `mime_type`；UUID 解析成语义名或 0 起始编号
- [ ] **大结果有分页/过滤/截断 + 合理默认值** — 截断文案里引导换更省的策略
- [ ] **`tools/list` 确定性排序** — 客户端缓存与 prompt cache 命中依赖它
- [ ] **声明 `listChanged` 能力** — 工具集变化时发通知

## 安全

- [ ] **危险操作有预览/回滚机制** — 分支、dry-run、事务等
- [ ] **危险操作走 elicitation 确认** — 不赌 LLM 自觉；annotations 只是提示，客户端只对受信 server 采信
- [ ] **密钥/令牌走 elicitation 的 URL mode** — form mode 禁收口令、API key、令牌、支付凭证
- [ ] **保留人能否决的能力** — host 展示工具清单、调用给指示、危险操作给确认
- [ ] **stdio server 绝不写 stdout** — 日志走 stderr（HTTP server 除外）

## 复杂度与配置

- [ ] **分层暴露复杂度** — 简单任务只需 2-3 个工具，高级功能按需展开
- [ ] **初始工具集 ≤ 5 个** — 入口工具少而精，后续动态展开
- [ ] **有 Skill/模板约束行为** — 不仅靠 tool description 引导 LLM
- [ ] **配置按需收集** — 不在首次连接时要求所有参数；缺参数走 `input_required` + elicitation
- [ ] **跨调用状态用显式 handle** — opaque、寿命写进 description、过期错误可自愈

## 不用弃用特性

- [ ] **无 roots / sampling / logging 推送 / HTTP+SSE** — 改用工具参数、LLM API、stderr/OpenTelemetry、Streamable HTTP

## 交付契约

- [ ] **有不阻塞启动的 UI** — 静态档 `ui/index.html` 单文件离线可开（启动路径不创建/打开/等待，UI 缺失不影响 MCP 可用），或 MCP Apps（`_meta.ui.resourceUri` + 沙箱 iframe）；两档都不进启动路径
- [ ] **有披露式配套引导技能** — 技能名同 MCP 名；SKILL.md 仅留最小可用路径 + reference 指针，全量细节下沉 `references/`，且内容与 UI 同源

## 验证

- [ ] **有评估任务集** — grounded 真实用例、配可验证结果、覆盖多工具调用链路
- [ ] **看工具调用指标迭代** — 调用数、token、耗时、错误数；冗余调用调分页上限，参数错误改描述
- [ ] **保留 held-out 测试集** — 防过拟合到训练评估
