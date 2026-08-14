# Task: token-burn contract edits

Two prose rules that cut dispatch burn without touching model or effort.
Both land before phase 4 planning so the phase-4 run measures them.

## Task 1: batch-probes rule in the five worker contracts

Files: `skills/cad-assumptions-analyzer-contract/SKILL.md`,
`skills/cad-executor-contract/SKILL.md`,
`skills/cad-verifier-contract/SKILL.md`,
`skills/cad-plan-checker-contract/SKILL.md`,
`skills/cad-planner-contract/SKILL.md`,
`cadence-core/bin/weight-budgets.json`

Action: add the same one-line rule to each contract - independent probes
(reads, greps, globs whose target does not depend on another's result) go out
in ONE message, never one-then-wait; a probe chosen from a prior result stays
sequential. Scope it to INDEPENDENT probes only: forced batching of dependent
probes fires speculative calls whose unneeded output costs more than the saved
turns. Re-pin any budget the growth exceeds in the same commit.

Verify: `node cadence-core/bin/self-verify.mjs` returns `ok:true` with
`problems: []`, and `grep -c` finds the rule in all five contract files.

## Task 2: weak-form anchor handoff (planner -> executor)

Files: `skills/cad-planner-contract/SKILL.md`,
`skills/cad-executor-contract/SKILL.md`,
`cadence-core/bin/weight-budgets.json`

Action: planner binds a task's Files to the anchors CONTEXT.md evidence
already paid for - file plus SYMBOL, never a line number, since line cites go
stale (measured this cycle: every audit-cited line in the HYG-01 row had
moved). Executor treats named files and anchors as where it STARTS: open them
directly rather than searching for them, confirm the anchor still matches, and
still grep for callers before editing. Named files are never permission to
skip the caller check - the strong form (trust the anchors, skip discovery) is
refuted by stale cites and by measured caller-detection misses.

Verify: `node cadence-core/bin/self-verify.mjs` returns `ok:true` with
`problems: []`, `node --test cadence-core/bin/*.test.mjs` green, and both
contracts contain the anchor language.

## Outcome

- Task 1 `144193d` - the batch-probes rule in all five worker contracts
  (analyzer, executor, verifier, plan-checker, planner), five budgets re-pinned
  (+218..+230 B each).
- Task 2 `2a40357` - anchor handoff: planner carries CONTEXT evidence anchors
  onto a task's Files as file-plus-SYMBOL; executor opens named files directly,
  confirms the anchor, and still greps callers. Two budgets re-pinned.
- Verified: `self-verify` ok:true / problems: [] after each task; full suite
  1630 pass, 0 fail. `risk_surface` did not fire - contract prose and two
  budget integers touch none of the six active categories.
- Deviations: none. The v2.6.1 "a shrinking surface fails self-verify" note in
  PROJECT.md does not describe the live check - `self-verify.mjs` compares
  `bytes > budget` only, so only growth needed re-pinning.
