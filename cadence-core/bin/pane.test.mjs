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
import { agentRows, NO_CURSOR_NEXT, NO_PROJECT_TEXT, paneLines, parseResolves, READING_LINE, seamAnswer, sightDraw,
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

/** The module's handlers, as a recording `on` collects them, sharing one state. */
function handlers() {
  /** @type {{pattern: string, matcher: any, hook: Function}[]} */
  const seen = [];
  register((/** @type {string} */ pattern, /** @type {any} */ a, /** @type {any} */ b) => {
    seen.push(b === undefined ? { pattern, matcher: undefined, hook: a } : { pattern, matcher: a, hook: b });
  });
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

/** The lines of a Pane render's tree. */
function linesOf(/** @type {any} */ tree) {
  assert.equal(tree.type, 'Box');
  assert.equal(tree.props.flexDirection, 'column');
  return tree.props.children.map((/** @type {any} */ t) => {
    assert.equal(t.type, 'Text');
    return t.props.children;
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
  assert.ok(lines.includes('PLAN-1.md · outstanding'));
  assert.ok(lines.includes('PLAN-2.md · outstanding'));
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
  assert.ok(lines.some((l) => l.startsWith('UAT pass 0 · fail 0 · pending 1')));
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
  assert.ok(lines.includes('Open captures 2'), lines.join('\n'));
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
  assert.ok(!lines.some((l) => l.startsWith('Tokens')));
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
  assert.ok(lines.includes('cad-reviewer · rung low · sonnet'), lines.join('\n'));
  assert.ok(!lines.some((l) => l.includes('opus')));

  // Hold every read from here: the stop's own refresh starts a fetch that
  // never settles, so the draw below has only the snapshot it had before.
  $.fs.read = () => new Promise(() => {});
  let invalidated = $.invalidations;
  await h.hook('classic.SubagentStop')($, { ...start, hook_event_name: 'SubagentStop' }, counting({}));
  await settle();
  invalidated = $.invalidations - invalidated;
  lines = linesOf(await render($, paneEvent({ bodyColumns: 200 }), counting(null)));
  assert.ok(!lines.some((l) => l.startsWith('cad-reviewer')), lines.join('\n'));
  assert.ok(lines.includes('No Cadence agents running'));
  assert.equal(invalidated, 1, 'only the stop\'s own redraw: no fetch settled in between');
  assert.ok(reads >= 1);
});
