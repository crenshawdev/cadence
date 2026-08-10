// Zero-dep tests for lib/include-consumers.mjs - the include-consumer rule as a
// pure function. Run:
//   node --test cadence-core/bin/include-consumers.test.mjs
// Only node: builtins, per the repo's zero-dep ethos.
//
// self-verify.test.mjs owns the CLI wiring and the live-tree assertion. This
// file owns the rule: which includes are judged, what counts as naming one, and
// both bounds on the one-row waiver register. The headline fixtures are `cpSync`
// byte-copies of REAL shipped surfaces, because the defect this rule exists to
// catch is in those bytes and a synthetic file proves the rule against prose
// nobody has to keep true.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { includeConsumerIssues, WAIVED, CODES } from './lib/include-consumers.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');

/** An empty temp root. */
function emptyRoot() {
  return mkdtempSync(join(tmpdir(), 'cad-includes-'));
}

/**
 * Copy a real shipped file into a fixture root at the SAME root-relative path,
 * optionally transforming its text on the way in.
 * @param {string} root @param {string} rel @param {(t: string) => string} [edit]
 */
function copyReal(root, rel, edit = (t) => t) {
  const dst = join(root, ...rel.split('/'));
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(join(REPO, ...rel.split('/')), dst);
  const text = readFileSync(dst, 'utf8');
  const edited = edit(text);
  if (edited !== text) writeFileSync(dst, edited);
  return edited;
}

/** Write a file at a root-relative path, creating its parents. */
function put(root, rel, text) {
  const dst = join(root, ...rel.split('/'));
  mkdirSync(dirname(dst), { recursive: true });
  writeFileSync(dst, text);
}

/** A minimal user-invocable SKILL.md with the given body. */
const skillFile = (name, body) =>
  `---\nname: ${name}\ndescription: "fixture"\nallowed-tools:\n  - Read\n---\n\n${body}\n`;

/** The `@`-include line for a core-relative path. */
const includeLine = (rel) => `@\${CLAUDE_PLUGIN_ROOT}/${rel}`;

// --- AC5, first half: the live defect, on the live bytes ----------------------
// `skills/cad-verify/SKILL.md:29` includes 5,792 B of `templates/UAT.md` that no
// prose in `/cad-verify` has ever named. The fixture is a byte copy, so what
// fires here fires on the tree.

const VERIFY_SKILL = 'skills/cad-verify/SKILL.md';
const VERIFY_WF = 'cadence-core/workflows/verify.md';
const UAT_INCLUDE = 'cadence-core/templates/UAT.md';

/** The real `/cad-verify` eager pair, optionally with its UAT include removed. */
function verifyRoot({ withInclude = true } = {}) {
  const root = emptyRoot();
  copyReal(root, VERIFY_SKILL, (t) => (withInclude
    ? t
    : t.replace(`${includeLine(UAT_INCLUDE)}\n`, '')));
  copyReal(root, VERIFY_WF);
  return root;
}

test('AC5: the live cad-verify bytes report exactly one unnamed include', () => {
  const root = verifyRoot();
  // Guard the fixture: the include line must actually be there, or the "one
  // issue" below would be measuring a file that lost it in the copy.
  assert.ok(readFileSync(join(root, ...VERIFY_SKILL.split('/')), 'utf8')
    .includes(includeLine(UAT_INCLUDE)), 'fixture must carry the include line');
  const issues = includeConsumerIssues(root, []);
  assert.deepEqual(issues.map((i) => i.kind), [CODES.neverNamed]);
  assert.equal(issues[0].file, VERIFY_SKILL);
  assert.match(issues[0].detail, /cadence-core\/templates\/UAT\.md/);
});

test('AC5: the same bytes report nothing under the shipped one-row WAIVED', () => {
  // The phase-2 bridge. AC5 needs the report, AC7 needs a green live tree, and
  // they are the same bytes - see the lib header.
  assert.deepEqual(includeConsumerIssues(verifyRoot()), []);
});

