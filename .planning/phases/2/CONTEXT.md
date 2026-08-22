# Phase 2: Both callers on the journal - Context

Gathered: 2026-08-22
Feeds: /cad-plan 2

## Scope boundary

In: `cmdPhaseDone` and `release-bump.mjs` stop claiming an atomicity they do
not have. `phase-done` gains a pre-flight refusal so nothing is written until
every edit it will make is validated, and its envelope states whether both
documents moved or only the roadmap. `release-bump` reads and decides the whole
write set - primary manifest, sibling manifest, CHANGELOG - before the first
write, so a malformed sibling can no longer leave a partially bumped tree.
Both route their write set through phase 1's `runTransition`, and `preflight`
gets its first production caller. `milestone.md`'s halt prose, its two
DOCS-CLAIMS rows and `weight-budgets.json` move in the same commit as the
behaviour they describe.
Out: no journal file, no resume path, no rollback and no `/cad-health` reader -
phase 1's D-01 stands. No new subcommand, no arg-contract row, no CONTRACTS row
and no second `HELPERS` census row. No discovery scan for sibling manifests. No
change to `roadmap.{line,now}` or `reqs[]` in `phase-done`'s success envelope,
and no change to the `siblings[]` refusal arm for a sibling that is readable but
not upgradeable.
Deferred: None.
Plan shape: multiple plans, same phase - `phase-done` (AC1-AC3, AC6) and
`release-bump` (AC4-AC5) are independent files with independent test suites and
no shared edit; AC7 is the whole-phase gate.

## Durable decisions

