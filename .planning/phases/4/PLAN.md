---
phase: 4
plan: 1
requirements: [TOK-03, TOK-04]
files:
  - cadence-core/bin/lib/trace.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/weight-budgets.json
  - cadence-core/references/review-triggers.md
  - cadence-core/workflows/context.md
  - cadence-core/workflows/execute.md
  - cadence-core/workflows/plan.md
  - cadence-core/workflows/progress.md
  - cadence-core/workflows/verify-deep.md
---

# Phase 4: Token accounting - Plan

## Goal

What a dispatch costs is recorded at the moment it returns, at every phase-scoped
site that dispatches a worker EXCEPT the cross-model review arm, and rendered per
role - so a claim about Cadence's token burn can be checked against the run
record instead of felt. The exception is locked by CONTEXT D-12 and is stated
here rather than buried: a panel's provider call is a real phase-scoped dispatch
and this phase does not measure it.

## Must be true when done

- `trace append` stores a role name and a non-negative integer token count on a
  lifecycle event, identically on all three terminal events (`return`,
  `checkpoint`, `escalation`); a non-integer token value returns
  `{"ok":false,...,"reason":"bad-args"}` and appends nothing at all.
- A `dispatch` event stores the comma-separated read-set it was handed as an
  array, verbatim, and `trace render` shows it on the event.
- `trace render --phase <N>` prints a per-role block beside the four family
  counts: each role's dispatch count, its token total when any dispatch reported
  one, and an `unrecorded` dispatch COUNT when some did not. A role with no
  figure at all shows no token total, and a fully-recorded role shows no
  `unrecorded` key.
- Every phase-scoped dispatch site EXCEPT the cross-model review arm is bracketed
  by written, fenced `trace append` commands - `context.md`, `plan.md`'s three,
  `review-triggers.md`'s claude-subagent arm, plus the two that already bracketed
  - with `--role` on both halves, a non-empty `--read` on the dispatch, and
  `--tokens` on the closing event. `review-triggers.md`'s cross-model arm is
  excluded by D-12 and says so in its own prose, so a reader of the run record is
  told what is missing from it rather than inferring completeness.
- Deleting either half of any one bracketing file's pair, dropping any one of the
  dispatch moments a file is required to carry, dropping any one of its CLOSING
  events, dropping `--role` from a terminal line, or emptying any prose read-set,
  makes `node --test cadence-core/bin/trace.test.mjs` fail and name the file.
- `/cad-progress --trace` prints the per-role totals, and reports a role with no
  figure as `unrecorded` rather than as zero.
- `node --test cadence-core/bin/*.test.mjs`, `npx tsc -p tsconfig.ci.json` and
  `node cadence-core/bin/self-verify.mjs --root .` are green, with
  `weight-budgets.json` carrying the exact byte count of every surface this phase
  edited.

## Context

Locked by `phases/4/CONTEXT.md`: both new fields ride the EXISTING `trace append`
subcommand and land their `CONTRACTS['planning.mjs']['trace append']` row in the
same task (D-01); the token flag validates through `requireInt` and a bad value
appends nothing (D-02); tokens are honored on all three terminal events (D-03);
role is its own flag and `--plan` keeps its pairing-key job (D-04); aggregation
is computed inside `renderTrace` with a matching `TraceRender` typedef entry or
`tsc` fails on the introducing commit (D-05); `unrecorded` is a count, never a
string in a numeric field (D-06); the read-set is ONE comma-separated value
(D-07); `progress.md` is the only consumer prose (D-08); brackets are WRITTEN as
fenced single-line commands in `verify-deep.md`'s literal shape, never described
(D-10); the token number comes from the host's subagent return with no new hook
or seam (D-11); the `provider` family is untouched (D-12); every prose task
regenerates its surface's budget entry in the same task (D-15).

Out of scope: `new-project.md`, `task.md` and `decision-review.md` (they cannot
produce a legal `--phase`, D-09); any usage extraction on `provider/request`
(D-12); converting a read-set into bytes or a duplicate-read percentage (D-13).

## Tasks

### Task 1: Token, role and read-set flags on `trace append`

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/self-verify.mjs,
  cadence-core/bin/trace.test.mjs
