# Phase 4: One spelling, one phase - Context

Gathered: 2026-08-25
Feeds: /cad-plan 4

## Scope boundary

In: the `phases/` directory grammar rejects a zero-padded fraction and reports
it as `phase-dir-grammar` drift; the two `phases/` listing filters are tightened
to agree; the phase-directory grammar is stated once, in
`cadence-core/references/roadmap-phases.md`; a tree-aware spelling check is
wired at every callsite that resolves `--phase` to a `phases/<N>/` path; a
registered census pins the guarded-callsite count.

Out: changing `phaseSpellingRefusal`'s purity or the unconditional behaviour of
the two write faces it already guards (`cursor set`, `seed-reqs`) - v3.5.5's UAT
pinned both. Making `2.0` addressable as a synonym for phase 2. Rewriting the
archived citations under `.planning/_archive-v*` or in `.planning/trace.jsonl`
(phase 5 D-04 already exempted them). Wiring the check at `capture`, which
resolves no path (D-08).

Deferred: None.

Plan shape: one plan.

## Durable decisions

- D-01 (grammar): The fix is an explicit fraction grammar (`[1-9]\d*` in the
  fractional part), NOT a round-trip predicate. Measured 2026-08-25 against the
  live regexes: `1.01` round-trips, so a round-trip rule leaves it legal, while
  `1.10` does not round-trip yet AC1 requires it stay legal - a round-trip rule
  inverts two of AC1's six cases. Rejected: reusing `phaseSpellingRefusal`'s
  `String(Number(x)) === x`. Evidence: `cadence-core/bin/planning/status.mjs:28`,
  `cadence-core/bin/planning/core.mjs:77-82`.
- D-02 (grammar): `2.0` is NOT a legal spelling of phase 2. The fraction is the
  sub-phase ordinal and obeys the same no-zero-padding rule as the integer part,
  so `.0` is not a fraction at all. Rejected: ruling `N.0` a legal synonym for
  `N` and teaching the seams to resolve it, which `conventions.md`'s "Cadence
  resolves no other spelling" already forbids, and which would contradict
  `phaseSpellingRefusal`'s existing unconditional refusal of `--phase 2.0` on
  day one. Evidence: `cadence-core/references/conventions.md:22-32`,
  `cadence-core/bin/planning/status.mjs:18-27`.
- D-03 (drift report): The `phase-dir-grammar` grouping key stays the LEADING
  DIGIT RUN (`/^\d+/`), so `1.01` and `1.00` group against `phases/1` and AC1's
  "names the legal directory it collides with" is satisfied by the existing
  collision machinery unchanged. Rejected: grouping by `Number(name)`, which
  isolates `1.01` correctly but then groups `1.10` with `1.1` - and AC1 requires
  `1.10` produce no entry at all. Evidence:
  `cadence-core/bin/planning/status.mjs:55-66`, `:74-81`;
  `cadence-core/bin/planning-status.test.mjs:311-357` pins the detail strings.
- D-04 (listing filters): The two `phases/` listing filters are TIGHTENED to
  match the grammar, not left with a comment. The `status.mjs` comment claiming
  they already exclude zero-padded names is factually wrong: measured
  2026-08-25, `/^\d+(\.\d+)?$/` matches `08`, `0`, `1.01`, `1.00` and `2.0`.
  Left as-is, a tree with `phases/8` and `phases/08` emits TWO `phase-dir`
  entries both carrying `phase: 8`, and `recall` indexes `phases/08/SUMMARY.md`
  snippets under `phase: 8` - a different phase's evidence returned as this
  phase's. AC2 also cannot be met by "carry a comment naming why they
  deliberately differ" when the existing comment's stated reason is untrue.
  Rejected: keeping both filters loose and rewriting the D-09 comment. Evidence:
  `cadence-core/bin/planning/status.mjs:22-27` (the false claim), `:151`
  (surviving-dir filter), `cadence-core/bin/planning/recall.mjs:71` (corpus
  filter).
- D-06 (what is being fixed): The harm the refusal must stop is the MIXED
  callsite - one that addresses `phases/<raw>/` for the directory but reports
  `.value` in the envelope's `phase:` key - not a wholesale misread. Every
  path-resolving command already builds `join(dir, 'phases', parsedPhase.raw)`,
  so `--phase 1.10` already reads `phases/1.10/` and never touches
  `phases/1.1/` content. A plan assuming otherwise will assert `ok:false` where
  the pre-change behaviour is already a `no-phase-dir` refusal naming the right
  directory. Rejected: wiring only the callsites that emit `.value`, leaving
  pure `.raw` readers addressable. Evidence:
  `cadence-core/bin/planning/cite-count.mjs:62` vs `:111`/`:210`,
  `plan-size.mjs:32` vs `:62`, `lease-check.mjs:208` vs `:217`,
  `plan-overlap.mjs:31` vs `:34`, `risk-check.mjs:75,331` vs `:390`,
  `cadence-core/bin/planning/core.mjs:546-549`.
