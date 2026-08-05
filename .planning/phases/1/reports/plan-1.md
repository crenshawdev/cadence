PLAN COMPLETE
Plan: .planning/phases/1/PLAN.md
Tasks: 10 of 10

| Task | Commit | Note |
|---|---|---|
| 1: state the break-even rule in the spawn-agent seam | eff04e3 | +14 lines to `cadence-core/references/seams.md` § spawn-agent, placed between **Handoff read discipline** and `## Seam: call-review-provider`. No budget entry moved (`references/` is unbudgeted until phase 3), confirmed by `weight.mjs` listing no `seams.md` surface. |
| 2: the executor writes its report and returns a digest | 12a5aad | All nine sub-items landed in `skills/cad-executor-contract/SKILL.md`: path derivation, per-task write, verbatim file contents, five-field terminal digest, checkpoint arm, `risk_surface` diff file, worktree pathspec commit, `reports/**` glance exemption, continuation trusting the file. Budget regenerated 6954 -> 10877. |
| 3: both orchestrators read the report file instead of the return | 596b24c | `execute.md`: one report-file rule stated once, complete/partial/timeout arms, `handle_checkpoint`, `execute_parallel` step 3 pre-merge HEADs, `goal_check`, `summary`, `state` (incl. the `commit_docs: false` clause). `task.md`: `planned_path` steps 3-4. Budgets regenerated: execute.md 14805 -> 16828, task.md 3671 -> 3889. |
| 4: the narrow `Write` grant, with a blocking check behind it | 0dd055f | `Write` moved from `disallowedTools:` into `tools:` on all four rungs, `Edit`/`MultiEdit` still denied. New blocking check 7c in `self-verify.mjs` (kind `verifier-write-grant`, both directions), added to the `checked:` string. 7 test rows. Byte-neutral: `weight.mjs` still reports 548/535/531/523. Cleared the blocking `risk_surface` review with two MEDIUM survivors folded in (deviations below). |
| 5: the verifier writes one findings file and returns a digest | ab57a9b | `skills/cad-verifier-contract/SKILL.md`: role, `<output>` and `<guardrails>` rewritten - one `Write` call to `.planning/phases/<N>/verifier-findings.json`, JSON in the `uat merge` payload shape, digest-only terminal message. Name rule stated with the `planning.mjs:670-675` citation. Rigor sections (four levels, anti-pattern scan, verdict ordering) untouched. Budget regenerated 7676 -> 9206. |
| 6: `uat merge` takes a payload file and refuses a bad envelope | 2816b17 | `--payload <file>` on the `merge` arm (stdin unchanged when the flag is absent); `readJsonPayload` replaces the `null`-sentinel reader with a discriminated result; `no-payload` / `bad-payload` envelope refusals land before `loadUat` and before any write; `'uat merge': ['--phase','--payload']` in the self-verify contract table. 14 new test rows (7 refusal, 1 transport-equivalence, 3 single-array positives, 2 init/refresh sentinel, 1 valueless-flag). Cleared the blocking `risk_surface` review with one finding folded in and two declined (deviations below). 225/225 tests, `self-verify` `"ok":true`, `tsc -p tsconfig.ci.json` exit 0. |
| 7: the deep pass reads the file and falls through on one named step | 7c6b041 | `verify-deep.md` restructured into three `<step name="...">` blocks - `dispatch`, `merge`, `fall_through`. The quoted payload template and the "building the payload is a copy" paragraph are deleted; the merge is one `uat merge --phase <N> --payload <path>` call. Both failure arms (failed/empty/timed-out dispatch, `ok:false` from the merge) cite `fall_through` by name and describe no behaviour of their own, so neither can grow a private error path. The two-files-two-writers paragraph names `verifier-findings.json` and `FINDINGS.json` explicitly. `verify.md`: `route_failures` step 1 opens the findings file for `missing`/`why_human`; `complete` commits it beside `FINDINGS.json`. Budgets regenerated: verify-deep.md 2393 -> 2529, verify.md 12753 -> 13134. All four automated verify checks matched their predictions exactly (`fall_through` grep = 3 lines). |
| 8: the review subsystem takes references, not bytes | 7ff1e16 | `review-triggers.md` § 2 rewritten: `artifact` is a REFERENCE in exactly three shapes - (a) `{base_ref, head_ref}`, (b) staged-diff scope in the orchestrator's own tree, (c) a path. § 4 states per backend what it does with one: `claude-subagent` produces the artifact itself in the cwd it inherits; cross-model composes the payload FILE in two shell steps and passes the existing `--payload <file>` (heredoc/`echo` assembly forbidden, with the reason). D-11 and D-10 each recorded in one line. Wiring table's Payload artifact column now names the shape per trigger. `cad-reviewer-contract` `<role>`: the artifact arrives as a reference, producing it is step one, an unresolvable reference returns a single `blocker` and never `findings: []`. Budget regenerated 3296 -> 3608. Byte delta on `review-triggers.md`: 13224 -> 15436 (+2212), see deviation. |
| 9: every fire site hands a reference | 4a6abb3 | Converted: `execute.md` `execute_sequential` `diff` (shape a), `handle_checkpoint` `risk_surface` (shape c, the checkpoint's file path), `execute_parallel` step 5 per-plan `diff` (shape a, step 3's pre-merge HEAD paired with the post-merge HEAD) plus the line settling CONTEXT's flagged assumption, step 6 `phase_diff` (shape a); `cad-land` step 3 `pre_ship` (shape a) and its one permitted re-fire (same base, new HEAD); `debug.md` Resolve step 3 (shape b); `task.md` `risk_check` (shape a); `verify.md` `route_failures` step 1 (shape c, cited paths plus `reported`/`cause`) and step 3 commit-time `risk_surface` (shape b). Completeness sweep accounted for all 13 files (below). Budgets regenerated: debug.md 6237 -> 6415, execute.md 16828 -> 17385, task.md 3889 -> 4018, verify.md 13134 -> 13432, cad-land 9079 -> 9171, cad-executor-contract 10877 -> 10891. |
| 10: close the stale claims and prove the cycle green | 8ccb5b3 | D-10 VERIFIED not re-implemented (no second guard landed); D-18 verified absent from config with a clean `route.mjs resolve`; D-11 recorded in the CHANGELOG. One `### Changed` block under `## [Unreleased]`. `.planning/CAPTURE.md:179` flipped to `- [x]` with the closure text - on disk only, see deviation. D-17 ratchet audited commit-by-commit and HELD: no `fix(budget):` repair commit was needed. `node --test cadence-core/bin/*.test.mjs` 1146/1146, `self-verify` `ok:true` with zero problems, `tsc -p tsconfig.ci.json` exit 0. |

