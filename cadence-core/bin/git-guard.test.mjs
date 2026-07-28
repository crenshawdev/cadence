// Zero-dep tests for git-guard.mjs (the PreToolUse hook). Run:
// node --test 'cadence-core/bin/*.test.mjs'
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const GUARD = join(dirname(fileURLToPath(import.meta.url)), 'git-guard.mjs');

// Hermetic global config (never read the dev's real one).
const NO_GLOBAL = join(mkdtempSync(join(tmpdir(), 'cad-guard-')), 'no-global.json');

// Fixture git calls must never read the dev's global/system git config
// (commit.gpgsign, init.defaultBranch hooks, ... would break the fixtures).
const GIT_ENV = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };

/** Run a git command against a fixture dir, hermetically. */
function git(args, opts = {}) {
  execFileSync('git', args, { stdio: 'ignore', env: GIT_ENV, ...opts });
}

/** Feed the hook a raw stdin payload; return trimmed stdout. */
function guardRaw(input) {
  return execFileSync('node', [GUARD], {
    encoding: 'utf8',
    input,
    env: { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL },
  }).trim();
}

/** Feed the hook a PreToolUse payload; return the parsed decision or null. */
function guard(command, cwd) {
  const stdout = guardRaw(JSON.stringify({ tool_input: { command }, cwd }));
  return stdout ? JSON.parse(stdout).hookSpecificOutput : null;
}

/** A Cadence project fixture: git repo on `branch` with a .planning dir. */
function project(branch, config) {
  const dir = mkdtempSync(join(tmpdir(), 'cad-guard-repo-'));
  git(['-C', dir, 'init', '-q', '-b', branch]);
  writeFileSync(join(dir, 'f.txt'), 'x');
  git(['-C', dir, 'add', '.']);
  git(['-C', dir, '-c', 'user.email=t@t', '-c', 'user.name=t',
    'commit', '-q', '-m', 'init']);
  mkdirSync(join(dir, '.planning'), { recursive: true });
  if (config) writeFileSync(join(dir, '.planning', 'config.json'), JSON.stringify(config));
  return dir;
}

test('silent outside a Cadence project', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cad-guard-plain-'));
  assert.equal(guard('git push origin main', dir), null);
});

test('silent for non-git commands inside a project', () => {
  assert.equal(guard('ls -la', project('main')), null);
});

test('git push always asks (publishing is /cad-land\'s call)', () => {
  const d = guard('git push origin feature', project('feature'));
  assert.equal(d.hookEventName, 'PreToolUse'); // the harness routes on this
  assert.equal(d.permissionDecision, 'ask');
  assert.match(d.permissionDecisionReason, /cad-land/);
});

test('auto_close true does not exempt any push - every push still asks', () => {
  // The direct inversion of the removed exemption: git-guard carries NO push
  // exemption. Even the exact shape that once passed silently under repo
  // auto_close now asks. cad-land's sanctioned publish runs through the
  // git-publish seam as a subprocess argv push this Bash hook never sees.
  const dir = project('cadence/v1.1.0-rc.2', { git: { auto_close: true } });
  const d = guard('git push -u origin cadence/v1.1.0-rc.2', dir);
  assert.notEqual(d, null);
  assert.equal(d.permissionDecision, 'ask');
});

test('commit on a protected branch asks by default, silent on a task branch', () => {
  const d = guard('git commit -m "x"', project('main'));
  assert.equal(d.permissionDecision, 'ask');
  assert.match(d.permissionDecisionReason, /protected/);
  assert.equal(guard('git commit -m "x"', project('improve/thing')), null);
});

test('git.on_protected=refuse denies; =allow stays silent', () => {
  const refuse = guard('git commit -m "x"',
    project('main', { git: { on_protected: 'refuse' } }));
  assert.equal(refuse.permissionDecision, 'deny');
  assert.equal(guard('git commit -m "x"',
    project('main', { git: { on_protected: 'allow' } })), null);
});

