// @ts-check
// arg-contract.mjs - the one statement of what a seam CLI's flags may be, and the one evaluator that classifies a
// value against it. Every bin wrote its own refusals and they disagreed: `planning.mjs status --dir ''` answered
// ok:true about a tree nobody named while `git-branch.mjs tags --dir ''` refused the same spelling. Declared once,
// a new seam inherits the rules. The declaration is what refuses: an adopting bin runs its resolved row at the door
// of its dispatch (`subcommandKey`, then `evaluateRow`), and arg-contract-adoption.test.mjs walks the table against
// the shipped binaries so a declared refusal nothing carries out reddens.
// Value grammar only: it never refuses an undeclared flag (the prose lint owns flag membership) and owns no wording,
// so a bin keeps any diagnostic no row can state. Pure, no I/O, no environment; the caller owns its envelope.
// The table moved here from self-verify.mjs, which imports it: two copies is the drift this file exists to end.
// Whether the table is complete is a test-time question, so the evaluator has no spec-validation branch.
'use strict';

import { flagValue, missingFlagValue } from './seam-input.mjs';
import { requireInt, requireCursorNumber, requirePhaseArg } from './require-int.mjs';
import { requirePlanKey } from './plan-key.mjs';

// Three words: all three are positions already shipped, and making every typed flag refuse would reverse two of them.
//   refuse    ok:false naming the flag, which lib/seam-input.mjs's `flagValue` does by hand.
//   warn      the value is kept raw and the caller records a warning. No row declares it today (route.mjs's `--phase`
//             moved to refuse once it fed the risk floor), but the arm stays so the next such flag is a decision.
//   fallback  the flag reads as absent so the caller's own `|| default` answers: issue-check.mjs's `--timeout-ms` on
//             the value axis, the `trace append` drop-on-bare spreads on the bare one. A dropped bare flag is fallback too.
export const DISPOSITIONS = Object.freeze(['refuse', 'warn', 'fallback']);

// Each type is an existing classifier, never a re-derived predicate: `int` is requireInt, `cursor` requireCursorNumber,
// `phase` requirePhaseArg, `plan-key` requirePlanKey. `string` is the non-blank rule planning.mjs hand-writes at its
// two `--root` guards. `boolean` is for flags whose bare form is the value (`--dry-run`, `--global`); without it a door
// would call the only spelling the flag has malformed.
export const TYPES = Object.freeze(['string', 'boolean', 'int', 'cursor', 'phase', 'plan-key']);

/**
 * Flattens a classifier's `{ok:true, <key>} | {ok:false}` union into the one flat shape this module speaks, on both
 * paths and never as a JSDoc discriminated union: tsconfig.ci.json runs `checkJs` with `strict: false`, and
 * lib/text-flag-file.mjs hit a TS2339 at its first call site from that pattern. The single cast lives here, not at five call sites.
 * @param {{ok: boolean}} r @param {string} [key] the accepted field's name
 * @returns {{ok: boolean, value: any}}
 */
function flat(r, key = 'value') {
  const any = /** @type {any} */ (r);
  return { ok: any.ok === true, value: any.ok === true ? any[key] : undefined };
}

/**
 * type -> the classifier that judges a present value. `boolean` is absent on purpose: its grammar is presence,
 * answered before this map is reached.
 * `phase` yields the caller's own trimmed spelling, not the parsed number, because a phase is a directory component
 * as well as a number and `String(Number('1.10'))` reads a different phase's directory.
 * @type {Record<string, (raw: string) => {ok: boolean, value: any}>}
 */
const CLASSIFIERS = {
  // non-blank, not just non-empty: `--root "   "` used to fall through to a `no-root` ENOENT, so planning.mjs trims too
  string: (raw) => ({ ok: raw.trim() !== '', value: raw }),
  int: (raw) => flat(requireInt(raw)),
  cursor: (raw) => flat(requireCursorNumber(raw)),
  phase: (raw) => flat(requirePhaseArg(raw), 'raw'),
  'plan-key': (raw) => flat(requirePlanKey(raw), 'key'),
};

/**
 * Applies one disposition. `raw` is the caller's own spelling, kept by `warn` and dropped by the other two.
 * `fallback` is where lib/seam-input.mjs's second flag reader ended up. Its permissive positional reader took the next
 * flag as a value when one had nothing after it (`decide --branch --dir <p>` answered `--dir` as the branch name);
 * `fallback` is the same "reads as absent" without ever consulting the token. helper-census.test.mjs pins this arm's body to this file.
 * @param {string} disposition @param {string} flag @param {string|undefined} raw
 * @returns {{ok: boolean, value: any, detail: string}}
 */
