// @ts-check
// arg-contract.mjs - the ONE statement of what a seam CLI's flags may be, and
// the ONE evaluator that classifies a value against that statement (ARG-06).
//
// THE DEFECT IT ENDS. Every bin script wrote its own argument refusals: 79
// `fail('bad-args', ...)` sites in planning.mjs alone, eleven "needs a <thing>
// after it" sentences, four separate argv parsers. A rule restated nine times
// is a rule nine files can disagree about, and they did - `planning.mjs status
// --dir ''` answered ok:true about `./.planning`, a tree the caller never
// named, while `git-branch.mjs tags --dir ''` refused the identical spelling.
// So the rules are DECLARED here, once, and a tenth seam inherits them rather
// than restating them.
//
// TWO HALVES, both in this file (D-06/D-10). The declarations are DATA - per
// script, per subcommand, per flag - and the evaluator is a pure CLASSIFIER
// beside them. Data alone would be a second table drifting from the code that
// refuses; a helper alone would not be the declarative thing ARG-06 asks for.
// The precedent for the pair is already here: config.schema.json is 77
// declarative key specs read by config.mjs, and lib/require-int.mjs,
// lib/text-flag-file.mjs and lib/plan-key.mjs are pure classifiers whose
// headers each state that the CALLER owns the reason string.
//
// WHAT A FLAG DECLARES is a complete grammar, four fields, no defaults:
//
//   required  absent-and-required is a refusal; absent-and-optional lets the
//             caller's own default answer. Required-ness is per SUBCOMMAND and
//             never per flag - `risk-check run` requires `--base` and `--head`
//             while `risk-check status` takes the same pair optionally - so
//             folding two faces onto one row would state a bound one of them
//             does not hold.
//   type      which of this tree's EXISTING classifiers judges the value.
//             Never a re-derived predicate: `int` is lib/require-int.mjs's
//             `requireInt`, `cursor` its `requireCursorNumber`, `phase` its
//             `requirePhaseArg`, `plan-key` is lib/plan-key.mjs's
//             `requirePlanKey`. `string` is the non-blank rule planning.mjs
//             hand-writes at its two `--root` guards, trim clause included.
//             `boolean` is for the flags whose BARE FORM IS THE VALUE
//             (`--undo`, `--dry-run`, `--global`, `--events`, `--join`,
//             `--list`, `--stats`, `--no-numbers`); without it a door reading
//             one would call the only spelling it has malformed.
//   value     what happens when a value is present and fails the type.
//   bare      what happens when the flag is present with nothing usable after
//             it. SEPARATE from `value` on purpose (D-05): planning.mjs's
//             shared `trace append|close` body already runs both side by side -
//             `--step`, `--reviewer`, `--trigger` and `--role` refuse a bare
//             flag while `--plan`, `--sha` and `--base` silently drop one - and
//             a single disposition would either start refusing every shipped
//             `trace close` that omits `--plan`, or extend the drop to the
//             three refusals written against exactly the complete-looking event
//             that defeats attribution.
//
// THE DISPOSITION VOCABULARY IS EXACTLY THREE WORDS (D-04), because all three
// are reasoned positions already shipped in this tree and a contract that made
// every typed flag refuse would reverse two of them at once:
//
//   refuse    the seam answers ok:false naming the flag. lib/seam-input.mjs's
//             `flagValue` is this disposition written out by hand.
//   warn      the value is kept RAW and the caller records a warning.
//             route.mjs's `--phase` is the case: a `usage` refusal there would
//             route the phase LOWER than its own risk baseline.
//   fallback  the flag reads as absent so the caller's own `|| default` or
//             key-omission answers. issue-check.mjs's `--timeout-ms` is the
//             case on the value axis - that seam's whole contract is that it
//             never fails a land - and the `trace append` drop-on-bare spreads
//             are the case on the bare axis. Dropping a bare flag IS fallback
//             and gets no fourth word: the bare form reads as absent, which is
//             precisely what the caller's default already answers.
//
// ONE FLAT RETURN ON BOTH PATHS, never a JSDoc discriminated union (D-11).
// tsconfig.ci.json runs `checkJs: true` with `strict: false` over every
// non-test .mjs under cadence-core/bin, and lib/text-flag-file.mjs's header
// records a MEASURED TS2339 at its first call site from exactly that pattern.
// The three answers are read off two fields rather than a third: `ok:false` is
// a refusal, `ok:true` with a non-empty `detail` is a warning, `ok:true` with
// an empty one is an accepted value or a fallback. `detail` carries the FLAG
// NAME and nothing else - the caller owns its `reason` string and its wording,
// the way lib/require-int.mjs leaves `bad-args` vs `usage` to its callers
// (D-07: this module mints no reason code of its own).
//
// PURE. It never emits, never reads `process` or the environment, never touches
// the filesystem, and holds no state. The caller owns its envelope.
//
// ONE HARD BOUNDARY: this module governs VALUE grammar only. It never refuses
// an UNDECLARED flag at runtime - flag membership is self-verify check 2's
// prose-side job, and a runtime refusal would break callers no decision here
// asks about. The table's own completeness is likewise a TEST-time question,
// not a runtime one: arg-contract.test.mjs walks every row and reddens on a
// missing or misspelled field, so the evaluator carries no spec-validation
// branch that would only ever fire on a table this repo cannot ship.
'use strict';

