---
phase: 2
plan: 1
requirements: [CTX-01]
files:
  - .planning/REQUIREMENTS.md
  - .planning/phases/2/MEASUREMENTS.md
  - INTERNALS.md
  - cadence-core/bin/lib/deferred-reads.mjs
  - cadence-core/bin/lib/frontmatter.mjs
  - cadence-core/bin/lib/resident-weight.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/weight-budgets.json
  - cadence-core/bin/weight.mjs
  - cadence-core/bin/weight.test.mjs
  - cadence-core/references/seams.md
  - skills/cad-land/SKILL.md
  - skills/cad-plan-review/SKILL.md
---

# Phase 2: Context reduction - Plan

## Goal

The bytes the main thread carries per command are budgeted and cut where the
measurement says they are worst, and the always-resident surfaces stop being the
ones nobody measures.

## Must be true when done

- Asking the plugin what one command carries returns an answer: for any
  `/cad-*` command, the eager bytes the host injects before the first turn and
  the reachable bytes its own prose can pull in mid-run; for any dispatch role,
  the bytes the agent file plus its preloaded contract skills put into a fresh
  subagent context. Both come from one command, and both match a hand sum of
  the same files.
- `/cad-land` is no longer the heaviest command in the plugin by eager bytes:
  it carries less than the average of `/cad-execute`, `/cad-plan` and
  `/cad-verify`, and `/cad-plan-review` carries at least 15,134 B less than it
  did.
- Nothing that stopped being preloaded became unreachable: every reference this
  phase de-preloaded is Read by name at the step that needs it, and a check
  fails if that Read sentence is ever removed while the reference stays
  de-preloaded.
- `self-verify` still returns `ok:true` on the whole tree, with the new
  subcommand declared in its contract table and the new deferral check in its
  `checked:` list, and `node --test cadence-core/bin/*.test.mjs` plus
  `tsc -p tsconfig.ci.json` stay green.
- The before and after numbers are on disk in `.planning/phases/2/MEASUREMENTS.md`
  for the five commands and every dispatch role, the 26,095 B of budgeted
  references that never enter any model context are marked there as
  zero-resident rather than counted as a saving, and re-running the command the
  file names reproduces its "after" bytes exactly.
- The break-even rule the cut was made under says in the tree what the cut
  actually did, and the phase's own scope corrections in ROADMAP and
  REQUIREMENTS survive an `/cad-audit`: `CTX-01` traces to this plan with no
  `unpicked` break and `phases/2/PLAN.md` is no longer an orphan, leaving no
  Active id this phase owns unserved.

## Context

Locked decisions that bind this plan: D-01 (the `references/**` budget already
shipped as BUD-02 - do not re-budget it), D-02 (`panel-review` is not in this
codebase - `cad-plan-review` is the second surface), D-03 (the 2.4x figure is
runtime billed-equiv and out of scope), D-04 (report eager AND reachable, the
`@`-include graph is one level deep), D-05 (orchestrator and dispatch bytes are
never summed), D-06 (CTX-02 deferred - ship no writing contract and no
minimalism lens), D-07 (the cut is load order, never a prose rewrite), D-08
(`weight.mjs` gains the composition and its first CONTRACTS entry, reusing
`parseSkillsField`), D-09 (zero-resident references are marked, never counted as
a saving), D-10 (ROADMAP/REQUIREMENTS were corrected in place at context time -
this plan verifies, it does not re-edit them).

Patterns to follow: `cadence-core/bin/lib/merge-warnings.mjs` +
`self-verify.mjs` check 12 is the shape for a new check (pure lib, self-verify
decides only where it applies); `lib/surface-weight.mjs` is the shape for a pure
measurement lib; `skills/cad-land/SKILL.md:84-92` and `:105-113` are the
template for a deferred Read with its reasoning stated inline.

