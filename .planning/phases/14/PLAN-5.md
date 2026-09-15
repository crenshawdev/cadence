---
phase: 14
plan: 5
requirements: ["T4"]
files: ["crates/cadence/src/suggest_service.rs","crates/cadence/src/lib.rs","crates/cadence/src/main.rs","crates/cadence/src/server.rs","crates/cadence/src/recall/mod.rs","crates/cadence/tests/phase14_receipts.rs","crates/cadence/tests/support/phase14.rs","skills/cad-suggest/SKILL.md"]
directories: ["crates/cadence/src/suggest"]
execution: {"schema":1,"suite":"cargo test --workspace --no-fail-fast","tasks":[{"id":"P14-5-T1","verify":["cargo test -p cadence --test phase14_receipts phase14_suggest_prices_from_routing_decisions_and_writes_nothing -- --exact"]},{"id":"P14-5-T2","verify":["cargo test -p cadence --test phase14_receipts phase14_suggest_prices_from_routing_decisions_and_writes_nothing -- --exact","cargo run -p cadence -- suggest-instructions"]}]}
---
# Phase 14: Receipts and retune - Plan 5

## Goal

Retune suggestions from the decisions log: key, value in force, proposed value, counted decisions and
the exact `config-apply` payload; the query writes nothing.

## Must be true when done

- T4. When the owner asks for retune suggestions, the owner gets each suggestion with its config key, the value in force, the proposed value and the decisions it counted, with no config key changed.

## Context

A native dispatch writes `routing:<dispatch id>` with the whole `DispatchRoute` (`store/writer.rs:2008-2042`);
an imported 3.x `routing/resolve` row carries `escalated` and `attempt` in `choice` (`import/decisions.rs:57-63`).
Effective keys `roles.<role>.effort`/`.model` (`config/roles.rs:76-116`); the write path is `config-apply`
(`config_service.rs:19-31`, `:435-449`). 3.x floors and R3 (`lib/trace-suggest.mjs:58-68`, `:506-533`) are
kept. At HEAD nothing routes above attempt 1 (`execution_service.rs:878`, `:1082`; `review_service.rs:276`),
so escalated decisions come from an adopted 3.x record, as on this project's own tree. Common setup and the progress text grammar: PLAN-1.md, the two sections of those names.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P14-T4-C",
      "spec": {
        "command": "cargo test -p cadence --test phase14_receipts phase14_suggest_prices_from_routing_decisions_and_writes_nothing -- --exact",
        "expected": {
          "kind": "literal",
          "value": "Unscoped: exactly one priced suggestion, `key: \"roles.cad-executor.effort\"`, `layer: \"repo\"`, `current: \"high\"`, `proposed: \"xhigh\"`, `evidence.counted: 5`, `evidence.escalated: 2`, `evidence.decisions` the five routing decision ids, `apply` = `{\"operation\":\"config-apply\",\"layer\":\"repo\",\"updates\":[{\"key\":\"roles.cad-executor.effort\",\"value\":\"xhigh\"}]}`; gate entry `key: \"review.triggers.diff.gate\"`, `priced: false`, `counted: 1`. Phase 13: `priced: false`, `counted: 2`. Phase 12: the same suggestion with `counted: 3`, `escalated: 2`. `config-facts` after equals before; config bytes identical; the answer after restart equals the first; no `config-apply` receipt beyond the fixture's own. `cadence suggest-instructions` stdout equals `skills/cad-suggest/SKILL.md`."
        },
        "test": {
          "file": "crates/cadence/tests/phase14_receipts.rs",
          "function": "phase14_suggest_prices_from_routing_decisions_and_writes_nothing"
        },
        "setup": "`Completed::published(false, prepare)`; `prepare` writes `.planning/trace.jsonl` with three 3.x `routing/resolve` rows for `cad-executor` at phase 12 (`import/decisions.rs:57-63` fields): effort `high` attempt 1 escalated false; agent `cad-executor-xhigh` effort `xhigh` attempt 2 escalated true, twice; `Completed::execute()` then adds two native cad-executor dispatches at phase 13, attempt 1. After first touch `config-apply {layer:\"repo\",updates:[{key:\"roles.cad-executor.effort\",value:\"high\"}]}`; one review fire with a failing gate admitted through `review-admit` as `tests/phase13_verification.rs:961` does. Record `config.v4.json` bytes and the `config-facts` answer.",
        "call": "`suggest`; `suggest` phase 13; `suggest` phase 12; `config-facts`; restart; `suggest`; read the config bytes.",
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
          "reason": "Counting the wrong decisions, proposing a rung never landed on, naming a legacy key, omitting the value in force, or writing a key would break every field T4 promises."
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
          "reason": "A suggestion without its counted decisions or payload cannot be checked or accepted."
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
        "substance": "The compiled cad-suggest front door relaying figures unchanged, sending an accepted payload verbatim."
      },
      "reason": "A door that re-derived a value or applied before asking would change a key the owner never accepted.",
      "associations": [
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "A door that re-derived a value or applied before asking would change a key the owner never accepted."
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
          "reason": "The suggestion's proposed value is exactly the value its carried config-apply payload writes on acceptance; a payload that differed would change a key the owner did not accept."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Price suggestions from routing decisions and gate fires, writing nothing

- **Files:** the lease; new `suggest/`, `suggest_service.rs`.
- **Action:** Deliver P14-T4-C, P14-T4-A1, P14-T4-L. Add `cadence_query
  {"operation":"suggest","phase":N?}` over a `ReadVerified` view: routing decisions per role from native
  `route` and imported `choice`, scoped by the dispatch's phase or `choice.phase`; review fires per trigger
  with gate outcome. Rules, floors compiled and never printed: R3 rung pressure at two or more
  escalations proposing the landed rung for `roles.<role>.effort`; the gate rule at two or more fires;
  rung information at four or more decisions with none escalated. A priced suggestion is `{key, layer,
  current, proposed, evidence:{counted, escalated, decisions:[ids]}, apply:{"operation":"config-apply",
  "layer":<layer>,"updates":[{"key":<key>,"value":<proposed>}]}}` with `current` the value in force
  and `layer` the layer holding it, else `repo`; below a floor `{key, priced:false, counted}`. No writer,
  no key changed; acceptance is the owner sending `apply` to `config-apply` unchanged.
- **Verify:** `cargo test -p cadence --test phase14_receipts phase14_suggest_prices_from_routing_decisions_and_writes_nothing -- --exact`.

### Task 2: Compile the cad-suggest front door

- **Files:** `suggest/instructions.rs`, `main.rs`, `skills/cad-suggest/SKILL.md`.
- **Action:** Deliver P14-T4-A2. `cadence suggest-instructions` renders `suggest::instructions::markdown()`;
  regenerate `skills/cad-suggest/SKILL.md`: one `suggest` call, print every key, current, proposed and
  counted decisions as returned, show each priced `apply` payload, ask, send it unchanged through
  `mcp__cadence__cadence_apply` on acceptance, nothing on decline, nothing before asking; no
  `SlashCommand`, no `planning.mjs`, no re-derived value.
- **Verify:** `cargo test -p cadence --test phase14_receipts phase14_suggest_prices_from_routing_decisions_and_writes_nothing -- --exact`.

## Notes

Execution rules: PLAN-1.md Notes. The escalated decisions are imported 3.x rows read by the real import, because no native
operation routes above attempt 1 at HEAD and D-141 forbids the one re-serve that could; the native
dispatches in the same fixture prove the native reader; token pricing is not built (P2).
