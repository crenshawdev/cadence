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
- [ ] **Phase 3: Parser defects** - the `planning-files.mjs` reads that drop, fabricate, or truncate data with no diagnostic
- [ ] **Phase 4: Runtime evidence** - what Cadence does at runtime becomes a committed, reproducible artifact instead of a claim about the source
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

### Phase 3: Parser defects
**Goal:** `cadence-core/bin/lib/planning-files.mjs` stops silently dropping,
fabricating or truncating the planning data every other seam reads. An
out-of-grammar input produces a named diagnostic, never a plausible wrong
answer.
**Depends on:** Phase 1
**Requirements:** PRS-01, PRS-02
**Success Criteria:**
1. A frontmatter block item with no active `currentKey` produces an `unknown-line` issue instead of vanishing, and `unwrap` never returns a value with retained quotes when text follows the closing quote - `parsePlanFiles`' `add()` cannot mint a fabricated value.
2. `readFrontmatterList` reads a comment that is the whole remainder of a key line, and reads a CRLF-checked-out PLAN.md end to end.
3. `promoteUnreleased`'s section bounding is fence-aware: a `## ` line inside a fenced code block in the Unreleased body does not truncate the section.
4. `REQ_ID_EXACT` accepts an id whose category does not start with `[A-Z]`, closing the v1.4.0 phase-5 regression, and `unseeded` fires on a Traceability table that has rows but is missing the milestone's ids - not only on a zero-row table.
5. Each of the above lands with a regression test proved failing-capable against the unpatched code (a mutation or a patch-and-rerun recorded in the SUMMARY), so no vacuous assertion ships.

### Phase 4: Runtime evidence
**Goal:** What Cadence does when it runs stops being a claim about the source and
becomes an artifact a stranger can regenerate: one real phase's joined trace and
its measured byte figures, committed, with the command that reproduces them and
a stated redaction rule that makes publishing a run record safe.
**Depends on:** Phase 2
**Requirements:** EVD-01, EVD-02
**Success Criteria:**
1. `planning.mjs trace export` emits a publishable form of a phase's joined run record from `.planning/trace.jsonl`, and its redaction rule is stated: what is dropped, what is preserved, and why the raw file stays gitignored. A field the rule does not name is dropped rather than emitted, so a future event family cannot leak by default.
2. Running the export against a trace containing an absolute path, a machine hostname and a provider identifier produces output carrying none of the three, proved by a test that fails against the unredacted record.
3. One real phase of this cycle is committed as a runtime-evidence artifact: the exported trace, the `weight.mjs` resident and turn-one byte figures, the phase's own commit range, and the environment the run happened in (plugin version, Node version, host).
4. The artifact carries the exact command that regenerates it, and running that command on a fresh clone reproduces the byte figures. The trace half is not reproducible by design - it records a run that happened - and the artifact says so rather than implying otherwise.
5. `/cad-docs-verify` in phase 5 finds no claim in the artifact that the tree contradicts, and the artifact is linked from `README.md` so the evidence is reachable without reading `.planning/`.

### Phase 5: Doc sweep
**Goal:** What Cadence claims about itself matches what it does, and the next
cycle starts from a diff rather than a fresh sweep.
**Depends on:** Phases 2, 3, 4 (v2.5.0's phases 1 and 2, the other two inputs, already shipped)
**Requirements:** DOC-02, DOC-03
**Success Criteria:**
1. `/cad-docs-verify` runs across `README.md`, `METHOD.md`, `INTERNALS.md`, `CONTRIBUTING.md` and `cadence-core/workflows/*.md`, and its output is committed in the phase record.
2. Every claim reported stale is either corrected or recorded as a known divergence naming the reason it stands - no claim is left in the report unresolved.
3. Any claim that turns out to describe a real defect rather than stale prose is filed as its own requirement or CAPTURE item rather than reworded away, and the SUMMARY names each one - the cycle cannot quietly convert a bug into a documentation edit.
4. Re-running `/cad-docs-verify` after the corrections produces a smaller report than the first run, and the delta is stated.
