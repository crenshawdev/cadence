// @ts-check
// load-data.mjs - zero-dep helper for loading a shipped JSON data file (not a
// user config layer - see lib/config-merge.mjs for that). A shipped data file
// (route-table.json, config.schema.json) is normally always present, but a
// partial install, bad edit, or botched merge can leave it absent or
// malformed. Callers on the "never blocks the spine" seam contract (route.mjs,
// config.mjs) must degrade to {ok:false}, not crash - so this returns a
// discriminated result instead of throwing (#40).
//
// Return shape is flat (ok + both optional fields), not a discriminated
// union: under this repo's non-strict tsconfig.ci.json (strict:false, so
// strictNullChecks is off too), `if (loaded.ok)` does not narrow a
// `{ok:true,data}|{ok:false,detail}` union cleanly - a flat shape sidesteps
// that tsc limitation entirely.
'use strict';

import { readFileSync } from 'node:fs';

/**
 * Read and JSON-parse `file`. Never throws: any read/parse failure degrades
 * to {ok:false, detail} naming the file and the underlying error.
 * @param {string} file
 * @returns {{ok:boolean, data?:any, detail?:string}}
 */
export function loadDataFile(file) {
  try {
    return { ok: true, data: JSON.parse(readFileSync(file, 'utf8')) };
  } catch (e) {
    return { ok: false, detail: `${file}: ${e && e.message ? e.message : String(e)}` };
  }
}
