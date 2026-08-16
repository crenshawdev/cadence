PLAN COMPLETE
Plan: .planning/phases/1/PLAN-2.md
Tasks: 7 of 7
| Task | Commit | Note |
|---|---|---|
| 1. The register and the check that reads it, watched failing on the real tree | ca55f45 | `lib/text-transport.mjs`: 36 rows (20 caller-derived, 16 out of scope with a reason each), three codes, wired as self-verify check 19 over the same `mdFiles` walk. `text-transport.test.mjs` (17 tests) + 3 CLI-wiring tests in `self-verify.test.mjs`. Watched FAIL recorded below. |
| 2. State the transport rule once, in `conventions.md` | 7c8ec1d | New `## Caller-derived text` section: the derivation test, the path transport, the inline arm, and the register as the site list. Cited by path, `@`-included nowhere. `conventions.md` re-pinned 7510 -> 8363 B. |
| 3. Move the review and planning dispatch sites onto the file transport | b912d06 | Six surfaces converted (`plan.md` x2, `plan-revision.md` x2, `decision-review.md` --detail + --read, `minimalism-review.md` --detail + --read, `review-triggers.md` --detail + adjudication detail); `triage-gate.md` untouched, as its row classifies it. `trace.test.mjs` census parser reads `--read-file` as the same read-set (checkpoint fix, approved alternative (a)). Five surfaces re-pinned. self-verify: 11 problems left, none naming any of the six. |
| 4. Move the execute, context and verify-deep dispatch sites | f5d8195 | `execute.md`, `context.md`, `verify-deep.md` closes on `--detail-file <path>`; `seams.md`'s ONE statement of the arm rule now names both flags, so the OMIT/carry sentences are true of either transport. Four surfaces re-pinned. self-verify: 8 problems left, none naming the four. |
| 5. Move `verify.md`'s failing-item records onto `--fields-file` | 01a6a9a | Three sites (pass-1 evidence, pass-2 reported+reason, the diagnosis cause) pass one JSON scratch file; `--phase/--item/--result/--severity/--source` stay inline. `--fix "{hash}, retest"` and `--fix "routed to /cad-plan"` left inline as the register classifies them. Still one `uat record` per item. self-verify: 4 problems left, none naming `verify.md`. |
| 6. The milestone label - `--label-file` at the prune, `-F` at the tag | 5a33ea8, 76cae93 | `milestone-prune --label-file <path>` in `milestone.md`; `git tag -a <version> -F <path>` in `cad-land`, with the `git.create_tag` condition, the tag-membership test, the separate push ask and the never-auto-push rail untouched. A tree-wide grep finds no surviving `git tag ... -m "<...>"`. 76cae93 trims a restated-reasoning clause the tag site had kept, for AC1. |
| 7. The two composed cursor pointers, and the live tree held clean | 7d95784 | `cad-pause` and `progress.md` reconcile take `--next-file <path>`; the seven literal `--next "/cad-<command> N"` sites are unchanged, and so are `undo.md:49` and `verify.md`'s two-line pointer, both out of scope with a reason. New live-tree test in `self-verify.test.mjs` asserts an empty list for each of the three transport codes against `--root REPO`. |

## AC3 watched-FAIL run record

SHA `ca55f45`. `node cadence-core/bin/self-verify.mjs` exits 1 with 21
`text-transport-inline` problems across 13 REAL tree surfaces (no fixtures):

- cadence-core/workflows/context.md `--detail "<what failed>"`
- cadence-core/workflows/decision-review.md `--read "<the decision doc path>"`
- cadence-core/workflows/decision-review.md `--detail "<what failed>"`
- cadence-core/workflows/execute.md `--detail "<one line>"`
- cadence-core/workflows/milestone.md `--label <label>`
- cadence-core/workflows/minimalism-review.md `--read "<the resolved target reference>"`
- cadence-core/workflows/minimalism-review.md `--detail "<what failed>"`
- cadence-core/workflows/plan.md `--detail "<empty or unmarked return>"` (x2, one row)
- cadence-core/workflows/progress.md `--next "<routed action from below>"`
- cadence-core/workflows/verify-deep.md `--detail "<what failed>"`
- cadence-core/workflows/verify.md `--evidence "<the command and the output that settles it>"`
- cadence-core/workflows/verify.md `--reported "<verbatim reply>"`
- cadence-core/workflows/verify.md `--reason "<why>"`
- cadence-core/workflows/verify.md `--cause "<root cause>"`
- cadence-core/references/plan-revision.md `--detail "<empty or unmarked revision return>"`
- cadence-core/references/plan-revision.md `--detail "<empty or unmarked narrowed return>"`
- cadence-core/references/review-triggers.md `--detail "<what failed>"`
- cadence-core/references/review-triggers.md `--detail "<trigger>: <n> survivors; voices <the reviewers that actually ran>"`
- skills/cad-land/SKILL.md `-m "<milestone label>"`
- skills/cad-pause/SKILL.md `--next "<resume pointer>"`

