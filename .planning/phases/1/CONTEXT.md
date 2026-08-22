# Phase 1: The transaction that was never there - Context

Gathered: 2026-08-22
Feeds: /cad-plan 1

## Scope boundary

In: one shared primitive, exported from a new `cadence-core/bin/lib/` module,
that owns the step ordering, the pre-flight validation and the completed/failed
record for a multi-file state transition; `cmdRenumber` and `cmdMilestonePrune`
both route their existing partial-state refusals through it; a `HELPERS` census
row makes the "one, not four" mechanical.
Out: `cmdPhaseDone` and `release-bump.mjs` - they are phase 2, and their
adoption is what proves the primitive's shape generalizes. No journal file, no
resume path, no `/cad-health` reader, no new subcommand and no `CONTRACTS` row.
No change to either operation's observable envelope.
Deferred: None.
Plan shape: one plan.

## Durable decisions

- D-01 (Journal or refusal): The primitive is a REFUSAL PROTOCOL, not a journal
  - validate every planned write before the first, refuse whole, report what
  completed. No on-disk state, no replay, no resume path. This contradicts what
  issue #145 asked for; #145 is a `AGREE - proposal` verdict from a deep dive
  whose journal argument is one sentence and whose own code citation
  (`planning.mjs:3227-3273`) is confirmed stale, so the code evidence governs.
  Evidence: `cadence-core/bin/planning.mjs:5957-5969` - renumber's D-03 comment
  states `remove` destroys `phases/<at>` before the first move runs, so step one
  can never be undone and advertising a rollback the code lacks would be worse
  than a generic failure; `cadence-core/bin/planning.test.mjs:4183-4185` pins
  that refusal-to-prescribe with `assert.doesNotMatch(r.hint, /by hand,\s*then
  re-run/)`. `cadence-core/bin/milestone-prune.test.mjs:1049-1075` proves prune
  is ALREADY resumable with zero on-disk state, by recomputing the candidate set
  from ROADMAP plus an `(label, artifact-origin)` containment test over
  ARCHIVE.md (`planning.mjs:6404-6424`). Decisive against the journal arm:
  `planning.test.mjs:4163` forces the `#49.2` failure by `chmodSync` on the
  `.planning` ROOT, so a journal written there fails EACCES first, `completed`
  becomes `[]` and `failed` becomes the journal write - reddening the exact
  assertions at `:4172-4179` that AC1 names as its pin.

- D-02 (Primitive boundary): The primitive owns step ordering, pre-flight
  validation and the completed/failed record. It does NOT own the envelope -
  each caller keeps its own `emit()`, its own reason string and its own key
  names. Evidence: the two envelopes are structurally incompatible - renumber
  emits `{ok:false, reason:'partial-apply', completed, failed:<op object>,
  detail, hint}` at `planning.mjs:6024-6035`, prune emits `{ok:false,
  reason:'partial-prune', action:'partial', failed:<number[]>, ...envelope,
  hint}` carrying `label`, `mode`, `phases`, `roadmap`, `requirements`, `dirs`,
  `residue_rows`, `warnings` at `planning.mjs:6513-6539`. Both deliberately
  bypass `fail()`, which supports only reason/detail/hint - the D-11 note at
  `planning.mjs:6021-6023`. House precedent for "primitive returns a
  discriminated result, caller renders": `withPlanningFileLock` returns
  `{ok:true,value}|{ok:false,reason,detail}` at
  `cadence-core/bin/lib/capture-file.mjs:301-312`, and `appendCapture` returns
  `{ok:false, reason:'write-failed'|'write-lost', detail}` for planning.mjs to
  render.

