// @ts-check
// git-segments.mjs - the whole of what git-guard.mjs sees. It replaces an
// 840-line shell tokenizer plus a 367-line model of git's option grammar, both
// deleted, and it is deliberately the smaller thing.
//
// WHY IT IS THIS SMALL. The guard is a PreToolUse hook whose adversary is the
// model issuing the command, not an attacker, and references/git.md has always
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
// shapes that consequently go silent are written down in references/git.md
// rail 3 and in the CHANGELOG entry that removed the parser, as the accepted
// cost rather than as an oversight.
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
 * references/git.md rail 3 carries the list.
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
