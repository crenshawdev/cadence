// Zero-dep tests for `planning.mjs adjudication - the record a gate fire leaves`. Run:
// node --test 'cadence-core/bin/*.test.mjs'
//
// Split out of planning.test.mjs in phase 4, verbatim: the arms, their fixture
// builders and their comments are unchanged, only their home is. The shared
// harness stays in planning.test.mjs and is imported, never copied - two copies
// of `makeTree` is how two fixtures drift apart.
//
// The `test` binding below is a no-op unless this module IS the entry file, so
// a sibling that imports a fixture from here registers nothing twice.
import { test as nodeTest } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PLANNING, run } from './planning.test.mjs';

/** True iff this module is what node was told to run; realpath on both sides so
 * a symlinked checkout still matches (config-seams.test.mjs D-19). */
function isEntryFile() {
  const argv1 = process.argv[1];
  if (typeof argv1 !== 'string' || argv1 === '') return false;
  try {
    return pathToFileURL(realpathSync(argv1)).href === pathToFileURL(realpathSync(fileURLToPath(import.meta.url))).href;
  } catch { return false; }
}

/** `node:test`'s `test` when run directly, a no-op when imported (see header). */
const test = isEntryFile() ? nodeTest : () => {};

// --- adjudication: the record a gate fire leaves (phase 2) ------------------
//
// The seam is exercised against a REAL repository under mkdtempSync, because
// half of what it promises is git's: full 40-character ids resolved from the
// caller's spelling, and a refusal when the range does not resolve at all.
// Nothing here reads this repository's own `.planning`.

/**
 * A scratch git repo holding `.planning/phases/<phase>/` and two commits.
 * Returns {repo, dir, base, head} - `base` is the FIRST commit's 7-char
 * abbreviation, deliberately, because that is what 44 of this repo's 52
 * receipts actually spell.
 */
export function adjRepo({ phase = 2 } = {}) {
  const repo = mkdtempSync(join(tmpdir(), 'cad-adj-'));
  const git = (...args) => execFileSync('git', ['-C', repo, ...args],
    { encoding: 'utf8', stdio: 'pipe' }).trim();
  git('init', '-q');
  git('config', 'user.email', 't@example.com');
  git('config', 'user.name', 'T');
  const dir = join(repo, '.planning');
  mkdirSync(join(dir, 'phases', String(phase)), { recursive: true });
  writeFileSync(join(repo, 'src.js'), 'let x = 1;\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
  const baseFull = git('rev-parse', 'HEAD');
  writeFileSync(join(repo, 'src.js'), 'let x = 2;\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'head');
  const headFull = git('rev-parse', 'HEAD');
  return { repo, dir, phase, base: baseFull.slice(0, 7), baseFull, headFull };
}

/** Run the seam with cwd INSIDE the repo - resolveRange asks git about the cwd. */
export function adjRun(repo, dir, args) {
  let stdout;
  let code = 0;
  try {
    stdout = execFileSync('node', [PLANNING, '--dir', dir, 'adjudication', ...args],
      { encoding: 'utf8', cwd: repo });
  } catch (e) { stdout = e.stdout; code = e.status; }
  return { ...JSON.parse(stdout), _exit: code };
}

/** One voice raising one finding, ruled `survived`. The claim carries a quote
 * and a backslash on purpose: this payload is a FILE for exactly that reason.
 *
 * The finding is raised at `high`, so the `fix_commit` below is REQUIRED here
 * rather than decorative - `buildEntries` gates that requirement on the raised
 * severity, and high is one of the two severities a blocking gate halts over.
 * The two end-to-end rows further down raise at medium and at blocker-with-an-
 * override precisely because this one does not. */
export function adjPayload(over) {
  return {
    voices: [{
      voice: 'openai',
      model: 'gpt-5',
      returned: {
        findings: [{
          file: 'src.js',
          line: 1,
          severity: 'high',
          claim: 'the "x" binding is reassigned, so C:\\tmp is read twice',
          failure_scenario: 'a second reader sees 1 where the first saw 2',
        }],
      },
      rulings: [{
        finding: 0,
        ruling: 'survived',
        claim: 'the "x" binding is reassigned, so C:\\tmp is read twice',
        failure_scenario: 'a second reader sees 1 where the first saw 2',
        fix_commit: 'abcdef1',
      }],
    }],
    ...(over || {}),
  };
}

/** Write a payload file inside the repo and answer its path. */
export function adjPayloadFile(repo, payload, name = 'payload.json') {
  const file = join(repo, name);
  writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
  return file;
}

/** Every ADJUDICATION-* file under a phase directory, sorted. */
const adjFiles = (dir, phase = 2) =>
  readdirSync(join(dir, 'phases', String(phase))).filter((f) => f.startsWith('ADJUDICATION')).sort();

test('adjudication: the record lands beside the sibling REVIEW discriminator (AC1)', () => {
  const { repo, dir, baseFull, headFull, base } = adjRepo();
  const payload = adjPayloadFile(repo, adjPayload());
  const r = adjRun(repo, dir, ['--phase', '2', '--trigger', 'plan',
    '--discriminator', 'plan-1', '--base', base, '--head', 'HEAD', '--payload', payload]);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.record, 'phases/2/ADJUDICATION-plan-plan-1.json');
  assert.equal(r.round, 1);
  assert.deepEqual(r.counts, { raised: 1, survived: 1, downgraded: 0, refuted: 0 });
  assert.deepEqual(adjFiles(dir), ['ADJUDICATION-plan-plan-1.json']);

  const rec = JSON.parse(readFileSync(join(dir, r.record), 'utf8'));
  assert.equal(rec.trigger, 'plan');
  assert.equal(rec.discriminator, 'plan-1');
  assert.equal(rec.base_id, baseFull);
  assert.equal(rec.head_id, headFull);
  // The record stores NO count of its own - every figure is derived on read.
  assert.equal(rec.counts, undefined);
  assert.deepEqual(rec.voices, [{ voice: 'openai', model: 'gpt-5' }]);
  assert.equal(rec.entries.length, 1);
  assert.equal(rec.entries[0].voice, 'openai');
  assert.equal(rec.entries[0].severity, 'high');
  // VERBATIM, quoting and backslash intact.
  assert.equal(rec.entries[0].claim, adjPayload().voices[0].returned.findings[0].claim);
});

test('adjudication: every entry carries full 40-char ids from a 7-char base and a literal HEAD (AC2)', () => {
  const { repo, dir, base, baseFull, headFull } = adjRepo();
  const payload = adjPayloadFile(repo, adjPayload());
  const r = adjRun(repo, dir, ['--phase', '2', '--trigger', 'risk_surface',
    '--discriminator', 'plan-1', '--base', base, '--head', 'HEAD', '--payload', payload]);
  assert.equal(r.ok, true, JSON.stringify(r));
  // The caller's SPELLING stays on the envelope for the reader; the id is what
  // an auditor spends.
  assert.equal(r.base, base);
  assert.equal(r.head, 'HEAD');
  assert.equal(r.base_id.length, 40);
  assert.equal(r.head_id.length, 40);
  const rec = JSON.parse(readFileSync(join(dir, r.record), 'utf8'));
  for (const e of rec.entries) {
    assert.equal(e.base_id, baseFull);
    assert.equal(e.head_id, headFull);
    assert.equal(e.base_id.length, 40);
    assert.equal(e.head_id.length, 40);
  }
});

test('adjudication: a payload whose ruling paraphrases the claim is refused, no file written (AC2)', () => {
  const { repo, dir, base } = adjRepo();
  const bad = adjPayload();
  bad.voices[0].rulings[0].claim = 'x is reassigned';
  const payload = adjPayloadFile(repo, bad);
  const r = adjRun(repo, dir, ['--phase', '2', '--trigger', 'plan',
    '--discriminator', 'plan-1', '--base', base, '--head', 'HEAD', '--payload', payload]);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'bad-payload');
  assert.match(r.detail, /byte-identical/);
  assert.deepEqual(adjFiles(dir), []);
});

