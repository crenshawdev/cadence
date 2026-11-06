// @ts-check
// codemap-symbols.mjs - the names a text file declares, read by pattern: pure, a path and its text in, symbols out
// JS and TS run through `skim` first so a name inside a comment isn't one; Rust, Python and Go are line-anchored patterns
// with no comment stripping, and `lib/skim.mjs` is left alone because adding their extensions would change what
// agents' `bin/skim.mjs` accepts, and `skim` mishandled a Rust lifetime
// the text is untrusted and can be 1 MiB: every pattern runs on one line, capped, with no nested quantifier
'use strict';

import { extname } from 'node:path';
import { skim } from './skim.mjs';

// a declaration past this column isn't worth finding, and the cap keeps the line patterns' work per line bounded
const LINE_CAP = 2000;
// one file can't fill the index with names, whatever it repeats
const MAX_SYMBOLS = 500;
const NAME_CAP = 200;

/** @typedef {{name: string, kind: string, line: number, approximate?: true}} Symbol */

const JS_EXT = new Set(['.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx', '.mts', '.cts']);

// [pattern, kind, which group is the name]; each is anchored and has no quantifier nested in another
/** @type {[RegExp, string][]} */
const JS_LINES = [
  [/^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([\w$]+)/, 'function'],
  [/^(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([\w$]+)/, 'class'],
  [/^(?:export\s+)?(?:declare\s+)?(?:const\s+)?(?:enum|interface|type|namespace)\s+([\w$]+)/, 'type'],
  [/^(?:export\s+)?(?:declare\s+)?(?:const|let|var)\s+([\w$]+)/, 'variable'],
  [/^(?:module\.)?exports\.([\w$]+)\s*=/, 'export'],
];
/** @type {[RegExp, string][]} */
const RUST_LINES = [
  [/^\s*(?:pub(?:\([^)]*\))?\s+)?(?:const\s+|async\s+|unsafe\s+)*fn\s+(\w+)/, 'function'],
  [/^(?:pub(?:\([^)]*\))?\s+)?(?:struct|enum|trait|union|mod|type|const|static)\s+(?:mut\s+)?(\w+)/, 'type'],
];
/** @type {[RegExp, string][]} */
const PYTHON_LINES = [
  [/^\s*(?:async\s+)?def\s+(\w+)/, 'function'],
  [/^\s*class\s+(\w+)/, 'class'],
];
/** @type {[RegExp, string][]} */
const GO_LINES = [
  [/^func\s+(?:\([^)]*\)\s*)?(\w+)/, 'function'],
  [/^type\s+(\w+)/, 'type'],
  [/^(?:var|const)\s+(\w+)/, 'variable'],
];

/**
 * @param {string} text @param {[RegExp, string][]} patterns
 * @returns {Symbol[]}
 */
function byLines(text, patterns) {
  /** @type {Symbol[]} */
  const out = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length && out.length < MAX_SYMBOLS; i++) {
    const line = lines[i].length > LINE_CAP ? lines[i].slice(0, LINE_CAP) : lines[i];
    for (const [re, kind] of patterns) {
      const m = re.exec(line);
      if (m) { out.push({ name: m[1], kind, line: i + 1, approximate: true }); break; }
    }
  }
  return out;
}

/**
 * The names an `export { a, b as c }` list holds, which may run over several lines.
 * @param {string} text @returns {Symbol[]}
 */
function exportLists(text) {
  /** @type {Symbol[]} */
  const out = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length && out.length < MAX_SYMBOLS; i++) {
    const open = /^export\s*(?:type\s*)?\{(.*)$/.exec(lines[i].length > LINE_CAP ? lines[i].slice(0, LINE_CAP) : lines[i]);
    if (!open) continue;
    let body = open[1];
    let closed = body.includes('}');
    let j = i;
    // a list that never closes is read for 50 lines at most, and those lines are not read again as openings
    while (!closed && j + 1 < lines.length && j < i + 50) {
      const next = lines[++j].slice(0, LINE_CAP);
      closed = next.includes('}');
      body += `,${next}`;
    }
    for (const part of body.split('}')[0].split(',')) {
      const m = /^\s*(?:type\s+)?(?:[\w$]+\s+as\s+)?([\w$]+)\s*$/.exec(part);
      if (m) out.push({ name: m[1], kind: 'export', line: i + 1, approximate: true });
    }
    i = j;
  }
  return out;
}

/** @param {string} text @returns {Symbol[]} */
function markdown(text) {
  /** @type {Symbol[]} */
  const out = [];
  const lines = text.split('\n');
  let fenced = false;
  for (let i = 0; i < lines.length && out.length < MAX_SYMBOLS; i++) {
    let line = lines[i].length > LINE_CAP ? lines[i].slice(0, LINE_CAP) : lines[i];
    if (line.endsWith('\r')) line = line.slice(0, -1);
    if (/^ {0,3}(?:```|~~~)/.test(line)) { fenced = !fenced; continue; }
    if (fenced) continue;
    const m = /^ {0,3}#{1,6}[ \t]+(\S.*)$/.exec(line);
    if (m) out.push({ name: m[1].replace(/[ \t#]+$/, '').slice(0, NAME_CAP), kind: 'heading', line: i + 1, approximate: true });
  }
  return out;
}

/** @param {string} text @returns {Symbol[]} the top-level keys of a JSON object; nothing when it won't parse */
function jsonKeys(text) {
  try {
    const v = JSON.parse(text);
    if (!v || typeof v !== 'object' || Array.isArray(v)) return [];
    return Object.keys(v).slice(0, MAX_SYMBOLS).map((name) => ({ name: name.slice(0, NAME_CAP), kind: 'key', line: 0 }));
  } catch {
    return [];
  }
}

/**
 * The symbols a text file holds. Anything found by a pattern carries `approximate: true`, which is everything but a
 * JSON key. A file with an extension nobody here reads holds none.
 * @param {string} path @param {string} text
 * @returns {Symbol[]}
 */
export function symbolsFor(path, text) {
  const ext = extname(path).toLowerCase();
  let found;
  if (JS_EXT.has(ext)) {
    // skim's whitespace walks are quadratic on a long run, so a run of 257 or more shrinks to one space; no other
    // character is cut, so a comment delimiter or a closing quote survives and skim's state stays right
    const code = skim(text.replace(/[^\S\n]{257,}/g, ' '));
    found = [...byLines(code, JS_LINES), ...exportLists(code)];
    // one name found twice (`export function f` is a function and a declaration) keeps its first reading
    const seen = new Set();
    found = found.filter((s) => (seen.has(s.name) ? false : seen.add(s.name))).sort((a, b) => a.line - b.line);
  } else if (ext === '.rs') found = byLines(text, RUST_LINES);
  else if (ext === '.py') found = byLines(text, PYTHON_LINES);
  else if (ext === '.go') found = byLines(text, GO_LINES);
  else if (ext === '.md' || ext === '.markdown') found = markdown(text);
  else if (ext === '.json') found = jsonKeys(text);
  else found = [];
  return found.slice(0, MAX_SYMBOLS);
}
