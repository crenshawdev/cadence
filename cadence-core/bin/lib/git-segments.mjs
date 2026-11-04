// @ts-check
// git-segments.mjs - the whole of what git-guard.mjs sees. It replaced a shell tokenizer plus a model of git's option grammar, both deleted, and it is deliberately the smaller thing
// why it's this small: the guard is a PreToolUse hook whose adversary is the model issuing the command, not an attacker, and references/git-publish.md concedes the rail is "a detection widener, not a security boundary". Being wrong costs a prompt, never a bypass, and the sanctioned publish never reaches this hook
// a reader that predicts what the shell will do has an unbounded escape surface (bash -c, $(...), backticks, env -S, aliases, variable indirection), so every review round found another hole and every patch added grammar. That cost three blocking review panels and a V8 OOM at 280KB of input on a hook that runs on every Bash call, and it still left three families of silent destruction open
// so it reads one thing: a segment counts only when its command word is git, and everything else is silent by construction. The shapes that go silent are listed in references/git-publish.md rail 3 and in the CHANGELOG-v1-v2.md entry that removed the parser, as the accepted cost
// it also holds the scope rule, the .planning/ walk that decides whether a directory sits inside a Cadence project: git-guard applies it, read-trace and subagent-trace share it, and it lives here because git-guard.test.mjs pins git-guard's import set and this is the one dependency-free file in that set
// the walk is one generator that yields [dir, name] and takes back a boolean, and planningRoot drives it with the hooks' sync existsSync probe. The parent step is parentDir, a port of node's own dirname
'use strict';

/** The git global options that take a separate argument. A fixed list and not a grammar, and the only reason the scan looks past a flag at all: without it `git -C /srv/repo push` reads `/srv/repo` as its verb and a real push goes silent. The `=`-glued spellings (`--git-dir=x`) need no entry, each is one `-`-leading word the flag skip already covers. */
const GLOBAL_OPT_WITH_ARG = new Set([
  '-C', '-c', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--config-env',
]);

/** `;`, a newline, `|`, `||`, `&&` and `&` each end a simple command. The two-character forms lead the alternation so they match before the single-character class can split them. */
const SEPARATOR = /&&|\|\||[;|&\n]/;

/**
 * Every git verb this command runs, in order: `git add . && git push` reads
 * `['add', 'push']`.
 *
 * Total and linear: any input at all (a non-string, a hostile object, a megabyte of repeated separators) returns an array and never throws, because this runs on every Bash tool call and a guard that stalls or aborts is worse than one that misses. The deleted reader was O(K x N) in memory and OOMed the hook, which fails open.
 *
 * A segment contributes a verb only when its first word is `git` (or ends in `/git`, so `/usr/bin/git push` counts). That anchor is why there's no separate deny gate: a verb read here came from a command word by construction, so `rg -t sh "git commit"`, `command -v git commit`, `grep git commit` and `echo "git push"` are silent and not detected wide and then gated back down to an ask.
 *
 * The cost, stated: an invocation reached through a wrapper, a substitution or a transparent prefix (`bash -c "git push"`, `$(git push)`, `sudo git push`, `xargs git push`, `env -S "git push"`) is not seen. references/git-publish.md rail 3 carries the list.
 *
 * @param {unknown} text the raw command string from the hook payload
 * @returns {string[]} the verbs, in the order they appear
 */
export function gitVerbs(text) {
  return gitInvocations(text).map((g) => g.verb);
}

/**
 * The same scan as `gitVerbs`, keeping each segment's `-C` arguments in order: `git -C /tmp/x commit` reads `[{verb: 'commit', dirs: ['/tmp/x']}]`. `-C` is which repository a commit lands in, so the commit rail needs it. The words are raw (quotes and `$` are left for the caller to judge) and a `-C` with nothing after it keeps `''`, which no reader resolves.
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
