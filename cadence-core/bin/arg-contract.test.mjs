// The stated table for the argument contract in lib/arg-contract.mjs (ARG-06).
// Run: node --test cadence-core/bin/arg-contract.test.mjs
//
// This tree's convention for a stated grammar is a unit table beside the seam
// cases (plan-key.test.mjs, lease-grammar.test.mjs and planning-files.test.mjs
// each say so in their own headers): the rows below ARE the grammar, one per
// spelling, each carrying the reason it exists. Only node: builtins.
//
// The six DISPOSITION rows are the load-bearing ones. Each of the three words
// is exercised on BOTH axes - a malformed value and a bare flag - because the
// two axes are declared separately (D-05) and a table that only proved one of
// them would leave the other free to be wired to the wrong arm.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  evaluateFlag, evaluateRow, evaluatePresence, subcommandKey,
  DISPOSITIONS, TYPES, CONTRACTS, PRESENCE_RULES, flagNames,
} from './lib/arg-contract.mjs';

const MODULE_URL = new URL('./lib/arg-contract.mjs', import.meta.url).href;

/** A complete spec, so each row below states only the field it is about. */
const spec = (over) => ({ required: false, type: 'string', value: 'refuse', bare: 'refuse', ...over });

// [name, argv, flag, spec, expected {ok, value, detail}, why]
const ROWS = [
  // --- the three dispositions on the VALUE axis -----------------------------
  ['value/refuse', ['--attempt', 'x'], '--attempt', spec({ type: 'int', value: 'refuse' }),
    { ok: false, value: undefined, detail: '--attempt' },
    'route.mjs refuses a non-integer --attempt with usage; a NaN reaching a routing decision is the #45 defect'],
  // A SYNTHETIC row: no shipped declaration says `warn` since route.mjs's
  // `--phase` flipped to `refuse` (CER-01 D-09). The arm is pinned here anyway -
  // the word stays in the vocabulary because it is a reasoned position, and an
  // unexercised branch is how the next flag that needs it would get `refuse` by
  // default instead of by decision.
  ['value/warn', ['--phase', '1.x'], '--phase', spec({ type: 'phase', value: 'warn' }),
    { ok: true, value: '1.x', detail: '--phase' },
    'the warn arm keeps the raw value and names the flag, so the caller can word the diagnostic and still resolve'],
  ['value/fallback', ['--timeout-ms', 'abc'], '--timeout-ms', spec({ type: 'int', value: 'fallback' }),
    { ok: true, value: undefined, detail: '' },
    "issue-check.mjs falls back to its constant: that seam's whole contract is that it never fails a land"],

  // --- the same three on the BARE axis --------------------------------------
  ['bare/refuse', ['status', '--dir'], '--dir', spec({ bare: 'refuse' }),
    { ok: false, value: undefined, detail: '--dir' },
    'a valueless --dir used to answer ok:true about a tree the caller never named (phase 2 D-01)'],
  ['bare/warn', ['resolve', '--phase'], '--phase', spec({ type: 'phase', bare: 'warn' }),
    { ok: true, value: undefined, detail: '--phase' },
    'the warn arm keeps resolving and says so, on the bare axis as on the value axis'],
  ['bare/fallback', ['close', '--base'], '--base', spec({ bare: 'fallback' }),
    { ok: true, value: undefined, detail: '' },
    "the drop-on-bare spread in planning.mjs's trace close body: the bare form reads as absent and the caller's default answers"],

  // --- what counts as BARE: three spellings, one answer ---------------------
  ['bare: nothing after it', ['--dir'], '--dir', spec({ bare: 'refuse' }),
    { ok: false, value: undefined, detail: '--dir' },
    'the trailing spelling a caller produces with an unset $TREE'],
  ['bare: an empty value', ['--dir', ''], '--dir', spec({ bare: 'refuse' }),
    { ok: false, value: undefined, detail: '--dir' },
    'quoted "$VAR" on an unset variable passes an EMPTY token, and it is the same refusal'],
  ['bare: a flag-shaped value', ['--role', '--attempt', '2'], '--role', spec({ bare: 'refuse' }),
    { ok: false, value: undefined, detail: '--role' },
    'route.mjs resolve --role --attempt 2 swallowed --attempt and answered unknown-role about it (D-13)'],

  // --- absent is NOT bare ---------------------------------------------------
  ['absent + optional', ['status'], '--dir', spec({ bare: 'refuse' }),
    { ok: true, value: undefined, detail: '' },
    "a genuinely absent flag lets the caller's own default answer - flagValue's line, consulted not re-spelled"],
  ['absent + required', ['run', '--phase', '2'], '--head', spec({ required: true }),
    { ok: false, value: undefined, detail: '--head' },
    'risk-check run requires --base and --head: a defaulted head is a range the caller never stated'],

  // --- a REPEATED flag: every occurrence is judged, not just the first ------
  // The bins disagree about which occurrence wins - planning.mjs's `parseArgs`
  // keeps the LAST, `flagValue` answers about the first - so a door reading one
  // position leaves the declaration bypassable by typing the flag twice.
  ['repeated: a later bare occurrence refuses', ['--name', 'valid', '--name'], '--name', spec({ bare: 'refuse' }),
    { ok: false, value: undefined, detail: '--name' },
    'cursor set --name valid --name passed on `valid` and wrote boolean `true` into STATE.md as the phase name'],
  ['repeated: a later malformed value refuses', ['--total', '5', '--total', 'abc'], '--total', spec({ type: 'cursor' }),
    { ok: false, value: undefined, detail: '--total' },
    'the value axis has the same hole as the bare one, and one fix closes both'],
  ['repeated: an EARLIER bare occurrence still refuses', ['--dir', '--dir', '.planning'], '--dir', spec({ bare: 'refuse' }),
    { ok: false, value: undefined, detail: '--dir' },
    'the refusing occurrence wins wherever it sits - a reader keeping the last one is not the only reader'],
  ['repeated: two well-formed values yield the FIRST', ['--dir', 'a', '--dir', 'b'], '--dir', spec({}),
    { ok: true, value: 'a', detail: '' },
    "no refusal fired, so flagValue's shipped answer stands rather than being re-picked"],
  ['repeated: a warning occurrence wins over a clean one', ['--phase', '1', '--phase', '1.x'], '--phase', spec({ type: 'phase', value: 'warn' }),
    { ok: true, value: '1.x', detail: '--phase' },
    'a declared warn that fires at the second spelling and is dropped is a rule the row states and nothing carries out'],

  // --- the type vocabulary, one accepted and one refused spelling each -------
  ['string accepts', ['--dir', '.planning'], '--dir', spec({}),
    { ok: true, value: '.planning', detail: '' }, 'the ordinary path value'],
  ['string refuses whitespace-only', ['--root', '   '], '--root', spec({}),
    { ok: false, value: undefined, detail: '--root' },
    'planning.mjs\'s --root guards carry a trim clause: --root "   " fell through to a no-root ENOENT'],
  ['int accepts', ['--tokens', '5'], '--tokens', spec({ type: 'int' }),
    { ok: true, value: 5, detail: '' }, 'requireInt returns the NUMBER, not the string'],
  ['int refuses an unsafe integer', ['--total', '9007199254740993'], '--total', spec({ type: 'int' }),
    { ok: false, value: undefined, detail: '--total' },
    'requireInt bounds range: this parses to a DIFFERENT number than the caller typed'],
  ['cursor accepts a whole number', ['--total', '5'], '--total', spec({ type: 'cursor' }),
    { ok: true, value: 5, detail: '' }, 'a total is a whole number STATE.md can hold'],
  ['cursor refuses a decimal', ['--total', '2.1'], '--total', spec({ type: 'cursor' }),
    { ok: false, value: undefined, detail: '--total' },
    'requireCursorNumber\'s plain form: totals are whole numbers only'],
  ['phase accepts a sub-phase', ['--phase', '2.1'], '--phase', spec({ type: 'phase' }),
    { ok: true, value: '2.1', detail: '' }, 'phase insertions are legitimate'],
  ['phase yields the CALLER\'s spelling', ['--phase', '1.10'], '--phase', spec({ type: 'phase' }),
    { ok: true, value: '1.10', detail: '' },
    'normalized to 1.1 it READ A DIFFERENT PHASE\'S DIRECTORY, silently, with ok:true'],
  ['phase refuses a non-number', ['--phase', 'two'], '--phase', spec({ type: 'phase' }),
    { ok: false, value: undefined, detail: '--phase' }, 'a directory component that names no phase'],
  ['plan-key accepts a worker key', ['--plan', '1-fix'], '--plan', spec({ type: 'plan-key' }),
    { ok: true, value: '1-fix', detail: '' },
    'the fix-pass key a coordinator actually bracketed (RSK-03)'],
  ['plan-key refuses outer whitespace', ['--plan', ' 1'], '--plan', spec({ type: 'plan-key' }),
    { ok: false, value: undefined, detail: '--plan' },
    '" 1" and "1" would reach the join as two rows'],
  ['boolean: present is true', ['insert', '--at', '3', '--dry-run'], '--dry-run', spec({ type: 'boolean' }),
    { ok: true, value: true, detail: '' }, 'the bare form IS the value'],
  ['boolean: absent is false', ['insert', '--at', '3'], '--dry-run', spec({ type: 'boolean' }),
    { ok: true, value: false, detail: '' }, 'not undefined: a boolean flag has no absent state to default'],
  ['boolean: a following flag is not its value', ['--undo', '--dir', 'x'], '--undo', spec({ type: 'boolean' }),
    { ok: true, value: true, detail: '' },
    'without a boolean type a door reading --undo would call its only spelling malformed'],
];

