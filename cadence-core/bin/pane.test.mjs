// Tests for lib/pane.mjs and the pane's handlers in hooks/cadence-mod.mjs.
// Run: node --test cadence-core/bin/pane.test.mjs
//
// The handler cases drive the module with a stand-in `$`, the way
// band.test.mjs does: the host draws nothing headless.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { agentRows, NO_CURSOR_NEXT, NO_PROJECT_TEXT, paneLines, panelOn, parseResolves, READING_LINE, seamAnswer, sightDraw,
  sightStart, sightStop, singleFlight, spendOf } from './lib/pane.mjs';
import { appendEvent, DISPATCH, STEP_WINDOW } from './lib/trace.mjs';
import { SPEND_EXCLUDES } from './lib/trace-suggest.mjs';
import { makeTree } from './planning.test.mjs';
import { parseCursor } from './lib/state-cursor.mjs';
import { register } from '../../hooks/cadence-mod.mjs';

const BIN = dirname(fileURLToPath(import.meta.url));
const REPO = join(BIN, '..', '..');
const STATE = '# State\n\nPhase: 1 of 2 (Fixture)\nStatus: planned\nNext: /cad-execute 1\nUpdated: 2026-10-04\n';

/** A `status` envelope: phase 1 of 2, planned, one outstanding PLAN.md. */
const STATUS = Object.freeze({ ok: true, current: 1, total: 2, outstanding: [{ phase: 1, plans: ['PLAN.md'] }],
  phases: [{ n: 1, name: 'Fixture', status: 'planned' }, { n: 2, name: 'Next', status: 'unplanned' }] });

/** One snapshot, every section filled the way a good fetch leaves it. */
const snap = (/** @type {any} */ extra = {}) => ({ cursor: parseCursor(STATE),
  status: { ok: true, value: STATUS }, captures: { ok: true, value: { ok: true, exists: true, substantive: 2 } }, spend: null, ...extra });

// --- the lines --------------------------------------------------------------

