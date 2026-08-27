// Zero-dep tests for lib/issue-decision.mjs - the pure core of the /cad-land
// tracker report (LND-01). Run: node --test cadence-core/bin/issue-decision.test.mjs.
// Nothing here spawns a process: the module does no I/O, and the gitlab row is
// proved against a CAPTURED sample of glab's documented JSON output precisely
// because `glab` is absent on this machine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HOST_TABLE, classifyOrigin, teaLoginNameForHost, scanIssueRefs, partitionIssues, decideIssueCheck,
} from './lib/issue-decision.mjs';

// --- classifyOrigin: a SETUP-TIME DEFAULT BUILDER, not a land-time resolver --
//
// Phase 1 D-01 demoted this function. It has ONE caller, `bin/forge.mjs
// detect`, which offers its verdict and slug as the two defaults the user
// confirms at project setup; `issue-check.mjs` no longer calls it at all and
// resolves the persisted `git.forge_*` record instead. So the `teaLogins`
// parameter and the `forgejo` and `no-login` verdicts it produced are gone -
// setup probes no login (D-06), so nothing could ever pass a reading again.
// The `no-login` LINE survives, in decideIssueCheck, asking a different
// question: does any tea login serve the instance host the user CONFIRMED.

/** A `tea login list` reading as `teaLoginNameForHost` takes it: the login
 *  records exactly as tea printed them. Three fields identify a login's forge -
 *  its own `name`, its API `url`'s hostname and its `ssh_host` - and the answer
 *  is the record's NAME, which is the only thing `tea --login` accepts.
 *
 *  `ssh_host` names the SSH endpoint and not the web host on purpose: that is
 *  this repository's real shape, and it is what lets a user who confirmed
 *  either name resolve the same login. */
const TEA_LOGINS = [
  { name: 'git.jcrenshaw.dev', url: 'https://git.jcrenshaw.dev', ssh_host: 'ssh.jcrenshaw.dev', user: 'john' },
];

test('classifyOrigin reads BOTH url shapes for github and gitlab', () => {
  for (const [url, verdict] of [
    ['https://github.com/crenshawdev/cadence.git', 'github'],
    ['git@github.com:crenshawdev/cadence.git', 'github'],
    ['https://gitlab.com/org/team/repo.git', 'gitlab'],
    ['git@gitlab.com:org/team/repo.git', 'gitlab'],
  ]) {
    const c = classifyOrigin(url);
    assert.equal(c.verdict, verdict, url);
    assert.ok(c.slug && c.slug.endsWith('repo') || c.slug === 'crenshawdev/cadence', `${url} -> ${c.slug}`);
  }
  // The subgroup path survives whole: `org/team/repo` is the selector GitLab
  // takes, and truncating it to `org/repo` would name another project.
  assert.equal(classifyOrigin('https://gitlab.com/org/team/repo.git').slug, 'org/team/repo');
  // A port and an ssh:// scheme do not change the hostname classification.
  assert.equal(classifyOrigin('ssh://git@github.com:22/org/repo.git').verdict, 'github');
});

test('classifyOrigin: any other host is `unrecognized` and STILL carries its slug', () => {
  // Not a failure - the ordinary self-hosted case. `forge.mjs detect` offers
  // the slug as a default to confirm and recommends no provider beside it,
  // because guessing a forge from a hostname's first label is a heuristic
  // nothing here can be right about. The user is being asked anyway.
  for (const url of [
    'https://git.jcrenshaw.dev/crenshawdev/cadence.git',
    'git@git.jcrenshaw.dev:crenshawdev/cadence.git',
    'ssh://git@ssh.jcrenshaw.dev:2222/crenshawdev/cadence.git',
    'https://gitlab.example.com/org/repo.git',
  ]) {
    const c = classifyOrigin(url);
    assert.equal(c.verdict, 'unrecognized', url);
    assert.ok(c.slug, url);
  }
  assert.equal(classifyOrigin('ssh://git@ssh.jcrenshaw.dev:2222/crenshawdev/cadence.git').slug,
    'crenshawdev/cadence');
});

