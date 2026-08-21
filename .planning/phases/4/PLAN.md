---
phase: 4
plan: 1
requirements:
  - RDX-01
files:
  - cadence-core/bin/lib/read-trace.mjs
  - cadence-core/bin/read-trace.test.mjs
  - cadence-core/bin/lib/trace-suggest.mjs
  - cadence-core/bin/trace-suggest.test.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/fixtures/reread.reads.jsonl
  - cadence-core/bin/fixtures/reread.trace.jsonl
  - cadence-core/workflows/report.md
  - cadence-core/workflows/suggest.md
  - cadence-core/bin/weight-budgets.json
  - cadence-core/bin/prose-agreement.test.mjs
  - .planning/spikes/read-set-redundancy/measure.mjs
  - .planning/spikes/read-set-redundancy/measure2.mjs
---

# Phase 4: The number nobody can spend - Plan

## Goal

The in-dispatch read redundancy `lib/read-trace.mjs` already computes reaches a
consumer that acts on it: `trace suggest` opens `.planning/reads.jsonl`, and a
role over its own threshold produces a per-file entry naming the worst offender
in one dispatch, with the coverage and the exclusions it rests on stated beside
it.

## Must be true when done

- `node cadence-core/bin/planning.mjs trace suggest` on this repository returns
  an entry for `cad-executor` carrying its in-dispatch re-read ratio and the
  single worst file inside one dispatch, in the form "read `<path>` N times"
  (SC1, SC3).
- That entry names NO config key. It states in words that no key in
  `config.schema.json` governs in-dispatch re-reading and names the discipline
  remedy instead, and a test fails if it ever points at one (SC7).
- The threshold is per role: `cad-executor` and `cad-verifier` can produce the
  entry and `cad-planner`, `cad-assumptions-analyzer` and `cad-reviewer` cannot,
  whatever ratio the record shows for them (SC2).
- A record with no file-carrying reads produces no entry at all, and NEITHER
  surface renders a null ratio as `0`: `trace suggest` emits nothing, and
  `/cad-report`'s reading rule is given the live `calls > 0` case with a null
  in-dispatch ratio and told to say nothing about it (SC4).
- The entry states what it does not cover, in its own evidence string and not
  only in workflow prose: the file-carrying share of the reads it was computed
  over, the SCOPE those reads span - nothing prunes `.planning/reads.jsonl` at a
  close, so an unscoped run reaches every milestone in the file - and the count of
  `coordinator` reads it excluded with the reason those cannot be attributed
  (SC5, SC6).
- `/cad-report`'s reading line and `trace suggest`'s entry come from ONE
  implementation - the same per-role figure is on the `reads --join` envelope and
  neither prose surface recomputes it (SC8).
