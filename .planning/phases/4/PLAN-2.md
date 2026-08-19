---
phase: 4
plan: 2
requirements: [ARG-06]
files:
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/planning.test.mjs
  - cadence-core/bin/route.mjs
  - cadence-core/bin/route.test.mjs
  - cadence-core/bin/review-provider.mjs
  - cadence-core/bin/review-provider.test.mjs
  - cadence-core/bin/config.mjs
  - cadence-core/bin/config.test.mjs
---

# Phase 4: One argument contract instead of nine - Plan 2

## Goal

The four argv parsers that never migrated - `planning.mjs`, `route.mjs`,
`review-provider.mjs` and `config.mjs` - read their flags through the shared
declaration instead of restating the rules, and the three defects that closes
(`planning.mjs`'s own `--dir`, and the flag-swallow in `route.mjs` and
`review-provider.mjs`) stop answering about input the caller never named.

## Must be true when done

- `planning.mjs status --dir ''` and `planning.mjs status --dir` (bare) each
  print one JSON line `{"ok":false,...}` naming the flag, exit 1, and write
  nothing to stderr. `planning.mjs status` with no flag still answers about
  `.planning`.
- `planning.mjs trace append --phase <p> --family lifecycle --event dispatch
  --role --tokens 5` returns `ok:false`, and `trace render` on that phase
  reports no `""` key under `roles`. A `trace close` with a bare `--plan` or a
  bare `--sha` still returns `ok:true` and still omits that key.
- `route.mjs resolve --role --attempt 2` and `review-provider.mjs consult
  --payload --provider openai` each refuse naming the VALUELESS flag, and each
  refusal's `reason` is a code that bin's own published vocabulary already
  contains.
- `route.mjs resolve --phase <malformed>` still resolves and now says so in
  `warnings[]`, rather than refusing and rather than saying nothing.
- `config.mjs validate --file --nonsense` refuses instead of reading a file
  named `--nonsense`, in `config.mjs`'s own `usage` vocabulary.
- `node cadence-core/bin/test.mjs` reports 0 failures and
  `references/seams.md` is unchanged.

## Context

D-07 binds the vocabulary: the contract mints NO reason code of its own for
these four - each names its refusal in the vocabulary it already owns, because
`planning.mjs` has ONE refusal vocabulary and no `e.seam` catch arm, and
`references/seams.md` publishes `review-provider`'s list verbatim. D-08 binds
the mechanism: these four use the RETURNING form and the caller names the
refusal; a throwing contract in `planning.mjs` would surface every argument
refusal as `{"ok":false,"reason":"internal","detail":"[object Object]"}`. D-04
binds the dispositions and D-05 the bare-flag-versus-empty-value split. Out of
scope, deliberately: `planning.mjs`'s in-handler domain refusals - the enum
memberships, the required-presence checks and the `requireInt` /
`requirePhaseArg` / `requireCursorNumber` calls, which already reach ONE shared
classifier in `lib/require-int.mjs` and are not restatement.

## Tasks

### Task 1: `planning.mjs --dir` refuses an empty, bare or flag-shaped value