test('classifyOrigin takes ONE argument: a second is ignored, not consulted', () => {
  // The falsifier for the deletion. While the `teaLogins` parameter existed, a
  // reading naming this host answered `forgejo`; the verdict must not move now,
  // whatever a caller passes.
  const url = 'https://forge.example.com/org/repo.git';
  assert.equal(classifyOrigin(url).verdict, 'unrecognized');
  assert.equal(classifyOrigin(url, TEA_LOGINS).verdict, 'unrecognized');
  assert.equal(classifyOrigin(url, []).verdict, 'unrecognized');
  assert.equal(classifyOrigin.length, 1, 'classifyOrigin declares one parameter');
  // And no verdict this function can produce is `forgejo` or `no-login` any
  // more - those two were the login-derived arms.
  for (const url2 of ['https://forge.example.com/o/r.git', '', 'not-a-url',
    'https://github.com/o/r.git', 'https://gitlab.com/o/r.git']) {
    assert.ok(!['forgejo', 'no-login'].includes(classifyOrigin(url2).verdict), url2);
  }
});

test('classifyOrigin: an absent origin is no-remote, and garbage is unrecognized', () => {
  for (const absent of ['', '   ', null, undefined, 42]) {
    assert.equal(classifyOrigin(absent).verdict, 'no-remote', String(absent));
  }
  // Parses as no host/path pair at all.
  assert.equal(classifyOrigin('not-a-url').verdict, 'unrecognized');
  // Parses, but names no owner/repo - so no selector could bind a call.
  const bare = classifyOrigin('https://github.com/cadence.git');
  assert.equal(bare.verdict, 'unrecognized');
  assert.equal(bare.slug, null);
});

test('a hostname carrying a control character is REJECTED, never cleaned', () => {
  // The hostname classes are `[^/:]+`, which admits a newline and an ESC. The
  // reason this still matters after the demotion: the slug and host this
  // returns become a DEFAULT a setup step pre-fills into a shell line, so a
  // hostile origin must produce no default at all rather than a repaired one.
  const HOSTILE = ['\n INJECTED', '\r\nINJECTED', '\u001b[31mred', '\u0007', '\u2028INJECTED', '\u009b'];
  for (const evil of HOSTILE) {
    for (const url of [
      `https://evil.example${evil}/org/repo.git`,      // schemed
      `https://evil.example${evil}:2222/org/repo.git`, // schemed and ported
      `git@evil.example${evil}:org/repo.git`,          // scp-shaped
    ]) {
      const c = classifyOrigin(url);
      assert.equal(c.verdict, 'unrecognized', url);
      // Rejected, never cleaned: nothing about that host is reported back.
      assert.equal(c.host, null, url);
      assert.equal(c.slug, null, url);
    }
  }
  // The control character is the ONLY thing that changed: the same hosts
  // without it still classify, so the guard is not rejecting everything.
  assert.equal(classifyOrigin('https://github.com/org/repo.git').verdict, 'github');
  assert.equal(classifyOrigin('git@github.com:org/repo.git').verdict, 'github');
});

test('classifyOrigin says whether the URL SPELLED a port, which httpPort cannot', () => {
  // httpPort is null for TWO different situations, and a caller deciding
  // whether a URL could have named a non-default endpoint has to tell them
  // apart: no port syntax at all (scp) versus a port over a scheme whose port
  // is not comparable to an API url's (ssh).
  const cases = [
    ['https://forge.example.com/o/r.git', false, '443'],
    ['https://forge.example.com:3001/o/r.git', true, '3001'],
    ['http://forge.example.com/o/r.git', false, '80'],
    ['ssh://git@forge.example.com:2222/o/r.git', true, null],
    ['ssh://git@forge.example.com/o/r.git', false, null],
    ['git@forge.example.com:o/r.git', false, null],
  ];
  for (const [url, portSpelled, httpPort] of cases) {
    const c = classifyOrigin(url);
    assert.equal(c.portSpelled, portSpelled, url);
    assert.equal(c.httpPort, httpPort, url);
  }
});

test('a classification with no URL to read spells no port either', () => {
  for (const absent of ['', null, 'not-a-url']) {
    assert.equal(classifyOrigin(absent).portSpelled, false, String(absent));
  }
});

// --- teaLoginNameForHost: the persisted host becomes a login NAME ------------

