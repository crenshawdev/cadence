# Cadence documentation claim ledger

The diff base for the next documentation sweep. Every factual claim
`/cad-docs-verify` extracted from Cadence's own self-description in run 1 has a
row here with its verdict and how it was resolved. The next cycle re-verifies
these rows rather than re-extracting the surface from scratch, so a report that
shrinks is a report that shrank because claims were fixed and not because the
extraction happened to land differently (DOC-02, phase 5 D-03).

## Run 1

Swept 2026-08-09 at `a6b8931` on `cadence/v2.6.0`.

Surface: 25 files, 268,992 B — `README.md`, `METHOD.md`, `INTERNALS.md`,
`CONTRIBUTING.md` and all 21 `cadence-core/workflows/*.md`. The full run-1
report is `.planning/phases/5/docs-verify-run-1.md` (archived with the phase at
the milestone close).

Counts: **509 accurate, 18 stale, 20 unverifiable** — 547 claims. Those are
counted from the report's table ROWS. The report also carries three per-group
headline lines that sum to 480/18/20; each undercounted its own group's accurate
rows, and the report says so. The rows are the record, and this ledger is
transcribed from them.

Three invocations over an explicit path list, recorded verbatim so the next
cycle re-runs them unchanged (D-01, D-02):

1. `/cad-docs-verify README.md METHOD.md INTERNALS.md CONTRIBUTING.md`
2. `/cad-docs-verify cadence-core/workflows/{audit,config,config-review,context,coverage,debug,decision-review,docs-verify,execute,milestone}.md`
3. `/cad-docs-verify cadence-core/workflows/{new-project,phase,plan-gaps,plan,progress,spike,task,undo,verify-deep,verify,verify-sweep}.md`

`docs-verify.md`'s default target set is deliberately NOT changed to match:
`cadence-core/workflows/` is a Cadence-only path, and a generic default naming
it would be wrong prose in the shipped plugin for every other project (D-01).

Two constraints the sweep ran under:

- `CONTRIBUTING.md` was swept by hand end to end, because no mechanical check
  covers it — `cadence-core/bin/self-verify.mjs:303` lints only `README.md`,
  `INTERNALS.md` and `METHOD.md` (D-15).
- `CONTRIBUTING.md:13`'s "the same three checks CI runs" is verified accurate
  against `.github/workflows/test.yml` rather than left unverifiable: that
  workflow still executes, with `origin` self-hosted and GitHub a mirror
  (D-14). The adjacent "no dependencies / no `npm install`" claim was judged on
  its own merits and came back stale.

A search hazard applied throughout run 1, and no longer applies:
`cadence-core/bin/lib/trace.mjs` carried two literal NUL bytes at `:336`, so
`grep`/`rg` over `cadence-core/bin/**` silently skipped that whole file without
`-a`. Filed as `DFC-01` and CLOSED in phase 1 of `v2.6.1` (`1e949bc`): the bytes
are now the `\0` escape and `self-verify` check 15 fails on a literal U+0000
anywhere under `cadence-core/bin/**`.

## Reading this ledger

**`divergence` is a RESOLUTION value here, and deliberately not a fourth
verdict.** `docs-verify.md`'s classification vocabulary is exactly
`accurate | stale | unverifiable` and stays that way (D-05). A divergence is a
stale claim knowingly left standing, which is a property of what was decided
about the reading rather than of the reading itself; adding it to the workflow's
vocabulary would re-emit it for every other project that runs the command and
would cost a budget regeneration on a file with zero slack.

**The ids are POSITIONAL.** An id is the doc's basename uppercased plus a
two-digit ordinal in run-1 report order (`README-01`, `CONTRIBUTING-03`,
`PLAN-02` for `cadence-core/workflows/plan.md`). That makes them stable within
this run and NOT across runs: one claim added or dropped shifts every id below it
in that doc, so next cycle's `README-02` need not be this cycle's.

**The join rule that follows from it:** the next cycle's diff matches rows on
`doc` plus claim TEXT, and carries an id forward only where that text matches. A
diff joined on the id alone would report a resolved claim as regressed and a
newly drifted one as already corrected.

**The `line` column is run 1's location**, read at `a6b8931`. Phase 5's own
corrections moved some of them, by varying amounts and in more than one file.
`METHOD.md` took three edits in `b2bad1a` - `+3` at `:91`, `+1` at `:276`, `+2`
at `:304`, 614 lines to 620 - so a `METHOD.md` row below `:91` sits 3, 4 or 6
lines lower than its cell says depending on how many of those it is below; and
`044806c` moved four workflow files (`audit.md` `+1`, `execute.md` `+2`,
`progress.md` `+1`, `task.md` `+2`). Do not apply a single offset. The column is
provenance, not an address to seek to, and the
join rule above is on `doc` plus claim text precisely so a line that moved
cannot break the diff.

**Resolution values.** `accurate` on every row the sweep confirmed;
`corrected - <sha>` on a stale or unverifiable row whose prose was edited, naming
the commit that edited it; `divergence - <reason>` on one deliberately left
standing. `pending` is a transient placeholder used only while phase 5 is
executing, so that no cell is ever empty; zero rows read `pending` at the phase's
close. A row whose claim turned out to describe a code defect rather than stale
prose carries the defect's `DFC-0k` id in its resolution.

## Defects filed out of this sweep

Run 1 found no claim describing a code defect: all 18 stale rows are stale
PROSE, with the code correct in every one of them. So no ledger row carries a
`divergence - code defect` resolution. Three ids were nonetheless filed under
`## Deferred` in `.planning/REQUIREMENTS.md`, because each names something real
that a correction inside this surface would otherwise bury (DOC-03). All three
are now CLOSED at their source in phase 1 of `v2.6.1`, each landing with a check
that fails against the unpatched tree:

- **DFC-01** — `cadence-core/bin/lib/trace.mjs:336` carried two literal NUL
  bytes, so every `grep`/`rg` over `cadence-core/bin/**` skipped that file
  without `-a`. A genuine code defect, named in advance by the plan and filed
  whether or not the sweep surfaced it. It did not: the file is outside the
  surface. CLOSED `1e949bc` — both bytes are the two-character `\0` escape,
  behaviour identical, and `self-verify` check 15 reports
  `nul-byte-in-source` for a literal U+0000 in ANY file under
  `cadence-core/bin/**`, tests included.
- **DFC-02** — `cadence-core/references/review-triggers.md:244` (and
  `docs/WORKFLOW.md:168`) stated `phase_diff` as `off / off / adjudicated`
  against a live `off / advisory / adjudicated`. Both files are outside this
  surface, and that row is the shared source of the four stale rows `METHOD-01`,
  `METHOD-02`, `EXECUTE-02` and `EXECUTE-03`. Those four were corrected here;
  the source they were copied from was filed, not widened into scope.
  CLOSED `98be3d2` — both cells now read `off / advisory / adjudicated`, and
  `prose-agreement.test.mjs` asserts each against what
  `route.mjs resolve --role cad-reviewer` returns per stakes level.
- **DFC-03** — `skills/cad-plan-checker-contract/SKILL.md:113` said "All
  five dimensions checked" while `:42` of the same file said six. Same fact as
  `METHOD-03`, one file over and outside this surface. CLOSED `f6eed02` — the
  criterion reads six, and `prose-agreement.test.mjs` fails when the declared
  count, the claimed count and the enumerated items disagree.

Where a row's correction has a filing behind it, the row's resolution names the
id: `corrected - <sha> + DFC-0k`. The suffix is the row's only link to its
filing, so a future diff can tell a corrected copy from a fixed source. It
carries the filing's status too — `DFC-0k closed <sha>` once the source is
fixed, which is what makes that link answer the only question it is asked.

## Claims

