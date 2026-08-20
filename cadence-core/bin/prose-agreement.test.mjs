// Zero-dep tests for one subject: prose that COPIES a machine-readable fact
// must still match that fact. Every check here reads a live document and the
// artifact it copies from - a route table, a resolver's own output, a measured
// byte count - and fails when the two have drifted apart.
//
// Why here and not in self-verify.mjs. Two of these subjects are cells of the
// Wiring table in cadence-core/references/review-triggers.md, and
// self-verify.mjs:927 records a standing decision NOT to parse that table:
// it has no stated grammar, so a check built on its shape goes red on a
// reformat that changed no fact (the failure mode lib/deferred-reads.mjs
// documents). These tests parse one NAMED ROW each instead of the table's
// shape, and they live in a test file rather than in the linter so the
// decision stays intact.
//
// Run: node --test 'cadence-core/bin/*.test.mjs' - CI's own glob, which is why
// this is a top-level file and not one under lib/. tsconfig.ci.json excludes
// *.test.mjs, so nothing here carries an @ts-check burden.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { activeVersion } from './lib/branch-decision.mjs';
import { weighAll } from './lib/surface-weight.mjs';
import { DEFERRED_READS, regionLabels } from './lib/deferred-reads.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const ROUTE = join(HERE, 'route.mjs');

/** A repo file as text. */
const doc = (...parts) => readFileSync(join(REPO, ...parts), 'utf8');

/**
 * The row of a pipe table whose FIRST cell names `label`, as trimmed cells.
 * One named row, never the table's shape: self-verify.mjs:927's standing
 * decision is that this table has no stated grammar, so a check that asserted
 * column counts or ordering would go red on a reformat that changed no fact.
 */
function tableRow(text, label) {
  const line = text.split('\n').find((l) =>
    l.startsWith('|') && l.split('|')[1] !== undefined
    && l.split('|')[1].trim().replace(/`/g, '') === label);
  assert.ok(line, `no table row for ${label}`);
  return line.split('|').slice(1, -1).map((c) => c.trim());
}

/**
 * Count words the prose may spell a dimension total with. A table rather than
 * a regex over digits: these documents write the number in WORDS, and a lookup
 * that silently returns 0 for an unlisted word would turn a renamed count into
 * a passing check instead of a loud one.
 */
const WORD_TO_NUMBER = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10,
};

/** The number a count word stands for, asserting the word is one we know. */
function countWord(word, where) {
  const n = WORD_TO_NUMBER[String(word).toLowerCase()];
  assert.ok(n !== undefined, `${where}: unrecognised count word ${JSON.stringify(word)}`);
  return n;
}

// --- DFC-03: the plan checker's dimension count agrees with itself -----------

test('cad-plan-checker-contract states one dimension count in all three places', () => {
  // The defect: <dimensions> said "Check six dimensions" and listed six, while
  // <success_criteria> said "All five dimensions checked" - so a checker could
  // report success having skipped Proportionality, the dimension that bounds
  // plan size, and be within its own contract for doing it.
  const src = doc('skills', 'cad-plan-checker-contract', 'SKILL.md');

  const block = src.match(/<dimensions>([\s\S]*?)<\/dimensions>/);
  assert.ok(block, 'no <dimensions> block in the contract');

  const declared = block[1].match(/\bCheck\s+(\w+)\s+dimensions\b/);
  assert.ok(declared, '<dimensions> does not open with "Check <n> dimensions"');
  const declaredCount = countWord(declared[1], '<dimensions>');

  const criteria = src.match(/<success_criteria>([\s\S]*?)<\/success_criteria>/);
  assert.ok(criteria, 'no <success_criteria> block in the contract');
  const claimed = criteria[1].match(/\bAll\s+(\w+)\s+dimensions checked\b/);
  assert.ok(claimed, '<success_criteria> does not state "All <n> dimensions checked"');
  const claimedCount = countWord(claimed[1], '<success_criteria>');

  const enumerated = (block[1].match(/^\d+\. \*\*/gm) || []).length;

  assert.equal(declaredCount, enumerated,
    `<dimensions> says ${declaredCount} but enumerates ${enumerated}`);
  assert.equal(claimedCount, enumerated,
    `<success_criteria> says ${claimedCount} but <dimensions> enumerates ${enumerated}`);
});

// --- DFC-02: both statements of phase_diff's gates match the RESOLVER --------

const LEVELS = ['solo', 'shipped', 'critical'];

/**
 * `review` as `route.mjs resolve` returns it for `cad-reviewer` at each stakes
 * level, keyed by level. Driven through the per-repo `--file` layer because
 * `resolve` takes no level flag, and read off the RESOLVER rather than off
 * route-table.json: the prose copies what a run actually gets, so level
 * mapping, schema defaults and role selection have to be inside the check or
 * they stay free to diverge from the two documents that quote them.
 */
function resolvedReview() {
  const dir = mkdtempSync(join(tmpdir(), 'cad-prose-'));
  /** @type {Record<string, Record<string, string>>} */
  const out = {};
  for (const level of LEVELS) {
    const cfg = join(dir, `${level}.json`);
    writeFileSync(cfg, JSON.stringify({ stakes: level }));
    const line = execFileSync('node',
      [ROUTE, 'resolve', '--role', 'cad-reviewer', '--file', cfg], { encoding: 'utf8' });
    const r = JSON.parse(line);
    assert.equal(r.ok, true, line);
    assert.equal(r.stakes, level, `--file did not drive stakes to ${level}: ${line}`);
    out[level] = r.review;
  }
  return out;
}

test('phase_diff gates: the wiring table and docs/WORKFLOW.md both match the resolver', () => {
  // The defect: both read `off / off / adjudicated` while the resolver returns
  // `advisory` at shipped. One wrong row in the reference was the single source
  // of four separate wrong claims across two documents.
  const resolved = resolvedReview();
  const want = LEVELS.map((l) => resolved[l].phase_diff);

  const wiring = tableRow(doc('cadence-core', 'references', 'review-triggers.md'), 'phase_diff');
  const cell = wiring[wiring.length - 1].split('/').map((s) => s.trim());
  assert.deepEqual(cell, want,
    `review-triggers.md states ${cell.join(' / ')}, the resolver returns ${want.join(' / ')}`);

  // WORKFLOW.md spells the same three values as three separate columns.
  const workflow = tableRow(doc('docs', 'WORKFLOW.md'), 'phase_diff');
  assert.deepEqual(workflow.slice(-3), want,
    `docs/WORKFLOW.md states ${workflow.slice(-3).join(' / ')}, the resolver returns ${want.join(' / ')}`);
});

// --- DFC-04: the risk_surface row admits the artifact /cad-task produces -----

test('risk_surface row: its shape (c) clause names no producer, and task.md still holds its rails', () => {
  // The defect: the row admitted "(c) the flagged-diff FILE path THE CHECKPOINT
  // RETURNED", and /cad-task's fire produces that file with no checkpoint at
  // all - its commits already exist. Correcting the workflow to match the row
  // is what produced a worse instruction than the one it replaced, so the row
  // is what moves. Section 2's own shape-(c) definition is already broad
  // enough ("a file artifact... or one the reviewer's tree cannot reach").
  const row = tableRow(doc('cadence-core', 'references', 'review-triggers.md'), 'risk_surface');

  const firedBy = row[1].split(',').map((s) => s.trim().replace(/`/g, ''));
  assert.deepEqual(firedBy, ['cad-execute', 'cad-debug', 'cad-task', 'cad-verify']);

  const payload = row[3];
  assert.match(payload, /\(c\)/, 'the row no longer offers shape (c)');
  assert.match(payload, /\(b\)/, 'the row no longer offers shape (b)');
  // The qualifier itself. Bounded to THIS cell, never a tree scan: verify.md's
  // own shape-(c) fire is a diagnosis review naming no wiring-table trigger and
  // carrying no resolved gate, and must not be dragged in here.
  const shapeC = payload.split(/,\s*or\s*\(b\)/)[0];
  assert.doesNotMatch(shapeC, /checkpoint/i,
    'shape (c) is qualified by its producer again, so a /cad-task fire is a shape the row does not admit');

  // The other half of DFC-04 is already closed in the workflow (716fb60) and
  // ROADMAP criterion 4 forbids losing it. Pinned so a future "simplification"
  // of the row cannot take these with it.
  const task = doc('cadence-core', 'workflows', 'task.md');
  assert.match(task, /\.planning\/tasks\/\{slug\}\/risk-task-\{slug\}\.diff/);
  assert.match(task, /never stage it/i);
  assert.match(task, /delete it once\s+the trigger returns/i);
});

// --- CST-02: the eight risk-surface categories, stated in three places -------

