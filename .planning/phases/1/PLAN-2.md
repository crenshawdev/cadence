---
phase: 1
plan: 2
requirements: [HNT-01]
files:
  - cadence-core/bin/config.mjs
  - cadence-core/bin/route.mjs
  - cadence-core/bin/review-provider.mjs
  - cadence-core/bin/git-publish.mjs
  - cadence-core/bin/release-bump.mjs
  - cadence-core/bin/why.mjs
  - cadence-core/bin/skim.mjs
  - cadence-core/bin/git-branch.mjs
  - cadence-core/bin/issue-check.mjs
  - cadence-core/bin/land-cleanup.mjs
  - cadence-core/bin/weight.mjs
  - cadence-core/bin/worktree-base.mjs
  - cadence-core/bin/self-verify.mjs
---

# Phase 1: Every refusal names its next step - Plan 2 of 3

## Goal

Every seam CLI other than `planning.mjs` tells a user what to do next when it
refuses: the three two-argument `fail` wrappers can carry a hint at all, and
every in-scope refusal in those twelve files carries one.

## Must be true when done

- `node cadence-core/bin/config.mjs set nosuchkey=1`, `node
  cadence-core/bin/route.mjs resolve --role nosuchrole` and a `bad-provider`
  refusal from `node cadence-core/bin/review-provider.mjs` each print an
  envelope whose `hint` is a non-empty string naming an action (AC3). Before
  this plan the config one printed
  `{"ok":false,"reason":"invalid","detail":[...]}` with no hint.
- `node cadence-core/bin/self-verify.mjs --root .` reports no
  `hintless-refusal` entry against any file in this plan's list. The entries
  that remain all name `cadence-core/bin/planning.mjs`, which is plan 3.
- Every hint reads as an instruction to the person at the terminal, in their
  own terms, not as an explanation of the seam's internals - the shape the 13
  existing hints already have, e.g. `make them readable and re-run - an
  unreadable queue refuses a land exactly as a member does`.
- No `reason` token string moved and no positional first argument to a
  `fail(...)` call moved: `git diff` over this plan touches reason literals
  nowhere.
- `node cadence-core/bin/test.mjs routing git review other` reports 0 failures,
  and the suite's only failure remains `self-verify.test.mjs`'s live-tree
  assertion, still red on `planning.mjs` entries alone.

## Context

D-09 is locked: the three two-argument `fail` wrappers -
`cadence-core/bin/config.mjs:48`, `cadence-core/bin/route.mjs:144`,
`cadence-core/bin/review-provider.mjs:139` - are widened to three arguments
copying `cadence-core/bin/planning.mjs:247`'s conditional spread
`...(hint ? { hint } : {})`, and 27 sites sit behind them. D-10: the hint rides
as a conditional key, so an absent hint adds no key and no shipped assertion
moves. D-03 and D-04 keep the `usage` and `internal` tokens and the reason
strings that already state an action out of scope. AC4 forbids any edit to a
reason literal; AC5 forbids any path under `cadence-core/workflows/`,
`cadence-core/references/` or `skills/cad-*-contract/`.

The check from plan 1 is the worklist: run
`node cadence-core/bin/self-verify.mjs --root .` and close what it names for the
file in hand. Do not work from the counts in these task bodies where the check
disagrees - the check is the authority, and the counts are the plan-time
measurement.

## Tasks

### Task 1: Widen the three two-argument fail wrappers, proven at one site each

- **Files:** cadence-core/bin/config.mjs, cadence-core/bin/route.mjs,
  cadence-core/bin/review-provider.mjs
- **Action:** Widen each wrapper to take a third `hint` argument and spread it
  conditionally, copying `cadence-core/bin/planning.mjs:247`. Nothing else about
  the three envelopes may move: `config.mjs`'s and `route.mjs`'s wrappers emit
  `detail` unconditionally and must keep doing so, and
  `review-provider.mjs`'s `fail` emits `detail: detail || null` and calls
  `traceProvider(activeMeta, reason, ...)` before the emit - review that trace
  call in the same edit and leave its arguments untouched, because it records
  the degradation and is what a caller reads instead of the envelope when the
  bracket is what survives. `helper-census.test.mjs` pins none of the four
  wrappers, so this widening trips no census.
  Then prove each wrapper end to end by hinting exactly one site behind it: the
  site that answers `config.mjs set nosuchkey=1`, the `unknown-role` refusal in
  `route.mjs` that answers `resolve --role nosuchrole`, and a `bad-provider`
  refusal in `review-provider.mjs`. Three sites, no more - this task exists to
  make the path work, and the remaining sites are tasks 3, 4 and 5. Each hint
  names what the user should do (for the unknown key: name a key the schema
  carries, and where to see the list; for the unknown role: the roles the
  refusal's own detail already prints; for the unknown provider: configure or
  name one of the providers that resolve).