Measured at plan time (2026-08-08, live tree, all five eager figures reproduce
CONTEXT's): eager `cad-land` 32,676 · `cad-execute` 25,017 · `cad-verify`
20,136 · `cad-plan-review` 17,511 · `cad-plan` 16,438; workhorse mean 20,530.
`references/review-triggers.md` 15,134 B, `references/git-guard.md` 6,446 B,
`skills/cad-land/SKILL.md` 11,096 B, `skills/cad-plan-review/SKILL.md` 2,377 B.
`weight-budgets.json` holds 93 entries at exact current byte counts, so any
prose edit needs its entry regenerated in the same commit.

## Tasks

### Task 1: Compose per-command and per-dispatch resident bytes as a pure lib behind a `resident` subcommand

- **Files:** `cadence-core/bin/lib/resident-weight.mjs`,
  `cadence-core/bin/lib/frontmatter.mjs`, `cadence-core/bin/self-verify.mjs`,
  `cadence-core/bin/weight.mjs`, `cadence-core/bin/weight.test.mjs`
- **Action:** Create `lib/resident-weight.mjs` as a pure measurement module in
  the shape of `lib/surface-weight.mjs` - `// @ts-check`, `'use strict'`, no
  `emit`, no `process.exit`, no `Date`, no randomness, node builtins only.
  Export `residentWeight(root)` returning
  `{ commands: [...], roles: [...], zeroResident: [...], zeroResidentBytes: <n> }`.
  A COMMAND is a directory under `skills/` holding a `SKILL.md` whose
  frontmatter does NOT carry `user-invocable: false` - that excludes exactly the
  six `*-contract` skills, which are dispatch prose and are accounted on the
  roles side instead (D-05: the two are reported side by side, never summed).
  Each command entry is
  `{ command, eagerBytes, eagerFiles: [{surface, bytes}], reachableBytes, reachableFiles: [{surface, bytes}] }`.
  EAGER is the SKILL.md plus every path matched by
  `@${CLAUDE_PLUGIN_ROOT}/<relpath>` at the start of a line in that SKILL.md,
  resolved as `join(root, relpath)`; resolve ONE level only and say so in the
  header - a grep of `cadence-core/workflows/*.md`,
  `cadence-core/references/*.md`, `cadence-core/templates/**` and `agents/*.md`
  returns zero `@`-include lines, so an include cannot itself include (D-04),
  and a recursive resolver would be machinery for a graph that does not exist.
  REACHABLE is the eager set plus every `cadence-core/{references,templates,workflows}/<file>`
  that the TEXT OF THE EAGER FILES names and that exists on disk, matched in
  both the `${CLAUDE_PLUGIN_ROOT}/cadence-core/<branch>/<file>` form and the
  bare `<branch>/<file>` citation form; do NOT take a transitive closure past
  that one hop - a closure over named surfaces collapses to ~231 KB for every
  command and destroys the ranking the measurement exists to show (measured at
  plan time). Say in the header that reachable is ONE HOP FROM THE EAGER SET, so
  de-preloading a file moves that file's OWN citations out of the set even
  though the model still reads it at the step and can still follow them: a
  reachable drop under this definition is not by itself a saving, and task 8
  must say which part of any drop is this artifact. Measured at plan time,
  simulating the cut: `cad-plan-review` reachable falls 37,764 -> 17,511 and all
  20,253 B of that is `references/triage-gate.md` (3,050) plus
  `references/seams.md` (17,203) leaving the one-hop set because
  `review-triggers.md`, which cites them, stopped being eager; `cad-land`
  reachable is unchanged at 57,540 because its own prose already cites both.
  A ROLE entry is one file under `agents/`:
  `{ role, agent, agentBytes, contracts: [{surface, bytes}], dispatchBytes }`,
  where the contract skills come from `parseSkillsField` - one reader, never a
  second frontmatter parser (D-08). Do NOT import it from `self-verify.mjs`:
  that file's entry block at its foot is bare, with no `import.meta` guard, so
  ANY import of it runs the whole tree lint and `lib/seam-io.mjs`'s `emit`
  writes self-verify's envelope to stdout before `weight.mjs` writes its own -
  verified live, `node -e "import('./cadence-core/bin/self-verify.mjs')"` prints
  an `ok:true` envelope - which breaks the one-JSON-object seam convention, this
  task's two-run determinism check and task 8's reproduction. MOVE the function
  instead: create `cadence-core/bin/lib/frontmatter.mjs` as a pure module
  (`// @ts-check`, `'use strict'`, no I/O, no `emit`, no top-level statements)
  exporting `parseSkillsField` with its doc comment and body carried over
  verbatim from `self-verify.mjs:326`; have `self-verify.mjs` import it from
  there and stop defining it, WITHOUT a re-export - a re-export from a file that
  emits on import keeps the same trap alive for the next caller. The move is
  behaviour-preserving and proved so in this task: `self-verify.mjs:693` and
  `:744` are the function's only callers in the tree, so nothing else resolves
  the old export. `resident-weight.mjs` imports the lib. Contract skills are
  resolved as `skills/<name>/SKILL.md`, and `role`
  is the first preloaded `*-contract` skill's name with `-contract` stripped,
  falling back to the agent's own basename when it preloads none, so the rung
  files group under their role without string surgery on filename suffixes.
  `zeroResident` is every file under `cadence-core/references/` that appears in
  NO command's reachable set, each `{surface, bytes}`, with `zeroResidentBytes`
  their sum - derive it, never hardcode it (D-09). Byte counts are whole-file
  UTF-8 lengths on both sides, frontmatter included, because that is what the
  host injects. Dedupe every accumulated set by `realpathSync` where it
  resolves, falling back to the joined path when it throws: a symlinked
  directory otherwise lets one physical file be summed twice under two logical
  paths (`.planning/CAPTURE.md`, phase 3). Guard every read and stat so an
  unreadable or dangling entry is skipped rather than thrown, and per ENTRY
  rather than per branch, so one bad descendant cannot empty a whole subtree -
  that is the `BUD-02` shape `lib/surface-weight.mjs:60-82` already carries and
  the one `weight.mjs` must not reintroduce. Sort `commands` by `command`,
  `roles` by `agent`, `zeroResident` and every file list by `surface`, so two
  runs on one tree are byte-identical. Then in `weight.mjs`: when
  `argv[0] === 'resident'`, emit
  `{ok:true, checked:'resident-weight', ...residentWeight(root)}`, honoring
  `--command <name>` and `--role <name>` as filters on the respective arrays
  (a name matching nothing emits `{ok:false, reason:'unknown-command'}` or
  `{ok:false, reason:'unknown-role'}` with the name in `detail`, which
  `seam-io.emit` mirrors to exit 1). Leave the no-subcommand invocation emitting
  the existing `{ok:true, checked:'surface-weight', surfaces}` untouched -
  `weight.test.mjs` and the phase's own tooling call it that way. Add the
  `resident` usage line to the `weight.mjs` header comment. Add tests to
  `weight.test.mjs` covering: the `resident` envelope shape and its sorted
  determinism (two raw runs byte-identical); `--command cad-land` eager equal to
  the sum of the files its own `eagerFiles` lists - assert against the envelope,
  never a fixed file count, or task 5's cut breaks this test; `--role
  cad-executor` returning EVERY agent grouped under that role - two at HEAD,
  `cad-executor.md` and `cad-executor-xhigh.md`, both preloading
  `cad-executor-contract` - with each entry's `dispatchBytes` equal to its own
  `agentBytes` plus the sum of its `contracts` bytes, asserted per entry against
  the envelope and never as one role-wide figure; a
  fixture root where a SKILL.md `@`-includes a path that does not exist, proving
  the missing file contributes 0 rather than throwing; a fixture where a
  `*-contract` skill is present, proving it is absent from `commands` and
  present under `roles`; an unknown `--command` returning `ok:false`; and the
  legacy no-subcommand output unchanged.
- **Verify:** `node --test cadence-core/bin/weight.test.mjs` passes with 0
  failures. `node cadence-core/bin/weight.mjs resident --command cad-land` and
  `--role cad-executor` each print one JSON line whose `eagerBytes` /
  `dispatchBytes` equal the `wc -c` sum of the files the same envelope lists in
  `eagerFiles` / `agentBytes`+`contracts` (AC1), the `--role` check applied to
  EACH of the two entries that role returns rather than to a single figure -
  each of those two runs piped
  to `wc -l` reports exactly 1, which is what fails if the lib ever imports
  `self-verify.mjs` again. Running `node cadence-core/bin/weight.mjs resident`
  twice and diffing the two outputs produces no difference.
  `node -e "import('./cadence-core/bin/lib/frontmatter.mjs')"` prints nothing on
  either stream, and `node cadence-core/bin/self-verify.mjs` prints `"ok":true`
  with `"problems":[]`, proving the `parseSkillsField` move was
  behaviour-preserving. `npx tsc -p tsconfig.ci.json` exits 0.

### Task 2: Give `weight.mjs` its first CONTRACTS entry and a prose surface that invokes it

- **Files:** `cadence-core/bin/self-verify.mjs`, `INTERNALS.md`,
  `cadence-core/bin/self-verify.test.mjs`
- **Action:** Add `'weight.mjs': { '*': ['--root'], resident: ['--command', '--role'] }`
  to the `CONTRACTS` table in `self-verify.mjs:102`, in the table's existing
  key order style. The entry is inert on its own - check 2 only fires on prose
  that INVOKES the script, and no shipped surface invokes `weight.mjs` today
  (D-08) - so also add a short `## What a command carries` section at the end of
  `INTERNALS.md`, after `## Pure core, thin seam`, stating that eager bytes are
  what the host injects before the first turn and reachable bytes are what the
  prose can pull in mid-run, that the two rank commands differently on purpose,
  and naming the invocation on its own physical line as
  `node cadence-core/bin/weight.mjs resident --root <repo root>`, plus a
  "Read the code:" line citing `cadence-core/bin/lib/resident-weight.mjs` and
  `cadence-core/bin/weight.test.mjs`. Write the invocation in the `resident`
  subcommand form only: check 2's tokenizer reads the word after the script name
  as the subcommand, so a bare `weight.mjs --root` line would parse `--root` as
  an unknown subcommand. Keep every backticked path in that section a real path
  (check 3b) and introduce no config-key-shaped tokens (check 1). Add a row to
  `self-verify.test.mjs` that builds a fixture whose prose invokes
  `weight.mjs resident --nope` and asserts an `unknown-flag` problem naming it,
  so the entry is proved to have teeth rather than merely present.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `"ok":true` with
  `"problems":[]`. Then the falsifier: remove the `resident:` SUB-key from the
  `'weight.mjs'` CONTRACTS entry while LEAVING `'*': ['--root']` in place, and
  re-running prints an `unknown-subcommand` problem naming
  `weight.mjs resident` against `INTERNALS.md`; restore the sub-key and it is
  `ok:true` again (AC2). Deleting the whole `'weight.mjs'` key is NOT the
  falsifier and proves nothing - `self-verify.mjs:489` reads
  `const contract = CONTRACTS[script]; if (!contract) continue;`, so an
  uncontracted script is skipped entirely and the run comes back `ok:true` with
  `problems:[]`, which reads as a pass. `node --test
  cadence-core/bin/self-verify.test.mjs` passes with 0 failures.

### Task 3: Record the pre-cut baseline in MEASUREMENTS.md

- **Files:** `.planning/phases/2/MEASUREMENTS.md`
- **Action:** Create the file with a `## Before` section only, generated from
  `node cadence-core/bin/weight.mjs resident` run at this commit - which is
  still pre-cut, so these are the true baseline bytes. Name the exact command in
  the file's opening lines and the sha it was measured at, phrased as "measured
  at `<sha>`, recorded in its child commit" - the run necessarily precedes the
  commit that writes this file, so the sha named is the PARENT and the file
  lands in the child; a bare "taken at `<sha>`" would point AC6 at a tree that
  does not contain the file. State on the same line that the child commit cannot
  move the numbers because `.planning/**` is outside the measured walk, which
  reads only `skills/`, `agents/` and
  `cadence-core/{references,templates,workflows}`. Tables:
  one row per command over all 23, with `eagerBytes` and `reachableBytes`,
  sorted by `eagerBytes` descending, and the five commands this phase is
  measured on (`cad-land`, `cad-plan-review`, `cad-execute`, `cad-plan`,
  `cad-verify`) marked; one row per agent file under `roles`, with its role,
  `agentBytes`, its contract skills and `dispatchBytes`. State the workhorse
  mean of `cad-execute`/`cad-plan`/`cad-verify` eager bytes as its own line,
  since that is the number AC3 is measured against. Add a `## Zero-resident`
  section listing the `zeroResident` entries with their total, stating in one
  sentence that these bytes are budgeted but enter no model context, so a cut
  there would move the main thread by zero and none of this phase's deltas may
  claim them (D-09). State in the file that orchestrator and dispatch bytes are
  reported side by side and never summed, because a dispatch lands in a fresh
  subagent context (D-05). Leave a `## After` heading with the single line "Filled
  in at task 8." - do not guess the numbers. Do NOT restate the 2.4x figure or
  any runtime billed-equiv number anywhere in the file (D-03).
- **Verify:** `.planning/phases/2/MEASUREMENTS.md` exists; its `## Before`
  `cad-land` eager row reads 32676 and its zero-resident total reads 26095, both
  matching `node cadence-core/bin/weight.mjs resident` run at that commit; the
  `## After` section is present and explicitly empty.

### Task 4: State the size term the break-even rule is missing

- **Files:** `cadence-core/references/seams.md`,
  `cadence-core/bin/weight-budgets.json`
- **Action:** In the **File round-trip (when the extra turn pays)** paragraph
  (`references/seams.md:216-235`), the deferred-read clause currently ends "so
  an eager `@`-include whose file is consulted on EVERY path is already at
  break-even and stays eager." That sentence, unamended, forbids the cut tasks 5
  and 6 make: `cad-land` fires `pre_ship` on every path and `cad-plan-review`
  fires `plan` on every path, so `review-triggers.md` is an every-path
  reference in both. It is also already wrong without this phase: `cad-land`
  ships a deferred `references/git-publish.md` read with its reasoning inline
  (`:84-92`, `:105-113`) on a step-4 path that always publishes, and the
  unamended clause forbids that shipped deferral too. Add the size term the rule
  omits, in four sentences at most, immediately after that clause, BOUNDED so it
  cannot license the next cut by assertion. State the comparison outright: an
  eager `@`-include costs its bytes times every remaining turn of the run, a
  deferred read costs one tool call inside a turn the command was already
  taking, so an every-path reference whose residency outweighs that one call is
  past break-even and defers anyway. Then name the case that stays eager
  whatever its size: a reference consulted at more than one distinct STEP, since
  no single deferred read covers it - mutually exclusive arms of ONE step count
  as one site, which is exactly why `cad-land` can defer `git-publish.md`
  (step 4a or 4b, never both) while `references/git-guard.md` stays eager at
  steps 1, 2, 3 and `<guardrails>`. Require the deferring skill to state, inline
  at the Read, the reference's measured bytes and its consult-site count. The
  bytes come from `weight.mjs resident`; the count is distinct consult STEPS,
  found by grepping the reference name and then reading which step each hit sits
  under, with mutually exclusive arms of one step counted once - a raw grep
  total is NOT the number and will disagree (both deferring skills return two
  prose hits against a stated count of one). So a deferral ships as a shown
  measurement rather than an assertion. SCOPE that inline-numbers requirement to
  deferrals made from this point forward, in the sentence itself - the three
  deferrals already shipped in `cad-land` (`git-publish.md` 4,611 B at `:84-92`
  and `:105-113`, `triage-gate.md` 3,050 B at `:50-61`) state neither figure, and
  an unscoped rule would be violated by three of the four rows task 7 registers
  on the very commit that writes it. Say so explicitly rather than leaving the
  contradiction for phase 6's sweep to file back. Name `weight.mjs resident` as what
  decides which side a given include is on. Do not
  reword or soften the two original clauses - this ADDS the third case, it does
  not reverse the first two, and the "folds into a turn the command was already
  taking" requirement still binds every deferral. Regenerate this file's entry
  in `weight-budgets.json` from `node cadence-core/bin/weight.mjs` in the SAME
  commit or check 4 goes red on a `budget-overrun`. `seams.md` is `@`-included
  by no skill, so this adds zero eager bytes anywhere; it does add to the
  reachable set of the commands that cite it, which task 8 must attribute rather
  than fold into the cut's delta.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `"ok":true` with
  `"problems":[]` (proves the regenerated budget entry matches the new size).
  `grep -c 'break-even' cadence-core/references/seams.md` is at least 2, and the
  amended paragraph names `weight.mjs resident`, names `git-guard.md` as the
  multi-step case that stays eager, and states the bytes-and-consult-count
  requirement - so the added rule cannot be read as licensing an unmeasured cut.

### Task 5: Defer `review-triggers.md` out of `cad-land`'s eager load

- **Files:** `skills/cad-land/SKILL.md`, `cadence-core/bin/weight-budgets.json`
- **Action:** Delete the
  `@${CLAUDE_PLUGIN_ROOT}/cadence-core/references/review-triggers.md` line from
  the `<execution_context>` block at `skills/cad-land/SKILL.md:20`, leaving the
  `git-guard.md` line at `:21` in place. Then, at step 3 ("Fire `pre_ship`"),
  add a Read instruction in the shape steps 4a and 4b already use for
  `git-publish.md` (`:84-92`, `:105-113`): name the reference in full
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/review-triggers.md` form,
  instruct the model to Read it at that step, and state the reason inline the
  way the git-publish paragraphs do, carrying the two numbers task 4's amended
  rule requires: the file is 15,134 B, larger than this whole skill, and it is
  consulted at exactly ONE step (state the count, not this skill's own current
  size - the same edit changes that size and would leave the sentence stale),
  and the read folds into the turn that fires the trigger as one extra tool call
  rather than an extra turn (`references/seams.md`, File round-trip, as amended
  in task 4). Cap the finished file at or under 14,000 B, the way task 6 caps
  its own: post-cut eager is this file plus `git-guard.md` 6,446, AC3's bar is
  the workhorse mean 20,530.33 (`cad-execute` 25,017, `cad-plan` 16,438,
  `cad-verify` 20,136 - no file of theirs is in this plan, so the mean does not
  move), so the file's true ceiling is 14,084 B and 14,000 keeps the margin
  whole rather than leaving the Read paragraph unbudgeted. Keep the
  `git-guard.md` include EAGER and state that decision nowhere in the file - it
  is consulted at step 1 (the base fallback), step 2 (the protected-branch guard
  on any commit), step 3 (atomic conventional commits) and in `<guardrails>`, so
  it is a genuinely every-path 6,446 B reference and deferring it buys nothing
  AC3 needs; the arithmetic is recorded in this plan's Notes instead of costing
  the skill bytes. Change NOTHING else about step 3's behaviour: the
  `git.auto_close` arm, the triage-gate branch, the at-most-one-re-fire rule and
  which arm the `git.auto_close` carve-out sits in are all untouched - this
  changes WHEN the bytes load, never which arm fires (`.planning/CAPTURE.md`,
  phase 2). Regenerate this file's `weight-budgets.json` entry from
  `node cadence-core/bin/weight.mjs` in the SAME commit.
- **Verify:** `node cadence-core/bin/weight.mjs resident --command cad-land`
  reports `eagerBytes` strictly less than the mean of the `eagerBytes` the same
  run reports for `cad-execute`, `cad-plan` and `cad-verify` - assert the
  inequality against the three values read from that same envelope, not against
  a fixed number (AC3). `wc -c skills/cad-land/SKILL.md` is at most 14000.
  `grep -c '^@' skills/cad-land/SKILL.md` is 1.
  `node cadence-core/bin/self-verify.mjs` prints `"ok":true` with
  `"problems":[]`.

### Task 6: Defer `review-triggers.md` out of `cad-plan-review`'s eager load

- **Files:** `skills/cad-plan-review/SKILL.md`,
  `cadence-core/bin/weight-budgets.json`
- **Action:** Delete the whole `<execution_context>` block at
  `skills/cad-plan-review/SKILL.md:27-29` including its trailing blank line -
  `review-triggers.md` is its only member, so the block has nothing left to
  hold. That removes 108 B from the SKILL.md. At step 2 ("Fire the `plan`
  trigger"), replace the bare citation `per references/review-triggers.md` with
  the full `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/review-triggers.md`
  path, an instruction to Read it at that step because the skill no longer
  preloads it, and the two numbers task 4's amended rule requires of any
  deferring skill: 15,134 B, one consult site. Budget the wording: AC4 requires
  the eager load to drop by at least the full 15,134 B of the include, so the
  finished `SKILL.md` must be at or under its current 2,377 B - the 108 B the
  block gives back is the entire allowance. It fits, measured at plan time: the
  full path form costs +37 B over the bare citation, leaving 71 B for the Read
  clause and the two numbers, and a drafted form ("- Read `<full path>` here,
  not preloaded (15,134 B, one site) -") lands the file at 2,358 B. Say it once,
  at step 2, and leave the `<objective>` citation at `:16` as the bare
  parenthetical it already is. Regenerate this file's `weight-budgets.json` entry from
  `node cadence-core/bin/weight.mjs` in the SAME commit.
- **Verify:** `wc -c skills/cad-plan-review/SKILL.md` is at most 2377.
  `node cadence-core/bin/weight.mjs resident --command cad-plan-review` reports
  `eagerBytes` at most 2377, i.e. at least 15134 below the baseline 17511
  recorded in MEASUREMENTS.md `## Before` (AC4).
  `node cadence-core/bin/self-verify.mjs` prints `"ok":true` with
  `"problems":[]`.

### Task 7: Make a de-preloaded reference without a Read instruction a self-verify failure

- **Files:** `cadence-core/bin/lib/deferred-reads.mjs`,
  `cadence-core/bin/self-verify.mjs`, `cadence-core/bin/self-verify.test.mjs`
- **Action:** Create `lib/deferred-reads.mjs` in the shape of
  `lib/merge-warnings.mjs`: a pure rule module with `// @ts-check`,
  `'use strict'`, exporting a frozen `DEFERRED_READS` register and
  `deferredReadIssues(root)` returning `{ kind, file, detail }[]`. The register
  is a stated table, the same species as `CONTRACTS` and `RUNG_FILES` - one row
  per `{ skill, reference, read_paragraphs }` triple that a skill consults but
  deliberately no longer `@`-includes, where `read_paragraphs` is how many
  distinct paragraphs must carry the Read instruction. The field is named
  `read_paragraphs`, NOT `sites`, and the header comment must state why: task
  4's `seams.md` rule counts distinct consult STEPS with mutually exclusive arms
  counted once, so `git-publish.md` is ONE site there and TWO read paragraphs
  here. They are deliberately different quantities measuring different things,
  and a single name for both would have a maintainer "correct" one against the
  other - dropping an arm's Read from the check's coverage. Seed it with the four
  live pairs: `cad-land`/`references/review-triggers.md` (`read_paragraphs: 1`),
  `cad-land`/`references/git-publish.md` (`read_paragraphs: 2` - one consult site
  under task 4's rule, but each of step 4's arms carries its own Read and
  deleting either silently loses that arm's rails),
  `cad-land`/`references/triage-gate.md` (`read_paragraphs: 1`), and
  `cad-plan-review`/`references/review-triggers.md` (`read_paragraphs: 1`). Header comment states why
  the register is hand-maintained: whether a reference was REMOVED from an
  include is not derivable from a single tree snapshot, so the register is the
  record of the removal and the check is what holds the prose to it. For each
  row, read `skills/<skill>/SKILL.md` and raise: `deferred-read-unread` when
  FEWER SENTENCES than the row's `read_paragraphs` contain BOTH the full
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/<reference>` path and the word `Read`. The
  unit is the SENTENCE, not the blank-line block: `skills/cad-land/SKILL.md`
  lines 99-144 are a single ~2,900 B paragraph, so a block-level test passes when
  the real instruction is deleted as long as any other line in those 46 lines
  names the path and any unrelated `Read` survives - and `do NOT Read <path>`
  passes it identically. Split on sentence terminators followed by whitespace,
  and state that bound in the header comment;
  `deferred-read-still-eager` when the file still carries an `@`-include line
  for that reference, so a re-added include forces the register to be corrected
  instead of sitting silently redundant; and `deferred-read-missing-skill` when
  the SKILL.md is absent or unreadable. Scope the register to user-invocable
  command skills and say so - `cad-executor-contract` names
  `review-triggers.md` in a full path with no Read verb, and it is dispatch
  prose whose bytes never touch the main thread, so widening the rule to it
  would force a prose edit that ADDS bytes in the phase that exists to cut them.
  Wire it into `self-verify.mjs` as check 13 beside the check-12 call site,
  importing `deferredReadIssues` the way `mergeWarningIssues` is imported, and
  append its name to the `checked:` string the envelope reports. On a fixture
  root with no `skills/` directory the check must contribute nothing rather than
  raise, so a `--root` fixture stays usable. Add `self-verify.test.mjs` rows
  covering each of the three kinds against fixture roots, plus one proving a
  clean pair passes.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `"ok":true`, an
  empty `"problems"` array, and a `checked:` string containing the new check's
  name. Deleting the Read sentence added in task 5 from
  `skills/cad-land/SKILL.md` and re-running prints a `deferred-read-unread`
  problem naming `cad-land` and `references/review-triggers.md`; restoring it
  returns `ok:true` (AC5). `node --test cadence-core/bin/self-verify.test.mjs`
  passes with 0 failures.

### Task 8: Fill in the after numbers and prove the scope corrections hold

- **Files:** `.planning/phases/2/MEASUREMENTS.md`, `.planning/REQUIREMENTS.md`
  (the `seed-reqs` run below WRITES a Traceability row into REQUIREMENTS.md, so
  it must be declared here and in the plan frontmatter or `lease-check` refuses
  the commit as `undeclared-files` and the executor returns a `blocked`
  checkpoint - `planning.mjs:1603-1613` exempts only the plan's own report file.
  Phase 1's PLAN.md declares `.planning/CAPTURE.md` for the same reason.)
- **Action:** Replace the `## After` placeholder with the same three tables task
  3 wrote, regenerated from `node cadence-core/bin/weight.mjs resident` at this
  commit, plus a `## Deltas` subsection giving per-command eager and reachable
  change for the five measured commands and the recomputed workhorse mean, and
  stating in one line each: that `cad-land` eager is now below that mean (AC3),
  that `cad-plan-review` eager fell by at least 15,134 B (AC4), and that the
  zero-resident total is unchanged and excluded from every delta (D-09). Split
  every REACHABLE change into two named parts, because reachable is measured one
  hop from the EAGER set (task 1) and de-preloading a file therefore moves that
  file's own citations out of the set on its own: (i) the definition artifact -
  for `cad-plan-review`, the `references/triage-gate.md` + `references/seams.md`
  bytes (20,253 B at plan time; `seams.md` grew in task 4, so recompute from
  the run rather than copying that figure) that leave the one-hop set only because
  `review-triggers.md` stopped being eager, which the model can still reach by
  reading it at step 2, so it is NOT a saving anyone pays; and (ii) any real
  change left over. Attribute the reachable-byte increase that task 4's
  `seams.md` amendment causes on the commands citing it - `cad-land` among them
  - separately from the deferral deltas too, so the cut's delta is credited with
  neither. Name the exact reproduction command at the top of `## After` and the
  sha as "measured at `<sha>`, recorded in its child commit", for the same
  reason task 3 does: the run precedes the commit that records it, and
  `.planning/**` is outside the measured walk so the child commit cannot move
  the numbers. State that the file's dispatch numbers stand beside the command
  numbers rather than summing with them (D-05).
  Add a closing `## Scope corrections` section recording, with the line numbers
  they sit at, that ROADMAP phase 2's Success Criteria and REQUIREMENTS' CTX-01
  row already read the re-scoped scope and that CTX-02 sits under
  `## Deferred` - these were applied at context time under D-10, so this task
  verifies and records them rather than re-editing them. Run
  `node cadence-core/bin/planning.mjs seed-reqs --phase 2` unconditionally
  before the checks below and note in that section that it was seeded: audit
  already reports `CTX-01` as `unpicked` and `phases/2/PLAN.md` under
  `orphans.plan_ids` on the current tree (run live at plan time), so there is no
  branch to take, and the command is what writes the Traceability row that
  clears both.
- **Verify:** Re-running the command named at the top of `## After` and diffing
  its output against the numbers in the `## After` tables shows no discrepancy
  (AC6). `node cadence-core/bin/planning.mjs audit` returns `ok:true`; its
  `requirements` entry for `CTX-01` reads `"phase":2` and
  `"plan":"phases/2/PLAN.md"` with NO `"break":"unpicked"` (a
  `"break":"not-verified"` on that entry is expected and correct until the phase
  box is checked at UAT - `planning.mjs:873`); and `orphans.plan_ids` no longer
  lists `phases/2/PLAN.md` (AC7). The nine ids owned by phases 3-6 - `REC-01`,
  `REC-02`, `FRI-01`, `FRI-02`, `FRI-03`, `PRS-01`, `PRS-02`, `DOC-02`,
  `DOC-03` - stay `unpicked` and that is not this phase's failure: `unpicked`
  means "no Traceability row yet" (`planning.mjs:908`), `seed-reqs` writes one
  phase's rows at a time, and ROADMAP already assigns every one of them to a
  phase (`:118`, `:134`, `:148`, `:160`), so none is UNSERVED in AC7's sense.
  `grep -n 'CTX-02' .planning/REQUIREMENTS.md` shows it under `## Deferred` and
  not under `## Active`. Full gates green:
  `node --test cadence-core/bin/*.test.mjs` reports 0 failures,
  `npx tsc -p tsconfig.ci.json` exits 0, and
  `node cadence-core/bin/self-verify.mjs` prints `"ok":true` with
  `"problems":[]`.

## Notes

Structure follows the CONTEXT `Plan shape` directive: one plan. The
independence test agrees - `weight-budgets.json` is touched by tasks 4, 5 and 6,
`self-verify.mjs` by tasks 2 and 7, and `MEASUREMENTS.md` by tasks 3 and 8, so
no split is available that does not share files.

Deferring `review-triggers.md` alone satisfies AC3, checked at plan time as
CONTEXT asked. `cad-land` eager 32,676 minus the 15,134 B include is 17,542,
already below the 20,530 workhorse mean with roughly 3,000 B of headroom for
the Read paragraph task 5 adds. `git-guard.md` therefore stays eager: at 6,446 B
it is consulted at four separate sites across every path `cad-land` can take,
including the protected-branch guard on any commit, so on the break-even rule
(`references/seams.md`, File round-trip) it is the case that stays eager, and
deferring a guard reference on a command that commits buys AC3 nothing it does
not already have.

Task 4 is a planner-discretion addition, not an acceptance criterion. It exists
because `references/seams.md:228-229` currently states that an every-path
`@`-include stays eager, and both deferrals tasks 5 and 6 make are every-path -
so without it the tree contradicts its own stated rule the moment task 5 lands,
which is precisely the class of self-description defect this cycle
(`v2.5.0 — what Cadence says about itself`) exists to close, and which phase 6's
doc sweep would otherwise file back as a finding. The amendment is bounded on
purpose (task 4): stated as a bare size term it would license deferring
`git-guard.md` too, which task 5's own reasoning needs eager, so the rule names
the multi-step case that stays eager and makes the deferring skill show the two
numbers it deferred on.

D-08 says the composition reuses `parseSkillsField` rather than a second
frontmatter reader, and it still does - the function MOVES to
`cadence-core/bin/lib/frontmatter.mjs` and `self-verify.mjs` and
`resident-weight.mjs` both import that one copy. Importing it from
`self-verify.mjs`, which D-08's evidence line cites (`:688-711`), is not
available: that file's entry block carries no `import.meta` guard, so importing
it lints the whole tree and `seam-io.emit` prints a second JSON line - confirmed
live at revision time, `node -e "import('./cadence-core/bin/self-verify.mjs')"`
emits an `ok:true` envelope. One reader, one definition, no emitting importer.

`.planning/CAPTURE.md` items informing this plan: the phase-3 symlink
double-count item is closed by task 1's realpath dedupe; the phase-4 closed item
about `weight.mjs` under-reporting a whole subtree on one unreadable descendant
is the shape task 1 is instructed not to reintroduce; the phase-2 item about the
`git.auto_close` carve-out sitting in the generic `adjudicated` arm of
`review-triggers.md` is explicitly out of task 5's scope, which changes load
order only; and the phase-1 note that `review-triggers.md` grew to 15,436 B is
superseded by the live 15,134 B re-measured at plan time.

Reachable bytes are measured one hop out from the eager set, not as a transitive
closure. Measured at plan time: a closure over named surfaces returns roughly
231-247 KB for every command and inverts nothing, whereas the one-hop rule
reproduces the ranking inversion D-04 depends on - `cad-land` is heaviest of the
five under eager (32,676) and second-lightest under reachable (57,540, against
`cad-execute` 90,923 and `cad-verify` 89,388). One hop cuts both ways: a
de-preloaded file's OWN citations leave the reachable set as an artifact of the
definition, not as bytes anyone stopped paying. Re-measured at revision time by
simulating the cut, `cad-plan-review` reachable falls 37,764 -> 17,511 and every
one of those 20,253 B is `triage-gate.md` (3,050) + `seams.md` (17,203) moving
from one hop to two, while `cad-land` reachable does not move at all (57,540)
because its own prose cites both already - which is why task 8 reports that
split rather than a net number, on the same principle D-09 applies to the
zero-resident set.

`weight.mjs resident` run at plan time derives the zero-resident set
mechanically to exactly the three files D-09 names -
`references/config-reach.md` 18,412, `references/provider-api.md` 5,048,
`references/model-hints.json` 2,635, total 26,095 - so task 3 must not hardcode
that total.
