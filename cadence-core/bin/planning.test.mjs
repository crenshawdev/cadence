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

// --- renumber ------------------------------------------------------------------

function renumberTree() {
  return makeTree({
    roadmap: [{ n: 1, name: 'One' }, { n: 2, name: 'Two' }, { n: 3, name: 'Three' }],
    phases: { 1: { plan: true }, 2: { plan: true }, 3: { plan: true } },
    reqs: [['REQ-1', 1, 'Pending'], ['REQ-2', 2, 'Pending'], ['REQ-3', 3, 'Pending']],
    cursor: { phase: 2, total: 3, name: 'Two', status: 'planned', next: '/cad-execute 2', updated: '2026-01-01' },
  });
}

test('renumber insert --dry-run: full op plan, nothing touched', () => {
  const dir = renumberTree();
  const before = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  const r = run(['renumber', 'insert', '--at', '2', '--dry-run'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.dry_run, true);
  // dirs 3 then 2 move up, high-to-low (collision-safe)
  assert.deepEqual(r.ops[0], { git_mv: ['phases/3', 'phases/4'] });
  assert.deepEqual(r.ops[1], { git_mv: ['phases/2', 'phases/3'] });
  assert.match(r.slot, /Phase 2/);
  assert.equal(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), before);
  assert.ok(readdirSync(join(dir, 'phases')).includes('2'));
});

test('renumber insert: shifts dirs, tokens, traceability, and cursor', () => {
  const dir = renumberTree();
  const r = run(['renumber', 'insert', '--at', '2'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(readdirSync(join(dir, 'phases')).sort(), ['1', '3', '4']); // 2 is the open slot
  const roadmap = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  assert.match(roadmap, /- \[ \] \*\*Phase 3: Two\*\*/);
  assert.match(roadmap, /- \[ \] \*\*Phase 4: Three\*\*/);
  assert.match(roadmap, /### Phase 4: Three/);
  assert.match(roadmap, /\*\*Depends on:\*\* Phase 3/); // Three's dependency followed the shift
  const reqs = readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8');
  assert.match(reqs, /REQ-2 \| Phase 3 \|/);
  assert.match(reqs, /REQ-1 \| Phase 1 \|/); // below the insertion point - untouched
  const cursor = run(['cursor', 'get'], dir);
  assert.equal(cursor.phase, 3); // was 2, shifted with its phase
  assert.equal(cursor.total, 4);
});

test('renumber remove: cuts line + detail, orphans reqs, shifts down, reports prose refs', () => {
  const dir = renumberTree();
  const r = run(['renumber', 'remove', '--n', '2'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.orphaned_reqs, ['REQ-2']);
  assert.deepEqual(readdirSync(join(dir, 'phases')).sort(), ['1', '2']); // 3 became 2
  const roadmap = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  assert.doesNotMatch(roadmap, /Phase \d+: Two/); // list line and detail section gone
  assert.match(roadmap, /- \[ \] \*\*Phase 2: Three\*\*/);
  const reqs = readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8');
  assert.match(reqs, /REQ-2 \|  \|/);            // orphaned: phase cell blanked
  assert.match(reqs, /REQ-3 \| Phase 2 \|/);      // shifted down
  const cursor = run(['cursor', 'get'], dir);
  assert.equal(cursor.total, 2);
  assert.ok(r.warn && /removed phase 2/.test(r.warn)); // cursor pointed at the removed phase
});

test('renumber insert at total+1 appends: nothing shifts, only the slot opens', () => {
  const dir = renumberTree();
  const r = run(['renumber', 'insert', '--at', '4'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.ops.some((o) => o.git_mv), false); // no dir ever moves
  assert.match(r.slot, /Phase 4/);
  assert.deepEqual(readdirSync(join(dir, 'phases')).sort(), ['1', '2', '3']);
  assert.match(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), /- \[ \] \*\*Phase 3: Three\*\*/);
  const cursor = run(['cursor', 'get'], dir);
  assert.equal(cursor.phase, 2); // below the insertion point - untouched
  assert.equal(cursor.total, 4); // but the denominator grew
});

// --- renumber vs CONTEXT acceptance-criteria ids: a NON-event ----------------
// What these pin is that NOTHING happens. cmdRenumber's computed edits are
// ROADMAP/REQUIREMENTS/STATE only, and phase dirs move whole via gitMv with
// their contents never rewritten - so `shiftPhaseTokens` never reaches a
// CONTEXT.md, and a `Phase 2` token INSIDE the fixture proves it (drop that
// token and the byte assertion passes vacuously). The only way to fail these is
// for a criterion id to embed the phase number, which is exactly what D-02
// forbids: an id that renumbers under the user is worse than no id at all.
//
// Falsification is a mutation of the CODE, not the fixture: add
// `phases/<n>/CONTEXT.md` to the files cmdRenumber shifts tokens over and both
// tests fail. "Rewrite one fixture id to P2-AC1 and watch it fail" proves
// nothing - it moves the expected and the actual bytes together.

const CRITERIA_CONTEXT = '# Phase 2: Two - Context\n\n' +
  'Gathered: 2026-01-01\nFeeds: /cad-plan 2\n\n' +
  '## Scope boundary\n\nIn: the work Phase 2 delivers\n\n' +
  '## Acceptance criteria\n\n' +
  '- [ ] AC1: the first observable behavior\n' +
  '- [ ] AC2: the second observable behavior\n' +
  '- [ ] AC3: the third observable behavior\n';

/** renumberTree plus a real criteria section (and a `Phase 2` token) in phase 2. */
function criteriaRenumberTree() {
  const dir = renumberTree();
  writeFileSync(join(dir, 'phases', '2', 'CONTEXT.md'), CRITERIA_CONTEXT);
  return dir;
}

test('renumber insert: an existing phase CONTEXT keeps its AC ids byte-identical (D-02)', () => {
  const dir = criteriaRenumberTree();
  const r = run(['renumber', 'insert', '--at', '2'], dir);
  assert.equal(r.ok, true);
  // phases/2 moved to phases/3; its bytes did not change, `Phase 2` included.
  const moved = readFileSync(join(dir, 'phases', '3', 'CONTEXT.md'), 'utf8');
  assert.equal(moved, CRITERIA_CONTEXT);
  // Hardcoded, NOT re-derived from the same file, so the assertion still fails
  // if the grammar itself is deleted.
  assert.deepEqual(classifyAcceptanceCriteria(moved).criteria.map((c) => c.id),
    ['AC1', 'AC2', 'AC3']);
});

test('renumber remove: the shift DOWN leaves an existing phase CONTEXT byte-identical too', () => {
  const dir = criteriaRenumberTree();
  const r = run(['renumber', 'remove', '--n', '1'], dir);
  assert.equal(r.ok, true);
  // phases/2 moved down to phases/1; same bytes, same ids.
  const moved = readFileSync(join(dir, 'phases', '1', 'CONTEXT.md'), 'utf8');
  assert.equal(moved, CRITERIA_CONTEXT);
  assert.deepEqual(classifyAcceptanceCriteria(moved).criteria.map((c) => c.id),
    ['AC1', 'AC2', 'AC3']);
});

test('renumber insert: integer dirs shift even when a decimal phase is highest (#36)', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }, { n: 2, name: 'Two' }, { n: 2.1, name: 'Patch' }],
    phases: { 1: { plan: true }, 2: { plan: true }, '2.1': { plan: true } },
  });
  const r = run(['renumber', 'insert', '--at', '1'], dir);
  assert.equal(r.ok, true);
  // integers shift up (1->2, 2->3); the decimal dir NEVER moves
  assert.deepEqual(readdirSync(join(dir, 'phases')).sort(), ['2', '2.1', '3']);
  const roadmap = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  assert.match(roadmap, /\*\*Phase 2: One\*\*/);
  assert.match(roadmap, /\*\*Phase 3: Two\*\*/);
  assert.match(roadmap, /\*\*Phase 2\.1: Patch\*\*/); // decimal token untouched
});

