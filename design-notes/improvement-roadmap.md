# Cadence improvement roadmap — determinism ladder rollout

Status: ALL PHASES (1–8) EXECUTED 2026-07-15 on branch improve/planning-seam
(commits e3345fc..5a7b35e, 70 tests green). Phase 8 note: review-provider's
main() is now guarded so its pure helpers import cleanly; wire paths stay
untested by design (no network in the suite); CI runs node --test on Node
20/22.
Deviations from planning-mjs-interface.md, all recorded in commit messages:
audit has no --milestone flag (no pinned milestone marker; the model filters),
uat record gained --result pending for the fixed-failure retest flow, the
paused cursor needed no fifth line (Next: is the resume pointer), and the
push hook asks instead of hard-blocking so cad-land's user-approved push
still works. Companion: planning-mjs-interface.md (the seam contract).

Principle being rolled out: **judgment stays prose, invariants move to
scripts, inviolable rails move to hooks.** Every phase below is one rung of
that move, ordered so each phase lands green and useful on its own.

## Standing conventions (adopt now, apply everywhere)

These are the "expandable and scale" rules — cheap now, compounding later:

1. **One grammar, one place.** Every `.planning` file format is parsed/written
   only in `bin/lib/planning-files.mjs`. A format change is one function + its
   tests. No workflow prose ever describes file mechanics again.
2. **Additive-only output.** Seam JSON fields are never renamed or removed,
   only added. Callers (workflow prose) never break on a script upgrade.
3. **Dispatch tables, not if-chains.** planning.mjs subcommands live in a
   registry object (the ADAPTERS pattern from review-provider.mjs). Adding a
   subcommand is additive — new entry + tests, zero edits to existing code.
4. **One pass per file.** When a workflow is converted to call the seam, its
   cold-branch split (context work) happens in the SAME edit. Never touch a
   workflow file twice for this effort.
5. **Contract-first TDD.** The JSON shapes in planning-mjs-interface.md are
   the spec; tests go red before implementation, per subcommand.
6. **The ladder is a checklist.** Any future skill/workflow addition answers:
   judgment → prose, invariant → script subcommand, rail → hook. (Candidate
   for a short DESIGN.md section once the rollout proves it.)

## Phases

### Phase 1 — Pin the formats
The parsers need frozen grammars before TDD starts.
- Add `Deferred` as a legal REQUIREMENTS traceability Status value
  (templates + conventions.md + audit.md wording).
- Confirm/pin the UAT.md item schema in templates/UAT.md (fields `record`
  and `merge` depend on: status, first_pass, source, severity, reason, fix).
- Pin the cursor's optional pause-note line format.
Success: every field the seam reads/writes is named in a template or
conventions.md. No code.

### Phase 2 — Seam foundation
- `bin/lib/planning-files.mjs`: parsers/writers for cursor, ROADMAP phases,
  REQUIREMENTS table, UAT, SUMMARY hashes. Unit tests (edge cases: CRLF,
  malformed tables, missing files).
- Test fixture builder `makeTree()`.
- planning.mjs CLI skeleton (dispatch table, seam contract: one JSON line,
  0/1 exits, --dir, atomic writes) + `status` + `cursor` subcommands.
Success: `node --test` green; `status` and `cursor` match the interface note
byte-for-byte on fixture trees.

### Phase 3 — High-traffic subcommands
- `phase-done` (+ `--undo`), `uat init/refresh/record/merge/status`.
- Invariant tests are the deliverable: first_pass set-once, user results
  unoverwritable, counts always consistent, atomic writes.
Success: the full verify.md persistence contract runs through the seam on
fixtures.

### Phase 4 — Gate + destructive subcommands
- `audit` (the trace joins), `renumber insert/remove` with `--dry-run`.
- `renumber` tests include: dry-run touches nothing, collision-safe mv order,
  orphaned reqs flagged never dropped, sanity recount.
Success: audit output on a broken fixture names every break; renumber
round-trips (insert then remove) leave a tree identical to start.

### Phase 5 — config seam completion
- `config.mjs get` with the layered merge; extract the merge into
  `bin/lib/` shared with route.mjs (drift-proof).
- Harmonize failure exit codes across all seams (JSON contract unchanged).
Success: `get` returns effective values with a global layer present; route
and config share one merge function.

### Phase 6 — Workflow conversion (the payoff)
Convert one workflow at a time to call the seam, deleting obsoleted prose and
splitting cold branches in the same edit (convention 4). Order by traffic:
1. progress.md (status/cursor) — biggest immediate shrink
2. verify.md (uat family + phase-done) — split `--sweep`/`--deep` out
3. plan.md (status/cursor) — split `--gaps` out
4. execute.md, context.md, coverage.md (status/cursor reads)
5. audit.md (audit), phase.md (renumber), undo.md + milestone.md (phase-done
   --undo, cursor)
6. config.md — convert to `config.mjs get`, split provider-assignment flow out
Success per file: workflow calls the seam, mechanics prose gone, cold
branches in sub-files, behavior unchanged (spot-check on a fixture project).

### Phase 7 — Hooks: the inviolable rails
- Plugin `hooks.json`: PreToolUse blocking `git push` and commits to
  protected branches during Cadence work.
- Delete the repeated "never push (rail 3)" / guard prose from every
  workflow (references/git.md keeps the canonical statement).
Success: a push attempt is blocked by the harness with a clear message;
workflows no longer restate the rails.

### Phase 8 — Debt sweep (optional, anytime after 5)
- review-provider.mjs tests (adapters/validators are pure functions).
- CI: one GitHub Action running `node --test`.
- JSDoc + `// @ts-check` across all bin/ (adopt in Phase 2 for new code;
  backfill existing scripts here).

## Dependency notes
- 1 → 2 → 3 → 4 are strictly ordered (formats → parsers → subcommands).
- 5 is independent after 2 (shares lib/).
- 6 requires whichever subcommands the target workflow uses (progress needs
  only Phase 2; verify needs Phase 3; audit/phase need Phase 4).
- 7 is fully independent — can land any time.
- Nothing here touches agents/, references (except git.md trims), or the
  judgment prose.

## Scale ledger (why this order)
- Phases 2–3 unlock the two largest recurring savings first: `status`
  (~2–3k → ~200 tokens × every spine command) and the UAT walk
  (~800 → ~40 tokens × every item × every phase).
- Conversion (6) starts with progress.md because it needs only Phase 2 —
  earliest possible end-to-end proof on a real project.
- renumber/audit last among subcommands: most destructive + gate-critical,
  built when the parsers are battle-tested.
