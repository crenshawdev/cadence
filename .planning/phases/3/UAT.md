---
status: testing
phase: 3
started: 2026-07-23
updated: 2026-07-23
---

## Items

### 1. cad-context writes durable + phase-local heading split
expected: The cad-context CONTEXT.md template (cadence-core/workflows/context.md write_context) writes durable decisions under a `## Durable decisions` heading and the phase-local rest under `## Decisions`, and the three-part durability filter prose (hard-to-reverse, surprising-without-context, real trade-off) is present in confirm_decisions.
status: pass
first_pass: pass
source: verifier
evidence: context.md:180-192 three-part filter prose (hard-to-reverse/surprising-without-context/real trade-off, no scoring seam); template split :271 `## Durable decisions` / :278 `## Decisions` with continuous D-NN; success_criteria enumerate the split :298,:367

### 2. recall returns durable items, not phase-local
expected: `planning.mjs recall <terms>` over a CONTEXT.md with both sections returns the `## Durable decisions` items and does NOT return that file's `## Decisions` items, including the present-but-empty durable heading case.
status: pass
first_pass: pass
source: verifier
evidence: fixture run: recall zorptastic -> phases/5/CONTEXT.md; recall blerpwidget (phase-local) -> []; recall quixotron (empty durable heading last, Decisions first) -> []; parseContextDecisions planning-files.mjs:230-238 uses `durable === null` fallback

### 3. legacy `## Decisions`-only recall unchanged
expected: Recall over a legacy CONTEXT.md that has only `## Decisions` (no durable heading, e.g. phases/1, phases/2) still returns its decisions unchanged - no upgrade regression.
status: pass
first_pass: pass
source: verifier
evidence: recall 'run-as-script guard realpath' -> real phases/1/CONTEXT.md D-01/D-02; phases/1 and phases/2 have only `## Decisions` heading

### 4. full green bar (tests + tsc + self-verify)
expected: `node --test cadence-core/bin/*.test.mjs` passes including the new durable-parse / legacy-fallback / empty-durable / determinism tests, `tsc -p tsconfig.ci.json` is clean, and `self-verify.mjs` prints `ok:true`.
status: pass
first_pass: pass
source: verifier
evidence: node --test cadence-core/bin/*.test.mjs -> 249 pass / 0 fail; tsc -p tsconfig.ci.json exit 0; self-verify.mjs -> {ok:true, problems:[]}; 4 new tests planning.test.mjs:946,958,970,984

### 5. self-verify surface registration for the new skill
expected: `self-verify.mjs` exits 0 with cad-decision-review budgeted in weight-budgets.json, a COMMANDS.md row present, and every new config key prose-referenced (no inert-config-key or CONTRACTS drift).
status: pass
first_pass: pass
source: verifier
evidence: weight-budgets.json:17 workflow 8016, :38 skill 2192, :14 context.md 15701 all match measured bytes; COMMANDS.md:28 row present; config keys referenced decision-review.md:55,61,111; schema config.schema.json:79-80; config get -> flagship/high; config validate ok (51 checked)

### 6. no auto-fire wiring for decision-review
expected: A grep of the review-trigger wiring (references/review-triggers.md, templates/config.json) finds no decision-review fire row - it runs only when the skill is called with a path.
status: pass
first_pass: pass
source: verifier
evidence: grep -rn decision_review review-triggers.md templates/config.json -> only templates/config.json:43 (config default), zero rows in review-triggers.md

### 7. /cad-decision-review emits per-objection ruling + amendment list (human-verify)
expected: (human-verify: needs a live skill run) A live `/cad-decision-review <path>` returns, per objection, a `survives | partial | refuted` ruling plus a concrete amendment list, and names the providers/models/effort that ran.
status: pass
first_pass: pass
reported: live /cad-decision-review panel run: per-objection survives/partial rulings + amendments, named cad-reviewer(opus)+deepseek(deepseek-v4-pro) tier flagship effort high

### 8. adjudicator grounds against Context7 + codebase (human-verify)
expected: (human-verify: needs live Context7 + a run) During a run the adjudicator verifies >=1 library/API claim against Context7 and >=1 claim against the codebase.
status: pass
first_pass: pass
reported: adjudicator grounded MiniSearch processTerm via Context7 + bm25.mjs no-stemming/empirical tokenize via codebase

### 9. cross-model panel resolves via review.decision_review.{tier,effort} (human-verify)
expected: (human-verify: needs a configured provider key) With a cross-model provider configured, the run executes the panel via the repaired REV-01 seam and resolves the model from `review.decision_review.{tier,effort}`; single-model claude-subagent otherwise.
status: pass
first_pass: pass
reported: cross-model panel fired live via review-provider.mjs deepseek deepseek-v4-pro effort high through REV-01 seam; single-model branch confirmed earlier

## Summary

total: 9
passed: 9
failed: 0
pending: 0
skipped: 0
blocked: 0
reworked: 0
