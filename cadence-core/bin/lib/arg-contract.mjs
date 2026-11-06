// @ts-check
// arg-contract.mjs - the one statement of what a seam CLI's flags may be, and the one evaluator that classifies them.
// Every bin wrote its own refusals and they disagreed: `planning.mjs status --dir ''` said ok:true about a tree
// nobody named while `git-branch.mjs tags --dir ''` refused the same spelling.
// A bin runs its row at its dispatch door, and arg-contract-adoption.test.mjs reddens on a refusal nothing carries out.
// Value grammar only: it never refuses an undeclared flag (the prose lint owns that) and owns no wording. Pure, no I/O.
'use strict';

import { flagValue, missingFlagValue } from './seam-input.mjs';
import { requireInt, requireCursorNumber, requirePhaseArg } from './require-int.mjs';
import { requirePlanKey } from './plan-key.mjs';

// Three words, all positions already shipped; making every typed flag refuse would reverse two of them.
//   refuse    ok:false naming the flag, which lib/seam-input.mjs's `flagValue` does by hand.
//   warn      the value is kept raw and the caller records a warning. No row declares it today, but the arm stays
//             so the next such flag is a decision.
//   fallback  the flag reads as absent so the caller's own `|| default` answers. A dropped bare flag is fallback too.
export const DISPOSITIONS = Object.freeze(['refuse', 'warn', 'fallback']);

// Each type is an existing classifier, never a re-derived predicate: `int` is requireInt, `cursor` requireCursorNumber,
// `phase` requirePhaseArg, `plan-key` requirePlanKey. `string` is the non-blank rule planning.mjs hand-writes at its
// two `--root` guards. `boolean` is for flags whose bare form is the value (`--dry-run`, `--global`); without it a door
// would call the only spelling the flag has malformed.
export const TYPES = Object.freeze(['string', 'boolean', 'int', 'cursor', 'phase', 'plan-key']);