- `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with an
  empty `problems` array (SC9).

## Context

- No `CONTEXT.md` for this phase. Scope comes from
  `.planning/spikes/read-set-redundancy/SPIKE.md`, whose measured figures are
  settled inputs and are not re-derived here: in-dispatch redundancy is
  `cad-executor` 3.64 over 78 dispatches, `cad-verifier` 2.05 over 31,
  `cad-planner` 1.88, `cad-assumptions-analyzer` 1.78, `cad-reviewer` 1.74; the
  worst single case is `cadence-core/bin/planning.mjs` read 29 times inside one
  `cad-executor` bracket; 1,073 of 3,611 file/dispatch pairs are re-read three or
  more times. The suggestion is PER FILE, not per role, and `coordinator` reads
  are outside anything this lever can measure.
- **The open question is decided in this plan, not deferred to a task: no
  existing config key expresses the remedy, and none is invented.** The evidence
  is in Notes; task 2 carries it into the source and pins the arm with a test.
- The existing seams this plan extends rather than replaces: `summarizeReads`
  and `joinReads` in `cadence-core/bin/lib/read-trace.mjs`, `suggestFromRender`
  and its R1-R6 rules in `cadence-core/bin/lib/trace-suggest.mjs`, `cmdReads` and
  the `sub === 'suggest'` arm of `cmdTrace` in `cadence-core/bin/planning.mjs`.
- Out of scope, deliberately: any new config key, any new seam flag (the
  `trace suggest` row in `lib/arg-contract.mjs` stays `--phase` alone), and any
  change to `summarizeReads`'s existing `redundancy` / `fileRedundancy` figures,
  which every record on disk is already read through.

## Tasks

### Task 1: Fold joined reads into per-role in-dispatch file figures

- **Files:** cadence-core/bin/lib/read-trace.mjs (start at `joinReads` and
  `summarizeReads`), cadence-core/bin/read-trace.test.mjs
- **Action:** Add one exported pure function beside `joinReads` that turns joined
  reads into PER-ROLE in-dispatch file figures. The arithmetic is the spike's
  corrected pass and must not be re-derived: group every row `joinReads` reports
  with status `joined` by the bracket it joined to (the bracket row
  `lib/trace.mjs` pushes carries `corr`, `phase`, `plan`, `role`, `ts`, `end`),
  count within that ONE bracket how many times each path in the record's `files`
  array was touched, then per role sum touches over the SUM of per-bracket
  distinct paths. Summing distinct per bracket is what makes the ratio
  in-dispatch; one distinct-file count across a role's whole corpus measures the
  opposite thing and cannot tell "re-read 20 times inside one dispatch" from
  "read once in each of 20 dispatches", which is the error `SPIKE.md` records its
  first pass making. `joinReads`'s rows do not carry the record's `files` today -
  carry that array onto the row rather than re-implementing the containment test
  or zipping rows to records by array position: the one-implementation rule
  starts here, and a positional zip breaks silently the first time either side
  filters a record the other keeps. Return, per role: the bracket count, touches,
  summed distinct, the ratio, and the worst single file/bracket pair with its
  count and that bracket's `phase` and `plan`. The ratio is `null` when the
  summed distinct is 0 - never `0` - which is the absent-is-not-a-measurement
  posture `summarizeReads` already states for both of its own ratios. Return two
  more figures the callers must STATE rather than assume: the share of joined
  in-scope reads that carried a `files` array, which is the coverage the ratio
  was computed over, and the count of `coordinator` reads carrying files that no
  bracket can attribute (`joinReads` already gives coordinator its own status;
  those hold 4,395 file-carrying reads on this repository today, so the limit is
  stated rather than discovered). Round the ratio the way `summarizeReads` rounds
  its two, through `Number(x.toFixed(2))`, so the three figures print alike. Do
  no I/O: this file is pure by injection and stays so - the caller supplies the
  records and the brackets.
- **Verify:** `node --test cadence-core/bin/read-trace.test.mjs` passes with new
  cases proving each of: two `cad-executor` brackets, one touching `a.mjs` six
  times and `b.mjs` once and the other `a.mjs` five times, report 12 touches over
  3 summed distinct for a ratio of 4 with the worst pair naming `a.mjs` at 6 and
  the bracket that held it; a role whose joined reads carry no `files` array
  reports a `null` ratio rather than 0; a `coordinator` read carrying files
  raises the excluded count and contributes to no role's figures; a read joined
  to no bracket contributes to nothing.

### Task 2: The rule, its per-role thresholds, and the no-lever decision

- **Files:** cadence-core/bin/lib/trace-suggest.mjs (start at the R6 block at the
  end of `suggestFromRender`), cadence-core/bin/trace-suggest.test.mjs
- **Action:** Add a rule after R6, numbered and commented in the same style, that
  reports in-dispatch re-reading. Its input arrives as a THIRD optional parameter
  on `suggestFromRender` beside `render` and `resolution`, for the reason this
  file's header already gives for the second: the rules stay pure and the caller
  owns every read. An absent third argument leaves the rule silent and every
  existing one- and two-argument call unchanged. The threshold is PER ROLE
  through an exported frozen map naming ONLY the two roles the spike found signal
  in - `cad-executor` at 3.00 and `cad-verifier` at 2.00 - and a role the map does
  not name never produces an entry whatever its ratio, because `cad-planner`
  (1.88), `cad-assumptions-analyzer` (1.78) and `cad-reviewer` (1.74) sit in a
  band the spike calls noise where firing spends the user's attention to save
  nothing. State the derivation in the comment: `cad-verifier`'s floor is the
  spike's own C2 bar of 2.0, which it clears at 2.05, and `cad-executor`'s sits
  above that bar because that role legitimately returns to a file once per task
  across up to `workflow.max_plan_tasks` tasks in one dispatch - 3.00 leaves it
  speaking on today's 3.64 and goes quiet on a real improvement. The entry is
  `kind: 'info'` with `action: null`, and that is this phase's answer to which
  config key a high redundancy moves: none does. Record the falsifying check in
  the comment, taken over every key in `cadence-core/config.schema.json` -
  `workflow.max_dispatch_tokens.<role>` is report-only by its own purpose text,
  so moving it changes when `trace window` complains and not what a worker opens;
  `workflow.max_plan_tasks` counts tasks, was re-decided at 8 in `v3.5.3` under
  PLN-01 against cold-prefix cost and context risk, neither of which is
  in-dispatch re-reading, and lowering it moves the same file opens into more
  dispatches rather than removing them, improving this ratio while raising the
  bill; `model.effort.*` and `model.overrides.*` choose a rung and a model. The
  remedy that does exist is discipline rather than configuration - symbol anchors
  on a plan's `files:` and targeted reads over whole-file ones - and it is already
  filed at `.planning/CAPTURE.md:271`; name it in the entry instead of a key.
  This follows R6's precedent exactly, which is `action: null` because no schema
  key governs coordinator spend. The evidence string carries, in one line: the
  role and its in-dispatch ratio; the worst offender as "read `<path>` N times"
  inside one dispatch, naming that dispatch's phase and plan; the DIRECTION the
  figure should move, in words - down - because SC1 asks for one and the
  `Suggestion` vocabulary below stays closed to a `direction` field; the coverage
  share the ratio was computed over; the SCOPE those reads span, that nothing
  prunes `.planning/reads.jsonl` at a close so an unscoped run reaches every
  milestone in the file; the count of `coordinator` reads excluded and the reason
  they cannot be attributed; and the explicit statement that no config key governs
  this, with the discipline remedy named. The direction and the scope ride the
  evidence string for the same reason every other element does, and they are not
  optional: SC1 names the direction and SC5 names the scope, and prose in
  `suggest.md` cannot satisfy either for a reader who runs the seam directly. All of it rides the evidence
  string because `cadence-core/workflows/suggest.md` relays evidence unchanged
  and adds no flag - the same reason R5 rides `SPEND_EXCLUDES` in its evidence
  rather than on the envelope. The rule emits nothing at all - not an entry
  saying nothing - when the third argument is absent, the role is not in the map,
  the ratio is `null`, or the ratio is below the role's floor; a null ratio must
  never be rendered as `0`. Do not widen the `Suggestion` vocabulary: an info
  entry gains no `direction`, `current` or `proposed`, which this file's own D-12
  test pins and which `workflows/suggest.md`'s ask step depends on, since it
  builds `/cad-config <key>=<value>` tokens out of `action` plus `proposed` and
  an entry carrying either without a key would offer a token nobody can type.
- **Verify:** `node --test cadence-core/bin/trace-suggest.test.mjs` passes with
  new cases proving each of: `cad-executor` at 3.64 emits exactly one entry whose
  evidence contains the worst file and its count, the direction `down`, the
  coverage share and the scope sentence naming `.planning/reads.jsonl` as unpruned
  - four separate assertions over the one string, so dropping any one of them
  reddens on its own; `cad-planner` at 1.88 emits
  nothing AND `cad-planner` at 5.0 still emits nothing, so the map rather than
  the number is the gate; a role at exactly its floor emits; a `null` ratio emits
  nothing and no emitted evidence anywhere contains a zero ratio; a
  one-argument and a two-argument `suggestFromRender` call return exactly what
  they returned before. One test is the SC7 pin and says so in its name: the
  in-dispatch entry's `action` is `null` and its evidence contains the explicit
  no-config-key sentence, so a later edit pointing it at a key reddens. The
  existing test "config keys named in actions exist in config.schema.json" still
  passes unchanged.

### Task 3: `trace suggest` opens `.planning/reads.jsonl`

- **Files:** cadence-core/bin/planning.mjs (start at `cmdReads` and the
  `sub === 'suggest'` arm of `cmdTrace`), cadence-core/bin/fixtures/reread.reads.jsonl,
  cadence-core/bin/fixtures/reread.trace.jsonl, cadence-core/bin/trace-suggest.test.mjs
- **Action:** `cmdReads` holds the only `.planning/reads.jsonl` line parse in this
  file - its `readFileSync` plus the per-line `JSON.parse` that skips a truncated
  final line. Lift that into one local helper both arms call rather than adding a
  second parser: a partial tail must go on being skipped rather than costing the
  caller every complete record ahead of it, and two copies of that rule are two
  places for it to drift. The `suggest` arm already holds `renderTrace(dir, phase)`
  in `r`; join the parsed records against `r.brackets`, fold them with the
  function task 1 added, and pass the result to `suggestFromRender` as its third
  argument. Reuse the render already computed - a second `renderTrace` call
  re-reads the trace for nothing. The helper REPORTS what it hit and decides
  nothing: it distinguishes absent from unreadable and hands both back, so each
  caller keeps the posture it has today rather than inheriting one. `cmdReads`
  keeps its `fail('read-failed', 'cannot read <file>')` arm at
  `planning.mjs:3121` intact - that is the single production site and it has zero
  tests, so a helper that swallowed EACCES would change `reads`'s contract with
  nothing red, and `/cad-report`'s Reading line would go quiet as though the
  project had opened no files. The `suggest` arm takes the other posture and
  states it: an ABSENT file yields no rows and therefore no entry, never an error
  and never a zero, which is the posture `cmdReads`'s own ENOENT arm already
  states for a project that has not run since the hook was installed - while an
  UNREADABLE file yields no entry AND a `warnings` entry naming the file, through
  the warnings channel the suggest envelope already carries for exactly this class
  of partial read (`planning.mjs:3727-3731`, D-13). A permissions error loud on
  one face and invisible on the other is the outcome this paragraph exists to
  prevent. The `--phase N` scope needs no new flag
  and gets none: the brackets come from the phase-scoped render, so only reads
  inside that phase's dispatches join, and `trace suggest`'s row in
  `cadence-core/bin/lib/arg-contract.mjs` fixes its flag set while
  `workflows/suggest.md` states that adding one is a seam contract change. The
  `trace suggest` envelope gains no key - the entry rides `suggestions` like every
  other rule's. Add the two fixtures as their own pair rather than extending
  `fixtures/join.reads.jsonl` and `fixtures/join.trace.jsonl`: those are fixed
  exactly by `read-trace.test.mjs`'s partition assertion over 8 calls, none of
  their reads carries a `files` array, and their two `cad-executor` brackets
  deliberately overlap so a read between them is ambiguous rather than joined. The
  new pair needs non-overlapping brackets whose reads carry `files`, one file
  re-read enough to put its role over the floor task 2 set, a `coordinator` read
  carrying files, and a bracket for a role in the noise band.
- **Verify:** `node cadence-core/bin/planning.mjs --dir <a planning dir holding
  the two new fixtures> trace suggest` returns an entry naming the fixture's worst
  file and its exact count with `action: null`; the same run with the fixture's
  `files` arrays removed returns no such entry; `node
  cadence-core/bin/planning.mjs trace suggest` run in this repository returns a
  `cad-executor` entry whose ratio is at or above 3.00 and whose worst-file count
  is at least 3; with the fixture's `reads.jsonl` made unreadable, `reads --join`
  still returns `ok:false` `read-failed` and `trace suggest` returns no
  in-dispatch entry together WITH a `warnings` entry naming the file - one test
  asserting both faces, since neither has one today and the whole risk of lifting
  the parse is that they diverge; `node --test
  cadence-core/bin/trace-suggest.test.mjs` passes; `node
  cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with an empty
  `problems` array.

