# Roadmap: v3.8.0 - what each role runs at

## Overview

**`v3.8.0`, opened 2026-09-04. This cycle does not tag and does not publish a
release.** Cadence runs from this repository - `settings.json` points the
marketplace at `/code/cadence` - so the work lands by merge and is in force at
the next restart. The version is a label for the branch and the roadmap, not a
release plan. `/cad-milestone` closes it without a tag and without a manifest
bump.

**The source is `GH-249`**, filed 2026-09-02 and sized there as a milestone.
It reads two symptoms as one cause.

**The thread.** The routing table asks a question the user routes around. Since
v3.2 twelve commits have touched routing config: two set the stakes level and
ten override what it chose. Every override is a per-role or per-trigger value
fighting a per-level table, which is the table telling the user it does not know
their project as well as they do. Beside it sits the second symptom, and it has
the same shape: `route-table.json` names models inside its cells, checked
against a four-entry `model_aliases` list mirrored into six
`model.overrides.*` enums. Nothing checks any of them against Anthropic's
actual list, because nothing can. Naming a new model is seven edits, and until
they land the model cannot be routed to at all. In both cases a fixed table
stands between the user and a choice that is theirs.

**What is verified on disk at HEAD.** The rung ladder is 19 of 30 files: every
role has `high` and `xhigh`, and eleven of the remaining cells are empty -
`cad-planner` and `cad-assumptions-analyzer` and `cad-executor` missing `low`
and `medium`, `cad-verifier` and `cad-reviewer` missing `low`,
`cad-assumptions-analyzer` and `cad-executor` and `cad-plan-checker` missing
`max`. The `stakes` key is read by 18 prose surfaces under `cadence-core/` and
`skills/`, and by 13 non-test files under `cadence-core/bin/`, which is the
size `GH-249` claimed and it holds. `model_aliases` is `["opus", "sonnet",
"haiku", "fable"]` at `route-table.json:20`, and `fable` is reachable today
only as a pin through `model.overrides.cad-planner`, never as a cell.

**The claim this cycle makes.** Config says what each role runs at, in words the
user chose, and nothing between them and the model but a string they typed.

**The order, and why each phase leaves the tree working.** Phase 1 is purely
additive: it fills the eleven rung files so every role offers every rung, which
is what lets the interview ask one uniform question per role instead of six
different ones. Phase 2 adds the roles block and makes routing resolve from it
while `stakes` still answers as the fallback, so no intermediate commit strands
a config that exists today - including this repository's own, which sets
`stakes: critical`. Phase 3 is where the break lands, with its migration beside
it: the key is deleted in the same phase that teaches its replacement.

**Out of scope, deliberately.** `GH-140` (a Codex host adapter) takes over
item 5 of its own list once models are config strings, but the adapter decision
is not made here. `GH-119` (the worktree spike) and `GH-230` (cache read growth)
are decisions, not defects. The five unpriced `/cad-suggest` retune directions
from the 2026-09-03 run record were declined on 2026-09-04 and are not filed.

## Open Questions

- **OQ-1 - does the retry rung survive the roles block.** Every cell in
  `route-table.json` carries `effort` AND `retry`, a second rung a role climbs
  to when its first attempt fails, and `model.escalate_on_failure` gates it.
  The roles block `GH-249` proposes carries `model` and `effort` and nothing
  else. Either the block grows a third field and the interview grows a
  fourteenth question, or retry escalation is deleted with the grid that
  carried it. The run record is weaker evidence than it looks: the 2026-09-03
  `/cad-suggest` pass measured 7 of 290 executor resolves and 7 of 130 planner
  resolves climbing to the retry rung, but `model.escalate_on_failure` is
  `false` at HEAD (pinned there by `e40c9c30`), and the trace is unscoped, so
  those climbs come from the window when it was on rather than from how the
  project runs now. What the record shows is that the mechanism CAN fire. What
  it does not show is whether a climb ever changed an outcome, which is the
  thing worth keeping it for. Answer before phase 2 plans the block's shape.
- **OQ-2 - what happens to a model string the host does not know.** Dropping
  `model_aliases` is the point of the cycle, and it also drops the only thing
  that catches a typo. A cell today cannot name a model outside four; a roles
  block can name anything. Decide whether a string the host rejects fails the
  dispatch loudly, falls back to a named default, or is passed through and
  left to the host's own error. The probe run on 2026-09-04 for the excerpt
  work is evidence for one half: an agent naming a tool that does not exist
  launches fine and the name is dropped silently. Whether a model name behaves
  the same way is a different question against a different field and is not
  answered by it. Answer before phase 3 deletes the enums.

## Phases

- [ ] **Phase 1: Every role has every rung** - the eleven missing rung files exist, so a role's effort is a uniform choice rather than a per-role subset
- [ ] **Phase 2: Routing resolves from the roles block** - config names each role's model and effort directly, and routing reads it while the stakes key still answers as the fallback
- [ ] **Phase 3: The stakes key is gone and an interview replaces it** - the level, the cells grid and the alias list are deleted, and the thirteen questions that teach what each role costs are what a user meets instead