for (const spelling of ['../escaped', 'sub/plan-1', 'plan-1.json', '.', '-plan-1']) {
  test(`adjudication: a --discriminator spelled ${JSON.stringify(spelling)} is refused with NO file created`, () => {
    const { repo, dir, base } = adjRepo();
    const payload = adjPayloadFile(repo, adjPayload());
    const r = adjRun(repo, dir, ['--phase', '2', '--trigger', 'plan',
      '--discriminator', spelling, '--base', base, '--head', 'HEAD', '--payload', payload]);
    assert.equal(r.ok, false, JSON.stringify(r));
    assert.equal(r.reason, 'bad-args');
    assert.match(r.detail, /--discriminator/);
    assert.deepEqual(adjFiles(dir), []);
    // ...and nothing landed anywhere else either: the repo holds exactly what
    // the fixture put there.
    assert.deepEqual(readdirSync(repo).sort(), ['.git', '.planning', 'payload.json', 'src.js']);
    assert.deepEqual(readdirSync(join(dir, 'phases')), ['2']);
  });
}

test('adjudication: a --trigger carrying a path separator is refused the same way', () => {
  const { repo, dir, base } = adjRepo();
  const payload = adjPayloadFile(repo, adjPayload());
  const r = adjRun(repo, dir, ['--phase', '2', '--trigger', '../../etc/plan',
    '--discriminator', 'plan-1', '--base', base, '--head', 'HEAD', '--payload', payload]);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'bad-args');
  assert.match(r.detail, /--trigger/);
  assert.deepEqual(adjFiles(dir), []);
});

test('adjudication: an unresolvable --head is refused with no file created', () => {
  const { repo, dir, base } = adjRepo();
  const payload = adjPayloadFile(repo, adjPayload());
  const r = adjRun(repo, dir, ['--phase', '2', '--trigger', 'plan',
    '--discriminator', 'plan-1', '--base', base, '--head', 'no-such-ref', '--payload', payload]);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'unresolved-range');
  assert.equal(r._exit, 1);
  assert.deepEqual(adjFiles(dir), []);
});

test('adjudication: a re-arm passes --round 2 and round one survives byte for byte', () => {
  const { repo, dir, base } = adjRepo();
  const payload = adjPayloadFile(repo, adjPayload());
  const args = (extra) => ['--phase', '2', '--trigger', 'plan', '--discriminator', 'plan-1',
    '--base', base, '--head', 'HEAD', '--payload', payload, ...extra];

  const first = adjRun(repo, dir, args(['--round', '1']));
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.equal(first.record, 'phases/2/ADJUDICATION-plan-plan-1.json');
  const roundOne = readFileSync(join(dir, first.record), 'utf8');

  // Round two rules the SAME findings differently - that is what a re-arm is -
  // so the two records must both survive or the re-arm erases the evidence of
  // what the first round said.
  const second = adjPayload();
  second.voices[0].rulings[0] = {
    finding: 0,
    ruling: 'refuted',
    claim: second.voices[0].returned.findings[0].claim,
    failure_scenario: second.voices[0].returned.findings[0].failure_scenario,
    counter_evidence: { file: 'src.js', line: 1, note: 'the binding is const at head' },
  };
  const payload2 = adjPayloadFile(repo, second, 'payload-2.json');
  const r2 = adjRun(repo, dir, ['--phase', '2', '--trigger', 'plan', '--discriminator', 'plan-1',
    '--base', base, '--head', 'HEAD', '--payload', payload2, '--round', '2']);
  assert.equal(r2.ok, true, JSON.stringify(r2));
  assert.equal(r2.record, 'phases/2/ADJUDICATION-plan-plan-1-r2.json');
  assert.deepEqual(r2.counts, { raised: 1, survived: 0, downgraded: 0, refuted: 1 });

  assert.deepEqual(adjFiles(dir),
    ['ADJUDICATION-plan-plan-1-r2.json', 'ADJUDICATION-plan-plan-1.json']);
  assert.equal(readFileSync(join(dir, first.record), 'utf8'), roundOne,
    'round one\'s rulings are unchanged byte for byte');
});

test('adjudication: a second fire that forgot --round is REFUSED, not merged and not overwritten', () => {
  const { repo, dir, base } = adjRepo();
  const payload = adjPayloadFile(repo, adjPayload());
  const args = ['--phase', '2', '--trigger', 'plan', '--discriminator', 'plan-1',
    '--base', base, '--head', 'HEAD', '--payload', payload];

  const first = adjRun(repo, dir, args);
  assert.equal(first.ok, true, JSON.stringify(first));
  const before = readFileSync(join(dir, first.record), 'utf8');

  const again = adjRun(repo, dir, args);
  assert.equal(again.ok, false, JSON.stringify(again));
  assert.equal(again.reason, 'record-exists');
  assert.match(again.detail, /phases\/2\/ADJUDICATION-plan-plan-1\.json/);
  assert.match(again.hint, /--round 2/);
  assert.equal(again._exit, 1);
  assert.deepEqual(adjFiles(dir), ['ADJUDICATION-plan-plan-1.json']);
  assert.equal(readFileSync(join(dir, first.record), 'utf8'), before,
    'the existing record is untouched byte for byte');
});

