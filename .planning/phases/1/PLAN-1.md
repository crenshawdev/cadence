---
phase: 1
plan: 1
requirements: [HNT-02]
files:
  - cadence-core/bin/lib/refusal-hints.mjs
  - cadence-core/bin/refusal-hints.test.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
---

# Phase 1: Every refusal names its next step - Plan 1 of 3

## Goal

A refusal site under `cadence-core/bin/` that emits an `ok:false` envelope
without a hint is a reported problem in `self-verify.mjs`, so the invariant is
enforced by a check rather than by remembering. This plan builds and wires that
check and leaves it RED against the tree; plans 2 and 3 are what close it.

## Must be true when done

- `node cadence-core/bin/self-verify.mjs --root .` returns `ok:false` with at
  least one `problems[]` entry of kind `hintless-refusal`, and every such entry
  names a file path and the reason token at that site (AC1).
- Each of those entries points at a real refusal a user can reach: opening the
  named file at the named line shows an `emit`/`out`/`fail` call that emits an
  `ok:false` envelope and carries no `hint`.
- No entry names a comment, a JSDoc block, a `usage` or `internal` refusal, a
  static registry row in `lib/bulk-output.mjs`, `lib/text-transport.mjs` or
  `lib/release-decision.mjs`, `git-guard.mjs`, or a `return {ok:false, ...}` a
  caller re-wraps before emitting.
- The exclusion register lives in the check's own lib file, names every
  exclusion with a one-line reason, and is read as a parameter: a test hands the
  check a substitute register and the reported set changes (AC6).
- The only failing test in the suite is `self-verify.test.mjs`'s live-tree
  assertion `the repo itself passes self-verification`, and it fails ONLY on
  `hintless-refusal` entries. Every other group passes.
- A one-liner that imports the module prints two integers - the in-scope site
  count and the hintless in-scope count - which is the pair AC2 asks the phase
  SUMMARY to state.

## Context

D-02 fixes the population: a site is in scope when it EMITS an `ok:false`
envelope through `emit`, `out` or `fail`, never when it merely contains a field
named `reason`. D-03 excludes the `usage` and `internal` tokens by name, D-05
the three static-registry libs, D-06 `git-guard.mjs`, D-07 the re-wrapped
sub-envelope returns, D-08 strips comments with the tree's own stripper before
matching. D-11 fixes the shape: a new `cadence-core/bin/lib/<name>.mjs`
exporting an `...Issues(root, register = REGISTER)` function, `problems[]`
entries keeping the uniform `{ kind, file, detail }`. The sibling to copy is
`cadence-core/bin/lib/include-consumers.mjs` - its header states the rule, its
`WAIVED` register ships with a reason per row, and `includeConsumerIssues(root,
waived = WAIVED)` is exactly the signature D-11 names.

Out of scope here: any hint text (plans 2 and 3), any `reason` token change, any
edit under `cadence-core/workflows/`, `cadence-core/references/` or
`skills/cad-*-contract/`.

## Tasks

### Task 1: The refusal-hint rule and its exclusion register

