// Zero-dep tests for lib/close-decision.mjs (the pure land-cleanup + close core).
// Run: node --test 'cadence-core/bin/*.test.mjs'. Only node: builtins, and the
// functions are pure, so this needs no subprocess or live git.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveReapBranch, decideCleanup, decideGateHalt } from './lib/close-decision.mjs';

// --- resolveReapBranch ------------------------------------------------------

test('reap: the derived name when it is present in the merged list', () => {
  assert.equal(
    resolveReapBranch('cadence/v1.1.0-rc.2',
      ['main', 'cadence/v1.1.0-rc.2', 'cadence/v1.0.0']),
    'cadence/v1.1.0-rc.2');
});

test('reap: null derived + exactly one merged cadence/* -> that branch (fallback)', () => {
  assert.equal(
    resolveReapBranch(null, ['main', 'cadence/v1.1.0-rc.2']),
    'cadence/v1.1.0-rc.2');
});

test('reap: derived names an unmerged branch but one other cadence/* merged -> the merged one', () => {
  // cad-milestone evolved ### Active to the next version before cad-land reaps,
  // so the derived name is the NEXT (unmerged) branch; the just-shipped one is
  // the sole cadence/* actually merged.
  assert.equal(
    resolveReapBranch('cadence/v1.2.0-rc.1', ['main', 'cadence/v1.1.0-rc.2']),
    'cadence/v1.1.0-rc.2');
});

test('reap: zero merged cadence/* -> null (reap nothing)', () => {
  assert.equal(resolveReapBranch(null, ['main', 'develop']), null);
  assert.equal(resolveReapBranch('cadence/v1.1.0-rc.2', ['main']), null);
});

test('reap: two merged cadence/* -> null (ambiguous, never guess)', () => {
  assert.equal(
    resolveReapBranch(null, ['cadence/v1.1.0-rc.2', 'cadence/v1.0.0']),
    null);
});

test('reap: total on a non-array merged list', () => {
  assert.equal(resolveReapBranch('cadence/x', /** @type {any} */ (undefined)), null);
});

// --- decideCleanup ----------------------------------------------------------

test('cleanup on + merged: cleanup, reap true, return + pull', () => {
  const r = decideCleanup({ onLandCleanup: true, mergedIntoBase: true, branch: 'cadence/v1.1.0-rc.2' });
  assert.equal(r.action, 'cleanup');
  assert.equal(r.returnToBase, true);
  assert.equal(r.pull, true);
  assert.equal(r.reap, true);
  assert.equal(r.branch, 'cadence/v1.1.0-rc.2');
});

test('cleanup on + not merged: cleanup, reap false (never reap an unmerged branch)', () => {
  const r = decideCleanup({ onLandCleanup: true, mergedIntoBase: false, branch: 'cadence/v1.1.0-rc.2' });
  assert.equal(r.action, 'cleanup');
  assert.equal(r.reap, false);
  assert.equal(r.returnToBase, true);
});

test('cleanup on + merged but null branch -> reap false (never git branch -D a null)', () => {
  // GitHub auto_close: gh pr merge --delete-branch removes the branch, so the
  // seam forces --merged true yet resolveReapBranch returns null. Reap must not
  // fire on a null branch, or the tail `git branch -D <null>` errors.
  const r = decideCleanup({ onLandCleanup: true, mergedIntoBase: true, branch: null });
  assert.equal(r.action, 'cleanup');
  assert.equal(r.reap, false);
  assert.equal(r.branch, null);
  assert.equal(r.returnToBase, true);
  assert.equal(r.pull, true);
});

test('cleanup off: skip, every flag false', () => {
  const r = decideCleanup({ onLandCleanup: false, mergedIntoBase: true, branch: 'cadence/v1.1.0-rc.2' });
  assert.equal(r.action, 'skip');
  assert.equal(r.returnToBase, false);
  assert.equal(r.pull, false);
  assert.equal(r.reap, false);
});

test('cleanup is total: missing onLandCleanup -> skip, branch coerced to null', () => {
  const r = decideCleanup({});
  assert.equal(r.action, 'skip');
  assert.equal(r.branch, null);
});

// --- decideGateHalt ---------------------------------------------------------

test('gate: auto_close on + a blocker -> halt with that finding', () => {
  const finding = { severity: 'blocker', title: 'secret leaked' };
  const r = decideGateHalt({ autoClose: true, findings: [finding] });
  assert.equal(r.action, 'halt');
  assert.deepEqual(r.findings, [finding]);
});

test('gate: auto_close on + a high -> halt', () => {
  const r = decideGateHalt({ autoClose: true, findings: [{ severity: 'high' }] });
  assert.equal(r.action, 'halt');
});

test('gate: auto_close on + only medium/low -> proceed', () => {
  const r = decideGateHalt({ autoClose: true, findings: [{ severity: 'medium' }, { severity: 'low' }] });
  assert.equal(r.action, 'proceed');
  assert.deepEqual(r.findings, []);
});

test('gate: auto_close off + a blocker -> proceed (chain not running unattended)', () => {
  const r = decideGateHalt({ autoClose: false, findings: [{ severity: 'blocker' }] });
  assert.equal(r.action, 'proceed');
});

test('gate: total on non-array findings -> proceed, no throw', () => {
  assert.equal(decideGateHalt({ autoClose: true, findings: /** @type {any} */ (null) }).action, 'proceed');
  assert.equal(decideGateHalt({}).action, 'proceed');
});
