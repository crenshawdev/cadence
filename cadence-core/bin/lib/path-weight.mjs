// @ts-check
// path-weight.mjs - the bytes one command's ordinary path opens, read from the register `cadence-core/bin/path-baselines.json`.
// resident-weight.mjs derives its sets from @-includes and citations; this one takes the report's own file list as given.
// A listed file that's missing is a refusal, never 0 bytes: a stale row is exactly what this arm exists to show.
// Reports only. Whether a path is over its baseline is the cadence-tests hold's call, not this lib's.
// Pure and builtins-only, register order kept, so two runs on one tree are byte-identical.
'use strict';

import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const REGISTER = 'cadence-core/bin/path-baselines.json';
const ENTRY_KEYS = ['baseline', 'command', 'files', 'variant'];
// repository-relative POSIX only: no leading slash, no backslash, no empty, `.` or `..` segment
const REL_PATH_RE = /^(?!.*(?:^|\/)\.{1,2}(?:\/|$))(?!.*\/\/)[^/\\][^\\]*$/;

/**
 * One register refusal in the `{seam, detail}` shape weight.mjs's catch arm renders.
 * @param {string} seam
 * @param {string} detail
 */
function refuse(seam, detail) {
  return { seam, detail };
}

/**
 * The register's `paths` array, every entry checked for its four fields before any file is opened.
 * @param {string} root
 * @returns {Array<{command: string, variant: string, files: string[], baseline: number}>}
 */
function readRegister(root) {
  let text;
  try {
    text = readFileSync(join(root, REGISTER), 'utf8');
  } catch {
    throw refuse('path-register-missing', REGISTER);
  }
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    throw refuse('path-register-malformed', `${REGISTER}: not JSON`);
  }
  if (!doc || !Array.isArray(doc.paths)) throw refuse('path-register-malformed', `${REGISTER}: no paths array`);
  doc.paths.forEach((p, i) => {
    const bad = (why) => refuse('path-register-malformed', `${REGISTER}: paths[${i}] ${why}`);
    if (!p || typeof p !== 'object' || Array.isArray(p)) throw bad('is not an object');
    if (Object.keys(p).sort().join() !== ENTRY_KEYS.join()) throw bad(`must have exactly ${ENTRY_KEYS.join(', ')}`);
    if (typeof p.command !== 'string' || !p.command) throw bad('command is not a non-empty string');
    if (typeof p.variant !== 'string' || !p.variant) throw bad('variant is not a non-empty string');
    if (!Number.isSafeInteger(p.baseline) || p.baseline < 0) throw bad('baseline is not a non-negative integer');
    if (!Array.isArray(p.files) || !p.files.length) throw bad('files is not a non-empty array');
    for (const f of p.files) {
      if (typeof f !== 'string' || !REL_PATH_RE.test(f)) throw bad(`file ${JSON.stringify(f)} is not a repository-relative POSIX path`);
    }
  });
  return doc.paths;
}

/**
 * Every registered path in register order, each with its files' on-disk bytes and their total.
 * @param {string} root the repository root
 * @returns {Array<{command: string, variant: string, baseline: number, bytes: number,
 *   files: Array<{surface: string, bytes: number}>}>}
 */
export function pathWeight(root) {
  return readRegister(root).map((p) => {
    const files = p.files.map((surface) => {
      let bytes;
      try {
        // a directory reads as unreadable here, not as its inode size
        if (!statSync(join(root, surface)).isFile()) throw new Error('not a file');
        bytes = readFileSync(join(root, surface)).length;
      } catch {
        throw refuse('path-file-missing', `${p.command} (${p.variant}): ${surface}`);
      }
      return { surface, bytes };
    });
    return {
      command: p.command,
      variant: p.variant,
      baseline: p.baseline,
      bytes: files.reduce((n, f) => n + f.bytes, 0),
      files,
    };
  });
}
