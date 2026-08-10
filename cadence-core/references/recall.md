# Recall: the result shape, and how each caller renders it

Read at the one step that runs recall. Two commands call
`planning.mjs recall` - `/cad-context` at `analyze`, `/cad-debug` at
Hypothesize - and the return is identical for both, so the contract is stated
here once instead of drifting in two workflows.

What is deliberately NOT here: the `memory.backend` `builtin`/`none` gate. It
stays inline at every calling site so a run on the `none` path learns the step
is skipped without reading anything, and reaching this file at all means recall
already ran.

## The return

`planning.mjs recall "<terms>"` prints one JSON line:

```
{ok, results:[{score, source, phase?, snippet}]}
```

`results` is ranked, best first; render the TOP results and let the tail go.
Each rendered line carries that result's `snippet`, its `source` file and its
`phase`.

`phase` is OPTIONAL - a phaseless `CAPTURE.md` item omits it. Render it only
when present, matching the omit-optionals convention; never substitute a blank,
a placeholder or an inferred phase number. Empty `results` renders nothing.

## /cad-context: a block in the analyzer payload

Render the top results as a `<recalled_memory>` block in the
`cad-assumptions-analyzer` dispatch payload, placed right after
`<search_terms>`, one line per result. On empty results omit the BLOCK itself
rather than sending an empty one.

Those snippets ride the DISPATCH PROMPT and never the
`cad-assumptions-analyzer` definition (D-01 / cache discipline): they are
volatile per-phase data, while the agent's stable instruction to consume and
cite them lives in its cached file. Putting them in the definition would
invalidate that cache once per phase and buy nothing.

## /cad-debug: folded into the hypotheses

No block and no payload - there is no debug subagent, so the main model holds
the results directly. Fold any matching past deviations and UAT findings into
the candidate hypotheses, noting each in the Hypotheses list with its `source`
file and its `phase` when present.

A recalled hypothesis is a candidate like any other: ranked with the rest and
confirmed by evidence, never assumed because it happened before.
