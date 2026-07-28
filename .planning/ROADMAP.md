# Roadmap

## Overview

`v1.3.1` is shipped and tagged — the latest in the lineage from `v1.0.0`
through `v1.1.0`, `v1.2.0` (cross-model review seam, durable-decision recall,
DeepSeek provider), the `v1.2.1` sweep-highs patch, the `v1.3.0` liteSpeed
flow-and-latency pass, and the `v1.3.1` tech-debt cycle that closed all 13 bugs
from the post-v1.2.0 sweep. Git history and each release tag are that cycle's
archive.

**v1.4.0 — Stated grammars** is the active cycle (opened 2026-07-27). Cadence
parses formats it owns with accreted heuristic regexes, and every one of them
fails silently in both directions: an over-read fabricates a requirement id that
surfaces as an `/cad-audit` orphan, an under-read drops a real path and hands
the parallel-safety gate a false `overlaps: []`. Both look like success. This
cycle replaces three of those readers with grammars that are written down, plus
the spine bookkeeping that has now failed at two consecutive milestone closes.

## Phases

No cycle is open. The shipped milestone's entries were pruned at its close;
the `v1.4.0` tag and git history are their archive. `/cad-phase add` opens the
next cycle's first entry.