Task 9 completeness accounting (the plan requires every file the sweep names
to be classed; the command returned 13, matching the plan's own count):
- CONVERTED by this task (5): `workflows/execute.md`, `skills/cad-land/SKILL.md`,
  `workflows/debug.md`, `workflows/task.md`, `workflows/verify.md`.
- ALREADY reference-shaped, no edit needed (3): `workflows/plan.md:223`
  ("payload = the PLAN file(s)") and `skills/cad-plan-review/SKILL.md:41-42`
  ("with the resolved PLAN file(s) as the artifact") both hand a file
  reference, which task 8's shape (c) now covers explicitly;
  `skills/cad-executor-contract/SKILL.md` does not hand an artifact to a
  reviewer at all - it WRITES the flagged staged diff to a file and returns
  the path, which is the source of shape (c) rather than a consumer of it.
- NOT a fire site (5), with the reason: `workflows/config.md` (a config
  catalog listing trigger keys as enum values), `workflows/config-review.md`
  (names `fire()` while discussing `review.reviewers` as a config value),
  `workflows/context.md:365` (states that NO review trigger fires there),
  `workflows/milestone.md:132` and `skills/cad-milestone/SKILL.md:36` (both
  reference `cad-land`'s `pre_ship` gate-halt as a downstream consequence, and
  neither fires anything), `skills/cad-plan/SKILL.md` (a description line plus
  a one-line summary of what `workflows/plan.md` does).
- Recorded, outside RES-03's shape:
  `workflows/decision-review.md:34-41` inlines a bounded decision QUOTE plus
  its surrounding context - no diff, not one of the five wiring-table
  triggers, so it is not converted. (It does not appear in the sweep's output
  at all, being neither a named trigger nor a `fire(` site; recorded here
  because the plan asks for it.)

Deviations:
- [deviation] Task 2 (5): the plan asks the contract prose to say the three
  checkpoint fields "are D-04's routing fields". `D-04` is a `.planning/`
  CONTEXT decision id with no meaning to a plugin user reading the shipped
  skill, so the prose states the substance ("Those three are ROUTING fields,
  not additions to the digest") without the internal id. Semantics unchanged.
- [deviation] Task 3: expected `grep -n "executor reports"
  cadence-core/workflows/execute.md` to match the summary step; it matched
  ZERO lines, because the rewrite wrapped the phrase across two lines.
  Reflowed the sentence so the phrase is intact on line 256, and the grep now
  matches only the summary step as the plan predicts. Behaviour unchanged;
  caught only because the prediction was stated first.
- [deviation] Task 2: `skills/cad-executor-contract/SKILL.md` grew 6954 ->
  10877 bytes (+56%) carrying the nine sub-items and their stated rationales.
  The plan anticipates the regeneration but names no ceiling. Flagged because
  this is a preloaded contract that rides every cad-executor dispatch, in a
  milestone whose subject is resident bytes; phase 3 owns the budget pass.
- [deviation] Task 4, from the blocking `risk_surface` review (MEDIUM 1):
  check 7c's name regex `/^name:[ \t]*(\S+)[ \t]*$/m` captured the RAW scalar,
  so a valid YAML `name: "cad-verifier"` captured with its quotes, matched
  neither `=== 'cad-verifier'` nor `startsWith('cad-verifier-')`, and the whole
  grant check skipped SILENTLY while `lib/rung-agent.mjs` kept routing that
  file (routing resolves by filename). A silent skip in the sole mechanical
  backstop is the one failure mode the check exists to prevent. Fixed: one
  matched surrounding quote pair is stripped before the comparison
  (`.replace(/^(['"])([\s\S]*)\1$/, '$2')`), with the reason in the comment.
  The comment's old claim that "the rung map is what routes here" was wrong in
  the same place and was corrected to say the map resolves by FILENAME, which
  is exactly why the two identities must not diverge. New test row `check 7c: a
  QUOTED verifier name is still checked`; reverting the strip fails exactly
  that 1 row (verified by mutation).
- [deviation] Task 4, from the blocking `risk_surface` review (MEDIUM 2):
  `verifierFixture()` hardcoded `name: cad-verifier-max`, so all five grant
  rows exercised one name and mutating the predicate to
  `agentName === 'cad-verifier-max'` passed the whole suite while
  `cad-verifier`, `cad-verifier-medium` and `cad-verifier-xhigh` had zero
  coverage. Fixed: the fixture takes the name as a parameter (default
  unchanged) and the failing rows now spread across the real rung names -
  bare `cad-verifier` (Write missing), quoted `"cad-verifier"`,
  `cad-verifier-medium` (Edit), `cad-verifier-xhigh` (MultiEdit). Verified by
  mutation: narrowing the predicate to `=== 'cad-verifier-max'` now fails 4
  rows where it previously failed 0.
- [deviation] Task 4 adjudication, recorded so it is not re-litigated: the
  review's two headline findings (a new capability class, an unbounded write
  surface) were killed on one grounded fact - `Bash` was ALREADY in `tools:` on
  all four rung files before this diff (`git show HEAD:agents/cad-verifier.md`
  -> `tools: Read, Bash, Grep, Glob`). A Bash-capable agent can already write
  any file by shell redirection, so moving `Write` out of `disallowedTools:`
  does not enlarge the set of reachable filesystem states. The path-scoping
  limitation is D-16, already recorded, and check 7c is D-08's stated backstop.
- [deviation] Task 6: `uat init`/`uat refresh` shared the broken reader, and
  the plan asks them to be checked rather than changed. Two observable changes
  fell out of the sentinel fix and are recorded rather than hidden: (a) a
  literal `null` on stdin is now refused `bad-payload` exit 1 where it exited 0
  printing NOTHING (this is the fix, and two new test rows pin it); (b) EMPTY
  stdin now refuses `no-payload` instead of `bad-payload`, because empty input
  is a different repair from wrong-shaped input. No existing test asserted the
  old reason, so nothing regressed.
- [deviation] Task 6: added `!i ||` to the init/refresh element guard
  (`items.some((i) => !i || !i.name || !i.expected)`). A payload of `[null]`
  previously threw a TypeError on `i.name`, which the top-level catch reported
  as `{ok:false, reason:"internal"}` - a crash dressed as a diagnostic, in the
  exact reader this task was fixing. It is now a plain `bad-payload`.
- [deviation] Task 6, from the blocking `risk_surface` review (the one finding
  folded in): the envelope rule at `planning.mjs:607-608` is a DISJUNCTION
  (`!isArray(passes) && !isArray(gaps) && !isArray(human_checks)`), and no new
  row pinned it as one - the seven refusal rows carry no array at all and the
  transport-equivalence row carries all three, so mutating the `&&` chain to
  `||` passed every new row while wrongly refusing a legitimate one-array
  findings file such as `{"gaps":[...]}`. Fixed: three positive rows, one per
  array (`ONLY passes` asserting `auto_passed:1`, `ONLY gaps` asserting
  `gaps:1, added:1`, `ONLY human_checks` asserting `added:1`), each merging
  successfully with exactly one array present.
- [deviation] Task 6 falsification, expected vs observed: predicted the `||`
  mutation would fail exactly the 3 new rows; it failed 14 (211 pass / 14 fail
  of 225). The other 11 are PRE-EXISTING `uat merge` rows whose stdin payloads
  carry `passes` + `gaps` but no `human_checks`, so they were already
  mutation-sensitive. The review's premise ("still passes every NEW test row")
  holds; its implied premise that the mutation was undetected by the suite as a
  whole does not. The three rows are kept regardless: they are the only
  coverage of a `human_checks`-only payload and the only rows that name the
  disjunction directly rather than catching it as a side effect. Reverted after
  the mutation run; `git diff` against the index confirmed byte-identical.
- [deviation] Task 6 adjudication, two findings DECLINED and recorded so they
  are legible rather than lost. (a) utf8 lossy decoding: `readFileSync(...,
  'utf8')` at `planning.mjs:409-433` replaces malformed byte sequences with
  U+FFFD before `JSON.parse` sees them. CONFIRMED mechanically, DOWNGRADED to
  low, NOT actioned - the consequence is one replacement character inside a
  `name` string, so the entry appends instead of matching a pending item, which
  is the documented unmatched-gap path. No structural corruption, and the
  refuse-before-write invariant is untouched; byte-level encoding validation is
  outside D-07's envelope scope. (b) whitespace-only `--payload` PATH refused as
  `no-payload` (`:415`): CONFIRMED but reaches only a file literally named " ".
  The guard exists because `parseArgs` hands a valueless `--payload` the boolean
  `true`, and refusing is fail-safe. Low, NOT actioned.

- [deviation] Task 8, byte growth on an eagerly-preloaded surface:
  `cadence-core/references/review-triggers.md` went 13224 -> 15436 (+2212,
  +16.7%) after a trim pass, against the plan's instruction to "keep the net
  growth small". The three shapes, the per-backend handling, the forbidden-
  heredoc rationale and the two recorded facts (D-10, D-11) are each mandated
  by the task's own Action text, and the shortened table column paid back far
  less than the plan assumed - the `risk_surface` cell had to NAME two shapes,
  so the column grew rather than shrank. Flagged because this file is
  `@`-preloaded into `/cad-land` and `/cad-plan-review` on every invocation, in
  a milestone whose subject is resident bytes. `references/` carries no budget
  entry until phase 3, so nothing mechanically caught it. Phase 2 owns this
  file's load-order work and phase 3 its budget.
- [deviation] Task 8, expected vs observed: the Verify predicts `grep -n
  "base_ref"` shows step 2, step 4 AND the wiring table; it shows step 2 and
  step 4 only (2 sites, not 3). The task's own Action text is what makes the
  third unreachable - it specifies the table cells as refs
  `<pre-plan HEAD>..HEAD` / `<PHASE_START>..HEAD` / `<base>..HEAD`, none of
  which contains the literal token. The substance holds: every table cell is
  labelled with the shape letter defined at step 2. Not padded with a
  byte-costing mention purely to satisfy a grep, in this milestone especially.
- [deviation] Task 9: the phrase blacklist `grep -rn "as the payload\|the
  flagged diff\|full branch diff"` was non-empty on first run, matching two
  lines of task 2's OWN prose in `skills/cad-executor-contract/SKILL.md`
  (":46 which puts the flagged diff in a file rather than in your return" and
  ":152 it is the flagged diff itself and must not reach history"). Both are
  the opposite of the defect the blacklist hunts - they describe the FILE
  transport - so they were false positives that would have cost a verifier a
  round trip. Reworded to "the flagged staged diff", matching the wording
  already used at :108, which is more precise anyway; budget regenerated
  10877 -> 10891. The grep is now empty.
- [deviation] Task 9: `verify.md` did not appear in the converted-sites grep
  (`base_ref|--cached|flagged-diff`) because its two bullets use shape (c)
  paths and a prose reference to shape (b). Made the commit-time
  `risk_surface` bullet name `git diff --cached` explicitly, so the grep shows
  one converted site per bullet as the Verify predicts.
- [deviation] Task 9: the budget sweep found `skills/cad-plan-review/SKILL.md`
  carrying 2484 in the manifest against 2448 on disk - a 36-byte headroom
  entry, pre-existing and untouched by this phase. Deliberately NOT
  regenerated: it is not this task's edit, self-verify only fails on overrun,
  and the same manifest carries headroom entries by design (the plan itself
  cites `cad-reviewer-contract` at 3240/3296). Recorded rather than quietly
  normalized.
- [deviation] Task 10: `.planning/CAPTURE.md` is listed in the plan's `files:`
  but is GITIGNORED in this repo (`.gitignore:23`, `/.planning/CAPTURE.md`).
  The item at `:179` was closed on disk in the file's own convention as the
  task asks, but it cannot enter git history here, so task 10's commit carries
  `CHANGELOG.md` alone. The commit message was amended to name only what the
  commit contains rather than force-adding past a standing ignore rule.
- [deviation] Task 10, D-10 line numbers: the plan cites
  `review-provider.mjs:576-579` (review) and `:592-596` (consult); the actual
  guards are at `:575-578` and `:592-595`, with the ordering requirement stated
  at `:246-251` and the regression row at `review-provider.test.mjs:433-455`.
  The CAPTURE closure cites the observed lines, and notes that the item's own
  citations (`:568`, `:587`, `:245`) had drifted, which is part of why it still
  read as open.

Open items:
- AC2, AC3 and task 7's Verify step (5) are human-verify: each needs a LIVE
  cad-executor or cad-verifier dispatch and cannot be proved from this tree.
  They are already tagged `(human-verify)` in CONTEXT and carried forward.
- Task 7 step (5) scope split, recorded for `/cad-verify 1` so SC4 is read
  against it rather than logged as a gap: the MERGE-refusal arm of
  `fall_through` is NOT reachable from a live `/cad-verify --deep` invocation,
  because `dispatch` runs before `merge` and the verifier overwrites any
  pre-seeded malformed findings file at that same path. The reachable live
  case is the other arm, a dispatch producing no usable file. The merge arm is
  proved instead by task 6's seven executable refusal rows (each asserting
  `ok:false`, the exact reason, exit 1 and a byte-identical UAT.md) plus task
  7's `fall_through` convergence grep, which proves that arm cites the same
  named step and therefore has no private error path.
- `agents/cad-verifier.md`'s `description:` still says "Read-only", which task
  4's `Write` grant makes false. Deliberately not edited: CONTEXT scopes
  descriptions to phase 3, which measures all 29 against a baseline captured
  before phase 1. The other three rung descriptions do not carry the claim.
  A one-line edit if the user judges two phases too long to carry it.
- `skills/cad-executor-contract/SKILL.md` is now 10891 bytes (was 6954 at
  phase start, +57%) and rides every cad-executor dispatch; `review-triggers.md`
  is 15436 (was 13224). Both are phase 2/3 surfaces, flagged here because this
  milestone's subject is resident bytes and this phase moved them upward.
- `.planning/CAPTURE.md`'s closure of the over-cap item lives on disk only and
  will not survive a fresh clone (see the task 10 deviation).
