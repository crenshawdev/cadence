---
phase: 2
plan: 1
requirements:
  - RSK-09
files:
  - cadence-core/bin/planning/adjudication.mjs
  - cadence-core/bin/planning/core.mjs
  - cadence-core/bin/planning/trace.mjs
  - cadence-core/bin/planning-adjudication.test.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/planning-lease-check.test.mjs
  - cadence-core/bin/phase-spelling.test.mjs
  - cadence-core/bin/self-verify.test.mjs
  - .planning/tasks/declines-off-the-tracker/ADJUDICATION-risk_surface-declines-off-the-tracker.json
---

# Phase 2: A receipt can name its home and its authorization - Plan 1

## Goal

A settlement for a task is written through the seam instead of by hand, and the
record it leaves states what it descends from. This plan lands the record half:
the record body names its task, the repository's one hand-written settlement is
replaced by a seam-produced one, the `--phase <N> --task <slug>` direction is
guarded, and a task settlement's counts stop being self-asserted.

## Must be true when done

- `.planning/tasks/declines-off-the-tracker/ADJUDICATION-risk_surface-declines-off-the-tracker.json`
  is a file the `adjudication` seam produced. It holds no `note` field, it holds
  a `task` field naming the slug, and it holds `base_id`, `head_id`, `citations`
  and per-entry `base_id`/`head_id` that the hand-written file lacked.
- A record written on a task fire carries a `task` field; a record written on an
  ordinary phase fire carries no `task` key at all - absent, never empty.
- `planning.mjs adjudication --phase 2 --task some-slug`, on a tree where
  `phases/2/` exists, answers `ok:false` and writes nothing, while
  `--phase 0 --task <slug>` still answers `ok:true`.
- A receipt carrying a wrong `--survivors` figure against a record under
  `.planning/tasks/<slug>/` is refused with `count-disagreement` and appends
  nothing, the same refusal the identical record under `phases/<N>/` already
  produces. The same call against a record under `deferred/<N>/` still omits the
  check and appends the receipt.
- `node cadence-core/bin/test.mjs` and `npx tsc -p tsconfig.ci.json` pass.

## Context

CONTEXT.md's decisions bind every task here. The load-bearing ones: the seam
ALREADY accepts `tasks/<slug>/` as a home, so this plan re-implements no path
resolution (D-05); what Case B owes is replacing the committed hand-written
record with a seam-produced one, and the seam refuses `record-exists`, so the
committed file is removed in the same commit (D-06); the record body carries a
`task` field on the present-only-when-real convention (D-07); the converse
guard is a few lines beside the phase-0 guard the same commit already added
(D-08); the recount widens to `tasks/` ONLY - `deferred/<N>/` keeps its stated
degrade-to-no-check posture (D-04).

Out of scope here: the two `trace append` flags and every prose file (PLAN-2),
the `/cad-suggest` reader (PLAN-3), and any change to `settledBy`/`settles` gate
strength (D-03).

## Tasks

### Task 1: The record body names the task it settles

- **Files:** cadence-core/bin/planning/adjudication.mjs (`cmdAdjudication`, the
  `record` object literal it hands to `atomicWrite`),
  cadence-core/bin/planning-adjudication.test.mjs
- **Action:** `cmdAdjudication` already destructures `task` off `fireIdentity`'s
  result and passes it to `fireHome`, and then drops it: the record it writes
  states `"phase": "0"` and nothing else, leaving the directory path as the
  record's only statement of what the fire settled. Carry the slug onto the
  record body as a `task` field, present ONLY when the fire is a task's, the
  present-only-when-real convention `redactions`, `config_warnings` and
  `--agent-id` already take and phase 1's D-11 locked for provider usage (D-07).
  Do NOT decorate `phase` - the hand-written file's `"phase": "0 (task: ...)"`
  is a string a reader has to parse, which is the substitution the structured
  `--trigger` flag already exists to refuse; `phase` stays the caller's own
  spelling. Do NOT add a count, a path or any second copy of what the envelope
  already returns: this record deliberately stores no figure it does not have to,
  and the envelope's `record` field already names the relative path. The envelope
  itself does not change. Check before writing whether any existing arm of
  `planning-adjudication.test.mjs` asserts the record's whole key set by
  `deepEqual` - a new optional key would redden it, and the repair is to widen
  that assertion rather than to drop the field.
- **Verify:** `node --test cadence-core/bin/planning-adjudication.test.mjs`
  passes with two new cases: a `--phase 0 --task <slug>` fire writes a record
  whose parsed JSON has `task` equal to the slug; a `--phase 2` fire with no
  `--task` writes a record where `'task' in record` is FALSE, asserted as
  absence and not as an empty string. `node cadence-core/bin/test.mjs` and
  `npx tsc -p tsconfig.ci.json` pass.

