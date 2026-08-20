---
phase: 2
status: complete
completed: 2026-08-20
---

# Phase 2: Blocking that blocks the land - Summary

A fifth gate mode `deferred` that runs its reviewer, queues what it found as a
committed `DEFERRED-*.json`, and lets the phase finish - and a `/cad-land` that
refuses on both publish arms while any queue member is unadjudicated.

## What shipped

- `deferred` as the fifth gate value, one ladder position between `advisory` and
  `blocking` - `config.schema.json` (4 gate keys), `route-table.json`'s `gates`,
  `route.mjs`'s `DEFAULT_GATES`
- `deferral` as the fifth fire receipt `risk-check status` joins on - no special
  case, as clearable as `gate_pass`
- The queue writer `planning.mjs deferred record` and its pure grammar half
  `cadence-core/bin/lib/deferred-queue.mjs` - findings stored VERBATIM, refused
  rather than overwritten, resolved commit ids not the caller's `HEAD`
- The queue reader `planning.mjs deferred list` - one derivation over two homes
  (`phases/<N>/` and `.planning/deferred/<N>/`), an unreadable directory
  reported rather than counted as empty
- The count on the `planning.mjs status` envelope, always present, so a caller
  can tell "nothing deferred" from "this seam does not know about deferrals"
- The refusal itself - `skills/cad-land/SKILL.md:66`, at the top of step 3,
  ahead of both `(a)` and `(b)`, and independent of `git.auto_close`
- `/cad-progress` reads the count off that envelope and routes it to the triage;
  a deferring run's cursor names its queue in `Next:`
- `planning.mjs deferred carry` plus the `/cad-milestone` call site, so the
  queue leaves `.planning/phases/<N>/` before the prune deletes it and stays
  adjudicable and re-armable from its carried home
- The two rails pinned rather than trusted: a lexical + behavioural census that
  no gate value reaches `git-guard.mjs`, and a `route.test.mjs` census that no
  stakes cell fires `deferred` (it is reachable only by a config-set gate)

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 18173e5 | admit `deferred` to the gate vocabulary between `advisory` and `blocking` |
| 1 | 2 | 15b333c | `deferral` becomes the fifth fire receipt `risk-check status` accepts |
| 1 | 3 | ed15c5d | `planning.mjs deferred record` + `lib/deferred-queue.mjs`, the queue artifact |
| 1 | 4 | 587d301 | state the `deferred` arm once, where every fire site re-reads it |
| 2 | 1 | 393a358 | `planning.mjs deferred list`, the one derivation of what is still queued |
| 2 | 2 | a223b21 | the `status` envelope carries the unadjudicated count, always |
| 2 | 3 | c844eea | `/cad-land` refuses on an unadjudicated queue, ahead of both publish arms |
| 2 | 4 | f4baec7 | `/cad-progress` reports the count and routes it to the triage |
| 2 | 5 | 12ec391 | a deferring run's cursor names its queue, and the queue is committed |
| 2 | 6 | 207f3a8 | `planning.mjs deferred carry`, so the queue survives the prune |
| 2 | 7 | 456aae9 | a carried member stays adjudicable and re-armable |
| 2 | gate | 43b869e | `deferred carry` checks the parent it creates, not only the leaf |
| 3 | 1 | 648e459 | census the protected-branch guard as unreached by any gate |
| 3 | 2 | aac302a | the deferred re-arm cap rides the queue, not the run's `corr` |
| 3 | 3 | ab382a8 | pin that no stakes level fires the `deferred` gate |
| 3 | 4 | 8bd5243 | every statement of the gate vocabulary names five |

`43b869e` is not a plan task. It is the fix that cleared plan 2's blocking
`risk_surface` gate, committed under that plan's scope before the narrowed
re-arm fired.

## Review gates

`risk_surface` fired on every plan range whose detector matched, once each, on
the committed range.

| Plan | Range | Matched | Raised | Settled |
|---|---|---|---|---|
| 1 | bedf576..587d301 | `untrusted_input` | 2 | 0 survived, 1 downgraded, 1 refuted - PASS |
| 2 | 587d301..456aae9 | `destructive`, `untrusted_input` | 2 | 1 survived (high) - FAIL, fixed in `43b869e` |
| 2 (r2) | 587d301..43b869e | narrowed to the fix | 1 | 0 survived, 1 downgraded - PASS |
| 3 | 43b869e..8bd5243 | none | - | did not fire |

The one survivor: `deferred carry` checked only the final `deferred/<N>`
component of its destination. `lstatSync` does not follow the final component
and follows every one before it, so with `.planning/deferred` a symlink the
guard answered "absent, go ahead", `mkdirSync(recursive)` built the phase
directory wherever the link pointed, and `renameSync` filled it with committed
queue members - the gate's only durable evidence, deposited outside the
repository, reported as a successful carry, immediately before the prune. It was
reachable through an ordinary `git checkout` of a branch carrying that symlink,
needing no extra privilege. Confirmed by running it before the fix, closed in
`43b869e`, pinned by `planning.test.mjs`'s "a symlink squatting the PARENT is
refused too".

