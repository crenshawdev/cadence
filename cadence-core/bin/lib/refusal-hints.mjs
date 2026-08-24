// @ts-check
// refusal-hints.mjs - the pure rule behind self-verify's refusal-hint check
// (check 22): a refusal a user can READ must name the next step.
//
// THE DEFECT (#238). Cadence states a failure in its own vocabulary and never
// states the remedy. Measured across `cadence-core/bin/` on 2026-08-23, tests
// excluded, 186 sites set a literal `reason` and 13 set a literal `hint` - and
// all 13 of those sit in `planning.mjs` or `skim.mjs`. A user who runs
// `config.mjs set nosuchkey=1` gets `{"ok":false,"reason":"invalid",...}` and
// nothing telling them what to type instead. Writing the missing hints is a
// one-time sweep; the sweep going stale the next time a seam ships a refusal is
// the failure this check exists to stop, which is why the invariant is a check
// and not a memory.
//
// THE POPULATION IS THE EMITTING CALL, NOT THE FIELD NAME (phase-1 D-02). A
// site is in scope when it EMITS an `ok:false` envelope on stdout - `emit`,
// `out` or `fail` - never when it merely contains a field called `reason`. The
// test is whether a user reads the token. Two rules were rejected for this one:
//   - a kebab-shape regex on `reason:` values. Only 85 of the 158 in-code
//     `reason:` sites pass it, it admits returns that are never emitted, and it
//     misses every interpolated token (`reason: e.seam`, `reason: primary.code`)
//     - which are exactly the refusals a user is most likely to hit.
//   - a per-file allowlist. It drifts silently as new seams ship, which is the
//     failure this check exists to stop, one indirection down.
// Keyed on the `reason:` object key alone the check goes GREEN while
// `planning.mjs`'s 150-odd hintless `fail()` refusals - the largest
// user-facing refusal surface in the plugin - stay untouched. Both spellings,
// or the check measures nothing.
//
// COMMENTS ARE STRIPPED FIRST, with the tree's own `skim` (phase-1 D-08). 28 of
// the raw hits are comments and JSDoc, and reporting them would name design
// prose the sweep must not edit. `skim` replaces a comment with its own
// newlines and nothing else, so line N of the skimmed text is line N of the
// file and every reported line addresses the ORIGINAL source.
//
// WHY A CHARACTER SCAN AND NOT A LINE REGEX. A refusal's argument list wraps
// across lines, its `hint` is often three lines below its `reason`, and a
// `fail(` inside a regex character class or a string is not a call. So the scan
// tracks string, template and regex literals - the same three `skim` tracks,
// and for the same reason - and takes each call's BALANCED argument span before
// classifying it. Dropping regex-literal tracking alone lost 29 real
// `planning.mjs` refusals to a `/['"]/` that opened a phantom string.
//
// CLASSIFICATION, once a call is found:
//   - `emit`/`out` is in scope when its argument span carries a literal
//     `ok: false`. A computed `ok:` (`ok: problems.length === 0`) is a report,
//     not a refusal.
//   - `fail` is ALWAYS in scope: every `fail` wrapper in this tree emits
//     `ok:false` by construction.
//   - HINTED means the object literal carries a `hint` key - including the
//     conditional-spread spelling `...(hint ? { hint } : {})` - or, for `fail`,
//     that the call passes three or more top-level arguments.
// A `function fail(...)` DECLARATION is not a call and is not a site; the
// wrapper's BODY is scanned like any other code, which is deliberate: the three
// two-argument wrappers report through the `out({ok:false, reason, detail})` in
// their own bodies until their signatures are widened, and `planning.mjs`'s
// already-widened wrapper classifies as hinted with no special case.
//
// A NON-LITERAL REASON STAYS IN SCOPE. `reason: e.seam`, `reason: decision.reason`
// and `fail(reason, ...)` are reported with the EXPRESSION text as written where
// a literal token would go, because a rule that could only read literals is the
// kebab-shape rule D-02 rejected. A site emitting `ok:false` with no `reason`
// key at all - `config.mjs` has one, carrying only `file`, `checked` and
// `errors` - is in scope too, and says `(no reason key)` rather than inventing
// a token.
//
// THE REGISTER IS THE ONLY EXCLUSION MECHANISM. There is no positional, no
// line-based and no per-site exemption, because a per-site exemption is how a
// check gets silenced rather than satisfied. It is a PARAMETER rather than a
// hard-wired read of `REGISTER`, so a test can hand the rule a substitute and
// prove the exclusions are read rather than compiled in (phase-1 AC6).
//
// Its two token rows are excluded BY TOKEN NAME (phase-1 D-03):
//   `usage`    already carries the next step in its sibling `detail` - e.g.
//              `worktree-base.mjs`'s `'subcommand: resolve [--dir <path>]'` -
//              so demanding a second copy would fork one sentence in two.
//   `internal` has no user action beyond filing a bug, and demanding a hint
//              there is how a check gets silenced rather than satisfied.
//
// Its seven file rows are all DOCUMENTARY TODAY: not one of the seven calls
// `emit`, `out` or `fail`, so the rule excludes every one of them structurally
// as well, and deleting the rows would change nothing this week. They are kept
// so a later reader can tell a deliberate exclusion from an oversight - each
// names WHY that file's `reason` fields are not refusals a user reads, and each
// would start reporting the day that file grew an emitting call for the reasons
// its row states it should not.
//   `git-guard.mjs`            its `reason` is the hook payload's
//                              `permissionDecisionReason`, already plain prose
//                              that names the action, and it runs on the
//                              PreToolUse hot path (phase-1 D-06).
//   `lib/bulk-output.mjs`      \
//   `lib/text-transport.mjs`    > static classification rows self-verify READS;
//   `lib/release-decision.mjs` /  no user ever sees one as a refusal (D-05).
//   `lib/why-query.mjs`        \
//   `lib/read-trace.mjs`        > sub-envelope RETURNS a caller re-wraps or
//   `lib/trace.mjs`            /  swallows before anything is emitted (D-07).
//
// Pure rule: no emit, no exit, no Date, no randomness, node builtins only, and
// every read guarded. An absent or unreadable `cadence-core/bin` reports
// nothing rather than throwing - the same partial-fixture degradation
// lib/include-consumers.mjs and lib/deferred-reads.mjs use. The disk half -
// filing each issue as a CI problem - lives in self-verify.mjs, the same split
// lib/merge-warnings.mjs, lib/route-relay.mjs and lib/config-reach.mjs use. It
// takes no CONTRACTS row, for the reason check 14 states about `lib/*.mjs`.
'use strict';

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { skim } from './skim.mjs';

