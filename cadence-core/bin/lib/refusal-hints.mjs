// @ts-check
// refusal-hints.mjs - self-verify's check 22: a refusal a user can read must name the next step (#238)
// in scope: the emitting call (emit, out or fail with ok:false), not a field named reason
// a character scan, not a line regex: arguments wrap and a hint can sit lines below its reason
// emit and out count on a literal ok: false, fail always; hinted is a hint key, spread included, or three args to fail
// the register is the only exclusion mechanism; usage and internal are excluded by token
// pure; an absent or unreadable bin reports nothing; no CONTRACTS row since lib/*.mjs are never invoked from prose
'use strict';

import { join, relative, sep } from 'node:path';
import { readText } from './include-consumers.mjs';
import { regexHere, skim } from './skim.mjs';
import { dirents } from './surface-weight.mjs';

/** The problem codes this rule files. */
export const CODES = Object.freeze({
  hintless: 'hintless-refusal',
});

/**
 * The exclusion register: every exclusion this check makes is a row here
 * with a one-line reason, and there is no other mechanism.
 * tokens match the refusal's reason token, files match the path relative to cadence-core/bin, always spelled with /.
 * @type {Readonly<{tokens: ReadonlyArray<{token: string, reason: string}>,
 *                  files: ReadonlyArray<{file: string, reason: string}>}>}
 */
export const REGISTER = Object.freeze({
  tokens: Object.freeze([
    Object.freeze({
      token: 'usage',
      reason: 'the next step already rides the sibling `detail` - a second copy would fork one sentence in two (D-03)',
    }),
    Object.freeze({
      token: 'internal',
      reason: 'no user action beyond filing a bug; demanding a hint here is how a check gets silenced rather than satisfied (D-03)',
    }),
  ]),
  files: Object.freeze([
    Object.freeze({
      file: 'git-guard.mjs',
      reason: 'its `reason` IS the hook payload\'s permissionDecisionReason - plain prose that already names the action - and it runs on the PreToolUse hot path (D-06)',
    }),
    Object.freeze({
      file: 'lib/bulk-output.mjs',
      reason: 'static classification rows self-verify READS, never an envelope a user sees (D-05)',
    }),
    Object.freeze({
      file: 'lib/text-transport.mjs',
      reason: 'static classification rows self-verify READS, never an envelope a user sees (D-05)',
    }),
    Object.freeze({
      file: 'lib/release-decision.mjs',
      reason: 'static classification rows self-verify READS, never an envelope a user sees (D-05)',
    }),
    Object.freeze({
      file: 'lib/why-query.mjs',
      reason: 'sub-envelope returns re-wrapped as `bad-query` by why.mjs before anything is emitted (D-07)',
    }),
    Object.freeze({
      file: 'lib/read-trace.mjs',
      reason: 'returns `{written:false, reason}` with no `ok` field - best-effort telemetry whose callers swallow the refusal (D-07)',
    }),
    Object.freeze({
      file: 'lib/trace.mjs',
      reason: 'returns `{written:false, reason}` with no `ok` field - best-effort telemetry whose callers swallow the refusal (D-07)',
    }),
  ]),
});

/** The three call names that put an `ok:false` envelope on stdout. */
const CALLEES = new Set(['emit', 'out', 'fail']);

/** A JavaScript identifier character. */
const ID = /[A-Za-z0-9_$]/;

/** How much of a non-literal reason expression a detail carries. */
const EXPR_MAX = 120;

/** The detail text for an envelope that carries no `reason` key at all. */
const NO_REASON = '(no reason key)';

/**
 * The index just past the string, template or regex literal starting at i, or -1 when i doesn't start one.
 * A template literal is consumed whole, interpolations included, as skim does: a refusal written inside one
 * would be missed (this tree has none), and no nesting depth can desynchronise the scan in return. Every arm
 * is bounded by the string length, so an unterminated literal ends the scan instead of looping.
 * @param {string} s @param {number} i
 * @returns {number}
 */
function skipLiteral(s, i) {
  const c = s[i];
  if (c === '"' || c === "'" || c === '`') {
    let j = i + 1;
    while (j < s.length) {
      if (s[j] === '\\') { j += 2; continue; }
      if (s[j] === c) return j + 1;
      j += 1;
    }
    return s.length;
  }
  if (c === '/' && regexHere(s, i)) {
    let j = i + 1;
    let cls = false;
    while (j < s.length) {
      const r = s[j];
      if (r === '\\') { j += 2; continue; }
      if (r === '\n') return i + 1; // unterminated: not a literal after all
      if (r === '[') cls = true;
      else if (r === ']') cls = false;
      else if (r === '/' && !cls) return j + 1;
      j += 1;
    }
    return s.length;
  }
  return -1;
}

