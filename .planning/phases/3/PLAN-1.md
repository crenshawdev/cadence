---
phase: 3
plan: 1
requirements:
  - CER-01
files:
  - cadence-core/bin/lib/phase-plans.mjs
  - cadence-core/bin/phase-plans.test.mjs
  - cadence-core/bin/lib/risk-diff.mjs
  - cadence-core/bin/risk-diff.test.mjs
  - cadence-core/bin/route.mjs
  - cadence-core/bin/route.test.mjs
  - cadence-core/bin/config-seams.test.mjs
  - cadence-core/bin/lib/arg-contract.mjs
  - cadence-core/bin/arg-contract.test.mjs
  - cadence-core/config.schema.json
  - cadence-core/references/seams.md
  - cadence-core/workflows/execute.md
  - cadence-core/workflows/plan.md
  - cadence-core/bin/weight-budgets.json
---

# Phase 3: Ceremony the change pays for - Plan 1 (the detector and the floor resolve)

## Goal

`stakes` states the minimum a project will accept rather than the level every
phase pays: a resolve reads the phase's own declared `files:` at plan time and
raises the level from that floor, so a phase touching nothing on a risk surface
resolves below what today's project floor produces and no phase touching one
resolves lower than it does now.

## Must be true when done

- With `stakes` set explicitly to `critical`, `route.mjs resolve` returns level
  `critical` for a phase whose declared files touch no surface - an explicit
  floor is never resolved below (AC1).
- With `stakes` unset, a resolve for a real phase of this repo whose declared
  `files:` touch no answered surface returns `solo` where today's resolver
  returns `shipped`, and both outputs can be shown side by side (AC2).
- A resolve whose PLAN is absent, unreadable or out of grammar returns
  `ok:true` at the configured stakes - never below it, never `ok:false` - and
  the `solo` discount is reachable only when every plan in scope was read clean
  (AC5).
- An executor resolve carrying its plan number floors on THAT plan's declared
  files, so a clean plan in a mixed phase routes below its risky sibling, while
  a phase-scoped role floors on the union of the phase's plans.
- Every level move is stated: the resolved bundle names the phase (and plan),
  the surface, the file that evidenced it and the level it moved from, in
  `reason`, and every unreadable input rides `warnings[]`.
