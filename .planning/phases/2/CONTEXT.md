# Phase 2: The front door - Context

Gathered: 2026-08-12
Feeds: /cad-plan 2

## Scope boundary

In: A new `/cad-adopt` command - `skills/cad-adopt/SKILL.md` plus
`cadence-core/workflows/adopt.md` - that initializes `.planning/` from an
existing repo, deriving PROJECT.md, REQUIREMENTS.md and a remaining-work
ROADMAP.md inline in the coordinator from the code and git history, running the
same `trace ignore` and config-copy setup seams `new-project` runs, and asking
only what the repo cannot answer. Plus a `--brief <file>` flag on
`cad-new-project`, parsed in its existing `setup` step, that reads a design
brief whole and suppresses the questions the brief already settles; a committed
`cadence-core/bin/fixtures/` copy of verbatim's `DESIGN-BRIEF.md` with a
structural test over it; and a `docs/` page on the discovery workflow linked
from the README getting-started path. Plus the surfaces those two changes
force: `weight-budgets.json` rows for the new skill and workflow,
`/cad-adopt` registration in `cadence-core/references/COMMANDS.md`,
`skills/cad-help/SKILL.md` and `README.md`, the five absent-`.planning/`
refusal surfaces that today name only `/cad-new-project`, and the
`NEW-PROJECT-*` and `README-*` blocks of `.planning/DOCS-CLAIMS.md` that this
phase's line shifts touch.

Out: No new routable role, route-table cell or rung agent file (D-03). No
subagent dispatch from adopt, and so no `BRACKETING` census row for
`adopt.md` (D-01). No new detector seam and no extension of `detect-commands`
(D-05). No parser, schema or `planning.mjs` subcommand for the brief (D-07).
No scored or computed suppression gate of any kind (D-06, D-08). No `- [x]`
phases in an adopted ROADMAP (D-04). Composing `--brief` with `/cad-adopt` -
adopting a repo that ALSO arrives with a brief - is not in this phase.

Deferred: None.

Plan shape: multiple plans, same phase - /cad-plan breaks it down. ADP-01 and
BRF-01 share almost no surface: adopt is a new skill, a new workflow and the
five refusal-surface edits; brief is a flag in `new-project.md`'s setup step,
a fixture, a docs page and a README link. Sequencing the adopt half first lets
an entirely new surface land green before `new-project.md`'s 22 line-cited
ledger rows shift underneath it.

## Durable decisions

- D-01 (Adopt shape): `/cad-adopt` derives PROJECT.md, REQUIREMENTS.md and
  ROADMAP.md INLINE in the coordinator. It dispatches no subagent, takes no
  `BRACKETING` census row, and pays the brownfield read in its own context.
  Evidence: `cadence-core/workflows/new-project.md:253` states the same rule
  for the roadmap ("there is no roadmapper agent");
  `cadence-core/bin/lib/trace.mjs:188-221` derives the correlation id from a
  phase number, which does not exist during init, so a bracketed init dispatch
  would have to invent a `--phase` value. The shipped precedent for an
  init-time dispatch is UNBRACKETED - `new-project.md:155-196` spawns the
  research agent and is absent from the seven-row `BRACKETING` map at
  `cadence-core/bin/trace.test.mjs:729-737` - and that arm was rejected
  because it leaves the new front door's most expensive step invisible to
  `/cad-report`, the exact gap phase 1 closed elsewhere. A bracketed dispatch
  was rejected for the invented `--phase` plus phase 1 D-14's requirement to
  close on both arms.
- D-02 (File shape): `skills/cad-adopt/SKILL.md` `@`-includes a NEW
  `cadence-core/workflows/adopt.md`; `new-project.md` is untouched by the
  adopt half. Evidence: that skill-plus-one-workflow shape is what every
  command uses; `cadence-core/bin/lib/include-consumers.mjs` exempts a
  `cadence-core/workflows/*` include from check 16's consumer rule, so a new
  workflow file needs no eager namer. Branching inside `new-project.md` was
  rejected: it is 16,098 B against its `weight-budgets.json` row, so the
  adopt prose would push it over and shift all 22 `NEW-PROJECT-*` ledger rows
  a second time in the same phase.
