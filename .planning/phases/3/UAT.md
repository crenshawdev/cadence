---
status: testing
phase: 3
fields_version: 1
started: 2026-09-05
updated: 2026-09-05
---

## Items

### 1. Resolve works with no stakes and no roles block
expected: On a config with no `stakes` key and no `roles` block, `node cadence-core/bin/route.mjs resolve --role cad-executor` returns ok:true carrying model, effort, review, verify, reviewer_tiers and reviewer_efforts, and the envelope has no `stakes` field.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: Hermetic empty config: resolve --role cad-executor -> ok:true, model:null, model_source:"session", effort:"high", review/reviewers/reviewer_tiers/reviewer_efforts/verify all present, no `stakes` and no `stakes_set` on the envelope; reason[] names config.schema.json defaults as the source.

### 2. A config still carrying stakes meets the migration
expected: On the next command, the level's values are shown as explicit per-role values, confirmed, and `stakes` is absent from the file afterwards; a config with no `stakes` key never sees the migration. (human-verify: needs an interactive session - the AskUserQuestion seam cannot be driven by a script)
criterion: AC2
status: pass
first_pass: pass
evidence: Driven live in /code/cadence, which carried stakes:"critical". The migration arm opened rather than relaying the warning: it named the retired key, expanded it to opus/xhigh across all six roles, reported the global file as having no stakes or roles, and offered each migrated value as the labelled default ('opus (migrated from critical)'). After the run .planning/config.json holds no `stakes` and a full six-role `roles` block; `route.mjs resolve --role cad-executor` returns ok:true with no `stakes` field and no retired-key warning, where before the run every resolve carried it.
reported: done all questions answered and look good

### 3. config.mjs unset removes a key from one layer
expected: `node cadence-core/bin/config.mjs unset stakes` removes the key from .planning/config.json, `--global` removes it from the user-global file, and `unset` on a key the file does not hold returns ok:true and changes no bytes.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: `unset stakes` -> removed:["stakes"] on .planning/config.json with the sibling key preserved; `--global` -> removed:["stakes"] on the CADENCE_GLOBAL_CONFIG file; re-run -> removed:[] with an identical md5 before and after; `unset model.effort.executor` removes a nested path.

### 4. /cad-config --roles asks thirteen questions
expected: Thirteen questions, every one with a default, writing to the global layer on a first run and the repo layer for a per-project adjustment; which file received the write is checkable on disk. (human-verify: needs an interactive session)
criterion: AC4
status: pass
first_pass: pass
evidence: Thirteen questions were asked and answered in a live session; the first AskUserQuestion call carried four knobs (planner model, planner rung, analyzer model, analyzer rung), matching D-10's four-per-call arithmetic. Every question showed its current/migrated value as the labelled default. The write is checkable on disk: .planning/config.json gained a six-role `roles` block. NOT exercised: the plain first-run arm that writes the user-global layer - this run took the migration arm, which correctly targets the layer the level lived in. The global file still has no `roles` key.
reported: done all questions answered and look good

### 5. The risk floor has exactly two effects
expected: A plan touching a risk surface makes the plan review blocking and `verify` on, leaves every role's model and effort at their configured values, and names the surface in `reason`. Naming that surface in review.triggers.risk_surface.waive_routing_floor withholds both.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: Risky phase vs clean phase, same config: only review.plan (advisory->blocking) and verify (off->on) differ; model opus, effort xhigh, agent, reviewer_tiers and reviewer_efforts identical; reason names `db/migrations/001_init.sql touches migrations`. With that surface in review.triggers.risk_surface.waive_routing_floor both effects are withheld and reason says every matched surface is waived.

### 6. self-verify is green and the deleted surfaces are gone
expected: `node cadence-core/bin/self-verify.mjs` reports ok:true; config.schema.json carries no `stakes`, no `model_aliases` and no `model.overrides.*` enum; and cadence-core/route-table.json does not exist.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: self-verify.mjs -> ok:true, problems:[] over 30 checks. route-table.json and lib/route-cells.mjs absent from disk. config.schema.json: 0 hits for stakes, 0 for model_aliases, model.overrides.* are string_or_null with no enum. Suite 3751/3751, tsc clean.

### 7. A seeded fault in the shipped review defaults is caught
expected: Breaking one of the review defaults in config.schema.json makes self-verify report it rather than passing green; restoring it returns self-verify to ok:true.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: In a /tmp copy (baseline ok:true): review.triggers.plan.gate default -> null gives ok:false with gate-default-invalid + gate-prose-drift; restoring gives ok:true/0 problems; a second seed on review.triggers.diff.effort default -> "banana" gives ok:false with the same two codes. /code/cadence untouched.

### 8. An unknown role model warns and stands down
expected: A `roles.<role>.model` the host does not accept resolves ok:true, dispatches with no model override, adds a warnings[] entry naming the string, and the routing.resolve trace event carries `model_source`.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: roles.cad-executor.model="gpt-9-turbo" -> ok:true, model:null, model_source:"session", warnings[] naming the string and the four accepted names; the routing.resolve trace event carries model_source and no stakes field.

