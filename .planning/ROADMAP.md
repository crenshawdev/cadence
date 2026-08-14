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

- [x] **Phase 1: The capture queue stops dropping filed work** - `/cad-capture` writes where the recall walk can see it, and the tag grammar admits every shape the writer emits
- [ ] **Phase 2: The run record joins** - correlation and role accounting produce figures `/cad-report` and `/cad-suggest` can be trusted with
- [ ] **Phase 3: The scan's correctness gaps close** - the config key the guard honors and land ignores, the fence-blind section scanners, and the copied helpers that already drifted
- [ ] **Phase 4: Suggestions become seams** - the prose ceilings get counts, the restated bracket close gets one subcommand, and the oversized render gets a bound
- [ ] **Phase 5: What Cadence claims about itself is true** - one docs-verify sweep over the claims v3.0-v3.2 left behind, plus the edits it names

## Phase Details

### Phase 1: The capture queue stops dropping filed work

`CAP-01`. Five bullets filed after the 2026-08-08 archive block sat below
`## Archive`, outside the recall walk (`planning-files.mjs:684` visits Todos,
Seeds and Notes only), and were therefore invisible to `/cad-plan` - one of them
a `[high]` finding about a tuning rule that can never fire. They were lifted back
by hand on 2026-08-14. Nothing in the product would have reported them, and
nothing stops it recurring.

Success criteria:
1. A bullet written by `/cad-capture` lands inside the recall walk and is
   returned by `planning.mjs recall` in the same session, proved by a
   failing-capable test rather than by inspection.
2. The phase-tag reader (`planning-files.mjs:627`) admits every shape the queue
   actually contains - the requalified `(vX.Y.Z phase N)` form and the
   `(phase N, <label>)` form it currently drops - or the writer is narrowed so it
   can only emit shapes the reader admits. One grammar, stated once.
3. A capture bullet outside the recall walk's three sections is reported:
   `/cad-health` names it, with its count and its section.
4. A concurrent write cannot silently lose an append. Two writers racing on
   `.planning/CAPTURE.md` either both land or the loser is told - filed
   2026-08-14 after a live lost-update near-miss during this cycle's scoping.

### Phase 2: The run record joins

`TRC-01`. Eleven queue items land on `lib/trace.mjs` and `lib/trace-suggest.mjs`.
The joined run record is what `/cad-report` prices a phase from and what
`/cad-suggest` derives retune advice from, and run cost is this project's
standing second priority - so a figure that conflates two fires, or credits a
role that never dispatched, is not a reporting blemish but a wrong input to every
tuning decision made from it.

Success criteria:
1. `corr` joins a provider call to the fire that made it. An event written before
   the phase anchor, and a second fire inside one phase, both resolve to their
   fire rather than falling back to the bare phase form.
2. A terminal event's `--role` is validated against its paired dispatch's role. A
   mismatch is reported and never renders as a role with zero dispatches carrying
   a token total.
3. `recorded` counts matched dispatches rather than token-bearing events, so a
   duplicated or replayed terminal cannot satisfy two dispatches' accounting and
   hide an `unrecorded` one.
4. `trace suggest`'s R1 rule can fire on the live corpus: the survivor test is
   per-fire or windowed rather than a lifetime sum, and is demonstrated against
   `.planning/trace.jsonl`, not only against a fixture.
5. A re-arm round is visible to `trace suggest` in both its survivor and raised
   halves - the `risk_surface rearm:` trigger token parses.
6. `topFiles` / `fileRedundancy` / `fileCalls` either reach a reader or are
   deleted; the seam does not keep emitting figures nothing consumes.

### Phase 3: The scan's correctness gaps close

`COR-01`. From the 2026-08-14 repo scan (design-notes/sweep-2026-08-14-repo-scan.md,
clusters 4-5; every finding re-verified at its cited line before entering this
phase). Two are live correctness gaps, the rest is the duplication that bred
them.

Success criteria:
1. `protected_branches` in string form is honored identically by all four
   readers through one shared helper, with a string-form test per consumer -
   today `git-branch.mjs:56` and `land-cleanup.mjs:103` silently drop what
   `git-guard.mjs:142` and `git-publish.mjs:94` accept.
2. `classifyPhaseList` and `classifyActiveSection` ignore a fenced `## Phases`
   / `## Active` (the shape `templates/ROADMAP.md:9-39` itself ships), proved
   by a regression test per scanner that reddens on the pre-fix code.
3. `detect-commands` and `detect-surfaces` refuse `--root ""` exactly as
   `debt-harvest` does.
4. `flag`/`flagValue`/`readText` and the `rev-parse --abbrev-ref` reader each
   exist once, in a shared lib home, pinned by an occurrence-census test so a
   re-copy reddens (the `redactUrl`-census pattern).

### Phase 4: Suggestions become seams

`ENF-01`. From the same scan, clusters 1-3, plus the two queue items this phase
absorbs (the instrumentation remainder and the executor-surfaces gap). The
theme is the project's own measured lesson: a prose rule a model is asked to
follow fails silently; a count enforced by a seam does not.

Success criteria:
1. The criteria ceilings prose states (`context.md` 3-7, `new-project.md` /
   `adopt.md` 2-5) are counted by a seam and an out-of-range phase is reported,
   mirroring `plan-size`.
2. One `trace close` subcommand infers return-vs-checkpoint from the return
   shape, and the six files restating that close prose call it instead.
3. `trace render`'s default response carries no unbounded `events` array - a
   bounded form measured on the live corpus, with the full array behind an
   explicit flag.
4. The measured unbatched round-trips are batched: `plan.md`'s seed-reqs +
   cursor set in one message, `context.md`'s config keys in one read - the
   happy-path seam-call count per workflow drops and the new count is stated.
5. The shipped read instrumentation (`bin/read-trace.mjs`, hooks/hooks.json:21)
   is proven to fire - or proven not to - inside subagent dispatches, and its
   records join to the fire that caused them; the gap, either way, is stated in
   the ledger.

### Phase 5: What Cadence claims about itself is true

`DOC-02`. Fourteen queue items are stale prose waiting on a sweep. They are
cheap, they are the largest single retirement available, and several of them are
claims the product makes about its own commands - the class this project treats
as a defect rather than a blemish.

Success criteria:
1. Every `.planning/DOCS-CLAIMS.md` row carries a verdict dated this cycle, and
   no row cites a line that has moved.
2. The three surfaces still stating the pre-`PRS-02` `REQ_ID_EXACT` head-anchored
   limit (`references/req-traceability.md:50` and `:150`,
   `templates/REQUIREMENTS.md:63`) state the narrower rule that is still true
   rather than being deleted.
3. `/cad-capture --cadence` is discoverable: registered in
   `references/COMMANDS.md`, `README.md`, and covered by a `DOCS-CLAIMS.md` row.
4. The skill count in `README.md` is derived or asserted by a test rather than
   typed - it has been stale twice.
5. `references/acceptance-criteria.md:248` names the `CADENCE_TEST_SEAM=1`
   sentinel now required beside `CADENCE_PLUGIN_MANIFEST`.
6. `PROJECT.md`'s `### Active` names the open cycle's version as its FIRST
   version token, asserted rather than trusted. `activeVersion()` first-token
   scans that section's free prose, and on 2026-08-14 it reported `v3.0.0` for a
   repo at `v3.2.0` because an unrelated sentence named it first - a wrong
   `version_drift` comparand computed from correct docs.
