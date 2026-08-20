# Roadmap

## Overview

**`v3.5.5 - a seam that accepts what it should refuse`, opened 2026-08-18.**
Scoped from the tracker milestone `v3.5.5`, which holds twelve issues: #137,
#142, #144, #147, #182, #183, #219, #220, #221, #222, #223 and #224. Six of
those (#219 through #224) were filed at the open, from a full audit of the
capture queue that re-verified each defect live rather than trusting its note.

**The theme is one sentence: an argument face that says yes to input it has a
rule against.** `v3.5.4` closed the shape for a control that reaches its path
and mis-answers. This cycle takes the door: a reader that accepts a malformed
value and answers as if it were well-formed, a guard that reads an empty string
as a configured one, a gate that cannot be satisfied by the key its own seam
document permits.

The first four phases are ordered by what a wrong answer costs, not by where the
code lives. Phase 1 carries the two that REMOVE a protection - one unprotects every
branch, the other lets one repository answer another's blocking gate. Phase 2
carries the readers that accept malformed input and answer anyway. Phase 3
carries the gates that fire on themselves or cannot be satisfied at all. Phase 4
is the structural form of phase 2, and goes last on purpose: a declarative
argument contract is only worth writing once the case-by-case fixes have said
what it has to express.

Phase 5 is not part of that theme and does not pretend to be. It is the README
restructure decided 2026-08-18, promoted into this cycle from the capture queue
rather than held for a docs milestone. It shares no code with the four defect
phases and depends on none of them.

The prune left the Overview describing `v3.5.4`; it now describes this cycle.

## Phases

- [ ] **Phase 1: The re-run that overwrites its own evidence** - `/cad-execute` refuses a phase that already executed, and a plan's per-task report becomes run-scoped so a second run cannot destroy the first run's record
- [ ] **Phase 2: The adjudication record nobody can recount** - a gate's per-finding rulings become an audit-grade `adjudication.json` beside the report, so survivor counts are recomputable and a refutation can be checked against the code it refuted

## Phase Details

### Phase 1: The re-run that overwrites its own evidence
**Goal:** Re-running an executed plan stops being both unguarded and
destructive: the locate step refuses a phase whose derived status is `executed`
and names the supported path, and `reports/plan-<k>.md` becomes run-scoped by
the correlation id that already exists, so two runs of one plan leave two
readable records instead of one.
**Depends on:** Nothing
**Requirements:** (seeded at /cad-context)

`#195` is two halves with one fix site each, and the pair is what makes it the
first phase of this cycle. Every other item scoped to `v3.5.6` costs a partial
mutation reported as success, which `/cad-audit` reports and a re-run repairs.
This one costs the evidence itself.

The first half: `cadence-core/workflows/execute.md`'s locate step stops on
unplanned and on missing plan files, and on nothing else. A phase whose cursor
status is `executed` is dispatched again exactly like a fresh one, a new
executor starting at task 1 against a plan whose tasks are already committed.
The within-run protections already read `reports/plan-<k>.md` for completed task
numbers so a continuation cannot repeat a finished task; that reasoning is
simply not applied across runs.

The second half: `skills/cad-executor-contract/SKILL.md` rewrites
`<plandir>/reports/plan-<k>.md` after every task commit and fixes the path with
no run component, so the second run's FIRST task commit overwrites the first
run's report before anything has read it. That report is the only per-task
record of what ran and what it printed. SUMMARY maps task to hash, the
risk-check record is keyed to the run, and the trace brackets carry the token
figure - every one of those is run-scoped or append-only EXCEPT the most
detailed one.

The correlation id is already unique per run and already derives from
`PHASE_START`, so the scoping key is in hand and costs nothing to adopt. The
blast radius is five sites that must move together: three read sites in
`execute.md` and two declarations in the executor contract, which is a preloaded
surface under a weight budget, so the shorter spelling is the cheaper one.

**Success Criteria:**

1. The suffix-picker's tests pass across three fixture states - no report
   present, one present, several already rotated - and mutating the picker to
   return the base name unchanged fails at least one case.
2. In a fixture plan directory, rotating twice leaves three readable reports,
   and the earliest one is byte-identical to its pre-rotation content.
3. A prose-agreement test asserts that `execute.md`'s locate step refuses derived
   status `executed` and `complete`, and that its `status` call is not under the
   `else` branch; the test fails when either is reverted.
4. `/cad-execute <N>` against a phase whose derived status is `executed` refuses,
   names `/cad-undo <N>` then `/cad-execute <N>`, and the phase trace records no
   executor dispatch for that invocation.
5. `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with an
   empty `problems` array, with `cadence-core/bin/weight-budgets.json` re-pinned
   in the same commit as the prose edits.
6. `/cad-report <N>` on a phase carrying a rotated report lists both reports.

### Phase 2: The adjudication record nobody can recount
**Goal:** An adjudication outcome stops being a sentence someone wrote. Each
gate fire writes one record per finding raised - the raising voice, the claim
and failure scenario VERBATIM, the base and head SHAs, and a ruling - so the
survivor count is derived by counting rulings instead of asserted in prose, and
a refutation can be audited by checking out the head SHA and opening the cited
file:line.
**Depends on:** Nothing
**Requirements:** (seeded at /cad-context)

Cadence's assurance claim is self-attested: it verifies its own mechanics with
its own mechanics. The evidence that would answer that already exists from
dogfooding, but in three inconsistent shapes, and the load-bearing one is prose.
`verifier-findings.json` is genuinely audit-grade - per-truth records whose
evidence names real commands and real numbers, which an auditor can rerun. That
is the shape to copy. `FINDINGS.json` is counters plus the entries the merge
discarded, so it carries no bodies for the findings that were KEPT. And the
adjudication outcome - the thing most worth proving - survives only as the
`detail` string on a trace event: "risk_surface plan-2: 6 survivors of 10 (4
downgraded to open items)". Nothing recounts it.

The sharpest case is a `gate_pass` where `openai/gpt-5.4-mini` returned a high
severity claiming a `restore()` had "no lock or revalidation", and it did not
survive grounding. A reviewer asserting something false and the machinery
catching it is the single best artifact Cadence has for its own "controls are
fallible machinery" claim - and it survives as a paragraph. The finding's file,
line and failure scenario were never preserved, so nobody can open the code and
judge the refutation. Cadence summarized its own gate instead of recording it,
which is the exact failure mode Cadence exists to prevent. The format is already
drifting between phases, too: a dogfooding phase 4 carries neither
`FINDINGS.json` nor `verifier-findings.json`, only `reports/*.md`.

The record is one `adjudication.json` per gate fire, written beside the report,
one entry per finding: the voice and model that raised it and the severity as
raised; `file`, `line`, the claim VERBATIM and the failure scenario VERBATIM -
never paraphrased, because the paraphrase is the tampering surface; `base_id`
and `head_id` as full SHAs (`risk_check` events already carry these, adjudication
events do not); and a `ruling` of `survived` | `downgraded` | `refuted`, where a
refutation carries the grounding counter-evidence and the code that contradicts
the claim, and a survivor carries its fix commit SHA. Chain of custody is
already free: `.planning/` is committed alongside the code it judges, so nothing
can be backdated.

The knock-on is free too. `/cad-report` already renders "what the gates caught,
what got refuted" from `trace.jsonl`, and today it narrates over prose it cannot
check. Fixing the record fixes the report.

NOT in scope: backfilling. Earlier phases kept counters rather than bodies, and
the structured data was never written for the rest - there is nothing faithful
to reconstruct from. This takes effect from the next gate fire forward, and a
phase with no `adjudication.json` must READ as unrecorded rather than be
synthesized into one.

**Success Criteria:**

1. A gate fire writes `adjudication.json` beside that gate's report, holding one
   entry per finding RAISED (not only per survivor), and an entry carries the
   raising voice, the model, and the severity as raised.
2. Each entry carries `file`, `line`, the claim and the failure scenario as
   VERBATIM strings, plus `base_id` and `head_id` as full 40-character SHAs;
   mutating a stored claim to a paraphrase is detectable against the reviewer's
   own returned text.
3. Each entry carries `ruling` of exactly `survived`, `downgraded` or `refuted`;
   a `refuted` entry carries counter-evidence naming the contradicting code, and
   a `survived` entry carries its fix commit SHA.
4. Survivor and downgrade counts are DERIVED: recomputing them by counting
   rulings reproduces the number in the gate's trace `detail`, and changing one
   entry's ruling changes the recomputed count.
5. An auditor path is mechanical end to end: `git checkout <head_id>`, open
   `file:line`, read the verbatim claim. Demonstrated once on a real fire.
6. `/cad-report <N>` renders the gate section from `adjudication.json` when one
   exists, and reports a fire with no record as unrecorded - never narrating a
   count it cannot recompute, and never synthesizing entries for phases predating
   the format.
