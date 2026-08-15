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
import { join, dirname } from 'node:path';
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
  // open. activeVersion() and DECLARED_VERSION_RE are NOT changed and get no
  // fallback (D-07) - the line anchor is the deliberate v2.4.0 fix for reading
  // a MENTION as the milestone, with four fixtures pinning it at
  // branch-decision.test.mjs:237-265. Loosening it to make this pass would ship
  // a behaviour change to the branch-naming seam out of a docs phase; the file
  // is what moves when this goes red.
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
    + `body's FIRST version token is ${first.version} (line ${first.line}). A line-anchored `
    + 'token below an earlier prose mention wins under DECLARED_VERSION_RE, so version_drift '
    + 'compares the wrong version against the tag list while the docs themselves are correct. '
    + 'Fix the section - declare the milestone on its own line above every mention - rather '
    + 'than the anchor, which is the v2.4.0 fix for reading a mention as the milestone.');
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
