#!/usr/bin/env node
// @ts-check
// skim.mjs - the cheap-read seam. Prints a source file with its comments
// stripped and its LINE NUMBERS INTACT, so an agent can orient in a large
// file for roughly half the tokens and then Read the exact range it needs
// with the design prose still there.
//
// Measured on this repo: 58.9% of non-test .mjs bytes are comments and blank
// lines; `planning.mjs` skims 170,520 -> 82,514 B at 3,328 lines in and out.
//
// SEAM CONVENTION DEVIATION, deliberate: the success path writes SOURCE TEXT
// on stdout, not one JSON line. Wrapping 82 KB of code in a JSON string would
// escape every quote and newline in it, inflating the payload this command
// exists to shrink. Failures and `--stats` still emit the one JSON line, so
// everything a caller parses is JSON and everything it reads is source.
//
// Usage: skim.mjs <file> [--stats] [--no-numbers]
//        --stats       one JSON line of the byte/line figures, no source
//        --no-numbers  omit the `N\t` prefixes (default is to include them,
//                      matching the Read tool so line references transfer)
'use strict';

import { readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { emit } from './lib/seam-io.mjs';
import { skim, skimStats, SYNTAX } from './lib/skim.mjs';

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const file = argv.find((a) => !a.startsWith('--'));

try {
  if (!file) {
    emit({ ok: false, reason: 'missing-file', hint: 'skim.mjs <file> [--stats] [--no-numbers]' });
  } else {
    const ext = extname(file).toLowerCase();
    if (!(ext in SYNTAX) || SYNTAX[ext] === null) {
      // Refuse rather than guess. A wrong comment syntax deletes real code,
      // and a caller that gets ok:false can fall back to Read; a caller handed
      // mangled source cannot tell that it was mangled.
      emit({
        ok: false, reason: 'unsupported-extension', ext: ext || '(none)',
        supported: Object.keys(SYNTAX).filter((k) => SYNTAX[k]),
        hint: 'read this file with the Read tool',
      });
    } else {
      const source = readFileSync(resolve(file), 'utf8');
      const skimmed = skim(source);
      const stats = skimStats(source, skimmed);
      if (!stats.lines_match) {
        // The one invariant worth aborting on: if the line count moved, every
        // line reference the agent takes from this output is wrong.
        emit({ ok: false, reason: 'line-count-drift', file, ...stats });
      } else if (flags.has('--stats')) {
        emit({ ok: true, file, ...stats });
      } else if (flags.has('--no-numbers')) {
        process.stdout.write(skimmed);
      } else {
        const lines = skimmed.split('\n');
        const w = String(lines.length).length;
        process.stdout.write(
          lines.map((l, i) => `${String(i + 1).padStart(w)}\t${l}`).join('\n'),
        );
      }
    }
  }
} catch (e) {
  const err = /** @type {any} */ (e);
  emit({ ok: false, reason: err?.code === 'ENOENT' ? 'no-such-file' : 'skim-failed', detail: String(err?.message || err) });
}