test('adjudication: a phase directory that does not exist is refused rather than minted', () => {
  const { repo, dir, base } = adjRepo();
  const payload = adjPayloadFile(repo, adjPayload());
  const r = adjRun(repo, dir, ['--phase', '9', '--trigger', 'plan',
    '--discriminator', 'plan-1', '--base', base, '--head', 'HEAD', '--payload', payload]);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'no-phase-dir');
  assert.deepEqual(readdirSync(join(dir, 'phases')), ['2']);
});

test('adjudication: an absent --payload is bad-args, never a read of stdin', () => {
  const { repo, dir, base } = adjRepo();
  const r = adjRun(repo, dir, ['--phase', '2', '--trigger', 'plan',
    '--discriminator', 'plan-1', '--base', base, '--head', 'HEAD']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'bad-args');
  assert.match(r.detail, /--payload/);
  assert.deepEqual(adjFiles(dir), []);
});

test('adjudication: a payload file that was never written is no-payload, not a record', () => {
  const { repo, dir, base } = adjRepo();
  const r = adjRun(repo, dir, ['--phase', '2', '--trigger', 'plan',
    '--discriminator', 'plan-1', '--base', base, '--head', 'HEAD',
    '--payload', join(repo, 'never-written.json')]);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'no-payload');
  assert.deepEqual(adjFiles(dir), []);
});

test('adjudication: --round 0 and a non-numeric round are refused', () => {
  const { repo, dir, base } = adjRepo();
  const payload = adjPayloadFile(repo, adjPayload());
  for (const round of ['0', '-1']) {
    const r = adjRun(repo, dir, ['--phase', '2', '--trigger', 'plan',
      '--discriminator', 'plan-1', '--base', base, '--head', 'HEAD',
      '--payload', payload, '--round', round]);
    assert.equal(r.ok, false, `--round ${round}: ${JSON.stringify(r)}`);
    assert.equal(r.reason, 'bad-args');
  }
  assert.deepEqual(adjFiles(dir), []);
});

test('adjudication: a citation absent at head is MARKED and still stored, the present one is not (AC5)', () => {
  const { repo, dir, base } = adjRepo();
  const two = adjPayload();
  const findings = two.voices[0].returned.findings;
  // One citation present at head (`src.js`), one that is not.
  findings.push({
    file: 'deleted/gone.js',
    line: 12,
    severity: 'medium',
    claim: 'the helper is never called',
    failure_scenario: 'dead code ships',
  });
  two.voices[0].rulings.push({
    finding: 1,
    ruling: 'downgraded',
    claim: findings[1].claim,
    failure_scenario: findings[1].failure_scenario,
  });
  const payload = adjPayloadFile(repo, two);
  const r = adjRun(repo, dir, ['--phase', '2', '--trigger', 'plan',
    '--discriminator', 'plan-1', '--base', base, '--head', 'HEAD', '--payload', payload]);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.citations, { checked: true, missing: 1 });

  const rec = JSON.parse(readFileSync(join(dir, r.record), 'utf8'));
  // BOTH stored: the entry count is the number of findings RAISED, and a
  // finding whose grounding is in question is the last one a record may lose.
  assert.equal(rec.entries.length, 2);
  assert.deepEqual(rec.entries.map((e) => e.file), ['src.js', 'deleted/gone.js']);
  assert.equal(rec.entries[0].citation_missing, undefined);
  assert.equal(rec.entries[1].citation_missing, true);
  assert.deepEqual(rec.citations, { checked: true });
  assert.deepEqual(r.counts, { raised: 2, survived: 1, downgraded: 1, refuted: 0 });
});

test('adjudication: a citation pointing outside the repository is marked, never a crash (AC5)', () => {
  const { repo, dir, base } = adjRepo();
  const escaped = adjPayload();
  escaped.voices[0].returned.findings[0].file = '../outside/secrets.env';
  const payload = adjPayloadFile(repo, escaped);
  const r = adjRun(repo, dir, ['--phase', '2', '--trigger', 'plan',
    '--discriminator', 'plan-1', '--base', base, '--head', 'HEAD', '--payload', payload]);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.citations, { checked: true, missing: 1 });
  const rec = JSON.parse(readFileSync(join(dir, r.record), 'utf8'));
  assert.equal(rec.entries.length, 1);
  assert.equal(rec.entries[0].citation_missing, true);
});

// --- FIRE_RECEIPTS: `deferral`, the fifth name a fire can settle at ----------
//
// The `deferred` gate mode settles a fire by QUEUEING what it found and letting
// the run continue, so it produces an outcome none of the four older receipt
// names describes. `risk-check status` is the reader that decides whether a
// matched range was ever fired on, and it accepts a receipt only if its event
// name is in FIRE_RECEIPTS - so without `deferral` on that list a deferring run
// clears its own gate never, and halts at exactly the step deferring it was
// meant to let through.
//
// Both arms run the REAL seams end to end - `risk-check run` writes the record,
// `trace append` writes the receipt, `risk-check status` reads them - rather
// than hand-writing trace lines. The correlation id, the resolved range ids and
// the row key are then all the seam's own, which is the half a hand-built
// fixture would assert nothing about.

/** A git repo with a risky range: `.planning` answering the surface question,
 * a base commit, and a head commit adding a file under a `secrets/` directory.
 * Returns the full ids of both ends. */
