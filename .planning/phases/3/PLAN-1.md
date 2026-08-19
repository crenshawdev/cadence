---
phase: 3
plan: 1
requirements: [RCH-01, RSK-03]
files:
  - cadence-core/bin/lib/on-path.mjs
  - cadence-core/bin/on-path.test.mjs
  - cadence-core/bin/issue-check.mjs
  - cadence-core/bin/issue-check.test.mjs
  - cadence-core/bin/helper-census.test.mjs
  - cadence-core/bin/lib/test-seam.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/planning.test.mjs
  - cadence-core/bin/lib/plan-key.mjs
  - cadence-core/bin/plan-key.test.mjs
  - cadence-core/workflows/execute.md
  - cadence-core/bin/weight-budgets.json
---

# Phase 3: Gates that fire on themselves or cannot be satisfied - Plan 1

## Goal

The two `planning.mjs` faces that answer about something other than what they
were asked stop doing it: `detect-commands` names a lint or typecheck command
only when its binary is reachable, and `risk-check`'s two faces accept one
worker-key grammar, so a `status` derived from lifecycle brackets is satisfiable
for every key `references/seams.md` permits a dispatch to carry.

## Must be true when done

- On a fixture tree whose lint evidence is a `[tool.ruff]` `pyproject.toml` with
  `ruff` unreachable, `detect-commands` answers `lint: null` with the
  unreachable tool named in `warnings[]`, and does NOT fall through to
  `go vet ./...` from a `go.mod` in the same tree.
- Run against this repository, `detect-commands --root .` still answers
  `npx tsc -p tsconfig.ci.json` for typecheck - `tsc` is absent from PATH here
  and present at `node_modules/.bin/tsc`, which is where `npx` resolves it.
- The `detect-commands` assertions give the same answers on a machine where
  `ruff`, `mypy`, `eslint`, `tsc` and `go` are all absent and on one where each
  is stubbed onto PATH: reachability is pinned by the fixtures, not by the
  machine.
- `risk-check run --phase <N> --plan 1-fix --base <ref> --head <ref>` answers
  `ok:true` and leaves one `risk_check` record keyed `1-fix`, where it answers
  `bad-args` today; `risk-check status` for a phase whose executor bracket
  carries `1-fix` refuses until that key's record AND its fire receipt exist,
  then passes.
- Both risk-check faces reach the plan-key grammar through ONE exported
  predicate, and a test asserts that every spelling either face accepts is
  accepted by both and every spelling either refuses is refused by both.
- `workflows/execute.md` states what worker key a continuation or fix-pass
  dispatch carries, and that the risk record and the fire receipt for that
  dispatch are written with that same spelling.
- `node cadence-core/bin/test.mjs` and `node cadence-core/bin/self-verify.mjs`
  both pass.

## Context

Locked decisions that bind this plan: D-01 (`run` WIDENS, `status` does not
narrow - the CAPTURE.md phase-3 note preferring the exclusion arm is superseded,
and the stated cost is that record and receipt must share one spelling), D-02
(ONE shared predicate, not two independent edits), D-03 (the trace WRITE face is
NOT where this is enforced - 239 role-keyed events would be refused), D-04 (probe
the DRIVER, plus `<root>/node_modules/.bin/<tool>` for an `npx`-delegated arm),
D-05 (an unreachable winning arm NULLS its slot and warns; no fall-through),
D-09 (`PATHEXT` on win32), D-10 (the predicate is extracted to `lib/`, pure `fs`,
no subprocess), D-11 (reachability behind a `CADENCE_*` override the fixtures
set), D-12 (`workflows/execute.md` gains the missing worker-key statement).
Out of scope here: the eight `CONTENT_SIGNALS` patterns, `lib/risk-diff.mjs` and
`risk-diff.test.mjs` (plan 2 holds that lease), `planning.mjs`'s own `--dir`
(phase 2 D-03 recorded it as a known gap), and `lease-check --plan`, which names
a plan FILE on disk.

## Tasks

### Task 1: One reachability predicate, in `lib/`, imported by the seam that already had one

