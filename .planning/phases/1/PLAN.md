---
phase: 1
plan: 1
requirements:
  - BAS-01
  - TSL-01
  - TSL-02
files:
  - .planning/spikes/v3-baseline-dispatch-cost/SPIKE.md
  - .planning/spikes/toolsearch-conditional-skip/SPIKE.md
  - .planning/spikes/tools-survive-compaction/SPIKE.md
  - .planning/ROADMAP.md
  - docs/rationale/architecture-v4.md
---

# Phase 1: The baseline and the two probes - Plan

## Goal

OQ-1, OQ-2 and OQ-3 are answered with observations rather than guesses, and the
answers are written where phase 2 onward can read them.

## Must be true when done

- Three spike records exist under `.planning/spikes/`, one per open question,
  each carrying exactly one `VERDICT:` line whose value is `validated`,
  `invalidated` or `inconclusive`.
- The OQ-3 record states, for each of the six dispatched roles, a static
  `dispatchBytes` figure and a terminal `tokens` p75, each with the dispatch
  count it was computed over and the unrecorded count excluded from it.
- The OQ-3 record states a per-phase-run coordinator byte figure for two
  populations - serial-only and all-phases - each with its n, and names the date
  range the reads corpus covers.
- The OQ-1 record states, from an observed run, two token numbers: the cost of a
  first `ToolSearch` load and the cost of a second `ToolSearch` for an
  already-loaded schema. CONTEXT's AC6 admits no substitute, so a record carrying
  `not yet observed` does NOT satisfy this truth - see the note below.
- The OQ-2 record states, from one observed compaction, whether a tool loaded
  before the boundary was still callable after it with no reload. CONTEXT's AC7
  admits no substitute, on the same terms as AC6.

A `not yet observed` record is a PLACEHOLDER, never a completion. Tasks 5 and 6
write one when John has supplied nothing, so the executor has a defined action
and never invents a figure - but the task is then reported BLOCKED ON JOHN
rather than done, and the two truths above stay false until the observation
lands. The phase does not verify in that state, and that is the correct
outcome: two of its three questions are unanswered.
- `.planning/ROADMAP.md`'s Open Questions section shows a verdict and a
  spike-record path for each of OQ-1, OQ-2 and OQ-3, and the phrases "across one
  real phase" and "on a real phase" no longer appear in the file, including
  across a line wrap.
- `docs/rationale/architecture-v4.md` carries the per-role and coordinator
  figures beside the go/no-go language in its section 7, with a citation to the
  spike record they came from.

## Context

This is a spike phase. It writes no Rust, adds no field to any record, and
alters no shipped behavior (D-06); anything the record does not already carry is
reported as not derivable rather than made derivable. The OQ-3 corpus is
`/projects/cadence-archive-v3.7.12/.planning/`, never
`/code/cadence/.planning/trace.jsonl`, which is gitignored and was reset to 20
lines by the 2026-09-05 re-clone (D-01). Throwaway analysis code is expected and
belongs in a temp directory OUTSIDE this repository, never in `cadence-core/` and
never in `.planning/spikes/<slug>/` - `cadence-core/workflows/spike.md` step 4
offers that path first, but it sits inside the file lease tasks 1-4 declare, and
a staged script there trips `lease-check`'s `undeclared-files` refusal. No
analysis script is staged or committed by this phase.
Every figure publishes its denominator and `unrecorded` stays distinct
from a recorded zero (D-08). Out of scope: writing the ToolSearch preamble into
any skill file - OQ-1's verdict decides whether and how, in a later phase.

## Tasks

### Task 1: Write the three spike records' criteria before any observation exists

- **Files:** `.planning/spikes/v3-baseline-dispatch-cost/SPIKE.md`,
  `.planning/spikes/toolsearch-conditional-skip/SPIKE.md`,
  `.planning/spikes/tools-survive-compaction/SPIKE.md`
