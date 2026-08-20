---
phase: 2
plan: 2
requirements:
  - HLT-01
files:
  - cadence-core/bin/lib/deferred-queue.mjs
  - cadence-core/bin/deferred-queue.test.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/planning.test.mjs
  - cadence-core/bin/lib/arg-contract.mjs
  - cadence-core/bin/arg-contract.test.mjs
  - skills/cad-land/SKILL.md
  - cadence-core/workflows/progress.md
  - cadence-core/workflows/execute.md
  - cadence-core/workflows/milestone.md
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/bin/weight-budgets.json
---

# Phase 2: Blocking that blocks the land - Plan 2 of 3 (the land refusal and the progress count)

## Goal

The queue plan 1 writes becomes the thing that stops the land: `/cad-land`
refuses while any deferred finding is unadjudicated, `/cad-progress` reports how
many there are, the cursor names the queue after a deferring run, and the queue
survives the milestone prune that runs immediately before the one land nobody
watches.

## Must be true when done

- `planning.mjs deferred list` answers with every unadjudicated queue member -
  a `DEFERRED-*.json` with no superseding `ADJUDICATION` sibling - each named by
  phase, trigger, discriminator and round, with the total finding count, and a
  directory it could not read is reported rather than counted as empty.
- `planning.mjs status` carries that count in its envelope, always - a caller
  can tell "nothing is deferred" from "this seam does not know about
  deferrals".
- `/cad-land` REFUSES before either publish arm while any deferred finding is
  unadjudicated, including with `git.auto_close` false, and the refusal names
  each finding's trigger and discriminator.
- `/cad-progress` reports the count from the `status` envelope, not from the
  cursor string, and after a deferring run the cursor's `Next:` line names the
  queue.
- A milestone close carries the queue out of `.planning/phases/<N>/` before the
  prune deletes it, and a carried member can still be adjudicated afterwards -
  and, when that adjudication leaves a `blocker`/`high` standing, the narrowed
  round can still record its own queue member - so the queue is clearable rather
  than a gate nobody can satisfy.

## Context

- D-01: membership is the `DEFERRED-<trigger>-<discriminator>.json` file
  EXISTING with no superseding `ADJUDICATION` sibling - never absence-of-record
  alone, because every advisory fire also writes a REVIEW file with no record.
- D-05: the cursor names the queue in its `Next:` line, which is already free
  text and already `/cad-pause`'s resume-pointer transport; the COUNT comes from
  the `planning.mjs status` envelope, never parsed back out of the cursor
  string. A new `Status:` value outside `AGREE` in `planning.mjs` would be
  reported as `cursor` drift and rewritten by the very next `/cad-progress`.
- D-06: the refusal is a NEW arm in `/cad-land`, not `land-cleanup.mjs gate`.
  `decideGateHalt` in `lib/close-decision.mjs` halts only when
  `git.auto_close === true` and reads only `risk_surface` survivors, so it
  cannot refuse a manual publish or a deferred `plan`/`diff`/`phase_diff`
  finding.
- D-10: the refusal reads a surface that survives `/cad-milestone`'s prune,
  because `milestone.md` chains `/cad-land` after pruning and that is the one
  path that runs completely unattended.
- D-12: re-pin `weight-budgets.json` in the same task as any prose edit.
- Runs AFTER plan 1 and shares files with it. Out of scope here: the gate
  vocabulary, the receipt and the fire artifacts (plan 1); the rail pins
  (plan 3).

## Tasks

### Task 1: The queue reader - `planning.mjs deferred list`

- **Files:** cadence-core/bin/lib/deferred-queue.mjs, cadence-core/bin/deferred-queue.test.mjs, cadence-core/bin/planning.mjs, cadence-core/bin/lib/arg-contract.mjs, cadence-core/bin/arg-contract.test.mjs
- **Action:** Extend `cadence-core/bin/lib/deferred-queue.mjs` (created in plan
  1, task 3) with the membership derivation, and add a `deferred list` face on
  `planning.mjs` beside `deferred record`. A MEMBER is a
  `DEFERRED-<trigger>-<discriminator>[-r<round>].json` file for which the
  `ADJUDICATION` name that `recordName` resolves for the same trigger,
  discriminator and round is NOT present in the same directory (D-01). Two
  homes are read: `.planning/phases/*/` and `.planning/deferred/*/`, the carried
  home task 6 creates; nothing else, and never an `_archive-*` tree, which holds
  a closed milestone's copy of work that was already carried. `--phase` is
  optional and narrows to one phase; absent means the whole tree. The envelope
  carries each member's phase, trigger, discriminator, round, its path relative
  to the planning dir and its own finding count, plus the total finding count
  across members - and it carries finding BODIES nowhere, so the refusal in task
  3 and the report in task 4 can print the answer directly instead of routing
  bulk output through a scratch file. A directory the reader could not read, or
  a member file that does not parse, lands on its own reported list and is NEVER
  collapsed into "nothing deferred" - an unprovable queue is not an empty one,
  which is the disposition `decideGateHalt` already states for an unreadable
  findings payload. Add the `deferred list` row to `CONTRACTS['planning.mjs']`
  in `lib/arg-contract.mjs`, declaring `--phase` optional with the `phase` type
  the sibling rows use.
