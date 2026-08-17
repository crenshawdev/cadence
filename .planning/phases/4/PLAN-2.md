---
phase: 4
plan: 2
requirements:
  - TRN-02
files:
  - cadence-core/references/conventions.md
  - cadence-core/references/triage-gate.md
  - cadence-core/workflows/progress.md
  - cadence-core/workflows/report.md
  - cadence-core/bin/lib/bulk-output.mjs
  - cadence-core/bin/bulk-output.test.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/bin/weight-budgets.json
---

# Phase 4: Costs argued from the new record - Plan 2 (TRN-02, bulk tool OUTPUT rides a file)

## Goal

The file-transport lesson `v3.5.2` learned for caller-derived INPUT reaches the
other direction: a prose site that prescribes a tool call whose output is bulk
redirects that output to a file and puts a digest in the transcript, the rule is
stated exactly once, every site is registered, and self-verify reads the register
and fails when a site drifts back off it.

## Must be true when done

- The rule is stated ONCE: `grep -rn` over `cadence-core/` finds the statement in
  `cadence-core/references/conventions.md` and in no other file, and the rule
  module in `cadence-core/bin/lib/` carries a pointer to it rather than a copy.
- The three prescribing sites for the largest measured seam response -
  `cadence-core/workflows/report.md`, `cadence-core/workflows/progress.md` and
  `cadence-core/references/triage-gate.md` - each redirect `trace render` to a
  scratch file and hand the transcript a digest, and each cites the conventions
  path rather than restating the rule.
- Every site the scan finds is CLASSIFIED by a register row - converted, under
  the measured threshold, bounded by its own flags, or a description of a call
  another agent makes in its own context - and a row carries its measured byte
  figure and the date it was measured.
- `node cadence-core/bin/self-verify.mjs` reports a NAMED problem when a
  registered site is edited back to riding the transcript, and reports an
  unclassified site rather than passing over it.
- A row survives the occurrence it converted, so re-introducing the inline form
  at a converted site reads as a reported regression rather than as a new,
  unclassified site.
- A falsifier committed with a `WATCHED FAILING AT <sha>` header exits non-zero
  against the SHA it names and zero on this tree, and `node --test
  cadence-core/bin/*.test.mjs`, `node cadence-core/bin/self-verify.mjs` and
  `npx tsc -p tsconfig.ci.json` are all green.

## Context

