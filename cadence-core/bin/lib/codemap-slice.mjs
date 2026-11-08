// @ts-check
// codemap-slice.mjs - `codemap slice`'s answer: the rows asked for, shed to fit D-20's bound, in a deterministic order
// pure, no I/O and no imports: the index's rows, each module's state and entry, and the selectors go in, the answer's body comes out
// the bound is bytes of the whole printed line (`{"ok":true,...}` and its newline), never characters, because a path can be anything
'use strict';

// D-20: an inline answer at or under this many bytes, whole
export const LIMIT = 10000;
// the names of the entries left out are listed while there are under this many and the list is under the byte budget, then
// counted: a name can be hundreds of bytes, and a broad term must not fill the answer with a list of omissions
const OMITTED_CAP = 20;
const OMITTED_BYTES = 4000;
// the least an item can cost, so a list with less than this left can stop looking: the rest are counted, same answer
const MIN_ITEM = Buffer.byteLength(JSON.stringify({ module: '', file: '' })) + 1;

/** @typedef {{path: string, quoted?: true, kind: string, hash: string|null, bytes: number|null, symbols?: any[], imports?: any, pinned_by?: any}} Row */

const bytesOf = (/** @type {any} */ v) => Buffer.byteLength(JSON.stringify(v));

/**
 * A row as the answer carries it: the file's facts, its module, and a stale mark when its module is stale or the file
 * is no longer tracked. `bare` leaves out the symbols and edges, the form a row can always be shed to.
 * @param {Row} r @param {string|undefined} module @param {boolean} stale @param {boolean} [bare]
 */
function shape(r, module, stale, bare = false) {
  const { path, quoted, kind, hash, bytes, symbols, imports, pinned_by: pinnedBy } = r;
  return {
    path, ...(quoted ? { quoted } : {}), kind, hash, bytes, ...(module !== undefined ? { module } : {}), ...(stale ? { stale: true } : {}),
    ...(symbols && !bare ? { symbols } : {}), ...(imports && !bare ? { imports } : {}), ...(pinnedBy && !bare ? { pinned_by: pinnedBy } : {}),
  };
}

/**
 * What `--terms` searches in an entry: its string values lowercased and joined by newlines, never its field names or
 * its JSON encoding. Walked with a stack, because the entry comes from a file a clone can supply and may nest deep.
 * @param {unknown} entry @returns {string}
 */
