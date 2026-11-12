// @ts-check
// planning-writers.mjs - self-verify's write-module check: a script under cadence-core/bin calls a node:fs write only through lib/planning-store.mjs, or has a row here
// the rule is for scripts (D-22); the model's own documents are written with its Write tool and nothing here reads them
// matched on the call, not the import line: a namespace import, a renamed binding and a re-export all count; a comment or a string does not
// a row says what the file writes and why that is not under .planning, and a row that stops being true is reported, so the register cannot rot
// gaps: a dynamic import('node:fs'), a write function passed along uncalled, and an open with a flag built at run time
// pure: no disk or emit, the caller passes the texts. No CONTRACTS row
'use strict';

/** The write module, root-relative. */
export const WRITE_MODULE = 'cadence-core/bin/lib/planning-store.mjs';

/** The problem codes this rule files. */
export const CODES = Object.freeze({
  // a script calls a node:fs write and is neither the write module nor a register row
  outside: 'fs-write-outside-write-module',
  // a row names a file that is gone, or one that holds no such call any more
  stale: 'fs-write-register-stale',
});

/**
 * The register: every script under cadence-core/bin that writes through node:fs without the write module. path is
 * root-relative POSIX, writes what the file writes in a clause, reason why that is not under .planning.
 * @type {ReadonlyArray<{path: string, writes: string, reason: string}>}
 */
export const FS_WRITE_EXCEPTIONS = Object.freeze([
  Object.freeze({
    path: 'cadence-core/bin/config.mjs',
    writes: 'a throwaway copy of the config layers for a preview, made and removed under the operating system temp directory',
    reason: 'the copy never touches the project tree, and the real config is written through the module',
  }),
  Object.freeze({
    path: 'cadence-core/bin/lib/codemap-launch.mjs',
    writes: 'removes a stale refresh entry or diff from the code-map scratch directory (the writes there go through the module)',
    reason: 'the scratch directory is the run\'s own output directory outside .planning, and the remove is a force-remove that the module\'s unlinkFile, which throws on a missing file, does not do',
  }),
  Object.freeze({
    path: 'cadence-core/bin/lib/workflow-claim.mjs',
    writes: 'the workflow claim file and its temp file in the repository\'s git directory',
    reason: 'a claim is a lock between processes on one run, kept in .git so it is never part of the tree or of planning state',
  }),
]);

