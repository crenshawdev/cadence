# Phase 7: The commit rail and the risk gates - Context

Gathered: 2026-09-07
Feeds: /cad-plan 7

## Scope boundary

In: The gates a commit passes through, made real. Three things that today are
either frozen JavaScript, advisory, or absent: the Bash commit rail as a native
`PreToolUse` decision, the source lease turned from a declaration nobody checks
into an enforced admission and patch-time rule, and the risk-detection rail -
`risk-check` over a range or a staged tree, `detect-surfaces` as one-time
evidence, and the receipt that says a fired review actually settled. This is
the cluster assigned at `.planning/ROADMAP.md:641-678`.

In, specifically: a native Bash-tool guard that decides ask / deny / pass on
`git commit` and `git push` against protected-branch policy and records what it
decided; a stated policy for what the guard does when its own inputs are
unavailable (D-30); a two-field lease grammar with one `covers()` predicate
serving admission, plan ordering and enforcement (D-33); enforcement of that
lease at patch-application time (D-31); zero lease exemptions (D-32); the
deterministic risk classifier and its surfaces; and the two range-identity
defects `GH-229` and `GH-248`.

Out: A native pre-commit round trip for the executor - deliberately deferred to
phase 12 by D-31, because it needs the executor to hold a Cadence tool and a
round trip the phase-6 contract does not give it
(`skills/cad-executor-contract/SKILL.md:14`, `agents/cad-executor.md:4`).
Cadence making the task commit itself - rejected outright, it would discard the
executor loop phase 6 just proved. Configurable routing and role selection -
phase 8 (`.planning/ROADMAP.md:680-715`). Review-provider dispatch and reviewer
adjudication - phase 9 (`.planning/ROADMAP.md:716-765`). Full execution and task
behavior, checkpoints, attempt history and `/cad-task` - phase 12.

Not out, and the roadmap is wrong about it: the phase-6 Write/Edit ownership
guard is NOT superseded by "one surviving hook". It is native, shipped and
proved (`crates/cadence/src/guard/mod.rs:78`, `:233`,
`.planning/phases/6/UAT.md:363`, `:384`), and it guards a different tool on a
different channel. Phase 7 adds the Bash arm; it does not replace the Write/Edit
arm. See D-34.

## Durable decisions

- D-30 (Guard failure: fail open, but LOUD): When the guard cannot decide -
  Git unreadable or branch unresolvable - the command proceeds, as v3 did
  (`cadence-core/bin/git-guard.mjs:168`, `:211`, and the empty-string branch
  read at `cadence-core/bin/lib/git-head.mjs:33`), but the failure is recorded
  durably in the decisions log so it is visible after the fact. A TORN CONFIG is
  different, and v3 already handles it correctly: it ASKS, and if a deny was
  already computed it keeps the deny and appends the reason
  (`cadence-core/bin/git-guard.mjs:172-177`). 4.0 preserves that distinction -
  "I could not read your settings" is not "I decided". Correction to this
  decision's first draft, which wrongly folded torn config into fail-open. A
  config key selects hard-fail on protected branches for projects that want it.
  Rationale: silence was the defect, not the allow - a broken guard is
  indistinguishable from an approving one, and v3 could not tell you which it
  had. Phase 7 must also make the guard fail ON PURPOSE against a real host;
  that path has never been tested at all. If wrong: either a broken observation
  silently permits a protected commit with no trace, or ordinary shell work
  blocks on an input the user cannot see or fix.

- D-31 (Lease enforcement: compare at patch time now; pre-commit gate in
  phase 12): Verified against the current tree - `plan.files` has FIVE readers,
  not the three this decision first claimed: told to the executor
  (`crates/cadence/src/execution/dispatch.rs:74`), field validation
  (`crates/cadence/src/execution/plan.rs:151`, `:158`), inter-plan ordering
  (`crates/cadence/src/execution/plan.rs:478`), the plan FINGERPRINT
  (`crates/cadence/src/execution/plan.rs:76`) and the rendered dispatch prompt
  (`crates/cadence/src/execution_service.rs:1144`). The fingerprint reader is
  load-bearing here: changing the lease grammar changes plan identity, so D-33
  must preserve the fingerprint preimage for existing exact-file dispatches or
  reopening one fails. Commit paths
  are recorded by `attach_commit_paths`
  (`crates/cadence/src/execution_service.rs:850`) and NEVER compared to the
  lease. The lease is advisory today. Phase 7 adds the comparison at
  patch-application time: a patch whose reported commit paths fall outside the
  plan's declared lease is refused. Rejected for now: a native pre-commit gate,
  which needs the executor to hold a Cadence tool and a round trip it does not
  have. Rejected outright: Cadence making the commit itself. If wrong: scope
  enforcement stays advisory for another four phases while the roadmap claims
  the lease is real.

  **OPEN - phase 7's plan must answer it.** Refusing the patch does NOT
  un-commit the out-of-lease commit. The commit exists in Git before Cadence
  ever sees it. State what happens to it: what the refusal says, what the
  executor is told to do, whether the dispatch stays open for a corrected
  resubmission, and what the durable record shows. A refusal that leaves the
  repository in a state nobody named is not enforcement.

