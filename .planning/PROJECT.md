# Cadence

## What This Is

Cadence is a Claude Code plugin for phased planning and execution: roadmap →
context → plan → execute → verify, with file-based continuity in `.planning/`,
deterministic seam scripts guarding invariants, and an adversarial review
subsystem. `v2.6.1` is the current release: the four defects the `v2.6.0` doc
sweep filed are closed at their source, each with a check watched to fail against
the unpatched code first, and a budgeted surface that SHRINKS below its recorded
byte count now fails self-verify exactly like one that grows. `v2.6.0` before it
was the reconciliation cycle: the capture queue triaged from 213 open items to
28, per-role token accounting with every phase dispatch bracketed, a
runaway-loop bound on all 19 rung agents, and the first end-to-end doc sweep at
547 claims with a committed ledger. Earlier cycles: `v2.5.0` static analysis
reaching execution and plan gates that ask whether a plan is proportionate,
`v2.4.0` the parallel path that could never engage, `v2.3.0` where the bytes
live, `v2.2.0` the config read face and the deleted git-guard parser, `v2.1.0`
coverage and triage gates, `v2.0.0` the
stakes routing axis, `v1.5.0` self-description corrections, `v1.4.x` stated
grammars, `v1.3.x` flow and tech-debt passes, `v1.2.x` cross-model review
repairs, `v1.1.0` file-based memory and BM25 recall, on the `v1.0.0` planning
baseline.

## Core Value

What Cadence writes down during a project (deviations, decisions, captures,
UAT findings) must come back on its own at the moment it matters — planning,
context-gathering, and debugging — without any external memory system.

## Requirements

### Validated

