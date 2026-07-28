---
phase: 1
plan: 1
requirements:
  - RNG-01
files:
  - cadence-core/bin/lib/rung-agent.mjs
  - cadence-core/bin/rung-agent.test.mjs
  - agents/cad-planner.md
  - agents/cad-planner-xhigh.md
  - agents/cad-assumptions-analyzer.md
  - agents/cad-assumptions-analyzer-high.md
  - agents/cad-verifier.md
  - agents/cad-verifier-xhigh.md
  - agents/cad-executor.md
  - agents/cad-executor-xhigh.md
  - agents/cad-reviewer.md
  - agents/cad-reviewer-medium.md
  - agents/cad-reviewer-xhigh.md
  - agents/cad-plan-checker.md
  - agents/cad-plan-checker-high.md
  - cadence-core/bin/weight-budgets.json
  - cadence-core/route-table.json
  - cadence-core/bin/route.mjs
  - cadence-core/bin/route.test.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/references/seams.md
  - cadence-core/workflows/plan.md
  - cadence-core/config.schema.json
  - DESIGN.md
  - INTERNALS.md
  - README.md
  - skills/cad-planner-contract/SKILL.md
  - skills/cad-assumptions-analyzer-contract/SKILL.md
  - skills/cad-verifier-contract/SKILL.md
  - skills/cad-executor-contract/SKILL.md
  - skills/cad-reviewer-contract/SKILL.md
---

# Phase 1: The rung ladder - Plan

## Goal

Effort becomes a dial the routing layer can vary per role, by materializing
each single-sourced contract at the rungs it needs. Nothing downstream has to
work around a value frozen in one agent file.

## Must be true when done

- `cadence-core/route-table.json` declares the ladder as data: `rung_order`
  holds the five rungs beside `tier_order` and `profile_order`, each of the six
  roles carries a `rungs` array that contains its own `base_effort` and its own
  `escalate_to`, and no `escalate_effort_variant` key survives anywhere.
- All 13 agent names the table can produce exist as `agents/<name>.md` (6 base
  rungs at the unsuffixed name, 7 suffixed rungs), each one frontmatter plus a
  rung line plus a pointer at its contract skill and nothing else, with
  `effort:` equal to the rung its name declares.
- `route.mjs` resolves escalation through `escalate_to`: resolving
  `cad-plan-checker` under `auto` at `--attempt 2` still returns agent
  `cad-plan-checker-high`, effort `high`, `escalated: true`, and repointing
  `escalate_to` at a different rung moves the resolved agent name with it.
- `node cadence-core/bin/self-verify.mjs` reports `ok:false` naming the file
  when an agent that declares `skills:` carries a contract section tag in its
  body, and `ok:false` naming the role when a routable rung has no agent file
  or when `base_effort` / `escalate_to` falls outside that role's own `rungs`,
  and `ok:false` naming the file when a rung-suffixed agent file on disk names a
  rung its role does not declare - AC1's "exactly" is bidirectional, so a file
  the table stopped naming has to fail too, not only a name the tree lacks.
- `node cadence-core/bin/self-verify.mjs` on this repo reports `ok:true` with
  `agent-skills` still in its `checked` list, all 13 agent files carrying
  `weight-budgets.json` entries, and every rung file's contract skill resolving
  and model-invocable.
- No live surface names the retired mechanism:
  `grep -rn "escalate_effort_variant\|effort[- ]variant" --include="*.md" --include="*.json" --include="*.mjs" .`
  matches only under `.planning/` and in `CHANGELOG.md` - the character class
  covers the space spelling too, which is the only form one live surface uses.
- No surface still states a stale agent count or a single consumer per contract:
  `README.md`'s Cadence-vs-GSD figure names the post-phase agent-file count, and
  no `skills/cad-*-contract/SKILL.md` description claims exactly one subagent
  preloads it.
- `node --test cadence-core/bin/*.test.mjs` exits 0 and
  `npx tsc -p tsconfig.ci.json` exits 0.

## Context