test('evaluateFlag: the stated table', () => {
  for (const [name, argv, flag, s, expected, why] of ROWS) {
    assert.deepEqual(evaluateFlag(argv, flag, s), expected, `${name} - ${why}`);
  }
});

// --- the row door, and the key it resolves a row by --------------------------

test('subcommandKey: the words a script was invoked with, resolved to its table key', () => {
  // A MOVE out of self-verify.mjs, not a second copy: the prose lint resolves
  // the same key for a spelling it finds in a workflow, and an adopting
  // dispatch has to reach the same row for the same words.
  const ROWS = [
    [['cursor', 'set'], 'cursor set', 'the six two-word families consume their second word'],
    [['deferred', 'record'], 'deferred record', 'the sixth family: the deferred queue takes three operations'],
    [['trace', 'append'], 'trace append', 'the same, on the family with the most rows'],
    [['uat', 'record'], 'uat record', 'the same'],
    [['risk-check', 'run'], 'risk-check run', 'a hyphenated first word is still one word'],
    [['renumber', 'insert'], 'renumber insert', 'the same'],
    [['status'], 'status', 'a one-word subcommand takes no second word'],
    [['recall', 'some', 'query'], 'recall', "recall's trailing words are its QUERY, not a sub-subcommand"],
    [['status', '--dir'], 'status', 'a flag after a one-word subcommand is a flag, not a key'],
    [[], '', 'no words at all is the bare form'],
    [['--root', 'x'], '', "the bare form's first token is a FLAG: reading it as a subcommand "
      + 'reported unknown-subcommand on correct prose like weight.mjs --root <path>'],
  ];
  for (const [words, key, why] of ROWS) {
    assert.equal(subcommandKey(words), key, `${JSON.stringify(words)} - ${why}`);
  }
});

