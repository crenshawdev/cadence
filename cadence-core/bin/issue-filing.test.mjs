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
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync, symlinkSync,
} from 'node:fs';
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
 *
 * `prepare` runs against the fresh repository directory after it is built and
 * before the seam is spawned - the hook a case needs when its point is the
 * state of `.planning/` at the moment the seam reaches it (a held
 * `FILED.md.lock`, say), which cannot be planted after `repoWith` returns
 * because `repoWith` runs inside this helper.
 */
function run(args, { git = GITHUB, bins = ['gh'], stub = {}, prepare = null } = {}) {
  const stubDir = tmp('bin');
  const argvLog = join(tmp('log'), 'argv');
  const createLog = join(tmp('log'), 'creates');
  for (const name of bins) stubBin(stubDir, name, { ...stub, createLog });
  const dir = repoWith(git);
  if (prepare) prepare(dir);
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

/** The severities a `survived` ruling must name a fix commit for, and the only
 * ones `payloadFor` attaches one to. Below them a survived finding was
 * confirmed and NOT fixed and carries no commit id, which is the state
 * lib/adjudication-record.mjs now stores rather than refusing - so attaching a
 * commit unconditionally here would make every fixture below assert the old
 * rule instead of the current one. */
const HALTING = ['blocker', 'high'];

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
      ...(verdict === 'survived' && HALTING.includes(f.severity)
        ? { fix_commit: 'a1b2c3d' } : {}),
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

/** Plant `.planning/DECLINED.md` holding one row per finding - the shape the
 * seam's own `file` face writes, so a case that plants it is asserting against
 * the same grammar a previous fire would have left behind. */
const declinedWith = (findings) => (dir) => {
  mkdirSync(join(dir, '.planning'), { recursive: true });
  const rows = findings.map((f) => `- 2026-08-25 github acme/widget ${fingerprint(f)}: ${issueTitle(f)}`);
  writeFileSync(join(dir, '.planning', 'DECLINED.md'),
    `# Declined: findings this repository said no to\n\n${rows.join('\n')}\n`);
};

const declinedText = (dir) => {
  const p = join(dir, '.planning', 'DECLINED.md');
  return existsSync(p) ? readFileSync(p, 'utf8') : '';
};

const listCalls = (calls) => calls.filter((c) => / list /.test(` ${c} `));
const createCalls = (calls) => calls.filter((c) => / create /.test(` ${c} `));

// --- unfixed: ONE lookup per fire, whatever the finding count ----------------

test('a five-finding fire spawns NO forge child at all', () => {
  // Criterion 11's falsifiable form, counted off the stub's own log. The ask
  // used to cost one `issue list`; the decline set is a local file now, so the
  // honest count is zero rather than one.
  const payload = payloadFile(payloadFor(FIVE.map((f) => [f, 'survived'])));
  const { status, envelope, calls } = run(['unfixed', '--payload', payload]);
  assert.equal(status, 0);
  assert.equal(envelope.ok, true);
  assert.equal(envelope.raised, 5);
  assert.equal(envelope.findings.length, 5);
  assert.equal(listCalls(calls).length, 0, calls.join('\n'));
  assert.equal(createCalls(calls).length, 0, calls.join('\n'));
});

test('the decline set is read even where no forge CLI resolves', () => {
  // The strongest form of "local": the ask still answers on a PATH holding no
  // forge binary at all, because nothing it needs lives on a tracker. The
  // envelope still refuses - `unfixed` names the provider and repo - but it
  // refuses for the FORGE being unreachable, never for the declines being
  // unknown, and the reason names which.
  const payload = payloadFile(payloadFor([[FIVE[0], 'survived']]));
  const { envelope, calls } = run(['unfixed', '--payload', payload], { bins: [] });
  assert.equal(envelope.ok, false);
  assert.equal(envelope.reason, 'no-cli');
  assert.equal(calls.length, 0, calls.join('\n'));
});

test('a finding DECLINED.md already carries is absent from the answer', () => {
  // The decline that must not be asked about twice (criterion 11).
  const payload = payloadFile(payloadFor(FIVE.map((f) => [f, 'survived'])));
  const { envelope } = run(['unfixed', '--payload', payload],
    { prepare: declinedWith([FIVE[1], FIVE[3]]) });
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
    { prepare: declinedWith([FIVE[1]]) });
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

test('a survived medium whose fix is already committed is never put to the user', () => {
  // AC4, reproducing the one entry of this shape on disk today:
  // .planning/_archive-v3.7.3/1/ADJUDICATION-risk_surface-plan-2.json holds a
  // `medium survived` naming commit 4a1af326. A tracker issue asking whether
  // to fix it would be asking about work that is already committed, and what
  // reaches the forge is what this row has always asserted - the five that are
  // genuinely unfixed. What MOVED is where the removal happens: it is
  // lib/filing-decision.mjs's now (LND-02), so the fixed entry is never in the
  // set this face is handed, and the two figures below say so.
  const fixed = finding('src/f.mjs', 60, 'medium', 'the retry loop has no ceiling');
  const composed = payloadFor([...FIVE.map((f) => [f, 'survived']), [fixed, 'survived']]);
  composed.voices[0].rulings[5].fix_commit = '4a1af326';
  const { status, envelope } = run(['unfixed', '--payload', payloadFile(composed)]);
  assert.equal(status, 0);
  assert.equal(envelope.ok, true);
  // `raised` still counts what `unfixedFindings` answered with - five now,
  // because the fixed entry is not in that answer - and `already_fixed` still
  // counts what THIS face removed, which is none of them. The removal is not
  // folded into the decline count, which stays tracker-derived.
  assert.equal(envelope.raised, 5);
  assert.equal(envelope.already_fixed, 0);
  assert.equal(envelope.already_declined, 0);
  assert.deepEqual(envelope.findings.map((e) => e.finding.file),
    ['src/a.mjs', 'src/b.mjs', 'src/c.mjs', 'src/d.mjs', 'src/e.mjs']);
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

test('a decline set far past any old page size is read whole', () => {
  // The case that used to REFUSE. A forge lookup could only see one page, so a
  // decline set bigger than it made the fire un-answerable; a file has no page.
  // 500 rows is well past the 200 the forgejo arm could ever return.
  const many = Array.from({ length: 500 },
    (_, i) => finding(`src/x${i}.mjs`, 1, 'low', `c${i}`));
  const payload = payloadFile(payloadFor([[FIVE[0], 'survived'], [many[499], 'survived']]));
  const { status, envelope } = run(['unfixed', '--payload', payload],
    { prepare: declinedWith(many) });
  assert.equal(status, 0);
  assert.equal(envelope.ok, true);
  assert.equal(envelope.already_declined, 1);
  // The 500th row was seen, so the finding matching it never reaches the ask.
  assert.deepEqual(envelope.findings.map((e) => e.finding.file), ['src/a.mjs']);
});

test('a missing DECLINED.md is an empty decline set, not a refusal', () => {
  // The state every repository starts in. Asking about every finding is the
  // correct answer here, and refusing would make the first fire un-answerable.
  const payload = payloadFile(payloadFor(FIVE.map((f) => [f, 'survived'])));
  const { status, envelope } = run(['unfixed', '--payload', payload]);
  assert.equal(status, 0);
  assert.equal(envelope.ok, true);
  assert.equal(envelope.already_declined, 0);
  assert.equal(envelope.findings.length, 5);
});

test('an unreadable DECLINED.md refuses rather than re-asking what was declined', () => {
  // The posture the old incomplete-lookup arm held: a fire that cannot tell
  // what was already declined does not guess. A directory where the file is
  // expected reads as EISDIR, which is not ENOENT and so is not "none yet".
  const payload = payloadFile(payloadFor([[FIVE[0], 'survived']]));
  const { status, envelope, calls } = run(['unfixed', '--payload', payload], {
    prepare: (dir) => mkdirSync(join(dir, '.planning', 'DECLINED.md'), { recursive: true }),
  });
  assert.equal(status, 1);
  assert.equal(envelope.ok, false);
  assert.equal(envelope.reason, 'declines-unreadable');
  assert.match(envelope.detail, /DECLINED\.md/);
  assert.ok(envelope.hint);
  assert.equal(envelope.findings, undefined);
  assert.equal(createCalls(calls).length, 0, calls.join('\n'));
});

// --- file: one create per entry, the declined ones labelled ------------------

const dispositions = (pairs) => payloadFile({
  entries: pairs.map(([f, disposition]) => ({ finding: f, disposition })),
});

test('three accepts and two declines make exactly THREE creates, none labelled', () => {
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
  assert.equal(creates.length, 3, calls.join('\n'));
  // NO create carries the decline label, because no decline reaches the forge.
  assert.equal(creates.filter((c) => c.includes(DECLINE_LABEL)).length, 0, creates.join('\n'));
  // The three that were created are the three accepted, and the two declined
  // fingerprints appear in no create argv at all.
  for (const f of [FIVE[0], FIVE[2], FIVE[4]]) {
    assert.ok(creates.some((c) => c.includes(fingerprint(f))), `accepted ${fingerprint(f)}`);
  }
  for (const f of [FIVE[1], FIVE[3]]) {
    assert.ok(!creates.some((c) => c.includes(fingerprint(f))), `declined ${fingerprint(f)} reached the forge`);
  }
});

test('a declined finding lands in DECLINED.md and never in FILED.md', () => {
  const payload = dispositions([[FIVE[0], 'accept'], [FIVE[1], 'decline']]);
  const { status, dir } = run(['file', '--payload', payload]);
  assert.equal(status, 0);
  const declined = declinedText(dir);
  const filed = filedText(dir);
  assert.ok(declined.includes(fingerprint(FIVE[1])), 'the decline row is missing');
  assert.ok(!declined.includes(fingerprint(FIVE[0])), 'an accept leaked into DECLINED.md');
  assert.ok(filed.includes(fingerprint(FIVE[0])), 'the accepted row is missing');
  assert.ok(!filed.includes(fingerprint(FIVE[1])), 'a decline leaked into FILED.md');
});

test('a decline written by `file` is what the next `unfixed` reads back', () => {
  // The round trip that is the whole point: the two faces share one record, so
  // a question answered once is never asked again. Same repository directory
  // for both runs, which is what `run`'s deterministic tmp naming gives.
  const f = FIVE[1];
  const { dir } = run(['file', '--payload', dispositions([[f, 'decline']])]);
  const payload = payloadFile(payloadFor([[f, 'survived']]));
  const { envelope } = run(['unfixed', '--payload', payload],
    { prepare: (d) => writeFileSync(join(d, '.planning', 'DECLINED.md'), declinedText(dir)) });
  assert.equal(envelope.ok, true);
  assert.equal(envelope.already_declined, 1);
  assert.deepEqual(envelope.findings, []);
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
  // Only ACCEPTS reach the forge, so the stub's third create is FIVE[4] - by
  // then FIVE[0] and FIVE[2] have landed and both declines have gone straight
  // to DECLINED.md without a call.
  assert.deepEqual(envelope.filed.map((f) => f.fingerprint),
    [fingerprint(FIVE[0]), fingerprint(FIVE[1]), fingerprint(FIVE[2]), fingerprint(FIVE[3])]);
  assert.deepEqual(envelope.unfiled.map((f) => f.fingerprint), [fingerprint(FIVE[4])]);
  assert.match(envelope.detail, /4 of 5 were filed and 1 were not/);
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

test('a fire of declines ALONE writes no FILED.md, and two DECLINED.md rows', () => {
  const payload = dispositions([[FIVE[0], 'decline'], [FIVE[1], 'decline']]);
  const { status, envelope, dir, calls } = run(['file', '--payload', payload]);
  assert.equal(status, 0);
  assert.equal(envelope.declined, 2);
  assert.equal(filedText(dir), '');
  const bullets = declinedText(dir).split('\n').filter((l) => l.startsWith('- '));
  assert.equal(bullets.length, 2, declinedText(dir));
  // And it cost nothing remote: a fire of declines alone touches no forge.
  assert.equal(createCalls(calls).length, 0, calls.join('\n'));
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
  // The mirror LANDED, and the envelope says so rather than leaving the caller
  // to assume it - which is the other half of the case below.
  assert.equal(envelope.mirrored, true, JSON.stringify(envelope));
  assert.equal(envelope.mirror_reason, null);
});

test('a create failure whose mirror ALSO failed says so, and the hint stops the retry losing it', () => {
  // The worst of the three outcomes was reported as the middle one: two issues
  // exist on the tracker, `.planning/FILED.md` names neither, and the envelope
  // still listed them as `filed` while telling the caller to re-run only the
  // `unfiled` ones. Nothing then ever revisits them, so they are unreachable
  // through recall forever. A held lock is the cheap way to make the mirror
  // refuse: `withPlanningFileLock` waits out its own bound and returns
  // `filed-locked` rather than throwing.
  const payload = dispositions([
    [FIVE[0], 'accept'], [FIVE[1], 'accept'], [FIVE[2], 'accept'],
  ]);
  const { status, envelope, dir } = run(['file', '--payload', payload], {
    stub: { failAt: 3 },
    prepare: (d) => writeFileSync(join(d, '.planning', 'FILED.md.lock'), ''),
  });
  assert.equal(status, 1);
  assert.equal(envelope.reason, 'create-failed');
  // The failure is still reported as what it is: a create that did not land.
  assert.equal(envelope.filed.length, 2);
  assert.equal(envelope.unfiled.length, 1);
  // And the discarded result is now on the envelope.
  assert.equal(envelope.mirrored, false, JSON.stringify(envelope));
  assert.equal(envelope.mirror_reason, 'filed-locked');
  assert.ok(envelope.mirror_detail && envelope.mirror_detail.includes('FILED.md.lock'),
    envelope.mirror_detail);
  assert.equal(filedText(dir), '', 'the mirror really did not write');
  // The hint tells the truth about BOTH halves: re-run the unfiled ones, and
  // do not re-file the filed ones whose pointer is missing.
  assert.match(envelope.hint, /ONLY the unfiled entries/);
  assert.match(envelope.hint, /recall pointer was NOT written/);
  assert.match(envelope.hint, /\.planning\/FILED\.md/);
  assert.match(envelope.hint, /[Dd]o not re-file them/);
});

test('the create-failed hint is honest that the failed create may have LANDED', () => {
  // `run` collapses a refusal, a SIGKILL on the timeout and a transport failure
  // into one `{ok:false}`, and a forge can accept and create an issue before
  // the client stops listening. The old hint said "re-run the unfiled entries"
  // unconditionally, and since this seam's only decline lookup reads a local
  // file that no create ever writes, it can never see an accepted issue - so
  // the retry filed a duplicate. The fix is an honest instruction, and the token that makes it
  // followable is the fingerprint the issue TITLE already carries.
  const payload = dispositions([
    [FIVE[0], 'accept'], [FIVE[1], 'accept'], [FIVE[2], 'accept'],
  ]);
  const { envelope } = run(['file', '--payload', payload], { stub: { failAt: 3 } });
  assert.equal(envelope.reason, 'create-failed');
  const failed = fingerprint(FIVE[2]);
  assert.equal(envelope.unfiled[0].fingerprint, failed);
  assert.ok(envelope.hint.includes(failed), envelope.hint);
  assert.match(envelope.hint, /AMBIGUOUS rather than known-failed/, envelope.hint);
  assert.match(envelope.hint, /BEFORE re-filing it/, envelope.hint);
  assert.match(envelope.hint, /SEARCH acme\/widget's issues/, envelope.hint);
  // The instruction is runnable only because the title carries that token, so
  // assert the two agree rather than trusting the sentence.
  assert.ok(issueTitle(FIVE[2]).includes(failed), issueTitle(FIVE[2]));
  // No extra network call was bought to resolve the ambiguity: still one create
  // attempt per entry up to the failure, and no list call on the `file` face.
  const { calls } = run(['file', '--payload', payload], { stub: { failAt: 3 } });
  assert.equal(createCalls(calls).length, 3, calls.join('\n'));
  assert.deepEqual(listCalls(calls), []);
});

test('`unfixed` writes nothing at all - the ask is not a filing', () => {
  const payload = payloadFile(payloadFor(FIVE.map((f) => [f, 'survived'])));
  const { dir } = run(['unfixed', '--payload', payload]);
  assert.equal(filedText(dir), '');
});

// --- the decline record is the ONLY record, so losing a row is losing an answer
// Every case here is a way a decline could go missing while the run still
// reported success. They are grouped because they share one consequence: a
// question the user already settled is asked again, forever.

test('an unreadable EXISTING DECLINED.md is never replaced by this batch alone', () => {
  // The catch used to fold every read error into an empty file and then WRITE,
  // so one mode-000 record under a writable `.planning` erased every row in it.
  const { status, envelope, dir } = run(['file', '--payload', dispositions([[FIVE[0], 'decline']])], {
    prepare: (d) => {
      declinedWith([FIVE[2], FIVE[3]])(d);
      chmodSync(join(d, '.planning', 'DECLINED.md'), 0o000);
    },
  });
  // Whatever the run reports, the rows that were there must still be there.
  chmodSync(join(dir, '.planning', 'DECLINED.md'), 0o644);
  const text = readFileSync(join(dir, '.planning', 'DECLINED.md'), 'utf8');
  assert.ok(text.includes(fingerprint(FIVE[2])), 'an existing decline was erased');
  assert.ok(text.includes(fingerprint(FIVE[3])), 'an existing decline was erased');
  assert.equal(status, 1, JSON.stringify(envelope));
  assert.equal(envelope.ok, false);
});

test('a row the grammar rejects refuses rather than reporting the batch recorded', () => {
  // `appendDeclinedRow` refuses by returning the text unchanged, which is right
  // for a pure function and silent for its caller. A slug with a space is the
  // cheapest way to reach that arm through real configuration.
  const { status, envelope, dir } = run(['file', '--payload', dispositions([[FIVE[0], 'decline']])],
    { git: { forge_provider: 'github', forge_repo: 'acme/the widget' } });
  assert.equal(status, 1, JSON.stringify(envelope));
  assert.equal(envelope.ok, false);
  assert.match(JSON.stringify(envelope), new RegExp(fingerprint(FIVE[0])));
  assert.equal(declinedText(dir), '', 'a refused row must not half-land');
});

test('a DANGLING SYMLINK at DECLINED.md refuses; it is an entry, not an absence', () => {
  // readFileSync answers ENOENT for both, and only one of them means "nothing
  // has been declined yet". The other is a record this process cannot reach.
  const payload = payloadFile(payloadFor([[FIVE[0], 'survived']]));
  const { status, envelope } = run(['unfixed', '--payload', payload], {
    prepare: (d) => {
      mkdirSync(join(d, '.planning'), { recursive: true });
      symlinkSync(join(d, '.planning', 'nowhere.md'), join(d, '.planning', 'DECLINED.md'));
    },
  });
  assert.equal(status, 1);
  assert.equal(envelope.reason, 'declines-unreadable');
  assert.equal(envelope.findings, undefined);
});

test('a conflicted DECLINED.md refuses rather than reading past the damage', () => {
  // The grammar skips any line that is not a row, which is right for a human
  // note and wrong for a row a merge mangled: the fingerprint leaves the set
  // silently and the gate re-asks a settled question.
  const payload = payloadFile(payloadFor([[FIVE[0], 'survived']]));
  const { status, envelope } = run(['unfixed', '--payload', payload], {
    prepare: (d) => {
      declinedWith([FIVE[0]])(d);
      const f = join(d, '.planning', 'DECLINED.md');
      writeFileSync(f, `${readFileSync(f, 'utf8')}<<<<<<< HEAD\n- a row\n=======\n- another\n>>>>>>> other\n`);
    },
  });
  assert.equal(status, 1);
  assert.equal(envelope.reason, 'declines-conflicted');
  assert.match(envelope.hint, /BOTH sides/);
});

test('a create failure AFTER a decline still lands that decline row', () => {
  // The refuted half of the same review: the mirror runs BEFORE the refusal is
  // emitted, so a decline accumulated ahead of a failed create is written.
  const payload = dispositions([[FIVE[1], 'decline'], [FIVE[0], 'accept']]);
  const { status, envelope, dir } = run(['file', '--payload', payload], { stub: { failAt: 1 } });
  assert.equal(status, 1);
  assert.equal(envelope.reason, 'create-failed');
  assert.ok(declinedText(dir).includes(fingerprint(FIVE[1])),
    'the decline was reported filed and never written');
});
