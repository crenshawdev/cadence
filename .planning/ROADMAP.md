# Roadmap

## Overview

`v1.1.0` is shipped and tagged: the builtin memory backend, context-weight
measurement, the two-tier git branching model, and the milestone-close release
mechanics. Git history and the `v1.1.0` tag are its archive.

`v1.2.0` is the active cycle. Its theme is sharpening the spine's judgment
rather than adding surface: catch over-engineering at the point it is cheapest
to catch, stress-test the load-bearing decisions before code commits to them,
and repair the cross-model review seam that has been silently inert on any
symlinked install. It is a minor, backward-compatible release: a bug fix, two
guidance additions, and one new on-demand command.

Versioning: `v1.0.0` is the public baseline and `v1.1.0` is shipped. `v1.2.0`
is a straight minor bump cut at publish, with no release-candidate cycle.

## Phases

- [ ] **Phase 1: Repair the cross-model review seam** - fix `review-provider.mjs` no-opping on a symlinked path (realpath comparison, not as-typed argv), add a symlink regression test, and surface the empty-provider fallback instead of degrading silently. Foundational: unblocks every cross-model review path, including Phase 3's. (REV-01 / #12)
- [ ] **Phase 2: Planner separation-of-concerns heuristic** - bake a standing separation-of-concerns nudge into `cad-planner` so plans prefer small, single-purpose tasks over a shared core, with no per-phase restatement. (SOC-01 / #32)
- [ ] **Phase 3: Decision rigor** - add the decision-durability filter to `cad-context` (DEC-01 / #26), then `/cad-decision-review`, an on-demand refute-then-adjudicate pass over a load-bearing decision grounded against real sources (DEC-02 / #28). #26 names which decisions earn the expensive #28 pass.
