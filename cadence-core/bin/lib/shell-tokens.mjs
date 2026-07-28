// @ts-check
// shell-tokens.mjs - the pure, testable core of git-guard.mjs's command
// reading: ONE left-to-right pass over a shell command string that carries a
// single quote/escape state, preserves word boundaries, and descends into
// substitutions and subshells. Zero-dep (node builtins only, and it uses
// none), pure and TOTAL: no I/O, never runs live git, never throws on any
// input, no unbounded loop. Mirrors lib/publish-decision.mjs and
// lib/branch-decision.mjs discipline.
//
// WHAT THIS IS, and what it is not (D-08). This is a DETECTION WIDENER: its
// only job is to notice that a command may invoke `git push` or `git commit`
// so the guard can ASK. It fails toward asking - an unresolvable shape that
// carries a `git` word reports `unplaced`, and the caller turns that into a
// prompt. It is NOT an allow-list predicate (the deleted `isPlainPush`, whose
// unwinnable job was to be RIGHT about letting a command through) and it is
// NOT a security boundary: a determined command can hide a push from any
// reader of the string. Being wrong here costs a prompt, never a bypass.
//
// The grammar this implements, its reach, and the shapes declared
// out-of-grammar are written down in cadence-core/references/git.md, rail 3
// ("What the guard sees"). That prose and this file must agree; the rows in
// cadence-core/bin/shell-tokens.test.mjs pin every stated behavior.

/** Global git options that take a separate argument (skipped, with their
 * argument, when reading the subcommand after a `git` word). One home: the
 * hook no longer carries its own copy. */
const GIT_OPT_WITH_ARG = new Set(['-C', '-c', '--git-dir', '--work-tree',
  '--namespace', '--exec-path', '--config-env']);

/** Descent budget, THREADED through every recursive and re-entrant call (a
 * per-call counter restarting at 0 would bound nothing about wrapper
 * nesting). At the cap the region is not descended into; instead its raw text
 * is checked for a `git` token so a pathological nest fails toward asking
 * rather than going silent or looping. */
const MAX_DEPTH = 8;

/** Hard bound on simple commands examined by gitSubcommands, so no input can
 * spin the work queue. Exceeding it fails toward asking. */
const MAX_COMMANDS = 1000;

/** Hard bound on wrapper operand RE-TOKENIZATIONS per gitSubcommands call,
 * threaded exactly like MAX_DEPTH and counted globally rather than per
 * command. MAX_COMMANDS bounds dequeues only, so it bounds nothing about the
 * work one simple command can demand: a command carrying N wrapper words used
 * to re-tokenize every following operand once per wrapper word - O(N^2) - and
 * a 10KB input took a second while a 20KB one aborted the process with a V8
 * out-of-memory, which the hook's `try { main(); } catch {}` cannot catch. A
 * dead hook emits no decision, so a plainly visible `git push` in the same
 * string would run unprompted. Exceeding the budget stops expansion and sets
 * `unplaced`: fail toward asking, never toward a crash. */
const MAX_EXPANSIONS = 200;

/** How far past a wrapper word to look for a re-tokenizable operand before
 * assuming it has one (bounded so the lookahead stays linear overall). */
const OPERAND_LOOKAHEAD = 64;

/** A genuinely flag-shaped word: a short option cluster (`-c`, `-lc`,
 * `-exc`). Flags are tolerated rather than enumerated. Anything else that
 * merely BEGINS with `-` is a payload, not a flag: `bash -c "-n; git push"`
 * yields the operand `-n; git push`, and skipping every `-`-leading word
 * dropped a payload that really pushes. */
const FLAG_CLUSTER = /^-[A-Za-z]+$/;

/** A leading `VAR=value` assignment word. */
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;

/** How many leading flag letters to try stripping off a glued operand
 * (`-c"git push"` tokenizes to the single word `-cgit push`, `-lc"..."` to
 * `-lcgit push`); real flag clusters are short. */
const MAX_FLAG_STRIP = 4;

/** The stated set of shell-invoking wrappers whose operands are re-tokenized
 * (D-02), written down here and in cadence-core/references/git.md rail 3 -
 * never implied by the code alone. A word matches when it EQUALS a member or
 * ends with `/` + a member, so `/bin/bash` counts. `eval` is in the set
 * because `eval "git push origin main"` was verified silent at HEAD; a set
 * stopping at bash/sh would ship the rail-3 claim beside an adjacent hole. */