test('teaLoginNameForHost answers the login NAME, by any of the three fields', () => {
  // `--login` takes a NAME and nothing else (measured on tea 0.15.1), so the
  // answer is never the host that was asked about.
  assert.equal(teaLoginNameForHost(TEA_LOGINS, 'git.jcrenshaw.dev'), 'git.jcrenshaw.dev');
  assert.equal(teaLoginNameForHost(TEA_LOGINS, 'ssh.jcrenshaw.dev'), 'git.jcrenshaw.dev',
    'the SSH endpoint resolves the SAME login: a split endpoint is a normal deployment');
  for (const login of [
    { name: 'work', url: 'https://forge.example.com', ssh_host: 'other.example' },
    { name: 'work', url: 'https://other.example', ssh_host: 'forge.example.com' },
    { name: 'forge.example.com', url: 'https://other.example', ssh_host: 'other.example' },
  ]) {
    assert.equal(teaLoginNameForHost([login], 'forge.example.com'), login.name, JSON.stringify(login));
  }
});

test('teaLoginNameForHost matches on EQUALITY, never on a shared suffix', () => {
  // The vocabulary that needs no public suffix list, unchanged by the rebind:
  // it never asks what two hosts have in COMMON.
  assert.equal(teaLoginNameForHost(TEA_LOGINS, 'jcrenshaw.dev'), null);
  assert.equal(teaLoginNameForHost(TEA_LOGINS, 'other.jcrenshaw.dev'), null);
  assert.equal(teaLoginNameForHost(TEA_LOGINS, 'git.jcrenshaw.dev.evil.com'), null);
  // Case is not a difference: hosts are case-insensitive.
  assert.equal(teaLoginNameForHost(TEA_LOGINS, 'GIT.JCRENSHAW.DEV'), 'git.jcrenshaw.dev');
});

test('teaLoginNameForHost takes the FIRST match in tea\'s own list order', () => {
  // Two accounts on one instance is a real configuration, and any rule that
  // picked between them would invent a preference the user never stated. First
  // is arbitrary but STABLE, which is the property that matters.
  const two = [
    { name: 'personal', url: 'https://forge.example.com', ssh_host: 'ssh.example.com' },
    { name: 'work', url: 'https://forge.example.com', ssh_host: 'ssh.example.com' },
  ];
  assert.equal(teaLoginNameForHost(two, 'forge.example.com'), 'personal');
  assert.equal(teaLoginNameForHost(two.slice().reverse(), 'forge.example.com'), 'work');
});

test('teaLoginNameForHost is TOTAL over every unreadable input', () => {
  for (const bad of [null, undefined, 'not a list', 42, {}]) {
    assert.equal(teaLoginNameForHost(bad, 'forge.example.com'), null, JSON.stringify(bad));
  }
  for (const bad of [null, undefined, '', '   ', 42]) {
    assert.equal(teaLoginNameForHost(TEA_LOGINS, bad), null, JSON.stringify(bad));
  }
  // A record that MATCHES but carries no usable name answers null rather than a
  // blank `--login`: an empty login name is not a login.
  assert.equal(teaLoginNameForHost([{ url: 'https://forge.example.com' }], 'forge.example.com'), null);
  assert.equal(teaLoginNameForHost([{ name: '', ssh_host: 'forge.example.com' }], 'forge.example.com'), null);
  assert.equal(teaLoginNameForHost([null, 'x', { name: 'ok', ssh_host: 'forge.example.com' }],
    'forge.example.com'), 'ok');
});

// --- the persisted host may name a PORT, and it reaches the match (FRG-05) --

// Two Forgejo instances on one hostname, told apart only by the port each
// login's own API `url` names - the shape `git.forge_host` could not state at
// all until its write face grew a grammar.
const TWO_ON_ONE_HOST = [
  { name: 'three-thousand', url: 'https://forge.example.com:3000', ssh_host: 'ssh.example.com' },
  { name: 'three-thousand-one', url: 'https://forge.example.com:3001', ssh_host: 'ssh.example.com' },
];

test('a persisted host naming a port picks the login serving THAT port', () => {
  assert.equal(teaLoginNameForHost(TWO_ON_ONE_HOST, 'forge.example.com:3001'), 'three-thousand-one');
  assert.equal(teaLoginNameForHost(TWO_ON_ONE_HOST, 'forge.example.com:3000'), 'three-thousand');
});

