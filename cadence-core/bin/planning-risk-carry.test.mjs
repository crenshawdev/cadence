// Zero-dep tests for `planning.mjs risk-carry` - the risk_surface rulings out
// of the phase directory a milestone close deletes (LND-02). Run:
// node --test 'cadence-core/bin/*.test.mjs'
//
// WHAT THIS SEAM HAS TO GET RIGHT, and why each arm below exists. The gate at
// `land-cleanup.mjs gate` derives its close verdict from adjudication records,
// and `milestone-prune --mode delete` removes `phases/<N>/` whole. Without a
// carry the rulings are gone before the chained `/cad-land` reads them, and the
// only two outcomes are both bad: every carried review reads as unruled and
// halts (D-03), or the gate is handed nothing and merges a live blocker.
//
// The fixtures are built by hand rather than through a repository, because
// nothing this seam does asks git a question: it copies named files between two
// directories under one planning root.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync,
  symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLANNING, makeTree } from './planning.test.mjs';

/** The close gate this carry exists to keep fed. */
const LAND = fileURLToPath(new URL('./land-cleanup.mjs', import.meta.url));
/** A hermetic user-global config layer, so no arm reads the dev's real one. */
const NO_GLOBAL = join(mkdtempSync(join(tmpdir(), 'cad-risk-carry-global-')), 'global.json');

/** A bare `.planning` root with `phases/<phase>/` holding `files`. */
function carryTree(phase, files) {
  const dir = join(mkdtempSync(join(tmpdir(), 'cad-risk-carry-')), '.planning');
  const pdir = join(dir, 'phases', String(phase));
  mkdirSync(pdir, { recursive: true });
  for (const [name, body] of Object.entries(files)) writeFileSync(join(pdir, name), body);
  return dir;
}

/** Run the carry face and parse its one JSON line. */
function riskCarry(dir, args) {
  let stdout;
  let code = 0;
  try {
    stdout = execFileSync('node', [PLANNING, '--dir', dir, 'risk-carry', ...args],
      { encoding: 'utf8' });
  } catch (e) { stdout = e.stdout; code = e.status; }
  return { ...JSON.parse(stdout), _exit: code };
}

/** What actually landed under `risk-carry/<phase>/`, sorted; `[]` when absent. */
const carried = (dir, phase) => {
  const d = join(dir, 'risk-carry', String(phase));
  return existsSync(d) ? readdirSync(d).sort() : [];
};

/** The two stems a risk_surface fire leaves, with `round` in the name. */
const review = (disc, round = 1) => `REVIEW-risk_surface-${disc}${round > 1 ? `-r${round}` : ''}.md`;
const record = (disc, round = 1) => `ADJUDICATION-risk_surface-${disc}${round > 1 ? `-r${round}` : ''}.json`;

/** An adjudication record body carrying `entries`. */
const recordBody = (disc, round, entries) => `${JSON.stringify({
  trigger: 'risk_surface', discriminator: disc, round, entries,
})}\n`;

/** One record entry: a survivor at `severity` unless a `fix_commit` clears it. */
const entry = (over) => ({
  file: 'cadence-core/bin/lib/adjudication-record.mjs',
  line: 460,
  severity: 'high',
  ruling: 'survived',
  claim: 'the raised severity is stored without its fix',
  ...over,
});

// --- what moves, and what deliberately does not ------------------------------

test('risk-carry: the risk_surface artifacts arrive and every other record stays put', () => {
  // The SCOPE rail. A `plan` or `diff` record carried into this set would halt
  // closes on findings the land has never halted on, and a `DEFERRED-*.json` is
  // the other queue's member with its own carry and its own gate.
  const dir = carryTree(3, {
    [review('plan-1')]: '{"findings":[]}\n',
    [record('plan-1')]: recordBody('plan-1', 1, [entry()]),
    'ADJUDICATION-diff-plan-1.json': '{"trigger":"diff"}\n',
    'ADJUDICATION-plan-cad-plan-abc1234.json': '{"trigger":"plan"}\n',
    'REVIEW-diff-plan-1.md': '{"findings":[]}\n',
    'DEFERRED-risk_surface-plan-9.json': '{"trigger":"risk_surface"}\n',
    'SUMMARY.md': '# summary\n',
  });

  const r = riskCarry(dir, ['--phase', '3']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.copied, 2);
  assert.equal(r.skipped, 0);
  assert.deepEqual(carried(dir, 3), [record('plan-1'), review('plan-1')].sort());

  // Everything else is still in the phase directory, where the prune takes it.
  for (const left of ['ADJUDICATION-diff-plan-1.json', 'ADJUDICATION-plan-cad-plan-abc1234.json',
    'REVIEW-diff-plan-1.md', 'DEFERRED-risk_surface-plan-9.json', 'SUMMARY.md']) {
    assert.equal(existsSync(join(dir, 'phases', '3', left)), true, `${left} was consumed`);
    assert.equal(existsSync(join(dir, 'risk-carry', '3', left)), false, `${left} was carried`);
  }
});

