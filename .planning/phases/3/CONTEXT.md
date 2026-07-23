# Phase 3: Decision rigor - Context

Gathered: 2026-07-22
Feeds: /cad-plan 3

## Scope boundary

In: Deliver DEC-01 and DEC-02.
- DEC-01 - decision-durability filter in cad-context: a decision is durable only
  when it passes the three-part test (hard-to-reverse, surprising-without-context,
  result of a real trade-off), judged in workflow prose. Durable decisions are
  written under a new `## Durable decisions` heading; the rest stay under
  `## Decisions` (phase-local). Recall's parseContextDecisions retargets to the
  durable heading with a legacy fallback to `## Decisions`. Tests for
  durable-parse, legacy fallback, determinism.
- DEC-02 - `/cad-decision-review <path>`: a new skill
  (skills/cad-decision-review/SKILL.md) backed by a dedicated workflow
  (cadence-core/workflows/decision-review.md), running an on-demand
  refute -> adjudicate pass over one decision doc through the existing review
  subsystem. Per-objection `survives | partial | refuted` ruling + amendment list
  as the adjudicator's prose output. Codebase + live Context7 grounding in the
  adjudicator layer. New `review.decision_review.{tier,effort}` config; single-model
  default, cross-model panel when review.reviewers has providers (rests on Phase-1
  REV-01). Qualitative cost reporting. weight-budgets + COMMANDS.md + self-verify green.

Out:
- No ADR tree, no glossary import (DEC-01).
- No change to review-provider.mjs FINDING_SCHEMA or self-verify CONTRACTS - the
  ruling is adjudicator prose output, not a provider schema change (D-07).
- decision-review never auto-fires; no trigger wiring (D-11).
- No new decision-doc artifact type; the target is an existing CONTEXT.md decision
  or PROJECT.md Key Decisions row (D-11).
- No mechanical auto-selection handoff from durable flags to the review (D-12).
- No retrofitting of legacy phase 1/2 CONTEXT.md files (D-03).

Deferred: None.

Plan shape: multiple plans, same phase - PLAN-1 = DEC-01 (durability filter),
PLAN-2 = DEC-02 (/cad-decision-review). Cleanly separable; coupled only by the
human-judgment link.

## Decisions

- D-01 (Durability filter - prose, not a script): The three-part durability test
  (hard-to-reverse, surprising-without-context, result of a real trade-off) is
  applied as workflow-prose judgment in cad-context at the confirm/write steps; no
  new scoring seam. Evidence: cadence-core/workflows/context.md (confirm_decisions,
  write_context); PROJECT.md "prose keeps judgment, scripts keep invariants".
- D-02 (Durable-decisions heading): cad-context writes durable decisions under a
  new `## Durable decisions` heading; `## Decisions` holds the phase-local rest.
  Recall's parseContextDecisions retargets to the durable heading. Evidence:
  cadence-core/bin/lib/planning-files.mjs:161-165, :221-229; REQUIREMENTS.md DEC-01.
- D-03 (Legacy fallback - no break): a CONTEXT.md with no `## Durable decisions`
  heading has its `## Decisions` read as durable, so pre-v1.2.0 files keep
  resurfacing in recall unchanged and are not retrofitted. Evidence: PROJECT.md
  "existing .planning/ layouts must work unchanged; recall degrades to empty, never
  an error"; phases/1/CONTEXT.md, phases/2/CONTEXT.md.
- D-04 (New skill, auto-registered): DEC-02 ships as skills/cad-decision-review/SKILL.md,
  registered as a slash command via its name frontmatter; adds a weight-budgets.json
  entry + a COMMANDS.md row; no plugin.json change. Evidence: skills/cad-plan-review/SKILL.md;
  .claude-plugin/plugin.json; self-verify.mjs:246-260.