CONTEXT D-07 makes "bulk" MEASURED rather than asserted, off the response byte
lengths `.planning/reads.jsonl` already records. D-08 fixes the conversion as a
shell REDIRECT plus a digest - no new seam, flag or subcommand - with two shipped
precedents (`cadence-core/references/review-triggers.md`'s `--payload` composition
and RES-01's `reports/plan-<k>.md`). D-13 fixes the shape as
`lib/text-transport.mjs`'s exactly: hand-maintained frozen register plus a pure
rule module in `cadence-core/bin/lib/`, walked by `self-verify.mjs`, with the rule
itself stated once in `references/conventions.md`. D-14 makes rows
reportable-when-unclassified rather than skippable and makes a row outlive its
occurrence. D-15 keeps the digest obligation and puts a site whose coordinator
cannot take a digest OUT of scope with a stated reason. D-20 requires the
`weight-budgets.json` re-pin in the same commit as every prose edit.

Ordering: this plan runs SECOND. Plan 1 edits
`cadence-core/workflows/report.md` and `cadence-core/bin/self-verify.mjs` before
this plan does; Plan 3 appends to `cadence-core/bin/prose-agreement.test.mjs`
after it. The conversions land BEFORE the check that freezes them, because a
check shipped ahead of them would be red at its own commit.

## Tasks

### Task 1: State the bulk-output rule once, in conventions.md

- **Files:** `cadence-core/references/conventions.md`,
  `cadence-core/bin/weight-budgets.json`
- **Action:** Add one short section - beside the existing **Caller-derived text**
  section, whose three-bullet shape it mirrors - stating the rule in one place
  for the whole tree: a prose site that PRESCRIBES a tool call whose measured
  response crosses the stated byte threshold redirects that output to a scratch
  file and hands the transcript a DIGEST of what the step actually needs, because
  a response that rides the transcript is re-paid on every subsequent turn at the
  cache-read rate; the threshold is 10,000 bytes of response, which is the
  measured mean `Read` response on this repository (10,323 B over 780 recorded
  calls, `.planning/reads.jsonl`, 2026-08-17); the conversion is a shell redirect
  and a targeted read-back, never a new seam, flag or subcommand; and no site
  decides this for itself - every one is classified in
  `cadence-core/bin/lib/bulk-output.mjs`, with self-verify reporting a site the
  register does not classify. State it in the SAME voice the caller-derived-text
  section uses, and keep it tight: this file is read on demand by many commands,
  so every byte here is paid at each of them. This is the ONE statement of the
  rule in the tree - no other surface may restate it, and every converted site
  cites this file by path instead. Give the statement one distinctive clause -
  `rides a file, not the transcript` - written verbatim in that section and
  nowhere else in the tree, so AC3's single-statement test has a string to grep
  for that no restatement can accidentally miss and no register row can
  accidentally duplicate. Re-pin `conventions.md` in
  `cadence-core/bin/weight-budgets.json` from `node cadence-core/bin/weight.mjs`
  in this same commit.
- **Verify:** `grep -rn "rides a file, not the transcript" cadence-core/` names
  `cadence-core/references/conventions.md` and no other file.
  `node cadence-core/bin/self-verify.mjs` exits 0.

### Task 2: `triage-gate.md`'s re-arm lookup takes the file, not the envelope

- **Files:** `cadence-core/references/triage-gate.md`,
  `cadence-core/bin/weight-budgets.json`
- **Action:** In the paragraph that says to run
  `planning.mjs trace render --phase <N>` before firing the narrowed round,
  replace the inline prescription with a fenced two-step in the shape
  `cadence-core/references/review-triggers.md` already uses for its payload file:
  redirect the render into a scratch path built from `"${TMPDIR:-/tmp}/..."`, then
  read back out of that file ONLY the answer this step needs - whether an
  `outcome` event of `rearm` for this trigger already exists under the envelope's
  current `corr` - so the transcript carries that one-line answer rather than the
  measured 14,857 B this response is at `--phase 3` on this repository (2026-08-17).
  Say in one clause that the scratch file is the model's own, never a phase
  artifact, exactly as that reference says of its two temp files. Cite
  `cadence-core/references/conventions.md` as the rule's home; do not restate the
  rule. Change nothing about what the lookup MEANS: a recorded `rearm` under the
  current `corr` still spends the one round and still routes to the
  STOP-and-ask arm, and the best-effort fallback sentence stays as written, since
  this gate is the one trigger that is blocking at every stakes level. Re-pin
  `triage-gate.md` in `cadence-core/bin/weight-budgets.json` in this same commit.
- **Verify:** `grep -n "TMPDIR" cadence-core/references/triage-gate.md` shows the
  redirect, and the same paragraph still names `rearm`, `corr` and the
  STOP-and-ask arm. `node cadence-core/bin/self-verify.mjs` exits 0 and `node
  --test cadence-core/bin/trace.test.mjs` exits 0 - that file's prose census over
  `trace` invocations is what proves the rewritten invocation still parses as one.

### Task 3: `/cad-progress --trace` prints the counts without buying the brackets

- **Files:** `cadence-core/workflows/progress.md`,
  `cadence-core/bin/weight-budgets.json`
- **Action:** In the `trace` step, redirect the `trace render --phase <current>`
  invocation into a scratch path the same way task 2 does, and have the step read
  back only what it prints: the four family counts and the `roles` block. The
  `brackets` and `outcomes` arrays - the bulk of the measured 14,857 B - are never
  needed by this step and must not reach the transcript. Every existing reading
  rule in that step survives verbatim: an absent token total prints as
  `unrecorded` and never as `0`, the same for turns under `turns_unrecorded`, an
  `unrecorded` count beside a real total means the total is real but short, and a
  render carrying no `roles` key prints nothing for it. Cite
  `cadence-core/references/conventions.md` for the transport and do not restate
  the rule. Re-pin `progress.md` in `cadence-core/bin/weight-budgets.json` in this
  same commit.
- **Verify:** `grep -n "TMPDIR" cadence-core/workflows/progress.md` shows the
  redirect and `grep -n "unrecorded" cadence-core/workflows/progress.md` still
  shows the three reading rules. `node cadence-core/bin/self-verify.mjs` exits 0.

### Task 4: `/cad-report` composes from the file rather than from the envelope

- **Files:** `cadence-core/workflows/report.md`,
  `cadence-core/bin/weight-budgets.json`
- **Action:** In the `read_record` step, redirect the `trace render [--phase <N>]`
  invocation into a scratch path as tasks 2 and 3 do, and state that every line of
  the `compose` step reads what it needs OUT of that file - the `brackets` rows for
  the dispatch table, `outcomes` for the gate lines, `roles`, `coordinator`,
  `unpaired`, `mismatched`, `capped` and `malformed` for the lines that name them -
  and that the composed report IS the digest this transport owes the transcript.
  State the read-back BOUND with it, or the redirect buys nothing: the `compose`
  step extracts the named fields out of the scratch file one at a time (a
  `node -e` field read, the shape tasks 2 and 3 already use) and NEVER reads the
  file whole - no `cat`, no `Read`, no unfiltered `grep` of it into the
  transcript. A whole-file read-back after the redirect is the same bytes on the
  same turn and is what D-15 calls owing a digest.
  The measured response is 68,044 B unscoped and 14,857 B at `--phase 3` on this
  repository (2026-08-17), which is why this site is the one the requirement was
  written for. Leave the second seam call (`reads --join`) inline and unchanged:
  it measures 1,507 B, under the threshold. Leave `trace window` inline too,
  for the same reason. Everything the step already forbids stays forbidden -
  never ask for the raw `events` array, print no ratio and no single gap number,
  and report absent figures as absent. Cite
  `cadence-core/references/conventions.md`; do not restate the rule. Re-pin
  `report.md` in `cadence-core/bin/weight-budgets.json` in this same commit.
- **Verify:** `grep -n "TMPDIR" cadence-core/workflows/report.md` shows the
  redirect on the render call and NOT on the `reads --join` call. `grep -nE
  "cat |Read " cadence-core/workflows/report.md` shows no whole-file read of the
  scratch path, and `grep -n "never read" cadence-core/workflows/report.md`
  shows the read-back bound stated. `grep -n
  "events" cadence-core/workflows/report.md` still shows the never-ask-for-the-raw-
  events rule. `node cadence-core/bin/self-verify.mjs` exits 0.

### Task 5: The register and the pure rule

- **Files:** `cadence-core/bin/lib/bulk-output.mjs`,
  `cadence-core/bin/bulk-output.test.mjs`
- **Action:** Add the register-plus-rule module in
  `cadence-core/bin/lib/text-transport.mjs`'s exact shape: a header that says the
  rule itself is NOT here and names `cadence-core/references/conventions.md` as
  its one home, a frozen exported list of the watched CALL SHAPES, a frozen
  exported register of rows, three exported problem codes, and one pure function
  taking a surface path and its text and returning `{kind, file, detail}` issues -
  no disk, no emit, no exit, no `Date`, with the caller owning the walk. The
  watched shapes are the ones measured over the threshold: `planning.mjs trace
  render`, `planning.mjs recall`, and `git diff` in a whole-range (`<a>..<b>`) or
  `--cached` form. The DISCRIMINATOR is an INVOCATION line rather than a prose
  mention, the same test
  `cadence-core/bin/trace.test.mjs`'s `traceCalls` helper already applies: a seam
  occurrence counts only on a line that also names `planning.mjs`, so
  `cadence-core/workflows/execute.md`'s and `cadence-core/workflows/plan.md`'s
  sentences ABOUT what `trace render` reports stay silent. Record in the header
  that the output-bounding `git diff` flags - `--stat`, `--shortstat`,
  `--numstat`, `--quiet`, `--name-only`, `--name-status` - are excluded by
  construction, because a bounded form cannot break the rule and watching it would
  report every site as unsafe against a rule none of them can break, exactly as
  that module records its path-CSV exclusion. The three codes mirror its
  vocabulary: an INLINE code for a row that owes the file transport whose site
  still prescribes the call with its output riding the transcript, an
  UNREGISTERED code for a prescribed watched call no row classifies, and an
  UNCLEAR code for an occurrence the scan cannot delimit that no row for that
  surface and call settles. Each row carries the surface, the call as written,
  the measured response bytes with the 2026-08-17 measurement date, its
  classification, and a required reason on every row that owes no transport.
  Write the rows for the sites measured at planning time: the three `trace
  render` sites converted by tasks 2-4; the three `planning.mjs recall` sites
  (`cadence-core/workflows/context.md`, `cadence-core/workflows/plan.md`,
  `cadence-core/workflows/debug.md`) at 8,617 B, under the threshold;
  `cadence-core/references/review-triggers.md`'s `git diff
  <base_ref>..<head_ref>` redirect and its shape-(c) `git diff <pre-plan
  HEAD>..HEAD`, `cadence-core/workflows/execute.md`'s `git diff {pre-plan
  HEAD}..HEAD` and `cadence-core/workflows/task.md`'s `git diff <parent of the
  task's first commit>..HEAD`, all four already writing to a file;
  `cadence-core/references/review-triggers.md`'s shape-(b) `git diff --cached`,
  `cadence-core/workflows/verify.md`'s and `cadence-core/workflows/debug.md`'s
  `git diff --cached`, each a description of a call the REVIEWER re-runs in its
  own cwd rather than one this surface issues; and
  `cadence-core/references/plan-revision.md`'s path-scoped PLAN diff. Then run the
  rule over the whole tree and add a classified row for every further site it
  reports - the register is complete when the rule reports nothing, and a site
  left unclassified is the one outcome this module exists to prevent. Cover the
  module with unit tests: an inline regression at a converted row, an
  unregistered prescription, an undelimitable occurrence settled by a row and one
  not settled by any, a prose mention that stays silent, and a bounded `git diff`
  form that stays silent.
- **Verify:** `node --test cadence-core/bin/bulk-output.test.mjs` exits 0.
  Running the exported rule over every surface of this tree returns an empty
  issue list, and `grep -c "rides a file, not the transcript"
  cadence-core/bin/lib/bulk-output.mjs` returns 0 - the module names
  `cadence-core/references/conventions.md` as the rule's home and carries no copy
  of the statement, though a row's reason may cite the threshold FIGURE.

### Task 6: self-verify walks the register

- **Files:** `cadence-core/bin/self-verify.mjs`,
  `cadence-core/bin/self-verify.test.mjs`
- **Action:** Call task 5's rule from the per-surface loop in
  `cadence-core/bin/self-verify.mjs`, at the same place and in the same way check
  19 calls `textTransportIssues(rel, text)` - every prose surface the walk yields,
  no directory narrowing - and add its numbered entry to the check list in the
  file header stating what it watches and why, in the register-plus-rule terms
  check 13 and check 19 already use. It takes no `CONTRACTS` row, for the reason
  check 14 states about `lib/*.mjs`. Add the fixture-level cases to
  `cadence-core/bin/self-verify.test.mjs` beside the existing text-transport
  cases: a `--root` fixture whose surface reintroduces the inline form at a
  registered row reports the named inline problem, and one carrying an
  unregistered prescription reports the unregistered problem rather than passing.
- **Verify:** `node cadence-core/bin/self-verify.mjs` exits 0 on this tree.
  Re-inlining the redirect in `cadence-core/references/triage-gate.md` makes it
  exit non-zero naming that file and the inline kind (restore it afterwards).
  `node --test cadence-core/bin/self-verify.test.mjs` exits 0 and `npx tsc -p
  tsconfig.ci.json` exits 0.

### Task 7: The TRN-02 falsifier, watched failing at a named SHA

- **Files:** `cadence-core/bin/prose-agreement.test.mjs`
- **Action:** Append one falsifier that reads the SHIPPED prose bytes directly and
  imports nothing this plan added, so against the unpatched tree it fails on its
  ASSERTIONS rather than on a missing module: the bulk-output rule statement
  appears in `cadence-core/references/conventions.md` and in no other file under
  `cadence-core/`, and each of the three converted surfaces prescribes its `trace
  render` call with a redirect rather than with the output riding the transcript.
  Extract the statement and the redirects and compare them; do not settle for
  asserting that some expected phrase appears somewhere, which is the weaker shape
  this file has already shipped once. Carry the header comment in the shape this
  file's WIR-01 falsifier already uses: `WATCHED FAILING AT <sha>` naming the tip
  of the unpatched tree (`37796d0` is the tip as this plan is written; use the
  commit immediately preceding this plan's first implementation commit if it has
  moved), the observed unpatched output quoted verbatim, and the re-watch recipe
  (`git worktree add --detach <tmp> <sha>`, copy this file into that checkout's
  `cadence-core/bin/`, `node --test` it there, remove the worktree).
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` exits 0 on
  this tree. Following the header's own re-watch recipe against the SHA the header
  names, the same command exits NON-ZERO with this test failing on an assertion,
  and the header quotes that observed output.

## Notes

- Settled here under CONTEXT's fourth flagged assumption, from the measured
  `reads.jsonl` figures: the threshold is 10,000 response bytes and the watched
  shapes are `planning.mjs trace render`, `planning.mjs recall` and unbounded
  `git diff`. `weight.mjs` and `weight.mjs resident` (8,513 B and 20,206 B) are
  deliberately NOT watched - the only surface prescribing them is
  `docs/EVIDENCE.md`, a human-run measurement recipe outside self-verify's prose
  walk whose output goes to a terminal rather than into a model's context.
- No site is registered out of scope under D-15's cannot-take-a-digest arm.
  `/cad-report` was the candidate, since its compose step branches on nearly
  every field of the render - but the report it composes IS a digest, so the
  conversion is a read-back discipline rather than a rewrite, and skipping the
  largest measured site would leave the register missing the transport it exists
  for.
- The four `git diff` rows that already write to a file, and the three that
  describe a call the reviewer re-runs in its own cwd, are registered rather than
  omitted precisely because a row outlives its occurrence (D-14): the guard they
  buy is that re-inlining the biggest transport in the tree reads as a reported
  regression instead of as a new site.

### Open items from the `plan` review (2026-08-17, openai/flagship)

Recorded rather than folded in - each is a real gap, none blocks execution, and
the executor should treat them as known edges of the register rather than
discover them:

- The invocation-line discriminator (task 5) matches only a line naming both
  `planning.mjs` and the watched shape, so a prescription split across a
  backslash continuation is invisible to the scan: no INLINE, no UNREGISTERED,
  no UNCLEAR. If a continuation form is found in the tree during task 5, join
  logical lines before matching; if none exists, record the limit in the
  module header the way its other exclusions are recorded.
- The `measured response bytes` field has no well-defined value for the
  abstract `git diff <a>..<b>` and `git diff --cached` rows - the response size
  is the range's, not the site's. Record those rows with the field stated as
  unbounded-by-construction and the reason, rather than inventing a figure or
  silently dropping a required field (D-07 forbids the first).
- The exactly-once check on the rule (tasks 1 and 7) watches the distinctive
  clause, so a restatement in different words would not be caught. That is the
  same bound `prose-agreement` already carries for every other rule in the tree;
  it is noted here, not fixed here.
