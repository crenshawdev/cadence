// Parser-level tests for the shell grammar in lib/shell-tokens.mjs. Run:
// node --test cadence-core/bin/shell-tokens.test.mjs
// This is the grammar table cadence-core/references/git.md rail 3 ("What the
// guard sees") states in prose - every closed hole, every shipped silence,
// and every shape declared out-of-grammar, ALONGSIDE (not instead of) the
// seam-level rows in git-guard.test.mjs that prove the same defects reach the
// permission prompt. Only node: builtins, no subprocess (the one file read is
// references/git.md, so the enumerated sets are pinned against the prose that
// states them rather than against a second copy of themselves).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tokenizeCommand, gitSubcommands, SHELL_WRAPPERS } from './lib/shell-tokens.mjs';

// Each row: {name, text, subs, unplaced, denyable}. `subs` is asserted with
// assert.deepEqual against gitSubcommands(text).subs, in order; `denyable`
// defaults to `subs`, since a subcommand read from the command text itself is
// always deny-eligible and only a non-command-position wrapper withholds it.
const ROWS = [
  // --- the six non-wrapper holes this phase closes (silent at HEAD) -------
  { name: 'hole (a): a quoted -C path with a space keeps its word boundary',
    text: 'git -C "my repo" push origin main', subs: ['push'] },
  { name: 'hole (b): a bare & separates two simple commands',
    text: 'git add -A & git push origin main', subs: ['add', 'push'] },
  { name: 'hole (c): $(...) is descended into, not stripped',
    text: '$(git push origin main)', subs: ['push'] },
  { name: 'hole (d): a backtick region is descended into',
    text: '`git push origin main`', subs: ['push'] },
  { name: 'hole (e): a command-position subshell is descended into',
    text: '(git push origin main)', subs: ['push'] },
  { name: 'hole (e): the subshell rule does not turn on incidental whitespace',
    text: '( git push )', subs: ['push'] },
  { name: 'hole (f): an escaped \\" is a literal quote, not a region opener',
    text: 'echo \\" ; git push origin main; echo "done"', subs: ['push'] },

  // --- the shipped silences and false positives that must stay silent ----
  { name: 'quoted text is word CONTENT: echo "git push" is not a git word',
    text: 'echo "git push"', subs: [] },
  { name: 'a quoted --grep argument is not a subcommand',
    text: 'git log --grep "push"', subs: ['log'] },
  { name: 'an unquoted --grep argument is not a subcommand either',
    text: 'git log --grep push', subs: ['log'] },
  { name: 'git stash push is a stash, not a publish',
    text: 'git stash push -m wip', subs: ['stash'] },
  { name: 'a continuation inside double quotes keeps one word (no phantom push)',
    text: 'echo "foo \\\n git push bar"', subs: [] },
  { name: "a ' inside double quotes is content, not a delimiter",
    text: 'echo "it\'s just git push text"', subs: [] },
  { name: 'a " inside a single-quoted word is not a delimiter - the real push beside it is seen',
    text: 'awk -F\'"\' \'{print $2}\' f.txt \\\n  ; git push origin main ; echo "done"',
    subs: ['push'] },

  // --- backslash parity, as escape state rather than a pre-pass ----------
  { name: 'ODD trailing backslash run: the line continues',
    text: 'git \\\n  push origin main', subs: ['push'] },
  { name: 'EVEN trailing backslash run: a literal backslash, the newline still separates',
    text: 'git add -A \\\\\ngit push origin main', subs: ['add', 'push'] },
  { name: 'a CRLF continuation joins like an LF one',
    text: 'git \\\r\n push origin main', subs: ['push'] },
  { name: 'an EVEN run before CRLF still separates',
    text: 'git add -A \\\\\r\ngit push origin main', subs: ['add', 'push'] },
  { name: 'a blank line after a continuation still separates two commands',
    text: 'git add -A \\\n\ngit push origin main', subs: ['add', 'push'] },

  // --- shapes that already asked at HEAD and must keep asking ------------
  { name: 'an xargs-prefixed push is still a push',
    // `denyable` is empty (the git word is an xargs argument) and costs
    // nothing: the push rail asks unconditionally and never reads `denyable`.
    text: 'xargs -I{} git push origin main', subs: ['push'], denyable: [] },
  { name: 'a VAR=value assignment prefix does not hide the git word',
    text: 'GIT_SSH_COMMAND=x git push origin main', subs: ['push'] },
  { name: 'global options and their arguments are skipped when reading the subcommand',
    text: 'git -C . -c user.name=t push origin x', subs: ['push'] },
  { name: 'a compound && still catches the push half',
    text: 'git add . && git push', subs: ['add', 'push'] },

  // --- process substitution, redirection, stray `)`, $"..." --------------
  // Four shapes a cross-model risk-surface review caught as REAL, SILENT
  // pushes (each verified under bash with a stub git on PATH); every row here
  // is a regression pin, not a preference.
  { name: 'a <( ) process substitution is descended into, not swallowed as word text',
    text: 'cat <(git push origin main)', subs: ['push'] },
  { name: 'a >( ) process substitution is descended into as well',
    text: 'echo x > >(git push origin main)', subs: ['push'] },
  { name: 'a redirection with NO surrounding space is still a word boundary',
    text: 'git push>/tmp/out', subs: ['push'] },
  { name: 'an appending redirection is a word boundary too',
    text: 'git push>>log', subs: ['push'] },
  { name: 'an fd-prefixed redirection keeps the subcommand readable',
    text: 'git push 2>/dev/null', subs: ['push'] },
  { name: 'fd duplication is one operator, not a & separator',
    text: 'git push 2>&1', subs: ['push'] },
  { name: 'a redirection written BETWEEN git and its subcommand still reads push',
    text: 'git 2>out push origin main', subs: ['push'] },
  { name: 'the redirection target is dropped the way the shell removes it',
    text: 'git>out push origin main', subs: ['push'] },
  { name: 'a spaced redirection is unchanged',
    text: 'git push > /tmp/out', subs: ['push'] },
  { name: 'a herestring target is dropped, the command still reads',
    text: 'git push <<< x', subs: ['push'] },
  { name: 'a mis-picked close paren fails toward asking, never toward silence',
    text: 'echo $(echo ${x:-)}; git push)', subs: ['push'] },
  { name: 'a comment inside $() cannot glue the real push into a word',
    text: 'echo $(echo # )\ngit push)', subs: ['push'] },
  { name: 'a real subshell is unaffected: its ) is consumed by the opener',
    text: '(git push)', subs: ['push'] },
  { name: 'a real substitution is unaffected: its ) is consumed by the opener',
    text: '$(git push)', subs: ['push'] },
  { name: '$"..." is a double-quoted span with the $ dropped (bash evaluates $"git" to git)',
    text: '$"git" push origin main', subs: ['push'] },
  { name: '$"..." keeps its content one word, like any double-quoted span',
    text: 'echo $"git push"', subs: [] },

  // --- a descended region leaves a word SLOT ------------------------------
  // A region contributes no CONTENT to the enclosing word, but it does START
  // that word: it leaves an empty placeholder rather than deleting the word.
  // Without the placeholder the word list of the first row is `git -C push
  // origin main`, `-C` eats `push` as its own argument, the command reads as
  // the subcommand `origin`, and a REAL push reached the network with no
  // prompt - on the phase's headline shape. The `#` rows are the same root
  // cause seen from the comment rule: `#` opens a comment only at word start,
  // and a region left the word unstarted while the shell was mid-word.
  { name: 'a $() region as -C\'s argument leaves a placeholder, so push is still read',
    text: 'git -C $(pwd) push origin main', subs: ['push'] },
  { name: 'a backtick region as -C\'s argument does the same',
    text: 'git -C `pwd` push origin main', subs: ['push'] },
  { name: 'a region as -c\'s argument does the same',
    text: 'git -c $(echo a=b) push origin main', subs: ['push'] },
  { name: 'a # glued onto a $() region is mid-word content, not a comment',
    text: 'echo hi $(echo)#x; git push origin main', subs: ['push'] },
  { name: 'a # glued onto a backtick region is mid-word content too',
    text: 'echo hi `echo`#x; git push origin main', subs: ['push'] },
  { name: 'the placeholder is skipped when reading a subcommand, never reported as one',
    text: 'git $(pwd) status', subs: ['status'] },

  // --- word rules --------------------------------------------------------
  { name: 'an EMPTY quoted argument is still a word, so -C consumes it and push is found',
    text: 'git -C "" push origin main', subs: ['push'] },
  { name: 'a # that opens a word is a comment: no false push from a commented one',
    text: 'git add . # git push', subs: ['add'] },
  { name: 'a # inside a word is ordinary content',
    text: 'git add file#1', subs: ['add'] },
  { name: 'a comment ends at the newline, which still separates',
    text: 'git add . # comment\ngit push origin main', subs: ['add', 'push'] },
  { name: 'an absolute /usr/bin/git path is a git word',
    text: '/usr/bin/git push origin main', subs: ['push'] },
  { name: 'every git invocation in one simple command is reported, not just the first',
    // Neither is deny-eligible: both git words are arguments of `xargs`, which
    // is at command position itself. Detection is unaffected - the push is
    // still seen and the guard still asks.
    text: 'xargs -I{} git add . git push', subs: ['add', 'push'], denyable: [] },

  // --- the stated wrapper set, re-tokenized (D-02) ------------------------
  { name: 'bash -c "..." re-tokenizes its operand',
    text: 'bash -c "git push origin main"', subs: ['push'] },
  { name: 'sh -c \'...\' re-tokenizes its operand',
    text: "sh -c 'git push origin main'", subs: ['push'] },
  { name: 'zsh -c "..." re-tokenizes its operand',
    text: 'zsh -c "git push origin main"', subs: ['push'] },
  { name: 'dash -c "..." re-tokenizes its operand',
    text: 'dash -c "git push origin main"', subs: ['push'] },
  { name: 'eval "..." re-tokenizes its operand (the seventh hole, found at gather time)',
    text: 'eval "git push origin main"', subs: ['push'] },
  { name: 'combined flags are tolerated rather than enumerated',
    text: 'bash -lc "git push"', subs: ['push'] },
  { name: 'an env prefix is not a bypass',
    text: 'env bash -c "git push"', subs: ['push'] },
  { name: 'a /usr/bin/env prefix is not a bypass either',
    text: '/usr/bin/env bash -c "git push"', subs: ['push'] },
  { name: 'a /bin/-prefixed wrapper counts',
    text: '/bin/sh -c "git push"', subs: ['push'] },
  { name: 'a nested wrapper terminates and is still read',
    text: 'bash -c "bash -c \\"git push\\""', subs: ['push'] },
  // The four prefix rows are DETECTED (subs) but ask-only (denyable empty):
  // the wrapper is not the command word, and that is the whole gate.
  { name: 'a sudo prefix is covered by ANY-POSITION matching, not a second prefix set',
    text: 'sudo bash -c "git push origin main"', subs: ['push'], denyable: [] },
  { name: 'a timeout prefix is covered by the same rule',
    text: 'timeout 60 bash -c "git push"', subs: ['push'], denyable: [] },
  { name: 'a nohup prefix is covered by the same rule',
    text: 'nohup bash -c "git push"', subs: ['push'], denyable: [] },
  { name: 'an xargs prefix is covered by the same rule',
    text: 'xargs bash -c "git push origin main"', subs: ['push'], denyable: [] },
  { name: 'a VAR=value prefix before a wrapper is not a bypass',
    text: 'GIT_SSH_COMMAND=x bash -c "git push origin main"', subs: ['push'] },
  { name: "bash -c $'...' re-tokenizes to a real push, not the word $git",
    text: "bash -c $'git push origin main'", subs: ['push'] },
  { name: 'a wrapper operand is re-tokenized even inside a substitution',
    text: '$(bash -c "git push origin main")', subs: ['push'] },
  // negative rows: the wrapper rule must not manufacture pushes
  { name: 'echo is not a wrapper, so its quoted argument stays word content',
    text: 'echo "git push"', subs: [] },
  { name: 'a quoted wrapper string inside a commit message is one WORD, never a wrapper',
    text: 'git commit -m "bash -c git push"', subs: ['commit'] },
  { name: 'any-position matching re-tokenizes a non-command operand harmlessly',
    text: 'grep bash -c file.txt', subs: [] },

  // --- env -S / --split-string EXECUTES its operand ----------------------
  // GNU env splits the string and runs it, so the operand is a command line,
  // not an argument. It was neither detected nor listed among the
  // out-of-grammar shapes: a real push with no decision at all.
  { name: 'env -S executes its operand, so the push in it is read',
    text: 'env -S "git push origin main"', subs: ['push'] },
  { name: 'env --split-string is the same option spelled long',
    text: 'env --split-string "git commit -m x"', subs: ['commit'] },
  { name: 'env --split-string=... glues the operand to the option',
    text: 'env --split-string="git push origin main"', subs: ['push'] },
  { name: 'env -S with a glued operand is read too',
    text: 'env -S"git push origin main"', subs: ['push'] },
  { name: '/usr/bin/env -S is matched by the same env rule',
    text: '/usr/bin/env -S "git push origin main"', subs: ['push'] },
  { name: 'an env -S operand that is not the command word can ask but never deny',
    text: 'echo env -S "git commit -m x"', subs: ['commit'], denyable: [] },
  { name: 'an ordinary env prefix does not re-tokenize its command as a string',
    text: 'env FOO=1 git commit -m x', subs: ['commit'] },
  { name: 'an env with no -S and no git word stays silent',
    text: 'env -u HOME echo hi', subs: [] },
  // An option that takes a SEPARATE argument used to end the option scan on
  // that argument, so `-S` behind it was never reached: each row here was a
  // real push (or a `refuse` user's expected hard block) printing NO decision.
  // And `-S` is an option wherever it sits in a short cluster, not only at its
  // head: GNU env's optstring is `+ia:u:vC:S:0`, so `-iS` takes the next word.
  { name: 'env -u NAME does not end the option scan before -S',
    text: 'env -u HOME -S "git push origin main"', subs: ['push'] },
  { name: 'env -C DIR does not end the option scan before -S',
    text: 'env -C /tmp -S "git push origin main"', subs: ['push'] },
  { name: 'env -a ARG (--argv0) does not end the option scan before -S',
    text: 'env -a foo -S "git push origin main"', subs: ['push'] },
  { name: '-S is matched anywhere in a short cluster, not only at its head',
    text: 'env -iS "git push origin main"', subs: ['push'] },
  { name: 'a cluster whose -S carries its own glued argument is read too',
    text: 'env -iSgit\\ push', subs: ['push'] },
  { name: 'the same hole on the commit rail: a refuse user expects a hard block',
    text: 'env -u HOME -S "git commit -m x"', subs: ['commit'], denyable: ['commit'] },
  { name: 'the long spellings of the separate-argument options behave alike',
    text: 'env --unset HOME --chdir /tmp --split-string "git push origin main"',
    subs: ['push'] },
  { name: 'an =-glued long argument consumes no following word',
    text: 'env --unset=HOME --split-string="git push origin main"', subs: ['push'] },
  { name: 'an optional-argument long option consumes no following word',
    // getopt_long reads an OPTIONAL argument only from an `=`-glued spelling,
    // so `--block-signal` leaves `-S` as the next option, not as its argument.
    text: 'env --block-signal -S "git push origin main"', subs: ['push'] },
  { name: 'an explicit -- ends env\'s options, and the command behind it is read',
    text: 'env -- git commit -m x', subs: ['commit'], denyable: ['commit'] },
  // The fallback that keeps the NEXT unanticipated env option from being the
  // next silent bypass: an option envOptions cannot account for means env's
  // operands were never located, so the source is read for a git token.
  { name: 'an env option this file does not know fails toward ASKING, not silence',
    text: 'env -Z "git push origin main"', subs: [], unplaced: true },
  { name: 'an unknown LONG env option fails toward asking too',
    text: 'env --frobnicate -S "git push origin main"', subs: [], unplaced: true },
  { name: 'an unknown env option with no git word anywhere still stays silent',
    text: 'env -Z echo hi', subs: [], unplaced: false },

  // --- detection is any-position, REFUSAL is command-position only --------
  // Every row here was a hard `deny` under git.on_protected=refuse before the
  // gate landed: a read-only ripgrep search over shell files was blocked
  // outright, which is a worse failure than the extra prompt any-position
  // detection buys. They stay DETECTED (subs) and become ask-only (denyable
  // empty).
  { name: 'a ripgrep search for "git commit" is detected but never deny-eligible',
    text: 'rg -t sh "git commit"', subs: ['commit'], denyable: [] },
  { name: 'an echoed wrapper command is detected but never deny-eligible',
    text: 'echo bash -c "git commit -m x"', subs: ['commit'], denyable: [] },
  { name: 'a shellcheck -s bash argument is detected but never deny-eligible',
    text: 'shellcheck -s bash "git commit"', subs: ['commit'], denyable: [] },
  { name: 'a COMMAND-POSITION wrapper keeps its deny power (the D-04 parity pair)',
    text: 'bash -c "git commit -m x"', subs: ['commit'], denyable: ['commit'] },
  { name: 'the bare form of the D-04 parity pair is deny-eligible too',
    text: 'git commit -m x', subs: ['commit'], denyable: ['commit'] },
  { name: 'an env prefix does not cost the wrapper its command position',
    text: 'env bash -c "git commit -m x"', subs: ['commit'], denyable: ['commit'] },
  { name: 'a VAR=value prefix does not cost the wrapper its command position',
    text: 'GIT_DIR=x bash -c "git commit -m x"', subs: ['commit'], denyable: ['commit'] },
  { name: 'a sudo-prefixed wrapped commit is detected, and asks rather than denying',
    text: 'sudo bash -c "git commit -m x"', subs: ['commit'], denyable: [] },

  // ...and the same gate one level down, on the GIT word's own position.
  // Before it, `denyable` was gated on the WRAPPER's position only, so a bare
  // mention of a git word inside an ordinary command was hard-denied under
  // git.on_protected=refuse: `grep git commit` and `bash -c "echo git commit"`
  // both came back `deny` while committing nothing. Detection is unchanged.
  { name: 'a grep for a git word is detected but never deny-eligible',
    text: 'grep git commit', subs: ['commit'], denyable: [] },
  { name: 'an echoed git word inside a wrapper is detected but never deny-eligible',
    text: 'bash -c "echo git commit"', subs: ['commit'], denyable: [] },
  { name: 'an echoed git word is detected but never deny-eligible',
    text: 'echo git commit', subs: ['commit'], denyable: [] },
  { name: 'a find -exec-style mention is detected but never deny-eligible',
    text: 'grep -rn git commit src/', subs: ['commit'], denyable: [] },
  // --- the deny gate needs NO enumerated prefix set -----------------------
  // An earlier cut enumerated transparent prefix commands (`sudo`, `timeout`,
  // `nohup`, ...) and shell keywords so those kept a hard `deny`. The set was
  // dropped: each prefix carries its OWN option grammar, so the tail was
  // open-ended - `sudo -u john`, `timeout --signal KILL 60` and
  // `find . -exec git commit \;` all fell out of it across three review
  // rounds, and `command -v git commit` fell INTO it as a false deny on a
  // lookup that runs nothing. The gate is now one position rule with nothing
  // to enumerate: a git word at index 0 of its own simple command, after
  // leading `VAR=value` assignments and empty placeholder words. A prefixed
  // commit ASKS. That is a real regression against the pre-tokenizer guard,
  // accepted deliberately: a missing deny costs a prompt, a wrong deny blocks
  // read-only work.
  { name: 'a sudo-prefixed commit asks rather than denying (no prefix set)',
    text: 'sudo git commit -m x', subs: ['commit'], denyable: [] },
  { name: 'sudo with its OWN option and argument asks too',
    text: 'sudo -u john git commit -m x', subs: ['commit'], denyable: [] },
  { name: 'a timeout prefix with its own long option asks',
    text: 'timeout --signal KILL 60 git commit -m x', subs: ['commit'], denyable: [] },
  { name: 'a find -exec mention asks',
    text: 'find . -name x -exec git commit -m x \\;', subs: ['commit'], denyable: [] },
  { name: 'command -v git commit LOOKS a command up and runs nothing: never a deny',
    text: 'command -v git commit', subs: ['commit'], denyable: [] },
  { name: 'a nice-prefixed commit asks',
    text: 'nice -n 5 git commit -m x', subs: ['commit'], denyable: [] },
  { name: 'a brace group asks (a shell keyword is an ordinary word here)',
    text: '{ git commit -m x; }', subs: ['commit'], denyable: [] },
  { name: 'a conditional asks',
    text: 'if git commit -m x; then echo ok; fi', subs: ['commit'], denyable: [] },
  // ...and what the position rule still DENIES, with no enumeration at all.
  { name: 'a subshell keeps its deny power: the descended command starts at word 0',
    text: '(git commit -m x)', subs: ['commit'], denyable: ['commit'] },
  { name: 'an empty placeholder word is SKIPPED by the position gate, not counted',
    // `$(echo)` leaves a word slot with no text, and the command really
    // commits. Treating `''` as an ordinary command word dropped this from
    // deny to ask - the placeholder is inert for the git-word rule, NOT for
    // the position gates.
    text: '$(echo) git commit -m x', subs: ['commit'], denyable: ['commit'] },
  { name: 'a leading assignment is skipped by the position gate too',
    text: 'GIT_AUTHOR_NAME=t git commit -m x', subs: ['commit'], denyable: ['commit'] },

  // --- operands that are not flags, however they are spelled --------------
  { name: 'a -leading wrapper operand is a PAYLOAD, not a flag to skip',
    // The quoted operand's CONTENT starts with `-`; skipping every `-`-leading
    // word dropped a payload that really pushes. Both the whole word and its
    // flag-stripped form carry the push, so it is reported twice - harmless,
    // since every consumer asks "is push among them".
    text: 'bash -c "-n; git push origin main"', subs: ['push', 'push'] },
  { name: 'a GLUED -c"..." payload is re-tokenized (valid bash, silent before)',
    text: 'bash -c"git push origin main"', subs: ['push'] },
  { name: 'a glued combined-flag payload is re-tokenized too',
    text: 'bash -lc"git push origin main"', subs: ['push'] },
  { name: 'a real flag cluster is still just a flag',
    text: 'bash -c "echo hi"', subs: [] },

  // --- a wrapper with no operand to scan ----------------------------------
  { name: 'a herestring-fed wrapper: the dropped target is read, so it asks',
    text: 'bash <<< "git push origin main"', subs: [], unplaced: true },
  { name: 'a pipe-fed wrapper has no operand, so the whole source is read',
    text: 'echo "git push origin main" | bash', subs: [], unplaced: true },
  { name: 'a pipe-fed wrapper with no git word anywhere stays silent',
    text: 'echo hello | bash', subs: [], unplaced: false },
  { name: 'a curl-pipe shape with no git word stays silent',
    text: 'curl -s https://example.com/install.sh | sh', subs: [], unplaced: false },
  { name: 'a redirection target with no git word is dropped silently',
    text: 'echo x > out.txt', subs: [], unplaced: false },

  // --- OUT OF GRAMMAR ----------------------------------------------------
  // One row per shape named in references/git.md rail 3's "Out of grammar"
  // table, each pinning the behavior that table states (its wording is quoted
  // in the row name, so drift between doc and code is visible here). Declaring
  // a shape out of scope without pinning what it DOES is exactly the silent
  // misread this phase exists to end (phase-1 D-20).
  { name: 'heredoc: "the body is read as ordinary command lines, not as data"',
    text: 'bash <<EOF\ngit push origin main\nEOF', subs: ['push'], unplaced: true },
  { name: 'heredoc: "a heredoc that merely CONTAINS the text can ask"',
    text: 'cat <<EOF\ngit push origin main\nEOF', subs: ['push'] },
  { name: 'herestring: "read for a `git` token, so this asks rather than going silent"',
    text: 'bash <<< "git push origin main"', subs: [], unplaced: true },
  { name: '${...} in $(): "no expansion is performed ... so this is SILENT"',
    text: 'echo $(echo ${x:-git push})', subs: [] },
  { name: 'brace expansion: "{git,echo} is one ordinary word ... SILENT"',
    text: '{git,echo} push origin main', subs: [] },
  { name: 'brace expansion: "braces in ARGUMENTS are harmless"',
    text: 'git push origin {main,dev}', subs: ['push'] },
  { name: "ANSI-C escapes: \"g\\x69t is not the word git and this is SILENT\"",
    text: "bash -c $'g\\x69t push origin main'", subs: [] },
  { name: 'ANSI-C: "plain bash -c $\'git push origin main\' reads push"',
    text: "bash -c $'git push origin main'", subs: ['push'] },
  { name: 'substitution-supplied command word: "its OUTPUT is not fed back ... SILENT"',
    text: '$(echo git) push origin main', subs: [] },
  { name: 'substitution-split: "asks, but for the inner command, not the outer one"',
    // Detected, never deny-eligible: the inner command is `echo git push`, and
    // a git word behind `echo` runs no git at all.
    text: '$(echo git push) origin main', subs: ['push'], denyable: [] },
  { name: 'aliases: "a call to an alias or function defined elsewhere is SILENT"',
    text: 'gp origin main', subs: [] },
  { name: 'shell functions: "a function DEFINITION whose body holds git push asks"',
    // The body tokenizes to the simple command `{ git push`, so the git word
    // is at index 1 and the deny is withheld - irrelevant here, since the push
    // rail asks unconditionally without reading `denyable`.
    text: 'deploy() { git push; }; deploy', subs: ['push'], denyable: [] },
  { name: 'variable indirection: "not expanded ... so this is SILENT"',
    text: 'CMD="git push"; $CMD', subs: [] },
  { name: 'remote execution: "ssh is not in the wrapper set ... SILENT"',
    text: 'ssh host "git push origin main"', subs: [] },

  // --- totality ----------------------------------------------------------
  { name: 'empty input', text: '', subs: [] },
  { name: 'whitespace-only input', text: '   \n  ', subs: [] },
  { name: 'an unterminated quote with NO git word stays silent',
    text: 'echo "unterminated', subs: [], unplaced: false },
  { name: 'an unterminated quote AROUND a git push is unplaced (D-03: ask)',
    text: 'echo "git push origin main', subs: [], unplaced: true },
  { name: 'an unresolvable variable command carries no git word and stays silent',
    text: 'eval $CMD', subs: [], unplaced: false },
];

