// Zero-dep tests for lib/issue-decision.mjs - the pure core of the /cad-land
// tracker report (LND-01). Run: node --test cadence-core/bin/issue-decision.test.mjs.
// Nothing here spawns a process: the module does no I/O, and the gitlab row is
// proved against a CAPTURED sample of glab's documented JSON output precisely
// because `glab` is absent on this machine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOST_TABLE, classifyOrigin, scanIssueRefs, partitionIssues, decideIssueCheck,
} from './lib/issue-decision.mjs';

// --- classifyOrigin ---------------------------------------------------------

const TEA_HOSTS = ['git.jcrenshaw.dev'];

test('classifyOrigin reads BOTH url shapes for github and gitlab', () => {
  for (const [url, verdict] of [
    ['https://github.com/crenshawdev/cadence.git', 'github'],
    ['git@github.com:crenshawdev/cadence.git', 'github'],
    ['https://gitlab.com/org/team/repo.git', 'gitlab'],
    ['git@gitlab.com:org/team/repo.git', 'gitlab'],
  ]) {
    const c = classifyOrigin(url, TEA_HOSTS);
    assert.equal(c.verdict, verdict, url);
    assert.ok(c.slug && c.slug.endsWith('repo') || c.slug === 'crenshawdev/cadence', `${url} -> ${c.slug}`);
  }
  // The subgroup path survives whole: `org/team/repo` is the selector GitLab
  // takes, and truncating it to `org/repo` would name another project.
  assert.equal(classifyOrigin('https://gitlab.com/org/team/repo.git', []).slug, 'org/team/repo');
  // A port and an ssh:// scheme do not change the hostname classification.
  assert.equal(classifyOrigin('ssh://git@github.com:22/org/repo.git', []).verdict, 'github');
});

test('classifyOrigin: a tea-login host is forgejo in both url shapes', () => {
  for (const url of [
    'https://git.jcrenshaw.dev/crenshawdev/cadence.git',
    'git@git.jcrenshaw.dev:crenshawdev/cadence.git',
    'ssh://git@git.jcrenshaw.dev:2222/crenshawdev/cadence.git',
  ]) {
    const c = classifyOrigin(url, TEA_HOSTS);
    assert.equal(c.verdict, 'forgejo', url);
    assert.equal(c.slug, 'crenshawdev/cadence');
    assert.equal(c.host, 'git.jcrenshaw.dev');
  }
});

test('classifyOrigin: a login sharing the origin\'s registrable domain is forgejo', () => {
  // The shape this repository has: an SSH endpoint on its own subdomain, on a
  // non-standard port, against a login keyed on the web host. Host equality
  // took the no-login arm here on every land (TRK-01).
  for (const url of [
    'ssh://git@ssh.jcrenshaw.dev:2222/crenshawdev/cadence.git',
    'git@ssh.jcrenshaw.dev:crenshawdev/cadence.git',
  ]) {
    const c = classifyOrigin(url, TEA_HOSTS);
    assert.equal(c.verdict, 'forgejo', url);
    assert.equal(c.host, 'ssh.jcrenshaw.dev', 'the ORIGIN host is reported, not the login\'s');
    assert.equal(c.slug, 'crenshawdev/cadence');
  }
});

test('classifyOrigin: a shared PUBLIC two-label suffix is not a shared domain', () => {
  // Sharing `github.io` makes two unrelated registrants, and an unguarded call
  // would query whichever login tea's config-file order picks (D-07). Each of
  // these falls back to the answer that ships today.
  for (const [url, hosts] of [
    ['https://acme.github.io/org/repo.git', ['other.github.io']],
    ['https://acme.gitlab.io/org/repo.git', ['other.gitlab.io']],
    ['https://acme.pages.dev/org/repo.git', ['other.pages.dev']],
    ['https://git.acme.co.uk/org/repo.git', ['git.other.co.uk']],
    ['https://git.acme.com.au/org/repo.git', ['git.other.com.au']],
  ]) {
    assert.equal(classifyOrigin(url, hosts).verdict, 'no-login', url);
  }
  // ...and a host with fewer than two labels matches only by exact equality.
  assert.equal(classifyOrigin('https://forge/org/repo.git', ['forge']).verdict, 'forgejo');
  assert.equal(classifyOrigin('https://forge/org/repo.git', ['forge.example.com']).verdict, 'no-login');
});

test('classifyOrigin: no-login and unrecognized are DIFFERENT verdicts', () => {
  const url = 'https://forge.example.com/org/repo.git';
  // tea WAS consulted and named no login for this host: the fix is a login, and
  // the line has to be able to say so.
  assert.equal(classifyOrigin(url, TEA_HOSTS).verdict, 'no-login');
  assert.equal(classifyOrigin(url, []).verdict, 'no-login');
  // tea could not be consulted at all - no reading exists to recognize it.
  assert.equal(classifyOrigin(url, null).verdict, 'unrecognized');
  assert.equal(classifyOrigin(url, undefined).verdict, 'unrecognized');
});

