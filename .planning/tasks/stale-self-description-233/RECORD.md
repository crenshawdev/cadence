# Task: stale-self-description-233

## What shipped

- Issue #233's two stale self-description claims, each checked against the tree before the edit.
- DESIGN.md's 2026-07-10 routing decision illustrated runtime effort escalation with variant agent files named `planner-high`/`planner-low`. Neither is on disk and neither ever was: `cad-planner`'s ladder is high/xhigh/max over `cad-planner.md`, `cad-planner-xhigh.md` and `cad-planner-max.md`. The same sentence said "the ~4 heavy reasoners" where `RUNG_FILES` carries six roles. The decision text is left as written and the correction appended, because that block is a dated record rather than a description of the current tree.
- One detail in the issue itself did not hold and the fix is narrower than it asked for: it claims "there is no low rung for any role". `cad-plan-checker` has one (`lib/rung-agent.mjs:63`), and DESIGN's very next bullet already names it as "the one low-effort role". The correction says so rather than repeating the issue's wording.
- `self-verify.test.mjs`'s check-10 comment claimed skills, agents and templates carry no dispatch instructions of their own, and that `references/` was in scope only because no other check reached it. `self-verify.mjs` retracted that at `WORKFLOWS_DIR` / `REFERENCES_DIR`: the two directories are in scope for the same reason and by the same mechanism, a `relative(root, file)` compare with the separator appended. The comment now states that rule, and says a skill is out of scope because it is neither directory - a fact about the compare, not a claim about what a skill contains.
- Verified: self-verify --root . returns ok:true with problems:[], and the 163 tests in self-verify.test.mjs pass. risk-check over the range returned no matches and was not inconclusive.
- This is the first commit of the v3.6.1 cycle. It is not v3.6.1 scope (WHY-02, WHY-03, WHY-04) - it is a doc fix riding the integration branch.

## Commits

| Task | Commit | Description |
| --- | --- | --- |
| 1 | 7ed733782d3aac6b40d3eb3d7ed36257079412b6 | docs: DESIGN named two planner rung files that never existed |
| 1 | e70e098fe7606c690d717a4f4df3ffb14b37ba4a | docs: check 10's test carried a rationale the implementation retracted |

## Files

### Task 1: stale-self-description-233

- **Files:** DESIGN.md, cadence-core/bin/self-verify.test.mjs