- **Action:** Create the three records, one per open question, using the slugs
  named above (chosen here; D-09 fixes the count and the location but not the
  spelling). Follow the shape of the TWO records named here, not a generalization
  over the directory - of the nine records under `.planning/spikes/` only two
  carry a `VERDICT:` line and three carry no `### C` heading at all, so
  pattern-matching against an arbitrary neighbor gets the shape wrong. See
  `.planning/spikes/host-effort-downgrade/SPIKE.md` for the heading set and
  the single trailing `VERDICT:` line ONLY - it carries no `## Criteria` section
  and no `### C` heading, and that absence is not the model here.
  `.planning/spikes/maxturns-cap-behaviour/SPIKE.md` is the model for
  `## Criteria, risk-first`, and that section is MANDATORY in all three records
  regardless of how minimal the rest stays. Together they give: an `# Spike: <the question as a question>` heading, a `## Question`
  section, a `## Decision that hinges on it` section, and a `## Criteria, risk-first`
  section whose `### C1`, `### C2` ... subsections each state Given/When/Then
  with the observable that decides validated and the opposite observation that
  decides invalidated (`cadence-core/workflows/spike.md` steps 2 and 3). Order
  the criteria so the assumption most likely to kill the answer is tested first.
  Each `## Question` names its roadmap id - OQ-1, OQ-2, OQ-3 - so the ROADMAP
  edit in task 7 has something to point at. Each `## Decision that hinges on it`
  states what changes in phase 2 onward on each verdict: for OQ-1, whether a
  conditional preamble is worth writing into 28 command skills at all; for OQ-2,
  whether that preamble must be reachable mid-run rather than one-shot; for
  OQ-3, what 4.0.0's go/no-go is judged against. Write NO `## Observation` body
  and NO `VERDICT:` line in this task - the whole value of the ordering is that
  the criteria are committed before the result exists and cannot be
  rationalized backwards. Do not write the preamble text itself into any skill
  file; that is out of scope for this phase.
- **Verify:** Running `for f in .planning/spikes/{v3-baseline-dispatch-cost,toolsearch-conditional-skip,tools-survive-compaction}/SPIKE.md; do echo "$f"; grep -c '^### C' "$f"; grep -c '^VERDICT:' "$f"; done`
  prints all three paths, a criteria count of at least 2 for each, and a
  `VERDICT:` count of 0 for each; and `grep -l 'OQ-1' .planning/spikes/*/SPIKE.md`,
  `grep -l 'OQ-2' ...`, `grep -l 'OQ-3' ...` each name exactly one of the three
  new files.

### Task 2: Record the per-role dispatch cost, static bytes and terminal token p75

- **Files:** `.planning/spikes/v3-baseline-dispatch-cost/SPIKE.md`
- **Action:** Add an `## Observation` subsection answering the per-role half of
  the baseline for the six dispatched roles `cad-planner`, `cad-executor`,
  `cad-verifier`, `cad-reviewer`, `cad-assumptions-analyzer` and
  `cad-plan-checker`. Report TWO labeled numbers per role and call neither of
  them "prompt size" unqualified (D-02). The static number is `dispatchBytes`
  from `node cadence-core/bin/weight.mjs resident` run at `/code/cadence`, whose
  `roles[]` rows carry `role`, `agent`, `agentBytes`, `contracts[]` and
  `dispatchBytes` - there is one row per rung file, so state which `agent` file
  each figure came from or state the spread across a role's rungs; a single
  unattributed number for a role is what this instruction exists to prevent. The
  terminal number is the p75 of `tokens` over the archive corpus, from
  `node /code/cadence/cadence-core/bin/planning.mjs trace render` run with the
  working directory `/projects/cadence-archive-v3.7.12`, whose `brackets[]` rows
  carry `corr`, `phase`, `plan`, `role`, `event`, `ts`, `end`, `ms` and `tokens`,
  and whose `roles{}` block carries `dispatches`, `tokens`, `turns`,
  `unrecorded` and `turns_unrecorded` per role key. A `tokens` of `null` is
  UNRECORDED, is excluded from the p75, and is reported as its own count beside
  it; the denominator for each role is `dispatches - unrecorded` and is printed
  (D-08). Mark every role whose n falls below 30 as NOT A STABLE ESTIMATE in the
  row itself, and name which ones qualified - measured during planning that is
  `cad-reviewer` at n=10 and `cad-plan-checker` at n=5, where a p75 is a single
  order statistic and a bare table row would carry it into task 8's go/no-go
  looking exactly like the four that rest on 82 to 241 observations.
  State in the record which percentile convention was used - nearest-rank
  or linear interpolation - because "p75" alone does not settle a value and the
  next reader will re-derive it. Exclude the role keys `""` and `cad-task` from
  any all-roles figure and say why (figureless by construction). State plainly
  that the composed dispatch prompt's own size is recorded nowhere on disk and
  is not recoverable from this corpus - the two numbers bracket it, they do not
  measure it (D-02). Add nothing to the trace record and change no code to make
  a missing figure derivable (D-06).
