# Phase 12 O1 — live-host observation record

Host: Claude (Opus 5), at the orchestrator's direction. Owner review pending.
Date: 2026-09-10. Binary built from HEAD `de3d5bec`. Two runs on a disposable
python unittest project (three tasks: `answer`, `double`, `greet`; one check
per task). Run 1 stopped on the resume half because of the Stop finding below;
run 2 repeated the procedure to completion. This record assigns no verdict.

## What O1 names, and what was seen

| What O1 names | Seen | Evidence |
|---|---|---|
| The executor received a dispatch the binary composed from state naming its admitted checks | seen | Run 2 event 55: `execute-next` returned `outcome: dispatch` carrying `checks: [P2-T1-C, P2-T2-C, P2-T3-C]` with each check's owning task and spec. |
| A task close without a red commit was refused in the conversation naming the check | seen | Run 2 event 64: `execution-task-close` with no test committed refused `rule: red-green`, `id: answer`, `unsatisfied: [P2-T1-C]`. Tree byte-identical before and after. |
| The same task closed after the failing test and then the passing implementation were committed | seen | Run 2: red commit `b1827e2e` (exit 1, `failures: 1`), signed green commit `9f375975` (exit 0, same test digest), owner attestation, close accepted at event 97. |
| After stop and resume the executor was handed only the remaining tasks | seen | Run 2 event 112: on a fresh server, `execute-next` dispatched `tasks: [double, greet]` with `answer` listed under `completed`. |

Not asserted, as O1 says: whether a model executor obeys red-first and named
commands without being told twice. The executor role was played inline by the
host.

## Findings for the owner

1. **A Stop recorded with no checkpoint can never be continued.** Run 1 ended
   the session with `execution-authorize` `{disposition: stop}` and no
   `checkpoint` (accepted). On resume, `execute-next` refused
   `continuation-refusal`; naming the Stop's gate id or authorization id as
   `checkpoint` was refused `continuation-target`; a fresh approval with no
   checkpoint was accepted and ignored. `next_action/continuation.rs:160`
   continues a Stop only through a later approval naming the same
   checkpoint and requires `checkpoint_id.is_some()`. The checkpoint-linked
   Stop (run 2 appendix: `execution-task-checkpoint` answered `stop`, then
   `execution-authorize` with that `checkpoint`) continues correctly.
2. The rendered front door never names `execution-admit`, or that a freshly
   published plan must be admitted before `execute-next` can dispatch.
3. The front door says to pass the phase spelling unchanged; the wire accepts
   only an integer (`NonZeroU32`), and the string form refuses `invalid-patch`
   with no detail.
4. The front door says a retained Stop is continued by naming its checkpoint
   without saying what identifier that is.
5. The contract says "one signed conventional completion commit" without the
   subject rule or which keyring verifies it, and names
   `execution-owner-attest` without the `Inspection` fields.
6. `initialize` reports `serverInfo.version: 3.7.12`, as in the two earlier
   pilots.
7. Refusals on `execution-task-close` return `rule/slot/id/reason` with no
   `code`; `continuation-target` returns `code` plus `rule`. Two shapes on
   one tool.
8. `state-conflict` and `invalid-patch` on `execute-next` carry a generic
   reason; the cause (a ROADMAP `[x]` disagreeing with the derived lifecycle)
   was learned from `derivation/*.rs`.

Source was read in five places to get past the dispatch boundary (isolation
env in `tests/mcp.rs`, fixture keyring in `tests/phase12_execution.rs`, the
derivation refusal meanings, completion-commit validation in
`execution/receipts.rs`, Stop continuation). Once a dispatch existed, the
rendered front door and contract were sufficient for the whole task protocol.

## Departures from the stated procedure

- The completion commit was signed (the contract requires it and the server
  runs `git verify-commit`); seed and red commits stayed unsigned as
  instructed.
- Run 1's ROADMAP declared the seed phase `[x]`; `execute-next` refused
  `state-conflict`. The pilot setup file was corrected in place, and run 2
  started from the corrected shape.
- After the string phase was refused, `execute-next` was called with the
  integer.
