# `/cad-docs-verify` run 2 — half B

Sweep date: 2026-08-14
HEAD sha the docs were read at: `b41821e9e6bd7f71e8c6e4a3577efc677c79481b`
Branch: `cadence/v3.3.0`

This is a FRESH extraction under `cadence-core/workflows/docs-verify.md` steps
2-4. It does not read `.planning/DOCS-CLAIMS.md` rows for extraction — the
ledger join happens in plan 3, on `doc` plus claim TEXT. The one exception is the
targeted `.mjs` pass below, which reads the ledger for its ten-row LIST only.
Per step 5 the sweep STOPS at the report: no document under
`cadence-core/workflows/` or `cadence-core/references/`, and no `.mjs` file, is
edited here.

Half A (`.planning/phases/5/docs-verify-run-2-a.md`) carries invocations 1 and 2
and its own count. Neither half states a run-2 total; plan 3 joins them.

## Invocations run in half B

### Invocation 3 — re-run byte-identical

Transcribed byte-identically from `.planning/DOCS-CLAIMS.md:30` (numbering
prefix dropped), per phase 5 D-01 — run 1's recorded invocations are re-run
unchanged so run 2's counts stay comparable against run 1's 509/18/20 = 547.

3. `/cad-docs-verify cadence-core/workflows/{new-project,phase,plan-gaps,plan,progress,spike,task,undo,verify-deep,verify,verify-sweep}.md`

### Invocation 4 — NEW surface, added this cycle

4. `/cad-docs-verify cadence-core/workflows/{adopt,minimalism-review,report,suggest}.md`

Why a FOURTH invocation rather than a widened third: run 1 swept 21 workflow
files, and `cadence-core/workflows/` now holds 25. Widening invocation 2 or 3's
glob to reach the four new files would move the surface run 1's
509 accurate / 18 stale / 20 unverifiable = 547 counts were taken over, and run
2's numbers would then be non-comparable against run 1's by construction. Adding
a separately-counted invocation keeps the re-run arm comparable and makes the
new surface visible as new (D-01). Two of these four (`report.md`, `suggest.md`)
describe the run record phase 2 of this cycle rewrote, which is why they are not
deferred to a third cycle.

Everything invocation 4 extracts is NEW claim surface: none of these four files
carries a run-1 ledger row, so their rows are NOT part of run 1's 547 and plan 3
files them under the ledger's post-run-1 section rather than into run 1's table.

### Invocation 5 — ledgered docs no invocation ever named

5. `/cad-docs-verify cadence-core/references/{config-catalog,recall,plan-revision}.md`

Why it exists: these three files carry 32 ledgered rows between them
(`config-catalog.md` 29, `recall.md` 2, `plan-revision.md` 1) and no recorded
invocation names them — run 1's extraction re-pointed claims here from the docs
that cite them. Without this invocation every one of those 32 rows would keep a
run-1 verdict whatever run 2 found, and phase success criterion 1 ("every row
carries a verdict dated this cycle") would fail by construction rather than by
oversight.

These rows are NOT new surface and are not headed as such: plan 3 joins them to
existing ledger rows on `doc` plus claim text.

D-01 is honoured — the three recorded invocation strings stay byte-identical, and
new surface is reached by ADDING a named invocation, never by widening a recorded
one. D-04 is untouched — an explicit-path invocation changes no default target
set, and `cadence-core/workflows/docs-verify.md`'s default (`README.md` plus
`docs/**` and root `*.md`) is not edited.

### Targeted `.mjs` pass — ten ledgered rows, read at the cited site

Ten ledgered rows cite a `.mjs` file rather than a doc:
`cadence-core/bin/lib/trace.mjs` (5 rows), `cadence-core/bin/planning.mjs` (4)
and `cadence-core/bin/self-verify.mjs` (1). These three total 298,480 B, and a
full extraction over them to decide ten claims is a trade this project's token
posture refuses. Each of the ten is verdicted by reading its cited SITE instead.
Not new surface.

With invocations 3, 4 and 5 plus this pass, no ledgered `doc` value is left
outside run 2's reach: half A covers the other fourteen.

## Surface

Eighteen invocation files, 137,725 B (`wc -c`, measured 2026-08-14 at the sha
above), plus the three `.mjs` files the targeted pass reads at ten cited sites
(298,480 B, not swept).

Listed as a bullet list, not a table, so that every `^| ` line in this report is
a claim row and the closing counts can be checked mechanically.

Invocation 3 — eleven files, 87,190 B:

- `cadence-core/workflows/new-project.md` — 18547 B
- `cadence-core/workflows/phase.md` — 3448 B
- `cadence-core/workflows/plan-gaps.md` — 939 B
- `cadence-core/workflows/plan.md` — 21788 B
- `cadence-core/workflows/progress.md` — 8749 B
- `cadence-core/workflows/spike.md` — 2720 B
- `cadence-core/workflows/task.md` — 6104 B
- `cadence-core/workflows/undo.md` — 3103 B
- `cadence-core/workflows/verify-deep.md` — 3706 B
- `cadence-core/workflows/verify.md` — 16823 B
- `cadence-core/workflows/verify-sweep.md` — 1263 B

Invocation 4 — four files, 35,712 B:

- `cadence-core/workflows/adopt.md` — 15627 B
- `cadence-core/workflows/minimalism-review.md` — 8009 B
- `cadence-core/workflows/report.md` — 6935 B
- `cadence-core/workflows/suggest.md` — 5141 B

Invocation 5 — three files, 14,823 B:

- `cadence-core/references/config-catalog.md` — 8542 B
- `cadence-core/references/recall.md` — 2638 B
- `cadence-core/references/plan-revision.md` — 3643 B

Targeted `.mjs` pass — three files, 298,480 B, read only at the ten cited sites:

- `cadence-core/bin/lib/trace.mjs` — 38005 B, 5 rows
- `cadence-core/bin/planning.mjs` — 191760 B, 4 rows
- `cadence-core/bin/self-verify.mjs` — 68715 B, 1 row

## Coverage checklist

Ticked only when that file's claim table is written into this report. An
unticked box at the end of the sweep means the surface was truncated, not that
the sweep agreed with itself.

- [x] cadence-core/workflows/new-project.md
- [x] cadence-core/workflows/phase.md
- [x] cadence-core/workflows/plan-gaps.md
- [x] cadence-core/workflows/plan.md
- [x] cadence-core/workflows/progress.md
- [x] cadence-core/workflows/spike.md
- [x] cadence-core/workflows/task.md
- [x] cadence-core/workflows/undo.md
- [x] cadence-core/workflows/verify-deep.md
- [x] cadence-core/workflows/verify.md
- [x] cadence-core/workflows/verify-sweep.md
- [x] cadence-core/workflows/adopt.md
- [x] cadence-core/workflows/minimalism-review.md
- [x] cadence-core/workflows/report.md
- [x] cadence-core/workflows/suggest.md
- [x] cadence-core/references/config-catalog.md
- [x] cadence-core/references/recall.md
- [x] cadence-core/references/plan-revision.md
- [ ] cadence-core/bin/lib/trace.mjs
- [ ] cadence-core/bin/planning.mjs
- [ ] cadence-core/bin/self-verify.mjs

---

# Invocation 3 - `/cad-docs-verify cadence-core/workflows/{new-project,phase,plan-gaps,plan,progress,spike,task,undo,verify-deep,verify,verify-sweep}.md`

Re-run surface. These eleven files carry run-1 rows; their rows join to run 1 on
`doc` plus claim text.

## new-project.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| `--research` forces the research pass on regardless of config, and `--brief <file>` carries a design brief | new-project.md:18-20 | accurate | `skills/cad-new-project/SKILL.md:4` argument-hint is `[--research] [--brief <file>]` |
| `docs/DISCOVERY.md` describes how a user arrives with a brief | new-project.md:21 | accurate | file present |
| A brief is `Read` WHOLE - no parser, no schema, no seam subcommand | new-project.md:23-24 | accurate | no brief parser or `brief` subcommand anywhere under `cadence-core/bin/**` |
| `planning.mjs trace ignore --root .` keeps the run record out of git | new-project.md:42 | accurate | `planning.mjs:2740` dispatches `ignore`; `:2747` requires a path after `--root` |
| A re-run adds no second line (`written:false`, `reason:"already-ignored"`) | new-project.md:47 | accurate | `planning.mjs:2672` returns exactly `{written:false, reason:'already-ignored'}` |
| `trace ignore` is the only thing in Cadence that writes that ignore line | new-project.md:50-51 | accurate | `planning.mjs:2638` states it; no other `.gitignore` writer under `cadence-core/bin/**` |
| Config is copied verbatim from `cadence-core/templates/config.json` | new-project.md:56 | accurate | template present |
| "Config written with defaults (standard granularity, shipped stakes, research off, plan check and verifier on)" | new-project.md:60-61 | **stale** | `workflow.plan_check` default is **`false`** - `config.schema.json` `"default": false`, and `templates/config.json` writes `"plan_check": false`. The other three are right (granularity `standard`, stakes `shipped`, research `false`). Correct: "plan check off, verifier on" |
| The six keys read through `config.mjs get`: `workflow.research`, `planning.commit_docs`, `granularity`, `git.protected_branches`, `git.on_protected`, `git.base_branch` | new-project.md:66-68 | accurate | all six present in `config.schema.json` |
| `cadence-core/templates/PROJECT.md` | new-project.md:161 | accurate | present |
| The protected-branch guard comes from `references/git-guard.md`, applied before the first commit | new-project.md:173 | accurate | present; rail 1 is the protected-branch check |
| A repo with no commits (`git rev-parse HEAD` fails) skips the guard | new-project.md:174-176 | accurate | real git behaviour; no seam contradicts it |
| The research pass is the one Cadence dispatch path with NO `maxTurns` runaway bound | new-project.md:206-207 | accurate | it dispatches a generic host agent, not a rung file; every bounded path is an `agents/*.md` frontmatter |
| `maxTurns` is per-FILE frontmatter, and this would need a 20th rung file | new-project.md:207-210 | accurate | `agents/` holds exactly 19 files |
| A wall-clock config key was its bound until v2.7.0, when it was deleted for claiming a control nothing could apply | new-project.md:212-213 | accurate | `lib/retired-keys.mjs:58` retires `workflow.subagent_timeout` `since: 'v2.7.0'`, reason "the host spawn seam takes no timeout and offers no cancel" |
| `workflow.research` default false | new-project.md:213 | accurate | `config.schema.json` default `false` |
| The pass writes `.planning/research/RESEARCH.md` | new-project.md:201, :217 | unverifiable | written at runtime by a dispatched agent; no seam or schema in this repo defines or constrains the path |
| `cadence-core/templates/REQUIREMENTS.md` | new-project.md:268 | accurate | present |
| The Traceability table is left as bare headers, seeded per phase by `/cad-plan` | new-project.md:270-271, :298-300 | accurate | `plan.md:364` runs `seed-reqs`; `planning.mjs:1798` is the only row inserter |
| Phase count follows `granularity`: coarse 3-5, standard 5-8, fine 8-12 | new-project.md:287-288 | accurate | `config.schema.json:7` purpose states "coarse 3-5 / standard 5-8 / fine 8-12 phases" verbatim |
| `cadence-core/templates/ROADMAP.md` | new-project.md:297 | accurate | present |
| `cadence-core/references/req-traceability.md` | new-project.md:300 | accurate | present |
| `planning.mjs criteria-size --roadmap-min 2 --roadmap-max 5` | new-project.md:305 | accurate | both flags declared at `planning.mjs:1649-1650`; dispatched at `:3647` |
| No `--phase`: one call walks every phase the roadmap declares | new-project.md:308-309 | accurate | `--phase` is validated only when present (`planning.mjs:1677`) |
| `roadmap_found: false` is not zero criteria | new-project.md:309-311 | accurate | `planning.mjs:1701` emits `roadmap_found` as a separate field from the counts |
| It is a REPORT, not a gate, exactly as `plan-size`'s `phase-too-big` is | new-project.md:311-312 | accurate | `planning.mjs:1584` pushes `phase-too-big` into `over`; `:1645` states it "is presented and acted on by prose" |
| `cursor set --phase 1 --status "ready to plan" --next "/cad-context 1"` | new-project.md:337-338 | accurate | `planning.mjs:443` and `:456` require exactly `--phase`, `--status`, `--next` |
| A phase directory is `.planning/phases/<N>/`, the bare integer, no zero-padding, no slug suffix | new-project.md:341-345 | accurate | the `phase-dir-grammar` drift kind (`planning.mjs:279`) reports any `phases/` entry outside that grammar |
| STATE.md is a ~4-line overwritten cursor | new-project.md:374-375, :402 | accurate | `planning.mjs` fails `unparseable-cursor` with "STATE.md does not match the 4-line schema" |

