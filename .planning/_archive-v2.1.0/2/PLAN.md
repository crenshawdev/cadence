---
phase: 2
plan: 1
requirements:
  - TRI-02
  - REV-03
files:
  - cadence-core/references/review-triggers.md
  - cadence-core/references/seams.md
  - cadence-core/references/config-reach.md
  - cadence-core/workflows/plan.md
  - cadence-core/workflows/verify.md
  - cadence-core/workflows/execute.md
  - cadence-core/workflows/decision-review.md
  - cadence-core/workflows/config.md
  - skills/cad-land/SKILL.md
  - skills/cad-reviewer-contract/SKILL.md
  - cadence-core/bin/lib/dispatch-phrasing.mjs
  - cadence-core/bin/dispatch-phrasing.test.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/review-provider.mjs
  - cadence-core/bin/review-provider.test.mjs
  - cadence-core/config.schema.json
  - cadence-core/bin/weight-budgets.json
  - METHOD.md
  - README.md
---

# Phase 2: Findings are a list, not a work order - Plan

## Goal

An adjudicated review stops handing its survivors back as a work order. The
survivors become a numbered list the user triages, defaulting to NONE, at every
adjudicated firing site; the reviewer stops suppressing findings before the
adjudicator can see them; and the reviewer set is dispatched as one bounded
batch rather than a hedged loop.

## Must be true when done

