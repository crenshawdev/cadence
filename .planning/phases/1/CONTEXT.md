# Phase 1: The capture queue stops dropping filed work - Context

Gathered: 2026-08-14
Feeds: /cad-plan 1

## Scope boundary

In: `CAP-01` in all four of its halves - the section a written bullet lands in,
the phase-tag reader's grammar, a `/cad-health` report naming any capture bullet
outside the recall walk, and a concurrent-append guard for `.planning/CAPTURE.md`.

Out: BM25 scoring and ranking changes; promoting any archived bullet back into
the live queue; what `/cad-plan` does with a recall result once it has one; the
five ids parked in REQUIREMENTS `## Deferred` (`LND-01`, `PRS-01`, `EVD-01`,
`RCL-06`, `CTX-02`); and phases 2-3 (`TRC-01`, docs truth), which touch the trace
record rather than the capture queue.

Deferred: None.

Plan shape: multiple plans, same phase - the write seam and the concurrency guard
land together (AC1, AC5); the reader grammar and the health report land together
(AC2, AC3, AC4). AC6 is a gate on both.

## Durable decisions

- D-01 (write path): The CAPTURE.md append moves out of skill prose and into a
  `planning.mjs` capture subcommand that `/cad-capture` calls. Today the append
  is the model holding `Write`/`Edit`, so criterion 1's "proved by a
  failing-capable test" has nothing to call. Evidence:
  `skills/cad-capture/SKILL.md:38-53`; `cadence-core/bin/planning.mjs:3301-3345`
  (no `capture` key in `COMMANDS`); `cadence-core/bin/self-verify.mjs:203-252`
  (no capture row in `CONTRACTS`); house precedent for the same move at
  `planning.mjs:3175-3179`.
- D-02 (write path): All three product writers of CAPTURE.md route through that
  seam - `/cad-capture`, `/cad-execute`'s summary open-items append, and
  `debt-harvest`. Two of the three are prose today and restate the bullet format
  independently. Evidence: `skills/cad-capture/SKILL.md:43-48`;
  `cadence-core/workflows/execute.md:378-384`; `planning.mjs:3142-3160`.
- D-03 (scope): `## Archive` and `## Debt markers` stay OUT of the recall walk.
  The fix is not "walk every section". Evidence:
  `cadence-core/references/conventions.md:53-55`; the archive block's own stated
  rationale at `.planning/CAPTURE.md:238-250`. Measured 2026-08-14: widening the
  walk would re-admit 185 deliberately retired bullets into the BM25 corpus,
  undoing v2.6.0 phase 1 in full.
