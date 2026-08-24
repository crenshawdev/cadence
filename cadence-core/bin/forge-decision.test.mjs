// Zero-dep tests for lib/forge-decision.mjs (the setup-time forge question,
// FRG-01). Run: node --test cadence-core/bin/forge-decision.test.mjs.
//
// No harness at all, which is the point of the split: the module is pure, so
// every case here is a call and an assertion. The SEAM's own file proves the
// live readings - a PATH-injected stub, a real config layer - and proves them
// once rather than once per decision arm.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CREATE_TABLE, PROVIDER_TABLE, decideForge, forgeRecordComplete, installedProviders,
  isForgeSlug, originDefaults, splitSlug,
} from './lib/forge-decision.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

// --- the table: one vocabulary, shared with the schema and with HOST_TABLE ---

test('the provider table names three providers, in a fixed order, and is frozen', () => {
  assert.deepEqual(Object.keys(PROVIDER_TABLE), ['forgejo', 'github', 'gitlab']);
  assert.deepEqual(Object.values(PROVIDER_TABLE), ['tea', 'gh', 'glab']);
  assert.ok(Object.isFrozen(PROVIDER_TABLE));
});

test('the provider names are HOST_TABLE\'s own keys, not a second spelling', async () => {
  // The persisted `git.forge_provider` is used DIRECTLY as a HOST_TABLE key at
  // land time, so a synonym here is a lookup miss there rather than a naming
  // preference. Asserted against the real table rather than a copy.
  const { HOST_TABLE } = await import('./lib/issue-decision.mjs');
  assert.deepEqual(Object.keys(PROVIDER_TABLE).sort(), Object.keys(HOST_TABLE).sort());
  for (const [provider, bin] of Object.entries(PROVIDER_TABLE)) {
    assert.equal(HOST_TABLE[provider].bin, bin, `${provider} drives ${bin} on both tables`);
  }
});

test('the provider names are exactly git.forge_provider\'s enum values', () => {
  // The third surface carrying this vocabulary. A key whose enum admits a
  // spelling this table lacks would persist a value the seam cannot act on.
  const schema = JSON.parse(readFileSync(join(HERE, '..', 'config.schema.json'), 'utf8'));
  const values = schema.keys['git.forge_provider'].values.filter((v) => v !== null);
  assert.deepEqual(values.slice().sort(), Object.keys(PROVIDER_TABLE).sort());
});

// --- installedProviders: the caller's predicate, the table's order ----------

test('installedProviders reports the resolving providers in TABLE order', () => {
  // The predicate answers out of order on purpose: the output must follow the
  // table so the menu the setup step offers is the same on every machine.
  const seen = [];
  const found = installedProviders((bin) => { seen.push(bin); return bin === 'glab' || bin === 'tea'; });
  assert.deepEqual(found, [{ provider: 'forgejo', bin: 'tea' }, { provider: 'gitlab', bin: 'glab' }]);
  assert.deepEqual(seen, ['tea', 'gh', 'glab'], 'every binary is asked about exactly once');
});

test('installedProviders on a machine with none of them is the empty list', () => {
  assert.deepEqual(installedProviders(() => false), []);
});

test('installedProviders with no predicate answers empty rather than throwing', () => {
  // TOTAL, like decideIssueCheck: a caller that read nothing gets an answer.
  assert.deepEqual(installedProviders(undefined), []);
  assert.deepEqual(installedProviders(null), []);
});

// --- forgeRecordComplete: what "nothing left to ask" means ------------------

test('github and gitlab are complete on provider + slug, with no host', () => {
  // Their hosts are FIXED, so a null git.forge_host there is not a gap.
  for (const provider of ['github', 'gitlab']) {
    assert.equal(forgeRecordComplete({ provider, repo: 'org/repo', host: null }), true);
  }
});

test('forgejo is NOT complete until the instance host is named', () => {
  // CONTEXT D-08: `tea` addresses an instance through a login name and the host
  // is what resolves it, so a forgejo row that cannot name its instance has a
  // question outstanding.
  assert.equal(forgeRecordComplete({ provider: 'forgejo', repo: 'org/repo', host: null }), false);
  assert.equal(forgeRecordComplete({ provider: 'forgejo', repo: 'org/repo', host: 'git.example.com' }), true);
});

test('a missing provider or a missing slug is incomplete', () => {
  assert.equal(forgeRecordComplete({ provider: null, repo: 'org/repo' }), false);
  assert.equal(forgeRecordComplete({ provider: 'github', repo: null }), false);
  assert.equal(forgeRecordComplete({}), false);
  assert.equal(forgeRecordComplete(), false);
});

