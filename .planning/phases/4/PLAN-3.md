---
phase: 4
plan: 3
requirements: ["#50"]
files: ["cadence-core/bin/git-guard.mjs", "cadence-core/bin/git-guard.test.mjs"]
---

# Phase 4: renumber & git-guard hardening - Plan 3 (git-guard)

## Goal

`git-guard` joins backslash line-continuations before it parses subcommands, so
a wrapped `git \`+newline+`push` reaches the push rail as the push it is - and
the join runs ahead of the quote-strip, so a `git push` buried in a
backslash-continued quoted string still produces no prompt.

## Must be true when done

- A PreToolUse payload whose command is `git \`+newline+`  push origin main`
  produces byte-identical output to the unwrapped `git push origin main`: the
  `ask` decision with the rail-3 reason.
- The same holds with `\r\n` line endings.
- A wrapped `git \`+newline+`commit -m "x"` on a protected branch asks, exactly
  as the unwrapped form does - both rails agree on what a wrapped command IS.
- A command whose only `git push` text sits inside a backslash-continued quoted
  string produces NO prompt (today it wrongly asks), and
  `git stash \`+newline+`push -m wip` still resolves to `stash`, not `push`.
- No shell shape CLASS becomes newly recognized: backtick substitution,
  heredocs and the rest stay unparsed (D-16). The one accepted widening inside
  the backslash case is that repairing a continued quoted string can make a
  command whose quoted text contains `git push` (e.g. `echo "a \`+newline+`b"
  git push "c"`) prompt where it was silent - the fail-safe direction (an extra
  ask, never a missed push), and the price of D-08's ordering.
- The join must not merge two separate commands: a trailing-backslash line
  followed by a blank or whitespace-only line still parses as TWO commands, so
  a `git push` on the second line is still caught.
- #50's git-guard arm has at least one test that fails on the pre-fix code and
  passes after it, and all three CI gates pass:
  `node --test cadence-core/bin/*.test.mjs`,
  `node cadence-core/bin/self-verify.mjs`, `npx tsc -p tsconfig.ci.json`.

## Context

Locked decisions bind this plan: D-07 (joining continuations in
`gitSubcommands` necessarily makes a wrapped `git \`+newline+`commit` on a
protected branch start prompting too, and that is ACCEPTED rather than gated to
the push path - scoping the join to push detection would leave the two rails
disagreeing about what a wrapped command is, the exact inconsistency the issue
frames the fix as closing), D-08 (the join runs on the raw command AHEAD of the
existing quote-stripping; order is load-bearing - the double-quote pattern
`"(?:[^"\\]|\\.)*"` cannot match a quoted string containing a backslash-newline,
so joining afterward would splice quoted text into a command word and
manufacture a `git push` the user never wrote), D-15 (the regex is
`/\\\r?\n\s*/g`, the same idiom `self-verify.mjs` carries), D-16 (scope stays
the backslash case - backtick substitution, heredocs and the rest remain
deliberately unrecognized). Out of scope: `cadence-core/references/git.md` needs
no edit (rail 3's "Every Bash `git push` the guard sees still asks
unconditionally" stays true, and the file is outside the measured surface set
anyway), the known v1.2.0 by-design holdout of `git-guard`'s config fail-open,
and the other two slices (renumber in PLAN-1, `self-verify.mjs` and
`surface-weight.mjs` in PLAN-2 - `self-verify.mjs:205`'s CRLF widening belongs
to PLAN-2, which owns that file; this plan must not open it).

Every new test must be verified failing-capable against the pre-fix code (stash
or revert the source hunk, run the test, see it fail) - not merely passing. A
prior cycle shipped an assertion that passed unpatched (`.planning/CAPTURE.md`,
phase 2; `.planning/phases/2/SUMMARY.md`).

## Tasks

### Task 1: Join backslash continuations before the quote-strip (#50)

- **Files:** cadence-core/bin/git-guard.mjs
- **Action:** In `gitSubcommands` (git-guard.mjs:70-76) insert
  `.replace(/\\\r?\n[ \t]*/g, ' ')` as the FIRST link of the existing replace
  chain, before `.replace(/"(?:[^"\\]|\\.)*"/g, ' ')` and the single-quote
  strip. The trailing class is `[ \t]*`, NOT `\s*` (see the D-15 deviation in
  Notes): `\s` matches `\n`, so `\s*` would swallow the newline that ENDS the
  continued command and splice the NEXT command onto it. Measured on this tree
  with both spellings: `git add -A \`+newline+newline+`git push origin main`
  (two real commands - bash runs the push) yields `['add','push']` today and
  `['add']` under `\s*`, because the word scan stops at the first non-option
  word after the first `git`. That is a NEW push-rail bypass created by the fix
  meant to close one, and `git commit -m "wip" \`+newline+`   `+newline+`git
  push` bypasses the same way. `[ \t]*` keeps all five wrapped cases below
  identical and leaves both bypasses caught. Order is the fix too: the
  double-quote pattern's `\\.` arm
  cannot match a backslash-newline, so a quoted multi-line string survives the
  strip, the `\n` in `split(/&&|\|\||[;|\n]/)` then cuts it, and the tail reads
  as a bare command - which is why `echo "foo \`+newline+` git push bar"` prompts
  today (reproduced live). Joining first collapses that string onto one line so
  the strip removes it whole (D-08). Replace with a single space, matching
  `self-verify.mjs`'s join idiom (D-15 - PLAN-2 Task 3 tightens that seam's
  class to `[ \t]*` in the same pass, so the two seams stay ONE idiom); the
  accepted cost is that a
  continuation splitting a word mid-token (`gi\`+newline+`t push`) yields two
  words and the guard stays silent - conservative, which is this file's stated
  design. Do not scope the join to the push path: the commit rail widens with it
  by design (D-07). Do not add any other shell shape - backtick substitution,
  heredocs and the rest stay unrecognized (D-16). Update the function's block
  comment (:60-66) to record that continuations are joined first, that the
  order is what keeps a quoted multi-line string from manufacturing a phantom
  push, and that the commit rail widens with the push rail deliberately.
- **Verify:** feeding the hook
  `{"tool_input":{"command":"git \\\n  push origin main"},"cwd":"<a git repo
  with a .planning dir>"}` on stdin prints the same `permissionDecision:"ask"`
  JSON as the unwrapped command (empty output before the change), and
  `npx tsc -p tsconfig.ci.json` passes.

### Task 2: Pin the wrapped rails and the shapes that must stay silent

- **Files:** cadence-core/bin/git-guard.test.mjs
- **Action:** Add six tests to `git-guard.test.mjs` using the existing
  `project()` and `guard()` helpers, written with real backslash-newline bytes
  in the command strings (`'git \\\n  push origin main'`). (1) A wrapped push
  reaches the push rail: on `project('feature')`, assert the wrapped decision
  deep-equals the unwrapped `guard('git push origin main', p)` decision - equal
  decisions, not just both `ask`, so a future divergence in the reason string is
  caught too. (2) CRLF: `'git \\\r\n push origin main'` on `project('feature')`
  deep-equals the unwrapped `guard('git push origin main', p)` decision, same
  as test 1 - assert the whole decision, not just `permissionDecision ===
  'ask'`, or an implementation that reaches `ask` by a different rail with a
  different reason string still passes (D-15). (3) The commit rail widens with
  it (D-07): `'git \\\n commit -m "x"'` on `project('main')` yields `'ask'` with
  a reason matching `/protected/`. (4) The ordering guard (D-08):
  `guard('echo "foo \\\n git push bar"', project('main'))` is `null` - name the
  test for the false positive it closes, since this shape prompts on today's
  code. (5) Conservative shapes hold: `'git stash \\\n push -m wip'` on
  `project('main')` is `null` (a wrapped stash is still a stash, not a publish);
  name it a regression guard in a comment - it holds identically pre- and
  post-fix, so it is not evidence the fix works. (6) The join must not swallow
  the command separator: `guard('git add -A \\\n\ngit push origin main',
  project('feature'))` deep-equals the unwrapped push decision, and
  `guard('git commit -m "wip" \\\n   \ngit push', project('feature'))` yields
  `'ask'` - two real commands where the second IS a push, caught today and
  caught after. This is the test that pins `[ \t]*` over `\s*`; name it for the
  bypass it closes. Do not add a test asserting any newly recognized shell shape (D-16), and do
  not weaken the shipped tests at :119-133 - `git stash push`, `git log --grep
  "push"`, `echo "git push"` and the global-option skip must all stay green.
- **Verify:** `node --test cadence-core/bin/git-guard.test.mjs` passes; tests
  1-3 fail on pre-fix code (the wrapped forms return `null` - verified live),
  test 4 fails on pre-fix code the other way (it currently returns an `ask`
  decision for an `echo`), and test 6 fails on the `\s*` spelling of the join
  (it returns `null` there) while passing both pre-fix and with `[ \t]*`.
  Test 5 is a REGRESSION GUARD, not a failing-capable test: `git stash
  \`+newline+`push` resolves to `['stash']` before AND after the fix, so it
  passes unpatched by design - do not record it as demonstrating pre-fix
  failure.

## Notes

- Verified live on this tree before planning: wrapped push, wrapped commit,
  CRLF-wrapped push and `git stash \`+newline+`push` all return empty output
  today, while `echo "foo \`+newline+` git push bar"` returns an `ask`. Tests
  1-3 are therefore failing-capable and test 4 fixes a live false positive.
  Test 5 is NOT failing-capable (it returns `null` both before and after) - it
  is a regression guard, corrected here after the `plan` review found the
  original claim overstated; three reviewers converged on it.
- **DEVIATION from D-15 (whitespace class only, surfaced for the record).**
  D-15 locks the join regex as `/\\\r?\n\s*/g` in both `git-guard.mjs` and
  `self-verify.mjs:205`. Its two substantive requirements - the `\r?` CRLF
  widening, and the two seams sharing ONE idiom rather than two spellings - are
  honored in full. Only the trailing whitespace class changes, `\s*` ->
  `[ \t]*`, in BOTH seams together (this task and PLAN-2 Task 3), because `\s`
  matches `\n` and a continuation join that eats the following newline merges
  two independent shell commands. Measured on this tree: `git add -A
  \`+newline+newline+`git push origin main` is caught today (`['add','push']`)
  and goes SILENT under `\s*` (`['add']`) - the `\s*` spelling would open a
  push-rail bypass in the same change that closes one. `[ \t]*` leaves all five
  originally planned cases byte-identical, closes both bypass shapes, and also
  removes a second new false positive (`git \`+newline+newline+`push` asks
  under `\s*`, stays silent under `[ \t]*`). A backslash-continuation is by
  definition followed by same-line whitespace, never by another newline, so the
  tighter class is also the more accurate reading of what a continuation is.