test('classifyOrigin: an absent origin is no-remote, and garbage is unrecognized', () => {
  for (const absent of ['', '   ', null, undefined, 42]) {
    assert.equal(classifyOrigin(absent, TEA_HOSTS).verdict, 'no-remote', String(absent));
  }
  // Parses as no host/path pair at all.
  assert.equal(classifyOrigin('not-a-url', TEA_HOSTS).verdict, 'unrecognized');
  // Parses, but names no owner/repo - so no selector could bind the call.
  const bare = classifyOrigin('https://github.com/cadence.git', TEA_HOSTS);
  assert.equal(bare.verdict, 'unrecognized');
  assert.equal(bare.slug, null);
});

test('a hostname carrying a control character never reaches the ONE-line reason', () => {
  // The hostname classes are `[^/:]+`, which admits a newline and an ESC, and
  // the host is interpolated into the unrecognized and no-login reasons - so a
  // hostile origin could print several lines, or move the cursor, where
  // criterion 3 promises exactly one line.
  const HOSTILE = ['\nINJECTED', '\r\nINJECTED', '\u001b[31mred', '\u0007', '\u2028INJECTED', '\u009b'];
  const ONE_LINE = /^[^\u0000-\u001f\u007f-\u009f\u2028\u2029]*$/;
  for (const evil of HOSTILE) {
    for (const url of [
      `https://evil.example${evil}/org/repo.git`,     // schemed
      `https://evil.example${evil}:2222/org/repo.git`, // schemed and ported
      `git@evil.example${evil}:org/repo.git`,          // scp-shaped
    ]) {
      const c = classifyOrigin(url, TEA_HOSTS);
      assert.equal(c.verdict, 'unrecognized', url);
      // Rejected, never cleaned: nothing about that host is reported back.
      assert.equal(c.host, null, url);
      assert.equal(c.slug, null, url);
      const { reason } = decideIssueCheck({ enabled: true, classification: c });
      assert.match(reason, ONE_LINE, JSON.stringify(reason));
      assert.equal(reason.split('\n').length, 1, JSON.stringify(reason));
      assert.ok(!reason.includes('INJECTED'), JSON.stringify(reason));
    }
  }
  // The control character is the ONLY thing that changed: the same hosts
  // without it still classify, so the guard is not rejecting everything.
  assert.equal(classifyOrigin('https://github.com/org/repo.git', TEA_HOSTS).verdict, 'github');
  assert.equal(classifyOrigin('git@github.com:org/repo.git', TEA_HOSTS).verdict, 'github');
});

// --- scanIssueRefs ----------------------------------------------------------

test('scanIssueRefs finds the three forms, dedupes, sorts, and mints no near-miss', () => {
  const log = [
    'commit deadbeef1234567890abcdef1234567890abcdef',
    '    feat(1-1): the tracker enters the spine (#47)',
    '',
    'commit 7b1466bfeedfacefeedfacefeedfacefeedfaced',
    '    fix(1-2): closes #42 and fixes #7',
    '',
    'commit 1234567890abcdef1234567890abcdef12345678',
    '    docs: mention #42 again, plus abc#999 and ##3 and #12abc',
    '    ## 3 things this does not mint',
  ].join('\n');
  assert.deepEqual(scanIssueRefs(log), [7, 42, 47]);
});

test('scanIssueRefs is total on non-text and empty input', () => {
  for (const bad of ['', null, undefined, 5, {}]) assert.deepEqual(scanIssueRefs(bad), []);
});

// --- partitionIssues --------------------------------------------------------

const COMPLETE = {
  complete: true,
  records: [{ number: 42, state: 'open' }, { number: 47, state: 'closed' }],
  detail: null,
};

test('partitionIssues answers open / closed / not-found, and not-found is never closed', () => {
  const p = partitionIssues([42, 47, 99], COMPLETE);
  assert.deepEqual(p, { open: [42], closed: [47], notFound: [99] });
  assert.ok(!p.closed.includes(99), '#99 is absent from the tracker, not closed on it');
});

test('partitionIssues answers NOTHING over a fetch that is not complete', () => {
  // The whole point: a truncated page and an empty tracker carry the same
  // records, so an incomplete read may not produce a not-found verdict.
  for (const bad of [
    { complete: false, records: [], detail: 'truncated' },
    { complete: false, records: [{ number: 42, state: 'open' }], detail: null },
    { records: [] }, null, undefined, 'nope', {},
  ]) {
    assert.equal(partitionIssues([42, 99], bad), null, JSON.stringify(bad));
  }
});

