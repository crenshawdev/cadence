# Phase 5: The retune says what to change - Context

Gathered: 2026-08-17
Feeds: /cad-plan 5

## Scope boundary

In: The two surfaces that describe the run instead of advising it stop doing
that. `trace suggest` emits `direction`, `current` and `proposed` beside every
keyed `action`, suppresses a ceiling rule whose evidence does not bind, and
`/cad-suggest` presents the tweaks in a headed block of their own with the
`info` receipts separated below and an offer to route the change to
`/cad-config` (SGT-01). The coordinator residue stops pairing one run's last
marker with a different run's last event, so the figure it reports is the
coordinator time it claims to be (MSR-04). `README.md`'s retune sentence and
DOCS-CLAIMS rows README-74, SUGGEST-07/08/09/11/12/16 and REPORT-13/14/15 move
with those edits. Each requirement lands with a check watched failing against
the unpatched code first.

Out: Retuning `workflow.max_plan_tasks` itself - PLN-01 closed that in phase 4
with the value held at 8, and the roadmap names re-deciding it here as the one
thing this phase must not do. Any new capture mechanism for a user-turn
boundary: the record carries no event that bounds one, and D-01 settles MSR-04
without needing it. `.planning/reads.jsonl` as a residue bound (D-04). A length
threshold on a residue window (D-03). New `trace suggest` flags or subcommands -
the `--phase`-only contract row holds (D-11). Any rule beyond R1, R3 and R4
gaining a keyed action; R2, R5 and R6 stay receipts with `action: null`.

Deferred: None.

