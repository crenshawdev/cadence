---
phase: 1
status: complete
completed: 2026-09-01
---

# Phase 1: Every review fire is bracketed and priced - Summary

A cross-model review call now records the usage the provider reported, on its own
`provider/request` event and behind the same credential fence the outbound payload
crosses; `trace render` folds those figures into a `provider_spend` projection that
prices only calls that were actually sent to a review, and `/cad-report` prints them
on a `Cross-model reviews` line in their own denomination.

## What shipped

- Provider-reported usage on the review seam's own event - `usage` (normalized
  input/output pair) and `usage_raw`, both absent when the response carried nothing
  real, the raw object dropped whole if the credential fence alters it or it exceeds
  2048 serialized chars - `cadence-core/bin/review-provider.mjs`
- The three adapters' usage field names pinned against live provider documentation
  (OpenAI `ResponseUsage`, Gemini v1beta `UsageMetadata`, DeepSeek chat completion),
  verified 2026-09-01 - `cadence-core/references/provider-api.md`,
  `cadence-core/references/seam-review-provider.md`
- A `provider_spend` projection on the default `trace render` envelope -
  `{calls, tokens?, unrecorded?}`, the whole key absent for a scope holding no
  provider review call, `tokens` gated on a figure having landed so an
  all-unrecorded scope reads `unrecorded` and never `0`, and scoped to
  `command === 'review'` calls that reached the wire -
  `cadence-core/bin/planning/trace.mjs`
- A `Cross-model reviews` line on `/cad-report`, in the provider's own denomination
  and never summed into the host's final-window token line -
  `cadence-core/workflows/report.md`
- The empty-set review fallback routed to the `claude-subagent` arm that brackets and
  closes it, rather than to step 3's selection rule -
  `cadence-core/references/review-triggers.md`,
  `cadence-core/references/review-cross-model.md`
- The rule that one `routing/resolve` is owed per review FIRE, before any backend is
  chosen and including a fire no claude-subagent serves - same two references
- The retired "no token field on that arm at all" claim removed from both references,
  from `SPEND_EXCLUDES` and from `report.md`'s excludes rule, with the surviving
  denomination consequence kept rather than deleted -
  `cadence-core/bin/lib/trace-suggest.mjs`, `.planning/DOCS-CLAIMS.md` (REPORT-12)

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 36c529cd | Record the usage a provider returned on the `provider/request` event |
| 1 | 2 | 20a68088 | Pin the usage field each adapter reads, on the wire and at the seam |
| 1 | fix | 8496214f | Fence the provider usage object before it reaches the trace |
| 2 | 1 | fa5c5812 | Fold what the providers said a phase's reviews cost onto the render |
| 2 | 2 | 133b33ab | Give `/cad-report` a reviewer line carrying a real cost |
| 2 | fix | d4c2db40 | Price only the review calls that reached a provider |
| 3 | 1 | d7ada952 | Route the empty-set review fallback to the arm that brackets it |
| 3 | 2 | 67868b46 | State the routing resolve as one per review fire, whichever backend serves it |
| 3 | 3 | fe5daeb1 | Retire the two review references' no-token-field claim |
| 3 | 4 | c03da06a | Drop cross-model provider calls from the spend exclusion list |

## Review record

Six provider review fires ran, all `openai`. Two gates FAILed and both were closed by
a fix under the same worker key, each re-armed once and clean on the narrowed round.

| Trigger | Plan | Gate | Raised | Outcome |
|---|---|---|---|---|
| `risk_surface` | 1 | blocking | 4 | FAIL on a `high`, fixed in `8496214f`, re-arm clean, PASS |
| `diff` | 1 | blocking | 1 | PASS, one `medium` survivor |
| `risk_surface` | 2 | blocking | - | detector matched nothing, no fire owed |
| `diff` | 2 | blocking | 3 | FAIL on a `high`, fixed in `d4c2db40`, re-arm clean, PASS |
| `risk_surface` | 3 | blocking | - | detector matched nothing, no fire owed |
| `diff` | 3 | blocking | 1 | PASS, one `medium` survivor |

The two blockers were both about this phase's own subject. Plan 1's: `usage_raw` wrote
the provider's object verbatim into `.planning/trace.jsonl` with no credential fence,
in a public repository. Plan 2's: `providerSpend` selected on `family` alone, so a line
labelled `Cross-model reviews` priced the 16 `detect-models` and 3 `consult` calls in
this record alongside its 298 reviews.