- D-32 (Lease exemptions: ZERO): v3 has exactly ONE exemption - the plan's own
  reports, in those words at `cadence-core/bin/planning/lease-check.mjs:388`.
  There is NO lockfile exemption; v3 requires lockfiles declared and names
  undeclared files as the refusal (`skills/cad-planner-contract/SKILL.md:107`,
  `skills/cad-plan-checker-contract/SKILL.md:59`). 4.0 carries neither. The
  report exemption is obsolete by construction: the 4.0 executor is forbidden
  from writing `.planning/` and returns a JSON patch instead
  (`skills/cad-executor-contract/SKILL.md:21`), so the exemption has no native
  producer. Any future exemption must name its consumer before it is added.
  Accepted cost: the 4.0 lease is STRICTER than v3 - a plan that forgets to
  declare a file now fails where it used to pass. That is correct given D-31
  makes the lease real rather than advisory. If wrong: a purported parity
  exemption licenses undeclared dependency changes, or legacy report files the
  native executor cannot produce.

- D-33 (Lease spelling: two fields, `files:` and `directories:`): Reject v3's
  overloaded trailing slash. A 4.0 plan declares `files:` - exact paths, where a
  trailing slash is REJECTED as invalid and never silently stripped - and an
  optional `directories:` list with prefix coverage, structurally visible.
  Current `normalize_lease_path` strips trailing slashes silently
  (`crates/cadence/src/execution/plan.rs:150-165` and the `""` arm of its
  component loop), so `src/` and `src` are indistinguishable today; that is the
  bug wearing a new coat of paint, and rejection replaces it. Path
  normalization itself is unchanged. ONE `covers()` predicate reads both fields
  and answers for admission, ordering AND D-31's enforcement - v3's own comment
  (`cadence-core/bin/lib/lease-grammar.mjs:63`) warns that a second copy of this
  logic is how two seams come to disagree. Why this beats the trailing slash:
  meaning stops hiding in one invisible byte, a directory lease is structural
  rather than conventional, less code is touched, and the plan checker gets a
  real field to flag. New files need no exemption - a plan declares a file
  before it exists (PLAN-3 leased `execution/boundary.rs` before it was
  written); an UNANTICIPATED file is a planning correction, proved in phase 6
  when the signing task stopped rather than write `tests/support/signing.rs`
  undeclared, and the stop caught a real design error. If wrong: a directory
  declaration licenses nothing below it, or scope checking and prerequisite
  derivation disagree about the same file.

- D-34 (Two hook arms, not one): "The one surviving hook"
  (`.planning/ROADMAP.md:643`) means one JavaScript hook survives the rewrite,
  not one guarded tool. The Write/Edit ownership guard is already native and
  already proved: it passes through tools other than Write/Edit
  (`crates/cadence/src/guard/mod.rs:78`) and protects `state.json`,
  `decisions.jsonl`, `items.jsonl` and numeric phase `SUMMARY.md` paths
  (`:233`), with live denials recorded at `.planning/phases/6/UAT.md:363`,
  `:384`. The shipped manifest still invokes the frozen JavaScript git-guard for
  Bash (`hooks/hooks.json:5`). Phase 7 ports that Bash arm to the binary and
  retires the JavaScript; it does not rebuild the Write/Edit arm, and it does
  not claim Git protection on the strength of a Write/Edit test. Also note the
  roadmap's "before any skill that commits" is already overtaken - the phase-6
  executor makes signed commits today. If wrong: the plan rebuilds proven code,
  or advertises a Git gate no test ever invoked.