function deferralRepo() {
  const repo = mkdtempSync(join(tmpdir(), 'cad-deferral-'));
  const git = (...args) => execFileSync('git', ['-C', repo, ...args],
    { encoding: 'utf8', stdio: 'pipe' }).trim();
  git('init', '-q');
  git('config', 'user.email', 't@example.com');
  git('config', 'user.name', 'T');
  git('config', 'commit.gpgsign', 'false');
  const dir = join(repo, '.planning');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'config.json'),
    JSON.stringify({ review: { triggers: { risk_surface: { surfaces: ['secrets'] } } } }));
  writeFileSync(join(repo, 'README.md'), 'start\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
  const base = git('rev-parse', 'HEAD');
  mkdirSync(join(repo, 'src', 'secrets'), { recursive: true });
  writeFileSync(join(repo, 'src', 'secrets', 'vault.ts'), 'export const K = 1;\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'head');
  const head = git('rev-parse', 'HEAD');
  // The anchor, so the record and the receipt derive the SAME `<phase>-<sha>`
  // correlation id the way a real run does rather than falling back to the
  // phase-only form.
  plRun(repo, dir, ['trace', 'append', '--phase', '1',
    '--family', 'lifecycle', '--event', 'phase_start', '--sha', head.slice(0, 7)]);
  return { repo, dir, base, head };
}

/** Any planning.mjs subcommand, run with cwd INSIDE the repo - `resolveRange`
 * and the detector both ask git about the cwd. The global config layer is
 * pinned out: a developer whose own config answers the surface question would
 * otherwise see a row pass here and fail in CI. */
function plRun(repo, dir, args) {
  let stdout;
  let code = 0;
  try {
    stdout = execFileSync('node', [PLANNING, '--dir', dir, ...args], {
      encoding: 'utf8',
      cwd: repo,
      env: { ...process.env, CADENCE_GLOBAL_CONFIG: join(tmpdir(), 'cad-deferral-no-global.json') },
    });
  } catch (e) { stdout = e.stdout; code = e.status; }
  return { ...JSON.parse(stdout), _exit: code };
}

test('risk-check status: a `deferral` receipt settles the range it names', () => {
  const { repo, dir, base, head } = deferralRepo();
  const range = ['--phase', '1', '--plan', '1', '--base', base, '--head', head];

  const recorded = plRun(repo, dir, ['risk-check', 'run', ...range]);
  assert.equal(recorded.ok, true, JSON.stringify(recorded));
  assert.ok(recorded.matches.some((m) => m.category === 'secrets'),
    `the fixture range matched no secrets surface: ${JSON.stringify(recorded.matches)}`);

  // Recorded but unfired: the detector ran, nothing says the review did.
  const before = plRun(repo, dir, ['risk-check', 'status', ...range]);
  assert.equal(before.ok, false, JSON.stringify(before));
  assert.equal(before.reason, 'risk-fire-missing');
  assert.equal(before.plans[0].state, 'unfired');

  // The deferring fire's receipt. No `--detail`: a deferral is a review's
  // settled outcome, not a coordinator's say-so, so it needs no reason the way
  // `override` does - it is exactly as joinable as `gate_pass`.
  const receipt = plRun(repo, dir, ['trace', 'append', '--phase', '1',
    '--family', 'outcome', '--event', 'deferral', '--trigger', 'risk_surface',
    '--plan', '1', '--base', base, '--sha', head]);
  assert.equal(receipt.ok, true, JSON.stringify(receipt));

  const after = plRun(repo, dir, ['risk-check', 'status', ...range]);
  assert.equal(after.ok, true, JSON.stringify(after));
  assert.equal(after._exit, 0);
  assert.equal(after.plans[0].state, 'recorded');
});

test('risk-check status: the acceptance is FIRE_RECEIPTS membership, not any outcome event', () => {
  // The negative half, and the falsifier for the row above: an `outcome` event
  // on the same trigger, the same plan and the same range, whose only defect is
  // a name the accepted set does not carry, settles nothing. Drop `deferral`
  // from FIRE_RECEIPTS and the row above answers exactly like this one.
  const { repo, dir, base, head } = deferralRepo();
  const range = ['--phase', '1', '--plan', '1', '--base', base, '--head', head];
  assert.equal(plRun(repo, dir, ['risk-check', 'run', ...range]).ok, true);

  const receipt = plRun(repo, dir, ['trace', 'append', '--phase', '1',
    '--family', 'outcome', '--event', 'deferred', '--trigger', 'risk_surface',
    '--plan', '1', '--base', base, '--sha', head]);
  assert.equal(receipt.ok, true, 'the trace takes any event name - it is the READER that judges');

  const r = plRun(repo, dir, ['risk-check', 'status', ...range]);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'risk-fire-missing');
  assert.equal(r.plans[0].state, 'unfired');
  assert.match(r.hint, /deferral/, 'the hint no longer names the receipt vocabulary it demands');
});

// --- GH-159: the remainder a blocking gate reports and moves past ------------
//
// A blocking gate halts over a blocker or a high. Everything it confirmed BELOW
// those is reported and moved past - the state the phase this row belongs to
// exists to make representable. Until the fix-commit requirement was gated on
// the RAISED severity, that fire could not be settled at all: the adjudicator
// held a `survived` ruling with nothing to cite, the record seam refused it,
// and the only ways forward were to downgrade the finding - recording a pass
// over a report - or to invent a commit id.
//
// Both rows below run the REAL seams end to end, for the reason the deferral
// pair above states: `risk-check run` records the match, `planning.mjs
// adjudication` writes the record, `trace append` writes the receipt and
// `risk-check status` reads them. The receipt's three figures are the
// adjudication envelope's OWN - `recountReceipt` recomputes them from the
// stored rulings and refuses a receipt that disagrees, so passing them through
// is what proves the entry reached the record and was counted as a survivor
// rather than merely returned by a function.

/** A one-voice payload over one finding raised at `severity` and ruled
 *  `survived`, citing a path that exists at head so the grounding check has
 *  something to find. `over` carries whatever the case's ruling needs. */
function survivedPayload(severity, over) {
  const claim = 'the vault key is read before the session guard runs';
  const failure_scenario = 'a caller with no session reads the key';
  return {
    voices: [{
      voice: 'openai',
      model: 'gpt-5',
      returned: {
        findings: [{
          file: 'src/secrets/vault.ts', line: 1, severity, claim, failure_scenario,
        }],
      },
      rulings: [{ finding: 0, ruling: 'survived', claim, failure_scenario, ...(over || {}) }],
    }],
  };
}

/** Write a payload beside the repo and answer its path. */
function survivedPayloadFile(repo, name, payload) {
  const file = join(repo, name);
  writeFileSync(file, `${JSON.stringify(payload)}\n`);
  return file;
}

