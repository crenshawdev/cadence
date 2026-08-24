// Zero-dep tests for planning.mjs. Run: node --test 'cadence-core/bin/*.test.mjs'
// The JSON shapes asserted here ARE the interface contract - there is no
// spec file beyond them. Only node: builtins, per the repo ethos.
//
// This file is BOTH a test file and the shared fixture harness for the
// `planning-*.test.mjs` siblings phase 4 split out of it: `PLANNING`,
// `PLANNING_DIR`, `seamSource`, `makeTree`, `run` and `today` are exported and
// every sibling imports them rather than carrying a copy that would drift.
// What stays here is the harness plus the regions that belong to no single
// subcommand.
//
// Because it is imported, its own `test` binding is a no-op unless this module
// IS the entry file - the discipline config-seams.test.mjs states at length.
// Without that guard every arm below would re-register inside each importing
// process and the suite's reported count would multiply.
import { test as nodeTest } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, symlinkSync, chmodSync, rmSync, renameSync, accessSync, realpathSync, constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { classifyAcceptanceCriteria } from './lib/planning-files.mjs';
import { DEBT_TOKEN } from './lib/debt-markers.mjs';
// The git-fixture env belongs to the audit arms it was written for; the
// task-record arms below drive a real repository through the same
// neutralized identity and config scopes, so they import it by name rather
// than carrying a second copy that would drift.
import { GIT_FIXTURE_ENV } from './planning-audit.test.mjs';
// `renumberTree` and the lease-check trio are declared with the arms they
// were written for and imported by name here: the two regions below that
// drive them span several subcommands, which is why they stayed.
import { renumberTree } from './planning-renumber.test.mjs';
import { leaseRepo, leaseCheck, stage } from './planning-lease-check.test.mjs';

/** True iff this module is what node was told to run; realpath on both sides so
 * a symlinked checkout still matches (config-seams.test.mjs D-19). */
function isEntryFile() {
  const argv1 = process.argv[1];
  if (typeof argv1 !== 'string' || argv1 === '') return false;
  try {
    return pathToFileURL(realpathSync(argv1)).href === pathToFileURL(realpathSync(fileURLToPath(import.meta.url))).href;
  } catch { return false; }
}

/** `node:test`'s `test` when run directly, a no-op when imported (see header). */
const test = isEntryFile() ? nodeTest : () => {};

export const PLANNING = join(dirname(fileURLToPath(import.meta.url)), 'planning.mjs');
export const PLANNING_DIR = join(dirname(fileURLToPath(import.meta.url)), 'planning');

/**
 * The seam's WHOLE source - the entry file plus every command module under
 * `planning/` - as one string. The source-byte census below counts detail sites
 * in the code this seam ships, and phase 4 spread that code over one module per
 * subcommand without changing a line of it. Reading `planning.mjs` alone after
 * that split would count the handlers that stayed and silently stop counting
 * the ones that moved, which is a census that passes while it measures less.
 */
export const seamSource = () => [PLANNING, ...readdirSync(PLANNING_DIR)
  .filter((f) => f.endsWith('.mjs')).sort().map((f) => join(PLANNING_DIR, f))]
  .map((f) => readFileSync(f, 'utf8')).join('\n');

// ---------------------------------------------------------------------------
// Fixture builder: fabricate a .planning tree from a compact spec.
//   makeTree({
//     roadmap: [{n:1, name:'Foundation', checked:true}, ...],
//     phases:  {1:{plan:true, summary:true, uat:[{status:'pass'}, ...]},
//               3:{plan:['PLAN-1.md','PLAN-2.md']}},
//     reqs:    [['REQ-1', 1, 'Complete'], ['REQ-9', 2, 'Deferred']],
//     cursor:  {phase:2, total:3, name:'Auth', status:'planned',
//               next:'/cad-execute 2', updated:'2026-01-01'},
//   }) -> absolute path of the .planning dir
// ---------------------------------------------------------------------------
export function makeTree(spec) {
  const dir = join(mkdtempSync(join(tmpdir(), 'cad-planning-')), '.planning');
  mkdirSync(dir, { recursive: true });

  if (spec.roadmap) {
    const lines = spec.roadmap.map((p) =>
      `- [${p.checked ? 'x' : ' '}] **Phase ${p.n}: ${p.name}** - ${p.desc || 'desc'}`);
    const details = spec.roadmap.map((p) =>
      `### Phase ${p.n}: ${p.name}\n**Goal:** goal ${p.n}\n**Depends on:** ${p.n === 1 ? 'Nothing' : `Phase ${p.n - 1}`}\n`);
    writeFileSync(join(dir, 'ROADMAP.md'),
      `# Roadmap: Fixture\n\n## Overview\n\nx\n\n## Phases\n\n${lines.join('\n')}\n\n## Phase Details\n\n${details.join('\n')}`);
  }

  for (const [n, ph] of Object.entries(spec.phases || {})) {
    const pdir = join(dir, 'phases', n);
    mkdirSync(pdir, { recursive: true });
    const plans = ph.plan === true ? ['PLAN.md'] : (ph.plan || []);
    for (const f of plans) {
      const reqs = ph.planReqs ? `---\nphase: ${n}\nrequirements: [${ph.planReqs.join(', ')}]\nfiles: []\n---\n` : '';
      writeFileSync(join(pdir, f), `${reqs}# Plan ${n}\n`);
    }
    // SUMMARY: frontmatter-only when `summary` is set; with real `##
    // Deviations` / `## Open items` bullets when `summaryBody` (a
    // {deviations?, openItems?} object) is given - the recall corpus needs
    // item-level bodies to rank against.
    if (ph.summary || ph.summaryBody) {
      let body = `---\nphase: ${n}\nstatus: complete\n---\n`;
      if (ph.summaryBody) {
        const devs = (ph.summaryBody.deviations || []).map((d) => `- ${d}`).join('\n') || '- None.';
        const opens = (ph.summaryBody.openItems || []).map((o) => `- ${o}`).join('\n') || '- None.';
        body += `\n## Deviations\n\n${devs}\n\n## Open items\n\n${opens}\n`;
      }
      writeFileSync(join(pdir, 'SUMMARY.md'), body);
    }
    // CONTEXT: a `## Durable decisions` section (from `durableDecisions`) and/or
    // a `## Decisions` section (from `contextDecisions`), both `- D-NN (area):
    // text` lines with one continuous D-NN sequence across both when given
    // together. Omitting `durableDecisions` entirely writes no durable heading
    // at all (the legacy shape); `durableDecisions: []` writes a present-but-
    // empty `## Durable decisions` heading (the v1.2 all-phase-local shape).
    if (ph.contextDecisions || ph.durableDecisions) {
      let k = 0;
      const next = () => `D-${String(++k).padStart(2, '0')}`;
      const parts = [`# Phase ${n} Context\n`];
      if (ph.durableDecisions !== undefined) {
        const lines = ph.durableDecisions.map((d) => `- ${next()} (area): ${d}`).join('\n');
        parts.push(`## Durable decisions\n\n${lines}\n`);
      }
      if (ph.contextDecisions) {
        const lines = ph.contextDecisions.map((d) => `- ${next()} (area): ${d}`).join('\n');
        parts.push(`## Decisions\n\n${lines}\n`);
      }
      writeFileSync(join(pdir, 'CONTEXT.md'), parts.join('\n'));
    }
    if (ph.uat) {
      const items = ph.uat.map((it, i) => {
        let s = `### ${i + 1}. Item ${i + 1}\nexpected: behavior ${i + 1}\nstatus: ${it.status}\n`;
        if (it.reason) s += `reason: ${it.reason}\n`;
        if (it.first_pass) s += `first_pass: ${it.first_pass}\n`;
        return s;
      });
      writeFileSync(join(pdir, 'UAT.md'),
        `---\nstatus: testing\nphase: ${n}\nstarted: 2026-01-01\nupdated: 2026-01-01\n---\n\n## Items\n\n${items.join('\n')}\n## Summary\n\ntotal: ${ph.uat.length}\n`);
    }
  }

  // CAPTURE.md: a top-level `[{section, text, phase?}]` list, each bullet under
  // its named heading (todos carry a `(phase N)` tag when phase is given,
  // matching /cad-capture's real format).
  //
  // The three walked headings are always written, in order, whether or not a
  // row names them. A section OUTSIDE that set - `Archive`, `Debt markers` - is
  // written after them, which is how a row asserts what the recall walk does
  // NOT reach: the falsifier for the walk-membership claim needs a bullet that
  // exists in the file and must never come back.
  if (spec.capture) {
    const bySection = { Todos: [], Seeds: [], Notes: [] };
    for (const c of spec.capture) {
      const tag = c.phase !== undefined ? `(phase ${c.phase}) ` : '';
      const box = c.section === 'Todos' ? '[ ] ' : '';
      (bySection[c.section] ||= []).push(`- ${box}${tag}${c.text}`);
    }
    writeFileSync(join(dir, 'CAPTURE.md'),
      Object.entries(bySection).map(([h, ls]) => `## ${h}\n\n${ls.join('\n')}\n`).join('\n'));
  }

  // config.json written verbatim from `spec.config` (the backend-off test pins
  // memory.backend here).
  if (spec.config) writeFileSync(join(dir, 'config.json'), JSON.stringify(spec.config));

  if (spec.reqs) {
    const rows = spec.reqs.map(([id, ph, st]) =>
      `| ${id} | ${ph === null ? '' : `Phase ${ph}`} | ${st} |`);
    writeFileSync(join(dir, 'REQUIREMENTS.md'),
      `# Requirements: Fixture\n\n## Traceability\n\n| Requirement | Phase | Status |\n|---|---|---|\n${rows.join('\n')}\n`);
  }

  if (spec.cursor) {
    const c = spec.cursor;
    writeFileSync(join(dir, 'STATE.md'),
      `# State\n\nPhase: ${c.phase} of ${c.total} (${c.name})\nStatus: ${c.status}\nNext: ${c.next}\nUpdated: ${c.updated}\n`);
  }
  return dir;
}

/** Run planning.mjs against a fixture dir; parse the one JSON line. */
/**
 * `env` (optional) is merged OVER process.env, so a row can pin a path the
 * script resolves relative to itself without any other row changing.
 */
export function run(args, dir, stdin, env) {
  let stdout;
  let code = 0;
  try {
    stdout = execFileSync('node', [PLANNING, ...args, '--dir', dir],
      { encoding: 'utf8',
        ...(stdin !== undefined ? { input: stdin } : {}),
        ...(env ? { env: { ...process.env, ...env } } : {}) });
  } catch (e) {
    stdout = e.stdout; code = e.status;
  }
  return { ...JSON.parse(stdout), _exit: code };
}

// Computed per-assertion (never at module load): a run that straddles
// midnight sees the stamp land on either side, and both are correct.
export const today = () => new Date().toISOString().slice(0, 10);

// --- line endings at the seam -----------------------------------------------
// The roadmap reads through a CRLF-ONLY normalizer and writes raw bytes split
// on `\n`. Pinning both halves at the seam, because the corruption these guard
// against is only observable end to end: a lone-CR file that PARSES reaches
// write paths that see one giant line, and `renumber remove` then reported
// ok:true while leaving two `**Phase 1:**` lines and deleting both detail
// sections. Parser-level counterparts live in planning-files.test.mjs.

const reEncode = (dir, nl) => {
  const f = join(dir, 'ROADMAP.md');
  writeFileSync(f, readFileSync(f, 'utf8').replace(/\n/g, nl));
};

test('renumber remove: a CRLF roadmap renumbers correctly and stays CRLF', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }, { n: 2, name: 'Two' }] });
  reEncode(dir, '\r\n');

  const r = run(['renumber', 'remove', '--n', '1'], dir);
  assert.equal(r.ok, true);
  const after = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  assert.match(after, /- \[ \] \*\*Phase 1: Two\*\*/);      // shifted down
  assert.equal(/\*\*Phase 1: One\*\*/.test(after), false);  // list line gone
  assert.equal(/### Phase 2: Two/.test(after), false);      // detail shifted too
  assert.equal(/[^\r]\n/.test(after), false);               // every LF still CRLF
});

test('renumber remove: a lone-CR roadmap is refused, not silently corrupted', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }, { n: 2, name: 'Two' }] });
  reEncode(dir, '\r');
  const before = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');

  const r = run(['renumber', 'remove', '--n', '1'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unparseable-roadmap');
  // The whole point: the file the command refused is byte-identical after.
  assert.equal(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), before);
  assert.equal((before.match(/\*\*Phase 1: One\*\*/g) || []).length, 1);
  assert.equal((before.match(/### Phase \d/g) || []).length, 2);
});

test('status: a lone-CR roadmap refuses rather than reporting a closed milestone', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }] });
  reEncode(dir, '\r');
  const r = run(['status'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unparseable-roadmap');
  assert.equal(r.cycle, undefined); // never mistaken for a pruned roadmap
});

test('renumber: refuses to operate ON a decimal phase', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }, { n: 2, name: 'Two' }] });
  assert.equal(run(['renumber', 'remove', '--n', '1.5'], dir).reason, 'bad-args');
  assert.equal(run(['renumber', 'insert', '--at', '1.5'], dir).reason, 'bad-args');
});