test('the next line carries what planning.mjs cursor get prints', () => {
  const root = mkdtempSync(join(tmpdir(), 'pane-'));
  try {
    mkdirSync(join(root, '.planning'));
    writeFileSync(join(root, '.planning', 'STATE.md'), STATE);
    const got = JSON.parse(execFileSync(process.execPath,
      [join(BIN, 'planning.mjs'), '--dir', join(root, '.planning'), 'cursor', 'get'], { encoding: 'utf8' }));
    assert.ok(paneLines(snap(), 200).includes(`next ${got.next}`));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('no readable cursor carries the /cad-progress hint', () => {
  const lines = paneLines(snap({ cursor: null }), 200);
  assert.ok(lines.includes(NO_CURSOR_NEXT));
  assert.match(NO_CURSOR_NEXT, /\/cad-progress/);
});

test('no snapshot shows the reading line alone', () => {
  assert.deepEqual(paneLines(null, 200), [READING_LINE]);
});

test('a narrow width cuts every long line with …, and no line runs past the width', () => {
  const long = snap({ cursor: { ...parseCursor(STATE), next: `/cad-execute 1 ${'x'.repeat(80)} 😀😀` } });
  for (const s of [null, long, snap({ cursor: null })]) {
    for (let width = 0; width <= 120; width++) {
      for (const line of paneLines(s, width)) {
        assert.ok(Array.from(line).length <= width, `${width}: ${line}`);
        assert.ok(!line.includes('\n'));
      }
    }
  }
  const cut = paneLines(long, 20);
  assert.equal(Array.from(cut[0]).length, 20);
  assert.ok(cut[0].endsWith('…'));
});

test('control characters never reach a line', () => {
  const hostile = parseCursor(STATE.replace('Next: /cad-execute 1', 'Next: /cad-execute 1\x1b[2J\x07'));
  const lines = paneLines(snap({ cursor: hostile }), 200);
  assert.ok(lines.includes('next /cad-execute 1?[2J?'));
  for (const line of lines) assert.doesNotMatch(line, /[\x00-\x1f\x7f-\x9f]/);
});

// --- the handlers -----------------------------------------------------------

/**
 * The module's handlers, as a recording `on` collects them, sharing one state.
 * The band's `panel` setting is on unless `options` says otherwise.
 */
function handlers(/** @type {unknown} */ options = { panel: true }) {
  /** @type {{pattern: string, matcher: any, hook: Function}[]} */
  const seen = [];
  register((/** @type {string} */ pattern, /** @type {any} */ a, /** @type {any} */ b) => {
    seen.push(b === undefined ? { pattern, matcher: undefined, hook: a } : { pattern, matcher: a, hook: b });
  }, options);
  /** The one handler for a pattern, narrowed by `component` when given. */
  const one = (/** @type {string} */ pattern, /** @type {string} */ component = undefined) => {
    const found = seen.filter((h) => h.pattern === pattern && (component === undefined || h.matcher?.component === component));
    assert.equal(found.length, 1, pattern);
    return found[0];
  };
  return { seen, one, hook: (/** @type {string} */ p, /** @type {string} */ c = undefined) => one(p, c).hook };
}

/**
 * A stand-in `$` over a fixture tree of path -> text (a directory maps to '').
 * It records each `ui.open`, and `drawn()` settles at the next invalidate.
 */
function standIn({ cwd = '/proj/sub', files = { '/proj/.planning': '', '/proj/.planning/STATE.md': STATE },
  read, resolve, open } = /** @type {any} */ ({})) {
  /** @type {any[]} */
  const opens = [];
  /** @type {any[]} */
  const registered = [];
  /** @type {(() => void)[]} */
  let waiting = [];
  const $ = {
    opens,
    registered,
    invalidations: 0,
    /** Settles at the next `ui.invalidate`. */
    drawn: () => new Promise((resolve) => { waiting.push(() => resolve(undefined)); }),
    plugin: { name: 'cadence', root: '/plug' },
    session: { cwd: async () => cwd, id: async () => 'session-1', model: async () => 'claude-session-model' },
    agent: { list: async () => [] },
    process: { run: async () => { throw new Error('no process in this stand-in'); } },
    command: { register: async (/** @type {any} */ spec) => { registered.push(spec); return { command: spec.name }; } },
    fs: {
      exists: async (/** @type {string} */ p) => Object.hasOwn(files, p),
      read: read || (async (/** @type {string} */ p) => {
        if (!Object.hasOwn(files, p)) throw new Error(`ENOENT ${p}`);
        return files[p];
      }),
    },
    ui: {
      open: open || (async (/** @type {any} */ args) => { opens.push(args); return { isPlaced: true }; }),
      /** The engine's list: every pane opened here, unless a test empties it. */
      panes: async () => opens.map((o) => ({ id: o.id, title: o.title, isShown: true, isFocused: false, isPlaced: true })),
      invalidate: () => {
        $.invalidations++;
        const w = waiting;
        waiting = [];
        for (const f of w) f();
      },
      resolve: resolve || (() => ({
        Box: (/** @type {any} */ props) => ({ type: 'Box', props }),
        Text: (/** @type {any} */ props) => ({ type: 'Text', props }),
      })),
    },
  };
  return $;
}

/** A `next` that counts its calls and resolves to `answer`. */
function counting(/** @type {any} */ answer) {
  const next = async () => { next.calls++; return answer; };
  next.calls = 0;
  return next;
}

const paneEvent = (/** @type {any} */ props = {}) => ({ surface: 'terminal', component: 'Pane', requestId: 'cadence',
  props: { title: 'Cadence', isFocused: false, bodyColumns: 80, placement: 'inline', ...props } });

const run = (args = '') => ({ command: 'cad-panel', args, origin: { kind: 'composer' }, presentation: {} });

/**
 * The rows of a Pane render's tree, after its `◆ Cadence` title row and the
 * blank under it: each a row Box of Text segments (a Button reads as its
 * label), read as one line of their joined text.
 */
function linesOf(/** @type {any} */ tree) {
  return rowsOf(tree).map((row) => row.map((/** @type {any} */ t) =>
    (t.type === 'Button' ? t.props.label : t.props.children)).join(''));
}

/** The Text and Button segments of each row of a Pane render's tree, after its title. */
function rowsOf(/** @type {any} */ tree) {
  assert.equal(tree.type, 'Box');
  assert.equal(tree.props.flexDirection, 'column');
  const [title, blank, ...rows] = tree.props.children;
  assert.equal(title.type, 'Box');
  assert.equal(title.props.children[0].props.bold, true);
  assert.equal(title.props.children[0].props.children, '◆ Cadence');
  assert.equal(blank.props.children, ' ');
  return rows.map((/** @type {any} */ row) => {
    assert.equal(row.type, 'Box');
    assert.equal(row.props.flexDirection, 'row');
    for (const t of row.props.children) {
      assert.ok(t.type === 'Text' || t.type === 'Button', t.type);
      assert.equal(typeof (t.type === 'Button' ? t.props.label : t.props.children), 'string');
    }
    return row.props.children;
  });
}

test('session.start registers /cad-panel once, immediate, and runs next once', async () => {
  const { hook } = handlers();
  const $ = standIn();
  const answer = {};
  const next = counting(answer);
  assert.equal(await hook('session.start')($, {}, next), answer);
  assert.equal(next.calls, 1);
  assert.equal($.registered.length, 1);
  assert.equal($.registered[0].name, 'cad-panel');
  assert.equal($.registered[0].immediate, true);
  assert.equal(typeof $.registered[0].description, 'string');
  assert.ok(!$.registered[0].description.includes('\n'));

  const failing = counting(answer);
  const broken = { ...$, command: { register: async () => { throw new Error('refused'); } } };
  assert.equal(await hook('session.start')(broken, {}, failing), answer);
  assert.equal(failing.calls, 1);
});

test('the command handler is narrowed to cad-panel, and the Pane render to its id', () => {
  const { one } = handlers();
  assert.deepEqual(one('command.run').matcher, { command: 'cad-panel' });
  assert.deepEqual(one('ui.render', 'Pane').matcher, { component: 'Pane', requestId: 'cadence' });
});

test('in a project, /cad-panel opens the pane once and its render shows the cursor\'s next', async () => {
  const { hook } = handlers();
  const $ = standIn();
  const drawn = $.drawn();
  const next = counting({ text: 'cadence registered /cad-panel but no command.run hook answered it' });
  const answer = await hook('command.run')($, run(), next);
  assert.equal(next.calls, 1);
  assert.deepEqual(answer, { text: '' }, 'a placed open answers an empty text in place of the host\'s line');
  assert.equal($.opens.length, 1);
  assert.deepEqual($.opens[0], { id: 'cadence', title: 'Cadence' });
  assert.equal($.opens[0].focus, undefined, 'opening never takes the keyboard');
  await drawn;
  const render = counting(null);
  assert.ok(linesOf(await hook('ui.render', 'Pane')($, paneEvent(), render)).includes('next /cad-execute 1'));
  assert.equal(render.calls, 1);
});

test('an open that waits undrawn answers its reason', async () => {
  const { hook } = handlers();
  const $ = standIn({ open: async () => ({ isPlaced: false, reason: 'widen the terminal to 144 columns' }) });
  const answer = await hook('command.run')($, run(), counting({}));
  assert.deepEqual(answer, { text: 'widen the terminal to 144 columns' });
});

test('with no .planning/ up the walk, /cad-panel opens nothing and answers a text', async () => {
  const { hook } = handlers();
  for (const files of [{ '/proj/.git': '' }, {}]) {
    const $ = standIn({ files });
    const next = counting({});
    const answer = await hook('command.run')($, run(), next);
    assert.equal(next.calls, 1);
    assert.equal($.opens.length, 0);
    assert.deepEqual(answer, { text: NO_PROJECT_TEXT });
  }
});

test('a STATE.md read that throws draws the /cad-progress hint', async () => {
  const { hook } = handlers();
  const $ = standIn({ read: async () => { throw new Error('EACCES'); } });
  const drawn = $.drawn();
  await hook('command.run')($, run(), counting({}));
  await drawn;
  assert.ok(linesOf(await hook('ui.render', 'Pane')($, paneEvent(), counting(null))).includes(NO_CURSOR_NEXT));
});

test('a ui.resolve that throws answers next\'s drawing, and next ran once', async () => {
  const { hook } = handlers();
  const $ = standIn({ resolve: () => { throw new Error('no table'); } });
  const theirs = { type: 'Text', props: { children: 'engine' } };
  const next = counting(theirs);
  assert.equal(await hook('ui.render', 'Pane')($, paneEvent(), next), theirs);
  assert.equal(next.calls, 1);
});

test('a ui.open that throws answers a text, and next ran once', async () => {
  const { hook } = handlers();
  const $ = standIn({ open: async () => { throw new Error('refused'); } });
  const next = counting({});
  const answer = await hook('command.run')($, run(), next);
  assert.equal(next.calls, 1);
  assert.equal(typeof answer.text, 'string');
  assert.notEqual(answer.text, '');
});

// --- one fetch at a time ----------------------------------------------------

/** A task that waits until released, counting runs and how many overlap. */
function heldTask() {
  const t = {
    runs: 0, active: 0, most: 0,
    /** @type {(() => void)[]} */
    gates: [],
    release() { const g = t.gates; t.gates = []; for (const f of g) f(); },
    task: async () => {
      t.runs++;
      t.active++;
      t.most = Math.max(t.most, t.active);
      await new Promise((resolve) => { t.gates.push(() => resolve(undefined)); });
      t.active--;
    },
  };
  return t;
}

/** Let every pending microtask and timer-free promise chain settle. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

test('the runner: three kicks during one run make exactly one follow-up, never two at once', async () => {
  const kick = singleFlight();
  const t = heldTask();
  const done = kick(t.task);
  await settle();
  for (let i = 0; i < 3; i++) kick(t.task);
  assert.equal(t.runs, 1);
  t.release();
  await settle();
  assert.equal(t.runs, 2, 'one follow-up for the three kicks');
  t.release();
  await done;
  assert.equal(t.runs, 2);
  assert.equal(t.most, 1);
});

test('the runner: a kick after both runs settle starts a new one', async () => {
  const kick = singleFlight();
  const t = heldTask();
  const first = kick(t.task);
  kick(t.task);
  await settle();
  t.release();
  await settle();
  t.release();
  await first;
  assert.equal(t.runs, 2);
  const third = kick(t.task);
  await settle();
  assert.equal(t.runs, 3);
  t.release();
  await third;
  assert.equal(t.most, 1);
});

test('the runner: the queued run is the latest kick\'s task', async () => {
  const kick = singleFlight();
  const t = heldTask();
  /** @type {string[]} */
  const ran = [];
  const done = kick(t.task);
  kick(async () => { ran.push('older'); });
  kick(async () => { ran.push('newest'); });
  await settle();
  t.release();
  await done;
  assert.deepEqual(ran, ['newest']);
});

test('the runner: a task that throws, at once or later, leaves it usable', async () => {
  const kick = singleFlight();
  await kick(() => { throw new Error('at once'); });
  await kick(async () => { throw new Error('later'); });
  let ran = 0;
  await kick(async () => { ran++; });
  assert.equal(ran, 1);
});

/** STATE.md reads through a gate: count them, how many are open, release them. */
function heldReads(/** @type {any} */ $) {
  const r = { total: 0, open: 0, most: 0,
    /** @type {(() => void)[]} */
    gates: [],
    release() { const g = r.gates; r.gates = []; for (const f of g) f(); } };
  $.fs.read = async (/** @type {string} */ p) => {
    if (!p.endsWith('/STATE.md')) throw new Error(`ENOENT ${p}`);
    r.total++;
    r.open++;
    r.most = Math.max(r.most, r.open);
    await new Promise((resolve) => { r.gates.push(() => resolve(undefined)); });
    r.open--;
    return STATE;
  };
  return r;
}

/** Module handlers with the pane opened and its first fetch settled. */
async function opened() {
  const h = handlers();
  const $ = standIn();
  const drawn = $.drawn();
  await h.hook('command.run')($, run(), counting({}));
  await drawn;
  return { ...h, $ };
}

const bash = () => ({ tool: 'Bash', tool_use_id: 't1', command: 'ls' });
const startEvent = () => ({ hook_event_name: 'SubagentStart', session_id: 'session-1', agent_id: 'a1',
  agent_type: 'cadence:cad-reviewer-low' });
const stopEvent = () => ({ hook_event_name: 'SubagentStop', session_id: 'session-1', agent_id: 'a1',
  agent_type: 'cadence:cad-reviewer-low' });

test('tool calls during a held fetch: one read at a time, two in all, each answer next\'s own', async () => {
  const { hook, $ } = await opened();
  const reads = heldReads($);
  for (let i = 0; i < 3; i++) {
    const result = { ref: i, text: 'ok' };
    assert.equal(await hook('tool.call')($, bash(), async () => result), result);
  }
  await settle();
  assert.equal(reads.most, 1);
  reads.release();
  await settle();
  reads.release();
  await settle();
  assert.equal(reads.total, 2);
  assert.equal(reads.most, 1);
  assert.equal(reads.open, 0);
});

test('a fetch that never settles holds up no handler\'s answer', async () => {
  const { hook, $ } = await opened();
  $.fs.read = () => new Promise(() => {});
  for (const [name, e] of [['tool.call', bash()], ['classic.SubagentStart', startEvent()],
    ['classic.SubagentStop', stopEvent()]]) {
    const answer = { name };
    const next = counting(answer);
    assert.equal(await hook(name)($, e, next), answer, name);
    assert.equal(next.calls, 1);
  }
});

test('once the pane is closed, no event reads STATE.md for it', async () => {
  const { hook, $ } = await opened();
  const next = counting(undefined);
  await hook('ui.close')($, { id: 'cadence', origin: { kind: 'person' } }, next);
  assert.equal(next.calls, 1);
  const reads = heldReads($);
  await hook('tool.call')($, bash(), async () => ({}));
  await hook('classic.SubagentStart')($, startEvent(), counting({}));
  await hook('classic.SubagentStop')($, stopEvent(), counting({}));
  await settle();
  assert.equal(reads.total, 0);
});

test('a pane the engine no longer lists is marked closed before its fetch reads', async () => {
  const { hook, $ } = await opened();
  let listed = 0;
  $.ui.panes = async () => { listed++; return []; };
  const reads = heldReads($);
  await hook('tool.call')($, bash(), async () => ({}));
  await settle();
  assert.equal(listed, 1);
  assert.equal(reads.total, 0);
  await hook('tool.call')($, bash(), async () => ({}));
  await settle();
  assert.equal(listed, 1, 'a closed pane asks nothing more');
  assert.equal(reads.total, 0);
});

test('a Pane render with no snapshot starts exactly one fetch', async () => {
  const { hook } = handlers();
  const $ = standIn();
  $.ui.panes = async () => [{ id: 'cadence', title: 'Cadence', isShown: true, isFocused: false, isPlaced: true }];
  const reads = heldReads($);
  const next = counting(null);
  assert.deepEqual(linesOf(await hook('ui.render', 'Pane')($, paneEvent(), next)), [READING_LINE]);
  assert.equal(next.calls, 1);
  await settle();
  assert.equal(reads.total, 1);
  const drawn = $.drawn();
  reads.release();
  await drawn;
  assert.ok(linesOf(await hook('ui.render', 'Pane')($, paneEvent(), counting(null))).includes('next /cad-execute 1'));
  await settle();
  assert.equal(reads.total, 1, 'a render with a snapshot fetches nothing');
});

// --- the phase and its plans ------------------------------------------------

/** A seam's raw stdout against a fixture `.planning/`, refusals included. */
function stdoutOf(/** @type {string[]} */ args, /** @type {string} */ dir) {
  const r = spawnSync(process.execPath, [join(BIN, 'planning.mjs'), '--dir', dir, ...args], { encoding: 'utf8' });
  return r.stdout;
}

/** The plan rows' file names among a pane's lines. */
const rowFiles = (/** @type {string[]} */ lines) =>
  lines.map((l) => /^(\S+\.md) · (?:outstanding|complete)$/.exec(l)).filter(Boolean).map((m) => m[1]);

/** The pane's lines for the real `status` output of a fixture. */
function statusLines(/** @type {string} */ dir) {
  const out = stdoutOf(['status'], dir);
  return { lines: paneLines(snap({ status: seamAnswer(out) }), 200), status: JSON.parse(out) };
}

/** `phases[current].plans`, or `["PLAN.md"]` once planned, or none. */
function expectedRows(/** @type {any} */ status) {
  const entry = status.phases.find((p) => p.n === status.current);
  if (!entry) return [];
  if (entry.plans) return entry.plans;
  return ['planned', 'executed', 'complete'].includes(entry.status) ? ['PLAN.md'] : [];
}

const TWO = [{ n: 1, name: 'One' }, { n: 2, name: 'Two' }];

test('one PLAN.md and no report: one row, outstanding', () => {
  const dir = makeTree({ roadmap: TWO, phases: { 1: { plan: true } } });
  const { lines, status } = statusLines(dir);
  assert.ok(lines.includes('Phase 1 of 2 · One · planned'));
  assert.ok(lines.includes('PLAN.md · outstanding'));
  assert.deepEqual(rowFiles(lines), expectedRows(status));
  assert.deepEqual(rowFiles(lines), ['PLAN.md']);
});

test('two plans, the first reported complete: rows in status\'s order, marked by outstanding', () => {
  const dir = makeTree({ roadmap: TWO, phases: { 1: { plan: ['PLAN-1.md', 'PLAN-2.md'] } } });
  mkdirSync(join(dir, 'phases', '1', 'reports'));
  writeFileSync(join(dir, 'phases', '1', 'reports', 'plan-1.md'), 'PLAN COMPLETE\nPlan: PLAN-1.md\n');
  const { lines, status } = statusLines(dir);
  const rows = lines.filter((l) => rowFiles([l]).length);
  assert.deepEqual(rows, ['PLAN-1.md · complete', 'PLAN-2.md · outstanding']);
  assert.deepEqual(rowFiles(lines), expectedRows(status));
});

test('an unplanned current phase: no rows, and a line saying so', () => {
  const dir = makeTree({ roadmap: TWO });
  const { lines, status } = statusLines(dir);
  assert.deepEqual(rowFiles(lines), []);
  assert.deepEqual(rowFiles(lines), expectedRows(status));
  assert.ok(lines.includes('No plan yet'));
});

test('a cursor on another phase: both phase numbers and the cursor\'s status show', () => {
  const dir = makeTree({ roadmap: TWO,
    phases: { 1: { plan: true, summary: true, uat: [{ status: 'pass' }] }, 2: { plan: true } },
    cursor: { phase: 1, total: 2, name: 'One', status: 'executed', next: '/cad-verify 1', updated: '2026-10-04' } });
  const { lines, status } = statusLines(dir);
  assert.equal(status.current, 2);
  assert.equal(status.cursor.agrees, false);
  assert.ok(lines.includes('Phase 2 of 2 · Two · planned'), lines.join('\n'));
  assert.ok(lines.includes('Cursor says phase 1 · executed'), lines.join('\n'));
  assert.deepEqual(rowFiles(lines), expectedRows(status));
});

test('a cursor that agrees adds no disagreement line', () => {
  const dir = makeTree({ roadmap: TWO, phases: { 1: { plan: true } },
    cursor: { phase: 1, total: 2, name: 'One', status: 'planned', next: '/cad-execute 1', updated: '2026-10-04' } });
  const { lines, status } = statusLines(dir);
  assert.equal(status.cursor.agrees, true);
  assert.ok(!lines.some((l) => l.startsWith('Cursor says')));
});

test('an empty ## Phases section: no active phase and no rows', () => {
  const dir = makeTree({});
  writeFileSync(join(dir, 'ROADMAP.md'), '# Roadmap\n\n## Phases\n\n(nothing)\n');
  const { lines, status } = statusLines(dir);
  assert.equal(status.cycle, 'none');
  assert.ok(lines.includes('No active phase · the milestone is closed'));
  assert.deepEqual(rowFiles(lines), []);
});

test('every phase complete: no active phase and no rows', () => {
  const dir = makeTree({ roadmap: [{ n: 1, name: 'One', checked: true }],
    phases: { 1: { plan: true, summary: true, uat: [{ status: 'pass' }] } } });
  const { lines, status } = statusLines(dir);
  assert.equal(status.current, null);
  assert.equal(status.cycle, undefined);
  assert.ok(lines.includes('No active phase · every phase is complete'));
  assert.deepEqual(rowFiles(lines), []);
});

test('no ROADMAP.md: the phase section is unavailable and names no-roadmap', () => {
  const dir = makeTree({});
  const { lines } = statusLines(dir);
  assert.ok(lines.includes('Phase unavailable · no-roadmap · /cad-new-project'), lines.join('\n'));
  assert.deepEqual(rowFiles(lines), []);
});

test('a run that rejects or stdout that does not parse reads as unavailable', () => {
  assert.deepEqual(seamAnswer('not json'), { ok: false, reason: 'unparseable-output' });
  assert.deepEqual(seamAnswer(''), { ok: false, reason: 'unparseable-output' });
  assert.deepEqual(seamAnswer('[1]'), { ok: false, reason: 'unparseable-output' });
  assert.ok(paneLines(snap({ status: seamAnswer('nope') }), 200).includes('Phase unavailable · unparseable-output'));
});

/**
 * A `$` over the real disk, whose `process.run` executes its argv with
 * spawnSync and records it.
 */
function realHost(/** @type {string} */ cwd) {
  const $ = standIn({ cwd });
  /** @type {{argv: string[], init: any}[]} */
  const runs = [];
  return Object.assign($, {
    runs,
    plugin: { name: 'cadence', root: REPO },
    fs: {
      exists: async (/** @type {string} */ p) => existsSync(p),
      read: async (/** @type {string} */ p) => readFileSync(p, 'utf8'),
    },
    process: { run: async (/** @type {string[]} */ argv, /** @type {any} */ init) => {
      runs.push({ argv, init });
      const r = spawnSync(argv[0], argv.slice(1), { cwd: init.cwd, encoding: 'utf8', timeout: init.timeoutMs });
      return { exitCode: r.status ?? 1, stdout: r.stdout, stderr: r.stderr, isStdoutTruncated: false, isStderrTruncated: false };
    } },
  });
}

/** Open the pane through `/cad-panel` on a real host and wait for its draw. */
async function openOn(/** @type {any} */ h, /** @type {any} */ $) {
  const drawn = $.drawn();
  await h.hook('command.run')($, run(), counting({}));
  await drawn;
  return linesOf(await h.hook('ui.render', 'Pane')($, paneEvent({ bodyColumns: 200 }), counting(null)));
}

test('/cad-panel runs status once, against the walked root, and the pane shows its rows', async () => {
  const dir = makeTree({ roadmap: TWO, phases: { 1: { plan: ['PLAN-1.md', 'PLAN-2.md'] } } });
  const root = dirname(dir);
  mkdirSync(join(root, 'sub'));
  const h = handlers();
  const $ = realHost(join(root, 'sub'));
  const lines = await openOn(h, $);
  const status = $.runs.filter((r) => r.argv.at(-1) === 'status');
  assert.equal(status.length, 1);
  assert.deepEqual(status[0].argv, ['node', join(REPO, 'cadence-core/bin/planning.mjs'), '--dir', `${root}/.planning`, 'status']);
  assert.equal(status[0].init.cwd, root);
  assert.equal(typeof status[0].init.timeoutMs, 'number');
  assert.ok(lines.includes('  ☐ PLAN-1.md'), lines.join('\n'));
  assert.ok(lines.includes('  ☐ PLAN-2.md'), lines.join('\n'));
});

test('ten band draws run no process', async () => {
  const dir = makeTree({ roadmap: TWO, phases: { 1: { plan: true } } });
  const h = handlers();
  const $ = realHost(dirname(dir));
  const band = h.hook('ui.render', 'AbovePrompt');
  const ev = { surface: 'terminal', component: 'AbovePrompt', requestId: 'r',
    props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120 } };
  for (let i = 0; i < 10; i++) await band($, ev, counting(null));
  assert.equal($.runs.length, 0);
});