- **Action:** All three flags land in ONE task because they edit the identical
  `cmdTrace` `append` arm, the identical `CONTRACTS['planning.mjs']['trace
  append']` row and the identical header usage line; splitting them would be two
  commits rewriting the same lines. In that arm (planning.mjs ~2118-2147), after
  the `--event` check and BEFORE the `appendEvent` call:
  (a) `--tokens`: when `'tokens' in opts`, run `requireInt(opts.tokens)` (import
  it beside the existing `requirePhaseArg` from `./lib/require-int.mjs`) and
  return `fail('bad-args', 'trace append --tokens needs a non-negative integer')`
  when it is not ok or when the value is negative - the call appends NOTHING,
  because a best-effort append that dropped the field would render the role
  `unrecorded` while the orchestrator believed a figure was recorded (D-02).
  Spread `...(tokens === undefined ? {} : { tokens })` into the event object
  after `detail`, storing a NUMBER.
  (b) `--role`: same guard shape the existing `--plan`/`--sha` lines use -
  `typeof opts.role === 'string' && opts.role.trim()` -> `{ role: opts.role.trim() }`,
  so a bare `--role` (parsed as boolean `true`) records nothing rather than the
  literal `true`.
  (c) `--read`: ONE comma-separated value, split-and-trimmed the way `phase-done
  --reqs` does it (:469-477): when `'read' in opts`, require a string,
  `split(',').map(s => s.trim()).filter(Boolean)`, and return `fail('bad-args',
  'trace append --read needs a comma-separated path list')` appending nothing
  when the result is empty - a bare `--read`, an empty string, or an all-blank
  value is almost always an unset `"$PATHS"`, and recording a complete-looking
  dispatch with no read-set is the failure this refusal exists against. Store the
  array as `read` on the event. A REPEATED `--read` is impossible by
  construction, not by choice: `parseArgs` does `opts[a.slice(2)] = next`
  (:2561-2574) so only the last would survive - state that in a one-line comment
  at the split so nobody later "improves" it into multiple flags (D-07). Store
  the values VERBATIM: no existence check, no byte measurement, no normalization
  (D-13). State the accepted GRAMMAR in one line at the split and repeat it in
  the `CONTRACTS` row comment, so the field's heterogeneity is a recorded
  decision rather than an accident of three call sites: an element is any
  verbatim string naming something the site caused the worker to read - a path, a
  glob, or a non-path reference (a `<base>..<head>` ref range) the worker
  resolves for itself - and a reader converting the set to bytes must resolve
  each element by kind rather than assuming a plain path.
  Couple NO flag to an event name: the seam stays event-agnostic exactly as it is
  today, which is what makes `return`, `checkpoint` and `escalation` store tokens
  identically (D-03). Add `'--tokens'`, `'--role'` and `'--read'` to
  `CONTRACTS['planning.mjs']['trace append']` in self-verify.mjs (:150) in this
  same task (D-01/D-20), and extend planning.mjs's own header usage line for
  `trace append` (:43-44) with the three new optional flags. Do not touch the
  `--phase` handling: `requirePhaseArg` keeps the caller's spelling and `--phase
  1.10` must still key separately from `1.1` (phases/3/UAT.md item 2). Tests in
  trace.test.mjs: AC1's literal call carries both `role` and `tokens` on one
  line; `--tokens abc` and `--tokens -1` each return `ok:false`/`bad-args` with
  the trace file byte-identical (or still absent); `--tokens` lands the same way
  on `checkpoint` and `escalation`; a bare `--role` writes no `role` key;
  `--plan` and `--role` are two separate fields on the same event; `--read
  "a.md,b.md,c.md"` on an `--event dispatch` stores a three-element array visible
  in `trace render`'s `events`; whitespace is trimmed and empty segments dropped
  (`"a.md, ,b.md,"` -> two elements); a bare `--read` and `--read ""` both return
  `bad-args` with nothing appended; a path that does not exist on disk is stored
  unchanged.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` passes; against a
  scratch dir, `node cadence-core/bin/planning.mjs --dir <d> trace append --phase
  4 --family lifecycle --event return --plan 1 --role cad-executor --tokens
  12345` writes a line whose JSON has `"role":"cad-executor"` and `"tokens":12345`
  (a number, unquoted); the same call with `--tokens abc` prints
  `{"ok":false,...,"reason":"bad-args"}` at exit 1 and `wc -l` of the trace file
  is unchanged; `trace append ... --event dispatch --plan cad-planner --role
  cad-planner --read "a.md,b.md,c.md"` then `trace render --phase 4` shows
  `"read":["a.md","b.md","c.md"]` on the event; and `node
  cadence-core/bin/self-verify.mjs --root .` returns `"ok":true`.

