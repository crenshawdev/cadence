# Roadmap

## Overview

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

- [ ] **Phase 1: Benchmark quick wins** - lint and diagnostics reach the executor, no config warning is dropped in silence, route decisions become inspectable, a blocked worktree gets a remedy, and the named tracker and backlog reliability fixes land
- [ ] **Phase 2: Context reduction** - budget `references/`, cut the two heaviest commands, and stop paying for prose that rides every session
- [ ] **Phase 3: Queue triage** - every open CAPTURE item resolved against the live tree, and the moot ones moved out of the recall corpus
- [ ] **Phase 4: Live friction** - the defects that bite every session: the verify walk, the unbounded re-arm, and the version drift the gates cannot see
- [ ] **Phase 5: Parser defects** - the `planning-files.mjs` reads that drop, fabricate, or truncate data with no diagnostic
- [ ] **Phase 6: Doc sweep** - `/cad-docs-verify` across the whole doc surface, with a committed, re-runnable output

## Phase Details

### Phase 1: Benchmark quick wins
**Goal:** The capability gaps an outside evaluation found are closed where closing
them is real capability rather than scoreboard motion. Cadence gains a lint and
diagnostics path into execution, stops dropping configuration diagnostics on the
floor, can show what it dispatched and why, and has a stated remedy for the one
parallel-execution halt that currently dead-ends.
**Depends on:** Nothing (first phase)
**Requirements:** QW-01, QW-02, QW-03, QW-04
**Success Criteria:**
1. `workflow.lint_command` exists across all five config surfaces (schema, template, `/cad-config` catalog, config-reach, and a prose reader) and the executor contract runs it after a task's edits and before its commit, treating a failure as a blocker with the same three bounded attempts as any other. An executor facing a failing lint does not reach the commit step.
2. Both `cad-executor` rungs carry the `LSP` tool grant, self-verify's tool lint passes with it, and the contract states when to prefer diagnostics over a lint subprocess. The grant is proved harmless when no code-intelligence plugin is installed.
3. No `mergeLayers` caller drops `warnings[]` in silence: each of the nine callsites across eight files either surfaces the warning in its envelope or its file header states that the envelope is the surfacing. A torn `.planning/config.json` produces a named diagnostic on the git-guard path rather than a quiet revert to default `protected_branches`.
4. Route decisions persist to `.planning/route-log.jsonl` - gitignored, bounded and rotated, gated by `planning.route_log` (default true). `planning.mjs routes` renders them with per-phase dispatch counts, `/cad-progress --routes` displays them on demand, and a log-write failure provably does not change a resolve envelope.
5. A `blocked` worktree halt naming a missing PLAN file has a stated orchestrator-side remedy in `execute.md`, including the fallback when the remedy fails twice. Cadence still issues no `git worktree add`.
6. `phase_diff` resolves to `advisory` at `shipped` through all three surfaces that decide it - the route table row, the schema default, and the shipped template line - so a scaffolded repo config no longer overrides `critical`'s `adjudicated` with `off`.
7. A dependency lockfile no longer matches the `concurrency` risk surface: `package-lock.json`, `Cargo.lock`, `yarn.lock`, `poetry.lock` and `Gemfile.lock` at `stakes: solo` each resolve `solo`, proved by a route resolve before and after, while `src/locking.rs` still floors to `critical`.
8. Issues #14 and #19 land: the verifier's level-3 `Wired` requires one real value traced end to end across each seam on the goal path, and `/cad-debug` consults a frequency-ordered bug-patterns checklist before forming its first hypothesis.
9. A planning-doc version that disagrees with the shipped manifest is reported by `/cad-health` with both numbers named, and `git-branch.mjs decide` no longer returns a `create` for an integration branch named after a version the manifest has already published. Measured on this repo at phase-1 open: with `### Active` naming `v2.4.0` and the manifest already at `2.4.0`, `decide` returned `{"action":"create","branch":"cadence/v2.4.0"}` - the seam reads the active milestone correctly and checks it against nothing, which is wider than the filed "no active milestone" case. #87(a) is recorded as already shipped, citing `lib/release-decision.mjs`' downgrade and not-an-upgrade arms.
10. Every CAPTURE item this phase closes is closed with tree evidence - the commit or the code path that closed it - never because it reads as done. `CAPTURE.md:227` and `:214` are closed on that basis.

