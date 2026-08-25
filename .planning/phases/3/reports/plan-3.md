PLAN CHECKPOINT: structural
Plan: .planning/phases/3/PLAN-3.md
Tasks: 3 of 3
| Task | Commit | Note |
|---|---|---|
| 1. The phase close stops routing open items into the transient queue | 312e8cbf | `workflows/execute.md`'s summary step no longer files open items into `.planning/CAPTURE.md`; it states that an open item lives in `phases/<N>/SUMMARY.md`'s `## Open items` and nowhere else, with `parseSummarySnippets` and the measured 42.4677/31.1468 recall pair as the reason, and names the close (`phase-done`'s `capture` field, printed by `workflows/verify.md`) as where a surviving item is disposed of. The `state` step now stages `.planning/CAPTURE.md` only when the summary step's debt harvest reported `written`. `grep -n "capture --kind"` returns nothing; `debt-harvest` invocation intact at :467. Budget re-pinned 30927 -> 31450. Seven `(phase 3)` bullets removed from `.planning/CAPTURE.md` (gitignored, rides untracked; pre-edit copy at /tmp/CAPTURE.md.pre-plan3.bak); each was proved present in `phases/3/SUMMARY.md` FIRST by `grep -F` on a distinctive clause - live-forge-check.md (1), issue-filing.mjs unfixed (2), phase-done.mjs:127 (1), phase-wide (1), 30 substantive bullets (1), summary step still routes (1), incomplete-lookup (1). `capture-check`: substantive 31, Todos 21, Seeds 10, Notes 0, down from 38. `grep -c "(phase 3)"` returns 0. self-verify 0 problems; prose-agreement + self-verify 212 pass; tsc exit 0. |
| 2. The check that would have caught it | d04e7605 | `lib/capture-writers.mjs` is the pure rule (no disk, no emit, no exit, no clock) carrying a frozen 4-row REGISTER and `captureWriterIssues(surface, text, rows = CAPTURE_WRITERS)`. Two shapes read as ISSUING a write: `planning.mjs <capture\|debt-harvest>` in an EXECUTED form (a `node` command word before it on the line, or a `--flag` after it), and a shell redirect whose target is `.planning/CAPTURE.md` (found by walking backwards over the characters, so a backtick stops the walk). Three kinds: `capture-writer-unregistered`, `capture-writer-durable`, `capture-writer-redirect`. Wired as self-verify check 23 in the per-surface loop beside check 19's call, applying to every surface the walk yields; `checked` now ends `refusal-hints, capture-writers`. Census row `capture-writers-register` added to `lib/census-registry.mjs` with its `CADENCE-CENSUS` marker in the test, subjecting the new module alone. capture-writers.test.mjs 13 pass, including the REPLAY of the retired block carried verbatim from `0169ef62` - reported against an empty row set and again against a row classifying it durable - while `debt-harvest` on its own row is silent (and reported without it), `capture-check`/`capture-sections` are silent, a backticked mention is silent, `>`/`>>` at the path are each reported, and a redirect elsewhere plus a bare-filename mention are silent. self-verify.test.mjs 168 pass; census-registry + planning-lease-check + capture-writers 49 pass; self-verify 0 problems; tsc exit 0. |
| 3. The capture contract names who may write the file | 61683a20 | `references/capture-grammar.md`'s `## Todos` writer cell no longer credits `/cad-execute`'s open items, and a new `## Who may write this file` section states the writer set's one home (`lib/capture-writers.mjs`), what self-verify reports, the accumulate test, and where a phase's open items live instead - pointing at `references/triage-gate.md` for the removal rule rather than restating it. `## Debt markers`, the D-03 paragraph, the `## Archive` paragraph and everything below `## The bullet` untouched. `grep -n "cad-execute"` returns nothing; `grep -n "capture-writers"` returns :63. Budget re-pinned 7639 -> 9114. self-verify 0 problems; tsc exit 0. Whole suite: 3215 tests, 3214 pass, 1 fail - see the checkpoint below. |
Deviations: none
Open items:
- The plan's task 2 Action named THREE live write sites to seed the register; the tree carries FOUR. `cadence-core/references/conventions.md:49` has its own `node "${CLAUDE_PLUGIN_ROOT}/.../planning.mjs" debt-harvest --root .` invocation beside the CADENCE-DEBT marker grammar. It is registered with the same wholesale-rewrite reason. Proved by running the rule over the walked tree against an EMPTY row set: exactly those four surfaces report, and zero report against the shipped register. The plan's `## Must be true when done` clause - every prose surface still allowed to write the file is one register row with its reason - is met by four rows.
- Declined the fuller discriminator: the scan reads a write instruction only in the two shapes above, so prose instructing a hand write in WORDS alone ("append the item to CAPTURE.md" as English) stays invisible. The plan's task 2 Action states this as the cost to keep, and widening to it is the unbounded-grammar problem, so the module header states it rather than the code chasing it.

CHECKPOINT: structural
Current task: 3 - The capture contract names who may write the file
Need: task 3's `Verify` and the plan's `## Must be true when done` both require `node cadence-core/bin/test.mjs` green. It is 3215 tests, 3214 pass, 1 fail, and the failure is OUTSIDE this plan's lease and PREDATES this dispatch: `cadence-core/bin/seam-calls.test.mjs:125` asserts `cadence-core/workflows/plan.md` instructs exactly 12 seam invocations and it now instructs 14. `cadence-core/workflows/plan.md` was last touched by `08100808` ("docs: write the route.mjs resolve form at both /cad-plan dispatch sites"), the commit immediately before this dispatch, which added two `route.mjs resolve` calls without re-pinning the census. Proved by checking `08100808` out into a clean worktree and running that test file there: the same `14 !== 12`. Neither `workflows/plan.md` nor `bin/seam-calls.test.mjs` is in PLAN-3's `files:`, and the test's own message refuses a bare re-pin ("a count that moved is a round-trip added or removed, not a number to re-pin"). The decision is whether the two added resolve calls stay (re-pin the census at 14, with the measurement) or come out - and which plan's lease carries it. Every other clause of every task's `Verify` passed; all three tasks are implemented and committed.

---

## Orchestrator resolution (not the executor's text)

The structural checkpoint above was resolved by /cad-execute, not by a
continuation dispatch. The executor's claim was checked before it was acted on
and it held: `git diff --stat 08100808..HEAD -- cadence-core/workflows/plan.md
cadence-core/bin/seam-calls.test.mjs` is empty, so this dispatch touched
neither file, and the failure predates it.

The decision on the fork ("do the two resolve calls stay or come out") was
STAY, re-pinned at 14, on this measurement: `git show 08100808 --
cadence-core/workflows/plan.md` shows both dispatch sites ALREADY instructed the
resolve in prose and already carried their `--bracket-read` inline. That commit
only wrote the four-line invocation out at each site. The census counter reads
literal command blocks, so what moved the number is a call that became literal,
not a call that appeared - no round-trip was added or removed, which is the
measurement `seam-calls.test.mjs`'s own failure message demands before a re-pin.

Carried by `59a8c728` (`test: re-pin plan.md's seam census at 14`) as an
orchestrator repair rather than a plan task: neither file is in any phase 3
plan's `files:`, and `08100808` was a hand commit, not plan work.

All three of this plan's tasks were already implemented and committed at the
checkpoint; the only unmet clause was "whole suite green", now
`node cadence-core/bin/test.mjs` = 3215 tests, 3215 pass, 0 fail, and
`self-verify.mjs` = 0 problems. No continuation executor was dispatched, since
there was no remaining task to continue.
