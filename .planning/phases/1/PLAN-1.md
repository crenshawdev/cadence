---
phase: 1
plan: 1
requirements:
  - CST-04
files:
  - cadence-core/bin/review-provider.mjs
  - cadence-core/bin/review-provider.test.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/references/provider-api.md
  - cadence-core/references/seam-review-provider.md
  - cadence-core/bin/weight-budgets.json
---

# Phase 1: Every review fire is bracketed and priced - Plan 1

## Goal

A review fire appears in the routing ledger exactly once and carries what it
cost. This plan lands the half everything else in the phase reads from: the
provider seam records the usage the provider reported on its own event, and the
two maintained artifacts that describe that seam say what it now carries.

## Must be true when done

- A provider review's `provider/request` event carries the usage the provider
  reported, as both a normalized input/output pair and the provider's own raw
  usage object. A response that carried no usage writes neither key - never a
  zero.
- A call that burned its budget and came back unusable - `no-output`,
  `bad-json`, `bad-shape` - records the usage it burned, not `ok` alone.
- No provider usage figure reaches any `roles` total: `renderTrace` over a
  record whose only token figures came off provider usage still reports
  `cad-reviewer` under `roles` as `unrecorded`.
- Each provider section of `references/provider-api.md` names the same usage
  field that provider's adapter reads, and `references/seam-review-provider.md`
  states what the event now carries and that it is a provider-reported off-the-wire
  count rather than the host's final-window figure.
- `node cadence-core/bin/test.mjs`, `npx tsc -p tsconfig.ci.json` and
  `node cadence-core/bin/self-verify.mjs` all pass, with every grown reference's
  `weight-budgets.json` row re-pinned in the commit that grew it.

## Context

CONTEXT.md's decisions bind both tasks here. The load-bearing ones: provider
usage is a DIFFERENT denomination that stops at the `provider/request` event and
never sums into `roles` (D-01); the event records both a normalized pair and the
raw provider object (D-02); extraction belongs in `callStructured`, the only
frame holding the raw response (D-03); usage is recorded on the degraded
outcomes that still burned the call (D-04); an absent usage omits the key
(D-11); `provider-api.md` and `seam-review-provider.md` sit exactly at their
weight ceilings (D-14).

Out of scope here: the render projection and the `/cad-report` reviewer row
(PLAN-2), and every prose surface that becomes false once usage lands (PLAN-3).

## Tasks

### Task 1: Record the usage a provider returned on the `provider/request` event

- **Files:** cadence-core/bin/review-provider.mjs (`ADAPTERS`, `callStructured`,
  `traceProvider`, the `bad-shape` sites in `cmdReview` and `cmdConsult`),
  cadence-core/bin/review-provider.test.mjs,
  cadence-core/bin/self-verify.test.mjs (the `self-verify-merge-layers` census -
  the `CADENCE-CENSUS` marker line and the test named `check 12: the live tree is
  NINETEEN callsites over FOURTEEN files, each in an arm`)
- **Action:** Each of the three adapters gains a usage reader beside its
  existing `extractText`, reading the usage the provider returned off the raw
  response. The three field names and shapes are unverified in this tree -
  `references/provider-api.md` documents none, no fixture carries one, and 366
  live provider events measured 2026-09-01 hold none - so confirm each against
  the provider's own current documentation (OpenAI Responses `POST /v1/responses`,
  Gemini `generateContent`, DeepSeek chat completions) before writing the
  reader. Extraction happens in `callStructured`: it is the only frame holding
  the raw response, which `adapter.extractText` consumes and the frame then
  discards, while `traceProvider` receives `meta` alone and never sees a
  response (D-03). The event carries BOTH a normalized input/output token pair
  and the provider's own raw usage object - the pair is what a reader sums
  across a mixed-provider panel, the raw object is what an auditor joins back to
  the wire with no translation table (D-02). A response carrying no usage writes
  NEITHER key, never a zero: the present-only-when-real shape `redactions` and
  `config_warnings` already take on this event (D-11) - if this is got wrong,
  every pre-change event in a live record reads as a call that cost nothing.
  Record usage on the degraded terminal outcomes that still burned the call -
  `no-output`, `bad-json` and `bad-shape` - as well as on `ok`; `http` and every
  pre-request refusal (`no-key`, `bad-payload`, `bad-provider`, `bad-args`,
  `over-cap`) have nothing to read (D-04). Keep `traceProvider`'s contract
  intact: it never throws, never writes to a stream and never touches the
  caller's envelope, so a usage read that fails must not change what the caller
  sees, and the seam must still write exactly ONE event per call. Sum none of
  this into a per-role total (D-01). `review-provider.mjs` is a subject of the
  `self-verify-merge-layers` census, and it is the ONE file in that census's arm
  (b) - its header carries the `mergeLayers warnings[]:` marker, which is what
  keeps its callsites clean without destructuring `warnings`. If this edit adds
  or removes a line matching `mergeLayers(`, re-pin the census in the same
  commit: the two `assert.equal` totals in check 12, the spelled-out numbers in
  that test's title, and the `asserts:` text on its `CADENCE-CENSUS` marker line.
  Do not edit `cadence-core/bin/lib/census-registry.mjs` - it is not declared
  here, and no test compares its row prose to the live count.
