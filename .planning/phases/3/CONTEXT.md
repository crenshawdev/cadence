# Phase 3: One quote-state tokenizer for git-guard - Context

Gathered: 2026-07-27
Feeds: /cad-plan 3

The analysis pass reproduced all six holes named in the roadmap goal against a
throwaway `.planning` fixture at HEAD - each produces empty stdout, no decision -
and found a seventh in the same family: `eval "git push origin main"` is equally
silent. `git push origin main`, `git -C . push origin main`,
`GIT_SSH_COMMAND=x git push origin main` and `xargs -I{} git push origin main`
all ask correctly today, so the rail works on the shapes it sees; the defect is
entirely in what it fails to see.

## Scope boundary

In: one pure quote/escape-state tokenizer in `cadence-core/bin/lib/` (D-07) that
`git-guard.mjs` imports, replacing the strip-and-split arms (D-01) plus the
parity-aware continuation pre-pass (D-06); a stated wrapper set whose argument is
re-tokenized (D-02); nested-command descent and the widened separator set (D-11);
an ask-on-unplaced-git-word rule that gives phase-1 D-20 a runtime signal on a
surface with one output channel (D-03); both rails driven from the same tokenizer
output, preserving phase-4 D-07 (D-04); the grammar written down in
`cadence-core/references/git.md` with its out-of-grammar list (D-05, D-12); a
parser-level table test alongside seam rows (D-09); and the shipped claims that
the tokenizer contradicts - the "I deleted the parser" narrative (D-08), the
`self-verify` one-idiom assertion (D-13), and a new CHANGELOG entry (D-14).

Out: the `git-guard.mjs` fail-open on a malformed `.planning/config.json` and the
unthreaded `mergeLayers` `warnings[]`, both known by-design holdouts unrelated to
what the guard can see. Heredocs, `<<<`, `$'...'` ANSI-C quoting and
`${var:-...}` nesting inside `$()` are named out-of-grammar rather than
implemented (D-05). Any rewrite of the `[1.3.1]` CHANGELOG entry (D-14). Any
`CONTRACTS` entry for the hook (D-10). Any change to rail 1 or rail 2 semantics
beyond what the shared tokenizer output implies.

Deferred: None
Plan shape: one plan - every criterion depends on the tokenizer contract
existing first, and the only file-disjoint split (lib+test, then rails+docs) is
serial by dependency anyway, so a split would pay bookkeeping for no parallelism

## Durable decisions

- D-01 (quoted spans become word content; a git word is recognized by command
  position, not by surviving a strip): the strip-and-split approach is deleted
  rather than extended, per phase-1 D-03 - accretion is what produced phase 4's
  own two push-rail regressions. `cadence-core/bin/git-guard.mjs:93-113` replaces
  a quoted span with a single space, `split(/\s+/)` collapses it, and
  `GIT_OPT_WITH_ARG` then eats `push` as `-C`'s argument, so
  `git -C "my repo" push origin main` resolves to `['origin']`. This is hole (a),
  the likeliest of the six since a checkout path with a space is entirely
  ordinary. Preserving word boundaries fixes it without making quoted text
  command-bearing everywhere - the alternative that would break
  `git-guard.test.mjs:123-133`, where `echo "git push"` and
  `git log --grep "push"` must stay silent. Chosen over emitting a placeholder
  token to preserve word count only, and over special-casing `-C`'s argument.
- D-02 (a stated set of shell-invoking wrappers gets its argument re-tokenized):
  the set is `bash`, `sh`, `zsh`, `dash` and `eval`, tolerating `-c` among other
  flags (`-lc`, `-exc`) and an `env` prefix, and its membership is written down
  in `references/git.md` rather than implied by the code. The roadmap goal names
  only `bash -c` / `sh -c`, but `eval "git push origin main"` was verified
  silent at HEAD, so a set stopping at bash/sh would ship a rail-3 claim beside
  an adjacent, trivially reachable hole - the six-holes-minus-one situation this
  phase exists to end. Chosen over re-tokenizing every quoted span, which closes
  the family with no set to maintain but breaks the two shipped silence tests and
  would prompt on ordinary commit messages mentioning pushing. Evidence:
  `cadence-core/bin/git-guard.test.mjs:127`; `.planning/CAPTURE.md:9`.
