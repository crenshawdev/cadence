---
phase: 1
plan: 2
requirements:
  - RES-02
files:
  - agents/cad-verifier.md
  - agents/cad-verifier-medium.md
  - agents/cad-verifier-xhigh.md
  - agents/cad-verifier-max.md
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/planning.test.mjs
  - skills/cad-verifier-contract/SKILL.md
  - cadence-core/workflows/verify-deep.md
  - cadence-core/workflows/verify.md
  - cadence-core/bin/weight-budgets.json
---

# Phase 1: The orchestrator stops holding what its children returned - Plan 2

## Goal

No subagent's full output is resident in a parent context after the turn it
arrived on. This plan takes the verifier seam (RES-02): cad-verifier writes one
findings file and returns a digest plus its path, `uat merge` consumes that file
directly, and the narrow `Write` grant that makes it possible is bounded by a
blocking check rather than by good intentions.

## Must be true when done

- cad-verifier writes exactly one file, `.planning/phases/<N>/VERIFIER-FINDINGS.json`,
  and its final message is a digest naming that path - no truths table, no gap
  bodies, no human-check bodies in the return.
- `Write` is declared on all four cad-verifier rungs while `Edit` and
  `MultiEdit` stay in `disallowedTools`, and `node cadence-core/bin/self-verify.mjs`
  fails when any one of those three facts stops being true.
- `planning.mjs uat merge --phase <N> --payload <file>` merges the verifier's
  file as-is, and no hand-transcription step remains anywhere in
  `cadence-core/workflows/verify-deep.md`.
- A missing, empty, literal-`null` or wrong-shape payload is refused as
  `ok:false` with a named reason and exit 1 - never a silent exit 0, never an
  all-zero `ok:true` success - and leaves UAT.md byte-identical with no
  FINDINGS.json written.
- On any of those refusals `/cad-verify --deep` falls through to the walk with
  the checklist unchanged, on the SAME path as a failed or timed-out dispatch.
- `route_failures` opens the findings file at the step that acts on it, not at
  dispatch time.

## Context

- D-05: the file is JSON in the exact `uat merge` payload shape and must NOT be
  named `FINDINGS.json` - the seam owns that name and atomically overwrites it on
  every successful merge, so the merge would destroy the file that fed it.
- D-06: one file carries everything - the per-truth table, `missing` and
  `why_human` ride the same JSON as extra top-level keys, which `uat merge`
  ignores.
- D-07: the seam gains `--payload <file>` with named `no-payload` / `bad-payload`
  refusals, a CONTRACTS row and sibling tests. Two live holes make the
  fall-through unprovable otherwise: a literal `null` payload exits 0 printing
  NOTHING, and any parseable non-payload JSON merges as an all-zero `ok:true`.
- D-08/D-16: agent frontmatter exposes no path-scoped tool permission, so
  "narrow" cannot be host-enforced and a blocking self-verify check is the only
  mechanical backstop.
- D-17: `verify.md`, `verify-deep.md`, `cad-verifier-contract` and the four rung
  files all sit exactly at their byte budgets, so `weight-budgets.json`
  regenerates in the same commit as each edit.
- Out of scope: any change to `uat merge`'s merge RULES (first_pass, the
  never-overwrite-a-user-result invariant, the counters, FINDINGS.json), and any
  widening of the grant beyond one file under `.planning/phases/<N>/`.

## Tasks

### Task 1: Grant Write to the four cad-verifier rungs, keep Edit and MultiEdit denied

- **Files:** agents/cad-verifier.md, agents/cad-verifier-medium.md,
  agents/cad-verifier-xhigh.md, agents/cad-verifier-max.md,
  cadence-core/bin/weight-budgets.json
