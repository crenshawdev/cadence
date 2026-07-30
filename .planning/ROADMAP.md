# Roadmap

## Overview

`v2.0.0 — Stakes, not spend`. Cadence asks every user how much they are
willing to spend (`fast` / `balanced` / `quality`) and no user what happens if
the work is wrong. That is a budget question wearing a capability costume, and
on a Max subscription it is not even a question the user has. This cycle
replaces the axis, and the enum rename with no back-compat alias is what makes
it a major release.

The order is forced by what has to exist before what. Effort is frozen per
agent file on the dispatch path Cadence uses, so a rung ladder has to exist
before a routing cell can vary effort at all - phase 1, built on the contract
skills `v1.5.0` shipped for exactly this. The vocabulary lands next, because
everything downstream is written in it. Only then can a cell carry a bundle
rather than a model, and only then can the risk surface Cadence already
computes for the blocking review trigger raise a phase's rung by itself, which
is the payoff the reframe exists for.

Phases 5 and 6 ride along rather than follow: acceptance-criteria ids depend
on nothing here, and the remaining silent config drops go last because the
reframe may close half of them on its way past.

Shipped lineage: `v1.0.0` baseline, `v1.1.0` file-based memory and BM25
recall, `v1.2.0` cross-model review seam and durable-decision recall, `v1.2.1`
sweep-highs patch, `v1.3.0` liteSpeed flow pass, `v1.3.1` tech-debt cycle,
`v1.4.0` four stated grammars, `v1.4.1` two self-contradicting contracts, and
`v1.5.0` the self-description corrections that staged this cycle. Git history
and each release tag are their archive.

## Phases

- [x] **Phase 1: The rung ladder** - materialize each contract skill at the rungs it needs, retiring the runtime-read shim
- [x] **Phase 2: The stakes axis** - rename the enum to the question users actually have, with no back-compat alias
- [x] **Phase 3: The bundle cell** - a routing cell resolves model, effort, review and verify, computed from one small table
- [x] **Phase 4: The computed floor** - the risk surface Cadence already detects raises a phase's rung by itself
- [x] **Phase 5: Acceptance-criteria ids** - prove every CONTEXT criterion reached the UAT checklist, in both directions
- [ ] **Phase 6: The remaining silent drops** - the last config keys that are resolved and then thrown away

## Phase Details

### Phase 1: The rung ladder
**Goal:** Effort becomes a dial the routing layer can vary per role, by
materializing each single-sourced contract at the rungs it needs. Nothing
downstream has to work around a value frozen in one agent file.
**Depends on:** Nothing (first phase)
**Requirements:** RNG-01
**Success Criteria:**
1. Every rung agent file is frontmatter plus a pointer at its contract skill, and a rung file carrying a behavioural instruction fails self-verify with the file named. A rung file that contains behaviour is the failure this design exists to prevent, so the check is the deliverable, not the convention.
2. `agents/cad-plan-checker-high.md`'s runtime read of another agent file is gone, `route-table.json` carries no `escalate_effort_variant` key, and `route.mjs` resolves the same escalation through the ladder with a `route.test.mjs` row pinning it.
3. `node --test cadence-core/bin/*.test.mjs` and `tsc -p tsconfig.ci.json` pass, and self-verify's `agent-skills` check reports every rung file's contract skill resolving with none carrying `disable-model-invocation: true`.

### Phase 2: The stakes axis
**Goal:** The routing question changes from what a dispatch costs to what it
costs if it is wrong. This is the breaking change, and the whole reason the
release is major.
**Depends on:** Nothing (independent of phase 1; ordered second because phases 3 and 4 need both)
**Requirements:** STK-01
**Success Criteria:**
1. `config.schema.json`'s `model.profile` enum holds only the stakes values, and setting a retired value is refused at the write face with a message naming its replacement - not aliased, not silently defaulted.
2. A config still holding a retired value produces one named diagnostic pointing at the replacement, rather than falling back to a default with nothing said.
3. No surface still describes routing as a spend ladder: `route-table.json`, the config template, `INTERNALS.md`'s "Model routing" section, `DESIGN.md`, `references/seams.md`, `references/review-triggers.md` and the workflow prose all read as the stakes question.
4. The `[2.0.0]` CHANGELOG entry states the break and the exact action a user takes on upgrade, in one place they will find it.