test('renumber remove: dirs shift DOWN low-to-high (collision-safe order)', () => {
  const dir = renumberTree();
  const plan = run(['renumber', 'remove', '--n', '1', '--dry-run'], dir);
  assert.deepEqual(plan.ops[0], { git_mv: ['phases/2', 'phases/1'] }); // 2 first,
  assert.deepEqual(plan.ops[1], { git_mv: ['phases/3', 'phases/2'] }); // then 3
  assert.deepEqual(plan.ops[2], { rm: 'phases/1' });
  const r = run(['renumber', 'remove', '--n', '1'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(readdirSync(join(dir, 'phases')).sort(), ['1', '2']);
  // the surviving dirs really are the MOVED ones, not stale copies
  assert.match(readFileSync(join(dir, 'phases', '1', 'PLAN.md'), 'utf8'), /# Plan 2/);
  assert.match(readFileSync(join(dir, 'phases', '2', 'PLAN.md'), 'utf8'), /# Plan 3/);
});

test('renumber remove of the LAST phase cuts the final detail section cleanly', () => {
  const dir = renumberTree();
  const r = run(['renumber', 'remove', '--n', '3'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.total, 2);
  const roadmap = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  assert.doesNotMatch(roadmap, /Phase 3/);
  assert.doesNotMatch(roadmap, /Three/);
  assert.match(roadmap, /### Phase 2: Two/); // the preceding detail survives intact
  assert.deepEqual(readdirSync(join(dir, 'phases')).sort(), ['1', '2']);
});

test('renumber remove: a detail heading as the last line (no trailing newline) still cuts', () => {
  const dir = makeTree({});
  writeFileSync(join(dir, 'ROADMAP.md'),
    '# Roadmap\n\n## Phases\n\n- [ ] **Phase 1: One** - a\n- [ ] **Phase 2: Two** - b\n\n' +
    '## Phase Details\n\n### Phase 1: One\n**Goal:** g1\n\n### Phase 2: Two');
  const r = run(['renumber', 'remove', '--n', '2'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.total, 1);
  const roadmap = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  assert.doesNotMatch(roadmap, /Phase 2/);
  assert.match(roadmap, /### Phase 1: One/);
});

test('renumber remove: a name-less `### Phase N:` detail heading still cuts (#48.2)', () => {
  const dir = makeTree({});
  writeFileSync(join(dir, 'ROADMAP.md'),
    '# Roadmap\n\n## Phases\n\n- [ ] **Phase 1: One** - a\n- [ ] **Phase 2: Two** - b\n\n' +
    // The list line carries a name (the list-line grammar is unchanged); only
    // the detail heading is bare - exactly the filed case.
    '## Phase Details\n\n### Phase 1: One\n**Goal:** g1\n\n### Phase 2:\n**Goal:** g2\n');
  const r = run(['renumber', 'remove', '--n', '2'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.total, 1);
  const roadmap = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  assert.doesNotMatch(roadmap, /### Phase 2/);
  assert.doesNotMatch(roadmap, /\*\*Goal:\*\* g2/); // the body went with it
  assert.match(roadmap, /### Phase 1: One/);        // the named section survives
  assert.match(roadmap, /\*\*Goal:\*\* g1/);
});

test('renumber: prose phase refs are reported, never rewritten; key absent when none', () => {
  // The structured-only fixture has no lowercase refs -> no in_text_refs key.
  const clean = run(['renumber', 'remove', '--n', '2', '--dry-run'], renumberTree());
  assert.equal(clean.in_text_refs, undefined);

  const dir = renumberTree();
  writeFileSync(join(dir, 'ROADMAP.md'),
    readFileSync(join(dir, 'ROADMAP.md'), 'utf8') + '\nSee phase 3 for the follow-up work.\n');
  const r = run(['renumber', 'remove', '--n', '2'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.in_text_refs.length, 1);
  assert.equal(r.in_text_refs[0].file, 'ROADMAP.md');
  assert.match(r.in_text_refs[0].text, /phase 3/);
  // The prose line itself is untouched - repairing it needs judgment.
  assert.match(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), /See phase 3 for the follow-up/);
});

test('renumber: out-of-range and unknown phase refuse', () => {
  const dir = renumberTree();
  assert.equal(run(['renumber', 'insert', '--at', '9'], dir).reason, 'out-of-range');
  assert.equal(run(['renumber', 'remove', '--n', '9'], dir).reason, 'unknown-phase');
});

test('renumber: refuses a colliding destination before any write (#49.2)', () => {
  const dir = renumberTree();
  mkdirSync(join(dir, 'phases', '4'), { recursive: true });
  writeFileSync(join(dir, 'phases', '4', 'PLAN.md'), '# stray\n');
  const before = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');

  const dry = run(['renumber', 'insert', '--at', '3', '--dry-run'], dir);
  assert.equal(dry.ok, false);
  assert.equal(dry.reason, 'collision');
  assert.match(dry.detail, /phases\/4/);

  const r = run(['renumber', 'insert', '--at', '3'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'collision');
  assert.match(r.detail, /phases\/4/);

  assert.equal(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), before);
  assert.deepEqual(readdirSync(join(dir, 'phases')).sort(), ['1', '2', '3', '4']);
  assert.ok(!existsSync(join(dir, 'phases', '4', '3')));
  assert.match(readFileSync(join(dir, 'phases', '4', 'PLAN.md'), 'utf8'), /# stray/);
});

test('renumber: a dangling symlink at the destination still collides (#49.2)', () => {
  const dir = renumberTree();
  const before = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  symlinkSync('nowhere', join(dir, 'phases', '4'));

  const r = run(['renumber', 'insert', '--at', '3'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'collision');
  assert.equal(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), before);
});

test('renumber remove: a dangling symlink at phases/<at> collides instead of dying mid-apply (#49.2)', () => {
  // The remove direction of the arm above. `vacated` used to be seeded with
  // `at` on every remove, but the rm that frees that slot is gated on
  // existingDir (existsSync), which is FALSE for a dangling symlink - so the
  // pre-flight waved through the very occupant occupied()/lstatSync exists to
  // catch, and the apply then died on the first move with completed: [] and a
  // hint asserting a half-renumbered tree when nothing had been written.
  const dir = renumberTree();
  const before = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  rmSync(join(dir, 'phases', '2'), { recursive: true });
  symlinkSync('nowhere', join(dir, 'phases', '2'));

  const r = run(['renumber', 'remove', '--n', '2'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'collision');
  assert.match(r.detail, /phases\/2/);
  assert.equal(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), before);
});

test('renumber remove: uncommitted work in phases/<at> is refused before any write', () => {
  // `git rm -r -q` exits 0 while leaving untracked/ignored files, so
  // phases/<at> SURVIVES a removal that reported success, the first move
  // nests the next phase inside it (phases/1/2/PLAN.md), and the command
  // still exits ok:true with ROADMAP naming a phase whose dir has no plan.
  // Every other renumber fixture is a bare tmpdir, where gitMv/git rm always
  // fall back to fs calls that cannot nest - so this arm needs a REAL repo.
  const dir = renumberTree();
  const repo = join(dir, '..');
  const g = (args) => execFileSync('git', args, { cwd: repo, stdio: 'pipe',
    env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' } });
  g(['init', '-q', '.']);
  g(['config', 'user.email', 't@t']);
  g(['config', 'user.name', 'T']);
  g(['add', '-A']);
  g(['commit', '-qm', 'init']);
  writeFileSync(join(dir, 'phases', '1', 'NOTES.md'), 'untracked\n');

  const before = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  const r = run(['renumber', 'remove', '--n', '1'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'uncommitted-work');
  assert.match(r.detail, /NOTES\.md/);
  // Nothing moved, nothing nested, nothing rewritten.
  assert.equal(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), before);
  assert.deepEqual(readdirSync(join(dir, 'phases')).sort(), ['1', '2', '3']);
  assert.ok(existsSync(join(dir, 'phases', '1', 'PLAN.md')));
  assert.ok(!existsSync(join(dir, 'phases', '1', '2')));

  // A MODIFIED tracked file is the other half of the same principle, and the
  // more dangerous one: `git rm -r` REFUSES it ("file has local
  // modifications"), and the rmSync fallback then deletes the work anyway
  // with no copy in the object store. Verified live before this guard: the
  // command returned ok:true and the edit was unrecoverable.
  rmSync(join(dir, 'phases', '1', 'NOTES.md'));
  const plan1 = join(dir, 'phases', '1', 'PLAN.md');
  const edited = '# Plan 1\n\nuncommitted edit\n';
  writeFileSync(plan1, edited);
  const rMod = run(['renumber', 'remove', '--n', '1'], dir);
  assert.equal(rMod.ok, false);
  assert.equal(rMod.reason, 'uncommitted-work');
  assert.equal(readFileSync(plan1, 'utf8'), edited, 'the uncommitted edit must survive');

  // With the tree clean the same call succeeds and does NOT nest.
  g(['checkout', '--', '.']);
  const r2 = run(['renumber', 'remove', '--n', '1'], dir);
  assert.equal(r2.ok, true);
  assert.ok(!existsSync(join(dir, 'phases', '1', '2')));
  assert.match(readFileSync(join(dir, 'phases', '1', 'PLAN.md'), 'utf8'), /Plan 2/);
});

// WATCHED FAILING AT ae73dd6, the tip of this plan's unpatched tree. Observed
// there, with this file copied into that checkout:
//
//   $ node --test --test-name-pattern='PHS-01' cadence-core/bin/planning.test.mjs
//   AssertionError [ERR_ASSERTION]: phases/3 must survive a git state that
//   could not be read - apply returned {"ok":true,"ops":[{"rm":"phases/3"},
//   {"edit":"ROADMAP.md","changes":1},{"edit":"REQUIREMENTS.md","changes":1},
//   {"edit":"STATE.md","changes":1}],"orphaned_reqs":["REQ-3"],"total":2,
//   "_exit":0}
//     + actual - expected
//     + false
//     - true
//   (exit 1)
//
// Which is the defect exactly: the repository's `.git` was at mode 000, so
// `git status --porcelain --ignored` exited 128 and `uncommittedUnder`'s bare
// `catch { return []; }` reported NO uncommitted work - the same answer it
// gives for a directory with no repository at all. `remove` read that as clean,
// ran, reported `ok:true` with `{"rm":"phases/3"}` among its ops, and phases/3
// and its PLAN.md were gone. The exit code is 0: nothing in the output says a
// check was skipped, which is the whole shape - a gate that clears itself
// wrong.
//
// Driven through the CLI with `execFileSync` and importing nothing this plan
// added, so against the unpatched tree it fails on an ASSERTION rather than on
// a missing export. To re-watch it:
// `git worktree add --detach <tmp> ae73dd6`, copy THIS FILE alone into that
// checkout's `cadence-core/bin/`, run it there with
// `--test-name-pattern='PHS-01'` - the scope matters, since the source row
// below (`source: the renumber rm fallback's ...`) also reddens at that sha and
// is a different claim - then `git worktree remove` it.

test('PHS-01: an unreadable git state refuses the remove, a non-repo still removes', {
  skip: typeof process.getuid === 'function' && process.getuid() === 0 ? 'root bypasses mode bits' : false,
}, () => {
  const dir = renumberTree();
  const repo = join(dir, '..');
  const g = (args) => execFileSync('git', args, { cwd: repo, stdio: 'pipe',
    env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' } });
  g(['init', '-q', '.']);
  g(['config', 'user.email', 't@t']);
  g(['config', 'user.name', 'T']);
  g(['add', '-A']);
  g(['commit', '-qm', 'init']);

  // Mode 000 on `.git` is the whole fixture: git then exits 128 with
  // `fatal: not a git repository` - the SAME bytes it prints for a directory
  // that has no repository above it at all. That collision is why the
  // classifier probes the filesystem instead of reading git's answer, and it
  // is why the two arms below have to be asserted together: any rule derived
  // from git's own output either refuses both or permits both.
  const gitDir = join(repo, '.git');
  const before = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  let rDry, rApply;
  chmodSync(gitDir, 0o000);
  try {
    rDry = run(['renumber', 'remove', '--n', '3', '--dry-run'], dir);
    rApply = run(['renumber', 'remove', '--n', '3'], dir);
  } finally {
    // Restored before any assertion, so a red row cannot leave a tmpdir
    // nothing can descend into - the shipped partial-apply fixture's
    // discipline, for the same reason.
    chmodSync(gitDir, 0o755);
  }

  // The destroyed thing first, and the envelope in the message: what a wrong
  // answer costs here is a phase directory and everything under it, so that is
  // the assertion the watch is meant to show failing.
  assert.ok(existsSync(join(dir, 'phases', '3', 'PLAN.md')),
    `phases/3 must survive a git state that could not be read - apply returned ${JSON.stringify(rApply)}`);
  assert.deepEqual(readdirSync(join(dir, 'phases')).sort(), ['1', '2', '3']);
  assert.equal(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), before);

  // Both arms refuse, and neither sends the caller to a remedy git cannot
  // perform. `--dry-run` matters as much as apply: it is what the workflow's
  // confirmation gate prints, so a clean plan there is what talks a caller
  // into the apply.
  for (const [arm, r] of [['--dry-run', rDry], ['apply', rApply]]) {
    assert.equal(r.ok, false, `${arm} must refuse an unreadable git state, got ${JSON.stringify(r)}`);
    assert.notEqual(r.reason, 'uncommitted-work',
      `${arm} reported uncommitted work for a git that could not answer`);
    assert.doesNotMatch(`${r.detail || ''} ${r.hint || ''}`, /commit or discard/,
      `${arm} prescribes committing or discarding, which an unreadable repository cannot do`);
  }

  // The permissive arm of the same classifier (AC5), asserted in the same
  // family because it is the cost of getting the first arm wrong: no `.git`
  // anywhere above means nothing is tracked, nothing can be lost to the
  // object store, and the remove must still happen. Eleven shipped renumber
  // fixtures run on exactly this tree.
  const bare = renumberTree();
  const rBare = run(['renumber', 'remove', '--n', '3'], bare);
  assert.equal(rBare.ok, true, `a tree with no repository must still remove, got ${JSON.stringify(rBare)}`);
  assert.ok(!existsSync(join(bare, 'phases', '3')));
  assert.deepEqual(readdirSync(join(bare, 'phases')).sort(), ['1', '2']);
});

test('renumber remove: a partial apply reports which ops completed (#49.2)', {
  skip: typeof process.getuid === 'function' && process.getuid() === 0 ? 'root bypasses mode bits' : false,
}, () => {
  const dir = renumberTree();
  chmodSync(dir, 0o555); // .planning root read-only; phases/ stays writable
  let r;
  try {
    r = run(['renumber', 'remove', '--n', '1'], dir);
  } finally {
    chmodSync(dir, 0o755);
  }
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'partial-apply');
  assert.deepEqual(r.completed, [
    { rm: 'phases/1' },
    { git_mv: ['phases/2', 'phases/1'] },
    { git_mv: ['phases/3', 'phases/2'] },
  ]);
  assert.deepEqual(r.failed, { edit: 'ROADMAP.md' });
  assert.match(r.detail, /ROADMAP/);
  // The hint must never PRESCRIBE a re-run: the half-applied tree no longer
  // matches ROADMAP, so a re-run rm's phases/1 - which now holds the ORIGINAL
  // phase 2's work - and exits ok:true having destroyed it. It may mention
  // re-running, but only to warn against it.
  assert.doesNotMatch(r.hint, /by hand,\s*then re-run/);
  assert.match(r.hint, /destroy/);
  // Byte-exact, not just the keywords above: ROADMAP phase 1 SC2 asks for the
  // hint text to be pinned by a test that reddens on a PARAPHRASE, and every
  // keyword assertion here survives one. This is the only copy of the sentence
  // outside planning.mjs.
  assert.equal(r.hint, "the tree is partly renumbered and no longer matches ROADMAP"
    + " - reconcile the completed ops by hand before any further renumber;"
    + " re-running this command against the half-applied tree can destroy a phase directory");
});

test('renumber remove: a failure before ANY step says so, rather than claiming a half-renumbered tree', {
  skip: typeof process.getuid === 'function' && process.getuid() === 0 ? 'root bypasses mode bits' : false,
}, () => {
  // completed: [] means nothing was written and the tree still matches
  // ROADMAP - the opposite of the partial case, and safe to re-run. An
  // unconditional "the tree is partly renumbered" hint would send the caller
  // hand-reconciling a tree that was never touched.
  const dir = renumberTree();
  chmodSync(join(dir, 'phases'), 0o555); // the rm (step one) cannot unlink
  let r;
  try {
    r = run(['renumber', 'remove', '--n', '1'], dir);
  } finally {
    chmodSync(join(dir, 'phases'), 0o755);
  }
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'partial-apply');
  assert.deepEqual(r.completed, []);
  assert.match(r.hint, /nothing was written/);
  assert.doesNotMatch(r.hint, /partly renumbered/);
  // Byte-exact for the same reason as the partial arm above (SC2).
  assert.equal(r.hint, "nothing was written - the first step failed, so the tree"
    + " is unchanged and safe to re-run once the cause is fixed");
});

// WATCHED FAILING AT ae73dd6, the same unpatched tip the falsifier above was
// watched at. These two came out of the blocking `risk_surface` round rather
// than a plan task, which is why the header lands here after the fact; the
// watch it records was re-run in full before this comment was written.
// Observed there, with THIS FILE alone copied into that checkout:
//
//   $ node --test --test-name-pattern='PHS-01' cadence-core/bin/planning.test.mjs
//   AssertionError [ERR_ASSERTION]: the nested repository must stop the delete
//   - got {"ok":true,"ops":[{"rm":"phases/3"},{"edit":"ROADMAP.md",
//   "changes":1},{"edit":"REQUIREMENTS.md","changes":1},{"edit":"STATE.md",
//   "changes":1}],"orphaned_reqs":["REQ-3"],"total":2,"_exit":0}
//   true !== false
//   AssertionError [ERR_ASSERTION]: phases/3 must survive an unreadable GIT_DIR
//   repository - got {"ok":true,"ops":[{"rm":"phases/3"}, ... ,"_exit":0}
//   (exit 1)
//
// Both are the SAME shape as the falsifier above and a different reach: there
// the repository sat at the planning root with its state unreadable, here it is
// invisible to a walk that only goes UP (rooted inside the target) or that only
// reads the filesystem (selected by `GIT_DIR`). In both the classifier answered
// ABSENT, which is the permissive arm, and the permissive arm ends in the
// recursive delete - `ok:true`, `{"rm":"phases/3"}`, exit 0, nothing in the
// output saying a check was skipped.
//
// Both are driven through the CLI with `execFileSync` and import nothing this
// phase added, so they fail on an ASSERTION at the unpatched sha rather than on
// a missing export. To re-watch: `git worktree add --detach <tmp> ae73dd6`,
// copy THIS FILE alone into that checkout's `cadence-core/bin/`, run it there
// with `--test-name-pattern='PHS-01'` - the scope matters for the same reason
// it does above - then `git worktree remove` it.

test('PHS-01: a repository rooted INSIDE phases/<at> is not deleted out from under itself', () => {
  // The classifier walks UP from the planning root, so a repository rooted in
  // the very directory the fallback is about to delete is invisible to it: the
  // tree answers "no repository" and `rmSync` takes the nested object store
  // along with the phase. Nothing else in the run reads that repository, so its
  // commits have no second copy anywhere.
  const dir = renumberTree();
  const nested = join(dir, 'phases', '3');
  execFileSync('git', ['init', '-q', '.'], { cwd: nested, stdio: 'pipe',
    env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' } });

  const before = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  const r = run(['renumber', 'remove', '--n', '3'], dir);

  assert.equal(r.ok, false, `the nested repository must stop the delete - got ${JSON.stringify(r)}`);
  assert.ok(existsSync(join(nested, '.git')), 'the nested object store must survive');
  assert.ok(existsSync(join(nested, 'PLAN.md')));
  // The rm is the FIRST apply step, so a refusal there leaves the tree whole.
  assert.equal(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), before);
  assert.deepEqual(readdirSync(join(dir, 'phases')).sort(), ['1', '2', '3']);
});

test('PHS-01: a GIT_DIR-selected repository counts as present when its state cannot be read', {
  skip: typeof process.getuid === 'function' && process.getuid() === 0 ? 'root bypasses mode bits' : false,
}, () => {
  // `GIT_DIR`/`GIT_WORK_TREE` select a repository with no lexical `.git`
  // anywhere above the work tree. The filesystem probe finds nothing, so an
  // unreadable external repository classified as ABSENT - the permissive arm,
  // which ends in the recursive delete. Presence is what the environment says
  // here, not what the walk can see.
  const dir = renumberTree();
  const work = join(dir, '..');
  const meta = join(work, 'meta.git');
  const env = { GIT_DIR: meta, GIT_WORK_TREE: work,
    GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };
  const g = (args) => execFileSync('git', args, { cwd: work, stdio: 'pipe', env: { ...process.env, ...env } });
  g(['init', '-q']);
  g(['config', 'user.email', 't@t']);
  g(['config', 'user.name', 'T']);
  g(['add', '-A']);
  g(['commit', '-qm', 'init']);
  assert.ok(!existsSync(join(work, '.git')), 'the fixture is only meaningful with no lexical .git');

  const before = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  let r;
  chmodSync(meta, 0o000);
  try { r = run(['renumber', 'remove', '--n', '3'], dir, undefined, env); }
  finally { chmodSync(meta, 0o755); }

  assert.ok(existsSync(join(dir, 'phases', '3', 'PLAN.md')),
    `phases/3 must survive an unreadable GIT_DIR repository - got ${JSON.stringify(r)}`);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unreadable-git-state');
  assert.equal(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), before);
});

test('source: the nested-repository probe reads the filesystem, not entry names', () => {
  // A source row because the state it guards needs a case-INSENSITIVE
  // filesystem, which the suite cannot conjure on Linux. What it pins is the
  // mechanism: `e.name === '.git'` over a readdir is a case-sensitive test, so
  // an admin directory stored as `.GIT` on APFS or NTFS still resolves for git
  // and gets scanned past, while `gitDirAbove` - which has always probed with
  // lstat - matches it. One guard, two halves, and only one of them open.
  //
  // The probe lives in the renumber command module now (phase 4), so this reads
  // THAT file: the entry file only dispatches, and a read of it would find no
  // `function gitDirUnder(` at all and fail saying the probe was renamed.
  const src = readFileSync(join(PLANNING_DIR, 'renumber.mjs'), 'utf8');
  const start = src.indexOf('function gitDirUnder(');
  assert.ok(start > 0, 'the nested-repository probe is no longer under this name');
  const body = src.slice(start, src.indexOf('\n}', start));
  assert.match(body, /lstatSync\(join\([^)]*'\.git'\)/,
    'the nested probe no longer asks the filesystem whether .git is there');
  assert.doesNotMatch(body, /\.name === '\.git'/,
    'the nested probe is back to a case-sensitive name comparison');
});

test('source: the renumber rm fallback\'s recursive delete is gated by the .git probe', () => {
  // A source row rather than a behavioural one because the state it guards is
  // unreachable from a test: it needs `git rm` to fail while `.git` exists,
  // which the pre-flight already refuses ahead of the apply. The arm is still
  // load-bearing - it is the SECOND, independent fail-open, covering a git
  // state that turned unreadable between the pre-flight and the apply, and any
  // `git rm` failure the pre-flight did not predict at all. What the row pins
  // is that the guard cannot be dropped back to the shipped one-liner
  // `catch { rmSync(..., { recursive: true }) }`, which read an unreadable git
  // state as a clean one and deleted the phase directory whole.
  //
  // The apply loop lives in the renumber command module now (phase 4), and this
  // reads that file rather than the entry file for the reason the row above
  // states.
  const src = readFileSync(join(PLANNING_DIR, 'renumber.mjs'), 'utf8');
  // Sliced from the rm step's own op literal to the move loop that follows it,
  // so this reads the ONE fallback that deletes a phase directory and not the
  // unrelated recursive rmSync in milestone-prune's delete mode.
  const start = src.indexOf('steps.push([{ rm: `phases/${at}` }');
  assert.ok(start > 0, 'the renumber apply loop\'s rm step is no longer under this shape');
  const end = src.indexOf('for (const [f, t] of dirMoves)', start);
  assert.ok(end > start, 'the rm step is no longer followed by the dir-move loop');
  const step = src.slice(start, end);
  assert.match(step, /rmSync\([\s\S]*?recursive: true/, 'the recursive fallback this row guards is gone');
  // Guarded, and guarded BEFORE the delete - a probe after the rmSync would
  // pass a substring check while deleting exactly as it did.
  const probe = step.indexOf('gitDirAbove(');
  const del = step.search(/rmSync\(/);
  assert.ok(probe > 0 && probe < del,
    'the recursive delete runs without the .git probe deciding first');
  // The probe looks UP from the planning root, so it cannot see a repository
  // rooted in the directory being deleted. That half is a separate call and
  // it must also decide before the delete, or the nested object store goes
  // with the phase dir - the same fail-open reached from the other side.
  const under = step.indexOf('gitDirUnder(');
  assert.ok(under > 0 && under < del,
    'the recursive delete runs without the nested-repository probe deciding first');
  assert.doesNotMatch(step, /catch \{ rmSync/, 'the unguarded one-line fallback is back');
});

// --- seed-reqs: /cad-plan's Traceability row-insert seam ------------------------

// A .planning tree for seed-reqs tests: REQUIREMENTS.md written raw with an
// `## Active` section (bullets) plus an empty `## Traceability` table -
// `active: null` omits the heading entirely (the no_active_section case),
// makeTree's `reqs` shape cannot express either.
function seedTree({ roadmap, phases, active }) {
  const dir = makeTree({ roadmap, phases });
  const activeSection = active === null ? ''
    : `## Active\n\n${active.map((id) => `- **${id}**: desc\n`).join('')}\n`;
  writeFileSync(join(dir, 'REQUIREMENTS.md'),
    `# Requirements: Fixture\n\n${activeSection}## Traceability\n\n` +
    '| Requirement | Phase | Status |\n|---|---|---|\n\nEmpty note.\n');
  return dir;
}

test('seed-reqs: a declared id with an ## Active bullet is seeded at Pending; a second run reports it skipped, file byte-identical', () => {
  const dir = seedTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: true, planReqs: ['X'] } },
    active: ['X'],
  });
  const r1 = run(['seed-reqs', '--phase', '1'], dir);
  assert.equal(r1.ok, true);
  assert.deepEqual(r1.seeded, ['X']);
  assert.deepEqual(r1.skipped, []);
  const after1 = readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8');
  assert.match(after1, /\| X \| Phase 1 \| Pending \|/);

  const r2 = run(['seed-reqs', '--phase', '1'], dir);
  assert.equal(r2.ok, true);
  assert.deepEqual(r2.seeded, []);
  assert.deepEqual(r2.skipped, ['X']);
  assert.equal(readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8'), after1);
});

test('seed-reqs: an id with no ## Active bullet is reported under orphan_ids, no row written, and audit still lists it under orphans.plan_ids', () => {
  const dir = seedTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: true, planReqs: ['Y'] } },
    active: [],
  });
  const r = run(['seed-reqs', '--phase', '1'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.seeded, []);
  assert.deepEqual(r.orphan_ids, ['Y']);
  const after = readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8');
  assert.equal(after.includes('| Y |'), false);
  const audit = run(['audit'], dir);
  assert.deepEqual(audit.orphans.plan_ids, [{ file: 'phases/1/PLAN.md', ids: ['Y'] }]);
});

test('seed-reqs: a missing ## Active heading returns no_active_section: true', () => {
  const dir = seedTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: true, planReqs: ['Z'] } },
    active: null,
  });
  const r = run(['seed-reqs', '--phase', '1'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.no_active_section, true);
  assert.deepEqual(r.orphan_ids, ['Z']);
});

test('seed-reqs: --phase absent/non-numeric/negative all return bad-args, nothing written', () => {
  const dir = seedTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: true, planReqs: ['X'] } },
    active: ['X'],
  });
  const before = readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8');
  for (const args of [['seed-reqs'], ['seed-reqs', '--phase', 'abc'], ['seed-reqs', '--phase', '-1']]) {
    assert.equal(run(args, dir).reason, 'bad-args');
  }
  assert.equal(readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8'), before);
});

test('seed-reqs: a --phase spelling that cannot round-trip is refused before any read (D-07)', () => {
  // The fixture holds BOTH sub-phases, which is what makes the old answer
  // wrong rather than merely odd: `--phase 1.10` used to seed `| B | Phase 1.1
  // | Pending |` - the OTHER phase's row - with ok:true.
  const dir = seedTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: {
      '1.1': { plan: true, planReqs: ['A'] },
      '1.10': { plan: true, planReqs: ['B'] },
      2: { plan: true, planReqs: ['C'] },
      '2.1': { plan: true, planReqs: ['D'] },
    },
    active: ['A', 'B', 'C', 'D'],
  });
  const before = readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8');
  for (const bad of ['1.10', '1.0', '01']) {
    const r = run(['seed-reqs', '--phase', bad], dir);
    assert.equal(r.ok, false, bad);
    assert.equal(r.reason, 'bad-args', bad);
    assert.equal(r._exit, 1, bad);
    // Both spellings: the caller's fix is retype the flag OR rename the dir.
    assert.ok(r.detail.includes(`"${bad}"`), `${bad}: detail quotes what was sent`);
    assert.ok(r.detail.includes(`"${String(Number(bad))}"`), `${bad}: detail quotes what is accepted`);
  }
  assert.equal(readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8'), before, 'nothing written');

  // The spellings that DO round-trip are untouched, sub-phases included.
  for (const [good, id] of [['1.1', 'A'], ['2', 'C'], ['2.1', 'D']]) {
    const r = run(['seed-reqs', '--phase', good], dir);
    assert.equal(r.ok, true, good);
    assert.deepEqual(r.seeded, [id], good);
  }
});

test('seed-reqs: a malformed requirements: line surfaces frontmatter_issues', () => {
  const dir = seedTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: true } },
    active: ['X'],
  });
  writeFileSync(join(dir, 'phases', '1', 'PLAN.md'),
    '---\nphase: 1\nrequirements:["X"]\nfiles: []\n---\n# Plan 1\n');
  const r = run(['seed-reqs', '--phase', '1'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.frontmatter_issues, [{
    file: 'phases/1/PLAN.md',
    issues: [{ line: 3, code: 'malformed-key-line', text: 'requirements:["X"]' }],
  }]);
});

