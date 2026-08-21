---
phase: 3
status: complete
completed: 2026-08-21
---

# Phase 3: Ceremony the change pays for - Summary

`stakes` became the minimum a project accepts rather than the level every phase
pays. `route.mjs resolve` reads the phase's own declared `files:` at plan time
and raises from that floor - per plan for an executor, per phase for everyone
else - and a phase touching nothing on an answered surface now routes below the
old default.

This phase ran in two rounds. PLAN-1 shipped the floor itself and its UAT found
six failures, four of them behaviour and two of them whole plans that were never
written. PLAN-2, PLAN-3 and PLAN-4 closed all six.

## What shipped

Round 1 (PLAN-1):

- `declaredPhaseFiles` / `declaredPlanFiles` - what a phase's plans declare, with
  the `found`/`clean` counts the aggregation rule needs -
  `cadence-core/bin/lib/phase-plans.mjs`
- `scanDeclared` - what a declared file set touches, at plan time, beside the
  existing `scanDiff` - `cadence-core/bin/lib/risk-diff.mjs`
- `riskFloor` - the floor resolve itself, every move stated in `reason` and every
  unreadable input in `warnings` - `cadence-core/bin/route.mjs`
- `resolve --plan <k>`, and a malformed `--phase` REFUSED rather than answered
  about the cursor's phase - `cadence-core/bin/lib/arg-contract.mjs`

Round 2 (PLAN-2, PLAN-3, PLAN-4):

- A declared DOCUMENT contributes its path and not its prose, so documentation
  that MENTIONS a construct stops raising the phase - `lib/risk-diff.mjs`
- Plan-time reasons read `body line:` where no diff exists; `scanDiff` keeps
  `changed line:` - `lib/risk-diff.mjs`
- A scope that declared NO files is never discounted: "nothing was declared" and
  "nothing touches a surface" are now different sentences -
  `lib/phase-plans.mjs`, `route.mjs`
- Declared bodies and the phase locator are both contained to the repository by
  `realpathSync`, and a PLAN file is bounded before it is opened -
  `route.mjs`, `lib/phase-plans.mjs`
- `declaredFilesIn` (the one by-path reader) and `phaseDirsIn` (live and
  archived phase directories) - `lib/phase-plans.mjs`
- `route.mjs replay` - what the floor does to this project's own phases, off
  `levelFor`, the single scope-to-level implementation `resolve` shares
- `review.triggers.risk_surface.waive_routing_floor` - the one way to route below
  the computed floor, waiving a LEVEL and never the blocking review -
  `config.schema.json`, `route.mjs`
- A raise floors the configured `model.effort` rung too, for post-plan roles
- The narrative documents and the claims ledger now describe the floor that
  ships - `METHOD.md`, `INTERNALS.md`, `README.md`, `docs/WORKFLOW.md`,
  `.planning/DOCS-CLAIMS.md`
- `.planning/phases/3/MEASUREMENT.md` - the level diff, the before/after
  distribution, the token baseline and a falsifiable prediction

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | a9bbffa | read what a phase's plans declare, with the counts the floor needs |
| 1 | 2 | bf10430 | `scanDeclared` - what a declared file set touches, at plan time |
| 1 | 3 | b87d5e2 | `stakes` becomes a floor the phase's declared files raise |
| 1 | 4 | 78854e6 | no surface and no evidence stop being the same sentence |
| 1 | 5 | b70e217 | `resolve --plan`, so an executor floors on the plan it was handed |
| 1 | 6 | 77e53de | a malformed `--phase` is refused, not answered about another phase |
| 1 | 7 | 1c2c45c | the call sites pass what the floor needs, and the seam says so |
| 1 | gate | da5bae4 | the risk-floor discount is a claim the scope was READ |
| 1 | gate | 7ae1489 | a plan file is bounded before it is opened |
| 2 | 1 | b3dbbac | a declared document body is prose, not code |
| 2 | 2 | c199846 | a plan-time reason says what it actually read |
| 2 | 3 | 9129f8c | a scope that declared nothing proves nothing |
| 2 | 4 | 13343e6 | a declared body outside the repository is not evidence |
| 3 | 1 | a9becff | a phase directory, wherever the project keeps it |
| 3 | 2 | c5d38c3 | what the floor does to this project, printed rather than asserted |
| 3 | 3 | 97807b4 | lowering below the computed floor takes a named waiver |
| 3 | 4 | 11030c1 | the retired rail, pinned byte for byte |
| 3 | 5 | 12aa4ab | a detected surface floors the configured rung too |
| 3 | 6 | 1c4d7c1 | the seam states the waiver, the clamp and the replay |
| 3 | gate | 70bd22a | the locator does not leave the planning root |
| 4 | 1 | d6831b9 | METHOD.md states the plan-time floor it ships |
| 4 | 2 | 00d8c09 | INTERNALS.md and README.md stop calling stakes the last word |
| 4 | 3 | c4b45ff | docs/WORKFLOW.md names the two risk detectors, not one |
| 4 | 4 | 72b2339 | DOCS-CLAIMS ledger records the CER-01 re-correction |
| 4 | 5 | afafa44 | what the computed level actually costs, measured |

## Deviations

- [deviation, PLAN-1 task 2] The Verify asserted `risk-diff.mjs` yields no
  content match under its own path "while the identical bytes supplied under
  another path do". Measured: it matches nothing under either path - v3.5.5's
  respelling already removed every self-matching line. The exemption is proved on
  `lib/surface-scan.mjs` instead. Commit bf10430.
