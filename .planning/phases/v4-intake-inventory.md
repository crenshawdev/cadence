# V4 intake inventory: phases 11, 12 and 13

Frozen-surface facts for owner intake. No proposed decisions or acceptance
criteria.

## Scope and citation convention

The reference is `v3.7.12`, commit `c39bbd8c`; v3 internals are reference
material, not the v4 specification. The phase clusters below come from the
ROADMAP detail sections, including coverage and all three review aliases.
Sources: `.planning/ROADMAP.md:20`, `.planning/ROADMAP.md:866`,
`.planning/ROADMAP.md:929`, `.planning/ROADMAP.md:967`.

Citations name repository-relative files and line numbers. A
`v3.7.12:skills/...:line` citation explicitly names the frozen version where
the working-tree contract has since changed. In particular, today's execute
entry uses MCP directly, and today's executor forbids reports; the frozen
entry loads the legacy workflow and the frozen executor writes reports.
Sources: `skills/cad-execute/SKILL.md:12`,
`skills/cad-executor-contract/SKILL.md:22`,
`v3.7.12:skills/cad-execute/SKILL.md:25`,
`v3.7.12:skills/cad-executor-contract/SKILL.md:245`.

A write route below is one invoking skill plus one destination family.
Repeated writes, revisions and conditional arms to that destination are
grouped. Dynamic phase, plan, attempt and task names are patterns, not a
claim that one invocation creates a fixed number of files. Renames and
deletions count as mutations. Source changes and Git storage are identified
separately from Cadence-owned records: the ROADMAP expressly leaves project
source in the project's ownership.
Sources: `cadence-core/workflows/phase.md:36`,
`cadence-core/workflows/phase.md:54`,
`v3.7.12:skills/cad-executor-contract/SKILL.md:253`,
`.planning/ROADMAP.md:29`.

Scratch payloads and transient diffs are not permanent destinations.
Execute deletes its flagged diff after review; task uses a disposable
directory on the inline arm. Permanent reports are different.
Sources: `cadence-core/workflows/execute.md:367`,
`cadence-core/workflows/task.md:244`,
`cadence-core/workflows/task.md:252`,
`cadence-core/references/conventions.md:1`.

## Where the commands live

| Cluster | Skill entry | Loaded workflow or procedure |
|---|---|---|
| 11 | `skills/cad-new-project/SKILL.md:27` | `cadence-core/workflows/new-project.md:1` |
| 11 | `skills/cad-adopt/SKILL.md:25` | `cadence-core/workflows/adopt.md:1` |
| 11 | `skills/cad-phase/SKILL.md:23` | `cadence-core/workflows/phase.md:1`; also loads `cadence-core/references/git-guard.md` at `skills/cad-phase/SKILL.md:24`. |
| 11 | `skills/cad-context/SKILL.md:27` | `cadence-core/workflows/context.md:1` |
| 11 | `skills/cad-plan/SKILL.md:26` | `cadence-core/workflows/plan.md:1`; gaps branch at `cadence-core/workflows/plan.md:33` loads `cadence-core/workflows/plan-gaps.md`. |
| 12 | `v3.7.12:skills/cad-execute/SKILL.md:25` | `cadence-core/workflows/execute.md:1`; current entry instead uses MCP at `skills/cad-execute/SKILL.md:12`. |
| 12 | `skills/cad-task/SKILL.md:24` | `cadence-core/workflows/task.md:1` |
| 13 | `skills/cad-verify/SKILL.md:28` | `cadence-core/workflows/verify.md:1`; loads `cadence-core/workflows/verify-sweep.md` at `cadence-core/workflows/verify.md:24` and `cadence-core/workflows/verify-deep.md` at `cadence-core/workflows/verify.md:133`. |
| 13, coverage fold | `skills/cad-coverage/SKILL.md:26` | `cadence-core/workflows/coverage.md:1` |
| 13, review alias | `skills/cad-decision-review/SKILL.md:34` | `cadence-core/workflows/decision-review.md:1` |
| 13, review alias | `skills/cad-minimalism-review/SKILL.md:32` | `cadence-core/workflows/minimalism-review.md:1` |
| 13, review alias | `skills/cad-plan-review/SKILL.md:27` | No separate workflow load: the skill itself resolves the target and reads `cadence-core/references/review-triggers.md` at `skills/cad-plan-review/SKILL.md:38`. |
| 13 | `skills/cad-audit/SKILL.md:30` | `cadence-core/workflows/audit.md:1` |

The merged `cad-review <target>` is the ROADMAP's future surface. The frozen
three entries above have different behavior; the detailed disagreement is
recorded below.
Sources: `.planning/ROADMAP.md:972`,
`skills/cad-decision-review/SKILL.md:43`,
`skills/cad-minimalism-review/SKILL.md:46`,
`skills/cad-plan-review/SKILL.md:37`.

## Phase 11: planning intake

### cad-new-project

Arguments: `--research` and `--brief <file>`. A missing brief stops with
"No brief at <path>." An existing PROJECT stops with the progress command.
Without a brief, the opening is "What do you want to build?"; with one, it
reads back settled material and asks only what remains open.
Sources: `cadence-core/workflows/new-project.md:18`,
`cadence-core/workflows/new-project.md:26`,
`cadence-core/workflows/new-project.md:36`,
`cadence-core/workflows/new-project.md:227`.

Writes: git initialization; trace-ignore rules; template config and forge
answers; delegated global/repo role settings; PROJECT; optional RESEARCH
(agent, with coordinator fallback); REQUIREMENTS; ROADMAP and revisions;
STATE through `planning.mjs cursor set`. Exact destinations and write lines
are in the consolidated table.
Sources: `cadence-core/workflows/new-project.md:38`,
`cadence-core/workflows/new-project.md:42`,
`cadence-core/workflows/new-project.md:56`,
`cadence-core/workflows/new-project.md:66`,
`cadence-core/workflows/new-project.md:159`,
`cadence-core/workflows/new-project.md:308`,
`cadence-core/workflows/new-project.md:347`,
`cadence-core/workflows/new-project.md:364`,
`cadence-core/workflows/new-project.md:415`,
`cadence-core/workflows/new-project.md:443`,
`cadence-core/workflows/new-project.md:473`,
`cadence-core/workflows/new-project.md:483`.

Asks: forge/provider, repository and conditional Forgejo host; optional
private repository creation when origin is absent; role-cost interview;
PROJECT readiness; feature categories and omissions; requirement confirmation;
roadmap approval/adjust/full-file. Prints config destination/defaults, forge
refusal reason/hint, research failure if any, the full requirement list,
roadmap and measured counts, then initialized name/files/commits and
`/cad-context 1`.
Sources: `cadence-core/workflows/new-project.md:96`,
`cadence-core/workflows/new-project.md:170`,
`cadence-core/workflows/new-project.md:292`,
`cadence-core/workflows/new-project.md:384`,
`cadence-core/workflows/new-project.md:419`,
`cadence-core/workflows/new-project.md:460`,
`cadence-core/workflows/new-project.md:497`.

References used: ask-user for interviews; spawn-agent for research;
git-guard for docs commits; req-traceability for leaving rows unseeded;
roadmap-phases for lazy directory naming. Roles delegate to config's
interview, which also reads risk-surface definitions.
Sources: `cadence-core/workflows/new-project.md:107`,
`cadence-core/workflows/new-project.md:334`,
`cadence-core/workflows/new-project.md:319`,
`cadence-core/workflows/new-project.md:446`,
`cadence-core/workflows/new-project.md:491`,
`cadence-core/workflows/config.md:409`.

Known limit: optional generic research has "NO runaway bound at all", unlike
the owned rung agents. This is explicitly recorded as deliberate. Setup also
contradicts its own "Create nothing outside the canonical .planning/ set"
guardrail by writing .gitignore and the global role layer.
Sources: `cadence-core/workflows/new-project.md:352`,
`cadence-core/workflows/new-project.md:357`,
`cadence-core/workflows/new-project.md:527`,
`cadence-core/workflows/new-project.md:45`,
`cadence-core/workflows/new-project.md:69`.

### cad-adopt

No argument is advertised. It refuses an existing PROJECT, a non-repository,
or a subdirectory of the Git root. It surveys code/history inline and asks
only gaps in that evidence, including remaining work and the proposed next
version. It creates no reconstructed completed phases.
Sources: `skills/cad-adopt/SKILL.md:4`,
`cadence-core/workflows/adopt.md:19`,
`cadence-core/workflows/adopt.md:155`,
`cadence-core/workflows/adopt.md:178`,
`cadence-core/workflows/adopt.md:246`,
`cadence-core/workflows/adopt.md:280`.

Writes: .gitignore via `planning.mjs trace ignore`; template config,
forge answers and delegated role settings; PROJECT, REQUIREMENTS, ROADMAP
and revisions; STATE via `cursor set`. No research worker. One docs commit
when enabled. Prints survey shape/stack/purpose/release, config receipt,
forge refusals, roadmap/counts and adopted name/files/commit/next command.
Sources: `cadence-core/workflows/adopt.md:40`,
`cadence-core/workflows/adopt.md:61`,
`cadence-core/workflows/adopt.md:143`,
`cadence-core/workflows/adopt.md:173`,
`cadence-core/workflows/adopt.md:232`,
`cadence-core/workflows/adopt.md:256`,
`cadence-core/workflows/adopt.md:276`,
`cadence-core/workflows/adopt.md:317`,
`cadence-core/workflows/adopt.md:326`,
`cadence-core/workflows/adopt.md:344`,
`cadence-core/workflows/adopt.md:351`.

References used: ask-user for forge, remaining scope, version and approval;
req-traceability for bare headers; roadmap-phases for directory grammar;
git-guard for the commit. Config Roles uses risk-surface definitions.
Sources: `cadence-core/workflows/adopt.md:90`,
`cadence-core/workflows/adopt.md:205`,
`cadence-core/workflows/adopt.md:247`,
`cadence-core/workflows/adopt.md:268`,
`cadence-core/workflows/adopt.md:332`,
`cadence-core/workflows/adopt.md:339`,
`cadence-core/workflows/config.md:409`.

Known mismatch inside the workflow: "Nothing outside the canonical
.planning/ set is created" and "never ask config questions" coexist with
.gitignore creation and the explicit forge/role interviews.
Sources: `cadence-core/workflows/adopt.md:377`,
`cadence-core/workflows/adopt.md:380`,
`cadence-core/workflows/adopt.md:40`,
`cadence-core/workflows/adopt.md:54`.

### cad-phase

Arguments: `add [description] | insert <N> | remove <N> | edit <N>`.
Add gathers name/description/criteria and writes the list/detail plus a
cursor rewrite preserving the previous phase/status/next. Edit changes only
ROADMAP. Insert/remove show dry-run ops, prose references and warnings;
remove also shows orphaned requirements and warns about real work. Both
require an explicit yes.
Sources: `skills/cad-phase/SKILL.md:4`,
`cadence-core/workflows/phase.md:13`,
`cadence-core/workflows/phase.md:22`,
`cadence-core/workflows/phase.md:26`,
`cadence-core/workflows/phase.md:45`.

