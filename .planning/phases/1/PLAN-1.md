---
phase: 1
plan: 1
requirements:
  - RNG-05
  - RSK-10
files:
  - cadence-core/bin/planning/core.mjs
  - cadence-core/bin/planning/risk-check.mjs
  - cadence-core/bin/planning.mjs
  - cadence-core/bin/lib/arg-contract.mjs
  - cadence-core/bin/risk-diff.test.mjs
  - cadence-core/bin/arg-contract.test.mjs
  - cadence-core/bin/planning-lease-check.test.mjs
  - cadence-core/bin/trace.test.mjs
  - cadence-core/bin/phase-spelling.test.mjs
  - cadence-core/bin/self-verify.test.mjs
---

# Phase 1: A gate refuses the range it could not resolve - Plan 1 of 2 (the seam)

## Goal

## Goal

A partial resolve keeps the end that resolved and names the end that failed,
and no caller hands the blocking `risk_surface` check a range that cannot
match: the staged scope has exactly one machine spelling, and a plan or task
that landed no commits records a skip instead of a clean check over a range
whose two ends are one commit.

## Must be true when done

- In a scratch repository, `planning.mjs risk-check run --phase 1 --base <sha>
  --head no-such-ref` answers `ok:false`, `reason: no-diff`, `base_id` equal to
  that sha, `head_id: null`, and a `detail` that opens with the word `head`;
  the `outcome/risk_check` row it appends reads `checked: false` and carries
  that same cause. The mirror call with an unresolvable `--base` names `base`
  and keeps the head's id.
- `planning.mjs risk-check run --phase <N> --base HEAD --staged` scans the
  index against HEAD and records `staged: true`, `base_id` set and `head_id`
  null; passing `--head` and `--staged` together is refused; `resolveRange` is
  never handed a staged spelling.
- `planning.mjs risk-check status --phase <N> --plan <k> --base <ref> --staged`
  finds the record a staged run left and reports it `recorded`.
- The full suite is green and `npx tsc -p tsconfig.ci.json` is clean.

## Context

- OQ-1 is answered and locked in ROADMAP.md: an explicit `--staged` arm on the
  two `resolveRange` call sites in `risk-check.mjs`, branched BEFORE
  `resolveRange` is reached; `resolveRange` itself learns no staged spelling
  and nothing that is not a ref ever passes `riskRef`. The tree has no
  `risk-check fire` subcommand: the second call site the answer cites by line
  is `cmdRiskCheckStatus`, so the second arm goes there (see Notes).
- The self-comparing range is a CALLER fix per the roadmap: the seam's D-01
  rule that `empty` is decided from the diff body and never from equal ids
  (`lib/risk-diff.mjs`, recalled from v3.5.6 phase 3 UAT) stays as it is,
  because a revert pair has differing ids and an empty net diff.
- Hand-maintained censuses this plan's files sit under, each declared above so
  `lease-check --plan-time` passes: `planning-detail-sites`
  (planning-lease-check.test.mjs:361, 15 sites / 6 wrapped),
  `arg-contract-flag-entries` (arg-contract.test.mjs:423, 199 entries),
  `trace-refusal-sentences`, `phase-spelling-callsites`,
  `self-verify-merge-layers`, and `weight-budgets` (byte CEILINGS; verify.md,
  execute.md, task.md and risk-surface.md sit exactly at theirs today and
  debug.md has 9 bytes of headroom, so every prose task re-pins its entry from
  `node cadence-core/bin/weight.mjs --root .`, whose `surfaces[].bytes` is the
  figure to write).
- Out of scope, flagged in Notes for the human: the fire-receipt seams behind
  `fireIdentity` (core.mjs `--base/--head` guard) stay ref-only; the parallel
  path's range in `references/execute-parallel.md`; `task-record`'s own range;
  `git-guard.md` section 4's generic "at commit time" sentence.

## Tasks

### Task 1: resolveRange resolves each end on its own and names the end that failed

