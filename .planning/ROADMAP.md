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


## Phase Details