// --- UAT --------------------------------------------------------------------

test('the UAT line carries status\'s five counts exactly, in its order', () => {
  const dir = makeTree({ roadmap: TWO, phases: { 1: { plan: true, summary: true,
    uat: [{ status: 'pass' }, { status: 'pending' }, { status: 'pending' }, { status: 'fail' }] } } });
  const { lines, status } = statusLines(dir);
  const uat = status.phases.find((/** @type {any} */ p) => p.n === status.current).uat;
  const line = lines.find((l) => l.startsWith('UAT '));
  assert.equal(line, `UAT pass ${uat.pass} · fail ${uat.fail} · pending ${uat.pending} · skipped ${uat.skipped} · blocked ${uat.blocked}`);
  assert.deepEqual(line.match(/\d+/g).map(Number), [uat.pass, uat.fail, uat.pending, uat.skipped, uat.blocked]);
  assert.equal(uat.pending, 2);
});

test('no UAT.md, no current phase, or no status: no UAT line and no zero standing in', () => {
  const none = statusLines(makeTree({ roadmap: TWO, phases: { 1: { plan: true, summary: true } } }));
  assert.equal(none.status.phases[0].uat, undefined);
  const closed = makeTree({});
  writeFileSync(join(closed, 'ROADMAP.md'), '# Roadmap\n\n## Phases\n\n(nothing)\n');
  for (const lines of [none.lines, statusLines(closed).lines, statusLines(makeTree({})).lines]) {
    assert.ok(!lines.some((l) => l.startsWith('UAT')), lines.join('\n'));
    assert.ok(!lines.some((l) => /\b(?:pass|fail|pending|skipped|blocked) 0\b/.test(l)), lines.join('\n'));
  }
});