test('AC5: cad-help passes under both, because its objective names the include', () => {
  // The legitimate shape the dead include was wrongly compared to:
  // `references/COMMANDS.md` is named in `cad-help`'s own `<objective>`.
  const root = emptyRoot();
  copyReal(root, 'skills/cad-help/SKILL.md');
  copyReal(root, 'cadence-core/references/COMMANDS.md');
  assert.deepEqual(includeConsumerIssues(root, []), []);
  assert.deepEqual(includeConsumerIssues(root), []);
});

// --- AC6 and the exclusions that make the check non-vacuous ------------------

test('AC6: an include named ONLY by its own `@`-include line still reports', () => {
  // `CITE_RE` in lib/resident-weight.mjs matches the include LINE and yields
  // `references/x.md` from it. Leaving those lines in the scan text would make
  // every include name itself and the check ok:true forever (D-10).
  const root = emptyRoot();
  put(root, 'skills/cad-fixture/SKILL.md',
    skillFile('cad-fixture', `<execution_context>\n${includeLine('cadence-core/references/x.md')}\n</execution_context>\n\n<process>\nDo the thing.\n</process>`));
  put(root, 'cadence-core/references/x.md', '# X\n\nSome prose.\n');
  const issues = includeConsumerIssues(root, []);
  assert.deepEqual(issues.map((i) => i.kind), [CODES.neverNamed]);
  assert.equal(issues[0].file, 'skills/cad-fixture/SKILL.md');
  assert.match(issues[0].detail, /references\/x\.md/);
});

test('a self-citing INCLUDED file does not answer for the command that includes it', () => {
  // The root-relative exclusion, proved to actually MATCH rather than silently
  // never matching. `references/config-reach.md:3` names its own path in its own
  // body; if the exclusion compared against a realpath or a dedupe key, this
  // fixture would pass and the check would be vacuous for every self-naming
  // reference (D-10, and `commandEagerSets`' JSDoc naming `surface` as the
  // root-relative field).
  const root = emptyRoot();
  put(root, 'skills/cad-fixture/SKILL.md',
    skillFile('cad-fixture', `<execution_context>\n${includeLine('cadence-core/references/config-reach.md')}\n</execution_context>\n\n<process>\nDo the thing.\n</process>`));
  copyReal(root, 'cadence-core/references/config-reach.md');
  const issues = includeConsumerIssues(root, []);
  assert.deepEqual(issues.map((i) => i.kind), [CODES.neverNamed]);
  assert.match(issues[0].detail, /references\/config-reach\.md/);
});

test('a workflows/ include is exempt even when nothing names it anywhere', () => {
  // The workflow IS the command's process. Measured over the live tree,
  // `workflows/<name>.md` is named nowhere in its own command's eager text for
  // 15 of 16 commands, so an unexempted check lands red on 19 correct includes
  // (D-08).
  const root = emptyRoot();
  put(root, 'skills/cad-fixture/SKILL.md',
    skillFile('cad-fixture', `<execution_context>\n${includeLine('cadence-core/workflows/fixture.md')}\n</execution_context>`));
  put(root, 'cadence-core/workflows/fixture.md', '# Fixture workflow\n\nSteps.\n');
  assert.deepEqual(includeConsumerIssues(root, []), []);
});

test('naming is the <branch>/<file> path form, never the basename', () => {
  // `workflows/verify.md` says bare `UAT.md` eight times for the runtime
  // artifact `.planning/phases/<N>/UAT.md`; basename matching would stop the
  // check firing on the one instance it must catch (D-09).
  const root = emptyRoot();
  const body = (mention) => `<execution_context>\n${includeLine('cadence-core/templates/UAT.md')}\n</execution_context>\n\n<process>\n${mention}\n</process>`;
  put(root, 'skills/cad-fixture/SKILL.md',
    skillFile('cad-fixture', body('Write the checklist into UAT.md as you go.')));
  put(root, 'cadence-core/templates/UAT.md', '# UAT\n');
  assert.deepEqual(includeConsumerIssues(root, []).map((i) => i.kind), [CODES.neverNamed]);

  // The path form satisfies it, in any of its three spellings.
  for (const named of [
    'Fill in templates/UAT.md.',
    'Fill in cadence-core/templates/UAT.md.',
    'Fill in ${CLAUDE_PLUGIN_ROOT}/cadence-core/templates/UAT.md.',
  ]) {
    put(root, 'skills/cad-fixture/SKILL.md', skillFile('cad-fixture', body(named)));
    assert.deepEqual(includeConsumerIssues(root, []), [], named);
  }
});