export const SHELL_WRAPPERS = ['bash', 'sh', 'zsh', 'dash', 'eval'];

/**
 * Is this word one of the stated wrappers?
 * @param {string} w
 * @returns {boolean}
 */
function isWrapper(w) {
  for (const m of SHELL_WRAPPERS) if (w === m || w.endsWith(`/${m}`)) return true;
  return false;
}

/**
 * Is this word `env` (matched by the same rule as the wrapper set, so
 * `/usr/bin/env bash -c ...` is not a bypass)?
 * @param {string} w
 * @returns {boolean}
 */
function isEnvWord(w) { return w === 'env' || w.endsWith('/env'); }

/** GNU env's own short options that take an ARGUMENT (`env --help`, coreutils
 * 9.11: `-a ARG`, `-u NAME`, `-C DIR`, `-S STRING`). The argument is the rest
 * of the cluster when there is one and the next word otherwise, which is why
 * `-iS "git push origin main"` is a real push: the cluster ends in `S`. */
const ENV_SHORT_WITH_ARG = 'auCS';

/** GNU env's short options that take none (`-i`, `-0`, `-v`). Any other short
 * letter is one this file does not know, and an unknown option means env's
 * operands cannot be located - see envOptions. */
const ENV_SHORT_FLAGS = 'i0v';

/** GNU env's long options whose argument is MANDATORY, so a separate word is
 * consumed when no `=value` is glued on. */
const ENV_LONG_WITH_ARG = new Set(['argv0', 'unset', 'chdir', 'split-string']);

/** GNU env's long options that consume no separate word: the plain flags, plus
 * the three signal options whose argument is OPTIONAL - getopt_long only ever
 * reads an optional argument from an `=`-glued spelling, never from the next
 * word. */
const ENV_LONG_NO_WORD = new Set(['ignore-environment', 'null', 'debug',
  'list-signal-handling', 'help', 'version',
  'block-signal', 'default-signal', 'ignore-signal']);

/**
 * Index of the first word of a simple command that can actually BE its command
 * word: word 0 after leading `VAR=value` assignments and empty placeholder
 * words. The placeholder skip is load-bearing, not tidiness: a descended
 * region or an empty quoted span leaves a word SLOT with no text, so
 * `$(echo) git commit -m x` really commits while its git word sits at index 1.
 * @param {string[]} words
 * @returns {number}
 */
function commandStart(words) {
  let i = 0;
  while (i < words.length && (words[i] === '' || ASSIGNMENT.test(words[i]))) i++;
  return i;
}

/**
 * Walk GNU env's own option region, starting at the word just after an `env`
 * word. ONE home for env's grammar, read by both the `-S` re-tokenization and
 * the command-position gate.
 *
 * Options that take a SEPARATE argument are skipped WITH that argument rather
 * than ending the walk: stopping at the first non-flag word made
 * `env -u HOME -S "git push origin main"` and `env -C /tmp -S "..."` silent
 * real pushes, because the walk ended on `HOME` before it ever reached `-S`.
 * A short cluster is walked letter by letter for the same reason - `-S` is an
 * option wherever it sits in one, so `-iS "git push"` is caught.
 *
 * An option this walk does not know does NOT silently end it: `unresolved` is
 * returned so the caller can fail toward asking. That is what keeps the next
 * env option nobody anticipated from becoming the next silent bypass.
 *
 * @param {string[]} words
 * @param {number} start index just after the `env` word
 * @returns {{end: number, splits: string[], unresolved: boolean}} `end` is the
 *   first word past env's options (its command word, if it has one), `splits`
 *   the `-S`/`--split-string` operands (each a COMMAND LINE, not an argument).
 */
