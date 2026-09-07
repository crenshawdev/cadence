---
name: cad-execute
description: "Execute a native phase through the binary's dispatch and executor-patch boundary."
argument-hint: "[phase number]"
allowed-tools:
  - mcp__cadence__cadence_query
  - mcp__cadence__cadence_apply
  - Task
---

<process>
1. Call `mcp__cadence__cadence_query` with `operation: "execute-next"` and the user's phase spelling unchanged as `phase`. Do not normalize, round, infer, default or repair it. The binary validates it.
2. Read the structured envelope. For `refused`, `unknown` or `not-applicable`, display its `code` and `reason` and stop. For `judgment-stop`, display the returned stop identifiers and any structured reason and stop. For `complete`, report completion and stop. For `dispatch`, proceed with the returned prompt.
3. Invoke `Task` with the fixed `cad-executor` and exactly the returned prompt. Add no instructions or context and dispatch no other agent.
4. Submit the executor's one JSON object field-for-field to `mcp__cadence__cadence_apply`. Preserve all keys, values, array order and judgment text. Do not classify, rewrite or interpret its deviations, blockers or evidence. If the executor returns no JSON object, report that failure and stop.
5. Follow the apply envelope: display `code` and `reason` and stop on `refused`, `unknown` or `not-applicable`; display the stop identifiers and any structured reason and stop on `judgment-stop`; report completion and stop on `complete`; repeat from step 1 on `next-plan`. If an envelope supplies `dispatch`, continue at step 3 with that prompt. A server or transport failure stops the loop with its returned failure.
</process>

The binary is the only continuation authority. Keep no local execution state,
inspect no project files and construct no alternate recovery path. This slice
has no operator-answer round trip. A fresh invocation starts with step 1.

For `undeclared-files`, the same display-and-stop rule applies. Show the binary's
reason, including the rejected-commit or staged-index disposition, without
interpreting paths, granting the executor an MCP tool or inventing a repair
loop. The operator controls any repair. A later invocation can query the same
open dispatch and submit a corrected full patch field-for-field; neither the
lease nor its fingerprint expands on retry. Never rewrite Git history or the
index to make a refused patch pass.
