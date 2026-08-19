# Phase 4: One argument contract instead of nine - Context

Gathered: 2026-08-19
Feeds: /cad-plan 4

## Scope boundary

In: the per-seam refusals phase 2 wrote are expressed once as a declarative
argument contract (ARG-06). Measured 2026-08-19, the phase title's "nine" does
not survive: there are 7 distinct argv-parsing implementations under
`cadence-core/bin/`, and phase 2 already collapsed the largest family, leaving
FOUR non-trivial parsers - `planning.mjs:5352`, `route.mjs:730`,
`review-provider.mjs:169`, `config.mjs:330`. All four adopt, and so do the eight
bins already on `lib/seam-input.mjs`, which re-express their flags as
declarations rather than hand-written `flagValue` calls. `self-verify.mjs`'s
`CONTRACTS` table moves into the shared module and gains the value grammar.
Three defects close as a consequence: `planning.mjs`'s own `--dir` (phase 2's
D-03 gap), and the flag-swallow in `route.mjs` and `review-provider.mjs`.

Out: `skim.mjs:29-30` and `test.mjs:66-75` - the two trivial parsers, neither
of which restates a rule (`skim` reads two boolean flags, `test` takes group
names as positionals and one `--list`). Out: the eight `CONTENT_SIGNALS`
detection patterns and every other phase-3 exclusion, unchanged. Out: the
`deepMerge` `__proto__` latent item, which nothing reads
(`.planning/CAPTURE.md`). Out: `workflows/progress.md:101`'s unguarded
read-back - a `[act] (phase 4)` capture item about a scratch-file PARSE, not
about an argument face; it is phase 1's SCR-01 territory and is left in the
queue rather than smuggled in here.

Deferred: None.

Plan shape: multiple plans, same phase. The leases do not overlap and the
ordering constraint is single: the shared module must exist before anything
adopts it. Natural split - (a) the shared module plus the `CONTRACTS` move
(new `bin/lib/` file + `self-verify.mjs`), (b) the four-parser adoption
(`planning.mjs`, `route.mjs`, `review-provider.mjs`, `config.mjs`), (c) the
eight-seam re-declaration plus the `optionalFlag` collapse (`lib/seam-input.mjs`,
`seam-input.test.mjs`, `helper-census.test.mjs`), (d) the `conventions.md`
section plus its budget re-pin.

## Durable decisions

- D-01 (reach): the contract reaches ALL FOUR remaining parsers AND the eight
  bins already on `lib/seam-input.mjs`, which re-declare rather than keep
  hand-written `flagValue` calls. Evidence: `grep -l "from './lib/seam-input.mjs'"`
  returns 8 non-test bins, each with an `e.seam` arm; the four remaining parsers
  are `planning.mjs:5352`, `route.mjs:730`, `review-provider.mjs:169`,
  `config.mjs:330`. The eight are included because the requirement's sentence is
  that a TENTH seam inherits the rules - a contract only the four adopt leaves
  eight seams still restating them by hand.
- D-02 (centre of gravity): `planning.mjs` is where the contract has to land,
  not the six `--dir` seams. Measured 2026-08-19: it alone holds 79
  `fail('bad-args', ...)` sites, 11 "needs a `<thing>` after it" refusals, 26
  `'<flag>' in opts` presence probes, 28 `requireInt`/`requirePhaseArg`/
  `requireCursorNumber` calls and 5 drop-on-bare spreads, against one
  `flagValue` call and one catch arm in each migrated seam
  (`git-branch.mjs:107-135`, `worktree-base.mjs:148-168`).
- D-03 (planning.mjs `--dir`): phase 2's D-03 gap closes here, and the defect is
  WORSE than D-03 recorded. Measured 2026-08-19 in this repo:
  `planning.mjs status --dir ''` returns `{"ok":true,"current":4,"total":5,...}`
  about `./.planning`, a tree the caller never named; a BARE `--dir` mints
  boolean `true` at `planning.mjs:5352-5365`, which reaches `existsSync(true)`
  and emits a Node `DEP0187` deprecation warning on STDERR beside
  `{"ok":false,"reason":"no-planning-dir","detail":"true not found"}`.
  `lib/seam-io.mjs` states stdout is the single channel the seam layer parses,
  and that deprecation is scheduled to become a throw - so this degrades from
  wrong-answer to crash on a future Node. Site: `planning.mjs:5437`
  (`const dir = opts.dir || '.planning'`).
