# Phase 2: One reader for the lease grammar - Context

Gathered: 2026-08-16
Feeds: /cad-plan 2

## Scope boundary

In: one lease-resolution module under `cadence-core/bin/lib/` that both
`plan-overlap` and `lease-check` call; the trailing-slash directory-prefix form
documented in `cadence-core/references/plan-frontmatter.md` with its
`weight-budgets.json` bump in the same lease; a named refusal for `./` and
redundant separators on BOTH declared-files arms; both spellings reported in
`overlaps[].files`; two failing-capable tests watched to FAIL at an intermediate
SHA; a census test that reddens on a pasted-back containment idiom.

Out: symlink resolution - it needs filesystem access at gate time, and
`plan-overlap` runs against declarations that may name files not yet created.
Case folding - the answer depends on the filesystem, so identical declarations
would resolve differently on two machines. `..` traversal - a declaration
escaping the repo root is an out-of-repo-lease defect, not a spelling
disagreement between two readers. Also out: widening what a plan may lease;
changing `lease-check`'s verdict for declarations that were already
unambiguous; normalizing the staged side; rewriting the list `parsePlanFiles`
returns; a new `self-verify.mjs` check; the `plans[].files` and `declared`
count semantics; phase 1's transport surfaces.

Deferred: None.

Plan shape: one plan - the whole surface is `planning.mjs`, one new
`lib/` module, `planning.test.mjs`, `plan-frontmatter.md`, `weight-budgets.json`
and `helper-census.test.mjs`, and AC6's watched-FAIL orders two commits inside
that one plan rather than splitting it.

## Durable decisions

- D-01 (Grammar): The trailing-slash directory-prefix form IS the lease
  grammar. It is documented in `cadence-core/references/plan-frontmatter.md`
  and honoured by both readers, including its deliberate non-substring arm
  (`src/auth` does not license `src/authority.js`). The refuse arm was
  rejected: it deletes a shipped test, removes directory leases outright, and
  changes the enforcement contract that criterion 6 holds fixed. Evidence:
  `cadence-core/bin/planning.test.mjs:4833`;
  `cadence-core/bin/planning.mjs:2296-2302`;
  `.planning/_archive-v2.6.0/5/PLAN.md` (the one live use, 1 of 613 declared
  entries across 47 plan files, measured 2026-08-16).
- D-02 (Grammar): `./` prefixes and redundant separators are REFUSED at
  declaration time with a named diagnostic, on BOTH arms of the declared-files
  union - the frontmatter `files:` list and the `- **Files:**` task line - so
  neither reader ever sees the spelling. A refusal on the frontmatter arm alone
  leaves the spelling reaching `lease-check` through the second door with no
  diagnostic. Refusal beats normalizing because it cannot widen a lease, which
  criterion 6 forbids, and nothing shipped exercises the form. Evidence:
  `cadence-core/bin/lib/planning-files.mjs:1948-1953`; 0 of 613 declared
  entries use `./` or `//` (measured 2026-08-16).
- D-03 (Module): The module answers TWO questions over one grammar -
  `covers(declaration, path)` for `lease-check`, and a derived
  `intersects(a, b) = covers(a, b) || covers(b, a)` for `plan-overlap` - rather
  than exposing a single normalize-then-compare-strings helper. A string helper
  leaves containment written twice, as `.includes()` and as `.startsWith()`,
  which is the defect criterion 1 names. Evidence:
  `cadence-core/bin/planning.mjs:1870` (declaration-to-declaration),
  `:2299-2302` (declaration-to-staged-path), `:2126` (`repoRel`). The roadmap's
  citations are stale: `:1788` is now `:1870`, `:2217-2218` is now `:2299-2300`.