/** The node:fs functions that create, replace, append to, link, rename, copy, truncate or remove a path. */
const WRITE_NAMES = new Set([
  'writeFile', 'writeFileSync', 'appendFile', 'appendFileSync', 'mkdir', 'mkdirSync', 'mkdtemp', 'mkdtempSync',
  'rename', 'renameSync', 'copyFile', 'copyFileSync', 'cp', 'cpSync', 'rm', 'rmSync', 'rmdir', 'rmdirSync',
  'unlink', 'unlinkSync', 'link', 'linkSync', 'symlink', 'symlinkSync', 'truncate', 'truncateSync',
  'createWriteStream', 'open', 'openSync',
  // the disposable temp directories and the write-stream constructors (a `new` in front still matches the call)
  'mkdtempDisposable', 'mkdtempDisposableSync', 'WriteStream', 'FileWriteStream', 'Utf8Stream',
]);
/** open creates only under a write flag, so it counts only when one is spelled next to the call. */
const OPEN_NAMES = new Set(['open', 'openSync']);
const WRITE_FLAG = /['"`](?:[wa]x?\+?|r\+)['"`]/;
const FS_SPECIFIER = /^(?:node:)?fs(?:\/promises)?$/;

/**
 * The source with comments blanked and every string, template text and regex body replaced by spaces, the
 * delimiters and the line breaks kept, so an offset or a line number in the result is one in the source.
 * A regex literal is told from a division by the token before it, which is enough for this tree.
 * @param {string} src
 * @returns {string}
 */
export function blank(src) {
  const n = src.length;
  const out = src.split('');
  const wipe = (/** @type {number} */ a, /** @type {number} */ b) => {
    for (let k = a; k < b; k++) if (out[k] !== '\n') out[k] = ' ';
  };
  /** @type {number[]} */
  const tpl = [];
  let depth = 0;
  // scans template text from `from` to the closing backtick or to a `${`, and returns where code resumes
  const template = (/** @type {number} */ from) => {
    let j = from;
    while (j < n) {
      if (src[j] === '\\') { wipe(j, j + 2); j += 2; continue; }
      if (src[j] === '`') return j + 1;
      if (src[j] === '$' && src[j + 1] === '{') { tpl.push(depth); depth++; return j + 2; }
      wipe(j, j + 1);
      j++;
    }
    return j;
  };
  let prev = '';
  let i = 0;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') {
      const j = src.indexOf('\n', i);
      const end = j < 0 ? n : j;
      wipe(i, end);
      i = end;
      continue;
    }
    if (c === '/' && d === '*') {
      const j = src.indexOf('*/', i + 2);
      const end = j < 0 ? n : j + 2;
      wipe(i, end);
      i = end;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
      wipe(i + 1, j);
      i = j + 1;
      prev = c;
      continue;
    }
    if (c === '`') {
      i = template(i + 1);
      prev = '`';
      continue;
    }
    if (c === '/') {
      const before = src.slice(0, i).trimEnd();
      const regexAhead = prev === '' || '(,=:[!&|?{};+-*%<>~^'.includes(prev)
        || /\b(?:return|typeof|case|throw|in|of|yield|await|void|delete)$/.test(before);
      if (regexAhead) {
        let j = i + 1;
        let inClass = false;
        while (j < n && src[j] !== '\n' && (inClass || src[j] !== '/')) {
          if (src[j] === '\\') j++;
          else if (src[j] === '[') inClass = true;
          else if (src[j] === ']') inClass = false;
          j++;
        }
        wipe(i + 1, j);
        i = j + 1;
        prev = '/';
        continue;
      }
    }
    if (c === '{') depth++;
    if (c === '}') {
      depth--;
      if (tpl.length && tpl[tpl.length - 1] === depth) {
        tpl.pop();
        i = template(i + 1);
        continue;
      }
    }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out.join('');
}

/** @param {string} s */
const esc = (s) => s.replace(/[$]/g, '\\$&');

/**
 * What a node:fs import or re-export binds: local names standing for a write function, and namespace names.
 * @param {string} clause
 * @param {Map<string, string>} names local name -> fs function
 * @param {Set<string>} spaces
 */
function bind(clause, names, spaces) {
  const brace = clause.match(/\{([^}]*)\}/);
  if (brace) {
    for (const part of brace[1].split(',')) {
      const m = part.trim().match(/^([\w$]+)(?:\s+as\s+([\w$]+))?$/);
      if (!m) continue;
      if (m[1] === 'promises') spaces.add(m[2] || m[1]);
      else if (WRITE_NAMES.has(m[1])) names.set(m[2] || m[1], m[1]);
    }
  }
  const rest = clause.replace(/\{[^}]*\}/, '');
  const star = rest.match(/\*\s*as\s+([\w$]+)/);
  if (star) spaces.add(star[1]);
  else {
    const def = rest.match(/^\s*([\w$]+)\s*,?\s*$/);
    if (def) spaces.add(def[1]);
  }
}

/**
 * Every node:fs write call in one file: the function and its 1-based line.
 * A re-export of a write function, or `export *` from node:fs, is reported under the same shape.
 * @param {string} text
 * @returns {{name: string, line: number}[]}
 */
