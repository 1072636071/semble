---
name: huawei-cloud-codebuddy-jxx-agnes-image
description: |-
  1. Agnes Image 2.5 Flash client skill for text-to-image, image-to-image and multi-image composition.
  2. Triggered by: generate image, draw, edit image, img2img, multi-image compose, agnes image.
  3. Value: one command per workflow, with size tiers, aspect ratios, URL/Base64 output and retry built in.
  4. Usage: set AGNES_API_KEY, then `node scripts/agnes-image.mjs text|img2img|compose --prompt ...`.
  5. Prerequisite: Node.js >= 18 and an Agnes AI API key (free tier works).
tags:
  - jxx-agnes-image
  - codebuddy
  - image-generation
---

# Agnes Image 2.5 Flash

Client skill for the Agnes Image 2.5 Flash API. One zero-dependency Node script covers every documented
capability: text-to-image, image-to-image, multi-image composition, size tiers with aspect ratios, URL or
Base64 output, and automatic Data URI conversion for local files.

## When to use

Use when the user wants to generate, edit, restyle or compose images with the Agnes image model, or mentions
agnes-image-2.5-flash. The script enforces the documented request shape and returns a JSON result with the
output path, byte size and sha256.

## Quick start

```bash
export AGNES_API_KEY="sk-..."   # or pass --key <key>
node scripts/agnes-image.mjs sizes                    # size tier x ratio pixel table
node scripts/agnes-image.mjs text --prompt "..." --size 2K --ratio 16:9
node scripts/agnes-image.mjs img2img --prompt "..." --image input.png
node scripts/agnes-image.mjs compose --prompt "..." --image a.png --image b.png
```

Reference images are supported; failures are usually HTTP 503 `image queue is full` (server-side congestion), not a
restriction on reference images. Back off and retry, or generate a text-only variant meanwhile.

Keep in sync with the Chinese body below.