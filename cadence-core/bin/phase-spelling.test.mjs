// phase-spelling.test.mjs - the tree-aware `--phase` refusal, at every
// `cadence-core/bin/planning/` face that resolves a spelling to a
// `phases/<N>/` path (phase 4, SPL-02).
//
// TWO ARMS PER FACE, always, because the refusal is TREE-AWARE and one arm
// alone proves the wrong thing (CONTEXT D-07). Against a tree holding
// `phases/1.1/`, `--phase 1.10` is `ok:false` / `bad-args` with a detail
// naming BOTH spellings. Against a tree holding only `phases/1.10/`, the SAME
// argv gets past the phase check and acts on `phases/1.10/` - the sub-phase-ten
// capability `lib/require-int.mjs` deliberately built, which this phase keeps.
// A file that only proved the refusal would pass just as well if the check were
// `phaseSpellingRefusal`'s unconditional one, which is the shape D-07 rejects.
//
// The harm is the MIXED callsite (D-06), not a wholesale misread: every one of
// these commands already reads `phases/<raw>/` verbatim, and it is the envelope's
// `phase: <value>` key beside those bytes that lies. So a "does it read the right
// directory" assertion proves nothing here and none is written.
//
// No entry in test.mjs's GROUPS: the stem is deliberately not a `planning-*`
// one, so it lands in `other`, which the default run and CI both execute - the
// same disposition census-registry.test.mjs:19 states for itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// The lease-check trio, imported rather than re-declared: that face runs inside
// a real git repo, and a second copy of the repo builder is how two fixtures
// drift apart. Importing registers nothing - the sibling's own `test` binding
// is a no-op unless it IS the entry file.
import { leaseRepo, leaseCheck, stage } from './planning-lease-check.test.mjs';

const BIN = dirname(fileURLToPath(import.meta.url));
const PLANNING = join(BIN, 'planning.mjs');

/**
 * A `.planning` tree whose `phases/` holds exactly `names`, and whose ROADMAP
 * lists phases 1 and 2 so `status`-shaped readers have something canonical to
 * reconcile against. Returns the `.planning` directory.
 */
function tree(names) {
  const dir = join(mkdtempSync(join(tmpdir(), 'cad-spelling-')), '.planning');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'ROADMAP.md'),
    '# Roadmap: Fixture\n\n## Phases\n\n- [ ] **Phase 1: One** - desc\n'
    + '- [ ] **Phase 2: Two** - desc\n\n## Phase Details\n\n'
    + '### Phase 1: One\n**Goal:** goal 1\n**Depends on:** Nothing\n');
  for (const n of names) mkdirSync(join(dir, 'phases', n), { recursive: true });
  return dir;
}

/** The seam, `--dir` last the way planning.test.mjs's own runner sends it. */
function seam(args, dir, extra = {}) {
  let stdout;
  let code = 0;
  try {
    stdout = execFileSync('node', [PLANNING, ...args, '--dir', dir],
      { encoding: 'utf8', ...extra });
  } catch (e) { stdout = e.stdout; code = e.status; }
  return { ...JSON.parse(stdout), _exit: code };
}

/** The collision refusal, asserted whole: reason, both spellings, the two fixes. */
function assertRefused(r, raw, canonical) {
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'bad-args', JSON.stringify(r));
  assert.ok(r.detail.includes(`"${raw}"`), r.detail);
  assert.ok(r.detail.includes(`phases/${canonical}/`), r.detail);
  assert.ok(r.detail.includes(`--phase "${canonical}"`), r.detail);
  assert.ok(r.detail.includes(`rename phases/${raw}/`), r.detail);
}

/** The negative: whatever this answered, it was not the collision refusal. */
function assertNotRefused(r) {
  assert.equal(typeof r.detail === 'string' && r.detail.includes('already exists on this tree'),
    false, JSON.stringify(r));
}

// --- the two fire faces: adjudication and deferred record ------------------
//
// Both reach the check through `fireIdentity`, the ONE callsite they share, and
// it fires ahead of the `--trigger`/`--discriminator` token rails and well ahead
// of `fireHome`. `fireHome`'s `no-phase-dir` is not a substitute: it names the
// right directory but neither of the two fixes, which is exactly the pre-change
// behaviour D-06 warns against mistaking for the new one.
const FIRE_FACES = [
  ['adjudication', ['adjudication']],
  ['deferred record', ['deferred', 'record']],
];

