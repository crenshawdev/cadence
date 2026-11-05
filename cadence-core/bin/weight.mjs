#!/usr/bin/env node
// @ts-check
// weight.mjs - the context-weight seam: bytes and estimated tokens of the plugin's own prose (`agents/*.md`,
// `skills/**/SKILL.md`, `cadence-core/workflows/*.md`, `cadence-core/references/`, `cadence-core/templates/`) as one
// JSON line. planning.mjs measures the .planning state; this measures what ships.
// It uses the lib self-verify.mjs enforces the budget with, so reported and enforced weight can't diverge.
// `resident` answers what one command carries into the main thread and one dispatch into a subagent.
// Deterministic: sorted traversal and fixed key order, so two runs on one tree are byte-identical.
// Usage: weight.mjs [--root <repo root>]
//        weight.mjs resident [--root <repo root>] [--command <name>] [--role <name>]
// A flag present with no value is `ok:false`/`missing-flag-value`, never a silent default.
'use strict';

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emit } from './lib/seam-io.mjs';
import { weighAll } from './lib/surface-weight.mjs';
import { residentWeight } from './lib/resident-weight.mjs';
// Flag rules are declared rows in lib/arg-contract.mjs, and `requireFlag` throws the refusal in the form the catch arm
// below renders (raised bare, it surfaces as detail "[object Object]"). All three flags refuse on both axes, which is
// the "never a silent default" above.
import { CONTRACTS, requireFlag } from './lib/arg-contract.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

try {
  const argv = process.argv.slice(2);
  /** This script's declared rows: the bare form is the `''` row, and `--root`, legal on both arms, is under `'*'`. */
  const ROWS = CONTRACTS['weight.mjs'];
  const sub = argv[0] === 'resident' ? 'resident' : '';
  /** One flag read through its declared row; the row owns the rule and this is only an adapter over argv. */
  const arg = (name) => requireFlag(argv, name, ROWS[sub][name] || ROWS['*'][name]);
  const root = arg('--root') || join(HERE, '..', '..');
  if (argv[0] === 'resident') {
    const r = residentWeight(root);
    // Filters narrow only the array they name: `zeroResident` comes from every command's reachable set and a filter
    // mustn't change it.
    const command = arg('--command');
    const role = arg('--role');
    let { commands, roles } = r;
    if (command !== undefined) {
      commands = commands.filter((c) => c.command === command);
      // Not an argument-shape refusal, so not the contract's: the flag was well-formed and the filter matched nothing.
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
  if (e && e.seam) emit({ ok: false, reason: e.seam, detail: e.detail,
    hint: 'the detail names the flag that refused - give it a value of the kind that flag takes and re-run the command' });
  else emit({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
}
