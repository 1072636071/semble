Quickstart:

```bash
npx skills add mattpocock/skills --skill=design-system
```

```bash
npx skills update design-system
```

[Source](https://github.com/mattpocock/skills/tree/main/skills/engineering/design-system)

## What it does

Design system establishes a project-wide visual identity as design tokens, then enforces it across every later UI generation. Based on Google's DESIGN.md format, it writes a `DESIGN.md` at the project root — YAML frontmatter holds the precise values (colors, typography, rounding, spacing, components), the Markdown body holds the rationale. It ships ten mainstream style presets (Material 3, Apple HIG, Fluent, Linear, Minimalist Modern, Cyberpunk, Skeuomorphism, Glassmorphism, Neo-Brutalism, Shadcn/Tailwind) as starting points.

The defining constraint is that `DESIGN.md` is the single source of truth. Before generating any UI code, the agent reads it; every color, font, and radius is a token reference, never a hardcoded value. Change the palette once in `DESIGN.md` and the whole site moves together — that is what makes the style hold across many generations, where one-off choices would drift.

## When to reach for it

- **Invocation mode.** Type `/jxx-design-system`, or the agent reaches for it automatically when a frontend/UI project begins, when the user mentions design tokens / theme / 配色 / UI 风格一致性 / DESIGN.md, or when components visibly drift from a consistent look.
- **Trigger boundary.** Reach for this when the visual identity needs to be set or recalibrated. For the actual UI code generation, use [prototype](https://aihero.dev/skills-prototype) or [implement](https://aihero.dev/skills-implement) *within* the token boundary this skill establishes.

## Prerequisites

Design system writes a `DESIGN.md` at the project root and consults it on every later generation — that file is the stop condition for style consistency, so it must persist for the life of the UI work. Optional: the `@google/design.md` CLI (`npx @google/design.md lint/export`) for validation and framework export (Tailwind v3/v4, CSS vars, DTCG). No issue tracker or other prior setup is required.

## Tokens are the unit

The leading word is **tokens**. Colors, typography, rounding, and spacing are named values — `colors.primary`, `rounded.md`, `spacing.lg` — and components reference them by `{path.to.token}` rather than repeating the literal. A button's background is `{colors.primary}`, not `#0052FF`. This indirection is the whole mechanism: the token is the contract, the value is negotiable, and changing the value in one place propagates everywhere the token is used.

Each preset is a complete DESIGN.md in this format, so picking a starting point is picking a full token set plus its rationale — then customize the values to the project's palette.

## It's working if

- A `DESIGN.md` exists at the project root before any UI code is generated.
- Generated components reference tokens (`{colors.primary}`, the exported CSS variable, or the Tailwind class) — not bare hex values.
- A palette change lands in `DESIGN.md` alone, and `grep` finds no stray hardcoded colors in the components.
- `npx @google/design.md lint DESIGN.md` passes with no errors (broken refs, failed contrast).

## Where it fits

- **Role.** A reach-for-it-anytime standalone that runs *before* UI generation and is consulted *during* it — the token layer that prototype and implement build on top of.
- **Neighbours.** [prototype](https://aihero.dev/skills-prototype) answers a UI design question with throwaway code — it reads `DESIGN.md` so even throwaway code holds the style. [implement](https://aihero.dev/skills-implement) builds real UI from a spec — it reads `DESIGN.md` so the spec's visuals stay consistent. When the palette decision itself needs sharpening, [grill-me](https://aihero.dev/skills-grill-me) grills one question at a time.
- **The map.** See [ask-matt](https://aihero.dev/skills-ask-matt) for the router over the whole skill set.
