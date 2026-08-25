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
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
//
// SINCE PHASE 4 EACH ONE IS A PAIR (SPL-02, CONTEXT D-06/D-07). Reading the
// caller's own spelling was only ever half the fix: these commands ALSO echo
// `parsed.value` in the envelope's `phase:` key, so on a tree carrying both
// directories the answer named phase 1.1 over bytes read out of `phases/1.10/`.
// The tree-aware check refuses exactly that tree. So the "acts on the caller's
// spelling" half moved onto a tree that does NOT hold the normalized directory,
// which is where the capability `lib/require-int.mjs` built still lives, and
// the tree that holds both is now a `bad-args` row naming both spellings.

test('lease-check: --phase 1.10 leases against phases/1.10 when no phases/1.1 exists', () => {
  const { repo, dir } = leaseRepo({ phase: '1.10', files: ['one-ten.txt'] });
  stage(repo, 'one-ten.txt');
  const r = leaseCheck(repo, dir, ['--phase', '1.10', '--plan', '1']);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.plan_file, '.planning/phases/1.10/PLAN.md');
});

test('lease-check: --phase 1.10 refuses when phases/1.1 is also on the tree', () => {
  const { repo, dir } = leaseRepo({ phase: '1.1', files: ['one-one.txt'] });
  const pdir = join(dir, 'phases', '1.10');
  mkdirSync(pdir, { recursive: true });
  writeFileSync(join(pdir, 'PLAN.md'), '---\nphase: 1.10\nfiles:\n  - one-ten.txt\n---\n# Plan\n');
  stage(repo, 'one-ten.txt');
  const r = leaseCheck(repo, dir, ['--phase', '1.10', '--plan', '1']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'bad-args');
  assert.match(r.detail, /"1\.10".*phases[/\\]1\.1[/\\]/);
  // ...and phase 1.1's own lease, a canonical spelling, still answers - and
  // does NOT license 1.10's file.
  const other = leaseCheck(repo, dir, ['--phase', '1.1', '--plan', '1']);
  assert.equal(other.ok, false);
  assert.equal(other.plan_file, '.planning/phases/1.1/PLAN.md');
  assert.deepEqual(other.undeclared, ['one-ten.txt']);
});

test('lease-check: --phase 08 names phases/08 when no phases/8 exists', () => {
  const { repo, dir } = leaseRepo({ phase: 8, files: ['a.txt'] });
  // The tree carries phases/8, so `08` is the colliding spelling. Drop the
  // legal directory and `08` is addressed verbatim again, exactly as before.
  rmSync(join(dir, 'phases', '8'), { recursive: true });
  stage(repo, 'a.txt');
  const r = leaseCheck(repo, dir, ['--phase', '08', '--plan', '1']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'no-plan');
  assert.match(r.detail, /phases[/\\]08$/);
  assert.equal(r.hint, '/cad-plan 08');
});

test('lease-check: --phase 08 beside a legal phases/8 is refused, naming both', () => {
  const { repo, dir } = leaseRepo({ phase: 8, files: ['a.txt'] });
  stage(repo, 'a.txt');
  const r = leaseCheck(repo, dir, ['--phase', '08', '--plan', '1']);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'bad-args');
  assert.match(r.detail, /"08"/);
  assert.match(r.detail, /phases[/\\]8[/\\]/);
});

test('plan-overlap: --phase 08 reports no-phase-dir naming phases/08 when no phases/8 exists', () => {
  const dir = makeTree({ roadmap: [{ n: 8, name: 'Eight' }], phases: { 9: { plan: true } } });
  const r = run(['plan-overlap', '--phase', '08'], dir);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'no-phase-dir');
  assert.match(r.detail, /phases[/\\]08 not found$/);
});

test('plan-overlap: --phase 08 beside a legal phases/8 is refused, naming both', () => {
  const dir = makeTree({ roadmap: [{ n: 8, name: 'Eight' }], phases: { 8: { plan: true } } });
  const r = run(['plan-overlap', '--phase', '08'], dir);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'bad-args');
  assert.match(r.detail, /"08"/);
  assert.match(r.detail, /phases[/\\]8[/\\]/);
  // ...and the legal spelling still answers.
  assert.equal(run(['plan-overlap', '--phase', '8'], dir).ok, true);
});