for (const row of ROWS) {
  test(`grammar: ${row.name}`, () => {
    const got = gitSubcommands(row.text);
    assert.deepEqual(got.subs, row.subs, `subs for ${JSON.stringify(row.text)}`);
    assert.equal(got.unplaced, row.unplaced ?? false,
      `unplaced for ${JSON.stringify(row.text)}`);
    assert.deepEqual(got.denyable, row.denyable ?? row.subs,
      `denyable for ${JSON.stringify(row.text)}`);
  });
}

test('a non-string input never throws and yields nothing', () => {
  for (const bad of [undefined, null, 0, 42, true, {}, [], () => {}]) {
    const got = gitSubcommands(bad); // deliberately hostile input; TOTAL

    assert.ok(Array.isArray(got.subs));
    assert.equal(typeof got.unplaced, 'boolean');
    assert.equal(got.subs.includes('push'), false);
  }
});

test('word boundaries survive a quoted span: `git -C "my repo" push` is six words', () => {
  const { commands } = tokenizeCommand('git -C "my repo" push origin main');
  assert.deepEqual(commands, [['git', '-C', 'my repo', 'push', 'origin', 'main']]);
});

test('an empty quoted span still produces a word', () => {
  const { commands } = tokenizeCommand('git -C "" push');
  assert.deepEqual(commands, [['git', '-C', '', 'push']]);
});

