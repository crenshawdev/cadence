// @ts-check
// pane-view.test.mjs - the pane as styled rows (lib/pane-view.mjs).
'use strict';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_METER, MAIN, meterStep } from './lib/cache-meter.mjs';
import { paneView } from './lib/pane-view.mjs';
import { NO_CURSOR_NEXT, READING_LINE, sightStart } from './lib/pane.mjs';
import { SPEND_EXCLUDES } from './lib/trace-suggest.mjs';

/** Phase 3 of 5, executed, three plans with PLAN-3.md outstanding. */
const STATUS = Object.freeze({ ok: true, current: 3, total: 5, cursor: { agrees: true, phase: 3, status: 'executed' },
  outstanding: [{ phase: 3, plans: ['PLAN-3.md'] }],
  phases: [{ n: 3, name: 'Cadence status band', status: 'executed', plans: ['PLAN-1.md', 'PLAN-2.md', 'PLAN-3.md'] }] });

/** A snapshot every section of which read cleanly; `status` overrides merge into STATUS. */
const snap = (/** @type {any} */ status = {}, /** @type {any} */ extra = {}) => ({
  cursor: { next: '/cad-verify 3' }, status: { ok: true, value: { ...STATUS, ...status } },
  captures: { ok: true, value: { ok: true, exists: true, substantive: 2 } },
  spend: { ok: true, value: { ok: true, roles: { executor: { tokens: 500000, unrecorded: 1 }, reviewer: { tokens: 41411 } } } },
  resolves: [], sessionModel: null, ...extra });

const text = (/** @type {any[]} */ row) => row.map((s) => s.text).join('');
const cells = (/** @type {any[]} */ row) => Array.from(text(row)).length;
/** The row whose first segment is the bold section head `label`. */
const section = (/** @type {any[][]} */ rows, /** @type {string} */ label) =>
  rows.find((r) => r[0] && r[0].bold === true && r[0].text.trim() === label);
const filled = (/** @type {any[]} */ row) => row.filter((s) => /^█+$/.test(s.text)).map((s) => s.text.length).reduce((a, b) => a + b, 0);
const empty = (/** @type {any[]} */ row) => row.filter((s) => /^░+$/.test(s.text)).map((s) => s.text.length).reduce((a, b) => a + b, 0);

test('no snapshot shows the reading line alone, dim', () => {
  assert.deepEqual(paneView(null, 80), [[{ text: READING_LINE, dim: true }]]);
});

test('2 of 3 plans: the bar, the count, green ticked boxes and a yellow empty one', () => {
  const rows = paneView(snap(), 80);
  const plans = section(rows, 'PLANS');
  assert.ok(plans);
  assert.equal(plans[0].text.length, 11, 'a fixed label column');
  const bar = filled(plans) + empty(plans);
  assert.equal(bar, 16, 'a fifth of 80');
  assert.equal(filled(plans), Math.round((2 / 3) * bar));
  assert.equal(plans.find((s) => /█/.test(s.text)).color, 'green');
  assert.equal(plans.find((s) => /░/.test(s.text)).dim, true);
  assert.match(text(plans), /2 of 3$/);
  const at = rows.indexOf(plans);
  const [one, two, three] = rows.slice(at + 1, at + 4);
  for (const [row, file] of [[one, 'PLAN-1.md'], [two, 'PLAN-2.md']]) {
    assert.equal(text(row), `  ☑ ${file}`);
    assert.equal(row.find((s) => s.text === '☑').color, 'green');
    assert.equal(row.at(-1).dim, true, 'a done plan reads dim');
  }
  assert.equal(text(three), '  ☐ PLAN-3.md');
  assert.equal(three.find((s) => s.text === '☐').color, 'yellow');
  assert.equal(three.at(-1).dim, undefined, 'the open plan does not');
});

test('the heading, then the phase status as a chip beside the next command', () => {
  const rows = paneView(snap(), 80);
  assert.equal(text(rows[0]), 'Phase 3 of 5  Cadence status band');
  assert.deepEqual([rows[0][0].color, rows[0][0].bold], ['cyan', true]);
  assert.equal(rows[0].at(-1).bold, true);
  assert.equal(text(rows[1]), ' executed   next /cad-verify 3');
  assert.deepEqual(rows[1][0], { text: ' executed ', color: 'black', bg: 'magenta', bold: true });
  assert.deepEqual(rows[1].at(-1), { text: '/cad-verify 3', action: 'next' });
  const none = paneView(snap({}, { cursor: null }), 80);
  assert.ok(none.some((r) => text(r).endsWith(NO_CURSOR_NEXT)));
  assert.ok(none.flat().every((seg) => seg.action === undefined), 'no cursor, nothing to press');
});

