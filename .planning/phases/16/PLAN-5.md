---
phase: 16
plan: 5
requirements: ["T5"]
files: ["crates/cadence/src/debug_consult_tests.rs","crates/cadence/src/debug/mod.rs","crates/cadence/src/debug/model.rs","crates/cadence/src/debug/render.rs","crates/cadence/src/debug_service.rs","crates/cadence/src/server.rs","crates/cadence/src/review_service.rs","crates/cadence/src/review/provider/mod.rs","crates/cadence/src/review/provider/consult.rs","crates/cadence/src/review/provider/openai.rs","crates/cadence/src/review/provider/deepseek.rs","crates/cadence/src/review/provider/gemini.rs","crates/cadence/src/review/provider/payload.rs","crates/cadence/src/review/provider/records.rs","crates/cadence/src/review/provider/usage.rs","crates/cadence/src/store/writer.rs","crates/cadence/src/store/transaction.rs","crates/cadence/tests/mcp.rs","crates/cadence/src/debug/instructions.rs","skills/cad-debug/SKILL.md","cadence-core/bin/weight-budgets.json","cadence-core/bin/review-provider.mjs","cadence-core/bin/review-provider.test.mjs","cadence-core/bin/config-seams.test.mjs","cadence-core/bin/lib/arg-contract.mjs","cadence-core/bin/arg-contract.test.mjs","cadence-core/bin/helper-census.test.mjs","cadence-core/bin/lib/census-registry.mjs","crates/cadence/src/recall/mod.rs","cadence-core/references/consult.md"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P16-5-T1","verify":["cargo nextest run -p cadence --bin cadence debug_consult_is_offered_once_per_dead_end"]},{"id":"P16-5-T2","verify":["cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions"]},{"id":"P16-5-T3","verify":["node --test cadence-core/bin/review-provider.test.mjs","node --test --test-name-pattern='review-provider:' cadence-core/bin/config-seams.test.mjs","node --test cadence-core/bin/arg-contract.test.mjs","node --test cadence-core/bin/helper-census.test.mjs"]}]}
---
## Goal

Offer one recorded consult at each debug dead end and persist the accepted provider's investigative angles.

## Must be true when done

- T5. When a debug session records a dead-end (the attempt count at review.consult.attempt_threshold, every hypothesis refuted), the owner sees the consult offered once for that dead-end, only when review.consult.enabled is true and a provider model exists at the tier, and the angles recorded on the record when accepted.

## Context

Depends on plans 1–4. Consult configuration is already keep-resemantic: crates/cadence/src/config/schema.json:718 defines review.consult and crates/cadence/src/config/schema.json:446 defines memory.backend. The existing provider port dispatches adapters at crates/cadence/src/review/provider/mod.rs:33. OpenAI and DeepSeek URLs are compiled at crates/cadence/src/review/provider/openai.rs:28 and crates/cadence/src/review/provider/deepseek.rs:14. Scripted transport/credential boundaries are demonstrated at crates/cadence/src/phase10_provider_tests.rs:9 and crates/cadence/src/phase10_provider_tests.rs:37. These tests are included in the binary service at crates/cadence/src/review_service.rs:1605, not the library. The frozen consult arm is cadence-core/bin/review-provider.mjs:1410; the shared prompt-cap tests currently invoke it through cadence-core/bin/config-seams.test.mjs:587.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P16-T5-C",
      "spec": {
        "command": "cargo nextest run -p cadence --bin cadence debug_consult_is_offered_once_per_dead_end",
        "expected": {
          "kind": "literal",
          "value": "Before the configured trigger, when disabled, or without a model for the configured tier: zero offers and zero provider requests. Exactly one durable offer per dead-end epoch on either trigger; decline is remembered, acceptance spends once, changed-input replay refuses. Accepted request names fixture-consult and configured effort, carries fenced/capped situation derived from that debug record, and uses the consult angles schema. Literal hypothesis/rationale/how_to_check values survive restart in the record and rendering; provider-returned angles are suggestions, never automatic fixes, decisions or resolutions. A new observation permits one next offer, while repeated reads/failed attempts in the same dead end do not."
        },
        "test": {
          "file": "crates/cadence/src/debug_consult_tests.rs",
          "function": "debug_consult_is_offered_once_per_dead_end"
        },
        "setup": "Create independent native-initialized Store/config fixtures through the same debug service used by serve, using real temporary Git repositories. Use effective config attempt_threshold=2, enabled=true, tier=flagship, effort=high, and OpenAI tier model fixture-consult. Inject a Wire-shaped transport and fixture credential source as in phase10_provider_tests.rs, without copying its direct snapshot seeding. Script a valid provider response containing handwritten angles [{hypothesis:'cache key omits tenant', rationale:'two tenants share an entry', how_to_check:'compare keys for tenant A and B'}]. Separate fixtures cover enabled=false, absent provider tier model, threshold 2 with one/two failed attempts, and all two recorded hypotheses refuted before threshold; an empty hypothesis list is not a dead end.",
        "call": "Call debug-open/hypothesis/attempt/observation through the real service operation route. Read status before threshold, at threshold, after the third failed attempt and repeatedly after restart. Decline an offer and continue the same dead end; accept one in a separate case, repeat its request ID and continue again. Exercise the all-refuted OR branch independently. A genuinely new recorded observation starts the next investigative epoch; merely another failed attempt or status read does not. Accept the next epoch's offer once. Capture actual adapter requests, return scripted HTTP response bytes through Transport, then reopen the service and read the persisted consult record and rendered debug document.",
        "boundary": "In-crate binary-target test invokes the same debug service used by cadence serve, with real config, Store and journal; only credentials, clock/sleep and provider HTTP transport are injected. No fake offer, adapter, payload validation or persistence.",
        "fakes": [
          "Caller configuration and operation inputs in a temporary real repository",
          "Scripted provider transport and fixture credential input, with clock/sleep controlled"
        ]
      },
      "reason": "Changing the trigger-to-record/readback behavior described here must fail this truth's single check.",
      "associations": [
        {
          "truth_id": "T5",
          "truth_version": 1,
          "reason": "Changing the trigger-to-record/readback behavior described here must fail this truth's single check."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P16-T5-A1",
      "spec": {
        "locators": [
          "crates/cadence/src/debug/model.rs",
          "crates/cadence/src/debug_service.rs"
        ],
        "substance": "Durable consult offer, eligibility, dead-end epoch, decline/accept state and angles on the debug record. Effective review.consult enabled/tier/effort/attempt_threshold policy and configured provider model selection govern offers, with no empty-list vacuity and no automatic spend."
      },
      "reason": "Removing or weakening this artifact breaks the named record, operation or compiled front door required by T5.",
      "associations": [
        {
          "truth_id": "T5",
          "truth_version": 1,
          "reason": "Removing or weakening this artifact breaks the named record, operation or compiled front door required by T5."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P16-T5-A2",
      "spec": {
        "locators": [
          "crates/cadence/src/review/provider/consult.rs",
          "crates/cadence/src/review/provider/mod.rs",
          "crates/cadence/src/review/provider/openai.rs",
          "crates/cadence/src/review/provider/deepseek.rs",
          "crates/cadence/src/review/provider/gemini.rs"
        ],
        "substance": "Consult arm on the native provider port returning typed angles; existing credential, prompt fence/cap, bounded transport, extraction, diagnostics and usage recording reused. Keep review findings payload/schema behavior unchanged."
      },
      "reason": "Removing or weakening this artifact breaks the named record, operation or compiled front door required by T5.",
      "associations": [
        {
          "truth_id": "T5",
          "truth_version": 1,
          "reason": "Removing or weakening this artifact breaks the named record, operation or compiled front door required by T5."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Deliver the consult service and its one red-then-green check

- **ID:** P16-5-T1
- **Files:** crates/cadence/src/debug_consult_tests.rs, crates/cadence/src/debug/mod.rs, crates/cadence/src/debug/model.rs, crates/cadence/src/debug/render.rs, crates/cadence/src/debug_service.rs, crates/cadence/src/server.rs, crates/cadence/src/review_service.rs, crates/cadence/src/review/provider/mod.rs, crates/cadence/src/review/provider/consult.rs, crates/cadence/src/review/provider/openai.rs, crates/cadence/src/review/provider/deepseek.rs, crates/cadence/src/review/provider/gemini.rs, crates/cadence/src/review/provider/payload.rs, crates/cadence/src/review/provider/records.rs, crates/cadence/src/review/provider/usage.rs, crates/cadence/src/store/writer.rs, crates/cadence/src/store/transaction.rs, crates/cadence/tests/mcp.rs, crates/cadence/src/recall/mod.rs
- **Action:** Deliver the check above red first, then green. Extend debug apply with an explicit accept/decline operation bound to the recorded offer and epoch; eligibility is recorded when attempts/hypotheses cause the trigger, not when the host remembers to ask. Read effective config through the existing merge/policy path; preserve enabled=false, flagship/high and threshold3 defaults. Retain the chosen provider/model and typed angles on the record. Register the subject-named test under the binary debug service; expose a test-only transport/credential/time seam at the same native provider boundary as phase10_provider_tests, with production using Native transport. Add a consult-specific schema/request path to all three adapters while preserving the review wrapper. Reuse credential lookup, payload fence and cap, response/usage records and existing timeout/body limits; do not route through JavaScript. Journal offer/accepted intent/result identities, reject concurrent duplicate acceptance and do not automatically repeat an uncertain external spend after restart. Persist returned angles through the Store before reporting success. In this task's green commit only, measure the serialized tools/list result.tools bytes using the existing mcp pin, and move both byte-bound literals (10_304 at HEAD, crates/cadence/tests/mcp.rs:305 and crates/cadence/tests/mcp.rs:1626) once to that measured value plus a small 64-byte margin. Preserve the three-tool inventory. Record the measurement in the commit; do not guess a future bound or perform GH-271's separate description cut. Thread the consult command through the existing debug resident request, without recursively awaiting its mailbox.
- **Verify:**
  - cargo nextest run -p cadence --bin cadence debug_consult_is_offered_once_per_dead_end

### Task 2: Render the compiled consult interaction

- **ID:** P16-5-T2
- **Files:** crates/cadence/src/debug/instructions.rs, skills/cad-debug/SKILL.md, crates/cadence/tests/mcp.rs, cadence-core/bin/weight-budgets.json
- **Action:** Extend debug-instructions with the effective-config offer trigger, one offer per dead end, explicit owner acceptance/decline, and grounding each recorded angle against the repository. Preserve the scientific debugging steps and keep Task, cadence_apply, cadence_query, Write, Edit, Bash, AskUserQuestion. Regenerate installed bytes, update the debug body pin and matching budget. Rendered-files count remains 21. This task adds no operation and does not move the tools/list bound again.
- **Verify:**
  - cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions

### Task 3: Retire the frozen consult executable, reference and executable tests

- **ID:** P16-5-T3
- **Files:** cadence-core/bin/review-provider.mjs, cadence-core/bin/review-provider.test.mjs, cadence-core/bin/config-seams.test.mjs, cadence-core/bin/lib/arg-contract.mjs, cadence-core/bin/arg-contract.test.mjs, cadence-core/bin/weight-budgets.json, cadence-core/bin/helper-census.test.mjs, cadence-core/bin/lib/census-registry.mjs, cadence-core/references/consult.md
- **Action:** Remove only cmdConsult, its command dispatch/help entry, CONSULT_SCHEMA, validateConsult and consult-only exports from review-provider.mjs; leave the review and detect-models arms and shared transport/auth/parser code untouched. Remove validateConsult and consult CLI cases from review-provider.test.mjs; split mixed consult/review/detect cases so surviving behavior remains checked. Its consult fault/fence/trace executable subcases disappear with that arm; keep historical consult trace interpretation in trace.test.mjs. Replace config-seams.test.mjs consultOverCap with the surviving review arm and a valid over-cap review payload so the global and repo prompt-cap seams keep their literal expected caps. Remove only the consult argument-contract row and adjust any corresponding literal row counts. Update affected helper census/registry and weight-budget entries to the measured surviving executable; do not remove the review-provider helper row. Delete cadence-core/references/consult.md and remove its entry at cadence-core/bin/weight-budgets.json:40. Leave the frozen prose naming references/consult.md in cadence-core/workflows/plan.md:272, cadence-core/workflows/execute.md:450, cadence-core/references/config-reach.md:193, cadence-core/references/seam-review-provider.md:19, METHOD.md:466 and METHOD.md:663 untouched under the owner's ruling and the phase 15 precedent that deleted cadence-core/bin/git-publish.mjs while leaving cadence-core/references/git-publish.md:26 naming it. No other frozen reference or risk-check.mjs is deleted here.
- **Verify:**
  - node --test cadence-core/bin/review-provider.test.mjs
  - node --test --test-name-pattern='review-provider:' cadence-core/bin/config-seams.test.mjs
  - node --test cadence-core/bin/arg-contract.test.mjs
  - node --test cadence-core/bin/helper-census.test.mjs

## Notes

T5 intentionally uses an in-crate binary-target service test, the permitted equivalent of --lib. A stdio test cannot reach the compiled provider URLs through a scripted transport. The service, effective config, adapters, parser and Store remain real; only provider transport, credentials and time are injected. Keep the existing review arm intact. The owner ruled that the frozen consult executable and cadence-core/references/consult.md are both deleted while the frozen prose naming the reference stays untouched, following phase 15's deletion of cadence-core/bin/git-publish.mjs with cadence-core/references/git-publish.md:26 still naming it.

Execute plans 1 through 7 sequentially, never concurrently. Repeated file leases extend only this plan's named surface and preserve earlier work. New paths, operation shapes and test functions below are creation specifications, not claims that they exist at HEAD. content.suite and typed tasks let the binary derive execution.schema=1, execution.suite and stable task verify arrays; do not submit an execution field. The check-delivering task records its one test red before implementation and green afterwards; later tasks use narrow regressions and create no additional evidence checks. No observation items. All records, replay identities and rendered projections use the existing Store request interface and sole journal, with root binding, expected generation and idempotent request IDs. Reject changed-input replay; never add a sidecar authority. D-207 side jobs are outside these leases. Phase 17 owns further contract enforcement; phase 18 owns absence/live-host acceptance; phase 21 owns its additional-round allowance and deferred settlement. Debug/spike records are not added to recall's corpus.

Falsification finding 2 of .codex-analysis/phase16-falsification.md corrected this plan on 2026-09-20; the owner ruled that references/consult.md is deleted with the executable.
