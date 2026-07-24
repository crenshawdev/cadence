# Roadmap

## Overview

`v1.2.0` is shipped and tagged: the cross-model review seam repair (REV-01), a
planner separation-of-concerns nudge (SOC-01), durable-decision recall and the
on-demand `/cad-decision-review` (DEC-01, DEC-02), and a DeepSeek cross-model
review provider (REV-02). Git history and the `v1.2.0` tag are its archive, as
`v1.1.0` and `v1.0.0` are for their cycles.

**v1.2.2 — Tech debt** is the active cycle (opened 2026-07-24): collect every
open bug issue, triage each, and either fix it or record a deliberate won't-fix.
No new features. Triage is complete — all 13 filed bugs accepted, mapped to the
four phases below; `/cad-plan` breaks each phase into tasks.

## Phases

Triage complete (2026-07-24): all 13 filed `[bug]` issues from the post-v1.2.0
sweep accepted for v1.2.2, grouped into four fix-passes by shared root cause. No
won't-fix. Per-task plans come at `/cad-plan`.

- [x] **Phase 1: Silent data-file failures** - (#39, #40, #43, #44). Goal: an
  absent or malformed shipped data/config file is surfaced, never silently
  swallowed into defaults; the "never blocks the spine" seam contract
  (`{ok:false}`, not a raw crash) holds. #39 is the sweep's top finding.
- [ ] **Phase 2: Seam input validation** - (#42, #45). Goal: a shared seam-flag
  validator rejects bad input types (NaN `--total`, valueless `--reqs`, bad
  `--attempt`, scalar config) with a clean `bad-args`/`usage` result before any
  write, so no bad flag can corrupt STATE.md or pass config validation.
- [ ] **Phase 3: planning-files parser robustness** - (#41, #46, #47, #48). Goal:
  the shared parsers stop minting phantom requirement rows (no false
  `/cad-audit` FAIL), stop silently truncating multi-word recall queries, index
  completed captures cleanly, and read block-YAML lists and name-less phase
  headings.
- [ ] **Phase 4: renumber & git-guard hardening** - (#37, #49, #50). Goal:
  renumber applies the decimal-cursor carve-out (warns instead of desyncing the
  cursor) and reports/rolls back a partial apply; one dangling symlink can't
  sink a self-verify/weigh run; git-guard joins backslash line-continuations so
  the push rail sees a wrapped `git push` as a push.