- D-35 (The guard is a bounded command detector, and its bounds are stated):
  The frozen guard walks from hook cwd to `.planning`, stopping at a `.git`
  boundary (`cadence-core/bin/git-guard.mjs:55`). Its scanner splits simple
  command segments and admits only a first word of `git` or a path ending
  `/git`, skipping flags and seven known option operands
  (`cadence-core/bin/lib/git-segments.mjs:32`, `:58`, `:66`). Push always asks;
  commit consults protected-branch policy (`git-guard.mjs:146`, `:185`).
  Wrappers and substitutions are outside its coverage. `-C` is skipped for verb
  detection, but branch inspection uses the hook cwd, not the command's `-C`
  target, and the hook does not follow an earlier `checkout` in the same shell
  command. Phase 7 ports these bounds AS BOUNDS and states them; it does not
  advertise "every commit passes through" (`.planning/ROADMAP.md:643`), which
  this grammar cannot supply. If wrong: the port claims protection for wrapped
  commands or retargeted repositories its input reader never sees.

- D-36 (Protected-branch permission stays separable from branch workflow):
  Config merging, protected-list handling - nonblank string, filtered array,
  explicit `[]` preserved, else `main`/`master` - and the `on_protected=deny`
  alias belong to the guard
  (`cadence-core/bin/git-guard.mjs:86`, `:141`, `:154`,
  `cadence-core/bin/lib/protected-branches.mjs:55`). The three-choice interview
  (create work branch / proceed / abort) and detached, missing and unrelated-base
  handling live in the workflow reference, not the hook
  (`cadence-core/references/git-guard.md:6`, `:22`, `:47`). Branch decision is a
  separate reader that returns create/ask/stay without checking out
  (`cadence-core/bin/git-branch.mjs:59`,
  `cadence-core/bin/lib/branch-decision.mjs:198`). Phase 7 keeps those three
  concerns separate. If wrong: the hook acquires branch creation it never
  implemented, or recovery reverts acquire an integration-branch interview.

- D-37 (Reuse the existing commit-evidence validation; do not rename it a lease
  check): `execution_service` already validates reported completed-task commits
  for existence, strict ancestry after the dispatch base and prior task,
  ancestry to HEAD, signature verification, distinct SHAs and a subject
  containing the task ID (`crates/cadence/src/execution_service.rs:927`,
  `:1310`, `:1355`, `:1365`, `:1394`). It reads changed paths with `diff-tree`
  and rejects non-UTF-8 paths; `attach_commit_paths` checks the commit-key set
  and sorted, unique, safe relative paths
  (`crates/cadence/src/execution/patch.rs:202`). Neither compares those paths to
  `dispatch.files` - that gap is exactly what D-31 fills. Phase 7 adds the
  comparison and does not duplicate the shape checks. Note also that the store
  transaction cannot prevent or roll back a Git commit that already exists. If
  wrong: duplicated commit-shape checks while real scope enforcement stays
  absent.