- D-03 (an unresolvable shape stays silent unless it carries a git word the
  tokenizer could not place, in which case the guard asks): a PreToolUse hook has
  exactly one output channel - `permissionDecision` plus
  `permissionDecisionReason` (`git-guard.mjs:33-41`) - so there is no additive
  `frontmatter_issues`-style field to carry a diagnostic, and phase-1 D-20's
  requirement that an out-of-grammar shape stay detectable has to be answered in
  the decision itself. `echo "unterminated` and `eval $CMD` carry no git token
  and stay silent; an unterminated quote around `git push origin main` asks. The
  boundary that keeps `git-guard.test.mjs:127` green: a quoted argument of a
  command outside D-02's set is *placed* - it is an argument - so
  `echo "git push"` is resolved, not unresolvable. Chosen over keeping silence
  and satisfying D-20 on paper only, and over asking on anything unresolvable,
  which contradicts the posture `git-guard.mjs:22-24,75-77` states three times
  ("a broken guard must never block normal work").
- D-04 (both rails widen in lockstep; the new hard denies under
  `git.on_protected: refuse` are accepted): `git-guard.mjs:70-73` states phase-4
  D-07 - the two rails must agree on what a wrapped command IS - and `:137-179`
  routes both through the same `gitSubcommands` result, so the tokenizer feeds
  both or D-07 becomes false. Consequence, accepted: a downstream user on
  `refuse` finds `bash -c "git commit ..."` and `git -C "my repo" commit ...`
  hard-blocked on a protected branch, which is what `refuse` means; this repo
  runs `ask` (`.planning/config.json`), so the harsher path is a downstream
  configuration rather than a local one. Chosen over driving push detection only
  and leaving the commit rail on the existing path (keeps the blast radius on the
  ask-only rail, but retires a stated invariant), and over downgrading
  tokenizer-only shapes to `ask` under `refuse`, which adds a second severity
  rule the rails do not have today.
- D-05 (the grammar reach is a stated subset, and the rest is named rather than
  silently unsupported): single quotes (no escapes), double quotes (backslash
  escapes a named character set), a bare backslash escape outside quotes,
  `$(...)`, backticks, `(...)` subshells, and the separator set. Heredocs, `<<<`,
  `$'...'` ANSI-C quoting and `${var:-...}` nesting inside `$()` are declared
  out-of-grammar in `references/git.md`, each with a table row pinning its stated
  behavior - phase-1 D-20's rule that declaring something out of scope without
  detectability leaves exactly the silent misread the goal names. No file in this
  repo states a shell grammar today; the only existing rules are the two regexes
  at `git-guard.mjs:90-99`. Chosen over mirroring POSIX more fully, which is a
  much larger state machine for shapes no capture item has ever observed in a
  Cadence session.
- D-06 (one escape-state rule replaces the parity-aware continuation pre-pass):
  `git-guard.mjs:84-99` runs the parity join and the `"(?:[^"\\]|\\.)*"` arm as
  two separate mechanisms; a backslash outside quotes escapes the next character
  (so `\"` is a literal quote and backslash-newline is a continuation), a
  single-quoted span honors no escapes, and a double-quoted span honors D-05's
  stated subset. This is what closes hole (e), where an escaped `\"` opens a
  quoted region for the strip which then deletes the real push. The gate is
  `git-guard.test.mjs:135-203`, which pins odd/even backslash-run parity, CRLF
  continuation, the `echo "foo \` + newline + ` git push bar"` false positive
  (phase-4 D-08) and the `awk -F'"'` alternation case; the even-backslash parity
  case is the one `#50`'s first cut silently missed, so it is the likeliest
  regression. Chosen over keeping the parity join as a pre-pass and giving the
  tokenizer escape state only inside quotes.
