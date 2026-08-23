# Phase 3: The fast path leaves a record - Context

Gathered: 2026-08-23
Feeds: /cad-plan 3

## Scope boundary

In: a `planning.mjs` subcommand that writes a task record under
`.planning/tasks/<slug>/`, carrying the task's commits and declared files in the
corpus's own grammar; the recall corpus walk extended to that tier so a query
naming what a task did returns the record; a fourth tier in `lib/why-corpus.mjs`
so `/cad-why` on a file a task touched resolves to the task instead of reporting
the gap; a trace bracket around a `/cad-task` run on both paths, keyed to a
per-run correlation anchor, with a stated census exception admitting a
coordinator-billed close that carries no `--turns`; and a regression test pinning
FST-02's shipped `risk-check run --phase 0` step and its `written: false`
withholding.
Out: any planning machinery on the fast path. This phase adds no context step,
no plan gate, no checker, no verify walk and no SUMMARY to `/cad-task`, and it
adds no `workflow.max_dispatch_tokens.cad-task` config key. It does not rebuild
FST-02, which shipped at `23daf54f` and was hardened at `78164874`; it pins it.
It does not change what `recall` returns for the tiers it already walks, and it
does not widen `phaseDirsIn`.
Deferred: None.
Plan shape: multiple plans, same phase - the evidence splits three ways: the
record writer plus its recall tier (AC1), the `/cad-why` fourth tier (AC2), and
the bracket plus the FST-02 pin and the re-pins (AC3-AC6). /cad-plan breaks it
down.

## Durable decisions

- D-01 (record location): the task record is a TRACKED artifact under
  `.planning/tasks/<slug>/`, not a `CAPTURE.md` bullet and not
  `.planning/phases/0/`. `.gitignore` ignores `/.planning/CAPTURE.md` outright
  while its own comment states that `tasks/<name>/` and `spikes/<name>/` are
  tracked trees, and `workflows/task.md`'s `planned_path` step 1 already writes
  `.planning/tasks/{slug}/PLAN.md` there. Rejected: a `CAPTURE.md` bullet, which
  is gitignored here, so AC2's `/cad-why` check would pass only on the author's
  machine and report the gap on a clone or in CI - the same defect phase 1's D-07
  names for `trace.jsonl`; and `phases/0/`, which the next `/cad-milestone` close
  archives into `_archive-v3.6.0/0/` and which then starts reading as a phase to
  `route.mjs`'s risk-floor replay. Evidence: `.gitignore`;
  `cadence-core/workflows/task.md` (`planned_path` step 1);
  `cadence-core/bin/lib/phase-plans.mjs:207` (`phaseDirsIn`);
  `cadence-core/bin/route.mjs:1380`.
- D-02 (why join): `/cad-why` reaches the task record through a FOURTH tier in
  `lib/why-corpus.mjs`, never by widening `phaseDirsIn`. That enumerator admits a
  directory only when it holds `PLAN.md`/`PLAN-<k>.md`, and the inline path writes
  no PLAN file at all; `mergeCommitIndexes` already models ordered tiers and
  `resolveCommit` asks `index.tiers` in order. Rejected: widening `phaseDirsIn`,
  which hands every task directory to `route.mjs:1380`'s risk-floor replay as well
  and makes `describe()` render `tasks phase <slug>` - a WRONG join rather than a
  missing one, which is the failure `/cad-why` exists to prevent; and giving the
  task a `PLAN.md` on both paths so the existing enumerator finds it, which
  contradicts the inline path's no-plan-files guarantee. Evidence:
  `cadence-core/bin/lib/phase-plans.mjs:207-245`;
  `cadence-core/bin/lib/why-corpus.mjs:145,192,731`.
- D-03 (inline bracket): `/cad-task` opens and closes a REAL bracket on both
  paths, and `cadence-core/bin/trace.test.mjs`'s census gains a stated exception
  row admitting a coordinator-billed close that carries no `--turns`; `--turns`
  stays mandatory wherever a subagent returned. The inline arm therefore renders
  with `unrecorded` token and turn totals, which the render already treats as a
  first-class answer distinct from zero. The figures do not exist to report:
  `lib/trace.mjs`'s TOKEN PROVENANCE block states the figure is read off a
  SUBAGENT return and that Cadence adds no hook, seam or capture mechanism to
  obtain it, and the host surfaces no equivalent for the coordinator's own work -
  confirmed 2026-08-23 against the session's own tool surface, which carries no
  self-usage reader. Rejected: bracketing only the planned path's `cad-executor`
  exception and writing a `COORDINATOR` marker on the inline path, which leaves
  the majority path with no bracket at all and so meets criterion 3 only where a
  subagent already ran; and inventing a `--turns`, which `lib/trace.mjs` names as
  strictly worse than an absent one and which would land in `trace suggest`'s
  share denominator. Evidence: `cadence-core/bin/lib/trace.mjs:42-77,135`;
  `cadence-core/bin/trace.test.mjs` (census, ~1950-1985).
