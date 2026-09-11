---
phase: 7
status: complete
completed: 2026-09-08
---

# Phase 7: The commit rail and the risk gates - Summary

Execution cannot continue or report complete while risk evidence for the exact
committed or staged material is missing, unchecked, stale, unfired or unsettled.
The Bash guard is the shipped native binary rather than a JavaScript shim, source
leases are enforced with no exemptions, and detect-surfaces supplies structural
evidence from names, extensions and manifest dependencies without reading a
single source body.

## What shipped

- The commit rail: process serialization over the store, typed policy-independent
  audits, Bash push bound to durable asks, shared protected-branch permission,
  bounded quote-aware Git detection, and loud unavailable-input failures that
  preserve an established denial.
- Source leases with zero exemptions - explicit directory leases, deterministic
  ordering for overlapping ones, writer enforcement in the patch path, Git-backed
  refusal records, and a defined corrected-resubmission recovery.
- The risk rail: shared classifier primitives, public risk observations, immutable
  changed-material classification, `HEAD..HEAD` as a distinct no-range answer
  rather than a clean check, and assessment over accepted execution material.
- Settlement: exact material identity for committed (base/head) and staged
  (base/index, head absent) ranges, receipt consequences persisted through the
  existing three tools, and continuation gated on current settled evidence. A
  matched scan alone does not pass.
- detect-surfaces - structural evidence, warnings, the all-eight recommendation
  and at most four deduplicated interview choices, with no source body read.

## What this phase does not claim

The live probe that asserted over a real host's transcript was deleted in
`3be6d03b`. Guard behaviour is claimed through
`cargo test -p cadence --test phase7_guard`, which feeds the binary the exact
input a hook sends and asserts the returned decision. Nothing in this repository
proves that a host loads a skill, that a model obeys a refusal, or that an
executor's returned text takes a given shape. A person observes that.

## Deviations

- `P7-4-T6` was deleted rather than completed. Its only deliverable was the live
  proof, and no verify remained for it once the probe was removed.
- Two lease amendments were made during execution: `recall/mod.rs` for a
  clippy lint the plan's own change triggered, and the two fixtures
  (`phase7_risk.rs`, `phase7_lease.rs`) whose completion evidence contradicted
  PLAN-4's new gate.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | `111f1e32` | feat(store): serialize cooperating processes |
| 1 | 2 | `d4a2cd0a` | feat(guard): persist typed policy-independent audits |
| 1 | 3 | `272ef789` | feat(guard): connect Bash push to durable asks |
| 1 | 4 | `a502ec16` | feat(rail): share protected branch permission |
| 1 | 5 | `942563bb` | feat(guard): pin bounded quote-aware Git detection |
| 1 | 6 | `06faf708` | feat(guard): make unavailable inputs loud and preserve denials |
| 1 | 1 | `2701801e` | fix(store): retain failure and cached-read contracts |
| 1 | 7 | `41f16a9c` | test(guard): prove native rails against a real host |
| 2 | 1 | `03bf2649` | feat(execution): admit explicit directory leases |
| 2 | 2 | `128921fa` | fix(execution): order overlapping directory leases |
| 2 | 3 | `dfdf339d` | feat(7): enforce patch writer leases |
| 2 | 4 | `d7ffda84` | feat(7): record Git-backed lease refusals |
| 2 | 5 | `3af58d1a` | feat(7): define corrected resubmission recovery |
| 2 | 6 | `056afb81` | docs(7): publish exact source lease contract |
| 3 | 1 | `c57201d3` | refactor(7): share risk classifier primitives |
| 3 | 2 | `f5b2d321` | feat(7): record public risk observations |
| 3 | 3 | `80ca6193` | feat(7): classify immutable changed material |
| 3 | 4 | `d0f37f38` | fix(7): distinguish no commit range |
| 3 | 5 | `9cf989cf` | feat(7): assess accepted execution material |
| 4 | 1 | `7252a686` | feat(rail): define exact material settlement |
| 4 | 2 | `d6861cdd` | feat(rail): persist settlement consequences |
| 4 | 3 | `3fce4a93` | feat(rail): detect structural surface evidence |
| 4 | 4 | `ec0d9fd2` | feat(rail): expose structural surface choices |
| 4 | 5 | `d34fb2eb` | feat(execution): require settlement before continuation |