test('on_protected "deny" is an alias of refuse, not a silent soft-ask (#38)', () => {
  const d = guard('git commit -m "x"',
    project('main', { git: { on_protected: 'deny' } }));
  assert.equal(d.permissionDecision, 'deny');
});

test('a string protected_branches guards THAT branch, not the default list (#38)', () => {
  // "release" (string, not array) is an easy hand-edit; honor it instead of
  // silently reverting to ['main','master'].
  const d = guard('git commit -m "x"',
    project('release', { git: { protected_branches: 'release' } }));
  assert.equal(d.permissionDecision, 'ask');
  assert.equal(guard('git commit -m "x"',
    project('main', { git: { protected_branches: 'release' } })), null);
});

test('custom protected_branches list is honored', () => {
  const d = guard('git commit -m "x"',
    project('release', { git: { protected_branches: ['release'] } }));
  assert.equal(d.permissionDecision, 'ask');
  assert.equal(guard('git commit -m "x"',
    project('main', { git: { protected_branches: ['release'] } })), null);
});

test('git stash push is not a publish (subcommand-aware matching)', () => {
  assert.equal(guard('git stash push -m wip', project('main')), null);
});

test('push as an argument or inside quotes never fires the rail', () => {
  const p = project('main');
  assert.equal(guard('git log --grep "push"', p), null);
  assert.equal(guard('git log --grep push', p), null);
  assert.equal(guard('echo "git push"', p), null);
});

test('global git options are skipped when finding the subcommand', () => {
  const d = guard('git -C . -c user.name=t push origin x', project('feature'));
  assert.equal(d.permissionDecision, 'ask');
});

test('a backslash-continued wrapped push reaches the push rail like the unwrapped form (#50)', () => {
  const p = project('feature');
  const wrapped = guard('git \\\n  push origin main', p);
  const unwrapped = guard('git push origin main', p);
  assert.deepEqual(wrapped, unwrapped);
});

test('a CRLF-continued wrapped push reaches the push rail like the unwrapped form (#50)', () => {
  const p = project('feature');
  const wrapped = guard('git \\\r\n push origin main', p);
  const unwrapped = guard('git push origin main', p);
  assert.deepEqual(wrapped, unwrapped);
});

test('the commit rail widens with the join too (D-07): a wrapped commit on a protected branch asks', () => {
  const d = guard('git \\\n commit -m "x"', project('main'));
  assert.equal(d.permissionDecision, 'ask');
  assert.match(d.permissionDecisionReason, /protected/);
});

test('join runs before the quote-strip (D-08): a continued quoted string never manufactures a phantom push', () => {
  // This exact shape prompts on the pre-fix code (the strip cannot match a
  // backslash-newline inside the quotes, so the quoted "push" text survives
  // and is read as a bare trailing command) - closing that false positive.
  assert.equal(guard('echo "foo \\\n git push bar"', project('main')), null);
});

test('a wrapped stash push is still a stash, not a publish (regression guard, holds before and after the fix)', () => {
  assert.equal(guard('git stash \\\n push -m wip', project('main')), null);
});

test('the join does not swallow the command separator: a blank line after a continuation still splits two commands (#50)', () => {
  const p = project('feature');
  const wrapped = guard('git add -A \\\n\ngit push origin main', p);
  const unwrapped = guard('git push origin main', p);
  assert.deepEqual(wrapped, unwrapped);

  const d = guard('git commit -m "wip" \\\n   \ngit push', p);
  assert.equal(d.permissionDecision, 'ask');
});

