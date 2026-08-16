---
phase: 1
plan: 2
requirements: [TRN-01]
files:
  - cadence-core/bin/lib/text-transport.mjs
  - cadence-core/bin/text-transport.test.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/weight-budgets.json
  - cadence-core/references/conventions.md
  - cadence-core/references/plan-revision.md
  - cadence-core/references/review-triggers.md
  - cadence-core/references/triage-gate.md
  - cadence-core/references/seams.md
  - cadence-core/workflows/plan.md
  - cadence-core/workflows/decision-review.md
  - cadence-core/workflows/minimalism-review.md
  - cadence-core/workflows/execute.md
  - cadence-core/workflows/context.md
  - cadence-core/workflows/verify-deep.md
  - cadence-core/workflows/verify.md
  - cadence-core/workflows/milestone.md
  - cadence-core/workflows/progress.md
  - cadence-core/workflows/undo.md
  - skills/cad-land/SKILL.md
  - skills/cad-pause/SKILL.md
---

# Phase 1: One transport for caller-derived text - Plan 2 (register, check, sweep)

## Goal

The transport rule is stated once, every examined site is classified in a
committed register a check reads, and every site the register calls
caller-derived prescribes the file transport - with the check demonstrated
failing against the real tree before the prose is fixed.

## Must be true when done

- `cadence-core/references/conventions.md` states the transport rule once,
  including the derivation test (the value is derived from agent output or
  repository content rather than authored by the workflow itself); every site
  this plan converts cites that path and states the action, and no converted
  site restates the reasoning.
- A frozen register module under `cadence-core/bin/lib/` carries one row per
  examined site - surface, flag, the value it passes, its caller-derived
  classification, and a reason on every out-of-scope row - a test pins the row
  count, and `node cadence-core/bin/self-verify.mjs` reads that module rather
  than a markdown table.
- At the commit where the register and the check land and no prose is fixed
  yet, `node cadence-core/bin/self-verify.mjs` exits 1 and prints a non-empty
  list naming real tree surfaces; that SHA and that list are recorded in the
  phase SUMMARY.
- Every site the register classifies caller-derived prescribes the file
  transport, and `skills/cad-land/SKILL.md` prescribes
  `git tag -a <version> -F <path>` with no `-m "<...>"` carrying a
  repository-derived label left in the tree.
- The out-of-scope sites are untouched and unreported: the seven literal
  `cursor set --next "/cad-<command> N"` sites still prescribe the inline form,
  no enum- or integer-validated flag gained a `-file` variant, and the check
  reports no problem for any of them.
- `node --test 'cadence-core/bin/*.test.mjs'` and
  `node cadence-core/bin/self-verify.mjs` both exit 0 at the plan's last commit.

## Context

Locked: D-06 (the rule is stated ONCE in `references/conventions.md` and CITED
BY PATH - not `@`-included, not a new reference file, so no
`weight-budgets.json` entry is added, no check-16 consumer sentence and no
`DEFERRED_READS` row), D-07 (the enumeration is a FROZEN REGISTER MODULE under
`cadence-core/bin/lib/`, `DEFERRED_READS`-shaped, read by `self-verify.mjs` and
count-pinned in a test - never a markdown table), D-09/D-10/D-11 (the check
cannot reuse check 2's invocation parser, the discriminator is the immediately
following quoted value, and a site it can classify as neither safe nor unsafe is
a reported KIND, never a silent skip), D-13 (`weight-budgets.json` is in this
lease; 16 of 17 candidate surfaces sit at exactly 0 B headroom), D-14 (the
watched FAIL is a RUN RECORD at an intermediate SHA, never a permanent test
asserting the tree is broken), D-02 and D-03.
Depends on Plan 1: every `-file` flag this plan's prose prescribes must already
exist at the seam.
Out of scope: deleting any inline form; the seven literal `--next` sites; the
enum- and integer-validated flags; the two sites that name `--text "<...>"` in
order to FORBID it (they get register rows, not edits).

## Tasks

### Task 1: The register and the check that reads it, watched failing on the real tree

