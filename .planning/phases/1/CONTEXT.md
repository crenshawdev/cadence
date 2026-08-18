# Phase 1: The guards that remove a protection - Context

Gathered: 2026-08-18
Feeds: /cad-plan 1

## Scope boundary

In: `resolveProtectedBranches` stops returning a list that protects nothing
(GRD-01, #219), and the bulk-output scratch transport becomes per-run with a
read-back that refuses a truncated or stale file (SCR-01, #223). Six scratch
sites, one resolver module, five resolver callsites, and the stated rule in
`references/conventions.md` that re-creates the pattern.
Out: the permissive-flag `--dir` reader and the other argument faces (phase 2);
`git-publish`'s `tornLayerDetail` refusing on any `mergeLayers` warning
(`.planning/CAPTURE.md`, still open); `config.mjs validate`'s `array_string`
type, which keeps rejecting a string (prior D-08, not reopened); the five prose
readers of `git.protected_branches`, which read `config.mjs get` and are named
here only so the planner does not assume the lib fix reaches them.
Deferred: None.
Plan shape: multiple plans, same phase - GRD-01 (AC1-AC3) and SCR-01
(AC4-AC6) share no code; AC7 rides the later plan.

## Durable decisions

- D-01 (grammar): the `protected_branches` grammar applies to ARRAY ELEMENTS,
  not only to the string spelling - both filter to non-empty trimmed strings,
  written down and tested per row. `[""]` is byte-identical to the value
  GRD-01 forbids, reached by a different spelling. Evidence:
  `cadence-core/bin/lib/protected-branches.mjs:17-21,39`, measured live
  2026-08-18 (`""` -> `[""]`, `[""]` -> `[""]`, `["","main"]` -> `["","main"]`);
  v1.4.0 stated-grammar principle.
- D-02 (grammar): an out-of-grammar value falls to the DEFAULT
  `['main','master']`, not to `[]` - a value naming no branch is a typo, not
  the user saying "protect nothing". Filtering that EMPTIES a non-empty input
  falls back; an input that was already `[]` stays `[]`, preserving prior D-09.
  Evidence: `cadence-core/bin/protected-branches.test.mjs:17-22`,
  `cadence-core/bin/git-guard.test.mjs:162-167`; the `[]` reading would leave
  `base === undefined` at `land-cleanup.mjs:111` and `issue-check.mjs:214`.
- D-03 (config face): prior D-08 is NOT reopened - `config.mjs validate` keeps
  rejecting a string as `array_string` while the readers honor it. Evidence:
  `cadence-core/config.schema.json:46`, `cadence-core/bin/config.mjs:74-76`,
  `.planning/CAPTURE.md`. Reversing it means either dropping the `#38`
  tolerance or giving `array_string` a union form every list-valued key
  inherits by construction.
- D-04 (transport rule): `references/conventions.md:98` states the bulk-output
  rule in fixed-shared-path form (`> "${TMPDIR:-/tmp}/<name>"`) and changes
  with the sites - otherwise the next conversion re-creates a seventh site
  from the rule itself.
- D-05 (transport mechanism): the per-run path must survive BETWEEN Bash
  invocations, so `&&`-coupling alone cannot serve all six sites. The Bash
  tool persists the working directory but not shell state, and two sites split
  their write and read across different fenced blocks
  (`workflows/report.md:29` vs `:64`; `references/review-triggers.md:202` vs
  `:241`). A bare `D="$(mktemp -d)"` is empty in the second block and
  `--payload` resolves to `/cad-payload.json` at a blocking gate.
- D-06 (transport mechanism): the run's `corr` is NOT usable as the scratch
  filename. `cadence-core/bin/lib/trace.mjs:212-229` derives it by reading
  `.planning/trace.jsonl` and `cadence-core/bin/planning.mjs:3441-3443` emits
  it as a field of the very bulk response the scratch file exists to hold; no
  seam face prints `corr` alone.
- D-07 (what holds it): self-verify check 20 CANNOT verify the per-run
  property - it tests redirect SYNTAX only, so `> /dev/stdout` and a fixed
  shared name both pass. Something else has to hold SCR-01 in place (AC5), or
  the next prose edit reverts it with a green self-verify. Evidence:
  `cadence-core/bin/lib/bulk-output.mjs:325`, `.planning/CAPTURE.md:147`.
- D-08 (gate semantics): a read-back's refusal lands on the STOP-and-ask arm,
  never on a numeric answer - a parse or shape failure means the gate could
  not be evaluated. Evidence: `cadence-core/references/triage-gate.md:63-72`
  and `:82` (unguarded `JSON.parse`, and a `filter` comparing against the
  FILE's own `corr`, so a stale file answers self-consistently);
  `cadence-core/workflows/progress.md:100` (`JSON.stringify` of four
  `undefined` fields prints `{}`, which reads as success).

## Decisions

- D-09 (reach): the GRD-01 fix lands in `lib/protected-branches.mjs` alone and
  reaches FIVE callsites - `git-guard.mjs:139`, `git-publish.mjs:112`,
  `git-branch.mjs:61`, `land-cleanup.mjs:110-111`, `issue-check.mjs:214` - of
  which the last two index `[0]`, so what an out-of-grammar value resolves to
  moves a BASE REF, not only a guard verdict. The module header at
  `protected-branches.mjs:2-4` says "the four readers" and
  `references/config-reach.md:137` names three; both are stale.
- D-10 (reach): `config.mjs get` does not route through the resolver
  (`cadence-core/bin/config.mjs:273-274`), so the five prose readers
  (`workflows/plan.md:37`, `workflows/execute.md:32`, `workflows/adopt.md:44`,
  `workflows/new-project.md:68`, `skills/cad-land/SKILL.md:30`) keep seeing the
  raw value and are NOT fixed by a lib change. Named here so the planner does
  not assume otherwise.
- D-11 (site list): the collision set is SIX sites - five distinct fixed shared
  paths across four surfaces on nine command lines, plus the slug-keyed task
  diff. `cad-rearm.json` (`references/triage-gate.md:81` write, `:82` read),
  `cad-trace.json` (`workflows/progress.md:99`/`:100`), `cad-record.json`
  (`workflows/report.md:29`/`:64`), `cad-artifact.txt`
  (`references/review-triggers.md:201`/`:202`), `cad-payload.json`
  (`review-triggers.md:202`/`:241`), and
  `cadence-risk-task-{slug}.diff` (`workflows/task.md:126`). Neither the
  roadmap's "seven" nor the capture note's "five sites" counts one thing, and
  the note's pointers `review-triggers.md:192,193,230` are stale while
  `report.md` is omitted entirely.
- D-12 (site list): the slug-keyed task diff is IN scope and gets the same
  per-run treatment - it collides only between same-slug runs, but it feeds a
  blocking `risk_surface` fire, and v2.3.0 already closed a "stale diff reached
  a blocking gate" defect at this exact shape (`.planning/CAPTURE.md:521`).
  Costs one `.planning/DOCS-CLAIMS.md` edit: the TASK-17 row still points at
  `task.md:103-105` for a line now at `:126`.
- D-13 (form): the fix stays a shell redirect plus a targeted read-back - no
  new seam, flag or subcommand. Evidence:
  `cadence-core/bin/lib/bulk-output.mjs:10-17`,
  `cadence-core/references/conventions.md:100-102`,
  `cadence-core/bin/lib/text-transport.mjs:98-104`.

## Acceptance criteria

- [ ] AC1: `node -e` against `lib/protected-branches.mjs` returns, per row:
      `""` -> `['main','master']`, `" "` -> `['main','master']`, `[""]` ->
      `['main','master']`, `["","main"]` -> `['main']`, `[]` -> `[]`,
      `"release"` -> `['release']`. No returned list contains an empty or
      whitespace-only entry.
- [ ] AC2: with `git.protected_branches: ""` in the repo config layer, running
      `git-guard.mjs` against a `git commit` on `main` refuses it.
- [ ] AC3: under `git.protected_branches: ""` with no `git.base_branch` and no
      `--base`, `land-cleanup.mjs` and `issue-check.mjs` each emit a defined
      base; the string `undefined` appears in neither the
      `git branch --merged` nor the `git log ..HEAD` invocation.
- [ ] AC4: `rg 'TMPDIR:-/tmp' cadence-core skills agents hooks` shows a per-run
      path at all six sites of D-11; no fixed shared filename remains at any of
      them.
- [ ] AC5: reintroducing a fixed shared scratch path at any one of the six
      sites makes a deterministic check FAIL by name; with the tree as shipped,
      that same check passes.
- [ ] AC6: feeding a truncated file to each of the six read-backs produces a
      named refusal and a non-zero exit; none throws an unhandled parse error
      and none prints `{}` as a success. The five prose read-backs name the
      refusal on stderr; `review-provider.mjs --payload` names it in its stdout
      seam envelope (`{"ok":false,"reason":"bad-payload"}`), per
      `lib/seam-io.mjs`. AMENDED 2026-08-18 by John, from the blocking `plan`
      review: the original "on stderr" arm asked one seam to break the
      one-JSON-line-on-stdout convention every seam shares, for a property that
      already holds and is already tested there
      (`review-provider.test.mjs:685`).
- [ ] AC7: `node cadence-core/bin/self-verify.mjs` and the full test suite both
      pass, with `references/conventions.md`'s stated rule showing the per-run
      form and the `.planning/DOCS-CLAIMS.md` TASK-17 row matching
      `workflows/task.md`'s current line.

## Flagged assumptions

- The concrete per-run key (a `mktemp -d` path echoed once and carried
  literally into the later block, versus a derived literal typed in both) is
  the planner's call within D-05 and D-06 - Unclear; if wrong: a mechanism
  that reads correctly in one fenced block and resolves empty in the other.
- The form of the AC5 check (an extension to `bulk-output.mjs`'s register scan
  versus a separate check) is the planner's call - Unclear; if wrong: the
  check lands somewhere that a prose reflow can silence.
- Check 20 keeps passing without register edits, because it keys on the call
  text left of the `>` (`bulk-output.mjs:305-327,363`) - Likely; if wrong:
  `bulk-output-unregistered` fires on a correctly converted site and the three
  counts pinned at `bulk-output.test.mjs:54-57` move.
