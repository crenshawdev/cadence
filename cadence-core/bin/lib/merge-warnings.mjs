// @ts-check
// merge-warnings.mjs - the pure rule behind self-verify's
// `undocumented-merge-warnings` check (D-09): a seam that calls `mergeLayers`
// must either SURFACE the `warnings[]` it gets back or state in its file header
// why its envelope is the surfacing. The disk half - walking
// `cadence-core/bin/**` and filing each issue as a CI problem - lives in
// self-verify.mjs, the same split lib/route-relay.mjs, lib/dispatch-phrasing.mjs
// and lib/config-reach.mjs use.
//
// Why it exists: `mergeLayers` already computes the one diagnostic that says a
// config layer was torn, and eight of the ten callsites this repo shipped
// destructured `{ config }` alone and dropped it on the floor. A torn
// `.planning/config.json` therefore decided branch rails, cleanup rails and
// recall from DEFAULTS in silence. Ten hand-written file-header sentences would
// close today's ten and leave the ELEVENTH callsite's author under no
// obligation at all - which is exactly the reasoning lib/route-relay.mjs states
// for its own check: "Another prose instruction alone was rejected for exactly
// that reason; a check is what makes the instruction's ABSENCE visible."
//
// The contract, in two arms. A CALLSITE is satisfied by either:
//
//   (a) ITS OWN destructuring binds `warnings` - the `const { ..., warnings } =
//       mergeLayers(` form. That is "surfaces the warning in its envelope" made
//       checkable: a name that is bound is a name the reader can see used or
//       not used two lines down, where a dropped field is invisible.
//   (b) the FILE HEADER carries a marker line `mergeLayers warnings[]:`
//       followed by prose saying why the envelope is the surfacing. File-level,
//       not per callsite: the reason is a property of what the file emits, and
//       repeating it per call would be the per-dispatch repetition
//       lib/route-relay.mjs also declined.
//
// Accepted costs, stated so nobody reads the check as covering what it does
// not. Arm (a) proves the value is BOUND, never that it is emitted - a callsite
// could bind `warnings` and still ignore it, and no static rule short of
// dataflow can tell those apart. Arm (b) satisfies every callsite in the file
// at once, so a file that has earned its header sentence can gain a new
// unsurfaced callsite silently; that is the price of not demanding the same
// sentence N times. Both arms are cheap to satisfy honestly and neither can be
// satisfied by accident.
//
// The rule is LEXICAL, so `mergeLayers(` inside a STRING LITERAL reads as a
// callsite; comment lines are skipped but strings cannot be. Observed on this
// file's first run, against this file: the diagnostic below used to spell the
// identifier with its parens and the rule reported ITSELF. That is the correct
// answer for a lexical rule and the fix is at the mention, not in the rule -
// write the identifier without its parens, as the diagnostic now does. A second
// exclusion list would buy nothing but a place for a real callsite to hide.
//
// Pure lib: no fs, no emit, no process, no Date, no randomness. It returns
// problem CODES; the caller owns the envelope.
'use strict';

/** The one problem code this rule files. */
export const CODE = 'undocumented-merge-warnings';

// A call, not a mention: the identifier followed by its opening paren.
const CALL_RE = /\bmergeLayers\s*\(/g;

// Lines that carry the identifier without calling it. The import spelling is
// `import { mergeLayers } from ...` (no paren) and so never matches CALL_RE,
// but it is excluded explicitly anyway - a future `import('...')` form must not
// read as a callsite. The definition is excluded for the same reason, even
// though self-verify skips lib/config-merge.mjs on the walk.
const IMPORT_RE = /^\s*(?:import|export)\b[^(]*\bfrom\b/;
const DEFINITION_RE = /\bfunction\s+mergeLayers\s*\(/;
const COMMENT_RE = /^\s*(?:\/\/|\*|\/\*)/;

// The destructuring that binds the warnings, tested against the text
// immediately BEFORE the call so a binding wrapped across lines still matches
// (`[^{}]` matches a newline). Bounded to a window: a real destructuring is
// tens of characters, and an unbounded look-back would scan the whole file per
// callsite.
const BINDING_WINDOW = 240;
const BINDING_RE = /const\s*\{([^{}]*)\}\s*=\s*$/;
const WARNINGS_RE = /\bwarnings\b/;

// The arm (b) marker, in a `//` or a `*` comment line.
const MARKER_RE = /^\s*(?:\/\/+|\*)\s*mergeLayers warnings\[\]:(.*)$/;

/**
 * The file's leading comment header: the run of lines from the top that are
 * blank, a shebang, or a comment. It ends at the first line of CODE - in this
 * repo's bin scripts that is `'use strict';` - so a marker sentence written
 * beside some callsite in the BODY does not satisfy arm (b). The header is
 * where a reader looking for the file's contract looks.
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
 * Whether the file header states the arm (b) reason: a marker line, plus prose
 * after it. The prose may sit after the colon on the marker line itself or on
 * the comment lines that follow it - a bare marker with nothing said is not a
 * reason.
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
 * Every `mergeLayers` callsite in `text` that satisfies neither arm, one entry
 * each, naming the 1-BASED line the call sits on.
 *
 * A non-string input yields `[]` - self-verify hands this whatever the tree
 * holds, and a rule that throws on one unreadable file takes the whole run with
 * it.
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
