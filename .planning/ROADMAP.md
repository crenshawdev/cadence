# Roadmap

## Overview

**`v3.1.0 — Cadence meets outside work`, opened 2026-08-12.** Scoped from the
v3.0.0 backlog and the first external-project dogfood run: verbatim, a Rust
project with no Cadence history, taken from `/cad-new-project` through a
verified phase 1 under the retuned defaults. That run is the evidence this
cycle is built on, and it exposed two gaps of a kind Cadence auditing Cadence
could never surface.

**The first gap is the front door.** `/cad-new-project` assumes a blank page.
Verbatim arrived with a design brief from a freeform discovery session, and
the questioning re-asked things the brief had already settled — its first
commit is literally "restart from the design brief". Every other project that
tries Cadence arrives with something worse: an existing repo, a messy history,
and no way in at all. `ADP-01` and `BRF-01` are that door, and `XCP-01` is the
same theme from the other side — friction noticed while using Cadence on
somebody else's project, reaching Cadence's own queue instead of the host's.

**The second gap is in the receipts.** v3.0.0 shipped `trace suggest` and
`/cad-report` on the claim that the run record prices the work. It prices the
subagents: verbatim phase 1 recorded ~968k subagent tokens across seven
dispatches. It does not price the coordinator, which was half of the original
cost spiral, and it never asks whether the single most expensive dispatch in
the spine — the assumptions analyzer, 75k on phase 1 and 132k on phase 2 —
was worth buying for this phase at all. `TRC-01` and `SIZ-01` close those,
and they go first: they sharpen the evidence every later judgment in this
cycle is made on.

**`MIN-01` returns because its objection expired.** It was deferred out of two
cycles for adding resident prose to the dispatch path. v3.0.0's own deferral
machinery is the answer — branch-local lens prose rides behind a `Read` at the
step that needs it, watched by check 13 — so the reason to hold it is gone.
`CTW-06` is the re-measured remnant of the v2.6.2 byte work, riding wherever
its files are already open.

## Phases

- [x] **Phase 1: The accounting the trace still misses** - the coordinator's own spend reaches the record, and the spine's most expensive dispatch stops being bought unasked
- [x] **Phase 2: The front door** - Cadence initializes from an existing repo, and from a design brief a freeform conversation already produced
- [ ] **Phase 3: The lens and the loop back** - over-building gets named at build and review time, Cadence-directed friction reaches Cadence's own queue, and the tuner that reads the run record gets a front door

## Phase Details

### Phase 1: The accounting the trace still misses
**Goal:** The run record prices the coordinator as well as its workers, and no
phase buys the analyzer pass without the sizing question `/cad-plan` already asks.
**Depends on:** Nothing
**Requirements:** TRC-01, SIZ-01
**Success Criteria:**
1. A completed phase's `trace render` carries coordinator-side events alongside the worker brackets, and every figure in them is one the coordinator can actually know - no fabricated token count. Calibrated against verbatim's phase-1 trace, which exists on disk as the fixture.
2. `/cad-report`'s record-health line and `trace suggest`'s evidence floors consume the new events rather than ignoring them; a trace written before this phase still renders and still suggests, unchanged.
3. `/cad-context` settles phase scope BEFORE dispatching the assumptions analyzer, and a phase small enough, or already grounded by a prior phase's deviations, reaches its CONTEXT.md through the conversational fallback with no analyzer dispatch in the trace.
4. A phase that genuinely needs the pass still buys it: verbatim phase 2's shape (six surfaces, 20 decisions, four gray areas the code could not close) resolves to dispatch, not skip.

### Phase 2: The front door
**Goal:** A project that already exists - as a repo, or as a design brief from a
freeform conversation - can enter Cadence without pretending to be a blank page.
**Depends on:** Nothing
**Requirements:** ADP-01, BRF-01
**Success Criteria:**
1. `/cad-adopt` on a brownfield repo with no `.planning/` writes PROJECT.md, REQUIREMENTS.md and a remaining-work ROADMAP.md derived from the code and git history, and the result passes `/cad-health` and seeds Traceability through the existing seams with no downstream command changed.
2. Adopt's questioning asks only what the code cannot answer: a repo whose README, manifest and history already state the goal, stack and constraints does not get asked about them again.
3. `cad-new-project --brief <file>` reads a design brief and asks only what the brief leaves open. Replayed against verbatim's own `DESIGN-BRIEF.md`, the settled decisions are not re-asked.
4. A `docs/` page documents the discovery workflow (freeform conversation, then design brief, then `--brief` init) and what a good brief answers, linked from the README's getting-started path. It stays a page of guidance, never a scripted interview - the discovery works because it is freeform.

### Phase 3: The lens and the loop back
**Goal:** Code that works and should not exist gets named at the two points it can
be caught, friction with Cadence found on somebody else's project reaches
Cadence, and the recommendations the run record already produces are reachable
by name instead of by footnote.
**Depends on:** Phase 1 (its deferral and receipts surfaces are what keep this phase's prose off the dispatch path and priced, and TRC-01's coordinator events are what `/cad-suggest`'s evidence floors are computed over)
**Requirements:** MIN-01, XCP-01, CTW-06, TUN-01
**Success Criteria:**
1. `cad-executor` ships the lean version and records the fuller option as an `Open items:` line in its report file rather than building it speculatively, and the prose that says so rides behind a `Read` at the step that needs it, anchored by a `lib/deferred-reads.mjs` register row.
2. A minimalism review pass returns a ranked delete-list - reinvented stdlib, single-implementation abstractions, dead flexibility, config nobody sets - and applies nothing. It is separate from the correctness reviewer, because an adversarial correctness review structurally cannot catch over-building: nothing it checks is wrong.
3. A Cadence-directed capture made from inside a host project lands in Cadence's own queue, not the host's, carrying the host project and the command that provoked it. The plan answers where that queue lives when Cadence is a read-only plugin cache rather than a checkout, what happens when the maintainer is not the user, and whether a cross-project capture needs redaction.
4. `skills/cad-land/SKILL.md`'s guardrails stop re-deriving the `git.auto_close` mechanic and `cad-executor-contract`'s static-analysis carve-out is stated once with a pointer, each surface re-pinned in `weight-budgets.json` in the same commit. The named keeps stand: the no-preselected-default block and the not-scoped-to-GitHub clause.
5. `/cad-suggest` is a discoverable skill (`skills/cad-suggest/SKILL.md`) that relays `planning.mjs trace suggest`, presents each recommendation with the trace figures behind it, writes no config itself, and names the `/cad-config` key for anything accepted. A trace too thin to clear the evidence floors gets a one-line refusal rather than an invented suggestion.
6. The command is registered where a user would look for it: `skills/cad-help`, `README.md` and `.planning/DOCS-CLAIMS.md`, with the README update carried as its own execution task rather than folded into another.
