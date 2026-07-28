---
phase: 3
plan: 1
requirements: [TOK-01]
files:
  - cadence-core/bin/lib/shell-tokens.mjs
  - cadence-core/bin/shell-tokens.test.mjs
  - cadence-core/bin/git-guard.mjs
  - cadence-core/bin/git-guard.test.mjs
  - cadence-core/references/git.md
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
  - README.md
  - INTERNALS.md
  - DESIGN.md
  - CHANGELOG.md
---

# Phase 3: One quote-state tokenizer for git-guard - Plan

## Goal

The rail-3 push guard sees a real `git push` through a quoted `-C` path with a
space, an `&` separator, `$(...)`, backticks, a subshell, an escaped `\"`,
`bash -c "..."` and `eval "..."` - closed by one left-to-right quote/escape-state
tokenizer that both rails read, with the grammar and its out-of-grammar list
written down in `references/git.md` and the shipped "I deleted the parser"
claims moved with it.

## Must be true when done

- Each of the seven silent shapes - `git -C "my repo" push origin main`,
  `git add -A & git push origin main`, `$(git push origin main)`,
  `` `git push origin main` ``, `(git push origin main)`,
  `echo \" ; git push origin main; echo "done"`, and
  `bash -c "git push origin main"` (with `sh -c`, `zsh -c`, `dash -c`, `eval`,
  the prefixed forms `sudo`/`timeout`/`nohup`/`xargs`/`/usr/bin/env`, the
  concatenating `eval "git" "push origin main"`, and `bash -c $'git push'` in
  the same row set) - fed to `git-guard.mjs` on a protected branch
  returns a `permissionDecision` of `ask`, where HEAD returns empty stdout for
  every one of them.
- The shipped silence and false-positive cases still return no decision:
  `echo "git push"`, `git log --grep "push"`, `echo "foo \` + newline +
  ` git push bar"`, `echo "it's just git push text"`, `git stash push -m wip`,
  `git add . # git push` (silent at HEAD; retiring the `break` would otherwise
  turn it into a NEW false ask), and the even-backslash continuation case's
  first half; and the shapes
  that ask today (`xargs -I{} git push origin main`,
  `GIT_SSH_COMMAND=x git push origin main`, `git -C . -c user.name=t push`)
  still ask. The `awk -F'"'` alternation belongs to the ASKING set, not this one:
  `git-guard.test.mjs:198` asserts `permissionDecision === 'ask'` because a real
  `; git push origin main` sits beside the awk word, and both odd- and
  even-parity continuation rows likewise assert a push is seen. (An earlier draft
  of this bullet had the awk row backwards; a cross-model reviewer read the draft
  and flagged task 1 as the error - task 1 was right, this line was wrong.)
- A command carrying a git word the tokenizer cannot place (an unterminated
  quote around `git push origin main`) returns `ask`; an unresolvable command
  with no git word (`echo "unterminated`, `eval $CMD`) returns no decision.
- `bash -c "git commit -m x"` on a protected branch returns `deny` under
  `git.on_protected: refuse` and `ask` under `ask`, byte-identical to what the
  bare `git commit -m x` form returns for the same config.
- `cadence-core/references/git.md` states the tokenizer grammar (quote and
  escape state, the separator set, substitution/subshell descent, the wrapper
  set, the git-word rule, the unplaced-git ask) and names heredocs, `<<<`,
  `$'...'` and `${...}` nesting inside `$()` as out-of-grammar, and every named
  out-of-grammar shape has a row in `shell-tokens.test.mjs` asserting the
  behavior git.md states for it.
- No shipped surface still claims Cadence's push guard parses nothing:
  `README.md`, `INTERNALS.md` and `DESIGN.md` distinguish the deleted
  allow-list predicate (`isPlainPush`) from this detection widener, and
  `self-verify.mjs`'s shared-idiom comment plus its test name describe a rule
  that both files actually carry.
- `node --test cadence-core/bin/*.test.mjs`, `npx tsc -p tsconfig.ci.json` and
  `node cadence-core/bin/self-verify.mjs` are all green (no `budget-overrun`),
  with the new grammar rows for the four behavior truths above among the
  passing set.

## Context