test('a persisted `:443` matches a login whose url spells no port at all', () => {
  // `https://h` and `https://h:443` are one endpoint written two ways, which is
  // httpPortOf's rule and the reason the port is not re-derived here.
  const logins = [{ name: 'plain', url: 'https://forge.example.com', ssh_host: 'ssh.example.com' }];
  assert.equal(teaLoginNameForHost(logins, 'forge.example.com:443'), 'plain');
});

test('a port no login serves resolves to NO login rather than to a neighbour', () => {
  assert.equal(teaLoginNameForHost(TWO_ON_ONE_HOST, 'forge.example.com:9999'), null);
});

test('a PORTLESS persisted host resolves exactly as it does today', () => {
  // The port is a VETO and not a new requirement: with none stated, the first
  // record in tea's own list order still wins.
  assert.equal(teaLoginNameForHost(TWO_ON_ONE_HOST, 'forge.example.com'), 'three-thousand');
  assert.equal(teaLoginNameForHost(TEA_LOGINS, 'forge.example.com'),
    teaLoginNameForHost(TEA_LOGINS, 'forge.example.com'));
});

test('a host the grammar REFUSES answers null rather than throwing', () => {
  // Same answer an empty or non-string host already gets: null is the caller's
  // cue to take its no-login line, and there is no repair for a value that
  // could not have been persisted through the write face.
  for (const bad of ['forge.example.com:0443', 'forge.example.com:70000', '-forge.example.com',
    'forge example.com', 'forge.example.com/x', '[::1]:3001']) {
    assert.equal(teaLoginNameForHost(TWO_ON_ONE_HOST, bad), null, bad);
  }
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

test('scanIssueRefs excludes a reference outside the safe-integer range (ARG-04)', () => {
  // Before the guard this returned a one-element array holding Infinity, and
  // the seam then asked the tracker about Infinity.
  assert.deepEqual(scanIssueRefs('fixes #' + '9'.repeat(400)), []);
  assert.deepEqual(scanIssueRefs('fixes #9007199254740993'), []);
  // The exclusion is per reference, not per log: the readable ones still land.
  assert.deepEqual(scanIssueRefs('closes #42 and #' + '9'.repeat(400)), [42]);
  assert.deepEqual(scanIssueRefs('fixes #42'), [42]);
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
  // `--state open`, not `all`: the server clamps the page at 50 rows whatever
  // --limit asks, so `all` filled it on any real tracker and the read was
  // honestly incomplete (D-08).
  // `--login <name>` is the binding, and it replaced `--remote origin` in phase
  // 1 (D-01, D-08). tea resolves an unqualified `--repo` in config FILE ORDER,
  // so SOMETHING has to name the instance; `--remote origin` made that the
  // checkout's own remote, which a repository that lost its origin no longer
  // has. The login name comes from the persisted `git.forge_host` by way of
  // `teaLoginNameForHost`, so the call names an instance with no remote present.
  assert.deepEqual(HOST_TABLE.forgejo.argv('org/repo', 50, 'work'),
    ['issues', 'list', '--repo', 'org/repo', '--login', 'work', '--state', 'open',
      '--fields', 'index,state', '--output', 'json', '--limit', '50']);
});

test('the forgejo row resolves ONE issue, and reads both shapes tea prints', () => {
  const { resolve } = HOST_TABLE.forgejo;
  assert.deepEqual(resolve.argv('org/repo', 47, 'work'),
    ['issues', '47', '--repo', 'org/repo', '--login', 'work',
      '--fields', 'index,state', '--output', 'json']);
  // `tea issues <index>` prints `index` as a NUMBER where the list prints a
  // STRING, and it has printed both a bare object and a one-element array.
  assert.equal(resolve.read('{"index":47,"state":"closed"}', 47), 'closed');
  assert.equal(resolve.read('[{"index":"47","state":"open"}]', 47), 'open');
  // Anything that does not answer for THAT number is null, which the caller
  // renders `unresolved` - never `not-found`.
  for (const bad of ['', 'not json', '[]', '[{"index":47,"state":"open"},{"index":48,"state":"open"}]',
    '{"index":48,"state":"closed"}', '{"index":47}', '{"index":47,"state":"merged"}', null, 42]) {
    assert.equal(resolve.read(bad, 47), null, JSON.stringify(bad));
  }
});

test('only the forgejo row carries a resolve; the other two still list every state', () => {
  // `gh` pages internally to its --limit and `glab` is absent from this
  // machine, so neither trades a working arm for an untestable one (D-08).
  assert.equal(HOST_TABLE.github.resolve, undefined);
  assert.equal(HOST_TABLE.gitlab.resolve, undefined);
  assert.ok(HOST_TABLE.github.argv('org/repo', 200).join(' ').includes('--state all'));
  assert.ok(HOST_TABLE.gitlab.argv('org/repo', 100).includes('--all'));
  // The forgejo row names its instance with `--login` and NO row names a
  // `--remote` any more: tea's config-order `--repo` fallback is answered by
  // the persisted host, and `gh`/`glab` are not multi-account-ambiguous the way
  // tea's `--repo` is, so they take no third argument at all.
  assert.ok(HOST_TABLE.forgejo.argv('org/repo', 50, 'work').includes('--login'));
  assert.ok(HOST_TABLE.forgejo.resolve.argv('org/repo', 47, 'work').includes('--login'));
  for (const [host, row] of Object.entries(HOST_TABLE)) {
    assert.ok(!row.argv('org/repo', row.limit, 'work').includes('--remote'), host);
    assert.ok(!(row.resolve ? row.resolve.argv('org/repo', 47, 'work') : []).includes('--remote'), host);
  }
  // A third argument changes nothing on the two fixed-host rows, so a caller
  // that passes one uniformly cannot leak a login name onto them.
  assert.deepEqual(HOST_TABLE.github.argv('org/repo', 200, 'work'),
    HOST_TABLE.github.argv('org/repo', 200));
  assert.deepEqual(HOST_TABLE.gitlab.argv('org/repo', 100, 'work'),
    HOST_TABLE.gitlab.argv('org/repo', 100));
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

test('a number OUTSIDE the safe-integer range is unreadable, never a neighbour (ARG-04)', () => {
  // Measured 2026-08-18 before the guard: these answered complete:true with ONE
  // record carrying 9007199254740992 and Infinity - a DIFFERENT issue than the
  // tracker holds. Assert the VALUE, not the serialization: JSON.stringify
  // prints Infinity as null.
  for (const body of [
    '[{"number":9007199254740993,"state":"open"}]',
    '[{"number":"9007199254740993","state":"open"}]',
    '[{"number":' + '9'.repeat(400) + ',"state":"open"}]',
    '[{"number":"' + '9'.repeat(400) + '","state":"open"}]',
  ]) {
    const got = HOST_TABLE.github.normalize(body, 200);
    assert.equal(got.complete, false, body.slice(0, 40));
    assert.deepEqual(got.records, [], body.slice(0, 40));
    assert.match(got.detail, /number/, body.slice(0, 40));
  }
  // tea's string-spelled `index` reads through the same normalization.
  const tea = HOST_TABLE.forgejo.normalize('[{"index":"9007199254740993","state":"open"}]', 50);
  assert.equal(tea.complete, false);
  assert.deepEqual(tea.records, []);
  // The bound is a bound: the numbers a tracker actually holds still read.
  assert.deepEqual(HOST_TABLE.github.normalize('[{"number":14156,"state":"OPEN"}]', 200).records, [
    { number: 14156, state: 'open' },
  ]);
});

// --- decideIssueCheck: every reason distinct --------------------------------

test('all eight reasons are distinct strings, and only `query` proceeds', () => {
  // EIGHT, not nine: phase 1 replaced the two origin-classification arms -
  // `no-remote` and `unrecognized`, which differed only in HOW the origin URL
  // failed - with one arm that names the forge keys still unset. A degradation
  // a user cannot act on is not worth a line of its own.
  const forgejo = { provider: 'forgejo', repo: 'org/repo', host: 'git.example.com' };
  const ok = { enabled: true, forge: forgejo, loginName: 'work' };
  const cases = {
    'key off': { enabled: false },
    'no forge configured': { enabled: true, forge: { provider: null, repo: null, host: null } },
    'no login': { enabled: true, forge: forgejo, loginName: null },
    'log unreadable': { ...ok, logOk: false, bin: 'tea' },
    'cli absent': { ...ok, logOk: true, bin: 'tea', cliPresent: false },
    'nonzero exit': { ...ok, logOk: true, bin: 'tea', cliPresent: true, exitOk: false },
    // "it hung" and "it refused" are different things to go fix, so the call
    // bound gets its own line rather than borrowing the nonzero one.
    'killed at the bound': { ...ok, logOk: true, bin: 'tea', cliPresent: true, exitOk: false, timedOut: true },
    unreadable: {
      ...ok, logOk: true, bin: 'tea', cliPresent: true, exitOk: true,
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
  assert.equal(reasons.size, 8);
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
  assert.equal(decideIssueCheck({ enabled: true, forge: forgejo }).action, 'query');
  // An UNDEFINED loginName is "not asked yet", never "no login": the seam calls
  // this before the probe runs and on the two providers that never probe.
  assert.equal(decideIssueCheck({ enabled: true, forge: forgejo, loginName: undefined }).action, 'query');
  assert.equal(decideIssueCheck({
    ...ok, logOk: true, bin: 'tea', cliPresent: true, exitOk: true,
    fetched: { complete: true, detail: null },
  }).action, 'query');
  // A github record needs no host and no login at all.
  assert.equal(decideIssueCheck({
    enabled: true, forge: { provider: 'github', repo: 'org/repo', host: null },
  }).action, 'query');
});

test('the not-configured line names the keys that are unset, and only those', () => {
  const reason = (forge) => decideIssueCheck({ enabled: true, forge }).reason;
  assert.match(reason({}), /git\.forge_provider, git\.forge_repo unset/);
  assert.match(reason({ provider: 'github' }), /\(git\.forge_repo unset/);
  // forgejo alone is asked for a host, and a null one is the SAME
  // not-configured condition rather than a second degradation below it.
  assert.match(reason({ provider: 'forgejo', repo: 'o/r' }), /\(git\.forge_host unset/);
  assert.doesNotMatch(reason({ provider: 'gitlab', repo: 'o/r' }), /forge_host/);
  assert.equal(decideIssueCheck({ enabled: true, forge: { provider: 'gitlab', repo: 'o/r' } }).action, 'query');
  // Every arm ends in the sentence shape /cad-land step 1 prints as one line.
  for (const forge of [{}, { provider: 'github' }, { provider: 'forgejo', repo: 'o/r' }]) {
    assert.match(reason(forge), /: no tracker report$/);
    assert.equal(reason(forge).split('\n').length, 1);
  }
});

test('a persisted host carrying a control character never reaches the ONE-line reason', () => {
  // `git.forge_host` is a `string_or_null` a user can set to anything, and it
  // is interpolated into the no-login line. The origin-parsing guard used to be
  // what kept that line to one line, and it no longer sits between config and
  // this sentence - so the guard moved here. REPLACED whole, never stripped: a
  // cleaned host printed back would read as what the user configured.
  const HOSTILE = ['\nINJECTED', '\r\nINJECTED', '\u001b[31mred', '\u0007', '\u2028INJECTED', '\u009b'];
  for (const evil of HOSTILE) {
    const { reason } = decideIssueCheck({
      enabled: true, forge: { provider: 'forgejo', repo: 'o/r', host: `forge.example${evil}` }, loginName: null,
    });
    assert.equal(reason.split('\n').length, 1, JSON.stringify(reason));
    assert.ok(!reason.includes('INJECTED'), JSON.stringify(reason));
    assert.match(reason, /the configured Forgejo instance/, JSON.stringify(reason));
    assert.match(reason, /: no tracker report$/);
  }
  // The control character is the ONLY thing that changed: a clean host is still
  // named outright, so the guard is not replacing everything.
  assert.match(decideIssueCheck({
    enabled: true, forge: { provider: 'forgejo', repo: 'o/r', host: 'forge.example.com' }, loginName: null,
  }).reason, /tea holds no login for forge\.example\.com: no tracker report/);
});

test('decideIssueCheck is total: no arguments at all still answers', () => {
  // Anything that is not the literal true is the off arm, and it still carries
  // its reason string - nobody prints it, and the JSON stays readable.
  assert.equal(decideIssueCheck().action, 'off');
  assert.equal(decideIssueCheck({}).action, 'off');
  assert.equal(decideIssueCheck({ enabled: 'yes' }).action, 'off', 'only the literal true enables it');
  assert.match(decideIssueCheck().reason, /issue_check is off/);
});
