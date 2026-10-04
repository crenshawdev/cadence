// Tests for lib/pane.mjs and the pane's handlers in hooks/cadence-mod.mjs.
// Run: node --test cadence-core/bin/pane.test.mjs
//
// The handler cases drive the module with a stand-in `$`, the way
// band.test.mjs does: the host draws nothing headless.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NO_CURSOR_NEXT, NO_PROJECT_TEXT, paneLines, READING_LINE } from './lib/pane.mjs';
import { parseCursor } from './lib/state-cursor.mjs';
import { register } from '../../hooks/cadence-mod.mjs';

const BIN = dirname(fileURLToPath(import.meta.url));
const STATE = '# State\n\nPhase: 1 of 2 (Fixture)\nStatus: planned\nNext: /cad-execute 1\nUpdated: 2026-10-04\n';

/** One snapshot, every section filled the way a good fetch leaves it. */
const snap = (/** @type {any} */ extra = {}) => ({ cursor: parseCursor(STATE), ...extra });

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
    session: { cwd: async () => cwd, id: async () => 'session-1' },
    agent: { list: async () => [] },
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
