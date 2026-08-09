# Phase 5: Doc sweep - Context

Gathered: 2026-08-09
Feeds: /cad-plan 5

## Scope boundary

In: `/cad-docs-verify` across the surface AC1 names - `README.md`, `METHOD.md`,
`INTERNALS.md`, `CONTRIBUTING.md` and the 21 files in `cadence-core/workflows/`
(25 files, 268,992 B) - with every reported claim resolved to `corrected` or
`divergence`, a committed claim ledger that makes the next cycle a diff rather
than a fresh sweep (DOC-02), a real defect filed as its own requirement instead
of reworded away (DOC-03), and one runtime-evidence artifact under `docs/`
linked from `README.md` (EVD-02). Two hardcoded byte figures outside that
surface are corrected as a stated exception (D-11).

Out: `EVD-01`'s `trace export` redaction machinery - deferred 2026-08-08 with
the demotion of EVD-02 and not revived here. Widening the sweep to `skills/**`
or `cadence-core/references/*.md` (roughly doubles the surface, ~60 files);
only the two figures in D-11 are touched there. Changing `docs-verify.md`'s
default target set (D-01). Adding a fourth verdict to the docs-verify
vocabulary (D-05). Re-measuring `README.md:132`'s v2.3.0 figures as current
numbers (D-10).

Deferred: None.

Plan shape: Multiple plans, same phase - roughly plan 1 the three sweep runs
plus the ledger, plan 2 the corrections and the DOC-03 filings, plan 3 the
EVD-02 artifact, the D-11 byte figures and the green gates, so each stays
inside the resolved `workflow.max_plan_tasks` ceiling of 8.

## Durable decisions

- D-03 (Ledger is the diff base): Run 1 commits a claim ledger - stable id,
  doc, line, claim, verdict, resolution - and the confirmation run re-verifies
  those ids rather than re-extracting claims. `/cad-docs-verify` has no seam in
  `cadence-core/bin/`; the whole workflow is model-driven prose, so two runs
  over a 269 KB surface extract different claim SETS and a "smaller report"
  can fall out of extraction variance rather than out of corrections. The
  ledger converts AC3's delta into a set difference, and it is what DOC-02's
  "next cycle starts from a diff" actually names. Evidence:
  `cadence-core/workflows/docs-verify.md:46-48` (the entire output contract:
  a per-doc table plus a one-line count), `.planning/REQUIREMENTS.md:58`.
- D-04 (Ledger at `.planning/DOCS-CLAIMS.md`, report in the phase record): The
  run report is committed under `phases/5/` as AC1 requires, but the ledger
  lives at the `.planning/` root because `/cad-milestone` moves completed
  `phases/<N>/` into `_archive-v2.6.0/5/` at close. A diff base inside the
  phase record is findable only by someone who already knows the archive
  label - which is the cycle after next, not the next one. Evidence:
  `cadence-core/workflows/milestone.md:77-81`, `.planning/_archive-v2.5.0/`
  (the pattern already applied), `.planning/config.json` (`git.create_tag:
  false`, so the untagged-close arm is the one that runs).
- D-05 (Divergence is a resolution, not a verdict): "Known divergence" is
  recorded as a resolution value in the ledger, NOT as a fourth verdict in
  `docs-verify.md`'s classification list. A divergence is a stale claim
  deliberately kept, so it is a property of the resolution rather than of the
  reading; adding it to the workflow's vocabulary re-emits it for every other
  project that runs the command and costs a budget regeneration on a file with
  zero slack. Evidence: `cadence-core/workflows/docs-verify.md:39-44`
  (accurate / stale / unverifiable, the whole vocabulary), `:8-11`;
  `docs-verify.md` measured at exactly 2,796 B; the phrase "known divergence"
  occurs in the tree only at `.planning/REQUIREMENTS.md:58` and
  `.planning/ROADMAP.md:186`, both of them the requirement text itself.
