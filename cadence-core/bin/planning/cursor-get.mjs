// @ts-check
// planning/cursor-get.mjs - `cursor get`: STATE.md's cursor, parsed.
// read-only, with distinct refusals: absent STATE.md is `no-cursor`, off-schema is `unparseable-cursor`
// both point at /cad-progress, which derives a cursor from the phase artifacts; STATE.md is never hand-edited
// split from `cursor set` because the two share the file they address and nothing else
'use strict';

import { join } from 'node:path';
import { fail, ok, read } from './core.mjs';
import { parseCursor } from '../lib/state-cursor.mjs';

function cmdCursorGet(dir) {
  const text = read(join(dir, 'STATE.md'));
  if (text === null) {
    return fail('no-cursor', `${join(dir, 'STATE.md')} not found`,
      'run /cad-progress, which derives where the project is from the phase artifacts and writes'
      + ' the cursor; /cad-new-project if this project has no .planning/ yet');
  }
  const c = parseCursor(text);
  if (!c) {
    return fail('unparseable-cursor', 'STATE.md does not match the cursor schema (four required lines plus an optional `Plan:` line)',
      'run /cad-progress to rewrite the cursor from the phase artifacts - STATE.md is written'
      + ' through `cursor set` and is never hand-edited');
  }
  ok(c);
}

export { cmdCursorGet };