test("$'...' opens a single-quoted span with the $ dropped", () => {
  // Alone it is one word whose content is the span; the wrapper case that
  // turns it into a real push lives in the wrapper rows below.
  const { commands } = tokenizeCommand("$'git push origin main'");
  assert.deepEqual(commands, [['git push origin main']]);
  assert.deepEqual(gitSubcommands("$'git push origin main'").subs, []);
});

test('single quotes honor no escapes', () => {
  const { commands } = tokenizeCommand("echo 'a\\'b");
  assert.deepEqual(commands, [['echo', 'a\\b']]);
});

test('double quotes honor a backslash before ", \\, $ and a backtick only', () => {
  assert.deepEqual(tokenizeCommand('echo "a\\"b"').commands, [['echo', 'a"b']]);
  assert.deepEqual(tokenizeCommand('echo "a\\\\b"').commands, [['echo', 'a\\b']]);
  assert.deepEqual(tokenizeCommand('echo "a\\$b"').commands, [['echo', 'a$b']]);
  assert.deepEqual(tokenizeCommand('echo "a\\`b"').commands, [['echo', 'a`b']]);
  // any other backslash is a literal backslash plus the following character
  assert.deepEqual(tokenizeCommand('echo "a\\nb"').commands, [['echo', 'a\\nb']]);
});

