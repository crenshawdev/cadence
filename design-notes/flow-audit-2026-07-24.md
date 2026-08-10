# Cadence flow audit — full /cad-* surface (2026-07-24)

Method: 25-agent workflow. One reviewer agent per skill (23), fired concurrently,
each reading its SKILL.md + workflow + touched seams/references; then a
cross-cutting critic over all findings; then synthesis. ~1.05M tokens, ~10 min,
0 errors.

Lens: find where a workflow costs the user latency or tokens WITHOUT improving
output quality, and where concurrency is left on the table. Quality must not
regress — trimming the cost of getting the (already good) output.

Raw findings: 47 — batch-reads 25, clarity 8, fan-out-agents 5, trim-ceremony 5,
offload-to-agent 3, correctness 1.

---

## Executive summary

Across the /cad-* surface the dominant cost is not heavy computation, it is coordinator round-trips: workflows list several independent, known-path reads or seam calls as a numbered prose sequence, and a coordinator walking the prose fires them one turn at a time. This single shape appears in ~18 of 23 skills and is almost pure latency with zero output effect. The second cost, smaller in count but larger per instance, is independent agent/reviewer dispatches serialized on the fan-out paths, where each unnecessary serialization costs a whole subagent wall-clock rather than a file read. The highest-leverage moves are therefore two shared conventions, one for parallel entry-gathers and one for concurrent independent dispatch, referenced once per workflow instead of eighteen bespoke edits, because they also fix the workflows no reviewer flagged and any workflow added later. A handful of genuine correctness riders surfaced alongside the speed work (a `--stats` run that mutates STATE.md, a config editor that mislabels inherited values, an ungated revert on a protected branch) and should be fixed regardless of the perf agenda. The one place a seam change beats prose is `cursor set` forcing a `cursor get` round-trip in two skills; everything else is prose and pointers.

## Cross-cutting fixes (do these first)

Ranked by benefit-per-effort.

**1. Add a "parallel entry-gather" convention (+ batch-asks clause).**
Add one named rule to `cadence-core/references/conventions.md` (it has no such rule today; natural home is a new bullet near "Authoring style"): *when a step's inputs are known-path, read-only, and mutually independent, issue them as parallel tool calls in a single message; serialize only a call that consumes a prior call's output.* Add a second clause for the ask-user seam: *independent questions over an independent set batch into ceil(N/4) AskUserQuestion calls, not one per item.*
- **Fixes:** the batch-reads finding in cad-capture, cad-config, cad-context, cad-coverage, cad-debug, cad-docs-verify, cad-execute, cad-health, cad-land, cad-milestone, cad-pause, cad-phase, cad-plan, cad-plan-review, cad-progress, cad-undo, cad-verify, cad-verify-sweep; plus the batch-asks gap in cad-new-project (`requirements` category multiSelects) and cad-context (`close_gray_areas`, `confirm_decisions` "one question per item").
- **Benefit:** collapses 2-5 serial round-trips per entry step across the whole surface, and roughly 4x fewer user turns on the interactive scoping loops. No output change.
- **Effort:** low (one convention + a one-line pointer at each load/locate/derive step, only where the dependency boundary is non-obvious).
- **Risk:** none; guidance is conditional on genuine independence.

**2. Add a "concurrent independent dispatch" convention and apply the two safe cases.**
Add to `seams.md` spawn-agent section: *independent dispatches over disjoint payloads fire concurrently in one message, bounded by `max_concurrent_agents`; resolve `route.mjs` once per (role, attempt) and reuse across the batch.* Then apply the two high-confidence cases: decision-review `refute` (dispatch cad-reviewer and the `review-provider.mjs` cross-model call in the same message — mirror review-triggers.md line 45 "in parallel where the host allows", which refute dropped), and execute `execute_parallel` item 5 (fan out the per-plan diff reviews together instead of a serial loop). Gap C rides here: `execute_parallel` item 1 dispatches N cad-executors with identical role/`--attempt 1`, so resolve the route once and reuse.
- **Fixes:** cad-decision-review, cad-execute (parallel path), and the route-resolve-per-dispatch waste in any role-loop.
- **Benefit:** each overlap saves a full subagent latency (the largest unit on the surface), not a read; refute roughly halves the panel-path wall-clock.
- **Effort:** low (convention + two one-line prose edits).
- **Risk:** none; both cases review static, already-committed, disjoint artifacts, merged only later.

