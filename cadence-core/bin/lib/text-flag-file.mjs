// @ts-check
// the one reader behind every `--<field>-file` flag, and the home for the four refusals such a flag owes its caller
// inline text sits in a double-quoted shell word where `$(...)` runs before Node starts; a file's bytes arrive as-is
// the four refusals are cmdCapture's, in shape:
//   - a flag with nothing usable after it (a valueless flag parses as `true`; #42/#45)
//   - an unreadable path, with the read error named
//   - a file that is empty once trimmed
//   - the inline and file forms together, refused rather than resolved by precedence
// not `readText` in seam-input, which discards the read error; naming it is the point
'use strict';

import { readFileSync } from 'node:fs';

/**
 * Resolve `--<field>-file` to the file's trimmed contents, or say why not.
 *
 * With no `--<field>-file` this returns `value: undefined` and says nothing about the inline flag, so every caller
 * keeps its own inline handling byte for byte: that value is never trimmed or re-validated here. A caller reads
 * `resolved.value !== undefined ? resolved.value : opts[field]`.
 *
 * One shape on both paths, not an `ok`-discriminated union: CI typechecks with `strict: false`, where narrowing on
 * the boolean doesn't happen. A refusal reads `{ok: false, value: undefined, detail: <why>}`.
 *
 * @param {Record<string, any>} opts parsed flags (parseArgs' `opts` object)
 * @param {string} field the flag's field name, without `--` (e.g. `detail`)
 * @param {string} label the command, for the refusal text (e.g. `trace append`)
 * @returns {{ok: boolean, value: string|undefined, detail: string}}
 */
export function resolveTextFlag(opts, field, label) {
  const fileFlag = `${field}-file`;
  const no = (/** @type {string} */ detail) => ({ ok: false, value: undefined, detail });
  if (!(fileFlag in opts)) return { ok: true, value: undefined, detail: '' };
  if (field in opts) return no(`${label} takes --${field} or --${fileFlag}, never both`);
  const raw = opts[fileFlag];
  if (typeof raw !== 'string' || raw.trim() === '') {
    return no(`${label} --${fileFlag} needs a path after it: --${fileFlag} <path>`);
  }
  let text;
  try {
    text = readFileSync(raw.trim(), 'utf8');
  } catch (e) {
    return no(`${label} --${fileFlag} could not be read: ${e && e.message ? e.message : String(e)}`);
  }
  text = text.trim();
  if (!text) return no(`${label} --${fileFlag} names an empty file`);
  return { ok: true, value: text, detail: '' };
}