test('a descended region contributes no CONTENT to the enclosing word', () => {
  const { commands } = tokenizeCommand('echo pre$(git push origin main)post');
  assert.deepEqual(commands, [['git', 'push', 'origin', 'main'], ['echo', 'prepost']]);
});

test('a descended region still leaves an empty placeholder WORD, not a deleted slot', () => {
  // The word count is what `-C` counts on: delete the slot and the option eats
  // the real subcommand.
  assert.deepEqual(tokenizeCommand('git -C $(pwd) push').commands,
    [['pwd'], ['git', '-C', '', 'push']]);
  assert.deepEqual(tokenizeCommand('git -C `pwd` push').commands,
    [['pwd'], ['git', '-C', '', 'push']]);
});

test('a substitution inside double quotes is still descended into', () => {
  assert.deepEqual(gitSubcommands('echo "$(git push origin main)"').subs, ['push']);
  assert.deepEqual(gitSubcommands('echo "`git push origin main`"').subs, ['push']);
});

test('nested substitutions terminate and are still read', () => {
  assert.deepEqual(gitSubcommands('$(echo $(git push origin main))').subs, ['push']);
});

test('a pathological nest past the depth cap fails toward asking, never loops', () => {
  const deep = '$('.repeat(40) + 'git push origin main' + ')'.repeat(40);
  const got = gitSubcommands(deep);
  assert.equal(got.unplaced, true);
});