- **Files:** cadence-core/bin/lib/text-transport.mjs,
  cadence-core/bin/text-transport.test.mjs, cadence-core/bin/self-verify.mjs,
  cadence-core/bin/self-verify.test.mjs
- **Action:** Add one frozen module under `cadence-core/bin/lib/` holding BOTH
  the register and the pure rule, the way `lib/deferred-reads.mjs` holds
  `DEFERRED_READS` beside `deferredReadIssues` and its `CODES` map (D-07), and
  call it from `self-verify.mjs` as a new check over the same `mdFiles` walk the
  prose checks use, with a header block entry and a name added to the emitted
  `checked` string. The register carries ONE ROW PER EXAMINED SITE - the
  surface, the flag, the value the site passes verbatim, whether that value is
  caller-derived, and a reason string on every row that is not - keyed so two
  uses of one flag in one surface stay distinguishable, which
  `cadence-core/workflows/progress.md` requires: it carries both an in-scope
  composed `--next` and an out-of-scope literal one (D-02). Classify by D-01's
  test, per flag by the seam field's semantics and per SITE where the same flag
  carries a literal at one site and derived text at another; the sweep measured
  roughly 35 qualifying occurrences on 2026-08-16 across
  `cadence-core/{workflows,references}` and `skills/`, but the register's own
  enumeration is the authority and the count-pin follows it. The rule scans a
  surface for the watched inline flags and files, per occurrence: an occurrence
  whose row says caller-derived (the site still prescribes the unsafe form); an
  occurrence with no row at all (site seventeen); and, per D-11, an occurrence
  whose value the scan cannot delimit - an unquoted placeholder, a value broken
  across a line, an interpolated composite - resolved against a row for that
  surface and flag when one exists and REPORTED as its own kind when none does,
  never skipped. An occurrence whose row states a reason is silent. Build the
  scan on the flag token with a boundary, so `--label-file` is never matched as
  `--label`, and on the immediately following quoted value (D-10), so
  `OMIT \`--detail\`` at `cadence-core/workflows/execute.md:209`, the arm
  sentence at `cadence-core/references/seams.md:121` and the `--raised`
  paragraph at `cadence-core/references/review-triggers.md:286` stay green
  without rows. Do NOT build it on check 2's invocation join at
  `self-verify.mjs:699-728`: 30 of the qualifying mentions sit in prose
  fragments with no `<script>.mjs <word>` prefix and `if (!contract) continue`
  skips every one (D-09). The tests here use SYNTHETIC roots only, the way
  `self-verify.test.mjs` builds fixtures at `:92-193`; do NOT add a
  "the live tree is clean" assertion in this task - the tree is deliberately
  dirty at this commit and that assertion belongs to task 7 (D-14). Commit this
  task ALONE, then run the check and keep its full output: that run is the
  phase's watched-FAIL evidence and the SUMMARY must record the SHA and the
  site list it printed (AC3).
- **Verify:** `node --test 'cadence-core/bin/text-transport.test.mjs'
  'cadence-core/bin/self-verify.test.mjs'` exits 0, with a test that pins the
  register's row count and proves the export is frozen, and synthetic-root tests
  producing each of the three kinds and proving a reasoned out-of-scope row is
  silent. At this task's commit `node cadence-core/bin/self-verify.mjs` exits 1
  and its `problems` name at least `cadence-core/workflows/execute.md`,
  `cadence-core/workflows/verify.md`, `cadence-core/workflows/milestone.md` and
  `cadence-core/references/review-triggers.md`, while no problem's detail names
  a `--next` site in `adopt.md`, `new-project.md`, `plan.md`, `context.md` or
  the `/cad-phase add` site in `progress.md`, and none names `--phase`,
  `--status`, `--result`, `--severity` or `--origin`.
  `node --test 'cadence-core/bin/*.test.mjs'` still exits 0.

### Task 2: State the transport rule once, in `conventions.md`

- **Files:** cadence-core/references/conventions.md,
  cadence-core/bin/weight-budgets.json