- **Verify:** The record's per-role block has one row for each of the six roles,
  each carrying a `dispatchBytes` value, a p75 value, an n and an unrecorded
  count, and the two rows whose n is below 30 carry the not-a-stable-estimate
  marking while the other four do not. Running `cd /projects/cadence-archive-v3.7.12 && node /code/cadence/cadence-core/bin/planning.mjs trace render`
  and applying the record's own stated percentile convention to the non-null
  `tokens` of `brackets[]` rows with `role: "cad-planner"` reproduces the p75 the
  record states for `cad-planner`, and that row's n equals
  `roles["cad-planner"].dispatches - roles["cad-planner"].unrecorded`.

### Task 3: Record the coordinator byte growth per phase run, for both topologies

- **Files:** `.planning/spikes/v3-baseline-dispatch-cost/SPIKE.md`
- **Action:** Add the main-thread half of the baseline. The proxy for the main
  thread is `reads.jsonl` rows carrying `agent: "coordinator"` (D-07). Parse BOTH
  `/projects/cadence-archive-v3.7.12/.planning/reads.jsonl` and the rotated
  `/projects/cadence-archive-v3.7.12/.planning/reads.1.jsonl` with a throwaway
  script written to a TEMP DIRECTORY OUTSIDE THIS REPOSITORY - not
  `.planning/spikes/<slug>/`, which `cadence-core/workflows/spike.md` step 4
  offers first but which sits inside this task's own lease, so a staged script
  beside the SPIKE.md trips `lease-check`'s `undeclared-files` refusal and halts
  the task at its commit. No analysis script is staged or committed by this
  phase. The script is needed because the shipped seam
  (`cadence-core/bin/planning/reads.mjs`) reads only the live file and
  `joinReads` in `cadence-core/bin/lib/read-trace.mjs` drops the `bytes` field
  from its row shape - the field this whole figure is made of. Row shape is `ts`,
  `tool`, `agent`, `tool_use_id`, `target`, `files[]`, `bytes`; a
  `record_rotated` marker row carries no `agent` and must not be counted as one.
  Attribute each coordinator row to a phase run by joining its `ts` into a
  `corr`'s window, taken as the minimum dispatch `ts` to the maximum close `end`
  over that `corr`'s `brackets[]` rows from the same `trace render` output task 2
  used. Two edge effects have to be handled rather than absorbed. First, exclude
  from BOTH populations any `corr` whose window minimum precedes the reads
  corpus's minimum `ts`: such a window is only partly covered by the reads files
  and counting it in n deflates the per-phase-run byte figure with traffic that
  was never on disk. Report the two groups the rule removes as TWO separately
  named lines, never one combined "excluded" figure: "windows excluded as partly
  covered: N" - measured during planning, 5 of the 118 - and "windows dropped as
  entirely before the corpus: M" - measured during planning, 10, dropped by the
  same rule without bias. Second,
  publish the count of coordinator rows carrying NO `bytes` field as
  `unrecorded` and never sum them as zero - measured during planning that is 30
  rows in `reads.jsonl` and 0 of 16,131 in `reads.1.jsonl`, and a naive sum turns
  them into a recorded zero, the exact collapse D-08 forbids. Report the
  per-phase-run coordinator BYTE figure for two populations and
  name the gap between them as the cost of the parallel worktree path 4.0.0
  drops (D-03): serial-only, meaning the `corr` values carrying at most one
  numeric executor `plan` key, and all-phases, meaning every `corr`. Each
  population states its own n. Publish the count of coordinator rows that fell
  inside no window rather than dropping them silently, and publish the corpus
  denominators - coordinator rows per file and in total - because CONTEXT's
  D-07 states 3,823 rows and 96% attribution for the LIVE file alone, and this
  task's population is both files. Name the date range the reads corpus covers,
  taken as the minimum and maximum `ts` across the two files, and state that
  nothing before that range is recoverable and that `reads.1.jsonl` is full to
  its 8,388,608-byte cap. Apply D-05's exclusion of `cadence:zz-abtest-noexcerpt`
  and `hookify:conversation-analyzer` to any total that spans agents, and state
  whether it moved the coordinator population at all.
