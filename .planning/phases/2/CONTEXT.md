# Phase 2: The spine's own bookkeeping - Context

Gathered: 2026-07-27
Feeds: /cad-plan 2

The roadmap goal names two independent repairs: `/cad-plan` seeding the
`## Traceability` rows, and a parallel executor asserting its own plan file
before task 1. The analysis pass changed the premise of the first one. The
seeding step was never authored in any surface - `git log -S Traceability --
cadence-core/workflows/` shows the write path has been status-flip-only since
`c34ec8a` - so this is a missing step, not a step that stopped firing, and the
CAPTURE note placing it at `/cad-verify` was wrong about where it lived.

## Scope boundary

In: a row-inserting seam subcommand that `/cad-plan` calls, seeded from the
plan file's `requirements:` frontmatter and bounded by `## Active` (D-02, D-04,
D-05, D-06); v1.4.0's own `## Active` requirement rows, without which the step
writes nothing on this repo (D-03); an additive `audit` signal for an unseeded
table (D-07); a seam-level report for a non-conforming plan filename, closing
phase-1 D-21 (D-13); a cwd-relative plan-file assertion in `cad-executor`'s
worktree mode that halts as `blocked` (D-08, D-09, D-12); an honest
`references/seams.md` worktree binding (D-10); and the three shipped
fork-from-HEAD claims corrected (D-11). Five doc assertions of the
single-writer invariant move with D-01.

Out: any change to the audit PASS/FAIL arithmetic - the signal is additive and
the verdict is byte-identical (D-07). Any host-side control of the worktree
fork point (D-10). Any fix to `phase-done`'s `reqs:[]`, which is a symptom of
the empty table, not a parser bug (D-14). Any new `## Active` requirement for a
milestone other than v1.4.0.

Deferred: None
Plan shape: multiple plans, same phase - the two halves share no files, so
`plan-overlap` should report no overlap between them

## Durable decisions

- D-01 (`/cad-plan` owns the row-creating write; the single-writer invariant is
  restated, not broken): the invariant becomes "no writer but cad-verify ever
  writes a non-`Pending` Status" - row existence stops being the claim. Five
  assertions move in the same change: `cadence-core/workflows/audit.md:5-7`,
  `skills/cad-audit/SKILL.md:23`, `cadence-core/workflows/progress.md:55`,
  `cadence-core/workflows/verify.md:178` and `:221`,
  `.planning/REQUIREMENTS.md:81`. Chosen over seeding inside `verify.md`'s
  `complete` step, which leaves rows appearing only after UAT passes - so
  mid-cycle `/cad-audit` still reports `total: 0` and `phase-done` has nothing
  to flip on the very run that creates them, the exact ordering that produced
  `reqs:[]` at both prior closes. Also chosen over seeding every phase up front
  at `milestone.md` step 5. Evidence: `cadence-core/workflows/plan.md` writes no
  requirement rows anywhere in its eight steps (REQUIREMENTS.md appears only
  inside the dispatch prompts at `:110` and `:181`, and `commit` at `:220-231`
  stages only plan files plus STATE.md); `cadence-core/workflows/milestone.md:79-81`
  already states "Deep per-phase requirements come later via /cad-plan", so the
  expectation was written down against a step nobody authored.
- D-02 (requirement IDs come from the plan file's `requirements:` frontmatter,
  not the ROADMAP phase entry): frontmatter is the covering declaration
  (`agents/cad-planner.md:123-127`) and is already parsed for audit at
  `cadence-core/bin/planning.mjs:479`. Decisive against the roadmap source: this
  repo's own ROADMAP phase entries carry zero requirement ids while
  `cadence-core/workflows/plan.md:105` sources ids from the roadmap entry, so
  that path reads nothing here. Chosen over seeding from a
  `**Requirements:**` roadmap line with a loud stop when absent, and over
  reading both and diagnosing the mismatch.