- Finishing an adjudicated review at any of the four live sites - `/cad-land`'s
  publish decision, `/cad-verify`'s fire()-produced fix list, `/cad-plan`'s
  plan-review application, `/cad-execute`'s `diff` site - shows a numbered
  survivor list and ends the turn on "which of these should I act on?", with
  NONE first, and no prose anywhere applies, commits, or publishes against a
  survivor the user did not pick. The two sites whose prose today acts
  unconditionally (`plan.md`'s "apply the surviving, grounded findings to the
  plan file(s) directly" and `verify.md`'s fix list flowing into "Apply now")
  no longer read that way.
- The one documented unattended path still runs unattended: under
  `git.auto_close: true` `/cad-land` states that the triage gate does not
  prompt, triage is NONE by construction, and the only halt is
  `land-cleanup.mjs gate`'s existing blocker/high halt.
- `skills/cad-reviewer-contract/SKILL.md` contains no clause telling a reviewer
  to withhold low-severity or style findings, still contains "No severity
  inflation", and `skills/cad-plan-checker-contract/SKILL.md` plus every
  `agents/cad-reviewer*.md` rung file are byte-identical to their HEAD state.
- `references/review-triggers.md` step 4 issues the whole reviewer set in ONE
  message, with no "for each", no "in parallel where the host allows", and a
  citation of `seams.md` Concurrent dispatch; step 3 states that one route
  resolve serves the set; and no surface anywhere in the repo still quotes the
  removed phrase.
- `node cadence-core/bin/self-verify.mjs` names a problem when a file under
  `cadence-core/workflows/` or `cadence-core/references/` states a concurrent
  multi-dispatch without the one-message phrasing - proven by a fixture that
  trips it and a fixture that does not - and names none on this repo.
- A `review` or `consult` payload over `review.max_prompt_tokens` estimated
  tokens returns `{ok:false, reason:"over-cap"}` with no HTTPS request issued,
  the key resolves through `config.mjs get` at its default, and the
  `claude-subagent` arm's exemption is written down rather than implied.
- `node --test cadence-core/bin/*.test.mjs`, `npx tsc -p tsconfig.ci.json` and
  `node cadence-core/bin/self-verify.mjs` are all green with no
  `budget-overrun`, and METHOD.md and README.md describe adjudication ending at
  a triage gate rather than at the verdict.

## Context

Locked decisions bind this plan: D-01 (the gate authored ONCE as the
`adjudicated` consequence, four sites pointing at it), D-02 (open-ended ask, not
`AskUserQuestion`), D-03 (NONE first, and the gate is NOT added to `seams.md`'s
no-default list), D-04 (`git.auto_close` carve-out), D-05 (only the padding half
of the reviewer contract's line 67 goes), D-06 (a self-verify phrasing check),
D-07/D-08/D-09 (the cap bounds `review` AND `consult`, in `chars/4` estimated
tokens, refusing before any request), D-10 (`/cad-plan` and `/cad-verify` carry
the text or an explicit re-read), D-11 (the gated `/cad-verify` site is the
fire() fix list, not the existing per-item ask), D-12 (neighbouring reviewer
filters stay), D-13 (no rung file changes), D-14 (METHOD and README move),
D-15/D-16 (the batch rewrite moves two files; one route resolve),
D-17/D-18/D-19 (lazy memoized key read, no new CLI flag, four config surfaces,
no template row), D-20 (budgets regenerated), D-21 (`review-triggers.md` is
preloaded into two skills on every run, so gate text is paid for per invocation
- the file ends this phase at or under 12900 bytes, from 11982 at HEAD), D-22
(the baseline is green: `problems: []`, verified at planning time).

Out of scope, deliberately: `review.mode`, `review.triggers.*.gate` and the
reviewer-set config; #88's AC4 (fire() returning a resolved dispatch manifest);
the advisory-gate cost heuristic; the `claude-subagent` arm's own payload bound;
`skills/cad-plan-review/SKILL.md` (its step 3 already presents survivors and
refuses to auto-apply, and it preloads `review-triggers.md`, so it inherits the
gate unedited); `skills/cad-plan-checker-contract/SKILL.md` (D-05 leaves it
byte-unchanged, including its own `<stance>` pad clause at `:37` - it is a
different role and TRI-02 names the reviewer contract only).

## Tasks

### Task 1: Author the triage gate once, as the `adjudicated` consequence

- **Files:** cadence-core/references/review-triggers.md
- **Action:** Replace the `adjudicated` bullet of `## 6. Consequence (gate)`
  (`:136-142`), whose current text - "hand the survivor list back to the firing
  workflow to act on: `cad-plan` applies them to the plan file(s), `cad-land`
  factors them into the publish decision" - is the work-order reading this phase
  exists to remove. The replacement states, in this order: the survivors are
  already grounded, so what remains is the USER's choice, not the model's;
  present them as a NUMBERED list, one line per survivor carrying its severity,
  `file:line` and `claim`; then ask which to act on and END THE TURN on that
  question (ask-user seam, OPEN-ENDED prose - a survivor set is N items answered
  with a subset, which `AskUserQuestion`'s 2-4 mutually exclusive options cannot
  express, and the originating incident had five survivors); label NONE as the
  first option and the default, so "act on nothing" needs no argument from the
  user; and state that nothing is applied, committed, published or re-planned
  against a survivor the user did not name. Add the zero-survivor case in one
  clause: say the review ran and nothing survived adjudication, never a bare "no
  findings", which reads identically to a review that never ran. Add ONE
  sentence for the unattended arm (D-04): under `git.auto_close: true` the gate
  does not prompt - the unattended close's triage is NONE by construction, and
  `land-cleanup.mjs gate`'s blocker/high halt is its only consequence. KEEP the
  three existing clauses that still hold: it does not auto-halt like `blocking`,
  it is not the auto-replan convergence loop cut in DESIGN §6, and it is for the
  deep, rare gates. Then rewrite `:144-145` ("`cad-verify` routes fix requests
  through fire() (as a review that produces the fix list)") to say that fix list
  reaches the same gate before any of it is proposed as a change (D-11). Do NOT
  add this gate to `references/seams.md`'s "Deliberate no-default decisions"
  list (D-03): TRI-02 states the default explicitly, so the nudge here is the
  requirement, and the two lists must not be conflated. Do NOT restate the gate
  at the firing sites - tasks 2 and 3 point at THIS text, because three
  near-duplicate paragraphs drift exactly the way `workflows/verify.md:84-86`
  drifted from the legacy rule in phase 1. Byte discipline (D-21): this file is
  `@`-preloaded into `/cad-land` and `/cad-plan-review` on every invocation, so
  budget the replacement in BYTES, not lines - the bullet being replaced is 495
  bytes, and the replacement must land at most 1000, leaving the `:144-145`
  rewrite (~+40) inside this task's 12550 ceiling. That ceiling is this task's
  share of the phase-end 12900 (D-21), split explicitly so no two constraints
  can disagree: task 1 at most 12550, task 5 at most 12750, task 8 at most
  12900. Write no example dialogue.
- **Verify:** `grep -n "hand the survivor list back"
  cadence-core/references/review-triggers.md` returns nothing; `grep -n "NONE"
  cadence-core/references/review-triggers.md` shows the default in the
  `adjudicated` bullet; `grep -n "no-default" cadence-core/references/seams.md`
  shows the triage gate is NOT among that file's "Deliberate no-default
  decisions" entries (scoped this way rather than asserting `seams.md` is absent
  from `git diff --name-only`, which task 8(4) makes false when it adds
  `over-cap` to the same file);
  `wc -c cadence-core/references/review-triggers.md` reports at most 12550; and
  `node cadence-core/bin/self-verify.mjs` reports `ok:true`.

### Task 2: `/cad-land` triages before it asks how to publish

- **Files:** skills/cad-land/SKILL.md, cadence-core/bin/weight-budgets.json
- **Action:** In `<process>` step 3, after "Report the outcome", add the triage
  step: when the resolved gate is `adjudicated`, run the triage gate as
  `references/review-triggers.md` § 6 Consequence defines it (this skill already
  `@`-preloads that file at `:20`, so point at it - do not copy the text), act
  ONLY on the survivors the user names, as atomic conventional commits per
  `references/git.md`, and re-fire `pre_ship` ONCE after fixes land rather than
  publishing over a changed tree - bound it in the prose: at most one re-fire per
  `/cad-land` invocation, and its survivors are reported rather than triaged
  again. Without that bound the sentence installs the review->revise->review
  convergence loop that task 1 keeps `review-triggers.md:139-142` forbidding
  verbatim and that `METHOD.md:422-424` records as a deliberate cut, at the most
  expensive gate in the system. State the D-03 consequence explicitly and in
  the skill's own voice, because this is the one place two asks collide: the
  triage ask carries a default (NONE) and the publish ask at step 4a carries
  none, so name which is which at the moment they run - a user who reads the
  first as a plain confirm will read the second as one too, and the whole point
  of `/cad-land` is that the publish mechanism is never preselected. Extend the
  existing `git.auto_close` sentence in the same step with the carve-out (D-04,
  AC2): under `git.auto_close: true` the triage gate does not prompt at all, the
  unattended close's triage is NONE by construction, and the hard halt stays
  exactly what it already is - `land-cleanup.mjs gate` on a surviving
  blocker/high. Without that carve-out the one documented unattended close
  blocks forever on a prompt, breaking the GIT-03 capability shipped in
  v1.1.0-rc.2. Add one `<guardrails>` line: no survivor is acted on that the
  user did not pick, and the unattended arm acts on none. Keep the additions
  tight - replace and extend sentences rather than appending paragraphs - then
  regenerate this file's entry in `cadence-core/bin/weight-budgets.json` from
  `node cadence-core/bin/weight.mjs`; it sits at exactly its budget (7898/7898)
  at HEAD, so any growth is a `budget-overrun` until the manifest is updated in
  the same commit (D-20, phase 1's `380c4c6` precedent).
- **Verify:** every check below must FAIL on unmodified HEAD - the obvious
  phrasings (`grep -n "auto_close"`, `grep -n "review-triggers.md"`,
  `grep -c "numbered"` at most 1, self-verify green) all pass at HEAD already,
  so they would certify this task done with the file untouched. Assert the NEW
  content instead: `grep -n "NONE" skills/cad-land/SKILL.md` returns the triage
  line in `<process>` step 3 and the `<guardrails>` line (0 hits at HEAD);
  `grep -n -A3 "auto_close" skills/cad-land/SKILL.md` shows the no-prompt
  carve-out ("triage is NONE by construction") in step 3, which no existing
  `auto_close` sentence carries; `grep -n "§ 6 Consequence" skills/cad-land/SKILL.md`
  shows step 3 pointing at the gate rather than restating it (0 hits at HEAD),
  and `grep -c "numbered" skills/cad-land/SKILL.md` still returns at most 1 so
  the pointer did not become a copy; and `node cadence-core/bin/self-verify.mjs`
  reports `ok:true` with no `budget-overrun`.

### Task 3: The three workflow sites reach the gate, with the re-read D-10 requires

- **Files:** cadence-core/workflows/plan.md, cadence-core/workflows/verify.md,
  cadence-core/workflows/execute.md, cadence-core/bin/weight-budgets.json
- **Action:** None of these three workflows `@`-preloads
  `references/review-triggers.md` (their skills preload the workflow file
  instead), so each gets an explicit RE-READ instruction plus the one-line rule,
  never the full gate text (D-10 + D-01). The shared one-liner, worded to fit
  each site: the survivors are a numbered list the user triages, NONE is the
  default, and only what the user names is acted on - full gate at
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/review-triggers.md` § 6
  Consequence, read it before presenting. (a) `plan.md`'s `<step name="review">`
  (`:222-230`): replace "adjudicated -> apply the surviving, grounded findings
  to the plan file(s) directly" with the triage step - present, ask, then apply
  ONLY the picked findings to the plan file(s), and leave the rest recorded in
  the step's report; the advisory and blocking arms are unchanged. Add to
  `<success_criteria>` that the trigger's survivors were triaged rather than
  applied wholesale. (b) `verify.md`'s `<step name="route_failures">`
  (`:175-198`): the gated site is the fix LIST a fire() call returns at step 1's
  "If a diagnosis deserves a second opinion, use the review-trigger interface" -
  NOT the existing per-item apply / re-plan / leave ask at step 2, which already
  triages a UAT item correctly and must be left as it is (D-11). State that an
  adjudicated fire() return is triaged BEFORE anything from it becomes a
  proposed fix, so an unpicked finding never reaches step 3's "Apply now - make
  the change as an atomic conventional commit". (c) `execute.md`: at the
  `execute_sequential` diff fire (`:146-148`), at `execute_parallel` step 5, and
  at `execute_parallel` step 6 - the `phase_diff` fire, which the wiring table at
  `references/review-triggers.md:156` gates `adjudicated` at critical and which
  D-01 counted as one of the four sites - say that the default `advisory` gate
  reports and continues exactly as today, and that when the resolved gate is
  `adjudicated` - which `review.triggers.diff.gate` can set, and this repo's own
  config does - the survivors go through the same triage gate before any of them
  is acted on. Missing step 6 would leave a live adjudicated firing site with no
  statement of the rule in the only file `/cad-execute` preloads. Do not
  touch the `risk_surface` blocking arm anywhere: a matched risk surface halts,
  and triage is not an override for it. Then regenerate the
  `weight-budgets.json` entries for all three files from `node
  cadence-core/bin/weight.mjs` - each sits at exactly its budget at HEAD
  (plan.md 14328, verify.md 12106, execute.md 13884).
- **Verify:** `node cadence-core/bin/self-verify.mjs` reports `ok:true` with no
  `budget-overrun` and no `unknown-config-key`; `grep -n "adjudicated -> apply"
  cadence-core/workflows/plan.md` returns nothing (use THIS phrasing, not "apply
  the surviving" - the sentence is line-wrapped across `plan.md:226-227` and the
  longer string is never contiguous, so it exits 1 on unmodified HEAD and proves
  nothing); `grep -n "NONE"
  cadence-core/workflows/plan.md cadence-core/workflows/verify.md
  cadence-core/workflows/execute.md` returns the triage one-liner in EACH of the
  three (a bare `grep -c "review-triggers.md"` proves nothing here - all three
  files already cite that path at HEAD); `grep -n -A2 "review-triggers.md"` on
  the same three shows the explicit re-read instruction naming `§ 6 Consequence`
  at each edited site; `grep -n "phase_diff" cadence-core/workflows/execute.md`
  shows step 6 carrying the rule alongside step 5; and `grep -n "Apply the fix
  now" cadence-core/workflows/verify.md` still shows the per-item ask at
  `route_failures` step 2 intact.

### Task 4: Delete the reviewer contract's anti-padding clause, keep the anti-inflation half

- **Files:** skills/cad-reviewer-contract/SKILL.md
- **Action:** In `<guardrails>`, line 67 reads "- No severity inflation; no
  padding with style nits that do not change behavior." Delete ONLY the padding
  half; the line becomes "- No severity inflation." with the first clause
  byte-identical. #66 is explicit that severity accuracy is load-bearing and
  must not be lost with it: the blocking gate keys off the blocker/high
  threshold, so a reviewer that inflates severity can hard-stop a phase on a
  nit. The padding half is the one filter that cannot read the surrounding code
  - the reviewer decides a finding is a style nit without knowing what the
  adjudicator, who CAN open the file, would have made of it - so it suppresses
  before the only step qualified to judge. Do NOT add a positive "report
  everything" instruction in its place: `<stance>` already requires a genuine
  falsification attempt and `<returns>` already accepts an empty `findings: []`,
  so a new instruction would be a third statement of the same rule. Leave every
  neighbouring filter alone (D-12): `<what_to_look_for>`'s "Approach differences
  are NOT findings" is documented as deliberate in `METHOD.md:324-326`, and
  `<stance>`'s "Do not inflate severity to seem thorough, and do not soften a
  real blocker to seem agreeable" is the same anti-inflation guardrail in its
  other spelling. Touch NO file under `agents/` (D-13): the contract is
  single-sourced through the preloaded skill, so deleting the clause here
  deletes it in all four rungs, and a rung file carrying behaviour already fails
  self-verify check 7. Leave `skills/cad-plan-checker-contract/SKILL.md`
  byte-unchanged (D-05), including its own `<stance>` "do not pad the report
  with style nits" at `:37` - it is a different role, TRI-02 names the reviewer
  contract, and #66 lists the checker only so the pass covers both files. Say in
  the commit message that keeping "No severity inflation" is deliberate, so the
  divergence from a whole-line deletion reads as a decision rather than a
  half-done edit. No `weight-budgets.json` change: the file shrinks, and
  under-budget is fine (D-20).
- **Verify:** `grep -n "No severity inflation"
  skills/cad-reviewer-contract/SKILL.md` returns the line; `grep -n "padding"
  skills/cad-reviewer-contract/SKILL.md` returns nothing; `git diff --name-only`
  lists neither `skills/cad-plan-checker-contract/SKILL.md` nor any
  `agents/cad-reviewer*.md`; and `node cadence-core/bin/self-verify.mjs` reports
  `ok:true`.

### Task 5: One batch, no hedge - the concurrent-dispatch prose in three files

- **Files:** cadence-core/references/review-triggers.md,
  cadence-core/workflows/decision-review.md, cadence-core/workflows/execute.md,
  cadence-core/bin/weight-budgets.json
- **Action:** (a) `review-triggers.md:68` currently reads "For each reviewer in
  the set, in parallel where the host allows:" - a loop shape with a
  host-capability hedge, which produces the serial behaviour it means to forbid
  (#88). Replace it with an imperative batch instruction: issue every reviewer
  in the resolved set in ONE message, citing `seams.md` Concurrent dispatch, and
  say that serialization is correct only when one dispatch consumes another's
  output, which no reviewer in a set ever does. The two backend bullets below it
  stay as the per-backend HOW, so the new sentence must still introduce them.
  Remove the hedge entirely - "where the host allows" makes a rule optional, and
  a rule the model may decline is a suggestion. (b) In step 3 (`:53-65`), add
  one sentence (D-16, #88 AC2): the step-1 bundle resolve serves the WHOLE set -
  resolve the route once per (role, attempt) and reuse that one resolve for
  every dispatch in the batch, because the payloads differ and the routing does
  not (`seams.md:122` already requires this and step 4 never said it). Write it
  WITHOUT the phrase "per reviewer": task 6's detector treats that as a
  loop-shaped distribution head, and this sentence sits in a block whose subject
  is the concurrent batch, so the natural phrasing would make the new check fire
  on the very file it was written for. The Notes' two-hit prototype ran against
  HEAD, not against this text. (c)
  `workflows/decision-review.md:66-70` quotes the removed phrase verbatim
  ("review-triggers.md's \"in parallel where the host allows\"") - repoint it at
  step 4's one-message batch in the SAME change (D-15). Otherwise
  `decision-review.md` cites a sentence that no longer exists in the file it
  names, and no self-verify check detects that: check 1 reads config tokens,
  check 2 invocations, check 3 paths - none of them quoted prose. (d)
  `workflows/execute.md`'s `execute_parallel` item 1 (`:178-185`) instructs "one
  dispatch per message, in the background" while citing `seams.md concurrent
  dispatch` in the same breath - and `seams.md:163-166` names "the per-plan
  executors of a parallel phase" as its own first example of dispatches that
  fire concurrently in ONE message. The two surfaces disagree about the same
  batch; state the one-message batch here and drop the per-message/background
  wording, keeping everything else in the item (the worktree branch, the
  isolation note, the single reuse of the route resolve). This is the same
  defect species as (a) and task 6's check makes it mechanical, which is why it
  moves now rather than being exempted by a narrower pattern - fitting the check
  around a live counterexample would be fitting it to the bug. Then regenerate
  the `weight-budgets.json` entries for `decision-review.md` (9741 at HEAD) and
  `execute.md` from `node cadence-core/bin/weight.mjs`.
- **Verify:** `grep -rn "where the host allows" cadence-core/ skills/ agents/`
  returns nothing; `grep -n "ONE message"
  cadence-core/references/review-triggers.md cadence-core/workflows/execute.md`
  shows the batch instruction in both; `wc -c
  cadence-core/references/review-triggers.md` reports at most 12750; and `node
  cadence-core/bin/self-verify.mjs` reports `ok:true` with no `budget-overrun`.

### Task 6: self-verify fails a concurrent multi-dispatch that does not say ONE message

- **Files:** cadence-core/bin/lib/dispatch-phrasing.mjs,
  cadence-core/bin/dispatch-phrasing.test.mjs,
  cadence-core/bin/self-verify.mjs, cadence-core/bin/self-verify.test.mjs,
  METHOD.md
- **Action:** Without this check, SC3 is UAT-walk-only and the loop-shaped
  restatement returns on the next edit (D-06, #88 AC3). Write a new pure lib
  `cadence-core/bin/lib/dispatch-phrasing.mjs` in the shape of its siblings
  `lib/config-reach.mjs` and `lib/route-cells.mjs` - `// @ts-check`, JSDoc on
  every export, no fs, no emit, no process, no Date - exporting
  `dispatchPhrasingIssues(text)` which returns `{code, detail}[]`, always
  `code: 'unbatched-dispatch'`, with `detail` naming the 1-based line the
  offending block starts at plus its first ~100 normalized characters, so the
  message points at the sentence to rewrite. The rule, stated in the module's
  doc comment as the check's contract:
  MASK first - triple-backtick fenced blocks and inline backtick spans are
  replaced with spaces (preserving line count), because a config key like
  `parallelization.max_concurrent_agents` and a shell command are code, not an
  instruction, and reading them as prose is what makes a heuristic like this
  false-positive.
  BLOCK next - a new block starts at a blank line, an ATX heading, or a line
  whose first non-space characters are a list marker (`-`, `*`, `+`, or `N.`),
  so one list item's phrasing never excuses its neighbour's; each block is
  whitespace-collapsed to one line before matching, so a sentence wrapped across
  source lines still reads as one.
  FLAG last - a block is a problem when it carries a concurrency claim
  (`in parallel`, `parallel`, `concurrent`, `concurrently`, `simultaneously`)
  AND either a loop-shaped distribution head (`for each`, `for every`, `one at a
  time`, `one by one`, `per reviewer`, `in turn`) or a host-capability hedge
  (`where the host allows`, and the `if`/`when`/`where the host
  allows|supports|permits` family) AND does NOT carry the mandated phrasing
  (`in one message` or `in one batch`, matched case-insensitively so `in ONE
  message` counts). All matching is case-insensitive and word-bounded.
  Record WHY the domain is the concurrency claim rather than every dispatch
  instruction: prose that describes dispatch without issuing it ("parallel
  dispatch without isolation is not supported") and prose that serializes on
  purpose ("For each plan in order: dispatch ONE cad-executor ... and wait")
  must stay legal, and neither claims concurrency for a set. Record the accepted
  cost too: this is a heuristic over prose and can false-positive on a
  legitimate sentence, and the fix then is to narrow the pattern here, never to
  bend a correct surface around it. In `self-verify.mjs`: import
  `dispatchPhrasingIssues` and `sep` from `node:path`, and inside the existing
  `mdFiles` loop - after the text read succeeds, so an unreadable file is still
  reported once by the read-guard - run it only when `rel` starts with
  `join('cadence-core','workflows') + sep` or `join('cadence-core','references')
  + sep`, pushing `{kind: 'unbatched-dispatch', file: rel, detail}` per issue.
  Scope it to those two directories on purpose (D-06): `references/` is outside
  `lib/surface-weight.mjs`'s weighed walk, so no existing check reaches it at
  all, and skills/agents/templates carry no dispatch instructions of their own.
  Add the check as `10. dispatch phrasing` in the numbered header comment and
  add `dispatch-phrasing` to the `checked` string in the `emit(...)` call. Add
  ONE sentence to METHOD.md's "The tool checks its own prose" section
  (`:544-558`) naming the new check, so the doc states the checks that exist. Do
  NOT write a new `references/` grammar doc for this: it is a heuristic over
  prose rather than a grammar for a file this repo writes, and its two closest
  siblings (`agent-behaviour`, `rung-effort`) are documented in the lib and the
  self-verify header exactly this way. In
  `cadence-core/bin/dispatch-phrasing.test.mjs`, one `test()` per row, each
  title naming its arm: the exact HEAD sentence "For each reviewer in the set,
  in parallel where the host allows:" yields one issue whose detail carries the
  line number; the batch-shaped rewrite yields none; a hedge with no loop
  ("dispatch the set concurrently if the host supports it") yields one; a
  concurrency word appearing ONLY inside backticks or a fenced block yields
  none; "For each plan in order: dispatch ONE cad-executor ... and wait for it
  to finish" yields none (no concurrency claim); a compliant list item followed
  by a non-compliant one yields exactly one issue, naming the second (the block
  boundary); `in one batch` satisfies the phrasing as well as `in ONE message`;
  and a non-string input returns `[]` rather than throwing. In
  `self-verify.test.mjs`, three rows using the existing helpers: the
  loop-shaped sentence written to `cadence-core/workflows/x.md` via `fixture()`
  produces an `unbatched-dispatch` problem; the batch-shaped rewrite produces
  none; and the SAME loop-shaped sentence written to a skill under
  `skills/<name>/SKILL.md` via `fixtureWith({skills})` produces none, which is
  what pins the directory scope. Keep every fixture free of dotted config-shaped
  tokens so no row also trips check 1.
- **Verify:** `node --test cadence-core/bin/dispatch-phrasing.test.mjs
  cadence-core/bin/self-verify.test.mjs` exits 0 with 0 fail and names all eight
  lib arms plus the three self-verify rows; `node cadence-core/bin/self-verify.mjs`
  reports `ok:true` with `problems: []` on this repo and its `checked` string
  contains `dispatch-phrasing`; and the lib flags the removed sentence directly,
  without mutating any tracked file - `node -e "import('./cadence-core/bin/lib/
  dispatch-phrasing.mjs').then(m => console.log(JSON.stringify(m.dispatchPhrasingIssues
  ('For each reviewer in the set, in parallel where the host allows:'))))"`
  prints one `unbatched-dispatch` entry, and the same call on the shipped
  replacement sentence prints `[]`.

### Task 7: The seam refuses an over-cap payload on both paid commands

- **Files:** cadence-core/bin/review-provider.mjs,
  cadence-core/bin/review-provider.test.mjs
- **Action:** Bound the two paid commands and only those (D-07): `cmdReview` and
  `cmdConsult` both hit the same provider over the same HTTPS path, so bounding
  one leaves the identical defect one function away for the next sweep to refile
  (#16). The free `claude-subagent` arm never runs this script and stays
  exempt; say that in the comment rather than leaving it implied. Add
  `DEFAULT_MAX_PROMPT_TOKENS = 120000` beside the timeout constants, with the
  reason: of the three shipped providers DeepSeek's context window is the
  tightest at ~128k, so the default sits just under the smallest one a
  configured payload could be sent to, and `chars/4` is an estimate rather than
  a tokenizer, which is why the margin is deliberate. Export a pure
  `resolveMaxPromptTokens(configured)` mirroring `resolveTimeoutMs`: anything
  unusable - absent, non-numeric, non-integer, zero, negative - falls back to
  the default rather than throwing, the same degrade-never-crash contract as the
  rest of this seam. Unlike the timeout it is NOT clamped from above: there is
  no host ceiling to overflow here, and a user who raises the cap has made that
  call in writing. Add a lazily memoized `maxPromptTokens()` beside
  `requestTimeoutMs()`, reading `review.max_prompt_tokens` from
  `mergeLayers('.planning/config.json')` inside a try, one read per process
  (D-17) - a module-level read would do config I/O inside the unit tests, which
  import the pure helpers directly. Take NO new CLI flag, so
  `CONTRACTS['review-provider.mjs']` in `self-verify.mjs` is unchanged and phase
  1's D-14 obligation does not fire. Export
  `estimatePromptTokens(...parts)` = `measure(parts.filter(p => typeof p ===
  'string').join('')).estTokens`, importing `measure` from
  `./lib/surface-weight.mjs` - the repo's existing deterministic `chars/4`
  proxy, reused rather than reimplemented (D-08), since zero runtime deps
  forbids a real tokenizer and both #16 and REV-03 say "token cap". In
  `cmdReview`, after the `{instruction, artifact}` shape check and BEFORE
  `callStructured`, compute `estimatePromptTokens(payload.instruction,
  payload.artifact)` and, when it exceeds `maxPromptTokens()`, `fail('over-cap',
  ...)` with a detail naming the estimate, the cap, and the config key. Do the
  same in `cmdConsult` over `payload.situation`. The refusal happens BEFORE any
  request is issued (D-09) and is neither a truncation nor a warning: truncating
  still pays the provider and returns findings on a fragment while reporting as
  though it saw the whole artifact, which is worse than the unbounded bill, and
  warning-and-sending changes no outcome at all - the additive shape phase 1's
  D-02 rejected when it reversed additive `unseeded`. It needs no new caller
  machinery: `review-triggers.md:108-115` already defines handling for any
  `ok:false` (name the reason, drop the reviewer, fall back to
  `claude-subagent` if the set empties). Do not measure the adapters'
  schema-injection bytes: they are a small fixed per-provider constant, and
  counting them would make one payload cap differently per provider - say so in
  the comment so the number stays reproducible from the payload alone. Extend
  the file-header "Design contract" comment with the cap and its refusal. In
  `review-provider.test.mjs`: unit rows for `resolveMaxPromptTokens` mirroring
  the `resolveTimeoutMs` rows (a usable value wins; `undefined`, `null`, `0`,
  `-1`, `1.5`, `NaN`, `Infinity`, `'3000'`, `{}`, `[3000]` all fall back; a huge
  value is NOT clamped); unit rows for `estimatePromptTokens` (ceil of
  `chars/4`, a non-string part ignored, no part at all is 0, and the boundary -
  exactly at the cap is not over, one character past it is); and CLI rows using
  the existing key-file pattern (`writeFileSync(join(dir,'providers.env'),
  'OPENAI_API_KEY="from-file"\n')` plus `--key-file`) that feed an artifact of
  `'x'.repeat(4 * 120000 + 8)` on stdin to `review` and a `situation` of the
  same size to `consult`, each asserting `ok:false`, `reason: 'over-cap'`, and a
  `detail` naming the key. Note in a comment that those two rows also prove no
  request was issued: a payload that got past the cap with a bogus key would
  come back `http` 401, and the suite forbids network.
- **Verify:** `node --test cadence-core/bin/review-provider.test.mjs` exits 0
  with 0 fail and names the over-cap rows for both `review` and `consult`;
  `npx tsc -p tsconfig.ci.json` exits 0; and a live end-to-end refusal, run from
  a scratch dir so no repo file changes - write `OPENAI_API_KEY=k` to
  `$D/k.env` where `D="$(mktemp -d)"` - do NOT use `$TMPDIR`, which is unset in
  this environment and resolves the path to an unwritable `/k.env`, so
  `resolveProvider` (`review-provider.mjs:502`, which runs BEFORE the shape check
  at `:505` and therefore before the cap check) exits `no-key` at `:478` and the
  command can never print `over-cap` even against a correct implementation - then
  `node -e 'process.stdout.write(JSON.stringify({instruction:"x",
  artifact:"x".repeat(480008)}))' | node cadence-core/bin/review-provider.mjs
  review --provider openai --model m --key-file "$D/k.env"` prints
  `{"ok":false,"reason":"over-cap",...}` and returns in well under a second,
  which is itself the no-request proof - a payload that reached the transport
  would sit on a network round trip and come back `http` or `transport`. Do not
  run the under-cap twin of that command as a check: it would issue a real
  provider request with a bogus key and can block for
  `review.request_timeout_ms`; the cap's non-firing side is pinned by the
  `estimatePromptTokens` boundary rows instead.

### Task 8: `review.max_prompt_tokens` on all four surfaces CI requires

- **Files:** cadence-core/config.schema.json,
  cadence-core/references/config-reach.md, cadence-core/workflows/config.md,
  cadence-core/references/seams.md, cadence-core/references/review-triggers.md,
  cadence-core/bin/weight-budgets.json
- **Action:** Adding a key without all four surfaces turns CI red in three
  different ways (D-18), so they land together. (1) `config.schema.json`: insert
  `"review.max_prompt_tokens"` immediately after `"review.request_timeout_ms"`
  (`:57`), as `{ "type": "int", "min": 1, "default": 120000, "purpose": ... }`
  with no `src` (it is settable from either layer, exactly like the timeout
  beside it) and aligned with the surrounding column style. The `purpose` MUST
  contain the reach phrase `cross-model provider calls only` VERBATIM, or check
  9 reports `unstated-reach`: it is what a user setting the value reads, and the
  reach is genuinely narrow because the free `claude-subagent` reviewer never
  goes through this script. Write the purpose to say all of it: the estimated-
  token ceiling (`chars/4`) on a `review` or `consult` payload, that an over-cap
  payload is refused with `ok:false, reason over-cap` before any request, and
  that it is cross-model provider calls only. (2) `references/config-reach.md`:
  add the row after `review.request_timeout_ms`'s (`:124`), Reach cell exactly
  `cross-model provider calls only` (the cell is compared backticks-stripped and
  whitespace-collapsed against the purpose, so the two must agree word for
  word), Honoured by naming `bin/review-provider.mjs` and both commands. (3)
  `workflows/config.md`: add the catalog row in the **Review** block after
  `review.request_timeout_ms` (`:113`), five columns matching the block's shape
  - Key, `int`, the purpose-as-question, `Value → Explanation` (e.g. `120000`;
  over-cap is refused before any request, cross-model only), Default `120000`.
  Note that the reach doc is EXCLUDED from `seenTokens`, so this catalog row is
  what keeps check 1b from reporting `inert-config-key`. While in this file,
  repair the `review.triggers.<t>.gate` row five lines below (`:118`), whose
  `adjudicated` cell still reads `ground then hand off` - the exact work-order
  framing task 1 removes from `references/review-triggers.md` § 6. Replace that
  cell with `ground, then present the survivors and ask which to act on (default
  none)`. Nothing else in the row changes. This is the same drift species D-15
  fixes for `decision-review.md`, and no self-verify check detects it: the checks
  read config tokens, invocations and paths, never prose semantics - so a task
  already editing this file is the only place it gets caught. (4)
  `references/seams.md`: add `over-cap` to the call-review-provider degradation
  vocabulary at `:219-223` beside the other call-shape reasons, and one line in
  the same binding stating the cap, its units, and the `claude-subagent`
  exemption (D-07). (5) `references/review-triggers.md`: ONE sentence in step
  4's cross-model bullet - an over-cap payload comes back `ok:false` with
  `reason: over-cap` and is handled by the `ok:false` rule already there
  (name the reason, drop the reviewer, fall back if the set empties). Keep it to
  one sentence; this file is preloaded twice per run (D-21). Do NOT add the key
  to `cadence-core/templates/config.json` (D-19): it carries no
  `request_timeout_ms` either, and nothing cross-checks the template against the
  schema. Then regenerate `config.md`'s `weight-budgets.json` entry (17878 at
  HEAD, at budget) from `node cadence-core/bin/weight.mjs`.
- **Verify:** `node cadence-core/bin/config.mjs get review.max_prompt_tokens`
  prints `{"ok":true,"values":{"review.max_prompt_tokens":120000},...}`;
  `node cadence-core/bin/config.mjs validate` exits 0; `node
  cadence-core/bin/self-verify.mjs` reports `ok:true` with `problems: []` - no
  `missing-reach-row`, no `unstated-reach`, no `inert-config-key`, no
  `unknown-config-key`, no `budget-overrun`; and `wc -c
  cadence-core/references/review-triggers.md` reports at most 12900.

### Task 9: The public account of adjudication ends at the gate

- **Files:** METHOD.md, README.md, skills/cad-plan-review/SKILL.md
- **Action:** Both docs currently end adjudication at the verdict, which is the
  claim this phase makes false (D-14); `/cad-docs-verify` catches drift, not
  omissions, so the update is an execution task rather than a later sweep
  (project memory, `.planning/phases/1/CONTEXT.md` D-13). In METHOD.md's
  "Adjudication inverts the hierarchy" (`:331-340`), keep both existing
  paragraphs and add a third: the survivors do not become a work order - they
  are presented as a numbered list and the session asks which to act on, with
  NONE the default, so the model that just spent four voices on the artifact
  does not also decide what happens next. Name the four firing sites and say
  that the one exception is the opt-in unattended close, whose triage is NONE by
  construction. In the same file's "### Reviewer's stance" bullets (`:314-330`),
  check that no bullet restates the deleted anti-padding clause and remove it if
  one does; the anti-inflation bullet stays. In README.md's review paragraph
  (`:25`), add one sentence in the file's own first-person voice - no
  em-dashes - saying the survivors come back as a list you triage rather than a
  queue the model starts working, and that the default is none. Keep it to a
  sentence: the paragraph is already long and the README is the front door, not
  the specification. Then repair `skills/cad-plan-review/SKILL.md:52`, whose step-3
  parenthetical reads "this is a manual review, not the plan-creation flow where
  cad-plan applies them" - task 3(a) makes that false, and the file was scoped
  out of this phase on the strength of the clause BEFORE it ("Do NOT auto-apply
  changes to the plan"), which stays correct. Rewrite the parenthetical to say
  the plan-creation flow triages the same way, so no shipped surface documents
  the deleted behaviour as its contrast case. Both METHOD.md and README.md are
  on self-verify's `mdFiles` walk, so invent no config key, flag, or path in the
  new prose; none of the three is weighed, so no `weight-budgets.json` change.
- **Verify:** `node --test cadence-core/bin/*.test.mjs` exits 0, `npx tsc -p
  tsconfig.ci.json` exits 0, and `node cadence-core/bin/self-verify.mjs` reports
  `ok:true` with `problems: []` (AC7, on the whole phase); `grep -n "triage"
  METHOD.md README.md` returns a hit in each; `grep -rn "cad-plan applies them"
  skills/` returns nothing, and `grep -rn "ground then hand off" cadence-core/`
  returns nothing (the two shipped surfaces that documented the removed
  behaviour); and `grep -rn "padding" METHOD.md
  skills/cad-reviewer-contract/SKILL.md` returns nothing.

## Notes

- The `plan` trigger fired adjudicated over four reviewers (claude-subagent at
  `xhigh`, openai, gemini, deepseek). Seven survivors were triaged in and folded
  into tasks 2, 3, 5, 7, 8 and 9 above; the rest were killed as ungrounded, most
  notably a two-reviewer convergence on `"type": "int"` being invalid - this
  repo's `config.schema.json` uses its own vocabulary (`bool`/`int`/`enum`/
  `string_or_null`/`array_enum`) and `int` is already used six times, including
  `review.request_timeout_ms` directly above the insertion point. Two of the
  survivors were vacuous verifications (tasks 2 and 3) that passed on unmodified
  HEAD, which is the failure mode this phase's own AC1 is about.
- Plan shape matches the CONTEXT directive: one plan. The seam work (tasks 6-8)
  and the prose work (tasks 1-5, 9) look file-disjoint but both terminate at
  `self-verify.mjs` and `weight-budgets.json`, and the ordering is a real
  dependency in two places - task 6's check would report two live problems if it
  landed before task 5 repaired them, and task 8's schema key would be
  `inert-config-key` without its own catalog row in the same commit. That is a
  dependency, not a parallel.
- Discretionary choices CONTEXT left open, recorded here: the self-verify
  problem kind is `unbatched-dispatch` and its rule lives in a new pure lib
  `cadence-core/bin/lib/dispatch-phrasing.mjs` (the `config-reach` / `route-cells`
  split precedent) rather than inline in `self-verify.mjs`; the cap key is
  `review.max_prompt_tokens` with default `120000` estimated tokens and reach
  phrase `cross-model provider calls only`; the refusal reason is `over-cap`;
  and the gate text reaches `/cad-plan`, `/cad-verify` and `/cad-execute`
  through their `@`-preloaded workflow files rather than their four-line
  SKILL.md wrappers, which is what D-10's "carry the text or an explicit
  re-read" costs least.
- The D-06 check was prototyped against HEAD before this plan was written. With
  the rule as task 6 states it, exactly two blocks in the repo trip it:
  `references/review-triggers.md:68` (the target) and
  `workflows/execute.md`'s `execute_parallel` item 1, which instructs "one
  dispatch per message, in the background" while citing the `seams.md` rule that
  names those very executors as a ONE-message batch. Task 5(d) repairs the
  second. That edit is not in CONTEXT's In-list; it is forced by D-06's own
  check and it closes a real contradiction between two shipped surfaces, so it
  is planned explicitly rather than dodged by narrowing the pattern around a
  live counterexample. If it is unwanted, the alternative is to drop the
  `for each`/`for every` arm and keep only the host-hedge arm, which weakens the
  check to the single sentence #88 filed.
- `skills/cad-plan-review/SKILL.md` is deliberately untouched. Its step 3
  already presents the survivors and refuses to auto-apply, and it `@`-preloads
  `references/review-triggers.md`, so task 1's gate reaches it unedited. The
  absence of an edit there is a decision, not an oversight.
- No CHANGELOG task: `workflows/milestone.md:40` scaffolds the dated release
  heading at the close and nothing in this repo stages per-phase entries. No
  traceability task either - `/cad-plan`'s own `seed-reqs` step writes the
  TRI-02 and REV-03 rows.
- Every weighed surface this phase edits sits at EXACTLY its budget at HEAD
  (cad-land 7898, plan.md 14328, verify.md 12106, execute.md 13884,
  decision-review.md 9741, config.md 17878), so the `weight-budgets.json`
  regeneration inside tasks 2, 3, 5 and 8 is load-bearing rather than
  housekeeping: without it self-verify reports `budget-overrun` in the same
  commit as the prose and AC7 fails.
- Two flagged assumptions from CONTEXT stay open and are not closable here:
  whether the host imposes its own ceiling on a single subagent prompt (if it
  does not, D-07's exemption leaves the `claude-subagent` arm the one unbounded
  payload in the subsystem), and whether `chars/4` over- or under-estimates
  against each provider's own max-input ceiling (if it under-estimates, a
  payload passes the cap and the provider rejects it anyway, which is a
  structured `http` failure the seam already degrades cleanly).
