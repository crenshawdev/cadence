# Phase 2: A receipt can name its home and its authorization - Context

Gathered: 2026-09-01
Feeds: /cad-plan 2

## Scope boundary

In: `GH-227` (RSK-09) and `GH-220` (AUT-03) as one claim - a settlement record
states what it descends from instead of leaving a coordinator to write the
answer into free text. Three seams that barely touch: the record work
(`planning/{core,adjudication,trace}.mjs` - the hand-written record replaced by
a seam-produced one carrying a `task` field, the converse `--phase <N> --task`
guard, and `recordForFire` widened so a task settlement's counts are actually
checked); the OQ-1 anchor flag (`trace append` gains a flag naming the window a
receipt settles, with its `arg-contract` row and its `triage-gate.md` line); and
the authorization id (a structured flag on `outcome/override`, plus the
`trace-suggest` reader that counts decisions rather than writes). Riding with
them, the `weight-budgets.json` re-pins every edited prose file owes.

Out: `GH-229` and `GH-178` (both about resolving an INPUT before a gate runs;
this cycle is about what the record says AFTER one did). `GH-230` and `GH-140`
(decisions, not defects). Phase 3's observed-effort work at `route.mjs:974-976`.
Widening `recordForFire` to `deferred/<N>/` - that home keeps its stated
degrade-to-no-check posture (D-04). Any change to `settledBy`/`settles` gate
strength (D-03). Teaching the `adjudication` seam `tasks/<slug>/` as a home -
already shipped 2026-08-30 (D-06).

Deferred: None.

Plan shape: multiple plans - the record seam (AC1-AC3), the anchor flag (AC4)
and the authorization id (AC5-AC6) split cleanly along three files that do not
overlap; AC7 rides whichever plan lands last. /cad-plan breaks it down.

## Durable decisions

- D-01 (OQ-1 shape): A receipt NAMES the anchor it settles under - shape (a) -
  rather than re-anchoring carrying unsettled fires forward - shape (b). Chosen
  on blast radius, not on observed frequency. Shape (a) is a CLI flag plus its
  contract row plus one prose line: `cadence-core/bin/lib/trace.mjs:407-419`
  already reads an explicit `corr` off the event and falls back to
  `correlationId` only when there is none, and
  `cadence-core/bin/lib/subagent-trace.mjs:308-325` already supplies one quoted
  off the bracket row. Shape (b) would touch the anchor writer at
  `cadence-core/workflows/execute.md:150`, the append-only size bound at
  `lib/trace.mjs:23-36`, and every reader assuming one `risk_check` per range -
  and it pays that cost on EVERY phase start, not a rare one: measured
  2026-09-01, `/code/cadence`'s trace holds 35 `lifecycle/phase_start` anchors
  on phase 1, 23 on phase 2, 19 on phase 3, and one per `/cad-task` run on
  phase 0. If wrong: a receipt can name a window it does not belong to, and the
  gate's range check is the only thing left objecting.
- D-02 (The authorization id is minted, never derived): The coordinator mints
  and types the id when the engineer answers; it is not a hash or a
  normalization of the reason text. Evidence: measured 2026-09-01 over
  `/code/smithers/.planning/trace.jsonl`'s 9 `outcome/override` events -
  grouping by exact `detail` text yields 7 groups, which collapses both
  duplicate pairs `GH-220` names (phase 1's identical payloads 11s apart at
  `sha d7269ce`/`6c138e5`, and phase 2's same-text-different-counts pair 7/0/0
  vs 3/4/0) but does NOT collapse the phase-3 trio, whose three receipts carry
  three distinct texts on one standing authorization. A derived key answers 2
  of 3 and misses the case that motivated the issue. If wrong: the field is
  present and still cannot tell a re-application from a duplicate, which is the
  defect restated with a new column.
