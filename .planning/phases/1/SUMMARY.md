---
phase: 1
status: complete
completed: 2026-08-07
---

# Phase 1: Benchmark quick wins - Summary

A joined event trace at `.planning/trace.jsonl`, a `detect-commands` static-analysis
path that works with no config, a `lease-check` gate holding executors to their
declared files, and fault injection across every `review-provider.mjs` failure mode
through a module-private transport reference.

## What shipped

- **The trace spine** - `cadence-core/bin/lib/trace.mjs` + `planning.mjs trace append|render`, four families (routing, provider, lifecycle, outcome) under one per-phase correlation id derived from the phase number and its `PHASE_START` sha. Gitignored, bounded, `appendFileSync`.
- **Trace producers** - `route.mjs` emits `routing/resolve`, `review-provider.mjs` emits `provider/request` with a tier reverse lookup; orchestrator lifecycle brackets in `workflows/execute.md` and `verify-deep.md`; `outcome/adjudication` and `outcome/uat_verdict` in the review and verify prose.
- **`/cad-progress --trace`** - a read-only display branch that never walks `reconcile`.
- **The static-analysis path** - `planning.mjs detect-commands` (5 lint arms, 5 typecheck arms, per-slot `source`), `workflow.lint_command` across all five config surfaces, and the executor contract's step-2b static-analysis step with a `blocked`-checkpoint carve-out in `<deviation_rules>`.
- **The `LSP` tool grant** - both `cad-executor` rungs plus `KNOWN_TOOLS` in `self-verify.mjs`.
- **`planning.mjs lease-check`** - staged files compared against the plan's declared `files:`, wired into the executor's `<commit_protocol>` beside the risk-surface gate.
- **The `mergeLayers` warnings rule** - `lib/merge-warnings.mjs` plus a new self-verify walker over `cadence-core/bin/**.mjs`; every callsite now surfaces `warnings[]` or documents why not, with relay lines at the four prose callers.
- **Two authorization rails** - `git-guard` asks on a torn repo config layer on any branch; `git-publish` refuses to push or delete a branch while a layer is unreadable, checked immediately before each mutation.
- **Routing data** - `phase_diff` resolves `advisory` at shipped through all three surfaces (the template's whole `review.triggers` block was deleted, so the level decides); dependency lockfiles no longer match the `concurrency` surface.
- **Fault injection** - six failure modes plus three adjacent properties, driven through a fake transport with no socket, no hostname resolution and no TLS in the suite.
- **Version guard and prose** - `git-branch.mjs decide` refuses a milestone the repo has already tagged; `/cad-health` check 7; the verifier's level 3 requires a traced value; `references/bug-patterns.md` read by `debug.md` before the first hypothesis.

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

Range `28295af..4291ace`, 15 commits. CI at HEAD: 1278 tests pass, `self-verify`
`ok:true` (with `merge-warnings` in `checked`), `tsc -p tsconfig.ci.json` clean.

## Deviations

36 recorded in `reports/plan-1.md`. The load-bearing ones:

- **[deviation] task 13 reverses CONTEXT D-11.** D-11 reached the six failure modes through a test-only base-URL override on the `CADENCE_*` env-var precedent. The `risk_surface` gate rejected that implementation with a working proof of concept: the override had no test-only gate, so one attacker-settable variable made an ordinary run read the user's real key from `$XDG_CONFIG_HOME/cadence/providers.env` and transmit it as a cleartext `Authorization: Bearer` header to any local listener. Loopback is not a privilege boundary. The precedent D-11 rests on does not hold, because the three cited variables redirect a file READ and this one redirected a CREDENTIALED request. The first implementation was discarded (`git reset` to 52e2809), not patched; the env surface is gone rather than fenced, and a test asserts the module touches `process.env` in exactly three places.
- **[deviation] task 9 corrects the plan's stated ordering.** The plan said the torn-layer `ask` precedes the protected-branch decision. Taken literally that DOWNGRADES a configured hard block: with the repo layer torn and the global layer carrying `on_protected: refuse`, the guard returned `deny` before the task and would have returned `ask` after it. The protected decision is computed first; a `deny` keeps its decision and gains the parse reason. Passed adjudication at the gate.
- **[deviation] task 1 resolves plan-review finding (a) rather than carrying it.** A `phase_start` line has no prior anchor to scan, so the anchor event derives its id from its OWN `--sha` - the same derivation from the same datum one line earlier, minting nothing (D-06 intact). Without it the lifecycle family splits across two ids and AC3 is unreachable by construction.
- **[deviation] task 10 edited four files outside the plan's `files:` lease** (`git-publish.test.mjs`, `land-cleanup.test.mjs`, `cad-land/SKILL.md`, `references/git-guard.md`) to close blocking review items. `PLAN.md` was left unmodified rather than back-filling its lease list mid-execution.
- **[deviation] task 12 implements D-05 literally**, so only `*.lock` and `*-lock.json` are excluded.
- **[deviation] task 15's checklist order is judgment, stated as such** - nothing in this tree measures bug frequency.

## Open items

**Found by the `diff` review at phase close (advisory gate, 2 voices; deepseek was
down all session). Four highs, several reproduced live:**

- **HIGH, converged by both reviewers.** `git-guard.mjs`'s torn-layer arm is anchored to the REPO layer path only, so a torn USER-GLOBAL layer carrying `protected_branches` produces no `ask` and no `deny`. Reproduced: with a global layer holding `{"git":{"protected_branches":["release"],"on_protected":"refuse"}}` intact the hook emits `deny` on branch `release`; truncate one byte of that same file and the hook emits nothing at all and the commit lands unguarded. This is the silent-revert-to-defaults case the change was written for, and the sibling rail (`git-publish`) treats the same warning as decisive.
- **HIGH.** `lease-check` misses renames. `git diff --cached --name-only` prints only a rename's DESTINATION, so `git mv src/other-plans-file.js src/renamed.js` passes the lease while destroying a file another plan declared. Reproduced on git 2.55. A plain `git rm` of the same path IS caught, so the hole is specific to the most ordinary refactor shape.
- **HIGH.** `lease-check` hard-blocks on non-ASCII paths. Git quotes and octal-escapes any path outside ASCII at default `core.quotePath`, so a declared `src/café.js` returns `undeclared-files` naming `"src/caf\303\251.js"`, and the contract turns that into a `blocked` checkpoint. Neither `-z` nor `-c core.quotePath=false` is passed.
- **HIGH, converged by both reviewers.** `renderTrace` pairs lifecycle events by `(phase, plan)` and never consults `corr`, so a re-run of a phase closes the PREVIOUS run's dangling dispatch with the new run's terminal event and names the wrong worker as unpaired. When the re-run starts at the same sha, both runs also collapse to one correlation id, contradicting the header's claim that a re-run starts a new id.
- **MEDIUM.** `lease-check` gates the ENTIRE staged index rather than the paths the executor is about to commit, so a user's own pre-staged `README.md` hard-blocks the phase on work the plan never touched, and the executor cannot unstage it without destroying the user's work.
- **MEDIUM.** `detect-commands` names a tool binary from the presence of its config table and never checks the binary is reachable, so it returns commands that do not exist (`ruff`, `mypy`, `eslint`, `tsc` and `cargo clippy` are all absent here yet all get named) and the contract turns that into a `blocked` checkpoint after three wasted attempts. The eslint arm emits `npx eslint .`, which would fetch and execute an unpinned package from the public registry.
- **MEDIUM.** `LOCKFILE_RE` covers only `*.lock` and `*-lock.json`, so `pnpm-lock.yaml` and `packages.lock.json` still floor a phase to `critical` - the bug task 12 says it closes.
- **MEDIUM.** `git-publish`'s `tornLayerDetail` refuses on ANY warning including a torn GLOBAL layer, even when the repo layer explicitly declares `protected_branches` and therefore provably wins the merge. One corrupt user-global file halts reaping and publishing in every repo on the machine.
- **MEDIUM.** Provider drop-out causes most likely to fire - `no-key`, `bad-provider`, `bad-args`, `bad-payload`, `over-cap` - write NO provider trace event, because `meta` is constructed after `resolveProvider` and `assertUnderCap` have already thrown. This is precisely the case QW-05 exists to make visible.
- **MEDIUM.** `branch-decision.mjs` compares the milestone against the repo's HIGHEST semver tag rather than tag membership, so a legitimate maintenance milestone (`v1.9.1` in a repo tagged `v1.9.0` and `v2.0.0`) is refused with a reason asserting a tag that does not exist.
- **LOW.** `--root ""` falls through to the cwd, which the guard's own comment says it refuses. **LOW.** `lease-check` and `cmdTrace` normalize a decimal phase, so `1.10` reads `phases/1.1` and phases `1.1`/`1.10` share one correlation id.

**Carried from execution:**

- AC1, AC2 and AC3's behavioural halves are unproven here and belong to `/cad-verify`'s walk: a scratch repo whose failing lint must produce a `blocked` checkpoint and no commit; a `cad-executor` dispatch completing normally on a machine with no code-intelligence plugin; and the next `/cad-execute` leaving a trace with all four families under one `corr`.
- `design-notes/improvement-roadmap.md:5-6` still states the wire paths are untested by design - the other half of the policy D-10 reverses. Untracked and outside the plan's lease.
- `lib/merge-warnings.mjs` treats a line starting with `*`, `//` or `/*` as a comment without tracking whether a block comment closes before executable code on it.
- `land-cleanup.mjs` `cleanup()` lacks the #38 lone-string tolerance its two sibling rails apply.
- The three git seams emit `"warnings":[]` on every run while `route.mjs` and `planning.mjs` omit-when-empty; the rationale comment cites `route.mjs` as precedent for the opposite of what it does.
- `review-provider.mjs`'s header claims warnings ride every provider trace event; the trace records only a count, and nothing at all without a cursor phase. Its `reviewConfig()` citation `:290` is stale (`:303`).
- Context-reduction candidates for phase 2: `execute.md` 19340→22957B, `cad-executor-contract` 10891→12625B, `verify-deep.md` 2529→3650B, `cad-land/SKILL.md` 10467→11096B, `cad-verifier-contract` 9206→9644B, `cad-health` 4101→4756B, `debug.md` 6510→6785B, plus the new `references/bug-patterns.md` at 4247B.
- Pre-existing: `workflows/config.md`'s `workflow.test_command` row claims "empty→`null`", but `config.mjs set workflow.test_command=` writes `""`.

## Goal check

The fifteen commits deliver the SHAPE of all four goal clauses and the mechanical
half of each is real and tested: `lib/trace.mjs` plus `planning.mjs trace` exist
with a synthetic four-family proof and its falsifier (28295af, b619fbe);
`detect-commands` answers from five manifest families and correctly returns the
nothing-detected envelope on this repo, which has no `package.json` (5d56f0e);
`lease-check` reads the plan's frontmatter through `parsePlanFiles` and is wired
into the commit protocol (5651cda); and all six provider failure modes now have
tests that assert what the caller sees, through a transport that opens no socket
(4856306). CI is green at HEAD - 1278 tests, `self-verify ok:true` with
`merge-warnings` in `checked`, `tsc` clean. Two authorization-rail changes each
survived a blocking `risk_surface` gate, and one of those gates caught a real
credential-exfiltration primitive before it was committed, which is the strongest
evidence in this phase that the review subsystem works.

What is NOT delivered is the trustworthiness of three of those four. The advisory
`diff` review at close returned four highs, two of them converged across both
voices and three reproduced live against the tree, and they land on the phase's own
deliverables rather than around them: `lease-check` passes a staged rename that
destroys another plan's declared file and hard-blocks any commit touching a
non-ASCII path, so the lease is neither sound nor safe yet; `renderTrace` pairs
workers by `(phase, plan)` while ignoring `corr`, so a re-run mis-attributes which
worker died; `detect-commands` names binaries it never checks are reachable, so the
unconfigured path can hand an executor `ruff check .` on a machine with no `ruff`
and turn it into a `blocked` checkpoint after three wasted attempts; and
`git-guard`'s torn-layer arm covers only the repo layer, so a torn user-global
layer carrying `protected_branches` leaves the commit unguarded entirely - the
exact failure the task was written to close, reproduced by truncating one byte.
None of these were caught by the phase's own tests, which is itself the finding:
each has a cheap failing-capable test that does not exist. The phase should be read
as delivering the surfaces and owing a fix pass before any of them is relied on,
and `/cad-verify` should treat the four highs as the first items on its walk rather
than as background.