**3. Hoist a single batched `config.mjs get` per workflow (Pattern 2 propagation).**
The idiom already exists and is verified in-repo: plan.md `parse` reads `git.base_branch memory.backend` in one call with the explicit "rides this same batch" comment, and execute.md `locate` says "Read config through the seam - one call." Propagate it to the workflows that still read config at scattered points: **context.md** (reads `memory.backend` alone at line 78 and `workflow.subagent_timeout` separately at line 104 — fold both into one get at `resolve_phase`), **cad-land** (config read at steps 1, 3, 4), **cad-milestone** (step 2 then again later).
- **Benefit:** 1-2 fewer round-trips per run; consistency with the established idiom.
- **Effort:** low. **Risk:** none (all keys read-only).

**4. Add a "handoff read discipline" note and fix plan.md `load_phase` (Gap B/F).**
Convention in `seams.md`: *the coordinator reads a source doc for handoff only when it will distill it; if the spawned agent reads the file whole, pass the pointer, not the bytes.* context.md `load_priors` already exemplifies this (reads priors to build a summary it offloads); plan.md `load_phase` step 2 violates it — the coordinator reads CONTEXT.md just to grab the `Plan shape` line, then the very next planner dispatch prompt tells the planner to read CONTEXT.md itself. Extract the one line, skip the whole-file read.
- **Benefit:** keeps orchestrator context flat in the context→plan→execute→verify pipeline. **Effort:** low. **Risk:** none.