Writes: `renumber insert/remove` moves/deletes entire phase directories and
rewrites ROADMAP, REQUIREMENTS and STATE; insert additionally authors the
new slot; the coordinator repairs prose references and reassigns orphaned
rows. Prose-reference discovery includes PROJECT as well as the other
three root documents. It sanity-checks status and commits the mutation.
Sources: `cadence-core/workflows/phase.md:36`,
`cadence-core/workflows/phase.md:39`,
`cadence-core/workflows/phase.md:42`,
`cadence-core/workflows/phase.md:54`,
`cadence-core/workflows/phase.md:58`,
`cadence-core/bin/planning/renumber.mjs:344`,
`cadence-core/workflows/phase.md:65`.

References: ask-user for confirmation and orphan disposition; git-guard
for the commit. No other named reference read is specified by this short
workflow.
Sources: `cadence-core/workflows/phase.md:15`,
`cadence-core/workflows/phase.md:35`,
`cadence-core/workflows/phase.md:58`,
`cadence-core/workflows/phase.md:67`.

Live bug GH-259: "renumber insert shifts Phase K tokens and phases/K/
paths inside COMPLETED shipped requirement rows, not only live ones."
The implementation shifts the whole REQUIREMENTS text, and its dry-run
change count is based on orphaned removals, not insert shifts. Failed apply
"leaves the tree partly renumbered - the seam is not transactional".
Sources: `.planning/ROADMAP.md:886`,
`cadence-core/bin/planning/renumber.mjs:300`,
`cadence-core/bin/planning/renumber.mjs:312`,
`cadence-core/bin/planning/renumber.mjs:358`,
`cadence-core/workflows/phase.md:62`.

### cad-context

Argument: optional phase, else cursor, else "Which phase?". Missing roadmap
or absent phase stops. Existing CONTEXT asks regather/leave. Priors include
PROJECT, REQUIREMENTS, up to three prior CONTEXTs and three prior SUMMARY
deviation sections; current requirements/roadmap beat stale prior decisions.
Sources: `cadence-core/workflows/context.md:24`,
`cadence-core/workflows/context.md:29`,
`cadence-core/workflows/context.md:40`,
`cadence-core/workflows/context.md:53`,
`cadence-core/workflows/context.md:63`.

Asks separately whether to buy the analyzer and whether the phase fits a
plan. Between them: foundational forks, unclear assumptions, research gaps,
decision confirmation/corrections, optional requirement-row correction and
criterion confirmation. Prints proposed decisions, skipped/failed analyzer
explanation, measured overrun, then counts/file/commit and `/cad-plan N`.
Sources: `cadence-core/workflows/context.md:110`,
`cadence-core/workflows/context.md:147`,
`cadence-core/workflows/context.md:200`,
`cadence-core/workflows/context.md:210`,
`cadence-core/workflows/context.md:224`,
`cadence-core/workflows/context.md:267`,
`cadence-core/workflows/context.md:292`,
`cadence-core/workflows/context.md:311`,
`cadence-core/workflows/context.md:350`,
`cadence-core/workflows/context.md:377`.

Writes: CONTEXT, at most one user-approved REQUIREMENTS row, STATE through
`cursor set`, analyzer routing/dispatch and `trace close` events. The
config-migration branch inherited through spawn-agent can also write config.
Sources: `cadence-core/workflows/context.md:271`,
`cadence-core/workflows/context.md:334`,
`cadence-core/workflows/context.md:361`,
`cadence-core/workflows/context.md:154`,
`cadence-core/workflows/context.md:183`,
`cadence-core/references/seam-spawn-agent.md:284`.

References: recall for result rendering; spawn-agent for analyzer dispatch;
conventions for scratch text; acceptance-criteria for stable AC links;
git-guard for docs commit. Ask-user is named throughout. review-triggers is
a negative wiring reference: "No review trigger fires here".
Sources: `cadence-core/workflows/context.md:105`,
`cadence-core/workflows/context.md:155`,
`cadence-core/workflows/context.md:179`,
`cadence-core/workflows/context.md:290`,
`cadence-core/workflows/context.md:368`,
`cadence-core/workflows/context.md:40`,
`cadence-core/workflows/context.md:408`.

Recorded failure, not a newly inferred live bug: a requirement-count
threshold "orders its two phases backwards". The present spend gate uses
judgment and explicitly computes no score. The gate precedes resolve
because resolve already writes a dispatch event.
Sources: `docs/rationale/context.md:40`,
`cadence-core/workflows/context.md:129`,
`docs/rationale/context.md:46`.

### cad-plan

Arguments: optional phase, `--skip-check`, `--inline`, `--gaps`. Default
phase comes from derived status. Closed cycle, missing phase and no
unresolved UAT have named stop messages. Existing plans ask overwrite/abort;
gaps allocate a new numbered file. Inline is threshold-limited.
Sources: `cadence-core/workflows/plan.md:19`,
`cadence-core/workflows/plan.md:75`,
`cadence-core/workflows/plan.md:82`,
`cadence-core/workflows/plan.md:90`,
`cadence-core/workflows/plan-gaps.md:13`,
`cadence-core/workflows/plan-gaps.md:19`.

Writes: planner or inline PLAN; revision/checker-warning edits;
frontmatter repairs and census declarations; approved adjudicated survivors;
REQUIREMENTS Pending rows through `seed-reqs`; STATE through `cursor set`;
routing, dispatch/close and two `cite-count` outcomes; shared review
artifacts, dispositions and optional config migration.
Sources: `cadence-core/workflows/plan.md:177`,
`cadence-core/workflows/plan.md:198`,
`cadence-core/workflows/plan.md:207`,
`cadence-core/workflows/plan.md:333`,
`cadence-core/workflows/plan.md:341`,
`cadence-core/workflows/plan.md:431`,
`cadence-core/workflows/plan.md:471`,
`cadence-core/workflows/plan.md:491`,
`cadence-core/workflows/plan.md:495`,
`cadence-core/workflows/plan.md:530`,
`cadence-core/workflows/plan.md:443`,
`cadence-core/references/seam-spawn-agent.md:284`.

Asks: target/replan; oversized phase split into plans, split into phases, or
full scope; optional consult at that dead end; unresolved checker gate;
review triage/override. Prints size/byte overruns and missing census files,
routing warnings, seeding diagnostics, then plan/task counts, checker/review,
traceability, both citation counts and their missing-record states, commit
and `/cad-execute N`.
Sources: `cadence-core/workflows/plan.md:249`,
`cadence-core/workflows/plan.md:272`,
`cadence-core/workflows/plan.md:289`,
`cadence-core/workflows/plan.md:348`,
`cadence-core/workflows/plan.md:427`,
`cadence-core/workflows/plan.md:469`,
`cadence-core/workflows/plan.md:502`,
`cadence-core/workflows/plan.md:537`.

References: spawn-agent, conventions, consult, plan-revision,
review-triggers, triage-gate and git-guard; ask-user at routing/gates.
It does NOT read recall.md: it states the result shape inline.
Sources: `cadence-core/workflows/plan.md:100`,
`cadence-core/workflows/plan.md:148`,
`cadence-core/workflows/plan.md:273`,
`cadence-core/workflows/plan.md:435`,
`cadence-core/workflows/plan.md:443`,
`cadence-core/workflows/plan.md:477`,
`cadence-core/workflows/plan.md:512`,
`cadence-core/workflows/plan.md:24`,
`cadence-core/references/recall.md:8`.

Known issues: "Selecting the next free plan filename via ls before the planner
writes it is a check-then-act race"; checker and planner "both passed an
8-task plan against a ceiling of 4"; two undeclared-files refusals "were
committed rather than obeyed". The first is a declined finding; the latter
two are recorded field failures, with present count/census checks.
Sources: `.planning/DECLINED.md:252`,
`docs/rationale/plan.md:85`, `docs/rationale/plan.md:96`,
`cadence-core/workflows/plan.md:285`,
`cadence-core/workflows/plan.md:320`.

The frozen prompt says split only independent files, while its oversized
arm explicitly allows sequential plans sharing files. Both instructions
exist; this inventory does not choose between them.
Sources: `cadence-core/workflows/plan.md:177`,
`cadence-core/workflows/plan.md:253`,
`cadence-core/workflows/plan.md:267`,
`cadence-core/workflows/plan.md:573`.

## Phase 12: execution and tasks

### cad-execute

Frozen arguments: phase and `--rerun`; status always runs, even with an
explicit phase. Plan order is numeric. `replay-check` supplies the dispatch
set; replay/completed stops precede guard, trace anchor and dispatch.
Outstanding gap plans dispatch even when the phase derives executed.
Sources: `cadence-core/workflows/execute.md:15`,
`cadence-core/workflows/execute.md:25`,
`cadence-core/workflows/execute.md:35`,
`cadence-core/workflows/execute.md:55`,
`cadence-core/workflows/execute.md:74`.

Writes: executor source changes and reports/rotations; optional host
settings merge; risk-fix PLAN lease amendment; worktree planning-file copy;
SUMMARY; correction on a refuted CONTEXT D-NN; CAPTURE debt section via
`debt-harvest`; STATE via `cursor set`; trace events and shared review,
adjudication, deferred and filing records.
Sources: `cadence-core/workflows/execute.md:195`,
`cadence-core/workflows/execute.md:236`,
`cadence-core/workflows/execute.md:380`,
`cadence-core/workflows/execute.md:384`,
`cadence-core/workflows/execute.md:464`,
`cadence-core/workflows/execute.md:513`,
`cadence-core/workflows/execute.md:520`,
`cadence-core/workflows/execute.md:545`,
`cadence-core/workflows/execute.md:556`,
`cadence-core/workflows/execute.md:583`,
`v3.7.12:skills/cad-executor-contract/SKILL.md:62`,
`v3.7.12:skills/cad-executor-contract/SKILL.md:253`.

Report progression: rewrite PARTIAL after each task commit, COMPLETE only
after a green full suite; persistent checkpoint on unresolved suite failure.
A risk-fix continuation instead appends its fix row without rotating.
Sources: `v3.7.12:skills/cad-executor-contract/SKILL.md:89`,
`v3.7.12:skills/cad-executor-contract/SKILL.md:114`,
`v3.7.12:skills/cad-executor-contract/SKILL.md:120`,
`cadence-core/workflows/execute.md:380`.

