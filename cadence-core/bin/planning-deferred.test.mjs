// Zero-dep tests for `planning.mjs deferred record / list / carry - the queued gate findings`. Run:
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
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, symlinkSync, chmodSync, rmSync, renameSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PLANNING, makeTree, run } from './planning.test.mjs';
import { adjRepo, adjRun, adjPayload, adjPayloadFile } from './planning-adjudication.test.mjs';

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

// --- deferred record: the queue member a `deferred` gate leaves (D-01) -------
//
// The I/O half of lib/deferred-queue.mjs, the way the block above is the I/O
// half of lib/adjudication-record.mjs: the grammar is asserted in
// deferred-queue.test.mjs, and what a repository is needed for is asserted
// here - the resolved ids, the refusal to overwrite, where the file lands, and
// that no adjudication record appears beside it.

/** Run the queue seam with cwd INSIDE the repo - `resolveRange` asks git about
 * the cwd, exactly as `adjRun` above needs. */
function defRun(repo, dir, args) {
  let stdout;
  let code = 0;
  try {
    stdout = execFileSync('node', [PLANNING, '--dir', dir, 'deferred', 'record', ...args],
      { encoding: 'utf8', cwd: repo });
  } catch (e) { stdout = e.stdout; code = e.status; }
  return { ...JSON.parse(stdout), _exit: code };
}

/** The reviewer's returned object, which IS this seam's payload. */
const defPayload = (over) => ({
  findings: [{
    file: 'src.js',
    line: 1,
    severity: 'high',
    claim: 'the "x" binding is reassigned, so C:\\tmp is read twice',
    failure_scenario: 'a second reader sees 1 where the first saw 2',
    ...over,
  }],
});

/** Every file under a phase directory, sorted - both stems, so a row can say
 * what did NOT appear as well as what did. */
const phaseFiles = (dir, phase = 2) =>
  readdirSync(join(dir, 'phases', String(phase))).sort();

test('deferred record: the member lands beside the sibling REVIEW discriminator', () => {
  const { repo, dir, baseFull, headFull, base } = adjRepo();
  const payload = adjPayloadFile(repo, defPayload());
  const r = defRun(repo, dir, ['--phase', '2', '--trigger', 'diff',
    '--discriminator', 'plan-1', '--base', base, '--head', 'HEAD', '--payload', payload]);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.record, 'phases/2/DEFERRED-diff-plan-1.json');
  assert.equal(r.round, 1);
  assert.equal(r.findings, 1);

  // NO adjudication record, and not by convention: `RULINGS` is frozen at three
  // and a finding with no ruling is a refusal, so this seam has no way to write
  // one (D-09).
  assert.deepEqual(phaseFiles(dir), ['DEFERRED-diff-plan-1.json']);

  const rec = JSON.parse(readFileSync(join(dir, r.record), 'utf8'));
  assert.equal(rec.trigger, 'diff');
  assert.equal(rec.discriminator, 'plan-1');
  assert.equal(rec.round, 1);
  // RESOLVED ids, never the caller's spelling: the member is read at land time,
  // in another session, where `HEAD` names a different commit.
  assert.equal(rec.base, base);
  assert.equal(rec.head, 'HEAD');
  assert.equal(rec.base_id, baseFull);
  assert.equal(rec.head_id, headFull);
  // VERBATIM, quoting and backslash included - the whole reason the payload is
  // a file. `/cad-milestone` deletes the sibling REVIEW file, so a member that
  // stored a COUNT would name a number nobody could triage.
  assert.deepEqual(rec.findings, defPayload().findings);
});

test('deferred record: a second call refuses instead of overwriting the queue member', () => {
  const { repo, dir, base } = adjRepo();
  const payload = adjPayloadFile(repo, defPayload());
  const args = ['--phase', '2', '--trigger', 'diff', '--discriminator', 'plan-1',
    '--base', base, '--head', 'HEAD', '--payload', payload];
  assert.equal(defRun(repo, dir, args).ok, true);

  const second = defRun(repo, dir, args);
  assert.equal(second.ok, false, JSON.stringify(second));
  assert.equal(second.reason, 'record-exists');
  assert.match(second.hint, /--round 2/);
  // Round 2 lands BESIDE round 1, never on it - the re-arm's member is what the
  // land refusal is still holding.
  const rearm = defRun(repo, dir, [...args, '--round', '2']);
  assert.equal(rearm.ok, true, JSON.stringify(rearm));
  assert.deepEqual(phaseFiles(dir),
    ['DEFERRED-diff-plan-1-r2.json', 'DEFERRED-diff-plan-1.json']);
});