test('evaluateRow: the first refusal, over the flags actually present', () => {
  const table = {
    '*': { '--dir': spec({}) },
    'cursor set': {
      '--phase': spec({ required: true, type: 'phase' }),
      '--name': spec({}),
      '--total': spec({ type: 'cursor' }),
    },
    'trace close': { '--plan': spec({ value: 'fallback', bare: 'fallback' }) },
    'trace render': { '--phase': spec({ type: 'phase', value: 'warn', bare: 'warn' }) },
  };
  const row = (argv, key) => evaluateRow(argv, table, key);

  // A declared flag that is ABSENT is not judged, even declared `required`:
  // the door is a VALUE door and the bin owns the absent-flag wording.
  const secondBare = row(['cursor', 'set', '--name'], 'cursor set');
  assert.equal(secondBare.ok, false);
  assert.equal(secondBare.detail, '--name',
    'the refusal names the flag that failed, not the first flag the row declares');

  // The accepted values come back keyed by flag, which is what lets the
  // dispatch read `--dir` off the door instead of off its own parse.
  const accepted = row(['cursor', 'set', '--phase', '1.10', '--total', '5'], 'cursor set');
  assert.deepEqual(accepted, { ok: true, detail: '',
    values: { '--phase': '1.10', '--total': 5 }, warned: [] });

  // A `fallback` bare flag is NOT refused and reads as absent, so every
  // shipped `trace close` written without a --plan keeps answering ok:true.
  assert.deepEqual(row(['trace', 'close', '--plan'], 'trace close'),
    { ok: true, detail: '', values: {}, warned: [] });

  // A `warn` row keeps its raw value and is NAMED, so the disposition cannot
  // be silently swallowed by a door that only knows refuse and accept.
  assert.deepEqual(row(['trace', 'render', '--phase', '1.x'], 'trace render'),
    { ok: true, detail: '', values: { '--phase': '1.x' }, warned: ['--phase'] });

  // The '*' row is evaluated FIRST: a script-global flag is what answers today,
  // and the first failing flag is the one the refusal names.
  assert.equal(row(['cursor', 'set', '--dir', '--name'], 'cursor set').detail, '--dir',
    'a refusing global flag wins over a refusing subcommand flag');

  // A key the table does not declare leaves only the '*' row, so an unknown
  // subcommand still falls through to the caller's own usage refusal.
  assert.equal(row(['bogus', '--name'], 'bogus').ok, true);
  assert.equal(row(['bogus', '--dir'], 'bogus').detail, '--dir');
});

