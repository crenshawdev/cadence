# Roadmap: v3.7.12 - what each role runs at

## Overview

**`v3.7.12`, opened 2026-09-04. This cycle TAGS and PUBLISHES, and it is the
LAST release on the 3.x line.** Decided 2026-09-05, reversing the no-release
plan this milestone opened under: 4.0.0 is a full Rust rewrite, so 3.7.12 is
where the JavaScript implementation stops. Cadence also runs from this
repository - `settings.json` points the marketplace at `/code/cadence` - so the
work is in force at the next restart whether or not it is tagged; the tag is
what makes this tree citable as the frozen reference the rewrite is specified
against. `/cad-milestone` closes it WITH a tag and WITH the manifest bump
(`.claude-plugin/plugin.json` moves 3.7.11 -> 3.7.12; there is no
`package.json` in this repo). After the tag is pushed, `settings.json` stops
pointing the marketplace at `/code/cadence` and installs the published plugin
instead, so the repo becomes a codebase rather than the running tool.

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


## Phase Details