- **Verify:** With one `DEFERRED-diff-plan-1.json` under `.planning/phases/2/`, `node cadence-core/bin/planning.mjs deferred list` names it by phase, trigger, discriminator and round and reports its finding count; writing the matching `ADJUDICATION-diff-plan-1.json` beside it drops it from the answer; `chmod 000` on a phase directory puts that directory on the reported unreadable list and the envelope does not report zero members; `--phase 2` returns only phase 2's members; `node cadence-core/bin/test.mjs other` and `node cadence-core/bin/self-verify.mjs --root .` both pass.

### Task 2: `planning.mjs status` carries the unadjudicated count

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/planning.test.mjs
- **Action:** Have `cmdStatus` in `planning.mjs` read the same
  `lib/deferred-queue.mjs` derivation task 1 exposes and put a `deferred` block
  on its envelope carrying the total unadjudicated finding count, the members'
  identities and the unreadable list. ALWAYS present, unlike the `cycle` and
  `drift` keys beside it that appear only in their own states: this key is read
  by a REFUSAL surface, so an absent key must mean "the seam predates this
  feature" and never "nothing is deferred". One derivation and one reader, so
  `/cad-progress` and `/cad-land` cannot disagree about what is queued. Do NOT
  add a cursor status value and do not touch the `AGREE` map - a `Status:`
  outside it is reported as `cursor` drift and rewritten by the next
  `/cad-progress` (D-05). Existing `status` tests that compare the whole
  envelope will need the new key; update them rather than making the key
  conditional.
- **Verify:** `node cadence-core/bin/planning.mjs status` on this repository carries a `deferred` block with a zero count and no members; with a queue member under `.planning/phases/<N>/` the same call reports that member and its finding count; adjudicating it drops the count to zero; `node cadence-core/bin/test.mjs planning` passes.

### Task 3: `/cad-land` refuses on an unadjudicated queue, on both publish arms

- **Files:** skills/cad-land/SKILL.md, cadence-core/bin/prose-agreement.test.mjs, cadence-core/bin/weight-budgets.json
- **Action:** Add the refusal to `skills/cad-land/SKILL.md` as a block at the
  TOP of step 3, ahead of the `git.auto_close` (a)/(b) branch and inside no arm
  of it. Do not renumber any step: `prose-agreement.test.mjs` already pins
  "cad-land step 3" and "cad-land 3(b)" by name, and `workflows/milestone.md`
  and `references/triage-gate.md` cite the same numbers. The block runs
  `planning.mjs deferred list`, and on any member STOPS the land - no publish
  ask, no seam call, no merge - printing each member's trigger and discriminator
  and its finding count, and pointing the reader at
  `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/triage-gate.md` for the
  `deferred` arm that says how to clear it. It is NOT `land-cleanup.mjs gate`
  and must not be folded into it (D-06): that gate halts only under
  `git.auto_close === true` and reads only `risk_surface` survivors, so a
  default-configured project would publish straight over its whole queue. State
  in the block that it applies on BOTH arms and that a reported unreadable
  directory refuses exactly as a member does, for the reason `decideGateHalt`
  already gives - the gate never reports "nothing survived" about input it could
  not parse. Extend the skill's `<guardrails>` with one sentence: `/cad-land`
  publishes what was already reviewed and TRIAGED, and an unadjudicated deferred
  finding is the one thing that stops it. Add a `prose-agreement.test.mjs` arm
  that reads the skill file and asserts the `deferred list` invocation appears
  in step 3 ahead of both the 3(a) ask and the 3(b) branch - deleting the
  refusal must redden that arm, which is what makes criterion 4's "reverting the
  refusal reddens a test" true. Re-pin `skills/cad-land/SKILL.md`'s
  `weight-budgets.json` row.