// The decimal answer and the missing-value answer are different repairs, so
// the decimal one keeps its own wording rather than collapsing into requireInt's.
test('renumber: the decimal refusal names decimals, not a missing flag', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }, { n: 2, name: 'Two' }] });
  assert.match(run(['renumber', 'remove', '--n', '2.1'], dir).detail, /re-place decimal phases by hand/);
  assert.match(run(['renumber', 'insert', '--at', '2.1'], dir).detail, /re-place decimal phases by hand/);
});

// `renumber remove --n` with no value used to pass the NaN screen as 1 and
// delete phase 1 - its roadmap line, its detail section and its directory.
for (const [sub, flag] of [['remove', 'n'], ['insert', 'at']]) {
  test(`renumber ${sub}: a valueless --${flag} refuses; roadmap and dirs untouched`, () => {
    const dir = renumberTree();
    const before = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
    const dirsBefore = readdirSync(join(dir, 'phases')).sort();
    const r = run(['renumber', sub, `--${flag}`], dir);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'bad-args');
    assert.match(r.detail, new RegExp(`--${flag}`));
    assert.equal(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), before);
    assert.deepEqual(readdirSync(join(dir, 'phases')).sort(), dirsBefore);
  });

  test(`renumber ${sub}: a non-numeric --${flag} refuses the same way`, () => {
    const dir = renumberTree();
    const before = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
    const r = run(['renumber', sub, `--${flag}`, 'abc'], dir);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'bad-args');
    assert.equal(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), before);
  });
}

// A tree with an out-of-roadmap decimal Phase 2.1 and a cursor parked on it -
// mirrors the decimal test above rather than passing n:2.1 to makeTree, whose
// `**Depends on:** Phase ${p.n - 1}` line would render a float artifact.
function decimalCursorTree() {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }, { n: 2, name: 'Two' }, { n: 3, name: 'Three' }],
    phases: { 1: { plan: true }, 2: { plan: true }, 3: { plan: true } },
    cursor: { phase: 2.1, total: 4, name: 'Patch', status: 'planned', next: '/cad-execute 2.1', updated: '2026-01-01' },
  });
  const roadmap = readFileSync(join(dir, 'ROADMAP.md'), 'utf8').replace(
    '- [ ] **Phase 3: Three**',
    '- [ ] **Phase 2.1: Patch** - see phases/2.1/ notes\n- [ ] **Phase 3: Three**');
  writeFileSync(join(dir, 'ROADMAP.md'), roadmap);
  mkdirSync(join(dir, 'phases', '2.1'), { recursive: true });
  return dir;
}

test('renumber: a decimal cursor is warned about, never shifted (#37)', () => {
  const dir1 = decimalCursorTree();
  const r1 = run(['renumber', 'remove', '--n', '1'], dir1);
  assert.equal(r1.ok, true);
  assert.match(r1.warn, /2\.1/);
  assert.match(r1.warn, /re-point/);
  const cursor1 = run(['cursor', 'get'], dir1);
  assert.equal(cursor1.phase, 2.1);
  assert.equal(cursor1.total, 3);
  assert.match(readFileSync(join(dir1, 'ROADMAP.md'), 'utf8'), /\*\*Phase 2\.1: Patch\*\*/);
  assert.ok(existsSync(join(dir1, 'phases', '2.1')));

  const dir2 = decimalCursorTree();
  const r2 = run(['renumber', 'insert', '--at', '2'], dir2);
  assert.equal(r2.ok, true);
  const cursor2 = run(['cursor', 'get'], dir2);
  assert.equal(cursor2.phase, 2.1);
  assert.equal(cursor2.total, 5);
  assert.ok(r2.warn);

  const dir3 = decimalCursorTree();
  const r3 = run(['renumber', 'remove', '--n', '3'], dir3);
  assert.equal(r3.ok, true);
  assert.equal(r3.warn, undefined); // shift point sits above the cursor - nothing moved (D-10)
  const cursor3 = run(['cursor', 'get'], dir3);
  assert.equal(cursor3.phase, 2.1);
});

test('phase-done: a decimal phase flips its own line, dot not a wildcard', () => {
  // Phase 291 must NOT be flipped by --n 2.1 (the unescaped-regex bug).
  const dir = makeTree({
    roadmap: [{ n: 2.1, name: 'Insert' }, { n: 291, name: 'Big' }],
  });
  const r = run(['phase-done', '--n', '2.1'], dir);
  assert.equal(r.ok, true);
  const after = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  assert.match(after, /- \[x\] \*\*Phase 2\.1: Insert\*\*/);
  assert.match(after, /- \[ \] \*\*Phase 291: Big\*\*/); // untouched
});

// --- the GLOBAL --dir refuses the empty, bare and flag-shaped spellings ------
// Phase 2 closed this at the six `--dir` seams and left planning.mjs's own door
// open, where the defect was worse than the gap recorded: measured 2026-08-19,
// `status --dir ''` answered `{"ok":true,"current":4,"total":5,...}` about
// `./.planning` - this repository's own tree, which the caller never named -
// and a BARE `--dir` minted the boolean `true`, reached `existsSync(true)` and
// printed a `DEP0187` deprecation warning on STDERR beside the answer. stdout
// is the single channel the seam layer parses and that deprecation is scheduled
// to become a throw, so the STDERR BYTE COUNT is part of the assertion rather
// than decoration - it is what would redden if the boolean reached fs again.
// The flag now reads through its declared row in lib/arg-contract.mjs, whose
// `--dir` grammar refuses on both axes.
const BLANK_DIRS = [
  { name: '--dir with nothing after it', args: ['--dir'] },
  { name: 'an empty --dir ""', args: ['--dir', ''] },
  { name: 'a whitespace-only --dir', args: ['--dir', '   '] },
  { name: 'a flag-shaped --dir value', args: ['--dir', '--undo'] },
];

for (const row of BLANK_DIRS) {
  test(`status: ${row.name} is bad-args naming the flag, and stderr stays empty`, () => {
    const r = spawnSync('node', [PLANNING, 'status', ...row.args], { encoding: 'utf8' });
    const body = JSON.parse(r.stdout);
    assert.equal(body.ok, false, r.stdout);
    assert.equal(body.reason, 'bad-args', r.stdout);
    assert.match(body.detail, /--dir/);
    assert.equal(r.status, 1);
    assert.equal(r.stderr, '', `stderr: ${r.stderr}`);
  });
}

test('status: a genuinely ABSENT --dir still defaults to ./.planning', () => {
  // The other half of the refusal: absent and present-with-nothing-usable are
  // different inputs, and only the second one refuses.
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One', checked: false }] });
  const r = spawnSync('node', [PLANNING, 'status'], { encoding: 'utf8', cwd: dirname(dir) });
  const body = JSON.parse(r.stdout);
  assert.equal(body.ok, true, r.stdout);
  assert.equal(body.total, 1, r.stdout);
  assert.equal(r.status, 0);
});

// --- --phase carries the caller's spelling, at every shape site (D-02) -------
//
// `String(Number('1.10'))` is `'1.1'`, so every seam that built a phase
// directory from the NUMBER read a different phase's files and said ok:true
// about it. These rows are the falsifying fixtures: a tree where both
// spellings exist as separate directories, and a tree where the padded one
// does not exist at all.

test('lease-check: --phase 1.10 leases against phases/1.10, not phases/1.1', () => {
  const { repo, dir } = leaseRepo({ phase: '1.1', files: ['one-one.txt'] });
  const pdir = join(dir, 'phases', '1.10');
  mkdirSync(pdir, { recursive: true });
  writeFileSync(join(pdir, 'PLAN.md'), '---\nphase: 1.10\nfiles:\n  - one-ten.txt\n---\n# Plan\n');
  stage(repo, 'one-ten.txt');
  const r = leaseCheck(repo, dir, ['--phase', '1.10', '--plan', '1']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.plan_file, '.planning/phases/1.10/PLAN.md');
  // ...and phase 1.1's own lease does NOT license 1.10's file.
  const other = leaseCheck(repo, dir, ['--phase', '1.1', '--plan', '1']);
  assert.equal(other.ok, false);
  assert.equal(other.plan_file, '.planning/phases/1.1/PLAN.md');
  assert.deepEqual(other.undeclared, ['one-ten.txt']);
});

test('lease-check: --phase 08 names phases/08, never answering about phases/8', () => {
  const { repo, dir } = leaseRepo({ phase: 8, files: ['a.txt'] });
  stage(repo, 'a.txt');
  const r = leaseCheck(repo, dir, ['--phase', '08', '--plan', '1']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'no-plan');
  assert.match(r.detail, /phases[/\\]08$/);
  assert.equal(r.hint, '/cad-plan 08');
});

test('plan-overlap: --phase 08 reports no-phase-dir naming phases/08', () => {
  const dir = makeTree({ roadmap: [{ n: 8, name: 'Eight' }], phases: { 8: { plan: true } } });
  const r = run(['plan-overlap', '--phase', '08'], dir);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'no-phase-dir');
  assert.match(r.detail, /phases[/\\]08 not found$/);
  // ...and the legal spelling still answers.
  assert.equal(run(['plan-overlap', '--phase', '8'], dir).ok, true);
});

test('plan-overlap: --phase 1.10 intersects phases/1.10\'s plans', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }] });
  // phases/1.1 holds a SINGLE plan; phases/1.10 holds two that overlap. A
  // normalizing reader answers "fewer than two plans - nothing to intersect".
  const one = join(dir, 'phases', '1.1');
  mkdirSync(one, { recursive: true });
  writeFileSync(join(one, 'PLAN.md'), '---\nphase: 1.1\nfiles:\n  - a.txt\n---\n# Plan\n');
  const ten = join(dir, 'phases', '1.10');
  mkdirSync(ten, { recursive: true });
  writeFileSync(join(ten, 'PLAN-1.md'), '---\nphase: 1.10\nfiles:\n  - shared.txt\n---\n# Plan 1\n');
  writeFileSync(join(ten, 'PLAN-2.md'), '---\nphase: 1.10\nfiles:\n  - shared.txt\n---\n# Plan 2\n');
  const r = run(['plan-overlap', '--phase', '1.10'], dir);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.note, undefined);
  assert.deepEqual(r.overlaps, [{ plans: ['PLAN-1.md', 'PLAN-2.md'], files: ['shared.txt'] }]);
  // The echoed phase stays the NUMBER - arithmetic and comparisons keep it.
  assert.equal(r.phase, 1.1);
});

test('uat: --phase 1.10 reads phases/1.10/UAT.md, never phase 1.1\'s checklist', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }], phases: { '1.1': { uat: [{ status: 'pass' }] } } });
  const r = run(['uat', 'status', '--phase', '1.10'], dir);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'no-uat');
  assert.match(r.detail, /phases[/\\]1\.10[/\\]UAT\.md not found$/);
  // ...and `uat init` on 1.10 writes ITS OWN file, leaving 1.1's untouched.
  const before = readFileSync(join(dir, 'phases', '1.1', 'UAT.md'), 'utf8');
  mkdirSync(join(dir, 'phases', '1.10'), { recursive: true });
  const init = run(['uat', 'init', '--phase', '1.10'], dir,
    JSON.stringify([{ name: 'ten', expected: 'ten' }]));
  assert.equal(init.ok, true, JSON.stringify(init));
  assert.match(init.file, /phases[/\\]1\.10[/\\]UAT\.md$/);
  assert.equal(readFileSync(join(dir, 'phases', '1.1', 'UAT.md'), 'utf8'), before);
  // The frontmatter LABEL is the caller's spelling too.
  assert.match(readFileSync(join(dir, 'phases', '1.10', 'UAT.md'), 'utf8'), /^phase: 1\.10$/m);
});

test('uat: a malformed --phase is refused in the shared wording, before any read', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }], phases: { 1: { uat: [{ status: 'pass' }] } } });
  for (const bad of ['-1', '1e21', 'abc']) {
    const r = run(['uat', 'status', '--phase', bad], dir);
    assert.equal(r.ok, false, bad);
    assert.equal(r.reason, 'bad-args', bad);
  }
});

test('seed-reqs: --phase 08 is refused outright, never answering about phases/8', () => {
  // The claim this row has always made is that `08` never becomes `8` at this
  // face. It used to hold that by reading `phases/08` and reporting
  // `no-phase-dir`; since D-07 the spelling is refused at the door instead,
  // because this face WRITES the numeric half into a Traceability cell. The
  // sibling `plan-overlap --phase 08` row above still gets `no-phase-dir`,
  // which is what shows the refusal is scoped to the two write faces.
  const dir = makeTree({
    roadmap: [{ n: 8, name: 'Eight' }],
    phases: { 8: { plan: true, planReqs: ['FLD-01'] } },
    reqs: [],
  });
  writeFileSync(join(dir, 'REQUIREMENTS.md'),
    '# Requirements\n\n## Active\n\n- **FLD-01**: x\n\n## Traceability\n\n'
    + '| Requirement | Phase | Status |\n|---|---|---|\n');
  const r = run(['seed-reqs', '--phase', '08'], dir);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'bad-args');
  assert.ok(r.detail.includes('"08"') && r.detail.includes('"8"'), r.detail);
  assert.equal(r._exit, 1);
  // ...and the legal spelling seeds.
  assert.deepEqual(run(['seed-reqs', '--phase', '8'], dir).seeded, ['FLD-01']);
});

