---
name: huawei-cloud-codebuddy-jxx-html-craft
description: |-
  1. Mandatory quality and aesthetics floor for generating any HTML file — basic quality (semantics, responsiveness, accessibility, self-containment) plus beautiful appearance (typography, color, spacing, motion).
  2. Triggered by: 生成 HTML / 写网页 / HTML 报告 / 美化页面 / generate HTML / write a web page / beautify a page; auto-applies whenever a deliverable includes a .html file.
  3. Value: every HTML artifact ships self-contained, accessible, responsive, and visually polished in one pass — no broken layout, no default-gray ugliness.
  4. Usage: detect HTML deliverable → load references/craft.md (quality floor) and references/beauty.md (visual system) → generate → run the 8-point self-check list → fix and deliver.
  5. Requires: nothing — pure instructions; optionally Node for the inline validation checklist script.
tags:
  - jxx-html-craft
  - codebuddy
  - html-craft
---

# jxx-html-craft

The quality and aesthetics floor for any HTML deliverable. Load when a task produces a `.html` file — reports, docs, dashboards, prototypes, tool pages, email templates, landing pages.

## When

Auto-trigger: any deliverable containing an `.html` file. Two tiers:

- **Light deliverable** (report page, doc page, export page, single-file tool): follow this skill's floor directly, no ceremony.
- **Heavy design work** (product UI, landing page for a real product, multi-page visual world): use this skill as the floor, then escalate to `impeccable` for direction, modes, and verification passes.

## How

1. Pick the tier, then load `references/craft.md` (quality floor: semantics, responsive, a11y, self-containment) and `references/beauty.md` (visual system: type, color, spacing, motion).
2. Generate the HTML honoring both checklists. Self-contained first: no network dependency to render correctly; inline or embed fonts/CSS/JS/data, or degrade gracefully offline.
3. Before handing off, run the 8-point self-check in `references/craft.md` (title/charset/viewport, semantic landmarks, contrast, focus, breakpoint behavior, no horizontal scroll, no console errors, honest data labels).
4. Fix everything the check shows in one pass. Do not iterate open-endedly — one fix round, one confirm round, stop.

## Rules

- One authored visual world per file: deliberate palette, type scale, spacing rhythm — never browser defaults.
- Semantic HTML landmarks (`header/nav/main/section/footer`), real headings hierarchy, alt text on every image.
- Responsive by default: mobile ≤480px, tablet, desktop all compose correctly; no horizontal scroll.
- Accessibility floor: body text contrast ≥4.5:1, visible keyboard focus, labels on all controls.
- Honest data: label illustrative values; never invent numbers presented as fact.