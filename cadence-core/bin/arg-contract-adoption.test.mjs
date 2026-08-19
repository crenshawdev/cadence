// The ADOPTION census for lib/arg-contract.mjs's `CONTRACTS` (ARG-06).
// Run: node --test cadence-core/bin/arg-contract-adoption.test.mjs
//
// arg-contract.test.mjs asks whether the table is well formed. This asks the
// only other question that matters: does the SHIPPED CLI do what the row says.
// The two are not the same check and the gap between them is what this file
// exists to close - `planning.mjs` declared 98 rows, read two of them, and
// `cursor set --name` (bare) answered ok:true and wrote `Phase: 1 of 5 (true)`
// into STATE.md against a row that said `refuse`. A fix that migrates 96 rows
// by hand and leaves nothing to catch the 97th is that same defect one commit
// later, so the walk here is TOTAL rather than sampled: every entry of the
// table is either exercised against the real binary or counted as a skip with
// its reason, and the counts themselves are asserted.
//
// TWO ARMS, BOTH REFUSALS, because a refusal is the only disposition provable
// without running the command. For every entry whose `bare` is `refuse` the
// script is spawned with that subcommand's words and the flag as the LAST
// token; for every entry whose `value` is `refuse` the same invocation carries
// a malformed value chosen by the declared type. Each must exit 1 with one
// JSON line that is `ok:false` and that NAMES the flag.
//
// There is deliberately NO live `fallback` or `warn` arm. Proving either means
// the command RUNS, and `git-publish publish` and `milestone-prune` are
// mutations; both dispositions are pinned in-process in arg-contract.test.mjs
// instead, and each lives at a named flag by UAT item 4. The bound that leaves
// is stated rather than implied: a row added later declaring only `fallback`
// or `warn` has no refusal arm to exercise, so this census cannot catch one
// that nothing reads. It catches the REFUSALS, which is the class both UAT
// findings were in.
//
// Nothing here touches this repository's own `.planning`: every script that
// declares `--dir` is given one pointing at a scratch directory, and the one
// case that cannot take it - the entry whose flag IS `--dir`, which has to
// appear bare and alone or the earlier occurrence answers for it - refuses at
// the argument door before any tree is read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTRACTS, flagNames } from './lib/arg-contract.mjs';

const BIN = dirname(fileURLToPath(import.meta.url));

/**
 * One malformed sample per declared type: whitespace-only for `string` (the
 * trim clause planning.mjs's `--root` guards carried by hand), a non-numeric
 * spelling for the two numeric types, an out-of-grammar one for `phase`, and
 * outer whitespace for `plan-key`, whose grammar REFUSES rather than trims
 * because trimming would mint a second spelling of one worker key.
 *
 * Each is a value `flagValue` waves through - none is empty and none is
 * flag-shaped - so this arm exercises the VALUE axis and not the bare one.
 */
const MALFORMED = Object.freeze({
  string: '   ',
  int: 'abc',
  cursor: 'abc',
  phase: 'two',
  'plan-key': ' 1',
});

/**
 * One WELL-FORMED sample per declared type, for the repeat arm below. Each is
 * a value its type's classifier accepts, so an earlier occurrence of the flag
 * under test reads as a clean one and the refusal the arm asserts can only be
 * coming from the LATER, malformed occurrence.
 */
const WELL_FORMED = Object.freeze({
  string: 'x',
  int: '1',
  cursor: '1',
  phase: '1',
  'plan-key': '1',
});

/** A scratch tree, so no invocation can reach this repository's own .planning. */
const SCRATCH = mkdtempSync(join(tmpdir(), 'cad-adoption-'));
mkdirSync(join(SCRATCH, '.planning'), { recursive: true });
const SCRATCH_DIR = join(SCRATCH, '.planning');

/**
 * The words a `'*'`-row entry is exercised through. A script-global flag has
 * no invocation of its own, so it rides one of that script's own subcommands -
 * its BARE form where it declares a `''` row (`weight.mjs --root`), and
 * otherwise its first declared subcommand.
 * @param {string} script @returns {string[]}
 */
function hostWords(script) {
  const keys = Object.keys(CONTRACTS[script]).filter((k) => k !== '*');
  if (keys.includes('')) return [];
  return keys[0] === undefined ? [] : keys[0].split(' ');
}

/**
 * Spawn a script and return its exit status and its one stdout line.
 * @param {string} script @param {string[]} argv
 */
function run(script, argv) {
  try {
    const out = execFileSync(process.execPath, [join(BIN, script), ...argv],
      { encoding: 'utf8', cwd: SCRATCH, stdio: ['ignore', 'pipe', 'pipe'] });
    return { status: 0, out };
  } catch (e) {
    return { status: e.status, out: e.stdout || '' };
  }
}

/**
 * Every entry of the table, as the invocation that exercises it. `words` is
 * the subcommand the entry is filed under; `dir` says whether the script's own
 * `--dir` may be prefixed, which it may not when `--dir` is the flag under
 * test.
 */
