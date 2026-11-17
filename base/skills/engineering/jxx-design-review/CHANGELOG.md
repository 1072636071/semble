# Changelog

## 1.3.1 — 2026-11-17

Review and edit are now strictly serial, enforced rather than documented.

- `init` physically freezes the target (Windows `attrib +R`, POSIX strips write bits). A plain write
  during a round fails with `EPERM`.
- `record`/`seal`/`verify` re-check the hash every time. A mismatch aborts with
  `ERR_TARGET_MUTATED_DURING_ROUND` (replacing the vague `ERR_STALE_REVIEW` for this case), sets the
  round to `incomplete`, and appends to `target_mutations[]` (detected_at / detected_by /
  expected_sha256 / observed_sha256) — append-only, so "edited mid-round" stays auditable.
- `fail` and `seal` unfreeze the target, so review and edit alternate instead of overlapping.
- Add `guard` command: read-only health check reporting `intact` or `TARGET MUTATED DURING ROUND`;
  `--strict` exits non-zero. It never mutates state.
- Orchestration discipline: run all stages → seal/fail → only then consolidate findings and edit in
  one pass → next round. Interleaving edits between stages is forbidden.

## 1.3.0 — 2026-11-17

Round budget: review rounds are now capped, because the marginal value of another full round
collapses once no Blocker is left. Driven by a real case that ran r016–r019 back to back on the
same target without converging (each round re-reported the same mechanisms under new IDs).

- Add `init` round budget: at most `--max-rounds` (default 3) sealed rounds per target. Once the
  budget is spent and the last sealed round left **no open Blocker**, `init` refuses with
  `ERR_ROUND_BUDGET_EXHAUSTED` — fix the residual Majors/Nits and seal them instead of opening
  another full round.
- An open Blocker in the last sealed round unlocks one more round, but only with an explicit
  `--approval "<user decision text>"`; severity is read from the sealed round's ledger
  (`finding_counts.blocker` / `findings_summary.open_blockers`), not from a hand-typed number.
- `seal` now persists `findings_summary.open_blockers` and `blocker_count` so the budget is
  auditable after the fact.

## 1.2.1 — 2026-11-17

Two C1 false-positive fixes found while gating a split PRD (main PRD as index, AC bodies in tickets).

- Stop treating a bare table row `| AC-N | phase | evidence |` as a second AC definition. It is a
  traceability projection; only checkbox and headed lines define an AC. This made every ticket
  that pairs definitions with an evidence table report "AC-N defined twice".
- Add `acHome` config. With `acHome: "tickets"` the target may reference `AC-N` unqualified and
  the gate resolves it to the single ticket that defines it; the same AC defined in two tickets
  is still red. This covers the split topology where the PRD carries an AC index instead of bodies.

## 1.2.0 — 2026-11-17

Findings became machine-readable and phase order became checkable, driven by the 157
local-memory-lifecycle review (11 attempted rounds, 6 sealed changes_required, three
mechanisms re-reported across 4–6 consecutive rounds, two duplicate-target rounds).

- Add a findings ledger: `seal --findings <ledger.json>` takes the machine-readable form of
  the consolidated report (`{findings:[{id,severity,mechanism,state,title,evidence,fix}]}`),
  refuses `--open-findings` that disagrees with it (`ERR_FINDINGS_MISMATCH`), records
  `finding_counts`, and derives `backlog_nits` from Nit findings instead of a hand-typed number.
- Add mechanism-stall blocking: with `--histories <rounds-dir>`, a mechanism still open in the
  immediately preceding ledger fails the seal with `ERR_MECHANISM_STALLED` unless the user
  accepts it via `--accept-mechanism <slug> --reason "<why>"`. This is what turns the v1.1.0
  mechanism-closure rule from advice into a gate.
- Add duplicate-round detection to `init`: a round that already sealed the same target SHA-256
  is refused with `ERR_DUPLICATE_ROUND` (`--force-duplicate-round "<reason>"` overrides and
  records `duplicate_of`). Reviewing identical bytes twice produced no new findings in practice.
- Add `status` command: one read-only pass over all round directories returning per-round
  status, open findings, stalls, duplicate target hashes, and whether the current target is
  already bound by a round (`resume` vs `new_round`). Replaces hand-written traversal scripts.
- Add gate checks C8 `deliverable-carried` and C9 `phase-order`, driven by
  `gate-config.json` → `boundary`: an AC whose evidence file no phase owns is red, and an AC
  gated at Pn whose evidence file is only created at a later phase is red. Phase gates are read
  from the target's own gate table unless `boundary.gates` overrides them; ACs marked
  `本地部分`/`服务器部分` at a phase are exempt from C9 at that phase. Both checks skip when
  no `boundary` config exists.

## 1.1.0 — 2026-11-17

Convergence and anti-rework upgrades, driven by the 039 blog-backend PRD post-mortem (11 rounds, 6 sealed changes_required, ~half the findings were rework on the same mechanisms).

- Add mechanism-closure rule: a FIX cluster must close the whole mechanism (formula, boundaries, channels, failure modes, bilingual symmetry, write order), never patch only the cited sentence.
- Add profile downgrade path: after a SOUND-architecture round, `readiness` requires explicit user approval via `init --downgrade-from --approval` (`ERR_DOWNGRADE_UNAPPROVED` otherwise).
- Add `scripts/pre-review-gate.mjs`: deterministic pre-init gate (AC cross-refs incl. qualified cross-space refs, ticket refs, file:line citation validity, version-marker sync, sidecar staleness, config-driven stale phrases, optional SQL probe). 11 fault-injection tests.
- Allow an adjudicated ledger (REJ precedents, decisions + rationale only) as explicitly approved reviewer context to prevent re-litigation.
- Convergence criterion: `open_findings` counts unresolved Blocker+Major only; Nits go to an implementation backlog via `seal --backlog-nits N` and do not trigger a new round. Severity discipline: wording/consistency findings are always Nit.
- Round lifecycle: init only after all revisions + cross-artifact sync complete and the gate passed; fail the round immediately on mid-round target edits.

## 1.0.0 — 2026-11-09

- Add five-stage fresh-context design review with pinned EGM reviewer resources.
- Add hash-bound review rounds, explicit profiles, fail-closed isolation, stage records, and publication verification.