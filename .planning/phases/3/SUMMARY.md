# Phase 3: One quote-state tokenizer for git-guard - Summary

**Status:** executed | **Commits:** `c2265ca..dd7072a` (9) | **Plan:** PLAN.md (7 tasks)

## What shipped

One left-to-right quote/escape-state tokenizer, `cadence-core/bin/lib/shell-tokens.mjs`,
is now the single command reader for both git-guard rails. The two strip-and-split
regexes and the parity-aware continuation pre-pass are deleted, not extended:
`grep -c "replace(/" cadence-core/bin/git-guard.mjs` is 0. The module is pure and
total - no I/O, never throws, bounded descent (`MAX_DEPTH` 8), bounded expansion
(`MAX_EXPANSIONS` 200), bounded command count (`MAX_COMMANDS` 1000).

All seven shapes that reached the network silently now ask, verified end-to-end
through the real hook against a fixture repo on `main`:

| Shape | At `c2265ca` | At `dd7072a` |
|---|---|---|
| `git -C "my repo" push origin main` | silent | ask |
| `git add -A & git push origin main` | silent | ask |
| `$(git push origin main)` | silent | ask |
| `` `git push origin main` `` | silent | ask |
| `(git push origin main)` | silent | ask |
| `echo \" ; git push origin main; echo "done"` | silent | ask |
| `bash -c "git push origin main"` | silent | ask |

The false-positive set still returns no decision: `echo "git push"`,
`git log --grep "push"`, `git add . # git push`, `echo "it's just git push text"`,
`git stash push -m wip`.

A third rail was added: a `git` word the tokenizer cannot place yields `ask`,
never `deny`. `gitSubcommands` returns `{subs, unplaced, denyable}`; detection is
any-position, refusal requires the git word at index 0 of its own simple command.

The grammar and a 9-row out-of-grammar table are written down in
`cadence-core/references/git.md` rail 3, each row pinned by a test, and the
"I deleted the parser" narrative in README/INTERNALS/DESIGN moved with it.

Final state: `node --test cadence-core/bin/*.test.mjs` 625 pass / 0 fail,
`npx tsc -p tsconfig.ci.json` exit 0, `node cadence-core/bin/self-verify.mjs`
`{"ok":true,...,"problems":[]}`.

## Commits

| Task | Commit | What |
|---|---|---|
| 1 | `2c38ecb` | the tokenizer core as a pure lib module |
| 3 (lib half) | `fe0c34c` | the shell-wrapper set under a hard budget |
| 2 | `0290ed3` | both rails driven from the tokenizer |
| 4 | `d6e4783` | the grammar and out-of-grammar list in git.md |
| 5 | `d832a2d` | the shared-idiom claim off the deleted regex |
| 6 | `3d68ef4` | the "I deleted the parser" narrative in README/INTERNALS/DESIGN |
| 7 | `a70dcf4` | the `[1.4.0]` CHANGELOG entry |
| review fixes | `f4a99da` | region-word, `env -S` and deny-gate holes |
| review fixes | `dd7072a` | refusal rule and real env reach in prose |

Task 3's lib half commits before task 2 because the hook reads `denyable`;
committing task 2 first would have left an intermediate commit whose guard threw
on every commit-bearing command.

## Review record

Three `risk_surface` fires and one `diff` fire, each with three reviewers
(claude-subagent, openai `gpt-5.3-codex`, deepseek `deepseek-v4-pro`). Twenty
findings were adjudicated against the running code; fifteen were confirmed and
fixed, five killed as premature, by-design, or factually wrong. The confirmed set
included six silent real pushes (`cat <(git push …)`, `git push>/tmp/out`,
`echo $(echo ${x:-)}; git push)`, `git -C $(pwd) push …`, `env -u HOME -S "git
push …"`, `env -iS "git push …"`), a hard-deny false positive on the read-only
`rg -t sh "git commit"`, and a quadratic wrapper scan that V8-OOM-aborted the
hook at ~20KB of input - an abort the module-level `try/catch` cannot catch, so
the harness saw a dead hook and no decision. That one now runs 10000 wrapper
words in 1.8ms and fails toward `unplaced`.

**The review loop ran too long for the value returned.** Four fires across ~2.5
hours, with the third still finding real defects. The blocking-gate rule allows
"fixed OR the user explicitly overrides", and the override was never surfaced
until John stopped it. On a surface this adversarial, the second FAIL should have
gone to the user as a decision rather than another automatic fix round.

## Deviations