- **Action:** Add one short section to `cadence-core/references/conventions.md`
  stating the transport rule and its derivation test: a value derived from agent
  output or repository content rather than authored by the workflow itself goes
  to the seam as a PATH, because a double-quoted shell word carrying `$(...)` or
  a backtick executes before Node starts and a path cannot; the inline form
  stays for a human typing at a shell, where the text is the user's own. State
  it in that file's existing one-line-rules voice (see its `## Config
  resolution` and `## Subagents and reviews` sections) and cite nothing new -
  D-06 puts the rule HERE precisely because the file already describes itself as
  rules cited by path, which is why this phase adds no `weight-budgets.json`
  entry, no check-16 consumer sentence and no `DEFERRED_READS` row. Do not
  `@`-include it anywhere and do not create a second reference file. Re-pin
  `cadence-core/references/conventions.md` in `weight-budgets.json` from
  `node cadence-core/bin/weight.mjs --root .` in this same commit - it sits at
  exactly 0 B headroom (D-13) - and re-pin nothing else.
- **Verify:** `node cadence-core/bin/self-verify.mjs` reports no
  `budget-overrun` and no `unbudgeted-surface` problem (the transport check's
  own problems are still expected at this commit); `grep -c` on
  `cadence-core/references/conventions.md` finds the derivation test stated
  once, and the phrase appears in no other file under `cadence-core/references/`
  or `cadence-core/workflows/`.

### Task 3: Move the review and planning dispatch sites onto the file transport

- **Files:** cadence-core/workflows/plan.md,
  cadence-core/references/plan-revision.md,
  cadence-core/workflows/decision-review.md,
  cadence-core/workflows/minimalism-review.md,
  cadence-core/references/review-triggers.md,
  cadence-core/references/triage-gate.md,
  cadence-core/bin/lib/text-transport.mjs, cadence-core/bin/weight-budgets.json
- **Action:** At every site in these six surfaces the register classifies
  caller-derived, replace the inline `--detail "<...>"` with `--detail-file
  <path>` and the inline `--read "<...>"` with `--read-file <path>`, telling the
  site to write the value to a scratch file and pass the PATH and citing
  `references/conventions.md` for WHY - one clause, not a restatement of the
  reasoning (AC1). These carry the composed-value sites the phase exists for:
  the empty-or-unmarked return details at `plan.md:191,289` and
  `plan-revision.md:27,55`, the `<what failed>` details at
  `decision-review.md:65`, `minimalism-review.md:91` and
  `review-triggers.md:135`, the adjudication detail at `review-triggers.md:279`
  (whose value interpolates a trigger, a survivor count and a model-composed
  voice list), and the two target references at `decision-review.md:52` and
  `minimalism-review.md:73`. Leave `review-triggers.md:111`'s
  `--read "<the payload reference>"` and `triage-gate.md:46`'s
  `--detail "<trigger>"` exactly as the register classifies them - if either row
  says out-of-scope, do not touch the site. Do not add a second seam invocation
  anywhere: `seam-calls.test.mjs` pins `plan.md` at 9 seam calls and a converted
  site must stay ONE call. Do not move the `--raised` rule at
  `review-triggers.md:286` - the raised count stays a flag. Update the register
  rows this task converts so the register still describes the tree, and re-pin
  every surface this task grew in `weight-budgets.json`, in this commit.
