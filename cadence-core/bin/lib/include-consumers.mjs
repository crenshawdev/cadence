// @ts-check
// include-consumers.mjs - self-verify's check 16: an `@`-include claims a consumer, and this checks the claim
// a command pays an include's bytes every turn; if none of its eager prose names the surface, nothing says to use it
// eager prose only: a cited reference doesn't count, and the fix for that false positive is a waiver row
// the scan drops the included surface's own text, which would name itself, and every `@${CLAUDE_PLUGIN_ROOT}/` line
// workflows/* includes are exempt: the workflow is the command's process, naming it would be citing its own body
// matched on the `<branch>/<file>` path, never the basename: workflows/verify.md says bare UAT.md for another file
// the waiver register ships empty, both bounds wired: a row whose include is gone or whose phase is done is a problem
// pure, builtins only, every read guarded; a root without the skill or ROADMAP.md reports nothing
'use strict';

import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { commandEagerSets } from './resident-weight.mjs';
import { escapeRe } from './text-util.mjs';

/** The problem codes this rule files. */
export const CODES = Object.freeze({
  neverNamed: 'include-never-named',
  staleWaiver: 'include-waiver-stale',
  expiredWaiver: 'include-waiver-expired',
});

/**
 * The waiver register. Ships empty: its one row died in the commit that deleted the cad-verify UAT.md
 * include, and both bounds stay wired so a future row can't become a permanent exemption.
 * @type {ReadonlyArray<{skill: string, surface: string, removeInPhase: number}>}
 */
export const WAIVED = Object.freeze([]);

/** An `@`-include path this rule judges: `cadence-core/<branch>/<file>`. */
const INCLUDE_PATH_RE = /^cadence-core\/(references|templates|workflows)\/([A-Za-z0-9_\-./]+)$/;

/** A line the host expands as an include - dropped from every scan text. */
const INCLUDE_LINE_RE = /^@\$\{CLAUDE_PLUGIN_ROOT\}\//;

/**
 * Read one file, or null when it is absent, is not a file, or cannot be read.
 * @param {string} file
 * @returns {string|null}
 */
function readText(file) {
  try {
    if (!statSync(file).isFile()) return null;
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

/** Drop every `@`-include line from a text - see the header's second exclusion. */
function withoutIncludeLines(text) {
  return text.split('\n').filter((l) => !INCLUDE_LINE_RE.test(l)).join('\n');
}

/**
 * Every include-consumer issue under root.
 *
 * waived is a parameter so both arms stay testable while the shipped register is empty: a test drives
 * suppression and both bounds from an explicit one-row list, and the reporting path from the default.
 * @param {string} root
 * @param {ReadonlyArray<{skill: string, surface: string, removeInPhase: number}>} [waived]
 * @returns {{kind: string, file: string, detail: string}[]}
 */
export function includeConsumerIssues(root, waived = WAIVED) {
  const issues = [];
  const isWaived = (skill, surface) =>
    waived.some((w) => w.skill === skill && w.surface === surface);

  for (const entry of commandEagerSets(root)) {
    for (const include of entry.includes) {
      const m = INCLUDE_PATH_RE.exec(include);
      // anything else is skipped: check 3 owns path existence and no live include has another shape
      if (!m) continue;
      const [, branch, name] = m;
      // the workflow is the process, see the header
      if (branch === 'workflows') continue;
      const surface = `${branch}/${name}`;
      if (isWaived(entry.command, surface)) continue;

      const scan = entry.surfaces
        .filter((s) => s.surface !== include)
        .map((s) => withoutIncludeLines(s.text))
        .join('\n');
      if (new RegExp(`\\b${escapeRe(surface)}\\b`).test(scan)) continue;

      issues.push({
        kind: CODES.neverNamed,
        file: entry.skillFile,
        detail: `${entry.command} @-includes ${include} on every turn, but no eager surface of that command ever names ${surface} - an include no prose points at is context nothing can spend`,
      });
    }
  }

  const roadmap = readText(join(root, '.planning', 'ROADMAP.md'));
  for (const row of waived) {
    const rel = `skills/${row.skill}/SKILL.md`;
    const text = readText(join(root, 'skills', row.skill, 'SKILL.md'));
    // a root without this skill is a partial fixture, not a break
    if (text === null) continue;
    const line = `@\${CLAUDE_PLUGIN_ROOT}/cadence-core/${row.surface}`;
    if (!new RegExp(`^${escapeRe(line)}\\s*$`, 'm').test(text)) {
      issues.push({
        kind: CODES.staleWaiver,
        file: rel,
        detail: `the include-consumer waiver for ${row.surface} in ${row.skill} outlived its @-include line - delete the WAIVED row in lib/include-consumers.mjs, in this same commit`,
      });
      continue;
    }
    // The upward bound. An absent or unreadable ROADMAP reports nothing.
    if (roadmap !== null
      && new RegExp(`^- \\[[xX]\\] \\*\\*Phase ${row.removeInPhase}:`, 'm').test(roadmap)) {
      issues.push({
        kind: CODES.expiredWaiver,
        file: rel,
        detail: `the include-consumer waiver for ${row.surface} in ${row.skill} was due to be removed in phase ${row.removeInPhase}, and ROADMAP.md shows that phase complete while the @-include and the WAIVED row both still stand`,
      });
    }
  }

  return issues;
}
