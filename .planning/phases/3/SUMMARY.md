---
phase: 3
status: complete
completed: 2026-09-06
---

# Phase 3: The store and its queries - Summary

The item store, decisions log, state snapshot, two-layer config, the `v3.7.12`
import and recall now live in the Rust binary behind one writer task, with
acknowledgement gated on `fsync` and a declined item proven unreachable from
recall across a warm index and two restarts.

## What shipped

- **The item store** - `crates/cadence/src/store/` (model, items, decisions,
  filesystem, writer, transaction). Single writer task owns it; zero lock
  primitives in the whole directory.
- **Write-then-ack durability** - the reply is sent only after the temp file
  and its containing directory are both `fsync`ed, proven by syscall ordering
  with each `fsync` omitted in turn as a paired negative control.
- **Two-layer config with revalidation** - `crates/cadence/src/config/`.
  Effective config is re-read before every mutating request commits; a failed
  reload fails closed rather than preserving stale permission-like settings.
- **The `v3.7.12` import** - `crates/cadence/src/import/`. Runs on first touch,
  writes beside the old files, removes nothing, and names all eight retired
  config keys in a warning.
- **Recall over records plus prose plus git** - `crates/cadence/src/recall/`.
  One query returns hits from both a structured record and an authored markdown
  document; pruned phases are read from git history with explicit
  incomplete-coverage reasons when git cannot answer.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | `f2229648` | records preserve identity and validate persisted integrity |
| 1 | 2 | `650df675` | each writer reply follows durable disk confirmation |
| 1 | 3 | `0856ba04` | declined identities cannot enter recall projections |
| 1 | 4 | `fd26ea18` | durable decisions preserve provenance and unknown effort |
| 1 | 5 | `2fd025d9` | external edits prevent replacement of owned generations |
| 1 | 6 | `3e1fd87f` | interrupted multi-file operations recover before reads |
| 1 | 7 | `57d03ad1` | process kills leave complete old or new target bytes |
| 1 | 8 | `b71eeb7c` | syscall fixture rejects acknowledgements missing synchronization |
| 2 | 1 | `b4adfe41` | effective layers preserve provenance and exclude retired settings |
| 2 | 2 | `49479f67` | mutations revalidate current source bytes and policy |
| 2 | 3 | `0851c60c` | validated updates persist through the store transaction |
| 2 | 4 | `b5747d9b` | legacy items retain source evidence and declined precedence |
| 2 | 5 | `31f3d7e8` | cursor and decision evidence survive without activity logs |
| 2 | 6 | `5f443abf` | first touch durably migrates frozen planning data and recovers interruptions |
| 2 | 7 | `9abb862c` | resident policy changes preserve store integrity after migration |
| 3 | 1 | `ff5d0be7` | deterministic results exclude declined identities |
| 3 | 2 | `13f83a20` | authored prose and stored captures share one response |
| 3 | 3 | `68120332` | pruned memory has git citations and honest coverage |
| 3 | 4 | `ee282333` | resident handles share current store and query state |
| 3 | 5 | `16c69f0b` | warm declines and mixed-source memory survive restart |

Planning-doc commits in the same range, not task work: `d17c1a9f` (phase 2 and
3 run reports), `fb0146c3` (the no-lock scoping ruling), `c99197a5` (the plan 3
run record).

Every commit is GPG-signed as `John Crenshaw <john@jcrenshaw.dev>`.
`cadence-core/` is byte-identical to `v3.7.12` throughout.

## Deviations

- [deviation] **Locked decision D-05 was FALSE and was rewritten**, caught by
  the criterion-falsification pass before execution began (42 existing-code
  criteria examined, 1 FALSE, 0 noise). D-05 claimed crash atomicity was "newly
  testable BECAUSE of write-then-ack". It was not: frozen `atomicWrite` is
  `writeFileSync(tmp)` then `renameSync(tmp, file)`
  (`cadence-core/bin/lib/planning-files.mjs:2787-2788`), `rename` is atomic, so
  old-or-new against a PROCESS KILL already held at `v3.7.12` - the frozen
  comment at `:2749` says so outright. **Process kill and machine crash were
  conflated.** What write-then-ack actually buys is durability: without `fsync`
  a power loss can land the rename with the data not yet on disk. AC4 was kept
  and re-labelled a regression guard; **AC8 was added** for the real property.
  Corrected in `a486fe32`. The claim came from the ROADMAP's own phase 3 entry,
  which still carries the conflation.