- D-04 (disposition, not type): each flag declares a DISPOSITION - refuse /
  warn / fall back - not merely a type. All three are reasoned, stated positions
  in this tree, and a contract that makes every typed flag refuse-on-malformed
  reverses two documented decisions at once. Evidence:
  `issue-check.mjs:308-313` falls back to a constant on a malformed
  `--timeout-ms` because "this seam's whole contract is that it never fails a
  land"; `route.mjs:741-744` stores `--phase` RAW and turns a bad shape into a
  WARNING, never a `usage` refusal, "which would route the phase lower than its
  own baseline"; `lib/seam-input.mjs:98-106` refuses. If wrong: `issue-check`
  gains the power to fail a land, and a `--phase` typo routes below the phase's
  own risk floor.
- D-05 (bare-flag vs empty-value): the two dispositions are declared
  SEPARATELY, because `planning.mjs` already runs both side by side inside one
  function body. In the shared `trace append|close` body, `--step`, `--reviewer`
  and `--trigger` each refuse a bare flag with `bad-args`
  (`planning.mjs:3446-3492`) while `--role`, `--plan`, `--sha` and `--base` each
  silently drop it (`:3510-3522`). This is the bare `--role` empty-key item
  phase 2 filed here (`.planning/CAPTURE.md:59`), and it is concrete: measured
  2026-08-19, `trace append --phase 1 --family lifecycle --event dispatch --role
  --tokens 5` returns `{"ok":true,"written":true,"corr":"1"}`, writes a line
  with no `role` key, and `trace render` then reports
  `"roles":{"":{"dispatches":2,"tokens":5,"unrecorded":1}}` - the aggregation
  key is the empty string (`lib/trace.mjs:639-642`). `--role ''` is identical.
  If wrong: unifying the two either makes `--plan`/`--sha` required and every
  shipped `trace close` without them starts refusing, or extends the drop arm to
  the three refusals written against exactly the complete-looking event that
  defeats attribution.
- D-06 (one table): `CONTRACTS` MOVES out of `self-verify.mjs:274-509` into the
  shared module, gains the value grammar (required/optional, type, disposition,
  bare-flag disposition), and `self-verify.mjs` reads it back for its prose
  lint. One source, not two bound by a check. Evidence: the table already covers
  all 16 top-level bins with a `'*'` global row and a `''` bare-form row, and
  check 2 (`self-verify.mjs:780-830`) consumes it as
  `new Set([...contract[sub], ...contract['*']])`; check 14 enforces that every
  bin has a row, so a missing row is a silent opt-out rather than an unlinted
  script. If two tables shipped, a flag added to one and not the other is either
  silently accepted at the CLI or reported `unknown-flag` against correct prose -
  the drift ARG-06 exists to end, reintroduced by the fix.
- D-07 (no new reason code on the four-parser side): the contract mints NO
  reason code of its own for `planning.mjs`, `route.mjs`, `config.mjs` or
  `review-provider.mjs`; each names its refusal in the vocabulary it already
  owns. This continues phase 2's D-04 (one vocabulary, one owner). Evidence:
  `planning.mjs:5406-5413` states it in code - its `--root` guard uses
  `fail('bad-args', ...)` and explicitly NOT the `missing-flag-value` throw,
  "because this file has ONE refusal vocabulary and no `e.seam` catch arm to
  render that throw as anything but `internal`"; `references/seams.md:329-332`
  publishes `review-provider`'s list verbatim. If wrong, a workflow branches on
  a `reason` its prose never declared.