test('risk-carry: a COPY - the originals are still where they were', () => {
  // Where this departs from `deferred carry`'s move, and the reason is
  // `--mode archive`: this destination is transient and the close deletes it,
  // so a move would strip `_archive-<label>/<N>/` of the records `/cad-why`
  // reads there.
  const dir = carryTree(3, {
    [review('plan-1')]: '{"findings":[]}\n',
    [record('plan-1')]: recordBody('plan-1', 1, [entry()]),
  });
  assert.equal(riskCarry(dir, ['--phase', '3']).ok, true);
  assert.deepEqual(readdirSync(join(dir, 'phases', '3')).sort(),
    [record('plan-1'), review('plan-1')].sort());
});

test('risk-carry: EVERY round arrives, not the highest one alone', () => {
  // D-08, measured on `_archive-v3.7.3/1/`: that fire has a round-one record of
  // 4 entries and a round-two of 3, and 2 of the review file's 6 findings appear
  // in round one and nowhere else. The highest round is not the record of the
  // fire, so a carry that took it alone would drop them.
  const dir = carryTree(3, {
    [review('plan-1')]: '{"findings":[]}\n',
    [review('plan-1', 2)]: '{"findings":[]}\n',
    [record('plan-1')]: recordBody('plan-1', 1, [entry({ line: 1 })]),
    [record('plan-1', 2)]: recordBody('plan-1', 2, [entry({ line: 2 })]),
    [record('plan-2')]: recordBody('plan-2', 1, [entry({ line: 3 })]),
  });
  const r = riskCarry(dir, ['--phase', '3']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.copied, 5);
  assert.deepEqual(carried(dir, 3),
    [review('plan-1'), review('plan-1', 2), record('plan-1'), record('plan-1', 2),
      record('plan-2')].sort());
});

test('risk-carry: a re-run finishes the job instead of refusing it', () => {
  // A close re-runs this carry after a partial one, and a seam that refused on
  // a byte-identical file it wrote itself would be a refusal storm with no
  // remedy the caller could apply. Already-carried is SKIPPED, not re-copied.
  const dir = carryTree(3, { [review('plan-1')]: '{"findings":[]}\n' });
  assert.equal(riskCarry(dir, ['--phase', '3']).copied, 1);

  writeFileSync(join(dir, 'phases', '3', record('plan-1')),
    recordBody('plan-1', 1, [entry()]));
  const again = riskCarry(dir, ['--phase', '3']);
  assert.equal(again.ok, true, JSON.stringify(again));
  assert.equal(again.copied, 1, 'the new record was not carried');
  assert.equal(again.skipped, 1, 'the already-carried review was copied a second time');
  assert.deepEqual(again.carried.map((c) => c.to), [`risk-carry/3/${record('plan-1')}`]);
  assert.deepEqual(carried(dir, 3), [record('plan-1'), review('plan-1')].sort());
});