`.planning/phases/3/CONTEXT.md` is locked; read it first - D-01..D-14 bind every
task here. The strip-and-split arms at `git-guard.mjs:81-114` and the
parity-aware continuation pre-pass at `:84-99` are DELETED, not extended (D-01,
D-06): regex accretion is what produced phase 4's own two push-rail regressions
(`.planning/CAPTURE.md`, phase 4). The tokenizer is a pure, total lib module
(D-07) on the `lib/publish-decision.mjs` / `lib/branch-decision.mjs` pattern -
`git-guard.mjs:182` runs `main()` at module top level, so the hook itself can
never be imported for testing. Both rails read the same tokenizer output (D-04,
preserving phase-4 D-07). Out of scope: the `git-guard.mjs` fail-open on a
malformed `.planning/config.json`, the unthreaded `mergeLayers` `warnings[]`,
any edit to the `[1.3.1]` CHANGELOG entry (D-14), any `CONTRACTS` entry for the
hook (D-10), and any rail-1/rail-2 semantic change beyond what the shared
tokenizer output implies.

## Tasks

### Task 1: The tokenizer core in a pure lib module

- **Files:** cadence-core/bin/lib/shell-tokens.mjs, cadence-core/bin/shell-tokens.test.mjs
- **Action:** Create `cadence-core/bin/lib/shell-tokens.mjs` with `// @ts-check`,
  node builtins only, pure and total (no I/O, no live git, never throws, no
  unbounded loop) - the `lib/publish-decision.mjs` discipline, stated in a header
  comment that also states what this module IS: a *detection widener* that fails
  toward asking, never an allow-list predicate and never a security boundary
  (D-08's distinction, needed here before the docs task can cite it).
  Export two functions.
  (1) `tokenizeCommand(text)` returns `{ commands, unplaced }`, where `commands`
  is an array of simple commands in left-to-right order and each simple command
  is an array of word strings, INCLUDING the commands found inside descended
  regions; `unplaced` is a boolean. One single left-to-right pass carries exactly
  one quote state (outside / single / double) - never a strip, never a second
  pass, which is the two-mechanism defect D-06 names.
  Rules: unquoted space/tab/CR ends the current word; a word that was opened by a
  quote exists even when empty (so `git -C "" push` keeps three words and the
  `-C` argument skip below still lands on `push`); the separator set at outside
  state is `;`, `\n`, `|`, `||`, `&&` and `&` (the missing `&` is hole (b)), each
  ending the current simple command; redirection operators (`>`, `<`, `2>`,
  `<<`, `<<<`) carry no meaning and are ordinary word characters.
  Outside quotes a backslash escapes the next character - the escaped character
  is appended literally and can never be read as a separator, quote or
  substitution opener - and backslash-newline (or backslash-CRLF) is a line
  continuation where both characters are consumed, nothing is appended, and the
  word does NOT end; this yields the odd/even parity behavior of
  `git-guard.test.mjs:176-188` as a consequence rather than as a pre-pass, since
  `\\` appends one literal backslash and leaves the newline a live separator.
  A single-quoted span honors no escapes: every character up to the next `'` is
  content. A double-quoted span honors backslash before exactly `"`, `\`, `$`,
  backtick and newline (that last one a continuation: both consumed, nothing
  appended - this is what keeps `echo "foo \` + newline + ` git push bar"` one
  word and silent, `git-guard.test.mjs:155-160`); any other backslash inside
  double quotes is literal backslash plus the following character. Inside double
  quotes `$(` and backtick still open substitutions; `'` and `(` are ordinary
  content.
  Descent (D-11): `$(` at outside or double-quoted state scans to its matching
  `)` counting nested `(`/`)` pairs at outside state and honoring quote state
  within, and its contents are tokenized as their own command list appended to
  `commands`; a backtick region runs to the next unescaped backtick, same
  treatment; an unquoted `(` in COMMAND POSITION (the current word has not
  started) opens a subshell group closed by its matching `)`, same treatment, so
  `(git push origin main)` and `( git push )` behave identically instead of
  turning on incidental whitespace. A descended region contributes NOTHING to
  the enclosing word. A `$` not followed by `(` is ordinary content, with ONE
  exception: `$'` at outside state opens a single-quoted span and the `$` is
  DROPPED (ANSI-C quoting), so `bash -c $'git push origin main'` re-tokenizes to
  a real `push` instead of the word `$git`; the span's escape sequences (`\n`,
  `\t`) are NOT interpreted - it is literal content like any single-quoted span,
  and git.md states exactly that bound. Without this rule the shape is a
  documented SILENT real push sitting beside the claim that wrapped pushes are
  seen (review: cad-reviewer).
  `#` is a COMMENT when it opens a word at outside state: it and everything up to
  the next newline are discarded, and that newline still separates. A `#` inside
  a word (`file#1`) is ordinary content. Without this rule, retiring the `break`
  below turns `git add . # git push` - silent at HEAD, verified against
  `git-guard.mjs:105-111` - into a NEW false ask, the one class of regression
  this phase must not introduce (review: cad-reviewer).
  Cap descent
  depth at 8; at the cap do not descend - instead set `unplaced` when the
  undescended region's raw text holds a whitespace-delimited token equal to `git`
  or ending in `/git`, so a pathological nest fails toward asking rather than
  going silent or looping. The cap is a BUDGET the caller threads through, not a
  counter local to one `tokenizeCommand` call: task 3's wrapper re-tokenization
  is a FRESH call per operand, so a per-call counter restarting at 0 bounds
  nothing about wrapper nesting (review: cad-reviewer). Give `tokenizeCommand` an
  optional depth argument defaulting to 0, and have every recursive and
  re-entrant call pass the current depth + 1.
  End of input inside an open region closes it implicitly (emit what accumulated)
  and sets `unplaced` when that region's RAW text holds a `git`/`*/git` token -
  this is D-03's rule and the reason `echo "git push origin main` (unterminated)
  differs from `echo "unterminated`.
  (2) `gitSubcommands(text)` returns `{ subs, unplaced }`: run `tokenizeCommand`,
  then for each simple command scan its words left to right; a word is a git word
  when it equals `git` or ends with `/git` (word content, so the single word
  `git push` produced by `echo "git push"` is not one - D-01's boundary). From
  the word after a git word, skip a member of `GIT_OPT_WITH_ARG` (`-C`, `-c`,
  `--git-dir`, `--work-tree`, `--namespace`, `--exec-path`, `--config-env`, moved
  here from `git-guard.mjs:78-79` so it has one home) together with its argument,
  skip any other `-`-leading word, and take the first remaining word as the
  subcommand; push it and CONTINUE the outer scan from that word so a second git
  invocation in the same command is reported too (D-11 retires the `break` at
  `git-guard.mjs:110`). `git stash push` still resolves to `stash` only.
  Coerce a non-string input with `String(text ?? '')` and return
  `{ subs: [], unplaced: false }` for empty input.
  Create `cadence-core/bin/shell-tokens.test.mjs` as the parser-level grammar
  table (D-09; `planning-files.test.mjs:1-11` is the pattern, and
  `.github/workflows/test.yml:27` globs `cadence-core/bin/*.test.mjs` so no CI
  change is needed). Rows, each asserting `subs` and `unplaced` directly with no
  subprocess: the six non-wrapper closed shapes (`git -C "my repo" push origin
  main` -> `['push']`; `git add -A & git push origin main` -> includes `push`;
  `$(git push origin main)`; `` `git push origin main` ``;
  `(git push origin main)` and `( git push )`; `echo \" ; git push origin main;
  echo "done"`); the shipped silences (`echo "git push"`, `git log --grep
  "push"`, `git stash push -m wip`, `echo "foo \` + newline + ` git push bar"`,
  `echo "it's just git push text"`, the `awk -F'"'` alternation from
  `git-guard.test.mjs:198` which must yield `push`); the parity pair (odd run
  continues, even run separates - the case `#50`'s first cut silently missed);
  the CRLF continuation; the shapes that already ask (`xargs -I{} git push`,
  `GIT_SSH_COMMAND=x git push`, `git -C . -c user.name=t push origin x`); the
  empty-quoted-argument word-count case; the two rules added above -
  `git add . # git push` -> `['add']` (comment discarded, NO false ask) and
  `file#1` staying ordinary content, plus `$'git push origin main'` alone
  yielding one span whose content is `git push origin main` (the wrapper case
  that turns it into a real `push` is task 3's row); and totality rows (empty
  string, a non-string input, an unterminated quote with and without a git
  token).
- **Verify:** `node --test cadence-core/bin/shell-tokens.test.mjs` passes with
  every row above green, and `npx tsc -p tsconfig.ci.json` exits 0 (the new lib
  file is covered by the existing `cadence-core/bin/**/*.mjs` include, so a type
  error surfaces here with no config change).

### Task 2: Drive both rails from the tokenizer

- **Files:** cadence-core/bin/git-guard.mjs, cadence-core/bin/git-guard.test.mjs
- **Action:** In `git-guard.mjs`, delete the whole strip-and-split
  implementation - the local `GIT_OPT_WITH_ARG` set (`:78-79`), both `.replace`
  passes (`:82-99`), the segment split and first-git-word loop (`:100-113`) and
  the header comment paragraph (`:60-77`) that describes them - and import
  `gitSubcommands` from `./lib/shell-tokens.mjs` beside the existing
  `./lib/config-merge.mjs` import. Replace the deleted comment with a short one
  that keeps what is still true (both rails must agree on what a wrapped command
  IS, phase-4 D-07; an unrecognized shape yields no subcommand and the guard
  stays silent) and points at `references/git.md` rail 3 for the stated grammar
  instead of restating it in code. Do NOT leave a second copy of any quoting or
  continuation regex in this file - one home is the point (D-06, D-13).
  In `main()`, call `const { subs, unplaced } = gitSubcommands(command);`. Keep
  the push rail exactly as it is (`:146-150`), first and unconditional. Extract
  the commit rail (`:152-179`) into a helper `commitDecision(root, cwd)` that
  returns `{ decision, reason }` or `null` instead of writing output, so `main()`
  reads: push -> ask; else if `isCommit` and `commitDecision` returns a decision
  -> emit it and return; then, if `unplaced` -> `ask` with a distinct reason
  naming the unparsed shape (an unterminated quote or substitution carrying a
  `git` word, so it may be a push; cite `references/git.md` rail 3 and tell the
  user to approve only deliberately). The unplaced rail NEVER emits `deny` - the
  tokenizer could not place the word, so it cannot know the command is a commit,
  and D-04's hard-deny path belongs to what the tokenizer resolved. Ordering is
  load-bearing: unplaced runs after the commit rail so it can never mask a
  `deny`, and before returning silent so a task-branch commit with an
  unterminated quote still asks. The early return at `git-guard.mjs:140`
  (`if (!isPush && !isCommit) return;`) is REPLACED by that structure, not kept:
  an unplaced command has `isPush === false` and `isCommit === false`, so leaving
  `:140` in place returns before the unplaced rail can ever run and AC3 fails
  silently - the exact defect class this phase exists to end (review:
  cad-reviewer, and the one finding that would have shipped a dead rail). The
  guard-scope early returns that DO stay untouched are `:136` (`if (!root)
  return;` - never police a non-Cadence repo), `:168` (`on_protected: allow`),
  `:171` (no branch), and the module-level `try { main(); } catch {}` - a broken
  guard must never block work.
  In `git-guard.test.mjs`, add seam rows (D-09: a defect proven only at the
  parser level is not proven to reach the permission prompt) for the six
  non-wrapper shapes, each asserting `permissionDecision === 'ask'` on a project
  fixture, plus the D-03 pair: an unterminated quote around `git push origin
  main` asks, while `echo "unterminated` and `eval $CMD` return null. Change no
  existing test in this file.
- **Verify:** `node --test cadence-core/bin/git-guard.test.mjs` passes with every
  pre-existing test still green and the new rows green; and the seam runs
  against a REAL cwd, not a placeholder (review: openai - the placeholder made
  this check unrunnable and therefore unfalsifiable): use the repo root itself,
  `/data/code/cadence`, which carries `.planning/` and needs no protected branch
  because the push rail asks unconditionally. Record the BEFORE/AFTER baseline
  for ALL SEVEN shapes, not one (review: openai) - before applying this task's
  edits, loop the seven Must-be-true shapes through
  `node cadence-core/bin/git-guard.mjs` with
  `{"tool_input":{"command":"<shape>"},"cwd":"/data/code/cadence"}` on stdin and
  confirm every one prints EMPTY stdout; after the edits, the same loop must
  print `"permissionDecision":"ask"` for all seven. Paste both loops' output into
  the task's commit message so the closure is evidenced rather than asserted.
  (Re-running the loop at `c4ab89f` is NOT required: that provenance is already
  recorded in `.planning/CAPTURE.md` and re-confirming an old commit does not
  advance the goal - the HEAD baseline is what proves these were live holes.)

### Task 3: The shell-wrapper set, re-tokenized

- **Files:** cadence-core/bin/lib/shell-tokens.mjs, cadence-core/bin/shell-tokens.test.mjs, cadence-core/bin/git-guard.test.mjs
- **Action:** In `lib/shell-tokens.mjs`, add the stated wrapper set of D-02 -
  `bash`, `sh`, `zsh`, `dash`, `eval` - as a named exported-or-documented
  constant, matched on a word that equals a member or ends with `/` plus a member
  (so `/bin/bash` counts). Apply it in `gitSubcommands`, not in
  `tokenizeCommand`: the lexer stays a lexer, the wrapper rule is semantics.
  Walk the flat command list as a work queue. Match the wrapper AT ANY POSITION
  in a simple command, exactly as the git-word rule already scans any position -
  do NOT restrict it to the command word after `VAR=`/`env` skipping. A
  command-word-only rule leaves `sudo bash -c "git push origin main"` silent, and
  with it `timeout 60 bash -c ...`, `nohup bash -c ...` and `xargs bash -c ...` -
  all real pushes reaching the network, all verified silent at HEAD, and all
  sitting under a git.md that will claim wrapped pushes are seen (review:
  cad-reviewer). Any-position matching closes that whole family with ONE rule
  instead of a second enumerated prefix set, which is this phase's entire
  argument; word-boundary preservation is what keeps it safe, since
  `git commit -m "bash -c git push"` is a single quoted WORD and never matches.
  Still skip leading `VAR=value` assignment words
  (`/^[A-Za-z_][A-Za-z0-9_]*=/`) and an `env` word with its own `-` flags and
  `VAR=` arguments, and match `env` by the SAME rule as the wrapper set - equal
  to `env` or ending in `/env` - so `/usr/bin/env bash -c "git push"` is not a
  bypass (review: openai).
  For a matched wrapper, re-tokenize EVERY subsequent word that does not start
  with `-` (so `-c`, `-lc` and `-exc` are tolerated without enumerating flags,
  and `eval "git push origin main"` - which has no `-c` - is covered by the same
  rule), append the resulting commands to the queue, and pass the threaded depth
  budget (task 1) into each re-tokenization so `bash -c "bash -c \"...\""`
  terminates at 8 - a fresh call per operand restarting at 0 would bound nothing.
  `eval` takes ONE further rule: the shell CONCATENATES eval's operands with a
  space and executes the result, so `eval "git" "push origin main"` is a real
  push that per-operand re-tokenization misses entirely (review: openai). For an
  `eval` wrapper, JOIN its non-flag operands with a single space and re-tokenize
  the concatenation as one text, not each operand separately.
  Scan the appended commands for git
  words like any others. `eval git push origin main` needs no wrapper handling -
  its own words already carry a bare git word - and must keep asking.
  Add parser rows to `shell-tokens.test.mjs`: `bash -c "git push origin main"`,
  `sh -c 'git push origin main'`, `zsh -c "git push origin main"`,
  `dash -c "git push origin main"`, `eval "git push origin main"`,
  `bash -lc "git push"`, `env bash -c "git push"`, `/bin/sh -c "git push"`, a
  nested `bash -c "bash -c \"git push\""`, and one row per finding closed above:
  `sudo bash -c "git push origin main"`, `timeout 60 bash -c "git push"`,
  `nohup bash -c "git push"`, `xargs bash -c "git push origin main"`,
  `/usr/bin/env bash -c "git push"`, `eval "git" "push origin main"` (the
  concatenation rule - this row FAILS under per-operand re-tokenization, so it is
  the one that proves the rule landed), and `bash -c $'git push origin main'`
  (the `$'` rule from task 1). Negative rows that must stay
  silent: `echo "git push"` (not a wrapper), `git commit -m "bash -c git
  push"` (resolves to `commit`, never `push`), and `grep bash -c file.txt`
  (any-position matching re-tokenizes `file.txt`, which carries no git word).
  Add seam rows to `git-guard.test.mjs`: `bash -c "git push origin main"` and one
  row per remaining wrapper asserting `ask`; and the D-04 parity pair -
  `bash -c "git commit -m x"` on `main` returns `deny` under
  `{git:{on_protected:'refuse'}}` and `ask` under the default, each asserted
  `deepEqual` against the bare `git commit -m x` decision for the same fixture
  config, with a comment recording the accepted downstream consequence (a
  `refuse` user finds wrapped commits hard-blocked; this repo runs `ask`).
- **Verify:** `node --test cadence-core/bin/shell-tokens.test.mjs cadence-core/bin/git-guard.test.mjs`
  passes, including the wrapper rows and the `refuse`/`ask` parity pair; and
  `npx tsc -p tsconfig.ci.json` exits 0.

### Task 4: Write the grammar down in references/git.md

- **Files:** cadence-core/references/git.md, cadence-core/bin/shell-tokens.test.mjs
- **Action:** In `cadence-core/references/git.md`, extend rail 3 ("Never
  auto-push", `:94-113`) with a subsection - "What the guard sees" - stating the
  grammar the tokenizer implements, since no file in this repo states a shell
  grammar today and the only prior rules were the two deleted regexes (D-05,
  D-12; `references/plan-frontmatter.md` is the shape to follow, and
  `references/` costs no weight budget because `lib/surface-weight.mjs:8-12,53-78`
  measures only `agents/*.md`, `skills/**/SKILL.md` and
  `cadence-core/workflows/*.md`). State: one left-to-right pass with a single
  quote state; single quotes honor no escapes; double quotes honor backslash
  before `"`, `\`, `$`, backtick and newline only; a backslash outside quotes
  escapes the next character and backslash-newline continues the line (odd runs
  continue, even runs do not); the separator set `;` `\n` `|` `||` `&&` `&`;
  descent into `$(...)`, backticks and command-position `(...)`; `#` at word
  start as a comment to end of line (and `#` mid-word as ordinary content); `$'`
  as a single-quoted span with the `$` dropped and escape sequences NOT
  interpreted; the wrapper set
  `bash`, `sh`, `zsh`, `dash`, `eval` matched AT ANY POSITION (so `sudo`,
  `timeout`, `nohup` and `xargs` prefixes are covered by the same rule rather
  than a second enumerated set), with `/bin/`-prefixed forms, tolerated
  flags, `env`/`/usr/bin/env`/`VAR=` prefixes, every non-flag operand
  re-tokenized, and `eval`'s operands CONCATENATED before re-tokenization
  because that is what the shell executes; the
  git-word rule (a WORD equal to `git` or ending `/git`, found at any position in
  a simple command, with global options and their arguments skipped when reading
  the subcommand, and every git invocation reported rather than the first); and
  the unplaced-git rule (an unresolvable shape stays silent unless its raw text
  carries a `git` token, in which case the guard asks and never denies). State
  the two consequences a reader will hit: quoted text is word CONTENT, so
  `echo "git push"` is one word and stays silent while `echo "git" "push"` is two
  words and asks - the guard fails toward asking by design - and it is a
  detection widener, not a security boundary (the sanctioned publish still
  bypasses the hook through the git-publish seam, which is the actual rail).
  Add an out-of-grammar list naming heredocs, `<<<`,
  `${...}` brace expansion nested inside `$()`, redirection operators as
  ordinary words, and ANSI-C escape SEQUENCES inside `$'...'` (the span is read,
  the `$` dropped, but `\n`/`\t` stay literal two-character content), each with
  its STATED behavior rather than a silent gap
  (phase-1 D-20: declaring something out of scope without detectability leaves
  exactly the silent misread this phase exists to end). Derive each stated
  behavior by running the tokenizer from task 1-3 on a concrete example of that
  shape and recording what it actually does - the doc row and the code must
  agree, and each must either fail toward asking or state its silence with a
  reason. Then add one row per named out-of-grammar shape to
  `shell-tokens.test.mjs` pinning exactly that behavior, with the git.md wording
  quoted in the test's name or comment so drift between them is visible.
  Do not write any `git-guard.mjs <word>` invocation form in this prose (D-10:
  the hook takes no subcommands, and a `CONTRACTS` entry is out of scope), and do
  not introduce dotted `git.<word>` tokens that are not real config keys -
  `self-verify` check 1 reads every dotted token in a reference file.
- **Verify:** `node cadence-core/bin/self-verify.mjs` returns `{ok:true,
  problems:[]}` (no `unknown-config-key`, `unknown-subcommand` or
  `budget-overrun` from the new prose), `node --test
  cadence-core/bin/shell-tokens.test.mjs` passes with one row per named
  out-of-grammar shape, and each of heredoc, `<<<`, `$'...'` escape sequences and
  `${...}`-in-`$()` appears both in git.md's out-of-grammar list and in a test
  row; and `grep -n "sudo\|timeout\|#\|\$'" cadence-core/references/git.md`
  shows the any-position wrapper rule, the comment rule and the `$'` rule are
  each stated, so no rule the code carries is missing from the written grammar.

### Task 5: Move the shared-idiom claim off the deleted regex

- **Files:** cadence-core/bin/self-verify.mjs, cadence-core/bin/self-verify.test.mjs
- **Action:** `self-verify.mjs:243-258` claims "git-guard.mjs carries the
  identical regex for the same reason, so the two seams stay one idiom rather
  than two spellings (D-15)", and `self-verify.test.mjs:110-121` encodes that
  claim in its test name and body comment. Task 2 deleted that regex from
  `git-guard.mjs`, so both statements are now false and nothing lints a comment
  or a test name (D-13). Rewrite the `self-verify.mjs` comment to state what is
  true after this phase: self-verify keeps the parity-aware join REGEX because it
  joins continuation lines in PROSE text, while the same odd/even parity rule now
  lives as escape state in `cadence-core/bin/lib/shell-tokens.mjs` because that
  input is a shell command string - one RULE in two spellings, each fitted to its
  input, with the parity requirement (an even trailing run is a literal
  backslash, not a continuation) named as the shared invariant. Update the test
  name at `self-verify.test.mjs:110` and its body comment the same way, changing
  no assertion - the test asserts self-verify's own behavior and must stay green
  as-is. Do not reintroduce any regex into `git-guard.mjs` to make the old
  sentence true again.
- **Verify:** `node --test cadence-core/bin/self-verify.test.mjs` passes with the
  renamed test green; `grep -rn "identical regex\|identical parity" .
  --exclude-dir=.planning --exclude-dir=.git` returns nothing (the original grep
  searched only `cadence-core/bin/`, so "nothing outside `.planning/`" was
  vacuous - review: cad-reviewer); and, because a phrase grep is satisfiable
  while the false CLAIM survives a rewording,
  `grep -n "git-guard" cadence-core/bin/self-verify.mjs
  cadence-core/bin/self-verify.test.mjs` shows every surviving mention says the
  parity RULE is shared while the regex now lives only in self-verify - no
  sentence may assert that `git-guard.mjs` carries a regex, since
  `grep -c "replace(/" cadence-core/bin/git-guard.mjs` must be `0` after task 2.

### Task 6: Amend the "I deleted the parser" narrative

- **Files:** README.md, INTERNALS.md, DESIGN.md
- **Action:** `README.md` is in `/cad-docs-verify`'s default set outright
  (`workflows/docs-verify.md:8-9`); `INTERNALS.md` and `DESIGN.md` are root
  `*.md` whose inclusion turns on that step's "reads like user docs" judgment, so
  do NOT rest this task's verification on docs-verify picking them up (review:
  cad-reviewer - the original claim that all three are read by default was
  unverified). All three now describe a hook that imports
  a shell tokenizer (D-08; phase-2 D-11 is the precedent for moving a
  contradicted shipped claim inside the phase that contradicts it). Amend each to
  draw the distinction the code now embodies: an *allow-list predicate*
  (`isPlainPush`) is unwinnable because it must be RIGHT to let a command
  through, and it stays deleted; a *detection widener* fails toward asking, can
  only ever cause more prompts, and is what this tokenizer is. `README.md:24` -
  keep the `isPlainPush` story and its rule verbatim in spirit, and add that
  reading a command to decide whether to ASK is the opposite bet from reading one
  to decide whether to ALLOW, which is why v1.4.0 does the first and still
  refuses the second. `INTERNALS.md:19-31` - the section heading must no longer
  assert Cadence writes no parser (name both the parser deleted and the
  tokenizer written), the body must state the same distinction, and the
  Read-the-code list at `:31` gains
  `cadence-core/bin/lib/shell-tokens.mjs` and `cadence-core/bin/shell-tokens.test.mjs`
  (both exist after task 1, which `self-verify` check 3b requires of every
  backticked repo path in INTERNALS.md). `DESIGN.md:412-417` (reversal R2) -
  do not rewrite the reversal record; append a short dated note under it stating
  that R2 governs the allow-list predicate only, that v1.4.0 added a
  detection-side tokenizer under `lib/shell-tokens.mjs`, and that this does not
  reverse R2 because the tokenizer never lets a command through - so a later
  contributor cannot cite R2 to argue the tokenizer should be deleted.
- **Verify:** `node cadence-core/bin/self-verify.mjs` returns `{ok:true,
  problems:[]}` (no `missing-internals-path` from the new backticked paths).
  That alone is NOT sufficient - it already returns `{ok:true,"problems":[]}` at
  HEAD, so an executor who edits nothing passes it (review: cad-reviewer).
  Falsifiable per-file checks, each of which FAILS before this task's edits:
  `git diff --stat README.md INTERNALS.md DESIGN.md` shows all three modified;
  `grep -n "shell-tokens" INTERNALS.md` shows both
  `cadence-core/bin/lib/shell-tokens.mjs` and
  `cadence-core/bin/shell-tokens.test.mjs` in the Read-the-code list at `:31`;
  `grep -n "^#" INTERNALS.md` shows the section heading at `:19` no longer
  asserts Cadence writes no parser; and `grep -n "R2" DESIGN.md` shows the
  appended dated note below `:412-417` with the original reversal record
  byte-unchanged (`git diff DESIGN.md` shows additions only).

### Task 7: Record the closure in a new CHANGELOG entry

- **Files:** CHANGELOG.md
- **Action:** Leave the `[1.3.1]` entry - including its "Known gaps" bullet
  naming the six holes - exactly as written (D-14: editing it rewrites shipped
  release history to hide what was honestly recorded, which is why
  `self-verify.mjs:3-9,142-148` deliberately excludes CHANGELOG from the
  live-surface checks). Add a new `## [1.4.0] - unreleased` section immediately
  above `## [1.3.1] - 2026-07-27`, with a `### Fixed` block whose bullets record:
  the seven closed shapes (quoted `-C` path, `&` separator, `$(...)`, backticks,
  subshell, escaped `\"`, and the `bash`/`sh`/`zsh`/`dash`/`eval` wrapper set);
  that one left-to-right quote/escape-state tokenizer in
  `cadence-core/bin/lib/shell-tokens.mjs` replaced the strip-and-split arms and
  the parity pre-pass rather than adding six more regex arms; that both rails
  read it, so a wrapped `git commit` on a protected branch now follows the same
  `git.on_protected` path as the bare form; that an unresolvable command carrying
  a `git` word now asks instead of going silent; and that the grammar and its
  out-of-grammar list are stated in `cadence-core/references/git.md`. Name the
  `[1.3.1]` known-gap bullet as closed here, without touching it. Add
  `[1.4.0]: https://github.com/crenshawdev/cadence/releases/tag/v1.4.0` at the
  top of the link-reference block at the end of the file, matching the existing
  `[1.3.1]` line's form. Write only this phase's closure - the rest of the
  v1.4.0 entry is the milestone close's to author.
- **Verify:** `grep -n '^## \[' CHANGELOG.md` shows `## [1.4.0] - unreleased`
  immediately above `## [1.3.1] - 2026-07-27`; `grep -n '^\[1.4.0\]:' CHANGELOG.md`
  shows the link reference; `git diff CHANGELOG.md` shows no modified or deleted
  line inside the `[1.3.1]` section (additions above it only); and
  `node -e "import('./cadence-core/bin/lib/release-decision.mjs').then(m=>console.log(m.prependChangelogEntry(require('fs').readFileSync('CHANGELOG.md','utf8'),{version:'1.4.0',date:'2026-01-01',url:'x'}).changed))"`
  prints `false`, proving the milestone close's scaffold is an idempotent no-op
  over this entry (a pure call, it writes nothing).

## Notes

- The six holes and the argument for one tokenizer over six regex arms come from
  `.planning/CAPTURE.md` (phase 4), which also records that all six are silent at
  `c4ab89f` and at HEAD, so none is a phase-4 regression; `eval` is the seventh,
  found at gather time (CONTEXT.md, phase 3).
- Structure honors the CONTEXT `Plan shape` directive: one plan. The only
  file-disjoint split (lib+parser test, then hook+docs) is serial by dependency
  and shares `shell-tokens.test.mjs` across tasks 1, 3 and 4, so it fails the
  independence test anyway.
- `## [1.4.0] - unreleased` is deliberately not a date: `prependChangelogEntry`
  (`lib/release-decision.mjs:95-98`) is idempotent on an existing
  `## [<version>]` heading, so the milestone close's `release-bump bump` will
  report `already-present` and will NOT stamp a date. The close's author replaces
  `unreleased` with the ship date when the tag is cut.
- Flagged assumption carried from CONTEXT and unresolved here: which shell Claude
  Code's Bash tool actually runs, and whether `tool_input.command` is
  byte-identical to what executes. If the host pre-processes the command, the
  tokenizer reads something other than what runs and the wrapper set is aimed at
  the wrong text. Nothing in this plan depends on resolving it; `zsh` is in the
  set partly because this session's shell is zsh.
- The double-quote escape set (`"`, `\`, `$`, backtick, newline) was not verified
  against a shell spec. D-05 bounds rather than resolves that: no rule is
  asserted beyond the stated subset, so a divergence would be a wrong character
  in a written-down set, not an unstated rule being relied on.
- The `plan` review trigger fired on this plan (gate `adjudicated`): three
  reviewers - `cad-reviewer` (opus), `openai/gpt-5.3-codex`, `deepseek-v4-pro`.
  Nine findings survived adjudication and are folded in above, each marked
  `(review: <reviewer>)` at its point of use. The load-bearing one: task 2's
  "leave every early return as they are" would have kept `git-guard.mjs:140`
  (`if (!isPush && !isCommit) return;`), which returns BEFORE the new unplaced
  rail on exactly the inputs that rail exists for - a dead rail passing every
  test that does not exercise it. Two claimed blockers were killed at
  adjudication: openai's "task 1 has the awk row backwards" (task 1 was right,
  the Must-be-true bullet was wrong - now fixed) and deepseek's
  "`commitDecision` cannot see the subcommand list" (`main()` gates on
  `isCommit` before calling it, so it never needs to).
