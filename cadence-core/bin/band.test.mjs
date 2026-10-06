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
import { bandLine, NO_CURSOR_LINE, rosterReconcile, rosterStart, rosterStop, shownStatus } from './lib/band.mjs';
import { parseCursor } from './lib/state-cursor.mjs';
import { register } from '../../hooks/cadence-mod.mjs';

const BIN = dirname(fileURLToPath(import.meta.url));
const STATE = '# State\n\nPhase: 1 of 2 (Fixture)\nStatus: planned\nNext: /cad-execute 1\nUpdated: 2026-10-04\n';
const CURSOR = { phase: 1, total: 2, status: 'planned', next: '/cad-execute 1' };
const REVIEWER = { role: 'cad-reviewer', rung: 'low' };
const EXECUTOR = { role: 'cad-executor', rung: 'high' };
const PLANNER = { role: 'cad-planner', rung: 'high' };
const SESSION = 'session-1';

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
  assert.equal(bandLine(CURSOR, [REVIEWER, PLANNER], 200),
    'Cadence · Phase 1 of 2 · planned · running cad-reviewer (low), cad-planner (high) · next /cad-execute 1');
});

test('a narrow width keeps the first agent plus a count, then cuts with …', () => {
  const three = [REVIEWER, PLANNER, { role: 'cad-verifier', rung: 'medium' }];
  // Wide enough for the collapsed list, too narrow for the full one.
  assert.equal(bandLine(CURSOR, three, 90),
    'Cadence · Phase 1 of 2 · planned · running cad-reviewer (low) +2 · next /cad-execute 1');
  const cut = bandLine(CURSOR, three, 50);
  assert.equal(cut, 'Cadence · Phase 1 of 2 · planned · running cad-re…');
  assert.equal(Array.from(cut).length, 50);
});

test('a running executor shows a planned phase as executing', () => {
  assert.equal(bandLine(CURSOR, [EXECUTOR], 200),
    'Cadence · Phase 1 of 2 · executing · running cad-executor (high) · next /cad-execute 1');
  assert.equal(shownStatus('planned', [REVIEWER, EXECUTOR]), 'executing');
});

test('no executor, or a phase that is not planned, keeps the status as written', () => {
  assert.equal(shownStatus('planned', []), 'planned');
  assert.equal(shownStatus('planned', [REVIEWER, PLANNER]), 'planned');
  for (const status of ['ready to plan', 'context gathered', 'executed', 'phase complete', 'paused']) {
    assert.equal(shownStatus(status, [EXECUTOR]), status);
  }
});

test('the session\'s cache breaks follow the status once there is one', () => {
  assert.equal(bandLine(CURSOR, [], 200, 0), 'Cadence · Phase 1 of 2 · planned · next /cad-execute 1');
  assert.equal(bandLine(CURSOR, [REVIEWER], 200, 1),
    'Cadence · Phase 1 of 2 · planned · 1 cache break · running cad-reviewer (low) · next /cad-execute 1');
  assert.equal(bandLine(CURSOR, [], 200, 2), 'Cadence · Phase 1 of 2 · planned · 2 cache breaks · next /cad-execute 1');
  assert.equal(bandLine(null, [], 200, 3), 'Cadence · no readable cursor · run /cad-progress · 3 cache breaks');
});