// --- the per-host table: argv, paging, and the normalizers ------------------

test('every row carries its own paging flag with the limit it states', () => {
  const paging = { github: '--limit', gitlab: '--per-page', forgejo: '--limit' };
  for (const [host, row] of Object.entries(HOST_TABLE)) {
    const argv = row.argv('org/repo', row.limit);
    const i = argv.indexOf(paging[host]);
    assert.ok(i >= 0, `${host} argv must carry ${paging[host]}: ${argv.join(' ')}`);
    assert.equal(argv[i + 1], String(row.limit), `${host} paging flag must carry the row's limit`);
    assert.ok(row.limit > 30, `${host} limit must defeat the CLI's own 30-row default`);
    // The repo selector is always present: cwd alone lets a --dir elsewhere
    // report another project's tracker, and tea infers nothing at all.
    assert.ok(argv.includes('--repo') && argv.includes('org/repo'), `${host} argv must name the repo`);
  }
  assert.deepEqual(Object.keys(HOST_TABLE), ['github', 'gitlab', 'forgejo']);
  assert.deepEqual([HOST_TABLE.github.bin, HOST_TABLE.gitlab.bin, HOST_TABLE.forgejo.bin],
    ['gh', 'glab', 'tea']);
});

test('the gitlab row is proved against a CAPTURED glab sample, with no glab spawned', () => {
  // The shape gitlab-org/cli's `issue list` json arm prints (docs/source/issue/
  // list.md, read 2026-08-15): the API issue objects, numbered by `iid` and
  // stated as opened/closed. `glab` is not installed here; nothing in this file
  // may run one.
  const sample = JSON.stringify([
    { id: 90001, iid: 42, state: 'opened', title: 'still open' },
    { id: 90002, iid: 47, state: 'closed', title: 'done' },
  ]);
  const row = HOST_TABLE.gitlab;
  assert.deepEqual(row.argv('org/team/repo', row.limit),
    ['issue', 'list', '--repo', 'org/team/repo', '--all', '--output', 'json', '--per-page', '100']);
  const got = row.normalize(sample, row.limit);
  assert.equal(got.complete, true);
  assert.deepEqual(got.records, [{ number: 42, state: 'open' }, { number: 47, state: 'closed' }]);
  // `opened` normalizes to `open`, so the partition speaks one vocabulary.
  assert.deepEqual(partitionIssues([42, 47], got), { open: [42], closed: [47], notFound: [] });
});

test('the github and forgejo normalizers read their CLIs own captured shapes', () => {
  // gh, live sample 2026-08-15: numeric `number`, UPPERCASE state.
  const gh = HOST_TABLE.github.normalize('[{"number":14156,"state":"OPEN"},{"number":14153,"state":"CLOSED"}]', 200);
  assert.deepEqual(gh.records, [{ number: 14156, state: 'open' }, { number: 14153, state: 'closed' }]);
  assert.equal(gh.complete, true);
  assert.deepEqual(HOST_TABLE.github.argv('org/repo', 200),
    ['issue', 'list', '--repo', 'org/repo', '--state', 'all', '--json', 'number,state', '--limit', '200']);
  // tea, live sample 2026-08-15: `index` is a STRING, state lowercase.
  const tea = HOST_TABLE.forgejo.normalize('[{"index":"171","state":"open"},{"index":"115","state":"closed"}]', 50);
  assert.deepEqual(tea.records, [{ number: 171, state: 'open' }, { number: 115, state: 'closed' }]);
  assert.deepEqual(HOST_TABLE.forgejo.argv('org/repo', 50),
    ['issues', 'list', '--repo', 'org/repo', '--state', 'all', '--fields', 'index,state', '--output', 'json', '--limit', '50']);
});

test('a response TRUNCATED at the limit is unreadable, never an issue list', () => {
  const rows = Array.from({ length: 50 }, (_, i) => ({ index: String(i + 1), state: 'open' }));
  const got = HOST_TABLE.forgejo.normalize(JSON.stringify(rows), 50);
  assert.equal(got.complete, false);
  assert.deepEqual(got.records, [], 'an incomplete read carries NO records');
  assert.match(got.detail, /truncated/);
  // One row short of the page is the whole tracker and answers normally.
  assert.equal(HOST_TABLE.forgejo.normalize(JSON.stringify(rows.slice(0, 49)), 50).complete, true);
  // An EMPTY tracker is complete and empty - the case truncation must not imitate.
  assert.deepEqual(HOST_TABLE.forgejo.normalize('[]', 50), { complete: true, records: [], detail: null });
});

