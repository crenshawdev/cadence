PLAN COMPLETE
Plan: .planning/phases/1/PLAN.md
Tasks: 5 of 5

| Task | Commit | Note |
|---|---|---|
| 1: Pin the baseline and make the work recoverable | e578e76 | Baseline pinned; `triage-work/` ignored; current-cycle split derived and cross-checked |
| 2: Archive every historical open item as one block | none (D-01) | 185 open bullets moved under `## Archive`; 28 current-cycle open bullets remain; all 51 `- [x]` untouched |
| 3: Prove the archive is invisible and the corpus still carries closed items | none (D-01) | AC2 proved with a real control; AC3 still returns the closed item at rank 1 |
| 4: Triage the current-cycle open items individually | none (D-01) | 28 verdicts (4 CLOSED, 24 KEPT), 32 tags requalified, AC6 clean with no exception |
| 5: Route the assignment list to SUMMARY | none (D-01) | 24 KEPT rows + 1 `## Notes` carry-over row, targets `unassigned` x23 and `phase 2` x2 |

## Pinned baseline (measured 2026-08-08, before any edit)

| Measure | Value |
|---|---|
| `grep -c '^- \[ \]' .planning/CAPTURE.md` | 213 |
| `grep -c '^- \[x\] ' .planning/CAPTURE.md` | 51 |
| `wc -l < .planning/CAPTURE.md` | 330 |
| sha256 of `.planning/CAPTURE.md` (= baseline copy) | `8f732d1c03a32ea85acfa07ed798f917f1ae84145dacc0ecd4a2a121b7245615` |
| open bullets carrying a bare `(phase N)` tag | 179 |
| checked bullets carrying a bare `(phase N)` tag | 42 |
| current-cycle bullets | 38 (28 open, 10 checked) |
| historical open bullets to archive | 185 |
| checked bullets requiring requalification | 32 |

## How the current-cycle boundary was drawn

The tag alone cannot answer this: D-05 records that 179 of 213 open items carry
an exact `(phase N)` tag while only 53 name any milestone, and the numbers span
1-6, colliding with both v2.5.0's phases and this cycle's. So the split was made
by reading each tagged bullet and attributing it to a milestone from its own
text plus tree evidence, never from the tag.

A bullet is current-cycle iff its bare tag names a phase of the **v2.5.0**
milestone - phase 1 "Benchmark quick wins" (QW-01..05) or phase 2 "Context
reduction" (CTX-01), the two phases that ran before this cycle opened
(`.planning/_archive-v2.5.0/{1,2}/CONTEXT.md`). Three regions qualify:

- `CAPTURE.md:4-10` - seven open `(phase 2)` bullets naming v2.5.0 phase 2's own
  artifacts: `weight.mjs`/`weight.test.mjs`, `lib/deferred-reads.mjs`,
  `phases/2/MEASUREMENTS.md`, the `skills/cad-land/SKILL.md:44` byte figure, and
  one dated 2026-08-08.
- `CAPTURE.md:37` - one checked `(phase 1)` bullet, "Closed 2026-08-07 by phase 1
  (QW-04)".
- `CAPTURE.md:275-304` - thirty `(phase 1)` bullets (9 checked, 21 open) naming
  v2.5.0 phase-1 seams and commits: `lease-check`, `lib/trace.mjs`/`renderTrace`,
  `detect-commands`, `branch-decision.mjs`, `LOCKFILES`, `merge-warnings.mjs`,
  and closures reading "Closed 2026-08-08 by phase 1 plan 2 task N".

The boundary at 274/275 was checked by content in both directions:
`CAPTURE.md:261-272` are v2.3.0 phase-1 items (the `cad-verifier` `Write` grant,
`fall_through`, RES-03's `--payload`, task 10's over-cap closure), all closed by
shas that `git tag --contains` resolves to `v2.3.0`.

Cross-check, not an input: the plan measured 38 / 28 / 10 independently at
planning time and this derivation reproduces all three exactly.

The list is at `.planning/phases/1/triage-work/current-cycle.txt`, one row per
bullet as `<baseline line>\t<state>\t<first 90 chars>`. **The line numbers are
baseline-relative**; every later task matches bullets by TEXT, since task 2's
block move shifts them.

## Milestone attribution for the 32 requalifications (task 4 input)

Established from tree evidence - the earliest release tag containing each cited
sha (`git tag --contains --sort=creatordate`), the archived phase CONTEXT titles,
or a milestone the item names outright. Baseline line numbers.

