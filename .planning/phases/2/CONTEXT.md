# Phase 2: The collision plan-overlap was built to catch - Context

Gathered: 2026-08-22
Feeds: /cad-plan 2

## Scope boundary

In: FRM-01 and FRM-02, both in `cadence-core/bin/lib/planning-files.mjs` -
the value-level issue routing under `readFrontmatterList`/`parseFrontmatter`,
and the markdown-decoration rule in `parsePlanFiles` - plus the
`references/plan-frontmatter.md` code table and `weight-budgets.json` re-pin
that ride with them, and a `plan-overlap` envelope test in
`cadence-core/bin/planning.test.mjs`.
Out: phase 1's release/changelog seam - different file, different callers, no
shared test surface. Also out: the `- **Files:**` task-line arm (D-06), any
change to what `plan-overlap` puts in `overlaps` (D-04), and any reshaping of
the `frontmatter_issues` payload the five readers consume (D-01).
Deferred: None.
Plan shape: one plan - one file, two adjacent functions, and no seam
whose callers change shape. Splitting on FRM-01/FRM-02 would put two plans in
`lib/planning-files.mjs` at once, which `plan-overlap` would route sequential
anyway, and which is the exact collision this phase exists to make detectable.

## Durable decisions

- D-01 (FRM-01 route): value-level codes are gated to the two LIST KEYS the
  seams read - `requirements:` and `files:` - emitted key-aware at the push
  sites rather than attributed to an owning key and filtered in the selector.
  Deliberately NOT "only the key the caller asked for": a `requirements:`
  defect still reaches a `files:` read, on D-02's argument. The whole
  `resolveValue` family is gated, not `backtick-wrapped-value` alone (D-07).
  Chosen because the owning key is already in scope at both push sites, so no
  `Issue` field is added and none of D-09's five readers sees a reshaped
  envelope; the attribute-and-filter route reddens
  `planning.test.mjs:3751-3755` and blinds `/cad-audit` to `files:`-key
  defects. Evidence: `cadence-core/bin/lib/planning-files.mjs:1774-1817`,
  `:1990`, `:2009`, `:2048`, `:2050`;
  `cadence-core/bin/planning.test.mjs:3751-3755`;
  `.planning/CAPTURE.md:399`.
- D-02 (FRM-01 structural): diagnostics with no owning key -
  `unterminated-frontmatter`, `malformed-key-line`, `unknown-line`,
  `item-without-key`, `commented-key-line` - keep reaching EVERY key's read.
  A plan whose `requirements:` block is truncated by a stray line must still
  reach `plan-overlap`, or `choose_path` reads a half-parsed file as provable
  independence - FRM-02's own failure mode reopened on the other key.
  Evidence: `cadence-core/bin/lib/planning-files.mjs:1920-1926`;
  `cadence-core/bin/planning-files.test.mjs:311-315`, `:386-402`;
  `cadence-core/bin/phase-plans.test.mjs:76-92`.
- D-03 (FRM-02 placement): the decoration rule lives in `parsePlanFiles`,
  beside `redundant-path-segment`, not pushed down into `parseFrontmatter` or
  `resolveValue` - those serve `requirements:` too, where path syntax is not
  path syntax. `filesListRegion` plus the `refuseFrontmatter` cursor already
  supply the per-item line number. This placement also makes FRM-02 immune to
  FRM-01's leak by construction, since `parsePlanFiles` reads one key.
  Evidence: `cadence-core/bin/lib/planning-files.mjs:2199-2201`, `:2202-2220`.
- D-04 (FRM-02 payload): a flagged decorated path is REPORTED and its bytes
  are KEPT byte-exact (D-19) - not dropped the way `redundant-path-segment`
  drops, and not rewritten to the undecorated form. "The collision is
  DETECTED" therefore means a non-empty `frontmatter_issues`, which
  `execute.md` already routes to sequential; `overlaps` stays empty and keeps
  meaning "these two declarations intersect", never "intersect after repair".
  Rejected: adding the undecorated form as a second Set entry, which buys a
  named overlap at the cost of the normalization AC4 forbids. Evidence:
  `cadence-core/bin/lib/planning-files.mjs:2159-2168`, `:2229`;
  `cadence-core/workflows/execute.md:129-137`;
  `cadence-core/bin/planning.test.mjs:3787-3806`.
- D-05 (FRM-02 backticks): "non-boundary backticks" means a MATCHED INTERIOR
  PAIR, and the rule is ADDITIVE to the existing boundary check, which is
  unchanged. The D-19 comment argues against a matched-pair test because it
  misses half-wraps and near-miss spellings - that argument governs the
  BOUNDARY rule and does not reach the interior one. A single interior
  backtick stays diagnostic-free, so the UAT-21 over-fire guard survives
  untouched. Evidence:
  `cadence-core/bin/lib/planning-files.mjs:2055-2060`;
  `cadence-core/bin/planning-files.test.mjs:281-284`;
  `cadence-core/references/plan-frontmatter.md:240`.