- **Verify:** `node cadence-core/bin/test.mjs prose` passes and the new arm fails when the `deferred list` line is deleted from `skills/cad-land/SKILL.md`; `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with an empty `problems` array, so the new invocation resolves against its CONTRACTS row and the budget row is re-pinned.

### Task 4: `/cad-progress` reports the count and routes to the triage

- **Files:** cadence-core/workflows/progress.md, cadence-core/bin/prose-agreement.test.mjs, cadence-core/bin/weight-budgets.json
- **Action:** In `cadence-core/workflows/progress.md`, name the new `deferred`
  key in the `derive` step's list of what the one `status` JSON line carries,
  and add one line to the `report` step's block printing the count of
  unadjudicated deferred findings when it is non-zero. State that the figure
  comes from the envelope and never from the cursor's `Next:` text (D-05) - the
  cursor is a hint the derivation overrides, and parsing a count back out of
  free text is the substitution this repository already condemned for trigger
  names. Add a row to the `route` table below the existing ones - a non-zero
  deferred count routes to the triage rather than to a land - placed so it does
  not displace the paused-cursor or lowest-planned rows, which are recovery
  states and take precedence. Do not add a new `Status:` value and do not touch
  the `reconcile` step's status mapping. Add a `prose-agreement.test.mjs` arm
  asserting `progress.md` names the envelope key at both its derive and report
  sites and never instructs a reader to take the count off the cursor. Re-pin
  `cadence-core/workflows/progress.md`'s `weight-budgets.json` row.
- **Verify:** `node cadence-core/bin/test.mjs prose` passes with the new arm; `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with an empty `problems` array; `grep -n 'deferred' cadence-core/workflows/progress.md` shows it named in the derive step, the report step and the route table.

### Task 5: A deferring run leaves the cursor naming its queue, and commits the queue

- **Files:** cadence-core/workflows/execute.md, cadence-core/bin/prose-agreement.test.mjs, cadence-core/bin/weight-budgets.json
- **Action:** In `cadence-core/workflows/execute.md`'s `state` step, branch the
  `cursor set` call: when this run deferred anything, write the resume pointer
  to a scratch file and pass `--next-file <path>` instead of the inline
  `--next "/cad-verify <N>"`, with the pointer naming the queue and its count
  beside the next action. The file transport, not the inline flag, because the
  pointer is now composed from what the run did rather than a literal, which is
  the rule `references/conventions.md` states for caller-derived text and the
  reason `cursor set --next-file` exists. Keep `--status executed` exactly as it
  is - a new status value would land outside `planning.mjs`'s `AGREE` map and be
  rewritten as drift by the next `/cad-progress` (D-05). In the same step's
  commit list, add `.planning/phases/<N>/DEFERRED-*.json` to the staged paths,
  with the reason stated once: a queue member is the only durable evidence a
  fire was deferred, `.planning/trace.jsonl` is gitignored, and an untracked
  member is gone on a fresh clone. Add a `prose-agreement.test.mjs` arm pinning
  both halves - the deferring branch takes `--next-file` and the commit list
  names the queue pathspec. Re-pin `cadence-core/workflows/execute.md`'s
  `weight-budgets.json` row.
- **Verify:** `node cadence-core/bin/test.mjs prose` passes with the new arm; `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with an empty `problems` array; `grep -n 'next-file' cadence-core/workflows/execute.md` shows the deferring branch and `grep -n 'DEFERRED' cadence-core/workflows/execute.md` shows the pathspec in the commit list.

### Task 6: The queue survives the prune - `planning.mjs deferred carry`, called from the close

- **Files:** cadence-core/bin/lib/deferred-queue.mjs, cadence-core/bin/deferred-queue.test.mjs, cadence-core/bin/planning.mjs, cadence-core/bin/lib/arg-contract.mjs, cadence-core/workflows/milestone.md, cadence-core/bin/weight-budgets.json
- **Action:** Add a `deferred carry` face taking `--phase`, which MOVES that
  phase's unadjudicated members - exactly the set `deferred list --phase`
  returns - from `.planning/phases/<N>/` to `.planning/deferred/<N>/`,
  preserving each file's basename, creating the destination directory, refusing
  rather than overwriting an existing destination file, and reporting what it
  moved. A MOVE and not a copy, so a `--mode archive` close cannot leave a
  second copy under `_archive-<label>/` that the reader would count twice; the
  phase number is preserved as a directory level rather than folded into the
  filename because two phases routinely defer the same trigger on the same
  `plan-<k>` discriminator, and a flat carry would collide silently. A member
  that already has its `ADJUDICATION` sibling is left behind to be pruned with
  the phase - it is settled, and carrying it would put a cleared finding in
  front of every later land. It is a SEAM and not a prose instruction, unlike
  the transient `risk_surface` union beside it, because this one moves committed
  artifacts during a close that is running unattended. Wire it into
  `cadence-core/workflows/milestone.md` step 3 immediately beside the existing
  "Carry the `risk_surface` survivors forward FIRST" paragraph, before the
  `milestone-prune` call, stating the difference in one clause: the
  `risk_surface` union is TRANSIENT and step 7 deletes it, while the carried
  queue is COMMITTED and stays until it is adjudicated - deleting it at step 7
  would delete the only thing stopping the chained land. Add the CONTRACTS row
  and re-pin `cadence-core/workflows/milestone.md`'s budget.
- **Verify:** `node cadence-core/bin/planning.mjs deferred carry --phase <N>` moves the unadjudicated members to `.planning/deferred/<N>/` and leaves the settled ones in place; `deferred list` finds the moved members after `.planning/phases/<N>/` is deleted; a second `carry` with a destination file already present refuses instead of overwriting; `node cadence-core/bin/test.mjs other` and `node cadence-core/bin/test.mjs prose` pass and `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with an empty `problems` array.

