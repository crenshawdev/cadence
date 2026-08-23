---
phase: 1
status: complete
completed: 2026-08-23
---

# Phase 1: The corpus, read back at a file and line - Summary

`/cad-why <path>[:<line>]` joins a queried path's commits to six record edges - phase, plan task, decision, deviation, review finding and declaring task - reading the live `phases/<N>/` tier, the `_archive-v<ver>/` tier, and pruned milestones recovered out of git history, and naming the gap in words where no tier answers.

## What shipped

- The query grammar and the two git invocations (bare path, `:<line>`) - `cadence-core/bin/lib/why-query.mjs`
- The deterministic renderer and the default entry cap of 10 - `cadence-core/bin/lib/why-render.mjs`
- The seam: one JSON object carrying `text` and `entries` - `cadence-core/bin/why.mjs`
- The record readers (commits table, decisions, deviations, adjudications, declared files) - `cadence-core/bin/lib/why-record.mjs`
- The corpus index over both on-disk tiers plus the git-recovered tier - `cadence-core/bin/lib/why-corpus.mjs`
- The command surface - `skills/cad-why/SKILL.md`, a `/cad-why` row in `cadence-core/references/COMMANDS.md`, a `CONTRACTS` row in `cadence-core/bin/lib/arg-contract.mjs`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 8aeb289b | why-query grammar and the two git invocations |
| 1 | 2 | 683608d8 | why-render deterministic renderer and entry cap |
| 1 | 3 | 417049d3 | the /cad-why seam |
| 1 | 4 | 417049d3 | determinism tests, no separate commit (see deviations) |
| 1 | 5 | cbba5d59 | register the /cad-why command surface |
| 2 | 1 | e287d314 | the SUMMARY commits-table reader, bound fence-aware and matched by prefix |
| 2 | 2 | 2d9ffbc5 | the storage-tier locator, one index over live and archived phase directories |
| 2 | 3 | 2d3f0eaa | the phase and plan-task edge, read off the resolved directory |
| 2 | 4 | 781a1783 | the decision edge, cited by task or stated phase-scoped |
| 2 | 5 | 4c1ec3a4 | the deviation edge names the marker the write side never emits |
| 2 | 6 | 3e019635 | the surviving review finding edge, joined by commit range |
| 2 | 7 | 6a0d5642 | the task-attributed declared-files edge, continuation lines included |
| 2 | - | b5f49bad | orchestrator fix closing the plan-2 risk_surface blocker (see deviations) |
| 3 | 1 | aa806a6c | the prune-commit search and its milestone label binding |
| 3 | 2 | e0ef35bf | the reverse commit-to-phase map, recovered out of git history |
| 3 | 3 | dcc411ad | the recovered map reaches the chain, labelled by its milestone |
| 3 | 4 | 22899038 | the remaining edges read their artifacts out of the prune parent |
| 3 | 5 | 2382a9a7 | the named gap, and the phase number that is never guessed |

## Deviations

- [deviation] plan 1, LEASE WIDENED at a structural checkpoint, user-approved. `cadence-core/bin/arg-contract.test.mjs` was outside plan 1's `files:` list, but its hard-coded CONTRACTS totals (168 flag entries, 16 scripts) are ratcheted to 170 and 17 by task 3's in-lease `why.mjs` row. The path was added to `PLAN-1.md`'s `files:` and the fix landed in cbba5d59.
- [deviation] plan 1, task 5's `human-verify:` clause was not taken as a checkpoint stop: it asks for `/cad-why` to be run in a session, which an executor cannot invoke. Carried as an open item with the comparand measured.
- [deviation] plan 1, `skills/cad-why/SKILL.md`'s prescribed invocation was hardened before committing: the leaner form inlined `"$ARGUMENTS"` into a double-quoted shell word, where `$(...)` and backticks execute before Node starts. It now single-quotes the query and refuses a query containing a single quote. `lib/text-transport.mjs`'s scan keys on a flag followed by a quoted value and cannot see a positional site, so self-verify's clean answer here was vacuous.
- [deviation] plan 2, two literal U+0000 bytes reached `lib/why-corpus.mjs` and one reached `why.mjs` as memo-key separators, which self-verify's `nul-byte-in-source` check refused. Replaced with `\x1f`, matching `LOG_FORMAT`'s own convention. Found by running the gate, not by reading the file.
- [deviation] plan 2, task 4's Action locked the decision source as `parseContextDecisions` while its Verify required a D-08 cite's own CONTEXT text; the two could not both hold. `contextDecisions` was added, starting at `parseContextDecisions` and appending `## Decisions` bullets through the same fence-aware `sectionSpan`, de-duplicated with the durable spelling winning. This REFUTES D-10's claim about the fallback; CONTEXT.md is corrected in place.
- [deviation] plan 2, task 6's fixture description was wrong (one entry, no `counter_evidence`, not "non-survived entries"); the non-survived arm is proved on real on-disk records instead, exercising all three rulings.
- [deviation] plan 2, task 5's Verify asserted three `## Deviations` bullets in `_archive-v2.2.0/3/SUMMARY.md`; it carries six. Substance unchanged, count corrected.
- [deviation] plan 3, task 1's Action asserts `--full-history` can surface merges; measured on git 2.55.0 it cannot, because `--diff-filter=D` selects no merge under the default `--diff-merges=off`. The guard stays and the parse was split into a pure `parsePruneRecords` so the refusal is proved over stdout git actually wrote.
- [deviation] plan 3, task 1's label binding is not a property every close has: `.planning/ARCHIVE.md` did not exist before v3.5.3, so 18 of 25 closes bind no label. An absent label is reported as absent; a test pins the count at 7.
- [deviation] ORCHESTRATOR FIX, b5f49bad, closing plan 2's blocking `risk_surface` finding. `readArtifact` in `lib/why-corpus.mjs` followed a joined name's own symlink, putting the escape `phaseDirsIn` contains per directory back one level down: a `SUMMARY.md` symlinked outside the tree passed `isFile()` and its bytes would reach a seam whose stdout is the place EXP-01 was about. The resolved path must now stay inside the resolved directory it was joined onto (`EESCAPE`), which also closes the check-to-use race on the same line. `D-13` is separately corrected in CONTEXT.md from plan 1's finding that self-verify check 20 cannot see this site.

