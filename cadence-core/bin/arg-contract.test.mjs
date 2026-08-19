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
import { evaluateFlag, DISPOSITIONS, TYPES } from './lib/arg-contract.mjs';

const MODULE_URL = new URL('./lib/arg-contract.mjs', import.meta.url).href;

/** A complete spec, so each row below states only the field it is about. */
const spec = (over) => ({ required: false, type: 'string', value: 'refuse', bare: 'refuse', ...over });

// [name, argv, flag, spec, expected {ok, value, detail}, why]
const ROWS = [
  // --- the three dispositions on the VALUE axis -----------------------------
  ['value/refuse', ['--attempt', 'x'], '--attempt', spec({ type: 'int', value: 'refuse' }),
    { ok: false, value: undefined, detail: '--attempt' },
    'route.mjs refuses a non-integer --attempt with usage; a NaN reaching a routing decision is the #45 defect'],
  ['value/warn', ['--phase', '1.x'], '--phase', spec({ type: 'phase', value: 'warn' }),
    { ok: true, value: '1.x', detail: '--phase' },
    "route.mjs stores --phase RAW and warns: a usage refusal would route the phase LOWER than its own risk baseline"],
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
