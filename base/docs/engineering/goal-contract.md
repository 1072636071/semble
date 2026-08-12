Quickstart:

```bash
npx skills add mattpocock/skills --skill=goal-contract
```

```bash
npx skills update goal-contract
```

[Source](https://github.com/mattpocock/skills/tree/main/skills/engineering/goal-contract)

## What it does

Goal contract freezes a fuzzy task into an executable `GOAL.md` contract — five fields: Goal, Acceptance, Constraints, Budget, Pause Conditions. That file becomes the sole stop condition for the autonomous loop that follows.

The defining constraint is that no contract is written until it survives a double-checked **veto gate**: ten gates (Goal names a deliverable, every acceptance criterion is observable/decidable/independently-evidenced and bound to an executable verification command, constraints draw boundaries not steps, and so on), checked twice — once by the drafter, once by an independent checker in a separate context that sees only the draft and the rules, never the drafting rationale. Any veto means fix and re-check, not ship-and-patch.

## When to reach for it

- **Invocation mode.** Type `/jxx-goal-contract`, or the agent reaches for it when a goal needs freezing — most often it is fired by the [/jxx-goal-mode](https://aihero.dev/skills-goal-mode) router, which owns the decision of when a contract is needed.
- **Trigger boundary.** Reach for this when a contract must be created, repeated, or appended to. For executing an already-frozen contract, that is [/jxx-goal-execute](https://aihero.dev/skills-goal-execute) — this skill ends where the loop begins.

## Prerequisites

The skill writes into the workspace: `.goals/{name}/GOAL.md`, plus an initialized `PROGRESS.md` and the `_index.md` goal index. Those files are the state every later step reads — the workspace must persist them for the life of the goal.

## Three modes, one gate

The leading word is **veto gate** — but the path to the gate forks by task shape. Low-risk familiar tasks get the default push: the agent drafts a complete recommended contract (no placeholders, vague words like "polished" translated into checkable conditions) and asks only numbered questions whose answers change cost, risk, or direction. Unfamiliar domains go discovery-first: research rounds are budgeted into the contract itself, and the domain's high-risk scenarios are written into Pause Conditions. High-stakes tasks — accounts, payments, production, legal — get the full grilling: one dimension at a time, each question with a recommended answer, until every field clears its depth floor.

Whichever path, the gate is identical. Low-risk does not mean low bar — it means the questioning is compressed, not the standard.

## It's working if

- The recommended contract arrives complete — no `[Outcome]` placeholders, no "TBD" — with defaults stated and numbered options attached.
- Every acceptance criterion is bound to an executable verification command (`（验证：\`<命令>\`）`).
- Vague words ("professional", "full coverage") appear in the contract as verification conditions, not as acceptance criteria.
- A separate checker pass ran on the draft, and its per-gate verdicts were recorded (including V10).
- The written `GOAL.md` names both a max turn count and a time cap, and states Pause Conditions explicitly — even if "none".

## Where it fits

- **Role.** A chain step: [goal-mode](https://aihero.dev/skills-goal-mode) routes here to freeze the contract, then hands off to [goal-execute](https://aihero.dev/skills-goal-execute) to run the loop. The contract is the hinge between the two.
- **Neighbours.** If the goal should become a spec document before a contract, run [/to-spec](https://aihero.dev/skills-to-spec) first.
- **The map.** See [ask-matt](https://aihero.dev/skills-ask-matt) for the router over the whole skill set.