### Task 7: A carried member stays adjudicable AND re-armable after its phase directory is gone

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/planning.test.mjs
- **Action:** `cmdAdjudication` refuses when `phases/<N>/` is not a directory,
  because the record is written BESIDE the sibling REVIEW file. After task 6
  that refusal makes a carried queue member permanently unclearable, and an
  unclearable gate is one that gets bypassed - the verdict this tree has already
  recorded twice. Resolve the fire's home as: `phases/<N>/` when it is a
  directory, else `.planning/deferred/<N>/` when THAT is, else the existing
  `no-phase-dir` refusal with its wording widened to name both homes. Keep the
  `lstatSync` check on whichever home is chosen so a symlink sitting where the
  directory should be is still refused rather than followed out of the tree.
  Widen `deferred record`'s home the SAME way, in the same task and off the same
  resolver, because plan 1 task 3 gave it the identical `phases/<N>/` refusal and
  it is the face a capped re-arm writes its round-2 member through (plan 3, task
  2). A carried member is triaged in a LATER session, which is the whole point of
  task 6; when that triage rules a `blocker`/`high` survived, the narrowed round
  has to record itself, and a `deferred record` still refusing on the pruned
  phase directory leaves the re-arm no artifact to write - the cap then reads as
  unspent off a queue that could never gain a round-2 member, and the operator's
  only route is around the seam. Same resolution order, same `lstatSync` check on
  whichever home is chosen, same widened refusal wording naming both homes.
  Leave `recordForFire` reading `phases/<N>/` alone: it resolves the receipt
  RECOUNT, whose own contract already states that an unresolvable record OMITS
  the check rather than failing the append, so a carried fire degrades to no
  cross-check instead of to a wrong one - state that in a comment at the widened
  site so the asymmetry is a decision on the page rather than an oversight.
- **Verify:** With a carried member at `.planning/deferred/<N>/DEFERRED-diff-plan-1.json` and no `.planning/phases/<N>/`, `node cadence-core/bin/planning.mjs adjudication --phase <N> --trigger diff --discriminator plan-1 --base <base> --head <head> --payload <file>` writes `ADJUDICATION-diff-plan-1.json` into that same directory and `deferred list` then reports zero members; with neither home present the same call still refuses naming both; with that same carried member and no `.planning/phases/<N>/`, `node cadence-core/bin/planning.mjs deferred record --phase <N> --trigger diff --discriminator plan-1 --round 2 --base <base> --head <head> --payload <file>` writes `DEFERRED-diff-plan-1-r2.json` into `.planning/deferred/<N>/` instead of refusing, and reverting that widening reddens the arm; `node cadence-core/bin/test.mjs planning` passes.

## Notes

- Sequential after plan 1 and before plan 3; they share `planning.mjs`,
  `lib/deferred-queue.mjs`, `lib/arg-contract.mjs`, `prose-agreement.test.mjs`
  and `weight-budgets.json`. `plan-overlap` will report the overlaps and
  `/cad-execute` will take its sequential arm, which is correct.
- AC4 and the live half of AC5 are NOT tasks here, deliberately. CONTEXT flags
  both as human-verify: a slash command's body is a skill and no executor can
  invoke one, so declaring them as tasks would produce a `structural`
  checkpoint and a phase reporting incomplete for a reason unrelated to the
  code. The orchestrator or the user runs them at `/cad-verify`: a live
  `/cad-execute` chain under bypass permissions that completes with a deferred
  blocker on the integration branch, then a live `/cad-land` that refuses and
  names the queue.
