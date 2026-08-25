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

- [x] **Phase 1: Cold-split the eager references** - `review-triggers.md` and `seams.md` become a small router plus cold branch files, so a fire loads only the branch it selected, and the weight pin moves with it
- [ ] **Phase 2: The host writes the bracket** - `SubagentStart`/`SubagentStop` write the trace bracket with the hand-written close kept as fallback, `self-verify` pins the registered event names, brackets carry `duration_ms`, and the undocumented host-return dependency is stated
- [ ] **Phase 3: Pin the stem list and fix the prose** - the `planning-*.test.mjs` stem list gets a census, `CADENCE-CENSUS` gets its prose home in `conventions.md`, and `seam-calls.test.mjs`'s header stops misattributing its own derivation

## Phase Details

### Phase 1: Cold-split the eager references
**Goal:** A site that fires one review trigger, or calls one seam, stops reading
the other branches. `cadence-core/references/review-triggers.md` (40,413 B) and
`references/seams.md` (25,068 B) each become a small router with an unambiguous
branch decision plus cold files loaded only after that decision, copying the
`workflows/verify.md` / `verify-deep.md` split that already works. This is the
one change in the cycle that visibly moves what a run costs.
**Depends on:** Nothing (first phase). Ordered first because it is the only
phase whose benefit is measurable in tokens, and because phase 2 edits
`execute.md`'s guardrails and `seams.md`'s dispatch contract - cheaper against a
router than against a 25 KB file.
**Requirements:** LOD-06
**Issues:** GH-95
**Success Criteria:**
1. The entrypoint of each split file is a small router whose branch decision is
   unambiguous - a reader can name which cold file a given trigger or seam call
   loads without reading any of them.
2. Cold files load only AFTER their branch is selected. No caller loads a branch
   it did not select.
3. NO safety rule lives solely in a cold file ahead of the branch decision that
   needs it. The blocking/adjudicated arms and the one-round re-arm cap are the
   named cases: whatever a caller must obey before it picks a branch stays in
   the hot entrypoint, and OQ-1 is resolved in the plan against the actual fire
   sites.
4. `self-verify` checks every include target, so a branch that lost its contract
   reddens rather than silently running without it.
5. The `review-triggers.md` weight-budget pin moves in the same commit as the
   split - the file is over its pre-existing budget line today, and a split that
   leaves a stale pin is a census the next phase trips over.
6. Every existing caller still resolves: a census or test names the include
   targets, so a renamed cold file cannot go unnoticed.
7. Full suite green; the measured before/after byte counts for both files are
   recorded in the phase SUMMARY, not asserted from the plan.

### Phase 2: The host writes the bracket
**Goal:** A trace bracket survives session death. `SubagentStart` and
`SubagentStop` write the bracket from the host side, the orchestrator's
hand-written `trace close` is KEPT as a fallback, and dedup on
`(corr, worker key)` lets the first writer win. `self-verify` pins the hook
event names Cadence registers so a host rename reddens a check instead of going
quiet, brackets record the `duration_ms` the host already returns and Cadence
today discards, and the undocumented host-return dependency the whole system
rests on is stated where a reader finds it.
**Depends on:** Phase 1 - this phase edits `execute.md`'s guardrails and the
seams dispatch contract, and does so against the split router rather than the
whole file.
**Requirements:** HOK-01, HOK-02, TRC-02, TRC-03
**Issues:** GH-116, GH-118, GH-115, GH-121
**Success Criteria:**
1. The host-return contract is documented before any hook writes anything: which
   token, tool-use and duration figures Cadence reads off a subagent return,
   which code depends on each (the bracket system, `weight-budgets.json`, the
   six `max_dispatch_tokens` keys), and that Anthropic can change the rendering
   with no deprecation. The existing recovery - omit `--tokens` on a figureless
   return, render `unrecorded` distinctly from `0` - is named as the mitigation
   in force, not proposed as new work.
2. `SubagentStart`/`SubagentStop` are registered in `hooks.json` and write the
   trace bracket. Where the payload cannot supply the correlation id, OQ-2 is
   resolved in the plan by reading the actual payload, and the affected half
   stays hand-written rather than guessing a key.
3. The orchestrator's hand-written `trace close` still works and is still
   exercised by a test. A hook-only design is explicitly refused: if the host
   renames an event, the fallback keeps the record and criterion 5 reddens.
4. Dedup is on `(corr, worker key)` and the first writer wins. A bracket written
   by both paths appears once; neither path assumes it ran first.
5. `self-verify` asserts every hook event name Cadence registers is in a pinned
   known set. An event renamed upstream fails that check by name.
6. Brackets carry `duration_ms`. `trace close` grows one flag, which moves the
   `arg-contract-flag-entries` census 185 -> 186 and is declared in the plan's
   lease before an executor starts.
7. `execute.md`'s guardrails are updated: they enumerate who may write the
   trace, and a hook is a new writer. The enumeration is corrected, not
   appended to loosely.
8. The `seam-calls` and `arg-contract` counts and the
   `trace-refusal-sentences` census are re-pinned in the same commit as the
   change that moves them.
9. Full suite green; a session killed between dispatch and close leaves a PAIRED
   bracket, demonstrated rather than argued.

### Phase 3: Pin the stem list and fix the prose
**Goal:** Three small carried items, each placed where a file this cycle already
opened is already open. A new `planning-*.test.mjs` stem stops silently running
in the `other` group, `CADENCE-CENSUS` gets the prose home `CADENCE-DEBT`
already has, and a test header stops misattributing its own derivation.
**Depends on:** Phase 2 - the stem-list census is registered against the same
registry phase 2 re-pins, so both land after that file settles.
**Requirements:** CEN-03, DOC-04
**Issues:** GH-110, GH-113, GH-114
**Success Criteria:**
1. A census pins the `planning-*.test.mjs` stem list that
   `cadence-core/bin/test.mjs:36` holds in `GROUPS.planning`. A stem added later
   and not named there fails a check instead of silently running in `other`. The
   registry carries 12 rows today and none of them covers this.
2. `cadence-core/references/conventions.md` describes the `CADENCE-CENSUS`
   marker in prose, alongside the `CADENCE-DEBT` entry in "## Deliberate
   shortcuts". The fields are described WITHOUT writing a literal marker line,
   for the same reason that section already states about its own token.
3. `cadence-core/bin/seam-calls.test.mjs`'s header at line 49 names the phase 5
   plan it actually derives from, not "PLAN-2", so it no longer reads as if it
   described the plan that re-pinned the row above it.
4. Full suite green, and the new census passes its own registry check.
