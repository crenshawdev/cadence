# Roadmap: v3.7.2 - the router loads late and the host writes the bracket

## Overview

**`v3.7.2`, opened 2026-08-25.** Three phases against the
`Reference split and trace hooks` milestone, due 2026-08-28. Two themes and a
filler phase. The first theme is **what a fire loads**: two reference files are
read whole to use one branch of them. The second is **who writes the trace
record**: today only the orchestrator does, by hand, so a session that dies
between dispatch and close leaves the bracket unpaired forever.

**The measured state, load.** `cadence-core/references/review-triggers.md` is
40,413 B and `references/seams.md` is 25,068 B, both loaded eagerly at every
fire or dispatch site. A `risk_surface` fire reads the `plan`, `diff` and
`phase_diff` prose it will never use; an ask-only site reads the entire
spawn-agent and provider contract. `review-triggers.md` has since grown past
its own weight-budget line, so the pin moves in the same commit. The pattern to
copy already exists and works: `workflows/verify.md` (~1,839 words) against
`verify-deep.md` (319), split cold behind a branch decision.

**The measured state, trace.** `trace.jsonl` carries 217 `duration_ms` values
returned by the host and zero on brackets, so `/cad-report` and `/cad-suggest`
price a dispatch with no wall clock. Worse, the close is hand-written: on
2026-08-25 a pause landed before the close and left plan 2's first dispatch
unpaired. Claude Code 2.1.245 exposes 31 hook events; Cadence registers 2
(`PreToolUse`, `PostToolUse`) because the rest did not exist when `hooks.json`
was written. `SubagentStart`/`SubagentStop` are two of them.

**Belt and suspenders, deliberately.** The hand-written `trace close` is KEPT as
a fallback rather than replaced. A hook-only design goes SILENTLY quiet if the
host renames an event; today a missing close renders as `unpaired`, which is a
visible defect. Dedup is on `(corr, worker key)`, first writer wins, and
`self-verify` pins the registered event names so a rename REDDENS a check
instead of going quiet. That pin is why phase 2 can add a hook writer at all.

**The standing exposure this rests on.** The token, tool-use and duration
figures on the subagent return are undocumented, and the bracket system,
`weight-budgets.json` and the six `max_dispatch_tokens` keys all read them.
Anthropic can change that rendering with no deprecation. Cadence already carries
the right recovery - omit `--tokens` on a figureless return, render `unrecorded`
distinctly from `0` - and that recovery is the precondition for adding a second
writer, so phase 2 states the dependency where a reader finds it rather than
leaving it in the code.

**What this cycle is not.** It is not the worktree question. GH-117
(`WorktreeCreate` seeds the phase dir) is held out in the `Worktree verdict`
milestone, natively blocked by GH-119 and GH-120: if worktrees turn out not to
earn their cost, GH-117's remedy code is deleted rather than rewritten. It is
not a general hook expansion either - only the two events phase 2 names get
registered, and each one gets a pin.

This cycle seeds ids up front - `LOD-06`, `HOK-01`, `HOK-02`, `TRC-02`,
`TRC-03`, `CEN-03`, `DOC-04` - so every one is either traced to a phase or
visibly `unpicked` in `/cad-audit`.

## Open Questions

- **OQ-1 - what splits out of `review-triggers.md`.** The file has a router
  shape already (a trigger name selects a section), but the blocking/adjudicated
  arm rules and the one-round re-arm cap are safety rules that some callers need
  BEFORE the branch decision. Which text is genuinely per-branch and which must
  stay in the hot entrypoint is decided at phase 1 planning, against the actual
  fire sites, not now.

- **OQ-2 - whether `SubagentStart` can carry the correlation id.** The dedup key
  is `(corr, worker key)`, and a hook only helps if it can compute both from what
  the host hands it. If `SubagentStart`'s payload cannot reach the corr, the
  start half stays hand-written and only `SubagentStop` becomes a second writer.
  Resolved at phase 2 planning by reading the actual payload, not by assuming
  one.

## Phases


## Phase Details