/**
 * The one walk the three source parsers below share: from `from`, skip string, template and regex literals, track bracket
 * depth, and hand `atTop` each character met at depth 0 that doesn't open a bracket. `atTop` returns true to stop the walk.
 * @param {string} s @param {number} from @param {(c: string, i: number) => boolean} atTop
 * @returns {number} the index it stopped at, or -1 when the text ran out first
 */
function walkDepth(s, from, atTop) {
  let depth = 0;
  let i = from;
  while (i < s.length) {
    const lit = skipLiteral(s, i);
    if (lit >= 0) { i = lit; continue; }
    const c = s[i];
    if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (depth === 0 && atTop(c, i)) return i;
    else if (c === ')' || c === ']' || c === '}') depth -= 1;
    i += 1;
  }
  return -1;
}

/**
 * The balanced argument span of a call whose `(` sits at `openIdx`.
 * @param {string} s @param {number} openIdx
 * @returns {{end: number, args: string[]}|null} `null` when the `(` never closes
 */
function balancedArgs(s, openIdx) {
  let start = openIdx + 1;
  /** @type {string[]} */
  const args = [];
  const end = walkDepth(s, start, (c, i) => {
    if (c === ',') { args.push(s.slice(start, i)); start = i + 1; }
    return c === ')';
  });
  if (end < 0) return null;
  args.push(s.slice(start, end));
  const trimmed = args.map((a) => a.trim());
  // f() splits to one empty argument; any other empty slot is a real elision, so the argument count stays honest
  return { end, args: trimmed.length === 1 && trimmed[0] === '' ? [] : trimmed };
}

/**
 * Every emit, out or fail call in comment-stripped source, with its balanced argument list. A declaration is
 * skipped, it's a signature and not a call, and a name reached through a . belongs to someone else.
 * @param {string} s comment-stripped source
 * @returns {{callee: string, at: number, span: string, args: string[]}[]}
 */
function callSites(s) {
  /** @type {{callee: string, at: number, span: string, args: string[]}[]} */
  const sites = [];
  let i = 0;
  let prevWord = '';
  while (i < s.length) {
    const lit = skipLiteral(s, i);
    if (lit >= 0) { i = lit; prevWord = ''; continue; }
    const c = s[i];
    if (ID.test(c)) {
      let j = i;
      while (j < s.length && ID.test(s[j])) j += 1;
      const word = s.slice(i, j);
      const before = i > 0 ? s[i - 1] : '';
      let k = j;
      while (k < s.length && /\s/.test(s[k])) k += 1;
      if (CALLEES.has(word) && before !== '.' && s[k] === '(' && prevWord !== 'function') {
        const span = balancedArgs(s, k);
        if (span) sites.push({ callee: word, at: i, span: s.slice(k, span.end + 1), args: span.args });
      }
      prevWord = word;
      i = j;
      continue;
    }
    if (!/\s/.test(c)) prevWord = '';
    i += 1;
  }
  return sites;
}

/**
 * The value of a single or double quoted string literal, or null when text isn't exactly one.
 * A character walk and not a pattern: the obvious regex nests two quantifiers, so a long non-matching
 * argument would drive this process's backtracking, and this rule reads whatever source it's pointed at.
 * @param {string} text
 * @returns {string|null}
 */
function stringLiteral(text) {
  const q = text[0];
  if ((q !== '"' && q !== "'") || text.length < 2) return null;
  let outText = '';
  let i = 1;
  while (i < text.length) {
    const c = text[i];
    if (c === '\\') { outText += text[i + 1] === undefined ? '' : text[i + 1]; i += 2; continue; }
    if (c === q) return i === text.length - 1 ? outText : null;
    outText += c;
    i += 1;
  }
  return null;
}

/** One line of expression text, bounded, for a reason that is not a literal. */
function exprText(text) {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > EXPR_MAX ? `${flat.slice(0, EXPR_MAX)}…` : flat;
}

/**
 * The top-level properties of an object literal, as `{key, value}` pairs.
 * A shorthand property yields its own name as the value, which is what makes
 * `out({ ok: false, reason, detail })` read as `reason: reason`.
 * @param {string} text an argument's text, object literal or not
 * @returns {{key: string, value: string}[]}
 */
