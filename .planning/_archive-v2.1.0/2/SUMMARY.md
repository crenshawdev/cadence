---
phase: 2
status: complete
completed: 2026-07-30
---

# Phase 2: Findings are a list, not a work order - Summary

An adjudicated review now ends at a user-triaged numbered survivor list defaulting
to NONE, authored once in `references/review-triggers.md` § 6 and pointed at from
five firing sites; the reviewer contract stops pre-filtering style findings; the
reviewer set is dispatched as one message, enforced by a new self-verify check
(`unbatched-dispatch`); and the cross-model seam refuses an over-cap payload
(`review.max_prompt_tokens`, default 120000 estimated tokens) before any request.

## What shipped

- The triage gate, authored once - `cadence-core/references/review-triggers.md`
  § 6 Consequence, `adjudicated` arm (numbered list, severity + `file:line` +
  claim, NONE first and the default, end the turn on the question, zero-survivor
  clause, `git.auto_close` carve-out)
- Five firing sites reaching it by pointer or explicit re-read, never a copy -
  `skills/cad-land/SKILL.md` step 3, `cadence-core/workflows/plan.md`
  `<step name="review">`, `cadence-core/workflows/verify.md` `route_failures`
  step 1, `cadence-core/workflows/execute.md` `execute_sequential` diff fire plus
  `execute_parallel` steps 5 and 6
- The reviewer contract's anti-padding clause deleted, anti-inflation kept -
  `skills/cad-reviewer-contract/SKILL.md:67`
- One-message batch dispatch stated as an instruction, hedge removed -
  `references/review-triggers.md` step 4 and step 3 (one route resolve per set),
  `workflows/decision-review.md`, `workflows/execute.md` `execute_parallel` item 1
- self-verify check 10 `dispatch-phrasing` - new pure lib
  `cadence-core/bin/lib/dispatch-phrasing.mjs`, wired into `self-verify.mjs` over
  `cadence-core/workflows/` and `cadence-core/references/` only
- The over-cap refusal on both paid commands - `cadence-core/bin/review-provider.mjs`
  `resolveMaxPromptTokens`, `estimatePromptTokens`, `assertUnderCap`, called in
  `cmdReview` and `cmdConsult` before `callStructured`
- `review.max_prompt_tokens` on all four config surfaces - `config.schema.json`,
  `references/config-reach.md`, `workflows/config.md`, `references/seams.md`
- The public account updated - `METHOD.md`, `README.md`,
  `skills/cad-plan-review/SKILL.md:52`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 7d3b60a | author the triage gate once as the adjudicated consequence |
| 1 | 2 | 1d47f74 | cad-land triages pre_ship survivors before it asks how to publish |
| 1 | 3 | a8e71c1 | the three workflow sites reach the triage gate |
| 1 | 4 | f5c830d | delete the reviewer's anti-padding clause, keep anti-inflation |
| 1 | 5 | 58ab673 | one batch, no hedge - concurrent dispatch stated as an instruction |
| 1 | 6 | 21f617b | self-verify fails a concurrent dispatch that does not say ONE message |
| 1 | 7 | fd47860 | the review seam refuses an over-cap payload on both paid commands |
| 1 | 8 | 3c05730 | review.max_prompt_tokens on all four surfaces CI requires |
| 1 | 9 | fa1ae1b | the public account of adjudication ends at the triage gate |
| 1 | fix | 308049b | reject a non-string payload field before the token cap |
| 1 | fix | c0f517d | scope the auto_close carve-out to pre_ship, gate cad-verify's fix list |
| 1 | fix | defe6d3 | METHOD's gate enumeration matches the shipped defaults |
| 2 | 1 | 7f01a58 | the unbatched-dispatch rule widens to the rule AC5 states |
| 2 | 2 | 8ad5759 | the seam and METHOD state the dispatch-phrasing rule that runs |
| 2 | fix | 5d1ad4e | a batch affirmation stops excusing the serialization beside it |
| 2 | fix | 11c2bd8 | an abbreviation is not a sentence end, a short fence closes no long one |

Range: `a04b478..HEAD` (`11c2bd8`), 19 commits, 25 files, +1531/-59. Plan 1 is
tasks 1-9 plus three fixes closing its own diff-review highs; plan 2 is the gaps
closure for UAT item 5 plus two fixes closing its diff-review findings.

## Deviations