### Phase 3: The bundle cell
**Goal:** One question in, four knobs out. A cell stops yielding a model and
starts yielding the whole quality bundle, because quality is not one dial and
effort alone cannot express "fire a blocking cross-model review".
**Depends on:** Phases 1 and 2
**Requirements:** STK-02
**Success Criteria:**
1. `route.mjs` returns `{model, effort, review, verify}` for a `(stakes, role)` pair, with `route.test.mjs` pinning one row per cell rather than a sampled subset.
2. Every cell is computed from a table small enough to read in one screen, not enumerated by hand.
3. Self-verify fails, naming the cell, when any cell resolves to a model outside `model_aliases`, an effort outside the five rungs, or a trigger name no `review-triggers.md` row defines.
4. `model.overrides.<role>` still pins a model over a computed cell and `fable` stays reachable only by explicit pin, both pinned by tests. The executor's model is derived from its cell rather than pinned in the roles table.

### Phase 4: The computed floor
**Goal:** The risk signal Cadence already computes on every phase stops being
used for one thing and discarded. Detection sets a floor the user may raise
but not silently lower.
**Depends on:** Phase 3
**Requirements:** STK-03
**Success Criteria:**
1. A phase whose risk detection fires resolves at the top rung even when the project baseline is the lowest one, and the routing reason names the detected surface.
2. Lowering below a detected floor is refused unless an override names the surface being overridden, and the reason string carries that name.
3. Raising above a detected floor requires no override at all.
4. A phase with no detected surface routes at the project baseline unchanged, so detection is a floor rather than a tax on every phase.

### Phase 5: Acceptance-criteria ids
**Goal:** An audit can prove a total function - every acceptance criterion
in CONTEXT reached the UAT checklist. Nothing structural connected the two:
`/cad-verify` words each item from the criteria in its own prose, so the link
was model judgment at build time and unrecoverable afterwards (D-15: the
dropped-criteria incident this line first named was verified not to exist).
**Depends on:** Nothing
**Requirements:** ACR-01
**Success Criteria:**
1. CONTEXT acceptance criteria carry ids that survive `/cad-phase` insert and remove, pinned by a renumber test. An id that renumbers under the user is worse than none.
2. `/cad-audit` FAILs on a criterion with no UAT item, naming the id, verified against a fixture synthesized from this cycle's phase-1 CONTEXT+UAT pair with two items removed - real prose, synthetic defect (D-15: the v1.4.0 case this line first named was verified not to exist).
3. A UAT item tracing to no criterion is reported unless it is marked verifier-added.
4. The grammar is written down in `references/`, with one test row per out-of-grammar shape, the same discipline the four `v1.4.0` grammars follow.

### Phase 6: The remaining silent drops
**Goal:** No config key is resolved, carried through the dispatch path, and
then thrown away with nothing said. The same defect shape `v1.5.0` closed for
per-trigger effort, closed everywhere it remains.
**Depends on:** Phase 3 (the tier arm may resolve there instead, which shrinks this phase rather than blocking it)
**Requirements:** CFG-01, HST-01
**Success Criteria:**
1. Every key still in scope is either honoured by the backend that reads it, or scoped and refused at the point of setting, with its real reach stated in the schema description.
2. A written-down sweep for the resolved-then-dropped shape across config consumers reports zero remaining, and the sweep can be re-run by a later cycle.
3. Anything the reframe already closed on its way past is recorded as closed there rather than fixed twice.
