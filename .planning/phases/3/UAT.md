---
status: testing
phase: 3
fields_version: 1
started: 2026-08-18
updated: 2026-08-18
---

## Items

### 1. Stakes level moves both panel halves
expected: For the same trigger, route.mjs resolve returns a different cross-model tier AND a different effort at solo vs shipped vs critical, both riding the returned envelope beside reviewers - checked on at least the plan and risk_surface triggers.
criterion: AC1
status: pass
first_pass: pass
source: verifier
evidence: route.mjs resolve --role cad-reviewer at solo/shipped/critical: reviewer_tiers.plan cheap/balanced/flagship, reviewer_efforts.plan low/medium/high, same ladder for risk_surface, both maps keyed like `reviewers`; route-table.json:59-75, route.mjs:724, consumed at review-triggers.md:233-241.

### 2. Unset tier reports the resolved value; grids have no missing cells
expected: On a repo where no layer sets it, config.mjs get review.triggers.plan.tier reports the value the resolver actually uses at the effective stakes level rather than a fixed flagship, and self-verify reports no missing-cell for either the tiers or the efforts grid, walked in both directions.
criterion: AC2
status: skipped
first_pass: fail
source: verifier
evidence: `node cadence-core/bin/config.mjs get review.triggers.plan.tier` -> {"values":{"review.triggers.plan.tier":null},"warnings":["review.triggers.plan.tier is unset: no config layer pins this model tier, so the stakes level decides it - `route.mjs resolve` answers it for a level"]} (same shape for `.effort` and, unchanged, `.gate`). cadence-core/bin/config.mjs:236-296 implements it and :288-291 states the refusal outright: "It never states what the level fires and never reads route-table.json (D-07): this seam does not know the stakes level, and answering as if it did is the same defect pointed the other way." CONTEXT.md D-04 licenses the null sentinel; AC2's wording and D-04/D-07 are in tension and SUMMARY.md records no deviation for it.
reported: behavior wrong (half the item): the grids half holds - self-verify walks both `tiers` and `efforts` in both directions per level and reports no `missing-cell`. The read half does not: with no layer setting it, `config.mjs get review.triggers.plan.tier` answers `null` plus a warning pointing at `route.mjs resolve`, not the value the resolver uses at the effective stakes level. It no longer answers a fixed `flagship`, so the lie is gone, but the item as written asks for the resolved value and that value is unobtainable from this seam by design.
severity: minor
cause: AC2's read half contradicts a decision recorded in the same CONTEXT. D-04 deliberately moved review.triggers.<t>.tier/.effort onto the null unset sentinel, mirroring what GAT-02 did for .gate, and cadence-core/bin/config.mjs:288-291 states the matching refusal outright - the config seam does not know the stakes level and never reads route-table.json, so answering as if it did is the same defect pointed the other way. The fixed 'flagship' the criterion was written against is gone (config.mjs now answers null plus a warning naming route.mjs resolve as the answering seam), but 'reports the value the resolver actually uses' asks this seam for a value it is designed not to hold. Not a code defect: the criterion outran the design it was written for, and SUMMARY.md records no deviation for the divergence.
fix: 8aec00c, criterion reworded; retested as item 8
reason: Criterion superseded. AC2's read half was reworded at 8aec00c to the behaviour D-04 deliberately built, and SUMMARY.md records the deviation; item 8 carries the criterion as it now stands and was retested from scratch. This item is kept, not rewritten, so the original wording and its failure stay legible.

### 3. create_tag governs only the land-time tag cut
expected: With git.create_tag: false the milestone close still bumps the plugin manifest version; grep -rn create_tag over cadence-core/ and skills/ shows the key read at exactly one site (the land-time tag cut); and the schema purpose no longer says the tag happens at milestone close.
criterion: AC3
status: pass
first_pass: pass
source: verifier
evidence: grep -rn create_tag over cadence-core/ and skills/ finds one prose reader (skills/cad-land/SKILL.md:26,183,193); milestone.md has no occurrence and step 2 decides from `git-branch.mjs tags` + a confirmed version; config.schema.json:51 purpose names the land-time cut; with `.planning/config.json` git.create_tag:false, release-bump.mjs bumped the plugin manifest 1.0.0 -> 1.1.0.

### 4. Bounded tags read does not escape the project root
expected: The bounded tags read returns no tags for sub/.planning where sub/ is a non-repository project inside a repository tagged v9.9.0, and still returns that repository's tags when run inside a real tagged repository.
criterion: AC4
status: pass
first_pass: pass
source: verifier
evidence: outer repo tagged v9.9.0 -> ["v9.9.0"]; outer/sub and outer/sub/.planning (non-repo) -> []; /code/cadence -> its real tag list. git-branch.mjs:94-95.

### 5. Resolve loop is bounded by one wall-clock budget
expected: With a PATH-stubbed tea that sleeps and exits non-zero, issue-check.mjs check over five or more referenced numbers completes inside one stated wall-clock budget rather than five call timeouts, exits 0 with ok:true and action:report, and reports the unreached numbers unresolved.
criterion: AC5
status: pass
first_pass: pass
source: verifier
evidence: PATH-stubbed tea (1s sleep, exit 1), 8 referenced numbers, --timeout-ms 2000: 2062ms, <=2 resolves, status 0, ok:true, action:report; the mid-loop case reports unreached numbers `unresolved`; the D-11 fast-non-zero case still resolves the numbers behind it.

### 6. Each requirement carries a watched-failing falsifier
expected: RVW-03, REL-01 and ISS-01 each carry a check with a WATCHED FAILING AT <sha> header whose sha resolves to a real commit preceding the fix, and that check fails when re-run against that commit's tree.
criterion: AC6
status: pass
first_pass: pass
source: verifier
evidence: 478b1ff / c78cbdb / 1ca00f7 all resolve to real commits preceding their fixes (ancestry checked); each check re-run against that commit's exported tree failed with the message its header documents.

### 7. Full test suite and self-verify are green
expected: node --test cadence-core/bin/*.test.mjs and node cadence-core/bin/self-verify.mjs both exit 0.
criterion: AC7
status: pass
first_pass: pass
source: verifier
evidence: node --test cadence-core/bin/*.test.mjs exit 0, 2218/2218 pass; node cadence-core/bin/self-verify.mjs exit 0, problems [].

### 8. Unset tier answers the null sentinel and names the resolving seam; grids have no missing cells
expected: On a repo where no layer sets it, config.mjs get review.triggers.plan.tier no longer answers a fixed flagship: it answers the null unset sentinel plus a warning naming route.mjs resolve as the seam that answers it for a stakes level (the shape .gate already carries), and self-verify reports no missing-cell for either the tiers or the efforts grid, walked in both directions.
criterion: AC2
status: pass
first_pass: pass
source: model
evidence: `node cadence-core/bin/config.mjs get review.triggers.plan.tier` -> {"ok":true,"values":{"review.triggers.plan.tier":null},"source":"global+repo","warnings":["review.triggers.plan.tier is unset: no config layer pins this model tier, so the stakes level decides it - `route.mjs resolve` answers it for a level"]} - no layer sets it here, the fixed `flagship` is gone, and the warning names the resolving seam, which is the `.gate` shape. `node cadence-core/bin/self-verify.mjs` -> exit 0, {"ok":true,"problems":[]} across 24 checks including routing-cells; grep over its output finds zero `missing-cell` for either grid.

## Summary

total: 8
passed: 7
failed: 0
pending: 0
skipped: 1
blocked: 0
reworked: 1
