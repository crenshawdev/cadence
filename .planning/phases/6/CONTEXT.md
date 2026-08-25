# Phase 6: Close the plan-time lease gate - Context

Gathered: 2026-08-25
Feeds: /cad-plan 6

## Scope boundary

In: The two cases phase 2's UAT found the plan-time lease gate passing.
`cadence-core/bin/seam-calls.test.mjs` gets a `CADENCE-CENSUS` marker and a
registry row in `lib/census-registry.mjs`, and that module's header loses the
pre-correction D-05 text. `lease-check --plan-time` fails CLOSED on a lease it
could not read, on both of the two signals that produce one. `workflows/plan.md`'s
`check_census` prose is corrected to match, and phase 2's UAT items 9 and 10 are
driven to `pass`.

Out: The commit-time `lease-check` arm, unchanged. The `census-at-risk` reason and
its `censuses_at_risk` payload, unchanged. The breadth rail at
`planning-lease-check.test.mjs:707-726` is neither tuned nor deleted - D-01
measures that this phase's row passes it as it stands. The `planning-detail-sites`
row's stale `counts` prose (says 14, asserts 15) is pre-existing and not this
phase's to fix. No other registry row is added, and no census outside
`seam-calls.test.mjs` is touched.

Deferred: None.

Plan shape: One plan. Two small surfaces - a registry row plus a header rewrite,
and a two-signal refusal in one function - and splitting them would make both
plans declare `planning/lease-check.mjs` and pay the same census lease tax twice.

## Durable decisions

- D-01 (registry row): The row phase 2's report specified survives the
  half-the-plans breadth rail UNCHANGED, so this phase costs no narrowing and no
  rail change - unlike phase 3's refusal-token census, which was dropped rather
  than tuned. Measured 2026-08-25 by replaying the shipped `censusesAtRisk`
  predicate over every `PLAN*.md` under `.planning`: corpus 55 plans, 47 declaring
  under `cadence-core/bin/`, bound 23.5; the candidate row
  `{holder: 'cadence-core/bin/seam-calls.test.mjs', subjects:
  ['cadence-core/workflows/plan.md', 'cadence-core/workflows/context.md']}`
  refuses 9 of 47 - the third-widest row, below `planning-detail-sites` at 15.
  Phase 3's dropped row measured 44 of 45 on subjects `cadence-core/bin/`.
  Rejected: narrowing the subjects, or tuning the rail. Evidence:
  `cadence-core/bin/planning-lease-check.test.mjs:707-726`,
  `cadence-core/bin/lib/census-registry.mjs`, `.planning/phases/3/reports/plan-1.2.md`.
  If wrong: AC1 is unsatisfiable as written and the row must be dropped like
  phase 3's.
- D-02 (fail-closed signals): AC3's two cases need TWO signals, not one.
  A misspelled `filez:` key is a structurally VALID key line and produces ZERO
  `frontmatter_issues`, so `frontmatter_issues` alone cannot catch it; the second
  signal is `declared.length === 0`. Measured 2026-08-25 by calling
  `parsePlanFiles` on four fixtures: `filez:` returns `{"files":[],"issues":[]}`;
  a garbage frontmatter line returns `{"files":["src/a.mjs"],
  "issues":[{"code":"unknown-line"}]}`; no frontmatter returns
  `{"files":[],"issues":[]}`; a valid `files:` returns
  `{"files":["src/a.mjs"],"issues":[]}`. `parseFrontmatter` has no unknown-key
  diagnostic. Rejected: a gate reading `frontmatter_issues` alone, which is what
  the CAPTURE bullet raising this proposed. Evidence:
  `cadence-core/bin/lib/planning-files.mjs:2435`, `:2168-2290`,
  `.planning/phases/2/UAT.md:89-93`. If wrong: the garbage-line case re-tests
  green while `filez:` still returns `{"ok":true,"declared":0}`, AC3 is half-met
  and phase 2's UAT item 10 does not close.
- D-03 (reason tokens): The refusal ships TWO NEW reason tokens, one per signal,
  rather than one token with a field naming which fired, and rather than reusing
  an existing token. `census-at-risk` is defined by a non-empty
  `censuses_at_risk` list, empty here by construction; `undeclared-files` is a
  statement about the staged side the plan-time arm never reads. Two tokens make
  AC4's "both gates read the signal the same way" literally true, because
  `choose_path` already reads these as two separate clauses. Each token carries a
  `hint`, or self-verify check 22 reports it. A new token is free: the reason
  census is one-directional forward. Rejected: one `unread-lease` token with a
  discriminating field. Evidence: `cadence-core/bin/planning/lease-check.mjs:283-291`,
  `:448-454`, `:251-258`; `cadence-core/bin/lib/refusal-hints.mjs:499-511`;
  `cadence-core/bin/reason-census.test.mjs:51-56`;
  `cadence-core/workflows/execute.md:131-136`.