test('deferred record: --trigger and --discriminator are refused by the FILENAME rule', () => {
  // Both reach a filename, and `milestone-prune --label` is the precedent for
  // refusing rather than sanitizing (VAL-01): a sanitized token writes a member
  // under a name the caller did not choose, which is the same class of answer
  // about something nobody asked for.
  const { repo, dir, base } = adjRepo();
  const payload = adjPayloadFile(repo, defPayload());
  for (const [flag, bad] of [['--trigger', '../../etc'], ['--discriminator', '.'],
    ['--trigger', '-rf'], ['--discriminator', 'plan 1']]) {
    const args = { '--trigger': 'diff', '--discriminator': 'plan-1', [flag]: bad };
    const r = defRun(repo, dir, ['--phase', '2',
      '--trigger', args['--trigger'], '--discriminator', args['--discriminator'],
      '--base', base, '--head', 'HEAD', '--payload', payload]);
    assert.equal(r.ok, false, `${flag}=${bad}: ${JSON.stringify(r)}`);
    assert.equal(r.reason, 'bad-args');
    assert.match(r.detail, /reaches a FILENAME/);
    assert.match(r.detail, /letters, digits, _ and -/);
    assert.deepEqual(phaseFiles(dir), [], 'a refused call wrote something anyway');
  }
});

test('deferred record: a malformed finding is refused in buildEntries own words', () => {
  const { repo, dir, base } = adjRepo();
  for (const [over, shape] of [[{ line: 0 }, /\.line must be an integer of at least 1$/],
    [{ nope: true }, /carries an unknown key: nope$/]]) {
    const payload = adjPayloadFile(repo, defPayload(over), `payload-${Object.keys(over)[0]}.json`);
    const r = defRun(repo, dir, ['--phase', '2', '--trigger', 'diff',
      '--discriminator', 'plan-1', '--base', base, '--head', 'HEAD', '--payload', payload]);
    assert.equal(r.ok, false, JSON.stringify(r));
    assert.equal(r.reason, 'bad-payload');
    assert.match(r.detail, shape);
    assert.deepEqual(phaseFiles(dir), []);
  }
});

test('deferred record: an absent phase directory is refused, never minted', () => {
  const { repo, dir, base } = adjRepo();
  const payload = adjPayloadFile(repo, defPayload());
  const r = defRun(repo, dir, ['--phase', '7', '--trigger', 'diff',
    '--discriminator', 'plan-1', '--base', base, '--head', 'HEAD', '--payload', payload]);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'no-phase-dir');
  assert.equal(existsSync(join(dir, 'phases', '7')), false,
    'the seam records a fire that HAPPENED - a mistyped flag must not mint a phase directory');
});

// --- deferred list: what is still queued, across both homes (D-01) ----------
//
// The membership half of the same module. The grammar - what makes a member's
// fields agree with its filename - is asserted in deferred-queue.test.mjs;
// what a filesystem is needed for is asserted here: the supersession test, the
// two homes, and the refusal to call an unreadable queue an empty one.

/** Run the reader. No cwd requirement: it resolves no git range. */
function defList(dir, args = []) {
  let stdout;
  let code = 0;
  try {
    stdout = execFileSync('node', [PLANNING, '--dir', dir, 'deferred', 'list', ...args],
      { encoding: 'utf8' });
  } catch (e) { stdout = e.stdout; code = e.status; }
  return { ...JSON.parse(stdout), _exit: code };
}

test('deferred list: a member is queued until its ADJUDICATION sibling is beside it', () => {
  const { repo, dir, base } = adjRepo();
  const payload = adjPayloadFile(repo, defPayload());
  const fire = ['--phase', '2', '--trigger', 'diff', '--discriminator', 'plan-1',
    '--base', base, '--head', 'HEAD'];
  assert.equal(defRun(repo, dir, [...fire, '--payload', payload]).ok, true);

  const listed = defList(dir);
  assert.equal(listed.ok, true, JSON.stringify(listed));
  assert.deepEqual(listed.members, [{
    phase: '2', trigger: 'diff', discriminator: 'plan-1', round: 1,
    path: 'phases/2/DEFERRED-diff-plan-1.json', findings: 1,
  }], 'a member is named by phase, trigger, discriminator and round, with its own count');
  assert.equal(listed.findings, 1);
  assert.deepEqual(listed.unreadable, []);

  // MEMBERSHIP IS SUPERSESSION, never absence-of-record (D-01): the record for
  // the SAME trigger, discriminator and round, beside it.
  assert.equal(adjRun(repo, dir, [...fire, '--payload', adjPayloadFile(repo, adjPayload(), 'adj.json')]).ok,
    true);
  const settled = defList(dir);
  assert.equal(settled.ok, true, JSON.stringify(settled));
  assert.deepEqual(settled.members, []);
  assert.equal(settled.findings, 0);
});