- D-04 (Module): The resolver is a NEW module under `cadence-core/bin/lib/`,
  imported by `planning.mjs`, not an addition to `lib/planning-files.mjs`. That
  file is 105,266 B and `plan-frontmatter.md` names it "the single
  implementation" of the frontmatter grammar, so folding lease meaning in forces
  a prose edit into a file at 0 B headroom. `self-verify.mjs` check 14 is
  top-level-only and non-recursive, so a `lib/` module needs no `CONTRACTS` row
  (phase 1 D-12 does not fire). Evidence:
  `cadence-core/references/plan-frontmatter.md`;
  `cadence-core/bin/self-verify.mjs` check 14; `lib/frontmatter.mjs` and
  `lib/seam-io.mjs` ship with no sibling test file.
- D-05 (Module): Resolution happens at the lease layer and NEVER by rewriting
  the list `parsePlanFiles` returns. D-19 in that file already closed
  "re-processing grammar-resolved frontmatter items is a second, silent route to
  a wrong `overlaps`", and the same list feeds two reported counts. Evidence:
  `cadence-core/bin/lib/planning-files.mjs:1913-1938`, `:1947`;
  `cadence-core/bin/planning.test.mjs:4002`, `:4020`, `:4036`.
- D-06 (Output): A prefix/exact collision puts BOTH spellings into
  `overlaps[].files` as separate strings. The flat string-list shape survives,
  so roughly ten deepEqual assertions - several belonging to earlier phases'
  acceptance criteria - stay untouched, and `DOCS-CLAIMS.md` EXECUTE-13 needs no
  edit. Evidence: `cadence-core/bin/planning.test.mjs:2207`, `:3374`, `:3970`,
  `:4002`, `:5116`; `.planning/DOCS-CLAIMS.md:725`;
  `cadence-core/workflows/execute.md:116`.
- D-07 (Check): Criterion 1's "neither consumer re-implements containment" is
  enforced by a census test in the `helper-census.test.mjs` shape - a tree-wide
  body-idiom match over every `.mjs` under `cadence-core/bin/` including `lib/`
  and test files - not by a new `self-verify.mjs` check. A paste-back under a
  new name still reddens, and test-file re-implementations of a seam's grammar
  are the recorded live failure mode in this tree. A self-verify check would
  cost a `checked:` entry and a pin, and would not see test files. Evidence:
  `cadence-core/bin/helper-census.test.mjs`;
  `cadence-core/bin/self-verify.mjs:1409`; phase 1 SUMMARY deviation
  (`trace.test.mjs` census parser); `.planning/CAPTURE.md` phase 5.

## Decisions

- D-08 (Normalization): Only the DECLARED side is resolved. The staged side
  already arrives canonical through `repoRel` (repo-relative, forward-slash, no
  `./`, no `//`), and a second transform over paths that round-tripped through
  the byte-level guard risks the non-ASCII arm. Evidence:
  `cadence-core/bin/planning.mjs:2126`, `:2294`;
  `cadence-core/bin/planning.test.mjs:4988`, `:5038`; `.planning/CAPTURE.md`
  phase 1 (`unrepresentable-paths`, closed by `1d24d9a`).
- D-09 (Normalization): The resolver accepts non-path strings without throwing
  and without classifying them as directory leases. The task-line arm
  deliberately unions raw annotated forms such as `src/a.rs (edit)` into the
  same set as the cross-arm bridge. Evidence:
  `cadence-core/bin/lib/planning-files.mjs:1948-1953`;
  `cadence-core/bin/planning.test.mjs:3973-3989`.
- D-10 (Output): `plans[].files` and `lease-check`'s `declared` keep counting
  declarations as PARSED, not as resolved or deduped. Moving either number
  reddens tests that are about parsing and enforcement rather than about this
  phase's grammar question. Evidence:
  `cadence-core/bin/planning.test.mjs:3962`, `:4803-4805`.
- D-11 (Evidence): Criterion 4's watched-FAIL is a RUN RECORD at an
  intermediate SHA - the two failing-capable tests land in one commit, the fix
  in the next - and the tests are ordinary `node --test` cases in
  `planning.test.mjs`, not a permanent assertion that the tree is broken. The
  fixture helpers for both shapes already exist. Evidence: phase 1 D-14
  (`.planning/phases/1/CONTEXT.md:133-136`);
  `cadence-core/bin/planning.test.mjs:3942` (`overlapTree`), `:4766`
  (`leaseRepo`).
