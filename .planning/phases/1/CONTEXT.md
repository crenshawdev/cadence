# Phase 1: Bound what a dispatch is handed - Context

Gathered: 2026-08-26
Feeds: /cad-plan 1

## Scope boundary

In: a byte ceiling on what a plan's `files:` frontmatter declares, reported at
plan time by `plan-size` (BUD-03); and a narrowing of the plan-time risk floor
so incidental body lines stop counting as evidence of a risk surface (RSK-05).
Out: reducing the bytes the floor READS (17.2 MB across this project's 28 phase
directories, measured 2026-08-26) - it is measured on the replay row and carries
no reduction target this phase. Also out: any change to `CONTENT_SIGNALS`
itself, which the blocking commit-time gate shares; the rung ladder; and the
`waive_routing_floor` key, which is left as it is.
Deferred: None.
Plan shape: multiple plans, same phase - BUD-03 (AC1-AC3) and RSK-05 (AC4-AC6)
sit on two unrelated seams and share only AC7.

## Durable decisions

- D-01 (Risk floor / OQ-2): there is no diff at plan time and no route to one.
  `route.mjs` imports `node:url`, `node:path` and `node:fs` only, and
  `resolve` declares no `--base`/`--head`. The one face that reads git is the
  commit-time `risk-check.mjs`, in a different tree. RSK-05's wording ("reads
  the diff") is therefore satisfied by narrowing what counts as evidence, not
  by acquiring a diff. Evidence: `cadence-core/bin/route.mjs:118-130`,
  `cadence-core/bin/lib/arg-contract.mjs` (route.mjs rows),
  `cadence-core/bin/planning/risk-check.mjs:214`.
- D-02 (Risk floor): the narrowing lives in `scanDeclared`'s own arms, never in
  `CONTENT_SIGNALS`. The two faces share one table by construction so their
  signals and ORDER cannot drift, and both existing exemptions are already
  marked scoped to the plan-time face. Editing the table would silently widen
  the one gate that is `blocking` at every stakes level. Evidence:
  `cadence-core/bin/lib/risk-diff.mjs:2-9`, `signalIn` at :238, the scoped
  exemptions at :417-476.
- D-03 (Risk floor): the narrowing is a LINE-KIND exemption - import statements
  and constant declarations stop counting as evidence. The measured false
  positives are exactly that shape: `self-verify.test.mjs:6` is an `fs`
  teardown import, `planning-files.mjs:112` is `const PHASE_TOKEN = ...`,
  `review-provider.mjs:306` is `const DEFAULT_MAX_PROMPT_TOKENS = 120000`,
  `debt-markers.mjs:21` is `const DEBT_TOKEN = 'CADENCE-DEBT'`. Three of the
  four `secrets` raises are constants whose NAME contains `TOKEN`. Rejected: a
  "more than one matching line" threshold, which stops a genuine one-line
  surface from flooring and so weakens the floor rather than narrowing it.
- D-04 (Risk floor): `review.triggers.risk_surface.waive_routing_floor` cannot
  deliver this phase's discount and is not the answer to RSK-05. It lowers to
  the CONFIGURED stakes and no further, and this repository sets no `stakes`
  key, so its discount is the unset-`solo` floor the waiver arm explicitly does
  not grant. Every waived phase would still resolve at `shipped`, exactly where
  it is today. Evidence: `cadence-core/bin/route.mjs:697-707`, `UNSET_FLOOR` /
  `RAISE_TARGET` at :183-184, `.planning/config.json` (no `stakes`), and the
  `replay` rows where `_archive-v2.2.0/5` computes `solo` against 25 rows
  computing `shipped`.
- D-05 (Risk floor / OQ-2): asking planners to declare narrower files is
  foreclosed by the grammar. `covers` is path equality or a trailing-slash
  directory prefix, there is no line-range spelling anywhere, and
  `check_census` positively forces each named file into the list and refuses
  until it is there. Evidence: `cadence-core/bin/lib/lease-grammar.mjs`,
  `cadence-core/templates/PLAN.md` frontmatter, `cadence-core/workflows/plan.md`
  `check_census` (:295-335).
- D-06 (Byte ceiling / OQ-1): the ceiling bounds DECLARED BYTES, and its default
  is 675,000 B - the measured p75 of 667,580 across 43 historical plans, rounded
  up to the next 25,000. That is the derivation rule `config.schema.json`
  already states for the six `max_dispatch_tokens` keys, so the default carries
  a precedent rather than an argument. Rejected: 800,000 B (the executor token
  ceiling at the 4 B/token ratio the roadmap's own case implies, firing on 8 of
  43) and 252,473 B (the roadmap's measured case, firing on 31 of 43, which
  leaves criterion AC2 with no everyday witness). Evidence:
  `cadence-core/config.schema.json:32-37`; declared-byte distribution measured
  2026-08-26 over `phaseDirsIn` / `declaredFilesIn` across `.planning/_archive-*`
  (p25 207,298, p50 401,107, p75 667,580, p90 933,283, max 1,282,083).

## Decisions

- D-07 (Byte ceiling): `plan-size` reports the crossing as one more `over[]`
  entry beside `plan-too-many-tasks`, at the existing `check_size` step - not a
  new seam and not a new workflow step. `seam-calls.test.mjs` pins `plan.md` at
  14 calls with an enumerating note, so a new seam invocation goes red and a new
  flag on the existing call does not. Evidence:
  `cadence-core/bin/planning/plan-size.mjs:91-113`,
  `cadence-core/bin/seam-calls.test.mjs:95-112`,
  `cadence-core/workflows/plan.md:274-293`.
