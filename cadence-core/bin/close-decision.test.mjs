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

test('gate: the halting list is DECIDED before it gets here - this reads no severity', () => {
  // Was `auto_close on + only medium/low -> proceed`, which asserted a filter
  // this function no longer performs. The classification moved to the
  // land-cleanup.mjs seam (LND-02, D-06): it runs lib/filing-decision.mjs's
  // `unfixedFromEntries` over the adjudication entries it was piped and hands
  // in the genuinely-unfixed halting set. So what is asserted here is the rule
  // that is actually left - a non-empty list halts, whatever it holds - and
  // that no severity is read on the way to that answer.
  assert.equal(decideGateHalt({ autoClose: true, findings: [{ severity: 'medium' }] }).action, 'halt');
  assert.equal(decideGateHalt({ autoClose: true, findings: [{ severity: 'low' }] }).action, 'halt');
  assert.equal(decideGateHalt({ autoClose: true, findings: [{ file: 'a.mjs' }] }).action, 'halt',
    'a member carrying no severity at all still halts: the seam already decided');
  const empty = decideGateHalt({ autoClose: true, findings: [] });
  assert.equal(empty.action, 'proceed');
  assert.deepEqual(empty.findings, []);
});

test('gate: auto_close off + a blocker -> proceed (chain not running unattended)', () => {
  const r = decideGateHalt({ autoClose: false, findings: [{ severity: 'blocker' }] });
  assert.equal(r.action, 'proceed');
});

test('gate: total on non-array findings -> proceed, no throw', () => {
  assert.equal(decideGateHalt({ autoClose: true, findings: /** @type {any} */ (null) }).action, 'proceed');
  assert.equal(decideGateHalt({}).action, 'proceed');
});

// --- decideGateHalt: the unreadable-findings input ---------------------------

// The four names land-cleanup.mjs readFindings passes, stated in the JSDoc so
// the pure core and the seam cannot drift.
const UNREADABLE = ['stdin-unreadable', 'stdin-empty', 'malformed-json', 'not-a-findings-payload'];

for (const name of UNREADABLE) {
  test(`gate: auto_close on + unreadable "${name}" -> halt naming it, no claim about survivors`, () => {
    const r = decideGateHalt({ autoClose: true, findings: [], unreadable: name });
    assert.equal(r.action, 'halt');
    assert.deepEqual(r.findings, []);
    assert.ok(r.reason.includes(name), `reason must name the failure: ${r.reason}`);
    assert.ok(!/no surviving blocker\/high finding/.test(r.reason),
      'the halt must not assert anything about findings it never read');
  });

  test(`gate: auto_close off + unreadable "${name}" -> proceed (no unattended chain)`, () => {
    const r = decideGateHalt({ autoClose: false, findings: [], unreadable: name });
    assert.equal(r.action, 'proceed');
    assert.match(r.reason, /auto_close off/);
  });
}

test('gate: an EXPLICIT empty findings array with no failure still proceeds', () => {
  const r = decideGateHalt({ autoClose: true, findings: [], unreadable: null });
  assert.equal(r.action, 'proceed');
  assert.match(r.reason, /no surviving blocker\/high finding/);
});

test('gate: a surviving blocker still halts with the finding on the envelope', () => {
  const finding = { severity: 'blocker', title: 'secret leaked' };
  const r = decideGateHalt({ autoClose: true, findings: [finding], unreadable: null });
  assert.equal(r.action, 'halt');
  assert.deepEqual(r.findings, [finding]);
});

test('gate: the halt names its PRODUCER, so a fed-by-nothing gate is visible', () => {
  // The gate spent v3.2.0 fed by `pre_ship`, which that release deleted. A
  // reason string naming a trigger that no longer exists is how a control
  // reporting success on an empty feed stays invisible, so the producer is
  // pinned here rather than left to a comment.
  const r = decideGateHalt({ autoClose: true, findings: [{ severity: 'high' }] });
  assert.equal(r.action, 'halt');
  assert.match(r.reason, /risk_surface/);
});

test('gate: stays total - an unknown `unreadable` value cannot halt a close', () => {
  assert.equal(decideGateHalt({ autoClose: true, findings: [], unreadable: /** @type {any} */ ({}) }).action, 'proceed');
  assert.equal(decideGateHalt({ autoClose: true, findings: [], unreadable: '' }).action, 'proceed');
});

// --- decideGateHalt: the FIFTH state, a review nothing ruled (D-03) ----------

