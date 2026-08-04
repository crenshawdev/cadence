---
phase: 2
plan: 1
requirements:
  - TOK-02
files:
  - cadence-core/bin/git-publish.mjs
  - cadence-core/bin/git-publish.test.mjs
  - cadence-core/bin/lib/publish-decision.mjs
  - cadence-core/bin/publish-decision.test.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/self-verify.test.mjs
  - skills/cad-land/SKILL.md
  - cadence-core/bin/land-cleanup.mjs
  - cadence-core/bin/lib/close-decision.mjs
  - cadence-core/bin/weight-budgets.json
  - cadence-core/bin/lib/git-segments.mjs
  - cadence-core/bin/git-segments.test.mjs
  - cadence-core/bin/git-guard.mjs
  - cadence-core/bin/git-guard.test.mjs
  - cadence-core/references/git.md
  - cadence-core/bin/lib/shell-tokens.mjs
  - cadence-core/bin/shell-tokens.test.mjs
  - cadence-core/bin/lib/destructive-git.mjs
  - cadence-core/bin/destructive-git.test.mjs
  - INTERNALS.md
  - CHANGELOG.md
  - .planning/REQUIREMENTS.md
  - README.md
  - DESIGN.md
  - METHOD.md
  - .planning/PROJECT.md
  - .planning/phases/2/probe-ac1-before.txt
---

# Phase 2: The parser earns its keep - Plan

## Goal

The guard's parser is DELETED, not redirected. `lib/shell-tokens.mjs`,
`lib/destructive-git.mjs` and their test files go with `references/git.md`'s
rail-3 evasion grammar and out-of-grammar table, and both rails read from ONE
small anchored reader that over-fires by construction rather than modelling
git's option grammar. Retires TOK-01 on both halves - the six push-hole
closures and the command-position deny gate. Ask everywhere except
`git.on_protected: refuse`, which survives anchored to a segment that begins
with `git`.

## Must be true when done

- Inside a Cadence project on a default install, each of `git reset --hard`,
  `git clean -fd`, `git clean -xdf`, `git checkout .`, `git checkout -- src/`,
  `git restore .`, `git branch -D x`, `git checkout -f -b y`,
  `git switch -f main` and `git clean -f --no-dry-run` stops at a permission
  prompt naming what it would destroy and the key `git.on_destructive`. Every
  one of the ten was measured SILENT on this branch before the reader landed,
  and that measurement is on disk.
- The guard emits no decision at all for `git checkout -b feat`,
  `git checkout main`, `git restore --staged .`, `git branch -d x`,
  `git clean -n`, `git stash push -m wip`, `rg -n "git push" .` and
  `git commit -m "fix the push rail"` - Cadence's own cycle-start and
  release-close commands, and read-only searches, are untouched.
- `git.on_protected: refuse` on a protected branch is the guard's only deny
  surface and this phase does not widen it: `git commit -m x` comes back
  `deny`, while `command -v git commit`, `rg "git commit" .`,
  `echo "git commit"` and `git push origin main` produce no deny at all. No
  setting of `git.on_destructive` can produce a deny.
- The tree carries no `cadence-core/bin/lib/shell-tokens.mjs`,
  `cadence-core/bin/lib/destructive-git.mjs` or their test files, nothing under
  `cadence-core/` names them, and `references/git.md` carries neither the "What
  the guard sees" grammar nor the "Out of grammar (rail 3)" table - rails 1-4
  keep their numbers and the destructive rail is documented as rail 5.
- The shipped record states the cost instead of advertising the reach:
  `CHANGELOG.md`'s `## [Unreleased]` names, in the same subsection as the
  removal, every shape that goes silent; TOK-01 reads as superseded on BOTH
  halves; and `README.md`, `INTERNALS.md`, `DESIGN.md`, `METHOD.md` and
  `PROJECT.md` no longer claim guard reach this phase removed.
- `/cad-land`'s branch reap runs through `git-publish.mjs reap` as a subprocess
  argv delete, no Bash `git branch -D` remains in cad-land's prose, and
  `land-cleanup.mjs` still runs no live git.
- `node --test cadence-core/bin/*.test.mjs` and `npx tsc -p tsconfig.ci.json`
  both exit 0, and `node cadence-core/bin/self-verify.mjs` reports `ok:true`
  with no budget overrun, with `weight-budgets.json` regenerated in the same
  commit as the one budgeted-surface edit.

## Context

