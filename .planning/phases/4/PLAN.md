---
phase: 4
plan: 1
requirements:
  - TRC-08
files:
  - cadence-core/bin/lib/trace.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/planning-cite-count.test.mjs
  - cadence-core/bin/planning/cite-count.mjs
  - cadence-core/bin/planning/trace.mjs
  - cadence-core/bin/trace-suggest.test.mjs
  - cadence-core/bin/planning-trace-ignore.test.mjs
  - .gitignore
  - cadence-core/bin/lib/trace-suggest.mjs
  - cadence-core/workflows/progress.md
  - cadence-core/workflows/report.md
  - cadence-core/workflows/suggest.md
  - cadence-core/bin/weight-budgets.json
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/planning-lease-check.test.mjs
  - cadence-core/bin/phase-spelling.test.mjs
---

# Phase 4: Keep the record writable - Plan

## Goal

`.planning/trace.jsonl` stops being able to reach a state where every subsequent
append fails forever. At the 1 MiB bound the record rotates instead of refusing,
the run in flight keeps its brackets, the rotated sibling stays out of git, and
a caller reading either reader's envelope can name the record it read and say
that a rotation happened.

## Must be true when done

- A writer appending to a record at or past `MAX_TRACE_BYTES` gets `written:
  true` and finds its event in the live record afterwards. No writer is ever
  again refused with `reason: "size-cap"` because of the file's size.
- `planning.mjs trace render --phase N` returns the same `corr` for the run in
  flight, and the same count of brackets under that `corr`, immediately before
  and immediately after a rotation.
- Neither the live record nor its rotated sibling exceeds `MAX_TRACE_BYTES`, and
  at most one rotated generation is on disk, so the pair is bounded at 2 MiB
  with no new config key.
- `git check-ignore` exits 0 for the rotated sibling in this repository, and a
  project `trace ignore` scaffolds gets a rule that covers it.
- `planning.mjs trace render` and `planning.mjs trace suggest` each emit a `file`
  naming the record they read, and after a rotation both carry a field saying
  one happened - so nobody has to infer it from missing events.
- Two writers that both enter the append with the record over the bound each
  land their event in the live record, exactly one rotated generation exists
  afterwards, and it is the over-bound generation rather than a freshly written
  one.
- `node cadence-core/bin/test.mjs` is green, `node cadence-core/bin/self-verify.mjs`
  reports no problems, and every prose surface whose bytes changed is re-pinned
  in `cadence-core/bin/weight-budgets.json`.

## Context

- CONTEXT.md D-01..D-12 are locked. Rotation lives in `appendEvent` and nowhere
  else (D-02); it carries the tail from the newest `lifecycle/phase_start`
  forward (D-01); it is a rename plus a fresh write, never a trim in place
  (D-04); it fires at the existing `MAX_TRACE_BYTES` and keeps exactly one
  generation with no new config key (D-05).
- The visibility signal is `renderTrace`'s existing `file` plus a rotation field
  on the render envelope, and `trace suggest` gains `file` (D-06). It is NOT the
  `capped` flag, and it is not a new subcommand or flag (D-09).
- Nothing is taught to READ the rotated sibling. Expiring stale `unpaired` rows,
  pruning at a milestone close, re-litigating `MAX_TRACE_BYTES`, and the meaning
  of `capped` on the read side are all out of scope.
- Patterns to follow: `lib/report-rotation.mjs` for the rotated spelling's shape,
  `lib/capture-file.mjs`'s single-winner `renameSync` claim for the concurrency
  arm, and `renderTrace`'s existing conditional keys (`roles`, `coordinator`,
  `mismatched`) for emitting a field only when there is something to say.

## Tasks

### Task 1: Rotate at the bound instead of refusing

- **Files:** `cadence-core/bin/lib/trace.mjs` (`appendEvent`, `tracePath`,
  `TRACE_FILE`, `MAX_TRACE_BYTES`, `ANCHOR`, `readLines`),
  `cadence-core/bin/trace.test.mjs` (the test named `appendEvent: a file at the
  bound accepts nothing more and renders capped`),
  `cadence-core/bin/planning-cite-count.test.mjs` (the test named `cite-count: a
  trace at the cap comes back written:false, and moves no figure`),
  `cadence-core/bin/planning/cite-count.mjs` (the D-15 comment above its
  `appendEvent` call)