test('seed-reqs: absent REQUIREMENTS.md / absent phase dir / no conforming plan file degrade with named reasons', () => {
  const noReqs = makeTree({ roadmap: [{ n: 1, name: 'One' }], phases: { 1: { plan: true } } });
  assert.equal(run(['seed-reqs', '--phase', '1'], noReqs).reason, 'no-requirements');

  const noPhaseDir = seedTree({ roadmap: [{ n: 1, name: 'One' }], active: ['X'] });
  assert.equal(run(['seed-reqs', '--phase', '1'], noPhaseDir).reason, 'no-phase-dir');

  const noPlans = seedTree({ roadmap: [{ n: 1, name: 'One' }], active: ['X'] });
  mkdirSync(join(noPlans, 'phases', '1'), { recursive: true });
  const rNoPlans = run(['seed-reqs', '--phase', '1'], noPlans);
  assert.equal(rNoPlans.reason, 'no-plans');
  assert.equal(rNoPlans.hint, '/cad-plan 1');
});

test('seed-reqs: a seeded row survives renumber insert, reading Phase 2', () => {
  const dir = seedTree({
    roadmap: [{ n: 1, name: 'One' }],
    phases: { 1: { plan: true, planReqs: ['X'] } },
    active: ['X'],
  });
  assert.equal(run(['seed-reqs', '--phase', '1'], dir).ok, true);
  assert.equal(run(['renumber', 'insert', '--at', '1'], dir).ok, true);
  const after = readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8');
  assert.match(after, /\| X \| Phase 2 \| Pending \|/);
});

// --- decimal phases under renumber (the desync fix) ----------------------------

test('renumber: decimal phase tokens are never shifted, and are reported', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }, { n: 2, name: 'Two' }, { n: 3, name: 'Three' }],
    phases: { 1: { plan: true } },
  });
  // Add a decimal insertion between 2 and 3, with a token and a path ref.
  const roadmap = readFileSync(join(dir, 'ROADMAP.md'), 'utf8').replace(
    '- [ ] **Phase 3: Three**',
    '- [ ] **Phase 2.1: TwoPointOne** - see phases/2.1/ notes\n- [ ] **Phase 3: Three**');
  writeFileSync(join(dir, 'ROADMAP.md'), roadmap);

  const r = run(['renumber', 'insert', '--at', '2'], dir);
  assert.equal(r.ok, true);
  assert.deepEqual(r.decimal_phases, [2.1]); // surfaced for hand re-placement
  const after = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
  assert.match(after, /\*\*Phase 2\.1: TwoPointOne\*\*/); // token untouched...
  assert.match(after, /phases\/2\.1\//);                   // ...and path untouched
  assert.match(after, /\*\*Phase 4: Three\*\*/);           // integers shifted
});

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

// --- recall: BM25 over the .planning corpus ------------------------------------

// A dedicated runner: recall takes a positional query, and its backend read
// goes through the config layers, so the global layer must be pinned off a
// nonexistent path (D-10) or a developer's real ~/.claude/cadence/config.json
// would flip results locally while CI stayed green. Returns the parsed JSON
// AND the raw stdout (the determinism test byte-compares the raw string).
// `query` may be an array to express the UNQUOTED form (bare words as
// separate argv elements) - a single string cannot say that at all.
function recall(query, dir) {
  let raw;
  let code = 0;
  const qargs = Array.isArray(query) ? query : [query];
  try {
    raw = execFileSync('node', [PLANNING, 'recall', ...qargs, '--dir', dir], {
      encoding: 'utf8',
      env: { ...process.env, CADENCE_GLOBAL_CONFIG: join(tmpdir(), 'cad-no-such-global.json') },
    });
  } catch (e) { raw = e.stdout; code = e.status; }
  return { json: JSON.parse(raw), raw, _exit: code };
}

test('recall: a matching SUMMARY deviation ranks first, with source and phase', () => {
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'Recall' }, { n: 2, name: 'Later' }],
    phases: {
      1: { summaryBody: { deviations: ['tokenkiller saturation race fixed in the guard'] } },
      2: { summaryBody: { deviations: ['unrelated documentation wording tweak'] } },
    },
  });
  const r = recall('tokenkiller saturation', dir);
  assert.equal(r.json.ok, true);
  assert.equal(r._exit, 0);
  assert.ok(r.json.results.length >= 1);
  assert.equal(r.json.results[0].source, 'phases/1/SUMMARY.md');
  assert.equal(r.json.results[0].phase, 1);
  assert.match(r.json.results[0].snippet, /tokenkiller/);
});

test('recall: empty and absent corpus both return ok:true with no results', () => {
  // Absent .planning entirely.
  const gone = recall('anything', join(tmpdir(), 'cad-recall-nonexistent'));
  assert.equal(gone.json.ok, true);
  assert.deepEqual(gone.json.results, []);
  assert.equal(gone._exit, 0);
  // .planning exists (roadmap only) but no SUMMARY/CAPTURE/UAT/CONTEXT corpus.
  const empty = recall('anything', makeTree({ roadmap: [{ n: 1, name: 'One' }] }));
  assert.equal(empty.json.ok, true);
  assert.deepEqual(empty.json.results, []);
  assert.equal(empty._exit, 0);
});

test('recall: two runs on the same corpus are byte-identical', () => {
  const dir = makeTree({
    phases: {
      1: { summaryBody: { deviations: ['alpha beta gamma', 'delta epsilon'] },
        contextDecisions: ['use beta for the gamma path'] },
    },
    capture: [{ section: 'Todos', text: 'wire the beta recall path', phase: 1 },
      { section: 'Seeds', text: 'gamma indexing idea' }],
  });
  const a = recall('beta gamma', dir);
  const b = recall('beta gamma', dir);
  assert.equal(a.raw, b.raw);
  assert.ok(a.json.results.length >= 2);
});

test('recall: durable decisions resurface; phase-local ## Decisions do not', () => {
  const dir = makeTree({
    phases: {
      1: { durableDecisions: ['use foobar approach'], contextDecisions: ['phase-local baz detail'] },
    },
  });
  const durable = recall('foobar', dir);
  assert.ok(durable.json.results.some((r) => r.source === 'phases/1/CONTEXT.md'));
  const local = recall('baz', dir);
  assert.ok(!local.json.results.some((r) => r.source === 'phases/1/CONTEXT.md'));
});

test('recall: legacy CONTEXT.md with only ## Decisions (no durable heading) still resurfaces', () => {
  const dir = makeTree({
    phases: { 1: { contextDecisions: ['legacy qux decision'] } },
  });
  const r = recall('qux', dir);
  assert.ok(r.json.results.some((r) => r.source === 'phases/1/CONTEXT.md'));
});

test('recall: a present-but-empty ## Durable decisions does NOT fall back to ## Decisions', () => {
  // Constructed directly (not via makeTree's default Durable-first ordering):
  // `sectionBody` only returns the literal empty string "" - as opposed to a
  // truthy whitespace-only "\n" - when the heading is the LAST thing in the
  // file, so this is the shape that actually distinguishes a `durable ===
  // null` / `??` fallback from a naive `!durable` / `durable || ...` one; the
  // latter treats "" as falsy and wrongly falls through to `## Decisions`.
  const dir = makeTree({ roadmap: [{ n: 1, name: 'Only' }], phases: { 1: {} } });
  writeFileSync(join(dir, 'phases', '1', 'CONTEXT.md'),
    '# Phase 1 Context\n\n## Decisions\n\n- D-01 (area): phase-local baz detail\n\n' +
    '## Durable decisions\n');
  const r = recall('baz', dir);
  assert.ok(!r.json.results.some((r) => r.source === 'phases/1/CONTEXT.md'));
});

test('recall: two runs over a corpus with ## Durable decisions are byte-identical', () => {
  const dir = makeTree({
    phases: {
      1: { durableDecisions: ['alpha beta gamma durable'], contextDecisions: ['delta epsilon local'] },
    },
  });
  const a = recall('beta gamma', dir);
  const b = recall('beta gamma', dir);
  assert.equal(a.raw, b.raw);
  assert.ok(a.json.results.length >= 1);
});

test('recall: bare words after the query are joined, not truncated (#47.2)', () => {
  // The corpus separates the two words, so a first-word-only search can only
  // reach phase 1 - the quoted run reaches both.
  const dir = makeTree({
    phases: {
      1: { summaryBody: { deviations: ['decimal cursor carve-out'] } },
      2: { summaryBody: { deviations: ['renumber phases desync report'] } },
    },
  });
  const bare = recall(['decimal', 'phases'], dir);
  const quoted = recall('decimal phases', dir);
  assert.equal(bare.json.ok, true);
  const sources = bare.json.results.map((x) => x.source);
  assert.ok(sources.includes('phases/1/SUMMARY.md'), `missing phase 1: ${sources}`);
  assert.ok(sources.includes('phases/2/SUMMARY.md'), `missing phase 2: ${sources}`);
  assert.equal(bare.raw, quoted.raw); // byte-identical to the quoted form
});