### Task 2: Per-role aggregation inside `renderTrace`

- **Files:** cadence-core/bin/lib/trace.mjs, cadence-core/bin/planning.mjs,
  cadence-core/bin/trace.test.mjs
- **Action:** Add a `roles` field to the `TraceRender` typedef (:228-237) -
  `@property {Record<string, {dispatches: number, tokens?: number, unrecorded?:
  number}>} roles` - in the same edit that assigns it, or `npx tsc -p
  tsconfig.ci.json` fails on this commit (D-05). Compute it inside `renderTrace`
  (never in `cmdTrace`: the lib is the stated ONE reader and `counts`/`malformed`
  /`unpaired` are all lib-computed) in the existing lifecycle branch of the
  single line loop: the role key is `key(e.role)`, so a bracket that omitted
  `--role` keys the empty string exactly as `plan` already does (`key()` at
  :80-82) and stays VISIBLE as an unkeyed row instead of vanishing from the
  totals. On a `DISPATCH` event increment that role's `dispatches`; on ANY
  lifecycle event where `typeof e.tokens === 'number' && Number.isFinite(e.tokens)`
  add it to that role's total and increment an internal `recorded` counter - a
  non-numeric `tokens` on a hand-edited or foreign-producer line contributes
  nothing and must never be string-concatenated onto the total. Emit per role
  `{dispatches, ...(recorded ? {tokens} : {}), ...(unrecorded ? {unrecorded} :
  {})}` with `unrecorded = Math.max(0, dispatches - recorded)` and the internal
  counter dropped: the token total is OMITTED when nothing was recorded so a
  role with no figure never shows a zero, and `unrecorded` is a dispatch COUNT
  omitted at zero, never the string `unrecorded` sitting in a numeric field
  (D-06). Leave the dispatch/terminal pairing loop keyed on `(corr, phase, plan)`
  exactly as it is - per-role grouping must not become a second pairing rule
  (recalled: CAPTURE.md phase 1, the `(phase, plan)` pairing item closed by
  4377cfd, whose loop this walks). In `cmdTrace`'s render arm (:2156-2164) pass
  it through as `...(Object.keys(r.roles).length ? { roles: r.roles } : {})`
  placed after `counts`, per the seam's absent-optionals-omitted convention
  (:9-14), and update planning.mjs's header description of `trace render`. Tests:
  two roles in one phase, one fully recorded (no `unrecorded` key) and one with 2
  of 3 dispatches carrying figures (`tokens` present AND `unrecorded: 1`); a role
  whose dispatches carried nothing has no `tokens` key at all; tokens on
  `checkpoint` and on `escalation` aggregate the same as on `return`; a bracket
  with no `--role` lands under the `""` key; a phase with no lifecycle events
  renders with no `roles` key; a `"tokens":"12345"` string line contributes 0 and
  counts as unrecorded.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` passes and `npx tsc
  -p tsconfig.ci.json` prints nothing; against a scratch dir, appending a
  dispatch plus a `return --tokens 900` for `--role cad-planner` and a lone
  dispatch for `--role cad-reviewer` makes `trace render --phase 4` print
  `"roles":{"cad-planner":{"dispatches":1,"tokens":900},"cad-reviewer":{"dispatches":1,"unrecorded":1}}`.

### Task 3: Brackets at `context.md` and `plan.md`

- **Files:** cadence-core/workflows/context.md, cadence-core/workflows/plan.md,
  cadence-core/bin/weight-budgets.json
- **Action:** Copy `verify-deep.md`'s literal shape at every site - a fenced
  single-line `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs" trace
  append ...` immediately before the spawn-agent call and another at the return -
  and never describe a bracket in prose: a described bracket is invisible to both
  the producer census and self-verify's check 2 flag lint, so the site would be
  unenforced and a wrong flag name would ship CI-green (D-10). Keep every bracket
  `--plan <key>` equal to its `--role <key>` at these role-dispatched sites:
  `--plan` stays the pairing key (execute.md:222-223), `--role` is the grouping
  key (D-04). State once, at the first site, that the token number is read off the
  host's subagent return metadata at the moment the worker returns and that an
  absent figure means the flag is OMITTED, never `--tokens 0` - Cadence adds no
  hook and no capture mechanism for it (D-11, D-06).
  (a) `context.md`, `analyze` step: dispatch bracket immediately before "Dispatch
  `cad-assumptions-analyzer` via the spawn-agent seam" (:105), keyed
  `--plan cad-assumptions-analyzer --role cad-assumptions-analyzer` and carrying
  `--read ".planning/ROADMAP.md,.planning/phases/<prior N>/CONTEXT.md"`. That
  read-set is CONTRACT-prescribed, not prompt-named: the dispatch prompt
  (:109-118) names no planning path, while `skills/cad-assumptions-analyzer-contract/SKILL.md`
  process step 1 tells the analyzer to read the roadmap entry and prior phases'
  context files - and this is the single most expensive unbracketed dispatch
  measured (206,901 tokens), so an empty read-set here under-reports the
  duplicate-read fraction by a full copy of the planning set (D-13). Close it at
  "Wait for the result. Parse:" (:120) with `--event return ... --tokens <the
  token count on the subagent return>`, and close the fail/timeout arm (:126-128)
  with `--event checkpoint ... --detail "<what failed>"`.
  (b) `plan.md`, three sites: `spawn_planner` (:80-84), keyed `cad-planner`, with
  `--read ".planning/ROADMAP.md,.planning/REQUIREMENTS.md,.planning/PROJECT.md,.planning/phases/{N}/CONTEXT.md"`
  (the paths its own prompt names at :120-126; add
  `.planning/phases/{N}/UAT.md` and the existing PLAN*/SUMMARY* files in gaps
  mode), closed in `handle_return` (:167-181) with `--event return --tokens <n>`
  on a marked return and `--event checkpoint --detail` on the empty-or-unmarked
  arm. `check_gate`'s checker dispatch (:186), keyed `cad-plan-checker`, with
  `--read ".planning/phases/{N}/PLAN*.md,.planning/ROADMAP.md,.planning/REQUIREMENTS.md,.planning/phases/{N}/CONTEXT.md"`,
  closed where its return is read (:205-206). The revision arm (:212-232), which
  brackets BOTH of its re-dispatches: the fresh revision `cad-planner` (step 1,
  same keys and same read-set as `spawn_planner`) and the NARROWED checker
  re-dispatch (step 2, keyed `cad-plan-checker`, `--read
  ".planning/phases/{N}/PLAN*.md"` - the files whose diff is its whole artifact).
  Each of those two gets its OWN written closing command, and this names where:
  the revision planner closes at the end of step 1, where its `## REVISION
  COMPLETE` return is read, and the narrowed checker closes at the end of step 2,
  before step 3 reads its blocker verdict - `--event return --tokens <n>` on a
  marked return, `--event checkpoint --detail` on an empty or unmarked one, the
  same two arms `spawn_planner` uses. Naming both is not pedantry: an open
  bracket here is invisible to a per-file census that only counts SOME terminal
  (the file has several), and leaving the narrowed re-dispatch unclosed would
  leave a paid dispatch unmeasured on the exact path the phase exists to measure.
  That is FOUR dispatch moments in `plan.md` across the three prose sites, each
  with its own close, and Task 6's census binds both counts. Then regenerate BOTH files' `weight-budgets.json` entries in this
  same task from `node cadence-core/bin/weight.mjs --root .`, as exact byte
  counts - the current entries (context.md 16615, plan.md 16225) are today's
  sizes to the byte, so every edit is a `budget-overrun` until they move (D-15).
- **Verify:** `node cadence-core/bin/self-verify.mjs --root .` returns
  `"ok":true` (proves no `unknown-flag`, no `unknown-subcommand`, and no
  `budget-overrun` on either surface); `grep -c "trace append"
  cadence-core/workflows/context.md` is at least 3 and the same on `plan.md` is
  at least 8; every `--event dispatch` line in both files matches `--role ` and
  `--read "`; `node --test cadence-core/bin/trace.test.mjs` stays green (the
  existing census reads the new invocations and accepts their family and event
  names).