- **Depth-cap predicate widened** (task 1). The plan specified a
  whitespace-delimited `git` token test, but `$($($(git push)))` has no
  whitespace before `git`, so the plan's letter defeated its stated purpose.
  Delimiters are now `/[\s;|&()`'"$]+/`. Runs only on text the tokenizer could
  not place, where a wider split adds a prompt and never removes one.
- **Redirection handling extended** (task 1). Beyond making `<`/`>` word
  boundaries, the operator also drops an all-digit fd prefix and the redirection
  target, as the shell does; without it `git 2>out push origin main` reported `2`
  as the subcommand. A dropped target is still read for a git word.
- **`env -S` re-tokenization added** (not in the plan). GNU `env --split-string`
  executes its operand; it was a silent real push.
- **Return contract changed** (review). `gitSubcommands` returns
  `{subs, unplaced, denyable}` and `commitDecision` gained a `canDeny` parameter;
  the plan specified `commitDecision(root, cwd)`.
- **Prefix-command set added, then removed** (review, John's call). Any-position
  wrapper matching hard-denied `rg -t sh "git commit"`, so refusal was gated on
  command position. A `PREFIX_COMMANDS`/`COMMAND_KEYWORDS` enumeration kept
  `sudo git commit` denying, but each prefix carries its own option grammar
  (`sudo -u`, `timeout --signal`, `xargs -a`, `find -exec`) and it hard-blocked
  `command -v git commit`. The enumeration is gone; refusal is the single
  position rule. **`sudo git commit -m x` under `on_protected: refuse` now asks
  where it used to deny** - a fail-safe regression, accepted deliberately.
- **`VAR=`/`env` skip written differently** (task 3). The plan's skip is a no-op
  under any-position matching, so no skip code was written; the behaviors it
  protected are pinned by rows instead.
- **`eval "git" "push origin main"`** yields `subs: ['push origin main', 'push']`,
  not `['push']`, because eval's own words are scanned alongside the joined
  operands. Harmless - every consumer asks whether `push` is among them.

## Open items

- `/cad-docs-verify` was never run against this phase's prose. Task 6 used the
  plan's per-file substitutes instead. Worth running at `/cad-verify 3`.
- The S6 rule (a wrapper with no operand reads the whole source for a git token)
  can produce a narrow extra prompt when a bare wrapper word sits in a source
  that mentions git elsewhere, e.g. `git status; bash`. Fail-toward-asking by
  design; frequency reasoned, not measured.
- CONTEXT's flagged assumption is untouched: which shell the Bash tool runs, and
  whether `tool_input.command` is byte-identical to what executes.
- `sudo bash -c "git commit -m x"` asks while `bash -c "git commit -m x"` denies.
  The wrapper gate and the git-word gate are both position-based, so a prefixed
  wrapper loses refusal. Deliberate under the simplified rule; revisit only if
  the asymmetry bites.
- Shapes decidable from the string but still silent, now stated in git.md rather
  than fixed: brace expansion, a substitution supplying or splitting the command
  word, `ssh host "git push"`. Aliases, functions and `eval $CMD` are undecidable
  and stay silent by design.

## Goal check

The phase goal was that the rail-3 push guard sees a real `git push` through a
quoted `-C` path with a space, an `&` separator, `$(...)`, backticks, a subshell,
an escaped `\"` and `bash -c "..."` - all verified silent at `c4ab89f` and at
HEAD - closed by one tokenizer rather than six more regex arms, with the shipped
rail-3 claim in `references/git.md` moving with it.

The sum of these commits delivers it. All seven shapes return
`permissionDecision: "ask"` through the real hook where `c2265ca` returned empty
stdout, confirmed by running `git-guard.mjs` against a fixture repo rather than
by reading the code. The closure is one tokenizer, not six arms:
`cadence-core/bin/lib/shell-tokens.mjs` is the only reader, and
`grep -c "replace(/" cadence-core/bin/git-guard.mjs` returns 0, so the regexes
are gone rather than supplemented. The prose moved: `references/git.md` rail 3
gained the grammar subsection and the out-of-grammar table
(`d6e4783`, corrected in `dd7072a`), and README/INTERNALS/DESIGN no longer assert
there is no parser (`3d68ef4`).

What the goal did not name, and what three review rounds bought, is that the
tokenizer closed more than the seven: the shapes above plus process
substitution, glued redirection, `env -S` and the wrapper family all ask now.
The honest caveat is that each round found real silent pushes in the round
before, which is evidence the surface is adversarial rather than evidence it is
now exhausted - the out-of-grammar table is a statement of known reach, not a
proof of completeness. The one thing a reader should not over-read is the deny
rail: refusal deliberately got narrower than the pre-image, so a `refuse` user
gets a prompt rather than a block for prefixed forms like `sudo git commit`.
