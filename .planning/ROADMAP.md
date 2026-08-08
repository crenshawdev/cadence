# Roadmap

## Overview

**Scope narrowed 2026-08-08, at the close.** `v2.5.0` ships phases 1 and 2 only.
Phases 3-6 and their nine requirements moved to `v2.6.0` intact, including
`phases/3/CONTEXT.md` and `phases/3/PLAN.md`, so the next cycle resumes from a
planned phase. The trigger was this cycle's own plan-size fix: it cannot bound a
plan until it ships and installs, and phase 3 had already burned two full plan
rounds against the unbounded gates.

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

- [x] **Phase 1: Benchmark quick wins** - a static-analysis layer reaches the executor, one joined trace explains a run, file leases become enforced rather than checked, provider failure paths get exercised, and the named tracker and backlog reliability fixes land
- [x] **Phase 2: Context reduction** - measure what a command and a dispatch actually carry, then defer the eager includes that dominate the two heaviest
- [ ] **Phase 3: Queue triage** - every open CAPTURE item resolved against the live tree, and the moot ones moved out of the recall corpus
- [ ] **Phase 4: Live friction** - the defects that bite every session: the verify walk, the unbounded re-arm, and the version drift the gates cannot see
- [ ] **Phase 5: Parser defects** - the `planning-files.mjs` reads that drop, fabricate, or truncate data with no diagnostic
- [ ] **Phase 6: Doc sweep** - `/cad-docs-verify` across the whole doc surface, with a committed, re-runnable output

## Phase Details

### Phase 1: Benchmark quick wins
**Goal:** The capability gaps an outside evaluation found are closed where closing
them is real capability rather than scoreboard motion. Cadence gains a
static-analysis path into execution that works without configuration, one joined
trace that explains what a run actually did, enforcement of the file leases it
already declares, and exercised evidence for the provider failure paths it
currently assumes.
**Depends on:** Nothing (first phase)
**Requirements:** QW-01, QW-02, QW-03, QW-04, QW-05
**Success Criteria:**
1. `workflow.lint_command` exists across all five config surfaces (schema, template, `/cad-config` catalog, config-reach, and a prose reader), and when it is unset the executor detects the project's own lint and typecheck commands from the tree instead of skipping the step. Either way the contract runs it after a task's edits and before its commit and treats a failure as a blocker with the same three bounded attempts as any other. An executor facing a failing lint does not reach the commit step, in a repo that configured nothing.
2. Both `cad-executor` rungs carry the `LSP` tool grant, self-verify's tool lint passes with it, and the contract states when to prefer diagnostics over a lint subprocess. The grant is proved harmless when no code-intelligence plugin is installed.
3. One gitignored, bounded `.planning/trace.jsonl` carries four event families against a single correlation id per phase - routing decisions, provider requests (reviewer, tier, outcome, duration), worker lifecycle (dispatch, return, checkpoint, escalation), and accepted outcomes (adjudications, UAT verdicts). Every worker, retry and verification branch in a completed phase is attributable to the task that caused it, proved by tracing one real phase end to end. `planning.mjs trace` renders it, `/cad-progress --trace` displays it on demand, and a trace-write failure provably does not change any seam's envelope.
4. No `mergeLayers` caller drops `warnings[]` in silence: each of the ten callsites across eight files (`review-provider.mjs` and `land-cleanup.mjs` carry two each) either surfaces the warning in its envelope or its file header states that the envelope is the surfacing, and a check over `cadence-core/bin/**.mjs` makes an omission visible rather than trusting ten hand-written sentences. A torn `.planning/config.json` produces a named diagnostic on the git-guard path rather than a quiet revert to default `protected_branches`.
5. An executor's writes are held to the `files:` list its plan declared, on every parallel path - not only compared once by `plan-overlap` before dispatch. A write outside the declared list is caught by a mechanism rather than by review, proved by a plan that attempts one.
6. A `blocked` worktree halt naming a missing PLAN file has a stated orchestrator-side remedy in `execute.md`, including the fallback when the remedy fails twice. Cadence still issues no `git worktree add`.
7. `phase_diff` resolves to `advisory` at `shipped` through all three surfaces that decide it - the route table row, the schema default, and the shipped template line - so a scaffolded repo config no longer overrides `critical`'s `adjudicated` with `off`.
8. A dependency lockfile no longer matches the `concurrency` risk surface: `package-lock.json`, `Cargo.lock`, `yarn.lock`, `poetry.lock` and `Gemfile.lock` at `stakes: solo` each resolve `solo`, proved by a route resolve before and after, while `src/locking.rs` still floors to `critical`.
9. `review-provider.mjs` has a test per real failure mode - request timeout, HTTP 4xx, HTTP 5xx, a dead or unknown model id, a malformed or truncated body, and an empty findings set - each proving what the caller sees. A reviewer that drops out of a fired trigger is named in the trace and to the user; a panel silently reduced to one voice while the gate reports clean fails this criterion.
10. Issues #14 and #19 land: the verifier's level-3 `Wired` requires one real value traced end to end across each seam on the goal path, and `/cad-debug` consults a frequency-ordered bug-patterns checklist before forming its first hypothesis.
11. A planning-doc version that disagrees with the shipped manifest is reported by `/cad-health` with both numbers named, and `git-branch.mjs decide` no longer returns a `create` for an integration branch named after a version the manifest has already published. Measured on this repo at phase-1 open: with `### Active` naming `v2.4.0` and the manifest already at `2.4.0`, `decide` returned `{"action":"create","branch":"cadence/v2.4.0"}` - the seam reads the active milestone correctly and checks it against nothing, which is wider than the filed "no active milestone" case. #87(a) is recorded as already shipped, citing `lib/release-decision.mjs`' downgrade and not-an-upgrade arms.
12. Every CAPTURE item this phase closes is closed with tree evidence - the commit or the code path that closed it - never because it reads as done. `CAPTURE.md:227` and `:214` are closed on that basis.

