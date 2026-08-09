---
phase: 3
plan: 1
requirements: [FLD-01, FLD-02, PRS-02, DBT-01]
files:
  - METHOD.md
  - cadence-core/bin/debt-markers.test.mjs
  - cadence-core/bin/lib/debt-markers.mjs
  - cadence-core/bin/lib/planning-files.mjs
  - cadence-core/bin/lib/require-int.mjs
  - cadence-core/bin/planning-files.test.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/planning.test.mjs
  - cadence-core/bin/require-int.test.mjs
  - cadence-core/bin/route.mjs
  - cadence-core/bin/route.test.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/weight-budgets.json
  - cadence-core/references/conventions.md
  - cadence-core/workflows/execute.md
  - cadence-core/workflows/new-project.md
  - cadence-core/workflows/progress.md
  - skills/cad-health/SKILL.md
  - skills/cad-verifier-contract/SKILL.md
---

# Phase 3: Field friction - Plan

## Goal

The things that are broken for Cadence's users right now stop being broken:
a `--phase` value resolves the directory the caller spelled, a phase directory
outside the grammar is named instead of silently answered about, a project
Cadence creates keeps its run record out of git by itself, a requirement id
whose category starts with a digit is admitted, and a deliberate corner-cut
carries a marker that reaches the queue.

## Must be true when done

- Every seam that takes `--phase` builds its path from the string the caller
  typed: `lease-check --phase 1.10` and `trace append --phase 1.10` address
  `phases/1.10` rather than `phases/1.1`, the two phases no longer share one
  trace key or one correlation id, and `--phase 08` reports a not-found naming
  `phases/08` instead of answering about `phases/8`.
- Cadence states numeric-only as the phase-directory grammar with no clause
  permitting an existing named directory, and `planning.mjs status` names every
  `phases/` entry outside it - named, zero-padded and prefix-colliding alike -
  with entries sharing a numeric prefix in one diagnostic; a tree of legal
  directories reports nothing.
- A project scaffolded by `/cad-new-project` has `.planning/trace.jsonl` in
  `.gitignore` without the user doing anything by hand, a re-run adds no second
  line, a brownfield `.gitignore` keeps every line it had, and an existing
  project whose trace is tracked or unignored is REPORTED by `/cad-health` and
  edited by nothing.
- `2FA-01` is a requirement id everywhere `audit` counts one, while `14-01`,
  `08-02` and `2026-08` still are not.
- A deliberate corner-cut carries a `CADENCE-DEBT` marker at the line it was cut
  naming its ceiling and its trigger, and `planning.mjs debt-harvest --root .`
  collects every one into `.planning/CAPTURE.md`'s own section - twice in a row
  byte-identical, never touching `## Todos`, returning zero of this tree's 19
  conventional markers and nothing from `node_modules/`.
- `node --test cadence-core/bin/*.test.mjs`, `npx tsc -p tsconfig.ci.json` and
  `node cadence-core/bin/self-verify.mjs --root .` are green with
  `weight-budgets.json` regenerated, and every fix carries a regression test
  proved failing-capable against the unpatched code.

## Context

Binding: `.planning/phases/3/CONTEXT.md` D-01..D-14. D-01 is absolute - no
directory resolver, no `<N>-<slug>` second legal form, no migration seam, no
conversion of `tempest`/`atmos` in any form; Cadence states the grammar and
reports violations, and that is the whole of FLD-01's first half. D-09: the two
`phases/` LISTING filters (`planning.mjs:189`, `:1437`) are correct as they
stand and are NOT loosened. D-13: the verifier's TODO/FIXME/XXX/HACK/placeholder
scan list is untouched; `CADENCE-DEBT` is named exempt under the clause already
there. D-14: 93 of 93 budgeted surfaces are byte-exact today, so a task that
edits prose regenerates its own `weight-budgets.json` entries or its commit is a
hard `budget-overrun`. `PRS-01`, `MIN-01` parts 1 and 2, and `EVD-01` are out of
scope and appear nowhere below.

## Tasks

### Task 1: `--phase` carries the string the caller typed, at every shape site