- **Verify:** `node --test cadence-core/bin/review-provider.test.mjs` passes with
  new cases proving: PER ADAPTER - once for `openai`, once for `gemini` and once
  for `deepseek`, each against a fixture shaped like THAT provider's own
  documented usage response - a fixture response carrying usage writes one
  `provider/request` event holding both the normalized pair and the raw object,
  so a reader spelling one provider's usage field wrong fails a test rather than
  agreeing with a doc that repeats the same mistake; the same call against a
  fixture with no usage writes an event holding neither
  key, asserted as absence (`in` returning false, the shape the existing
  no-`--trigger` test already uses) and not as zero; EACH of the three degraded
  terminal outcomes D-04 names - `no-output` (a response with no output text),
  `bad-json` (output that is not JSON) and `bad-shape` (a response that parsed
  but failed `validateFindings`) - still records the usage it burned, one case
  per outcome, since a usage read discarded on an early return is invisible to a
  `bad-shape` case alone; and `renderTrace`
  over that same temporary `.planning` reports `cad-reviewer` PRESENT under
  `roles` with its token total `unrecorded` (AC4 stated positively - an assertion
  that merely finds no token figure passes vacuously when the role is missing
  altogether), and no provider usage figure under any role's total.
  `node --test cadence-core/bin/self-verify.test.mjs` passes with
  check 12's totals matching the shipped tree. `node cadence-core/bin/test.mjs`
  and `npx tsc -p tsconfig.ci.json` pass.

### Task 2: Document the usage the seam now reads, on the wire and at the seam

- **Files:** cadence-core/references/provider-api.md (the OpenAI, Gemini and
  DeepSeek review sections), cadence-core/references/seam-review-provider.md
  (the degradation and `redactions` bullets), cadence-core/bin/weight-budgets.json
- **Action:** `provider-api.md` is the maintained wire artifact - it states that
  a provider API change updates the adapter in the script AND this file together
  - and today documents no usage field for any of the three. Add each provider's
  usage response shape beside the output-text path already stated in that
  provider's own section, verified against the same live documentation task 1's
  readers were written from, so the two agree field for field. In
  `seam-review-provider.md`, state what the `provider/request` event now carries
  on the same written-only-when-real rule it already states for
  `redactions: <n>`, and say what the figure is: a provider-reported input+output
  count off the wire, not the host's final-window figure, so a reader cannot mistake
  it for something summable with a role total. Re-pin both rows in
  `weight-budgets.json` in this commit - both files sit exactly at their ceilings
  (3,666 and 6,304 B measured 2026-09-01), so any added sentence overruns
  without it (D-14).
- **Verify:** `node cadence-core/bin/self-verify.mjs` reports no
  `budget-overrun` and no `unbudgeted-surface`, and each provider section of
  `provider-api.md` names the same usage field that provider's adapter reads in
  `cadence-core/bin/review-provider.mjs`.

## Notes

**Sequencing - this plan runs FIRST, and the phase's three plans are
sequential, never parallel.** PLAN-1, then PLAN-2, then PLAN-3. All three
declare `cadence-core/bin/weight-budgets.json`, PLAN-2 and PLAN-3 both declare
`cadence-core/workflows/report.md`, and PLAN-1 and PLAN-2 both declare
`cadence-core/bin/self-verify.test.mjs`, so `plan-overlap` reports overlaps and
`/cad-execute` routes sequential on its own. The order is a real dependency and
not a preference: PLAN-2's render projection folds the usage keys task 1 above
writes, and every PLAN-3 task that corrects a "no adapter extracts usage" claim
is stating a fact that only becomes true once task 1 has landed.

**Why three plans rather than one.** One plan's `files:` list is the read set a
single executor dispatch is handed, and the phase's fifteen declared paths came
to 1,167,416 bytes against a 675,000 ceiling - and that was before the three
census holders `lease-check --plan-time` requires (135,145 + 42,671 + 27,339 B).
The split is by byte capacity first and dependency order second; the task
decomposition is unchanged from the plan the coordinator accepted.

**Usage field names are verified at implementation time, not here.** No fixture
in `review-provider.test.mjs`, no line of `references/provider-api.md` and none
of the 366 live provider events measured across `/code/cadence`, `/code/smithers`
and `/code/verbatim` on 2026-09-01 carries a usage object, so the corpus cannot
be sampled for the shape. Task 1 confirms each name against the provider's
current documentation before writing the reader; task 2 writes the same names
into `provider-api.md`. If a name is missed, D-11 makes the miss visible as an
absent key rather than as a false zero.

**Whether a provider returns usage on a degraded response is unknown.** If a
provider returns none on `no-output` or `bad-json`, task 1's rule is reachable
prose on `bad-shape` alone. The signature change buys less than it appears to in
that case, but it records nothing false either way.
