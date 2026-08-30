// Zero-dep tests for land-cleanup.mjs (the close-decision seam). Run:
// node --test 'cadence-core/bin/*.test.mjs'. Fixture style mirrors
// git-branch.test.mjs: a temp .planning dir with config/PROJECT/ROADMAP, driven
// through the seam with explicit --merged/--branch so no live git repo is needed.
//
// WHAT `gate` IS PIPED CHANGED IN v3.7.8 (LND-02). `findings` carries
// ADJUDICATION RECORD ENTRIES now, not the raw findings of a REVIEW file, so
// every arm below spells a `ruling` - a member carrying only a severity is a raw
// review finding, and reading one of those as a live blocker is exactly the
// behaviour this requirement removed. There is deliberately NO severity
// fallback for a ruling-less member: it is not a survivor, so it does not halt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, openSync, closeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SEAM = join(dirname(fileURLToPath(import.meta.url)), 'land-cleanup.mjs');
// Hermetic global config (never read the dev's real ~/.claude one).
const NO_GLOBAL = join(mkdtempSync(join(tmpdir(), 'cad-lc-')), 'no-global.json');

/** A .planning fixture with the given git config block. */
function fixture(gitConfig) {
  const dir = mkdtempSync(join(tmpdir(), 'cad-lc-repo-'));
  mkdirSync(join(dir, '.planning'), { recursive: true });
  writeFileSync(join(dir, '.planning', 'config.json'), JSON.stringify({ git: gitConfig }));
  writeFileSync(join(dir, '.planning', 'PROJECT.md'),
    '## Requirements\n### Active\n\n`v1.1.0-rc.2` - the round\n\n### Out of Scope\n');
  writeFileSync(join(dir, '.planning', 'ROADMAP.md'), '# Roadmap: Cadence v1.1.0-rc.2\n');
  return dir;
}

/** A real git repo (over a .planning fixture) with cadence/<v> merged into main,
 *  so `git branch --merged main` lists it and the reap target resolves for real. */