| Baseline lines | Requalified tag | Evidence |
|---|---|---|
| 75-81 | `(v1.3.1 phase 2)` | `bf48810`, `9a99a07`, `68061f5`, `346c2b0`, `2b50d5b` all first tagged `v1.3.1` |
| 88, 89, 95 | `(v1.3.1 phase 3)` | origin shas `722c24b`, `b09c3ab`, `7824314` first tagged `v1.3.1` |
| 51, 52, 55 | `(v1.3.1 phase 4)` | `c4ab89f` (the item's own phase-4 baseline) first tagged `v1.3.1`; item 51 names the `cadence/v1.3.1` branch; `entries()` present at `v1.3.1:.../lib/surface-weight.mjs` |
| 64, 66, 67 | `(v1.4.0 phase 3)` | the tokenizer phase; item 55 records it as "closed by phase 3 (v1.4.0), `c2265ca..dd7072a`", both first tagged `v1.4.0` |
| 57 | `(v1.4.0 phase 4)` | regression from `be19a0b`, closed by `81bab78`, both first tagged `v1.4.0` |
| 176 | `(v2.0.0 phase 3)` | item text names v2.0.0; `1e34058` first tagged `v2.0.0` |
| 179, 180 | `(v2.0.0 phase 4)` | item text names v2.0.0; `e09a0e5` first tagged `v2.0.0` |
| 211, 220, 221, 222 | `(v2.1.0 phase 2)` | `_archive-v2.1.0/2/CONTEXT.md:8` scopes TRI-02 **and REV-03** to that phase; `e9b05d4` is `fix(2-2)` dated 2026-07-30 |
| 235, 236 | `(v2.2.0 phase 2)` | `_archive-v2.2.0/2/CONTEXT.md` = "The parser earns its keep"; both items are the deleted `lib/destructive-git.mjs` / args-walk work |
| 231 | `(v2.2.0 phase 4)` | `_archive-v2.2.0/4/CONTEXT.md` = "The ladder is what it says it is", which the item quotes as "this phase's" goal |
| 32 | `(v2.3.0 phase 2)` | `19e6eba` first tagged `v2.3.0`; the item applies LOD-05's break-even rule, that phase's own |
| 264-267 | `(v2.3.0 phase 1)` | `189ac2a`, `abe0a00`, `16c007d`, `f5fbe4d` all first tagged `v2.3.0` |

Deviations:
- [deviation] expected the plan's stated 44 checked bullets carrying a bare tag,
  observed 42. Re-measured with the reader's own anchored regex
  (`planning-files.mjs:627`) applied after the checkbox strip: 179 open tagged
  (matching CONTEXT D-05 exactly) and 42 checked tagged. The requalification set
  is therefore 32, not the plan's 34. The plan instructed re-derivation over
  trusting its figures; the 38 / 28 / 10 current-cycle figures did reproduce.
- [deviation] no static-analysis command exists for this project.
  `workflow.lint_command` is `null` and `planning.mjs detect-commands --root
  /data/code/cadence` returns `{"lint":null,"typecheck":null}`. Stated once here
  and skipped for every task in this plan, per the contract's both-null arm.

- [deviation] expected task 2 to produce a commit, observed nothing stageable.
  `.planning/CAPTURE.md` is gitignored (`.gitignore:23`) and D-01 fixes it that
  way, so tasks 2-5 change no tracked file and there is no atomic commit to make.
  No `--allow-empty` marker commit was created: an empty commit would assert a
  change git cannot show, and D-01's own point is that the queue's state is not
  in history. The durable record is this report, which IS tracked
  (`git check-ignore` exits non-zero on it) and which the orchestrator stages
  into the phase docs commit.

## Task 2 verification (block move)

| Check | Result |
|---|---|
| `## Archive` heading | `.planning/CAPTURE.md:129` |
| open `- [ ]` bullets above `## Archive` | 28, every one present in `current-cycle.txt` |
| open `- [ ]` bullets below `## Archive` | 185, multiset-equal to (baseline open bullets minus the keep set) |
| duplicated bullets below | 0 |
| all bullets (`- [ ]` + `- [x]`) live vs baseline | multiset-identical - nothing dropped, nothing minted |
| `grep -c '^- \[x\]'` | 51, unchanged from the task-1 baseline |
| `- [x]` bullets below `## Archive` | 0 (D-02: closed items never archived) |

The five indented continuation lines in `## Todos`
(`baseline CAPTURE.md:104-108`) belong to a `- [x]` bullet at `:103`, so no
sub-bullet was orphaned by the move; every other line in the section is either a
column-0 bullet or blank.

## Task 3 verification (AC2 invisibility, AC3 corpus)

**Chosen archive-only token: `interrogation`.** It occurs exactly once in
`.planning/CAPTURE.md`, in the archived open bullet at `:159` ("converts a batch
of read-only checks into a serial human interrogation"), and nowhere in
`## Todos`, `## Seeds` or `## Notes`.

Control copy built with the single `sed` pass the plan specifies, renaming
`## Notes` out of the way BEFORE renaming `## Archive` into it:
`grep -c '^## Notes$'` = 1, `^## Archive$` = 0, `^## Notes-orig$` = 1. The
control is a real control because `sectionBody`
(`cadence-core/bin/lib/planning-files.mjs:566`) anchors on `^## Notes\s*$`, so
`## Notes-orig` cannot satisfy the walk.

| Run (`recall --dir <snapshot>`) | Result |
|---|---|
| `interrogation` against the live file | `{"ok":true,"results":[]}` - zero |
| `interrogation` against the control | 1 result, score 2.9453, the archived `/cad-verify` bullet |
| `git guard tokenizer` against the live file | 33 results; `grep -c 'Six pre-existing'` over the raw JSON = 1, at **rank 1**, carrying the `[closed] ` prefix |

The pair is what makes the zero mean invisibility rather than absence: the same
bytes, the same query, the same seam, differing only in whether the section name
is inside the hardcoded walk.

## Task 4 verification (verdicts, AC6, empty-closed guard)

| Check | Result |
|---|---|
| open `- [ ]` bullets above `## Archive` | 28, every one also present in the baseline |
| carrying a dated verdict clause | 28 - zero carry none |
| carrying **exactly one** of the four D-04 shapes | 28 |
| verdict distribution | 4 CLOSED (verified live), 24 KEPT, 0 MOOT |
| bullets still visible with a bare `(phase N)` tag | 38 - and **0** of them non-current-cycle, so AC6 holds with no stated exception |
| bullets requalified to `(vX.Y.Z phase N)` | 32 |
| `parseCaptureSnippets` snippets whose text is the bare string `[closed] ` | 0 (86 snippets total; 0 empty even after the `[closed] ` prefix is stripped) |

AC2 and AC3 were re-proved after the edits, since the verdict appends and the
requalifications both change indexed text: `interrogation` still returns
`{"ok":true,"results":[]}` against the live file and one result (score 3.0657)
against the control, and `git guard tokenizer` still returns the
"Six pre-existing" item at **rank 1 of 33**.

Every verdict was set from what the tree says. Four items that read as open were
CLOSED against live evidence, and one of those - the `MEASUREMENTS.md` item -
turned out to be citing a file that had already been corrected to say the very
thing the item asked for. Where a cited line had moved, the line actually read is
the one in the verdict (`weight.test.mjs:214` is now `:211`; `phases/2/` is now
`_archive-v2.5.0/2/`).

Open items:
1. **`cadence-core/bin/lib/trace.mjs` contains two literal NUL bytes and is
   therefore invisible to `grep`.** Found while re-verifying the `correlationId`
   item, not looked for. The composite worker key at `:296` is written
   `` `${key(e.corr)}<NUL>${key(e.phase)}<NUL>${key(e.plan)}` `` with raw U+0000
   characters rather than the `\0` escape, so `file(1)` reports the source as
   `data` and every `grep`/`rg` over `cadence-core/bin/**` silently skips the
   whole file unless `-a` is passed. It is valid UTF-8 and Node reads it fine, so
   nothing is broken at runtime - the cost is that a maintainer's grep sweep, and
   any future text-based check over `bin/**`, has a blind spot in exactly the file
   the joined trace lives in. Out of scope here (this phase fixes no defect it
   finds); the one-character fix is `\0` in the template.
2. Two current-cycle KEPT items describe the same surface phase 2 must build
   FRI-03 on, and are routed to it as inputs rather than as defects - see the
   assignment list.

## For SUMMARY.md - kept-item assignment list (paste verbatim, do not paraphrase)

Targets are `phase 2`, `phase 3` or `unassigned` only (D-12). Two things about
the distribution, stated so it is read as a result rather than as an omission.
First, almost every row is `unassigned`: these 24 are v2.5.0's OWN residue, while
phases 2 and 3 were scoped from the older material that is now archived, so the
overlap is genuinely small. Assigning a row to phase 2 or 3 because it is
plausible would grow those phases past the requirements they were sized against,
which is the exact failure that split this cycle. Second, `phase 4` is a real
phase of this cycle but is not an admissible target here (AC7, D-12), so rows
whose natural home is the doc sweep say so in the restatement and stay
`unassigned`.

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

## Notes-section carry-over

Not a `- [ ]` bullet, so no verdict clause reaches it, and it would otherwise be
orphaned by the cycle that read it. Its citation was re-read live rather than
copied, and it has moved again.

| # | Item | Re-verified citation | Target |
|---|---|---|---|
| 25 | `planning.mjs recall` cannot distinguish an ABSENT corpus from "nothing matched" - both return `{"ok":true,"results":[]}` - and its `dir` default resolves relative to cwd, so any caller whose cwd is not the project root silently gets a memory-less result that the workflows interpolate as "this project has no history" | `cadence-core/bin/planning.mjs:2120` (`const dir = opts.dir \|\| '.planning';`) | unassigned |

Reproduced both halves 2026-08-08: `recall --dir <nonexistent> git guard` returns
`{"ok":true,"results":[]}`, and the query `git guard tokenizer` run with cwd at
`.planning/phases` and no `--dir` returns `[]` where the same query from the repo
root returns 33 results. **Both recorded line numbers are stale**: the queue's
`## Notes` entry says `planning.mjs:793` and phase 1 CONTEXT's flagged assumption
says `:1675`; the line is `:2120` today, and `:1675` now sits inside
`detect-commands`' `package.json` reader, so citing it would edit the wrong code.
