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
// THE TABLE MOVED HERE, it was not copied (D-06). `CONTRACTS` was defined in
// self-verify.mjs beside the prose lint that reads it; it is defined here now
// and self-verify.mjs imports it. Two tables is the drift ARG-06 exists to end
// reintroduced by the fix - a flag added to one and not the other is either
// silently accepted at the CLI or reported `unknown-flag` against correct
// prose. The prose side reads flag NAMES through `flagNames` rather than
// spreading a row, so the lint keeps working now that a row is a grammar.
//
// TWO MECHANISMS, PICKED PER BIN (D-08), because both ship here and
// harmonizing them would break one side. `evaluateFlag` RETURNS a
// classification and the caller names the refusal: that is the only form
// planning.mjs, route.mjs and config.mjs can use, since none of them holds an
// `e.seam` catch arm and a throwing contract there surfaces every argument
// refusal as `{"ok":false,"reason":"internal","detail":"[object Object]"}`.
// `requireFlag` is the same classification RAISED as lib/seam-input.mjs's
// refusal object, for the seven bins that already hold that arm and already
// answer `missing-flag-value` through it - the disposition they were written
// with, now read off a declared row instead of a hand-written `flagValue` call.
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

import { flagValue, missingFlagValue } from './seam-input.mjs';
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
 *
 * The `fallback` arm is where lib/seam-input.mjs's second flag reader ENDED UP
 * (D-09). That module used to export a permissive positional reader beside
 * `flagValue`, for the flags whose `|| default` was the whole contract, and the
 * five bins that copied it read the NEXT FLAG as a value when one was given
 * with nothing after it - `decide --branch --dir <p>` answered `--dir` as the
 * branch name (D-13). Declaring `fallback` is the same "reads as absent"
 * answer without that: the token is never consulted at all.
 * helper-census.test.mjs's row for that reader moved here with it and pins THIS
 * arm's body to this file, so the disposition has exactly one spelling. What it
 * can no longer catch is a hand-written positional reader pasted into a bin
 * under a new name: that idiom is not a shared contract any more, it is just an
 * expression, and what refuses it is the declaration this module requires.
 *
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
 * classification: THIS function never throws at its caller. `requireFlag`
 * below is the throwing half, for the bins that hold an `e.seam` arm.
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

/**
 * The same classification, RAISED rather than returned (D-08), for the seam
 * bins whose dispatch already ends in an `e.seam` catch arm that emits
 * `{ok:false, reason:e.seam, detail:e.detail}` on one stdout line. It is the
 * form those seven bins were already written in - each read `--dir` through
 * `flagValue` and caught its throw - so adopting a declared row costs them no
 * new control flow and mints no new reason code (D-07): the refusal object is
 * lib/seam-input.mjs's own `missingFlagValue`, and `missing-flag-value` is the
 * code those bins already publish.
 *
 * A `fallback` row never reaches the throw - it is `ok:true` with an undefined
 * value, so the caller's own `|| default` answers exactly as it did when the
 * flag was read through the permissive reader (D-12). A `warn` row would return
 * its raw value here and drop the diagnostic, which is why no bin using this
 * entry point declares one: `warn` belongs to the returning form, where the
 * caller can word the warning (route.mjs's `--phase`).
 *
 * @param {string[]} argv @param {string} flag @param {{required: boolean, type: string, value: string, bare: string}} spec
 * @returns {any} the accepted value, or `undefined` for an absent or
 *   fallback-dispositioned flag. Never returns on the refusing path.
 */
export function requireFlag(argv, flag, spec) {
  const r = evaluateFlag(argv, flag, spec);
  if (!r.ok) throw missingFlagValue(r.detail);
  return r.value;
}

// Subcommands whose first word takes a second word (sub-subcommand). This set
// and the expression below it were self-verify.mjs's, beside the prose lint
// that resolves a spelling it finds in a workflow; they live HERE because an
// adopting dispatch has to resolve the SAME key to find its row, and two
// spellings of one rule is the drift ARG-06 exists to end (D-06).
const TWO_WORD = new Set(['cursor', 'uat', 'renumber', 'trace', 'risk-check']);