function gitFixture(gitConfig) {
  const dir = fixture(gitConfig);
  const g = (...a) => execFileSync('git', ['-C', dir, ...a],
    { stdio: 'ignore', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' } });
  g('init', '-q');
  g('config', 'user.email', 'test@example.com');
  g('config', 'user.name', 'test');
  g('config', 'commit.gpgsign', 'false');
  g('add', '-A');
  g('commit', '-q', '-m', 'init');
  g('branch', '-M', 'main');
  g('checkout', '-q', '-b', 'cadence/v1.1.0-rc.2');
  writeFileSync(join(dir, 'work.txt'), 'x');
  g('add', '-A');
  g('commit', '-q', '-m', 'work');
  g('checkout', '-q', 'main');
  g('merge', '-q', '--no-ff', '-m', 'merge', 'cadence/v1.1.0-rc.2');
  return dir;
}

/** A user-global config layer holding `cfg`; returns its path. */
function globalLayer(cfg) {
  const file = join(mkdtempSync(join(tmpdir(), 'cad-lc-global-')), 'global.json');
  writeFileSync(file, JSON.stringify(cfg));
  return file;
}

/**
 * Run a land-cleanup subcommand against a fixture; optional stdin string and an
 * optional user-global layer (default: none, so the dev's real one is never read).
 */
function seam(args, stdin = '', globalFile = NO_GLOBAL) {
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: globalFile };
  try {
    return JSON.parse(execFileSync('node', [SEAM, ...args],
      { encoding: 'utf8', env, input: stdin }));
  } catch (e) {
    return JSON.parse(e.stdout);
  }
}

// --- cleanup ----------------------------------------------------------------

test('cleanup on a repo with the branch merged into base: reap true, return to base', () => {
  const dir = gitFixture({ base_branch: 'main' });
  const r = seam(['cleanup', '--dir', dir, '--branch', 'cadence/v1.1.0-rc.2']);
  assert.equal(r.ok, true);
  assert.equal(r.action, 'cleanup');
  assert.equal(r.returnToBase, true);
  assert.equal(r.pull, true);
  assert.equal(r.reap, true);
  assert.equal(r.branch, 'cadence/v1.1.0-rc.2');
  assert.equal(r.base, 'main');
});

test('cleanup --merged true forced but branch not in merged list (deleted at merge): reap false, branch null', () => {
  // The GitHub auto_close path: gh pr merge --delete-branch removes the branch,
  // so `git branch --merged` no longer lists it and the reap target resolves
  // null, yet the seam forces --merged true. Reap must not fire on a null branch.
  const dir = fixture({ base_branch: 'main' });
  const r = seam(['cleanup', '--dir', dir, '--branch', 'cadence/v1.1.0-rc.2', '--merged', 'true']);
  assert.equal(r.action, 'cleanup');
  assert.equal(r.reap, false);
  assert.equal(r.branch, null);
  assert.equal(r.returnToBase, true);
  assert.equal(r.pull, true);
});

test('cleanup --merged false: cleanup but reap false (never reap an unmerged branch)', () => {
  const dir = fixture({ base_branch: 'main' });
  const r = seam(['cleanup', '--dir', dir, '--branch', 'cadence/v1.1.0-rc.2', '--merged', 'false']);
  assert.equal(r.action, 'cleanup');
  assert.equal(r.reap, false);
});

test('a STRING protected_branches resolves base to that branch (#38, COR-01, D-07)', () => {
  // This seam's own per-consumer proof of the shared coercion
  // (lib/protected-branches.mjs). `base` falls back to protectedBranches[0],
  // so honoring the string form MOVES the base here: "release" resolves base to
  // `release` and `git branch --merged release` becomes the reap query, where
  // the pre-fix code dropped the string and reaped against `main`. That is the
  // accepted consequence of one grammar across the four readers (D-07), stated
  // rather than worked around.
  const dir = fixture({ protected_branches: 'release' });
  const r = seam(['cleanup', '--dir', dir, '--branch', 'cadence/v1.1.0-rc.2', '--merged', 'true']);
  assert.equal(r.ok, true);
  assert.equal(r.base, 'release');
  // An explicit --base still wins over the fallback.
  const forced = seam(['cleanup', '--dir', dir, '--branch', 'cadence/v1.1.0-rc.2', '--merged', 'true', '--base', 'main']);
  assert.equal(forced.base, 'main');
});

test('a protected_branches naming NO branch resolves base to main (GRD-01, D-02)', () => {
  // The same fallback path as the row above, on the value that used to break
  // it: `""` resolved to [""], so `base` became the empty string and the reap
  // query became `git branch --merged ""` - a query that answers emptily and
  // successfully rather than failing. A value naming no branch is a typo, so
  // the default list applies and base lands on `main` (D-02).
  const dir = fixture({ protected_branches: '' });
  const r = seam(['cleanup', '--dir', dir, '--branch', 'cadence/v1.1.0-rc.2', '--merged', 'true']);
  assert.equal(r.ok, true);
  assert.equal(r.base, 'main');
});

test('cleanup with git.on_land_cleanup=false: skip, all flags false', () => {
  const dir = fixture({ base_branch: 'main', on_land_cleanup: false });
  const r = seam(['cleanup', '--dir', dir, '--branch', 'cadence/v1.1.0-rc.2', '--merged', 'true']);
  assert.equal(r.action, 'skip');
  assert.equal(r.returnToBase, false);
  assert.equal(r.reap, false);
});

// --- gate -------------------------------------------------------------------

test('gate with a blocker on stdin + git.auto_close=true: halt', () => {
  const dir = fixture({ auto_close: true });
  const r = seam(['gate', '--dir', dir], '{"findings":[{"ruling":"survived","severity":"blocker"}]}');
  assert.equal(r.ok, true);
  assert.equal(r.action, 'halt');
  assert.equal(r.findings.length, 1);
});

test('gate with only a medium finding: proceed', () => {
  // A survivor BELOW the halting pair: `unfixedFromEntries` puts it on `filing`,
  // never on `halting`, so it reaches the user's ask and stops no close.
  const dir = fixture({ auto_close: true });
  const r = seam(['gate', '--dir', dir], '{"findings":[{"ruling":"survived","severity":"medium"}]}');
  assert.equal(r.action, 'proceed');
});

test('gate with git.auto_close=false + a blocker: proceed (chain not running)', () => {
  const dir = fixture({ auto_close: false });
  const r = seam(['gate', '--dir', dir], '{"findings":[{"ruling":"survived","severity":"blocker"}]}');
  assert.equal(r.action, 'proceed');
});

test('gate: auto_close ONLY in the global layer (repo omits) -> halt', () => {
  // The safety property, pinned in the direction that a repo-layer-only read
  // breaks. skills/cad-land/SKILL.md:24 reads the MERGED auto_close and skips
  // the publish ask under it, so on this input the prose has already entered the
  // unattended chain with no human watching - and this halt is the only
  // consequence left (references/triage-gate.md, the git.auto_close carve-out).
  // Reading the repo layer here (0b1c322, reverted) answered `proceed` on
  // exactly this input while the ask stayed skipped, and on the GitLab arm -
  // where no publish seam gates the chain - the blocker merged.
  const dir = fixture({ on_land_cleanup: true });
  const r = seam(['gate', '--dir', dir], '{"findings":[{"ruling":"survived","severity":"blocker"}]}',
    globalLayer({ git: { auto_close: true } }));
  assert.equal(r.ok, true);
  assert.equal(r.action, 'halt');
});

test('gate: the repo layer wins the merge over a global auto_close:false -> halt', () => {
  // The other direction, so the arm above pins the merged VALUE rather than
  // merely the presence of a global key: repo `true` beats global `false`, which
  // is ordinary repo-wins precedence and not a layer narrowing.
  const dir = fixture({ auto_close: true });
  const r = seam(['gate', '--dir', dir], '{"findings":[{"ruling":"survived","severity":"blocker"}]}',
    globalLayer({ git: { auto_close: false } }));
  assert.equal(r.action, 'halt');
});

test('gate: global auto_close:true beaten by repo false -> proceed (repo wins)', () => {
  // The merge is what this gate reads, so a repo layer that turns the chain OFF
  // wins over a global layer that turns it on - and with no chain running the
  // triage ask is live, so the blocker is the user's call rather than a halt.
  const dir = fixture({ auto_close: false });
  const r = seam(['gate', '--dir', dir], '{"findings":[{"ruling":"survived","severity":"blocker"}]}',
    globalLayer({ git: { auto_close: true } }));
  assert.equal(r.action, 'proceed');
});

// --- gate: the four states the seam used to collapse to [] -------------------

// Each entry is [name, stdin]. `undefined` stdin means the process is handed
// closed stdin rather than an empty string, so the read itself can fail.
const UNREADABLE_INPUTS = [
  ['stdin-empty', ''],
  ['malformed-json', '{"findings":[{"ruling":"survived","severity":"blocker"}'],
  ['not-a-findings-payload', '{"ok":false,"reason":"dispatch-failed"}'],
];

for (const [name, stdin] of UNREADABLE_INPUTS) {
  test(`gate under auto_close: ${name} halts with a reason naming it, never "no surviving finding"`, () => {
    const dir = fixture({ auto_close: true });
    const r = seam(['gate', '--dir', dir], stdin);
    assert.equal(r.ok, true, 'the advisory envelope is preserved - ok:true with one action');
    assert.equal(r.action, 'halt');
    assert.deepEqual(r.findings, []);
    assert.ok(r.reason.includes(name), `reason must name the failure: ${r.reason}`);
  });

  test(`gate with auto_close absent: ${name} still proceeds (no unattended chain)`, () => {
    const dir = fixture({ on_land_cleanup: true });
    const r = seam(['gate', '--dir', dir], stdin);
    assert.equal(r.ok, true);
    assert.equal(r.action, 'proceed');
  });
}

test('gate under auto_close: an EXPLICIT {"findings":[]} is the one spelling that proceeds', () => {
  const dir = fixture({ auto_close: true });
  const r = seam(['gate', '--dir', dir], '{"findings":[]}');
  assert.equal(r.action, 'proceed');
  assert.match(r.reason, /no surviving blocker\/high finding/);
});

test('gate: a bare JSON array on stdin still reads as the findings list', () => {
  const dir = fixture({ auto_close: true });
  assert.equal(seam(['gate', '--dir', dir], '[]').action, 'proceed');
  assert.equal(seam(['gate', '--dir', dir], '[{"ruling":"survived","severity":"blocker"}]').action, 'halt');
});

// --- the seam classifies: what the record says, not what the review claimed ---

test('gate: a usable fix_commit on the same entry flips halt to proceed (LND-02)', () => {
  // The regression LND-02 exists to close, in its smallest form. The two
  // payloads differ by exactly one key; `unfixedFromEntries` asks for a usable
  // fix commit FIRST and a fixed entry is in none of its three sets, so the
  // work-already-landed entry stops no close.
  const dir = fixture({ auto_close: true });
  const halts = seam(['gate', '--dir', dir], '{"findings":[{"ruling":"survived","severity":"blocker"}]}');
  assert.equal(halts.action, 'halt');
  assert.equal(halts.findings.length, 1);
  const fixed = seam(['gate', '--dir', dir],
    '{"findings":[{"ruling":"survived","severity":"blocker","fix_commit":"3341ffb0"}]}');
  assert.equal(fixed.action, 'proceed');
  assert.deepEqual(fixed.findings, []);
  assert.deepEqual(fixed.overridden, [], 'a fixed entry is not a cleared one either (D-05)');
});

test('gate: a refuted or downgraded ruling stops no close, at any severity', () => {
  // The other two dispositions the raw-findings union could not see. Both are
  // filed, neither halts - the gate reads the RULING, and the raised severity
  // on a killed finding is not a live one.
  const dir = fixture({ auto_close: true });
  for (const ruling of ['refuted', 'downgraded']) {
    const r = seam(['gate', '--dir', dir],
      `{"findings":[{"ruling":"${ruling}","severity":"blocker"}]}`);
    assert.equal(r.action, 'proceed', `${ruling} must not halt: ${r.reason}`);
  }
});

test('gate: `unruled` is read off the same stdin object, and a non-array reads as none', () => {
  const dir = fixture({ auto_close: true });
  const named = seam(['gate', '--dir', dir],
    '{"findings":[],"unruled":[".planning/phases/9/REVIEW-risk_surface-plan-1.md"]}');
  assert.equal(named.action, 'halt');
  assert.ok(named.reason.includes('unruled-review'), named.reason);
  assert.ok(named.reason.includes('.planning/phases/9/REVIEW-risk_surface-plan-1.md'), named.reason);
  // Additive and soft on the way in: an absent key and a wrong-typed one are
  // the same answer, so an old caller that names nothing is not an error here.
  assert.equal(seam(['gate', '--dir', dir], '{"findings":[]}').action, 'proceed');
  assert.equal(seam(['gate', '--dir', dir], '{"findings":[],"unruled":"R.md"}').action, 'proceed');
  // ...but a payload carrying ONLY `unruled` is still the fourth unreadable
  // state: the explicit findings list is what the four-name contract requires.
  const noList = seam(['gate', '--dir', dir], '{"unruled":["R.md"]}');
  assert.equal(noList.action, 'halt');
  assert.ok(noList.reason.includes('not-a-findings-payload'), noList.reason);
});

test('gate: no stdin piped at all halts under auto_close, whatever the platform calls it', () => {
  // `input` is not passed, and stdin is 'ignore' - the child gets /dev/null on
  // Linux, so the read succeeds and yields "", the stdin-empty arm. The name
  // differs by platform; what must hold on every one of them is that the gate
  // does NOT claim there were no surviving findings.
  const dir = fixture({ auto_close: true });
  let out;
  try {
    out = execFileSync('node', [SEAM, 'gate', '--dir', dir], {
      encoding: 'utf8',
      env: { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL },
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (e) { out = e.stdout; }
  const r = JSON.parse(out);
  assert.equal(r.ok, true);
  assert.equal(r.action, 'halt');
  assert.ok(/stdin-empty|stdin-unreadable/.test(r.reason), r.reason);
});

test('gate: a genuinely unreadable stdin is the fourth halting state, named', () => {
  // A directory handed in as fd 0: the open succeeds, the read throws EISDIR.
  // This is the one arm `input: ''` and `stdio: 'ignore'` cannot reach - both
  // of those read successfully and land on stdin-empty - so without it the
  // catch that mints `stdin-unreadable` has no seam-level test at all.
  const dir = fixture({ auto_close: true });
  const fd = openSync(tmpdir(), 'r');
  let out;
  try {
    out = execFileSync('node', [SEAM, 'gate', '--dir', dir], {
      encoding: 'utf8',
      env: { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL },
      stdio: [fd, 'pipe', 'ignore'],
    });
  } catch (e) { out = e.stdout; } finally { closeSync(fd); }
  const r = JSON.parse(out);
  assert.equal(r.ok, true);
  assert.equal(r.action, 'halt');
  assert.ok(r.reason.includes('stdin-unreadable'), r.reason);
  assert.deepEqual(r.findings, []);
});

// --- the v3.7.7 close, reproduced from this repository's own history ---------

// The two artifacts below are verbatim, recovered with
//   git show 220f99d3:.planning/phases/2/REVIEW-risk_surface-plan-1.md
//   git show 220f99d3:.planning/phases/2/ADJUDICATION-risk_surface-plan-1-r2.json
// and inlined rather than synthesized, because the SHAPE is the fixture. That
// fire is round TWO with no round-one sibling, which a handmade pair would not
// have; the `high` it rules `survived` is the one raised at
// cadence-core/bin/lib/adjudication-record.mjs:460 and it names the fix commit
// 3341ffb0, which is in v3.7.6..v3.7.7 - work that had already landed. That
// finding is what halted the v3.7.7 close under the old raw-findings union,
// and .planning/config.json sets git.auto_close: true, so this repository is
// on the halting arm for real. A REVIEW-*.md is JSON holding raw findings; the
// record beside it holds the rulings.

const V377_REVIEW = JSON.parse([
  '{ "findings": [',
  '  { "file": "cadence-core/bin/lib/adjudication-record.mjs",',
  '    "line": 460,',
  '    "severity": "high",',
  '    "claim": "The new override arm makes a survived-and-UNFIXED blocker/high storable, but `unfixedFindings` in lib/filing-decision.mjs:77-79 still excludes every `survived` blocker/high on the premise that it is being fixed, so an overridden blocker is dropped from the filing set entirely - and the drop is silent where it was previously a loud refusal.",',
  '    "failure_scenario": "Payload: one voice, one finding `{file:\'src/secrets/vault.ts\', line:1, severity:\'blocker\', claim, failure_scenario}`, ruling `{finding:0, ruling:\'survived\', claim, failure_scenario, overridden:true}`. Measured against the two modules at 154ef5fb: BEFORE this diff `buildEntries` answered `ok:false` (`voices[0].rulings[0] carries an unknown key: overridden`, and without the marker, the fix_commit refusal), so `unfixedFindings` returned `{ok:false, detail:...}` and `issue-filing unfixed` stopped the step. AFTER this diff the same payload gives `unfixedFindings -> {ok:true, detail:\'\', findings:[]}` (run and confirmed), i.e. `issue-filing unfixed` reports `raised:0`. The overridden blocker is then never fixed, never filed, never declined and never put to the user - exactly the collapse of \\"nothing to ask about\\" into \\"this payload is unreadable\\" that lib/filing-decision.mjs:61-66 states must never happen. No test in the diff covers the marker past `buildEntries`." },',
  '',
  '  { "file": "cadence-core/bin/lib/adjudication-record.mjs",',
  '    "line": 461,',
  '    "severity": "medium",',
  '    "claim": "`overridden: true` is an unverifiable self-assertion that discharges the module\'s strongest refusal, and nothing anywhere requires the corresponding `override` trace receipt - which is the only artifact whose reason is mandatory - so a blocking fire holding an unfixed blocker can settle as a clean `gate_pass` with no reason on file.",',
  '    "failure_scenario": "Sequence, all local seams: (1) `planning.mjs adjudication --trigger risk_surface --discriminator plan-1 --payload p.json` where p.json holds a `survived` blocker with `overridden:true` and no fix_commit - accepted, record written (planning/adjudication.mjs never checks `fix_commit` or `overridden` against git or the trace; `groundCitations` grounds only `entries[i].file`). (2) `trace append --family outcome --event gate_pass --trigger risk_surface --plan 1 --sha <head> --survivors 1 --downgraded 0 --refuted 0` - `recountReceipt` (planning/trace.mjs:1211-1246) compares only the three derived counts, and 1 survivor matches, so it appends. (3) `risk-check status` accepts `gate_pass` from FIRE_RECEIPTS and applies the mandatory-reason check only to `event === \'override\'` (planning/risk-check.mjs:718-721), so the range reports `state: recorded`, `ok: true`. Net: a blocker documented at :359 as `gate_pass` = \\"nothing blocker/high survived\\" clears with a blocker that survived unfixed and no user reason recorded anywhere." },',
  '',
  '  { "file": "cadence-core/bin/lib/adjudication-record.mjs",',
  '    "line": 450,',
  '    "severity": "medium",',
  '    "claim": "The rewritten fix_commit VALUE check is still scoped inside the `ruling === \'survived\'` branch, so a `downgraded` or `refuted` ruling stores an arbitrary unspendable string as `fix_commit` - and the comment this diff adds at :183-185 asserts the opposite (\\"the fix_commit VALUE check is not scoped to survived\\"), as does :147-149\'s \\"runs wherever a `survived` ruling SETS fix_commit ... at every severity\\".",',
  '    "failure_scenario": "Run and confirmed at 154ef5fb: ruling `{finding:0, ruling:\'downgraded\', claim, failure_scenario, fix_commit:\'not-a-sha\'}` -> `ok:true` and the stored entry carries `fix_commit: \\"not-a-sha\\"`; `{ruling:\'refuted\', counter_evidence:{file:\'b.mjs\',line:2}, fix_commit:\'zzz\'}` -> `ok:true`, stores `\\"zzz\\"`; `{ruling:\'downgraded\', fix_commit:\'   \'}` -> `ok:true`, stores `\\"   \\"`. An auditor runs `git show` on that value and it fails them, which is the exact outcome FIX_COMMIT at :162 exists to prevent, and the entry simultaneously claims a commit fixed a finding that was downgraded or refuted. The same value also survives into lib/filing-decision.mjs\'s answer, where PLAN-2 Task 1 will remove `fix_commit`-carrying entries from the user\'s ask - so a junk id on a downgraded finding will silently delete it from the filing set." }',
  '] }',
].join('\n'));

const V377_RECORD = JSON.parse([
  '{',
  '  "phase": "2",',
  '  "trigger": "risk_surface",',
  '  "discriminator": "plan-1",',
  '  "round": 2,',
  '  "base": "51a61b82",',
  '  "head": "3341ffb0",',
  '  "base_id": "51a61b8236183fa50c90132a2b1bb9ab80652da6",',
  '  "head_id": "3341ffb06630b77df95ab3f915982604f88ab681",',
  '  "voices": [',
  '    {',
  '      "voice": "claude-subagent",',
  '      "model": "opus"',
  '    },',
  '    {',
  '      "voice": "openai",',
  '      "model": "gpt-5.4-mini"',
  '    }',
  '  ],',
  '  "citations": {',
  '    "checked": true',
  '  },',
  '  "entries": [',
  '    {',
  '      "voice": "claude-subagent",',
  '      "model": "opus",',
  '      "file": "cadence-core/bin/lib/adjudication-record.mjs",',
  '      "line": 460,',
  '      "severity": "high",',
  '      "claim": "The new override arm makes a survived-and-UNFIXED blocker/high storable, but `unfixedFindings` in lib/filing-decision.mjs:77-79 still excludes every `survived` blocker/high on the premise that it is being fixed, so an overridden blocker is dropped from the filing set entirely - and the drop is silent where it was previously a loud refusal.",',
  '      "failure_scenario": "Payload: one voice, one finding `{file:\'src/secrets/vault.ts\', line:1, severity:\'blocker\', claim, failure_scenario}`, ruling `{finding:0, ruling:\'survived\', claim, failure_scenario, overridden:true}`. Measured against the two modules at 154ef5fb: BEFORE this diff `buildEntries` answered `ok:false` (`voices[0].rulings[0] carries an unknown key: overridden`, and without the marker, the fix_commit refusal), so `unfixedFindings` returned `{ok:false, detail:...}` and `issue-filing unfixed` stopped the step. AFTER this diff the same payload gives `unfixedFindings -> {ok:true, detail:\'\', findings:[]}` (run and confirmed), i.e. `issue-filing unfixed` reports `raised:0`. The overridden blocker is then never fixed, never filed, never declined and never put to the user - exactly the collapse of \\"nothing to ask about\\" into \\"this payload is unreadable\\" that lib/filing-decision.mjs:61-66 states must never happen. No test in the diff covers the marker past `buildEntries`.",',
  '      "ruling": "survived",',
  '      "convergent": false,',
  '      "fix_commit": "3341ffb0",',
  '      "base_id": "51a61b8236183fa50c90132a2b1bb9ab80652da6",',
  '      "head_id": "3341ffb06630b77df95ab3f915982604f88ab681"',
  '    },',
  '    {',
  '      "voice": "claude-subagent",',
  '      "model": "opus",',
  '      "file": "cadence-core/bin/lib/adjudication-record.mjs",',
  '      "line": 461,',
  '      "severity": "medium",',
  '      "claim": "`overridden: true` is an unverifiable self-assertion that discharges the module\'s strongest refusal, and nothing anywhere requires the corresponding `override` trace receipt - which is the only artifact whose reason is mandatory - so a blocking fire holding an unfixed blocker can settle as a clean `gate_pass` with no reason on file.",',
  '      "failure_scenario": "Sequence, all local seams: (1) `planning.mjs adjudication --trigger risk_surface --discriminator plan-1 --payload p.json` where p.json holds a `survived` blocker with `overridden:true` and no fix_commit - accepted, record written (planning/adjudication.mjs never checks `fix_commit` or `overridden` against git or the trace; `groundCitations` grounds only `entries[i].file`). (2) `trace append --family outcome --event gate_pass --trigger risk_surface --plan 1 --sha <head> --survivors 1 --downgraded 0 --refuted 0` - `recountReceipt` (planning/trace.mjs:1211-1246) compares only the three derived counts, and 1 survivor matches, so it appends. (3) `risk-check status` accepts `gate_pass` from FIRE_RECEIPTS and applies the mandatory-reason check only to `event === \'override\'` (planning/risk-check.mjs:718-721), so the range reports `state: recorded`, `ok: true`. Net: a blocker documented at :359 as `gate_pass` = \\"nothing blocker/high survived\\" clears with a blocker that survived unfixed and no user reason recorded anywhere.",',
  '      "ruling": "survived",',
  '      "convergent": false,',
  '      "base_id": "51a61b8236183fa50c90132a2b1bb9ab80652da6",',
  '      "head_id": "3341ffb06630b77df95ab3f915982604f88ab681"',
  '    },',
  '    {',
  '      "voice": "claude-subagent",',
  '      "model": "opus",',
  '      "file": "cadence-core/bin/lib/adjudication-record.mjs",',
  '      "line": 450,',
  '      "severity": "medium",',
  '      "claim": "The rewritten fix_commit VALUE check is still scoped inside the `ruling === \'survived\'` branch, so a `downgraded` or `refuted` ruling stores an arbitrary unspendable string as `fix_commit` - and the comment this diff adds at :183-185 asserts the opposite (\\"the fix_commit VALUE check is not scoped to survived\\"), as does :147-149\'s \\"runs wherever a `survived` ruling SETS fix_commit ... at every severity\\".",',
  '      "failure_scenario": "Run and confirmed at 154ef5fb: ruling `{finding:0, ruling:\'downgraded\', claim, failure_scenario, fix_commit:\'not-a-sha\'}` -> `ok:true` and the stored entry carries `fix_commit: \\"not-a-sha\\"`; `{ruling:\'refuted\', counter_evidence:{file:\'b.mjs\',line:2}, fix_commit:\'zzz\'}` -> `ok:true`, stores `\\"zzz\\"`; `{ruling:\'downgraded\', fix_commit:\'   \'}` -> `ok:true`, stores `\\"   \\"`. An auditor runs `git show` on that value and it fails them, which is the exact outcome FIX_COMMIT at :162 exists to prevent, and the entry simultaneously claims a commit fixed a finding that was downgraded or refuted. The same value also survives into lib/filing-decision.mjs\'s answer, where PLAN-2 Task 1 will remove `fix_commit`-carrying entries from the user\'s ask - so a junk id on a downgraded finding will silently delete it from the filing set.",',
  '      "ruling": "survived",',
  '      "convergent": false,',
  '      "base_id": "51a61b8236183fa50c90132a2b1bb9ab80652da6",',
  '      "head_id": "3341ffb06630b77df95ab3f915982604f88ab681"',
  '    }',
  '  ]',
  '}',
].join('\n'));

/** The entry the v3.7.7 close actually stopped on. */
const V377_HIGH = V377_RECORD.entries.find(
  (e) => e.file === 'cadence-core/bin/lib/adjudication-record.mjs' && e.line === 460);

test('v3.7.7 (a): the ruled record PROCEEDS - the regression LND-02 closes', () => {
  // The whole requirement in one arm. Under the old gate this exact set halted
  // the close, because the union was of REVIEW findings and a `high` was in it.
  // Read through the RULINGS it is a fixed finding, and a fixed finding stops
  // nothing.
  const dir = fixture({ auto_close: true });
  const r = seam(['gate', '--dir', dir], JSON.stringify({ findings: V377_RECORD.entries }));
  assert.equal(r.action, 'proceed', r.reason);
  assert.deepEqual(r.findings, []);
  assert.deepEqual(r.overridden, [], 'it is FIXED, not cleared - no override to surface');
  // The input really is that finding, so this arm is not a tautology: it is a
  // survived high naming a commit, which is the one shape that has to proceed.
  assert.ok(V377_HIGH, 'the fixture must carry the finding raised at :460');
  assert.equal(V377_HIGH.severity, 'high');
  assert.equal(V377_HIGH.ruling, 'survived');
  assert.equal(V377_HIGH.fix_commit, '3341ffb0');
  assert.equal(V377_RECORD.round, 2);
});

test('v3.7.7 (b): delete that ONE key and the same set halts, on that entry alone', () => {
  // The pair is the falsifier. Stripping `ruling` would not be one:
  // lib/filing-decision.mjs gates the halting set on `ruling === 'survived'`,
  // so a ruling-less entry is not a survivor and the gate proceeds either way -
  // that check passes under both the fixed and the broken predicate.
  const dir = fixture({ auto_close: true });
  const broken = V377_RECORD.entries.map((e) => {
    if (e !== V377_HIGH) return e;
    const copy = { ...e };
    delete copy.fix_commit;
    return copy;
  });
  // ...and the two arrays differ by exactly that one deleted key.
  assert.equal(broken.length, V377_RECORD.entries.length);
  broken.forEach((entry, i) => {
    const original = V377_RECORD.entries[i];
    assert.deepEqual(Object.keys(original).filter((k) => !(k in entry)),
      original === V377_HIGH ? ['fix_commit'] : [],
      'only the high loses a key, and only fix_commit');
    for (const k of Object.keys(entry)) assert.deepEqual(entry[k], original[k]);
  });

  const r = seam(['gate', '--dir', dir], JSON.stringify({ findings: broken }));
  assert.equal(r.action, 'halt', r.reason);
  assert.equal(r.findings.length, 1, 'the two mediums stood too, and neither halts');
  assert.equal(r.findings[0].line, 460);
  assert.equal(r.findings[0].fix_commit, undefined);
});

test('v3.7.7 (c): the same review with nothing ruling it halts as unruled-review', () => {
  // The fifth state (D-03). Ten of the fifteen REVIEW-risk_surface files in
  // this repo's .planning/ have no sibling record at all, and a deferred fire
  // writes none by design, so the caller names them and the gate stops.
  const dir = fixture({ auto_close: true });
  const r = seam(['gate', '--dir', dir], JSON.stringify({
    findings: V377_REVIEW.findings,
    unruled: ['.planning/phases/2/REVIEW-risk_surface-plan-1.md'],
  }));
  assert.equal(r.action, 'halt', r.reason);
  assert.ok(r.reason.includes('unruled-review'), r.reason);
  assert.ok(r.reason.includes('.planning/phases/2/REVIEW-risk_surface-plan-1.md'), r.reason);
  assert.equal(V377_REVIEW.findings.length, 3);
  assert.equal(V377_REVIEW.findings[0].severity, 'high');

  // The accepted residue, pinned rather than left to be rediscovered: those raw
  // findings carry no `ruling`, so on their own they are not survivors and the
  // gate proceeds. `unruled` is what makes an unadjudicated fire stop a close;
  // a caller that pipes raw findings and names nothing gets no halt from them.
  const unnamed = seam(['gate', '--dir', dir], JSON.stringify({ findings: V377_REVIEW.findings }));
  assert.equal(unnamed.action, 'proceed', unnamed.reason);
});

test('v3.7.7 (d): the same high, overridden - named on `overridden`, `action` unmoved', () => {
  // D-09: an override is a halt a person already cleared, so it is surfaced
  // additively and never folded into `findings`, which would re-add the false
  // halt for the one case somebody already decided.
  const dir = fixture({ auto_close: true });
  const cleared = { ...V377_HIGH, overridden: true };
  delete cleared.fix_commit;
  const r = seam(['gate', '--dir', dir], JSON.stringify({ findings: [cleared] }));
  assert.equal(r.action, 'proceed', r.reason);
  assert.deepEqual(r.findings, []);
  assert.equal(r.overridden.length, 1);
  assert.equal(r.overridden[0].line, 460);
  assert.equal(r.overridden[0].overridden, true);

  // D-05: `fix_commit` WINS. One entry carrying both markers is FIXED - it does
  // not halt and it is not an unfixed override, so it appears nowhere in the
  // surfacing. Leaving that to filter order is how one entry becomes a
  // permanent unfixed override at every close.
  const both = seam(['gate', '--dir', dir],
    JSON.stringify({ findings: [{ ...V377_HIGH, overridden: true }] }));
  assert.equal(both.action, 'proceed', both.reason);
  assert.deepEqual(both.overridden, []);
  assert.deepEqual(both.findings, []);
});

// --- the config warnings both subcommands carry -----------------------------

/** A user-global layer holding raw TEXT, so a truncated body can be written
 *  verbatim and the merge reports the parse failure. */
function globalText(text) {
  const file = join(mkdtempSync(join(tmpdir(), 'cad-lc-torn-')), 'g.json');
  writeFileSync(file, text);
  return file;
}

test('warnings[] rides BOTH land-cleanup envelopes, empty and torn', () => {
  // Pins the emission itself: stripping `, warnings })` off either emit fails
  // here. The gate arm is the sharper one - a torn layer reads auto_close as
  // absent, which is `false`, which is the arm that does NOT halt on a surviving
  // blocker, so the caller has to be able to tell "no chain is running" from
  // "the file that says so did not parse".
  const dir = fixture({ base_branch: 'main', auto_close: true });
  const cleanCleanup = seam(['cleanup', '--dir', dir, '--branch', 'cadence/v1.1.0-rc.2', '--merged', 'true']);
  assert.deepEqual(cleanCleanup.warnings, [], 'present as an empty array, not omitted');
  const cleanGate = seam(['gate', '--dir', dir], '{"findings":[{"ruling":"survived","severity":"blocker"}]}');
  assert.deepEqual(cleanGate.warnings, []);

  const torn = globalText('{"git":{"auto_close":true}');
  const tornCleanup = seam(['cleanup', '--dir', dir, '--branch', 'cadence/v1.1.0-rc.2', '--merged', 'true'], '', torn);
  assert.equal(tornCleanup.ok, true, 'advisory seam: a torn layer never blocks the advice');
  assert.match(tornCleanup.warnings[0], /failed to parse/);
  const tornGate = seam(['gate', '--dir', dir], '{"findings":[{"ruling":"survived","severity":"blocker"}]}', torn);
  assert.equal(tornGate.ok, true);
  assert.match(tornGate.warnings[0], /failed to parse/);
});

test('unknown subcommand: usage, ok false', () => {
  const r = seam(['frobnicate']);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'usage');
});

// --- --dir refuses rather than advising about the process cwd (D-01) --------

/** Run the seam raw, keeping the JSON line AND the exit status: a refusal's
 * whole contract is ok:false mirrored into exit 1 (lib/seam-io.mjs). */
function seamStatus(args, stdin = '') {
  const env = { ...process.env, CADENCE_GLOBAL_CONFIG: NO_GLOBAL };
  const r = spawnSync('node', [SEAM, ...args], { encoding: 'utf8', env, input: stdin });
  return { json: JSON.parse(r.stdout), status: r.status };
}

// Advisory, and in scope for the same reason as git-branch: cad-land ACTS on
// this advice, so advice about a tree the caller never named is not harmless.
// `gate` is the interesting arm - it reads findings from stdin, and the refusal
// must still be exactly one JSON line and exit 1 whatever stdin carries,
// because the throw happens while the argument is built.
for (const [sub, rest, stdinLabel, stdin] of [
  ['cleanup', ['--branch', 'cadence/v1.1.0-rc.2'], 'no stdin', ''],
  ['gate', [], 'a blocking findings payload on stdin',
    '{"findings":[{"ruling":"survived","severity":"high","trigger":"risk_surface"}]}'],
  ['gate', [], 'unparseable stdin', 'not json at all']]) {
  for (const [label, dirArgs] of [['an EMPTY', ['--dir', '']], ['a VALUELESS', ['--dir']]]) {
    test(`${sub}: ${label} --dir refuses by name, exit 1 - ${stdinLabel}`, () => {
      const { json, status } = seamStatus([sub, ...dirArgs, ...rest], stdin);
      assert.equal(json.ok, false);
      // The e.seam catch arm, not the generic one: the thrown refusal object
      // carries no `message`, so without it this reads internal/"[object Object]".
      assert.equal(json.reason, 'missing-flag-value', JSON.stringify(json));
      assert.equal(json.detail, '--dir');
      assert.equal(status, 1);
      assert.equal(json.action, undefined, 'no advice rides a refusal');
    });
  }
}