- D-04 (grammar): Criterion 2 is met by widening the READER, with the grammar
  written down and a test row per shape - not by narrowing the writer alone.
  Measured 2026-08-14 over 375 bullets: 45 bullets already inside the walk carry
  a leading parenthetical the reader drops (`(vX.Y.Z phase N)` x32,
  `(cadence-wide)` x6, `(phase N, <label>)` x2, `(vX.Y.Z close)` x2, `(tooling)`
  x2, `(phase N, vX.Y.Z)` x1), so a writer-only narrowing leaves them wrong.
  Evidence: `cadence-core/bin/lib/planning-files.mjs:688-697`;
  `.planning/PROJECT.md:174` ("a grammar is written down, tabled, and tested per
  row"); shape precedent at `cadence-core/references/roadmap-phases.md:1-13` with
  `PHASE_LIST_ROWS` at `cadence-core/bin/planning-files.test.mjs:444` and its row
  loop at `:582`.
- D-05 (grammar): A leading parenthetical that is not a phase tag is CONTENT and
  survives into the indexed text - the widening may not be a greedy
  `^\([^)]*\)` strip. Evidence: 24 bullets carry `(cadence-wide)` or `(tooling)`
  as their only scope marker; `parseCaptureSnippets` feeds BM25 directly at
  `planning.mjs:1787-1791`, `1795`.
- D-06 (health): The out-of-walk report is an unconditional per-section count
  with NO allowlist. An allowlist of `Archive` + `Debt markers` would have
  reported nothing on the very incident that motivated this phase - all five lost
  bullets sat under `## Archive`. Evidence:
  `cadence-core/references/conventions.md:53-55`;
  `skills/cad-health/SKILL.md:110-114`; measured section counts (Archive 185,
  Debt markers 1) as the baseline a change moves against.
- D-07 (health): The check ships as a standalone subcommand that `/cad-health`
  calls beside `status`, NOT as a new `drift` kind inside `cmdStatus`.
  `cmdStatus` returns `no-planning-dir` / `no-roadmap` / `unparseable-roadmap`
  before any drift is computed, so folding it in means the trees most likely to
  have a mangled CAPTURE.md get no capture report at all. Evidence:
  `planning.mjs:263-280`, `:290-336`; attachment pattern at
  `skills/cad-health/SKILL.md:63-66` and `:28-31`; registries at
  `planning.mjs:3301-3345` and `self-verify.mjs:203-252`.
- D-08 (concurrency): `atomicWrite` is NOT modified. Its contract is explicitly
  crash-safety, not mutual exclusion, and the guard is built above it. Evidence:
  `cadence-core/bin/lib/planning-files.mjs:1802-1814` (the D-05 block: "no lock,
  no `O_EXCL` retry and no `fsync` here") and `:1841-1853`; 17 call sites across
  4 files inherit any change made inside it.
- D-09 (concurrency): No bare EOF `O_APPEND`. CAPTURE.md is sectioned markdown
  and an EOF append lands under the last heading - today `## Debt markers`, which
  is outside the walk - so the concurrency fix would reintroduce this phase's
  headline bug by construction. Evidence: the D-07 append precedent at
  `cadence-core/bin/lib/trace.mjs:23-36`; live heading order measured 2026-08-14
  (`## Todos` 3, `## Seeds` 209, `## Notes` 232, `## Archive` 238,
  `## Debt markers` 454).

## Decisions

- D-10 (surfaces): Every prose surface this phase grows carries its
  `weight-budgets.json` row change in the same work. Evidence:
  `cadence-core/bin/weight-budgets.json` (`skills/cad-health/SKILL.md` 6666,
  `skills/cad-capture/SKILL.md` 4839); enforcement at
  `cadence-core/bin/self-verify.mjs:752-775` (`unbudgeted-surface`,
  `budget-overrun`).

## Acceptance criteria

- [ ] AC1: A bullet written through the capture seam lands inside the recall
      walk, and `planning.mjs recall` returns it in the same session - proved by
      a test that FAILS when the bullet is written to a section outside the walk.
- [ ] AC2: The tag reader emits phase N for `(phase N)`, `(vX.Y.Z phase N)` and
      `(phase N, <label>)`; a written grammar lists every admitted and every
      out-of-grammar shape, with one test row per listed shape.
- [ ] AC3: A bullet whose leading parenthetical is a non-phase label
      (`(cadence-wide)`, `(tooling)`) is indexed with that label still in its
      text and no phase emitted - one test row per case.
- [ ] AC4: `/cad-health` names every CAPTURE.md section outside the recall walk
      with its bullet count, and appending a bullet to an out-of-walk section
      raises that section's reported count on the next run.
- [ ] AC5: Two writers appending concurrently to one CAPTURE.md either both land,
      or the loser gets a non-silent return saying its bullet did not land -
      asserted by a test that interleaves the two writers.
- [ ] AC6: `node --test cadence-core/bin/*.test.mjs` passes and
      `node cadence-core/bin/self-verify.mjs` reports no `unbudgeted-surface` and
      no `budget-overrun`.

## Flagged assumptions

- The losing writer is told by a returned reason rather than a throw - UNSETTLED,
  and the planner must pick with the trade-off stated. The codebase holds two
  opposing conventions for this file class: `atomicWrite` throws
  (`planning-files.mjs:1849`, justified at `:1823-1825`) while a record-keeping
  write never throws (`trace.mjs:38-41`), and `debt-harvest` already converts a
  write failure into `fail('write-failed')` at `planning.mjs:3156-3158`. If
  wrong: a `/cad-capture` that loses the race throws inside a workflow step whose
  prose does not handle it, and the user's sentence is lost with a stack trace
  instead of a retry - the same lost update, now noisy.
- Claude Code `Edit`/`Write` semantics under concurrent external modification -
  whether the harness staleness-checks between its read and its write, and
  whether it surfaces a failure skill prose can branch on. Unresolvable from this
  repo. If wrong: the prose writers cannot be guarded at all without D-01, which
  makes D-01 load-bearing for AC5 and not only for AC1.
- `O_APPEND` atomicity bounds on the filesystems Cadence ships to (ext4, APFS,
  NTFS via WSL, network mounts). Measured 2026-08-14: max bullet 2,561 B, p90
  1,077 B, median 518 B, none over 4,096 - so a one-bullet append sits under the
  usual `PIPE_BUF`, but `trace.mjs`'s own D-07 block states no size bound and
  this is an OS fact the repo cannot settle. Bears on D-09's replacement design.
- The guard reaches code writers only. Until D-02 lands, a hand or script edit
  racing the model - which is what the 2026-08-14 near-miss actually was - stays
  unguarded, so AC5 can pass its test while the field case remains open.
