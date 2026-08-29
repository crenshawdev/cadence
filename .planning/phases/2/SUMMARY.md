---
phase: 2
status: complete
completed: 2026-08-29
---

# Phase 2: Adaptive routing is reachable - Summary

Deleted `stakes` from the scaffolded config template so a newly initialised
project reaches the unset-`stakes` resolution `config.schema.json` documents,
and made both faces that report the level say which of the two states it is in
rather than reporting the schema default as a configured value.

## What shipped

- `stakes` removed from the scaffolded template - `cadence-core/templates/config.json`
- `stakes_set` on the `resolve` and `replay` envelopes, carried from
  `readConfig`'s own flag with no second derivation - `cadence-core/bin/route.mjs`
- An unset-`stakes` warning arm beside the existing `LEVEL_KEY` one, gated on an
  explicit read with no layer value - `cadence-core/bin/config.mjs`
- Both init workflows state that `stakes` is left unset and what unset resolves
  to, with their byte budgets re-pinned to the measured counts -
  `cadence-core/workflows/new-project.md`, `cadence-core/workflows/adopt.md`,
  `cadence-core/bin/weight-budgets.json`
- Four proofs from real resolver output rather than prose: both arms of the
  unset floor from a template-initialised repo, both set-nesses across `resolve`
  and `replay`, the three `config.mjs get` states, and the README's
  adaptive-routing claim held against a live resolve -
  `cadence-core/bin/route.test.mjs`, `cadence-core/bin/config.test.mjs`,
  `cadence-core/bin/prose-agreement.test.mjs`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 5fc6c6c0 | Stop the template pinning `stakes` before the resolver is asked |
| 1 | 2 | be3c7143 | Prove both arms of the unset floor from a template-initialised repo |
| 1 | 3 | 9dbd4482 | Carry `stakes_set` on the resolve and replay envelopes |
| 1 | 4 | eb850c78 | `config.mjs get stakes` answers unset instead of the default |
| 1 | 5 | 91f88026 | Both init workflows state that `stakes` is left unset |
| 1 | 6 | 289b9a34 | Hold the README adaptive-routing claim against a real resolve |
| 1 | AC7 repair | 99f5c5fd | Lift `why.test.mjs`'s commit window so the full suite is green |

## Deviations

- [deviation] AC7 (`node cadence-core/bin/test.mjs` green) failed on one test
  outside plan 1's lease. Task 1's commit `5fc6c6c0` is a new commit touching
  `cadence-core/templates/config.json`, which pushed commit `093408c9` from 6th
  to 7th in `why.mjs`'s `DEFAULT_TOP` window of 6, so
  `why.test.mjs:694` looked up a block no longer printed and `entryFor` returned
  `undefined`. Nothing about the record or its reader was wrong - the fixture's
  window closed. The executor checkpointed `structural` rather than widening its
  own lease. The user authorized the coordinator to make the repair through the
  ask-user seam: `cadence-core/bin/why.test.mjs` was declared in plan 1's
  `files:` list first, so `lease-check` still answered on the staged set, then
  `'--top', '20'` was added at `:695` exactly as the sibling test at `:192-195`
  already does for the same reason. Commit `99f5c5fd`.
- [deviation] Task 4's new warning arm was collateral to seven shipped
  layer-read tests that probed `config.mjs get` with `stakes` as an arbitrary
  key and count every warning: the new arm made them read 2 where they pin 1.
  Six switched to a `granularity` probe (the probe was arbitrary before and
  stays arbitrary); the retired-key test kept its deliberate `stakes` probe and
  now counts the `model.profile` family. Commit `eb850c78`.

## Open items

- The `self-verify-merge-layers` census is stale on `main` in two directions at
  once: the `CADENCE-CENSUS` marker at `cadence-core/bin/self-verify.test.mjs:1675`
  says "eighteen callsites over fourteen files", the live test name on the next
  line says "NINETEEN callsites over FOURTEEN files", and `lease-check`'s
  `asserted_by` field reported a third pair, "SEVENTEEN over THIRTEEN", which is
  in neither. No task in this phase moved the count, so none of them re-pinned
  it. The census that refused this plan until `self-verify.test.mjs` was declared
  does not agree with itself.
- That declaration raised this phase's executor rung from `high` to `xhigh`:
  `self-verify.test.mjs` contains a recursive delete, so the risk floor read the
  lease and escalated. A bookkeeping declaration bought a more expensive
  dispatch than the work required.

## Goal check

The goal is met. `cadence-core/templates/config.json` no longer carries the key
(`'stakes' in JSON.parse(...)` is `false`, verified against the working tree),
and the two arms the goal exists to make reachable are proved from real
`route.mjs resolve` output over a repo built from the shipped template rather
than from a hand-written config: a phase whose plans all read clean resolves
`solo`/`sonnet`, and a phase with an unreadable plan resolves `ok:true` at the
`shipped` default (`be3c7143`, `route.test.mjs`). Both arms were falsified
against a tree with `"stakes": "shipped"` restored, so neither would pass on the
broken tree this phase repairs. The README's adaptive-routing claim is now held
by a test that initialises from the template and asserts the resolved level is
strictly below `config.schema.json`'s `keys.stakes.default`, reading both the
default and the ordering out of the artifacts rather than hardcoding them
(`289b9a34`). AC7 is green: 3574 pass / 0 fail, and `self-verify` reports
`ok:true` with an empty `problems` array. Nothing in the phase's success
criteria is unmet. The `diff` review gate fired over the whole range and raised
one finding, refuted at `self-verify.mjs:815` - the byte budget is a ceiling
(`bytes > budget`), not an exact pin, so the template shrinking from 1420 to
1397 owes no re-pin, and the suite passing falsifies the claimed failure
directly. The `risk_surface` gate matched `untrusted_input` on four changed
`JSON.parse` lines, all in test files parsing this repository's own committed
artifacts or a subprocess's own stdout; the user overrode it on those grounds
and the receipt records them.