- [deviation] Task 8 (`3c05730`): expected the four surfaces to land green;
  observed `self-verify.test.mjs:260` fail (`placeholder keys expand: <t> prose
  covers every trigger key`). That fixture enumerates every schema key so none
  reports `inert-config-key`, so a new key breaks it by construction.
  `review.max_prompt_tokens` was added to the fixture prose in the same commit.
- [deviation] Task 8 (`3c05730`): the schema `purpose` first read
  `Cross-model provider calls only` with a capital C. `lib/config-reach.mjs:138`
  compares case-sensitively (`purpose.includes(reach)`), so the reach row would
  have reported `unstated-reach`. Caught before commit; the phrase is now
  lowercase and verbatim.
- [deviation] Task 9 (`fa1ae1b`): the plan states "none of the three is weighed,
  so no `weight-budgets.json` change". `skills/cad-plan-review/SKILL.md` IS
  weighed and sat at exactly 2484, so the first parenthetical rewrite reported
  `budget-overrun` at 2495B. Resolved by trimming rather than raising the budget:
  the file measures 2448B, under budget, and no manifest change was needed.
- [deviation] Task 1 (`7d3b60a`): the plan's 1000-byte cap on the replacement
  bullet plus the 12550 file ceiling did not both fit the prose it specified. The
  zero-survivor rationale ("which reads identically to a review that never ran")
  was dropped; the instruction itself is in the file. Bullet landed at 986B, file
  at 12545B.
- [deviation] Task 3 (`a8e71c1`): the `§ 6 Consequence` citation initially wrapped
  mid-phrase at three sites, so a literal grep missed it. Rewrapped byte-neutrally
  so the phrase stays contiguous; the plan's `grep -n -A2 "review-triggers.md"`
  check now shows it at all five edited sites.
- [deviation] Plan 2 filename: the dispatch asked for `PLAN-GAPS.md`; the file is
  `PLAN-2.md`. `listPlanFiles` (`planning.mjs:729`) accepts only `PLAN.md` or
  `PLAN-<N>.md`, and `plan-overlap --phase 2` reported
  `nonconforming_plans: ["PLAN-GAPS.md"]` under the asked-for name.
- [deviation] Plan 2 was executed twice concurrently. A second session's executor
  landed `7f01a58` and `8ad5759` while this run's executor was still reading
  context; that executor's write was rejected ("File has been modified since
  read"), it made no commits, and it checkpointed `blocked` rather than race a
  live peer. The peer's result was verified independently (1123 pass / 0 fail,
  tsc 0, `self-verify` `problems: []`) and accepted on the user's decision.

## Open items

Plan 1's diff review fired `adjudicated` (config gate, overriding the critical
level's `blocking`) over four reviewers: `cad-reviewer-xhigh` (opus),
`openai/gpt-5.6-terra`, `gemini/gemini-3.6-flash`, `deepseek/deepseek-v4-flash`.
Ten candidate findings were killed in adjudication. Plan 2's diff review fired
the same gate over three (`gemini` dropped on an HTTP 503, reported not
swallowed); eight survived adjudication, five were killed.

**Closed after this summary was first written**, listed so the record is not read
as still-open: the non-string payload bypass of the token cap (`308049b`); the
`git.auto_close` carve-out mis-scoped to the generic `adjudicated` arm, and
`/cad-verify`'s ungatable fix-list condition (both `c0f517d`); METHOD.md's "Four
gates end this way" enumeration (`defe6d3`); the loop-head/hedge narrowness of
`dispatchPhrasingIssues` and its block-scoped `BATCHED` (both `7f01a58`); the
`maskCode` fence gaps (`7f01a58`, `11c2bd8`); and `self-verify.mjs`'s inaccurate
scope rationale (`8ad5759`, with the test-file residue re-filed below).

The rest of what plan 2's own review found, all fixed rather than deferred: a
batch affirmation excusing the serialization beside it - which left the guard
blind to the exact regression it exists to prevent, verified by restoring
`one dispatch per message, in the background` into the shipped `execute.md` item 1
and getting `[]` (`5d1ad4e`); `e.g.`/`i.e.` splitting a compliant sentence in half;
a short fence closing a long one, plus an indented `~~~` blanking the rest of
a file fail-open (both `11c2bd8`); and the two over-eager arms plus the catalog-row
false positives, all three closed by one predicate in `e9b05d4` - only a sentence
in the IMPERATIVE MOOD issues a dispatch, so a rationale, a negation, an inflected
description and a wiring-table row stop reporting. The same commit splits
sentences at bracket depth zero, so a `(conventions.md ...; seams.md ...)`
citation is no longer cut into a compliant half and an unbatched-looking half.
An earlier draft of this summary deferred the two arms; they are fixed, and the
re-measurement that deferral asked for was run (33 in-scope files, 0 issues,
every previously closed false negative still reported).