## phase.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| A phase number appears in FOUR places - ROADMAP list, `.planning/phases/<N>/` dirs, the REQUIREMENTS `Phase` column, the STATE cursor | phase.md:4-6 | accurate | `renumber` (`planning.mjs:3003`) moves exactly those four, and the same four are the `status` drift kinds `roadmap-box` / `phase-dir` / `req-status` / `cursor` |
| The mechanics live in the planning seam's `renumber` subcommand | phase.md:6-7 | accurate | `planning.mjs:3049` |
| `add` re-writes the cursor via `cursor get` then `cursor set` | phase.md:17-18 | accurate | `cmdCursorGet` and `cmdCursorSet` both exist (`planning.mjs:433`, `:441`) |
| `cursor set` requires `--phase` and does not preserve the prior one | phase.md:19-20 | accurate | `planning.mjs:443` - `cursor set needs --phase <N>` |
| `renumber insert --at <N> --dry-run` | phase.md:30 | accurate | `planning.mjs:3049` usage string names both forms |
| The returned shape carries `ops`, `in_text_refs` and `warn` | phase.md:33-34 | accurate | `planning.mjs:3219` (`in_text_refs`), `:3193` (`warn`), ops list built at `:3254` |
| The seam moves dirs high-to-low, collision-safe, with `git mv` so history follows | phase.md:36-37 | accurate | `planning.mjs:3009` runs `execFileSync('git', ['mv', from, to])` |
| It shifts every `Phase K` token and `phases/K/` path >= N in ROADMAP/REQUIREMENTS | phase.md:37-38 | accurate | `planning.mjs:3003` states the structured-edit set |
| The seam leaves the numbered slot empty, reported as `slot` | phase.md:39 | accurate | `planning.mjs:3223` emits `slot` on the `insert` arm only |
| `in_text_refs` are lowercase prose references the seam will NOT rewrite | phase.md:33-34, :42-43 | accurate | `planning.mjs:3219` reports them rather than editing them |
| `renumber remove --n <N> --dry-run` | phase.md:51 | accurate | `planning.mjs:3080` - `renumber ${sub} needs --${flag} <N>` |
| The remove arm reports `orphaned_reqs` | phase.md:52 | accurate | `planning.mjs:3220` |
| It blanks the orphaned rows' Phase cells and they surface as `no-phase` in `/cad-audit`, never silently dropped | phase.md:55-57 | accurate | `planning.mjs:1045` lists `no-phase` among the break codes; `audit.md:79` states the same reading |
| A failed apply returns `ok:false` with a `completed` list; the seam is not transactional | phase.md:62-63 | accurate | `planning.mjs:3262` returns `{ok:false, reason:'partial-apply', completed, failed: op}` with a reconcile-by-hand hint |
| Commit atomically honoring the protected-branch guard (`references/git-guard.md`) | phase.md:66-67 | accurate | present; rail 1 |

## plan-gaps.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| Loaded from plan.md when `--gaps` was passed | plan-gaps.md:3-4 | accurate | `plan.md:28-29` Reads this file on `--gaps` |
| Rejoin plan.md at `spawn_planner` with Mode: gaps | plan-gaps.md:5, :19 | accurate | `plan.md:95` is `<step name="spawn_planner">`; `:136` carries `Mode: {standard \| gaps \| revision}` |
| `planning.mjs uat status --phase <N>` | plan-gaps.md:10 | accurate | `planning.mjs:999` |
| `no-uat` means no checklist | plan-gaps.md:12 | accurate | `planning.mjs:633` fails `no-uat` |
| The planner's read list additionally includes `phases/<N>/UAT.md` plus the existing PLAN* and SUMMARY* files | plan-gaps.md:20-22 | accurate | `plan.md:101-102` appends exactly those to the bracket, and `:146` to the prompt read list |

## plan.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| The pipeline is read goal -> spawn cad-planner -> optional cad-plan-checker gate -> fire the `plan` review trigger -> commit docs | plan.md:2-5 | accurate | steps `spawn_planner`, `check_gate`, `review`, `commit` appear in that order at `:95`, `:263`, `:311`, `:357` |
| With no phase argument, `planning.mjs status` supplies `current` | plan.md:17-18 | accurate | `planning.mjs:414` returns `current` |
| An `ok:true` carrying `cycle: "none"` with an empty `phases[]` is a derived closed milestone | plan.md:20-22 | accurate | `planning.mjs:416` emits `cycle:'none'` only in the closed state |
| `--skip-check` skips the plan-checker gate even when `workflow.plan_check` is true | plan.md:24-25 | accurate | `check_gate` (`plan.md:264`) skips on either condition |
| `--inline` is honored only for small phases | plan.md:26-27 | accurate | `route` (`plan.md:87-89`) compares the estimate to `workflow.inline_plan_threshold` |
| `--gaps` reads `cadence-core/workflows/plan-gaps.md` | plan.md:28-29 | accurate | file present |
| The eight keys read in one `config.mjs get` call | plan.md:34-38 | accurate | `workflow.plan_check`, `workflow.inline_plan_threshold`, `workflow.max_plan_tasks`, `planning.commit_docs`, `git.protected_branches`, `git.on_protected`, `git.base_branch`, `memory.backend` all present in `config.schema.json` |
| `planning.mjs plan-size --phase {N} --max-reqs 12 --max-tasks {n}` | plan.md:44-45 | accurate | both flags parsed at `planning.mjs:1547` and `:1553` |
| A `phase-too-big` entry in `over` means the phase names more requirements than one phase should carry | plan.md:48-49 | accurate | `planning.mjs:1584` |
| `--max-reqs 12` is a fixed rail rather than a config key | plan.md:51-52 | accurate | no `max_reqs` key exists in `config.schema.json`; the seam takes it as a flag only (`planning.mjs:1614`) |
| `requirements_found: false` is NOT zero - an unmeasured phase is never compared | plan.md:54-56 | accurate | `planning.mjs:1610` emits it; `:1573` states the comparison never happened |
| The `plan` gate is not in that batch because `fire(trigger)` takes every gate from the routing bundle (`route.mjs resolve`) | plan.md:58-59 | accurate | `route.mjs:435-464` resolves the gate map and `:276` rides it on the result |
| `config.mjs get` returns the schema DEFAULT for a gate no layer set | plan.md:60-62 | accurate | `config.mjs get` falls back to `config.schema.json` defaults, which is why the two can disagree |
| `memory.backend` gates recall in `spawn_planner` and `inline_plan` | plan.md:64-66, :107-108, :180-185 | accurate | `config.schema.json` `memory.backend`, default `builtin` |
| `--bracket-read` is ONE comma-separated value, never a repeated flag | plan.md:99-102 | accurate | `references/seams.md:110` and `:113` state exactly that; `self-verify.mjs:320` lists it among `resolve`'s flags |
| The resolve writes the lifecycle dispatch event itself; only the CLOSE stays in the workflow | plan.md:103-104 | accurate | `route.mjs:255-256` writes the dispatch event carrying `plan` and `role` |
| `planning.mjs recall "<key terms>"` | plan.md:117 | accurate | `recall` subcommand present |
| Its JSON line is `{ok, results:[{score, source, phase?, snippet}]}` | plan.md:120 | accurate | `planning.mjs:1953-1960` returns exactly `score`, `source`, conditional `phase`, `snippet` |
| `cadence-core/templates/PLAN.md` | plan.md:150 | accurate | present |
| `trace close --phase <N> --plan cad-planner --role cad-planner --tokens <n>` | plan.md:196 | accurate | `planning.mjs:70` declares that exact flag set |
| Adding `--detail` makes the seam close it as a checkpoint instead | plan.md:191-192 | accurate | `planning.mjs:71-76` - "the arm is inferred from `--detail`: present means" checkpoint |
| `parallelization.max_concurrent_agents` bounds concurrent phases | plan.md:218 | accurate | `config.schema.json`, default `3` |
| `plan-overlap` reports a shared path so the caller knows the plans are sequential; it does not refuse the split | plan.md:224-227 | accurate | `planning.mjs:1517` - "the parallel-safety invariant as arithmetic", an intersection report |
| `references/consult.md` `offer_consult` | plan.md:230 | accurate | present |
| A second `plan-size --phase {N} --max-tasks {n}` runs after `handle_return` | plan.md:242-243 | accurate | same subcommand; `--max-tasks` parsed at `planning.mjs:1547` |
| `plan-too-many-tasks` names the PLAN file and both numbers | plan.md:246 | accurate | `planning.mjs:1601` pushes `{kind:'plan-too-many-tasks', plan: p.plan, measured: p.tasks, ...}` |
| `cadence-core/references/plan-revision.md` is the one consult site for the BLOCKER arm | plan.md:304-305 | accurate | present |
| The `plan` trigger's payload is the PLAN file(s) plus ROADMAP, REQUIREMENTS and CONTEXT | plan.md:312-315 | accurate | `references/review-triggers.md:342`'s `plan` row names exactly those four, CONTEXT optional |
| All four ride the fire's `--read` bracket list (review-triggers.md step 4) | plan.md:317-319 | accurate | review-triggers.md step 4 defines the `--read` bracket list |
| The `plan` gate is **advisory** at the `shipped` default | plan.md:331 | **stale** | `route-table.json` `review.shipped.plan` is **`"off"`**. Advisory is `solo`'s value; `shipped` is `off` and `critical` is `adjudicated`. Same defect half A recorded at `README.md:56` |
| "the same overlap the per-plan `diff` review runs at advisory" | plan.md:336 | **stale** | no stakes level resolves `diff` to advisory - `route-table.json` `review.*.diff` is `off` / `off` / `blocking`. Only an explicitly SET `review.triggers.diff.gate=advisory` reaches it (`route.mjs:435-464`), and `templates/config.json` writes no `review.triggers` block at all |
| The advisory tail writes findings to `.planning/phases/<N>/REVIEW-plan.md` and the reviewer closes its own bracket | plan.md:337-341 | accurate | `references/review-triggers.md:146-147` states the `REVIEW-<trigger>.md` path and the per-plan suffix |
| Adjudicated survivors are a numbered list the user triages, NONE the default, per `references/triage-gate.md` | plan.md:346-351 | accurate | `references/triage-gate.md` states the tapped multi-select with NONE first and default |
| `planning.mjs seed-reqs --phase {N}` | plan.md:364 | accurate | `planning.mjs:3650` |
| `cursor set --phase {N} --status planned --next "/cad-execute {N}"` | plan.md:368 | accurate | `planning.mjs:443`, `:456` |
| `cursor set` derives name/total from ROADMAP and stamps the date | plan.md:371 | accurate | `planning.mjs:514` returns `phase, total, name, status, next` with `updated` written by the seam |
| `seed-reqs` inserts a three-cell Traceability row (id / `Phase {N}` / `Pending`) for declared ids that also have an `## Active` bullet, and is idempotent | plan.md:372-375 | accurate | `planning.mjs:1798-1862`; `seeded: res.inserted` counts insertions only |
| `orphan_ids` reports a declared id with no `## Active` bullet | plan.md:375-376 | accurate | `planning.mjs:1862` |
| `no_active_section: true` is a DIFFERENT report - the `## Active` section itself is absent | plan.md:376-379 | accurate | `planning.mjs:1864`, emitted independently of `orphan_ids` |
| Status is always `Pending`; cad-verify remains the only writer of any other status | plan.md:380-381 | accurate | `verify.md:297-298` and `:346-348` claim exactly that ownership; `phase-done` (`planning.mjs:567`) is the only other writer |
| `ok:false` is reported and the workflow CONTINUES - seeding is not a gate | plan.md:381-382 | accurate | prose contract; nothing in the seam halts the caller |
| The commit applies `references/git-guard.md` rail 1 | plan.md:385 | accurate | present |

