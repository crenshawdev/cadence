PLAN COMPLETE
Plan: .planning/phases/3/PLAN.md
Tasks: 7 of 7
| Task | Commit | Note |
|---|---|---|
| 1. `--phase` carries the string the caller typed, at every shape site | ab4bc32 | `requirePhaseArg` added to `lib/require-int.mjs`; adopted at `cursor set`, `uat` (all five sub-subcommands, replacing a bare `Number()`+NaN test), `plan-overlap`, `seed-reqs`, `lease-check`, `trace append`/`render`, and `route.mjs` (local `PHASE_RE` deleted). 10 new cases; all 10 proved RED under a mutation that restores `String(Number(x))`. `tsc -p tsconfig.ci.json` clean, 436/436 green. |
| 2. State numeric-only as the grammar and report every violation | 8ebbfe3 | `conventions.md`'s contradicting sentence deleted and the grammar stated; `PHASE_DIR_NAME` + `phaseDirGrammarDrift` added to `cmdStatus`; `progress.md` drift-kind list and `cad-health` check 5 extended; three budget entries regenerated (conventions 5115->5718, progress 7791->7864, cad-health 5701->6068). 4 new cases, 2 proved RED with the walk removed. `status` on this repo returns zero `phase-dir-grammar` entries; `self-verify --root .` `problems: []`. |
| 3. A project Cadence creates keeps its run record out of git | 452be5c | `trace ignore --root <path> [--check]` added to `cmdTrace` with the `CONTRACTS` row in the same commit (D-20); wired into `new-project.md`'s setup step (item 3), `execute.md:226`'s assertion made true, and `cad-health` check 1. 8 new cases, all 8 proved RED against the unpatched subcommand. Budgets regenerated (new-project 15230->15847, execute 25655->25857, cad-health 6068->6545). AC3 proved end to end through the SEAM on a scratch project (transcript below); `self-verify --root .` `problems: []`, `self-verify.test.mjs` 128/128. |
| 4. `REQ_ID_EXACT` admits a category that does not start with a letter | 92b34a5 | Widened to `^(?:(?=[A-Z0-9]{2,8}-)[A-Z0-9]*[A-Z][A-Z0-9]*-\d+|#\d+)$`; `REQ_ID_TOKEN` and its `_G` twin untouched. Two SHIPPED rows retargeted (they pinned the old limit): `isRequirementId`'s yes/no lists and the `active-non-id-bullet` table row for `- **2FA-01**`. 4 new/retargeted cases, 3 proved RED against the old regex. Three prose surfaces this makes false are OUTSIDE the lease - filed, see open items. |
| 5. State the `CADENCE-DEBT` marker convention and its verifier exemption | 3194a8e | New `## Deliberate shortcuts` section in `references/conventions.md`; one exemption clause each in `METHOD.md:221` and `cad-verifier-contract/SKILL.md:104` with the TODO/FIXME/XXX/HACK enumeration byte-unchanged. Budgets regenerated (conventions 5718->7510, verifier-contract 10009->10201); `METHOD.md` is not a measured surface. The `debt-harvest` CONTRACTS row moved into this task - see deviations. |
| 6. The harvest seam collects markers into `.planning/CAPTURE.md` | f056ab4 | New pure `lib/debt-markers.mjs` (`debtMarkersIn`, `renderDebtSection`, `DEBT_TOKEN`); `sectionBound` exported from `lib/planning-files.mjs`; `cmdDebtHarvest` + `debt-harvest` dispatch entry; `execute.md` summary-step call site (best-effort). 10 pure + 14 seam cases. FOUR mutations run, two of which falsified my own first fixtures - see deviations. Over this repo: `markers:0, files:188`, second run `written:false`. Budget: execute.md 25857->26210. |
| 7. Green the tree and record the failing-capable evidence | (docs only, no commit of its own - see note) | AC7 closed. All 93 budgeted surfaces byte-exact, zero over and zero stale-high. `self-verify.test.mjs` pins no `CONTRACTS` shape or row count (its checks are behavioural: a rogue script reports, a bad flag reports), so per the plan it was left UNTOUCHED rather than given a test it does not own - which leaves this task with no code change to commit. |

## AC3 scratch-project transcript (2026-08-09)

Proved through the seam, not the slash command: per phase 2's D-17 a workflow
edit is invisible to `/cad-new-project` until the plugin is reinstalled, so the
proof is the seam exercised directly plus the call site verified by reading.

