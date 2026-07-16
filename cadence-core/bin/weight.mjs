#!/usr/bin/env node
// @ts-check
// weight.mjs - the context-weight seam. Measures the plugin's OWN prose
// surfaces (agents/skills/workflows) and reports each one's byte + estimated-
// token weight as one JSON line. Contrast planning.mjs, which is scoped to the
// .planning state files; this script measures the shipped plugin prose itself.
// The measurement lib it imports is the same one self-verify.mjs enforces the
// budget with, so reported and enforced weight cannot diverge.
//
// Seam convention: one JSON line on stdout, exit 0. Deterministic: sorted
// traversal + fixed key order make two runs on the same tree byte-identical.
// Usage: weight.mjs [--root <repo root>]
'use strict';

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emit } from './lib/seam-io.mjs';
import { weighAll } from './lib/surface-weight.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

try {
  const argv = process.argv.slice(2);
  const ri = argv.indexOf('--root');
  const root = ri >= 0 ? argv[ri + 1] : join(HERE, '..', '..');
  emit({ ok: true, checked: 'surface-weight', surfaces: weighAll(root) });
} catch (e) {
  emit({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
}
