# skill 生命周期脚本 → Node

**Status:** done

**Blocked by:** 01

**构建内容：** 把 skill 生命周期三件套从 Python/bash/即时迁移到 Node：skill-creator（`init_skill.py`→脚手架、`quick_validate.py`→frontmatter/结构校验、`package_skill.py`→打包，引入 `front-matter` 解析 YAML、交互确认菜单）、skill-tester（`run_eval.py`→并行走 eval + 汇总）、skill-reviewer（把规则集形式化为结构化规则后做机械扫描）；同步迁移其 `tests/`（pytest→node:test）并更新各自 SKILL.md 中 `python/ps1/bash` 命令引用为 `node xxx.mjs`。

**验收标准：**

- [ ] 三个技能的核心确定性命令均有对应 `.mjs` CLI，`node xxx.mjs` 可跑且无解释器依赖（skill-reviewer 规则已形式化为结构化规则）
- [ ] 各技能 `tests/` 迁到 `node:test`（复用共享工具层），原 pytest 移除
- [ ] 各技能 SKILL.md 中的脚本命令引用已更新为 `node`，文档一致

## 评论

- [2026-08-27] audit-js 核查：验收标准逐项结论（3/3 满足），验证方式（skill-creator 三脚本 init-skill/package-skill/validate-skill.mjs、skill-tester run-eval.mjs、skill-reviewer review-skill.mjs 均落地，各自 tests/*.test.mjs 存在且 `node --test` 全绿（75 项，覆盖 creator 3 + tester 1 + reviewer 1 套件）；skill-reviewer 规则已形式化为结构化规则 G.NAM.01/03、G.FMT.01/02/05、G.EXP.01、G.PRA.01；各技能原 pytest/*.py 已移除（无残留 .py）；SKILL.md 命令引用已更新为 `node scripts/*.mjs`（skill-creator/tester），判定为已完成第一轮开发，待代码审查。注：skill-reviewer 的 SKILL.md 为 4 步模型驱动工作流（引用规则集而非 CLI 命令），review-skill.mjs 作为机械扫描补充存在，文档与脚本一致无 python/ps1 引用。

（评论与对话历史追加于此，新内容置于最前。）
