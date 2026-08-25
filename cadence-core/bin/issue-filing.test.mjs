// Zero-dep tests for issue-filing.mjs (the filing seam, CAP-01/CAP-02).
// Run: node --test cadence-core/bin/issue-filing.test.mjs.
//
// Harness: a temp repository holding a `.planning/config.json` with a persisted
// forge record, plus stub executables in a temp dir PREPENDED to the child's
// PATH - the pattern bin/forge.test.mjs and bin/issue-check.test.mjs already
// use, and for the same reason: PATH injection exercises the PRODUCTION
// resolver (lib/on-path.mjs reads no Cadence override, deliberately) rather
// than a test-only branch beside it. Nothing in the seam honours a test-only
// override, so there is none to honour.
//
// The stub written here is NOT `issue-check.test.mjs`'s exported one. That one
// answers every invocation with one `body`, and the cases below need a LIST
// call and a CREATE call to answer differently - a create that exits nonzero
// while the list before it exited zero is the whole of criterion 9. Same
// pattern, one extra branch.
//
// Every stub appends its argv to `$CAD_ARGV_LOG`, so "exactly one list call for
// a five-finding fire" is an assertion about a file on disk rather than about
// something the seam reported about itself.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DECLINE_LABEL, fingerprint, issueTitle } from './lib/filing-decision.mjs';

const SEAM = join(dirname(fileURLToPath(import.meta.url)), 'issue-filing.mjs');

/** A user-global layer that does not exist, so a developer's own
 *  ~/.claude/cadence/config.json can never answer one of these cases. */
const NO_GLOBAL = join(mkdtempSync(join(tmpdir(), 'cad-if-')), 'no-global.json');

const tmp = (p) => mkdtempSync(join(tmpdir(), `cad-if-${p}-`));

/** A repository whose `.planning/config.json` carries a persisted forge record. */
function repoWith(git) {
  const dir = tmp('repo');
  mkdirSync(join(dir, '.planning'), { recursive: true });
  writeFileSync(join(dir, '.planning', 'config.json'), JSON.stringify({ git }));
  return dir;
}

const GITHUB = { forge_provider: 'github', forge_repo: 'acme/widget' };
const FORGEJO = { forge_provider: 'forgejo', forge_repo: 'acme/widget', forge_host: 'git.example.test' };

/**
 * A forge-CLI stub: it logs its argv, answers a `list` with `listBody`, answers
 * a `login` with `loginBody`, and exits 1 on the `failAt`-th create.
 *
 * `echo`, never a heredoc, for the reason issue-check.test.mjs's own stub
 * states: /bin/sh has no `cat` builtin, and a stub whose PATH lost it prints
 * nothing while still exiting zero.
 */
