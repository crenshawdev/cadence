# Phase 1: The rung ladder - Context

Gathered: 2026-07-28
Feeds: /cad-plan 1

## Scope boundary

In: the effort rung ladder as declared data in `route-table.json`, 13
materialized rung files pointing at the v1.5.0 contract skills, `escalate_to`
replacing `escalate_effort_variant`, two new self-verify checks (a rung file
carrying behaviour, and a routable agent name with no file), a weight budget
per new file, and the rewrite of every prose surface naming the retired
mechanism.
Out: the stakes enum rename (phase 2); the `(stakes, role)` bundle cell
(phase 3); risk-driven rung floors (phase 4); issue #63's `base_effort`
rebase; wiring `fire(trigger)` to reviewer rungs (phase 3).
Deferred: None
Plan shape: one plan - splitting it serializes anyway (the prose sweep shares
`route-table.json` and `route.mjs` with the ladder, and the self-verify plan's
repo-passes-self-verification test cannot go green until the 13 files exist),
so `plan-overlap` would refuse the parallel path while adding a merge point

## Durable decisions

- D-01 (Ladder shape): The unsuffixed `agents/<role>.md` survives as that
  role's base rung; non-base rungs are `agents/<role>-<rung>.md`. Evidence:
  `cadence-core/bin/route.mjs:91` (`let agent = opts.role`),
  `cadence-core/references/seams.md` (`{ok:false}` -> dispatch the base
  `agent_name`), the existing `agents/cad-plan-checker.md` /
  `agents/cad-plan-checker-high.md` pair. If wrong: a routing failure becomes
  a spawn failure, because `route.mjs` never checks the name it returns
  exists on disk.