test('risk-surface categories: the schema enum, the route table and the detection list are one list', () => {
  // route.mjs may not read config.schema.json - a schema default read there
  // becomes a user assertion - so route-table.json carries a hand-maintained
  // copy of this vocabulary, and the reference names the same tokens beside the
  // prose category each one stands for. Three statements of one list, and
  // nothing but this check keeps them one list.
  const spec = JSON.parse(doc('cadence-core', 'config.schema.json'))
    .keys['review.triggers.risk_surface.surfaces'];
  assert.ok(spec, 'config.schema.json defines no review.triggers.risk_surface.surfaces');
  const table = JSON.parse(doc('cadence-core', 'route-table.json')).risk_surface_categories;

  const after = doc('cadence-core', 'references', 'review-triggers.md')
    .split('## risk_surface detection')[1];
  assert.ok(after, 'review-triggers.md has no risk_surface detection section');
  const prose = [...after.split(/\n## /)[0].matchAll(/^- `([a-z_]+)` - /gm)].map((m) => m[1]);

  assert.deepEqual(table, spec.values,
    `route-table.json states [${table}], config.schema.json states [${spec.values}]`);
  assert.deepEqual(prose, spec.values,
    `review-triggers.md's detection list states [${prose}], config.schema.json states [${spec.values}]`);

  // D-12: no default ARRAY. A default of all eight would make "the user chose
  // everything" indistinguishable from "nobody has answered", and the
  // unanswered state is the one the first fire's ask exists to detect.
  assert.equal(spec.default, null,
    'the key has a default array again, so the unanswered state is undetectable');
});

test('plan authority: Action never invents, Verify decides, in all five documents', () => {
  // The defect this pins. templates/PLAN.md and the planner contract both used
  // to require Action to carry "identifiers, signatures" for code that did not
  // exist yet. The planner cannot know those, so every guess reached the
  // executor as an instruction reality then contradicted: one archived report
  // carries 36 deviations, among them a field named `warnings` that is really
  // `warning_count` and a `run()` helper the plan routed through that is not
  // reachable. The executor contract then sorted those departures by how
  // ARCHITECTURAL they looked, which let an invented parsing pass through as
  // "trivial". Authority moved to Verify; these five documents must say so
  // together, because a planner reading one and an executor reading another is
  // exactly how the old split survived three releases.
  const template = doc('cadence-core', 'templates', 'PLAN.md');
  const planner = doc('skills', 'cad-planner-contract', 'SKILL.md');
  const executor = doc('skills', 'cad-executor-contract', 'SKILL.md');
  const checker = doc('skills', 'cad-plan-checker-contract', 'SKILL.md');
  const method = doc('METHOD.md');

  // Nothing may re-acquire the demand that produced the guesses.
  for (const [name, text] of [['templates/PLAN.md', template],
    ['cad-planner-contract', planner], ['METHOD.md', method]]) {
    assert.doesNotMatch(text, /identifiers,\s*signatures/,
      `${name} asks for identifiers and signatures again - the planner cannot know them`);
  }

  // Both authoring documents state the prohibition and the permission together:
  // inventing is out, naming what already exists is in.
  for (const [name, text] of [['templates/PLAN.md', template], ['cad-planner-contract', planner]]) {
    assert.match(text, /ALREADY EXIST/, `${name} dropped the name-what-exists permission`);
    assert.match(text, /(never|Never|NOT)\s+invent/, `${name} dropped the invent prohibition`);
  }

  // Verify is named as the authority on both sides of the dispatch, so the
  // executor's licence and the planner's obligation cannot drift apart.
  assert.match(planner, /AUTHORITY/, 'the planner contract no longer calls Verify the authority');
  assert.match(template, /AUTHORITY/, 'the template no longer calls Verify the authority');
  assert.match(executor, /[Yy]our authority is the task's `Verify:`/,
    'the executor contract no longer takes its authority from Verify');
  assert.match(checker, /whole\s+authority/,
    'the plan checker no longer weighs Verify as the task authority');

  // The taxonomy that let unplanned code through as "trivial" stays deleted.
  for (const [name, text] of [['cad-executor-contract', executor], ['METHOD.md', method]]) {
    assert.doesNotMatch(text, /\*\*Trivial\b/,
      `${name} re-grew the trivial bucket, which sorted departures by shape rather than authorization`);
    assert.doesNotMatch(text, /input validation, error handling/,
      `${name} re-licensed inline security writes - the clause unplanned parsing passes were written under`);
  }
});

test('risk_surface fires on a completed range, and both fire sites carry the transient-file rails', () => {
  // The defect: risk_surface fired per risky COMMIT, mid-plan, against a staged
  // index. Each match halted the executor and cost a fresh-context continuation
  // whose only job was writing code no task authorized - itself new risk
  // surface, and the next halt. One measured phase spent three executor
  // dispatches (198K, 492K, 337K tokens) on one plan that way. The fire moved
  // to plan completion; the executor must no longer own a risk checkpoint, and
  // cad-execute must carry the same rails cad-task already had.
  const executor = doc('skills', 'cad-executor-contract', 'SKILL.md');
  const execute = doc('cadence-core', 'workflows', 'execute.md');

  // The executor stops for structural reasons only - a risky diff is not one.
  assert.doesNotMatch(executor, /CHECKPOINT: \{[^}]*risk_surface/,
    'risk_surface is a checkpoint type again, which puts the halt back mid-plan');
  assert.doesNotMatch(executor, /git diff --cached/,
    'the executor writes a staged risk diff again');

  // It moved rather than vanished: the wiring table still names cad-execute.
  const row = tableRow(doc('cadence-core', 'references', 'review-triggers.md'), 'risk_surface');
  assert.ok(row[1].includes('cad-execute'), 'cad-execute stopped firing risk_surface entirely');
  assert.match(row[2], /never mid-plan/, 'the row no longer states the once-per-plan timing');

  // The same three rails task.md carries, so the range diff cannot be committed
  // or left behind as a stray artifact.
  assert.match(execute, /plan-<k>-risk\.diff/, 'execute.md names no range-diff file');
  assert.match(execute, /never stage it/i, 'execute.md dropped the never-stage rail');
  assert.match(execute, /delete it once the\s+trigger returns/i, 'execute.md dropped the delete rail');
});

// --- the measured byte count, wherever prose copies it -----------------------

const sentencesOf = (text) => text.split(/(?<=[.!?])\s+/);

/**
 * The `skill|reference` keys the COVERAGE arm below does not hold to the
 * inline consult-site rule. `cadence-core/references/seams.md` binds that rule
 * to any deferral made "from this point forward" and releases these three by
 * name in the same sentence: "the deferrals already in `cad-land` predate this
 * sentence and are not held to it".
 *
 * Not a convenience. The triage-gate Read at `skills/cad-land/SKILL.md:52-55`
 * states no bytes and no site count at all, so an unexempted arm is red on an
 * untouched tree; and holding the other two to a rule the reference explicitly
 * exempts them from would make this test contradict the document it enforces.
 * The SCAN arm still checks all three: seams.md releases them from HAVING to
 * state a figure, never from stating a correct one.
 */
const GRANDFATHERED = new Set([
  'cad-land|references/review-triggers.md',
  'cad-land|references/git-publish.md',
  'cad-land|references/triage-gate.md',
]);

test('every deferred-read row states its consult-site count at each anchor', () => {
  // seams.md's deferral mandate: the consult-site count rides inline at the arm
  // that performs the read, rather than anywhere in the file, because that
  // count is what the eligibility rule turns on. Byte figures are deliberately
  // NOT required - a size copied into prose goes stale on the next edit, and
  // weight.mjs reports the live number. Driven off the register
  // so it grows with it, and resolved through the register's own
  // `regionLabels`, so an anchor reads here exactly as `deferredReadIssues`
  // reads it - two different notions of "inside the anchor" would let a row
  // satisfy one check and fail the other.
  const measured = new Map(weighAll(REPO).map((s) => [s.surface, s]));
  let checked = 0;

  for (const row of DEFERRED_READS) {
    if (GRANDFATHERED.has(`${row.skill}|${row.reference}`)) continue;
    const rel = row.file || `skills/${row.skill}/SKILL.md`;
    const text = doc(...rel.split('/'));
    const surface = `cadence-core/${row.reference}`;
    assert.ok(measured.has(surface), `${rel} defers ${surface}, which is not a measured surface`);
    const full = `\${CLAUDE_PLUGIN_ROOT}/${surface}`;

    const labelOf = regionLabels(text);
    /** @type {Map<string, string[]>} */
    const byRegion = new Map();
    text.split('\n').forEach((line, i) => {
      const label = labelOf(i);
      if (label === null) return;
      const acc = byRegion.get(label);
      if (acc) acc.push(line);
      else byRegion.set(label, [line]);
    });

    for (const anchor of row.anchors) {
      const lines = byRegion.get(anchor);
      assert.ok(lines, `${rel} has no region labelled ${anchor} for ${row.reference}`);
      const naming = sentencesOf(lines.join('\n')).filter((s) => s.includes(full));
      assert.ok(naming.length,
        `${rel} region ${anchor} carries no sentence naming ${full}`);
      assert.ok(naming.some((s) => /\bsite\b/.test(s)),
        `${rel} region ${anchor} names ${row.reference} but states no consult-site count `
        + '- seams.md requires it inline at the Read');
      checked += 1;
    }
  }
  assert.ok(checked > 0, 'no register row reached the coverage arm');
});

test('the lockfile lease: both contracts name the same lockfiles and the reason lease-check emits', () => {
  // The planner declares a task's files and the checker blocks on the gap, but
  // the thing that actually halts an executor is planning.mjs's own refusal.
  // Both documents quote that seam by name and by reason code, so this pins
  // the quote to the emitter: rename the reason and the prose goes red rather
  // than telling a planner to avoid a code the seam no longer returns.
  const planner = doc('skills', 'cad-planner-contract', 'SKILL.md');
  const checker = doc('skills', 'cad-plan-checker-contract', 'SKILL.md');
  const seam = doc('cadence-core', 'bin', 'planning.mjs');

  assert.match(seam, /reason: 'undeclared-files'/,
    'lease-check no longer emits undeclared-files - both contracts quote that reason');

  for (const [label, text] of [['planner', planner], ['plan-checker', checker]]) {
    assert.ok(text.includes('lease-check'),
      `cad-${label}-contract states the lockfile rule without naming the seam that enforces it`);
    assert.ok(text.includes('undeclared-files'),
      `cad-${label}-contract names lease-check but not the reason it returns`);
  }

  // The lockfile set is the half a planner acts on, so the two documents must
  // list the SAME one. A rule that names Cargo.lock in one contract and a
  // different set in the other is two rules, and the checker would block work
  // the planner was never told to declare.
  const lockfiles = (text) =>
    [...text.matchAll(/`([A-Za-z.]+\.lock|package-lock\.json|go\.sum)`/g)]
      .map((m) => m[1]).sort();
  const fromPlanner = [...new Set(lockfiles(planner))];
  const fromChecker = [...new Set(lockfiles(checker))];

  assert.ok(fromPlanner.length >= 3,
    `cad-planner-contract names too few lockfiles to be the rule: ${fromPlanner.join(', ')}`);
  assert.deepEqual(fromChecker, fromPlanner,
    'the planner and the plan-checker state different lockfile sets');
});

// --- SIZ-01: the spend gate sits ahead of the resolve it gates ---------------

/** The lines of `text` labelled `label` by the register's own region walker. */
function regionText(text, label, where) {
  const labelOf = regionLabels(text);
  const lines = text.split('\n').filter((_, i) => labelOf(i) === label);
  assert.ok(lines.length, `${where}: no region labelled ${label}`);
  return lines.join('\n');
}

test('the analyzer spend gate precedes the resolve, and four surfaces state two questions', () => {
  // The defect this pins. `analyze` folds its bracket onto a `route.mjs
  // resolve` carrying `--bracket-read`, and that resolve writes the lifecycle
  // DISPATCH half unconditionally - before any Task spawn, before any answer.
  // So "before the spawn" is not far enough: a gate anywhere below that line
  // leaves an unpaired bracket on every phase that skips the analyzer, which
  // renders as a worker that never came back and inverts the record-health
  // signal /cad-report reads. Position is the fact, and it is not visible in
  // any single sentence - only in the order of two.
  const context = doc('cadence-core', 'workflows', 'context.md');
  const skill = doc('skills', 'cad-context', 'SKILL.md');

  // The gate's step NAME is read off the deferred-read register rather than
  // hardcoded: that register anchors `references/recall.md` at the step which
  // performs the read, and the recall substep lives in the gate because BOTH
  // arms consume recalled memory. Rename the step in one place and this goes
  // red, instead of quietly passing against a step that no longer exists.
  const recallRow = DEFERRED_READS.find((r) =>
    r.skill === 'cad-context' && r.reference === 'references/recall.md');
  assert.ok(recallRow, 'no cad-context recall row in the deferred-read register');
  const gateStep = recallRow.anchors[0];
  assert.notEqual(gateStep, 'analyze',
    'the recall anchor is back inside `analyze`, so the skip arm - which never enters that '
    + 'step - reaches its gray areas with no prior-project memory at all');

  const at = (needle) => {
    const i = context.indexOf(needle);
    assert.ok(i >= 0, `context.md carries no ${needle}`);
    return i;
  };
  const gate = at(`<step name="${gateStep}">`);
  assert.ok(gate < at('<step name="analyze">'),
    `context.md opens the ${gateStep} step BELOW <step name="analyze">, so the phase is asked `
    + 'whether to buy a pass it has already entered');
  assert.ok(gate < at('--bracket-read'),
    `context.md opens the ${gateStep} step BELOW the --bracket-read resolve, which writes the `
    + 'lifecycle dispatch half unconditionally - every skipped phase would then report an '
    + 'unpaired bracket, a dispatch event with no worker');

  // The second fact: this workflow asks TWO questions now, and every surface
  // that describes the asking says so. A surface still promising "exactly one"
  // forbids, in its own words, the gate the workflow just ran.
  for (const [where, text, label] of /** @type {const} */ ([
    ['cadence-core/workflows/context.md', context, 'size_check'],
    ['cadence-core/workflows/context.md', context, 'guardrails'],
    ['cadence-core/workflows/context.md', context, 'success_criteria'],
    ['skills/cad-context/SKILL.md', skill, 'objective'],
  ])) {
    const naming = sentencesOf(regionText(text, label, where))
      .filter((s) => /size question/i.test(s));
    assert.ok(naming.length, `${where} region ${label} names no size question at all`);
    for (const sentence of naming) {
      assert.match(sentence, /spend question/i,
        `${where} region ${label} names a size question with no spend question beside it`);
    }
  }
});

// --- RVW-01: one bar, two reviewers -----------------------------------------

/** `text` with every run of whitespace collapsed, so a rewrap is not a defect. */
const flat = (text) => text.replace(/\s+/g, ' ');

/**
 * The severity vocabulary a document states, as a sorted set. Parsed from the
 * one sentence both documents spell it in, so a document that stops stating it
 * at all fails here rather than comparing empty-to-empty.
 */
function severityVocabulary(text, where) {
  const m = flat(text).match(/`severity` is exactly one of `([^`]+)`/);
  assert.ok(m, `${where} states no severity vocabulary`);
  return m[1].split('|').map((s) => s.trim()).sort();
}

test('the reviewer brief carries the same bar the reviewer contract states', () => {
  // The defect: the cross-model arm sent whatever one-line instruction the fire
  // site composed, while the stance, the severity definitions and the two rules
  // that keep findings comparable lived only in skills/cad-reviewer-contract.
  // An adjudicator merges both backends' findings blind - it cannot, if the two
  // reviewers were held to different bars. The brief is the ONE bar, restated as
  // a payload fragment; this test is what keeps the restatement from drifting.
  const brief = doc('cadence-core', 'references', 'reviewer-brief.md');
  const contract = doc('skills', 'cad-reviewer-contract', 'SKILL.md');
  const flatBrief = flat(brief);

  // 1. The stance, including the clause that makes a zero-finding pass earned.
  assert.match(flatBrief, /Assume the artifact is wrong until the evidence clears it/,
    'the brief no longer states the stance');
  assert.match(flatBrief, /only after a genuine attempt to falsify/,
    'the brief no longer conditions a zero-finding pass on a falsification attempt');

  // 2. The severity definitions - the same VOCABULARY as the contract, and the
  //    two anchors of the scale, so `blocker` cannot come to mean something
  //    else on the cross-model side of a panel.
  assert.deepEqual(severityVocabulary(brief, 'reviewer-brief.md'),
    severityVocabulary(contract, 'cad-reviewer-contract'),
    'the brief and the contract state different severity vocabularies');
  assert.match(flatBrief, /`blocker` = the goal fails or a serious defect ships; `low` = minor/,
    'the brief states the severity words without defining either end of the scale');

  // 3. and 4. The two rules an external reviewer has no other way to learn.
  assert.ok(flatBrief.includes('Approach differences are NOT findings'),
    'the brief no longer tells a reviewer that approach differences are not findings');
  assert.match(flatBrief, /Empty `findings: \[\]` when, after a real refutation attempt/,
    'the brief no longer states that an empty findings list is a valid result');
});

test('the reviewer brief costs under 1% of the default review.max_prompt_tokens', () => {
  // It rides in every cross-model payload, so its cost is paid per fire. Read
  // off the same estimator the cap itself uses (chars/4) and against the
  // schema's own default rather than a copied 120000, so a changed default
  // re-prices this check instead of leaving it asserting a stale number.
  const measured = new Map(weighAll(REPO).map((s) => [s.surface, s]));
  const brief = measured.get('cadence-core/references/reviewer-brief.md');
  assert.ok(brief, 'reviewer-brief.md is not a measured surface');

  const schema = JSON.parse(doc('cadence-core', 'config.schema.json'));
  const cap = schema.keys['review.max_prompt_tokens'].default;
  assert.ok(Number.isInteger(cap), 'review.max_prompt_tokens has no integer default');

  assert.ok(brief.estTokens < cap / 100,
    `the brief estimates ${brief.estTokens} tokens, over 1% of the ${cap} default cap`);
});

// --- CST-03: the turn bound the frontmatter sets is the one the seam states --

test('the turn bound: every rung file and the spawn-agent seam name one maxTurns value', () => {
  // The defect this pins. references/seams.md told readers the spawn-agent seam
  // "offers no bound and no cancel" while all 19 agents/*.md carried a
  // maxTurns bound in frontmatter - which is why nobody ever tuned the value.
  // Correcting the sentence puts a NUMBER in prose, and a number copied into
  // prose is exactly what drifts. Both sides are read by their NAMED anchor -
  // the `maxTurns:` key, in the frontmatter and inside the spawn-agent section
  // - never by the shape of the sentence around it, so a rewrap or a reworded
  // bullet that changed no fact stays green.
  const files = readdirSync(join(REPO, 'agents')).filter((f) => f.endsWith('.md')).sort();
  assert.ok(files.length, 'no agent files under agents/');

  /** Each rung file's frontmatter bound, as written. */
  const byFile = new Map(files.map((f) => {
    const front = doc('agents', f).split(/^---$/m)[1];
    assert.ok(front, `agents/${f} has no frontmatter block`);
    const m = front.match(/^maxTurns: (\d+)$/m);
    assert.ok(m, `agents/${f} states no maxTurns bound in its frontmatter`);
    return [f, m[1]];
  }));

  // Direction 1: a rung file whose value differs from its siblings.
  const [firstFile] = byFile.keys();
  const bound = byFile.get(firstFile);
  const drifted = [...byFile].filter(([, v]) => v !== bound).map(([f, v]) => `agents/${f}=${v}`);
  assert.deepEqual(drifted, [],
    `these rung files disagree with agents/${firstFile}=${bound}: ${drifted.join(', ')}`);

  // Direction 2: a sentence naming a value no rung file carries.
  const seam = doc('cadence-core', 'references', 'seams.md')
    .split('## Seam: spawn-agent')[1];
  assert.ok(seam, 'seams.md has no spawn-agent seam section');
  const stated = [...seam.split(/\n## /)[0].matchAll(/maxTurns: (\d+)/g)].map((m) => m[1]);
  assert.ok(stated.length,
    'the spawn-agent seam states no maxTurns value, so it is back to describing a seam with no bound');
  const wrong = [...new Set(stated.filter((v) => v !== bound))];
  assert.deepEqual(wrong, [],
    `references/seams.md's spawn-agent bullet states maxTurns ${wrong.join('/')}, `
    + `which no rung file carries - the 19 rung files carry ${bound}`);
});

