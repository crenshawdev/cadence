// @ts-check
// hook-events.mjs - self-verify's hook-events check: every event hooks.json registers needs a row here
// the host names hooks, not Cadence: if a spelling like SubagentStop changes, it registers nothing and no error says so
// for the trace bracket that means the close half goes unwritten and the record fills with `unpaired` rows
// the register is hand-maintained because read off hooks.json alone, the check would compare the file to itself
// one direction only: a row whose event is gone isn't reported, removing a hook is an ordinary edit
// pure, builtins only, every read guarded. No CONTRACTS row, lib/*.mjs are never invoked from prose
'use strict';

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/** The file, root-relative, in the one spelling every issue reports it under. */
export const HOOKS_FILE = 'hooks/hooks.json';

/** The problem codes this rule files. */
export const CODES = Object.freeze({
  /** `hooks.json` registers an event name no register row holds. */
  unregistered: 'unregistered-hook-event',
  /** The file exists and could not be read, or does not hold a hooks object. */
  unreadable: 'unreadable-surface',
  /** A full install with no `hooks/hooks.json` at all. */
  missing: 'missing-input',
});

/**
 * The register: one row per hook event name Cadence registers, with a line on what each
 * is for. A bare name list would say which spellings are allowed and not why.
 * @type {ReadonlyArray<{event: string, why: string}>}
 */
export const HOOK_EVENTS = Object.freeze([
  Object.freeze({
    event: 'PreToolUse',
    why: 'the git guard: the one moment a destructive or publishing git command '
      + 'can still be refused, before the tool runs',
  }),
  Object.freeze({
    event: 'PostToolUse',
    why: 'the read recorder: what a dispatch OPENED, which is the whole basis of '
      + 'in-dispatch read redundancy',
  }),
  Object.freeze({
    event: 'SubagentStop',
    why: 'the trace bracket\'s close half, written from the HOST side so a '
      + 'bracket survives the session that opened it',
  }),
]);

/**
 * Every event name `hooks/hooks.json` registers that no row declares.
 *
 * rows is a parameter so a test can drive a synthetic register without adding to the shipped
 * one; asserting against the shipped rows would assert the register against itself.
 *
 * @param {string} root repository root
 * @param {ReadonlyArray<{event: string, why: string}>} [rows]
 * @returns {{kind: string, file: string, detail: string}[]}
 */
export function hookEventIssues(root, rows = HOOK_EVENTS) {
  const file = join(root, 'hooks', 'hooks.json');
  if (!existsSync(file)) {
    // an absent file is a partial fixture: a --root with only prose isn't an install with its
    // hooks deleted. A full install missing it means every hook is gone, so it's reported like
    // the other always-expected inputs, with plugin.json as the full-tree witness
    if (!existsSync(join(root, '.claude-plugin', 'plugin.json'))) return [];
    return [{ kind: CODES.missing, file: HOOKS_FILE, detail: 'always-expected input absent' }];
  }

  let hooks = null;
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    hooks = data && typeof data.hooks === 'object' && !Array.isArray(data.hooks) ? data.hooks : null;
    if (!hooks) {
      // parsed but no hooks object: folded into the one unreadable issue like a parse failure, since
      // either way the file registers nothing and the run has to keep reporting the rest
      return [{ kind: CODES.unreadable, file: HOOKS_FILE, detail: 'no `hooks` object to read event names from' }];
    }
  } catch (e) {
    return [{ kind: CODES.unreadable, file: HOOKS_FILE, detail: (e && (e.code || e.message)) || String(e) }];
  }

  const known = new Set(rows.map((r) => r.event));
  const issues = [];
  for (const event of Object.keys(hooks)) {
    if (known.has(event)) continue;
    // the detail spells the event exactly as the file does: the failure is one name wrong
    // among several right ones, and a problem that can't name it is just a number
    issues.push({
      kind: CODES.unregistered,
      file: HOOKS_FILE,
      detail: `\`${event}\` is registered and no lib/hook-events.mjs row declares it`
        + ` (declared: ${[...known].join(', ')}) - the host silently registers nothing`
        + ' for a name it does not know',
    });
  }
  return issues;
}
