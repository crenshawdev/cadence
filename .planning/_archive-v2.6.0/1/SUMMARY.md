---
phase: 1
status: complete
completed: 2026-08-08
---

# Phase 1: Queue triage - Summary

`.planning/CAPTURE.md` went from a 213-item append-only log to 28 current-cycle
open items each carrying one dated, tree-backed verdict, with the 185 historical
open items moved under a single dated `## Archive` block that `planning.mjs
recall` cannot see.

## What shipped

- The triaged queue - `.planning/CAPTURE.md` (gitignored per D-01, working tree
  only). 28 open items above `## Archive` at `:129`, 185 archived below it, 51
  `- [x]` closed items still in `## Todos` and still in the corpus.
- The archive block and its one dated reason - `.planning/CAPTURE.md:129`,
  stating the presumptive-death premise for the whole move rather than a
  per-item verdict.
- 32 historical `(phase N)` tags requalified to `(vX.Y.Z phase N)`, each
  milestone established from tree evidence (earliest release tag containing the
  cited sha, or the archived phase CONTEXT title).
- The kept-item assignment list - `.planning/phases/1/reports/plan-1.md`, 24
  KEPT rows plus one `## Notes` carry-over row, each with a re-verified citation.
- The `.gitignore` rule protecting triage working copies - `.gitignore`,
  commits `e578e76` and the `diff`-review fix that followed it.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | e578e76 | Ignore per-phase triage working copies of the planning queue |
| 1 | 2-5 | none (D-01) | Queue edits: `.planning/CAPTURE.md` is gitignored, so no tracked file changed |
| - | diff review | da4e3aa | Re-anchor the ignore rule on the directory name, so a milestone close cannot publish the copies |

## Deviations

- [deviation] The plan stated 44 checked bullets carrying a bare tag; 42 were
  observed. Re-measured with the reader's own anchored regex
  (`planning-files.mjs:627`) applied after the checkbox strip: 179 open tagged
  (matching CONTEXT D-05 exactly) and 42 checked tagged, so the requalification
  set is 32 rather than the plan's 34. The plan instructed re-derivation over
  trusting its figures, and the 38 / 28 / 10 current-cycle figures did reproduce.
- [deviation] Tasks 2 through 5 produced no commit. `.planning/CAPTURE.md` is
  gitignored (`.gitignore:23`) and D-01 fixes it that way, so those tasks change
  no tracked file. No `--allow-empty` marker commit was created: an empty commit
  would assert a change git cannot show, and D-01's point is that the queue's
  state is not in history. `reports/plan-1.md` is the durable record and IS
  tracked.
- [deviation] The `diff` review returned a blocker against task 1's own commit
  and it was fixed rather than reported. `/.planning/phases/*/triage-work/`
  anchored the rule to one fixed parent, but a milestone close MOVES
  `phases/<N>/` to `_archive-<label>/<N>/` and commits everything under it
  (`cadence-core/workflows/milestone.md:77-84`), so the 716 KB of candid queue
  copies would have stopped being ignored at exactly the moment they got
  staged - inverting D-01. Confirmed independently before acting:
  `git check-ignore --no-index .planning/_archive-v2.6.0/1/triage-work/baseline/CAPTURE.md`
  reported NOT IGNORED under the old rule, and `git show --stat 49bf093` shows
  the v2.5.0 prune committing every file under the moved dirs wholesale, so this
  repo takes that branch in practice. The rule is now
  `/.planning/**/triage-work/`, matched on the directory name at any depth,
  which also closes the reviewer's second finding (`tasks/<name>/` and
  `spikes/<name>/` are tracked trees with no protection). Verified across five
  paths ignored and three real artifacts still tracked-eligible.
- [deviation] No static-analysis command exists for this project.
  `workflow.lint_command` is `null` and `planning.mjs detect-commands` returns
  `{"lint":null,"typecheck":null}`, so the contract's both-null arm applied to
  every task.