- **Verify:** The record carries a two-row population table, serial-only and
  all-phases, each row with a coordinator byte figure and an n, plus a named
  corpus date range, a count of unattributed coordinator rows, a count of `corr`
  windows excluded for starting before the reads corpus, and a count of
  coordinator rows lacking a `bytes` field labeled `unrecorded` rather than
  summed. Re-running the
  throwaway script reproduces the all-phases n as the number of distinct `corr`
  values holding at least one attributed coordinator row AND whose window
  minimum is at or after the corpus minimum `ts`, and the stated date
  range equals the minimum and maximum `ts` across
  `/projects/cadence-archive-v3.7.12/.planning/reads.jsonl` and
  `/projects/cadence-archive-v3.7.12/.planning/reads.1.jsonl`.

### Task 4: Close the OQ-3 record with a verdict and its method caveats

- **Files:** `.planning/spikes/v3-baseline-dispatch-cost/SPIKE.md`
- **Action:** Write one observed result per criterion written in task 1, then a
  `## Verdict` section carrying exactly one `VERDICT:` line reading `validated`,
  `invalidated` or `inconclusive`, and a `RECOMMENDATION:` naming what phase 2
  onward does with this baseline. `inconclusive` is a real answer for a figure
  the record cannot produce and must not be used to soften a figure the record
  produced and that turned out unwelcome (`cadence-core/workflows/spike.md` step
  5). Carry the two caveats that are already known so they are not laundered
  into the number: the host's `Done (N tool uses - X tokens - Ys)` rendering is
  untested for stability across 2026-08-07 to 2026-09-05, every `tokens` figure
  in the corpus is hand-copied off that line, and if the rendering changed the
  token p75s are a blend of two populations while the `dispatchBytes` half is
  host-independent and unaffected; and the archive `trace.jsonl` sits at 933,844
  of the reader's 1,048,576-byte cap with `capped` false today, past which the
  reader keeps the FIRST bytes so the NEWEST brackets would be lost to the
  pairing rather than the oldest. Also report, without acting on it, that the
  shipped `workflow.max_dispatch_tokens` defaults are stale against this corpus
  and that `cad-planner` exceeds its own 200,000 ceiling at p75 - phase 1 reports
  this and does not retune a tree that is being replaced.
- **Verify:** `grep -c '^VERDICT:' .planning/spikes/v3-baseline-dispatch-cost/SPIKE.md`
  returns 1, and `grep '^VERDICT:'` on that file prints one of `validated`,
  `invalidated` or `inconclusive`; the record has one observed-result entry per
  `### C` criterion the file carries; and `grep -n 'capped\|Done (' ` on the file
  shows both caveats present in prose.

### Task 5: Probe whether a conditional ToolSearch preamble gets skipped, and record OQ-1

- **Files:** `.planning/spikes/toolsearch-conditional-skip/SPIKE.md`
- **Action:** JOHN is the operator: he runs the probe in a live Claude Code CLI
  session and supplies the figures. A subagent cannot run it - a subagent whose
  definition names its tools has them at call #1
  (`docs/rationale/architecture-v4.md` section 4), so it never sees a deferred
  first load and has no view of its own `cache_creation` turn accounting. The
  executor's job is to write the record's `## Observation` section by
  transcribing John's supplied figures VERBATIM, and to write nothing into the
  two token fields or the skip/no-skip field from any other source - not from
  this plan, not from the design doc, not from `.planning/REQUIREMENTS.md`.
  A supplied observation reaches the executor exactly one of two ways: a block
  John has appended to this record under an `## Observation` heading before the
  dispatch, or observation text carried in the executor's own dispatch prompt.
  If neither carries one, take the inconclusive path below - do not go looking
  for the figures anywhere else, and do not read silence as an absent run.
  Record the CLI version string the probe ran on -
  section 4 of `docs/rationale/architecture-v4.md` pins its measured facts to
  CLI 2.1.261 and a probe that cannot name its host cannot be compared to them.
  Two numbers are required: the token cost of a FIRST `ToolSearch` load of a
  deferred schema, and the cost of a SECOND `ToolSearch` for that same
  already-loaded schema, read the way the design doc's figures were read
  (`cache_creation` on the following turn). That doc's section 4 records 914 and
  905 for those two loads: those are the PRIOR this probe tests, not a result,
  and they belong only in a section headed as prior - never in the observation's
  token fields. If no observation is supplied in this run, the `VERDICT:` is
  `inconclusive` with "not yet observed" as its reason, the observation fields
  stay empty, and the prior section cites the design doc's 914/905 as the
  untested expectation. Then
  answer the question those numbers do not answer: whether the model SKIPS the
  search when the preamble is phrased conditionally - the wording the design doc
  proposes is "if excerpt_read is not in your loaded tools, ToolSearch `select:`
  it" - so the observation is whether a second search is issued at all under
  conditional phrasing, not only what it costs when issued. Write one observed
  result per criterion from task 1 and one `VERDICT:` line. Record the standing
  constraint the verdict has to be actionable against: an unconditional preamble
  in all 28 command skills would cross 28 pinned ceilings in
  `cadence-core/bin/weight-budgets.json` at once, enforced by
  `cadence-core/bin/self-verify.mjs`. Do NOT add the preamble to any skill file,
  to `weight-budgets.json`, or to any workflow - this phase decides the shape,
  a later phase writes it.