- **Files:** cadence-core/bin/lib/on-path.mjs, cadence-core/bin/on-path.test.mjs,
  cadence-core/bin/issue-check.mjs (its `onPath` plus the one-resolution-site
  clause in the file header), cadence-core/bin/issue-check.test.mjs,
  cadence-core/bin/helper-census.test.mjs (the `HELPERS` table)
- **Action:** Move `issue-check.mjs`'s `onPath` body - the walk over
  `process.env.PATH` split on `delimiter`, testing `accessSync(join(dir, bin),
  constants.X_OK)` - into a new `cadence-core/bin/lib/on-path.mjs`, and import it
  back there so the seam keeps exactly one resolution site. Pure lib in the shape
  `lib/require-int.mjs` and `lib/lease-grammar.mjs` have: `fs`/`path` only, no
  `execFileSync`, no `emit`, no envelope. Two answers the two callers need: does
  a bare NAME resolve as an executable anywhere on the child's PATH, and does it
  resolve inside ONE named directory (task 2 asks that about
  `<root>/node_modules/.bin`). No subprocess anywhere in it (D-10): spawning
  `command -v` per arm would put up to six child processes on the path the
  executor runs before every commit, and `cmdDetectCommands` has no
  `execFileSync` today. On win32 the lookup honours `PATHEXT` (D-09) - `npm`,
  `npx` and `tsc` ship there as `.cmd`/`.ps1` shims, so a bare `join(dir, bin)`
  with `X_OK` answers false for all three, and no file in this tree states a
  supported-platform set, so the predicate must not quietly create one. Read NO
  Cadence env variable in this module: `issue-check.mjs`'s header states it
  honours no override for binary resolution and that a test injects a stub by
  prepending a directory to the child's PATH so the PRODUCTION resolver runs -
  that promise stays true only because the override task 2 adds lives at
  `detect-commands`' call site instead. Add a `HELPERS` row in
  `helper-census.test.mjs` keyed on this predicate's body idiom, following that
  file's own rules: tree-wide, DEFINITIONS only, and built from an escaped string
  so the row cannot match its own source. Keep `issue-check.mjs`'s behaviour
  otherwise untouched - it is a read-only advisory seam and this task changes
  where the rule lives, not what it answers.
- **Verify:** `node --test cadence-core/bin/on-path.test.mjs
  cadence-core/bin/issue-check.test.mjs cadence-core/bin/helper-census.test.mjs`
  passes; the `on-path` table covers a name made reachable by a stub directory
  prepended to PATH, an absent name, an empty PATH entry, a directory that does
  not exist, and a same-named file with no execute bit; `grep -rn "X_OK"
  cadence-core/bin` names `lib/on-path.mjs` and nothing else.

### Task 2: `detect-commands` names a command only when its binary is reachable

- **Files:** cadence-core/bin/planning.mjs (`cmdDetectCommands` plus the
  `detect-commands` entry in the usage header at the top of the file),
  cadence-core/bin/lib/test-seam.mjs (its header enumeration of gated
  variables), cadence-core/bin/planning.test.mjs (the `detect-commands` block
  from the `projectTree`/`detect` helpers onward)