- **Files:** cadence-core/bin/lib/refusal-hints.mjs
- **Action:** Create the pure rule behind the new self-verify check, modelled on
  `cadence-core/bin/lib/include-consumers.mjs` (its `CODES`, its `WAIVED`
  register with a reason per row, its `includeConsumerIssues(root, waived =
  WAIVED)` signature, and its "pure rule: no emit, no exit, node builtins only,
  every read guarded" discipline). Export `REGISTER`, a `CODES` object whose one
  code is `hintless-refusal`, and `refusalHintIssues(root, register = REGISTER)`
  returning `{ kind, file, detail }` entries with `file` root-relative and
  `detail` spelled exactly `line <N>: <token>` - the line in the ORIGINAL file,
  and the literal reason token, or the reason expression as written where it is
  not a literal, or `(no reason key)` where the envelope carries none. Pin that
  spelling; PLAN-3's Verify commands parse the line number back out of it. Also export
  a census function - `refusalSites(root, register = REGISTER)` - returning
  every in-scope site with a boolean saying whether it carries a hint, and build
  `refusalHintIssues` on top of it; AC2 asks the SUMMARY for two integers (the
  in-scope count and the hintless count) and nothing else in the tree can answer
  the first.
  The rule: walk `cadence-core/bin/**/*.mjs`, skipping `*.test.mjs` and every
  file the register excludes by name; strip comments with `skim` from
  `./skim.mjs` (D-08 - 28 of the raw hits are comments and JSDoc, and reporting
  them would name design prose the sweep must not edit; `skim` preserves line
  count so line numbers still address the original file); then find each call to
  `emit`, `out` or `fail` not preceded by a `.` or an identifier character, take
  its balanced argument span, and classify it. A call to `emit` or `out` is in
  scope when its argument span contains `ok: false`; a call to `fail` is always
  in scope, since every `fail` wrapper in this tree emits `ok:false`. A site
  counts as hinted when its object literal carries a `hint` key or, for `fail`,
  when the call passes three or more top-level arguments. Exclude by token name
  the tokens the register lists (`usage`, `internal`), reading the token from
  the first positional string literal of `fail(...)` or from a literal `reason:`
  value. A site whose reason is an EXPRESSION rather than a literal
  (`reason: e.seam`, `reason: decision.reason`, `fail(reason, ...)`) stays IN
  scope, because D-02 rejected the kebab-shape regex partly for missing exactly
  those; report the expression text as written where a literal token would go.
  A site with no `reason` key at all - `cadence-core/bin/config.mjs` emits one
  such `ok:false` envelope carrying only `file`, `checked` and `errors` - is in
  scope and its detail says so rather than inventing a token.
  Skip a wrapper's own definition body only by the same rule as everything else:
  `cadence-core/bin/planning.mjs`'s `fail` at `:247` spreads `hint`
  conditionally, so it classifies as hinted with no special case, and the three
  two-argument wrappers correctly report until plan 2 widens them. Never add a
  positional or line-based exemption - the register is the only exclusion
  mechanism, because a per-site exemption is how a check gets silenced rather
  than satisfied.
  The register carries one row per exclusion with a one-line reason: the `usage`
  token (its sibling `detail` already carries the next step, e.g.
  `worktree-base.mjs`'s `'subcommand: resolve [--dir <path>]'`), the `internal`
  token (no user action beyond filing a bug), `git-guard.mjs` (its `reason` is
  the hook payload's `permissionDecisionReason`, already plain prose that names
  the action, and it runs in the PreToolUse hot path), and
  `lib/bulk-output.mjs`, `lib/text-transport.mjs`, `lib/release-decision.mjs`
  (their `reason` fields are static classification rows self-verify READS, never
  envelopes a user sees). The re-wrapped
  sub-envelope returns of `lib/why-query.mjs`, `lib/read-trace.mjs` and
  `lib/trace.mjs` (D-07) get a row EACH, on the same footing as the four file
  rows above: AC6 names them in its enumeration of what the register must carry,
  and they are excluded by the same structural fact those four are - they
  `return` an object rather than emit one - so keeping a row for one group and
  refusing it for the other reads to a later reader as an oversight rather than
  a decision. Record in the header that all seven file rows are documentary
  today - none of them calls `emit`, `out` or `fail`, so the rule excludes them
  structurally as well - and state WHY each row is kept anyway: a later reader
  must be able to tell a deliberate exclusion from an oversight.
- **Verify:** `node --input-type=module -e "import {refusalHintIssues,
  refusalSites} from './cadence-core/bin/lib/refusal-hints.mjs'; const
  i=refusalHintIssues('.'); const s=refusalSites('.'); console.log(s.length,
  i.length, i.filter(x=>/planning\.mjs/.test(x.file)).length,
  i.some(x=>/git-guard|bulk-output|text-transport|release-decision/.test(x.file)),
  i.some(x=>/usage|internal/.test(x.detail)));"` prints an in-scope site count
  above 200, an issue count above 200, a `planning.mjs` share above 100, and
  `false` for both of the last two. Every entry has a non-empty `file` and a
  `detail` naming a line number.

### Task 2: Wire the rule into self-verify as its next numbered check

- **Files:** cadence-core/bin/self-verify.mjs
- **Action:** Import `refusalHintIssues` beside the other rule modules and call
  it in `run(root)` alongside `includeConsumerIssues(root)`, pushing each issue
  into `problems`. Add the check to the numbered register in this file's header
  in the same voice as its neighbours - what it checks, why it exists, and the
  measurement behind it (186 `reason:` sites against 13 hints on 2026-08-23,
  130 against 10 when #238 was filed, every hint confined to `planning.mjs` and
  `skim.mjs`) - and state that the rule, its register and the reason each
  exclusion is kept live in `lib/refusal-hints.mjs`, with this side deciding only
  that it applies to the whole root. Take the NEXT unused number: the header
  register runs to check 21 (`21. per-run scratch`), so this is check 22.
  CONTEXT D-11's parenthetical "18 as the series stands" is stale and 22 is what
  honours the decision it states. Note in the entry that the module takes no
  `CONTRACTS` row, for the reason check 14 states about `lib/*.mjs`. Append
  `refusal-hints` to the `checked:` string in the `emit` at the foot of the file.
  This commit is EXPECTED to turn `self-verify.mjs` red and to turn
  `self-verify.test.mjs`'s live-tree assertion red with it. That red is AC1's
  deliverable and the reason this plan is ordered first. Do NOT close it here, do
  not narrow the rule to shrink it, and do not touch the live-tree assertion -
  plans 2 and 3 close it by writing the hints.
- **Verify:** `node cadence-core/bin/self-verify.mjs --root . | python3 -c
  "import json,sys; r=json.load(sys.stdin); p=[x for x in r['problems'] if
  x['kind']=='hintless-refusal']; o=[x for x in r['problems'] if
  x['kind']!='hintless-refusal']; print(r['ok'], len(p), len(o),
  'refusal-hints' in r['checked'], all(x['file'] and x['detail'] for x in p))"`
  prints `False`, a `hintless-refusal` count above 200, `0` other problems,
  `True` and `True`. Opening the file and line named by any three entries shows
  an `emit`/`out`/`fail` call emitting `ok:false` with no `hint`.

### Task 3: Fixture tests for the rule, including the injected register

- **Files:** cadence-core/bin/refusal-hints.test.mjs
- **Action:** Write the rule's own tests against synthetic roots, the way
  `cadence-core/bin/include-consumers.test.mjs` does, leaving the CLI wiring and
  the live-tree assertion to `self-verify.test.mjs`. Cover, each as its own
  named test: a two-argument `fail('token', detail)` is reported and a
  three-argument one is not; an `emit({ok:false, reason})` object literal is
  reported and one carrying a `hint` key is not; an `emit({ok:true, ...})` is
  never reported; a `usage` and an `internal` refusal are not reported; a
  refusal sitting inside a `//` comment or a `/** */` block is not reported,
  which is the D-08 case; a site whose `reason` is an expression rather than a
  literal IS reported with the expression named in the detail; a site emitting
  `ok:false` with no `reason` key is reported and its detail says so; a
  `*.test.mjs` file under the fixture's bin directory is not walked; a file the
  register excludes by name contributes nothing even when it holds a hintless
  refusal; and an absent or unreadable `cadence-core/bin` under the fixture root
  reports nothing rather than throwing, the partial-fixture degradation
  `lib/include-consumers.mjs` and `lib/deferred-reads.mjs` both use.
  The load-bearing one is AC6: a test passes a SUBSTITUTE register - one that
  excludes a token the shipped register does not - to `refusalHintIssues` and
  asserts the reported set shrinks by exactly that token's sites, proving the
  check reads the register parameter rather than a hard-coded list. Assert the
  reported line number equals the line in the ORIGINAL fixture source, with a
  comment block above the refusal, so a stripper that shifted lines reddens
  here.
- **Verify:** `node --test cadence-core/bin/refusal-hints.test.mjs` passes with
  0 failures. Deleting the `register` parameter's use inside
  `refusalHintIssues` and hard-coding the shipped list makes the substitute-
  register test fail.

### Task 4: The CLI-wiring assertions for check 22

- **Files:** cadence-core/bin/self-verify.test.mjs
- **Action:** Add the CLI-side tests for the new check in the same place and
  shape as the file's other per-check tests: build a fixture root through the
  existing `fixture(...)` helper (or the narrowest sibling that already writes a
  `cadence-core/bin` tree), plant one hintless refusal and one hinted refusal in
  a `.mjs` under it, and assert `run(['--root', root]).problems` contains a
  `hintless-refusal` entry naming the hintless file and none naming the hinted
  one. Add a second test asserting the `checked` string returned by the CLI
  names `refusal-hints`, matching how the file already pins other wiring.
  Leave the live-tree test `the repo itself passes self-verification` exactly as
  it is. It is EXPECTED to fail from this commit until plan 3's final task, and
  that failure is the AC1 evidence; weakening it, skipping it or filtering
  `hintless-refusal` out of it would delete the only thing proving the check
  reaches the shipped tree.
- **Verify:** `node cadence-core/bin/test.mjs prose` reports exactly one failing
  test, `the repo itself passes self-verification`, and its assertion output
  lists only `hintless-refusal` kinds. `node --test
  cadence-core/bin/self-verify.test.mjs 2>&1 | grep -c "^not ok"` prints `1`.
  `node cadence-core/bin/test.mjs routing git planning review` reports 0
  failures.

## Notes

- Plan ordering is PLAN-1 then PLAN-2 then PLAN-3, sequential. This plan leaves
  the tree deliberately red, which is the CONTEXT plan-shape directive's stated
  reason for the split ("the check must be demonstrated failing against the tree
  before the sweep closes it"). PLAN-2 declares `cadence-core/bin/self-verify.mjs`
  as well, for the one seam-relay refusal in its entry block that belongs with the
  eight identical arms in the other CLIs; that shared file is a second reason
  these two plans cannot run in parallel.
- AC1 stays reproducible after the sweep closes it: `git worktree add <dir>
  <pre-sweep-sha>` and then `node cadence-core/bin/self-verify.mjs --root <dir>`
  runs the FINISHED check against the tree as it stood before the hints, because
  `--root` names the tree being linted and not the script being run.
- The CONTEXT flagged assumption that D-02's emitting-call rule "is the hardest
  of the three candidate rules to implement" is retired at plan time: a balanced-
  bracket scan over comment-stripped source classified all 276 candidate calls in
  about forty lines, and the per-file counts in these three plans come from that
  scan. No fallback toward a shape rule is needed.
- Measured 2026-08-23 at plan time, after the D-03/D-05/D-06/D-07/D-08
  exclusions: 241 in-scope sites, 27 already hinted, 214 hintless - 155 of them
  in `planning.mjs` (PLAN-3) and 59 across the other twelve CLIs (PLAN-2). The
  186/13 figures in ROADMAP.md and REQUIREMENTS.md counted one spelling and stand
  as provenance, exactly as D-01 says.