// --- the conditional PRESENCE rule: a value that obliges another flag --------
//
// `evaluateRow` above answers nothing about an absent flag and that carve-out
// stands. This is the one presence question a row CANNOT state - does a flag's
// value oblige one of these other flags - declared in `PRESENCE_RULES` rather
// than written out at a dispatch. The rule today is the settle receipt: a
// `trace append` whose `--event` settles a review fire owes at least one of the
// figures it settles on. Without it, the exact call the first row below spells
// was appended over a record holding a survived blocker marked
// `overridden: true`, and `risk-check status` then reported the range
// `recorded` - a blocking range cleared by a receipt asserting nothing
// (RSK-08, UAT item 3).
//
// Same idiom as `ROWS` above: argv in, the whole answer out, one row per
// spelling, each carrying the reason it exists.

/** The shipped rules for the one script that declares any. */
const PRESENCE_TABLE = PRESENCE_RULES['planning.mjs'];

/** A `trace append` receipt with its fixed words and join keys already spelled. */
const receipt = (...tail) => ['trace', 'append', '--phase', '1', '--family', 'outcome',
  '--trigger', 'risk_surface', '--plan', '1', '--base', 'aaaaaaa', '--sha', 'bbbbbbb', ...tail];

/** The accepted answer: three empty fields, so no caller tests for undefined. */
const CLEAR = { ok: true, flag: '', value: '', requires: [] };

/** The refusal, naming the event that armed the rule and the flags owed. */
const owed = (value) => ({
  ok: false, flag: '--event', value, requires: ['--survivors', '--downgraded', '--refuted'],
});

