---
phase: 1
plan: 2
requirements:
  - CST-04
files:
  - cadence-core/bin/planning/trace.mjs
  - cadence-core/bin/lib/trace.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/planning-lease-check.test.mjs
  - cadence-core/bin/phase-spelling.test.mjs
  - cadence-core/workflows/report.md
  - cadence-core/bin/weight-budgets.json
---

# Phase 1: Every review fire is bracketed and priced - Plan 2

## Goal

A review fire appears in the routing ledger exactly once and carries what it
cost. This plan carries the spend PLAN-1 recorded out to where a human reads
it: the default `trace render` envelope grows a provider-spend projection, and
`/cad-report` grows a reviewer row fed from it.

## Must be true when done

- `trace render` without the `events` flag returns a provider-spend figure with
  a call count for a scope holding provider calls, and the byte-identical
  envelope it returns today for a scope holding none.
- A provider event carrying no usage raises an unrecorded count rather than
  contributing a zero to the figure.
- No provider usage figure reaches any `roles` total: `roles` on a record
  holding provider usage is deep-equal to `roles` on the same record with every
  usage key stripped.
- `/cad-report` on a phase holding provider reviews and zero `cad-reviewer`
  lifecycle dispatches prints a reviewer row carrying a cost figure, not an
  empty one, in its own denomination and never added to the token line above it.
- `node cadence-core/bin/test.mjs`, `npx tsc -p tsconfig.ci.json` and
  `node cadence-core/bin/self-verify.mjs` all pass, with `report.md`'s
  `weight-budgets.json` row re-pinned if the edit grew it and every census this
  plan's declared work moved re-pinned in the same commit.

## Context

CONTEXT.md's decisions bind both tasks here. The load-bearing ones: provider
usage is a DIFFERENT denomination that stops at the `provider/request` event and
never sums into `roles` (D-01); the report row is a NEW surface fed from
provider events rather than a row in the existing Dispatches table, because a
cross-model-only phase has zero `cad-reviewer` brackets to make a row from
(D-15); an absent usage stays absent rather than becoming a zero (D-11).

This plan reads the usage keys PLAN-1 task 1 put on the `provider/request`
event; it must run after PLAN-1. Out of scope here: the provider seam itself
(PLAN-1) and every prose surface that becomes false once usage lands (PLAN-3).

## Tasks

### Task 1: Expose provider review spend on the render `/cad-report` reads

- **Files:** cadence-core/bin/planning/trace.mjs (the `trace render` envelope,
  at the `full = 'events' in opts` branch), cadence-core/bin/lib/trace.mjs
  (`renderTrace` and the `TraceRender` typedef), cadence-core/bin/trace.test.mjs
  (which also holds the `trace-refusal-sentences` census, at the test named
  `the four refusing trace flags carry ONE sentence each, in one map`),
  cadence-core/bin/self-verify.test.mjs (the `self-verify-merge-layers` census,
  at the test named `check 12: the live tree is NINETEEN callsites over FOURTEEN
  files, each in an arm`), cadence-core/bin/planning-lease-check.test.mjs (the
  `planning-detail-sites` census, at the test named `source: planning.mjs's
  no-staged-set detail goes through redactUrl`),
  cadence-core/bin/phase-spelling.test.mjs (the `phase-spelling-callsites`
  census - the `CALLSITES` table and the test named `census: every
  phase-argument callsite under planning/ carries a disposition`)
- **Action:** Without the `events` flag the render response carries `brackets`
  plus the `outcome`-family projection only, so provider events reach
  `/cad-report` nowhere and the workflow is forbidden from asking for the raw
  array on the one path that reads a record into a model's context. Give the
  default response a provider-spend projection derived from the
  `provider/request` events in scope, reading the usage keys PLAN-1 task 1 put
  on that event. FOLD it - a summed figure with a call count, plus a separate
  count of calls whose event carried no usage - rather than passing the provider
  events through: response size is the whole reason the array is withheld, and
  this repository's own record holds 293 of them. Use the conditional-key
  discipline `roles`, `coordinator`, `mismatched` and `rotated` already follow:
  the key is absent entirely when the scope holds no provider call, so every
  reader already parsing this envelope sees a byte-identical response on a
  record without one, and a call with no usage lands under the unrecorded count
  rather than as a zero. This figure is its own denomination and never touches
  `roles`: `roles.tokens` must stay byte-identical with and without it, which is
  the rule the two cache keys already follow and the `TraceRender` typedef
  already states under "They stop HERE either way" (D-01). Both source files are
  declared because either the renderer or the command envelope is a defensible
  home - put the fold beside the existing `outcomes` projection or beside the
  `roles` accumulation rather than in a third place a reader must learn about,
  and document the denomination rule where the typedef states it for the cache
  figures. `cadence-core/bin/planning/trace.mjs` is a subject of four censuses,
  three of which are held by files declared above purely so this task can re-pin
  them in the same commit; whichever of them this edit moves is re-pinned here,
  and one that did not move is left exactly as it stands: (a)
  `self-verify-merge-layers`, if the edit adds or removes a line matching
  `mergeLayers(` - re-pin check 12's two `assert.equal` totals, the spelled-out
  numbers in its title and the `asserts:` text on its `CADENCE-CENSUS` marker;
  (b) `planning-detail-sites`, if the edit adds or removes a caught-error
  `detail` built with this seam's `e && e.message ? e.message : String(e)` idiom
  - re-pin both counts in that test, and wrap the new site in `redactUrl` if it
  is a git-failure or provider-authored string as that test's own comment
  requires; (c) `phase-spelling-callsites`, if the edit adds or removes a
  phase-argument callsite under `cadence-core/bin/planning/` - add or delete its
  `CALLSITES` row naming its disposition and why, then re-pin the four
  `assert.equal` counts and the marker's `asserts:` text; (d)
  `trace-refusal-sentences`, held by `trace.test.mjs` itself, if the edit adds a
  second copy of any refusing trace flag's sentence - which it should not, and a
  red row there means a sentence was duplicated rather than a census gone stale.
  Do not edit `cadence-core/bin/lib/census-registry.mjs` - it is not declared
  here, and no test compares its row prose to the live counts.