- D-05 (Workflow-backed): the procedure lives in cadence-core/workflows/decision-review.md,
  referenced by the skill via @execution_context (cad-context's pattern), keeping
  stable prose on a cached surface. Evidence: skills/cad-context/SKILL.md +
  cadence-core/workflows/context.md.
- D-06 (Reuse the review subsystem): refute -> adjudicate runs through the existing
  subsystem - cad-reviewer refutes, the main-model adjudicator grounds and rules.
  Single-model default (claude-subagent), cross-model panel when review.reviewers
  configures providers (rests on the Phase-1 REV-01 seam repair). Evidence:
  references/review-triggers.md; DESIGN.md:215-223; phases/1/CONTEXT.md.
- D-07 (Ruling is prose output): the per-objection `survives | partial | refuted`
  ruling + amendment list is the adjudicator's structured output, documented in
  prose; review-provider.mjs FINDING_SCHEMA and self-verify CONTRACTS stay
  unchanged. Evidence: DESIGN.md "main model = final verdict"; phases/1/CONTEXT.md
  D-06 (no-CONTRACTS-change precedent).
- D-08 (Context7 + codebase grounding, built now, adjudicator layer): the
  adjudicator verifies library/API claims live via Context7 and factual claims via
  the codebase (Read/Grep/Bash); Context7 is declared on the skill (main-model)
  surface, not the read-only cad-reviewer subagent. Evidence: agents/cad-reviewer.md
  (tools: Read/Bash/Glob/Grep); DESIGN.md:215-217.
- D-09 (Qualitative cost): "reports its cost honestly" = which providers/models/tiers
  ran + call count + effort, not a metered token/dollar figure (the runtime exposes
  no per-turn stats). Evidence: REQUIREMENTS.md:65 / PROJECT.md out-of-scope "live
  token telemetry"; references/consult.md:15.
- D-10 (Config group): new `review.decision_review.{tier,effort}` group parallel to
  review.consult.*; single-model default, cross-model when review.reviewers has
  providers; every new key prose-referenced. Evidence: config.schema.json:74-77
  (consult pattern); self-verify.mjs:235-239 (inert-config-key lint).
- D-11 (On-demand, existing doc): `/cad-decision-review <path>` runs on demand on an
  existing decision doc (a CONTEXT.md decision or a PROJECT.md Key Decisions row);
  no new artifact type, no auto-fire. Evidence: REQUIREMENTS.md DEC-02; ROADMAP.md.
- D-12 (Coupling is human judgment): durability (DEC-01) names which decisions merit
  the expensive DEC-02 pass, but the user invokes the review on a chosen decision -
  no mechanical handoff from a durable flag. Evidence: ROADMAP.md:23;
  REQUIREMENTS.md DEC-02.

## Acceptance criteria

- [ ] A CONTEXT.md written by the updated cad-context puts durable decisions under a
      `## Durable decisions` heading and keeps the rest under `## Decisions`.
- [ ] `planning.mjs recall <terms>` returns a file's `## Durable decisions` items and
      does not return that file's `## Decisions` items.
- [ ] Recall over a legacy CONTEXT.md that has only `## Decisions` (e.g. phases/1,
      phases/2) returns its decisions unchanged - no upgrade regression.
- [ ] `node --test cadence-core/bin/` (incl. new durable-parse / legacy-fallback /
      determinism tests), `tsc --checkJs`, and `self-verify.mjs` all pass.
- [ ] `/cad-decision-review <path>` returns, per objection, a
      `survives | partial | refuted` ruling + a concrete amendment list, and names
      the providers/models/effort that ran. (human-verify: needs a live skill run)
- [ ] Nothing auto-invokes it - a grep of the review-trigger wiring finds no
      decision-review fire; it runs only when called with a path.
- [ ] During a run the adjudicator verifies >=1 library/API claim against Context7
      and >=1 claim against the codebase. (human-verify: needs live Context7 + a run)
- [ ] With a cross-model provider configured, the run executes the panel via the
      repaired review seam and resolves the model from
      `review.decision_review.{tier,effort}`; single-model otherwise.
      (human-verify: needs a configured provider key)
- [ ] `self-verify.mjs` exits 0 with the new skill present: budgeted in
      weight-budgets.json, a COMMANDS.md row, every new config key prose-referenced
      (no inert-config-key / CONTRACTS drift).

## Flagged assumptions

- How a Claude Code skill declares and invokes the Context7 MCP tool in its
  allowed-tools frontmatter is not derivable from this codebase (zero MCP precedent;
  the review path grounds only via Read/Grep/Bash today) - Unclear; if wrong,
  Context7 access lands on the wrong surface and library-claim verification silently
  does not run. The planner resolves the exact tool-declaration name/shape (likely
  the Context7 MCP tool names added to the skill's allowed-tools).
- Whether `review.decision_review` needs a gate/enabled key beyond tier/effort is
  the planner's call; tier/effort is the minimum for cross-model model resolution.