- **Files:** cadence-core/bin/planning/core.mjs (resolveRange), cadence-core/bin/risk-diff.test.mjs, cadence-core/bin/planning-lease-check.test.mjs
- **Action:** Today `resolveRange` runs `--show-toplevel` and both `rev-parse
  --verify <ref>^{commit}` calls inside one `try`, so any failure returns
  `base: '', head: ''` and a resolvable `HEAD` is thrown away beside an
  unresolvable sibling (verbatim 2026-08-30T18:28:50 wrote both ids null).
  Make it resolve the toplevel once, then each end independently through ONE
  shared single-ref resolution that `resolveRange` is built on (so task 3 can
  resolve a lone base without teaching `resolveRange` any staged spelling).
  The return keeps its one flat shape and its `ok:false` whenever either end
  fails, and now: `base` and `head` each hold the full commit id of the end
  that resolved and `''` for the end that did not; `top` holds the toplevel
  when it resolved; `error` OPENS with the name of the end that failed (`base`
  or `head`), followed by that end's spelling and the git message, and names
  both ends, base first, when both fail. A toplevel failure still fails both
  ends with that git message. Keep `redactUrl` around every git message (the
  EXP-01 rail the existing catch states) and keep the `-C top` and
  `^{commit}` arguments exactly as they are. Update the doc comment above the
  function, which currently states the all-or-nothing shape. The callers in
  `adjudication.mjs`, `deferred-record.mjs`, `task-record.mjs` and
  `risk-check.mjs` read `range.ok` and `range.error` and need no change here.
  The `planning-detail-sites` census (planning-lease-check.test.mjs:361) pins
  15 `e && e.message ? e.message : String(e)` sites and 6 wrapped in
  `redactUrl` across the planning seam: keep the idiom at one catch inside the
  shared resolution where you can, and re-pin both numbers and the
  `CADENCE-CENSUS` sentence if they move. Tests go in risk-diff.test.mjs
  (which already imports from `./planning/risk-check.mjs`): drive
  `resolveRange` from a child `node` process whose cwd is a scratch repo built
  with `riskRepo`/`commitFile`, importing `planning/core.mjs` by absolute
  path, because an in-process call would resolve against the test runner's own
  cwd, which is this repository and the wrong one.
- **Verify:** `node --test cadence-core/bin/risk-diff.test.mjs` passes with
  two new rows: with cwd inside a scratch repo holding commit `<sha>`,
  `resolveRange('<sha>', 'no-such-ref')` returns `ok:false`, `base` equal to
  the full sha, `head` equal to `''`, and `error` matching `/^head\b/` and
  containing `no-such-ref`; `resolveRange('no-such-ref', 'HEAD')` returns
  `ok:false`, `base` equal to `''`, `head` equal to HEAD's full sha, and
  `error` matching `/^base\b/`. `node --test
  cadence-core/bin/planning-lease-check.test.mjs
  cadence-core/bin/planning-adjudication.test.mjs
  cadence-core/bin/planning-task-record.test.mjs
  cadence-core/bin/planning-deferred.test.mjs` stays green, and
  `npx tsc -p tsconfig.ci.json` prints no error.

### Task 2: a risk_check that had no diff keeps the resolved end and states its cause on the row

