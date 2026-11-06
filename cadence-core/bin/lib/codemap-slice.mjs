// @ts-check
// codemap-slice.mjs - `codemap slice`'s answer: the rows asked for, shed to fit D-20's bound, in a deterministic order
// pure, no I/O and no imports: the index's rows, each module's state and entry, and the selectors go in, the answer's body comes out
// the bound is bytes of the whole printed line (`{"ok":true,...}` and its newline), never characters, because a path can be anything
'use strict';

// D-20: an inline answer at or under this many bytes, whole
export const LIMIT = 10000;
// the names of the entries left out are listed this far, then counted: a broad term must not fill the answer with a list of omissions
const OMITTED_CAP = 20;

/** @typedef {{path: string, quoted?: true, kind: string, hash: string|null, bytes: number|null, symbols?: any[], imports?: any, pinned_by?: any}} Row */

const bytesOf = (/** @type {any} */ v) => Buffer.byteLength(JSON.stringify(v));

/**
 * A row as the answer carries it: the file's facts, its module, and a stale mark when its module is stale.
 * @param {Row} r @param {string|undefined} module @param {boolean} stale
 */
function shape(r, module, stale) {
  const { path, quoted, kind, hash, bytes, symbols, imports, pinned_by: pinnedBy } = r;
  return {
    path, ...(quoted ? { quoted } : {}), kind, hash, bytes, ...(module !== undefined ? { module } : {}), ...(stale ? { stale: true } : {}),
    ...(symbols ? { symbols } : {}), ...(imports ? { imports } : {}), ...(pinnedBy ? { pinned_by: pinnedBy } : {}),
  };
}

/** @param {any} row the row without its callers */
const noCallers = (row) => (row.symbols ? { ...row, symbols: row.symbols.map((/** @type {any} */ { callers, ...s }) => s) } : row);
/** @param {any} row the row with no edge left: no callers, imports or pinned_by, on the file or on a symbol */
function noEdges(row) {
  const { imports, pinned_by: pinnedBy, symbols, ...rest } = row;
  return symbols ? { ...rest, symbols: symbols.map((/** @type {any} */ { callers, pinned_by: p, ...s }) => s) } : rest;
}
/** @param {any} row @param {string} key */
const has = (row, key) => key in row;
const hasCallers = (/** @type {any} */ row) => (row.symbols || []).some((/** @type {any} */ s) => 'callers' in s);
const hasEdges = (/** @type {any} */ row) => has(row, 'imports') || has(row, 'pinned_by')
  || (row.symbols || []).some((/** @type {any} */ s) => 'callers' in s || 'pinned_by' in s);

/**
 * @param {object} input
 * @param {Row[]} input.rows every row of the index, in path order
 * @param {{name: string, paths: string[]}[]} input.modules the index's module list
 * @param {Map<string, string>} input.states a module name to built, stale, unbuilt or no_reader
 * @param {Map<string, any>} input.entries a module name to its parsed entry, for the modules that have one
 * @param {{files: string[], symbols: string[], terms: string[]}} input.select
 * @param {(module: string) => string} input.entryPath the root-relative file an entry lives in
 * @returns {Record<string, any>} the answer's body; the caller puts `ok:true` in front of it
 */