test('an EVEN run of trailing backslashes is a literal argument, not a continuation - the push on the next line still asks', () => {
  // `\\` at EOL is an escaped backslash: bash passes a literal `\` to `git
  // add` and the newline still ends the command, so the second line is a
  // REAL `git push`. A parity-blind join splices both into one segment,
  // where the scan reads only the first git word (`add`) and the push goes
  // unprompted - caught at c4ab89f, silently missed by the first cut of #50.
  const p = project('feature');
  assert.deepEqual(
    guard('git add -A \\\\\ngit push origin main', p),
    guard('git push origin main', p),
  );
  assert.equal(guard('git commit -m msg \\\\\ngit push origin main', p).permissionDecision, 'ask');
});

test('a double quote inside a single-quoted word is not a delimiter - a real push beside it still asks', () => {
  // Two sequential strips let the `"` inside `-F'"'` pair with the `"` before
  // `done`, deleting `; git push origin main ; echo ` wholesale. The
  // backslash-newline used to block that match by accident, so joining first
  // (D-08) exposed it: caught at c4ab89f, silently missed once the join
  // landed. One alternating left-to-right pass gives the shell's own
  // whichever-opens-first precedence.
  const p = project('feature');
  const d = guard('awk -F\'"\' \'{print $2}\' f.txt \\\n  ; git push origin main ; echo "done"', p);
  assert.equal(d.permissionDecision, 'ask');
  // The mirror case must stay silent: a `'` inside double quotes is likewise
  // not a delimiter, so the quoted push is still stripped whole.
  assert.equal(guard('echo "it\'s just git push text"', project('main')), null);
});

test('compound command still catches the push half', () => {
  const d = guard('git add . && git push', project('feature'));
  assert.equal(d.permissionDecision, 'ask');
});

test('guard applies from a subdirectory of the project (walk-up)', () => {
  const dir = project('main');
  const sub = join(dir, 'src', 'deep');
  mkdirSync(sub, { recursive: true });
  const d = guard('git commit -m "x"', sub);
  assert.equal(d.permissionDecision, 'ask');
  assert.match(d.permissionDecisionReason, /protected/);
});

test('walk-up stops at a repo root without .planning (still not policed)', () => {
  // A plain repo whose PARENT happens to contain .planning must not be policed.
  const outer = mkdtempSync(join(tmpdir(), 'cad-guard-outer-'));
  mkdirSync(join(outer, '.planning'));
  const inner = join(outer, 'other-repo');
  mkdirSync(inner);
  git(['-C', inner, 'init', '-q', '-b', 'main']);
  assert.equal(guard('git push origin main', inner), null);
});

test('commit guard degrades silently when .planning has no git repo', () => {
  // planningRoot finds the project, but `git rev-parse` fails - the guard
  // must swallow that and never block (a broken guard blocks nothing).
  const dir = mkdtempSync(join(tmpdir(), 'cad-guard-norepo-'));
  mkdirSync(join(dir, '.planning'));
  assert.equal(guard('git commit -m "x"', dir), null);
});

test('detached HEAD is not a protected branch (rev-parse says HEAD)', () => {
  const dir = project('main');
  git(['-C', dir, 'checkout', '-q', '--detach']);
  assert.equal(guard('git commit -m "x"', dir), null);
});

test('the six non-wrapper shapes silent at HEAD now reach the push rail (phase 3)', () => {
  // A defect proven only at the parser level is not proven to reach the
  // permission prompt, which is the hook's only observable (D-09). Each of
  // these printed EMPTY stdout before the tokenizer landed.
  const p = project('feature');
  for (const command of [
    'git -C "my repo" push origin main',          // (a) quoted -C path
    'git add -A & git push origin main',          // (b) a bare & separator
    '$(git push origin main)',                    // (c) command substitution
    '`git push origin main`',                     // (d) backticks
    '(git push origin main)',                     // (e) a subshell
    'echo \\" ; git push origin main; echo "done"', // (f) an escaped quote
  ]) {
    const d = guard(command, p);
    assert.notEqual(d, null, `guard stayed silent for: ${command}`);
    assert.equal(d.permissionDecision, 'ask', command);
    assert.match(d.permissionDecisionReason, /cad-land/);
  }
});