- **Verify:** human-verify - needs a live Claude Code CLI session, since a
  ToolSearch load cost is only observable from a real session's turn accounting.
  John should confirm the record names the CLI version he ran, and that the two
  token figures in it are the ones he observed for the first and the repeat load.
  Mechanically: `grep -c '^VERDICT:' .planning/spikes/toolsearch-conditional-skip/SPIKE.md`
  returns 1, and every token figure and every stated skip/no-skip outcome in the
  file carries its provenance beside it, in one of exactly two forms -
  "observed <date>, CLI <version>" or
  "cited from `docs/rationale/architecture-v4.md` section 4" - so a
  transcribed design-doc figure cannot be read as an observed one. If the verdict
  is not `inconclusive`, the file carries two distinct integer token figures
  explicitly labeled first-load and repeat-load and both carry the observed form,
  plus a CLI version string and one sentence
  stating whether the conditional phrasing produced a skip; if it is
  `inconclusive`, its reason reads "not yet observed" and no figure carries the
  observed form. And
  `git grep -l 'ToolSearch' -- skills/ cadence-core/workflows/` returns nothing,
  proving no preamble leaked into the shipped surface.

### Task 6: Observe one compaction and record whether loaded tools survive it, OQ-2

- **Files:** `.planning/spikes/tools-survive-compaction/SPIKE.md`
- **Action:** JOHN is the operator: he observes ONE compaction in a live Claude
  Code CLI session and supplies what he saw. A subagent cannot do this - it
  cannot force a compaction and, per section 4 of
  `docs/rationale/architecture-v4.md`, never has a deferred tool to lose. The
  executor writes the record's `## Observation` section by transcribing John's
  account VERBATIM and writes nothing into the post-boundary result field from
  any other source. A supplied observation reaches the executor exactly one of
  two ways: a block John has appended to this record under an `## Observation`
  heading before the dispatch, or observation text carried in the executor's own
  dispatch prompt. If neither carries one, take the inconclusive path - do not
  go looking for the account anywhere else. If no observation is supplied in this run, the `VERDICT:` is
  `inconclusive` with "not yet observed" as its reason, the result field stays
  empty, and the design doc's `[guess] loaded tools survive compaction` line is
  cited in a section headed as prior - as the expectation being tested, never as
  a result. The sequence the observation needs: before
  the boundary, load a deferred MCP tool schema via `ToolSearch` and call that
  tool successfully; let the session compact; after the boundary, call the SAME
  tool with no intervening `ToolSearch`. Record the CLI version, the tool used,
  and the post-boundary call's actual result - specifically whether it succeeded
  or returned the `InputValidationError` naming `ToolSearch` that section 4 of
  `docs/rationale/architecture-v4.md` records as the soft failure mode for
  calling a deferred tool unloaded; that failure mode is the design doc's
  prediction and goes in the prior section, so the result field carries only what
  John reports coming back. State whether the CLI's
  `preCompactDiscoveredTools` and "carried from compact boundary" strings, which
  are the suggestive evidence this question exists to replace, agree with what
  was observed. Write one observed result per criterion from task 1 and one
  `VERDICT:` line. If the compaction could not be induced in one session, that is
  `inconclusive` with the reason and what would decide it, not a verdict borrowed
  from the CLI strings.
