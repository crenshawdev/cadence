# Roadmap: v3.6.1 - the gaps v3.6.0 named

## Overview

**`v3.6.1`, opened 2026-08-23.** A patch cycle over the three gaps the `v3.6.0`
changelog states about its own work, and nothing else. No new command, no new
surface, no theme beyond closing what shipped named.

**The theme is one sentence: `/cad-why` reaches less of the corpus than it
claims, and says so in a comment rather than in its behavior.** All three
defects are in what `v3.6.0` shipped, and all three are measured rather than
suspected.

The bare-path arm inherits git's default history simplification, so the join is
correct and the history it reaches is short: 7 commits against 10 with
`--full-history` on `lib/release-decision.mjs`, the three missing being the
merges `b86fc25c`, `051f0df1` and `9237a539`, none of which resolves to a
planning record (`WHY-02`). The
renderer's entry cap of 10 claims ten entries stays under the 10,000-byte line
in `references/conventions.md`, and `planning.mjs` renders 15,637 B (`WHY-03`).
And `closeOver` compares `%cI` timestamps as strings, so a mixed-offset pair
straddling a prune can attach to the wrong close (`WHY-04`).

**What this cycle is not.** It does not touch the read-back gate. `cite-count`
stays ADVISORY for the reason `v3.6.0` stated: it becomes a gate only once there
is data on how often a zero-citation plan is legitimate. Nothing here changes
what the write side records.

This cycle seeds ids up front - `WHY-02`, `WHY-03`, `WHY-04` - so every one is
either traced to a phase or visibly `unpicked` in `/cad-audit`.

`/cad-plan` seeds each requirement's Traceability row as its phase is planned.
Phases are added with `/cad-phase add`.

## Phases

- [x] **Phase 1: The chain reaches what it claims** - close the three gaps `v3.6.0` named about `/cad-why`, each measured before the fix and re-measured after

## Phase Details

### Phase 1: The chain reaches what it claims
**Goal:** `/cad-why`'s three stated gaps close, so the command's reachability,
its entry cap and its ordering are what the code claims rather than what a
comment claims.

**Requirements:** WHY-02, WHY-03, WHY-04

All three are defects in what `v3.6.0` shipped, all three are already measured,
and none is a new surface. That is what makes this a patch cycle: there is
nothing here to discover, only three numbers to make true.

`WHY-02` is the one with a real decision in it and it is not a fix. The bare-path
arm inherits git's default history simplification, so the join is correct and the
history reaching it is short: 7 commits against 10 with `--full-history` on
`lib/release-decision.mjs`, the three missing being the merges `b86fc25c`,
`051f0df1` and `9237a539`. `--full-history` is what the prune search already
passes, and it is why that search recovers 25 closes instead of 4. But it is not
free on the chain query: it widens every path with a busy merge history, and the
entry cap `WHY-03` is about is what the widening lands on. The two want deciding
together, which is the argument for a context step rather than three small edits.

`WHY-03` is a number whose stated reason is false. `lib/why-render.mjs:91` says
`DEFAULT_TOP = 10` keeps the render under the 10,000-byte line in
`references/conventions.md`; measured with all edges filled, `capture-file.mjs`
renders 11,211 B over 8 entries, `issue-decision.mjs` 12,481 B over 10 and
`planning.mjs` 15,637 B. Either the number moves or the reason does, and the pin
at `why-render.test.mjs:38` moves with it.

`WHY-04` is the smallest and the least reachable. `closeOver` at
`lib/why-corpus.mjs:918` compares `%cI` timestamps as strings, and ISO-8601
values under different UTC offsets do not string-sort chronologically, so an
unresolved commit can attach to the wrong close. It needs mixed-offset commits
AND a `--mode delete` close AND a pair straddling a prune, which is why it was
ruled low rather than fixed at the time.

**Success Criteria:**

1. `/cad-why cadence-core/bin/lib/release-decision.mjs` reaches the same commit
   set `git log --full-history` reports for that path, or the chain states in
   words which commits its history simplification excluded and why - the
   currently-silent 7-of-10 is what must stop being silent.
2. The reachability decision is recorded as a numbered CONTEXT decision naming
   what it costs on a path with a busy merge history, not left as a flag choice
   in a commit message.
3. `lib/why-render.mjs`'s entry cap carries a byte claim that measurement
   supports: rendering the worst measured path prints under the byte line
   `references/conventions.md` states, or the comment states the real figure and
   the cap's reason is something other than that line.
4. `why-render.test.mjs` pins whatever `DEFAULT_TOP` becomes, and the pin fails
   if the number and its stated reason disagree again.
5. `closeOver` orders commits by parsed instants, guards an unparseable date
   rather than throwing on it, and a test pins a mixed-offset pair straddling a
   prune to the close it actually belongs to - the test fails against the
   string-compare implementation.
6. `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with
   `problems: []`, and `node cadence-core/bin/test.mjs` reports 0 failures.