Asks: branch/base, staged-work stash/commit/abort, worktree settings fix,
structural/human/decision/blocked checkpoint answers, continuation versus
stop after a partial/unusable return, review triage or override and optional
structural consult. Suite-red dispatches continuation without an ask.
Prints routing/refusal/collision evidence, review findings
or in-flight paths, then goal verdict first, plans, commit range, deviations,
open items and `/cad-verify N`.
Sources: `cadence-core/workflows/execute.md:110`,
`cadence-core/workflows/execute.md:127`,
`cadence-core/workflows/execute.md:173`,
`cadence-core/workflows/execute.md:195`,
`cadence-core/workflows/execute.md:309`,
`cadence-core/workflows/execute.md:316`,
`cadence-core/workflows/execute.md:418`,
`cadence-core/workflows/execute.md:448`,
`cadence-core/workflows/execute.md:455`,
`cadence-core/workflows/execute.md:597`.

References: git-guard, spawn-agent, conventions, risk-surface,
review-triggers, triage-gate, consult; execute-parallel on opt-in;
worktree-executor through the worker contract. The frozen executor also
reads lean-build. Config workflow supplies accepted settings-merge rules.
Sources: `cadence-core/workflows/execute.md:112`,
`cadence-core/workflows/execute.md:211`,
`cadence-core/workflows/execute.md:274`,
`cadence-core/workflows/execute.md:379`,
`cadence-core/workflows/execute.md:413`,
`cadence-core/workflows/execute.md:434`,
`cadence-core/workflows/execute.md:451`,
`cadence-core/workflows/execute.md:470`,
`cadence-core/workflows/execute.md:494`,
`v3.7.12:skills/cad-executor-contract/SKILL.md:63`,
`cadence-core/workflows/execute.md:199`.

Known limits: report-based replay cannot see an unmerged worktree report;
completed commits without SUMMARY still derive planned; a clean index
cannot distinguish the user's unstaged edits inside declared files.
Cross-repo PHASE_START/review/goal checks observe the planning repo rather
than the code repo.
Sources: `docs/rationale/execute.md:31`,
`docs/rationale/execute.md:56`,
`docs/rationale/execute.md:67`,
`cadence-core/workflows/execute.md:117`.

### cad-task

Arguments: description and `--plan`; missing description asks one sentence.
Scope is inline, planned (also selected automatically for multi-step work),
or too big. Too-big routes from status to phase-add or names both bootstrap
doors on no planning root. Guard runs only for work that proceeds.
Sources: `cadence-core/workflows/task.md:16`,
`cadence-core/workflows/task.md:24`,
`cadence-core/workflows/task.md:29`,
`cadence-core/workflows/task.md:60`.

Writes: source changes; optional task PLAN plus Outcome; optional executor
report/rotation; RECORD via `task-record`; task trace anchor, dispatch,
risk-check/skip, record outcome and close; conditional risk-surface config;
planned-task review/adjudication and unfixed-finding dispositions. No STATE
or task SUMMARY. A treeless plan remains in context.
Sources: `cadence-core/workflows/task.md:82`,
`cadence-core/workflows/task.md:121`,
`cadence-core/workflows/task.md:132`,
`cadence-core/workflows/task.md:141`,
`cadence-core/workflows/task.md:173`,
`cadence-core/workflows/task.md:188`,
`cadence-core/workflows/task.md:263`,
`cadence-core/workflows/task.md:299`,
`cadence-core/workflows/task.md:322`,
`cadence-core/workflows/task.md:365`,
`cadence-core/references/triage-gate.md:334`.

The fresh-context executor is an exception to in-context planned execution.
Its non-phase directory disables the frozen phase lease; this is the SAME
executor contract's conditional, not a distinct task-executor contract.
Inline risk FAIL stays with the user. Exact review-home conflicts on the
treeless arm remain noted under limits below.
Sources: `cadence-core/workflows/task.md:136`,
`cadence-core/workflows/task.md:275`,
`v3.7.12:skills/cad-executor-contract/SKILL.md:138`.

Asks: task, branch/base and unanswered risk surfaces; blocking review
consequence when reached. Prints change, commits, files, risk disposition
plus recorded/unrecorded reason, and RECORD path only when written.
An absent-root write failure may still report done; other write failures
withhold done. There is no next-step menu.
Sources: `cadence-core/workflows/task.md:17`,
`cadence-core/workflows/task.md:67`,
`cadence-core/workflows/task.md:180`,
`cadence-core/workflows/task.md:208`,
`cadence-core/workflows/task.md:331`.

References: git-guard; conventions for scratch payloads; risk-surface for
detection/one-time config; review-triggers; review-record for task home;
triage-gate for bounded re-arm; spawn-agent for the planned exception.
A frozen executor additionally reads lean-build.
Sources: `cadence-core/workflows/task.md:68`,
`cadence-core/workflows/task.md:101`,
`cadence-core/workflows/task.md:184`,
`cadence-core/workflows/task.md:198`,
`cadence-core/workflows/task.md:266`,
`cadence-core/workflows/task.md:272`,
`cadence-core/workflows/task.md:139`,
`v3.7.12:skills/cad-executor-contract/SKILL.md:63`.

Recorded issue: the completion rule equates trace ENOENT with absence,
although the declined finding says "ENOENT can also result from a
broken/dangling .planning symlink". Too-big numbering uses a snapshot:
"total + 1 is only a snapshot, not a phase number resolved for the subsequent
add operation." Neither declined entry establishes a later fix.
Sources: `cadence-core/workflows/task.md:214`,
`.planning/DECLINED.md:272`, `.planning/DECLINED.md:45`,
`cadence-core/workflows/task.md:35`.

## Phase 13: verification and audit

### cad-verify

Arguments: optional phase, `--sweep`, `--deep`; default cursor, else ask.
Sweep prints phase status/UAT counts and open failures, then offers a
ranked resume target, another phase or stop. Deep is explicitly requestable;
workflow.verifier=false disables it. Otherwise first-session dispatch
depends on the resolved risk floor.
Sources: `cadence-core/workflows/verify.md:22`,
`cadence-core/workflows/verify-sweep.md:16`,
`cadence-core/workflows/verify-sweep.md:25`,
`cadence-core/workflows/verify.md:107`.

Writes: UAT via `uat init/refresh/record/merge`; worker-authored
verifier-findings; seam-authored FINDINGS; user-approved source fixes;
risk/review/disposition records; trace verifier brackets and UAT verdict;
ROADMAP and REQUIREMENTS via `phase-done`, and STATE via `cursor set`
on complete only.
Sources: `cadence-core/workflows/verify.md:44`,
`cadence-core/workflows/verify.md:99`,
`cadence-core/workflows/verify.md:182`,
`cadence-core/workflows/verify.md:238`,
`cadence-core/workflows/verify-deep.md:11`,
`cadence-core/workflows/verify-deep.md:38`,
`cadence-core/workflows/verify-deep.md:54`,
`cadence-core/workflows/verify.md:274`,
`cadence-core/workflows/verify.md:284`,
`cadence-core/workflows/verify.md:325`,
`cadence-core/workflows/verify.md:333`,
`cadence-core/workflows/verify.md:345`.

User surface: announce resumed counts; execute/cite machine checks and print
one results table; ask only remaining human checks as plain-text "what
happened", never severity or pass/fail buttons. Failures ask apply,
re-plan or leave open. Completion prints pass/fail/skipped/blocked,
auto/model counts, rework, open failures, outstanding CAPTURE entries and
one resume/next suggestion.
Sources: `cadence-core/workflows/verify.md:38`,
`cadence-core/workflows/verify.md:168`,
`cadence-core/workflows/verify.md:189`,
`cadence-core/workflows/verify.md:201`,
`cadence-core/workflows/verify.md:270`,
`cadence-core/workflows/verify.md:333`,
`cadence-core/workflows/verify.md:357`.

References: acceptance-criteria for criterion identity; spawn-agent for
verifier; conventions for evidence/answers; review-triggers and triage-gate
for diagnoses/fixes; git-guard and risk-surface for staged fixes; ask-user
for phase, human walk and fix choices.
Sources: `cadence-core/workflows/verify.md:75`,
`cadence-core/workflows/verify.md:118`,
`cadence-core/workflows/verify.md:178`,
`cadence-core/workflows/verify.md:260`,
`cadence-core/workflows/verify.md:268`,
`cadence-core/workflows/verify.md:277`,
`cadence-core/references/review-triggers.md:354`,
`cadence-core/workflows/verify.md:28`,
`cadence-core/workflows/verify.md:214`.

Known gap: "blocked is terminal" and the combination of pending-only next,
name-dedup refresh, fail-only reset and completion refusal leaves a blocked
phase "permanently out of reach of Complete". A manual `uat record` repair
is a separate command capability; the workflow provides no blocked-item
walk branch.
Sources: `docs/rationale/verify.md:40`,
`cadence-core/workflows/verify.md:161`,
`cadence-core/workflows/verify.md:247`,
`cadence-core/bin/planning/uat.mjs:214`.

### cad-coverage, folded into verify

Argument: optional phase, else highest complete phase, else executed.
Unplanned/planned and closed-cycle cases stop. Reads requirement IDs,
CONTEXT, plan frontmatter, SUMMARY/range and tests. Prints covered/gap map,
asks approval for target tests, writes approved tests, runs them and reports
closed/remaining gaps. A miswritten red test may be repaired; a real code
defect routes to debug. Commits generated tests.
Sources: `cadence-core/workflows/coverage.md:11`,
`cadence-core/workflows/coverage.md:21`,
`cadence-core/workflows/coverage.md:44`,
`cadence-core/workflows/coverage.md:47`,
`cadence-core/workflows/coverage.md:54`,
`cadence-core/workflows/coverage.md:62`,
`cadence-core/workflows/coverage.md:71`.

Direct writes are the user-approved project's test files, not a coverage
report file. References explicitly used are ask-user for the gap plan and
git-guard for commit; the guard's inherited risk reference is covered below.
Sources: `cadence-core/workflows/coverage.md:50`,
`cadence-core/workflows/coverage.md:55`,
`cadence-core/workflows/coverage.md:73`,
`cadence-core/references/git-guard.md:123`.

Known coverage-tool gap in this repository, not a demonstrated failure of
this command: COV-02 remains deferred; the decline says skim's test walks
bin and bin/lib only, leaving planning modules uncovered, "Nothing fails
today". These sources do not report a live cad-coverage workflow defect.
Sources: `.planning/REQUIREMENTS.md:633`,
`.planning/DECLINED.md:131`, `.planning/DECLINED.md:137`.

### cad-decision-review, review alias

Argument: decision-document path plus the specific D-NN/Key Decisions row;
missing/ambiguous asks, missing decision stops. Resolves configured voices,
refutes once, then grounds objections against docs/code and rules
survives/partial/refuted. A clean return instead grounds the decision's
own load-bearing claims.
Sources: `skills/cad-decision-review/SKILL.md:38`,
`cadence-core/workflows/decision-review.md:20`,
`cadence-core/workflows/decision-review.md:43`,
`cadence-core/workflows/decision-review.md:100`,
`cadence-core/workflows/decision-review.md:119`.