- **Verify:** human-verify - needs a live Claude Code CLI session that actually
  compacts, which cannot be forced from a subagent. John should confirm the
  record describes the compaction he saw and that the post-boundary call's stated
  result is what actually came back. Mechanically:
  `grep -c '^VERDICT:' .planning/spikes/tools-survive-compaction/SPIKE.md`
  returns 1, and the post-boundary result and every survival claim in the file
  carry their provenance beside them, in
  one of exactly two forms - "observed <date>, CLI <version>" or "cited from
  `docs/rationale/architecture-v4.md` section 4" - so a transcribed prediction
  cannot be read as an observation. If the verdict is not `inconclusive`, the
  file carries a CLI version string plus one sentence stating
  survived or did not survive with the post-boundary call's result quoted, both
  in the observed form. An `inconclusive` verdict comes in two kinds and the
  record must say which. NOT ATTEMPTED: the reason reads "not yet observed" and
  nothing in the file carries the observed form. ATTEMPTED, NO COMPACTION: the
  reason names what happened and what would decide it, the file DOES carry
  observed-form provenance for the CLI version and the successful pre-boundary
  call, and the post-boundary result field stays empty because there was no
  boundary to call across. Rejecting the second kind would force John's truthful
  account to be replaced by "not yet observed" to pass.

### Task 7: Land the three verdicts in the ROADMAP's Open Questions section

- **Files:** `.planning/ROADMAP.md`
- **Action:** Edit the `## Open Questions` section in place. Replace each of the
  OQ-1, OQ-2 and OQ-3 bullets with its verdict plus the repository path to its
  spike record, keeping the `**OQ-N - <question>**` bullet form the section
  already uses so the block stays readable as a list of settled questions. This
  tracked prose citation is the only mechanism that reaches phase 2 - nothing in
  `cadence-core/bin` parses a SPIKE.md and the records are not phase-linked
  (D-04). Then correct the two sentences the mined-baseline scope makes false:
  the OQ-3 bullet's claim that the baseline was "measured on the shipped 3.7.12
  tree across one real phase", and the Phase 1 detail's claim that the phase
  "measures the shipped 3.7.12 tree on a real phase". Both are false in the same
  way and the replacement says what actually happened: the baseline was MINED
  from records already on disk at `/projects/cadence-archive-v3.7.12/.planning/`,
  spanning many phase runs across the dates the OQ-3 record names, with no live
  measurement run. Note that "on a real phase" is currently SPLIT ACROSS A LINE
  WRAP at lines 93-94, so a line-oriented grep does not see it and a rewrite that
  only fixes the visible one leaves the phrase in the file. Change nothing else:
  the `## Phases` checkboxes, the phase 2-4 details and the overview stay as they
  are.
- **Verify:** `tr '\n' ' ' < .planning/ROADMAP.md | grep -o 'across one real phase\|on a real phase'`
  prints nothing; and the `## Open Questions` section FLATTENED the same way -
  `sed -n '/^## Open Questions/,/^## Phases/p' .planning/ROADMAP.md | tr '\n' ' '` -
  contains all three `spikes/<slug>/SPIKE.md` paths and three verdict words drawn
  from `validated`, `invalidated`, `inconclusive`. Do not require a path and its
  verdict on the same physical line: the wrap that hid "on a real phase" will
  separate them in any correctly rewrapped bullet.

### Task 8: Carry the baseline figures into the architecture doc beside the go/no-go