function envOptions(words, start) {
  /** @type {string[]} */
  const splits = [];
  let j = start;
  while (j < words.length) {
    const a = words[j];
    if (a === '' || ASSIGNMENT.test(a)) { j++; continue; }
    if (a === '--') { j++; break; }          // explicit end of options
    if (a === '-') {                         // "a mere - implies -i", then operands
      j++;
      while (j < words.length && (words[j] === '' || ASSIGNMENT.test(words[j]))) j++;
      break;
    }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      const name = eq < 0 ? a.slice(2) : a.slice(2, eq);
      const glued = eq < 0 ? null : a.slice(eq + 1);
      if (ENV_LONG_WITH_ARG.has(name)) {
        const arg = glued !== null ? glued : words[j + 1];
        if (name === 'split-string' && arg !== undefined) splits.push(arg);
        j += glued !== null ? 1 : 2;
        continue;
      }
      if (ENV_LONG_NO_WORD.has(name)) { j++; continue; }
      return { end: j, splits, unresolved: true };
    }
    if (a.startsWith('-')) {
      let consumedNext = false;
      let known = true;
      for (let k = 1; k < a.length; k++) {
        const ch = a[k];
        if (ENV_SHORT_WITH_ARG.includes(ch)) {
          const rest = a.slice(k + 1);
          const arg = rest !== '' ? rest : words[j + 1];
          if (ch === 'S' && arg !== undefined) splits.push(arg);
          if (rest === '') consumedNext = true;
          break;                              // the rest of the cluster IS the argument
        }
        if (!ENV_SHORT_FLAGS.includes(ch)) { known = false; break; }
      }
      if (!known) return { end: j, splits, unresolved: true };
      j += consumedNext ? 2 : 1;
      continue;
    }
    break;                                    // env's command word
  }
  return { end: j, splits, unresolved: false };
}

/**
 * Index of the COMMAND WORD of a simple command: `commandStart`, and past an
 * `env` word with its whole option region (env is a genuinely transparent
 * prefix, and its grammar is already written down above for `-S`).
 *
 * This is the ONE gate on DENY power, and it needs no enumeration to be right.
 * Detection stays any-position - that is what catches `sudo bash -c "git
 * push"` and `grep git commit` - but a wrapper or a git word found anywhere
 * other than command position can only ever produce an ASK, because at any
 * other position it is very often data: `rg -t sh "git commit"`,
 * `echo bash -c "git commit -m x"`, `grep git commit` and `command -v git
 * commit` all resolve to `commit` while committing nothing.
 *
 * An earlier cut gated deny with an enumerated set of transparent prefix
 * commands (`sudo`, `timeout`, `nohup`, ...) so that `sudo git commit` kept
 * its hard refusal. That set was dropped: every prefix carries its own option
 * grammar (`sudo -u john`, `timeout --signal KILL 60`, `find -exec`), so the
 * enumeration had an open-ended tail that three review rounds kept finding new
 * members of - including a FALSE deny on `command -v git commit`, which runs
 * nothing. Losing it costs `sudo git commit` an ask instead of a deny on a
 * protected branch, which is the safe direction; a wrong position rule in the
 * other direction hard-blocks read-only work.
 * @param {string[]} words
 * @returns {number}
 */
function commandWordIndex(words) {
  let i = commandStart(words);
  if (i < words.length && isEnvWord(words[i])) {
    i = envOptions(words, i + 1).end;
    while (i < words.length && (words[i] === '' || ASSIGNMENT.test(words[i]))) i++;
  }
  return i;
}

/**
 * The texts to re-tokenize for one operand word of a matched wrapper, in
 * order. A genuine flag cluster contributes nothing; anything else is a
 * payload. A `-`-leading payload is tried BOTH whole (`-n; git push origin
 * main` is a real command list) and with its leading flag letters stripped,
 * because `bash -c"git push"` is valid bash and tokenizes to the single glued
 * word `-cgit push` - the strip is what finds the `git` again.
 * @param {string} w
 * @returns {string[]}
 */
function operandTexts(w) {
  if (!w.startsWith('-')) return [w];
  if (FLAG_CLUSTER.test(w)) return [];
  const texts = [w];
  const run = /^-([A-Za-z]*)/.exec(w)?.[1] ?? '';
  const k = Math.min(run.length, MAX_FLAG_STRIP);
  for (let s = 1; s <= k; s++) {
    const t = w.slice(1 + s);
    if (t && !texts.includes(t)) texts.push(t);
  }
  return texts;
}

/**
 * Does raw (undescended or unterminated) text carry a `git` token? This is
 * D-03's signal: an unresolvable shape stays silent unless a git word is in
 * it. Tokens are delimited by whitespace OR by a region opener/closer
 * (`$(`, backtick, `(`, `)`, quotes, separators), so the raw text of a
 * pathological nest - `$($($(git push)))`, never split by a space - still
 * fails toward asking. This runs ONLY on text the tokenizer could not place,
 * where a wider split can add a prompt and can never remove one.
 * @param {string} raw
 * @returns {boolean}
 */