/** The problem codes this rule files. */
export const CODES = Object.freeze({
  hintless: 'hintless-refusal',
});

/**
 * The exclusion register. Every exclusion this check makes is a row here with a
 * one-line reason - see the header for the long form and the phase-1 decision
 * each row implements. There is no other exclusion mechanism.
 *
 * `tokens` are matched against the refusal's reason token, `files` against the
 * file's path relative to `cadence-core/bin`, always spelled with `/`.
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

/** Words after which a `/` opens a regex literal rather than dividing. */
const REGEX_PRECEDING = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
  'throw', 'case', 'do', 'else', 'yield', 'await',
]);

/** How much of a non-literal reason expression a detail carries. */
const EXPR_MAX = 120;

/** The detail text for an envelope that carries no `reason` key at all. */
const NO_REASON = '(no reason key)';

/**
 * Is the `/` at `i` a regex literal rather than a division operator?
 *
 * Deliberately `lib/skim.mjs`'s own heuristic, character for character: this
 * scan runs over skim's OUTPUT, so a disagreement about where a literal starts
 * is a disagreement about text one of the two has already rewritten. `)` and
 * `]` read as division, which misreads the rare `if (x) /re/.test(y)`; that
 * error direction over-reports a site, never hides one.
 * @param {string} s @param {number} i
 * @returns {boolean}
 */
function regexHere(s, i) {
  let j = i - 1;
  while (j >= 0 && /\s/.test(s[j])) j -= 1;
  if (j < 0) return true;
  const c = s[j];
  if (c === ')' || c === ']') return false;
  if (ID.test(c)) {
    let k = j;
    while (k >= 0 && ID.test(s[k])) k -= 1;
    return REGEX_PRECEDING.has(s.slice(k + 1, j + 1));
  }
  return true;
}

/**
 * The index just past the string, template or regex literal starting at `i`, or
 * `-1` when `i` does not start one.
 *
 * A template literal is consumed WHOLE, `${}` included - the same simplification
 * `skim` makes. The cost is a refusal written inside an interpolation, of which
 * this tree has none; the benefit is that no `${`-nesting depth can desynchronise
 * the scan. Every arm is bounded by the string length, so an unterminated
 * literal ends the scan rather than looping.
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
 * The balanced argument span of a call whose `(` sits at `openIdx`.
 * @param {string} s @param {number} openIdx
 * @returns {{end: number, args: string[]}|null} `null` when the `(` never closes
 */
