---
phase: 1
status: complete
completed: 2026-08-10
---

# Phase 1: The checks that make the cuts safe - Summary

Two CI capabilities that make this cycle's cuts falsifiable: region-scoped
deferral anchors (a `Read` sentence in a workflow `<step name=...>`, a
heading-scoped walk step or a contract skill can now be watched by check 13),
and check 16, which fails an `@`-include no eager prose of its own command
ever names.

## What shipped

- Region-scoped anchor grammar - `regionLabels()` in
  `cadence-core/bin/lib/deferred-reads.mjs`: a frame STACK for `<tag>` blocks,
  `name=` attributes, nested numbered items (`execute_parallel(6)`), lettered
  arms, and a heading path family for workflows carrying no tags. Matching is
  exact, never a prefix.
- Per-row `file` field plus a `rows` parameter on `deferredReadIssues()`, and a
  new `deferred-read-missing-file` code, so a register row can anchor outside
  its own SKILL.md - `cadence-core/bin/lib/deferred-reads.mjs`.
- `commandEagerSets(root)` extracted from `residentWeight` -
  `cadence-core/bin/lib/resident-weight.mjs` - so a second rule can consume the
  eager set without re-deriving it.
- The include-consumer rule - `cadence-core/bin/lib/include-consumers.mjs`:
  `<branch>/<file>` matching, the `cadence-core/workflows/*` exemption, the
  self-surface and `@`-line exclusions, and a one-row `WAIVED` register bounded
  in both directions (`include-waiver-stale` downward, `include-waiver-expired`
  upward against ROADMAP).
- Check 16 wired into `cadence-core/bin/self-verify.mjs:1221` (`checked` now
  ends `nul-bytes, include-consumers`), plus a `CADENCE_DEFERRED_READS` rows
  seam for check 13 matching the existing `CADENCE_ROUTE_TABLE` precedent.
- Tests: `cadence-core/bin/deferred-reads.test.mjs` and
  `cadence-core/bin/include-consumers.test.mjs` new; `self-verify.test.mjs`
  139/139. Repo-wide 1516/1516 pass.
- Ledger: `SELFVERIFY-01` in `.planning/DOCS-CLAIMS.md` under
  `## Claims added after run 1`; ROADMAP phase 2 criterion 1 now carries the
  `WAIVED`-dies-with-the-include pairing.

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | d91a721 | Register rows name their own file; rule takes its rows |
| 1 | 2 | a0f5578 | `regionLabels` labels named steps, nested items and plain tags |
| 1 | 3 | 4fb109e | Heading-scoped labels for workflows carrying no tags |
| 1 | 4 | 936e135 | `resident-weight` exports the eager set it already builds |
| 1 | 5 | 9eaef70 | The include-consumer rule, with its one stated waiver |
| 1 | 6 | b52c590 | Register the check as check 16 in self-verify |
| 1 | 7 | 4de81e4 | Ledger row for check 16, and the phase-2 waiver coupling |

Range: `3cc4549..4de81e4`, 7 commits.

## Deviations

- [deviation] Task 1 asked for a second contract pair anchored at
  `worktree_mode`, but `<worktree_mode>` is a plain tag only Task 2's grammar
  labels - added in Task 2 instead, so Task 1's own Verify passes (a0f5578).
- [deviation] `detect-commands --root .` returns `lint:null, typecheck:null`
  (no package.json); the repo's CI typecheck
  `./node_modules/.bin/tsc -p tsconfig.ci.json` was run as the static-analysis
  step at every commit instead.
- [deviation] Task 6 named a check-13 "test seam" without choosing its shape;
  implemented as the `CADENCE_DEFERRED_READS` path-override env var, matching
  the `CADENCE_ROUTE_TABLE` / `CADENCE_CONFIG_SCHEMA` precedent rather than
  adding a CLI flag to a shipped seam's contract (b52c590).
- [deviation] Task 7's Verify step 6 specified a whole-file
  `grep -c '^| ' .planning/DOCS-CLAIMS.md`, which necessarily changes when a row
  is appended anywhere; counted region-scoped instead (548 before and after),
  which is the property the step actually states (4de81e4).

