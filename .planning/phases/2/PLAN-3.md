---
phase: 2
plan: 3
requirements:
  - HLT-01
files:
  - cadence-core/bin/git-guard.test.mjs
  - cadence-core/bin/route.test.mjs
  - cadence-core/bin/deferred-queue.test.mjs
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/references/triage-gate.md
  - cadence-core/bin/weight-budgets.json
  - METHOD.md
  - .planning/DOCS-CLAIMS.md
---

# Phase 2: Blocking that blocks the land - Plan 3 of 3 (the rails that must not move)

## Goal

The two rails this phase is forbidden to touch are pinned by tests rather than
by intention: the protected-branch guard stays byte-identical and reachable by
no gate value, and the one-round re-arm cap still binds on a deferred gate that
FAILs - adjudicated once, later, never looped.

## Must be true when done

- A census test shows `cadence-core/bin/git-guard.mjs` is reached by no gate
  value at all, and its existing cases still pass with a `deferred` gate pinned
  in the config layer the guard reads.
- A second re-arm on one deferred fire is refused even from a session whose
  correlation id matches nothing the deferring run wrote - pinned by a test that
  fails when a second round is allowed.
- The `review` grid in `route-table.json` fires `deferred` at no stakes level,
  so the mode is reachable only by a config-set `review.triggers.<t>.gate`, and
  a test fails if a cell is moved onto it.
- Every shipped statement of the gate vocabulary names five values, and the
  claims ledger row that counts them agrees.
- `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with an
  empty `problems` array, and every test group passes.

## Context

- D-11: no gate value reaches `git-guard.mjs` today - it reads
  `git.on_protected` and `git.protected_branches` and nothing else - so the
  guard half of criterion 5 is a lexical source census plus a hook case, never a
  refactor. Adding a plumbing route from the gate resolve into the hook to have
  something to pin is the movement the criterion forbids.
- D-02: the one-round re-arm cap's round count rides the queue artifact, keyed
  to the FIRE and not to the run's `corr`. A deferred finding is adjudicated
  later, in another session, whose `corr` matches no `rearm` from the deferring
  run - so a `corr`-keyed cap reads as unspent and the gate can loop. The
  existing `corr`-keyed cap is untouched for non-deferred gates.
- D-03: the `review` grid does not move; phase 3 (CER-01) owns what a level
  decides about gates and depends on this phase.
- Runs AFTER plans 1 and 2 - the re-arm task reads the queue faces they build.

## Tasks

### Task 1: Census the protected-branch guard as unreached by any gate

- **Files:** cadence-core/bin/git-guard.test.mjs
- **Action:** Add two arms to `cadence-core/bin/git-guard.test.mjs`. The first is
  a LEXICAL census over `cadence-core/bin/git-guard.mjs`'s own source: none of
  the five gate names appears in it, and the only config keys it reads are
  `git.on_protected` and `git.protected_branches`, which is the whole of what
  its `commitDecision` path consults from the merged config. Build each pattern
  from an escaped string so this test file is not itself matched by the rule it
  states, which is the discipline `helper-census.test.mjs` already declares for
  a tree-wide lexical census. The second is a behavioural pin: run the existing
  protected-branch commit case with a repo config layer that ALSO carries
  `review.triggers.risk_surface.gate: "deferred"` and assert the decision is
  byte-identical to the same case without it. Add NO plumbing: do not import the
  routing seam into the guard, do not thread a resolved gate anywhere near
  `commitDecision`, and do not touch `git-guard.mjs` at all - the criterion is
  that the guard did not move, so a change made to give this test something to
  observe is the failure it exists to detect (D-11).
- **Verify:** `node cadence-core/bin/test.mjs git` passes; introducing the literal `deferred` into `cadence-core/bin/git-guard.mjs` reddens the census arm; `git diff --stat cadence-core/bin/git-guard.mjs` is empty for this phase.

### Task 2: The one-round re-arm cap binds on a deferred fire, keyed to the fire

- **Files:** cadence-core/references/triage-gate.md, cadence-core/bin/deferred-queue.test.mjs, cadence-core/bin/prose-agreement.test.mjs, cadence-core/bin/weight-budgets.json
- **Action:** Extend the `deferred` arm in `references/triage-gate.md` with its
  TRIAGE half, which plan 1 deliberately left out because it happens in a later
  session: the queue is adjudicated member by member, each ruling written
  through the adjudication seam so the record SUPERSEDES its member, and where a
  `blocker`/`high` survives, the fix re-arms the trigger for ONE narrowed round -
  the same cap, the same narrowed artifact and the same terminal STOP-and-ask
  the blocking arm above already states. What differs is where the round count
  is read: off the QUEUE, as the highest round recorded for THAT fire, not by
  counting `rearm` outcome events under this run's correlation id. State the
  reason on the page - the triage runs in a session whose `corr` matches no
  `rearm` the deferring run wrote, so the corr-keyed count reads as unspent
  every time and the gate loops, which is exactly what criterion 6 forbids. The
  re-armed round records itself by writing its own queue member with
  `deferred record --round 2`, which is the same round-suffixed naming
  `ADJUDICATION-...-r2.json` already uses, so the cap is answered by reading
  what is on disk rather than by remembering. Leave the existing corr-keyed
  block for the blocking arm BYTE-IDENTICAL, its fenced `trace render`
  read-back included - the deferred arm adds a rule beside it and replaces
  nothing. Add a `deferred-queue.test.mjs` arm proving the cap: a fire with a
  round-2 member answers spent whatever correlation id the caller holds, and the
  test fails if a second re-arm is admitted. Add a `prose-agreement.test.mjs`
  arm asserting the blocking arm's fenced read-back command in `triage-gate.md`
  is unchanged, so a future edit that "unifies" the two caps reddens rather than
  quietly retiring the corr-keyed one. Re-pin
  `cadence-core/references/triage-gate.md`'s `weight-budgets.json` row.
- **Verify:** `node cadence-core/bin/test.mjs other` and `node cadence-core/bin/test.mjs prose` pass; the new cap arm fails when the round check is made to read the correlation id instead of the queue; `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with an empty `problems` array.

