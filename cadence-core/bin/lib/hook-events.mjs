// @ts-check
// hook-events.mjs - the pure rule behind self-verify's hook-events check: every
// event name Cadence registers in `hooks/hooks.json` has a register row here
// saying what that event is for.
//
// WHY THIS IS A CHECK AT ALL. A hook is the one Cadence surface the host names
// rather than Cadence: the plugin declares `SubagentStop`, and if that spelling
// ever changes - a host rename, a typo in an edit, a copied block - the host
// registers nothing and every hook this plugin owns simply stops firing. There
// is no error, no refusal and no empty result to notice, because a hook that was
// never registered produces no output of any kind. For the trace bracket that
// means the close half silently stops being written and the record fills with
// `unpaired` rows a reader has to interpret. Nothing else in this tree can see
// that: `hooks/hooks.json` is JSON, so the markdown walk never opens it, the
// path check only proves the SCRIPT exists, and the script exists either way.
//
// WHY THE REGISTER IS HAND-MAINTAINED, and what it buys. Read off `hooks.json`
// alone the check would compare the file to itself and pass on any spelling.
// The register IS the statement of which events this plugin registers - the same
// species of stated table as self-verify's CONTRACTS, lib/rung-agent's
// RUNG_FILES and lib/reference-routers' ROUTERS - and a row is added in the same
// commit that adds a registration. That is what makes a RENAME loud: the new
// name has no row, so the check reports it by name.
//
// ONE DIRECTION ONLY, deliberately. A register row whose event `hooks.json` no
// longer carries is NOT reported: removing a hook is an ordinary edit, and the
// locked criterion is the event-name direction alone. Neither are the command
// PATHS checked here - self-verify check 3 already proves every
// `${CLAUDE_PLUGIN_ROOT}` path resolves on disk.
//
// Pure rule: no emit, no exit, no Date, no randomness, node builtins only, and
// every read guarded so an unreadable or malformed file is ONE reported issue
// rather than an unwound run. It takes no CONTRACTS row and no CLI entry point,
// for the reason self-verify.mjs check 14 states about `lib/*.mjs`: they are
// modules prose never invokes.
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
 * The register: one row per hook event name Cadence registers, and one line on
 * each saying what that event is FOR - a bare list of names would say which
 * spellings are allowed without saying why any of them is there.
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
 * `rows` is a parameter for the reason lib/reference-routers.mjs states about
 * its own: a test must be able to drive a synthetic register without adding a
 * row to the shipped one, which stays at exactly the events this plugin
 * registers. A test asserting against the shipped rows would be asserting the
 * register against itself.
 *
 * @param {string} root repository root
 * @param {ReadonlyArray<{event: string, why: string}>} [rows]
 * @returns {{kind: string, file: string, detail: string}[]}
 */
export function hookEventIssues(root, rows = HOOK_EVENTS) {
  const file = join(root, 'hooks', 'hooks.json');
  if (!existsSync(file)) {
    // An ABSENT file is a partial fixture, not a fault - a `--root` carrying
    // only prose is not an install with its hooks deleted. A FULL install
    // missing it is the second case, and it is the one that means every hook
    // this plugin owns is gone, so it is reported exactly as the other
    // always-expected inputs are. `.claude-plugin/plugin.json` is the same
    // full-tree witness self-verify.mjs uses for INTERNALS.md and
    // weight-budgets.json.
    if (!existsSync(join(root, '.claude-plugin', 'plugin.json'))) return [];
    return [{ kind: CODES.missing, file: HOOKS_FILE, detail: 'always-expected input absent' }];
  }

  let hooks = null;
  try {
    const data = JSON.parse(readFileSync(file, 'utf8'));
    hooks = data && typeof data.hooks === 'object' && !Array.isArray(data.hooks) ? data.hooks : null;
    if (!hooks) {
      // Parsed, but there is no `hooks` object to read event names out of. Told
      // apart from a parse failure by its detail and folded into the same ONE
      // issue on purpose: either way this file registers nothing the host can
      // use, and either way the run must finish reporting everything else.
      return [{ kind: CODES.unreadable, file: HOOKS_FILE, detail: 'no `hooks` object to read event names from' }];
    }
  } catch (e) {
    return [{ kind: CODES.unreadable, file: HOOKS_FILE, detail: (e && (e.code || e.message)) || String(e) }];
  }

  const known = new Set(rows.map((r) => r.event));
  const issues = [];
  for (const event of Object.keys(hooks)) {
    if (known.has(event)) continue;
    // The offending name is in the DETAIL, spelled exactly as the file spells
    // it. A problem that cannot name the event is a number: the whole failure
    // this check exists for is one event name being wrong among the several
    // that are right.
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
