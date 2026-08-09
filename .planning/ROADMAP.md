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

- [x] **Phase 1: Queue triage** - every open CAPTURE item resolved against the live tree, and the moot ones moved out of the recall corpus
- [ ] **Phase 2: Live friction** - the defects that bite every session: the verify walk, the unbounded re-arm, and the version drift the gates cannot see
- [ ] **Phase 3: Field friction** - what is broken for Cadence's users right now: named phase dirs the seams cannot address, a run record every project commits by default, and a shortcut marker that reaches the queue
- [ ] **Phase 4: Token accounting** - what a dispatch costs is recorded where it happens, and every dispatch site is bracketed, so efficiency work stops being guesswork
- [ ] **Phase 5: Doc sweep** - `/cad-docs-verify` across the whole doc surface, with a committed, re-runnable output

## Phase Details

### Phase 1: Queue triage
**Goal:** `.planning/CAPTURE.md` stops being an append-only log and becomes the
set of things still true, with every item's verdict backed by the tree rather
than by its own wording.
**Depends on:** Nothing
**Requirements:** REC-01, REC-02
**Success Criteria:** (superseded by `phases/1/CONTEXT.md`'s AC1-AC7, which
carry the locked decisions; criterion 2 below changed at context time - D-04 of
the capture reader stands, so closed items stay in the live queue and only moot
items are archived)
SCOPE CUT 2026-08-08 - criteria 1 and 3 below are REPLACED, not merely superseded. The live set is `phases/1/CONTEXT.md`'s AC1, AC2, AC3, AC6, AC7 (old AC4 and AC5 dropped).
1. Every non-current-cycle open item is archived as a BLOCK under one dated reason stating the presumptive-death premise; only the current-cycle (v2.5.0) items carry an individual verdict - closed with the commit sha or tree evidence named, moot with the reason stated, or kept with its claim re-verified. The original form of this criterion, a tree-backed verdict for each of 213 items plus citation normalization, was planned twice and failed review twice at up to 15 tasks; it cost days of executor time for a queue nobody had read in nine milestones.
2. Archived items live outside the live queue in a `## Archive` section; closed items stay in place carrying their `[closed]` marker, because the capture reader keeps them in the corpus on purpose as the prior evidence recall exists to surface.
3. Archive invisibility is proved directly, not measured: a token occurring only in archived text returns zero results from `planning.mjs recall`, while the same token against a control copy whose `## Archive` heading is renamed into the walked set returns the bullet. The before/after BM25 measurement and `phases/1/MEASUREMENTS.md` are dropped with the cut.
4. Every item the triage keeps and assigns to phases 2, 3 or 4 is named in phase 1's own SUMMARY assignment list, so no surviving item is orphaned by the cycle that triaged it. Items v2.5.0 phase 1 already closed are recorded as closed by v2.5.0 phase 1, not re-triaged.

