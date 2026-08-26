// @ts-check
// hook-events.test.mjs - the rule behind self-verify check 25, driven directly.
// The CLI arms live in self-verify.test.mjs; these are the ones about the RULE:
// which spellings pass, which direction it checks, and what it does with a file
// it cannot read.
'use strict';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hookEventIssues, HOOK_EVENTS, CODES, HOOKS_FILE } from './lib/hook-events.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** A root carrying `hooks/hooks.json` with `text`, and a plugin manifest if asked. */
function root(text, { full = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'cad-hookevents-'));
  if (full) {
    mkdirSync(join(dir, '.claude-plugin'), { recursive: true });
    writeFileSync(join(dir, '.claude-plugin', 'plugin.json'), '{}');
  }
  if (text !== null) {
    mkdirSync(join(dir, 'hooks'), { recursive: true });
    writeFileSync(join(dir, 'hooks', 'hooks.json'), text);
  }
  return dir;
}

/** A hooks.json registering exactly `names`. */
const hooks = (...names) => JSON.stringify({
  hooks: Object.fromEntries(names.map((n) => [n, [{ hooks: [{ type: 'command', command: 'node x.mjs' }] }]])),
});

test('every register row states an event name and a reason for it', () => {
  // A bare list of names says which spellings are allowed without saying why
  // any of them is there, and the row is what a reader consults when a check
  // fires. Row shape is fixed here so a fifth field cannot state a rule the
  // table already states somewhere else.
  assert.ok(HOOK_EVENTS.length >= 1);
  for (const row of HOOK_EVENTS) {
    assert.deepEqual(Object.keys(row).sort(), ['event', 'why']);
    assert.equal(typeof row.event, 'string');
    assert.ok(row.event.length > 0);
    assert.ok(row.why.length > 20, `${row.event}: a reason this short is a label`);
  }
  assert.equal(new Set(HOOK_EVENTS.map((r) => r.event)).size, HOOK_EVENTS.length,
    'a duplicate row makes the register two statements of one thing');
});

test('the shipped register covers the shipped hooks.json - the tree agrees with itself', () => {
  assert.deepEqual(hookEventIssues(REPO), []);
});

test('an unregistered event is reported by name; the registered ones beside it are not', () => {
  const issues = hookEventIssues(root(hooks('PreToolUse', 'SubagentStopped', 'PostToolUse')));
  assert.equal(issues.length, 1, JSON.stringify(issues));
  assert.equal(issues[0].kind, CODES.unregistered);
  assert.equal(issues[0].file, HOOKS_FILE);
  assert.match(issues[0].detail, /`SubagentStopped`/);
});

test('SubagentStop is registered TODAY, so a rename of it is what the check catches', () => {
  // The row this phase adds. Its absence would leave the trace bracket's close
  // half unwatched, which is the failure this check was built for.
  assert.ok(HOOK_EVENTS.some((r) => r.event === 'SubagentStop'));
  assert.deepEqual(hookEventIssues(root(hooks('SubagentStop'))), []);
  const renamed = hookEventIssues(root(hooks('SubagentStop2')));
  assert.equal(renamed.length, 1);
  assert.match(renamed[0].detail, /SubagentStop2/);
});

test('ONE DIRECTION: a register row no hooks.json carries is not a problem', () => {
  // Removing a hook is an ordinary edit. Reporting it would make the register a
  // second place that has to be edited to DELETE something, which is not what
  // it is for.
  assert.deepEqual(hookEventIssues(root(hooks('PreToolUse'))), []);
  assert.deepEqual(hookEventIssues(root(JSON.stringify({ hooks: {} }))), []);
});

test('the register is a PARAMETER, so a test never asserts it against itself', () => {
  const rows = [{ event: 'Synthetic', why: 'a row that exists nowhere in the shipped register' }];
  assert.deepEqual(hookEventIssues(root(hooks('Synthetic')), rows), []);
  const issues = hookEventIssues(root(hooks('PreToolUse')), rows);
  assert.equal(issues.length, 1);
  assert.match(issues[0].detail, /`PreToolUse`/);
  // The detail names what WAS declared, so a reader of the failure can see the
  // register it was measured against without opening the module.
  assert.match(issues[0].detail, /Synthetic/);
});

test('an absent file is lenient on a partial root and missing-input on a full install', () => {
  assert.deepEqual(hookEventIssues(root(null)), []);
  const full = hookEventIssues(root(null, { full: true }));
  assert.equal(full.length, 1);
  assert.equal(full[0].kind, CODES.missing);
  assert.equal(full[0].file, HOOKS_FILE);
});

test('an unreadable or shapeless file is ONE issue, never a throw', () => {
  for (const text of ['{ "hooks": ', 'not json at all', '[]', 'null', '{"hooks": []}', '{"hooks": "x"}', '{}']) {
    const issues = hookEventIssues(root(text));
    assert.equal(issues.length, 1, `${text}: ${JSON.stringify(issues)}`);
    assert.equal(issues[0].kind, CODES.unreadable);
    assert.equal(issues[0].file, HOOKS_FILE, text);
  }
});