CONTEXT.md's D-01 through D-17 are locked and each has a task below. D-01 is
the shape of the whole phase: both libs and both test files are DELETED, not
redirected, and one ~70-line anchored reader replaces them. D-06 governs the
four commits already on this branch - they STAY and are superseded; never
revert, never reset, and `/cad-undo` cannot run here. D-10 puts the five staged
reap-seam files into task 1 before anything touches the guard. Baseline
measured at plan time: full suite green at 1315/1315 WITH that work staged,
`self-verify` `ok:true`, and every AC1 shape silent through the real hook. Out
of scope: rails 1, 2 and 4 beyond the reader swap; re-catching the wrapper,
subshell, prefix and continuation shapes the anchored reader silences (that is
TOK-02's accepted cost, stated in task 6, not a gap to close here); the
`git.on_protected` enum, which is unchanged.

## Tasks

### Task 1: land the staged reap seam before anything touches the guard

- **Files:** cadence-core/bin/lib/publish-decision.mjs,
  cadence-core/bin/publish-decision.test.mjs, cadence-core/bin/git-publish.mjs,
  cadence-core/bin/git-publish.test.mjs, cadence-core/bin/self-verify.mjs
- **Action:** D-10. These five files are ALREADY STAGED in the working tree
  from the halted attempt's task 7 (`decideReap` in `lib/publish-decision.mjs`,
  the `reap [--dir <path>] --branch <name>` subcommand in `git-publish.mjs`,
  and the `reap: ['--branch']` row in `self-verify.mjs`'s CONTRACTS table).
  Commit them AS THEY ARE - do not rewrite, re-derive or "improve" the diff,
  and do not re-review it; it went through the halted attempt's third panel
  with no surviving finding and every later task in this phase either trips a
  dirty-tree guard on it or risks losing it. Stage nothing else: the tree also
  carries an UNRELATED unstaged edit to `.planning/config.json` (it removes
  `review.triggers.diff.gate`), which is the user's own and must be left
  modified-unstaged, so commit by explicit path and never `git add -A`. This
  task adds no code of its own. It lands first because every other path in the
  phase writes git, and because task 2's cad-land prose cites
  `git-publish.mjs reap`, which `self-verify.mjs`'s CONTRACTS table only
  accepts once this commit exists.
- **Verify:** `git status --porcelain` shows none of the five files staged or
  modified and still shows ` M .planning/config.json`;
  `node --test cadence-core/bin/publish-decision.test.mjs cadence-core/bin/git-publish.test.mjs cadence-core/bin/self-verify.test.mjs`
  passes; `node cadence-core/bin/self-verify.mjs` reports `ok:true`.

### Task 2: cad-land reaps through the seam instead of Bash

- **Files:** skills/cad-land/SKILL.md, cadence-core/bin/land-cleanup.mjs,
  cadence-core/bin/lib/close-decision.mjs, cadence-core/bin/weight-budgets.json
- **Action:** D-11, D-12, AC6. In `skills/cad-land/SKILL.md` step 5 (line 129-131)
  replace the Bash instruction `git branch -D <decision.branch>` with the seam
  call on its own physical line, matching how the publish seam is invoked at
  line 94: `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/git-publish.mjs" reap
  --dir <root> --branch <decision.branch>`. State what its arms mean (`ok:true`
  with `action` `reaped` or `already-absent` is done - the second is how the
  documented idempotency survives the platform's own `--delete-branch`;
  `ok:false` is surfaced with its reason and the close stops there) and that a
  Bash `git branch -D` fallback is forbidden, because rail 5 (task 4) prompts
  on it and that is exactly the per-step prompt `git.auto_close`'s shipped
  purpose string promises the close will not have. Leave step 5's
  `git checkout <base>` and `git pull` exactly as they are: D-05 deliberately
  keeps both silent under rail 5 because Cadence runs them at every close.
  Leave the `land-cleanup.mjs cleanup` call and the `reap:true` gate untouched
  - that seam still DECIDES and still runs no mutating git. Two shipped code
  headers now describe a path that will not exist and must move with the prose:
  `cadence-core/bin/land-cleanup.mjs:7-8` reads "it NEVER runs `checkout`,
  `pull`, or `branch -D` - that is cad-land prose's job, gated by this advice",
  and `cadence-core/bin/lib/close-decision.mjs:9` reads "the cad-land prose
  runs the actual checkout/pull/branch -D". Correct each to name
  `git-publish.mjs reap` as what performs the delete while keeping their real
  claim intact (these two seams still only ADVISE and still run no mutating
  git). `skills/cad-land/SKILL.md` is a MEASURED surface sitting at exactly
  8978/8978 bytes with zero headroom, so update `weight-budgets.json` IN THIS
  SAME COMMIT or self-verify goes red on the commit that grew it. `weight.mjs`
  WRITES NOTHING - it prints one JSON line (`weight.mjs:26`) and the manifest
  is a different shape (`_comment` plus a sorted `budgets` map) - so run
  `node cadence-core/bin/weight.mjs`, read the reported byte count for
  `skills/cad-land/SKILL.md`, and edit that ONE entry in place preserving
  `_comment` and key order. A smaller number is fine: self-verify reports only
  `bytes > budget`.
- **Verify:** `grep -n "branch -D" skills/cad-land/SKILL.md` returns only the
  forbidden-fallback sentence and no instruction to run it;
  `grep -n "git-publish.mjs\" reap" skills/cad-land/SKILL.md` returns the seam
  line; `grep -n "execFileSync" cadence-core/bin/land-cleanup.mjs` shows only
  the `['-C', dir, 'branch', '--merged', base]` READ (do NOT check this with
  `grep -c "checkout\|pull\|branch -D" land-cleanup.mjs`, which returns hits
  from the header comment saying the seam never runs those commands and so
  contradicts its own expected result); `node --test
  cadence-core/bin/land-cleanup.test.mjs cadence-core/bin/close-decision.test.mjs`
  passes unchanged; `node cadence-core/bin/self-verify.mjs` reports `ok:true`
  with no `unknown-subcommand` and no `budget-overrun`.

### Task 3: the anchored reader, one small module both rails can read

- **Files:** cadence-core/bin/lib/git-segments.mjs (new),
  cadence-core/bin/git-segments.test.mjs (new)
- **Action:** D-02, D-05. Add a pure, total, zero-dep, `@ts-check`ed module -
  no imports, no I/O, no live git, no unbounded loop - exporting exactly two
  functions. (1) `gitSegments(text)` returns an array of `{verb, args}`, one
  entry per git invocation it is willing to claim: split `text` on the
  character class `[;|&\n]`, split each segment on whitespace, and keep the
  segment ONLY when its first word is `git` or ends in `/git` (so
  `/usr/bin/git push` counts and `mygit` does not). `verb` is that segment's
  first word after the git word that does not begin with `-`; `args` is every
  word after the verb. A segment with no such word yields no entry. A
  non-string input yields `[]`. (2) `destructiveSegment(segments)` returns the
  FIRST entry matching D-05's firing set as `{verb, args, kind}`, else `null`,
  and never throws on a malformed entry. The six kinds and no others - do not
  widen to `stash drop`, `push --force`, `rebase` or `branch -M`, which TOK-02
  does not name: `reset-hard` (verb `reset`, an arg exactly `--hard`);
  `clean-force` (verb `clean`, an arg `--force` or a short cluster
  `/^-[A-Za-z]+$/` containing `f`, so `-f`, `-fd`, `-df` and `-xdf` all fire
  and `-n`, `-i`, `-e` do not - dry-run is NOT consulted, because git is
  last-one-wins and `git clean -f -n --no-dry-run` really deletes, so this arm
  over-fires on a preview rather than under-fires on a delete);
  `pathspec-overwrite` (verb `checkout` or `restore`, an arg exactly `.` or
  exactly `--`, skipped when a staged flag is present - `--staged` or a short
  cluster containing `S` - UNLESS a worktree flag is also present
  (`--worktree` or a short cluster containing `W`), because unstaging destroys
  nothing but `git restore --staged --worktree .` overwrites the worktree);
  `checkout-force` (verb `checkout`, an arg `--force` or a short cluster
  containing `f`, tested INDEPENDENTLY of `-b`/`-B`/`--orphan` so
  `git checkout -f -b x` and `git checkout -fb x` fire - a short-circuit on the
  branch-creating flags is the confirmed silent-destruction family the halted
  attempt shipped); `switch-force` (verb `switch`, an arg `--force`,
  `--discard-changes`, or a short cluster containing `f`); `branch-force-delete`
  (verb `branch`, a short cluster containing `D`, or `--delete` together with
  `--force`; a cluster containing only lowercase `d` never fires). Write the
  module header as the phase's own record: this reader OVER-FIRES BY
  CONSTRUCTION within one shape and deliberately models none of git's option
  grammar - it skips no option's argument, so `git -C /tmp push` reads the verb
  `/tmp` and stays silent, and it descends into no wrapper, substitution or
  prefix, so only a segment that BEGINS with git is ever read. State why: the
  deleted quote-state tokenizer and its destructive-policy companion spent 1207
  lines and three blocking review panels modelling that grammar and still left
  three families of silent unrecoverable destruction, and this rail's adversary
  is the model issuing the command, not an attacker. Write that history WITHOUT
  the literal strings `shell-tokens` or `destructive-git` - this file is under
  `cadence-core/`, so naming them would trip task 5's own
  "nothing names them" grep against a file task 5 has no authority to edit. State that being wrong in
  the firing direction costs a prompt while being wrong in the silent direction
  costs uncommitted work, and that this module computes no refusal of any kind.
  Table-test it in `git-segments.test.mjs` with one named row per AC1 shape,
  one per AC2 shape, the spelling variants above (`-fb x`, `-b x -f`,
  `--force -B main` for checkout-force; `-fn --no-dry-run` for clean-force;
  `restore -S .` silent and `restore -SW .` firing; `branch --delete --force`
  firing and `branch -d x` silent), the anchoring rows (`rg -n "git push" .`,
  `echo "git push"`, `bash -c "git push"`, `$(git push)`, `` `git push` ``,
  `sudo git push`, `VAR=1 git push` all returning
  `[]`; `git -C "my repo" push` returning ONE entry whose verb is the literal
  `"my` - NOT `[]`, because the segment does begin with `git` and the reader
  skips no option's argument, which is the whole point of D-02; the rail stays
  silent on it because `"my` is in no firing set, and that is the row that
  pins the difference between "the reader returned nothing" and "the reader
  returned a verb nobody fires on"; `git add -A & git push origin main` and `echo x ; git push` each
  returning one `push` entry), and the hostile inputs (`undefined`, `null`, a
  number, an object, `''`, 10000 repeated segments returning fast). Every row
  is a plain `assert.deepEqual` against the returned array - no subprocess per
  row, which is what makes a corpus this size affordable.
- **Verify:** `node --test cadence-core/bin/git-segments.test.mjs` passes;
  `grep -c "^import" cadence-core/bin/lib/git-segments.mjs` returns 0;
  `wc -l cadence-core/bin/lib/git-segments.mjs` is under 130 lines including
  the header (the module is small BY REQUIREMENT - if it is growing past that,
  it is modelling the option grammar D-02 rejects); `npx tsc -p tsconfig.ci.json`
  exits 0.

### Task 4: both rails read the anchored reader, and rail 5 is documented

- **Files:** .planning/phases/2/probe-ac1-before.txt (new),
  cadence-core/bin/git-guard.mjs, cadence-core/bin/git-guard.test.mjs,
  cadence-core/references/git.md
- **Action:** D-02, D-04, D-05, D-08, D-09, AC1, AC2, AC4. FIRST, before
  editing `git-guard.mjs`, run all ten AC1 shapes and all eight AC2 shapes
  through the CURRENT hook from a fixture Cadence project on a non-protected
  branch, plus `git commit -m x` and `git push origin main` from a protected
  branch under `{git:{on_protected:"refuse"}}`, and record every result into
  `.planning/phases/2/probe-ac1-before.txt`, one line per shape as
  `<shape> -> <permissionDecision or (silent)>`. That file is the red proof AC1
  demands, it is unreproducible once the rail lands, and /cad-verify has
  nothing to check against if it lives only in a transcript. Measured at plan
  time it must show all ten AC1 shapes `(silent)` - the fact this task inverts
  - alongside `git commit -m x` `deny` and `git push origin main` `ask` under
  refuse, which are the two AC4 facts this task must carry through the reader
  swap UNCHANGED. Then rewrite
  `git-guard.mjs`: import `gitSegments` and `destructiveSegment` from
  `./lib/git-segments.mjs` instead of `gitSubcommands` from
  `./lib/shell-tokens.mjs`, and compute `const segments = gitSegments(command)`
  once in `main()`. Rename `commitDecision` to `protectedDecision(root, cwd)`
  and DELETE its `canDeny` parameter and the whole non-command-position branch
  of its reason string: the deny gate does not survive (D-07), because
  anchoring makes every match a command-position match by construction and
  makes `grep git commit`, `command -v git commit` and `rg "git commit" .`
  silent rather than merely un-deniable. Keep everything else in it byte-honest
  - the `deny` alias of `refuse`, the lone-string `protected_branches`
  tolerance (#38), the `allow` early return, the empty-branch and
  not-protected returns. The deny's REACH is unchanged by this phase and stays
  commit-only (D-04): it is the anchoring that moves, never the surface. The
  rails, in this order. Rail 3 (push): when any segment's verb is `push`, ask
  with the existing cad-land reason, unconditionally and with no config read -
  keep this rail's hardcoded `decide('ask', ...)` and its immediate return
  exactly as they are at `git-guard.mjs:165-169`. No `git push` spelling has
  ever denied and none starts to here; adding a deny arm would widen the
  guard's only hard block on the phase whose point is that the record matches
  the code. Rail 1 (commit on a protected branch): when any segment's verb is
  `commit`, take `protectedDecision`'s verdict. Rail 5 (destructive): call
  `destructiveSegment(segments)` FIRST and SKIP THIS RAIL on `null` - fall
  through to whatever follows, never `return` out of the hook, which would
  silence the push and commit rails above and break AC2 and AC4 - before
  reading any config, since the hook runs on every Bash call and an
  unconditional `mergeLayers` would put a file read on that hot path; on a
  match resolve the mode as `git.on_destructive === 'off' ? 'off' : 'ask'`, so
  any other value - a hand-written `refuse`, a malformed layer, the known
  `mergeLayers` fail-open - lands on `ask` and "never hard-blocks" is true by
  construction rather than by a downgrade rule. On `off` return without writing
  anything at all: never `permissionDecision: "allow"`, which would
  auto-approve the command and bypass the user's own Claude Code permission
  settings on the one class that destroys work (D-08). The ask reason names the
  verb, what it destroys, the key `git.on_destructive` and
  `references/git.md rail 5`. DELETE the `unplaced` rail entirely along with
  its `/could not parse/` reason string and the `references/git.md rail 3
  ("What the guard sees")` citations at the module header and at that rail: the
  anchored reader has no unresolvable state to report, and a reason string
  pointing at a heading this same phase deletes is the prose/code drift
  `self-verify.mjs` exists to end. Rewrite the module header comment
  accordingly - it currently describes wrapper descent, any-position detection
  and the denyable gate, all three of which are gone. FIVE sites in this file
  name the dying module, its export or the heading task 5 deletes, and all five
  must go in THIS commit, because task 5's verify greps `cadence-core/` for
  those names and `git-guard.mjs` is not in task 5's file list: the import at
  `:32` and the call at `:156` (both replaced by `gitSegments`); the standalone
  block comment at `:61-77`, which is a SEPARATE comment from the module header
  at `:1-24` and is easy to miss - it opens "What a command IS, is read by
  lib/shell-tokens.mjs" at `:61` and carries the
  `references/git.md rail 3 ("What the guard sees")` citation at `:64`, then
  describes wrapper descent, any-position detection and the `denyable` gate,
  none of which survives; the `@param canDeny` JSDoc at `:94-102` ONLY - the
  block opener `/**` at `:91` and the `@param root` / `@param cwd` lines at
  `:92-93` must SURVIVE, and deleting from `:91` would leave `@returns` at
  `:103` and `*/` at `:104` with no opener, a syntax error that fails both
  `node --test` and `tsc` - whose `:96`
  reads `(see gitSubcommands: detection is any-position, refusal is
  command-position only)` and which goes out with the parameter it
  documents; and the `unplaced` reason string at `:185`.
  In `git-guard.test.mjs`, the corpus is re-pinned against the new reader
  rather than inherited (D-17). CONSTRAINT on every comment written into this
  file and into `git-segments.test.mjs`: describe the accepted cost WITHOUT the
  literal strings `shell-tokens`, `destructive-git`, `gitSubcommands` or
  `destructiveInvocation` (say "the deleted tokenizer" / "the deleted policy
  module"). Both files live under `cadence-core/` and neither is in task 5's
  file list, so a comment naming them leaves task 5's repo-wide
  "nothing names them" grep permanently red against a file task 5 has no
  authority to edit. ADD: one row per AC1 shape asserting
  `permissionDecision: "ask"` with a reason matching the rail-5 wording; one
  row per AC2 shape asserting `null`; `git checkout -- src/f.txt` asserting
  `ask`, pinning the executor contract's own sanctioned single-file discard
  (`skills/cad-executor-contract/SKILL.md:127`) as a KNOWN accepted prompt
  rather than an unnoticed regression; `git reset --hard` under
  `{git:{on_destructive:"off"}}` asserting `null` and under
  `{git:{on_destructive:"refuse"}}` asserting `ask`, never `deny`;
  `git reset --hard && git push` asserting the PUSH rail's cad-land reason,
  pinning D-09's one-decision-per-call ordering; and AC4's five rows on a
  protected branch under refuse - `git commit -m x` asserting `deny` (the
  guard's only deny surface, carried through the swap unchanged), with
  `command -v git commit`, `rg "git commit" .` and `echo "git commit"`
  asserting `null` and `git push origin main` asserting `ask`, which is a
  decision but never a deny. CONVERT, never delete, every block that
  asserts a shape this reader silences, each carrying a comment naming it as
  TOK-02's accepted cost - an unpinned silence is precisely the misread this
  repo's grammar discipline exists to prevent. The blocks to convert, measured
  at plan time: `global git options are skipped` (`git -C . -c user.name=t push
  origin x` -> silent), both backslash-continuation rows and the wrapped-commit
  continuation row (:135, :142, :149 -> silent), FOUR of the six shapes in `the
  six non-wrapper shapes silent at HEAD` - `git -C "my repo" push origin main`,
  `$(git push origin main)`, `` `git push origin main` `` and
  `(git push origin main)` convert to silent, while the `&` separator row and
  the escaped-quote-then-`;` row STILL ASK and must be left asserting `ask`
  (both split into a segment that begins with `git`, so the anchored reader
  reaches them; converting either one is what turns this commit red) - three of the five rows in `a region
  used as a global-option argument` (the two `echo hi $(echo)#x; git push` rows
  still ask), the whole `stated wrapper set`, `wrapped commit follows the same
  git.on_protected path`, `env -S`, `an env option the guard does not know`,
  `the same env hole on the commit rail`, `wrapper operands that are not
  flags`, `a wrapper fed by a redirect or a pipe`, both `unplaced` blocks, and
  the `DENY_GATE` table plus both non-command-word blocks, of which only
  `git commit -m x` still denies. One row FLIPS the other way and must be
  re-pinned as an ASK with a comment naming it as the over-fire D-02 accepts:
  `echo "foo \` newline ` git push bar"` is silent today and asks under the
  anchored reader, because the newline ends the segment and the next one begins
  with `git`. Keep untouched every structural row (outside a project, the
  walk-up pair, no-repo, detached HEAD, malformed stdin, no command, the
  `protected_branches` string/list rows, `git stash push`, `git log --grep
  push`, `git add . && git push`, the awk `-F'"'` row, the blank-line and
  even-backslash continuation rows) - each still asserts what it asserts today.
  In `references/git.md`, ADD ONLY: every subtraction from this file belongs to
  task 5, because `cadence-core/bin/shell-tokens.test.mjs:643-647` READS this
  prose at runtime - `statedSet(/The stated set is ([^.]+?), matched/)`, whose
  only match in the repo is the `**Wrappers.**` sentence at `git.md:172`, inside
  the block that goes - and that test file does not die until task 5, so
  deleting the block here turns this task's own `node --test
  cadence-core/bin/*.test.mjs` check red with no file in this task's list
  authorized to fix it. D-14's reasoning ("deleted whole, so the git.md deletion
  has no test reading it afterwards") holds only when the prose and the test go
  in the SAME commit, which is task 5. So here: change the opening
  `The four rails` to five; write into rail 3 one short paragraph - a paragraph,
  never a second grammar and never a replacement table - saying that the guard reads
  only a segment that BEGINS with a git word, that this is a detection widener
  and not a security boundary (keep that sentence; it is the phase's whole
  thesis), that everything else is silent, and that a mention in any other
  position (`rg "git commit"`, `command -v git commit`, `echo "git push"`) is
  now silent rather than denied, which is what retired the command-position
  deny gate. For this ONE commit that paragraph sits above the
  `### What the guard sees` grammar it contradicts - stated here rather than
  left to be discovered, because task 5 removes the grammar and the only test
  that reads it together. While both live, two constraints: leave the
  `**Wrappers.** The stated set is ...` sentence at `git.md:172` byte-untouched,
  and do not write the phrase ``prefix commands `sudo` `` anywhere in git.md -
  those are exactly what the two surviving prose-reading rows assert
  (`shell-tokens.test.mjs:643-647,661-662`).
  Rail 3's "Every Bash `git push` the guard sees still asks
  unconditionally" sentence stays as it is - it is still true, and the only
  correction it needs is that what the guard SEES narrowed, which the new
  paragraph already states; do not add a deny arm to it. Add one clause to the
  cleanup paragraph
  (lines 118-122) naming `git-publish.mjs reap` as what performs the local
  delete while `land-cleanup.mjs cleanup` still only advises it. Add a
  `## 5. Destructive git (ask, never refuse)` section AFTER `## 4. Risk
  surfaces` so rails 1-4 keep their numbers (D-09: two shipped surfaces already
  cite rail 5 by number and sixteen prose citations name rails 1-4, none of
  them machine-checked). That section states the anchored reading rule and its
  cost, the six firing kinds with their exact spellings, the `ask | off` enum
  with no refusal value and why, that a staged-only restore is skipped unless
  `--worktree` joins it, that `git checkout -b <x>`, `git checkout <base>` and
  `git pull` stay silent because Cadence runs them at every cycle start and
  release close, that `git checkout -- path/to/file` DOES prompt even though
  the executor contract sanctions it (a discard is a discard and a prompt is
  the correct cost), that the hook emits ONE decision per Bash call so
  `git reset --hard && git push` shows the push rail's reason either way, and
  that `/cad-land`'s reap runs as a subprocess argv through `git-publish.mjs
  reap` so the sanctioned close never trips this rail. Do NOT edit
  `skills/cad-executor-contract/SKILL.md`: its instruction stays correct and
  that surface is byte-budgeted.
- **Verify:** `.planning/phases/2/probe-ac1-before.txt` exists and shows
  `(silent)` for all ten AC1 shapes, `deny` for `git commit -m x` and `ask`
  for `git push origin main` under refuse - the AC1 lines are what task 4
  inverts, the other two are what it must leave alone;
  `node --test cadence-core/bin/git-guard.test.mjs` passes with the ten
  AC1 rows, the eight AC2 rows and the five AC4 rows present by name;
  `grep -n "git push" cadence-core/bin/git-guard.test.mjs` is read hit by hit
  and no assertion on a push shape expects `deny` - a comment may discuss the
  word, an `assert` may not, and this is the check that catches the deny arm
  being reintroduced by habit;
  `grep -c "gitSubcommands\|shell-tokens\|What the guard sees\|Out of grammar" cadence-core/bin/git-guard.mjs`
  returns 0, settling all four comment sites and both dead heading citations in
  one check - git.md is deliberately NOT checked for those headings here, since
  it keeps them until task 5;
  `node --test cadence-core/bin/shell-tokens.test.mjs` still passes, which is
  the falsifiable form of "git.md grew without breaking the two prose-reading
  rows that outlive this commit";
  `grep -n "## 5. Destructive git" cadence-core/references/git.md` returns one
  hit below `## 4. Risk surfaces`; `node --test cadence-core/bin/*.test.mjs`
  and `npx tsc -p tsconfig.ci.json` both exit 0 and
  `node cadence-core/bin/self-verify.mjs` reports `ok:true`.

### Task 5: delete the parser and its written grammar, now that nothing reads either

- **Files:** cadence-core/bin/lib/shell-tokens.mjs (deleted),
  cadence-core/bin/shell-tokens.test.mjs (deleted),
  cadence-core/bin/lib/destructive-git.mjs (deleted),
  cadence-core/bin/destructive-git.test.mjs (deleted),
  cadence-core/references/git.md, INTERNALS.md,
  cadence-core/bin/self-verify.mjs, cadence-core/bin/self-verify.test.mjs
- **Action:** D-01, D-14, D-15, D-17, AC3's first half. `git rm` all four
  files - 840 + 733 + 367 + 311 lines, and with them the 280 currently-passing
  tests D-17 accounts for. This commit is a PURE SUBTRACTION of code and prose
  task 4 orphaned: nothing imports either module once `git-guard.mjs` reads
  `lib/git-segments.mjs`, so prove that with the grep below BEFORE deleting
  rather than after. In the SAME commit, delete `references/git.md`'s
  `### What the guard sees` grammar and its `### Out of grammar (rail 3)` table
  WHOLESALE (git.md:124-292 at plan time, ~13KB), leaving task 4's anchored
  paragraph as rail 3's only account of what the guard reads and taking nothing
  else with them - `## 4. Risk surfaces` and everything above line 124 stay.
  The prose belongs HERE and not in task 4 for one measured reason: the only
  file in the repo that reads git.md at runtime is
  `cadence-core/bin/shell-tokens.test.mjs:634`, whose `:643-647` row asserts
  that git.md states the wrapper set in a sentence matching
  `/The stated set is ([^.]+?), matched/` (its sole match is `git.md:172`,
  inside the deleted block) and whose `:661-662` row asserts git.md no longer
  states an enumerated prefix set. Both die with the file in THIS commit, which
  is exactly the condition D-14 assumes; separating them by one commit turns
  whichever went first red. That block deletion also takes the
  `cadence-core/bin/lib/shell-tokens.mjs` citation at `git.md:127`, which is
  one of the three references to the dying modules left under `cadence-core/`
  once task 4 has cleared `git-guard.mjs`. The other TWO are named here and
  must go in this
  same commit or AC3's "nothing under `cadence-core/` imports or names
  them" is false: the comment at `cadence-core/bin/self-verify.mjs:375` citing
  `cadence-core/bin/lib/shell-tokens.mjs` as the other spelling of the shared
  backslash-parity rule, and the same citation in the test comment at
  `cadence-core/bin/self-verify.test.mjs:246` - rewrite both to state the
  parity rule self-verify actually implements without naming a file that no
  longer exists, and change NOTHING else in either file, since their behaviour
  is not this phase's business. In `INTERNALS.md` line 35 the `Read the code:`
  line backticks both `cadence-core/bin/lib/shell-tokens.mjs` and
  `cadence-core/bin/shell-tokens.test.mjs`; self-verify check 3b `existsSync`
  tests every backticked repo path there, so leaving them produces two
  `missing-internals-path` problems and flips the run to `ok:false` (D-15).
  Replace them with `cadence-core/bin/lib/git-segments.mjs` and
  `cadence-core/bin/git-segments.test.mjs`, and in the same pass correct
  INTERNALS line 33, which claims the guard "descends into substitutions and
  subshells, and re-tokenizes the argument of a stated set of shell wrappers"
  and points at rail 3's out-of-grammar list - rewrite that sentence to the
  anchored rule and the destructive rail, and keep its surrounding argument
  intact: the allow-list-predicate versus detection-widener distinction is
  still true and still why `isPlainPush` stays deleted. INTERNALS is edited
  HERE rather than in task 7 because the deletion is what forces it; task 7
  does not touch this file.
- **Verify:** `git ls-files | grep -c "shell-tokens\|destructive-git"` returns
  0; `grep -rn "shell-tokens\|destructive-git\|gitSubcommands\|destructiveInvocation" cadence-core/`
  returns nothing;
  `grep -c "What the guard sees\|Out of grammar" cadence-core/references/git.md`
  returns 0 while `grep -n "## 4. Risk surfaces\|## 5. Destructive git" cadence-core/references/git.md`
  still returns both headings in that order, proving the deletion took the two
  blocks and not their neighbours;
  `grep -c "command -v git commit" cadence-core/references/git.md` returns at
  least 1 - with the old block gone the only possible hit is task 4's anchored
  paragraph, so this is where "the position-gate record survived as prose"
  becomes falsifiable rather than satisfied by the text being deleted;
  `grep -n "descends into\|re-tokeniz\|substitutions and subshells\|shell wrappers" INTERNALS.md`
  is read hit by hit and no hit states present-tense guard reach (AC5's
  `INTERNALS.md:33` clause - nothing else in the phase greps this file, and
  task 7's pattern is run against four other docs);
  `node --test cadence-core/bin/*.test.mjs` exits 0 with a
  test count 280 lower than the 1315 baseline plus whatever tasks 3-4 added,
  and no failures; `npx tsc -p tsconfig.ci.json` exits 0;
  `node cadence-core/bin/self-verify.mjs` reports `ok:true` with no
  `missing-internals-path`.

### Task 6: the shipped record states the cost, and TOK-01 reads as superseded

- **Files:** CHANGELOG.md, .planning/REQUIREMENTS.md
- **Action:** D-03, D-07, D-13, AC3's CHANGELOG half, AC5's record half. Open a
  NEW `## [Unreleased]` section at the top of `CHANGELOG.md`, above
  `## [2.0.0]` (the file opens straight into it today at line 7;
  `prependChangelogEntry` skips a leading Unreleased section, so the next
  milestone close inserts its dated heading BELOW rather than rewriting it -
  D-13, verified against `lib/release-decision.mjs:106-122`). In ONE subsection
  state the removal AND its accepted cost together - not in two places, and not
  with the cost buried under it. State the rule first, because the rule is what
  makes the list complete: the guard now reads only a `[;|&\n]`-delimited
  segment that BEGINS with a git word, so any shape that puts the git word
  anywhere else is silent. Then name the instances, each of which was measured
  asking (or denying) at `e051a1d` and is silent after: `bash -c "git push"` /
  `sh -c` / `zsh` / `dash` / `eval` and every prefixed form of them,
  `env -S "git push"` and the whole `env` family, `$(git push)`, a backticked
  `git push`, `(git push origin main)`, the line-continuation shape (`git \`
  newline `push`), `git -C "<path with space>" push` AND the ordinary
  `git -C <path> push` / `git -C . -c user.name=t push` forms (the reader skips
  no option's argument, so the cost is wider than the quoted-path shape D-03
  names), a transparent prefix (`sudo git push`, `timeout 60 git push`,
  `xargs -I{} git push`), a `VAR=value` assignment prefix, and an unterminated
  quote carrying a git word. Name what SURVIVES in the same subsection so the
  entry cannot be read as claiming more reach removed than was removed: `&` as
  a separator, `;`-separated commands including the escaped-quote shape, and
  the plain forms. Name the two halves of TOK-01 separately (D-07): the six
  push-hole closures keep prompting only in their anchored forms, and the
  command-position deny gate does not survive at all - `bash -c "git commit"`,
  `env -S "git commit"`, `$(echo) git commit` and `VAR=x git commit` no longer
  deny under `git.on_protected: refuse` and no longer produce any decision,
  while `command -v git commit`, `grep git commit` and `rg -t sh "git commit"`
  go from a false ask to silence. State the ONE addition in the same section:
  rail 5 behind `git.on_destructive` (default `ask`, enum `ask | off`, no
  refusal value) with its six firing kinds. Say in the same breath that the
  release adds no new deny - `git.on_protected: refuse` is still the guard's
  only hard block and still reaches only `git commit`, now anchored - because
  a reader of an entry this size will otherwise assume a newly guarded command
  class came with a newly hard-blocked one. State
  the knowingly-silent destruction the anchored reader does not reach, rather
  than leaving it unstated: any destructive verb behind a wrapper, prefix,
  substitution or `-C <path>`, plus `git branch -M` and `git checkout -B`,
  which sit outside D-05's named set. Then annotate the v1.4.0 subsection
  `**One quote-state tokenizer for the git-guard rails**` (line 428) with ONE
  dated line saying v2.2.0 superseded BOTH halves and pointing at the
  Unreleased section. ONE line is enough and a second annotation site would be
  wrong: that subsection runs to line 488 and holds both halves already - the
  push-hole closures at `:430-436` (that bullet counts seven, the six recorded
  holes plus `eval`) and the command-position deny gate at `:446-464` - so
  AC5's "BOTH halves" is satisfied by a single note placed
  directly under the heading, before its first bullet. Leave its historical
  claims themselves untouched, since
  a changelog that edits what a release said is worse than one that records
  what replaced it. Finally annotate TOK-01's `## Shipped` row at
  `.planning/REQUIREMENTS.md:84` in place: append a superseded-by clause naming
  TOK-02, v2.2.0 and BOTH halves to the existing cell. Do not rewrite the row,
  do not restate what it shipped, do not move it, and leave the
  `## Traceability` table byte-identical apart from the phase-2 row.
- **Verify:** `sed -n '1,12p' CHANGELOG.md` shows `## [Unreleased]` above
  `## [2.0.0]`; every shape named in the cost list is confirmed silent by
  running it through the hook from a fixture project (each returns empty
  stdout) and every shape named as surviving is confirmed still asking - the
  list is checked against the code, not against this plan; then the same check
  run the OTHER way, which is what catches a dropped shape rather than a false
  one - print the section with
  `sed -n '/^## \[Unreleased\]/,/^## \[2\.0\.0\]/p' CHANGELOG.md` and confirm
  by eye that it names, at minimum, `bash -c`, `sh -c`, `env -S`, `$(git
  push)`, a backticked `git push`, the line-continuation shape, `git -C` (both
  the quoted-path and plain forms), `sudo git push`, a `VAR=` assignment
  prefix, `xargs`, an unterminated quote, and all four deny-gate shapes
  (`bash -c "git commit"`, `env -S "git commit"`, `$(echo) git commit`,
  `VAR=x git commit`), plus `&` and `;` as SURVIVING. AC3's parenthetical names
  six of these; the measured list is wider (see the Notes), and naming the
  measured set satisfies AC3 as a superset while satisfying its intent, which
  is that the stated cost match reality;
  `grep -n -A2 "One quote-state tokenizer for the git-guard rails" CHANGELOG.md`
  shows a dated v2.2.0 supersession line immediately under that heading naming
  BOTH the push-hole closures and the command-position deny gate and pointing
  at Unreleased - AC5's CHANGELOG half, which nothing else in the phase checks;
  `grep -n "TOK-01" .planning/REQUIREMENTS.md` shows the Shipped row annotated
  and still under `## Shipped`; `node cadence-core/bin/planning.mjs audit`
  reports the same traceability rows as before the edit;
  `node cadence-core/bin/self-verify.mjs` reports `ok:true`.

### Task 7: the four narrative docs stop advertising reach that is gone

- **Files:** README.md, DESIGN.md, METHOD.md, .planning/PROJECT.md
- **Action:** D-16, AC5, and the stale premise CONTEXT flagged. Check each
  claim against the hook before editing it rather than trusting this list.
  `README.md:23` says the guard "reads shell quoting properly enough to notice
  `git -C "my repo" push`, `bash -c "git push"`, a backtick, a subshell and an
  `&`" - of those five only `&` survives, so cut the four, say what the guard
  reads now (a segment that begins with `git`) and what the parser was traded
  for (the destructive rail, which stops the one class that destroys
  uncommitted work with no recovery). The paragraph two above it ends "Every
  push it tries to run stops and asks you first" - that promise is still kept
  for every push the guard SEES and the rail still emits no deny, so correct
  only the reach it implies (a push the hook sees is one written as its own
  command, not one behind a wrapper or a prefix) and change nothing about the
  ask. Keep the `isPlainPush` narrative exactly as it is: R2 is unreversed and
  this phase strengthens it. `DESIGN.md:541-548` is R2's `*Note, 2026-07-27
  (v1.4.0):*` - do not rewrite it; add a SECOND dated note in that same idiom
  recording the v2.2.0 narrowing, that the tokenizer it describes was deleted
  rather than patched after three blocking review panels, that R2 itself is
  still unreversed (the allow-list predicate stays deleted, and the anchored
  reader still decides nothing is safe), and that being wrong here still costs
  a prompt. `METHOD.md`'s "Git is guarded by the harness, not by intentions"
  section carries no wrapper or tokenizer claim - confirm that with a grep
  rather than assuming it - so add the destructive rail to its rails paragraph
  so the method doc states the prompt users will actually see, and correct
  nothing else there. `.planning/PROJECT.md:104-112` is the titled block
  "**TOK-02 changed shape during the triage**", which argues FOR the redirect
  and AGAINST this rip-out; it is stale and was never corrected when the
  premise reversed. Replace its argument with what happened: the redirect was
  falsified by measurement rather than opinion (three consecutive blocking
  `risk_surface` panels, three families of silent unrecoverable destruction
  surviving a 367-line option-grammar model, and gate 2's fix introducing gate
  3's blocker), so the parser is deleted and the destructive class is covered
  by an anchored reader instead; and Forgejo issue #25 is left OPEN with the
  narrowed coverage noted, not closed, since its text is unread and the
  decision needs the tracker. Leave PROJECT.md's "**The version is a minor, not
  a patch**" block at lines 96-102 untouched: it is still true and the release
  seam reads that prose.
- **Verify:** `grep -n "bash -c\|subshell\|backtick\|re-tokeniz\|descends into\|quote state\|quote-state" README.md DESIGN.md METHOD.md .planning/PROJECT.md`
  is read hit by hit and every remaining hit is either inside an explicitly
  dated historical annotation or is about the deleted `isPlainPush` allow-list
  predicate - no hit states present-tense guard reach the hook no longer has;
  `grep -n "changed shape during the triage" .planning/PROJECT.md` returns
  nothing; running `bash -c "git push origin main"` through the hook from a
  fixture project prints empty stdout, which is the claim README no longer
  makes; `node cadence-core/bin/self-verify.mjs` reports `ok:true` and
  `node --test cadence-core/bin/*.test.mjs` exits 0.

## Notes

**Plan shape: ONE plan, not the three CONTEXT directed.** The independence test
(no shared files, no cross-slice ordering, each slice independently verifiable)
fails on four counts, three of them hard. (1) `INTERNALS.md` is written by BOTH
proposed slice 1 and slice 2: D-15 forces the `Read the code:` path fix INTO
the deletion commit (self-verify check 3b `existsSync`-tests every backticked
repo path, so the deletion alone flips the run to `ok:false`), while AC5 puts
line 33's reach claim in the record-honesty pass. Same paragraph block, two
slices - a shared file, which the test forbids outright. (2) Slice 3's cad-land
prose cites `git-publish.mjs reap`, and the CONTRACTS row that makes that legal
sits in the STAGED `self-verify.mjs` that D-10 assigns to slice 1's first task:
run slice 3 first and self-verify reports `unknown-subcommand`, so slice 3's own
Verify fails. That is cross-slice ordering, not a preference. (3) D-10's staged
five files are a working-tree hazard for every path in the phase, and a parallel
split has no "first plan" to hang "commit this before anything else" on - a
worktree forked from HEAD does not carry them at all. (4) Softer but real: the
record-honesty pass asserts what the removal made true, and landing it first
puts a false claim in the shipped record, which is the exact prose/code drift
this phase exists to end. File independence is the hard constraint and it loses
here, so the directive is not followed and the deviation is recorded rather than
taken silently.

**Sequencing against the `risk_surface` panel, decided.** CONTEXT left this to
/cad-plan. The measured failure is not panel COUNT but payload size: `openai`
was lost to the 10-minute host ceiling at 36KB and again at 80KB. So the rule
here is ADDITION BEFORE SUBTRACTION and never both in one commit - the inverse
of CONTEXT's suggested ordering, reaching the same goal. Task 3 lands the
reader alone (~130 lines plus a table test, well under the 36KB that already
timed out once). Task 4 lands the rewire, the corpus re-pin and git.md's
ADDITIONS - ~25KB when this plan first drew that boundary, ~13KB lighter now
that the git.md grammar moves to task 5, and still no deletions. Task 5 is
then a PURE subtraction of
provably-dead code and the prose describing it, which is both the largest
payload in the phase (~120KB across the four deleted files, plus the ~13KB
git.md grammar) and the cheapest thing an adjudicated panel can settle - the
only question a reviewer can ask of it is "is it really dead?", and `grep -rn`
answers that in one line. Deleting first,
as CONTEXT floated, is not available: `git-guard.mjs` imports the module, so a
deletion-first commit leaves the hook throwing and the suite red, which is not
a committable task. Splitting task 5 into two smaller deletions was considered
and rejected: it buys one more full blocking panel to protect the payload where
losing a reviewer costs least.

Two boundaries inside that rule are forced rather than chosen. The git.md
SUBTRACTION rides with task 5 instead of task 4 because
`cadence-core/bin/shell-tokens.test.mjs:634,643-647` reads git.md at runtime
and asserts a sentence inside the deleted block (`git.md:172`), so the prose
and the only file that reads it must die in one commit - which is what D-14
already assumes; splitting them by one commit turns whichever moved first red,
and it is task 4 that would have had no authorized file to fix. That move also
takes ~13KB off the phase's most-scrutinized commit. Going the other way and
splitting task 4's `git-guard.test.mjs` re-pin into its own task is NOT
available: the corpus asserts the old reader's behaviour on roughly two-thirds
of its rows, so a rewire without the re-pin (or a re-pin without the rewire)
leaves `node --test cadence-core/bin/*.test.mjs` red, which fails AC7 and the
"leaves the repo committable" bar for whichever commit lands first. A source
behaviour change and its test corpus are one atom here.

**The deny surface does not move, and that is settled rather than assumed.** An
earlier cut of this plan read AC4's first draft literally and gave rail 3 a
deny arm under `git.on_protected: refuse`; the criterion has since been
corrected and D-04 carries the matching clause, so no such arm is planned. The
measurement behind it: `git-guard.mjs:165-169` hardcodes `decide('ask', ...)`
and returns on the push rail, so only `isCommit` ever reaches `commitDecision`
and no `git push` spelling has ever denied. What this phase does to that
surface is ANCHOR it, never widen it - `bash -c "git commit"`,
`env -S "git commit"`, `$(echo) git commit` and `VAR=x git commit` stop
denying (they stop producing any decision at all), while
`command -v git commit`, `grep git commit` and `rg -t sh "git commit"` go from
a false ask to silence. Both directions are named in task 6's entry, task 4
carries `git commit -m x` `deny` and `git push origin main` `ask` through the
swap unchanged, and task 4's Verify greps the guard's own test file to prove
no push row asserts a deny. Sequencing is unaffected: dropping the arm removes
roughly six lines from `git-guard.mjs` and four test rows, which moves task
4's payload by well under 1KB against the ~25KB that decided the
addition-before-subtraction order, so tasks 3, 4 and 5 keep their boundaries.

**The accepted-cost list is wider than D-03's six shapes, measured not
predicted.** Every shape in task 6's list was run through the real hook at
`e051a1d` before this plan was written. Confirmed still asking after the swap
and therefore NOT listed as silenced: `git add -A & git push origin main` (the
`&` split survives), `echo \" ; git push origin main; echo "done"`,
`git add . && git push`, and the two `echo hi $(echo)#x; git push` rows.
Confirmed newly silent BEYOND D-03's named six: `sudo git push`,
`VAR=1 git push`, `xargs -I{} git push`, `git -C . push` / `git -C /tmp push`
(not only the quoted-path form), an unterminated quote carrying a git word, and
the four deny-gate shapes that currently hard-block under `refuse`
(`bash -c "git commit"`, `env -S "git commit"`, `$(echo) git commit`,
`VAR=x git commit`). Recalled prior art, cited: the six rail-3 push holes
TOK-01 closed are recorded in `.planning/CAPTURE.md` (phase 4), and the
rip-out-versus-keep decision this phase resolves is the v1.4.0-close OPEN
DECISION in the same file - both say the rail's adversary is the model issuing
the command, not an attacker.

**Working tree.** `.planning/config.json` carries an unrelated unstaged edit
(it removes `review.triggers.diff.gate`). It belongs to the user, not to this
phase: leave it modified-unstaged and stage every commit by explicit path. The
four commits already on this branch (`776e6a0`, `d4861ae`, `d7e50a7`,
`930dda3`) STAY and are superseded (D-06) - nothing here reverts or resets, and
`930dda3`'s three keepers (`git.on_destructive` across four config surfaces,
`weight-budgets.json` at 18433 for `workflows/config.md`, and the
`config-reach.md:131` fix) are all still wanted, which is why no task re-adds
the config key.

**Not in scope, deliberately rather than by omission.** Re-catching any shape
the anchored reader silences (that is TOK-02's stated cost, not a gap);
`git branch -M` and `git checkout -B`, which overwrite refs but sit outside
D-05's named firing set and are named as knowingly-silent in task 6 instead;
Forgejo issue #25, which is left open with a note because its text is unread
and no local copy exists; and `skills/cad-executor-contract/SKILL.md`, whose
sanctioned `git checkout -- path/to/file` instruction stays correct and whose
surface is byte-budgeted - the prompt it now draws is documented at rail 5 and
pinned by a test instead.
