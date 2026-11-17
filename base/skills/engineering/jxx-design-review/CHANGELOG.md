# Changelog

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