export function fsWriteCalls(text) {
  const code = blank(text);
  const lineAt = (/** @type {number} */ at) => code.slice(0, at).split('\n').length;
  /** @type {Map<string, string>} */
  const names = new Map();
  /** @type {Set<string>} */
  const spaces = new Set();
  /** @type {{name: string, line: number}[]} */
  const found = [];
  // the specifier's text is blanked in `code`, the delimiters are not, so it is read from the source at the same offsets
  const specAfter = (/** @type {number} */ end) => {
    const q = code[end - 1];
    const close = code.indexOf(q, end);
    return close < 0 ? '' : text.slice(end, close);
  };
  for (const m of code.matchAll(/\bimport\s+([^'"`;]*?)\s*from\s*['"]/g)) {
    const end = /** @type {number} */ (m.index) + m[0].length;
    if (FS_SPECIFIER.test(specAfter(end))) bind(m[1], names, spaces);
  }
  for (const m of code.matchAll(/\bexport\s*(\*|\{[^}]*\})\s*(?:as\s+[\w$]+\s*)?from\s*['"]/g)) {
    const at = /** @type {number} */ (m.index);
    if (!FS_SPECIFIER.test(specAfter(at + m[0].length))) continue;
    if (m[1] === '*') { found.push({ name: '*', line: lineAt(at) }); continue; }
    for (const part of m[1].slice(1, -1).split(',')) {
      const orig = part.trim().split(/\s+/)[0];
      if (WRITE_NAMES.has(orig)) found.push({ name: orig, line: lineAt(at) });
    }
  }
  const flagged = (/** @type {string} */ fn, /** @type {number} */ from) =>
    !OPEN_NAMES.has(fn) || WRITE_FLAG.test(text.slice(from, text.indexOf(')', from) + 1));
  for (const [local, fn] of names) {
    for (const m of code.matchAll(new RegExp(`(?<![\\w$.])${esc(local)}\\s*\\(`, 'g'))) {
      const at = /** @type {number} */ (m.index);
      if (flagged(fn, at + m[0].length)) found.push({ name: fn, line: lineAt(at) });
    }
  }
  for (const ns of spaces) {
    for (const m of code.matchAll(new RegExp(`(?<![\\w$.])${esc(ns)}(?:\\s*\\.\\s*promises)?\\s*\\.\\s*([\\w$]+)\\s*\\(`, 'g'))) {
      const fn = m[1];
      const at = /** @type {number} */ (m.index);
      if (WRITE_NAMES.has(fn) && flagged(fn, at + m[0].length)) found.push({ name: fn, line: lineAt(at) });
    }
  }
  return found.sort((a, b) => a.line - b.line);
}

/**
 * Every write-module issue across the scripts under cadence-core/bin.
 *
 * @param {ReadonlyArray<{file: string, text: string | null}>} files root-relative POSIX path and contents; null when the file was unreadable, which is reported elsewhere and gets no verdict here
 * @param {boolean} fullTree a full install: a register row whose file is absent is then a problem
 * @param {ReadonlyArray<{path: string, writes: string, reason: string}>} [rows]
 * @returns {{kind: string, file: string, detail: string}[]}
 */
export function writeModuleIssues(files, fullTree, rows = FS_WRITE_EXCEPTIONS) {
  const issues = [];
  const registered = new Set(rows.map((r) => r.path));
  const seen = new Set();
  for (const { file, text } of files) {
    seen.add(file);
    if (file === WRITE_MODULE || text === null) continue;
    const calls = fsWriteCalls(text);
    if (registered.has(file)) {
      if (!calls.length) {
        issues.push({
          kind: CODES.stale,
          file,
          detail: 'registered in lib/planning-writers.mjs as a node:fs writer and no longer calls one - delete the row',
        });
      }
      continue;
    }
    if (!calls.length) continue;
    const first = calls[0];
    issues.push({
      kind: CODES.outside,
      file,
      detail: `calls node:fs \`${first.name}\` at line ${first.line}${calls.length > 1 ? ` and ${calls.length - 1} more` : ''}, and only ${WRITE_MODULE} writes under .planning - go through that module, or add a row to lib/planning-writers.mjs saying what the file writes and why that is not under .planning`,
    });
  }
  if (fullTree) {
    for (const r of rows) {
      if (seen.has(r.path)) continue;
      issues.push({
        kind: CODES.stale,
        file: r.path,
        detail: 'registered in lib/planning-writers.mjs as a node:fs writer and the file is not there - delete the row',
      });
    }
  }
  return issues;
}