- **Action:** After an arm wins its slot in `cmdDetectCommands`, ask task 1's
  predicate whether the command is reachable, and answer accordingly. The probe
  target is the command's DRIVER - its first whitespace-separated word - and,
  for an `npx`-delegated arm, ALSO the delegated tool, reachable when it is on
  PATH or present at `<root>/node_modules/.bin/<tool>` (D-04). Both halves are
  load-bearing on measured facts: `npx` is on PATH here, so a driver-only rule
  leaves `npx eslint .` naming an eslint nobody has, and `tsc` is absent from
  PATH while present at `node_modules/.bin/tsc`, so a PATH-only rule nulls this
  repository's only detected static-analysis command and the one CI runs. An
  unreachable winning arm NULLS its slot and names the unreachable tool in
  `warnings[]`; it does NOT fall through to a lower matching arm (D-05) - with
  fall-through, a tree carrying `[tool.ruff]` and `go.mod` with `ruff` absent is
  told to run `go vet ./...`, a linter its maintainers did not choose over a
  language the change may not touch, which is exactly the ordering rule the
  ladder comment states ("A project's OWN script beats a tool config in the same
  tree"). `source` keeps its always-both-keys shape whatever the verdict; the
  nulled slot's `source` entry is null too and the warning carries both the tool
  and the manifest that named it, so `source` never claims provenance for a
  command that is not being offered while the caller can still tell "found
  nothing" from "found something unreachable". The reachability answer for THIS
  command only is overridable by a new `CADENCE_*` variable read only when
  `testSeamOpen()` holds, in the `(testSeamOpen() && process.env.X) || fallback`
  shape `route.mjs` uses for `CADENCE_ROUTE_TABLE`: when the variable is present
  - INCLUDING set-to-empty, which must mean "nothing is reachable" and therefore
  cannot be read through `||` - it supplies the reachable set in place of the fs
  probe; absent, the probe runs. Add its row to `lib/test-seam.mjs`'s header,
  which is this tree's register of gated variables and states why each is gated;
  gate it because it decides which static-analysis command an executor is told
  to run, which is the ungated-test-override shape EXP-01 refused. Re-pin the
  existing 23 `detect-commands` assertions through that variable (D-11) - the
  `detect` helper must pass `env` the way the `run` helper at planning.test.mjs
  already does - because with driver semantics the `ruff`, `mypy` and two `go`
  rows fail on this machine today, and with the `node_modules/.bin` half the
  `npx eslint`/`npx tsc` rows fail in every `mkdtempSync` tree. Add the
  unreachable-arm rows and the row proving the variable ALONE is ignored without
  the sentinel (the `route.test.mjs` gated-injection precedent). Do NOT commit an
  assertion over this repository's own tree: CI's `node-test` jobs run with no
  `npm install` (`.github/workflows/test.yml`), so `node_modules/.bin/tsc` is
  absent there and such a test would be green here and red in CI. Update the
  `detect-commands` usage-header line so it states the reachability term rather
  than only "read from its manifests".
- **Verify:** `node --test cadence-core/bin/planning.test.mjs` passes;
  `node cadence-core/bin/planning.mjs detect-commands --root .` prints
  `"typecheck":"npx tsc -p tsconfig.ci.json"` on this machine, where
  `command -v tsc` prints nothing and `node_modules/.bin/tsc` exists; a fixture
  tree carrying `pyproject.toml` with `[tool.ruff]` and a `go.mod`, with neither
  tool reachable, answers `lint: null`, `source.lint: null`, exactly one warning
  naming `ruff`, and never `go vet ./...`; and the machine-independence check -
  build a directory of executable stubs named `ruff`, `mypy`, `eslint`, `tsc`
  and `go`, run `PATH="$STUBS:$PATH" node --test
  cadence-core/bin/planning.test.mjs`, then run the same command without the
  stubs, and both pass.

### Task 3: One plan-key grammar in `lib/`, with its table

- **Files:** cadence-core/bin/lib/plan-key.mjs,
  cadence-core/bin/plan-key.test.mjs, cadence-core/bin/helper-census.test.mjs
  (the `HELPERS` table)
- **Action:** Add `cadence-core/bin/lib/plan-key.mjs` exporting ONE predicate
  over a `--plan` value: the WORKER key `references/seams.md` permits, where
  `--bracket-plan` is described as "the worker key when it is not the role name",
  and which `lib/trace.mjs` describes as "a plan number on either execute path, a
  role name for a role-dispatched worker". It ACCEPTS a plan-number spelling and
  a non-numeric worker key such as `1-fix` or `1-cut-b`. It REFUSES: a
  non-string, because `parseArgs` gives a valueless `--plan` the boolean `true`
  and `Number(true)` is 1 - the VAL-01 rail the existing `requireInt` call was
  standing for, and the one existing risk-check refusal test that must stay
  green; an empty or whitespace-only value; a value carrying leading or trailing
  whitespace; and a value carrying a NUL or a newline. NUL is not a nicety:
  `cmdRiskCheckStatus`'s `rowKey` joins the correlation id and the plan with a
  NUL separator, so a key carrying one can be spelled to collide with another
  row's identity. Refuse rather than normalize, and hand the caller's spelling
  back verbatim - `trace append --plan` stores the caller's string untrimmed, and
  a face that trimmed would write a record no receipt written with the untrimmed
  spelling could ever settle, which is D-01's stated cost. Shape it like
  `lib/require-int.mjs`: classify the value, never emit, callers own their own
  reason string; pure lib, no I/O, no env. `plan-key.test.mjs` is the grammar's
  stated table in the shape `lease-grammar.test.mjs` uses - one row per accepted
  and refused spelling, each carrying the reason it exists. Add a `HELPERS` row
  so a second copy of this rule reddens: D-02's point is that two copies let the
  face that enforces the question disagree with the face that reports it, which
  is the failure `lib/surface-scan.mjs`'s `answeredSurfaces` comment already
  states for the surface question. Do NOT touch `requireInt` or any other caller
  of it - `lease-check --plan` names a plan FILE on disk (`PLAN-<k>.md`) and
  stays numeric.
- **Verify:** `node --test cadence-core/bin/plan-key.test.mjs
  cadence-core/bin/helper-census.test.mjs cadence-core/bin/require-int.test.mjs`
  passes, with the table showing `1`, `2`, `1-fix` and `1-cut-b` accepted and
  boolean `true`, `''`, a whitespace-only value, a leading-space value, a
  NUL-carrying value and a newline-carrying value refused, each with its reason.

### Task 4: Both risk-check faces reach that grammar, and nothing else changes shape

- **Files:** cadence-core/bin/planning.mjs (the `--plan` guards in
  `cmdRiskCheckRun` and `cmdRiskCheckStatus` plus the two `risk-check` entries in
  the usage header), cadence-core/bin/plan-key.test.mjs
- **Action:** Replace both faces' independent `requireInt(opts.plan)` calls with
  task 3's predicate - ONE consultation each, so the seam that enforces and the
  face that reports cannot disagree (D-02). Keep each face's own `bad-args`
  reason code and reword both messages, since "--plan needs a plan number after
  it" stops being true. `cmdRiskCheckRun` records the ACCEPTED KEY as the caller
  spelled it, on the `risk_check` event and on its envelope, in place of today's
  parsed number; `planKey` already stringifies both sides of every comparison in
  `cmdRiskCheckStatus`, so a record written `1` and a bracket written `"1"` still
  join and no existing status assertion moves. Do NOT widen the trace WRITE face
  (D-03): `trace append --plan` and `route.mjs`'s `--bracket-plan` keep storing
  any non-empty string, because the live trace holds 239 role-keyed events (74
  `cad-verifier`, 73 `cad-planner`, 66 `cad-assumptions-analyzer`, 16
  `cad-reviewer`, 10 `cad-plan-checker`) that a numeric write rule would refuse,
  and the run record would stop attributing work to the worker that caused it. Do
  NOT narrow `status`'s derivation from the lifecycle brackets: D-01 rejects the
  exclusion arm recorded in `.planning/CAPTURE.md`'s phase-3 entry, because
  dropping a key the coordinator actually bracketed is fail-open on the one
  trigger that is blocking at every stakes level. One bounded exception, and it
  is the opposite of that arm: a bracketed key task 3's predicate REFUSES is not
  a legal worker key at all, so `status` cannot demand a `risk-check run` record
  for it - `run` can never write one, and the gate would be permanently
  unsatisfiable with no exit but an `override`. Such a key goes in a `malformed`
  array on the envelope, the shape `trace render` already uses
  (`planning.mjs:3466`), and NOT in `missing`. The distinction D-01 protects is
  intact: a key the predicate accepts is never dropped, and a key it refuses is
  REPORTED rather than silently excluded, which is what made the CAPTURE arm
  fail-open. Nothing in the tree mints such a key today - task 5 pins the
  continuation and fix-pass key to the plan number - so this is the guard for a
  spelling that reaches the write face D-03 leaves open. Update the two `risk-check`
  usage-header lines so `--plan` is described as the worker key rather than a
  plan number. Put the end-to-end rows in `plan-key.test.mjs` rather than in
  `risk-diff.test.mjs`, where the other risk-check seam cases live: plan 2 of
  this phase holds that file's lease, and what these rows assert is the
  GRAMMAR's reach through both faces rather than a risk verdict. They need a git
  fixture repo and a `.planning/config.json` that ANSWERS
  `review.triggers.risk_surface.surfaces`, since an unanswered project is refused
  `surfaces-unanswered` before detection runs at all.
- **Verify:** `node --test cadence-core/bin/plan-key.test.mjs
  cadence-core/bin/risk-diff.test.mjs cadence-core/bin/planning.test.mjs
  cadence-core/bin/trace.test.mjs` passes with no edit to `risk-diff.test.mjs`;
  in a fixture repo, `risk-check run --phase 3 --plan 1-fix --base <base> --head
  HEAD` answers `ok:true` and appends exactly one `risk_check` line whose `plan`
  is `1-fix`; `risk-check status --phase 3` over a trace whose `cad-executor`
  return bracket carries `1-fix` answers `ok:false` with `1-fix` in `missing`
  before the record exists, still refuses with `risk-fire-missing` once the
  record is there and its range matched, and answers `ok:true` once a `gate_pass`
  receipt carrying `--plan 1-fix --base <base> --sha <head>` is appended; and a
  test walks every row of task 3's table through BOTH faces, asserting each
  spelling is accepted by both or refused by both; and a trace whose
  `cad-executor` return bracket carries a trailing-space key `1-fix ` answers
  `ok:true` with that key in `malformed` and absent from `missing`, so the gate
  is not left unsatisfiable by a spelling `run` can never record.

### Task 5: `workflows/execute.md` states the key a continuation or fix-pass dispatch carries

- **Files:** cadence-core/workflows/execute.md (the lifecycle-bracket paragraph
  naming the plan NUMBER as the worker key / the checkpoint / partial / turn-cap
  arms of the executor-return handling / the `handle_checkpoint` step's
  re-dispatch sentence)
- **Action:** Close the omission that minted `1-fix`, `1-cut` and `1-cut-b`
  (D-12). The bracket paragraph names the plan number for the first dispatch and
  the continuation arms say "dispatch a fresh continuation" without ever naming
  the key it carries, so a coordinator dispatching a fix pass or a continuation
  coins one. State two things at the arms that dispatch again: a continuation or
  a risk-review fix pass for plan `k` is bracketed under `k` itself - it is a
  second dispatch against the SAME plan's range and its commits land inside that
  plan's `base..head` anyway - and whatever key a dispatch does carry, the
  `risk-check run --plan` record and the fire receipt's `trace append --plan`
  must be written with that SAME spelling, or the receipt joins nothing.
  `references/triage-gate.md` already carries the receipt half ("plus `--plan
  <k>` when the fire is per-plan"), so this file is where the dispatch half
  belongs. Do not write that the seam REQUIRES a numeric key: after task 4 it
  does not, and a doc that says so would re-mint the refusal from the other
  side. Prose only - no seam change in this task.
- **Verify:** `node cadence-core/bin/self-verify.mjs` passes and `node --test
  cadence-core/bin/prose-agreement.test.mjs` passes (its `risk_surface` fire-site
  row parses this file); `grep -n "worker key" cadence-core/workflows/execute.md`
  returns the bracket paragraph AND at least one line inside the continuation /
  `handle_checkpoint` arms, where today it returns the bracket paragraph only.

## Notes

- **Deviation from the CONTEXT `Plan shape` directive, recorded rather than
  taken silently.** The directive says the four requirements touch disjoint
  files and names RCH-01 as `planning.mjs` plus a new `lib/` predicate and
  RSK-03 as `planning.mjs`'s two risk-check faces plus `workflows/execute.md`.
  Those two share `cadence-core/bin/planning.mjs`, so they are one plan and not
  two; splitting them would put one file under two leases and force the phase
  onto the sequential path anyway. RSK-04 and SHP-01 remain their own plans
  (PLAN-2, PLAN-3) with no file shared with this one, so the phase still gets
  the multiple plans the directive asks for - three instead of four.
- RSK-03's end-to-end rows live in `plan-key.test.mjs` rather than beside the
  other risk-check seam cases in `risk-diff.test.mjs`, because PLAN-2 holds that
  file's lease. Stated here so the next reader knows it was a lease decision and
  not an oversight.
- AC2 is a Verify on this machine and deliberately not a committed assertion:
  CI's `node-test` jobs run with no `npm install`, so `node_modules/.bin/tsc`
  does not exist there.