test('recall: a completed capture keeps its phase and gains a closed marker (#47.1)', () => {
  // makeTree's capture builder only ever writes `[ ]`, so the checked line is
  // written raw - the shape the builder cannot express.
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }] });
  writeFileSync(join(dir, 'CAPTURE.md'),
    '## Todos\n\n- [x] (phase 3) tokenkiller carve-out closed by abc1234\n' +
    '- [ ] (phase 1) tokenkiller live item\n');
  const r = recall('tokenkiller', dir);
  assert.equal(r.json.ok, true);
  const closed = r.json.results.find((x) => /carve-out/.test(x.snippet));
  const live = r.json.results.find((x) => /live item/.test(x.snippet));
  // Pre-fix the `[x]` prefix blocked the `(phase N)` extraction entirely: no
  // phase field, and the checkbox stayed in the indexed text.
  assert.equal(closed.phase, 3);
  assert.doesNotMatch(closed.snippet, /\[x\]/);
  assert.ok(closed.snippet.startsWith('[closed] '),
    `closed snippet lacks the marker: ${closed.snippet}`);
  // An open capture is unchanged: phase extracted, no marker.
  assert.equal(live.phase, 1);
  assert.doesNotMatch(live.snippet, /\[closed\]/);
});

// --- capture -> recall: the walk-membership round trip (AC1) -----------------
// The pair below is the whole point of the phase. The first row proves a bullet
// written through the seam comes back; the second is its FALSIFIER, and without
// it the first would stay green if the seam wrote to `## Archive` - which is
// exactly how five filed bullets were lost. A positive-only assertion here
// would be an inspection dressed as a test.

test('capture -> recall: a bullet written through the seam comes back, with its phase (AC1)', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }] });
  const w = run(['capture', '--kind', 'todo', '--text', 'the zarquon fixture leaks a handle',
    '--phase', '2'], dir);
  assert.equal(w.ok, true, JSON.stringify(w));
  const r = recall('zarquon', dir);
  const hit = r.json.results.find((x) => /zarquon/.test(x.snippet));
  assert.ok(hit, `the captured bullet did not come back: ${r.raw}`);
  assert.equal(hit.source, 'CAPTURE.md');
  assert.equal(hit.phase, 2);
});

test('capture -> recall: a seed and a note come back too, unphased', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }] });
  assert.equal(run(['capture', '--kind', 'seed', '--text', 'a zarquon scanner'], dir).ok, true);
  assert.equal(run(['capture', '--kind', 'note', '--text', 'zarquon bit us again'], dir).ok, true);
  const hits = recall('zarquon', dir).json.results.filter((x) => x.source === 'CAPTURE.md');
  assert.equal(hits.length, 2, JSON.stringify(hits));
  for (const h of hits) assert.equal(h.phase, undefined);
});

test('capture -> recall: a bullet under ## Archive is NOT returned (the falsifier)', () => {
  // Same distinctive term, one bullet through the seam and one written straight
  // into a section the walk does not visit. Only the seam's comes back - so a
  // seam that ever wrote to `## Archive` reddens the row above rather than
  // passing on a bullet nobody can recall. `## Archive` stays out of the walk on
  // purpose (D-03): widening it would re-admit 185 retired bullets.
  const dir = makeTree({
    roadmap: [{ n: 1, name: 'One' }],
    capture: [{ section: 'Archive', text: 'zarquon retired long ago' }],
  });
  assert.match(readFileSync(join(dir, 'CAPTURE.md'), 'utf8'), /## Archive\n\n- zarquon retired long ago/);
  assert.deepEqual(recall('zarquon', dir).json.results, []);
  assert.equal(run(['capture', '--kind', 'todo', '--text', 'zarquon is live again', '--phase', '1'], dir).ok, true);
  const back = recall('zarquon', dir).json.results;
  assert.equal(back.length, 1, JSON.stringify(back));
  assert.match(back[0].snippet, /zarquon is live again/);
});

test('recall: memory.backend none reports off with empty results, exit 0', () => {
  const dir = makeTree({
    phases: { 1: { summaryBody: { deviations: ['findable term here'] } } },
    config: { memory: { backend: 'none' } },
  });
  const r = recall('findable', dir);
  assert.equal(r.json.ok, true);
  assert.equal(r.json.backend, 'none');
  assert.deepEqual(r.json.results, []);
  assert.equal(r._exit, 0);
});

// --- recall: the archived corpus a closed milestone leaves behind (RCL-07) ----
// The residue file is read beside CAPTURE.md, LAST in the corpus, so a tree
// with no ARCHIVE.md emits exactly the bytes it emitted before this walk
// existed - that byte-identity is the first assertion below, not a remark.

/** Write an ARCHIVE.md into a fixture tree; `rows` are raw grammar lines. */
function archive(dir, label, rows) {
  writeFileSync(join(dir, 'ARCHIVE.md'),
    `# Archive\n\n## ${label}\n\n${rows.map((r) => `- ${r}`).join('\n')}\n`);
  return dir;
}

test('recall: an archived row comes back with its milestone label and its origin', () => {
  const dir = makeTree({ phases: { 1: { summaryBody: { deviations: ['a live deviation'] } } } });
  archive(dir, 'v3.5.2', [
    '`phases/2/SUMMARY.md`: the zarquon guard fired on a range it did not own',
    '`phases/2.1/UAT.md`: walk the zarquon install from a cold clone',
    '`phases/2/CONTEXT.md`: D-04 (RCL-07): each zarquon row names its origin',
  ]);
  const r = recall('zarquon', dir);
  assert.equal(r.json.ok, true);
  assert.equal(r._exit, 0);
  const hits = r.json.results;
  assert.equal(hits.length, 3, JSON.stringify(hits));
  // Distinguishable from each other AND from a live row: the label leads, the
  // origin artifact follows, and `phase` keeps the meaning a live row gives it.
  assert.deepEqual(new Set(hits.map((h) => h.source)), new Set([
    'v3.5.2/phases/2/SUMMARY.md',
    'v3.5.2/phases/2.1/UAT.md',
    'v3.5.2/phases/2/CONTEXT.md',
  ]));
  const uat = hits.find((h) => h.source.endsWith('UAT.md'));
  assert.equal(uat.phase, 2.1, 'a decimal phase survives the round trip');
  assert.deepEqual(Object.keys(uat).sort(), ['phase', 'score', 'snippet', 'source'],
    'the result contract stays exactly four fields wide');
});

test('recall: a tree with no ARCHIVE.md answers byte-identically to one that never had it', () => {
  const spec = {
    phases: { 1: { summaryBody: { deviations: ['alpha beta gamma'] } } },
    capture: [{ section: 'Todos', text: 'wire the beta recall path', phase: 1 }],
  };
  const bare = recall('beta gamma', makeTree(spec));
  const empty = recall('beta gamma', archive(makeTree(spec), 'v3.5.2', []));
  assert.equal(bare.raw, empty.raw, 'an ARCHIVE.md with no rows changes no byte');
  // And the archived rows land AFTER the live ones, so no existing corpus INDEX
  // moved: the live hits come back in the same order, the same rows.
  //
  // Their SCORES do move, and deliberately not asserted: BM25 is corpus-
  // relative, so any new document shifts N, avgdl and every idf term. Pinning
  // the numbers here would make an unrelated row added to a project's residue
  // redden this file. What the position guarantees is the tie-break - equal
  // scores resolve by corpus position - which is why the append goes last.
  const withRows = recall('beta gamma', archive(makeTree(spec), 'v3.5.2',
    ['`phases/9/SUMMARY.md`: an unrelated retired note']));
  assert.deepEqual(withRows.json.results.map((r) => [r.source, r.snippet]),
    bare.json.results.map((r) => [r.source, r.snippet]));
});

test('recall: two runs over a corpus holding live AND archived rows are byte-identical', () => {
  const dir = makeTree({
    phases: { 1: { summaryBody: { deviations: ['alpha beta gamma'] } } },
    capture: [{ section: 'Seeds', text: 'gamma indexing idea' }],
  });
  archive(dir, 'v3.5.2', [
    '`phases/1/SUMMARY.md`: beta gamma from the closed milestone',
    '`phases/1/CONTEXT.md`: D-01 (REC-01): gamma stays flat-ranked',
  ]);
  const a = recall('beta gamma', dir);
  const b = recall('beta gamma', dir);
  assert.equal(a.raw, b.raw);
  assert.ok(a.json.results.length >= 3, JSON.stringify(a.json.results));
});

test('recall: memory.backend none reads no ARCHIVE.md either', () => {
  const dir = makeTree({
    phases: { 1: { summaryBody: { deviations: ['a live deviation'] } } },
    config: { memory: { backend: 'none' } },
  });
  archive(dir, 'v3.5.2', ['`phases/2/SUMMARY.md`: the zarquon guard, retired']);
  const r = recall('zarquon', dir);
  assert.equal(r.json.backend, 'none');
  assert.deepEqual(r.json.results, []);
  assert.equal(r.json.total, 0);
  assert.equal(r._exit, 0);
});

// --- detect-commands: the unconfigured static-analysis path (QW-01) ----------

/** A project root holding exactly the named files, one directory deep. */
function projectTree(files) {
  const root = mkdtempSync(join(tmpdir(), 'cad-detect-'));
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(root, name), typeof body === 'string' ? body : JSON.stringify(body));
  }
  return root;
}

/** Executable stubs at `<root>/node_modules/.bin`, which is where `npx`
 *  resolves a delegated tool. Bytes in the fixture's own tree, so the
 *  npx-delegated arm is pinned without any machine's install. */
function nodeModulesBin(root, tools) {
  const dir = join(root, 'node_modules', '.bin');
  mkdirSync(dir, { recursive: true });
  for (const t of tools) writeFileSync(join(dir, t), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  return root;
}

/**
 * Every tool this block's fixtures name. Passed as the reachable set by
 * default, so a row asserting WHICH command an arm produces is not also an
 * assertion about what is installed on the machine running the suite (RCH-01,
 * D-11): with the reachability rule live and no override, the `ruff`, `mypy`
 * and two `go` rows fail on a dev box without those tools, and the
 * `npx eslint`/`npx tsc` rows fail in every mkdtemp tree, which has no
 * `node_modules`. A row that is ABOUT reachability passes its own narrower set.
 */
const EVERY_TOOL = 'npm,npx,cargo,ruff,mypy,go,eslint,tsc';

/**
 * detect-commands takes --root (the PROJECT root), never --dir.
 *
 * `reachable` is the set the seam reads in place of its own probe, behind the
 * `CADENCE_TEST_SEAM` sentinel; `null` runs the real probe, and `seam: false`
 * sets the variable with NO sentinel, which must be ignored. A row that needs
 * the LIVE probe stays hermetic by putting its binaries in the fixture's own
 * `node_modules/.bin` (see nodeModulesBin) rather than relying on the machine.
 */
function detect(root, { extra = [], reachable = EVERY_TOOL, seam = true } = {}) {
  const env = { ...process.env };
  delete env.CADENCE_TEST_SEAM;
  delete env.CADENCE_DETECT_REACHABLE;
  if (seam) env.CADENCE_TEST_SEAM = '1';
  if (reachable !== null) env.CADENCE_DETECT_REACHABLE = reachable;
  try {
    return JSON.parse(execFileSync('node', [PLANNING, 'detect-commands', '--root', root, ...extra],
      { encoding: 'utf8', env }));
  } catch (e) {
    return JSON.parse(e.stdout);
  }
}

test('detect-commands: a package.json lint script is the command', () => {
  const r = detect(projectTree({ 'package.json': { scripts: { lint: 'eslint .' } } }));
  assert.equal(r.ok, true);
  assert.equal(r.lint, 'npm run lint');
  assert.equal(r.typecheck, null);
  assert.equal(r.source.lint, 'package.json');
  assert.equal(r.source.typecheck, null);
});

test('detect-commands: both package.json typecheck spellings', () => {
  assert.equal(detect(projectTree({ 'package.json': { scripts: { typecheck: 'tsc' } } })).typecheck,
    'npm run typecheck');
  assert.equal(detect(projectTree({ 'package.json': { scripts: { 'type-check': 'tsc' } } })).typecheck,
    'npm run type-check');
});

test('detect-commands: Cargo.toml answers both slots', () => {
  const r = detect(projectTree({ 'Cargo.toml': '[package]\nname = "x"\n' }));
  assert.equal(r.lint, 'cargo clippy --all-targets -- -D warnings');
  assert.equal(r.typecheck, 'cargo check --all-targets');
  assert.equal(r.source.lint, 'Cargo.toml');
});

test('detect-commands: pyproject.toml answers per TABLE, not per file', () => {
  const ruff = detect(projectTree({ 'pyproject.toml': '[tool.ruff]\nline-length = 100\n' }));
  assert.equal(ruff.lint, 'ruff check .');
  assert.equal(ruff.typecheck, null);          // no [tool.mypy table
  const mypy = detect(projectTree({ 'pyproject.toml': '[tool.mypy]\nstrict = true\n' }));
  assert.equal(mypy.lint, null);
  assert.equal(mypy.typecheck, 'mypy .');
  // A pyproject with neither table names neither command.
  const bare = detect(projectTree({ 'pyproject.toml': '[project]\nname = "x"\n' }));
  assert.equal(bare.lint, null);
  assert.equal(bare.typecheck, null);
});

test('detect-commands: go.mod answers both slots', () => {
  const r = detect(projectTree({ 'go.mod': 'module example.com/x\n' }));
  assert.equal(r.lint, 'go vet ./...');
  assert.equal(r.typecheck, 'go build ./...');
});

test('detect-commands: an eslint config, flat or legacy, is the last lint arm', () => {
  assert.equal(detect(projectTree({ 'eslint.config.mjs': 'export default [];\n' })).lint,
    'npx eslint .');
  const legacy = detect(projectTree({ '.eslintrc.json': '{}' }));
  assert.equal(legacy.lint, 'npx eslint .');
  assert.equal(legacy.source.lint, '.eslintrc.json');
});

test('detect-commands: the project\'s own script beats a tool config in the same tree', () => {
  const r = detect(projectTree({
    'package.json': { scripts: { lint: 'biome check .', typecheck: 'tsc -p .' } },
    'eslint.config.js': 'module.exports = [];\n',
    'tsconfig.json': '{}',
  }));
  assert.equal(r.lint, 'npm run lint');
  assert.equal(r.typecheck, 'npm run typecheck');
  assert.equal(r.source.lint, 'package.json');
  assert.equal(r.source.typecheck, 'package.json');
});

test('detect-commands: two EXACT tsconfig names, each with the form that points at it', () => {
  const plain = detect(projectTree({ 'tsconfig.json': '{}' }));
  assert.equal(plain.typecheck, 'npx tsc --noEmit');
  assert.equal(plain.source.typecheck, 'tsconfig.json');

  // `npx tsc --noEmit` ignores a config it is not pointed at, so the CI name
  // brings the `-p` form that does point at it - a fixed literal, never a
  // command built out of the matched file name.
  const ci = detect(projectTree({ 'tsconfig.ci.json': '{}' }));
  assert.equal(ci.typecheck, 'npx tsc -p tsconfig.ci.json');
  assert.equal(ci.source.typecheck, 'tsconfig.ci.json');
});

test('detect-commands: a tree carrying BOTH tsconfigs answers with the project\'s own', () => {
  // Order, not coincidence: `tsconfig.json` is the project's own typecheck and
  // the CI file is the narrower one, so the second arm must never shadow the
  // first.
  const both = detect(projectTree({ 'tsconfig.json': '{}', 'tsconfig.ci.json': '{}' }));
  assert.equal(both.typecheck, 'npx tsc --noEmit');
  assert.equal(both.source.typecheck, 'tsconfig.json');
});

test('detect-commands: a NEAR-miss tsconfig name still matches nothing', () => {
  // The glob this pair still refuses. `tsconfig.build.json` is an ordinary
  // third spelling and names no command, which is what keeps "two exact names"
  // a rule rather than a description of today's tree.
  const other = detect(projectTree({ 'tsconfig.build.json': '{}' }));
  assert.equal(other.typecheck, null);
  assert.equal(other.source.typecheck, null);
});

test('detect-commands: nothing detected is ok:true with both null', () => {
  const r = detect(projectTree({ 'README.md': '# x\n' }));
  assert.equal(r.ok, true);
  assert.equal(r.lint, null);
  assert.equal(r.typecheck, null);
  assert.deepEqual(r.source, { lint: null, typecheck: null });
  assert.equal('warnings' in r, false);
});

test('detect-commands: a malformed package.json warns and contributes nothing', () => {
  const r = detect(projectTree({ 'package.json': '{ "scripts": ' }));
  assert.equal(r.ok, true);
  assert.equal(r.lint, null);
  assert.equal(r.typecheck, null);
  assert.equal(r.warnings.length, 1, JSON.stringify(r.warnings));
  assert.match(r.warnings[0], /package\.json failed to parse/);
});

test('detect-commands: a malformed package.json does not block a later arm', () => {
  const r = detect(projectTree({ 'package.json': 'not json', 'go.mod': 'module x\n' }));
  assert.equal(r.lint, 'go vet ./...');
  assert.equal(r.warnings.length, 1);
});

test('detect-commands: a scripts block that is not an object is not read as one', () => {
  const r = detect(projectTree({ 'package.json': { scripts: ['lint'] } }));
  assert.equal(r.lint, null);
  assert.equal(r.typecheck, null);
});

test('detect-commands: the root is read one directory deep, never recursively', () => {
  const root = projectTree({ 'README.md': '# x\n' });
  mkdirSync(join(root, 'sub'));
  writeFileSync(join(root, 'sub', 'package.json'), JSON.stringify({ scripts: { lint: 'x' } }));
  const r = detect(root);
  assert.equal(r.lint, null);
});

test('detect-commands: an unlistable root is ok:false, never a silent nothing', () => {
  const r = detect(join(tmpdir(), 'cad-detect-does-not-exist'));
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-root');
});

// --- detect-commands: a command is named only when it can be RUN (RCH-01) ----

test('detect-commands: an unreachable winning arm nulls its slot and never falls through', () => {
  // The measured shape D-05 refuses: `[tool.ruff]` names the lint arm, `go.mod`
  // sits below it, and ruff is absent. Falling through would tell this project
  // to run `go vet ./...` - a linter its maintainers did not choose, over a
  // language the change may not touch.
  const r = detect(projectTree({
    'pyproject.toml': '[tool.ruff]\nline-length = 100\n',
    'go.mod': 'module example.com/x\n',
  }), { reachable: 'go' });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.lint, null);
  assert.equal(r.source.lint, null, 'a nulled slot claims no provenance');
  assert.notEqual(r.lint, 'go vet ./...');
  assert.equal(r.warnings.filter((w) => w.includes('ruff')).length, 1, JSON.stringify(r.warnings));
  assert.match(r.warnings.find((w) => w.includes('ruff')), /pyproject\.toml/);
  // The lower arm is still available to its OWN slot: `go` is reachable here,
  // so the typecheck answer is unaffected. Nulling is per slot, not per tree.
  assert.equal(r.typecheck, 'go build ./...');
  assert.equal(r.source.typecheck, 'go.mod');
});

