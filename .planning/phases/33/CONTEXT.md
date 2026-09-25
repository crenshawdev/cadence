# Phase 33: Execution and verification under the boundary

## Scope boundary

Boundary-fix rule 8 (docs/architecture/boundary-fix.md:60) applied to the three operations that still put documents on the wire: execute-next, verify-next and the review operations. Today execute-next answers a prompt with the whole plan pasted in (34,559 bytes of an 81KB answer on 2026-09-17), verify-next answers a 2.8MB attempt whose inputs carry every capture as JSON integer arrays, and execution-history answers 1.7MB of events with no bound. After this phase: execute-next answers a dispatch id, a route and the identities the worker reads; the worker fetches the plan's pieces and its allocated checks through document by identity and reads run output as bounded text slices; progress, checkpoints and close stay the typed operations phase 12 built; the binary renders SUMMARY.md from the retained receipts (crates/cadence/src/execution/render.rs already renders the rows) and is its only writer; verify-next answers an attempt id and identities, and the verifier's patch names the attempt instead of copying the basis; review material reaches the binary by entry identity and findings return typed. Records from phases 12, 13, 27 to 30 are unchanged underneath. Writing source and tests stays with the worker's own edit tools. Closes with the token number for one executor round against the 3.7 median of 142k (.planning/ROADMAP.md:1467). Lease: crates/cadence/src/execution/, execution_service.rs, execution_runner_service.rs, verification/, verification_service.rs, review/, review_service.rs, read/, server.rs, the skills the binary renders, and their tests.

## Durable decisions

- D-185. execute-next answers {dispatch id, route, identities}; no prompt and no plan text. The worker's instructions are the compiled executor contract the binary renders (D-166); the per-dispatch facts (plan, tasks, allocated checks, lease, suite, admission identity) are read through document {kind: dispatch, id}. If wrong: the plan is pasted into every worker's context again.
- D-186. The document identity set grows by dispatch, run-output, verification-attempt and review-entry, and phase-plan gains goal, context, notes and evidence-map parts; today it serves only task parts, found 2026-09-17 when phase 32 plan 4 task 3 could not read its own fixture source through the contract. Every part obeys the 24,576-byte bound and continues like any other slice. If wrong: a worker still needs a path or a whole record.
- D-187. Retained run captures reach every caller as text through run-output, never as JSON integer arrays on the wire; the store side is GH-262 and GH-263 part 2. If wrong: verify-next stays 2.8MB.
- D-188. execution-history and verification-read answer a bounded index with parts, like document, never a whole event array or a whole attempt. Historical retained records keep their bytes; their wire projections are bounded and carry a digest where a document used to be; exact replay of an old request answers the old receipt, not the old document.
- D-189. verify-next answers {attempt id, basis identities, route}; verification-submit names the attempt id and carries item verdicts only. The verifier reads the map, the checks and the run outputs through document.
- D-190. Local review reaches material by review-entry identity; review-material-append takes identities, not bytes. A paid provider with no project tools keeps the binary-to-provider artifact wire (crates/cadence/src/review/provider/payload.rs:24): the binary's own outbound delivery, retained and line-mapped as today. That wire is not the MCP wire, is not under rule 8, and is not measured by this phase; bringing it under the boundary needs the provider to have tools, which is the provider's decision.
- D-193. review-return takes typed findings, the five-field envelope the binary already parses into Finding (crates/cadence/src/review/returns.rs:72), not a raw document; a malformed finding is refused by its index; the receipt answers a digest and a count and never echoes the findings back.

## Decisions

- D-191. Phase-local. The close measurement is the token count the worker's host reports for one executor round, one plan from dispatch to last close, compared with the 3.7 executor median of 142k. Bytes on the MCP wire are recorded beside it as phase 32 did (D-184) but are not the acceptance number. The record states what the 3.7 median counted, so the comparison names its basis rather than claiming like for like.
- D-192. Phase-local. Dispatch lookup by id binds to the state the id was issued for; a changed task, plan or source answers a located refusal naming the changed part, the shape phase 32 gave a stale draft.

## Truths

- T1. When the orchestrator asks execute-next for a phase with an admitted plan, the orchestrator gets a dispatch id and a route and no prompt or plan text in the answer.
- T2. When a worker reads its dispatch by id through document, the worker gets the plan's goal, context, notes, its tasks and its allocated checks as parts, each within the read bound.
- T3. When a worker closes the last task of a plan, the owner sees a SUMMARY.md the binary rendered from the retained receipts, with no summary text having crossed the wire.
- T4. When the verifier asks verify-next, the verifier gets an attempt id and identities and no attempt inputs or captures in the answer.
- T5. When any caller reads a retained run's output by identity, the caller gets a bounded text slice that says where to continue.
- T6. When a reviewer returns findings for a plan, the reviewer gets a digest and a count for the typed findings and no findings echoed back.
- T7. When one executor round runs under the boundary, the owner sees that round's token number beside the 3.7 median of 142k.

## Flagged assumptions

- The compiled executor contract stays the worker's instruction source; nothing per dispatch needs to travel in a prompt once the dispatch is readable by id.
- A worker has the same MCP server as the main thread (Codex through .codex/config.toml) and never defines its own.
- The 142k median is executor tokens per plan in 3.7; if it was per task, T7's comparison basis changes and the owner names it.
- Text captures (GH-262) land in this phase or before it; T4 and T5 depend on them.