function dispose(disposition, flag, raw) {
  if (disposition === 'refuse') return { ok: false, value: undefined, detail: flag };
  // the value survives so the caller can name it in the warning and still resolve; no shipped row declares it today
  if (disposition === 'warn') return { ok: true, value: raw, detail: flag };
  return { ok: true, value: undefined, detail: '' };
}

/**
 * Classifies one occurrence of `flag` against its declaration. `tail` is `argv` sliced so that occurrence sits at
 * index 0, which lets `flagValue`, an indexOf reader that answers about the first spelling it finds, be consulted
 * per occurrence instead of re-spelled here. Absence isn't this function's: `tail` starts at an occurrence, so
 * `flagValue` never answers undefined there.
 * @param {string[]} tail @param {string} flag
 * @param {{required: boolean, type: string, value: string, bare: string}} spec
 * @returns {{ok: boolean, value: any, detail: string}}
 */
function evaluateOccurrence(tail, flag, spec) {
  let raw;
  try {
    raw = flagValue(tail, flag);
  } catch {
    return dispose(spec.bare, flag, undefined);
  }
  const parsed = CLASSIFIERS[spec.type](raw);
  if (!parsed.ok) return dispose(spec.value, flag, raw);
  return { ok: true, value: parsed.value, detail: '' };
}

/**
 * Classifies `flag`'s value in `argv` against its declaration. Absent and present-with-nothing-usable are different
 * inputs, split the way `flagValue` already draws the line for the seam layer: undefined only for a genuinely absent
 * flag, a throw for the missing, empty and flag-shaped spellings. That rule is consulted here, not re-spelled
 * (helper-census.test.mjs pins its body to lib/seam-input.mjs). The throw is caught and turned into a classification,
 * so this never throws at its caller; `requireFlag` below is the throwing half.
 * Every occurrence is judged, not just the first. `flagValue` answers about the first spelling but planning.mjs's
 * `parseArgs` keeps the last, so a `refuse` row was bypassable by repeating the flag: `cursor set ... --name valid --name`
 * passed on `valid` and wrote boolean `true` as the phase name. The refusing occurrence wins wherever it sits, a
 * warning beats a clean one, and only then does the first occurrence's accepted value stand.
 * @param {string[]} argv the argument list, subcommand words included
 * @param {string} flag the flag as it is spelled on the command line (`--dir`)
 * @param {{required: boolean, type: string, value: string, bare: string}} spec
 * @returns {{ok: boolean, value: any, detail: string}} `ok:false` refuses, naming the flag in `detail`; `ok:true` with a `detail` is a warning
 */
export function evaluateFlag(argv, flag, spec) {
  // a boolean flag's grammar is presence: neither disposition can fire, and an absent one is false, not undefined
  if (spec.type === 'boolean') return { ok: true, value: argv.includes(flag), detail: '' };

  /** @type {{ok: boolean, value: any, detail: string}|undefined} */
  let first;
  /** @type {{ok: boolean, value: any, detail: string}|undefined} */
  let warned;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== flag) continue;
    const r = evaluateOccurrence(argv.slice(i), flag, spec);
    if (!r.ok) return r;
    if (r.detail && warned === undefined) warned = r;
    if (first === undefined) first = r;
  }
  if (warned !== undefined) return warned;
  if (first !== undefined) return first;
  return spec.required
    ? { ok: false, value: undefined, detail: flag }
    : { ok: true, value: undefined, detail: '' };
}

/**
 * The same classification raised, not returned, for the seven bins whose dispatch ends in an `e.seam` catch arm that
 * emits `{ok:false, reason:e.seam, detail:e.detail}` on one stdout line. They already read `--dir` through `flagValue`
 * and caught its throw, so a declared row costs no new control flow and mints no reason code: the refusal is
 * lib/seam-input.mjs's `missingFlagValue`, the `missing-flag-value` they already publish.
 * planning.mjs, route.mjs and config.mjs hold no such arm, and a throwing contract there would surface every
 * refusal as reason "internal" with detail "[object Object]", which is why `evaluateFlag` returns.
 * A `fallback` row never reaches the throw (ok:true, undefined value, so the caller's `|| default` answers). A `warn`
 * row would drop its diagnostic here, so no bin using this entry point declares one.
 * @param {string[]} argv @param {string} flag @param {{required: boolean, type: string, value: string, bare: string}} spec
 * @returns {any} the accepted value, or `undefined` for an absent or
 *   fallback-dispositioned flag. Never returns on the refusing path.
 */
