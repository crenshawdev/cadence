---
phase: 4
plan: 3
requirements: [LND-02]
files:
  - cadence-core/bin/planning/risk-carry.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/lib/arg-contract.mjs
  - cadence-core/bin/arg-contract.test.mjs
  - cadence-core/bin/planning-risk-carry.test.mjs
  - cadence-core/bin/test.mjs
  - cadence-core/bin/test-groups.test.mjs
  - cadence-core/bin/phase-spelling.test.mjs
  - cadence-core/bin/planning-lease-check.test.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/citation-census.test.mjs
  - .planning/DOCS-CLAIMS.md
---

# Phase 4: Land reads rulings, not raw findings - Plan 3 of 4

## Goal

The rulings survive `/cad-milestone`'s prune of the phase directories: a seam
carries every `risk_surface` review and its adjudication records out of
`phases/<N>/` before the prune deletes it, so the gate can still derive its
verdict at close time.

## Must be true when done

- `planning.mjs risk-carry --phase <N>` leaves this phase's
  `REVIEW-risk_surface*.md` and `ADJUDICATION-risk_surface*.json` readable
  outside `phases/<N>/`, every round of them, and leaves the originals where
  they were.
- Running `milestone-prune.mjs --mode delete` after that carry leaves the
  carried `ADJUDICATION-*.json` readable at the carry destination, and
  `land-cleanup.mjs gate` returns the identical decision before and after the
  prune.
- The carry refuses - moving nothing - on a mistyped phase spelling, on a
  symlink at either destination component, and on a destination file that
  already exists.
- A `DEFERRED-*.json` or an `ADJUDICATION-diff-*.json` sitting beside the
  risk_surface artifacts stays where it is.
- `node cadence-core/bin/test.mjs` is green, with every census this plan's
  declared files hold re-pinned in the commit that moved it.

## Context

Locked: D-01 (the carry GROWS to move the records through the prune; the gate
derives the verdict at close time from them, never a frozen verdict written at
carry time), D-08 (every round is unioned; the highest round alone is not the
record of the fire), D-12 (no consumer glob reaches `_archive-<label>/`, so the
archive arm preserves nothing for the gate), D-17 (line-pinned linters:
`citation-census.test.mjs` filters to `planning.mjs` and `planning/`, so re-run
it), D-18 (a new flag costs an `arg-contract.mjs` row and moves the flag-entries
census).

SEQUENTIAL: this plan runs third, after Plan 1 and Plan 2, and before Plan 4.
Names fixed by this phase: the subcommand is `risk-carry`, its destination is
`.planning/risk-carry/<N>/`, the payload's additive key is `unruled`, the fifth
state is `unruled-review`, the envelope's additive key is `overridden`.

## Tasks

### Task 1: The carry seam

- **Files:** cadence-core/bin/planning/risk-carry.mjs,
  cadence-core/bin/planning.mjs, cadence-core/bin/lib/arg-contract.mjs,
  cadence-core/bin/arg-contract.test.mjs
- **Action:** add a ONE-WORD `risk-carry --phase <N>` subcommand to
  `planning.mjs`'s command table, dispatching to a new
  `cadence-core/bin/planning/risk-carry.mjs`. One word and not two, for the
  reason the `adjudication` entry in that table already gives about itself: one
  operation does not earn widening `TWO_WORD`, and widening it would change how
  every existing spelling resolves. It COPIES every `REVIEW-risk_surface*.md`
  and every `ADJUDICATION-risk_surface*.json` in `phases/<N>/` to
  `.planning/risk-carry/<N>/`, basenames preserved so the sibling relation the
  gate's caller joins on survives the move, and every round with it. A COPY and
  NOT the `renameSync` `planning/deferred-carry.mjs` uses, and the difference is
  load-bearing: that destination is committed and permanent, this one is
  transient and `/cad-milestone` deletes it when the close resolves, so a move
  would destroy under `--mode archive` the very records `_archive-<label>/<N>/`
  is supposed to keep - the tier `lib/why-record.mjs` reads to answer
  `/cad-why`. Scope it to the `risk_surface` trigger: a `plan` or `diff` record
  carried into this set would halt closes on findings the land has never halted
  on. Follow `planning/deferred-carry.mjs`'s refusal order exactly, because this
  face also writes during an unattended close - parse `--phase` through
  `requirePhaseArg`, then `phaseSpellingCollision`, then `lstatSync` BOTH
  destination components before anything is written (a symlink at either one is
  followed), then refuse rather than overwrite a destination file that already
  exists. Emit one JSON line through `ok()`/`fail()` from `planning/core.mjs`
  naming the phase, what was copied and how many. Declare the flag in
  `lib/arg-contract.mjs` mirroring the `'deferred carry'` row exactly: `--phase`
  required, type `phase`, `value: 'refuse'`, `bare: 'refuse'`, and no other flag
  - the SET it carries is derived from the phase, never named on the command
  line. `arg-contract.test.mjs` holds the flag-entries census; re-pin both its
  numbers in this commit.
- **Verify:** over a temp `.planning` fixture holding
  `phases/3/REVIEW-risk_surface-plan-1.md`,
  `phases/3/ADJUDICATION-risk_surface-plan-1.json` and
  `phases/3/ADJUDICATION-risk_surface-plan-1-r2.json`, running
  `node cadence-core/bin/planning.mjs risk-carry --phase 3 --dir <fixture>`
  prints `ok:true`, leaves all three readable under `.planning/risk-carry/3/`
  AND still readable in `phases/3/`; a bare `--phase` with no value prints
  `ok:false` / `missing-flag-value` and creates no `risk-carry` directory;
  `node --test cadence-core/bin/arg-contract.test.mjs` is green.

