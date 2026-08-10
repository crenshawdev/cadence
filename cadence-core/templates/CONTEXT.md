# Phase {N}: {phase_name} - Context

Gathered: {date}
Feeds: /cad-plan {N}

## Scope boundary

In: {what this phase delivers - from the roadmap goal, tightened by discussion}
Out: {explicitly not this phase}
Deferred: {slices deferred by the size check or scope redirects, one line
each with reason; "None" if empty}
Plan shape: {one plan | multiple plans | split - deferred slice above}

## Durable decisions

- D-01 ({area}): {decision}. Evidence: {file paths / cited docs}.
- D-02 ...
{decisions that pass all three parts of the durability filter above; "None
this phase" if every decision is phase-local}

## Decisions

- D-03 ({area}): {decision}. Evidence: {file paths / cited docs}.
- D-04 ...
{the phase-local rest, continuing the same D-NN sequence; "None - all
decisions this phase are durable" if empty}

## Acceptance criteria

- [ ] AC1: {pass/fail, observed behavior}
- [ ] AC2: {pass/fail, observed behavior} (human-verify: needs {tool/service})
- [ ] AC3: ...

## Flagged assumptions

- {statement} - {confidence}; if wrong: {consequence}
{unresolved research topics and items left to the planner's judgment;
"None - all assumptions confirmed" if empty}

---
{Five sections, nothing else: scope boundary, durable decisions, decisions
(phase-local), acceptance criteria, flagged assumptions. This note and the
rule above it are not part of the file being written - drop both.}