### Phase 2: Live friction
**Goal:** The session-level defects the user hits by hand stop firing: UAT stops
interrogating the user with commands the model can run, a blocking review stops
re-arming on its own fix, and a planning-doc version drift becomes mechanically
visible to the gates.
**Depends on:** Phase 1
**Requirements:** FRI-01, FRI-02, FRI-03
**Success Criteria:**
1. `cadence-core/workflows/verify.md` states the human-check bar explicitly - an item is human-verify only when the model cannot execute it (irreversible against real data, or outside its reach: credentials, GUI, hardware, another machine) - and its walk step runs and cites everything else as a results table. The one-at-a-time turn-ending walk is reserved for the items that survive that bar.
2. Re-running a walk whose items are 9 read-only commands and 1 destructive command ends the turn asking about exactly 1 item, not 10, with the other 9 shown as executed-and-cited rows.
3. A `risk_surface` firing on the commit that fixes findings `risk_surface` just raised is bounded: a stated cap exists, the re-arm terminates, and exceeding the cap surfaces a named reason rather than another round.
4. Every dispatched agent carries an explicit runaway-loop bound (issue #72). The `maxTurns` frontmatter field is supported but its behaviour at the cap is undocumented, so a spike establishes what a capped run returns - partial work or a failed dispatch - before any value ships.
5. A planning-doc version that disagrees with the shipped manifest is detected mechanically by `/cad-audit` and self-verify, not only reported by `/cad-health`'s prose rule from v2.5.0 phase 1, proved by a fixture whose docs claim a version the manifest does not (issue #87).

### Phase 3: Field friction
**Goal:** The things that are broken for Cadence's users right now stop being
broken. Every item here was found by Cadence failing on a real project, not by
Cadence reading its own source.

SCOPED 2026-08-08 from field evidence, replacing "Parser defects". The parser
work was scoped from reading `planning-files.mjs`, and running that parser over
every plan file in five live projects (`burnrate`, `hindsight`, `assistant`,
`jcrenshaw.dev`, `placer`) produced ZERO frontmatter or undeclared issues. Those
defects are real in the code and have never given anyone a wrong answer, so
`PRS-01` and the unhit half of `PRS-02` are deferred. The one parser defect that
did bite - the `REQ_ID_EXACT` regression - stays, and the two things the same
survey found actually broken take the space.
**Depends on:** Phase 1
**Requirements:** FLD-01, FLD-02, PRS-02, DBT-01
**Success Criteria:**
1. A phase directory named `08-meteogram-legend` is addressable by every seam that takes `--phase`. Today `planning.mjs plan-overlap --phase 08-meteogram-legend` returns `bad-args`, and `tempest` and `atmos` both use named directories, so those seams are unusable on two shipped projects. Either the seams accept the named form or Cadence states numeric-only as a grammar and `/cad-health` reports a violation - what is not acceptable is the current silence.
2. Two phase directories whose numeric prefix collides (`atmos` has `14-data-depth-...` and `14-shared-derivation-extraction`) produce a named diagnostic rather than one silently shadowing the other.
3. A project Cadence created keeps `.planning/trace.jsonl` out of git without the user having done anything by hand. `cadence-core/workflows/execute.md:226` asserts the record "is gitignored" as the reason a worktree's trace cannot ride a merge back, and nothing in Cadence writes that line - it holds in this repo only because it was added manually, so every other Cadence project commits its run record on the next `git add .planning`. Proved on a scratch project, not on this one.
4. `REQ_ID_EXACT` accepts an id whose category does not start with `[A-Z]`, closing the v1.4.0 phase-5 regression - the one parser defect with a recorded field occurrence.
5. A deliberate corner-cut carries a marker at its location in the code naming the shortcut's ceiling and the trigger that should prompt revisiting it, and a harvest collects those markers into `.planning/CAPTURE.md`. The marker token is distinct from the 19 conventional markers already in the tree (14 `TODO`, 2 `NOTE`, 1 each `XXX`/`HACK`/`FIXME`, none of them linted), so the harvest's first run over this repo returns only planted markers and zero of those 19. The harvest is a seam with its `CONTRACTS` row, not a documented grep, because only a seam can be idempotent and carry a test - and it must be idempotent: `.planning/CAPTURE.md` is gitignored here and in `burnrate` but tracked in `hindsight` and `assistant`, so the marker in tracked code is the durable record and the queue is a regenerable view of it.
6. A regression test proves the harvest finds a planted marker and does not invent one, and each fix in this phase lands with a regression test proved failing-capable against the unpatched code (a mutation or a patch-and-rerun recorded in the SUMMARY), so no vacuous assertion ships.

### Phase 4: Token accounting
**Goal:** What a dispatch costs is recorded at the moment it returns, at every
site that dispatches, and rendered per role - so a claim about Cadence's token
burn can be checked instead of felt.
**Depends on:** Phase 2
**Requirements:** TOK-03, TOK-04
**Success Criteria:**
1. `trace append` accepts a numeric token count on a lifecycle `return` and stores it on the event. `renderEvent` already spreads unknown fields onto the line, so the field survives without a library schema change; what is new is the CLI flag, its numeric validation, and its `CONTRACTS` row in the same task.
2. Every site that dispatches a worker brackets it. Today only `execute.md` and `verify-deep.md` do: `context.md` (1 dispatch), `plan.md` (3) and `review-triggers.md` (every reviewer, which records an adjudication outcome but no lifecycle bracket) have none. Measured on the session that scoped this phase, 71% of subagent spend happened at unbracketed sites - 206,901 tokens for the assumptions analyzer, 346,882 for planner plus checker plus revision, 219,068 for two reviewers, against 310,503 for the two that were bracketed. A token field alone would have measured the cheaper 29%.
3. `trace render` reports per-role totals - tokens and dispatch count per worker key - beside the four family counts it already prints, so the expensive role in a phase is named rather than inferred.
4. A phase run end to end produces a trace whose per-role totals are non-zero for every role that ran, and a role that ran with no token figure available is reported as `unrecorded` rather than as zero. The two are different claims and the render does not conflate them.
5. The trace records the read-set each dispatch was told to consume - the planning-doc paths named in its prompt - so the duplicate-read fraction is computed from the record rather than estimated. Measured motivation: `PROJECT + REQUIREMENTS + ROADMAP + CONTEXT` is 85,413 B (~21.4K tokens) in this repo, five dispatches were told to read that same set for phase 2's planning, and whether that ~107K of identical bytes is 15% of the phase's spend or 40% is currently unanswerable.
6. `node --test cadence-core/bin/*.test.mjs`, `npx tsc -p tsconfig.ci.json` and `self-verify --root .` are green with `weight-budgets.json` regenerated for every surface this phase edits.

### Phase 5: Doc sweep
**Goal:** What Cadence claims about itself matches what it does, and the next
cycle starts from a diff rather than a fresh sweep.
**Depends on:** Phases 2, 3, 4 (v2.5.0's phases 1 and 2, the other two inputs, already shipped)
**Requirements:** DOC-02, DOC-03, EVD-02
**Success Criteria:**
1. `/cad-docs-verify` runs across `README.md`, `METHOD.md`, `INTERNALS.md`, `CONTRIBUTING.md` and `cadence-core/workflows/*.md`, and its output is committed in the phase record.
2. Every claim reported stale is either corrected or recorded as a known divergence naming the reason it stands - no claim is left in the report unresolved.
3. Any claim that turns out to describe a real defect rather than stale prose is filed as its own requirement or CAPTURE item rather than reworded away, and the SUMMARY names each one - the cycle cannot quietly convert a bug into a documentation edit.
4. Re-running `/cad-docs-verify` after the corrections produces a smaller report than the first run, and the delta is stated.
5. One runtime-evidence artifact is committed and linked from `README.md`: the `weight.mjs` resident and turn-one byte figures with the command that regenerates them, and - IF a non-Cadence project has run a phase by then - that project's phase trace, named with the project it came from. DEMOTED 2026-08-08 from its own phase to one task here, because the export-and-publish half was scoped from an external audit rather than from anything failing. The trace half is contingent by design: no non-Cadence project has a run record yet, none has run a phase since `QW-02` shipped in `v2.5.0`, and the byte half stands alone if none does. If the trace lands, the artifact states that it records a run that happened and is not reproducible.