test('a RENAMED field is unreadable, not an empty record set', () => {
  for (const [host, body] of [
    ['github', '[{"id":14156,"state":"OPEN"}]'],
    ['gitlab', '[{"iid":42,"status":"opened"}]'],
    ['forgejo', '[{"number":"171","state":"open"}]'],
  ]) {
    const got = HOST_TABLE[host].normalize(body, HOST_TABLE[host].limit);
    assert.equal(got.complete, false, host);
    assert.deepEqual(got.records, [], host);
    assert.ok(got.detail, host);
  }
  // And the non-JSON / non-array / non-text shapes answer the same way.
  for (const body of ['not json', '{"issues":[]}', null, 7]) {
    const got = HOST_TABLE.github.normalize(body, 200);
    assert.equal(got.complete, false, String(body));
    assert.deepEqual(got.records, []);
  }
  // An unreadable read can never reach a not-found verdict.
  assert.equal(partitionIssues([42], HOST_TABLE.github.normalize('[{"id":42}]', 200)), null);
});

// --- decideIssueCheck: every reason distinct --------------------------------

test('all nine reasons are distinct strings, and only `query` proceeds', () => {
  const forgejo = { verdict: 'forgejo', host: 'git.example.com', slug: 'org/repo' };
  const cases = {
    'key off': { enabled: false },
    'no remote': { enabled: true, classification: { verdict: 'no-remote', host: null, slug: null } },
    unrecognized: { enabled: true, classification: { verdict: 'unrecognized', host: 'forge.example.com', slug: 'o/r' } },
    'no login': { enabled: true, classification: { verdict: 'no-login', host: 'forge.example.com', slug: 'o/r' } },
    'log unreadable': { enabled: true, classification: forgejo, logOk: false, bin: 'tea' },
    'cli absent': { enabled: true, classification: forgejo, logOk: true, bin: 'tea', cliPresent: false },
    'nonzero exit': { enabled: true, classification: forgejo, logOk: true, bin: 'tea', cliPresent: true, exitOk: false },
    // "it hung" and "it refused" are different things to go fix, so the call
    // bound gets its own line rather than borrowing the nonzero one.
    'killed at the bound': { enabled: true, classification: forgejo, logOk: true, bin: 'tea', cliPresent: true, exitOk: false, timedOut: true },
    unreadable: {
      enabled: true, classification: forgejo, logOk: true, bin: 'tea', cliPresent: true, exitOk: true,
      fetched: { complete: false, detail: 'response was not JSON' },
    },
  };
  const reasons = new Map();
  for (const [name, args] of Object.entries(cases)) {
    const d = decideIssueCheck(args);
    // The key set false is `off`, not `skip`: cad-land prints every skip
    // reason verbatim, and the requirement is that the off switch makes step 1
    // say nothing about the tracker at all.
    assert.equal(d.action, name === 'key off' ? 'off' : 'skip', name);
    assert.equal(typeof d.reason, 'string');
    assert.ok(d.reason.length > 0, name);
    assert.ok(!reasons.has(d.reason), `${name} reuses the reason of ${reasons.get(d.reason)}`);
    reasons.set(d.reason, name);
  }
  assert.equal(reasons.size, 9);
  // The key-off line says what it did NOT do, since "no forge CLI ran" is the
  // property the seam test asserts with a spawn marker.
  assert.match(cases['key off'] && decideIssueCheck(cases['key off']).reason, /issue_check is off/);
  // ONE action carries the silent arm, so a caller never has to read the prose
  // to know whether to print it.
  const offs = Object.values(cases).filter((args) => decideIssueCheck(args).action === 'off');
  assert.equal(offs.length, 1, 'only the key-off case may answer `off`');

  // The full-information happy path, and the STAGED calls the seam makes on the
  // way to it - an unknown later stage is not a reason to stop.
  assert.equal(decideIssueCheck({ enabled: true }).action, 'query');
  assert.equal(decideIssueCheck({ enabled: true, classification: forgejo }).action, 'query');
  assert.equal(decideIssueCheck({
    enabled: true, classification: forgejo, logOk: true, bin: 'tea', cliPresent: true, exitOk: true,
    fetched: { complete: true, detail: null },
  }).action, 'query');
});

test('decideIssueCheck is total: no arguments at all still answers', () => {
  // Anything that is not the literal true is the off arm, and it still carries
  // its reason string - nobody prints it, and the JSON stays readable.
  assert.equal(decideIssueCheck().action, 'off');
  assert.equal(decideIssueCheck({}).action, 'off');
  assert.equal(decideIssueCheck({ enabled: 'yes' }).action, 'off', 'only the literal true enables it');
  assert.match(decideIssueCheck().reason, /issue_check is off/);
});