- **Files:** cadence-core/bin/lib/require-int.mjs, cadence-core/bin/planning.mjs, cadence-core/bin/route.mjs, cadence-core/bin/require-int.test.mjs, cadence-core/bin/planning.test.mjs, cadence-core/bin/trace.test.mjs, cadence-core/bin/route.test.mjs
- **Action:** Close the `String(Number(x))` normalization at its source (D-02),
  across all three independent `--phase` shape rules in one change (D-09) -
  fixing one alone leaves the others refusing the same input in different words.
  In `lib/require-int.mjs` add `requirePhaseArg(raw)` beside the two existing
  guards, returning `{ok:true, raw, value}` or `{ok:false}`: `raw` is the TRIMMED
  input string, `value` its `Number`. Reuse `CURSOR_SHAPE.decimal` and keep BOTH
  existing tests - the shape test and the `re.test(String(n))` round-trip - the
  second is not redundant here even though the raw string is now what gets used:
  it is what refuses a digits-only value big enough that `String()` yields
  `1e+21`, which would still be arithmetic-poison for `total` comparisons.
  Do not change `requireCursorNumber` or `requireInt`; `--total`, `--plan`,
  `--item` and `--n` keep their current readers.

  In `planning.mjs`, route every `--phase` READ through `requirePhaseArg` and
  then apply one rule with two halves: the DIRECTORY component and any
  diagnostic naming a directory use `.raw`; arithmetic, comparisons and the
  echoed `phase` field of the envelope use `.value`. The sites: `cmdSeedReqs`
  (:1343) - `pdir` from `.raw`, the `phase:` echo and the Traceability rows it
  inserts stay `.value`, because `parseRequirements` and `audit` compare that
  cell against ROADMAP phase NUMBERS - a KNOWN identity collision, stated rather
  than assumed (cross-model review survivor 4): `seed-reqs --phase 1.10` reads
  `phases/1.10` and writes `| <id> | Phase 1.1 | Pending |`, so `audit` merges
  the two sub-phases. Same root cause as the `cursor set` boundary below, closing
  the same way (carry the raw spelling through `parseCursor`, `renumber` and
  `audit`), which is wider than AC2 asks for; record it in the report file and
  queue it in `.planning/CAPTURE.md` under `## Todos` naming both sites, so the
  residue is filed rather than lost. `cmdLeaseCheck` (:1636) - `pdir` and the
  `no-plan` detail and hint from `.raw`, `common.phase` stays `.value`;
  `cmdUat` (:482, which today is a bare `Number(opts.phase)` feeding all five
  sub-subcommands) - `uatFile`, the `FINDINGS.json` path and the `fm.phase`
  label from `.raw`, replacing the bare `Number()`+NaN test with the shared
  reader so a malformed `--phase` is refused in the same words everywhere;
  `cmdPlanOverlap` (:1291) - `pdir` and the `no-phase-dir` detail from `.raw`,
  the `phase:` echo `.value`; `cmdCursorSet` (:288) - adopt the shared reader for
  the refusal wording and keep writing `.value`, because `parseCursor` returns a
  NUMBER that `renumber`'s shift arithmetic and `cmdStatus`'s `parsed.phase ===
  current` comparison both consume, so a raw-spelled cursor is a wider change
  than any criterion here asks for; `cmdTrace` append and render (:1855, :1880) -
  pass `.raw` as the event's `phase`, which is what actually separates `1.10`
  from `1.1`: `lib/trace.mjs`'s `key()` already stringifies both sides of every
  comparison, so the correlation id, the render filter and the dispatch/terminal
  pairing all keep working against traces written before this change, and
  `lib/trace.mjs` needs NO edit. Leave `derivePhases` (:118) and `cmdAudit`
  (:880) alone: those build `phases/<n>` from ROADMAP phase numbers, not from a
  flag.

  In `route.mjs`, delete the local `PHASE_RE` (:84) and import `requirePhaseArg`,
  so the third shape rule is the same rule. Behaviour at a bad value is
  UNCHANGED and must stay unchanged - a warning plus a baseline resolve, never a
  refusal (route.mjs:223-233, and `{ok:false}` would route a risky phase LOWER
  than its baseline). Use `.raw` for `declaredPhaseFiles` (it already passes a
  string) and, at :590-592, for the trace event's phase in place of
  `Number(opts.phase)`.

  Tests. `require-int.test.mjs`: `requirePhaseArg('1.10')` returns raw `'1.10'`
  value `1.1`; `'08'` returns raw `'08'` value `8`; `' 2 '` trims; `'1e21'`,
  `'-1'`, `'abc'`, `''` and a non-string are `{ok:false}`. `planning.test.mjs`:
  `lease-check --phase 1.10` against a tree holding `phases/1.1/PLAN.md` and
  `phases/1.10/PLAN.md` names `phases/1.10`'s plan file in `plan_file`, not
  `1.1`'s; `plan-overlap --phase 08` against a tree with `phases/8` returns
  `no-phase-dir` whose detail names `phases/08`; `uat status --phase 1.10` on a
  tree with only `phases/1.1/UAT.md` returns `no-uat` naming `phases/1.10`;
  `seed-reqs --phase 08` returns `no-phase-dir` naming `phases/08`.
  `trace.test.mjs`: appends at `--phase 1.1` and `--phase 1.10` render under
  DIFFERENT `corr` values and `trace render --phase 1.10` returns only the
  `1.10` events - the defect recorded at `.planning/CAPTURE.md:97` (recalled from
  phase 1's queue: `1.1` and `1.10` share one trace key and one correlation id).
  `route.test.mjs`: `resolve --role cad-executor --phase 1.10` reads
  `phases/1.10/PLAN.md`'s declared files for the floor, and a `--phase abc` still
  resolves at the baseline with a warning and `ok:true`.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs
  cadence-core/bin/require-int.test.mjs cadence-core/bin/trace.test.mjs
  cadence-core/bin/route.test.mjs` passes with the new cases; each new case is
  proved failing-capable by reverting the one hunk it covers (`git stash push -p`
  or a hand edit restoring `String(parsedPhase.value)`) and re-running that test
  file to see it RED, then restoring - record the result in
  `.planning/phases/3/reports/plan-1.md`. `npx tsc -p tsconfig.ci.json` is clean.

### Task 2: State numeric-only as the grammar and report every violation

- **Files:** cadence-core/references/conventions.md, cadence-core/bin/planning.mjs, cadence-core/bin/planning.test.mjs, cadence-core/workflows/progress.md, skills/cad-health/SKILL.md, cadence-core/bin/weight-budgets.json
- **Action:** In `references/conventions.md`'s Phase-directory bullet (:22-25)
  DELETE the sentence "Match an existing directory's name if one is already
  present." - it contradicts the grammar stated one line above it - and state the
  grammar in its place: `<N>` is the bare phase integer from ROADMAP.md or an
  `N.M` sub-phase, with no zero-padding and no slug suffix; Cadence does NOT
  resolve any other spelling and ships no second legal form, and `/cad-health`
  reports a directory outside the grammar (D-01, chosen by the user over a
  resolver, a `<N>-<slug>` form and a migration, with the breaking change
  accepted explicitly). Do NOT write that such a directory is "unaddressable by
  every seam" - after task 1 the seams build their path from the string the
  caller typed and never normalize it, so `--phase 08` addresses `phases/08`
  literally: it reads that directory when it exists and reports a not-found
  naming `phases/08` when it does not. The guarantee the grammar actually makes,
  and the sentence to write, is that no spelling is silently redirected to a
  DIFFERENT phase's directory, and that anything outside the grammar is
  unsupported and reported rather than resolved. (Cross-model review survivor 1:
  `CURSOR_SHAPE.decimal` admits `08` and the `String(n)` round-trip admits it
  too, so an absolute "unaddressable" claim would be false the moment such a
  directory exists.)

  In `planning.mjs` `cmdStatus`, add a module constant
  `PHASE_DIR_NAME = /^[1-9]\d*(?:\.\d+)?$/` - the grammar as written above, which
  is deliberately STRICTER than the two listing filters and does not replace
  them: `:189` and `:1437` keep `/^\d+(\.\d+)?$/` untouched (D-09), so a
  zero-padded directory stays out of the recall corpus and out of the
  surviving-dir report exactly as it is today. Walk `phases/` ONCE with
  `readdirSync(dir, {withFileTypes:true})` inside its own try (an absent
  `phases/` is data, never a throw), keep entries that are a directory or a
  symlink (a stray FILE is not a phase directory and reporting `.DS_Store` would
  make the diagnostic noise), and collect the names `PHASE_DIR_NAME` rejects.
  Group them by their LEADING digit run read as a number (`08`,
  `08-meteogram-legend` and `8-foo` group together; a name with no leading digits
  gets its own group). Group the LEGAL names by the same key too, and when a
  group holding at least one rejected name also holds a legal directory, name
  that legal directory in the entry's detail as the phase the invalid spellings
  collide with - `08` beside a legal `8` is the collision AC2 is about, and
  reporting `08` alone leaves the reader to notice it. A group of legal names
  only produces NO entry, so `drift` still stays absent on a clean tree, and a
  legal name is never itself listed in `entries` (cross-model review survivor 5).
  Then push ONE drift entry per group:
  `{kind: 'phase-dir-grammar', entries: [...names, sorted], detail: '<names> is
  not a phase directory name (bare integer or N.M, no zero-padding, no slug)'`,
  and for a group of more than one, the detail also says they share numeric
  prefix `<k>`. ONE kind covers named, zero-padded and colliding entries (D-08);
  do NOT add a second shadowing diagnostic - `join(dir, 'phases', String(n))` can
  never produce `14-data-depth-x`, so a shadowing rule would report a hazard no
  code path reaches. The entry carries NO `phase` key, the same reason `unpicked`
  omits one at :952: there is no phase number to report, and inventing one would
  make it indistinguishable from the drift kinds that have one. Legal entries add
  nothing, so `drift` stays absent on a clean tree.

  In `workflows/progress.md`:35-36, add `phase-dir-grammar` to the drift-kind
  list with a five-word gloss. In `skills/cad-health/SKILL.md` check 5, extend
  the existing `.planning/phases/<N>/` clause: the directory grammar is bare
  integer or `N.M` (`references/conventions.md`), and every `phase-dir-grammar`
  entry `planning.mjs status` returns is reported as an issue naming the entries
  - Cadence cannot address those directories, and renaming them is the user's
  call, never an auto-fix. Regenerate the `weight-budgets.json` entries for all
  three prose files (`conventions.md` 5115, `progress.md` 7791,
  `cad-health/SKILL.md` 5701 today, zero slack on each).

  Tests in `planning.test.mjs`: a fixture whose `phases/` holds
  `08-meteogram-legend`, `08`, `14-data-depth-x`, `14-shared-derivation` plus a
  legal `1` returns exactly TWO `phase-dir-grammar` entries - one naming both
  `14-` directories together with their shared prefix, one naming `08` and
  `08-meteogram-legend` together - and no entry naming `1`; a fixture holding
  `1`, `2`, `2.1` and `10` returns `drift: undefined`; a stray FILE in `phases/`
  produces no entry; a fixture holding a legal `8` beside `08` returns ONE entry
  whose `entries` is exactly `['08']` and whose detail names the legal `8` it
  collides with.
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes with the
  four new cases, each proved failing-capable by removing the new walk and
  re-running (record it in the report file); `node cadence-core/bin/planning.mjs
  status | grep -c phase-dir-grammar` returns `0` against this repo (its
  `phases/` holds `1`, `2`, `3`); `grep -n "Match an existing directory"
  cadence-core/references/conventions.md` returns nothing; `node
  cadence-core/bin/self-verify.mjs --root .` returns `ok:true` (proves the three
  budget entries were regenerated).

### Task 3: A project Cadence creates keeps its run record out of git

- **Files:** cadence-core/bin/planning.mjs, cadence-core/bin/self-verify.mjs, cadence-core/bin/planning.test.mjs, cadence-core/workflows/new-project.md, cadence-core/workflows/execute.md, skills/cad-health/SKILL.md, cadence-core/bin/weight-budgets.json
- **Action:** Add `trace ignore --root <project root> [--check]` to `cmdTrace`'s
  subcommand switch - a `planning.mjs` subcommand and not a new top-level script,
  for D-10's reasons (a second `CONTRACTS` row, a second weight surface, a new
  file with no test harness), and `--root` and not `--dir` for the
  `detect-commands` reason stated verbatim at :2203-2208: this one names the
  PROJECT root, because `.gitignore` lives there while the line it carries is
  `.planning/trace.jsonl`. Refuse a `--root` that is present without a usable
  path - `typeof !== 'string'` (the valueless-flag shape `parseArgs` renders as
  boolean `true`) or empty after trim - with `bad-args` naming the flag, rather
  than falling through `opts.root || process.cwd()` and silently answering about
  the cwd; that hole is open and unassigned in the queue and this subcommand
  closes it for itself. Leave `detect-commands`' identical `opts.root || cwd`
  fall-through alone: changing a shipped seam's behaviour is not covered by any
  requirement in this phase, and the queue item stays open naming it.

  Behaviour. Resolve `ignored` through git when the root is a repo -
  `git -C <root> check-ignore -v -- .planning/trace.jsonl`, exit 0 means ignored
  - and fall back to a literal line scan of `<root>/.gitignore` (`.planning/trace.jsonl`
  or `/.planning/trace.jsonl`, comments and blanks skipped) when git is absent or
  the root is not a repo; report which was used as `method: 'git' | 'file'`. The
  git arm is not decoration: a project that ignores `.planning/` wholesale is
  already correct, and a literal-only test would tell it to add a line it does
  not need. But `-q` is NOT enough and that is why `-v` is specified:
  `check-ignore` also consults `core.excludesFile` and `.git/info/exclude`,
  neither of which travels with the repository, so a machine-local exclusion
  would report `ignored:true` and leave the project with NO ignore line of its
  own - the collaborator who clones it commits the run record on the next
  `git add .planning`, which is exactly the failure FLD-02 exists to close.
  Read `-v`'s first field (the matching source) and treat the match as
  satisfying ONLY when that source is a `.gitignore` file inside `<root>`;
  report it as `source`, and when the match came from a global exclude or
  `.git/info/exclude`, treat it as NOT satisfied and write the line anyway
  (cross-model review survivor 2). Add a test for it: a root whose
  `.planning/trace.jsonl` is ignored solely through `.git/info/exclude` gets
  `written:true` and a `.gitignore` holding the line. Also report `tracked`, from `git -C <root> ls-files --error-unmatch
  -- .planning/trace.jsonl` (exit 0 means tracked), guarded so a non-repo reports
  `false`. `--check` REPORTS and writes nothing (D-03: `/cad-health` never edits
  a user's file). Without `--check`: already ignored -> `{ok:true, written:false,
  reason:'already-ignored'}`, which is what makes a re-run a no-op; otherwise
  append the line to `<root>/.gitignore`, creating the file when absent, and
  preserve every existing byte - append a leading newline only when the current
  contents do not end with one, and add one comment line above it naming what the
  file is. Envelope: `{ok:true, root, file, line, ignored, tracked, method,
  written}`.

  Wire it. `workflows/new-project.md`'s setup step (:17-53) runs items 2-5 as ONE
  Bash step; add the call there, AFTER the `git init` arm and beside `mkdir -p
  .planning`, as `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/planning.mjs"
  trace ignore --root .`, with one sentence saying it is append-if-absent, a
  no-op on re-run, and that a brownfield `.gitignore` keeps every line it had -
  the brownfield arm at :49-53 is exactly the case that must not be clobbered.
  In `workflows/execute.md`:226, keep the assertion and make it TRUE: name the
  scaffold-time seam as the reason `.planning/trace.jsonl` is gitignored and
  `/cad-health` as what reports a project scaffolded before it - today nothing in
  Cadence writes that line and the premise holds in this repo only because it was
  added by hand (`.gitignore:26`), which is the finding recalled from phase 2's
  CAPTURE. In `skills/cad-health/SKILL.md`, add ONE bullet to check 1 (Presence):
  run `trace ignore --root . --check` and report an issue when `ignored` is false
  or `tracked` is true, naming the fix command; silent when the record is ignored
  and untracked; never edit. Add the `CONTRACTS` row in the SAME task per phase
  2's D-20: `'trace ignore': ['--root', '--check']` under `planning.mjs` in
  `self-verify.mjs`:150. `.planning/CAPTURE.md` is NOT added to any ignore line
  anywhere in this task (D-04) - it is tracked in `hindsight` and `assistant` on
  purpose, and DBT-01's whole premise was reasoned against that half.
  Regenerate the `weight-budgets.json` entries for `new-project.md` (15230),
  `execute.md` (25655) and `cad-health/SKILL.md` (its second edit this phase).

  Tests in `planning.test.mjs`, beside the `detect-commands` block (:3915) since
  that is the other `--root` subcommand: a scratch `git init` root with no
  `.gitignore` -> `written:true`, the file exists holding the line; re-run ->
  `written:false, reason:'already-ignored'` and the file is byte-identical; a
  brownfield `.gitignore` of three lines with NO trailing newline -> all three
  lines survive verbatim and the new line is on its own line; a root ignoring
  `.planning/` wholesale -> `--check` reports `ignored:true, method:'git'` and no
  write; a non-git root -> `method:'file'` and the write still happens; a root
  whose `.planning/trace.jsonl` is `git add`ed -> `tracked:true`; `--root` with
  no value and `--root ""` -> `ok:false, bad-args`; a root ignoring the record
  ONLY through `.git/info/exclude` -> `written:true` and `.gitignore` holds the
  line (the survivor-2 case).
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes with the
  eight new cases, proved failing-capable against the unpatched subcommand
  (run them at the commit before this task's implementation hunk; record it).
  Then prove AC3 end to end on a scratch project through the SEAM, which is the
  proof available - per phase 2's D-17 a workflow edit is invisible to
  `/cad-new-project` until the plugin is reinstalled:
  1. `mkdir -p /tmp/cad-scratch && cd /tmp/cad-scratch && git init && mkdir -p .planning`
  2. `node /data/code/cadence/cadence-core/bin/planning.mjs trace ignore --root .`
     - expected: `{"ok":true,...,"written":true}` and `cat .gitignore` shows
     `.planning/trace.jsonl`.
  3. Re-run the same command - expected `"written":false` and
     `"reason":"already-ignored"`, with `.gitignore` unchanged.
  4. `grep -n "trace ignore" cadence-core/workflows/new-project.md` shows the
     call inside the setup step, after the `git init` item.
  5. `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` - it
     lints the two new prose invocations against the new `CONTRACTS` row and the
     regenerated budgets together.

### Task 4: `REQ_ID_EXACT` admits a category that does not start with a letter

- **Files:** cadence-core/bin/lib/planning-files.mjs, cadence-core/bin/planning-files.test.mjs, cadence-core/bin/planning.test.mjs
- **Action:** Widen `REQ_ID_EXACT` (:275) to require a letter SOMEWHERE in the
  category rather than at its head, keeping the category's 2-8 character length
  and the `#\d+` arm exactly as they are:
  `^(?:(?=[A-Z0-9]{2,8}-)[A-Z0-9]*[A-Z][A-Z0-9]*-\d+|#\d+)$`. This admits
  `2FA-01`, `3DS-02` and `A11Y-01` and refuses `14-01`, `08-02` and `2026-08`.
  It is the INTENT of CONTEXT D-05 ("a letter is required somewhere in the
  category") implemented over the literal regex D-05 writes: that literal,
  `[A-Z0-9]{1,2}[A-Z][A-Z0-9]{0,6}-\d+`, cannot match `A11Y-01`, which the same
  decision names as admitted - `[A-Z]` would have to fall at index 1 or 2 and
  `A11Y` has digits at both. Record the deviation and this reason in the report
  file. A bare `[A-Z0-9]` lead stays REFUSED and must not be reintroduced:
  `ACTIVE_BULLET` reads ANY bold span as an id and narrowing it is off the table,
  so `isRequirementId` is the only filter standing between a bolded date or plan
  reference and `audit`'s counts, `unpicked` and a phantom `orphans.plan_ids`
  break already paid for once. Leave `REQ_ID_TOKEN` (:265) and its `_G` twin
  UNCHANGED - the unanchored scan regex is deliberate per its own comment, and
  "consistency" is not a reason to touch it. Update the block comment above
  `REQ_ID_EXACT` to state the new rule and why the length window is preserved.

  Tests. `planning-files.test.mjs`: `isRequirementId` accepts `2FA-01`,
  `A11Y-01`, `3DS-02`, `TRI-01`, `#41`; refuses `14-01`, `08-02`, `2026-08`,
  `A-01` (one-character category, refused before and after), a nine-character
  category, `AUTH-01:` and `Note`. `planning.test.mjs`: an `audit` fixture whose
  `## Active` declares `- **2FA-01**: ...` with no Traceability row returns a
  `{id:'2FA-01', break:'unpicked'}` entry, names it in `unseeded.active_ids`, and
  counts it in `counts.total` - the `total = traced + broken + deferred`
  invariant still holds; the same fixture spelling the bullet `- **2026-08**:`
  produces NO `unpicked` entry and reports `active-non-id-bullet` instead.
- **Verify:** `node --test cadence-core/bin/planning-files.test.mjs
  cadence-core/bin/planning.test.mjs` passes; the `2FA-01` cases are proved
  failing-capable by restoring the old regex and re-running (they must go RED),
  recorded in the report file; `npx tsc -p tsconfig.ci.json` is clean.

### Task 5: State the `CADENCE-DEBT` marker convention and its verifier exemption

- **Files:** cadence-core/references/conventions.md, METHOD.md, skills/cad-verifier-contract/SKILL.md, cadence-core/bin/weight-budgets.json
- **Action:** Add a `## Deliberate shortcuts` section to
  `references/conventions.md` stating the convention DBT-01 part 1 asks for: a
  corner-cut taken on purpose is marked at the line it was cut, in whatever
  comment syntax the file uses, on ONE line, as the token `CADENCE-DEBT` followed
  by a colon, the one-line description of what was cut, then ` | ceiling: ` what
  it does not handle, then ` | trigger: ` what should prompt revisiting it. Both
  fields are required; the harvest names a marker missing one rather than
  dropping it. State the token choice and why it is not negotiable later
  (D-07): `CADENCE-DEBT` is namespaced so it cannot collide with a marker another
  tool introduces, measured over the tracked tree on 2026-08-09 - `SHORTCUT`,
  `DEBT`, `CORNER`, `TRIPWIRE`, `CADENCE-DEBT` and `CAD-DEBT` all return zero
  from `git grep -w` while `CUT` returns 9 and `CEILING` 1 - and once markers are
  planted across a tree, changing the token means editing every one of them.
  State in the same section that `planning.mjs debt-harvest --root .` is what
  collects them, that the marker in tracked code is the durable record while
  `.planning/CAPTURE.md` is a regenerable view of it (D-04), and that
  documentation ABOUT this convention describes the fields in prose rather than
  writing a literal marker line, because the harvest scans tracked source and
  would otherwise ingest its own documentation.

  In `METHOD.md`'s Anti-pattern scan paragraph (:216-224) and in
  `skills/cad-verifier-contract/SKILL.md`'s debt-marker bullet (:100-103), leave
  the TODO/FIXME/XXX/HACK/placeholder enumeration EXACTLY as it is and add one
  clause naming `CADENCE-DEBT` as exempt under the follow-up-marker clause
  already there - its `ceiling:` and `trigger:` fields ARE the reference that
  clause requires (D-13). Adding the token to the scan list instead would make
  every planted marker a verification gap on the phase that plants it and put two
  Cadence surfaces in direct disagreement about one token. Regenerate the
  `weight-budgets.json` entries for `conventions.md` (its second edit this phase)
  and `cad-verifier-contract/SKILL.md` (10009 today); `METHOD.md` is not a
  measured surface and has no entry.
- **Verify:** `node cadence-core/bin/weight.mjs --root .` shows
  `cadence-core/references/conventions.md` and
  `skills/cad-verifier-contract/SKILL.md` at or under their regenerated entries;
  `grep -n "CADENCE-DEBT" METHOD.md skills/cad-verifier-contract/SKILL.md` shows
  one exemption clause in each with the TODO/FIXME/XXX/HACK list unchanged
  beside it; `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true`.

### Task 6: The harvest seam collects markers into `.planning/CAPTURE.md`

- **Files:** cadence-core/bin/lib/debt-markers.mjs, cadence-core/bin/lib/planning-files.mjs, cadence-core/bin/planning.mjs, cadence-core/bin/self-verify.mjs, cadence-core/bin/debt-markers.test.mjs, cadence-core/bin/planning.test.mjs, cadence-core/workflows/execute.md, cadence-core/bin/weight-budgets.json
- **Action:** Split the work the way `lib/risk-surfaces.mjs` (pure) and
  `lib/phase-plans.mjs` (guarded I/O) are already split. NEW pure module
  `lib/debt-markers.mjs`, no I/O and no throw, exporting: `debtMarkersIn(text)`
  -> `[{line, text, ceiling, trigger, malformed?}]` parsing the task-5 grammar
  from a file's contents (the token must be followed immediately by a colon, so
  the backticked prose mentions in `REQUIREMENTS.md` and this phase's CONTEXT are
  not markers; a marker missing `ceiling:` or `trigger:` yields the entry with
  that field `null` and `malformed` naming the missing one, never a dropped
  entry); and `renderDebtSection(entries)` -> the section body, one bullet per
  marker as `` - `<path>:<line>` <text> - ceiling: <c> - trigger: <t> `` with an
  unstated field rendered `(unstated)`, sorted by path then line, and `- None.`
  when there are none. Export `sectionBound` from `lib/planning-files.mjs`
  (module-local today, :993) rather than writing a second fence scanner: it is
  the exact rule D-12 requires and a duplicate would drift from the one
  `sectionBound` was written to close.

  In `planning.mjs` add `cmdDebtHarvest(root)` and the dispatch entry
  `'debt-harvest'` (D-10: a lowercase-hyphen subcommand, not a new script),
  taking `--root` with the same present-but-unusable refusal task 3 wrote.
  Enumerate with `execFileSync('git', ['-C', root, 'ls-files', '-z'])` split on
  0x00 (D-11) - it omits UNTRACKED files, which is what keeps an ignored
  `node_modules/` out in the ordinary case, load-bearing here because
  `node_modules/` is present in this repo and would otherwise return third-party
  markers. It is not "every ignored file for free" and the code must not say so:
  an ignore rule does not remove an ALREADY TRACKED path from `ls-files`, so a
  force-added (`git add -f`) or historically tracked `node_modules/pkg/x.js` is
  still enumerated. Skip every path whose segments include `node_modules`
  explicitly, for the same reason and in the same place as the `.planning/` skip,
  and state that reason in the code comment (cross-model review survivor 3). Test
  it the way the claim actually breaks: a fixture whose `node_modules/pkg/x.js`
  carrying a marker is FORCE-ADDED contributes nothing. No existing walker is reusable
  (`surfaces()` walks a fixed Cadence-owned set, `mdFiles` is `.md`-only). A root
  that is not a git repo is `ok:false, no-git` - an unenumerable tree must not
  report zero markers. SKIP every path under `.planning/`, and say why in the
  code: it holds the harvest's own output, which is TRACKED in `hindsight` and
  `assistant` (D-04), so scanning it would make the harvest ingest itself and
  destroy the idempotence the whole design rests on; it also holds every planning
  doc that quotes the convention. Skip a file larger than 1 MiB and any file
  whose bytes contain a NUL (binary), both silently.

  Write into `<root>/.planning/CAPTURE.md` under `## Debt markers`, rewritten
  WHOLESALE (D-06): the heading is the harvest's own and is NOT added to
  `parseCaptureSnippets`' `['Todos','Seeds','Notes']` walk list, because
  idempotence is impossible under append - `/cad-capture` and `execute.md` both
  append to `## Todos` by hand - and because a marker planted in code must not
  start steering `/cad-plan`'s recall without anyone choosing it. The stated cost
  is that a harvested marker reaches recall only when promoted by hand. Bound the
  existing section with the exported `sectionBound` so a bullet carrying a fenced
  block with a `## ` line inside it is not truncated; append the section at the
  end of the file when it is absent; create `CAPTURE.md` with `## Todos`,
  `## Seeds`, `## Notes` and then the section when the file itself is absent,
  matching `skills/cad-capture/SKILL.md`:32-35. Write through the exported
  `atomicWrite`, and only when the rendered text differs from what is on disk, so
  a second run reports `written:false` and leaves the file byte-identical.
  Envelope: `{ok:true, root, file, markers, files, written, ...(malformed.length
  ? {malformed} : {})}`. Add the `CONTRACTS` row in the same task (D-20):
  `'debt-harvest': ['--root']`.

  Give it a call site so the seam is not shipped dark: in
  `workflows/execute.md`'s `summary` step, beside the existing instruction that
  appends each open item to `.planning/CAPTURE.md` (:402-405), one sentence
  running `debt-harvest --root .` before the docs commit so markers planted
  during the phase land in the queue on the phase that planted them, stated as
  best-effort - a non-zero exit is reported and never blocks the summary.

  Tests. `debt-markers.test.mjs` (pure): a well-formed marker parses text,
  ceiling and trigger; a line carrying the token with no colon is not a marker;
  a marker missing `trigger:` returns the entry with `malformed` naming it; two
  markers in one file keep their line numbers; `renderDebtSection([])` is
  `- None.`; ordering is path then line. `planning.test.mjs` (the seam, on a
  scratch `git init` fixture): a planted marker in `src/a.js` is returned with
  its ceiling and trigger, while `src/b.js` carrying TODO, FIXME, XXX, HACK and
  NOTE contributes nothing and a marker inside an ignored `node_modules/pkg/x.js`
  and inside an untracked file contribute nothing (AC5), and neither does a
  marker in a FORCE-ADDED `node_modules/pkg/y.js`, which `git ls-files` does
  enumerate; running twice leaves
  `CAPTURE.md` byte-identical with `written:false` on the second run, and a
  `## Todos` section written before the first run is byte-identical after both
  (AC6); deleting the marker from `src/a.js` removes its bullet on the next run
  and still leaves `## Todos` untouched; a `## Todos` bullet containing a fenced
  block with a `## build output` line inside it survives the rewrite intact; a
  fixture whose `.planning/CAPTURE.md` is TRACKED and already holds a harvested
  section stays idempotent (the self-ingestion guard); a non-git root returns
  `ok:false, no-git`.
- **Verify:** `node --test cadence-core/bin/debt-markers.test.mjs
  cadence-core/bin/planning.test.mjs` passes; the AC5 and AC6 cases are proved
  failing-capable by removing the `.planning/` skip and the differs-from-disk
  guard in turn and re-running (both must go RED), recorded in the report file.
  Then, over this repo: `node cadence-core/bin/planning.mjs debt-harvest --root .`
  returns `"markers":0` - no marker is planted in this phase, and a non-zero
  count means a doc is being ingested as one, which is repaired by rewriting that
  documentation per task 5, never by narrowing the scan. `npx tsc -p
  tsconfig.ci.json` is clean and `node cadence-core/bin/self-verify.mjs --root .`
  returns `ok:true` (it lints the new `execute.md` invocation against the new
  `CONTRACTS` row).

### Task 7: Green the tree and record the failing-capable evidence

- **Files:** cadence-core/bin/weight-budgets.json, cadence-core/bin/self-verify.test.mjs
- **Action:** Close AC7. Run `node cadence-core/bin/weight.mjs --root .` and
  reconcile `weight-budgets.json` against it for EVERY surface this phase edited
  - `conventions.md`, `progress.md`, `new-project.md`, `execute.md`,
  `cad-health/SKILL.md`, `cad-verifier-contract/SKILL.md` - so no entry is left
  at a stale byte count from an earlier task's regeneration (D-14: 93 of 93
  surfaces were byte-exact at the phase's start, so a missed entry is a hard
  `budget-overrun`). If `self-verify.test.mjs` pins the `CONTRACTS` table's shape
  or its row count, extend it for the two new rows (`trace ignore`,
  `debt-harvest`); if it does not, leave the file untouched rather than adding a
  test it does not own. Then write the AC7 record into
  `.planning/phases/3/reports/plan-1.md`: one row per fix in this phase naming
  the regression test, the mutation or reverted hunk used to prove it
  failing-capable, and the RED result observed - the four fixes are the phase
  argument's raw spelling, the grammar-violation drift, the ignore seam, the
  requirement-id regex and the harvest. Also record task 4's stated deviation
  from D-05's literal regex and its reason. No new behaviour ships in this task.