- `node cadence-core/bin/test.mjs routing prose` passes and
  `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with an
  empty `problems` array.

## Context

CONTEXT.md decisions this plan implements: D-01 (detector = risk-diff path
signals + a content pass over declared bodies, answered surfaces only,
signal-table files exempt), D-02 (an explicit `stakes` is the floor; unset means
floor `solo`), D-04 (fail closed at the configured stakes, and the aggregation
rule over a multi-plan scope), D-05 (frontmatter `files:` only, never
`parsePlanFiles`' union with task lines), D-06 (per PLAN for executor
dispatches, per PHASE for phase-scoped callers), D-09 (`--phase` decides a floor
and a malformed one is refused), D-10 (scoped by the answered surfaces), D-13
(this is NOT the deleted `lib/risk-surfaces.mjs` name-token matcher).

Out of scope here: the waiver key, the effort clamp and the replay live in
PLAN-2; METHOD.md, INTERNALS.md, README.md and the claims ledger live in
PLAN-3. The five grids in `route-table.json` do not move (D-07) - the computed
level selects an existing row.

The deleted prior art is real and readable: `git show
8063832^:cadence-core/bin/lib/phase-plans.mjs` holds the reader this restores
and `git show 8063832^:cadence-core/bin/route.mjs` holds the wiring shape.
Read them for the failure rules they wrote down; do NOT restore the
`lib/risk-surfaces.mjs` name-token matcher they fed (D-13: its measured failure,
15/16 resolves floored on opus, is why CER-01 exists).

## Tasks

### Task 1: A phase's plans, read for what they declare

- **Files:** cadence-core/bin/lib/phase-plans.mjs (beside `cursorPhase`),
  cadence-core/bin/phase-plans.test.mjs
- **Action:** Give this file back its disk half: a reader answering what a
  phase's PLAN files declare, in two faces - one plan named by its plan key, and
  the union across every conforming plan file in `phases/<phase>/`. The
  already-present `PLAN_FILE` regex is the conforming set, and `PLAN.md` is plan
  1 spelled bare (the same equivalence `listPlanFiles` and `planning.mjs`'s
  plan-file lookup carry). Paths come from the frontmatter `files:` list alone,
  through `readFrontmatterList(text, 'files')` from `./planning-files.mjs` -
  never `parsePlanFiles`, whose union with `- **Files:**` task lines is a safe
  over-approximation for a parallel-overlap check and an unsafe raise here,
  because incidental task prose would then floor a whole phase (D-05). The
  return must let a caller apply D-04's aggregation without re-reading anything:
  how many conforming plan files were FOUND and how many were read CLEAN, beside
  the union and the warnings. A plan whose read throws contributes no paths and
  one warning naming the file; a plan whose frontmatter comes back with a
  non-empty `issues` array contributes no paths and one warning naming the file
  and the first issue's line and code - salvaging the half that parsed would
  floor a phase off a path list the grammar already rejected. An absent planning
  root or an absent phase directory is the ordinary pre-plan state: zero found,
  no warning, no throw. Nothing here throws - every fs call in its own try, the
  rule this file's header already states. Prefix every warning string with `risk
  floor: ` so the resolve can relay it verbatim, matching the vocabulary
  `config-seams.test.mjs` still carries a helper comment for. Do not add a
  category matcher of any kind - this file reads disk and reports, and the
  matching lives in `lib/risk-diff.mjs` (task 2).
- **Verify:** `node --test cadence-core/bin/phase-plans.test.mjs` passes with
  cases pinning each of: two conforming plans both parsing return the union with
  found and clean both 2; a plan whose frontmatter is out of grammar contributes
  no path, one warning naming its file, and leaves clean below found; an
  unreadable plan does the same; an absent phase directory returns zero found
  and no warning; the named-plan face reads only the file its key names and
  reads `PLAN.md` for key `1` when `PLAN-1.md` is absent; and a `- **Files:**`
  line in a task body contributes nothing to either face.

### Task 2: What a declared file set touches

- **Files:** cadence-core/bin/lib/risk-diff.mjs (beside `scanDiff`),
  cadence-core/bin/risk-diff.test.mjs
- **Action:** Export a second pure function beside `scanDiff` that answers what
  a DECLARED FILE SET touches: the caller hands it the declared paths, each with
  the body it could read (or nothing), plus the category vocabulary, and it
  returns matches in the same `{category, signal}` shape `scanDiff` returns -
  the shape a fire site can state a reason from. It reads the same tables this
  file already holds: `SEGMENT_SIGNALS`, `FILE_SIGNALS` and `EXT_SIGNALS` over
  the paths through the existing `segmentsOf` and `baseAndExt` helpers, and
  `CONTENT_SIGNALS` over the bodies, in that same order, so one signal ordering
  serves both faces rather than two copies drifting. `scanDiff` itself does not
  change. A declared path with no readable body contributes its PATH signals and
  no content signals, and that is not an inconclusive state: at plan time a
  declared file frequently does not exist yet because the plan creates it, and
  calling an absent body unjudgeable would raise every create-a-file plan, which
  is the raise-tax the retired floor died of (D-13). The two signal-table files
  - `cadence-core/bin/lib/risk-diff.mjs` and
  `cadence-core/bin/lib/surface-scan.mjs` - are exempt from the CONTENT pass
  (D-01): a whole-body scan of a signal table matches its own patterns by
  construction, which is self-reference and not evidence. Say in the doc comment
  that the exemption is scoped to this whole-body plan-time pass and does not
  reach `scanDiff`, whose header rule - fix at the MENTION, never a path or
  filename exemption - is about a hunk-scoped read of a diff and stays in force
  unedited. Never add a category-NAME keyword pattern; the measured false
  positives in this file's header are why. Measured on all 48 PLAN files in this
  repo and worth preserving: path signals alone match 0, the body pass matches
  39.
- **Verify:** `node --test cadence-core/bin/risk-diff.test.mjs` passes with
  cases pinning: a declared `src/auth/session.rs` with no body matches `auth` by
  path segment; a body carrying a `JSON.parse` call matches `untrusted_input`
  when that category is in the vocabulary and matches nothing when it is not;
  the real bytes of `cadence-core/bin/lib/risk-diff.mjs` supplied as that same
  path yield no content match while the identical bytes supplied under another
  path do; a null, a scalar and an absent body each report rather than throw;
  and every pre-existing `scanDiff` case in the file still passes unchanged.

### Task 3: The resolve returns a floored level

- **Files:** cadence-core/bin/route.mjs (`resolve`, and the header block that
  today declares THERE IS NO RISK FLOOR), cadence-core/bin/route.test.mjs,
  cadence-core/bin/config-seams.test.mjs (the retired-`risk.override` case),
  cadence-core/config.schema.json (`stakes`)
- **Action:** Make `stakes` the floor and the phase's declared files the raise.
  The configured level is the baseline: read the phase's declared files with
  task 1's reader (the phase union - the per-plan key arrives in task 5), scan
  them with task 2's function scoped to the `surfaces` list this function
  already resolves through `answeredSurfaces` (D-10 - answered means the user's
  narrowed set, unanswered means every category the table names, which is the
  same value `execute.md` already hands the executor as its bar), and take the
  higher of the baseline and the computed raise through `TABLE.stakes_order`.
  Declared paths are repo-relative, so their bodies are read relative to the
  planning root's PARENT - `resolve` already derives `planningRoot` from
  `opts.file`, and the repo root is that directory's parent, which is what keeps
  a `--file` pointed at another tree from reading this one's files. A body that
  cannot be read is not an error here (task 2 states why); a plan that cannot be
  read is, and task 4 owns it. The raise target on a match is `shipped`,
  deliberately not `critical`:
  criterion 3 requires only that a matched phase resolve no lower than today's
  `shipped` default, while raising every match to `critical` would put 39 of
  this repo's 48 plans on the top row and rebuild the raise-tax D-13 names. An
  UNSET `stakes` is a floor of `solo` and the raise does the work (D-02); an
  explicit `stakes` is a floor that is never resolved below, at any level. The
  roles dispatched BEFORE a plan exists - `cad-planner` and
  `cad-assumptions-analyzer` - read no plan and resolve at the configured
  stakes: the cursor lags (`context.md` dispatches the analyzer while the cursor
  still names the previous phase), so a floor computed for them is computed off
  a DIFFERENT phase's file list, which is not a safe-direction superset and
  which no reason string would reveal as wrong. Every move is stated: push
  `risk floor: `-prefixed entries onto the existing `reason` array naming the
  phase, the surface, the file that evidenced it and the level it moved from and
  to, and relay the reader's warnings onto the existing `warnings` array, which
  is already built before this point for exactly that purpose. If
  `TABLE.stakes_order` cannot place both levels, keep the baseline and say so in
  `warnings` - a reason claiming a baseline is "already at or above" a floor it
  could not compare is a flatly false sentence this seam has emitted before.
  Rewrite the header block that currently states THERE IS NO RISK FLOOR and the
  `--phase` sentence under it, and update the `stakes` and
  `review.triggers.risk_surface.surfaces` lines in the config-keys-read list, so
  the file stops stating the opposite of what it does. In
  `config.schema.json`, leave `stakes`'s `default` at `shipped` - that is the
  value D-04 fails closed to - and rewrite its `purpose` to say it is the FLOOR
  a phase resolves at or above, that an unset key floors at `solo` when the
  phase's plans were read clean, and that the declared files raise it.
  `config-seams.test.mjs`'s case proving a retired `risk.override.auth` routes
  nothing now has an `auth` path in its plan that legitimately raises the level:
  keep it proving the RETIRED KEY moves nothing and warns, and re-point its
  level assertion at what the floor alone yields.
- **Verify:** `node --test cadence-core/bin/route.test.mjs
  cadence-core/bin/config-seams.test.mjs` passes with cases pinning: with
  `stakes: critical` and a phase whose declared files touch no surface, the
  resolve returns `stakes: critical` (AC1); with `stakes` unset and a phase
  whose declared files touch no answered surface, it returns `solo`; with
  `stakes` unset and a phase declaring a file on an answered surface, it returns
  `shipped` and `reason` carries a `risk floor:` entry naming the surface and
  the file; with `stakes: solo` the same phase still returns `shipped`; a
  `cad-planner` resolve for that same risky phase returns the configured level
  with no `risk floor:` entry; and an injected table whose `stakes_order` cannot
  place the levels returns the baseline with a warning rather than a false
  "already at or above" reason.

### Task 4: A plan it cannot read fails closed

- **Files:** cadence-core/bin/route.mjs (the floor path added in task 3),
  cadence-core/bin/route.test.mjs
- **Action:** Close the direction that matters. A PLAN the resolve cannot read
  yields `ok:true` at the CONFIGURED stakes - `shipped` when no layer set the
  key - never below it and never `ok:false`, because an `ok:false` drops the
  caller to the base agent at the host session default, below every floor
  (`references/seams.md`'s routing bullet). The `solo` discount is earned only
  by a scope that was READ: apply D-04's aggregation over a multi-plan scope -
  every conforming `PLAN*.md` in the scope must have been found AND read clean
  before the level may resolve below the configured stakes, so one unreadable
  member forces the configured stakes for the whole scope and a mixed phase
  whose unreadable plan is the risky one can never resolve below today. A phase
  directory holding NO plan is the same arm: nothing was read, so nothing is
  discounted. Distinguish this in the record - a scope that read clean and
  matched nothing says so in `reason`, an unreadable or empty scope says the
  discount was withheld and why, so "no surface" and "no evidence" stop being
  the same sentence.
- **Verify:** `node --test cadence-core/bin/route.test.mjs` passes with cases
  pinning, all with `stakes` unset and each asserting `ok:true` and `stakes:
  shipped`: an absent phase directory; a phase directory with no PLAN file; a
  PLAN whose frontmatter is out of grammar; a PLAN whose file mode makes it
  unreadable; and a two-plan phase where one plan is clean-and-surfaceless and
  the other is unreadable. A sixth case pins the paired positive: the same
  two-plan phase with both plans clean and surfaceless returns `solo`.

### Task 5: An executor floors on its own plan

- **Files:** cadence-core/bin/lib/arg-contract.mjs (the `route.mjs` `resolve`
  row), cadence-core/bin/route.mjs (`parseArgs`, `RESOLVE_FLAGS`, `SYNOPSIS`),
  cadence-core/bin/arg-contract.test.mjs, cadence-core/bin/route.test.mjs
- **Action:** Add a plan-scope flag to `resolve` so the floor is per PLAN for
  executor dispatches and per PHASE for phase-scoped callers (D-06). Declare it
  in `CONTRACTS['route.mjs'].resolve` with the complete four-field grammar the
  table requires, typed `plan-key` so `lib/plan-key.mjs`'s existing predicate
  judges it - the same worker-key grammar `risk-check` reads - and refusing both
  a bad value and a bare flag, since a valueless plan flag would silently take
  the phase union for a caller that asked for one plan. Do NOT overload
  `--bracket-plan`: that value is the trace WORKER key and is the role name for
  every non-executor dispatch, so reading it as a floor key would make a
  phase-scoped role indistinguishable from a plan key that names no file, and
  the two must take different arms (union versus fail-closed). When the flag
  names a plan, the floor reads THAT plan's declared files through task 1's
  named-plan face; a key that resolves to no plan file takes task 4's
  fail-closed arm and says so. When the flag is absent the phase union stands.
  Update `SYNOPSIS` so the usage line states the flag.
- **Verify:** `node --test cadence-core/bin/route.test.mjs
  cadence-core/bin/arg-contract.test.mjs` passes with cases pinning: in a
  two-plan phase where one plan declares only a surfaceless file and the other
  declares a file on an answered surface, a resolve naming the clean plan
  returns `solo` (with `stakes` unset) while a resolve naming the risky plan and
  a resolve naming no plan both return `shipped`; a plan key naming no plan file
  returns `ok:true` at the configured stakes; a bare flag is refused; and the
  arg-contract census test passes with its entry count updated to the new total.

### Task 6: A malformed `--phase` is refused, not answered about another phase

- **Files:** cadence-core/bin/lib/arg-contract.mjs (the `route.mjs` `resolve`
  row and the header paragraph naming `--phase` as the `warn` case),
  cadence-core/bin/route.mjs (`parseArgs`), cadence-core/bin/arg-contract.test.mjs
  (the PINNED declarations table), cadence-core/bin/route.test.mjs
- **Action:** Now that the flag decides a floor and not only which phase a trace
  event is keyed to, flip its declared disposition from `warn` to `refuse` on
  both the value and the bare axes (D-09). The current warn-and-continue arm
  answers a typo by computing a floor from the cursor's phase - a different
  phase's file list - and the resolved bundle gives the caller nothing to notice
  it by. Refusing is loud at the call site and is the only disposition that
  cannot silently route a phase off another phase's plans. Rewrite the
  `arg-contract.mjs` header paragraph that names this flag as the `warn`
  exemplar, and the pinned row's rationale string in the test, so both state
  the new reason instead of the reversed one - the declaration is the contract,
  so a stale rationale beside it is the drift this table exists to end. An
  ABSENT flag still falls to the STATE cursor, unchanged.
- **Verify:** `node --test cadence-core/bin/route.test.mjs
  cadence-core/bin/arg-contract.test.mjs` passes with cases pinning: `resolve
  --role cad-executor --phase 1.10.3` returns `ok:false` with a usage-shaped
  refusal naming the flag and routes nothing; a bare trailing `--phase` does the
  same; a resolve with no `--phase` at all still resolves `ok:true` off the
  cursor; and the PINNED table row for `route.mjs resolve --phase` asserts
  `refuse` on both axes with a rationale naming the floor.

### Task 7: The call sites pass what the floor needs, and the seam says so

- **Files:** cadence-core/workflows/execute.md (the lifecycle-bracket paragraph
  on each executor's own resolve), cadence-core/workflows/plan.md (`check_gate`),
  cadence-core/references/seams.md (the Routing block and the Concurrent
  dispatch paragraph), cadence-core/bin/weight-budgets.json
- **Action:** Wire the two dispatch sites and correct the seam that describes
  them. In `execute.md`, the executor's own resolve gains the plan-scope flag
  beside the `--bracket-plan <k>` it already carries, so an executor floors on
  the plan it is being handed. In `plan.md`'s `check_gate`, the
  `cad-plan-checker` resolve gains an explicit `--phase {N}`: it resolves while
  the cursor still names the previous phase, so without it the checker is
  floored off the wrong phase's plans. In `seams.md`, the routing synopsis gains
  the new flag; the sentence "The stakes level a config layer set is the level,
  full stop" becomes the floor rule - the configured level is the minimum, the
  phase's declared `files:` read at resolve time can raise it, and a plan that
  cannot be read holds the configured level rather than dropping below it; and
  the Concurrent-dispatch paragraph's resolve-ONCE-per-(role, attempt) rule is
  amended for the executor case, where the plan scope is part of the routing
  input and the per-plan executors of a parallel phase each resolve their own.
  Do not restate the floor mechanism in the workflow files - one statement, in
  the seam, cited from the sites. Re-pin the byte row for every budgeted file
  this task edits in `weight-budgets.json`, in this same commit, from
  `node cadence-core/bin/weight.mjs`'s measurement rather than by hand.
- **Verify:** `node cadence-core/bin/self-verify.mjs --root .` returns
  `ok:true` with an empty `problems` array (this covers the flag-name lint over
  the edited prose and the byte budgets in one run), and `grep -n` on the three
  prose files shows the plan flag at the `execute.md` executor resolve, `--phase
  {N}` at `plan.md`'s `check_gate` resolve, and no surviving "the level, full
  stop" sentence in `seams.md`.

## Notes

- PLAN-1, PLAN-2 and PLAN-3 share declared files (`route.mjs`,
  `config.schema.json`, `weight-budgets.json` among them) and are therefore
  SEQUENTIAL, in number order, never parallel. The split follows CONTEXT.md's
  `Plan shape` directive and exists for task capacity, not for independence.
- Two planner choices recorded here because CONTEXT.md leaves them open. First,
  the raise target on a match is `shipped` rather than `critical`: AC3 requires
  only "no lower than today", and a measurement over all 48 PLAN files in this
  repo (path signals 0/48, body pass 39/48) says a `critical` target would floor
  39 of them, which is the retired detector's measured failure re-created.
  Second, a declared file with no readable body contributes path signals only,
  because a plan that CREATES a file has no body to read at plan time.
- The plan-scope flag is spelled as its own flag rather than reusing
  `--bracket-plan`, which CONTEXT.md's flagged assumption leaves to the planner
  and warns will bump the `arg-contract.test.mjs` entry-count pin. It will.
- `lib/retired-keys.mjs` is NOT edited by this plan or any other in this phase
  (D-03). Its eight `risk.override.*` detail strings say "there is no floor for
  a waiver to lower", which stops being true when this plan lands; the decision
  locks the file byte-identical and PLAN-2 pins it with a test, so the sentence
  stays. Flagged for the human, not for the executor.
