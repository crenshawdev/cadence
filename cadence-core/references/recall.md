# Recall: the result shape, and how each caller renders it

Read at the one step that runs recall. Three commands call
`planning.mjs recall` - `/cad-context` at `spend_gate`, `/cad-debug` at
Hypothesize, `/cad-plan` at `spawn_planner` and again on the under-threshold
`inline_plan` path - and the return is identical for all three. Two of them
read the contract here rather than drifting it across their workflows;
`/cad-plan` does not Read this file, it restates the return shape inline at its
own step.

What is deliberately NOT here: the `memory.backend` `builtin`/`none` gate. It
stays inline at every calling site so a run on the `none` path learns the step
is skipped without reading anything, and reaching this file at all means recall
already ran.

## The return

`planning.mjs recall "<terms>"` prints one JSON line:

```
{ok, results:[{score, source, phase?, snippet}], total}
```

`results` is ranked, best first, and BOUNDED - `--top N` returns at most N,
default 5. `total` is how many matched, so a truncated answer reads as
truncated rather than as a thin corpus. Raise `--top` only when the caller
genuinely consumes the tail; nothing in the spine does.

The bound is not a nicety. Unbounded, a real query on a mature `.planning/`
returned 72 results at 55.8 KB - past the host's spool threshold, so the caller
paid the emit AND a second round trip to read back the five hits it wanted.
Same query bounded: 953 B.

Each rendered line carries that result's `snippet`, its `source` file and its
`phase`.

`phase` is OPTIONAL - a phaseless `CAPTURE.md` item omits it. Render it only
when present, matching the omit-optionals convention; never substitute a blank,
a placeholder or an inferred phase number. Empty `results` renders nothing.

A `source` whose LEADING segment is a milestone label, as in
`v3.5.2/phases/1/SUMMARY.md`, names an artifact from a CLOSED milestone.
Everything after the label is the artifact itself, so a retired deviation, UAT
item and decision stay as separable as their live counterparts.

Those rows rank FLAT with the live ones: no recency term, no per-source cap.
Retired work is sometimes the best answer in the corpus and only the caller
knows whether this query wants it, so the discounting is deliberately the
caller's - which a reader who does not know what the leading segment means
cannot do. That is the whole reason this paragraph is here.

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