- D-03 (Label only, never widen): A shared authorization id LABELS the pair for
  a reader; it does not let one receipt settle a second range.
  `cadence-core/bin/planning/risk-check.mjs:779-782` still requires every fired
  record to carry its own receipt, and `settledBy` at `:725-782` still requires
  both range ends. This resolves a genuine conflict in the sources: `GH-220`'s
  body ("one answer cleared two ranges" becomes something the record states)
  reads as declare-and-accept, while the roadmap's own criterion (the `:718`
  guard "is no longer the only thing standing between the two") reads as
  tighten - opposite changes to the same lines. The roadmap criterion wins.
  Evidence: `risk-check.mjs:766-770` carries a comment recording that "matched
  if supplied" on the head alone already reopened the widened-range bypass
  under a different name, so widening reverses GAT-04's fix and would owe a
  replacement guard. If wrong: the phase ships a field that quietly weakens the
  blocking gate it was meant to make legible.
- D-04 (Recount widens to `tasks/` only): `recordForFire` learns
  `tasks/<slug>/` so a task settlement's counts and override marker are
  checked; `deferred/<N>/` keeps its stated degrade-to-no-check posture. This
  is a deliberate half-reversal of a stated choice, not the closing of an
  oversight - `cadence-core/bin/planning/core.mjs:726-730` states the
  non-widening and gives its reason. Evidence:
  `cadence-core/bin/planning/trace.mjs:1289` resolves only
  `join(dir, 'phases', String(phaseRaw))`, and both `recountReceipt` (`:1360-1361`)
  and `overrideAccounted` (`:1453-1454`) go through it, treating an unresolved
  record as "omit the check". Measured 2026-09-01: an identical record under
  `phases/9/` refused a fabricated `--survivors 999` with `count-disagreement`;
  under `tasks/<slug>/` the same receipt was accepted `ok:true`. All four
  `gate_pass` receipts the `secret-fence-on-review-payloads` task wrote (corr
  `0-443bcd8f-916394-1788120025`, 2026-08-30T21:25:32) carry counts that were
  never recounted for this reason. If wrong: a task's settlement stays
  self-asserted and the recount is a check that reports on two homes out of
  three without saying so.
- D-05 (Case B is a stale premise): The `adjudication` seam ALREADY accepts
  `tasks/<slug>/` as a third home - it landed 2026-08-30 in `f860560e` and
  `2d81c61e` during the `secret-fence-on-review-payloads` task, recorded as
  authorized mid-run at
  `.planning/tasks/secret-fence-on-review-payloads/RECORD.md:16-20`. The
  roadmap's defect line is stale on two counts: the refusal lives in
  `cadence-core/bin/planning/core.mjs:672-680`, not
  `cadence-core/bin/lib/adjudication-record.mjs`, and it no longer fires for a
  task. Evidence: `planning/core.mjs:647-663` (the `--task` token rail),
  `:702-714` and `:755-771` (`fireHome`'s task branch and its `no-task-dir`
  refusal, whose comment cites `#167 GH-227`),
  `cadence-core/bin/lib/arg-contract.mjs:823-839`,
  `cadence-core/references/review-record.md:119,122`,
  `cadence-core/workflows/task.md:214`. Measured 2026-09-01 against a scratch
  planning dir: `adjudication --phase 0 --task declines-off-the-tracker
  --trigger risk_surface ...` answers `ok:true`, writes the record, grounds all
  5 citations with 0 missing and derives raised 5 / survived 4 / refuted 1. If
  wrong: the plan's first task re-implements a merged path resolution and
  touches four prose files each sitting exactly at its byte ceiling, for no
  behaviour change.

## Decisions

- D-06 (What Case B actually owes): Because the seam already writes the home,
  this phase's Case B work is replacing the committed hand-written
  `.planning/tasks/declines-off-the-tracker/ADJUDICATION-risk_surface-declines-off-the-tracker.json`
  with one the seam produced. The seam will not overwrite it -
  `cadence-core/bin/planning/adjudication.mjs:165-173` refuses `record-exists`
  on any `lstat` hit - so the committed file is removed first, in the same
  commit. Evidence: measured 2026-09-01, the live-tree run answered
  `{"ok":false,"reason":"record-exists"}` before being redirected to a scratch dir.
