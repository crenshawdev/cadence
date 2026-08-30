// The stated table for the worker-key grammar in lib/plan-key.mjs (RSK-03).
// Run: node --test cadence-core/bin/plan-key.test.mjs
//
// This tree's convention for a stated grammar is a unit table beside the
// seam-level cases (lease-grammar.test.mjs and planning-files.test.mjs say so
// in their own headers): the rows below ARE the grammar, one per spelling, each
// carrying the reason it exists, and the `risk-check` cases further down prove
// both faces reach it. Only node: builtins.
//
// THE SEAM ROWS LIVE HERE AND NOT BESIDE THE OTHER `risk-check` CASES in
// risk-diff.test.mjs, which is a lease decision and not an oversight: plan 2 of
// this phase holds that file. What they assert is the GRAMMAR's reach through
// both faces rather than a risk verdict, so the fixture helpers below are a
// deliberate second copy of that file's - narrower, and built for this question.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requirePlanKey } from './lib/plan-key.mjs';

/** [value, accepted, why] - the grammar, stated once. */
export const PLAN_KEYS = [
  ['1', true, 'a plan number, the first-dispatch key workflows/execute.md names'],
  ['2', true, 'any plan number, not just the first'],
  ['10', true, 'more than one digit'],
  ['1-fix', true,
    'the fix-pass key a coordinator actually bracketed, and the spelling risk-check run refused'],
  ['1-cut-b', true, 'the second continuation of one plan - measured on this repo\'s own trace'],
  ['cad-verifier', true,
    'a role name: seams.md calls --bracket-plan "the worker key when it is not the role name", '
    + 'and the live trace holds 239 role-keyed events'],
  [true, false,
    'a valueless --plan: parseArgs gives it the boolean true and Number(true) is 1, so the '
    + 'answer would be recorded against plan 1 (the VAL-01 rail)'],
  [undefined, false, 'an absent value is not a key'],
  [42, false, 'a non-string of any kind, so no caller can hand this a number and be trusted'],
  ['', false, 'the empty key identifies nothing, and status groups completed ranges by it'],
  ['   ', false, 'whitespace-only is the empty key with cover'],
  [' 1', false,
    'leading whitespace: trace append stores the caller\'s string untrimmed, so " 1" and "1" '
    + 'would reach the join as two rows'],
  ['1 ', false, 'trailing whitespace, the same argument from the other end'],
  ['1\u00002', false,
    'a NUL: rowKey joins the correlation id and the plan with one, so this key can be spelled '
    + 'to collide with another row\'s identity'],
  ['1\nfix', false, 'a newline: the record and the receipt both live in append-only JSONL'],
  ['1\rfix', false, 'and the other line break, which is the same class'],
];

test('requirePlanKey: the stated table', () => {
  for (const [value, accepted, why] of PLAN_KEYS) {
    const r = requirePlanKey(value);
    assert.equal(r.ok, accepted, `requirePlanKey(${JSON.stringify(value)}) - ${why}`);
  }
});

test('an accepted key comes back VERBATIM, never normalized', () => {
  // The record `risk-check run` writes and the receipt `trace append --plan`
  // writes must be ONE spelling or the join finds nothing (D-01's stated cost).
  // A predicate that "helpfully" trimmed or lowercased would mint the second
  // spelling itself, at the one door built to stop that.
  for (const [value, accepted] of PLAN_KEYS) {
    if (!accepted) continue;
    const r = requirePlanKey(value);
    assert.equal(r.key, value, JSON.stringify(value));
  }
});

test('a refusal carries no value at all', () => {
  // Shaped like lib/require-int.mjs: a `{ok:false}` with nothing on it, so a
  // caller that forgot to check `ok` gets `undefined` rather than a plausible
  // key it can go on to write.
  for (const [value, accepted] of PLAN_KEYS) {
    if (accepted) continue;
    assert.deepEqual(requirePlanKey(value), { ok: false }, JSON.stringify(value));
  }
});

// --- both `risk-check` faces reach that grammar (RSK-03) --------------------

const HERE = dirname(fileURLToPath(import.meta.url));
const PLANNING = join(HERE, 'planning.mjs');
/** A global config layer that does not exist, pinned in so a developer whose
 *  own ~/.config/cadence/config.json answers the surface question does not see
 *  rows pass here and fail in CI. */
const NO_GLOBAL = join(mkdtempSync(join(tmpdir(), 'cad-plankey-')), 'no-global.json');

/** A scratch repository with its own `.planning/`, so every record written here
 *  is the fixture's and never this project's own. The surface question is
 *  ANSWERED: an unanswered project is refused `surfaces-unanswered` before
 *  detection runs at all, and these rows are about the key, not the question. */