// --- adjudication: the record a gate fire leaves (phase 2) ------------------
//
// The seam is exercised against a REAL repository under mkdtempSync, because
// half of what it promises is git's: full 40-character ids resolved from the
// caller's spelling, and a refusal when the range does not resolve at all.
// Nothing here reads this repository's own `.planning`.

/**
 * A scratch git repo holding `.planning/phases/<phase>/` and two commits.
 * Returns {repo, dir, base, head} - `base` is the FIRST commit's 7-char
 * abbreviation, deliberately, because that is what 44 of this repo's 52
 * receipts actually spell.
 */
function adjRepo({ phase = 2 } = {}) {
  const repo = mkdtempSync(join(tmpdir(), 'cad-adj-'));
  const git = (...args) => execFileSync('git', ['-C', repo, ...args],
    { encoding: 'utf8', stdio: 'pipe' }).trim();
  git('init', '-q');
  git('config', 'user.email', 't@example.com');
  git('config', 'user.name', 'T');
  const dir = join(repo, '.planning');
  mkdirSync(join(dir, 'phases', String(phase)), { recursive: true });
  writeFileSync(join(repo, 'src.js'), 'let x = 1;\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
  const baseFull = git('rev-parse', 'HEAD');
  writeFileSync(join(repo, 'src.js'), 'let x = 2;\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'head');
  const headFull = git('rev-parse', 'HEAD');
  return { repo, dir, phase, base: baseFull.slice(0, 7), baseFull, headFull };
}

/** Run the seam with cwd INSIDE the repo - resolveRange asks git about the cwd. */
function adjRun(repo, dir, args) {
  let stdout;
  let code = 0;
  try {
    stdout = execFileSync('node', [PLANNING, '--dir', dir, 'adjudication', ...args],
      { encoding: 'utf8', cwd: repo });
  } catch (e) { stdout = e.stdout; code = e.status; }
  return { ...JSON.parse(stdout), _exit: code };
}

/** One voice raising one finding, ruled `survived`. The claim carries a quote
 * and a backslash on purpose: this payload is a FILE for exactly that reason. */
function adjPayload(over) {
  return {
    voices: [{
      voice: 'openai',
      model: 'gpt-5',
      returned: {
        findings: [{
          file: 'src.js',
          line: 1,
          severity: 'high',
          claim: 'the "x" binding is reassigned, so C:\\tmp is read twice',
          failure_scenario: 'a second reader sees 1 where the first saw 2',
        }],
      },
      rulings: [{
        finding: 0,
        ruling: 'survived',
        claim: 'the "x" binding is reassigned, so C:\\tmp is read twice',
        failure_scenario: 'a second reader sees 1 where the first saw 2',
        fix_commit: 'abcdef1',
      }],
    }],
    ...(over || {}),
  };
}

/** Write a payload file inside the repo and answer its path. */
function adjPayloadFile(repo, payload, name = 'payload.json') {
  const file = join(repo, name);
  writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`);
  return file;
}

/** Every ADJUDICATION-* file under a phase directory, sorted. */
const adjFiles = (dir, phase = 2) =>
  readdirSync(join(dir, 'phases', String(phase))).filter((f) => f.startsWith('ADJUDICATION')).sort();

test('adjudication: the record lands beside the sibling REVIEW discriminator (AC1)', () => {
  const { repo, dir, baseFull, headFull, base } = adjRepo();
  const payload = adjPayloadFile(repo, adjPayload());
  const r = adjRun(repo, dir, ['--phase', '2', '--trigger', 'plan',
    '--discriminator', 'plan-1', '--base', base, '--head', 'HEAD', '--payload', payload]);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.record, 'phases/2/ADJUDICATION-plan-plan-1.json');
  assert.equal(r.round, 1);
  assert.deepEqual(r.counts, { raised: 1, survived: 1, downgraded: 0, refuted: 0 });
  assert.deepEqual(adjFiles(dir), ['ADJUDICATION-plan-plan-1.json']);

  const rec = JSON.parse(readFileSync(join(dir, r.record), 'utf8'));
  assert.equal(rec.trigger, 'plan');
  assert.equal(rec.discriminator, 'plan-1');
  assert.equal(rec.base_id, baseFull);
  assert.equal(rec.head_id, headFull);
  // The record stores NO count of its own - every figure is derived on read.
  assert.equal(rec.counts, undefined);
  assert.deepEqual(rec.voices, [{ voice: 'openai', model: 'gpt-5' }]);
  assert.equal(rec.entries.length, 1);
  assert.equal(rec.entries[0].voice, 'openai');
  assert.equal(rec.entries[0].severity, 'high');
  // VERBATIM, quoting and backslash intact.
  assert.equal(rec.entries[0].claim, adjPayload().voices[0].returned.findings[0].claim);
});

test('adjudication: every entry carries full 40-char ids from a 7-char base and a literal HEAD (AC2)', () => {
  const { repo, dir, base, baseFull, headFull } = adjRepo();
  const payload = adjPayloadFile(repo, adjPayload());
  const r = adjRun(repo, dir, ['--phase', '2', '--trigger', 'risk_surface',
    '--discriminator', 'plan-1', '--base', base, '--head', 'HEAD', '--payload', payload]);
  assert.equal(r.ok, true, JSON.stringify(r));
  // The caller's SPELLING stays on the envelope for the reader; the id is what
  // an auditor spends.
  assert.equal(r.base, base);
  assert.equal(r.head, 'HEAD');
  assert.equal(r.base_id.length, 40);
  assert.equal(r.head_id.length, 40);
  const rec = JSON.parse(readFileSync(join(dir, r.record), 'utf8'));
  for (const e of rec.entries) {
    assert.equal(e.base_id, baseFull);
    assert.equal(e.head_id, headFull);
    assert.equal(e.base_id.length, 40);
    assert.equal(e.head_id.length, 40);
  }
});

test('adjudication: a payload whose ruling paraphrases the claim is refused, no file written (AC2)', () => {
  const { repo, dir, base } = adjRepo();
  const bad = adjPayload();
  bad.voices[0].rulings[0].claim = 'x is reassigned';
  const payload = adjPayloadFile(repo, bad);
  const r = adjRun(repo, dir, ['--phase', '2', '--trigger', 'plan',
    '--discriminator', 'plan-1', '--base', base, '--head', 'HEAD', '--payload', payload]);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'bad-payload');
  assert.match(r.detail, /byte-identical/);
  assert.deepEqual(adjFiles(dir), []);
});

for (const spelling of ['../escaped', 'sub/plan-1', 'plan-1.json', '.', '-plan-1']) {
  test(`adjudication: a --discriminator spelled ${JSON.stringify(spelling)} is refused with NO file created`, () => {
    const { repo, dir, base } = adjRepo();
    const payload = adjPayloadFile(repo, adjPayload());
    const r = adjRun(repo, dir, ['--phase', '2', '--trigger', 'plan',
      '--discriminator', spelling, '--base', base, '--head', 'HEAD', '--payload', payload]);
    assert.equal(r.ok, false, JSON.stringify(r));
    assert.equal(r.reason, 'bad-args');
    assert.match(r.detail, /--discriminator/);
    assert.deepEqual(adjFiles(dir), []);
    // ...and nothing landed anywhere else either: the repo holds exactly what
    // the fixture put there.
    assert.deepEqual(readdirSync(repo).sort(), ['.git', '.planning', 'payload.json', 'src.js']);
    assert.deepEqual(readdirSync(join(dir, 'phases')), ['2']);
  });
}

test('adjudication: a --trigger carrying a path separator is refused the same way', () => {
  const { repo, dir, base } = adjRepo();
  const payload = adjPayloadFile(repo, adjPayload());
  const r = adjRun(repo, dir, ['--phase', '2', '--trigger', '../../etc/plan',
    '--discriminator', 'plan-1', '--base', base, '--head', 'HEAD', '--payload', payload]);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'bad-args');
  assert.match(r.detail, /--trigger/);
  assert.deepEqual(adjFiles(dir), []);
});

test('adjudication: an unresolvable --head is refused with no file created', () => {
  const { repo, dir, base } = adjRepo();
  const payload = adjPayloadFile(repo, adjPayload());
  const r = adjRun(repo, dir, ['--phase', '2', '--trigger', 'plan',
    '--discriminator', 'plan-1', '--base', base, '--head', 'no-such-ref', '--payload', payload]);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'unresolved-range');
  assert.equal(r._exit, 1);
  assert.deepEqual(adjFiles(dir), []);
});

test('adjudication: a re-arm passes --round 2 and round one survives byte for byte', () => {
  const { repo, dir, base } = adjRepo();
  const payload = adjPayloadFile(repo, adjPayload());
  const args = (extra) => ['--phase', '2', '--trigger', 'plan', '--discriminator', 'plan-1',
    '--base', base, '--head', 'HEAD', '--payload', payload, ...extra];

  const first = adjRun(repo, dir, args(['--round', '1']));
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.equal(first.record, 'phases/2/ADJUDICATION-plan-plan-1.json');
  const roundOne = readFileSync(join(dir, first.record), 'utf8');

  // Round two rules the SAME findings differently - that is what a re-arm is -
  // so the two records must both survive or the re-arm erases the evidence of
  // what the first round said.
  const second = adjPayload();
  second.voices[0].rulings[0] = {
    finding: 0,
    ruling: 'refuted',
    claim: second.voices[0].returned.findings[0].claim,
    failure_scenario: second.voices[0].returned.findings[0].failure_scenario,
    counter_evidence: { file: 'src.js', line: 1, note: 'the binding is const at head' },
  };
  const payload2 = adjPayloadFile(repo, second, 'payload-2.json');
  const r2 = adjRun(repo, dir, ['--phase', '2', '--trigger', 'plan', '--discriminator', 'plan-1',
    '--base', base, '--head', 'HEAD', '--payload', payload2, '--round', '2']);
  assert.equal(r2.ok, true, JSON.stringify(r2));
  assert.equal(r2.record, 'phases/2/ADJUDICATION-plan-plan-1-r2.json');
  assert.deepEqual(r2.counts, { raised: 1, survived: 0, downgraded: 0, refuted: 1 });

  assert.deepEqual(adjFiles(dir),
    ['ADJUDICATION-plan-plan-1-r2.json', 'ADJUDICATION-plan-plan-1.json']);
  assert.equal(readFileSync(join(dir, first.record), 'utf8'), roundOne,
    'round one\'s rulings are unchanged byte for byte');
});

test('adjudication: a second fire that forgot --round is REFUSED, not merged and not overwritten', () => {
  const { repo, dir, base } = adjRepo();
  const payload = adjPayloadFile(repo, adjPayload());
  const args = ['--phase', '2', '--trigger', 'plan', '--discriminator', 'plan-1',
    '--base', base, '--head', 'HEAD', '--payload', payload];

  const first = adjRun(repo, dir, args);
  assert.equal(first.ok, true, JSON.stringify(first));
  const before = readFileSync(join(dir, first.record), 'utf8');

  const again = adjRun(repo, dir, args);
  assert.equal(again.ok, false, JSON.stringify(again));
  assert.equal(again.reason, 'record-exists');
  assert.match(again.detail, /phases\/2\/ADJUDICATION-plan-plan-1\.json/);
  assert.match(again.hint, /--round 2/);
  assert.equal(again._exit, 1);
  assert.deepEqual(adjFiles(dir), ['ADJUDICATION-plan-plan-1.json']);
  assert.equal(readFileSync(join(dir, first.record), 'utf8'), before,
    'the existing record is untouched byte for byte');
});

test('adjudication: a phase directory that does not exist is refused rather than minted', () => {
  const { repo, dir, base } = adjRepo();
  const payload = adjPayloadFile(repo, adjPayload());
  const r = adjRun(repo, dir, ['--phase', '9', '--trigger', 'plan',
    '--discriminator', 'plan-1', '--base', base, '--head', 'HEAD', '--payload', payload]);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'no-phase-dir');
  assert.deepEqual(readdirSync(join(dir, 'phases')), ['2']);
});

test('adjudication: an absent --payload is bad-args, never a read of stdin', () => {
  const { repo, dir, base } = adjRepo();
  const r = adjRun(repo, dir, ['--phase', '2', '--trigger', 'plan',
    '--discriminator', 'plan-1', '--base', base, '--head', 'HEAD']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'bad-args');
  assert.match(r.detail, /--payload/);
  assert.deepEqual(adjFiles(dir), []);
});

test('adjudication: a payload file that was never written is no-payload, not a record', () => {
  const { repo, dir, base } = adjRepo();
  const r = adjRun(repo, dir, ['--phase', '2', '--trigger', 'plan',
    '--discriminator', 'plan-1', '--base', base, '--head', 'HEAD',
    '--payload', join(repo, 'never-written.json')]);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'no-payload');
  assert.deepEqual(adjFiles(dir), []);
});

test('adjudication: --round 0 and a non-numeric round are refused', () => {
  const { repo, dir, base } = adjRepo();
  const payload = adjPayloadFile(repo, adjPayload());
  for (const round of ['0', '-1']) {
    const r = adjRun(repo, dir, ['--phase', '2', '--trigger', 'plan',
      '--discriminator', 'plan-1', '--base', base, '--head', 'HEAD',
      '--payload', payload, '--round', round]);
    assert.equal(r.ok, false, `--round ${round}: ${JSON.stringify(r)}`);
    assert.equal(r.reason, 'bad-args');
  }
  assert.deepEqual(adjFiles(dir), []);
});

test('adjudication: a citation absent at head is MARKED and still stored, the present one is not (AC5)', () => {
  const { repo, dir, base } = adjRepo();
  const two = adjPayload();
  const findings = two.voices[0].returned.findings;
  // One citation present at head (`src.js`), one that is not.
  findings.push({
    file: 'deleted/gone.js',
    line: 12,
    severity: 'medium',
    claim: 'the helper is never called',
    failure_scenario: 'dead code ships',
  });
  two.voices[0].rulings.push({
    finding: 1,
    ruling: 'downgraded',
    claim: findings[1].claim,
    failure_scenario: findings[1].failure_scenario,
  });
  const payload = adjPayloadFile(repo, two);
  const r = adjRun(repo, dir, ['--phase', '2', '--trigger', 'plan',
    '--discriminator', 'plan-1', '--base', base, '--head', 'HEAD', '--payload', payload]);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.citations, { checked: true, missing: 1 });

  const rec = JSON.parse(readFileSync(join(dir, r.record), 'utf8'));
  // BOTH stored: the entry count is the number of findings RAISED, and a
  // finding whose grounding is in question is the last one a record may lose.
  assert.equal(rec.entries.length, 2);
  assert.deepEqual(rec.entries.map((e) => e.file), ['src.js', 'deleted/gone.js']);
  assert.equal(rec.entries[0].citation_missing, undefined);
  assert.equal(rec.entries[1].citation_missing, true);
  assert.deepEqual(rec.citations, { checked: true });
  assert.deepEqual(r.counts, { raised: 2, survived: 1, downgraded: 1, refuted: 0 });
});

test('adjudication: a citation pointing outside the repository is marked, never a crash (AC5)', () => {
  const { repo, dir, base } = adjRepo();
  const escaped = adjPayload();
  escaped.voices[0].returned.findings[0].file = '../outside/secrets.env';
  const payload = adjPayloadFile(repo, escaped);
  const r = adjRun(repo, dir, ['--phase', '2', '--trigger', 'plan',
    '--discriminator', 'plan-1', '--base', base, '--head', 'HEAD', '--payload', payload]);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.citations, { checked: true, missing: 1 });
  const rec = JSON.parse(readFileSync(join(dir, r.record), 'utf8'));
  assert.equal(rec.entries.length, 1);
  assert.equal(rec.entries[0].citation_missing, true);
});

// --- FIRE_RECEIPTS: `deferral`, the fifth name a fire can settle at ----------
//
// The `deferred` gate mode settles a fire by QUEUEING what it found and letting
// the run continue, so it produces an outcome none of the four older receipt
// names describes. `risk-check status` is the reader that decides whether a
// matched range was ever fired on, and it accepts a receipt only if its event
// name is in FIRE_RECEIPTS - so without `deferral` on that list a deferring run
// clears its own gate never, and halts at exactly the step deferring it was
// meant to let through.
//
// Both arms run the REAL seams end to end - `risk-check run` writes the record,
// `trace append` writes the receipt, `risk-check status` reads them - rather
// than hand-writing trace lines. The correlation id, the resolved range ids and
// the row key are then all the seam's own, which is the half a hand-built
// fixture would assert nothing about.

/** A git repo with a risky range: `.planning` answering the surface question,
 * a base commit, and a head commit adding a file under a `secrets/` directory.
 * Returns the full ids of both ends. */
function deferralRepo() {
  const repo = mkdtempSync(join(tmpdir(), 'cad-deferral-'));
  const git = (...args) => execFileSync('git', ['-C', repo, ...args],
    { encoding: 'utf8', stdio: 'pipe' }).trim();
  git('init', '-q');
  git('config', 'user.email', 't@example.com');
  git('config', 'user.name', 'T');
  git('config', 'commit.gpgsign', 'false');
  const dir = join(repo, '.planning');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'config.json'),
    JSON.stringify({ review: { triggers: { risk_surface: { surfaces: ['secrets'] } } } }));
  writeFileSync(join(repo, 'README.md'), 'start\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
  const base = git('rev-parse', 'HEAD');
  mkdirSync(join(repo, 'src', 'secrets'), { recursive: true });
  writeFileSync(join(repo, 'src', 'secrets', 'vault.ts'), 'export const K = 1;\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'head');
  const head = git('rev-parse', 'HEAD');
  // The anchor, so the record and the receipt derive the SAME `<phase>-<sha>`
  // correlation id the way a real run does rather than falling back to the
  // phase-only form.
  plRun(repo, dir, ['trace', 'append', '--phase', '1',
    '--family', 'lifecycle', '--event', 'phase_start', '--sha', head.slice(0, 7)]);
  return { repo, dir, base, head };
}

/** Any planning.mjs subcommand, run with cwd INSIDE the repo - `resolveRange`
 * and the detector both ask git about the cwd. The global config layer is
 * pinned out: a developer whose own config answers the surface question would
 * otherwise see a row pass here and fail in CI. */
function plRun(repo, dir, args) {
  let stdout;
  let code = 0;
  try {
    stdout = execFileSync('node', [PLANNING, '--dir', dir, ...args], {
      encoding: 'utf8',
      cwd: repo,
      env: { ...process.env, CADENCE_GLOBAL_CONFIG: join(tmpdir(), 'cad-deferral-no-global.json') },
    });
  } catch (e) { stdout = e.stdout; code = e.status; }
  return { ...JSON.parse(stdout), _exit: code };
}

test('risk-check status: a `deferral` receipt settles the range it names', () => {
  const { repo, dir, base, head } = deferralRepo();
  const range = ['--phase', '1', '--plan', '1', '--base', base, '--head', head];

  const recorded = plRun(repo, dir, ['risk-check', 'run', ...range]);
  assert.equal(recorded.ok, true, JSON.stringify(recorded));
  assert.ok(recorded.matches.some((m) => m.category === 'secrets'),
    `the fixture range matched no secrets surface: ${JSON.stringify(recorded.matches)}`);

  // Recorded but unfired: the detector ran, nothing says the review did.
  const before = plRun(repo, dir, ['risk-check', 'status', ...range]);
  assert.equal(before.ok, false, JSON.stringify(before));
  assert.equal(before.reason, 'risk-fire-missing');
  assert.equal(before.plans[0].state, 'unfired');

  // The deferring fire's receipt. No `--detail`: a deferral is a review's
  // settled outcome, not a coordinator's say-so, so it needs no reason the way
  // `override` does - it is exactly as joinable as `gate_pass`.
  const receipt = plRun(repo, dir, ['trace', 'append', '--phase', '1',
    '--family', 'outcome', '--event', 'deferral', '--trigger', 'risk_surface',
    '--plan', '1', '--base', base, '--sha', head]);
  assert.equal(receipt.ok, true, JSON.stringify(receipt));

  const after = plRun(repo, dir, ['risk-check', 'status', ...range]);
  assert.equal(after.ok, true, JSON.stringify(after));
  assert.equal(after._exit, 0);
  assert.equal(after.plans[0].state, 'recorded');
});

test('risk-check status: the acceptance is FIRE_RECEIPTS membership, not any outcome event', () => {
  // The negative half, and the falsifier for the row above: an `outcome` event
  // on the same trigger, the same plan and the same range, whose only defect is
  // a name the accepted set does not carry, settles nothing. Drop `deferral`
  // from FIRE_RECEIPTS and the row above answers exactly like this one.
  const { repo, dir, base, head } = deferralRepo();
  const range = ['--phase', '1', '--plan', '1', '--base', base, '--head', head];
  assert.equal(plRun(repo, dir, ['risk-check', 'run', ...range]).ok, true);

  const receipt = plRun(repo, dir, ['trace', 'append', '--phase', '1',
    '--family', 'outcome', '--event', 'deferred', '--trigger', 'risk_surface',
    '--plan', '1', '--base', base, '--sha', head]);
  assert.equal(receipt.ok, true, 'the trace takes any event name - it is the READER that judges');

  const r = plRun(repo, dir, ['risk-check', 'status', ...range]);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'risk-fire-missing');
  assert.equal(r.plans[0].state, 'unfired');
  assert.match(r.hint, /deferral/, 'the hint no longer names the receipt vocabulary it demands');
});

// --- deferred record: the queue member a `deferred` gate leaves (D-01) -------
//
// The I/O half of lib/deferred-queue.mjs, the way the block above is the I/O
// half of lib/adjudication-record.mjs: the grammar is asserted in
// deferred-queue.test.mjs, and what a repository is needed for is asserted
// here - the resolved ids, the refusal to overwrite, where the file lands, and
// that no adjudication record appears beside it.

/** Run the queue seam with cwd INSIDE the repo - `resolveRange` asks git about
 * the cwd, exactly as `adjRun` above needs. */
function defRun(repo, dir, args) {
  let stdout;
  let code = 0;
  try {
    stdout = execFileSync('node', [PLANNING, '--dir', dir, 'deferred', 'record', ...args],
      { encoding: 'utf8', cwd: repo });
  } catch (e) { stdout = e.stdout; code = e.status; }
  return { ...JSON.parse(stdout), _exit: code };
}

/** The reviewer's returned object, which IS this seam's payload. */
const defPayload = (over) => ({
  findings: [{
    file: 'src.js',
    line: 1,
    severity: 'high',
    claim: 'the "x" binding is reassigned, so C:\\tmp is read twice',
    failure_scenario: 'a second reader sees 1 where the first saw 2',
    ...over,
  }],
});

/** Every file under a phase directory, sorted - both stems, so a row can say
 * what did NOT appear as well as what did. */
const phaseFiles = (dir, phase = 2) =>
  readdirSync(join(dir, 'phases', String(phase))).sort();

test('deferred record: the member lands beside the sibling REVIEW discriminator', () => {
  const { repo, dir, baseFull, headFull, base } = adjRepo();
  const payload = adjPayloadFile(repo, defPayload());
  const r = defRun(repo, dir, ['--phase', '2', '--trigger', 'diff',
    '--discriminator', 'plan-1', '--base', base, '--head', 'HEAD', '--payload', payload]);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.record, 'phases/2/DEFERRED-diff-plan-1.json');
  assert.equal(r.round, 1);
  assert.equal(r.findings, 1);

  // NO adjudication record, and not by convention: `RULINGS` is frozen at three
  // and a finding with no ruling is a refusal, so this seam has no way to write
  // one (D-09).
  assert.deepEqual(phaseFiles(dir), ['DEFERRED-diff-plan-1.json']);

  const rec = JSON.parse(readFileSync(join(dir, r.record), 'utf8'));
  assert.equal(rec.trigger, 'diff');
  assert.equal(rec.discriminator, 'plan-1');
  assert.equal(rec.round, 1);
  // RESOLVED ids, never the caller's spelling: the member is read at land time,
  // in another session, where `HEAD` names a different commit.
  assert.equal(rec.base, base);
  assert.equal(rec.head, 'HEAD');
  assert.equal(rec.base_id, baseFull);
  assert.equal(rec.head_id, headFull);
  // VERBATIM, quoting and backslash included - the whole reason the payload is
  // a file. `/cad-milestone` deletes the sibling REVIEW file, so a member that
  // stored a COUNT would name a number nobody could triage.
  assert.deepEqual(rec.findings, defPayload().findings);
});

test('deferred record: a second call refuses instead of overwriting the queue member', () => {
  const { repo, dir, base } = adjRepo();
  const payload = adjPayloadFile(repo, defPayload());
  const args = ['--phase', '2', '--trigger', 'diff', '--discriminator', 'plan-1',
    '--base', base, '--head', 'HEAD', '--payload', payload];
  assert.equal(defRun(repo, dir, args).ok, true);

  const second = defRun(repo, dir, args);
  assert.equal(second.ok, false, JSON.stringify(second));
  assert.equal(second.reason, 'record-exists');
  assert.match(second.hint, /--round 2/);
  // Round 2 lands BESIDE round 1, never on it - the re-arm's member is what the
  // land refusal is still holding.
  const rearm = defRun(repo, dir, [...args, '--round', '2']);
  assert.equal(rearm.ok, true, JSON.stringify(rearm));
  assert.deepEqual(phaseFiles(dir),
    ['DEFERRED-diff-plan-1-r2.json', 'DEFERRED-diff-plan-1.json']);
});

test('deferred record: --trigger and --discriminator are refused by the FILENAME rule', () => {
  // Both reach a filename, and `milestone-prune --label` is the precedent for
  // refusing rather than sanitizing (VAL-01): a sanitized token writes a member
  // under a name the caller did not choose, which is the same class of answer
  // about something nobody asked for.
  const { repo, dir, base } = adjRepo();
  const payload = adjPayloadFile(repo, defPayload());
  for (const [flag, bad] of [['--trigger', '../../etc'], ['--discriminator', '.'],
    ['--trigger', '-rf'], ['--discriminator', 'plan 1']]) {
    const args = { '--trigger': 'diff', '--discriminator': 'plan-1', [flag]: bad };
    const r = defRun(repo, dir, ['--phase', '2',
      '--trigger', args['--trigger'], '--discriminator', args['--discriminator'],
      '--base', base, '--head', 'HEAD', '--payload', payload]);
    assert.equal(r.ok, false, `${flag}=${bad}: ${JSON.stringify(r)}`);
    assert.equal(r.reason, 'bad-args');
    assert.match(r.detail, /reaches a FILENAME/);
    assert.match(r.detail, /letters, digits, _ and -/);
    assert.deepEqual(phaseFiles(dir), [], 'a refused call wrote something anyway');
  }
});

test('deferred record: a malformed finding is refused in buildEntries own words', () => {
  const { repo, dir, base } = adjRepo();
  for (const [over, shape] of [[{ line: 0 }, /\.line must be an integer of at least 1$/],
    [{ nope: true }, /carries an unknown key: nope$/]]) {
    const payload = adjPayloadFile(repo, defPayload(over), `payload-${Object.keys(over)[0]}.json`);
    const r = defRun(repo, dir, ['--phase', '2', '--trigger', 'diff',
      '--discriminator', 'plan-1', '--base', base, '--head', 'HEAD', '--payload', payload]);
    assert.equal(r.ok, false, JSON.stringify(r));
    assert.equal(r.reason, 'bad-payload');
    assert.match(r.detail, shape);
    assert.deepEqual(phaseFiles(dir), []);
  }
});

test('deferred record: an absent phase directory is refused, never minted', () => {
  const { repo, dir, base } = adjRepo();
  const payload = adjPayloadFile(repo, defPayload());
  const r = defRun(repo, dir, ['--phase', '7', '--trigger', 'diff',
    '--discriminator', 'plan-1', '--base', base, '--head', 'HEAD', '--payload', payload]);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'no-phase-dir');
  assert.equal(existsSync(join(dir, 'phases', '7')), false,
    'the seam records a fire that HAPPENED - a mistyped flag must not mint a phase directory');
});

// --- deferred list: what is still queued, across both homes (D-01) ----------
//
// The membership half of the same module. The grammar - what makes a member's
// fields agree with its filename - is asserted in deferred-queue.test.mjs;
// what a filesystem is needed for is asserted here: the supersession test, the
// two homes, and the refusal to call an unreadable queue an empty one.

/** Run the reader. No cwd requirement: it resolves no git range. */
function defList(dir, args = []) {
  let stdout;
  let code = 0;
  try {
    stdout = execFileSync('node', [PLANNING, '--dir', dir, 'deferred', 'list', ...args],
      { encoding: 'utf8' });
  } catch (e) { stdout = e.stdout; code = e.status; }
  return { ...JSON.parse(stdout), _exit: code };
}

test('deferred list: a member is queued until its ADJUDICATION sibling is beside it', () => {
  const { repo, dir, base } = adjRepo();
  const payload = adjPayloadFile(repo, defPayload());
  const fire = ['--phase', '2', '--trigger', 'diff', '--discriminator', 'plan-1',
    '--base', base, '--head', 'HEAD'];
  assert.equal(defRun(repo, dir, [...fire, '--payload', payload]).ok, true);

  const listed = defList(dir);
  assert.equal(listed.ok, true, JSON.stringify(listed));
  assert.deepEqual(listed.members, [{
    phase: '2', trigger: 'diff', discriminator: 'plan-1', round: 1,
    path: 'phases/2/DEFERRED-diff-plan-1.json', findings: 1,
  }], 'a member is named by phase, trigger, discriminator and round, with its own count');
  assert.equal(listed.findings, 1);
  assert.deepEqual(listed.unreadable, []);

  // MEMBERSHIP IS SUPERSESSION, never absence-of-record (D-01): the record for
  // the SAME trigger, discriminator and round, beside it.
  assert.equal(adjRun(repo, dir, [...fire, '--payload', adjPayloadFile(repo, adjPayload(), 'adj.json')]).ok,
    true);
  const settled = defList(dir);
  assert.equal(settled.ok, true, JSON.stringify(settled));
  assert.deepEqual(settled.members, []);
  assert.equal(settled.findings, 0);
});

test('deferred list: a round 2 member is superseded by round 2 and by nothing else', () => {
  // The whole reason the two names share one round rule. A re-arm cleared by
  // round one's record would drop the finding the re-arm was fired over.
  const { repo, dir, base } = adjRepo();
  const payload = adjPayloadFile(repo, defPayload());
  const fire = ['--phase', '2', '--trigger', 'diff', '--discriminator', 'plan-1',
    '--base', base, '--head', 'HEAD'];
  assert.equal(defRun(repo, dir, [...fire, '--payload', payload]).ok, true);
  assert.equal(defRun(repo, dir, [...fire, '--payload', payload, '--round', '2']).ok, true);
  assert.equal(adjRun(repo, dir, [...fire, '--payload', adjPayloadFile(repo, adjPayload(), 'adj.json')]).ok,
    true);

  const listed = defList(dir);
  assert.equal(listed.ok, true, JSON.stringify(listed));
  assert.deepEqual(listed.members.map((m) => m.round), [2],
    'round one settled; round two is still queued');
});

test('deferred list: both homes are read, and --phase narrows to one', () => {
  const { repo, dir, base } = adjRepo();
  const payload = adjPayloadFile(repo, defPayload());
  assert.equal(defRun(repo, dir, ['--phase', '2', '--trigger', 'diff', '--discriminator',
    'plan-1', '--base', base, '--head', 'HEAD', '--payload', payload]).ok, true);
  // The CARRIED home, where a milestone close moves a queue member before the
  // prune deletes its phase directory.
  mkdirSync(join(dir, 'deferred', '3'), { recursive: true });
  writeFileSync(join(dir, 'deferred', '3', 'DEFERRED-plan-plan-1.json'),
    `${JSON.stringify({
      phase: '3', trigger: 'plan', discriminator: 'plan-1', round: 1,
      findings: [defPayload().findings[0], defPayload().findings[0]],
    })}\n`);

  const both = defList(dir);
  assert.equal(both.ok, true, JSON.stringify(both));
  assert.deepEqual(both.members.map((m) => m.path),
    ['deferred/3/DEFERRED-plan-plan-1.json', 'phases/2/DEFERRED-diff-plan-1.json']);
  assert.equal(both.findings, 3, 'the total is summed across homes, not per home');

  const one = defList(dir, ['--phase', '3']);
  assert.equal(one.phase, '3');
  assert.deepEqual(one.members.map((m) => m.phase), ['3']);
  assert.equal(one.findings, 2);
});

test('deferred list: an unreadable directory refuses instead of reporting an empty queue', {
  skip:
    typeof process.getuid === 'function' && process.getuid() === 0
      ? 'root bypasses mode bits'
      : false,
}, () => {
  // An unprovable queue is not an empty one - the disposition `decideGateHalt`
  // already states for a findings payload it could not parse. Reporting zero
  // here is what would let a land publish over a queue it never read.
  const { dir } = adjRepo();
  chmodSync(join(dir, 'phases', '2'), 0o000);
  try {
    const r = defList(dir);
    assert.equal(r.ok, false, JSON.stringify(r));
    assert.equal(r.reason, 'unprovable-queue');
    assert.deepEqual(r.unreadable.map((u) => u.path), ['phases/2']);
    assert.match(r.detail, /cannot be proven empty/);
    assert.equal(r._exit, 1, 'the exit code mirrors ok, so a shell arm can branch on it');
  } finally {
    chmodSync(join(dir, 'phases', '2'), 0o755);
  }
});

test('deferred list: a member that cannot be read lands on the same refusing list', () => {
  const { dir } = adjRepo();
  const pdir = join(dir, 'phases', '2');
  // Three ways a member stops being provable, and none of them is "nothing
  // deferred": bytes that do not parse, fields that spell another filename, and
  // a symlink wearing a member's name.
  writeFileSync(join(pdir, 'DEFERRED-diff-plan-1.json'), '{not json\n');
  writeFileSync(join(pdir, 'DEFERRED-plan-plan-2.json'), `${JSON.stringify({
    phase: '2', trigger: 'diff', discriminator: 'plan-2', round: 1, findings: [],
  })}\n`);
  writeFileSync(join(dir, 'elsewhere.json'), `${JSON.stringify({
    phase: '2', trigger: 'plan', discriminator: 'plan-3', round: 1, findings: [],
  })}\n`);
  symlinkSync(join(dir, 'elsewhere.json'), join(pdir, 'DEFERRED-plan-plan-3.json'));

  const r = defList(dir);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'unprovable-queue');
  assert.deepEqual(r.unreadable.map((u) => u.path), [
    'phases/2/DEFERRED-diff-plan-1.json',
    'phases/2/DEFERRED-plan-plan-2.json',
    'phases/2/DEFERRED-plan-plan-3.json',
  ]);
  assert.match(r.unreadable[1].detail, /its own fields spell DEFERRED-diff-plan-2\.json/,
    'a member whose fields name another fire would be cleared by that fire s record');
  assert.match(r.unreadable[2].detail, /not a regular file/);
  assert.deepEqual(r.members, []);
});

test('deferred list: an ADJUDICATION symlink does not settle a member', () => {
  // `recordForFire`s disposition, held on the read side: a symlink is not a
  // record, and accepting one would let a queue be cleared by a link to
  // anything at all.
  const { repo, dir, base } = adjRepo();
  const payload = adjPayloadFile(repo, defPayload());
  assert.equal(defRun(repo, dir, ['--phase', '2', '--trigger', 'diff', '--discriminator',
    'plan-1', '--base', base, '--head', 'HEAD', '--payload', payload]).ok, true);
  writeFileSync(join(dir, 'anything.json'), '{}\n');
  symlinkSync(join(dir, 'anything.json'),
    join(dir, 'phases', '2', 'ADJUDICATION-diff-plan-1.json'));

  const r = defList(dir);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.members.map((m) => m.path), ['phases/2/DEFERRED-diff-plan-1.json']);
});

test('status: the deferred block is on EVERY envelope, off the same derivation', () => {
  // ALWAYS present, unlike `cycle` and `drift`: this key is read by a refusal
  // surface, and a key absent in the empty state cannot tell "nothing is
  // deferred" from "this seam predates the queue" - which is the fail-open
  // answer on the one gate whose job is to refuse.
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Auth' }], phases: { 1: { plan: true } } });
  const empty = run(['status'], dir);
  assert.equal(empty.ok, true, JSON.stringify(empty));
  assert.deepEqual(empty.deferred, { members: [], findings: 0, unreadable: [] });

  writeFileSync(join(dir, 'phases', '1', 'DEFERRED-diff-plan-1.json'), `${JSON.stringify({
    phase: '1', trigger: 'diff', discriminator: 'plan-1', round: 1,
    findings: [defPayload().findings[0], defPayload().findings[0]],
  })}\n`);
  const queued = run(['status'], dir);
  assert.deepEqual(queued.deferred.members, [{
    phase: '1', trigger: 'diff', discriminator: 'plan-1', round: 1,
    path: 'phases/1/DEFERRED-diff-plan-1.json', findings: 2,
  }]);
  assert.equal(queued.deferred.findings, 2);
  // ONE derivation and one reader, so /cad-progress and /cad-land cannot
  // disagree about what is queued.
  assert.deepEqual(defList(dir).members, queued.deferred.members);

  writeFileSync(join(dir, 'phases', '1', 'ADJUDICATION-diff-plan-1.json'), '{}\n');
  const settled = run(['status'], dir);
  assert.deepEqual(settled.deferred, { members: [], findings: 0, unreadable: [] });
  assert.equal(settled.ok, true, 'a settled queue is not a degraded status');

  // NO cursor status value and no drift kind (D-05): a `Status:` outside AGREE
  // is reported as cursor drift and rewritten by the very next /cad-progress.
  assert.deepEqual(queued.drift, undefined);
});

test('status: an unreadable queue rides the envelope without failing the status', {
  skip:
    typeof process.getuid === 'function' && process.getuid() === 0
      ? 'root bypasses mode bits'
      : false,
}, () => {
  // The status answers about the roadmap; the block carries its own evidence.
  // Degrading the whole envelope would take /cad-progress down over a queue it
  // was only reporting on, and the refusal reads `unreadable` for itself.
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Auth' }], phases: { 1: { plan: true } } });
  chmodSync(join(dir, 'phases', '1'), 0o000);
  try {
    const r = run(['status'], dir);
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual(r.deferred.unreadable.map((u) => u.path), ['phases/1']);
    assert.deepEqual(r.deferred.members, []);
  } finally {
    chmodSync(join(dir, 'phases', '1'), 0o755);
  }
});

// --- deferred carry: the queue OUT of the directory the prune deletes (D-10) -

/** Run the carry face. */
function defCarry(dir, args) {
  let stdout;
  let code = 0;
  try {
    stdout = execFileSync('node', [PLANNING, '--dir', dir, 'deferred', 'carry', ...args],
      { encoding: 'utf8' });
  } catch (e) { stdout = e.stdout; code = e.status; }
  return { ...JSON.parse(stdout), _exit: code };
}

/** Write a queue member straight into `phases/<phase>/`, no repository needed. */
function putMember(dir, phase, trigger, discriminator, round, findings, home = 'phases') {
  const file = join(dir, home, String(phase),
    `DEFERRED-${trigger}-${discriminator}${round > 1 ? `-r${round}` : ''}.json`);
  writeFileSync(file, `${JSON.stringify({
    phase: String(phase), trigger, discriminator, round,
    findings: Array.from({ length: findings }, () => defPayload().findings[0]),
  })}\n`);
  return file;
}

test('deferred carry: the unadjudicated members move, the settled ones are pruned with the phase', () => {
  const { dir } = adjRepo({ phase: 4 });
  putMember(dir, 4, 'diff', 'plan-1', 1, 2);
  putMember(dir, 4, 'plan', 'plan-2', 1, 1);
  writeFileSync(join(dir, 'phases', '4', 'ADJUDICATION-plan-plan-2.json'), '{}\n');

  const r = defCarry(dir, ['--phase', '4']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.carried, 1);
  assert.equal(r.findings, 2);
  assert.deepEqual(r.moved[0].from, 'phases/4/DEFERRED-diff-plan-1.json');
  assert.deepEqual(r.moved[0].to, 'deferred/4/DEFERRED-diff-plan-1.json');
  // A MOVE, never a copy: `--mode archive` would otherwise leave a second copy
  // under `_archive-<label>/` for the same fire.
  assert.equal(existsSync(join(dir, 'phases', '4', 'DEFERRED-diff-plan-1.json')), false);
  // The SETTLED one stays to be pruned with its phase - carrying it would put a
  // cleared finding in front of every later land.
  assert.equal(existsSync(join(dir, 'phases', '4', 'DEFERRED-plan-plan-2.json')), true);

  // The whole point: after the prune, the refusal still has something to read.
  rmSync(join(dir, 'phases', '4'), { recursive: true });
  const listed = defList(dir);
  assert.equal(listed.ok, true, JSON.stringify(listed));
  assert.deepEqual(listed.members.map((m) => m.path), ['deferred/4/DEFERRED-diff-plan-1.json']);
  assert.equal(listed.findings, 2);
});

test('deferred carry: a destination that already exists refuses, and moves NOTHING', () => {
  // All destinations are checked before the first rename, so a collision leaves
  // the queue in one home rather than half in each.
  const { dir } = adjRepo({ phase: 4 });
  putMember(dir, 4, 'diff', 'plan-1', 1, 1);
  assert.equal(defCarry(dir, ['--phase', '4']).ok, true);
  putMember(dir, 4, 'diff', 'plan-1', 1, 1);
  putMember(dir, 4, 'plan', 'plan-9', 1, 1);

  const r = defCarry(dir, ['--phase', '4']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'carry-exists');
  assert.match(r.detail, /deferred\/4\/DEFERRED-diff-plan-1\.json already exists/);
  assert.equal(existsSync(join(dir, 'phases', '4', 'DEFERRED-plan-plan-9.json')), true,
    'the collision moved the OTHER member anyway, splitting one phase queue across two homes');

  // A re-run after the colliding member is cleared finishes the job rather than
  // refusing forever: what is already carried is not re-carried.
  rmSync(join(dir, 'phases', '4', 'DEFERRED-diff-plan-1.json'));
  const again = defCarry(dir, ['--phase', '4']);
  assert.equal(again.ok, true, JSON.stringify(again));
  assert.deepEqual(again.moved.map((m) => m.to), ['deferred/4/DEFERRED-plan-plan-9.json']);
});

test('deferred carry: an unreadable phase refuses BEFORE the prune deletes it', {
  skip:
    typeof process.getuid === 'function' && process.getuid() === 0
      ? 'root bypasses mode bits'
      : false,
}, () => {
  // Sharper than the reader's refusal, and for a sharper reason: this call is
  // the last thing that runs before milestone-prune deletes the directory, so
  // carrying what was provable and saying nothing about the rest would destroy
  // exactly the members it could not read.
  const { dir } = adjRepo({ phase: 4 });
  putMember(dir, 4, 'diff', 'plan-1', 1, 1);
  writeFileSync(join(dir, 'phases', '4', 'DEFERRED-plan-plan-2.json'), '{not json\n');

  const r = defCarry(dir, ['--phase', '4']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'unprovable-queue');
  assert.deepEqual(r.moved, []);
  assert.match(r.hint, /BEFORE milestone-prune/);
  assert.equal(existsSync(join(dir, 'deferred', '4')), false,
    'a refused carry created the destination anyway');
});

test('deferred carry: a symlink squatting the destination is refused, never followed', () => {
  // milestone-prune --mode archive states the same rail for its archive root:
  // renameSync FOLLOWS a symlink, and would deposit committed artifacts
  // wherever it points.
  const { dir } = adjRepo({ phase: 4 });
  putMember(dir, 4, 'diff', 'plan-1', 1, 1);
  mkdirSync(join(dir, 'deferred'), { recursive: true });
  mkdirSync(join(dir, 'elsewhere'));
  symlinkSync(join(dir, 'elsewhere'), join(dir, 'deferred', '4'));

  const r = defCarry(dir, ['--phase', '4']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'carry-dest-unusable');
  assert.match(r.detail, /renameSync would follow out of the planning root/);
  assert.deepEqual(readdirSync(join(dir, 'elsewhere')), []);
});

test('deferred carry: a symlink squatting the PARENT is refused too', () => {
  // The sibling above pins the final component. `lstatSync` does not follow the
  // final component and follows every one before it, so a check aimed at
  // `deferred/<N>` alone answers "absent, go ahead" while `deferred/` is
  // already a link out of the tree - and the mkdir then builds the phase
  // directory THERE and the rename fills it. Two levels down takes two checks.
  const { dir } = adjRepo({ phase: 4 });
  putMember(dir, 4, 'diff', 'plan-1', 1, 1);
  mkdirSync(join(dir, 'elsewhere'));
  symlinkSync(join(dir, 'elsewhere'), join(dir, 'deferred'));

  const r = defCarry(dir, ['--phase', '4']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'carry-dest-unusable');
  assert.match(r.detail, /renameSync would follow out of the planning root/);
  assert.equal(existsSync(join(dir, 'elsewhere', '4')), false,
    'the carry built its destination outside the planning root');
  assert.deepEqual(readdirSync(join(dir, 'elsewhere')), []);
  assert.equal(existsSync(join(dir, 'phases', '4', 'DEFERRED-diff-plan-1.json')), true,
    'the queue member left the phase directory on a refused carry');
});

test('deferred carry: a phase with nothing queued is an answer, not a refusal', () => {
  const { dir } = adjRepo({ phase: 4 });
  const r = defCarry(dir, ['--phase', '4']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(r.moved, []);
  assert.equal(r.carried, 0);
  assert.equal(existsSync(join(dir, 'deferred')), false,
    'an empty carry minted a destination directory nothing accounts for');
});

// --- a carried member stays adjudicable AND re-armable (D-10) ---------------

test('adjudication + deferred record: a carried fire resolves its home in deferred/<N>/', () => {
  // The failure this closes: `deferred carry` moves the member out of
  // `phases/<N>/` so it survives the prune, and both write faces refused on
  // that now-deleted directory - leaving the finding that stops the land
  // permanently unclearable. An unclearable gate is one that gets bypassed.
  const { repo, dir, base } = adjRepo({ phase: 4 });
  putMember(dir, 4, 'diff', 'plan-1', 1, 1);
  assert.equal(defCarry(dir, ['--phase', '4']).ok, true);
  rmSync(join(dir, 'phases', '4'), { recursive: true });
  const fire = ['--phase', '4', '--trigger', 'diff', '--discriminator', 'plan-1',
    '--base', base, '--head', 'HEAD'];

  // The TRIAGE, in a later session, which is the whole point of the carry.
  const ruled = adjRun(repo, dir, [...fire, '--payload', adjPayloadFile(repo, adjPayload())]);
  assert.equal(ruled.ok, true, JSON.stringify(ruled));
  assert.equal(ruled.record, 'deferred/4/ADJUDICATION-diff-plan-1.json',
    'the record must land BESIDE the member it supersedes, or it supersedes nothing');
  assert.deepEqual(defList(dir).members, [], 'the carried member is still queued after its ruling');

  // The RE-ARM, off the same resolver: a triage that rules a blocker/high
  // survived has to record its narrowed round, and a `deferred record` still
  // refusing here would leave the cap reading unspent off a queue that could
  // never gain a round-2 member.
  const rearm = defRun(repo, dir, [...fire, '--round', '2',
    '--payload', adjPayloadFile(repo, defPayload(), 'round2.json')]);
  assert.equal(rearm.ok, true, JSON.stringify(rearm));
  assert.equal(rearm.record, 'deferred/4/DEFERRED-diff-plan-1-r2.json');
  assert.deepEqual(defList(dir).members.map((m) => m.round), [2],
    'round two is queued again; round one stays settled');
});

test('adjudication + deferred record: the live phase directory still wins', () => {
  // ORDER, not either-or. A live phase is where a fire's REVIEW sibling is, and
  // a stale `deferred/<N>/` left by an earlier close must not capture it.
  const { repo, dir, base } = adjRepo({ phase: 4 });
  mkdirSync(join(dir, 'deferred', '4'), { recursive: true });
  const fire = ['--phase', '4', '--trigger', 'diff', '--discriminator', 'plan-1',
    '--base', base, '--head', 'HEAD'];
  assert.equal(defRun(repo, dir, [...fire, '--payload', adjPayloadFile(repo, defPayload())]).record,
    'phases/4/DEFERRED-diff-plan-1.json');
  assert.equal(adjRun(repo, dir, [...fire, '--payload', adjPayloadFile(repo, adjPayload(), 'adj.json')]).record,
    'phases/4/ADJUDICATION-diff-plan-1.json');
});

test('adjudication + deferred record: with NEITHER home present the refusal names both', () => {
  const { repo, dir, base } = adjRepo({ phase: 4 });
  const fire = ['--phase', '9', '--trigger', 'diff', '--discriminator', 'plan-1',
    '--base', base, '--head', 'HEAD'];
  for (const [face, r] of [
    ['adjudication', adjRun(repo, dir, [...fire, '--payload', adjPayloadFile(repo, adjPayload())])],
    ['deferred record', defRun(repo, dir, [...fire, '--payload', adjPayloadFile(repo, defPayload(), 'q.json')])],
  ]) {
    assert.equal(r.ok, false, `${face}: ${JSON.stringify(r)}`);
    assert.equal(r.reason, 'no-phase-dir');
    assert.match(r.detail, /neither phases\/9\/ nor deferred\/9\//, face);
    assert.equal(existsSync(join(dir, 'phases', '9')), false);
    assert.equal(existsSync(join(dir, 'deferred', '9')), false,
      'a mistyped flag minted a home nothing else in the tree accounts for');
  }
});

test('adjudication + deferred record: a symlink at the carried home is refused, never followed', () => {
  // The lstatSync check moved WITH the resolution, so the second home gets the
  // same rail the first has: a symlink there is followed straight out of the
  // planning root by every writer after it.
  const { repo, dir, base } = adjRepo({ phase: 4 });
  rmSync(join(dir, 'phases', '4'), { recursive: true });
  mkdirSync(join(dir, 'deferred'), { recursive: true });
  mkdirSync(join(dir, 'elsewhere'));
  symlinkSync(join(dir, 'elsewhere'), join(dir, 'deferred', '4'));

  const r = adjRun(repo, dir, ['--phase', '4', '--trigger', 'diff', '--discriminator', 'plan-1',
    '--base', base, '--head', 'HEAD', '--payload', adjPayloadFile(repo, adjPayload())]);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'no-phase-dir');
  assert.deepEqual(readdirSync(join(dir, 'elsewhere')), []);
});

// --- cite-count: the read-back count -------------------------------------------

// A dedicated runner, for the same reason `recall` has one: the backend read
// goes through the config layers, so the global layer is pinned off a
// nonexistent path (D-06) or a developer's real ~/.claude/cadence/config.json
// would flip the answer locally while CI stayed green. Returns the parsed JSON
// AND the raw stdout - the determinism case byte-compares the raw string.
function citeCount(args, dir) {
  let raw;
  let code = 0;
  try {
    raw = execFileSync('node', [PLANNING, 'cite-count', ...args, '--dir', dir], {
      encoding: 'utf8',
      env: { ...process.env, CADENCE_GLOBAL_CONFIG: join(tmpdir(), 'cad-no-such-global.json') },
    });
  } catch (e) { raw = e.stdout; code = e.status; }
  return { json: JSON.parse(raw), raw, _exit: code };
}

/**
 * The surfaced set as a FILE beside the fixture (D-03). Never inline JSON: the
 * envelope carries verbatim artifact prose with arbitrary quoting.
 */
function citePayload(dir, results, name = 'payload.json') {
  const file = join(dir, name);
  // `total` is deliberately larger than `results.length` everywhere below - the
  // count reads the BOUNDED results and never `total` (D-11).
  writeFileSync(file, JSON.stringify({ total: 441, results }));
  return file;
}

/** A plan BODY: makeTree writes `# Plan <n>`, and a citation is prose (D-09). */
function citePlanBody(dir, n, file, body) {
  writeFileSync(join(dir, 'phases', String(n), file), body);
}

/**
 * The fixture every case below shares: phase 2, one plan citing a BARE `D-03`
 * and a phase-QUALIFIED `phase 7 D-05`. Every tree is scratch; nothing here
 * reaches this repository's own .planning.
 */
function citeTree() {
  const dir = makeTree({ phases: { 2: { plan: ['PLAN-1.md'] } } });
  citePlanBody(dir, 2, 'PLAN-1.md',
    '# Plan\n\n## Context\n\nThis plan carries D-03 forward unchanged, and it holds '
    + 'the boundary phase 7 D-05 drew.\n');
  return dir;
}

test('cite-count: the envelope names both sides per item, with the unjoinable arms marked', () => {
  const dir = citeTree();
  const payload = citePayload(dir, [
    // Cited: a bare mention scopes to the plan's own phase 2, and this archived
    // row's source phase IS 2 - the locked consequence of D-04 plus D-10.
    { score: 9, source: 'v3.5.3/phases/2/CONTEXT.md', snippet: 'D-03 (area): the archived one' },
    // Cited: `phase 7 D-05` scopes to 7 and this row's source phase is 7.
    { score: 8, source: 'phases/7/CONTEXT.md', snippet: 'D-05 (area): the qualified one' },
    // Surfaced and NOT cited - the case the whole phase exists to make visible.
    { score: 7, source: 'phases/1/CONTEXT.md', snippet: 'D-09 (area): nobody cited this' },
    { score: 6, source: 'phases/1/CAPTURE.md', snippet: 'a capture row carries no id' },
    { score: 5, source: 'phases/3/SUMMARY.md', snippet: 'a deviation carries no id either' },
    { score: 4, source: 'phases/3/UAT.md', snippet: 'a uat finding' },
  ]);
  const r = citeCount(['--phase', '2', '--payload', payload], dir);
  assert.equal(r.json.ok, true, r.raw);
  assert.equal(r._exit, 0);
  assert.equal(r.json.phase, 2);
  assert.deepEqual(r.json.plans, ['PLAN-1.md']);

  // The BOUNDED results, never `total` (D-11): six rows surfaced against a
  // payload claiming 441 matched.
  assert.equal(r.json.surfaced.count, 6);
  assert.deepEqual(r.json.surfaced.ids, [
    'v3.5.3/phases/2/CONTEXT.md#D-03',
    'phases/7/CONTEXT.md#D-05',
    'phases/1/CONTEXT.md#D-09',
  ], 'only a CONTEXT decision carries an id (D-02); the other three arms have none');

  // An explicit LIST and never a number alone (AC1), and a subset of the ids
  // above - a cited id nothing surfaced would be an answer about another tree.
  assert.deepEqual(r.json.cited.ids,
    ['v3.5.3/phases/2/CONTEXT.md#D-03', 'phases/7/CONTEXT.md#D-05']);
  assert.equal(r.json.cited.count, 2);
  for (const id of r.json.cited.ids) assert.ok(r.json.surfaced.ids.includes(id), id);

  // All four arms ALWAYS, and the three that carry no identifier read as
  // UNJOINABLE rather than as `cited: 0` - a plan that ignored them and a plan
  // nothing could tell about are different answers (D-02).
  assert.deepEqual(r.json.cited_by_kind.decision, { surfaced: 3, cited: 2 });
  assert.deepEqual(r.json.cited_by_kind.capture, { surfaced: 1, unjoinable: true });
  assert.deepEqual(r.json.cited_by_kind.deviation, { surfaced: 1, unjoinable: true });
  assert.deepEqual(r.json.cited_by_kind.uat, { surfaced: 1, unjoinable: true });
  for (const arm of ['capture', 'deviation', 'uat']) {
    assert.equal('cited' in r.json.cited_by_kind[arm], false,
      `${arm} reports unjoinable, never a zero a later gate would threshold against`);
  }

  // The arms reconcile with the headline: a row counted in `surfaced` and in no
  // arm would make the breakdown stop adding up.
  const armed = Object.values(r.json.cited_by_kind).reduce((a, k) => a + k.surfaced, 0);
  assert.equal(armed, r.json.surfaced.count);
});

test('cite-count: the queried phase\'s own rows are dropped and archived same-numbered ones are kept', () => {
  // BOTH directions on ONE payload, so a rule that dropped both or kept both
  // fails here: the plan trivially cites its own CONTEXT (D-04), and an
  // archived phase 2 is a PRIOR phase 2 that the goal is asking about.
  const dir = citeTree();
  const payload = citePayload(dir, [
    { score: 9, source: 'phases/2/CONTEXT.md', snippet: 'D-03 (area): the phase\'s own' },
    { score: 8, source: '_archive-v3.5.0/2/CONTEXT.md', snippet: 'D-03 (area): a retired cycle' },
    { score: 7, source: 'v3.5.3/phases/2/CONTEXT.md', snippet: 'D-03 (area): an ARCHIVE.md row' },
  ]);
  const r = citeCount(['--phase', '2', '--payload', payload], dir);
  assert.equal(r.json.ok, true, r.raw);
  assert.equal(r.json.surfaced.count, 2);
  assert.deepEqual(r.json.surfaced.ids, [
    '_archive-v3.5.0/2/CONTEXT.md#D-03',
    'v3.5.3/phases/2/CONTEXT.md#D-03',
  ]);
  for (const id of r.json.surfaced.ids) {
    assert.equal(id.startsWith('phases/2/'), false, id);
  }
});

test('cite-count: two runs over an unchanged plan and payload are byte-identical', () => {
  const dir = citeTree();
  const payload = citePayload(dir, [
    { score: 9, source: 'v3.5.3/phases/2/CONTEXT.md', snippet: 'D-03 (area): cited' },
    { score: 8, source: 'phases/1/CAPTURE.md', snippet: 'a capture row' },
  ]);
  const a = citeCount(['--phase', '2', '--payload', payload], dir);
  const b = citeCount(['--phase', '2', '--payload', payload], dir);
  assert.equal(a.raw, b.raw);
  assert.equal(a.json.ok, true, a.raw);
});

test('cite-count: the run records no lifecycle/dispatch - it is a reader, not a subagent', () => {
  const dir = citeTree();
  const payload = citePayload(dir, [
    { score: 9, source: 'phases/1/CONTEXT.md', snippet: 'D-01 (area): uncited' },
  ]);
  // Seeded with an unrelated event so an EMPTY file cannot pass this vacuously.
  const trace = join(dir, 'trace.jsonl');
  writeFileSync(trace,
    '{"corr":"2-abc","phase":2,"family":"lifecycle","event":"phase_start"}\n');
  const r = citeCount(['--phase', '2', '--payload', payload], dir);
  assert.equal(r.json.ok, true, r.raw);
  const events = readFileSync(trace, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  assert.ok(events.length >= 1, 'the seeded anchor is still there');
  assert.deepEqual(events.filter((e) => e.family === 'lifecycle' && e.event === 'dispatch'), [],
    'the count is a deterministic read; a dispatch here would mean a model was asked');
});

test('cite-count: memory.backend none is a third state, and needs no payload', () => {
  // The off arm has to be CONSTRUCTED (D-06): this repository sets no
  // memory.backend and runs the `builtin` default, so nothing dogfoods it.
  const off = makeTree({ phases: { 2: { plan: ['PLAN-1.md'] } }, config: { memory: { backend: 'none' } } });
  const r = citeCount(['--phase', '2'], off);
  assert.equal(r.json.ok, true, r.raw);
  assert.equal(r._exit, 0);
  assert.equal(r.json.backend, 'none');
  assert.equal(r.json.surfaced.count, 0);

  // State two: a live backend that surfaced nothing. Separable from the above
  // by the ABSENT `backend` field alone, which is why it is omitted rather than
  // spelled `builtin`.
  const live = citeTree();
  const empty = citeCount(['--phase', '2', '--payload', citePayload(live, [])], live);
  assert.equal(empty.json.ok, true, empty.raw);
  assert.equal(empty.json.backend, undefined);
  assert.equal(empty.json.surfaced.count, 0);

  // And on a live backend the payload is REQUIRED, not defaulted to empty -
  // otherwise state two would swallow a caller that simply forgot the file.
  const missing = citeCount(['--phase', '2'], live);
  assert.equal(missing.json.ok, false);
  assert.equal(missing.json.reason, 'bad-args');
  assert.match(missing.json.detail, /--payload/);
  assert.equal(missing._exit, 1);
});

test('cite-count: the count records itself, under the phase\'s own correlation id', () => {
  // The seam appends its own `outcome` event rather than leaving /cad-plan to
  // issue a `trace append` and retype both figures onto flags (D-08), so the
  // legitimate-zero rate is readable across phases and not only in the session
  // that produced it. Anchored first: `correlationId` derives `<phase>-<sha>`
  // from the newest lifecycle/phase_start for that phase, so without an anchor
  // the id would take the phase-only form and prove nothing about joining.
  const dir = citeTree();
  const trace = join(dir, 'trace.jsonl');
  writeFileSync(trace,
    '{"corr":"2-deadbee","phase":2,"ts":"2026-08-23T00:00:00.000Z",'
    + '"family":"lifecycle","event":"phase_start","sha":"deadbee"}\n');
  const payload = citePayload(dir, [
    { score: 9, source: 'v3.5.3/phases/2/CONTEXT.md', snippet: 'D-03 (area): cited' },
    { score: 8, source: 'phases/1/CONTEXT.md', snippet: 'D-09 (area): uncited' },
    { score: 7, source: 'phases/1/CAPTURE.md', snippet: 'a capture row' },
  ]);
  const r = citeCount(['--phase', '2', '--point', 'planned', '--payload', payload], dir);
  assert.equal(r.json.ok, true, r.raw);
  assert.deepEqual(r.json.trace, { written: true }, 'no reason where the append succeeded');

  const lines = readFileSync(trace, 'utf8').split('\n').filter(Boolean);
  assert.equal(lines.length, 2, 'the anchor plus exactly one appended event');
  const e = JSON.parse(lines[1]);
  assert.equal(e.family, 'outcome', 'outcome is one of FAMILIES, so renderTrace counts it');
  assert.equal(e.event, 'cite_count');
  assert.equal(e.corr, '2-deadbee', 'joined to the phase, not minted');
  assert.equal(e.phase, '2', "the caller's OWN spelling, verbatim");
  assert.equal(e.point, 'planned');

  // BOTH figures with their id lists and the breakdown, so the record answers
  // the same question the envelope does with no join back to a session.
  assert.deepEqual(e.surfaced, r.json.surfaced);
  assert.deepEqual(e.cited, r.json.cited);
  assert.deepEqual(e.cited_by_kind, r.json.cited_by_kind);
  assert.equal(e.surfaced.count, 3);
  assert.equal(e.cited.count, 1);

  // It opens no bracket and bills no worker: a `role` or a `tokens` here would
  // render a nameless worker and claim a cost this seam never paid.
  assert.equal('role' in e, false);
  assert.equal('tokens' in e, false);
  assert.equal('turns' in e, false);
});

test('cite-count: a trace at the cap comes back written:false, and moves no figure', () => {
  // D-15: `.planning/trace.jsonl` is gitignored, unpruned and bounded at
  // MAX_TRACE_BYTES, `appendEvent` stats BEFORE it writes, and the envelope's
  // `trace` field is the only place a caller could learn the figures were
  // dropped. A record of a decision may not change the decision, so every
  // other field must be byte-identical to the same run with no trace at all.
  const capped = citeTree();
  const clean = citeTree();
  const rows = [
    { score: 9, source: 'v3.5.3/phases/2/CONTEXT.md', snippet: 'D-03 (area): cited' },
    { score: 8, source: 'phases/1/CAPTURE.md', snippet: 'a capture row' },
  ];
  writeFileSync(join(capped, 'trace.jsonl'), 'x'.repeat(1048576));

  const a = citeCount(['--phase', '2', '--payload', citePayload(capped, rows)], capped);
  const b = citeCount(['--phase', '2', '--payload', citePayload(clean, rows)], clean);
  assert.deepEqual(a.json.trace, { written: false, reason: 'size-cap' });
  assert.deepEqual(b.json.trace, { written: true });
  assert.equal(a._exit, 0, 'a dropped record is not a refusal');

  const strip = (j) => { const { trace, ...rest } = j; return rest; };
  assert.deepEqual(strip(a.json), strip(b.json),
    'the verdict and both figures are identical whether or not the record landed');

  // And nothing was appended: the cap is enforced in FRONT of the write.
  assert.equal(readFileSync(join(capped, 'trace.jsonl'), 'utf8').length, 1048576);
});

test('cite-count: three runs are told apart by their records alone', () => {
  // The whole point of D-06 in ONE test. Two of these three states count ZERO
  // surfaced rows, so a reader with only a count in front of them cannot tell
  // a memory backend that was switched off from a search that found nothing -
  // and the legitimate-zero rate this seam exists to produce is measured
  // against exactly that difference. All three are CONSTRUCTED here rather
  // than sampled: this repository sets no `memory.backend` and runs the
  // `builtin` default, so its own dogfooding never reaches the off arm.
  //
  // The assertion reads the RECORD - the appended trace.jsonl line - and not
  // the envelope alone, because "measurable across phases" is a claim about
  // the record, and the separation has to hold for a reader who was not in the
  // session that produced it.
  const record = (dir) => {
    const lines = readFileSync(join(dir, 'trace.jsonl'), 'utf8').split('\n').filter(Boolean);
    assert.equal(lines.length, 1, 'exactly one cite_count event was appended');
    // `corr` and `ts` are the two fields that differ between any two runs
    // whatever their state, so they are dropped: leaving them in would make
    // every pair below trivially distinct and the check would prove nothing.
    const { corr, ts, ...state } = JSON.parse(lines[0]);
    return state;
  };

  // State one: the backend is off. No payload is passed, because on that path
  // `workflows/plan.md` never makes the call that would produce one.
  const offTree = makeTree({
    phases: { 2: { plan: ['PLAN-1.md'] } },
    config: { memory: { backend: 'none' } },
  });
  const offRun = citeCount(['--phase', '2', '--point', 'planned'], offTree);
  assert.equal(offRun.json.ok, true, offRun.raw);

  // State two: a live backend that surfaced nothing.
  const emptyTree = citeTree();
  const emptyRun = citeCount(
    ['--phase', '2', '--point', 'planned', '--payload', citePayload(emptyTree, [])], emptyTree);
  assert.equal(emptyRun.json.ok, true, emptyRun.raw);

  // State three: a live backend that surfaced rows the plan cites none of.
  // citeTree's plan cites a bare `D-03` and a qualified `phase 7 D-05`, so
  // neither row below can match.
  const zeroTree = citeTree();
  const zeroRun = citeCount(['--phase', '2', '--point', 'planned', '--payload', citePayload(zeroTree, [
    { score: 9, source: 'phases/1/CONTEXT.md', snippet: 'D-09 (area): nobody cited this' },
    { score: 8, source: 'phases/1/CAPTURE.md', snippet: 'a capture row carries no id' },
  ])], zeroTree);
  assert.equal(zeroRun.json.ok, true, zeroRun.raw);

  const off = record(offTree);
  const empty = record(emptyTree);
  const zero = record(zeroTree);

  // The premise, asserted rather than assumed: the first two records carry the
  // SAME count, so whatever separates them is not the number.
  assert.equal(off.surfaced.count, empty.surfaced.count,
    'both states count zero surfaced rows - a count alone cannot be what tells them apart');

  // PAIRWISE, and first: a change that collapsed any one state into another
  // has to fail HERE, naming the two that merged, rather than passing three
  // single-run assertions that each look at one record and never compare them.
  const states = [
    ['backend-off', off],
    ['surfaced-nothing', empty],
    ['surfaced-some-cited-none', zero],
  ];
  for (let i = 0; i < states.length; i++) {
    for (let j = i + 1; j < states.length; j++) {
      assert.notDeepStrictEqual(states[i][1], states[j][1],
        `the ${states[i][0]} run and the ${states[j][0]} run are INDISTINGUISHABLE on the `
        + 'record: their appended events carry the same combination of fields, so a reader '
        + 'who was not in the session cannot tell which of the two states produced it');
    }
  }

  // And what each record says, so the pairwise result above is three known
  // states and not three arbitrary ones. No field exists here that the three
  // do not already differ by - a fourth marker would give one fact a second
  // source, and the two would disagree the first time one of them moved.
  assert.equal(off.backend, 'none');
  assert.equal(off.cited.count, 0);
  assert.equal('backend' in empty, false,
    'an ABSENT backend field is what says the count ran against a live one');
  assert.equal(empty.surfaced.count, 0);
  assert.equal('backend' in zero, false);
  assert.equal(zero.surfaced.count, 2);
  assert.deepEqual(zero.cited, { count: 0, ids: [] },
    'the case the phase exists to make visible: surfaced rows, cited by nothing');
});

// --- task-record: the artifact a `/cad-task` run leaves (FST-01) -------------
//
// Every row builds its OWN scratch repository and runs the seam with that
// repository as the child's cwd, because `resolveRange` asks git for
// `--show-toplevel` from where it stands - a row that ran from this repository's
// own tree would be asserting about Cadence's history rather than a fixture's.

/**
 * A scratch git repository holding `commits`, each a `{file, text, subject}`,
 * plus a `.planning` directory unless `planning` is false. Returns
 * `{root, dir, shas}` - `shas` in the order the commits were made.
 */
export function taskRepo(commits, { planning = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cad-task-record-'));
  const git = (...args) => execFileSync('git', ['-C', root, ...args],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: GIT_FIXTURE_ENV }).trim();
  git('init', '-q');
  git('commit', '--allow-empty', '-q', '-m', 'root');
  const shas = [];
  for (const c of commits) {
    writeFileSync(join(root, c.file), c.text);
    git('add', c.file);
    git('commit', '-q', '-m', c.subject);
    shas.push(git('rev-parse', 'HEAD'));
  }
  const dir = join(root, '.planning');
  if (planning) mkdirSync(dir, { recursive: true });
  return { root, dir, shas };
}

/** planning.mjs, run FROM `root` so the seam's git reads resolve there. */
export function runIn(root, args, dir) {
  let stdout;
  let code = 0;
  try {
    stdout = execFileSync('node', [PLANNING, ...args, '--dir', dir],
      { encoding: 'utf8', cwd: root, env: GIT_FIXTURE_ENV });
  } catch (e) {
    stdout = e.stdout; code = e.status;
  }
  return { ...JSON.parse(stdout), _exit: code };
}

export const TASK_COMMITS = [
  { file: 'alpha.txt', text: 'a\n', subject: 'feat: the first thing' },
  { file: 'beta.txt', text: 'b\n', subject: 'fix: the second | thing' },
];

test('task-record: writes the record, with the range\'s own commits and files', () => {
  const { root, dir, shas } = taskRepo(TASK_COMMITS);
  const r = runIn(root, ['task-record', '--slug', 'bound-plan-size',
    '--base', `${shas[0]}^`, '--head', shas[1], '--text', 'What this task shipped.'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.written, true);
  assert.equal(r.commits, 2);
  assert.equal(r.files, 2);
  assert.equal(r.trace.written, true);

  const file = join(dir, 'tasks', 'bound-plan-size', 'RECORD.md');
  assert.equal(r.record, file);
  const text = readFileSync(file, 'utf8');
  // EXACTLY the range's commits, in range order, at full width - `HEX` refuses
  // a non-hexadecimal cell and `shaMatches` prefix-matches, so the widest
  // spelling is the one that joins to every abbreviation.
  assert.deepEqual([...text.matchAll(/^\| 1 \| ([0-9a-f]{40}) \|/gm)].map((m) => m[1]), shas);
  // And exactly the paths it touched. The `|` in the second subject is escaped
  // rather than splitting the row, which would attach its tail to no commit.
  assert.match(text, /^- \*\*Files:\*\* alpha\.txt, beta\.txt$/m);
  assert.match(text, /fix: the second \\\| thing/);
  assert.match(text, /^- What this task shipped\.$/m);
});

test('task-record: a second identical run leaves the file byte-identical', () => {
  // The record is DERIVED from the range and the text, so a re-run rewrites the
  // same bytes rather than accumulating - no Date and no randomness anywhere in
  // the renderer.
  const { root, dir, shas } = taskRepo(TASK_COMMITS);
  const args = ['task-record', '--slug', 'again', '--base', `${shas[0]}^`,
    '--head', shas[1], '--text', 'Ran twice.'];
  const first = runIn(root, args, dir);
  const file = join(dir, 'tasks', 'again', 'RECORD.md');
  const before = readFileSync(file, 'utf8');
  const second = runIn(root, args, dir);
  assert.equal(readFileSync(file, 'utf8'), before);
  // And the envelope too: only the appended trace LINE differs between runs.
  assert.deepEqual(second, first);
});

test('task-record: no planning root means nothing is created and written:false says why', () => {
  const { root, dir, shas } = taskRepo(TASK_COMMITS, { planning: false });
  const r = runIn(root, ['task-record', '--slug', 'no-root', '--base', `${shas[0]}^`,
    '--head', shas[1], '--text', 'Nothing to write into.'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.written, false);
  assert.match(r.reason, /no planning root/);
  // NEITHER the root NOR tasks/: the fast path's guarantee is that it scaffolds
  // nothing where nothing exists.
  assert.equal(existsSync(dir), false);
  assert.equal(existsSync(join(root, 'tasks')), false);
});

test('task-record: a slug that is not one path segment is refused, nothing written', () => {
  const { root, dir, shas } = taskRepo(TASK_COMMITS);
  for (const slug of ['../escape', 'a/b', '/abs', 'Upper', '']) {
    const r = runIn(root, ['task-record', '--slug', slug, '--base', `${shas[0]}^`,
      '--head', shas[1], '--text', 'x'], dir);
    assert.equal(r.ok, false, `--slug ${JSON.stringify(slug)} was not refused`);
    assert.equal(r.reason, 'bad-args');
    assert.equal(r._exit, 1);
  }
  // Not one file anywhere under the planning root, and no escape above it.
  assert.equal(existsSync(join(dir, 'tasks')), false);
  assert.equal(existsSync(join(root, 'escape')), false);
  assert.equal(existsSync(join(dirname(root), 'escape')), false);
});

test('task-record: a tasks/<slug> that is a symlink OUT is refused, nothing written', () => {
  // The slug is a legal one path segment, so `isTaskSlug` passes it - lexical
  // validation cannot see a link that already exists on disk. A cloned planning
  // tree ships symlinks, `mkdirSync(recursive)` follows one without complaint,
  // and `atomicWrite` lstats its own TEMP path so it refuses a symlinked
  // destination FILE and is silent about a symlinked parent DIRECTORY. Without
  // the writer's containment check this writes RECORD.md into `outside`.
  const { root, dir, shas } = taskRepo(TASK_COMMITS);
  const outside = mkdtempSync(join(tmpdir(), 'cad-task-outside-'));
  mkdirSync(join(dir, 'tasks'), { recursive: true });
  symlinkSync(outside, join(dir, 'tasks', 'escaped'));
  const r = runIn(root, ['task-record', '--slug', 'escaped', '--base', `${shas[0]}^`,
    '--head', shas[1], '--text', 'x'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-record');
  assert.match(r.detail, /resolves outside/);
  assert.equal(r.written, false);
  // The point of the row: nothing landed in the tree the link pointed at.
  assert.equal(existsSync(join(outside, 'RECORD.md')), false);
});

test('task-record: a --base that does not resolve is ok:false with nothing written', () => {
  const { root, dir, shas } = taskRepo(TASK_COMMITS);
  const r = runIn(root, ['task-record', '--slug', 'unresolvable',
    '--base', 'no-such-ref-anywhere', '--head', shas[1], '--text', 'x'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-range');
  assert.equal(r.written, false);
  assert.equal(r._exit, 1);
  assert.equal(existsSync(join(dir, 'tasks')), false);
  // The attempt is still ON THE RECORD - `cmdRiskCheckRun`'s rule, so a refusal
  // does not read like a run that never happened.
  const events = readFileSync(join(dir, 'trace.jsonl'), 'utf8').trim().split('\n')
    .map((l) => JSON.parse(l));
  assert.equal(events.length, 1);
  assert.equal(events[0].event, 'task_record');
  assert.equal(events[0].phase, 0);
  assert.equal(events[0].written, false);
  assert.equal(events[0].base_id, null);
  // No role and no tokens: it opens no bracket and bills no worker.
  assert.equal('role' in events[0], false);
  assert.equal('tokens' in events[0], false);
});

test('task-record: --text and --text-file together are refused, and neither is guessed', () => {
  const { root, dir, shas } = taskRepo(TASK_COMMITS);
  const textFile = join(root, 'shipped.md');
  writeFileSync(textFile, 'From a file.\n');
  const both = runIn(root, ['task-record', '--slug', 'both', '--base', `${shas[0]}^`,
    '--head', shas[1], '--text', 'inline', '--text-file', textFile], dir);
  assert.equal(both.ok, false);
  assert.equal(both.reason, 'bad-args');
  assert.equal(existsSync(join(dir, 'tasks')), false);

  const viaFile = runIn(root, ['task-record', '--slug', 'viafile', '--base', `${shas[0]}^`,
    '--head', shas[1], '--text-file', textFile], dir);
  assert.equal(viaFile.ok, true);
  assert.match(readFileSync(join(dir, 'tasks', 'viafile', 'RECORD.md'), 'utf8'),
    /^- From a file\.$/m);
});