- D-02 (Ladder shape): The reachable rung set is declared as data - each
  `route-table.json` role gains a `rungs: [...]` array with `base_effort` and
  `escalate_to` required members - rather than a 6x5 cross product. Seeded
  from issue #63's rung table: planner `[high, xhigh]`, analyzer
  `[high, xhigh]`, verifier `[high, xhigh]`, executor `[high, xhigh]`,
  plan-checker `[low, high]`, reviewer `[medium, high, xhigh]` = 13 files
  (6 base + 7 suffixed, one of which already exists). Evidence: issue #63
  ("compute the reachable rung set from which roles each rigor level can
  actually dispatch, not a full cross product"),
  `cadence-core/bin/weight-budgets.json`, and the confirmed fact that every
  registered agent's name, description and tool list rides in the main
  session prompt - so a file costs standing context beyond its ~500 bytes.
  Phase 3 adds rows to the data without touching code.
- D-03 (Escalation): `escalate_to: "high"` names the escalation target per
  role, rather than stepping the rung ladder by N. Today's observable
  escalation is preserved verbatim. Evidence:
  `cadence-core/bin/route.test.mjs:88-94, 119-128, 255-265`;
  `cadence-core/bin/route.mjs:107-118`. The alternative (step-by-one on a
  five-rung order, mirroring `bumpTier`/`stepProfile`) would make
  `low -> medium` the escalation, weakening the last gate before execution
  and staling `cadence-core/workflows/plan.md:207`.
- D-04 (Behaviour check): "Behaviour" is a body containing any contract-skill
  section tag (`<role>`, `<stance>`, `<process>`, `<returns>`,
  `<guardrails>`, `<success_criteria>`, `<dimensions>`), checked only on
  agent files that declare a `skills:` frontmatter key. Evidence: the six
  contract skills under `skills/cad-*-contract/SKILL.md` use exactly that
  vocabulary; `cadence-core/bin/self-verify.mjs:402-511` already splits
  frontmatter from body in its `agents/` walk. A size-only check was rejected:
  a 200-byte behavioural instruction fits under any budget, so the check
  would miss the failure the phase is named after. Scoping to `skills:` files
  keeps a future one-off agent with inline prose legal, so the escape hatch is
  not "weaken the check for everyone".
- D-05 (Behaviour check): Self-verify asserts that every agent name the route
  table can produce - base rungs, escalation targets, every member of every
  `rungs` array - resolves to a file in `agents/`. Evidence: `route.mjs`
  returns an agent name it never checks exists, the same
  resolved-then-silently-wrong shape closed for `#64`, `#39`, `#43`. Without
  it, an unbuilt or mistyped rung surfaces as a failed spawn at dispatch time
  instead of in CI.

## Decisions

- D-06 (Ladder shape): The five rungs are written down as
  `rung_order: ["low","medium","high","xhigh","max"]` in `route-table.json`,
  beside `tier_order` and `profile_order`. Evidence: nothing in-tree
  enumerates them today; `cadence-core/config.schema.json:65` and
  `cadence-core/references/provider-api.md:22` are cross-model *provider*
  vocabularies (they carry `minimal`, lack `xhigh`/`max`) and must not be
  reused. Issue #63 states the host's five, matching the `effort` enum this
  session's `agent()` contract accepts.
- D-07 (Scope): `base_effort` values do not change in phase 1. Issue #63's
  rebase (planner/verifier/executor to `xhigh`, plan-checker to `high`) is
  phase 3's cell, not this phase's ladder. Evidence: `.planning/ROADMAP.md:73`
  gives phase 3 the `(stakes, role)` cells; holding `cad-plan-checker` at
  `low` keeps the four existing escalation test rows green.
- D-08 (Escalation): `agents/cad-plan-checker-high.md`'s runtime read of
  another agent file is already gone - v1.5.0's `#74` replaced it with a
  contract-skill pointer. Evidence: `agents/cad-plan-checker-high.md:12-15`.
  That clause of the phase's second success criterion is satisfied before
  work starts; only the `route-table.json` key and the `route.mjs` resolution
  remain.
- D-09 (Escalation): `route.mjs` still only *reports* effort and never sets
  it, so every rung the table can name needs a test asserting the agent
  file's frontmatter `effort` equals what route reports - generalizing the
  two consistency tests that exist. Evidence:
  `cadence-core/bin/route.test.mjs:309-345` ("route.mjs REPORTS effort; it
  cannot SET it. Effort is definition-time frontmatter on the spawn-agent
  seam"); `cadence-core/references/seams.md:44-47`.
- D-10 (Behaviour check): Both new checks are new problem kinds inside
  `self-verify.mjs`'s existing single walk of `agents/`, not new seam
  scripts, so neither needs a `CONTRACTS` entry. Evidence:
  `cadence-core/bin/self-verify.mjs:402-511` (checks 5 and 6 already share
  that walk); the `CONTRACTS` table at `:41-101` covers script invocations in
  prose only; `cadence-core/bin/self-verify.test.mjs:45-65`'s
  `fixtureWith({agents, skills, budgets})` is already the fixture shape.
- D-11 (Drift): Each of the 7 new agent files needs a hand-added
  `cadence-core/bin/weight-budgets.json` entry or the repo's own
  self-verification test fails. Evidence:
  `cadence-core/bin/self-verify.mjs:387-391` (`unbudgeted-surface`);
  `cadence-core/bin/lib/surface-weight.mjs:53-59` walks `agents/*.md`;
  `cadence-core/bin/self-verify.test.mjs:91-95` is the CI gate.
- D-12 (Drift): Phase 1 rewrites every prose surface naming the retired
  mechanism, rather than leaving them to phase 2's spend-to-stakes sweep:
  `cadence-core/route-table.json:3` (`_meta.note`),
  `cadence-core/references/seams.md:45, 97, 107`,
  `cadence-core/workflows/plan.md:207`,
  `cadence-core/config.schema.json:19`, `DESIGN.md:141, 352`, and the
  `route.mjs` comments at `:110, 131`. `CHANGELOG.md:43` is untouched - it is
  a historical record. Evidence: no self-verify check reaches these strings
  (they are neither config keys, script invocations, nor
  `${CLAUDE_PLUGIN_ROOT}` paths), so shipping the key's deletion without them
  leaves prose describing a key the code lacks - the exact class the linter
  exists to prevent and cannot mechanically catch here.
- D-13 (Scope): `cad-reviewer` rung files are materialized and covered by
  D-05's name check, but `fire(trigger)`'s claude-subagent arm is unchanged -
  it still dispatches the base file. Phase 3's `review` knob wires them, so
  no agent file is added inside a routing-table phase and `#64`'s remaining
  gap stays open one more phase. Evidence:
  `cadence-core/references/review-triggers.md:23-30, 57-69`;
  `.planning/ROADMAP.md:73`.
- D-14 (Drift): `.claude-plugin/plugin.json` and
  `.claude-plugin/marketplace.json` need no edit; agent registration is
  directory-based. Evidence: neither file carries an agent manifest;
  `marketplace.json` declares one plugin with `"source": "./"`; `METHOD.md`
  cites contract skills rather than agent filenames.

## Acceptance criteria

- [ ] AC1: `agents/` holds exactly the 13 files the `rungs` arrays in
      `route-table.json` name (6 base + 7 suffixed), each file's frontmatter
      `effort` equal to the rung in its name; deleting any one makes
      `node --test cadence-core/bin/self-verify.test.mjs` fail with a problem
      naming that agent
- [ ] AC2: Adding a contract-skill section tag (`<process>`, `<guardrails>`,
      ...) to the body of an agent file that declares `skills:` makes
      `node cadence-core/bin/self-verify.mjs` report `ok:false` with that file
      named; removing it returns `ok:true`
- [ ] AC3: `grep -rn "escalate_effort_variant\|effort-variant" --include="*.md"
      --include="*.json" --include="*.mjs" .` returns matches only under
      `.planning/` and in `CHANGELOG.md`
- [ ] AC4: `route-table.json` carries
      `rung_order: ["low","medium","high","xhigh","max"]`, and a role whose
      `base_effort` or `escalate_to` falls outside its own `rungs` array fails
      self-verify with the role named
- [ ] AC5: `resolve('cad-plan-checker', autoCfg, ['--attempt','2'])` still
      returns `agent: 'cad-plan-checker-high'`, `effort: 'high'`,
      `escalated: true` - the four existing escalation rows in
      `cadence-core/bin/route.test.mjs` (`:88`, `:119`, `:255`, `:339`) pass
      unchanged, plus a new row pinning `escalate_to` as the source of the swap
- [ ] AC6: `node --test cadence-core/bin/*.test.mjs` exits 0 and
      `npx tsc -p tsconfig.ci.json` exits 0
- [ ] AC7: `node cadence-core/bin/self-verify.mjs` reports `ok:true` with
      `agent-skills` still in its `checked` list; all 13 agent files have
      `weight-budgets.json` entries (no `unbudgeted-surface`), and no rung
      file's contract skill sets `disable-model-invocation: true`

## Flagged assumptions

- `DESIGN.md:141` and `:352` may be a historical design record rather than a
  live description of the mechanism - Likely; if so they stay as-is like
  `CHANGELOG.md:43`. The planner reads DESIGN.md §6's framing before editing
  those two lines; if wrong, D-12 edits a record that should have been
  immutable.
- The per-role `rungs` values in D-02 are seeded from issue #63's rung table,
  the only written-down rung intent - Likely; if wrong, phase 3's cell table
  names a rung with no file and has to add one or two agent files inside a
  routing phase. D-05's name check makes that failure loud rather than silent.
- Host behaviour when an Agent/Task dispatch names an agent with no matching
  file is unverified from this tree - Unclear; if it fails hard rather than
  falling back to the session default, D-01's base-file survival becomes
  load-bearing rather than merely conventional. D-05's check makes it moot for
  every routable name, but not for a hand-typed one.
- `agents/cad-plan-checker.md` and `-high.md` currently carry a
  `Your rung is \`<rung>\`.` line - Confident; whatever template D-04's check
  permits must allow it, which the section-tag denylist does.
