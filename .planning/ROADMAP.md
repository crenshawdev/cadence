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

- [ ] **Phase 1: The tracker enters the spine** - `/cad-land` step 1 names the issues this branch's commits reference and the ones still open, or says in one line why it could not

## Phase Details

### Phase 1: The tracker enters the spine

`LND-01`, the milestone's only requirement, tracked as #121. Nothing in the
spine has ever read the issue tracker: Cadence audits its requirements, its
plans and its own run record, then lands work without asking whether that work
answered something the tracker has open. The check goes into `/cad-land` step 1,
which ALREADY detects the remote host from the origin URL and ALREADY resolves a
`tea` login to pick the PR mechanism (`skills/cad-land/SKILL.md:31-38`), so the
host and the CLI are in hand at exactly that point - this adds facts to a report
that already runs, not a command and not a dependency class.

This is the one item left in the queue that ADDS a mechanism, and it was cut
from the v3.2.0 cycle before execution for that reason. The added surface is
therefore bounded by criteria 3 through 6 rather than by intent: it degrades in
one line, it cannot stall a land, it never closes anything, and its key cannot
be confused with the one that already means "merge unattended".

Success criteria:
1. `/cad-land` step 1 reports every issue number the commits on this branch
   reference - `git log <base>..HEAD` scanned for `#N`, `closes #N`, `fixes #N` -
   each marked open or closed, so "your branch references #42 and #47; #42 is
   still open" is the line the user reads. Proved by a failing-capable test over
   a fabricated log, not by inspection.
2. Open issues on the detected host are listed when no commit on the branch
   references one. This is the fallback, not the headline - a bare list is easy
   to skim past and is not what earns the check its place.
3. Every degradation path produces ONE line naming the reason and never blocks
   the land, never retries, never fabricates a list: no remote, unrecognized
   host, CLI absent, no login, nonzero exit. Each path fault-injected with a
   test proving what the caller sees.
4. A hanging forge CLI cannot stall a land. The call is bounded by a hard
   timeout, proved against a stub that never exits - this is the first time
   `/cad-land` reads remote state that is not git.
5. `git.issue_check` (bool, default true) ships in the config catalog and the
   schema, and no new key or prose shares vocabulary with `git.auto_close`,
   which already means "merge the integration branch unattended" across
   `cad-land` step 4b, `land-cleanup.mjs` and `close-decision.mjs`. Landing
   never closes an issue, and closing one stays an explicit ask at publish time.
6. The GitLab arm resolves through the same CLI-resolution seam as `gh` and
   `tea` and is proven by a stubbed `glab` path, since `glab` is absent on this
   machine - the untestability that justified the original deferral is answered
   by the seam, not waited on. Registration lands with the code:
   `skills/cad-help`, `README.md`, `.planning/DOCS-CLAIMS.md` and the config
   catalog each carry the new key.
