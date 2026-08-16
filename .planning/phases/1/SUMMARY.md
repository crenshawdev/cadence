---
phase: 1
status: complete
completed: 2026-08-16
---

# Phase 1: The controls that never reached their path - Summary

Three controls Cadence already held now reach the path that needs them: a milestone close distills its pruned phases into `.planning/ARCHIVE.md` before the directories go and the recall corpus walks it, `risk-check status` refuses a fired range carrying no receipt for that range, and `references/execute-parallel.md` reaches the sequential branch's detector/fire/status sequence by pointing at it rather than copying it.

## What shipped

- The ARCHIVE.md residue grammar - `parseArchiveRows` / `appendArchiveRows` in `cadence-core/bin/lib/planning-files.mjs`, beside the other corpus parsers
- The corpus walk reads it - `cmdRecall` appends archived rows last, one flat BM25 ranking (D-05)
- `milestone-prune` writes the residue BEFORE the directory loop (D-01), under a lock, with `residue_rows` on the envelope
- `trace append` carries a structured `--trigger`, plus `--base` beside `--sha` so a receipt names its range
- `risk-check status` gains a fifth row state, `unfired`, and the `risk-fire-missing` refusal reason
- Every blocking fire leaves a joinable receipt - `triage-gate.md` and `review-triggers.md` write `--plan --base --sha` on all four outcome names
- The parallel path's risk sequence - `references/execute-parallel.md` step 5, with three prose-agreement checks holding it

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 373c4be | State the ARCHIVE.md residue grammar, once |
| 1 | 2 | 96f2442 | Fold ARCHIVE.md into the recall corpus, last and flat-ranked |
| 1 | 3 | 1394ead | milestone-prune writes the residue before the directories go |
| 1 | 4 | bc6fd92 | The end-to-end falsifier, watched failing at 182d2e1 |
| 1 | 5 | 0c5ce62, ef5de14 | The close stages the residue it just wrote |
| 1 | 6 | 261c6d2 | The recall contract names an archived row |
| 1 | gate | a1f7d15 | Key the residue containment guard on label and origin |
| 1 | gate | d30ed50 | Serialize the ARCHIVE.md read-modify-write under a planning-file lock |
| 2 | 1 | 66ea007 | trace append carries a structured trigger |
| 2 | 2 | 1b11507 | risk-check status demands the fire receipt |
| 2 | 3 | 841223d | Every blocking fire leaves a joinable receipt |
| 2 | gate | 8d62101 | Bind a fire receipt to the range it settles |
| 2 | gate | 1c3b0a1 | Every fired range needs its own receipt, bound at both ends |
| 2 | gate | e4f95a3 | A receipt needs both range ends and its plan |
| 2 | gate | c2fdbf7 | Correct the receipts JSDoc left stale by the range binding |
| 3 | 1 | 8e2a8e4 | The parallel path reaches the risk sequence |
| 3 | 2 | 75925d5 | The parallel risk sequence is reached, gated and ranged |

## Deviations

- [deviation] None from the plans as written. Every `gate` row above is work the blocking `risk_surface` and `diff` gates required after an executor returned, not a departure from a plan.

## Open items

- The archive row parser accepts arbitrarily large digit strings and converts them with `Number` without a finite/safe check, so a malformed phase number rounds or becomes `Infinity` rather than being rejected. Persisted at `.planning/phases/1/REVIEW-risk_surface-plan-1.md` (medium, survived adjudication unfixed).
- The `head_id: null` legacy arm in `settledBy` accepts an unbound receipt, deliberately: a range no receipt can settle is a gate that gets bypassed. Every record `risk-check run` writes today carries the ids, so the arm is exactly as wide as the records that lack them.
- Declined a dedicated `write-failed` reason for the residue write; `atomicWrite` throws through the dispatcher as `fail('internal', ...)` with nothing yet removed.
- Declined putting the matching receipt on the emitted row (which event cleared it, and when). The receipt is already in the record; add it when a reader needs the provenance.
- `detect-commands` reports `lint: null` for this repo, so `typecheck` is the only static-analysis command available to a dispatch.
- `workflows/report.md`'s Gates line does not name `gate_pass` or `override` explicitly, and `workflows/execute.md`'s "it also catches" clause is now incomplete - it names only the `written: false` case, not the skipped-fire case. Both left as-is; no locked decision or AC requires them.

## Goal check

The sum of these commits delivers the phase goal, with the evidence in each case being a check that fails against the unpatched tree. RCL-07: `milestone-prune.test.mjs`'s two end-to-end falsifiers close a milestone and then recall a term that exists only in a pruned phase's SUMMARY, watched failing at `182d2e1` (exit 1, `0 !== 1` at the post-close recall) and green now, on both the `delete` and `archive` arms. PAR-01: `grep -c risk-check cadence-core/references/execute-parallel.md` was 0 against 2 for `workflows/execute.md` and is now 2, with three `prose-agreement.test.mjs` checks that redden on a paste-back, on the gating sentence's deletion, and on a range collapsed to the phase-wide arm or rewritten to `{PHASE_START, HEAD}`. GAT-04: `risk-diff.test.mjs` grew from 47 to 62 rows, watched failing at `d30ed50` in a detached worktree, and the control is materially stronger than planned - a receipt now names its plan and both ends of the range it settled, every fired range needs its own, a non-empty `matches` nothing can name reads as fired, and a reasonless `override` is refused.

Two things a reader should not take on faith. First, GAT-04's own mechanism was wrong three times before it was right, and each round was caught by the blocking gate rather than by the plan or its checker: the receipt was keyed on `(corr, plan)` alone, then bound on the head only, then bound optionally. That is four review rounds on one requirement, and the control that shipped is not the control PLAN-2 described. Second, the new control immediately refused plan 1's own ranges, because those were fired before receipts existed; the receipts recorded for them are honest reconstructions of fires that did happen, written after the fact, and they are the one place in this phase where the record was authored rather than emitted at the moment it describes.

Whole tree at `c2fdbf7`: `node --test cadence-core/bin/*.test.mjs` 2066 pass / 0 fail / 1 skipped, `node cadence-core/bin/self-verify.mjs` 0 problems, `npx tsc -p tsconfig.ci.json` clean.