- **Action:** In each of the four rung files, move `Write` from `disallowedTools`
  into `tools`: the frontmatter becomes `tools: Read, Write, Bash, Grep, Glob`
  and `disallowedTools: Edit, MultiEdit`. Change nothing else - not `effort`, not
  `skills:`, not `color`, and not the body, which must stay
  the exact rung template (`lib/rung-agent.mjs`'s `rungBody`) or check 7 fails.
  This is the milestone's one deliberate safety exception (RES-02): a grant of
  one file under `.planning/phases/<N>/`, with editing and multi-editing still
  denied. ONE description also changes, in `agents/cad-verifier.md` only: its
  trailing `Read-only; returns structured findings for cad-verify to merge into
  UAT.md` becomes false the moment this plan lands, and a false claim there rides
  the system prompt of every session, so replace those two clauses with a
  statement that the agent writes one findings file under
  `.planning/phases/<N>/` and returns a digest naming it. Keep the sentence's
  first two clauses byte-identical (`Goal-backward phase verification. Confirms
  the codebase actually delivered the phase's goal, not merely that its tasks
  ran.`) so every trigger word survives, and write the replacement in plain prose
  with no backticked tool name. The other three rung files carry the generic
  routed-rung description, which stays true and stays byte-identical. This is a
  truth correction to a claim THIS plan falsifies, not phase 3's BUD-01 trimming
  (which is about description LENGTH and owns every other description in the
  tree); CONTEXT's scope boundary is honoured by touching no other one. The tools
  swap itself is byte-neutral (`, Write` added, `Write, ` removed), so three of
  the four counts should not move and the description correction moves
  `agents/cad-verifier.md`'s - regenerate all four entries to the exact counts
  `node cadence-core/bin/weight.mjs` reports; a changed count that is not
  regenerated fails self-verify with `budget-overrun`.
- **Verify:** `grep -n "^tools:\|^disallowedTools:" agents/cad-verifier.md
  agents/cad-verifier-medium.md agents/cad-verifier-xhigh.md
  agents/cad-verifier-max.md` prints eight lines, four reading
  `tools: Read, Write, Bash, Grep, Glob` and four reading
  `disallowedTools: Edit, MultiEdit`; `grep -n "Read-only\|structured findings"
  agents/cad-verifier.md` prints nothing while
  `grep -c "Goal-backward phase verification" agents/cad-verifier.md` prints `1`;
  and `node cadence-core/bin/self-verify.mjs`
  prints `"ok":true`.

### Task 2: Make the grant's boundary a blocking check

- **Files:** cadence-core/bin/self-verify.mjs, cadence-core/bin/self-verify.test.mjs
- **Action:** Add a per-role tool policy to `self-verify.mjs` and assert it on
  every rung of the role. Beside `KNOWN_TOOLS`, add a frozen `TOOL_POLICY`
  constant mapping `cad-verifier` to `{ required: ['Write'], denied: ['Edit',
  'MultiEdit'] }`, with a comment stating why it exists: Claude Code agent
  frontmatter exposes no path-scoped tool permission (D-16), so "one file under
  `.planning/phases/<N>/`" cannot be host-enforced and this check is the only
  thing standing between the milestone's one exception and an unbounded write
  grant that ships silently. Import `rungFiles` from `./lib/rung-agent.mjs`
  alongside the existing rung imports, so the file list comes from the SAME map
  route.mjs dispatches through rather than from a filename glob. Inside the
  existing `agents/` walk, where `declared` is already built from the `tools:`
  frontmatter line, parse `disallowedTools:` into a second set the same way
  (comma-split, trimmed). Then, when the file's stem is in `rungFiles(role)` for
  a role in `TOOL_POLICY`, push a problem for each of three conditions: a
  `required` tool absent from `tools:` (kind `missing-tool-grant`), a `denied`
  tool absent from `disallowedTools:` (kind `missing-tool-denial`), and a
  `denied` tool that ALSO appears in `tools:` (kind `contradicted-tool-denial`) -
  the third is the widening that would otherwise ship as a two-word frontmatter
  edit, and no host behaviour is documented for a tool named in both lists.
  Every detail names the file, the tool and the frontmatter key a maintainer
  would edit. Add the check to the `checked:` string emitted at the end of the
  run as `tool-policy`. In `self-verify.test.mjs`, update the `VERIFIER_AGENTS`
  constant and `fullFixture`'s inline agent text to carry the compliant
  frontmatter (`tools: Read, Write` and `disallowedTools: Edit, MultiEdit`), so
  existing fixtures do not accumulate unrelated problems, and add five rows: a
  `cad-verifier` rung file without `Write` reports `missing-tool-grant`; one
  whose `disallowedTools` drops `Edit` reports `missing-tool-denial`; one listing
  `Edit` in both lists reports `contradicted-tool-denial`; a compliant rung file
  reports none of the three; and a NON-policy agent (a `cad-executor` file with
  `Write` in `tools:` and no `disallowedTools` line) reports none of the three,
  pinning the policy to the role rather than to the tool.
- **Verify:** `node --test cadence-core/bin/self-verify.test.mjs` passes
  including the five new rows; `node cadence-core/bin/self-verify.mjs` prints
  `"ok":true` on the real tree and its `checked` string contains `tool-policy`;
  and re-running it after temporarily deleting `Write` from
  `agents/cad-verifier-max.md`'s `tools:` line prints `"ok":false` with a
  `missing-tool-grant` problem naming that file (restore the line afterward).

### Task 3: uat merge accepts a payload FILE and refuses a non-payload

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/planning.test.mjs,
  cadence-core/bin/self-verify.mjs
- **Action:** Replace `readStdinJson` with a `readPayload(opts)` reader serving
  both sources, and give `uat merge` an envelope guard. `readPayload` reads the
  file named by `--payload <file>` when present, else stdin; `--payload -` means
  stdin, matching `review-provider.mjs`'s existing convention for the same flag.
  Refusals: `--payload` given with no value (which `parseArgs` yields as boolean
  `true`) or a path that cannot be read fails `no-payload` naming the path;
  unparseable JSON from either source fails `bad-payload` with the parser's
  message. Critically, the reader must distinguish "already failed" from "parsed
  to `null`": today `readStdinJson` returns `null` for both, and the callers'
  `=== null` test makes a literal `null` payload exit 0 printing NOTHING - so the
  failure sentinel becomes `undefined` and every caller tests `=== undefined`,
  leaving `null` a legal parsed value that the guards below then refuse. Update
  the `init`/`refresh` caller to the same sentinel; `null` there falls into the
  existing `!Array.isArray(items)` guard and lands as `bad-payload`, closing the
  identical hole on that arm. In the `merge` arm, add the envelope guard
  immediately after the read and BEFORE `loadUat`, so a refusal leaves UAT.md
  byte-identical and writes no FINDINGS.json: the value must be a non-null,
  non-array object; each of `passes`, `gaps` and `human_checks` that is present
  must be an Array; and at least one of the three must be present. Anything else
  fails `bad-payload` with a detail naming the three keys. Extra top-level keys
  are IGNORED, never refused - the verifier's one file carries `truths`,
  `missing`, `why_human`, `phase`, `goal`, `status` and `score` beside the three
  consumed lists (D-06). This closes the second live hole: `{"hello":"x"}`
  currently merges as an all-zero `ok:true`, so a truncated findings file
  reports a clean deep pass instead of falling through. Add `--payload` to the
  `'uat merge'` row of `CONTRACTS` in `self-verify.mjs` - without it the new
  invocation in `verify-deep.md` fails check 2 as a phantom flag. Then add
  tests to `planning.test.mjs` beside the existing merge rows, using the local
  `run(args, dir, stdin)` helper and asserting `_exit === 1` on every refusal:
  a `--payload` path that does not exist reports `no-payload`; an empty file
  reports `bad-payload`; a file containing exactly `null` reports `bad-payload`;
  a file containing `{"hello":"x"}` reports `bad-payload` AND leaves UAT.md
  byte-identical with no `phases/1/FINDINGS.json` on disk; stdin containing
  `null` reports `bad-payload` with exit 1 (the regression row - it printed
  nothing and exited 0 before); and a happy-path row where a `--payload` file
  carrying `passes`, `gaps`, `human_checks` PLUS extra top-level keys
  (`truths`, `missing`, `why_human`) produces the same counters as the identical
  payload on stdin, proving the extra keys are ignored. Pass `''` as stdin on the
  `--payload` rows so a regression that falls back to stdin fails with a wrong
  reason instead of hanging CI.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes including
  the six new rows; `node cadence-core/bin/self-verify.mjs` prints `"ok":true`;
  and `npx tsc -p tsconfig.ci.json` exits 0.

### Task 4: cad-verifier writes one findings file and returns a digest

- **Files:** skills/cad-verifier-contract/SKILL.md,
  cadence-core/bin/weight-budgets.json
- **Action:** Rewrite `<output>` so the findings become a FILE and the return
  becomes a digest. The file is `.planning/phases/<N>/VERIFIER-FINDINGS.json` -
  one file, valid JSON, UTF-8, written once at the end with the `Write` tool.
  The name is deliberate and must not become `FINDINGS.json`: that name belongs
  to the seam, which atomically overwrites it on every successful merge, so a
  findings file under that name would be destroyed by the merge it fed (D-05).
  Its top-level keys are `phase`, `goal`, `status` (`delivered | gaps |
  needs_human`), `score` (`"{verified}/{total}"`), `truths` (one object per truth:
  `n`, `truth`, `status`, `uat_item`, `evidence`), `passes`, `gaps`,
  `human_checks`, `missing` and `why_human`. The three middle lists keep the
  `uat merge` field names exactly as the current markdown block states them -
  `passes` entries carry `k`, `name` and `evidence`; `gaps` entries carry `name`,
  optional `k`, `reason`, `evidence` and `severity`; `human_checks` entries carry
  `name` and `expected` - because the file IS the merge payload and nothing
  downstream translates it. Write all three as `[]` rather than omitting them
  when empty: the seam's envelope guard requires at least one of the three to be
  present as an array. `missing` and `why_human` are top-level arrays of
  `{name, missing}` and `{name, why_human}`, keyed by the entry's `name` so
  `route_failures` can join them back to the gap or human check they belong to
  (D-06); they are extra keys the merge ignores, which is what keeps "exactly one
  file" true without losing the phase record. The final MESSAGE is a digest and
  nothing else: `status`, `score`, `gaps: {n}`, `human_checks: {n}`, and the file
  path - no truths table, no gap bodies, no evidence strings. Update `<role>`'s
  last sentence accordingly (dispatched with the phase number, goal, current UAT
  items and artifact paths; writes exactly one file; returns a digest naming it),
  and rewrite the first `<guardrails>` bullet from "Read-only: never create,
  edit, or delete files" to: write exactly one file, at that path, and nothing
  else - never edit an existing file, never delete one, never commit, never write
  a second file; `Edit` and `MultiEdit` are denied in the agent frontmatter and
  self-verify asserts that on every rung, and `Write` exists for this one file.
  Leave `<stance>`, `<core_principle>` and `<process>` sections 1-7 unchanged -
  the verification method is not what this milestone moves. Reference `Write` in
  backticks only where it is declared in the four rung files' `tools:` line, or
  the tools lint reports `undeclared-tool`. Regenerate this surface's
  `weight-budgets.json` entry in this task's commit.
- **Verify:** `grep -n "VERIFIER-FINDINGS.json" skills/cad-verifier-contract/SKILL.md`
  prints lines in `<role>`, `<output>` and `<guardrails>`;
  `grep -n "You write nothing\|do NOT write any file"
  skills/cad-verifier-contract/SKILL.md` prints nothing; and
  `node cadence-core/bin/self-verify.mjs` prints `"ok":true`.

### Task 5: verify-deep pipes the file and keeps the fall-through on one path

- **Files:** cadence-core/workflows/verify-deep.md,
  cadence-core/bin/weight-budgets.json
- **Action:** Rewrite the merge half of this cold branch. The dispatch paragraph
  now says cad-verifier writes `.planning/phases/<N>/VERIFIER-FINDINGS.json` and
  returns a digest plus that path, replacing "returns structured findings ... and
  writes nothing". The merge call becomes one invocation with the file passed by
  path - `planning.mjs uat merge --phase <N> --payload
  .planning/phases/<N>/VERIFIER-FINDINGS.json` - and the stdin form and its
  example JSON block go away with it. DELETE the "Building the payload is a copy,
  not a translation" paragraph outright: the file already speaks the merge's
  field names, so there is no copy step left to describe and no place to
  reintroduce one (AC4). Add one clause that `truths`, `missing` and `why_human`
  ride along in the same file and the merge ignores them, so the phase record
  survives without a second file. Extend the existing degradation sentence
  rather than adding a branch: a failed, empty or timed-out dispatch AND a merge
  refusal - `no-payload` when the file is missing or unreadable, `bad-payload`
  when it is empty, unparseable, `null` or not a payload - both mean the same
  thing, so say which one happened in one line and continue to the walk with the
  checklist as-is. State explicitly that this is the same path and not a new
  error path, because the deep pass is an accelerator and never a gate. Keep the
  merge-rules paragraph and the FINDINGS.json paragraph as they are - the seam's
  invariants and its own envelope file are unchanged by this. Regenerate this
  surface's `weight-budgets.json` entry in this task's commit.
- **Verify:** `grep -n "stdin" cadence-core/workflows/verify-deep.md` prints
  nothing; `grep -n "copy, not a translation" cadence-core/workflows/verify-deep.md`
  prints nothing; `grep -n -- "--payload" cadence-core/workflows/verify-deep.md`
  prints the single merge invocation; and `node cadence-core/bin/self-verify.mjs`
  prints `"ok":true`, which also proves the invocation's flags are all
  CONTRACTS-declared.

### Task 6: verify.md opens the findings file at the step that acts on it

- **Files:** cadence-core/workflows/verify.md, cadence-core/bin/weight-budgets.json
- **Action:** In `route_failures` step 1, add that when
  `.planning/phases/<N>/VERIFIER-FINDINGS.json` exists, it is opened HERE - at
  the step that diagnoses - and the failed item's `missing` entry (matched by the
  item's name), plus `why_human` for a human check, is the starting point for the
  root-cause read, not a substitute for it. State the reason in half a line:
  opening it at dispatch time instead would keep the whole findings body resident
  for every turn between the deep pass and this step
  (`cadence-core/references/seams.md` § spawn-agent break-even). In the
  `complete` step's commit list, add `phases/<N>/VERIFIER-FINDINGS.json` beside
  the existing `phases/<N>/FINDINGS.json` entry, on the same "if a deep pass
  wrote one" condition, so the verifier's file is tracked with the checklist it
  fed rather than left untracked in the phase directory. Change nothing else -
  not the walk, not the seam calls, not the phase-status transition rules, not
  the guardrails. Regenerate this surface's `weight-budgets.json` entry in this
  task's commit.
- **Verify:** `grep -n "VERIFIER-FINDINGS.json" cadence-core/workflows/verify.md`
  prints one line in `route_failures` and one in `complete`; and
  `node cadence-core/bin/self-verify.mjs` prints `"ok":true`.

## Notes

- **Plan-shape deviation (recorded, not silent).** CONTEXT's `Plan shape`
  directive asks for three plans split RES-01 / RES-02 / RES-03+04; this phase
  ships two, because RES-01 and RES-03 both edit the same steps of
  `cadence-core/workflows/execute.md` and the same blocks of
  `skills/cad-executor-contract/SKILL.md` and therefore cannot be independent
  slices. `PLAN-1.md`'s Notes carry the full statement. These two plans still
  share `cadence-core/bin/weight-budgets.json` (D-17 requires the manifest to
  regenerate in the same commit as each prose edit, and both plans edit budgeted
  surfaces), so `plan-overlap` will report that one overlap and `/cad-execute`
  will run the phase sequentially - which is intended: the split buys a fresh
  executor context per seam and independent verifiability, not parallelism.
- The findings file's NAME is planner's discretion under D-05, which fixes only
  the shape and the anti-name. `VERIFIER-FINDINGS.json` was chosen because it
  names its writer, matches the SHOUTCASE convention of the other phase
  artifacts (PLAN, SUMMARY, UAT, CONTEXT, FINDINGS), and sorts adjacent to
  `FINDINGS.json` so a reader of the phase directory sees the pair and the
  difference between them at once.
- Task 3 fixes two defects at the same seam that CONTEXT's D-07 documents as
  live: the `null`-sentinel collision in `readStdinJson` (exit 0, no output) and
  the missing envelope guard (all-zero `ok:true` on any parseable JSON). Both
  must be closed or AC5's fall-through is unprovable - a truncated findings file
  would report a clean deep pass rather than falling through to the walk.
- Hazard: `self-verify.mjs` check 5 lints agent prose against the agent's own
  `tools:` line, and a preloaded contract skill counts as that agent's prose. Any
  backticked `Write` added to `cad-verifier-contract` is legal only after task 1
  has landed - which is why task 1 is first and task 4 is not.
- **Scope-boundary judgment (recorded).** CONTEXT puts rung-agent descriptions
  out of this phase and in phase 3. Task 1 corrects exactly one clause pair in
  `agents/cad-verifier.md`'s description anyway, because this plan is what makes
  it false: after it lands, "Read-only; returns structured findings" is a wrong
  claim riding every session's system prompt until phase 3. The boundary's intent
  is that phase 1 does not do BUD-01's byte-cutting work across 48 descriptions,
  and that holds - one description, two clauses, no length target, nothing else
  in `agents/` or `skills/` touched. Shipping a self-contradicting contract is
  the failure `v1.4.1` was a whole milestone about; deferring a correction to a
  falsehood this phase introduces would recreate it.