- [deviation] **The "no lock primitive anywhere" constraint was too broad and
  was scoped**, on John's ruling, in `fb0146c3`. PLAN-3 stopped rather than
  proceed against a locked decision after finding `tokio::sync::Mutex` at
  `import/mod.rs:447` (session map), `Arc<Mutex<..>>` at `import/mod.rs:355`
  (first-touch import) and `config/reload.rs:217` (shared config). The
  decision's ARGUMENT is about the store's write path - the queue serializes,
  therefore the store needs no lock - and never reached shared state outside
  it. Verified at the ruling: `crates/cadence/src/store/` contains zero lock
  primitives, so the store honors it exactly. Config and the session map need
  synchronization because the resident process is shared by the main thread and
  every subagent by design.

- [deviation] **A fixture-path defect failed Task 6 and was fixed at its
  cause.** The archive helper ran with `crates/cadence` as its working
  directory, so `.planning` did not resolve to the frozen tree's path and AC5
  never reached import - 3 tests failed against a predicted 32 passes. Fixed by
  deriving the repository root deterministically instead of inheriting the
  caller's cwd. **This is the third instance of the same class**, after phase
  2's recordings that only reproduced on a machine rooted at `/code/cadence`
  and the Node suite that only passed with `TMPDIR` outside the repo. A
  provenance assertion was added at the same time, so a silently-empty
  extraction can no longer let the import "succeed" against nothing.

- [deviation] **AC8 passes only because `strace` was installed mid-phase.** It
  was tagged `(human-verify: needs strace)` in CONTEXT.md when the probe found
  the binary absent, the test failed loudly with `BLOCKED AC8` rather than
  skipping, and `strace 7.0` was installed on 2026-09-06 to clear it. A machine
  without `strace` will see this one criterion red. `ptrace_scope` is 1, which
  still permits tracing a spawned child, so the binary is the only requirement.

## Open items

- **The seven `UNSETTLED` config keys were ruled by the executor, not by John.**
  Six dispatch-token settings retired; `planning.max_capture_bullets` retained
  as a report-only count of active item identities that never refuses a
  capture. That changes the key's UNIT, so a value set under the old meaning
  counts differently now. Recorded in `.codex-analysis/config-key-census.md`.

- **Phase 3 declares 8 acceptance criteria against a ceiling of 7**
  (`criteria-size` reports `context-criteria-too-many`). Reported, not gated,
  since AC8 was added mid-phase.

- **`/cad-execute` was bypassed for this phase**; Codex executed each plan
  directly. The receipts it would have written - this SUMMARY, the cursor, the
  commit manifest - were produced by hand afterwards, and were briefly missing
  entirely. Any future phase run this way owes the same follow-through.

- **No phase owns the documentation rewrite.** `README.md`, `DESIGN.md`,
  `METHOD.md`, `INTERNALS.md`, `docs/WORKFLOW.md` (~136KB) and the 1,503-line
  `.planning/DOCS-CLAIMS.md` ledger appear nowhere in the 17-phase roadmap.
  `INTERNALS.md` documents internals being deleted, and decision 13 drops
  `/cad-docs-verify`, which is the checker for that ledger.

## Goal check

The goal was "the basic data functions live in the binary; nine operational
files become three plus config, and every one of them is written by the binary
alone." The twenty commits deliver the store, the decisions log, the state
snapshot, the two-layer config merge, the import and recall, with 89 workspace
tests passing and clippy clean under `-D warnings`.

What is NOT established here, and must not be read as established: nothing is
wired to a skill yet, so "written by the binary alone" is true of the binary's
own paths and is not yet enforced against the workflows - phase 5 owns the
typed boundary and phase 15 owns the residual prose obligations. The three
obligations the phase set itself are met: the declined-item test exists and
holds across a warm index and two restarts, config revalidates before every
mutating request and fails closed, and the import runs on a real pre-`4.0`
tree extracted from the frozen tag with its provenance asserted first.