test('detect-commands: an npx arm probes the DELEGATED tool, not the driver alone', () => {
  // `npx` is on PATH almost everywhere, so a driver-only rule would leave
  // `npx eslint .` naming an eslint nobody has (D-04).
  const tree = { 'eslint.config.mjs': 'export default [];\n' };
  const without = detect(projectTree(tree), { reachable: 'npx' });
  assert.equal(without.lint, null);
  assert.equal(without.source.lint, null);
  assert.equal(without.warnings.filter((w) => w.includes('eslint')).length, 1,
    JSON.stringify(without.warnings));
  const with_ = detect(projectTree(tree), { reachable: 'npx,eslint' });
  assert.equal(with_.lint, 'npx eslint .');
  assert.equal(with_.source.lint, 'eslint.config.mjs');
});

test('detect-commands: the LIVE probe resolves a delegated tool out of node_modules/.bin', () => {
  // Where `npx` itself looks, and the half a PATH-only rule would drop: this is
  // the shape of a TypeScript repo whose only static-analysis command is the
  // one CI runs, with `tsc` installed as a dependency and absent from PATH.
  // Both binaries live in the FIXTURE's node_modules/.bin, so the row proves
  // the production probe without depending on what this machine has installed.
  const root = nodeModulesBin(projectTree({ 'tsconfig.ci.json': '{}' }), ['npx', 'tsc']);
  const r = detect(root, { reachable: null });
  assert.equal(r.typecheck, 'npx tsc -p tsconfig.ci.json', JSON.stringify(r));
  assert.equal(r.source.typecheck, 'tsconfig.ci.json');
  assert.equal('warnings' in r, false, JSON.stringify(r.warnings));
  // Only the POSITIVE half is asserted against the live probe, deliberately. A
  // fixture can guarantee a binary is PRESENT (it wrote it), and nothing on the
  // machine can take it away; it cannot guarantee one is ABSENT, because a box
  // with tsc installed answers `true` correctly and the row would fail for
  // being right. The unreachable-delegated-tool half is pinned above, through
  // the override, where the set is stated rather than discovered.
});

test('detect-commands: an EMPTY reachable set means nothing is reachable', () => {
  // The `||` hazard, pinned: an empty override is falsy, so a seam that read it
  // through `|| probe` would silently run the live probe and answer about the
  // machine. The fixture's own node_modules/.bin would otherwise resolve both
  // binaries, which is exactly what makes this row discriminating.
  const root = nodeModulesBin(projectTree({ 'tsconfig.ci.json': '{}' }), ['npx', 'tsc']);
  const r = detect(root, { reachable: '' });
  assert.equal(r.typecheck, null, JSON.stringify(r));
  assert.equal(r.source.typecheck, null);
});

test('detect-commands: the reachable set WITHOUT the sentinel is ignored', () => {
  // The gate EXP-01 asks for: this variable decides which static-analysis
  // command an executor is told to run, so a repo-supplied .envrc setting it
  // must change nothing. Same fixture and same empty value as the row above,
  // which answered `null` there and answers the live probe here.
  const root = nodeModulesBin(projectTree({ 'tsconfig.ci.json': '{}' }), ['npx', 'tsc']);
  const r = detect(root, { reachable: '', seam: false });
  assert.equal(r.typecheck, 'npx tsc -p tsconfig.ci.json', JSON.stringify(r));
});

// --- a blank --root is refused by BOTH --root subcommands (COR-01) ----------
// `detect-surfaces` is tested here rather than beside its scanner for the same
// reason `trace ignore` is: this is the `--root` refusal, and the two rows sit
// two lines apart in the dispatch table. Measured before the fix: `--root ""`
// answered `ok:true` about the CWD from both commands - the silent substitution
// #42/#45 closed for the valueless spelling and missed for the empty one - and
// `--root "   "` answered `no-root`, a second vocabulary for one refusal. All
// three shapes now take `debt-harvest`'s predicate, trim clause included.

/** Any planning.mjs argv, parsed off stdout on either exit code. */
function runPlanning(...args) {
  try {
    return JSON.parse(execFileSync('node', [PLANNING, ...args], { encoding: 'utf8' }));
  } catch (e) { return JSON.parse(e.stdout); }
}

const BLANK_ROOTS = [
  { name: '--root with nothing after it', args: ['--root'] },
  { name: 'an empty --root ""', args: ['--root', ''] },
  { name: 'a whitespace-only --root', args: ['--root', '   '] },
];

for (const cmd of ['detect-commands', 'detect-surfaces']) {
  for (const row of BLANK_ROOTS) {
    test(`${cmd}: ${row.name} is bad-args, not answered about cwd`, () => {
      const r = runPlanning(cmd, ...row.args);
      assert.equal(r.ok, false, JSON.stringify(r));
      assert.equal(r.reason, 'bad-args', JSON.stringify(r));
    });
  }
}

test('detect-commands: a real --root still answers about THAT tree', () => {
  // Through `detect` rather than `runPlanning` - the argv is the same, and the
  // helper pins the reachable set so this row asserts WHICH tree was read
  // rather than whether the machine running the suite has npm (RCH-01, D-11).
  const root = projectTree({ 'package.json': { scripts: { lint: 'eslint .' } } });
  const r = detect(root);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.root, root);
  assert.equal(r.lint, 'npm run lint');
});

test('detect-surfaces: a real --root still answers about THAT tree', () => {
  const root = projectTree({ 'package.json': { dependencies: { stripe: '^1' } } });
  const r = runPlanning('detect-surfaces', '--root', root);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.root, root);
  assert.deepEqual(r.evidenced.map((e) => e.category), ['billing']);
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

// --- lease-check: the declared file lease, enforced (QW-03) ------------------

/**
 * A scratch GIT repo whose `.planning/phases/<n>/` holds one plan declaring
 * `files`. Returns {repo, dir} - the seam is run with cwd inside the repo,
 * because it resolves the staged set from `git rev-parse --show-toplevel`.
 */
function leaseRepo({ phase = 1, plan = 'PLAN.md', files = ['a.txt'], body = '' } = {}) {
  const repo = mkdtempSync(join(tmpdir(), 'cad-lease-'));
  execFileSync('git', ['init', '-q'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 't@example.com'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 'T'], { cwd: repo });
  const dir = join(repo, '.planning');
  const pdir = join(dir, 'phases', String(phase));
  mkdirSync(pdir, { recursive: true });
  const fm = files === null ? '' : `---\nphase: ${phase}\nfiles:\n${files.map((f) => `  - ${f}\n`).join('')}---\n`;
  writeFileSync(join(pdir, plan), `${fm}# Plan\n${body}`);
  return { repo, dir, pdir };
}

/** Run the seam inside a repo; parse its one JSON line and its exit code.
 * `env` is merged over the inherited environment, which is how the AC8 arm
 * below points the seam's own `git rev-parse` at an unreadable GIT_DIR. */
function leaseCheck(repo, dir, args, env) {
  let stdout;
  let code = 0;
  try {
    stdout = execFileSync('node', [PLANNING, '--dir', dir, 'lease-check', ...args],
      { encoding: 'utf8', cwd: repo, ...(env ? { env: { ...process.env, ...env } } : {}) });
  } catch (e) { stdout = e.stdout; code = e.status; }
  return { ...JSON.parse(stdout), _exit: code };
}

const stage = (repo, name, body = 'x') => {
  const file = join(repo, name);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body);
  execFileSync('git', ['add', '--', name], { cwd: repo });
};

test('lease-check: a clean lease is ok:true', () => {
  const { repo, dir } = leaseRepo({ files: ['a.txt', 'src/b.js'] });
  stage(repo, 'a.txt');
  stage(repo, 'src/b.js');
  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.staged, 2);
  assert.equal(r.declared, 2);
  assert.equal(r._exit, 0);
});

test('lease-check: an undeclared staged path is refused and NAMED', () => {
  const { repo, dir } = leaseRepo({ files: ['a.txt'] });
  stage(repo, 'a.txt');
  stage(repo, 'b.txt');
  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'undeclared-files');
  assert.deepEqual(r.undeclared, ['b.txt']);
  assert.match(r.hint, /files: list/);
  assert.equal(r._exit, 1);
});

test('lease-check: the plan\'s OWN report file is the one exemption', () => {
  const { repo, dir } = leaseRepo({ files: ['a.txt'] });
  stage(repo, '.planning/phases/1/reports/plan-1.md');
  assert.equal(leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']).ok, true);
  // ...and nothing else under reports/ is: another plan's report is undeclared.
  stage(repo, '.planning/phases/1/reports/plan-2.md');
  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, false);
  assert.deepEqual(r.undeclared, ['.planning/phases/1/reports/plan-2.md']);
});

test('lease-check: the ROTATED report is exempt too, beside the canonical one', () => {
  // AC5. Since #195 an executor rotates the previous run's report aside before
  // its first write, so a re-run holds `plan-1.md` and `plan-1.1.md` at once and
  // stages both on the same task commit. Under byte equality the rotated
  // sibling read as an undeclared file, blocking the executor for obeying its
  // own contract - the one place SUMMARY.md named the two halves as able to
  // collide.
  const { repo, dir } = leaseRepo({ files: ['a.txt'] });
  stage(repo, '.planning/phases/1/reports/plan-1.md');
  stage(repo, '.planning/phases/1/reports/plan-1.1.md');
  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r._exit, 0);
  // The count is taken BEFORE the exemption filter, so widening the exemption
  // moves no reported number (D-09).
  assert.equal(r.staged, 2);
  assert.equal(r.undeclared, undefined);

  // A two-digit suffix is the same name shape; the picker mints one once nine
  // are taken.
  stage(repo, '.planning/phases/1/reports/plan-1.12.md');
  assert.equal(leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']).ok, true);
});

test('lease-check: the widened exemption is still THIS plan\'s, not the directory\'s', () => {
  // AC5's second half and AC6. `plan-2.md` is another plan's record and
  // `plan-11.md` is plan eleven's, neither of them plan 1 rotated; the two risk
  // diffs live in this same directory and a `risk_surface` checkpoint
  // deliberately leaves them staged, so a directory lease would let a blocking
  // gate's own flagged evidence ride into a task commit. `PLAN-1.1.MD` is a
  // name no executor produces (D-08), and a nested `reports/old/plan-1.1.md` is
  // not directly in the directory the exemption names.
  for (const name of ['plan-2.md', 'plan-11.md', 'plan-1-risk.diff',
    'plan-1-risk-task-2.diff', 'PLAN-1.1.MD', 'old/plan-1.1.md']) {
    const { repo, dir } = leaseRepo({ files: ['a.txt'] });
    stage(repo, '.planning/phases/1/reports/plan-1.md');
    stage(repo, `.planning/phases/1/reports/${name}`);
    const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
    assert.equal(r.ok, false, `${name} was exempted: ${JSON.stringify(r)}`);
    assert.equal(r.reason, 'undeclared-files');
    assert.deepEqual(r.undeclared, [`.planning/phases/1/reports/${name}`]);
    assert.equal(r._exit, 1);
  }
});

test('lease-check: a declared directory ends in / and matches by PREFIX', () => {
  const { repo, dir } = leaseRepo({ files: ['src/auth/'] });
  stage(repo, 'src/auth/session.js');
  assert.equal(leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']).ok, true);
  // A non-slashed declaration never licenses a sibling by substring.
  const b = leaseRepo({ files: ['src/auth'] });
  stage(b.repo, 'src/authority.js');
  assert.equal(leaseCheck(b.repo, b.dir, ['--phase', '1', '--plan', '1']).ok, false);
});

// Both readers now reach containment through lib/lease-grammar.mjs. These two
// pin the half that must NOT have moved: for a declaration that was already
// unambiguous, the verdict and both counts are what they were before the
// shared predicate existed, and an empty lease still licenses nothing.

test('lease-check: a two-file clean lease still reports staged: 2, declared: 2 through the shared predicate', () => {
  const { repo, dir } = leaseRepo({ files: ['a.txt', 'src/b.js'] });
  stage(repo, 'a.txt');
  stage(repo, 'src/b.js');
  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.staged, 2);
  assert.equal(r.declared, 2);
  assert.equal(r.undeclared, undefined);
  assert.equal(r._exit, 0);
});

test('lease-check: a plan whose files: list is empty is still refused as undeclared-files, exit 1', () => {
  const { repo, dir } = leaseRepo({ files: [] });
  stage(repo, 'a.txt');
  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'undeclared-files');
  assert.deepEqual(r.undeclared, ['a.txt']);
  assert.equal(r.declared, 0);
  assert.equal(r._exit, 1);
});

