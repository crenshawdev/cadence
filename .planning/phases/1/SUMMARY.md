---
phase: 1
status: complete
completed: 2026-08-14
---

# Phase 1: The capture queue stops dropping filed work - Summary

CAPTURE.md's append moved out of skill prose into a locked `planning.mjs
capture` seam all three product writers call; the phase-tag reader admits every
shape the 375-bullet queue contains; and `/cad-health` names any section the
recall walk cannot see.

## What shipped

- The capture seam - `cadence-core/bin/lib/capture-file.mjs`, called by
  `planning.mjs capture` / `/cad-capture` / `/cad-execute` open items /
  `debt-harvest`; the heading is not a parameter (D-01/D-02)
- Concurrent-append guard - `wx` lock + post-release verify-retry; a lost
  append returns `write-lost`, never `ok:true` (AC5; redesigned once after the
  blocking review refuted the in-lock read-back, see Deviations)
- `--text-file` transport - caller-derived sentences arrive as a path, never
  inside a double-quoted shell word (review finding, commit d49bb2e)
- Widened phase-tag grammar - `CAPTURE_PHASE_TAG` admits `(phase N)`,
  `(vX.Y.Z phase N)`, `(phase N, label)`; stated once in
  `references/capture-grammar.md`, 23 pinned rows (AC2)
- The recall walk stated once - `CAPTURE_WALK_SECTIONS` exported; write side
  derives from it (AC1)
- Out-of-walk census - `planning.mjs capture-sections` + `/cad-health` note:
  Archive 185, Debt markers 1, no allowlist (AC3, D-06/D-07)

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | cc469f7 | capture seam owns CAPTURE.md headings and format |
| 1 | 2 | ccf3482 | walk membership pinned; the proof can fail |
| 1 | 3 | 1847c94 | concurrent-append guard around the read-modify-write |
| 1 | 4 | 16bd5e1 | debt-harvest rewrites through the seam |
| 1 | 5 | f8a004a | /cad-capture writes through the seam, no write tools |
| 1 | 6 | 852d245 | /cad-execute files open items through the seam |
| 1 | fix | d49bb2e | three high risk_surface findings closed (ownership-safe stale break, ENOENT-only read, --text-file) |
| 1 | fix | 09d25d8 | no-lost-append guarantee moved onto the writer (post-release verify-retry) |
| 2 | 1 | f8854c8 | phase-tag reader admits every queue shape |
| 2 | 2 | 9edd2fa | one test row per stated shape (23 rows) |
| 2 | 3 | a6508ee | grammar written down once (capture-grammar.md) |
| 2 | 4 | 8e27033 | recall walk's sections stated once |
| 2 | 5 | 0dbdfda | capture-sections census subcommand |
| 2 | 6 | 593ec7f | /cad-health names out-of-walk sections |

## Deviations

- [plan 1, post-plan] The blocking `risk_surface` gate returned three HIGH
  findings on the committed range (d49bb2e closed them); the narrowed re-arm
  then refuted the stale-break fix itself, and the guarantee was redesigned
  onto the writer per user decision - the lock keeps its self-heal, and
  `appendCapture` confirms after release and re-appends, `write-lost` after
  four rounds (09d25d8). No CONTEXT D-NN was refuted; CONTEXT's flagged
  assumption 4 (a hand edit takes no lock) stands open by design.
- Plans otherwise executed as written; plan 2 reported zero deviations.

## Open items

- Reader partial-prefix strip: `CAPTURE_PHASE_TAG` corrupts a malformed nested
  parenthetical instead of preserving it (planning-files.mjs:704, review medium)
- `Number(n)` on unbounded digits: no safe-integer guard, pathological tag
  emits wrong phase or Infinity (planning-files.mjs:750, review medium)
- Census duplicate-heading blind spot: second `## Todos` reported in-walk while
  recall reads one body per name (planning-files.mjs:796, review medium)
- Lock-release failures swallowed; `capture-locked` masks non-EEXIST create
  errors in its reason word (detail survives); unknown capture options ignored
  (three plan-1 review mediums, REVIEW-risk_surface-plan-1.md)
- `write-lost` arm has no deterministic test (interleaving unforceable from
  outside; 20-writer row covers recovery only)
- `skills/cad-capture/SKILL.md` still grants `Read` no step uses (plan 1 report)
- Census counts nothing above the first `## ` heading; stated in its comment
  (plan 2 report, declined arm)
- Plan 2 context quoted Todos 180; census measures 181 (stale baseline, nothing
  asserts it)
- Human-verify outstanding: `/cad-health` walked in a real session printing the
  Archive/Debt-markers note (seam half proved by direct run)

## Goal check

The goal was that `/cad-capture` writes where the recall walk can see it and
the tag grammar admits every shape the writer emits. The write side is now
code, not prose: `planning.mjs capture` exists in `COMMANDS`
(planning.mjs:3372-region) and all three product writers route through it
(cc469f7, 16bd5e1, f8a004a, 852d245), with the AC1 capture->recall round trip
pinned by a test that reddens when the target heading is `## Archive`
(ccf3482). The reader side: `CAPTURE_PHASE_TAG` (planning-files.mjs:704) admits
the shapes a 375-bullet audit found, 190 bullets parse and 164 carry a phase
field on the live queue (probe run 2026-08-14), zero bare parentheticals
survive unparsed. AC5 held under twenty concurrent CLI writers with zero lost
bullets (capture-file.test.mjs). The census names Archive 185 / Debt markers 1
at `in_walk:false` on a live run. What is NOT delivered: protection against a
hand edit that takes no lock (CONTEXT assumption 4, open by design), and the
three reader mediums above - none of which drop a well-formed bullet, which is
the class this phase existed to close.
