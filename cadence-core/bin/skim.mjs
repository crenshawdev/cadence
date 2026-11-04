#!/usr/bin/env node
// @ts-check
// the cheap-read seam: source with comments stripped and line numbers intact, so an agent orients in a big file for about half the tokens and then Reads the exact range with the prose still there
// the success path writes source text on stdout, not a JSON line, since JSON-escaping a big file would inflate the payload this exists to shrink. Failures and `--stats` still emit one JSON line
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
      // refuse rather than guess: a wrong comment syntax deletes real code, and ok:false lets the caller fall back to Read
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
        // the one invariant worth aborting on: if the line count moved, every line reference taken from this output is wrong
        emit({ ok: false, reason: 'line-count-drift', file, ...stats,
          hint: 'read this file with the Read tool - the line numbers this seam would print do not match the file' });
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
  // an absent path is the caller's to fix; anything else leaves Read as the only way to see the file
  const absent = err?.code === 'ENOENT';
  emit({ ok: false, reason: absent ? 'no-such-file' : 'skim-failed',
    detail: String(err?.message || err),
    hint: absent
      ? 'check the path - skim.mjs takes one file, absolute or relative to the current directory - then re-run'
      : 'read this file with the Read tool' });
}
