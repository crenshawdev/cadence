# Phase 2: Blocking that blocks the land - Context

Gathered: 2026-08-20
Feeds: /cad-plan 2

## Scope boundary

In: a fifth gate mode `deferred` that fires the reviewer, persists its findings
and lets the run continue; a committed queue artifact naming what was deferred;
a `/cad-land` arm that refuses while that queue is unadjudicated; a
`/cad-progress` count and a cursor pointer naming it; test pins holding the
protected-branch guard and the one-round re-arm cap where they are.

Out: the `review` grid rows in `route-table.json` - no stakes level fires
`deferred` by default this phase (phase 3 owns what a level decides about
gates); the protected-branch guard itself, which answers where commits go
rather than what a review found; any change to the three frozen `RULINGS`.

Deferred: None.

Plan shape: multiple plans, same phase - the vocabulary and receipt (AC1-AC3),
the land refusal and progress count (AC5-AC6), with the rail pins (AC7)
alongside.

## Durable decisions

- D-01 (Queue home): the deferred queue's durable home is a committed
  `DEFERRED-<trigger>-<discriminator>.json` written beside the REVIEW file at
  fire time; membership is that file existing with no superseding ADJUDICATION
  sibling, never absence-of-record alone. `.planning/trace.jsonl` is gitignored
  and `renderTrace` drops a phase's events at its `uat_verdict complete`, so a
  trace-resident queue evaporates on a fresh clone and after sign-off while
  every in-session test stays green. Absence alone cannot be the membership
  test because every advisory fire also writes a REVIEW file with no record.
  Evidence: `.gitignore:29`, `cadence-core/bin/planning.mjs:4200-4290`,
  `cadence-core/bin/planning.mjs:4790-4800`,
  `cadence-core/references/review-triggers.md:328-340`.

- D-02 (Re-arm cap): the one-round re-arm cap's round count rides that same
  artifact, keyed to the FIRE rather than to the run's `corr`. A deferred
  finding is adjudicated later, in another session, whose `corr` matches no
  `rearm` from the deferring run - so a `corr`-keyed cap reads as unspent and
  the gate can loop, which is what criterion 6 forbids. The existing
  `corr`-keyed cap is untouched for non-deferred gates. Evidence:
  `cadence-core/references/triage-gate.md:74-140`,
  `cadence-core/bin/planning.mjs:4200-4245`.

- D-03 (Reachability): `deferred` is reachable only by a config-set
  `review.triggers.<t>.gate`; the `review` grid in `route-table.json` does not
  move and no stakes level fires it by default. Phase 3 (CER-01) changes what a
  level decides about gates and depends on this phase, so moving the rows now
  means editing them twice; the grid is also quoted by four documents plus the
  claims ledger, and `gate-agreement.mjs` forces a matching `<gate> at <level>`
  clause at all three levels. Criterion 2's live run states the config-set as
  setup. Evidence: `cadence-core/bin/lib/gate-agreement.mjs`, `README.md:95-100`,
  `METHOD.md:286-314`, `docs/WORKFLOW.md:150`,
  `.planning/DOCS-CLAIMS.md:543,616,1247`.

- D-04 (Receipt): a deferred fire writes a NEW fifth `outcome` receipt,
  `deferral`, and the `FIRE_RECEIPTS` comment asserting "a fifth name would be a
  state nothing produces" is updated to name what now produces one. Reusing
  `gate_pass` would read as a clean gate in every downstream recount and
  `override` is the manufactured clear the receipt machinery exists to refuse.
  Without an accepted receipt `risk-check status` reports the range unfired
  forever and the run halts exactly where criterion 2 says it must not.
  Evidence: `cadence-core/bin/planning.mjs:4139`,
  `cadence-core/bin/planning.mjs:4455-4470`,
  `cadence-core/workflows/execute.md:308-318`.

- D-05 (Cursor): the cursor names the queue in its `Next:` line - already free
  text and already `/cad-pause`'s resume-pointer transport - and the count
  `/cad-progress` reports comes from the `planning.mjs status` envelope, not
  from the cursor string. A new `Status:` value outside the `AGREE` map is
  reported as `cursor` drift, so the very next `/cad-progress` would rewrite it
  and the cursor would stop naming the queue one command after it was written.
  Evidence: `cadence-core/bin/lib/planning-files.mjs:13-16`,
  `cadence-core/bin/planning.mjs:367-372,454-478`,
  `cadence-core/workflows/progress.md:53-72,16-21`,
  `cadence-core/references/conventions.md:233-236`.

- D-06 (Refusal site): `/cad-land`'s refusal is a NEW arm, not the existing
  `land-cleanup.mjs gate`. That gate halts only when `git.auto_close === true`
  and reads only `risk_surface` survivors, so it cannot refuse a manual publish
  or a deferred `plan`/`diff`/`phase_diff` finding - the default-configured
  project would publish over its whole queue. Evidence:
  `cadence-core/bin/lib/close-decision.mjs:112-128`,
  `skills/cad-land/SKILL.md:96-112`,
  `cadence-core/references/triage-gate.md:170-184`.

## Decisions

- D-07 (Vocabulary): `deferred` is added to all four
  `review.triggers.<t>.gate` `values` arrays in `config.schema.json` AND to
  `route-table.json`'s `gates` array, element-for-element in the same order;
  nothing less resolves. Evidence: `cadence-core/bin/self-verify.mjs:987-1016`,
  `cadence-core/bin/lib/route-cells.mjs` (`gate-vocabulary-drift`),
  `cadence-core/bin/route.mjs`, `cadence-core/bin/config.test.mjs:1270`.