Four confirmed-but-unfixed findings were filed as issues on `crenshawdev/cadence`
(fingerprints `0d0678aa8a8fca4a`, `ad7a68b976d96c3b`, `2b77b26e6776abd5`,
`622312b1f66a11d3`); three more were declined to `.planning/DECLINED.md`.

## Deviations

None - all three plans executed as written, and no numbered CONTEXT decision was
refuted.

## Open items

- **Deferred UAT, inherited by `/cad-verify 1`:** `report.md` is model-executed prose,
  so no automated command exercises the new `Cross-model reviews` line. Run
  `/cad-report <N>` and confirm the PRINTED output in three states: a phase with
  recorded usage prints a cost figure; a phase whose provider events carry no usage
  key prints `unrecorded` and never `0`; a scope with no provider review call prints
  no line at all. The data behind all three was confirmed present and correctly
  shaped - re-read the figures with `trace render --phase <N>` at verify time rather
  than expecting the ones recorded in `reports/plan-2.md`, which move as the record
  grows.
- Plan 3 task 1's `human-verify` arm (AC2) is undischarged: it needs a live provider
  key and an induced provider drop-out, then `trace render --phase <N>` showing the
  fire with no `unpaired` entry and a token figure on its bracket.
- Plan 3 task 2's `human-verify` arm (AC5) is undischarged: it needs a phase whose
  fires were all provider-served, then a COUNT of one `routing/resolve` per fire. The
  resolve event carries no trigger field, so it is a count and not a join (D-12).
- **This run is itself a counter-example to AC5, and it is the honest place to say so.**
  Its record holds 2 `cad-reviewer` resolves against 6 provider review calls under
  `corr` `1-ab10452a`. The rule that closes that gap landed mid-run in `67868b46`, so
  the coordinator was following the pre-fix reference for the first five fires. Nothing
  is wrong with the shipped prose; the next full run is the first one that can pass
  this criterion.
- Consult spend is reported nowhere by name. `/cad-debug`'s dead-end consult is a real
  provider call with a real cost, now deliberately outside `provider_spend` because
  that figure feeds a line labelled `Cross-model reviews`. `counts.provider` still
  counts every provider event in scope and `report.md` names it as where the
  difference lives. Worth a capture if a consult bill ever needs its own line.
- `provider_spend` was deliberately NOT added to `renderTrace` or the `TraceRender`
  typedef - the fold replaces bytes withheld from the CLI response, the same reason
  D-08 puts the response bound in `planning/trace.mjs`. Move it when a second,
  non-CLI reader needs the figure.
- Static analysis: `workflow.lint_command` is unset and `detect-commands` reports
  `lint: null` for this root, so `npx tsc -p tsconfig.ci.json` is the only static
  analysis Cadence can find here. It ran clean at every commit gate.

## Goal check

The commits plausibly deliver the phase goal, with one criterion honestly outstanding
and one that this run cannot itself satisfy. The pricing half is real and observable:
`trace render --phase 1` now answers `{calls, tokens, unrecorded}` where before it
answered nothing, and the two-denomination rule is stated at the fold in
`planning/trace.mjs` rather than only in prose. The absent-versus-zero distinction the
goal names is pinned three ways - `trace.test.mjs:1300` asserts the key is absent for a
scope with no provider review call, and phases 2 and 3 return `{calls, unrecorded}`
with no `tokens` key at all. The bracket half (`TRC-12`) is a prose fix in `d7ada952`
and is therefore only as good as the next fallback that reads it; no fallback occurred
in this run, so nothing here demonstrates it. Two success criteria remain undischarged
and are carried as open items above: the `/cad-report` printed-line check, deferred to
`/cad-verify 1` at a human-verify checkpoint by user decision, and the two live-provider
arms plan 3 flagged. The sharpest gap is the resolve count: this run holds 2
`cad-reviewer` resolves against 6 provider review calls, which is exactly the shape
`CST-04` was opened against - the fix landed in `67868b46` partway through the run that
was breaking the rule, so the criterion is stated and shipped but not yet evidenced by
any run. Both `GH-228` and `GH-221` trace to REQUIREMENTS rows pointing at phase 1
(`TRC-12` and `CST-04`, `REQUIREMENTS.md:19-20`). The suite is green at HEAD: 3698
tests, 3697 pass, 0 fail, 1 skipped, with `npx tsc -p tsconfig.ci.json` exit 0 and
`self-verify` `ok:true` with 0 problems.
