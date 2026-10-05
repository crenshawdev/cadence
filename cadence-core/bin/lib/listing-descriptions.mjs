// @ts-check
// listing-descriptions.mjs - the rule behind self-verify check 26: no Cadence
// agent and no contract skill carries a `description` or `when_to_use` that
// spans more than one line.
//
// WHY. On a host with mods, lib/listing-filter.mjs takes these entries out of
// the agent and skill listings line by line. The host prints a value's own
// newlines raw at column 0, so a value holding an empty line, or a line
// beginning `- `, reads as the end of its entry, and the rest of it stays in
// the prompt. A one-line value can hold neither. 2.1.289 lists a skill as
// `<description> - <when_to_use>`, so `when_to_use` reaches the same limit and
// is read by the same rule.
//
// WHAT SPANS. Read both as the file holds it and as the host will print it,
// a value spans when it is a block scalar (`|` or `>`), when its quote does not
// close on the key's line, when it is double-quoted and carries an escaped
// line break (hex-escaped included), or when the next non-blank, non-comment
// frontmatter line is anything but a new top-level key or the closing `---` (a
// plain value continued).
//
// WHAT IT LEAVES ALONE. A missing key is not this check's business. Skills not
// ending `-contract` stay listed, so the filter never cuts them. A root with no
// agents/ or skills/ is a partial fixture; check 0 reports a full tree missing
// either. An unreadable file reads as '' through readText and is skipped: the
// prose walk already reports it as `unreadable-surface`.
//
// Pure rule: no emit, no exit, node builtins only. Kept out of
// lib/listing-filter.mjs, which the hooks module imports and which must stay
// free of `node:fs`. It takes no CONTRACTS row, for the reason self-verify.mjs
// check 14 states about `lib/*.mjs`.
'use strict';

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readText } from './seam-input.mjs';

/** The problem code this rule files. */
export const MULTILINE_LISTING_TEXT = 'multiline-listing-text';

/** The listed keys, each read by the same rule. */
const KEYS = ['description', 'when_to_use'];

/** A new top-level key: column 0, not a comment, not a list item. */
const TOP_KEY = /^[^\s#-][^:]*:(\s|$)/;

/** The line breaks YAML decodes: LF, CR, NEL, LS, PS. */
const BREAKS = new Set([0x0a, 0x0d, 0x85, 0x2028, 0x2029]);

/**
 * Whether a double-quoted value carries an escape the host prints as a line
 * break: `\n \r \N \L \P`, or a hex escape (`\xHH`, `\uHHHH`, `\UHHHHHHHH`)
 * naming one of the same code points. One pass, left to right, so `\\` is
 * taken as a pair and never starts an escape.
 * @param {string} value
 */
function escapedBreak(value) {
  for (const m of value.matchAll(/\\(?:x([0-9a-fA-F]{2})|u([0-9a-fA-F]{4})|U([0-9a-fA-F]{8})|([\s\S]))/g)) {
    const hex = m[1] ?? m[2] ?? m[3];
    if (hex ? BREAKS.has(parseInt(hex, 16)) : 'nrNLP'.includes(m[4])) return true;
  }
  return false;
}

/**
 * Whether a key's value, `value` on frontmatter line `at`, spans more than one line.
 * @param {string[]} lines the frontmatter's lines, closing `---` excluded
 * @param {number} at
 * @param {string} value the text after `<key>:`, trimmed
 */
function spans(lines, at, value) {
  if (/^[|>]/.test(value)) return true;
  if (value.startsWith('"')) {
    const close = value.slice(1).search(/(^|[^\\])(\\\\)*"/);
    if (close < 0) return true;
    if (escapedBreak(value)) return true;
  } else if (value.startsWith("'") && !/^'([^']|'')*'/.test(value)) {
    return true;
  }
  // A comment line ends a plain scalar in YAML, so it is skipped, never read
  // as the value continued.
  const next = lines.slice(at + 1).find((l) => l.trim() !== '' && !l.trim().startsWith('#'));
  return next !== undefined && !TOP_KEY.test(next);
}

/**
 * The issues one file's frontmatter raises.
 * @param {string} text
 * @param {string} file root-relative, as the issue reports it
 */
function fileIssues(text, file) {
  const all = text.split(/\r?\n/);
  if (all[0] !== '---') return [];
  const end = all.indexOf('---', 1);
  if (end < 0) return [];
  const lines = all.slice(1, end);
  const issues = [];
  for (const key of KEYS) {
    const at = lines.findIndex((l) => l.startsWith(`${key}:`));
    if (at < 0) continue;
    if (!spans(lines, at, lines[at].slice(key.length + 1).trim())) continue;
    issues.push({
      kind: MULTILINE_LISTING_TEXT,
      file,
      detail: `\`${key}\` spans more than one line; lib/listing-filter.mjs would leave`
        + ' the rest of this target entry in the prompt',
    });
  }
  return issues;
}

/** A directory's entries, or none when it is absent or unreadable. */
function entries(/** @type {string} */ dir) {
  try { return readdirSync(dir, { encoding: 'utf8' }); }
  catch { return []; }
}

/**
 * Every multi-line `description` or `when_to_use` among `agents/*.md` and
 * `skills/*-contract/SKILL.md` under `root`.
 * @param {string} root repository root
 * @returns {{kind: string, file: string, detail: string}[]}
 */
export function listingDescriptionIssues(root) {
  const files = [
    ...entries(join(root, 'agents')).filter((e) => e.endsWith('.md')).map((e) => `agents/${e}`),
    ...entries(join(root, 'skills')).filter((e) => e.endsWith('-contract')).map((e) => `skills/${e}/SKILL.md`),
  ];
  return files.flatMap((file) => fileIssues(readText(join(root, file)), file));
}
