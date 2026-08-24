# Phase 2: A repo-scoped key refuses at the layer that cannot honour it - Context

Gathered: 2026-08-23
Feeds: /cad-plan 2

## Scope boundary

In: a NEW `config.schema.json` marker for repo-layer-only keys, read by
`config.mjs`'s `checkPairs` so a write at the user-global layer refuses at write
time with a hint. `checkPairs` takes the resolved target layer as a parameter,
`check` learns `--global` so the inspect face reports what the write face
refuses, and the refusal is atomic across a multi-pair `set`. The marked set is
`git.auto_close` alone today; the rule is general and reads the marker.

Out: any refusal keyed on `"src": "repo"` - that marker means "settable in
either layer" and its 33 keys include `stakes` and `granularity`, which
`workflows/config.md:124` tells the user to set globally (D-01). Any change to
the read face: a user-global `git.auto_close` still merges into the `requested`
resolution (D-05). The mirror direction - a `"src": "global"` key written to the
repo layer - which stays enforced at the merge (D-06). `validate`'s layer
scoping, which has no layer-aware arm at all (flagged below). Any new `reason`
token, per the cycle's stated exclusion.

Deferred: None.

Plan shape: one plan. Five files with no internal ordering - `config.mjs`,
`config.schema.json`, `lib/config-merge.mjs` (one export), `lib/arg-contract.mjs`
and `references/config-catalog.md`. Phase 1's three-plan split existed because a
check had to be demonstrated failing before a sweep closed it; nothing here has
that shape.

## Durable decisions

- D-01 (Marker meaning): `"src": "repo"` is NOT the layer-scope marker SCP-01
  assumed. The schema's own legend defines it as "settable in either layer",
  and its 33 keys are the ones blessed for `--global` - `stakes`, `granularity`,
  `memory.backend`, every `model.overrides.*` and every `review.triggers.*` -
  while the 42 UNMARKED keys include `git.protected_branches`, `git.base_branch`
  and `planning.commit_docs`. The split carries no repo-only signal in either
  direction. Rejected: redefining the marker to mean repo-layer-only, which
  reverses documented shipped behaviour for 33 keys, reddens
  `config.test.mjs:29-38`, and costs edits to four prose surfaces that all sit
  at exactly zero budget headroom (measured 2026-08-23:
  `references/config-catalog.md` 10452/10452, `workflows/config.md`
  15705/15705, `templates/config.json` 1344/1344,
  `skills/cad-config/SKILL.md` 1456/1456). Evidence:
  `cadence-core/config.schema.json` `_meta.note`;
  `cadence-core/references/config-catalog.md:11-13`;
  `cadence-core/workflows/config.md:124-125`.