// [name, argv, subcommand key, expected {ok, flag, value, requires}, why]
const PRESENCE_ROWS = [
  // --- each of the three settle events, carrying nothing --------------------
  ['gate_pass with no figure', receipt('--event', 'gate_pass'), 'trace append', owed('gate_pass'),
    'the measured hole: this exact call was appended and risk-check status then read the range `recorded`'],
  ['adjudication with no figure', receipt('--event', 'adjudication'), 'trace append', owed('adjudication'),
    'the record-writing receipt settles on the same three figures'],
  ['override with no figure', receipt('--event', 'override'), 'trace append', owed('override'),
    'the receipt that clears a halt is the one this rule most needs to bind'],

  // --- ANY ONE of the three satisfies it, never all three -------------------
  ['adjudication + --survivors', receipt('--event', 'adjudication', '--survivors', '0'), 'trace append', CLEAR,
    'this door recounts nothing - recountReceipt is what needs a complete triple, and it states its own refusal'],
  ['gate_pass + --downgraded', receipt('--event', 'gate_pass', '--downgraded', '0'), 'trace append', CLEAR,
    'the same answer off the second flag: demanding the full set here would refuse a shape the seam accepts'],
  ['override + --refuted', receipt('--event', 'override', '--refuted', '0'), 'trace append', CLEAR,
    'and off the third, so no one flag is secretly the only one that counts'],

  // --- the two receipt names that settle nothing ----------------------------
  ['rearm is unbound', receipt('--event', 'rearm'), 'trace append', CLEAR,
    "references/triage-gate.md's fenced re-arm receipt carries no figures by contract; binding it would refuse a documented line"],
  ['deferral is unbound', receipt('--event', 'deferral'), 'trace append', CLEAR,
    'the same, on the fifth receipt name: a deferral queues its findings and settles none of them'],

  // --- EVERY occurrence of the conditioning flag is judged ------------------
  ['a settle event in the LAST --event', receipt('--event', 'rearm', '--event', 'gate_pass'), 'trace append',
    owed('gate_pass'),
    "planning.mjs's parseArgs keeps the LAST occurrence, so a door reading only the first would store a figureless gate_pass"],
  ['a settle event in the FIRST --event', receipt('--event', 'gate_pass', '--event', 'rearm'), 'trace append',
    owed('gate_pass'),
    'the other order is judged too: the first CONDITIONED occurrence wins wherever it sits'],

  // --- the value is compared AS GIVEN, and only against the stated set ------
  ['a padded spelling is not this rule\'s business', receipt('--event', ' gate_pass '), 'trace append', CLEAR,
    'trace append stores --event verbatim and risk-check.mjs joins FIRE_RECEIPTS by exact string, so this settles nothing downstream'],
  ['an event outside the set', receipt('--event', 'phase_start'), 'trace append', CLEAR,
    'a lifecycle event settles no fire and owes no figure'],
  ['a bare --event at the end of argv', ['trace', 'append', '--event'], 'trace append', CLEAR,
    'the value door already refused this one; reading past the end of argv must not throw here'],

  // --- a subcommand no rule names ------------------------------------------
  ['a subcommand with no rule', ['trace', 'close', '--phase', '1', '--event', 'gate_pass'], 'trace close', CLEAR,
    'trace close fixes its own family and event and declares none of the three figures'],
];

test('evaluatePresence: the stated table', () => {
  for (const [name, argv, key, expected, why] of PRESENCE_ROWS) {
    assert.deepEqual(evaluatePresence(argv, PRESENCE_TABLE, key), expected, `${name} - ${why}`);
  }
  // A script the structure names no rules for at all, which is every script but
  // one: the answer is the same clear one, and reading it must not throw.
  assert.deepEqual(evaluatePresence(receipt('--event', 'gate_pass'), PRESENCE_RULES['route.mjs'], 'trace append'),
    CLEAR, 'an absent script table is no rules, not a crash');
});