// --- WIR-01: the recovery arm's producers, and the default reviewer's bound --
//
// WATCHED FAILING AT cdf8676, the tip of this plan's unpatched tree. Observed
// there, with this file copied into that checkout:
//
//   $ node --test --test-name-pattern='WIR-01' \
//       cadence-core/bin/prose-agreement.test.mjs
//   AssertionError [ERR_ASSERTION]: execute.md labels a recovery arm "timeout
//   or no report" - the seam has no timeout to recover from
//     actual: 'timeout or no report',
//     expected: /timeout/i,
//     operator: 'doesNotMatch',
//   (exit 1)
//
// Which is the defect exactly: the arm was labelled with a control the dispatch
// path does not hold. It stops at the first assertion because on that tree the
// other two facts do not exist to extract either - neither document states a
// producer clause, and neither `references/seams.md`'s exemption sentence nor
// `references/review-triggers.md`'s `claude-subagent` bullet names a bound.
//
// Nothing this plan added is imported, so against the unpatched tree this fails
// on an ASSERTION rather than on a missing export. To re-watch it: `git worktree
// add --detach <tmp> cdf8676`, copy this file into that checkout's
// `cadence-core/bin/`, `node --test` it there, then remove the worktree.

/**
 * The sentence containing `needle`. A sentence ends at `.!?` followed by
 * WHITESPACE, so a dotted identifier (`review.max_prompt_tokens`) is not an
 * end - which matters, because the sentence this reads has one in it.
 */
const sentenceAround = (text, needle, where) => {
  const i = text.indexOf(needle);
  assert.notEqual(i, -1, `${where} no longer contains "${needle}"`);
  const before = [...text.slice(0, i).matchAll(/[.!?]\s/g)];
  const from = before.length ? before[before.length - 1].index + 1 : 0;
  const rest = text.slice(i);
  const end = rest.search(/[.!?]\s/);
  return text.slice(from, i + (end === -1 ? rest.length : end + 1)).replace(/\s+/g, ' ').trim();
};

/**
 * The clause a document introduces with a colon in its sentence about what
 * PRODUCES a state - the copied fact itself, read by its own anchor rather
 * than by the shape of the prose around it, so a rewrap stays green and a
 * reword in one document alone does not.
 */
const producerClause = (text, where) => {
  const m = text.match(/produc\w*[^.:]*:\s*([^.]+)\./);
  assert.ok(m, `${where} states no colon-introduced producer clause`);
  return m[1].replace(/\s+/g, ' ').trim();
};

/** The one `maxTurns` figure every rung file's frontmatter carries. */
const frontmatterBound = () => {
  const files = readdirSync(join(REPO, 'agents')).filter((f) => f.endsWith('.md')).sort();
  assert.ok(files.length, 'no agent files under agents/');
  const values = [...new Set(files.map((f) => {
    const m = (doc('agents', f).split(/^---$/m)[1] || '').match(/^maxTurns: (\d+)$/m);
    assert.ok(m, `agents/${f} states no maxTurns bound in its frontmatter`);
    return m[1];
  }))];
  assert.equal(values.length, 1, `the rung files disagree on maxTurns: ${values.join('/')}`);
  return values[0];
};

