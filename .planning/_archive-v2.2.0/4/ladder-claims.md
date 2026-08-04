# Phase 4 audit roster: every live rung-ladder claim

DOC-01's audit half. Assembled at task 1 against HEAD `7b95c49`, BEFORE any code
in this phase moved, so the roster is a claim about the tree as shipped rather
than about this phase's own output. Finalized at task 9 by re-running the same
grep against the post-retune tree and reconciling it row by row.

**FINAL: 50 rows. 41 `true`, 9 `corrected`, 0 `removed`, 0 left contradicting
the table.** The nine corrected: rows 19 and 20 (the reviewer rung per level
and its worked example), 24 (three catalog-less sets became four), 25 and 26
(the plan-checker contract's two-files/two-rungs/auto-mode block and its
frontmatter description), 46 (the six new reach rows and schema purposes -
the phase's own "floored" claim was refuted for the two pre-plan roles by the
diff review and corrected), 48 (the rule comment in `bin/`), 49 (the dated
CHANGELOG paragraph, corrected FORWARD) and 50 (the pre-`5b8728d` wording,
corrected before this phase and re-verified in it).

## The grep (task 1, re-run verbatim at task 9)

```
grep -rn -E 'rung|retry|escalat|effort|ladder|climbs' \
  README.md INTERNALS.md METHOD.md cadence-core/references/ \
  cadence-core/workflows/ agents/ skills/
```

plus, for `CHANGELOG.md`, the `## [Unreleased]` section ALONE:

```
sed -n '7,88p' CHANGELOG.md | grep -n -E 'rung|retry|escalat|effort|ladder|climbs'
```

Scope is D-06: LIVE surfaces only. `DESIGN.md`, `LINEAGE.md` and every dated
`CHANGELOG.md` section are append-only records corrected FORWARD, never
rewritten, and a repo-wide grep over them is the failure `.planning/CAPTURE.md:143`
records from phase 3. `cadence-core/bin/` is outside the grep too (it is code,
not shipped prose); task 8 corrected one comment there and row 48 below records
it by hand.

## Counts

| | Task 1 (HEAD `7b95c49`) | Task 9 (post-retune) |
|---|---|---|
| Raw hits over the live surfaces | 191 | 206 |
| Hits classified as NON-claims | 124 | 124 |
| Hits that state a ladder claim | 67 | 82 |
| `## [Unreleased]` hits | 0 | 0 (its new entry names cells and rungs, not the grep's tokens) |
| Roster rows | 44 | 50 |

All 15 hits the re-run added are prose THIS phase authored: task 2's and task
3's documentation of the new `model.effort` family (8 lines of the new
`seams.md` bullet, 6 `config-reach.md` reach rows, 1 line of the `config.md`
carve-out sentence). No hit the re-run found was missing from the roster's
subject matter; one CLAIM the token grep cannot see was found by reconciliation
and added as row 47.

Five rows the path-scoped grep cannot produce: rows 26, 47, 48, 49 and 50. Row
24 was grep-less at task 1 and became grep-backed when task 2 corrected it.

The non-claim classes, so the filtering is recorded rather than silent:

| Class | Hits | Why it is not a ladder claim |
|---|---|---|
| `agents/*.md` frontmatter `effort:` | 19 | Data, not prose. It is the ground truth check 7b (`rungEffortIssue`) holds the map against. |
| `agents/*.md` rung-template body (`Your rung is ...` / `... names that contract and your rung ...`) | 38 | The canonical body `lib/rung-agent.mjs:rungBody` states; it names the file's OWN rung, which check 7b already proves against the map. |
| `cadence-core/references/model-hints.json` `high_effort` | 21 | Provider tier data for cross-model review-model detection. Nothing to do with the rung ladder. |
| Cross-model `effort` config prose (`references/provider-api.md` 4, `references/consult.md` 3, `references/config-reach.md` 8, `workflows/decision-review.md` 7, `workflows/config-review.md` 2, `workflows/config.md` 3, `references/review-triggers.md` 4, `references/seams.md` 4, `skills/cad-plan-review` 1, `skills/cad-decision-review` 2, `skills/cad-reviewer-contract:58` 1) | 39 | `review.*.effort` is the provider API's reasoning parameter, a different dial from the rung ladder; `route-table.json` can never contradict it. |
| Incidental vocabulary (`METHOD.md:135,177`, `workflows/debug.md:135`, `skills/cad-executor-contract:70`, `skills/cad-assumptions-analyzer-contract:86`, `skills/cad-plan-checker-contract:11`, `INTERNALS.md:45`) | 7 | "does not retry with a similar name", "Verification climbs four levels", "effort and good intentions count for nothing" - the words, not the subject. |
| | **124** | |

