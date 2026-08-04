# Phase 4: The ladder is what it says it is - Context

Gathered: 2026-08-03
Feeds: /cad-plan 4

## Scope boundary

In: DOC-01 and RNG-02 whole - the per-role effort config family
(`model.effort.<role>`, six keys), its refusal and self-verify surfaces, the
floor and retry interaction rules, the `route-table.json` retune
(CAPTURE:196), the structural surfacing of `route.mjs`'s `warnings[]`, and
the shipped-claim audit over the rung ladder. Files: `cadence-core/bin/route.mjs`,
`cadence-core/route-table.json`, `cadence-core/config.schema.json`,
`cadence-core/bin/lib/route-cells.mjs` and `lib/rung-agent.mjs` as needed,
`cadence-core/bin/self-verify.mjs` (+ new lib check), their test files,
`cadence-core/references/config-reach.md`, `cadence-core/references/seams.md`
(call-site rule wording), live prose the audit corrects, and `CHANGELOG.md`
`## [Unreleased]`.

Out: agent frontmatter changes (the 19 rung files stand as shipped); any new
dispatch machinery; `model.escalate_on_failure` semantics; the interactive
config catalog (the six keys are catalog-less like the `model.overrides`
pins); rewriting append-only logs (DESIGN §6, dated CHANGELOG sections).

Deferred: #72 maxTurns spike - PROJECT.md called RNG-02 "the cheap moment"
on the assumption it touches agent frontmatter; this phase does not, so the
spike waits for a phase that does. The `model.escalate_on_failure` upgrade
inversion (CAPTURE, phase 2: an explicit opt-out inverts to ON) - separate
defect, separate decision.

Plan shape: one plan.

## Durable decisions

- D-01 (floor wins): a configured `model.effort.<role>` sets the start rung
  freely within the role's rung set but NEVER below a computed risk floor;
  `risk.override.<surface>` stays the only way below a floor. Rejected:
  config-wins-with-warning (a second, unnamed way down voids STK-03), and
  raise-only (kills the legitimate cheaper-runs use). Evidence:
  `cadence-core/bin/route.mjs:302-317` (floor precedes overrides),
  `cadence-core/bin/lib/route-cells.mjs:151-155` (`floor-below-required`),
  `cadence-core/route-table.json` `_meta.surfaces`.
- D-02 (retry rule): attempt 2 resolves at `max(cell.retry, configured start)`
  in `rung_order` - a retry never thinks LESS than the attempt that failed,
  extending `route-cells.mjs:284-290`'s rung-demotion guard to the config
  layer. Rejected: honest-hold on the equal case only (still allows a
  configured xhigh start to step DOWN to a high retry), and pin-suppresses-
  escalation (silently disables the ladder). Evidence:
  `cadence-core/bin/route.mjs:339-365`, `cadence-core/bin/lib/route-cells.mjs:284-290`.
- D-03 (key shape): six explicit `model.effort.<role>` keys in
  `config.schema.json`, mirroring the `model.overrides.<role>` spelled-out
  shape, each an enum of EXACTLY that role's rungs (plus null) - so "selects
  a rung that already exists" and by-key refusal fall out of the existing
  validator with no new machinery. The value lives in the config layers
  (`.planning/config.json` / `~/.claude/cadence/config.json`), never in
  `route-table.json`, which ships inside the plugin and is replaced on
  update. Rejected: one uniform `rung_order` enum (accepts `cad-executor:
  max`, a rung that role lacks, and rides the fail-open dispatch arm).
  Evidence: `cadence-core/config.schema.json:12-17`,
  `cadence-core/bin/lib/rung-agent.mjs:36-68` (per-role rung sets differ),
  `cadence-core/bin/config.mjs:65-66`.
- D-04 (warnings surfacing is structural): `warnings[]` becomes complete in
  the envelope - `ok:false` returns carry it too, where today `unresolved`
  drops `cfg._warnings` and `unknown-role` returns before config is read -
  and a check-10-style self-verify rule asserts every shipped prose block
  issuing `route.mjs resolve` carries the relay step. Rejected: another
  prose instruction alone (`seams.md:122-129` already mandates the relay and
  is what failed - this repo's own diff-gate override drifted back unnoticed
  behind it), and stderr lines (reaches the model but adds a second output
  contract; not needed once the envelope and call sites are checked).
  Evidence: `cadence-core/bin/route.mjs:323,285,430`,
  `cadence-core/bin/lib/dispatch-phrasing.mjs` + `self-verify.mjs:45-59`
  (check-10 precedent), live observation: the 2026-08-01
  "diff gate stays blocking" decision was contradicted by a config layer for
  days with the warning emitted unread on every resolve this session.

## Decisions

