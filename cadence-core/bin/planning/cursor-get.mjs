// @ts-check
// planning/cursor-get.mjs - `cursor get`: the state file's cursor, as it has always been answered.
// read-only, and STATE.md is never opened: it is output the state renders, so a hand edit to it changes nothing here
// no cursor in the state is `no-cursor`, pointing at /cad-progress, which derives a cursor from the phase artifacts
// split from `cursor set` because the two share the file they address and nothing else
'use strict';

import { fail, ok } from './core.mjs';
import { cursorOf, loadState } from './state-import.mjs';

function cmdCursorGet(dir) {
  const state = loadState(dir);
  if (!state) return;
  const c = cursorOf(state);
  if (!c) {
    return fail('no-cursor', 'the state file holds no cursor',
      'run /cad-progress, which derives where the project is from the phase artifacts and writes'
      + ' the cursor; /cad-new-project if this project has no .planning/ yet');
  }
  ok(c);
}

export { cmdCursorGet };
