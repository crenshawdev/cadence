# Roadmap

## Overview

**`v3.5.5 - a seam that accepts what it should refuse`, opened 2026-08-18.**
Scoped from the tracker milestone `v3.5.5`, which holds twelve issues: #137,
#142, #144, #147, #182, #183, #219, #220, #221, #222, #223 and #224. Six of
those (#219 through #224) were filed at the open, from a full audit of the
capture queue that re-verified each defect live rather than trusting its note.

**The theme is one sentence: an argument face that says yes to input it has a
rule against.** `v3.5.4` closed the shape for a control that reaches its path
and mis-answers. This cycle takes the door: a reader that accepts a malformed
value and answers as if it were well-formed, a guard that reads an empty string
as a configured one, a gate that cannot be satisfied by the key its own seam
document permits.

The first four phases are ordered by what a wrong answer costs, not by where the
code lives. Phase 1 carries the two that REMOVE a protection - one unprotects every
branch, the other lets one repository answer another's blocking gate. Phase 2
carries the readers that accept malformed input and answer anyway. Phase 3
carries the gates that fire on themselves or cannot be satisfied at all. Phase 4
is the structural form of phase 2, and goes last on purpose: a declarative
argument contract is only worth writing once the case-by-case fixes have said
what it has to express.

Phase 5 is not part of that theme and does not pretend to be. It is the README
restructure decided 2026-08-18, promoted into this cycle from the capture queue
rather than held for a docs milestone. It shares no code with the four defect
phases and depends on none of them.

The prune left the Overview describing `v3.5.4`; it now describes this cycle.

## Phases

- [x] **Phase 1: The guards that remove a protection** - a string `protected_branches` stops resolving to a list that protects nothing, and the bulk-output transport stops letting a concurrent run answer another run's blocking gate
- [x] **Phase 2: Readers that accept what they have a rule against** - the `--dir`, `--date`, phase-id, `Number` and prototype-key faces refuse malformed input instead of answering as if it were well-formed
- [ ] **Phase 3: Gates that fire on themselves or cannot be satisfied** - `detect-commands` stops naming an unreachable binary, `risk-check status` accepts the worker key `seams.md` permits, `risk-diff` stops matching its own fixtures, and `## Shipped` is located fence-aware
- [ ] **Phase 4: One argument contract instead of nine** - the per-seam refusals phase 2 wrote become a declarative contract the CLIs share
- [ ] **Phase 5: A README that asks for a decision** - the landing page keeps the argument for why the gates exist, the reference material moves to `docs/`, and the audience section states the demand above Install

## Phase Details

### Phase 1: The guards that remove a protection
**Goal:** The two defects whose wrong answer takes away a protection stop taking
it away: a string `git.protected_branches` resolves to a list that actually
protects, and the bulk-output scratch transport is per-run so one repository's
blocking gate cannot be answered by another's.
**Depends on:** Nothing
**Requirements:** GRD-01, SCR-01

These two share no code and are together because they share a consequence. Every
other item in this cycle costs a wrong answer; these two cost a guard that is
no longer there.

`GRD-01` (#219) is `resolveProtectedBranches` coercing a string `""` to `[""]`.
Verified live 2026-08-18: the call returns `[""]`, so a config that reads as set
protects no branch, and the guard passes for `main`.

`SCR-01` (#223) is seven sites sharing one fixed `${TMPDIR:-/tmp}` path with no
mktemp and no `&&` coupling the read-back to the write. On `triage-gate.md` the
file being collided over is the blocking `risk_surface` gate's one-round re-arm
cap. `workflows/progress.md` compounds it with a read-back that has no parse
guard, so a truncated file throws and a stale `{}` prints as success.

### Phase 2: Readers that accept what they have a rule against
**Goal:** Five argument and value faces refuse malformed input at the door
instead of answering as if it were well-formed, each with the diagnostic its
caller needs to fix the input.
**Depends on:** Nothing
**Requirements:** ARG-01, ARG-02, ARG-03, ARG-04, ARG-05

The five are one defect wearing five costumes: the face has a rule, and the rule
is not applied where the value enters.

`ARG-01` (#137) is the mutating seams reading `--dir` through the permissive flag
reader, so an empty or absent flag answers about the process cwd. `ARG-02`
(#142) is `release-bump --date`, documented and never validated. `ARG-03` (#144)
is `seed-reqs` and `cursor set` normalizing phase `1.10` to `1.1`, a known
identity collision that merges two sub-phases. `ARG-04` (#182) is
`normalizeNumber` accepting a digit string past the safe-integer range, so a
malformed phase number rounds or becomes `Infinity`. `ARG-05` (#220) is
`config.mjs get __proto__` returning a silent success naming no key, because
`wanted.filter((k) => !SCHEMA[k])` reads `Object.prototype` through the getter.

### Phase 3: Gates that fire on themselves or cannot be satisfied
**Goal:** Three gates and one locator stop answering about something other than
what they were asked: a named command is reachable, a status is satisfiable for
every key its seam permits, a detector does not match its own fixtures, and a
section heading is found outside a fence.
**Depends on:** Nothing
**Requirements:** RCH-01, RSK-03, RSK-04, SHP-01

`RCH-01` (#221) is `detect-commands` naming a tool from its config table without
checking the binary is on PATH. Verified on this machine: `ruff`, `mypy`,
`eslint` and `tsc` are all absent and all four are still returned, which the
executor contract turns into three wasted attempts then a `blocked` checkpoint.

`RSK-03` (#222) is `risk-check status` deriving its plan list from lifecycle
brackets while `run --plan` accepts only a number, so the non-role worker key
`seams.md` explicitly permits makes status permanently unsatisfiable. Verified:
`--plan 1-fix` returns `bad-args`.

`RSK-04` (#224) is `risk-diff` matching the seven detector strings that live in
its own test file, so any phase touching it fires the blocking gate on a
self-match and spends the one-round re-arm budget on nothing.

`SHP-01` (#183) is `milestone-prune.mjs` locating `## Shipped` with a bare
`findIndex(/^## Shipped\s*$/)` five lines before it uses the fence-aware
`sectionSpan` for `## Active`. One function, two locators, one fence-blind.

### Phase 4: One argument contract instead of nine
**Goal:** The per-seam refusals phase 2 wrote are expressed once, as a
declarative argument contract the seam CLIs share, so a tenth seam inherits the
rules rather than restating them.
**Depends on:** Phase 2
**Requirements:** ARG-06

`ARG-06` (#147) goes last on purpose. A declarative contract is only worth
writing once the case-by-case fixes have said what it has to express, and phase
2 is what says it. Written first, it would be a guess at five shapes; written
here, it is a generalization of five known ones.

### Phase 5: A README that asks for a decision
**Goal:** `README.md` stops being a 24.8 KB reference manual and becomes the
document that asks for one decision - whether to install this - with the
reference material relocated to `docs/` and every surviving claim verified
rather than carried across.
**Depends on:** Nothing
**Requirements:** RME-01

`RME-01` is the restructure John decided on 2026-08-18, promoted here rather
than left in the capture queue. It is a split PLUS an accuracy pass, never a
pure move: a claim that moves to `docs/` unverified is the same stale claim at a
new path.

Stays on the landing page, because it is the argument for why the gates exist
rather than material you look things up in: the opening, Install, the
audience/demands section, The loop, a compressed How it works, Where it came
from, and "What a break costs".

Moves to `docs/`: the command table, the cost-to-run section, and the worked
example. The cost-to-run section is already known stale, and isolating it gives
the docs-drift sweep exactly one file to check instead of a section buried in a
4,100-word page.

The wording rule for the audience section is load-bearing and not a style note:
state the DEMAND and never the label - how many times the run stops and waits
for a decision, and the sentence "if you want to describe a feature and come
back to a merged PR, this is the wrong tool". It goes ABOVE Install, because the
current order asks for the install decision before disclosing the price. Labels
invite people to self-identify into the flattering box; a demand makes them do
the arithmetic.
