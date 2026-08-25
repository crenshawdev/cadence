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
