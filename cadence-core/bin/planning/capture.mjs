// @ts-check
// planning/capture.mjs - `capture`: one bullet into .planning/CAPTURE.md, under
// the heading its kind owns.
'use strict';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fail, ok } from './core.mjs';
import { CAPTURE_KINDS, appendCapture } from '../lib/capture-file.mjs';
import { requirePhaseArg } from '../lib/require-int.mjs';

// ---------------------------------------------------------------------------
// capture - one bullet into `.planning/CAPTURE.md`, under the heading its kind
// owns. The whole point is that the heading is NOT an argument: the append used
// to be `/cad-capture` prose holding `Write`/`Edit`, and five filed bullets were
// lost to a heading the recall walk does not visit. The format, the section and
// the file I/O live in lib/capture-file.mjs; this owns the flag contract and the
// envelope.
// ---------------------------------------------------------------------------
function cmdCapture(dir, opts) {
  const kind = typeof opts.kind === 'string' ? opts.kind.trim() : '';
  if (!CAPTURE_KINDS.includes(kind)) {
    return fail('bad-args', `capture --kind must be one of ${CAPTURE_KINDS.join(' | ')}`
      + ` (got: ${kind || 'none'})`,
      'send one of the kinds the detail lists - it decides which heading of CAPTURE.md the item is'
      + ' filed under, and the recall walk reads them differently');
  }
  // `--text-file` is the SAFE transport and the one the workflows prescribe.
  // `--text "<item>"` puts caller-derived prose inside a double-quoted shell
  // word, so an item carrying `$(...)` or a backtick executes before Node
  // starts. A path cannot: the caller writes the sentence with a file tool and
  // names the file here. `--text` stays for a human typing at a shell, where
  // the text is the user's own.
  if ('text-file' in opts && (typeof opts['text-file'] !== 'string' || opts['text-file'].trim() === '')) {
    return fail('bad-args', 'capture --text-file needs a path after it: --text-file <path>',
      'write the sentence to a file and name it after the flag - nothing was captured, so the'
      + ' sentence is not in the queue yet');
  }
  if ('text' in opts && 'text-file' in opts) {
    return fail('bad-args', 'capture takes --text or --text-file, never both',
      'drop one of the two and re-run - keeping both would silently discard one of the sentences'
      + ' you believe was captured');
  }
  let text;
  if (typeof opts['text-file'] === 'string') {
    try {
      text = readFileSync(opts['text-file'].trim(), 'utf8').trim();
    } catch (e) {
      return fail('bad-args',
        `capture --text-file could not be read: ${e && e.message ? e.message : String(e)}`,
        'write the sentence to that path, or point --text-file at the file that already holds it -'
        + ' nothing was captured');
    }
    if (!text) {
      return fail('bad-args', 'capture --text-file names an empty file',
        'put the sentence in that file before re-running - nothing was captured, and an empty file'
        + ' is what a write that never landed looks like');
    }
  } else {
    // parseArgs hands a VALUELESS flag the boolean `true`, so a bare `--text`
    // has to be refused here - written through, it captures the literal word
    // "true" and the user's sentence is gone with an ok:true envelope (#42/#45).
    text = typeof opts.text === 'string' ? opts.text.trim() : '';
    if (!text) {
      return fail('bad-args',
        'capture needs the sentence: --text-file <path> (workflows) or --text "<text>" (typed by hand)',
        'write what should be remembered as one sentence and pass it through --text-file, or --text'
        + ' at a shell - a bare --text arrives here as the word "true" and is refused rather than'
        + ' filed');
    }
  }
  /** @type {string|undefined} */
  let phase;
  if ('phase' in opts) {
    // Admitted with `todo` ALONE. A seed or a note carrying `--phase` would be
    // written with no tag, leaving the caller believing it tagged something -
    // so the flag is refused rather than dropped.
    if (kind !== 'todo') {
      return fail('bad-args', 'capture --phase is admitted only with --kind todo'
        + ' - a seed and a note carry no phase tag',
      'drop --phase, or file this as --kind todo if the phase tag is the point - nothing was'
      + ' captured, and dropping the flag silently would have left you believing it tagged'
      + ' something');
    }
    const parsed = requirePhaseArg(opts.phase);
    if (!parsed.ok) {
      return fail('bad-args', 'capture --phase needs a phase number: --phase <N>',
        'send a plain phase number, or drop --phase to file the item untagged - nothing was'
        + ' captured');
    }
    // The caller's OWN spelling, so `--phase 1.10` tags `(phase 1.10)`.
    phase = parsed.raw;
  }
  // Same present-but-unusable refusal `debt-harvest --root` carries: a flag with
  // nothing usable after it is never silently answered about the default path,
  // which would write a different file than the caller named (#42/#45).
  if ('file' in opts && (typeof opts.file !== 'string' || opts.file.trim() === '')) {
    return fail('bad-args', 'capture --file needs a path after it: --file <path to CAPTURE.md>',
      'name the CAPTURE.md to append to, or drop --file to use the one under --dir - nothing was'
      + ' captured');
  }
  const file = typeof opts.file === 'string' ? opts.file : join(dir, 'CAPTURE.md');
  const res = appendCapture(file, kind, text, phase);
  if (res.ok === false) {
    return fail(res.reason, res.detail,
      'nothing was captured, so the sentence is not in the queue - make the file the detail names'
      + ' writable and re-run; if another run is holding its lock, let that one finish first');
  }
  ok({ file, kind, bullet: res.bullet, heading: res.heading, created: res.created });
}

export { cmdCapture };
