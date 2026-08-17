# skill 生命周期脚本 → Node

**Status:** ready-for-agent

**Blocked by:** 01

**构建内容：** 把 skill 生命周期三件套从 Python/bash/即时迁移到 Node：skill-creator（`init_skill.py`→脚手架、`quick_validate.py`→frontmatter/结构校验、`package_skill.py`→打包，引入 `front-matter` 解析 YAML、交互确认菜单）、skill-tester（`run_eval.py`→并行走 eval + 汇总）、skill-reviewer（把规则集形式化为结构化规则后做机械扫描）；同步迁移其 `tests/`（pytest→node:test）并更新各自 SKILL.md 中 `python/ps1/bash` 命令引用为 `node xxx.mjs`。

**验收标准：**

- [ ] 三个技能的核心确定性命令均有对应 `.mjs` CLI，`node xxx.mjs` 可跑且无解释器依赖（skill-reviewer 规则已形式化为结构化规则）
- [ ] 各技能 `tests/` 迁到 `node:test`（复用共享工具层），原 pytest 移除
- [ ] 各技能 SKILL.md 中的脚本命令引用已更新为 `node`，文档一致

## 评论

（评论与对话历史追加于此，新内容置于最前。）