## 它做什么

`wait-what` 是一条消息没落地时你输入的东西。[agent](https://www.aihero.dev/ai-coding-dictionary/agent) 然后重新推销它刚说的话。它加上你缺失的上下文、用通俗英语写，并使用你项目 `CONTEXT.md` 中的词汇。

这个技能只有三行长。那是设计，不是一份未完成的草稿。与啰嗦作斗争的技能因生长而失败：一个四百字的简洁技能仍然让[模型](https://www.aihero.dev/ai-coding-dictionary/model)啰嗦，因为模型读的是篇幅，而不是恳求。这一个携带一个精确的引导词，除此之外什么都没有。

## 何时使用

你通过输入 `/wait-what` 调用它。agent 不会自行触发它，也不应该。只有你知道你什么时候停止跟随。

在你注意到自己在略读的那一刻就用它。agent 已经漂移进它发明的行话、堆了五个缩写，或解释了一个你从未见过前提的决策。它修复你已经在其中的对话。要阻止行话一开始就出现，用 [grill-with-docs](https://aihero.dev/skills-grill-with-docs)，它提前构建共享语言。

## 名字就是机制

引导词是 **wait**。"要简洁"是关于 agent 输出的指令，而模型通过裁剪词语来服从它，让你更跟丢。**Wait** 是关于*你*的状态。它说理解在这里失败了。听到"要简短"的 agent 写电报。听到"等等，你跟丢了我"的 agent 退回去解释。

那个差异就是整个技能。每一个流行的啰嗦修复都命名*输出*：`/tldr`、`/no-fluff`、`/talk-normal`。模型过度纠正成一个更短、同样不清晰的原始人语域。命名*听者*同时要求两半：更少的词**和**你缺失的上下文。

技能说重新推销**那个**，而不是"那最后一条消息"。让你跟丢的通常比一段话更大，所以 agent 决定退回多远。

## 它插进你已经有的语言

正文重用了你全局 `CLAUDE.md` 和你项目 `CONTEXT.md` 中已有的引导词。ASD-STE100 简化技术英语设定语域。统一语言提供名词。技能、`CLAUDE.md` 和 `CONTEXT.md` 够到相同的[token](https://www.aihero.dev/ai-coding-dictionary/token)，所以调用它不是一个新指令。它是提醒一个 agent 已经同意的东西。

如果你没有 `CONTEXT.md`，技能仍然有效。你只失去领域词汇那一半。

## 正常工作的标志

- 重新推销是**更短且更清晰**的，不是更短且更钝的。
- 它加上你缺失的前提，而不只是删词。
- 项目名词替换编造的名词。你 `CONTEXT.md` 中的术语回来了。
- 你能连续用两次，而且它不会退化成生硬。

## 在流程中的位置

你可以在任何时刻、任何对话中、任何其他技能内部使用 `wait-what`。它事后修复一条消息。真正的解药是提前约定的共享语言，那是 [grill-with-docs](https://aihero.dev/skills-grill-with-docs)：一场边跑边执行 [domain-modeling](https://aihero.dev/skills-domain-modeling) 的[访谈](https://www.aihero.dev/ai-coding-dictionary/grilling)会话，让你俩都用的词落进你的 `CONTEXT.md`。如果你不确定哪个技能适合此刻，[ask-matt](https://aihero.dev/skills-ask-matt) 为你路由。
