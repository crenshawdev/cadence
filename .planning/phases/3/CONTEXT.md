# Phase 3: The store and its queries - Context

Gathered: 2026-09-06
Feeds: /cad-plan 3

## Scope boundary

In: The item store, the decisions log, the state snapshot, the two-layer config
merge, the `v3.7.12` import, and recall as a query over the store plus git.
Nine operational files become three plus config, and every one of them is
written by the binary alone. The shape is settled and is not reopened at plan
time: sync pure core, I/O at the edge behind a trait, no tokio types in domain
logic, one writer task owning the store with callers awaiting their own
completion, and a write acknowledged only after it is confirmed on disk.

Out: Phase state derived from disk and the evidence set (phase 4). Dispatch
selection and the binary's own tool surface (phase 5). The skill surfaces that
compose these (phases 9-14). The release path and the SessionStart bootstrap
(phase 17). Any change to `cadence-core/`, which stays frozen and
byte-identical to `v3.7.12`.

Deferred: None.

Plan shape: multiple plans, same phase. Three seams: the store itself
(AC1-AC4), config and import (AC5-AC6), recall (AC7); the store lands before
the other two. **Executed through Codex rather than `/cad-execute`**, on John's
2026-09-06 ruling. The size outcome above is the recommendation carried
forward - the size question was answered with the execution vehicle instead, so
it stands until corrected.

## Durable decisions