- D-07 (The record body names its task): The record carries a `task` field,
  present only on a task fire, matching the present-only-when-real convention
  `redactions`, `config_warnings` and `--agent-id` already take and phase 1's
  D-11 locked for provider usage. Without it the seam writes `"phase": "0"`
  where the hand-written file wrote `"phase": "0 (task: declines-off-the-tracker)"`,
  leaving the directory path as the record's only statement of what it settles.
  Evidence: `cadence-core/bin/planning/adjudication.mjs:183-213` against
  `.planning/tasks/declines-off-the-tracker/ADJUDICATION-risk_surface-declines-off-the-tracker.json:1-14`.
- D-08 (The converse guard rides this phase): `--phase <N != 0> --task <slug>`
  is refused. `cadence-core/bin/planning/core.mjs:672-680` guards only the
  phase-0 direction, and the fix is a few lines beside the guard the same
  commit already added. Evidence: measured 2026-09-01, `adjudication --phase 2
  --task some-slug` with `phases/2/` present answered `ok:true` and wrote to
  `tasks/some-slug/`, leaving phase 2's own sibling REVIEW unsettled;
  corroborates the `CAPTURE.md` item raised medium and ruled survived in
  `ADJUDICATION-risk_surface-cad-task-f860560e-r2.json`.
- D-09 (The id rides a structured flag): The authorization id is a declared
  flag on the event, never a substring of `--detail`, on the `--agent-id`
  precedent - `{required:false, type:'string', value:'refuse', bare:'refuse'}`
  at `cadence-core/bin/lib/arg-contract.mjs:1004`, listed in
  `TRACE_STRING_FLAGS` at `cadence-core/bin/planning/trace.mjs:472`, written
  present-only-when-real at `:1063`. The standing rule is stated twice for
  exactly this reason: `cadence-core/bin/planning/risk-check.mjs:698-702`
  records that on this repository's 35 `outcome/adjudication` events the
  trigger is spelled four different ways in free text, and
  `planning/trace.mjs:746-749` repeats it.
- D-10 (Shape (a) changes no reader): Exactly two things join on a correlation
  id - `risk-check status`'s `rowKey(corr, plan)`
  (`planning/risk-check.mjs:538,627,722,782`) and `trace-suggest`'s `corrOf`
  (`lib/trace-suggest.mjs:328,346,364-371`) - and a receipt written under the
  window it names joins by construction under both. If wrong: a reader silently
  drops the receipts shape (a) exists to make writable.
- D-11 (An explicit older corr survives the reader): The pre-anchor repair at
  `cadence-core/bin/lib/trace.mjs:1555` fires only when `e.corr === p`, the bare
  form, so an event carrying an explicit earlier id is not rewritten. `:1487`
  shows `renderTrace` filters by phase and never by corr, and `:1378`'s
  `out.corr` is a header naming the newest anchor rather than a filter, so the
  receipt still renders.
- D-12 (The suggest reader is NEW work): "`/cad-suggest` counts decisions
  rather than writes" is not a retarget of an existing counter - nothing in the
  tree counts `override` events except the gate.
  `cadence-core/bin/lib/trace-suggest.mjs:340-388` reads exactly four event
  shapes (`outcome/adjudication`, `outcome/rearm`, `routing/resolve`,
  `lifecycle/checkpoint`); its only other `override` string is
  `model.overrides.*` at `:628`, an unrelated config key, and
  `cadence-core/bin/lib/read-trace.mjs` names no outcome event at all. So
  `override` reaches one consumer today, `FIRE_RECEIPTS` at
  `planning/risk-check.mjs:381`.
- D-13 (Prose growth costs a budget re-pin): The files this phase touches sit
  EXACTLY at their ceilings, measured 2026-09-01 - `references/triage-gate.md`
  24,693/24,693 (`weight-budgets.json:51`), `references/review-triggers.md`
  21,718 (`:43`), `workflows/task.md` 16,483 (`:81`),
  `references/review-record.md` 8,535 (`:42`). Any added sentence re-pins its
  row in the same commit or `self-verify` reports `budget-overrun`
  (`cadence-core/bin/self-verify.mjs:797-821`; a shrink is free). This is phase
  1's D-14 re-confirmed against this phase's file set.