- D-05 (DOC-01 ladder half is an audit): `CHANGELOG.md:52`'s false claim was
  already corrected at the v2.0.0 close (`5b8728d`, "narrow the rung-ladder
  claim to what the route table declares") - live resolve over all 18 cells
  matches the shipped sentence (16 escalate, 2 hold). The phase VERIFIES and
  restates every ladder claim rather than fixing that sentence; the SUMMARY
  roster lists each audited claim with file:line and verdict. Evidence:
  `CHANGELOG.md:191-198`, commit `5b8728d`, `.planning/CAPTURE.md:114` (the
  pre-correction position the code now contradicts).
- D-06 (audit surface): live prose (`README.md`, `INTERNALS.md`,
  `cadence-core/references/`, `cadence-core/workflows/`, `agents/`,
  `skills/`) plus `## [Unreleased]`; append-only records (DESIGN §6, dated
  CHANGELOG sections) are corrected FORWARD with dated markers, never
  rewritten - and audit greps are path-scoped to live surfaces, per the
  CAPTURE:143 lesson. Evidence: `DESIGN.md:428-431`,
  `cadence-core/bin/self-verify.mjs:7-9`.
- D-07 (retune taken): `critical.cad-plan-checker` and `shipped.cad-reviewer`
  start AT their retry rung (`xhigh`), per CAPTURE:196; the CHANGELOG
  "two cells whose retry deliberately equals their starting rung" sentence
  gets its forward correction under `## [Unreleased]` in the same pass.
  Every rung file stays cell-reachable afterwards
  (`cad-plan-checker-high` via solo's retry, `cad-reviewer` base via solo).
  Evidence: `.planning/CAPTURE.md:196`, `cadence-core/route-table.json`,
  `cadence-core/bin/self-verify.mjs:744-763` (`undeclared-rung-agent`).
- D-08 (refusal faces): `config.mjs` (`set`/`check`/`validate`) is the
  surface that refuses a USER value naming a rung the role lacks, by key
  with the allowed set; `self-verify`'s contribution is proving the shipped
  schema enums agree with `RUNG_FILES` and `route-table.json` (it never
  reads `.planning/config.json` and cannot literally refuse a user value -
  ROADMAP SC1 is delivered across the two surfaces). Evidence:
  `cadence-core/bin/config.mjs:105-127`, `.github/workflows/test.yml` (bare
  checkout), `cadence-core/workflows/config.md:134`.
- D-09 (doc reach): each new key gets a `## Reach rows` row in
  `cadence-core/references/config-reach.md` (check 9 fails otherwise) and a
  schema `purpose`; NO interactive-catalog rows in `workflows/config.md` -
  the `model.overrides` pins are already carved out of that catalog by name,
  and `references/` carries no byte budget while `workflows/config.md` does.
  Evidence: `cadence-core/workflows/config.md:27-32`,
  `cadence-core/references/config-reach.md:106-111`,
  `cadence-core/bin/weight-budgets.json`.
- D-10 (warning scoping): the once-per-workflow-run scoping stands - a
  distinct warning is relayed once, not once per dispatch; the call-site
  check asserts the relay rule's presence, not per-dispatch repetition.
  Evidence: `cadence-core/references/seams.md:122-129,163-169`.
- D-11 (stderr, settled research): the Claude Code host DOES return a Bash
  subprocess's stderr in the tool result the coordinating model reads -
  recorded so the option is never re-researched - but D-04's chosen
  mechanism does not use it.

## Acceptance criteria

- [ ] AC1: `node cadence-core/bin/config.mjs set model.effort.cad-verifier=medium`
      in the repo layer, then `node cadence-core/bin/route.mjs resolve --role
      cad-verifier` at stakes `shipped` reports `effort: "medium"` and agent
      `cad-verifier-medium`; no file under the plugin root is modified - the
      setting survives a plugin update by construction.
- [ ] AC2: `config.mjs set model.effort.cad-executor=max` (a rung that role
      lacks) refuses naming the offending key and the role's allowed set;
      `self-verify` fails with the key named when a shipped
      `model.effort.<role>` enum disagrees with `RUNG_FILES`/
      `route-table.json`, and passes on the shipped tree.
- [ ] AC3: with a computed risk floor active, a `model.effort.<role>` below
      the floor resolves AT the floor with the surface named in the output;
      adding `risk.override.<surface>` (and only that) lowers it - one test
      per side.
- [ ] AC4: with a configured start at or above the cell's retry, `--attempt 2`
      resolves at `max(cell.retry, start)` - a test proves the retry never
      sits below the start.
- [ ] AC5: `warnings[]` is present on `ok:false` resolves that today drop it
      (retired-key and unresolvable-stakes fixtures), and a self-verify check
      asserts every shipped prose block issuing `route.mjs resolve` carries
      the relay rule - each proven by a test that fails when the warning or
      the rule is dropped.
- [ ] AC6: the SUMMARY lists every audited ladder claim with file:line and a
      verdict (true / corrected / removed); the retune's forward correction
      sits under `## [Unreleased]`; a path-scoped grep over live prose
      (excluding `DESIGN.md` and dated CHANGELOG sections) finds no claim
      contradicting `route-table.json`.
- [ ] AC7: `node --test cadence-core/bin/*.test.mjs` and `npx tsc -p
      tsconfig.ci.json` both exit 0, and `node cadence-core/bin/self-verify.mjs`
      reports `ok:true` with no budget overrun on any surface this phase
      edits.

## Flagged assumptions

- self-verify proves a rung file EXISTS but never that its frontmatter
  `effort` equals the rung the map assigns (`self-verify.mjs:605` area;
  CAPTURE, phase 3) - Likely worth folding into this phase's self-verify
  work; if left, a mislabeled rung file dispatches at a depth nothing ran at
  and reports the map's rung.
- The four phase-3 open route items remain open at HEAD (raw `cfg.stakes`
  index into `TABLE.cells`, `roles[]` unchecked by the cell walk, the
  unmapped-rung fail-open at `route.mjs:332-337`) - planner's call whether
  any folds in where the phase already edits those lines; if untouched, the
  fail-open keeps reporting a rung nothing dispatched.
- `route.mjs` resolve currently emits the diff-gate config-wins warning on
  every call in this repo (a layer re-set `review.triggers.diff.gate=
  "adjudicated"` against the 2026-08-01 decision; CAPTURE todo filed at
  phase 3) - Confident; the phase's AC5 test fixtures should not depend on
  this repo's transient config state.