- D-06 (DOC-03 files into `REQUIREMENTS.md` `## Deferred`): A claim that turns
  out to be a real defect gets a new id under `## Deferred`, named in
  `phases/5/SUMMARY.md`. `## Active` was rejected: `req-traceability.md` states
  there are exactly two exits for an id with no phase row - plan it into a
  phase, or move the bullet out of `## Active` - and "there is no third exit",
  so a new Active id with no phase becomes an `unpicked` break in `/cad-audit`,
  the pre-ship gate, turning a documentation finding into roadmap surgery at
  the close. `.planning/CAPTURE.md` cannot be the sole home: it is gitignored
  in this repo, so a filing there exists on one machine only. Evidence:
  `cadence-core/references/req-traceability.md:171-186`,
  `.planning/REQUIREMENTS.md:6` (`## Active`), `:153` (`## Deferred`),
  `.gitignore:23`, `.planning/phases/4/SUMMARY.md` (tracked).
- D-07 (EVD-02 artifact lives under `docs/`): The runtime-evidence file is a
  new file in `docs/`, not in the phase record. `README.md` must link it, and
  a link into `phases/5/` is dead the moment `/cad-milestone` runs - silently,
  because nothing checks README markdown links. `docs/` is already a
  README-linked destination, carries no byte budget and no prose lint, and
  ships to users through the marketplace `source: "./"`. Evidence:
  `cadence-core/workflows/milestone.md:77-81`; `README.md:38`, `:74`, `:76`;
  `cadence-core/bin/lib/surface-weight.mjs:95-121` (measures only `agents/`,
  `skills/`, `cadence-core/{workflows,references,templates}`);
  `cadence-core/bin/self-verify.mjs:258-264`, `:540-546` (checks only
  `${CLAUDE_PLUGIN_ROOT}` paths), `:579-606` (backticked repo paths in
  `INTERNALS.md` only).