- D-02 (The new marker): a new schema field marks repo-layer-only, and the test
  it encodes is whether a user-global value AUTHORIZES a change to a repository
  that never opted in. `git.auto_close` is the only key that passes today - its
  own `purpose` string already states the rule ("that close mutates ONE
  repository, so only that repository's own `.planning/config.json` can
  authorize it and a user-global value authorizes nothing on any host"), and
  `lib/repo-auto-close.mjs` already enforces it at LAND time, which is exactly
  the lateness #249 reports. A scan of all 78 `purpose` strings found no second
  key; the three `"src": "global"` keys already carry the mirror. The set being
  1 is the honest answer, not a thin one: the rule is general and a second key
  later is a schema edit with no code change. Rejected: adding the
  branch-identity keys (`git.integration_branch`, `git.base_branch`), which have
  sensible global defaults and no reported defect. Evidence:
  `cadence-core/config.schema.json` (`git.auto_close.purpose`),
  `cadence-core/bin/lib/repo-auto-close.mjs:6-38`.
- D-03 (Schema-read, not a hand list): the marked set is read off the schema
  object `config.mjs` already loads, not a hand-maintained module. Recorded
  against `lib/global-only-keys.mjs`'s opposite choice and its stated reasons:
  that module hand-maintains because it runs inside `git-guard.mjs`'s PreToolUse
  hook on every Bash call, and because an unsentinelled schema read would make
  `CADENCE_CONFIG_SCHEMA` a one-variable switch that un-marks every protected
  key. Neither reason reaches here - `config.mjs` is not in the hook path, it
  loads the schema at `:41-43` already, and it already gates
  `CADENCE_CONFIG_SCHEMA` on the `CADENCE_TEST_SEAM` sentinel at `:33-40`. This
  is what meets the roadmap's SC4 first arm with no second self-verify check.
  Evidence: `cadence-core/bin/lib/global-only-keys.mjs:17-24`;
  `cadence-core/bin/config.mjs:33-43,181`.
- D-04 (The refusal reads the resolved file, not the flag): `optFile` returns
  `{file, global}` where `--global` sets `file = GLOBAL_CONFIG`, but
  `--file <that same path>` returns `global:false` and writes straight through.
  A flag-only rule leaves the hole open. The deleted precedent already handled
  both arms - `git show 878956ea` added
  `targetsGlobal = create || (Boolean(GLOBAL_CONFIG) && file === GLOBAL_CONFIG)`,
  and `git show 8063832d` hardened it with a realpath fallback because
  `--file <global-dir>/./config.json` wrote straight through the refusal.
  Evidence: `cadence-core/bin/config.mjs:345-391,409`.
- D-05 (Read face untouched): a user-global `git.auto_close` still merges and is
  still honoured for the `requested` resolution; only new WRITES refuse. The key
  deliberately carries two resolutions that are allowed to disagree - `requested`
  is the merged value that decides whether `/cad-land` skips the publish ask and
  that the land gate reads, and `authorized` is the repo-layer-only read that
  gates the mutation. Aligning them onto the repo layer broke the pairing once
  and was reverted (`0b1c322`). Stripping at the merge as well would re-break it.
  Evidence: `cadence-core/bin/lib/repo-auto-close.mjs:6-38`;
  `cadence-core/bin/lib/config-merge.mjs:219-224` (strips global-only keys only,
  and only from the repo layer).
- D-06 (Mirror direction stays at the merge): a `"src": "global"` key written
  into the repo layer keeps being enforced at the merge, not at the write, per
  v3.5.1's D-03. The asymmetry is a recorded position, not an oversight: a
  repo-layer write refusal would need an exception for Cadence's own scaffold,
  since `templates/config.json` ships all three global-only keys into every
  project it creates. Evidence:
  `cadence-core/bin/lib/global-only-keys.mjs:9-15,170-176`;
  `cadence-core/templates/config.json`.

## Decisions

- D-07 (Identity helper): export `layerIdentity` from `lib/config-merge.mjs`
  rather than restating the realpath fallback in `config.mjs`. It answers the
  same "one file, both layers" question at `:184-188` and is not currently
  exported; the identical logic was spelled `fsIdentity` inside `config.mjs`
  before `8063832d` deleted it, and a second copy would drift from the merge's.
  Evidence: `cadence-core/bin/lib/config-merge.mjs:108-113,184-188`.
- D-08 (checkPairs takes the layer; `check` learns `--global`): the roadmap's
  SC3 puts the check inside `checkPairs`, which takes no layer argument today
  and is called from `check` with raw `rest`. `check --global` is not a declared
  row, so it answers `not a key=value pair` today. Companion edits the widening
  obliges: the `lib/arg-contract.mjs` row, the CONTRACTS table, and
  `config.test.mjs:532-547`'s ARG-06 subcommand list, which iterates
  `['validate','set','get']` and asserts each declares `--global` with the
  identical grammar. Evidence: `cadence-core/bin/config.mjs:161,404`;
  `cadence-core/bin/lib/arg-contract.mjs:917,132-136`.
- D-09 (Refusal shape): the scope failure is a per-pair entry in the existing
  `reason:"invalid"` detail array, not a new reason token - the cycle's stated
  exclusion, and the deleted precedent merged both lists into one refusal
  (`if (errors.length || scoped.length) fail('invalid', [...errors, ...scoped])`,
  `git show 878956ea`). Evidence: `cadence-core/bin/config.mjs:232-235`;
  `.planning/REQUIREMENTS.md` (out-of-scope note).
- D-10 (Where the remediation lives): the per-pair `error` string carries the
  next step ("set it with `--file <repo config>` instead"), and the envelope
  keeps `set`'s existing `hint`. This meets phase 1's bar without a new hint
  site. Evidence: `cadence-core/bin/config.mjs:50-53,234-235`;
  `cadence-core/bin/self-verify.mjs:181` (check 22).
- D-11 (Ordering): the scope check runs AFTER `checkValue`, so a pair that is
  both out-of-scope and type-invalid reports the type. No shipped test sets
  `git.auto_close` at all, so nothing is being rescued here - it is the ordering
  the retired-key check's placement argues for in reverse
  (`config.mjs:168-172`). Evidence: `cadence-core/bin/config.mjs:168-172`;
  `cadence-core/bin/config.test.mjs` (no `git.auto_close` case).
- D-12 (Prose and budgets): the new marker is documented in
  `config.schema.json`'s `_meta.note`, which carries no weight-budget row and is
  free to grow, plus one legend clause and one row marker in
  `references/config-catalog.md`, whose budget row is re-pinned in the same
  commit. Self-verify treats a budget as a ceiling (`bytes > budget`), so the
  re-pin is the sanctioned move rather than a silenced check. Measured
  2026-08-23: `config-catalog.md` is at 10452/10452, zero headroom. Evidence:
  `cadence-core/bin/weight-budgets.json`;
  `cadence-core/bin/self-verify.mjs:733-759`.

## Acceptance criteria

- [ ] AC1: `config.mjs set git.auto_close=true --global` returns `ok:false` with
      `reason:"invalid"`, a detail entry naming `git.auto_close` and the layer,
      and a non-empty `hint`. The same pair with no `--global` returns `ok:true`
      and the value appears in `.planning/config.json`.
- [ ] AC2: `config.mjs set git.auto_close=true --file $CADENCE_GLOBAL_CONFIG`
      also returns `ok:false`, and a path spelled `<global-dir>/./config.json`
      refuses identically - the rule reads the resolved target file, not the flag.
- [ ] AC3: `config.mjs check --global git.auto_close=true` returns the same scope
      error `set` refuses on, and `config.mjs check --global stakes=critical`
      returns `ok:true`.
- [ ] AC4: `config.mjs set stakes=critical --global` returns `ok:true` and the
      file holds the value - no `"src": "repo"` key is refused - and
      `cadence-core/bin/config.test.mjs:29-38` passes unchanged.
- [ ] AC5: A committed test derives the refused set from the schema marker rather
      than a literal list: with a substituted schema fixture marking a second key,
      that key refuses and no line of the rule changed.
- [ ] AC6: `config.mjs set git.auto_close=true stakes=critical --global` refuses
      and writes nothing - the target file is byte-identical before and after.
- [ ] AC7: `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true`
      with `problems: []`, and `node cadence-core/bin/test.mjs` reports 0
      failures.

Every global-layer arm points `CADENCE_GLOBAL_CONFIG` at a temp file, so
verifying never writes to the user's real `~/.claude/cadence/config.json`.

## Flagged assumptions

- `validate --global` will continue to bless a file that `set --global` refuses.
  `validate` has no layer-scoped arm at all and reaches `checkValue` by its own
  path rather than through `checkPairs`, so an SC3-shaped fix does not reach it -
  Likely; if wrong, nothing breaks, but two faces keep disagreeing about the same
  bytes. Recorded at `.planning/CAPTURE.md:528`, measured at `27d9a86` against
  the earlier `risk.override.auth` implementation; explicitly left out of this
  phase.
- D-11's ordering is unforced by any shipped test today, since no test sets
  `git.auto_close` - Likely; if wrong, a future marked key that is also
  type-invalid reports the layer where a reader expected the type, and the
  ordering has to be revisited with a test that actually pins it.
- D-10's placement clears self-verify check 22 by the letter (the envelope
  carries a `hint` key) as well as its intent (the per-pair `error` names the
  action) - Likely; if wrong, the generic `set` hint says nothing about layers
  and the refusal passes the check while failing the phase-1 bar it was written
  to enforce.