test('each status word picks its chip colour, an unknown one white', () => {
  const chipOf = (/** @type {string} */ status) =>
    paneView(snap({ phases: [{ ...STATUS.phases[0], status }] }), 80)[1][0];
  for (const [status, bg] of [['unplanned', 'gray'], ['context gathered', 'blue'], ['planned', 'cyan'],
    ['executing', 'yellow'], ['executed', 'magenta'], ['verified', 'green'], ['complete', 'green'], ['odd', 'white']]) {
    assert.equal(chipOf(status).bg, bg, status);
  }
});

test('a planned phase with an executor running chips as executing, in yellow', () => {
  const planned = snap({ phases: [{ ...STATUS.phases[0], status: 'planned' }] });
  const executor = [{ id: 'a1', role: 'cad-executor', rung: 'xhigh' }];
  assert.deepEqual(paneView(planned, 80, executor)[1][0], { text: ' executing ', color: 'black', bg: 'yellow', bold: true });
  assert.equal(paneView(planned, 80)[1][0].text, ' planned ', 'nothing running');
  assert.equal(paneView(snap(), 80, executor)[1][0].text, ' executed ', 'only a planned phase');
});

test('a dim rule as wide as the pane closes the heading and the plans', () => {
  const rows = paneView(snap(), 60);
  const rules = rows.filter((r) => r.length === 1 && /^─+$/.test(r[0].text));
  assert.equal(rules.length, 2);
  for (const rule of rules) assert.deepEqual(rule[0], { text: '─'.repeat(60), dim: true });
  assert.ok(rows.every((r) => text(r).trim() !== ''), 'no blank spacer rows');
});

test('UAT with fails: pass green, fail red, a pass-of-total bar; zero counts left out', () => {
  const uat = { pass: 6, fail: 1, pending: 0, skipped: 0, blocked: 0 };
  const rows = paneView(snap({ phases: [{ ...STATUS.phases[0], uat }] }), 50);
  const row = section(rows, 'UAT');
  assert.ok(row);
  const bar = filled(row) + empty(row);
  assert.equal(bar, 10);
  assert.equal(filled(row), Math.round((6 / 7) * bar));
  assert.equal(row.find((s) => s.text === '6 pass').color, 'green');
  assert.equal(row.find((s) => s.text === '1 fail').color, 'red');
  assert.ok(!/pending|skipped|blocked/.test(text(row)));

  const later = section(paneView(snap({ phases: [{ ...STATUS.phases[0], uat: { ...uat, pending: 2, blocked: 1 } }] }), 80), 'UAT');
  assert.equal(later.find((s) => s.text === '2 pending').color, 'yellow');
  assert.equal(later.find((s) => s.text === '1 blocked').color, 'red');
});

test('no uat key: no UAT row and no bar but the plans\'', () => {
  const rows = paneView(snap(), 80);
  assert.equal(section(rows, 'UAT'), undefined);
  assert.equal(rows.filter((r) => filled(r) + empty(r) > 0).length, 1);
  const zero = section(paneView(snap({ phases: [{ ...STATUS.phases[0],
    uat: { pass: 0, fail: 0, pending: 0, skipped: 0, blocked: 0 } }] }), 80), 'UAT');
  assert.equal(filled(zero) + empty(zero), 0, 'a total of 0 draws no bar');
});

test('no agents running says so, dim', () => {
  const row = section(paneView(snap(), 80), 'AGENTS');
  assert.equal(text(row).trim().replace(/\s+/g, ' '), 'AGENTS No Cadence agents running');
  assert.equal(row[1].dim, true);
});

test('a running agent: a cyan dot, then its role, rung and model', () => {
  const T0 = Date.parse('2026-10-04T12:00:00.000Z');
  const resolves = [{ family: 'routing', event: 'resolve', agent: 'cad-reviewer-high', role: 'cad-reviewer',
    effort: 'high', model: 'opus', ts: new Date(T0 - 1000).toISOString() }];
  const roster = [{ id: 'a1', role: 'cad-reviewer', rung: 'high' }, { id: 'a2', role: 'cad-executor', rung: 'low' }];
  const sights = sightStart([], 'a1', 'cadence:cad-reviewer-high', T0);
  const rows = paneView(snap({}, { resolves }), 80, roster, sights);
  const first = section(rows, 'AGENTS');
  assert.equal(first.find((s) => s.text === '●').color, 'cyan');
  assert.match(text(first), /● cad-reviewer · rung high · opus$/);
  const second = rows[rows.indexOf(first) + 1];
  assert.equal(second[0].text, ' '.repeat(11), 'a second agent lines up under the first');
  assert.match(text(second), /● cad-executor · rung low · unrecorded$/);
});