- D-03 (Loop discipline): Both callers keep the loop discipline they ship with.
  Renumber stops at the first throw; prune catches per phase, continues, and
  writes both documents for the surviving subset. The primitive must express
  both rather than force one on the other. Evidence: `planning.mjs:6017-6038`
  (renumber's ordered `steps` array, stop-at-first-failure, `failed` is a single
  op object) against `planning.mjs:6488-6491` (prune's per-phase catch),
  `:6498` (`applied = completed.filter(n => !failed.includes(n))`) and
  `:6508-6511` (the subset write). Collapsing them changes
  `completed`/`failed`/`phases` contents and reddens
  `planning.test.mjs:4171-4185` or `milestone-prune.test.mjs:778-795`.

- D-04 (Pre-flight scope): AC3's "refuses whole, nothing written" is a NEW
  pre-flight stage the primitive adds, not a retrofit of either existing site.
  `milestone-prune`'s shipped `partial-prune` deliberately DOES write, and that
  behaviour stays. Evidence: `milestone-prune.test.mjs:769-795` asserts that on
  a `partial-prune`, phase 2.1 cleared both documents while phase 1 kept its
  roadmap line, its detail section and its requirement rows;
  `planning.mjs:6508-6511` performs those writes after the failures are known,
  and ARCHIVE.md is written earlier still, before the directory loop
  (`planning.mjs:6424`, defended in the RCL-07/D-01 comment at `:6376-6402`).
  Reading AC3 as a mandate to make prune all-or-nothing reopens the
  tree/documents disagreement that `planning.mjs:6438-6452` records as the
  defect that ordering was built to fix.

- D-05 (Enforcement): A `HELPERS` census row is added for the primitive in this
  phase, so JRN-01's "one shared primitive rather than four hand-written
  approximations" is enforced mechanically rather than asserted in prose.
  Evidence: `cadence-core/bin/helper-census.test.mjs:1-28` walks every `.mjs`
  under `cadence-core/bin` - bins, `lib/` and tests alike - and asserts each
  shared contract's BODY IDIOM is defined exactly once, matching bodies rather
  than names precisely so a paste-back under a new name fails. Without the row,
  a fifth hand-written approximation lands in a sixth file and no test sees it.
  This follows the project's own rail: scripts keep invariants, prose keeps
  judgment.

## Decisions

- D-06 (Module location): The primitive is a new `cadence-core/bin/lib/*.mjs`
  module with its own sibling `*.test.mjs`, importable by both `planning.mjs`
  and (in phase 2) `release-bump.mjs`. No `CONTRACTS` row, no subcommand, no
  arg-contract entry. Evidence: `cadence-core/bin/self-verify.mjs:99-105` states
  check 14 as TOP-LEVEL only - "a `lib/*.mjs` module is not invoked from prose
  and takes no row"; fs-touching lib modules are established
  (`lib/capture-file.mjs`, `lib/planning-files.mjs`, `lib/trace.mjs`);
  `release-bump.mjs:82` already imports `atomicWrite` from
  `lib/planning-files.mjs`, so phase 2's caller can reach a lib module without
  touching planning.mjs; a new `<stem>.test.mjs` under `cadence-core/bin` runs
  automatically in the `other` group (`cadence-core/bin/test.mjs:11-15`). A
  subcommand instead would require an arg-contract row
  (`lib/arg-contract.mjs:572-576, 846-853`) plus prose, and would be caught by
  self-verify checks 2 and 14.

- D-07 (Reference sites): The roadmap's two cited ranges are re-derived and
  carried, with one correction - prune's range extends to `:6539`, not `:6535`.
  Evidence: `cmdRenumber` is declared at `planning.mjs:5768`, its apply block
  opens at `:5957`, the step loop runs `:6018-6038` and the `partial-apply` emit
  is `:6024-6035`; the roadmap's `5964-6035` points at what it claims, omitting
  only `completed.push(op)` at `:6037`. `cmdMilestonePrune` is declared at
  `:6281` and the `partial-prune` branch is `:6534-6539`; the roadmap's
  `6530-6535` stops on the emit's first line and TRUNCATES the three hint lines
  at `:6536-6538` that AC2 pins. #145's own `3227-3273` now spans
  `DISPATCH_WINDOW_DEFAULTS` (`:3212`), `SUGGEST_KEY_DEFAULTS` (`:3239`),
  `gateLadder` (`:3256`) and `rungLadder` (`:3266`) - the roadmap's stale-citation
  warning is accurate verbatim.

- D-08 (Prose): Workflow prose stays byte-identical where the change allows. Any
  wording change re-pins `weight-budgets.json` in the same commit. Evidence:
  `weight-budgets.json` sets ceilings of 3448 B for
  `cadence-core/workflows/phase.md` and 14222 B for
  `cadence-core/workflows/milestone.md`, and self-verify check 4 is a CEILING, so
  growth reddens and a shrink does not (`self-verify.mjs:706-719`). The two
  claims that would move are `cadence-core/workflows/phase.md:62-64` ("the seam
  is not transactional - reconcile those ops by hand"), pinned as row PHASE-11 in
  `.planning/DOCS-CLAIMS.md:924`, and `cadence-core/workflows/milestone.md:150-153`,
  which states `partial-prune`'s meaning and its re-run remedy.

## Acceptance criteria

- [ ] AC1: `renumber` against the `#49.2` fixture (`.planning` root at `0o555`)
      returns `reason:"partial-apply"` with `completed` deep-equal to
      `[{rm:'phases/1'},{git_mv:[...]},{git_mv:[...]}]` and `failed` deep-equal
      to `{edit:'ROADMAP.md'}`; `planning.test.mjs:4172-4185` passes unmodified,
      including the `doesNotMatch(/by hand,\s*then re-run/)` assertion.
- [ ] AC2: A `partial-prune` run returns the same `reason`, `action`, `failed`
      array, `residue_rows`, `warnings` and three-line hint it returns today;
      `milestone-prune.test.mjs:769-795` and `:1049-1075` pass unmodified.
- [ ] AC3: A test drives the primitive with one pre-checkable condition failing
      and asserts both that the result is a refusal naming that condition, and
      that every file in the planned write set is byte-identical on disk
      afterwards.
- [ ] AC4: A test asserts a primitive refusal creates no new file anywhere under
      `.planning/`, by comparing a full recursive listing taken before and after.
- [ ] AC5: `node cadence-core/bin/helper-census.test.mjs` passes with a `HELPERS`
      row for the primitive present, and fails when a second copy of the
      primitive's body is added under a different name in any
      `cadence-core/bin/**/*.mjs`.
- [ ] AC6: `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true`
      with an empty `problems` array.

## Flagged assumptions

- "Planned write" means a pre-checkable condition, not an arbitrary I/O failure;
  the primitive cannot promise to catch what the existing pre-flights already
  miss - Likely; if wrong: the primitive advertises a whole-transaction refusal
  it delivers only for collisions, and callers stop hand-checking the tree, which
  is the D-03 failure mode the renumber comment names by hand. Evidence:
  renumber already runs a destination-collision check with a `vacated` set
  (`planning.mjs:5819-5841`) and an `uncommitted-work`/`unreadable-git-state`
  gate before the destructive `rm` (`:5843-5872`), yet what actually produces
  `partial-apply` in the shipped tests is an EACCES the pre-flight cannot see
  (`planning.test.mjs:4163`, `:4198`) and an ENOTEMPTY at rename time
  (`milestone-prune.test.mjs:770-772`); two of renumber's steps are
  `git rm`/`git mv` via `execFileSync` (`planning.mjs:5971-6006`, `gitMv` at
  `:5638`) with no dry-run validation at all. AC3 is scoped to pre-checkable
  conditions for exactly this reason.
- The primitive's shape is adequate for phase 2's two callers (`cmdPhaseDone`,
  `release-bump.mjs`) but nothing in phase 1 tests that - Likely; if wrong:
  phase 2 reshapes the primitive and phase 1's two adoptions are re-edited. The
  import path is proven (`release-bump.mjs:82` already imports from
  `lib/planning-files.mjs`); the shape adequacy is not.