- D-03 (this phase writes v1.4.0's `## Active` rows): `.planning/REQUIREMENTS.md`
  `## Active` reads "None." and no phase entry names an id, so under D-02 the
  new step would fire and write nothing on the very repo it ships from - the
  identical empty-table failure a third consecutive cycle. Seeding `## Active`
  is therefore in scope, one row per v1.4.0 phase, and is what makes criterion
  3 observable. Accepted consequence: phase 1 is already complete and UAT'd, so
  its row is written at its true status rather than flipped by `phase-done`.
  Evidence: `.planning/REQUIREMENTS.md:8-11`; `.planning/ROADMAP.md:33-72`.
- D-04 (the write goes through a new `planning.mjs` subcommand, never
  model-authored markdown): no existing writer can insert a row - `setReqStatus`
  mutates matched rows only and has no insert path
  (`cadence-core/bin/lib/planning-files.mjs:143-160`) - and the file header at
  `:1-6` claims to be "the ONLY place a .planning grammar lives". Matches
  "prose keeps judgment, scripts keep invariants". If a model re-authors the row
  shape per call instead, `parseRequirements` (`:94-108`) reads a malformed
  Phase cell as `phase: null`, which audit reports as a `no-phase` break - a
  silent bookkeeping failure of exactly the class this cycle exists to kill.
  Chosen over extending `phase-done` with a create-if-absent mode on its
  existing `--reqs` contract, and over an Edit against a pinned row template.
  Every new subcommand owes a CONTRACTS entry (`cadence-core/bin/self-verify.mjs:37-55`)
  plus tests in `planning.test.mjs`.
- D-05 (seeding is idempotent - insert only when the id has no row,
  skip-and-report otherwise): `cadence-core/workflows/plan.md:55-57` permits
  replan-from-scratch overwrite and `agents/cad-planner.md:144` writes the next
  free plan number in gaps mode, while `parseRequirements:99-107` pushes every
  matching line - so duplicates both inflate `counts.total` and get flipped
  twice by `setReqStatus`, silently misreporting shipped scope at the close.
  Chosen over rewriting a phase's rows wholesale on each plan. Precedent for
  idempotent folds: `cadence-core/workflows/milestone.md:30-47`.
- D-06 (seed only ids already present in `## Active`; anything else stays an
  orphan): seeding every frontmatter id unconditionally would make
  `orphans.plan_ids` unreachable for seeded ids, because
  `cadence-core/bin/planning.mjs:506-511` computes orphans as plan ids minus
  table ids. That silently deletes the audit's reverse direction, which
  `METHOD.md:442-445` publishes as a designed property and `/cad-docs-verify`
  would go on certifying as accurate. Bounding by `## Active` keeps scope creep
  in plan frontmatter detectable. Chosen over marking seeded rows with a
  provenance marker so orphan detection re-keys on that instead of presence.
- D-07 (an unseeded table becomes an additive `audit` signal; the PASS
  arithmetic is untouched): today's blind spot is verified live on this repo -
  `audit` returns `{"requirements":[],"counts":{"total":0,"traced":0,"broken":0,"deferred":0}}`
  and `cadence-core/workflows/audit.md:43-46` defines PASS as `counts.broken == 0`,
  so an empty table PASSes; `planning.mjs:112-121` only drifts on rows that
  exist and `skills/cad-health/SKILL.md:36-46` is vacuously satisfied by zero
  rows. The signal is an additive, omitted-when-empty field following phase-1
  D-02's precedent, NOT a third verdict state - `audit.md:43-50` forbids
  softening the verdict. Without it, a future regression in the seeding is again
  invisible until a human hand-populates at the close: the two-cycle failure
  mode repeating with a new cause. Chosen over leaving detection alone on the
  argument that the step firing at every `/cad-plan` is its own guarantee.
- D-08 (Cadence does not control the worktree fork point; the executor-side
  assertion is the entire fix): `cadence-core/workflows/execute.md:151-152`
  delegates to "(spawn-agent seam, worktree isolation)" but the spawn-agent
  binding at `cadence-core/references/seams.md:37-119` defines no worktree
  behavior at all - the reference is dangling - and no `git worktree add` exists
  anywhere in `cadence-core/bin`, `agents/`, `skills/`, or
  `cadence-core/workflows/`. So "fork the worktree explicitly", the first half
  of the CAPTURE item's proposed fix, is not available to Cadence. Chosen over
  a `/cad-spike` to measure the host's fork point first, which costs a detour
  before a phase whose stated job is to land early.
- D-09 (a failed assertion halts as `blocked`; the executor never self-repairs):
  `agents/cad-executor.md:86-104` defines `blocked` as "blocked by something you
  may not fix" and `:108-110` already says "HALT ... Never repair refs
  yourself". The improvised merge that three phase-4 executors performed becomes
  an orchestrator decision, keeping merges serialized where
  `cadence-core/workflows/execute.md:159-160` already puts them, one at a time
  with a user stop on conflict. Chosen over sanctioning a bounded self-repair
  (merge the branch `git-branch.mjs decide` names, proceed, record a deviation),
  which runs N concurrent unsupervised merges with no conflict policy inside the
  one path `execute.md` deliberately serializes; and over having the
  orchestrator tear down and re-create the worktree, which needs a worktree path
  the host never hands back. Note `:112-115`'s forbidden-ops list covers
  `stash`/`clean`/`reset`/`restore` but not `merge`, so the halt has to be
  stated rather than inherited.
- D-10 (`references/seams.md` states the honest binding): the spawn-agent seam
  gains an explicit statement that worktree isolation's fork point is
  host-owned and not caller-controllable, so the dangling reference at
  `execute.md:151-152` resolves to something true rather than to nothing. This
  is the durable half of D-08 - a future reader who finds only the assertion
  would otherwise assume the fork point was simply never wired up.
- D-11 (three shipped fork-from-HEAD claims move with the assertion):
  `cadence-core/references/git.md:77-81` ("parallel worktrees already fork from
  HEAD and self-reap"), `cadence-core/bin/lib/branch-decision.mjs:72-73` and
  `:93` ("this branch tip is the worktree fork point", D-06), and
  `METHOD.md:487-489` are all contradicted by the phase-4 evidence at
  `.planning/CAPTURE.md:5` (a worktree 31 commits behind, containing neither
  `phases/4/CONTEXT.md` nor its own `PLAN-2.md`). Left standing, the assertion
  ships beside public prose asserting the condition it exists to catch cannot
  occur, and `/cad-docs-verify` (`cadence-core/workflows/docs-verify.md:20-21,35-36`)
  checks METHOD.md by default and would certify the stale claim as accurate.
  Chosen over filing the corrections as capture items, and over downgrading the
  claims to "expected, not guaranteed" rather than correcting them.

## Decisions

- D-12 (the assertion lives in `agents/cad-executor.md`'s `<worktree_mode>`,
  cwd-relative): `:106-115` already carries a cwd-relative pre-commit branch
  check with a HALT rule, so this is one more line in an established block. The
  orchestrator cannot do it - `plan-overlap` (`cadence-core/bin/planning.mjs:533`)
  and `derivePhases` (`:63`) read the invoking directory, and Cadence never
  receives the worktree path, so an orchestrator check would have passed against
  the main tree while the worktree was 31 commits behind: green on the exact
  phase-4 failure. Chosen over putting it in the dispatch prompt, which pays
  prompt-cache cost per dispatch against `references/seams.md:96-104`, and over
  a `planning.mjs` subcommand the executor shells out to - which would be
  testable in `planning.test.mjs`, but the assertion is a cwd existence check,
  not a grammar.
- D-13 (the `PLAN-gaps.md` naming hole is closed at the seam): `audit` and
  `plan-overlap` report any `PLAN*.md` in a phase directory that fails
  `/^PLAN(-\d+)?\.md$/`, as an additive diagnostic in the same shape as D-07's.
  `agents/cad-planner.md:144-145` already directs gaps mode to "the next free
  plan number (an unnumbered PLAN.md counts as plan 1)", which satisfies the
  pattern - but `cadence-core/workflows/plan.md:116-119` carries no gaps
  carve-out, so today the fix rests entirely on agent prose. Phase-1 D-21
  assigns this failure to phase 2 by name. Evidence:
  `cadence-core/bin/planning.mjs:66,476,535`; `PLAN-gaps.md` at `eb6db8f`.
- D-14 (`reqs:[]` at `phase-done` is a symptom, not a second bug): no parser fix
  is in scope. `cadence-core/bin/planning.mjs:249-256` derives ids from
  `parseRequirements(reqText)` filtered on `r.phase === n`; with zero rows the
  filter yields `[]`, `setReqStatus` returns `changed: []`, and the command
  still emits `ok:true`. `cadence-core/bin/planning.test.mjs:435` already pins
  the populated-table behavior as correct.
- D-15 (budgets move in the same commit; current figures): every surface this
  phase touches is at EXACTLY zero headroom, verified against
  `cadence-core/bin/weight-budgets.json` - `plan.md` 12362/12362, `execute.md`
  12292/12292, `verify.md` 9898/9898, `audit.md` 3037/3037,
  `agents/cad-executor.md` 6073/6073, `agents/cad-planner.md` 8786/8786. Any
  byte added to any of them requires the budget bump in the same change or CI
  fails `budget-overrun`; shrinking is free. Same rail as phase-1 D-22.
- D-16 (durable rules land in `cadence-core/references/`): the seeded-row
  grammar and the assertion's contract go where `cadence-core/bin/lib/surface-weight.mjs:8-12`
  does not walk - it measures only `agents/*.md`, `skills/**/SKILL.md` and
  `cadence-core/workflows/*.md`. Phase 1's `references/plan-frontmatter.md`,
  cited from both `planning-files.mjs:411-413` and `audit.md:25-26`, is the
  precedent. Chosen over inlining in `plan.md` only, and over
  `templates/REQUIREMENTS.md`'s Notes block (also unmeasured, at `:64-72`).

## Acceptance criteria

- [ ] Running `/cad-plan` on a phase whose PLAN.md declares `requirements: [X]`,
      where `X` has a `## Active` row, leaves a `| X | <N> | Pending |` row in
      `REQUIREMENTS.md` `## Traceability`; a declared id with no `## Active` row
      creates no row and is still reported under `audit`'s `orphans.plan_ids`.
- [ ] Running the seeding a second time against the same plan leaves exactly one
      row per id and names the skipped ids in its output.
- [ ] `.planning/REQUIREMENTS.md` `## Active` carries a requirement row for each
      of v1.4.0's four phases, each phase's PLAN.md `requirements:` frontmatter
      names its ids, and `node cadence-core/bin/planning.mjs audit` reports
      `counts.total` greater than 0.
- [ ] `audit` against a `.planning` whose `## Traceability` has zero rows returns
      an additive field naming the unseeded state, while `counts.broken` stays
      `0` and the PASS/FAIL verdict for that tree is byte-identical to today's.
- [ ] A `PLAN-gaps.md` in a phase directory is reported by `audit` and
      `plan-overlap` as a non-conforming plan filename; a `PLAN-2.md` in the same
      directory is not.
- [ ] A `cad-executor` dispatched into a worktree that does not contain its own
      `PLAN-<k>.md` halts with a `blocked` checkpoint naming the missing file,
      before any task-1 commit. (human-verify: needs a live parallel
      `/cad-execute` run under host worktree isolation)
- [ ] `node --test cadence-core/bin/*.test.mjs` and `npx tsc -p tsconfig.ci.json`
      both pass, `self-verify` reports no `budget-overrun`, and
      `/cad-docs-verify` reports no stale claim that worktrees fork from HEAD or
      the integration tip (`references/git.md:77-81`,
      `lib/branch-decision.mjs:72-73,93`, `METHOD.md:487-489`).

## Flagged assumptions

- How Claude Code's worktree isolation picks its fork point, and whether a
  caller can pin it, is unresolved - Unclear, and deliberately left so (D-08).
  The codebase cannot answer it: `execute.md:151-152` names the behavior and
  `references/seams.md` binds nothing. If the host does expose a pinnable fork
  point, the assertion is still correct but becomes a backstop rather than the
  whole fix, and D-11's corrected claims would need re-correcting toward
  "guaranteed" again.
- Whether phase 1's already-complete status can be represented cleanly in a
  `## Active` row seeded after the fact - Likely harmless; its UAT passed 23/23
  so the true status is known, but no code path writes a row at anything other
  than `Pending`, so D-03's phase-1 row is a hand-authored exception to D-04's
  seam-only rule on its first and only use.
- Whether any consumer outside Cadence reads the `## Traceability` table shape -
  Confident it does not; the table is a Cadence-private grammar parsed only by
  `parseRequirements` and `setReqStatus`, both in `planning-files.mjs`.
