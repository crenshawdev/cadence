// Zero-dep tests for `planning.mjs renumber`. Run:
// node --test 'cadence-core/bin/*.test.mjs'
//
// Split out of planning.test.mjs in phase 4, verbatim: the arms, their fixture
// builders and their comments are unchanged, only their home is. The shared
// harness stays in planning.test.mjs and is imported, never copied - two copies
// of `makeTree` is how two fixtures drift apart.
//
// The `test` binding below is a no-op unless this module IS the entry file, so
// a sibling that imports a fixture from here registers nothing twice.
import { test as nodeTest } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, symlinkSync, chmodSync, rmSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { classifyAcceptanceCriteria } from './lib/planning-files.mjs';
import { PLANNING_DIR, makeTree, run } from './planning.test.mjs';

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

// --- renumber ------------------------------------------------------------------

export function renumberTree() {
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