- D-04 (prose): `workflows/plan.md`'s `check_census` claim is CORRECTED rather
  than left generic or left alone, and this phase absorbs the resulting lease
  cost. The claim at `:325-327` - the seam "answers `ok:true`, or it refuses with
  `census-at-risk` and a `censuses_at_risk` list" - is exhaustive, and D-03
  falsifies it. The file sits at EXACTLY its weight budget (measured 2026-08-25:
  33,187 B against 33,187; 106 of 111 budgeted keys byte-exact, 0 overrun), so any
  growth needs a hand re-pin of the one `weight-budgets.json` line; the check
  fires only on `bytes > budget`, so a shrink is free. Rejected: regenerating
  `weight-budgets.json` wholesale, which moves 5 unrelated keys into the diff.
  Evidence: `cadence-core/workflows/plan.md:325-327`,
  `cadence-core/bin/self-verify.mjs:783-787`, `cadence-core/bin/weight-budgets.json`.
- D-05 (UAT item 11): AC5 is met by items 9 and 10 alone. Item 11 STAYS
  `pending` and phase 2's UAT stays `partial`, because item 11 is a live
  `/cad-plan` observation of a run whose `check_census` actually REFUSES, and
  this phase's own planning run declares every census holder correctly - the
  D-12 lease is complete by construction, so this phase produces no refusal for
  item 11 to watch. `uatComplete` requires every item to be `pass` or `skipped`
  with a reason, so phase 2 stays `partial` until a later planning run genuinely
  under-declares. Rejected: recording item 11 from this phase's own run, which
  would record an observation nobody made; recording it `skipped` with a reason,
  which would discard a check still worth making. Evidence: `.planning/ROADMAP.md:319`,
  `cadence-core/bin/lib/planning-files.mjs:1801-1806`, `.planning/phases/2/UAT.md:98-102`,
  live `uat status --phase 2` on 2026-08-25 returning `result: partial`.

## Decisions

- D-06 (blast radius): Adding the row moves no existing assertion. `PHASE5_LEASE`
  declares no `cadence-core/workflows/` path, so `PHASE5_AT_RISK` - asserted as an
  exact SET - stays a four-name list. The registry test asserts row shape and
  freeze only and pins no row count (its own D-04). Evidence:
  `cadence-core/bin/planning-lease-check.test.mjs:564-570`, `:581-586`;
  `cadence-core/bin/census-registry.test.mjs:5`, `:37-78`.
- D-07 (header edit): The header rewrite is prose-only. Nothing in the tree reads
  `lib/census-registry.mjs`'s source BYTES - its four importers take the exports -
  so AC2's grep is the whole test surface. `"deliberately absent from this table"`
  has exactly one code hit, at `:49`. Contrast `prose-agreement.test.mjs:373`,
  which does read `planning/lease-check.mjs`'s source bytes. Evidence:
  `cadence-core/bin/lib/census-registry.mjs:44-49`.
- D-08 (replay record): `.planning/phases/2/census-replay.md` is updated with the
  new row's counts, because the rail's own failure message instructs it and
  phase 2's verifier named it as the required follow-up. Evidence:
  `cadence-core/bin/planning-lease-check.test.mjs:723-726`,
  `.planning/phases/2/verifier-findings.json:124`.
- D-09 (AC4 fixture): The shared fixture needs TWO PLAN files in the phase
  directory, not one. `plan-overlap` returns before computing `undeclared` when
  fewer than two plans exist - the early return spreads `frontmatter_issues` but
  not `undeclared` - so a one-plan fixture pins only half the reading.
  `lease-check --plan-time` is per-plan and answers on either shape. Evidence:
  `cadence-core/bin/planning/plan-overlap.mjs:63-70`, `:102`, `:59-68`.
- D-10 (not a blanket refusal): Failing closed on `declared:0` refuses effectively
  nothing historical. Measured 2026-08-25 over all 55 `PLAN*.md` under
  `.planning`: 2 declare zero files - `.planning/tasks/review-request-timeout/PLAN.md`
  and `.planning/tasks/token-burn-contract-edits/PLAN.md`, both `/cad-task` plans
  with no YAML frontmatter at all, which `check_census` never runs against - and 0
  of 55 carry any `frontmatter_issues`. If wrong: the gate refuses legitimate plans
  and gets overridden rather than obeyed, which `lease-check.mjs:32-37` says gets a
  rail deleted.