/**
 * Resolve a script's leading positional WORDS to the subcommand KEY its table
 * is filed under.
 *
 * The BARE form - no words at all, or a first word that is really a flag -
 * resolves to the `''` key, which is what stops a reader taking a first flag
 * for a subcommand: `weight.mjs --root <path>` reported `unknown-subcommand`
 * until that arm existed. A second word is consumed ONLY for the five
 * two-word families, so `status --dir` keeps resolving to `status` and leaves
 * `--dir` to be read as a flag.
 *
 * It answers about SPELLING alone and never about membership: a key no table
 * declares comes back unchanged, and the caller decides whether an unknown
 * subcommand is a refusal (planning.mjs's `usage` line) or a report
 * (self-verify.mjs's `unknown-subcommand` problem).
 * @param {string[]} words the positional words, subcommand first
 * @returns {string} the table key, `''` for the bare form
 */
export function subcommandKey(words) {
  const [w1, w2] = words || [];
  if (!w1 || w1.startsWith('-')) return '';
  return TWO_WORD.has(w1) && w2 ? `${w1} ${w2}` : w1;
}

/**
 * Apply a whole resolved ROW's value grammar to one argument list, and return
 * the FIRST refusal or the accepted values.
 *
 * THIS IS A VALUE DOOR, NOT A PRESENCE DOOR. It evaluates only the flags
 * actually PRESENT in `argv` and leaves an absent-but-required flag to the bin
 * that owns the wording. That is review-provider.mjs's shipped position - its
 * `parseArgs` skips a flag with `if (!rest.includes(flag)) continue;` - and
 * reversing it would replace diagnostics a declaration cannot express
 * (`capture --kind must be one of todo | seed | note`, `milestone-prune needs
 * --mode <delete|archive> (tagged release: ...)`) with one generic sentence.
 * `required` therefore stays a fact the table states for the bins that choose
 * to read it, not a rule this door enforces.
 *
 * THE `'*'` ROW IS EVALUATED FIRST, because a script-global flag is what
 * answers first today: planning.mjs refused a valueless `--dir` before it
 * looked at its subcommand at all, and the first failing flag is the one the
 * refusal names. A resolved key the table does not declare leaves only the
 * `'*'` row to evaluate, so an unknown subcommand still falls through to the
 * caller's own usage refusal.
 *
 * IT CARRIES NO WORDING AND NO REASON CODE (D-07): `detail` is the flag name
 * and nothing else, exactly as `evaluateFlag` answers, and the caller composes
 * the sentence and names the refusal in the vocabulary it already owns.
 *
 * @param {string[]} argv the whole argument list, subcommand words included
 * @param {Record<string, Record<string, any>>} table one script's table
 * @param {string} key the subcommand key `subcommandKey` resolved
 * @returns {{ok: boolean, detail: string, values: Record<string, any>,
 *   warned: string[]}} `ok:false` refuses naming the flag in `detail`;
 *   `values` holds each accepted flag's value, a `fallback` one omitted so it
 *   reads as absent; `warned` names every flag a `warn` row kept raw, always
 *   an array so no caller has to test for it.
 */
export function evaluateRow(argv, table, key) {
  /** @type {Record<string, any>} */
  const values = {};
  /** @type {string[]} */
  const warned = [];
  const seen = new Set();
  for (const row of [table['*'], table[key]]) {
    for (const flag of flagNames(row)) {
      if (seen.has(flag)) continue;
      seen.add(flag);
      if (!argv.includes(flag)) continue;
      const r = evaluateFlag(argv, flag, row[flag]);
      if (!r.ok) return { ok: false, detail: r.detail, values, warned };
      if (r.detail) warned.push(r.detail);
      if (r.value !== undefined) values[flag] = r.value;
    }
  }
  return { ok: true, detail: '', values, warned };
}