test('gate: auto_close on + a non-empty `unruled` -> halt naming unruled-review', () => {
  // A REVIEW-risk_surface*.md with no sibling ADJUDICATION-*.json: the fire
  // happened and nothing ruled it, so its findings are neither fixed nor
  // refuted nor declined. Reading past that is the fail-open LND-02 closes.
  const r = decideGateHalt({ autoClose: true, findings: [],
    unruled: ['.planning/phases/2/REVIEW-risk_surface-plan-1.md'] });
  assert.equal(r.action, 'halt');
  assert.deepEqual(r.findings, [], 'nothing is claimed about findings that were never ruled');
  assert.ok(r.reason.includes('unruled-review'), `reason must name the fifth state: ${r.reason}`);
  assert.ok(r.reason.includes('.planning/phases/2/REVIEW-risk_surface-plan-1.md'),
    `reason must name what it holds: ${r.reason}`);
  assert.match(r.reason, /risk_surface/);
});

test('gate: the fifth state is its OWN arm, never folded into `unreadable` (D-13)', () => {
  // The payload WAS read and parsed here, so the unreadable sentence would be a
  // false statement about input this gate did see. Neither name leaks into the
  // other's reason.
  const unruled = decideGateHalt({ autoClose: true, findings: [], unruled: ['R.md'] });
  for (const name of UNREADABLE) {
    assert.ok(!unruled.reason.includes(name), `${name} must not appear in the unruled halt`);
  }
  const unreadable = decideGateHalt({ autoClose: true, findings: [], unreadable: 'stdin-empty', unruled: ['R.md'] });
  assert.ok(unreadable.reason.includes('stdin-empty'),
    'unreadable is decided FIRST: a payload nobody parsed says nothing about anything else');
  assert.ok(!unreadable.reason.includes('unruled-review'), unreadable.reason);
});

test('gate: auto_close off + a non-empty `unruled` -> proceed (no unattended chain)', () => {
  const r = decideGateHalt({ autoClose: false, findings: [], unruled: ['R.md'] });
  assert.equal(r.action, 'proceed');
  assert.match(r.reason, /auto_close off/);
});

test('gate: an unruled halt is bounded and never renders a caller\'s object', () => {
  // `unruled` rides in off stdin, so it is untrusted input: the count comes off
  // the real length and only non-blank strings are ever named, at most five.
  const r = decideGateHalt({ autoClose: true, findings: [],
    unruled: ['a.md', 'b.md', 'c.md', 'd.md', 'e.md', 'f.md', 'g.md'] });
  assert.ok(r.reason.includes('7 risk_surface review(s)'), r.reason);
  assert.ok(r.reason.includes('+2 more'), r.reason);
  assert.ok(!r.reason.includes('g.md'), r.reason);
  const odd = decideGateHalt({ autoClose: true, findings: [], unruled: [{ file: 'x' }, null, ''] });
  assert.equal(odd.action, 'halt', 'a member too odd to name still halts - fail closed');
  assert.ok(!odd.reason.includes('[object Object]'), odd.reason);
  assert.ok(odd.reason.includes('3 risk_surface review(s)'), odd.reason);
});

// --- decideGateHalt: the cleared halt rides out, and moves nothing (D-09) ----

test('gate: `overridden` rides every arm unchanged and never moves `action`', () => {
  // A halting survivor a person already cleared. Folding it into `findings`
  // would re-add the false halt this requirement removes, for the one case
  // somebody already decided - so it is carried, never decided on.
  const cleared = [{ ruling: 'survived', severity: 'blocker', overridden: true }];
  const proceed = decideGateHalt({ autoClose: true, findings: [], overridden: cleared });
  assert.equal(proceed.action, 'proceed');
  assert.deepEqual(proceed.overridden, cleared);
  assert.deepEqual(proceed.findings, [], 'the cleared halt is not folded into findings');

  const halt = decideGateHalt({ autoClose: true, findings: [{ ruling: 'survived' }], overridden: cleared });
  assert.equal(halt.action, 'halt');
  assert.deepEqual(halt.overridden, cleared, 'it rides the halt arm too');

  const unreadable = decideGateHalt({ autoClose: true, unreadable: 'stdin-empty', overridden: cleared });
  assert.deepEqual(unreadable.overridden, cleared);
  const off = decideGateHalt({ autoClose: false, findings: [{ ruling: 'survived' }], overridden: cleared });
  assert.equal(off.action, 'proceed');
  assert.deepEqual(off.overridden, cleared);
});

test('gate: stays total on a non-array `unruled` or `overridden`', () => {
  const r = decideGateHalt({ autoClose: true, findings: [],
    unruled: /** @type {any} */ ('R.md'), overridden: /** @type {any} */ (null) });
  assert.equal(r.action, 'proceed');
  assert.deepEqual(r.overridden, []);
  assert.deepEqual(decideGateHalt({}).overridden, []);
});