- D-08 (two mechanisms, picked per bin): the throwing form and the returning
  form BOTH survive, chosen per adopting bin rather than harmonized.
  `flagValue` throws `{seam, detail}` and needs an `e.seam` arm (phase 2's D-09)
  - the eight seams have one. `requireInt`/`resolveTextFlag` return a
  classification and the caller names the refusal - `planning.mjs`, `route.mjs`
  and `config.mjs` use only this form and have NO `e.seam` arm. Evidence:
  `lib/seam-input.mjs:80-106`, `git-branch.mjs:127-134`,
  `lib/require-int.mjs:11-13`, `route.mjs:770-787`, `config.mjs:351-372`. If
  wrong: a throwing contract in `planning.mjs` surfaces every argument refusal
  as `{"ok":false,"reason":"internal","detail":"[object Object]"}`, the exact
  regression `lib/seam-input.mjs:48-50` names.
- D-09 (the collapse): `optionalFlag` collapses INTO the contract, and
  `helper-census.test.mjs`'s body-idiom census rows plus `seam-input.test.mjs`'s
  divergence arm are rewritten in the SAME commit. This is the second reversal
  of this file's two-contract guarantee - phase 2's D-01 made the first, editing
  the header and the divergence arm rather than leaving them to go red.
  Evidence: `lib/seam-input.mjs:19-50` (post-phase-2 header still documenting
  two live contracts), `seam-input.test.mjs:71-75` (divergence pinned as a named
  test), `helper-census.test.mjs:57-90` (each reader's body idiom pinned to
  exactly one home tree-wide).

## Decisions

- D-10 (evaluator shape): the contract is declarative DATA plus a shared
  evaluator, and the evaluator returns a classification rather than emitting.
  Both idioms are already load-bearing here: `config.schema.json` is 77
  declarative key specs read by `config.mjs`, and `lib/require-int.mjs:11-13`
  and `lib/text-flag-file.mjs:37-39` are pure classifiers whose headers both
  state the CALLER owns the reason string; `lib/plan-key.mjs` is phase 3's
  shared grammar in the same shape. A helper-only contract is not the
  declarative thing ARG-06 asks for; a data-only contract is a second CONTRACTS
  table that drifts from the code.
- D-11 (return shape): the evaluator returns ONE FLAT `{ok, value, detail}` on
  both paths, never a JSDoc discriminated union at the call sites. Evidence:
  `tsconfig.ci.json` runs `checkJs: true` with `strict: false` over every
  non-test `.mjs` under `cadence-core/bin`, and `lib/text-flag-file.mjs:53-58`
  records a MEASURED TS2339 at its first call site from exactly that pattern,
  which is why it already returns one flat shape. If wrong, CI's typecheck goes
  red at every adopting call site and the fix is a cast at each one.
- D-12 (defaulting flags): `--branch`, `--base`, `--remote`, `--merged` and
  `--version` keep today's behavior by declaring the `fallback` disposition.
  This is what makes D-09's collapse safe - without it they start refusing a
  valueless spelling their seams' `|| fallback` currently absorbs.
- D-13 (route.mjs and review-provider.mjs): both carry the flag-shaped-value
  defect `flagValue` was written against, and both close here. Measured
  2026-08-19: `route.mjs resolve --role --attempt 2` returns
  `{"ok":false,"reason":"unknown-role","role":"--attempt",...}` - `--role`
  swallowed `--attempt` and the attempt silently reverted to 1;
  `review-provider.mjs consult --payload --provider openai` returns
  `{"ok":false,"reason":"bad-provider","detail":"unknown provider: undefined"}`.
  Sites: `route.mjs:731-762` and `review-provider.mjs:169-177`, both
  `opts[a.slice(2)] = rest[i + 1]` with no flag-shape test.
- D-14 (module placement): the shared module goes under `cadence-core/bin/lib/`,
  which costs NOTHING in self-verify terms - check 14 (`uncontracted-script`,
  `self-verify.mjs:1409-1442`) is deliberately non-recursive and skips `lib/`,
  and none of `weight-budgets.json`'s 110 entries is under `bin/`. A new
  `.test.mjs` needs no registration either: `test.mjs:11-15` routes an unnamed
  stem to `other`, which the default run and CI both execute. A top-level
  `bin/*.mjs` instead would trip `uncontracted-script` and need a CONTRACTS row
  describing a script prose never invokes.
- D-15 (prose home): a new arguments section lands in
  `references/conventions.md`, whose budget row is re-pinned in the same commit.
  There is no existing home - `conventions.md`'s headings are Paths, Deliberate
  shortcuts, Config resolution, Caller-derived text, Bulk tool output, Parallel
  work, State, Subagents and reviews, Reporting style, Authoring style, none of
  them arguments; `references/seams.md:8,42,306` names only `ask-user`,
  `spawn-agent` and `call-review-provider`, and the bin-CLI family is not among
  them.
- D-16 (budget mechanics): the weight check is a documented CEILING, not an
  equality (`self-verify.mjs:945-981` - "Exactness was tried and cost more than
  it caught"), so only GROWTH needs a re-pin. But every surface this phase would
  plausibly touch sits at exactly 0 B headroom, verified 2026-08-19 against
  `weight.mjs --root .`: `references/seams.md` 22644/22644,
  `references/conventions.md` 12082/12082, `references/COMMANDS.md` 5058/5058,
  `references/capture-grammar.md` 6358/6358. So D-15's section cannot land
  without its row moving in the same commit.

## Acceptance criteria

- [ ] AC1: `planning.mjs status --dir ''` and `planning.mjs status --dir`
      (bare) each print one JSON line `{"ok":false,...}` naming the flag, exit
      1, and write nothing to stderr. Baseline: `--dir ''` returns
      `{"ok":true,"current":4,"total":5,...}` about `./.planning`, and bare
      `--dir` prints a `DEP0187` warning on stderr beside
      `{"ok":false,"reason":"no-planning-dir","detail":"true not found"}`.
- [ ] AC2: `route.mjs resolve --role --attempt 2` and
      `review-provider.mjs consult --payload --provider openai` each refuse
      naming the valueless flag, and each refusal's `reason` is a code that
      bin's own published vocabulary already contains - `references/seams.md`
      lines 329-332 are unchanged. Baseline: they return
      `unknown-role: "--attempt"` and `bad-provider: "unknown provider:
      undefined"`.
- [ ] AC3: `planning.mjs trace append --phase 1 --family lifecycle --event
      dispatch --role --tokens 5` returns `ok:false`, and `trace render` on that
      phase reports no `""` key under `roles`. A `trace close` with a bare
      `--plan` or a bare `--sha` still returns `ok:true` and still omits that
      key. Baseline: the `--role` form returns `{"ok":true,"written":true}` and
      render aggregates under `"roles":{"":{"dispatches":2,...}}`.
- [ ] AC4: each of the three dispositions holds at a named flag - `issue-check`
      with a malformed `--timeout-ms` still returns `ok:true` on its constant,
      `route.mjs resolve --phase <malformed>` still warns and resolves rather
      than refusing, and a valueless `--dir` refuses.
- [ ] AC5: `self-verify.mjs` no longer defines `CONTRACTS` and imports it from
      the shared module; `node cadence-core/bin/self-verify.mjs` returns
      `{"ok":true,...,"problems":[]}`; and removing one flag from a row in the
      shared spec makes self-verify report `unknown-flag` against the prose that
      names it.
- [ ] AC6: `node cadence-core/bin/test.mjs` passes with zero failures,
      `cadence-core/bin/lib/seam-input.mjs` no longer exports `optionalFlag`,
      and `seam-input.test.mjs` carries no surviving divergence arm.
- [ ] AC7: `references/conventions.md` carries an arguments section stating the
      three dispositions and the bare-vs-empty split, its `weight-budgets.json`
      row equals its new byte size, and `npx tsc -p tsconfig.ci.json` reports
      zero errors.

## Flagged assumptions

- The eight already-migrated seams can re-declare their flags without any
  behavior change beyond D-12's fallback disposition - Likely; if wrong, a
  seam whose `|| fallback` absorbed something D-12 does not name starts
  refusing an input it used to accept, on a phase whose requirement is
  structural.
- `self-verify.mjs` importing `CONTRACTS` from a runtime module does not
  create a cycle or a load-order problem with the checks that run before check
  2 - Likely; if wrong, D-06's single table has to become a data-only file both
  sides import, which is a third placement neither option named.
- The `planning.mjs` adoption can be staged so its 79 `bad-args` sites move
  incrementally rather than in one commit - Unclear; if wrong, plan (b) carries
  a single unreviewably large diff on the most-invoked CLI in the plugin, and
  the blocking `risk_surface` gate fires on a range nobody can adjudicate.
- The split of the four areas across plans is the planner's call within the
  multiple-plans shape, subject to the one stated ordering constraint - Unclear;
  if wrong, two plans lease the shared module and one overwrites the other.