test('a region used as a global-option argument still reaches the push rail', () => {
  // `git -C <path> push` is this phase's headline shape, and an unquoted
  // substitution as the path made the guard print EMPTY stdout: the region
  // deleted its word instead of emptying it, so `-C` consumed `push` and the
  // command read as the subcommand `origin`. The last two rows are the same
  // root cause reached through the comment rule.
  const p = project('feature');
  for (const command of [
    'git -C $(pwd) push origin main',
    'git -C `pwd` push origin main',
    'git -c $(echo a=b) push origin main',
    'echo hi $(echo)#x; git push origin main',
    'echo hi `echo`#x; git push origin main',
  ]) {
    const d = guard(command, p);
    assert.notEqual(d, null, `guard stayed silent for: ${command}`);
    assert.equal(d.permissionDecision, 'ask', command);
    assert.match(d.permissionDecisionReason, /cad-land/);
  }
});

test('the stated wrapper set reaches the push rail like the bare form (D-02)', () => {
  const p = project('feature');
  for (const command of [
    'bash -c "git push origin main"',
    "sh -c 'git push origin main'",
    'zsh -c "git push origin main"',
    'dash -c "git push origin main"',
    'eval "git push origin main"',
    'bash -lc "git push origin main"',
    '/bin/sh -c "git push origin main"',
    'sudo bash -c "git push origin main"',
    'timeout 60 bash -c "git push origin main"',
    '/usr/bin/env bash -c "git push origin main"',
    'eval "git" "push origin main"',
    "bash -c $'git push origin main'",
  ]) {
    const d = guard(command, p);
    assert.notEqual(d, null, `guard stayed silent for: ${command}`);
    assert.equal(d.permissionDecision, 'ask', command);
    assert.match(d.permissionDecisionReason, /cad-land/);
  }
});

test('a wrapped commit follows the same git.on_protected path as the bare form (D-04)', () => {
  // Both rails read one tokenizer, so they agree on what a wrapped command IS
  // (phase-4 D-07). Accepted downstream consequence: a user configured
  // on_protected=refuse now finds `bash -c "git commit ..."` hard-blocked on a
  // protected branch, which is what refuse MEANS. This repo runs `ask`.
  const refuse = project('main', { git: { on_protected: 'refuse' } });
  assert.deepEqual(guard('bash -c "git commit -m x"', refuse),
    guard('git commit -m x', refuse));
  assert.equal(guard('bash -c "git commit -m x"', refuse).permissionDecision, 'deny');

  const ask = project('main');
  assert.deepEqual(guard('bash -c "git commit -m x"', ask),
    guard('git commit -m x', ask));
  assert.equal(guard('bash -c "git commit -m x"', ask).permissionDecision, 'ask');
});

test('env -S runs its operand, so the push in it reaches the push rail', () => {
  // GNU env SPLITS the string and executes it. The guard emitted no decision
  // at all for these, and the shape was not in the out-of-grammar list either
  // - a silent unknown, which is the one thing rail 3 promises not to have.
  const p = project('feature');
  for (const command of [
    'env -S "git push origin main"',
    'env --split-string "git push origin main"',
    'env --split-string="git push origin main"',
    'env -S"git push origin main"',
    '/usr/bin/env -S "git push origin main"',
    // Finding `-S` means walking env's WHOLE option region. Stopping at the
    // first non-flag word left every shape below silent through the real hook
    // while the push ran: the walk ended on `HOME` / `/tmp` / `foo` before it
    // ever reached `-S`, and `-S` inside a short cluster was not matched at
    // all (GNU env's optstring is `+ia:u:vC:S:0`, so `-iS` takes the next
    // word).
    'env -u HOME -S "git push origin main"',
    'env -C /tmp -S "git push origin main"',
    'env -a foo -S "git push origin main"',
    'env -iS "git push origin main"',
    'env --unset HOME --chdir /tmp --split-string "git push origin main"',
    'env --block-signal -S "git push origin main"',
  ]) {
    const d = guard(command, p);
    assert.notEqual(d, null, `guard stayed silent for: ${command}`);
    assert.equal(d.permissionDecision, 'ask', command);
    assert.match(d.permissionDecisionReason, /cad-land/);
  }
});

