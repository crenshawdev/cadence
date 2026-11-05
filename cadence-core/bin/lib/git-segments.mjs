// @ts-check
// everything git-guard.mjs sees; it replaced a shell tokenizer and a model of git's option grammar
// the guard's adversary is the model, not an attacker: being wrong costs a prompt, never a bypass
// predicting the shell has an unbounded escape surface, and every patch added grammar
// so a segment counts only when its command word is git, and everything else is silent by construction
// also holds the .planning/ scope walk that git-guard, read-trace and subagent-trace share
// the walk is a generator yielding [dir, name] and taking back a boolean; planningRoot drives it with existsSync
'use strict';

/** The git global options that take a separate argument. A fixed list, not a grammar: without it
 * `git -C /srv/repo push` reads `/srv/repo` as the verb. The `=`-glued spellings need no entry. */
const GLOBAL_OPT_WITH_ARG = new Set([
  '-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--config-env',
]);

/** `;`, a newline, `|`, `||`, `&&` and `&` each end a command. The two-character forms lead so they aren't split. */
const SEPARATOR = /&&|\|\||[;|&\n]/;

/**
 * Every git verb this command runs, in order: `git add . && git push` reads
 * `['add', 'push']`.
 *
 * Total and linear: any input returns an array and never throws. This runs on every Bash call, and a guard that stalls
 * is worse than one that misses.
 *
 * A segment contributes a verb only when its first word is `git` (or ends in `/git`).
 * That's why `echo "git push"` and `grep git commit` are silent.
 *
 * What it can't see: a wrapper, a substitution or a prefix (`bash -c "git push"`, `$(git push)`, `sudo git push`).
 * references/git-publish.md rail 3 lists them.
 *
 * @param {unknown} text the raw command string from the hook payload
 * @returns {string[]} the verbs, in the order they appear
 */
export function gitVerbs(text) {
  return gitInvocations(text).map((g) => g.verb);
}

/**
 * The same scan as `gitVerbs`, keeping each segment's `-C` arguments: `git -C /tmp/x commit` reads
 * `[{verb: 'commit', dirs: ['/tmp/x']}]`. The commit rail needs `-C` to know which repo is hit.
 * Words are raw, and a bare `-C` keeps `''`.
 *
 * @param {unknown} text the raw command string from the hook payload
 * @returns {{verb: string, dirs: string[]}[]}
 */
export function gitInvocations(text) {
  if (typeof text !== 'string' || !text) return [];

  const out = [];
  for (const segment of text.split(SEPARATOR)) {
    const words = segment.trim().split(/\s+/).filter(Boolean);
    const head = words[0];
    // anchored: only the command word admits a segment
    if (head !== 'git' && !(head !== undefined && head.endsWith('/git'))) continue;

    const dirs = [];
    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      if (GLOBAL_OPT_WITH_ARG.has(word)) { // skip it AND its argument
        if (word === '-C') dirs.push(words[i + 1] ?? '');
        i++;
        continue;
      }
      if (word.startsWith('-')) continue;
      out.push({ verb: word, dirs });
      break; // the first non-flag word is the verb; the rest are its operands
    }
  }
  return out;
}

/**
 * The parent of an absolute directory, as node's `path.dirname` answers it. A
 * `/`-leading path steps the way `path.posix.dirname` does; anything else (a
 * drive path, a UNC path) steps the way `path.win32.dirname` does, with both
 * separators. A root answers itself, which is what ends the walk.
 *
 * @param {string} dir
 * @returns {string}
 */
export function parentDir(dir) {
  const posix = dir.startsWith('/');
  const isSep = posix ? (c) => c === '/' : (c) => c === '/' || c === '\\';
  let root = 0; // how much of the front is root, which a step never cuts into
  if (posix) {
    root = 1;
  } else if (/^[A-Za-z]:/.test(dir)) {
    root = isSep(dir[2]) ? 3 : 2;
  } else if (isSep(dir[0])) {
    // UNC: `\\server\share\` is the root, and a bare `\\server\share` is too.
    const unc = /^[\\/]{2}[^\\/]+[\\/]+[^\\/]+/.exec(dir);
    if (unc && unc[0].length === dir.length) return dir;
    root = unc ? unc[0].length + 1 : 1;
  }

  // Skip the trailing separators and the last name, then cut at the separator
  // before it. Only that one separator goes: `/a//b` answers `/a/`, as node does.
  let end = -1;
  let named = false;
  for (let i = dir.length - 1; i >= root; i--) {
    if (!isSep(dir[i])) named = true;
    else if (named) { end = i; break; }
  }
  if (end === -1) return root ? dir.slice(0, root) : '.';
  if (posix && end === 1) return '//'; // posix.dirname's own quirk for `//a`
  return dir.slice(0, end);
}

/**
 * The walk itself. From `start` upward: a directory holding `.planning` is the
 * project root; a directory holding `.git` first is a repo that is not Cadence's;
 * reaching the filesystem root is nothing. Yields each `[dir, name]` it needs
 * probed and expects the answer back through `next(boolean)`.
 *
 * @param {string} start
 * @returns {Generator<[string, string], string | null, boolean>}
 */
function* planningWalk(start) {
  let dir = start;
  for (;;) {
    if (yield [dir, '.planning']) return dir;
    if (yield [dir, '.git']) return null; // repo root, not Cadence
    const parent = parentDir(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * The Cadence project root above `start`, or null. Sync driver for the hooks.
 *
 * @param {string} start
 * @param {(dir: string, name: string) => boolean} has does `dir/name` exist
 * @returns {string | null}
 */
export function planningRoot(start, has) {
  const walk = planningWalk(start);
  let step = walk.next();
  while (!step.done) {
    const [dir, name] = step.value;
    step = walk.next(has(dir, name));
  }
  return step.value;
}