### Task 4: Brackets at `review-triggers.md`, and role/token/read on the two shipped brackets

- **Files:** cadence-core/references/review-triggers.md,
  cadence-core/workflows/execute.md, cadence-core/workflows/verify-deep.md,
  cadence-core/bin/weight-budgets.json
- **Action:** In `review-triggers.md` step 4's claude-subagent arm (:85-106), add
  the dispatch bracket immediately before the dispatch instruction and the
  terminal bracket immediately after "Parse the JSON object it returns", keyed
  `--plan cad-reviewer --role cad-reviewer`, in the same fenced literal shape.
  `--read` carries the payload artifact the reviewer is told to resolve for
  itself - the file path(s) for shape (c), the `<base_ref>..<head_ref>` pair for
  shapes (a)/(b), the named scope for the in-context shape - never empty, stored
  verbatim under the grammar Task 1 states (a path, a glob, or a non-path
  reference the site caused the worker to resolve), because resolving that
  reference is step one of the reviewer's own contract
  (`skills/cad-reviewer-contract/SKILL.md`) and is what the site causes it to
  read (D-13). `<N>` follows the rule the adjudication append at :175-179 already
  states: the phase in hand, or the STATE cursor's phase for a milestone-scoped
  trigger. Give the cross-model arm NO bracket and no token field (D-12) and add
  one sentence there saying so plainly: under a panel, `cad-reviewer`'s per-role
  total covers the claude-subagent voice only and the provider call beside it is
  unmeasured, so the number is short by an unstated amount. Name that same gap in
  the task report so the phase SUMMARY carries it as a CAPTURE item (CONTEXT
  flagged assumption 1). Then extend the two brackets that already ship:
  `execute.md` (:213-217) gains `--role cad-executor` on all three forms,
  `--tokens <n>` on the `return` and `checkpoint` forms, and `--read
  "CLAUDE.md,.planning/PROJECT.md,.planning/phases/<N>/CONTEXT.md,<the plan
  file>"` on the dispatch form - the shared-plus-plan-specific set its own prompt
  names at :183-188, and the set TOK-04 measures as re-read by every dispatch in
  a phase. `execute.md:110`'s `--event phase_start --sha <PHASE_START>` line is
  NOT a worker bracket and gains NO `--role`, `--tokens` or `--read`: it is the
  correlation-id ANCHOR (`lib/trace.mjs` exports it as `ANCHOR`, distinct from
  `DISPATCH` and `TERMINAL`), and keying it into the role table would invent a
  role that never ran. `verify-deep.md` (:12, :30, :71) gains `--role
  cad-verifier` on all three, `--tokens <n>` on the `return` and `checkpoint`
  forms, and `--read ".planning/phases/<N>/PLAN*.md,.planning/phases/<N>/SUMMARY*.md,.planning/ROADMAP.md,.planning/phases/<N>/UAT.md"`
  on the dispatch - the paths its dispatch step names at :15-18. Without `--role`
  on these two, `cad-executor` - the most expensive command measured (49.7M
  billed-equivalent, 3,316 messages; CAPTURE.md, promoted 2026-08-04) - is the
  one line the per-role block could structurally never print, which is D-04's
  whole argument. Regenerate all three surfaces' `weight-budgets.json` entries in
  this same task (D-15).