Records: `.planning/phases/2/ADJUDICATION-risk_surface-plan-{1,2}.json` and
`-plan-2-r2.json`. Voice: `openai` / `gpt-5.6-terra` at effort `medium`, one
voice per fire.

## Deviations

- [deviation, plan 1 task 1] The plan's Verify spelled the config write as
  `config.mjs set ... --dir <scratch .planning>`; `config.mjs` has no `--dir` on
  any face, and the flag is refused as a non-`key=value` argument. The same four
  writes ran through `--file <scratch>/.planning/config.json`, which is the same
  assertion. `18173e5`
- [deviation, plan 1 task 4] The plan's Verify predicted `grep 'deferred'` over
  `plan.md`, `execute.md` and `execute-parallel.md` returns nothing; it returns
  two PRE-EXISTING lines using the ordinary English word (`plan.md`'s
  `split - deferred slice`, `execute.md`'s `deferred item routed here`). Neither
  file was touched and neither line is a gate arm, so the criterion the grep
  stood for holds. `587d301`

No deviation refuted a numbered CONTEXT decision, so `CONTEXT.md` is unchanged.

## Open items

- `milestone-prune.test.mjs`'s `corpus: pruning this repository's own
  REQUIREMENTS.md needs no hand repair` fails (2525 of 2526). PRE-EXISTING:
  confirmed red at PHASE_START `bedf576` in a detached worktree, so this phase
  neither caused it nor is positioned to fix it - `.planning/REQUIREMENTS.md` is
  outside all three plans' leases. Phase 1's completed `IVW-01` is a single-line
  bullet where the test asserts a wrapped one; the repair is a one-line re-wrap
  for whichever plan next leases that file.
- `risk-diff.test.mjs`'s hand-copied `RECEIPTS` census still reads four outcome
  names with no `deferral` row. Outside all three plans' leases; the new arms
  went into `planning.test.mjs` instead. Worth a row when a plan next leases it.
- `deferred record` puts no bound on the findings-ARRAY length or total payload
  size - `buildQueue` bounds each finding, `readJsonPayload`
  (`planning.mjs:710`) bounds nothing. Downgraded at plan 1's gate: the helper
  pre-existed at `bedf576` unchanged and `adjudication` shares it, so this range
  only added a second caller of an operator-supplied local file. A cap belongs
  in the helper, covering both callers.
- The `deferred carry` parent check is lstat-then-mkdir, so a concurrent process
  can still swap the parent between them. Downgraded at plan 2's re-arm: it
  needs write access to `.planning/` that could simply delete the members
  instead, and Node's `fs` exposes no `openat`/`O_NOFOLLOW` to answer it
  atomically. Revisit if that surface ever appears.
- Queue identities and paths are returned verbatim in the `deferred list` /
  `status` envelope with no URL redaction, so a credential spelled into a
  member's own filename reaches the land transcript. Downgraded at plan 2's
  gate - the value is one its own writer put there - but a redaction pass over
  queue identities is worth its own change.
- The `rearm` receipt for plan 2's round 1 was first written against the FIXED
  head `43b869e` rather than the head it re-armed ON (`456aae9`), which left
  that matched range reading `unfired` to `risk-check status`. Corrected by
  appending the receipt keyed to `456aae9`; the run's `rearm` count therefore
  reads 2 for one round, which is inert for the cap (it tests non-zero) but
  overstates the round in `trace render`. Worth a coordinator-side clarification
  of which head a `rearm` names.

## Goal check

The phase delivers its goal. The fire half is real: `deferred` resolves as a
gate value (`route-table.json:19` lists five, and `route.mjs resolve` with a
pinned `review.triggers.diff.gate` returns it - `ab382a8` pins exactly that
path), a fire in that mode writes a committed queue member rather than halting,
and `deferral` joins `risk-check status`'s receipt set so the range clears. The
land half is real too: `skills/cad-land/SKILL.md:66` puts the `deferred list`
call at the top of step 3, ahead of both publish arms and independent of
`git.auto_close`, and `skills/cad-land/SKILL.md:252` states the queue is the one
thing that stops the land. The count is on the live envelope now, not just in
prose - `planning.mjs status` on this repository returns
`"deferred":{"members":[],"findings":0,"unreadable":[]}`. The two rails the
phase was forbidden to move did not move: `git diff --stat` is empty for
`git-guard.mjs` across the whole range, and the one-round cap gained a
queue-keyed reading for deferred fires without touching the corr-keyed block
beside it. `self-verify --root .` returns `ok:true` with `problems: []`.

What is NOT proven, honestly: nothing exercises the deferred path end to end
against a real fire, because no stakes level fires it - `ab382a8` pins that
deliberately, so the mode is reachable only by a user setting
`review.triggers.<t>.gate` by hand. The evidence is per-seam and per-prose
rather than one integration run, which is what `/cad-verify` should press on.
The suite is 2525 of 2526, and the single red predates the phase (verified at
`bedf576`).