test('risk-carry: a DIFFERING destination file refuses, and copies nothing', () => {
  // The other half of the arm above. A file under that name holding different
  // bytes is another fire's record of what was ruled, or a hand edit, and this
  // seam overwrites neither - checked for EVERY member before the first write,
  // so a collision refuses the whole carry rather than leaving half of one fire
  // at each home.
  const dir = carryTree(3, {
    [review('plan-1')]: '{"findings":[]}\n',
    [record('plan-1')]: recordBody('plan-1', 1, [entry()]),
  });
  mkdirSync(join(dir, 'risk-carry', '3'), { recursive: true });
  writeFileSync(join(dir, 'risk-carry', '3', record('plan-1')), '{"entries":[]}\n');

  const r = riskCarry(dir, ['--phase', '3']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'carry-exists');
  assert.match(r.detail, new RegExp(`risk-carry/3/${record('plan-1')} already exists`));
  assert.deepEqual(carried(dir, 3), [record('plan-1')],
    'the refusal carried the OTHER member anyway, splitting one fire across two homes');
  assert.equal(readFileSync(join(dir, 'risk-carry', '3', record('plan-1')), 'utf8'),
    '{"entries":[]}\n', 'the standing record was overwritten');
});

// --- the destination rails ---------------------------------------------------

test('risk-carry: a symlink squatting the destination is refused, never followed', () => {
  const dir = carryTree(3, { [review('plan-1')]: '{"findings":[]}\n' });
  mkdirSync(join(dir, 'risk-carry'), { recursive: true });
  mkdirSync(join(dir, 'elsewhere'));
  symlinkSync(join(dir, 'elsewhere'), join(dir, 'risk-carry', '3'));

  const r = riskCarry(dir, ['--phase', '3']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'carry-dest-unusable');
  assert.match(r.detail, /would follow out of the planning root/);
  assert.deepEqual(readdirSync(join(dir, 'elsewhere')), []);
});

test('risk-carry: a symlink squatting the PARENT is refused too', () => {
  // `lstatSync` does not follow the FINAL component and follows every one
  // before it, so a check aimed at `risk-carry/<N>` alone answers "absent, go
  // ahead" while `risk-carry/` is already a link out of the tree - and the
  // recursive mkdir then builds the phase directory THERE and the copy fills
  // it. Two levels down takes two checks.
  const dir = carryTree(3, { [review('plan-1')]: '{"findings":[]}\n' });
  mkdirSync(join(dir, 'elsewhere'));
  symlinkSync(join(dir, 'elsewhere'), join(dir, 'risk-carry'));

  const r = riskCarry(dir, ['--phase', '3']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'carry-dest-unusable');
  assert.match(r.detail, /would follow out of the planning root/);
  assert.deepEqual(readdirSync(join(dir, 'elsewhere')), [],
    'the carry built its destination outside the planning root');
  assert.equal(existsSync(join(dir, 'phases', '3', review('plan-1'))), true);
});

test('risk-carry: a mistyped phase spelling refuses before anything is copied', () => {
  // The tree-aware check, right after the parse: on a tree carrying both
  // `phases/1.1/` and `phases/1.10/`, `--phase 1.10` would read one directory
  // and report `phase: 1.1` in the envelope over it.
  const dir = carryTree('1.10', { [review('plan-1')]: '{"findings":[]}\n' });
  mkdirSync(join(dir, 'phases', '1.1'), { recursive: true });

  const r = riskCarry(dir, ['--phase', '1.10']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'bad-args');
  assert.match(r.detail, /already exists on this tree/);
  assert.equal(existsSync(join(dir, 'risk-carry')), false,
    'a refused carry minted its destination anyway');
});

test('risk-carry: a phase with no risk_surface fire is an answer, not a refusal', () => {
  const dir = carryTree(3, { 'SUMMARY.md': '# summary\n' });
  const r = riskCarry(dir, ['--phase', '3']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.carried, []);
  assert.equal(r.copied, 0);
  assert.equal(existsSync(join(dir, 'risk-carry')), false,
    'an empty carry minted a destination directory nothing accounts for');
});

// --- the whole point: the ruling survives the prune (AC6) -------------------

/** Run `land-cleanup.mjs gate` over `root` with `payload` on stdin. */
function gate(root, payload) {
  try {
    return JSON.parse(execFileSync('node', [LAND, 'gate', '--dir', root],
      { encoding: 'utf8',
        input: JSON.stringify(payload),
        env: { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL } }));
  } catch (e) { return JSON.parse(e.stdout); }
}

/**
 * The gate's payload, composed the way its caller composes it: the UNION of
 * every `ADJUDICATION-risk_surface*.json` in `home`, `entries[]` flattened, plus
 * every `REVIEW-risk_surface*.md` with no sibling record named as `unruled`.
 *
 * BOTH ROUNDS, never the highest alone (D-08). The join is by BASENAME, which
 * is what the carry preserves and why it may not rename.
 */