### Task 2: Its tests, and the planning-seam censuses it moves

- **Files:** cadence-core/bin/planning-risk-carry.test.mjs,
  cadence-core/bin/test.mjs, cadence-core/bin/test-groups.test.mjs,
  cadence-core/bin/phase-spelling.test.mjs,
  cadence-core/bin/planning-lease-check.test.mjs,
  cadence-core/bin/trace.test.mjs
- **Action:** write `planning-risk-carry.test.mjs` covering the copy set (only
  `risk_surface` artifacts move; a `DEFERRED-*.json` and an
  `ADJUDICATION-diff-*.json` beside them stay behind), both rounds arriving, the
  originals surviving, the re-run being idempotent rather than a refusal storm,
  the never-overwrite refusal, and the two symlinked-destination refusals. Add
  its stem to `GROUPS.planning` in `test.mjs` - `test-groups.test.mjs` asserts
  that list equals the `planning-*.test.mjs` files on disk in both directions,
  so a new file without the stem reddens it. Amend `phase-spelling.test.mjs`'s
  callsite census: this adds one `--phase` callsite under
  `cadence-core/bin/planning/` and it resolves a `phases/<N>/` path, so BOTH
  figures move and the new callsite needs its own disposition row beside the
  `deferred carry` ones. Re-run `planning-lease-check.test.mjs`'s error-detail
  census and `trace.test.mjs`'s refusal-sentence census over the widened seam
  and re-pin whatever the new module moved; both are scoped to the whole
  `planning/` directory, which is why they are in this lease.
- **Verify:** `node --test cadence-core/bin/planning-risk-carry.test.mjs
  cadence-core/bin/phase-spelling.test.mjs
  cadence-core/bin/planning-lease-check.test.mjs cadence-core/bin/trace.test.mjs
  cadence-core/bin/test-groups.test.mjs` all green;
  `node cadence-core/bin/test.mjs --list` shows `planning-risk-carry` inside the
  `planning` group; `node --test cadence-core/bin/citation-census.test.mjs` is
  green, and where the `planning.mjs` dispatch edit shifted a cited line, the
  citation is RE-PINNED IN THIS COMMIT at its own repair site: the six
  `.planning/DOCS-CLAIMS.md` claim rows whose `doc` cell names
  `cadence-core/bin/planning`, and `citation-census.test.mjs`'s own retired-
  citation constants. Both are declared in this plan's lease for exactly that
  undertaking (a shifted line in a pinned `planning/` row is the break phase 1's
  SUMMARY recorded, and repairing it at an undeclared file is what
  `lease-check` refuses). `.planning/REQUIREMENTS.md` is NOT in the lease and
  needs no row: its `## Active` section carries zero live `planning.mjs:<line>`
  citations, measured before this plan was written.

### Task 3: Prove the ruling survives the prune

- **Files:** cadence-core/bin/planning-risk-carry.test.mjs
- **Action:** one end-to-end arm. Build a fixture planning root with a checked
  completed phase in `ROADMAP.md` and a `phases/<N>/` holding a
  `REVIEW-risk_surface-plan-1.md`, a round-one record and a round-two record
  whose entries differ. Compose the union of both records' `entries[]`, pipe it
  to `land-cleanup.mjs gate` under `git.auto_close: true` and keep the decision.
  Then run `risk-carry --phase <N>`, then `planning.mjs milestone-prune --label
  <label> --mode delete`, then rebuild the same union from
  `.planning/risk-carry/<N>/` alone and pipe it again: the two decisions must be
  identical, and both records must still be readable at the destination. Union
  BOTH rounds, and assert an entry that appears only in round one is in the
  payload - the highest round alone is not the record of the fire, measured on
  `_archive-v3.7.3/1/` where 2 of 6 findings appear only in round one.
- **Verify:** the arm passes; removing the `risk-carry` call from it makes it
  fail with the records gone from the tree, which is the falsifier - run it once
  that way, see it red, restore.

## Notes

- SEQUENCING, and it is not advisory. Plan 2 binds to the name Plan 1 gives the
  predicate's third answer, and Plan 4's prose describes a gate Plan 2 builds
  and invokes a subcommand THIS plan adds - `self-verify` check 2 resolves a
  prose invocation against `lib/arg-contract.mjs`'s CONTRACTS, so Plan 4's
  verification cannot pass until Task 1 here has landed. Run 1, 2, 3, 4 in that
  order. This plan shares no declared file with any other, so `plan-overlap`
  will report it independent; that report is about file safety, not about
  whether the work makes sense out of order.
- Planner's calls, recorded because CONTEXT left them open. The carry is a SEAM
  rather than prose, for the reason `planning/deferred-carry.mjs`'s own header
  gives about itself: it writes committed artifacts during a close that runs
  completely unattended, and a prose step that half-runs there leaves the only
  thing stopping the land inside a directory the prune is about to delete. It
  COPIES rather than moves, which is where it departs from that precedent, and
  the reason is `--mode archive`: the destination is transient and Plan 4's step
  7 edit deletes it, so a move would strip `_archive-<label>/<N>/` of the
  records `/cad-why` reads there. The destination `.planning/risk-carry/<N>/`
  keeps a phase level for the reason the deferred carry keeps one - two phases
  routinely fire the same trigger on the same `plan-<k>` discriminator, and a
  flat carry would collide silently.
- Flagged assumption carried from CONTEXT and resolved here: the carry
  destination is a NEW location rather than `/cad-land`'s existing carried-copy
  path, because AC6's join needs the review file and its record to stay
  siblings, and the single unioned file has no per-fire identity to join on.
