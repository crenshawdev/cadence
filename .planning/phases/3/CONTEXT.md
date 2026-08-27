# Phase 3: Stop the risk detector tripping on the review record - Context

Gathered: 2026-08-27
Feeds: /cad-plan 3

## Scope boundary

In: a git pathspec exclusion on the `git diff` `risk-check run` reads, covering
the four `.planning/phases/` artifacts that store verbatim reviewer text, so a
docs commit landing a finding that quotes `rm -rf` no longer re-trips the
destructive category on the gate that found it.
Out: any change to `lib/risk-diff.mjs`'s `scanDiff` face - no path or filename
exemption is added there (D-01). Out: widening the exclusion to all of
`.planning/`, which would stop flagging a destructive command written into a
PLAN.md Action, and that is the text an executor is handed to run. Out: changing
how adjudication records STORE reviewer text: the seam refuses a ruling whose
restatement differs from the returned text by one byte, so the verbatim
requirement is load-bearing and not negotiable here.
Deferred: None.
Plan shape: one plan

## Durable decisions

- D-01 (fix site): The exclusion is a git PATHSPEC at the call site
  (`cadence-core/bin/planning/risk-check.mjs:213`), never a path exemption
  inside `scanDiff`. That `git diff` already ends with `--`, so the pathspec
  slots in and `scanDiff` never receives the hunks - the criterion is met
  without touching the face. Rejected after real consideration: adding
  `ADJUDICATION-*.json` to a `scanDiff`-side exemption list beside the ones
  `scanDeclared` already carries. `lib/risk-diff.mjs` states three times, each
  with its own reasoning, that those exemptions are "SCOPED TO THIS FACE, and
  deliberately not to `scanDiff`", because that face reads a HUNK where a match
  is a line someone actually added, and its rule is "the fix is at the MENTION,
  never a path or filename exemption". Evidence:
  `cadence-core/bin/lib/risk-diff.mjs:424-433`, `:464-470`, `:500-505`;
  `cadence-core/bin/planning/risk-check.mjs:203-215`.
- D-02 (exclusion scope): All FOUR stored-reviewer-text artifacts under
  `.planning/phases/`, not `ADJUDICATION-*.json` alone as ROADMAP criterion 1
  names: `ADJUDICATION-*.json`, `REVIEW-*.md`, `FINDINGS.json` and
  `verifier-findings.json`. Each holds verbatim reviewer prose by design and
  trips for the identical reason, so excluding one leaves the same gate firing
  on the other three the next time a reviewer quotes a destructive command. This
  deliberately widens the roadmap's wording. Evidence: `.planning/phases/2/`
  holds all four today; `references/review-record.md` requires the stored
  restatement to match the reviewer's returned text byte for byte;
  `references/review-triggers.md` names `REVIEW-<trigger>-<discriminator>.md`
  as the advisory findings file.

## Decisions

- D-03 (detection unweakened): The exclusion is BY PATH, so every code path
  scans exactly as it does today - the change removes files from the diff, never
  signals from the table. This is what makes ROADMAP criterion 2 checkable: the
  same quoted command in a `.mjs` file must still trip the category, proved by a
  case that FAILS against the pre-fix tree rather than one that merely passes
  after it.
- D-04 (the excluded set is named once): The four pathspecs live in ONE named
  constant, not spelled at the call site, so the test asserts the same list the
  code uses. A second spelling is how the list and its test drift apart.

## Acceptance criteria

- [ ] AC1: `risk-check run` over a range whose only destructive text sits inside
      an excluded artifact answers `matches: []` for the destructive category,
      with `checked: true` and `empty: false` - a completed clear, not an
      unread range.
- [ ] AC2: the same destructive text in a `.mjs` file in the same range still
      trips the destructive category, proved by a test that FAILS against the
      pre-fix tree and passes after - the exclusion must not buy quiet by
      weakening detection.
- [ ] AC3: the four excluded paths are named in one place in the source, and a
      test asserts each of the four is excluded and that a fifth
      `.planning/phases/` file (a PLAN.md) is NOT.
- [ ] AC4: `risk-check run` over the fixed range `f70a0443..7a8a449a` reports no
      destructive match. The pair is FIXED rather than the roadmap's
      `f70a0443..HEAD`: HEAD has advanced through two cycles since that range
      was settled with an override, so the open-ended form now covers unrelated
      work and can trip on anything.
- [ ] AC5: `node cadence-core/bin/test.mjs` is green and
      `node cadence-core/bin/self-verify.mjs` reports `ok:true`.

## Flagged assumptions

- The four artifact names are the complete set of `.planning/` files holding
  verbatim reviewer text today. Likely; if wrong: a fifth artifact keeps
  tripping the gate and is added to the same named constant, which is a one-line
  change rather than a redesign.
- Adding the constant may move a hand-maintained census (the risk-diff or
  arg-contract counts) - unknown until the file is chosen. Likely; if wrong:
  nothing, the plan re-pins it as phase 2 did.
