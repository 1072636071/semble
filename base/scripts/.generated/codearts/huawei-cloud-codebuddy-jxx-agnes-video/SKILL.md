---
name: huawei-cloud-codebuddy-jxx-agnes-video
description: |-
  1. Agnes Video 2.5 Flash client skill covering text-to-video, keyframe control and image/audio reference modes.
  2. Triggered by: generate video, text to video, image to video, keyframe animation, agnes video.
  3. Value: async task creation plus automatic polling and download, with Flash-only validation built in.
  4. Usage: set AGNES_API_KEY, then `node scripts/agnes-video.mjs run text|keyframe|reference --prompt ...`.
  5. Prerequisite: Node.js >= 18, an Agnes AI API key, and publicly reachable media URLs.
tags:
  - jxx-agnes-video
  - codebuddy
  - video-generation
---

# Agnes Video 2.5 Flash

Client skill for the Agnes Video 2.5 Flash API. One zero-dependency Node script covers every documented
capability: text-to-video, first/last frame control, image and audio reference generation, the 720P size
rule, the reference limits, async task polling and mp4 download.

## When to use

Use when the user wants to generate video with the Agnes video model, or mentions agnes-video-2.5-flash.
The script validates Flash-specific rules locally before spending an API round trip, then polls the async
task until it completes or fails.

## Quick start

```bash
export AGNES_API_KEY="sk-..."   # or pass --key <key>
node scripts/agnes-video.mjs ratios                          # aspect_ratio -> pixels
node scripts/agnes-video.mjs run text --prompt "..." --seconds 5
node scripts/agnes-video.mjs run keyframe --prompt "..." --first-frame a.png
node scripts/agnes-video.mjs run reference --prompt "..." --image ref.png
```

## Availability (checked 2026-10-21)

The request shape is correct, but the server has no capacity. All four modes fail at task creation with HTTP 503
`video_queue_full`, even after the built-in five retries; `agnes-video-2.5` returns 403 `insufficient_user_quota`.
This is service-wide: upstream issue AgnesAI-Models#142 has been open since 2026-10-10, and the team confirmed reduced
queue capacity. A different API key does not help.
Treat video generation as currently unavailable, validate locally with `--dry-run`, and do not loop on retries —
ship images instead (`jxx-agnes-image`) or use another video model.

Keep in sync with the Chinese body below.