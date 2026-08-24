// @ts-check
// planning/cursor-get.mjs - `cursor get`: STATE.md's cursor, parsed.
//
// Read-only, and its two refusals are deliberately distinct: an absent STATE.md
// is `no-cursor` and a file that does not match the 4-line schema is
// `unparseable-cursor`. Both point at /cad-progress, which is what DERIVES a
// cursor from the phase artifacts; STATE.md is written through `cursor set` and
// is never hand-edited. Split from `cursor set` (phase 4, D-01): the two share
// the file they address and nothing else.
'use strict';

import { join } from 'node:path';
import { fail, ok, read } from './core.mjs';
import { parseCursor } from '../lib/planning-files.mjs';

function cmdCursorGet(dir) {
  const text = read(join(dir, 'STATE.md'));
  if (text === null) {
    return fail('no-cursor', `${join(dir, 'STATE.md')} not found`,
      'run /cad-progress, which derives where the project is from the phase artifacts and writes'
      + ' the cursor; /cad-new-project if this project has no .planning/ yet');
  }
  const c = parseCursor(text);
  if (!c) {
    return fail('unparseable-cursor', 'STATE.md does not match the 4-line schema',
      'run /cad-progress to rewrite the cursor from the phase artifacts - STATE.md is written'
      + ' through `cursor set` and is never hand-edited');
  }
  ok(c);
}

export { cmdCursorGet };
