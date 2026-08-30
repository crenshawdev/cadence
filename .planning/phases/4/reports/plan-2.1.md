PLAN CHECKPOINT: structural
Plan: .planning/phases/4/PLAN-2.md
Tasks: 4 of 4
| Task | Commit | Note |
|---|---|---|
| 1 - `decideGateHalt` takes a decided list, and gains the fifth state | f03d1340 | Severity filter deleted, not replaced: `grep -n "'blocker'\|'high'" lib/close-decision.mjs` returns nothing and the module still imports nothing. `unruled` is its own arm (order: `unreadable`, `unruled`, halting list) halting under `auto_close` with a reason naming `unruled-review` and the review files; `overridden` rides every arm including `proceed` without moving `action`. The `only medium/low -> proceed` arm was rewritten, not deleted - it now proves a non-empty list halts whatever it holds, including a member carrying no severity. `UNREADABLE` list and its two generated arms untouched (the one diff hit is my new arm looping over the list to prove neither name leaks into the other's reason). close-decision.test.mjs 34/34, tsc 0, lint null (`detect-commands` finds no lint command). |
| 2 - The seam classifies from record entries | 4f12dc5e | `readFindings` returns `unruled` off the same stdin object (absent or wrong-typed reads as `[]`); `gate` runs `unfixedFromEntries` over what was piped and hands `halting` in as the halting list with `haltingSurvivors` on `overridden`. Four names, decision order, empty-stdin rule and bare-array form untouched. Eleven existing gate payloads rewritten to entries carrying `"ruling":"survived"`; no severity fallback added for a ruling-less member. Three new arms: the fix_commit pair flipping halt to proceed, refuted/downgraded stopping no close at `blocker`, and `unruled` read through the seam with a payload carrying ONLY `unruled` still landing on `not-a-findings-payload`. land-cleanup.test.mjs 33/33, self-verify.test.mjs 177/177, tsc 0. |
| 3 - Reproduce the v3.7.7 close as a fixture | fafda199 | Both artifacts inlined verbatim from `220f99d3` (19-line REVIEW, 65-line round-2 record with no round-1 sibling), parsed back with `JSON.parse`. Four arms: (a) the real entries proceed, with the `high` at `adjudication-record.mjs:460` asserted to be a `survived` `high` naming `3341ffb0`; (b) the same array minus exactly that one key halts on that entry alone, the one-key difference asserted key-by-key rather than assumed; (c) the review's own findings plus `unruled` halt as `unruled-review`, and the plan's accepted residue (raw findings naming nothing -> proceed) is pinned in the same arm; (d) the same high with `overridden: true` proceeds named on `overridden`, and one carrying both markers appears nowhere and does not halt. Falsified: reverting the seam to pass raw findings reddens exactly those four (30/37). land-cleanup.test.mjs 37/37, tsc 0. |
| 4 - State the gate's input in the contract comment | 0c27c2b6 | The gate paragraph now names `ADJUDICATION-risk_surface*.json`, every round, `.planning/phases/*/` plus `.planning/risk-carry/<N>/` via `planning.mjs risk-carry`, the `unruled` / `unruled-review` fifth state, `overridden` not moving `action`, and stdin-only with `--dir` config-only. `grep -n REVIEW-risk_surface` returns one line - the `unruled` sentence - and no union-of-findings instruction. Four-name paragraph kept as it stands; the file's opening summary re-worded from "blocking" to "genuinely-unfixed" for the same reason. `self-verify.mjs` `ok:true`, `problems: []`; tsc 0. |

CHECKPOINT: structural
Current task: 4 - State the gate's input in the contract comment (all four committed)
Need: authorization to make a one-line fixture edit in
`cadence-core/bin/config-seams.test.mjs`, which no plan in this phase declares.

Task 4's `Verify:` and CONTEXT AC7 both require `node cadence-core/bin/test.mjs`
green. It is not, and one of the ten failures is mine:

  cadence-core/bin/config-seams.test.mjs:544
    const BLOCKER = JSON.stringify({ findings: [{ severity: 'blocker' }] });
  fails at :579 with `'proceed' !== 'halt'`

That constant is a RAW review finding with no `ruling`, which is exactly the
input LND-02 stops treating as a live blocker. The arm itself is still valid and
still worth keeping - it pins the git-publish/land-cleanup `auto_close` layer
divergence, not the payload shape - so the whole fix is adding
`"ruling":"survived"` to that one fixture, the same mechanical update applied to
eleven payloads inside my own lease. Impact if left: `/cad-audit` and any
pre-ship gate reading a green suite stay red on a defect that is one line, and
the arm no longer proves the layer property it exists for.

Why it is a checkpoint rather than a fix: `config-seams.test.mjs` is declared by
NO plan in phase 4 (checked all four frontmatters), so `lease-check --phase 4
--plan 2` refuses it and no downstream plan picks it up either. Alternatives:
(a) grant it to this plan and re-dispatch me for the one line; (b) grant it to
Plan 4, whose prose sweep is the natural neighbour; (c) a `/cad-task` for it.

Deviations: none
Open items: the other 9 failures under `test.mjs` are the `renumber remove` /
`PHS-01` cluster and are pre-existing and unrelated - proved by running
`planning.test.mjs` in a detached worktree at `3d8bae48` (the pre-plan commit)
and in the current tree: both are 27/28 failing on the same single arm,
`renumber: a decimal cursor is warned about, never shifted (#37)`. Nothing in
this plan is reachable from `planning.mjs`. Process note: I spent TWO full-suite
runs rather than the allowed one - the first `tail` did not include the summary
line and I re-ran to read it; the second should have been a `grep` over saved
output.