## Evidence: the live 18-cell walk, before and after the retune

Hermetic (`CADENCE_GLOBAL_CONFIG` at a non-existent path, a temp repo config per
level, no `.planning/STATE.md` so no risk floor fires). Every verdict below is
backed by this walk or by a `route.mjs table` read, never by reading the JSON by
eye.

| stakes | role | attempt 1 (task 1) | attempt 2 (task 1) | attempt 1 (task 9) | attempt 2 (task 9) | escalated now |
|---|---|---|---|---|---|---|
| solo | cad-planner | high / cad-planner | xhigh / cad-planner-xhigh | high / cad-planner | xhigh / cad-planner-xhigh | true |
| solo | cad-assumptions-analyzer | high / cad-assumptions-analyzer-high | xhigh / cad-assumptions-analyzer | high / cad-assumptions-analyzer-high | xhigh / cad-assumptions-analyzer | true |
| solo | cad-verifier | high / cad-verifier | xhigh / cad-verifier-xhigh | high / cad-verifier | xhigh / cad-verifier-xhigh | true |
| solo | cad-reviewer | medium / cad-reviewer-medium | high / cad-reviewer | medium / cad-reviewer-medium | high / cad-reviewer | true |
| solo | cad-executor | high / cad-executor | xhigh / cad-executor-xhigh | high / cad-executor | xhigh / cad-executor-xhigh | true |
| solo | cad-plan-checker | low / cad-plan-checker | high / cad-plan-checker-high | low / cad-plan-checker | high / cad-plan-checker-high | true |
| shipped | cad-planner | high / cad-planner | xhigh / cad-planner-xhigh | high / cad-planner | xhigh / cad-planner-xhigh | true |
| shipped | cad-assumptions-analyzer | high / cad-assumptions-analyzer-high | xhigh / cad-assumptions-analyzer | high / cad-assumptions-analyzer-high | xhigh / cad-assumptions-analyzer | true |
| shipped | cad-verifier | medium / cad-verifier-medium | high / cad-verifier | medium / cad-verifier-medium | high / cad-verifier | true |
| **shipped** | **cad-reviewer** | high / cad-reviewer | xhigh / cad-reviewer-xhigh | **xhigh / cad-reviewer-xhigh** | **xhigh / cad-reviewer-xhigh** | **false (RETUNED)** |
| shipped | cad-executor | high / cad-executor | xhigh / cad-executor-xhigh | high / cad-executor | xhigh / cad-executor-xhigh | true |
| shipped | cad-plan-checker | medium / cad-plan-checker-medium | high / cad-plan-checker-high | medium / cad-plan-checker-medium | high / cad-plan-checker-high | true |
| critical | cad-planner | xhigh / cad-planner-xhigh | max / cad-planner-max | xhigh / cad-planner-xhigh | max / cad-planner-max | true |
| critical | cad-assumptions-analyzer | xhigh / cad-assumptions-analyzer | xhigh / cad-assumptions-analyzer | xhigh / cad-assumptions-analyzer | xhigh / cad-assumptions-analyzer | false |
| critical | cad-verifier | xhigh / cad-verifier-xhigh | max / cad-verifier-max | xhigh / cad-verifier-xhigh | max / cad-verifier-max | true |
| critical | cad-reviewer | xhigh / cad-reviewer-xhigh | max / cad-reviewer-max | xhigh / cad-reviewer-xhigh | max / cad-reviewer-max | true |
| critical | cad-executor | xhigh / cad-executor-xhigh | xhigh / cad-executor-xhigh | xhigh / cad-executor-xhigh | xhigh / cad-executor-xhigh | false |
| **critical** | **cad-plan-checker** | high / cad-plan-checker-high | xhigh / cad-plan-checker-xhigh | **xhigh / cad-plan-checker-xhigh** | **xhigh / cad-plan-checker-xhigh** | **false (RETUNED)** |