export function slice({ rows, modules, states, entries, select, entryPath }) {
  /** @type {Map<string, string>} */
  const moduleOf = new Map();
  for (const m of modules) for (const p of m.paths) moduleOf.set(p, m.name);
  const files = new Set(select.files);
  const symbols = new Set(select.symbols);
  const terms = select.terms.map((t) => t.toLowerCase());
  // an entry minus the hashes it was built from: they're the stale check's, and a planner has no use for 40-character strings
  /** @type {Map<string, any>} */
  const shown = new Map();
  /** @type {Map<string, string>} */
  const entryText = new Map();
  for (const [name, entry] of entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const { built_from: _builtFrom, ...rest } = entry;
    shown.set(name, rest);
    if (terms.length) entryText.set(name, JSON.stringify(rest).toLowerCase());
  }

  const matched = rows.filter((r) => {
    if (files.has(r.path)) return true;
    if (symbols.size && (r.symbols || []).some((s) => symbols.has(s.name))) return true;
    if (!terms.length) return false;
    const path = r.path.toLowerCase();
    const names = (r.symbols || []).map((s) => String(s.name).toLowerCase());
    const text = entryText.get(moduleOf.get(r.path) ?? '') ?? '';
    return terms.some((t) => path.includes(t) || names.some((n) => n.includes(t)) || text.includes(t));
  });
  const total = matched.length;

  /** @type {any[]} */
  let out = matched.map((r) => shape(r, moduleOf.get(r.path), states.get(moduleOf.get(r.path) ?? '') === 'stale'));
  const rowBytes = out.map(bytesOf);
  // the entries of the matched modules, in module order
  const names = [...new Set(matched.map((r) => moduleOf.get(r.path)).filter((n) => n !== undefined && shown.has(n)))].sort();
  const entryBytes = new Map(names.map((n) => [n, bytesOf(n) + 1 + bytesOf(shown.get(n))]));
  /** @type {Set<string>} */
  let omitted = new Set();
  let truncated = false;

  const head = () => {
    const kept = names.filter((n) => !omitted.has(n));
    const listed = names.filter((n) => omitted.has(n)).slice(0, OMITTED_CAP);
    return {
      action: 'slice', total, truncated, rows: [],
      ...(kept.length ? { entries: {} } : {}),
      ...(omitted.size ? { entries_omitted: listed.map((module) => ({ module, file: entryPath(module) })),
        ...(omitted.size > OMITTED_CAP ? { entries_omitted_more: omitted.size - OMITTED_CAP } : {}) } : {}),
    };
  };
  // exact: the head with its empty rows and entries measured as printed, then what fills them and the commas between
  const size = () => {
    const kept = names.filter((n) => !omitted.has(n));
    const rowsSize = rowBytes.reduce((a, b) => a + b, 0) + Math.max(0, rowBytes.length - 1);
    const entriesSize = kept.reduce((a, n) => a + /** @type {number} */ (entryBytes.get(n)), 0) + Math.max(0, kept.length - 1);
    return bytesOf({ ok: true, ...head() }) + 1 + rowsSize + entriesSize;
  };
  const fits = () => size() <= LIMIT;

  // the cheapest loss first: every row's callers, then its other edges, then its symbols, the largest row each time
  /** @param {(row: any) => boolean} eligible @param {(row: any) => any} strip */
  const shed = (eligible, strip) => {
    while (!fits()) {
      let best = -1;
      out.forEach((row, i) => { if (eligible(row) && (best < 0 || rowBytes[i] > rowBytes[best])) best = i; });
      if (best < 0) return;
      out[best] = strip(out[best]);
      rowBytes[best] = bytesOf(out[best]);
      truncated = true;
    }
  };
  shed(hasCallers, noCallers);
  shed(hasEdges, noEdges);
  // a row's symbols go from the end until the answer fits, so it keeps those that do
  while (!fits()) {
    let best = -1;
    out.forEach((row, i) => { if (row.symbols?.length && (best < 0 || rowBytes[i] > rowBytes[best])) best = i; });
    if (best < 0) break;
    truncated = true;
    const row = { ...out[best], symbols: [...out[best].symbols] };
    while (row.symbols.length && !fits()) {
      row.symbols.pop();
      out[best] = row;
      rowBytes[best] = bytesOf(row);
    }
    if (!row.symbols.length) { const { symbols: _s, ...bare } = row; out[best] = bare; rowBytes[best] = bytesOf(bare); }
  }
  // the rows are as bare as they get: an entry that doesn't fit in what's left is left out whole, never cut
  if (!fits()) {
    truncated = true;
    omitted = new Set(names);
    for (const n of names) {
      omitted.delete(n);
      if (!fits()) omitted.add(n);
    }
  }
  // and only then do whole rows go, from the end
  while (!fits() && out.length) {
    truncated = true;
    out.pop();
    rowBytes.pop();
  }

  const kept = names.filter((n) => !omitted.has(n));
  return {
    ...head(), truncated, rows: out,
    ...(kept.length ? { entries: Object.fromEntries(kept.map((n) => [n, shown.get(n)])) } : {}),
  };
}
