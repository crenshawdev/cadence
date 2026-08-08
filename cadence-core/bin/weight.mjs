#!/usr/bin/env node
// @ts-check
// weight.mjs - the context-weight seam. Measures the plugin's OWN surfaces -
// `agents/*.md`, `skills/**/SKILL.md`, `cadence-core/workflows/*.md`, and
// every file under `cadence-core/references/` and `cadence-core/templates/` -
// and reports each one's byte + estimated-token weight as one JSON line.
// Contrast planning.mjs, which is scoped to the
// .planning state files; this script measures the shipped plugin prose itself.
// The measurement lib it imports is the same one self-verify.mjs enforces the
// budget with, so reported and enforced weight cannot diverge.
//
// The `resident` subcommand answers the other question: not what one file
// weighs, but what one COMMAND carries into the main thread and what one
// DISPATCH carries into a fresh subagent context. Definitions, and the reason
// reachable is one hop rather than a closure, live in lib/resident-weight.mjs.
//
// Seam convention: one JSON line on stdout, exit 0. Deterministic: sorted
// traversal + fixed key order make two runs on the same tree byte-identical.
// Usage: weight.mjs [--root <repo root>]
//        weight.mjs resident [--root <repo root>] [--command <name>] [--role <name>]
'use strict';

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emit } from './lib/seam-io.mjs';
import { weighAll } from './lib/surface-weight.mjs';
import { residentWeight } from './lib/resident-weight.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

/** @param {string[]} argv @param {string} flag @returns {string|undefined} */
function flagValue(argv, flag) {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
}

try {
  const argv = process.argv.slice(2);
  const root = flagValue(argv, '--root') || join(HERE, '..', '..');
  if (argv[0] === 'resident') {
    const r = residentWeight(root);
    // Filters narrow the array they name and nothing else: `zeroResident` is
    // derived from EVERY command's reachable set, so a filter must not be able
    // to change it.
    const command = flagValue(argv, '--command');
    const role = flagValue(argv, '--role');
    let { commands, roles } = r;
    if (command !== undefined) {
      commands = commands.filter((c) => c.command === command);
      if (!commands.length) throw { seam: 'unknown-command', detail: command };
    }
    if (role !== undefined) {
      roles = roles.filter((x) => x.role === role);
      if (!roles.length) throw { seam: 'unknown-role', detail: role };
    }
    emit({
      ok: true,
      checked: 'resident-weight',
      commands,
      roles,
      zeroResident: r.zeroResident,
      zeroResidentBytes: r.zeroResidentBytes,
    });
  } else {
    emit({ ok: true, checked: 'surface-weight', surfaces: weighAll(root) });
  }
} catch (e) {
  if (e && e.seam) emit({ ok: false, reason: e.seam, detail: e.detail });
  else emit({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
}