- **Verify:** `node cadence-core/bin/self-verify.mjs --root .` returns
  `"ok":true`; across `cadence-core/references/review-triggers.md`,
  `cadence-core/workflows/execute.md` and `cadence-core/workflows/verify-deep.md`,
  every `trace append` line whose event is `dispatch`, `return`, `checkpoint` or
  `escalation` carries `--role ` (grep those four event names only - the
  `phase_start` anchor at `execute.md:110` is excluded by construction and must
  NOT match), every `--event dispatch` line carries `--read "`, and every
  `--event return`/`--event checkpoint` line carries `--tokens`; `node --test
  cadence-core/bin/trace.test.mjs` passes.

### Task 5: `/cad-progress --trace` prints the per-role totals

- **Files:** cadence-core/workflows/progress.md,
  cadence-core/bin/weight-budgets.json
- **Action:** In the `trace` step (:87-101), after the sentence that prints the
  four family counts and before the `unpaired` sentence, instruct printing the
  render's `roles` block: one line per role key carrying its token total, its
  dispatch count, and its `unrecorded` count when present. State the reading rule
  explicitly, because it is the distinction AC3 exists to protect: an absent
  token total means NO dispatch of that role reported a figure and is printed as
  `unrecorded`, never as `0`, and an `unrecorded` count beside a real total means
  that many of the role's dispatches came back without one. A render carrying no
  `roles` key prints nothing for it, exactly as an absent trace file already
  prints empty counts. Add no flag to `/cad-progress` and change no other step -
  this is the only shipped surface that invokes `trace render`, which is why it
  is the only consumer prose this phase touches (D-08). Regenerate progress.md's
  `weight-budgets.json` entry in this same task (D-15).