test('lease-check: PLAN-<k>.md is selected by --plan', () => {
  const { repo, dir, pdir } = leaseRepo({ plan: 'PLAN-1.md', files: ['a.txt'] });
  writeFileSync(join(pdir, 'PLAN-2.md'), '---\nphase: 1\nfiles:\n  - b.txt\n---\n# Plan 2\n');
  stage(repo, 'b.txt');
  assert.equal(leaseCheck(repo, dir, ['--phase', '1', '--plan', '2']).ok, true);
  const one = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(one.ok, false);
  assert.deepEqual(one.undeclared, ['b.txt']);
});

test('lease-check: a sole declaration of ./a.txt licenses nothing - the spelling reached neither reader', () => {
  // The other half of the two-door refusal, at the enforcement end: the
  // declaration is dropped before this seam sees it, so staging the file it
  // MEANT is undeclared, and the named diagnostic rides the same envelope that
  // tells the author why.
  const { repo, dir } = leaseRepo({ files: ['./a.txt'] });
  stage(repo, 'a.txt');
  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'undeclared-files');
  assert.deepEqual(r.undeclared, ['a.txt']);
  assert.equal(r.declared, 0);
  assert.deepEqual(r.frontmatter_issues.map((i) => [i.line, i.code]),
    [[4, 'redundant-path-segment']], JSON.stringify(r.frontmatter_issues));
  assert.equal(r._exit, 1);
});

test('lease-check: a missing plan is ok:false, never an empty-lease pass', () => {
  const { repo, dir } = leaseRepo({ files: ['a.txt'] });
  stage(repo, 'a.txt');
  const r = leaseCheck(repo, dir, ['--phase', '9', '--plan', '1']);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-plan');
  assert.equal(r._exit, 1);
});

test('lease-check: an unreadable staged set is ok:false, never a pass', () => {
  // Outside any git repo `rev-parse --show-toplevel` fails, and an unprovable
  // lease must refuse rather than report a clean one.
  const outside = mkdtempSync(join(tmpdir(), 'cad-lease-nogit-'));
  const dir = join(outside, '.planning');
  mkdirSync(join(dir, 'phases', '1'), { recursive: true });
  writeFileSync(join(dir, 'phases', '1', 'PLAN.md'), '---\nphase: 1\nfiles:\n  - a.txt\n---\n');
  const r = leaseCheck(outside, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-staged-set');
});

test('lease-check: the no-staged-set detail names the failure without a credential', () => {
  // The fourth emit site EXP-01 covers, end to end rather than by source read:
  // `GIT_DIR` at an unreadable path makes the seam's own `git rev-parse
  // --show-toplevel` fail with `fatal: not a git repository: '<path>'`, and git
  // quotes the path back verbatim - so a path carrying userinfo puts a
  // credential straight into `detail`. Measured 2026-08-13 on git 2.55.0. No
  // network: the path does not exist and `.invalid` is reserved.
  const outside = mkdtempSync(join(tmpdir(), 'cad-lease-leak-'));
  const dir = join(outside, '.planning');
  mkdirSync(join(dir, 'phases', '1'), { recursive: true });
  writeFileSync(join(dir, 'phases', '1', 'PLAN.md'), '---\nphase: 1\nfiles:\n  - a.txt\n---\n');
  const r = leaseCheck(outside, dir, ['--phase', '1', '--plan', '1'],
    { GIT_DIR: '/nonexistent/cad:s3cr3t-tok@host.invalid/g' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-staged-set');
  assert.ok(r.detail && r.detail.length > 0, JSON.stringify(r));
  assert.equal(r.detail.includes('s3cr3t-tok'), false, r.detail);
  assert.equal(r.detail.includes('cad:'), false, r.detail);
  // The rest of the message survives, or the redaction has traded one useless
  // envelope for another: the host, the path, and the seam's own wording.
  assert.ok(r.detail.includes('could not read the staged set'), r.detail);
  assert.ok(r.detail.includes('host.invalid'), r.detail);
  assert.ok(r.detail.includes('/nonexistent/'), r.detail);
});

test('source: planning.mjs\'s no-staged-set detail goes through redactUrl', () => {
  // The census, so a site added later fails here rather than shipping a
  // credential. planning.mjs carries SEVEN other caught-error details this
  // requirement does not cover - partial-apply, phase-done's partial-flip,
  // write-failed, the dispatch-level internal catch, `capture --text-file`'s
  // read failure, `capture-sections`' unreadable-capture and `uat record
  // --fields-file`'s JSON parse failure - so the pin is by COUNT: twelve uses
  // exactly five of them wrapped. Adding a site moves the first number whether
  // or not the author remembered the helper.
  //
  // The first four wrapped sites, all git failures on the same EXP-01 rail:
  // `cmdLeaseCheck`'s `no-staged-set` detail; `resolveRange`, where a failing
  // `git rev-parse` quotes back a remote URL that can carry credentials in its
  // userinfo, and whose redacted error is the detail BOTH `risk-check run`
  // (`no-diff`) and `risk-check status` (`unresolved-range`) emit;
  // `risk-check run`'s own `git diff` catch; and `groundCitations`' probe,
  // whose failure is the one the adjudication record reports as a grounding
  // check that could not run. A git failure detail is exactly the string EXP-01
  // covers, so a git call added to this file arrives wrapped or this row goes
  // red - which is how this row answered the tenth site.
  //
  // The FIFTH wrapped site is not a git failure: it is `readQueue`'s, shared by
  // its scandir, lstat and JSON.parse arms. The parse arm is why it is wrapped
  // at all - a queue member's bytes are what a REVIEW PROVIDER returned, so
  // V8's parse message quotes text this repository did not author, and that
  // detail is printed straight at a human by the land refusal. One helper
  // covers all three arms rather than the parse arm alone, because splitting
  // them would leave the next arm added there to guess which class it is in.
  //
  // Why `capture --text-file`, `capture-sections` and phase-done's
  // partial-flip are NOT wrapped: each
  // detail is an `fs` error over a path the CALLER just named, so the only
  // string it can echo is one the caller already holds - partial-flip's is
  // whatever atomicWrite threw over `--dir`'s own ROADMAP.md or
  // REQUIREMENTS.md, and this seam makes no network call at all. `redactUrl` targets a
  // credential arriving from a remote the user never typed, which a local path
  // read cannot be. `uat record --fields-file`'s parse failure is the same
  // class one step further in: a JSON syntax error over the caller's own file.
  // The `-file` transports' READ failures are not counted here at all - they
  // live in lib/text-flag-file.mjs, which this file-scoped census does not
  // walk, and they are the same caller-named-path class.
  //
  // `task-record` added BOTH classes at once, which is what this row is for: its
  // `git log`/`git diff` catch is wrapped, on the same argument as `risk-check
  // run`'s, and its `mkdirSync`/`atomicWrite` catch is NOT - that detail is an
  // `fs` error over the path `--dir` just named, the caller-named-path class
  // `capture --text-file` and phase-done's partial-flip already sit in.
  const IDIOM = /e && e\.message \? e\.message : String\(e\)/g;
  const WRAPPED = /redactUrl\(e && e\.message \? e\.message : String\(e\)\)/g;
  const src = seamSource();
  assert.equal((src.match(IDIOM) || []).length, 14, 'the planning seam gained or lost a detail site');
  assert.equal((src.match(WRAPPED) || []).length, 6,
    'a git-failure detail (no-staged-set, resolveRange, risk-check run\'s diff catch, '
    + 'task-record\'s range read or groundCitations\' probe) or readQueue\'s '
    + 'provider-authored parse detail is unredacted');
  assert.match(src, /could not read the staged set: \$\{redactUrl\(/);
});

test('lease-check: nothing staged is a clean lease, not a refusal', () => {
  const { repo, dir } = leaseRepo({ files: ['a.txt'] });
  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, true);
  assert.equal(r.staged, 0);
});

test('lease-check: a plan declaring nothing licenses nothing', () => {
  const { repo, dir } = leaseRepo({ files: [] });
  stage(repo, 'a.txt');
  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, false);
  assert.deepEqual(r.undeclared, ['a.txt']);
});

test('lease-check: bad flags are refused before any read', () => {
  const { repo, dir } = leaseRepo({});
  assert.equal(leaseCheck(repo, dir, ['--plan', '1']).reason, 'bad-args');
  assert.equal(leaseCheck(repo, dir, ['--phase', '1']).reason, 'bad-args');
  assert.equal(leaseCheck(repo, dir, ['--phase', '1', '--plan', 'x']).reason, 'bad-args');
});

/**
 * A git call inside a scratch lease repo with the user's own global/system
 * config neutralized - `commit.gpgsign` in a developer's global config would
 * otherwise make the seed commit prompt for a passphrase in CI.
 */
const leaseGit = (repo, args) => execFileSync('git', args, {
  cwd: repo,
  stdio: 'pipe',
  env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' },
});

test('lease-check: a rename is checked on BOTH sides, so another plan\'s file is not renamed away', () => {
  // src/other.js belongs to some OTHER plan: committed, and NOT declared here.
  // Renaming it onto this plan's declared `a.txt` destroys it, and a
  // destination-only read reports a clean lease.
  const { repo, dir } = leaseRepo({ files: ['a.txt'] });
  const src = join(repo, 'src', 'other.js');
  mkdirSync(dirname(src), { recursive: true });
  writeFileSync(src, 'module.exports = 1;\n');
  leaseGit(repo, ['add', '--', 'src/other.js']);
  leaseGit(repo, ['commit', '-qm', 'seed']);
  leaseGit(repo, ['mv', 'src/other.js', 'a.txt']);

  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'undeclared-files');
  assert.ok(r.undeclared.includes('src/other.js'),
    `the rename SOURCE must be named: ${JSON.stringify(r)}`);
});

test('lease-check: a declared non-ASCII path is admitted, not refused for its bytes', () => {
  // At default `core.quotePath` git returns `"src/caf\303\251.js"` - quoted and
  // octal-escaped - and the lease refuses a path it was itself handed.
  const { repo, dir } = leaseRepo({ files: ['src/café.js'] });
  stage(repo, 'src/café.js');
  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.staged, 1);
});

/**
 * An absolute path under `repo` whose basename carries ONE byte that is not
 * valid UTF-8 (`src/caf<byte>.js`). Two different such bytes produce two
 * DIFFERENT paths that a utf8 decode renders identically as `src/caf<U+FFFD>.js`
 * - which is the whole point of the two cases below.
 */
const rawLeasePath = (repo, byte) => Buffer.concat([
  Buffer.from(`${repo}/src/caf`), Buffer.from([byte]), Buffer.from('.js'),
]);

/** A plan file written BYTE-EXACTLY, so `files:` can name a non-UTF-8 path. */
const rawPlan = (pdir, byte) => writeFileSync(join(pdir, 'PLAN.md'), Buffer.concat([
  Buffer.from('---\nphase: 1\nfiles:\n  - src/caf'), Buffer.from([byte]),
  Buffer.from('.js\n---\n# Plan\n'),
]));

test('lease-check: a rename between two un-decodable paths is never a clean lease', () => {
  // `git mv src/caf<0xE9>.js src/caf<0xFF>.js` with only the DESTINATION
  // declared destroys another plan's file. git reports it correctly
  // (`R100\0src/caf\351.js\0src/caf\377.js\0`), but reading that stream as a
  // utf8 STRING maps both invalid bytes to U+FFFD, the two paths collapse to
  // one, and the source is licensed by the destination's declaration.
  const { repo, dir, pdir } = leaseRepo({ files: [] });
  rawPlan(pdir, 0xFF);
  const src = rawLeasePath(repo, 0xE9);
  const dst = rawLeasePath(repo, 0xFF);
  mkdirSync(join(repo, 'src'), { recursive: true });
  writeFileSync(src, 'module.exports = 1;\n');
  leaseGit(repo, ['add', '-A']);
  leaseGit(repo, ['commit', '-qm', 'seed']);
  renameSync(src, dst);
  leaseGit(repo, ['add', '-A']);

  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.notEqual(r.ok, true,
    `a rename destroying an undeclared file must not pass: ${JSON.stringify(r)}`);
  assert.equal(r.reason, 'unrepresentable-paths', JSON.stringify(r));
  assert.deepEqual(r.unrepresentable, ['"src/caf\\351.js"', '"src/caf\\377.js"']);
});

test('lease-check: a staged path that is not valid UTF-8 is refused BY NAME, never guessed at', () => {
  // The declared side is read from a utf8 plan file, so it cannot represent
  // this path either. Neither side of the comparison can be honest about it and
  // the gate says so, rather than matching two replacement characters and
  // licensing every sibling that differs only in its invalid bytes.
  const { repo, dir, pdir } = leaseRepo({ files: [] });
  rawPlan(pdir, 0xE9);
  leaseGit(repo, ['add', '-A']);
  leaseGit(repo, ['commit', '-qm', 'seed']);
  mkdirSync(join(repo, 'src'), { recursive: true });
  writeFileSync(rawLeasePath(repo, 0xE9), 'x');
  leaseGit(repo, ['add', '-A']);

  const r = leaseCheck(repo, dir, ['--phase', '1', '--plan', '1']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'unrepresentable-paths');
  assert.deepEqual(r.unrepresentable, ['"src/caf\\351.js"']);
  assert.equal(r._exit, 1);
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

// --- trace ignore: the run record stays out of git by itself (FLD-02) --------
//
// The other `--root` subcommand, tested beside detect-commands for that reason.
// `--root` is the PROJECT root here (that is where `.gitignore` lives), and the
// write arm is scaffold-time only: `--check` is what /cad-health runs, and it
// may not edit a file it did not create (D-03).

/** A scratch PROJECT root, a git repo unless `git:false`. */
function ignoreRoot({ git = true, gitignore = null, planning = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cad-ignore-'));
  if (git) {
    execFileSync('git', ['init', '-q'], { cwd: root });
    execFileSync('git', ['config', 'user.email', 't@example.com'], { cwd: root });
    execFileSync('git', ['config', 'user.name', 'T'], { cwd: root });
  }
  if (planning) mkdirSync(join(root, '.planning'), { recursive: true });
  if (gitignore !== null) writeFileSync(join(root, '.gitignore'), gitignore);
  return root;
}

/** `trace ignore` against a project root; parse its one JSON line. */
function traceIgnore(root, extra = []) {
  const args = root === null ? ['trace', 'ignore', ...extra]
    : ['trace', 'ignore', '--root', root, ...extra];
  try {
    return JSON.parse(execFileSync('node', [PLANNING, ...args], { encoding: 'utf8' }));
  } catch (e) {
    return JSON.parse(e.stdout);
  }
}

const gitignoreOf = (root) => readFileSync(join(root, '.gitignore'), 'utf8');

test('trace ignore: a fresh repo with no .gitignore gets the line written', () => {
  const root = ignoreRoot();
  const r = traceIgnore(root);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.written, true);
  assert.equal(r.ignored, false);         // the state as FOUND
  assert.equal(r.tracked, false);
  assert.equal(r.line, '.planning/trace.jsonl');
  assert.match(gitignoreOf(root), /^\.planning\/trace\.jsonl$/m);
});

test('trace ignore: a re-run adds no second line and touches no byte', () => {
  const root = ignoreRoot();
  assert.equal(traceIgnore(root).written, true);
  const after = gitignoreOf(root);
  const again = traceIgnore(root);
  assert.equal(again.written, false);
  assert.equal(again.reason, 'already-ignored');
  assert.equal(again.ignored, true);
  assert.equal(gitignoreOf(root), after);
});

test('trace ignore: a brownfield .gitignore keeps every line it had', () => {
  // No trailing newline, deliberately: the shape that would otherwise glue the
  // new line onto the last existing one.
  const root = ignoreRoot({ gitignore: 'node_modules/\ndist/\n*.log' });
  const r = traceIgnore(root);
  assert.equal(r.written, true, JSON.stringify(r));
  const lines = gitignoreOf(root).split('\n');
  for (const kept of ['node_modules/', 'dist/', '*.log']) {
    assert.ok(lines.includes(kept), `lost ${kept}: ${JSON.stringify(lines)}`);
  }
  assert.ok(lines.includes('.planning/trace.jsonl'), JSON.stringify(lines));
});

test('trace ignore: a project ignoring .planning/ wholesale is already correct', () => {
  const root = ignoreRoot({ gitignore: '.planning/\n' });
  const r = traceIgnore(root, ['--check']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.ignored, true);
  assert.equal(r.method, 'git');          // only git can see a directory rule
  assert.equal(r.written, false);
  // ...and --check never writes, so the file is exactly what it was.
  assert.equal(gitignoreOf(root), '.planning/\n');
  // The write arm agrees: nothing to add.
  assert.equal(traceIgnore(root).written, false);
  assert.equal(gitignoreOf(root), '.planning/\n');
});

test('trace ignore: a non-git root falls back to the literal scan and still writes', () => {
  const root = ignoreRoot({ git: false });
  const r = traceIgnore(root);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.method, 'file');
  assert.equal(r.written, true);
  assert.equal(r.tracked, false);
  assert.match(gitignoreOf(root), /^\.planning\/trace\.jsonl$/m);
  // ...and the literal scan reads its own write back on the next run.
  assert.equal(traceIgnore(root).reason, 'already-ignored');
});

test('trace ignore: a tracked run record is REPORTED, never quietly ignored', () => {
  const root = ignoreRoot();
  writeFileSync(join(root, '.planning', 'trace.jsonl'), '{"phase":1}\n');
  execFileSync('git', ['add', '--', '.planning/trace.jsonl'], { cwd: root });
  const r = traceIgnore(root, ['--check']);
  assert.equal(r.tracked, true, JSON.stringify(r));
  assert.equal(r.ignored, false);
});

test('trace ignore: a TRACKED record whose line is present reports ignored and writes nothing', () => {
  // The regression the `--no-index` flag closes. `check-ignore` answers "would
  // this path be ignored if it were untracked", so a path in the INDEX matched
  // nothing at all: `ignored` came back false with the rule sitting right there
  // in `.gitignore`, and the write arm - which keys off that value - appended the
  // comment and the line again on EVERY run. Two runs left three copies.
  const root = ignoreRoot({ gitignore: '.planning/trace.jsonl\n' });
  writeFileSync(join(root, '.planning', 'trace.jsonl'), '{"phase":1}\n');
  execFileSync('git', ['add', '-f', '--', '.planning/trace.jsonl'], { cwd: root });
  const check = traceIgnore(root, ['--check']);
  assert.equal(check.ignored, true, JSON.stringify(check));
  assert.equal(check.tracked, true, JSON.stringify(check));
  assert.equal(check.method, 'git');
  assert.match(check.source, /\.gitignore$/);
  // Both facts survive together: the rule is there AND the file is still indexed,
  // which is the state whose remedy is `git rm --cached` and not another line.
  const before = gitignoreOf(root);
  assert.equal(traceIgnore(root).written, false);
  assert.equal(traceIgnore(root).written, false);
  assert.equal(gitignoreOf(root), before);
  assert.equal(gitignoreOf(root).match(/^\.planning\/trace\.jsonl$/gm).length, 1);
});

test('trace ignore: a .git/info/exclude match does NOT satisfy the line', () => {
  // The reason `-v` is used instead of `-q`: neither `.git/info/exclude` nor
  // core.excludesFile is cloned, so a machine-local exclusion would report
  // ignored:true and leave the project with no line of its own - and the
  // collaborator who clones it commits the run record.
  const root = ignoreRoot();
  writeFileSync(join(root, '.git', 'info', 'exclude'), '.planning/trace.jsonl\n');
  const check = traceIgnore(root, ['--check']);
  assert.equal(check.ignored, false, JSON.stringify(check));
  assert.equal(check.method, 'git');
  assert.match(check.source, /exclude$/);
  const r = traceIgnore(root);
  assert.equal(r.written, true, JSON.stringify(r));
  assert.match(gitignoreOf(root), /^\.planning\/trace\.jsonl$/m);
});

test('trace ignore: a --root present with nothing usable is refused, never the cwd', () => {
  const root = ignoreRoot();
  // A valueless flag: parseArgs renders it as boolean true.
  const bare = traceIgnore(null, ['--root']);
  assert.equal(bare.ok, false, JSON.stringify(bare));
  assert.equal(bare.reason, 'bad-args');
  assert.match(bare.detail, /--root/);
  const empty = traceIgnore('');
  assert.equal(empty.ok, false, JSON.stringify(empty));
  assert.equal(empty.reason, 'bad-args');
  // ...and the usable form still works, so the guard is not refusing everything.
  assert.equal(traceIgnore(root).ok, true);
});

// --- debt-harvest: markers in tracked code reach the queue (DBT-01) ----------
//
// The token is BUILT from the export, never typed as a literal followed by a
// colon: the harvest scans this tracked test file, and a literal marker here
// would be collected as a real one - breaking `debt-harvest --root .` over this
// repo, which must report zero.
const debtLine = (text, ceiling, trigger) => {
  const fields = [` ${text}`];
  if (ceiling) fields.push(` ceiling: ${ceiling}`);
  if (trigger) fields.push(` trigger: ${trigger}`);
  return `${DEBT_TOKEN}:${fields.join(' |')}`;
};

/** A scratch PROJECT root that is a git repo, with `.planning/` present. */
function debtRepo() {
  const root = mkdtempSync(join(tmpdir(), 'cad-debt-'));
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 't@example.com'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'T'], { cwd: root });
  mkdirSync(join(root, '.planning'), { recursive: true });
  return root;
}