CONTEXT.md D-01..D-14 bind this plan. Load-bearing: the base rung keeps the
unsuffixed filename and non-base rungs are `<role>-<rung>` (D-01); the rung set
is declared per role as data, not a cross product (D-02); `escalate_to` names
the escalation target and today's observable escalation is preserved verbatim
(D-03); `base_effort` values do NOT change this phase (D-07). Follow the
existing seam patterns: a pure `cadence-core/bin/lib/*.mjs` helper with its own
top-level `cadence-core/bin/<name>.test.mjs` (the `surface-weight.mjs` /
`shell-tokens.mjs` precedent), one-line JSON on stdout, `// @ts-check` with
JSDoc. Out of scope and not to be touched: the stakes enum rename and the
`fast`/`balanced`/`quality` vocabulary (phase 2), the `(stakes, role)` bundle
cell and wiring `fire(trigger)` to reviewer rungs (phase 3), issue #63's
`base_effort` rebase (phase 3), `.claude-plugin/plugin.json` and
`marketplace.json` (agent registration is directory-based, D-14), and
`CHANGELOG.md:43` (historical record, D-12).

## Tasks

### Task 1: The rung-to-agent-name mapping as one pure lib

- **Files:** cadence-core/bin/lib/rung-agent.mjs, cadence-core/bin/rung-agent.test.mjs
- **Action:** Create `lib/rung-agent.mjs` as a pure, zero-I/O module (no
  `fs`, no `emit`, no `process`) carrying `// @ts-check` and JSDoc on every
  export, since `route.mjs` and `self-verify.mjs` must not each spell the
  mapping rule for themselves - that divergence is exactly the
  resolved-then-silently-wrong class this repo keeps closing. Export three
  functions. `agentForRung(role, spec, rung)` returns `role` when
  `rung === spec.base_effort` and `` `${role}-${rung}` `` otherwise (D-01), with
  no validation and no throw - it is a name function, and the callers differ on
  what an invalid rung means. `rungAgents(role, spec)` returns the ordered,
  de-duplicated list of every agent name the table can produce for that role:
  `spec.base_effort` first, then each member of `spec.rungs` in declared order,
  then `spec.escalate_to`, each mapped through `agentForRung`; a missing or
  non-array `rungs` contributes nothing rather than throwing, so a malformed
  table still yields the base name. `rungIssues(role, spec, rungOrder)` returns
  an array of `{code, detail}` objects describing the declaration's own
  problems, with `detail` always beginning with the role name (AC4 requires the
  role named): code `rung-not-declared` when `rungs` is absent, not an array or
  empty, when `spec.base_effort` is not a member of `spec.rungs`, or when
  `spec.escalate_to` is absent or not a member of `spec.rungs`; code
  `unknown-rung` for each value among `spec.rungs`, `base_effort` and
  `escalate_to` that is not a member of `rungOrder`, and one
  `unknown-rung` naming `rung_order` itself when `rungOrder` is absent or empty.
  Return codes and details only - never a `problems` entry and never an emit;
  self-verify owns the problem envelope and the disk check. Write
  `bin/rung-agent.test.mjs` with `node:test` + `node:assert/strict`, ONE `test()`
  per grammar row rather than one loop over a table: the base-rung name, a
  non-base rung name, a `rungs` array whose order is preserved, the dedupe when
  `escalate_to` equals `base_effort`, a missing `rungs` key, an empty `rungs`
  array, `base_effort` outside `rungs`, `escalate_to` outside `rungs`,
  `escalate_to` absent, a rung outside `rung_order`, and an absent
  `rung_order`. (Prior-project evidence, CAPTURE.md phase 1: a 33-row table
  asserted inside one `test()` with a sequential loop reported 4 tests, not the
  per-row count its own verify named - so the rows are separate tests here.)
- **Verify:** `node --test cadence-core/bin/rung-agent.test.mjs` exits 0 and
  reports at least 11 tests (`# pass 11` or higher, `# fail 0`), and
  `npx tsc -p tsconfig.ci.json` exits 0.

### Task 2: Materialize all 13 rung files on one template, with budgets

