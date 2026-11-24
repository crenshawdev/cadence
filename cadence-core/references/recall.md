# Recall: the result shape, and how each caller renders it

## The return

`planning.mjs recall "<terms>"` prints one JSON line:

```
{ok, results:[{score, source, phase?, snippet}], total}
```

`results` is ranked, best first, and BOUNDED - `--top N` returns at most N,
default 5. `total` is how many matched. Raise `--top` only when the caller
genuinely consumes the tail; nothing in the spine does.

Each rendered line carries that result's `snippet`, its `source` file and its
`phase`.

`phase` is OPTIONAL - a phaseless `CAPTURE.md` item omits it. Render it only
when present; never substitute a blank, a placeholder or an inferred phase
number. Empty `results` renders nothing.

A `source` whose LEADING segment is a milestone label, as in
`v3.5.2/phases/1/SUMMARY.md`, names an artifact from a CLOSED milestone.
Everything after the label is the artifact itself. Those rows rank FLAT with
the live ones, so the caller weighs them.

## /cad-context: a block in the analyzer payload

The top results go in the `<recalled_memory>` block of the payload in
`workflows/context.md`'s `analyze` step, which shows the block, its place and
when it is left out.

## /cad-debug: folded into the hypotheses

No block and no payload. Fold any matching past deviations and UAT findings into
the candidate hypotheses, noting each in the Hypotheses list with its `source`
file and its `phase` when present.

A recalled hypothesis is a candidate like any other: ranked with the rest and
confirmed by evidence, never assumed because it happened before.