/** Write a file under the root and `git add` it (optionally forced). */
function debtAdd(root, rel, body, force = false) {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, body);
  execFileSync('git', ['add', ...(force ? ['-f'] : []), '--', rel], { cwd: root });
}

/** `debt-harvest` against a project root; parse its one JSON line. */
function harvest(root, extra = []) {
  const args = root === null ? ['debt-harvest', ...extra]
    : ['debt-harvest', '--root', root, ...extra];
  try {
    return JSON.parse(execFileSync('node', [PLANNING, ...args], { encoding: 'utf8' }));
  } catch (e) {
    return JSON.parse(e.stdout);
  }
}

const captureOf = (root) => readFileSync(join(root, '.planning', 'CAPTURE.md'), 'utf8');

test('debt-harvest: a planted marker is collected with its ceiling and trigger', () => {
  const root = debtRepo();
  debtAdd(root, 'src/a.js', `// ${debtLine('single-tenant only', 'no tenant column', 'tenant two')}\n`);
  const r = harvest(root);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.markers, 1);
  assert.equal(r.written, true);
  const body = captureOf(root);
  assert.match(body, /## Debt markers/);
  assert.match(body, /- `src\/a\.js:1` single-tenant only - ceiling: no tenant column - trigger: tenant two/);
});

test('debt-harvest: the 19 conventional markers contribute NOTHING (AC5)', () => {
  const root = debtRepo();
  debtAdd(root, 'src/b.js', ['// TODO: fix this', '// FIXME: broken', '// XXX: careful',
    '// HACK: works for now', '// NOTE: read me', '// placeholder', '// not implemented',
    '// SHORTCUT: nope', '// DEBT: nope', '// CORNER: nope', '// TRIPWIRE: nope',
    '// CUT: nope', '// CEILING: nope', '// CAD-DEBT: nope', '// todo!()',
    '// unimplemented!()', '// WIP', '// REVIEW', '// OPTIMIZE'].join('\n'));
  const r = harvest(root);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.markers, 0);
  assert.match(captureOf(root), /## Debt markers\n\n- None\.\n/);
});

test('debt-harvest: an untracked file and an ignored node_modules contribute nothing (AC5)', () => {
  const root = debtRepo();
  debtAdd(root, 'src/a.js', `// ${debtLine('tracked cut', 'c', 't')}\n`);
  // Untracked: `git ls-files` never lists it.
  mkdirSync(join(root, 'src'), { recursive: true });
  writeFileSync(join(root, 'src', 'untracked.js'), `// ${debtLine('untracked cut', 'c', 't')}\n`);
  // Ignored AND untracked: the ordinary node_modules case.
  writeFileSync(join(root, '.gitignore'), 'node_modules/\n');
  execFileSync('git', ['add', '--', '.gitignore'], { cwd: root });
  mkdirSync(join(root, 'node_modules', 'pkg'), { recursive: true });
  writeFileSync(join(root, 'node_modules', 'pkg', 'x.js'), `// ${debtLine('vendor cut', 'c', 't')}\n`);
  const r = harvest(root);
  assert.equal(r.markers, 1, JSON.stringify(r));
  assert.match(captureOf(root), /tracked cut/);
  assert.doesNotMatch(captureOf(root), /untracked cut|vendor cut/);
});

test('debt-harvest: a FORCE-ADDED node_modules file is enumerated and still skipped', () => {
  // The claim `git ls-files` does NOT support: an ignore rule does not remove an
  // already-tracked path, so `ls-files` lists a force-added node_modules file.
  // The explicit segment skip is what keeps third-party markers out, and this is
  // the fixture that fails without it.
  const root = debtRepo();
  writeFileSync(join(root, '.gitignore'), 'node_modules/\n');
  execFileSync('git', ['add', '--', '.gitignore'], { cwd: root });
  debtAdd(root, 'node_modules/pkg/y.js', `// ${debtLine('vendor cut', 'c', 't')}\n`, true);
  // The premise: git really does enumerate it.
  const listed = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' });
  assert.match(listed, /node_modules\/pkg\/y\.js/, 'fixture is wrong: git did not track it');
  const r = harvest(root);
  assert.equal(r.markers, 0, JSON.stringify(r));
});

test('debt-harvest: running twice leaves CAPTURE.md byte-identical (AC6)', () => {
  const root = debtRepo();
  debtAdd(root, 'src/a.js', `// ${debtLine('a cut', 'c', 't')}\n`);
  const first = harvest(root);
  assert.equal(first.written, true);
  const after = captureOf(root);
  const second = harvest(root);
  assert.equal(second.written, false, JSON.stringify(second));
  assert.equal(second.markers, 1);
  assert.equal(captureOf(root), after);
});

test('debt-harvest: ## Todos is never touched, and a deleted marker disappears (AC6)', () => {
  const root = debtRepo();
  const todos = '## Todos\n\n- [ ] (phase 1) a hand-written item\n\n## Seeds\n\n- a seed\n';
  writeFileSync(join(root, '.planning', 'CAPTURE.md'), todos);
  debtAdd(root, 'src/a.js', `// ${debtLine('a cut', 'c', 't')}\n`);
  harvest(root);
  assert.match(captureOf(root), /- \[ \] \(phase 1\) a hand-written item/);
  assert.match(captureOf(root), /a cut/);
  // Delete the marker from source: its bullet goes, the hand-written queue stays.
  writeFileSync(join(root, 'src', 'a.js'), '// nothing to see\n');
  const r = harvest(root);
  assert.equal(r.markers, 0, JSON.stringify(r));
  assert.doesNotMatch(captureOf(root), /a cut/);
  assert.match(captureOf(root), /- \[ \] \(phase 1\) a hand-written item/);
  assert.match(captureOf(root), /- a seed/);
  // Every pre-existing section survived the rewrite.
  assert.ok(captureOf(root).startsWith(todos.split('\n')[0]));
});