## Phase Details

### Phase 1: Every role has every rung

Purely additive, and the prerequisite for the interview asking one uniform
question per role. The ladder is 19 of 30 files at HEAD, verified by reading
the `effort:` line of every file in `agents/`. The eleven empty cells are
`low` and `medium` for `cad-planner`, `cad-assumptions-analyzer` and
`cad-executor`; `low` for `cad-verifier` and `cad-reviewer`; `max` for
`cad-assumptions-analyzer`, `cad-executor` and `cad-plan-checker`.

Each new file is the same two-line pointer body its siblings carry, with a
different `effort:` line and the role's own contract skill preloaded.
`rungPrefixIssues` already requires the naming convention per role, so the
files are constrained rather than invented. Every agent surface is byte-pinned
in `weight-budgets.json`, so the eleven new rows are part of the same commit.

**Success criteria**

- All 30 role-rung combinations exist as files in `agents/`. Reading the
  `effort:` line of every file yields each of `low`, `medium`, `high`, `xhigh`
  and `max` for each of the six roles.
- `node cadence-core/bin/self-verify.mjs` reports `ok: true` with no
  `unbudgeted-surface` and no `budget-overrun`.
- Each new rung file preloads its role's contract skill and carries no
  behaviour of its own, which is the rule `RNG-01` shipped and self-verify
  already enforces.
- The suite passes with no test pinning the count 19.
- `GH-249` traces to a REQUIREMENTS row pointing at Phase 1.

### Phase 2: Routing resolves from the roles block

The additive half of the break. Config grows `roles.<role>.{model, effort}`,
`model` is a free string passed to the host, and `route.mjs` resolves a
dispatch from that block. The `stakes` key still answers where the block is
silent, so no commit in this phase strands a config that exists today - this
repository's own sets `stakes: critical`, so the fallback is what keeps
Cadence-on-Cadence running between phase 2 and phase 3.

OQ-1 decides whether the block carries a retry rung. OQ-2 decides what a model
string the host does not know does. Neither is answered here.

**Success criteria**

- A config naming `roles.cad-planner.model` and `roles.cad-planner.effort`
  routes a planner dispatch to that model and that rung, shown by
  `route.mjs resolve` returning them.
- A model string outside the four former aliases resolves rather than being
  refused, and the behaviour OQ-2 chose for an unknown string is what the seam
  actually does, covered by a test per branch.
- A config carrying only `stakes` and no `roles` block routes exactly as it
  does at HEAD. A test pins one cell of the current grid against the resolved
  answer so the fallback is proved, not assumed.
- `config.mjs get` and `set` reach every key in the roles block, and
  `config-reach` in self-verify stays clean.
- `GH-249` traces to a REQUIREMENTS row pointing at Phase 2.

### Phase 3: The stakes key is gone and an interview replaces it

Where the break lands, with its migration beside it. `stakes` and everything
keyed on it come out - the cells grid, `RAISE_TARGET`, `route.mjs replay`,
`model_aliases`, the six `model.overrides.*` enums, the cell-vs-alias check in
`route-cells.mjs` - and the thirteen-question interview is what a user meets
in their place: six roles times model and effort, then the risk floor. Each
question says what the role does and what the choice costs, so the questions
are the documentation.

The interview runs in full on `/cad-new-project` and `/cad-adopt` writing to
the global layer, as a per-project confirmation after that writing adjustments
to the repo layer, on demand as its own command, and as the migration when any
command finds a `stakes` key: expand that level's row into explicit values,
confirm them, drop the key. Both config layers already exist in
`config-merge.mjs`, so the interview chooses a layer rather than building one.

The risk floor replaces the level-raise a risk surface used to trigger. Default
is that the diff review becomes blocking and nothing else moves, because
`risk_surface` is already blocking at every level and the diff gate is the only
thing the old floor added.

The cross-model reviewer path is untouched: it already resolves through config
strings, which is the pattern this cycle extends to the Claude side.

**Success criteria**

- No file under `cadence-core/` or `skills/` reads a `stakes` key. The 18
  prose surfaces and 13 non-test code files that read it at HEAD read the roles
  block or nothing.
- A config still carrying `stakes` meets the migration on the next command:
  the level's values are shown as explicit per-role values, confirmed, and the
  key is gone from the file afterwards. A config with no `stakes` key never
  sees the migration.
- The interview asks thirteen questions, every one with a default, and writes
  to the global layer on a first run and the repo layer for a per-project
  adjustment. Which layer received the write is checkable on disk.
- A plan touching a risk surface makes the diff review blocking and leaves
  every role's model and effort where the user set them, unless the user chose
  otherwise at the floor question.
- `/cad-config` no longer offers a stakes level and `config.schema.json`
  carries no `model_aliases`, no `model.overrides.*` enum and no `stakes` key.
- `GH-249` traces to a REQUIREMENTS row pointing at Phase 3.