test('WIR-01: the recovery arm names its producers in both documents, and the default reviewer names its bound', () => {
  // The defect this pins. execute.md opened a recovery arm labelled "timeout or
  // no report" while seams.md said in as many words that the spawn-agent seam
  // has no timeout at all, and `workflow.subagent_timeout` was deleted in
  // v2.7.0 for naming a control nothing could apply - so the arm named a state
  // nothing in the dispatch path can produce. A prose fix satisfies that on the
  // day it lands and nothing after: the two documents are copies of one fact,
  // and the only failure worth catching is one of them being reworded alone.
  // So both sides are EXTRACTED and compared to each other. Asserting that some
  // expected phrase appears in each file is the weaker shape this very file has
  // shipped once before (the coverage arm that required the word `site` and
  // never parsed the count), and it passes exactly the tree this exists to
  // catch.
  const execute = doc('cadence-core', 'workflows', 'execute.md');
  const seams = doc('cadence-core', 'references', 'seams.md');
  const triggers = doc('cadence-core', 'references', 'review-triggers.md');

  // The arms of the return-handling list, read positionally: the recovery arm
  // is the last of them, whatever it now calls itself.
  const list = execute.split("Handle the executor's return:")[1];
  assert.ok(list, 'execute.md has no "Handle the executor\'s return" list');
  const arms = list.split(/\n\r?\n/)[0].split(/\n- \*\*/).slice(1);
  assert.equal(arms.length, 4, `that list has ${arms.length} arms, not the four this check reads`);
  const recovery = arms[arms.length - 1];

  // 1. No arm is labelled with a control this dispatch path does not hold.
  for (const arm of arms) {
    const label = arm.split('**')[0];
    assert.doesNotMatch(label, /timeout/i,
      `execute.md labels a recovery arm "${label}" - the seam has no timeout to recover from`);
  }

  // 2. The producer wording is one fact copied into two documents. Compare the
  //    two EXTRACTIONS, so rewording either one alone reddens this.
  const fromExecute = producerClause(recovery, 'execute.md\'s recovery arm');
  const spawnSeam = seams.split('## Seam: spawn-agent')[1];
  assert.ok(spawnSeam, 'seams.md has no spawn-agent seam section');
  const fromSeams = producerClause(spawnSeam.split(/\n## /)[0], 'seams.md\'s spawn-agent seam');
  assert.equal(fromExecute, fromSeams,
    'execute.md and references/seams.md state different producers for the state that arm recovers from:\n'
    + `  execute.md: ${fromExecute}\n`
    + `  seams.md:   ${fromSeams}`);

  // 3. The recovery itself survived the relabel: the report file on disk is
  //    still what the arm reads.
  assert.match(recovery, /reports\/plan-<k>\.md/,
    'the recovery arm no longer reads the report file the executor left on disk');

  // 4. The default reviewer states its own bound where it claims exemption,
  //    and where the trigger reference introduces it. Both against the rung
  //    files' own figure - a literal typed here goes stale the day they move.
  const bound = frontmatterBound();
  const exempt = sentenceAround(seams, 'is exempt', 'references/seams.md');
  assert.match(exempt, new RegExp(`maxTurns: ${bound}\\b`),
    `seams.md's exemption sentence names no maxTurns ${bound} bound, so \`claude-subagent\` `
    + `still reads as the unbounded path beside over-cap: ${exempt}`);
  const bullet = triggers.split(/\n- /).find((b) => b.startsWith('`claude-subagent`'));
  assert.ok(bullet, 'review-triggers.md has no `claude-subagent` backend bullet');
  assert.match(bullet, new RegExp(`maxTurns: ${bound}\\b`),
    `review-triggers.md's \`claude-subagent\` bullet names no maxTurns ${bound} bound`);
});

// --- #195: the locate step's re-run refusal, and its unconditional status call

/** The body of a named `<step>` in a workflow, read by its own anchor. */
const stepBody = (text, name, where) => {
  const m = text.match(new RegExp(`<step name="${name}">([\\s\\S]*?)</step>`));
  assert.ok(m, `${where} has no <step name="${name}">`);
  return m[1];
};

test('#195: execute.md locates unconditionally and refuses an already-executed phase', () => {
  // The defect. `/cad-execute <N>` re-dispatched a phase whose plans were
  // already committed, and the second run's first task write landed on top of
  // the first run's `reports/plan-<k>.md` - destroying the only per-task record
  // of the run being re-run. Two halves fix it (CONTEXT D-04), and each has its
  // own way of silently coming back:
  //   - the refusal itself, which a later edit can narrow to `executed` alone,
  //     leaving `complete` re-running identically one status later; and
  //   - the `status` call, which was under an `else` that `$ARGUMENTS`
  //     short-circuited, so `/cad-execute 3` reached this step with no derived
  //     status to refuse ON. Restoring that `else` turns the refusal into dead
  //     prose while every word of it is still on the page.
  // So both are read out of the step by its own anchor rather than grepped for
  // across the file, and no report-path literal is asserted anywhere here: the
  // current run's path is still `plan-<k>.md`, so a literal would be a string
  // this same commit writes and could never fail.
  const locate = stepBody(doc('cadence-core', 'workflows', 'execute.md'), 'locate', 'execute.md');

  // 1. The status call is not conditioned on the phase argument. Extracted, not
  //    grepped: the sentence that CARRIES the invocation is the one that would
  //    have to say "else" for the call to be skippable.
  const call = sentenceAround(locate, 'planning.mjs" status', "execute.md's locate step");
  assert.doesNotMatch(call, /\belse\b|\botherwise\b|\bonly (?:if|when)\b/i,
    'execute.md runs `planning.mjs status` conditionally, so a phase number on the command '
    + `line skips the derivation the refusal below reads: ${call}`);
  assert.doesNotMatch(call, /\$ARGUMENTS/,
    'execute.md\'s `planning.mjs status` call is back inside the `$ARGUMENTS` bullet, which '
    + `is the branch that short-circuited it: ${call}`);

  // 2. The refusal arm, found by the recovery path it names - a refusal that
  //    named no way forward would fail this at the anchor itself.
  const arms = locate.split(/\n- /).slice(1);
  const refusal = arms.find((a) => a.includes('/cad-undo'));
  assert.ok(refusal,
    "execute.md's locate step names no /cad-undo route, so it either refuses nothing or "
    + 'refuses without naming the supported path');
  // The TRIGGER clause only - the arm text before `-> stop:`. Asserting against
  // the whole arm passes on a trigger narrowed to `executed` alone, because the
  // rationale sentence after the stop names `complete` on its own.
  const trigger = refusal.split(/->\s*stop:/)[0];
  assert.ok(trigger && trigger !== refusal,
    "execute.md's refusal arm has no `-> stop:`, so its trigger clause cannot be "
    + `read apart from its rationale: ${refusal}`);
  for (const derived of ['executed', 'complete']) {
    assert.match(trigger, new RegExp(`\`${derived}\``),
      `that refusal does not TRIGGER on derived status \`${derived}\`, which re-runs and `
      + 'overwrites the executor reports of the run that committed the phase');
  }
  assert.match(refusal, /\/cad-undo <N>/, 'the refusal does not name `/cad-undo <N>`');
  assert.match(refusal, /\/cad-execute <N>/, 'the refusal does not name `/cad-execute <N>`');
  assert.match(refusal, /--rerun/,
    'the refusal names no deliberate way through, so an intentional re-run has no route but '
    + 'editing the workflow');

  // 3. It stops BEFORE the guard and the trace anchor, which is what makes it a
  //    refusal rather than a late apology: `locate` is the first step, and the
  //    arm is inside it.
  assert.ok(locate.indexOf('/cad-undo') > locate.indexOf('planning.mjs" status'),
    'the refusal is read before the derivation it refuses on');
});

// --- DOC-02: README counts its own skills, roles and rung files --------------

test('README\'s "Today it is N skills and M agent roles across K rung files" matches the tree', () => {
  // The defect this pins. That sentence is the only place the plugin states its
  // own size, and nothing read it against the tree: the v3.1.0 correction to the
  // skill number (README-44 in .planning/DOCS-CLAIMS.md) was found by a human
  // doc sweep, a year of cycles apart from the commit that changed the count.
  // Both sides are measured HERE, in the same run - a number typed into this
  // test would pin today's tree and report a correct future count as a defect.
  //
  // README.md ONLY (D-06). LINEAGE.md duplicates the same two counts and still
  // publishes a stale agents row, but it is a historical doc self-verify
  // already excludes and it stays a queue item. And not in self-verify.mjs
  // either: that runs against every --root fixture and any user tree it is
  // pointed at, where a `skills/` count means nothing.
  const stated = doc('README.md')
    .match(/Today it is (\d+) skills and (\d+) agent roles across (\d+) rung files/);
  assert.ok(stated, 'README.md states no "Today it is N skills and M agent roles '
    + 'across K rung files" sentence - the counts this test compares are gone');

  // Skills: the ones a USER can invoke. `user-invocable: false` marks the
  // contract skills, which are preloaded into an agent and never appear in
  // anyone's slash-command list, so counting them would overstate the surface.
  // Read from the frontmatter block rather than from anywhere in the file, so
  // prose quoting the key cannot silently drop a skill from the count.
  const skills = readdirSync(join(REPO, 'skills'), { withFileTypes: true })
    .filter((e) => e.isDirectory()).map((e) => e.name).sort()
    .filter((name) => {
      const front = doc('skills', name, 'SKILL.md').split(/^---$/m)[1];
      assert.ok(front, `skills/${name}/SKILL.md has no frontmatter block`);
      return !/^user-invocable:\s*false\s*$/m.test(front);
    });

  // Rung files: every `.md` directly under agents/. Roles: those filenames with
  // the rung suffix stripped. The suffix VOCABULARY is read off
  // route-table.json's `rung_order` rather than typed, so a new rung renames
  // agent files and this keeps deriving the same six roles instead of counting
  // the new spelling as a seventh.
  const rungs = readdirSync(join(REPO, 'agents')).filter((f) => f.endsWith('.md'));
  assert.ok(rungs.length, 'no agent files under agents/');
  const order = JSON.parse(doc('cadence-core', 'route-table.json')).rung_order;
  assert.ok(Array.isArray(order) && order.length, 'route-table.json states no rung_order');
  const suffix = new RegExp(`-(?:${order.join('|')})$`);
  // The analyzer's UNSUFFIXED file is its xhigh rung (route-table.json:4), so a
  // name carrying no suffix is already the role.
  const roles = new Set(rungs.map((f) => f.replace(/\.md$/, '').replace(suffix, '')));

  const wrong = /** @type {[string, number, number][]} */ ([
    ['skills', Number(stated[1]), skills.length],
    ['agent roles', Number(stated[2]), roles.size],
    ['rung files', Number(stated[3]), rungs.length],
  ]).filter(([, said, is]) => said !== is)
    .map(([what, said, is]) => `${what}: README says ${said}, the tree has ${is}`);

  assert.deepEqual(wrong, [],
    `README's count sentence disagrees with the tree - ${wrong.join('; ')}`);
});

// --- DOC-02: PROJECT.md declares its milestone before it mentions another ----

test('PROJECT.md\'s `### Active` declares its milestone as the section\'s first version token', () => {
  // The defect this pins, measured at 81bdb5d: the section's first version
  // token was `v3.2.0` on its opening line - correct - and activeVersion()
  // returned `v3.0.0`, a token forty lines below it that landed at the start of
  // a line only because markdown wrapped a sentence there. Nothing compares
  // those two readings, so the docs were right and every consumer of
  // activeVersion() was wrong: version_drift compares its answer against the
  // tag list, and the branch-naming seam refuses an integration branch on it.
  //
  // The property is that the two scans AGREE, not that either equals a value:
  // an assertion phrased as "the first version token" would have PASSED on the
  // broken file, and one naming a version would need re-baselining every cycle
  // open.
  //
  // THE READER NOW CARRIES THAT PROPERTY (phase 2 D-03, reversing this pin's
  // own D-07 policy). DRF-01 moved it into activeVersion(): the two scans both
  // run over the whole `### Active` body, and a line-anchored token is admitted
  // as the declaration only when it AGREES with the body's first token or its
  // line OPENS a sentence rather than continuing a wrapped one - a rejected
  // anchor contributing nothing, so the earlier correct mention answers. The
  // 81bdb5d file above now reads `v3.2.0` unchanged, which is why the sentence
  // this comment used to end on - the file is what moves when this goes red -
  // no longer describes the code and was deleted rather than left standing.
  //
  // So a red run here means something NARROWER than it did, and it is the only
  // shape left: activeVersion() admitted an anchored token through the
  // sentence-opening arm while this repository's own `### Active` names a
  // different version earlier in its prose. The wrapped-continuation defect
  // cannot reach this assertion any more - the reader ignores it and answers
  // the first token, which is agreement. What that leaves is a question about
  // the READER's admission rule (`lib/branch-decision.mjs`, with the four
  // fixtures at branch-decision.test.mjs:237-266 pinning what it may not cost),
  // not a hand-edit of the section: read which of the two versions is the
  // milestone, and if it is the one activeVersion() returned, this pin is the
  // stale reading and is re-derived from the reader's rule.
  const text = doc('.planning', 'PROJECT.md');
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /^###\s+Active\b/.test(l));
  assert.ok(start >= 0, '.planning/PROJECT.md has no `### Active` section');

  // The body exactly as activeVersion's own doc comment bounds it: the heading
  // to the next level-1..3 heading.
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{1,3}\s/.test(lines[i])) { end = i; break; }
  }

  // The loose scan. This token shape is spelled here rather than imported
  // because branch-decision.mjs exports neither regex and this task does not
  // modify it; it is a GRAMMAR and not a version, so it never re-baselines.
  const token = /v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/;
  let first = null;
  for (let i = start + 1; i < end; i++) {
    const m = lines[i].match(token);
    if (m) { first = { version: m[0], line: i + 1 }; break; }
  }
  assert.ok(first, '.planning/PROJECT.md\'s `### Active` body names no version at all');

  const declared = activeVersion(text);
  assert.ok(declared, 'activeVersion() reads no version from a body that names one');
  // The line it was read on: the first body line naming that token, which is
  // its anchored line whenever the section names it once.
  const at = lines.findIndex((l, i) => i > start && i < end && l.includes(declared)) + 1;

  assert.equal(declared, first.version,
    `activeVersion() reads ${declared} (line ${at}) as the milestone while the \`### Active\` `
    + `body's FIRST version token is ${first.version} (line ${first.line}). Since phase 2 `
    + 'D-03 the agreement property lives in activeVersion() itself, which admits a '
    + 'line-anchored token only on agreement or on a line that opens a sentence - so the one '
    + 'reading that still reaches here is the sentence-opening admission, and version_drift '
    + `is comparing ${declared} against the tag list. Settle which version is the milestone: `
    + 'the remedy is the READER\'s admission rule in lib/branch-decision.mjs and this pin '
    + 'derived from it, not a hand-edit of the section, which no longer has to route around '
    + 'where markdown wrapped a line.');
});

