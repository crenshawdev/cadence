# Phase 4: The computed floor - Context

Gathered: 2026-07-29
Feeds: /cad-plan 4

## Scope boundary

In: a `surfaces` block in `route-table.json` (each row `{patterns, floor}`,
translating the eight prose risk surfaces into declared data); a deterministic
path match over a phase's declared PLAN `files:` frontmatter; a `--phase N`
input on `route.mjs resolve` with a STATE-cursor fallback; the floor applied as
`max(baseline, floor)` over the stakes order; per-surface `risk.override.<s>`
config keys validated at the write face; two self-verify walks over the surface
table and its schema keys; the phase-3 gate-enum hole closed at
`route.mjs:181-183`; and the CONTRACTS, test, prose and budget lockstep those
edits force.
Out: replacing the existing commit-time model-judgment detection inside
`cad-executor` (it stays; two detectors coexist after this phase); any change to
phase 3's D-04 config-wins gate precedence; acceptance-criteria ids (phase 5);
the remaining silent config drops (phase 6); the phase-3 open items listed under
Flagged assumptions below.
Deferred: None.
Plan shape: multiple plans, same phase - /cad-plan decides the split. The gate
fix (AC6) is independent of the floor and can stand alone; every floor arm stays
red until the surfaces table and the `--phase` input land, so that side is
ordered even though it divides.

## Durable decisions

- D-01 (Detection): Phase 4 CREATES the detection moment - a deterministic path
  match in a seam over the phase's declared PLAN `files:` frontmatter, with the
  eight surfaces becoming a `surfaces` block in `cadence-core/route-table.json`
  beside the grids it feeds. It does not reuse the existing detection. Evidence:
  today's `risk_surface` detection is model judgment against a prose list run at
  commit time on an already-staged diff, and its only output is a checkpoint
  string - `skills/cad-executor-contract/SKILL.md:39-45`,
  `cadence-core/references/review-triggers.md:163-195`,
  `cadence-core/workflows/execute.md:160-163`, `METHOD.md:273`; a grep for
  `untrusted|authz|migrations` across every `.mjs` and `.json` in the tree
  returns nothing, so no machine detector exists anywhere.
  `cadence-core/bin/lib/planning-files.mjs:1299` (`parsePlanFiles`) already
  machine-reads `files:` for `plan-overlap`, and
  `cadence-core/bin/lib/route-cells.mjs:1-14` states the precedent that a
  checked vocabulary comes from declared data rather than from parsing
  `review-triggers.md`, which has no stated grammar. Keeping model judgment and
  recording its verdict into a phase artifact was rejected: the floor would be
  exactly as reliable as a prose step nothing enforces, which is the
  resolved-then-dropped shape this milestone exists to close. If wrong: the
  floor applies only after the wrong-rung executor has already written the code,
  which inverts criterion 1.
- D-02 (Floor): A detected surface pins the stakes LEVEL, not a separate rung
  ladder - all four knobs then come from the `critical` row through the phase-3
  cell grid, one mechanism. Evidence:
  `cadence-core/references/review-triggers.md:170-173` says the detection list
  "is also the operative definition of the `critical` stakes value ... nothing
  here reads the configured stakes level, and nothing here raises it";
  `.planning/phases/2/CONTEXT.md` D-01 names the same list; and
  `.planning/phases/3/CONTEXT.md:197-199` records that `risk_surface` was left
  `blocking` at every level precisely because phase 4 builds its floor on this
  signal. Flooring the effort rung alone was rejected - a `solo` phase touching
  auth would still get sonnet, an `off` diff gate and verify off, so the risk
  signal would move one knob of four. Per-knob minimums were rejected because
  they decouple the four knobs phase 3 deliberately joined into one cell. If
  wrong: a second escalation mechanism lands beside the cell grid one phase
  after it shipped.