### Task 3: Pin that no stakes level fires `deferred`

- **Files:** cadence-core/bin/route.test.mjs
- **Action:** Add an arm to `cadence-core/bin/route.test.mjs` asserting that the
  shipped `review` grid in `cadence-core/route-table.json` holds `deferred` in
  no cell, and that `route.mjs resolve --role cad-reviewer` at each of `solo`,
  `shipped` and `critical`, with no config layer pinning a gate, returns
  `deferred` for no trigger. That is D-03 made mechanical: the mode is reachable
  only by a config-set `review.triggers.<t>.gate` this cycle, because phase 3
  (CER-01) changes what a level decides about gates and moving the rows now
  means editing them twice - and the grid is quoted by four documents plus the
  claims ledger. The arm must fail if a cell is later moved onto `deferred`
  without that phase's work, which is the point: it is a hold, not a
  prohibition.
- **Verify:** `node cadence-core/bin/test.mjs routing` passes; editing one `review` cell in `cadence-core/route-table.json` to `deferred` reddens the new arm.

### Task 4: Every statement of the gate vocabulary names five

- **Files:** METHOD.md, .planning/DOCS-CLAIMS.md
- **Action:** `METHOD.md` states the gate vocabulary as four names beside the
  `review.mode` vocabulary; add `deferred` with one clause saying what it does -
  the reviewer runs, the findings are queued, the run continues and the LAND is
  what stops - keeping the sentence's existing shape and not restating the arm
  that `references/triage-gate.md` owns. Then correct the claims-ledger row that
  counts it: `.planning/DOCS-CLAIMS.md`'s `METHOD-45` row records the claim as
  "Gate vocabulary (4)", which is the row `/cad-docs-verify` re-checks, so
  leaving it makes a verified claim false the moment this phase ships - the
  defect class `DOC-03` exists to stop being reworded away. Update that row's
  claim text and nothing else in the ledger; do not re-verify or re-date other
  rows. Leave `README.md` and `docs/WORKFLOW.md` alone: both print the per-LEVEL
  GRID, whose cells do not move this phase, and the `README-24` ledger row
  describes that grid rather than the vocabulary.
- **Verify:** `grep -n 'deferred' METHOD.md` shows the value in the gate-vocabulary sentence; `grep -n 'METHOD-45' .planning/DOCS-CLAIMS.md` shows the claim reading five; `git diff --stat README.md docs/WORKFLOW.md` is empty; `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with an empty `problems` array and every group of `node cadence-core/bin/test.mjs` passes.

## Notes

- Sequential, LAST of the three plans: task 2 reads the queue faces plans 1 and
  2 build, and task 4's whole-tree verify is the phase's closing gate.
- Nothing in this plan edits `cadence-core/bin/git-guard.mjs` or the `review`
  grid. If a task here appears to need either, that is the signal criterion 5
  or D-03 was already violated upstream - report it rather than making the edit.
