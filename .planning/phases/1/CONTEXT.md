# Phase 1: The close that continues over a manifest nobody bumped - Context

Gathered: 2026-08-22
Feeds: /cad-plan 1

## Scope boundary

In: the six release/changelog defects of #231 (REL-01, REL-02, REL-03), all in
`cadence-core/bin/release-bump.mjs` and `cadence-core/bin/lib/release-decision.mjs`,
plus the one caller that has to change to see any of them,
`cadence-core/workflows/milestone.md`.
Out: phase 2's frontmatter reader (`lib/planning-files.mjs`, `plan-overlap`) -
different file, different callers, no shared test surface. Also out: any
rewrite of the changelog format itself, and any change to `planning.mjs`'s
`version_drift` audit signal beyond keeping its `normalizeTargetVersion` call
working.
Deferred: None.
Plan shape: multiple plans, same phase - the pure parser (AC2/AC3/AC5, in
`release-decision.mjs`, guarded by three existing tests) and the seam envelope
plus header and workflow prose (AC1/AC4/AC6, in `release-bump.mjs` and
`milestone.md`) touch different files. AC7 rides both.

## Durable decisions

- D-01 (no-version-field fork): the refusal is SEAM-LEVEL. `release-bump.mjs`
  maps a PRIMARY `skip`/`no-version-field` verdict to `ok:false` /
  `action:"refuse"`; sibling manifests keep skipping. Chosen over the fifth
  `milestone.md` halt on three grounds: the caller census returns one caller,
  so the envelope change reaches nobody else; AC1 asks for a test that proves
  the close halts, and only an `ok:false`/exit-1 envelope is mechanically
  assertable; and `milestone.md` sits at its byte ceiling, so a halt bullet
  costs far more prose than one token in `MILESTONE-06`'s code list.
  Evidence: `cadence-core/workflows/milestone.md:53`, `:77-82`;
  `cadence-core/bin/release-bump.mjs:298-309`; `cadence-core/bin/weight-budgets.json:66`.
- D-02 (no-version-field fork): the pure core is NOT the place for it -
  `decideManifestBump` keeps returning `skip`/`no-version-field` unchanged.
  `.claude-plugin/marketplace.json` carries no `version` field by design, and
  a refusal verdict on a sibling row halts Cadence's own milestone close every
  cycle. Measured 2026-08-22 against this repo's manifests copied into a
  fixture. Evidence: `cadence-core/bin/lib/release-decision.mjs:188-222`;
  `cadence-core/bin/release-bump.mjs:298-309`.
- D-03 (emptiness rule): "empty" means blank lines plus `###`/`####`
  subheadings only. Any other non-blank line - INCLUDING a prose paragraph
  with no bullets - is content. The natural-looking "must contain a `- `
  bullet" rule is rejected: every released section in this repo's own
  `CHANGELOG.md` opens with prose before any bullet, so that rule would report
  real authored sections as empty and fire the halt on every close.
  Evidence: `cadence-core/bin/lib/release-decision.mjs:399-410`;
  `CHANGELOG.md:11-25`.
- D-04 (empty scaffold): a heading-only `## [Unreleased]` body still PROMOTES,
  and the halt fires off `section_empty:true`. Rejected: widening
  `promoteUnreleased`'s blank-edge trim so the `### ` scaffold survives under
  the stub - it answers CAPTURE item 3's "the empty scaffold is consumed"
  complaint but widens the phase past what REL-02 asks for.
  Evidence: `cadence-core/bin/lib/release-decision.mjs:334`, `:347-349`;
  `.planning/CAPTURE.md` item 3.
