// @ts-check
// merge-warnings.mjs - the pure rule behind self-verify's `undocumented-merge-warnings` check
// a seam calling mergeLayers must bind the returned `warnings[]` or say in its header why its envelope surfaces them
// callsites that dropped the torn-config diagnostic ran branch rails on defaults in silence
// (a) the destructuring binds `warnings`; (b) the header carries a `mergeLayers warnings[]:` line and the reason
// the rule is lexical: a string holding mergeLayers and its open paren reads as a callsite, so write it without parens
// pure, no fs or emit; the caller owns the envelope
'use strict';

/** The one problem code this rule files. */
export const CODE = 'undocumented-merge-warnings';

// A call, not a mention: the identifier followed by its opening paren.
const CALL_RE = /\bmergeLayers\s*\(/g;

// lines that carry the identifier without calling it. The import spelling has no paren, but excluding it explicitly
// keeps a future dynamic import from reading as a callsite, and the definition is excluded the same way
const IMPORT_RE = /^\s*(?:import|export)\b[^(]*\bfrom\b/;
const DEFINITION_RE = /\bfunction\s+mergeLayers\s*\(/;
const COMMENT_RE = /^\s*(?:\/\/|\*|\/\*)/;

// tested against the text just before the call, so a binding wrapped across lines still
// matches. Bounded, because an unbounded look-back would scan the whole file per callsite
const BINDING_WINDOW = 240;
const BINDING_RE = /const\s*\{([^{}]*)\}\s*=\s*$/;
const WARNINGS_RE = /\bwarnings\b/;

// The arm (b) marker, in a `//` or a `*` comment line.
const MARKER_RE = /^\s*(?:\/\/+|\*)\s*mergeLayers warnings\[\]:(.*)$/;

/**
 * The file's leading comment header: lines from the top that are
 * blank, a shebang or a comment, ending at the first code line.
 * A marker written beside a callsite in the body doesn't satisfy arm (b).
 * @param {string[]} lines
 * @returns {string[]}
 */
function headerLines(lines) {
  const out = [];
  for (const line of lines) {
    const t = line.trim();
    if (t === '' || t.startsWith('#!') || COMMENT_RE.test(line)) {
      out.push(line);
      continue;
    }
    break;
  }
  return out;
}

/**
 * Whether the header states the arm (b) reason: a marker line plus prose after it, on
 * that line or the comment lines that follow. A bare marker says nothing.
 * @param {string[]} lines
 * @returns {boolean}
 */
function headerDocuments(lines) {
  const header = headerLines(lines);
  for (let i = 0; i < header.length; i += 1) {
    const m = MARKER_RE.exec(header[i]);
    if (!m) continue;
    let prose = m[1] || '';
    for (let j = i + 1; j < header.length && !prose.trim(); j += 1) {
      const rest = header[j].replace(/^\s*(?:\/\/+|\*)/, '');
      if (!rest.trim()) break; // a blank comment line ends the paragraph
      prose = rest;
    }
    if (prose.trim()) return true;
  }
  return false;
}

/**
 * Every mergeLayers callsite in text that satisfies neither arm, with the 1-based line it sits on.
 * A non-string input yields [], because self-verify hands this whatever
 * the tree holds and a throw would take the whole run with it.
 * @param {any} text
 * @returns {{code: string, detail: string}[]}
 */
export function mergeWarningIssues(text) {
  if (typeof text !== 'string' || !text) return [];
  const lines = text.split('\n');
  const documented = headerDocuments(lines);
  const issues = [];
  CALL_RE.lastIndex = 0;
  for (const m of text.matchAll(CALL_RE)) {
    const idx = m.index || 0;
    const lineNo = text.slice(0, idx).split('\n').length;
    const line = lines[lineNo - 1] || '';
    if (COMMENT_RE.test(line) || IMPORT_RE.test(line) || DEFINITION_RE.test(line)) continue;
    if (documented) continue;
    const before = text.slice(Math.max(0, idx - BINDING_WINDOW), idx);
    const bind = BINDING_RE.exec(before);
    if (bind && WARNINGS_RE.test(bind[1])) continue;
    issues.push({
      code: CODE,
      detail: `line ${lineNo} calls \`mergeLayers\` without binding \`warnings\`, and this `
        + 'file\'s header carries no `mergeLayers warnings[]:` sentence saying why its '
        + 'envelope is the surfacing - a torn config layer would decide here in silence',
    });
  }
  return issues;
}
