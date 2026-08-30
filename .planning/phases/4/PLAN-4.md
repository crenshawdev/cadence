---
phase: 4
plan: 4
requirements: [LND-02]
files:
  - cadence-core/workflows/milestone.md
  - skills/cad-land/SKILL.md
  - cadence-core/references/risk-surface.md
  - cadence-core/references/triage-gate.md
  - cadence-core/bin/weight-budgets.json
  - cadence-core/bin/prose-agreement.test.mjs
---

# Phase 4: Land reads rulings, not raw findings - Plan 4 of 4

## Goal

Every prose surface that told a coordinator to union raw review findings now
tells it to union the records' entries, to name what nothing ruled, and to carry
the records past the prune - so the instruction a human follows says what the
gate actually does.

## Must be true when done

- No prose surface still instructs a coordinator to union
  `REVIEW-risk_surface*.md` `findings` arrays into the gate: `/cad-land`'s
  SKILL, `workflows/milestone.md`, `references/risk-surface.md` and
  `references/triage-gate.md` all state the adjudicated input.
- `/cad-milestone` runs the carry for every phase it prunes, before the prune,
  and stops on an `ok:false` rather than pruning what it could not carry.
- `/cad-milestone` deletes the carried copies when the close resolves, on both
  the halting and the merging arm, exactly as it deletes today's transient
  union file.
- `/cad-land`'s gate bullet names `unruled` and `overridden` and both record
  roots, and still keeps `{"findings":[]}` as the only spelling of "nothing
  survived".
- `node cadence-core/bin/test.mjs` is green and
  `node cadence-core/bin/self-verify.mjs` reports `ok:true`, with
  `weight-budgets.json` re-pinned in the SAME commit as each prose file whose
  byte count moved.

## Context

Locked: D-02 (what is unioned is the records' `entries[]`, never a content join
on the review files), D-03 (a review with no sibling record is a fifth state
that halts), D-08 (every round is unioned; the highest round alone is not the
record of the fire), D-15 (these four prose files move together and the budgets
are re-pinned in the same commit).

SEQUENTIAL: this plan runs LAST, after Plans 1, 2 and 3. Names fixed by this
phase: the subcommand is `risk-carry`, its destination is
`.planning/risk-carry/<N>/`, the payload's additive key is `unruled`, the fifth
state is `unruled-review`, the envelope's additive key is `overridden`.

## Tasks

### Task 1: `workflows/milestone.md` carries the records

- **Files:** cadence-core/workflows/milestone.md,
  cadence-core/bin/weight-budgets.json,
  cadence-core/bin/prose-agreement.test.mjs
- **Action:** in step 3, replace the paragraph that unions every
  `.planning/phases/*/REVIEW-risk_surface*.md` into one
  `.planning/REVIEW-risk_surface-<label>.md` with the carry: run
  `planning.mjs risk-carry --phase <N>` for every phase this close prunes,
  BEFORE the prune and beside the `deferred carry` that already runs there,
  relaying any `ok:false` and stopping because the next step deletes what it
  could not carry. State what it moves and that it COPIES rather than moves, and
  keep the reason the ordering exists at all: the prune removes the only
  producer the unattended halt has, and step 7 chains `/cad-land` after it.
  Keep the transient-never-staged discipline and say it about the new
  destination. In step 7, replace the line deleting
  `.planning/REVIEW-risk_surface-<label>.md` with one deleting
  `.planning/risk-carry/` on BOTH arms, for the same reason it gives today - a
  halt the user answers by landing manually otherwise leaves the artifacts
  behind to halt the next milestone too. Re-pin
  `cadence-core/workflows/milestone.md` in `weight-budgets.json` IN THIS COMMIT:
  a one-byte addition without the re-pin turns `self-verify` red with a
  `budget-overrun`, which is phase 3's own precedent.
- **Verify:** `node cadence-core/bin/self-verify.mjs` reports `ok:true` with
  `problems: []` - check 2 resolves `risk-carry --phase` against its new
  CONTRACTS row and the budget check is clean;
  `grep -n "REVIEW-risk_surface" cadence-core/workflows/milestone.md` returns no
  instruction to union `findings` arrays. The ORDERING is falsified, not
  assumed: add an arm to `prose-agreement.test.mjs` asserting that in step 3 the
  `risk-carry` instruction PRECEDES the prune instruction by file position, and
  that the paragraph naming `ok:false` also names stopping rather than
  continuing. Move the carry below the prune, or delete the stop clause, and
  that arm goes red - which is the check `self-verify` and the grep above
  structurally cannot make.

### Task 2: `/cad-land` reads the rulings

- **Files:** skills/cad-land/SKILL.md, cadence-core/bin/weight-budgets.json,
  cadence-core/bin/prose-agreement.test.mjs
