---
name: huawei-cloud-codebuddy-jxx-tool-intro
description: |-
  1. Record and introduce a dev tool (GitHub repo) as a Chinese tool profile with install and usage, rendered as beautiful HTML.
  2. Triggered by: 记录工具 / 介绍工具 / 把工具加进工具目录 / 给某仓库写工具介绍 / record a tool / introduce a tool.
  3. Produces a summary index.html plus one detail page per tool, kept in docs/guide/ — no manual HTML writing needed.
  4. Usage: fetch repo info (WebFetch + GitHub API) → write docs/guide/<slug>/tool.json → run scripts/gen-tool-page.mjs → verify HTML.
  5. Requires: node; the data + output root is `<project root>/docs/guide`, resolved from the current working directory upward (.git / docs), overridable via --root / --src / --out.
tags:
  - jxx-tool-intro
  - codebuddy
  - tool-intro
---

# jxx-tool-intro

Record and introduce a developer tool (typically a GitHub repository) as a structured Chinese tool profile that always includes **installation** and **usage**, and render it as beautiful, self-contained HTML.

Workflow:
1. Gather info — from the GitHub URL the user gives, fetch the repo page and `https://api.github.com/repos/<owner>/<repo>` for stars / forks / license / language / description / homepage.
2. Distill content — summary, core features, integrations, install steps, usage steps, notes; assign a `rating` (1–5, 5 = strongly recommended).
3. Write data — create `docs/guide/<slug>/tool.json` (see references/schema.md for the field list). This is the single source of truth.
4. Render — from the **target project root**, run `node <本技能目录>/scripts/gen-tool-page.mjs`. It reads `docs/guide/*/tool.json` and generates `docs/guide/index.html` (summary) and `docs/guide/<slug>/index.html` (detail). The root is resolved from cwd upward (`.git` / `docs`); override with `--root` / `--src` / `--out`.
5. Verify — open the generated HTML and confirm it renders correctly.

Keep the `tool.json` as the single source of truth; re-running the script regenerates all pages under `docs/guide/`.