## Open items

From the `diff` review (advisory gate, cross-model voice `openai/gpt-5.6-terra`,
adjudicated against the code). All four are latent - none reproduces on the
live tree, and self-verify is `ok:true` with `problems:[]`:

- [ ] `deferred-reads.mjs:250-256` - closing a NESTED tag clears `item`/`arm`
  instead of restoring the enclosing frame's, so a `Read` sentence sitting after
  an editorial nested block inside a numbered process item labels `null` and
  would report a false `deferred-read-unread`. No current register row is in
  that shape; it bites the first workflow edit that nests a tag inside a
  numbered arm. Confirmed by reading the code: both the `open` and the `close`
  branches assign `item = null; arm = null`, with no save/restore.
- [ ] `deferred-reads.mjs:373-381` - `byRegion` keys on the label string, and
  neither a `<step name=...>` nor a heading PATH is required to be unique within
  a file. Two identical labels concatenate, so a `Read` in the first occurrence
  satisfies an anchor pointed at the second. Heading paths are hierarchical, so
  a collision needs two identical full paths (or two same-named steps) in one
  file - an authoring mistake rather than a normal state, but nothing detects
  it.
- [ ] `include-consumers.mjs:176` - `\b${surface}\b` treats a longer path with
  the include path as its prefix as a naming (`references/foo.md.bak` satisfies
  `references/foo.md`, since `\b` matches before the `.`). A false pass needs
  prose naming such a superstring path while never naming the real one;
  contrived for the current scan set, but the anchor is weaker than the header
  claims.
- [ ] `include-consumers.mjs:204` - `expiredWaiver` recognizes exactly one
  ROADMAP rendering (`^- [x] **Phase N:`). An indented or `###`-section
  completion of phase 2 would not trip the upward bound. The downward
  `staleWaiver` arm still fires the moment the include is deleted, so the bridge
  cannot silently outlive its include - only its deadline is soft.

## Goal check

The phase goal was that a deferral made this cycle is watched by CI afterwards,
and that the 5,792 B dead-include class of defect cannot return silently. Both
halves land, and both are proved against real bytes rather than assertions.
The watching half: `regionLabels()` now labels four region families
(`cadence-core/bin/lib/deferred-reads.mjs:224-292`), with the exactness rule
written down (`:215-220`) so an anchor `execute_parallel` is not satisfied by a
sentence in `execute_parallel(6)`; the register gained a `file` field so a row
can anchor in a workflow rather than only a SKILL.md (`:348-367`), which is what
phase 3's moves need. The dead-include half: check 16 is live in `checked`
(`self-verify.mjs:1221`) and, run with an empty waiver list over a byte-copy of
`skills/cad-verify/SKILL.md` plus `cadence-core/workflows/verify.md`, reports
exactly one problem naming `cadence-core/templates/UAT.md` - the live defect,
caught by the rule rather than by a synthetic fixture, which is precisely what
phase 2's `Depends on:` line demanded. The register-integrity invariants hold:
`DEFERRED_READS.length` is still 4, the four rows are byte-identical (asserted
against a checked-in literal and falsified on purpose during task 7), and
`git diff --stat 3cc4549..HEAD -- skills cadence-core/{references,templates,workflows} agents weight-budgets.json`
is empty, so no measured prose surface moved and `weight.mjs resident` is
byte-identical by construction. Evidence for the whole: `node
cadence-core/bin/self-verify.mjs` returns `ok:true` with `problems:[]`, and
`node --test cadence-core/bin/*.test.mjs` is 1516/1516, 0 fail. What is NOT
delivered, honestly: the two anchor-matching weaknesses in the open items above
mean the grammar's guarantee is "a Read sentence in a uniquely-labelled region
that contains no nested tag", one notch narrower than the header claims. Neither
affects any live row, but phase 3 moves real prose onto this grammar, so they
are worth closing before then rather than after.
