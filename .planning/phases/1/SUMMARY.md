---
phase: 1
status: complete
completed: 2026-08-26
---

# Phase 1: Bound what a dispatch is handed - Summary

`workflow.max_plan_bytes` (default 675,000) makes a plan's declared read set a measured number with a reported ceiling, and the plan-time risk floor stops treating an import or a constant declaration as evidence of a risk surface - each replay row now carrying the bytes it read.

## What shipped

- `workflow.max_plan_bytes` config key, int, min 1, default 675,000, `plan-size report only` - `cadence-core/config.schema.json`, with catalog and reach rows in `cadence-core/references/config-catalog.md` and `config-reach.md`
- Declared-byte measurement per plan, with an `absent` count beside the total - `cadence-core/bin/planning/plan-size.mjs` (`declaredBytes`)
- `--max-bytes` flag reporting a crossing as a `plan-too-many-bytes` entry in `over[]` - `cadence-core/bin/lib/arg-contract.mjs` + `plan-size.mjs`
- `/cad-plan`'s `check_size` step passing the ceiling through - `cadence-core/workflows/plan.md`
- Line-kind exemption withholding import statements and literal-bound constant declarations from the plan-time floor - `cadence-core/bin/lib/risk-diff.mjs` (`isIncidentalLine`, `scanDeclared`)
- `withheld` reporting, so a file whose only evidence sat on a withheld line is named rather than silently dropped - `risk-diff.mjs` + `cadence-core/bin/route.mjs` (`levelFor`)
- `bytes_read` on every `route.mjs replay` row - `route.mjs`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 1edb03be | Register `workflow.max_plan_bytes` as a config key; re-pin catalog and reach byte budgets |
| 1 | 2 | f2697491 | `plan-size` measures the bytes each plan's `files:` declares, plus an `absent` count |
| 1 | 3 | be1a16a8 | `--max-bytes` reports the crossing as an `over[]` entry; `arg-contract` census 191 -> 192 |
| 1 | 4 | 4c9b7be2 | `/cad-plan` hands `check_size` the ceiling; re-pin `workflows/plan.md` budget |
| 1 | 4 | 518526f8 | The whole-schema completeness fixture names the byte ceiling key |
| 1 | - | 587419dd, 2bf25674 | Plan 1 executor report (checkpoint, then final) |
| 2 | 1 | 3030a7d4 | `scanDeclared` stops counting import and constant-declaration lines |
| 2 | 2 | 9a499ced | The replay names the file whose match no longer counts (`withheld`) |
| 2 | 3 | b28039e9 | Every replay row carries the bytes it read |
| 2 | - | edd8998e | Plan 2 executor report |

Merge commits: plan 1 fast-forwarded to `2bf25674`; plan 2 merged at `17318110`. Phase range `6f9b13de..17318110`, 12 commits.

## Deviations

- [deviation] Plan 1, task 1: `Verify:` asserted `self-verify` clean at `1edb03be`, but the same task's own prose must name `plan-size --max-bytes`, which self-verify check 2 parses against `CONTRACTS` where the flag did not exist until task 3. Exactly two `unknown-flag` problems observed, one per prose file. Continued rather than checkpointed, since the plan places the resolution at task 3. RESOLVED at `be1a16a8`.
- [deviation] Plan 1, task 4: **refutes D-12.** The decision states a new config key lands in FOUR places; it lands in FIVE. Registering any schema key also fails `self-verify.test.mjs`'s hand-maintained whole-schema completeness fixture on `inert-config-key` - observed at `4c9b7be2` as exactly one failing test, 3367 of 3369. The fifth file sat in PLAN-2's lease, so the executor returned a `structural` checkpoint rather than reaching across it. Resolved by an authorized continuation dispatch: PLAN-2's executor had left zero hunks on that file, the one-token edit landed at `518526f8`, and the lease was made true (the path added to PLAN-1.md's `files:`, `lease-check` then `ok:true`) rather than bypassed. D-12's line in `CONTEXT.md` is annotated with the correction.
- [deviation] Plan 2, tasks 2 and 3: asserted the replay shows 28 rows; it emits 29, because `.planning/phases/1` is itself a live phase directory the replay measures. Substance unchanged - the 28 archived rows compute the enumerated levels, `regressions` is empty, and 0 of 29 rows moved a level. Nothing was changed to accommodate it.