Writes trace dispatch/close and provider telemetry; does not persist its
amendments or modify the decision. Prints each ruling, citations and concrete
amendment, reviewers/models/call count and qualitative cost. Its specialist
ruling is prose, distinct from shared adjudication-record rulings.
Sources: `cadence-core/workflows/decision-review.md:54`,
`cadence-core/workflows/decision-review.md:63`,
`cadence-core/workflows/decision-review.md:80`,
`cadence-core/workflows/decision-review.md:141`,
`cadence-core/workflows/decision-review.md:155`,
`cadence-core/workflows/decision-review.md:179`,
`cadence-core/references/seam-review-provider.md:48`.

References: ask-user, spawn-agent, conventions, review-triggers' reviewer
selection and the call-review-provider seam. Context7 is a tool dependency
of main-model grounding, not a repo reference file. The base reviewer ignores
roles.cad-reviewer.model; specialist tier/effort reach providers only.
Sources: `cadence-core/workflows/decision-review.md:22`,
`cadence-core/workflows/decision-review.md:43`,
`cadence-core/workflows/decision-review.md:51`,
`cadence-core/workflows/decision-review.md:57`,
`cadence-core/workflows/decision-review.md:69`,
`cadence-core/workflows/decision-review.md:77`,
`cadence-core/workflows/decision-review.md:104`.

Known shared provider defects are quoted below. The "No file was edited"
checklist is narrower in practice than no permanent writes: this workflow
explicitly appends the trace.
Sources: `cadence-core/workflows/decision-review.md:204`,
`cadence-core/workflows/decision-review.md:54`.

### cad-minimalism-review, review alias

Argument: file, directory or phase number. A phase resolves the SUMMARY
commit range; missing/ambiguous asks once, unresolved stops without widening.
One base reviewer hunts unnecessary working code, returns severity-ranked
findings and receives no routing resolution or provider arm.
Sources: `cadence-core/workflows/minimalism-review.md:24`,
`cadence-core/workflows/minimalism-review.md:31`,
`cadence-core/workflows/minimalism-review.md:36`,
`cadence-core/workflows/minimalism-review.md:50`,
`cadence-core/workflows/minimalism-review.md:79`.

Writes only its trace dispatch/close among named permanent workflow files.
No target edit, no persisted delete-list, no commit. Prints the reviewer's
unchanged file/line/claim/failure_scenario ordered by severity; zero findings
names the read target, unusable dispatch reports no list.
Sources: `cadence-core/workflows/minimalism-review.md:76`,
`cadence-core/workflows/minimalism-review.md:90`,
`cadence-core/workflows/minimalism-review.md:98`,
`cadence-core/workflows/minimalism-review.md:102`,
`cadence-core/workflows/minimalism-review.md:120`.

References: ask-user; spawn-agent for deferred reads/dispatch; conventions
for file transport; review-triggers for backend/schema; triage-gate only as
an analogy about user choice, not a fire or settlement. "No gate and no
verdict" contradicts the ROADMAP's three-workflows-all-adjudicate premise.
Sources: `cadence-core/workflows/minimalism-review.md:32`,
`cadence-core/workflows/minimalism-review.md:46`,
`cadence-core/workflows/minimalism-review.md:73`,
`cadence-core/workflows/minimalism-review.md:10`,
`cadence-core/workflows/minimalism-review.md:123`,
`cadence-core/workflows/minimalism-review.md:15`,
`.planning/ROADMAP.md:972`.

### cad-plan-review, review alias

Argument: phase number (all PLAN slices), PLAN path, or current cursor.
Ambiguity asks; no plan reports and stops. Calls the ordinary plan trigger,
honors configured gate and presents findings/PASS-FAIL/grounded survivors.
Never auto-applies plan changes.
Sources: `skills/cad-plan-review/SKILL.md:28`,
`skills/cad-plan-review/SKILL.md:37`,
`skills/cad-plan-review/SKILL.md:46`.

Permanent writes are inherited from that trigger: routing/lifecycle/provider
trace, advisory REVIEW, or deferred REVIEW/queue, or settled adjudication
and filing/decline records. The target PLAN remains unchanged.
Sources: `skills/cad-plan-review/SKILL.md:38`,
`cadence-core/references/review-triggers.md:26`,
`cadence-core/references/review-triggers.md:170`,
`cadence-core/references/triage-gate.md:9`,
`cadence-core/references/review-triggers.md:265`,
`cadence-core/references/triage-gate.md:334`,
`skills/cad-plan-review/SKILL.md:48`.

References: review-triggers explicitly read; ask-user on ambiguous cursor;
conventions for batched resolution; all trigger references below transitively.
The skill calls the default "adjudicated"; the shared gate procedure says
"advisory" with a risk floor. That is frozen-tree disagreement.
Sources: `skills/cad-plan-review/SKILL.md:32`,
`skills/cad-plan-review/SKILL.md:35`,
`skills/cad-plan-review/SKILL.md:38`,
`skills/cad-plan-review/SKILL.md:40`,
`cadence-core/references/review-triggers.md:44`.

### cad-audit

Argument: optional milestone, otherwise active requirements. Runs
`planning.mjs audit` and `criteria-coverage`; milestone selection filters
the requirement result, not the criterion breaks. Reports scope/count,
version, requirement->phase->plan->verified table, dropped/orphan/drift
and criterion lists, PASS/FAIL and concrete repair actions. It makes no
permanent workflow-file writes and never repairs status itself.
Sources: `cadence-core/workflows/audit.md:4`,
`cadence-core/workflows/audit.md:12`,
`cadence-core/workflows/audit.md:19`,
`cadence-core/workflows/audit.md:45`,
`cadence-core/workflows/audit.md:51`,
`cadence-core/workflows/audit.md:54`,
`cadence-core/workflows/audit.md:66`,
`cadence-core/workflows/audit.md:206`.

References: req-traceability for IDs/status; plan-frontmatter for dropped
payload diagnostics; acceptance-criteria for AC/UAT link semantics.
AskUserQuestion is allowed by the skill but the workflow specifies no ask
step. No spawn/review-provider seam is invoked.
Sources: `cadence-core/workflows/audit.md:9`,
`cadence-core/workflows/audit.md:29`,
`cadence-core/workflows/audit.md:64`,
`skills/cad-audit/SKILL.md:5`,
`cadence-core/workflows/audit.md:15`,
`cadence-core/workflows/audit.md:210`.

Known blind spot stated by the workflow: duplicate AC IDs use first occurrence,
so the second criterion is "left unproven with the gate green"; duplicate
and unnumbered criteria must be reported but remain additive. Unparseable
active IDs can also remain outside counts and verdict.
Sources: `cadence-core/workflows/audit.md:136`,
`cadence-core/workflows/audit.md:181`,
`cadence-core/workflows/audit.md:199`.

## Consolidated permanent-write inventory

**112 documented write routes across 35 destination families.** Of these,
13 routes describe project source or Git-managed storage; 99 describe
the remaining file destinations. This is a census of the cited routes below,
not a predicted write count for a run. Conditional writes count; scratch
files do not. Audit has no row because its procedure is read-only
(`cadence-core/workflows/audit.md:4`).

The table is sorted by destination spelling. A structural tree move is one
route even though it moves every child file; its per-file cardinality depends
on the phase being removed or shifted
(`cadence-core/workflows/phase.md:36`,
`cadence-core/workflows/phase.md:54`). Table rows exceed the prose wrap to
keep each path, actor and citation together.