- **Files:** agents/cad-planner.md, agents/cad-planner-xhigh.md, agents/cad-assumptions-analyzer.md, agents/cad-assumptions-analyzer-high.md, agents/cad-verifier.md, agents/cad-verifier-xhigh.md, agents/cad-executor.md, agents/cad-executor-xhigh.md, agents/cad-reviewer.md, agents/cad-reviewer-medium.md, agents/cad-reviewer-xhigh.md, agents/cad-plan-checker.md, agents/cad-plan-checker-high.md, cadence-core/bin/weight-budgets.json
- **Action:** Create the 6 missing rung files - `cad-planner-xhigh`,
  `cad-assumptions-analyzer-high`, `cad-verifier-xhigh`, `cad-executor-xhigh`,
  `cad-reviewer-medium`, `cad-reviewer-xhigh` - and bring all 13 onto one
  template, so the ladder has exactly one shape a future rung is copied from.
  This task lands BEFORE the route-table data (task 3) because task 3's
  ladder-consistency test reads these files off disk and cannot go green until
  they exist. Each file's frontmatter: `name:` equal to the filename stem;
  a one-sentence `description:` naming the rung and the role in the neutral
  form "The `<rung>` rung of `<role>`. Dispatched by the routing seam
  (`bin/route.mjs`) when the effort ladder resolves this rung; identical
  contract, different reasoning depth." - neutral because
  `cad-assumptions-analyzer-high` sits BELOW its base rung `xhigh`, so any
  "harder reasoning" phrasing would be false on that file, and short because
  every registered agent's name, description and tool list rides in the main
  session prompt (D-02); `tools:`, `disallowedTools:` and `color:` copied
  VERBATIM from the base sibling, since the preloaded contract is scanned as
  that agent's own prose by self-verify's tools lint and a dropped tool becomes
  an `undeclared-tool` problem; `effort:` equal to the rung in the name
  (`high`/`xhigh`/`medium`/`low` per the ladder in task 3); and `skills:` as a
  block list naming the single existing contract skill for the role
  (`cad-planner-contract`, `cad-assumptions-analyzer-contract`,
  `cad-verifier-contract`, `cad-executor-contract`, `cad-reviewer-contract`,
  `cad-plan-checker-contract`) - create no new skill and copy no contract prose.
  Each body is exactly two paragraphs, matching `agents/cad-plan-checker.md`
  today: `` Your rung is `<rung>`. `` then "Follow the preloaded
  `<skill-name>` skill exactly - it is your full contract. This file names that
  contract and your rung, and adds nothing else." Add the rung line to the 6
  base files that lack it so all 13 read alike, and rewrite
  `cad-plan-checker-high.md`'s description into the template form above (its
  current "High-effort escalation variant" wording names the mechanism being
  retired). Put no contract-skill section tag (`<role>`, `<stance>`,
  `<process>`, `<returns>`, `<guardrails>`, `<success_criteria>`,
  `<dimensions>`) in any body - task 4 makes that a CI failure, and it is the
  failure this whole design exists to prevent. Then update
  `cadence-core/bin/weight-budgets.json` so all 13 `agents/*.md` entries exist
  and each equals the file's exact measured byte count (the manifest's own
  convention: budgets equal current bytes, so unplanned growth fails CI); read
  the numbers from `node cadence-core/bin/weight.mjs`, never by estimate.
- **Verify:** `ls agents/*.md | wc -l` prints 13;
  `grep -L 'Your rung is' agents/*.md` prints nothing (every file carries the
  rung line); `grep -c '^effort:' agents/*.md` prints `:1` for all 13; and
  `node cadence-core/bin/self-verify.mjs` prints `"ok":true` with an empty
  `problems` array, which is what proves no `unbudgeted-surface`, no
  `budget-overrun`, no `undeclared-tool` and no `missing-agent-skill` for the
  new files.

### Task 3: Declare the ladder in route-table.json and resolve escalation through escalate_to