Still open:

- [low] A single markdown table row is still evaluable as an instruction: a row
  reading `| review.fanout | bool | Dispatch all reviewers in parallel | true |`
  returns one issue, because a table pipe is a clause opening and `Dispatch`
  after it reads as an imperative. Accepted rather than latent since `e9b05d4`:
  one row per block is what keeps a genuine one-row instruction checkable, and a
  test pins both sides - that row reports, the `phase_diff` and `plan` catalog
  rows in `references/review-triggers.md` do not. `workflows/config.md:86-118`
  carries the same table shape.
- [low] `self-verify.test.mjs:1110-1112` still carries the scope rationale task 2
  corrected in `self-verify.mjs:421-423` of the same commit. Plan-scope residue:
  task 2 mandated leaving those three rows byte-unchanged.
- [low] `references/config-reach.md:47-51` still declares "Four phrases are in use
  today" and lists four; this phase's row at `:125` adds a fifth,
  `cross-model provider calls only`, alongside fourteen `cross-model reviewers
  only` rows. Nothing machine-checks the vocabulary, so the next narrow-reach key
  has two sanctioned spellings.
- [low] `self-verify.mjs`'s stated reason for scoping check 10 to two directories
  ("skills/agents/templates carry no dispatch instructions of their own") is
  inaccurate: `skills/cad-capture/SKILL.md:34` is a concurrent-dispatch
  instruction, and `self-verify.test.mjs` pins the skills blind spot as intended
  behaviour.
- `design-notes/flow-audit-2026-07-24.md:33` still quotes "in parallel where the
  host allows". Left as-is deliberately: it is a tracked, dated historical audit
  record and rewriting it would falsify a snapshot. The plan's sweep is scoped to
  `cadence-core/ skills/ agents/`, all clean.
- Two CONTEXT assumptions stay open and are not closable here: whether the host
  caps a single subagent prompt (if not, the `claude-subagent` arm is the one
  unbounded payload in the subsystem), and whether `chars/4` over- or
  under-estimates against each provider's own max-input ceiling.
- `references/review-triggers.md` finished at 12871B against D-21's 12900 ceiling.
  ~29B of headroom in a file `@`-preloaded into two skills per invocation; anything
  further added there needs a subtraction alongside it.

## Goal check

The nineteen commits deliver the phase goal, and the two gaps this paragraph
named at plan 1's close are now shut. The triage gate exists and is authored
once: `references/review-triggers.md` § 6 Consequence carries the numbered list,
NONE-first default, end-the-turn instruction and zero-survivor clause, and the
five firing sites point at it rather than copying it. The work-order readings are
gone - `grep -rn "where the host allows" cadence-core/ skills/ agents/` returns
nothing. The reviewer contract reads "- No severity inflation." with no padding
clause (`skills/cad-reviewer-contract/SKILL.md:67`).

AC5 was the one UAT failure and is the reason plan 2 exists. It is now met on the
criterion's own wording rather than the narrower rule plan 1 shipped:
`dispatchPhrasingIssues('Dispatch each reviewer concurrently.')` returns one
`unbatched-dispatch` where it returned `[]` at `9075117`, and the two-sentence
whitewash returns one issue quoting only the offending second sentence. The
guard is now also failing-capable against the regression it exists to prevent,
which it was NOT when plan 2's executor finished: restoring
`one dispatch per message, in the background` into the shipped
`cadence-core/workflows/execute.md` item 1 returned `[]` under `8ad5759` and
returns one problem under `5d1ad4e`. That was the diff review's blocker, found by
`cad-reviewer-xhigh` and `openai` independently and confirmed by running both
libs side by side.

AC7 is green at HEAD: `node --test cadence-core/bin/*.test.mjs` reports 1138 pass
/ 0 fail, `npx tsc -p tsconfig.ci.json` exits 0, and
`node cadence-core/bin/self-verify.mjs` returns `ok:true` with `problems: []` and
`dispatch-phrasing` in its `checked` string.

What is not delivered: nothing in the acceptance criteria. Two open items remain,
neither in the heuristic's contract - a single table row still evaluable as an
instruction, which is the accepted cost of one row per block and is pinned by a
test on both sides, and a stale scope comment in the test file.