## progress.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| The derivation is the planning seam's `status` subcommand; the STATE.md cursor is only a hint | progress.md:3-5 | accurate | `planning.mjs:418` derives `phases[]` from artifacts and reports `cursor` separately with `agrees` |
| `--stats` and `--trace` | progress.md:13 | accurate | `skills/cad-progress/SKILL.md:4` argument-hint is `[--stats\|--trace]` |
| `phases[]` carries each phase's derived status: unplanned -> planned -> executed -> complete, with UAT counts where a checklist exists | progress.md:23-25 | accurate | `planning.mjs:418-423`; `uat` is present only when `p.uat` is |
| `current` is the lowest non-complete phase, null when all are complete | progress.md:26 | accurate | `planning.mjs:414` |
| `cycle` is present and `"none"` ONLY in the derived closed-milestone state | progress.md:27-30 | accurate | `planning.mjs:416` - "Additive, and present ONLY in the closed state" |
| The phase-list grammar is `cadence-core/references/roadmap-phases.md` | progress.md:30-31 | accurate | present |
| `cursor` is the parsed STATE.md hint with `agrees` already computed | progress.md:32-33 | accurate | `planning.mjs:388` |
| `drift[]` kinds are `cursor`, `roadmap-box`, `req-status`, `phase-dir`, `phase-dir-grammar` | progress.md:36-37 | accurate | `planning.mjs:326`/`:328` (roadmap-box), `:345` (phase-dir), `:365`/`:367` (req-status), `:279` (phase-dir-grammar), `:405` (cursor) |
| `phase-dir` is a `phases/<N>/` dir surviving a milestone close | progress.md:36-37 | accurate | `planning.mjs:345` |
| `phase-dir-grammar` is a `phases/` entry outside the directory grammar | progress.md:37 | accurate | `planning.mjs:279` |
| `ok:false` relays `reason`/`hint`, e.g. `no-planning-dir` | progress.md:39-41 | accurate | `planning.mjs:295` fails `no-planning-dir` with the `/cad-new-project` hint |
| `cursor set --phase <current> --status <derived> --next "<...>"` | progress.md:58-59 | accurate | `planning.mjs:443`, `:456` |
| A `paused` cursor always agrees - leave it | progress.md:64 | accurate | no drift kind is emitted for a paused cursor |
| Closed-milestone rewrite takes no `--name`/`--total`; the seam derives `of 0 (no active cycle)` | progress.md:65-68 | accurate | `planning.mjs:471` - "`closed` fills `no active cycle` / 0" |
| cad-verify is the only writer of a ROADMAP checkbox or a Traceability Status beyond `Pending` | progress.md:72-74 | accurate | `verify.md:297-298`; `phase-done` (`planning.mjs:556`, `:567`) is the seam it uses |
| `planning.mjs trace render --phase <current>` | progress.md:93 | accurate | `trace render` dispatched by `planning.mjs`; `renderTrace` in `lib/trace.mjs` |
| The four family counts are `routing`, `provider`, `lifecycle`, `outcome` | progress.md:95 | accurate | `lib/trace.mjs:96` - `FAMILIES = ['routing','provider','lifecycle','outcome']` |
| The record has one `corr` | progress.md:96 | accurate | `lib/trace.mjs:242`; `correlationId` is derived per phase |
| The `roles` block carries per role a token total, a dispatch count and an `unrecorded` count when present | progress.md:96-99 | accurate | `lib/trace.mjs:413` initialises `roles: {}`; `:418` the per-role accumulators including `recorded` |
| An absent token total is printed as `unrecorded`, never as `0` | progress.md:99-103 | accurate | `lib/trace.mjs:62-77` states exactly that distinction and why |
| `unpaired` names a worker handed work that never came back | progress.md:105-107 | accurate | `lib/trace.mjs:416` (`unpaired: []`), `:69-72` |
| `capped` true means the record hit its size bound | progress.md:107-109 | accurate | `lib/trace.mjs:410`, set at `:457` from `statSync(file).size >= MAX_TRACE_BYTES`; `:90` |
| An absent trace file returns `ok:true` with empty counts | progress.md:109-111 | accurate | `lib/trace.mjs:461` returns the zeroed `out` when there are no lines |
| `workflow.skip_discuss` routes `current` unplanned straight to `/cad-plan` | progress.md:139 | accurate | `config.schema.json`, default `false` |
| The trace file is written by the seams and by the context, plan, execute, verify and verify-deep workflows plus the reviewer bracket - never by progress | progress.md:173-175 | accurate | this workflow's only trace call is `trace render`, a read |

## spike.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| Criteria are written as Given/When/Then with an OBSERVABLE outcome | spike.md:12-16 | unverifiable | a prose standard for the model's own writing; no seam checks it |
| The criteria file is `.planning/spikes/<slug>/SPIKE.md`, written before the experiment exists | spike.md:19-21 | unverifiable | nothing else in the tree references `.planning/spikes/` - no seam, schema, template or other workflow - so the path is this workflow's own writing convention and is only observable by running a spike |
| Throwaway code goes in `.planning/spikes/<slug>/` or a temp dir, NOT the project's real source | spike.md:30-32 | unverifiable | same reason; a runtime placement rule with no seam behind it |
| The verdict vocabulary is `validated` / `invalidated` / `inconclusive` | spike.md:37-42 | accurate | self-contained: step 5 enumerates exactly three and step 6 records "the verdict" from that set |
| Step 6 completes the SAME file step 2 began, in place | spike.md:20-21, :45-46 | accurate | both steps name `.planning/spikes/<slug>/SPIKE.md` and step 2 says "step 6 completes this same file in place" |
| Commit `docs: spike <slug>` under the protected-branch guard | spike.md:50-51 | accurate | `references/git-guard.md` present; rail 1 is the protected-branch check |