test('the UAT line adds no run to a fetch', async () => {
  const dir = makeTree({ roadmap: TWO, phases: { 1: { plan: true, summary: true, uat: [{ status: 'pending' }] } } });
  const h = handlers();
  const $ = realHost(dirname(dir));
  const lines = await openOn(h, $);
  assert.ok(lines.some((l) => l.startsWith('UAT ') && l.endsWith('  1 pending')), lines.join('\n'));
  assert.equal($.runs.filter((r) => r.argv.at(-1) === 'status').length, 1);
  assert.equal($.runs.filter((r) => r.argv.some((a) => /uat/i.test(a))).length, 0);
});

// --- open captures ----------------------------------------------------------

/** The pane's open-captures line for a fixture's real `capture-check` output. */
function capturesOf(/** @type {string} */ dir) {
  const out = stdoutOf(['capture-check'], dir);
  const line = paneLines(snap({ captures: seamAnswer(out) }), 200).find((l) => l.startsWith('Open captures'));
  return { line, check: JSON.parse(out) };
}

const placeholders = (/** @type {Record<string, string[]>} */ by) => ['Todos', 'Seeds', 'Notes']
  .map((h) => `## ${h}\n\n${(by[h] || ['- None.']).join('\n')}\n`).join('\n');

test('three substantive bullets beside None. placeholders: capture-check\'s substantive, 3', () => {
  const dir = makeTree({});
  writeFileSync(join(dir, 'CAPTURE.md'), `# Capture\n\n${placeholders({ Todos: ['- [ ] one', '- [ ] two'], Notes: ['- three'] })}`);
  const { line, check } = capturesOf(dir);
  assert.equal(check.substantive, 3);
  assert.equal(line, `Open captures ${check.substantive}`);
});

test('only placeholders gives 0, as capture-check counts them', () => {
  const dir = makeTree({});
  writeFileSync(join(dir, 'CAPTURE.md'), `# Capture\n\n${placeholders({})}`);
  const { line, check } = capturesOf(dir);
  assert.equal(check.substantive, 0);
  assert.equal(line, 'Open captures 0');
});

test('no CAPTURE.md gives 0, from capture-check\'s exists: false', () => {
  const { line, check } = capturesOf(makeTree({}));
  assert.equal(check.exists, false);
  assert.equal(check.substantive, 0);
  assert.equal(line, 'Open captures 0');
});

test('a refusal, a rejected run or unparseable stdout reads as unavailable, naming the reason', () => {
  const at = (/** @type {any} */ captures) => paneLines(snap({ captures }), 200).find((l) => l.startsWith('Open captures'));
  assert.equal(at(seamAnswer('{"ok":false,"reason":"unreadable-capture","detail":"x"}')),
    'Open captures unavailable · unreadable-capture');
  assert.equal(at({ ok: false, reason: 'run-failed' }), 'Open captures unavailable · run-failed');
  assert.equal(at(seamAnswer('garbage')), 'Open captures unavailable · unparseable-output');
});