test('an env option the guard does not know fails toward asking, not silence', () => {
  // The rule that keeps the NEXT unanticipated env option from being the next
  // silent bypass: an unrecognized option means env's operands were never
  // located, so a `-S` further along may have been missed.
  const p = project('feature');
  const d = guard('env -Z "git push origin main"', p);
  assert.notEqual(d, null, 'guard stayed silent for an unknown env option');
  assert.equal(d.permissionDecision, 'ask');
  assert.match(d.permissionDecisionReason, /could not parse/);
  // ...and an unknown option with no git word anywhere still stays silent
  assert.equal(guard('env -Z echo hi', p), null);
});

test('the same env hole on the commit rail: refuse still hard-blocks', () => {
  const refuse = project('main', { git: { on_protected: 'refuse' } });
  for (const command of [
    'env -u HOME -S "git commit -m x"',
    'env -iS "git commit -m x"',
  ]) {
    assert.equal(guard(command, refuse).permissionDecision, 'deny', command);
  }
});

// The whole deny gate at the seam, one row per shape. DETECTION is
// any-position and unchanged - every row below reaches a decision. Only DENY
// power is gated, and the gate is ONE position rule: the git word (and the
// wrapper it was reached through, if any) at word 0 of its own simple command,
// after leading `VAR=value` assignments and empty placeholder words.
//
// An earlier cut enumerated transparent prefix commands and shell keywords so
// `sudo git commit` kept a hard deny. That set was dropped: every prefix has
// its own option grammar (`sudo -u john`, `timeout --signal KILL 60`,
// `find -exec`), so it had an open-ended tail that three review rounds kept
// finding new members of, and it produced a FALSE deny on `command -v git
// commit` - a lookup that runs nothing. A missing deny costs a prompt; a wrong
// deny hard-blocks read-only work.
const DENY_GATE = [
  ['deny', 'git commit -m x'],
  ['deny', 'bash -c "git commit -m x"'],          // the D-04 parity AC
  ['deny', '$(echo) git commit -m x'],            // placeholder word skipped
  ['ask', 'sudo git commit -m x'],                // accepted fail-safe regression
  ['ask', 'sudo -u john git commit -m x'],
  ['ask', 'timeout --signal KILL 60 git commit -m x'],
  ['ask', 'find . -name x -exec git commit -m x \\;'],
  ['ask', 'command -v git commit'],               // was a FALSE deny
  ['ask', 'grep git commit'],
];

test('the deny gate is one position rule, with no prefix set to enumerate', () => {
  const refuse = project('main', { git: { on_protected: 'refuse' } });
  for (const [expected, command] of DENY_GATE) {
    const d = guard(command, refuse);
    assert.notEqual(d, null, `guard stayed silent for: ${command}`);
    assert.equal(d.permissionDecision, expected, command);
  }
});

test('a git word that is NOT the command word can ask but never deny', () => {
  // A bare MENTION of a git word in an ordinary command was hard-blocked under
  // refuse: `grep git commit` came back `deny` while committing nothing.
  const refuse = project('main', { git: { on_protected: 'refuse' } });
  for (const command of [
    'grep git commit',
    'bash -c "echo git commit"',
    'echo git commit',
  ]) {
    const d = guard(command, refuse);
    assert.notEqual(d, null, command);
    assert.equal(d.permissionDecision, 'ask', command);
  }
  // and a real invocation at command position keeps its deny power
  for (const command of [
    'git commit -m x',
    'bash -c "git commit -m x"',
    'env -S "git commit -m x"',
    'GIT_AUTHOR_NAME=t git commit -m x',
  ]) {
    assert.equal(guard(command, refuse).permissionDecision, 'deny', command);
  }
});