- D-03 (Floor): The floor is applied as `max(baseline, floor)` over the stakes
  order `[solo, shipped, critical]`, and every shipped `surfaces` row carries
  `floor: "critical"`. Evidence: ROADMAP criterion 3 ("Raising above a detected
  floor requires no override at all") is vacuous if the floor is hardcoded to
  the top rung, since nothing sits above `critical`; an order-based max makes
  the raise-never-caps behaviour real machinery testable against a sub-top floor
  row, while the shipped table still says `critical` for all eight surfaces, per
  D-02's evidence. Hardcoding the assignment was rejected: it leaves criterion 3
  with no observable behaviour to check. If wrong: the phase ships a comparison
  no shipped row exercises.
- D-04 (Carrier): `route.mjs resolve` gains `--phase N` and reads the phase's
  plan files itself; with the flag absent it falls back to `.planning/STATE.md`'s
  cursor phase, and the planning root is derived from `--file`'s dirname.
  Evidence: `cadence-core/bin/route.mjs:222-236` (`parseArgs` accepts only
  `--role`, `--attempt`, `--file`) and `:59-71` (config layers are the resolver's
  only disk read today); `cadence-core/bin/lib/planning-files.mjs:26`
  (`parseCursor`); `cadence-core/bin/self-verify.mjs:100-104` is a flag
  whitelist, so `--phase` needs a CONTRACTS entry or every documented invocation
  becomes an `unknown-flag` problem. A `--surface <name>` flag the orchestrator
  passes was rejected: every call site that forgot it would resolve at the
  baseline with nothing said - a floor that fails open silently - and
  `fire(trigger)`'s own step-1 resolve
  (`cadence-core/references/review-triggers.md:22`) is one of those sites. A
  `risk.surfaces` config key was rejected because per-phase state in a committed
  project-scope file is stale the moment the next phase starts. If wrong: the
  resolver carries a `.planning/` read it has never had, on a path called once
  per dispatch.
- D-05 (Override): The waiver is a persisted `risk.override.<surface>` config
  key, one per surface, validated at the write face against the surface
  vocabulary. The floor is waived PER SURFACE - it drops to the baseline only
  when every detected surface is named, and `reason` carries the names.
  Evidence: `cadence-core/config.schema.json` already enumerates
  `model.overrides.<role>` as six explicit closed-enum keys rather than a
  pattern, and `cadence-core/bin/config.mjs:47-69,113-136` is the write-face
  enum-and-retired-key refusal precedent; `cadence-core/bin/route.mjs:197-211`
  shows the matching resolve-side shape (a pin wins, is named in `reason`, an
  unknown alias warns rather than redirecting);
  `cadence-core/bin/lib/retired-keys.mjs:1-18` carries the doctrine that a value
  refused at `set` and ignored at `resolve` is the same defect as no diagnostic.
  An ephemeral `--override-surface` flag was rejected: it is the orchestrator
  typing the waiver rather than the user, and nothing records that a floor was
  ever waived. Recording the waiver in the phase artifact was rejected for
  having no write-face validation. If wrong: a stale waiver outlives the phase
  that justified it, and nothing reaps it.
- D-06 (Scope): The gate axis stays exactly as phase 3 left it - D-04's
  config-wins precedence is untouched - and this phase closes only the missing
  enum check at `cadence-core/bin/route.mjs:181-183`, giving a bad gate the same
  treatment `route.mjs:199` already gives a bad model alias. Evidence:
  `.planning/CAPTURE.md` (phase 3, confirmed) records that
  `{"stakes":"critical","review":{"triggers":{"risk_surface":{"gate":"blockign"}}}}`
  resolves `ok:true` carrying `"blockign"`, so a one-character typo silently
  replaces `critical`'s deliberately-blocking gate on the very axis this phase is
  named after. Flooring the detected trigger's gate was rejected: it reverses
  part of `.planning/phases/3/CONTEXT.md` D-04 one phase after it shipped and
  removes the documented way to turn that review off. Leaving both alone was
  rejected because the hole is a silent lowering of the risk signal the floor
  depends on. If wrong: the floor's own gate axis stays typo-disableable for
  another two phases.

## Decisions

- D-07 (Carrier): No recording step - the surface match is computed live at
  resolve time, and nothing writes a `surfaces:` field into any artifact.
  Evidence: a recorded set is a second write site with its own grammar that goes
  stale the moment a plan's `files:` list changes, and the match is a pure
  function of two files already on disk.
- D-08 (Carrier): A phase with no PLAN file, an unresolvable phase number, or an
  unreadable PLAN frontmatter fails OPEN to the baseline bundle with `ok:true`,
  and the unreadable-but-present case adds one warning naming the file. Evidence:
  `cadence-core/bin/route.mjs:14-15` and
  `cadence-core/references/seams.md:110-112` - `{ok:false}` makes the caller
  dispatch the base agent at the session default with no model override, so a
  hard refusal would route a risky phase LOWER than its baseline. A missing PLAN
  is also the normal pre-plan state under D-09, so flooring it would break
  criterion 4 outright.
- D-09 (Floor start): The floor starts once a PLAN exists.
  `cad-assumptions-analyzer` and `cad-planner` dispatches route at the project
  baseline; execute, review and verify dispatches carry the floor. Evidence:
  `cadence-core/templates/PLAN.md:1-6` makes `files:` a required frontmatter key,
  so there is no path list before `/cad-plan` runs. Detecting at `/cad-context`
  instead was rejected: `cadence-core/workflows/context.md:16` calls CONTEXT.md
  an OPTIONAL phase artifact whose guardrails forbid retroactive creation, so any
  phase that skips it would be silently unfloored - a second fail-open path.
- D-10 (Verification): The new input and the new table land with the existing
  enforcement shape - a `route.mjs` CONTRACTS entry naming `--phase`, hand-written
  test rows (never expectations derived from the table under test), and a
  self-verify walk over the surface vocabulary in BOTH directions. Evidence:
  `cadence-core/bin/self-verify.mjs:55-115` and `:320-334`;
  `cadence-core/bin/route.test.mjs:72-79` ("HAND-WRITTEN DATA ... a fixture that
  derives its expectations from its subject cannot fail");
  `.planning/phases/3/SUMMARY.md` records that anything outside `roles[]` and the
  stakes enum is checked by nothing, which is the blind spot this walk must not
  repeat for `surfaces`.

## Acceptance criteria

- [ ] AC1: With `stakes: "solo"` in every config layer,
      `node cadence-core/bin/route.mjs resolve --role <r> --phase <N>` against a
      phase whose PLAN `files:` matches a `surfaces` row returns
      `stakes: "critical"` and that row's `model`, `effort`, `review` and
      `verify`, and the `reason` array carries an entry naming the matched
      surface and the path that matched it; the same resolve with no `--phase`
      flag, against a STATE cursor pointing at that phase, returns the identical
      bundle
- [ ] AC2: The floor is absent in every non-detecting state and never blocks - a
      phase whose PLAN `files:` match no surface row, a phase with no PLAN file,
      and a resolve with neither `--phase` nor a cursor all return the baseline
      level's bundle with `ok:true` and no floor entry in `reason`; a PLAN
      present but unreadable returns the same baseline bundle plus one warning
      naming the file
- [ ] AC3: With `stakes: "critical"` configured and a detected surface whose row
      floors below critical, resolve returns `critical` with no override set and
      no refusal - the floor raises and never caps
- [ ] AC4: With `stakes: "solo"` and a phase detecting two surfaces, setting
      `risk.override.<first>` alone still resolves `critical`; setting both
      resolves `solo` with the `reason` array naming each waived surface; and
      `node cadence-core/bin/config.mjs set risk.override.<not-a-surface> true`
      is refused with a message listing the accepted surface names
- [ ] AC5: `node cadence-core/bin/self-verify.mjs` reports `ok:false` naming the
      offending row for each of four classes - a surface whose `floor` is not a
      stakes level, a surface row with an empty pattern list, a surface in
      `route-table.json` with no `risk.override.<surface>` schema key, and a
      `risk.override.<surface>` schema key naming no surface row
- [ ] AC6: A config `review.triggers.<t>.gate` outside
      `off|advisory|blocking|adjudicated`, or not a string, no longer reaches the
      bundle - `resolve` returns the LEVEL's gate for that trigger plus one
      warning naming the rejected value, verified with `{"gate":"blockign"}` on
      `risk_surface` at `critical`, which today resolves `ok:true` carrying
      `"blockign"`
- [ ] AC7: `node --test cadence-core/bin/*.test.mjs` exits 0,
      `npx tsc -p tsconfig.ci.json` exits 0, and
      `node cadence-core/bin/self-verify.mjs` reports `ok:true` with `--phase`
      accepted in the `route.mjs` CONTRACTS entry, no budget overage and no
      `unknown-config-key`

## Flagged assumptions

- The eight surface names and their path patterns are a first pass translated
  out of `cadence-core/references/review-triggers.md:166-168` - Likely; a path
  match is a coarser signal than the diff today's detection reads, so it will
  miss risk living inside an innocuous path and fire on a benign file under a
  risky one. If wrong the patterns move in a later minor, which is cheap because
  they are data.
- `review-triggers.md:175-195`'s two pre-filters (gitignored destructive target,
  placeholder-shaped secret) are diff-CONTENT judgments a path match cannot make,
  and the floor has no diff in hand at plan time - Unclear whether the floor
  should carry any equivalent. Left to the planner: a phase whose PLAN lists
  `*.env.example` floors to critical with no way to drop the match short of a
  named override.
- The existing commit-time model-judgment detection is NOT replaced by this
  phase - Confident; two detectors coexist afterwards (a path-match floor at
  dispatch, model judgment at commit). Consolidating them is in no criterion
  here.
- Four phase-3 open items stay open and outside this scope - Confident:
  `route.mjs:115` indexes `TABLE.cells[cfg.stakes]` with the raw config string,
  so a level the stakes enum does not define still resolves `ok:true`; `roles[]`
  is a blind spot for the whole cell walk; the unmapped-rung fail-open at
  `route.mjs:135` reports a rung it could not reach; and self-verify proves a
  rung file exists but not that its frontmatter `effort` equals its rung.
- The global config layer on this machine sets
  `review.triggers.phase_diff.gate`, so every `route.mjs resolve` run on this
  tree emits one gate-disagreement warning - Confident; observed this session.
  Test fixtures must be hermetic (`--file` at a temp path) or AC2's
  "no warning" clauses will read as failures against a correct tree.
