# Phase 1: The orchestrator stops holding what its children returned - Context

Gathered: 2026-08-04
Feeds: /cad-plan 1

## Scope boundary

In: the four sites where a child's full output stays resident in a parent
context after the turn it arrived on - executor reports (RES-01), verifier
findings (RES-02), review artifacts (RES-03) - plus the break-even rule that
justifies the pattern (RES-04). Transport only: content is identical, only
where the bytes live and when they load changes. The one deliberate safety
exception is a narrow `Write` grant to `cad-verifier`.

Out: `references/` load-order and eager-include judgments (phase 2); skill and
rung-agent descriptions and the `references/`/`templates/` weight budget
(phase 3); removing or weakening any review, gate, rung or guardrail; the
`assertUnderCap` measurement change RES-03's wording invited (D-11); any
`review.*` config-key addition.

Deferred: None.

Plan shape: multiple plans, same phase - split along the RES-01 / RES-02 /
RES-03+04 seams, each independently executable, sharing one review surface.

## Durable decisions

- D-01 (report path): the executor derives its report path from the plan
  file's OWN directory - `<plandir>/reports/plan-<k>.md`, `plan-1.md` for an
  unsplit `PLAN.md` - so `/cad-execute` writes under `.planning/phases/<N>/`
  and `/cad-task` under `.planning/tasks/<slug>/` with no new prompt field and
  no phase number the executor does not have. Rejected: a path supplied by the
  dispatch prompt, under which `/cad-task` loses its only record unless
  updated in the same pass. Evidence:
  `cadence-core/workflows/task.md` (`planned_path`),
  `skills/cad-executor-contract/SKILL.md` `<report>`,
  `cadence-core/workflows/execute.md:108-129`.
- D-02 (worktree report survives by commit): on the parallel path the executor
  COMMITS its report inside its own worktree, so `git merge` carries it; on the
  sequential path the orchestrator stages it into the phase docs commit. This
  keeps the contract's "stay inside the worktree path" rule intact. Rejected:
  the orchestrator copying reports out between merge and worktree removal (a
  new step 3.5 whose omission silently destroys every parallel report).
  Evidence: `cadence-core/workflows/execute.md:186-196,240-250`,
  `skills/cad-executor-contract/SKILL.md` `<worktree_mode>`.
- D-03 (continuations carry the path, not the bytes): the `partial` and
  `timeout` branches pass the report PATH to the fresh executor; the
  orchestrator may distill only task numbers plus hashes for the `git log`
  confirmation it already performs. Re-inlining the table would return the
  bytes RES-01 moved out, on the highest-cost path. Evidence:
  `cadence-core/references/seams.md` § spawn-agent "Handoff read discipline",
  `cadence-core/workflows/execute.md:134-145`,
  `skills/cad-executor-contract/SKILL.md` `<checkpoints>`.
- D-04 (checkpoints move too): a `risk_surface` or `structural` CHECKPOINT
  writes the same report file with a `CHECKPOINT` status line and returns no
  task table; the continuation reads it exactly like the partial branch. RES-01
  names only `partial`/`timeout`, but a checkpoint on plan 3 of 5 leaves a full
  table resident for the rest of the phase, which is the defect the phase goal
  states. Evidence: `skills/cad-executor-contract/SKILL.md` `<checkpoints>`,
  `cadence-core/workflows/execute.md:157-179`.
- D-05 (findings file name): the verifier's file is JSON in the exact
  `uat merge` payload shape and is NOT named `FINDINGS.json` - the seam already
  owns that name and atomically overwrites it on every successful merge, so the
  merge would destroy the file that fed it. Evidence:
  `cadence-core/bin/planning.mjs:656-689,391-394`,
  `cadence-core/workflows/verify-deep.md:36-45`.
- D-06 (one file carries everything): the per-truth table, `missing` and
  `why_human` ride the same JSON as extra top-level keys; `uat merge` consumes
  only `passes`/`gaps`/`human_checks` and ignores the rest (probe-verified), so
  "exactly one file" holds without losing the phase record. Rejected: a
  markdown report plus a separate payload (two files), and a fenced JSON block
  extracted by hand (the transcription step criterion 3 removes). Evidence:
  `cadence-core/bin/planning.mjs:576-655`,
  `skills/cad-verifier-contract/SKILL.md` `<output>`,
  `cadence-core/workflows/verify-deep.md:26-31`.