## Open items

- D-12's five-place reality has no signpost: nothing points a key author at `self-verify.test.mjs`'s completeness fixture, and the failure surfaces only under the full suite. Worth stating in the config-registration prose, or worth deriving that fixture from the schema.
- The over-ceiling arm of `plan-size --max-bytes` has no witness against this repo's own live phase - both phase 1 plans measure under 675,000 (613,294 and 471,305 as merged), so the live call returns `within: true`. Unit-tested, and reachable by hand with a low `--max-bytes`.
- Plan 2's constant arm accepts a keywordless `SCREAMING_SNAKE=value` assignment, so such a line is withheld anywhere in a scanned body, not only in a language's `const`. No floor on this corpus moves (a dotenv path still evidences `secrets` via `FILE_SIGNALS`/`EXT_SIGNALS`), but a project holding credentials in a source file under some other name loses that body line as evidence. Narrowing it needs a language cue the line-kind grammar does not carry.
- `config-reach.md`'s reading-aid phrase list was already stale before this phase: `capture-check report only` and `trace window report only` are declared by rows and missing from the list. Only `plan-size report only` was added; nothing machine-checks the list.
- `phase-spelling.test.mjs`'s `plan-size` READERS row `deepEqual`s the whole `r.plans` entry, so the two new fields broke it - repaired in the same commit. It is not a census count, so `lease-check --plan-time` could not have named it as at-risk.
- Run-record fidelity: plan 1 took two `trace close` writes under one worker key (a `checkpoint` then a `return`). The worker-key dedup folds the second into the first row filling only empty fields, so the continuation's 54,028 tokens / 28 turns / 287s may not be in the record and `risk-check status` reports `completed: 0` for plan 1 while plan 2 reads `completed: 1`. On a milestone about dispatch cost, a continuation's spend going unbilled is worth a look.

## Goal check

The phase goal has two halves and both are delivered, verified against the merged tree rather than the returned digests. The byte half: `config.mjs get workflow.max_plan_bytes` returns `675000`, and `plan-size --phase 1 --max-bytes 675000` answers `{"plans":[{"plan":"PLAN-1.md","bytes":613294,"absent":0},{"plan":"PLAN-2.md","bytes":471305,"absent":0}],"max_bytes":675000,"over":[],"within":true}` - a declared read set is now a measured number with an `absent` count beside it, reported at `/cad-plan`'s `check_size` step (`cadence-core/workflows/plan.md`). The floor half: `route.mjs replay` returns 29 rows with `regressions: []`, every row carrying an integer `bytes_read` (`_archive-v2.1.0/1` reads 450,716 B), and rows whose evidence changed say so in the floor's own vocabulary - `_archive-v2.1.0/2` now reads "cadence-core/bin/review-provider.mjs evidences secrets only on an import or a constant declaration, which no longer counts". The merged tree is green where neither plan's isolated suite could see the other: `test.mjs` 3381 tests, 3380 pass, 0 fail, 1 pre-existing skip; `self-verify.mjs` `problems: []` across 29 checks; `npx tsc -p jsconfig.json --noEmit` silent. What is honestly missing: no live phase in this repo crosses the ceiling, so the `over[]` arm ships unwitnessed outside unit tests, and the discount the goal names ("a plan declaring a large file can still earn the routing discount") is demonstrated by the replay's changed-evidence rows rather than by any phase whose level actually fell - 0 of 29 rows moved a level, which is the plan's own predicted and desired result but is not the same as observing the discount earned in the wild.