// --- AC6: the executor is told the surfaces it will be judged on -------------

test('the executor dispatch hands over the resolve\'s answered surfaces, and the contract says what to do with them', () => {
  // `route.mjs resolve` has always returned `surfaces` and `surfaces_answered`
  // on every dispatch - a `--role cad-executor` resolve on this repo returns
  // six answered surfaces - and the executor was never handed them. The worker
  // therefore met its own risk bar for the first time when the `risk_surface`
  // review fired against its committed range, which is the most expensive
  // moment to learn it.
  const execute = doc('cadence-core', 'workflows', 'execute.md');
  const start = execute.indexOf('<step name="execute_sequential">');
  const end = execute.indexOf('Do NOT restate the executor\'s standing rules', start);
  assert.ok(start >= 0 && end > start, 'execute.md has no execute_sequential dispatch prompt');
  const prompt = execute.slice(start, end);
  assert.match(prompt, /`surfaces`/,
    'the executor dispatch prompt does not hand over the resolve\'s `surfaces`');
  assert.match(prompt, /surfaces_answered/,
    'the dispatch prompt names `surfaces` but never says what an UNANSWERED resolve means - '
    + '`surfaces_answered: false` means all of the table\'s categories stand, not none');

  // The other half: the contract states what the executor DOES with them, and
  // it may not invent a category. The vocabulary is machine-readable, so this
  // is the same subject as every other check in this file.
  const values = JSON.parse(doc('cadence-core', 'config.schema.json'))
    .keys['review.triggers.risk_surface.surfaces'].values;
  const contract = doc('skills', 'cad-executor-contract', 'SKILL.md');
  const para = contract.split(/\n\s*\n/).find((p) => p.includes('surfaces'));
  assert.ok(para, 'skills/cad-executor-contract/SKILL.md never mentions the risk surfaces');
  const named = [...para.matchAll(/`([a-z][a-z_]+)`/g)].map((m) => m[1])
    .filter((t) => t !== 'surfaces' && t !== 'risk_surface');
  assert.ok(named.length > 0, 'the contract\'s surfaces paragraph names no category at all');
  for (const t of named) {
    assert.ok(values.includes(t),
      `the executor contract names surface \`${t}\`, which config.schema.json's `
      + `review.triggers.risk_surface.surfaces does not carry (${values.join(', ')})`);
  }
});

// --- RSK-01/RSK-02: detection is the seam's answer, and completion needs it ---

test('both fire sites invoke the risk-check seam rather than reading a prose list', () => {
  // The defect: detection was execute.md and task.md telling a model to check a
  // diff against the eight categories in references/review-triggers.md. A fire
  // wrote a lifecycle event and a NON-match wrote nothing, so the run record
  // could not tell "the detection step was skipped" from "it ran and matched
  // nothing". The heuristics stay heuristics; what moved is that the answer is
  // computed by something that always returns one and always records it.
  const execute = doc('cadence-core', 'workflows', 'execute.md');
  const task = doc('cadence-core', 'workflows', 'task.md');
  assert.match(execute, /risk-check run/,
    "execute.md's post-plan step no longer calls the risk-check seam");
  assert.match(task, /risk-check run/,
    "task.md's risk_check step no longer calls the risk-check seam");
  // An unjudged range is not a cleared one, and widening is the only safe
  // direction on the one gate that is `blocking` at every stakes level.
  assert.match(execute, /inconclusive/,
    'execute.md dropped the rule that an inconclusive range fires the trigger');
});

test('cad-land step 3: the auto_close branch takes its value from `config.mjs get`', () => {
  // AC2's other half, at the CALL SITE. The seam-level arms in
  // config-seams.test.mjs prove the two resolutions differ and that the gate
  // reads the merged one - but they all still pass on a tree where THIS skill
  // was repointed at the raw repo value, which would leave the ask and the gate
  // reading different sources with every arm green. The pairing is: the arm
  // that switched off the human is the arm the gate covers.
  const skill = doc('skills', 'cad-land', 'SKILL.md');
  const labelOf = regionLabels(skill);

  // The ONE up-front read the whole run reuses, and the branch statement itself.
  const upfront = /Read every config key this run needs in ONE `config\.mjs get` up front[\s\S]*?\n\n/
    .exec(skill);
  assert.ok(upfront, 'cad-land no longer states its ONE up-front config.mjs get');
  assert.match(upfront[0], /git\.auto_close/,
    'git.auto_close left the up-front `config.mjs get` list, so the branch value comes from elsewhere');
  const branch = skill.split('\n').filter((l, i) => labelOf(i) === '3').join('\n');
  assert.match(branch, /branch on `git\.auto_close`/,
    'step 3 no longer states what it branches on');

  // And from NO other source. A raw repo-layer read or the `authorized` seam
  // appearing as the thing step 3 branches on is exactly the collapse 0b1c322
  // made and had reverted: the ask would skip on one value while
  // land-cleanup.mjs gate halts on another. `authorized` belongs INSIDE 3(b),
  // gating the GitLab mutation - never above the branch.
  const decides = upfront[0] + '\n' + branch;
  assert.doesNotMatch(decides, /\.planning\/config\.json/,
    'step 3 branches on a raw repo-layer read instead of the merged `config.mjs get`');
  assert.doesNotMatch(decides, /git-publish\.mjs" authorized/,
    'step 3 branches on the AUTHORIZED value; the ask and the gate must read one merged value');
});

test('cad-land 3(b): the GitLab arm consults the authorization seam BEFORE it creates', () => {
  // On GitHub and Forgejo the unattended chain has to come through
  // `git-publish.mjs publish` to get the branch onto the remote, so the
  // repo-layer refusal stops it. On GitLab `glab mr create` publishes the source
  // branch itself: no seam call happened, and an unattended merge proceeded on a
  // `git.auto_close` the repository never set. The enforcement on that host IS
  // this prose, so a seam test alone proves nothing.
  const skill = doc('skills', 'cad-land', 'SKILL.md');
  const rails = doc('cadence-core', 'references', 'git-publish.md');
  const labelOf = regionLabels(skill);
  // The 3(b) region alone, blanked elsewhere so line ORDER is preserved: the
  // same notion of "inside the anchor" the deferred-read check uses.
  const region = skill.split('\n').map((l, i) => (labelOf(i) === '3(b)' ? l : '')).join('\n');

  for (const [name, text] of [['skills/cad-land/SKILL.md', skill],
    ['cadence-core/references/git-publish.md', rails]]) {
    assert.doesNotMatch(text, /no seam call is needed/,
      `${name} states the GitLab non-gating as correct again`);
  }

  const seamAt = region.indexOf('git-publish.mjs" authorized');
  const createAt = region.indexOf('glab mr create --source-branch');
  assert.ok(createAt > -1, 'step 3(b) no longer spells the glab mr create invocation');
  assert.ok(seamAt > -1, 'step 3(b) does not call git-publish.mjs authorized on the GitLab arm');
  // ORDER, not presence. A tree that keeps the seam call but moves it after the
  // create has already published the branch by the time it asks - which is the
  // whole failure this closes.
  assert.ok(seamAt < createAt,
    'the authorization consult comes AFTER glab mr create, which publishes the branch itself');
  // The reuse arm, not the create, is the one this ordering exists for: an MR
  // already open for the branch skips the create entirely, so a consult placed
  // beside `glab mr create` never runs and `glab mr merge` lands unauthorized.
  const viewAt = region.indexOf('glab mr view <branch>');
  assert.ok(viewAt > -1, 'step 3(b) no longer spells the glab mr view reuse probe');
  assert.ok(seamAt < viewAt,
    'the authorization consult comes AFTER the glab mr view reuse probe, so an '
    + 'already-open MR reaches glab mr merge with no seam call behind it');
  assert.match(region, /ok:false/,
    'step 3(b) never says what the GitLab arm does when the seam refuses');
});