- D-05 (trailing link-refs): the trailing link-reference block is the run of
  refs at EOF whose keys name an existing `## [key]` heading; anything else is
  body content that promotes with its section. The obvious rule - stop the
  backwards scan at the first blank line - is dead, because
  `release-decision.test.mjs:381-404` pins the opposite outcome for a fixture
  that is also blank-separated. Rejected alternatives: version-shaped keys
  only (loses refs for a project using non-semver release keys), and bounding
  from the last `## ` heading. Evidence:
  `cadence-core/bin/lib/release-decision.mjs:386-390`, `:257`;
  `cadence-core/bin/release-decision.test.mjs:381-404`, `:406-432`.
- D-06 (unparseable target): item 6's fix KEEPS THE RAW ARGUMENT and refuses
  naming it, rather than the null-returning `normalizeTargetVersion` change
  `.planning/CAPTURE.md` item 6 proposes - that would yield `target:null` and
  still `no-target-version`, which does not name `v`. `release-bump.mjs:227`
  discards the raw value at normalization today. Note the second consumer:
  `planning.mjs:1471` calls `normalizeTargetVersion` for v-stripping inside
  the audit's `version_drift` signal, so its contract is not local to this
  seam. Evidence: `cadence-core/bin/release-bump.mjs:227`;
  `cadence-core/bin/planning.mjs:179`, `:1471`.
- D-07 (code-set test): the verdict-code test derives its set from EXECUTABLE
  source - the `code: '<token>'` literals in `decideManifestBump` - not from
  the JSDoc list, because a JSDoc-to-header comparison passes when both prose
  lists are stale together, which is exactly how this defect survived two
  cycles. `helper-census.test.mjs` is the established precedent for a test
  that regexes module source. Evidence:
  `cadence-core/bin/lib/release-decision.mjs:188-222`;
  `cadence-core/bin/helper-census.test.mjs:31`, `:89-91`, `:215`;
  `cadence-core/bin/release-decision.test.mjs:135-140`.

## Decisions

- D-08 (caller census): `cadence-core/workflows/milestone.md:53` is the ONLY
  production caller of `release-bump.mjs bump`. Every other hit is a test, an
  arg-contract row, a test-runner list, a comment or a mermaid node.
  Downstream of the pure core: `decideManifestBump` is imported only by
  `release-bump.mjs:116`; `normalizeTargetVersion` also by `planning.mjs:179`;
  `compareVersions` also by `lib/branch-decision.mjs:56`. Evidence:
  `cadence-core/bin/test.mjs:43`; `cadence-core/bin/lib/arg-contract.mjs:923-931`;
  `cadence-core/references/conventions.md:98`; `design-notes/cadence-flows.md:55`.
- D-09 (fence awareness): the fix covers BOTH `^## ` scans in
  `release-decision.mjs`, not just `sectionEnd`. `prependChangelogEntry`'s
  heading-anchor scan is equally fence-blind and is the one that actually
  corrupts the file - measured 2026-08-22, it wrote the new dated heading
  INSIDE a fenced block. Evidence:
  `cadence-core/bin/lib/release-decision.mjs:265-266`, `:383-391`.
- D-10 (absent changelog): the absent-`CHANGELOG.md` signal is an explicit
  field on the `changelog` object, and it is set on EVERY path - including the
  one where the changelog gate is never entered. Today the three states differ
  only by key presence (`section_empty` is `undefined` vs `false`, both falsy),
  so `milestone.md:83`'s halt reads them alike. Evidence:
  `cadence-core/bin/release-bump.mjs:325`, `:337-338`;
  `cadence-core/workflows/milestone.md:83`.
- D-11 (header drift): the header/JSDoc drift is BIDIRECTIONAL and this phase
  fixes both directions. `release-bump.mjs:101-103` names 4 of the 7 core
  verdict codes (missing `unparseable-version`, `downgrade`, `not-an-upgrade`);
  `release-decision.mjs:151-152` names 4 of the 9 seam codes (missing
  `unreadable-sibling-manifest`, `unreadable-changelog`, `partial-bump`,
  `bad-date`, `missing-flag-value`). None of the v3.5.8 phase-2 open item has
  landed - the file is untouched since `0bf62847` (v2.2.0). Evidence: the
  cited line ranges; `git log --oneline -- cadence-core/bin/lib/release-decision.mjs`.