## task.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| `references/git-guard.md` rail 1 is the protected-branch check plus base-integrity and the integration-branch decision, not a bare branch check | task.md:2-4 | accurate | `git-guard.md` rail 1 carries all three |
| `--plan` opts into a written PLAN.md | task.md:6-7, :16 | accurate | `skills/cad-task/SKILL.md:4` argument-hint is `[task description] [--plan]` |
| Verification runs `workflow.test_command` from config if set and relevant | task.md:46 | accurate | `config.schema.json:32`, `string_or_null`, default `null` |
| Commit per `references/git-guard.md` rail 2 (specific files, conventional message) | task.md:48 | accurate | rail 2 is the commit rail |
| The planned path writes `.planning/tasks/{slug}/PLAN.md` | task.md:54 | accurate | `skills/cad-executor-contract` names `.planning/tasks/<slug>/PLAN.md` as the `/cad-task` dispatch path |
| A cad-executor dispatch's outcome is read from `.planning/tasks/{slug}/reports/plan-1.md` - the executor returns a digest, not a table | task.md:66-68 | accurate | the executor contract writes `<plandir>/reports/plan-<k>.md` and returns a five-field digest |
| `planning.commit_docs` gates the plan-file commit | task.md:69 | accurate | `config.schema.json:49`, default `true` |
| The `risk_surface` fire uses shape (c), the flagged-diff FILE path, because shape (a) refs is not one of the shapes the wiring table admits for `risk_surface` | task.md:78-80 | accurate | `references/review-triggers.md:344`'s `risk_surface` row admits "(c) the range-diff FILE path, or (b) the staged-diff scope"; `:60-64` says outright "shape (a) refs is not one of the shapes this trigger admits" |
| That file is transient exactly like `execute.md`'s `plan-<k>-risk-task-<n>.diff` | task.md:80-82 | accurate | `execute.md:415` - "Never stage a `plan-<k>-risk-task-<n>.diff`: it is the transient..." |
| `planned_path` step 1 is the only writer of `.planning/tasks/{slug}/` | task.md:85-88 | accurate | the inline path (`task.md:41-51`) writes no files and `risk_check` redirects elsewhere on that arm |
| `Zero planning artifacts for inline tasks` is this workflow's own success criterion | task.md:100-101 | accurate | `task.md:139` states it verbatim |
| The inline arm writes to `${TMPDIR:-/tmp}/cadence-risk-task-{slug}.diff` - still shape (c), which since v2.6.1 admits a flagged-diff file however it was produced | task.md:103-105 | accurate | `CHANGELOG.md:690` records the v2.6.1 widening ("The `risk_surface` wiring row admitted shape (c) only as 'the flagged-diff...'") and `:704` names the `${TMPDIR:-/tmp}` inline write |
| This trigger is `blocking` at every level | task.md:90, :107 | accurate | `route-table.json` `review.*.risk_surface` is `blocking` at solo, shipped and critical |
| Its re-arm is CAPPED at ONE narrowed round, and the cap lives only in `references/triage-gate.md` | task.md:107-110 | accurate | `triage-gate.md:14` - "The blocking re-arm is capped at ONE round"; `task.md` preloads no reference, so the RE-READ is required |

## undo.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| The phase SUMMARY.md is the manifest - cad-execute writes commits-per-task with their hashes there | undo.md:3-5 | accurate | the executor report table carries a `Commit` column per task and the orchestrator writes SUMMARY.md from it |
| Fallback is `git log` filtered to the phase's conventional-commit scope, SHOWN before it is trusted | undo.md:10-12 | accurate | phase commits carry a `(<N>)` scope, so the filter is well-defined |
| The protected-branch guard is `references/git-guard.md` rail 1 | undo.md:27-29 | accurate | present; rail 1 is the protected-branch check |
| Only the protected-branch check applies; a recovery revert does not open an integration branch | undo.md:30-32 | accurate | a deliberate narrowing of rail 1, consistent with `git-guard.md`'s three-part rail |
| The `--no-commit` form writes no commit, so it skips the guard | undo.md:32-33 | accurate | real `git revert --no-commit` semantics |
| `git revert --no-edit <hashes in reverse order>` and `git revert --abort` | undo.md:35, :41 | accurate | both are real git flags |
| `planning.mjs phase-done --n <N> --undo` | undo.md:48 | accurate | `planning.mjs:552` - `const undo = 'undo' in opts` |
| `--undo` unchecks the ROADMAP box and flips the phase's traceability rows back to Pending | undo.md:52-53 | accurate | `planning.mjs:556` `setPhaseBox(roadmapText, n, !undo)`; `:567` `setReqStatus(reqText, ids, undo ? 'Pending' : 'Complete')` |
| `cursor set --phase <N> --status <planned or "ready to plan"> --next "<the redo step>"` | undo.md:49 | accurate | `planning.mjs:443`, `:456` require exactly those three |
| Never auto-push the reverts - publishing is /cad-land's call | undo.md:59 | accurate | `skills/cad-land/SKILL.md` owns the publish ask; the git-publish seam is rail 3's only sanctioned push |