test('GH-159: a blocking fire whose highest finding is a survived MEDIUM settles end to end', () => {
  const { repo, dir, base, head } = deferralRepo();
  mkdirSync(join(dir, 'phases', '1'), { recursive: true });
  const range = ['--phase', '1', '--plan', '1', '--base', base, '--head', head];

  const recorded = plRun(repo, dir, ['risk-check', 'run', ...range]);
  assert.equal(recorded.ok, true, JSON.stringify(recorded));

  const before = plRun(repo, dir, ['risk-check', 'status', ...range]);
  assert.equal(before.ok, false, JSON.stringify(before));
  assert.equal(before.plans[0].state, 'unfired');

  // The whole of what the adjudicator held: one medium, confirmed, unfixed.
  const payload = survivedPayloadFile(repo, 'gh159-payload.json', survivedPayload('medium'));
  const rec = plRun(repo, dir, ['adjudication', '--phase', '1', '--trigger', 'risk_surface',
    '--discriminator', 'plan-1', '--base', base, '--head', head, '--payload', payload]);
  assert.equal(rec.ok, true, `${JSON.stringify(rec)} - this is the refusal GH-159 reports`);
  assert.deepEqual(rec.counts, { raised: 1, survived: 1, downgraded: 0, refuted: 0 });

  // The seam's OWN figures, never numbers typed beside them.
  const receipt = plRun(repo, dir, ['trace', 'append', '--phase', '1',
    '--family', 'outcome', '--event', 'gate_pass', '--trigger', 'risk_surface',
    '--plan', '1', '--base', base, '--sha', head,
    '--survivors', String(rec.counts.survived),
    '--downgraded', String(rec.counts.downgraded),
    '--refuted', String(rec.counts.refuted)]);
  assert.equal(receipt.ok, true, `${JSON.stringify(receipt)} - recountReceipt read the stored `
    + 'rulings and disagreed with the envelope that produced them');

  const after = plRun(repo, dir, ['risk-check', 'status', ...range]);
  assert.equal(after.ok, true, JSON.stringify(after));
  assert.equal(after._exit, 0);
  assert.equal(after.plans[0].state, 'recorded');

  const stored = JSON.parse(readFileSync(join(dir, rec.record), 'utf8'));
  assert.equal(stored.entries.length, 1);
  assert.equal(stored.entries[0].ruling, 'survived');
  assert.equal(stored.entries[0].severity, 'medium');
  assert.equal('fix_commit' in stored.entries[0], false,
    'a confirmed-unfixed medium has no commit to name, and a fabricated one is what this '
    + 'phase exists to stop being the only way through');
});

/**
 * A one-voice payload carrying one entry of EACH ruling, over three findings
 * citing a path that exists at head. `overDowngraded` is what the bad-value
 * case puts on the `downgraded` ruling: the bad `fix_commit` goes THERE and
 * never on the survived entry, because the pre-phase code already refused a bad
 * value on a survived ruling and a fixture that puts it there passes every
 * assertion without exercising the hoisted path at all.
 */
function mixedRulingPayload(overDowngraded) {
  const findings = [
    { file: 'src/secrets/vault.ts', line: 1, severity: 'blocker',
      claim: 'the vault key is read before the session guard runs',
      failure_scenario: 'a caller with no session reads the key' },
    { file: 'src/secrets/vault.ts', line: 2, severity: 'high',
      claim: 'the retry loop re-sends the credential on a 500',
      failure_scenario: 'a proxy log keeps a copy of the credential' },
    { file: 'src/secrets/vault.ts', line: 3, severity: 'medium',
      claim: 'the config path is joined without being normalized',
      failure_scenario: 'a traversal segment escapes the planning root' },
  ];
  const verbatim = (i) => ({
    finding: i, claim: findings[i].claim, failure_scenario: findings[i].failure_scenario,
  });
  return {
    voices: [{
      voice: 'openai',
      model: 'gpt-5',
      returned: { findings },
      rulings: [
        { ...verbatim(0), ruling: 'survived', overridden: true },
        { ...verbatim(1), ruling: 'downgraded', ...(overDowngraded || {}) },
        { ...verbatim(2),
          ruling: 'refuted',
          counter_evidence: { file: 'src/secrets/vault.ts', line: 1, note: 'the guard runs first' } },
      ],
    }],
  };
}

test('RSK-08: both refusals land where they are stated, over a mixed-ruling fixture end to end', () => {
  // AC6, walked with the seams rather than around them: risk-check run ->
  // adjudication -> the settle receipt -> risk-check status.
  const { repo, dir, base, head } = deferralRepo();
  const phaseDir = join(dir, 'phases', '1');
  mkdirSync(phaseDir, { recursive: true });
  const range = ['--phase', '1', '--plan', '1', '--base', base, '--head', head];
  const adjudicate = (payloadFile) => plRun(repo, dir, ['adjudication', '--phase', '1',
    '--trigger', 'risk_surface', '--discriminator', 'plan-1',
    '--base', base, '--head', head, '--payload', payloadFile]);
  const records = () => readdirSync(phaseDir).filter((n) => n.startsWith('ADJUDICATION-'));

  assert.equal(plRun(repo, dir, ['risk-check', 'run', ...range]).ok, true);

  // 1. Task 1's guard: an unspendable fix_commit on the DOWNGRADED entry.
  const bad = adjudicate(survivedPayloadFile(repo, 'mixed-bad.json',
    mixedRulingPayload({ fix_commit: 'not-a-sha' })));
  assert.equal(bad.ok, false, `${JSON.stringify(bad)} - on the pre-hoist tree this returned `
    + 'ok:true and stored the string');
  assert.match(bad.detail, /fix_commit/);
  assert.match(bad.detail, /downgraded/,
    'the refusal names the ruling as well as the field, which is what a coordinator needs to '
    + 'find the entry in a three-ruling payload');
  assert.deepEqual(records(), [], 'a refused adjudication writes no record');

  // 2. Corrected: a WELL-FORMED commit id on that same downgraded entry, which
  //    is legal - the hoist validates the key there, it does not forbid it.
  const fixCommit = head.slice(0, 7);
  const rec = adjudicate(survivedPayloadFile(repo, 'mixed-good.json',
    mixedRulingPayload({ fix_commit: fixCommit })));
  assert.equal(rec.ok, true, JSON.stringify(rec));
  assert.deepEqual(rec.counts, { raised: 3, survived: 1, downgraded: 1, refuted: 1 });

  // The STORED bytes, not the envelope: ok:true is not evidence the entry
  // reached the record.
  const stored = JSON.parse(readFileSync(join(dir, rec.record), 'utf8'));
  assert.deepEqual(stored.entries.map((e) => e.ruling), ['survived', 'downgraded', 'refuted']);
  assert.equal(stored.entries[0].severity, 'blocker');
  assert.equal(stored.entries[0].overridden, true);
  assert.equal('fix_commit' in stored.entries[0], false);
  assert.equal(stored.entries[1].fix_commit, fixCommit);
  assert.equal('overridden' in stored.entries[1], false);

  // 3. Task 3's guard: the record holds a survived blocker a person cleared, so
  //    a receipt that says nothing about it is refused with nothing appended.
  const before = traceLines(dir).length;
  const settled = ['--survivors', String(rec.counts.survived),
    '--downgraded', String(rec.counts.downgraded),
    '--refuted', String(rec.counts.refuted)];
  const silent = plRun(repo, dir, ['trace', 'append', '--phase', '1',
    '--family', 'outcome', '--event', 'gate_pass', '--trigger', 'risk_surface',
    '--plan', '1', '--base', base, '--sha', head, ...settled]);
  assert.equal(silent.ok, false, JSON.stringify(silent));
  assert.match(silent.detail, /blocker or high/);
  assert.equal(traceLines(dir).length, before, 'nothing was appended');

  // 4. The accepted shape, and the range settles.
  const reason = join(repo, 'mixed-reason.txt');
  writeFileSync(reason, 'the vault path is unreachable this release; shipping behind a flag\n');
  const receipt = plRun(repo, dir, ['trace', 'append', '--phase', '1',
    '--family', 'outcome', '--event', 'override', '--trigger', 'risk_surface',
    '--plan', '1', '--base', base, '--sha', head, '--detail-file', reason, ...settled]);
  assert.equal(receipt.ok, true, JSON.stringify(receipt));

  const after = plRun(repo, dir, ['risk-check', 'status', ...range]);
  assert.equal(after.ok, true, JSON.stringify(after));
  assert.equal(after._exit, 0);
  assert.equal(after.plans[0].state, 'recorded');
});