- D-12 (Blast radius): `cadence-core/references/plan-frontmatter.md` is
  13,954 B against a 13,954 B budget, so the `weight-budgets.json` bump rides
  the same lease as the prose or self-verify lands red in the same commit.
  Evidence: `cadence-core/bin/weight-budgets.json` (measured 2026-08-16); phase
  1 D-13.

## Acceptance criteria

- [ ] AC1: On a two-plan fixture where plan 1 declares `files: [src/]` and
      plan 2 declares `files: [src/auth.js]`,
      `node cadence-core/bin/planning.mjs plan-overlap --phase <N>` returns a
      non-empty `overlaps`, and that entry's `files` contains `src/` and
      `src/auth.js` as two separate strings. The same holds for `src/` against
      `src/auth/`.
- [ ] AC2: `plan-overlap` and `lease-check` each reach containment through the
      shared `cadence-core/bin/lib/` module's exported predicate, and neither
      function body contains a local `.includes(`- or `.startsWith(`-based
      comparison over declared paths. A census test in the
      `helper-census.test.mjs` shape goes red when that idiom is pasted anywhere
      under `cadence-core/bin/`, test files included.
- [ ] AC3: `cadence-core/references/plan-frontmatter.md` documents the
      trailing-slash directory-prefix form and states that `src/auth` does not
      license `src/authority.js`; `cadence-core/bin/weight-budgets.json` carries
      the raised budget for that file in the same commit, and
      `node cadence-core/bin/self-verify.mjs` reports no budget problem.
- [ ] AC4: A plan declaring `./a.txt` or `src//a.txt` is refused with a named
      diagnostic through BOTH doors - the frontmatter `files:` list and a
      `- **Files:**` task line. The diagnostic appears in `plan-overlap`'s
      `frontmatter_issues` and the path reaches neither reader.
- [ ] AC5: For declarations that were already unambiguous, `lease-check`
      returns the same verdict and the same `staged` and `declared` counts as
      before the phase, and a plan declaring no files is still refused.
- [ ] AC6: Run at the commit where the two failing-capable tests land but the
      fix does not, `node --test cadence-core/bin/planning.test.mjs` fails on
      exactly those two cases and no others. The phase SUMMARY records that SHA
      and the two case names.
- [ ] AC7: `node --test 'cadence-core/bin/*.test.mjs'` and
      `node cadence-core/bin/self-verify.mjs` both exit 0.

## Flagged assumptions

- D-03's two-predicate shape is Likely: the alternative is one exported
  `covers()` with `plan-overlap` calling only the derived `intersects()`, which
  is the same module with a narrower export surface. If wrong: a needless
  export, or a consumer reaching past the predicate it should use.
- D-04's module placement is Likely: the alternative is adding it beside
  `parsePlanFiles` in `planning-files.mjs` and widening
  `plan-frontmatter.md`'s scope statement to cover lease meaning as well as
  parsing. If wrong: a prose edit lands in a file at 0 B headroom that D-12 did
  not budget for.
- D-06's output shape is Likely: the alternative is a sibling
  `containments: [{covering, covered}]` field, which is more legible and equally
  additive but costs a `DOCS-CLAIMS.md` EXECUTE-13 update. If wrong: a user
  reading `overlaps[].files` sees two strings without learning which lease
  covered which file.
- D-07's census-test choice is Likely: the alternative is a `self-verify.mjs`
  check reading the two consumers for a forbidden idiom. If wrong: the phase
  corrects the divergence without preventing its return in test files, in a
  milestone whose theme is that each phase ships a check rather than only a
  correction.
- D-08 and D-10 are Likely and both rest on not disturbing counts and fixtures
  that earlier phases pinned. If wrong: the planner discovers mid-task that a
  count moved and a fixture unrelated to this phase's subject went red.
- D-02's refusal is a NEW diagnostic on a shape no shipped plan uses, so it
  has no watched-FAIL of its own and AC4 is its only evidence. If wrong in the
  strict direction, a future plan author hits a refusal for a spelling that
  names a real file.
