---
slug: batched-review-fidelity
requirement: BCH-01
issue: 174
opened: 2026-08-21
status: invalidated
---

# Spike: does a batched review find what N single-diff reviews find?

## The question

Two questions, and the order matters because the first one is free and can kill
the second:

1. **Economics** - is the per-invocation cold prefix a material fraction of what
   reviews actually cost on this project's record? If it is not, batching saves
   little and the trade below is not worth making.
2. **Fidelity** - does one review over N diffs find what N reviews over one diff
   each find? A per-commit review is scoped to one change ON PURPOSE, so
   batching spends that scoping to buy the prefix back. That is a real trade
   rather than free, which is #174's own stated unknown (ROADMAP.md:32).

## The decision that hinges on it

- **validated** -> `BCH-01` becomes a phase: batch N diffs into one process.
- **invalidated** -> `BCH-01` closes with a note, #174 closes with that note, and
  the id moves to Deferred carrying it, per ROADMAP.md's Overview.

## What could not be verified, and why it is recorded rather than assumed

`PROJECT.md:139-140` cites "a cold prefix per security-review invocation, 61 of
them". That figure is not reproducible from the local record: `trace.jsonl`
holds 273 dispatch brackets of which **8** carry a reviewer role, 6 with token
counts. The tracker issue that would settle it lives on the self-hosted Forgejo
instance and is not reachable from here (`gh` resolves the frozen GitHub
mirror, which does not carry it).

So the 61 is either counting something the trace does not bracket - cross-model
`review-provider.mjs` API calls, or `/security-review` skill invocations, neither
of which writes a dispatch bracket - or it is drawn from a run older than this
trace. **C1 is measured against the 8 brackets that exist, and the verdict states
that scope rather than inheriting the 61.** If C1's answer would flip at 61
invocations, that is said explicitly rather than papered over.

## Criteria (written before the experiment, risk-ordered)

### C1 - the free kill shot: is the prefix material?

Given the fixed per-invocation prefix a `cad-reviewer` dispatch pays
(`skills/cad-reviewer-contract/SKILL.md` + `agents/cad-reviewer*.md`, the bytes
every fire re-sends before it reads its first diff),
When that prefix is compared against observed reviewer dispatch token counts in
`trace.jsonl`, and the batching saving is computed as `(N-1) x prefix` over the
total reviewer spend for the same N,
Then the saving is **>= 20%** of reviewer spend -> material, continue to C2;
the saving is **< 10%** -> **invalidated on economics**: batching buys a rounding
error and the fidelity trade is not worth making at any price.
Between 10% and 20% -> continue to C2, but the verdict must state that the
saving is modest and let the fidelity result carry more weight.

This runs first because it costs nothing, and because a negative here ends the
spike without spending a single review dispatch.

### C2 - the real unknown: fidelity under batching

Given N real diffs from this repository's own recent history,
When N single-diff `cad-reviewer` dispatches are run and compared against ONE
dispatch handed all N diffs together,
Then the batched pass surfaces every finding the single passes rated
blocker/high, and attributes each to its correct diff
-> **validated**: the scoping loss is affordable;
the batched pass MISSES a blocker/high that a single pass found, or merges
findings so they cannot be attributed to a diff
-> **invalidated**: batching trades away the per-commit scoping that makes the
blocking gate trustworthy, which is the guarantee `risk-check status` joins
receipts to.

**Budget, fixed before running:** N = 2, so C2 costs exactly 3 dispatches
(2 single + 1 batched). That is the whole subagent budget for this spike. N = 2
is a WEAK test of batching fidelity and the verdict says so - it can catch a
gross failure, not a subtle degradation. A stronger N is a phase-sized
measurement, not a spike, and if C2 passes at N = 2 the recommendation must say
that the phase still has to prove it at a realistic N.

## Observed results

### C1 - prefix materiality: FAILS THE BAR

Fixed per-invocation prefix, on the definition this project already uses:
`skills/cad-reviewer-contract/SKILL.md` (6,240 B) + `agents/cad-reviewer.md`
(465 B) = 6,705 B, about **1,676 est tokens**.

Observed `cad-reviewer` dispatches carrying token counts in `trace.jsonl` - all
6 of them: 125,100 / 105,439 / 78,788 / 57,563 / 45,437 / 25,753. Total reviewer
spend 438,080 tokens.