## Open items

- HUMAN-VERIFY, plan 1 task 5: run `/cad-why cadence-core/bin/lib/seam-io.mjs` in a session and confirm the printed chain is byte-identical to the seam's `text`. Plan 1's report records the comparand; it is stale by one line, since plan 3 replaced the `phase:` placeholder with the named gap.
- THE ENTRY CAP'S STATED REASON IS MEASURED FALSE and the replacement number is undecided. `lib/why-render.mjs` claims ten entries stays under the byte threshold; measured 2026-08-23 with all edges filled, `capture-file.mjs` renders 11,211 B over 8 entries, `issue-decision.mjs` 12,481 B over 10, `planning.mjs` 15,637 B - all past `references/conventions.md`'s 10,000-byte line. The comment carries the measurement; `DEFAULT_TOP` was not lowered because `why-render.test.mjs` pins it outside the touching plans' leases.
- THE BARE-PATH ARM INHERITS GIT'S DEFAULT HISTORY SIMPLIFICATION, which bounds how much of the corpus any join can reach. Measured on `lib/release-decision.mjs`: 7 commits shipped against 10 with `--full-history`, the three missing being `_archive-v2.2.0/3` phase commits collapsed into merge `0bf62847`; none of that phase's five recorded commits is reachable from any path they touched. The same defect one level up costs 21 of 25 closes on the prune search, which `--full-history` is why plan 3 already passes there. Worth a decision on the chain query's flags.
- `closeOver` in `lib/why-corpus.mjs` compares `%cI` timestamps as strings, and ISO-8601 values under different UTC offsets do not string-sort chronologically, so an unresolved commit can be attached to the wrong close. Raised at medium by the plan-3 `risk_surface` review and ruled low on reachability (mixed-offset commits AND a `--mode delete` close AND a pair straddling a prune). Fix: compare `Date.parse` on both sides with a guard for an unparseable date, and pin a mixed-offset pair in `why-corpus.test.mjs`.
- `readArtifact`'s check-to-use race has a residue after b5f49bad: an actor with write access inside `.planning/phases/<N>/` can still swap a regular file for a FIFO in that same directory. Consequence is a hang, by someone who could already write arbitrary planning bytes. Raised at high, ruled low.
- `parseAdjudication` in `lib/why-record.mjs` caps neither input size nor structural depth on `JSON.parse`. Raised at high, ruled low: an `ADJUDICATION-*.json` is Cadence's own artifact in the caller's own `.planning/`, and every other JSON read in this tree is unbounded the same way, so a cap here alone is an approach difference rather than a closed hole.
- `.planning/ARCHIVE.md`'s residue reaches only the UNRESOLVED arm, not resolved entries, which is what D-04 implies but plan 3's task 5 sentence reads as unconditional.
- DECLINED a `git cat-file --batch` reader for recovered summaries: 79 subprocesses measured at 76 ms against a 376 ms worst-path invocation. Build it if the corpus grows an order of magnitude.
- Whether `lib/text-transport.mjs` should grow a positional arm, so a caller-derived value in a positional shell word is scanned the way a flagged one is. This phase is the tree's first prose site with that shape.

## Goal check

The seventeen plan commits plus one orchestrator fix do deliver the phase goal, and the delivery is checkable rather than asserted: `node cadence-core/bin/why.mjs cadence-core/bin/lib/why-corpus.mjs` returns `ok:true` with `result:"chain"` and a `text` carrying all six edge lines per entry, `:94` narrows the same path to the commits whose diff touched that line (`b5f49bad` first), and `no/such/path.txt` returns the stated `not-in-history` result rather than an empty chain or a raw `fatal:`. All 127 tests across the five `why*.test.mjs` suites pass, and each plan's report records `self-verify --root .` at `ok:true, problems:[]` with the full suite green at its final gate (2808 tests at plan 3's). Two limits are real and named rather than hidden. The first is reachability, not correctness: the bare-path arm inherits git's default history simplification, so `_archive-v2.2.0/3`'s five commits are invisible to `/cad-why` from every path they touched - the join works, the chain that reaches it is short. The second is that this phase's own commits render `phase: NOT RESOLVED` until this SUMMARY is committed, which is the corpus working as designed (the summary IS the edge, per D-08) but means the goal is only fully demonstrable one commit from now. Nothing in `## Must be true when done` is unmet; the open items above are decisions the phase surfaced, not gaps in what it built.
