// @ts-check
// planning/records-dir.mjs - `records-dir`: make a phase's records folder before a writer that cannot make it
// the advisory reviewer writes its findings by heredoc, and `cat >` makes no parent folder; this runs first, behind fireHome's link guard
'use strict';

import { relative } from 'node:path';
import { fireHome, ok, phaseGuard } from './core.mjs';
import { makeDir } from '../lib/planning-store.mjs';

function cmdRecordsDir(dir, opts) {
  const parsed = phaseGuard('records-dir', dir, opts.phase, 'records-dir needs --phase <N>',
    'pass --phase <N> for the phase whose records folder should exist, then re-run',
    'send --phase with one of the spellings the detail names - nothing was made');
  if (!parsed) return;
  const home = fireHome(dir, parsed.raw, 'records folder');
  if (!home) return;
  makeDir(home);
  return ok({ phase: parsed.raw, records: relative(dir, home) });
}

export { cmdRecordsDir };
