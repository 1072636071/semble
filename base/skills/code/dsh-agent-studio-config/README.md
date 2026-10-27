# dsh-agent-studio-config

统一维护 dsh-agent-studio（DeepSeek Harness Agent Studio 插件）运行配置的技能：备份、observation 复刻、构造、校验、POST、回读对拍、回滚，沉淀 115-01 工单实操坑。入口见 [SKILL.md](SKILL.md)。

## 何时使用

- 配置或修改 dsh-agent-studio（配代理 agent、提示词集/工具集/技能集、子代理花名册）
- 绑定/解绑预设（bindings）、studio 配置回滚
- 理解或规避「绑定即接管」「数组整体替换」语义时

## 资源结构

```
dsh-agent-studio-config/
├── SKILL.md                          # 入口：心智模型 + 标准操作流 + 硬约束
├── README.md
├── references/
│   ├── http-api.md                   # 端点全表、读写头差异、GET 外壳 vs POST 纯体、热生效
│   ├── data-model.md                 # 四池+bindings schema、装载重叠规则、数组整体替换
│   ├── pitfalls.md                   # 坑清单（现象→根因→预防/修法）
│   ├── workflows.md                  # 四个端到端流程 + 新会话验证清单
│   └── config-recipe.md              # 115-01 实录层：数据模型/端点/配方/坑/自检方法论 + §10 变更记录
└── scripts/                          # 零依赖 Node .mjs
    ├── studio-config-get.mjs         # GET /config 落盘备份（只读）
    ├── studio-config-validate.mjs    # POST 前本地校验（只读）
    ├── studio-config-doctor.mjs      # 配置体检（话术↔三面一致性、空面、悬空引用）
    ├── studio-config-post.mjs        # 安全 POST（默认 dry-run，--apply 才写）
    ├── studio-config-verify.mjs      # POST 后验证（只读）
    └── studio-config-rollback.mjs    # 回滚（默认 dry-run，--apply 才写）
```