- **Action:** rewrite the gate bullet inside step 3(b). What it must now say:
  read every `ADJUDICATION-risk_surface*.json` under `.planning/phases/*/` and
  `.planning/risk-carry/*/`, union every round's `entries[]`; name on `unruled`
  every `REVIEW-risk_surface*.md` - from those two roots plus a legacy
  `.planning/REVIEW-risk_surface-*.md` an interrupted older close may have left
  - that carries no such sibling record; pipe
  `{"findings": [...], "unruled": [...]}` on stdin to
  `land-cleanup.mjs gate`; halt the chain on `action:"halt"` and surface both
  `findings` and a non-empty `overridden` instead of merging over them. Keep the
  explicit `{"findings":[]}` as the only spelling of "nothing survived", and
  keep the sentence that the gate never reports "no surviving finding" about
  input it never parsed. Do not disturb the deferred-queue paragraphs earlier in
  step 3 or the position of the `deferred list` call ahead of BOTH publish arms:
  `prose-agreement.test.mjs` pins that order and pins the sentence saying the
  deferred refusal is NOT `land-cleanup.mjs gate`. Re-pin
  `skills/cad-land/SKILL.md` in `weight-budgets.json` in this commit.
- **Verify:** `node --test cadence-core/bin/prose-agreement.test.mjs` is green,
  including the `cad-land step 3` ordering arms;
  `node cadence-core/bin/self-verify.mjs` reports `ok:true`; the bullet names
  `unruled`, `overridden` and both record roots.

### Task 3: The two references state the adjudicated input

- **Files:** cadence-core/references/risk-surface.md,
  cadence-core/references/triage-gate.md, cadence-core/bin/weight-budgets.json,
  cadence-core/bin/prose-agreement.test.mjs
- **Action:** in `risk-surface.md`'s "Persisting the settled survivors" section,
  state that what `/cad-land`'s unattended close consumes is the RULING - the
  `ADJUDICATION-<trigger>-<discriminator>[-rN].json` beside the REVIEW file -
  and that a REVIEW file with no such sibling halts the close by name rather
  than passing. Keep both honesty properties already stated there, the
  every-write-is-discriminated one unchanged, and replace the "producer set
  outlives the phase dirs" bullet with the carry and its destination. In
  `triage-gate.md`, rewrite the `git.auto_close` carve-out paragraph: what
  `/cad-land` pipes is the adjudicated state, and the consequences are now the
  genuinely-unfixed halt, the unruled halt and the overridden surfacing rather
  than a blocker/high halt over raw findings. Two constraints bind
  `triage-gate.md` specifically: it is one of the four surfaces
  `prose-agreement.test.mjs` holds to the severity-gated meaning of `survived`,
  so the phrase "confirmed and not fixed" must survive there, and no new
  sentence may say a `survived` finding names its fix commit without naming the
  severity that gates it. Re-pin both files in `weight-budgets.json` in this
  commit. Do not touch `references/review-triggers.md`: it states where the
  write happens by pointing at `risk-surface.md` and states no union of its own.
- **Verify:** `node cadence-core/bin/test.mjs` is green,
  `node cadence-core/bin/self-verify.mjs` reports `ok:true` with `problems: []`,
  and `node --test cadence-core/bin/prose-agreement.test.mjs` is green including
  the four-surface `survived` row; a repository-wide grep for
  `REVIEW-risk_surface` across `skills/`, `cadence-core/workflows/` and
  `cadence-core/references/` returns no surviving instruction to union
  `findings` arrays for the gate.

## Notes

- SEQUENCING, and it is not advisory. This plan runs LAST. Plan 2 binds to the
  name Plan 1 gives the predicate's third answer; this plan's prose describes a
  gate Plan 2 builds and invokes the `risk-carry` subcommand Plan 3 adds, and
  `self-verify` check 2 resolves a prose invocation against
  `lib/arg-contract.mjs`'s CONTRACTS - so Task 1's `ok:true` here is
  unreachable until Plan 3 has landed. That is a hard ordering enforced by this
  plan's own Verify, not a convention. This plan shares no declared file with
  any other, so `plan-overlap` will report it independent; that report is about
  file safety, not about whether the work makes sense out of order.
- The transient union file `.planning/REVIEW-risk_surface-<label>.md` is
  RETIRED as a producer, not merely supplemented: its whole job was to survive
  the prune, which Plan 3's carry now does with the sibling relation intact. The
  glob for it stays in `/cad-land`'s read set on the `unruled` side alone, so a
  copy left behind by an interrupted older close halts rather than being
  ignored.
- `cadence-core/bin/self-verify.test.mjs` is deliberately NOT in this lease. No
  task here edits it: the three prose tasks RUN `self-verify.mjs` and the new
  subcommand's resolution is data-driven off the CONTRACTS row Plan 3 adds, so
  the check needs no amendment. If one turns out to be needed, that is a lease
  amendment, not a silent write.
