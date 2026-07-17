# Roadmap

## Overview

Cadence `v1.1.0-rc.2` is tagged (release candidate, unpublished): a two-tier git
branching model (a per-milestone integration branch as the parallel-worktree
reconciliation point, plus a `trunk` escape hatch), land cleanup and an opt-in
autonomous close (`auto_close`, with the never-auto-push rail intact), and release
mechanics folded into the milestone close (manifest bump + changelog). Its four
phases are complete and pruned from the live list — git history and the
`v1.1.0-rc.2` tag are their archive.

Versioning: `v1.0.0` is the public baseline. The work toward the next public
release ships as release candidates (`v1.1.0-rc.1`, `-rc.2`, …), one per
iteration; the final `v1.1.0` tag is cut only at publish.

The next iteration is the final `v1.1.0` publish: exercise the deferred
`auto_close` live end-to-end run (real remote + merge), then cut and publish
`v1.1.0`. Its phases are not planned yet — run `/cad-plan` to write them.

## Phases

_No active phases — the next iteration has not been planned._