- D-06 (FRM-02 arm scope): the decoration rule applies to the FRONTMATTER arm
  only, not to the `- **Files:**` task-line arm. Measured 2026-08-22 over all
  46 `PLAN*.md` under `.planning` (622 comma-split task-line elements): 57
  backticks across 5 files, 0 bold, 0 link-form - and the task arm already
  strips backticks and adds both forms, so a backticked task path already
  matches a sibling's plain one. A both-arms rule turns 5 committed plans into
  `frontmatter_issues` carriers for a spelling the arm normalizes correctly.
  Evidence: `cadence-core/bin/lib/planning-files.mjs:2188`, `:2247-2248`;
  `cadence-core/references/plan-frontmatter.md:244-249`.

## Decisions

- D-07 (AC1 shape): AC1's fixture emits TWO codes, not one. Measured
  2026-08-22: `goal: ` + a backtick-wrapped scalar, read for `files:`, returns
  `trailing-value-content` AND `backtick-wrapped-value`. D-01's gate covers
  the value-level family - `unterminated-quote`, `trailing-value-content`,
  `residual-quote`, `backtick-wrapped-value` - or AC1's empty array fails on
  the code it did not name. Evidence:
  `cadence-core/bin/lib/planning-files.mjs:1774-1817`.
- D-08 (FRM-02 shapes): the decoration set is bold (`**path**`), the link form
  (`[path](path)`), and D-05's matched interior pair - the minimum AC3 names.
  Evidence: `.planning/ROADMAP.md:119-121`.
- D-09 (caller census): five readers consume a frontmatter issue list -
  `lib/phase-plans.mjs:140` (risk floor), `planning.mjs:1344` (audit),
  `:2063` (plan-overlap), `:2165` (seed-reqs), `:2511` (lease-check). Under
  D-01 none of their envelopes changes shape. Evidence: the cited lines.
- D-10 (risk-floor effect): `declaredFilesIn` hard-bails a plan's whole
  declared file list on ANY issue from the pass, so under D-01 a `goal:`-key
  defect stops suppressing the risk floor. Behaviour change, intended.
  Evidence: `cadence-core/bin/lib/phase-plans.mjs:140-145`;
  `cadence-core/bin/phase-plans.test.mjs:76-92`, `:248-257`, `:279-296`.
- D-11 (docs + budget): `references/plan-frontmatter.md` changes in the same
  commit as the code - a new code row plus the "whole pass's issues"
  statements - and `weight-budgets.json`'s 17312-byte pin for that file is
  re-pinned in the same change, or AC7 reddens on this phase's own edit.
  Phase 1's D-12 is the precedent. Evidence:
  `cadence-core/bin/weight-budgets.json:36`;
  `cadence-core/references/plan-frontmatter.md:200-204`.
- D-12 (code-set guard): the new code's table row is pinned by a test deriving
  the code set from EXECUTABLE source - the 13 grammar-code literals between
  `planning-files.mjs:1729` and `:2244` - never from a prose-to-prose
  comparison, which passes when both lists are stale together. Phase 1's D-07
  and `helper-census.test.mjs` are the precedent; no check ties that reference
  table to the code today (`grep -c plan-frontmatter` is 0 in both
  `prose-agreement.test.mjs` and `self-verify.test.mjs`). Evidence:
  `cadence-core/bin/helper-census.test.mjs:100-170`;
  `.planning/DOCS-CLAIMS.md:1288`.

## Acceptance criteria

- [ ] AC1: A test parses a document whose `goal:` scalar is backtick-wrapped
      and asserts `readFrontmatterList(text, 'files')` returns `issues: []`,
      with both `trailing-value-content` and `backtick-wrapped-value`
      suppressed, while the same read over a backticked `files:` entry still
      reports its code.
- [ ] AC2: A test asserts a structural code raised inside a `requirements:`
      block - an `unknown-line` - still appears on a `files:` read.
- [ ] AC3: A test asserts `parsePlanFiles` reports an issue for `**path**`,
      for `[path](path)`, and for a matched interior backtick pair, and
      reports none for a plain path or for a path carrying one interior
      backtick.
- [ ] AC4: A test asserts every flagged decorated entry appears in the
      returned files list with its bytes unchanged - not dropped, and not
      rewritten to the undecorated form.
- [ ] AC5: A test drives `planning.mjs plan-overlap` over two plans declaring
      the same file, one plain and one decorated, and asserts the envelope
      carries a non-empty `frontmatter_issues` naming the decorated line.
- [ ] AC6: A test derived from `planning-files.mjs` source reddens when a
      grammar code literal in that module is absent from
      `references/plan-frontmatter.md`'s code table.
- [ ] AC7: `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true`
      with `problems: []`, and `node cadence-core/bin/test.mjs` reports 0
      failures.

## Flagged assumptions

- The `.planning/CAPTURE.md` latent item about `parsePlanFiles`' task-line
  `\s*` prefix is already resolved and is not work for this phase - the
  pattern keeps the prefix but measures the line number to the `**Files:**`
  marker rather than from `m.index`, so the note's "nothing reads the offset
  today" is stale - Confident; if wrong: a line number on the task arm names
  an earlier line than the declaration, which AC3-AC5 do not exercise.
- No static-analysis command exists for this tree (`detect-commands --root .`
  returns `lint:null, typecheck:null`), so any `// @ts-check` annotation on
  `planning-files.mjs` goes unchecked locally - Confident; if wrong: a type
  error ships that CI catches later. Carried forward from phase 1's open items.