test('deferred list: a round 2 member is superseded by round 2 and by nothing else', () => {
  // The whole reason the two names share one round rule. A re-arm cleared by
  // round one's record would drop the finding the re-arm was fired over.
  const { repo, dir, base } = adjRepo();
  const payload = adjPayloadFile(repo, defPayload());
  const fire = ['--phase', '2', '--trigger', 'diff', '--discriminator', 'plan-1',
    '--base', base, '--head', 'HEAD'];
  assert.equal(defRun(repo, dir, [...fire, '--payload', payload]).ok, true);
  assert.equal(defRun(repo, dir, [...fire, '--payload', payload, '--round', '2']).ok, true);
  assert.equal(adjRun(repo, dir, [...fire, '--payload', adjPayloadFile(repo, adjPayload(), 'adj.json')]).ok,
    true);

  const listed = defList(dir);
  assert.equal(listed.ok, true, JSON.stringify(listed));
  assert.deepEqual(listed.members.map((m) => m.round), [2],
    'round one settled; round two is still queued');
});

test('deferred list: both homes are read, and --phase narrows to one', () => {
  const { repo, dir, base } = adjRepo();
  const payload = adjPayloadFile(repo, defPayload());
  assert.equal(defRun(repo, dir, ['--phase', '2', '--trigger', 'diff', '--discriminator',
    'plan-1', '--base', base, '--head', 'HEAD', '--payload', payload]).ok, true);
  // The CARRIED home, where a milestone close moves a queue member before the
  // prune deletes its phase directory.
  mkdirSync(join(dir, 'deferred', '3'), { recursive: true });
  writeFileSync(join(dir, 'deferred', '3', 'DEFERRED-plan-plan-1.json'),
    `${JSON.stringify({
      phase: '3', trigger: 'plan', discriminator: 'plan-1', round: 1,
      findings: [defPayload().findings[0], defPayload().findings[0]],
    })}\n`);

  const both = defList(dir);
  assert.equal(both.ok, true, JSON.stringify(both));
  assert.deepEqual(both.members.map((m) => m.path),
    ['deferred/3/DEFERRED-plan-plan-1.json', 'phases/2/DEFERRED-diff-plan-1.json']);
  assert.equal(both.findings, 3, 'the total is summed across homes, not per home');

  const one = defList(dir, ['--phase', '3']);
  assert.equal(one.phase, '3');
  assert.deepEqual(one.members.map((m) => m.phase), ['3']);
  assert.equal(one.findings, 2);
});

test('deferred list: an unreadable directory refuses instead of reporting an empty queue', {
  skip:
    typeof process.getuid === 'function' && process.getuid() === 0
      ? 'root bypasses mode bits'
      : false,
}, () => {
  // An unprovable queue is not an empty one - the disposition `decideGateHalt`
  // already states for a findings payload it could not parse. Reporting zero
  // here is what would let a land publish over a queue it never read.
  const { dir } = adjRepo();
  chmodSync(join(dir, 'phases', '2'), 0o000);
  try {
    const r = defList(dir);
    assert.equal(r.ok, false, JSON.stringify(r));
    assert.equal(r.reason, 'unprovable-queue');
    assert.deepEqual(r.unreadable.map((u) => u.path), ['phases/2']);
    assert.match(r.detail, /cannot be proven empty/);
    assert.equal(r._exit, 1, 'the exit code mirrors ok, so a shell arm can branch on it');
  } finally {
    chmodSync(join(dir, 'phases', '2'), 0o755);
  }
});