- D-07 (reach of the refusal): `phaseSpellingRefusal` stays PURE and
  unconditional at the two write faces; a SEPARATE tree-aware check is added at
  the path-resolving callsites. `--phase 1.10` refuses when `phases/1.1/`
  exists and resolves when `phases/1.10/` does. This matches AC4's own wording
  ("against a tree holding `phases/1.1/`") and keeps the `phases/1.10/`
  capability `lib/require-int.mjs` deliberately built. Rejected: wiring the pure
  refusal everywhere, which makes `phases/1.10/` a legal directory name no
  command can address - the cost `core.mjs:67-71` already states for two
  callsites, generalized to twenty-two; and making `1.10` illegal in
  `PHASE_DIR_NAME` too, which contradicts AC1 as written. Evidence:
  `cadence-core/bin/planning/core.mjs:67-82`,
  `cadence-core/bin/lib/require-int.mjs:70-90`,
  `cadence-core/bin/capture-file.test.mjs:93-98`.
- D-08 (the exception): `capture` is the standing exception and takes a COMMENT
  rather than a wire. `planning/capture.mjs:92` uses `parsed.raw` as a TAG in
  CAPTURE.md, resolves no `phases/<N>/` path, and a pinned test asserts
  `--phase 1.10` produces `(phase 1.10)`. Evidence:
  `cadence-core/bin/planning/capture.mjs:85,92`,
  `cadence-core/bin/capture-file.test.mjs:93-98`,
  `cadence-core/bin/lib/planning-files.mjs:930-940`.
- D-09 (the one statement): AC2's "stated once in `roadmap-phases.md`" means
  MOVING the statement, not adding one. The grammar is stated in full in
  `conventions.md` today and paraphrased on three more live surfaces;
  `roadmap-phases.md` mentions `phase-dir` drift but never states the grammar.
  Adding without retiring produces two statements, which is the failure AC2
  names. Retiring the workflow paraphrases without touching DOCS-CLAIMS leaves
  two rows verdicted "accurate" against text that no longer exists. Evidence:
  `cadence-core/references/conventions.md:22-33` (canonical today),
  `cadence-core/references/roadmap-phases.md:131-135`,
  `skills/cad-health/SKILL.md:91-93`, `.planning/DOCS-CLAIMS.md:912`
  (`NEW-PROJECT-21`) and `:1142` (`ADOPT-25`).
- D-11 (the census): A REGISTERED census (marker plus `CENSUSES` row) IS viable
  here, unlike phase 3's. Measured 2026-08-25 by replaying `censusesAtRisk` over
  the live corpus (46 plans declaring under `cadence-core/bin/`, rail bound 23):
  a row with subjects `['cadence-core/bin/planning/']` and a new test file as
  holder refuses 4 of 46. Rejected: adding `cadence-core/bin/planning.mjs` to
  the subjects for symmetry with the two existing rows, which pushes it to 18 -
  still passing but close to the bound the phase-3 deviation tripped, and
  unnecessary since no callsite lives there. Evidence:
  `cadence-core/bin/lib/census-registry.mjs:412-444`,
  `cadence-core/bin/planning-lease-check.test.mjs:703-724`, precedent rows
  `trace-refusal-sentences` and `planning-detail-sites` at
  `census-registry.mjs:137-146,211-222`.

## Decisions

- D-05 (where the callsites are): The callsite set is
  `cadence-core/bin/planning/*.mjs`, NOT `planning.mjs`. Measured 2026-08-25: 22
  live `requirePhaseArg(...)` invocations outside tests, across 14 `planning/`
  modules plus `lib/arg-contract.mjs:184`, and ZERO in `planning.mjs`, which
  retains only a comment at `:345`. Both SPL-02's original "roughly 28 callsites
  in planning.mjs" and the ROADMAP's "the `requirePhaseArg` callsite count in
  `planning.mjs`" are pre-split wording; a census pinned over `planning.mjs`
  counts zero and passes vacuously forever. SPL-02's row was corrected in place
  on the user's approval during this pass. Evidence:
  `cadence-core/bin/planning.mjs:345`,
  `cadence-core/bin/planning/trace.mjs:270,376,741,788,844`,
  `cadence-core/bin/planning/risk-check.mjs:70,326`,
  `cadence-core/bin/planning/core.mjs:446,744`.
