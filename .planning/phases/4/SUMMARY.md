---
phase: 4
status: complete
completed: 2026-09-06
---

# Phase 4: Derivation and the internal spine - Summary

Phase state is now derived from disk by the binary rather than read out of
prose, behind one lifecycle vocabulary, with a memo keyed by a hash of the
derivation's exact inputs and disagreement raised as a hard error instead of a
silent recompute.

## What shipped

- **The derivation module** - `crates/cadence/src/derivation/` (model, parse,
  capture, query, compatibility, consistency, intake, memo). Pure synchronous
  core; artifact reads go through a read-only trait at the edge.
- **The truth table, ported deliberately** - no artifacts to `unplanned`,
  admitted PLAN to `planned`, SUMMARY without a qualifying UAT to `executed`,
  SUMMARY plus qualifying UAT to `complete` **with or without a PLAN**. That
  last case is frozen behavior (`cadence-core/bin/planning/core.mjs:192-205`)
  and D-02 inherits it as a recorded choice, not an accident.
- **One lifecycle vocabulary** - the frozen `AGREE` table mapped a derived
  `unplanned` onto the legal cursor phrases, which is what produced the useless
  drift line "cursor says phase 3 unplanned; derived phase 3 unplanned". Legacy
  spellings are now normalized at intake and retired atomically with the memo
  that adopts them.
- **The bounded memo** - the key covers exactly the enumerated lifecycle inputs
  and excludes what cannot be hashed honestly. A memo whose answer disagrees
  with a fresh derivation under the same key returns `derivation-conflict`
  naming the differing field, and never auto-repairs.
- **Guarded store additions** - `ReadVerified` and `CompareRewriteSnapshot` on
  the writer, plus `Session::derivation_view` and `commit_derivation`, because
  ordinary `Read` returns cached data before revalidation and ordinary snapshot
  replacement wraps data under `data.current`.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | `f2ae1ffb` | define captured lifecycle contract |
| 1 | 2 | `11f26b73` | port bounded roadmap and UAT readers |
| 1 | 3 | `5cdb4689` | capture admitted lifecycle artifacts through read-only IO |
| 1 | 4 | `1a7ab6ee` | derive lifecycle from captured artifact truth table |
| 1 | 5 | `35042ba3` | refuse lifecycle publication when observations change |
| 2 | 1 | `307031e0` | normalize compatibility cursor intake |
| 2 | 2 | `e88315b0` | refuse inconsistent declarations before query success |
| 2 | 3 | `91246ae1` | retire adopted intake atomically with its memo |
| 2 | 4 | `ee688c89` | prove cold and warm consistency refusals preserve bytes |
| 3 | 1 | `4280bfc3` | encode the bounded lifecycle input key |
| 3 | 2 | `36d0b0cb` | refuse malformed and disagreeing lifecycle memos |
| 3 | 3 | `bfa51ced` | guard full-data derivation updates by verified generation |
| 3 | 4 | `821e9fad` | publish guarded lifecycle queries through the resident owner |
| 3 | 5 | `49c01c5b` | prove persistent conflicts exclusions and acknowledgement |

Planning-doc commits in the same range, not task work: `de39f919` (the phase
split), `892b21d5` (CONTEXT), `9de261f1` (the three plans), `6f3d6e9d` (the
falsification corrections), `39756eff` / `273ee780` / `864ef544` (the per-plan
run records).

Every commit is GPG-signed as `John Crenshaw <john@jcrenshaw.dev>` with key
`693AB15F91734B0C`. `cadence-core/` is byte-identical to `v3.7.12` throughout.

## Deviations

- [deviation] **The phase was SPLIT before any code was written.** Phase 4's
  roadmap entry assumed `(current_state, evidence) -> next` was derivable from
  the repository. A source audit found five of its six frozen-code claims TRUE,
  one IMPRECISE, and the stronger premise unestablished: next-action selection
  reads three evidence classes with no durable home - the checkpoint payload
  (E24), checker verdicts, because a closed trace bracket encodes that a check
  RAN and not what it decided (E37-E38), and the operator's answer at a gate
  (E65). All three live in worker returns and the conversation. Next-action
  selection, the operator override and the `cad-pause` collapse moved to a new
  phase 5 in `de39f919`; the roadmap went from 17 phases to 18.

- [deviation] **`PhaseId` overflow serializes as `"Infinity"`, not null.** The
  frozen numeric grammar can overflow binary64. Finite ids serialize as JSON
  numbers and an overflowing id as the explicit string, reproducing frozen
  `String(Number(x))` addressing (`derivation/parse.rs:57`; `model.rs:305`,
  `:314`). JSON null would lose an admitted identity or make it
  indistinguishable from "no current phase".

- [deviation] **Two new native cursor constraints, caught before execution.**
  PLAN-2 required blank name and blank `Next:` to be rejected while citing the
  frozen grammar as reference - but frozen `parseCursor` accepts both:
  `\((.+)\)` matches a run of spaces, and `Next:\s*(.+?)\s*$` lets the leading
  `\s*` cross a newline so an empty `Next:` swallows the following `Updated:`
  line (`cadence-core/bin/lib/planning-files.mjs:29`, `:31`). An executor
  porting the frozen grammar would have built the permissive behavior and failed
  its own Verify. The falsification pass found it and `6f3d6e9d` wrote it into
  the plan as new constraints.

## Open items

- **Phase 5 owns the three undurable evidence classes.** This is by design, not
  a gap: the split exists precisely so the records land before anything derives
  over them. Until phase 5, next-action selection does not exist in the binary.

- **The final-reobservation race is bounded, not eliminated.** Refusal on
  changed inputs is a check-point guarantee. An edit landing between the final
  recheck and publication is not excluded, and `docs/architecture/derivation.md`
  says so rather than implying a total guarantee.

- **`/cad-execute` was bypassed again**, on John's ruling, with Codex executing
  each plan directly. Unlike phase 3, the receipts were written per plan as each
  landed rather than reconstructed afterward, so nothing was ever missing. The
  gates `/cad-execute` would have fired still did not run; the adversarial
  falsification pass over the plans stood in for the plan-checker, and it was
  the stronger check - `workflow.plan_check` is what passed phase 2's impossible
  criterion, while the falsification pass caught phase 3's D-05 and phase 4's
  two cursor constraints.

- **No phase owns the documentation rewrite.** Carried unchanged from phase 3.
  `README.md`, `DESIGN.md`, `METHOD.md`, `INTERNALS.md`, `docs/WORKFLOW.md` and
  the `.planning/DOCS-CLAIMS.md` ledger appear nowhere in the 18-phase roadmap.

## Goal check

The goal was "the binary answers 'where did I leave off' from the store and the
repository, and the model stops interpreting a cursor." The fourteen commits
deliver derived lifecycle status, one vocabulary with legacy intake normalized
and retired, and a bounded memo that fails loudly on disagreement, with 148
workspace tests passing and clippy clean under `-D warnings`.

What is NOT established here, and must not be read as established: the binary
does not yet answer "what comes next". That half was moved to phase 5 on
evidence, not on schedule. Derivation is also not yet wired to any skill - the
tool surface is still `cadence_version` alone, so every criterion here is proven
in-process rather than through the binary's external interface. Phase 6 owns
that boundary.
