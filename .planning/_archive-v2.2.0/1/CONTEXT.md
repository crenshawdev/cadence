# Phase 1: The read face under everything - Context

Gathered: 2026-07-30
Feeds: /cad-plan 1

## Scope boundary

In: the `mergeLayers` READ-face identity defect (`CAPTURE.md:46`) - the shared
root - plus the seven phase-6-deferred config-reach and risk-waiver items
(`CAPTURE.md:164,165,166,168,169,170,171`), and a cross-seam proof that every
consuming seam reads what `config.mjs get` reports.

Out: the write face v2.0.0's task 7 already fixed - its behaviour is unchanged
and pinned by its existing tests. Phase 6's `e09a0e5` narrowing of `route.mjs`
to `layers.repo` for `risk.override.*` is preserved, not undone: it is what
created these items. No change to `deepMerge`'s value semantics. The other five
v2.2.0 requirements (TOK-02, REL-03, DOC-01, RNG-02, HST-02) are other phases.

Deferred: `CAPTURE.md:167` (the self-verify URL mask covering `https?://` only,
so `git@host:path` and `ssh://` clone URLs tokenize as `git.*` config keys) -
it is a phase-6 sibling but belongs to check 1 (`config-keys`), not check 9
(`config-reach`) or either waiver read face. Left for a later phase rather than
padding this roster.

Plan shape: multiple plans, same phase - the root fix (AC1-AC3), the
config-reach check (AC4-AC6), and the cross-seam proof (AC7) are separable
bodies of work sharing one goal.

## Durable decisions

