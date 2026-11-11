// @ts-check
// plain-words.mjs - holds what a person reads in config.schema.json to the mechanical plain-words rules (phase 6, D-06).
// A self-verify check files each issue as a CI problem. Four rules:
//   label-missing             a walked key (one holding a `question`) has no non-empty `label`.
//   label-duplicate           two keys in one `section` have labels that match ignoring case and spacing. Advanced keys count.
//   option-text-missing       an `explain` entry on a walked key has no non-empty `text`, the `null` entry included.
//   plain-words-dotted-key / -backtick / -internal-term
//                             a `question` or `label` on any key holds a dotted key, a backtick, or a word from INTERNAL_TERMS.
// Voice isn't checked here, the diff review judges that. Pure: no fs, no emit, no process, and no CONTRACTS row since it's a lib.
'use strict';

import { escapeRe, isPlainObject, show } from './text-util.mjs';

/**
 * Words that mean something only inside Cadence. General software words and ordinary English stay off the list, so a
 * person's question can still say "branch" or "review". Plan 4's asks test matches the main-loop asks against this same list.
 */
export const INTERNAL_TERMS = Object.freeze([
  'dispatch', 'rung', 'seam', 'payload', 'frontmatter', 'subagent', 'envelope', 'adjudicate', 'triage',
  'cross-model', 'goal-backward', 'deep pass', 'deep-verify', 're-arm', 'coordinator', 'orchestrator', 'reap',
]);

/**
 * One term as a pattern: a space or hyphen inside it matches either, and the endings are plural and verb ones. A term
 * ending in `e` also takes `-ing` and `-ion` on its stem (triaging, adjudication). The closing `\b` is what keeps
 * "seamless" from reading as "seam".
 * @param {string} term
 */
function termSource(term) {
  const words = term.split(/[-\s]/).map(escapeRe).join('[-\\s]+');
  const endings = ['s', 'es', 'd', 'ed', 'ing'];
  if (!term.endsWith('e')) return `${words}(?:${endings.join('|')})?`;
  const stem = words.slice(0, -1);
  return `(?:${words}(?:${endings.join('|')})?|${stem}(?:ing|ion))`;
}

const TERMS_RE = new RegExp(`\\b(?:${INTERNAL_TERMS.map(termSource).join('|')})\\b`, 'i');
// a lowercase name.name identifier: config keys, file names, flags written as paths. "e.g." and "i.e." are prose.
const DOTTED_RE = /\b[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*)+/g;

/**
 * The first internal term one line of text holds, as written, or null.
 * @param {string} line
 * @returns {string | null}
 */
export function internalTermIn(line) {
  const m = TERMS_RE.exec(line);
  return m === null ? null : m[0];
}

/**
 * The first dotted identifier one line of text holds, or null.
 * @param {string} line
 * @returns {string | null}
 */
function dottedKeyIn(line) {
  for (const m of line.matchAll(DOTTED_RE)) {
    if (m[0] !== 'e.g' && m[0] !== 'i.e') return m[0];
  }
  return null;
}

/** @param {any} v */
const filled = (v) => typeof v === 'string' && v.trim() !== '';

/**
 * @param {any} schemaKeys the parsed config.schema.json `keys` map, trusted for nothing
 * @returns {Array<{code: string, detail: string}>}
 */
export function plainWordsIssues(schemaKeys) {
  /** @type {Array<{code: string, detail: string}>} */
  const issues = [];
  if (!isPlainObject(schemaKeys)) return issues;
  /** @type {Map<string, string>} */
  const labelOwner = new Map();

  for (const [key, spec] of Object.entries(schemaKeys)) {
    if (!isPlainObject(spec)) continue;
    const walked = filled(spec.question);

    if (walked && !filled(spec.label)) {
      issues.push({ code: 'label-missing', detail: `${key}: a walked setting has no label` });
    }
    if (filled(spec.label) && typeof spec.section === 'string') {
      const id = `${spec.section}|${spec.label.toLowerCase().replace(/\s+/g, '')}`;
      const first = labelOwner.get(id);
      if (first === undefined) labelOwner.set(id, key);
      else issues.push({ code: 'label-duplicate', detail: `${key}: the label ${show(spec.label)} matches ${first} in ${spec.section}` });
    }

    if (walked && Array.isArray(spec.explain)) {
      for (const e of spec.explain) {
        if (isPlainObject(e) && !filled(e.text)) {
          issues.push({ code: 'option-text-missing', detail: `${key}: the option ${show(e.value)} has no text` });
        }
      }
    }

    for (const field of ['question', 'label']) {
      const text = spec[field];
      if (typeof text !== 'string') continue;
      const dotted = dottedKeyIn(text);
      if (dotted !== null) issues.push({ code: 'plain-words-dotted-key', detail: `${key}: the ${field} holds the dotted key ${show(dotted)}` });
      if (text.includes('`')) issues.push({ code: 'plain-words-backtick', detail: `${key}: the ${field} holds a backtick` });
      const term = internalTermIn(text);
      if (term !== null) issues.push({ code: 'plain-words-internal-term', detail: `${key}: the ${field} holds the internal term ${show(term)}` });
    }
  }
  return issues;
}