- **Verify:** `node cadence-core/bin/self-verify.mjs --root .` returns
  `"ok":true`; `grep -n "roles\|unrecorded" cadence-core/workflows/progress.md`
  shows the new instruction inside the `trace` step; `wc -c
  cadence-core/workflows/progress.md` equals its `weight-budgets.json` entry.

### Task 6: Per-file bracket coverage in the producer census

- **Files:** cadence-core/bin/trace.test.mjs
- **Action:** Widen the existing producer census (:335-446) rather than adding a
  parallel test. Extend `traceAppends` (:384-394) to capture `--plan`, `--role`
  and `--read` beside `--family`/`--event`, quote-aware for `--read`: try
  `--read\s+"([^"]*)"` BEFORE the bare `\S+` form, or a quoted path list is
  truncated at its first space and a populated read-set reads as a one-element
  one. Add a named constant mapping each file that must bracket to its EXPECTED
  MINIMUM dispatch count - `cadence-core/workflows/context.md` 1,
  `cadence-core/workflows/plan.md` 4, `cadence-core/references/review-triggers.md`
  1, `cadence-core/workflows/execute.md` 1, `cadence-core/workflows/verify-deep.md`
  1 - with a comment stating that the census is now deliberately per-FILE and why
  that REVERSES the note left at `.planning/_archive-v2.5.0/1/reports/plan-2.md`
  (task 2's deviation called a per-file producer assertion "overfitting to
  today's file layout"): the bracket set is now a stated requirement rather than
  an accident of layout, so binding the test to it is the point (D-14). Assert,
  per file in that map:
  (a) at least the mapped NUMBER of `lifecycle` + `DISPATCH` invocations - a bare
  "at least one" would let three of `plan.md`'s four brackets be deleted with the
  suite green - with the expected and actual counts both named in the failure
  message;
  (b) at least as many `lifecycle` invocations whose event is in `TERMINAL` as
  that file has DISPATCH invocations, with the two counts named in the failure
  message. "At least one terminal" is not enough and the asymmetry is the whole
  bug it would leave open: `plan.md` carrying four dispatches and three closes
  satisfies a presence check while one bracket hangs open forever, and a hanging
  bracket is precisely the dispatch whose cost never reaches the record. Counting
  both halves is what makes the per-file assertion mean "every bracket is
  closed" rather than "this file brackets something".
  Read `DISPATCH`, `TERMINAL` and `ANCHOR` from `lib/trace.mjs`'s exports, never
  from a copied list. Assert additionally, across all surfaces, that EVERY prose
  `lifecycle` invocation carries a non-empty `--role` when its event is `DISPATCH`
  or in `TERMINAL`, exempting `ANCHOR` (`execute.md:110`'s `phase_start` line
  legitimately has neither `--plan` nor `--role`). The terminal half of that
  assertion is not decorative: the terminal lines are the ones carrying
  `--tokens`, so a prose edit dropping `--role` from a terminal line alone would
  file every token figure under the `""` key while dispatch counts stayed keyed
  by role - each role reported fully `unrecorded` beside a nonzero `""` total,
  with the whole suite green. That is exactly the AC3 conflation this phase
  exists to prevent. Assert also that every `DISPATCH` invocation carries a
  non-empty `--read`, which is AC4's "all read-sets are non-empty" made
  mechanical. Keep every existing global assertion untouched.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` passes with the tree
  intact; then prove failing-capability by patch-and-rerun, restoring with `git
  checkout --` after each and recording the exact command, the failure message
  and the restore in the task report so the SUMMARY carries them (AC5): (1)
  delete the `--event dispatch` line from `cadence-core/workflows/context.md` -
  the run FAILS naming context.md; (2) delete ONE of `plan.md`'s four `--event
  dispatch` lines - the run FAILS naming plan.md and printing expected 4 / actual
  3, proving the count binding and not merely the presence binding; (3) delete
  the `--event return` line from `cadence-core/references/review-triggers.md` -
  the run FAILS naming that file; (4) delete ONE of `plan.md`'s four CLOSING
  lines, leaving the other three closes and all four dispatches intact - the run
  FAILS printing 4 dispatches / 3 terminals, which a presence-only assertion
  would have passed; (5) drop `--role cad-executor` from `execute.md`'s `--event
  return` line - the run FAILS naming the terminal line without a role; (6) blank
  one `--read` value to `--read ""` - the run FAILS naming the empty read-set.
  `git status --short` shows no prose file modified when the six are done.

### Task 7: Whole-tree gate sweep and end-to-end token evidence

- **Files:** cadence-core/bin/weight-budgets.json
- **Action:** Produce AC6's end-to-end evidence against THIS repo's own script
  and workflow paths, never the installed 2.5.0 plugin - that copy predates every
  bracket in this phase, so a walk through the installed `/cad-*` commands would
  observe zero lifecycle events and fail the criterion against correct code
  (D-16). A real subagent dispatch is outside the executor's reach
  (`agents/cad-executor.md` declares no `Task` tool), so the evidence step is
  written as a human-verify instruction for the orchestrator rather than as a
  command the executor pretends to run. Budgets need no separate reconciliation
  pass here: D-15 already made each prose task regenerate its own entry, and
  `self-verify` reports `budget-overrun`/`unbudgeted-surface` directly, so the
  gate run below is the check. Touch `weight-budgets.json` only if that gate
  reports a stale entry, and record any such touch as a deviation naming the task
  that should have regenerated it.
- **Verify:** Run and report each of: (1) `node --test cadence-core/bin/*.test.mjs`
  - 0 failures; (2) `npx tsc -p tsconfig.ci.json` - no output; (3) `node
  cadence-core/bin/self-verify.mjs --root .` - `"ok":true` with no
  `budget-overrun` or `unbudgeted-surface`. Then human-verify (the orchestrator
  holds `Task`; the executor does not):
  1. `cd /data/code/cadence`.
  2. Run the dispatch bracket exactly as this repo's
     `cadence-core/workflows/plan.md` `spawn_planner` step now writes it,
     substituting this repo's own script path: `node
     cadence-core/bin/planning.mjs trace append --phase 4 --family lifecycle
     --event dispatch --plan cad-planner --role cad-planner --read
     ".planning/ROADMAP.md,.planning/REQUIREMENTS.md,.planning/PROJECT.md,.planning/phases/4/CONTEXT.md"`.
     Expect `{"ok":true,"written":true,"corr":"4-..."}`.
  3. Dispatch one subagent, then read the token figure off its return metadata.
  4. Close the bracket: `node cadence-core/bin/planning.mjs trace append --phase 4
     --family lifecycle --event return --plan cad-planner --role cad-planner
     --tokens <that figure>`. Expect `{"ok":true,"written":true,...}`.
  5. `node cadence-core/bin/planning.mjs trace render --phase 4`. Expect the
     `roles` block to carry `"cad-planner":{"dispatches":1,"tokens":<non-zero>}`
     with no `unrecorded` key on that role.

## Notes

- Plan shape honored: ONE plan, per CONTEXT D-15. Four of the seven tasks edit
  `cadence-core/bin/weight-budgets.json`, so any split would be refused by
  `plan-overlap` at `choose_path`.
- Bracket arithmetic, reconciled rather than guessed: CONTEXT's scope boundary
  says "six brackets in total" while D-09 and AC4 enumerate `context.md` (1),
  `plan.md` (3) and `review-triggers.md` (1). The two agree once `plan.md`'s
  revision arm is counted as the TWO re-dispatches it actually contains (the
  fresh revision planner and the narrowed checker), giving 1 + 4 + 1 = 6 dispatch
  moments across the 3 prose sites D-09 names in `plan.md`. Task 3 brackets all
  four moments at those three sites and Task 6's census binds `plan.md` to a
  minimum of 4, so no dispatch in the file is left unmeasured under either
  reading.
- Task 4's edits to `execute.md` and `verify-deep.md` add no new bracket SITE -
  both already bracket. They add `--role`, `--tokens` and `--read` to the
  brackets that exist, which D-04's own argument requires (grouping must print
  `cad-executor`) and which the phase goal's "every site that dispatches" makes
  unavoidable. `execute.md:110`'s `phase_start` anchor is explicitly excluded
  from all three fields.
- Planner discretion, recorded because CONTEXT leaves it open: a lifecycle
  bracket carrying no `--role` groups under the empty-string key rather than
  being dropped, matching `lib/trace.mjs`'s existing `key()` convention (:80-82),
  so a forgotten flag is visible rather than silent; `--tokens` is refused when
  negative under the same `bad-args` reason as a non-integer; `--read` with an
  empty value is refused exactly as `phase-done --reqs` refuses one; the `--read`
  grammar admits paths, globs and non-path references, stated once in Task 1 and
  in the `CONTRACTS` row so the heterogeneity is decided rather than accidental;
  and the render sums `tokens` from ANY lifecycle event carrying a finite number
  rather than from terminal events alone, so a figure written at the wrong half
  of a bracket is counted rather than silently dropped (prose writes it once, at
  the close).
- `PROJECT.md`'s Out of Scope line "Runtime token telemetry of live sessions -
  Claude Code exposes no per-turn stats to a plugin script" is NOT contradicted
  by this phase and is not amended here: the figure is read by the ORCHESTRATOR
  off a subagent return and handed to the seam as a flag; no plugin script queries
  per-turn stats and no hook is added (D-11). Worth one line in phase 5's doc
  sweep so the two read as consistent to someone arriving cold.
- Checker warnings folded in without a revision dispatch (all five were WARNING,
  no BLOCKER): the `phase_start` anchor exclusion (Task 4 Action and Verify), the
  terminal-line `--role` assertion (Task 6), the per-file minimum dispatch COUNT
  (Task 6), the `--read` grammar statement (Task 1), and the proportionality
  merge of the two flag tasks into Task 1 plus the trim of the redundant budget
  reconciliation in Task 7 - eight tasks down to seven.
- `plan` review trigger fired at gate `adjudicated`; voice was cross-model
  `openai`/`gpt-5.6-terra` at effort `high` (`review.reviewers` names no
  claude-subagent, so none ran - not a fallback). Four findings, three survived
  adjudication and the user selected all three: the revision arm's two close
  points named (Task 3b), the census bound to terminals >= dispatches per file
  with a sixth patch-and-rerun proof (Task 6), and the provider carve-out stated
  in the Goal and in "Must be true when done" rather than left implicit.
  KILLED in adjudication: a claim that D-03 is violated because prose requires
  `--tokens` only on `return`/`checkpoint` lines. No `--event escalation` bracket
  exists in any surface - `execute.md:214-216` and `verify-deep.md:12,30,71` write
  dispatch/return/checkpoint only - so the grep guards nothing absent, while
  D-03's actual requirement (the SEAM stores tokens on all three) is delivered by
  Task 1 coupling no flag to an event name and tested by Task 2.
  The reviewer also filed the cross-model arm as a blocker demanding it be
  bracketed; that re-opens locked D-12, so it was downgraded to the wording fix
  above rather than applied as a scope change.