test('a provider spelling no row carries is incomplete, not honoured', () => {
  // The value is a HOST_TABLE key at land time. Accepting `gitea` here would
  // persist a record nothing can read.
  assert.equal(forgeRecordComplete({ provider: 'gitea', repo: 'org/repo', host: 'g.example' }), false);
  assert.equal(forgeRecordComplete({ provider: 'GitHub', repo: 'org/repo' }), false);
});

test('a non-string or blank persisted value reads as unasked, never as a value', () => {
  // A hand-edited config can hold anything; there is no envelope here to refuse
  // into, so the total answer is "not answered yet".
  assert.equal(forgeRecordComplete({ provider: 'github', repo: '   ' }), false);
  assert.equal(forgeRecordComplete({ provider: 'github', repo: 42 }), false);
  assert.equal(forgeRecordComplete({ provider: true, repo: 'org/repo' }), false);
  assert.equal(forgeRecordComplete({ provider: 'forgejo', repo: 'org/repo', host: '' }), false);
});

// --- decideForge: three actions and nothing else ----------------------------

const INSTALLED = [{ provider: 'github', bin: 'gh' }];

test('a complete record is `configured`, whatever is installed', () => {
  // The persisted record is consulted FIRST (see the module header): setup
  // persists a choice, and it is land time that needs a binary. Asking about
  // the binaries first would re-open a settled question on a machine that
  // happens not to have the CLI right now.
  const bare = decideForge({ provider: 'github', repo: 'org/repo', installed: [] });
  assert.equal(bare.action, 'configured');
  assert.match(bare.reason, /github/);
  assert.equal(bare.hint, undefined, 'nothing is refused, so nothing needs a next step');
  assert.equal(decideForge({ provider: 'github', repo: 'org/repo', installed: INSTALLED }).action, 'configured');
});

test('a partly answered forgejo record with a binary present is `ask`', () => {
  // The outstanding question is the instance host alone; the action still has
  // to be `ask`, because `configured` would leave it unasked forever.
  const d = decideForge({
    provider: 'forgejo', repo: 'org/repo', host: null,
    installed: [{ provider: 'forgejo', bin: 'tea' }],
  });
  assert.equal(d.action, 'ask');
});

test('an unanswered record with a binary present is `ask`, naming what resolved', () => {
  const d = decideForge({ installed: [{ provider: 'forgejo', bin: 'tea' }, { provider: 'github', bin: 'gh' }] });
  assert.equal(d.action, 'ask');
  assert.match(d.reason, /tea, gh/);
  assert.equal(d.hint, undefined);
});

test('an unanswered record with NO binary is `refuse`, naming all three and an install', () => {
  // AC5: the reason names what was looked for, the hint names an install, and
  // neither carries a byte read off a forge CLI - none was run.
  const d = decideForge({ installed: [] });
  assert.equal(d.action, 'refuse');
  for (const bin of ['tea', 'gh', 'glab']) {
    assert.match(d.reason, new RegExp(`\\b${bin}\\b`), `the reason names ${bin}`);
    assert.match(d.hint, new RegExp(`\\b${bin}\\b`), `the hint names ${bin}`);
  }
  assert.match(d.hint, /install/i);
});

test('a PARTLY answered record with no binary refuses too', () => {
  // Incomplete is incomplete: a provider with no slug cannot address a
  // repository, so this is not a record to be honoured on a bare machine.
  assert.equal(decideForge({ provider: 'github', repo: null, installed: [] }).action, 'refuse');
  assert.equal(decideForge({ provider: 'forgejo', repo: 'o/r', host: null, installed: [] }).action, 'refuse');
});

test('decideForge is TOTAL: no arguments at all still answers', () => {
  const d = decideForge();
  assert.equal(d.action, 'refuse');
  assert.equal(typeof d.reason, 'string');
  assert.equal(typeof d.hint, 'string');
});

test('a non-array `installed` is read as none rather than throwing', () => {
  assert.equal(decideForge({ installed: 'gh' }).action, 'refuse');
  assert.equal(decideForge({ installed: null }).action, 'refuse');
});

test('every reason is ONE line, so the setup step prints one line', () => {
  // The same property /cad-land step 1 relies on from decideIssueCheck: the
  // caller prints the reason verbatim.
  const cases = [
    decideForge({ provider: 'github', repo: 'org/repo' }),
    decideForge({ installed: INSTALLED }),
    decideForge({ installed: [] }),
  ];
  for (const d of cases) {
    assert.doesNotMatch(d.reason, /[\n\r]/, d.reason);
    if (d.hint) assert.doesNotMatch(d.hint, /[\n\r]/, d.hint);
  }
});

// --- the module stays pure --------------------------------------------------