test('no line is ever longer than the width', () => {
  const lists = [[], [REVIEWER], [REVIEWER, EXECUTOR], [REVIEWER, EXECUTOR, REVIEWER, EXECUTOR]];
  for (const cursor of [CURSOR, null, { ...CURSOR, next: '/cad-verify 1 😀😀' }]) {
    for (const running of lists) {
      for (let width = 0; width <= 140; width++) {
        for (const breaks of [0, 1, 12]) {
          const line = bandLine(cursor, running, width, breaks);
          assert.ok(Array.from(line).length <= width, `${width}: ${line}`);
          assert.ok(!line.includes('\n'));
        }
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
  read, resolve, agent } = /** @type {any} */ ({})) {
  return {
    session: { cwd: async () => cwd, id: async () => SESSION },
    agent: agent || { list: async () => [] },
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

// --- the running roster -----------------------------------------------------

const start = (id, type, session_id = SESSION) =>
  ({ hook_event_name: 'SubagentStart', session_id, agent_id: id, agent_type: type });

test('a start then its stop leaves the roster empty', () => {
  const one = rosterStart([], start('a1', 'cadence:cad-reviewer-low'), SESSION);
  assert.deepEqual(one, [{ id: 'a1', role: 'cad-reviewer', rung: 'low' }]);
  assert.deepEqual(rosterStop(one, 'a1'), []);
  assert.deepEqual(rosterStop(one, 'other'), one);
});

test('host agent types and other sessions never join the roster', () => {
  for (const type of ['general-purpose', 'Explore']) {
    assert.deepEqual(rosterStart([], start('a1', type), SESSION), []);
  }
  assert.deepEqual(rosterStart([], start('a1', 'cadence:cad-reviewer-low', 'session-2'), SESSION), []);
});

test('role and rung come from RUNG_FILES, not a suffix', () => {
  let roster = rosterStart([], start('a1', 'cadence:cad-reviewer-low'), SESSION);
  roster = rosterStart(roster, start('a2', 'cadence:cad-assumptions-analyzer'), SESSION);
  assert.deepEqual(roster.map(({ role, rung }) => ({ role, rung })),
    [{ role: 'cad-reviewer', rung: 'low' }, { role: 'cad-assumptions-analyzer', rung: 'xhigh' }]);
  assert.equal(bandLine(CURSOR, roster, 200),
    'Cadence · Phase 1 of 2 · planned · running cad-reviewer (low), cad-assumptions-analyzer (xhigh) · next /cad-execute 1');
});

test('a reconcile keeps exactly the running Cadence agents the list shows', () => {
  const held = rosterStart(rosterStart([], start('a1', 'cadence:cad-reviewer-low'), SESSION),
    start('a2', 'cadence:cad-executor'), SESSION);
  const list = [
    { id: 'a1', type: 'cadence:cad-reviewer-low', status: 'completed', description: '' },
    { id: 'a2', type: 'cadence:cad-executor', status: 'running', description: '' },
    { id: 'a3', type: 'cadence:cad-verifier-medium', status: 'running', description: '' },
    { id: 'a4', type: 'general-purpose', status: 'running', description: '' },
  ];
  assert.deepEqual(rosterReconcile(held, list), [
    { id: 'a2', role: 'cad-executor', rung: 'high' },
    { id: 'a3', role: 'cad-verifier', rung: 'medium' },
  ]);
});

/** The module's handler for one classic event. */
function classic(name) {
  const found = handlers().filter((h) => h.pattern === name);
  assert.equal(found.length, 1);
  return found[0].hook;
}

test('subagent start and stop each run next once and answer its result', async () => {
  for (const [name, e] of [['classic.SubagentStart', start('a1', 'cadence:cad-reviewer-low')],
    ['classic.SubagentStop', { hook_event_name: 'SubagentStop', session_id: SESSION, agent_id: 'a1' }]]) {
    const answer = { block: undefined };
    const next = counting(answer);
    assert.equal(await classic(name)(standIn(), e, next), answer);
    assert.equal(next.calls, 1);
    const failing = counting(answer);
    assert.equal(await classic(name)({ session: { id: async () => { throw new Error('gone'); } } }, e, failing), answer);
    assert.equal(failing.calls, 1);
  }
});

test('the band names an agent the list shows running, and draws when the list throws', async () => {
  const running = standIn({ agent: { list: async () =>
    [{ id: 'a1', type: 'cadence:cad-reviewer-low', status: 'running', description: '' }] } });
  let next = counting(OTHER);
  let got = parts(await aboveprompt()(running, event(), next));
  assert.match(got.line, /running cad-reviewer \(low\)/);
  assert.deepEqual(got.rest, [OTHER]);
  assert.equal(next.calls, 1);

  const broken = standIn({ agent: { list: async () => { throw new Error('no list'); } } });
  next = counting(OTHER);
  got = parts(await aboveprompt()(broken, event(), next));
  assert.equal(got.line, 'Cadence · Phase 1 of 2 · planned · next /cad-execute 1');
  assert.deepEqual(got.rest, [OTHER]);
  assert.equal(next.calls, 1);
});

test('a start the module saw shows in the band when the list throws, and its stop drops it', async () => {
  const seen = handlers();
  const hook = (/** @type {string} */ name) => seen.find((h) => h.pattern === name).hook;
  const render = seen.find((h) => h.pattern === 'ui.render').hook;
  const $ = standIn({ agent: { list: async () => { throw new Error('no list'); } } });
  await hook('classic.SubagentStart')($, start('a1', 'cadence:cad-reviewer-low'), counting(undefined));
  assert.match(parts(await render($, event(), counting(OTHER))).line, /running cad-reviewer \(low\)/);
  await hook('classic.SubagentStop')($, { hook_event_name: 'SubagentStop', agent_id: 'a1' }, counting(undefined));
  assert.doesNotMatch(parts(await render($, event(), counting(OTHER))).line, /running/);
});

test('subagent events and tool calls ask for a redraw after next, and a failing one changes nothing', async () => {
  const result = { output: 'ok' };
  for (const [name, e] of [['tool.call', { tool: 'Bash' }],
    ['classic.SubagentStart', start('a1', 'cadence:cad-reviewer-low')],
    ['classic.SubagentStop', { hook_event_name: 'SubagentStop', agent_id: 'a1' }]]) {
    /** @type {string[]} */
    const order = [];
    const next = async () => { order.push('next'); return result; };
    const $ = { ...standIn(), ui: { invalidate: (/** @type {string} */ ev) => order.push(`invalidate ${ev}`) } };
    assert.equal(await classic(name)($, e, next), result);
    assert.deepEqual(order, ['next', 'invalidate ui.render']);

    const failing = counting(result);
    const broken = { ...standIn(), ui: { invalidate: () => { throw new Error('gone'); } } };
    assert.equal(await classic(name)(broken, e, failing), result);
    assert.equal(failing.calls, 1);
  }
});

test('control characters in STATE.md never reach the band, and the other drawing survives', async () => {
  const hostile = STATE.replace('Status: planned', 'Status: plan\x07ned')
    .replace('Next: /cad-execute 1', 'Next: /cad-execute 1\x1b[2J');
  const next = counting(OTHER);
  const got = parts(await aboveprompt()(standIn({ files: { '/proj/.planning': '', '/proj/.planning/STATE.md': hostile } }),
    event(), next));
  assert.equal(next.calls, 1);
  assert.doesNotMatch(got.line, /[\x00-\x1f\x7f-\x9f]/);
  assert.equal(got.line, 'Cadence · Phase 1 of 2 · plan?ned · next /cad-execute 1?[2J');
  assert.deepEqual(got.rest, [OTHER]);
});