- D-01 (Store integrity): A hand edit made outside the binary is detected and
  reported as a conflict; the binary refuses the mutating request rather than
  repairing or overwriting it. Collapsing the three-file split moves the
  declined-item guarantee from structure to a query filter, and this is what
  keeps the guarantee observable. Evidence: `.planning/ROADMAP.md:258-263`
  (OQ-3); `.codex-analysis/storage-model-inventory.md` (other writers do not
  honor the binary's ownership). If wrong: the store silently absorbs
  corruption and OQ-3's guarantee is lost with no error surfaced.
  **Bounded 2026-09-06, on the phase 3 planning pass:** detection is best-effort
  AT THE CHECK POINT, not a guarantee across the whole operation. An edit
  landing between validation and replacement is unsatisfiable to exclude under
  this filesystem model, and independent session writers share that gap. AC3
  tests the ordinary case and must not be read as promising the total one.
- D-02 (Config): Effective configuration is revalidated before every mutating
  request commits, and a failed reload never preserves permission-like settings
  as if current. A resident process merges once at startup, which deletes the
  per-invocation reconstruction `config-merge.mjs:187` pays but introduces
  external edits, `git checkout` and rebase as new failure modes. Evidence:
  `.planning/ROADMAP.md` phase 3 obligation 2;
  `.codex-analysis/storage-model-inventory.md:182`. If wrong: a stale
  protected-branch or `git.on_protected` value authorizes a write the user had
  already revoked.
- D-03 (Import): The `v3.7.12` import runs automatically on first touch of a
  pre-4.0 `.planning/`, writes the new store beside the old files, and removes
  nothing. The user hand-edits nothing. **Corrected 2026-09-06:** this
  originally said the user "can revert by `git checkout`", which is false - the
  import writes UNTRACKED files and `git checkout` does not remove them.
  Reverting an import means deleting what it wrote, so the import must state
  what it created plainly enough that a user can undo it by hand.
  Evidence: `.planning/ROADMAP.md` phase 3 obligation 3. If wrong: a one-way
  migration destroys the original bytes outside git.
- D-04 (Recall): Recall indexes both the store's structured records and the
  documents that stay markdown (PROJECT, ROADMAP, CONTEXT, SUMMARY). Evidence:
  `.planning/PROJECT.md` Core Value - deviations and decisions must come back on
  their own, and those live in authored prose;
  `.planning/REQUIREMENTS.md` (BM25 recall over `.planning/` artifacts,
  v1.1.0-rc.1). If wrong: a decision written into a CONTEXT.md stops coming
  back, which is the project's stated core value failing silently.

## Decisions

- D-05 (Store integrity): A crash mid-write leaves the complete old value or the
  complete new one, never a torn one - and the acknowledgement is sent only
  after the bytes are `fsync`ed, the temp file and then its directory.
  **Corrected 2026-09-06 by the falsification pass.** This decision originally
  read "newly testable BECAUSE of write-then-ack", which is FALSE: frozen
  `atomicWrite` is `writeFileSync(tmp)` then `renameSync(tmp, file)`
  (`cadence-core/bin/lib/planning-files.mjs:2787-2788`), and `rename` is atomic,
  so old-or-new against a PROCESS KILL already holds at `v3.7.12`. The frozen
  comment says so itself at `:2749` - "no lock, no `O_EXCL` retry and no `fsync`
  here - the promise is only that a crash never leaves a torn file."
  **What write-then-ack actually buys is DURABILITY, a different failure
  model:** with no `fsync`, a power loss can land the rename with the data not
  yet on disk, leaving a truncated file. Process kill and machine crash were
  conflated. Evidence: `.planning/ROADMAP.md` phase 3, "What is genuinely
  testable here" (which carries the same conflation);
  `.codex-analysis/plan-3-falsification.md`.
- D-06 (Import): The eight dead config keys are warn-and-dropped by name at
  import, never carried as inert settings - the four `parallelization.*`, the
  three `review.triggers.phase_diff.*`, and `git.auto_close`. Evidence:
  `.codex-analysis/config-key-census.md` (94 keys: keep 0, keep-resemantic 79,
  rename 0, dead 8, UNSETTLED 7); `.codex-analysis/premise-audit.md:231`;
  `.planning/ROADMAP.md:57` (the four `parallelization.*` keys and the
  `phase_diff` trigger, dropped outright); `.planning/ROADMAP.md:69-70` and
  `:846` (`git.auto_close` retired - no path publishes or merges without an
  explicit yes). If wrong: `git.auto_close=true` survives import as a false
  promise of standing publish authority.

## Acceptance criteria

- [ ] AC1: Appending an item and then reading the store returns it in append
      order, and a rewritten snapshot survives a restart of the binary.
- [ ] AC2: A declined item is absent from the output of a recall query whose
      terms match its text.
- [ ] AC3: Editing the store outside the binary and then issuing a mutating
      request produces a reported conflict, no write occurs, and the file's
      bytes are unchanged.
- [ ] AC4: Killing the binary mid-write leaves the target file holding either
      the complete old value or the complete new value, never a partial one.
      (Regression guard on the Rust side, not a new property - `v3.7.12`
      already satisfies this through `rename`. See D-05.)
- [ ] AC8: The acknowledgement for a write is sent only after that write is
      `fsync`ed - the temp file before the rename, then the containing
      directory. Falsifiable by ordering: a trace of the syscalls a single
      acknowledged write performs shows both `fsync` calls before the reply,
      and removing either one makes the check fail. This is the property
      write-then-ack actually adds, and no crash harness is needed to check it.
      (human-verify: needs strace) - probed 2026-09-06, `strace` is NOT
      installed on this machine. `ptrace_scope` is 1, which still permits
      tracing a spawned child, so installing `strace` is sufficient; the gap is
      the binary, not the policy.
- [ ] AC5: Running against a pre-4.0 `.planning/` taken from the `v3.7.12` tag
      produces a store with no hand edit, leaves the original files present, and
      names all eight dead config keys in a warning.
- [ ] AC6: Changing a config file between two mutating requests causes the
      second to run under the new value; making a config file unreadable causes
      the mutating request to fail rather than proceed on the cached value.
- [ ] AC7: A single recall query returns hits from both a structured record and
      an authored markdown document.

## Flagged assumptions

- The seven `UNSETTLED` config keys in `.codex-analysis/config-key-census.md` -
  measurement and reporting settings whose 4.0 meaning depends on decisions not
  yet made. Left to the planner on John's 2026-09-06 ruling; if wrong: a
  preserved dispatch-token limit reads as an enforced budget when it was only
  post-run reporting, and a bullet ceiling reads as enforced with no defined
  unit.
- GH-241 is homed to this phase: `lib/trace.mjs:1752-1757` accepts any nonempty
  observed effort string, whitespace included. Unclear whether it is fixed here
  or rides the phase that owns the trace surface; if wrong, the defect ports
  forward into the new store.
- **Declined precedence changes old recall answers, deliberately.** At the
  frozen tag an item can appear in both `FILED` and `DECLINED`; ruling
  declined-wins to satisfy AC2 means items recall used to return now vanish
  from it. Accepted as the cost of AC2, recorded so it is not later read as a
  regression. Surfaced by the phase 3 planning pass, 2026-09-06.
- The analyzer pass was SKIPPED for this phase. The gate's own three arms
  pointed to dispatch (zero seeded requirements, two surfaces named by path,
  priors not covering the store), and it was skipped anyway because
  `.codex-analysis/storage-model-inventory.md` had already bought that pass out
  of band on 2026-09-06. If that report is wrong, nothing here re-derived it.