// --- the contract table: script -> subcommand -> flag -> grammar ------------
// Global flags allowed everywhere on that script are listed under '*'.
//
// EVERY ENTRY DECLARES FOUR FIELDS and none of them defaults: `required`,
// `type`, `value` (what happens to a present-but-malformed value) and `bare`
// (what happens to a flag present with nothing usable after it).
// arg-contract.test.mjs walks all 144 of them, so a row added later without a
// complete grammar reddens rather than picking up a silent default.
//
// REQUIRED-NESS IS PER SUBCOMMAND. `risk-check run` requires `--base` and
// `--head`; `risk-check status` takes the same pair optionally, because its
// triple is all-three-or-none and the seam owns that rule. `--plan` is three
// different types on three rows for the same reason - `lease-check` names a
// plan FILE and stays `int`, `risk-check` names the worker key and reads
// `plan-key`, `trace append` stores the caller's string verbatim. Folding any
// of those onto one row would state a bound one face does not hold.
//
// THE DISPOSITIONS REPRODUCE WHAT SHIPS, they do not tidy it. The ones that
// carry a reason, each with its evidence:
//
//   `--dir` and `--root` refuse the empty, bare and flag-shaped spellings
//     everywhere. `planning.mjs status --dir ''` answered ok:true about
//     `./.planning`, a tree the caller never named, while `git-branch.mjs tags
//     --dir ''` already refused the identical spelling.
//   `--branch`, `--base`, `--remote`, `--merged` and `--version` declare
//     `fallback` on the bare form (D-12). Their seams read them through the
//     permissive reader and answer with `|| fallback`; declaring `refuse`
//     would start refusing a valueless spelling those seams absorb today.
//   `--timeout-ms` declares `fallback` on a MALFORMED VALUE as well.
//     issue-check.mjs falls back to its constant because that seam's whole
//     contract is that it never fails a land, and an unbounded call is the one
//     thing it may never do instead.
//   `route.mjs`'s `--phase` declares `warn` on both axes, never a `usage`
//     refusal, which would route the phase LOWER than its own risk baseline.
//     The value is kept raw so the floor computation still sees the spelling.
//   On `trace append|close`, `--plan`, `--sha`, `--base` and `--detail` declare
//     `fallback` on both axes - the drop the shared body already performs
//     (`typeof opts.plan === 'string' && opts.plan`), so every shipped
//     `trace close` without them keeps answering ok:true - while `--step`,
//     `--reviewer`, `--trigger` and `--role` REFUSE the bare form on the same
//     two subcommands. That split is D-05, and it is why the two axes are two
//     fields: a bare `--role` wrote a record with no `role` key and `trace
//     render` then aggregated it under the empty-string key.
//   `--tokens` declares `fallback` on the VALUE axis alone, on both trace
//     rows, because the body's grammar is WIDER than any type here can state:
//     it accepts a strict comma-grouped integer (`146,405`), which is the form
//     this plugin PRINTS token figures in and therefore the transcription its
//     own prose models, and it refuses a negative one, which `int` accepts.
//     Declaring `refuse` made the door reject `146,405` after the `dispatch`
//     half of the bracket was already written, stranding the worker unpaired
//     forever - a recording error escalated into loss of the bracket it was
//     recording. The BARE axis still refuses: that spelling has no grammar to
//     be wider than.
//   `--date` refuses the bare form, which release-bump.mjs hand-writes today by
//     testing the flag's own appearance in argv beside the permissive reader: a
//     valueless `--date` must refuse rather than silently date today.
//
// A `boolean` row's two dispositions are INERT by construction - presence is
// the whole grammar, so neither axis can fire - and they are declared
// `fallback` rather than omitted, because an omitted field is the silent
// opt-out the completeness test exists to catch.
//
// The '' key is the BARE form - the script invoked with flags and no
// subcommand, e.g. `weight.mjs --root <path>`. Without it check 2 reads the
// first flag AS the subcommand and reports `unknown-subcommand` on correct
// prose, so every script with a no-subcommand form must declare one.
//
// Every top-level script under cadence-core/bin must appear here: check 14
// enforces it, because check 2 skips a script it finds no row for. A missing
// row is therefore a silent opt-out of the flag lint, not a script that
// happens to be unlinted - which is exactly how `weight.mjs`'s own row could
// be deleted with self-verify still returning ok:true.
export const CONTRACTS = {
  'planning.mjs': {
    '*': {
      '--dir': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    status: {},
    'cursor get': {},
    // `--next-file` is `--next`'s path transport, for the two sites that COMPOSE
    // a resume pointer (/cad-pause, `progress`) rather than authoring a literal
    // `/cad-<command> N`. The seven literal sites keep the inline form.
    'cursor set': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--status': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--next': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--next-file': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--name': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--total': { required: false, type: 'cursor', value: 'refuse', bare: 'refuse' },
    },
    'phase-done': {
      '--n': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--reqs': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--undo': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
    },
    'uat init': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--sources': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    'uat refresh': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
    },
    // `--fields-file` is the path transport for the five FREE-TEXT fields
    // (`reason`, `reported`, `cause`, `fix`, `evidence`) as ONE JSON object -
    // one file per failing item rather than three, on the workflow whose
    // per-item round-trip discipline is explicit. The enum-validated flags gain
    // no file form: a value that must survive `UAT_RESULTS.includes()` or an
    // `AC<N>` test is not caller-derived prose.
    'uat record': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--item': { required: true, type: 'int', value: 'refuse', bare: 'refuse' },
      '--result': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--reason': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--reported': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--severity': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--cause': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--fix': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--evidence': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--fields-file': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--source': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--origin': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--criterion': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    'uat merge': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--payload': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    'uat status': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
    },
    audit: {},
    'criteria-coverage': {},
    // The criteria-count ceilings, as the CALLER's literal numbers. Four bounds
    // rather than two because the two grammars have different ones - CONTEXT's
    // acceptance criteria 3-7, ROADMAP's per-phase criteria 2-5 - and folding
    // them onto one pair would make a workflow state a bound it does not hold.
    // No config keys: D-04, the rule `plan-size`'s row above already follows.
    'criteria-size': {
      '--phase': { required: false, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--context-min': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
      '--context-max': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
      '--roadmap-min': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
      '--roadmap-max': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
    },
    'plan-overlap': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
    },
    'plan-size': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--max-reqs': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
      '--max-tasks': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
    },
    // `--label-file` is `--label`'s path transport: an untagged close takes the
    // label from PROJECT.md's milestone NAME, which is repository content. The
    // table term (`|` or a newline) and the containment term run on the
    // resolved value either way - the transport changes how it arrives, never
    // what it must satisfy.
    'milestone-prune': {
      '--label': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--label-file': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--mode': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    'seed-reqs': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
    },
    'lease-check': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--plan': { required: true, type: 'int', value: 'refuse', bare: 'refuse' },
    },
    'detect-commands': {
      '--root': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    'detect-surfaces': {
      '--root': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    recall: {
      '--top': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
    },
    // `--join` ties each record to the `trace.jsonl` dispatch bracket that
    // caused it, by role normalization and timestamp containment. Off by
    // default so the envelope every existing reader parses is unchanged, and
    // whole-record by construction: `reads.jsonl` carries no phase scoping, so
    // the brackets it joins to must span every phase.
    reads: {
      '--join': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
    },
    // `--read` is ONE comma-separated value, never a repeated flag (parseArgs
    // keeps only the last). Its grammar is deliberately heterogeneous: an
    // element is any verbatim string naming something the site caused the
    // worker to read - a path, a glob, or a non-path reference (a
    // `<base>..<head>` ref range) the worker resolves for itself.
    // `--step` names the workflow step a COORDINATOR marker marks. It rides the
    // same event-agnostic seam as every other flag here; what keeps it off a
    // worker bracket is the prose and the census, not this table.
    // `--raised` is the ADJUDICATED arm's kill count - how many findings the
    // reviewers raised before adjudication, structured so a 0-of-0 fire and a
    // 0-of-9 one stop reading alike. It lives here rather than in `--detail`
    // because this row is what makes the flag the only structured route.
    // `--reviewer` names the reviewer that ACTUALLY ran a fire (RVW-02), so two
    // fires of one trigger - one cross-model, one subagent - are distinguishable
    // in the record. Nothing refuses a dispatch to a reviewer outside the
    // resolved set, so this mark is the whole enforcement.
    // The detection the blocking `risk_surface` gate fires on, and the record
    // that proves it ran. `--base` and `--head` are both REQUIRED - a defaulted
    // head is a range the caller never stated - and `--surfaces` narrows the
    // scope to the project's resolved set, refusing any token outside the
    // eight rather than answering about a narrower one.
    'risk-check run': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--plan': { required: false, type: 'plan-key', value: 'refuse', bare: 'refuse' },
      '--base': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--head': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--surfaces': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    // The completion gate. `--phase` alone keeps plan-level matching; the
    // optional `--plan --base --head` triple requires a record for THAT range,
    // so a record left by an earlier, narrower range of the same plan does not
    // satisfy a later one.
    'risk-check status': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--plan': { required: false, type: 'plan-key', value: 'refuse', bare: 'refuse' },
      '--base': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--head': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    // `--detail-file` is `--detail`'s path transport, for a detail the CALLER
    // derived: the inline form puts that text in a double-quoted shell word,
    // where `$(...)` and a backtick execute before Node starts. Additive - the
    // inline form stays for a human typing at a shell (lib/text-flag-file.mjs).
    // `--read-file` is `--read`'s path transport, split by the same comma
    // grammar. It is NOT on the close row below: `--read` is not either, and
    // the transport never widens what a subcommand accepts.
    // `--trigger` names WHICH review trigger an event belongs to, structured so
    // an `outcome` receipt can be joined to the fire that produced it -
    // `risk-check status` demands one for a matched range (GAT-04/D-12). It is
    // listed here or check 2 reports `unknown-flag` against correct prose. Not
    // on the `close` row below, for the reason `--read` is not: `close` fixes
    // its own family and event, and a flag row never widens what a subcommand
    // accepts.
    'trace append': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--family': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--event': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--plan': { required: false, type: 'string', value: 'fallback', bare: 'fallback' },
      '--base': { required: false, type: 'string', value: 'fallback', bare: 'fallback' },
      '--sha': { required: false, type: 'string', value: 'fallback', bare: 'fallback' },
      '--detail': { required: false, type: 'string', value: 'fallback', bare: 'fallback' },
      '--detail-file': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--role': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--tokens': { required: false, type: 'int', value: 'fallback', bare: 'refuse' },
      '--raised': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
      '--read': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--read-file': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--step': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--reviewer': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--trigger': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    // The CLOSE half of a worker bracket. No `--family` and no `--event`: the
    // family is fixed to `lifecycle` in the seam and the arm is inferred from
    // `--detail` (present -> `checkpoint`, absent -> `return`), so a close site
    // states what it closes and nothing about how the record spells it. A row
    // that listed them would let the restated spelling back in through the lint.
    // The inference reads the RESOLVED detail, so `--detail-file` selects the
    // checkpoint arm exactly as the inline form does.
    // `--turns` is the tool-call count on the same subagent return `--tokens`
    // is read off - the second of the two terms a run's price is made of, and
    // the reason it is a STRUCTURED flag rather than a phrase inside `--detail`
    // is that `--detail` is not a machine-join surface (one trigger name was
    // spelled four different ways across 35 shipped events). Listed on the
    // CLOSE row only, exactly as `--raised` is listed on `append` only: the
    // flag is validated in the ONE shared `append|close` body, and this row is
    // a prose allowlist that never widens what a subcommand accepts.
    'trace close': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--plan': { required: false, type: 'string', value: 'fallback', bare: 'fallback' },
      '--role': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--tokens': { required: false, type: 'int', value: 'fallback', bare: 'refuse' },
      '--turns': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
      '--detail': { required: false, type: 'string', value: 'fallback', bare: 'fallback' },
      '--detail-file': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--reviewer': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    // `--events` asks for the RAW event array. The default response carries the
    // paired `brackets` rows plus every `outcome` event instead, which is what
    // the two shipped readers (triage-gate's `rearm` lookup, report.md's
    // dispatch table) actually consume - and one to three of the bytes.
    'trace render': {
      '--phase': { required: false, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--events': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
    },
    'trace suggest': {
      '--phase': { required: false, type: 'phase', value: 'refuse', bare: 'refuse' },
    },
    // The dispatch-window report. `--phase` ALONE, and the absence of every
    // other flag is the point: the ceilings are CONFIG (six
    // `workflow.max_dispatch_tokens.<role>` keys), so a flag that could name a
    // role or a number here would be a second, un-layered way to set one - the
    // ad-hoc override that makes a run's report disagree with the project's own
    // configured bound. `--phase` only scopes which brackets are read, exactly
    // as it does on `render` and `suggest`.
    'trace window': {
      '--phase': { required: false, type: 'phase', value: 'refuse', bare: 'refuse' },
    },
    'trace ignore': {
      '--root': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--check': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
    },
    // `--file` overrides `<dir>/CAPTURE.md`, for `/cad-capture --cadence`'s
    // global queue alone - there is no `--section`, and that absence is the
    // point: a caller that could name a heading is how five filed bullets
    // landed outside the recall walk.
    capture: {
      '--kind': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--text': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--text-file': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--phase': { required: false, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--file': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    // The read side of the same file, and the same `--file` override. No
    // `--section` and no allowlist flag either: the census is unconditional
    // (D-06), and a flag that could hide a section is what would have hidden
    // the five lost bullets.
    'capture-sections': {
      '--file': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    'debt-harvest': {
      '--root': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    'renumber insert': {
      '--at': { required: true, type: 'int', value: 'refuse', bare: 'refuse' },
      '--dry-run': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
    },
    'renumber remove': {
      '--n': { required: true, type: 'int', value: 'refuse', bare: 'refuse' },
      '--dry-run': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
    },
  },
  'config.mjs': {
    '*': {},
    validate: {
      '--file': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--global': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
    },
    check: {},
    set: {
      '--file': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--global': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
    },
    get: {
      '--file': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    keys: {},
  },
  'git-branch.mjs': {
    '*': {
      '--dir': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    decide: {
      '--branch': { required: false, type: 'string', value: 'fallback', bare: 'fallback' },
    },
    // The read-only tags arm. No flags of its own: `--dir` is the whole input
    // and it is BOTH the directory the question is asked from and the project
    // root the answer must belong to (TAG-01), so a second flag here would be
    // the way to ask one of those two questions without the other - which is
    // the upward discovery the bound closed.
    tags: {},
  },
  'git-publish.mjs': {
    '*': {
      '--dir': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    publish: {
      '--remote': { required: false, type: 'string', value: 'fallback', bare: 'fallback' },
    },
    reap: {
      '--branch': { required: false, type: 'string', value: 'fallback', bare: 'fallback' },
    },
    authorized: {},
  },
  'land-cleanup.mjs': {
    '*': {
      '--dir': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    cleanup: {
      '--branch': { required: false, type: 'string', value: 'fallback', bare: 'fallback' },
      '--base': { required: false, type: 'string', value: 'fallback', bare: 'fallback' },
      '--merged': { required: false, type: 'string', value: 'fallback', bare: 'fallback' },
    },
    gate: {},
  },
  'issue-check.mjs': {
    '*': {
      '--dir': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    check: {
      '--base': { required: false, type: 'string', value: 'fallback', bare: 'fallback' },
      '--timeout-ms': { required: false, type: 'int', value: 'fallback', bare: 'fallback' },
    },
  },
  'release-bump.mjs': {
    '*': {
      '--dir': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    bump: {
      '--version': { required: false, type: 'string', value: 'refuse', bare: 'fallback' },
      '--date': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
  },
  'route.mjs': {
    '*': {},
    resolve: {
      '--role': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--attempt': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
      '--file': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--phase': { required: false, type: 'phase', value: 'warn', bare: 'warn' },
      '--bracket-read': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--bracket-plan': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    table: {},
  },
  'worktree-base.mjs': {
    '*': {
      '--dir': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    resolve: {},
  },
  'review-provider.mjs': {
    '*': {
      '--key-file': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    // `--trigger` names the review trigger the call was fired for; it rides the
    // provider trace event so a cross-model fire JOINS to its trigger through
    // the correlation id, which is what makes it distinguishable from the
    // subagent fire of the same trigger (RVW-02). Optional and review-only: a
    // consult has no trigger.
    review: {
      '--provider': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--model': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--effort': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--payload': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--trigger': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    consult: {
      '--provider': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--model': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--effort': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--payload': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    'detect-models': {
      '--provider': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
    },
  },
  'weight.mjs': {
    '*': {
      '--root': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    '': {},
    resident: {
      '--command': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--role': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
  },
  // Two scripts with no subcommand at all. They carry rows because check 14
  // requires one, and the rows have teeth: the bare form's flag list is what
  // check 2 lints `self-verify.mjs --root <path>` against.
  'self-verify.mjs': {
    '*': {
      '--root': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    '': {},
  },
  // git-guard.mjs is the commit hook - it reads its input on stdin and takes
  // no flags, so the bare form allows none.
  'git-guard.mjs': {
    '*': {},
    '': {},
  },

  // read-trace.mjs is the PostToolUse recorder - like git-guard.mjs it reads
  // its input on stdin and takes no flags and no subcommand at all.
  'read-trace.mjs': {
    '*': {},
    '': {},
  },
  // skim.mjs takes a FILE as its positional argument, never a subcommand, so
  // the bare row carries the whole flag set.
  'skim.mjs': {
    '*': {},
    '': {
      '--stats': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
      '--no-numbers': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
    },
  },
  // test.mjs takes GROUP NAMES as positional arguments, never subcommands, so
  // the bare form is the only form and `--list` is its one flag.
  'test.mjs': {
    '*': {
      '--list': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
    },
    '': {
      '--list': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
    },
  },
};

/**
 * The flag NAMES a row declares, for the prose lint that reads this table from
 * the other side. self-verify.mjs check 2 asks it twice per invocation it finds
 * in prose - once for the subcommand's own row and once for the script's `'*'`
 * row - and unions the two.
 *
 * It exists so the lint never spreads a row DIRECTLY: a row is a value-grammar
 * object, and a check that spread one would read its four grammar fields as
 * flag names. Asking for the names is what lets ONE table serve the prose lint
 * and the CLI refusals at once (D-06).
 * @param {Record<string, any>|undefined} row
 * @returns {string[]}
 */
export function flagNames(row) {
  return row ? Object.keys(row) : [];
}
