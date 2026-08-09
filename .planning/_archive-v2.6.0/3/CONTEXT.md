# Phase 3: Field friction - Context

Gathered: 2026-08-09
Feeds: /cad-plan 3

## Scope boundary

In: The four things found by Cadence failing on a real project. FLD-01 -
numeric-only is stated as the phase-directory grammar and `/cad-health` reports
every entry that violates it, plus the `--phase` round-trip that loses a
sub-phase number. FLD-02 - a project Cadence creates keeps `.planning/trace.jsonl`
out of git without a manual step, and an existing project that does not is
reported. PRS-02 - `REQ_ID_EXACT` accepts a category that does not start
`[A-Z]`. DBT-01 - the `CADENCE-DEBT` marker convention and an idempotent harvest
seam that collects markers into `.planning/CAPTURE.md`.

Out: Converting `tempest` and `atmos` to Cadence, in any form. RULED 2026-08-09
by the user: "no conversion, we are not GSD". No directory resolver, no
`<N>-<slug>` second legal form, no migration seam, no one-off manual conversion.
Those two trees are GSD-era and stay unaddressable; see D-01 for why a resolver
alone would have made them worse rather than usable. Also out: `PRS-01` and the
rest of the parser defects (deferred out of the cycle on field evidence);
`MIN-01` parts 1 and 2 (the executor's YAGNI posture and the review delete-list);
`EVD-01`'s trace export machinery; every phase-1 kept-item row except row 7.

Deferred: None.

Plan shape: One plan. The user judged it right-sized; the tightness was stated
and accepted - `workflow.max_plan_tasks` resolves to 8, and DBT-01 alone is a new
subcommand, a `CONTRACTS` row, a source walker, a `CAPTURE.md` writer and two
tests. If the planner cannot fit four requirements under the ceiling, that is the
plan gate's call to surface, not a reason to re-scope here.

## Durable decisions

- D-01 (Numeric-only, no conversion): Cadence states numeric-only as the
  phase-directory grammar and reports violations. It does NOT teach the seams to
  resolve `08-meteogram-legend`, ship a `<N>-<slug>` second form, or migrate
  anything. Chosen over all three alternatives by the user, who accepted the
  breaking change explicitly. The evidence is that directory addressing alone
  would not have made either field project usable and would have replaced an
  honest refusal with a false clean answer: `/data/code/tempest/.planning/phases/08-meteogram-legend/`
  holds `08-01-PLAN.md`, `08-CONTEXT.md`, `08-UAT.md`, none matching
  `listPlanFiles`' `/^PLAN(-\d+)?\.md$/` or `uatFile`'s fixed `UAT.md`, so a
  resolver would return `ok:true, note: "fewer than two plans - nothing to
  intersect"` on a phase with two plan files; `tempest`'s `STATE.md` is GSD YAML
  frontmatter (`gsd_state_version: 1.0`) that `cursor get` cannot parse; and
  `planning.mjs status --dir /data/code/atmos/.planning` returns
  `unparseable-roadmap` with 35 issues. Evidence: `cadence-core/bin/planning.mjs:850`,
  `:458`, `cadence-core/references/conventions.md:22-25`,
  `cadence-core/workflows/new-project.md:285-287`.
- D-02 (Raw string is the directory component): The `--phase` value carries its
  RAW validated string as the directory component; the numeric value is kept only
  for arithmetic. One change closes the decimal loss (`--phase 1.10` reading
  `phases/1.1` and hinting at a different phase) and makes `--phase 08` report a
  not-found naming `phases/08` rather than silently answering about `phases/8`.
  This picks up phase 1's kept-item row 7, which named phase 3's theme as its
  natural home and was left `unassigned`; taking it here stops the same
  `String(Number(x))` fix being re-derived in a later cycle. Sub-phase numbers
  are legal Cadence grammar, so this is in-grammar breakage, not a GSD artifact.
  Evidence: `cadence-core/bin/planning.mjs:1636` (`cmdLeaseCheck`), `:1855`,
  `:1880` (`trace`), `.planning/CAPTURE.md:97`.
- D-03 (Ignore line is written at scaffold, reported at health): A seam writes
  `.planning/trace.jsonl` into `.gitignore` at `/cad-new-project` time -
  append-if-absent, creating `.gitignore` when there is none, a no-op on re-run -
  and `/cad-health` REPORTS a tracked-or-unignored `trace.jsonl` on an existing
  project without editing it. Chosen over ensuring the line inside
  `appendEvent`, which would cover new and existing projects at one site but puts
  a routing call in the position of editing a user file it did not create.
  Scaffold-only was rejected because five already-initialized projects
  (`burnrate`, `hindsight`, `assistant`, `placer`, `jcrenshaw.dev`) would commit
  their run record on the next `git add .planning`. Evidence:
  `cadence-core/workflows/execute.md:226` (the load-bearing assertion nothing
  writes), `cadence-core/workflows/new-project.md:17-53` (the whole scaffold step;
  writes `.planning/` and `config.json` only), `:29` (the same if-absent shape for
  `git init`), `:49-53` (brownfield support), `cadence-core/bin/lib/trace.mjs:192-224`,
  `.gitignore:26` (hand-added here).
- D-04 (Only the trace is ignored): `.planning/CAPTURE.md` is deliberately NOT
  added to any ignore line. It is gitignored in this repo and `burnrate` but
  TRACKED in `hindsight` and `assistant`, and that asymmetry is a local choice
  rather than a product rule. DBT-01's whole premise - the marker in tracked code
  is the durable record and the queue is a regenerable view - was reasoned
  against the tracked half. Evidence: `.planning/REQUIREMENTS.md:54`,
  `.planning/phases/1/CONTEXT.md:35` (D-01), `:47` (D-10),
  `skills/cad-capture/SKILL.md:44-46`, `cadence-core/workflows/execute.md:402-405`
  (both instruct committing it), `.gitignore:23`.
- D-05 (A letter is required somewhere): `REQ_ID_EXACT` widens to
  `[A-Z0-9]{1,2}[A-Z][A-Z0-9]{0,6}-\d+` - a letter is required somewhere in the
  category - admitting `2FA-01`, `3DS-02`, `A11Y-01` and refusing `14-01`,
  `08-02`, `2026-08`. A bare `[A-Z0-9]` lead was rejected: `ACTIVE_BULLET` reads
  ANY bold span as an id and narrowing it is off the table, so `isRequirementId`
  is the only filter, and a bolded date or plan reference would become an admitted
  requirement id feeding `audit`'s counts and `unpicked` and minting the phantom
  `orphans.plan_ids` break already paid for once. `REQ_ID_TOKEN` stays
  deliberately unanchored per its own comment. Evidence:
  `cadence-core/bin/lib/planning-files.mjs:257` (`ACTIVE_BULLET`), `:259-265`
  ("Do not add anchors here"), `:268-275` ("The narrowing lives HERE instead"),
  `cadence-core/references/acceptance-criteria.md:290-295`, `.planning/CAPTURE.md:249`.
- D-06 (Harvest writes outside the recall walk): The harvest owns a dedicated
  `CAPTURE.md` heading it rewrites wholesale, and that heading is NOT added to
  `parseCaptureSnippets`' walk list. Idempotence is impossible under append,
  because `/cad-capture` and `/cad-execute` both append to `## Todos` by hand, so
  the harvest cannot own that section's contents. The stated cost: a harvested
  marker does not reach `/cad-plan`'s recall until promoted by hand. The
  alternative - adding it to the walk - was rejected because a marker planted in
  code would start steering planning without anyone choosing it, competing for
  BM25 rank against hand-written items. Evidence:
  `cadence-core/bin/lib/planning-files.mjs:612-632` (the hardcoded
  `['Todos','Seeds','Notes']`), `.planning/phases/1/CONTEXT.md:37` (D-03 used the
  same property to make `## Archive` invisible with zero code change),
  `skills/cad-capture/SKILL.md:37-43`, `cadence-core/workflows/execute.md:402-405`.
- D-07 (`CADENCE-DEBT` is the token): The corner-cut marker token is
  `CADENCE-DEBT`, namespaced so it cannot collide with a marker another tool or a
  future contributor introduces. Measured over the tracked tree with `git grep -w`:
  `SHORTCUT`, `DEBT`, `CORNER`, `TRIPWIRE`, `CADENCE-DEBT` and `CAD-DEBT` all
  return zero, while `CUT` returns 9 and `CEILING` 1, so those two were never
  candidates. Once markers are planted across the tree, changing the token means
  editing every one of them. Evidence: measured 2026-08-09; `.planning/REQUIREMENTS.md:54`
  (the 19 conventional markers the first run must return zero of).

## Decisions

- D-08 (One rule covers every violation): `/cad-health` reports a single
  grammar-violation kind for any `phases/` entry that is not a bare integer or
  `N.M` sub-phase - named, zero-padded, and the two colliding `14-*` directories
  all fall out of it, with entries sharing a numeric prefix named together in one
  diagnostic. A separate collision diagnostic was rejected because under
  numeric-only no shadowing can actually occur:
  `join(dir, 'phases', String(n))` can never produce either `14-*` directory, so
  a second rule would report a hazard no code path reaches.
  `cadence-core/references/conventions.md` also loses the sentence contradicting
  the grammar it just stated ("Match an existing directory's name if one is
  already present"). Evidence: `cadence-core/references/conventions.md:22-25`,
  `skills/cad-health/SKILL.md:46-47` (check 5 already owns
  "`.planning/phases/<N>/` dirs correspond to real phases"),
  `cadence-core/bin/planning.mjs:1293`, `:1352`, `:1645`, `:880`, `:118`, `:458`.
- D-09 (All five shape sites land together): The D-02 change reaches all THREE
  independent `--phase` shape rules, not the `requireCursorNumber` family alone.
  Fixing one leaves the others refusing the same input with a differently-worded
  `bad-args`. The two `phases/` listing filters are correct as they stand under
  D-01 and are NOT loosened - a non-numeric entry rightly stays out of the recall
  corpus. Evidence: `cadence-core/bin/lib/require-int.mjs:31` (`CURSOR_SHAPE.decimal`),
  reached by `cursor set` (`planning.mjs:288`), `seed-reqs` (`:1343`),
  `lease-check` (`:1636`), `trace` (`:1855`, `:1880`); a bare `Number()` + NaN
  test at `:482` (`uat`, all five sub-subcommands) and `:1291` (`plan-overlap`);
  `cadence-core/bin/route.mjs:84` (`PHASE_RE`) feeding
  `cadence-core/bin/lib/phase-plans.mjs:82`. Listing filters: `planning.mjs:189`,
  `:1437`.
- D-10 (Harvest is a `planning.mjs` subcommand taking `--root`): The harvest
  ships as a new lowercase-and-hyphen subcommand in `planning.mjs`, not a new
  top-level script, and takes `--root` (the project root) rather than `--dir`
  (the `.planning` root), because it scans source and writes into `.planning`. A
  new top-level script would mean a second `CONTRACTS` row, a second
  weight/self-verify surface and a new file with no existing test harness. Per
  phase 2's D-20 the `CONTRACTS` row lands in the same task. Evidence:
  `cadence-core/bin/planning.mjs:2185-2212` (the dispatch table; "Adding a
  subcommand = one entry here + its tests"), `:2205-2210` (the `detect-commands`
  `--root` precedent, stated verbatim), `cadence-core/bin/self-verify.mjs:1041-1074`
  (check 14), `:499` (check 2's `[a-z-]+` parser), `:148`.
- D-11 (Enumeration is `git ls-files`): The harvest enumerates the tree with
  `git ls-files`, which excludes `node_modules/` and ignored files for free -
  `node_modules/` is present at `/data/code/cadence` and would otherwise return
  third-party markers, failing the first-run criterion directly. No existing
  walker is reusable: `surface-weight.mjs`' `surfaces()` walks a fixed set of
  Cadence-owned directories and `self-verify.mjs`' `mdFiles` is `.md`-only,
  neither exported for arbitrary-root scanning. Evidence:
  `cadence-core/bin/lib/surface-weight.mjs:93`, `cadence-core/bin/self-verify.mjs:261`,
  `:325`; `execFileSync('git', ...)` precedent at `cadence-core/bin/git-tags.mjs:32`,
  `cadence-core/bin/land-cleanup.mjs:50`, `cadence-core/bin/planning.mjs:1665`.
- D-12 (The `CAPTURE.md` writer is new and must be fence-aware): No `CAPTURE.md`
  writer exists in `cadence-core/bin` today - `planning.mjs:1457` reads it for the
  recall corpus and nothing writes it - and `sectionBody`/`sectionBound` are
  module-local, so the harvest needs its own section writer built on the exported
  `atomicWrite`. It must be fence-aware, or it truncates a bullet whose text
  contains a fenced block with a `## ` line, which is the exact defect
  `sectionBound` was written to close. Evidence:
  `cadence-core/bin/lib/planning-files.mjs:565`, `:993`, `:1697` (`atomicWrite`,
  exported), `cadence-core/bin/planning.mjs:1457`.
- D-13 (Verifier scan list untouched, exemption stated): `METHOD.md` and
  `cad-verifier-contract` keep their TODO/FIXME/XXX/HACK/placeholder enumeration
  unchanged; the `CADENCE-DEBT` token is named as exempt under the clause already
  there. Adding the token to the scan list would make every planted marker a
  verification gap on the phase that plants it, putting two Cadence surfaces in
  direct disagreement about the same token - and both surfaces sit at exactly
  their byte budget. Evidence: `METHOD.md:216`, `:220-224` ("deliberate follow-up
  markers carrying a ticket reference are not gaps" - the ceiling and trigger
  fields ARE that reference), `skills/cad-verifier-contract/SKILL.md:102`.
- D-14 (Budgets are regenerated in-phase): `cadence-core/bin/weight-budgets.json`
  is regenerated as part of this phase. Measured 2026-08-09: 93 of 93 budgeted
  surfaces are byte-exact, zero under, so one added sentence anywhere is a hard
  `budget-overrun` on the introducing commit. The surfaces this phase most likely
  touches are all in that set: `references/conventions.md` 5115/5115,
  `skills/cad-health/SKILL.md` 5701/5701, `workflows/new-project.md` 15230/15230,
  `references/COMMANDS.md` 4027/4027, `references/seams.md` 18575/18575,
  `skills/cad-capture/SKILL.md` 2345/2345. Evidence:
  `cadence-core/bin/self-verify.mjs:633`, `.planning/phases/2/CONTEXT.md:56` (D-18).

## Acceptance criteria

- [ ] AC1: `cadence-core/references/conventions.md` states numeric-only as the
      phase-directory grammar with no clause permitting an existing named
      directory, and `/cad-health` reports a violation naming the entry for each
      `phases/` directory that is not a bare integer or `N.M` - proved on a
      fixture holding `08-meteogram-legend`, `08`, `14-data-depth-x` and
      `14-shared-derivation`, where the two `14-` entries are named together in
      one diagnostic; a fixture of legal directories reports zero violations
- [ ] AC2: `lease-check --phase 1.10` and `trace append --phase 1.10` resolve
      `phases/1.10`, not `phases/1.1`, and `--phase 08` reports a not-found
      naming `phases/08` rather than silently answering about `phases/8`
- [ ] AC3: A project created by `/cad-new-project` has `.planning/trace.jsonl`
      in `.gitignore` with no manual step, proved on a scratch project; re-running
      does not duplicate the line; a brownfield `.gitignore` keeps every line it
      had; and `/cad-health` on an existing project whose `trace.jsonl` is tracked
      or unignored reports it, staying silent when the line is present
- [ ] AC4: `isRequirementId` accepts `2FA-01` and refuses `14-01`, `08-02` and
      `2026-08`; `audit`'s counts and `unpicked` admit `2FA-01` on a fixture,
      with the test proved failing against the unpatched regex
- [ ] AC5: The harvest run over a fixture returns exactly the planted
      `CADENCE-DEBT` markers with their ceiling and trigger, and zero of this
      tree's 19 conventional markers and zero entries from `node_modules/`
- [ ] AC6: Running the harvest twice leaves `CAPTURE.md` byte-identical, and a
      marker deleted from source disappears from the harvest's section on the
      next run without touching `## Todos`
- [ ] AC7: `node --test cadence-core/bin/*.test.mjs`, `npx tsc -p tsconfig.ci.json`
      and `self-verify --root .` are green with `weight-budgets.json` regenerated,
      and every fix in the phase carries a regression test proved failing-capable
      against the unpatched code, recorded in the SUMMARY

## Flagged assumptions

- AC3's "proved on a scratch project" is proved through the SEAM, not through the
  installed `/cad-new-project` command: per phase 2's D-17 a workflow edit is
  unobservable through the slash command until the plugin is reinstalled. The
  proof is the seam exercised directly against a scratch directory plus the
  workflow's call site verified by reading. Confident; if wrong, AC3 needs a
  manual scaffold run the executor cannot self-verify
- The harvest inherits `git ls-files`' untracked-file blind spot: a
  `CADENCE-DEBT` marker in an untracked file is invisible to it. Confident, and
  arguably correct given D-04's "the marker in tracked code is the durable
  record"; if wrong, the first run under-reports without saying so
- `planning.mjs --root ""` falls through `opts.root || process.cwd()` and
  silently answers about the cwd; the new harvest inherits that shape unless it
  guards explicitly. Likely; the item is open in the queue and unassigned, so the
  guard is this phase's to add or to skip knowingly. Evidence:
  `cadence-core/bin/planning.mjs:2112`, `.planning/CAPTURE.md:96`
- Whether four requirements fit one plan under the resolved
  `workflow.max_plan_tasks` ceiling of 8. The user judged the phase right-sized
  after the tightness was stated; if the planner cannot fit it, the plan gate
  surfaces it rather than this document pre-empting it