| id | doc | line | claim | verdict | resolution |
|---|---|---|---|---|---|
| README-01 | README.md | 36 | An OpenAI, Gemini **or DeepSeek** key runs the identical review job "with the provider enforcing the output schema". | stale | corrected - b2bad1a |
| README-02 | README.md | 38 | `docs/WORKFLOW.md` is "six figures and the three tables behind them". | stale | corrected - b2bad1a |
| README-03 | README.md | 10-11 | Install adds marketplace `https://git.jcrenshaw.dev/crenshawdev/cadence.git` then `/plugin install cadence@cadence`. | accurate | accurate |
| README-04 | README.md | 14 | Runtime scripts are zero-dependency; "there is no npm install, ever". | accurate | accurate |
| README-05 | README.md | 26 | All durable state lives in `.planning/` and git, incl. a four-line state cursor. | accurate | accurate |
| README-06 | README.md | 28 | Verifier scores every claim verified/failed/uncertain and uncertain counts toward neither side. | accurate | accurate |
| README-07 | README.md | 28 | The coverage audit reads assertions rather than counting test files. | accurate | accurate |
| README-08 | README.md | 30 | The git rails are a PreToolUse hook and every push stops and asks. | accurate | accurate |
| README-09 | README.md | 32 | `isPlainPush` was deleted; the sanctioned push runs in a separate subprocess built from an argument vector. | accurate | accurate |
| README-10 | README.md | 34 | What the guard reads now is eighty-five lines; a command counts if it starts with the word `git`. | accurate | accurate |
| README-11 | README.md | 34 | v2.2.0 deleted 2,251 lines of tokenizer. | accurate | accurate |
| README-12 | README.md | 34 | The hook fails open. | accurate | accurate |
| README-13 | README.md | 34 | `bash -c "git push"` is invisible and that is written down. | accurate | accurate |
| README-14 | README.md | 36 | Default reviewer is a fresh-context Claude subagent needing no API key. | accurate | accurate |
| README-15 | README.md | 36 | Up to four independent voices on one plan. | accurate | accurate |
| README-16 | README.md | 36 | Triage is a multi-select prompt with none as the default. | accurate | accurate |
| README-17 | README.md | 45 | `/cad-config stakes=shipped` is the one key. | accurate | accurate |
| README-18 | README.md | 48 | `solo` / `shipped` / `critical` are the three answers. | accurate | accurate |
| README-19 | README.md | 50 | The grid is 18 cells, one per level+role pair, in `cadence-core/route-table.json`. | accurate | accurate |
| README-20 | README.md | 50 | solo planner = Sonnet at `high`; shipped = Opus; critical = Opus `xhigh` with retry `max`. | accurate | accurate |
| README-21 | README.md | 52 | Rungs are `low`, `medium`, `high`, `xhigh`, `max`. | accurate | accurate |
| README-22 | README.md | 52 | Effort is frozen in agent frontmatter; self-verify fails on a cell naming a rung with no file and on a rung file no cell reaches. | accurate | accurate |
| README-23 | README.md | 54 | `model.escalate_on_failure`, on by default. | accurate | accurate |
| README-24 | README.md | 56 | Gates are `off`, `advisory`, `blocking`, `adjudicated`. | accurate | accurate |
| README-25 | README.md | 56 | Plan review is advisory at `solo`, adjudicated at `shipped` and `critical`. | accurate | accurate |
| README-26 | README.md | 56 | `risk_surface` is blocking at every level including `solo`. | accurate | accurate |
| README-27 | README.md | 56 | The eight surfaces are auth, billing, secrets, migrations, destructive, concurrency, API contracts, untrusted input. | accurate | accurate |
| README-28 | README.md | 58 | `risk.override.<surface>` waives one surface, repo config only; a global waiver is ignored and warned. | accurate | accurate |
| README-29 | README.md | 60 | Deep verification off at `solo`, on at `shipped` and `critical`. | accurate | accurate |
| README-30 | README.md | 64 | Commands are namespaced `/cadence:cad-*`. | accurate | accurate |
| README-31 | README.md | 66-70 | The five loop commands exist as named. | accurate | accurate |
| README-32 | README.md | 72 | `/cad-progress` auto-resumes incomplete work. | accurate | accurate |
| README-33 | README.md | 74 | `docs/figures/phase-loop.svg` exists. | accurate | accurate |
| README-34 | README.md | 76 | WORKFLOW.md holds fifteen decision points, the eighteen-cell grid, and the trigger-by-level table. | accurate | accurate |
| README-35 | README.md | 80 | `/cad-new-project` writes PROJECT.md, REQUIREMENTS.md and a phased ROADMAP.md into `.planning/` and sets a cursor. | accurate | accurate |
| README-36 | README.md | 88 | `/cad-verify` records in UAT.md. | accurate | accurate |
| README-37 | README.md | 93 | `/cad-milestone` tags the release. | accurate | accurate |
| README-38 | README.md | 93,111 | `/cad-land` asks push / MR or PR / tag / leave local with no preselected default. | accurate | accurate |
| README-39 | README.md | 101-122 | Every command in the three command lists exists. | accurate | accurate |
| README-40 | README.md | 117 | `/cad-config` walks every switch; `key=value` sets one directly. | accurate | accurate |
| README-41 | README.md | 128 | Cadence ships no instrumentation and phones nothing home. | accurate | accurate |
| README-42 | README.md | 138 | GSD is 71 skills, 34 agents, 46 capabilities, ~1.1M words. | accurate | accurate |
| README-43 | README.md | 138 | Cadence carries ~3% of GSD's documentary mass, measured 2026-07-10 against GSD `d010ea1`. | accurate | accurate |
| README-44 | README.md | 138 | Today it is 23 skills and 6 agent roles across 19 rung files. | accurate | accurate |
| README-45 | README.md | 140 | CI fails the build when the prose drifts from the code. | accurate | accurate |
| README-46 | README.md | 142 | MIT, original copyright in `LICENSE`, lineage in `NOTICE.md`. | accurate | accurate |
| README-47 | README.md | 10 | The marketplace URL actually serves a plugin marketplace. | unverifiable | divergence - the URL resolves only over the network; `plugin.json`s homepage and the `origin` remote both name that host, and nothing in the tree can settle what it serves |
| README-48 | README.md | 128 | Usage measurements: 7,548 requests / 2,845 Cadence, ~92k vs ~133k context, ~28c vs ~36c, 27% vs 8% Sonnet+Haiku. | unverifiable | divergence - personal account billing data, external to the repository; the paragraph already states it compares two piles of the authors own sessions rather than a controlled experiment |
| README-49 | README.md | 132 | v2.3.0 eager totals 231,422 -> 199,687 across "the twelve main commands"; `/cad-pause` 18,523 -> 8,197; `/cad-land` 36,235 -> 31,016. | unverifiable | corrected - 1154790 |
| README-50 | README.md | 132 | Skill and agent descriptions went from 8,550 to 5,397 bytes. | unverifiable | divergence - an explicitly historical v2.3.0 figure, left standing with its prose unedited; 1154790's "measured at v2.3.0" frame is scoped to the preceding sentence and does not reach this one |
| README-51 | README.md | 134 | Five of the twelve commands ended up slightly heavier. | unverifiable | divergence - an explicitly historical note about the v2.3.0 change, recorded in that phases record; the preceding paragraph now frames the whole v2.3.0 account as a measurement taken then |
| METHOD-01 | METHOD.md | 276 | `phase_diff`'s gate at `shipped` is "off (opt-in)". | stale | corrected - b2bad1a + DFC-02 closed 98be3d2 |
| METHOD-02 | METHOD.md | 279 | "Four of the five fire on their own; `phase_diff` ships off." | stale | corrected - b2bad1a + DFC-02 closed 98be3d2 |
| METHOD-03 | METHOD.md | 91 | The plan checker "checks five dimensions - requirement coverage, task completeness, sequencing, goal-backward truths, and scope sanity". | stale | corrected - b2bad1a + DFC-03 closed f6eed02 |
| METHOD-04 | METHOD.md | 301-303 | "Configure an OpenAI, Gemini or DeepSeek key and the identical job runs as a direct API call with the provider enforcing the output schema." | stale | corrected - b2bad1a |
| METHOD-05 | METHOD.md | 20 | `skills/cad-planner-contract/SKILL.md` is where planning lives. | accurate | accurate |
| METHOD-06 | METHOD.md | 24-31 | The planner follows the five-step goal-backward order (goal, truths, artifacts, wiring, tasks). | accurate | accurate |
| METHOD-07 | METHOD.md | 28 | 3 to 7 observable truths. | accurate | accurate |
| METHOD-08 | METHOD.md | 38-42 | Skeleton-first ordering; a working skeleton by commit 2 or 3. | accurate | accurate |
| METHOD-09 | METHOD.md | 44-46 | Read the actual files before writing tasks, each file once. | accurate | accurate |
| METHOD-10 | METHOD.md | 50-55 | Every task has exactly three fields: Files, Action, Verify, with the stated rules. | accurate | accurate |
| METHOD-11 | METHOD.md | 57 | Atomic; a task touching more than ~5 files is usually two tasks. | accurate | accurate |
| METHOD-12 | METHOD.md | 60-62 | A tool the environment lacks makes Verify a `human-verify` instruction. | accurate | accurate |
| METHOD-13 | METHOD.md | 66-71 | The prohibited scope words and the three `## PHASE TOO BIG` reasons. | accurate | accurate |
| METHOD-14 | METHOD.md | 74-79 | Six decomposition axes (trigger, size, lifecycle, failure-resume, freshness, ownership), a nudge not a rule. | accurate | accurate |
| METHOD-15 | METHOD.md | 83 | Plan check is on by default via `workflow.plan_check`. | accurate | accurate |
| METHOD-16 | METHOD.md | 85-88 | The checker derives must-be-trues before it is allowed to open the plan. | accurate | accurate |
| METHOD-17 | METHOD.md | 93 | Truth with no task = BLOCKER; task no truth needs = WARNING; findings without severity are invalid. | accurate | accurate |
| METHOD-18 | METHOD.md | 100 | `skills/cad-executor-contract/SKILL.md`. | accurate | accurate |
| METHOD-19 | METHOD.md | 102 | For each task: implement, verify, commit. | accurate | accurate |
| METHOD-20 | METHOD.md | 105-110 | State the expected output before running Verify; a surprise result is recorded as `[deviation] expected X, observed Y`. | accurate | accurate |
| METHOD-21 | METHOD.md | 112-114 | Generalized from Karpathy's recipe; there is no switch for it. | accurate | accurate |
| METHOD-22 | METHOD.md | 117-127 | Trivial vs structural deviation buckets; unsure means structural. | accurate | accurate |
| METHOD-23 | METHOD.md | 129-131 | Circuit breaker is three fix attempts per task. | accurate | accurate |
| METHOD-24 | METHOD.md | 133-138 | A failed package install is never auto-fixed and is the one deviation class with no inline path. | accurate | accurate |
| METHOD-25 | METHOD.md | 142-145 | Commit protocol: individual staging, never `git add -A`/`.`, risk check on the staged diff, `{type}({scope}): {description}`, post-commit glance. | accurate | accurate |
| METHOD-26 | METHOD.md | 147-149 | Executors never push, force-push, write STATE/ROADMAP/SUMMARY, or spawn a reviewer. | accurate | accurate |
| METHOD-27 | METHOD.md | 153 | `cadence-core/workflows/execute.md`. | accurate | accurate |
| METHOD-28 | METHOD.md | 156-160 | The seam intersects declared file lists pairwise; overlap forces sequential; a plan declaring no files forces sequential; a check that could not run forces it too. | accurate | accurate |
| METHOD-29 | METHOD.md | 161-166 | `phase_diff` is parallel-path only. | accurate | accurate |
| METHOD-30 | METHOD.md | 169-173 | Worktree safety: branch check before every commit, halt on mismatch; `git stash`, `git clean`, blanket `reset --hard`, `restore .` forbidden. | accurate | accurate |
| METHOD-31 | METHOD.md | 180 | `skills/cad-verifier-contract/SKILL.md`. | accurate | accurate |
| METHOD-32 | METHOD.md | 185-193 | Four levels: Exists, Substantive, Wired, Behaves. | accurate | accurate |
| METHOD-33 | METHOD.md | 195-198 | VERIFIED / FAILED / UNCERTAIN, with UNCERTAIN counting toward neither side. | accurate | accurate |
| METHOD-34 | METHOD.md | 200-205 | SUMMARY.md is treated as claims to falsify; the goal check in `execute.md` requires a `file:line` or command output. | accurate | accurate |
| METHOD-35 | METHOD.md | 209-212 | The four "how verifiers go soft" items. | accurate | accurate |
| METHOD-36 | METHOD.md | 216-222 | Anti-pattern scan list, the goal-path clause, and the `CADENCE-DEBT` exemption via required ceiling + trigger. | accurate | accurate |
| METHOD-37 | METHOD.md | 227-230 | Spot-checks: 2-4, ~10s each, no servers/state/network; `cargo test -- --list`, `pytest --collect-only -q`; at most one full-suite run. | accurate | accurate |
| METHOD-38 | METHOD.md | 235 | `cadence-core/workflows/coverage.md`. | accurate | accurate |
| METHOD-39 | METHOD.md | 239-241 | The Covered definition quoted verbatim. | accurate | accurate |
| METHOD-40 | METHOD.md | 244-247 | Reads assertions not file counts; prefers a RED check; test kind in the project's own framework. | accurate | accurate |
| METHOD-41 | METHOD.md | 250-252 | A heavy new dependency is flagged; the plan is approved first; a red test is never committed and goes to `/cad-debug`. | accurate | accurate |
| METHOD-42 | METHOD.md | 260 | `cadence-core/references/review-triggers.md`. | accurate | accurate |
| METHOD-43 | METHOD.md | 265-267 | One `fire(trigger)` procedure, no embedded reviewer loops; that rule lives in `references/conventions.md`. | accurate | accurate |
| METHOD-44 | METHOD.md | 272-277 | Trigger table rows for `plan`, `diff`, `risk_surface`, `pre_ship` (fired-by, when, gate at `shipped`). | accurate | accurate |
| METHOD-45 | METHOD.md | 281-283 | Gate vocabulary (4) and `review.mode` vocabulary (`single`, `panel`, `adjudicated`). | accurate | accurate |
| METHOD-46 | METHOD.md | 286-292 | Gates resolve from `stakes`; `diff` is off/advisory/blocking across the three levels; `risk_surface` does not move; a typo loses to the level's gate and is named in warnings. | accurate | accurate |
| METHOD-47 | METHOD.md | 300-301 | The default reviewer is a fresh-context Claude subagent needing no key. | accurate | accurate |
| METHOD-48 | METHOD.md | 308 | The finding schema `{file, line, severity: blocker\|high\|medium\|low, claim, failure_scenario}`. | accurate | accurate |
| METHOD-49 | METHOD.md | 318 | `skills/cad-reviewer-contract/SKILL.md`. | accurate | accurate |
| METHOD-50 | METHOD.md | 320-331 | Reviewer stance: refute not bless, line + concrete failure, approach differences are not findings, no inflation or softening, empty result valid after a genuine attempt. | accurate | accurate |
| METHOD-51 | METHOD.md | 336-342 | Adjudication: all reviewers run independently, main session grounds and owns the verdict; convergence is the one strong signal. | accurate | accurate |
| METHOD-52 | METHOD.md | 344-355 | Survivors are a numbered list with none as the default; three gates ship that way; the auto_close pre-ship arm triages none and halts on blocker/high. | accurate | accurate |
| METHOD-53 | METHOD.md | 359-362 | `cadence-core/workflows/decision-review.md` never auto-fires. | accurate | accurate |
| METHOD-54 | METHOD.md | 365-366 | Rulings are `survives`, `partial`, `refuted`, and a `refuted` must state its grounding. | accurate | accurate |
| METHOD-55 | METHOD.md | 369-373 | Grounding is mandatory and typed: Context7 for library/API claims, the real repo for factual ones, one of each per run or an explicit statement of none. | accurate | accurate |
| METHOD-56 | METHOD.md | 376-378 | A clean pass retargets onto the decision's own load-bearing claims and is never reported as a bare "no findings". | accurate | accurate |
| METHOD-57 | METHOD.md | 380-381 | Cost is reported qualitatively, never as a token or dollar figure. | accurate | accurate |
| METHOD-58 | METHOD.md | 385-388 | The eight risk surfaces that fire the blocking trigger. | accurate | accurate |
| METHOD-59 | METHOD.md | 390-397 | Detection sets a floor that only ever raises; lowering takes a named `risk.override.<surface>` read from the repo config alone, a global one is ignored and named. | accurate | accurate |
| METHOD-60 | METHOD.md | 399-406 | The pre-filter: a destructive op drops only when `git check-ignore` matches **and** `git ls-files` is empty; a secret drops only when template-shaped **and** a stub. | accurate | accurate |
| METHOD-61 | METHOD.md | 411-413 | The executor detects, stops and hands up; never reviews itself, never skips the gate. | accurate | accurate |
| METHOD-62 | METHOD.md | 418-433 | `references/consult.md` and its five rules, including `review.consult.attempt_threshold` and no local-subagent consult. | accurate | accurate |
| METHOD-63 | METHOD.md | 437-440 | The review -> revise -> review convergence loop was considered and cut. | accurate | accurate |
| METHOD-64 | METHOD.md | 447-457 | The "nothing silently passes" bullets (dropped reviewer names its reason, empty set falls back to the local subagent, pre-filter drop noted, etc.). | accurate | accurate |
| METHOD-65 | METHOD.md | 467-478 | `cadence-core/workflows/audit.md` and the six break codes `no-phase`, `no-plan`, `unpicked`, `phase-missing`, `not-verified`, `drift`, with `not-verified` expected mid-cycle. | accurate | accurate |
| METHOD-66 | METHOD.md | 480-482 | Plan frontmatter naming unknown requirement IDs is an orphan, weighed more lightly. | accurate | accurate |
| METHOD-67 | METHOD.md | 489-501 | `cadence-core/workflows/debug.md` and the four-step loop; 2 to 5 hypotheses, ranked most-likely-first, tested risk-first. | accurate | accurate |
| METHOD-68 | METHOD.md | 503-504 | `memory.backend: builtin` gates the hypothesize-step recall. | accurate | accurate |
| METHOD-69 | METHOD.md | 510-516 | `references/git-guard.md`; before the first commit the guard reads `git.protected_branches`, applies `git.on_protected`, and checks base integrity in the same pass. | accurate | accurate |
| METHOD-70 | METHOD.md | 518-525 | A command counts when its first word is `git` and the verb is the first non-flag word; `bash -c`, `$(...)`, `sudo git` are invisible; rail 3 lists what it misses. | accurate | accurate |
| METHOD-71 | METHOD.md | 527-531 | Two decisions are marked in `references/seams.md` as deliberately undefaulted: the publish mechanism and the protected-branch guard. | accurate | accurate |
| METHOD-72 | METHOD.md | 533-539 | Two tiers: an integration branch merged into per `git.auto_branch`, named by `git.integration_branch` (`milestone` default, `trunk` escape hatch); worktrees fork from the host's `worktree.baseRef`, required at `head`; `git.on_land_cleanup` returns to base, pulls, reaps. | accurate | accurate |
| METHOD-73 | METHOD.md | 542-547 | One conventional commit per task; publishing flows through a single sanctioned seam; `git.auto_close` runs audit through merge with no per-step prompts and halts on a blocking `pre_ship` FAIL. | accurate | accurate |
| METHOD-74 | METHOD.md | 554-558 | `references/conventions.md`; `STATE.md` is a four-line cursor, overwritten in place, seam is the only correct writer. | accurate | accurate |
| METHOD-75 | METHOD.md | 560 | No audit logs, activity tables or session narratives. | accurate | accurate |
| METHOD-76 | METHOD.md | 562-564 | Config is read only through the config seam, one call per key. | accurate | accurate |
| METHOD-77 | METHOD.md | 570-573 | `cadence-core/bin/self-verify.mjs` lints config keys, script invocations and file paths, and fails on agent prose reaching for an undeclared tool. | accurate | accurate |
| METHOD-78 | METHOD.md | 575-581 | The concurrency-phrasing check: a block claiming a concurrent set must issue it in one message, judged per issuing sentence, explanatory moods left alone. | accurate | accurate |
| METHOD-79 | METHOD.md | 584-589 | Five surface sets weighed against `cadence-core/bin/weight-budgets.json`: agents, SKILL.md, workflows, `references/`, `templates/`. | accurate | accurate |
| METHOD-80 | METHOD.md | 593 | `/cad-docs-verify` checks factual claims against the live codebase. | accurate | accurate |
| METHOD-81 | METHOD.md | 600-614 | Every path in the "Where each rule lives" table. | accurate | accurate |
| METHOD-82 | METHOD.md | 258 | "This is the largest subsystem and the one that most shapes the output quality." | unverifiable | divergence - a judgment about which subsystem most shapes output quality; no byte count settles it, and the subsystem spans several files |
| INTERNALS-01 | INTERNALS.md | 55 | "The API enforces the output shape (OpenAI `response_format`, Gemini `responseSchema`)." | stale | corrected - b2bad1a |
| INTERNALS-02 | INTERNALS.md | 11 | 19 files cover the six roles. | accurate | accurate |
| INTERNALS-03 | INTERNALS.md | 11 | `cad-plan-checker-medium` and `cad-plan-checker-high` are the same contract at two depths. | accurate | accurate |
| INTERNALS-04 | INTERNALS.md | 11 | `lib/rung-agent.mjs` states the rung->file map per role; the analyzer's unsuffixed file is its `xhigh` rung and `-high` is the lower one. | accurate | accurate |
| INTERNALS-05 | INTERNALS.md | 11 | CI refuses a rung a cell names with no file, and a rung file no cell reaches. | accurate | accurate |
| INTERNALS-06 | INTERNALS.md | 11 | CI refuses a rung file carrying any instruction of its own. | accurate | accurate |
| INTERNALS-07 | INTERNALS.md | 11 | CI refuses a rung file whose frontmatter effort is not the rung it is filed under. | accurate | accurate |
| INTERNALS-08 | INTERNALS.md | 13 | One key `stakes` with three answers; set with `/cad-config stakes=shipped`. | accurate | accurate |
| INTERNALS-09 | INTERNALS.md | 13 | A cell is model + start rung + retry rung + review gates + deep verify. | accurate | accurate |
| INTERNALS-10 | INTERNALS.md | 13 | The routed vocabulary is `sonnet` and `opus`; `haiku` and `fable` are reachable only by a `model.overrides` pin. | accurate | accurate |
| INTERNALS-11 | INTERNALS.md | 13 | An explicit pick wins; a config gate beats the level's only if it is one of the four values, else it loses and is named. | accurate | accurate |
| INTERNALS-12 | INTERNALS.md | 13 | `model.escalate_on_failure`, on by default; false holds the retry at its start rung. | accurate | accurate |
| INTERNALS-13 | INTERNALS.md | 13 | The risk floor only ever raises; lowering takes a named per-surface override; a project at `critical` is unaffected. | accurate | accurate |
| INTERNALS-14 | INTERNALS.md | 13 | CI refuses a retry rung that sits below the rung it started on. | accurate | accurate |
| INTERNALS-15 | INTERNALS.md | 15 | Routing governs dispatched subagents, not the main session. | accurate | accurate |
| INTERNALS-16 | INTERNALS.md | 17 | The five "read the code" pointers in the routing section. | accurate | accurate |
| INTERNALS-17 | INTERNALS.md | 21 | Every `git push` through Bash stops and asks; no exceptions. | accurate | accurate |
| INTERNALS-18 | INTERNALS.md | 23 | `auto_close` is an opt-in key. | accurate | accurate |
| INTERNALS-19 | INTERNALS.md | 27 | `git-publish.mjs` runs git with an argument vector, a `--` end-of-options separator, strict branch/remote validation, and refuses unless `auto_close` is on and HEAD is a non-protected branch. | accurate | accurate |
| INTERNALS-20 | INTERNALS.md | 37 | What replaced the tokenizer is `lib/git-segments.mjs`, eighty-five lines; a segment counts only when its command word is `git`, verb = first non-flag word. | accurate | accurate |
| INTERNALS-21 | INTERNALS.md | 37 | The invisible shapes are written down in `references/git-publish.md` rail 3, in the CHANGELOG, and as a pinned test row apiece. | accurate | accurate |
| INTERNALS-22 | INTERNALS.md | 39 | The six "read the code" pointers in the push-guard section. | accurate | accurate |
| INTERNALS-23 | INTERNALS.md | 45 | Detection intersects the live provider list with a shipped hint table; unknown ids fall through to manual placement rather than erroring. | accurate | accurate |
| INTERNALS-24 | INTERNALS.md | 49 | The three "read the code" pointers in the detection section. | accurate | accurate |
| INTERNALS-25 | INTERNALS.md | 55 | Gemini's schema enforcement is `responseSchema`. | accurate | accurate |
| INTERNALS-26 | INTERNALS.md | 61,65 | Four pure decision cores - `close-decision`, `publish-decision`, `branch-decision`, `release-decision` - each with a unit test per branch. | accurate | accurate |
| INTERNALS-27 | INTERNALS.md | 71 | Eager bytes are the skill plus its `@`-includes; reachable is eager plus one hop. | accurate | accurate |
| INTERNALS-28 | INTERNALS.md | 75 | Dispatch weight is a third number that never sums with the other two (agent file plus preloaded contracts). | accurate | accurate |
| INTERNALS-29 | INTERNALS.md | 79 | `node cadence-core/bin/weight.mjs resident --root <repo root>` works. | accurate | accurate |
| INTERNALS-30 | INTERNALS.md | 81 | `lib/resident-weight.mjs` and `bin/weight.test.mjs` exist. | accurate | accurate |
| INTERNALS-31 | INTERNALS.md | 43,45 | "Cross-model review can call OpenAI or Gemini for a second opinion." | accurate | accurate |
| INTERNALS-32 | INTERNALS.md | 9 | The host's override resolution order is environment -> per-invocation parameter -> frontmatter -> session, and reasoning effort cannot be overridden. | unverifiable | divergence - Claude Code host behaviour, external to this repository; the design depends on it but nothing here can decide it |
| INTERNALS-33 | INTERNALS.md | 45-47 | Live detection actually returns what a key can reach, and a model-not-found mid-review offers re-detect. | unverifiable | divergence - requires a live provider key and network |
| INTERNALS-34 | INTERNALS.md | 31 | The six shapes v1.4.0 found silent (`git -C`, `&`, `$(...)`, backticks, subshell, escaped quote, `bash -c`). | unverifiable | divergence - a historical claim about a reader deleted in v2.2.0; true when made and unreproducible now |
| INTERNALS-35 | INTERNALS.md | 35 | The old scan was O(KxN), 3.1GB at 224KB input, V8 abort at 280KB. | unverifiable | divergence - a measurement of code that no longer exists in the tree |
| INTERNALS-36 | INTERNALS.md | 37 | The 336KB input that aborted the old hook decides in milliseconds. | unverifiable | divergence - needs a benchmark run, not attempted in this sweep |
| INTERNALS-37 | INTERNALS.md | 73 | "Before I cut it, `/cad-land` was the heaviest in the plugin by eager bytes and the second lightest of the five I measured by reachable." | unverifiable | divergence - explicitly a pre-cut measurement over the five commands measured then; current figures are published in `docs/EVIDENCE.md` |
| CONTRIBUTING-01 | CONTRIBUTING.md | 13 | "Cadence has no build step and no dependencies. The scripts inside are zero-dependency Node, so there is no `npm install`." | stale | corrected - b2bad1a |
| CONTRIBUTING-02 | CONTRIBUTING.md | 13 | "The same three checks CI runs" - three checks, runnable locally. | accurate | accurate |
| CONTRIBUTING-03 | CONTRIBUTING.md | 16 | `node --test cadence-core/bin/*.test.mjs` - unit tests for the seam cores. | accurate | accurate |
| CONTRIBUTING-04 | CONTRIBUTING.md | 17 | `node cadence-core/bin/self-verify.mjs` - the prose<->code drift linter. | accurate | accurate |
| CONTRIBUTING-05 | CONTRIBUTING.md | 18 | `npx tsc -p tsconfig.ci.json` - honors the `@ts-check` pragmas. | accurate | accurate |
| CONTRIBUTING-06 | CONTRIBUTING.md | 13 | `node` and `git` on your PATH are what the three checks need. | accurate | accurate |
| CONTRIBUTING-07 | CONTRIBUTING.md | 21 | self-verify: every config key, script invocation and file path named in the workflows has to exist or the build fails. | accurate | accurate |
| CONTRIBUTING-08 | CONTRIBUTING.md | 21 | It weighs every agent file, every SKILL.md, every workflow, and every file under `cadence-core/references/` and `cadence-core/templates/`. | accurate | accurate |
| CONTRIBUTING-09 | CONTRIBUTING.md | 21 | It fails when one outgrows its byte budget. | accurate | accurate |
| CONTRIBUTING-10 | CONTRIBUTING.md | 21 | It fails when an agent's prose reaches for a tool its frontmatter never declared. | accurate | accurate |
| CONTRIBUTING-11 | CONTRIBUTING.md | 21 | "the build will run it for you either way." | accurate | accurate |
| CONTRIBUTING-12 | CONTRIBUTING.md | 9,29 | The MIT license, and contributions landing under it. | accurate | accurate |
| CONTRIBUTING-13 | CONTRIBUTING.md | 29 | Cadence is a derivative of GSD at `https://github.com/open-gsd/gsd-core`, spelled out in `NOTICE.md` and `LINEAGE.md`. | accurate | accurate |
| CONTRIBUTING-14 | CONTRIBUTING.md | 3 | `MANIFESTO.md` link. | accurate | accurate |
| CONTRIBUTING-15 | CONTRIBUTING.md | 5,7,9 | "Bug reports are welcome... doc fixes land fast"; the feature-PR policy. | unverifiable | divergence - maintainer intent, no code surface to check it against |
| CONTRIBUTING-16 | CONTRIBUTING.md | 21 | "The self-verify step is the one that catches most drift." | unverifiable | divergence - a relative-yield judgment across three checks; nothing measures it |
| CONTRIBUTING-17 | CONTRIBUTING.md | 25 | What a good bug report contains (Claude Code version, `node --version`, the relevant `.planning/` slice). | unverifiable | divergence - process guidance rather than a code claim; `.github/ISSUE_TEMPLATE/bug_report.md` exists but enforces no field |
| AUDIT-01 | cadence-core/workflows/audit.md | 31-34 | A digit-leading category like `2FA-01` is not admitted, so it appears in neither `unseeded` nor `counts` and is reported only in `active_issues`. | stale | corrected - 044806c |
| AUDIT-02 | cadence-core/workflows/audit.md | 136-140 | On an `active-non-id-bullet`, a span holding nothing but the id that is still reported means the id failed the admission test (a digit-leading category), and no rewrite will count it. | stale | corrected - 044806c |
| AUDIT-03 | cadence-core/workflows/audit.md | 19 | `planning.mjs audit` exists and returns one JSON line. | accurate | accurate |
| AUDIT-04 | cadence-core/workflows/audit.md | 23-24 | Break codes are `no-phase \| phase-missing \| no-plan \| not-verified \| drift \| unpicked`. | accurate | accurate |
| AUDIT-05 | cadence-core/workflows/audit.md | 25 | `orphans.plan_ids` holds plan frontmatter referencing unknown REQ-IDs. | accurate | accurate |
| AUDIT-06 | cadence-core/workflows/audit.md | 27-28 | `frontmatter_issues` exists; `references/plan-frontmatter.md` states the grammar. | accurate | accurate |
| AUDIT-07 | cadence-core/workflows/audit.md | 29-30 | `unseeded` names `## Active` ids with no Traceability row, each also carrying an `unpicked` break. | accurate | accurate |
| AUDIT-08 | cadence-core/workflows/audit.md | 35-36 | `active_issues` holds lines inside `## Active` outside the bullet grammar; `references/req-traceability.md` exists. | accurate | accurate |
| AUDIT-09 | cadence-core/workflows/audit.md | 36-37 | `nonconforming_plans` names a `PLAN*.md` no seam reads, e.g. `PLAN-gaps.md`. | accurate | accurate |
| AUDIT-10 | cadence-core/workflows/audit.md | 37-38 | `deferred` holds rows whose Status is `Deferred`. | accurate | accurate |
| AUDIT-11 | cadence-core/workflows/audit.md | 39-40 | `version_drift` is `{doc_version, published_as, cycle_state}` and is omitted when there is nothing to report. | accurate | accurate |
| AUDIT-12 | cadence-core/workflows/audit.md | 41-42 | `counts.total` is Traceability rows plus unpicked ids, so `total = traced + broken + deferred`. | accurate | accurate |
| AUDIT-13 | cadence-core/workflows/audit.md | 50 | `planning.mjs criteria-coverage` exists. | accurate | accurate |
| AUDIT-14 | cadence-core/workflows/audit.md | 53 | `version` (`{plugin, uat_fields}`) is the first key of the coverage envelope. | accurate | accurate |
| AUDIT-15 | cadence-core/workflows/audit.md | 56-57 | `phases` entries are `{phase, criteria, items}`. | accurate | accurate |
| AUDIT-16 | cadence-core/workflows/audit.md | 58-59 | `breaks` entries are `{phase, id, break:"uncovered"}` or `{phase, break:"fieldless-checklist", file}`. | accurate | accurate |
| AUDIT-17 | cadence-core/workflows/audit.md | 59-60 | `untraced` is an item with no `criterion` and no exempting `origin`. | accurate | accurate |
| AUDIT-18 | cadence-core/workflows/audit.md | 60 | `legacy` entries are `{phase, reason}` with the exemption's reason stated. | accurate | accurate |
| AUDIT-19 | cadence-core/workflows/audit.md | 62 | Coverage `counts` satisfies `criteria = covered + uncovered`. | accurate | accurate |
| AUDIT-20 | cadence-core/workflows/audit.md | 63 | `references/acceptance-criteria.md` holds the grammar and field semantics. | accurate | accurate |
| AUDIT-21 | cadence-core/workflows/audit.md | 66-68 | `milestone.md` step 3 prunes completed phases from ROADMAP `## Phases`, so `parseRoadmapPhases` only holds the current cycle. | accurate | accurate |
| AUDIT-22 | cadence-core/workflows/audit.md | 68-70 | An unchecked phase contributes its `uncovered` count but no `uncovered` or `missing-uat` break. | accurate | accurate |
| AUDIT-23 | cadence-core/workflows/audit.md | 70-73 | `fieldless-checklist` is not box-gated; `uat init` writes `fields_version` before it looks at an item. | accurate | accurate |
| AUDIT-24 | cadence-core/workflows/audit.md | 101-103 | Repair form `uat record --phase <N> --item <k> --result <...> --criterion AC<N>`; `--origin criterion` names no id. | accurate | accurate |
| AUDIT-25 | cadence-core/workflows/audit.md | 107-108 | `version_drift` is issue #87's failure mode: a cycle planned/branched under an already-tagged number. | accurate | accurate |
| AUDIT-26 | cadence-core/workflows/audit.md | 164-166 | A phase whose checklist holds only passes, skipped-with-reason and `blocked` items no longer holds the cycle open. | accurate | accurate |
| AUDIT-27 | cadence-core/workflows/audit.md | 167-168 | The test is membership in the tag list, not sort order. | accurate | accurate |
| AUDIT-28 | cadence-core/workflows/audit.md | 170-176 | `pluginVersion()` resolves relative to the SCRIPT, so the manifest is deliberately not the comparand. | accurate | accurate |
| AUDIT-29 | cadence-core/workflows/audit.md | 173-174 | `skills/cad-health/SKILL.md` already settled that tags are the publication evidence. | accurate | accurate |
| AUDIT-30 | cadence-core/workflows/audit.md | 183-190 | `legacy` exempts only on all five terms, the fifth being a CONTEXT declaring no `AC<N>` ids. | accurate | accurate |
| AUDIT-31 | cadence-core/workflows/audit.md | 194-196 | An absent UAT.md under a present CONTEXT breaks every declared criterion as `missing-uat` on a checked box. | accurate | accurate |
| AUDIT-32 | cadence-core/workflows/audit.md | 196-197 | `context_issues` can carry `criterion-duplicate-id` / `criterion-unidded`. | accurate | accurate |
| AUDIT-33 | cadence-core/workflows/audit.md | 198-201 | First-occurrence-wins on a duplicate id, so a second bullet reusing one is dropped from the coverage domain. | accurate | accurate |
| CONFIG-01 | cadence-core/workflows/config.md | 97 | `parallelization.enabled` default is `false`. | stale | corrected - 044806c |
| CONFIG-02 | cadence-core/workflows/config.md | 126-128 | The `review.triggers.<t>.{gate,tier,effort}` defaults are "per DESIGN section 7". | stale | corrected - 044806c |
| CONFIG-03 | cadence-core/workflows/config.md | 3-5 | Canonical shape lives in `cadence-core/config.schema.json`, enforced by `bin/config.mjs`. | accurate | accurate |
| CONFIG-04 | cadence-core/workflows/config.md | 5 | `cadence-core/templates/config.json` is the scaffolded default. | accurate | accurate |
| CONFIG-05 | cadence-core/workflows/config.md | 29 | `model.overrides` carries six role pins. | accurate | accurate |
| CONFIG-06 | cadence-core/workflows/config.md | 31 | `model.effort` carries six per-role start rungs. | accurate | accurate |
| CONFIG-07 | cadence-core/workflows/config.md | 32 | `review.decision_review` has two keys. | accurate | accurate |
| CONFIG-08 | cadence-core/workflows/config.md | 27-33 | The four edit-the-file-only sets have no catalog row. | accurate | accurate |
| CONFIG-09 | cadence-core/workflows/config.md | 82 | `granularity` enum `fine\|standard\|coarse`, default `standard`, split sizes 8-12 / 5-8 / 3-5. | accurate | accurate |
| CONFIG-10 | cadence-core/workflows/config.md | 84 | `stakes` enum `solo\|shipped\|critical`, default `shipped`. | accurate | accurate |
| CONFIG-11 | cadence-core/workflows/config.md | 85 | `model.escalate_on_failure` bool, default `true`. | accurate | accurate |
| CONFIG-12 | cadence-core/workflows/config.md | 87 | `workflow.research` bool, default `false`. | accurate | accurate |
| CONFIG-13 | cadence-core/workflows/config.md | 88 | `workflow.plan_check` bool, default `true`. | accurate | accurate |
| CONFIG-14 | cadence-core/workflows/config.md | 89 | `workflow.verifier` bool, default `true`; the stakes level decides and `--deep` forces. | accurate | accurate |
| CONFIG-15 | cadence-core/workflows/config.md | 90 | `workflow.skip_discuss` bool, default `false`. | accurate | accurate |
| CONFIG-16 | cadence-core/workflows/config.md | 91 | `workflow.subagent_timeout` int, default `300000`. | accurate | accurate |
| CONFIG-17 | cadence-core/workflows/config.md | 92 | `workflow.inline_plan_threshold` int, default `3`. | accurate | accurate |
| CONFIG-18 | cadence-core/workflows/config.md | 93 | `workflow.max_plan_tasks` int, default `8`; above it the plan must return `## PHASE TOO BIG`. | accurate | accurate |
| CONFIG-19 | cadence-core/workflows/config.md | 94-95 | `workflow.test_command` / `workflow.lint_command` are `str\|null`, default `null`; there is no typecheck key. | accurate | accurate |
| CONFIG-20 | cadence-core/workflows/config.md | 98-100 | `parallelization.max_concurrent_agents` 3, `min_plans_for_parallel` 2, `use_worktrees` true. | accurate | accurate |
| CONFIG-21 | cadence-core/workflows/config.md | 102 | `git.protected_branches` default `main, master`. | accurate | accurate |
| CONFIG-22 | cadence-core/workflows/config.md | 103 | `git.on_protected` enum `ask\|refuse\|allow`, default `ask`. | accurate | accurate |
| CONFIG-23 | cadence-core/workflows/config.md | 104 | `git.integration_branch` enum `milestone\|trunk`, default `milestone`. | accurate | accurate |
| CONFIG-24 | cadence-core/workflows/config.md | 105 | `git.auto_branch` enum `ask\|auto\|off`, default `ask`. | accurate | accurate |
| CONFIG-25 | cadence-core/workflows/config.md | 106 | `git.base_branch` `str\|null`, default `null`. | accurate | accurate |
| CONFIG-26 | cadence-core/workflows/config.md | 107-109 | `git.create_tag` true, `git.on_land_cleanup` true, `git.auto_close` false. | accurate | accurate |
| CONFIG-27 | cadence-core/workflows/config.md | 111 | `planning.commit_docs` bool, default `true`. | accurate | accurate |
| CONFIG-28 | cadence-core/workflows/config.md | 113 | `memory.backend` enum `builtin\|none`, default `builtin`. | accurate | accurate |
| CONFIG-29 | cadence-core/workflows/config.md | 115 | `risk.override.<surface>` covers exactly the eight named surfaces, default `false`, repo-scoped with a global waiver named in `warnings`. | accurate | accurate |
| CONFIG-30 | cadence-core/workflows/config.md | 117 | `review.reviewers` list(enum) of `claude-subagent\|openai\|gemini\|deepseek`, default `claude-subagent`. | accurate | accurate |
| CONFIG-31 | cadence-core/workflows/config.md | 118 | `review.mode` enum `single\|panel\|adjudicated`, default `adjudicated`. | accurate | accurate |
| CONFIG-32 | cadence-core/workflows/config.md | 119 | `review.key_file` `str\|null`, default `null`. | accurate | accurate |
| CONFIG-33 | cadence-core/workflows/config.md | 120 | `review.request_timeout_ms` default `540000`, clamped to a 600000 host ceiling. | accurate | accurate |
| CONFIG-34 | cadence-core/workflows/config.md | 121 | `review.max_prompt_tokens` default `120000`; over-cap refused before any request, cross-model only. | accurate | accurate |
| CONFIG-35 | cadence-core/workflows/config.md | 122-125 | `review.consult.{enabled,tier,effort,attempt_threshold}` = false / flagship / high / 3. | accurate | accurate |
| CONFIG-36 | cadence-core/workflows/config.md | 130 | Trigger set is `{plan, diff, risk_surface, phase_diff, pre_ship}`. | accurate | accurate |
| CONFIG-37 | cadence-core/workflows/config.md | 141-145 | `config.mjs` subcommands are `validate \| check \| set \| get \| keys`. | accurate | accurate |
| CONFIG-38 | cadence-core/workflows/config.md | 154-157 | `--file <path>` overrides `.planning/config.json`; `--global` targets `~/.claude/cadence/config.json`, relocatable via `CADENCE_GLOBAL_CONFIG`, auto-created by `set`. | accurate | accurate |
| CONFIG-39 | cadence-core/workflows/config.md | 160-163 | `route.mjs` deep-merges global under repo (repo > global > defaults); nested objects merge, arrays replace wholesale. | accurate | accurate |
| CONFIG-40 | cadence-core/workflows/config.md | 168-169 | A `worktree.baseRef=...` pair is rejected by the seam as an unknown key. | accurate | accurate |
| CONFIG-41 | cadence-core/workflows/config.md | 174-178 | `set` rejects unknown key / bad value / non-object top level / a dotted path through a non-object, atomically, and echoes `{ok:true, changed:[...]}`. | accurate | accurate |
| CONFIG-42 | cadence-core/workflows/config.md | 180-182 | A key retired by a release carries a `detail` naming the replacement. | accurate | accurate |
| CONFIG-43 | cadence-core/workflows/config.md | 183-189 | A `(root)` detail means the target file's top level is not a JSON object; `cannot set through "..."` means a container holds an array or scalar. | accurate | accurate |
| CONFIG-44 | cadence-core/workflows/config.md | 194-202 | `worktree.baseRef` is absent from `config.schema.json`, never goes through `config.mjs`, `"fresh"` is its default and `"head"` is the parallel-safe value. | accurate | accurate |
| CONFIG-45 | cadence-core/workflows/config.md | 214-217 | `worktree-base.mjs resolve` reports `parallelSafe` and the file the value came from. | accurate | accurate |
| CONFIG-46 | cadence-core/workflows/config.md | 237-238 | `workflows/config-review.md` holds the detect/classify/assign/write flow. | accurate | accurate |
| CONFIG-REVIEW-01 | cadence-core/workflows/config-review.md | 8 | `review.providers.<name>.tiers.{flagship,balanced,cheap}` are the target keys. | accurate | accurate |
| CONFIG-REVIEW-02 | cadence-core/workflows/config-review.md | 9 | DESIGN section 6 carries the three-layer detection decision. | accurate | accurate |
| CONFIG-REVIEW-03 | cadence-core/workflows/config-review.md | 20 | Providers under `review.providers` are openai, gemini, deepseek. | accurate | accurate |
| CONFIG-REVIEW-04 | cadence-core/workflows/config-review.md | 26-28 | `review-provider.mjs detect-models --provider <name> [--key-file <path>]`. | accurate | accurate |
| CONFIG-REVIEW-05 | cadence-core/workflows/config-review.md | 35-37 | `ok:false, reason:"no-key"` with a `detail` naming `$OPENAI_API_KEY` / `$GEMINI_API_KEY` or the providers.env path. | accurate | accurate |
| CONFIG-REVIEW-06 | cadence-core/workflows/config-review.md | 40 | `ok:false, reason:"transport"\|"http"`. | accurate | accurate |
| CONFIG-REVIEW-07 | cadence-core/workflows/config-review.md | 44-46 | `models[]` entries are `{id, tier, high_effort}` with `tier` = `flagship\|balanced\|cheap` or `null` for unknown ids. | accurate | accurate |
| CONFIG-REVIEW-08 | cadence-core/workflows/config-review.md | 72-76 | `config.mjs set 'review.providers.<name>.tiers.<pos>=<id>'` is the write path. | accurate | accurate |
| CONFIG-REVIEW-09 | cadence-core/workflows/config-review.md | 80-82 | Adding a provider to `review.reviewers` via `set 'review.reviewers=["claude-subagent","openai"]'` is what enrolls it. | accurate | accurate |
| CONFIG-REVIEW-10 | cadence-core/workflows/config-review.md | 78-80 | `claude-subagent` is the always-available fallback when a tier is `null`. | accurate | accurate |
| CONTEXT-01 | cadence-core/workflows/context.md | 20-22 | `planning.mjs cursor get` returns `no-cursor` when STATE.md is absent. | accurate | accurate |
| CONTEXT-02 | cadence-core/workflows/context.md | 12 | Output path `.planning/phases/{N}/CONTEXT.md`. | accurate | accurate |
| CONTEXT-03 | cadence-core/workflows/context.md | 76 | `config.mjs get memory.backend workflow.subagent_timeout` reads both in one call. | accurate | accurate |
| CONTEXT-04 | cadence-core/workflows/context.md | 79 | `builtin` is the schema default for `memory.backend`. | accurate | accurate |
| CONTEXT-05 | cadence-core/workflows/context.md | 82, 92-94 | `planning.mjs recall "<terms>"` exists and returns `{ok, results:[{score, source, phase?, snippet}]}` with `phase` optional. | accurate | accurate |
| CONTEXT-06 | cadence-core/workflows/context.md | 107 | `trace append --phase --family lifecycle --event dispatch --plan --role --read "..."` - every flag exists. | accurate | accurate |
| CONTEXT-07 | cadence-core/workflows/context.md | 107 | `--family lifecycle` is a valid family. | accurate | accurate |
| CONTEXT-08 | cadence-core/workflows/context.md | 113 | The analyzer's contract lives at `skills/cad-assumptions-analyzer-contract`. | accurate | accurate |
| CONTEXT-09 | cadence-core/bin/lib/trace.mjs | 51-54 | Measured token figures: analyzer 186,577, planner 146,405, executor 154,523, plan-checker 47,717, verifier 78,034. | accurate | accurate |
| CONTEXT-10 | cadence-core/bin/lib/trace.mjs | 54-55 | A built-in agent type (`Explore`) returned no token figure at all. | accurate | accurate |
| CONTEXT-11 | cadence-core/bin/lib/trace.mjs | 56-59 | `unrecorded` can only be nonzero where a dispatch was counted, and sits beside a dispatch COUNT. | accurate | accurate |
| CONTEXT-12 | cadence-core/bin/lib/trace.mjs | 60-64 | A dispatch written and never closed is `unpaired`; a bracket never appended appears nowhere. | accurate | accurate |
| CONTEXT-13 | cadence-core/bin/lib/trace.mjs | 64-65 | The census in `trace.test.mjs` binds these lines per file. | accurate | accurate |
| CONTEXT-14 | cadence-core/workflows/context.md | 155 | The failure arm closes with `--event checkpoint`. | accurate | accurate |
| CONTEXT-15 | cadence-core/workflows/context.md | 351 | `cursor set --phase {N} --status "context gathered" --next "/cad-plan {N}"`. | accurate | accurate |
| CONTEXT-16 | cadence-core/workflows/context.md | 254-256 | `/cad-audit` FAILs on a criterion that reached no UAT item. | accurate | accurate |
| CONTEXT-17 | cadence-core/workflows/context.md | 396-397 | No review trigger fires here per `references/review-triggers.md`'s wiring table. | accurate | accurate |
| COVERAGE-01 | cadence-core/workflows/coverage.md | 12-13 | `planning.mjs status` reports per-phase status. | accurate | accurate |
| COVERAGE-02 | cadence-core/workflows/coverage.md | 13-19 | Statuses include `complete` and `executed` (and `unplanned` / `planned`). | accurate | accurate |
| COVERAGE-03 | cadence-core/workflows/coverage.md | 14-15 | `ok:false` reasons include `no-planning-dir` and `no-roadmap`, each carrying a `hint`. | accurate | accurate |
| COVERAGE-04 | cadence-core/workflows/coverage.md | 15-19 | An `ok:true` carrying `cycle: "none"` with an empty `phases[]` is a derived closed milestone. | accurate | accurate |
| COVERAGE-05 | cadence-core/workflows/coverage.md | 30-31 | A plan's `requirements` frontmatter is a real field. | accurate | accurate |
| COVERAGE-06 | cadence-core/workflows/coverage.md | 35, 63 | `workflow.test_command` is the runner config key. | accurate | accurate |
| COVERAGE-07 | cadence-core/workflows/coverage.md | 73 | `references/git-guard.md` holds the protected-branch guard. | accurate | accurate |
| COVERAGE-08 | cadence-core/workflows/coverage.md | 72 | Commit form `test(phase-<N>): cover <requirements>`. | accurate | accurate |
| DEBUG-01 | cadence-core/workflows/debug.md | 7 | State file lives at `.planning/debug/<slug>.md`. | accurate | accurate |
| DEBUG-02 | cadence-core/workflows/debug.md | 59 | `config.mjs get memory.backend review.consult.attempt_threshold` reads both in one call. | accurate | accurate |
| DEBUG-03 | cadence-core/workflows/debug.md | 70-72 | `references/bug-patterns.md` exists and is frequency-ordered. | accurate | accurate |
| DEBUG-04 | cadence-core/workflows/debug.md | 83, 89-92 | `planning.mjs recall` exists; its JSON is `{ok, results:[{score, source, phase?, snippet}]}`. | accurate | accurate |
| DEBUG-05 | cadence-core/workflows/debug.md | 85-87 | A `none` backend makes recall's own backend-off return a backstop, not this workflow's gate. | accurate | accurate |
| DEBUG-06 | cadence-core/workflows/debug.md | 110-117 | The `risk_surface` trigger is `blocking` and its re-arm is capped at ONE narrowed round in `references/triage-gate.md`. | accurate | accurate |
| DEBUG-07 | cadence-core/workflows/debug.md | 111-114 | The fix's artifact is shape (b), the staged-diff scope, and the reviewer runs `git diff --cached` in the inherited cwd. | accurate | accurate |
| DEBUG-08 | cadence-core/workflows/debug.md | 126-127 | `review.consult.attempt_threshold` default is 3. | accurate | accurate |
| DEBUG-09 | cadence-core/workflows/debug.md | 123, 137 | `references/consult.md` defines `offer_consult`. | accurate | accurate |
| DEBUG-10 | cadence-core/workflows/debug.md | 110 | `cad-debug` is one of the skills that fires `risk_surface`. | accurate | accurate |
| DECISION-REVIEW-01 | cadence-core/workflows/decision-review.md | 120-121, 162-163 | D-09: the runtime exposes no per-turn token/dollar figures, so cost reporting stays qualitative. | unverifiable | divergence - needs runtime introspection of the hosts per-turn accounting; phase 4s CONTEXT already adjudicated this against that phases subagent-return figures and ruled them a different claim |
| DECISION-REVIEW-02 | cadence-core/workflows/decision-review.md | 54-55 | The cross-model arm rests on the Phase-1 REV-01 seam repair - a symlinked install must run this seam for real, not no-op. | unverifiable | divergence - a claim about a past repairs effect under a symlinked install; needs an installed-plugin runtime to test |
| DECISION-REVIEW-03 | cadence-core/workflows/decision-review.md | 2-5, 24-26 | The target is a `- D-NN (...)` line under `## Durable decisions` / `## Decisions`, or a PROJECT.md `## Key Decisions` row. | accurate | accurate |
| DECISION-REVIEW-04 | cadence-core/workflows/decision-review.md | 11-12, 152-154 | This workflow has no entry in `references/review-triggers.md`'s wiring table. | accurate | accurate |
| DECISION-REVIEW-05 | cadence-core/workflows/decision-review.md | 43-44 | The reviewer set resolves from `review.reviewers[]` exactly as review-triggers.md step 3 does. | accurate | accurate |
| DECISION-REVIEW-06 | cadence-core/workflows/decision-review.md | 47-50 | No routing cell resolves a model for the `claude-subagent` arm; it is base `cad-reviewer` at the session default. | accurate | accurate |
| DECISION-REVIEW-07 | cadence-core/workflows/decision-review.md | 58-62 | `review-provider.mjs review --provider <name> --model <id> --effort <level> [--key-file <path>]` with `{instruction, artifact}` on stdin. | accurate | accurate |
| DECISION-REVIEW-08 | cadence-core/workflows/decision-review.md | 62-64 | `ok:false` drops that reviewer, same degradation rule as review-triggers.md step 4. | accurate | accurate |
| DECISION-REVIEW-09 | cadence-core/workflows/decision-review.md | 49-50, 180-182 | `review.decision_review.{tier,effort}` reach the cross-model arm only. | accurate | accurate |
| DECISION-REVIEW-10 | cadence-core/workflows/decision-review.md | 86-88 | Context7 is on this skill's main-model surface; the read-only `cad-reviewer` subagent has no MCP tools. | accurate | accurate |
| DECISION-REVIEW-11 | cadence-core/workflows/decision-review.md | 157-161 | `review-provider.mjs`'s `FINDING_SCHEMA` and self-verify's `CONTRACTS` table are unchanged, and refute still returns `{findings:[...]}`. | accurate | accurate |
| DOCS-VERIFY-01 | cadence-core/workflows/docs-verify.md | 4 | The writer is cut, per DESIGN section 2. | accurate | accurate |
| DOCS-VERIFY-02 | cadence-core/workflows/docs-verify.md | 10-11 | The default target set is `README.md` plus `docs/**`. | accurate | accurate |
| DOCS-VERIFY-03 | cadence-core/workflows/docs-verify.md | 46 | The report table columns are `claim \| location \| verdict \| correct value (if stale)`. | accurate | accurate |
| DOCS-VERIFY-04 | cadence-core/workflows/docs-verify.md | 40-44 | Verdicts are exactly `accurate \| stale \| unverifiable`. | accurate | accurate |
| EXECUTE-01 | cadence-core/workflows/execute.md | 174-176 | `cad-executor.md` already carries the executor's standing rules (atomic commit per task, deviation recording, checkpoints, never writing STATE/ROADMAP/SUMMARY, the report format) as its stable, cached definition. | stale | corrected - 044806c |
| EXECUTE-02 | cadence-core/workflows/execute.md | 360-361 | The `phase_diff` trigger is "Off by default (opt-in)". | stale | corrected - 044806c + DFC-02 closed 98be3d2 |
| EXECUTE-03 | cadence-core/workflows/execute.md | 365-366 | `phase_diff` is "`adjudicated` wherever it is on at all (critical only)". | stale | corrected - 044806c + DFC-02 closed 98be3d2 |
| EXECUTE-04 | cadence-core/workflows/execute.md | 11-17 | `planning.mjs status` returns `current`, `ok:false` with `reason`/`hint`, and `cycle:"none"` with an empty `phases[]` on a closed milestone. | accurate | accurate |
| EXECUTE-05 | cadence-core/workflows/execute.md | 17-18 | Plan files are `PLAN.md`, or `PLAN-1.md`, `PLAN-2.md`, ... in numeric order. | accurate | accurate |
| EXECUTE-06 | cadence-core/workflows/execute.md | 28-32 | The nine config keys in the single `config.mjs get` all exist (`workflow.test_command` left the batch in v2.6.2 and is read at its only consumer, `execute_parallel` step 5). | accurate | accurate |
| EXECUTE-07 | cadence-core/workflows/execute.md | 34-39 | `fire(trigger)` takes gates from the routing bundle, and a `config.mjs get` of a gate returns the schema default when no layer set it. | accurate | accurate |
| EXECUTE-08 | cadence-core/workflows/execute.md | 43-44 | `references/git-guard.md` holds the protected-branch guard. | accurate | accurate |
| EXECUTE-09 | cadence-core/workflows/execute.md | 61-66 | `git diff --cached --quiet` / `--name-status` and `git stash push --staged` (git 2.35+). | accurate | accurate |
| EXECUTE-10 | cadence-core/bin/planning.mjs | 1626-1635 | `lease-check` reads the whole staged index and has no provenance signal; its refusal code is `undeclared-files`. | accurate | accurate |
| EXECUTE-11 | cadence-core/workflows/execute.md | 93-97 | `trace append --phase <N> --family lifecycle --event phase_start --sha <PHASE_START>` anchors the correlation id. | accurate | accurate |
| EXECUTE-12 | cadence-core/workflows/execute.md | 98-100 | An append returning `written:false` (size cap, unwritable root) changes nothing on the execute path. | accurate | accurate |
| EXECUTE-13 | cadence-core/workflows/execute.md | 112-121 | `planning.mjs plan-overlap --phase <N>` returns `overlaps`, `undeclared` and `frontmatter_issues`. | accurate | accurate |
| EXECUTE-14 | cadence-core/workflows/execute.md | 129-136 | `worktree-base.mjs resolve` reports `parallelSafe`, with `baseRef:"fresh"` the default. | accurate | accurate |
| EXECUTE-15 | cadence-core/workflows/execute.md | 179-181 | An executor writes its task table to `<plandir>/reports/plan-<k>.md` and returns a five-field digest. | accurate | accurate |
| EXECUTE-16 | cadence-core/workflows/execute.md | 188-189 | `git worktree list --porcelain` gives the worktree root for branch `cadence/phase-<N>-plan-<k>`. | accurate | accurate |
| EXECUTE-17 | cadence-core/workflows/execute.md | 197-199 | The three `trace append` bracket lines and every flag on them exist. | accurate | accurate |
| EXECUTE-18 | cadence-core/workflows/execute.md | 202-206 | The closing event is `return`, `checkpoint` or `escalation`; a worker with none is what `trace render` reports as unpaired. | accurate | accurate |
| EXECUTE-19 | cadence-core/workflows/execute.md | 209-214 | `--role` is a separate key from `--plan`; `--plan` pairs the bracket, `--role` groups the per-role totals. | accurate | accurate |
| EXECUTE-20 | cadence-core/workflows/execute.md | 216-219 | `--tokens 0` would claim a dispatch that cost nothing, so the flag is omitted when no figure is returned. | accurate | accurate |
| EXECUTE-21 | cadence-core/workflows/execute.md | 222-224 | The `phase_start` line takes no `--role`, `--tokens` or `--read`. | accurate | accurate |
| EXECUTE-22 | cadence-core/bin/planning.mjs | 2094-2102 | `.planning/trace.jsonl` is gitignored; `/cad-new-project` writes the line via `planning.mjs trace ignore` and `/cad-health` only reports a pre-seam scaffold. | accurate | accurate |
| EXECUTE-23 | cadence-core/workflows/execute.md | 248-251 | The `diff` trigger's artifact is shape (a) refs `{base_ref, head_ref}` and its default at `shipped` is advisory. | accurate | accurate |
| EXECUTE-24 | cadence-core/workflows/execute.md | 263-269, 290-291 | `references/triage-gate.md` makes NONE the default and caps the blocking re-arm at ONE round. | accurate | accurate |
| EXECUTE-25 | cadence-core/workflows/execute.md | 282-285 | The `risk_surface` checkpoint artifact is shape (c), a flagged-diff FILE path. | accurate | accurate |
| EXECUTE-26 | cadence-core/workflows/execute.md | 395-397 | `SUMMARY.md` is written from `cadence-core/templates/SUMMARY.md`. | accurate | accurate |
| EXECUTE-27 | cadence-core/workflows/execute.md | 410-415 | `planning.mjs debt-harvest --root .` rewrites `.planning/CAPTURE.md`'s own `## Debt markers` section only. | accurate | accurate |
| EXECUTE-28 | cadence-core/workflows/execute.md | 422 | `cursor set --phase <N> --status executed --next "/cad-verify <N>"`. | accurate | accurate |
| EXECUTE-29 | cadence-core/workflows/execute.md | 428-430 | `plan-<k>-risk-task-<n>.diff` is the transient flagged diff and must never be staged. | accurate | accurate |
| EXECUTE-30 | cadence-core/workflows/execute.md | 452-453, 468 | STATE.md is exactly the 4-line cursor, overwritten, and this workflow is its only writer. | accurate | accurate |
| MILESTONE-01 | cadence-core/workflows/milestone.md | 7-8 | One `config.mjs get git.create_tag git.auto_close` reads both keys. | accurate | accurate |
| MILESTONE-02 | cadence-core/workflows/milestone.md | 13-16 | `/cad-audit` is the requirement/phase/plan/verified FAIL gate invoked here. | accurate | accurate |
| MILESTONE-03 | cadence-core/workflows/milestone.md | 33-36 | `release-bump.mjs bump --dir <root> --version <version>`, with `--version` REQUIRED. | accurate | accurate |
| MILESTONE-04 | cadence-core/workflows/milestone.md | 39-40 | The seam auto-detects `.claude-plugin/plugin.json` and returns `action:"skip"` when absent. | accurate | accurate |
| MILESTONE-05 | cadence-core/workflows/milestone.md | 40-44 | It bumps the manifest `version` and any versioned sibling, scaffolds the dated `## [<version>]` heading + link reference, and promotes `## [Unreleased]`. | accurate | accurate |
| MILESTONE-06 | cadence-core/workflows/milestone.md | 49-54 | `ok:false` reasons are `no-target-version`, `unparseable-version`, `unreadable-manifest`, `downgrade`, `not-an-upgrade`, with nothing written and exit 1. | accurate | accurate |
| MILESTONE-07 | cadence-core/workflows/milestone.md | 55-57 | A `siblings[]` entry with `action:"refuse"` leaves top-level `ok` true. | accurate | accurate |
| MILESTONE-08 | cadence-core/workflows/milestone.md | 58-60 | `changelog.section_empty: true` means the dated heading has no body. | accurate | accurate |
| MILESTONE-09 | cadence-core/workflows/milestone.md | 67-68 | An annotated tag at HEAD (`git tag -a <version> -m ...`), unpushed. | accurate | accurate |
| MILESTONE-10 | cadence-core/workflows/milestone.md | 71-76 | A surviving `### Phase N:` detail section is the signature of an interrupted close. | accurate | accurate |
| MILESTONE-11 | cadence-core/workflows/milestone.md | 95-104 | Requirement rows must stay as rows so `/cad-audit` can trace shipped scope; `## Active` bullets take the `- **<ID>**: <one line>` form. | accurate | accurate |
| MILESTONE-12 | cadence-core/workflows/milestone.md | 111-113 | `cursor set --phase 1 --status "ready to plan" --next "/cad-phase add"`. | accurate | accurate |
| MILESTONE-13 | cadence-core/workflows/milestone.md | 115-124 | On a fully pruned roadmap the seam derives `of 0 (no active cycle)`; passing `--name`/`--total` is needed when work was deferred, else it returns `cannot-derive`. | accurate | accurate |
| MILESTONE-14 | cadence-core/workflows/milestone.md | 117-119 | `/cad-phase add` is the only workflow that appends a phase line to an existing roadmap. | accurate | accurate |
| MILESTONE-15 | cadence-core/workflows/milestone.md | 128-131 | `git.auto_close` false is the default, so the tag stays unpushed and publishing is a separate `/cad-land`. | accurate | accurate |
| MILESTONE-16 | cadence-core/workflows/milestone.md | 138-142 | The chain reaps via `land-cleanup.mjs`'s `cadence/*`-merged fallback (`resolveReapBranch`). | accurate | accurate |
| NEW-PROJECT-01 | cadence-core/workflows/new-project.md | 51 | The written defaults are "interactive, research off, plan check and verifier on". | stale | corrected - 044806c |
| NEW-PROJECT-02 | cadence-core/workflows/new-project.md | 95 | Structured-question headers are capped at 12 characters. | unverifiable | divergence - a host `AskUserQuestion` constraint, stated nowhere in this repo except that file and its own `:209` |
| NEW-PROJECT-03 | cadence-core/workflows/new-project.md | 29 | Skipping init when `git rev-parse --git-dir` fails identifies a non-repo. | accurate | accurate |
| NEW-PROJECT-04 | cadence-core/workflows/new-project.md | 33 | `planning.mjs trace ignore --root .` exists as a seam call. | accurate | accurate |
| NEW-PROJECT-05 | cadence-core/workflows/new-project.md | 38 | A re-run returns `written:false` with `reason:"already-ignored"`. | accurate | accurate |
| NEW-PROJECT-06 | cadence-core/workflows/new-project.md | 39 | A project ignoring `.planning/` wholesale is detected and left alone. | accurate | accurate |
| NEW-PROJECT-07 | cadence-core/workflows/new-project.md | 47 | `cadence-core/templates/config.json` is the engine template. | accurate | accurate |
| NEW-PROJECT-08 | cadence-core/workflows/new-project.md | 51 | Defaults are research off, plan check on, verifier on. | accurate | accurate |
| NEW-PROJECT-09 | cadence-core/workflows/new-project.md | 57-60 | The seven keys read via `config.mjs get` all resolve. | accurate | accurate |
| NEW-PROJECT-10 | cadence-core/workflows/new-project.md | 134 | `cadence-core/templates/PROJECT.md` exists. | accurate | accurate |
| NEW-PROJECT-11 | cadence-core/workflows/new-project.md | 146 | The protected-branch guard lives in `references/git-guard.md`. | accurate | accurate |
| NEW-PROJECT-12 | cadence-core/workflows/new-project.md | 161 | Dispatch via the spawn-agent seam with timeout `workflow.subagent_timeout`. | accurate | accurate |
| NEW-PROJECT-13 | cadence-core/workflows/new-project.md | 179-181 | The research agent is the only Cadence dispatch path with no `maxTurns` bound, and `maxTurns` is per-FILE frontmatter. | accurate | accurate |
| NEW-PROJECT-14 | cadence-core/workflows/new-project.md | 182-184 | A 20th rung file would cost a `route-table.json` rung row plus both directions of self-verify's rung checks. | accurate | accurate |
| NEW-PROJECT-15 | cadence-core/workflows/new-project.md | 213 | Category questions batch up to 4 per AskUserQuestion call. | accurate | accurate |
| NEW-PROJECT-16 | cadence-core/workflows/new-project.md | 237 | `cadence-core/templates/REQUIREMENTS.md` exists. | accurate | accurate |
| NEW-PROJECT-17 | cadence-core/workflows/new-project.md | 240,269 | Traceability rows are seeded per phase by `/cad-plan`. | accurate | accurate |
| NEW-PROJECT-18 | cadence-core/workflows/new-project.md | 256-257 | `granularity`: coarse 3-5, standard 5-8, fine 8-12. | accurate | accurate |
| NEW-PROJECT-19 | cadence-core/workflows/new-project.md | 266 | `cadence-core/templates/ROADMAP.md` exists. | accurate | accurate |
| NEW-PROJECT-20 | cadence-core/workflows/new-project.md | 293-294 | `cursor set --phase 1 --status "ready to plan" --next "/cad-context 1"` is a valid call. | accurate | accurate |
| NEW-PROJECT-21 | cadence-core/workflows/new-project.md | 297-301 | A phase directory is `.planning/phases/<N>/` with no zero-padding and no slug suffix. | accurate | accurate |
| NEW-PROJECT-22 | cadence-core/workflows/new-project.md | 358 | STATE.md is a 4-line cursor. | accurate | accurate |
| PHASE-01 | cadence-core/workflows/phase.md | 4-6 | A phase number appears in four places: ROADMAP list, `.planning/phases/<N>/`, the REQUIREMENTS Phase column, the STATE cursor. | accurate | accurate |
| PHASE-02 | cadence-core/workflows/phase.md | 7 | The renumber mechanics live in the planning seam's `renumber` subcommand. | accurate | accurate |
| PHASE-03 | cadence-core/workflows/phase.md | 18-20 | `cursor set` requires `--phase` and does not preserve the prior one, so `cursor get` first is not optional. | accurate | accurate |
| PHASE-04 | cadence-core/workflows/phase.md | 30 | `renumber insert --at <N> --dry-run` is the dry-run form. | accurate | accurate |
| PHASE-05 | cadence-core/workflows/phase.md | 32 | The dry-run returns `ops`, `in_text_refs` and `warn`. | accurate | accurate |
| PHASE-06 | cadence-core/workflows/phase.md | 36-38 | Insert moves dirs high-to-low via `git mv`, shifts `Phase K`/`phases/K/` at or above N, re-points the cursor. | accurate | accurate |
| PHASE-07 | cadence-core/workflows/phase.md | 39 | The insert output carries `slot` for the empty numbered slot. | accurate | accurate |
| PHASE-08 | cadence-core/workflows/phase.md | 51-53 | `renumber remove --n <N> --dry-run` returns `orphaned_reqs`. | accurate | accurate |
| PHASE-09 | cadence-core/workflows/phase.md | 54-57 | Remove drops the list line and detail section, `git rm`s the dir, renumbers low-to-high, re-points the cursor. | accurate | accurate |
| PHASE-10 | cadence-core/workflows/phase.md | 56-57 | Orphaned rows' Phase cells are blanked and surface as `no-phase` in /cad-audit. | accurate | accurate |
| PHASE-11 | cadence-core/workflows/phase.md | 62-64 | A failed apply returns `ok:false` with a `completed` list; the seam is not transactional. | accurate | accurate |
| PHASE-12 | cadence-core/workflows/phase.md | 65 | `planning.mjs status` is the sanity spot-check. | accurate | accurate |
| PHASE-13 | cadence-core/workflows/phase.md | 67 | The protected-branch guard is in `references/git-guard.md`. | accurate | accurate |
| PLAN-GAPS-01 | cadence-core/workflows/plan-gaps.md | 10 | `planning.mjs uat status --phase <N>` reads the outstanding items. | accurate | accurate |
| PLAN-GAPS-02 | cadence-core/workflows/plan-gaps.md | 13 | A missing checklist returns `no-uat`. | accurate | accurate |
| PLAN-GAPS-03 | cadence-core/workflows/plan-gaps.md | 15 | `.planning/phases/<N>/UAT.md` holds the item detail. | accurate | accurate |
| PLAN-GAPS-04 | cadence-core/workflows/plan-gaps.md | 19 | plan.md has a `spawn_planner` step to rejoin. | accurate | accurate |
| PLAN-01 | cadence-core/workflows/plan.md | 102 | `(D-03)` names the decision that recall's backend-off return is a backstop, not this workflow's gate. | unverifiable | divergence - a bare decision id naming no phase or file; the CONTEXT that held it is in neither the live `.planning/` tree nor any `_archive-*` milestone, so it cannot be resolved mechanically |
| PLAN-02 | cadence-core/workflows/plan.md | 118 | `(D-01 / cache discipline)` names the decision that recall snippets ride the dispatch prompt. | unverifiable | divergence - same for the `D-01` half; the `cache discipline` half resolves at `references/seams.md:191` |
| PLAN-03 | cadence-core/workflows/plan.md | 8 | 4 flags, not ~20. | accurate | accurate |
| PLAN-04 | cadence-core/workflows/plan.md | 19-21 | `planning.mjs status` returns `current` and a `phases[]` showing which phases still need plans. | accurate | accurate |
| PLAN-05 | cadence-core/workflows/plan.md | 22-24 | `ok:true` with `cycle: "none"` and an empty `phases[]` is a derived closed milestone. | accurate | accurate |
| PLAN-06 | cadence-core/workflows/plan.md | 30 | `--gaps` loads `cadence-core/workflows/plan-gaps.md`. | accurate | accurate |
| PLAN-07 | cadence-core/workflows/plan.md | 36-40 | The eight-key `config.mjs get` batch is valid. | accurate | accurate |
| PLAN-08 | cadence-core/workflows/plan.md | 43-45 | `fire(trigger)` takes gates from the routing bundle (`route.mjs resolve`). | accurate | accurate |
| PLAN-09 | cadence-core/workflows/plan.md | 46-47 | `config.mjs get` returns the schema DEFAULT for a gate no layer set. | accurate | accurate |
| PLAN-10 | cadence-core/workflows/plan.md | 50-51 | `memory.backend` gates recall in spawn_planner and inline_plan. | accurate | accurate |
| PLAN-11 | cadence-core/workflows/plan.md | 74 | `workflow.inline_plan_threshold` is the inline routing threshold. | accurate | accurate |
| PLAN-12 | cadence-core/workflows/plan.md | 88 | `trace append --phase --family lifecycle --event dispatch --plan --role --read` is a valid call. | accurate | accurate |
| PLAN-13 | cadence-core/workflows/plan.md | 110 | `planning.mjs recall "<terms>"` is the recall call. | accurate | accurate |
| PLAN-14 | cadence-core/workflows/plan.md | 113 | Recall returns `{ok, results:[{score, source, phase?, snippet}]}`. | accurate | accurate |
| PLAN-15 | cadence-core/workflows/plan.md | 119,155 | seams.md states a cache discipline for dispatch prompts. | accurate | accurate |
| PLAN-16 | cadence-core/workflows/plan.md | 132 | `workflow.max_plan_tasks` is the ceiling and the planner returns `## PHASE TOO BIG` above it. | accurate | accurate |
| PLAN-17 | cadence-core/workflows/plan.md | 143 | `cadence-core/templates/PLAN.md` exists. | accurate | accurate |
| PLAN-18 | cadence-core/workflows/plan.md | 189 | `trace append ... --event return ... --tokens <n>` is valid, and `--tokens` may be omitted. | accurate | accurate |
| PLAN-19 | cadence-core/workflows/plan.md | 197 | `trace append ... --event checkpoint ... --detail` is valid. | accurate | accurate |
| PLAN-20 | cadence-core/workflows/plan.md | 200 | `## PLANNING COMPLETE` is a planner return marker. | accurate | accurate |
| PLAN-21 | cadence-core/workflows/plan.md | 204-208 | `plan-overlap` means plans sharing a file cannot run concurrently. | accurate | accurate |
| PLAN-22 | cadence-core/workflows/plan.md | 209 | `offer_consult` is defined in `references/consult.md`. | accurate | accurate |
| PLAN-23 | cadence-core/workflows/plan.md | 231 | The Task ceiling feeds the checker's dimension 6. | accurate | accurate |
| PLAN-24 | cadence-core/workflows/plan.md | 239-240 | The checker returns `## VERIFICATION PASSED` or `## ISSUES FOUND` with BLOCKER/WARNING findings. | accurate | accurate |
| PLAN-25 | cadence-core/workflows/plan.md | 262-263 | WARNING means quality is degraded but execution can proceed. | accurate | accurate |
| PLAN-26 | cadence-core/workflows/plan.md | 271-273,311 | `--attempt 2` makes the routing seam climb to the retry rung the cell names. | accurate | accurate |
| PLAN-27 | cadence-core/workflows/plan.md | 342-343 | The `plan` gate defaults to adjudicated. | accurate | accurate |
| PLAN-28 | cadence-core/workflows/plan.md | 349 | `cadence-core/references/triage-gate.md` exists. | accurate | accurate |
| PLAN-29 | cadence-core/workflows/plan.md | 360 | `planning.mjs seed-reqs --phase {N}` exists. | accurate | accurate |
| PLAN-30 | cadence-core/workflows/plan.md | 364-367 | seed-reqs inserts `\| <id> \| Phase {N} \| Pending \|` for `## Active`-bounded declared ids, idempotently. | accurate | accurate |
| PLAN-31 | cadence-core/workflows/plan.md | 367-372 | It reports `orphan_ids`, `no_active_section: true`, and always Pending status. | accurate | accurate |
| PLAN-32 | cadence-core/workflows/plan.md | 379 | `cursor set --phase {N} --status planned --next "/cad-execute {N}"` is valid. | accurate | accurate |
| PLAN-33 | cadence-core/workflows/plan.md | 383 | `references/git-guard.md` rail 1 is the protected-branch guard. | accurate | accurate |
| PROGRESS-01 | cadence-core/workflows/progress.md | 172-173 | The trace file is written by the seams and by the execute and verify workflows. | stale | corrected - 044806c |
| PROGRESS-02 | cadence-core/workflows/progress.md | 18 | `planning.mjs status` is the derivation. | accurate | accurate |
| PROGRESS-03 | cadence-core/workflows/progress.md | 23-25 | Derived statuses are unplanned -> planned -> executed -> complete, with UAT counts. | accurate | accurate |
| PROGRESS-04 | cadence-core/workflows/progress.md | 26 | `current` is the lowest non-complete phase, null when all complete. | accurate | accurate |
| PROGRESS-05 | cadence-core/workflows/progress.md | 28-30 | `cycle` is present and `"none"` only for a derived closed milestone. | accurate | accurate |
| PROGRESS-06 | cadence-core/workflows/progress.md | 31 | `references/roadmap-phases.md` holds the grammar. | accurate | accurate |
| PROGRESS-07 | cadence-core/workflows/progress.md | 32-34 | `cursor` carries `agrees`, already computed. | accurate | accurate |
| PROGRESS-08 | cadence-core/workflows/progress.md | 36-37 | `drift[]` kinds are `cursor`, `roadmap-box`, `req-status`, `phase-dir`, `phase-dir-grammar`. | accurate | accurate |
| PROGRESS-09 | cadence-core/workflows/progress.md | 39-40 | `ok:false` with `no-planning-dir` is the no-project reason. | accurate | accurate |
| PROGRESS-10 | cadence-core/workflows/progress.md | 56-59 | Cursor drift is repaired through `cursor set`. | accurate | accurate |
| PROGRESS-11 | cadence-core/workflows/progress.md | 61-64 | Status mapping unplanned/planned/executed/all-complete are legal cursor statuses. | accurate | accurate |
| PROGRESS-12 | cadence-core/workflows/progress.md | 65-68 | A closed-milestone cursor set with no `--name`/`--total` derives "no active cycle" and 0. | accurate | accurate |
| PROGRESS-13 | cadence-core/workflows/progress.md | 92 | `trace render --phase <current>`. | accurate | accurate |
| PROGRESS-14 | cadence-core/workflows/progress.md | 95 | Four family counts `routing`, `provider`, `lifecycle`, `outcome` under one `corr`. | accurate | accurate |
| PROGRESS-15 | cadence-core/workflows/progress.md | 96-102 | The `roles` block carries a token total, a dispatch count, and `unrecorded` when present; an absent total prints `unrecorded`, never 0. | accurate | accurate |
| PROGRESS-16 | cadence-core/workflows/progress.md | 104 | A render carrying no `roles` key prints nothing for it. | accurate | accurate |
| PROGRESS-17 | cadence-core/workflows/progress.md | 105-107 | `unpaired` names a worker with no return, checkpoint or escalation. | accurate | accurate |
| PROGRESS-18 | cadence-core/workflows/progress.md | 107-109 | `capped` true means the record hit its size bound. | accurate | accurate |
| PROGRESS-19 | cadence-core/workflows/progress.md | 109-110 | An absent trace file returns `ok:true` with empty counts. | accurate | accurate |
| PROGRESS-20 | cadence-core/workflows/progress.md | 138 | `workflow.skip_discuss` selects /cad-plan over /cad-context. | accurate | accurate |
| SPIKE-01 | cadence-core/workflows/spike.md | 20-21,45 | The spike record lives at `.planning/spikes/<slug>/SPIKE.md`. | accurate | accurate |
| SPIKE-02 | cadence-core/workflows/spike.md | 51 | The SPIKE.md commit honors the protected-branch guard. | accurate | accurate |
| TASK-01 | cadence-core/workflows/task.md | 75-77 | The `risk_surface` fire's artifact is refs, shape (a) `{base_ref: parent of the task's first commit, head_ref: HEAD}`. | stale | corrected - 044806c + DFC-04 closed 98be3d2 |
| TASK-02 | cadence-core/workflows/task.md | 2-4 | Rail 1 is the protected-branch check plus base-integrity plus the integration-branch decision, not a bare branch check. | accurate | accurate |
| TASK-03 | cadence-core/workflows/task.md | 23 | `cadence-core/references/git-guard.md` exists. | accurate | accurate |
| TASK-04 | cadence-core/workflows/task.md | 46 | `workflow.test_command` is a config key. | accurate | accurate |
| TASK-05 | cadence-core/workflows/task.md | 48 | Rail 2 is atomic conventional commits of specific files. | accurate | accurate |
| TASK-06 | cadence-core/workflows/task.md | 57 | Planned tasks write `.planning/tasks/{slug}/PLAN.md`. | accurate | accurate |
| TASK-07 | cadence-core/workflows/task.md | 63-64 | cad-executor is dispatched via the spawn-agent seam. | accurate | accurate |
| TASK-08 | cadence-core/workflows/task.md | 66-68 | The executor's report is `.planning/tasks/{slug}/reports/plan-1.md` and it returns a digest, not a table. | accurate | accurate |
| TASK-09 | cadence-core/workflows/task.md | 69 | `planning.commit_docs` gates the plan-file commit. | accurate | accurate |
| TASK-10 | cadence-core/workflows/task.md | 80 | `risk_surface` is blocking at every level. | accurate | accurate |
| TASK-11 | cadence-core/workflows/task.md | 80-83 | Its re-arm is capped at ONE narrowed round, and that cap lives only in `triage-gate.md`. | accurate | accurate |
| UNDO-01 | cadence-core/workflows/undo.md | 4-5 | SUMMARY.md is the manifest - cad-execute writes commits-per-task with hashes there. | accurate | accurate |
| UNDO-02 | cadence-core/workflows/undo.md | 10 | The phase's docs commit is `docs(<N>): ...`. | accurate | accurate |
| UNDO-03 | cadence-core/workflows/undo.md | 20-21 | The dirty guard offers a stash through the ask-user seam. | accurate | accurate |
| UNDO-04 | cadence-core/workflows/undo.md | 28-33 | Only the protected-branch check of `git-guard.md` rail 1 applies to a committing revert. | accurate | accurate |
| UNDO-05 | cadence-core/workflows/undo.md | 35-42 | `git revert --no-edit`, `git revert --no-commit`, `git revert --abort`. | accurate | accurate |
| UNDO-06 | cadence-core/workflows/undo.md | 48 | `planning.mjs phase-done --n <N> --undo`. | accurate | accurate |
| UNDO-07 | cadence-core/workflows/undo.md | 49 | `cursor set --phase <N> --status <planned \| "ready to plan"> --next ...`. | accurate | accurate |
| UNDO-08 | cadence-core/workflows/undo.md | 54-55 | `--undo` unchecks the ROADMAP box and flips traceability rows back to Pending. | accurate | accurate |
| VERIFY-DEEP-01 | cadence-core/workflows/verify-deep.md | 13 | The dispatch bracket call with `--plan cad-verifier --role cad-verifier --read "..."` is valid. | accurate | accurate |
| VERIFY-DEEP-02 | cadence-core/workflows/verify-deep.md | 8-11 | `--plan` is the pairing key and `--role` the per-role grouping key. | accurate | accurate |
| VERIFY-DEEP-03 | cadence-core/workflows/verify-deep.md | 21 | The verifier writes `.planning/phases/<N>/verifier-findings.json`. | accurate | accurate |
| VERIFY-DEEP-04 | cadence-core/workflows/verify-deep.md | 23 | The verifier contract lives at `skills/cad-verifier-contract`. | accurate | accurate |
| VERIFY-DEEP-05 | cadence-core/workflows/verify-deep.md | 34-40 | The close bracket `--event return ... --tokens` is valid, and `--tokens` is omitted when the return carries no figure. | accurate | accurate |
| VERIFY-DEEP-06 | cadence-core/workflows/verify-deep.md | 46-48 | `uat merge --phase <N> --payload <file>`. | accurate | accurate |
| VERIFY-DEEP-07 | cadence-core/workflows/verify-deep.md | 52-54 | Verifier results only fill `pending` items; a conflicting finding is skipped and counted. | accurate | accurate |
| VERIFY-DEEP-08 | cadence-core/workflows/verify-deep.md | 54-55 | Unmatched gaps append as new failed items; human checks append as pending. | accurate | accurate |
| VERIFY-DEEP-09 | cadence-core/workflows/verify-deep.md | 55-56 | An entry resolving to no usable item name is rejected and counted, never appended. | accurate | accurate |
| VERIFY-DEEP-10 | cadence-core/workflows/verify-deep.md | 59 | The seam's summary carries `auto_passed`, `gaps`, `added`, `skipped`, `rejected`. | accurate | accurate |
| VERIFY-DEEP-11 | cadence-core/workflows/verify-deep.md | 62-68 | The seam writes `.planning/phases/<N>/FINDINGS.json` with those counters plus `rejected_entries` and `skipped_entries`, overwriting on every successful merge. | accurate | accurate |
| VERIFY-DEEP-12 | cadence-core/workflows/verify-deep.md | 80 | The fall-through checkpoint call with `--tokens` and `--detail` is valid. | accurate | accurate |
| VERIFY-01 | cadence-core/workflows/verify.md | 14-18 | The seam owns first_pass set-once, verifier-never-overwrites-user, counts recomputed every write. | accurate | accurate |
| VERIFY-02 | cadence-core/workflows/verify.md | 19-20,27,136 | `--sweep` cold branch is `workflows/verify-sweep.md`; `--deep` is `workflows/verify-deep.md`. | accurate | accurate |
| VERIFY-03 | cadence-core/workflows/verify.md | 31 | `planning.mjs cursor get` supplies the current phase. | accurate | accurate |
| VERIFY-04 | cadence-core/workflows/verify.md | 38,41 | `uat status --phase <N>` is the state check and returns `counts`. | accurate | accurate |
| VERIFY-05 | cadence-core/workflows/verify.md | 47-48 | `uat refresh --phase <N>` takes a stdin array of `{name, expected, criterion}`. | accurate | accurate |
| VERIFY-06 | cadence-core/workflows/verify.md | 50-52 | Refresh appends only genuinely new names and never touches recorded results. | accurate | accurate |
| VERIFY-07 | cadence-core/workflows/verify.md | 55 | A missing checklist reports `no-uat`. | accurate | accurate |
| VERIFY-08 | cadence-core/workflows/verify.md | 73-76 | An item from a CONTEXT criterion carries `"criterion":"AC<N>"`. | accurate | accurate |
| VERIFY-09 | cadence-core/workflows/verify.md | 77-78 | /cad-audit FAILs on a criterion no item names. | accurate | accurate |
| VERIFY-10 | cadence-core/workflows/verify.md | 79-82 | Other-source items carry `"origin"`; the smoke item sends `"origin":"smoke"`. | accurate | accurate |
| VERIFY-11 | cadence-core/workflows/verify.md | 85-87 | `uat init` writes `fields_version` before it looks at an item. | accurate | accurate |
| VERIFY-12 | cadence-core/workflows/verify.md | 87-89 | Legacy also requires a CONTEXT declaring no ids beside a fieldless checklist. | accurate | accurate |
| VERIFY-13 | cadence-core/workflows/verify.md | 92 | CONTEXT criteria may carry a `(human-verify: needs <tool/service>)` tag. | accurate | accurate |
| VERIFY-14 | cadence-core/workflows/verify.md | 106-107 | `uat init --phase <N>` takes the item array on stdin. | accurate | accurate |
| VERIFY-15 | cadence-core/workflows/verify.md | 114-115 | `workflow.verifier: false` always skips the deep pass. | accurate | accurate |
| VERIFY-16 | cadence-core/workflows/verify.md | 120 | `route.mjs resolve --role cad-verifier` is the stakes probe. | accurate | accurate |
| VERIFY-17 | cadence-core/workflows/verify.md | 123-124 | Every `warnings[]` entry must be relayed. | accurate | accurate |
| VERIFY-18 | cadence-core/workflows/verify.md | 126 | `verify` on that line is `on` or `off`. | accurate | accurate |
| VERIFY-19 | cadence-core/workflows/verify.md | 126-128 | The seam refuses a resolve with no role. | accurate | accurate |
| VERIFY-20 | cadence-core/workflows/verify.md | 132-134 | At stakes solo the deep verify pass is off. | accurate | accurate |
| VERIFY-21 | cadence-core/workflows/verify.md | 150-152,167 | A suffix-tagged `(human-verify: ...)` item goes straight to pass 2. | accurate | accurate |
| VERIFY-22 | cadence-core/workflows/verify.md | 157-160 | The deep pass writes `why_human` for every UNCERTAIN truth as well as every human-only check. | accurate | accurate |
| VERIFY-23 | cadence-core/workflows/verify.md | 169-170 | `blocked` is terminal: `next` offers only `pending`. | accurate | accurate |
| VERIFY-24 | cadence-core/workflows/verify.md | 170 | `refresh` appends only unseen names. | accurate | accurate |
| VERIFY-25 | cadence-core/workflows/verify.md | 171 | `route_failures`' reset is scoped to `status: fail`. | accurate | accurate |
| VERIFY-26 | cadence-core/workflows/verify.md | 171-172 | Completion refuses a `blocked` item. | accurate | accurate |
| VERIFY-27 | cadence-core/workflows/verify.md | 179-181 | `uat status` returns `status`, `counts`, `result` and `first_pending` alone. | accurate | accurate |
| VERIFY-28 | cadence-core/workflows/verify.md | 188-190 | `uat record --phase <N> --item <k> --result <r> --evidence "..." --source model` is valid. | accurate | accurate |
| VERIFY-29 | cadence-core/workflows/verify.md | 194-197 | `uat merge` atomically overwrites `phases/<N>/FINDINGS.json` on every success. | accurate | accurate |
| VERIFY-30 | cadence-core/workflows/verify.md | 226-231 | The reply/result mapping uses only legal results (pass/skipped/blocked/fail). | accurate | accurate |
| VERIFY-31 | cadence-core/workflows/verify.md | 241-243 | `uat record ... [--reported] [--severity] [--reason]` are recorded fields. | accurate | accurate |
| VERIFY-32 | cadence-core/workflows/verify.md | 245 | The output's `next` field is the next pending item. | accurate | accurate |
| VERIFY-33 | cadence-core/workflows/verify.md | 251-253 | A re-record with `--cause` adds the field and leaves first_pass safe. | accurate | accurate |
| VERIFY-34 | cadence-core/workflows/verify.md | 257-262 | The verifier's gap carries `missing` and its human check carries `why_human`. | accurate | accurate |
| VERIFY-35 | cadence-core/workflows/verify.md | 262-265 | The route_failures review fire uses shape (c), file paths. | accurate | accurate |
| VERIFY-36 | cadence-core/workflows/verify.md | 268-270 | `cadence-core/references/triage-gate.md` exists and holds the triage rules. | accurate | accurate |
| VERIFY-37 | cadence-core/workflows/verify.md | 276-282 | The commit-time `risk_surface` fire is shape (b), the staged-diff scope, blocking, re-arm capped at one narrowed round. | accurate | accurate |
| VERIFY-38 | cadence-core/workflows/verify.md | 283 | `uat record --item <k> --result pending --fix "{hash}, retest"` is valid. | accurate | accurate |
| VERIFY-39 | cadence-core/workflows/verify.md | 299-300 | `result: complete` means every item passed or was skipped with a reason. | accurate | accurate |
| VERIFY-40 | cadence-core/workflows/verify.md | 306 | `trace append --phase <N> --family outcome --event uat_verdict --detail "..."` is valid. | accurate | accurate |
| VERIFY-41 | cadence-core/workflows/verify.md | 314-316 | `phase-done --n <N>` checks the ROADMAP box and flips traceability rows to Complete, Deferred exempt. | accurate | accurate |
| VERIFY-42 | cadence-core/workflows/verify.md | 317-319 | `cursor set --phase <N> --status "phase complete" --next ...` is valid. | accurate | accurate |
| VERIFY-43 | cadence-core/workflows/verify.md | 323-327 | The commit stages UAT.md, `phases/<N>/FINDINGS.json` and `phases/<N>/verifier-findings.json`. | accurate | accurate |
| VERIFY-44 | cadence-core/workflows/verify.md | 333 | The report distinguishes `{v} auto-verified` from `{m} model-executed`. | accurate | accurate |
| VERIFY-SWEEP-01 | cadence-core/workflows/verify-sweep.md | 9 | `planning.mjs status` is the one seam call. | accurate | accurate |
| VERIFY-SWEEP-02 | cadence-core/workflows/verify-sweep.md | 11-12 | `phases[]` already carries each phase's derived state and UAT counts. | accurate | accurate |
| VERIFY-SWEEP-03 | cadence-core/workflows/verify-sweep.md | 12-14 | A phase with status `executed` and no `uat` field was built and never verified. | accurate | accurate |
| VERIFY-SWEEP-04 | cadence-core/workflows/verify-sweep.md | 20 | Open-failure phases are read from `.planning/phases/<N>/UAT.md`. | accurate | accurate |
| VERIFY-SWEEP-05 | cadence-core/workflows/verify-sweep.md | 28 | The resume offer goes through the ask-user seam. | accurate | accurate |
| VERIFY-SWEEP-06 | cadence-core/workflows/verify-sweep.md | 4,32 | verify.md has a `build_or_resume` step to return to. | accurate | accurate |

## Claims added after run 1

Run 1's positional ids and its 509/18/20 = 547 counts describe run 1's table
ONLY, and nothing below is part of them. Rows here are claims made after that
sweep closed, which the next sweep must re-verify on the same `doc` plus claim
TEXT join rule the run-1 rows use.

They are kept out of the run-1 table precisely so that count stays a true record
of what was swept: folding a later claim into it would make 547 describe a
surface no run ever read, and the shrink-versus-drift comparison the ledger
exists for would be measured against a moving baseline.

| id | doc | line | claim | verdict | resolution |
|---|---|---|---|---|---|
| SELFVERIFY-01 | cadence-core/bin/self-verify.mjs | 90-104 | Check 16 fails an `@`-included `cadence-core/references/*` or `cadence-core/templates/*` surface that no eager prose of the including command ever names, while `cadence-core/workflows/*` includes are exempt because the workflow IS the command's process. | accurate | accurate |