export function requireFlag(argv, flag, spec) {
  const r = evaluateFlag(argv, flag, spec);
  if (!r.ok) throw missingFlagValue(r.detail);
  return r.value;
}

/**
 * Resolves a script's leading positional words to the subcommand key its table is filed under.
 * The bare form (no words, or a first word that is a flag) resolves to `''`, which stops a reader taking a first flag
 * for a subcommand: `weight.mjs --root <path>` reported `unknown-subcommand` until then. A second word is consumed
 * only when the table declares the two-word key, so `cursor set` resolves to `cursor set` and `recall some query` to
 * `recall`. planning.mjs and the prose lint both resolve here, so they reach the same row for the same words.
 * A key the table doesn't declare comes back as the first word, and the caller decides whether that's a refusal
 * (planning.mjs's `usage` line) or a report (the lint's `unknown-subcommand` problem).
 * @param {string[]} words the positional words, subcommand first
 * @param {Record<string, unknown>} table the script's `CONTRACTS` row
 * @returns {string} the table key, `''` for the bare form
 */
export function subcommandKey(words, table) {
  const [w1, w2] = words || [];
  if (!w1 || w1.startsWith('-')) return '';
  return w2 && table && Object.prototype.hasOwnProperty.call(table, `${w1} ${w2}`) ? `${w1} ${w2}` : w1;
}

/**
 * Applies a whole resolved row's value grammar to one argument list: the first refusal, or the accepted values.
 * A value door, not a presence door: it judges only the flags actually present and leaves an absent-but-required one to
 * the bin that owns the wording. That's review-provider.mjs's shipped position (its `parseArgs` skips a flag with
 * `if (!rest.includes(flag)) continue;`), and reversing it would swap diagnostics a declaration can't express
 * (`capture --kind must be one of todo | seed | note`) for one generic sentence. So `required` is a fact the table
 * states for bins that choose to read it, not a rule this door enforces.
 * The `'*'` row goes first because a script-global flag is what answers first today: planning.mjs refused a valueless
 * `--dir` before it looked at its subcommand. A key the table doesn't declare leaves only `'*'`, so an unknown
 * subcommand still falls through to the caller's usage refusal.
 * @param {string[]} argv the whole argument list, subcommand words included
 * @param {Record<string, Record<string, any>>} table one script's table
 * @param {string} key the subcommand key `subcommandKey` resolved
 * @returns {{ok: boolean, detail: string, values: Record<string, any>,
 *   warned: string[]}} `ok:false` refuses naming the flag; `values` holds accepted flags, `warned` those a `warn` row kept raw
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

/**
 * Answers the one presence question a `CONTRACTS` row can't state: does a flag's value oblige at least one of a set
 * of other flags. `evaluateRow` stays a value door; an unconditionally required flag needs the generic sentence it
 * rejects, while a conditional rule's diagnostic is exactly the flags it names.
 * Every occurrence of the conditioning flag is judged, because `parseArgs` keeps the last while an indexOf reader
 * answers about the first: `--event rearm --event gate_pass` would walk a settle event past a door that decided on `rearm`.
 * The value is compared as given, untrimmed, since `trace append` stores `--event` verbatim. Satisfaction is any one
 * required flag, never all: the seam's `recountReceipt` is what needs a complete triple, and demanding it here would
 * refuse a shape the seam accepts. No wording and no reason code, as with `evaluateRow`.
 * @param {string[]} argv the whole argument list, subcommand words included
 * @param {Record<string, {when: string, is: string[], requires: string[]}>|undefined} table
 *   one script's presence rules
 * @param {string} key the subcommand key `subcommandKey` resolved
 * @returns {{ok: boolean, flag: string, value: string, requires: string[]}}
 *   `ok:false` names the conditioning flag, its value, and the flags one of which is owed; all three are empty when accepted
 */
export function evaluatePresence(argv, table, key) {
  const pass = { ok: true, flag: '', value: '', requires: [] };
  const rule = (table || {})[key];
  if (!rule) return pass;
  /** @type {string|undefined} */
  let value;
  for (let i = 0; i < argv.length && value === undefined; i++) {
    if (argv[i] === rule.when && rule.is.includes(argv[i + 1])) value = argv[i + 1];
  }
  if (value === undefined) return pass;
  if (rule.requires.some((flag) => argv.includes(flag))) return pass;
  return { ok: false, flag: rule.when, value, requires: [...rule.requires] };
}