- **Files:** cadence-core/bin/planning.mjs (the `parseArgs` function and the
  dispatch tail's `const dir = opts.dir || '.planning'`), cadence-core/bin/planning.test.mjs
- **Action:** Close phase 2's D-03 gap at `planning.mjs`'s own door, where the
  defect is worse than D-03 recorded. Measured 2026-08-19 in this repository:
  `planning.mjs status --dir ''` returns `{"ok":true,"current":4,"total":5,...}`
  about `./.planning`, a tree the caller never named, and a BARE `--dir` mints
  the boolean `true` in `parseArgs`, which reaches `existsSync(true)` and emits
  a Node `DEP0187` deprecation warning on STDERR beside
  `{"ok":false,"reason":"no-planning-dir","detail":"true not found"}`.
  `lib/seam-io.mjs` states stdout is the single channel the seam layer parses,
  and that deprecation is scheduled to become a throw, so this degrades from
  wrong-answer to crash on a future Node. Read `--dir` through its declared row
  in the shared contract and refuse the empty, bare and flag-shaped spellings
  BEFORE the value reaches any `existsSync`. The refusal is `fail('bad-args',
  ...)` naming the flag, never the `missing-flag-value` throw (D-07): this file
  has ONE refusal vocabulary and no `e.seam` catch arm to render that throw as
  anything but `internal`, which its own `detect-commands --root` guard states
  in code. A genuinely ABSENT `--dir` still defaults to `.planning`, unchanged,
  and no subcommand's behavior changes.
- **Verify:** `node cadence-core/bin/planning.mjs status --dir ''` and `node
  cadence-core/bin/planning.mjs status --dir` each print exactly one JSON line
  `{"ok":false,"reason":"bad-args",...}` whose detail names `--dir`, exit 1, and
  produce zero bytes on stderr (`2>&1 >/dev/null | wc -c` reports 0); `node
  cadence-core/bin/planning.mjs status` still returns
  `{"ok":true,"current":4,"total":5,...}`; `node --test
  cadence-core/bin/planning.test.mjs` passes.

### Task 2: The trace body's bare-flag dispositions come from the declaration

- **Files:** cadence-core/bin/planning.mjs (the shared `trace append|close`
  body: the `--step`, `--reviewer` and `--trigger` guards and the `--plan`,
  `--sha`, `--base` and `--role` spreads in the `appendEvent` call),
  cadence-core/bin/planning.test.mjs
- **Action:** This one function body already runs both bare-flag dispositions
  side by side, which is why D-05 declares them separately: `--step`,
  `--reviewer` and `--trigger` each refuse a bare flag with `bad-args`, while
  `--role`, `--plan`, `--sha` and `--base` silently drop it through the `typeof
  opts.x === 'string' && opts.x ? {...} : {}` spreads. Drive both from the
  declarations rather than from seven hand-written guards, and MOVE `--role` to
  the refuse disposition. The evidence is concrete: measured 2026-08-19, `trace
  append --phase 1 --family lifecycle --event dispatch --role --tokens 5`
  returns `{"ok":true,"written":true,"corr":"1"}`, writes a line with no `role`
  key, and `trace render` then reports
  `"roles":{"":{"dispatches":2,"tokens":5,"unrecorded":1}}` - the aggregation
  key is the empty string. `--role ''` is identical and must refuse identically.
  `--plan`, `--sha` and `--base` KEEP the fallback disposition and keep omitting
  the key: making them required would start refusing every shipped `trace close`
  written without them, and extending the drop arm the other way would defeat
  the three refusals written against exactly the complete-looking event that
  destroys attribution. The `--role` refusal stays `fail('bad-args', ...)` in
  the wording the three existing refusals use.
- **Verify:** Against a scratch `--dir`, never `.planning`: `trace append
  --phase 1 --family lifecycle --event dispatch --role --tokens 5` and the same
  command with `--role ''` each return `ok:false` with `"reason":"bad-args"` and
  a detail naming `--role`; `trace render --phase 1` on that scratch tree
  reports no `""` key under `roles`; `trace close --phase 1 --plan` (bare) and
  `trace close --phase 1 --sha` (bare) each still return `ok:true` and the
  written JSONL line still omits that key. `node --test
  cadence-core/bin/planning.test.mjs` passes.

### Task 3: `route.mjs` stops swallowing the next flag as a value

- **Files:** cadence-core/bin/route.mjs (`parseArgs` and the `resolve` dispatch
  arm's five `usage` refusals), cadence-core/bin/route.test.mjs
- **Action:** `parseArgs` assigns `o.role = a[++i]` with no flag-shape test, so
  measured 2026-08-19 `route.mjs resolve --role --attempt 2` returns
  `{"ok":false,"reason":"unknown-role","role":"--attempt",...}` - `--role`
  swallowed `--attempt` and the attempt silently reverted to 1, which is the
  exact defect `flagValue` was written against. Read `--role`, `--file`,
  `--bracket-read`, `--bracket-plan` and `--attempt` through their declared rows
  so a missing, empty or FLAG-SHAPED value is refused by name. The refusal keeps
  route.mjs's own `usage` reason and the existing `resolve --<flag> needs ...`
  detail wording (D-07) - this bin mints no new reason code. Two rules that must
  not move: the argument-shape refusals keep carrying NO `warnings`, because
  they fail before any config file is named and there is no layer whose
  diagnostics could ride along; and `--phase` is not part of this task, staying
  RAW for task 4.
- **Verify:** `node cadence-core/bin/route.mjs resolve --role --attempt 2`
  returns `{"ok":false,"reason":"usage",...}` whose detail names `--role`, exits
  1, and is NOT `unknown-role`; the same for `resolve --file --role
  cad-planner`; `node cadence-core/bin/route.mjs resolve --role cad-planner
  --file <a scratch config>` still returns the full ok:true bundle with the same
  `agent`, `model`, `effort` and `review` values it returns today; `node --test
  cadence-core/bin/route.test.mjs` passes.

### Task 4: `route.mjs --phase` warns on a malformed shape and still resolves

- **Files:** cadence-core/bin/route.mjs (the `resolve` function's `tracePhase`
  derivation and its `warnings` array), cadence-core/bin/route.test.mjs
- **Action:** `--phase` declares the WARN disposition (D-04). A bad shape must
  never become a `usage` refusal, which would route the phase lower than its own
  baseline - but measured 2026-08-19 the malformed spelling produces no
  diagnostic at all: `route.mjs resolve --role cad-planner --phase 1.10.3 --file
  <cfg>` returns ok:true with no mention of `--phase`, because
  `requirePhaseArg(opts.phase)` sits inside a try/catch at the `tracePhase`
  derivation and its `!parsed.ok` arm falls silently through to `cursorPhase`.
  The comment above the parse says the check belongs where the floor is
  computed, and that floor is retired, so today nothing carries it. Make a
  malformed `--phase` reach the resolve envelope's `warnings[]`, which rides
  every result shape including `ok:false` (DOC-01), while the resolution itself
  is unchanged and `tracePhase` still falls back to the cursor. Do NOT attach
  the warning to the argument-shape `usage` refusals from task 3.
- **Verify:** `node cadence-core/bin/route.mjs resolve --role cad-planner
  --phase 1.10.3 --file <scratch config>` returns `ok:true` carrying the same
  `agent`, `model`, `effort` and `review` bundle it returns with no `--phase` at
  all, PLUS a `warnings` entry naming `--phase`; the same command with `--phase
  2` carries no such warning; `node cadence-core/bin/route.mjs resolve --file
  <scratch config>` (no `--role`) still returns `{"ok":false,"reason":"usage"}`
  with no `warnings` key at all; `node --test cadence-core/bin/route.test.mjs`
  passes.

### Task 5: `review-provider.mjs` stops swallowing the next flag as a value

- **Files:** cadence-core/bin/review-provider.mjs (the exported `parseArgs`),
  cadence-core/bin/review-provider.test.mjs
- **Action:** `parseArgs` does `opts[a.slice(2)] = rest[i + 1]` with no
  flag-shape test, so measured 2026-08-19 `review-provider.mjs consult --payload
  --provider openai` returns `{"ok":false,"reason":"bad-provider","detail":"unknown
  provider: undefined"}` - a refusal about a flag the caller DID pass, produced
  because `--payload` ate `--provider` and the value after it was skipped. Read
  the declared flags (`--provider`, `--model`, `--effort`, `--payload`,
  `--trigger`, `--key-file`) through their rows so a missing, empty or
  flag-shaped value is refused by name. The reason is `bad-args`, which
  `references/seams.md` already publishes in this bin's degradation list - mint
  nothing new and leave those lines untouched (D-07). `parseArgs` is EXPORTED
  and imported by `review-provider.test.mjs`, so its `{cmd, opts}` return shape
  must survive; the refusal reaches the caller without this pure function
  emitting anything itself.
- **Verify:** `node cadence-core/bin/review-provider.mjs consult --payload
  --provider openai` returns `{"ok":false,"reason":"bad-args",...}` whose detail
  names `--payload`, exits 1, and is NOT `bad-provider`; `node
  cadence-core/bin/review-provider.mjs detect-models --provider` (bare) refuses
  the same way; `git diff --stat cadence-core/references/seams.md` reports no
  change; `node --test cadence-core/bin/review-provider.test.mjs` passes,
  including its existing `parseArgs: subcommand plus --flag value pairs` row.

### Task 6: `config.mjs` reads `--file` through the declaration

- **Files:** cadence-core/bin/config.mjs (`optFile`), cadence-core/bin/config.test.mjs
- **Action:** `optFile` hand-writes the `--file` value rule as `if
  (!tokens[i + 1])`, which catches the undefined and empty spellings an
  interpolated `--file $VAR` produces but reads a FLAG-SHAPED token as a path:
  measured 2026-08-19, `config.mjs validate --file --nonsense` returns
  `{"ok":false,"reason":"read","detail":"cannot read/parse --nonsense: ENOENT
  ..."}`, answering about a file the caller never named. Read `--file` through
  its declared row so all three spellings are refused by one rule. Keep
  `fail('usage', '--file needs a path after it: --file <config file> (or
  --global)')` verbatim - this bin owns its vocabulary (D-07) - and keep two
  mechanics exactly as they are: `--global` is tested FIRST and short-circuits
  to `GLOBAL_CONFIG` before `--file` is looked at, and the returned `tokens`
  still has the consumed flag and its value filtered out before `set` and `get`
  read the key list from it. `--global` declares the boolean type, since its
  bare form is its only form.
- **Verify:** `node cadence-core/bin/config.mjs validate --file --nonsense`
  returns `{"ok":false,"reason":"usage",...}` naming `--file`, not
  `"reason":"read"`; `node cadence-core/bin/config.mjs get review.reviewers
  --file ''` and `... --file` return the same `usage` refusal; `node
  cadence-core/bin/config.mjs get review.reviewers` and `node
  cadence-core/bin/config.mjs get review.reviewers --global` both answer exactly
  as they do today; `node --test cadence-core/bin/config.test.mjs` and `node
  --test cadence-core/bin/config-seams.test.mjs` pass.

## Notes

Depends on plan 1: the shared module must exist before anything adopts it.
Shares no file with plan 1, plan 3 or plan 4.

Scope call recorded for the human: `planning.mjs` carries 79 `fail('bad-args',
...)` sites, and this plan moves the argument-DOOR ones - the `--dir` global and
the `trace append|close` bare-flag axis - not the in-handler domain refusals.
The reason is that those are what phase 2 wrote and what the phase-4 acceptance
criteria pin; the enum and required-presence checks are `planning.mjs`'s own
domain rules, and its 28 numeric-shape calls already reach ONE shared classifier
in `lib/require-int.mjs` with the caller naming its reason, which is exactly the
architecture D-10 asks the contract to have. Migrating the remaining ~70 sites
is a separate, larger unit of work with no acceptance criterion behind it.