- D-12 (budget): `cadence-core/workflows/milestone.md` measures 14937 bytes
  against a ceiling of exactly 14937, so ANY prose added here - including
  D-01's one-token `MILESTONE-06` edit - requires re-pinning
  `weight-budgets.json` in the same change or AC7 fails on this phase's own
  commit. Baseline confirmed clean today. Evidence:
  `cadence-core/bin/weight-budgets.json:66`; `cadence-core/bin/self-verify.mjs:736-739`.
- D-13 (regression guards): `release-decision.test.mjs:381-404` and `:406-432`
  are the two tests any link-ref change must keep green, and `:434-438` is the
  one any emptiness change must keep green. No test anywhere enumerates
  `milestone.md`'s halt list, so the prose edit has no existing guard.
- D-14 (docs claims): the `.planning/DOCS-CLAIMS.md` `MILESTONE-06` (`:881`)
  and `MILESTONE-08` (`:883`) rows are updated by hand alongside the prose
  edit; no mechanical check enforces their line ranges, and `MILESTONE-08` is
  already stale (cites 60-62, the claim lives at `milestone.md:83`).

## Acceptance criteria

- [ ] AC1: `release-bump.mjs bump --version <v>` against a fixture whose PRIMARY
      manifest has no `version` field returns `{"ok":false,"action":"refuse",
      "reason":"no-version-field"}` at exit 1 and writes nothing; the same
      command against this repo's own manifests still returns `ok:true` with
      the `.claude-plugin/marketplace.json` sibling row as `action:"skip"`.
- [ ] AC2: Promoting an `## [Unreleased]` body containing a fenced block with a
      `## ` line in it moves the whole body - fence-open, the fenced `## `
      line, fence-close and the trailing bullet - into the dated section; and
      `prependChangelogEntry` over the same document writes the dated heading
      before the fence, never inside it.
- [ ] AC3: An `## [Unreleased]` body carrying only `### Added` / `### Fixed`
      with no bullets returns `section_empty:true` and the close's
      empty-section halt fires on it; a body that is a prose paragraph with no
      bullets returns `section_empty:false`.
- [ ] AC4: The three cases - `CHANGELOG.md` absent, present with nothing to do,
      and the changelog gate never entered - return three distinguishable
      envelopes asserted by one test, and `workflows/milestone.md` names the
      absent state.
- [ ] AC5: A last-in-file `## [Unreleased]` section ending in a `[#NN]: url`
      definition promotes that definition with its section, while a file-final
      `[1.0.0]: url` whose key names an existing `## [1.0.0]` heading stays
      put; `release-decision.test.mjs:381-404` and `:406-432` still pass.
- [ ] AC6: `release-bump.mjs bump --version v` returns `ok:false` with a reason
      naming the unparseable target and the raw `v` in the envelope; and a test
      derives the verdict-code set from `release-decision.mjs`'s executable
      `code:` literals, reddening when any code is missing from either the
      `release-bump.mjs` header or the `release-decision.mjs` JSDoc.
- [ ] AC7: `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true`
      with an empty `problems` array.

## Flagged assumptions

- D-05's heading-key rule is the only rule the analyzer found that satisfies
  both existing link-ref tests AND the new case, but it is inferred from
  `prependChangelogEntry:257`'s own `[<version>]: <url>` scaffold rather than
  measured against a corpus of real changelogs - Likely; if wrong, fixing item
  5 reddens `release-decision.test.mjs:381` or sweeps a released version's own
  link reference into the promoted body.
- Whether the `DOCS-CLAIMS.md` rows (D-14) get a mechanical backstop in
  `prose-agreement.test.mjs` - where workflow-prose-names-what-code-emits
  checks already live - is left to the planner; the hand edit is the floor,
  not the ceiling.