test('the settle-receipt presence rule is declared, and every flag it names is on the same row', () => {
  // The `PINNED` idiom below, for the second structure: the reasons bind THESE
  // values, so a rule that quietly stopped arming on one of the three events
  // would be a guard nobody removed and nothing enforces.
  const rule = PRESENCE_TABLE['trace append'];
  assert.equal(rule.when, '--event');
  assert.deepEqual(rule.is, ['adjudication', 'gate_pass', 'override'],
    'the three receipts that SETTLE a fire - their figures are what trace.mjs recounts against the record');
  assert.deepEqual(rule.requires, ['--survivors', '--downgraded', '--refuted'],
    'the settled figures of that fire, any ONE of which arms the recount this door leaves to the seam');
  for (const settlesNothing of ['rearm', 'deferral']) {
    assert.equal(rule.is.includes(settlesNothing), false,
      `${settlesNothing} settles nothing and its fenced command in references/triage-gate.md carries no `
      + 'figures by contract, so arming on it would refuse a documented line');
  }

  // Every flag every rule names is declared on that same subcommand's own
  // CONTRACTS row. A misspelled one is a rule that silently never fires, and a
  // flag no row declares is a requirement self-verify check 2 reports the prose
  // for spelling.
  for (const [script, rules] of Object.entries(PRESENCE_RULES)) {
    for (const [sub, r] of Object.entries(rules)) {
      const row = (CONTRACTS[script] || {})[sub];
      assert.ok(row, `${script} ${sub}: a presence rule on a subcommand the table declares no row for`);
      for (const flag of [r.when, ...r.requires]) {
        assert.ok(row[flag], `${script} ${sub} ${flag}: named by a presence rule and declared by no row`);
      }
    }
  }
});

test('every disposition and every type in the table is one of the stated words', () => {
  for (const [name, , , s] of ROWS) {
    assert.ok(DISPOSITIONS.includes(s.value), `${name}: value disposition`);
    assert.ok(DISPOSITIONS.includes(s.bare), `${name}: bare disposition`);
    assert.ok(TYPES.includes(s.type), `${name}: type`);
  }
  assert.deepEqual([...DISPOSITIONS], ['refuse', 'warn', 'fallback'],
    'the vocabulary is exactly three words (D-04); a fourth is a rule some seam is about to restate');
});

test('ONE FLAT shape on both paths: ok, value and detail, never a discriminated union', () => {
  // D-11. tsconfig.ci.json runs checkJs with strict:false, where narrowing a
  // JSDoc union by its boolean literal does not happen, so a union costs every
  // adopting call site a cast - measured as a TS2339 at lib/text-flag-file.mjs's
  // first call site.
  const accepted = evaluateFlag(['--dir', '.planning'], '--dir', spec({}));
  const refused = evaluateFlag(['--dir'], '--dir', spec({}));
  const warned = evaluateFlag(['--phase', 'x'], '--phase', spec({ type: 'phase', value: 'warn' }));
  for (const [name, r] of [['accepted', accepted], ['refused', refused], ['warned', warned]]) {
    assert.deepEqual(Object.keys(r).sort(), ['detail', 'ok', 'value'], `${name} path`);
  }
  // The three answers are read off two fields, which is what makes the flat
  // shape sufficient: no caller needs a fourth key to tell them apart.
  assert.equal(refused.ok, false);
  assert.equal(accepted.ok === true && accepted.detail === '', true);
  assert.equal(warned.ok === true && warned.detail !== '', true);
});

test('the evaluator emits nothing: not one byte on stdout or stderr', () => {
  // The caller owns its envelope (D-10). lib/seam-io.mjs states stdout is the
  // single channel the seam layer parses, so a helper that wrote anything at
  // all would corrupt the one JSON line of whichever seam adopted it.
  const probe = `const m = await import(${JSON.stringify(MODULE_URL)});
    for (const s of [{ required: true, type: 'string', value: 'refuse', bare: 'refuse' },
                     { required: false, type: 'int', value: 'warn', bare: 'fallback' },
                     { required: false, type: 'boolean', value: 'refuse', bare: 'refuse' }]) {
      for (const argv of [[], ['--x'], ['--x', ''], ['--x', '--y'], ['--x', 'v'], ['--x', '3']]) {
        m.evaluateFlag(argv, '--x', s);
      }
    }`;
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', probe],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.equal(out, '', `the evaluator wrote to stdout: ${JSON.stringify(out)}`);
});