test('lib/forge-decision.mjs does no I/O and touches no process state', () => {
  // The same guard arg-contract.test.mjs holds over its own pure module: the
  // seam owns the readings, and a fs call sneaking in here is what would make
  // the decision untestable without a temp tree.
  const body = readFileSync(join(HERE, 'lib', 'forge-decision.mjs'), 'utf8');
  for (const token of ['process.', 'readFileSync(', 'writeFileSync(', 'execFileSync(',
    'spawnSync(', 'console.', 'emit(', 'require(', 'node:']) {
    assert.ok(!body.includes(token), `lib/forge-decision.mjs must stay pure; found ${token}`);
  }
});


// --- the slug grammar: what a caller-derived selector may be ----------------

test('isForgeSlug accepts the two and three segment shapes forges serve', () => {
  // Two or more, not exactly two: GitLab nests subgroups and `glab --repo`
  // takes the whole path.
  for (const ok of ['crenshawdev/cadence', 'g/sub/r', 'a/b/c/d', 'org.name/repo.js',
    'Some_Org/my-repo', '0/1']) {
    assert.equal(isForgeSlug(ok), true, ok);
  }
});

test('isForgeSlug refuses a single segment - there is no repository selector', () => {
  assert.equal(isForgeSlug('cadence'), false);
  assert.equal(isForgeSlug(''), false);
  assert.equal(isForgeSlug('/'), false);
});

test('isForgeSlug refuses a segment that reads as a FLAG once interpolated', () => {
  // The value is interpolated into `config.mjs set git.forge_repo=<slug>`.
  assert.equal(isForgeSlug('-rf/repo'), false);
  assert.equal(isForgeSlug('org/--force'), false);
});

test('isForgeSlug refuses traversal segments in selector position', () => {
  assert.equal(isForgeSlug('../etc'), false);
  assert.equal(isForgeSlug('org/../../root'), false);
  assert.equal(isForgeSlug('./org/repo'), false);
});

test('isForgeSlug refuses every character that could end an argument', () => {
  // The whole reason the grammar exists: this value is interpolated into the
  // shell line that persists it, and it came off repository content.
  const hostile = ['org/repo; rm -rf /', 'org/$(id)', 'org/`id`', 'org/re po',
    'org/repo\nowner/other', 'org/repo"x', "org/repo'x", 'org/repo&x', 'org/repo|x',
    'org/repo>x', 'org/repo\\x', 'org/re\tpo'];
  for (const bad of hostile) assert.equal(isForgeSlug(bad), false, JSON.stringify(bad));
});

test('isForgeSlug refuses a slug longer than any forge serves', () => {
  assert.equal(isForgeSlug('o/' + 'r'.repeat(199)), false);
  assert.equal(isForgeSlug('o/' + 'r'.repeat(197)), true);
});

test('isForgeSlug refuses a non-string rather than throwing', () => {
  for (const bad of [null, undefined, 42, {}, ['o/r']]) assert.equal(isForgeSlug(bad), false);
});

// --- originDefaults: two defaults, two availabilities -----------------------

test('originDefaults offers a provider for github and gitlab and for nothing else', () => {
  // CONTEXT D-07: `classifyOrigin` only recognizes those two hostname suffixes,
  // and guessing a forge from a hostname's first label is a heuristic nothing
  // here can be right about.
  assert.equal(originDefaults({ verdict: 'github', slug: 'o/r' }).provider, 'github');
  assert.equal(originDefaults({ verdict: 'gitlab', slug: 'g/sub/r' }).provider, 'gitlab');
  for (const verdict of ['unrecognized', 'no-remote', 'forgejo', 'no-login']) {
    assert.equal(originDefaults({ verdict, slug: 'o/r' }).provider, null, verdict);
  }
});

test('originDefaults offers the slug whenever one parsed, provider or not', () => {
  assert.equal(originDefaults({ verdict: 'unrecognized', slug: 'crenshawdev/cadence' }).repo,
    'crenshawdev/cadence');
  assert.equal(originDefaults({ verdict: 'github', slug: 'o/r' }).repo, 'o/r');
});

test('originDefaults offers NO host default under any verdict', () => {
  // CONTEXT D-08: the instance host is asked outright, never derived - on a
  // split SSH endpoint the classifier's host is the SSH hostname and not the
  // instance the user reaches in a browser.
  for (const verdict of ['github', 'gitlab', 'forgejo', 'unrecognized', 'no-remote']) {
    const d = originDefaults({ verdict, slug: 'o/r', host: 'ssh.jcrenshaw.dev' });
    assert.deepEqual(Object.keys(d).sort(), ['provider', 'repo'], verdict);
  }
});