test('debt-harvest: a fenced ## line in someone else\'s bullet is never touched (D-12)', () => {
  // The harvest rewrites ONE section, so a `## ` line fenced inside a `## Todos`
  // bullet sits in the untouched prefix and survives whatever the bound does.
  // This row pins that the rewrite does not reach it; the row BELOW is the one
  // that proves the bound itself.
  const root = debtRepo();
  const fenced = '## Todos\n\n- [ ] keep this bullet:\n\n  ```sh\n  ## build output\n  make dist\n  ```\n\n'
    + '## Debt markers\n\n- None.\n';
  writeFileSync(join(root, '.planning', 'CAPTURE.md'), fenced);
  debtAdd(root, 'src/a.js', `// ${debtLine('a cut', 'c', 't')}\n`);
  harvest(root);
  const body = captureOf(root);
  assert.match(body, /## build output/);          // not truncated mid-fence
  assert.equal((body.match(/```/g) || []).length, 2, 'fence count must stay even');
  assert.match(body, /make dist/);
  assert.match(body, /a cut/);
});

test('debt-harvest: the section bound reads a fence, so stale debris cannot survive (D-12)', () => {
  // The fixture where the bound actually DECIDES: `## Debt markers` comes FIRST
  // and holds a stale fenced block whose content has a `## ` line. A bare
  // `/^## /` boundary test stops INSIDE that fence, so everything from
  // `## build output` down - an unclosed fence and its debris - is kept as the
  // tail and re-emitted after the new body, leaving an odd fence count and
  // rendering the rest of the queue as code. `sectionBound` skips fenced lines,
  // so the whole stale section is replaced and `## Todos` is the real boundary.
  const root = debtRepo();
  // The `## ` line must be at column 0 INSIDE the fence: `sectionBound`'s own
  // heading test is `/^## /`, so an INDENTED `  ## build output` is invisible to
  // both readers and would make this row pass either way.
  writeFileSync(join(root, '.planning', 'CAPTURE.md'),
    '## Debt markers\n\n- [ ] stale hand note:\n\n```sh\n## build output\nmake dist\n```\n\n'
    + '## Todos\n\n- [ ] a hand-written item\n');
  debtAdd(root, 'src/a.js', `// ${debtLine('a cut', 'c', 't')}\n`);
  harvest(root);
  const body = captureOf(root);
  assert.match(body, /a cut/);
  assert.match(body, /- \[ \] a hand-written item/);   // the real next section survives
  assert.doesNotMatch(body, /## build output/, 'stale fenced debris survived the rewrite');
  assert.doesNotMatch(body, /make dist/);
  assert.equal((body.match(/```/g) || []).length, 0, 'an unclosed fence was left behind');
});

test('debt-harvest: a FENCED example of the owned heading is not mistaken for it', () => {
  // The START boundary, which `sectionBound` never covered: the two rows above
  // both hand `replaceSection` a heading it finds in the right place, and a bare
  // `lines.findIndex((l) => l.trim() === heading)` passes them. Here the document
  // has NO real `## Debt markers` - only a fenced EXAMPLE of one inside a `##
  // Todos` bullet - so a fence-blind search anchors the rewrite inside that code
  // block. The scan then resumes mid-fence, reads the block's CLOSING fence as an
  // opener, finds no boundary at all, and every later section is replaced by the
  // new body: `## Seeds` and `## Notes` disappear outright. The correct answer is
  // to leave the example alone and APPEND a real section at the end.
  const root = debtRepo();
  writeFileSync(join(root, '.planning', 'CAPTURE.md'),
    '## Todos\n\n- [ ] document the marker grammar, like:\n\n```md\n## Debt markers\n'
    + '- `src/x.js:1` an example bullet\n```\n\n'
    + '## Seeds\n\n- [ ] a seed\n\n## Notes\n\n- keep me\n');
  debtAdd(root, 'src/a.js', `// ${debtLine('a cut', 'c', 't')}\n`);
  harvest(root);
  const body = captureOf(root);
  assert.match(body, /- \[ \] a seed/, '## Seeds was destroyed by a false start boundary');
  assert.match(body, /- keep me/, '## Notes was destroyed by a false start boundary');
  assert.match(body, /- \[ \] document the marker grammar/);
  assert.match(body, /an example bullet/, 'the fenced example was rewritten');
  assert.equal((body.match(/```/g) || []).length, 2, 'fence count must stay even');
  // ...and the real section landed, appended after the document rather than into
  // the example.
  assert.match(body, /a cut/);
  assert.ok(body.indexOf('- keep me') < body.lastIndexOf('## Debt markers'),
    'the real section must be appended AFTER the existing content');
});

test('debt-harvest: a TRACKED CAPTURE.md already holding a section stays idempotent', () => {
  // The self-ingestion guard: `.planning/` is skipped, so the harvest's own
  // output is never read back as a marker even where the queue is tracked.
  const root = debtRepo();
  debtAdd(root, 'src/a.js', `// ${debtLine('a cut', 'c', 't')}\n`);
  harvest(root);
  execFileSync('git', ['add', '--', '.planning/CAPTURE.md'], { cwd: root });
  const after = captureOf(root);
  const r = harvest(root);
  assert.equal(r.markers, 1, JSON.stringify(r));   // still 1, not 2
  assert.equal(r.written, false);
  assert.equal(captureOf(root), after);
});

test('debt-harvest: a malformed marker is reported, never dropped', () => {
  const root = debtRepo();
  debtAdd(root, 'src/a.js', `// ${debtLine('no trigger stated', 'a ceiling', null)}\n`);
  const r = harvest(root);
  assert.equal(r.markers, 1);
  assert.deepEqual(r.malformed, [{ path: 'src/a.js', line: 1, missing: ['trigger'] }]);
  assert.match(captureOf(root), /trigger: \(unstated\)/);
});

test('debt-harvest: a tracked SYMLINK out of the tree contributes nothing', () => {
  // `statSync`/`readFileSync` both follow a link, so the harvest read a file the
  // project does not contain and filed its marker under the in-tree path - a
  // corner-cut reported at a line that holds no marker. A tracked link's target is
  // either in the tree (enumerated on its own path) or outside it, so skipping
  // links loses nothing that belongs here.
  const root = debtRepo();
  const outside = join(mkdtempSync(join(tmpdir(), 'cad-debt-out-')), 'outside.js');
  writeFileSync(outside, `// ${debtLine('external cut', 'cx', 'tx')}\n`);
  mkdirSync(join(root, 'src'), { recursive: true });
  symlinkSync(outside, join(root, 'src', 'link.js'));
  execFileSync('git', ['add', '--', 'src/link.js'], { cwd: root });
  debtAdd(root, 'src/real.js', `// ${debtLine('in-tree cut', 'c', 't')}\n`);
  const r = harvest(root);
  assert.equal(r.markers, 1, JSON.stringify(r));
  const body = captureOf(root);
  assert.match(body, /in-tree cut/);
  assert.doesNotMatch(body, /external cut/, 'a symlink target outside the tree was read');
  assert.doesNotMatch(body, /link\.js/);
});

test('debt-harvest: a non-git root is ok:false, never a zero-marker answer', () => {
  const root = mkdtempSync(join(tmpdir(), 'cad-debt-nogit-'));
  mkdirSync(join(root, '.planning'), { recursive: true });
  const r = harvest(root);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'no-git');
  assert.equal(existsSync(join(root, '.planning', 'CAPTURE.md')), false);
});

test('debt-harvest: a --root present with nothing usable is refused, never the cwd', () => {
  const bare = harvest(null, ['--root']);
  assert.equal(bare.ok, false, JSON.stringify(bare));
  assert.equal(bare.reason, 'bad-args');
  const empty = harvest('');
  assert.equal(empty.ok, false, JSON.stringify(empty));
  assert.equal(empty.reason, 'bad-args');
});

test('debt-harvest: an absent CAPTURE.md is created with the /cad-capture headings', () => {
  const root = debtRepo();
  debtAdd(root, 'src/a.js', `// ${debtLine('a cut', 'c', 't')}\n`);
  harvest(root);
  const body = captureOf(root);
  for (const h of ['## Todos', '## Seeds', '## Notes', '## Debt markers']) {
    assert.ok(body.includes(h), `missing ${h}: ${body}`);
  }
});

test('debt-harvest: a planning doc QUOTING a literal marker is not harvested', () => {
  // The fixture the `.planning/` skip actually needs. Removing the skip does NOT
  // redden the tracked-CAPTURE.md row above - the rendered section carries no
  // token, so the harvest cannot re-ingest its own output through it. What the
  // skip really protects is a planning DOC that writes a literal marker line
  // while describing one: a PLAN, a CONTEXT or a SUMMARY quoting the grammar
  // would otherwise land in the queue as a real corner-cut, on a phase that cut
  // nothing.
  const root = debtRepo();
  debtAdd(root, 'src/a.js', `// ${debtLine('a real cut', 'c', 't')}\n`);
  debtAdd(root, '.planning/phases/1/PLAN.md',
    `# Plan\n\nMark it like this: \`${debtLine('example only', 'nothing', 'never')}\`\n`);
  const r = harvest(root);
  assert.equal(r.markers, 1, JSON.stringify(r));
  assert.match(captureOf(root), /a real cut/);
  assert.doesNotMatch(captureOf(root), /example only/);
});

// --- milestone-prune: the --label guard -----------------------------------------
// The seam's transforms and its happy paths live in milestone-prune.test.mjs;
// what is here is the argument face, which is planning.mjs's own.
//
// Reproduced 2026-08-13: `--label '../../../outside-tree'` moved phases/1 clean
// out of the planning root and answered {"ok":true,"action":"pruned"}.

function pruneTree() {
  return makeTree({
    roadmap: [{ n: 1, name: 'One', checked: true }, { n: 2, name: 'Two' }],
    phases: { 1: { plan: true }, 2: { plan: true } },
    reqs: [['REQ-1', 1, 'Complete']],
  });
}

for (const mode of ['archive', 'delete']) {
  test(`milestone-prune --mode ${mode}: a --label escaping the tree is refused before any mkdir or rename`, () => {
    const dir = pruneTree();
    const escapee = resolve(dir, '_archive-../../../outside-tree');
    const roadmapBefore = readFileSync(join(dir, 'ROADMAP.md'), 'utf8');
    const r = run(['milestone-prune', '--label', '../../../outside-tree', '--mode', mode], dir);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'bad-args');
    assert.match(r.detail, /inside the planning root/);
    assert.deepEqual(readdirSync(join(dir, 'phases')).sort(), ['1', '2']);
    assert.equal(existsSync(escapee), false, `created ${escapee} outside the planning root`);
    assert.equal(readFileSync(join(dir, 'ROADMAP.md'), 'utf8'), roadmapBefore);
  });
}

// archiveRequirements writes the label into a markdown table cell, where either
// character silently rewrites the row it lands in.
for (const [name, label] of [['a pipe', 'v2|Complete|'], ['a newline', 'v2\nrogue row'],
  ['a carriage return', 'v2\rrogue row']]) {
  test(`milestone-prune: a --label containing ${name} is refused`, () => {
    const dir = pruneTree();
    const r = run(['milestone-prune', '--label', label, '--mode', 'archive'], dir);
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'bad-args');
    assert.match(r.detail, /"\|" or a newline/);
    assert.deepEqual(readdirSync(join(dir, 'phases')).sort(), ['1', '2']);
  });
}

// The guard is NOT publish-decision.mjs's REMOTE_NAME shape (D-13): an untagged
// close labels the archive with the milestone NAME from PROJECT.md, spaces and
// all, so a no-spaces regex would refuse this very milestone.
test('milestone-prune: a spaced milestone-name label still prunes normally', () => {
  const dir = pruneTree();
  const label = 'the controls that reported success';
  const r = run(['milestone-prune', '--label', label, '--mode', 'archive'], dir);
  assert.equal(r.ok, true);
  assert.equal(r.action, 'pruned');
  assert.deepEqual(r.phases, [1]);
  assert.equal(existsSync(join(dir, `_archive-${label}`, '1', 'PLAN.md')), true);
  assert.deepEqual(readdirSync(join(dir, 'phases')).sort(), ['2']);
  assert.match(readFileSync(join(dir, 'REQUIREMENTS.md'), 'utf8'), new RegExp(label));
});

// --- capture-sections: the out-of-walk census (AC4) --------------------------
// D-07: a STANDALONE subcommand, not a drift kind inside `status`, whose early
// returns would starve exactly the trees most likely to hold a mangled
// CAPTURE.md. D-06: unconditional, no allowlist - an `Archive` + `Debt markers`
// exemption would have reported nothing on the incident this exists for.

/** A queue with both walked and out-of-walk sections, written by hand. */
const QUEUE = '# Capture\n\n## Todos\n\n- [ ] (phase 1) live one\n- [ ] live two\n\n'
  + '## Seeds\n\n- a seed\n\n## Notes\n\n- None.\n\n'
  + '## Archive\n\n- retired a\n- retired b\n\n## Debt markers\n\n- a marker\n';

test('capture-sections: every section is named with its count and its walk membership', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }] });
  writeFileSync(join(dir, 'CAPTURE.md'), QUEUE);
  const r = run(['capture-sections'], dir);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.exists, true);
  assert.deepEqual(r.walk, ['Todos', 'Seeds', 'Notes']);
  assert.deepEqual(r.sections, [
    { heading: 'Todos', bullets: 2, in_walk: true },
    { heading: 'Seeds', bullets: 1, in_walk: true },
    { heading: 'Notes', bullets: 1, in_walk: true },
    { heading: 'Archive', bullets: 2, in_walk: false },
    { heading: 'Debt markers', bullets: 1, in_walk: false },
  ]);
});

test('capture-sections: a bullet appended to an out-of-walk section raises THAT count and no other (AC4)', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }] });
  const file = join(dir, 'CAPTURE.md');
  writeFileSync(file, QUEUE);
  const before = run(['capture-sections'], dir).sections;
  writeFileSync(file, readFileSync(file, 'utf8')
    .replace('- retired b\n', '- retired b\n- retired c\n'));
  const after = run(['capture-sections'], dir).sections;
  assert.equal(after.length, before.length);
  for (let i = 0; i < before.length; i++) {
    assert.equal(after[i].heading, before[i].heading);
    assert.equal(after[i].in_walk, before[i].in_walk);
    assert.equal(after[i].bullets, before[i].bullets + (before[i].heading === 'Archive' ? 1 : 0),
      `${before[i].heading} moved unexpectedly`);
  }
});

test('capture-sections: an absent CAPTURE.md is ok:true with no sections, never a failure', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }] });
  const r = run(['capture-sections'], dir);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.exists, false);
  assert.deepEqual(r.sections, []);
  assert.equal(r._exit, 0);
});

test('capture-sections: a VALUELESS --file is bad-args, never silently the --dir default', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }] });
  writeFileSync(join(dir, 'CAPTURE.md'), QUEUE);
  const r = run(['capture-sections', '--file'], dir);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-args');
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
function taskRepo(commits, { planning = true } = {}) {
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
function runIn(root, args, dir) {
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

const TASK_COMMITS = [
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

// --- recall: the tasks tier (D-09) -------------------------------------------
//
// The hole this closes was MEASURED, not supposed: a query naming exactly what a
// shipped `/cad-task` run did returned five hits over a 59-snippet corpus and
// none of them from `.planning/tasks/`, against a record on disk describing that
// work.

/** Plant `<dir>/tasks/<slug>/RECORD.md` holding `shipped` as its bullets. */
function taskRecordIn(dir, slug, shipped) {
  const tdir = join(dir, 'tasks', slug);
  mkdirSync(tdir, { recursive: true });
  writeFileSync(join(tdir, 'RECORD.md'),
    `# Task: ${slug}\n\n## What shipped\n\n${shipped.map((s) => `- ${s}`).join('\n')}\n\n`
    + '## Commits\n\n| Task | Commit | Description |\n| --- | --- | --- |\n\n'
    + `## Files\n\n### Task 1: ${slug}\n\n- **Files:** a.txt\n`);
  return dir;
}

const TASK_TIER_SPEC = {
  phases: { 1: { summaryBody: { deviations: ['alpha beta gamma'] } } },
  capture: [{ section: 'Todos', text: 'wire the beta recall path', phase: 1 }],
};

test('recall: a task record comes back, sourced by slug and with NO phase field', () => {
  const dir = taskRecordIn(makeTree(TASK_TIER_SPEC), 'bound-plan-size',
    ['a plan-size ceiling nothing enforced', 'the beta gamma path this task took']);
  const r = recall('beta gamma', dir);
  assert.equal(r.json.ok, true);
  const hit = r.json.results.find((x) => x.source === 'tasks/bound-plan-size/RECORD.md');
  assert.ok(hit, JSON.stringify(r.json.results));
  assert.equal(hit.snippet, 'the beta gamma path this task took');
  // NO inferred phase: a task sits outside the phase spine, and `phase: 0` here
  // would be the substitution references/recall.md forbids.
  assert.equal('phase' in hit, false,
    'a task record carries no phase, and an inferred one is worse than none');
});

test('recall: a tree with no tasks/ answers byte-identically to one with an empty tasks/', () => {
  const bare = recall('beta gamma', makeTree(TASK_TIER_SPEC));
  const emptyDir = makeTree(TASK_TIER_SPEC);
  mkdirSync(join(emptyDir, 'tasks'), { recursive: true });
  const empty = recall('beta gamma', emptyDir);
  assert.equal(bare.raw, empty.raw, 'the tasks walk contributes nothing when it finds nothing');

  // And the task rows land AFTER every existing one, so no corpus INDEX moved:
  // the live hits come back in the same order, the same rows. Their SCORES do
  // move and are deliberately not asserted - BM25 is corpus-relative, the
  // reasoning the ARCHIVE.md row above states in full.
  const withRecord = recall('beta gamma',
    taskRecordIn(makeTree(TASK_TIER_SPEC), 'later', ['an unrelated task note']));
  assert.deepEqual(withRecord.json.results.map((x) => [x.source, x.snippet]),
    bare.json.results.map((x) => [x.source, x.snippet]));
});

test('recall: two runs over a corpus holding a task record are byte-identical', () => {
  const dir = taskRecordIn(makeTree(TASK_TIER_SPEC), 'bound-plan-size',
    ['a plan-size ceiling nothing enforced', 'the beta gamma path this task took']);
  taskRecordIn(dir, 'another-task', ['a second beta record, sorted after the first']);
  const a = recall('beta gamma', dir);
  const b = recall('beta gamma', dir);
  assert.equal(a.raw, b.raw);
  assert.ok(a.json.results.length >= 3, JSON.stringify(a.json.results));
});

test('recall: a RECORD.md symlinked OUT of the planning root is never indexed', () => {
  // The lister contains the walk one level past `phaseDirsIn`: the recall tier
  // reads snippets straight from the path it returns, so a cloned repository
  // carrying such a link would otherwise surface an arbitrary readable file.
  const outside = mkdtempSync(join(tmpdir(), 'cad-recall-outside-'));
  const secret = join(outside, 'RECORD.md');
  writeFileSync(secret, '# Task: stolen\n\n## What shipped\n\n- beta gamma secret bytes\n');
  const dir = makeTree(TASK_TIER_SPEC);
  mkdirSync(join(dir, 'tasks', 'leaky'), { recursive: true });
  symlinkSync(secret, join(dir, 'tasks', 'leaky', 'RECORD.md'));
  const r = recall('beta gamma', dir);
  assert.equal(r.json.results.some((x) => x.snippet.includes('secret bytes')), false);
  assert.equal(r.json.results.some((x) => x.source.startsWith('tasks/')), false);
});

test('task-record -> recall: a record written by the seam is found by what it says', () => {
  // The round trip both halves of D-09 exist for: the writer's `## What shipped`
  // heading and the walk's reader are one fact, and this is where they meet.
  const { root, dir, shas } = taskRepo(TASK_COMMITS);
  runIn(root, ['task-record', '--slug', 'bound-plan-size', '--base', `${shas[0]}^`,
    '--head', shas[1], '--text', 'A ceiling on plan size, enforced at the gate.'], dir);
  const r = recall('ceiling plan size gate', dir);
  assert.equal(r.json.ok, true);
  assert.deepEqual(r.json.results.map((x) => x.source), ['tasks/bound-plan-size/RECORD.md']);
});