test('plan-overlap: --phase 1.10 intersects phases/1.10\'s plans when no phases/1.1 exists', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }] });
  // A normalizing reader would look in `phases/1.1/` and answer "fewer than two
  // plans - nothing to intersect"; this one reads the caller's own spelling.
  const ten = join(dir, 'phases', '1.10');
  mkdirSync(ten, { recursive: true });
  writeFileSync(join(ten, 'PLAN-1.md'), '---\nphase: 1.10\nfiles:\n  - shared.txt\n---\n# Plan 1\n');
  writeFileSync(join(ten, 'PLAN-2.md'), '---\nphase: 1.10\nfiles:\n  - shared.txt\n---\n# Plan 2\n');
  const r = run(['plan-overlap', '--phase', '1.10'], dir);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.note, undefined);
  assert.deepEqual(r.overlaps, [{ plans: ['PLAN-1.md', 'PLAN-2.md'], files: ['shared.txt'] }]);
  // The echoed phase stays the NUMBER - arithmetic and comparisons keep it.
  // On THIS tree that is harmless, and on the one below it is the whole harm.
  assert.equal(r.phase, 1.1);
});

test('plan-overlap: --phase 1.10 is refused once phases/1.1 is on the tree too', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }] });
  const one = join(dir, 'phases', '1.1');
  mkdirSync(one, { recursive: true });
  writeFileSync(join(one, 'PLAN.md'), '---\nphase: 1.1\nfiles:\n  - a.txt\n---\n# Plan\n');
  const ten = join(dir, 'phases', '1.10');
  mkdirSync(ten, { recursive: true });
  writeFileSync(join(ten, 'PLAN-1.md'), '---\nphase: 1.10\nfiles:\n  - shared.txt\n---\n# Plan 1\n');
  writeFileSync(join(ten, 'PLAN-2.md'), '---\nphase: 1.10\nfiles:\n  - shared.txt\n---\n# Plan 2\n');
  const r = run(['plan-overlap', '--phase', '1.10'], dir);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'bad-args');
  assert.match(r.detail, /"1\.10".*phases[/\\]1\.1[/\\]/);
  assert.equal(r.phase, undefined);
});

test('uat: --phase 1.10 reads phases/1.10/UAT.md when no phase 1.1 directory exists', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }], phases: { 1: { uat: [{ status: 'pass' }] } } });
  const r = run(['uat', 'status', '--phase', '1.10'], dir);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'no-uat');
  assert.match(r.detail, /phases[/\\]1\.10[/\\]UAT\.md not found$/);
  // ...and `uat init` on 1.10 writes ITS OWN file, under its own spelling.
  mkdirSync(join(dir, 'phases', '1.10'), { recursive: true });
  const init = run(['uat', 'init', '--phase', '1.10'], dir,
    JSON.stringify([{ name: 'ten', expected: 'ten' }]));
  assert.equal(init.ok, true, JSON.stringify(init));
  assert.match(init.file, /phases[/\\]1\.10[/\\]UAT\.md$/);
  // The frontmatter LABEL is the caller's spelling too.
  assert.match(readFileSync(join(dir, 'phases', '1.10', 'UAT.md'), 'utf8'), /^phase: 1\.10$/m);
});

test('uat: --phase 1.10 is refused on a tree holding phase 1.1, leaving its checklist alone', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One' }], phases: { '1.1': { uat: [{ status: 'pass' }] } } });
  const before = readFileSync(join(dir, 'phases', '1.1', 'UAT.md'), 'utf8');
  const r = run(['uat', 'status', '--phase', '1.10'], dir);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'bad-args');
  assert.match(r.detail, /"1\.10".*phases[/\\]1\.1[/\\]/);
  // The refusal lands BEFORE any read or write, so 1.1's checklist is untouched
  // and no phases/1.10/ directory was minted.
  const init = run(['uat', 'init', '--phase', '1.10'], dir,
    JSON.stringify([{ name: 'ten', expected: 'ten' }]));
  assert.equal(init.ok, false, JSON.stringify(init));
  assert.equal(init.reason, 'bad-args');
  assert.equal(readFileSync(join(dir, 'phases', '1.1', 'UAT.md'), 'utf8'), before);
  assert.equal(existsSync(join(dir, 'phases', '1.10')), false);
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
  // because this face WRITES the numeric half into a Traceability cell.
  //
  // WHAT THAT REFUSAL IS SCOPED TO CHANGED IN PHASE 4, and this comment moved
  // with it: `plan-overlap --phase 08` on THIS tree now answers `bad-args` too,
  // through the tree-aware check, because `phases/8/` exists here. What still
  // separates the two faces is the tree with no `phases/8/` on it - the sibling
  // row above shows `plan-overlap` addressing `phases/08` verbatim there, while
  // this face refuses `08` on any tree at all.
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