- **Verify:** All three, in this order, each on the whole tree: `node --test
  cadence-core/bin/*.test.mjs` passes; `npx tsc -p tsconfig.ci.json` is clean;
  `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with an
  empty `problems` array. `node cadence-core/bin/weight.mjs --root .` shows every
  edited surface at or under its entry. `grep -c "failing-capable"
  .planning/phases/3/reports/plan-1.md` returns at least 1 and the file's table
  names all five regression tests.

## Notes

**One plan, matching the CONTEXT `Plan shape` directive, and the independence
test agrees.** A split is refused on shared files, not on preference:
`cadence-core/bin/planning.mjs` is written by FLD-01 (tasks 1-2), FLD-02 (task 3)
and DBT-01 (task 6); `cadence-core/bin/planning.test.mjs` by all four
requirements; `cadence-core/bin/weight-budgets.json` and
`cadence-core/references/conventions.md` by two tasks each;
`skills/cad-health/SKILL.md` by tasks 2 and 3; `cadence-core/workflows/execute.md`
by tasks 3 and 6. Seven tasks against the resolved `workflow.max_plan_tasks`
ceiling of 8.

**Stated boundary in task 1.** `cursor set` adopts the shared reader for its
refusal wording but keeps WRITING the numeric value, so a cursor set at
`--phase 1.10` still renders `Phase: 1.1` and a command invoked with no explicit
`--phase` on that phase resolves `phases/1.1`. `parseCursor` returns a Number
that `renumber`'s shift arithmetic, `cmdStatus`'s agreement comparison and
`phase-plans.mjs`' `cursorPhase` all consume; carrying a raw spelling through the
cursor is a wider change than AC2 asks for, and a half-raw cursor is worse than a
numeric one. This is visible rather than assumed. The SAME normalization
survives in `cmdSeedReqs`' Traceability rows for the same reason (the cell is
compared against ROADMAP phase numbers), so the decimal spelling is still
normalized away in exactly two places, both queued in `.planning/CAPTURE.md` by
task 1 rather than left implicit - the cross-model plan review's survivor 4.

**Stated deviation in task 4.** D-05's literal regex and D-05's own list of
admitted ids disagree: `A11Y-01` cannot match `[A-Z0-9]{1,2}[A-Z][A-Z0-9]{0,6}`.
The task implements the decision's stated rule - a letter required somewhere in a
2-8 character category - which satisfies every id D-05 admits and refuses every
id it refuses, including all three AC4 names.

**Task 3's `detect-commands` non-change is deliberate.** The `--root ""` ->
silently-answers-about-the-cwd shape is flagged in CONTEXT as this phase's to add
or skip knowingly. The two NEW subcommands guard it; the shipped one is left
alone because changing its behaviour is covered by no requirement here, and the
queue item stays open naming it.

Recalled prior art weighed while planning: phase 1's CAPTURE entry that
`lease-check` and `cmdTrace` build the phase directory from `requireCursorNumber`'s
NUMERIC value, so `--phase 1.10` reads `phases/1.1` and `1.1`/`1.10` share one
trace key (task 1, and the `.planning/CAPTURE.md:97` row phase 1 left
`unassigned`); phase 2's CAPTURE entry that `execute.md:226` asserts the trace
"is gitignored" while nothing in Cadence writes that line, verified across nine
other Cadence projects (task 3); and phase 1's D-03, which made `## Archive`
invisible to recall with zero code change by staying out of
`parseCaptureSnippets`' hardcoded walk list - the same property task 6 relies on
for `## Debt markers` (D-06).
