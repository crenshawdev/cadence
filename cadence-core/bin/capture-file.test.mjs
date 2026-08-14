// Zero-dep tests for lib/capture-file.mjs - the ONE owner of CAPTURE.md file
// I/O. Run: node --test cadence-core/bin/capture-file.test.mjs
// Only node: builtins, per the repo's zero-dep ethos.
//
// The rows here are the WRITE side of the recall walk. What they pin is not
// "a bullet was written" but "a bullet was written where `parseCaptureSnippets`
// in lib/planning-files.mjs will find it" - the walk-membership round trip
// itself lives in planning.test.mjs, where a real `recall` can run against it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, utimesSync, chmodSync, accessSync, constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { appendCapture, CAPTURE_HEADINGS, CAPTURE_KINDS } from './lib/capture-file.mjs';

const execFileP = promisify(execFile);

const PLANNING = join(dirname(fileURLToPath(import.meta.url)), 'planning.mjs');

/** A temp CAPTURE.md path; `body` written when given, absent otherwise. */
function fixture(body) {
  const file = join(mkdtempSync(join(tmpdir(), 'cad-capture-')), 'CAPTURE.md');
  if (body !== undefined) writeFileSync(file, body);
  return file;
}

const readBack = (file) => readFileSync(file, 'utf8');

/** True when mode 000 still reads - i.e. the suite is running as root. */
function accessibleAsRoot(file) {
  try { accessSync(file, constants.R_OK); return true; } catch { return false; }
}

/**
 * The body of one `## Heading` section, cut at the next `## ` - a deliberately
 * naive reader, so a row asserting "under this heading and no other" is not
 * asserting through the same code the writer used.
 */
function section(text, heading) {
  const parts = text.split(new RegExp(`^${heading}\\s*$`, 'm'));
  return parts.length < 2 ? null : parts[1].split(/^## /m)[0];
}

/** Assert `bullet` sits under `kind`'s heading and under neither other one. */
function onlyUnder(text, kind, bullet) {
  for (const k of CAPTURE_KINDS) {
    const body = section(text, CAPTURE_HEADINGS[k]);
    assert.notEqual(body, null, `${CAPTURE_HEADINGS[k]} must exist`);
    if (k === kind) assert.ok(body.includes(bullet), `${bullet} missing from ${CAPTURE_HEADINGS[k]}`);
    else assert.ok(!body.includes(bullet), `${bullet} leaked into ${CAPTURE_HEADINGS[k]}`);
  }
}

const THREE = '## Todos\n\n- None.\n\n## Seeds\n\n- None.\n\n## Notes\n\n- None.\n';

// ---------------------------------------------------------------------------
// One row per kind: the heading is a fact of the module, not of the caller.
// ---------------------------------------------------------------------------

test('appendCapture: a todo lands under ## Todos and under no other heading', () => {
  const file = fixture(THREE);
  const r = appendCapture(file, 'todo', 'quarantine the flaky fixture', '2');
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.bullet, '- [ ] (phase 2) quarantine the flaky fixture');
  assert.equal(r.heading, '## Todos');
  onlyUnder(readBack(file), 'todo', r.bullet);
});

test('appendCapture: an unphased todo carries a checkbox and no tag', () => {
  const file = fixture(THREE);
  const r = appendCapture(file, 'todo', 'no cursor to read');
  assert.equal(r.bullet, '- [ ] no cursor to read');
  onlyUnder(readBack(file), 'todo', r.bullet);
});

test('appendCapture: a seed lands under ## Seeds as a bare bullet', () => {
  const file = fixture(THREE);
  const r = appendCapture(file, 'seed', 'a scanner that reads any language');
  assert.equal(r.bullet, '- a scanner that reads any language');
  onlyUnder(readBack(file), 'seed', r.bullet);
});

test('appendCapture: a note lands under ## Notes, dated by the seam', () => {
  const file = fixture(THREE);
  const r = appendCapture(file, 'note', 'the queue lost five bullets');
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(r.bullet, `- ${today} the queue lost five bullets`);
  onlyUnder(readBack(file), 'note', r.bullet);
});

test('appendCapture: the phase tag keeps the caller\'s own spelling', () => {
  // `requirePhaseArg` hands the raw string precisely so `1.10` is not
  // normalized to `1.1` - a different phase's directory and a different tag.
  const file = fixture(THREE);
  assert.equal(appendCapture(fixture(THREE), 'todo', 'x', '1.10').bullet, '- [ ] (phase 1.10) x');
  assert.equal(appendCapture(file, 'todo', 'y', '08').bullet, '- [ ] (phase 08) y');
});

test('appendCapture: a kind outside the map is refused, never written somewhere', () => {
  const file = fixture(THREE);
  const r = appendCapture(file, 'idea', 'not a kind');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-kind');
  assert.equal(readBack(file), THREE, 'the file must be byte-identical');
});