- D-07 (`uat merge` refuses by envelope): the seam gains `--payload <file>`
  with named `no-payload` / `bad-payload` refusals (`ok:false`, exit 1), a
  CONTRACTS row in `self-verify.mjs` and sibling tests. Two live holes make
  criterion 4 unprovable otherwise: a literal `null` payload exits 0 printing
  NOTHING, and any parseable non-payload JSON merges as an all-zero `ok:true`
  success - so a truncated findings file reports a clean deep pass instead of
  falling through. Rejected: prose-only handling in `verify-deep.md`, which
  leaves the all-zero-success hole reachable. Evidence:
  `cadence-core/bin/planning.mjs:547-548`, probes
  (`null` -> exit 0 no stdout; `"hello"` -> all-zero `ok:true`), refusal-
  envelope precedent in `.planning/_archive-v2.2.0/3/CONTEXT.md` D-01.
- D-08 (the `Write` grant is prose plus a check): `Write` is allowed on all
  four `cad-verifier` rungs, `Edit`/`MultiEdit` stay in `disallowedTools`, and
  a blocking self-verify check asserts that on every rung. Agent frontmatter
  carries no path-scoped tool grant (settled research below), so without the
  check a later widening ships silently and the milestone's one exception
  becomes unbounded. Evidence: `agents/cad-verifier*.md`,
  `cadence-core/bin/self-verify.mjs` (no `disallowed` reference today),
  `hooks/hooks.json` (only a Bash `PreToolUse` hook).
- D-09 (`risk_surface` gets a file, not refs): its artifact is an UNCOMMITTED
  staged diff produced inside an executor - no ref pair can name it, and in
  worktree mode the orchestrator's tree cannot see it - so the executor writes
  the flagged diff to a file and the checkpoint returns that path. It is the
  one trigger blocking at every stakes level; handing it refs would make it
  pass on an unreviewed surface. Rejected: declaring it out of RES-03 scope and
  letting it keep inlining. Evidence:
  `skills/cad-executor-contract/SKILL.md` `<commit_protocol>`,
  `cadence-core/references/review-triggers.md` wiring table,
  `cadence-core/workflows/execute.md:157-167,186-196`.
- D-10 (the non-string bypass is already closed): both paid commands refuse a
  non-string payload as `bad-payload` BEFORE `assertUnderCap`, with tests. The
  phase VERIFIES this and closes the stale capture item; it does not
  re-implement a live guard or land a second differently-worded gate. Evidence:
  `cadence-core/bin/review-provider.mjs:576-579,593-596,246-254`,
  `cadence-core/bin/review-provider.test.mjs:434-455`, against
  `.planning/CAPTURE.md:179`.
- D-11 (the cap keeps measuring parsed strings): `assertUnderCap` is unchanged.
  Under `--payload <file>` the parsed string fields already ARE the file's
  contents, so RES-03's "measure the file's CONTENTS" clause is recorded
  satisfied. Rejected: raw-byte measurement, which counts JSON escaping and the
  `{instruction, artifact}` envelope - a payload passing today would newly
  refuse `over-cap` at the same `review.max_prompt_tokens`, a behaviour change
  inside a transport-only milestone, and the existing boundary tests
  (`4 * 120000 + 8` chars) straddle it. Evidence:
  `cadence-core/bin/review-provider.mjs:239-254,263-269,533-541`.
- D-12 (break-even rule placement): the rule lands in
  `cadence-core/references/seams.md`'s spawn-agent section, beside "Return
  shape (bounded handoff)" and "Handoff read discipline" - both state WHAT to
  do, neither states WHEN the extra turn pays. Every existing "seams.md,
  bounded handoff" citation then points at the whole rule. Rejected:
  `conventions.md` and a CHANGELOG-only statement, either of which splits the
  rule across two places for phase 2's per-site judgments. Evidence:
  `cadence-core/references/seams.md` § spawn-agent,
  `cadence-core/workflows/context.md:105-108`.

## Decisions

- D-13 (digest fields): the executor's final message carries exactly status,
  task count, commit range, deviation count and open-item count - no task
  table on any terminal branch. Evidence: `.planning/REQUIREMENTS.md` RES-01,
  ROADMAP SC1.
- D-14 (cross-model payload assembly): the payload file is composed by a shell
  step the prose specifies, using the EXISTING `--payload <file>` flag - no new
  seam subcommand or flag, so no CONTRACTS churn on this arm. Evidence:
  `cadence-core/bin/review-provider.mjs:36-52`,
  `cadence-core/bin/self-verify.mjs:150-155`,
  `cadence-core/references/review-triggers.md` steps 2 and 4.