- D-01 (phase-done guarantee): The honest guarantee for `phase-done` is a
  PRE-FLIGHT REFUSAL, not a rollback. Phase 1's primitive is a refusal protocol
  with no undo, so "ROADMAP.md is unchanged on disk afterwards" is reachable
  only if the run refuses before the first `atomicWrite`. Evidence:
  `cadence-core/bin/lib/file-transition.mjs` header ("A REFUSAL PROTOCOL, NOT A
  JOURNAL") and `runTransition`'s early return on the first unsatisfied
  condition; `cadence-core/bin/planning.mjs:698-701` (the comment sits directly
  above two unguarded `atomicWrite` calls); `.planning/ROADMAP.md:109-113`;
  `.planning/phases/1/SUMMARY.md:39` (the pre-flight stage has no production
  caller yet). If wrong: the phase ships a `stop-at-first-failure` loop with no
  `preflight`, AC1 can only assert that an error was returned - the exact thing
  the roadmap says is not enough - and phase 1's pre-flight stage stays
  deletable dead flexibility.

- D-03 (absent vs unreadable): A present-but-UNREADABLE `REQUIREMENTS.md`
  becomes the pre-flight refusal; a genuinely ABSENT one keeps today's
  roadmap-only write. The two stop being the same answer. Evidence: measured
  2026-08-22 (n=1), `phase-done --n 1` against a tree where `REQUIREMENTS.md` is
  a directory returned `{"ok":true,"roadmap":{"line":5,"now":"[x]"},"reqs":[]}`
  at exit 0 with the roadmap boxed and the traceability rows silently unwritten;
  `read()` collapses both states at `cadence-core/bin/planning.mjs:213-216`;
  `planning.mjs:6360-6369` states the "REQUIREMENTS.md is optional at this seam"
  rule for prune and lumps "missing or unreadable" into one warning; the
  three-state precedent is `readManifest` at
  `cadence-core/bin/release-bump.mjs:117-138`. Rejected: refusing on absence too
  (any project that never kept a REQUIREMENTS.md could no longer close a phase -
  `cadence-core/workflows/verify.md:312` is a hard step); keeping both silent
  (leaves the pre-flight with no condition to refuse on and AC1 with no lever).

- D-04 (envelope shape): The two documents' disposition is reported through a
  NEW field. `roadmap.{line,now}` and `reqs[]` keep their current shape and
  meaning. Evidence: `cadence-core/bin/planning.test.mjs:751-899` asserts
  `r.roadmap.now` and deep-equals `r.reqs` across nine cases;
  `cadence-core/workflows/verify.md:312-314` and
  `cadence-core/workflows/undo.md:48` describe the call;
  `.planning/DOCS-CLAIMS.md:1002,1057` pin both prose rows as accurate.
  Rejected: `reqs: null` to mean "not written" (reddens the existing suite and
  silently changes what `/cad-verify` and `/cad-undo` read back, with both
  DOCS-CLAIMS rows going stale in a cycle that has no docs-verify pass
  scheduled); mirroring `renumber`'s `completed` array in the success envelope.

- D-05 (phase-done failure arm): `phase-done` takes the
  `stop-at-first-failure` discipline, and for a step failure the pre-flight
  could not see it emits its own partial envelope directly rather than through
  `fail()` or a shared `partial-apply` reason. Evidence:
  `cadence-core/bin/planning.mjs:210-211` (`fail()` carries only
  reason/detail/hint); `:6023-6042` (renumber bypasses `fail()` for exactly this
  reason - "the dispatch-level catch flattens to `internal`"); phase 1's D-02
  and D-03 in `cadence-core/bin/lib/file-transition.mjs`;
  `cadence-core/workflows/milestone.md:150` (prose owns `partial-prune` by
  name). If wrong: a post-first-write failure surfaces as
  `{"ok":false,"reason":"internal"}` with no record of which document moved -
  the undifferentiated envelope this phase exists to remove.

- D-07 (D-08 splits, it does not die): An UNREADABLE sibling manifest becomes a
  top-level `ok:false` refusal with nothing written, while a sibling that parses
  but whose `decideManifestBump` verdict is `refuse` keeps its `ok:true`
  `siblings[]` row. Evidence: `cadence-core/bin/release-bump.mjs:42-52` and
  `:187-208` (D-08 as shipped - the sibling refusal is recorded because "the
  primary write has already landed and unwinding it would need a transaction
  this seam does not have"); `cadence-core/bin/lib/release-decision.mjs:188-221`
  (`downgrade`, `not-an-upgrade`, `unparseable-version` are the
  readable-but-not-upgradeable arm); `cadence-core/bin/release-bump.test.mjs:251-266`
  (the arm AC5 protects); `.planning/ROADMAP.md:117-124`. Measured 2026-08-22
  (n=1) on a fixture with a trailing-comma `marketplace.json`:
  `{"ok":true,"action":"bumped",...,"siblings":[{...,"action":"refuse","reason":"unreadable-manifest"}]}`
  at exit 0, with `plugin.json` already at the new version and the CHANGELOG
  heading already dated. If wrong: collapsing both into a refusal deletes the
  arm AC5 protects; leaving both as rows leaves AC4 unmet.

- D-12 (no new arm on the primitive): Both callers' pre-flight conditions are
  written so `satisfied()` cannot throw - each condition catches its own I/O
  (e.g. `lstatSync(path, {throwIfNoEntry:false})`) - so `runTransition` does NOT
  gain a result arm for a throwing condition, and phase 1's module body stays as
  shipped apart from the JSDoc reword its own open item asks for. Evidence:
  `.planning/phases/1/SUMMARY.md:37-38` (both open items);
  `cadence-core/bin/lib/file-transition.mjs` (a throw from a condition
  propagates, matching `withPlanningFileLock`'s precedent with `fn`; the JSDoc
  at ~:124 promises "nothing is written"); `cadence-core/bin/planning.mjs:6489`
  already uses the non-throwing `lstatSync` form; `:6023-6026` (the dispatch
  catch flattens anything else to `internal`). Rejected: giving `runTransition`
  a catch arm that turns a throwing condition into a refusal, which edits phase
  1's module and its 12-case table. If wrong: an EACCES raised while answering
  "is REQUIREMENTS.md a regular file" escapes as `reason:"internal"` on the
  refusal path, where the phase claims nothing was written.

## Decisions

- D-02 (forcing the failure): The forced write failure in AC1's test is
  filesystem-shaped and uid-independent - the established "make the target a
  directory" idiom - because nothing in this tree can stub `atomicWrite`.
  Evidence: `cadence-core/bin/planning.test.mjs:137-149` (`run()` uses
  `execFileSync`, so every case spawns the real binary); no `mock.module` or
  custom loader anywhere under `cadence-core/bin/*.test.mjs`;
  `cadence-core/bin/milestone-prune.test.mjs:765-768` ("Forcing the failure
  needs no chmod and no root check"); `cadence-core/bin/route.test.mjs:1254`.
  Measured 2026-08-22 (n=1 each): `readFileSync(<dir>)` -> `EISDIR`,
  `renameSync(<file>, <empty dir>)` -> `EISDIR`. If wrong: the test reaches for
  `chmodSync`, a silent no-op under a root test runner, and the case pinning the
  whole phase passes vacuously in CI.

- D-06 (release-bump ordering): The whole write set - primary manifest, sibling,
  CHANGELOG - is read and decided into a plan before the first write, then run
  as one transition. `emit()` and every reason string stay in
  `release-bump.mjs` (phase 1's D-02). Evidence:
  `cadence-core/bin/release-bump.mjs:177-232` writes the primary, then reads the
  sibling, then reads the changelog; `:82` already imports from
  `./lib/planning-files.mjs`, so the lib path is proven;
  `.planning/ROADMAP.md:114-116`. Measured 2026-08-22 (n=1): with `CHANGELOG.md`
  unwritable the seam emitted `{"ok":false,"reason":"internal","detail":"EISDIR:
  ... rename 'CHANGELOG.md.<pid>.1.tmp' -> 'CHANGELOG.md'"}` while `plugin.json`
  on disk already read the new version - a partially bumped tree in an envelope
  carrying no `manifest`, `siblings` or `changelog` field at all.

- D-08 (sibling reason code): The sibling's unreadable case gets its own machine
  `reason` code, distinct from the primary's `unreadable-manifest`. Evidence:
  `cadence-core/bin/release-bump.mjs:42-52` ("`reason` carries a machine code on
  EVERY path ... so a caller branching on it never gets a token one run and a
  sentence the next"); `cadence-core/workflows/milestone.md:66-71` (the halt list
  enumerates reason codes by name); `.planning/DOCS-CLAIMS.md:881`. If wrong:
  `milestone.md`'s halt list names one token for two different files and the
  operator cannot tell which manifest to repair without opening both.

- D-09 (what "validated" means for the CHANGELOG): present, readable and a
  regular file - not a content grammar check - because the transform pass over
  it is pure and cannot fail. Evidence:
  `cadence-core/bin/release-bump.mjs:219-232` gates only on `existsSync`;
  `readText`'s `''`-on-failure contract at
  `cadence-core/bin/lib/seam-input.mjs:52-58` means an unreadable CHANGELOG
  scaffolds a fresh file over the old one; `prependChangelogEntry` and
  `promoteUnreleased` in `cadence-core/bin/lib/release-decision.mjs` return
  `{text,changed}` and never throw. If wrong: the CHANGELOG stays the one
  unvalidated member of the write set and keeps producing the measured
  `internal`-after-a-partial-bump envelope.

- D-10 (sibling set): "Every versioned sibling" stays the one hardcoded
  `.claude-plugin/marketplace.json` path - at most promoted to a declared
  one-entry `const` array so a second sibling is a data change - never a
  discovery scan. Evidence: `cadence-core/bin/release-bump.mjs:184-186`;
  `.claude-plugin/marketplace.json` carries no `version` key (inspected
  2026-08-22), so the shipped tree yields `no-version-field`/skip and the test
  fixture adds one (`cadence-core/bin/release-bump.test.mjs:52-54,251-254`). If
  wrong: the seam grows a file walk plus new refusal surface for files nobody
  declared, widening the phase past JRN-03.

- D-11 (prose moves with the code): `milestone.md`'s halt prose changes - both
  the `ok:false` reason list and the "Top-level `ok` stays true" sentence - so
  the same commit re-pins `weight-budgets.json` and refreshes the two
  DOCS-CLAIMS rows. Evidence: `cadence-core/workflows/milestone.md:63-74`;
  `cadence-core/bin/weight-budgets.json` (`cadence-core/workflows/milestone.md:
  14222`, a CEILING); `.planning/DOCS-CLAIMS.md:881-882` (MILESTONE-06,
  MILESTONE-07); phase 1's D-08. If wrong: self-verify reddens on the budgets
  check and AC7 fails, or the ledger keeps asserting a sibling refusal leaves
  `ok` true after the code stopped doing that.

- D-13 (no new enforcement rows): Two more adoptions need no new `HELPERS`
  census row, no CONTRACTS row and no new subcommand. Evidence:
  `cadence-core/bin/helper-census.test.mjs:186-210` matches the module BODY and
  states "never a call site - cmdRenumber and cmdMilestonePrune both
  legitimately CALL this module"; `cadence-core/bin/lib/arg-contract.mjs:505-509`
  (phase-done rows) and `:923` (release-bump rows) are unaffected by a
  write-ordering change; phase 1's D-06 (self-verify check 14 exempts
  `lib/*.mjs`). If wrong: a redundant census row reddens on the two new correct
  call sites, or a CONTRACTS entry appears for a module check 14 exempts.

## Acceptance criteria

- [ ] AC1: `planning.mjs phase-done --n <N>` against a fixture whose
      `REQUIREMENTS.md` is a directory returns `{"ok":false}` at exit 1 with a
      machine `reason` naming the unreadable requirements file, and
      `ROADMAP.md`'s sha256 is identical before and after the run.
- [ ] AC2: `planning.mjs phase-done --n <N>` against a fixture with no
      `REQUIREMENTS.md` at all returns `{"ok":true}` at exit 0 with the roadmap
      line boxed - absent and unreadable produce different envelopes.
- [ ] AC3: `phase-done`'s success envelope carries a field stating whether both
      documents were written or only the roadmap, and
      `node --test cadence-core/bin/planning.test.mjs` passes with every
      pre-existing `phase-done` case unedited.
- [ ] AC4: `release-bump.mjs bump --version <v>` against a fixture whose
      `.claude-plugin/marketplace.json` is present but unparseable returns
      `{"ok":false}` at exit 1, `plugin.json` still reads the OLD version, and
      `CHANGELOG.md`'s sha256 is unchanged.
- [ ] AC5: `release-bump.mjs bump --version <v>` against a fixture whose sibling
      parses but is not upgradeable returns `{"ok":true}` with a `siblings[]`
      row `action:"refuse"` carrying that verdict's own code, and
      `cadence-core/bin/release-bump.test.mjs:251-266` passes unmodified.
- [ ] AC6: `grep -n "all-or-nothing" cadence-core/bin/planning.mjs` either
      returns no hit inside `cmdPhaseDone`, or the hit sits below a pre-flight
      refusal - the claim and the behaviour agree.
- [ ] AC7: `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true`
      with an empty `problems` array.

## Flagged assumptions

- `phase-done`'s pre-flight covers the readability and regular-file shape of
  both documents, not the write-ability of their directory - Likely; if wrong:
  an unwritable `.planning` still produces a post-pre-flight throw and AC1's
  guarantee holds only for the shapes the tests drive. Evidence: phase 1's own
  flagged assumption that "planned write" means a pre-checkable condition, and
  `cadence-core/bin/planning.test.mjs:4163`, which forces its failure by
  `chmodSync` on the `.planning` ROOT - a condition no readability check sees.
- The NAME and shape of D-04's new envelope field is the planner's call; AC3
  pins that one exists and that the existing assertions survive, not what it is
  called - planner's judgment.
- `preflight` gets its first production caller in this phase, which is what
  phase 1's SUMMARY named as its justification - Likely; if wrong, both plans
  land without using it and phase 1's open item stands: the stage is dead
  flexibility to delete rather than a capability to keep.