- **Verify:** `node --test 'cadence-core/bin/*.test.mjs'` exits 0 (including
  `seam-calls.test.mjs`'s census rows), and `node cadence-core/bin/self-verify.mjs`
  reports no problem naming any of these six surfaces - neither a transport
  problem, nor `unknown-flag` from check 2, nor `budget-overrun`.

### Task 4: Move the execute, context and verify-deep dispatch sites

- **Files:** cadence-core/workflows/execute.md,
  cadence-core/workflows/context.md, cadence-core/workflows/verify-deep.md,
  cadence-core/references/seams.md, cadence-core/bin/lib/text-transport.mjs,
  cadence-core/bin/weight-budgets.json
- **Action:** Convert the caller-derived close details at `execute.md:206`
  (`--detail "<one line>"`), `context.md:184` and `verify-deep.md:19` to
  `--detail-file <path>` on the same one call, each citing
  `references/conventions.md` by path for the reasoning. The prose around them
  that merely NAMES the flag - `execute.md:209`'s OMIT sentence and
  `verify-deep.md:22`'s carry sentence - keeps its meaning and must now be true
  of both transports: the arm is chosen by whether a detail was given at all,
  not by which flag carried it. Extend the one statement of that rule at
  `references/seams.md:121` ("picks the arm off `--detail`") to name the file
  form too - that paragraph is explicitly the ONE statement dispatch sites point
  at, so it is corrected there and nowhere else. Leave `execute.md:409`'s
  `--text "<item>"` untouched: it names the flag in order to forbid it and the
  register records it as such. Update the register rows this task converts and
  re-pin every surface this task grew in `weight-budgets.json`, in this commit.
- **Verify:** `node --test 'cadence-core/bin/*.test.mjs'` exits 0 (the
  `context.md` census row in `seam-calls.test.mjs` still reads 6), and
  `node cadence-core/bin/self-verify.mjs` reports no problem naming
  `cadence-core/workflows/execute.md`, `cadence-core/workflows/context.md`,
  `cadence-core/workflows/verify-deep.md` or `cadence-core/references/seams.md`.

### Task 5: Move `verify.md`'s failing-item records onto `--fields-file`

- **Files:** cadence-core/workflows/verify.md,
  cadence-core/bin/lib/text-transport.mjs, cadence-core/bin/weight-budgets.json
- **Action:** At `verify.md`'s failing-item sites, prescribe
  `uat record ... --fields-file <path>` for the free-text fields the register
  classifies caller-derived - the model-composed evidence string at `:178`, the
  verbatim user reply and reason at `:230`, and the root cause at `:241` - with
  the enum and integer flags (`--phase`, `--item`, `--result`, `--severity`,
  `--source`, `--origin`) staying inline on the same call, since D-01 puts them
  out of scope by construction and D-05 chose one fields file precisely so a
  failed item costs ONE extra Write and not three. Say to write the JSON object
  of those fields to a scratch file and pass the path, citing
  `references/conventions.md` for why. Leave `:271`'s `--fix "{hash}, retest"`
  and `:273`'s `--fix "routed to /cad-plan"` inline if the register classifies
  them workflow-authored, and leave `:294`'s `--detail "<complete or partial>"`
  and `:306`'s `--next` as the register classifies them - do not sweep a site
  the register calls out-of-scope. The one-call-per-item rule and the "never a
  `uat merge` payload" sentence at `:181-184` are unchanged and must stay true:
  `--fields-file` is not a payload merge.
- **Verify:** `node --test 'cadence-core/bin/*.test.mjs'` exits 0 and
  `node cadence-core/bin/self-verify.mjs` reports no problem naming
  `cadence-core/workflows/verify.md`; the file still prescribes exactly one
  `uat record` call per item and names `--fields-file` at each site the register
  marks caller-derived.

### Task 6: The milestone label - `--label-file` at the prune, `-F` at the tag

- **Files:** cadence-core/workflows/milestone.md, skills/cad-land/SKILL.md,
  cadence-core/bin/lib/text-transport.mjs, cadence-core/bin/weight-budgets.json
- **Action:** Two sites, one value. At `cadence-core/workflows/milestone.md:96-100`
  prescribe `milestone-prune --label-file <path> --mode <delete|archive>`,
  keeping the surrounding statement of what `<label>` IS (the version on a
  release, else the milestone name from PROJECT.md) and the `--mode` guidance
  unchanged, and citing `references/conventions.md` for the transport. At
  `skills/cad-land/SKILL.md:186` swap `git tag -a <version> -m "<milestone
  label>"` for `git tag -a <version> -F <path>`, telling the step to write the
  label to a file first: this is the one site in the tree that provably puts
  repository content - a PROJECT.md milestone name - into a double-quoted shell
  word, and it is the goal statement's own example (D-03). Everything else about
  that step is untouched: the `git.create_tag` condition, the tag-membership
  test, the separate ask before any push, and the "never auto-push a tag" rail.
  Update the register rows and re-pin both surfaces in `weight-budgets.json`, in
  this commit.
- **Verify:** `node --test 'cadence-core/bin/*.test.mjs'` exits 0,
  `node cadence-core/bin/self-verify.mjs` reports no problem naming
  `cadence-core/workflows/milestone.md` or `skills/cad-land/SKILL.md`, and a
  tree-wide grep for `git tag -a` finds no surviving `-m "<...>"` form.

### Task 7: The two composed cursor pointers, and the live tree held clean

- **Files:** cadence-core/workflows/progress.md, skills/cad-pause/SKILL.md,
  cadence-core/bin/lib/text-transport.mjs, cadence-core/bin/self-verify.test.mjs,
  cadence-core/bin/weight-budgets.json
- **Action:** Convert the two COMPOSED `cursor set --next` sites to
  `--next-file <path>` - `skills/cad-pause/SKILL.md:33-34`, whose pointer is a
  one-line "where I was" taken from `$ARGUMENTS` or the user's answer, and
  `cadence-core/workflows/progress.md:58`, whose pointer is routed from the
  derivation below it - each citing `references/conventions.md`. Leave the seven
  literal sites (`adopt.md`, `new-project.md`, `milestone.md`, `plan.md`,
  `context.md`, `execute.md`, and `progress.md`'s own `/cad-phase add` line)
  prescribing the inline form: their value is a slash command the workflow
  authors (D-02, AC6). Then add the live-tree assertion this plan has been
  building toward, in the shape `self-verify.test.mjs` already uses for checks
  14 and 16 - `run(['--root', REPO])` filtered to the transport check's kinds,
  asserting an empty list - so a reintroduced inline site reddens CI from the
  test side as well as the linter side. Re-pin both surfaces in
  `weight-budgets.json`.
- **Verify:** `node --test 'cadence-core/bin/*.test.mjs'` exits 0 with the new
  live-tree test passing, and `node cadence-core/bin/self-verify.mjs` exits 0
  with `problems: []` on the whole tree. `git grep -n 'cursor set'` still shows
  the seven literal `--next "/cad-..."` sites unchanged.

## Notes

- Task ordering is load-bearing and not a preference: AC3 requires a commit
  where the register and the check exist and no prose is fixed, so task 1
  commits alone and its self-verify run (exit 1, with the printed site list) is
  the phase's watched-FAIL evidence. CI will be red at that one SHA by design;
  the branch tip is green.
- The register is the deliverable that SETTLES the site list (D-08's flagged
  assumption). Three sites the analyzer's list did not name need a classification
  in task 1 rather than an assumption: `references/triage-gate.md:46`
  (`--detail "<trigger>"`), `cadence-core/workflows/verify.md:294`
  (`--detail "<complete or partial>"`), and `cadence-core/workflows/undo.md:49`
  (`--next "<the redo step>"`). None is edited by any task above; if the register
  classifies one caller-derived, its conversion is a deviation to record.
  `cadence-core/workflows/undo.md` is IN this lease (added at the `plan` trigger)
  precisely so a caller-derived verdict on `undo.md:49` can be acted on in task 7
  rather than stranding the live-tree assertion behind an undeclared file; if the
  register classifies it out of scope, the file is simply never edited.
- `cadence-core/bin/self-verify.mjs` is shared with Plan 1 (the `CONTRACTS`
  rows there, this check here). The plans must run sequentially, Plan 1 first;
  the reported overlap is what makes `plan-overlap` refuse the parallel path.
- Every converted site costs one extra scratch-file Write per fire at runtime.
  That cost is invisible to `seam-calls.test.mjs`, which counts only
  `node "${CLAUDE_PLUGIN_ROOT}/..."` invocations - so no census row moves, and
  none should be edited to make one move.
