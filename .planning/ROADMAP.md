# Roadmap

## Overview

**`v3.3.0 - the record you plan from`, opened 2026-08-14.** Scoped from a triage
of the capture queue rather than from a scan: 309 file-wide bullets read down to
119 live todos, 15 of them retired against the shipped v3.2.0 code and the
survivors grouped by fix site into eight clusters. Three clusters are here. The
other five are named in `.planning/CAPTURE.md` and deliberately not scheduled.

**The theme is one sentence: the evidence Cadence plans and reports from is
itself unchecked.** The queue that feeds `/cad-plan`'s recall silently dropped
five filed items - including one `[high]` - because they were appended below a
heading the recall walk does not visit, and nothing in the product could see
that. The trace that `/cad-report` and `/cad-suggest` reason over cannot join a
provider call to the fire that made it, counts a role's tokens against a role
that never dispatched, and carries a tuning rule that has emitted zero rows in
its life because it sums survivors over a lifetime instead of a fire. Both
surfaces answer confidently. Neither answer is load-bearing.

**Phase 1 goes first because it protects the input to everything after it.**
While this cycle was being scoped, a concurrent write to `.planning/CAPTURE.md`
was caught only by a stale-line-number guard in a throwaway script; the file has
no locking and it is `/cad-plan`'s recall corpus. Fixing the queue before
planning against it is the whole ordering argument.

**Phase 2 is the cycle's real weight, and it changes the instrument mid-flight.**
Land it here and phase 3 is measured by the corrected seam while phase 1 is not,
so the two are not directly comparable - that asymmetry is accepted deliberately
rather than discovered later.

**Phases 3 and 4 come from the 2026-08-14 repo scan** (three verified-in-session
scan agents, adjudicated to eight clusters; the record is
`design-notes/sweep-2026-08-14-repo-scan.md`). Phase 3 closes the two live
correctness gaps the scan confirmed in-tree plus the duplication behind them;
phase 4 converts its enforcement and round-trip findings into seams. They land
before the docs phase so its sweep reconciles their prose too.

**Phase 5 is the cheapest closure in the queue.** Fourteen stale claims across
README, the references and `DOCS-CLAIMS.md`, retired by one `/cad-docs-verify`
sweep plus the edits it names. It runs last so it also reconciles the prose
phases 1 through 4 move.

**Phases 1, 2 and 5 add no new surface** - they correct what already ships.
Phases 3 and 4 add named seams deliberately, each justified by a measured
failure in the scan record. `LND-01` stays `## Deferred` with issue #121 open.

## Phases


## Phase Details
