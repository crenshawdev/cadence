#!/usr/bin/env node
// @ts-check
// agent-files.mjs - writes every agent file the table in lib/rung-agent.mjs names, from that table's one renderer.
// A file the table doesn't name is never touched, so a hand-written one-off agent survives a run.
//
// Usage: agent-files.mjs [--root <dir>]
//   --root  the tree whose agents/ is written. ABSENT means the tree this script ships in.
//
// Only a file whose bytes differ is rewritten, so a clean tree comes out with nothing changed.
'use strict';

import { readFileSync, realpathSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { emit, emitCaught } from './lib/seam-io.mjs';
import { CONTRACTS, requireFlag } from './lib/arg-contract.mjs';
import { atomicWrite } from './lib/planning-store.mjs';
import { RUNG_FILES, agentFileText } from './lib/rung-agent.mjs';

const SHIPPED_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** @param {string[]} argv */
function main(argv) {
  const root = requireFlag(argv, '--root', CONTRACTS['agent-files.mjs']['']['--root']) || SHIPPED_ROOT;
  const written = [];
  for (const { rungs } of Object.values(RUNG_FILES)) {
    for (const stem of Object.values(rungs)) {
      const file = join(root, 'agents', `${stem}.md`);
      const want = /** @type {string} */ (agentFileText(stem));
      let have = null;
      try { have = readFileSync(file, 'utf8'); } catch { /* absent is just another file to write */ }
      if (have === want) continue;
      atomicWrite(file, want);
      written.push(`agents/${stem}.md`);
    }
  }
  emit({ ok: true, root, written });
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try { main(process.argv.slice(2)); } catch (e) { emitCaught(e); }
}