- **Files:** `docs/rationale/architecture-v4.md`
- **Action:** The doc is tracked in git as of the move on 2026-09-05, so a bad
  edit is recoverable with `git checkout -- docs/rationale/architecture-v4.md`
  and no scratch copy is needed. Add the task 2 and task 3 figures to
  section 7, "Expectations (no
  data; tagged)", which is where the go/no-go language they are judged against
  lives. Pin the insertion point: immediately after the paragraph ending "Do not
  sell the architecture as a token win until trace proves one. It is a
  determinism and turn-count win." and BEFORE the paragraph beginning "External
  evidence for the same shape" (lines 376-379 as of 2026-09-05). That go/no-go
  paragraph is not the section's closing line - section 7 runs on for roughly
  forty more lines through the SKILL.state external-evidence block - and
  appending to the end of the section puts the measured figures nowhere near the
  language D-10 asks them to sit beside. The Tokens paragraph above the insertion
  point carries the `[estimate, 4 chars/token]` figures the measured
  numbers now sit beside. Add them as their own clearly labeled measured
  subsection carrying the date measured and a citation to
  `.planning/spikes/v3-baseline-dispatch-cost/SPIKE.md` in the cadence repository
  (D-10). Carry the per-role `dispatchBytes` and terminal-token p75 table with
  its denominators, and the two coordinator populations with their n and the
  corpus date range. Carry task 2's not-a-stable-estimate marking onto the two
  rows that earned it rather than publishing them as bare rows: a p75 over 5 or
  10 observations reaching the go/no-go unmarked is how a single order statistic
  gets read as a measurement. Do not restate the whole spike record here - the citation is
  the mechanism and the figures are what gets judged. Leave every existing
  `[guess]` and `[estimate]` tag in the section exactly as it is: they mark
  claims this phase did not measure, and blurring the measured block into them
  is what the tagging exists to prevent. Do not edit section 9's "Open and
  untested" bullets and do not retitle section 7; both are outside what this
  phase's decisions authorize.
- **Verify:** `grep -n 'v3-baseline-dispatch-cost' docs/rationale/architecture-v4.md`
  prints at least one line inside section 7 (between the `## 7.` and `## 8.`
  headings), and `sed -n '/^## 7\./,/^## 8\./p' docs/rationale/architecture-v4.md`
  shows the six per-role rows and both coordinator population figures with their
  n values, with the measured block sitting between the "determinism and
  turn-count win." line and the "External evidence for the same shape" paragraph.
  For tag preservation use the absolute counts, not a before-and-after
  comparison there is no version control to make:
  `sed -n '/^## 7\./,/^## 8\./p' docs/rationale/architecture-v4.md | grep -c '\[guess\]'`
  returns 2 and the same pipeline with `grep -c '\[estimate'` returns 1.

## Notes

- Plan shape honors the CONTEXT directive: one plan. The file-independence test
  agrees - tasks 2, 3 and 4 all write
  `.planning/spikes/v3-baseline-dispatch-cost/SPIKE.md`, and tasks 7 and 8
  cannot start until every verdict from tasks 4, 5 and 6 exists. No independent
  slice exists to split out.
- Requirement coverage, as declared in the frontmatter: `BAS-01` covers tasks 2,
  3, 4 and 8; `TSL-01` covers tasks 1, 5 and 7; `TSL-02` covers tasks 1, 6 and 7.
  All three are
  live in `.planning/REQUIREMENTS.md`'s `## Active` section under the 4.0.0
  cycle. Do not strip the frontmatter list.
- `docs/rationale/architecture-v4.md` moved into this repository on 2026-09-05,
  from `/projects/cadence-v4-architecture.md`. Task 8's change therefore DOES
  land in a commit and IS confirmable by a diff, and the file is inside
  `lease-check`'s reach - it is declared in this plan's `files:`, so a stray
  edit is refused rather than silent. Keep the edit to what task 8 states.
- CONTEXT's D-07 cites 3,823 coordinator rows with 96% attribution. Measured
  during planning, that is the LIVE `reads.jsonl` alone; `reads.1.jsonl` holds
  16,131 more, for 19,954 across the two files D-07 requires parsing. Task 3
  publishes its own both-files denominators rather than carrying the live-file
  figure forward.
- Three corrections were noticed and deliberately NOT planned, because no locked
  decision authorizes them and they are the human's call, not the executor's:
  (1) `.planning/ROADMAP.md`'s Phase 1 detail says "Its output is a spike record
  with three verdicts", which D-09's three one-verdict records makes false, but
  D-04 licenses exactly two sentence corrections and this is not one of them;
  (2) `docs/rationale/architecture-v4.md`'s section 7 heading reads "(no data;
  tagged)" and will contain measured data after task 8; (3) that document's
  section 9 carries the OQ-1 and OQ-2 questions as "(design) ... not observed",
  which tasks 5 and 6 answer, but D-10 covers only the AC3 and AC4 figures.
