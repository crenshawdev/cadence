// Parser-level tests for the shell grammar in lib/shell-tokens.mjs. Run:
// node --test cadence-core/bin/shell-tokens.test.mjs
// This is the grammar table cadence-core/references/git.md rail 3 ("What the
// guard sees") states in prose - every closed hole, every shipped silence,
// and every shape declared out-of-grammar, ALONGSIDE (not instead of) the
// seam-level rows in git-guard.test.mjs that prove the same defects reach the
// permission prompt. Only node: builtins, no subprocess.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenizeCommand, gitSubcommands } from './lib/shell-tokens.mjs';

// Each row: {name, text, subs, unplaced}. `subs` is asserted with
// assert.deepEqual against gitSubcommands(text).subs, in order.
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
    text: 'xargs -I{} git push origin main', subs: ['push'] },
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
    text: 'xargs -I{} git add . git push', subs: ['add', 'push'] },

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

test('a descended region contributes nothing to the enclosing word', () => {
  const { commands } = tokenizeCommand('echo pre$(git push origin main)post');
  assert.deepEqual(commands, [['git', 'push', 'origin', 'main'], ['echo', 'prepost']]);
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

test('an input past the simple-command cap fails toward asking, never spins', () => {
  // MAX_COMMANDS is 1000; 1001 simple commands must trip the bound rather
  // than being examined, and tripping it sets unplaced (D-03: ask).
  const many = 'echo x;'.repeat(1001);
  assert.equal(gitSubcommands(many).unplaced, true);
  // and the bound is not tripped by an ordinary command list
  assert.equal(gitSubcommands('echo x;'.repeat(10)).unplaced, false);
});