- D-03 (Routing): Adopt mints no new routable role, no route-table cell and no
  rung agent file. Evidence: `cadence-core/route-table.json` declares a closed
  `roles` array of six; `cadence-core/bin/self-verify.mjs:31-38` (check 8)
  fails in BOTH directions between cells and `agents/`;
  `cadence-core/workflows/new-project.md:179-188` states the standing cost
  calculation verbatim - a seventh role costs six cells across three stakes
  levels plus a rung file per rung any cell names plus the reverse check on
  every one. Follows from D-01: with no dispatch there is nothing to route.
- D-04 (History): The adopted ROADMAP.md carries REMAINING work only. Already
  shipped capability goes to PROJECT.md `### Validated`, never to `- [x]`
  phases, and the cursor is set to phase 1 through the same `cursor set` call
  `new-project` uses. Evidence: `.planning/ROADMAP.md:63` says "remaining-work
  ROADMAP.md"; `cadence-core/templates/PROJECT.md`'s Validated section already
  says "for a brownfield init, seed with what the existing code already does";
  `cadence-core/workflows/new-project.md:292-308`. The `- [x]` alternative was
  rejected on `skills/cad-health/SKILL.md` rule 5, which flags an `- [x]`
  phase whose mapped REQUIREMENTS rows are not all `Complete` - and `seed-reqs`
  writes `Pending` rows - so every reconstructed phase becomes a status-drift
  issue on the first `/cad-plan`, failing AC1 on its own terms.
- D-05 (Detection): "What the code can answer" is the model reading the repo's
  README, manifest and `git log` in its own judgment. No new detector seam is
  built and `detect-commands` is not extended. Evidence:
  `cadence-core/bin/planning.mjs:1979-2082` - `detect-commands` reads
  `package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod` and `tsconfig.json`
  one directory deep and returns `{lint, typecheck, source, warnings}`, nothing
  about goal, audience or constraints; its only consumer is
  `cadence-core/references/config-reach.md:125`. A new subcommand costs a
  `CONTRACTS` row (`cadence-core/bin/self-verify.mjs:183-222`, check 14 fails
  without one), its own test file, and a per-language matcher list that goes
  stale - to replace a judgment the reading already makes. Cost accepted: AC3
  is a walked check rather than a CI-checkable one.
- D-06 (Suppression is judgment): Adopt's question suppression is a stated
  prose rule with no score, no checklist walk and no computed discriminator -
  the same shape phase 1 locked for the analyzer spend gate. Evidence:
  `cadence-core/workflows/new-project.md:104-118` names its background
  checklist "mental, never a conversation structure" and names checklist
  walking as the anti-pattern; phase 1 D-11 banned the first computed
  discriminator in this tree on measured evidence that a threshold ordered the
  fixture's two phases backwards; `.planning/ROADMAP.md:66` requires "never a
  scripted interview". A scored coverage gate over the repo's own documents is
  precisely the shape criterion 4 forbids.
- D-07 (Brief read): `--brief <file>` is parsed in `new-project.md`'s EXISTING
  `setup` step beside `--research`, and the brief is read whole by `Read`. No
  parser, no schema, no `planning.mjs` subcommand. Evidence:
  `cadence-core/workflows/new-project.md:18`; path arguments are model-resolved
  at every other site (`cadence-core/workflows/docs-verify.md:9`,
  `cadence-core/workflows/decision-review.md:20`,
  `skills/cad-plan-review/SKILL.md:28`); measured 2026-08-12,
  `/data/code/verbatim/DESIGN-BRIEF.md` is 29,447 B / 527 lines / 4,496 words,
  a single ordinary `Read`. A `brief-scan` seam would make AC5 CI-testable but
  imposes a schema on an artifact whose whole value is that it is freeform.