| File path / destination family | Invoking skill(s) | Mechanism and write evidence |
|---|---|---|
| `.claude/settings.json` | `cad-execute` | Accepted worktree.baseRef merge; `cadence-core/workflows/execute.md:195`, `cadence-core/workflows/execute.md:199`. |
| `.git/** (Git-managed storage)` | `cad-new-project`, `cad-adopt`, `cad-phase`, `cad-context`, `cad-plan`, `cad-execute`, `cad-task`, `cad-verify`, `cad-coverage` | Initialization/origin for new-project (`cadence-core/workflows/new-project.md:38`, `cadence-core/workflows/new-project.md:190`); commits at `cadence-core/workflows/new-project.md:324`, `cadence-core/workflows/adopt.md:344`, `cadence-core/workflows/phase.md:66`, `cadence-core/workflows/context.md:369`, `cadence-core/workflows/plan.md:511`, `cadence-core/workflows/execute.md:577`, `cadence-core/workflows/task.md:124`, `cadence-core/workflows/verify.md:299`, `cadence-core/workflows/coverage.md:72`. Git chooses internal paths; no object-level census is specified. |
| `.gitignore` | `cad-new-project`, `cad-adopt`, `cad-execute`, `cad-task` | `planning.mjs trace ignore` at `cadence-core/workflows/new-project.md:42`, `cadence-core/workflows/adopt.md:40`; writer `cadence-core/bin/planning/trace.mjs:311`. Executor can ignore generated output at `v3.7.12:skills/cad-executor-contract/SKILL.md:148`; callers `cadence-core/workflows/execute.md:210`, `cadence-core/workflows/task.md:139`. |
| `.planning/CAPTURE.md` | `cad-execute` | `planning.mjs debt-harvest --root .`, rewrites Debt markers only; `cadence-core/workflows/execute.md:545`; destination/writer `cadence-core/bin/planning/debt-harvest.mjs:93`, `cadence-core/bin/planning/debt-harvest.mjs:114`. |
| `.planning/DECLINED.md` | `cad-plan`, `cad-execute`, `cad-task`, `cad-verify`, `cad-plan-review` | Unfixed-review dispositions through `issue-filing.mjs file`; `cadence-core/references/triage-gate.md:285`, `cadence-core/references/triage-gate.md:337`; destination/writer `cadence-core/bin/issue-filing.mjs:510`, `cadence-core/bin/issue-filing.mjs:558`. Fire sites: `cadence-core/workflows/plan.md:443`, `cadence-core/workflows/execute.md:412`, `cadence-core/workflows/task.md:197`, `cadence-core/workflows/verify.md:260`, `skills/cad-plan-review/SKILL.md:37`. |
| `.planning/FILED.md` | `cad-plan`, `cad-execute`, `cad-task`, `cad-verify`, `cad-plan-review` | Accepted or unconfirmed filing mirrors, `issue-filing.mjs file`; same fire sites as DECLINED; `cadence-core/references/triage-gate.md:337`, `cadence-core/references/triage-gate.md:348`, `cadence-core/bin/issue-filing.mjs:509`, `cadence-core/bin/issue-filing.mjs:558`. |
| `.planning/PROJECT.md` | `cad-new-project`, `cad-adopt`, `cad-phase` | Direct authoring `cadence-core/workflows/new-project.md:308`, `cadence-core/workflows/adopt.md:232`; phase prose-reference repairs `cadence-core/workflows/phase.md:42`, `cadence-core/workflows/phase.md:59`, with PROJECT in returned references at `cadence-core/bin/planning/renumber.mjs:344`. |
| `.planning/REQUIREMENTS.md` | `cad-new-project`, `cad-adopt`, `cad-phase`, `cad-context`, `cad-plan`, `cad-verify` | Direct creation `cadence-core/workflows/new-project.md:415`, `cadence-core/workflows/adopt.md:256`; renumber/orphan repair `cadence-core/workflows/phase.md:36`, `cadence-core/workflows/phase.md:58` (`cadence-core/bin/planning/renumber.mjs:429`); approved row correction `cadence-core/workflows/context.md:271`; `planning.mjs seed-reqs` at `cadence-core/workflows/plan.md:491` / `cadence-core/bin/planning/seed-reqs.mjs:95`; `phase-done` at `cadence-core/workflows/verify.md:333` / `cadence-core/bin/planning/phase-done.mjs:149`. |
| `.planning/ROADMAP.md` | `cad-new-project`, `cad-adopt`, `cad-phase`, `cad-verify` | Direct creation/revision `cadence-core/workflows/new-project.md:443`, `cadence-core/workflows/new-project.md:473`, `cadence-core/workflows/adopt.md:276`, `cadence-core/workflows/adopt.md:317`; CRUD `cadence-core/workflows/phase.md:16`, `cadence-core/workflows/phase.md:23`, `cadence-core/workflows/phase.md:39`, `cadence-core/workflows/phase.md:54`; `renumber` writer `cadence-core/bin/planning/renumber.mjs:428`; `phase-done` box write `cadence-core/workflows/verify.md:333`, `cadence-core/bin/planning/phase-done.mjs:148`. |
| `.planning/STATE.md` | `cad-new-project`, `cad-adopt`, `cad-phase`, `cad-context`, `cad-plan`, `cad-execute`, `cad-verify` | `planning.mjs cursor set`: `cadence-core/workflows/new-project.md:483`, `cadence-core/workflows/adopt.md:326`, `cadence-core/workflows/phase.md:17`, `cadence-core/workflows/context.md:361`, `cadence-core/workflows/plan.md:495`, `cadence-core/workflows/execute.md:556`, `cadence-core/workflows/execute.md:564`, `cadence-core/workflows/verify.md:345`; writer `cadence-core/bin/planning/cursor-set.mjs:149`. Renumber also writes at `cadence-core/bin/planning/renumber.mjs:430`; hand repairs at `cadence-core/workflows/phase.md:42`. |
| `.planning/config.json` | `cad-new-project`, `cad-adopt`, `cad-context`, `cad-plan`, `cad-execute`, `cad-task`, `cad-verify`, `cad-plan-review` | Template copies and forge `config.mjs set`: `cadence-core/workflows/new-project.md:56`, `cadence-core/workflows/new-project.md:159`, `cadence-core/workflows/adopt.md:41`, `cadence-core/workflows/adopt.md:143`; role diffs `cadence-core/workflows/config.md:310`; inherited retired-key migration uses `set`/`unset stakes` at `cadence-core/references/seam-spawn-agent.md:284`, `cadence-core/workflows/config.md:475`, `cadence-core/workflows/config.md:479`; risk surface answer `cadence-core/references/risk-surface.md:131` (task treeless exception `cadence-core/workflows/task.md:188`). |
| `.planning/phases/<N>/** (structural paths)` | `cad-phase`, `cad-execute` | `planning.mjs renumber insert/remove`: move directory trees/delete removed phase; `cadence-core/workflows/phase.md:36`, `cadence-core/workflows/phase.md:54`, `cadence-core/bin/planning/renumber.mjs:394`, `cadence-core/bin/planning/renumber.mjs:420`, `cadence-core/bin/planning/renumber.mjs:425`. Execute may copy the phase tree into an incomplete worktree at `cadence-core/workflows/execute.md:468`. |
| `.planning/phases/<N>/ADJUDICATION-<trigger>-<discriminator>[-rN].json` | `cad-plan`, `cad-execute`, `cad-verify`, `cad-plan-review` | `planning.mjs adjudication`, blocking/adjudicated settlement; `cadence-core/references/review-triggers.md:265`, `cadence-core/references/review-record.md:119`, `cadence-core/references/review-record.md:133`; writer `cadence-core/bin/planning/adjudication.mjs:225`; same phase fire sites as DECLINED. |
| `.planning/phases/<N>/CONTEXT.md` | `cad-context`, `cad-execute` | Creation/regather `cadence-core/workflows/context.md:334`; append correction on refuted D-NN `cadence-core/workflows/execute.md:520`. |
| `.planning/phases/<N>/DEFERRED-<trigger>-<discriminator>[-rN].json` | `cad-plan`, `cad-execute`, `cad-plan-review` | `planning.mjs deferred record` at `cadence-core/references/triage-gate.md:19`; name `cadence-core/bin/lib/deferred-queue.mjs:75`; writer `cadence-core/bin/planning/deferred-record.mjs:119`; triggers `cadence-core/workflows/plan.md:443`, `cadence-core/workflows/execute.md:412`, `skills/cad-plan-review/SKILL.md:37`. |
| `.planning/phases/<N>/FINDINGS.json` | `cad-verify` | `planning.mjs uat merge` overwrites merge counts/rejected/skipped entries; `cadence-core/workflows/verify-deep.md:38`, `cadence-core/workflows/verify-deep.md:54`; writer `cadence-core/bin/planning/uat.mjs:499`. |
| `.planning/phases/<N>/PLAN.md or PLAN-<k>.md` | `cad-plan`, `cad-execute` | Planner/inline/revision/gap writes `cadence-core/workflows/plan.md:177`, `cadence-core/workflows/plan.md:198`, `cadence-core/workflows/plan.md:207`, `cadence-core/workflows/plan-gaps.md:26`; census/frontmatter repairs `cadence-core/workflows/plan.md:333`, `cadence-core/workflows/plan.md:341`; checker warnings `cadence-core/workflows/plan.md:431`; approved survivor edits `cadence-core/workflows/plan.md:471`; risk-fix lease amendment `cadence-core/workflows/execute.md:384`. |
| `.planning/phases/<N>/REVIEW-<trigger>[-<discriminator>][-rN].md` | `cad-plan`, `cad-execute`, `cad-verify`, `cad-plan-review` | Advisory reviewer Bash heredoc, `cadence-core/references/review-triggers.md:170`, `skills/cad-reviewer-contract/SKILL.md:114`; direct settled risk survivors `cadence-core/references/risk-surface.md:183`; direct deferred findings `cadence-core/references/triage-gate.md:10`. Callers `cadence-core/workflows/plan.md:443`, `cadence-core/workflows/execute.md:412`, `cadence-core/workflows/verify.md:292`, `skills/cad-plan-review/SKILL.md:37`. |
| `.planning/phases/<N>/SUMMARY.md` | `cad-execute` | Coordinator aggregates all plan reports and goal assessment; `cadence-core/workflows/execute.md:513`. |
| `.planning/phases/<N>/UAT.md` | `cad-verify` | `planning.mjs uat init` / `refresh` / `record` / `merge`: `cadence-core/workflows/verify.md:99`, `cadence-core/workflows/verify.md:44`, `cadence-core/workflows/verify.md:182`, `cadence-core/workflows/verify.md:238`, `cadence-core/workflows/verify.md:250`, `cadence-core/workflows/verify.md:302`, `cadence-core/workflows/verify.md:304`, `cadence-core/workflows/verify-deep.md:38`; writer `cadence-core/bin/planning/uat.mjs:41`. |
| `.planning/phases/<N>/reports/plan-<k>.<attempt>.md` | `cad-execute` | Rename prior report before first write; `cadence-core/workflows/execute.md:587`, `v3.7.12:skills/cad-executor-contract/SKILL.md:253`. |
| `.planning/phases/<N>/reports/plan-<k>.md` | `cad-execute` | Executor rewrites progress/checkpoint/completion; `cadence-core/workflows/execute.md:236`, `cadence-core/workflows/execute.md:445`, `v3.7.12:skills/cad-executor-contract/SKILL.md:260`; risk-fix continuation appends at `cadence-core/workflows/execute.md:380`. |
| `.planning/phases/<N>/verifier-findings.json` | `cad-verify` | Verifier writes exact merge-input artifact; `cadence-core/workflows/verify-deep.md:11`. |
| `.planning/research/RESEARCH.md` | `cad-new-project` | Optional research worker write and coordinator fallback; `cadence-core/workflows/new-project.md:347`, `cadence-core/workflows/new-project.md:364`. |
| `.planning/tasks/<slug>/ADJUDICATION-risk_surface-<discriminator>[-rN].json` | `cad-task` | `planning.mjs adjudication --phase 0 --task <slug>`; `cadence-core/workflows/task.md:263`, `cadence-core/references/review-record.md:119`, `cadence-core/references/review-record.md:122`; writer `cadence-core/bin/planning/adjudication.mjs:225`. Planned home only in task prose. |
| `.planning/tasks/<slug>/PLAN.md` | `cad-task` | Direct plan, then appended Outcome; `cadence-core/workflows/task.md:132`, `cadence-core/workflows/task.md:141`. |
| `.planning/tasks/<slug>/RECORD.md` | `cad-task` | `planning.mjs task-record`; `cadence-core/workflows/task.md:299`; basename `cadence-core/bin/lib/task-record.mjs:51`, path/writer `cadence-core/bin/planning/task-record.mjs:128`, `cadence-core/bin/planning/task-record.mjs:167`. |
| `.planning/tasks/<slug>/REVIEW-risk_surface-<discriminator>[-rN].md` | `cad-task` | Task-specific sibling REVIEW home; `cadence-core/workflows/task.md:263`, `cadence-core/workflows/task.md:275`; shared write instruction `cadence-core/references/risk-surface.md:183`. Inline prose says it owns no review-record home at `cadence-core/workflows/task.md:266`. |
| `.planning/tasks/<slug>/reports/plan-1.<attempt>.md` | `cad-task` | Optional executor's prior-report rotation; `cadence-core/workflows/task.md:139`, `v3.7.12:skills/cad-executor-contract/SKILL.md:249`, `v3.7.12:skills/cad-executor-contract/SKILL.md:253`. |
| `.planning/tasks/<slug>/reports/plan-1.md` | `cad-task` | Optional executor report, consumed for Outcome; `cadence-core/workflows/task.md:143`, `v3.7.12:skills/cad-executor-contract/SKILL.md:260`. |
| `.planning/trace.1.jsonl` | `cad-context`, `cad-plan`, `cad-execute`, `cad-task`, `cad-verify`, `cad-decision-review`, `cad-minimalism-review`, `cad-plan-review` | Automatic prior-generation retention by every trace writer listed next; basename `cadence-core/bin/lib/trace.mjs:111`, rename/publish `cadence-core/bin/lib/trace.mjs:888`, `cadence-core/bin/lib/trace.mjs:938`. Conditional on rotation, not one write per event. |
| `.planning/trace.jsonl` | `cad-context`, `cad-plan`, `cad-execute`, `cad-task`, `cad-verify`, `cad-decision-review`, `cad-minimalism-review`, `cad-plan-review` | Routing/brackets, risk results, receipts and provider requests: `cadence-core/workflows/context.md:183`, `cadence-core/workflows/plan.md:239`, `cadence-core/workflows/plan.md:424`, `cadence-core/workflows/plan.md:530`, `cadence-core/workflows/execute.md:150`, `cadence-core/workflows/execute.md:261`, `cadence-core/workflows/execute.md:346`, `cadence-core/workflows/execute.md:359`, `cadence-core/workflows/task.md:82`, `cadence-core/workflows/task.md:160`, `cadence-core/workflows/task.md:173`, `cadence-core/workflows/task.md:322`, `cadence-core/workflows/verify.md:284`, `cadence-core/workflows/verify.md:325`, `cadence-core/workflows/verify-deep.md:19`, `cadence-core/workflows/decision-review.md:54`, `cadence-core/workflows/decision-review.md:63`, `cadence-core/workflows/minimalism-review.md:76`, `cadence-core/workflows/minimalism-review.md:90`, `skills/cad-plan-review/SKILL.md:37`; detailed subcommands below. |
| `<project source/test paths selected by the task or approved fix>` | `cad-execute`, `cad-task`, `cad-verify`, `cad-coverage` | Project-owned source, not operational records: executor implementation `v3.7.12:skills/cad-executor-contract/SKILL.md:62`; task inline/planned `cadence-core/workflows/task.md:121`, `cadence-core/workflows/task.md:136`; approved UAT fixes `cadence-core/workflows/verify.md:274`; generated/repaired tests `cadence-core/workflows/coverage.md:55`, `cadence-core/workflows/coverage.md:65`. Exact paths depend on input. |
| `~/.claude/cadence/config.json (or CADENCE_GLOBAL_CONFIG)` | `cad-new-project`, `cad-adopt`, `cad-context`, `cad-plan`, `cad-execute`, `cad-task`, `cad-verify`, `cad-plan-review` | Delegated first-run `config.mjs set --global` at `cadence-core/workflows/new-project.md:66`, `cadence-core/workflows/adopt.md:61`, `cadence-core/workflows/config.md:294`, `cadence-core/workflows/config.md:300`; inherited migration `cadence-core/references/seam-spawn-agent.md:284`, `cadence-core/workflows/config.md:475`, `cadence-core/workflows/config.md:480`. |
| `~/.claude/settings.json` | `cad-execute` | Alternative accepted host worktree.baseRef merge; `cadence-core/workflows/execute.md:195`, `cadence-core/workflows/execute.md:199`. |