- **Action:** Replace the `size-cap` refusal in `appendEvent` with rotation, in
  that function and nowhere else (D-02): every writer in the tree reaches the
  record only through it, so the nine writer sites CONTEXT D-02 censuses stay
  untouched and no call site learns about rotation. Keep the trigger on the
  existing pre-write size arm, but fire it when the file's stat PLUS the rendered
  line would reach `MAX_TRACE_BYTES` rather than only when the file is already at
  or past it - the current arm admits one last event that carries the file past
  the bound, and AC4 requires that no file matching the trace or its rotated
  spelling exceed it. State the rotated spelling ONCE, as an export beside
  `tracePath`, so writer, reader, `.gitignore` and tests cannot drift; use
  `trace.1.jsonl`, suffix before extension, matching `lib/report-rotation.mjs`'s
  `plan-<k>.<n>.md` and keeping `.jsonl` so the sibling is still recognisably the
  record. The rotated path is FIXED, which is how exactly one generation is kept
  (D-05): a second rotation replaces the first. Add no retention config key.
  Rotation renames the whole live file to that path and then writes back the tail
  from the NEWEST `lifecycle/phase_start` line forward, that anchor line included
  (D-01). A whole-file rename is wrong: `correlationId` scans BACKWARD for that
  anchor and returns the bare `<phase>` without one, so post-rotation events would
  carry `<phase>` while their dispatch halves carry `<phase>-<sha>`, and
  `planning/risk-check.mjs`'s corr-scoped lookup plus `references/triage-gate.md`'s
  prior-`rearm` lookup would both miss - failing the one-re-arm cap on the only
  blocking trigger OPEN. Where the record carries no anchor at all, carry nothing:
  `correlationId` already returns the bare form there, so nothing degrades. Bound
  the carried tail - the fresh live file, after the tail, the rotation marker
  Task 2 adds and the pending line, must be under `MAX_TRACE_BYTES`; where the tail
  alone would not fit, keep the anchor line and drop post-anchor lines oldest-first
  until it does, or a run that wrote a bound's worth of events since its own anchor
  would rotate on every append and destroy the generation each time. That drop is
  SUBORDINATE to AC2, which is unqualified: never drop a post-anchor line whose
  `corr` is the in-flight run's, because those lines are the dispatch and close
  halves `renderTrace` counts as brackets, and dropping one changes the bracket
  count across the rotation. Drop only post-anchor lines under some OTHER `corr`;
  where the anchor plus the in-flight run's own lines still do not fit, refuse
  rather than rotate, on the same `{written:false, reason}` arm the
  oversized-single-line case below uses - a rotation that silently destroys the
  bracket state is worse than an append that says it did not happen.

  Bound the ROTATED SIBLING too, which the rename alone does not: AC1 names a file
  "at or over `MAX_TRACE_BYTES`" as a supported input, and today's pre-write arm
  produces exactly that (it refuses at `size >= MAX_TRACE_BYTES` only AFTER the file
  has already taken one event past the bound), so a whole-file rename hands AC4 a
  sibling over the cap. After the rename - and only after, when the rotating writer
  exclusively owns those bytes and no other writer will ever open that path again -
  drop whole lines from the sibling's HEAD until it is under `MAX_TRACE_BYTES`. This
  does NOT reach D-04: that decision forbids a read-modify-write on the LIVE path,
  because interleaved appenders there are lossless only in append mode, and the
  renamed sibling has no appenders at all. Nothing is taught to read the sibling
  (Context above), so the dropped head costs no reader anything. Refuse rather than rotate when the
  rendered line is on its own at or past `MAX_TRACE_BYTES`, returning
  `{written:false, reason}` with a reason distinguishable from the old
  `size-cap`: rotating there throws the record away and the next append does it
  again. Never trim in place (D-04) - append mode is what makes interleaved
  writers lossless, and a read-modify-write drops events the `SubagentStop` hook
  wrote between the read and the write, a loss the record's
  `unpaired`/`unrecorded` vocabulary cannot tell from a worker that never
  returned. `appendEvent` still never throws and never writes to stdout or
  stderr. Then repair the two shipped tests whose premise this removes: the
  `trace.test.mjs` one asserts `{written:false, reason:'size-cap'}` and an
  unchanged file, and the `planning-cite-count.test.mjs` one pads
  `trace.jsonl` to 1,048,576 bytes to prove "the verdict and both figures are
  identical whether or not the record landed" - keep that test's subject and make
  the append fail some other way `appendEvent` still refuses, such as the
  `symlinked-trace` arm. Correct the comment above `cite-count.mjs`'s
  `appendEvent` call, which states `size-cap` is a stated failure mode of an
  unpruned record.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` shows an
  `appendEvent` against a record padded past `MAX_TRACE_BYTES` returning
  `written:true`, that event present in `.planning/trace.jsonl` afterwards,
  `.planning/trace.1.jsonl` present, and neither file larger than
  `MAX_TRACE_BYTES` - including the arm where the live file was padded WELL past
  the bound before the append, so the assertion exercises the sibling head-trim and
  not only the rename; a record whose in-flight run's own post-anchor lines exceed
  the bound returns `written:false` and leaves both files byte-identical rather
  than rotating a bracket half away; `renderTrace(dir, N).corr` and the number of `brackets`
  whose `corr` equals it are identical before and after that append; a record
  with no `phase_start` rotates to an empty live file; a rendered line at or past
  the bound on its own returns `written:false` and leaves both files byte-identical.
  `node --test cadence-core/bin/planning-cite-count.test.mjs` is green.

### Task 2: Make the rotation visible on both reader envelopes

- **Files:** `cadence-core/bin/lib/trace.mjs` (`appendEvent`, `renderTrace`,
  `COORDINATOR`, `WORKER_CACHE`, `FAMILIES`, `TERMINAL`),
  `cadence-core/bin/planning/trace.mjs` (the `render` and `suggest` arms),
  `cadence-core/bin/trace.test.mjs`, `cadence-core/bin/trace-suggest.test.mjs`
  (the test named `seam: a real trace written through appendEvent reads back
  through \`trace suggest\``)