test('one fetch runs capture-check once, against the walked root, and the pane shows its count', async () => {
  const dir = makeTree({ roadmap: TWO, phases: { 1: { plan: true } } });
  writeFileSync(join(dir, 'CAPTURE.md'), `# Capture\n\n${placeholders({ Notes: ['- one', '- two'] })}`);
  const root = dirname(dir);
  const h = handlers();
  const $ = realHost(root);
  const lines = await openOn(h, $);
  const checks = $.runs.filter((r) => r.argv.at(-1) === 'capture-check');
  assert.equal(checks.length, 1);
  assert.deepEqual(checks[0].argv.slice(-3), ['--dir', `${root}/.planning`, 'capture-check']);
  assert.equal(checks[0].init.cwd, root);
  assert.equal(typeof checks[0].init.timeoutMs, 'number');
  assert.ok(lines.includes('CAPTURES   2 open'), lines.join('\n'));
});

// --- token spend ------------------------------------------------------------

/**
 * The AC3 record: phase 1 holds a return with 100, a checkpoint with 50 and a
 * figureless return; phase 2 a return with 7. With `windowed`, the figureless
 * return's agent also has a step-window fact, as the module writes it.
 */
function spendTree(/** @type {{windowed?: boolean, figurelessOnly?: boolean}} */ { windowed = false, figurelessOnly = false } = {}) {
  const dir = makeTree({});
  const ev = (/** @type {number} */ phase, /** @type {string} */ event, /** @type {string} */ plan, /** @type {any} */ extra = {}) =>
    appendEvent(dir, { phase, family: 'lifecycle', event, plan, role: 'cad-reviewer', ...extra });
  appendEvent(dir, { phase: 1, family: 'lifecycle', event: 'phase_start', sha: 'abc1234' });
  if (!figurelessOnly) {
    ev(1, DISPATCH, 'r1', { ts: '2026-10-04T10:00:00.000Z' });
    ev(1, 'return', 'r1', { tokens: 100, ts: '2026-10-04T10:01:00.000Z' });
    ev(1, DISPATCH, 'c1', { role: 'cad-executor', ts: '2026-10-04T10:02:00.000Z' });
    ev(1, 'checkpoint', 'c1', { role: 'cad-executor', tokens: 50, ts: '2026-10-04T10:03:00.000Z' });
  }
  ev(1, DISPATCH, 'f1', { ts: '2026-10-04T10:04:00.000Z' });
  if (windowed) {
    appendEvent(dir, { phase: 1, family: 'lifecycle', event: STEP_WINDOW, agent_id: 'a9', tokens: 4321,
      ts: '2026-10-04T10:04:59.000Z' });
  }
  ev(1, 'return', 'f1', { agent_id: 'a9', ts: '2026-10-04T10:05:00.000Z' });
  appendEvent(dir, { phase: 2, family: 'lifecycle', event: 'phase_start', sha: 'def5678' });
  ev(2, DISPATCH, 'r2', { ts: '2026-10-04T11:00:00.000Z' });
  ev(2, 'return', 'r2', { tokens: 7, ts: '2026-10-04T11:01:00.000Z' });
  return dir;
}

/** The real `trace render --phase 1` of a fixture, raw and as the pane reads it. */
function renderOf(/** @type {string} */ dir) {
  const out = stdoutOf(['trace', 'render', '--phase', '1'], dir);
  const render = JSON.parse(out);
  const rolesSum = Object.values(render.roles).reduce((n, r) => n + (r.tokens ?? 0), 0);
  const lines = paneLines(snap({ spend: seamAnswer(out) }), 300);
  return { render, rolesSum, lines, spend: spendOf(render) };
}

const spendLine = (/** @type {string[]} */ lines) => lines.find((l) => l.startsWith('Tokens on subagent returns'));

test('the spend is the render\'s roles total, returns and checkpoints, with the unrecorded count', () => {
  const { rolesSum, lines, spend } = renderOf(spendTree());
  assert.equal(spend.total, 150);
  assert.equal(spend.total, rolesSum);
  assert.equal(spend.unrecorded, 1);
  const line = spendLine(lines);
  assert.equal(line, 'Tokens on subagent returns 150 · 1 unrecorded');
  const caveat = lines[lines.indexOf(line) + 1];
  for (const entry of SPEND_EXCLUDES) assert.ok(caveat.includes(entry), `${entry} missing from: ${caveat}`);
});

test('a step-window fact for the figureless bracket leaves the total at the render\'s roles sum', () => {
  const { render, rolesSum, spend, lines } = renderOf(spendTree({ windowed: true }));
  assert.ok(render.brackets.some((/** @type {any} */ b) => b.tokens === 4321), 'the fact reached its bracket');
  assert.equal(spend.total, rolesSum);
  assert.equal(spend.total, 150);
  assert.equal(spend.unrecorded, 1);
  assert.equal(spendLine(lines), 'Tokens on subagent returns 150 · 1 unrecorded');
});

test('a phase whose only dispatch returned no figure shows no 0, and one unrecorded', () => {
  const { spend, lines } = renderOf(spendTree({ figurelessOnly: true }));
  assert.equal(spend.total, null);
  assert.equal(spend.unrecorded, 1);
  const line = spendLine(lines);
  assert.equal(line, 'Tokens on subagent returns: none recorded · 1 unrecorded');
  assert.doesNotMatch(line, /\b0\b/);
});

test('no roles, or a failed render: no figure, or unavailable naming the reason', () => {
  assert.deepEqual(spendOf({ ok: true }), { total: null, unrecorded: 0 });
  const failed = paneLines(snap({ spend: { ok: false, reason: 'run-failed' } }), 200);
  assert.ok(failed.includes('Tokens on subagent returns unavailable · run-failed'));
  assert.ok(!paneLines(snap(), 200).some((l) => l.startsWith('Tokens')), 'no spend run, no spend line');
});

test('one fetch renders the spend for status\'s current, after the status run', async () => {
  const dir = makeTree({ roadmap: TWO, phases: { 1: { plan: true, summary: true }, 2: { plan: true } } });
  const root = dirname(dir);
  const h = handlers();
  const $ = realHost(root);
  await openOn(h, $);
  const names = $.runs.map((r) => r.argv.slice(4).join(' '));
  const renders = $.runs.filter((r) => r.argv.includes('render'));
  assert.equal(renders.length, 1);
  assert.deepEqual(renders[0].argv.slice(-4), ['trace', 'render', '--phase', '1']);
  assert.equal(renders[0].init.cwd, root);
  assert.equal(typeof renders[0].init.timeoutMs, 'number');
  assert.ok(names.indexOf('status') < names.indexOf('trace render --phase 1'), names.join(' | '));
});

test('a status answer with current null runs no render', async () => {
  const dir = makeTree({});
  writeFileSync(join(dir, 'ROADMAP.md'), '# Roadmap\n\n## Phases\n\n(nothing)\n');
  const h = handlers();
  const $ = realHost(dirname(dir));
  const lines = await openOn(h, $);
  assert.equal($.runs.filter((r) => r.argv.includes('render')).length, 0);
  assert.ok(!lines.some((l) => l.startsWith('SPEND')));
});

// --- running agents ---------------------------------------------------------

const T0 = Date.parse('2026-10-04T12:00:00.000Z');
const iso = (/** @type {number} */ ms) => new Date(ms).toISOString();
const resolve = (/** @type {any} */ extra) => ({ corr: '1-abc1234', phase: '1', ts: iso(T0 - 60000),
  family: 'routing', event: 'resolve', role: 'cad-reviewer', agent: 'cad-reviewer-low', model: 'sonnet',
  effort: 'low', ...extra });
const REVIEWER = { id: 'a1', role: 'cad-reviewer', rung: 'low' };
const seenAt = (/** @type {string|null} */ type, id = 'a1') => sightStart([], id, type, T0);

test('parsing keeps resolves and skips malformed lines and other events', () => {
  const text = [JSON.stringify(resolve({})), '{not json', '',
    JSON.stringify({ family: 'lifecycle', event: 'dispatch', role: 'cad-reviewer' }),
    JSON.stringify({ family: 'routing', event: 'escalate', agent: 'cad-reviewer-low' }),
    JSON.stringify(resolve({ model: 'opus' }))].join('\n');
  const got = parseResolves(text);
  assert.equal(got.length, 2);
  assert.deepEqual(got.map((r) => r.model), ['sonnet', 'opus']);
});