// ---------------------------------------------------------------------------
// Where the bullet lands inside the file.
// ---------------------------------------------------------------------------

test('appendCapture: an ABSENT file is created with the three headings', () => {
  const file = fixture();
  assert.equal(existsSync(file), false);
  const r = appendCapture(file, 'seed', 'first thing ever filed');
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.created, true);
  const body = readBack(file);
  for (const h of Object.values(CAPTURE_HEADINGS)) assert.match(body, new RegExp(`^${h}$`, 'm'));
  onlyUnder(body, 'seed', r.bullet);
});

test('appendCapture: a missing PARENT directory is created (the --cadence queue)', () => {
  // `/cad-capture --cadence` writes `~/.claude/cadence/CAPTURE.md`, a directory
  // that need not exist yet, and `atomicWrite` renames a SIBLING temp into place.
  const file = join(mkdtempSync(join(tmpdir(), 'cad-capture-')), 'nested', 'deep', 'CAPTURE.md');
  const r = appendCapture(file, 'note', 'friction with cadence itself');
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(readBack(file).includes(r.bullet));
});

test('appendCapture: the target section being LAST pins the end at EOF', () => {
  const file = fixture('## Todos\n\n- [ ] one\n\n## Seeds\n\n- a seed\n\n## Notes\n\n- 2026-01-01 a note\n');
  const r = appendCapture(file, 'note', 'the last section');
  const body = readBack(file);
  onlyUnder(body, 'note', r.bullet);
  // Directly after the section's own last bullet, not after a trailing gap.
  assert.match(body, /- 2026-01-01 a note\n- \d{4}-\d\d-\d\d the last section\n/);
});

