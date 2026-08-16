// @ts-check
// text-flag-file.mjs - the ONE reader behind every `--<field>-file` flag on the
// seam, and the one home for the four refusals such a flag owes its caller.
//
// WHY THE TRANSPORT EXISTS. A workflow that prescribes
// `--<field> "<value>"` puts caller-derived prose inside a double-quoted shell
// word, so a value carrying `$(...)` or a backtick executes before Node starts.
// A PATH cannot: the caller writes the text with a file tool and names the file
// here, and the bytes reach the seam verbatim. `capture --text-file`
// (planning.mjs) conceded that reasoning for one flag; this module is the same
// transport stated once so the other free-text flags cannot each re-derive it.
// The rule itself - which values are caller-derived and which the workflow
// authors itself - is stated in references/conventions.md and cited by path;
// this module only carries it out.
//
// ADDITIVE, never a replacement (D-04). Every inline form survives: a human
// typing at a shell is passing their OWN text, which no transport needs to
// protect them from.
//
// THE FOUR REFUSALS ARE `cmdCapture`'s, in shape (D-04):
//   - a flag present with nothing usable after it (parseArgs mints the boolean
//     `true` for a valueless flag, and a written-through `true` is a value the
//     caller never passed with an ok:true envelope - #42/#45),
//   - a path that cannot be read, with the READ ERROR named (which is also the
//     missing-path arm: ENOENT arrives here),
//   - a file that is empty once trimmed,
//   - the inline and the file form given together, refused rather than resolved
//     by precedence, because a precedence rule silently discards one of two
//     values the caller believed was recorded.
//
// It deliberately does NOT route the read through `readText` in
// lib/seam-input.mjs: that reader returns '' on failure and discards the error,
// and naming the error is the whole point of the unreadable arm. It is not
// `readJsonPayload` either (planning.mjs), whose envelope is
// `no-payload`/`bad-payload` - a vocabulary no workflow reads.
//
// PURE and zero-dep past node builtins: no emit, no process, no write. The
// caller owns its envelope and its `reason` string, the way lib/require-int.mjs
// leaves `bad-args` vs `usage` to its callers.
'use strict';

import { readFileSync } from 'node:fs';

/**
 * Resolve `--<field>-file` to the file's trimmed contents, or say why not.
 *
 * ABSENT IS NOT AN ANSWER ABOUT THE INLINE FLAG. With no `--<field>-file` at
 * all this returns `value: undefined` and says nothing about `--<field>`, so
 * every caller keeps its own inline handling byte-for-byte - the inline value
 * is never trimmed, defaulted or re-validated here. A caller reads it as
 * `resolved.value !== undefined ? resolved.value : opts[field]`.
 *
 * ONE shape on both paths rather than an `ok`-discriminated union, the
 * `resolveRange` precedent in planning.mjs: this repo's CI typecheck runs
 * `strict: false`, where narrowing a JSDoc union by its boolean literal does
 * not happen, so the union costs every caller a cast (measured - it is a
 * TS2339 at the first call site). A refusal reads
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