### Helper side effects and destination qualifications

The trace row includes these distinct producers; none creates a second
trace destination:

- `planning.mjs trace append` and `trace close`: workflow lifecycle,
  checkpoint/escalation, no-commit skip and UAT outcomes. The phase executor
  also reaches `lease-check`'s commit-time `census_undeclared` append;
  plan-time lease checking does not append this event.
  Sources: `cadence-core/workflows/execute.md:150`,
  `cadence-core/workflows/execute.md:261`,
  `cadence-core/workflows/execute.md:280`,
  `cadence-core/workflows/execute.md:346`,
  `cadence-core/workflows/verify.md:325`,
  `v3.7.12:skills/cad-executor-contract/SKILL.md:135`,
  `cadence-core/bin/planning/lease-check.mjs:465`,
  `cadence-core/bin/planning/lease-check.mjs:476`.
- `route.mjs resolve`: routing outcome and optional lifecycle dispatch
  through `--bracket-read`; review fires resolve even when the provider is
  the only reviewer.
  Sources: `cadence-core/bin/route.mjs:852`,
  `cadence-core/bin/route.mjs:1367`,
  `cadence-core/references/review-triggers.md:26`.
- `planning.mjs cite-count --point planned|committed`: the two plan
  citation measurements append their own outcomes.
  Sources: `cadence-core/workflows/plan.md:365`,
  `cadence-core/workflows/plan.md:527`,
  `cadence-core/workflows/plan.md:530`.
- `planning.mjs risk-check run`: detection receipt, including no matches;
  `task-record`: additional task-record outcome beside RECORD.md.
  Sources: `cadence-core/references/risk-surface.md:14`,
  `cadence-core/references/risk-surface.md:18`,
  `cadence-core/bin/planning/task-record.mjs:210`.
- `review-provider.mjs review|consult`: provider request/outcome/usage.
  Consult is reachable at plan-too-big and execute-structural checkpoints.
  Sources: `cadence-core/bin/review-provider.mjs:591`,
  `cadence-core/bin/review-provider.mjs:604`,
  `cadence-core/references/consult.md:41`,
  `cadence-core/references/consult.md:61`.
- Settlement `trace append` events: adjudication, gate_pass, override,
  rearm and deferral. Each carries the documented range/worker identity.
  Sources: `cadence-core/references/review-record.md:17`,
  `cadence-core/references/triage-gate.md:102`,
  `cadence-core/references/triage-gate.md:120`,
  `cadence-core/references/triage-gate.md:212`,
  `cadence-core/references/triage-gate.md:25`.

The trace writer appends directly, can rotate to trace.1.jsonl, and uses
temporary/claim files during rotation. Those implementation scratch files
are not permanent records. Likewise, atomicWrite uses a sibling temporary
file and rename; it explicitly promises no fsync.
Sources: `cadence-core/bin/lib/trace.mjs:1204`,
`cadence-core/bin/lib/trace.mjs:888`,
`cadence-core/bin/lib/trace.mjs:1066`,
`cadence-core/bin/lib/trace.mjs:1090`,
`cadence-core/bin/lib/planning-files.mjs:2749`,
`cadence-core/bin/lib/planning-files.mjs:2788`.

ADJUDICATION and DEFERRED helper destinations use `fireHome`, rather than
an unconditional phase path. The helper supports carried records in
`.planning/deferred/<N>/`; task adjudication uses its explicit slug home.
These are alternate homes for the table's corresponding family, not a second
write on every fire. The command surfaces in this inventory do not themselves
perform milestone carry/prune.
Sources: `cadence-core/bin/planning/adjudication.mjs:149`,
`cadence-core/bin/planning/adjudication.mjs:156`,
`cadence-core/bin/planning/deferred-record.mjs:80`,
`cadence-core/references/review-record.md:122`,
`cadence-core/references/risk-surface.md:210`.

The reviewer files are not uniformly Markdown prose: advisory REVIEW stores
the same JSON object the reviewer returns. Risk survivors and deferred
findings use that JSON shape too. Findings input and merge accounting have
different names and different writers.
Sources: `cadence-core/references/review-triggers.md:172`,
`cadence-core/references/risk-surface.md:183`,
`cadence-core/references/triage-gate.md:12`,
`cadence-core/workflows/verify-deep.md:54`.

Task's inline/treeless promises conflict with unconditional shared filing:
task says it creates no planning tree and has no review-record home, while
`issue-filing.mjs file` creates .planning before mirroring dispositions.
The files do not establish a consistent reachable behavior for every
treeless review/filing outcome. The table records the concrete writer, with
that uncertainty, rather than asserting every treeless run is write-free.
Sources: `cadence-core/workflows/task.md:266`,
`cadence-core/workflows/task.md:374`,
`cadence-core/references/triage-gate.md:285`,
`cadence-core/bin/issue-filing.mjs:519`.

The git-guard reference has a generic commit-time risk fire, even for callers
absent from the review wiring table. Context explicitly forbids a review
fire. Thus guard reachability for bootstrap/phase/context/coverage is
inconsistent; their hypothetical review side effects are not silently added
to the counted routes. Their directly specified writes remain counted.
Sources: `cadence-core/references/git-guard.md:123`,
`cadence-core/references/review-triggers.md:318`,
`cadence-core/references/review-triggers.md:320`,
`cadence-core/workflows/context.md:408`,
`cadence-core/workflows/coverage.md:73`.

Ambient host observation is separate from a skill's write procedure.
The read-trace hook can append `.planning/reads.jsonl` and rotate
`.planning/reads.1.jsonl`; SubagentStop can write trace closes/cache facts.
These hook-owned writes are not charged to each read-only command in the
route count. They remain real v3 permanent stores; the ROADMAP explicitly
retires the reads log and both observation hooks.
Sources: `cadence-core/bin/read-trace.mjs:52`,
`cadence-core/bin/lib/read-trace.mjs:47`,
`cadence-core/bin/lib/read-trace.mjs:93`,
`cadence-core/bin/lib/read-trace.mjs:1112`,
`cadence-core/references/seam-spawn-agent.md:166`,
`.planning/ROADMAP.md:74`, `.planning/ROADMAP.md:80`.

## Shared machinery and reference reads

Names in the per-skill lists above expand to the full paths here. A
reference mentioned only to deny a behavior is marked as such; it is not
counted as executing that procedure. Templates remain separate from
references: PROJECT/REQUIREMENTS/ROADMAP, CONTEXT, PLAN and SUMMARY are read
at the authoring sites already cited.
Sources: `cadence-core/workflows/context.md:408`,
`cadence-core/workflows/new-project.md:307`,
`cadence-core/workflows/new-project.md:414`,
`cadence-core/workflows/new-project.md:443`,
`cadence-core/workflows/context.md:335`,
`cadence-core/workflows/plan.md:177`,
`cadence-core/workflows/execute.md:513`.

