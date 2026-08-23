# Phase 1: Every refusal names its next step - Context

Gathered: 2026-08-23
Feeds: /cad-plan 1

## Scope boundary

In: a plain-language hint at every in-scope refusal site under
`cadence-core/bin/`, across BOTH refusal spellings - the `reason:` object
literal and the positional `fail('token', detail, hint)` call - plus a new
numbered `self-verify.mjs` check that makes a hintless in-scope refusal a
`problems[]` entry. Three 2-argument `fail` wrappers are widened to three
arguments so their sites can carry a hint at all.

Out: any change to a `reason` token string or to a positional first argument
of `fail(...)` - tests and callers match them, so a rename is a breaking
change dressed as a wording fix. Any behavior change beyond the added field
and the added check. Any edit under `cadence-core/workflows/`,
`cadence-core/references/` or the agent contracts. The static registry rows
in `lib/bulk-output.mjs`, `lib/text-transport.mjs` and `lib/release-decision.mjs`
(43 sites of classification data self-verify reads, not envelopes it emits).
`git-guard.mjs`. Sub-envelope returns a caller re-wraps. The `usage` and
`internal` token families. The ~30 sites whose reason string already names an
action. `config.mjs set` layer-scope validation, which is phase 2.

Deferred: None.

Plan shape: multiple plans, same phase. The natural split is the check plus
the three wrapper widenings as one unit of design work, and the hint sweep as
bulk text the check itself grades. Ordering matters for AC1: the check must be
demonstrated failing against the tree before the sweep closes it.

## Durable decisions

- D-01 (Population): the in-scope set spans both refusal spellings, not the
  `reason:` object key alone. The 186/13 measurement counted one spelling; a
  bracket-aware parse over comment-stripped source finds 196 positional
  `fail('token', …)` sites, 13 hinted and 183 not, with only 5 tokens
  appearing in both forms. Keyed on `reason:` alone the check goes green while
  `planning.mjs`'s 156 hintless `fail()` refusals - the largest user-facing
  refusal surface in the plugin - stay untouched. The 186/13 figures stand as
  a provenance note, never as the denominator. Evidence:
  `cadence-core/bin/planning.mjs:247` (the one already-3-arg wrapper),
  `cadence-core/bin/review-provider.mjs` (17 sites), `cadence-core/bin/config.mjs`
  (9), `cadence-core/bin/route.mjs` (1).
- D-02 (Scope rule): a site is in scope when it EMITS an `ok:false` envelope on
  stdout - `emit`/`out`/`fail` - not when it contains a field named `reason`.
  The test is whether a user reads the token. Rejected: a kebab-shape regex
  (only 85 of the 158 in-code `reason:` sites pass it, it admits non-envelope
  returns and misses interpolated tokens) and a per-file allowlist (drifts
  silently as new seams ship, which is the failure HNT-02 exists to stop).
  Evidence: `cadence-core/bin/lib/seam-io.mjs:25`, the single `emit`, whose
  header already sanctions per-script wrappers with hint fields.
- D-03 (Excluded tokens): `usage` and `internal` are excluded by token name and
  the exclusion is recorded in the check's register. `usage` already carries the
  next step in its sibling `detail` - the roadmap's own "explanation in a
  sibling field" case; `internal` has no user action beyond filing a bug, and
  demanding a hint there is how a check gets silenced rather than satisfied.
  Evidence: `cadence-core/bin/worktree-base.mjs:167`
  (`detail: 'subcommand: resolve [--dir <path>]'`),
  `cadence-core/bin/route.mjs:1535`, `cadence-core/bin/issue-check.mjs:333`;
  ~13 `internal` arms including `cadence-core/bin/config.mjs:398`,
  `cadence-core/bin/why.mjs:415`, `cadence-core/bin/self-verify.mjs:1278`.
- D-04 (Prose reasons): the ~30 sites whose reason string already states its
  action are out of scope and are not split into `reason` + `hint`. Splitting
  them changes the emitted reason literal, which AC4 and REQUIREMENTS.md's
  breaking-change note both forbid. Evidence:
  `cadence-core/bin/lib/release-decision.mjs:228-257`
  (`'no-target-version: no target version given, refuse to write'`),
  `cadence-core/bin/lib/branch-decision.mjs:250,267`,
  `cadence-core/bin/worktree-base.mjs:136,140,145`.
- D-09 (Wrapper signatures): the three 2-argument `fail` wrappers are widened to
  three arguments, copying `planning.mjs:247`'s conditional spread
  `...(hint ? { hint } : {})`. This is a signature change, so the phase is NOT
  the "purely additive text" the roadmap opened with; 27 sites sit behind it.
  `review-provider.mjs`'s body also feeds `traceProvider(activeMeta, reason, …)`
  and emits `detail: detail || null` unconditionally, so its widening needs the
  trace call reviewed alongside. `helper-census.test.mjs` pins none of the four
  wrappers, so widening trips no census. Evidence:
  `cadence-core/bin/config.mjs:48`, `cadence-core/bin/route.mjs:144`,
  `cadence-core/bin/review-provider.mjs:139`.

## Decisions

- D-05 (Registry rows): the static registry rows in `lib/bulk-output.mjs`
  (13 rows), `lib/text-transport.mjs` (16) and `lib/release-decision.mjs` are
  out of scope - 43 of the 186. Their `reason` is prose classification data
  that self-verify READS; no user ever sees it as a refusal. Evidence:
  `cadence-core/bin/lib/bulk-output.mjs:211-301`, consumed at
  `cadence-core/bin/self-verify.mjs:641,652`;
  `cadence-core/bin/lib/text-transport.mjs:194-312`.