- D-15 (subagent cwd, settled research): a Task-dispatched subagent inherits
  the parent's cwd, so `{base_ref, head_ref}` handed to `claude-subagent` must
  resolve in the ORCHESTRATOR's tree - true for `phase_diff` and `pre_ship`,
  and for a per-plan `diff` review fired after merge. Recorded so it is not
  re-researched; it is also why D-09 exists.
- D-16 (path-scoped grants, settled research): Claude Code agent frontmatter
  exposes no path-scoped tool permission - `tools:`/`disallowedTools` are name
  lists - so "narrow" cannot be host-enforced and D-08's check is the only
  mechanical backstop. Recorded so it is not re-researched.
- D-17 (budgets regenerate in the touching commit): every prose surface this
  phase edits sits EXACTLY at its byte budget (`execute.md` 14805/14805,
  `verify.md` 12753/12753, `verify-deep.md` 2393/2393,
  `cad-executor-contract` 6954/6954, `cad-verifier-contract` 7676/7676, the
  four `cad-verifier` rungs at 548/535/531/523), so `weight-budgets.json`
  regenerates in the same commit as each edit. `references/seams.md` is the
  exception - `references/` carries no budget entry until phase 3. Evidence:
  `cadence-core/bin/weight-budgets.json`,
  `cadence-core/bin/self-verify.mjs:493-518`.
- D-18 (diff gate restored): `review.triggers.diff.gate: "adjudicated"` is
  removed from `.planning/config.json:27`, so `critical`'s `blocking` gate
  applies and `route.mjs resolve` stops emitting the disagreement warning on
  every dispatch. This restores the decision `.planning/CAPTURE.md` already
  records as taken on 2026-08-01; the shipped config had drifted back.
  Evidence: `.planning/config.json:27`, `.planning/CAPTURE.md` (2026-08-01
  entry), live `route.mjs resolve` warning.

## Acceptance criteria

- [ ] AC1: `cad-executor`'s final message carries no task table (status, task
      count, commit range, deviation count, open-item count only), and
      `<plandir>/reports/plan-<k>.md` exists for every plan executed and
      appears in the phase's git history - `git show <commit> --stat` names it,
      including on the worktree path.
- [ ] AC2: Re-running a `PLAN PARTIAL` continuation executes no task the report
      file lists complete - the continuation prompt carries the report PATH,
      and `git log` after the re-run shows no second commit for an
      already-complete task. (human-verify: needs a live cad-executor dispatch)
- [ ] AC3: A `risk_surface` or `structural` checkpoint return carries no task
      table; the report file exists with a `CHECKPOINT` status line, and the
      flagged diff is readable at the path the checkpoint names.
      (human-verify: needs a live cad-executor dispatch)
- [ ] AC4: `cad-verifier` writes exactly one file under
      `.planning/phases/<N>/`, not named `FINDINGS.json`; `Write` appears on
      all four rungs while `Edit` and `MultiEdit` stay in `disallowedTools`,
      with `node cadence-core/bin/self-verify.mjs` failing when either is
      removed; and `grep -n` over `verify-deep.md` finds no hand-transcription
      step.
- [ ] AC5: `planning.mjs uat merge --payload <file>` refuses a missing, empty,
      literal-`null` and wrong-shape payload as `ok:false` with a named reason
      and exit 1 (one test each), and `/cad-verify --deep` on each falls
      through to the walk with the checklist unchanged.
- [ ] AC6: No reviewer receives an inlined diff - the fire sites dispatch
      `claude-subagent` with `{base_ref, head_ref}` and cross-model with
      `--payload <file>`; a non-string artifact returns `bad-payload` before
      the cap is consulted.
- [ ] AC7: `cadence-core/references/seams.md` states the break-even rule (when
      the extra turn pays, and which side extracts), and
      `node --test cadence-core/bin/*.test.mjs` plus
      `node cadence-core/bin/self-verify.mjs` both pass with
      `weight-budgets.json` regenerated in the touching commits.

## Flagged assumptions

- `panel-review` and `cad-land` carrying 2.4x the workhorse commands' context
  (35.7k / 38.4k billed-equiv per turn against a 15k average) is an UNVERIFIED
  hypothesis from the burnrate measurement, not a confirmed defect. RES-03's
  changes are aimed at that signature; if the accumulation is elsewhere in the
  panel dispatch, this phase reduces it less than the measurement suggests.
- Whether a `diff` review fired on the parallel path ever runs before the
  worktree merge is unconfirmed. If it does, D-15's cwd rule makes its refs
  unresolvable and that fire site needs D-09's file transport too.