test('it never throws at its caller, whatever argv holds', () => {
  // flagValue THROWS for the missing, empty and flag-shaped spellings; this
  // module catches that and answers with a classification instead, because a
  // throwing contract in a file with no e.seam arm surfaces every argument
  // refusal as {"ok":false,"reason":"internal","detail":"[object Object]"}.
  for (const disposition of DISPOSITIONS) {
    for (const argv of [[], ['--x'], ['--x', ''], ['--x', '--y'], ['--x', 'v']]) {
      const r = evaluateFlag(argv, '--x', spec({ bare: disposition, value: disposition }));
      assert.equal(typeof r.ok, 'boolean', `${disposition} on ${JSON.stringify(argv)}`);
    }
  }
});

test('the module file itself is pure: no emit, no process, no filesystem', () => {
  const src = readFileSync(fileURLToPath(MODULE_URL), 'utf8');
  const body = src.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*')).join('\n');
  for (const token of ['process.', 'readFileSync(', 'writeFileSync(', 'console.', 'emit(']) {
    assert.ok(!body.includes(token), `lib/arg-contract.mjs must stay pure; found ${token}`);
  }
});

// --- the table itself: every row carries a complete grammar ------------------

test('every flag in every row declares a complete grammar', () => {
  // A row added later WITHOUT one must redden here rather than picking up a
  // silent default: a defaulted disposition is the same species of hole as a
  // deleted CONTRACTS row, which self-verify check 14 exists to catch from the
  // tree side. This is that check for the value grammar.
  let entries = 0;
  for (const [script, row] of Object.entries(CONTRACTS)) {
    for (const [sub, flags] of Object.entries(row)) {
      for (const flag of flagNames(flags)) {
        const at = `${script} ${sub || '(bare form)'} ${flag}`;
        const spec = flags[flag];
        assert.equal(typeof spec, 'object', `${at}: no grammar at all`);
        assert.equal(typeof spec.required, 'boolean',
          `${at}: required-ness is per SUBCOMMAND and must be stated, true or false`);
        assert.ok(TYPES.includes(spec.type), `${at}: type "${spec.type}" is outside ${TYPES.join(' | ')}`);
        assert.ok(DISPOSITIONS.includes(spec.value),
          `${at}: value disposition "${spec.value}" is outside ${DISPOSITIONS.join(' | ')}`);
        assert.ok(DISPOSITIONS.includes(spec.bare),
          `${at}: bare-flag disposition "${spec.bare}" is outside ${DISPOSITIONS.join(' | ')}`);
        assert.deepEqual(Object.keys(spec).sort(), ['bare', 'required', 'type', 'value'],
          `${at}: a fifth field is a rule this table states in two places`);
        entries += 1;
      }
    }
  }
  // The walk reached the whole table, so no arm above is vacuous.
  // CADENCE-CENSUS: arg-contract-flag-entries | asserts: the CONTRACTS table declares 198 flag entries across 20 top-level rows
  assert.equal(entries, 198, `the table declares ${entries} flag entries`);
  assert.equal(Object.keys(CONTRACTS).length, 20, 'one row per top-level bin script');
});