## verify-deep.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| Loaded from verify.md `deep_check` when it actually runs; return to verify.md `walk` afterward | verify-deep.md:3-4 | accurate | `verify.md:101` is `<step name="deep_check">` and `:124` Reads this file; `verify.md:128` is `<step name="walk">` |
| The bracket rides the resolve as `--bracket-read "<csv>"` | verify-deep.md:7-8 | accurate | `references/seams.md:110`, `:113`; `self-verify.mjs:320` lists `--bracket-read` among `resolve`'s flags |
| The verifier writes exactly one file, `.planning/phases/<N>/verifier-findings.json`, and returns a digest plus that path | verify-deep.md:10-13 | accurate | `verify.md:244` opens that exact path; the verifier contract's Write grant is one file under `.planning/phases/<N>/` |
| Its contract is its own, `skills/cad-verifier-contract`, and is not restated here | verify-deep.md:13 | accurate | directory present |
| `trace close --phase <N> --plan cad-verifier --role cad-verifier --tokens <n> --detail "<what failed>"` | verify-deep.md:19 | accurate | `planning.mjs:70-71` declares exactly `--phase`, `--plan`, `--role`, `--tokens`, `--detail`, `--reviewer` |
| Carrying `--detail` closes a `checkpoint`; omitting it closes a `return` | verify-deep.md:22-23 | accurate | `planning.mjs:75-76` - "the arm is inferred from `--detail`: present means" |
| OMIT `--tokens` on a figureless return (seams.md's bracket rule) | verify-deep.md:24 | accurate | `references/seams.md` states the bracket rule; `--tokens` is optional in the usage line |
| `planning.mjs uat merge --phase <N> --payload <file>` | verify-deep.md:36-37 | accurate | `planning.mjs:801` handles `merge`; `:663` names `--payload` as merge's flag |
| Verifier results only fill `pending` items; a user-recorded result is never overwritten and a conflicting finding is skipped and counted | verify-deep.md:42-45 | accurate | `planning.mjs:936` and the `skipped` / `skipped_entries` counters |
| An entry resolving to no usable item name is rejected and counted, never appended as a nameless item | verify-deep.md:45-46 | accurate | `rejected` and `rejected_entries` at `planning.mjs:981-982` |
| Failed items route through verify.md `route_failures` exactly like user-reported failures | verify-deep.md:46-47 | accurate | `verify.md:237` is `<step name="route_failures">` |
| The seam's one-line summary is `auto_passed`, `gaps`, `added`, `skipped`, `rejected` | verify-deep.md:48-49 | accurate | `planning.mjs:993` returns exactly those five |
| The SEAM writes `.planning/phases/<N>/FINDINGS.json` - those counters plus `rejected_entries` and `skipped_entries`, holding the discarded entries verbatim | verify-deep.md:54-57 | accurate | `planning.mjs:977-982` |
| The seam overwrites its own file on every successful merge, which is why the verifier's may not carry that name | verify-deep.md:57-58 | accurate | `planning.mjs:980` `atomicWrite`s FINDINGS.json unconditionally on the success path |
| The bracket is closed in `dispatch` and `fall_through` has no close of its own, so a merge that fails after a usable return cannot close twice | verify-deep.md:64-67 | accurate | `dispatch` (`:14-20`) is the only `trace close` call in the file |

## verify.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| All checklist persistence goes through the planning seam's `uat` subcommands | verify.md:5-6 | accurate | `planning.mjs:3643` dispatches every `uat` sub; UAT.md has no other writer under `cadence-core/bin/**` |
| The seam owns first_pass set-once, verifier-never-overwrites-a-user-result, and counts recomputed every write | verify.md:7-8 | accurate | `planning.mjs:728` (set-once), `:936` (conflict skipped), `lib/planning-files.mjs:1423` (counts recomputed) |
| `--sweep` is the cold branch verify-sweep.md and `--deep` the cold branch verify-deep.md | verify.md:10-11, :19-20 | accurate | both files present; `skills/cad-verify/SKILL.md:4` argument-hint is `[phase] [--sweep] [--deep]` |
| With neither, `planning.mjs cursor get` supplies the current phase | verify.md:22 | accurate | `cmdCursorGet` at `planning.mjs:433`, failing `no-cursor` when STATE.md is absent |
| `planning.mjs uat status --phase <N>` | verify.md:30 | accurate | `planning.mjs:999` |
| An existing checklist announces progress from `counts` | verify.md:33 | accurate | `status` returns `counts` (`planning.mjs:996-1006`) |
| `uat refresh --phase <N>` takes stdin `[{"name","expected","criterion"}]` | verify.md:39-41 | accurate | `planning.mjs:662` reads stdin only and rejects `--payload`; `:676` validates `criterion` as `^AC\d+$` |
| Refresh appends only genuinely new names; recorded results are never touched | verify.md:43-45 | accurate | `planning.mjs:720` returns `added: fresh.length` over unseen names |
| `no-uat` means the checklist does not exist | verify.md:47 | accurate | `planning.mjs:633` |
| `"criterion":"AC<N>"` is created ONLY here - nothing downstream can recover it by comparing strings | verify.md:64-68 | accurate | `init`/`refresh` are the only writers of the field (`planning.mjs:690`) |
| `/cad-audit` FAILs on a criterion no item names (`references/acceptance-criteria.md`) | verify.md:69-70 | accurate | reference present; the `criteria-coverage` seam is what audit reads |
| The cold-start smoke item sends `"origin":"smoke"` | verify.md:72 | accurate | `lib/planning-files.mjs:1257` - `UAT_ORIGINS = ['criterion','verifier','smoke']` |
| An item from the PLAN+ROADMAP fallback or a SUMMARY-derived deliverable sends neither field and reports as untraced without moving the verdict | verify.md:73-75 | accurate | both fields are optional at `planning.mjs:690-691` |
| `uat init --phase <N>` takes the same stdin array | verify.md:94-95 | accurate | `planning.mjs:662`, `:692`; a second `init` is refused `uat-exists` |
| `workflow.verifier: false` (`config.mjs get workflow.verifier`) always skips the deep pass - it is the off switch | verify.md:103 | accurate | `config.schema.json` default `true`, purpose states "false always skips the deep pass" |
| `route.mjs resolve --role cad-verifier` decides whether the pass runs | verify.md:108 | accurate | `route.mjs:273` refuses an unknown or absent role with `unknown-role` |
| Relay every `warnings[]` entry that resolve returns, each distinct warning once per run | verify.md:112 | accurate | `route.mjs:276` and `:317` ride `warnings` on the result shape |
| `verify` on that line is `on` or `off` | verify.md:114 | accurate | `route-table.json` `verify` is `off` / `on` / `on` across the three levels |
| The seam refuses a resolve without a role, so this step resolves as `cad-verifier` | verify.md:115-117 | accurate | `route.mjs:273-274` returns `{ok:false, reason:'unknown-role'}` |
| "stakes level solo: the deep verify pass is off" | verify.md:120-121 | accurate | `route-table.json` `verify.solo` is `off` |
| `blocked` is TERMINAL - `next` offers only `pending`, `refresh` appends only unseen names, `route_failures`' reset is scoped to `status: fail`, and completion refuses it | verify.md:156-159 | accurate | `nextPending` (`planning.mjs:637`) walks pending only; `planning.mjs:1206` treats `blocked` as settled-but-unanswerable rather than returnable |
| `uat status` returns `status`, `counts`, `result` and `first_pending` alone - no item list, no `expected` string | verify.md:167-169 | accurate | `planning.mjs:996-1006` returns exactly those, `first_pending` only when one exists |
| `uat record --phase <N> --item <k> --result <r> --evidence "<...>" --source model` | verify.md:177-179 | accurate | `planning.mjs:723`; `--source` validated at `:747` against `UAT_SOURCES = ['user','verifier','model']` (`lib/planning-files.mjs:1250`) |
| One call per item, never a `uat merge` payload: merge atomically overwrites `phases/<N>/FINDINGS.json` on every success | verify.md:181-184 | accurate | `planning.mjs:980` |
| The results table format is the four columns `#` / Item / Result / Evidence | verify.md:190-192 | accurate | a transcript format this workflow defines; the example row is illustrative |
| The result vocabulary is pass / skipped / blocked / fail (plus pending) | verify.md:216-219 | accurate | `planning.mjs:650` - `UAT_RESULTS = ['pass','fail','skipped','blocked','pending']` |
| Severity inference defaults to major, and severity is never asked | verify.md:212, :221-223 | unverifiable | a model-judgment rule; the seam stores whatever `--severity` it is handed and enforces no default |
| `uat record ... [--reported "<verbatim reply>"] [--severity <s>] [--reason "<why>"]` | verify.md:229-231 | accurate | `lib/planning-files.mjs:1239` - `UAT_FIELDS` carries `reported`, `severity`, `cause`, `fix` |
| The record output's `next` field is the next pending item, null when there is none | verify.md:233-234 | accurate | `planning.mjs:798` returns `next: nextPending(uat.items)` |
| A re-record of the same result adds `--cause`; first_pass is safe | verify.md:241-242 | accurate | `cause` is a `UAT_FIELDS` entry; `planning.mjs:728` makes `first_pass` set-once |
| `.planning/phases/<N>/verifier-findings.json` is opened at `route_failures` and nowhere else in this workflow, for the gap's `missing` or the human check's `why_human` | verify.md:243-247 | accurate | the only other mention in verify.md is the commit list at `:313`; `why_human` is a `UAT_FIELDS` entry (`lib/planning-files.mjs:1238`) |
| A diagnosis second opinion goes through `references/review-triggers.md`, artifact = the failed item's cited file PATHS, shape (c) | verify.md:248-253 | accurate | `review-triggers.md:60` - shape (c) is a path |
| That fire names no wiring-table trigger, so it has no resolved gate | verify.md:253-255 | accurate | the wiring table (`review-triggers.md:342-344`) names only `plan`, `diff`, `phase_diff` and `risk_surface` |
| Its survivors are a numbered list the user triages, NONE the default, per a RE-READ of `references/triage-gate.md` | verify.md:255-258 | accurate | `triage-gate.md` states NONE first and default; verify.md preloads no reference |
| The Apply-now commit fires `risk_surface` with the staged-diff scope, shape (b): the reviewer re-runs `git diff --cached` in the cwd it inherits | verify.md:263-268 | accurate | `review-triggers.md:56-59` defines shape (b) exactly that way, and `:344` admits it for `risk_surface` on a single in-tree fix |
| That gate is blocking and its re-arm is capped at ONE narrowed round | verify.md:268-269 | accurate | `route-table.json` `risk_surface` blocking at all three levels; `triage-gate.md:14` |
| `uat record --item <k> --result pending --fix "{hash}, retest"` sets the item back for retest, first_pass keeping the original fail | verify.md:270-272 | accurate | `planning.mjs:648` states that exact form; `fix` is a `UAT_FIELDS` entry |
| `result: complete` means every item passed or was skipped with a reason; anything else is `partial` | verify.md:286-288 | accurate | `planning.mjs:1204-1207` settles on pass, blocked, or skipped-with-reason |
| `trace append --phase <N> --family outcome --event uat_verdict --detail "<complete or partial>"` | verify.md:294 | accurate | `planning.mjs:66-69` declares `--family`, `--event`, `--detail`; `fixtures/verbatim.trace.jsonl:28` carries a real `uat_verdict` event in family `outcome` |
| `planning.mjs phase-done --n <N>` checks the ROADMAP box and flips traceability rows to Complete, Deferred rows exempt, reporting exactly what changed | verify.md:302-304 | accurate | `planning.mjs:556`, `:567`, `:575` returns `{roadmap:{line, now}, reqs}` |
| `cursor set --phase <N> --status "phase complete" --next "<...>"` | verify.md:305-307 | accurate | `planning.mjs:443`, `:456` |
| On a partial session, do neither | verify.md:309 | accurate | prose contract consistent with `phase-done` being the only transition writer |
| `planning.commit_docs` (`config.mjs get planning.commit_docs`) gates the docs commit | verify.md:311 | accurate | `config.schema.json:49`, default `true` |
| The commit covers UAT.md, `phases/<N>/FINDINGS.json` and `phases/<N>/verifier-findings.json` when a deep pass wrote them, plus whichever of STATE.md, ROADMAP.md and REQUIREMENTS.md changed | verify.md:312-315 | accurate | those are exactly the files `uat record`, `uat merge`, `cursor set` and `phase-done` write |
| The report's `{v} auto-verified, {m} model-executed` split | verify.md:321 | unverifiable | no seam returns those two counts separately; `uat status` returns `counts` alone, so the split is composed by the model from the items' `source` field |
| The Reworked count is items that failed first pass then were fixed | verify.md:323 | accurate | `lib/planning-files.mjs:1423` - `reworked = items.filter(i => i.first_pass === 'fail').length` |
| A pass may come from `source: model` with the command and output cited on the item | verify.md:336-339 | accurate | `model` is one of the three `UAT_SOURCES` |
| Row creation at `Pending` is `/cad-plan`'s seeding step, not this one | verify.md:297-298, :346-348 | accurate | `plan.md:364` `seed-reqs`, `plan.md:380` "Status is always `Pending`" |

## verify-sweep.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| Loaded only when `--sweep` was passed; return to verify.md's `build_or_resume` on resume | verify-sweep.md:3-4, :32 | accurate | `verify.md:19-20` Reads it on `--sweep`; `verify.md:26` is `<step name="build_or_resume">` |
| One `planning.mjs status` call | verify-sweep.md:9 | accurate | subcommand present |
| The `phases[]` array already carries each phase's derived state and UAT counts | verify-sweep.md:11-12 | accurate | `planning.mjs:418-423` |
| A phase with status `executed` and no `uat` field was built and never verified | verify-sweep.md:13-14 | accurate | `planning.mjs:423` emits `uat` only when a checklist exists |
| The `.planning/phases/<N>/UAT.md` paths are already known from the status output, so no read is serialized behind a prior result | verify-sweep.md:20-22 | accurate | `status` returns each phase's `n`, and the path is `phases/<n>/UAT.md` by the directory grammar |
| The resume offer goes through the ask-user seam and continues at verify.md `build_or_resume` | verify-sweep.md:26-32 | accurate | `references/seams.md` defines the ask-user seam; the step name matches |

---

# Invocation 4 - `/cad-docs-verify cadence-core/workflows/{adopt,minimalism-review,report,suggest}.md`

**NEW SURFACE.** These four files carry NO run-1 ledger row. Every row in the
four tables below is a claim run 1 never extracted, so none of them is part of
run 1's 547 and none joins to an existing ledger row. Plan 3 files them under
`.planning/DOCS-CLAIMS.md`'s post-run-1 section, leaving run 1's baseline where
it is.

## adopt.md

*New surface.*

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| Adopt writes the same `.planning/` shape /cad-new-project writes - same files, same STATE cursor, same config | adopt.md:5-7 | accurate | both workflows write PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md and config.json and nothing else |
| Everything is derived INLINE - no subagent is dispatched and no detector seam is added | adopt.md:9-11, :274-277 | accurate | the file contains no spawn-agent call; its only seam calls are `trace ignore`, `config.mjs get`, `criteria-size` and `cursor set` |
| `git rev-parse --show-toplevel` must succeed AND equal the working directory | adopt.md:21-27 | accurate | real git behaviour; `--show-toplevel` prints the repo root |
| `git rev-parse --git-dir` is NOT this check - it succeeds in any subdirectory of an enclosing repo | adopt.md:28-32 | accurate | real git behaviour; `new-project.md:38` uses `--git-dir` precisely because it only asks "am I in a repo" |
| `planning.mjs trace ignore --root .` and it is the only thing in Cadence that writes the rule | adopt.md:40, :47-48 | accurate | `planning.mjs:2740` dispatches it; `:2638` states it is the scaffold-time writer, and no other `.gitignore` writer exists under `cadence-core/bin/**` |
| /cad-health reports `ignored:false` and `tracked:true` as separate issues with different remedies | adopt.md:49-51 | accurate | `skills/cad-health/SKILL.md:35-38` states exactly that - the ignore rule fixes one, `git rm --cached` the other, and both are needed together |
| Append-if-absent, so a brownfield `.gitignore` keeps every line and a re-run adds no second line | adopt.md:50-51 | accurate | `planning.mjs:2672` returns `{written:false, reason:'already-ignored'}` on a re-run |
| The config template is copied VERBATIM from `cadence-core/templates/config.json` | adopt.md:41, :53 | accurate | template present |
| "Config written with defaults (standard granularity, shipped stakes, research off, plan check and verifier on)" | adopt.md:54-56 | **stale** | `workflow.plan_check` defaults to **`false`** - `config.schema.json` and `templates/config.json` both write it off. Correct: "plan check off, verifier on". Identical wording to `new-project.md:60-61`, so both sites move together |
| The five keys read: `planning.commit_docs`, `granularity`, `git.protected_branches`, `git.on_protected`, `git.base_branch` | adopt.md:42-44 | accurate | all five present in `config.schema.json` |
| `planning.mjs detect-commands` is neither required nor extended for this | adopt.md:61-62 | accurate | the subcommand exists (`planning.mjs:2265` region) and adopt calls it nowhere |
| `cadence-core/templates/PROJECT.md` | adopt.md:135 | accurate | present |
| The `### Active` milestone version is never the repo's current tag, because /cad-health rule 7 reports drift when it is a member of `git tag --list` | adopt.md:149-155 | accurate | `skills/cad-health/SKILL.md:107-111` - "Membership, not sort order: the issue is an Active version that equals an existing release TAG (`git tag --list`)" |
| `cadence-core/templates/REQUIREMENTS.md` | adopt.md:159 | accurate | present |
| `## Active` bullets take the stated grammar `- **[CAT]-01**: [requirement]`, a 3-5 letter category code starting with a letter | adopt.md:162-164 | accurate | restates `templates/REQUIREMENTS.md:59` ("a 3-5 letter category code") and `:62-63` ("requires the category to START WITH A LETTER") exactly. Note for the ledger: the LIVE `REQ_ID_EXACT` (`lib/planning-files.mjs:324`) admits 2-8 chars and a digit-leading category, so the stated grammar is narrower than the parser - the asymmetry phase 5 AC4 documents at the template, not a defect in adopt.md's restatement |
| `## Traceability` is left as BARE HEADERS; `/cad-plan` seeds each row (`references/req-traceability.md`) | adopt.md:170-172 | accurate | reference present; `plan.md:364` runs `seed-reqs` |
| `planning.mjs seed-reqs` reads `.planning/phases/<N>/PLAN*.md` and returns `no-phase-dir` / `no-plans` before any plan exists | adopt.md:171-174 | accurate | `planning.mjs:1821` fails `no-phase-dir`, `:1822` fails `no-plans` with a `/cad-plan` hint |
| `cadence-core/templates/ROADMAP.md` | adopt.md:179 | accurate | present |
| /cad-health rule 5 flags an `- [x]` phase whose mapped REQUIREMENTS rows are not all `Complete` | adopt.md:184-186 | accurate | `skills/cad-health/SKILL.md` rule 5 - "A phase marked `- [x]` in ROADMAP whose mapped REQUIREMENTS rows are not all `Complete` ... is a status-drift issue - flag it" |
| Seeded rows are always `Pending` | adopt.md:186-187 | accurate | `plan.md:380` - "Status is always `Pending`" |
| Phase count follows `granularity`: coarse 3-5, standard 5-8, fine 8-12 | adopt.md:188-189 | accurate | `config.schema.json:7` states those three ranges verbatim |
| `planning.mjs criteria-size --roadmap-min 2 --roadmap-max 5`, no `--phase`, `roadmap_found: false` is not zero | adopt.md:200-206 | accurate | flags declared at `planning.mjs:1649-1650`; `roadmap_found` emitted at `:1701`; `--phase` optional |
| A REPORT, not a gate, exactly as `plan-size`'s `phase-too-big` is | adopt.md:206-207 | accurate | `planning.mjs:1584`, `:1645` |
| `cursor set --phase 1 --status "ready to plan" --next "/cad-context 1"` | adopt.md:229-230 | accurate | `planning.mjs:443`, `:456` |
| A phase directory is `.planning/phases/<N>/` with a bare integer, created lazily | adopt.md:233-235 | accurate | the `phase-dir-grammar` drift kind (`planning.mjs:279`) reports anything else |
| `planning.commit_docs` false skips the commit step entirely | adopt.md:239-240 | accurate | `config.schema.json:49`, default `true` |
| The protected-branch guard is `references/git-guard.md` | adopt.md:242 | accurate | present |
| ONE commit staging exactly five files: PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md, config.json | adopt.md:247-251 | accurate | those are the only files the workflow's steps write |
| Adopt REFUSES a non-repo-root and never runs `git init` | adopt.md:277-279 | accurate | no `git init` appears in the file; `new-project.md:38` is the workflow that runs it |

## minimalism-review.md

*New surface.*

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| It reuses the review subsystem's `claude-subagent` backend (`references/review-triggers.md`) | minimalism-review.md:10-13 | accurate | `claude-subagent` is one of the four `review.reviewers` enum values in `config.schema.json` |
| The list comes back in the findings schema every reviewer in the subsystem shares | minimalism-review.md:12-13, :124-126 | accurate | `references/review-triggers.md:14` states `{ findings: [ { file, line, severity: blocker\|high\|medium\|low, claim, failure_scenario } ] }` |
| It never auto-fires - no entry in the wiring table, no `review.triggers` key, no gate | minimalism-review.md:15-17, :122-123 | accurate | the wiring table (`review-triggers.md:342-344`) names only `plan`, `diff`, `phase_diff`, `risk_surface`, and `config.schema.json` carries `review.triggers` keys for exactly those |
| A phase target resolves to the committed range `.planning/phases/<N>/SUMMARY.md` records, as a `<base_ref>..<head_ref>` pair | minimalism-review.md:28-29 | accurate | SUMMARY.md carries the phase's commit hashes; the range form is the shape (a) refs pair review-triggers.md:55 defines |
| `artifact` is the target as a REFERENCE, never its bytes (`references/seams.md`'s deferred-read rule) | minimalism-review.md:45-48 | accurate | `references/seams.md` states the deferred-read rule |
| `skills/cad-reviewer-contract` defaults to correctness and rules approach differences out of scope | minimalism-review.md:63-65 | accurate | directory present; the contract is a correctness reviewer, which is why the instruction has to retarget it |
| `planning.mjs cursor get` supplies `<N>` for a path or directory target | minimalism-review.md:68-70 | accurate | `cmdCursorGet` at `planning.mjs:433` |
| `trace append --phase <N> --family lifecycle --event dispatch --plan cad-reviewer --role cad-reviewer --read "<ref>"` | minimalism-review.md:73 | accurate | `planning.mjs:60-67` declares `--family`, `--event`, `--plan`, `--role` and `--read` as ONE comma-separated value (`:2836`) |
| No routing cell resolves a model for this arm - it is the base `cad-reviewer` at the session default, at every stakes level | minimalism-review.md:77-79 | accurate | this workflow issues no `route.mjs resolve` at all, which is exactly why it writes the `dispatch` event by hand at `:73` while every other dispatch site puts the bracket ON a resolve. `route-table.json` does carry a `cad-reviewer` cell, but nothing here consults it |
| There is no cross-model arm: a provider call needs a resolved tier and this pass owns no tier key | minimalism-review.md:80-81 | accurate | no `review.triggers.minimalism*` key exists in `config.schema.json` |
| `trace close --phase <N> --plan cad-reviewer --role cad-reviewer --tokens <n>`, `--tokens` omitted on a figureless return | minimalism-review.md:84-88 | accurate | `planning.mjs:70` declares the flag set; `--tokens` is optional |
| Adding `--detail "<what failed>"` to that same line closes as a checkpoint | minimalism-review.md:90-92 | accurate | `planning.mjs:75-76` - the arm is inferred from `--detail` |
| Severity ranks are `blocker`, `high`, `medium`, `low` | minimalism-review.md:99-100 | accurate | `references/review-triggers.md:14` enumerates exactly those four |
| Each entry carries the reviewer's own `file`, `line`, `claim` and `failure_scenario` | minimalism-review.md:100-101 | accurate | same schema line |
| The delete-list is input to the user's decision exactly as `references/triage-gate.md` treats review findings | minimalism-review.md:118-120 | accurate | reference present; triage-gate.md's NONE-first default is that posture |
| It applies NOTHING, so `git status --short` is byte-identical before and after a run | minimalism-review.md:116-118, :149-150 | accurate | the workflow contains no edit, stage or commit step |

## report.md

*New surface.*

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| Everything reported is drawn from `.planning/trace.jsonl` and the phase's own artifacts; no file is written | report.md:3-5, :115-116 | accurate | the workflow's only seam calls are `trace render` and `reads`, both readers |
| Neither a phase number nor `--all` means the STATE cursor's phase (`planning.mjs cursor get`) | report.md:11-13 | accurate | `cmdCursorGet` at `planning.mjs:433` |
| `planning.mjs trace render [--phase <N>]` | report.md:21 | accurate | `renderTrace` in `lib/trace.mjs`, dispatched by `planning.mjs` |
| `planning.mjs reads --join` | report.md:22 | accurate | `planning.mjs:3644` dispatches `reads`; `--join` branches at `cmdReads` |
| The render carries `brackets` (`role`, `plan`, `event`, `ms`, `tokens`), `outcomes`, `roles`, `coordinator`, `unpaired`, `mismatched`, `capped`, `malformed` | report.md:25-29 | accurate | `lib/trace.mjs:405-417` initialises `file`, `corr`, `capped`, `counts`, `malformed`, `roles`, `events`, `brackets`, `unpaired`, `mismatched`, and `out.coordinator` is added conditionally at the tail |
| Never ask for the raw `events` array - the flag re-buys 27 KB | report.md:29-31 | unverifiable | the 27 KB figure is a measurement of one record on one machine; `events: []` is on the render (`lib/trace.mjs:414`) but the byte figure cannot be re-derived from this tree |
| `reads --join` reports `fileCalls`, `fileRedundancy`, `topFiles` over `.planning/reads.jsonl` | report.md:31-33 | accurate | `cmdReads` returns all three; `lib/read-trace.mjs:313` and `:323` define them |
| `--join` ties each record to the bracket that caused it: `joined`, `ambiguous`, `unjoined`, `floor`, `coordinator`, `unresolved` | report.md:33-34 | accurate | `cmdReads` returns exactly those six under `join`, and its comment calls them "SIX figures, not one ratio" |
| `.planning/phases/<N>/SUMMARY.md`, `REVIEW-*.md` and `reports/plan-*.md` are the grounding artifacts, the last ONLY when SUMMARY is absent | report.md:37-40 | accurate | `references/review-triggers.md:146` defines the `REVIEW-<trigger>.md` path; the executor contract writes `reports/plan-<k>.md` |
| A dispatch with no token figure reports `unrecorded`, never an estimate | report.md:58-60 | accurate | `lib/trace.mjs:62-77` states exactly that rule for the render |
| An advisory fire records no tokens, because its reviewer closes its own bracket with no `--tokens` | report.md:61-64 | accurate | `references/review-triggers.md`'s advisory persistence tail; `--tokens` is optional on `trace close` |
| A cross-model provider call records no tokens - no lifecycle bracket and no token field on that arm at all | report.md:64-66 | accurate | provider events are family `provider`; the bracket pairing in `lib/trace.mjs` runs over family `lifecycle` only |
| The coordinator residue is `coordinator.residue_ms` and the `steps[]` row carrying the most of it | report.md:67-69 | accurate | `lib/trace.mjs` builds `out.coordinator = {wall_ms, bracket_ms, residue_ms, steps}` where each step row carries `residue_ms` |
| The renderer computes it once so this line and `trace suggest` cannot disagree | report.md:69-70 | accurate | `lib/trace-suggest.mjs` reads the render rather than the raw file |
| Residue is TIME between worker brackets, never tokens; a marker carries no token figure | report.md:72-74 | accurate | the step rows carry `ts` and `residue_ms` only - no token field |
| A `mismatched` entry names `corr`, `phase`, `plan`, `ts`, `dispatched` and `closed` | report.md:75-79 | accurate | `lib/trace.mjs:332` typedefs exactly `{corr, phase, plan, ts, event, dispatched, closed}`; pushed at `:662-664` |
| The tokens stay billed to the dispatch's role | report.md:79-80 | accurate | `lib/trace.mjs:664` records `dispatched: matched.role` and leaves the accumulator on it |
| `.planning/reads.jsonl` carries NO phase scoping - it is one file per project | report.md:82-85 | accurate | `planning.mjs:2714` states "WHOLE record, no phase scoping. `reads.jsonl` has none - it is one file per project" |
| `calls: 0` or the `no reads recorded yet` note means say nothing about reading | report.md:86-89 | accurate | `cmdReads` returns `{calls: 0, ..., note: 'no reads recorded yet'}` on ENOENT |
| `floor` is a permanent LIMIT: `fork` and `general-purpose` are HOST agent types with no dispatch event to join to | report.md:93-95 | accurate | `cmdReads`'s comment states "`floor` is the permanent limit (`fork` and `general-purpose` are HOST agent types with no dispatch event, ever)" |
| `coordinator` reads have no worker bracket by construction and `unresolved` ones carried no readable agent | report.md:95-97 | accurate | same comment - "`coordinator` is the main thread, which has no worker bracket by construction; `unresolved` is a record whose `agent` field was absent or named no role" |
| `--all` renders per-phase subtotals then one milestone line | report.md:101-102 | unverifiable | a composition rule for the model's own output; `trace render` takes `--phase` or nothing and returns no per-phase rollup of its own |
| The closing pointer is `/cad-suggest`, whose rules live in `cadence-core/workflows/suggest.md` | report.md:106-107 | accurate | file present, and `suggest.md:8-11` claims to be the ONE statement of those rules |

## suggest.md

*New surface.*

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| `planning.mjs trace suggest` reads the joined trace and returns the retune the record supports | suggest.md:2-4 | accurate | `planning.mjs:2928` dispatches `suggest`; `lib/trace-suggest.mjs` computes it off the render |
| This file is the ONE statement of the presentation rules, and milestone.md's retune step and report.md's closing pointer both route here | suggest.md:8-11 | accurate | `report.md:106-107` points here by name; the rules appear in no third file |
| A phase number becomes `--phase <N>`; no argument means the WHOLE record; those are the only two scopes | suggest.md:17-20 | accurate | `planning.mjs:2936` validates `--phase` and it is the only flag accepted |
| `trace suggest`'s contract row in `cadence-core/bin/self-verify.mjs` fixes its flag set at `--phase` alone | suggest.md:20-22 | accurate | `self-verify.mjs:276` - `'trace suggest': ['--phase']` |
| There is no correlation-id scoping to reach for | suggest.md:22-23 | accurate | `corr` is derived per phase (`lib/trace.mjs:212`) and no seam takes it as a flag |
| Nothing prunes `.planning/trace.jsonl` at a close, so an unscoped run spans every milestone still in the file | suggest.md:26-28 | accurate | the milestone prune (`planning.mjs:3558`) removes phase dirs and roadmap entries, not the trace file |
| `planning.mjs trace suggest [--phase <N>]` returns `scope`, `events_read`, `suggestions`, and `capped` / `malformed` when present | suggest.md:35-39 | accurate | `lib/trace-suggest.mjs` returns that envelope; `capped` and `malformed` ride the render it reads |
| Every `kind: "suggest"` entry carries `subject`, `evidence` and `action` | suggest.md:46-49 | accurate | `lib/trace-suggest.mjs:20-21` typedefs `{kind: 'suggest'\|'info', subject, evidence, action}` |
| Every `kind: "info"` entry is one receipt line and asks for nothing | suggest.md:50-51 | accurate | same typedef; `:114-115` orders `suggest` before `info` |
| The per-role escalation evidence is denominated in `routing/resolve` events | suggest.md:57-60 | accurate | the rule reads routing-family resolve events, which is why a cross-model-only configuration inflates the denominator |
| A suggestion is input to the user's decision, exactly as `cadence-core/references/triage-gate.md` treats review findings | suggest.md:65-67 | accurate | reference present |
| The user changes keys through `/cad-config` or a direct edit of `.planning/config.json` | suggest.md:67-68 | accurate | `skills/cad-config/` present; `.planning/config.json` is the repo layer |
| The envelope offers one discriminator, `events_read`, so the thin-record arm has exactly two lines to choose between | suggest.md:73-80 | accurate | `events_read` is the only count on the envelope beside `suggestions` |
| The envelope returns no floor figure | suggest.md:83-84 | accurate | `lib/trace-suggest.mjs:15` keeps the `MIN_*` floors module-internal; none is emitted |
| Name no config key that `cadence-core/config.schema.json` does not carry | suggest.md:100-101 | accurate | schema present; this file names none |
| No config file is written - not `.planning/config.json`, not the global layer | suggest.md:92-95 | accurate | the workflow's only seam call is `trace suggest`, a reader |
| No subagent is dispatched; a suggestion cannot PASS or FAIL anything | suggest.md:96-97 | accurate | the file contains no spawn-agent call and no gate |

---

# Invocation 5 - `/cad-docs-verify cadence-core/references/{config-catalog,recall,plan-revision}.md`

**NOT new surface.** These three files carry 32 run-1 ledger rows between them
(`config-catalog.md` 29, `recall.md` 2, `plan-revision.md` 1) that no recorded
invocation ever re-read. Plan 3 joins the rows below to those existing rows on
`doc` plus claim text; nothing here goes into the post-run-1 section.

## config-catalog.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| Read at walk step 2 of `cadence-core/workflows/config.md`'s Interactive menu, which pages through the rows 4 knobs at a time | config-catalog.md:3-5 | accurate | `config.md:39` - "Walk the catalog in order, 4 knobs per `AskUserQuestion` call"; `:54` Reads this file; `:68` names it as the catalog |
| The source of truth is `cadence-core/config.schema.json`, enforced by the `bin/config.mjs` seam | config-catalog.md:5-7 | accurate | both present; `config.mjs validate` reads the schema |
| `[global]` means the user-global layer only, and a repo layer setting it is stripped at the merge and named in the read face's warnings | config-catalog.md:11-13 | accurate | `lib/global-only-keys.mjs` implements exactly that, and `config.schema.json`'s `workflow.test_command` purpose states the same |
| `granularity` enum fine/standard/coarse, default `standard`, 8-12 / 5-8 / 3-5 phases | config-catalog.md:20 | accurate | schema: enum `["fine","standard","coarse"]`, default `"standard"`, purpose states the same three ranges |
| `stakes` enum solo/shipped/critical, default `shipped` | config-catalog.md:22 | accurate | schema: enum `["solo","shipped","critical"]`, default `"shipped"` |
| `model.escalate_on_failure` bool, default `false` | config-catalog.md:23 | accurate | schema default `false` |
| `workflow.research` bool, default `false` | config-catalog.md:25 | accurate | schema default `false` |
| `workflow.plan_check` bool, default `false` | config-catalog.md:26 | accurate | schema default `false` - the catalog has this right where `new-project.md:60` and `adopt.md:55` do not |
| `workflow.verifier` bool, default `true` | config-catalog.md:27 | accurate | schema default `true` |
| `workflow.skip_discuss` bool, default `false`, and it skips no step | config-catalog.md:28 | accurate | schema default `false`; `progress.md:139` uses it only to pick the suggestion |
| `workflow.inline_plan_threshold` int, default `3` | config-catalog.md:29 | accurate | schema default `3` |
| `workflow.max_plan_tasks` int, default `8`, counted at `check_size` by `planning.mjs plan-size` | config-catalog.md:30 | accurate | schema default `8`; `plan.md:237-243` is the `check_size` step running `plan-size` |
| `workflow.test_command` `[global]`, type `str or null`, default `null` | config-catalog.md:31 | accurate | schema `string_or_null`, default `null`, `src: global` |
| `workflow.lint_command` `[global]`, LINT only - there is no typecheck key | config-catalog.md:32 | accurate | schema carries `workflow.lint_command` and no typecheck key at all; `planning.mjs detect-commands` is what supplies the typecheck when unset |
| `parallelization.enabled` true, `max_concurrent_agents` 3, `min_plans_for_parallel` 2, `use_worktrees` true | config-catalog.md:34-37 | accurate | schema defaults `true`, `3`, `2`, `true` |
| `git.protected_branches` list, default `main, master` | config-catalog.md:39 | accurate | schema `array_string`, default `["main","master"]` |
| `git.on_protected` enum ask/refuse/allow, default `ask` | config-catalog.md:40 | accurate | schema enum and default match |
| `git.integration_branch` enum milestone/trunk, default `milestone`; where worktrees fork FROM is the host's `worktree.baseRef` | config-catalog.md:41 | accurate | schema enum and default match; `references/worktree-executor.md:12` - "the fork point comes from the host's `worktree.baseRef` setting" |
| `git.auto_branch` enum ask/auto/off, default `ask` | config-catalog.md:42 | accurate | schema enum and default match |
| `git.base_branch` type `str or null`, default `null` | config-catalog.md:43 | accurate | schema `string_or_null`, default `null` |
| `git.create_tag` true, `git.on_land_cleanup` true, `git.auto_close` false | config-catalog.md:44-46 | accurate | schema defaults `true`, `true`, `false` |
| `git.auto_close` carries no `[src]` marker | config-catalog.md:46 | accurate | the legend makes no-marker and `[repo]` the same reading, so nothing a user reads is wrong. Noted for the ledger: the schema does carry `"src": "repo"` for this one key, so it is the single row whose marker does not mirror the schema field the legend describes |
| `git.auto_close` halts on a surviving blocker/high `risk_surface` finding | config-catalog.md:46 | accurate | `references/review-triggers.md:299-307` - the persisted survivors are what `land-cleanup.mjs gate` unions, and that gate is the halt |
| `planning.commit_docs` bool, default `true` | config-catalog.md:48 | accurate | schema default `true` |
| `memory.backend` enum builtin/none, default `builtin` | config-catalog.md:50 | accurate | schema enum `["none","builtin"]`, default `"builtin"` |
| A `**Risk**` knob category exists | config-catalog.md:51 | **stale** | the section header carries ZERO rows, and `config.schema.json` holds no key beginning `risk` at all - the whole `risk.override.*` family is retired in `lib/retired-keys.mjs` `since: 'v2.7.0'`. Correct: delete the header; there is no risk knob to page through |
| `review.reviewers` list(enum) over claude-subagent/openai/gemini/deepseek, default `claude-subagent` | config-catalog.md:53 | accurate | schema `array_enum`, those four values, default `["claude-subagent"]` |
| `review.mode` enum single/panel/adjudicated, default `adjudicated` | config-catalog.md:54 | accurate | schema enum and default match |
| `review.key_file` `[global]`, type `str or null`, default `null` | config-catalog.md:55 | accurate | schema `string_or_null`, default `null`, `src: global` |
| `review.request_timeout_ms` int, default `540000`, clamped to the 600000 host ceiling | config-catalog.md:56 | accurate | schema default `540000`; `review-provider.mjs:239` `MAX_REQUEST_TIMEOUT_MS = 600000` with `:231` naming it the host's command cap |
| `review.max_prompt_tokens` int, default `120000`, chars/4 estimated, over-cap refused before any request, cross-model only | config-catalog.md:57 | accurate | schema default `120000`; `review-provider.mjs:29` states "chars/4 estimated, default 120000" and `:101` that `assertUnderCap`'s `over-cap` unwinds BEFORE a request is built |
| `review.consult.enabled` false, `.tier` flagship, `.effort` high, `.attempt_threshold` 3 | config-catalog.md:58-61 | accurate | schema defaults `false`, `"flagship"`, `"high"`, `3` |
| `review.triggers.<t>.gate` defaults: `adjudicated` for plan, `advisory` for diff/phase_diff, `blocking` for risk_surface | config-catalog.md:62 | accurate | schema: plan `adjudicated`, diff `advisory`, phase_diff `advisory`, risk_surface `blocking` |
| `review.triggers.<t>.tier` default `flagship`, except `balanced` for diff - cross-model only | config-catalog.md:63 | accurate | schema: plan/risk_surface/phase_diff `flagship`, diff `balanced` |
| `review.triggers.<t>.effort` default `high`, except `medium` for diff - cross-model only | config-catalog.md:64 | accurate | schema: plan/risk_surface/phase_diff `high`, diff `medium` |
| `review.triggers.risk_surface.surfaces` list(enum) over the eight surfaces, unset means all eight and the first fire asks once | config-catalog.md:65 | accurate | schema `array_enum`, default `null`, values exactly `auth`, `migrations`, `billing`, `concurrency`, `destructive`, `secrets`, `api_contract`, `untrusted_input` |
| `<t>` is `{plan, diff, risk_surface, phase_diff}` | config-catalog.md:67-68 | accurate | those are exactly the four trigger names carrying `review.triggers.*` keys in the schema |
| Every write goes through the Validation seam; a value outside its set is rejected, never written | config-catalog.md:69-70 | accurate | `config.mjs set` validates against the schema before writing |

## recall.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| Two commands call `planning.mjs recall` - `/cad-context` at `analyze` and `/cad-debug` at Hypothesize - and the contract is stated here once instead of drifting in two workflows | recall.md:3-6 | **stale** | THREE commands call it. `plan.md:117` runs `planning.mjs recall` at `spawn_planner`, and `:182` runs "the same gated recall" at `inline_plan`. `plan.md` also does not Read this file: it restates the return shape inline at `:120`, which is precisely the drift this file says it prevents. Correct: three commands - `/cad-context` at `analyze`, `/cad-debug` at Hypothesize, and `/cad-plan` at `spawn_planner` and `inline_plan` |
| The `memory.backend` `builtin`/`none` gate is deliberately NOT here - it stays inline at every calling site | recall.md:8-11 | accurate | `context.md:93` and `:101-103`, `debug.md:62`, and `plan.md:107-111` each carry the gate inline |
| `planning.mjs recall "<terms>"` prints one JSON line `{ok, results:[{score, source, phase?, snippet}], total}` | recall.md:15-19 | accurate | `planning.mjs:1953-1962` returns exactly `score`, `source`, conditional `phase`, `snippet`, plus `total` |
| `results` is ranked best first and BOUNDED - `--top N` returns at most N, default 5 | recall.md:21-23 | accurate | `planning.mjs:1888` `let top = 5`; `:1889-1892` validates `--top` as a positive integer |
| `total` is how many matched, so a truncated answer reads as truncated | recall.md:23-25 | accurate | `planning.mjs:1962` returns `total: matched.length`, before the slice |
| Unbounded, a real query returned 72 results at 55.8 KB; the same query bounded is 953 B | recall.md:26-30 | unverifiable | a one-off measurement against a `.planning/` tree at a past state; nothing in this repo lets it be re-derived |
| `phase` is OPTIONAL - a phaseless `CAPTURE.md` item omits it; never substitute a blank or an inferred number | recall.md:34-36 | accurate | `planning.mjs:1957` emits `phase` only when `c.phase !== undefined` |
| /cad-context renders the top results as a `<recalled_memory>` block placed right after `<search_terms>` | recall.md:40-43 | accurate | `context.md:177-178` - `<search_terms>` then `<recalled_memory>` on the next line |
| Those snippets ride the DISPATCH PROMPT and never the `cad-assumptions-analyzer` definition | recall.md:45-49 | accurate | the block sits inside the payload at `context.md:178`; `agents/cad-assumptions-analyzer*.md` carries no recall data |
| /cad-debug has no block and no payload - there is no debug subagent | recall.md:52-54 | accurate | `debug.md:80` states "D-02: there is no debug subagent, the main model runs the method inline" |
| /cad-debug folds matching past deviations and UAT findings into the Hypotheses list with `source` and `phase` | recall.md:54-56 | accurate | `debug.md:91` - "deviations and UAT findings fold into the Hypotheses list" |

## plan-revision.md

| claim | location | verdict | correct value (if stale) |
|---|---|---|---|
| Read at `<step name="check_gate">` in `cadence-core/workflows/plan.md`, on the one arm that reaches it - `## ISSUES FOUND` with at least one BLOCKER | plan-revision.md:3-5 | accurate | `plan.md:263` is that step and `:303-305` Reads this file on the BLOCKER arm alone, calling it "one consult site - this step" |
| ONE revision maximum, with step 3 enforcing the bound | plan-revision.md:5-6, :61-63 | accurate | step 3 ends the arm with an ask and "Never loop again"; `plan.md:412` carries the same hard cap |
| The re-dispatch is FRESH, never a resume, and the plan on disk preserves its grounding | plan-revision.md:8-11 | accurate | `plan.md:165-166` states the same for revision mode |
| `--attempt 2` makes the routing seam climb to the retry rung this level's cad-planner cell names | plan-revision.md:10-12 | accurate | `route.mjs:371-374` escalates when `(opts.attempt \|\| 1) > 1`, to the max of the cell's retry rung and the rung the attempt started at |
| The bracket rides the `--attempt 2` resolve with the same read-set spawn_planner uses | plan-revision.md:14-16 | accurate | the four paths listed match `plan.md:99` byte for byte |
| `trace close --phase <N> --plan cad-planner --role cad-planner --tokens <n>` closes it at the end of THIS step | plan-revision.md:22-24 | accurate | `planning.mjs:70` declares that flag set |
| An empty or unmarked return carries `--detail` and the seam closes it as a checkpoint | plan-revision.md:26-28, :54-55 | accurate | `planning.mjs:75-76` - the arm is inferred from `--detail` |
| The narrowed checker re-dispatch uses `--bracket-read ".planning/phases/{N}/PLAN*.md"`, narrower than check_gate's | plan-revision.md:29-31 | accurate | `plan.md:267`'s check_gate bracket names four paths; this one names one |
| Its artifact is the revision's own diff, `git diff -- .planning/phases/{N}/PLAN*.md` | plan-revision.md:33-35 | accurate | a real git invocation over the plan glob |
| Measured, a full re-read was ten minutes to convert two blockers into one | plan-revision.md:38-40 | unverifiable | a past timing measurement with no artifact in this repo to re-derive it from |
| `trace close --phase <N> --plan cad-plan-checker --role cad-plan-checker --tokens <n>` | plan-revision.md:51 | accurate | same declared flag set |
| The per-file census asserts one `trace close` per dispatch moment, so folding these two into one close reddens the suite | plan-revision.md:57-60 | accurate | `cadence-core/bin/trace.test.mjs:1040` opens "the producer census"; `:1252` reasons about "prose lines per dispatch moment - a `return` form and a `checkpoint`" |
| `plan.md`'s own `review` step is the full-artifact second opinion and fires AFTER this | plan-revision.md:44-46 | accurate | `plan.md:311` `<step name="review">` follows `:263` `check_gate` |
