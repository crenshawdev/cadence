# Roadmap

## Overview

**Scope narrowed 2026-08-08, at the close.** `v2.5.0` ships its phases 1 and 2
only. Its phases 3-6 and their nine requirements moved to `v2.6.0` intact,
including the gathered context and the written plan for queue triage, so the
next cycle resumes from a planned phase. The trigger was this cycle's own
plan-size fix: it cannot bound a plan until it ships and installs, and queue
triage had already burned two full plan rounds against the unbounded gates.

**Renumbered 2026-08-08, at the open.** The four carried-over phases were
renumbered `1-4` rather than left starting at 3, and `phases/3/` became
`phases/1/`. Below this paragraph a bare `phase N` means a `v2.6.0` phase; the
v2.5.0 narrative that follows keeps its own numbering and says so. Old -> new:
3 -> 1 (Queue triage), 4 -> 2 (Live friction), 5 -> 3 (Parser defects),
6 -> 4 (Doc sweep).

**Rescoped 2026-08-08, mid-cycle, against field evidence.** The cycle was
audited against one question: is each phase here because something is broken for
someone, or because a self-audit found it? Three changes followed. Phase 3 was
"Parser defects", scoped from reading `planning-files.mjs`; running that parser
over every plan file in five live projects produced ZERO issues, so `PRS-01` and
most of `PRS-02` deferred and the phase became "Field friction" - named phase
directories the seams cannot address (`tempest`, `atmos`) and a run record every
Cadence project commits by default. `FRI-03` narrowed to the `/cad-audit` arm,
because `QW-04` already ships two detectors for that drift. And "Runtime
evidence", added earlier the same day from an external audit, was cut as a phase
and demoted to one task in the doc sweep. The rule applied: a defect that is
real but has never hit anyone waits behind one that is hitting someone now.

**Phase 4 added 2026-08-08, after the rescope, and it is not a reversal of it.**
Token accounting is an INSTRUMENT, not a fix: the cycle's direction turned toward
reducing burn, and nothing in Cadence measures burn at all. `weight.mjs` counts
static prose bytes, the trace's provider family records no cost, and the token
figures that exist live in subagent return metadata that nothing consumes. It
takes its own phase rather than joining phase 3 because phase 3 already holds
four requirements and the resolved `workflow.max_plan_tasks` ceiling is 8 -
saying so is the point of having a ceiling. It also gates the next cycle's plan,
which is to run `v2.6.0` against `hindsight`: that project's three-doc planning
set is 27,596 B against this repo's 85,413, so the exploration cost is visible
there instead of swamped.

**The rest of this Overview is the `v2.5.0` record and every phase number in it
is a v2.5.0 number.** It is kept because the scoping arguments still bind the
four phases below; read `phase 1`/`phase 2` there as the two that shipped, and
`phases 3-6` as this cycle's `1-4`.

`v2.5.0 — what Cadence says about itself`. Two things changed this cycle's shape
after it was opened. First, the cycle was renumbered: it opened as `v2.4.0` on
2026-08-05, and on 2026-08-07 a `v2.4.0` release shipped outside it ("parallel
that actually engages", 14 commits, manifest and tag both at `2.4.0`), consuming
the number while the planning docs still described `v2.4.0` as unstarted. That is
issue #87's failure mode caught live on this repo, and it is why phase 1 carries
the drift rule that would have surfaced it.

Second, an independent evaluation of Claude Code workflow tools scored Cadence #2
overall, #1 in task handling and #1 in reliability, with the gap to #1 concentrated
in tooling and edit quality, multi-agent workflow, observability, and total
efficiency. Phase 1 is the externally-prioritized response, and it supersedes queue
triage as the opening phase. Phase 2 follows because context reduction *is* the
efficiency category, at the heaviest weight in that evaluation.

Phase 1 is scoped from the evaluation's per-category rationales rather than its
scores, which is why it looks the way it does. Three of those rationales named
something specific and cheap: a static-analysis layer and an IDE index (QW-01),
mechanically enforced file leases across parallel paths (QW-03), and one joined
trace covering provider requests, worker lifecycle and accepted outcomes (QW-02).
The trace is the highest-leverage item in the phase because two separate
categories ask for it - observability wants the joined view, and total efficiency
wants matched-task attribution for every worker, retry and verification branch,
which is the same artifact read differently. Four other rationales named things
deliberately NOT in scope: a cross-runtime execution kernel, a universal
peer-messaging fabric, a universal OS sandbox per worker, and external deployment
history. The extensibility rationale asked for a versioned SDK, arbitrary tool
registration and broad MCP lifecycle - a general extension platform - which is why
the Stop hook and MCP server considered for this phase were cut rather than built:
neither would have moved what was actually being measured.

Triage therefore runs third rather than first. That order costs something real and
the cost is stated: the queue is the input to phases 4, 5 and 6, and an unknown
share of it is already closed. The three fix phases behind it were scoped from
items re-confirmed against the live tree before being written down, so they do not
depend on triage to be correct; what they lose is the chance to pick up items
triage would have promoted. The `[blocker]` O(K x N) git-guard item is the worked
example of the noise being triaged out: `TOK-02` closed it in v2.2.0 when the
tokenizer was deleted, and it is still filed open. Phase 1 closes two more of those
with tree evidence on its way past.

The doc sweep lands last because every phase before it changes what the docs should
say.

Shipped lineage: `v1.0.0` baseline, `v1.1.0` file-based memory and BM25 recall,
`v1.2.0` cross-model review seam and durable-decision recall, `v1.2.1` sweep-highs
patch, `v1.3.0` liteSpeed flow pass, `v1.3.1` tech-debt cycle, `v1.4.0` four stated
grammars, `v1.4.1` two self-contradicting contracts, `v1.5.0` the self-description
corrections that staged the stakes cycle, `v2.0.0` the stakes axis itself, `v2.1.0`
the coverage and triage gates, `v2.2.0` the rest of the residue, `v2.3.0` where the
bytes live, and `v2.4.0` the parallel path that could never engage. Git history and
each release tag are their archive.

## Phases


## Phase Details