### Task 4: `reads --join` carries the same figure, so both faces read one seam

- **Files:** cadence-core/bin/planning.mjs (start at `cmdReads`),
  cadence-core/bin/read-trace.test.mjs
- **Action:** `cmdReads`'s `--join` arm gains the per-role in-dispatch rows from
  the same fold task 1 added and task 3 already calls, joined against the same
  `renderTrace(dir).brackets` that arm already computes, so `/cad-report` and
  `/cad-suggest` price re-reading off one implementation and neither recomputes
  it in prose. Put the rows under a key of their own beside the six join counts
  rather than folding them into `topFiles`, which is whole-corpus and per-file
  where these are per-dispatch and per-role. Two shapes stay byte-identical: the
  envelope without `--join`, because a reader that never asked for the join must
  not have to parse around it, which that arm's own comment states; and the `no
  reads recorded yet` ENOENT arm, which returns before the join.
- **Verify:** `reads --join` against the task 3 fixtures returns the per-role rows
  with the fixture's exact ratio and worst file; `reads` without `--join` against
  the same fixtures returns exactly the keys it returned before, with the existing
  `read-trace.test.mjs` seam assertions unchanged and still passing; `reads
  --join` against the `join.*` fixtures, whose reads carry no `files`, returns the
  new key holding nothing rather than a zero ratio; `node --test
  cadence-core/bin/read-trace.test.mjs` passes.

### Task 5: Both prose faces state the figure, its coverage and its exclusions

- **Files:** cadence-core/workflows/report.md, cadence-core/workflows/suggest.md,
  cadence-core/bin/weight-budgets.json, cadence-core/bin/prose-agreement.test.mjs
- **Action:** In `report.md`, the `Reading` line of the compose shape gains the
  per-role in-dispatch figure off the SAME `reads --join` return it already reads
  `fileCalls`, `fileRedundancy` and `topFiles` from, and the rule block below it
  gains the two statements the seam makes: the `coordinator` exclusion with its
  reason, and the coverage the in-dispatch ratio was computed over. Keep the two
  rules already there - that the line prices the WHOLE `.planning/reads.jsonl`
  rather than the phase, and that a `calls: 0` or `no reads recorded yet` return
  means saying nothing about reading at all, because a per-role block over an
  absent record reads as a run that opened no files. Add the THIRD rule neither of
  those covers, which is the live case: `calls > 0` with a NULL in-dispatch ratio.
  Every record written before the `files` field existed is that shape, and so is
  the committed `fixtures/join.reads.jsonl` at 8 calls with no `files` array. Say
  nothing about in-dispatch re-reading for a role whose ratio came back null, and
  never narrate it as `0` - that is the reading which says the worker opened each
  file once. Without the rule, the file's own standing instruction to report every
  figure as returned hands the composing model a null with no disposition.
  Recompute nothing in prose, which is that file's stated rule already. Re-measure
  the `reads --join` response and correct the byte figure in report.md's transport
  paragraph, which states "`reads --join` measures 1,507 B" as the basis for
  keeping that call inline under `references/conventions.md`'s 10,000-byte gate:
  task 4 grows that response, so the commit that grows it fixes the measurement.
  The transport decision does not flip - state the new figure, do not re-argue the
  gate. In `suggest.md`, `read_record` names
  the second file the seam now opens, so its "Do not open
  `.planning/trace.jsonl`" instruction stays true of everything a reader might
  reach for; and the `scope` step's existing sentence about nothing pruning
  `.planning/trace.jsonl` at a close gains its counterpart for
  `.planning/reads.jsonl`, plus the fact that that file carries no phase scoping
  of its own so a `--phase N` run reaches its reads only through that phase's
  dispatch brackets. Then the `present` step, which is where this phase's whole
  deliverable is otherwise buried. `info` is defined as "a receipt worth seeing
  that asks for nothing" and every one renders as a single line under heading two,
  while heading one prints exactly "the record supports no tweak in this scope"
  whenever the return carries `info` entries and no `suggest` entry. On an
  ordinary project with no other firing rule, `/cad-suggest` therefore prints that
  line directly above a receipt reporting a 3.64 in-dispatch re-read ratio and a
  file opened 29 times inside one dispatch. Do NOT fix that by widening the
  entry's `kind` or the `Suggestion` vocabulary - task 2 forbids both and
  `workflows/suggest.md`'s ask step depends on them. Fix the PROSE: heading one's
  no-tweak line states that it speaks about CONFIG KEYS specifically, and points
  at the receipts when an in-dispatch entry is present; and heading two's "An
  `info` asks for nothing" gains its one stated exception - an in-dispatch entry
  names a remedy that is not a key, and the reader is told what that remedy is
  rather than left with a ratio. Add no flag and no second seam call to either
  file - the one call each already makes returns all of this. Re-pin both files in
  `cadence-core/bin/weight-budgets.json` in the SAME commit: `self-verify`'s
  budget check reports `budget-overrun` when a surface exceeds its entry, so an
  unpinned edit fails this phase's own closing check.
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` passes with
  a new arm modelled on that file's MSR-02, which is this repo's one mechanism for
  pinning a workflow's prose to a seam: it slices report.md's Reading LINE and its
  rule block and asserts the `coordinator` exclusion, its reason, the coverage and
  the null-ratio rule all appear inside that block, then slices suggest.md's
  `present` step and asserts the no-tweak line's config-key qualifier is inside
  IT. A whole-file grep cannot serve here and must not be used: `grep -c
  coordinator cadence-core/workflows/report.md` already returns 12 on the
  pre-change tree, so it passes whether the clause is ever written or not.
  Falsify the new arm in both directions before moving on - delete each clause and
  watch it redden, restore it and watch it green - because an arm that was never
  seen to fail is the same unfalsifiable check one layer up. Then `node
  cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with an empty
  `problems` array, which is the re-pin's proof, and the `reads --join` response
  measured on disk agrees to the byte with the figure report.md now states.

### Task 6: Retire the spike's throwaway measurement code

- **Files:** .planning/spikes/read-set-redundancy/measure.mjs,
  .planning/spikes/read-set-redundancy/measure2.mjs
- **Action:** Delete both files. `SPIKE.md`'s own Throwaway section names them as
  not project source and says to delete them when `RDX-01` ships, which is this
  phase, and the arithmetic they hold is now in `cadence-core/bin/lib/read-trace.mjs`
  under test. Do not edit `SPIKE.md`: it is this phase's evidence record, its
  verdict cites `measure.mjs` for how the first pass was wrong, and git history
  keeps both files exactly the way it keeps every pruned phase artifact.
- **Verify:** `ls .planning/spikes/read-set-redundancy/` lists `SPIKE.md` alone;
  `node --test cadence-core/bin/read-trace.test.mjs cadence-core/bin/trace-suggest.test.mjs`
  still passes, so nothing in the tree was importing them.

## Notes

**The open question, decided here with its evidence: no existing config key
expresses the remedy, and no new one is invented.** The falsifying check was run
over all 78 keys in `cadence-core/config.schema.json` before taking the position -
78 counted as `Object.keys(schema.keys).length`, so the denominator a later reader
re-runs is the one that was actually checked.
The three closest candidates and why each is the "unrelated key" SC7 forbids
pointing at:

- `workflow.max_dispatch_tokens.<role>` is report-only by its own purpose text -
  "A crossing is REPORTED and nothing is refused... no dispatch path, agent
  frontmatter key or spawn seam consults it" - so moving it changes when `trace
  window` complains, not what a worker opens.
- `workflow.max_plan_tasks` counts tasks, not reads. It was re-decided at 8 in
  `v3.5.3` under PLN-01 against cold-prefix cost and context risk, neither of
  which is in-dispatch re-reading, `CAPTURE.md:271` records a 5-task plan
  declaring 812,591 B, and lowering it moves the same file opens into more
  dispatches rather than removing them - which improves this ratio while raising
  the bill. R4 already moves this key on checkpoint evidence; a second rule moving
  it on unrelated evidence would put two entries for one key in the same list.
- `model.effort.*` and `model.overrides.*` choose a rung and a model.

The remedy that does exist is discipline, not configuration - symbol anchors on a
plan's `files:` and targeted reads over whole-file ones - and it is already filed
at `.planning/CAPTURE.md:271` as parts 2 and 3 of a three-part fix whose part 1
is the unshipped `workflow.max_plan_tokens`. Minting that key here to have
somewhere to point would ship a key nothing reads, which is what the ROADMAP
forbids in as many words.

**How that decision meets SC1 and SC7 together.** SC7 is the conditional arm SC1
is written against, and this phase takes it: the entry carries the role, the
measured ratio in force, the direction IN WORDS - down, carried in the evidence
string rather than in a `direction` field, which the closed `Suggestion`
vocabulary has no room for - and the target (the named file and its count), and
states in words that no config key governs it rather than naming one. Task 2's
evidence enumeration names the direction and its Verify pins it, so every element
this paragraph claims is a test rather than an assertion, and so is which arm
shipped.

**Coverage, and which denominator is stated.** The seam states the file-carrying
share of the JOINED reads in scope - the denominator the in-dispatch ratio is
actually computed over - which is 6,423 of 10,114 on this repository today.
`SPIKE.md`'s C1 figure of 0.61-0.62 is the same fact over the whole file
(`fileCalls / calls`, 11,780 of 19,388), which `summarizeReads` already returns
and `/cad-report` already prints. Both are computed, neither is hardcoded.

**Plan shape.** The dispatch gave no `Plan shape` directive (no CONTEXT.md for
this phase). One plan, not split: tasks 3 and 4 both write
`cadence-core/bin/planning.mjs` and tasks 1-4 share the two test files, so no
independent slice exists.

**What the `plan` review changed, and why the record says `downgraded`.** The
blocking `plan` trigger fired on 2026-08-21 and PASSED - 8 findings raised, none
`blocker` or `high` - and its rulings are at
`.planning/phases/4/ADJUDICATION-plan-cad-plan-51be1408.json`, where all 8 read
`downgraded`: at the gate none reached the halt bar and none was fixed, and the
record's vocabulary has no fourth value for "grounded but not halting". All 8
were then folded into this plan on the user's instruction, after that settle.
They are: task 5's Verify replaced, because its `grep -n "coordinator"` already
matched 12 times on the pre-change tree and could not fail; the scope half of SC5
and the direction element of SC1 moved INTO the evidence string, where a reader
running the seam directly can see them; the null-ratio rule added to report.md's
reading block for the live `calls > 0` case; `cmdReads`'s `read-failed` arm
pinned against the lifted parse; `suggest.md`'s `present` step brought into task
5 so the deliverable is not printed under "the record supports no tweak in this
scope"; the schema key count corrected from 77 to 78; and report.md's stale
`reads --join` byte figure folded into task 5. The record is not re-written for
them - a second record is a second FIRE, and no reviewer ran again.

**Task 6 is instructed by a source artifact, not added scope.** It closes
`SPIKE.md`'s own "delete when `RDX-01` ships" instruction and matches no ROADMAP
success criterion; drop it if the milestone close is preferred as the moment for
that deletion.