test('deferred list: a member that cannot be read lands on the same refusing list', () => {
  const { dir } = adjRepo();
  const pdir = join(dir, 'phases', '2');
  // Three ways a member stops being provable, and none of them is "nothing
  // deferred": bytes that do not parse, fields that spell another filename, and
  // a symlink wearing a member's name.
  writeFileSync(join(pdir, 'DEFERRED-diff-plan-1.json'), '{not json\n');
  writeFileSync(join(pdir, 'DEFERRED-plan-plan-2.json'), `${JSON.stringify({
    phase: '2', trigger: 'diff', discriminator: 'plan-2', round: 1, findings: [],
  })}\n`);
  writeFileSync(join(dir, 'elsewhere.json'), `${JSON.stringify({
    phase: '2', trigger: 'plan', discriminator: 'plan-3', round: 1, findings: [],
  })}\n`);
  symlinkSync(join(dir, 'elsewhere.json'), join(pdir, 'DEFERRED-plan-plan-3.json'));

  const r = defList(dir);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'unprovable-queue');
  assert.deepEqual(r.unreadable.map((u) => u.path), [
    'phases/2/DEFERRED-diff-plan-1.json',
    'phases/2/DEFERRED-plan-plan-2.json',
    'phases/2/DEFERRED-plan-plan-3.json',
  ]);
  assert.match(r.unreadable[1].detail, /its own fields spell DEFERRED-diff-plan-2\.json/,
    'a member whose fields name another fire would be cleared by that fire s record');
  assert.match(r.unreadable[2].detail, /not a regular file/);
  assert.deepEqual(r.members, []);
});

test('deferred list: an ADJUDICATION symlink does not settle a member', () => {
  // `recordForFire`s disposition, held on the read side: a symlink is not a
  // record, and accepting one would let a queue be cleared by a link to
  // anything at all.
  const { repo, dir, base } = adjRepo();
  const payload = adjPayloadFile(repo, defPayload());
  assert.equal(defRun(repo, dir, ['--phase', '2', '--trigger', 'diff', '--discriminator',
    'plan-1', '--base', base, '--head', 'HEAD', '--payload', payload]).ok, true);
  writeFileSync(join(dir, 'anything.json'), '{}\n');
  symlinkSync(join(dir, 'anything.json'),
    join(dir, 'phases', '2', 'ADJUDICATION-diff-plan-1.json'));

  const r = defList(dir);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.members.map((m) => m.path), ['phases/2/DEFERRED-diff-plan-1.json']);
});

test('status: the deferred block is on EVERY envelope, off the same derivation', () => {
  // ALWAYS present, unlike `cycle` and `drift`: this key is read by a refusal
  // surface, and a key absent in the empty state cannot tell "nothing is
  // deferred" from "this seam predates the queue" - which is the fail-open
  // answer on the one gate whose job is to refuse.
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Auth' }], phases: { 1: { plan: true } } });
  const empty = run(['status'], dir);
  assert.equal(empty.ok, true, JSON.stringify(empty));
  assert.deepEqual(empty.deferred, { members: [], findings: 0, unreadable: [] });

  writeFileSync(join(dir, 'phases', '1', 'DEFERRED-diff-plan-1.json'), `${JSON.stringify({
    phase: '1', trigger: 'diff', discriminator: 'plan-1', round: 1,
    findings: [defPayload().findings[0], defPayload().findings[0]],
  })}\n`);
  const queued = run(['status'], dir);
  assert.deepEqual(queued.deferred.members, [{
    phase: '1', trigger: 'diff', discriminator: 'plan-1', round: 1,
    path: 'phases/1/DEFERRED-diff-plan-1.json', findings: 2,
  }]);
  assert.equal(queued.deferred.findings, 2);
  // ONE derivation and one reader, so /cad-progress and /cad-land cannot
  // disagree about what is queued.
  assert.deepEqual(defList(dir).members, queued.deferred.members);

  writeFileSync(join(dir, 'phases', '1', 'ADJUDICATION-diff-plan-1.json'), '{}\n');
  const settled = run(['status'], dir);
  assert.deepEqual(settled.deferred, { members: [], findings: 0, unreadable: [] });
  assert.equal(settled.ok, true, 'a settled queue is not a degraded status');

  // NO cursor status value and no drift kind (D-05): a `Status:` outside AGREE
  // is reported as cursor drift and rewritten by the very next /cad-progress.
  assert.deepEqual(queued.drift, undefined);
});