**5. Correctness audit — preview modes must branch before mutating steps (Gap D).**
This is a category, not a one-off. cad-progress `--stats` is documented "wrote nothing" (success criterion line 128) but the unguarded `reconcile` step runs before the `--stats` stop and writes STATE.md via `cursor set` on cursor drift. Fix: branch to the stats step immediately after `derive`'s seam call, skipping every mutating step, rather than relying on per-step "(--stats only)" tags. Then grep the suite for the same shape and confirm cad-health's default path is inspect-only (its edits strictly behind the user's yes).
- **Benefit:** removes a real spec contradiction (silent mutation in a read-only mode). **Effort:** low. **Risk:** low; only prevents writes on the preview path.

**6. Correctness audit — protected-branch-guard coverage across commit-producing steps (Gap E).**
Guard invocation is hand-copied per workflow with no single audit. context.md (line 316), plan.md (220), execute.md (39), new-project.md (130), verify.md (154) name git.md rail 1 explicitly; **undo.md step 4 runs `git revert` (a commit) but never invokes rail 1**, so a revert on `main` writes straight to a protected branch ungated even though the SKILL @-includes git.md. One pass: confirm every commit-producing step names rail 1, and names the same *subset* it intends (see cad-task below).
- **Benefit:** closes a real safety gap. **Effort:** low. **Risk:** low.

**7. Seam change — `cursor bump-total` (or `--preserve`) subcommand (Pattern 3).**
`cmdCursorSet` (planning.mjs line 168-169) hard-requires `--phase/--status/--next` with no preserve mode, forcing a `cursor get` round-trip in cad-pause (needs `--phase <current>` on cold start) and cad-phase (`add` tells the coordinator to echo "same phase/status/next"). Verified safe: `cmdStatus` recomputes `total` fresh from ROADMAP (line 141) and never reads `cursor.total`, so a `bump-total` op that re-derives only `total`/`Updated` is cheap and correct.
- **Benefit:** removes one get+set round-trip in two skills. **Effort:** medium (code + a test) — the only reason this ranks last among cross-cutting. **Risk:** low.

## Per-skill fixes

Everything whose whole content is "batch the independent entry reads" is subsumed by cross-cutting fix #1 and needs only the one-line pointer, not a separate edit; listed below are only the skill-local fixes that carry a non-obvious dependency boundary or aren't a plain batch. Dropped false-positives noted per skill.

**cad-config** — (a, high) `config-review.md` per-provider loop fires `review-provider.mjs detect-models` one provider at a time, each with a 120s timeout: worst case ~3x120s serial. Add a detection-first phase firing all providers' detect calls concurrently in one message, then run the existing serial Handle/Assign/Write loop over the results. Highest single win in the set. (b, correctness) The menu preselect layer: `config.mjs get` returns *effective* (repo>global>default) values, but a per-repo edit UI must label `(current)` from the repo file's *own* literal value or a globally-inherited value gets written into the repo file as if chosen — state that the menu reads the repo file's literal values for `(current)`, a deliberate exception to the seam's read-for-value rule. (c, low) config.md §0 read feeds the menu — note it so the file isn't re-opened.

**cad-health** — (high) Spine the check on `node planning.mjs status` instead of the current prose that re-parses STATE/ROADMAP/REQUIREMENTS turn by turn (verified: SKILL.md has no `status` call today). `status` returns dir-exists, ROADMAP parse, per-phase derived status, and a `drift[]` array covering exactly its step-5 checks. Retain the four residual checks `status` intentionally omits: PROJECT.md presence, ROADMAP number gaps/dupes, a requirement pointing at a non-existent phase, and an unparseable cursor (via `cursor get`). Cuts tokens and removes a real drift hazard (prose parser vs. the canonical grammar). Medium effort because the residual list must be preserved or it regresses coverage.

**cad-docs-verify** — (high) Step 3 verify pass: fire all path-existence checks as one `test -e` loop, all symbol/config Greps as parallel Grep in one message, all cited-code Reads as one batch; serialize only a check that depends on a prior result. This is the bulk of the workflow's turns. (medium, opt-in) Above a doc-count threshold, fan out one subagent per doc (extract+verify+classify, return only the compact table) so the grep/read firehose stays out of orchestrator context; keep the inline path for a single README. Real architectural change — make the threshold and single-doc fast path explicit.

**cad-progress** — (correctness, see cross-cutting #5) `--stats` mutation; also drop the unused `git log --oneline -8` on the stats path (stats needs commit count and first/last dates, not the 8-line log). (medium) `derive` fires `planning.mjs status` and `git log --oneline -8` in one message — the status JSON carries no git data, so they're independent; keep the `ok:false` stop as a post-check.

**cad-debug** — (skill-local) `list` route: extract both header fields in one `grep -H '^# debug:\|^Status:' .planning/debug/*.md` and filter `resolved` in the coordinator, instead of N per-file Reads.

**cad-new-project** — (skill-local) Collapse `setup` items 2-5 (git-init conditional, mkdir, config-copy conditional, `config.mjs get`) into one Bash script that emits a marker for the conditional "Config written with defaults" line. *Dropped: skip re-reading the just-written PROJECT.md — false-positive, the canonical on-disk re-read is cheap insurance.*

**cad-milestone** — (clarity) Step 1 names the audit gate but not the mechanism; make it "Invoke `/cad-audit <milestone>` via SlashCommand; on FAIL report and STOP," mirroring step 7, so the coordinator reuses the tested audit workflow instead of re-deriving break-codes inline.

**cad-pause** — (correctness/clarity) Step 2 line 41 "The seam keeps `Phase:`" is wrong — `cmdCursorSet` fails `bad-args` without `--phase`. State the caller supplies `--phase <current>` (from `cursor get` when unknown) and the seam derives name/total and stamps Updated. Pairs with cross-cutting #7.

**cad-phase** — (clarity) `add`'s "update the cursor's total via `cursor set` (same phase/status/next)" hides a required `cursor get` first; make the two-step explicit (or adopt `bump-total` from #7). (low) `Finish` first bullet: drop the tautological "seam's `total` should match the ROADMAP" clause — `cmdRenumber` returns `total: after.length`, the post-write count; keep only the `planning.mjs status` spot-check.

**cad-spike** — (clarity) Establish `<slug>` and `.planning/spikes/<slug>/` in step 1/2 and write SPIKE.md at its final path there, so step 6 completes the same file in place; fix "beside the throwaway code" so it holds whether the code ran in the spike dir or a temp dir.

**cad-task** — (clarity, critic's option b) Do NOT narrow git_guard (that re-litigates the integration-branch design). Instead correct the `<objective>`/`<purpose>` "nothing else" wording so it stops claiming the guard is only the protected-branch guard when rail 1 also runs base-integrity and the integration-branch decision.

**cad-land** — (low) Step 5 `--merged` clause: reframe so it's clear cleanup effectively runs only on the auto_close path (no manual step-4a option merges locally); document the seam's generic `--merged` fallback as a note rather than implying a manual land reaches cleanup.

**cad-undo** — (correctness) Step 4: apply git.md rail 1 before the revert commit, or document the exemption explicitly (see cross-cutting #6). *Dropped: step 5 batching the two `planning.mjs` calls — false-positive, real read/write overlap on ROADMAP.md for a one-round-trip saving on a rare command.*

**cad-coverage** — (medium) Step 2: batch the requirement/impl reads but keep `git diff <start>..<end>` in the follow-up turn (it needs the commit hashes from SUMMARY.md). *Dropped: step-3 offload — false-positive, breaks the un-duplicated audit+generate shared context.*

**cad-verify** — (low) `build_or_resume`: batch the *applicable* source docs only (CONTEXT+SUMMARY, or the PLAN+ROADMAP+SUMMARY fallback), not both branches. *Dropped: route_failures offload — false-positive, inline diagnosis is load-bearing for wording the fix and the interactive approval loop.*

**cad-execute** — `locate`, `git_guard` plan reads subsumed by #1; item-5 fan-out in cross-cutting #2. *Dropped: execute_sequential defer-diff-to-phase-end — false-positive, mid-phase advisory visibility is a deliberate, non-symmetric design posture (worktrees isolate the parallel path; sequential is not).*

**cad-decision-review** — refute concurrency in cross-cutting #2. (low) Also align the `<success_criteria>` Context7 checkbox to the `adjudicate` step's escape hatch ("...or the objection set was explicitly noted to contain none"), so a coordinator self-checking the literal box doesn't fire an unnecessary resolve-library-id+query-docs pair on a decision whose objections make no library/API claim.

**cad-capture, cad-context, cad-plan, cad-plan-review, cad-verify-sweep** — batch-reads only; fully subsumed by cross-cutting #1 (one-line pointer at capture step / load_priors+analyze / load_phase / fire() step 1 / step 2 respectively; note context.md `analyze` also picks up Pattern 2's batched config get, and cad-context picks up the batch-asks clause).

## Explicitly NOT changing

- **cad-coverage step-3 offload** — the workflow's stated design is an un-duplicated flow where audit and test-generation share one gathered context; offloading forces step 5 to re-read, duplicating the saved work and eroding the win on the common small-phase case.
- **cad-verify route_failures offload** — inline diagnosis is load-bearing: the coordinator uses the code context it just read to word the fix proposal and answer the user's follow-ups, and failures are usually 1-2 so the spawn round-trip costs more than the inline read saves.
- **cad-execute execute_sequential defer-diff** — mid-phase advisory surfacing (a watching user can react early, each review sees the cumulative tree) is deliberate; the sequential and parallel paths are not symmetric because only the parallel path isolates plans in worktrees.
- **cad-task narrow git_guard** — the integration-branch model is a settled, config-gatable design; the cost is already small (feature branch → `stay` cheaply; `integration_branch=trunk` avoids creation). Fix the wording, not the guard.
- **cad-undo step-5 seam-call batch** — genuine read/write overlap on ROADMAP.md; safe only incidentally today, inverted risk/reward for one round-trip on a rare recovery command.
- **cad-new-project re-read of PROJECT.md** — re-reading the just-written doc guarantees extraction from the canonical on-disk form and costs one small local read.
- **Fresh-context re-reads across the pipeline** — each workflow re-reading ROADMAP/PROJECT/REQUIREMENTS/CONTEXT is deliberate (fresh coordinator context has nothing cached). The fix is standardizing the coordinator-vs-agent read handoff (cross-cutting #4), not eliminating the reads.

## Suggested sequencing

1. **Prototype the two conventions first.** Write the parallel entry-gather rule (conventions.md) and the concurrent-dispatch rule (seams.md), wire one-line pointers into 2-3 representative workflows (cad-progress `derive`, cad-docs-verify step 3, cad-execute `locate`), and confirm the coordinator actually batches in practice before propagating. This de-risks the highest-reach change.
2. **Fix the correctness riders regardless of the perf agenda** — cad-progress `--stats` branch, cad-config menu preselect layer, cad-undo protected-branch guard. These gate output quality, not speed, so they ship independently and early.
3. **Ship the two high-value fan-outs** — cad-config `config-review.md` parallel `detect-models` (biggest single latency win), then decision-review `refute` and execute item-5 once convention #2 lands.
4. **Propagate the pure one-line pointers** across the remaining batch-reads and batch-asks skills, and hoist the batched `config.mjs get` into context.md / cad-land / cad-milestone.
5. **Run the two grep-driven audits** — preview-mode-mutation (Gap D, verify cad-health inspect-only) and protected-branch-guard coverage (Gap E, verify every commit-producing step names its intended rail-1 subset).
6. **Do the cad-health seam-spine rewrite** (medium effort) — retain the four residual checks or it regresses coverage; land after the audits so the inspect-only property is already confirmed.
7. **Last, the seam change** — add `cursor bump-total` (code + test), then simplify cad-pause and cad-phase to drop their get+set round-trip.