// Each enumerated set is written down in references/git.md rail 3 rather than
// implied by the code, and these rows READ that prose: an earlier version
// claimed "a member added here without the prose (or the reverse) fails this
// row" while only comparing the constant to a hardcoded literal, so adding
// `perl` to the prose kept everything green - a doc/code drift check that
// checked no document.
const GIT_MD = readFileSync(new URL('../references/git.md', import.meta.url), 'utf8');

/** The backticked members of the one git.md sentence `re` captures. */
function statedSet(re, what) {
  const m = re.exec(GIT_MD);
  assert.ok(m, `references/git.md rail 3 must state the ${what} in a sentence matching ${re}`);
  return [...m[1].matchAll(/`([^`]+)`/g)].map((x) => x[1]);
}

test('the wrapper set is the stated five, and references/git.md names exactly them', () => {
  assert.deepEqual(SHELL_WRAPPERS, ['bash', 'sh', 'zsh', 'dash', 'eval']);
  assert.deepEqual(statedSet(/The stated set is ([^.]+?), matched/, 'wrapper set'),
    SHELL_WRAPPERS, 'git.md rail 3 and SHELL_WRAPPERS disagree');
});

test('no enumerated prefix-command or keyword set survives in code or prose', () => {
  // The deny gate used to carry PREFIX_COMMANDS and COMMAND_KEYWORDS so that
  // `sudo git commit` kept its hard refusal. Both were dropped: every prefix
  // has its own option grammar, so the enumeration had an open-ended tail
  // (`sudo -u john`, `timeout --signal KILL 60`, `find -exec`) that three
  // review rounds kept finding new members of - plus a FALSE deny on
  // `command -v git commit`. The gate is now one position rule. This row
  // fails if either set is reintroduced on one side and not the other.
  const src = readFileSync(new URL('./lib/shell-tokens.mjs', import.meta.url), 'utf8');
  for (const name of ['PREFIX_COMMANDS', 'COMMAND_KEYWORDS']) {
    assert.equal(src.includes(name), false, `${name} is back in lib/shell-tokens.mjs`);
  }
  assert.equal(/prefix commands `sudo`/.test(GIT_MD), false,
    'references/git.md still states an enumerated prefix-command set');
});

test('eval CONCATENATES its operands before re-tokenizing them', () => {
  // The shell joins eval's operands with a space and executes the result, so
  // this IS a real `git push origin main`. Under per-operand re-tokenization
  // the operands are `git` (no subcommand) and `push origin main` (no git
  // word), and the only sub is the noise word `push origin main` - so this
  // assertion is exactly what discriminates the concatenation rule.
  const got = gitSubcommands('eval "git" "push origin main"');
  assert.ok(got.subs.includes('push'), JSON.stringify(got.subs));
  // eval's own words are ALSO scanned (the literal word `git` followed by the
  // word `push origin main`), so a noise entry rides along. Harmless: every
  // consumer asks "is push among them", and it can only add a prompt.
  assert.deepEqual(got.subs, ['push origin main', 'push']);
});

test('eval with bare words needs no wrapper handling and still asks', () => {
  // Its own words already carry a git word; the wrapper rule ALSO re-reads the
  // joined operands, so `push` is reported twice. Harmless - every consumer
  // asks "is push among them" - and the alternative (suppressing a re-read)
  // would be a special case with no behavioral gain.
  assert.ok(gitSubcommands('eval git push origin main').subs.includes('push'));
});

test('a wrapper-dense command is bounded: no quadratic scan, no heap abort', () => {
  // MAX_COMMANDS bounds dequeues only, so it bounded NOTHING here: one simple
  // command carrying N wrapper words re-tokenized every following operand once
  // per wrapper word. Measured before the expansion budget: 500 words 46ms,
  // 1000 213ms, 2000 985ms, 4000 a FATAL V8 out-of-memory - which the hook's
  // `try { main(); } catch {}` cannot catch, so the harness would see a dead
  // hook, no decision would be emitted, and the plainly visible `git push` in
  // the same string would run unprompted. This hook runs on EVERY Bash call.
  const text = 'git push origin main; ' + 'bash '.repeat(10000);
  const started = Date.now();
  const got = gitSubcommands(text); // must not throw, must not stall
  const elapsed = Date.now() - started;
  assert.ok(got.subs.includes('push'), JSON.stringify(got.subs));
  assert.equal(got.unplaced, true); // budget exhausted -> fail toward asking
  assert.ok(elapsed < 2000, `10000-word wrapper input took ${elapsed}ms`);
});

test('an env-dense command is bounded too (the -S scan is not quadratic)', () => {
  // env -S re-tokenizes through the same expansion budget as a wrapper
  // operand, and its option scan stops at the command word, so neither a wall
  // of `env` words nor a wall of `-S` operands can stall the hook.
  for (const text of [
    'git push origin main; ' + 'env '.repeat(10000),
    'env ' + '-S "echo hi" '.repeat(2000),
  ]) {
    const started = Date.now();
    const got = gitSubcommands(text);
    assert.ok(Array.isArray(got.subs));
    assert.ok(Date.now() - started < 2000, `env-dense input took ${Date.now() - started}ms`);
  }
  assert.ok(gitSubcommands('git push origin main; ' + 'env '.repeat(10000))
    .subs.includes('push'));
});

test('an ordinary wrapper command never trips the expansion budget', () => {
  assert.equal(gitSubcommands('bash -c "git status"').unplaced, false);
  assert.equal(gitSubcommands('bash -c "echo a b c d e f g h"').unplaced, false);
});

test('an input past the simple-command cap fails toward asking, never spins', () => {
  // MAX_COMMANDS is 1000; 1001 simple commands must trip the bound rather
  // than being examined, and tripping it sets unplaced (D-03: ask).
  const many = 'echo x;'.repeat(1001);
  assert.equal(gitSubcommands(many).unplaced, true);
  // and the bound is not tripped by an ordinary command list
  assert.equal(gitSubcommands('echo x;'.repeat(10)).unplaced, false);
});
