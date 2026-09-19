---
phase: 14
plan: 5
requirements: ["T4"]
files: ["crates/cadence/src/suggest_service.rs","crates/cadence/src/suggest/mod.rs","crates/cadence/src/suggest/rules.rs","crates/cadence/src/suggest/instructions.rs","crates/cadence/src/lib.rs","crates/cadence/src/main.rs","crates/cadence/src/server.rs","crates/cadence/src/recall/mod.rs","crates/cadence/tests/phase14_receipts.rs","crates/cadence/tests/support/phase14.rs","crates/cadence/tests/mcp.rs","skills/cad-suggest/SKILL.md"]
directories: ["crates/cadence/src/suggest"]
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P14-5-T1","verify":["cargo nextest run -p cadence --test phase14_receipts phase14_suggest_prices_from_routing_decisions_and_writes_nothing"]},{"id":"P14-5-T2","verify":["cargo nextest run -p cadence --test phase14_receipts phase14_suggest_prices_from_routing_decisions_and_writes_nothing","cargo nextest run -p cadence --test mcp"]}]}
---
## Goal

Retune suggestions from the decisions log: config key, value in force, proposed value, the decisions counted and the exact config-apply payload; the query writes nothing.

## Must be true when done

- T4. When the owner asks for retune suggestions, the owner gets each suggestion with its config key, the value in force, the proposed value and the decisions it counted, with no config key changed.

## Context