test('of two resolves before the start, the newer one\'s effort and model show', () => {
  const rows = agentRows([REVIEWER], seenAt('cadence:cad-reviewer-low'), [
    resolve({ ts: iso(T0 - 120000), model: 'haiku', effort: 'medium' }),
    resolve({ ts: iso(T0 - 1000), model: 'sonnet', effort: 'low' }),
  ], 'm');
  assert.deepEqual(rows, ['cad-reviewer · rung low · sonnet']);
});

test('a resolve written after the start is ignored; one at the start counts', () => {
  const sights = seenAt('cadence:cad-reviewer-low');
  assert.deepEqual(agentRows([REVIEWER], sights, [resolve({}), resolve({ ts: iso(T0 + 1), model: 'opus' })], 'm'),
    ['cad-reviewer · rung low · sonnet']);
  assert.deepEqual(agentRows([REVIEWER], sights, [resolve({}), resolve({ ts: iso(T0), model: 'opus' })], 'm'),
    ['cad-reviewer · rung low · opus']);
});

test('a resolve for another agent is ignored', () => {
  assert.deepEqual(agentRows([REVIEWER], seenAt('cadence:cad-reviewer-low'),
    [resolve({ agent: 'cad-reviewer-high', effort: 'high', model: 'opus' })], 'm'),
  ['cad-reviewer · rung low · unrecorded']);
});

test('a differing phase or corr changes nothing', () => {
  const sights = seenAt('cadence:cad-reviewer-low');
  const base = agentRows([REVIEWER], sights, [resolve({})], 'm');
  assert.deepEqual(agentRows([REVIEWER], sights, [resolve({ phase: '9', corr: '9-fffffff', plan: 'x' })], 'm'), base);
});

test('model null shows the session model, marked as the session\'s', () => {
  assert.deepEqual(agentRows([REVIEWER], seenAt('cadence:cad-reviewer-low'), [resolve({ model: null })], 'claude-x'),
    ['cad-reviewer · rung low · claude-x (session)']);
});

test('no matching resolve: role and rung from the host type, model unrecorded', () => {
  assert.deepEqual(agentRows([REVIEWER], seenAt('cadence:cad-reviewer-low'), [], 'm'),
    ['cad-reviewer · rung low · unrecorded']);
  const analyzer = { id: 'a2', role: 'cad-assumptions-analyzer', rung: 'xhigh' };
  assert.deepEqual(agentRows([analyzer], seenAt('cadence:cad-assumptions-analyzer', 'a2'), [], 'm'),
    ['cad-assumptions-analyzer · rung xhigh · unrecorded']);
});

test('an agent the reconcile added is recorded at its first draw, typeless, and its stop drops it', () => {
  const drawn = sightDraw([], [REVIEWER], T0);
  assert.deepEqual(drawn, [{ id: 'a1', type: null, seen: T0 }]);
  assert.equal(sightDraw(drawn, [REVIEWER], T0 + 5), drawn, 'a second draw changes nothing');
  assert.deepEqual(agentRows([REVIEWER], drawn, [resolve({})], 'm'), ['cad-reviewer · rung low · unrecorded']);
  assert.deepEqual(sightStop(drawn, 'a1'), []);
  assert.deepEqual(sightDraw(drawn, [], T0), []);
});

test('no running agents: one line saying so', () => {
  assert.deepEqual(agentRows([], [], [resolve({})], 'm'), ['No Cadence agents running']);
});

test('a start seen while the pane was closed shows its routed rung and model; its stop drops the row', async () => {
  const h = handlers();
  const now = Date.now();
  const trace = [
    resolve({ ts: iso(now - 60000), model: 'sonnet', effort: 'low' }),
    resolve({ ts: iso(now + 600000), model: 'opus', effort: 'low' }),
  ].map((r) => JSON.stringify(r)).join('\n') + '\n';
  const $ = standIn({ files: { '/proj/.planning': '', '/proj/.planning/STATE.md': STATE,
    '/proj/.planning/trace.jsonl': trace } });
  const start = { hook_event_name: 'SubagentStart', session_id: 'session-1', agent_id: 'a1',
    agent_type: 'cadence:cad-reviewer-low' };
  await h.hook('classic.SubagentStart')($, start, counting({}));
  let reads = 0;
  const read = $.fs.read;
  $.fs.read = async (/** @type {string} */ p) => { reads++; return read(p); };
  const drawn = $.drawn();
  await h.hook('command.run')($, run(), counting({}));
  await drawn;
  const render = h.hook('ui.render', 'Pane');
  let lines = linesOf(await render($, paneEvent({ bodyColumns: 200 }), counting(null)));
  assert.ok(lines.some((l) => l.endsWith('● cad-reviewer · rung low · sonnet')), lines.join('\n'));
  assert.ok(!lines.some((l) => l.includes('opus')));

  // Hold every read from here: the stop's own refresh starts a fetch that
  // never settles, so the draw below has only the snapshot it had before.
  $.fs.read = () => new Promise(() => {});
  let invalidated = $.invalidations;
  await h.hook('classic.SubagentStop')($, { ...start, hook_event_name: 'SubagentStop' }, counting({}));
  await settle();
  invalidated = $.invalidations - invalidated;
  lines = linesOf(await render($, paneEvent({ bodyColumns: 200 }), counting(null)));
  assert.ok(!lines.some((l) => l.includes('cad-reviewer')), lines.join('\n'));
  assert.ok(lines.some((l) => l.endsWith(' No Cadence agents running')));
  assert.equal(invalidated, 1, 'only the stop\'s own redraw: no fetch settled in between');
  assert.ok(reads >= 1);
});

test('a start the band\'s reconcile saw first still shows its routed model, drawn before or after', async () => {
  for (const paneFirst of [false, true]) {
    const h = handlers();
    const trace = JSON.stringify(resolve({ ts: iso(Date.now() - 60000), model: 'sonnet', effort: 'low' })) + '\n';
    const $ = standIn({ files: { '/proj/.planning': '', '/proj/.planning/STATE.md': STATE,
      '/proj/.planning/trace.jsonl': trace } });
    $.agent.list = async () => [{ id: 'a1', type: 'cadence:cad-reviewer-low', status: 'running' }];
    const drawn = $.drawn();
    await h.hook('command.run')($, run(), counting({}));
    await drawn;
    await h.hook('ui.render', 'AbovePrompt')($, bandEvent(), counting(null));
    const render = h.hook('ui.render', 'Pane');
    if (paneFirst) await render($, paneEvent({ bodyColumns: 200 }), counting(null));
    await h.hook('classic.SubagentStart')($, { hook_event_name: 'SubagentStart', session_id: 'session-1',
      agent_id: 'a1', agent_type: 'cadence:cad-reviewer-low' }, counting({}));
    const lines = linesOf(await render($, paneEvent({ bodyColumns: 200 }), counting(null)));
    assert.ok(lines.some((l) => l.endsWith('● cad-reviewer · rung low · sonnet')), `paneFirst ${paneFirst}\n${lines.join('\n')}`);
  }
});

test('a resolve whose role or effort is not text costs that field, not the pane', async () => {
  const h = handlers();
  const trace = '{"family":"routing","event":"resolve","agent":"cad-reviewer-low","model":"sonnet",'
    + `"role":{"toString":null},"effort":{"toString":null},"ts":"${iso(Date.now() - 60000)}"}\n`;
  const $ = standIn({ files: { '/proj/.planning': '', '/proj/.planning/STATE.md': STATE,
    '/proj/.planning/trace.jsonl': trace } });
  await h.hook('classic.SubagentStart')($, { hook_event_name: 'SubagentStart', session_id: 'session-1',
    agent_id: 'a1', agent_type: 'cadence:cad-reviewer-low' }, counting({}));
  const drawn = $.drawn();
  await h.hook('command.run')($, run(), counting({}));
  await drawn;
  const tree = await h.hook('ui.render', 'Pane')($, paneEvent({ bodyColumns: 200 }), counting('next drew this'));
  const lines = linesOf(tree);
  assert.ok(lines.some((l) => l.endsWith('● cad-reviewer · rung low · sonnet')), lines.join('\n'));
  assert.ok(lines.some((l) => l.startsWith('next ')), lines.join('\n'));
  assert.ok(lines.some((l) => l.startsWith('CAPTURES ')), lines.join('\n'));
});