// --- the contract table: script -> subcommand -> flag -> grammar ------------
// Global flags allowed everywhere on a script sit under '*'.
// Every entry declares four fields and none defaults: `required`, `type`, `value` (a present but malformed value) and
// `bare` (present with nothing usable after it). The test walks every entry, so a row missing one reddens instead of
// picking up a silent default. The dispositions reproduce what ships and don't tidy it; the reasons sit on the rows.
// A `boolean` row's dispositions are inert, since presence is the whole grammar, and declared `fallback` anyway: an
// omitted field is the silent opt-out the completeness test exists to catch.
// Every top-level script under cadence-core/bin needs a row, because the prose lint skips a script it finds none for.
export const CONTRACTS = {
  'planning.mjs': {
    '*': {
      // empty --dir used to read as ./.planning, a tree the caller never named, so --dir and --root refuse it everywhere
      '--dir': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    status: {},
    'cursor get': {},
    // --next-file is --next's path transport, for the two sites that compose a resume pointer instead of a literal command
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
    // --fields-file is the path transport for the seven free-text fields as one JSON object; enum-validated flags get no file form
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
      '--job': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--commit': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
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
    // four bounds, not two: the context and roadmap criteria grammars have different ceilings, and one pair would state a bound one doesn't hold
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
    // --rerun is the caller's override; presence is its whole grammar, so boolean plus fallback on both axes like every bare flag
    'replay-check': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--rerun': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
    },
    'plan-size': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--max-reqs': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
      '--max-tasks': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
      '--max-bytes': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
    },
    // The read-back count: what the retrieval pass put in front of the planner against what the produced plan cites.
    // --payload is a file, never inline JSON (see adjudication): a retrieval envelope carries verbatim prose with arbitrary
    // quoting. It's optional because `memory.backend: none` skips retrieval and leaves no envelope to demand; the seam
    // qualifies the refusal by backend, a presence rule no declaration can state.
    // --point names which of the two count points a run records (after the planner returns, and on the plan as committed).
    // It's an enum the declaration can't express, so the seam refuses other values in its own bad-args vocabulary.
    'cite-count': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--payload': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--point': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    // --label-file is --label's path transport: an untagged close takes its label from the project's milestone name, which is repo content
    'milestone-prune': {
      '--label': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--label-file': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--mode': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    'seed-reqs': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
    },
    // --plan-time selects the plan-time arm: the same operation asked before an executor runs, against the plan's declared
    // lease and the census registry, instead of after the fact against the staged set. A flag, not a second word, because it's
    // the same operation at a different time. --plan stays required on both arms: each names a plan file on disk and
    // neither can resolve it without the flag, so a required-ness that varied by arm would state a bound one doesn't hold.
    'lease-check': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--plan': { required: true, type: 'int', value: 'refuse', bare: 'refuse' },
      '--plan-time': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
    },
    'detect-commands': {
      '--root': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    // the accepted testing policy's committed form; --root is the project root and copies detect-commands's row
    'test-policy render': {
      '--root': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    // --base is a ref the seam reads after --end-of-options so it can't act as a git option; a flag-shaped value is refused here too
    'test-policy check': {
      '--root': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--base': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    // a valueless --commit, --wait or --phase refuses, since each would otherwise silently read as the flag being absent
    'test-policy ci-status': {
      '--root': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--commit': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--wait': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
      '--phase': { required: false, type: 'phase', value: 'refuse', bare: 'refuse' },
    },
    // --answered carries the set a config layer already holds, so /cad-config --surfaces reaches the same option rule as the first ask
    'detect-surfaces': {
      '--root': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--answered': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    recall: {
      '--top': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
    },
    // The record a /cad-task run leaves under .planning/tasks/<slug>/, so recall and /cad-why can both reach it.
    // --slug is joined onto a directory path, so its grammar is a refusal, not a trim: one path segment or nothing written.
    // No declared type states that, so the seam refuses in its own bad-args vocabulary through lib/task-record.mjs's predicate.
    // --base and --head are both required, as on risk-check run: a defaulted head is a range the caller never stated, and
    // this record is the evidence of what shipped, so the commits and declared files are derived from the range.
    'task-record': {
      '--slug': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--base': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--head': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--text': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--text-file': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    // --join ties each record to the trace.jsonl dispatch bracket that caused it; off by default so existing readers' envelope is unchanged
    reads: {
      '--join': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
    },
    // The detection the blocking risk_surface gate fires on, and the record that proves it ran. --base and --head are both
    // required (a defaulted head is a range the caller never stated); --surfaces narrows to the project's resolved set and
    // refuses any token outside the eight rather than answering about a narrower one.
    // --head is `required: false` because it became optional: exactly one of --head <ref> and --staged names the scope, an
    // either-or the four fields can't state. risk-check run refuses both-or-neither itself, and a required --head here
    // would refuse the staged spelling before that check. --staged is boolean, so both axes are fallback.
    'risk-check run': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--plan': { required: false, type: 'plan-key', value: 'refuse', bare: 'refuse' },
      '--base': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--head': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--staged': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
      '--surfaces': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    // The completion gate. --phase alone keeps plan-level matching; the optional named range (--plan --base plus exactly one
    // of --head and --staged) requires a record for that scope, so an earlier narrower range of the same plan can't satisfy a
    // later one and a ref-range record can't satisfy a staged ask. --staged mirrors the run row; exactly-one is the seam's check.
    'risk-check status': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--plan': { required: false, type: 'plan-key', value: 'refuse', bare: 'refuse' },
      // optional here, required on run: the named range is all-or-none and the seam owns that rule
      '--base': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--head': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--staged': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
    },
    // The adjudication record a blocking or adjudicated gate fire leaves beside its sibling REVIEW-<trigger>-<discriminator>.md.
    adjudication: {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--trigger': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--discriminator': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      // --base and --head are both required, as on risk-check run; the seam resolves them to full ids instead of storing the caller's spelling
      '--base': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--head': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      // --payload is a file, never inline JSON: it's verbatim reviewer text with arbitrary quoting, and one unescaped quote in
      // a heredoc makes it unparseable after the adjudication is done (uat merge --payload is the precedent)
      '--payload': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      // --round is the blocking re-arm's round (references/triage-gate.md caps it at one). A re-arm is a second fire with the
      // same discriminator, so without it round two's record would replace round one's rulings, the self-overwriting evidence
      // #195 fixed for executor reports. Optional, default 1, so an ordinary fire keeps the sibling REVIEW file's name.
      '--round': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
      // --task names the task slug when the fire is a task's, so the record lands in .planning/tasks/<slug>/ beside its REVIEW
      // file and not in a phase directory that never exists (/cad-task fires with a phase of 0, which no roadmap phase carries).
      // Without it a blocking gate on a task can only be settled by hand. Optional: a phase fire passes nothing.
      '--task': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    // the queue member a deferred gate leaves beside its REVIEW file: findings on disk, nothing ruled yet. Same flags as adjudication, but two words
    'deferred record': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--trigger': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--discriminator': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--base': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--head': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--payload': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--round': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
      // no --task, unlike adjudication, on purpose: the queue-wide enumeration /cad-land reads walks the two phase homes only,
      // so a member under a task slug would be created and never found. A task's only gate is risk_surface, whose default is
      // blocking and never deferred, so refusing the shape loses nothing.
    },
    // The queue as a whole: every member with no ADJUDICATION sibling, across both homes. --phase is optional here, unlike
    // the rows above, because the writers name one fire while this reader answers /cad-land's question about the tree.
    // Absent means the whole tree; present narrows to one phase, and takes the phase type so `2` and `2.1` hit the spelled directory.
    'deferred list': {
      '--phase': { required: false, type: 'phase', value: 'refuse', bare: 'refuse' },
    },
    // The carry a milestone close runs before milestone-prune deletes the phase directory. --phase is required with no
    // whole-tree form: this face moves committed artifacts, and a mistyped or absent flag that carried every phase would
    // look the same as the one meant. The set it moves is what `deferred list --phase` returns, derived rather than named.
    'deferred carry': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
    },
    // The risk_surface rulings a milestone close carries out of the phase directory before milestone-prune deletes it, so
    // land-cleanup.mjs gate still has records to derive its verdict from. --phase is required with no whole-tree form, for
    // the reason `deferred carry` gives; the set it copies comes from the phase directory, so no argument can widen it.
    'risk-carry': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
    },
    'trace append': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--family': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--event': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      // --plan, --sha, --base and --detail fall back on both axes, the drop the shared body already performs, so every shipped
      // close without them stays ok:true. --step, --reviewer, --trigger and --role refuse a bare flag: a bare --role once wrote a
      // record that `trace render` then aggregated under the empty-string key.
      '--plan': { required: false, type: 'string', value: 'fallback', bare: 'fallback' },
      '--base': { required: false, type: 'string', value: 'fallback', bare: 'fallback' },
      '--sha': { required: false, type: 'string', value: 'fallback', bare: 'fallback' },
      '--detail': { required: false, type: 'string', value: 'fallback', bare: 'fallback' },
      // --detail-file is --detail's path transport: inline puts caller-derived text in a double-quoted shell word, where $(...) runs before Node starts
      '--detail-file': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--role': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      // --tokens falls back on the value axis alone, on both trace rows: the body accepts a strict comma-grouped integer
      // (146,405, the form this plugin prints token figures in) and refuses a negative one, which is wider than `int`. Refusing
      // rejected 146,405 after the dispatch half of the bracket was written and stranded the worker unpaired. The bare axis refuses.
      '--tokens': { required: false, type: 'int', value: 'fallback', bare: 'refuse' },
      // --raised is the adjudicated arm's raised-finding count, structured so a 0-of-0 fire and a 0-of-9 one stop reading alike
      '--raised': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
      // --survivors, --downgraded and --refuted are a fire's settled figures. --detail isn't a machine-join surface (one trigger
      // was spelled four ways in shipped events), so this row makes the flag the only structured route. The adjudication seam
      // derives them from the record's rulings, never by hand, which is how it can recount and refuse a disagreeing receipt.
      '--survivors': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
      '--downgraded': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
      '--refuted': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
      // --round names which round of a capped re-arm a receipt settles, so the recount reads that round's record, not round one's
      '--round': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
      // --read is one comma-separated value, never a repeated flag (parseArgs keeps only the last); elements are verbatim strings
      '--read': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      // --read-file is --read's path transport, split by the same comma grammar; not on close, since --read isn't either
      '--read-file': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      // --step names the workflow step a coordinator marker marks; the prose and the census keep it off a worker bracket
      '--step': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      // --reviewer names the reviewer that actually ran a fire, so a cross-model and a subagent fire of one trigger can be told apart
      '--reviewer': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      // --trigger names which review trigger an event belongs to so an outcome receipt joins to its fire; risk-check status demands one
      '--trigger': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      // --anchor names the window a receipt settles, as the sha its own phase_start carried. lib/trace.mjs derives a run's id off
      // the phase's newest anchor, so a settlement written after a re-anchor got the new window and could never settle the fire
      // under the old one (GH-227). The value is the sha, never a whole correlation id, so the id comes from the one derivation.
      // Refuses on both axes: a blank anchor reads as "no anchor" while the caller believes the receipt was bound. Nothing checks
      // the window exists; risk-check status's range check is what objects.
      '--anchor': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      // --authorization-id is the id of the human answer a receipt descends from, minted by the coordinator when the engineer
      // answers. One authorization applied to two ranges is two receipts, and nothing said they came from one decision; grouping
      // by --detail text missed a case of three (GH-220), so the id rides a declared flag and labels the pair without widening
      // what a receipt settles. Refuses on both axes, like --agent-id: a blank id reads as "no id" while the caller believes it was labelled.
      '--authorization-id': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    // The close half of a worker bracket. No --family or --event: the family is fixed to lifecycle in the seam and the arm is
    // inferred from --detail (present -> checkpoint, absent -> return), so a close site states what it closes and not how the
    // record spells it. The inference reads the resolved detail, so --detail-file selects checkpoint exactly as the inline form does.
    'trace close': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--plan': { required: false, type: 'string', value: 'fallback', bare: 'fallback' },
      '--role': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--tokens': { required: false, type: 'int', value: 'fallback', bare: 'refuse' },
      // --turns is the tool-call count off the same return as --tokens, a flag and not --detail text; close row only, like --raised on append
      '--turns': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
      // --duration-ms is string, not int, for the reason --tokens falls back on its value axis: the host prints "Done (N tool
      // uses - X tokens - Ys)", so the only copyable spelling is `1m 23s`, and an int row would refuse it after the dispatch half
      // of the bracket was written. The real grammar (plain ms, or number-plus-unit terms over h/m/s/ms) lives in the shared body,
      // which refuses anything outside it, so a mistyped duration appends nothing.
      '--duration-ms': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--detail': { required: false, type: 'string', value: 'fallback', bare: 'fallback' },
      '--detail-file': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--reviewer': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      // the host's own id for the worker this close belongs to; refuses like every join key, since a blank would read as "no id"
      '--agent-id': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      // this dispatch did no work because it was already in HEAD. Structured, not a --detail: the close arm infers
      // checkpoint vs return from --detail being non-blank, so a replay note there would bill a finished dispatch as unusable.
      // It rides the event only when true, so an ordinary close writes the bytes it always did.
      '--replay': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
    },
    // --events asks for the raw event array. The default is the paired brackets plus every outcome event, which is what both readers consume, in a fraction of the bytes.
    'trace render': {
      '--phase': { required: false, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--events': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
    },
    'trace suggest': {
      '--phase': { required: false, type: 'phase', value: 'refuse', bare: 'refuse' },
    },
    // The dispatch-window report: --phase alone, and the absence of every other flag is the point. The ceilings are config
    // (the six workflow.max_dispatch_tokens.<role> keys), so a flag naming a role or number would be a second, un-layered way
    // to set one and the report would disagree with the project's own bound. --phase only scopes which brackets are read.
    'trace window': {
      '--phase': { required: false, type: 'phase', value: 'refuse', bare: 'refuse' },
    },
    'trace ignore': {
      '--root': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--check': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
    },
    // --file overrides <dir>/CAPTURE.md for /cad-capture --cadence's global queue alone; no --section, since a caller that could name a heading is how five bullets landed outside the recall walk
    capture: {
      '--kind': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--text': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--text-file': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--phase': { required: false, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--file': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    // the read side of the same file, same --file override; no flag can hide a section, which is what lost five bullets
    'capture-sections': {
      '--file': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    // the health verdict over the same file; no flag names the bound (it's planning.max_capture_bullets), so a report never disagrees with the config
    'capture-check': {
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
    // check takes --global as the inspect face of the write-time refusal, and no --file row on purpose: the question is the user-global layer
    check: {
      '--global': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
    },
    set: {
      '--file': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--global': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
    },
    // unset selects its layer as set does, and the row has to exist because optFile reads the declaration; its keys are positional words
    unset: {
      '--file': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--global': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
    },
    // --global sits on every face that takes a file; it was live on get but undeclared, and stayed green only because no prose spelled it
    get: {
      '--file': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--global': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
    },
    // --walk narrows the read to the keys that hold a `question`; bare `keys` still returns the whole map
    keys: {
      '--walk': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
    },
  },
  'git-branch.mjs': {
    '*': {
      '--dir': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    decide: {
      // --branch, --base, --remote, --merged and --version fall back on the bare form: their seams read them through the permissive reader and answer `|| fallback`
      '--branch': { required: false, type: 'string', value: 'fallback', bare: 'fallback' },
    },
    // The read-only tags arm. No flags of its own: --dir is both where the question is asked from and the project root the
    // answer must belong to, so a second flag would be a way to ask one without the other, the upward discovery the bound closed.
    tags: {},
  },
  'git-publish.mjs': {
    '*': {
      '--dir': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    publish: {
      '--remote': { required: false, type: 'string', value: 'fallback', bare: 'fallback' },
    },
    'verify-publish': {
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
  // forge.mjs decides where issue writes go and issue-check.mjs reads that back at land time; --dir is spelled the same on both on purpose
  'forge.mjs': {
    '*': {
      '--dir': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    // detect stays the first non-'*' key: arg-contract-adoption.test.mjs tests the script-global --dir through the first face, and detect spawns no forge CLI
    detect: {},
    // The create face. Both selectors refuse on both axes: a valueless --provider would fall through to a table lookup on
    // undefined, a valueless --repo would name no repository, and this is the one subcommand here that mutates a forge.
    // --confirmed is boolean, so neither disposition can fire. It's `required: false` here and enforced in the seam, whose
    // refusal names the confirmation the caller owes the user, where a missing-flag-value would only name the flag.
    // --remote-url is required by the provider, not the row: two providers' pinned create argv wires no git remote and one
    // does, so the seam says which arm. It refuses on both axes: a valueless one would point origin at nothing.
    create: {
      '--provider': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--repo': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--confirmed': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
      '--remote-url': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
  },
  'issue-check.mjs': {
    '*': {
      '--dir': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    check: {
      '--base': { required: false, type: 'string', value: 'fallback', bare: 'fallback' },
      // --timeout-ms falls back on a malformed value too: that seam never fails a land, and an unbounded call is the one thing it may never do
      '--timeout-ms': { required: false, type: 'int', value: 'fallback', bare: 'fallback' },
    },
  },
  // The filing seam. Both faces take the same flag with the same grammar, and the row is written twice instead of hoisted
  // into '*': required-ness is per subcommand, and a third face without --payload would have to un-declare it out of '*'.
  // --payload refuses on both axes: it names the file the whole answer is read from, and there's no fallback that could be right.
  'issue-filing.mjs': {
    '*': {
      '--dir': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    unfixed: {
      '--payload': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    file: {
      '--payload': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
    },
  },
  'release-bump.mjs': {
    '*': {
      '--dir': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    bump: {
      // --version falls back on a bare spelling; --date refuses it, since release-bump.mjs hand-writes that check and a valueless --date mustn't silently date today
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
      // refuses on both axes, reversed from warn when this flag became a risk-floor input. The old disposition answered a typo
      // by flooring off the cursor's phase, a different phase's declared files, with nothing in the bundle to notice it by.
      // An absent flag still falls to the cursor: this is a value door.
      '--phase': { required: false, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--bracket-read': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--bracket-plan': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      // --plan narrows the risk floor's scope from the phase's union to one plan, which is what an executor dispatch floors on.
      // It refuses on both axes, unlike --bracket-plan: a valueless one would silently take the phase union for a caller asking
      // about one plan. It's a separate flag because that value is the trace worker key, the role name for every non-executor
      // dispatch, so a floor read off it couldn't tell a phase-scoped role from a plan key naming no file (union versus fail-closed).
      '--plan': { required: false, type: 'plan-key', value: 'refuse', bare: 'refuse' },
    },
    // the prefixed name for the two reviews that resolve no routing: they dispatch the base cad-reviewer, and a bare name is the user's to own
    'agent-type': {
      '--stem': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
    },
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
    // --trigger rides the provider trace event so a cross-model fire joins to its trigger, which tells it apart from the subagent fire. Review-only: a consult has no trigger.
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
    // '' is the bare form, `weight.mjs --root <path>`: without it the prose lint reads the first flag as the subcommand and reports unknown-subcommand on correct prose
    '': {},
    resident: {
      '--command': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--role': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
  },
  // self-verify.mjs has no subcommand, so it carries a bare row like the hooks below; its flag list is what the prose lint checks `self-verify.mjs --root <path>` against
  'self-verify.mjs': {
    '*': {
      '--root': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    '': {},
  },
  // git-guard.mjs is the commit hook: input on stdin, no flags, so the bare form allows none
  'git-guard.mjs': {
    '*': {},
    '': {},
  },

  // read-trace.mjs is the PostToolUse recorder: stdin input, no flags and no subcommand, like git-guard.mjs
  'read-trace.mjs': {
    '*': {},
    '': {},
  },
  // subagent-trace.mjs is the SubagentStop hook that closes a bracket the orchestrator opened: same empty shape as the hooks above
  'subagent-trace.mjs': {
    '*': {},
    '': {},
  },
  // skim.mjs takes a file as its positional argument, never a subcommand, so the bare row carries the whole flag set
  'skim.mjs': {
    '*': {},
    '': {
      '--stats': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
      '--no-numbers': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
    },
  },
  // why.mjs takes a query (<path>[:<line>]) as its positional argument, never a subcommand, so the bare row carries the whole
  // flag set, as skim.mjs does. --dir is the repository root and sits on '*' like every other seam's --dir/--root; --top is its entry cap.
  'why.mjs': {
    '*': {
      '--dir': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    '': {
      '--top': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
    },
  },
};

// --- the conditional presence rules: script -> subcommand -> one rule --------
// The second declared structure, read by `evaluatePresence` and nothing else, and never a fifth field in a row: `flagNames`
// is `Object.keys(row)`, the prose lint and `TRACE_GRAMMAR` read those as flag names, and arg-contract.test.mjs asserts a
// row holds exactly bare, required, type and value. `when` is the conditioning flag, `is` the values that arm it,
// `requires` the flags one of which must then be present, all declared on that subcommand's row so a misspelled one
// can't be a rule that silently never fires.
// The one rule: a review fire is settled by an adjudication, gate_pass or override receipt, and trace.mjs recounts the
// figures it settles on against the committed record. A gate_pass carrying none skipped that recount and cleared a
// blocking range while asserting nothing. rearm and deferral settle nothing, so they stay unbound.
// It lives at the argument door because trace.mjs carries no runtime refusal keyed to an event name.
export const PRESENCE_RULES = {
  'planning.mjs': {
    'trace append': {
      when: '--event',
      is: ['adjudication', 'gate_pass', 'override'],
      requires: ['--survivors', '--downgraded', '--refuted'],
    },
  },
};

/**
 * The flag names a row declares, for the prose lint that reads this table from the other side. It asks twice per
 * invocation it finds in prose, once for the subcommand's row and once for `'*'`, and unions them. Asking for names is
 * what lets one table serve the lint and the CLI refusals: a row is a value-grammar object, and a check that spread one
 * would read its four grammar fields as flag names.
 * @param {Record<string, any>|undefined} row
 * @returns {string[]}
 */
export function flagNames(row) {
  return row ? Object.keys(row) : [];
}