- D-08 (Ladder): the `gates` array is an ordered ladder, so where `deferred` is
  inserted changes `/cad-suggest`'s existing `oneStepDown` proposals, not just
  the accepted-name set. Evidence: `cadence-core/bin/lib/trace-suggest.mjs`,
  `cadence-core/bin/planning.mjs:3202`.

- D-09 (Fire artifacts): the deferred fire persists findings exactly as the
  advisory arm does - the reviewer's `{findings: [...]}` written to
  `REVIEW-<trigger>-<discriminator>.md` - and writes NO `ADJUDICATION-*.json` at
  fire time, because `RULINGS` is frozen at three values and a finding with no
  ruling is a refusal rather than a fourth ruling. Evidence:
  `cadence-core/bin/lib/adjudication-record.mjs`,
  `cadence-core/references/review-triggers.md:435-460`.

- D-10 (Prune survival): the refusal reads a surface that survives
  `/cad-milestone`'s prune - the queue artifact is carried out of
  `.planning/phases/<N>/` before the delete, as `risk_surface` survivors already
  are - since milestone chains `/cad-land` after pruning, and that is the one
  path that runs completely unattended. Evidence:
  `cadence-core/workflows/milestone.md:91-96,208,211`,
  `skills/cad-land/SKILL.md:100-108`.

- D-11 (Guard pin): no gate value reaches `git-guard.mjs` today - it reads
  `git.on_protected` and `git.protected_branches` and nothing else - so AC7's
  guard half is a lexical source census plus a hook case, never a refactor.
  Adding a plumbing route from the gate resolve into the hook to have something
  to pin is the movement the criterion forbids. Evidence:
  `cadence-core/bin/git-guard.mjs`, `cadence-core/bin/git-guard.test.mjs`,
  `cadence-core/bin/helper-census.test.mjs:1-28`.

- D-12 (Budgets): every prose surface this phase edits gets its
  `weight-budgets.json` row re-pinned in the same change - the budgets are
  ceilings currently set to each file's exact byte count, so an edit without the
  re-pin fails self-verify on `budget-overrun` after the work is otherwise done.
  Evidence: `cadence-core/bin/weight-budgets.json`,
  `cadence-core/bin/self-verify.mjs:706-742`.

- D-13 (Receipt census): the new fenced `trace append --family outcome` line
  must carry `--trigger`, `--plan`, `--base` and `--sha`, and
  `prose-agreement.test.mjs`'s expected receipt set is updated to five names in
  the same change - otherwise a correct addition reddens the suite and the fix
  looks like deleting an assertion. Evidence:
  `cadence-core/bin/prose-agreement.test.mjs:1174-1205`.

## Acceptance criteria

- [ ] AC1: `config.mjs set review.triggers.<t>.gate=deferred` succeeds for all
      four triggers, `route.mjs resolve` returns `deferred` in its `review` map,
      an unknown gate is still refused naming five values, and
      `node cadence-core/bin/self-verify.mjs --root .` reports no
      `gate-vocabulary-drift`.
- [ ] AC2: `planning.mjs trace append --family outcome --event deferral
      --trigger <t> --plan <p> --base <b> --sha <s>` is accepted, and
      `risk-check status` over that range reports the range FIRED rather than
      unfired; a test fails when `deferral` is removed from `FIRE_RECEIPTS`.
- [ ] AC3: a deferred fire leaves `REVIEW-<trigger>-<discriminator>.md` in the
      advisory arm's shape and `DEFERRED-<trigger>-<discriminator>.json` beside
      it, and no `ADJUDICATION-*.json`; the adjudication-record seam still
      refuses an unruled finding.
- [ ] AC4: a run whose gate defers a blocker completes - the phase reaches
      `executed`, its commits exist on the integration branch, and nothing
      prompted for input. (human-verify: needs a live /cad-execute chain)
- [ ] AC5: `/cad-land` refuses while any deferred finding is unadjudicated with
      `git.auto_close` false, and the refusal names each finding by trigger and
      discriminator; deleting the refusal reddens a test.
      (human-verify: needs a live /cad-land run)
- [ ] AC6: `/cad-progress` reports the count of unadjudicated deferred findings,
      that count comes from the `planning.mjs status` envelope, and the cursor's
      `Next:` names the queue after a deferring run.
- [ ] AC7: neither rail moved - a census test shows `git-guard.mjs` reached by
      no gate value and its existing cases still pass; a second re-arm on a
      deferred gate is refused even under a different `corr`; and
      `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with
      `problems: []`.

## Flagged assumptions

- AC4's and AC5's live halves are not dispatchable by any executor: a slash
  command's body is a skill, and no agent can invoke one - Likely; if wrong, a
  plan declares them as executor tasks, the executor checkpoints `structural`,
  and the phase reports incomplete for a reason unrelated to the code. Phase 1's
  SUMMARY records the same shape. The orchestrator or the user runs them.
- The host permits a genuinely unattended multi-phase run under bypass
  permissions, so no tool call blocks on approval - Confirmed by the user for
  this setup, not by anything in this repository; a session without that mode
  cannot demonstrate AC4 as worded.
- `deferred` sits between `advisory` and `blocking` in the `gates` ladder -
  Likely, and the planner's call to confirm; if wrong, a `blocking` gate whose
  fires come back empty is proposed down to the wrong neighbour and
  `trace-suggest.test.mjs`'s ladder fixtures diverge from the real table.
