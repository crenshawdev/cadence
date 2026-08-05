# Roadmap

## Overview

`v2.3.0 — where the bytes live`. Cadence measured its own cost and found it is
not thinking too hard, it is carrying too much: 108.5k resident context per
assistant turn against 565 output tokens, cache reads alone 62.7% of spend. The
ordering below is by WHERE the bytes live, not how many there are — a 30KB file
read once near the end of a run is cheaper than 3KB that lands in turn one. So
phase 1 takes the most expensive class, bytes a child returned that the
orchestrator then carries for every remaining turn; phase 2 takes bytes that
land in turn one regardless of which branch a command takes; phase 3 takes the
bytes that ride every session in every project, and closes by putting the
unbudgeted surfaces under the ratchet that already watches the rest — last,
because budgeting them first would mean regenerating the manifest on every
preceding commit.

Shipped lineage: `v1.0.0` baseline, `v1.1.0` file-based memory and BM25
recall, `v1.2.0` cross-model review seam and durable-decision recall, `v1.2.1`
sweep-highs patch, `v1.3.0` liteSpeed flow pass, `v1.3.1` tech-debt cycle,
`v1.4.0` four stated grammars, `v1.4.1` two self-contradicting contracts,
`v1.5.0` the self-description corrections that staged the stakes cycle,
`v2.0.0` the stakes axis itself - the rung ladder, the bundle cell, the
computed risk floor, acceptance-criteria ids, and the last resolved-then-
dropped config keys, `v2.1.0` the coverage and triage gates, and `v2.2.0` the
rest of the residue - the config read face, the parser subtraction, the honest
release seam, the true rung-ladder claims, and the install path proven live.
Git history and each release tag are their archive.

## Phases

## Phase Details

