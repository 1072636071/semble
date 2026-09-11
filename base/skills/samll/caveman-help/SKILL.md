---
name: caveman-help
description: >
  所有 caveman 模式、技能和命令的快速参考卡。
  一次性展示，非持久模式。触发方式：/caveman-help、
  "caveman help"、"what caveman commands"、"how do I use caveman"。
---

# Caveman 帮助

被调用时展示此参考卡。一次性输出——不要切换模式、写入标记文件或持久化任何内容。以 caveman 风格输出。

## 模式

| 模式             | 触发方式                | 变化                                                   |
| ---------------- | ----------------------- | ------------------------------------------------------ |
| **Lite**         | `/caveman lite`         | 去除填充词，保留句式结构                               |
| **Full**         | `/caveman`              | 去除冠词、填充词、客套、模糊修饰，允许片段式表达。默认 |
| **Ultra**        | `/caveman ultra`        | 极限压缩，裸片段，表格优于散文                         |
| **Wenyan-Lite**  | `/caveman wenyan-lite`  | 文言文风格，轻度压缩                                   |
| **Wenyan-Full**  | `/caveman wenyan`       | 完整文言文，最大古文简洁度                             |
| **Wenyan-Ultra** | `/caveman wenyan-ultra` | 极限文言文，古代学者省墨版                             |

模式持续生效，直到切换或会话结束。

## 技能

| 技能                 | 触发方式                   | 功能                                                     |
| -------------------- | -------------------------- | -------------------------------------------------------- |
| **caveman-commit**   | `/caveman-commit`          | 精简提交信息，Conventional Commits 格式，主题行 ≤50 字符 |
| **caveman-review**   | `/caveman-review`          | 单行 PR 评论：`L42: bug: user null. Add guard.`          |
| **caveman-compress** | `/caveman-compress <文件>` | 将 .md 文件压缩为 caveman 文风，节省约 46% 输入 Token    |
| **caveman-help**     | `/caveman-help`            | 本参考卡                                                 |

## 停用

说"stop caveman"或"normal mode"。随时可用 `/caveman` 重新激活。

## 语言

默认保持用户的语言。用户写葡萄牙语 → 用葡萄牙语 caveman 回复。压缩的是风格，不是语言。技术术语、代码、命令、提交类型和精确错误字符串保持原样，除非用户要求翻译。

## 配置默认模式

默认模式 = `full`。修改方式：

**环境变量**（最高优先级）：

```bash
export CAVEMAN_DEFAULT_MODE=ultra
```

**配置文件**（`~/.config/caveman/config.json`）：

```json
{ "defaultMode": "lite" }
```

设为 `"off"` 可禁止会话启动时自动激活。用户仍可手动用 `/caveman` 激活。

优先级：环境变量 > 配置文件 > `full`。

## 更多

完整文档：https://github.com/JuliusBrussee/caveman