test('ENFORCEMENT, execute.md: the plan is not reported done while risk-check status refuses', () => {
  // Detection without enforcement is precisely the outcome RSK-02 exists to
  // prevent, and it passes every other check in this phase. A tree carrying
  // `risk-check run` at both fire sites and NEITHER this sentence nor task.md's
  // `written: false` sentence must go RED here.
  const execute = doc('cadence-core', 'workflows', 'execute.md');
  assert.match(execute, /risk-check status/,
    'execute.md detects a risk surface but never re-reads the record before reporting done');
  assert.match(execute, /not reported done while that call refuses/i,
    'execute.md calls risk-check status without withholding done on its refusal - '
    + 'detection without enforcement is the outcome RSK-02 exists to prevent');
});

test('ENFORCEMENT, task.md: done is withheld on `written: false`', () => {
  // `ok:true, written:false` - a symlinked trace, a failed stat, a full disk,
  // the size-cap bound - is NOT a completed check. The execute path is covered
  // by its own `risk-check status` call, which re-reads the trace and finds
  // nothing; the task path has no status call, so this flag is its whole guard.
  const task = doc('cadence-core', 'workflows', 'task.md');
  assert.match(task, /`written: false`/,
    'task.md never states the written flag, so a record that never landed reports done');
  assert.match(task, /`written: false`[^.]*(do not|does not|never)\s+report\s+done/i,
    "task.md's risk_check step states the written flag but not that done is withheld on it - "
    + 'detection without enforcement is the outcome RSK-02 exists to prevent');
});

// --- PAR-01: the parallel branch reaches the SAME risk sequence, by pointer ---
//
// Watched FAILING at e4f95a3, this plan's unpatched baseline: `grep -c
// risk-check cadence-core/references/execute-parallel.md` returned 0 there,
// against 2 for `cadence-core/workflows/execute.md`. The one gate that is
// `blocking` at every stakes level fired on the sequential path and nowhere
// else, so all three checks below go red against that SHA - the first two on
// the two absent command names, the third on the invocation it cannot find.
//
// Three checks and not one, because they fail apart: a tree can call both
// commands while copying the sequence (1), while never withholding done on the
// refusal (2), or while naming a range that is not this plan's own (3).

test('PAR-01: the parallel path REACHES execute.md\'s risk sequence instead of copying it', () => {
  const execute = doc('cadence-core', 'workflows', 'execute.md');
  const parallel = doc('cadence-core', 'references', 'execute-parallel.md');

  assert.match(parallel, /risk-check run/,
    'the parallel path never asks the seam whether a plan\'s range touched a risk surface');
  assert.match(parallel, /risk-check status/,
    'the parallel path detects a risk surface but never re-reads the record before reporting done');

  // The POINTER, both ends. A named step that no longer exists is a pointer
  // into nothing, which is the state a copy gets pasted back in to fix.
  assert.match(parallel, /execute_sequential/,
    'the parallel path names no step of workflows/execute.md as the sequence it defers to');
  assert.match(execute, /<step name="execute_sequential">/,
    'workflows/execute.md no longer carries the step references/execute-parallel.md points at');

  // Two markers workflows/execute.md demonstrably owns today - its fire rule
  // (`inconclusive`) and its transient-file rail (`never stage it`). Markers
  // rather than whole paragraphs: this must redden on a PASTE-BACK in either
  // direction, not on a reformat that changed no fact. A second copy of one
  // rule is two statements that disagree at the next edit.
  for (const marker of [/inconclusive/, /never stage it/]) {
    assert.match(execute, marker,
      `workflows/execute.md lost ${marker}, the sequence references/execute-parallel.md defers to`);
    assert.doesNotMatch(parallel, marker,
      `references/execute-parallel.md restates ${marker}, which workflows/execute.md states - `
      + 'the parallel path points at that sequence and carries no copy of it');
  }
});

test('ENFORCEMENT, execute-parallel.md: a plan is not reported done while risk-check status refuses', () => {
  // The sibling of `ENFORCEMENT, execute.md` above, for the other branch:
  // detection without enforcement passes every other check here and is exactly
  // the outcome RSK-02 exists to prevent.
  const parallel = doc('cadence-core', 'references', 'execute-parallel.md');
  assert.match(parallel, /risk-check status/,
    'the parallel path never calls risk-check status before reporting a plan done');
  assert.match(parallel, /not reported done while that call refuses/i,
    'the parallel path calls risk-check status without withholding done on its refusal - '
    + 'detection without enforcement is the outcome RSK-02 exists to prevent');
});

test('PAR-01: both parallel risk-check calls name that plan\'s OWN merge range', () => {
  // The two checks above assert only that the command NAMES are there, and a
  // range identity is what the fire is actually about: a plan fired on
  // `{PHASE_START, HEAD}` or on the pre-plan HEAD hands its blocking gate every
  // other plan's work, and a `status` call missing the triple falls through to
  // the phase-wide arm, which compares no range and clears this plan on the
  // record an earlier, narrower one left.
  const parallel = doc('cadence-core', 'references', 'execute-parallel.md');
  /** @type {string[]} */
  const pairs = [];
  for (const sub of ['run', 'status']) {
    // The invocation is one inline code span, so the span's own backtick bounds
    // the flags read here - prose after it is never scanned as an argument.
    const m = new RegExp('risk-check ' + sub + '([^`\\n]*)').exec(parallel);
    assert.ok(m, `references/execute-parallel.md carries no \`risk-check ${sub}\` invocation`);
    for (const flag of ['--phase', '--plan', '--base', '--head']) {
      assert.ok(m[1].includes(flag),
        `the parallel \`risk-check ${sub}\` call drops ${flag}: the triple is all three or `
        + 'none, and none is the phase-wide arm that compares no range');
    }
    const range = /--base\s+(.*?)\s+--head\s+(\S.*)$/.exec(m[1]);
    assert.ok(range, `the parallel \`risk-check ${sub}\` call names no --base/--head pair`);
    const pair = `${range[1]} .. ${range[2]}`;
    assert.doesNotMatch(pair, /PHASE_START|pre-plan/i,
      `the parallel \`risk-check ${sub}\` range is ${pair}, which contains other plans' work`);
    assert.match(pair, /pre-merge[\s\S]+post-merge/,
      `the parallel \`risk-check ${sub}\` range is ${pair}, not the pre-merge/post-merge HEAD pair`);
    assert.match(pair, /step 3/,
      `the parallel \`risk-check ${sub}\` range does not say where both its ends were recorded`);
    pairs.push(pair);
  }
  assert.equal(pairs[0], pairs[1],
    'the fire and the completion gate name DIFFERENT ranges, so the gate can clear on a '
    + 'record for a range nobody fired on');
});

// --- GAT-04: the receipt a coordinator COPIES joins on the key status uses ---
//
// Watched FAILING at dd3920e, where three of the four fenced `trace append`
// blocks - `gate_pass`, `override` and `rearm` in
// cadence-core/references/triage-gate.md - carried no `--plan <k>`, against
// cadence-core/references/review-triggers.md's `adjudication`, which did.
// `risk-check status` joins a receipt to a record on `rowKey(corr, plan)`, so
// a receipt appended exactly as those blocks read keys to no plan and settles
// nothing: the range stays `unfired` and the blocking gate cannot be cleared
// by following its own instructions.
//
// The rule was already stated in prose at triage-gate.md's receipt paragraph.
// This file's whole premise is that prose copying a machine-readable fact must
// still match it, and a prose RULE beside a command that disobeys it is that
// drift in its purest form - the copied line is what a coordinator runs.
//
// Nothing else pinned it: risk-diff.test.mjs's `receiptLine` helper builds its
// fixtures with a plan every time, so the seam's own tests are handed what
// these documents omit.

test('GAT-04: every fenced outcome receipt names its trigger, plan and both range ends', () => {
  const files = [
    ['cadence-core', 'references', 'triage-gate.md'],
    ['cadence-core', 'references', 'review-triggers.md'],
  ];
  /** @type {string[]} */
  const seen = [];
  for (const parts of files) {
    const text = doc(...parts);
    const where = parts.slice(1).join('/');
    for (const line of text.split('\n')) {
      // The command LINE, not the prose: only a fenced invocation is a thing a
      // coordinator copies and runs. Prose that names one of these flags while
      // discussing it is never scanned as an argument list.
      if (!line.includes('trace append') || !line.includes('--family outcome')) continue;
      const event = /--event\s+(\S+)/.exec(line);
      assert.ok(event, `${where}: an outcome receipt command names no --event`);
      seen.push(event[1]);
      for (const flag of ['--trigger', '--plan', '--base', '--sha']) {
        assert.ok(line.includes(flag),
          `${where}: the \`${event[1]}\` receipt drops ${flag} - risk-check status joins a `
          + 'receipt on the run, the plan and BOTH ends of the range, so a receipt written as '
          + 'this line reads settles nothing and leaves a fired range reading as unfired');
      }
    }
  }
  // All four settle points, so a receipt block DELETED fails here too rather
  // than passing vacuously: adjudication (review-triggers.md) plus the three
  // in triage-gate.md.
  assert.deepEqual(seen.sort(), ['adjudication', 'gate_pass', 'override', 'rearm'],
    'the four blocking settle points no longer print one fenced receipt command each');
});

// --- MSR-01: the close-half turn rule is stated ONCE, in seams.md ------------
//
// `--turns` is dead the moment its ONE statement stops naming it: nothing in
// the tree can make a coordinator read a tool-call count off a subagent return
// except this paragraph, and the checks that exist around it are all blind to
// its content. self-verify's flag lint only refuses a flag the CONTRACTS row
// does not list, the weight budget only counts bytes, and the producer census
// in trace.test.mjs reads the ten CLOSE COMMAND lines rather than the rule they
// point at - so deleting the rule while leaving the flags in place is green
// everywhere else. Read by its NAMED anchor (the paragraph's bolded opening),
// never by the shape of the sentences around it, so a rewrap that changed no
// fact stays green.

test('MSR-01: seams.md\'s close-half rule states the turn count, its omission and its own counter', () => {
  const text = doc('cadence-core', 'references', 'seams.md');
  const start = text.indexOf('**The bracket rides the resolve.**');
  assert.ok(start >= 0, 'seams.md has no `The bracket rides the resolve.` paragraph');
  // To the end of the paragraph: the ONE statement is a single block, and a
  // rule that drifted into a paragraph of its own is exactly what this refuses.
  const end = text.indexOf('\n\n', start);
  assert.ok(end > start, 'the bracket paragraph never ends');
  const para = text.slice(start, end).replace(/\s+/g, ' ');

  // 1. The count is CARRIED, with the same provenance `--tokens` has.
  assert.match(para, /`--turns <the tool-call count on that same return>`/,
    'the close-half rule no longer tells a caller to carry the tool-call count');
  // 2. ...and OMITTED when the return carries none, never sent as zero.
  assert.match(para, /OMIT `--turns`[\s\S]*?never `--turns 0`/,
    'the close-half rule no longer states that an absent turn count is omitted rather than 0');
  // 3. ...and a turn-figureless return renders under a counter of its OWN.
  assert.match(para, /`turns_unrecorded`, distinct from the token `unrecorded`/,
    'the close-half rule no longer states that turns have an unrecorded counter of their own');

  // ...and it is still ONE statement. A second paragraph restating any of the
  // three is how a rule starts disagreeing with itself across two sites.
  assert.equal((text.match(/ONE statement/g) || []).length, 1,
    'seams.md now holds more than one `ONE statement` marker - the rule was copied, not extended');
});

