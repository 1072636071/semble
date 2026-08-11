技能按桶文件夹组织在 `skills/` 下：

- `engineering/` — 日常代码工作
- `productivity/` — 日常非代码工作流工具
- `misc/` — 保留但很少使用，不推广
- `personal/` — 绑定个人配置，不推广
- `in-progress/` — 尚未准备发布的草稿
- `deprecated/` — 不再使用

`engineering/` 或 `productivity/`（**推广**桶）中的每个技能必须在顶层 `README.md` 中有引用，并在 `.claude-plugin/plugin.json` 中有条目。`misc/`、`personal/`、`in-progress/` 和 `deprecated/` 中的技能不得出现在两者中。

顶层 `README.md` 中的每个技能条目必须将技能名称链接到其 `SKILL.md`。

每个桶文件夹有一个 `README.md`，列出桶中每个技能及一行描述，技能名称链接到其 `SKILL.md`。推广桶的 `README.md` 和顶层 `README.md` 将条目分为**用户调用**和**模型调用**；非推广桶的 `README.md`（`misc/`、`personal/`）使用扁平列表。

`engineering/` 和 `productivity/` 中的技能还有面向人类的文档页面，位于 `docs/<bucket>/<skill-name>.md`（文档树映射 `skills/` 下这两个桶文件夹）。发布 URL 为 `https://aihero.dev/skills-<skill-name>`，与桶无关——文档路径仅用于仓库组织。当你在 `engineering/` 或 `productivity/` 中添加、重命名或更改技能行为时，按照 [.agents/writing-docs.md](./.agents/writing-docs.md) 创建或同步其文档页面。非推广桶（`misc/`、`personal/`、`in-progress/`、`deprecated/`）中的技能**没有**文档页面。

每个 `SKILL.md` 要么是用户调用的（`disable-model-invocation: true`，仅人类可达），要么是模型调用的（模型或用户可达）。参见 [.agents/invocation.md](./.agents/invocation.md)。

[`ask-matt`](./skills/engineering/ask-matt/SKILL.md) 是映射每个用户可达技能及其关系的路由器。同步文档页面的触发条件同样适用于它：每当添加、重命名、移除或更改用户可达技能在流程中的位置时，重新阅读 `ask-matt` 的 `SKILL.md` 并更新它，使映射保持准确——一个它从未提及的新技能，或一个它仍路由到的旧技能，都是一个撒谎的路由器。

要将每个技能（重新）链接到本地工具技能目录（`~/.claude/skills`、`~/.agents/skills`），运行 `scripts/link-skills.sh`。每个条目是指向本仓库的符号链接，因此 `git pull` 可保持已安装技能最新；添加、移除或重命名技能后需重新运行脚本。