- D-06 (git-guard): `git-guard.mjs` is out of scope. Its `reason` is the hook
  payload's `permissionDecisionReason`, already plain prose with zero kebab
  tokens, and it already names the action. Evidence:
  `cadence-core/bin/git-guard.mjs:39-44`, and `:176`
  (`'Fix the file, or approve to commit under the defaults.'`); the hot-path
  constraint is corroborated at
  `cadence-core/bin/lib/global-only-keys.mjs:17-24`.
- D-07 (Sub-envelope returns): returns a caller re-wraps before emitting are out
  of scope - the user never reads that token. Evidence:
  `cadence-core/bin/lib/why-query.mjs:113-137` (8 sites) re-wrapped at
  `cadence-core/bin/why.mjs:348` as `reason: 'bad-query'`;
  `cadence-core/bin/lib/read-trace.mjs:275-291` and
  `cadence-core/bin/lib/trace.mjs:264-280` return `{written:false, reason}` with
  no `ok` field, best-effort telemetry whose callers swallow the refusal.
- D-08 (Comment stripping): the check strips comments before matching, using the
  tree's existing stripper. 28 of the raw 186 hits are comments and JSDoc, and
  reporting them would name design prose the sweep must not edit. Evidence:
  `cadence-core/bin/lib/skim.mjs` exports `skim(source)` with line numbers
  preserved; comment-only hits at `cadence-core/bin/lib/trace.mjs:33,256`,
  `cadence-core/bin/lib/file-transition.mjs:61,63`,
  `cadence-core/bin/planning.mjs:1316`,
  `cadence-core/bin/lib/why-query.mjs:108,135`.
- D-10 (Envelope shape): the hint rides as a conditional key, so an absent hint
  adds no key and no existing assertion moves. No `deepStrictEqual` in
  `cadence-core/bin/*.test.mjs` compares a whole refusal envelope; the
  `Object.keys(...)` assertions found are on `res.voices[0]`, `r.review`,
  `r.table`, `r.reviewers`. Evidence:
  `cadence-core/bin/adjudication-record.test.mjs:144`,
  `cadence-core/bin/route.test.mjs:333,604,638`,
  `cadence-core/bin/planning.mjs:247`.
- D-11 (Check placement): the check is the next number in `self-verify.mjs`'s
  numbered series (18 as the series stands), implemented as a new
  `cadence-core/bin/lib/<name>.mjs` exporting an `…Issues(root, register = REGISTER)`
  function with the exclusion register as a defaulted final parameter, so a test
  can inject a substitute. `problems[]` entries keep the tree's uniform
  `{ kind, file, detail }` shape. Evidence: 15 existing exports of that shape,
  e.g. `cadence-core/bin/lib/include-consumers.mjs:148`
  (`includeConsumerIssues(root, waived = WAIVED)`, register documented at
  `:60-99`), `cadence-core/bin/lib/deferred-reads.mjs:416`; the bin walker
  `binFiles(root, opts)` at `cadence-core/bin/self-verify.mjs:382`, already used
  at `:1145` and `:1217`.
- D-12 (No weight cost): `cadence-core/bin/` carries no weight budget, so hint
  text costs no context bytes on any surface. Evidence:
  `cadence-core/bin/weight-budgets.json` holds 111 keys across `agents/` (19),
  `cadence-core/` (58) and `skills/` (34); zero end in `.mjs`, and the only
  occurrence of `bin/` in the file is inside `_comment`.

## Acceptance criteria

- [ ] AC1: On the tree as it stands before the sweep,
      `node cadence-core/bin/self-verify.mjs --root .` returns `ok:false` with at
      least one `problems[]` entry from the new check, and every such entry names
      a file path and the reason token.
- [ ] AC2: On the finished tree,
      `node cadence-core/bin/self-verify.mjs --root .` returns `ok:true` with
      `problems: []`, and SUMMARY states two integers - the in-scope site count
      and the hintless in-scope count - the second being 0.
- [ ] AC3: `node cadence-core/bin/config.mjs set nosuchkey=1`, and one refusal
      each from `route.mjs` and `review-provider.mjs`, print an envelope whose
      `hint` is a non-empty string. (Before the phase, the config one prints
      `{"ok":false,"reason":"invalid","detail":[...]}` with no hint.)
- [ ] AC4: `git diff main...HEAD` shows no edit to any `reason:` literal value
      or any positional first argument to a `fail(...)` call, and
      `node cadence-core/bin/test.mjs` reports 0 failures with no test's expected
      reason string changed.
- [ ] AC5: `node cadence-core/bin/weight.mjs` reports every budgeted surface
      within its pin, and `git diff --name-only main...HEAD` lists no path under
      `cadence-core/workflows/`, `cadence-core/references/` or
      `skills/cad-*-contract/`.
- [ ] AC6: The check's lib file carries a register naming each exclusion -
      `usage`, `internal`, `git-guard.mjs`, the three static-registry libs, the
      re-wrapped sub-envelope returns - each with a one-line reason, and a test
      injects a substitute register to prove the check reads it rather than a
      hard-coded list.

## Flagged assumptions

- Hints for the review-provider tokens will duplicate guidance
  `cadence-core/workflows/config-review.md:36-45` already carries in prose for
  `no-key`, `transport`, `http` and `over-response` - Likely; if wrong: two
  copies of one sentence drift apart, and AC5 forbids touching `workflows/` to
  reconcile them, so the duplication is accepted rather than resolved.
- The check keyed on the emitting call (D-02) needs to trace a value to an
  `emit`/`out`/`fail` rather than pattern-match a line, which is the hardest of
  the three candidate rules to implement - Likely; if wrong: the planner falls
  back toward a shape rule and the boundary D-02 locked becomes approximate,
  which reopens the noise risk the roadmap names.