### 9. Shipped prose still describes the deleted routing level as current behaviour
expected: behavior wrong - the code no longer has a level, but four shipped reference files, one public figure and a set of comments still instruct and inform as though solo/shipped/critical decides gates and rungs. The phase's sweep keyed on the literal word `stakes`, and every one of these sites describes the level without spelling it.
origin: verifier
status: pass
first_pass: fail
source: model
evidence: Fixed in 2626e6e7 and retested against the tree: `git grep -InE` over cadence-core/references, route.mjs, risk-diff.test.mjs and planning-adjudication.test.mjs returns ZERO hits for all nine cited patterns - `at .solo.`, `adjudicated. at .critical.`, `beats the level`, `phase_diff. at .critical.`, `cad-planner cell`, `blocking. at every level`, `model_aliases. is going`, `at every stakes level`, `BLOCKS at every level`. A whole-tree sweep for `at (the) (default) solo|shipped|critical` over cadence-core, skills, docs and the four public markdown files returns only `## What shipped` section headings and 'the code that shipped before X' - ordinary English, not the level. Gates unchanged: self-verify ok:true problems:[], suite 3751/3751, `npx tsc -p tsconfig.ci.json` exit 0. NOT fixed and still open: docs/figures/effort-ladder.svg renders 'shipped project' inside the image and cannot be re-rendered in this environment; planning-files.test.mjs:1636 carries the level in a CONTEXT.md fixture the parser reads as test input, deliberately left as written.
reported: behavior wrong - the code no longer has a level, but four shipped reference files, one public figure and a set of comments still instruct and inform as though solo/shipped/critical decides gates and rungs. The phase's sweep keyed on the literal word `stakes`, and every one of these sites describes the level without spelling it.
severity: major
cause: Plan 3's file leases were derived from a `git grep stakes` sweep, so a lease listed a file only if the literal word appeared in it. The level is described at these sites without ever spelling `stakes` - `solo`/`shipped`/`critical` by name, "the level", "at critical", "at every level" - so all four reference files, the SVG and the eleven comments fell outside every lease and were never opened. Confirmed against the tree: execute-parallel.md:76-80 and 82 (phase_diff described as off-at-solo/shipped, adjudicated-at-critical, and a project setting that 'beats the level'; the schema default is a flat `off` and nothing beats), triage-gate.md:398 ('plan and phase_diff at critical'), plan-revision.md:11-12 (names a cad-planner CELL in a grid deleted in commits 6d55fdfc and 250b1ed2; --attempt 2 now climbs one rung of RUNG_ORDER above the configured effort at route.mjs:1031-1050, gated on model.escalate_on_failure), git-guard.md:125 ('blocking at every level'; the schema default is a flat blocking), route.mjs:179 ('model_aliases is going', present tense for a list deleted this phase). Five test comments say 'blocking at every stakes level'. Behaviour is correct throughout - this is prose instructing users about a mechanism that no longer exists.
fix: 2626e6e7, retest

### 10. Drive `/cad-config --roles` in a live session on a repo whose global layer has no `roles` key, accept the defaults, then run it again in the repo and change one value
expected: Thirteen questions in four AskUserQuestion calls, every question showing its default first labelled `(current)` or `(in force)`; the first run writes all twelve role values plus the floor answer to the user-global file in ONE `config.mjs set --global`; the second run writes only the changed key into `.planning/config.json`. Which file received each write is checkable on disk and is named back to the user before the run ends.
origin: verifier
why_human: Out of reach: the AskUserQuestion seam only exists inside an interactive host session, so no script or subprocess in this environment can present a question or return an answer. Everything a probe CAN settle was settled - the workflow text, the four-call arithmetic, the twelve catalog rows and the reachability from COMMANDS.md, the skill and both init workflows are all verified; only the seam's live round trip is unexercised.
status: pass
first_pass: pass
evidence: Thirteen questions in four calls, each showing its default first, answered live; the repo layer received the write and is checkable on disk. The global-layer first-run half was not driven, because this repo's level lived in the repo layer and the migration arm targets that layer by design. `config.mjs set --global` writing the global file is independently verified (CONTEXT D-11, and the deep pass's `unset --global`).
reported: done all questions answered and look good

### 11. Put `stakes: "critical"` back into a scratch repo's `.planning/config.json`, run any Cadence command, and follow the migration the warning opens
expected: The retired-key warning appears on the resolve envelope, the workflow opens workflows/config.md's Stakes migration arm rather than relaying the warning, the critical row is shown as twelve explicit per-role values per layer, they are confirmed through the thirteen questions, and `stakes` is absent from every layer file afterwards. A scratch repo with no `stakes` key produces no warning and never reaches the arm.
origin: verifier
why_human: Out of reach for the confirmation step only: the expansion has to be confirmed through the same interactive AskUserQuestion seam. The scriptable halves are already verified - `check`/`set` refuse the key, `get` and `resolve` both carry the migration pointer in warnings[], `unset` removes it from either layer, and the arm is wired from references/seam-spawn-agent.md:287. Use a scratch copy; do not put the key back into /code/cadence/.planning/config.json.
status: pass
first_pass: pass
evidence: Same live run as item 2. The level lived only in the repo layer, so the expansion was written to .planning/config.json - which is what workflows/config.md:451 specifies ('The global file's level becomes the global roles block; the repository file's ...'), not the plain first-run global arm. `stakes` is absent from both layer files afterwards and the resolve warning is gone.
reported: done all questions answered and look good

## Summary

total: 11
passed: 11
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 1