- **Files:** cadence-core/route-table.json, cadence-core/bin/route.mjs, cadence-core/bin/route.test.mjs
- **Action:** In `route-table.json` add `"rung_order": ["low", "medium",
  "high", "xhigh", "max"]` beside `tier_order` and `profile_order` (D-06; do
  not reuse the provider vocabularies in `config.schema.json` or
  `references/provider-api.md` - they carry `minimal` and lack `xhigh`/`max`).
  Give every role a `rungs` array and an `escalate_to`, deleting
  `escalate_effort_variant` entirely: `cad-planner` tier heavy, base_effort
  high, rungs `["high","xhigh"]`, escalate_to `high`;
  `cad-assumptions-analyzer` tier heavy, base_effort xhigh, rungs
  `["high","xhigh"]`, escalate_to `xhigh`; `cad-verifier` tier heavy,
  base_effort high, rungs `["high","xhigh"]`, escalate_to `high`;
  `cad-reviewer` tier heavy, base_effort high, rungs
  `["medium","high","xhigh"]`, escalate_to `high`; `cad-executor` tier
  standard, base_effort high, rungs `["high","xhigh"]`, escalate_to `high`;
  `cad-plan-checker` tier light, base_effort low, rungs `["low","high"]`,
  escalate_to `high`. Every `escalate_to` except the plan-checker's names that
  role's own base rung on purpose: D-03 preserves today's observable escalation
  verbatim and D-07 holds `base_effort` for this phase, so only the
  plan-checker's escalation may change the resolved agent - a heavier
  `escalate_to` here would silently re-route four roles and break the existing
  ceiling-held row at `route.test.mjs:110`. Rewrite `_meta.note` so it
  describes the rung ladder (`rungs` + `escalate_to`) instead of the
  effort-variant swap, and add a `_meta.rungs` line stating that a role's
  reachable rungs are declared per role rather than as a cross product and that
  each rung must have an `agents/` file. In `route.mjs`, import
  `agentForRung` from `./lib/rung-agent.mjs` and replace the
  `role.escalate_effort_variant` arm (`:117`) with: read `const target =
  role.escalate_to`; when `target` is set and differs from the current
  `effort`, set `escalated = true`, `agent = agentForRung(opts.role, role,
  target)`, `effort = target`, and push the reason
  `` `rung ${role.base_effort}->${target} (${agent})` ``; otherwise push
  `` `rung held at ${effort} (escalate_to ${target || 'unset'})` `` - mirroring
  the profile-held branch directly above it, which already reports a no-op
  honestly. Keep the fail-open posture: route.mjs must not validate rung
  membership or file existence (self-verify is the enforcer, task 4), and it
  must never throw on a malformed role spec. Rewrite the two comments at
  `:110` and `:131` to name the rung ladder rather than the effort variant. In
  `route.test.mjs`: rewrite the three test names and inline comments that say
  "effort-variant" (`:88`, `:119`, `:255`) to say "rung swap" while leaving
  their assertions byte-identical (AC5 requires those rows pass unchanged);
  replace the `escalate_effort_variant` test (`:339`) with a
  ladder-consistency test that walks `SHIPPED_TABLE.roles`, builds every
  routable name via `rungAgents`, and asserts the flattened unique set has
  exactly 13 members, each resolving to a real `agents/<name>.md`, each with
  `frontmatterEffort(name)` equal to the rung that produced it (D-09: route
  reports effort and cannot set it, so the file agreeing is the only thing that
  makes the report true); add a row asserting `table` now returns
  `rung_order` deep-equal to the five rungs; add a row that pins `escalate_to`
  as the SOURCE of the swap by writing a modified copy of the shipped table to
  a temp file with `cad-plan-checker.escalate_to` set to `xhigh` and `xhigh`
  added to its `rungs`, pointing `CADENCE_ROUTE_TABLE` at it, and asserting
  `--attempt 2` resolves agent `cad-plan-checker-xhigh` and effort `xhigh` (a
  name no code hardcodes); and add a row asserting a role whose `escalate_to`
  equals its base rung keeps its base agent - `cad-planner` at `--attempt 2`
  resolves agent `cad-planner`, effort `high`.
- **Verify:** `node --test cadence-core/bin/*.test.mjs` exits 0 with `# fail 0`
  and `npx tsc -p tsconfig.ci.json` exits 0;
  `node cadence-core/bin/route.mjs table` prints
  `"rung_order":["low","medium","high","xhigh","max"]` and a `rungs` array on
  each of the six roles; and
  `grep -c escalate_effort_variant cadence-core/route-table.json cadence-core/bin/route.mjs cadence-core/bin/route.test.mjs`
  prints `0` for each of the three files.

### Task 4: Two new self-verify checks - behaviour in a rung file, and a routable name with no file

