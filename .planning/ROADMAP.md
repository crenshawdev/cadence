# Roadmap

## Overview

`v2.4.0 — what Cadence says about itself`. A reconciliation cycle: triage the
187-item capture queue against the live tree, fix what triage proves still
live, then check what Cadence claims about itself against what it does. The
order is load-bearing. Triage runs first because the queue is the input to
every later phase and an unknown share of it is already closed — the O(K x N)
git-guard blocker, for one, was closed by `TOK-02` when v2.2.0 deleted the
tokenizer, and it is still filed as open. What triage will NOT find is mass
deletion: measured at phase-1 context, only 2 of 62 distinct cited paths no
longer resolve, so the cost is re-verifying line numbers and claims against
files that all still exist. Fixing before triaging would spend a phase on
ghosts. The three fix phases are the surviving
clusters, ordered by how often they bite: friction the user hits every session,
then the parser under the planning data everything else reads, then the bytes
every dispatch pays for. The doc sweep lands last because the phases before it
change what the docs should say.

Shipped lineage: `v1.0.0` baseline, `v1.1.0` file-based memory and BM25
recall, `v1.2.0` cross-model review seam and durable-decision recall, `v1.2.1`
sweep-highs patch, `v1.3.0` liteSpeed flow pass, `v1.3.1` tech-debt cycle,
`v1.4.0` four stated grammars, `v1.4.1` two self-contradicting contracts,
`v1.5.0` the self-description corrections that staged the stakes cycle,
`v2.0.0` the stakes axis itself, `v2.1.0` the coverage and triage gates,
`v2.2.0` the rest of the residue, and `v2.3.0` where the bytes live - the
subagent-output transport, the reference split and triage-gate extraction, and
the always-on descriptions brought under the ratchet. Git history and each
release tag are their archive.

## Phases

- [ ] **Phase 1: Queue triage** - every open CAPTURE item resolved against the live tree, and the closed ones moved out of the recall corpus
- [ ] **Phase 2: Live friction** - the five defects that bite every session: the verify walk, the unbounded re-arm, the lockfile floor, the branch name, the invisible version drift
- [ ] **Phase 3: Parser defects** - the `planning-files.mjs` reads that drop, fabricate, or truncate data with no diagnostic
- [ ] **Phase 4: Context reduction** - budget `references/`, cut the two heaviest commands, and stop paying for prose that rides every session
- [ ] **Phase 5: Doc sweep** - `/cad-docs-verify` across the whole doc surface, with a committed, re-runnable output

## Phase Details

### Phase 1: Queue triage
**Goal:** `.planning/CAPTURE.md` stops being an append-only log and becomes the
set of things still true, with every item's verdict backed by the tree rather
than by its own wording.
**Depends on:** Nothing (first phase)
**Requirements:** REC-01, REC-02
**Success Criteria:** (superseded by `phases/1/CONTEXT.md`'s AC1-AC7, which
carry the locked decisions; criterion 2 below changed at context time - D-04 of
the capture reader stands, so closed items stay in the live queue and only moot
items are archived)
1. Every one of the 187 open items carries exactly one of three resolutions: closed with the commit sha or tree evidence that closed it named, deleted as moot with the reason stated, or kept with its claim re-verified and its `file:line` citations corrected against the current tree. Zero items survive with their original wording and no verdict.
2. Moot items live outside the live queue in a `## Archive` section; closed items stay in place carrying their `[closed]` marker, because the capture reader keeps them in the corpus on purpose as the prior evidence recall exists to surface.
3. `planning.mjs recall` is measured against the same query set before and after the move, against a corpus snapshot holding CAPTURE.md alone so no phase artifact enters either side, and both raw result sets are recorded in `phases/1/MEASUREMENTS.md`.
4. Every item the triage keeps and assigns to phases 2, 3 or 4 is named in phase 1's own SUMMARY assignment list, so no surviving item is orphaned by the cycle that triaged it.