test('a cursor that disagrees gets a yellow line naming its phase', () => {
  const rows = paneView(snap({ cursor: { agrees: false, phase: 2, status: 'planned' } }), 80);
  const drift = rows.find((r) => text(r) === '⚠ Cursor says phase 2 · planned');
  assert.ok(drift);
  assert.ok(drift.every((seg) => seg.color === 'yellow'));
});

test('a closed milestone: its line, and no plan section', () => {
  const rows = paneView(snap({ current: null, cycle: 'none', phases: [] }, { spend: null }), 80);
  assert.equal(text(rows[0]), 'No active phase · the milestone is closed');
  assert.equal(text(rows[1]), 'next /cad-verify 3');
  assert.equal(section(rows, 'PLANS'), undefined);
  assert.equal(section(rows, 'SPEND'), undefined, 'no phase, no spend');
});

test('captures and spend: the open count, the grouped total, unrecorded and the caveat dim', () => {
  const rows = paneView(snap(), 120);
  assert.match(text(section(rows, 'CAPTURES')), /2 open$/);
  const spend = section(rows, 'SPEND');
  assert.match(text(spend), /541,411 tokens · 1 unrecorded$/);
  assert.equal(spend.at(-1).dim, true);
  const caveat = rows[rows.indexOf(spend) + 1];
  assert.equal(text(caveat).trim(), `Excludes ${SPEND_EXCLUDES.join(', ')}`);
  assert.equal(caveat.at(-1).dim, true);
});

test('at 40 columns the spend caveat wraps under the label column instead of being cut', () => {
  const rows = paneView(snap(), 40);
  const spend = section(rows, 'SPEND');
  const lines = rows.slice(rows.indexOf(spend) + 1, rows.indexOf(section(rows, 'CACHE')));
  assert.ok(lines.length >= 2);
  for (const line of lines) {
    assert.equal(line[0].text, ' '.repeat(11));
    assert.ok(cells(line) <= 40, text(line));
    assert.ok(!text(line).endsWith('…'), text(line));
  }
  assert.equal(lines.map((l) => text(l).trim()).join(' '), `Excludes ${SPEND_EXCLUDES.join(', ')}`);
});

test('a failed source reads as unavailable, in red, naming its reason', () => {
  const rows = paneView(snap({}, { captures: { ok: false, reason: 'run-failed' },
    spend: { ok: false, reason: 'refused', hint: 'try again' } }), 120);
  const captures = section(rows, 'CAPTURES');
  assert.equal(captures.at(-1).text, 'unavailable · run-failed');
  assert.equal(captures.at(-1).color, 'red');
  assert.equal(section(rows, 'SPEND').at(-1).text, 'unavailable · refused · try again');
  const phase = paneView({ ...snap(), status: { ok: false, reason: 'no-roadmap' } }, 120);
  assert.equal(text(phase[0]), 'Phase unavailable · no-roadmap');
  assert.equal(phase[0][0].color, 'red');
});

// --- the cache meter -----------------------------------------------------------

/** One request's usage: cache read, cache write, 2 fresh. */
const usage = (/** @type {number} */ read, /** @type {number} */ write) =>
  ({ cache_read_input_tokens: read, cache_creation_input_tokens: write, input_tokens: 2, output_tokens: 9 });

/** Main reads all back once, then breaks losing 38,500; agent a1 breaks once; agent a9 breaks and stops. */
function brokenMeter() {
  let m = meterStep(EMPTY_METER, MAIN, 'opus', 3, usage(0, 40000));
  m = meterStep(m, MAIN, 'opus', 5, usage(40000, 1000));
  m = meterStep(m, MAIN, 'opus', 7, usage(2500, 39000));
  m = meterStep(m, 'a1', 'opus', 1, usage(0, 9000));
  m = meterStep(m, 'a1', 'opus', 3, usage(1000, 9000));
  m = meterStep(m, 'a9', 'opus', 1, usage(0, 9000));
  m = meterStep(m, 'a9', 'opus', 3, usage(0, 9000));
  return m;
}

test('before any request the CACHE row says so, dim, and nothing else', () => {
  const rows = paneView(snap(), 120);
  const cache = section(rows, 'CACHE');
  assert.equal(text(cache).trim().replace(/\s+/g, ' '), 'CACHE no request yet this session');
  assert.equal(cache[1].dim, true);
  assert.equal(rows.at(-1), cache);
});

test('the CACHE row: main\'s rate and last rate, its breaks in yellow, the agents\' breaks, then whose figures they are', () => {
  const rows = paneView(snap(), 120, [], [], brokenMeter());
  const cache = section(rows, 'CACHE');
  assert.equal(rows.indexOf(cache), rows.indexOf(section(rows, 'SPEND')) + 2, 'after the spend and its caveat');
  assert.equal(text(cache).replace(/^CACHE\s+/, ''),
    'main 34.7% (last 6.0%) · 1 cache break, last 38.5k lost · 2 in agents');
  assert.ok(cache.filter((seg) => /break|agents/.test(seg.text)).every((seg) => seg.color === 'yellow'));
  const caveat = rows[rows.indexOf(cache) + 1];
  assert.equal(text(caveat).trim(), 'This session, live: not part of the phase\'s spend');
  assert.equal(caveat.at(-1).dim, true);
});