- **Files:** cadence-core/bin/self-verify.mjs, cadence-core/bin/self-verify.test.mjs
- **Action:** Add both checks to `self-verify.mjs` as new problem kinds - no
  `CONTRACTS` entry, no new seam script (D-10). Check 7 (behaviour) goes inside
  the existing `agents/` walk beside checks 5 and 6, which already split
  frontmatter from body: when the frontmatter block contains a `skills:` key
  (test `/^skills:/m` against the captured frontmatter, the same key
  `parseSkillsField` reads), scan the BODY ONLY for
  `/<(role|stance|process|returns|guardrails|success_criteria|dimensions)>/g`
  and, if any match, push one problem per file of kind
  `agent-carries-behaviour` with `file` the agent's repo-relative path and
  `detail` naming every tag found in first-appearance order. Scan the body
  only, never the preloaded contract prose - the contracts legitimately use
  that whole vocabulary, which is the point of them. Gate on the `skills:` key
  rather than on file size: a 200-byte behavioural instruction fits under any
  budget, and gating on `skills:` keeps a future one-off agent with inline
  prose legal (D-04). Check 8 (routable names) is its own block after the walk,
  reading `cadence-core/route-table.json` root-relative like
  `config.schema.json` and `weight-budgets.json` - it iterates the TABLE, not a
  directory, so it cannot live inside the `agents/` walk; guard the read and
  the `JSON.parse` the way the `weight-budgets.json` block does (a malformed
  table pushes ONE `unreadable-surface` problem for
  `cadence-core/route-table.json` and the run continues, rather than unwinding
  `run()` into `{ok:false,reason:"internal"}` and discarding every problem
  found so far, the #49.1 collapse); an absent table skips the check, and an
  absent table under `isFullTree` pushes `missing-input` for
  `cadence-core/route-table.json`, matching the precedent the two other
  always-expected inputs set. For each role in the table, push one problem of
  the code `rungIssues(role, spec, table.rung_order)` returns (kinds
  `rung-not-declared` and `unknown-rung`, `file`
  `cadence-core/route-table.json`, detail as returned - the role is already
  named in it), then for each name from `rungAgents(role, spec)` push
  `missing-rung-agent` with `file` `cadence-core/route-table.json` and detail
  `<role> rung <rung> -> agents/<name>.md absent` when
  `agents/<name>.md` does not exist (D-05: route.mjs returns an agent name it
  never checks exists, so an unbuilt or mistyped rung must fail in CI rather
  than as a failed spawn). Then the reverse direction, which AC1's word
  "exactly" requires and the table->disk walk alone does not give: build the
  union of `rungAgents` over every role once, and for each `agents/*.md` whose
  basename parses as `<role>-<rung>` with `<role>` a role the table declares
  and `<rung>` a member of `rung_order`, push `undeclared-rung-agent` with
  `file` the agent's repo-relative path and detail
  `<role> does not declare rung <rung>` when that name is absent from the
  union. Match ONLY that rung-suffixed shape, never every file in `agents/`: a
  blanket "not named by the table" check would outlaw the future one-off agent
  with inline prose that D-04 deliberately keeps legal. Without this direction,
  adding `agents/cad-executor-max.md` with a matching budget entry - or, in
  phase 3, dropping `medium` from `cad-reviewer`'s `rungs` while
  `agents/cad-reviewer-medium.md` stays on disk - passes self-verify green
  while a stale rung file keeps paying standing context in every main-session
  prompt, the cost D-02's per-role declaration exists to bound. Append
  `agent-behaviour, rung-agents` to the
  `checked` string in the final `emit`, leaving `agent-skills` in place (AC7).
  In `self-verify.test.mjs`, extend `fixtureWith` with a `routeTable` option
  that writes the given object to `cadence-core/route-table.json`, and have
  `fullFixture()` write a minimal valid table (one role, `rung_order`, a
  matching agent file) so the full-tree rows do not accumulate unrelated
  `missing-input` noise. Add ONE `test()` per row, not a loop: a
  `skills:`-declaring agent whose body carries `<process>` is flagged
  `agent-carries-behaviour` naming the file; the same body WITHOUT the tag
  yields no such problem; an agent with no `skills:` key carrying `<process>`
  is NOT flagged (the escape hatch); the tag inside a preloaded SKILL.md is NOT
  flagged; a rung named in `rungs` with no agent file is flagged
  `missing-rung-agent` naming role and path; `base_effort` outside `rungs` is
  flagged `rung-not-declared` naming the role; `escalate_to` outside `rungs` is
  flagged the same way naming the role; a rung outside `rung_order` is flagged
  `unknown-rung`; a malformed `route-table.json` yields exactly one
  `unreadable-surface` for it and the later agents-walk problems still appear;
  a full tree with no `route-table.json` yields `missing-input` naming it; a
  rung-suffixed agent file naming a rung its role does not declare is flagged
  `undeclared-rung-agent` with the file named; and an UNSUFFIXED agent file the
  table names nowhere is NOT flagged (the D-04 escape hatch, so the reverse
  direction cannot creep into a blanket table-membership rule).
- **Verify:** `node --test cadence-core/bin/self-verify.test.mjs` exits 0
  reporting `fail 0` and `tests 40` or higher (the file holds 28 today, and the
  twelve rows above are separate `test()` calls); `node
  cadence-core/bin/self-verify.mjs` prints `"ok":true`, an empty `problems`
  array, and a `checked` string containing both `agent-skills` and
  `rung-agents`; `mv agents/cad-reviewer-xhigh.md /tmp/ && node
  cadence-core/bin/self-verify.mjs` prints `"ok":false` with a
  `missing-rung-agent` problem whose detail contains
  `agents/cad-reviewer-xhigh.md`, then `mv /tmp/cad-reviewer-xhigh.md agents/`
  restores `"ok":true`; `cp agents/cad-executor-xhigh.md
  agents/cad-executor-max.md && node cadence-core/bin/self-verify.mjs` prints
  `"ok":false` with a `problems` array CONTAINING an `undeclared-rung-agent`
  whose `file` is `agents/cad-executor-max.md` (a budget problem for the same
  file is expected alongside it and does not satisfy this row), then
  `rm agents/cad-executor-max.md` restores `"ok":true`; and appending a line `<guardrails>` to
  `agents/cad-planner-xhigh.md` makes `node cadence-core/bin/self-verify.mjs`
  print `"ok":false` with `agent-carries-behaviour` naming that file, with
  removing the line returning `"ok":true`.

### Task 5: Rewrite every live prose surface that names the retired mechanism

- **Files:** cadence-core/references/seams.md, cadence-core/workflows/plan.md, cadence-core/config.schema.json, INTERNALS.md, DESIGN.md, README.md, skills/cad-planner-contract/SKILL.md, skills/cad-assumptions-analyzer-contract/SKILL.md, skills/cad-verifier-contract/SKILL.md, skills/cad-executor-contract/SKILL.md, skills/cad-reviewer-contract/SKILL.md, cadence-core/bin/weight-budgets.json
- **Action:** No self-verify check reaches these strings - they are neither
  config keys, script invocations nor `${CLAUDE_PLUGIN_ROOT}` paths - so
  shipping the key's deletion without them leaves prose describing a mechanism
  the code no longer has (D-12). In `references/seams.md`: rewrite the
  spawn-agent effort bullet (`:44-47`) so runtime escalation swaps to the
  role's rung file named by `escalate_to`, with the reachable rungs declared
  per role in `route-table.json`, and drop the "these exist only for roles
  whose base effort is below the escalation target" clause - all six roles now
  declare rungs; rewrite `:97` so the returned `agent` "may be a rung file
  other than the base"; rewrite `:107` so a pinned role still gets its
  escalated rung file. In `cadence-core/workflows/plan.md:207`, replace "(routing
  seam escalates it to the `-high` effort variant under `auto`)" with the rung
  spelling (the routing seam escalates it to its `high` rung file under
  `auto`). In `cadence-core/config.schema.json:19`, change the
  `model.overrides.cad-plan-checker` purpose tail "the effort-variant swap
  still applies" to "the rung escalation still applies" - edit only that
  string, no key, type, enum or default, because phase 2 owns the
  `model.profile` enum and a schema change here would collide with it. In
  `INTERNALS.md`, the "Model routing" paragraph at `:11` claims "One variant
  file, for the one role that needs it" - false the moment 13 rung files ship;
  rewrite that sentence and the swap sentence before it to describe the
  declared rung ladder (a rung file per reachable rung, listed as data in
  `route-table.json`, with CI refusing a rung the table names and the tree
  lacks), and leave the following paragraph's `fast`/`balanced`/`quality`
  vocabulary alone - that is phase 2's sweep. In `DESIGN.md`, which is a dated
  historical record self-verify deliberately excludes, do NOT restate its
  verified claims: at `:141` and `:352` replace only the retired identifier
  ("effort-variant files" / "swaps effort-variant") with the rung-file spelling
  so the vocabulary stops naming a key the code lacks, and append one dated
  bullet to the "Model routing" subsection of §6 in that section's own
  convention (the `⚠️ PARTIALLY REOPENED (2026-07-19)` bullet at `:364` is the
  model to follow): a `⚠️ SUPERSEDED (2026-07-28)` line recording that
  `escalate_effort_variant` was replaced by per-role `rungs` + `escalate_to`
  with 13 materialized rung files, and that a rung file carrying behaviour now
  fails self-verify. In `README.md:111`, the Cadence-vs-GSD sentence reads
  "Cadence is 23 skills, 7 agents, and about 3% of GSD's documentary mass,
  measured 2026-07-10 against GSD commit d010ea1" - the agent figure is a FILE
  count (`agents/` holds exactly 7 today) and task 2 makes it 13, so leaving it
  understates the repo's own front-page comparison by 6 files. Replace the
  agent figure with the ladder as it actually is - 6 agent roles across 13 rung
  files - taking the count from `ls agents/*.md | wc -l` at execution time
  rather than from this plan, and leave the skills figure, the 3% figure, the
  measurement date and the GSD commit alone: they are a dated measurement this
  phase does not re-run. In the five contract skills whose description says
  "preloaded into the cad-<role> subagent" (`cad-planner-contract`,
  `cad-assumptions-analyzer-contract`, `cad-verifier-contract`,
  `cad-executor-contract`, `cad-reviewer-contract`, each at `SKILL.md:3`),
  replace the singular with the rung-agent plural - "preloaded into the
  cad-<role> rung agents" - because each of those contracts is now preloaded by
  two or three rung files, and the model reads that description at
  skill-selection time. Phrase it so it stays true when phase 3 adds a rung,
  rather than enumerating the current files the way
  `cad-plan-checker-contract:3` does (leave that one alone: it names both of its
  agents and stays accurate). Each of those five edits changes the file's byte
  count, so update its `weight-budgets.json` entry to the new exact measured
  count from `node cadence-core/bin/weight.mjs` in the same task - a SKILL.md
  budget equals its exact current size, so a stale entry fails self-verify.
  Leave `CHANGELOG.md:43` untouched. Introduce no new
  dotted, family-rooted token (anything shaped like `model.rungs` would fail
  self-verify's config-key check), and keep `cadence-core/workflows/plan.md` at
  or under its 13874-byte budget entry - if the edit pushes it over, update that
  entry to the new exact measured byte count from
  `node cadence-core/bin/weight.mjs`.
- **Verify:** `grep -rn "escalate_effort_variant\|effort[- ]variant" --include="*.md"
  --include="*.json" --include="*.mjs" .` returns matches only under
  `.planning/` and in `CHANGELOG.md` - the character class is load-bearing, not
  cosmetic: the hyphen-only pattern this criterion was written with already
  exits 1 against `cadence-core/workflows/plan.md` TODAY, before any edit,
  because `:207` spells it "the `-high` effort variant" with a space, so the
  narrow pattern cannot falsify the one plan.md edit this task owns;
  `grep -n "One variant file" INTERNALS.md` returns nothing;
  `grep -n "SUPERSEDED (2026-07-28)" DESIGN.md`
  returns one line; `grep -n "7 agents" README.md` returns nothing while
  `grep -c "23 skills" README.md` still returns 1 (the skills figure and the
  dated GSD measurement are deliberately untouched); and
  `grep -n "^description:.*\bsubagent\b" skills/cad-*-contract/SKILL.md`
  returns nothing - it lists exactly those five description lines today and
  already skips `cad-plan-checker-contract`, whose plural "subagents" the word
  boundary excludes, so it falsifies precisely the five edits and nothing else
  (do NOT count `subagent\.` file-wide instead:
  `cad-assumptions-analyzer-contract` carries a second, legitimate one in its
  body, so that pattern would still report 1 after a correct edit);
  `node cadence-core/bin/self-verify.mjs` prints `"ok":true`
  with an empty `problems` array; and `node --test cadence-core/bin/*.test.mjs`
  exits 0 with `npx tsc -p tsconfig.ci.json` exiting 0.

## Notes

- **Plan shape honored.** One PLAN.md, as the CONTEXT directive specifies. The
  independence test agrees: tasks 3 and 5 both consume the ladder data, tasks 3
  and 4 both import `lib/rung-agent.mjs`, and task 4's repo-passes-self-verification
  row cannot go green until task 2's 13 files exist - so no slice is
  file-independent and `plan-overlap` would refuse a split.
- **Flagged assumption resolved (DESIGN.md).** DESIGN.md IS a historical
  record: `:141` sits in §4's dated "Rough magnitude" estimate and `:352` in a
  `✅ VERIFIED (claude-code-guide, 2026-07-10)` bullet, and self-verify's own
  header excludes DESIGN/LINEAGE/CHANGELOG as historical docs that may name cut
  keys while explaining the cut. But §6's stated convention for a reversal is a
  new dated marker bullet in the same subsection (`⚠️ PARTIALLY REOPENED
  (2026-07-19)`), not silence - so task 5 retires only the identifier in those
  two lines and records the supersession as a dated bullet. AC3's grep spans
  `*.md`, so leaving the identifier there would fail the phase's own acceptance
  criterion.
- **D-11 arithmetic.** D-11 says "each of the 7 new agent files" needs a budget
  entry; the tree already holds 7 agent files including
  `cad-plan-checker-high.md`, so 6 files are new. Task 2 enforces AC7's actual
  invariant instead: all 13 have entries, and every entry equals the exact
  measured byte count.
- **Discretionary choice: one template across all 13.** D-01 only requires the
  base files to survive. Task 2 also adds the `` Your rung is `<rung>`. `` line
  to the 6 base files and normalizes `cad-plan-checker-high.md`'s description,
  so the ladder has exactly one shape rather than two. Cost: 7 extra tiny edits
  and their budget numbers, all caught by self-verify if missed.
- **AC5 names one row it cannot keep (checker WARNING, folded).** AC5's letter
  lists `route.test.mjs:339` among the four escalation rows that "pass
  unchanged", but that test builds its subject from
  `r.escalate_effort_variant` and asserts `variants.length > 0`, while roadmap
  criterion 2 requires that key deleted - so the row cannot survive this phase
  by construction, and rewriting it in place cannot preserve an assertion on a
  key that is gone. Task 3 replaces it. AC5's operative claim is untouched:
  `resolve('cad-plan-checker', autoCfg, ['--attempt','2'])` still returns
  `cad-plan-checker-high` / `high` / `escalated: true`, pinned by the three
  unchanged rows (`:88`, `:119`, `:255`) plus the new `escalate_to`-as-source
  row. At /cad-verify, read AC5 as three unchanged rows plus the replacement.
- **Deviation from D-10's placement, not its substance.** D-10 says both checks
  are new problem kinds inside self-verify's existing single `agents/` walk. The
  behaviour check is; the routable-name check iterates `route-table.json`
  rather than a directory, so it lands as its own guarded block after the walk.
  D-10's operative claim holds: no `CONTRACTS` entry, no new seam script.
- **INTERNALS.md added to D-12's list.** D-12's file list omits it, but
  `INTERNALS.md:11` names the retired mechanism and its "One variant file, for
  the one role that needs it" claim becomes false in this phase. D-12's own rule
  ("every prose surface naming the retired mechanism") covers it; the
  spend-vocabulary paragraph below it stays for phase 2.
- **Recalled prior-project findings weighed and left out.** Two known
  under-reporting defects in the surfaces this phase touches - `mdFiles`'
  `yield d; continue` fallback misnaming an unreadable child as its directory
  (`self-verify.mjs:123`), and `surface-weight.mjs`' `entries()` returning `[]`
  for a whole subtree on the first `EACCES` (`:38`) - are real but belong to no
  CONTEXT decision here, so no task touches them. Recording them so a later
  cycle picks them up rather than rediscovering them.
- **README DOES drift; task 5 owns it.** An earlier draft of this note claimed
  README makes no claim about the agent count. It does: `README.md:111` reads
  "Cadence is 23 skills, 7 agents", a file count task 2 takes to 13. Task 5
  corrects the agent figure only and leaves the skills figure, the 3% figure and
  the dated GSD measurement alone. No self-verify check counts agents, so
  nothing mechanical would have caught this. The user-facing rewrite of the
  routing vocabulary still belongs to phase 2's stakes rename.
- **Plan review (adjudicated) applied.** The `plan` trigger ran two reviewers
  (`cad-reviewer` + cross-model `openai/gpt-5.4-mini`, mode adjudicated). Four
  findings were grounded and folded into the tasks above: the README count
  (task 5), the AC3 grep pattern that cannot match the space spelling at
  `workflows/plan.md:207` (task 5 verify), AC1's missing disk->table direction
  (task 4's `undeclared-rung-agent`, scoped to the rung-suffixed shape so D-04's
  escape hatch survives), and the five singular contract descriptions (task 5).
  Both reviewers converged on `route.test.mjs:339`, already recorded above. Two
  findings were killed as overstatements against the files: that extending
  `fixtureWith` with a `routeTable` option is not incremental (the option is
  ordinary helper work and task 4 specifies it), and that the `escalate_to`
  pinning row cannot falsify live routing (task 3 replaces the
  `escalate_effort_variant` arm at `route.mjs:117` in the same task as the row).
- **Standing-context cost is visible on purpose.** The 6 new registrations put
  6 more name/description/tool triples in every main session prompt (D-02);
  their `weight-budgets.json` entries are where that cost is recorded and
  bounded.