// --- MSR-02: the report's spend line and the seam make ONE claim ------------
//
// WATCHED FAILING AT 4b1d659, the tip of this plan's unpatched tree. Observed
// there, with this file copied into that checkout's `cadence-core/bin/`:
//
//   $ node --test cadence-core/bin/prose-agreement.test.mjs
//   x MSR-02: report.md names the seam's three excluded sources where it prints the spend figure
//     AssertionError [ERR_ASSERTION]: report.md's spend line does not name `the
//     orchestrator's own turns`, so it presents a worker-return token sum as the
//     run's cost. Got: Tokens on subagent returns (the host's own per-dispatch
//     figure, not a measured cost): <total recorded; top role and its share;
//     unrecorded dispatch count>
//   i pass 25
//   i fail 1
//
// The recipe uses the GUARDED-READ arm below rather than copying this phase's
// `lib/trace-suggest.mjs` into the old checkout, and it has to: the export is
// absent there, a named import would die at module link, and the recorded FAIL
// would then prove only that a new helper does not exist yet. With the guard,
// the old tree reaches the assertion and fails on the CLAIM - the exact
// sentence unpatched `/cad-report` composes.
//
// To re-watch: `git worktree add --detach <tmp> 4b1d659`, copy this file into
// `<tmp>/cadence-core/bin/`, run `node --test cadence-core/bin/prose-agreement.test.mjs`
// from `<tmp>`, then `git worktree remove <tmp>`.
//
// This is the half of MSR-02 that lives in prose nothing executes.
// `workflows/report.md` has no executor at all - moving the caveat into the
// seam envelope was rejected for exactly that reason, because the file would
// still be relaying a sentence no check reads. So the sentence is read here,
// and the three names are IMPORTED from `lib/trace-suggest.mjs` rather than
// restated: the subject of this check is that the seam and the prose claim the
// same thing, and a literal copy in this file would assert nothing about
// agreement - it would go green on the day the two lists diverged.
//
// The import is a NAMESPACE import for the same reason the seam-half check
// uses one: a named import would die at module link against an unpatched
// checkout, and a FAIL that only proves a new export does not exist yet says
// nothing about whether unpatched `/cad-report` makes the wrong cost claim.
//
// Both sites are asserted by their NAMED anchors - the shape block's spend line
// and the `What that token line EXCLUDES` rule - never by the shape of the
// sentences around them, so a rewrap that changed no fact stays green.
import * as traceSuggestModule from './lib/trace-suggest.mjs';

const REPORT_EXCLUDES = Array.isArray(traceSuggestModule.SPEND_EXCLUDES)
  ? traceSuggestModule.SPEND_EXCLUDES
  : ["the orchestrator's own turns", 'cross-model provider calls', 'figureless returns'];

test('MSR-02: report.md names the seam\'s three excluded sources where it prints the spend figure', () => {
  const text = doc('cadence-core', 'workflows', 'report.md');
  assert.equal(REPORT_EXCLUDES.length, 3,
    'the exported exclusion list is no longer the three sources the caveat is written about');

  // 1. The shape block's own spend line - the point at which the figure is
  //    PRINTED. A caveat further down the file is a caveat a reader can compose
  //    the line without.
  const lineStart = text.indexOf('Tokens on subagent returns (');
  assert.ok(lineStart >= 0, 'report.md has no `Tokens on subagent returns (` line');
  const spendLine = text.slice(lineStart, text.indexOf('\n', lineStart));
  for (const name of REPORT_EXCLUDES) {
    assert.ok(spendLine.includes(name),
      `report.md's spend line does not name \`${name}\`, so it presents a `
      + `worker-return token sum as the run's cost. Got: ${spendLine}`);
  }

  // 2. The rule that states them, read from its named anchor to the next
  //    top-level bullet.
  const ruleStart = text.indexOf('- What that token line EXCLUDES');
  assert.ok(ruleStart >= 0, 'report.md has no `What that token line EXCLUDES` rule');
  const next = text.indexOf('\n- ', ruleStart + 1);
  const rule = text.slice(ruleStart, next > ruleStart ? next : text.length);
  for (const name of REPORT_EXCLUDES) {
    assert.ok(rule.includes(name),
      `report.md's EXCLUDES rule does not name \`${name}\` - the prose and the `
      + 'seam are claiming different things about one figure');
  }
});

// --- TRN-02: the bulk-output rule, stated once, and the sites that obey it ---
//
// WATCHED FAILING AT 86cd45d, the tip of this plan's unpatched tree. Observed
// there, with this file copied into that checkout's `cadence-core/bin/`:
//
//   $ node --test --test-name-pattern='TRN-02' \
//       cadence-core/bin/prose-agreement.test.mjs
//   x TRN-02: the bulk-output rule is stated once, and every converted site
//     performs it
//     AssertionError [ERR_ASSERTION]: references/conventions.md states no
//     bulk-output rule - the distinctive clause the rule is written with is
//     absent from it, so no converted site has a rule to cite
//       actual: false,
//       expected: true,
//       operator: '==',
//   i pass 0
//   i fail 1
//
// and `node --test cadence-core/bin/prose-agreement.test.mjs` exits 1 there.
//
// Which is the defect exactly: the rule had no home, so no site could cite one
// and all three read the whole render into the transcript. It stops at that
// first assertion because on that tree the later facts do not exist to extract
// either - no statement names a transport, no file carries the clause, and none
// of the three surfaces prescribes its call with a redirect.
//
// Nothing THIS plan added is imported - the register and the rule module live
// in `lib/bulk-output.mjs` and this test never touches them, reading the
// SHIPPED prose bytes instead - so against the unpatched tree it fails on an
// ASSERTION rather than on a module that does not exist yet.
//
// The subject is AGREEMENT, not the presence of a phrase. The transport the
// statement itself prescribes is extracted OUT of the statement, and each
// converted surface's own `trace render` invocation line is then matched
// against that extracted form: the rule and the sites cannot end up describing
// different transports, and a test that only asserted "some expected phrase
// appears somewhere" would go green on the day they diverged.
//
// To re-watch: `git worktree add --detach <tmp> 86cd45d`, copy this file into
// `<tmp>/cadence-core/bin/`, run `node --test cadence-core/bin/prose-agreement.test.mjs`
// from `<tmp>`, then `git worktree remove <tmp>`.

/**
 * The one distinctive clause the bulk-output rule is stated with, ASSEMBLED
 * from its two halves rather than written out. This test asserts that exactly
 * one file under `cadence-core/` carries that clause, and a literal here would
 * be the second - the check would then be reporting on itself. Joining the
 * halves is what keeps `grep -rn` over the tree a true statement of the rule's
 * single home, and it is why the presence assertion below carries its own
 * message rather than `sentenceAround`'s, which echoes the needle it looked for.
 */
const BULK_CLAUSE = ['rides a file', 'not the transcript'].join(', ');

/** Every file under `dir`, recursively, as absolute paths. */
function everyFileUnder(dir) {
  const out = [];
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const f = join(dir, d.name);
    if (d.isDirectory()) out.push(...everyFileUnder(f));
    else if (d.isFile()) out.push(f);
  }
  return out;
}

test('TRN-02: the bulk-output rule is stated once, and every converted site performs it', () => {
  // 1. The statement, read out of the ONE file allowed to carry it.
  const conventions = doc('cadence-core', 'references', 'conventions.md');
  assert.ok(conventions.includes(BULK_CLAUSE),
    'references/conventions.md states no bulk-output rule - the distinctive clause '
    + 'the rule is written with is absent from it, so no converted site has a rule to cite');
  const stated = sentenceAround(conventions, BULK_CLAUSE, 'references/conventions.md');

  // 2. The transport that statement prescribes, EXTRACTED from the statement
  //    rather than restated here: the scratch-path prefix comes out of the
  //    rule's own bytes and is then what every converted site is required to
  //    redirect into, so the rule and the sites cannot describe two different
  //    transports. A literal regex here would be a second copy of the fact.
  const prescribed = stated.match(/>\s*"([^"]+)"/);
  assert.ok(prescribed && prescribed[1].includes('/'),
    'the bulk-output rule states no scratch-file redirect, so it names no transport '
    + `for a converted site to perform. Got: ${stated}`);
  const target = prescribed[1];
  const dir = target.slice(0, target.lastIndexOf('/') + 1);
  const form = new RegExp(`>\\s*"${dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^"]+"`);

  // 3. It is stated NOWHERE else in the plugin. A second copy is a second rule
  //    the moment either is edited, which is why `lib/bulk-output.mjs` carries
  //    a pointer at this file rather than the words.
  const carriers = everyFileUnder(join(REPO, 'cadence-core'))
    .filter((f) => readFileSync(f, 'utf8').includes(BULK_CLAUSE))
    .map((f) => f.slice(REPO.length + 1).split(sep).join('/'))
    .sort();
  assert.deepEqual(carriers, ['cadence-core/references/conventions.md'],
    'the bulk-output rule is stated in more than one file, or in none');

  // 4. Each converted surface prescribes its `trace render` with that same
  //    transport. The invocation line is found the way the tree's other
  //    censuses find one - a line that also names `planning.mjs` - so a
  //    sentence ABOUT what the render reports is never mistaken for a call.
  for (const surface of [
    ['cadence-core', 'references', 'triage-gate.md'],
    ['cadence-core', 'workflows', 'progress.md'],
    ['cadence-core', 'workflows', 'report.md'],
  ]) {
    const where = surface.join('/');
    const calls = doc(...surface).split('\n')
      .filter((l) => l.includes('planning.mjs') && /\btrace\s+render\b/.test(l));
    assert.equal(calls.length, 1, `${where} prescribes ${calls.length} \`trace render\` calls, not 1`);
    assert.match(calls[0], form,
      `${where} prescribes \`trace render\` with its output riding the transcript, `
      + `not the scratch file the rule states. Got: ${calls[0].trim()}`);
  }
});