- **Files:** cadence-core/bin/planning/risk-check.mjs (cmdRiskCheckRun), cadence-core/bin/risk-diff.test.mjs
- **Action:** `cmdRiskCheckRun` leaves `baseId` and `headId` null whenever
  `range.ok` is false, and the row it appends on either failure arm (an
  unresolved range, or the `git diff` catch) carries `checked: false,
  inconclusive: true` with NO cause: the redacted message reaches only the
  envelope's `detail`, so the trace reader sees a bare inconclusive it can
  proceed past (smithers 2026-08-27T23:55:38 and 2026-08-28T14:28:12). Make
  the unresolved arm take `baseId` and `headId` from the ids task 1 now
  returns for the ends that resolved (null where the field is `''`), and put
  the cause ON the appended row as well as the envelope, under `detail`, the
  field trace rows already use for a free-text cause (`override`'s reason,
  `uat_verdict`'s result word), on both failure arms with the same redacted
  string the envelope's `detail` carries. A successful run's row gains
  nothing. The envelope keeps `reason: 'no-diff'` and its hint (every refusal
  carries one; `refusal-hints` scans for it). Do not touch `scanDiff`: the
  `checked:false` answer for a non-string body is the state this row is about.
- **Verify:** `node --test cadence-core/bin/risk-diff.test.mjs` passes with
  new rows: `risk-check run --phase 1 --plan 1 --base <sha> --head
  no-such-ref` answers `ok:false`, `reason: 'no-diff'`, `base_id` equal to
  `<sha>`, `head_id: null`, `checked: false`, and `riskRecords(dir)` holds
  exactly one row whose `base_id` equals `<sha>`, `head_id` is null, `checked`
  is false, `inconclusive` is true, `empty` is false, and whose `detail` is a
  non-empty string matching `/^head\b/`; the mirror row with `--base
  no-such-ref --head HEAD` records `head_id` equal to HEAD's sha, `base_id`
  null and a `detail` matching `/^base\b/`; the existing rows at
  risk-diff.test.mjs:577 (an unreadable range still leaves its record) and
  :849 (ids beside spellings) stay green.

### Task 3: risk-check run accepts --base <ref> --staged as the staged scope's one spelling

- **Files:** cadence-core/bin/planning/risk-check.mjs (cmdRiskCheckRun), cadence-core/bin/lib/arg-contract.mjs ('risk-check run' row), cadence-core/bin/arg-contract.test.mjs, cadence-core/bin/planning.mjs (usage header), cadence-core/bin/risk-diff.test.mjs
- **Action:** Add the locked OQ-1 arm to `cmdRiskCheckRun`: `--staged` is a
  bare boolean flag read by presence the way `cmdLeaseCheck` reads
  `opts['plan-time']`, accepted IN PLACE of `--head`. `--head` and `--staged`
  together is a `bad-args` refusal (two spellings of one scope) with a hint;
  neither present is the existing `bad-args`, its message widened to name
  `--staged` as the alternative. `riskRef(opts.base)` still guards the base.
  The branch sits BEFORE `resolveRange` is reached: resolve the base alone
  through the single-ref resolution task 1 factored out of `resolveRange`
  (never `resolveRange` with a stand-in head, and never a staged sentinel
  passed as a ref), then read the diff as `git -C <top> diff --cached
  --no-ext-diff --no-textconv <base id> -- <REVIEWER_TEXT_PATHSPECS>` with
  the same `maxBuffer` and the same catch the ref-range arm uses (task 2's
  cause on the row applies here too). The appended row and the envelope carry
  `head: null`, `head_id: null`, `base_id` set and `staged: true`; ref-range
  rows do not gain a `staged` field (a row written before this arm is honestly
  not staged, unlike the `empty` split D-03 had to mark). In
  `lib/arg-contract.mjs` add `'--staged'` to the `risk-check run` row as a
  boolean with `fallback` on both axes, the shape `--plan-time` and `--replay`
  declare, and flip `'--head'` to `required: false` with a comment stating that
  exactly one of `--head`/`--staged` is the seam's own check, the way `trace
  append` declares `--detail` and `--detail-file` both optional; correct the
  header sentence at arg-contract.mjs:64-65 that uses `risk-check run`'s
  required `--head` as its example (the `--base` half still holds). In
  arg-contract.test.mjs rewrite the pin at :479 to assert the new truth with
  that reason, and re-pin the `arg-contract-flag-entries` census at :423 (199
  becomes 200, in both the assertion and the `CADENCE-CENSUS` sentence).
  Update the `risk-check run` usage lines in planning.mjs's header (:105-116)
  to show `--base <ref> (--head <ref> | --staged)`. Tests in
  risk-diff.test.mjs follow the file's rule that risky fixture constructs are
  assembled (`JWT_CALL`, `MIGRATION_SQL`), never spelled plainly.
- **Verify:** `node --test cadence-core/bin/risk-diff.test.mjs` passes with
  new rows: staging (not committing) a file whose content assembles the auth
  construct, then `risk-check run --phase 1 --base HEAD --staged`, answers
  `ok:true`, `matches` naming `auth`, `staged: true`, `base_id` equal to HEAD's
  sha, `head_id: null`, `head: null`, and `riskRecords(dir)[0]` carries the
  same five fields; the same risky content written to the worktree but NOT
  added answers `matches: []` (only the index counts); an empty index answers
  `checked: true, empty: true`; `--base HEAD --head HEAD --staged` answers
  `ok:false, reason: 'bad-args'` and appends nothing; `--base no-such-ref
  --staged` answers `ok:false, reason: 'no-diff'` with `staged: true` and a
  row carrying task 2's `detail`. `node --test
  cadence-core/bin/arg-contract.test.mjs
  cadence-core/bin/arg-contract-adoption.test.mjs` passes with the census at
  200, and `npx tsc -p tsconfig.ci.json` prints no error.

### Task 4: risk-check status accepts --base <ref> --staged and finds the staged record

- **Files:** cadence-core/bin/planning/risk-check.mjs (cmdRiskCheckStatus), cadence-core/bin/lib/arg-contract.mjs ('risk-check status' row), cadence-core/bin/arg-contract.test.mjs, cadence-core/bin/planning.mjs (usage header), cadence-core/bin/risk-diff.test.mjs
- **Action:** The second call site the OQ-1 answer names by line is
  `cmdRiskCheckStatus`'s range arm. Widen its all-three-or-none rule so the
  named range is `--plan <k> --base <ref>` plus exactly one of `--head <ref>`
  or `--staged`, refusing `bad-args` with a hint when both or neither
  accompany the pair, and keeping the phase-wide arm (none of the four) as it
  is. On the staged spelling resolve the base alone through task 1's
  single-ref resolution before `resolveRange` would be reached, answering the
  existing `unresolved-range` refusal with the end-naming detail on failure,
  and set `wanted` to that plan, the base spelling, `head: null`, the base id,
  `head_id: null` and `staged: true`. Read `staged` off each `risk_check` row
  into `rec` as `e.staged === true`, and make the `sameRange` predicate for a
  staged ask match only a row that is staged and carries the asked base id (a
  ref ask keeps its two-id comparison and cannot match a staged row, whose
  head id is null). Echo `staged` and the null head in the row's `wanted`.
  Leave `settledBy` alone: a receipt spelling for a staged fire is not in this
  phase's decision (see Notes), and a matched staged record therefore reads
  `unfired` exactly as any matched range with no receipt does. Add
  `'--staged'` to the `risk-check status` row in `lib/arg-contract.mjs` in the
  same boolean/fallback shape as task 3, re-pin the census at
  arg-contract.test.mjs:423 (200 becomes 201, assertion and sentence), and
  extend the `risk-check status` usage lines in planning.mjs's header to show
  `[--plan k --base <ref> (--head <ref> | --staged)]`.
- **Verify:** `node --test cadence-core/bin/risk-diff.test.mjs` passes with
  new rows: after a clean `risk-check run --phase 1 --plan 1 --base HEAD
  --staged`, `risk-check status --phase 1 --plan 1 --base HEAD --staged`
  answers `ok:true` with `plans[0].state` equal to `recorded` and
  `plans[0].wanted.staged` true and `wanted.head_id` null; the same status
  call when the plan's only record is a ref-range run answers `ok:false`,
  `reason: 'risk-record-missing'`; `--base HEAD --head HEAD --staged` and
  `--base HEAD --staged` without `--plan` both answer `ok:false, reason:
  'bad-args'`; `--base no-such-ref --staged` answers `reason:
  'unresolved-range'` with a `detail` matching `/^base\b/`. `node --test
  cadence-core/bin/arg-contract.test.mjs
  cadence-core/bin/arg-contract-adoption.test.mjs` passes with the census at
  201, and `npx tsc -p tsconfig.ci.json` prints no error.


## Notes

- No `risk-check fire` subcommand exists (`cmdRiskCheck` dispatches `run` and
  `status` only). The OQ-1 answer names the second call site by line
  (`risk-check.mjs:428`), which is `cmdRiskCheckStatus`, so task 4 puts the
  arm there. Nothing in the tree calls `status` with a staged range today.
- A receipt spelling for a STAGED fire does not exist: every receipt names its
  range on `--base <base> --sha <head>` (triage-gate.md:58) and a staged fix
  has no head commit when the gate fires, so `settledBy` cannot settle a
  matched staged record and task 4 leaves that state `unfired`. Deciding that
  spelling is outside the locked decision; it needs a human call.
- Census holders declared in the frontmatter that no task edits by intent
  (`trace.test.mjs`, `phase-spelling.test.mjs`, `self-verify.test.mjs`) are
  there because `core.mjs`, `risk-check.mjs` and `planning.mjs` are their
  subjects; their counts must simply stay true, and are re-pinned only if a
  task moves one.
- Split by hand from the planner's single PLAN.md on 2026-09-02 at the coordinator's check_size step: that file declared 1,095,062 bytes against the 675,000 ceiling. PLAN-1 carries tasks 1-4 (the seam) and PLAN-2 carries the three prose tasks; the two share no declared file. PLAN-2 depends on PLAN-1's `--staged` arm existing, so it runs after it (sequential is /cad-execute's default). Task text is the planner's, unchanged except renumbering in PLAN-2 and cross-references rewritten to name the plan they point at.
- The `Unreleased` CHANGELOG entry is written at the release bump, not here
  (every prior entry landed in a `chore: bump manifest` commit).