/**
 * Flattens a classifier's `{ok:true, <key>} | {ok:false}` union into the one flat shape this module speaks.
 * Not a JSDoc discriminated union: with `strict: false` in tsconfig.ci.json that pattern hit a TS2339.
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
 * `fallback` reads as absent without consulting the token: the old permissive reader took the next flag as a value
 * (`decide --branch --dir <p>` answered `--dir` as the branch name). helper-census.test.mjs pins this arm's body here.
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
 * Classifies `flag`'s value in `argv` against its declaration. Absent and present-with-nothing-usable differ:
 * `flagValue` answers undefined only for an absent flag and throws for the missing, empty and flag-shaped spellings.
 * Here that throw becomes a classification, so this never throws; `requireFlag` is the throwing half.
 * Every occurrence is judged: `flagValue` reads the first but `parseArgs` keeps the last, so a repeated flag
 * (`cursor set ... --name valid --name`) once slipped past a `refuse` row. A refusal wins wherever it sits,
 * then a warning beats a clean one.
 * @param {string[]} argv the argument list, subcommand words included
 * @param {string} flag the flag as it is spelled on the command line (`--dir`)
 * @param {{required: boolean, type: string, value: string, bare: string}} spec
 * @returns {{ok: boolean, value: any, detail: string}} `ok:false` refuses; `detail` on `ok:true` is a warning
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
 * The same classification raised, not returned, for the seven bins whose dispatch ends in an `e.seam` catch arm.
 * They already read `--dir` through `flagValue`, so a declared row adds no control flow and no reason code.
 * planning.mjs, route.mjs and config.mjs hold no such arm: a throw there would surface as reason "internal", so
 * they use `evaluateFlag`. A `fallback` row never reaches the throw; a `warn` row would drop its diagnostic here.
 * @param {string[]} argv
 * @param {string} flag
 * @param {{required: boolean, type: string, value: string, bare: string}} spec
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
 * The bare form (no words, or a first flag) is `''`, or `weight.mjs --root <path>` reports `unknown-subcommand`.
 * A second word counts only if the table declares the pair: `cursor set` is one key, `recall some query` is `recall`.
 * An undeclared key comes back as the first word, and the caller decides whether that's a refusal or a report.
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
 * A value door, not a presence door: it judges only the flags present and leaves a missing required one to the
 * bin that owns the wording, as review-provider.mjs does. So `required` is a fact the table states for bins that
 * read it, not a rule enforced here.
 * The `'*'` row goes first because planning.mjs refused a valueless `--dir` before it looked at its subcommand.
 * @param {string[]} argv the whole argument list, subcommand words included
 * @param {Record<string, Record<string, any>>} table one script's table
 * @param {string} key the subcommand key `subcommandKey` resolved
 * @returns {{ok: boolean, detail: string, values: Record<string, any>,
 *   warned: string[]}} `ok:false` refuses naming the flag; `values` are accepted flags, `warned` the raw `warn` ones
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
 * Answers the one presence question a `CONTRACTS` row can't state: does a flag's value oblige one of a set of others.
 * `evaluateRow` stays a value door; a conditional rule's diagnostic is exactly the flags it names.
 * Every occurrence of the conditioning flag is judged, since `parseArgs` keeps the last: `--event rearm --event
 * gate_pass` would walk a settle event past a door that decided on `rearm`.
 * Values compare untrimmed, and any one required flag satisfies the rule, not all.
 * @param {string[]} argv the whole argument list, subcommand words included
 * @param {Record<string, {when: string, is: string[], requires: string[]}>|undefined} table
 *   one script's presence rules
 * @param {string} key the subcommand key `subcommandKey` resolved
 * @returns {{ok: boolean, flag: string, value: string, requires: string[]}}
 *   `ok:false` names the flag, its value and the flags owed
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
// Every entry declares `required`, `type`, `value` and `bare`, none defaulted, so a missing field reddens in the test.
// The dispositions reproduce what ships and don't tidy it. A `boolean` row's are inert but declared `fallback` anyway.
// Every top-level script under cadence-core/bin needs a row, or the prose lint skips it.
export const CONTRACTS = {
  'planning.mjs': {
    '*': {
      // an empty --dir used to read as ./.planning, a tree nobody named, so --dir and --root refuse it everywhere
      '--dir': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    status: {},
    'cursor get': {},
    // --next-file carries --next's path for the two sites that compose a resume pointer, not a literal command
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
    // --fields-file carries the seven free-text fields as one JSON object; enum-validated flags get no file form
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
    // four bounds, not two: the context and roadmap criteria grammars have different ceilings
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
    // --rerun is the caller's override; presence is its whole grammar, so boolean plus fallback like every bare flag
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
    // The read-back count: what retrieval put in front of the planner against what the produced plan cites. --payload
    // is a file, never inline JSON: a retrieval envelope carries verbatim prose with arbitrary quoting. Optional
    // because `memory.backend: none` leaves no envelope, and the seam qualifies the refusal by backend. --point is an
    // enum the declaration can't express, so the seam refuses other values in its own bad-args vocabulary.
    'cite-count': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--payload': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--point': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    // --label-file is --label's path transport: an untagged close labels from the milestone name, which is repo content
    'milestone-prune': {
      '--label': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--label-file': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--mode': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    'seed-reqs': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
    },
    // --plan-time is the same operation asked before an executor runs, against the plan's declared lease and the
    // census registry, not after the fact against the staged set. A flag, not a second word. --plan stays required on
    // both arms, since neither can resolve a plan file without it.
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
    // --base is read after --end-of-options so it can't act as a git option; a flag-shaped value is refused here too
    'test-policy check': {
      '--root': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--base': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    // a valueless --commit, --wait or --phase refuses, or it would silently read as the flag being absent
    'test-policy ci-status': {
      '--root': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--commit': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--wait': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
      '--phase': { required: false, type: 'phase', value: 'refuse', bare: 'refuse' },
    },
    // --answered carries the set a layer already holds, so /cad-config --surfaces reaches the same option rule
    'detect-surfaces': {
      '--root': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--answered': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    recall: {
      '--top': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
    },
    // The record a /cad-task run leaves under .planning/tasks/<slug>/, so recall and /cad-why can both reach it.
    // --slug is joined onto a directory path, so it's one path segment or nothing written. No declared type states
    // that, so the seam refuses in its own bad-args vocabulary through lib/task-record.mjs's predicate. --base and
    // --head are both required, as on risk-check run: a defaulted head is a range the caller never stated.
    'task-record': {
      '--slug': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--base': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--head': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--text': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--text-file': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    // --join ties each record to its dispatch bracket in trace.jsonl; off by default so existing envelopes don't change
    reads: {
      '--join': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
    },
    // The detection the blocking risk_surface gate fires on, and the record that proves it ran. --surfaces narrows to
    // the project's set and refuses any token outside the eight. --base is required; a defaulted head is a range
    // nobody stated. --head is `required: false` because exactly one of --head <ref> and --staged names the scope, an
    // either-or the four fields can't state. risk-check run refuses both-or-neither. --staged is boolean, so both
    // axes are fallback.
    'risk-check run': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--plan': { required: false, type: 'plan-key', value: 'refuse', bare: 'refuse' },
      '--base': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--head': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--staged': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
      '--surfaces': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    // The completion gate. --phase alone keeps plan-level matching; the optional named range (--plan --base plus
    // exactly one of --head and --staged) needs a record for that scope, so an earlier narrower range can't satisfy a
    // later one. --staged mirrors the run row; exactly-one is the seam's check.
    'risk-check status': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--plan': { required: false, type: 'plan-key', value: 'refuse', bare: 'refuse' },
      // optional here, required on run: the named range is all-or-none and the seam owns that rule
      '--base': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--head': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--staged': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
    },
    // The adjudication record a blocking or adjudicated fire leaves beside its REVIEW-<trigger>-<discriminator>.md.
    adjudication: {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--trigger': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--discriminator': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      // --base and --head are both required, as on risk-check run; the seam stores full ids, not the caller's spelling
      '--base': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--head': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      // --payload is a file, never inline JSON: it's verbatim reviewer text, and one unescaped quote in a heredoc
      // makes it unparseable after the adjudication is done
      '--payload': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      // --round is the blocking re-arm's round (capped at one). A re-arm reuses the discriminator, so without it
      // round two's record would replace round one's rulings. Optional, default 1, so an ordinary fire keeps the
      // REVIEW file's name.
      '--round': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
      // --task names the task slug when a task fires, so the record lands in .planning/tasks/<slug>/, not in a
      // phase directory a task doesn't have (/cad-task has no phase). Optional: a phase fire passes nothing.
      '--task': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    // The adjudicated gate's REVIEW-<trigger>-<discriminator>.md: Markdown, six headings per survivor. --base and
    // --head ride the file's header; fireIdentity requires both, as it does for the record and the queue member.
    'review-file': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--trigger': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--discriminator': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--base': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--head': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      // a file, never inline: reviewer text carries arbitrary quoting
      '--payload': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--round': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
      '--task': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      // the correction face: marks survivor <n> re-ruled, the payload then being {ruling, found} and not the survivors
      '--mark': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
    },
    // A finished review-panel run to the record's payload and the review file's input. --run-file is the host's
    // `<session>/workflows/<run id>.json`, read whole because the completion notice cuts a long result short. --out-dir is
    // this run's scratch directory and must exist; the payload, the survivors and the kept answers land in it.
    // --answers-file is the main session's answers (voice, index, then a ruling and/or fix_commit, fix_file or overridden); each
    // call keeps what earlier ones were given in the out-dir, so a later answer replaces only its own finding's.
    'workflow-run': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--run-file': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--out-dir': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--answers-file': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      // --payload-ref is the fire's payload reference (step 2's), the read set every bracket carries: never empty.
      // The three --notice-* flags are the completion notice's run totals, billed as one bracket only when the run
      // file gives no per-agent rows. Whole numbers as the notice prints them, ungrouped.
      '--payload-ref': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--notice-tokens': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
      '--notice-turns': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
      '--notice-duration-ms': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
    },
    // take/release share one row's shape: --fire is `<trigger>-<discriminator>`, and release frees only a match
    'workflow-claim take': {
      '--fire': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    'workflow-claim release': {
      '--fire': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      // the id the winning take printed; release matches it, never the label. --stale is for a holder that has no id
      '--id': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--stale': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
    },
    // the queue member a deferred gate leaves beside its REVIEW file: findings on disk, nothing ruled yet
    'deferred record': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--trigger': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--discriminator': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--base': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--head': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--payload': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--round': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
      // no --task, unlike adjudication: the queue /cad-land reads walks the two phase homes only, so a member under a
      // task slug would never be found. A task's only gate is risk_surface, which is never deferred, so nothing is
      // lost.
    },
    // The queue as a whole: every member with no ADJUDICATION sibling, across both homes. --phase is optional here
    // because the writers name one fire and this reader answers about the tree. Present, it takes the phase type so
    // `2` and `2.1` hit the spelled directory.
    'deferred list': {
      '--phase': { required: false, type: 'phase', value: 'refuse', bare: 'refuse' },
    },
    // The carry a milestone close runs before milestone-prune deletes the phase directory. --phase is required with no
    // whole-tree form: a mistyped or absent flag that carried every phase would look like the one meant.
    'deferred carry': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
    },
    // The risk_surface rulings a milestone close carries out before milestone-prune deletes the phase directory, so
    // land-cleanup.mjs gate still has records to derive its verdict from. --phase is required, as on `deferred carry`.
    'risk-carry': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
    },
    'trace append': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--family': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      '--event': { required: true, type: 'string', value: 'refuse', bare: 'refuse' },
      // --plan, --sha, --base and --detail fall back on both axes, the drop the shared body already performs. --step,
      // --reviewer, --trigger and --role refuse a bare flag: a bare --role once wrote a record that `trace render`
      // aggregated under the empty-string key.
      '--plan': { required: false, type: 'string', value: 'fallback', bare: 'fallback' },
      '--base': { required: false, type: 'string', value: 'fallback', bare: 'fallback' },
      '--sha': { required: false, type: 'string', value: 'fallback', bare: 'fallback' },
      '--detail': { required: false, type: 'string', value: 'fallback', bare: 'fallback' },
      // --detail-file is --detail's path transport: inline, $(...) runs inside a double-quoted shell word
      '--detail-file': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--role': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      // --tokens falls back on the value axis alone, on both trace rows: the body takes a comma-grouped integer
      // (146,405, the form this plugin prints) and refuses a negative one, which is wider than `int`. Refusing
      // 146,405 once stranded a worker unpaired after the dispatch half was written. The bare axis refuses.
      '--tokens': { required: false, type: 'int', value: 'fallback', bare: 'refuse' },
      // --raised is the adjudicated arm's raised-finding count, so a 0-of-0 fire and a 0-of-9 one stop reading alike
      '--raised': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
      // --survivors, --downgraded and --refuted are a fire's settled figures. --detail isn't a machine-join surface
      // (one trigger was spelled four ways), so this is the only structured route. The seam derives them from the
      // record's rulings, which is how it can recount and refuse a disagreeing receipt.
      '--survivors': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
      '--downgraded': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
      '--refuted': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
      // --round names which round of a capped re-arm a receipt settles, so the recount reads that round's record
      '--round': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
      // --read is one comma-separated value, never a repeated flag (parseArgs keeps the last); elements are verbatim
      '--read': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      // --read-file is --read's path transport, same comma grammar; not on close, since --read isn't either
      '--read-file': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      // --step names the workflow step a coordinator marker marks; it stays off a worker bracket
      '--step': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      // --reviewer names the reviewer that ran a fire, so a cross-model and a subagent fire of one trigger differ
      '--reviewer': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      // --trigger names the trigger an event belongs to so a receipt joins its fire; risk-check status needs one
      '--trigger': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      // --anchor names the window a receipt settles, as the sha its own phase_start carried. lib/trace.mjs derives a
      // run's id off the phase's newest anchor, so a settlement after a re-anchor got the new window and could never
      // settle the old fire (GH-227). The value is the sha, never a whole correlation id. Refuses on both axes: a
      // blank anchor reads as "no anchor" while the caller believes the receipt was bound. risk-check status's range
      // check is what objects.
      '--anchor': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      // --authorization-id is the id of the human answer a receipt descends from, minted when the engineer answers. One
      // answer applied to two ranges is two receipts, and nothing said they came from one decision (GH-220). Refuses on
      // both axes, like --agent-id: a blank id reads as "no id" while the caller believes it was labelled.
      '--authorization-id': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    // The close half of a worker bracket. No --family or --event: the family is fixed to lifecycle in the seam and
    // the arm is inferred from --detail (present -> checkpoint, absent -> return). The inference reads the resolved
    // detail, so --detail-file selects checkpoint exactly as the inline form does.
    'trace close': {
      '--phase': { required: true, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--plan': { required: false, type: 'string', value: 'fallback', bare: 'fallback' },
      '--role': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--tokens': { required: false, type: 'int', value: 'fallback', bare: 'refuse' },
      // --turns is the tool-call count off the same return as --tokens; close row only, like --raised on append
      '--turns': { required: false, type: 'int', value: 'refuse', bare: 'refuse' },
      // --duration-ms is string, not int, like --tokens: the host prints "Done (N tool uses - X tokens - Ys)", so the
      // only copyable spelling is `1m 23s`. The real grammar (plain ms, or number-plus-unit terms) lives in the
      // shared body, which refuses anything outside it, so a typo appends nothing.
      '--duration-ms': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--detail': { required: false, type: 'string', value: 'fallback', bare: 'fallback' },
      '--detail-file': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--reviewer': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      // the host's id for the worker this close belongs to; refuses like every join key, since a blank reads as "no id"
      '--agent-id': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      // this dispatch did no work because it was already in HEAD. Structured, not a --detail: the close arm infers
      // checkpoint vs return from --detail being non-blank, so a replay note there would bill a finished dispatch as
      // unusable. It rides the event only when true, so an ordinary close writes the bytes it always did.
      '--replay': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
    },
    // --events asks for the raw event array; the default is paired brackets plus the outcome events, in fewer bytes
    'trace render': {
      '--phase': { required: false, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--events': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
    },
    'trace suggest': {
      '--phase': { required: false, type: 'phase', value: 'refuse', bare: 'refuse' },
    },
    // The dispatch-window report: --phase alone, and the absence of every other flag is the point. The ceilings are
    // config (the six workflow.max_dispatch_tokens.<role> keys), so a flag naming a role or number would be a second,
    // un-layered way to set one and the report would disagree with the project's own bound. --phase only scopes which
    // brackets are read.
    'trace window': {
      '--phase': { required: false, type: 'phase', value: 'refuse', bare: 'refuse' },
    },
    'trace ignore': {
      '--root': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--check': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
    },
    // --file overrides <dir>/CAPTURE.md for the global queue; no --section, or bullets land outside the recall walk
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
    // the health verdict over the same file; no flag names the bound, it's planning.max_capture_bullets
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
    // check takes --global to inspect the write-time refusal; no --file row, since the question is the global layer
    check: {
      '--global': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
    },
    set: {
      '--file': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--global': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
    },
    // unset picks its layer as set does and needs a row because optFile reads it; its keys are positional words
    unset: {
      '--file': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--global': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
    },
    // --global is on every face that takes a file; it was live on get but undeclared, and no prose spelled it
    get: {
      '--file': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--global': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
    },
    // --walk narrows the read to the keys that hold a `question`; bare `keys` still returns the whole map
    keys: {
      '--walk': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
    },
    // reads no flag: the repo is the cwd and the global layer is CADENCE_GLOBAL_CONFIG
    'workflow-layers': {},
    // the menu's read of where each setting's value comes from; the repo is the cwd, a group name or a dotted key narrows it
    layers: {
      '--group': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--advanced': { required: false, type: 'boolean', value: 'fallback', bare: 'fallback' },
      '--key': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
  },
  'git-branch.mjs': {
    '*': {
      '--dir': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    decide: {
      // --branch, --base, --remote, --merged and --version fall back on the bare form: their seams answer `|| fallback`
      '--branch': { required: false, type: 'string', value: 'fallback', bare: 'fallback' },
    },
    // The read-only tags arm. No flags of its own: --dir is both where the question is asked from and the project
    // root the answer must belong to, so a second flag would ask one without the other.
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
  // forge.mjs decides where issue writes go and issue-check.mjs reads that back at land; --dir is spelled alike on both
  'forge.mjs': {
    '*': {
      '--dir': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
    // detect stays the first non-'*' key: arg-contract-adoption.test.mjs tests the global --dir through it
    detect: {},
    // The create face. Both selectors refuse on both axes: a valueless --provider would look up undefined, a
    // valueless --repo would name no repository, and this is the one subcommand here that mutates a forge.
    // --confirmed is `required: false` here and enforced in the seam, whose refusal names the confirmation the caller
    // owes the user. --remote-url is required by the provider, not the row, so the seam says which arm; a valueless
    // one would point origin at nothing.
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
      // --timeout-ms falls back on a malformed value too: that seam never fails a land or makes an unbounded call
      '--timeout-ms': { required: false, type: 'int', value: 'fallback', bare: 'fallback' },
    },
  },
  // The filing seam. Both faces take the same flag with the same grammar, and the row is written twice, not hoisted
  // into '*': a third face without --payload would have to un-declare it. --payload refuses on both axes: it names
  // the file the whole answer is read from, and no fallback could be right.
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
      // --version falls back on a bare spelling; --date refuses it, or a valueless --date would silently date today
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
      // refuses on both axes, reversed from warn when this flag became a risk-floor input: the old disposition
      // answered a typo by flooring off the cursor's phase, a different phase's files, with nothing in the bundle to
      // notice it. An absent flag still falls to the cursor: this is a value door.
      '--phase': { required: false, type: 'phase', value: 'refuse', bare: 'refuse' },
      '--bracket-read': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--bracket-plan': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      // --plan narrows the risk floor's scope from the phase's union to one plan, which is what an executor dispatch
      // floors on. It refuses on both axes, unlike --bracket-plan: a valueless one would silently take the phase
      // union for a caller asking about one plan. It's a separate flag because --bracket-plan is the trace worker
      // key, the role name for every non-executor dispatch, which can't tell a phase-scoped role from a plan key
      // naming no file.
      '--plan': { required: false, type: 'plan-key', value: 'refuse', bare: 'refuse' },
    },
    // the prefixed name for the two reviews that resolve no routing: they dispatch the base cad-reviewer
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
    // --trigger rides the provider trace event so a cross-model fire joins its trigger. Review-only: consults have none
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
    // '' is the bare form, `weight.mjs --root <path>`: without it the prose lint reads the first flag as the subcommand
    '': {},
    resident: {
      '--command': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
      '--role': { required: false, type: 'string', value: 'refuse', bare: 'refuse' },
    },
  },
  // self-verify.mjs has no subcommand, so it carries a bare row like the hooks below; the prose lint checks its flags
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
  // subagent-trace.mjs is the SubagentStop hook that closes a bracket the orchestrator opened; empty like the others
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
  // why.mjs takes a query (<path>[:<line>]) as its positional argument, never a subcommand, so the bare row carries
  // the whole flag set, as skim.mjs does. --dir is the repository root and sits on '*' like every seam's
  // --dir/--root; --top is its entry cap.
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
// The second declared structure, read by `evaluatePresence` alone, and never a fifth field in a row, since the prose
// lint reads a row's keys as flag names.
// The one rule: a review fire is settled by an adjudication, gate_pass or override receipt, and trace.mjs recounts the
// figures against the committed record. A gate_pass carrying none once cleared a blocking range asserting nothing.
// It lives at the argument door because trace.mjs has no runtime refusal keyed to an event name.
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