### Phase 2: Context reduction
**Goal:** The bytes the main thread carries per command are budgeted and cut where
the measurement says they are worst, and the always-resident surfaces stop being
the ones nobody measures.
**Depends on:** Nothing (its scope was re-confirmed against the live tree at
v2.4.0 planning; it runs second because total efficiency is the heaviest-weighted
capability gap)
**Requirements:** CTX-01, CTX-02
**Success Criteria:**
1. `cadence-core/references/**` is enforced by `weight-budgets.json` with a per-file ceiling, and self-verify fails a tree whose reference exceeds it - proved by an over-budget fixture. (Today `acceptance-criteria.md` sits at 22,506 B, larger than any budgeted workflow, entirely unbudgeted.)
2. `panel-review` and `cad-land` carry measurably less than 2.4x the workhorse commands' context, with before and after byte counts committed.
3. A stated writing contract (one action per sentence, constraint before the action it limits - issue #69) is preloaded once and asserted by self-verify to resolve for every agent, rather than restated per agent file.
4. The review subsystem gains a minimalism lens (issue #29): a delete-list pass separate from the correctness pass, firing where it is configured and reporting what could be removed rather than what is wrong.
5. Total resident bytes for a `/cad-plan` and a `/cad-execute` dispatch are measured before and after the phase and both numbers are recorded - a phase that cuts nothing measurable fails this criterion.

### Phase 3: Queue triage
**Goal:** `.planning/CAPTURE.md` stops being an append-only log and becomes the
set of things still true, with every item's verdict backed by the tree rather
than by its own wording.
**Depends on:** Nothing
**Requirements:** REC-01, REC-02
**Success Criteria:** (superseded by `phases/3/CONTEXT.md`'s AC1-AC7, which
carry the locked decisions; criterion 2 below changed at context time - D-04 of
the capture reader stands, so closed items stay in the live queue and only moot
items are archived)
1. Every one of the remaining open items carries exactly one of three resolutions: closed with the commit sha or tree evidence that closed it named, deleted as moot with the reason stated, or kept with its claim re-verified and its `file:line` citations corrected against the current tree. Zero items survive with their original wording and no verdict.
2. Moot items live outside the live queue in a `## Archive` section; closed items stay in place carrying their `[closed]` marker, because the capture reader keeps them in the corpus on purpose as the prior evidence recall exists to surface.
3. `planning.mjs recall` is measured against the same query set before and after the move, against a corpus snapshot holding CAPTURE.md alone so no phase artifact enters either side, and both raw result sets are recorded in `phases/3/MEASUREMENTS.md`.
4. Every item the triage keeps and assigns to phases 4, 5 or 6 is named in phase 3's own SUMMARY assignment list, so no surviving item is orphaned by the cycle that triaged it. Items phase 1 already closed are recorded as closed by phase 1, not re-triaged.

### Phase 4: Live friction
**Goal:** The session-level defects the user hits by hand stop firing: UAT stops
interrogating the user with commands the model can run, a blocking review stops
re-arming on its own fix, and a planning-doc version drift becomes mechanically
visible to the gates.
**Depends on:** Phase 3
**Requirements:** FRI-01, FRI-02, FRI-03
**Success Criteria:**
1. `cadence-core/workflows/verify.md` states the human-check bar explicitly - an item is human-verify only when the model cannot execute it (irreversible against real data, or outside its reach: credentials, GUI, hardware, another machine) - and its walk step runs and cites everything else as a results table. The one-at-a-time turn-ending walk is reserved for the items that survive that bar.
2. Re-running a walk whose items are 9 read-only commands and 1 destructive command ends the turn asking about exactly 1 item, not 10, with the other 9 shown as executed-and-cited rows.
3. A `risk_surface` firing on the commit that fixes findings `risk_surface` just raised is bounded: a stated cap exists, the re-arm terminates, and exceeding the cap surfaces a named reason rather than another round.
4. Every dispatched agent carries an explicit runaway-loop bound (issue #72). The `maxTurns` frontmatter field is supported but its behaviour at the cap is undocumented, so a spike establishes what a capped run returns - partial work or a failed dispatch - before any value ships.
5. A planning-doc version that disagrees with the shipped manifest is detected mechanically by `/cad-audit` and self-verify, not only reported by `/cad-health`'s prose rule from phase 1, proved by a fixture whose docs claim a version the manifest does not (issue #87).

### Phase 5: Parser defects
**Goal:** `cadence-core/bin/lib/planning-files.mjs` stops silently dropping,
fabricating or truncating the planning data every other seam reads. An
out-of-grammar input produces a named diagnostic, never a plausible wrong
answer.
**Depends on:** Phase 3
**Requirements:** PRS-01, PRS-02
**Success Criteria:**
1. A frontmatter block item with no active `currentKey` produces an `unknown-line` issue instead of vanishing, and `unwrap` never returns a value with retained quotes when text follows the closing quote - `parsePlanFiles`' `add()` cannot mint a fabricated value.
2. `readFrontmatterList` reads a comment that is the whole remainder of a key line, and reads a CRLF-checked-out PLAN.md end to end.
3. `promoteUnreleased`'s section bounding is fence-aware: a `## ` line inside a fenced code block in the Unreleased body does not truncate the section.
4. `REQ_ID_EXACT` accepts an id whose category does not start with `[A-Z]`, closing the phase-5 regression, and `unseeded` fires on a Traceability table that has rows but is missing the milestone's ids - not only on a zero-row table.
5. Each of the above lands with a regression test proved failing-capable against the unpatched code (a mutation or a patch-and-rerun recorded in the SUMMARY), so no vacuous assertion ships.

### Phase 6: Doc sweep
**Goal:** What Cadence claims about itself matches what it does, and the next
cycle starts from a diff rather than a fresh sweep.
**Depends on:** Phases 1, 2, 4, 5
**Requirements:** DOC-02, DOC-03
**Success Criteria:**
1. `/cad-docs-verify` runs across `README.md`, `METHOD.md`, `INTERNALS.md`, `CONTRIBUTING.md` and `cadence-core/workflows/*.md`, and its output is committed in the phase record.
2. Every claim reported stale is either corrected or recorded as a known divergence naming the reason it stands - no claim is left in the report unresolved.
3. Any claim that turns out to describe a real defect rather than stale prose is filed as its own requirement or CAPTURE item rather than reworded away, and the SUMMARY names each one - the cycle cannot quietly convert a bug into a documentation edit.
4. Re-running `/cad-docs-verify` after the corrections produces a smaller report than the first run, and the delta is stated.