test('a start upgrades a typeless record once, and never retypes a typed one', () => {
  const drawn = sightDraw([], [REVIEWER], T0);
  const started = sightStart(drawn, 'a1', 'cadence:cad-reviewer-low', T0 + 5);
  assert.deepEqual(started, [{ id: 'a1', type: 'cadence:cad-reviewer-low', seen: T0 + 5 }]);
  assert.equal(sightStart(started, 'a1', 'cadence:cad-reviewer-high', T0 + 9), started);
  assert.equal(sightStart(drawn, 'a1', undefined, T0 + 5), drawn);
});

// --- the band's button ------------------------------------------------------

/** A `ui.resolve` that offers a Button, as the host's does. */
const withButton = () => ({
  Box: (/** @type {any} */ props) => ({ type: 'Box', props }),
  Text: (/** @type {any} */ props) => ({ type: 'Text', props }),
  Button: (/** @type {any} */ props) => ({ type: 'Button', props }),
});

/** Every element of a type in a tree. */
function find(/** @type {any} */ tree, /** @type {string} */ type) {
  /** @type {any[]} */
  const out = [];
  const walk = (/** @type {any} */ n) => {
    if (!n || typeof n !== 'object') return;
    if (n.type === type) out.push(n);
    const kids = n.props && n.props.children;
    if (Array.isArray(kids)) kids.forEach(walk);
    else walk(kids);
  };
  walk(tree);
  return out;
}

const bandEvent = (/** @type {any} */ props = {}) => ({ surface: 'terminal', component: 'AbovePrompt', requestId: 'r',
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 120, ...props } });

/** Drawn cells of `[ label ]`, as the terminal draws a Button. */
const buttonCells = (/** @type {any} */ b) => Array.from(`[ ${b.props.label} ]`).length;

test('in a project, the band carries a Button with hotkey p', async () => {
  const h = handlers();
  const tree = await h.hook('ui.render', 'AbovePrompt')(standIn({ resolve: withButton }), bandEvent(), counting(null));
  const buttons = find(tree, 'Button');
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].props.hotkey, 'p');
  assert.match(buttons[0].props.hotkey, /^[a-z]$/);
  assert.equal(buttons[0].props.label, 'pane');
  assert.ok(find(tree, 'Text').some((t) => /^Cadence · Phase 1 of 2/.test(t.props.children)));
});

test('pressing it opens the pane /cad-panel opens, and starts a fetch', async () => {
  const viaCommand = standIn();
  await handlers().hook('command.run')(viaCommand, run(), counting({}));

  const h = handlers();
  const $ = standIn({ resolve: withButton });
  const tree = await h.hook('ui.render', 'AbovePrompt')($, bandEvent(), counting(null));
  let reads = 0;
  const read = $.fs.read;
  $.fs.read = async (/** @type {string} */ p) => { reads++; return read(p); };
  const drawn = $.drawn();
  find(tree, 'Button')[0].props.onPress({});
  await drawn;
  assert.equal($.opens.length, 1);
  assert.deepEqual($.opens, viaCommand.opens);
  assert.ok(reads >= 1, 'a fetch ran');
  assert.ok(linesOf(await h.hook('ui.render', 'Pane')($, paneEvent(), counting(null))).includes('next /cad-execute 1'));
});

test('a press whose open throws is swallowed', async () => {
  const h = handlers();
  const $ = standIn({ resolve: withButton, open: async () => { throw new Error('refused'); } });
  const tree = await h.hook('ui.render', 'AbovePrompt')($, bandEvent(), counting(null));
  assert.doesNotThrow(() => find(tree, 'Button')[0].props.onPress({}));
  await settle();
});

test('the panel setting is on only when it is exactly true', () => {
  assert.equal(panelOn({ panel: true }), true);
  for (const off of [undefined, null, {}, { panel: false }, { panel: 'true' }, { panel: 1 }, 'panel']) {
    assert.equal(panelOn(off), false, JSON.stringify(off));
  }
});

test('with the panel setting off or unset, the band draws nothing and passes the drawing beneath through', async () => {
  const theirs = { type: 'Text', props: { children: 'another mod' } };
  // No options at all: registered by hand, since `handlers()` turns the band on.
  /** @type {Function[]} */
  const bare = [];
  register((/** @type {string} */ pattern, /** @type {any} */ a, /** @type {any} */ b) => {
    if (pattern === 'ui.render' && a?.component === 'AbovePrompt') bare.push(b);
  });
  for (const band of [bare[0], ...[null, {}, { panel: false }].map((o) => handlers(o).hook('ui.render', 'AbovePrompt'))]) {
    const next = counting(theirs);
    const tree = await band(standIn({ resolve: withButton }), bandEvent(), next);
    assert.equal(tree, theirs);
    assert.equal(next.calls, 1);
  }
  const on = await handlers({ panel: true }).hook('ui.render', 'AbovePrompt')(standIn({ resolve: withButton }), bandEvent(),
    counting(theirs));
  assert.equal(find(on, 'Button').length, 1);
});

test('no Button under a survey, or with no .planning/ up the walk', async () => {
  const h = handlers();
  const band = h.hook('ui.render', 'AbovePrompt');
  const theirs = { type: 'Text', props: { children: 'another mod' } };
  for (const [$, ev] of [[standIn({ resolve: withButton }), bandEvent({ hasSurvey: true })],
    [standIn({ resolve: withButton, files: { '/proj/.git': '' } }), bandEvent()],
    [standIn({ resolve: withButton, files: {} }), bandEvent()]]) {
    const tree = await band($, ev, counting(theirs));
    assert.equal(tree, theirs);
    assert.equal(find(tree, 'Button').length, 0);
  }
});

test('the band\'s text, the gap and the button never exceed bodyColumns', async () => {
  const h = handlers();
  const band = h.hook('ui.render', 'AbovePrompt');
  const long = STATE.replace('Next: /cad-execute 1', `Next: /cad-execute 1 ${'x'.repeat(200)}`);
  for (const files of [{ '/proj/.planning': '', '/proj/.planning/STATE.md': STATE },
    { '/proj/.planning': '', '/proj/.planning/STATE.md': long }, { '/proj/.planning': '' }]) {
    for (const width of [20, 40, 120]) {
      const tree = await band(standIn({ resolve: withButton, files }), bandEvent({ bodyColumns: width }), counting(null));
      const [row] = tree.props.children;
      assert.equal(row.props.flexDirection, 'row');
      const [text, button] = row.props.children;
      const used = Array.from(text.props.children).length + (row.props.gap ?? 0) + buttonCells(button);
      assert.ok(used <= width, `${width}: ${used} cells: ${text.props.children}`);
    }
  }
});

// --- the dashboard ----------------------------------------------------------

/** The Text segment whose text is `text`, in the row that holds `marker`. */
const segment = (/** @type {any[][]} */ rows, /** @type {string} */ marker, /** @type {string} */ text) =>
  rows.find((row) => row.some((t) => t.props.children.includes(marker)))?.find((t) => t.props.children === text);

test('inline, the pane draws a bold Cadence title row, no border of its own, and its plan glyphs in color', async () => {
  const dir = makeTree({ roadmap: TWO, phases: { 1: { plan: ['PLAN-1.md', 'PLAN-2.md'],
    uat: [{ status: 'pass' }, { status: 'fail' }] } } });
  mkdirSync(join(dir, 'phases', '1', 'reports'));
  writeFileSync(join(dir, 'phases', '1', 'reports', 'plan-1.md'), 'PLAN COMPLETE\nPlan: PLAN-1.md\n');
  const h = handlers();
  const $ = realHost(dirname(dir));
  const drawn = $.drawn();
  await h.hook('command.run')($, run(), counting({}));
  await drawn;
  const tree = await h.hook('ui.render', 'Pane')($, paneEvent({ bodyColumns: 120 }), counting(null));
  const rows = rowsOf(tree);
  for (const el of [...find(tree, 'Box'), ...find(tree, 'Text')]) {
    assert.ok(!Object.keys(el.props).some((k) => /^border/.test(k)), `no border: ${JSON.stringify(el.props)}`);
  }
  for (const label of ['PLANS', 'AGENTS', 'UAT', 'CAPTURES']) {
    const head = rows.map((row) => row[0]).find((t) => t.props.children.trimEnd() === label);
    assert.ok(head, `${label} row`);
    assert.equal(head.props.bold, true, label);
  }
  assert.equal(segment(rows, 'PLAN-1.md', '☑')?.props.color, 'green');
  assert.equal(segment(rows, 'PLAN-2.md', '☐')?.props.color, 'yellow');
  assert.equal(segment(rows, '1 fail', '1 fail')?.props.color, 'red');
  assert.equal(segment(rows, '1 pass', '1 pass')?.props.color, 'green');
  const plans = rows.find((row) => row[0].props.children.trimEnd() === 'PLANS');
  assert.ok(plans.some((t) => /^█+$/.test(t.props.children) && t.props.color === 'green'));
  assert.ok(plans.some((t) => /^░+$/.test(t.props.children) && t.props.dimColor === true));
});