- **Verify:** `node --test cadence-core/bin/trace.test.mjs` passes with new cases
  proving: a rendered phase holding provider events with usage returns a
  provider-spend figure and a call count; a phase holding no provider call
  returns the envelope it returns today, with the key absent; a provider event
  carrying no usage raises the unrecorded count and contributes no zero to the
  figure; and `roles` on that same record is deep-equal to `roles` on the same
  record with every usage key stripped. `node --test
  cadence-core/bin/self-verify.test.mjs`, `node --test
  cadence-core/bin/planning-lease-check.test.mjs` and `node --test
  cadence-core/bin/phase-spelling.test.mjs` each pass with their census counts
  matching the shipped tree. `node cadence-core/bin/test.mjs` and
  `npx tsc -p tsconfig.ci.json` pass.

### Task 2: Give `/cad-report` a reviewer row carrying a real cost

- **Files:** cadence-core/workflows/report.md (the `read_record` list of what the
  scratch render carries, and the `compose` shape block plus its rules),
  cadence-core/bin/weight-budgets.json
- **Action:** The Dispatches table is one row per `brackets` entry, so a phase
  whose reviews all ran cross-model has no row to make a reviewer line from -
  measured 2026-09-01, `/code/verbatim` phases 5-8 hold 4, 4, 5 and 4 provider
  reviews against zero `cad-reviewer` dispatches each (D-15). Add a reviewer
  line to the `compose` shape fed from the provider-spend projection task 1 of
  this plan put on the render, read out of the scratch file by the same guarded
  `node -e` field read every other line uses - the two carried literals first,
  then `scratch-stale`, `scratch-unreadable` and `scratch-shape` on stderr with a
  non-zero exit - never a whole-file read-back and never the raw `events` array.
  State the figure in its own denomination and say what it is: a provider-reported
  input+output count off the wire, never added to the "Tokens on subagent
  returns" line above it, which is a host-reported final-window proxy (D-01). A
  call whose event carried no usage counts as `unrecorded`, never zero, and a
  scope holding no provider call prints no reviewer line at all rather than an
  empty one - the same silence the `coordinator` block already gets. Name the
  new render key in `read_record`'s list of what the scratch file carries, so
  the workflow's own inventory stays true. Re-pin `report.md`'s
  `weight-budgets.json` row in this same commit if the edit grew it past
  20801 B; the check is a ceiling, so a file that shrank needs no row change
  (D-14).
- **Verify:** `node cadence-core/bin/test.mjs` and
  `node cadence-core/bin/self-verify.mjs` pass, with `self-verify` reporting no
  `budget-overrun` for `report.md`. (human-verify: this workflow is
  model-executed prose with no executor, so run `/cad-report <N>` THREE times,
  once per case, since the listed automated commands execute none of this prose:
  (a) on a phase holding provider reviews WITH recorded usage and zero
  `cad-reviewer` lifecycle dispatches - confirm the printed reviewer line carries
  a cost figure rather than being absent or empty; (b) on a phase whose provider
  events carry NO usage key - confirm the reviewer line reads `unrecorded` and
  never `0`, which is what a missing value defaulted to zero would print; and
  (c) on a scope holding no provider call at all - confirm NO reviewer line is
  printed, rather than an empty one, the same silence the `coordinator` block
  already gets.)

## Notes

**Sequencing - this plan runs SECOND, and the phase's three plans are
sequential, never parallel.** PLAN-1, then PLAN-2, then PLAN-3. All three
declare `cadence-core/bin/weight-budgets.json`, this plan and PLAN-3 both
declare `cadence-core/workflows/report.md`, and this plan and PLAN-1 both
declare `cadence-core/bin/self-verify.test.mjs`, so `plan-overlap` reports
overlaps and `/cad-execute` routes sequential on its own. The order is a real
dependency: task 1 here folds the usage keys PLAN-1's seam change writes, and
PLAN-3's task 4 states that the cross-model spend "is reported on the reviewer
line", which is only true once task 2 here has landed.

**Why the three census holders are declared.** `lease-check --plan-time` refuses
a plan whose declared work can move a hand-maintained count without declaring
the file holding it. `cadence-core/bin/planning/trace.mjs` is a subject of the
`self-verify-merge-layers`, `planning-detail-sites` and `phase-spelling-callsites`
censuses, so their three holders ride in this plan's lease and task 1 undertakes
the re-pin. They are read only if the edit moves one of those counts.
