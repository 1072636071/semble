Quickstart:

```bash
npx skills add mattpocock/skills --skill=writing-for-agents
```

```bash
npx skills update writing-for-agents
```

[Source](https://github.com/mattpocock/skills/tree/main/skills/productivity/writing-for-agents)

> 前身为 `writing-great-skills`，已整体重构并改名。

## What it does

`writing-for-agents` is the reference for writing documents agents will read — AGENTS.md, READMEs, skills, issue descriptions. The skill-specific branch (frontmatter, model- vs user-invocation, router skills) lives in its `SKILL-MECHANICS.md`.

## Core concepts

- **Context pointer** — for each passage, choose: inline the content, or point at where it lives. Pointing carries no information, only coordinates.
- **Two loads** — *context load* (what the text costs in the window) vs *cognitive load* (how many pointers you must remember exist). Every pointer and passage spends one.
- **Information hierarchy** — system prompt / resident instruction file / skills / user messages: each harness assembles your doc into a larger structure where it competes for attention. Every doc is either always loaded or conditionally loaded.
- **Leading word** — a distinctive word embedded in text so the relevant skill surfaces when you mention it; generic words drown, distinctive words become handles.
- **Pruning** — every sentence earns its place; two lenses decide survival: who reads it (agents want detail, humans want triggers) and how long it lives.

## When to reach for it

You invoke this by typing `/writing-for-agents` — the agent won't reach for it on its own.

Reach for it whenever you're authoring or reviewing a document agents will read: deciding invocation mode, writing a description, choosing what lives inline versus behind a pointer, or diagnosing why a skill misfires.

## Where it fits

A reach-for-it-anytime standalone reference — the meta-skill you consult while building the rest of the set. Its natural neighbour is any router you maintain (e.g. `ask-matt`), because a router is the direct cure for the cognitive load that user-invoked skills pile up.