- **Verify:** `node cadence-core/bin/config.mjs set nosuchkey=1`, `node
  cadence-core/bin/route.mjs resolve --role nosuchrole` and a `bad-provider`
  refusal from `review-provider.mjs` each print JSON containing a non-empty
  `hint` string, and each still prints its original `reason` and `detail`
  unchanged. `node cadence-core/bin/test.mjs routing review` reports 0 failures.

### Task 2: The shared seam-relay catch arm, one hint across the nine CLIs that carry it

- **Files:** cadence-core/bin/git-branch.mjs, cadence-core/bin/issue-check.mjs,
  cadence-core/bin/land-cleanup.mjs, cadence-core/bin/weight.mjs,
  cadence-core/bin/worktree-base.mjs, cadence-core/bin/why.mjs,
  cadence-core/bin/self-verify.mjs, cadence-core/bin/git-publish.mjs,
  cadence-core/bin/release-bump.mjs
- **Action:** Nine entry blocks carry the same two-armed catch -
  `if (e && e.seam) emit({ ok: false, reason: e.seam, detail: e.detail }); else
  emit({ ok: false, reason: 'internal', ... })`. The `e.seam` arm is the shipped
  argument contract's refusal reaching the user (`missing-flag-value` and its
  siblings from `lib/arg-contract.mjs` / `lib/seam-input.mjs`); the `internal`
  arm is excluded by D-03 and must not be touched. Give the `e.seam` arm one
  hint, written once and used verbatim at all nine, naming what a caller does
  about a flag the seam refused: supply the flag a value in the form the
  refusal's `detail` names, then re-run the command. Do not name a specific flag
  - the arm relays whichever flag refused - and do not restate the detail.
  Include `self-verify.mjs` in this task rather than in plan 1: it is the same
  idiom and must read identically, and the linter itself should not be an
  example of the defect it reports.
- **Verify:** For each of the nine files, running its CLI with a flag spelled so
  the argument contract refuses it (e.g. `node cadence-core/bin/self-verify.mjs
  --root` with no value, `node cadence-core/bin/weight.mjs --root`) prints an
  envelope carrying the same non-empty `hint`, with `reason` unchanged. The file
  census - `node cadence-core/bin/self-verify.mjs --root . | python3 -c "import
  json,sys; print(sorted({x['file'] for x in json.load(sys.stdin)['problems'] if
  x['kind']=='hintless-refusal'}))"` - no longer lists `git-branch.mjs`,
  `issue-check.mjs`, `land-cleanup.mjs`, `weight.mjs`, `worktree-base.mjs` or
  `self-verify.mjs`.

### Task 3: config.mjs's remaining refusals name their next step

- **Files:** cadence-core/bin/config.mjs
- **Action:** Close every site the check still names in this file - eight at
  plan time, spanning the `read` refusals over an unreadable or unparseable
  layer file, the `invalid` refusals over a value the schema rejects, the
  `unknown-key` refusal, the `bad-schema` refusal, and the one `out({ok:false})`
  envelope that carries `file`, `checked` and `errors` and no `reason` key at
  all. Each hint names the user's next action: which file to fix and what makes
  it valid, which layer to set the key at, what a valid value looks like where
  the schema states one. Do not restate the `detail` and do not split any reason
  string into `reason` plus `hint` - that would change a reason literal, which
  AC4 forbids. `config.mjs set` layer-scope validation is phase 2 and is not
  touched here.
- **Verify:** The task-2 file census no longer lists `config.mjs`. `node
  cadence-core/bin/config.mjs get nosuchkey`, `node cadence-core/bin/config.mjs
  set workflow.max_plan_tasks=notanint` and `node cadence-core/bin/config.mjs
  check` against a repo whose `.planning/config.json` is not JSON each print a
  non-empty `hint` with the reason unchanged. `node cadence-core/bin/test.mjs
  routing` reports 0 failures.

### Task 4: review-provider.mjs's remaining refusals name their next step

