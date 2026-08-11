# 三方技能仓库链接

本目录存放从外部引入的第三方 AI Agent 技能仓库（非本仓库原创）。

| 目录 | 简介 | 来源链接 |
| --- | --- | --- |
| `caveman/` | 原始人模式（极简表达风格技能） | https://github.com/JuliusBrussee/caveman.git |
| `mattpocock-skills/` | Matt Pocock 技能集（基础版） | https://github.com/1072636071/mattpocock-skills.git |
| `mattpocock-skills-A/` | Matt Pocock 技能集（本地魔改版本，基于 `mattpocock-skills/`） | 无 .git（本地魔改，源于 https://github.com/1072636071/mattpocock-skills.git ） |
| `mattpocock-skills-B/` | Matt Pocock 技能集（中文版，基于 `mattpocock-skills/`） | 无 .git（中文版，源于 https://github.com/1072636071/mattpocock-skills.git ） |
| `oh-story-claudecode/` | 小说/故事创作技能（Claude Code 版） | https://github.com/worldwonderer/oh-story-claudecode.git |
| `osc/` | 空目录，待引入 | 无 .git |
| `sumeru/` | Sumeru 技能集（含 skills/、AGENTS.md、CLAUDE.md） | https://github.com/xindoo/sumeru.git |
| `temp/` | 临时/草稿技能目录 | 无 .git |
| `writing-dna-skill/` | 写作风格 DNA 技能 | https://github.com/larashero3-dotcom/writing-dna-skill.git |
| `askills/` | askills 技能集（含 skills/、spec/、template/） | https://github.com/1072636071/askills |

## 维护说明

- 新增三方仓库时，请在表中追加一行并填写真实来源链接（GitHub / Gitee 等）。
- 同步来源：本地 master → GitHub (`github/v8`) + Gitee (`origin/master`) 双远程。
- 仅收录 SKILL.md 的 `name` 与 `description` 参与宿主匹配，其余文件一般不进入 agent 上下文。