- [deviation, PLAN-3 task 3] The schema key task 3 mandates makes
  `self-verify.test.mjs`'s placeholder census report `inert-config-key`, because
  that fixture enumerates every schema key. `self-verify.test.mjs` is declared by
  no plan in this phase, so the executor recorded the gap rather than writing
  outside its lease, and checkpointed at task 6 whose Verify could not otherwise
  be met. The orchestrator made the one-token fix and committed task 6 (1c4d7c1).

## Review gates

- `plan` (blocking, cross-model): 4 raised on the round-2 plans, 2 survived and
  were fixed before execution - a replay that would have printed no evidence for
  the rows that matched a surface, and a README sentence contradicting D-02 by
  claiming a phase routes below an explicitly SET level. Record:
  `ADJUDICATION-plan-cad-plan-34ae456.json`.
- `risk_surface` on PLAN-1's range (blocking, round 3): 3 raised, 1 survived -
  `readOnePlan` read PLAN files with no regular-file check and no size bound, so
  a plan path linked to a character device hung a resolve whose contract is to
  fail closed. Fixed in 7ae1489.
- `risk_surface` on PLAN-3's range (blocking, rounds 1-2): 2 raised then 1 on the
  narrowed re-arm. `phaseDirsIn` followed symlinks out of the planning root
  (fixed, 70bd22a); the re-arm's TOCTOU finding on the same check was ruled
  DOWNGRADED - real, but it needs write access to `.planning/` during a routing
  command, which is already code execution through the executor, and closing it
  needs dirfd-relative opens Node's sync API does not offer for directory walks.
- PLAN-2 and PLAN-4 matched no surface and fired nothing.

## Open items

- `risk-check status` cannot settle a record left unfired by a PREVIOUS run: it
  joins a receipt to a record only within one correlation id, and every receipt
  is written under the current `phase_start`'s id. PLAN-1's first run left such a
  record and an adjudication, a `gate_pass` and an `override` all failed to
  reach it. Overridden by the user with a stated reason and filed to the global
  Cadence queue as rework. This blocks the phase's gate from ever reading clean.
- `planning.mjs:290` derives `executed` from SUMMARY.md alone, so a phase that
  shipped part of its declared plan shape cannot have the rest executed:
  `/cad-execute` refuses, and `--rerun` re-dispatches at plans already committed.
  This phase's round 2 was run by driving the sequential path by hand. Filed as
  rework.
- Nothing checks that the plans WRITTEN cover CONTEXT's declared `Plan shape`.
  That is why this phase shipped one third planned and reached UAT before anyone
  noticed. Filed as rework.
- The document rule is extension-keyed, so a documentation file with no extension
  or an unlisted one (`.org`, `.textile`) is still scanned as code. Stated safe
  direction - it fails toward raising.
- `phaseDirsIn` and the declared-bodies read have no bound on the NUMBER of
  directories, plans or declared paths, so a hostile planning tree can make one
  replay arbitrarily expensive. Raised by the `risk_surface` review and
  downgraded: self-inflicted, and bounded by the user's own repository.
- `lib/retired-keys.mjs`'s eight `risk.override.*` detail strings say "there is no
  floor for a waiver to lower", which stopped being true at b87d5e2 and is doubly
  untrue now the waiver key ships. D-03 locks that file byte-identical and
  PLAN-3 task 4 pins it by sha256, so the sentence stands - flagged, not fixed.
- `milestone-prune.test.mjs:557` fails on a clean tree before any commit in this
  phase. Pre-existing and outside every plan's lease.
- No `lint` command exists for this project; static analysis ran as
  `npx tsc -p tsconfig.ci.json`, clean before every commit.

## Goal check

The commits deliver the goal, and the floor is demonstrated on this project's own
work rather than only on fixtures. `node cadence-core/bin/route.mjs replay`
returns `ok:true` with 30 rows over this repository's live and archived phases:
27 raise with the surface, the signal and the evidencing file named per row, 2
resolve at `solo` below the `shipped` default and name no surface, 1 is held at
the configured level because its scope could not be discounted, and
`regressions` is empty - no phase touching an answered surface resolves lower
than it did. The economics are real on a real plan: PLAN-4 of this phase declares
only documents and resolved at stakes `solo` on `sonnet`, where PLAN-2 and PLAN-3
both resolved `shipped` on `opus`, which is CER-01's "a README phase and an auth
phase stop buying the same model" measured rather than asserted. AC1 and AC2 are
pinned by `route.test.mjs`, AC4's waiver key refuses an unknown surface through
`config.mjs check` and its retired rail is pinned byte for byte by sha256, and
AC5's fail-closed arms return `ok:true` at the configured stakes across six
cases. `node cadence-core/bin/test.mjs` reports 2606 pass with the single
pre-existing `milestone-prune` failure named above, `self-verify --root .`
returns `ok:true` with `problems: []`, and `npx tsc -p tsconfig.ci.json` is
clean.

What this phase should NOT be read as claiming. AC6's live milestone comparison
was NOT run - it needs real dispatches against a provider, the user recorded it
skipped, and `MEASUREMENT.md` carries a baseline and a falsifiable prediction in
its place, including the honest caveat that this repository is a weak test of the
economics because its own source genuinely parses JSON and deletes paths. The
per-phase discount therefore reaches 2 of 30 phases here; a documentation-heavy
project is where it pays. The phase's `risk-check status` gate does not read
clean and cannot be made to, for the correlation-id defect recorded above, and it
stands on a user override rather than on a satisfied check.