/** A tree for the fixture phase, drawn at `bodyColumns` 80 where the host seats it at `placement`. */
async function drawnAt(/** @type {'dock' | 'inline'} */ placement) {
  const dir = makeTree({ roadmap: TWO, phases: { 1: { plan: ['PLAN-1.md', 'PLAN-2.md'] } } });
  const h = handlers();
  const $ = realHost(dirname(dir));
  const drawn = $.drawn();
  await h.hook('command.run')($, run(), counting({}));
  await drawn;
  return h.hook('ui.render', 'Pane')($, paneEvent({ bodyColumns: 80, placement }), counting(null));
}

test('docked, the pane draws a round frame and lays its rows out four cells narrower', async () => {
  const tree = await drawnAt('dock');
  assert.equal(tree.props.borderStyle, 'round');
  assert.equal(tree.props.paddingX, 1);
  const rules = linesOf(tree).filter((l) => /^─+$/.test(l));
  assert.ok(rules.length >= 1);
  for (const rule of rules) assert.equal(rule.length, 76);
  assert.ok(linesOf(tree).every((l) => Array.from(l).length <= 76));
});

test('inline, the host borders the pane, so it draws no frame and uses the full width', async () => {
  const tree = await drawnAt('inline');
  assert.ok(!Object.keys(tree.props).some((k) => /^(border|padding)/.test(k)), JSON.stringify(Object.keys(tree.props)));
  for (const rule of linesOf(tree).filter((l) => /^─+$/.test(l))) assert.equal(rule.length, 80);
});

test('the next command is a button: n puts it in the prompt, and the title says so', async () => {
  const h = handlers();
  const $ = standIn({ resolve: withButton });
  /** @type {any[]} */
  const fills = [];
  Object.assign($, { prompt: { fill: async (/** @type {any} */ args) => { fills.push(args); return {}; } } });
  const drawn = $.drawn();
  await h.hook('command.run')($, run(), counting({}));
  await drawn;
  const tree = await h.hook('ui.render', 'Pane')($, paneEvent(), counting(null));
  const buttons = find(tree, 'Button');
  assert.equal(buttons.length, 1);
  assert.deepEqual([buttons[0].props.label, buttons[0].props.hotkey, buttons[0].props.variant], ['/cad-execute 1', 'n', 'primary']);
  assert.ok(find(tree, 'Text').some((t) => t.props.children === 'n next'));
  buttons[0].props.onPress({});
  await settle();
  assert.deepEqual(fills, [{ text: '/cad-execute 1', mode: 'replace' }]);
});

test('with no Button in the table the next command draws as text, with no hint', async () => {
  const h = handlers();
  const $ = standIn();
  const drawn = $.drawn();
  await h.hook('command.run')($, run(), counting({}));
  await drawn;
  const tree = await h.hook('ui.render', 'Pane')($, paneEvent(), counting(null));
  assert.equal(find(tree, 'Button').length, 0);
  assert.ok(linesOf(tree).includes('next /cad-execute 1'));
  assert.ok(!find(tree, 'Text').some((t) => t.props.children === 'n next'));
});

test('a fill that rejects is swallowed', async () => {
  const h = handlers();
  const $ = standIn({ resolve: withButton });
  Object.assign($, { prompt: { fill: async () => { throw new Error('no composer'); } } });
  const drawn = $.drawn();
  await h.hook('command.run')($, run(), counting({}));
  await drawn;
  const tree = await h.hook('ui.render', 'Pane')($, paneEvent(), counting(null));
  assert.doesNotThrow(() => find(tree, 'Button')[0].props.onPress({}));
  await settle();
});

// --- /cad-panel's own row in the transcript --------------------------------

const outputEvent = (/** @type {string} */ text) => ({ surface: 'terminal', component: 'CommandOutput', requestId: 'm1',
  props: { command: 'cad-panel', args: '', text, isErrored: false } });

test('the command row hook is narrowed to /cad-panel', () => {
  const { matcher } = handlers().one('ui.render', 'CommandOutput');
  assert.deepEqual(matcher, { component: 'CommandOutput', props: { command: 'cad-panel' } });
});

test('an empty answer, which the host prints as a bare cadence:, draws one dim line instead', async () => {
  const hook = handlers().hook('ui.render', 'CommandOutput');
  const engine = { type: 'engine' };
  for (const text of ['cadence: ', 'cadence:', '']) {
    const next = counting(engine);
    const tree = await hook(standIn(), outputEvent(text), next);
    assert.equal(next.calls, 1);
    assert.equal(tree.type, 'Box');
    assert.equal(tree.props.paddingLeft, 2);
    const [line] = tree.props.children;
    assert.deepEqual(line.props, { dimColor: true, children: '⎿  Cadence pane open' });
  }
});

test('an answer with words, or a table that throws, draws what the host drew', async () => {
  const hook = handlers().hook('ui.render', 'CommandOutput');
  const engine = { type: 'engine' };
  const said = counting(engine);
  assert.equal(await hook(standIn(), outputEvent(`cadence: ${NO_PROJECT_TEXT}`), said), engine);
  assert.equal(said.calls, 1);
  const thrown = counting(engine);
  assert.equal(await hook(standIn({ resolve: () => { throw new Error('no table'); } }), outputEvent('cadence: '), thrown), engine);
  assert.equal(thrown.calls, 1);
});

test('a running agent draws behind a cyan dot', async () => {
  const h = handlers();
  const trace = JSON.stringify(resolve({ ts: iso(Date.now() - 60000), model: 'sonnet', effort: 'low' })) + '\n';
  const $ = standIn({ files: { '/proj/.planning': '', '/proj/.planning/STATE.md': STATE,
    '/proj/.planning/trace.jsonl': trace } });
  await h.hook('classic.SubagentStart')($, { hook_event_name: 'SubagentStart', session_id: 'session-1',
    agent_id: 'a1', agent_type: 'cadence:cad-reviewer-low' }, counting({}));
  const drawn = $.drawn();
  await h.hook('command.run')($, run(), counting({}));
  await drawn;
  const rows = rowsOf(await h.hook('ui.render', 'Pane')($, paneEvent({ bodyColumns: 200 }), counting(null)));
  const agent = rows.find((row) => row.some((t) => t.props.children.includes('cad-reviewer')));
  assert.equal(agent[0].props.children.trimEnd(), 'AGENTS');
  assert.equal(agent[0].props.bold, true);
  assert.equal(agent.find((t) => t.props.children === '●')?.props.color, 'cyan');
});

test('no Text child of the pane holds a control character', async () => {
  const h = handlers();
  const trace = JSON.stringify(resolve({ ts: iso(Date.now() - 60000), model: 'son\x1b[2Jnet', effort: 'low\x07' })) + '\n';
  const $ = standIn({ files: { '/proj/.planning': '', '/proj/.planning/trace.jsonl': trace,
    '/proj/.planning/STATE.md': STATE.replace('Next: /cad-execute 1', 'Next: /cad-execute 1\x1b[2J\x07') } });
  await h.hook('classic.SubagentStart')($, { hook_event_name: 'SubagentStart', session_id: 'session-1',
    agent_id: 'a1', agent_type: 'cadence:cad-reviewer-low' }, counting({}));
  const drawn = $.drawn();
  await h.hook('command.run')($, run(), counting({}));
  await drawn;
  const tree = await h.hook('ui.render', 'Pane')($, paneEvent({ bodyColumns: 200 }), counting(null));
  const lines = linesOf(tree);
  assert.ok(lines.includes('next /cad-execute 1?[2J?'), lines.join('\n'));
  assert.ok(lines.some((l) => l.includes('son?[2Jnet')), lines.join('\n'));
  for (const t of find(tree, 'Text')) assert.doesNotMatch(String(t.props.children), /[\x00-\x1f\x7f-\x9f]/);
});
