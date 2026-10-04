// Tests for lib/band.mjs and the band handler in hooks/cadence-mod.mjs.
// Run: node --test cadence-core/bin/band.test.mjs
//
// The handler cases drive the module with a stand-in `$`: the host draws
// nothing headless, so composition with another mod's drawing is shown here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bandLine, NO_CURSOR_LINE } from './lib/band.mjs';
import { parseCursor } from './lib/state-cursor.mjs';
import { register } from '../../hooks/cadence-mod.mjs';

const BIN = dirname(fileURLToPath(import.meta.url));
const STATE = '# State\n\nPhase: 1 of 2 (Fixture)\nStatus: planned\nNext: /cad-execute 1\nUpdated: 2026-10-04\n';
const CURSOR = { phase: 1, total: 2, status: 'planned', next: '/cad-execute 1' };
const REVIEWER = { role: 'cad-reviewer', rung: 'low' };
const EXECUTOR = { role: 'cad-executor', rung: 'high' };

// --- the line ---------------------------------------------------------------

test('the cursor line carries what planning.mjs cursor get prints', () => {
  const root = mkdtempSync(join(tmpdir(), 'band-'));
  try {
    mkdirSync(join(root, '.planning'));
    writeFileSync(join(root, '.planning', 'STATE.md'), STATE);
    const got = JSON.parse(execFileSync(process.execPath,
      [join(BIN, 'planning.mjs'), '--dir', join(root, '.planning'), 'cursor', 'get'], { encoding: 'utf8' }));
    assert.equal(bandLine(parseCursor(STATE), [], 200),
      `Cadence · Phase ${got.phase} of ${got.total} · ${got.status} · next ${got.next}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('no readable cursor draws the /cad-progress line', () => {
  assert.equal(bandLine(null, [], 200), 'Cadence · no readable cursor · run /cad-progress');
  assert.equal(NO_CURSOR_LINE, 'Cadence · no readable cursor · run /cad-progress');
});

test('running agents sit between status and next', () => {
  assert.equal(bandLine(CURSOR, [REVIEWER], 200),
    'Cadence · Phase 1 of 2 · planned · running cad-reviewer (low) · next /cad-execute 1');
  assert.equal(bandLine(CURSOR, [REVIEWER, EXECUTOR], 200),
    'Cadence · Phase 1 of 2 · planned · running cad-reviewer (low), cad-executor (high) · next /cad-execute 1');
});

test('a narrow width keeps the first agent plus a count, then cuts with …', () => {
  const three = [REVIEWER, EXECUTOR, { role: 'cad-verifier', rung: 'medium' }];
  // Wide enough for the collapsed list, too narrow for the full one.
  assert.equal(bandLine(CURSOR, three, 90),
    'Cadence · Phase 1 of 2 · planned · running cad-reviewer (low) +2 · next /cad-execute 1');
  const cut = bandLine(CURSOR, three, 50);
  assert.equal(cut, 'Cadence · Phase 1 of 2 · planned · running cad-re…');
  assert.equal(Array.from(cut).length, 50);
});

test('no line is ever longer than the width', () => {
  const lists = [[], [REVIEWER], [REVIEWER, EXECUTOR], [REVIEWER, EXECUTOR, REVIEWER, EXECUTOR]];
  for (const cursor of [CURSOR, null, { ...CURSOR, next: '/cad-verify 1 😀😀' }]) {
    for (const running of lists) {
      for (let width = 0; width <= 140; width++) {
        const line = bandLine(cursor, running, width);
        assert.ok(Array.from(line).length <= width, `${width}: ${line}`);
        assert.ok(!line.includes('\n'));
      }
    }
  }
});

// --- the handler ------------------------------------------------------------

/** The module's handlers, as a recording `on` collects them. */
function handlers() {
  /** @type {{pattern: string, matcher: any, hook: Function}[]} */
  const seen = [];
  register((/** @type {string} */ pattern, /** @type {any} */ a, /** @type {any} */ b) => {
    seen.push(b === undefined ? { pattern, matcher: undefined, hook: a } : { pattern, matcher: a, hook: b });
  });
  return seen;
}

function aboveprompt() {
  const found = handlers().filter((h) => h.pattern === 'ui.render' && h.matcher?.component === 'AbovePrompt');
  assert.equal(found.length, 1);
  return found[0].hook;
}

const OTHER = Object.freeze({ type: 'Text', props: {}, children: ['another mod'] });

/** A stand-in `$` over a fixture tree of path -> text (a directory maps to ''). */
function standIn({ cwd = '/proj/sub', files = { '/proj/.planning': '', '/proj/.planning/STATE.md': STATE },
  read, resolve } = /** @type {any} */ ({})) {
  return {
    session: { cwd: async () => cwd },
    fs: {
      exists: async (/** @type {string} */ p) => Object.hasOwn(files, p),
      read: read || (async (/** @type {string} */ p) => {
        if (!Object.hasOwn(files, p)) throw new Error(`ENOENT ${p}`);
        return files[p];
      }),
    },
    ui: {
      resolve: resolve || (() => ({
        Box: (/** @type {any} */ props) => ({ type: 'Box', props }),
        Text: (/** @type {any} */ props) => ({ type: 'Text', props }),
      })),
    },
  };
}

/** A `next` that counts its calls and resolves to `drawing`. */
function counting(drawing) {
  const next = async () => { next.calls++; return drawing; };
  next.calls = 0;
  return next;
}

const event = (props = {}) => ({ surface: 'terminal', component: 'AbovePrompt', requestId: 'r',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120, ...props } });

/** The band's line and the other drawings in an answer Box. */
function parts(tree) {
  assert.equal(tree.type, 'Box');
  assert.equal(tree.props.flexDirection, 'column');
  const [band, ...rest] = tree.props.children;
  assert.equal(band.type, 'Text');
  return { line: band.props.children, rest: rest.filter((c) => c !== null && c !== undefined) };
}

test('in a project, the band sits above the other mod\'s drawing, and next runs once', async () => {
  const next = counting(OTHER);
  const tree = await aboveprompt()(standIn(), event(), next);
  assert.equal(next.calls, 1);
  const { line, rest } = parts(tree);
  assert.equal(line, 'Cadence · Phase 1 of 2 · planned · next /cad-execute 1');
  assert.deepEqual(rest, [OTHER]);
});

test('a null drawing beneath leaves the band alone in the Box', async () => {
  for (const drawing of [null, undefined]) {
    const next = counting(drawing);
    const { line, rest } = parts(await aboveprompt()(standIn(), event(), next));
    assert.match(line, /^Cadence · Phase 1 of 2/);
    assert.deepEqual(rest, []);
    assert.equal(next.calls, 1);
  }
});

test('a survey, or no .planning/ up the walk, answers the other drawing itself', async () => {
  let next = counting(OTHER);
  assert.equal(await aboveprompt()(standIn(), event({ hasSurvey: true }), next), OTHER);
  assert.equal(next.calls, 1);
  next = counting(OTHER);
  assert.equal(await aboveprompt()(standIn({ files: { '/proj/.git': '' } }), event(), next), OTHER);
  assert.equal(next.calls, 1);
  next = counting(OTHER);
  assert.equal(await aboveprompt()(standIn({ files: {} }), event(), next), OTHER);
  assert.equal(next.calls, 1);
});

test('a STATE.md read that throws draws the /cad-progress line beside the other drawing', async () => {
  const next = counting(OTHER);
  const $ = standIn({ read: async () => { throw new Error('EACCES'); } });
  const { line, rest } = parts(await aboveprompt()($, event(), next));
  assert.equal(line, NO_CURSOR_LINE);
  assert.deepEqual(rest, [OTHER]);
  assert.equal(next.calls, 1);
});

test('a ui.resolve that throws answers the other drawing, and next ran once', async () => {
  const next = counting(OTHER);
  const $ = standIn({ resolve: () => { throw new Error('no table'); } });
  assert.equal(await aboveprompt()($, event(), next), OTHER);
  assert.equal(next.calls, 1);
});

test('the band is cut to bodyColumns', async () => {
  const { line } = parts(await aboveprompt()(standIn(), event({ bodyColumns: 20 }), counting(OTHER)));
  assert.equal(Array.from(line).length, 20);
  assert.ok(line.endsWith('…'));
});