// --- PLN-01: the plan-task ceiling's decision, read off both bound surfaces --
//
// WATCHED FAILING AT 617a2a1, the tip of this plan's unpatched tree. Observed
// there, with this file copied into that checkout's `cadence-core/bin/`:
//
//   $ node --test cadence-core/bin/prose-agreement.test.mjs
//   x PLN-01: the max_plan_tasks decision reads the same off the schema and the
//     catalog
//     AssertionError [ERR_ASSERTION]: config.schema.json's workflow.max_plan_tasks
//     purpose carries no landed - it states what the key means and not what its
//     value was decided against, so the ceiling is argued nowhere a check can read
//       actual: null,
//       expected: null,
//       operator: 'notStrictEqual',
//   i pass 28
//   i fail 1
//
// and `node --test cadence-core/bin/prose-agreement.test.mjs` exits 1 there.
//
// To re-watch: `git worktree add --detach <tmp> 617a2a1`, copy this file into
// `<tmp>/cadence-core/bin/`, run `node --test cadence-core/bin/prose-agreement.test.mjs`
// from `<tmp>`, then `git worktree remove <tmp>`.
//
// The defect this fails on: `workflow.max_plan_tasks` stated its MEANING on
// both surfaces and its DECISION on neither, so the one number a phase's whole
// plan count hangs off was argued nowhere a check reads. A phase SUMMARY is not
// that place - `milestone-prune` removes it at the close.
//
// The subject is AGREEMENT, never presence. Each figure is EXTRACTED out of the
// surface's own bytes and compared to the other surface's extraction, so a test
// that went green on "some expected phrase appears in each" - and would stay
// green on the day the two surfaces started stating different numbers - is not
// what is written here. The extractions are deliberately three, because three
// is what the decision is made of: what an extra plan costs cold, what the
// record says about plans outrunning a context, and where those two land.
//
// The landed value is then checked against the machine-readable defaults on
// BOTH surfaces, which is the failure mode a prose argument invites: prose that
// argues for 8 beside a `"default": 6` is worse than no prose, because a reader
// believes it.

/**
 * The three figures the `workflow.max_plan_tasks` re-decision is written with,
 * pulled OUT of one surface's own bytes. A field the surface does not carry
 * extracts `null` rather than throwing, so the comparison below can name WHICH
 * of two surfaces is missing a figure instead of dying on the first one.
 */
function ceilingDecision(text) {
  const landed = text.match(/landing on (\d+)/);
  const prefix = text.match(/([\d,]+) bytes/);
  const checkpoints = text.match(/(\d+) executor checkpoints of (\d+)/);
  return {
    landed: landed ? Number(landed[1]) : null,
    prefixBytes: prefix ? prefix[1] : null,
    execCheckpoints: checkpoints ? Number(checkpoints[1]) : null,
    allCheckpoints: checkpoints ? Number(checkpoints[2]) : null,
  };
}

test('PLN-01: the max_plan_tasks decision reads the same off the schema and the catalog', () => {
  const key = JSON.parse(doc('cadence-core', 'config.schema.json'))
    .keys['workflow.max_plan_tasks'];
  assert.ok(key, 'config.schema.json defines no workflow.max_plan_tasks');
  const schema = ceilingDecision(String(key.purpose));
  const row = tableRow(
    doc('cadence-core', 'references', 'config-catalog.md'), 'workflow.max_plan_tasks');
  const catalog = ceilingDecision(row[2]);

  // 1. The schema states the whole decision, not part of it.
  for (const [field, value] of Object.entries(schema)) {
    assert.notEqual(value, null,
      `config.schema.json's workflow.max_plan_tasks purpose carries no ${field} - `
      + 'it states what the key means and not what its value was decided against, '
      + 'so the ceiling is argued nowhere a check can read');
  }

  // 2. The catalog row states the SAME decision. Compared as extractions, so a
  //    figure changed on one surface and not the other is what fails, and the
  //    message carries both sides rather than the phrase that was looked for.
  assert.deepEqual(catalog, schema,
    'config-catalog.md and config.schema.json extract different max_plan_tasks '
    + 'decisions - one of the two surfaces was edited alone, so a reader gets a '
    + 'different argument depending on which one they opened');

  // 3. And the value the prose argues is the value the machine reads, on both
  //    surfaces. Prose arguing for one number beside a default holding another
  //    is worse than no prose: it is believed.
  assert.equal(schema.landed, key.default,
    `the schema purpose argues for ${schema.landed} and its own default is ${key.default}`);
  assert.equal(schema.landed, Number(row[4]),
    `the decision lands on ${schema.landed} and config-catalog.md's Default column says ${row[4]}`);
});

// --- SGT-01: the suggest seam's unset-layer defaults, against the schema -----
//
// `planning.mjs`'s `SUGGEST_KEY_DEFAULTS` is what `/cad-suggest` prints as a
// key's `current` when no config layer holds one, and it is a hand-copied
// mirror of `config.schema.json` by decision (D-15: the schema is not parsed at
// runtime, the duplication `DISPATCH_WINDOW_DEFAULTS` and `route.mjs`'s
// `DEFAULTS` already accept). Copied numbers drift, and this drift is silent at
// the worst possible place: the user reads a `current` off `/cad-suggest`, sets
// a value against it, and `/cad-config` shows a different row.
//
// The subject is AGREEMENT, never presence: both sides are EXTRACTED - one out
// of `planning.mjs`'s own source bytes, one out of the schema's `default`
// fields - and compared, the same shape the PLN-01 arm above uses. Scoped to
// the keys the literal carries; `DISPATCH_WINDOW_DEFAULTS` is a separate map
// with its own row set and is not widened onto here.

/**
 * The `SUGGEST_KEY_DEFAULTS` literal, read out of a source file's bytes as
 * key -> value. A line the grammar does not fit is SKIPPED rather than guessed
 * at, so the comparison below fails on a missing key by name.
 */
function suggestKeyDefaults(text) {
  const block = text.match(/const SUGGEST_KEY_DEFAULTS = Object\.freeze\(\{\n([\s\S]*?)\n\}\);/);
  assert.ok(block, 'planning.mjs carries no SUGGEST_KEY_DEFAULTS literal to compare');
  /** @type {Record<string, any>} */
  const out = {};
  for (const line of block[1].split('\n')) {
    const m = /^\s*'([\w.]+)':\s*(.+?),\s*$/.exec(line);
    if (m) out[m[1]] = JSON.parse(m[2].replace(/'/g, '"'));
  }
  return out;
}

test("SGT-01: the suggest seam's unset-layer defaults are config.schema.json's own", () => {
  const literal = suggestKeyDefaults(doc('cadence-core', 'bin', 'planning.mjs'));
  assert.ok(Object.keys(literal).length >= 2,
    `SUGGEST_KEY_DEFAULTS extracted ${Object.keys(literal).length} keys - the literal's `
    + 'shape moved out from under this extraction, so it is checking nothing');
  const keys = JSON.parse(doc('cadence-core', 'config.schema.json')).keys;
  /** @type {Record<string, any>} */
  const schema = {};
  for (const k of Object.keys(literal)) {
    assert.ok(keys[k], `SUGGEST_KEY_DEFAULTS names ${k}, which config.schema.json does not define`);
    schema[k] = keys[k].default;
  }
  assert.deepEqual(literal, schema,
    "planning.mjs's SUGGEST_KEY_DEFAULTS and config.schema.json's defaults disagree - one "
    + 'was edited alone, so /cad-suggest prints a `current` for an unset key that the row '
    + '/cad-config shows contradicts');
});


// --- REL-01: the tag flag is read at one site, and its words name that site --
//
// WATCHED FAILING AT c78cbdb, the tip of this plan's unpatched tree. Observed
// there, with this file copied into that checkout's `cadence-core/bin/`:
//
//   $ node --test --test-name-pattern='REL-01' \
//       cadence-core/bin/prose-agreement.test.mjs
//   x REL-01: git.create_tag is read at one prose site, and its purpose names
//     that site
//     AssertionError [ERR_ASSERTION]: git.create_tag is read at 2 prose sites:
//     cadence-core/workflows/milestone.md, skills/cad-land/SKILL.md - the key
//     governs the tag /cad-land cuts after the merge, so every other reader is
//     a step deciding something else by it
//   i pass 0
//   i fail 1
//
// and `node --test cadence-core/bin/prose-agreement.test.mjs` exits 1 there.
//
// Which is the defect exactly: `workflows/milestone.md` step 2 read the key as
// the release-mode discriminator for a whole step, so setting it false skipped
// the manifest bump - work the key never claimed to govern - while the schema
// `purpose` said "Tag on milestone" over a tag that is cut at land, after the
// merge confirms. Both halves are false on that tree: the second assertion's
// `land` is absent from those three words and its `milestone` is all of them.
//
// The subject is AGREEMENT, never presence. The command the purpose has to name
// is DERIVED from the one site found in step 1 - `skills/cad-land/SKILL.md` ->
// `cad-land` -> `land` - so the documented words and the actual reader cannot
// end up naming two different moments, and a literal `land` written into this
// test would be a second copy of the fact rather than a check on it.
//
// Scoped to the prose READ sites, `cadence-core/workflows/` and `skills/`, and
// deliberately NOT to `config.schema.json`, `references/config-catalog.md` or
// `references/config-reach.md`: those three name every key by definition, so a
// count that included them would be red forever for the wrong reason.
//
// To re-watch: `git worktree add --detach <tmp> c78cbdb`, copy this file into
// `<tmp>/cadence-core/bin/`, run `node --test cadence-core/bin/prose-agreement.test.mjs`
// from `<tmp>`, then `git worktree remove <tmp>`.

/** A repo-relative, forward-slashed path for an absolute one under REPO. */
const repoPath = (abs) => abs.slice(REPO.length + 1).split(sep).join('/');

test('REL-01: git.create_tag is read at one prose site, and its purpose names that site', () => {
  // 1. The prose surfaces that READ the key, found rather than listed.
  const sites = [];
  for (const dir of ['cadence-core/workflows', 'skills']) {
    for (const f of everyFileUnder(join(REPO, ...dir.split('/')))) {
      if (f.endsWith('.md') && readFileSync(f, 'utf8').includes('git.create_tag')) {
        sites.push(repoPath(f));
      }
    }
  }
  sites.sort();
  assert.deepEqual(sites, ['skills/cad-land/SKILL.md'],
    `git.create_tag is read at ${sites.length} prose sites: ${sites.join(', ')} - the key `
    + 'governs the tag /cad-land cuts after the merge, so every other reader is a step '
    + 'deciding something else by it');

  // 2. The schema `purpose` names THAT site's command, and no other moment.
  //    Both sides are extracted: the command comes out of the path found above,
  //    the words out of the schema's own bytes.
  const command = dirname(join(REPO, ...sites[0].split('/'))).split(sep).pop();
  const moment = String(command).replace(/^cad-/, '');
  const key = JSON.parse(doc('cadence-core', 'config.schema.json')).keys['git.create_tag'];
  assert.ok(key, 'config.schema.json defines no git.create_tag');
  const purpose = String(key.purpose);
  assert.match(purpose, new RegExp(`\\b${moment}\\b`, 'i'),
    `${sites[0]} is the one site that reads git.create_tag, and its schema purpose - `
    + `"${purpose}" - never names ${moment}, so the key documents a moment nothing reads it at`);
  assert.doesNotMatch(purpose, /milestone/i,
    `git.create_tag's schema purpose - "${purpose}" - still names the milestone close, `
    + `which stopped reading the key: the cut is ${moment}'s, on the pulled base after the `
    + 'merge confirms');
});
