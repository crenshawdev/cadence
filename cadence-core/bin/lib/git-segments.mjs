// @ts-check
// git-segments.mjs - the whole of what git-guard.mjs sees. It replaces an
// 840-line shell tokenizer plus a 367-line model of git's option grammar, both
// deleted, and it is deliberately the smaller thing.
//
// WHY IT IS THIS SMALL. The guard is a PreToolUse hook whose adversary is the
// model issuing the command, not an attacker, and references/git-publish.md has always
// conceded the rail is "a detection widener, not a security boundary": being
// wrong here costs a prompt, never a bypass, and the sanctioned publish never
// reaches this hook at all (it runs through the git-publish seam as a
// subprocess). A reader that tries to predict what the shell will do has an
// unbounded escape surface - `bash -c`, `$(...)`, backticks, `env -S`, aliases,
// variable indirection - so every review round found another hole and every
// patch added grammar to close it. That cost three blocking review panels in a
// single phase, a measured V8 OOM at 280KB of input on a hook that runs on
// EVERY Bash call, and it still left three families of live silent destruction
// open. The escape surface does not shrink by being modelled harder.
//
// So this reads one thing and declines to guess at the rest: a segment counts
// ONLY when its command word is `git`. Everything else is silent BY
// CONSTRUCTION rather than by a rule somebody has to keep correct - and the
// shapes that consequently go silent are written down in references/git-publish.md
// rail 3 and in the CHANGELOG-v1-v2.md entry that removed the parser, as the accepted
// cost rather than as an oversight.
//
// IT ALSO HOLDS THE SCOPE RULE: the `.planning/` walk that decides whether a
// directory sits inside a Cadence project. git-guard applies it, read-trace and
// subagent-trace share it, and the Cadence module (hooks/cadence-mod.mjs)
// imports it. It lives here because git-guard.test.mjs pins git-guard's import
// set, and this is the one dependency-free file in that set.
//
// The module runs with no Node globals and may import no `node:` module, so
// nothing in this file may either. That shapes the walk two ways:
// - The existence probe is injected. The walk is one generator that yields
//   `[dir, name]` and takes back a boolean; `planningRoot` drives it with a
//   sync probe (the hooks' `existsSync`), `planningRootAsync` with an async one
//   (the module's `$.fs.exists`). One loop, two drivers.
// - The parent step is `parentDir`, a port of node's own `dirname`, so the
//   hooks and the module step through the same directories.
'use strict';

/** The git global options that take a SEPARATE argument. A fixed list, not a
 * grammar: it is the only reason the scan looks past a flag at all. Without it
 * `git -C /srv/repo push` reads `/srv/repo` as its verb and a real push goes
 * silent. The `=`-glued spellings (`--git-dir=x`) need no entry of their own -
 * each is one `-`-leading word, which the flag skip below already covers. */
const GLOBAL_OPT_WITH_ARG = new Set([
  '-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--config-env',
]);

/** `;`, a newline, `|`, `||`, `&&` and `&` each end a simple command. The
 * two-character forms lead the alternation so they match before the
 * single-character class can split them in half. */
const SEPARATOR = /&&|\|\||[;|&\n]/;

/**
 * Every git verb this command runs, in order: `git add . && git push` reads
 * `['add', 'push']`.
 *
 * TOTAL and LINEAR. Any input at all - a non-string, a hostile object, a
 * megabyte of repeated separators - returns an array and never throws, because
 * this runs on every Bash tool call and a guard that stalls or aborts is worse
 * than one that misses. The deleted reader was neither: it was O(K x N) in
 * memory and OOMed the hook, which fails OPEN.
 *
 * A segment contributes a verb only when its FIRST word is `git` (or ends in
 * `/git`, so `/usr/bin/git push` counts). That anchor is the whole story, and
 * it is why there is no separate deny gate any more: a verb read here came from
 * a command word by construction, so `rg -t sh "git commit"`,
 * `command -v git commit`, `grep git commit` and `echo "git push"` are silent
 * rather than being detected wide and then gated back down to an ask.
 *
 * The cost, stated rather than hidden: an invocation reached through a wrapper,
 * a substitution or a transparent prefix (`bash -c "git push"`, `$(git push)`,
 * `sudo git push`, `xargs git push`, `env -S "git push"`) is NOT seen.
 * references/git-publish.md rail 3 carries the list.
 *
 * @param {unknown} text the raw command string from the hook payload
 * @returns {string[]} the verbs, in the order they appear
 */
export function gitVerbs(text) {
  if (typeof text !== 'string' || !text) return [];

  const verbs = [];
  for (const segment of text.split(SEPARATOR)) {
    const words = segment.trim().split(/\s+/).filter(Boolean);
    const head = words[0];
    // ANCHORED: the command word, and nothing else, admits a segment.
    if (head !== 'git' && !(head !== undefined && head.endsWith('/git'))) continue;

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      if (GLOBAL_OPT_WITH_ARG.has(word)) { i++; continue; } // skip it AND its argument
      if (word.startsWith('-')) continue;
      verbs.push(word);
      break; // the first non-flag word is the verb; the rest are its operands
    }
  }
  return verbs;
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

/**
 * The same answer through an async probe. Driver for the module.
 *
 * @param {string} start
 * @param {(dir: string, name: string) => Promise<boolean> | boolean} has
 * @returns {Promise<string | null>}
 */
export async function planningRootAsync(start, has) {
  const walk = planningWalk(start);
  let step = walk.next();
  while (!step.done) {
    const [dir, name] = step.value;
    step = walk.next(await has(dir, name));
  }
  return step.value;
}
