---
status: testing
phase: 3
fields_version: 1
started: 2026-08-29
updated: 2026-08-29
---

## Items

### 1. The too-big arm names /cad-phase add first
expected: cadence-core/workflows/task.md's phase-sized arm prints the sequence /cad-phase add -> /cad-context {N} -> /cad-plan {N}, and no route in that arm starts at /cad-context.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: cadence-core/workflows/task.md:33-42 prints "/cad-phase add $TASK ... then /cad-context {N} and /cad-plan {N}"; index order add < context < plan confirmed by probe; PHS-02 (1) passes and goes false against the retired sentence.

### 2. The phase number is resolved, not a placeholder
expected: The arm calls planning.mjs status and prints total + 1. Running that command on this repo returns a total, and the arm's stated rule yields the next real number.
criterion: AC2
status: pass
first_pass: pass
source: verifier
evidence: task.md:35-38 names `planning.mjs status` (flagless, matching arg-contract) and `total + 1`; `node cadence-core/bin/planning.mjs status` returns total:5 so the rule yields 6, which is exactly where phase.md:14 lands `add`; PHS-02 (2) runs the resolver live and passes.

### 3. The task description carries into /cad-phase add
expected: The printed sequence passes the task's own description as the /cad-phase add argument, and skills/cad-phase/SKILL.md's argument-hint advertises that add accepts one.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: $TASK stored at task.md:16-18, consumed at :40; skills/cad-phase/SKILL.md:4 advertises "add [description]" with the other three alternatives untouched; phase.md:15 consumes a description from args; PHS-02 (3) passes.

### 4. No old-route site survives
expected: grep -n 'cad-context' cadence-core/workflows/task.md skills/cad-task/SKILL.md returns no line routing a phase-sized task to /cad-context as its first stop.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: task.md:275 guardrail names /cad-phase add and no /cad-context; skills/cad-task/SKILL.md has zero /cad-context hits and :20 names /cad-phase add; the only task.md /cad-context is :41, the arm's second stop; tree-wide grep outside .planning finds no surviving old-route prose; PHS-02 (4) pins presence and absence.

### 5. /cad-context's off-roadmap stop names the open door
expected: cadence-core/workflows/context.md's off-roadmap stop names /cad-phase add as the next action.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: cadence-core/workflows/context.md:31-32 stops with "Phase {N} is not in the roadmap. Run /cad-phase add to put it there, then re-run this command."; the step still stops and creates nothing inline; PHS-02 (5) passes.

### 6. The printed sequence works end to end in a live session
expected: From a repo whose roadmap has no matching phase, following /cad-phase add -> /cad-context {N} -> /cad-plan {N} reaches a planned phase with no command refusing. (human-verify: needs a live Claude Code session)
criterion: AC6
status: skipped
reported: don't have a repo I can run that. I'd screw up what I'm already doing.
reason: No spare repo available; running it live would disturb work in flight. Needs a scratch repo with a roadmap lacking the phase, in a separate session.

### 7. Tests and self-verify are green with budgets re-pinned
expected: node cadence-core/bin/test.mjs is green and node cadence-core/bin/self-verify.mjs reports ok:true, with weight-budgets.json re-pinned for every prose file whose byte count changed.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: test.mjs 3579/3579 pass, 0 fail; self-verify ok:true with problems []; each of the four prose commits carries its own weight-budgets.json re-pin and every intermediate commit's byte count equals its ceiling.

### 8. In a live Claude Code session on a repo whose roadmap has no matching phase, give /cad-task a feature-sized request, then follow the message it prints: /cad-phase add <description>, then /cad-context <N>, then /cad-plan <N>.
expected: The stop message shows a real phase number (planning.mjs status total + 1 for that repo) and the task's own words, not the literal tokens {N} or $TASK. /cad-phase add appends that phase at that number, and /cad-context and /cad-plan on it both proceed - no command refuses with 'Phase N is not in the roadmap'.
origin: verifier
why_human: Out of reach, not merely unexercised: the arm is prose a live model interprets, and there is no runner in this repo that executes three slash-command workflows end to end - so whether the substitution directed at task.md:38 actually happens can only be seen in a real session. Running it also appends a phase to a real ROADMAP.md, which this pass is not allowed to mutate. The mechanical halves are already verified: planning.mjs status answers total:5 here, and phase.md:15 consumes the description the arm hands it.
status: skipped
reported: don't have a repo I can run that. I'd screw up what I'm already doing.
reason: No spare repo available; running it live would disturb work in flight. Needs a scratch repo with a roadmap lacking the phase, in a separate session.

## Summary

total: 8
passed: 6
failed: 0
pending: 0
skipped: 2
blocked: 0
reworked: 0