- D-08 (Byte ceiling): `plan-size` still reads no config. The ceiling arrives as
  a caller-resolved CLI flag, added to `plan.md`'s `config.mjs get` batch at
  `parse` and substituted the way `{workflow.max_plan_tasks}` already is. A
  second reader here would be a second place for the resolved ceiling to
  disagree with the one the planner was handed. Evidence:
  `cadence-core/bin/planning/plan-size.mjs:22-25`,
  `cadence-core/workflows/plan.md:38-50`.
- D-09 (Byte ceiling): the check REPORTS and refuses nothing, matching the
  existing plan-size disposition. The user may have authorized the full scope at
  `too_big` option 3, and the workflow has no arm for a refusal there. Evidence:
  `cadence-core/workflows/plan.md:290-292`,
  `cadence-core/config.schema.json:32-37`.
- D-10 (Byte ceiling): the measurement is the sum of on-disk sizes of the
  declared paths; a declared path that does not exist yet contributes zero AND
  its count is reported beside the total. 12 of 43 historical plans declare at
  least one absent path, so without the count a creation-heavy plan reads as
  "under the ceiling" when the number is silently measuring something smaller.
  Evidence: measured 2026-08-26 over 43 `PLAN*.md` files in 28 phase
  directories; `cadence-core/bin/lib/phase-plans.mjs` `declaredFilesIn`.
- D-11 (Read cost): bytes read to compute a floor decision are recorded on the
  `route.mjs replay` row, with no reduction target this phase. Evidence: 525
  declared files, 17,222,879 bytes measured 2026-08-26 across the 28 phase
  directories; `levelFor`'s `evidencedBy` (`route.mjs:638-644`) re-runs
  `scanDeclared` per matched entry, so some bodies are scanned more than once.
- D-12 (Registration): a new config key lands in FOUR places, not the two [corrected by plan-1 deviation: it lands in FIVE - the fifth is `self-verify.test.mjs`'s hand-maintained whole-schema completeness fixture, which fails `inert-config-key` for any key absent from it]
  criterion 5 names - `config.schema.json`, `references/config-catalog.md`,
  `references/config-reach.md`, and prose that names the key. Separately,
  `weight-budgets.json:77` pins `workflows/plan.md` at 28,764 B and the file is
  currently exactly 28,764 B, so any prose added to `check_size` must re-pin the
  budget in the same change. Evidence: `cadence-core/bin/self-verify.mjs` check
  9 (`parseReachTable`/`reachIssues`) and check 1b at :776-782
  (`inert-config-key`); `cadence-core/references/config-reach.md:17-24`;
  `cadence-core/bin/weight-budgets.json:77`.

## Acceptance criteria

- [ ] AC1: `planning.mjs plan-size --phase 1` run against a plan whose `files:`
      frontmatter declares more than the configured byte ceiling returns an
      `over[]` entry carrying the plan, its measured bytes and the ceiling, in
      the same field shape `plan-too-many-tasks` uses.
- [ ] AC2: the same call against a plan declaring fewer bytes than the ceiling
      returns no byte entry in `over[]`.
- [ ] AC3: the byte measurement reports how many declared paths were absent from
      disk, and a plan declaring an absent path shows a non-zero count there.
- [ ] AC4: `route.mjs replay --file .planning/config.json` shows at least one
      archived scope citing DIFFERENT evidence for its raise than it cites
      today, with its `reason` naming the file whose body match no longer
      counts. `_archive-v2.2.0/2` is the witness: its winning surface moves
      from `secrets` to `destructive`. A LOWER computed level is not required
      and does not occur on this corpus - measured 2026-08-26, 0 of 28 scopes
      drop a rung, because every raising scope retains a genuine call site.
- [ ] AC5: in that same replay, every scope whose raise came from a body line
      that is neither an import nor a constant declaration computes the level it
      computes today.
- [ ] AC6: each `route.mjs replay` row carries the bytes read to compute it.
- [ ] AC7: `node cadence-core/bin/test.mjs` is green, `self-verify` reports no
      problems, and the new config key appears in `config.schema.json`,
      `references/config-catalog.md` and `references/config-reach.md`.

## Flagged assumptions

- A line-kind exemption tuned to this repository's measured false positives may
  be overfit, giving a user on their own project no discount at all - Likely; if
  wrong, the phase does not cross the user-facing dividing line this cycle was
  triaged against, and RSK-05 ships as a Cadence-on-Cadence fix.
- The set of scopes surviving a line-kind exemption has NOT been measured. What
  is measured: bodies stripped entirely drops all 28 scopes to 0 raises, and
  exempting `.test.mjs` bodies alone still leaves 23 of 28 raising. The planner
  should measure the line-kind survivors before writing AC5's witness list -
  Likely; if wrong, AC5 has a thinner witness set than AC4's discount implies.
- `MAX_BODY_BYTES = 512 KiB` at `route.mjs:230` never fires on this corpus, so
  the "over the cap" `unread` arm at :452 is untested by real data here -
  Confident; if wrong, a project with larger files hits an arm this phase's
  changes were never exercised against.