function hasGitToken(raw) {
  for (const t of raw.split(/[\s;|&()`'"$]+/)) {
    if (t === 'git' || t.endsWith('/git')) return true;
  }
  return false;
}

/**
 * Index of the `)` matching an already-consumed `(`, or -1 if unterminated.
 * Counts nested `(`/`)` at outside state only and honors quote state within,
 * so a paren inside quotes never closes the region.
 * @param {string} src
 * @param {number} start index just after the opening `(`
 * @returns {number}
 */
function findCloseParen(src, start) {
  let depth = 1;
  let q = 0; // 0 outside, 1 single-quoted, 2 double-quoted
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (q === 1) { if (c === "'") q = 0; continue; }
    if (q === 2) {
      if (c === '\\') { i++; continue; }
      if (c === '"') q = 0;
      continue;
    }
    if (c === '\\') { i++; continue; }
    if (c === "'") { q = 1; continue; }
    if (c === '"') { q = 2; continue; }
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

/**
 * Index of the next unescaped backtick, or -1 if unterminated.
 * @param {string} src
 * @param {number} start index just after the opening backtick
 * @returns {number}
 */
function findCloseBacktick(src, start) {
  for (let i = start; i < src.length; i++) {
    if (src[i] === '\\') { i++; continue; }
    if (src[i] === '`') return i;
  }
  return -1;
}

/**
 * Tokenize a shell command string into simple commands of words.
 *
 * ONE pass, one quote state (outside / single / double). Quoted spans become
 * word CONTENT rather than being stripped, so `git -C "my repo" push` keeps
 * six words and `echo "git push"` stays a two-word command whose second word
 * is the string `git push` (never a git word). Commands found inside
 * descended regions - `$(...)`, backticks, command-position `(...)` - are
 * appended to the same flat list.
 *
 * @param {string} text
 * @param {number} [depth] descent budget already spent (threaded, see MAX_DEPTH)
 * @returns {{commands: string[][], unplaced: boolean}}
 */
export function tokenizeCommand(text, depth = 0) {
  const src = String(text ?? '');
  /** @type {string[][]} */
  const commands = [];
  let unplaced = false;
  /** @type {string[]} */
  let words = [];
  let cur = '';
  let started = false;
  // Set when a redirection operator was just consumed: the next word that
  // completes is that redirection's TARGET, which the shell removes from the
  // command's word list, so it is dropped rather than pushed. Without this,
  // `git>out push` would report `out` as the subcommand and a real push would
  // go silent.
  let pendingRedirect = false;

  const endWord = () => {
    if (started) {
      if (pendingRedirect) {
        // The target is removed from the word list the way the shell removes
        // it - but a DROPPED word can be the only evidence of a real command:
        // `bash <<< "git push origin main"` leaves the wrapper with no operand
        // at all. So the drop still costs a look: a git word inside a dropped
        // target is unplaced, and the guard asks (D-03).
        if (hasGitToken(cur)) unplaced = true;
        pendingRedirect = false;
      } else words.push(cur);
      cur = ''; started = false;
    }
  };
  const endCommand = () => {
    endWord();
    pendingRedirect = false;
    if (words.length) { commands.push(words); words = []; }
  };
  /** @param {string} s */
  const add = (s) => { cur += s; started = true; };

  /**
   * Handle a descended region: tokenize it as its own command list appended
   * here, or - at the depth cap - refuse to descend and fail toward asking.
   *
   * A descended region contributes no CONTENT to the enclosing word, but it
   * DOES start that word, so the region leaves an empty placeholder word
   * instead of deleting the word slot. Both matter:
   *   - `git -C $(pwd) push origin main` - without the placeholder the word
   *     list is `git -C push origin main`, `-C` eats `push` as its argument,
   *     and a real push reads as `origin` and goes silent. Same for
   *     `` git -C `pwd` push `` and `git -c $(echo a=b) push`.
   *   - `echo hi $(echo)#x; git push origin main` - `#` is a comment only when
   *     it OPENS a word, and a preceding region leaves the shell mid-word, so
   *     without `started` the `#` swallows the real push behind it.
   * The placeholder is never a git word (`''` is not `git` and does not end in
   * `/git`) and never a wrapper, and it is skipped when reading a subcommand.
   * It is NOT inert for the position gates, though: `$(echo) git commit -m x`
   * really commits, so commandStart skips leading placeholders the same way it
   * skips leading `VAR=value` assignments.
   * @param {string} raw
   * @param {boolean} unterminated
   */
  const region = (raw, unterminated) => {
    started = true;          // the region leaves a word SLOT, not nothing
    pendingRedirect = false; // a substitution after `>` IS the target
    if (unterminated && hasGitToken(raw)) unplaced = true;
    if (depth >= MAX_DEPTH) {
      if (hasGitToken(raw)) unplaced = true;
      return;
    }
    const inner = tokenizeCommand(raw, depth + 1);
    for (const c of inner.commands) commands.push(c);
    if (inner.unplaced) unplaced = true;
  };

  let state = 0;    // 0 outside, 1 single-quoted, 2 double-quoted
  let openIdx = 0;  // start of the currently open quoted span's raw content
  const n = src.length;
  let i = 0;

  while (i < n) {
    const c = src[i];

    // --- single quotes: no escapes at all, everything is content ---------
    if (state === 1) {
      if (c === "'") { state = 0; i++; continue; }
      add(c); i++; continue;
    }

    // --- double quotes: backslash escapes exactly ", \, $, ` and newline --
    if (state === 2) {
      if (c === '"') { state = 0; i++; continue; }
      if (c === '\\') {
        const d = src[i + 1];
        if (d === '\n') { i += 2; continue; }                       // continuation
        if (d === '\r' && src[i + 2] === '\n') { i += 3; continue; } // CRLF continuation
        if (d === '"' || d === '\\' || d === '$' || d === '`') { add(d); i += 2; continue; }
        add('\\'); i++; continue; // any other: literal backslash, then the char
      }
      if (c === '$' && src[i + 1] === '(') {
        const close = findCloseParen(src, i + 2);
        region(close < 0 ? src.slice(i + 2) : src.slice(i + 2, close), close < 0);
        i = close < 0 ? n : close + 1;
        continue;
      }
      if (c === '`') {
        const close = findCloseBacktick(src, i + 1);
        region(close < 0 ? src.slice(i + 1) : src.slice(i + 1, close), close < 0);
        i = close < 0 ? n : close + 1;
        continue;
      }
      add(c); i++; continue;
    }

    // --- outside quotes ---------------------------------------------------
    if (c === '\\') {
      const d = src[i + 1];
      if (d === undefined) { add('\\'); i++; continue; }
      if (d === '\n') { i += 2; continue; }                       // continuation
      if (d === '\r' && src[i + 2] === '\n') { i += 3; continue; } // CRLF continuation
      add(d); i += 2; continue; // escaped: literal, never a separator/quote/opener
    }
    if (c === "'") { started = true; state = 1; openIdx = i + 1; i++; continue; }
    if (c === '"') { started = true; state = 2; openIdx = i + 1; i++; continue; }
    // $'...' (ANSI-C quoting): a single-quoted span with the `$` DROPPED.
    // The span's escape sequences are NOT interpreted - `\n` stays two
    // literal characters (stated as out-of-grammar in references/git.md).
    if (c === '$' && src[i + 1] === "'") {
      started = true; state = 1; openIdx = i + 2; i += 2; continue;
    }
    // $"..." (locale translation) is a double-quoted span with the `$`
    // DROPPED: bash evaluates $"git" to git, so without this rule
    // `$"git" push origin main` is a real, silent push (review: adjudicated
    // risk-surface finding D).
    if (c === '$' && src[i + 1] === '"') {
      started = true; state = 2; openIdx = i + 2; i += 2; continue;
    }
    if (c === '$' && src[i + 1] === '(') {
      const close = findCloseParen(src, i + 2);
      region(close < 0 ? src.slice(i + 2) : src.slice(i + 2, close), close < 0);
      i = close < 0 ? n : close + 1;
      continue;
    }
    if (c === '`') {
      const close = findCloseBacktick(src, i + 1);
      region(close < 0 ? src.slice(i + 1) : src.slice(i + 1, close), close < 0);
      i = close < 0 ? n : close + 1;
      continue;
    }
    // A `#` that OPENS a word is a comment to end of line; the newline still
    // separates. Mid-word (`file#1`) it is ordinary content.
    if (c === '#' && !started) {
      const nl = src.indexOf('\n', i);
      i = nl < 0 ? n : nl;
      continue;
    }
    // A `(` in COMMAND POSITION opens a subshell group, so `(git push)` and
    // `( git push )` behave identically instead of turning on whitespace.
    if (c === '(' && !started) {
      const close = findCloseParen(src, i + 1);
      region(close < 0 ? src.slice(i + 1) : src.slice(i + 1, close), close < 0);
      i = close < 0 ? n : close + 1;
      continue;
    }
    // Redirection. `<(` / `>(` open a PROCESS SUBSTITUTION, descended into
    // exactly like `$(` - `cat <(git push origin main)` really pushes, and
    // treating `<` as ordinary content swallowed the region into the words
    // `<(git` and `push)` (review: adjudicated risk-surface finding A).
    // Otherwise `<` and `>` are word BOUNDARIES rather than word characters:
    // `git push>/tmp/out` must still resolve to `push` (finding B). A leading
    // all-digit word is an fd prefix (`2>`), and the target word that follows
    // is dropped, both the way the shell removes a redirection from the word
    // list - so `git 2>out push` resolves to `push`, not to `2` or `out`.
    if (c === '<' || c === '>') {
      if (src[i + 1] === '(') {
        const close = findCloseParen(src, i + 2);
        region(close < 0 ? src.slice(i + 2) : src.slice(i + 2, close), close < 0);
        i = close < 0 ? n : close + 1;
        continue;
      }
      if (started && /^[0-9]+$/.test(cur)) { cur = ''; started = false; }
      endWord();
      let j = i;
      while (j < n && (src[j] === '<' || src[j] === '>')) j++;
      if (src[j] === '&') j++; // `2>&1`: fd duplication is part of the operator
      i = j;
      pendingRedirect = true;
      continue;
    }
    // An unmatched `)` at outside state is not valid shell: a matched one is
    // consumed by findCloseParen and never arrives here. Ending the word and
    // the command (the way `;` does) is what keeps a mis-picked close paren -
    // `echo $(echo ${x:-)}; git push)` - failing toward asking instead of
    // gluing the real push into the word `push)` and going silent (review:
    // adjudicated risk-surface finding C).
    if (c === ')') { endCommand(); i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r') { endWord(); i++; continue; }
    if (c === '\n' || c === ';') { endCommand(); i++; continue; }
    if (c === '&') { endCommand(); i += src[i + 1] === '&' ? 2 : 1; continue; }
    if (c === '|') { endCommand(); i += src[i + 1] === '|' ? 2 : 1; continue; }
    add(c); i++;
  }

  // End of input inside an open quoted span closes it implicitly: what
  // accumulated is emitted as the word, and the span's RAW text decides
  // whether the shape is merely unresolvable (silent) or carries a git word
  // the tokenizer could not place (D-03: ask).
  if (state !== 0 && hasGitToken(src.slice(openIdx))) unplaced = true;
  endCommand();
  return { commands, unplaced };
}

/**
 * The git subcommands a shell command actually invokes, plus whether a `git`
 * word was seen that the tokenizer could not place.
 *
 * A word is a GIT WORD when it equals `git` or ends with `/git` - word
 * content, so the single word `git push` produced by `echo "git push"` is not
 * one. From the word after a git word, global options that take an argument
 * are skipped with their argument, other `-`-leading words are skipped, and
 * the first remaining word is the subcommand. The scan then CONTINUES, so a
 * second git invocation in the same simple command is reported too.
 *
 * A wrapper word (SHELL_WRAPPERS) matched AT ANY POSITION has its operands
 * re-tokenized and appended to the work queue - the same any-position rule the
 * git-word scan already uses. That one rule is what covers `sudo bash -c ...`,
 * `timeout 60 bash -c ...`, `nohup bash -c ...`, `xargs bash -c ...`,
 * `env`/`/usr/bin/env` and `VAR=value` prefixes without a second enumerated
 * prefix set to maintain; word-boundary preservation is what keeps it safe,
 * since `git commit -m "bash -c git push"` is a single quoted WORD and never
 * matches. Flags are tolerated rather than enumerated (`-c`, `-lc`, `-exc`),
 * which also covers `eval`, which has none. `eval` takes one further rule: the
 * shell CONCATENATES its operands with a space and executes the result, so
 * `eval "git" "push origin main"` is a real push that per-operand
 * re-tokenization would miss entirely - eval's operands are joined before
 * re-tokenization. The wrapper rule lives HERE and not in tokenizeCommand: the
 * lexer stays a lexer, the wrapper set is semantics.
 *
 * An `env` word gets one further rule of its own: GNU `env -S` /
 * `--split-string` SPLITS its operand and executes it, so that operand is a
 * command line and is re-tokenized through the same machinery and the same
 * budgets. Without it `env -S "git push origin main"` was a real push with no
 * decision at all. env's whole option region is read by envOptions, so an
 * option taking a separate argument (`env -u HOME -S "..."`) no longer ends
 * the scan before `-S`, and an option envOptions does not know sets `unplaced`
 * rather than going quiet.
 *
 * DETECTION is any-position; REFUSAL is command-position only, and the gate
 * applies at BOTH levels. A subcommand is deny-eligible only when the wrapper
 * it was reached through (if any) sat at command position in its simple
 * command AND the git word itself sat at command position in its own - one
 * rule, commandWordIndex, with no set of prefix commands to enumerate.
 * Otherwise it is reported in `subs` and withheld from `denyable`, so the
 * caller may ask on it and can never hard-block on it. `rg -t sh "git
 * commit"`, `echo bash -c "git commit -m x"`, `grep git commit` and
 * `command -v git commit` all resolve to `commit` while committing nothing,
 * whereas `bash -c "git commit -m x"`, `$(echo) git commit -m x` and
 * `git commit -m x` are real commits and stay deny-eligible. A transparent
 * prefix (`sudo git commit -m x`, `timeout 60 git commit -m x`) ASKS rather
 * than denying: see commandWordIndex for why the prefix enumeration that used
 * to keep those denies was dropped.
 *
 * @param {unknown} text
 * @param {number} [depth] descent budget already spent (threaded)
 * @returns {{subs: string[], unplaced: boolean, denyable: string[]}}
 */
export function gitSubcommands(text, depth = 0) {
  const src = String(text ?? '');
  if (!src) return { subs: [], unplaced: false, denyable: [] };

  const first = tokenizeCommand(src, depth);
  let unplaced = first.unplaced;
  /** @type {string[]} */
  const subs = [];
  /** @type {string[]} */
  const denyable = [];
  // The work queue carries each simple command with the descent budget already
  // spent to reach it, so wrapper nesting (`bash -c "bash -c \"...\""`)
  // terminates at MAX_DEPTH: a fresh re-tokenization restarting at 0 would
  // bound nothing. `deny` rides along the same way: a command reached through
  // a non-command-position wrapper is ask-only, and so is everything below it.
  /** @type {{words: string[], depth: number, denyable: boolean}[]} */
  const queue = first.commands.map((words) => ({ words, depth, denyable: true }));

  // Memoized: a wrapper with no operand at all (`echo "git push" | bash`) is
  // read against the whole original source, and that check can repeat.
  /** @type {boolean | null} */
  let srcGit = null;
  const sourceHasGit = () => (srcGit ??= hasGitToken(src));

  let seen = 0;
  let expansions = 0;
  let budgetSpent = false;
  while (queue.length) {
    if (++seen > MAX_COMMANDS) { unplaced = true; break; }
    const item = /** @type {{words: string[], depth: number, denyable: boolean}} */
      (queue.shift());
    const words = item.words;
    // ONE position gate for both the wrapper and the git word (see
    // commandWordIndex): DETECTION is any-position, DENY is command-position.
    const cmdPos = commandWordIndex(words);
    // Every word is re-tokenized at most ONCE per simple command, however many
    // wrapper words precede it: re-scanning each operand per wrapper word is
    // the O(N^2) shape that made a long command a multi-second stall.
    let expandFrom = 0;

    /**
     * Re-tokenize one operand text and queue what it holds, under the shared
     * depth and expansion budgets.
     * @param {string} t
     * @param {boolean} childDenyable
     */
    const expand = (t, childDenyable) => {
      if (item.depth >= MAX_DEPTH) {
        if (hasGitToken(t)) unplaced = true; // fail toward asking
        return;
      }
      if (expansions >= MAX_EXPANSIONS) { budgetSpent = true; unplaced = true; return; }
      expansions++;
      const inner = tokenizeCommand(t, item.depth + 1);
      for (const c of inner.commands) {
        queue.push({ words: c, depth: item.depth + 1, denyable: childDenyable });
      }
      if (inner.unplaced) unplaced = true;
    };

    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      // `env -S "git push origin main"` / `--split-string`: GNU env SPLITS the
      // operand and executes it, so it is a command line, not an argument.
      // Left unhandled it was neither detected nor listed - a real push with no
      // prompt - so the operand goes through the same re-tokenization (and the
      // same budgets) as a wrapper's. An `env` word is at command position when
      // only assignments precede it, which is the same deny gate the wrapper
      // set uses.
      if (isEnvWord(w)) {
        const childDenyable = item.denyable && i === commandStart(words);
        const { splits, unresolved } = envOptions(words, i + 1);
        for (const t of splits) {
          if (budgetSpent) break;
          if (t) expand(t, childDenyable);
        }
        // An option envOptions could not account for means env's operands were
        // never located, so a `-S` further along may have been missed. Read the
        // source for a `git` token and fail toward asking - the rule that keeps
        // the next unknown env option from being the next silent bypass.
        if (unresolved && !unplaced && sourceHasGit()) unplaced = true;
        continue; // `env` is neither a wrapper nor a git word
      }
      if (isWrapper(w)) {
        // Any-position DETECTION, command-position DENY (see the doc comment).
        const childDenyable = item.denyable && i === cmdPos;

        // No operand to scan at all - the wrapper is fed by a pipe, a heredoc
        // or a redirect (`echo "git push origin main" | bash`), all of which
        // really execute. Read the whole original source for a git word and
        // fail toward asking; do not attempt pipeline data-flow analysis.
        let hasOperand = false;
        for (let j = i + 1; j < words.length && j - i <= OPERAND_LOOKAHEAD; j++) {
          // An empty placeholder word (a descended region, an empty quoted
          // span) carries no text to re-tokenize, so it is not an operand:
          // `echo "git push" | bash $(tty)` must still read the whole source.
          if (words[j] !== '' && !FLAG_CLUSTER.test(words[j])) { hasOperand = true; break; }
        }
        if (!hasOperand && !unplaced && sourceHasGit()) unplaced = true;

        if (!budgetSpent) {
          const start = Math.max(i + 1, expandFrom);
          if (w === 'eval' || w.endsWith('/eval')) {
            // eval executes the CONCATENATION of its operands, not each of them.
            /** @type {string[]} */
            const joined = [];
            for (let j = start; j < words.length; j++) {
              if (words[j] === '' || FLAG_CLUSTER.test(words[j])) continue;
              joined.push(words[j]);
            }
            if (joined.length) expand(joined.join(' '), childDenyable);
          } else {
            for (let j = start; j < words.length && !budgetSpent; j++) {
              if (words[j] === '') continue; // placeholder: no text to re-read
              const texts = operandTexts(words[j]);
              // A skipped flag cluster still gets read: a git word inside one
              // would otherwise be dropped silently.
              if (!texts.length) { if (hasGitToken(words[j])) unplaced = true; continue; }
              for (const t of texts) { expand(t, childDenyable); if (budgetSpent) break; }
            }
          }
          expandFrom = words.length;
        }
        continue; // a wrapper word is never a git word
      }
      if (!(w === 'git' || w.endsWith('/git'))) continue;
      // A git word that is not the command word of its simple command is a
      // MENTION, not an invocation: `grep git commit`, `command -v git commit`
      // and the child command of `bash -c "echo git commit"` all resolve to
      // `commit` without committing anything, and all were hard-denied under
      // git.on_protected=refuse before this gate. Detection is unchanged; only
      // the deny is withheld. A transparent prefix (`sudo git commit`) is on
      // the losing side of that trade by design - see commandWordIndex.
      const gitDenyable = item.denyable && i === cmdPos;
      for (let j = i + 1; j < words.length; j++) {
        const a = words[j];
        if (GIT_OPT_WITH_ARG.has(a)) { j++; continue; } // option + its argument
        if (a === '') continue;                        // region/empty-quote placeholder
        if (a.startsWith('-')) continue;               // other global flags
        subs.push(a);
        if (gitDenyable) denyable.push(a);
        i = j; // continue the outer scan from here: report every invocation
        break;
      }
    }
  }

  return { subs, unplaced, denyable };
}
