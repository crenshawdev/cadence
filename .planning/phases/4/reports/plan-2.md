PLAN COMPLETE
Plan: .planning/phases/4/PLAN-2.md
Tasks: 4 of 4
| Task | Commit | Note |
|---|---|---|
| 1 - `decideGateHalt` takes a decided list, and gains the fifth state | f03d1340 | Severity filter deleted, not replaced: `grep -n "'blocker'\|'high'" lib/close-decision.mjs` returns nothing and the module still imports nothing. `unruled` is its own arm (order: `unreadable`, `unruled`, halting list) halting under `auto_close` with a reason naming `unruled-review` and the review files; `overridden` rides every arm including `proceed` without moving `action`. The `only medium/low -> proceed` arm was rewritten, not deleted - it now proves a non-empty list halts whatever it holds, including a member carrying no severity. `UNREADABLE` list and its two generated arms untouched (the one diff hit is the new arm looping over the list to prove neither name leaks into the other's reason). close-decision.test.mjs 34/34, tsc 0, lint null (`detect-commands` finds no lint command). |
| 2 - The seam classifies from record entries | 4f12dc5e | `readFindings` returns `unruled` off the same stdin object (absent or wrong-typed reads as `[]`); `gate` runs `unfixedFromEntries` over what was piped and hands `halting` in as the halting list with `haltingSurvivors` on `overridden`. Four names, decision order, empty-stdin rule and bare-array form untouched. Eleven existing gate payloads rewritten to entries carrying `"ruling":"survived"`; no severity fallback added for a ruling-less member. Three new arms: the fix_commit pair flipping halt to proceed, refuted/downgraded stopping no close at `blocker`, and `unruled` read through the seam with a payload carrying ONLY `unruled` still landing on `not-a-findings-payload`. land-cleanup.test.mjs 33/33, self-verify.test.mjs 177/177, tsc 0. |
| 3 - Reproduce the v3.7.7 close as a fixture | fafda199 | Both artifacts inlined verbatim from `220f99d3` (19-line REVIEW, 65-line round-2 record with no round-1 sibling), parsed back with `JSON.parse`. Four arms: (a) the real entries proceed, with the `high` at `adjudication-record.mjs:460` asserted to be a `survived` `high` naming `3341ffb0`; (b) the same array minus exactly that one key halts on that entry alone, the one-key difference asserted key-by-key rather than assumed; (c) the review's own findings plus `unruled` halt as `unruled-review`, and the plan's accepted residue (raw findings naming nothing -> proceed) is pinned in the same arm; (d) the same high with `overridden: true` proceeds named on `overridden`, and one carrying both markers appears nowhere and does not halt. Falsified: reverting the seam to pass raw findings reddens exactly those four (30/37). land-cleanup.test.mjs 37/37, tsc 0. |
| 4 - State the gate's input in the contract comment | 0c27c2b6, 5ff96919 | Header (0c27c2b6): the gate paragraph names `ADJUDICATION-risk_surface*.json`, every round, `.planning/phases/*/` plus `.planning/risk-carry/<N>/` via `planning.mjs risk-carry`, the `unruled` / `unruled-review` fifth state, `overridden` not moving `action`, and stdin-only with `--dir` config-only. `grep -n REVIEW-risk_surface` returns one line - the `unruled` sentence - and no union-of-findings instruction. Four-name paragraph kept as it stands; the file's opening summary re-worded from "blocking" to "genuinely-unfixed" for the same reason. Fixture (5ff96919, the granted lease, this dispatch): `config-seams.test.mjs:544`'s `BLOCKER` was a raw review finding with no ruling, so under the new gate it is not genuinely-unfixed and the layer-divergence arm failed at :579 with `'proceed' !== 'halt'`. Ruled it `survived` - the same mechanical update the eleven land-cleanup payloads took - and the fixture's comment now says the ruling is load-bearing, so the arm is about the config LAYER again rather than the payload shape. Not re-pointed at `unruled`. config-seams.test.mjs 16/1 before, 17/0 after; `self-verify.mjs` `ok:true`, `problems: []`; tsc 0. |
| Fix pass - `risk_surface` FAIL on the committed range | 0e52963b | Fixed the `high` at `land-cleanup.mjs:143`: a PRESENT but non-array `unruled` was coerced to `[]` beside an absent one, so `{"findings":[],"unruled":".planning/phases/9/REVIEW-risk_surface-plan-1.md"}` named an unadjudicated review and still returned `proceed` - one producer serialization bug, or one hostile line, silently discarded the fifth-state halt and let the unattended merge run. `readUnruled` now decides it in one place: absent (and `null`, which is how JSON spells absent) reads as `[]`, anything else that is not a list fails CLOSED as one member, so `unruled-review` halts exactly as a named review would. That member names the value's `typeof` and never its bytes - one of eight fixed words, so no untrusted payload rides the reason string onto stdout. The gate's header and `readFindings`'s docblock both state the new rule. The test arm that ASSERTED the old coercion (`..."unruled":"R.md"` -> `proceed`) is rewritten to assert the halt, plus an object-valued payload and a `null` one proving absent still proceeds. `lib/close-decision.mjs` is untouched: its own non-array coercion is the pure core's totality rail, pinned by `close-decision.test.mjs:256`, and the seam now never hands it a malformed value. The `close-decision.mjs:91` medium (an unbounded name inside a five-member cap) is in the review file for the record and was left as instructed. land-cleanup.test.mjs 37/37, full suite 3597/9 (the same pre-existing `renumber`/`PHS-01` cluster, unchanged), `self-verify.mjs` `ok:true` with `problems: []`, tsc 0, lint null. |

Deviations:
- [deviation] Task 4's `Verify:` asserts `node cadence-core/bin/test.mjs` is
  green. Observed: 3597 pass / 9 fail. Every one of the 9 is the pre-existing
  `renumber` / `PHS-01` cluster, and none is reachable from anything this phase
  touched - `git diff --name-only 2ba6665f..HEAD -- cadence-core/` names no
  `planning*.mjs` source file at all. Proved pre-existing rather than assumed:
  in a detached worktree at `2ba6665f` (the last commit before phase 4 wrote any
  code) `planning-renumber.test.mjs` is 17/25 and `planning.test.mjs` is 27/28,
  which is byte-identical to the current tree's 17/25 and 27/28 and accounts for
  all 9. What I did: fixed the one failure that WAS mine (the granted
  `config-seams.test.mjs` fixture) and left the cluster, which is outside this
  plan's lease and belongs to another requirement.

- [deviation] Task 2's `Action:` states that `unruled` "absent, or present but
  not an array, reads as `[]`". The `risk_surface` review of this plan's
  committed range ruled that a fail-open (`high`,
  `land-cleanup.mjs:143`): the present-but-malformed case carries evidence of a
  review nothing ruled, and reading it as none throws the halt away. What I did:
  split the two cases at the seam - absent still reads as `[]`, present-and-not-
  a-list halts - and left the pure core's coercion alone, since the seam is the
  only caller that can tell absent from malformed.

Open items:
- The 9 pre-existing failures above: 8 in `cadence-core/bin/planning-renumber.test.mjs`
  (the `renumber remove` arms plus `PHS-01: an unreadable git state refuses the
  remove`) and 1 in `cadence-core/bin/planning.test.mjs` (`renumber: a decimal
  cursor is warned about, never shifted (#37)`). Correcting the previous
  dispatch's report, which filed all 9 under `planning.test.mjs`: only one of
  them is in that file.
- Accepted residue the plan states rather than fixes: a hand-rolled caller that
  pipes raw review findings AND names nothing on `unruled` now gets `proceed`
  where it used to get `halt`. Pinned as an arm in land-cleanup.test.mjs so it is
  a recorded choice rather than a silent one; Plan 4 moves the only shipped
  caller in the same phase.
