# Roadmap: v3.6.0 - reading the corpus back

## Overview

**`v3.6.0`, opened 2026-08-23.** Scoped from the tracker's #190, #191 and #192,
filed 2026-08-16 and held out of `v3.5.9` as a cycle of their own rather than
filler for a defect cycle.

**The theme is one sentence: everything Cadence writes down is written by a gate
and read by nobody.** The Core Value claims the record comes back on its own at
the moment it matters, and that is the one claim in this project with no evidence
behind it. Recall ships and nothing checks that it landed, so a planner can
receive twelve prior decisions and cite none of them (#190). The corpus can
already answer "why is this code like this" and no command walks the join (#192).
And `/cad-task`, the path most real work actually takes, leaves commits and
nothing recall can find, no risk-surface check on its committed range, and no
trace bracket (#191).

**Advisory before gate, reader before writer.** #190 REPORTS the zero-citation
case rather than refusing it, and becomes a gate only once there is data on how
often that case is legitimate. #192 is a deterministic seam join with no model
judgment and no summarization pass. Nothing in this cycle changes what the write
side records, which is what keeps it falsifiable.

**The fast path gains guarantees, not machinery.** #191 explicitly does not add a
context step, a plan gate or a verify walk to `/cad-task`. Below roughly half a
day of work the phase overhead dominates, and adding the spine back is how the
fast path becomes the thing it exists to avoid.

This cycle seeds ids up front - `RBK-01`, `FST-01`, `FST-02`, `FST-03`, `WHY-01` -
so every one is either traced to a phase or visibly `unpicked` in `/cad-audit`.

`/cad-plan` seeds each requirement's Traceability row as its phase is planned.
Phases are added with `/cad-phase add`.

## Phases

- [x] **Phase 1: The corpus, read back at a file and line** - `/cad-why` joins a path to the decision that put it there, and reports the gap rather than guessing

## Phase Details

### Phase 1: The corpus, read back at a file and line
**Goal:** `/cad-why <path>[:<line>]` answers "why is this code like this" from
the record already on disk, so the corpus is READ for the first time and it
becomes visible whether the write-side care has been worth it.

**Requirements:** WHY-01

Everything the answer needs is already written down and nothing surfaces it. The
phase SUMMARY names what shipped and its commits, the plan names the task,
CONTEXT names the numbered decision behind it, the deviation record names where
the plan was wrong, the review artifacts name what an adversarial pass objected
to, and `trace.jsonl` names what it all cost. A file path plus a commit is enough
to walk all of it.

This is a READER. It writes nothing, gates nothing, and dispatches no subagent,
which is what makes it the safe first phase of this cycle and why a bug in it
cannot corrupt anything. It is a deterministic seam join for the same reason
`plan-overlap` is one: the output is the record's own words, so a model judgment
or a summarization pass in the middle would make the answer unfalsifiable against
the documents it claims to be quoting.

It is also the phase that has to go before `RBK-01`. The read-back gate counts
how often a plan cites the corpus, and a near-zero count has two readings that
need opposite fixes: the planner ignored a good record, or the planner correctly
ignored a useless one. Nothing in that count separates them. Reading the corpus
by hand first is what settles which one is true, and PROJECT.md's Core Value line
is what rides on the answer.

The hard part is the join across renamed and pruned phases. `/cad-milestone`
deletes `phases/<N>/` at every close and `/cad-phase` renumbers, so a commit from
a shipped cycle points at a directory that is gone: `.planning/ARCHIVE.md` holds
that residue and the git history holds the rest. Report the gap rather than
guess - a fabricated join is worse than a missing one here, because the whole
claim of the command is that it quotes.

**Success Criteria:**

1. `/cad-why <path>` resolves through `git log` for the commits touching that
   path and prints a chain, newest first, with no model-authored prose in it.
2. Each entry in that chain joins its commit to the phase, the plan task, the
   D-NN decision behind it, any deviation that refuted that decision, and any
   review finding that survived triage against it - each quoted in the record's
   own words.
3. `/cad-why <path>:<line>` narrows the chain to the commits that touched that
   line, and a path with no line behaves exactly as criterion 1.
4. A commit whose phase directory was pruned or renumbered reports the gap by
   name and still prints what `.planning/ARCHIVE.md` and git history do carry -
   it never guesses a phase number and never silently drops the entry.
5. A path git has never seen, and a path with a record but no `.planning/` join
   at all, each return a stated result rather than an empty chain or a crash.
6. The join is a deterministic seam script: running it twice over an unchanged
   tree returns byte-identical output, and it dispatches no subagent.
7. `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with
   `problems: []`, and `node cadence-core/bin/test.mjs` reports 0 failures.