- D-09 (AC5's trace half does not fire, and that is recorded): EVD-02's
  contingent trace half has no input and the phase closes it rather than
  leaving it dangling: AC5 is the byte figures alone, and `SUMMARY.md` states
  that no non-Cadence project had a phase trace. Evidence: checked 2026-08-09
  across `/code/*` and `/data/code/*` - `atmos`, `burnrate`, `hindsight`,
  `jcrenshaw.dev`, `placer`, `reflex`, `tempest` and `weathervane` all have
  `.planning/` and none has a `trace.jsonl`; only `cadence` itself has one
  (685 lines). `.planning/REQUIREMENTS.md:57` ("the trace half is contingent by
  design ... the byte half stands alone if none arrives").

## Decisions

- D-01 (Explicit path list, default unchanged): The sweep is invoked with the
  AC1 path list; `docs-verify.md`'s default target set is left alone. The
  default is "`README.md` plus `docs/**` (and any `*.md` at the repo root that
  reads like user docs)", which misses `cadence-core/workflows/*.md` entirely
  and pulls in `docs/WORKFLOW.md`, which AC1 does not name - but
  `cadence-core/workflows/` is a Cadence-only path, so a generic default naming
  it is wrong prose in the shipped plugin for every other project. The exact
  invocation string is recorded in the ledger header so the next cycle re-runs
  it verbatim. Evidence: `cadence-core/workflows/docs-verify.md:8-11`,
  `.planning/ROADMAP.md:185`.
- D-02 (Three runs by doc group): The sweep is three invocations - root docs (4
  files, 69,691 B) / `cadence-core/workflows/` A-M / N-Z - joined by the single
  ledger. One invocation cannot cover the surface: it is 25 files / 268,992 B
  carrying 1,142 distinct backticked tokens, and `cad-docs-verify` has no
  dispatch, so every doc read plus every verification read lands in one
  context. The only prior run handled 32 claims on a smaller surface. Evidence:
  `skills/cad-docs-verify/SKILL.md` (`allowed-tools: Read, Bash, Grep, Glob,
  AskUserQuestion` - no `Task`), `.planning/CAPTURE.md` (the v2.0.0 phase 3
  run: 32 claims, 30 accurate, 1 stale).
- D-08 (Figure definitions): "Resident" is `node cadence-core/bin/weight.mjs
  resident` and "turn-one" is that output's per-command `eagerBytes`; the
  per-surface half is the bare `node cadence-core/bin/weight.mjs`. Publishing
  reachable bytes or the all-surfaces total under a "turn one" label would
  contradict the README's own established use of the term and make two numbers
  in the same repo incomparable. Evidence: `cadence-core/bin/weight.mjs:19-20`
  (both usage forms), `cadence-core/bin/lib/resident-weight.mjs:9-20` (EAGER is
  "the bytes the host injects before the command's first turn"),
  `README.md:132` ("load in turn one"),
  `.planning/_archive-v2.5.0/2/MEASUREMENTS.md:64` (the same table shape),
  `cadence-core/bin/self-verify.mjs:204-208` (the CONTRACTS row making both
  forms lint-legal in prose).
- D-10 (`README.md:132` is re-anchored, not corrected): The v2.3.0 before/after
  stays and gains an explicit "measured at v2.3.0" frame plus a pointer to the
  `docs/` artifact for current figures. Correcting it to today's numbers
  destroys the before/after that gives the paragraph its point and goes stale
  again next cycle; leaving it unmarked leaves the largest figure on the
  most-read doc reading as a current measurement. Live tree measured
  2026-08-09: 23 user-invocable commands, 278,315 B eager total, against the
  stated "twelve main commands" and `231,422 -> 199,687`; both named commands
  have moved (`/cad-pause` 8,197 -> 8,752, `/cad-land` 31,016 -> 18,209).
  Evidence: `README.md:132`.
- D-11 (Two byte figures corrected as a stated exception): `skills/cad-land/
  SKILL.md:44` and `skills/cad-plan-review/SKILL.md:39` both read `15,376 B`
  for `cadence-core/references/review-triggers.md`, which `weight.mjs` measures
  at 17,733 B - phase 4 of this same cycle grew the file and updated only the
  budget. Both are six-character replacements that move no budget. `skills/**`
  is NOT otherwise added to the sweep surface. Evidence:
  `.planning/phases/4/reports/plan-1.md` task 4 ("Budgets: review-triggers.md
  15376->17733"), `.planning/phases/2/CONTEXT.md` D-19,
  `cadence-core/references/seams.md:240-244` (the inline figure is mandatory
  for every future deferral), `.planning/CAPTURE.md` (the phase-2 item naming
  this drift class).
- D-12 (Budgets regenerated in-phase): Every correction landing in
  `cadence-core/workflows/*.md` regenerates `cadence-core/bin/weight-budgets.json`
  in the same task. All 93 budgeted surfaces sit at EXACTLY their byte count -
  total slack 0 measured 2026-08-09 - so any added byte anywhere is a hard
  `budget-overrun` on the introducing commit. This carries phase 2's D-18
  forward unchanged. Evidence: `cadence-core/bin/self-verify.mjs:634-643`,
  `.planning/phases/2/CONTEXT.md` D-18, `.planning/phases/4/reports/plan-1.md`
  task 3.
- D-13 (Orchestrator runs the command): `/cad-docs-verify` is invoked by the
  orchestrator, never from inside an executor plan task. `agents/cad-executor.md`
  declares `tools: Read, Write, Edit, Bash, Grep, Glob, LSP` - no `Task` and no
  skill-invocation tool - so a task whose Action is "run `/cad-docs-verify`"
  returns blocked and costs a re-plan. The executor's tasks are the corrections
  and the artifacts, taking the ledger as input. Evidence:
  `agents/cad-executor.md` frontmatter; `.planning/CAPTURE.md` (the v2.0.0 run
  happened "just after `/cad-verify 3` rather than inside it").
- D-14 (CI claims are accurate, not unverifiable): `.github/workflows/test.yml`
  still executes and fires the node tests (user-confirmed 2026-08-09, with
  `origin` self-hosted and GitHub a mirror), and its three jobs match
  `CONTRIBUTING.md:17-21`'s three commands exactly, so "the same three checks
  CI runs" is verified accurate rather than left unverifiable. The adjacent
  "no dependencies ... no `npm install`" claim is judged on its own merits by
  the sweep: the `typecheck` job runs `npm install --no-save --no-package-lock
  typescript @types/node`. Evidence: `.github/workflows/test.yml`,
  `CONTRIBUTING.md:12-21`.
- D-15 (`CONTRIBUTING.md` is swept by hand end to end): It is the one AC1 doc
  with zero mechanical drift coverage, so it gets the fullest pass rather than
  the lightest. `self-verify.mjs` walks five directories plus exactly
  `['README.md', 'INTERNALS.md', 'METHOD.md']` - `CONTRIBUTING.md` appears in
  neither list - while making hard checkable claims about CI and about the
  repo's dependency posture. Evidence:
  `cadence-core/bin/self-verify.mjs:257-306`, `CONTRIBUTING.md:12-21`.

## Acceptance criteria

- [ ] AC1: `.planning/phases/5/` contains a committed docs-verify report in
      which all 25 AC1-surface files appear by name - `README.md`, `METHOD.md`,
      `INTERNALS.md`, `CONTRIBUTING.md` and each of the 21
      `cadence-core/workflows/*.md` - each with its claim table.
- [ ] AC2: `.planning/DOCS-CLAIMS.md` is committed, every claim from the report
      has a row carrying a stable id, doc, line, claim and verdict, and every
      row's resolution is exactly one of `corrected` (naming the commit) or
      `divergence` (naming the reason it stands). Zero rows have an empty
      resolution.
- [ ] AC3: A second sweep run scoped to the ledger's ids yields fewer `stale`
      rows than run 1, and the phase record states the delta in the form
      `run-1 stale N -> run-2 stale M + K divergences`.
- [ ] AC4: Every claim found to describe a real defect has its own id under
      `## Deferred` in `.planning/REQUIREMENTS.md` and is named in
      `phases/5/SUMMARY.md`; `node cadence-core/bin/planning.mjs audit` reports
      zero `unpicked` breaks.
- [ ] AC5: A committed file under `docs/` carries the `weight.mjs` resident and
      turn-one byte figures with the exact command that regenerates them,
      `README.md` links it, and re-running that command reproduces the figures
      in the file. `SUMMARY.md` states that no non-Cadence project had a phase
      trace, closing EVD-02's contingent half.
- [ ] AC6: `skills/cad-land/SKILL.md` and `skills/cad-plan-review/SKILL.md`
      both name the same byte figure for `cadence-core/references/review-triggers.md`
      that `node cadence-core/bin/weight.mjs` reports for it.
- [ ] AC7: `node --test cadence-core/bin/*.test.mjs`,
      `node cadence-core/bin/self-verify.mjs` and
      `npx tsc -p tsconfig.ci.json` are all green, with `weight-budgets.json`
      regenerated for every surface this phase edits.

## Flagged assumptions

- `/cad-docs-verify`'s report length is stable enough across two runs of the
  same host model for AC3's comparison to mean something - Unclear; that is a
  property of the model and harness, not of this repo, and the workflow has no
  seam that would make it deterministic. D-03's ledger is the mitigation, not a
  proof: it fixes the claim SET across runs but not the prose the model emits
  around it. If wrong: AC3's delta measures wording rather than corrections,
  and the phase falls back to the stale-count-only form (`M stale -> 0 stale +
  K divergences`).
- The three-group split in D-02 keeps each run inside a workable context -
  Likely; the largest group (`cadence-core/workflows/` A-M) is roughly 100 KB
  of prose plus every verification read it triggers. If wrong: a group is split
  further mid-plan, which changes the task count but not the ledger or any
  criterion.