## Open items

- `cadence-core/bin/lib/trace.mjs` contains two literal NUL bytes and is
  invisible to `grep`. The composite worker key at `:296` is written with raw
  U+0000 characters rather than the `\0` escape, so `file(1)` reports the source
  as `data` and every `grep`/`rg` over `cadence-core/bin/**` silently skips the
  whole file unless `-a` is passed. Confirmed independently: `file` returns
  `data` and `sed -n '294,298p' ... | cat -v` shows `^@` in the template
  literal. Nothing is broken at runtime; the cost is a blind spot in exactly the
  file the joined trace lives in. The fix is one character, `\0` in the
  template. Found while re-verifying an item, not looked for, and out of scope
  here - this phase fixes no defect it finds.
- Two current-cycle KEPT items (assignment rows 15 and 16) describe the
  published-version guard surface phase 2 must build FRI-03 on. They are routed
  to phase 2 as inputs, not as defects.
- AC6 holds on the reader's strict definition but two closed bullets sit in a
  third state worth naming: `(phase 5, criteria-coverage)` at `CAPTURE.md:53-54`
  is not a bare `(phase N)` tag - the anchored regex at
  `planning-files.mjs:627` requires `)` immediately after the digits, so it
  yields no phase field and cannot collide with this cycle - but it was not
  requalified to `(vX.Y.Z phase N)` either. The functional half of AC6 is
  satisfied; the cosmetic half is not, for two items.
- 22 of the 24 KEPT rows are `unassigned`. That is a result, not an omission:
  these are v2.5.0's own residue, while phases 2 and 3 were scoped from the
  older material now archived, so the overlap is genuinely small. Assigning a
  row because it is plausible would grow those phases past the requirements they
  were sized against.

## Kept-item assignment list

Per AC7 and D-12. Targets are `phase 2`, `phase 3` or `unassigned` only, so
phases 2 and 3 consume this without re-reading the queue. `phase 4` is a real
phase of this cycle but is not an admissible target here, so rows whose natural
home is the doc sweep say so in the restatement and stay `unassigned`.

Almost every row is `unassigned`, and that is a result rather than an omission:
these 24 are v2.5.0's OWN residue, while phases 2 and 3 were scoped from the
older material that is now archived, so the overlap is genuinely small.
Assigning a row because it is plausible would grow those phases past the
requirements they were sized against, which is the exact failure that split this
cycle.

