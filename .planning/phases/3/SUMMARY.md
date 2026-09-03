---
phase: 3
status: complete
completed: 2026-09-03
---

# Phase 3: A create states what it did - Summary

`issue-filing.mjs file` now asks the tracker before its first create: one
title-scoped lookup per fire, chunked at six fingerprints, with an issue
already carrying a fingerprint reported by number instead of filed again, an
ambiguous create recorded as an unconfirmed `FILED.md` row the retry honours,
and one fingerprint never created twice from a single payload.

## What shipped

- A title-scoped lookup on all three forges, chunked at `LOOKUP_CHUNK = 6` and
  carrying no decline label - `cadence-core/bin/lib/filing-decision.mjs:332`,
  rows at `:675` (forgejo), `:703` (github), `:726` (gitlab)
- `normalizeLookup(text, limit, numberKey)`, returning fingerprint plus issue
  number beside `normalizeDeclines` rather than widening it -
  `cadence-core/bin/lib/filing-decision.mjs:534`
- `cmdFile`'s pre-create lookup: refuses a filled page with `incomplete-lookup`,
  suppresses a hit open or closed, falls through to the ledger when the child
  could not run - `cadence-core/bin/issue-filing.mjs`, `readFiled` at `:305`
- An unconfirmed row in the `FILED.md` grammar, written only on
  `r.unconfirmed === true` - `FILED_ROW` at
  `cadence-core/bin/lib/planning-files.mjs:1250`, `appendRow` at `:1429`
- In-payload collapse between `readDispositions` and the ledger read -
  `cadence-core/bin/issue-filing.mjs:707-710`
- `lookupMeasured`, scoping a complete tracker miss to the one forge whose query
  was measured - `cadence-core/bin/lib/filing-decision.mjs:704`, read at
  `cadence-core/bin/issue-filing.mjs:844`
- `references/triage-gate.md` restated for the lookup, with its
  `weight-budgets.json` row raised to 26804 in the same commit

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 510fcf9e | FILING_TABLE's lookup rows ask for titles carrying the fire's fingerprints |
| 1 | 2 | 24b2a28a | A normalizer beside normalizeDeclines returning fingerprint and issue number |
| 1 | 3 | 4e1dabd1 | cmdFile looks the fire up before any create, refuses a filled page, suppresses a hit |
| 1 | 4 | b2ca62ef | The FILED.md grammar learns an unconfirmed row |
| 1 | 5 | 922ed1a1 | An ambiguous create writes an unconfirmed row; the append path skips a fingerprint already present |
| 1 | 6 | 75b6a22e | A lookup that could not run falls through to FILED.md; an unconfirmed row suppresses on its own |
| 1 | 7 | e6a6a43a | One payload carrying a fingerprint twice spawns one create |
| 1 | 8 | 9bf0c698 | triage-gate.md states the lookup and its budget row rises with it |
| 1 | post-review fix | b615aa9b | A lookup miss is authoritative only where the query behind it was measured |

## Deviations

- [deviation] CONTEXT D-04 and the plan's Notes assert a complete tracker MISS
  creates "even over a confirmed row". That holds only where the query producing
  the miss was measured: the forgejo and gitlab lookups space-join their tokens
  on D-12's flagged assumption, so an empty answer there is not evidence.
  Fixed in `b615aa9b` by scoping the miss with `lookupMeasured` rather than
  overridden, and D-04's line in `CONTEXT.md` carries the correction.
- [deviation] Tasks 7 and 8 each name `node cadence-core/bin/test.mjs` in their
  `Verify:` while the executor contract allows the full suite once per dispatch.
  Each was verified by its targeted run plus `npx tsc`, with the suite at its one
  permitted site.

## Open items

- On forgejo and gitlab, a fingerprint the tracker holds but `.planning/FILED.md`
  does not - filed from another checkout, or one of D-04's 9 pre-phase orphans -
  can still be created twice when the assumed query returns nothing, because
  nothing local speaks for it. The assumption is written into those two rows'
  comments in `cadence-core/bin/lib/filing-decision.mjs` rather than into a
  transcript. Measuring `tea --keyword` and `glab --search --in title` against a
  live instance holding a known fingerprint closes it; flipping that row's
  `lookupMeasured` to `true` is the whole change.

## Goal check

The nine commits deliver the phase goal. Each of the four ROADMAP criteria has a
named test rather than a green suite standing in for one: the pre-create lookup
and its decline-only no-op are pinned byte-exact per forge
(`filing-decision.test.mjs`, 62 pass, carrying `a github chunk of six is five OR
operators...` and `no provider's lookup vector carries DECLINE_LABEL...`); the
open-or-closed suppression is `a CLOSED issue suppresses exactly as an open one
does (D-05)`; the filled-page refusal and the could-not-run fallthrough are
separate cases in `issue-filing.test.mjs` (61 pass); the in-payload collapse is
`a payload carrying the same fingerprint TWICE spawns one create`. Suites:
`filing-decision` 62, `issue-filing` 61, `planning-files` 336, `planning-recall`
27, `self-verify` 177, full suite 3806 pass / 0 fail; `npx tsc -p
tsconfig.ci.json` and `self-verify.mjs` both exit 0 with no `budget-overrun`.
`lease-check --phase 3 --plan 1` returns `ok:true` over `510fcf9e^..b615aa9b`.
What is NOT delivered is the goal's "never" at full strength on every forge: the
open item above means the guarantee is measured on github and assumed on forgejo
and gitlab, which `lookupMeasured` now states in code rather than leaving
implied.