test('status: an unreadable queue rides the envelope without failing the status', {
  skip:
    typeof process.getuid === 'function' && process.getuid() === 0
      ? 'root bypasses mode bits'
      : false,
}, () => {
  // The status answers about the roadmap; the block carries its own evidence.
  // Degrading the whole envelope would take /cad-progress down over a queue it
  // was only reporting on, and the refusal reads `unreadable` for itself.
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Auth' }], phases: { 1: { plan: true } } });
  chmodSync(join(dir, 'phases', '1'), 0o000);
  try {
    const r = run(['status'], dir);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual(r.deferred.unreadable.map((u) => u.path), ['phases/1']);
    assert.deepEqual(r.deferred.members, []);
  } finally {
    chmodSync(join(dir, 'phases', '1'), 0o755);
  }
});

// --- deferred carry: the queue OUT of the directory the prune deletes (D-10) -

/** Run the carry face. */
function defCarry(dir, args) {
  let stdout;
  let code = 0;
  try {
    stdout = execFileSync('node', [PLANNING, '--dir', dir, 'deferred', 'carry', ...args],
      { encoding: 'utf8' });
  } catch (e) { stdout = e.stdout; code = e.status; }
  return { ...JSON.parse(stdout), _exit: code };
}

/** Write a queue member straight into `phases/<phase>/`, no repository needed. */
function putMember(dir, phase, trigger, discriminator, round, findings, home = 'phases') {
  const file = join(dir, home, String(phase),
    `DEFERRED-${trigger}-${discriminator}${round > 1 ? `-r${round}` : ''}.json`);
  writeFileSync(file, `${JSON.stringify({
    phase: String(phase), trigger, discriminator, round,
    findings: Array.from({ length: findings }, () => defPayload().findings[0]),
  })}\n`);
  return file;
}

test('deferred carry: the unadjudicated members move, the settled ones are pruned with the phase', () => {
  const { dir } = adjRepo({ phase: 4 });
  putMember(dir, 4, 'diff', 'plan-1', 1, 2);
  putMember(dir, 4, 'plan', 'plan-2', 1, 1);
  writeFileSync(join(dir, 'phases', '4', 'ADJUDICATION-plan-plan-2.json'), '{}\n');

  const r = defCarry(dir, ['--phase', '4']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.carried, 1);
  assert.equal(r.findings, 2);
  assert.deepEqual(r.moved[0].from, 'phases/4/DEFERRED-diff-plan-1.json');
  assert.deepEqual(r.moved[0].to, 'deferred/4/DEFERRED-diff-plan-1.json');
  // A MOVE, never a copy: `--mode archive` would otherwise leave a second copy
  // under `_archive-<label>/` for the same fire.
  assert.equal(existsSync(join(dir, 'phases', '4', 'DEFERRED-diff-plan-1.json')), false);
  // The SETTLED one stays to be pruned with its phase - carrying it would put a
  // cleared finding in front of every later land.
  assert.equal(existsSync(join(dir, 'phases', '4', 'DEFERRED-plan-plan-2.json')), true);

  // The whole point: after the prune, the refusal still has something to read.
  rmSync(join(dir, 'phases', '4'), { recursive: true });
  const listed = defList(dir);
  assert.equal(listed.ok, true, JSON.stringify(listed));
  assert.deepEqual(listed.members.map((m) => m.path), ['deferred/4/DEFERRED-diff-plan-1.json']);
  assert.equal(listed.findings, 2);
});

test('deferred carry: a destination that already exists refuses, and moves NOTHING', () => {
  // All destinations are checked before the first rename, so a collision leaves
  // the queue in one home rather than half in each.
  const { dir } = adjRepo({ phase: 4 });
  putMember(dir, 4, 'diff', 'plan-1', 1, 1);
  assert.equal(defCarry(dir, ['--phase', '4']).ok, true);
  putMember(dir, 4, 'diff', 'plan-1', 1, 1);
  putMember(dir, 4, 'plan', 'plan-9', 1, 1);

  const r = defCarry(dir, ['--phase', '4']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'carry-exists');
  assert.match(r.detail, /deferred\/4\/DEFERRED-diff-plan-1\.json already exists/);
  assert.equal(existsSync(join(dir, 'phases', '4', 'DEFERRED-plan-plan-9.json')), true,
    'the collision moved the OTHER member anyway, splitting one phase queue across two homes');

  // A re-run after the colliding member is cleared finishes the job rather than
  // refusing forever: what is already carried is not re-carried.
  rmSync(join(dir, 'phases', '4', 'DEFERRED-diff-plan-1.json'));
  const again = defCarry(dir, ['--phase', '4']);
  assert.equal(again.ok, true, JSON.stringify(again));
  assert.deepEqual(again.moved.map((m) => m.to), ['deferred/4/DEFERRED-plan-plan-9.json']);
});

