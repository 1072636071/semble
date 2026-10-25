---
name: huawei-cloud-codebuddy-jxx-t2i-prompts
description: |-
  1. Text-to-image prompt engineering: reuse, adapt, search and store prompt templates.
  2. Triggered by: text-to-image, prompt template, AI art prompt, Midjourney/Flux/SDXL/Seedream/即梦 prompt, 提示词, 文生图.
  3. Avoids ad-hoc prompt writing by pairing a category-indexed template library with per-platform syntax rules.
  4. Usage: pick platform syntax → load template → fill slots → search channels when missing → save verified template to the user library.
  5. Prerequisite: Node.js 18+ to run scripts/prompt-lib.mjs; library lives at ~/.agents/t2i-prompts (override with T2I_PROMPT_HOME).
tags:
  - jxx-t2i-prompts
  - codebuddy
  - prompts
  - image-generation
---

# jxx-t2i-prompts

Turn "write me an image prompt" into "load a template, fill the slots, save what worked".

## Workflow

1. **Pick the platform** — read `references/platforms.md`, take only that platform's syntax row. Never mix weight syntaxes across platforms.
2. **Check the library first** — `node <skill>/scripts/prompt-lib.mjs list`, then `show <id>`. A hit needs category and tags to match, not just a keyword.
3. **No hit → search** — follow the channel recipes in `references/sourcing.md` (site-specific queries, not "just google it"), then screen candidates with its acceptance rules. Keep 1-3.
4. **Assemble** — use the eight-slot skeleton in `references/framework.md`. Every slot filled with concrete words; at most one empty adjective per slot.
5. **Harvest** — when the user approves a result or the same prompt yields 3+ usable images, save it: `new` → fill → `add`. Format and rules: `references/harvest-protocol.md`. Every write to the global library is auto-mirrored into `<project>/.scratch/t2i-prompts/` so the template travels with the repo; `check` reports drift.

## Hard rules

- Filled example must be copy-pasteable, no placeholders left.
- Negative prompts only where the platform honors them.
- Never edit the built-in library; agents write to the user library.
- Every template carries provenance and a `verified` date; stale platform syntax gets rewritten, not copied.

## Library

- Built-in: `references/templates/` (ships with the skill).
- User: `~/.agents/t2i-prompts/` (`T2I_PROMPT_HOME` overrides).
- Commands: `list`, `search`, `show <id>`, `new <id>`, `copy <id> <new-id>`, `add <file>`, `check`, `init` — all on `scripts/prompt-lib.mjs`, zero dependencies.