### Phase 2: Context reduction
**Goal:** The bytes the main thread carries per command are budgeted and cut where
the measurement says they are worst, and the always-resident surfaces stop being
the ones nobody measures.
**Depends on:** Nothing (its scope was re-confirmed against the live tree at
v2.4.0 planning; it runs second because total efficiency is the heaviest-weighted
capability gap)
**Requirements:** CTX-01
**Success Criteria:** (re-scoped at context time - see `phases/2/CONTEXT.md`.
Three of the five criteria this phase opened with rested on premises the tree
contradicts: the references budget already shipped as BUD-02 in v2.3.0 (D-01),
`panel-review` is retired Codex-era prior art this codebase never contained
(D-02), the 2.4x figure is runtime billed-equiv that `PROJECT.md ### Out of
Scope` excludes and that no static measure reproduces (D-03), and the CTX-02
pair both ADD resident bytes in the phase that exists to cut them (D-06).)
1. A `weight.mjs` subcommand reports what a surface actually carries: eager bytes (`SKILL.md` plus its `@`-includes) and reachable bytes (eager plus every reference the prose reads mid-run) for a named command, and dispatch bytes (agent file plus its preloaded contract skills) for a named role. Both definitions are reported because the ranking inverts between them. It carries the first CONTRACTS entry `weight.mjs` has ever had, plus sibling tests.
2. `cad-land`'s eager resident bytes fall below the mean of `cad-execute`, `cad-plan` and `cad-verify`, and `cad-plan-review`'s drop by at least the 15,134 B `references/review-triggers.md` include - by deferring eagerly preloaded references to the step that reads them, the pattern `cad-land/SKILL.md:84-92` already demonstrates, not by rewriting prose.
3. Every reference removed from an `@`-include is Read at the step that needs it, proved by a check rather than by inspection, with self-verify still `ok:true`.
4. Before and after eager and reachable bytes for all five commands, plus dispatch bytes per role, are committed in `phases/2/MEASUREMENTS.md`, with the 26,095 B of budgeted-but-never-loaded references marked so no saving is recorded that nobody pays. Re-running the recorded command reproduces the "after" bytes exactly.
5. This phase's own scope corrections land in the docs: the `CTX-01` row reads the re-scoped scope, `CTX-02` sits outside `### Active` with its deferral reason, and `/cad-audit` reports zero unserved Active requirements.

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
SCOPE CUT 2026-08-08 - criteria 1 and 3 below are REPLACED, not merely superseded. The live set is `phases/3/CONTEXT.md`'s AC1, AC2, AC3, AC6, AC7 (old AC4 and AC5 dropped).
1. Every non-current-cycle open item is archived as a BLOCK under one dated reason stating the presumptive-death premise; only the current-cycle (v2.5.0) items carry an individual verdict - closed with the commit sha or tree evidence named, moot with the reason stated, or kept with its claim re-verified. The original form of this criterion, a tree-backed verdict for each of 213 items plus citation normalization, was planned twice and failed review twice at up to 15 tasks; it cost days of executor time for a queue nobody had read in nine milestones.
2. Archived items live outside the live queue in a `## Archive` section; closed items stay in place carrying their `[closed]` marker, because the capture reader keeps them in the corpus on purpose as the prior evidence recall exists to surface.
3. Archive invisibility is proved directly, not measured: a token occurring only in archived text returns zero results from `planning.mjs recall`, while the same token against a control copy whose `## Archive` heading is renamed into the walked set returns the bullet. The before/after BM25 measurement and `phases/3/MEASUREMENTS.md` are dropped with the cut.
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