Plan shape: multiple plans, same phase - split at the requirement boundary,
MSR-04 (`cadence-core/bin/lib/trace.mjs`'s residue block and its three readers)
apart from SGT-01 (`cadence-core/bin/planning.mjs`'s suggest arm,
`cadence-core/bin/lib/trace-suggest.mjs`, `cadence-core/workflows/suggest.md`,
`skills/cad-suggest/SKILL.md`, `README.md`). SGT-01 may split again at the
seam/presentation line, which is /cad-plan's call. Shared surfaces -
`cadence-core/bin/weight-budgets.json`, `.planning/DOCS-CLAIMS.md`,
`cadence-core/workflows/report.md` and `cadence-core/bin/trace-suggest.test.mjs` -
get explicit `files:` leases per plan, the arrangement phases 2 and 4 both used.

## Durable decisions

- D-01 (MSR-04): The residue is keyed by `corr`, not by phase - each phase's
  last marker closes at its OWN run's last event rather than at the phase's
  newest timestamp across every family. This REFUTES the roadmap's stated cause.
  The phase entry calls the 6,112 minutes "a session sitting idle between user
  turns" and "unattributable"; measured 2026-08-17, phase "2" holds 9 distinct
  `corr` ids spanning 2026-08-08 to 2026-08-17, and the 4,677-minute `commit`
  window opened at `2026-08-13T20:30:13.500Z` by `corr` `2-6790224`, whose own
  last event is 25 seconds later at `20:30:38`. Re-running the identical
  arithmetic over the same 72 markers with the same pairing rule, keyed by
  `corr`: 324 min total residue against today's 19,839, top window 189 min
  against 4,677. Six of 72 windows carry 99% of the current figure and four of
  those are the last marker of their phase, so the mass is structural rather
  than long-tail. The figure is therefore WRONG rather than unattributable, and
  correcting it is available where the roadmap assumed only relabelling was.
  Reverses the choice stated at `cadence-core/bin/lib/trace.mjs:462-471`, made
  for a re-run / missing-anchor case that the PASS-2 pre-anchor repair
  (`:502-519`) now partly handles. Evidence:
  `cadence-core/bin/lib/trace.mjs:462-478` (accumulators keyed by phase),
  `:588-596,811` (the last marker's window ends at `row.last`), `:788-834` (the
  residue block), `:374-383` (`mergeSpans`), `.planning/ROADMAP.md` (phase 5
  entry). If wrong: the phase relabels a span whose real cause is cross-run
  pooling, and the figure stays wrong in the other direction the moment a phase
  number is reused.
- D-02 (MSR-04): The name "coordinator time" STAYS. The roadmap offered a
  disjunction - exclude what cannot be attributed, or stop calling it
  coordinator time - and D-01 removes the premise under the second arm: a
  corr-scoped gap between worker brackets IS time this coordinator held the run.
  The rejected alternative was keeping the arithmetic and renaming the quantity
  ("wall time between worker brackets" plus a separate `unattributed_ms`), which
  changes prose in two readers and no number, leaving the 6,112 on screen. If
  wrong: a corrected figure carries a hedged name and the next reader re-opens
  whether the number means anything.
- D-03 (MSR-04): No length threshold is introduced and
  `MIN_RESIDUE_MS_FOR_COORDINATOR_INFO` is untouched. No cutoff is derivable
  from the record - the corr-keyed simulation shows 6 of 72 windows carrying
  99%, so the mass is structural and a floor would not reach it - and
  `cadence-core/bin/lib/trace-suggest.mjs:41-48` already concedes that floors of
  that kind cannot count events. Evidence: `cadence-core/bin/lib/trace-suggest.mjs:29-48`,
  `cadence-core/workflows/suggest.md:98-99` (the no-fabricated-figures
  guardrail). If wrong: a chosen cutoff becomes a shipped constant nobody can
  source, and the same argument reopens next milestone.
- D-04 (MSR-04): `.planning/reads.jsonl` is NOT used to bound a residue span.
  Measured 2026-08-17 it holds 10,168 records (4,050 `agent: "coordinator"`)
  spanning 2026-08-14T12:33 to 2026-08-17T23:41, of which 3,466 fall inside the
  4,677-minute `commit` window with over-30-minute gaps summing to 1,223 min -
  but the file begins roughly 16 hours AFTER that window opens, so its coverage
  is partial by construction, and it is a second record with its own 8 MB cap.
  D-01 makes the join unnecessary. Evidence:
  `cadence-core/bin/lib/read-trace.mjs:44-52`. If wrong: the residue depends on a
  second, capped, partially-covering record and degrades silently when it rolls.
- D-05 (SGT-01): `direction`, `current` and `proposed` are resolved in
  `cadence-core/bin/planning.mjs`'s `sub === 'suggest'` arm and passed INTO
  `suggestFromRender(render, ...)`. `cadence-core/bin/lib/trace-suggest.mjs`
  stays a pure function over the render with no I/O and no config import of its
  own. The phase-4 twin is the shipped precedent: the `window` arm calls
  `mergeLayers`, folds `DISPATCH_WINDOW_DEFAULTS` over it, and passes resolved
  `ceilings` into the pure `windowBudget`. Evidence:
  `cadence-core/bin/lib/trace-suggest.mjs:2-17` ("No I/O here, deliberately -
  every rule is a pure function over the render so a test can pin exact outputs
  to exact traces"), `cadence-core/bin/planning.mjs:3265-3306`,
  `:2901-2921`, `cadence-core/bin/lib/window-budget.mjs:111`. If wrong:
  `trace-suggest.mjs` acquires `readFileSync`/`realpathSync` through
  `config-merge.mjs`, and the 20-plus pure-render tests in
  `cadence-core/bin/trace-suggest.test.mjs` each grow a config fixture and a
  temp dir.
- D-06 (SGT-01): A key held in NO config layer returns `current` as unset,
  naming the stakes level that decides it, taken off the record - never the
  value that level would fire. `config.mjs get` makes the same refusal in the
  same words, and its stated reason is that it cannot know the level; the
  suggest seam is differently placed, because every `routing/resolve` event
  carries `stakes` (measured 2026-08-17: 317 resolves, 307 `shipped`, 10
  `critical`), so it can name the DECIDER without reading the ladder for a
  VALUE. The rejected alternative was printing the effective value from
  `cadence-core/route-table.json` labelled "effective, unset". Evidence:
  `cadence-core/bin/config.mjs:268-286` (the `"<key> is unset: no config layer
  pins this gate, so the stakes level decides it"` warning and its D-07
  comment), `cadence-core/config.schema.json:77-89` (gate default `null` = "the
  stakes level decides"). If wrong: `/cad-suggest` prints `current: blocking`
  for an absent key, the user sets it to move it, and the gate is now PINNED at
  every stakes level - the pinning the schema's own purpose text warns about.
- D-07 (SGT-01): Only R1's gate arm (`review.triggers.<t>.gate`, a stated ladder
  to step down in `route-table.json`) and R3 (`model.effort.<role>`, whose
  escalated rung the record names) carry a `proposed`. R1's reviewer arm and R4
  (`workflow.max_plan_tasks`) return `direction` and `current` alone, with
  `proposed` OMITTED - the roadmap's own AC states a suggestion it cannot price
  is returned without one rather than with a guess. R4 is unpriceable because no
  field in the record names a plan's task count: measured 2026-08-17 the key
  union across 1,034 events is `agent, attempt, base, base_id, categories,
  checked, command, corr, degraded, detail, duration_ms, effort, escalated,
  event, family, floor_surfaces, head, head_id, inconclusive, matches, model,
  outcome, phase, pinned, plan, provider, raised, read, role, sha, stakes, step,
  tier, tokens, trigger, ts, turns, warning_count`. The rejected alternative was
  deriving R4's target from the largest plan task count actually measured, which
  rests on a read that shrinks every milestone (see D-09). Evidence:
  `cadence-core/bin/lib/trace-suggest.mjs:252-269` (R1's two arms), `:282-298`
  (R3), `:303-311` (R4), `cadence-core/route-table.json` (`gates`, `rung_order`,
  `cells[stakes][role].effort`), `cadence-core/config.schema.json:19-24,31,61`.
  If wrong: one guessed number sits beside two measured ones and poisons both,
  which is the credibility the no-fabricated-figures guardrail protects.
- D-08 (SGT-01): A ceiling suggestion is SUPPRESSED - not returned as a
  suggestion at all - when every checkpoint it counted maps to a readable plan
  whose task count is under the resolved ceiling. No binding check of any kind
  exists in the suggestion path today: the only gating is four evidence FLOORS
  (`MIN_FIRES_FOR_GATE_SUGGESTION`, `MIN_DISPATCHES_FOR_RUNG_INFO`,
  `MIN_ESCALATIONS_FOR_RUNG_SUGGESTION`, `MIN_CHECKPOINTS_FOR_SIZE_SUGGESTION`),
  so this is a new class of check rather than a tightened floor. Confirmed live
  2026-08-17: `trace suggest --phase 2` returns the single suggest entry
  `cad-executor` / "3 checkpoint return(s) - plans may exceed one context" /
  `workflow.max_plan_tasks`, and the six readable plans behind those checkpoints
  carry 6, 3, 6, 6, 5 and 4 tasks against a ceiling of 8. Evidence:
  `cadence-core/bin/lib/trace-suggest.mjs:29-48,303-311`. If wrong: the phase
  ships a return-shape change and the rule keeps firing on evidence that does
  not bind, which the roadmap names as its own success criterion.
- D-09 (SGT-01): A checkpoint whose plan file cannot be read degrades to
  UNKNOWN, never to under-ceiling. Measured 2026-08-17 over the live record: of
  16 executor checkpoints across 9 distinct `(phase, plan)` keys, 6 map to a
  live plan file and 3 map to no file at all (`2/1-cut`, `2/1-fix`, `3/5` -
  worker keys that are not plan numbers), while archived cycles keep phase dirs
  under a different milestone dir and a different filename shape and a
  delete-mode close removes them outright. Evidence:
  `cadence-core/bin/lib/planning-files.mjs:465` (`planTaskTitles`, `^### Task
  <n>:`), `cadence-core/bin/planning.mjs:1645-1674` (`cmdPlanSize`),
  `cadence-core/workflows/milestone.md:111,128`. If wrong: an unreadable plan
  reads as "not over the ceiling" and the rule goes permanently silent, or reads
  as binding and the rule speaks exactly as it does now.
- D-10 (SGT-01): The binding check compares against the SAME resolved ceiling
  the suggestion prints as `current`, never a hardcoded 8. Evidence:
  `cadence-core/config.schema.json:31` (int, min 1, default 8, whose purpose
  text records the 2026-08-17 PLN-01 re-decision landing on 8 unchanged),
  `cadence-core/references/config-catalog.md:30`. If wrong: a project that
  raised the ceiling to 12 is told to lower a ceiling its plans never touched.
- D-11 (SGT-01): `/cad-suggest` ends by OFFERING to route the change to
  `/cad-config`, and `skills/cad-suggest/SKILL.md` gains the tools that offer
  needs - its frontmatter grants only `Read, Bash` today, so an offer without
  them ships prose naming an action the skill cannot take. The write still
  happens inside `/cad-config`, which accepts `<key>=<value>` tokens directly,
  so "this command writes no config key" stays literally true and the triage-gate
  posture (the user decides) is preserved. The rejected alternative was staying
  strictly read-only and printing the exact `/cad-config <key>=<value>` line for
  the user to run - no frontmatter change and no claim-row churn. This is the
  fork the roadmap requires CONTEXT to settle either way, and the user's stated
  bar was "there needs to be a clear section that says, these are my suggested
  tweaks - would you like me to do it?". Evidence:
  `skills/cad-suggest/SKILL.md` (`allowed-tools: Read, Bash`, 818 B),
  `skills/cad-milestone/SKILL.md` + `cadence-core/workflows/milestone.md:193`
  (the shipped `SlashCommand` precedent, which invokes `/cad-suggest` that way),
  `cadence-core/workflows/config.md:19-23`,
  `cadence-core/workflows/suggest.md:65-69,91-95` (today's "apply NOTHING...
  There is no apply arm here to decline"). If wrong: the command offers an
  action it has no tool to take and the offer degrades silently to a sentence.

## Decisions

- D-12 (SGT-01): The new keys are emitted ONLY where a figure exists - omitted,
  never `null` and never `0` - so the committed-fixture `deepEqual` and every
  `info` entry stay BYTE-IDENTICAL, and that silence is itself the proof the
  change is invisible where nothing was computed. Carries phase 2 D-12 and the
  same omit-not-zero rule `--turns` already follows. Evidence:
  `cadence-core/bin/trace-suggest.test.mjs:440-465` (two literal `info` objects
  asserted with exactly `{kind, subject, evidence, action}`),
  `cadence-core/bin/lib/trace.mjs:689-698`, `cadence-core/bin/planning.mjs:3247-3262`.
- D-13 (SGT-01): The suggest arm's `mergeLayers` call binds and rides
  `warnings[]` on the envelope, exactly as the `window` arm does. Evidence:
  `cadence-core/bin/lib/merge-warnings.mjs:1-47` (the
  `undocumented-merge-warnings` rule - a callsite either destructures `warnings`
  or the file header carries the marker line), `cadence-core/bin/planning.mjs:3276-3281,3305`.
- D-14 (SGT-01): No seam FLAG changes, so `cadence-core/bin/self-verify.mjs`'s
  contract row stays as-is; this is a RETURN-shape change and phase 4 D-19's
  same-commit CONTRACTS row requirement is not triggered. Evidence:
  `cadence-core/bin/self-verify.mjs:374` (`'trace suggest': ['--phase']`),
  `cadence-core/workflows/suggest.md:20-23`, `.planning/DOCS-CLAIMS.md`
  (SUGGEST-04).
- D-15 (SGT-01): An unset key's `current` default comes from a frozen defaults
  literal in `planning.mjs` mirroring `config.schema.json`, not from parsing the
  schema at runtime - the duplication `DISPATCH_WINDOW_DEFAULTS` and
  `route.mjs`'s `DEFAULTS` already accept. Measured 2026-08-17,
  `config.schema.json` is read at runtime by `config.mjs`, `route-cells.mjs`,
  `rung-agent.mjs`, `gate-agreement.mjs`, `retired-keys.mjs`, `surface-scan.mjs`,
  `self-verify.mjs` and `text-transport.mjs` - and by neither `planning.mjs` nor
  `lib/trace-suggest.mjs`. Evidence: `cadence-core/bin/planning.mjs:2901-2921`
  ("`cadence-core/config.schema.json` IS THE SOURCE OF TRUTH for these
  numbers... this map is the unset-layer fallback"),
  `cadence-core/bin/route.mjs:106-107`.
- D-16 (SGT-01): `workflows/suggest.md`'s `present` step is rewritten IN PLACE -
  a headed tweak block carrying only the `suggest` entries as key, current,
  proposed (or its stated absence) and the evidence behind it, with the `info`
  receipts under a separate heading below and never interleaved. The two bullets
  that interleave both kinds today are what makes the output read as a report.
  Evidence: `cadence-core/workflows/suggest.md:44-70`.
- D-17 (MSR-04): The residue keeps ONE computation site and its three shipped
  readers move in the SAME commit - the `trace render` envelope, R6, and
  `workflows/report.md`'s residue lines. Nothing else reads it:
  `workflows/progress.md:99` and `references/triage-gate.md:81` consume the same
  envelope without touching residue. Evidence:
  `cadence-core/bin/lib/trace.mjs:788-834` (the single site, and the sentence
  saying why it is single), `cadence-core/bin/planning.mjs:3248-3251`,
  `cadence-core/bin/lib/trace-suggest.mjs:347-375` (R6, and `:337-341` on why it
  can never carry a key), `cadence-core/workflows/report.md:84,140-147`,
  `cadence-core/bin/trace.test.mjs:1789-1830`,
  `cadence-core/bin/trace-suggest.test.mjs:304-352`.
- D-18 (scope): `README.md:97` and claim row README-74 are IN this phase,
  because D-11's offer arm is what makes "applies none" misleading. Evidence:
  `.planning/DOCS-CLAIMS.md:1142` (README-74, "`trace suggest` turns the
  milestone's trace into evidence-backed retune suggestions and applies none");
  `.planning/CAPTURE.md` (phase 3) separately records that line naming the seam
  rather than the command, with no claim row over the command NAME.
- D-19 (mechanics): Every pin and claim row this phase moves travels in the same
  commit as its edit, carrying phase 4 D-20 forward. The pins:
  `cadence-core/bin/weight-budgets.json` rows for
  `cadence-core/workflows/suggest.md` (5141),
  `cadence-core/workflows/report.md` (12343) and `skills/cad-suggest/SKILL.md`
  (818). The claim rows: SUGGEST-07 (the envelope key list), SUGGEST-08 (the
  `subject`/`evidence`/`action` claim), SUGGEST-09 ("an `info` asks for
  nothing"), SUGGEST-11/12/16 (the apply posture), REPORT-13/14/15 (the residue
  sentences) and README-74. Note REPORT-13's anchor is ALREADY stale - it cites
  `report.md:67-69`, whose current bytes are the no-`cat` transport rule, while
  the residue prose sits at 140-147 - so that row is re-anchored rather than
  merely moved. Evidence: `cadence-core/bin/weight-budgets.json:74,107,113`,
  `cadence-core/bin/self-verify.mjs:934-946` (`budget-overrun`,
  `unbudgeted-surface`), `.planning/DOCS-CLAIMS.md:1092-1095,1103-1119,1142`.
- D-20 (mechanics): Each of SGT-01 and MSR-04 gets a falsifier committed with a
  `WATCHED FAILING AT <sha>` header, and the audit EXTRACTS the SHA per line
  rather than counting occurrences. Carries phase 4 D-21 and the phase-3
  deviation that retired the count. Evidence:
  `.planning/phases/3/PLAN-3.md:170,192-206`, `.planning/phases/4/SUMMARY.md`
  (the `617a2a1` re-anchoring deviation).

## Acceptance criteria

- [ ] AC1: `planning.mjs trace suggest --phase <N>` returns `direction` beside
      every non-null `action`, plus `current`, and `proposed` only where a
      target is read from the resolved config layer or the rung ladder; a key
      held in no config layer returns `current` as unset naming the stakes
      level the record carries; and a rule that cannot be priced omits
      `proposed` entirely rather than returning null or a derived number.
- [ ] AC2: `trace suggest` returns no `workflow.max_plan_tasks` suggestion when
      every checkpoint it counted maps to a readable plan whose task count is
      under the resolved ceiling, and a checkpoint whose plan file cannot be
      read counts as unknown rather than as under-ceiling; on this repo,
      `trace suggest --phase 2` returns no ceiling suggestion.
- [ ] AC3: `/cad-suggest <N>` prints a heading carrying only the tweaks - each
      as key, current value, proposed value or its stated absence, and the
      evidence behind it - with the `info` receipts under a separate heading
      below it and no `info` entry inside the tweak block.
      (human-verify: needs a live `/cad-suggest` run)
- [ ] AC4: `/cad-suggest` writes no config key itself and ends by offering to
      route the change to `/cad-config`; `skills/cad-suggest/SKILL.md` declares
      the tools that offer uses; and `README.md`'s retune sentence states the
      offer rather than claiming the command applies nothing.
      (human-verify: needs a live `/cad-suggest` run)
- [ ] AC5: In `trace render`, no marker window ends at an event carrying a
      different `corr` than the marker that opened it, and phase 2's reported
      residue differs from the phase-keyed figure the same command reports
      today.
- [ ] AC6: `/cad-report`'s residue lines and `.planning/DOCS-CLAIMS.md` rows
      REPORT-13/14/15 describe the figure the seam now computes, and no shipped
      surface describes the residue as spanning a phase rather than a run.
- [ ] AC7: A check fails against the unpatched code first for each of SGT-01
      and MSR-04, each carrying a header naming the SHA it was watched failing
      at, audited by extracting the SHA per line rather than counting headers;
      and `node --test cadence-core/bin/*.test.mjs` and
      `node cadence-core/bin/self-verify.mjs` both exit 0 with every moved pin
      re-pinned.

## Flagged assumptions

- The defaults literal (D-15) drifts from `config.schema.json` silently, since
  neither `planning.mjs` nor `lib/trace-suggest.mjs` reads the schema at
  runtime; Likely, and if wrong `/cad-suggest` prints a `current` that disagrees
  with the row `/cad-config` shows - the drift `prose-agreement.test.mjs:1407`
  already catches for one key and nothing catches generally. Whether that test
  arm widens in this phase is the planner's call.
- Whether R3's `proposed` steps ONE rung down `rung_order` or lands on the cell
  value for the stakes level is the planner's call; Likely, and if wrong the
  target is a legal rung that the routing table would never have resolved.
- Whether the corr-keyed residue needs a fallback for a marker whose `corr` has
  no later event at all (a run whose last act was the marker) is the planner's
  call; Likely, and if wrong such a window contributes zero rather than being
  reported as unclosed.
- The 324-minute corr-keyed figure was simulated over the record as it stood
  2026-08-17 and the record grows while phase 5 runs, so AC5 pins the
  invariant (no cross-`corr` window) rather than the number; Confident, and if
  wrong nothing this phase emits changes, because no figure is stored.
- Whether SGT-01 splits again at the seam/presentation line is /cad-plan's call
  within the multiple-plans shape; Likely, and if wrong one plan carries both
  the return-shape change and the prose rewrite of a byte-pinned surface.