for (const [label, argv0] of FIRE_FACES) {
  test(`${label}: --phase 1.10 refuses against a tree holding phases/1.1/`, () => {
    const dir = tree(['1', '1.1']);
    const r = seam([...argv0, '--phase', '1.10', '--trigger', 'risk_surface',
      '--discriminator', 'plan-1'], dir);
    assertRefused(r, '1.10', '1.1');
    assert.ok(r.detail.startsWith(`${label} --phase`), r.detail);
  });

  test(`${label}: --phase 1.10 gets past the phase check when only phases/1.10/ exists`, () => {
    const dir = tree(['1', '1.10']);
    const r = seam([...argv0, '--phase', '1.10', '--trigger', 'risk_surface',
      '--discriminator', 'plan-1'], dir);
    assertNotRefused(r);
    // It reached the NEXT rail - both refs, neither defaulted - which is two
    // rails past the phase check.
    assert.equal(r.reason, 'bad-args', JSON.stringify(r));
    assert.match(r.detail, /--base <ref> and --head <ref>/);
  });

  test(`${label}: the token rails still fire after a clean spelling`, () => {
    const dir = tree(['1', '1.1']);
    const r = seam([...argv0, '--phase', '1.1', '--trigger', 'risk surface',
      '--discriminator', 'plan-1'], dir);
    assertNotRefused(r);
    assert.equal(r.reason, 'bad-args', JSON.stringify(r));
    assert.match(r.detail, /--trigger reaches a FILENAME/);
  });
}

test('the collision refusal is TREE-aware, not the unconditional one: 08 with no phases/8/', () => {
  const dir = tree(['08']);
  const r = seam(['adjudication', '--phase', '08', '--trigger', 'risk_surface',
    '--discriminator', 'plan-1'], dir);
  assertNotRefused(r);
});

test('a canonical spelling is never refused, whatever else is on the tree', () => {
  const dir = tree(['1', '1.1', '1.10']);
  const r = seam(['adjudication', '--phase', '1.1', '--trigger', 'risk_surface',
    '--discriminator', 'plan-1'], dir);
  assertNotRefused(r);
});

// --- the six phase-artifact readers ----------------------------------------
//
// Each row seeds `phases/<n>/` with whatever that command has to find to do
// real work, then asserts on the RESOLVE tree that the command acted on
// `phases/1.10/` - not merely that it answered ok:true, which a normalizing
// reader looking at an empty `phases/1.1/` would also do.
const READERS = [
  {
    label: 'criteria-size',
    seed: (pdir) => writeFileSync(join(pdir, 'CONTEXT.md'),
      '# Context\n\n## Acceptance criteria\n\n- [ ] AC1: one\n- [ ] AC2: two\n'),
    argv: ['criteria-size'],
    acted: (r) => {
      assert.equal(r.phases[0].context_found, true, JSON.stringify(r));
      assert.equal(r.phases[0].context_criteria, 2, JSON.stringify(r));
    },
  },
  {
    label: 'plan-size',
    seed: (pdir) => writeFileSync(join(pdir, 'PLAN.md'),
      '---\nphase: 1.10\nfiles:\n  - a.txt\n---\n# Plan\n\n## Tasks\n\n'
      + '### Task 1: x\n\n- **Files:** a.txt\n- **Action:** do\n- **Verify:** check\n'),
    argv: ['plan-size'],
    acted: (r) => assert.deepEqual(r.plans, [{ plan: 'PLAN.md', tasks: 1 }], JSON.stringify(r)),
  },
  {
    label: 'plan-overlap',
    seed: (pdir) => {
      writeFileSync(join(pdir, 'PLAN-1.md'), '---\nphase: 1.10\nfiles:\n  - shared.txt\n---\n# Plan 1\n');
      writeFileSync(join(pdir, 'PLAN-2.md'), '---\nphase: 1.10\nfiles:\n  - shared.txt\n---\n# Plan 2\n');
    },
    argv: ['plan-overlap'],
    acted: (r) => assert.deepEqual(r.overlaps,
      [{ plans: ['PLAN-1.md', 'PLAN-2.md'], files: ['shared.txt'] }], JSON.stringify(r)),
  },
  {
    label: 'cite-count',
    seed: (pdir) => writeFileSync(join(pdir, 'PLAN.md'),
      '---\nphase: 1.10\nfiles:\n  - a.txt\n---\n# Plan\n'),
    argv: ['cite-count'],
    extraArgs: (dir) => {
      const payload = join(dirname(dir), 'surfaced.json');
      writeFileSync(payload, JSON.stringify({ ok: true, backend: 'builtin', results: [] }));
      return ['--payload', payload];
    },
    acted: (r) => assert.deepEqual(r.plans, ['PLAN.md'], JSON.stringify(r)),
  },
  {
    label: 'uat',
    seed: (pdir) => writeFileSync(join(pdir, 'UAT.md'),
      '---\nstatus: testing\nphase: 1.10\nstarted: 2026-01-01\nupdated: 2026-01-01\n---\n\n'
      + '## Items\n\n### 1. Item 1\nexpected: behavior 1\nstatus: pass\n\n## Summary\n\ntotal: 1\n'),
    argv: ['uat', 'status'],
    acted: (r) => assert.equal(r.counts.pass, 1, JSON.stringify(r)),
  },
];