/** Every line of the run's trace, so a refused append can be proved to have
 *  written nothing rather than merely to have answered `ok:false`. */
function traceLines(dir) {
  let text = '';
  try { text = readFileSync(join(dir, 'trace.jsonl'), 'utf8'); } catch { return []; }
  return text.split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));
}

test('RSK-08: a REASONLESS receipt over a record holding a cleared halt is refused', () => {
  // The self-assertion the guard exists to stop: the record says a person let a
  // blocker stand, and the receipt settles the range saying nothing at all -
  // which reads downstream as a clean settle.
  const { repo, dir, base, head } = deferralRepo();
  mkdirSync(join(dir, 'phases', '1'), { recursive: true });
  const range = ['--phase', '1', '--plan', '1', '--base', base, '--head', head];

  assert.equal(plRun(repo, dir, ['risk-check', 'run', ...range]).ok, true);
  const payload = survivedPayloadFile(repo, 'silent-override-payload.json',
    survivedPayload('blocker', { overridden: true }));
  const rec = plRun(repo, dir, ['adjudication', '--phase', '1', '--trigger', 'risk_surface',
    '--discriminator', 'plan-1', '--base', base, '--head', head, '--payload', payload]);
  assert.equal(rec.ok, true, JSON.stringify(rec));

  const before = traceLines(dir).length;
  const receipt = plRun(repo, dir, ['trace', 'append', '--phase', '1',
    '--family', 'outcome', '--event', 'gate_pass', '--trigger', 'risk_surface',
    '--plan', '1', '--base', base, '--sha', head,
    '--survivors', String(rec.counts.survived),
    '--downgraded', String(rec.counts.downgraded),
    '--refuted', String(rec.counts.refuted)]);
  assert.equal(receipt.ok, false, JSON.stringify(receipt));
  assert.match(receipt.detail, new RegExp(rec.record.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    'the refusal names the RECORD it read, so a caller can open the thing that contradicts it');
  assert.match(receipt.detail, /blocker or high/);
  assert.doesNotMatch(receipt.detail, /gate_pass|override|rearm|deferral|adjudication/,
    'the refusal is a record/receipt CONTRADICTION and is never keyed to an event name - this '
    + 'seam states it carries no runtime refusal keyed to an event, and the first one would be '
    + 'read as drift and deleted');
  assert.equal(traceLines(dir).length, before, 'a refused append writes nothing');

  // And the accepted shape over the SAME record, so the guard is proved to
  // refuse the reasonless receipt rather than the record.
  const reason = join(repo, 'silent-override-reason.txt');
  writeFileSync(reason, 'shipping behind a flag; the vault path is unreachable this release\n');
  const explained = plRun(repo, dir, ['trace', 'append', '--phase', '1',
    '--family', 'outcome', '--event', 'override', '--trigger', 'risk_surface',
    '--plan', '1', '--base', base, '--sha', head, '--detail-file', reason,
    '--survivors', String(rec.counts.survived),
    '--downgraded', String(rec.counts.downgraded),
    '--refuted', String(rec.counts.refuted)]);
  assert.equal(explained.ok, true, JSON.stringify(explained));
  assert.equal(traceLines(dir).length, before + 1);
});

test('LND-02: a cleared halt that ALSO names a fix commit takes a reasonless receipt', () => {
  // The other side of the row above, and the case D-05 settles. The record
  // grammar permits both markers on one entry - lib/adjudication-record.mjs
  // refuses only when NEITHER is present - so a blocker whose fix landed AND
  // whose halt a person also cleared is legal and stored with both. It is
  // FIXED, and `overrideAccounted` reads `haltingSurvivors`, which no longer
  // holds it: nothing is being asserted away, because the commit says what
  // happened. Without the precedence the fix commit wins on, this entry would
  // demand a reason on every receipt that ever settles this range again, and
  // the reason would have to be written about work that is already committed.
  const { repo, dir, base, head } = deferralRepo();
  mkdirSync(join(dir, 'phases', '1'), { recursive: true });
  const range = ['--phase', '1', '--plan', '1', '--base', base, '--head', head];

  assert.equal(plRun(repo, dir, ['risk-check', 'run', ...range]).ok, true);
  const payload = survivedPayloadFile(repo, 'fixed-override-payload.json',
    survivedPayload('blocker', { overridden: true, fix_commit: head.slice(0, 7) }));
  const rec = plRun(repo, dir, ['adjudication', '--phase', '1', '--trigger', 'risk_surface',
    '--discriminator', 'plan-1', '--base', base, '--head', head, '--payload', payload]);
  assert.equal(rec.ok, true, JSON.stringify(rec));

  // Both markers reached the RECORD, so the case is the one it claims to be
  // rather than an entry that quietly lost one of them at composition time.
  const stored = JSON.parse(readFileSync(join(dir, rec.record), 'utf8'));
  assert.equal(stored.entries[0].overridden, true);
  assert.equal(stored.entries[0].fix_commit, head.slice(0, 7));

  const before = traceLines(dir).length;
  const receipt = plRun(repo, dir, ['trace', 'append', '--phase', '1',
    '--family', 'outcome', '--event', 'gate_pass', '--trigger', 'risk_surface',
    '--plan', '1', '--base', base, '--sha', head,
    '--survivors', String(rec.counts.survived),
    '--downgraded', String(rec.counts.downgraded),
    '--refuted', String(rec.counts.refuted)]);
  assert.equal(receipt.ok, true, JSON.stringify(receipt));
  assert.equal(traceLines(dir).length, before + 1, 'the reasonless receipt was appended');
  assert.equal(plRun(repo, dir, ['risk-check', 'status', ...range]).plans[0].state, 'recorded');
});

test('RSK-08: a FIGURELESS receipt cannot settle the range at all', () => {
  // UAT item 3, going the other way. `overrideAccounted` is reached only once a
  // settled figure is PRESENT, so a receipt carrying none of the three skipped
  // the record before it was opened: measured on the shipped tree, this exact
  // call was appended and `risk-check status` then reported the range
  // `recorded`. The requirement that closes it is DECLARED - lib/arg-contract.mjs's
  // `PRESENCE_RULES` - and refuses at the argument door, so the seam keeps its
  // "never a runtime refusal keyed to an event name" property untouched.
  const { repo, dir, base, head } = deferralRepo();
  mkdirSync(join(dir, 'phases', '1'), { recursive: true });
  const range = ['--phase', '1', '--plan', '1', '--base', base, '--head', head];

  assert.equal(plRun(repo, dir, ['risk-check', 'run', ...range]).ok, true);
  const payload = survivedPayloadFile(repo, 'figureless-override-payload.json',
    survivedPayload('blocker', { overridden: true }));
  const rec = plRun(repo, dir, ['adjudication', '--phase', '1', '--trigger', 'risk_surface',
    '--discriminator', 'plan-1', '--base', base, '--head', head, '--payload', payload]);
  assert.equal(rec.ok, true, JSON.stringify(rec));

  // Every join key a documented receipt carries, and not one settled figure.
  const before = traceLines(dir).length;
  const receipt = plRun(repo, dir, ['trace', 'append', '--phase', '1',
    '--family', 'outcome', '--event', 'gate_pass', '--trigger', 'risk_surface',
    '--plan', '1', '--base', base, '--sha', head]);
  assert.equal(receipt.ok, false, JSON.stringify(receipt));
  assert.equal(receipt.reason, 'bad-args');
  for (const flag of ['--survivors', '--downgraded', '--refuted']) {
    assert.match(receipt.detail, new RegExp(flag),
      'the refusal names the flags the caller has to add, or it is a rule with no repair');
  }
  // It NAMES the event, and that is the decision rather than an oversight: this
  // refusal comes from the argument door, which is exactly where the event-name
  // knowledge lives. The sibling arms' `doesNotMatch` assertion pins the SEAM's
  // refusal, which stays a record/receipt contradiction; copying it here would
  // pin the opposite of what this door is for.
  assert.match(receipt.detail, /gate_pass/);
  assert.ok(receipt.hint, 'a refusal a user reads names the next step');
  assert.equal(traceLines(dir).length, before, 'a refused append writes nothing');

  // And the range is still unsettled, which is the whole of what UAT item 3
  // measured going the other way - there the figureless receipt was appended
  // and the range then read `recorded`.
  const unsettled = plRun(repo, dir, ['risk-check', 'status', ...range]);
  assert.equal(unsettled.ok, false, JSON.stringify(unsettled));
  assert.equal(unsettled.reason, 'risk-fire-missing');
  assert.equal(unsettled.plans[0].state, 'unfired');

  // The accepted shape over the SAME record, so the arm is proved to refuse the
  // figureless CALL and not the fixture.
  const reason = join(repo, 'figureless-override-reason.txt');
  writeFileSync(reason, 'shipping behind a flag; the vault path is unreachable this release\n');
  const explained = plRun(repo, dir, ['trace', 'append', '--phase', '1',
    '--family', 'outcome', '--event', 'override', '--trigger', 'risk_surface',
    '--plan', '1', '--base', base, '--sha', head, '--detail-file', reason,
    '--survivors', String(rec.counts.survived),
    '--downgraded', String(rec.counts.downgraded),
    '--refuted', String(rec.counts.refuted)]);
  assert.equal(explained.ok, true, JSON.stringify(explained));
  assert.equal(traceLines(dir).length, before + 1);
  assert.equal(plRun(repo, dir, ['risk-check', 'status', ...range]).plans[0].state, 'recorded');
});

test('RSK-08: the guard cannot be discharged by dropping one settled figure', () => {
  // `recountReceipt` needs all three because a partial set cannot be compared
  // with a recount that answers all three. This check recounts nothing, so
  // inheriting that precondition would make the guard opt-out: drop `--refuted`
  // and the cleared halt goes unmentioned again.
  const { repo, dir, base, head } = deferralRepo();
  mkdirSync(join(dir, 'phases', '1'), { recursive: true });
  const range = ['--phase', '1', '--plan', '1', '--base', base, '--head', head];

  assert.equal(plRun(repo, dir, ['risk-check', 'run', ...range]).ok, true);
  const payload = survivedPayloadFile(repo, 'partial-override-payload.json',
    survivedPayload('high', { overridden: true }));
  const rec = plRun(repo, dir, ['adjudication', '--phase', '1', '--trigger', 'risk_surface',
    '--discriminator', 'plan-1', '--base', base, '--head', head, '--payload', payload]);
  assert.equal(rec.ok, true, JSON.stringify(rec));

  const before = traceLines(dir).length;
  const receipt = plRun(repo, dir, ['trace', 'append', '--phase', '1',
    '--family', 'outcome', '--event', 'gate_pass', '--trigger', 'risk_surface',
    '--plan', '1', '--base', base, '--sha', head,
    '--survivors', String(rec.counts.survived),
    '--downgraded', String(rec.counts.downgraded)]);
  assert.equal(receipt.ok, false, JSON.stringify(receipt));
  assert.match(receipt.detail, /blocker or high/);
  assert.equal(traceLines(dir).length, before, 'a refused append writes nothing');
});

test('RSK-08: an UNREADABLE record over a partial settle line is refused, never passed', () => {
  // The other way to discharge the marker: edit the file the guard reads. An
  // ABSENT record still omits the check - nobody wrote one - but this record
  // exists and was CHANGED, and passing on it would clear the marker with
  // nobody having read what it held. `recountReceipt` refuses an unparseable
  // record only once all THREE figures are present, so the two-figure settle
  // line below never reaches that refusal and the one asserted here is
  // necessarily this guard's own.
  const { repo, dir, base, head } = deferralRepo();
  mkdirSync(join(dir, 'phases', '1'), { recursive: true });
  const range = ['--phase', '1', '--plan', '1', '--base', base, '--head', head];

  assert.equal(plRun(repo, dir, ['risk-check', 'run', ...range]).ok, true);
  const payload = survivedPayloadFile(repo, 'edited-record-payload.json',
    survivedPayload('blocker', { overridden: true }));
  const rec = plRun(repo, dir, ['adjudication', '--phase', '1', '--trigger', 'risk_surface',
    '--discriminator', 'plan-1', '--base', base, '--head', head, '--payload', payload]);
  assert.equal(rec.ok, true, JSON.stringify(rec));

  // Truncated after the seam wrote it, which is what a record somebody edited
  // looks like from here.
  const file = join(dir, rec.record);
  writeFileSync(file, readFileSync(file, 'utf8').slice(0, 40));
  assert.throws(() => JSON.parse(readFileSync(file, 'utf8')), 'the fixture record is unreadable');

  const before = traceLines(dir).length;
  const receipt = plRun(repo, dir, ['trace', 'append', '--phase', '1',
    '--family', 'outcome', '--event', 'gate_pass', '--trigger', 'risk_surface',
    '--plan', '1', '--base', base, '--sha', head,
    '--survivors', String(rec.counts.survived),
    '--downgraded', String(rec.counts.downgraded)]);
  assert.equal(receipt.ok, false, JSON.stringify(receipt));
  assert.equal(receipt.reason, 'bad-record');
  assert.match(receipt.detail, new RegExp(rec.record.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    'the refusal names the FILE it could not read, which is what a caller acts on here');
  assert.doesNotMatch(receipt.detail, /gate_pass|override|rearm|deferral|adjudication/,
    'still a record/receipt contradiction, never keyed to an event name');
  assert.equal(traceLines(dir).length, before, 'a refused append writes nothing');
});

test('RSK-08: a record holding NO cleared halt takes a reasonless receipt unchanged', () => {
  // The guard fires on the contradiction and on nothing else: an ordinary
  // survived medium settles with no reason exactly as it did before.
  const { repo, dir, base, head } = deferralRepo();
  mkdirSync(join(dir, 'phases', '1'), { recursive: true });
  const range = ['--phase', '1', '--plan', '1', '--base', base, '--head', head];

  assert.equal(plRun(repo, dir, ['risk-check', 'run', ...range]).ok, true);
  const payload = survivedPayloadFile(repo, 'no-override-payload.json',
    survivedPayload('medium'));
  const rec = plRun(repo, dir, ['adjudication', '--phase', '1', '--trigger', 'risk_surface',
    '--discriminator', 'plan-1', '--base', base, '--head', head, '--payload', payload]);
  assert.equal(rec.ok, true, JSON.stringify(rec));

  const receipt = plRun(repo, dir, ['trace', 'append', '--phase', '1',
    '--family', 'outcome', '--event', 'gate_pass', '--trigger', 'risk_surface',
    '--plan', '1', '--base', base, '--sha', head,
    '--survivors', String(rec.counts.survived),
    '--downgraded', String(rec.counts.downgraded),
    '--refuted', String(rec.counts.refuted)]);
  assert.equal(receipt.ok, true, JSON.stringify(receipt));
  assert.equal(plRun(repo, dir, ['risk-check', 'status', ...range]).plans[0].state, 'recorded');
});

test('an OVERRIDDEN blocking fire settles end to end, with the record present rather than absent', () => {
  // The run `.planning/ARCHIVE.md` records: an `override` receipt was written
  // and no `ADJUDICATION-risk_surface-plan-1.json` existed beside it, because
  // the only ruling the adjudicator held - a blocker that stood unfixed - was
  // the one the record seam refused. This row is what stops that recurring.
  const { repo, dir, base, head } = deferralRepo();
  mkdirSync(join(dir, 'phases', '1'), { recursive: true });
  const range = ['--phase', '1', '--plan', '1', '--base', base, '--head', head];

  const recorded = plRun(repo, dir, ['risk-check', 'run', ...range]);
  assert.equal(recorded.ok, true, JSON.stringify(recorded));

  const payload = survivedPayloadFile(repo, 'override-payload.json',
    survivedPayload('blocker', { overridden: true }));
  const rec = plRun(repo, dir, ['adjudication', '--phase', '1', '--trigger', 'risk_surface',
    '--discriminator', 'plan-1', '--base', base, '--head', head, '--payload', payload]);
  assert.equal(rec.ok, true, `${JSON.stringify(rec)} - an override has no commit to name, and `
    + 'inventing one is the thing the marker exists to make unnecessary');
  assert.deepEqual(rec.counts, { raised: 1, survived: 1, downgraded: 0, refuted: 0 });

  // The `override` receipt is the one risk-check.mjs SKIPS when its reason is
  // empty, so the reason rides `--detail-file`: an inline `--detail` is not the
  // transport this receipt takes, and an empty one is not a receipt at all.
  const reason = join(repo, 'override-reason.txt');
  writeFileSync(reason, 'shipping behind a flag; the vault path is unreachable this release\n');
  const receipt = plRun(repo, dir, ['trace', 'append', '--phase', '1',
    '--family', 'outcome', '--event', 'override', '--trigger', 'risk_surface',
    '--plan', '1', '--base', base, '--sha', head, '--detail-file', reason,
    '--survivors', String(rec.counts.survived),
    '--downgraded', String(rec.counts.downgraded),
    '--refuted', String(rec.counts.refuted)]);
  assert.equal(receipt.ok, true, JSON.stringify(receipt));

  const after = plRun(repo, dir, ['risk-check', 'status', ...range]);
  assert.equal(after.ok, true, JSON.stringify(after));
  assert.equal(after._exit, 0);
  assert.equal(after.plans[0].state, 'recorded');

  const stored = JSON.parse(readFileSync(join(dir, rec.record), 'utf8'));
  assert.equal(stored.entries.length, 1);
  assert.equal(stored.entries[0].ruling, 'survived');
  assert.equal(stored.entries[0].severity, 'blocker');
  assert.equal(stored.entries[0].overridden, true);
  assert.equal('fix_commit' in stored.entries[0], false,
    'the override settle point produces a reason on the receipt and no commit, so a SHA here '
    + 'could only have been fabricated');
});
