---
phase: 1
status: complete
completed: 2026-08-16
---

# Phase 1: One transport for caller-derived text - Summary

A file-path transport for every seam flag that carries caller-derived free
text (`lib/text-flag-file.mjs`, five new `--<field>-file` flags), the rule
stated once in `references/conventions.md`, and a committed 36-row register
that `self-verify` check 19 reads so the seventeenth inline site is refused.

## What shipped

- One reader behind every `--<field>-file` flag, with four refusals (valueless
  flag, unreadable path, empty file, both forms given) - `cadence-core/bin/lib/text-flag-file.mjs`
- Five file-transport flags: `trace append|close --detail-file`, `trace append
  --read-file`, `uat record --fields-file`, `milestone-prune --label-file`,
  `cursor set --next-file` - `cadence-core/bin/planning.mjs`
- The transport rule stated ONCE, with the derivation test - `cadence-core/references/conventions.md:76` (`## Caller-derived text`)
- The register: 36 rows, 20 caller-derived and 16 out of scope with a reason
  each - `cadence-core/bin/lib/text-transport.mjs` (`TEXT_TRANSPORT`)
- The check that reads it: `self-verify` check 19 `text-transport`, three codes
- 13 prose surfaces converted to the file transport across `workflows/`,
  `references/` and `skills/`; `git tag -a <version> -F <path>` at the tag site

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 2524fb9 | One file transport for caller-derived text, wired through `trace --detail-file` |
| 1 | 2 | 01bd5bc | `trace append --read-file` on the same comma grammar |
| 1 | 3 | c354ff0 | `uat record --fields-file` for the five free-text fields |
| 1 | 4 | 7bfe9f5 | `milestone-prune --label-file`, both label terms unchanged |
| 1 | 5 | b7ad086 | `cursor set --next-file`, with the four-line cursor refused a newline |
| 2 | 1 | ca55f45 | The register of caller-derived text sites, and the check that reads it |
| 2 | 2 | 7c8ec1d | The transport rule, stated once in `conventions.md` |
| 2 | 3 | b912d06 | The review and planning dispatch sites on the path transport |
| 2 | 4 | f5d8195 | The execute, context and verify-deep closes on the path transport |
| 2 | 5 | 01a6a9a | A failing item's free text rides one `--fields-file` |
| 2 | 6 | 5a33ea8, 76cae93 | The milestone label reaches both sites as a path; the tag site cites the rule |
| 2 | 7 | 7d95784 | The two composed cursor pointers, and the tree held clean |

## Deviations

- [deviation] Plan 2 task 1's `Verify:` asserts the suite still exits 0 at that
  commit. It cannot: `self-verify.test.mjs:210` asserts `problems: []` on the
  live tree while AC3 requires `self-verify` to exit 1 at exactly that SHA.
  Exactly one test failed there, on precisely the 21 watched sites - the red
  suite IS the watched FAIL. The plan's own `## Notes` concede it ("CI will be
  red at that one SHA by design; the branch tip is green"). Cleared at task 7.
  (ca55f45)
- [deviation] Plan 2 task 3 could not meet its `Verify:` from inside the plan's
  original lease: the trace census parser (`trace.test.mjs:1281-1288`) read
  `--read` in the inline spelling only, so the two converted `--read` sites
  parsed as `null` and the "every dispatch names what it caused" assertion
  failed. Checkpointed structural; the user approved alternative (a) -
  `cadence-core/bin/trace.test.mjs` was added to plan 2's `files:` lease and the
  one-line fallback `flag(line, 'read', true) ?? flag(line, 'read-file', false)`
  landed in task 3's commit with the reason as a comment. (b912d06)

## Open items

- The shared reader returns ONE shape (`{ok, value, detail}`) rather than an
  `ok`-discriminated union: the union is a TS2339 at the first call site under
  this repo's `strict: false` CI typecheck. Measured, not assumed.
- `cursor set`'s newline refusal is applied to the RESOLVED value, so it also
  narrows the inline `--next`. No shipped site passes a multi-line pointer, so
  nothing in the tree changes behaviour - recorded because it narrows an inline
  form the plan otherwise leaves untouched.
- The `$(...)`/backtick verbatim arm is asserted per flag for `--detail-file`,
  `--fields-file` and `--next-file`, and once in the module's unit test for the
  shared reader; not repeated for `--read-file` and `--label-file`.
- Declined a `transport: 'inline'|'file'` field on the register rows - the
  invariant is proved by check 19 passing on the live tree, not restated in a
  field nothing reads. Add it if a task ever needs the distinction from the
  register alone.
- Declined an env-var override for the register; the CLI-wiring tests reach the
  `inline` kind by writing synthetic prose at a REGISTERED path, which proves
  the CLI reads the SHIPPED register rather than a fixture's copy.
- `cadence-core/workflows/execute.md:408-409` and `skills/cad-capture/SKILL.md:43-45`
  restate the transport reasoning at the site (both converted before this
  phase). Folding them onto the `conventions.md` citation would make the tree
  uniform.
- The NUL-byte check (15) caught two literal U+0000 bytes a file write put into
  `cadence-core/bin/text-transport.test.mjs:70` - check 15 is load-bearing
  against tooling, not only against authors.
- No lint command exists for this project: `planning.mjs detect-commands`
  returns `lint: null`. The typecheck (`npx tsc -p tsconfig.ci.json`) is clean.

## Goal check

The thirteen commits deliver the goal. The transport exists and is one reader:
`cadence-core/bin/lib/text-flag-file.mjs` resolves all five new
`--<field>-file` flags and owns the four refusals, so no flag re-derives them.
The rule is stated once and not restated - `references/conventions.md:76` holds
`## Caller-derived text`, and a tree-wide `grep -rn 'trace close .*--detail "'`
over `workflows/`, `references/` and `skills/` now returns nothing. The
enumeration success criterion 2 demands is committed and machine-readable, not
prose: `TEXT_TRANSPORT` in `cadence-core/bin/lib/text-transport.mjs` carries 36
rows of which 20 are `derived: true`, each out-of-scope row carrying its reason,
which is what lets a reviewer check the classification rather than trust the
roughly-sixteen estimate the phase inherited. The check refusing the
seventeenth site is live and green on the real tree: `node
cadence-core/bin/self-verify.mjs` exits 0 with `text-transport` in its
`checked` list and `problems: []`, and it was watched FAILING first at ca55f45
with 21 problems across 13 real surfaces (no fixtures), which is the evidence
that the check can fail rather than merely pass. The full suite is 1996 of 1997
passing, 0 failing, 1 skipped. Nothing in the goal looks unmet. Two things a
verifier should press on rather than take from me: the register's 16
out-of-scope classifications are the phase's own judgment about which values
are caller-derived, so a wrong row there is invisible to a green check 19; and
`--phase`-style literal sites were deliberately excluded, so the check proves
no site it does not know about.