- D-04 (correlation anchor): a phase-0 run writes a per-run correlation anchor,
  because `correlationId` returns the bare `<phase>` when no `lifecycle/phase_start`
  anchor exists and the worker key is `corr\x00phase\x00plan` with FIFO pairing.
  Measured 2026-08-23: all 8 live phase-0 events carry `corr: "0"` across four
  dates and six distinct committed ranges. `workflows/execute.md:109` is the
  existing `phase_start --sha` precedent. Rejected: keying on `--plan <slug>`
  alone, which still collides between two runs of the same slug and is exactly
  the mis-funding the replay-guard comment at `trace.mjs:685` describes; and
  folding the run identity into the worker key, which leaves `/cad-report` unable
  to separate one task run from another. Evidence:
  `cadence-core/bin/lib/trace.mjs:212,650,685`.
- D-05 (close exactly once): "closes exactly once on a failed or abandoned run"
  is settled by PROSE PLACEMENT, not by code, because no code path can close a
  bracket the coordinator walked away from. `renderTrace`'s replay guard drops
  only a BYTE-IDENTICAL repeat - worker key, event, role, ts, tokens and turns all
  equal - so two closes a millisecond apart both pair and fund the dispatch twice;
  `trace close` infers `checkpoint` from `--detail` presence and never from
  `--tokens`, which is the arm an abandoned run wants. An abandoned run that never
  reaches the close is reported honestly as `unpaired`, which is what it is.
  Evidence: `cadence-core/bin/lib/trace.mjs` (`seenTerminals`, ~683);
  `cadence-core/bin/planning.mjs` (close arm, ~3775-3795).
- D-06 (FST-02 pin): the pin EXTENDS `cadence-core/bin/prose-agreement.test.mjs`
  rather than adding a test file of its own, because two of the three assertions
  already live there - `:154` asserts `/risk-check run/` against
  `workflows/task.md`, `:1169` asserts both the flag and the withholding, and
  `:148` pins the transient `.diff` rails. Only `--phase 0` is unpinned; a
  repo-wide grep finds it at `workflows/task.md:79` and in `ROADMAP.md` alone. The
  pin follows the SHIPPED bytes, which are the negative form (`written: false`),
  not the ROADMAP's `written: true` wording. Rejected: a standalone new test file,
  which duplicates two live assertions and gives the tree two homes for one fact -
  the drift shape `lib/capture-file.mjs`'s own header condemns. Evidence:
  `cadence-core/bin/prose-agreement.test.mjs:148,154,1169`.
- D-07 (who writes it): the record is written by CODE reached as a
  `planning.mjs` subcommand, which appends its own `outcome`-family trace event
  and reports `{written, reason}` on its envelope - never by workflow prose
  holding `Write`/`Edit`. `lib/capture-file.mjs`'s header states the failure this
  closes: five filed bullets were lost because the writer was a model holding
  `Write`/`Edit`, which appended below a heading the recall walk does not visit,
  and nothing could fail. The in-code append precedents are `cmdCiteCount` and
  `cmdRiskCheckRun`. A subcommand rather than a new bin follows phase 1's D-01 and
  phase 2's D-07: every input lives under the planning root the dispatcher already
  passes as `--dir`. Rejected: a prose `Write` of a templated record checked
  afterwards by a reader seam, which reintroduces the unredenable writer. Evidence:
  `cadence-core/bin/lib/capture-file.mjs` (header);
  `cadence-core/bin/planning.mjs:2330-2355,4465`;
  `cadence-core/bin/self-verify.mjs:577-589,1200`.
- D-08 (budget silence): `cad-task` stays an UNDECLARED role, so its bracket is
  permanently unbudgeted rather than mis-budgeted, and no
  `workflow.max_dispatch_tokens.cad-task` key is added. `config.schema.json:32-37`
  declares six such keys and no task one, and `lib/window-budget.mjs` counts a
  ceiling-less row as unbudgeted and never prices it at zero. Rejected: adding the
  key, which drags in a `references/config-reach.md` row and the
  `inert-config-key` check at `self-verify.mjs:703` for a ceiling nothing would
  enforce. Evidence: `cadence-core/config.schema.json:32-37`;
  `cadence-core/bin/lib/window-budget.mjs`.

## Decisions

- D-09 (recall tier): `cmdRecall`'s corpus walk must gain the tasks tier
  EXPLICITLY, and the record's indexed text must sit under a heading that walk
  visits. The walk assembles the corpus from `phases/<N>/{SUMMARY,UAT,CONTEXT}.md`,
  `CAPTURE.md` and `ARCHIVE.md` and nothing else, and `parseSummarySnippets`
  indexes ONLY `## Deviations` and `## Open items`, so even a SUMMARY-shaped
  record's headline and `## What shipped` lines are invisible. Measured
  2026-08-23: `recall "batch probes rule worker contracts anchor handoff" --top 5`
  returned 5 hits over `total: 59`, none from `.planning/tasks/`, against a live
  `.planning/tasks/token-burn-contract-edits/PLAN.md` describing exactly that work.
  Evidence: `cadence-core/bin/planning.mjs` (`cmdRecall`, from :2458);
  `cadence-core/bin/lib/planning-files.mjs:806`.
