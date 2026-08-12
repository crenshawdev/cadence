---
phase: 1
status: complete
completed: 2026-08-12
---

# Phase 1: The accounting the trace still misses - Summary

A `coordinator` lifecycle marker written at each named step of `/cad-context` and `/cad-plan`, from which `renderTrace` derives the coordinator's own unbracketed time, plus a spend gate that settles whether to buy the assumptions-analyzer pass before the resolve that would bracket it.

## What shipped

- Coordinator marker in the lifecycle vocabulary - `COORDINATOR` exported from `cadence-core/bin/lib/trace.mjs`, `--step` on `trace append`, refused bare/blank as `bad-args`; the rule that a marker carries no `--tokens` and no `--role` is held by the prose census in `cadence-core/bin/trace.test.mjs`, not by a runtime refusal, so the append seam stays event-agnostic and `return`/`checkpoint`/`escalation` keep storing tokens identically (PLAN-1 task 1, D-03, D-07)
- Verbatim's phase-1 run record as a committed fixture - `cadence-core/bin/fixtures/verbatim.trace.jsonl`, byte-for-byte, with both readers pinned against it as literals
- The `coordinator` block in `renderTrace` - `wall_ms`, `bracket_ms`, `residue_ms` and a time-ordered `steps[]`, keyed by phase, overlaps unioned before subtraction, residue floored at zero, and absent entirely on a trace written before this phase
- `trace suggest` R6 - an `info` entry for the coordinator above a 10-minute residue floor, reading the render's figures rather than recomputing them
- `/cad-report`'s `Record health:` line reporting the residue and its heaviest step, and nothing at all when the block is absent
- `<step name="spend_gate">` in `cadence-core/workflows/context.md`, between `load_priors` and `analyze`, with the `references/recall.md` deferred read re-anchored onto it
- `load_priors` reading prior phases' SUMMARY `## Deviations`, so a phase already grounded by a prior phase's findings can reach CONTEXT.md without the analyzer
- The size question and the spend question stated as two distinct questions across all four surfaces, pinned by a test in `cadence-core/bin/prose-agreement.test.mjs`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | e6edc60 | Coordinator marker in the lifecycle vocabulary and the append seam |
| 1 | 2 | cb933fa | Verbatim's trace committed as a fixture; both readers pinned against it |
| 1 | 3 | f4105d4 | Per-step coordinator residue computed in `renderTrace` |
| 1 | 4 | 1c81054 | `trace suggest` reads the coordinator block |
| 1 | 5 | 738d750 | `/cad-report`'s record-health line reports the residue |
| 1 | 6 | e011fd4 | The coordinator writes a marker at each step it can name |
| — | — | ab80df9 | (not a plan task) `/cad-phase edit 3` - TUN-01 added to phase 3 mid-run |
| 2 | 1 | 8df2a1f | `load_priors` reads prior phases' deviations |
| 2 | 2 | c604fcb | A spend gate before the analyzer resolve |
| 2 | 3 | db3f633 | Every surface states one size question AND one spend question |
| 2 | 4 | f307393 | The gate's position and the four surfaces' agreement pinned by a test |
| 2 | 5 | 2b0f488 | The `DOCS-CLAIMS` rows this phase's line shifts moved, re-pinned |
| 2 | — | d100e52 | Checkpoint remedy: `deferred-reads.test.mjs` declared in PLAN-2's lease |
| 2 | — | aae6ee1 | Checkpoint remedy: the register transcription follows the anchor to `spend_gate` |

Range `cf090f9..aae6ee1`, 14 commits.

## Deviations

- [deviation] Plan 1 task 2: the plan's Action asserted the fixture is "all 40 lines" from D-12's 2026-08-12 measurement. The live file was 52 lines / 10,703 B - verbatim's phase 2 kept running between the measurement and the copy. Copied byte-for-byte as written rather than truncated, since what D-12 locks is "byte-for-byte, unredacted", and the phase-1 slice the pins read is unchanged. Redaction claim re-verified against the current bytes. D-12 annotated in CONTEXT.md. (cb933fa)
- [deviation] Plan 1 task 6: the task asserted `context.md` would exceed its budget row and force a re-pin. The standing instruction is 627 B against 651 B of headroom, so it landed 24 B under and the check never fired. Re-pinned to the measured value anyway, as the task directed. D-16 itself is NOT refuted - its claim was about the spend gate's prose, which did exceed, three times, in plan 2. (e011fd4)
- [deviation] Plan 2, structural checkpoint: the plan's `files:` lease was incomplete for its own task-2 Action. Re-anchoring the `cad-context` / `references/recall.md` register row from `analyze` to `spend_gate` breaks two assertions in `cadence-core/bin/deferred-reads.test.mjs` - `REGISTER_SOURCE`, a deliberate byte-for-byte transcription of the register block, and `assertPromotedRow(...)`, which named the old anchor as a literal - and that file was not in the lease, so `lease-check` refused the fix. The plan's three named verify commands did not cover the file; the break appeared only under the full suite. Resolved by the orchestrator rather than a third executor dispatch, the fix being a six-line transcription the checkpoint had already specified exactly: the lease was amended to declare the file (d100e52), then the two assertions followed the rename (aae6ee1). Full suite 1415/1415, `tsc -p tsconfig.ci.json` clean, `self-verify` clean.

