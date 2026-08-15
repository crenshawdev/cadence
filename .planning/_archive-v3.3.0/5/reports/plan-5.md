PLAN COMPLETE
Plan: .planning/phases/5/PLAN-5.md
Tasks: 2 of 2
| Task | Commit | Note |
|---|---|---|
| 1 - Assert README's skill, role and rung-file counts against the tree | e4ba4cc | Both sides derived in-run: skills = `skills/*/SKILL.md` whose FRONTMATTER lacks `user-invocable: false` (27), rung files = `agents/*.md` (19), roles = those names with the rung suffix stripped and deduplicated (6), suffix vocabulary read off `route-table.json`'s `rung_order` rather than typed. Sentence matched by shape, not line. Reddened as predicted on a scratch README saying 26 skills: `README's count sentence disagrees with the tree - skills: README says 26, the tree has 27`; `git checkout -- README.md` restored green (14 pass, 0 fail). `LINEAGE.md` untouched, nothing added to `self-verify.mjs` (D-06). |
| 2 - Assert the `### Active` version declaration is the section's first version token | ba38c14 | Structural: `activeVersion()` imported from `lib/branch-decision.mjs` (unmodified, no fallback added) compared against the first version token anywhere in the `### Active` body, body bounded heading-to-next-level-1..3-heading exactly as `activeVersion`'s doc comment defines. No version literal in the test. Reddened as predicted with `git show 81bdb5d:.planning/PROJECT.md` in place: `activeVersion() reads v3.0.0 (line 145) as the milestone while the ### Active body's FIRST version token is v3.2.0 (line 108)`, plus what the disagreement costs `version_drift`; `git checkout -- .planning/PROJECT.md` restored green (15 pass, 0 fail). |
Deviations: none
Open items:
- The test spells the version-token grammar (`/v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/`) locally instead of importing it: `lib/branch-decision.mjs` exports neither `VERSION_RE` nor `DECLARED_VERSION_RE` and D-07 forbids modifying that file. If the seam's grammar ever widens (a build-metadata suffix, a four-part version), the test's loose scan will not follow it. Exporting `VERSION_RE` and importing it here is the fuller shape; it needs a task that may touch the seam.
- `assert.deepEqual(wrong, [])` in the count test collects all three disagreements and names each, rather than three separate asserts that would stop at the first - the Action asked for a message naming which of the three disagrees, and this names all of them.

Verification notes (not findings):
- `node cadence-core/bin/test.mjs prose` exits 0 at the final commit: 225 pass, 0 fail, no `budget-overrun` (AC7 for this plan's file; `cadence-core/bin/*.test.mjs` carries no `weight-budgets.json` entry, so no re-pin was due).
- `detect-commands --root /data/code/cadence` returns `lint: null`, so there is no lint command to run - reported once and skipped. `npx tsc -p tsconfig.ci.json` exits 0 (it excludes `*.test.mjs`, so it covers the tree these tests read rather than the tests).
- The plan's flagged coupling resolves: `.planning/PROJECT.md` is tracked, `.github/workflows/test.yml` uses a plain `actions/checkout@v4` and runs `node cadence-core/bin/test.mjs prose` from the repo root, and the test resolves the repo root from `import.meta.url` rather than cwd. No fixture weakening was needed.