- D-08 (Brief suppression keys off content): Suppression keys off what the
  brief SAYS, not off a marker convention. Evidence: measured 2026-08-12 with
  `grep -c 'OPEN'` over the single available brief (sample size 1) - exactly 2
  occurrences, line 3 declaring the convention ("Every decision below is
  settled unless marked **OPEN**") and one inline marker at line 298 - plus a
  5-row `## 17. Open items` table at line 519 whose statuses are prose
  ("Hypothesis...", "Measure...", "Deferred", "Out of scope for 0.x"). Two of
  the four background items at `cadence-core/workflows/new-project.md:106-109`
  (who it is for, what done looks like) are what THIS brief leaves open, while
  what/why/non-goals/stack/constraints are settled in its sections 1-5. Keying
  on `**OPEN**` makes a brief lacking the convention read as fully settled and
  skips the questioning entirely - BRF-01's failure mode, inverted.
- D-09 (Fixture): Verbatim's `DESIGN-BRIEF.md` is committed under
  `cadence-core/bin/fixtures/` and the test over it asserts STRUCTURAL facts
  (its open-item rows), never the question set. Evidence:
  `cadence-core/bin/fixtures/verbatim.trace.jsonl` is verbatim's own run record
  committed byte-for-byte and unredacted as phase 1's calibration input
  (`cadence-core/bin/trace.test.mjs:920-940`), so importing a verbatim artifact
  as a fixture is established and recent precedent. A walk-only proof leaves
  AC4 with no CI falsifier and it regresses silently the next time the setup
  step is edited; asserting over the question set would go red on rewording
  rather than on behaviour. The walked judgment survives separately as AC5.

## Decisions

- D-10 (Traceability): Adopt leaves REQUIREMENTS.md's `## Traceability` table
  as bare headers; rows are seeded later by `/cad-plan` through
  `planning.mjs seed-reqs`, which is what "seeds Traceability through the
  existing seams" means. Evidence: `cadence-core/bin/planning.mjs:1583-1587` -
  `seed-reqs` reads `.planning/phases/<N>/PLAN*.md` and returns `no-phase-dir`
  / `no-plans` without them, so adopt structurally cannot call it;
  `cadence-core/templates/REQUIREMENTS.md` ships the table as bare headers with
  the rule stated; `cadence-core/workflows/new-project.md:243-244,270-273`.
  Hand-authored rows would make `insertReqRows`'s `mismatched` arm the normal
  case on every adopted repo.
- D-11 (Setup seams): Adopt runs the same setup seams `new-project` runs -
  `planning.mjs trace ignore --root .` and the verbatim `templates/config.json`
  copy. Evidence: `cadence-core/workflows/new-project.md:31-48`;
  `skills/cad-health/SKILL.md` rule 1 reports on `ignored:false` and
  `tracked:true` with different remedies;
  `cadence-core/bin/planning.mjs:2100-2115` defines `TRACE_IGNORE_LINE`;
  `.planning/DOCS-CLAIMS.md:503` (EXECUTE-22) verifies the claim accurate. This
  CONTRADICTS the open `.planning/CAPTURE.md` note claiming nothing in Cadence
  ever writes that ignore line - the `trace ignore` seam shipped after that
  capture, and the capture is now stale for the init path.
- D-12 (Active version): The `### Active` milestone version adopt writes is a
  proposed NEXT version, confirmed through the ask-user seam, never the repo's
  current tag. Evidence: `skills/cad-health/SKILL.md` rule 7 compares the
  `### Active` version against `git tag --list` and reports drift on a
  membership match; `.planning/PROJECT.md:105-109` shows the live shape (a
  version string in prose, not the template's bullet list). Naming a tagged
  repo's current version fails `/cad-health` immediately, which is AC1's
  falsifier.
- D-13 (Docs page placement): The discovery page lands under `docs/`, where it
  takes NO `weight-budgets.json` row and is linted by no CI check. Evidence:
  `cadence-core/bin/self-verify.mjs:322-372` walks only
  `cadence-core/{workflows,references,templates}`, `skills`, `agents`, plus
  `README.md`, `INTERNALS.md`, `METHOD.md`;
  `cadence-core/bin/lib/surface-weight.mjs:8-19` names the same five measured
  branches; `weight-budgets.json` carries no row for the existing
  `docs/WORKFLOW.md` or `docs/EVIDENCE.md`. It IS in
  `cadence-core/workflows/docs-verify.md:9`'s on-demand default set. Placing it
  in `references/` instead would make it budgeted AND put it under check 16.
- D-14 (Registration is unenforced): `weight-budgets.json` rows for the new
  skill and workflow are REQUIRED in the same commit, but registration in
  `COMMANDS.md`, `cad-help` and the README is enforced by nothing mechanical
  and must be carried as explicit execution work. Evidence:
  `cadence-core/bin/self-verify.mjs:715-720` pushes `unbudgeted-surface` for
  any measured surface with no entry - a hard problem, not a ceiling warning;
  `cadence-core/references/COMMANDS.md` is a hand-maintained table and no
  `cadence-core/bin/*.test.mjs` holds a parity test against the `skills/` tree.
  `.planning/ROADMAP.md:81` already makes the same README registration its own
  execution task for phase 3.
- D-15 (Refusal surfaces): The surfaces that today send an absent-`.planning/`
  user to `/cad-new-project` must learn the second door:
  `cadence-core/workflows/progress.md:40`, `skills/cad-health/SKILL.md:25`,
  `cadence-core/workflows/context.md:39`, `cadence-core/workflows/config.md:13`
  and `cadence-core/references/git-guard.md:41`. Evidence: those five line
  citations. Left alone, a brownfield user who runs `/cad-progress` or
  `/cad-health` first is routed to the blank-page interview this phase exists
  to prevent.
- D-16 (Ledger drift): `.planning/DOCS-CLAIMS.md` corrections ride the same
  commits, and the load is measured: 22 `NEW-PROJECT-*` rows cite line numbers
  in `new-project.md` (`.planning/DOCS-CLAIMS.md:528-549`, lowest cited line
  29) and 51 `README-*` rows cite README lines (`:156-206`). A `--brief` insert
  at `cadence-core/workflows/new-project.md:18` shifts all 22; a
  getting-started link shifts every README row below it. Left uncorrected, the
  next `/cad-docs-verify` sweep reports drift that is bookkeeping rather than
  fact.

## Acceptance criteria

- [ ] AC1: `/cad-adopt` run in a git repo with no `.planning/` writes
      PROJECT.md, REQUIREMENTS.md, ROADMAP.md, STATE.md and config.json, and
      `/cad-health` on that directory reports zero problems.
      (human-verify: needs a walked `/cad-adopt` run on a brownfield repo)
- [ ] AC2: In that adopted `.planning/`, ROADMAP.md's `## Phases` list contains
      no `- [x]` entry, REQUIREMENTS.md's `## Traceability` table has its
      headers and zero rows, the `### Active` version does not appear in
      `git tag --list`, and the STATE cursor names phase 1.
      (human-verify: needs the same walked `/cad-adopt` run)
- [ ] AC3: Walked on a repo whose README and manifest already state its goal,
      stack and build commands, adopt asks about none of those three, and every
      question it does ask names something absent from the repo.
      (human-verify: needs a walked `/cad-adopt` run)
- [ ] AC4: `node --test` over the new brief test passes against a committed
      `cadence-core/bin/fixtures/` copy of verbatim's `DESIGN-BRIEF.md`,
      asserting its `## 17. Open items` rows.
- [ ] AC5: `/cad-new-project --brief` walked against that brief does not
      re-ask the problem, the users, the non-goals, the stack or the
      constraints, and every question it asks traces to an open item in the
      brief. (human-verify: needs a walked `/cad-new-project --brief` run)
- [ ] AC6: A `docs/` page states the freeform-conversation -> design-brief ->
      `--brief` sequence and what a good brief answers, and `README.md`'s
      getting-started path links to it by path.
- [ ] AC7: `node cadence-core/bin/self-verify.mjs` is green with no
      `unbudgeted-surface` and no `budget-overrun`; `/cad-adopt` appears in
      `cadence-core/references/COMMANDS.md`, `skills/cad-help/SKILL.md` and
      `README.md`; and the five surfaces named in D-15 also name `/cad-adopt`.

## Flagged assumptions

- The brownfield repo AC1, AC2 and AC3 are walked against is unchosen. Probed
  2026-08-12, candidates on this machine with a `.git` and no `.planning/`
  include `/code/axel`, `/code/headroom` and `/code/powercurve`. If wrong:
  `/cad-verify 2` reaches three human-verify items with no target and the walk
  stalls at the gate.
- The fixture's exact filename under `cadence-core/bin/fixtures/` is the
  planner's call, constrained only by matching `verbatim.trace.jsonl`'s
  convention. If wrong: a rename later breaks the test's literal path.
- AC4 asserts a `## 17. Open items` heading observed in ONE brief on
  2026-08-12. If verbatim's brief is edited before the fixture is copied, the
  assertion needs re-anchoring to whatever heading the committed bytes carry.
- Whether adopt should ALSO honour `--brief` - a repo that arrives with both a
  history and a brief - is left to a later phase. If wrong: the two front
  doors ship unable to compose and a user with both must pick one.
- Whether `docs/WORKFLOW.md` should absorb the discovery page rather than a new
  file sitting beside it is the planner's call; D-13 settles only that it lives
  under `docs/`. If wrong: two overlapping docs pages describe entering
  Cadence and the README's getting-started path has to choose between them.