function objectProps(text) {
  if (text[0] !== '{') return [];
  const inner = text.slice(1, text.length - 1);
  /** @type {{key: string, value: string}[]} */
  const props = [];
  let start = 0;
  const push = (chunk) => {
    const t = chunk.trim();
    if (!t) return;
    const colon = topLevelColon(t);
    if (colon < 0) {
      if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(t)) props.push({ key: t, value: t });
      return;
    }
    props.push({ key: t.slice(0, colon).trim(), value: t.slice(colon + 1).trim() });
  };
  walkDepth(inner, 0, (c, i) => {
    if (c === ',') { push(inner.slice(start, i)); start = i + 1; }
    return false;
  });
  push(inner.slice(start));
  return props;
}

/** The index of a property's own `:`, skipping literals and nesting. */
function topLevelColon(t) {
  return walkDepth(t, 0, (c) => c === ':');
}

/**
 * Walk `cadence-core/bin` for the `.mjs` sources this rule reads.
 * `*.test.mjs` is off the walk - a test may write any shape it likes - and an
 * unreadable directory yields nothing rather than throwing.
 * Its own loop over `dirents` and not surface-weight's `walk`: that one yields a symlink as a path, and this rule reads real files only.
 * @param {string} dir
 * @returns {Generator<string>}
 */
function* sourceFiles(dir) {
  for (const d of dirents(dir)) {
    const f = join(dir, d.name);
    if (d.isDirectory()) { yield* sourceFiles(f); continue; }
    if (!d.isFile()) continue;
    if (!f.endsWith('.mjs') || f.endsWith('.test.mjs')) continue;
    yield f;
  }
}

/**
 * Every in-scope refusal site under root, hinted or not: the census the issue list is built on.
 * Exported because nothing else in the tree can answer how many sites are in scope.
 *
 * @param {string} root
 * @param {typeof REGISTER} [register] the exclusion register; a parameter so a
 *   test can prove the exclusions are read rather than compiled in
 * @returns {{file: string, line: number, token: string, callee: string, hinted: boolean}[]}
 */
export function refusalSites(root, register = REGISTER) {
  const binDir = join(root, 'cadence-core', 'bin');
  const excludedTokens = new Set((register && register.tokens ? register.tokens : []).map((r) => r.token));
  const excludedFiles = new Set((register && register.files ? register.files : []).map((r) => r.file));

  /** @type {{file: string, line: number, token: string, callee: string, hinted: boolean}[]} */
  const sites = [];
  for (const file of sourceFiles(binDir)) {
    const key = relative(binDir, file).split(sep).join('/');
    if (excludedFiles.has(key)) continue;
    const raw = readText(file);
    if (raw === null) continue;
    const src = skim(raw);
    for (const call of callSites(src)) {
      // fail is a refusal by construction; emit and out only when the envelope literally says ok: false
      if (call.callee !== 'fail' && !/(?<![\w$.])ok\s*:\s*false\b/.test(call.span)) continue;

      let token;
      let hinted;
      if (call.callee === 'fail') {
        const first = call.args.length ? call.args[0] : '';
        const lit = stringLiteral(first);
        token = call.args.length === 0 ? NO_REASON : (lit === null ? exprText(first) : lit);
        hinted = call.args.length >= 3;
      } else {
        const props = objectProps(call.args.length ? call.args[0] : '');
        const reason = props.find((p) => p.key === 'reason');
        const lit = reason ? stringLiteral(reason.value) : null;
        token = reason === undefined ? NO_REASON : (lit === null ? exprText(reason.value) : lit);
        // the conditional-spread form has no top-level hint property, so the span is what answers here
        hinted = /(?<![\w$.])hint\s*(?::|,|\}|$)/.test(call.span);
      }
      if (excludedTokens.has(token)) continue;

      sites.push({
        file: relative(root, file),
        line: src.slice(0, call.at).split('\n').length,
        token,
        callee: call.callee,
        hinted,
      });
    }
  }
  return sites;
}

/**
 * Every hintless-refusal issue under root. detail is spelled "line <N>: <token>" and
 * that spelling is pinned: the line number gets parsed back out of it.
 * @param {string} root
 * @param {typeof REGISTER} [register]
 * @returns {{kind: string, file: string, detail: string}[]}
 */
export function refusalHintIssues(root, register = REGISTER) {
  return refusalSites(root, register)
    .filter((s) => !s.hinted)
    .map((s) => ({
      kind: CODES.hintless,
      file: s.file,
      detail: `line ${s.line}: ${s.token}`,
    }));
}
