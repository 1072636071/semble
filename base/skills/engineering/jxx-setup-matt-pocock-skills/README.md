# jxx-setup-matt-pocock-skills

为仓库配置工程技能环境——设置 issue tracker、triage 标签词汇表与领域文档布局。

## 何时使用

首次使用其他工程技能前运行一次，初始化仓库的工程技能基础设施。

## 执行方式

固定流程（探索仓库状态、写入 `AGENTS.md`/`CODEBUDDY.md`/`docs/agents/*.md`）由本技能自带的 `scripts/setup.mjs` 脚本确定性完成（自包含、零第三方依赖，种子模板即本目录下的三份 `.md`）：

```bash
node scripts/setup.mjs detect --root <目标仓库根>    # 步骤 1：探索（只读 JSON 报告）
node scripts/setup.mjs sync-doc --root <目标仓库根> [--layout single|multi] [--labels <json>] [--dry-run]  # 步骤 4：写入
```

脚本逐文件输出 `[created]/[updated]/[unchanged]` 执行日志；判读与决策（布局选择、标签覆盖）由模型与用户完成。测试：`node --test tests/setup.test.mjs`。

## 依赖

- 外部 issue tracker 配置（本地文件或 GitHub/Linear 等真实 tracker）。
- triage 标签词汇表与领域文档布局。