- D-14 (One prose writer, and no DOCS-CLAIMS row): `references/triage-gate.md:109`
  is the only line in `cadence-core/**/*.md` that issues an override-receipt
  command - `workflows/execute.md:356,418` and `references/risk-surface.md:29`
  mention overriding but issue nothing - and `.planning/DOCS-CLAIMS.md` holds
  no row asserting that line's flag set (DEBUG-06, EXECUTE-24, TASK-11, PLAN-51
  and VERIFY-53 all assert the re-arm cap instead). So the flag addition moves
  one prose line and re-adjudicates no claim, unlike phase 1's D-13.
- D-15 (A new flag must move three things at once): `self-verify.mjs:648-656`
  raises `unknown-flag` for any flag named in prose that the arg-contract row
  does not declare, and `lib/arg-contract.mjs:939-959` declares no anchor flag
  on `trace append` today. The flag, its contract row and the prose line
  naming it land in one commit or the suite goes red.

## Acceptance criteria

- [ ] AC1: `.planning/tasks/declines-off-the-tracker/ADJUDICATION-risk_surface-declines-off-the-tracker.json`
      is a file the seam produced. It holds no `note` field, it holds a `task`
      field naming the slug, and it holds the `base_id`, `head_id`, `citations`
      and per-entry ids the hand-written file lacks.
- [ ] AC2: `planning.mjs adjudication --phase 2 --task some-slug` on a tree
      where `phases/2/` exists answers `ok:false`, and `--phase 0 --task <slug>`
      still answers `ok:true`.
- [ ] AC3: A receipt carrying `--survivors 999` against a record under
      `.planning/tasks/<slug>/` is refused with `count-disagreement`, the same
      refusal the identical record under `phases/<N>/` already produces. The
      same call against a record under `deferred/<N>/` still omits the check.
- [ ] AC4: `planning.mjs trace append` accepts a flag naming an anchor, its row
      is declared in `cadence-core/bin/lib/arg-contract.mjs`, and an
      `outcome/adjudication` written under an earlier phase window's corr
      appears in `trace render` for that phase and is joined by
      `risk-check status` for that range.
- [ ] AC5: Two `outcome/override` events written on one authorization carry the
      same authorization id; two written on two authorizations carry different
      ones. The id is absent, not empty, on an event written without one.
- [ ] AC6: A fired range carrying no receipt of its own stays `ok:false` under
      `risk-check status` even when a receipt naming the same authorization id
      settles a different range.
- [ ] AC7: `node cadence-core/bin/test.mjs`, `npx tsc -p tsconfig.ci.json` and
      `self-verify` all pass, with every edited file's `weight-budgets.json` row
      re-pinned in the same commit.

## Flagged assumptions

- The corpus cannot settle OQ-1 on frequency, and D-01 was decided on blast
  radius instead - Likely. Measured 2026-09-01 with a loose replication of
  `settledBy` (corr + plan + base-prefix + head-prefix, no `inCycle` and no
  completed-bracket requirement, so it OVERSTATES), 39 of 170 fired ranges
  across `/code/{cadence,smithers,verbatim}` carry no matching receipt - 29, 8
  and 2 - and of those 39 exactly ONE is stranded only by a corr mismatch. The
  Case A failure mode is invisible after the fact precisely because the
  hand-append repairs it, which is why the duplicate-receipt artifact is the
  better proxy: exactly one real cross-corr duplicate group exists in all three
  repos, `adjudication|risk_surface|plan 4|b51f6f5|c12e0dd|3/3/1` under both
  `3-d887404` and `3-718062f` in smithers - the two hand-appends `GH-227` cites
  at 14:07:37Z and 14:10:13Z. If wrong: shape (a) is built for a case rarer
  than the flag costs, but it breaks nothing.
- The spelling of the anchor flag (`--corr` vs `--anchor`) and whether it
  belongs on `trace append` alone or also on the adjudication writer - left to
  the planner. D-15 fixes what must move together, not what it is called.
- Whether `cadence-core/bin/lib/report-rotation.mjs:15`, which restates the corr
  derivation in a comment, counts as a third surface owing a matching sentence -
  Unclear; the analyzer raised it as an alternative to D-10. If wrong: a comment
  describes a derivation the flag can now bypass, which misleads a reader
  without changing behaviour.
