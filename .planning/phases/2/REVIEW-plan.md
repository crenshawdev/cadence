# Phase 2 - `plan` trigger review

Fired 2026-08-23, gate `blocking` at `shipped` stakes.
Reviewer: cross-model `openai`, model `gpt-5.6-terra`, tier `balanced`, effort `medium`.
Payload: shape (c) - PLAN-1/2/3, CONTEXT.md, ROADMAP.md, REQUIREMENTS.md.

Outcome: **PASS**. Two findings, both `medium`; no `blocker` and no `high`, so
nothing was fixed at this gate. Both are carried here as open items for
`/cad-execute` and `/cad-verify` to pick up.

## Open items from this fire

### 1. PLAN-2.md:52 - medium - the refusal path may leave no outcome record

**Claim:** the trace-event task does not deliver D-08's requirement to append an
attempted outcome on every path past argument validation, including a valid
`cite-count --phase N` invocation refused for missing `--payload`.

**Failure scenario:** PLAN-1 defines the builtin/no-payload case as a
handler-level refusal. PLAN-2 requires the event to carry surfaced/cited figures
and id lists, which cannot be computed without the payload, but provides no event
shape or task for this refusal path. An implementation can therefore return the
required `ok:false` envelope without an outcome record, leaving the trace unable
to distinguish a count attempt rejected for missing provenance from no count
attempt at all - the exact attempted-check gap D-08 cites as the `risk-check`
precedent.

### 2. PLAN-2.md:119 - medium - AC3's no-edit guarantee can ship unproven

**Claim:** task 5's proposed human verification cannot falsifiably prove that the
first count left the plan bytes unchanged.

**Failure scenario:** the verification inspects `git diff --stat` only after the
workflow run, but the workflow intentionally includes later checker and
adjudication steps that may edit the same plan before commit. A clean final diff
does not prove the count did not mutate the file, and a non-clean diff cannot
attribute a mutation to the count rather than those later authorized edits. No
task snapshots or compares the plan immediately before and immediately after
either count invocation, so AC3's no-edit guarantee can ship unproven.