- **Action:** Have the rotation write a marker as the LAST line of the fresh
  file, after the carried tail, so the tail's own order is untouched and the
  marker derives the in-flight run's `corr` from the anchor above it. Spell it as
  a new `lifecycle` NAME exported beside `COORDINATOR` and `WORKER_CACHE` - never
  a fifth family, because `FAMILIES` is validated at the seam while
  `renderTrace`'s `counts` is a fixed four-key literal and a fifth family would
  write fine and count nowhere; and never a member of `TERMINAL`, which would open
  and close a bracket for a worker that never returned. It carries the rotated
  sibling's name and the instant. Write it as part of the same fresh-file write
  rather than by re-entering `appendEvent`, which would recurse through the size
  arm. No producer-census row is owed (D-08): `trace.test.mjs`'s census scans
  prose surfaces plus `route.mjs` and `review-provider.mjs` only, and this event
  is written by code in `lib/trace.mjs`. Then have `renderTrace` gain a rotation
  field built from the NEWEST marker in the record, naming the rotated sibling and
  the instant. Detect it in the PASS 1 loop AHEAD of the `wanted` phase filter, so
  the field reports on the RECORD and not on the phase scope - the same
  independence `out.capped` already has, taken from `statSync` before any
  filtering. Emit it only when a marker is present, the way `roles`, `coordinator`
  and `mismatched` are emitted, so a record that never rotated renders
  byte-identically for every reader already parsing this envelope. Do NOT reuse
  `capped` (D-06): it is the same numeric predicate but answers "this READ was
  truncated at the ceiling", and rotation makes the two come apart - a healthy
  rotated writer beside a reader still looking at a head-truncated file - so
  reusing it would make three shipped prose surfaces print "the record hit its
  size bound and what follows is missing" about a file that just rotated
  successfully. Carry the field onto `trace render`'s CLI envelope beside its
  existing `file`, and give `trace suggest`'s envelope both `file` and the same
  field, read off the `renderTrace` result that arm already computes before it
  calls `suggestFromRender` - today it names no record at all. Keep `events_read`
  on suggest: `workflows/suggest.md`'s thin-record arm reads it as its one
  discriminator. Add NO subcommand and NO flag (D-09) - the signal rides envelopes
  both readers already parse, so `lib/arg-contract.mjs`'s `trace render` and
  `trace suggest` rows are unchanged and `self-verify`'s `unknown-subcommand` and
  `unknown-flag` checks stay quiet.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs
  cadence-core/bin/trace-suggest.test.mjs` shows `planning.mjs trace render
  --phase N` and `planning.mjs trace suggest` each returning a `file` naming
  `.planning/trace.jsonl`; after a rotation forced by a padded record, both
  envelopes carry a rotation field naming `.planning/trace.1.jsonl`, and
  `capped` is false on that render; a record that never rotated returns an
  envelope carrying no rotation key at all; and `trace render --phase M` for a
  phase other than the one in flight still carries the rotation field.

### Task 3: Keep the rotated sibling out of git

- **Files:** `.gitignore`, `cadence-core/bin/planning/trace.mjs`
  (`cmdTraceIgnore`, `TRACE_IGNORE_LINE`, `TRACE_IGNORE_COMMENT`,
  `gitIgnoreState`, `gitignoreCarriesLine`, `traceTracked`),
  `cadence-core/bin/planning-trace-ignore.test.mjs`
- **Action:** Add a rule covering the rotated sibling to this repository's
  `.gitignore`, under the existing "Joined run record" comment beside
  `/.planning/trace.jsonl` and `/.planning/reads.jsonl`. Measured 2026-08-26:
  `git check-ignore -v .planning/trace.jsonl` exits 0 on `.gitignore:29` while
  `git check-ignore .planning/trace.1.jsonl` exits 1, so the first rotation would
  leave a ~1 MiB untracked file for `git add .planning` to sweep into a public
  repo - reversing D-07 of `v3.6.0` phase 1 and re-creating the failure
  `cmdTraceIgnore` exists to prevent. Then have `cmdTraceIgnore` write the
  sibling's rule too, for the projects it scaffolds. Add a SECOND literal beside
  `TRACE_IGNORE_LINE` rather than widening that constant into a glob: `line` is
  what `/cad-health` reports and what `traceTracked`'s `ls-files --error-unmatch`
  passes as a pathspec, and a glob would change the meaning of both. Derive the
  sibling's literal from the rotated spelling `lib/trace.mjs` now exports, which
  this module already imports from, so the ignore rule and the file the writer
  creates cannot drift apart. Make `ignored` true only when BOTH rules travel,
  running the existing `gitIgnoreState` / `gitignoreCarriesLine` pair against each
  literal: a project covered for the live record and not for the sibling is
  exactly the state D-07 names, and `/cad-health` must report it rather than stay
  silent. Keep `line` as the live record's literal and add a field naming the
  sibling's, so `skills/cad-health/SKILL.md`'s `ignored`/`tracked` reading is
  unchanged and that surface needs no edit. The write arm keeps every existing
  byte and adds only the rules that are missing, so a project scaffolded before
  this change is upgraded on its next non-`--check` run while a re-run stays a
  no-op with `reason: 'already-ignored'`; `--check` still writes nothing at all,
  because /cad-health reports on a project it did not create.
- **Verify:** `git check-ignore -v .planning/trace.1.jsonl` exits 0 naming
  `.gitignore`, and `git check-ignore -v .planning/trace.jsonl` still exits 0.
  `node --test cadence-core/bin/planning-trace-ignore.test.mjs` shows a fresh
  repo getting both rules on one call; a re-run reporting `written:false,
  reason:'already-ignored'` and leaving the file byte-identical; a brownfield
  `.gitignore` keeping every line it had; a repo carrying only the live-record
  rule reporting `ignored:false` under `--check` with nothing written, then
  gaining only the missing rule on the write arm; and an assertion that the
  sibling literal `cmdTraceIgnore` writes names the same basename the rotated
  path exported from `lib/trace.mjs` produces.

### Task 4: One rotation and no lost events when two writers race

- **Files:** `cadence-core/bin/lib/trace.mjs` (`appendEvent` and the rotation it
  now performs), `cadence-core/bin/trace.test.mjs`
- **Action:** Make the rotation's claim a whole-file `renameSync` with NO lock
  (D-03): a writer that finds the live path already gone treats `ENOENT` - and
  `EEXIST` where the platform raises it - as "somebody else already rotated",
  re-stats and proceeds to append. Do not wrap rotate-and-append in
  `withPlanningFileLock` from `lib/capture-file.mjs`: the `SubagentStop` hook
  would then acquire a lock inside a path its own contract forbids it to speak
  on. The concurrency to design against is cross-PROCESS - `bin/subagent-trace.mjs`
  renders the record and then appends its events under the 10-second timeout
  `hooks/hooks.json` gives it, so a rotation landing between those two calls is a
  real interleaving. Follow the single-winner `renameSync` claim
  `lib/capture-file.mjs`'s stale-lock break already uses, including its re-stat
  AFTER the claim: only once the rename has happened does a writer exclusively own
  the bytes it is judging. A writer must never rotate a file it did not observe
  over the trigger - the freshly written live file of a rotation that just
  completed is what it would otherwise carry away, destroying the generation it
  was supposed to keep and leaving the live record empty. `ENOENT`/`EEXIST` does
  NOT detect that case and must not be relied on for it: the interleaving to design
  against is A renaming the over-cap file to the sibling and writing a fresh live
  file, THEN B - still holding its stale stat - calling `renameSync` on a live path
  that exists again, which POSIX rename silently replaces the destination for. B
  raises no error, A's event ends up in the rotated sibling, and AC6's "both events
  present in the live file" fails while exactly one sibling still exists, so the
  count-based assertion alone would pass. Bind the claim to the GENERATION rather
  than to the path: carry the `ino` (and `dev`) off the same `statSync` that
  observed the file over the trigger, and after the rename confirm the sibling
  carries that identity. A writer that finds it does not has rotated somebody
  else's fresh file and must put it back and re-enter as the loser, exactly as the
  `ENOENT` arm does. Leave no temporary or
  claim file behind on any arm, including every failure arm; a rotation that
  cannot complete returns `{written:false, reason}` and leaves the record
  readable, because `appendEvent` still never throws and never speaks on a stream.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` shows (a) several
  child processes appending concurrently to a record padded past the bound: every
  one of their events is present in the live record afterwards, exactly one
  rotated generation exists, the rotated file is UNDER `MAX_TRACE_BYTES` and
  carries the oldest surviving events (never "at least the padded size" - a padded
  input is precisely the case AC4 binds), and `.planning/` holds no other file
  whose name begins with the trace's basename; (c) the re-created-live-path
  interleaving above, forced deterministically rather than left to a racing child:
  a writer holding a stat of the pre-rotation file, run after a rotation has
  already completed, does not replace the sibling, and the event the first writer
  landed is still in the live record;
  and (b) a second append after a rotation has completed does not rotate again -
  the rotated file is byte-identical before and after it, and the live record
  keeps both events.