function textOf(entry) {
  /** @type {string[]} */
  const out = [];
  const stack = [entry];
  while (stack.length) {
    const v = stack.pop();
    if (typeof v === 'string') out.push(v);
    else if (v && typeof v === 'object') {
      const kids = Array.isArray(v) ? v : Object.values(v);
      for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
    }
  }
  return out.join('\n').toLowerCase();
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
 * @param {Set<string>} input.current the paths the repository tracks now: a row outside it is stale whatever its module says
 * @param {{edges_shed?: true, symbols_shed?: true}} [input.marks] what the scan left out of the index, copied into the answer
 * @param {number} [input.limit] the answer's byte bound, LIMIT unless a caller wants less; `codemap slice` never passes one
 * @returns {Record<string, any>} the answer's body; the caller puts `ok:true` in front of it
 */
export function slice({ rows, modules, states, entries, select, entryPath, current, marks = {}, limit = LIMIT }) {
  // the omitted-entry list scales down with a smaller limit, or that list alone could overrun it; at LIMIT it's OMITTED_BYTES exactly
  const omittedBytes = Math.min(OMITTED_BYTES, Math.floor(limit * OMITTED_BYTES / LIMIT));
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
    if (terms.length) entryText.set(name, textOf(rest));
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
  const markHead = { ...(marks.edges_shed === true ? { edges_shed: true } : {}), ...(marks.symbols_shed === true ? { symbols_shed: true } : {}) };

  // the working rows: every matched row until even the bare forms stop fitting. Whole rows drop from the end, so a row
  // past that point never survives, and building it would cost time for nothing. The floor leaves out any entry
  const floor = bytesOf({ ok: true, action: 'slice', total, truncated: true, rows: [], ...markHead }) + 1;
  /** @type {any[]} */
  const out = [];
  /** @type {number[]} */
  const rowBytes = [];
  let rowSum = 0;
  let bareSum = 0;
  let truncated = false;
  for (const r of matched) {
    const module = moduleOf.get(r.path);
    const stale = states.get(module ?? '') === 'stale' || !current.has(r.path);
    bareSum += bytesOf(shape(r, module, stale, true)) + (out.length ? 1 : 0);
    if (floor + bareSum > limit) { truncated = true; break; }
    const row = shape(r, module, stale);
    out.push(row);
    rowBytes.push(bytesOf(row));
    rowSum += rowBytes[rowBytes.length - 1];
  }
  // the entries of the matched modules, in module order
  const names = [...new Set(matched.map((r) => moduleOf.get(r.path)).filter((n) => n !== undefined && shown.has(n)))].sort();
  const entryBytes = new Map(names.map((n) => [n, bytesOf(n) + 1 + bytesOf(shown.get(n))]));
  /** @type {Set<string>} */
  let omitted = new Set();

  // the entries left out: listed while under the cap and the byte budget, in module order, and every other one counted
  const head = () => {
    /** @type {{module: string, file: string}[]} */
    const listed = [];
    let used = 0;
    let more = 0;
    let seen = 0;
    for (const module of names) {
      // past the cap nothing more is built: the rest of the omitted are counted without a look
      if (listed.length >= OMITTED_CAP || omittedBytes - used < MIN_ITEM) break;
      if (!omitted.has(module)) continue;
      seen++;
      const item = { module, file: entryPath(module) };
      const b = bytesOf(item) + 1;
      if (used + b <= omittedBytes) { listed.push(item); used += b; } else more++;
    }
    more += omitted.size - seen;
    return {
      action: 'slice', total, truncated, rows: [], ...markHead,
      ...(names.length > omitted.size ? { entries: {} } : {}),
      ...(omitted.size ? { entries_omitted: listed, ...(more ? { entries_omitted_more: more } : {}) } : {}),
    };
  };
  // exact: the head with its empty rows and entries measured as printed, then what fills them and the commas between.
  // It changes only when `truncated` or `omitted` does, so it's held and refreshed there; the rows' sum is kept running
  let fixed = 0;
  const refresh = () => {
    const kept = names.filter((n) => !omitted.has(n));
    fixed = bytesOf({ ok: true, ...head() }) + 1 + kept.reduce((a, n) => a + /** @type {number} */ (entryBytes.get(n)), 0) + Math.max(0, kept.length - 1);
  };
  const size = () => fixed + rowSum + Math.max(0, out.length - 1);
  const fits = () => size() <= limit;
  refresh();

  /** @param {number} i @param {any} row */
  const put = (i, row) => {
    out[i] = row;
    const b = bytesOf(row);
    rowSum += b - rowBytes[i];
    rowBytes[i] = b;
  };
  // any shedding sets `truncated`, which is in the head, so the head is measured again at the first
  const mark = () => { if (!truncated) { truncated = true; refresh(); } };

  // the cheapest loss first: every row's callers, then its other edges, then its symbols, the largest row each time
  /** @param {(row: any) => boolean} eligible @param {(row: any) => any} strip */
  const shed = (eligible, strip) => {
    while (!fits()) {
      let best = -1;
      out.forEach((row, i) => { if (eligible(row) && (best < 0 || rowBytes[i] > rowBytes[best])) best = i; });
      if (best < 0) return;
      mark();
      put(best, strip(out[best]));
    }
  };
  shed(hasCallers, noCallers);
  shed(hasEdges, noEdges);
  // a row's symbols go from the end until the answer fits, so it keeps those that do
  while (!fits()) {
    let best = -1;
    out.forEach((row, i) => { if (row.symbols?.length && (best < 0 || rowBytes[i] > rowBytes[best])) best = i; });
    if (best < 0) break;
    mark();
    const row = { ...out[best], symbols: [...out[best].symbols] };
    while (row.symbols.length && !fits()) {
      row.symbols.pop();
      put(best, row);
    }
    if (!row.symbols.length) { const { symbols: _s, ...bare } = row; put(best, bare); }
  }
  // the rows are as bare as they get: an entry that doesn't fit in what's left is left out whole, never cut
  if (!fits()) {
    mark();
    omitted = new Set(names);
    refresh();
    for (const n of names) {
      omitted.delete(n);
      refresh();
      if (!fits()) omitted.add(n);
    }
    refresh();
  }
  // and only then do whole rows go, from the end
  if (!fits() && out.length) {
    mark();
    while (!fits() && out.length) {
      rowSum -= /** @type {number} */ (rowBytes.pop());
      out.pop();
    }
  }

  const kept = names.filter((n) => !omitted.has(n));
  return {
    ...head(), truncated, rows: out,
    ...(kept.length ? { entries: Object.fromEntries(kept.map((n) => [n, shown.get(n)])) } : {}),
  };
}