```
$ git init -q && mkdir -p .planning
$ node /data/code/cadence/cadence-core/bin/planning.mjs trace ignore --root .
{"ok":true,"root":".","file":".gitignore","line":".planning/trace.jsonl","ignored":false,"tracked":false,"method":"git","written":true}
$ cat .gitignore
# Cadence's joined run record - local diagnostics only, one machine's routing/provider/worker events
.planning/trace.jsonl
$ node /data/code/cadence/cadence-core/bin/planning.mjs trace ignore --root .   # re-run
{"ok":true,...,"method":"git","source":".gitignore","written":false,"reason":"already-ignored"}
$ cat .gitignore    # byte-identical
```

Call site: `cadence-core/workflows/new-project.md:33`, inside the setup step's
one Bash block, after the `git init` item.

## AC7 gate results (2026-08-09, whole tree, in order)

| Gate | Result |
|---|---|
| `node --test cadence-core/bin/*.test.mjs` | 1425 tests, 1425 pass, 0 fail |
| `npx tsc -p tsconfig.ci.json` | exit 0, no diagnostics |
| `node cadence-core/bin/self-verify.mjs --root .` | `ok:true`, `problems: []` (empty array) |
| `node cadence-core/bin/weight.mjs --root .` | 93 surfaces, 93 byte-exact against `weight-budgets.json`, none over |

All five fixes in this phase carry a regression test proved failing-capable, one
row each in the table above. Suite grew 1381 -> 1425 (+44 cases, +1 new test file).

## AC7 failing-capable record

| Fix | Regression test(s) | Mutation used | RED observed |
|---|---|---|---|
| Task 1 - the phase argument's raw spelling | `require-int.test.mjs` (2 cases), `planning.test.mjs` (6 cases: lease-check 1.10 / 08, plan-overlap 08 / 1.10, uat 1.10, seed-reqs 08), `trace.test.mjs` (1.1 vs 1.10 keys), `route.test.mjs` (--phase 1.10 floor) | `requirePhaseArg` returned `raw: String(parsed.value)` instead of `String(raw).trim()` - the exact pre-fix normalization | 10 failing / 426 passing; every one of the 10 new cases failed, and no other case moved |
| Task 6 - the harvest | `debt-markers.test.mjs` (10, pure); `planning.test.mjs` (14, seam) | FOUR separate mutations: (A) `.planning/` skip removed, (B) differs-from-disk guard forced true, (C) `node_modules` skip removed, (D) `sectionBound` replaced by a bare `/^## /` boundary test | A: 1 failing (after the fixture was corrected - see deviations); B: 2 failing (both idempotence rows); C: 1 failing (force-added `node_modules`); D: 1 failing (after the fixture was corrected twice - see deviations) |
| Task 4 - the requirement-id regex | `planning-files.test.mjs`: `isRequirementId` yes/no lists, the `2FA-01` bold-bullet row, a new `2026-08` no-letter row; `planning.test.mjs`: `2FA-01` reaches `unpicked`/`unseeded`/`counts`, `2026-08` stays a reported phantom | `REQ_ID_EXACT` restored to `^(?:[A-Z][A-Z0-9]{1,7}-\d+\|#\d+)$` | 3 failing / 508 passing - the two `2FA-01` rows and the `isRequirementId` list |
| Task 3 - the ignore seam | `planning.test.mjs`: fresh repo written, re-run no-op, brownfield lines survive, `.planning/` wholesale left alone, non-git `method:'file'`, tracked reported, `.git/info/exclude` does not satisfy, `--root` present-but-unusable refused | `git stash push -- cadence-core/bin/planning.mjs` (the subcommand absent entirely, so `trace ignore` falls to `usage`) | 8 failing / 281 passing - all eight |
| Task 2 - the grammar-violation drift | `planning.test.mjs`: named-and-padded grouping, legal tree silent, stray file ignored, `08` beside legal `8` | `drift.push(...phaseDirGrammarDrift(dir))` removed from `cmdStatus` | 2 failing / 279 passing - the two POSITIVE rows went RED. The two absence rows (legal tree, stray file) assert that nothing is reported and are green in both states BY CONSTRUCTION; they are regression guards on the false-positive direction, and no mutation of this walk can redden them |

Deviations: see below.
Open items: see below.

Deviations:
- [deviation] `route.test.mjs`'s shipped assertion `assert.equal(e.phase, 4)` was
  updated to `'4'`. Directed by the plan (the trace event now carries `.raw`),
  but it is an edit to an existing shipped assertion rather than a new case, so it
  is recorded rather than left implicit. The cursor arm of the same block still
  records a NUMBER (`cursorPhase` returns one) and its assertion is unchanged.
