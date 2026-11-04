// @ts-check
// the one reader behind every `--<field>-file` flag, and the home for the four refusals such a flag owes its caller
// a workflow that prescribes `--<field> "<value>"` puts caller-derived prose inside a double-quoted shell word, so `$(...)` or a backtick in it runs before Node starts. A path can't: the caller writes the file and names it, and the bytes arrive verbatim. `capture --text-file` took this reasoning for one flag and this states it once for the rest
// conventions.md says which values are caller-derived; this only carries it out, and every inline form survives since a human at a shell passes their own text
// the four refusals are cmdCapture's, in shape:
//   - a flag with nothing usable after it (parseArgs mints the boolean `true` for a valueless flag, and writing that through is a value the caller never passed, under ok:true; #42/#45)
//   - an unreadable path, with the read error named (ENOENT lands here too)
//   - a file that is empty once trimmed
//   - the inline and file forms together, refused and not resolved by precedence, which silently discards one of two values the caller thought was recorded
// the read doesn't go through `readText` in seam-input, which returns '' and discards the error, and naming the error is the point; nor `readJsonPayload`, whose `no-payload`/`bad-payload` vocabulary no workflow reads
// pure past node builtins: the caller owns its envelope and reason string
'use strict';

import { readFileSync } from 'node:fs';

/**
 * Resolve `--<field>-file` to the file's trimmed contents, or say why not.
 *
 * With no `--<field>-file` this returns `value: undefined` and says nothing
 * about the inline flag, so every caller keeps its own inline handling byte for
 * byte: that value is never trimmed, defaulted or re-validated here. A caller
 * reads `resolved.value !== undefined ? resolved.value : opts[field]`.
 *
 * One shape on both paths, not an `ok`-discriminated union: CI typechecks with
 * `strict: false`, where narrowing on the boolean literal doesn't happen and the
 * union cost every caller a cast. A refusal reads
 * `{ok: false, value: undefined, detail: <why>}`.
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
