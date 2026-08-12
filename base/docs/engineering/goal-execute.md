Quickstart:

```bash
npx skills add mattpocock/skills --skill=goal-execute
```

```bash
npx skills update goal-execute
```

[Source](https://github.com/mattpocock/skills/tree/main/skills/engineering/goal-execute)

## What it does

Goal execute is the autonomous loop that runs against a frozen `GOAL.md` contract: decompose the goal into vertical slices, then execute → verify → record → decide, round after round, until every acceptance criterion passes — only then does it deliver.

The defining constraints are:

- **Passing is never self-reported.** Every acceptance criterion must be paired with evidence from an independent source — a command output, a file path, a test result — and the delivery is a verification table written to `EVIDENCE.md`, not a summary of effort. "I implemented X" is not evidence.
- **Verification is command-driven.** Each acceptance criterion must be bound to an executable verification command (`（验证：...）`); passing = the actual runtime output of that command. The loop reads a top-of-round "must-read" block in `PROGRESS.md` every round — state lives in that file, not in conversation memory.
- **The loop is self-starting (F).** Execute does not depend on the mode router; it can be invoked directly or called from a script/CI, reducing chain-link breakage.

## When to reach for it

- **Invocation mode.** Type `/jxx-goal-execute`, or the agent reaches for it when a frozen contract exists — usually handed off from [/jxx-goal-contract](https://aihero.dev/skills-goal-contract) via the [/jxx-goal-mode](https://aihero.dev/skills-goal-mode) router.
- **Trigger boundary.** Reach for this to start a loop or resume one ("继续 {name}"). If no contract exists yet, this skill will refuse and send you to [goal-contract](https://aihero.dev/skills-goal-contract) — the loop never runs on a verbal goal.

## Prerequisites

A frozen contract: `.goals/{name}/GOAL.md` must exist in the workspace. Progress is tracked in `.goals/{name}/PROGRESS.md` every round, which is what makes the loop resumable — interrupt it anywhere, and re-entering reads that file to continue from the next unfinished slice without repeating finished work.

## The loop and its guardrails

The leading word is **loop** — but a loop with fuses. It defaults to not interrupting you (checkpoints pushed right, to delivery), and stops mid-flight only on hard conditions: a Constraint is about to be crossed (fuse), a Pause Condition is triggered (red light), the budget is exhausted, the goal turns out to be contradictory, or a fix requires changing the contract itself. Failed slices climb a recovery ladder — retry once, switch strategy, degrade scope, skip with a logged reason — and two consecutive slice failures trip the circuit breaker and surface the blockage to you.

## It's working if

- `PROGRESS.md` shows the current round, per-slice status, the "must-read" block updated each round, and a cycle log of what each round learned.
- Interrupted loops resume from the next unfinished slice — no repeated work; state comes from `PROGRESS.md`, not conversation memory.
- Every acceptance criterion is bound to an executable verification command; passing is the actual runtime output of that command.
- Delivery includes an `EVIDENCE.md` table mapping every acceptance criterion to its verification command, the command's output excerpt, and pass or fail.
- Any skipped slice or triggered Pause Condition is explicitly flagged in the delivery, not silently absorbed.

## Where it fits

- **Role.** A chain step — the back half of [goal-mode](https://aihero.dev/skills-goal-mode) → [goal-contract](https://aihero.dev/skills-goal-contract) → this loop. Inside the loop it delegates code slices inward to [/tdd](https://aihero.dev/skills-tdd) or [/implement](https://aihero.dev/skills-implement), and research subtasks to [/research](https://aihero.dev/skills-research).
- **The map.** See [ask-matt](https://aihero.dev/skills-ask-matt) for the router over the whole skill set.