| # | Item | Re-verified citation | Target |
|---|---|---|---|
| 1 | The cross-model reviewer set resolves to `openai` alone: `deepseek` was removed from both layers and the surviving voice reports HTTP 401, so `plan`, `diff` and the blocking `risk_surface` all fall back to one `claude-subagent` | `.planning/config.json` declares no `review.reviewers`; `config.mjs get` resolves `["openai"]` | unassigned |
| 2 | `weight.mjs resident`'s envelope assertions derive both sides from one `surfaceSet()` Map, so a `readSurface` off-by-one leaves them all green; the only disk pin is a synthetic fixture | `cadence-core/bin/weight.test.mjs:165`, `:198-199`, `:211`, `:239`, `:293` | unassigned |
| 3 | Two skills hardcode a `15,134 B` reference size that `seams.md` makes mandatory for every future deferral, and nothing checks either figure against the file it describes. Natural home: the doc sweep | `skills/cad-land/SKILL.md:44`, `skills/cad-plan-review/SKILL.md:39`, `cadence-core/references/seams.md:240-242` | unassigned |
| 4 | `detect-commands` names a tool binary from the presence of its config table without testing PATH, and its eslint arm emits `npx eslint .`, which fetches and runs an unpinned package from the public registry. Natural home: phase 2's theme, though outside FRI-01..03 as written | `cadence-core/bin/planning.mjs:1712` | unassigned |
| 5 | `git-publish`'s `tornLayerDetail` refuses on ANY `mergeLayers` warning, so one torn user-global file halts reaping and publishing in every repo on the machine | `cadence-core/bin/git-publish.mjs:116-118`, `:146`, `:187` | unassigned |
| 6 | `planning.mjs --root ""` falls through `opts.root \|\| process.cwd()` and silently answers about the cwd; the prose callsite `detect-commands --root <project root>` is the realistic trigger | `cadence-core/bin/planning.mjs:2112` | unassigned |
| 7 | `lease-check` and `cmdTrace` normalize a two-digit decimal phase away: `--phase 1.10` reads `phases/1.1` and hints at a different phase. Natural home: phase 3's theme, though outside PRS-01/02 as written | `cadence-core/bin/planning.mjs:1540`, `:1759` | unassigned |
| 8 | `merge-warnings` classifies a whole line as a comment on a leading `*`, `//` or `/*` without tracking whether a block comment closes before code on that line | `cadence-core/bin/lib/merge-warnings.mjs:66`, `:146` | unassigned |
| 9 | `land-cleanup`'s protected-branch coercion lacks the lone-string tolerance both sibling rails apply, so `protected_branches: "release"` emits `base: "main"` | `cadence-core/bin/land-cleanup.mjs:78-79` | unassigned |
| 10 | Three seams emit `"warnings":[]` on every ordinary run while `route.mjs` omits the key when empty, and the rationale comment cites `route.mjs` as precedent for the opposite of what it does | `cadence-core/bin/git-branch.mjs:62-64`, `:82` | unassigned |
| 11 | `design-notes/improvement-roadmap.md` still states the untested-wire-paths policy D-10 reversed; the file is untracked, so it survives no clone. Natural home: the doc sweep | `design-notes/improvement-roadmap.md:5-6` | unassigned |
| 12 | `workflows/config.md` promises an empty `workflow.test_command` maps to `null`; the write face stores `""`. The same wording rides other `str\|null` rows. Natural home: the doc sweep | `cadence-core/workflows/config.md:94` | unassigned |
| 13 | `correlationId` is `${phase}-${sha}`, so a phase re-run at an unchanged HEAD mints the same id and the FIFO pairing can still close a stranded dispatch with the retry's return | `cadence-core/bin/lib/trace.mjs:145-163`, `:303` | unassigned |
| 14 | Six lockfile names outside the 23-name allowlist still floor a phase to `critical` through `concurrency(lock)`: `Gopkg.lock`, `glide.lock`, `paket.lock`, `shard.lock`, `Berksfile.lock`, `Puppetfile.lock` | `cadence-core/bin/lib/risk-surfaces.mjs:92-107` | unassigned |
| 15 | The published-version guard now refuses only on exact tag membership, so an untagged version that merely sorts below the newest tag no longer refuses - a deliberate loosening phase 2 must not re-tighten by accident | `cadence-core/bin/lib/branch-decision.mjs:99-105`, `:186-189` | phase 2 |
| 16 | `decideBranch` accepts only `publishedVersions`; a caller outside the tree still passing the retired scalar key gets no comparand and therefore no guard at all | `cadence-core/bin/lib/branch-decision.mjs:103-104`, `:149` | phase 2 |
| 17 | `fail('bad-payload', e.message)` copies a `JSON.parse` message - which quotes up to 200 chars of the review payload - into `.planning/trace.jsonl` | `cadence-core/bin/review-provider.mjs:765` | unassigned |
| 18 | `traceProvider` marks the call recorded before attempting the write, so a failed explicit write is never retried with `fail()`'s poorer detail | `cadence-core/bin/review-provider.mjs:410-415` | unassigned |
| 19 | `parseArgs` treats any `--`-prefixed token as a flag consuming the next word, so a bare `--` separator binds the following positional as an option value | `cadence-core/bin/planning.mjs:2074-2079` | unassigned |
| 20 | `no-staged-set` and `unrepresentable-paths` are computed over the WHOLE index rather than the plan's paths, so a user-staged non-UTF-8 filename refuses every plan | `cadence-core/bin/planning.mjs:1570`, `:1578-1579`, `:1581-1591` | unassigned |
| 21 | A pathspec-scoped commit gate is blind to a path staged as a DELETION whose file exists untracked in the worktree; recorded against the next pathspec-commit proposal, since the cut design is absent from the tree | `skills/cad-executor-contract/SKILL.md:82` | unassigned |
| 22 | `parseStagedNameStatus` consumes a final record with no trailing NUL and yields a truncated path rather than `null`, contrary to its own docblock and its caller's message | `cadence-core/bin/planning.mjs:1504-1506`, `:1520-1535` | unassigned |
| 23 | The `C` (copy) branch adds the copy SOURCE to the leased set; defensive only, since `:1570` invokes git with `-M` and never `-C` | `cadence-core/bin/planning.mjs:1523-1525`, `:1597` | unassigned |
| 24 | The repo-layer naming assertion added to the existing torn-config test is satisfied by the unfixed implementation too; the case that distinguishes the fix is a separate test | `cadence-core/bin/git-guard.test.mjs:286-290`, `:371` | unassigned |