- ✓ Phased planning spine (new-project / context / plan / execute / verify) — v1.0.0
- ✓ Deterministic seam scripts with tests: config, planning, route, review-provider, git-guard, self-verify (132 tests) — v1.0.0
- ✓ Write-side memory: STATE cursor, per-phase SUMMARY with deviations, CAPTURE.md (todo/seed/note), UAT.md — v1.0.0
- ✓ Self-verify drift linter in CI: config-key tokens ↔ schema, script invocations ↔ CONTRACTS table, plugin-root paths exist; README included as a linted surface — v1.0.0
- ✓ Cross-model review subsystem (plan / diff / phase_diff / pre_ship triggers, consult, detect-models) — v1.0.0
- ✓ `memory.backend` config key reserved, only `none` wired — v1.0.0
- ✓ BM25 recall over `.planning/` artifacts as a zero-dep `planning.mjs` subcommand — v1.1.0-rc.1
- ✓ `memory.backend` gains `builtin` and becomes the default; `none` turns recall off — v1.1.0-rc.1
- ✓ cad-context, cad-planner, and cad-debug inject recall results at the moment they start reasoning — v1.1.0-rc.1
- ✓ Deterministic context-weight measurement of agent/skill prose surfaces via a seam subcommand — v1.1.0-rc.1
- ✓ self-verify budget check on context weight (blocking) — v1.1.0-rc.1
- ✓ self-verify lint: agent prose references only tools declared in that agent's frontmatter (blocking) — v1.1.0-rc.1
- ✓ Two-tier git branching: per-milestone integration branch (parallel-worktree reconciliation point) + `trunk` escape hatch — v1.1.0-rc.2
- ✓ Land cleanup (`git.on_land_cleanup`) + opt-in autonomous close (`git.auto_close`), never-auto-push rail intact via the git-publish seam — v1.1.0-rc.2
- ✓ Release mechanics: manifest version bump + changelog folded into the milestone close, idempotent — v1.1.0-rc.2
- ✓ Release prep: public docs reconciled, DESIGN records the reversals, plugin-store metadata, `validate --strict` clean — v1.1.0-rc.2
- ✓ `auto_close` full close verified live end-to-end against a real remote (audit → tag → PR → merge → reset), closing the deferred Phase-2 item-6 — v1.1.0
- ✓ Final `v1.1.0` published: manifest at `1.1.0`, dated CHANGELOG entry, `v1.1.0` tag cut, community plugin-store submissions filed — v1.1.0
- ✓ Repaired the cross-model review seam: realpath run-as-script guard so `review-provider.mjs` no longer no-ops on a symlinked install, symlink regression test, empty-provider surfacing (REV-01) — v1.2.0
- ✓ `cad-planner` separation-of-concerns nudge: prefer small single-purpose tasks over a shared core, no per-phase restatement (SOC-01) — v1.2.0
- ✓ `cad-context` durable-decision filter: three-part test, `## Durable decisions` heading, recall retargeting with legacy fallback (DEC-01) — v1.2.0
- ✓ `/cad-decision-review`: on-demand refute-then-adjudicate over one decision, Context7 + codebase grounding, per-objection ruling + amendments (DEC-02) — v1.2.0
- ✓ DeepSeek cross-model review provider: Chat Completions adapter (json_object + in-prompt schema), selectable via `review.reviewers` (REV-02) — v1.2.0
- ✓ Every open bug from the post-v1.2.0 sweep triaged and fixed, no won't-fix: silent data-file failures surfaced (#39, #40, #43, #44), seam flag inputs validated before any write (#42, #45), planning parsers de-phantomed and widened (#41, #46, #47, #48), renumber and git-guard hardened (#37, #49, #50) — v1.3.1
- ✓ Plan-file frontmatter reads to exactly what is declared, byte-exact to `plan-overlap`, and every out-of-grammar input carries a named diagnostic instead of changing what was read (GRM-01) — v1.4.0
- ✓ `/cad-plan` seeds its own REQUIREMENTS traceability rows via `seed-reqs`; a worktree executor asserts its own plan file before task 1 (SPN-01) — v1.4.0
- ✓ One quote-state tokenizer drives both git-guard rails, closing the six verified rail-3 push holes plus the `eval` wrapper family (TOK-01) — v1.4.0, SUPERSEDED by TOK-02 in v2.2.0 on both halves: the tokenizer and the command-position deny gate are deleted, and the six shapes it closed are silent again as the stated cost of an anchored reader
- ✓ The roadmap phase list has a stated grammar, so an empty `## Phases` is a derived closed-milestone state and `/cad-progress` works between milestones (RDM-01) — v1.4.0
- ✓ `/cad-audit` counts an `## Active` requirement no phase picked up, so the traceability gate holds in the partially-planned state (AUD-01) — v1.4.0
- ✓ Two contracts that contradicted themselves closed by subtraction: the executor's terminal success-criteria check (#65) and `conventions.md`'s claim to reach every skill (#67) — v1.4.1
- ✓ The worktree fork point stated as `worktree.baseRef`-selectable across six surfaces, with `/cad-execute` refusing the parallel path under `fresh` (#68) — v1.5.0
- ✓ Per-trigger `effort` scoped to the backend that can honour it, rather than resolved and silently dropped on the `claude-subagent` arm (#64) — v1.5.0
- ✓ Each agent's contract stored once as a preloaded contract skill, with self-verify asserting every one resolves and is model-invocable (#74) — v1.5.0
- ✓ Effort became a dial the routing layer varies per role: each contract skill materialized at the rungs it needs, the runtime-read shim and `escalate_effort_variant` retired, a rung file carrying behaviour failing self-verify (RNG-01) — v2.0.0
- ✓ The routing axis asks what happens if the work is wrong, not what it costs: `model.profile` REPLACED by `stakes` (solo/shipped/critical), `auto` retired, no back-compat alias, refused at the write face (STK-01) — v2.0.0
- ✓ A routing cell resolves the whole quality bundle `{model, effort, review, verify}` from one readable table, with every cell's model, effort and trigger asserted by self-verify (STK-02) — v2.0.0
- ✓ The risk surface Cadence already detects sets a rung FLOOR by itself; raising is free, lowering below it is refused without an override naming the surface (STK-03) — v2.0.0
- ✓ CONTEXT acceptance criteria carry stable ids and `/cad-audit` proves coverage in both directions, so a criterion that never reached the UAT checklist fails the gate by id (ACR-01) — v2.0.0
- ✓ The remaining resolved-then-dropped config keys closed at the point of setting, with a re-runnable written-down sweep reporting zero left (CFG-01) — v2.0.0
- ✓ The plugin's documented home moved to the self-hosted Forgejo remote, GitHub retired as the published source, and the README test badge removed rather than repointed (HST-01) — v2.0.0
- ✓ A coverage gate stops being able to pass a phase it never checked: a fieldless checklist is reported rather than exempted, the seam states its plugin version, and the verifier's findings envelope is persisted beside the phase's artifacts (COV-01) — v2.1.0
- ✓ An adjudicated review's survivors are a numbered list the user triages, defaulting to NONE, at every firing site, and the reviewer contract stops pre-filtering ahead of the adjudicator (TRI-02) — v2.1.0
- ✓ A trigger's reviewers dispatch concurrently in one message, and `review.max_prompt_tokens` bounds the paid call before it is sent (REV-03) — v2.1.0
- ✓ The config read face merges a layer once whatever its spelling; six of the seven deferred config-reach/risk-waiver defects closed, the seventh named open (CFG-02) — v2.2.0
- ✓ The guard's parser deleted, both rails on one ~30-line anchored reader; `git.on_destructive` removed with it, accepted-cost shapes stated in the CHANGELOG (TOK-02) — v2.2.0
- ✓ The release seam refuses downgrades, promotes Unreleased into the dated heading, and requires `--version` instead of deriving from prose (REL-03) — v2.2.0
- ✓ Every shipped rung-ladder claim true or corrected; `route.mjs` `warnings[]` rides every result shape including `ok:false` (DOC-01) — v2.2.0
- ✓ Per-role effort configurable from the config layer and update-surviving; a rung the role lacks fails self-verify by key (RNG-02) — v2.2.0
- ✓ The documented install path proven live against the Forgejo remote from a fully cold state, transcripts committed in the phase record (HST-02) — v2.2.0
- ✓ Executor reports leave the orchestrator context: `cad-executor` writes `reports/plan-<k>.md` and returns a five-field digest, and the partial/timeout continuations read the FILE so a re-run cannot repeat a finished task (RES-01) — v2.3.0
- ✓ Verifier findings leave the orchestrator context, with a narrow `Write` grant (one file under `.planning/phases/<N>/`, `Edit`/`MultiEdit` still denied on all four rungs) and `uat merge` piped straight from it (RES-02) — v2.3.0
- ✓ Reviewers receive a reference, never artifact bytes: refs valid in their own tree, or `--payload <file>` with `assertUnderCap` measuring the file's contents and refusing a non-string payload first (RES-03) — v2.3.0
- ✓ `references/seams.md` states when a file round-trip is worth its extra turn, extended to cover any deferred read rather than a subagent round-trip alone (RES-04) — v2.3.0
- ✓ `references/git.md` split into `git-guard.md` (rails 1, 2, 4) and `git-publish.md` (rail 3), every citation moved with it including the ones citing rails by number (LOD-01) — v2.3.0
- ✓ The triage gate lives in its own 3.0 KB reference and its adjudicated arm is a tapped multi-select — `ceil(N/3)` questions batched four per call, NONE first and default — replacing the open-ended-prose mandate (LOD-02) — v2.3.0
- ✓ `conventions.md` stops being half-referenced: all 17 bare parentheticals in workflows inlined at their use sites, leaving it `@`-included nowhere in the plugin (LOD-03) — v2.3.0
- ✓ `/cad-config`'s catalog decided on a measured menu-vs-non-menu run count and recorded as deliberately transcribed rather than derived (LOD-04) — v2.3.0
- ✓ Every eager `@`-include judged per skill against the break-even test, with all 26 keep-or-move calls stated with their reasons (LOD-05) — v2.3.0
- ✓ The 29 skill and 19 rung-agent descriptions riding every session's system prompt cut to one routing line each — 8,550 B to 5,397 — with zero trigger words dropped and nine gained (BUD-01) — v2.3.0
- ✓ `references/**` and `templates/**` under the weight budget as 23 exact-byte entries, and both walkers fixed so one unreadable descendant hides only its own children (BUD-02) — v2.3.0

- ✓ A static-analysis path reaches execution and works unconfigured — `workflow.lint_command` across five surfaces, `detect-commands` reading the project's own manifests when it is unset, plus the `LSP` grant on both executor rungs (QW-01) — v2.5.0
- ✓ One joined `.planning/trace.jsonl` per phase carrying routing, provider, lifecycle and outcome events under a single correlation id, provably unable to change a seam envelope; every `mergeLayers` callsite surfaces its warnings or says why (QW-02) — v2.5.0
- ✓ File leases enforced at the commit step by `lease-check` rather than compared once pre-flight; `phase_diff` resolves the same through all three surfaces; lockfiles stop matching the `concurrency` risk surface (QW-03) — v2.5.0
- ✓ A version the repo already published is never presented as current — `/cad-health` names both numbers and `git-branch.mjs decide` refuses by tag membership rather than sort order (QW-04) — v2.5.0
- ✓ Every `review-provider.mjs` failure path fault-injected with a test proving what the caller sees, and drop-outs recorded before the wire rather than only past it (QW-05) — v2.5.0
- ✓ `weight.mjs resident` composes eager, reachable and dispatch bytes; `cad-land` and `cad-plan-review` stop eagerly preloading references they read at one step, with a self-verify check that a de-preloaded reference keeps a Read at the arm that needs it (CTX-01) — v2.5.0

- ✓ `v2.6.0 — the reconciliation cycle`: the capture queue triaged from 213 open items to 28 with the rest archived out of the recall corpus (REC-01, REC-02); the verify walk, the unbounded re-arm and version drift (FRI-01..03); named phase dirs, an ignored run record, `REQ_ID_EXACT` and the debt-marker harvest (FLD-01, FLD-02, PRS-02, DBT-01); per-role token accounting with every phase dispatch bracketed (TOK-03, TOK-04); and the first end-to-end doc sweep, 547 claims with a committed ledger (DOC-02, DOC-03, EVD-02) — v2.6.0
- ✓ `v3.2.0 - the controls that reported success`: a hostile repo config layer stopped reparenting the merged config and inspection stopped disagreeing with enforcement (CFG-01, CFG-02); the symlinked temp write, the gate that could not read its findings, the valueless flag and the credential-carrying failure detail all fail safe now (FSW-01, GAT-01, VAL-01, EXP-01); adjudication records kills as well as survivors and the reviewer set is resolved in the seam rather than by prose (RVW-01, RVW-02); three triggers that blocked nothing turned off or deleted, and `risk_surface` scoped to the surfaces a project has (CST-01, CST-02); the dispatch bound tuned 400 to 200 with the audit's low-severity tail deleted rather than carried (CST-03, HYG-01) - v3.2.0

### Active

`v3.5.1 - authorization the repo grants, not the user`, opened 2026-08-15.
Scoped off the Forgejo milestone, which holds three issues: #131, #179 and
#180.

**The theme is one sentence: a user-global setting can authorize an unattended
publish and merge that the stated policy says only the repository may
authorize.** `git.auto_close` is documented as repo-local by design - D-08, and
`cadence-core/bin/git-publish.mjs`'s `repoAutoClose` reads `.planning/config.json`
directly and never the merged value, exactly so a global `true` cannot speak for
a repository that never opted in. `skills/cad-land/SKILL.md` reads the same key
through `config.mjs get`, which returns the merged global-plus-repo value, and a
`true` there enters the no-prompt branch.

On GitHub and Forgejo the chain still dies at the repo-authorized publish seam.
On GitLab nothing gates it at all: `glab mr create` publishes the source branch
itself, so no seam call is made, and the workflow proceeds to `glab mr merge`.
`cadence-core/bin/land-cleanup.mjs` already records the discrepancy in its own
source, which is the shape of a known gap rather than a discovered one.

Two seams that ship today and degrade silently on this repository ride along,
both hit live during the `v3.5.0` close itself rather than found by a scan.
`milestone-prune` reads only the first physical line of a WRAPPED requirement
bullet, so every close orphans prose fragments under `## Active` and truncates
rows mid-sentence under `## Shipped`; it has been hand-repaired at three
consecutive closes, and `lib/milestone-prune.mjs`'s own header says these
surgeries were made deterministic because the hand-performed version kept
leaving a tree that failed its own audit (#179). And `issue-check.mjs` matches a
`tea` login against the host parsed off the origin URL, so this repo's
`ssh.jcrenshaw.dev` endpoint never resolves against a login keyed on
`git.jcrenshaw.dev` - which means LND-01, shipped in `v3.4.0`, has never once
produced a tracker report in the repository it was built in (#180).

The fix shape is two distinct booleans rather than one aligned value: an
`autoCloseRequested` read from the merged config, which is presentation and what
the existing gate reads, and an `autoCloseAuthorized` read from the repo layer
alone, required before any unattended external mutation on every host including
GitLab. The prior narrowing (`0b1c322`, reverted) aligned the two seams' values
and broke the skipped-ask / halt pairing `land-cleanup.mjs` depends on, so the
constraint is that this fix does not touch that pairing.

`v3.5.0 - the check that proves it ran` closed on 2026-08-15: two requirements
(`RSK-01`, `RSK-02`), one phase, 13 commits, the manifest at `3.5.0`. The only
gate live on a default install fired on a model reading a prose list and left
identical bytes whether it ran or not. `planning.mjs risk-check` is now the
executable seam: `run` answers a resolved commit range with
`{checked, categories, matches, inconclusive}` and appends that record to
`trace.jsonl` on every invocation, clean range included, so silence stopped
being evidence. `status` is the enforcement half - both `execute.md` and
`task.md` call the seam instead of reading a prose list, neither reports done
without a record, and range identity is the resolved commit pair rather than the
ref spelling. The enforcement was watched to fail against the unpatched tree
first. Detection stayed heuristic on purpose. Carried out of the cycle: the
detector self-matches its own test fixtures on six of eight categories, so the
one gate that blocks at every stakes level fires falsely on any range touching
`risk-diff.test.mjs`; and `b481fb3` plus `64900ee` are unreviewed, the capped
one-round re-arm having been spent before either existed.

`v3.4.1 - what the config says is what routing does` closed on 2026-08-15:
three requirements (`GAT-02`, `GAT-03`, `ENF-02`), one phase, 6 commits, the
manifest at `3.4.1`. Three surfaces described the review gates and nothing had
ever compared them - `config.mjs get` answered a gate from the schema default
when no layer set one, and the schema called `phase_diff` `advisory` at
`shipped` where the route table fires `off`. All four gate defaults are now the
`null` sentinel with per-level prose read off the grid, an unset gate reads back
`null` plus a warning naming `route.mjs resolve`, and `self-verify.mjs` check 18
(`gate-agreement`) compares all three surfaces and was watched to FAIL against
the unpatched tree before the fix landed. The workaround paragraph came out of
`workflows/execute.md` and `workflows/plan.md` with the defect. One gap filed
rather than papered over: the check compares the default against the cells, not
against the `null` sentinel, so a trigger whose three cells agree could regress
its default and stay green.

`v3.4.0 - the tracker enters the spine` closed on 2026-08-15: one requirement
(`LND-01`), one phase, 18 commits on the cycle branch, the manifest at
`3.4.0`. `/cad-land` step 1
now names the issues a branch's commits reference and whether each is still
open, reads the tracker without ever writing to it, and degrades in exactly one
line on all nine paths that cannot answer. The blocking `risk_surface` review
caught three real defects before the phase closed: a forge CLI's stderr riding
the envelope past a URL-only redactor, an off switch that still printed a
tracker line, and a control character in an origin hostname breaking the
one-line guarantee.

`v3.3.0 — the record you plan from` closed on 2026-08-15: five requirements
(`CAP-01`, `TRC-01`, `COR-01`, `ENF-01`, `DOC-02`), five phases, 113 commits,
the manifest at `3.3.0`, tagged `v3.3.0` and released. The theme was that the
evidence Cadence plans and reports from is itself unchecked, a queue that
silently dropped five filed items because they were appended below a heading
the recall walk does not visit, and a run record that could not join a provider
call to the fire that made it. Both are closed, and a second `/cad-docs-verify`
sweep over 32 files and 743 claims left a ledger where all 933 rows carry a run
number and a live cite with the fourteen stale claims corrected at their
source. Its five rows sit in `.planning/REQUIREMENTS.md` under `## Shipped`,
its narrative in `CHANGELOG.md`, and its phase record in
`.planning/_archive-v3.3.0/` and git history.

`v3.2.0 — the controls that reported success` closed on
2026-08-14: twelve requirements (`CFG-01`, `CFG-02`, `FSW-01`, `GAT-01`,
`EXP-01`, `VAL-01`, `RVW-01`, `RVW-02`, `CST-01`, `CST-02`, `CST-03`,
`HYG-01`), four phases, 104 commits, the audit green (12/12 traced, 0 broken;
36/36 acceptance criteria covered), the manifest at `3.2.0`. Its twelve rows
sit in `.planning/REQUIREMENTS.md` under `## Shipped`, its narrative in
`CHANGELOG.md`, and its phase record in git history at the pruning commit -
this close ran `--mode delete`, so there is no `_archive-v3.2.0/`. The merge and
the release tag both landed: `81bdb5d` is the tip of `main` and the annotated
tag `v3.2.0` points at it.

What it delivered: the controls that reported success without doing the work.
A `.planning/config.json` arriving with a clone could reparent the merged
config through `__proto__` and reach every enforcement surface, and
`config.mjs validate` returned `{"ok":true,"checked":0,"errors":[]}` over the
same file, so the tool you would use to check a config was the one thing blind
to the attack. `atomicWrite` wrote through a symlinked temp path. The
unattended-close gate could not tell "no findings" from "could not read the
findings" and returned `proceed` for both. Git failure details carried
credentials from a remote URL. Each of those now fails safe and says which
failure it saw. The review arm learned to prove itself in the same cycle: the
record distinguishes a gate that found nothing from one whose findings were all
refuted, the reviewer SET is resolved in the seam beside the gate rather than
by prose that could be skipped without a trace, and an external reviewer is
handed the same stance and severity bar as the local one. Three review triggers
that blocked nothing were turned off or deleted, `risk_surface` learned the
eight categories a project actually has, and every dispatch is bounded at 200
turns instead of a nominal 400.

Carried, not scoped into `v3.3.0`: the five deferred requirements `LND-01`
(the `/cad-land` tracker check, cut from v3.2.0 phase 4 before execution, issue
#121 still open), `PRS-01`, `EVD-01`, `RCL-06` and `CTX-02`, each still holding
its deferral reason; and two process items open since the last close -
`/cad-milestone` has no close-only arm, and that close was the fourth to
hand-write one. `### Validated` above stops at `v2.6.0`; `v2.7.0`, `v3.0.0`,
`v3.1.0` and `v3.2.0` were never added to it, so that hole is now four
milestones deep rather than three.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| BM25, not embeddings | Deterministic, zero-dep, fast on a small corpus; matches seam philosophy | ✓ Shipped v1.1.0-rc.1 |
| `memory.backend` default flips to `builtin` | The feature's value is being there without setup; `none` remains the off switch | ✓ Shipped v1.1.0-rc.1 |
| Context-weight stats live in a seam + self-verify budget check | Deterministic measurement; CI catches prose bloat mechanically, same as drift | ✓ Shipped v1.1.0-rc.1 |
| Tools-declaration lint is blocking | Same species as the config-key drift check; consistency in how the linter treats drift | ✓ Shipped v1.1.0-rc.1 |
| Recall consumers: cad-context, cad-planner, cad-debug | The three moments past knowledge changes decisions: assumptions, task breakdown, hypotheses | ✓ Shipped v1.1.0-rc.1 |
| Pre-release versioning toward v1.1.0 | v1.0.0 is public; dogfood iterations shouldn't each burn a public minor — candidates converge on one release | ✓ Adopted — `-rc.N` per iteration (rc.2 this round) |
| Integration-branch per milestone (two-tier) | The milestone branch is the reconciliation point for parallel worktrees, keeping merge churn off `main`; worktrees are the disposable tier below it | ✓ Shipped v1.1.0-rc.2 |
| Autonomous close is opt-in, never the default | Preserves cad-land's "the publish mechanism is the user's call"; `auto_close` is an explicit override that still halts on a blocking `pre_ship` FAIL | ✓ Shipped v1.1.0-rc.2 (live end-to-end run deferred to final v1.1.0) |
| Reset-to-base + pull after every land | A cycle always ends on an up-to-date `main`, so the next starts clean; removes the manual return step | ✓ Shipped v1.1.0-rc.2 |
| `v1.2.0` cut straight, no rc cycle | A small backward-compatible minor (one bug fix, two guidance nudges, one command); the rc line was for the larger v1.1.0 scope | ✓ Shipped v1.2.0 |
| A close-time fix still goes through the ship gate | An empty-roadmap fix written during the v1.3.1 close looked small, passed 340 tests, and was reverted when `pre_ship` confirmed two HIGH findings: its heuristic reported a broken roadmap as a cleanly closed milestone, and it routed users to a workflow that refuses phases absent from ROADMAP | ✗ Reverted at the v1.3.1 close; requeued as a designed phase |
| Durability is prose judgment, not a score | The three-part filter lives in cad-context workflow prose; no scoring seam, matching "prose keeps judgment, scripts keep invariants" | ✓ Shipped v1.2.0 |
| DeepSeek via json_object + in-prompt schema | DeepSeek has no server-side json_schema; the shared validate-on-return guard degrades a schema-ignoring response to bad-shape, not bad data | ✓ Shipped v1.2.0 |
| A grammar is written down, tabled, and tested per row | The four readers this cycle replaced each failed silently in BOTH directions; a stated grammar with an out-of-grammar table makes the limit a documented row instead of an accident | ✓ Shipped v1.4.0 (4 references, per-row tests) |
| Detection any-position, hard refusal command-position only | Matching a wrapper anywhere keeps `sudo bash -c "git push"` from going silent; refusing anywhere would hard-block read-only work like `rg -t sh "git commit"` and `command -v git commit`, which run nothing | ✓ Shipped v1.4.0 — costs a deny on transparent prefixes, which now ask |
| The two roadmap readers keep DIFFERENT extents | Canonical parse stops at the next `## `; classification runs to end of text, so a wiped checkbox list whose `### Phase N:` sections survive reports as an interrupted prune instead of a clean close | ✓ Shipped v1.4.0 — restoring "consistency" re-opens the false close |
| `unseeded` became verdict-breaking, reversing v1.4.0's own earlier shape | A diagnostic that never moves the verdict leaves the ship gate exactly as permeable as it was; the additive form shipped in phase 2 is what phase 5 had to undo | ✓ Shipped v1.4.0 (breaking for `total === rows.length` callers) |
| The release tag is cut after the merge, not at the close | A tag made during `/cad-milestone` names a commit on the integration branch that base never contains as a tip; publishing is `/cad-land`'s step, and the tag rides with it | ✓ Adopted at the v1.4.0 close |
| The routing axis asks stakes, not spend | "How much will you spend" is answerable but useless, and on a Max subscription it is not a question the user has; "what happens if this is wrong" is answerable in one second and is the only form a risk signal can auto-set. MANIFESTO's principle is value per dispatch — stakes is the numerator it was always reaching for | Adopted for v2.0.0 (STK-01); breaking, no alias |
| The rung ladder is one contract materialized N times, not N variants | The host freezes `effort` per agent file on the Agent/Task dispatch path, so rungs need files; the contract lives in exactly one skill and a rung file that ever carries behaviour fails self-verify. Without that check this is the GSD namespace-variant sin the MANIFESTO names | Adopted for v2.0.0 (RNG-01), on the v1.5.0 contract skills |

---
*Last updated: 2026-08-08 v2.6.0 opened from v2.5.0's carried-over half; its four phases renumbered 3-6 -> 1-4 (9 requirements, 4 phases)*