test('deferred carry: an unreadable phase refuses BEFORE the prune deletes it', {
  skip:
    typeof process.getuid === 'function' && process.getuid() === 0
      ? 'root bypasses mode bits'
      : false,
}, () => {
  // Sharper than the reader's refusal, and for a sharper reason: this call is
  // the last thing that runs before milestone-prune deletes the directory, so
  // carrying what was provable and saying nothing about the rest would destroy
  // exactly the members it could not read.
  const { dir } = adjRepo({ phase: 4 });
  putMember(dir, 4, 'diff', 'plan-1', 1, 1);
  writeFileSync(join(dir, 'phases', '4', 'DEFERRED-plan-plan-2.json'), '{not json\n');

  const r = defCarry(dir, ['--phase', '4']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'unprovable-queue');
  assert.deepEqual(r.moved, []);
  assert.match(r.hint, /BEFORE milestone-prune/);
  assert.equal(existsSync(join(dir, 'deferred', '4')), false,
    'a refused carry created the destination anyway');
});

test('deferred carry: a symlink squatting the destination is refused, never followed', () => {
  // milestone-prune --mode archive states the same rail for its archive root:
  // renameSync FOLLOWS a symlink, and would deposit committed artifacts
  // wherever it points.
  const { dir } = adjRepo({ phase: 4 });
  putMember(dir, 4, 'diff', 'plan-1', 1, 1);
  mkdirSync(join(dir, 'deferred'), { recursive: true });
  mkdirSync(join(dir, 'elsewhere'));
  symlinkSync(join(dir, 'elsewhere'), join(dir, 'deferred', '4'));

  const r = defCarry(dir, ['--phase', '4']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'carry-dest-unusable');
  assert.match(r.detail, /renameSync would follow out of the planning root/);
  assert.deepEqual(readdirSync(join(dir, 'elsewhere')), []);
});

test('deferred carry: a symlink squatting the PARENT is refused too', () => {
  // The sibling above pins the final component. `lstatSync` does not follow the
  // final component and follows every one before it, so a check aimed at
  // `deferred/<N>` alone answers "absent, go ahead" while `deferred/` is
  // already a link out of the tree - and the mkdir then builds the phase
  // directory THERE and the rename fills it. Two levels down takes two checks.
  const { dir } = adjRepo({ phase: 4 });
  putMember(dir, 4, 'diff', 'plan-1', 1, 1);
  mkdirSync(join(dir, 'elsewhere'));
  symlinkSync(join(dir, 'elsewhere'), join(dir, 'deferred'));

  const r = defCarry(dir, ['--phase', '4']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'carry-dest-unusable');
  assert.match(r.detail, /renameSync would follow out of the planning root/);
  assert.equal(existsSync(join(dir, 'elsewhere', '4')), false,
    'the carry built its destination outside the planning root');
  assert.deepEqual(readdirSync(join(dir, 'elsewhere')), []);
  assert.equal(existsSync(join(dir, 'phases', '4', 'DEFERRED-diff-plan-1.json')), true,
    'the queue member left the phase directory on a refused carry');
});

test('deferred carry: a phase with nothing queued is an answer, not a refusal', () => {
  const { dir } = adjRepo({ phase: 4 });
  const r = defCarry(dir, ['--phase', '4']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.moved, []);
  assert.equal(r.carried, 0);
  assert.equal(existsSync(join(dir, 'deferred')), false,
    'an empty carry minted a destination directory nothing accounts for');
});

// --- a carried member stays adjudicable AND re-armable (D-10) ---------------