function riskRepo() {
  const repo = mkdtempSync(join(tmpdir(), 'cad-plankey-'));
  execFileSync('git', ['init', '-q'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 't@example.com'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'T'], { cwd: repo });
  execFileSync('git', ['config', 'commit.gpgsign', 'false'], { cwd: repo });
  const dir = join(repo, '.planning');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'config.json'), JSON.stringify({
    review: { triggers: { risk_surface: { surfaces: ['secrets', 'destructive', 'untrusted_input'] } } },
  }));
  return { repo, dir };
}

/** Write, add and commit one file; return the new HEAD sha. */
function commitFile(repo, rel, body) {
  const file = join(repo, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body);
  execFileSync('git', ['add', '--', rel], { cwd: repo });
  execFileSync('git', ['commit', '-q', '-m', `add ${rel}`], { cwd: repo });
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
}

/** Any planning.mjs argv inside the fixture repo; its one JSON line and exit code. */
function planning(repo, dir, args) {
  let stdout;
  let code = 0;
  try {
    stdout = execFileSync('node', [PLANNING, '--dir', dir, ...args],
      { encoding: 'utf8', cwd: repo, env: { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL } });
  } catch (e) { stdout = e.stdout; code = e.status; }
  return { ...JSON.parse(stdout), _exit: code };
}

/** Every parsed line of the fixture's trace, or [] when it was never written. */
function traceLines(dir) {
  let text;
  try { text = readFileSync(join(dir, 'trace.jsonl'), 'utf8'); } catch { return []; }
  return text.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
}

/**
 * A phase-3 lifecycle bracket for one worker key: the anchor the correlation id
 * derives from, then a `cad-executor` dispatch closed by a RETURN, which is what
 * `risk-check status` reads as a COMPLETED range.
 */
const bracket = (plan) => [
  JSON.stringify({
    corr: '3-abc1234', phase: '3', ts: '2026-08-18T10:00:00.000Z',
    family: 'lifecycle', event: 'phase_start', sha: 'abc1234',
  }),
  JSON.stringify({
    corr: '3-abc1234', phase: '3', ts: '2026-08-18T10:01:00.000Z',
    family: 'lifecycle', event: 'dispatch', plan, role: 'cad-executor',
  }),
  JSON.stringify({
    corr: '3-abc1234', phase: '3', ts: '2026-08-18T10:30:00.000Z',
    family: 'lifecycle', event: 'return', plan, role: 'cad-executor',
  }),
];

/**
 * A diff body the `secrets` detector matches, assembled from parts rather than
 * written out. The literal would otherwise sit in this file for good, making
 * every future range that touches these tests report a secrets match on a
 * fixture - the self-matching defect RSK-04 closes for the detector's own
 * files, arriving here through the back door.
 */
const CREDENTIAL_LINE = `const SERVICE_${'API'}_${'KEY'} = "not-a-real-value";\n`;

test('risk-check run: a fix-pass key is RECORDED, where it answered bad-args', () => {
  const { repo, dir } = riskRepo();
  const base = commitFile(repo, 'README.md', 'start\n');
  commitFile(repo, 'src/auth.js', CREDENTIAL_LINE);
  const r = planning(repo, dir, ['risk-check', 'run', '--phase', '3', '--plan', '1-fix',
    '--base', base, '--head', 'HEAD']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.plan, '1-fix');
  const records = traceLines(dir).filter((e) => e.family === 'outcome' && e.event === 'risk_check');
  assert.equal(records.length, 1, JSON.stringify(records));
  assert.equal(records[0].plan, '1-fix', 'the key is recorded as the caller spelled it');
  assert.ok(records[0].matches.includes('secrets'), JSON.stringify(records[0]));
});