| Reference | Purpose | Documented users in these clusters |
|---|---|---|
| `cadence-core/references/seam-ask-user.md:3` | Host binding for structured choices and free-text answers. | new-project `cadence-core/workflows/new-project.md:107`; adopt `cadence-core/workflows/adopt.md:90`; phase `cadence-core/workflows/phase.md:35`; context `cadence-core/workflows/context.md:40`; plan `cadence-core/workflows/plan.md:24`; execute `cadence-core/workflows/execute.md:130`; task via guard `cadence-core/workflows/task.md:67`; verify `cadence-core/workflows/verify.md:214`; coverage `cadence-core/workflows/coverage.md:51`; decision review `cadence-core/workflows/decision-review.md:22`; minimalism `cadence-core/workflows/minimalism-review.md:32`; plan review `skills/cad-plan-review/SKILL.md:32`. |
| `cadence-core/references/seam-spawn-agent.md:3` | Host dispatch, routing, worker return/bracket, read handoff. | new-project `cadence-core/workflows/new-project.md:334`; context `cadence-core/workflows/context.md:155`; plan `cadence-core/workflows/plan.md:100`; execute `cadence-core/workflows/execute.md:211`; task `cadence-core/workflows/task.md:139`; verify/deep `cadence-core/workflows/verify-deep.md:7`; decision review `cadence-core/workflows/decision-review.md:57`; minimalism `cadence-core/workflows/minimalism-review.md:79`; plan review via `skills/cad-plan-review/SKILL.md:38`, `cadence-core/references/review-triggers.md:7`. |
| `cadence-core/references/seam-review-provider.md:3` | Provider review/consult call and structured degradation. | plan/execute via consult or review, task/verify/plan-review via review, decision-review directly; `cadence-core/references/consult.md:41`, `cadence-core/references/review-cross-model.md:22`, `cadence-core/workflows/decision-review.md:77`; fire sites in write table. |
| `cadence-core/references/conventions.md:86` | Config reads, scratch/file transport, path and orchestration conventions. | context `cadence-core/workflows/context.md:179`; plan `cadence-core/workflows/plan.md:148`; execute `cadence-core/workflows/execute.md:274`; task `cadence-core/workflows/task.md:101`; verify `cadence-core/workflows/verify.md:178`; decision review `cadence-core/workflows/decision-review.md:51`; minimalism `cadence-core/workflows/minimalism-review.md:73`; plan review `skills/cad-plan-review/SKILL.md:35`. |
| `cadence-core/references/git-guard.md:6` | Branch/base/integration guard and commit rail. | new-project `cadence-core/workflows/new-project.md:319`; adopt `cadence-core/workflows/adopt.md:339`; phase `cadence-core/workflows/phase.md:67`; context `cadence-core/workflows/context.md:368`; plan `cadence-core/workflows/plan.md:512`; execute `cadence-core/workflows/execute.md:112`; task `cadence-core/workflows/task.md:68`; verify `cadence-core/workflows/verify.md:300`; coverage `cadence-core/workflows/coverage.md:73`. |
| `cadence-core/references/git-publish.md:1` | Publish rail and guard coverage; no push operation added by these references. | Linked by the shared guard at `cadence-core/references/git-guard.md:3`, `cadence-core/references/git-guard.md:94`; its callers above. |
| `cadence-core/references/review-triggers.md:17` | Gate, artifact, reviewer selection, provider arm, combine and consequence. | plan `cadence-core/workflows/plan.md:443`; execute `cadence-core/workflows/execute.md:412`; task `cadence-core/workflows/task.md:198`; verify `cadence-core/workflows/verify.md:260`; plan review `skills/cad-plan-review/SKILL.md:38`. Decision review uses selection only at `cadence-core/workflows/decision-review.md:43`; minimalism cites the backend at `cadence-core/workflows/minimalism-review.md:10`; context cites absence of wiring at `cadence-core/workflows/context.md:408`. |
| `cadence-core/references/review-cross-model.md:1` | Build provider payload, execute provider and degrade/fallback. | Transitive for ordinary review callers above, loaded at `cadence-core/references/review-triggers.md:227`. Decision review spells its own provider call at `cadence-core/workflows/decision-review.md:80`. |
| `cadence-core/references/reviewer-brief.md:1` | Shared stance, severity and finding schema in provider prompt. | Ordinary cross-model review callers, through `cadence-core/references/review-cross-model.md:35`, `cadence-core/references/review-cross-model.md:57`. |
| `cadence-core/references/review-record.md:58` | Per-voice exact-text rulings, range identity and persistence. | Ordinary plan/execute/task/verify/plan-review fires, loaded at `cadence-core/references/review-triggers.md:269`; task home explicitly at `cadence-core/workflows/task.md:266`. |
| `cadence-core/references/triage-gate.md:3` | Advisory/deferred/blocking/adjudicated consequences, one re-arm, user triage, filing/decline. | Ordinary review callers via `cadence-core/references/review-triggers.md:300`; direct re-reads at `cadence-core/workflows/plan.md:477`, `cadence-core/workflows/execute.md:434`, `cadence-core/workflows/task.md:272`, `cadence-core/workflows/verify.md:268`. Minimalism cites only the user-choice analogy at `cadence-core/workflows/minimalism-review.md:123`. |
| `cadence-core/references/risk-surface.md:10` | Detection categories, one-time surface answer, risk result and survivor persistence. | execute/task/verify detection or review through `cadence-core/references/review-triggers.md:354`; direct task pointer `cadence-core/workflows/task.md:184`; bootstrap role-cost interviews via `cadence-core/workflows/config.md:409`; generic guard pointer has the inconsistency recorded above. |
| `cadence-core/references/consult.md:30` | User-approved second-provider angles at a dead end. | plan too-big `cadence-core/workflows/plan.md:273`; execute structural checkpoint `cadence-core/workflows/execute.md:451`. |
| `cadence-core/references/recall.md:16` | Ranked, bounded results and prompt rendering. | context `cadence-core/workflows/context.md:105`. Plan calls the same machinery but does not read this reference (`cadence-core/references/recall.md:8`). |
| `cadence-core/references/req-traceability.md:1` | Active IDs, seeded rows and completion authority. | new-project `cadence-core/workflows/new-project.md:446`; adopt `cadence-core/workflows/adopt.md:268`; audit `cadence-core/workflows/audit.md:9`. Plan implements seeding inline at `cadence-core/workflows/plan.md:499`. |
| `cadence-core/references/acceptance-criteria.md:1` | Stable AC identity, UAT provenance and coverage. | context `cadence-core/workflows/context.md:290`; verify `cadence-core/workflows/verify.md:75`; audit `cadence-core/workflows/audit.md:64`. |
| `cadence-core/references/plan-frontmatter.md:1` | Plan frontmatter grammar and payload-dropping diagnostics. | audit explicitly `cadence-core/workflows/audit.md:29`, `cadence-core/workflows/audit.md:135`. |
| `cadence-core/references/roadmap-phases.md:1` | Phase spelling/directory identity. | new-project `cadence-core/workflows/new-project.md:491`; adopt `cadence-core/workflows/adopt.md:332`; linked from shared conventions at `cadence-core/references/conventions.md:22` and frontmatter at `cadence-core/references/plan-frontmatter.md:283`. |
| `cadence-core/references/plan-revision.md:3` | One fresh planner revision and narrowed checker return. | plan only, loaded at `cadence-core/workflows/plan.md:435`. |
| `cadence-core/references/execute-parallel.md:3` | Opt-in batch dispatch, serialized merges and post-merge review. | execute only, loaded at `cadence-core/workflows/execute.md:494`. |
| `cadence-core/references/worktree-executor.md:1` | Worktree plan assertion, branch restrictions and report transport. | execute worker only, `v3.7.12:skills/cad-executor-contract/SKILL.md:234`; task forbids worktrees at `cadence-core/workflows/task.md:364`. |
| `cadence-core/references/lean-build.md:1` | Lean implementation under the task's verification contract. | execute and optional task executor through `v3.7.12:skills/cad-executor-contract/SKILL.md:62`. |
| `cadence-core/references/seams.md:1` | Router naming the host bindings. | Linked from shared conventions at `cadence-core/references/conventions.md:265`; not an additional workflow procedure. |

Ask-user, spawn-agent, conventions, git-guard and ordinary review machinery
have consumers in all three clusters. Config is also shared: both bootstrap
commands delegate role intake, while routing consumers can enter its
retired-key migration. This states the existing fan-in only.
Sources: `cadence-core/workflows/new-project.md:66`,
`cadence-core/workflows/adopt.md:61`,
`cadence-core/references/seam-spawn-agent.md:284`,
and the cited caller matrix above.

## Other recorded defects and historical findings

Labels below preserve source status. A declined fingerprint is a recorded
machine claim, not proof that its finding remains live; DECLINED explicitly
distinguishes those from human decisions.
Source: `.planning/DECLINED.md:15`.

- Shared risk range, GH-229: ROADMAP calls out a "HEAD..HEAD range" recorded
  as a clean completed check. REQUIREMENTS marks RNG-05 and RSK-10 Complete
  in v3.7.11; frozen execute/task already skip the no-commit range. The
  ROADMAP's live defect is the underlying helper capability, not absence
  of those workflow skip arms.
  Sources: `.planning/ROADMAP.md:687`,
  `.planning/REQUIREMENTS.md:544`,
  `.planning/REQUIREMENTS.md:545`,
  `cadence-core/workflows/execute.md:338`,
  `cadence-core/workflows/task.md:154`.
- Shared settlement, GH-248: "receipts are stored ref-only and require a
  head/base pair while a staged record has no head". Verify fixes use that
  staged path. This is listed as a commit-rail issue, not new phase-13 work.
  Sources: `.planning/ROADMAP.md:691`,
  `cadence-core/workflows/verify.md:284`,
  `cadence-core/references/risk-surface.md:33`.
- Shared routing, GH-256: explicit role-effort null is treated "as unset"
  and falls through to the legacy key, contrary to the schema contract.
  It affects routing consumers and the role-intake output; ROADMAP assigns
  it to config/routing.
  Sources: `.planning/ROADMAP.md:721`,
  `cadence-core/workflows/config.md:398`,
  `cadence-core/references/seam-spawn-agent.md:129`.
- Shared provider accounting: GH-237 "zeroes one invalid Gemini output
  component when the other is usable"; GH-239 "exits on non-2xx before
  extracting usage"; GH-240 "accepts any finite nonnegative number, summed
  without a checked bound". Ordinary review callers and decision-review
  consume the provider seam.
  Sources: `.planning/ROADMAP.md:314`,
  `.planning/ROADMAP.md:315`, `.planning/ROADMAP.md:316`,
  `cadence-core/references/review-triggers.md:203`,
  `cadence-core/workflows/decision-review.md:80`.
- Shared filing: GH-250 "refuses on the local FILED read before forge
  resolution"; GH-251 "leaves GitLab lookup unmeasured and space-joins
  fingerprints". These sit under review disposition, not under the
  specialist minimalism or decision-review outputs.
  Sources: `.planning/ROADMAP.md:317`,
  `.planning/ROADMAP.md:318`,
  `cadence-core/references/triage-gate.md:334`,
  `cadence-core/workflows/minimalism-review.md:113`,
  `cadence-core/workflows/decision-review.md:165`.
- Trace validation, GH-241: "accepts any nonempty observed effort string,
  whitespace included". This is a shared trace issue, assigned to phase 3.
  Source: `.planning/ROADMAP.md:310`.
- Verify close, CAP-04/GH-122: "review findings no longer reach CAPTURE.md,
  but /cad-capture bullets have no drain at all". The declined account
  reports 32 surviving items and a capture-bullet/adjudication-payload
  mismatch. Current verify prints the list after closing; it is not a gate
  and does not itself file or remove those captures.
  Sources: `.planning/REQUIREMENTS.md:636`,
  `.planning/DECLINED.md:159`, `.planning/DECLINED.md:165`,
  `.planning/DECLINED.md:167`,
  `cadence-core/workflows/verify.md:333`.