**16 escalate / 2 hold at task 1; 14 escalate / 4 hold after the retune.** All 19
rung files stay cell-reachable either way: `agents/cad-plan-checker-high.md`
through solo's and shipped's retry, and the unsuffixed `agents/cad-reviewer.md`
(its `high` rung) through solo's. `self-verify` confirms it mechanically -
`undeclared-rung-agent` and `missing-rung-agent` both stay silent.

## Roster

Task-1 verdicts are `true` / `contradicts the table` / `stale`. Final verdicts
are `true` / `corrected` / `removed`.

| # | file:line | The claim, in the author's own words | Task-1 verdict | FINAL verdict |
|---|---|---|---|---|
| 1 | README.md:27 | "routing (one question about what a break costs, four knobs out - model, effort rung, review gates, deep verify)" | true - a resolve returns exactly `{model, effort, review, verify}` | **true** - unchanged by the retune |
| 2 | README.md:39 | "a grid of 18 cells, one per level and role pair ... At `solo` the planner runs Sonnet at `high`. At `shipped` it runs Opus. At `critical` it runs Opus at `xhigh` and a retry goes to `max`." | true - 18 cells; walk rows 1, 7, 13 confirm each sentence | **true** - re-checked against the RETUNED table specifically: the retune moves two cells, neither of them `cad-planner`, and the count stays 18 |
| 3 | README.md:41 | "The rungs are `low`, `medium`, `high`, `xhigh`, `max`. ... a rung is a real file on disk and self-verify fails in both directions, on a cell naming a rung with no file and on a rung file no cell reaches." | true - `rung_order` is exactly those five; check 8's two arms are the both-directions claim | **true** - and still both-directions clean after the retune |
| 4 | README.md:43 | "Escalation is one key, `model.escalate_on_failure`, on by default. A failed attempt gets re-dispatched at the retry rung its own cell names ... Set it false and the retry holds where it started." | true - schema default `true`; walk column 4 is the per-cell retry rung | **true** - the key's two arms are untouched; a configured start rung now raises the retry floor but never replaces the key |
| 5 | README.md:130 | "Today it is 23 skills and 6 agent roles across 19 rung files." | true - 23 non-contract skills (+6 contract skills), 6 roles in `RUNG_FILES`, 19 distinct rung files | **true** - this phase adds no agent file and no skill |
| 6 | INTERNALS.md:9 | "You cannot override its reasoning effort. Effort is frozen in the agent's frontmatter when the file is written." | true - the host constraint the whole ladder rests on; `route.mjs` reports effort and never sets it | **true** - `model.effort.<role>` selects WHICH file, never a per-dispatch effort |
| 7 | INTERNALS.md:11 | "a rung is an agent file whose frontmatter carries that effort ... 19 files cover the six roles ... Three things keep the price honest: CI refuses a rung a cell names with no file, and the stale reverse ...; it refuses a rung file that carries any instruction of its own ...; and it refuses a rung file whose frontmatter effort is not the rung the map filed it under." | true - 19 files, 6 roles; the three CI guarantees are check 8's reachability arms, `rungBodyIssue`, and check 7b `rungEffortIssue` | **true** - and now understated: check 8b proves the schema enums match the map too |
| 8 | INTERNALS.md:13 | "A cell is not a model, it is the whole quality bundle: which model, which rung to start at, which rung a failed attempt climbs to, which review gates fire, and whether the deep verify pass runs. ... CI refuses a retry rung that sits below the rung it started on, so a retry can never think less while reporting that it thought more." | true - the bundle is the four knobs plus `retry`; `lib/route-cells.mjs`'s `rung-demotion` is the CI refusal | **true** - and the second sentence is now true of the CONFIG layer as well (D-02): a configured start out-ranking the cell's retry holds instead of stepping down |
| 9 | INTERNALS.md:15 | "routing governs the subagents Cadence dispatches, not your main session. Cadence cannot set your orchestrator's model or effort" | true - every resolve is consumed by a spawn-agent dispatch; nothing writes host session settings | **true** |
| 10 | INTERNALS.md:17 | "`cadence-core/route-table.json` (the three grids - 18 cells, the review gates, the verify switch - plus the risk surfaces, all editable data, no code change to retune)" | true - 18 cells counted off the table; three grids plus `surfaces` | **true** - and the retune is the existence proof of "no code change to retune": task 8 changed two literals in that file |
| 11 | cadence-core/references/seams.md:44-50 | "Effort is NOT per-dispatch overridable: it is fixed in agent frontmatter per FILE ... A cell names the rung and `cadence-core/bin/lib/rung-agent.mjs` names the file that carries it (`cad-plan-checker` at `medium` -> `cad-plan-checker-medium`) ... Self-verify fails in both directions" | true - the worked example matches `RUNG_FILES['cad-plan-checker'].medium` | **true** - the worked example survives the retune: it cites the MAP, which the retune did not touch, and `shipped`/`cad-plan-checker` still starts at `medium` |
| 12 | cadence-core/references/seams.md:52-55 | "A re-dispatch (revision, continuation, escalation) is a NEW spawn that reads the prior artifact from disk" | true - `--attempt 2` returns a different agent FILE, which can only be a fresh spawn | **true** |
| 13 | cadence-core/references/seams.md:97-101 | "One resolve returns FOUR knobs, not a model: `model` and `effort` for this dispatch, `review` ... and `verify`" | true - the resolve envelope carries all four | **true** |
| 14 | cadence-core/references/seams.md:112-117 | "Pass `--attempt 2` (3, ...) ... the re-dispatch climbs to the retry rung the SAME cell names, and swaps to that rung's file. That happens at EVERY stakes level, and `model.escalate_on_failure: false` is the off switch. Where the retry rung equals the starting rung, `reason` says the rung was held and `escalated` stays false" | true - walk column 4 at all three levels; the two held cells report `escalated:false` | **true** - re-checked against the RETUNED table specifically, since the retune is what could have falsified it: the sentence never states HOW MANY cells hold, so four holding cells satisfy it exactly as two did, and all four report `escalated:false` |
| 15 | cadence-core/references/seams.md:118-119 | "Use the returned `agent` and `model` in the dispatch. `escalated`/`reason` are for logging why." | true - both fields are present on every `ok:true` resolve | **true** |
| 16 | cadence-core/references/seams.md:130-131 | "the level never reacts to `--attempt` by itself - a retry climbs the rung, not the level" | true - `--attempt` is read only inside the escalation arm, after `stakes` is fixed | **true** |
| 17 | cadence-core/references/seams.md:132-136 | "`model.overrides` maps one role to one model alias ... effort is untouched, so a pinned role still climbs to its retry rung file. `haiku` and `fable` are reachable this way ONLY - the routed vocabulary is `sonnet` and `opus`." | true - the pin arm writes `model` only; `cells` name only `sonnet`/`opus`, `model_aliases` carries four | **true** - the pin arm still writes `model` alone; the start rung is a separate map with a separate writer |
| 18 | cadence-core/references/review-triggers.md:37-44 | "The `claude-subagent` backend can honour neither: its model and its rung both come from the routing seam, and effort is definition-time only on the spawn-agent seam" | true - same host constraint as row 6 | **true** |
| 19 | cadence-core/references/review-triggers.md:75-84 (the enumeration half, lines 75-80) | "That agent is the reviewer rung the LEVEL names - `cad-reviewer-medium` at solo, `cad-reviewer` at shipped, `cad-reviewer-xhigh` at critical, and `cad-reviewer-max` when a critical-level fire is re-dispatched with `--attempt 2`." | true AT HEAD (walk rows 4, 10, 16) - and this is the one live claim task 8's retune falsifies: shipped/cad-reviewer becomes `xhigh` | **corrected** - now reads `cad-reviewer-medium` at solo, `cad-reviewer-xhigh` at shipped AND critical, `cad-reviewer-max` on a critical `--attempt 2`, with the unsuffixed `cad-reviewer` named as the `high` rung reachable only through solo's retry |
| 20 | cadence-core/references/review-triggers.md:81-87 (the worked example inside the cited 75-84 block, on line 83) | "e.g. \"`diff` is configured at effort `medium`; the shipped level dispatches `cad-reviewer`, pinned at `high`, so it runs `high`\"" | true AT HEAD (walk row 10) - falsified by task 8's retune along with row 19 | **corrected** - now `cad-reviewer-xhigh`, pinned at `xhigh` (line 85). The example still TEACHES its rule permanently: `review.triggers.diff.effort`'s enum tops out at `high` (`config.schema.json`), so no configured value can ever equal `xhigh` and make it self-cancel |
| 21 | cadence-core/references/config-reach.md:105 | "`model.escalate_on_failure` \| universal \| `bin/route.mjs` - whether a failed attempt climbs to the cell's retry rung" | true - that is exactly the key's one effect | **true** |
| 22 | cadence-core/workflows/plan.md:210-215 | "the routing seam climbs the re-dispatch to the retry rung this level's cad-planner cell names, and dispatches that rung's file ... (the seam climbs it to the retry rung its own cell names, and returns the file for it - never a rung name this prose hardcodes)" | true - the prose hardcodes no rung; walk column 4 supplies it per level | **true** - hardcoding no rung is exactly why the retune could not falsify it |
| 23 | cadence-core/workflows/config.md:80 | "`model.escalate_on_failure` \| bool \| Re-dispatch a failed attempt at the role's harder rung \| `true`→retry at the rung the role's own cell names · `false`→hold the retry at the rung it started on \| true" | true - matches the schema default and the resolver's two arms | **true** |
| 24 | cadence-core/workflows/config.md:29-32 (sentence opened on line 27; grep-less at task 1, grep-backed now) | "Three sets stay edit-the-file-only and have no catalog row: `review.providers.*` ...; the six `model.overrides` role pins ...; and `review.decision_review`'s two keys" | true AT HEAD - task 2 ships a FOURTH catalog-less set (the six `model.effort` per-role start rungs) and must update the sentence in the same commit | **corrected** - reads "Four sets" and names the six `model.effort` per-role start rungs beside the `model.overrides` pins (D-09: reach rows and a schema `purpose`, no interactive-catalog rows) |
| 25 | skills/cad-plan-checker-contract/SKILL.md:19-26 | "the rung is the only thing that differs between the two files preloading this contract. `low` is the base gate. `high` is the escalation variant, dispatched when a normal-effort check was insufficient (a prior pass failed, or auto mode judged the plan hard)" | **contradicts the table**, on three counts: FOUR files preload this contract (`cad-plan-checker`, `-medium`, `-high`, `-xhigh`); the role has four rungs (`low`/`medium`/`high`/`xhigh`), not two; and "auto mode" is `model.profile: auto`, retired in v2.0.0 | **corrected** - names the four files and the four rungs, drops the retired mode, and keeps the block's one real instruction (reason harder and be stricter on borderline BLOCKER vs WARNING calls the higher the rung; what is checked and how it is reported is identical at every rung). `grep -rn "auto mode" skills/ cadence-core/ agents/` now returns nothing |
| 26 | skills/cad-plan-checker-contract/SKILL.md:3 (no grep token; added by hand) | "Internal role contract, preloaded into the cad-plan-checker and cad-plan-checker-high subagents." | **contradicts the table** - the same two-files claim as row 25, in frontmatter; every other role's contract already reads "every cad-\<role\> rung agent" | **corrected** - "preloaded into every cad-plan-checker rung agent", the phrasing the other five contract descriptions already use |
| 27 | skills/cad-planner-contract/SKILL.md:3 | "preloaded into every cad-planner rung agent" | true - all 3 planner rung files preload it | **true** |
| 28 | skills/cad-assumptions-analyzer-contract/SKILL.md:3 | "preloaded into every cad-assumptions-analyzer rung agent" | true - both analyzer rung files preload it | **true** |
| 29 | skills/cad-verifier-contract/SKILL.md:3 | "preloaded into every cad-verifier rung agent" | true - all 4 verifier rung files preload it | **true** |
| 30 | skills/cad-reviewer-contract/SKILL.md:3 | "preloaded into every cad-reviewer rung agent" | true - all 4 reviewer rung files preload it | **true** |
| 31 | skills/cad-executor-contract/SKILL.md:3 | "preloaded into every cad-executor rung agent" | true - both executor rung files preload it | **true** |
| 32 | agents/cad-planner-xhigh.md:3 | "The `xhigh` rung of `cad-planner`. Dispatched by the routing seam (`bin/route.mjs`) when the effort ladder resolves this rung" | true - reached at solo/shipped retry and critical start | **true** - unchanged by the retune |
| 33 | agents/cad-planner-max.md:3 | "The `max` rung of `cad-planner` ..." | true - reached at critical retry | **true** |
| 34 | agents/cad-assumptions-analyzer-high.md:3 | "The `high` rung of `cad-assumptions-analyzer` ..." | true - reached at solo/shipped start | **true** |
| 35 | agents/cad-verifier-medium.md:3 | "The `medium` rung of `cad-verifier` ..." | true - reached at shipped start | **true** |
| 36 | agents/cad-verifier-xhigh.md:3 | "The `xhigh` rung of `cad-verifier` ..." | true - reached at solo retry and critical start | **true** |
| 37 | agents/cad-verifier-max.md:3 | "The `max` rung of `cad-verifier` ..." | true - reached at critical retry | **true** |
| 38 | agents/cad-reviewer-medium.md:3 | "The `medium` rung of `cad-reviewer` ..." | true - reached at solo start | **true** |
| 39 | agents/cad-reviewer-xhigh.md:3 | "The `xhigh` rung of `cad-reviewer` ..." | true - reached at shipped retry and critical start | **true** - and now reached at the shipped START as well |
| 40 | agents/cad-reviewer-max.md:3 | "The `max` rung of `cad-reviewer` ..." | true - reached at critical retry | **true** |
| 41 | agents/cad-executor-xhigh.md:3 | "The `xhigh` rung of `cad-executor` ..." | true - reached at solo/shipped retry and critical start | **true** |
| 42 | agents/cad-plan-checker-medium.md:3 | "The `medium` rung of `cad-plan-checker` ..." | true - reached at shipped start | **true** |
| 43 | agents/cad-plan-checker-high.md:3 | "The `high` rung of `cad-plan-checker` ..." | true - reached at solo/shipped retry and critical start | **true** - the retune takes away its critical START and leaves solo's and shipped's retry, so it does not go stale (`undeclared-rung-agent` silent) |
| 44 | agents/cad-plan-checker-xhigh.md:3 | "The `xhigh` rung of `cad-plan-checker` ..." | true - reached at critical retry | **true** - and now at the critical START too |
| 45 | cadence-core/references/seams.md:147-157 (new at task 2/3/4) | "**Per-role start rung.** The `model.effort` family names the rung a role STARTS at ... the accepted values are exactly that role's own rungs ... It raises freely and never lowers a floor ... A retry never resolves below it either" | (did not exist at task 1) | **true** - every sentence is a pinned `route.test.mjs` row: the layered read, the four start-rung arms, the three floor rows and the retry-hold row |
| 46 | cadence-core/references/config-reach.md:106-111 (new at task 2) | six rows, "`model.effort.<role>` \| universal \| `bin/route.mjs` - selects the rung this role starts at, replacing the cell's, floored by any detected risk surface" | (did not exist at task 1) | **corrected** - the diff review refuted "floored" for the two PRE-PLAN roles (`cad-planner`, `cad-assumptions-analyzer`): `riskFloor` returns no surfaces for a role dispatched before the PLAN it reads exists, so their reach rows and schema `purpose` strings now state the floor does not reach them; the four post-plan rows stand, check 9 proves each row names a real schema key, and check 8b proves each key's enum is that role's rung set |
| 47 | cadence-core/workflows/decision-review.md:45-50 (no grep token on the claim line; found by the task-9 reconciliation, not by the grep) | "No routing cell resolves a model for this arm - it is the base `cad-reviewer` at the session default, at every stakes level" | (not rostered at task 1) | **true** - `/cad-decision-review`'s claude-subagent arm deliberately does not route, so the retune cannot falsify it. Rostered because a reader could mistake it for a cell claim about `cad-reviewer` |
| 48 | cadence-core/bin/lib/route-cells.mjs:212 (code, outside the audit grep by D-06) | "Equal is legal (two shipped cells hold their rung); only a strict demotion fires." | (out of grep scope at task 1) | **corrected** at task 8 - reads "four cells in the shipped table hold their rung". The ambiguous noun was dropped rather than the number swapped: three of the four are `critical` cells and one is `shipped`, so "two shipped cells" -> "four shipped cells" would have replaced a stale count with a false one |
| 49 | CHANGELOG.md:191-198 at plan time, `CHANGELOG.md:210-218` today (entries prepend, so the paragraph moves down as the file grows; the phase goal and ROADMAP SC2 both cite it as `CHANGELOG.md:52`, which is unrelated tokenizer prose now) | "**Escalate-on-failure is unconditional, and the rung ladder is reachable.** ... Every role climbs: the fixed per-role escalation target that made five of six retries a no-op is gone, and the two cells whose retry deliberately equals their starting rung report the rung as held rather than claiming an escalation." | true at task 1 (2 held cells) - falsified by task 8's retune | **corrected** (forward, never rewritten - D-06). The dated `[2.0.0]` section stands as written; `## [Unreleased]` now carries the retune entry, which states that where `[2.0.0]` says "the two cells whose retry deliberately equals their starting rung" it now reads four, and records the post-retune live count (14 escalate, 4 hold) |
| 50 | `CHANGELOG.md`'s pre-`5b8728d` wording (git history; no live line to cite) | the rung ladder is "reachable on a default install" - the broader claim `5b8728d` narrowed to "what the route table declares" at the v2.0.0 close | (corrected before this phase; D-05 requires re-verification, not a second fix) | **corrected at `5b8728d`, re-verified.** Settled by a live `route.mjs resolve` walk over all 18 cells at attempts 1 and 2, twice: 16 escalate / 2 hold at task 1, and 14 escalate / 4 hold after the retune. The shipped sentence names no count, so both walks satisfy it; `.planning/CAPTURE.md:114` records the pre-correction position the code now contradicts |

## What the audit did NOT do

- It corrected only claims the table CONTRADICTS. Documenting the new
  `model.effort` family was task 2's job and is recorded here as rows 24, 45 and
  46 rather than re-done.
- It rewrote no append-only record. `DESIGN.md` §6, `LINEAGE.md` and every dated
  `CHANGELOG.md` section are corrected FORWARD (row 49) - the roster RECORDS what
  the dated text says and where the forward correction sits.
- It did not widen its own grep. `cadence-core/bin/` stays out of scope (row 48
  is filed by hand), which is the `.planning/CAPTURE.md:143` lesson from phase 3.