### Task 2: Replace the hand-written settlement with one the seam produced

- **Files:** .planning/tasks/declines-off-the-tracker/ADJUDICATION-risk_surface-declines-off-the-tracker.json
- **Action:** The committed file was written BY HAND and says so in a `note`
  field: five entries from one voice (`openai`/`gpt-5.6-sol`) over
  `cadence-core/bin/issue-filing.mjs`, four `survived` and one `refuted`, over
  the range `ecaf2fd0..1cce9cec` - both of which resolve in this repository.
  Delete that file and re-produce it with
  `planning.mjs adjudication --phase 0 --task declines-off-the-tracker --trigger
  risk_surface --discriminator declines-off-the-tracker --base ecaf2fd0 --head
  1cce9cec --payload <path>` in the SAME commit: the seam refuses `record-exists`
  on any `lstat` hit, so a run against the live file answers
  `{"ok":false,"reason":"record-exists"}` and writes nothing (D-06, measured
  2026-09-01). Compose the payload by reading the committed file's own entries
  back into the payload grammar `cadence-core/references/review-record.md`
  states - one voice with its returned findings and its rulings, each ruling
  carrying the claim and failure scenario verbatim from the entry it came from,
  so the reviewer's own words survive the round trip byte for byte. The payload
  is a transient file: write it outside `.planning/` (a `mktemp -d` run
  directory) and stage nothing but the record. The `--discriminator` is the slug
  because the sibling `REVIEW-risk_surface-declines-off-the-tracker.md` already
  carries that name and the record has to land beside it under the matching
  name. Do not touch `RECORD.md` or the `REVIEW` file in that directory: they
  are a record of what was true when written.
- **Verify:** `node cadence-core/bin/planning.mjs adjudication ...` as above
  answers `ok:true` with `counts` reading survived 4 / refuted 1 over 5 raised
  and `citations.checked` true with 0 missing, and `git status` shows exactly
  one modified path. The written file parses as JSON with no `note` key
  (`'note' in record` is false), `task` equal to `declines-off-the-tracker`,
  `base_id` and `head_id` both 40 hex characters, a `citations` object, and
  every entry carrying its own `base_id` and `head_id`. Re-running the same
  command answers `{"ok":false,"reason":"record-exists"}`.

### Task 3: Refuse `--phase <N> --task <slug>`, the converse of the guard already there

- **Files:** cadence-core/bin/planning/core.mjs (`fireIdentity`, the
  `n === '0' && task === undefined` refusal), cadence-core/bin/planning-adjudication.test.mjs
- **Action:** `fireIdentity` guards one direction only: `--phase 0` with no
  `--task` is refused because it resolves no phase home. The converse is
  accepted and is just as wrong - measured 2026-09-01, `adjudication --phase 2
  --task some-slug` against a tree holding `phases/2/` answered `ok:true` and
  routed the record to `tasks/some-slug/`, leaving phase 2's own sibling REVIEW
  file unsettled, which is a fire reported as recorded and filed where nothing
  reads it (D-08; corroborated by the `CAPTURE.md` item raised medium and ruled
  survived in `ADJUDICATION-risk_surface-cad-task-f860560e-r2.json`). Refuse a
  `--task` given beside any phase other than `0`, in the same `bad-args` shape
  and immediately beside the existing guard, with a hint naming the actual
  repair: a task fire passes `--phase 0`, a phase fire passes no `--task`.
  Phase 0 with `--task` and any other phase without it both stay accepted
  exactly as they are. Compare the phase as the CALLER spelled it, the way the
  existing guard compares `n === '0'`, so `--phase 0.1` is a phase and not the
  task number. `deferred record` shares this function and declares no `--task`
  row, so the door already refuses the flag there and nothing about that face
  changes.
- **Verify:** `node --test cadence-core/bin/planning-adjudication.test.mjs`
  passes with new cases: `adjudication --phase 2 --task some-slug` against a
  tree where both `phases/2/` and `tasks/some-slug/` exist answers `ok:false`
  with `reason` `bad-args` and writes NO file into either directory (asserted by
  listing both); `--phase 0 --task <slug>` on the same tree still answers
  `ok:true`; and a `--phase 2` fire with no `--task` still answers `ok:true`.
  `node cadence-core/bin/test.mjs` passes.

### Task 4: Recount a task settlement's counts instead of taking them on trust