import { flagValue } from './seam-input.mjs';
import { requireInt, requireCursorNumber, requirePhaseArg } from './require-int.mjs';
import { requirePlanKey } from './plan-key.mjs';

/** The whole disposition vocabulary. Three words, stated once (D-04). */
export const DISPOSITIONS = Object.freeze(['refuse', 'warn', 'fallback']);

/** The whole type vocabulary. Each name is an EXISTING classifier's home. */
export const TYPES = Object.freeze(['string', 'boolean', 'int', 'cursor', 'phase', 'plan-key']);

/**
 * Flatten a classifier's `{ok:true, <key>} | {ok:false}` union into the one
 * flat shape this module speaks. The single cast lives here rather than at
 * five call sites, which is the same reason lib/text-flag-file.mjs returns one
 * shape: a JSDoc union costs its readers a TS2339 under `strict: false`.
 * @param {{ok: boolean}} r @param {string} [key] the accepted field's name
 * @returns {{ok: boolean, value: any}}
 */
function flat(r, key = 'value') {
  const any = /** @type {any} */ (r);
  return { ok: any.ok === true, value: any.ok === true ? any[key] : undefined };
}

/**
 * type -> the classifier that judges a PRESENT value. `boolean` is absent on
 * purpose: its whole grammar is presence, answered before this map is reached.
 *
 * `phase` yields the CALLER's own trimmed spelling rather than the parsed
 * number, because lib/require-int.mjs states that a phase is a directory
 * component as well as an arithmetic value and `String(Number('1.10'))` reads a
 * different phase's directory. A caller needing the arithmetic half applies
 * `Number()` to a spelling already proven clean.
 * @type {Record<string, (raw: string) => {ok: boolean, value: any}>}
 */
const CLASSIFIERS = {
  // Non-blank, not merely non-empty: planning.mjs's two `--root` guards test
  // `opts.root.trim() === ''` because `--root "   "` otherwise fell through to
  // a `no-root` ENOENT - one refusal vocabulary answering in two.
  string: (raw) => ({ ok: raw.trim() !== '', value: raw }),
  int: (raw) => flat(requireInt(raw)),
  cursor: (raw) => flat(requireCursorNumber(raw)),
  phase: (raw) => flat(requirePhaseArg(raw), 'raw'),
  'plan-key': (raw) => flat(requirePlanKey(raw), 'key'),
};

/**
 * Apply one disposition. `raw` is the caller's own spelling, kept by `warn`
 * and discarded by the other two.
 * @param {string} disposition @param {string} flag @param {string|undefined} raw
 * @returns {{ok: boolean, value: any, detail: string}}
 */
function dispose(disposition, flag, raw) {
  if (disposition === 'refuse') return { ok: false, value: undefined, detail: flag };
  // The value survives so the caller can name it in the warning and still
  // resolve; route.mjs's `--phase` is stored RAW for exactly this reason.
  if (disposition === 'warn') return { ok: true, value: raw, detail: flag };
  // fallback: the flag reads as absent and the caller's own default answers.
  return { ok: true, value: undefined, detail: '' };
}

/**
 * Classify `flag`'s value in `argv` against its declaration.
 *
 * ABSENT and PRESENT-WITH-NOTHING-USABLE are different inputs and are answered
 * by different fields of the spec. The split is read off `flagValue`, which
 * already draws that line for the whole seam layer - it returns `undefined`
 * only for a genuinely absent flag and throws for the missing, empty and
 * flag-shaped spellings - so the rule is CONSULTED here rather than re-spelled
 * (helper-census.test.mjs pins its body to lib/seam-input.mjs, and a second
 * copy is what silently drifts). The throw is caught and turned into a
 * classification: this module never throws at its caller.
 *
 * @param {string[]} argv the argument list, subcommand words included
 * @param {string} flag the flag as it is spelled on the command line (`--dir`)
 * @param {{required: boolean, type: string, value: string, bare: string}} spec
 * @returns {{ok: boolean, value: any, detail: string}} `ok:false` refuses
 *   naming the flag in `detail`; `ok:true` with a non-empty `detail` is a
 *   warning; `ok:true` with an empty one is an accepted value or a fallback.
 */
export function evaluateFlag(argv, flag, spec) {
  // A boolean flag's whole grammar is presence: `--dry-run` has no value to be
  // malformed and no bare form to be missing one, so neither disposition can
  // fire and an absent one is `false` rather than `undefined`.
  if (spec.type === 'boolean') return { ok: true, value: argv.includes(flag), detail: '' };

  let raw;
  try {
    raw = flagValue(argv, flag);
  } catch {
    return dispose(spec.bare, flag, undefined);
  }
  if (raw === undefined) {
    return spec.required
      ? { ok: false, value: undefined, detail: flag }
      : { ok: true, value: undefined, detail: '' };
  }
  const parsed = CLASSIFIERS[spec.type](raw);
  if (!parsed.ok) return dispose(spec.value, flag, raw);
  return { ok: true, value: parsed.value, detail: '' };
}