- D-10 (record grammar): the record carries its OWN `## Commits` table and its own
  `- **Files:**` declaration; neither the shipped task-plan format nor a prose
  `## Outcome` with backticked hashes reaches an existing reader. `parseCommitRows`
  requires the `## Commits` heading and maps columns by header NAME, `planTaskTitles`
  anchors `^### Task <n>`, and `taskDeclaredFiles` requires `- **Files:**`.
  Measured over all three shipped `.planning/tasks/*/PLAN.md`: headings are
  `## Task 1:` or `### 1.`, the Files line is a bare `Files:` in two of three, and
  the commit record is prose - 0 of 3 parse with either reader. Evidence:
  `cadence-core/bin/lib/why-record.mjs:130,578`;
  `cadence-core/bin/lib/planning-files.mjs:495`.
- D-11 (fresh work): the bracket is new construction, not a repair.
  `workflows/task.md` carries exactly ONE seam invocation (the `risk-check run`
  line at :79) and zero `trace`/`route.mjs resolve` calls, and its `cad-executor`
  exception dispatches a subagent with no `--bracket-read` at all. Measured on the
  live record 2026-08-23 (1,803 events): 8 phase-0 events, all
  `outcome/risk_check`; `trace render --phase 0` returns `brackets: []` and
  `counts.lifecycle: 0`. Evidence: `cadence-core/workflows/task.md:63-64,79`.
- D-12 (the pins): `workflows/task.md` sits inside TWO pins and outside a third,
  so both re-pins travel in the commit that grows them.
  `weight-budgets.json:75` pins it at 7822 bytes and `self-verify.mjs:737` files
  `budget-overrun`; `arg-contract.test.mjs:303` asserts the flag table declares
  exactly 173 entries, which any new subcommand's flags move. The seam-call census
  carries rows only for `workflows/context.md` and `workflows/plan.md`, so it does
  not cover this file. Whether `task.md` joins `trace.test.mjs:1756`'s `BRACKETING`
  map is the planner's call - that map lists eight files and not this one, and its
  own comment says a file absent from it is checked by nothing. Evidence:
  `cadence-core/bin/weight-budgets.json:75`;
  `cadence-core/bin/arg-contract.test.mjs:303`;
  `cadence-core/bin/seam-calls.test.mjs` (CENSUS);
  `cadence-core/bin/trace.test.mjs:1756`.

## Acceptance criteria

- [ ] AC1: The record subcommand writes `.planning/tasks/<slug>/RECORD.md`
      carrying a `## Commits` table and `- **Files:**` lines, and
      `node cadence-core/bin/planning.mjs recall "<terms naming what that task
      did>"` returns that file among its results. On a repo with no `.planning/`
      at all it creates none, writes no record, and returns a stated reason on
      its envelope.
- [ ] AC2: `node cadence-core/bin/why.mjs <a file named in a task record>`
      resolves that commit to the task's slug instead of reporting the gap,
      checked against a real record on disk rather than a fixture.
- [ ] AC3: `node cadence-core/bin/planning.mjs trace render --phase 0` shows the
      run's bracket paired under a per-run correlation id with `cad-task` in the
      `roles` block; on the inline arm its token and turn totals read
      `unrecorded`, and that arm's trace holds zero `lifecycle/dispatch` events.
      Two runs of the same slug produce two brackets, neither in `unpaired`.
- [ ] AC4: `node cadence-core/bin/test.mjs` fails when either the
      `risk-check run --phase 0` line or the `written: false` withholding
      sentence is removed from `cadence-core/workflows/task.md`, and the failure
      message names which one is missing.
- [ ] AC5: `cadence-core/workflows/task.md` names no context step, no plan gate
      and no verify walk: a grep for `cad-context`, `cad-plan-checker` and
      `cad-verify` in that file returns nothing.
- [ ] AC6: `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true`
      with `problems: []`, and `node cadence-core/bin/test.mjs` reports 0
      failures.
- [ ] AC7: Running `/cad-task` end to end in a session writes the record, opens
      and closes its bracket exactly once, and reports the record's path in its
      `done` block. (human-verify: needs a live /cad-task session)

## Flagged assumptions

- The ROADMAP entry says `Zero planning artifacts for inline tasks` "survives
  this phase intact" while D-01 puts a tracked record under
  `.planning/tasks/<slug>/` on both paths; the two cannot both hold as written.
  Resolved for planning as: the surviving invariant is that the inline path
  creates no `.planning/` scaffolding WHERE NONE EXISTS, and `task.md`'s own
  success criterion is reworded to what it actually protects - no PLAN.md and no
  SUMMARY.md. User-confirmed reading, 2026-08-23; if wrong, AC1's second sentence
  and the `workflows/task.md` success-criterion edit both change.
- Whether `workflows/task.md` joins `cadence-core/bin/trace.test.mjs:1756`'s
  `BRACKETING` map is left to the planner - Likely it should, since a file absent
  from that map is checked by nothing and the bracket prose is exactly what the
  map exists to pin; if wrong, the bracket's prose can be edited away with the
  suite green.