function stubBin(dir, name, { listBody = '[]', loginBody = '[]', failAt = 0, createLog }) {
  const q = (text) => `'${String(text).replace(/'/g, `'\\''`)}'`;
  const script = ['#!/bin/sh',
    // ONE log line per invocation whatever the argv holds: an issue BODY carries
    // newlines by construction, and a raw `echo` split one call across five
    // lines - which made `--label` look absent from a create that carried it.
    `{ echo "${name} $*" | tr '\\n' ' '; echo; } >> "$CAD_ARGV_LOG"`,
    `if [ "$1" = "login" ]; then echo ${q(loginBody)}; exit 0; fi`,
    'case "$2" in',
    `  list) echo ${q(listBody)}; exit 0 ;;`,
    '  create)',
    `    echo x >> ${q(createLog)}`,
    `    n=$(wc -l < ${q(createLog)})`,
    `    if [ "$n" -eq ${failAt || 0} ]; then exit 1; fi`,
    // Every one of the three prints a human-readable line on a successful
    // create and none of them prints JSON, which is why no row reads an issue
    // number back. The stub prints one so the leak case below is not vacuous.
    '    echo "https://tracker.test/acme/widget/issues/$n"; exit 0 ;;',
    'esac',
    'exit 0',
  ].join('\n');
  const file = join(dir, name);
  writeFileSync(file, script);
  chmodSync(file, 0o755);
}

/**
 * Run the seam with `bin` stubbed, and return the envelope plus what the stub
 * was actually asked to do.
 *
 * The stub dir is PREPENDED to the real PATH rather than replacing it: the
 * stub is a `/bin/sh` script and needs `wc` to count its own creates, and a
 * prepended dir already answers `onPath` and `execFileSync` before the real
 * binary of the same name is reached. `bins: []` is how a case asks for a PATH
 * where no forge CLI resolves at all.
 */
function run(args, { git = GITHUB, bins = ['gh'], stub = {} } = {}) {
  const stubDir = tmp('bin');
  const argvLog = join(tmp('log'), 'argv');
  const createLog = join(tmp('log'), 'creates');
  for (const name of bins) stubBin(stubDir, name, { ...stub, createLog });
  const dir = repoWith(git);
  const env = {
    ...process.env,
    CADENCE_GLOBAL_CONFIG: NO_GLOBAL,
    CAD_ARGV_LOG: argvLog,
    PATH: bins.length ? `${stubDir}:${process.env.PATH}` : stubDir,
  };
  // `--dir` goes AFTER the subcommand word and before the rest, so a case whose
  // point is a flag in LAST position keeps it there.
  const withDir = (a, d) => [a[0], '--dir', d, ...a.slice(1)];
  const calls = () => (existsSync(argvLog)
    ? readFileSync(argvLog, 'utf8').trim().split('\n').filter(Boolean) : []);
  try {
    const out = execFileSync(process.execPath, [SEAM, ...withDir(args, dir)],
      { encoding: 'utf8', env, cwd: tmpdir() });
    return { status: 0, dir, envelope: JSON.parse(out), calls: calls() };
  } catch (e) {
    return { status: e.status, dir, envelope: JSON.parse(e.stdout), calls: calls() };
  }
}

// --- fixtures ---------------------------------------------------------------

const finding = (file, line, severity, claim) => ({
  file, line, severity, claim, failure_scenario: `what breaks: ${claim}`,
});

/** A composed adjudication payload over `[finding, verdict]` pairs. */
const payloadFor = (pairs) => ({
  voices: [{
    voice: 'sonnet',
    model: 'claude-sonnet-4-5',
    returned: { findings: pairs.map(([f]) => f) },
    rulings: pairs.map(([f, verdict], i) => ({
      finding: i,
      ruling: verdict,
      claim: f.claim,
      failure_scenario: f.failure_scenario,
      ...(verdict === 'survived' ? { fix_commit: 'a1b2c3d' } : {}),
      ...(verdict === 'refuted'
        ? { counter_evidence: { file: 'src/z.mjs', line: 1, note: 'already guarded' } }
        : {}),
    })),
  }],
});

/** Write any object to a temp file and return the path. */
function payloadFile(obj) {
  const p = join(tmp('payload'), 'payload.json');
  writeFileSync(p, JSON.stringify(obj));
  return p;
}

/** Five findings the gate will not fix now: all below blocker/high. */
const FIVE = [
  finding('src/a.mjs', 10, 'medium', 'the retry count is three with no reason stated'),
  finding('src/b.mjs', 20, 'low', 'the header names a file that moved'),
  finding('src/c.mjs', 30, 'medium', 'the comment says thirty and the code says sixty'),
  finding('src/d.mjs', 40, 'low', 'the flag is documented in two places'),
  finding('src/e.mjs', 50, 'low', 'the timeout has no stated basis'),
];

const listOf = (findings) => JSON.stringify(
  findings.map((f, i) => ({ number: i + 1, title: issueTitle(f) })));

const listCalls = (calls) => calls.filter((c) => / list /.test(` ${c} `));
const createCalls = (calls) => calls.filter((c) => / create /.test(` ${c} `));

// --- unfixed: ONE lookup per fire, whatever the finding count ----------------

test('a five-finding fire makes exactly ONE list call and no create call', () => {
  // Criterion 11's falsifiable form, counted off the stub's own log.
  const payload = payloadFile(payloadFor(FIVE.map((f) => [f, 'survived'])));
  const { status, envelope, calls } = run(['unfixed', '--payload', payload]);
  assert.equal(status, 0);
  assert.equal(envelope.ok, true);
  assert.equal(envelope.raised, 5);
  assert.equal(envelope.findings.length, 5);
  assert.equal(listCalls(calls).length, 1, calls.join('\n'));
  assert.equal(createCalls(calls).length, 0, calls.join('\n'));
});

test('the one list call is label-filtered and carries the page size', () => {
  const payload = payloadFile(payloadFor([[FIVE[0], 'survived']]));
  const { calls } = run(['unfixed', '--payload', payload]);
  const list = listCalls(calls)[0];
  assert.match(list, new RegExp(`--label ${DECLINE_LABEL}`));
  assert.match(list, /--state all/);
  assert.match(list, /--limit 200/);
  assert.match(list, /--repo acme\/widget/);
});

test('a finding the lookup already carries is absent from the answer', () => {
  // The decline that must not be asked about twice (criterion 11).
  const payload = payloadFile(payloadFor(FIVE.map((f) => [f, 'survived'])));
  const { envelope } = run(['unfixed', '--payload', payload],
    { stub: { listBody: listOf([FIVE[1], FIVE[3]]) } });
  assert.equal(envelope.ok, true);
  assert.equal(envelope.raised, 5);
  assert.equal(envelope.already_declined, 2);
  assert.deepEqual(envelope.findings.map((e) => e.finding.file),
    ['src/a.mjs', 'src/c.mjs', 'src/e.mjs']);
});

test('a decline recognized by (file, claim) survives the file shifting by a line', () => {
  // The same finding raised again 30 lines lower is the SAME decline.
  const moved = { ...FIVE[1], line: 999 };
  const payload = payloadFile(payloadFor([[moved, 'survived']]));
  const { envelope } = run(['unfixed', '--payload', payload],
    { stub: { listBody: listOf([FIVE[1]]) } });
  assert.deepEqual(envelope.findings, []);
  assert.equal(envelope.already_declined, 1);
});

test('a survived blocker never reaches the ask, so the fire has nothing to file', () => {
  const payload = payloadFile(payloadFor([
    [finding('src/a.mjs', 1, 'blocker', 'the lock is never released'), 'survived'],
  ]));
  const { status, envelope } = run(['unfixed', '--payload', payload]);
  assert.equal(status, 0);
  assert.equal(envelope.ok, true);
  assert.deepEqual(envelope.findings, []);
  assert.equal(envelope.raised, 0);
});

test('each returned finding carries its fingerprint BESIDE it, never inside it', () => {
  const payload = payloadFile(payloadFor([[FIVE[0], 'survived']]));
  const { envelope } = run(['unfixed', '--payload', payload]);
  const entry = envelope.findings[0];
  assert.equal(entry.fingerprint, fingerprint(FIVE[0]));
  assert.equal(entry.finding.fingerprint, undefined);
  assert.equal(entry.finding.claim, FIVE[0].claim);
});

// --- criterion 12: an incomplete lookup refuses the fire ---------------------

test('a lookup that filled its page refuses, and no create call is made', () => {
  const full = Array.from({ length: 200 }, (_, i) => ({
    number: i + 1, title: issueTitle(finding(`src/x${i}.mjs`, 1, 'low', `c${i}`)),
  }));
  const payload = payloadFile(payloadFor(FIVE.map((f) => [f, 'survived'])));
  const { status, envelope, calls } = run(['unfixed', '--payload', payload],
    { stub: { listBody: JSON.stringify(full) } });
  assert.equal(status, 1);
  assert.equal(envelope.ok, false);
  assert.equal(envelope.reason, 'incomplete-lookup');
  assert.match(envelope.detail, /filled the 200-row page/);
  assert.ok(envelope.hint);
  assert.equal(createCalls(calls).length, 0, calls.join('\n'));
  // The refusal says the page was filled and NOT that nothing was declined.
  assert.equal(envelope.findings, undefined);
});

test('a list call that exits nonzero refuses rather than reading no declines', () => {
  // A stub whose `list` arm answers with a non-array is the same class: the
  // read is not trustworthy, so the fire stops.
  const payload = payloadFile(payloadFor([[FIVE[0], 'survived']]));
  const { status, envelope } = run(['unfixed', '--payload', payload],
    { stub: { listBody: 'not json at all' } });
  assert.equal(status, 1);
  assert.equal(envelope.reason, 'incomplete-lookup');
  assert.match(envelope.detail, /response was not JSON/);
});

// --- file: one create per entry, the declined ones labelled ------------------

const dispositions = (pairs) => payloadFile({
  entries: pairs.map(([f, disposition]) => ({ finding: f, disposition })),
});

test('three accepts and two declines make five creates, and exactly two carry the label', () => {
  const payload = dispositions([
    [FIVE[0], 'accept'], [FIVE[1], 'decline'], [FIVE[2], 'accept'],
    [FIVE[3], 'decline'], [FIVE[4], 'accept'],
  ]);
  const { status, envelope, calls } = run(['file', '--payload', payload]);
  assert.equal(status, 0);
  assert.equal(envelope.ok, true);
  assert.equal(envelope.accepted, 3);
  assert.equal(envelope.declined, 2);
  const creates = createCalls(calls);
  assert.equal(creates.length, 5, calls.join('\n'));
  const labelled = creates.filter((c) => c.includes(`--label ${DECLINE_LABEL}`));
  assert.equal(labelled.length, 2, creates.join('\n'));
  // And they are the two the user declined, not any two.
  for (const f of [FIVE[1], FIVE[3]]) {
    assert.ok(labelled.some((c) => c.includes(fingerprint(f))), fingerprint(f));
  }
  for (const f of [FIVE[0], FIVE[2], FIVE[4]]) {
    assert.ok(!labelled.some((c) => c.includes(fingerprint(f))), fingerprint(f));
  }
});

test('every create supplies a body, on every entry', () => {
  // gh PROMPTS for one when it is absent, which hangs the child inside a step.
  const payload = dispositions([[FIVE[0], 'accept'], [FIVE[1], 'decline']]);
  const { calls } = run(['file', '--payload', payload]);
  for (const c of createCalls(calls)) assert.match(c, /--body /);
});

test('a create exiting nonzero refuses and NAMES the findings that were not filed', () => {
  // Criterion 9: no finding is dropped because the tracker could not be reached.
  const payload = dispositions([
    [FIVE[0], 'accept'], [FIVE[1], 'decline'], [FIVE[2], 'accept'],
    [FIVE[3], 'decline'], [FIVE[4], 'accept'],
  ]);
  const { status, envelope, calls } = run(['file', '--payload', payload],
    { stub: { failAt: 3 } });
  assert.equal(status, 1);
  assert.equal(envelope.ok, false);
  assert.equal(envelope.reason, 'create-failed');
  assert.deepEqual(envelope.filed.map((f) => f.fingerprint),
    [fingerprint(FIVE[0]), fingerprint(FIVE[1])]);
  assert.deepEqual(envelope.unfiled.map((f) => f.fingerprint),
    [fingerprint(FIVE[2]), fingerprint(FIVE[3]), fingerprint(FIVE[4])]);
  assert.match(envelope.detail, /2 of 5 were filed and 3 were not/);
  assert.ok(envelope.hint);
  // Stop at the FIRST failure: nothing after it is attempted.
  assert.equal(createCalls(calls).length, 3, calls.join('\n'));
});

// --- the forge record is read, and every refusal precedes the first create ---

test('the forgejo arm carries --login on both calls, resolved off the persisted host', () => {
  const logins = JSON.stringify([
    { name: 'other', url: 'https://elsewhere.test', user: 'nobody' },
    { name: 'mine', url: 'https://git.example.test', user: 'me' },
  ]);
  const payload = dispositions([[FIVE[0], 'accept']]);
  const { status, envelope, calls } = run(['file', '--payload', payload],
    { git: FORGEJO, bins: ['tea'], stub: { loginBody: logins } });
  assert.equal(status, 0);
  assert.equal(envelope.ok, true);
  assert.match(createCalls(calls)[0], /--login mine/);
  assert.match(createCalls(calls)[0], new RegExp('issues create'));
});

test('no login naming the persisted host refuses BEFORE any create', () => {
  const logins = JSON.stringify([{ name: 'other', url: 'https://elsewhere.test', user: 'nobody' }]);
  const payload = dispositions([[FIVE[0], 'accept']]);
  const { status, envelope, calls } = run(['file', '--payload', payload],
    { git: FORGEJO, bins: ['tea'], stub: { loginBody: logins } });
  assert.equal(status, 1);
  assert.equal(envelope.reason, 'no-login');
  assert.match(envelope.detail, /git\.example\.test/);
  assert.ok(envelope.hint);
  assert.equal(createCalls(calls).length, 0, calls.join('\n'));
});

test('an unconfigured forge refuses by naming the unset keys, spawning nothing', () => {
  const payload = dispositions([[FIVE[0], 'accept']]);
  const { status, envelope, calls } = run(['file', '--payload', payload], { git: {} });
  assert.equal(status, 1);
  assert.equal(envelope.reason, 'no-forge');
  assert.match(envelope.detail, /git\.forge_provider/);
  assert.ok(envelope.hint);
  assert.deepEqual(calls, []);
});

test('a configured forge whose CLI does not resolve refuses without spawning', () => {
  const payload = dispositions([[FIVE[0], 'accept']]);
  const { status, envelope, calls } = run(['file', '--payload', payload], { bins: [] });
  assert.equal(status, 1);
  assert.equal(envelope.reason, 'no-cli');
  assert.match(envelope.detail, /gh does not resolve on PATH/);
  assert.ok(envelope.hint);
  assert.deepEqual(calls, []);
});

test('warnings from the config merge ride every envelope', () => {
  const payload = payloadFile(payloadFor([[FIVE[0], 'survived']]));
  const { envelope } = run(['unfixed', '--payload', payload]);
  assert.ok(Array.isArray(envelope.warnings));
});

// --- the payload door -------------------------------------------------------

test('an absent payload file refuses before the forge is touched', () => {
  const { status, envelope, calls } = run(['unfixed', '--payload', '/no/such/payload.json']);
  assert.equal(status, 1);
  assert.equal(envelope.reason, 'no-payload');
  assert.ok(envelope.hint);
  assert.deepEqual(calls, []);
});

test('a payload that is not JSON refuses naming the file', () => {
  const p = join(tmp('payload'), 'payload.json');
  writeFileSync(p, 'this is prose, not a payload');
  const { status, envelope, calls } = run(['unfixed', '--payload', p]);
  assert.equal(status, 1);
  assert.equal(envelope.reason, 'bad-payload');
  assert.match(envelope.detail, /is not JSON/);
  assert.deepEqual(calls, []);
});

test('BOTH payload arms redact a credential out of the path they name', () => {
  // The shape planning-lease-check.test.mjs's no-staged-set case pins, applied
  // to the other input that reaches a `detail` as caller-supplied argv: the
  // credential goes and NOTHING ELSE does. Both arms are asserted in one test
  // because the defect was that the two arms disagreed - `no-payload` redacted
  // the message and not the path, `bad-payload` redacted neither. No network:
  // the paths are local and `.invalid` is reserved.
  const secret = 'cad:s3cr3t-tok@host.invalid';

  // Arm 1, no-payload: the path does not exist, so `readFileSync`'s own ENOENT
  // message quotes the credential-bearing path back verbatim as well.
  const absent = `/nonexistent/${secret}/payload.json`;
  const gone = run(['unfixed', '--payload', absent]).envelope;
  assert.equal(gone.reason, 'no-payload');
  assert.equal(gone.detail.includes('s3cr3t-tok'), false, gone.detail);
  assert.equal(gone.detail.includes('cad:'), false, gone.detail);
  // The rest of the message survives, or the redaction has traded one useless
  // envelope for another: the host, the path, and the failure's own wording.
  assert.ok(gone.detail.includes('host.invalid'), gone.detail);
  assert.ok(gone.detail.includes('/nonexistent/'), gone.detail);
  assert.ok(gone.detail.includes('payload.json'), gone.detail);
  assert.match(gone.detail, /no such file or directory/, gone.detail);

  // Arm 2, bad-payload: the file EXISTS at a credential-bearing path and holds
  // prose, so only this seam's own `${file}` interpolation carries the secret.
  const home = join(tmp('cred'), secret);
  mkdirSync(home, { recursive: true });
  const present = join(home, 'payload.json');
  writeFileSync(present, 'this is prose, not a payload');
  const bad = run(['unfixed', '--payload', present]).envelope;
  assert.equal(bad.reason, 'bad-payload');
  assert.equal(bad.detail.includes('s3cr3t-tok'), false, bad.detail);
  assert.equal(bad.detail.includes('cad:'), false, bad.detail);
  assert.ok(bad.detail.includes('host.invalid'), bad.detail);
  assert.ok(bad.detail.includes('payload.json'), bad.detail);
  assert.match(bad.detail, /is not JSON/, bad.detail);
});

test('a payload buildEntries refuses names the entry, and no forge call is made', () => {
  const bad = payloadFor([[FIVE[0], 'survived']]);
  bad.voices[0].rulings[0].ruling = 'not-a-ruling';
  const { status, envelope, calls } = run(['unfixed', '--payload', payloadFile(bad)]);
  assert.equal(status, 1);
  assert.equal(envelope.reason, 'bad-payload');
  assert.match(envelope.detail, /voices\[0\]\.rulings\[0\]\.ruling/);
  assert.deepEqual(calls, []);
});

test('a dispositions payload with an unknown disposition refuses before any create', () => {
  const p = payloadFile({ entries: [{ finding: FIVE[0], disposition: 'maybe' }] });
  const { status, envelope, calls } = run(['file', '--payload', p]);
  assert.equal(status, 1);
  assert.equal(envelope.reason, 'bad-payload');
  assert.match(envelope.detail, /entries\[0\]\.disposition/);
  assert.deepEqual(calls, []);
});

test('a dispositions entry whose finding has no claim refuses: it is half the fingerprint', () => {
  const p = payloadFile({ entries: [{ finding: { file: 'src/a.mjs' }, disposition: 'accept' }] });
  const { status, envelope } = run(['file', '--payload', p]);
  assert.equal(status, 1);
  assert.match(envelope.detail, /entries\[0\]\.finding\.claim/);
});

test('a bare --payload refuses at the declared door, naming the flag', () => {
  const { status, envelope } = run(['unfixed', '--payload']);
  assert.equal(status, 1);
  assert.equal(envelope.ok, false);
  assert.equal(envelope.detail, '--payload');
  assert.ok(envelope.hint);
});

test('an unknown subcommand reports usage naming both faces', () => {
  const { status, envelope } = run(['fyle', '--payload', 'x']);
  assert.equal(status, 1);
  assert.equal(envelope.reason, 'usage');
  assert.match(envelope.detail, /unfixed/);
  assert.match(envelope.detail, /file/);
});

// --- no byte of a child's output reaches an envelope -------------------------

test('a CLI that prints a URL on create leaks none of it onto the envelope', () => {
  const payload = dispositions([[FIVE[0], 'accept']]);
  const { envelope } = run(['file', '--payload', payload]);
  const json = JSON.stringify(envelope);
  assert.ok(!json.includes('tracker.test'), json);
});

// --- the recall pointer: ACCEPTED only, and that is criterion 1 --------------

/** `.planning/FILED.md` as text, or '' when the seam never wrote one. */
const filedText = (dir) => {
  const p = join(dir, '.planning', 'FILED.md');
  return existsSync(p) ? readFileSync(p, 'utf8') : '';
};

test('three accepts and two declines leave exactly THREE bullets in FILED.md', () => {
  // The falsifying case for "no artifact anywhere holds a declined one": a test
  // over successful ACCEPTS alone passes vacuously, so this one asserts the
  // absence of the two declined titles and fingerprints as well.
  const payload = dispositions([
    [FIVE[0], 'accept'], [FIVE[1], 'decline'], [FIVE[2], 'accept'],
    [FIVE[3], 'decline'], [FIVE[4], 'accept'],
  ]);
  const { status, envelope, dir } = run(['file', '--payload', payload]);
  assert.equal(status, 0);
  assert.equal(envelope.ok, true);
  const text = filedText(dir);
  const bullets = text.split('\n').filter((l) => l.startsWith('- '));
  assert.equal(bullets.length, 3, text);
  for (const f of [FIVE[0], FIVE[2], FIVE[4]]) {
    assert.ok(text.includes(fingerprint(f)), `accepted ${fingerprint(f)} is absent`);
    assert.ok(text.includes(issueTitle(f)), `accepted title is absent`);
  }
  for (const f of [FIVE[1], FIVE[3]]) {
    assert.ok(!text.includes(fingerprint(f)), `declined ${fingerprint(f)} leaked`);
    assert.ok(!text.includes(f.claim), `declined claim leaked`);
  }
});

test('a fire of declines ALONE writes no FILED.md at all', () => {
  const payload = dispositions([[FIVE[0], 'decline'], [FIVE[1], 'decline']]);
  const { status, envelope, dir } = run(['file', '--payload', payload]);
  assert.equal(status, 0);
  assert.equal(envelope.declined, 2);
  assert.equal(filedText(dir), '');
});

test('the bullet is a POINTER: the title and no finding body', () => {
  const payload = dispositions([[FIVE[0], 'accept']]);
  const { dir } = run(['file', '--payload', payload]);
  const text = filedText(dir);
  assert.match(text, /^- \d{4}-\d{2}-\d{2} github acme\/widget [0-9a-f]+: /m);
  assert.ok(!text.includes(FIVE[0].failure_scenario), 'the failure scenario is not a pointer');
});

test('a second fire appends rather than replacing the first run\'s rows', () => {
  const { dir } = run(['file', '--payload', dispositions([[FIVE[0], 'accept']])]);
  // The second run reuses the SAME repository directory, which is what makes
  // this an append test rather than two independent writes.
  const stubDir = tmp('bin');
  const createLog = join(tmp('log'), 'creates');
  stubBin(stubDir, 'gh', { createLog });
  execFileSync(process.execPath,
    [SEAM, 'file', '--dir', dir, '--payload', dispositions([[FIVE[2], 'accept']])],
    { encoding: 'utf8', cwd: tmpdir(),
      env: { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL,
        CAD_ARGV_LOG: join(tmp('log'), 'argv'), PATH: `${stubDir}:${process.env.PATH}` } });
  const text = filedText(dir);
  assert.ok(text.includes(fingerprint(FIVE[0])), 'the first run\'s row survived');
  assert.ok(text.includes(fingerprint(FIVE[2])), 'the second run\'s row landed');
  assert.equal(text.split('\n').filter((l) => l.startsWith('- ')).length, 2, text);
});

test('a create that fails part way still mirrors the issues that DID land', () => {
  // The tracker holds two issues; a pointer they never got would be a second
  // loss on top of the first.
  const payload = dispositions([
    [FIVE[0], 'accept'], [FIVE[1], 'accept'], [FIVE[2], 'accept'],
  ]);
  const { status, envelope, dir } = run(['file', '--payload', payload], { stub: { failAt: 3 } });
  assert.equal(status, 1);
  assert.equal(envelope.reason, 'create-failed');
  const text = filedText(dir);
  assert.equal(text.split('\n').filter((l) => l.startsWith('- ')).length, 2, text);
  assert.ok(!text.includes(fingerprint(FIVE[2])), 'the unfiled one is not mirrored');
});

test('`unfixed` writes nothing at all - the ask is not a filing', () => {
  const payload = payloadFile(payloadFor(FIVE.map((f) => [f, 'survived'])));
  const { dir } = run(['unfixed', '--payload', payload]);
  assert.equal(filedText(dir), '');
});