- D-10 (budget coupling): Any edit to `roadmap-phases.md` or `conventions.md`
  must update `cadence-core/bin/weight-budgets.json` in the SAME commit.
  Measured 2026-08-25: both budgets are the files' exact current byte sizes
  (`roadmap-phases.md` 10680/10680, `conventions.md` 15791/15791), so a single
  added character fires `budget-overrun`. At plan time `lease-check` refuses any
  `files:` block declaring under `cadence-core/references/` that does not also
  declare `weight-budgets.json`. Evidence:
  `cadence-core/bin/weight-budgets.json:30,43`,
  `cadence-core/bin/self-verify.mjs:783-789`,
  `cadence-core/bin/lib/census-registry.mjs:149-168`.
- D-12 (the close breaks a test): `citation-census.test.mjs` breaks when SPL-01
  and SPL-02 move from `## Active` to `## Shipped`, and the plan owns that. Its
  guarded set is REQUIREMENTS.md's `## Active` section only; Shipped rows are
  one-line summaries carrying no line citations (`FLD-01` is the precedent). Two
  of the table's three rows are exactly these requirements' citations, and the
  test asserts both set-equality and `CITATIONS.length >= 3`. Left unhandled the
  suite reds in the phase-close commit, the most expensive place to find it.
  Evidence: `cadence-core/bin/citation-census.test.mjs:138-152`, `:154-162`,
  `:165`; `.planning/REQUIREMENTS.md` `## Active` rows and `:107` (`FLD-01`).
- D-13 (line-pinned citations): Editing `status.mjs:28` or `core.mjs:77` in
  place - even by a one-line shift - also breaks that census, independently of
  the Shipped move, because the rows pin exact line numbers and assert the named
  symbol appears on them. Evidence:
  `cadence-core/bin/citation-census.test.mjs:168-176`. [corrected by plan-1
  deviation: the plan breaks three MORE pinned citations D-13 does not name -
  `EXECUTE-10`, `VERIFY-11` and `cad-verifier-contract`'s `uat.mjs:489-491` -
  because a guard inserted near the top of a module shifts every pin below it]

## Acceptance criteria

- [ ] AC1: With `phases/1.01`, `phases/1.00` and `phases/2.0` on disk,
      `planning.mjs status` reports a `phase-dir-grammar` drift entry naming
      each, and names the legal directory it collides with when one is present.
      `phases/1.1`, `phases/1.10` and `phases/8` stay legal and produce no
      entry.
- [ ] AC2: `cadence-core/references/roadmap-phases.md` states the
      phase-directory grammar, including that `2.0` is not a legal spelling of
      phase 2. `cadence-core/references/conventions.md` no longer states it. A
      grep of the retired sentence across `skills/`,
      `cadence-core/workflows/` and `cadence-core/references/` returns exactly
      one hit, in `roadmap-phases.md`.
- [ ] AC3: On a tree holding both `phases/8` and `phases/08`, `planning.mjs
      status` emits exactly ONE `phase-dir` drift entry carrying `phase: 8`, and
      `planning.mjs recall` returns no snippet sourced from `phases/08/`.
- [ ] AC4: For every command that resolves `--phase` to a `phases/<N>/` path:
      against a tree holding `phases/1.1/`, `--phase 1.10` returns `ok:false`
      with a `bad-args` reason naming both fixes; against a tree holding
      `phases/1.10/` and no `phases/1.1/`, the same command resolves and acts on
      `phases/1.10/`.
- [ ] AC5: `cursor set --phase 1.10` and `seed-reqs --phase 1.10` each return
      `ok:false` naming both fixes regardless of what is on disk, and `capture
      --phase 1.10` still writes the tag `(phase 1.10)`.
- [ ] AC6: Adding a `requirePhaseArg` callsite that resolves a `phases/<N>/`
      path without the tree-aware check fails `node cadence-core/bin/test.mjs`
      with a message naming that file and line. With the census row registered,
      `planning-lease-check.test.mjs`'s half-the-plans rail still passes.
- [ ] AC7: `node cadence-core/bin/test.mjs` runs green, `npx tsc -p
      tsconfig.ci.json` exits 0, and `cadence-core/bin/self-verify.mjs` reports
      `problems []` - including the re-pinned `weight-budgets.json` entries for
      `roadmap-phases.md` and `conventions.md`.

## Flagged assumptions

None - all assumptions confirmed. The analyzer returned no `needs_research`
topics, and every Likely-confidence item was locked as a decision above with its
if-wrong consequence recorded on the decision line.