### Task 5: State the retention rule where its readers are, and re-pin the budgets

- **Files:** `cadence-core/workflows/progress.md` (the `trace` step that prints
  counts, `roles`, `unpaired` and `capped`), `cadence-core/workflows/report.md`
  (the `Record health:` line), `cadence-core/workflows/suggest.md` (the paragraph
  giving `capped` and `malformed` one line each, and the scope step's claim that
  nothing prunes the record), `cadence-core/bin/lib/trace-suggest.mjs` (the
  comment above `suggestFromRender`'s fires gather),
  `cadence-core/bin/weight-budgets.json`
- **Action:** Have each of the three prose surfaces state the rotation field
  where it already states `capped`, and state the drop rule a reader needs: the
  record is cut at the newest `phase_start` anchor, so events older than the run
  in flight are in the rotated sibling the field names and are not in what was
  just read. Keep it to what the envelope carries - do not restate
  `MAX_TRACE_BYTES` and do not teach any surface to read the sibling. Keep
  `capped` and rotation apart in the prose: `capped` still means the READ was
  truncated at the ceiling, and a rotated record is not capped. Add no second
  `trace render` invocation line to `progress.md` or `report.md` -
  `prose-agreement.test.mjs`'s TRN-02 test requires exactly one line per file that
  names `planning.mjs` and matches `trace render`, and requires that line to keep
  the scratch-file redirect the bulk-output rule prescribes. Re-pin
  `cadence-core/bin/weight-budgets.json` in the SAME commit (D-10): all three
  surfaces sit at exactly their ceiling today - `progress.md` 13,197,
  `report.md` 20,038, `suggest.md` 9,398 - so `self-verify`'s `budget-overrun`
  fires on the first added byte. Raise only the entries whose file grew;
  `cadence-core/references/config-catalog.md` does NOT change, because D-05 adds
  no config key. Finally, correct the comment in `lib/trace-suggest.mjs` that
  argues from "`.planning/trace.jsonl` is never pruned or archived" that a
  re-arm mutes its trigger "for the life of the file - permanently, by
  construction": rotation bounds that. Its design conclusion - one row per FIRE -
  is unchanged, so correct the premise and change nothing else there.
- **Verify:** `node cadence-core/bin/self-verify.mjs` reports no problems, in
  particular no `budget-overrun` and no `unbudgeted-surface`;
  `node cadence-core/bin/test.mjs` is green; `grep -c` over `progress.md` and
  `report.md` returns 1 for lines naming `planning.mjs` with `trace render`; and
  each of the three surfaces names the rotation field and says where the dropped
  events went.

## Notes

- Plan shape honored: CONTEXT directs one plan, and the file-independence test
  agrees - `cadence-core/bin/lib/trace.mjs` is touched by tasks 1, 2 and 4 and
  `cadence-core/bin/trace.test.mjs` by tasks 1, 2 and 4, so no split is available.
- Declared bytes measured 2026-08-26: 683,469 B across 16 paths, OVER
  `workflow.max_plan_bytes` (675,000) by 8,469 B. The overrun is entirely the
  three census files `lease-check --plan-time` required after the plan was
  written (`self-verify.test.mjs`, `planning-lease-check.test.mjs`,
  `phase-spelling.test.mjs`); no split is available to relieve it, since tasks 1,
  2 and 4 all touch `lib/trace.mjs` and `trace.test.mjs`. Recorded rather than
  silent.
- The `plan` review gate (blocking, cross-model `openai`/`gpt-5.6-terra`, tier
  balanced, effort medium) raised 4 findings on 2026-08-26 and all 4 survived
  adjudication. Three are folded into the tasks above: the rotated sibling being
  over cap when the live file was already over it (AC1's own input, AC4's own
  ceiling), the tail-overflow drop being able to take a bracket half of the
  in-flight run (AC2), and the re-created-live-path rename interleaving that
  `ENOENT` cannot detect (AC6). The fourth, that Task 2's rotation marker had no
  bytes reserved in Task 1's capacity bound, is fixed by the same sentence that
  carries the first. Findings and rulings are in
  `.planning/phases/4/ADJUDICATION-plan-plan-1.json`.
- AC2 was checked against the live record before planning, not assumed. Cutting
  `.planning/trace.jsonl` at its newest anchor (byte 597,177 of 605,209, a
  ~8 KB tail) leaves `renderTrace(dir, "3").corr` at `3-bef7cc1e` and the
  brackets under that `corr` at 4, both before and after the cut; only the 3
  stale `unpaired` rows from earlier runs drop, which D-11 records as a benefit.
- The rotated spelling `trace.1.jsonl` is a planner choice CONTEXT left open. It
  follows `lib/report-rotation.mjs`'s suffix-before-extension shape and matches
  the spelling AC3 and D-07 measure against.
- Two decisions in this plan are choices rather than restatements of CONTEXT, and
  each is stated with its reason in the task that carries it: the trigger moves
  from "the file is already at the bound" to "this append would reach it", which
  is what makes AC4's ceiling literally true of the rotated sibling; and a
  rendered line at or past the bound on its own is refused rather than rotated,
  which is what stops one oversized event rotating the record away on every
  attempt.
- Not in scope and not tasked, surfaced for the human: `cadence-core/workflows/adopt.md`'s
  success-criteria line "The trace ignore line is present" stays singular after
  task 3 writes two rules, and `cadence-core/bin/planning/risk-check.mjs`'s
  comment about the record being "append-only across the whole project" keeps a
  reach claim that rotation narrows. Neither is falsified by this phase and
  neither is required by an acceptance criterion.
