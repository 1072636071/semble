---
name: huawei-cloud-codebuddy-craft-router
description: |-
  1. Routes tasks to the right ArtCraft/storytold craft tool: vector, raster, spreadsheet, CAD, print, slides, audio, video, VFX, photo, RAW, PDF, Word.
  2. Triggered by: "which craft tool", "how do I use figcraft", craft tool names, ArtCraft, storytold.
  3. Every craft app ships a CLI with run/commands/export and an mcp subcommand, so agents can drive them headlessly.
  4. Usage: name the task → read the matching child skill under base/skills/storytold/ → follow its command recipe.
  5. Requires the craft binaries under D:\\storytoldExe\\<App>\\ (Windows; note the trailing space in each directory name).
tags:
  - craft-router
  - codebuddy
  - storytold
---

# Craft router

The storytold/ArtCraft suite is a set of clean-room Rust reimplementations of Adobe/Office tools.
Every app ships a CLI (`<app>-cli.exe`) with a `run` / `exec` subcommand (command scripts),
`commands` (registry listing), `describe` (one command's parameters) and an `mcp` subcommand
(stdio MCP server, headless by default). Pick the app by the artifact the user wants, then read
the child skill in this repository (`base/skills/storytold/`) for the exact recipe.