function balancedArgs(s, openIdx) {
  let i = openIdx + 1;
  let depth = 0;
  let start = i;
  /** @type {string[]} */
  const args = [];
  while (i < s.length) {
    const lit = skipLiteral(s, i);
    if (lit >= 0) { i = lit; continue; }
    const c = s[i];
    if (c === '(' || c === '[' || c === '{') { depth += 1; i += 1; continue; }
    if (c === ')' && depth === 0) {
      args.push(s.slice(start, i));
      const trimmed = args.map((a) => a.trim());
      // `f()` splits to one empty argument; every other empty slot is a real
      // elision and is kept, so an argument COUNT stays honest.
      return { end: i, args: trimmed.length === 1 && trimmed[0] === '' ? [] : trimmed };
    }
    if (c === ')' || c === ']' || c === '}') { depth -= 1; i += 1; continue; }
    if (c === ',' && depth === 0) { args.push(s.slice(start, i)); start = i + 1; i += 1; continue; }
    i += 1;
  }
  return null;
}

/**
 * Every `emit`/`out`/`fail` CALL in comment-stripped source, with its balanced
 * argument list. A `function fail(...)` declaration is skipped - it is a
 * signature, not a call - and a name reached through a `.` is somebody else's.
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
 * The value of a single-quoted or double-quoted string literal, or `null` when
 * `text` is not exactly one.
 *
 * A character walk rather than a pattern: the obvious
 * `/^(['"])((?:[^\\]|\\.)*?)\1$/` nests two quantifiers, and this rule reads
 * whatever source it is pointed at, so a long non-matching argument is somebody
 * else's input driving this process's backtracking.
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
  let depth = 0;
  let start = 0;
  let i = 0;
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
  while (i < inner.length) {
    const lit = skipLiteral(inner, i);
    if (lit >= 0) { i = lit; continue; }
    const c = inner[i];
    if (c === '(' || c === '[' || c === '{') { depth += 1; i += 1; continue; }
    if (c === ')' || c === ']' || c === '}') { depth -= 1; i += 1; continue; }
    if (c === ',' && depth === 0) { push(inner.slice(start, i)); start = i + 1; i += 1; continue; }
    i += 1;
  }
  push(inner.slice(start));
  return props;
}

/** The index of a property's own `:`, skipping literals and nesting. */
function topLevelColon(t) {
  let depth = 0;
  let i = 0;
  while (i < t.length) {
    const lit = skipLiteral(t, i);
    if (lit >= 0) { i = lit; continue; }
    const c = t[i];
    if (c === '(' || c === '[' || c === '{') { depth += 1; i += 1; continue; }
    if (c === ')' || c === ']' || c === '}') { depth -= 1; i += 1; continue; }
    if (c === ':' && depth === 0) return i;
    i += 1;
  }
  return -1;
}

/**
 * Walk `cadence-core/bin` for the `.mjs` sources this rule reads.
 * `*.test.mjs` is off the walk - a test may write any shape it likes - and an
 * unreadable directory yields nothing rather than throwing.
 * @param {string} dir
 * @returns {Generator<string>}
 */
function* sourceFiles(dir) {
  let list;
  try {
    list = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const d of list) {
    const f = join(dir, d.name);
    if (d.isDirectory()) { yield* sourceFiles(f); continue; }
    if (!d.isFile()) continue;
    if (!f.endsWith('.mjs') || f.endsWith('.test.mjs')) continue;
    yield f;
  }
}

/** Read one file, or `null` when it is absent, is not a file, or cannot be read. */
function readText(file) {
  try {
    if (!statSync(file).isFile()) return null;
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Every in-scope refusal site under `root`, hinted or not.
 *
 * This is the CENSUS the issue list is built on, and it is exported because
 * phase-1 AC2 asks the phase SUMMARY for two integers - the in-scope site count
 * and the hintless count - and nothing else in the tree can answer the first.
 *
 * @param {string} root
 * @param {typeof REGISTER} [register] the exclusion register; a parameter so a
 *   test can prove the exclusions are READ rather than compiled in (AC6)
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
      // `fail` is a refusal by construction; `emit`/`out` only when the
      // envelope literally says so.
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
        // The conditional-spread spelling `...(hint ? { hint } : {})` carries no
        // top-level `hint` property, so the span is what answers here.
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
 * Every hintless-refusal issue under `root`.
 *
 * `detail` is spelled `line <N>: <token>` and that spelling is PINNED: the
 * phase-1 sweep's verify commands parse the line number back out of it.
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
