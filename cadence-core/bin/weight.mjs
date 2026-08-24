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
// The argument contract (ARG-06). This file states no flag rule of its own any
// more: what each flag may be, and what it costs when it is not, are DECLARED
// rows in lib/arg-contract.mjs, and `requireFlag` raises the refusal in the
// throwing form the catch arm below already renders - without that arm the
// raised object surfaces as detail "[object Object]". All three flags declare
// `refuse` on both axes, which is the header's "never a silent default".
import { CONTRACTS, requireFlag } from './lib/arg-contract.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

try {
  const argv = process.argv.slice(2);
  /** This script's declared rows. The bare form is the `''` row and `--root`,
   * legal on both arms, is declared once under `'*'`. */
  const ROWS = CONTRACTS['weight.mjs'];
  const sub = argv[0] === 'resident' ? 'resident' : '';
  /** One flag, read through its DECLARED row. The row owns the rule and this
   * binding owns nothing: an adapter over this file's own argv, never a second
   * statement of what a flag may be. */
  const arg = (name) => requireFlag(argv, name, ROWS[sub][name] || ROWS['*'][name]);
  const root = arg('--root') || join(HERE, '..', '..');
  if (argv[0] === 'resident') {
    const r = residentWeight(root);
    // Filters narrow the array they name and nothing else: `zeroResident` is
    // derived from EVERY command's reachable set, so a filter must not be able
    // to change it.
    const command = arg('--command');
    const role = arg('--role');
    let { commands, roles } = r;
    if (command !== undefined) {
      commands = commands.filter((c) => c.command === command);
      // NOT an argument-shape refusal and so NOT the contract's business: the
      // flag was well-formed and this seam is saying the filter matched
      // nothing. It stays weight.mjs's own domain vocabulary.
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