- D-07 (the tokenizer is a pure, total module under `cadence-core/bin/lib/`, not
  an inline function in the hook): `git-guard.mjs:182` runs
  `try { main(); } catch {}` at module top level, so importing the hook file
  executes `main()` and reads fd 0 - it cannot be imported for testing at all.
  `lib/publish-decision.mjs` ("pure, testable core ... never runs live git and
  never does I/O ... unknown/missing inputs never throw") and
  `lib/branch-decision.mjs` are the precedents, `git-guard.mjs:31` already
  imports from `./lib/`, and `tsconfig.ci.json`'s
  `include: ["cadence-core/bin/**/*.mjs"]` covers a new lib file with no config
  change. Without it the grammar table runs through `guard()`, paying a
  `mkdtempSync` + `git init` + `execFileSync` node spawn per row
  (`git-guard.test.mjs:21-51`) - the exact per-case cost phase-1 D-06 cited when
  it put breadth in a parser-level table. Chosen over adding an
  `import.meta.main`-style guard to the hook so it can be imported inertly.
- D-08 (the "I deleted the parser" narrative is amended in the same change that
  ships the tokenizer): the docs are corrected to distinguish an *allow-list
  predicate* - deleted because it is unwinnable, since it must be right to let a
  command through - from a *detection widener*, which fails toward asking and is
  what this tokenizer is. `README.md:24` ("I was going to be patching that parser
  until one of us died. I deleted it instead... Do not try to out-parse an
  attacker, delete the thing you would have had to parse"), `INTERNALS.md:19-31`
  (heading: "The push guard, and the parser I didn't write", with `git-guard.mjs`
  in its Read-the-code list) and `DESIGN.md:412-417` (reversal R2) are all read
  by `/cad-docs-verify` by default (`workflows/docs-verify.md:8-9`). Left
  standing, either the check reports them stale or - worse - certifies them
  accurate against a file that now imports a shell tokenizer, and a later
  contributor cites R2 to argue the tokenizer should be deleted. Phase-2 D-11 is
  the precedent for moving contradicted shipped claims inside the phase that
  contradicts them. Note `self-verify.mjs:142-148` walks these files but
  `lib/surface-weight.mjs` does not, so the edits cost no budget.

## Decisions

- D-09 (a parser-level table test lands as a sibling `cadence-core/bin/*.test.mjs`
  alongside - never instead of - seam rows in `git-guard.test.mjs`): phase-1 D-06
  verbatim, with `planning-files.test.mjs:1-11` stating the pattern and
  `publish-decision.test.mjs` / `branch-decision.test.mjs` as the lib-module
  precedents. `.github/workflows/test.yml:27` globs `cadence-core/bin/*.test.mjs`,
  so a new file is picked up with no CI change. Each of the seven closed shapes
  also earns a seam row, because a defect proven only at the parser level is not
  proven to reach the permission prompt - the hook's only observable.
- D-10 (`git-guard.mjs` owes no `CONTRACTS` entry): phase-2 D-04's obligation
  attaches to seam *subcommands*, and the hook takes none - `hooks/hooks.json`
  invokes it with no args and no flags, and `self-verify.mjs:37-93` lists only
  subcommand-bearing seams. Adding a key would arm self-verify check 2 against
  every prose mention of `git-guard.mjs <word>`, manufacturing
  `unknown-subcommand` problems from sentences like `INTERNALS.md:31`.
- D-11 (nested-command descent and the widened separator set fall out of D-01):
  `$(...)`, backticks and `( ... )` are structural contexts the tokenizer
  descends into rather than text to strip, closing holes (c) and (d) -
  `git-guard.mjs:103` tests `w === 'git' || w.endsWith('/git')`, which never
  matches `$(git`, `` `git `` or `(git`, while `( git push )` *with* a space IS
  caught, so today's rail turns on incidental whitespace. `&` joins the separator
  set (`:101` splits on `/&&|\|\||[;|\n]/` with no `&`, hole (b)) and a segment
  reports every git invocation rather than the first (`:103-111` takes the first
  git word then `break`s). Stated as one tokenizer output contract, not as two
  more arms.
- D-12 (the grammar is stated in `cadence-core/references/`, which costs no
  weight budget): `lib/surface-weight.mjs:8-12,53-78` measures only `agents/*.md`,
  `skills/**/SKILL.md` and `cadence-core/workflows/*.md`, and
  `weight-budgets.json` carries no `references/` entries.
  `references/plan-frontmatter.md` is the phase-1 / phase-2 D-16 precedent, cited
  from both code and a workflow; `references/git.md:94-113` is the rail-3 text
  this replaces. Live check at gather time: every measured surface equals its
  budget byte-for-byte (`workflows/task.md` 3671, `execute.md` 12292,
  `skills/cad-land/SKILL.md` 7765), so any byte added to a measured surface needs
  `weight-budgets.json` in the same commit or CI fails `budget-overrun`. Same
  rail as phase-1 D-22 and phase-2 D-15.
- D-13 (the shared-idiom claim moves with the regex): `self-verify.mjs:243-258`
  asserts "git-guard.mjs carries the identical regex for the same reason, so the
  two seams stay one idiom rather than two spellings (D-15)", and
  `self-verify.test.mjs:110-121` encodes the same claim in its test name and body.
  Nothing lints comments or test names, so if D-06 removes the parity regex from
  `git-guard.mjs` and these stay, the drift is silent and the next reader either
  "restores" a regex `git-guard` no longer has or edits `self-verify` to match a
  spelling that no longer exists.
- D-14 (the `[1.3.1]` "Known gaps" bullet stays as written; closure is recorded
  in a new `[1.4.0]` entry): `CHANGELOG.md:85-96` honestly recorded the six holes
  as a known gap, and editing that entry rewrites shipped release history to hide
  it. `self-verify.mjs:3-9,142-148` deliberately excludes CHANGELOG from the
  live-surface checks for exactly this reason - those files "legitimately name
  keys that were later cut, while explaining the cut".

## Acceptance criteria

- [ ] Each of the seven silent shapes - `git -C "my repo" push origin main`,
      `git add -A & git push origin main`, `$(git push origin main)`,
      `` `git push origin main` ``, `(git push origin main)`,
      `echo \" ; git push origin main; echo "done"`, and
      `bash -c "git push origin main"` (with `sh -c`, `zsh -c` and `eval` in the
      same row set) - fed to `git-guard.mjs` on a protected branch returns a
      `permissionDecision` of `ask`, where HEAD returns empty stdout for all of
      them.
- [ ] The shipped silence and false-positive cases still return no decision:
      `echo "git push"`, `git log --grep "push"`, `echo "foo \` + newline +
      ` git push bar"`, the `awk -F'"'` alternation, and both the odd- and
      even-backslash continuation parity cases.
- [ ] A command carrying a git word the tokenizer cannot place (an unterminated
      quote around `git push origin main`) returns `ask`; an unresolvable command
      with no git word (`echo "unterminated`, `eval $CMD`) returns no decision.
- [ ] `bash -c "git commit -m x"` on a protected branch returns `deny` under
      `git.on_protected: refuse` and `ask` under `ask`, matching what the bare
      `git commit -m x` form returns for the same config.
- [ ] `cadence-core/references/git.md` states the tokenizer grammar and names
      heredocs, `<<<`, `$'...'` and `${var:-...}` nesting as out-of-grammar, and
      each named out-of-grammar shape has a row in the parser-level test
      asserting its stated behavior.
- [ ] `/cad-docs-verify` reports no stale claim in `README.md`, `INTERNALS.md` or
      `DESIGN.md` that Cadence's push guard parses nothing, and
      `self-verify.mjs`'s "one idiom, shared with git-guard" comment and its test
      name name a regex that both files still carry.
- [ ] `node --test cadence-core/bin/*.test.mjs` and
      `npx tsc -p tsconfig.ci.json` both pass, `self-verify` reports no
      `budget-overrun`, and the new grammar rows for criteria 1-4 are among the
      passing set.

## Flagged assumptions

- The exact POSIX/bash quoting and escape semantics the tokenizer mirrors were
  not verified against a spec - Unclear, and bounded rather than resolved by
  D-05: no shell rule is asserted beyond the stated subset, so the risk is that
  the double-quote escape set diverges from bash on some character, not that an
  unstated rule is being relied on. Would matter if a later cycle takes heredocs
  or ANSI-C quoting into the grammar.
- Which shell Claude Code's Bash tool actually runs, and whether the
  `tool_input.command` the hook receives is byte-identical to what executes
  (login shell, zsh-only constructs, any host pre-processing) - Unclear. The repo
  records only the hook contract (`hooks/hooks.json`, `git-guard.mjs:22-24`) and
  never the executing shell. If the host pre-processes the command, the tokenizer
  reads something other than what runs, and D-02's wrapper set is aimed at the
  wrong text. `zsh` is in the set partly because this session's shell is zsh.
- Whether D-03's ask-on-unplaced-git-word rule fires often enough in real
  sessions to feel like noise - Likely rare; it requires both an unresolvable
  shape and a git token, and every resolvable shape (including a quoted argument
  of a non-wrapper command) is unaffected. Not measured, only reasoned.
- `git-guard.mjs`'s fail-open on a malformed `.planning/config.json`, and the
  `mergeLayers` `warnings[]` that no caller but `config.mjs get` consumes, stay
  open - Confident and deliberate: both are known by-design holdouts about what
  the guard *trusts*, not about what it can *see*, which is this phase's subject.