| figure | value |
|---|---|
| batching saving, `(N-1) x prefix` | 8,380 tokens |
| **saving as % of reviewer spend** | **1.91%** |
| prefix as % of the median dispatch | 2.13% |
| breakeven prefix for the 10% bar | 8,762 tokens |
| breakeven prefix for the 20% bar | 17,523 tokens |

Below the 10% bar by a factor of five.

**It does not flip at 61 invocations.** The spike promised to check this rather
than inherit the figure: 61 median-sized fires cost 4,806,068 tokens and would
save 60 x 1,676 = 100,560, which is **2.09%**. The saving is a fixed ~2% of
review spend at any N, because it is a ratio of two quantities that both scale
with N. The "61 of them" framing makes the absolute number bigger and the
fraction identical.

### Why the payload, not the invocation count, is the bill

The 6 dispatches span 25,753 to 125,100 tokens - a **4.9x spread** around a
1,676-token fixed cost. A dispatch's price is set almost entirely by what it was
mailed, not by what it re-establishes. This reproduces `CAPTURE.md:271`'s prior
measurement from the other direction: "the reviewer payloads are NOT the
problem: a `plan` fire mails 8-17 KB and `risk_surface` mailed 13,248 B for plan
1; verbatim's 106 KB packet was a large DIFF, i.e. plan size again, one layer
downstream."

### C2 - fidelity: NOT RUN

C1's result ends the spike under its own risk-first ordering. **Zero review
dispatches were spent**, which is the entire point of testing the free criterion
first.

## Verdict

**invalidated** - on economics, before the fidelity trade was ever tested.

Batching N review fires into one process saves ~2% of review spend at any N. The
per-commit scoping that #174 correctly identifies as a real cost would be traded
away to buy a rounding error.

### The definition this rests on, stated so it can be challenged

"Cold prefix" here is Cadence's own re-sent bytes - the reviewer contract plus
the agent definition - which is the definition `CAPTURE.md:271` already used when
it measured the executor's fixed prefix as "2,680 est tok + 110". Applied
consistently, that is 1,676 tokens for `cad-reviewer`.

What this does NOT count is the host harness prefix (system prompt, tool
schemas) that a subagent dispatch pays before Cadence's contract is reached.
Batching would collapse `(N-1)` of those too. That prefix is not measurable from
`trace.jsonl`, so the honest statement of the limit is: **this verdict flips only
if the harness prefix exceeds ~7,100 tokens** (8,762 breakeven minus Cadence's
1,676). Two reasons not to hold the verdict open for it:

1. The smallest observed dispatch is 25,753 tokens INCLUDING its payload and
   output, which caps any fixed prefix well below what a 4.9x spread would show
   if a large fixed cost dominated.
2. Sequential review fires land inside the prompt-cache TTL, so the harness
   prefix is a cache hit rather than a cold cost on exactly the runs where
   batching would apply.

If either turns out wrong, re-open with a direct measurement of one dispatch's
input split into prefix and payload - that single number decides it, and nothing
in this spike substitutes for it.

## Recommendation

1. **Close `BCH-01` with this note and move the id to Deferred carrying it**,
   per ROADMAP.md's Overview: an invalidated spike "closes its issue with a note
   and its id moves to Deferred carrying that note - it does not quietly
   vanish." Close #174 with the same note.
2. **The real lever is payload size, and it is already filed.** `CAPTURE.md:271`
   carries a three-part fix - a `workflow.max_plan_tokens` declared-weight rail,
   planner discipline putting symbol/line anchors in `files:` instead of bare
   paths, and executor discipline preferring targeted `grep`/`sed` over
   whole-file `Read`. That capture is about executor spend, but the 4.9x reviewer
   spread says the same root cause prices reviews. If cost-per-review is the goal,
   that is the requirement to promote, not this one.
3. **Do not carry the "61 invocations" figure forward** without re-deriving it.
   It is not reproducible from `trace.jsonl` (8 reviewer brackets, 6 with
   tokens), and as a fraction of spend it changes nothing.

## Throwaway code

None written - C1 was two `node -e` one-liners over `renderTrace().brackets` and
`wc -c`. Nothing to discard.