test('appendCapture: a target section FOLLOWED by others keeps the boundary', () => {
  const file = fixture('## Todos\n\n- [ ] one\n\n## Seeds\n\n- a seed\n\n## Notes\n\n- 2026-01-01 a note\n');
  const r = appendCapture(file, 'todo', 'the first section', '3');
  const body = readBack(file);
  onlyUnder(body, 'todo', r.bullet);
  // The blank line separating Todos from Seeds survives - the bullet joined the
  // list, it did not land in the gap or past the next heading.
  assert.match(body, /- \[ \] one\n- \[ \] \(phase 3\) the first section\n\n## Seeds\n/);
});

test('appendCapture: an EMPTY section still gets its blank line after the heading', () => {
  const file = fixture('## Todos\n\n## Seeds\n\n- a seed\n\n## Notes\n');
  const r = appendCapture(file, 'todo', 'into an empty section');
  assert.match(readBack(file), /## Todos\n\n- \[ \] into an empty section\n\n## Seeds\n/);
  onlyUnder(readBack(file), 'todo', r.bullet);
});

test('appendCapture: a heading ABSENT from the file is created WITH the bullet', () => {
  // Never an EOF append under whatever heading happens to be last (D-09): the
  // heading is written too, so the bullet is inside the walk either way.
  const file = fixture('## Todos\n\n- [ ] one\n\n## Debt markers\n\n- None.\n');
  const r = appendCapture(file, 'seed', 'a queue with no Seeds section');
  const body = readBack(file);
  assert.match(body, /## Seeds\n\n- a queue with no Seeds section\n/);
  assert.ok(section(body, '## Seeds').includes(r.bullet));
  assert.ok(!section(body, '## Debt markers').includes(r.bullet), 'must not land in Debt markers');
});

test('appendCapture: a FENCED ## line in an earlier section is not the boundary', () => {
  // The destructive half of the bug `sectionSpan` exists to close: a fenced
  // EXAMPLE of a heading read as the real one puts the write inside somebody's
  // code block, and the scan that resumes there reads the CLOSING fence as an
  // opener and swallows every heading after it.
  const file = fixture('## Todos\n\n- [ ] the format is:\n\n  ```md\n  ## Seeds\n  - an example\n  ```\n\n'
    + '- [ ] the real last todo\n\n## Seeds\n\n- a real seed\n\n## Notes\n\n- None.\n');
  const todo = appendCapture(file, 'todo', 'after the fence', '1');
  const seed = appendCapture(file, 'seed', 'under the real heading');
  const body = readBack(file);
  // The fence survived intact and stayed balanced.
  assert.equal((body.match(/```/g) || []).length, 2, 'fence count must stay even');
  assert.match(body, /- an example/);
  // The todo went after the section's real last bullet, past the fence.
  assert.match(body, /- \[ \] the real last todo\n- \[ \] \(phase 1\) after the fence\n\n## Seeds\n/);
  // The seed went under the REAL `## Seeds`, not the fenced one.
  assert.match(body, /- a real seed\n- under the real heading\n/);
  assert.ok(!section(body, '## Todos').includes(seed.bullet), 'the seed must not land in Todos');
  assert.ok(section(body, '## Seeds').includes(seed.bullet));
  assert.equal(todo.heading, '## Todos');
});

test('appendCapture: an existing `- None.` placeholder is left alone', () => {
  const file = fixture(THREE);
  appendCapture(file, 'todo', 'the first real item');
  assert.equal((readBack(file).match(/- None\./g) || []).length, 3);
});

// ---------------------------------------------------------------------------
// The subcommand's flag contract - the four refusals, each proved to write
// nothing. Run through the CLI, because that is where the parsing lives.
// ---------------------------------------------------------------------------

/** Run `planning.mjs capture ...`; parse the one JSON line whatever the code. */
function capture(args) {
  try {
    return JSON.parse(execFileSync('node', [PLANNING, 'capture', ...args], { encoding: 'utf8' }));
  } catch (e) {
    return JSON.parse(e.stdout);
  }
}

test('capture: --kind outside the three words is bad-args and writes nothing', () => {
  const file = fixture(THREE);
  const r = capture(['--kind', 'idea', '--text', 'x', '--file', file]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-args');
  assert.equal(readBack(file), THREE);
});

test('capture: a VALUELESS --text is bad-args, never the literal word "true"', () => {
  // parseArgs hands a flag with nothing after it the boolean `true`; written
  // through, the user's sentence is gone under an ok:true envelope (#42/#45).
  const file = fixture(THREE);
  const r = capture(['--kind', 'todo', '--text', '--file', file]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-args');
  assert.equal(readBack(file), THREE);
  assert.ok(!readBack(file).includes('true'));
});

test('capture: --phase with a seed or a note is bad-args, not a dropped flag', () => {
  // Dropping it silently leaves the caller believing it tagged something.
  for (const kind of ['seed', 'note']) {
    const file = fixture(THREE);
    const r = capture(['--kind', kind, '--text', 'x', '--phase', '2', '--file', file]);
    assert.equal(r.ok, false, `${kind}: ${JSON.stringify(r)}`);
    assert.equal(r.reason, 'bad-args');
    assert.equal(readBack(file), THREE);
  }
});

test('capture: a VALUELESS --file is bad-args, never silently the --dir default', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cad-capture-'));
  const r = capture(['--kind', 'todo', '--text', 'x', '--file', '--dir', dir]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-args');
  assert.equal(existsSync(join(dir, 'CAPTURE.md')), false);
});

test('capture: a --phase that is not a phase number is bad-args', () => {
  const file = fixture(THREE);
  const r = capture(['--kind', 'todo', '--text', 'x', '--phase', 'two', '--file', file]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-args');
  assert.equal(readBack(file), THREE);
});

test('capture: --file writes THAT path and leaves the --dir queue untouched', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cad-capture-'));
  const elsewhere = join(mkdtempSync(join(tmpdir(), 'cad-capture-')), 'global', 'CAPTURE.md');
  const r = capture(['--kind', 'note', '--text', 'friction with cadence', '--file', elsewhere, '--dir', dir]);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(readBack(elsewhere).includes('friction with cadence'));
  assert.equal(existsSync(join(dir, 'CAPTURE.md')), false);
});

// ---------------------------------------------------------------------------
// The concurrent-append guard (AC5). `atomicWrite` alone is crash-safety, not
// mutual exclusion: two writers read the same bytes and the second rename
// erases the first one's bullet. These three rows are what say otherwise.
// ---------------------------------------------------------------------------

const WRITERS = 20;

test('capture: twenty concurrent writers all land, not one bullet lost (AC5)', async () => {
  const file = fixture(THREE);
  const runs = Array.from({ length: WRITERS }, (_, i) => execFileP('node',
    [PLANNING, 'capture', '--kind', 'todo', '--text', `racer-${i}`, '--file', file]));
  for (const r of await Promise.all(runs)) {
    assert.equal(JSON.parse(r.stdout).ok, true, r.stdout);
  }
  const body = readBack(file);
  // Anchored at BOTH ends, so `racer-1` cannot be satisfied by `racer-10`.
  for (let i = 0; i < WRITERS; i++) {
    assert.match(body, new RegExp(`^- \\[ \\] racer-${i}$`, 'm'), `racer-${i} lost`);
  }
  assert.equal((body.match(/^- \[ \] racer-\d+$/gm) || []).length, WRITERS);
  // Under ## Todos and nowhere else, and the file is still well-formed.
  assert.equal((section(body, '## Todos').match(/^- \[ \] racer-\d+$/gm) || []).length, WRITERS);
  assert.equal((body.match(/^## /gm) || []).length, 3);
});

test('capture: a HELD lock refuses non-silently and leaves the file byte-identical (AC5)', () => {
  const file = fixture(THREE);
  writeFileSync(`${file}.lock`, ''); // a fresh mtime: a live writer holds it
  const r = capture(['--kind', 'todo', '--text', 'the loser', '--file', file]);
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.reason, 'capture-locked');
  assert.match(r.detail, /\.lock/, 'the reason must name the lock');
  assert.equal(readBack(file), THREE, 'the file must be byte-identical');
  assert.ok(existsSync(`${file}.lock`), 'a refused writer must not release a lock it never took');
});

test('capture: a STALE lock is broken rather than wedging the queue forever (AC5)', () => {
  const file = fixture(THREE);
  const lock = `${file}.lock`;
  writeFileSync(lock, '');
  // Older than any staleness threshold this seam could sanely carry: the writer
  // that made it is gone, and the queue must not stay shut behind it.
  const longAgo = new Date(Date.now() - 3600_000);
  utimesSync(lock, longAgo, longAgo);
  const r = capture(['--kind', 'todo', '--text', 'after the break', '--file', file]);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(readBack(file).includes('- [ ] after the break'));
  assert.equal(existsSync(lock), false, 'the broken lock is released like any other');
});

test('capture: the lock is released on the SUCCESS path too', () => {
  const file = fixture(THREE);
  assert.equal(capture(['--kind', 'seed', '--text', 'one', '--file', file]).ok, true);
  assert.equal(existsSync(`${file}.lock`), false);
  assert.equal(capture(['--kind', 'seed', '--text', 'two', '--file', file]).ok, true);
});

test('capture: a newline inside --text cannot break the bullet into two lines', () => {
  // A second line that is not a bullet is dropped by the walk in silence -
  // this phase's headline bug arriving through the front door.
  const file = fixture(THREE);
  const r = capture(['--kind', 'seed', '--text', 'first line\n## Notes\nsecond line', '--file', file]);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.bullet, '- first line ## Notes second line');
  assert.equal((readBack(file).match(/^## /gm) || []).length, 3, 'no injected heading');
});

// ---------------------------------------------------------------------------
// The risk_surface findings this phase's blocking gate returned. Each row is
// the failure the reviewer described, run against the real seam - so the fix
// is proved by a test that could redden, not by reading the patch.
// ---------------------------------------------------------------------------

test('appendCapture: an UNREADABLE queue is a failure, never an empty one', () => {
  // The finding: `read()` caught every error and returned null, so a present
  // but unreadable CAPTURE.md was treated as absent and OVERWRITTEN with the
  // empty three-section skeleton - the whole backlog destroyed under ok:true.
  const file = fixture(THREE);
  const before = readBack(file);
  chmodSync(file, 0o000);
  try {
    // Running as root defeats the mode bits; the row would then assert nothing,
    // so it says so rather than passing vacuously.
    if (accessibleAsRoot(file)) return;
    const r = appendCapture(file, 'todo', 'must not destroy the queue');
    assert.equal(r.ok, false, 'an unreadable queue must not report success');
  } finally {
    chmodSync(file, 0o600);
  }
  assert.equal(readBack(file), before, 'the existing queue was overwritten');
});

test('capture: --text-file carries a sentence no shell could expand', () => {
  // The finding: workflows prescribed `--text "<item>"`, so item text holding
  // `$(...)` executed before Node started. The path transport is the fix, and
  // the sentence here is exactly the payload that used to be dangerous.
  const file = fixture(THREE);
  const src = join(dirname(file), 'item.txt');
  const payload = 'guard $(touch /tmp/cad-should-not-exist) and `id` stay literal';
  writeFileSync(src, payload);
  const r = capture(['--kind', 'todo', '--text-file', src, '--file', file]);
  assert.equal(r.ok, true);
  assert.ok(readBack(file).includes(payload), 'the sentence did not land verbatim');
  assert.equal(existsSync('/tmp/cad-should-not-exist'), false, 'the payload executed');
});

test('capture: --text and --text-file together is bad-args, not a silent winner', () => {
  const file = fixture(THREE);
  const src = join(dirname(file), 'item.txt');
  writeFileSync(src, 'from the file');
  const r = capture(['--kind', 'todo', '--text', 'from the flag', '--text-file', src, '--file', file]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-args');
  assert.equal(readBack(file), THREE);
});

test('capture: a --text-file that cannot be read is bad-args and writes nothing', () => {
  const file = fixture(THREE);
  const r = capture(['--kind', 'todo', '--text-file', join(dirname(file), 'absent.txt'), '--file', file]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-args');
  assert.equal(readBack(file), THREE);
});

test('capture: a VALUELESS --text-file is bad-args, never the literal "true"', () => {
  const file = fixture(THREE);
  const r = capture(['--kind', 'todo', '--text-file', '--file', file]);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-args');
  assert.equal(readBack(file), THREE);
});