- Plan checker: the declined phase-3 decision says "The gate passed phase 2
  PLAN-1 Task 1" with an impossible current-phase assertion, then a false
  crash-atomicity decision. It concludes "hardening the gate itself is not
  scheduled work". This is a recorded decline, not authority to add work.
  Sources: `.planning/DECLINED.md:78`,
  `.planning/DECLINED.md:80`.
- Parser backlog PRS-01 records frontmatter "dropping and fabricating",
  quoting/trailing-text, comment/CRLF and fence-boundary cases. Its wording
  calls them real but unhit. It also includes an unseeded-table issue that
  the current audit workflow explicitly handles at any row count; the
  deferred paragraph is not a reliable statement that every listed case
  remains unfixed.
  Sources: `.planning/REQUIREMENTS.md:609`,
  `cadence-core/workflows/audit.md:29`,
  `cadence-core/workflows/audit.md:87`.
- Reference-router check, declined GH-139: "outsideFences toggles a boolean
  on any fence line without tracking the delimiter's type or run length".
  The source calls this a latent correctness gap and says Cadence's own
  reference files do not currently nest fences.
  Sources: `.planning/DECLINED.md:208`,
  `.planning/DECLINED.md:246`.
- Config migration has declined `unset` claims: a dotted key can select a
  different nested property; reserialization can corrupt unrelated numeric
  values. This inventory records those claims without asserting a runtime
  reproduction. The migration does invoke unset.
  Sources: `.planning/DECLINED.md:278`,
  `.planning/DECLINED.md:279`,
  `cadence-core/workflows/config.md:479`.
- Execute replay/gap GH-179 is historical in the frozen workflow:
  status-only refusal "made /cad-plan --gaps unreachable end to end".
  The current frozen condition includes the empty dispatch-set term; the
  gap writer uses a fresh filename. It is not inventoried as still absent.
  Sources: `cadence-core/workflows/execute.md:65`,
  `cadence-core/workflows/plan-gaps.md:26`.
- Task treeless completion GH-246 is marked Complete in v3.7.11. The
  frozen workflow includes its two allowed completion states; the separate
  ENOENT ambiguity above remains a declined finding, not evidence that
  the original no-tree completion fix never shipped.
  Sources: `.planning/REQUIREMENTS.md:546`,
  `cadence-core/workflows/task.md:212`,
  `.planning/DECLINED.md:272`.

## Proven artifact ordering

- Bootstrap PROJECT precedes optional research and requirement extraction.
  Both bootstrap doors produce ROADMAP before the initial cursor; context
  refuses absent ROADMAP. Planning consumes the project's root documents.
  Sources: `cadence-core/workflows/new-project.md:337`,
  `cadence-core/workflows/new-project.md:372`,
  `cadence-core/workflows/new-project.md:479`,
  `cadence-core/workflows/adopt.md:322`,
  `cadence-core/workflows/context.md:29`,
  `cadence-core/workflows/plan.md:169`.
- Context is an optional producer of decisions/criteria for plan, not a
  mandatory predecessor. Plan reads it if present and otherwise uses
  ROADMAP; verify also has a PLAN/ROADMAP fallback.
  Sources: `cadence-core/workflows/context.md:12`,
  `cadence-core/workflows/plan.md:77`,
  `cadence-core/workflows/verify.md:55`.
- PLAN exists before plan checker, plan review and seed-reqs. Seeding reads
  PLAN requirements, adds only active IDs and always starts Pending.
  Therefore bootstrap leaves headers empty; it cannot seed before plans.
  Sources: `cadence-core/workflows/plan.md:408`,
  `cadence-core/workflows/plan.md:443`,
  `cadence-core/workflows/plan.md:499`,
  `cadence-core/workflows/adopt.md:267`.
- Execute requires plan files. Report completion controls replay selection;
  the SUMMARY aggregates every plan report, including skipped completed
  plans. The report must exist before continuation or aggregation can read
  its task/commit evidence.
  Sources: `cadence-core/workflows/execute.md:29`,
  `cadence-core/workflows/execute.md:35`,
  `cadence-core/workflows/execute.md:87`,
  `cadence-core/workflows/execute.md:236`,
  `cadence-core/workflows/execute.md:480`,
  `cadence-core/workflows/execute.md:513`.
- Gap planning consumes unresolved UAT plus existing plans and summaries,
  writes a new plan number, and returns to execution through that outstanding
  plan. This is a demonstrated loop, not a strictly one-way phase lifecycle.
  Sources: `cadence-core/workflows/plan-gaps.md:10`,
  `cadence-core/workflows/plan-gaps.md:26`,
  `cadence-core/workflows/plan-gaps.md:41`,
  `cadence-core/workflows/execute.md:65`.
- SUMMARY deviations and corrected CONTEXT decisions feed later context
  intake; phase/plan ordering can therefore carry engineering corrections
  through these authored artifacts. The intake read is bounded to three.
  Sources: `cadence-core/workflows/execute.md:520`,
  `cadence-core/workflows/context.md:55`,
  `cadence-core/workflows/context.md:57`.
- Verify creates/refreshes UAT before deep dispatch. The verifier writes
  verifier-findings before merge; merge writes UAT/FINDINGS, and diagnosis
  later reads the original findings for missing/why_human details.
  Sources: `cadence-core/workflows/verify.md:96`,
  `cadence-core/workflows/verify.md:103`,
  `cadence-core/workflows/verify-deep.md:11`,
  `cadence-core/workflows/verify-deep.md:38`,
  `cadence-core/workflows/verify-deep.md:54`,
  `cadence-core/workflows/verify.md:254`.
- Plan seeds Pending; complete verification checks ROADMAP and advances
  REQUIREMENTS; audit joins those artifacts to PLAN and separately joins
  CONTEXT ACs to UAT. Partial verification does not make those transitions.
  Sources: `cadence-core/workflows/plan.md:499`,
  `cadence-core/workflows/verify.md:328`,
  `cadence-core/workflows/verify.md:349`,
  `cadence-core/workflows/audit.md:22`,
  `cadence-core/workflows/audit.md:48`.
- Coverage and phase-target minimalism require execution evidence:
  coverage reads SUMMARY/range and rejects unplanned/planned status;
  minimalism resolves a phase target from SUMMARY's committed range.
  Sources: `cadence-core/workflows/coverage.md:18`,
  `cadence-core/workflows/coverage.md:31`,
  `cadence-core/workflows/minimalism-review.md:28`.
- Decision review consumes a selected CONTEXT decision or PROJECT row.
  Durability names candidates but does not auto-invoke review. Manual plan
  review consumes an existing PLAN; it is not an extra required step after
  plan creation, which already fires the trigger.
  Sources: `cadence-core/workflows/decision-review.md:12`,
  `cadence-core/workflows/decision-review.md:24`,
  `skills/cad-plan-review/SKILL.md:18`,
  `skills/cad-plan-review/SKILL.md:28`.
- Review settlement consumes returned findings, writes rulings and receipts,
  and deferred recording consumes the already persisted REVIEW file.
  Execute checks risk status before reporting a plan done. These are
  internal artifact dependencies even when the user command is unchanged.
  Sources: `cadence-core/references/review-record.md:66`,
  `cadence-core/references/review-record.md:119`,
  `cadence-core/references/triage-gate.md:15`,
  `cadence-core/workflows/execute.md:398`.

## ROADMAP disagreements and undetermined boundaries

1. Phase 12 says task uses "the task executor contract, not the phase one".
   Frozen task dispatches cad-executor and explicitly cites
   cad-executor-contract. The same frozen contract disables its lease by
   directory. No separate task contract is loaded by that path.
   Sources: `.planning/ROADMAP.md:951`,
   `cadence-core/workflows/task.md:139`,
   `cadence-core/workflows/task.md:278`,
   `v3.7.12:skills/cad-executor-contract/SKILL.md:138`.

2. Phase 13 says all three review aliases "adjudicate a ruling" with
   near-identical operations. Minimalism has no gate, verdict, provider or
   adjudication, only one base reviewer and a ranked list. Decision review
   has its own prose ruling vocabulary and no automatic amendment.
   Manual plan review uses the ordinary trigger.
   Sources: `.planning/ROADMAP.md:972`,
   `cadence-core/workflows/minimalism-review.md:15`,
   `cadence-core/workflows/minimalism-review.md:79`,
   `cadence-core/workflows/decision-review.md:179`,
   `skills/cad-plan-review/SKILL.md:37`.

3. Phase 12 says to retain "intentional lockfile and report exceptions".
   The frozen lease checker says "Exactly ONE exemption, and nothing
   else": the plan's own reports. Its undeclared-path predicate contains
   no lockfile exception. The ROADMAP's phase-7 account and current native
   contract instead specify zero exemptions.
   Sources: `.planning/ROADMAP.md:958`,
   `cadence-core/bin/planning/lease-check.mjs:388`,
   `cadence-core/bin/planning/lease-check.mjs:430`,
   `.planning/ROADMAP.md:680`,
   `skills/cad-executor-contract/SKILL.md:66`.

4. Phase 12's "Today" report-rotation description is true of frozen v3,
   but not today's native executor contract, which forbids report writes.
   These are different contracts at different revisions.
   Sources: `.planning/ROADMAP.md:937`,
   `v3.7.12:skills/cad-executor-contract/SKILL.md:253`,
   `skills/cad-executor-contract/SKILL.md:22`.

5. The ROADMAP's binary-only permanent writes, merged command and MANUAL
   destination are future goals, not descriptions of frozen behavior.
   Frozen CONTEXT still writes the human-verify suffix; frozen coverage
   generates tests. These differences are explicit scope changes rather
   than evidence those old surfaces never existed.
   Sources: `.planning/ROADMAP.md:866`,
   `.planning/ROADMAP.md:917`,
   `.planning/ROADMAP.md:967`,
   `cadence-core/workflows/context.md:300`,
   `cadence-core/workflows/coverage.md:54`.

Exact source/test filenames, Git object paths, external commands' generated
build artifacts, user-selected repair edits and runtime write counts cannot
be determined from these parameterized workflows. Their destinations depend
on plans, project runners and user answers. No runner was invoked for this
inventory.
Sources: `cadence-core/workflows/task.md:120`,
`cadence-core/workflows/coverage.md:50`,
`v3.7.12:skills/cad-executor-contract/SKILL.md:111`,
`cadence-core/workflows/phase.md:58`.

The files also leave the generic guard/review reachability and treeless
filing conflicts stated above unresolved. No owner ruling is supplied here.
Sources: `cadence-core/references/git-guard.md:123`,
`cadence-core/workflows/context.md:408`,
`cadence-core/workflows/task.md:374`,
`cadence-core/bin/issue-filing.mjs:519`.