### Phase 2: Live friction
**Goal:** The five session-level defects the user hits by hand stop firing:
UAT stops interrogating the user with commands the model can run, a blocking
review stops re-arming on its own fix, a lockfile stops flooring a phase to
`critical`, an integration branch stops being named after a shipped milestone,
and a planning-doc version drift becomes visible to the gates.
**Depends on:** Phase 1
**Requirements:** FRI-01, FRI-02, FRI-03
**Success Criteria:**
1. `cadence-core/workflows/verify.md` states the human-check bar explicitly - an item is human-verify only when the model cannot execute it (irreversible against real data, or outside its reach: credentials, GUI, hardware, another machine) - and its walk step runs and cites everything else as a results table. The one-at-a-time turn-ending walk is reserved for the items that survive that bar.
2. Re-running a walk whose items are 9 read-only commands and 1 destructive command ends the turn asking about exactly 1 item, not 10, with the other 9 shown as executed-and-cited rows.
3. A `risk_surface` firing on the commit that fixes findings `risk_surface` just raised is bounded: a stated cap exists, the re-arm terminates, and exceeding the cap surfaces a named reason rather than another round. Every dispatched agent carries an explicit runaway-loop bound (issue #72 - `maxTurns` is set nowhere today).
4. `files: ["package-lock.json"]` at `stakes: solo` no longer resolves to `critical`: the `concurrency` surface's `lock` patterns cannot match a dependency lockfile path, proved by a route resolve before and after.
5. `git-branch.mjs decide` with no active milestone in `PROJECT.md` never returns a `create` naming the milestone that already shipped - it downgrades to `ask` with a null branch, per its own documented naming-problem path.
6. A planning-doc version that disagrees with the shipped manifest is reported by `/cad-health`, `/cad-audit` and `self-verify` (issue #87), proved by a fixture whose docs claim a version the manifest does not.

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
4. `REQ_ID_EXACT` accepts an id whose category does not start with `[A-Z]`, closing the phase-5 regression, and `unseeded` fires on a Traceability table that has rows but is missing the milestone's ids - not only on a zero-row table.
5. Each of the above lands with a regression test proved failing-capable against the unpatched code (a mutation or a stash-and-rerun recorded in the SUMMARY), so no vacuous assertion ships.

### Phase 4: Context reduction
**Goal:** The bytes the main thread carries per command are budgeted and cut
where the measurement says they are worst, and the always-resident surfaces
stop being the ones nobody measures.
**Depends on:** Phase 1
**Requirements:** CTX-01, CTX-02
**Success Criteria:**
1. `cadence-core/references/**` is enforced by `weight-budgets.json` with a per-file ceiling, and self-verify fails a tree whose reference exceeds it - proved by an over-budget fixture. (Today `acceptance-criteria.md` sits at 22,506 B, larger than any budgeted workflow, entirely unbudgeted.)
2. `panel-review` and `cad-land` carry measurably less than 2.4x the workhorse commands' context, with before and after byte counts committed.
3. A stated writing contract (one action per sentence, constraint before the action it limits - issue #69) is preloaded once and asserted by self-verify to resolve for every agent, rather than restated per agent file.
4. The review subsystem gains a minimalism lens (issue #29): a delete-list pass separate from the correctness pass, firing where it is configured and reporting what could be removed rather than what is wrong.
5. Total resident bytes for a `/cad-plan` and a `/cad-execute` dispatch are measured before and after the phase and both numbers are recorded - a phase that cuts nothing measurable fails this criterion.

### Phase 5: Doc sweep
**Goal:** What Cadence claims about itself matches what it does, and the next
cycle starts from a diff rather than a fresh sweep.
**Depends on:** Phases 2, 3, 4
**Requirements:** DOC-02, DOC-03
**Success Criteria:**
1. `/cad-docs-verify` runs across `README.md`, `METHOD.md`, `INTERNALS.md`, `CONTRIBUTING.md` and `cadence-core/workflows/*.md`, and its output is committed in the phase record.
2. Every claim reported stale is either corrected or recorded as a known divergence naming the reason it stands - no claim is left in the report unresolved.
3. Any claim that turns out to describe a real defect rather than stale prose is filed as its own requirement or CAPTURE item rather than reworded away, and the SUMMARY names each one - the cycle cannot quietly convert a bug into a documentation edit.
4. Re-running `/cad-docs-verify` after the corrections produces a smaller report than the first run, and the delta is stated.
