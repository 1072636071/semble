---
name: jxx-web-resource-ops
description: 维护各网页版 AI 资源的剩余量台账，按额度调用已登记能力，并在观测矛盾时自我修正记录。当用户问剩余量/额度/积分、要用网页版能力、或要求修正台账时触发；触发词：网页版资源台账、剩余量、积分、能力注册表、自我修正。不包含浏览器操作本身（交给 jxx-browser-roundtrip）、不编造额度数字、不改动宿主或站点配置。
x-install: true
metadata:
  version: 0.1.0
x-vendors:
  codearts:
    product: codebuddy
    tags: [jxx-web-resource-ops, codebuddy]
    description-en: |-
      1. Maintain a remaining-quota ledger for logged-in AI web resources.
      2. Triggered by: quota, remaining credits, capability registry, self-correction.
      3. Keeps quota facts out of the skill body and in an append-only runtime ledger.
      4. Usage: read ledger -> check quota -> dispatch a registered capability -> append observation -> correct on conflict.
      5. Requires jxx-browser-roundtrip for browser operations and ego-browser for the runtime.
  codebuddy:
    allowed-tools: [read_file, write_file, run_command]
  opencode:
    license: MIT
  trae: {}
---

<!--en-->
# jxx-web-resource-ops

Maintain the quota ledger, dispatch registered web capabilities, and correct
recorded facts when observations conflict. Browser operations live in
`jxx-browser-roundtrip`; this skill holds only pointers to them.

## Input
A site id, an optional capability name, and an optional observation (quota text
seen on the page).

## Ledger
The ledger is a runtime JSON file at `${DSH_HOME:-~/.dsh}/web-resources/ledger.json`.
It is append-only: every observation adds one entry; never edit or delete an old
entry. Never write a quota number that was not observed. When a page gives no
number, record `remaining: null` and `confidence: "unknown"` plus a reason.
Fields and examples: `references/ledger-schema.md`.

## Workflow
1. Read the ledger before any capability call. If the remaining quota for that
   site and capability is 0 or unknown, report it and stop; do not spend quota.
2. Dispatch only capabilities listed in `references/capabilities.md`. Unlisted
   capabilities must be verified in the browser and registered first; do not
   claim coverage of every capability a site offers.
3. After the call, append one observation with the page wording, source URL or
   session id, and timestamp. Do not infer quota from a success or failure alone.
4. On a conflict between an old entry and a new observation, append a corrected
   entry with `supersedes` pointing at the old entry's `at` and a `reason`.
   Correct only recorded facts. Never change site code, host configuration,
   user sessions, or another skill's files.
5. Stop on the confirmed boundary: if a page says content is ready but exposes
   no direct link or download control, report it and hand the session to the
   user. See `jxx-browser-roundtrip`; that ruling wins over any retry rule here.

## Output format
A short Chinese report: site, capability, quota before the call, what was
dispatched, the new observation, and any correction. State `unknown` explicitly
when no number was observed.

## Boundaries and failures
- No invented numbers, no placeholder values, no copied browser recipes. Quota numbers come only from current page wording with a timestamp and source; a model's self-reported number is not a quota reading.
- Classify failures before retrying: `403`-style quota exhaustion stops and hands off; `503`-style site-wide queue allows at most one backoff; a changed selector raises `ERR_SELECTOR_CHANGED` with the current snapshot instead of guessing.
- `ERR_LEDGER_UNREADABLE`: ledger file cannot be read; report and stop, do not
  recreate it with guessed values.
- `ERR_QUOTA_EXHAUSTED`: remaining is 0; stop before dispatch.
- `ERR_CAPABILITY_UNREGISTERED`: capability is not in the registry; verify and
  register before use.
- Do not retry a capability more than once per call. Do not poll a page that has
  already been ruled unreachable.
<!--/en-->

# jxx-web-resource-ops

维护网页版 AI 资源的剩余量台账，按额度调用已登记能力，并在观测矛盾时修正**记录**。浏览器怎么操作、脚本怎么写，真源是 [jxx-browser-roundtrip](../../../productivity/jxx-browser-roundtrip/SKILL.src.md)（下称「往返技能」）；本技能只放指向它的指针，不复制任何脚本或站点细节。

## 输入

- 站点 id（必填）：`yuanbao` / `doubao` / `qianwen` / `deepseek-web`，或台账中已登记的站点。
- 能力名（可选）：`image` / `video` / `web-search` / `chat`。
- 观测值（可选）：页面上读到的额度原话。

## 台账

- 真源 = `${DSH_HOME:-~/.dsh}/web-resources/ledger.json`，由执行本技能的 agent 创建，权限 0600，**不进技能仓、不进 git**。
- **只追加**：每次观测新增一条，不回改、不删除旧条目。
- **不编造数字**：页面没给数字就写 `remaining: null` + `confidence: "unknown"` + `reason`；不从「成功/失败」反推额度。
- 字段与样例见 [references/ledger-schema.md](references/ledger-schema.md)。

## 流程

1. **调用前读台账**：由 agent 读 ledger.json。目标站点+能力的剩余量为 `0` 或 `unknown` 时，回报并**停止**，不消耗额度。判据：回帖里给出读到的条目 `at` 与 `remaining`。
2. **只调用已登记能力**：能力清单在 [references/capabilities.md](references/capabilities.md)。未登记的能力先在浏览器实证、登记后再用；**不声称覆盖站点全部能力**——站点能力会变，清单只是已实证的投影。判据：回帖写明所用能力在清单哪一行。
3. **执行**：按往返技能的流程跑浏览器脚本。本技能不重写脚本，不另起一套选择器规则。
4. **调用后追加观测**：新增一条台账，记页面原话、来源 URL 或会话 id、带时区时间戳。判据：回帖给出新条目的 `at`。
5. **自我修正**（仅限记录）：旧条目与新观测矛盾时，追加一条修正条目，`supersedes` 指向旧条目的 `at`，并写 `reason`。**只修正台账与能力清单里的事实记录**；不改站点代码、不改宿主配置、不改用户会话、不改其它技能文件。判据：回帖给出新旧两条 `at` 与 reason。
6. **服从已裁定边界**：页面说「已生成」但拿不到直链/下载控件时，回报「需用户自行下载」并停止，不轮询、不换选择器、不深挖播放器。以往返技能的这条裁定为准，本技能的任何重试规则都不能覆盖它。

## 输出格式

中文短报，四项：站点 / 能力 / 调用前剩余量 / 本次观测；有修正时另加「修正了哪条、为什么」。没有观测到数字就明写 `unknown`，不填空。

## 边界与失败

- 不写死额度数字；不写占位值；不复制往返技能的脚本正文。额度数字只认现场页面原话，带时点与来源；模型自述的数字不当额度（参考 `jxx-agnes-video` 的 `403 insufficient_user_quota` 定性口径）。
- **失败按性质分流，不盲目重试**：`403` 类配额不足 → 停止并转人工；`503` 类全站排队 → 最多一轮退避即停；选择器失效 → `ERR_SELECTOR_CHANGED` 附当前 snapshot，不猜新选择器。一次调试结论不进本技能正文。
- `ERR_LEDGER_UNREADABLE`：台账读不到 → 回报并停，不用猜的值重建。
- `ERR_QUOTA_EXHAUSTED`：剩余量为 0 → 调用前停止。
- `ERR_CAPABILITY_UNREGISTERED`：能力未登记 → 先实证登记再用。
- 每次调用最多重试 1 次；已裁定「取不到」的页面不再轮询。
- 冲突时以「往返技能 > 本技能」为准：浏览器操作契约归前者，额度与记录归本技能。