### Notes-section carry-over

Not a `- [ ]` bullet, so no verdict clause reached it, and it would otherwise be
orphaned by the cycle that read it. Its citation was re-read live rather than
copied, and it has moved again.

| # | Item | Re-verified citation | Target |
|---|---|---|---|
| 25 | `planning.mjs recall` cannot distinguish an ABSENT corpus from "nothing matched" - both return `{"ok":true,"results":[]}` - and its `dir` default resolves relative to cwd, so any caller whose cwd is not the project root silently gets a memory-less result that the workflows interpolate as "this project has no history" | `cadence-core/bin/planning.mjs:2120` (`const dir = opts.dir \|\| '.planning';`) | unassigned |

Both recorded line numbers for that last item are stale: the queue's `## Notes`
entry says `planning.mjs:793` and this phase's CONTEXT flagged assumption says
`:1675`. The line is `:2120` today, and `:1675` now sits inside
`detect-commands`' `package.json` reader, so citing it would edit the wrong code.

## Goal check

The phase goal is that `.planning/CAPTURE.md` stops being an append-only log and
becomes the set of things still true, with every verdict backed by the tree
rather than by its own wording. The commits alone do not show this, and that is
the phase's defining property rather than a gap: one commit landed
(`e578e76`, a `.gitignore` rule) because D-01 keeps the queue untracked, so the
evidence has to come from the tree itself. Checked directly rather than taken
from the executor's report: `## Archive` is at `CAPTURE.md:129`; 28 open bullets
sit above it and 185 below; all 28 above carry one of the four D-04 verdict
shapes (`grep -cE 'CLOSED [0-9]{4}-|MOOT|KEPT'` over the open bullets above the
heading returns 28, matching the bullet count exactly); `grep -c '^- \[x\]'`
returns 51 with zero of them below the archive heading, so D-02 held and no
closed item was archived. The invisibility claim (AC2) rests on the executor's
paired control run rather than on a check I re-ran: `interrogation` returns
`{"ok":true,"results":[]}` against the live file and one result against a
control copy whose `## Archive` heading was renamed into the walked set. What is
not delivered here, deliberately, is any fix: 24 items were KEPT and re-verified
rather than resolved, and the `trace.mjs` NUL defect found in passing is
recorded, not repaired. One thing the phase's own gate could not have caught is
worth stating: `PLAN.md:102` asserted `git check-ignore -q` only at the
pre-move path, so the ignore rule passed its task verify while being wrong for
the path the copies end up at. The `diff` review is what found it, and the fix
is in the commits above. The goal is met on the reading the phase was scoped to
after the 2026-08-08 cut - a queue whose surviving items are individually true -
and not on the older reading that every one of 213 items gets a verdict, which
that cut removed.