## Open items

1. AC3 is human-verify and is now walkable. Steps: (1) `cd` into a project with Cadence installed, (2) run `/cad-context <N>` then `/cad-plan <N>` on any phase so the markers are written, (3) run `/cad-report <N>` and confirm the `Record health:` line names a coordinator residue in minutes plus the step carrying the most of it, (4) run `/cad-report` on a phase whose trace predates this phase and confirm the line mentions no residue at all.
2. AC5 is human-verify and is now walkable. Steps: (1) `cd` into a project with Cadence installed, (2) run `/cad-context <N>` on a small phase, (3) at the "Analyzer" question answer "Skip it", (4) confirm `.planning/phases/<N>/CONTEXT.md` was still written, (5) run `node cadence-core/bin/planning.mjs trace render --phase <N>` and confirm no `lifecycle/dispatch` and no `routing/resolve` event names `cad-assumptions-analyzer` for that phase.
3. AC6 is human-verify with no machine arm. Steps: (1) `cd /data/code/verbatim`, (2) run `/cad-context 2`, (3) at the "Analyzer" question read the annotation and confirm it presents six named surfaces as its evidence, (4) confirm the recommended (first) option is "Dispatch it", not "Skip it". CONTEXT D-13 records that the skip arm ships with no positive fixture evidence.
4. Markers ride `context.md` and `plan.md` only, so `/cad-report` prices the coordinator across `/cad-context` and `/cad-plan` and says nothing about the `/cad-execute` and `/cad-verify` half - on the fixture, a further ~18 minutes between the reviewer's return and the verifier's resolve. Extending the standing instruction to `execute.md` and `verify.md` is one line each plus two budget re-pins. Deliberately not built.
5. `CONTEXT-06`'s claim text names a written `trace append ... --event dispatch` invocation, and `context.md` has folded that half onto the resolve's `--bracket-read` since before this phase opened. Only the line was re-pinned; the claim as stated is still true of the seam. Left for the next `/cad-docs-verify` sweep.
6. No new `DOCS-CLAIMS` row was added for the `spend_gate` step. Extracting claims from a surface is `/cad-docs-verify`'s job.
7. `workflow.lint_command` is unset and `detect-commands --root /data/code/cadence` returns `lint:null, typecheck:null`, so Cadence finds no static-analysis command for its own repo even though `tsconfig.ci.json` ships in the tree and CI runs it. Both plans ran `npx tsc -p tsconfig.ci.json` directly. Pre-existing.
8. Plan 2's three named verify commands were all green while the full suite was red. A plan whose Action mandates editing a file that another file transcribes byte-for-byte should declare both, and its verify line should reach the suite that covers them.

## Goal check

The phase goal has two halves and both landed, with one qualification on reach. The pricing half is real end to end: `COORDINATOR` is in the vocabulary (`cadence-core/bin/lib/trace.mjs`), `--step` reaches it through `trace append` and is refused bare or blank, with the no-`--tokens`/no-`--role` rule held by the prose census rather than a runtime refusal (PLAN-1:89), `renderTrace` emits a `coordinator` block whose `residue_ms` is wall time minus the union of bracket spans (`f4105d4`), `trace suggest` reads that block at R6 above a 10-minute floor (`1c81054`), and `/cad-report`'s `Record health:` line reports it (`738d750`). Criterion 2's back-compat arm is machine-proven rather than asserted: `cadence-core/bin/fixtures/verbatim.trace.jsonl` renders with no `coordinator` key at all and its pinned suggestion list is unchanged, both as literals in `trace.test.mjs` and `trace-suggest.test.mjs` (`cb933fa`). The qualification is open item 4: markers ride `context.md` and `plan.md` only, so the coordinator is priced across `/cad-context` and `/cad-plan` and is still invisible across `/cad-execute` and `/cad-verify` - on the fixture, about eighteen further minutes. The goal says "the run record prices the coordinator", and today it prices two of its four spending commands. The sizing half also landed: `<step name="spend_gate">` sits between `load_priors` and `analyze` in `cadence-core/workflows/context.md`, ahead of the resolve that brackets the analyzer, and `prose-agreement.test.mjs` pins that ordering positively - the test was falsified live by moving the block below `analyze` and watching it fail (`f307393`). `load_priors` now reads prior phases' SUMMARY deviations (`8df2a1f`), which is the "already grounded" arm criterion 3 names. What no commit can show is criteria 3's and 4's behavioral end: whether a small phase actually reaches CONTEXT.md with no analyzer dispatch in the trace, and whether verbatim phase 2's shape still resolves to "Dispatch it". Both are human-verify walks, listed as open items 2 and 3, and CONTEXT D-13 already records that the skip arm ships with no positive fixture evidence - across 21 archived Cadence phases plus verbatim's two, no phase would have taken it. That is the honest gap: the gate is proven to exist and to sit in the right place, and is not yet proven to change an outcome.