function unionFrom(home) {
  const names = readdirSync(home).sort();
  const findings = [];
  for (const name of names) {
    if (!name.startsWith('ADJUDICATION-risk_surface') || !name.endsWith('.json')) continue;
    findings.push(...JSON.parse(readFileSync(join(home, name), 'utf8')).entries);
  }
  const unruled = names.filter((name) =>
    name.startsWith('REVIEW-risk_surface') && name.endsWith('.md')
    && !names.includes(`ADJUDICATION${name.slice('REVIEW'.length, -'.md'.length)}.json`));
  return { findings, unruled };
}

test('risk-carry + milestone-prune --mode delete: the same verdict, off the carried records', () => {
  // AC6 end to end, and the failure it closes: `--mode delete` `rmSync`s
  // `phases/<N>` whole, records included, and `/cad-milestone` chains
  // `/cad-land` straight after it. Before this carry the gate had nothing left
  // to read at the moment it had to decide.
  const dir = makeTree({ roadmap: [{ n: 3, name: 'Ruled', checked: true }] });
  const root = join(dir, '..');
  writeFileSync(join(dir, 'config.json'), JSON.stringify({ git: { auto_close: true } }));
  const pdir = join(dir, 'phases', '3');
  mkdirSync(pdir, { recursive: true });
  writeFileSync(join(pdir, review('plan-1')), '{"findings":[]}\n');
  // Round one holds a survivor NOTHING ELSE names; round two holds the one that
  // was fixed. A carry - or a union - that took the highest round alone would
  // drop the round-one entry and flip this verdict from halt to proceed.
  writeFileSync(join(pdir, record('plan-1')),
    recordBody('plan-1', 1, [entry({ line: 111, claim: 'round one names this and nothing else does' })]));
  writeFileSync(join(pdir, record('plan-1', 2)),
    recordBody('plan-1', 2, [entry({ line: 460, fix_commit: '3341ffb0' })]));

  const before = unionFrom(pdir);
  assert.equal(before.findings.length, 2, 'the union took one round, not both');
  assert.ok(before.findings.some((f) => f.line === 111),
    'the entry only round one names is missing from the payload');
  assert.deepEqual(before.unruled, [], 'the review has a sibling record and is not unruled');
  const first = gate(root, before);
  assert.equal(first.action, 'halt', JSON.stringify(first));
  assert.equal(first.findings.length, 1, 'the fixed entry halted anyway');

  assert.equal(riskCarry(dir, ['--phase', '3']).ok, true);
  const pruned = JSON.parse(execFileSync('node',
    [PLANNING, '--dir', dir, 'milestone-prune', '--label', 'v9.9.9', '--mode', 'delete'],
    { encoding: 'utf8' }));
  assert.equal(pruned.ok, true, JSON.stringify(pruned));
  assert.deepEqual(pruned.dirs.deleted, [3]);
  assert.equal(existsSync(pdir), false, 'the prune left the phase directory standing');

  // Both records still readable at the carry destination, and the SAME decision
  // rebuilt from them alone.
  assert.deepEqual(carried(dir, 3),
    [record('plan-1'), record('plan-1', 2), review('plan-1')].sort());
  const after = unionFrom(join(dir, 'risk-carry', '3'));
  assert.deepEqual(after, before, 'the payload rebuilt after the prune is not the one before it');
  const second = gate(root, after);
  assert.equal(second.action, first.action);
  assert.equal(second.reason, first.reason);
  assert.deepEqual(second.findings, first.findings);
  assert.deepEqual(second.overridden, first.overridden);

  // THE FALSIFIER, run rather than described: take the carry away and the close
  // has nothing to rebuild from, so the verdict flips to the one that merges a
  // live blocker. This is the state every close was in before LND-02.
  rmSync(join(dir, 'risk-carry'), { recursive: true });
  assert.throws(() => unionFrom(join(dir, 'risk-carry', '3')),
    'the records outlived a carry that was deleted');
  assert.equal(gate(root, { findings: [], unruled: [] }).action, 'proceed',
    'with the rulings gone the gate proceeds - which is exactly what the carry exists to prevent');
});