- **Files:** cadence-core/bin/review-provider.mjs
- **Action:** Close every site the check still names in this file - seventeen at
  plan time, across `over-cap`, `bad-payload`, `bad-provider`, `bad-args`,
  `no-key`, `http`, `no-output`, `bad-json`, `bad-shape`, `bad-command`, and the
  computed `over-response`/`transport` pair in the request path. This is the
  densest refusal surface in the plugin outside `planning.mjs` and the one a
  user hits with no context at all, since a cross-model review fails somewhere
  between a config key and a remote HTTP response. Name the action per token:
  where the key is read from and what to set for `no-key`, what to shrink or
  which cap to raise for `over-cap` and `over-response`, what to retry or check
  for `http` and `transport`, which side produced the bad shape for `bad-shape`
  and `bad-json`. Leave `traceProvider`'s arguments and the `detail: detail ||
  null` behaviour exactly as task 1 left them.
  Accepted, not resolved: four of these hints repeat guidance
  `cadence-core/workflows/config-review.md` already carries in prose for
  `no-key`, `transport`, `http` and `over-response`. AC5 forbids editing
  `workflows/` to reconcile them, so the duplication is the stated cost (CONTEXT
  flagged assumption 1).
- **Verify:** The task-2 file census no longer lists `review-provider.mjs`. `node
  cadence-core/bin/review-provider.mjs review --provider nosuch` and a run with
  no key configured each print a non-empty `hint` with the reason unchanged.
  `node cadence-core/bin/test.mjs review` reports 0 failures.

### Task 5: The publish and release seams name their next step

- **Files:** cadence-core/bin/git-publish.mjs, cadence-core/bin/release-bump.mjs
- **Action:** Close every site the check still names in these two files - seven
  each at plan time. In `git-publish.mjs` that is the relayed
  `decision.reason` from `lib/publish-decision.mjs` at both gates,
  `config-parse-failed`, `push-failed`, `reap-failed` and `auto-close-off`. In
  `release-bump.mjs` it is the relayed `primary.code` from
  `lib/release-decision.mjs`, `unreadable-manifest`, `no-version-field`,
  `unreadable-sibling-manifest`, `unreadable-changelog`, `partial-bump` and
  `bad-date`. These refusals stop a land or a close, so the hint is what the
  user does to make the land or the close proceed: which file to repair, which
  key to set at which layer, which value the seam expects. Two constraints
  specific to these files. `auto-close-off` must send the reader at the
  REPOSITORY layer, since `git.auto_close` is authorized by the repository alone
  and a user-global `true` does not speak for it. And `partial-bump`'s hint must
  not prescribe a re-run that would compound a half-written tree - say what to
  inspect first. A relayed reason whose VALUE already states its action (the
  prose reasons `lib/release-decision.mjs` returns, D-04) still gets a hint here,
  because the check cannot see through the relay and a per-site exemption is not
  a mechanism this phase builds.
- **Verify:** The task-2 file census lists neither `git-publish.mjs` nor
  `release-bump.mjs`. `node
  cadence-core/bin/release-bump.mjs --version 0.0.1 --date notadate` prints a
  non-empty `hint` with `reason` still `bad-date`. `node
  cadence-core/bin/test.mjs git` reports 0 failures.

### Task 6: The read-side seams name their next step

- **Files:** cadence-core/bin/route.mjs, cadence-core/bin/why.mjs,
  cadence-core/bin/skim.mjs
- **Action:** Close every site the check still names in these three files -
  seven at plan time: `route.mjs`'s `unresolved` and `bad-table`, `why.mjs`'s
  `bad-query` and its two `git-failed` refusals, and `skim.mjs`'s
  `line-count-drift` and its computed `no-such-file`/`skim-failed` pair.
  `skim.mjs` already carries two hints (`missing-file`, `unsupported-extension`)
  and they are the wording model for the other two in that file. `why.mjs`'s
  `bad-query` is re-wrapped from `lib/why-query.mjs`'s eight sub-envelope
  returns, which stay out of scope by D-07: the hint goes on the emitting site
  in `why.mjs`, never on the returns. For `bad-table` name the file to repair
  (`route-table.json`) and what makes it valid; for `git-failed` name the
  repository state the command needs.
- **Verify:** `node cadence-core/bin/self-verify.mjs --root .` reports no
  `hintless-refusal` entry naming `route.mjs`, `why.mjs` or `skim.mjs`, and
  every remaining entry names `cadence-core/bin/planning.mjs`. `node
  cadence-core/bin/skim.mjs /nonexistent-abc.mjs` prints a non-empty `hint` with
  `reason` still `no-such-file`, and `node cadence-core/bin/why.mjs ''` prints
  one with `reason` still `bad-query`. `node
  cadence-core/bin/test.mjs routing other` reports 0 failures.

## Notes

- `cadence-core/bin/self-verify.mjs` is declared here and in PLAN-1. That
  overlap is deliberate - its one seam-relay refusal belongs with the eight
  identical arms in task 2 so all nine read the same - and it is one of the two
  reasons these plans run sequentially rather than in parallel.
- Plan-time measurement of the sites this plan closes, after the D-03/D-05/D-06/
  D-07/D-08 exclusions: `review-provider.mjs` 18, `config.mjs` 9, `git-publish.mjs`
  8, `release-bump.mjs` 8, `why.mjs` 4, `route.mjs` 3, `skim.mjs` 2, and one each
  in `git-branch.mjs`, `issue-check.mjs`, `land-cleanup.mjs`, `weight.mjs`,
  `worktree-base.mjs` and `self-verify.mjs` - 59 in all. The check is the
  authority where it disagrees.
- The suite stays red on `self-verify.test.mjs`'s live-tree assertion for the
  whole of this plan. That is expected until PLAN-3's final task; every other
  group must stay green.