test('an included surface named by the command WORKFLOW satisfies the check', () => {
  // The scan set is the whole EAGER set, not the SKILL.md alone: `cad-phase`,
  // `cad-milestone` and `cad-undo` each name `references/git-guard.md` only in
  // their workflow.
  const root = emptyRoot();
  put(root, 'skills/cad-fixture/SKILL.md',
    skillFile('cad-fixture', `<execution_context>\n${includeLine('cadence-core/workflows/fixture.md')}\n${includeLine('cadence-core/references/git-guard.md')}\n</execution_context>`));
  put(root, 'cadence-core/workflows/fixture.md',
    '# Fixture\n\nRun the guard per references/git-guard.md before committing.\n');
  put(root, 'cadence-core/references/git-guard.md', '# Guard\n');
  assert.deepEqual(includeConsumerIssues(root, []), []);
});

// --- the waiver register, and both of its bounds ------------------------------

test('WAIVED is exactly one frozen row, and the row is frozen too', () => {
  // The size is the guarantee. A phase whose purpose is closing CI holes must
  // not ship the mechanism that reopens them, so growing this register is a red
  // build rather than a code-review judgement call.
  assert.equal(WAIVED.length, 1);
  assert.ok(Object.isFrozen(WAIVED));
  assert.ok(Object.isFrozen(WAIVED[0]));
  assert.deepEqual({ ...WAIVED[0] },
    { skill: 'cad-verify', surface: 'templates/UAT.md', removeInPhase: 2 });
});

test('DOWNWARD bound: the waiver cannot outlive its `@`-include line', () => {
  // Phase 2 deletes `skills/cad-verify/SKILL.md:29`. Leaving the row behind is
  // itself a problem, so the two die in one commit or CI goes red.
  const root = verifyRoot({ withInclude: false });
  const issues = includeConsumerIssues(root);
  assert.deepEqual(issues.map((i) => i.kind), [CODES.staleWaiver]);
  assert.equal(issues[0].file, VERIFY_SKILL);
  assert.match(issues[0].detail, /templates\/UAT\.md/);
});

test('UPWARD bound: a checked-off phase 2 expires the waiver', () => {
  // `removeInPhase` is an executable deadline. Without it, a phase 2 that slips
  // or is dropped leaves the defect suppressed indefinitely with CI green.
  const root = verifyRoot();
  put(root, '.planning/ROADMAP.md',
    '## Phases\n\n- [x] **Phase 1: The checks** - done\n- [x] **Phase 2: The free cuts** - done\n');
  const issues = includeConsumerIssues(root);
  assert.deepEqual(issues.map((i) => i.kind), [CODES.expiredWaiver]);
  assert.equal(issues[0].file, VERIFY_SKILL);
  assert.match(issues[0].detail, /phase 2/);
});

test('UPWARD bound: an UNCHECKED phase 2, or no ROADMAP at all, reports nothing', () => {
  const root = verifyRoot();
  put(root, '.planning/ROADMAP.md',
    '## Phases\n\n- [x] **Phase 1: The checks** - done\n- [ ] **Phase 2: The free cuts** - open\n');
  assert.deepEqual(includeConsumerIssues(root), []);
  // The partial-fixture degradation: a root carrying no `.planning/` arm is not
  // a break, the same way lib/deferred-reads.mjs treats an absent `skills/`.
  assert.deepEqual(includeConsumerIssues(verifyRoot()), []);
});

test('a waiver row whose skill is absent from the root reports nothing', () => {
  const root = emptyRoot();
  put(root, 'skills/cad-help/SKILL.md', skillFile('cad-help', '<process>\nNothing.\n</process>'));
  assert.deepEqual(includeConsumerIssues(root), []);
});

test('an absent skills/ directory contributes nothing at all', () => {
  assert.deepEqual(includeConsumerIssues(emptyRoot()), []);
});
