# Phase 6: The remaining silent drops - Context

Gathered: 2026-07-29
Feeds: /cad-plan 6

## Scope boundary

In: scoping the six surviving `tier` keys at the point of setting the way #64
scoped per-trigger `effort`; a declared per-key reach table in
`cadence-core/references/` plus one self-verify check that reports zero
remaining; four reach-misstatement corrections (`workflow.skip_discuss`,
`workflow.research`, `granularity`, and `workflows/config.md`'s "every knob"
claim); the `effort` overclaims #64 left in two SKILL.md files and in
`workflows/decision-review.md`'s `report_cost`; dropping `tier`/`effort` from
`templates/config.json`'s per-trigger block; both arms of phase 4's
`risk.override` repo-scope hole (the resolver's merged-config read and the write
face's string path compare); and the move of the plugin's documented home to
`https://git.jcrenshaw.dev/crenshawdev/cadence.git`.

Out: deleting the `tier` keys (D-01); a write-face refusal for a tier set with
only `claude-subagent` configured (D-03); wiring tier through to the
claude-subagent arm as a model mapping (D-03, collides with phase 3's D-03);
`review.triggers.<t>.gate`, settled by phase 3's D-04 and phase 4's AC6;
`templates/config.json`'s pre-written gate values (D-10); the issue tracker and
`.github/ISSUE_TEMPLATE/config.yml` (D-14).

Deferred:
- The pre-written per-trigger `gate` block in `cadence-core/templates/config.json`
  makes every scaffolded project's stakes level decide nothing for review and emits
  three gate-disagreement warnings on every resolve. D-04 is settled and the
  warnings make it non-silent, so it fails the "with nothing said" test that
  defines this phase. Recorded for its own decision, not fixed here.
- Whether GitHub remains the issue tracker after the hosting move. `gh` drives
  this project's milestone and issue flow, and `.github/ISSUE_TEMPLATE/config.yml`
  carries two github.com doc links. Outside "update the plugin url", so untouched.

Plan shape: multiple plans, same phase - AC1-AC5 and AC9 are the config sweep,
AC6-AC8 are the hosting move, and the two arms share no file, so /cad-plan can
split them and the parallel path is available.

## Durable decisions

- D-01 (Tier): `tier` survives phase 3 completely untouched - the five
  `review.triggers.<t>.tier` keys plus `review.decision_review.tier` - and the
  honest fix is SCOPING, not deletion, because the cross-model arm genuinely
  honours them and has no other bridge from a trigger to a provider model id.
  Evidence: `cadence-core/config.schema.json:71,74,77,80,83,91` still declare all
  six; `cadence-core/route-table.json` carries no `tier` at any level and its
  `_meta.cells` line reads "`tier` is gone"; `cadence-core/bin/route.mjs:128`
  (`triggerGatesIn`) reads `spec.gate` only and `:377` takes the model from the
  cell; the honouring reader is prose at
  `cadence-core/references/review-triggers.md:57,88`
  (`review.providers.<name>.tiers[trigger.tier]`), with
  `cadence-core/workflows/decision-review.md:56` and
  `cadence-core/references/consult.md:42` doing the same, while
  `cadence-core/bin/review-provider.mjs:476` takes `--model` from its caller and
  never reads config for it. Issue #75 - the reason #78 raised deletion as a
  candidate - is CLOSED / not-planned, and `route-table.json:21-42` still routes
  `sonnet` at solo, so the model axis did not collapse. Rejected deletion: it
  removes six keys out from under the only backend that reads them. If wrong: the
  cross-model reviewer loses its per-trigger model selection entirely.

- D-02 (Sweep): The re-runnable sweep is a reach table in
  `cadence-core/references/` plus ONE new self-verify check, not a `reach` field
  on all 72 schema keys and not a written procedure alone. Evidence:
  `cadence-core/bin/lib/surface-weight.mjs:53-79` measures only `agents/*.md`,
  `skills/**/SKILL.md` and `cadence-core/workflows/*.md`, so a `references/` doc
  costs no budget churn; the four v1.4.0 grammars (`references/roadmap-phases.md`,
  `references/req-traceability.md`, `references/plan-frontmatter.md`) each pair a
  reference doc with one pure lib function and a table of test rows, and phase 5's
  `references/acceptance-criteria.md` + `planning.mjs criteria-coverage` is the
  more expensive shape, needing a CONTRACTS entry, tests AND a caller. Rejected a
  `reach` field on every key: it makes zero-remaining a total function over one
  file with no second document to drift, and `config.mjs keys` would dump it for
  free, but it costs 72 key edits and a `_meta` vocabulary line. Rejected a written
  procedure only: it produces no output on demand, which is exactly what "reports
  zero remaining" asks for. If wrong: the doc and the schema drift, and the check
  proves consistency between two things nobody reads rather than against the code.

- D-03 (Point of setting): Criterion 1's "scoped and refused at the point of
  setting" is delivered in #64's shipped shape - STATED, not refused. A schema
  `purpose` clause, a degradation line where the value fires, a `config.md` catalog
  row, a `DESIGN.md` section 6 marker and a CHANGELOG bullet; no write-face
  refusal and no runtime validator. Evidence: the exemplar is commit `bc0095d`
  ("fix(review): scope per-trigger effort to the backend that can honour it"),
  touching exactly `DESIGN.md:300` (`SCOPED (2026-07-28, #64)`),
  `config.schema.json` (5+1 purposes), `references/review-triggers.md` steps 1 and
  4, `workflows/config.md:117`, `weight-budgets.json` (+70B) and `route.test.mjs`
  (two tests pinning the behavioural claim, never the purpose text); no test
  anywhere asserts a schema `purpose` string, so criterion 1's "stated in the
  schema description" has no mechanical-enforcement precedent before this phase's
  own check. Rejected a real refusal (refuse a tier when `review.reviewers` holds
  only `claude-subagent`, on the `retired-keys.mjs` / `repoScopedErrors` model):
  it makes the criterion's literal wording true but adds a write-face rule that
  reads a sibling key's value. Rejected wiring tier through as
  `flagship|balanced|cheap` -> `opus|sonnet|haiku`: it collides with phase 3's
  D-03, which gave the cell grid sole ownership of model resolution, one phase
  after it shipped. If wrong: a user setting a tier with only the subagent
  configured still gets `ok:true`, and criterion 1 ships on the softer reading.

- D-04 (Decision review): `workflows/decision-review.md`'s scope clause is written
  independently and cannot borrow `review-triggers.md`'s wording, because that
  workflow never calls `route.mjs` at all - its claude-subagent reviewer is the
  base `cad-reviewer` at the session default at every stakes level. Evidence:
  `cadence-core/workflows/decision-review.md:52-53` dispatches `cad-reviewer`
  through the spawn-agent seam with no model, and the file's only seam invocation
  is `review-provider.mjs` at `:60-63`; by contrast
  `cadence-core/references/review-triggers.md:16-18` resolves the bundle first and
  `:79-80` dispatches "the `agent` and `model` the step-1 resolve returned". The
  overclaim sites are `:127` (`report_cost`), `:175` and `:179`
  (`<success_criteria>`). If wrong: the new clause tells the user a routing cell
  resolved a model when nothing did.

- D-05 (Sweep): The new check must NOT be a strengthening of self-verify's
  existing check 1b tokenizer. Evidence: `cadence-core/bin/self-verify.mjs:289-301`
  (forward) and `:389-393` (reverse, `inert-config-key`) already sweep every schema
  key against every live prose surface and pass today on all six defective keys,
  because a `workflows/config.md` catalog row is indistinguishable from a
  behavioural read; re-running that tokenizer with `config.md` excluded shows
  `review.triggers.{diff,risk_surface,phase_diff}.effort` covered by the catalog
  ALONE, since their real prose home is `review-triggers.md`'s `trigger.effort`
  shorthand whose family token is absent from `FAMILIES` (`self-verify.mjs:239,294`).
  So a naive catalog-only strengthening fires three false positives on a correct
  tree. Fixture discipline follows `self-verify.test.mjs:31,55,125`, which already
  copies the shipped schema into fixture roots, so a synthetic scoped/unscoped
  schema fixture satisfies the never-derive-expectations-from-the-subject rule. If
  wrong: the sweep's first CI run fails against a correct tree and gets loosened
  until it proves nothing.

- D-06 (Risk override): `route.mjs` stops honouring a `risk.override.<surface>`
  sourced from the global layer, reversing phase 4's documented-gap posture.
  Evidence: `cadence-core/bin/route.mjs:107` reads `riskOverridesIn(c)` off the
  MERGED config while `config.schema.json` marks all eight keys `src:repo`, so one
  global waiver disables the risk floor in every repository on the machine;
  `CHANGELOG.md:128-133` and `workflows/config.md:105` currently ship the gap as a
  documented claim rather than a fix, and `mergeLayers` already knows which layer
  supplied what. If wrong: the floor phase 4 built stays waivable machine-wide by a
  single line in one file.

- D-07 (Hosting): `https://git.jcrenshaw.dev/crenshawdev/cadence.git` becomes the
  sole documented home and GitHub stops being pushed to. Evidence: verified this
  session that the host serves the repo page (HTTP 200) and that
  `git ls-remote https://git.jcrenshaw.dev/crenshawdev/cadence.git HEAD` succeeds
  anonymously, and `git ls-remote --heads origin` shows both `main` and
  `cadence/v2.0.0` already present there. The costs are real and accepted: an
  existing user's `/plugin update cadence@cadence` follows
  `.claude-plugin/plugin.json`'s `repository`, so the GitHub marketplace entry
  goes stale, and the three marketplace submissions filed 2026-07-17 point at a
  repo that stops moving. Rejected keeping GitHub as a mirror. If wrong: existing
  installs silently stop receiving updates with only the CHANGELOG saying so.

## Decisions

- D-08 (Reach): Four reach misstatements are in scope, all purpose/claim text and
  no code. `workflow.skip_discuss`'s purpose claims a step is skipped while its
  only reader is a suggestion-table row at `cadence-core/workflows/progress.md:108`
  and nothing in `workflows/context.md` gates on it; `workflow.research`'s purpose
  says "before planning" while its only reader is
  `cadence-core/workflows/new-project.md:144`; `granularity`'s first clause says
  "how finely phases split into tasks" while its only reader is
  `new-project.md:236` and its own parenthetical already describes phase counts;
  and `cadence-core/workflows/config.md:24-27` claims every knob is
  menu-selectable with `review.providers.*` as the only exception, while 8 more
  keys have no catalog row (the six `model.overrides.<role>` plus
  `review.decision_review.tier` and `.effort`).

- D-09 (Residue): The `effort` overclaims #64 left behind are in scope:
  `skills/cad-plan-review/SKILL.md:42-43` ("Honor `review.triggers.plan` (gate,
  tier, effort)") and `skills/cad-decision-review/SKILL.md:49` ("plus which
  providers/models/tier/effort ran"), both live prose surfaces self-verify scans
  (`self-verify.mjs:131-173`) at exact-fit budgets 2439 and 2448.
  `skills/cad-land/SKILL.md:45` needs nothing - it names only the gate default.

- D-10 (Template): `cadence-core/templates/config.json:34-40` drops `tier` and
  `effort` from the per-trigger block so an unset knob stays unset; the pre-written
  `gate` values stay and are recorded under Deferred. Evidence:
  `workflows/new-project.md:35` copies the template verbatim, and verified live on
  a scratch tree that with that template at `stakes: solo`,
  `route.mjs resolve --role cad-reviewer` returns the SHIPPED row's gates plus
  three `(config) wins over the solo level gate` warnings - so every scaffolded
  project is also handed a tier the default reviewer set drops.

- D-11 (Write face): `repoScopedErrors` (`cadence-core/bin/config.mjs:204`)
  compares by realpath instead of `file === GLOBAL_CONFIG` string equality, closing
  the `set --file <global-dir>/./config.json` door that a symlink, a relative path
  or a trailing slash opens equally.

- D-12 (Budgets): All 69 entries in `cadence-core/bin/weight-budgets.json` measure
  exact-fit against their files, so every prose edit regenerates the manifest in
  the same change - `decision-review.md`'s zero headroom is the general rule here,
  not a special case. Surfaces a fix touches, budget == actual in every case:
  `workflows/decision-review.md` 9436, `workflows/config.md` 17350,
  `skills/cad-plan-review/SKILL.md` 2439, `skills/cad-decision-review/SKILL.md`
  2448. `decision-review.md` has ~330B of in-file trim available: its `<purpose>`
  third paragraph (329B) and `<guardrails>` third bullet (331B) assert the same
  thing and only the guardrail carries its `D-07` citation - so #78's "budget
  increase or equivalent trim" is a real choice, and a justified bump is equally
  legal (#64 took +70B on `config.md`). Unbudgeted and free:
  `cadence-core/config.schema.json`, `cadence-core/references/*.md`,
  `cadence-core/templates/config.json`, `README.md`, `DESIGN.md`, `CHANGELOG.md`.

- D-13 (Criterion 3): "Recorded as closed there rather than fixed twice" is
  satisfied by `DESIGN.md` section 6 append-only markers plus the CHANGELOG entry,
  and any grep-shaped criterion is PATH-SCOPED to `cadence-core/`, `agents/`,
  `skills/`. Evidence: the convention is live and dated (`DESIGN.md:300`
  `SCOPED (2026-07-28, #64)`, `:369` `SUPERSEDED`, `:380` `AXIS REPLACED`, `:403`
  `SUPERSEDED (2026-07-29)`), and the already-closed items are traceable at
  `lib/retired-keys.mjs:34-55`, `route.mjs:204-206`, `references/seams.md:124-132`
  and `CHANGELOG.md:170-179`. Section 6 must keep naming what it retires, which is
  why phase 3's AC2 failed against a correct tree.

- D-14 (Hosting surfaces): Exactly four files change for D-07. `README.md:37`'s
  install URL and `:3`'s test badge move to `git.jcrenshaw.dev`; `README.md:4`'s
  ClaudePluginHub badge line is DELETED (the badge endpoint still serves and the
  slug is not ours, so it cannot follow the move); `.claude-plugin/plugin.json:9-10`
  `homepage` and `repository` move, which also fixes every future release link for
  free, since `cadence-core/bin/release-bump.mjs:52-53` derives
  `<base>/releases/tag/v<version>` from those two fields and Forgejo uses the same
  path shape. `.claude-plugin/marketplace.json` needs no change (`"source": "./"`).
  Deliberately untouched: `CHANGELOG.md`'s 11 historical release links and
  `DESIGN.md`'s one reference (append-only records), and
  `.github/ISSUE_TEMPLATE/config.yml`'s two links (GitHub-only rendering surface,
  and the tracker question is Deferred above).

- D-15 (Traceability): The hosting move gets a NEW requirement row, `HST-01`, in
  `.planning/REQUIREMENTS.md`'s `## Active`, taking the milestone from 6
  requirements to 7. /cad-context does not add requirement rows - it corrects at
  most one row this phase already serves - so writing `HST-01` and updating the
  counts in `PROJECT.md` and `ROADMAP.md`'s overview is an execution task in this
  phase's plan, ordered before the `seed-reqs` call so `/cad-plan`'s seeding has a
  row to find. Rejected folding it under CFG-01 (whose wording is about config
  keys, so a later audit reader would not find the hosting work in it) and
  rejected a /cad-task outside the roadmap.

## Acceptance criteria

- [ ] AC1: `node cadence-core/bin/config.mjs keys` shows a `purpose` naming the
      cross-model backend as the only reach for all six tier keys
      (`review.triggers.{plan,diff,risk_surface,phase_diff,pre_ship}.tier` and
      `review.decision_review.tier`), and a purpose matching its single real reader
      for `workflow.skip_discuss`, `workflow.research` and `granularity`.
- [ ] AC2: `node cadence-core/bin/self-verify.mjs` reports `ok:false` naming the
      offending key for each of three classes - a `config.schema.json` key with no
      row in the new `cadence-core/references/` reach table, a reach row naming no
      schema key, and a key whose reach is narrower than universal without that
      reach appearing in its `purpose`.
- [ ] AC3: On the unmodified tree, `node cadence-core/bin/self-verify.mjs` reports
      `ok:true` with the new check named in its `checked` string and zero problems
      of the new kinds.
- [ ] AC4: `workflows/decision-review.md`'s `report_cost` step and
      `<success_criteria>` no longer present `.tier`/`.effort` as applied to the run
      and state that its claude-subagent arm resolves no model at all; neither
      `skills/cad-plan-review/SKILL.md` nor `skills/cad-decision-review/SKILL.md`
      carries an unqualified tier/effort honour claim; and
      `cadence-core/templates/config.json`'s per-trigger block carries `gate` only.
- [ ] AC5: With a `risk.override.<surface>` present in the global layer only and a
      repo config at `stakes: solo`, `node cadence-core/bin/route.mjs resolve --role
      cad-executor --phase N` against a PLAN matching that surface returns
      `stakes: "critical"`, and `node cadence-core/bin/config.mjs set --file
      <global-dir>/./config.json risk.override.auth=true` is refused with a message
      naming the repo-scope rule.
- [ ] AC6: `README.md`'s install block reads `/plugin marketplace add
      https://git.jcrenshaw.dev/crenshawdev/cadence.git`, its test badge points at
      that host, the ClaudePluginHub badge line is gone,
      `.claude-plugin/plugin.json`'s `homepage` and `repository` name that host, and
      `grep -rn "github.com/crenshawdev" README.md .claude-plugin/plugin.json`
      returns nothing.
- [ ] AC7: `/plugin marketplace add https://git.jcrenshaw.dev/crenshawdev/cadence.git`
      followed by `/plugin install cadence@cadence` succeeds in a live Claude Code
      session. (human-verify: needs an interactive `/plugin` run against the live
      remote)
- [ ] AC8: The `[2.0.0]` CHANGELOG entry states that the plugin's home moved, gives
      the exact action an existing GitHub-installed user takes, and records which
      items the reframe already closed rather than fixing twice.
- [ ] AC9: `node --test cadence-core/bin/*.test.mjs` exits 0, `npx tsc -p
      tsconfig.ci.json` exits 0, and `node cadence-core/bin/self-verify.mjs` reports
      `ok:true` with no `budget-overrun` on `decision-review.md`, `config.md`,
      `cad-plan-review/SKILL.md` or `cad-decision-review/SKILL.md`, and no
      `unknown-config-key`.

## Flagged assumptions

- Whether the host's Agent/Task dispatch surface still exposes no per-dispatch
  `effort` parameter - Likely; #64 re-verified it against host docs on 2026-07-28
  (`DESIGN.md:305-307`), phase 1's whole rung ladder rests on it, and this
  session's own Agent tool takes `model` but no `effort`. The codebase cannot
  answer it, only record the prior verification. If the host has since added one,
  "scope it" stops being the only honest option for both `tier` and `effort`.
- The self-hosted test badge renders **"Not found"** today - Confident, verified
  live: `https://git.jcrenshaw.dev/crenshawdev/cadence/actions/workflows/test.yml/badge.svg`
  returns HTTP 200 `image/svg+xml` whose label text is "Not found", and the repo
  has `.github/workflows/test.yml` with no `.forgejo/workflows/`. AC6 asserts the
  badge URL only, by explicit choice; standing up a runner on that host is not in
  any criterion here, so the README ships a badge that renders "Not found" until
  one exists.
- Every one of the 72 keys in `config.schema.json` has a real consumer - Confident;
  the analyzer's full walk found no key read by nobody, and `self-verify.mjs:389-393`
  (`inert-config-key`) already enforces a weaker version of that and passes. The
  in-scope set is therefore the 6 unscoped tier keys plus the prose surfaces named
  in D-04, D-08 and D-09, and nothing larger.
- `review.reviewers`'s option list at `workflows/config.md:107` omits `deepseek`,
  which the schema enum allows - Unclear whether that counts as a reach
  misstatement of the same family. Left to the planner; it is a one-word catalog
  edit either way.
- Tooling probed on this machine: `node`, `npx`, `git` and `curl` all present. AC7
  is the only human-verify criterion.
