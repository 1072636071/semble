Quickstart:

```bash
npx skills add mattpocock/skills --skill=goal-mode
```

```bash
npx skills update goal-mode
```

[Source](https://github.com/mattpocock/skills/tree/main/skills/engineering/goal-mode)

## What it does

Goal mode is a results-oriented autonomous loop. You set three things — a goal, acceptance criteria, and constraints — and the agent decomposes, executes, and self-verifies in a loop until every acceptance criterion passes, then delivers. It is the "assign in the evening, check in the morning" pattern: you stop being the supervisor who types each next step and become the boss who only sets the target and inspects the result.

The defining constraint is that the loop never starts until the goal is sharp. A fuzzy goal is the single largest cause of loop failure — the loop will efficiently build the wrong thing. Phase 0 grills you (one question at a time, each with a recommended answer) until the goal, acceptance, constraints, and a time/turn budget are frozen into a `GOAL.md` contract that becomes the sole stop condition for every later loop.

## When to reach for it

- **Invocation mode.** You invoke this by typing `/jxx-goal-mode` — the agent won't reach for it on its own, because committing to an autonomous loop is a decision only the human should make.
- **Trigger boundary.** Reach for this when a task is long, its path uncertain, and the process heavy — deep research, long-form reports, batch code fixes, literature review. For a one-shot small task with clear steps (translate one sentence, answer a question, rename a file), just do it directly — wrapping it in a goal loop adds overhead without value.

## Prerequisites

Goal mode writes a `GOAL.md` contract into the current workspace at phase 0 and consults it every loop. That file is the stop condition — it must persist for the duration of the task. No issue tracker or other prior setup is required; the contract is the only state.

## The contract, the loop, the guardrails

The leading word is **contract**. The goal-acceptance-constraints triple is frozen into `GOAL.md` before any work begins, and that file — not the agent's own judgement — is what decides when the loop stops. Each acceptance criterion must be observable, decidable, bound to an executable verification command (`（验证：...）`), and backed by independent evidence rather than the agent's self-report.

The loop runs decompose → execute → verify → decide. It defaults to **not interrupting you** — checkpoints are pushed right, to delivery. The agent stops mid-loop only on hard conditions: a constraint is about to be crossed (a fuse), a pause condition is triggered (a red light), the budget is exhausted, the goal turns out to be internally contradictory, or a fix requires changing the contract itself. Delivery is a verification table: each acceptance criterion mapped to its verification command and the command's actual output, pass or fail — never "I implemented X."

## It's working if

- A `GOAL.md` exists in the workspace before any execution begins, with goal, acceptance, constraints, and budget.
- Every acceptance criterion on delivery is paired with independent evidence (command output / file path / test result), not a self-report.
- The loop ran without interrupting you mid-flight, unless a constraint, the budget, or a goal contradiction forced it.
- Any unmet criterion is explicitly flagged at delivery, not papered over.

## Where it fits

- **Role.** A reach-for-it-anytime standalone for long, path-uncertain tasks — the outer loop that can delegate execution slices inward to [/tdd](https://aihero.dev/skills-tdd), [/implement](https://aihero.dev/skills-implement), or [/research](https://aihero.dev/skills-research).
- **Neighbours.** When the goal needs to become a PRD first, run [/to-prd](https://aihero.dev/skills-to-prd); when the decomposition discipline is what you want, [/to-issues](https://aihero.dev/skills-to-issues) splits work into vertical slices.
- **The map.** See [ask-matt](https://aihero.dev/skills-ask-matt) for the router over the whole skill set.