for (const row of READERS) {
  test(`${row.label}: --phase 1.10 acts on phases/1.10/ when no phases/1.1 exists`, () => {
    const dir = tree(['1', '1.10']);
    row.seed(join(dir, 'phases', '1.10'));
    const extra = row.extraArgs ? row.extraArgs(dir) : [];
    const r = seam([...row.argv, '--phase', '1.10', ...extra], dir);
    assert.equal(r.ok, true, JSON.stringify(r));
    row.acted(r);
  });

  test(`${row.label}: --phase 1.10 refuses against a tree holding phases/1.1/`, () => {
    const dir = tree(['1', '1.1', '1.10']);
    row.seed(join(dir, 'phases', '1.10'));
    const extra = row.extraArgs ? row.extraArgs(dir) : [];
    const r = seam([...row.argv, '--phase', '1.10', ...extra], dir);
    assertRefused(r, '1.10', '1.1');
    assert.ok(r.detail.startsWith(`${row.label} --phase`), r.detail);
  });

  test(`${row.label}: --phase 08 refuses against a tree holding phases/8/`, () => {
    const dir = tree(['8', '08']);
    row.seed(join(dir, 'phases', '08'));
    const extra = row.extraArgs ? row.extraArgs(dir) : [];
    const r = seam([...row.argv, '--phase', '08', ...extra], dir);
    assertRefused(r, '08', '8');
  });
}

// lease-check is the sixth, and it runs inside a real git repo: the seam
// resolves the staged set from `git rev-parse --show-toplevel`, so `tree()`
// above cannot host it.
test('lease-check: --phase 1.10 acts on phases/1.10/ when no phases/1.1 exists', () => {
  const { repo, dir } = leaseRepo({ phase: '1.10', files: ['one-ten.txt'] });
  stage(repo, 'one-ten.txt');
  const r = leaseCheck(repo, dir, ['--phase', '1.10', '--plan', '1']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.plan_file, '.planning/phases/1.10/PLAN.md');
});

test('lease-check: --phase 1.10 refuses against a tree holding phases/1.1/', () => {
  const { repo, dir } = leaseRepo({ phase: '1.10', files: ['one-ten.txt'] });
  mkdirSync(join(dir, 'phases', '1.1'), { recursive: true });
  stage(repo, 'one-ten.txt');
  const r = leaseCheck(repo, dir, ['--phase', '1.10', '--plan', '1']);
  assertRefused(r, '1.10', '1.1');
  assert.ok(r.detail.startsWith('lease-check --phase'), r.detail);
});

test('lease-check: --phase 08 refuses against a tree holding phases/8/', () => {
  const { repo, dir } = leaseRepo({ phase: 8, files: ['a.txt'] });
  stage(repo, 'a.txt');
  const r = leaseCheck(repo, dir, ['--phase', '08', '--plan', '1']);
  assertRefused(r, '08', '8');
});