test('the declarations the CONTEXT decisions bind are the ones in the table', () => {
  // Not tidiness: each of these reverses a documented decision if it flips, and
  // the flip would be invisible - the contract is declarative, so a wrong word
  // here is a wrong REFUSAL at whichever seam adopts the row.
  const PINNED = [
    ['planning.mjs', '*', '--dir', { value: 'refuse', bare: 'refuse' },
      'AC1: --dir "" answered ok:true about a tree the caller never named'],
    ['self-verify.mjs', '*', '--root', { value: 'refuse', bare: 'refuse' },
      'the same rail on the linter that reports about a tree'],
    // REVERSED by CER-01 D-09, and pinned in its new direction for the same
    // reason it was pinned in the old one: the declaration IS the contract, so a
    // flip back would be a silently different refusal at route.mjs's door.
    ['route.mjs', 'resolve', '--phase', { value: 'refuse', bare: 'refuse' },
      'CER-01 D-09: --phase decides a risk FLOOR, and warn-and-continue answers a typo with a floor computed off another phase\'s declared files'],
    ['route.mjs', 'resolve', '--plan', { value: 'refuse', bare: 'refuse' },
      'CER-01 D-06: a valueless plan flag silently takes the phase UNION for a caller that asked about one plan'],
    ['issue-check.mjs', 'check', '--timeout-ms', { value: 'fallback', bare: 'fallback' },
      "D-04: this seam's whole contract is that it never fails a land"],
    ['land-cleanup.mjs', 'cleanup', '--merged', { value: 'fallback', bare: 'fallback' },
      "D-12: its seam's || fallback absorbs the valueless spelling today"],
    ['release-bump.mjs', 'bump', '--version', { bare: 'fallback' }, 'D-12'],
    ['release-bump.mjs', 'bump', '--date', { bare: 'refuse' },
      'a valueless --date must refuse rather than silently date today'],
    // The three UAT item 8 reproduced: each declared `refuse` while the CLI
    // wrote the boolean `true` through. Pinned here as well as exercised live
    // by arg-contract-adoption.test.mjs, because the census SKIPS an axis that
    // stops saying `refuse` - so without these rows the whole defect could be
    // re-opened by loosening the declaration rather than by loosening the door.
    ['planning.mjs', 'cursor set', '--name', { value: 'refuse', bare: 'refuse' },
      'UAT 8: the bare form wrote `Phase: 1 of 5 (true)` into STATE.md'],
    ['planning.mjs', 'uat init', '--sources', { value: 'refuse', bare: 'refuse' },
      'UAT 8: the bare form wrote `sources: true` into the UAT front-matter'],
    ['planning.mjs', 'uat record', '--reason', { value: 'refuse', bare: 'refuse' },
      'UAT 8: the bare form wrote `reason: true` into the file the gate merges onto'],
    ['planning.mjs', 'trace append', '--role', { bare: 'refuse' },
      'AC3/D-05: a bare --role wrote a record with no role key and render aggregated it under ""'],
    ['planning.mjs', 'trace append', '--step', { bare: 'refuse' }, 'D-05, the same arm'],
    ['planning.mjs', 'trace append', '--reviewer', { bare: 'refuse' }, 'D-05, the same arm'],
    ['planning.mjs', 'trace append', '--trigger', { bare: 'refuse' }, 'D-05, the same arm'],
    ['planning.mjs', 'trace close', '--plan', { bare: 'fallback' },
      'D-05: making it refuse starts refusing every shipped trace close that omits it'],
    ['planning.mjs', 'trace append', '--sha', { bare: 'fallback' }, 'D-05, the drop arm'],
    ['planning.mjs', 'trace append', '--base', { bare: 'fallback' }, 'D-05, the drop arm'],
  ];
  for (const [script, sub, flag, want, why] of PINNED) {
    const spec = CONTRACTS[script][sub][flag];
    for (const [field, value] of Object.entries(want)) {
      assert.equal(spec[field], value, `${script} ${sub} ${flag} ${field} - ${why}`);
    }
  }
  // Required-ness is per subcommand, and this pair is the case that proves it.
  assert.equal(CONTRACTS['planning.mjs']['risk-check run']['--head'].required, true,
    'a defaulted head is a range the caller never stated');
  assert.equal(CONTRACTS['planning.mjs']['risk-check status']['--head'].required, false,
    "status takes the triple all-three-or-none, so requiring --head would state a bound that face does not hold");
});

test('every declared spec is one the evaluator can actually apply', () => {
  // The table and the evaluator are two halves of one file, and this is the
  // seam between them: a type or disposition the evaluator has no arm for would
  // otherwise surface at whichever seam adopts the row, not here.
  for (const [script, row] of Object.entries(CONTRACTS)) {
    for (const [sub, flags] of Object.entries(row)) {
      for (const flag of flagNames(flags)) {
        for (const argv of [[], [flag], [flag, ''], [flag, '--other'], [flag, '1']]) {
          const r = evaluateFlag(argv, flag, flags[flag]);
          assert.deepEqual(Object.keys(r).sort(), ['detail', 'ok', 'value'],
            `${script} ${sub} ${flag} on ${JSON.stringify(argv)}`);
        }
      }
    }
  }
});
