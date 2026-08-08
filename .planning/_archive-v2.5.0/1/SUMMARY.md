---
phase: 1
status: complete
completed: 2026-08-08
---

# Phase 1: Benchmark quick wins - Summary

A joined event trace at `.planning/trace.jsonl`, a `detect-commands` static-analysis
path that works with no config, a `lease-check` gate holding executors to their
declared files, fault injection across every `review-provider.mjs` failure mode -
and then a second plan that made each of those four surfaces fail a test before
fixing it, because `/cad-verify` found seven of them wrong in ways their own tests
could not see.

Two plans. Plan 1 shipped the surfaces (15 commits); plan 2 closed the defects
`/cad-verify` and the close-of-phase review found in them (8 tasks, 8 commits, one
task cut on the user's instruction rather than patched a fourth time).

## What shipped

**Plan 1 - the surfaces.**

- **The trace spine** - `cadence-core/bin/lib/trace.mjs` + `planning.mjs trace append|render`, four families (routing, provider, lifecycle, outcome) under one per-phase correlation id derived from the phase number and its `PHASE_START` sha. Gitignored, bounded, `appendFileSync`.
- **Trace producers** - `route.mjs` emits `routing/resolve`, `review-provider.mjs` emits `provider/request` with a tier reverse lookup; orchestrator lifecycle brackets in `workflows/execute.md` and `verify-deep.md`; `outcome/adjudication` and `outcome/uat_verdict` in the review and verify prose.
- **`/cad-progress --trace`** - a read-only display branch that never walks `reconcile`.
- **The static-analysis path** - `planning.mjs detect-commands` (5 lint arms, 5 typecheck arms, per-slot `source`), `workflow.lint_command` across all five config surfaces, and the executor contract's step-2b static-analysis step with a `blocked`-checkpoint carve-out.
- **The `LSP` tool grant** - both `cad-executor` rungs plus `KNOWN_TOOLS` in `self-verify.mjs`.
- **`planning.mjs lease-check`** - staged files compared against the plan's declared `files:`, wired into the executor's `<commit_protocol>` beside the risk-surface gate.
- **The `mergeLayers` warnings rule** - `lib/merge-warnings.mjs` plus a self-verify walker over `cadence-core/bin/**.mjs`.
- **Two authorization rails** - `git-guard` asks on a torn repo config layer on any branch; `git-publish` refuses to push or delete a branch while a layer is unreadable.
- **Fault injection** - six failure modes plus three adjacent properties, through a fake transport with no socket, no hostname resolution and no TLS.
- **Version guard and prose** - `git-branch.mjs decide` refuses a milestone the repo has already tagged; `/cad-health` check 7; the verifier's level 3 requires a traced value; `references/bug-patterns.md` read by `debug.md` before the first hypothesis.

**Plan 2 - making them trustworthy.**

- **Cross-run trace pairing** - `renderTrace` keys a worker by `(corr, phase, plan)`, so a re-run's terminal event can no longer close the previous run's dangling dispatch, and `unpaired` names which run stranded the worker.
- **A producer census** - a regression guard asserting all four trace families still have a writer in the shipped prose surfaces; proved failing-capable by three mutations.
- **The torn-layer guard, corrected** - `git-guard` names whichever layer tore, repo or user-global. A torn global layer carrying `protected_branches` no longer leaves the commit unguarded.
- **`lease-check` sees the real staged set** - `--name-status -z` read at the BYTE level (Buffer, 0x00 split, per-path round-trip), so a rename is checked on both sides and a non-ASCII path is no longer octal-escaped into a false `undeclared-files`. A third refusal reason `unrepresentable-paths` fails closed.
- **A clean starting index, checked upstream** - `execute.md`'s `git_guard` step now runs `git diff --cached --quiet` before the first dispatch and asks (stash / commit / abort) on a dirty one. This replaces the cut task 5 entirely.
- **The lockfile exclusion is an allowlist** - 23 basenames a package manager actually generates, matched exactly, applied to every risk surface.
- **Every provider drop-out is recorded** - `no-key`, `bad-provider`, `bad-args`, `bad-payload` and `over-cap` now write exactly one `provider` event naming the reason, `degraded: true`. A ten-row census pins it; the trace context is each command's first act rather than a byproduct of reaching the wire.
- **Milestone refusal by tag MEMBERSHIP** - `decideBranch` takes the whole tag list and refuses only when the milestone's own version is carried by a tag. `highestSemverTag` is deleted.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 28295af | the trace spine - `lib/trace.mjs` and `planning.mjs trace` |
| 1 | 2 | 8fbf16d | routing and provider trace events from the two seams |
| 1 | 3 | b1d657b | lifecycle brackets and the blocked-halt remedy in `execute.md` |
| 1 | 4 | b619fbe | the outcome family, the verifier bracket, and `/cad-progress --trace` |
| 1 | 5 | 4356564 | the `LSP` tool grant on both `cad-executor` rungs |
| 1 | 6 | 5d56f0e | `planning.mjs detect-commands`, the unconfigured static-analysis path |
| 1 | 7 | 7d0d333 | `workflow.lint_command` and the executor's static-analysis step |
| 1 | 8 | 5651cda | `planning.mjs lease-check` and the commit-step lease gate |
| 1 | 9 | 6b59c46 | git-guard asks on a torn config layer, on any branch |
| 1 | 10 | c98ac8e | a `mergeLayers` callsite must surface its `warnings[]` or say why |
| 1 | 11 | 8814cc0 | `phase_diff` resolves the same through all three surfaces |
| 1 | 12 | 52e2809 | a dependency lockfile stops matching the `concurrency` risk surface |
| 1 | 13 | 4856306 | fault injection across all six `review-provider` failure modes |
| 1 | 14 | 8eec49e | `git-branch decide` refuses a version the repo already published |
| 1 | 15 | 4291ace | the health drift rule, a traced level 3, and the bug-patterns checklist |
| 2 | 1 | 4377cfd | pair worker brackets within a correlation id, never across runs |
| 2 | 2 | cb3291b | census the four trace families' producers so a missing one is visible |
| 2 | 3 | 0ab7046 | ask on a torn config layer whichever layer tore |
| 2 | 4 | 1d24d9a | read the staged set so renames and non-ASCII paths are seen |
| 2 | 5 | 62c8774 | check the starting index once upstream, instead of gating named paths |
| 2 | 6 | a42cbde | release lockfiles by an allowlist of names, not by a shape rule |
| 2 | 7 | 3b3d09b | record the provider drop-outs before the wire, not only those past it |
| 2 | 8 | 45b4d6e | refuse a milestone by tag membership, not by sort order |

Plan 1: `28295af..4291ace`, 15 commits. Plan 2: `4377cfd..45b4d6e`, 8 commits.
CI at HEAD (`45b4d6e`): **1320 tests pass, 0 fail**; `tsc -p tsconfig.ci.json`
exits 0; `self-verify` `ok:true` across 17 checks with zero problems.

## Deviations

36 recorded in `reports/plan-1.md`, 19 in `reports/plan-2.md`. The load-bearing ones:

**Plan 1.**

- **[deviation] task 13 reverses CONTEXT D-11.** D-11 reached the six failure modes through a test-only base-URL override on the `CADENCE_*` env-var precedent. The `risk_surface` gate rejected that implementation with a working proof of concept: the override had no test-only gate, so one attacker-settable variable made an ordinary run read the user's real key and transmit it as a cleartext `Authorization: Bearer` header to any local listener. The precedent does not hold - the three cited variables redirect a file READ, this one redirected a CREDENTIALED request. Discarded (`git reset` to 52e2809), not patched.
- **[deviation] task 9 corrects the plan's stated ordering.** Taken literally the plan DOWNGRADED a configured hard block: with the repo layer torn and the global layer carrying `on_protected: refuse`, the guard returned `deny` before the task and `ask` after it. The protected decision is computed first.
- **[deviation] task 10 edited four files outside the plan's `files:` lease** to close blocking review items; `PLAN.md` was left unmodified rather than back-filling its lease mid-execution.

**Plan 2.**

- **[deviation] task 5 is CUT, and nothing of its design ships.** A blocking `risk_surface` FAIL returned all three voices converged on one blocker with two reproduced end to end - the fourth blocking FAIL in this phase and the third where a fix opened a new hole. Per the user's standing instruction the task was discarded rather than patched again: `git reset` + `git checkout --` on all four files, verified by an EMPTY `git diff 1d24d9a --stat` over them, and the suite returned from 1292 to 1286 tests. Why it was cut, for the record: (i) nothing forced the executor to NAME every path it staged, so an unnamed staged file rode the orchestrator's own docs commit - `git show HEAD:leftover.txt` printed a planted secret; (ii) `parseArgs` swallows a path after `--`, turning a hard `undeclared-files` refusal into `ok:true` exit 0; (iii) the seam had no provenance signal at all and could not distinguish the user's pre-staged file from one the executor staged and omitted. The plan's actual requirement is met upstream instead, in `execute.md`'s `git_guard` step, by refusing to START on a dirty index.
- **[deviation] task 5's replacement edits `cadence-core/workflows/execute.md`, which is NOT in PLAN-2's declared `files:`.** Recorded here rather than back-filled into the plan's frontmatter mid-execution, per the user's instruction.
- **[deviation] task 6 ships an ALLOWLIST, superseding PLAN-2's own supersession of D-05.** The plan authorized a shape rule; a blocking `risk_surface` review rejected its second arm with both cross-model voices converging on the same remedy - the set of package managers is finite and enumerable, the set of names that merely LOOK like a lockfile is not, so an allowlist is strictly more precise in both directions. The committed rule releases strictly FEWER paths than the plan authorized. The accepted cost the first pass wrote (`deploy/redis-lock.yaml` released) is deleted, because it is no longer paid.
- **[deviation] task 6 reverses a pre-existing green test.** `the exclusion is case-insensitive on the suffix` becomes `the allowlist is matched EXACTLY`: `Gemfile.LOCK` and `cargo.lock` keep their floor because no tool writes them. The direction is conservative - the rewrite floors MORE, never less.
- **[deviation] task 4 adds a byte-level read the plan never names.** The plan said `-z` alone fixes the non-ASCII half; it does not, and the blocking review reproduced why - `-z` is correct on the wire and is undone by the `{encoding:'utf8'}` decode above it. Added Buffer output, 0x00 split, per-path round-trip, and a third refusal reason `unrepresentable-paths`, fail-closed.
- **[deviation] task 8 adds two totality guards the plan does not name.** A non-string element in the tag list is skipped rather than thrown on (it is `git tag --list` output, data this module did not write), and a bare STRING argument is read as the one tag it is - the fail-open shape the argument change itself creates, where a caller left on the superseded scalar would silently DISARM the guard.
- **[deviation] task 8's proof-of-failure could not fail as written.** HEAD ignores an unknown option key, so the pure `v1.9.1` row goes green vacuously - the exact shape this plan exists to answer. The case was written at BOTH levels: the pure row with tagged-neighbour `ask` controls that DO fail, and a new live-git seam row in `git-branch.test.mjs` where `'ask' !== 'create'` is a real red against real tags.
- **[deviation] task 2's Verify step names a mutation that cannot fail.** Deleting `--family outcome` from `review-triggers.md:175` left 22 pass / 0 fail, because `workflows/verify.md:233` is a SECOND outcome producer and the assertion is per-FAMILY. Recorded the non-failure, then proved failing-capability by two other mutations. No test was weakened to fit.

## Open items

**From the `diff` review at plan 2's close** (advisory gate; openai only - the
deepseek voice dropped with `transport` / `ECONNRESET`. Two of its three findings
were killed in adjudication: the scalar-compat claim is wrong because
`tagCarrying` (`branch-decision.mjs:102-110`) does wrap a bare string and the one
caller passes the list (`git-branch.mjs:80-81`); the `Gopkg.lock` claim is the
allowlist's stated and deliberate trade, and it floors TOWARD review, not away):

- **MEDIUM, confirmed.** `correlationId` is `${phase}-${sha}` (`lib/trace.mjs:113-130`), so a phase re-run at an UNCHANGED HEAD mints the same `corr` and FIFO pairing at `:264` can still close the stranded dispatch with the retry's return. Task 1 fixed the `(phase, plan)` half of this defect; the same-sha collapse half survives, and the comment at `:119` ("a re-run of a phase starts a new id") overstates what the derivation guarantees. Recorded not fixed - the advisory gate plus this phase's standing instruction on repeat FAILs.

**From plan 2's execution:**

- [task 6, deliberate] The allowlist floors names the `.lock` suffix rule released - `Gopkg.lock`, `glide.lock`, `paket.lock`, `shard.lock`, `Berksfile.lock`, `Puppetfile.lock`. The stated maintenance cost working as designed; the remedy is one line in `LOCKFILES` plus one row in `ALLOWLISTED`.
- [task 8] The published-version guard now refuses strictly FEWER milestones: only exact tag membership. The #87 collision still refuses; an untagged version that merely sorts low no longer does, which is the defect. Noted so the loosening is a recorded decision.
- [task 8] `decideBranch` no longer accepts the `publishedVersion` KEY. An in-tree caller left on it fails tsc; a caller outside the tree would get `undefined` and no guard. Only the scalar VALUE shape is tolerated.
- [task 7] `fail('bad-payload', e.message)` copies a `JSON.parse` error into the trace, and Node quotes a fragment of the offending input. The fragment is the review payload - content the run was about to send to a third-party model - sliced to 200 chars, in a gitignored file, already on stdout. A wider audience for an already-disclosed string, not a new disclosure.
- [task 7, deliberate] `traceProvider` marks the call recorded BEFORE attempting the write, so an unwritable trace does not license a second attempt from `fail()`. Keeps "exactly one event per call" true at the cost of never retrying a failed explicit write with poorer detail.
- [task 5] `parseArgs` treats ANY `--`-prefixed token as a flag consuming the next word, so a bare `--` binds the following positional as an option value. Harmless for `lease-check` now that it takes no positionals; it will bite the next command that takes them.
- [task 5] `unrepresentable-paths` and `no-staged-set` are computed over the WHOLE index, so a user-staged non-UTF-8 filename still refuses every plan. The upstream dirty-index check makes that reachable-but-rare rather than a live halt.
- [task 5] The `git diff --name-only -- <paths>` equality assertion the cut design used was blind to a path staged as a DELETION whose file exists untracked. Reproduced by the reviewer; recorded because the shape returns with any future pathspec-commit proposal.
- [task 4] `parseStagedNameStatus` accepts a stream whose final record has no trailing NUL, and a stream cut mid-path yields a truncated path rather than `null`, contrary to its docblock. Not reachable from real git (both real shapes fail closed); the defect is the unmet contract.
- [task 4] The `C` (copy) branch adds the copy SOURCE to the leased set. Defensive only - `-M` overrides `diff.renames=copies`, so `C` is unreachable as this seam invokes git.
- [task 3] The assertion added to the EXISTING repo-layer torn-config test is one the UNFIXED implementation also satisfies, so it does not by itself distinguish the fix. Harmless beside the new case that does, but a reader could mistake it for the guard.
- [task 4, credit worth keeping] The reviewer fuzzed 500k cases across `A D M T U X R<score> C<score>` with adversarial paths and found ZERO desyncs. The variable-stride parsing was correct; only the encoding beneath it was wrong.

**Carried from plan 1, still open:**

- AC1, AC2 and AC3's behavioural halves belong to `/cad-verify`'s walk: a scratch repo whose failing lint must produce a `blocked` checkpoint and no commit; a `cad-executor` dispatch completing normally with no code-intelligence plugin; and the next `/cad-execute` leaving a trace with all four families under one `corr`.
- `detect-commands` names a tool binary from the presence of its config table and never checks the binary is reachable. The eslint arm emits `npx eslint .`, which would fetch and execute an unpinned package from the public registry. **Not addressed by plan 2** - it was a `/cad-verify` finding that PLAN-2 did not carry a task for.
- `git-publish`'s `tornLayerDetail` refuses on ANY warning including a torn GLOBAL layer, even when the repo layer provably wins the merge. One corrupt user-global file halts reaping and publishing in every repo on the machine. **Not addressed by plan 2.**
- `--root ""` falls through to the cwd, which the guard's own comment says it refuses. `lease-check` and `cmdTrace` normalize a decimal phase, so `1.10` reads `phases/1.1`.
- `design-notes/improvement-roadmap.md:5-6` still states the wire paths are untested by design - the other half of the policy D-10 reverses. Untracked and outside the lease.
- `lib/merge-warnings.mjs` treats a line starting with `*`, `//` or `/*` as a comment without tracking whether a block comment closes before executable code on it.
- `land-cleanup.mjs` `cleanup()` lacks the #38 lone-string tolerance its two sibling rails apply.
- The three git seams emit `"warnings":[]` on every run while `route.mjs` and `planning.mjs` omit-when-empty; the rationale comment cites `route.mjs` as precedent for the opposite of what it does.
- Context-reduction candidates for phase 2: `execute.md` 19340→24275B, `cad-executor-contract` 10891→12625B, `verify-deep.md` 2529→3650B, `cad-land/SKILL.md` 10467→11096B, `cad-verifier-contract` 9206→9644B, `cad-health` 4101→4756B, `debug.md` 6510→6785B, plus `references/bug-patterns.md` at 4247B.
- Pre-existing: `workflows/config.md`'s `workflow.test_command` row claims "empty→`null`", but `config.mjs set workflow.test_command=` writes `""`.

## Goal check

The phase goal names five clauses, and 23 commits across two plans deliver four of
them with the mechanical AND behavioural halves now both tested. The trace exists
and is joined (`lib/trace.mjs`, 28295af/b619fbe) and its pairing is no longer
wrong across runs - the failing case `renderTrace: a re-run never pairs across
runs` was red at HEAD with `actual undefined, expected '1-aaa'` at
`trace.test.mjs:198` before 4377cfd, and a producer census (cb3291b) now fails if
any of the four families loses its writer, proved by deleting `execute.md`'s
`phase_start` line and watching the assertion name the missing anchor. File leases
are enforced rather than checked, and correctly: `lease-check` reads
`--name-status -z` at the byte level (1d24d9a), so `git mv` across another plan's
declared file is refused on BOTH sides and `src/café.js` no longer returns a false
`undeclared-files`. Provider failure paths are exercised where they actually fail -
all five drop-outs BEFORE the wire now write one `provider` event naming their
reason (3b3d09b), which was `0 !== 1` at `review-provider.test.mjs:575` at HEAD
because `.planning/trace.jsonl` did not exist at all after a `no-key` run. The
named tracker fixes landed: the milestone guard refuses by tag membership
(45b4d6e), verified live - the `v1.9.1` fixture returned
`ask`/`branch:null` with a reason citing a tag that does not exist before, and
`create`/`cadence/v1.9.1` after, while this repo still returns
`create`/`cadence/v2.5.0`. CI at HEAD is green on all three: 1320 tests pass 0
fail, `tsc -p tsconfig.ci.json` exits 0, `self-verify` `ok:true` across 17 checks
with zero problems.

What the phase does NOT deliver is the static-analysis clause at the same
standard, and one plan-1 finding is untouched. `detect-commands` still names a
binary from the presence of its config table without checking the binary is
reachable, so the unconfigured path can hand an executor `ruff check .` on a
machine with no `ruff` and turn it into a `blocked` checkpoint after three wasted
attempts - and its eslint arm still emits `npx eslint .`, which fetches and
executes an unpinned package from the public registry. PLAN-2 carried no task for
either, and neither is closed. `git-publish`'s over-broad torn-layer refusal is
likewise still open. Task 5 was cut outright rather than patched: the executor's
commit gate is unchanged, and the requirement it served is met upstream by a
starting-index check in `execute.md` - a real fix, but a different one from the
one planned, and it is prose rather than code, so nothing tests it. Four blocking
`risk_surface` FAILs landed in this phase and three of them were cases where a fix
opened a new hole, which is the honest headline: the surfaces are now
trustworthy where a test proves it, and the places without a test are exactly
where the phase kept being wrong. `/cad-verify` should re-walk the seven items it
failed and treat `detect-commands` as the first of them.