test('a wrapper word that is NOT the command word can ask but never deny', () => {
  // Detection is any-position (that is what catches `sudo bash -c ...` with
  // one rule); REFUSAL is command-position only. Before this gate, a
  // read-only `rg -t sh "git commit"` came back `deny` under refuse - a
  // search hard-blocked by a rail meant for real commits.
  const refuse = project('main', { git: { on_protected: 'refuse' } });
  for (const command of [
    'rg -t sh "git commit"',
    'echo bash -c "git commit -m x"',
    'shellcheck -s bash "git commit"',
  ]) {
    const d = guard(command, refuse);
    assert.notEqual(d, null, command);
    assert.equal(d.permissionDecision, 'ask', command);
    assert.match(d.permissionDecisionReason, /non-command position/);
  }
  // and the command-position form is untouched: it still denies
  assert.equal(guard('bash -c "git commit -m x"', refuse).permissionDecision, 'deny');
});

test('wrapper operands that are not flags still reach the push rail', () => {
  // Two shapes that ran a REAL push silently: a payload whose content begins
  // with `-` (skipped as a flag), and a glued `-c"..."` (never re-tokenized).
  const p = project('feature');
  for (const command of [
    'bash -c "-n; git push origin main"',
    'bash -c"git push origin main"',
    'bash -lc"git push origin main"',
  ]) {
    const d = guard(command, p);
    assert.notEqual(d, null, `guard stayed silent for: ${command}`);
    assert.equal(d.permissionDecision, 'ask', command);
    assert.match(d.permissionDecisionReason, /cad-land/);
  }
});

test('a wrapper fed by a redirect or a pipe asks instead of going silent', () => {
  // The shell hands these their script on stdin, so the wrapper has no operand
  // to re-tokenize - and both really execute. The guard reads the dropped
  // redirection target (and, with no operand at all, the whole source) for a
  // git word and asks (D-03); it never attempts pipeline data-flow analysis.
  const p = project('feature');
  for (const command of [
    'bash <<< "git push origin main"',
    'echo "git push origin main" | bash',
  ]) {
    const d = guard(command, p);
    assert.notEqual(d, null, `guard stayed silent for: ${command}`);
    assert.equal(d.permissionDecision, 'ask', command);
    assert.match(d.permissionDecisionReason, /could not parse/);
  }
  // the same shapes with no git word anywhere stay silent
  assert.equal(guard('echo hello | bash', p), null);
  assert.equal(guard('grep bash -c file.txt', p), null);
});

test('an unplaced git word asks, and an unresolvable shape without one stays silent (D-03)', () => {
  const p = project('feature');
  const d = guard('echo "git push origin main', p);
  assert.equal(d.permissionDecision, 'ask');
  assert.match(d.permissionDecisionReason, /could not parse/);
  // no git word in the unresolvable text: the guard must not manufacture noise
  assert.equal(guard('echo "unterminated', p), null);
  assert.equal(guard('eval $CMD', p), null);
});

test('the unplaced rail never denies, even under on_protected refuse (D-03/D-04)', () => {
  // The tokenizer could not place the word, so it cannot know the command is
  // a commit; the hard-deny path belongs to what it DID resolve.
  const d = guard('echo "git commit -m x',
    project('main', { git: { on_protected: 'refuse' } }));
  assert.equal(d.permissionDecision, 'ask');
});

test('malformed stdin exits 0 with no output (guard never blocks work)', () => {
  assert.equal(guardRaw('not json {'), '');
});

test('payload without a command stays silent inside a project', () => {
  const dir = project('main');
  assert.equal(guardRaw(JSON.stringify({ tool_input: {}, cwd: dir })), '');
});