test('adjudication + deferred record: a carried fire resolves its home in deferred/<N>/', () => {
  // The failure this closes: `deferred carry` moves the member out of
  // `phases/<N>/` so it survives the prune, and both write faces refused on
  // that now-deleted directory - leaving the finding that stops the land
  // permanently unclearable. An unclearable gate is one that gets bypassed.
  const { repo, dir, base } = adjRepo({ phase: 4 });
  putMember(dir, 4, 'diff', 'plan-1', 1, 1);
  assert.equal(defCarry(dir, ['--phase', '4']).ok, true);
  rmSync(join(dir, 'phases', '4'), { recursive: true });
  const fire = ['--phase', '4', '--trigger', 'diff', '--discriminator', 'plan-1',
    '--base', base, '--head', 'HEAD'];

  // The TRIAGE, in a later session, which is the whole point of the carry.
  const ruled = adjRun(repo, dir, [...fire, '--payload', adjPayloadFile(repo, adjPayload())]);
  assert.equal(ruled.ok, true, JSON.stringify(ruled));
  assert.equal(ruled.record, 'deferred/4/ADJUDICATION-diff-plan-1.json',
    'the record must land BESIDE the member it supersedes, or it supersedes nothing');
  assert.deepEqual(defList(dir).members, [], 'the carried member is still queued after its ruling');

  // The RE-ARM, off the same resolver: a triage that rules a blocker/high
  // survived has to record its narrowed round, and a `deferred record` still
  // refusing here would leave the cap reading unspent off a queue that could
  // never gain a round-2 member.
  const rearm = defRun(repo, dir, [...fire, '--round', '2',
    '--payload', adjPayloadFile(repo, defPayload(), 'round2.json')]);
  assert.equal(rearm.ok, true, JSON.stringify(rearm));
  assert.equal(rearm.record, 'deferred/4/DEFERRED-diff-plan-1-r2.json');
  assert.deepEqual(defList(dir).members.map((m) => m.round), [2],
    'round two is queued again; round one stays settled');
});

test('adjudication + deferred record: the live phase directory still wins', () => {
  // ORDER, not either-or. A live phase is where a fire's REVIEW sibling is, and
  // a stale `deferred/<N>/` left by an earlier close must not capture it.
  const { repo, dir, base } = adjRepo({ phase: 4 });
  mkdirSync(join(dir, 'deferred', '4'), { recursive: true });
  const fire = ['--phase', '4', '--trigger', 'diff', '--discriminator', 'plan-1',
    '--base', base, '--head', 'HEAD'];
  assert.equal(defRun(repo, dir, [...fire, '--payload', adjPayloadFile(repo, defPayload())]).record,
    'phases/4/DEFERRED-diff-plan-1.json');
  assert.equal(adjRun(repo, dir, [...fire, '--payload', adjPayloadFile(repo, adjPayload(), 'adj.json')]).record,
    'phases/4/ADJUDICATION-diff-plan-1.json');
});

test('adjudication + deferred record: with NEITHER home present the refusal names both', () => {
  const { repo, dir, base } = adjRepo({ phase: 4 });
  const fire = ['--phase', '9', '--trigger', 'diff', '--discriminator', 'plan-1',
    '--base', base, '--head', 'HEAD'];
  for (const [face, r] of [
    ['adjudication', adjRun(repo, dir, [...fire, '--payload', adjPayloadFile(repo, adjPayload())])],
    ['deferred record', defRun(repo, dir, [...fire, '--payload', adjPayloadFile(repo, defPayload(), 'q.json')])],
  ]) {
    assert.equal(r.ok, false, `${face}: ${JSON.stringify(r)}`);
    assert.equal(r.reason, 'no-phase-dir');
    assert.match(r.detail, /neither phases\/9\/ nor deferred\/9\//, face);
    assert.equal(existsSync(join(dir, 'phases', '9')), false);
    assert.equal(existsSync(join(dir, 'deferred', '9')), false,
      'a mistyped flag minted a home nothing else in the tree accounts for');
  }
});

test('adjudication + deferred record: a symlink at the carried home is refused, never followed', () => {
  // The lstatSync check moved WITH the resolution, so the second home gets the
  // same rail the first has: a symlink there is followed straight out of the
  // planning root by every writer after it.
  const { repo, dir, base } = adjRepo({ phase: 4 });
  rmSync(join(dir, 'phases', '4'), { recursive: true });
  mkdirSync(join(dir, 'deferred'), { recursive: true });
  mkdirSync(join(dir, 'elsewhere'));
  symlinkSync(join(dir, 'elsewhere'), join(dir, 'deferred', '4'));

  const r = adjRun(repo, dir, ['--phase', '4', '--trigger', 'diff', '--discriminator', 'plan-1',
    '--base', base, '--head', 'HEAD', '--payload', adjPayloadFile(repo, adjPayload())]);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'no-phase-dir');
  assert.deepEqual(readdirSync(join(dir, 'elsewhere')), []);
});