test('originDefaults drops a slug that fails the grammar rather than passing it through', () => {
  assert.equal(originDefaults({ verdict: 'github', slug: 'org/repo; id' }).repo, null);
  assert.equal(originDefaults({ verdict: 'github', slug: null }).repo, null);
  // The provider survives independently: the two defaults are independent.
  assert.equal(originDefaults({ verdict: 'github', slug: 'org/repo; id' }).provider, 'github');
});

test('originDefaults is TOTAL over anything a caller hands it', () => {
  for (const bad of [undefined, null, 'github', 42, {}]) {
    assert.deepEqual(originDefaults(bad), { provider: null, repo: null });
  }
});

// --- the owner/name split: one grammar, two halves ---------------------------

test('splitSlug takes the two halves apart at the LAST separator', () => {
  assert.deepEqual(splitSlug('crenshawdev/cadence'), { owner: 'crenshawdev', name: 'cadence' });
  // GitLab's nested subgroups: the owner is everything above the repository.
  assert.deepEqual(splitSlug('g/sub/r'), { owner: 'g/sub', name: 'r' });
});

test('splitSlug refuses everything the slug grammar refuses, rather than re-deriving one', () => {
  // ONE predicate decides what a repository reference may be: a value that gets
  // no default at setup must get no creation target either.
  for (const bad of ['cadence', '-flag/repo', 'org/../etc', 'org/repo; id', '', null, 42, {}]) {
    assert.equal(splitSlug(bad), null, `splitSlug accepted ${JSON.stringify(bad)}`);
  }
});

// --- the creation table: three grammars for one operation (AC6) --------------

test('the create table names the same three providers as the provider table', () => {
  assert.deepEqual(Object.keys(CREATE_TABLE), Object.keys(PROVIDER_TABLE));
  assert.ok(Object.isFrozen(CREATE_TABLE));
  for (const row of Object.values(CREATE_TABLE)) assert.ok(Object.isFrozen(row));
});

test('the create table repeats no binary name - PROVIDER_TABLE is the one spelling', () => {
  for (const [provider, row] of Object.entries(CREATE_TABLE)) {
    assert.equal(row.bin, undefined, `${provider}: a second copy of the binary name`);
    assert.deepEqual(Object.keys(row).sort(), ['argv', 'wiresRemote'],
      `${provider}: a third field is a rule this table would state in two places`);
  }
});

test('each provider builds the ONE argv measured for it, element for element', () => {
  // AC6's three pinned argvs, verbatim. Element for element rather than joined,
  // because a joined string cannot tell one argument carrying a space from two.
  assert.deepEqual(CREATE_TABLE.github.argv('o', 'r'),
    ['repo', 'create', 'o/r', '--private']);
  assert.deepEqual(CREATE_TABLE.gitlab.argv('o', 'r'),
    ['repo', 'create', 'o/r', '--private', '--remoteName', 'origin']);
  assert.deepEqual(CREATE_TABLE.forgejo.argv('o', 'r'),
    ['repos', 'create', '--name', 'r', '--owner', 'o', '--private']);
});

test('the two positional grammars rejoin a nested owner, and tea keeps it split', () => {
  const { owner, name } = splitSlug('g/sub/r');
  assert.deepEqual(CREATE_TABLE.gitlab.argv(owner, name),
    ['repo', 'create', 'g/sub/r', '--private', '--remoteName', 'origin']);
  assert.deepEqual(CREATE_TABLE.forgejo.argv(owner, name),
    ['repos', 'create', '--name', 'r', '--owner', 'g/sub', '--private']);
});

test('EVERY row pins --private, so a fourth provider cannot be added without one', () => {
  // CONTEXT D-04: the value is pinned, not defaulted. `gh` with no visibility
  // flag drops to an interactive prompt that would hang a Bash tool call, and
  // `glab` silently defaults to `internal`.
  for (const [provider, row] of Object.entries(CREATE_TABLE)) {
    assert.ok(row.argv('o', 'r').includes('--private'), `${provider} does not pin visibility`);
    assert.equal(row.argv.length, 2, `${provider}'s builder takes a visibility parameter`);
  }
});

test('the row flagged as wiring its own remote is exactly the one whose argv wires it', () => {
  // The flag is read off the argv beside it, never off a provider's reputation:
  // this is the pair that would drift silently if the flag were hand-set.
  const wiring = Object.entries(CREATE_TABLE).filter(([, r]) => r.wiresRemote).map(([p]) => p);
  assert.deepEqual(wiring, ['gitlab']);
  assert.ok(CREATE_TABLE.gitlab.argv('o', 'r').includes('--remoteName'));
  for (const [provider, row] of Object.entries(CREATE_TABLE)) {
    assert.equal(row.argv('o', 'r').includes('--remoteName'), row.wiresRemote,
      `${provider}: the wiresRemote flag disagrees with the argv it describes`);
  }
});
