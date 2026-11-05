// @ts-check
// strips comments and keeps the line numbers: newlines stay, so line N of the output is line N of the file
// that's what makes the two-step read work: skim to orient, then Read the range. Collapsing blank lines would break it
// it never deletes a comment on disk, the prose is the design record
// ambiguity falls toward keeping bytes (an unterminated block comment, a `//` inside a template's `${}`, an unknown
// extension): a kept comment costs tokens, a dropped line of real code hands an agent source that doesn't parse
'use strict';

/**
 * Comment syntax by extension. An extension absent from this map is refused
 * and not guessed at, because guessing wrong deletes code.
 */
export const SYNTAX = {
  '.mjs': 'c', '.cjs': 'c', '.js': 'c', '.jsx': 'c',
  '.ts': 'c', '.tsx': 'c', '.mts': 'c', '.cts': 'c',
  '.json': null, // comments are not legal; nothing to strip
};

/** Words after which a `/` opens a regex literal rather than dividing. */
const REGEX_PRECEDING = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
  'throw', 'case', 'do', 'else', 'yield', 'await',
]);

/**
 * Is the `/` at `i` a regex literal and not a division? Looks at the last
 * significant character. `)` and `]` count as division, which misreads the rare
 * `if (x) /re/.test(y)`, but that errs toward keeping a comment, never eating
 * code.
 * @param {string} s @param {number} i
 */
export function regexHere(s, i) {
  let j = i - 1;
  while (j >= 0 && /\s/.test(s[j])) j--;
  if (j < 0) return true;
  const c = s[j];
  if (/[)\]]/.test(c)) return false;
  if (/[A-Za-z0-9_$]/.test(c)) {
    let k = j;
    while (k >= 0 && /[A-Za-z0-9_$]/.test(s[k])) k--;
    return REGEX_PRECEDING.has(s.slice(k + 1, j + 1));
  }
  return true;
}

/**
 * Strip comments from C-family source, preserving every newline.
 *
 * @param {string} source
 * @returns {string} same line count as the input
 */
export function skim(source) {
  let out = '';
  let i = 0;
  const n = source.length;

  // a shebang is the file's first instruction, not a comment
  if (source.startsWith('#!')) {
    const e = source.indexOf('\n');
    if (e < 0) return source;
    out = source.slice(0, e);
    i = e;
  }

  while (i < n) {
    const c = source[i];
    const d = source[i + 1];

    if (c === '"' || c === "'" || c === '`') {
      // templates are consumed whole, `${}` included, so a `//` inside an interpolation survives rather than break code
      const q = c;
      out += c;
      i++;
      while (i < n) {
        if (source[i] === '\\') { out += source.slice(i, i + 2); i += 2; continue; }
        out += source[i];
        if (source[i] === q) { i++; break; }
        i++;
      }
      continue;
    }

    if (c === '/' && d === '*') {
      const e = source.indexOf('*/', i + 2);
      if (e < 0) { out += source.slice(i); break; } // unterminated: keep it all
      out += source.slice(i, e + 2).replace(/[^\n]/g, '');
      i = e + 2;
      continue;
    }

    if (c === '/' && d === '/') {
      const e = source.indexOf('\n', i);
      i = e < 0 ? n : e;
      continue;
    }

    if (c === '/' && regexHere(source, i)) {
      out += c;
      i++;
      let cls = false;
      while (i < n) {
        const r = source[i];
        if (r === '\\') { out += source.slice(i, i + 2); i += 2; continue; }
        if (r === '\n') break; // unterminated regex; bail rather than run on
        out += r;
        i++;
        if (r === '[') cls = true;
        else if (r === ']') cls = false;
        else if (r === '/' && !cls) break;
      }
      continue;
    }

    out += c;
    i++;
  }

  // trailing whitespace left by a stripped end-of-line comment
  return out.split('\n').map((l) => l.replace(/\s+$/, '')).join('\n');
}

/**
 * @param {string} source @param {string} skimmed
 * @returns {{bytes_in:number,bytes_out:number,saved:number,pct:number,lines:number,lines_match:boolean}}
 */
export function skimStats(source, skimmed) {
  const li = source.split('\n').length;
  const lo = skimmed.split('\n').length;
  return {
    bytes_in: source.length,
    bytes_out: skimmed.length,
    saved: source.length - skimmed.length,
    pct: source.length ? Math.round((1 - skimmed.length / source.length) * 1000) / 10 : 0,
    lines: li,
    lines_match: li === lo,
  };
}