T4 and the roadmap's cad-suggest paragraph. A native dispatch writes the decision `routing:<dispatch id>` with the whole DispatchRoute in crates/cadence/src/store/writer.rs; an imported 3.x `routing/resolve` row keeps escalated and attempt in its choice (crates/cadence/src/import/decisions.rs). Effective keys are roles.<role>.effort and roles.<role>.model (crates/cadence/src/config/roles.rs); the write path is config-apply in crates/cadence/src/config_service.rs. The 3.x floors and rule R3 in cadence-core/bin/lib/trace-suggest.mjs are frozen reference. At HEAD nothing routes above attempt 1, so escalated decisions come only from an adopted 3.x record, as on this project's own tree. Progress grammar and common setup: phase 14 plan 1, context and notes parts.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P14-T4-C",
      "spec": {
        "command": "cargo nextest run -p cadence --test phase14_receipts phase14_suggest_prices_from_routing_decisions_and_writes_nothing",
        "expected": {
          "kind": "literal",
          "value": "Unscoped: exactly one priced suggestion with key `roles.cad-executor.effort`, layer `repo`, current `high`, proposed `xhigh`, evidence.counted 5, evidence.escalated 2, evidence.decisions the five routing decision ids, and apply equal to {operation `config-apply`, layer `repo`, updates [{key `roles.cad-executor.effort`, value `xhigh`}]}; a gate entry with key `review.triggers.diff.gate`, priced false, counted 1. Scoped to phase 13: priced false, counted 2. Scoped to phase 12: the same suggestion with counted 3, escalated 2. config-facts after equals config-facts before; the config bytes are identical; the answer after restart equals the first; no config-apply receipt exists beyond the fixture's own. `cadence suggest-instructions` stdout equals skills/cad-suggest/SKILL.md."
        },
        "test": {
          "file": "crates/cadence/tests/phase14_receipts.rs",
          "function": "phase14_suggest_prices_from_routing_decisions_and_writes_nothing"
        },
        "setup": "Completed::published(false, prepare) from crates/cadence/tests/support/phase13.rs; prepare writes .planning/trace.jsonl with three 3.x routing/resolve rows for cad-executor at phase 12 in the fields the import reads: effort high, attempt 1, escalated false; agent cad-executor-xhigh, effort xhigh, attempt 2, escalated true, twice. Completed::execute then adds two native cad-executor dispatches at phase 13, attempt 1. After first touch, config-apply {layer repo, updates [{key roles.cad-executor.effort, value high}]}; one review fire with a failing gate admitted through review-admit as crates/cadence/tests/phase13_verification.rs does. Record the config.v4.json bytes and the config-facts answer.",
        "call": "suggest; suggest phase 13; suggest phase 12; config-facts; restart; suggest; read the config bytes.",
        "boundary": "real import of the 3.x rows, real native dispatch routing, real config layers read back, real suggest query over stdio",
        "fakes": [
          "the caller's inputs",
          "the test's own clock window read around each call"
        ]
      },
      "reason": "Counting the wrong decisions, proposing a rung never landed on, naming a legacy key, omitting the value in force, or writing a key would break every field T4 promises.",
      "associations": [
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "The owner asks for retune suggestions and gets each with its config key, the value in force, the proposed value and the decisions it counted, with no key changed: T4 word for word."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P14-T4-A1",
      "spec": {
        "locators": [
          "crates/cadence/src/suggest/rules.rs",
          "crates/cadence/src/suggest_service.rs"
        ],
        "substance": "The read-only suggest query: routing decisions per role from native and imported records, review fires per trigger, compiled floors, priced suggestions with key, current, proposed, counted decisions and the exact config-apply payload."
      },
      "reason": "A suggestion without its counted decisions or payload cannot be checked or accepted.",
      "associations": [
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "It is the query that produces every field T4 names."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P14-T4-A2",
      "spec": {
        "locators": [
          "crates/cadence/src/suggest/instructions.rs",
          "skills/cad-suggest/SKILL.md"
        ],
        "substance": "The compiled cad-suggest front door relaying figures unchanged and sending an accepted payload verbatim."
      },
      "reason": "A door that re-derived a value or applied before asking would change a key the owner never accepted.",
      "associations": [
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "T4 ends with no config key changed; the door is where that would be broken."
        }
      ]
    },
    {
      "kind": "link",
      "id": "P14-T4-L",
      "spec": {
        "caller": "cadence_query suggest",
        "callee": "cadence_apply config-apply",
        "value": "proposed value"
      },
      "reason": "The suggestion's proposed value is exactly the value its carried config-apply payload writes on acceptance; a payload that differed would change a key the owner did not accept.",
      "associations": [
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "T4 names the proposed value the owner gets; the link carries it unchanged to the write path."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Price suggestions from routing decisions and gate fires, writing nothing

- **ID:** P14-5-T1
- **Files:** crates/cadence/src/suggest_service.rs, crates/cadence/src/suggest/mod.rs, crates/cadence/src/suggest/rules.rs, crates/cadence/src/lib.rs, crates/cadence/src/server.rs, crates/cadence/src/recall/mod.rs, crates/cadence/tests/phase14_receipts.rs, crates/cadence/tests/support/phase14.rs
- **Action:** Deliver P14-T4-C, P14-T4-A1 and P14-T4-L. Add cadence_query {operation: suggest, phase?} over a read-verified view: routing decisions per role from native route records and imported choice rows, scoped by the dispatch's phase or the row's phase; review fires per trigger with the gate outcome. Rules and floors compiled, never printed: R3 rung pressure at two or more escalations proposes the landed rung for roles.<role>.effort; the gate rule at two or more fires; rung information at four or more decisions with none escalated. A priced suggestion is {key, layer, current, proposed, evidence: {counted, escalated, decisions: [ids]}, apply: {operation config-apply, layer, updates: [{key, value: proposed}]}} with current the value in force and layer the layer holding it, else repo; below a floor {key, priced false, counted}. No writer, no key changed; acceptance is the owner sending `apply` to config-apply unchanged.
- **Verify:**
  - cargo nextest run -p cadence --test phase14_receipts phase14_suggest_prices_from_routing_decisions_and_writes_nothing

### Task 2: Compile the cad-suggest front door

- **ID:** P14-5-T2
- **Files:** crates/cadence/src/suggest/instructions.rs, crates/cadence/src/main.rs, crates/cadence/tests/mcp.rs, skills/cad-suggest/SKILL.md
- **Action:** Deliver P14-T4-A2. Add `cadence suggest-instructions` rendering suggest::instructions::markdown(); regenerate skills/cad-suggest/SKILL.md from it: one suggest call, print every key, current, proposed and counted decisions as returned, show each priced apply payload, ask, send it unchanged through mcp__cadence__cadence_apply on acceptance, nothing on decline, nothing before asking; no SlashCommand, no planning.mjs, no re-derived value. Extend the skill pin in crates/cadence/tests/mcp.rs.
- **Verify:**
  - cargo nextest run -p cadence --test phase14_receipts phase14_suggest_prices_from_routing_decisions_and_writes_nothing
  - cargo nextest run -p cadence --test mcp

## Notes

Execution rules: phase 14 plan 1, notes part. The escalated decisions are imported 3.x rows read by the real import, because no native operation routes above attempt 1 at HEAD and the continuation gate of plan 4 forbids the one re-serve that could; the native dispatches in the same fixture prove the native reader; token pricing per dispatch is not built (P2, no source in 4.0).