- D-38 (Generalize pause's Git and risk code; do not write a second copy):
  Existing Rust already implements protected/base/integration decisions,
  persistent questions, a risk scan, staged fire identity, contracted review
  matching and guarded commits (`crates/cadence/src/pause/branch.rs:140`,
  `:163`, `:313`, `crates/cadence/src/pause/risk.rs:38`, `:57`, `:120`,
  `crates/cadence/src/pause/git.rs:293`, `:324`, `:482`). `commit_guarded`
  checks HEAD, branch, index and unstaged selected paths before committing, then
  checks the resulting tree and parent - a mutating subprocess path the Bash
  hook never sees. But `Fire` is pause-specific: its commit kinds are `Wip` and
  `ResumeRecord`, `head_id` is `None`, and index identity excludes binary
  receipt material by provenance. Phase 7 lifts the shared decisions, scans and
  scope-identity primitives into a rail both pause and execution consume; it
  does not treat pause-specific filtering as sufficient for sixteen workflows.
  If wrong: two branch/risk implementations drift apart.

- D-39 (Risk-check is a deterministic diff classifier plus a recorded
  observation): Not a code review and not a project-wide source scan. It
  validates scope and exclusive head-versus-staged arguments, reads the
  effective `review.triggers.risk_surface.surfaces` or an explicit per-run list,
  and refuses torn config or an invalid selection
  (`cadence-core/bin/planning/risk-check.mjs:96`, `:163`, `:199`, `:246`). Eight
  categories: auth, migrations, billing, concurrency, destructive, secrets,
  api_contract, untrusted_input. It resolves commit endpoints, or base plus a
  `write-tree` index tree, and diffs with external diff and textconv disabled
  (`:322`, `:351`, `:386`). The detector tests path segments, basenames,
  extensions and added/removed lines against signal tables
  (`cadence-core/bin/lib/risk-diff.mjs:70`, `:124`, `:275`). Binary, submodule
  and unreadable sections are inconclusive; an empty readable diff is
  checked-and-empty (`:369`). The four reviewer-text pathspec exclusions are
  narrow and do NOT exclude PLANs or planning prose. If wrong: measured
  detection becomes semantic review, planning instructions get suppressed as
  "docs", or a failed scan reports clean.

- D-40 (Detect-surfaces is structural evidence for a one-time choice, and is not
  risk-check): It lists the project root and immediate non-skipped
  subdirectories and collects directory and file names, extensions and
  dependency names from `package.json`, `Cargo.toml`, `pyproject.toml`,
  `go.mod` and `requirements.txt`
  (`cadence-core/bin/planning/detect-surfaces.mjs:36`, `:51`, `:122`, `:173`,
  `:210`). Source bodies are not an input. `scanTree` produces
  evidenced/silent/unspeakable partitions and recommends all eight
  (`cadence-core/bin/lib/surface-scan.mjs:22`, `:187`). A source-keyword pass is
  not a substitute for structural detection. If wrong: structural silence reads
  as absent risk, or broad text matches silently select a blocking-review scope
  the user never chose.

- D-41 (Detection, firing and consequence stay three different things): A
  successful scan returns ok even when it matched risk, and exposes
  `trace.written` separately (`cadence-core/bin/planning/risk-check.mjs:436`,
  `:503`). `status` reads trace history and executor return brackets, applies
  signoff/run/plan boundaries, matches recorded material, and refuses missing,
  unchecked, stale or unfired rows (`:628`, `:689`, `:762`, `:934`). It
  recognizes adjudication, rearm, gate_pass, override and deferral receipts;
  override needs a reason (`:1006`, `:1087`). It does not run reviewers or
  adjudicate their findings - that is phase 9. Native receipt persistence must
  not turn a successful scan into automatic authorization to continue. If wrong:
  "the detector ran" silently becomes "the blocking review passed."

- D-42 (GH-229 is a no-range distinction, and the roadmap's citation is stale):
  `resolveRange` resolves both refs independently and preserves whichever end
  succeeded; it does not reject equal endpoints
  (`cadence-core/bin/planning/core.mjs:650`), and `scanDiff` reports an empty
  string as checked-and-empty (`cadence-core/bin/lib/risk-diff.mjs:391`). The
  markdown workflows already record `risk_check_skipped` when no commits landed
  (`cadence-core/workflows/execute.md:338`,
  `cadence-core/workflows/task.md:154`), but a direct run over `HEAD` and `HEAD`
  still writes a misleading completed-check record. The roadmap's
  `core.mjs:519-524` pointer (`.planning/ROADMAP.md:674`) now lands on
  commentary about partial resolution; the live gap is at `core.mjs:650` and
  `risk-diff.mjs:391`. A real nonempty range whose files are all excluded stays
  DIFFERENT from no commits. If wrong: the fix rejects legitimate ranges, or
  preserves the false clean record while rebuilding endpoint handling.

- D-43 (GH-248 is receipt settlement for staged material, not missing index
  identity): v3 already captures `index_id` with `write-tree`, diffs that
  immutable tree, and matches staged scan records by `base_id` plus `index_id`
  (`cadence-core/bin/planning/core.mjs:612`,
  `cadence-core/bin/planning/risk-check.mjs:343`, `:395`). But the receipt
  collector retains only run/plan, sha and base strings, and settlement matches
  SHA prefixes against `head_id` and `base_id` (`:949`, `:971`, `:990`,
  `:1040`). A resolved staged record has `head_id = null`, so the legacy
  no-IDs fallback does not apply and the head comparison cannot succeed - a
  fired staged record cannot settle through this join even when the correct
  staged scan exists. Rust pause already has a working staged `Fire` with
  `index_id` and exact fire equality (`crates/cadence/src/pause/risk.rs:57`,
  `:120`); phase 7 carries that identity into the shared rail and exposes it to
  the consumer. If wrong: another index fingerprint is added under an impossible
  head-required rule, or a review is accepted for different staged bytes.

- D-44 (One public tool surface; no new tools for the guard): The guard is a
  `PreToolUse` hook invoking the binary directly - it needs no MCP transport to
  answer "is this branch protected" (`.planning/ROADMAP.md:655-660`), and the
  phase-6 UAT already ran the guard by pointing a temporary registration at the
  built binary (`.planning/phases/6/UAT.md:363`). The public surface stays
  `cadence_version`, `cadence_query`, `cadence_apply`
  (`crates/cadence/src/server.rs:144-185`, `docs/architecture/boundary.md:3`);
  any phase-7 read or write reachable from a skill is a new operation inside the
  existing tools, not a fourth tool. Two mechanical facts constrain how:
  `cadence_apply` is NOT a general union today - it deserializes `ExecutorPatch`
  directly (`crates/cadence/src/server.rs:397`) - and advertised query-schema
  construction hard-asserts a single operation
  (`assert_eq!(variants.len(), 1)`, `crates/cadence/src/server.rs:241`, whose
  own comment says adding an operation requires an explicit advertised-schema
  decision). Adding any phase-7 operation therefore PANICS the current schema
  builder until that construction is adapted. That adaptation is phase-7 work,
  and no earlier draft of this CONTEXT asked for it. If wrong: the bounded tool surface
  erodes one phase at a time.

## Acceptance criteria

- [ ] AC1: A native Bash `PreToolUse` guard decides on real commands. On a
      protected branch, `git commit` asks, denies or passes per configured
      policy, and `git push` always asks. Non-Git commands, wrapped commands and
      commands the scanner cannot parse pass silently. Every decision that is
      not a silent pass is recorded durably in `decisions.jsonl`. The shipped
      hook manifest no longer invokes `cadence-core/bin/git-guard.mjs`, and the
      Write/Edit ownership guard's behavior is unchanged.

- [ ] AC2: The guard's own failure is loud, and its two failure kinds stay
      distinct. With Git unreadable or the branch unresolvable, the command
      proceeds and a guard-failure decision is recorded naming which input was
      unavailable. With a torn controlling config layer the command ASKS, giving
      the defaults-instead-of-your-settings reason, and an already-established
      deny survives the tear with that reason appended. With the hard-fail
      config key set and a protected branch, these conditions deny instead. All
      three outcomes are exercised deliberately, not inferred - including at
      least one against a real host.

- [ ] AC3: A plan declares `files:` and `directories:`. A trailing slash in
      `files:` is REFUSED with a typed error naming the field; it is never
      stripped. `directories:` entries give prefix coverage. One `covers()`
      predicate is called by admission, ordering and enforcement, and there is
      exactly one implementation of it in the tree.

- [ ] AC4: A plan leasing `directories: [src/]` and one leasing
      `files: [src/shared.txt]` order as DEPENDENT, not parallel. The plain
      file-equality overlap at `crates/cadence/src/execution/plan.rs:478` is
      gone. A test states the pair and asserts the prerequisite edge.

- [ ] AC5: Applying an executor patch whose reported commit paths fall outside
      the plan's lease is REFUSED. The refusal names the undeclared paths, the
      execution namespace and SUMMARY bytes are unchanged, one refusal decision
      is recorded, and the answer states what becomes of the already-created
      commit and whether the dispatch remains open. A patch whose paths are all
      covered - by `files:` or by `directories:` - is accepted as before. Both
      endpoints of a rename are checked.

- [ ] AC6: There are zero lease exemptions. A staged or committed path under the
      plan's own reports directory is refused like any other undeclared path,
      and an undeclared lockfile change is refused. `.planning/ROADMAP.md:670`
      no longer claims lockfile and report exceptions.

- [ ] AC7: Risk detection over a real diff classifies the eight categories from
      changed paths and added/removed lines, with external diff and textconv
      disabled. Binary, submodule and unreadable sections report inconclusive; an
      empty readable diff reports checked-and-empty; a failed scan never reports
      clean. Surfaces come from effective config or an explicit per-run list, and
      an invalid selection or torn config refuses.

- [ ] AC8: `HEAD..HEAD` no longer records a completed clean check. A range with
      no commits is a distinct no-range answer, and it stays distinguishable
      from a real nonempty range whose files are all excluded. A staged record
      with `head_id = null` settles against its `base_id` plus `index_id`, and a
      receipt for different staged bytes does not settle.

- [ ] AC9: `detect-surfaces` returns evidenced, silent and unspeakable
      partitions from structure alone - directory and file names, extensions and
      manifest dependency names - with source bodies read by nothing. A missing
      root refuses; unreadable subdirectories and manifests add warnings without
      failing the scan.

- [ ] AC10: A successful detection is not authorization. A recorded scan that
      matched risk does not by itself mark a review passed; an unfired, stale or
      unchecked row is refused; an override receipt without a reason is refused.
      The public tool surface remains exactly `cadence_version`,
      `cadence_query`, `cadence_apply`.

## Flagged assumptions

- **`.planning/ROADMAP.md:667-670` is factually wrong about the code it
  describes.** It instructs the phase to keep "the intentional lockfile and
  report exceptions". v3 has exactly one exemption - the plan's own reports,
  said in those words at `cadence-core/bin/planning/lease-check.mjs:388` - and
  no lockfile exemption at all; v3 requires lockfiles declared and names
  undeclared files as the refusal. Planning from that sentence would have
  invented a lockfile exemption while believing it preserved parity. D-32
  settles it at zero and the roadmap line must be corrected as part of this
  phase.

- **`crates/cadence/src/execution/plan.rs:478` is a live correctness bug,
  independent of every decision here.** Ordering uses
  `left.files.iter().any(|path| right.files.contains(path))` - plain equality.
  A plan leasing `src/` and one leasing `src/shared.txt` order as PARALLEL. This
  line first claimed they can then write the same file concurrently; that
  consequence is NOT reachable today, because dispatch refuses a second active
  plan with `dispatch-active` (`crates/cadence/src/execution/dispatch.rs:105`).
  The defect is real, but its blast radius is selection ORDER, not concurrent
  writes. v3 uses containment for exactly this reason. D-33's `covers()` fixes
  it; AC4 states the case.

- **The capability is already reached for - but the "silently broken" framing
  was wrong.** Phase 2 PLAN-1 and PLAN-2 declare
  `crates/cadence/tests/golden/` and `.../golden/recordings/`, which shows a
  directory lease is a real want. They do NOT reach `normalize_lease_path` and
  get silently stripped: those legacy plans lack the required `execution`
  frontmatter, and `Frontmatter` deserialization fails first
  (`crates/cadence/src/execution/plan.rs:47`, `:130`). The evidence for D-33 is
  therefore intent, not a live silent failure. Phase 2 is closed; migrating
  those two declarations is a correction to a historical record - do it
  deliberately or not at all, but say which.

- **D-31's open question is not rhetorical.** Refusing a patch does not
  un-commit an out-of-lease commit that already exists in Git. The plan must
  state the disposition: the refusal text, what the executor is instructed to
  do, whether the dispatch stays open for a corrected resubmission, and what the
  durable record shows. Without that, AC5 can pass while the repository is left
  in a state nobody named.

- **The roadmap's "every commit passes through" overstates what the grammar can
  do.** The scanner admits a first word of `git` or a path ending `/git`, skips
  flags and seven option operands, and does not cover wrappers or command
  substitutions. Branch inspection reads the hook cwd, not a `-C` target, and
  does not follow an earlier `checkout` in the same shell command. Port the
  bounds and state them; do not advertise coverage the input reader cannot
  supply.

- **"Before any skill that commits" is already overtaken by phase 6.** The
  native executor makes ordered signed conventional commits today
  (`.planning/phases/6/UAT.md`). Phase 7 is therefore adding a gate around a
  commit path that already runs, not gating a path that does not yet exist. The
  plan should say what happens to commits made between phase 6 and this gate.

- **No live host evidence exists for the Bash arm.** Phase 6's U6 proved
  Write/Edit denials only, and the boundary doc states plainly that local tests
  cannot prove host loading or live enforcement
  (`.planning/phases/6/UAT.md:363`, `docs/architecture/boundary.md:76`). A green
  suite proved nothing about the product once already this cycle. Phase 7 needs
  its own live probe: a real host, a real protected branch, a real refusal.

- **Pause's `Fire` is not yet a general rail.** Its commit kinds are `Wip` and
  `ResumeRecord`, its `head_id` is `None`, and its index identity excludes
  binary receipt material by provenance. Those are reusable pieces, not proof of
  a generic committed-range rail. Existing pause tests were read in the
  assumption pass, not rerun; rerun them when the rail is lifted.