No problem names a `--next` site in `adopt.md`, `new-project.md`, `plan.md`,
`context.md` or `progress.md`'s `/cad-phase add` line, and none names `--phase`,
`--status`, `--result`, `--severity` or `--origin`.

## Closing state

At `76cae93`: `node cadence-core/bin/self-verify.mjs` exits 0 with
`problems: []`, and `node --test cadence-core/bin/*.test.mjs` reports 1997
tests, 1996 pass, 0 fail, 1 skipped (the corpus prune arm skipped between
milestones). `npx tsc -p tsconfig.ci.json` exits 0 at every task commit.
The count of self-verify problems fell 21 (ca55f45) -> 11 -> 8 -> 4 -> 2 -> 0
across tasks 3, 4, 5, 6 and 7, each drop naming exactly that task's surfaces.

Deviations:
- [deviation] Task 1's `Verify:` asserts `node --test 'cadence-core/bin/*.test.mjs'`
  still exits 0 at that commit. It cannot: `self-verify.test.mjs:210` ("the repo
  itself passes self-verification") asserts `problems: []` on the live tree, and
  AC3 requires self-verify to exit 1 at exactly that commit. Exactly ONE test
  failed there (146 of 147 pass in that file) and it was that assertion, failing
  on precisely the 21 watched sites - so the red suite IS the watched FAIL, not a
  second defect. The plan's own `## Notes` concede the outcome ("CI will be red
  at that one SHA by design; the branch tip is green"), so the criterion was
  carried out the way the plan resolves it rather than redefined. It clears at
  task 7.
- [deviation] Task 3's `Verify:` ("`node --test 'cadence-core/bin/*.test.mjs'`
  exits 0") could not be met from inside the plan's original lease: the trace
  census parser (`trace.test.mjs:1281-1288`) read `--read` in the inline
  spelling only, so the two converted `--read` sites parsed as `null` and the
  "every dispatch names what it caused" assertion failed. Checkpointed;
  APPROVED, alternative (a) - `cadence-core/bin/trace.test.mjs` was added to
  this plan's `files:` lease and the one-line fallback
  (`flag(line, 'read', true) ?? flag(line, 'read-file', false)`) landed in task
  3's commit with the reason as a comment. The suite is now 1994/1996 with one
  failure, the same by-design repo-clean assertion above.

Open items:
- Declined a `transport: 'inline'|'file'` field on the register rows. The plan
  asks each conversion task to "update the register rows so the register still
  describes the tree"; under the `{surface, flag, value}` key a converted row
  stays literally true (the site still passes that value, now as a path), and
  the invariant this plan establishes - `derived: true` means the site
  prescribes the file transport - is PROVED by check 19 passing on the live
  tree at task 7 rather than restated in a field nothing reads. Add the field if
  a task ever needs to distinguish the two from the register alone.
- Declined an env-var override for the register (the `CADENCE_DEFERRED_READS`
  shape `self-verify.mjs` uses for check 13). The CLI-wiring tests reach the
  `inline` kind by writing synthetic prose at a REGISTERED path instead, which
  proves the CLI reads the SHIPPED register rather than a fixture's copy of it.
- `cadence-core/workflows/execute.md:408-409` and `skills/cad-capture/SKILL.md:43-45`
  restate the transport reasoning at the site (both were converted before this
  phase). Neither is a site this plan converts and task 4 says to leave the
  first untouched, so AC1's "no converted site restates the reasoning" is read
  as covering this phase's conversions; folding those two onto the
  `references/conventions.md` citation would make the tree uniform.
- The NUL-byte check (15) caught two literal U+0000 bytes that a file write put
  into `cadence-core/bin/text-transport.test.mjs:70`, inside a template
  literal where spaces were intended. Fixed before task 1's commit (amended);
  worth knowing that check 15 is load-bearing against tooling, not only against
  authors.
- No lint command exists for this project: `planning.mjs detect-commands`
  returns `lint: null`, `typecheck: "npx tsc -p tsconfig.ci.json"`. The
  typecheck is run before each commit and is clean.