function census() {
  /** @type {{script: string, sub: string, flag: string, spec: any, words: string[]}[]} */
  const rows = [];
  for (const [script, table] of Object.entries(CONTRACTS)) {
    for (const [sub, flags] of Object.entries(table)) {
      for (const flag of flagNames(flags)) {
        const words = sub === '*' ? hostWords(script) : (sub === '' ? [] : sub.split(' '));
        rows.push({ script, sub, flag, spec: flags[flag], words });
      }
    }
  }
  return rows;
}

/**
 * The argv for one entry on one axis, with the flag under test LAST.
 *
 * `repeat` prefixes a WELL-FORMED occurrence of that same flag. The bins do
 * not agree with each other on which occurrence wins - `planning.mjs`'s
 * `parseArgs` keeps the LAST while `flagValue` answers about the first - so a
 * door judging only one position leaves the declaration bypassable by typing
 * the flag twice: `cursor set --name valid --name` passed on `valid` and wrote
 * boolean `true` into STATE.md against the same row whose single-occurrence
 * spelling this census already proved. The arm is the whole table's rather
 * than that one case's, because the position a refusal happens to be provable
 * at is not a property any row declares.
 */
function argvFor(entry, axis, repeat) {
  const globalRow = CONTRACTS[entry.script]['*'];
  const prefix = globalRow['--dir'] && entry.flag !== '--dir' ? ['--dir', SCRATCH_DIR] : [];
  const earlier = repeat ? [entry.flag, WELL_FORMED[entry.spec.type]] : [];
  return [...entry.words, ...prefix, ...earlier, entry.flag,
    ...(axis === 'value' ? [MALFORMED[entry.spec.type]] : [])];
}

test('every declared REFUSAL is one the shipped CLI actually carries out', () => {
  const rows = census();
  let exercised = 0;
  let skippedBoolean = 0;
  let skippedDisposition = 0;
  const failures = [];

  for (const entry of rows) {
    if (entry.spec.type === 'boolean') {
      // Presence is a boolean flag's whole grammar, so neither axis can fire:
      // there is no value to be malformed and no bare form to be missing one.
      skippedBoolean += 1;
      continue;
    }
    for (const axis of ['bare', 'value']) {
      if (entry.spec[axis] !== 'refuse') { skippedDisposition += 1; continue; }
      for (const repeat of [false, true]) {
        const argv = argvFor(entry, axis, repeat);
        const where = `${entry.script} ${entry.sub || '(bare form)'} ${entry.flag} `
          + `[${axis}${repeat ? ', repeated' : ''}]`;
        const { status, out } = run(entry.script, argv);
        const lines = out.trim() === '' ? [] : out.trim().split('\n');
        let parsed;
        try { parsed = JSON.parse(lines[0] || ''); } catch { parsed = null; }
        if (status !== 1 || lines.length !== 1 || !parsed || parsed.ok !== false
          || !lines[0].includes(entry.flag)) {
          failures.push(`${where}: \`${argv.join(' ')}\` -> exit ${status}, `
            + `${lines.length} stdout line(s): ${JSON.stringify(out.slice(0, 200))}`);
        }
      }
      exercised += 1;
    }
  }

  assert.deepEqual(failures, [],
    `${failures.length} declared refusal(s) the shipped CLI does not carry out. A row `
    + 'that states a rule its own bin never applies is the ARG-06 defect written into '
    + 'the fix:\n' + failures.join('\n'));

  // The counts, asserted rather than reported, so an entry silently skipped
  // reddens here instead of passing vacuously. Two axes per non-boolean entry;
  // the pair below is that product split by whether the axis said `refuse`.
  const nonBoolean = rows.filter((r) => r.spec.type !== 'boolean').length;
  assert.equal(exercised + skippedDisposition, nonBoolean * 2,
    'every axis of every non-boolean entry is either exercised or counted as a skip');
  assert.equal(skippedBoolean + nonBoolean, rows.length,
    'the walk reached every entry of the table');
  assert.ok(exercised > 200,
    `only ${exercised} refusals exercised - the walk has gone quiet`);
});

test('the census reports what it exercised and what it skipped, and why', () => {
  // A census whose skips are invisible is a census that can be emptied without
  // anyone noticing. These are the same three counts the arm above asserts,
  // named so a reader knows what the green tick covers.
  const rows = census();
  const boolean = rows.filter((r) => r.spec.type === 'boolean');
  const nonBoolean = rows.filter((r) => r.spec.type !== 'boolean');
  const axes = nonBoolean.flatMap((r) => [r.spec.bare, r.spec.value]);
  const refusing = axes.filter((d) => d === 'refuse').length;
  const notRefusing = axes.length - refusing;
  console.log(`adoption census: ${refusing} declared refusals exercised against the `
    + `shipped CLI across ${rows.length} table entries; ${notRefusing} axes skipped as `
    + `fallback or warn (proving either means the command RUNS, and two of the owning `
    + `scripts mutate); ${boolean.length} boolean entries skipped on both axes `
    + `(presence is their whole grammar).`);
  assert.ok(refusing > 200 && boolean.length > 0 && notRefusing > 0,
    'the three populations are all non-empty, so no count above is a vacuous zero');
});