- **Files:** cadence-core/bin/planning/trace.mjs (`recordForFire`, and the
  docblocks on `recountReceipt` and `overrideAccounted` that state where a
  record may live), cadence-core/bin/planning-adjudication.test.mjs
- **Action:** `recordForFire` resolves only `join(dir, 'phases', String(phaseRaw))`,
  and both `recountReceipt` and `overrideAccounted` go through it, so an
  unresolved record means "omit the check". A task's records live under
  `.planning/tasks/<slug>/`, which that join never reaches: measured 2026-09-01,
  an identical record under `phases/9/` refused a fabricated `--survivors 999`
  with `count-disagreement` while under `tasks/<slug>/` the same receipt was
  accepted `ok:true`, and all four `gate_pass` receipts the
  `secret-fence-on-review-payloads` task wrote carry counts nothing ever
  recounted (D-04). Teach `recordForFire` the task home. The receipt carries no
  slug - `references/triage-gate.md` states `--plan <k>` is omitted on a
  `/cad-task` fire, and the four live receipts confirm it - so the only signal
  available is the phase: `--phase 0` is a TASK's number by the rule
  `fireIdentity` already enforces, and there is no `phases/0/` and never will
  be. Resolve under the task home for that phase and that phase only; every
  other phase resolves exactly as it does today. Where more than one task
  directory holds a record matching the trigger, round and head, answer `''` -
  the disposition this function already declares for two candidates, because a
  check that might be reading another fire's rulings is worse than no check. Do
  NOT widen to `deferred/<N>/`: that home keeps its stated degrade-to-no-check
  posture, and the block comment on `fireHome` in `planning/core.mjs` records
  why the safe direction differs between the writer and this recount. Keep every
  existing rail: the `RECORD_TOKEN` test on `trigger` before it reaches `join`,
  the `lstatSync().isFile()` test that refuses a symlink wearing a record's
  name, and the round-1 `-r<n>` exclusion. Update the docblocks on the two
  callers so their "absent record omits the check" paragraphs name the three
  homes honestly rather than implying two.
- **Verify:** `node --test cadence-core/bin/planning-adjudication.test.mjs`
  passes with three new cases, each built by running the real seams end to end
  the way the `deferral` arms in that file already do: (a) a `--phase 0 --task
  <slug>` fire whose record is written under `tasks/<slug>/` with a
  `cad-task-<short head sha>` discriminator, followed by `trace append --phase 0
  --family outcome --event gate_pass --trigger risk_surface --base <base> --sha
  <head> --survivors 999 --downgraded 0 --refuted 0`, answers `ok:false` with
  `reason` `count-disagreement` and the trace holds no such event; (b) the same
  call carrying the figures the seam's own envelope returned answers `ok:true`;
  (c) the identical record placed under `deferred/<N>/` with a receipt carrying
  `--survivors 999` still answers `ok:true` and appends the event, proving the
  non-widening is asserted rather than assumed. `node cadence-core/bin/test.mjs`
  and `npx tsc -p tsconfig.ci.json` pass.

## Notes

**Plan order.** This plan runs FIRST. It shares `cadence-core/bin/planning/trace.mjs`
and the three census holders with PLAN-2, so `plan-overlap` reports the overlap
and `/cad-execute` routes the three plans sequential on its own.

**Why the three census holders are declared.** `cadence-core/bin/planning/` is a
census SUBJECT for three rows in `lib/census-registry.mjs` -
`trace-refusal-sentences` (holder `trace.test.mjs`), `planning-detail-sites`
(holder `planning-lease-check.test.mjs`) and `phase-spelling-callsites` (holder
`phase-spelling.test.mjs`) - so `lease-check --plan-time` requires all three on
any plan that edits a file under it. Task 3 adds a `bad-args` detail site inside
`planning/core.mjs`: if it is a NEW error-detail site by that census's own
counting rule, re-pin the count in `planning-lease-check.test.mjs` and on its
`CADENCE-CENSUS` marker line in the same commit. Task 3 adds no phase-argument
callsite and no new `trace` refusal sentence, so the other two holders are
declared for the lease and are expected to need no edit.

**The regenerated record will not be recount-resolvable, and that is correct.**
`recordForFire`'s non-plan arm matches a record by the short head sha its
discriminator ends with, and task 2's discriminator is the slug
`declines-off-the-tracker`, whose last segment is not a sha. That fire was
settled by hand a cycle ago and has no receipt to recount; task 4's widening is
for fires written the way `workflows/task.md` states, whose discriminator is
`cad-task-<short head sha>` - the four records in
`.planning/tasks/secret-fence-on-review-payloads/` are the live example.
