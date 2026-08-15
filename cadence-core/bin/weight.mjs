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
// A flag PRESENT with no value is `ok:false`/`missing-flag-value`, never a
// silent default - see `flagValue` in lib/seam-input.mjs.
'use strict';

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emit } from './lib/seam-io.mjs';
import { weighAll } from './lib/surface-weight.mjs';
import { residentWeight } from './lib/resident-weight.mjs';
// The throwing flag reader, shared with self-verify.mjs. Its contract - and why
// the NON-throwing sibling beside it in that module must stay a separate
// export - live in lib/seam-input.mjs; the catch arm below is what turns the
// thrown seam object into a named refusal instead of "[object Object]".
import { flagValue } from './lib/seam-input.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

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