test('risk-check status: a 1-fix bracket is satisfiable - record, then fire receipt', () => {
  // The whole RSK-03 loop, end to end: the gate refuses, the run it names is
  // accepted, the gate still refuses for the FIRE, and the receipt settles it.
  // Before this, step 2 answered `bad-args` and there was no exit but an
  // `override`.
  const { repo, dir } = riskRepo();
  const base = commitFile(repo, 'README.md', 'start\n');
  const head = commitFile(repo, 'src/auth.js', CREDENTIAL_LINE);
  writeFileSync(join(dir, 'trace.jsonl'), `${bracket('1-fix').join('\n')}\n`);

  const before = planning(repo, dir, ['risk-check', 'status', '--phase', '3']);
  assert.equal(before.ok, false, JSON.stringify(before));
  assert.equal(before.reason, 'risk-record-missing');
  assert.deepEqual(before.missing, ['1-fix']);

  const run = planning(repo, dir, ['risk-check', 'run', '--phase', '3', '--plan', '1-fix',
    '--base', base, '--head', head]);
  assert.equal(run.ok, true, JSON.stringify(run));

  const recorded = planning(repo, dir, ['risk-check', 'status', '--phase', '3']);
  assert.equal(recorded.ok, false, JSON.stringify(recorded));
  assert.equal(recorded.reason, 'risk-fire-missing',
    'the record is there; the blocking fire it obliges is not');

  planning(repo, dir, ['trace', 'append', '--phase', '3', '--family', 'outcome',
    '--event', 'gate_pass', '--trigger', 'risk_surface', '--plan', '1-fix',
    '--survivors', '0', '--downgraded', '0', '--refuted', '0',
    '--base', base, '--sha', head]);
  const settled = planning(repo, dir, ['risk-check', 'status', '--phase', '3']);
  assert.equal(settled.ok, true, JSON.stringify(settled));
  assert.equal(settled.plans.length, 1);
  assert.equal(settled.plans[0].plan, '1-fix');
});

test('risk-check status: a bracketed key the grammar REFUSES is malformed, not missing', () => {
  // The one bounded exception to "status does not narrow" (D-01), and the
  // opposite of the exclusion arm that decision rejected: `risk-check run`
  // could never write a record for `1-fix ` either, so demanding one leaves a
  // blocking gate with no exit but an override. It is REPORTED rather than
  // dropped, which is what made the exclusion arm fail-open.
  const { repo, dir } = riskRepo();
  commitFile(repo, 'README.md', 'start\n');
  writeFileSync(join(dir, 'trace.jsonl'), `${bracket('1-fix ').join('\n')}\n`);
  const r = planning(repo, dir, ['risk-check', 'status', '--phase', '3']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.malformed, ['1-fix ']);
  assert.equal('missing' in r, false, JSON.stringify(r));
  assert.deepEqual(r.plans, [], 'a key no run can record is not a row awaiting one');
});

test('risk-check status: a bracket with NO plan at all is still required', () => {
  // An absent key is not a malformed one: `risk-check run` with no --plan
  // writes a record that keys to the same empty string and joins it, so the
  // unidentified completed range stays required rather than quietly exempt.
  const { repo, dir } = riskRepo();
  commitFile(repo, 'README.md', 'start\n');
  writeFileSync(join(dir, 'trace.jsonl'), `${bracket(undefined).join('\n')}\n`);
  const r = planning(repo, dir, ['risk-check', 'status', '--phase', '3']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'risk-record-missing');
  assert.deepEqual(r.missing, [null]);
  assert.equal('malformed' in r, false, JSON.stringify(r));
});

test('every spelling in the table is accepted by BOTH faces or refused by BOTH', () => {
  // D-02's assertion, made where it can actually fail: one predicate, two
  // callers, and no way for the seam that enforces the question to disagree
  // with the face that reports it. `run` and `status` are asked the SAME
  // spelling, and only the `bad-args` verdict is compared - a later refusal
  // (no record yet, no range) is a different answer to a different question.
  const { repo, dir } = riskRepo();
  const base = commitFile(repo, 'README.md', 'start\n');
  const head = commitFile(repo, 'docs/notes.md', 'text\n');
  for (const [value, accepted, why] of PLAN_KEYS) {
    // Only the spellings argv can carry. A non-string never survives a command
    // line at all, and a NUL cannot appear in an argument by construction -
    // argv is NUL-terminated - so those rows are proved by the unit table above
    // and by the bracket row before this one, which is where such a key could
    // actually arrive.
    if (typeof value !== 'string' || value.includes('\u0000')) continue;
    const run = planning(repo, dir, ['risk-check', 'run', '--phase', '3', '--plan', value,
      '--base', base, '--head', head]);
    const status = planning(repo, dir, ['risk-check', 'status', '--phase', '3', '--plan', value,
      '--base', base, '--head', head]);
    const runRefused = run.ok === false && run.reason === 'bad-args';
    const statusRefused = status.ok === false && status.reason === 'bad-args';
    assert.equal(runRefused, !accepted, `run(${JSON.stringify(value)}) - ${why}`);
    assert.equal(statusRefused, !accepted, `status(${JSON.stringify(value)}) - ${why}`);
    assert.equal(runRefused, statusRefused,
      `the two faces disagree about ${JSON.stringify(value)} - ${why}`);
  }
});
