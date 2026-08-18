PLAN COMPLETE
Plan: .planning/phases/2/PLAN.md
Tasks: 5 of 5
| Task | Commit | Note |
|---|---|---|
| 1. Stop a wrapped-continuation line from out-declaring the milestone | 58c6a47 | Two whole-body scans + agreement-or-sentence-opening admission; 3 fixtures added, the four pinned ones byte-unchanged (diff is insertions only); WATCHED FAILING AT 2c88137 watched red (`v3.0.0` !== `v3.2.0`) |
| 2. Rewrite the DOC-02 pin's remedy to name the reader, not the file | 487e150 | Comment + failure message rewritten, D-03 cited; the deleted sentence survives nowhere in `cadence-core/` |
| 3. Bound tag discovery to the caller's own project root | caf3a23 | `readTags(dir, projectRoot)` + `--show-toplevel` containment on realpaths; both callers updated, umbrella + linked-worktree fixtures; WATCHED FAILING AT 487e150 watched red in both test files |
| 4. Exempt the sanctioned rolled-over phase from the drift signal | ca0f2ed | `rolledOver` over the rows `cmdAudit` already parsed, at-least-one-row guard; Deferred/Pending pair; WATCHED FAILING AT caf3a23 watched red |
| 5. State the rolled-over exemption where the audit's reader looks | 03895e6 | `version_drift` bullet now names three exits; `weight-budgets.json` re-pinned 12912 -> 13029 in the same commit (D-11); `self-verify` exits 0 |

Verification beyond the per-task fixtures: `npx tsc -p tsconfig.ci.json` exits 0 after every task (`detect-commands` reports `lint: null`, so no lint command exists to run); `node cadence-core/bin/self-verify.mjs` exits 0 with zero problems; a scratch tree (tagged umbrella repo `v9.9.0` containing a non-repository project whose `### Active` names `v9.9.0`) emits no `version_drift` on this tree and DID emit one when the same tree was audited by the seam at 2c88137; the same audit inside a linked worktree of a real tagged repo still emits one.

Deviations:
[deviation] the plan's `## Must be true when done` and AC7 assert `node --test cadence-core/bin/*.test.mjs` exits 0. It exits 1 at the branch tip 2c88137, BEFORE any change of mine: `milestone-prune.test.mjs:433` ("corpus: pruning this repository's own REQUIREMENTS.md needs no hand repair") asserts every moved `## Active` bullet is a WRAPPED bullet, and `.planning/REQUIREMENTS.md:31`'s PHS-01 bullet is one unwrapped line. Confirmed pre-existing by stashing the working tree and re-running. Neither file is in this plan's lease, so I proceeded and verified every task against its own test file plus the full suite showing exactly this one known-red test (2182 of 2183 passing at the last task).
[deviation] task 2's Verify asserts `grep -rn "Fix the section - declare the milestone" .` returns no lines; it returns exactly one - `.planning/phases/2/PLAN.md:143`, the Verify line itself quoting the pattern - and the full sentence also survives line-wrapped in `CONTEXT.md:74` and `PLAN.md:39,136` as quotations of what to delete. Both files are this plan's own record and outside its lease. The substantive criterion holds: `grep -rn "Fix the section" cadence-core/` returns nothing, so no live occurrence survives on a shipped surface.

Open items:
`.planning/REQUIREMENTS.md:31` - PHS-01's `## Active` bullet needs wrapping at the repo's prose width for the milestone-prune corpus test to hold; out of lease, so it belongs in the orchestrator's docs commit. Until then AC7's `node --test` half cannot pass on this repository.
Task 3 declined a distinguishable "the repository is not this project's" reason on `readTags`: D-08 and the task's Verify both want the permissive `[]`, so the three no-evidence answers stay collapsed; a consumer needing to tell them apart needs a different question, not a second failure mode here.
Task 1 declined making the sentence-opening discriminator configurable or exporting it: nothing in the plan sets a second policy, so the rule is inline in `activeVersion`'s two-scan admission.
`.planning/DOCS-CLAIMS.md` rows AUDIT-25 and AUDIT-39 cite `audit.md` lines 105-113; task 5 grew that bullet by two lines, so those citations now point two lines short. The PLAN's own Notes raise this as ledger drift for a human rather than a task, and the file is outside the lease.