- D-01 (get semantics): `config.mjs get` keeps returning the MERGED value and
  adds a warning naming the repo-scoped key that resolved from the global
  layer. The divergence between the two read faces closes by making it
  audible, not by changing what `get` returns - the merged-config contract at
  `cadence-core/bin/config.mjs:12-14` ("the only correct way for a workflow to
  read config") survives. `DESIGN.md:443-456`'s "the read face is deliberately
  unchanged" marker is AMENDED in this phase rather than left contradicted.
  Rejected: returning the repo-layer value for repo-scoped keys, which would
  make every workflow batching keys through `get` read a differently-scoped
  answer per key with no way to tell which. Evidence:
  `cadence-core/bin/config.mjs:12-14,269`, `DESIGN.md:443-456`,
  `.planning/CAPTURE.md:164`, `cadence-core/workflows/config.md:43-47`.
- D-02 (collapse target): when one file resolves as BOTH layers, the identity
  fix collapses it to the REPO layer - `layers.repo` populated,
  `layers.global` null. This preserves today's live behaviour, where a waiver
  in such a file IS honoured through `layers.repo`, and closes the spurious
  `IGNORED ... waives nothing here` warning as a consequence. Rejected:
  resolving toward `global`, which silently REVOKES a waiver that works today
  for anyone pointing `CADENCE_GLOBAL_CONFIG` at their repo config - a
  behaviour change nothing in the roadmap authorizes. Evidence:
  `cadence-core/bin/route.mjs:124`, `cadence-core/bin/route.test.mjs:902`,
  `cadence-core/bin/lib/config-merge.mjs:102-133`.
- D-03 (roster): CFG-02's "seven" is exactly `.planning/CAPTURE.md:164, 165,
  166, 168, 169, 170, 171`. `CAPTURE.md:167` is excluded (see Deferred). The
  count is fixed here so criterion AC6's SUMMARY roster has something to be
  checked against rather than being sized to whatever gets closed. Evidence:
  `.planning/CAPTURE.md:164-171`, `cadence-core/bin/self-verify.mjs:335,820`.

## Decisions

- D-04 (root vs leaves): the `mergeLayers` read-face identity defect is the
  phase-2 item at `CAPTURE.md:46`, NOT one of the seven - CFG-02 names it
  separately as "the shared root". Both arms are live at HEAD: a symlink or
  relative-vs-absolute spelling of one broken file yields TWO parse warnings,
  and one shared file reports `source:"global+repo"`, naming a repo layer the
  user does not have. Evidence: `.planning/CAPTURE.md:46`,
  `cadence-core/bin/lib/config-merge.mjs:102-133`,
  `.planning/REQUIREMENTS.md:29`.
- D-05 (what the fix changes): collapsing two identical layer paths changes
  PROVENANCE and WARNINGS only, never a merged value - `deepMerge(x, x)` is
  already a no-op for objects, arrays and scalars. AC1 is therefore pinned on
  `source`, `layers` and `warnings`, never on a corrupted value; a
  "merged twice" value test would pass against the current read face and fail
  AC1's own "fails against HEAD" clause. Evidence:
  `cadence-core/bin/lib/config-merge.mjs:64-71`.
- D-06 (`--global`): `config.mjs get --global` makes one file BOTH layers by
  construction, so the identity fix changes its reported `source` from
  `global+repo` to a single layer on every invocation. Evidence:
  `cadence-core/bin/config.mjs:289` feeding `:265`;
  `cadence-core/bin/config.test.mjs:290` is the only assertion on the literal
  string.
- D-07 (test shape): `GLOBAL_CONFIG` is a module-load `const` off
  `process.env`, so any test varying the global layer runs the seam as a
  SUBPROCESS with `CADENCE_GLOBAL_CONFIG` set - the pattern every existing
  config/route/git test already uses. There is no `config-merge.test.mjs`; new
  tests attach to `config.test.mjs` / `route.test.mjs` or a new file. An
  in-process unit test would read the developer's real
  `~/.claude/cadence/config.json` and make the suite non-hermetic. Evidence:
  `cadence-core/bin/lib/config-merge.mjs:26`,
  `cadence-core/bin/config.test.mjs:17-24`,
  `cadence-core/bin/route.test.mjs:45-56`,
  `cadence-core/bin/git-guard.test.mjs:28-32`.
- D-08 (review-provider): `review-provider.mjs` is driven as a SUBPROCESS with
  `cwd` set to the fixture root; the seam gains no `--dir`/`--file` flag. It
  reads a CWD-relative `.planning/config.json` and caches per process, and its
  test file never sets `CADENCE_GLOBAL_CONFIG`, so its config path is exercised
  by nothing today. Rejected: adding a `--dir` flag to match the four
  git-adjacent seams - a shape change this phase does not need. Evidence:
  `cadence-core/bin/review-provider.mjs:204-236`,
  `cadence-core/bin/review-provider.test.mjs`.
- D-09 (criterion 3 shape): no single config key is read by all seven seams, so
  AC7 means "for each seam, one key that seam actually reads, asserted equal to
  `config.mjs get` of that key" - not one shared key, which would be vacuous
  for six of the seven. The test must ALSO encode two deliberate narrowings as
  expected rather than asserting blanket equality: `git-publish.mjs:58-61`
  reads `git.auto_close` from the repo layer alone, and `route.mjs:124` reads
  `risk.override.*` from the repo layer alone. Evidence:
  `cadence-core/bin/git-guard.mjs:106-123`,
  `cadence-core/bin/git-branch.mjs:41-46`,
  `cadence-core/bin/land-cleanup.mjs:71-94`,
  `cadence-core/bin/git-publish.mjs:55-72`,
  `cadence-core/bin/route.mjs:97-131`, `cadence-core/bin/planning.mjs:1233`,
  `cadence-core/bin/review-provider.mjs:209,231`.
- D-10 (reach vocabulary): the reach phrase the eight `risk.override.*` rows
  adopt is added VERBATIM to all eight `purpose` strings in
  `config.schema.json`, and `reachIssues` runs the purpose test on a narrowed
  row that the parse currently short-circuits at `reach === UNIVERSAL`.
  Evidence: `cadence-core/bin/lib/config-reach.mjs:135-141`,
  `cadence-core/references/config-reach.md:44-51`,
  `cadence-core/config.schema.json:19-26`.
- D-11 (budgets): `cadence-core/references/config-reach.md` carries no byte
  budget, so reach-table edits cost no regeneration. `cadence-core/workflows/
  config.md` is budgeted at exactly its current size (18168/18168, zero
  headroom), so ANY prose edit there requires regenerating
  `weight-budgets.json` in the same commit or AC8 fails. Evidence:
  `cadence-core/bin/weight-budgets.json`.
- D-12 (stale prose): `references/config-reach.md:47-51` ("Four phrases are in
  use today") is already false against the fifth phrase at `:125`, and a sixth
  lands here. It is corrected in this phase because it sits in the exact lines
  this phase edits - left alone, `/cad-docs-verify` reports it as this phase's
  drift. Evidence: `cadence-core/references/config-reach.md:47-51,125`,
  `.planning/CAPTURE.md:181`.
- D-13 (`src` is not a generic rule): `src: "repo"` in the schema cannot be
  read as "this key is honoured from the repo layer only" - 41 of 73 keys carry
  it, including `stakes`, whose global-layer inheritance is pinned by an
  existing test. A generic `src`-driven narrowing breaks global-layer
  `stakes`/`granularity` inheritance and fails `route.test.mjs` outright.
  Evidence: `cadence-core/config.schema.json:7-8`,
  `cadence-core/bin/route.test.mjs:922-931`,
  `cadence-core/bin/config.mjs:196-197`.

## Acceptance criteria

- [ ] AC1: Two layer paths resolving to the SAME file (identical path, a
      symlink, or a relative-vs-absolute spelling) merge once: `config.mjs get`
      reports a single layer in `source` rather than `global+repo`, and a
      broken such file produces exactly ONE parse warning instead of two. The
      test asserting this fails against HEAD.
- [ ] AC2: With a `risk.override.<surface>` present only in the global layer,
      `config.mjs get` returns the merged value AND a warning naming that key
      as repo-scoped, while `route.mjs resolve` continues to ignore it - both
      read faces now report the same situation.
- [ ] AC3: With `CADENCE_GLOBAL_CONFIG` pointed at the repo config, the waiver
      is honoured and `route.mjs resolve` emits NO `IGNORED ... waives nothing
      here` warning.
- [ ] AC4: `node cadence-core/bin/config.mjs set stakes=solo --file` (the
      flag's value missing) returns a named diagnostic rather than
      `{"ok":false,"reason":"internal"}` carrying a Node type error.
- [ ] AC5: A duplicate reach row emits an issue rather than being silently
      dropped, and reach cells `Universal` and `universal.` normalize rather
      than emitting `unstated-reach`.
- [ ] AC6: The eight `risk.override.*` reach rows read the narrowed phrase,
      all eight `purpose` strings in `config.schema.json` carry it verbatim,
      `node cadence-core/bin/self-verify.mjs` stays `ok:true`, and the SUMMARY
      names each of the seven roster items (D-03) individually with the test
      that pins it - a count is not evidence.
- [ ] AC7: For each of the seven consuming seams (`git-guard`, `git-branch`,
      `land-cleanup`, `git-publish`, `route`, `planning`, `review-provider`) a
      test reads one key that seam actually reads and asserts agreement with
      `config.mjs get` of that key, with `git-publish`'s and `route.mjs`'s
      repo-layer narrowings encoded as expected rather than as equality.
- [ ] AC8: `node --test cadence-core/bin/*.test.mjs` and `npx tsc -p
      tsconfig.ci.json` both exit 0, and `node cadence-core/bin/self-verify.mjs`
      reports `ok:true` with no budget overrun on any surface this phase edits.

## Flagged assumptions

- `config.mjs get`'s warning channel already exists (`retiredKeysIn(config)`
  threaded into the envelope at `config.mjs:269`), so D-01 needs no new
  mechanism - Confident; if wrong, D-01 costs an envelope change that ripples
  to every `get` caller.
- The user-visible damage D-01 repairs is narrower than `CAPTURE.md:164`
  states: that capture claims `/cad-config`'s menu is driven off `get`, but
  `cadence-core/workflows/config.md:43-47` explicitly instructs the menu NOT to
  preselect off `get` - Likely; if wrong in the other direction the menu is
  also showing a waiver that waives nothing, and D-01's warning has a second
  consumer to reach.
- Whether closing D-02's collapse also silences the `route.test.mjs:902` case
  ("both layers naming it", which pins ONE warning for two DIFFERENT files) is
  untested - Unclear; if the two cases share a code path, that test moves and
  the plan must say so rather than deleting it.