- [deviation] Task 1's plan text says `requirePhaseArg` reuses
  `CURSOR_SHAPE.decimal`; it reuses it INDIRECTLY, by delegating to
  `requireCursorNumber(raw, {decimal: true})`, which keeps both existing guards
  (the shape test and the `String(n)` round trip) as the single implementation
  rather than copying the regex to a third caller. Same accept/refuse set.
- [deviation] Task 6, mutation A: expected removing the `.planning/` skip to redden
  the "TRACKED CAPTURE.md stays idempotent" row; observed ZERO failures. The
  reason is a real correction to the plan's stated rationale: the harvest's own
  rendered output contains no marker token (a bullet is
  `` - `path:line` text - ceiling: ... - trigger: ... ``), so it can never
  re-ingest itself THROUGH the section. What the `.planning/` skip actually
  protects is a planning DOC that writes a literal marker line while describing
  one - a PLAN, CONTEXT or SUMMARY quoting the grammar would land in the queue as
  a real corner-cut on a phase that cut nothing. Added that fixture (a tracked
  `.planning/phases/1/PLAN.md` quoting a marker), which the mutation DOES redden,
  and corrected the misleading comment on the idempotence row.
- [deviation] Task 6, mutation D: expected replacing the exported `sectionBound`
  with a bare `/^## /` boundary test to redden the fence row; observed zero
  failures TWICE before the fixture was right. First fixture: the fenced `## `
  line sat in `## Todos`, which is in the untouched PREFIX of a rewrite that only
  bounds `## Debt markers`, so no boundary rule could reach it. Second: the fence
  content was INDENTED (`  ## build output`), and `sectionBound`'s own heading
  test is `/^## /`, so the line was invisible to both readers. The fixture that
  actually decides puts `## Debt markers` FIRST, holding a stale fenced block
  with `## build output` at column 0, and asserts the debris does not survive.
  `sectionBound` is load-bearing on exactly that shape and nowhere narrower; the
  first row is kept, retitled to what it really pins.
- [deviation] Task 5: expected `self-verify --root .` to return `ok:true` after the
  three prose edits; observed `ok:false` with one problem, `unknown-subcommand`
  for `planning.mjs debt-harvest` in `references/conventions.md`. The plan puts
  the `debt-harvest` prose in task 5 and its `CONTRACTS` row in task 6, but check
  2 lints prose INVOCATIONS against the table, so the row has to land with the
  PROSE and not with the code. Row added in task 5 instead
  (`'debt-harvest': ['--root']`); task 6 adds the implementation behind it. No
  check verifies the reverse direction (a row whose subcommand does not exist
  yet), so the intermediate commit is green and honest about what it lints.
- [deviation] Risk-surface gate on task 1: NO match, recorded here per
  `review-triggers.md`'s "note each drop and why". The nearest surface is
  untrusted-input parsing, and the falsifying check refutes it - `requirePhaseArg`
  admits only `^\d+(?:\.\d+)?$` after trim, so no admitted value carries a
  separator or a `..` and none can address anything outside `<dir>/phases/`. The
  flag is a local developer's own CLI argument in a tool with no privilege
  boundary, and the surface is not new: the same flag already built the same path,
  through `String(Number())`.

Open items:
- **Task 4's widening makes three prose surfaces FALSE, and all three are outside
  this plan's declared file lease**, so they could not ride the commit:
  `cadence-core/references/req-traceability.md:50` (the remedy-table row telling
  the user to rename a digit-leading category, "Known limit as of v1.4.0"),
  `cadence-core/references/req-traceability.md:150` ("leading with a digit
  (`2FA-01`, `3DS-02`) fails the admission test") and
  `cadence-core/templates/REQUIREMENTS.md:63` ("A digit-leading category
  (`2FA-01`) is NOT counted by `/cad-audit`"). `self-verify` cannot catch this -
  it lints keys, invocations, paths and budgets, not semantic claims - so it is
  green with the false prose in place. Filed in `.planning/CAPTURE.md` with the
  exact locations and with the narrower statement that IS still true
  (`REQ_ID_TOKEN` keeps its letter head, so an UNBOLDED `2FA-01` remains
  invisible to the prose scan), whose natural home is this cycle's DOC phase.
  Flagged here rather than fixed because the lease gate is a hard rail.
- The `--phase` decimal spelling is still normalized away in exactly two places,
  both deliberate, both stated in the plan and both now queued in
  `.planning/CAPTURE.md` under `## Todos`: `cmdSeedReqs`' Traceability rows (the
  cell is compared against ROADMAP phase numbers) and `cmdCursorSet`'s written
  value (`parseCursor` returns a Number that `renumber`'s shift arithmetic,
  `cmdStatus`'s agreement test and `phase-plans.mjs`' `cursorPhase` all consume).