- D-11 (side effects): The plan-time arm still writes no trace event and still
  spawns no git, on either new arm. The `appendEvent` is on the
  `undeclared-census-files` arm ALONE, and the arm branches above the
  `execFileSync` block. Evidence: `cadence-core/bin/planning/lease-check.mjs:416-424`,
  `:251-258`; the zero-git-spawn assertion at
  `cadence-core/bin/planning-lease-check.test.mjs:607-627`.
- D-12 (this phase's own lease): The PLAN must declare
  `cadence-core/bin/trace.test.mjs` and `cadence-core/bin/phase-spelling.test.mjs`
  beyond the obvious files, or `/cad-plan`'s own `check_census` refuses it
  mid-workflow. Both fire because `cadence-core/bin/planning/lease-check.mjs` falls
  under the `cadence-core/bin/planning/` subject the `trace-refusal-sentences` and
  `phase-spelling-callsites` rows carry. Touching `workflows/plan.md` additionally
  puts `weight-budgets` and this phase's own new row at risk, both remedied by the
  lease's own entries. Measured 2026-08-25 against a candidate lease of
  `lib/census-registry.mjs`, `seam-calls.test.mjs`, `census-registry.test.mjs`,
  `planning/lease-check.mjs`, `planning-lease-check.test.mjs`, `workflows/plan.md`,
  `weight-budgets.json`, `.planning/phases/2/UAT.md`.
- D-13 (idiom count): The `planning-detail-sites` census is untouched - the new
  refusal is not an exception catch, and that census matches a literal
  `e && e.message ? e.message : String(e)` regex over the concatenated seam.
  Evidence: `cadence-core/bin/planning-lease-check.test.mjs:315-321`.
- D-14 (UAT retest mechanics): Items 9 and 10 are reset to `pending` before a
  verifier-sourced retest is recorded. `uat.mjs` refuses `would-overwrite` when
  `source === 'verifier'` and the item is not pending, and states that a fixed
  failure goes back to pending with `fix: "<hash>, retest"`. Evidence:
  `cadence-core/bin/planning/uat.mjs:194-198`, `:44-47`.

## Acceptance criteria

- [ ] AC1: `grep -c CADENCE-CENSUS cadence-core/bin/seam-calls.test.mjs` returns
      at least 1, `lib/census-registry.mjs` holds a row whose holder is that file
      and whose subjects are `cadence-core/workflows/plan.md` and
      `cadence-core/workflows/context.md`, the discovery arm reports no
      unregistered census, and `.planning/phases/2/census-replay.md` carries the
      new row's counts. Row, marker and header land in ONE commit.
- [ ] AC2: `grep -c "deliberately absent from this table" cadence-core/bin/lib/census-registry.mjs`
      returns 0, `workflows/plan.md`'s `check_census` prose names both refusal
      outcomes instead of claiming `census-at-risk` alone, and `self-verify.mjs`
      reports no weight-budget overrun for `plan.md`.
- [ ] AC3: `lease-check --plan-time` returns `ok:false` against a PLAN whose
      frontmatter carries a garbage line and against a PLAN whose key is
      misspelled `filez:`, each naming its own reason token and each token
      carrying a hint. A PLAN that declares files and puts no census at risk still
      returns `ok:true`.
- [ ] AC4: One fixture directory holding two PLAN files pins both gates on both
      signals: `plan-overlap` emits `frontmatter_issues` and `undeclared`, and
      `lease-check --plan-time` refuses on the same two. Removing either half
      fails the test.
- [ ] AC5: `planning.mjs uat status --phase 2` reports `fail: 0` - items 9 and 10
      are both recorded `pass` with evidence naming this phase's work. Item 11
      stays `pending` and phase 2's UAT stays `partial`: item 11 needs a live
      `/cad-plan` run that genuinely under-declares a census subject, and this
      phase's own run declares every holder correctly, so there is no refusal to
      observe. It is answered by a later planning run, not by this phase.
- [ ] AC6: `node cadence-core/bin/test.mjs` runs green, `npx tsc -p tsconfig.ci.json`
      exits 0, and `self-verify.mjs --root .` reports `problems []`.

## Flagged assumptions

- The `planning-detail-sites` registry row's `counts` prose says "14 error-detail
  sites ... and the 6" while its assertion pins 15 - Confident that the prose is
  stale and the assertion correct; pre-existing and unrelated to this phase. If
  wrong: nothing here, but the row misdescribes itself to the next reader.