test('no breaks: the CACHE row carries the rates alone', () => {
  let m = meterStep(EMPTY_METER, MAIN, 'opus', 3, usage(0, 40000));
  m = meterStep(m, MAIN, 'opus', 5, usage(40000, 1000));
  assert.equal(text(section(paneView(snap(), 120, [], [], m), 'CACHE')).replace(/^CACHE\s+/, ''), 'main 49.4% (last 97.6%)');
});

test('a loop\'s first request shows what it wrote, not a rate, in the CACHE row and on its agent\'s row', () => {
  let m = meterStep(EMPTY_METER, MAIN, 'opus', 3, usage(25725, 16588));
  m = meterStep(m, 'a1', 'opus', 1, usage(0, 9000));
  const rows = paneView(snap(), 120, [{ id: 'a1', role: 'cad-executor', rung: 'xhigh' }], [], m);
  assert.equal(text(section(rows, 'CACHE')).replace(/^CACHE\s+/, ''), 'main first request, 16.6k written');
  assert.match(text(section(rows, 'AGENTS')), /● cad-executor · rung xhigh · unrecorded · cache first request, 9\.0k written$/);
  m = meterStep(m, MAIN, 'opus', 5, usage(42313, 982));
  assert.equal(text(section(paneView(snap(), 120, [], [], m), 'CACHE')).replace(/^CACHE\s+/, ''), 'main 79.5% (last 97.7%)');
});

test('a running agent\'s row gains its cache rate, and its breaks in yellow; one with no request gains nothing', () => {
  const roster = [{ id: 'a1', role: 'cad-executor', rung: 'xhigh' }, { id: 'a2', role: 'cad-reviewer', rung: 'low' }];
  const rows = paneView(snap(), 120, roster, [], brokenMeter());
  const first = section(rows, 'AGENTS');
  assert.match(text(first), /● cad-executor · rung xhigh · unrecorded · cache 5\.3% · 1 cache break$/);
  assert.equal(first.at(-1).color, 'yellow');
  assert.match(text(rows[rows.indexOf(first) + 1]), /● cad-reviewer · rung low · unrecorded$/);
});

test('40 and 120 columns: the bar scales and no row runs past the width', () => {
  const uat = { pass: 3, fail: 1, pending: 1, skipped: 0, blocked: 0 };
  const s = snap({ phases: [{ ...STATUS.phases[0], uat }] });
  const narrow = section(paneView(s, 40), 'PLANS');
  const wide = section(paneView(s, 120), 'PLANS');
  assert.equal(filled(narrow) + empty(narrow), 10);
  assert.equal(filled(wide) + empty(wide), 24);
  const long = { ...s, cursor: { next: `/cad-execute 3 ${'x'.repeat(200)} 😀😀` } };
  const roster = [{ id: 'a1', role: 'cad-executor', rung: 'xhigh' }];
  for (const each of [null, s, long]) {
    for (let width = 0; width <= 160; width++) {
      for (const row of paneView(each, width)) assert.ok(cells(row) <= width, `${width}: ${text(row)}`);
      for (const row of paneView(each, width, roster, [], brokenMeter())) assert.ok(cells(row) <= width, `${width}: ${text(row)}`);
    }
  }
  const cut = paneView(long, 40)[1];
  assert.equal(cells(cut), 40);
  assert.ok(text(cut).endsWith('…'));
});

test('an escape sequence anywhere in the data reaches no segment', () => {
  const hostile = snap({ phases: [{ n: 3, name: 'Band\x1b[2J', status: 'exec\x07uted', plans: ['PLAN-\x1b1.md', 'PLAN-2.md'],
    uat: { pass: 1, fail: '\x1b[31m', pending: 0, skipped: 0, blocked: 0 } }],
  cursor: { agrees: false, phase: '\x9b2', status: 'x\ny' } }, {
    cursor: { next: '/cad-verify 3\x1b[2J\x07' },
    captures: { ok: false, reason: 'bad\x00reason', hint: '\r\n' } });
  const roster = [{ id: 'a1', role: 'cad-\x1breviewer', rung: '\x7f' }];
  const rows = paneView(hostile, 200, roster, []);
  assert.ok(rows.some((r) => text(r).endsWith('next /cad-verify 3?[2J?')));
  for (const row of rows) {
    for (const seg of row) assert.doesNotMatch(seg.text, /[\x00-\x1f\x7f-\x9f]/, JSON.stringify(seg));
  }
});
