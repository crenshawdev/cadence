// @ts-check
// include-consumers.mjs - the pure rule behind self-verify's include-consumer
// check (check 16): an `@`-include CLAIMS a consumer, and this checks the claim.
// A command that `@`-includes a reference or a template pays those bytes on turn
// one and on every turn after; if no eager prose of that command ever NAMES the
// surface, nothing tells the model to use it and the bytes buy nothing. The disk
// half - filing each issue as a CI problem - lives in self-verify.mjs, the same
// split lib/merge-warnings.mjs, lib/route-relay.mjs and lib/config-reach.mjs
// use.
//
// Why it exists, concretely: this tree shipped `skills/cad-verify/SKILL.md:29`,
// a 5,792 B `@`-include of `cadence-core/templates/UAT.md` that no prose in
// `/cad-verify` has ever named, with a CHANGELOG entry defending it on a
// comparison to `cad-help` that is false on inspection - `cad-help`'s objective
// DOES name `references/COMMANDS.md`. Check 3 already proves an included path
// EXISTS and check 13 proves a reference a skill stopped including is still
// Read; neither can see an include whose consumer was never written.
//
// The scan set is EAGER-ONLY, and that is narrower than CTW-02's wording
// ("reachable prose"). A one-hop CITED reference is excluded even when it names
// the included surface, because a citation is not the including command's own
// instruction - the question this rule asks is whether the command itself ever
// tells anyone to use the surface it paid to load. The cost is a false positive
// for a command whose include is named only in a cited-but-not-eager reference;
// no live command is in that shape, and if one appears the remedy is a waiver
// row carrying its reason, not a widened scan (D-16).
//
// Two exclusions inside the scan text, both load-bearing:
//   - the INCLUDED SURFACE'S OWN text. `cadence-core/references/config-reach.md`
//     names its own path in its own body, so a surface that cites itself would
//     otherwise vacuously pass.
//   - every line starting `@${CLAUDE_PLUGIN_ROOT}/`. `CITE_RE` in
//     lib/resident-weight.mjs matches the include LINE itself and yields
//     `templates/UAT.md` from it, so leaving those lines in makes every include
//     name itself, the check is ok:true forever, and the CI hole is reported
//     closed while still open (D-10).
//
// A `cadence-core/workflows/*` include is EXEMPT: the workflow IS the command's
// process, so naming it would be a command citing its own body. Measured over
// the live tree, `workflows/<name>.md` is named nowhere in its own command's
// eager text for 15 of 16 commands (only `decision-review.md` self-names), so an
// unexempted check lands red on 19 correct includes (D-08). The exemption is by
// BRANCH and not by POSITION, because lib/resident-weight.mjs sorts `eagerFiles`
// by surface and include order is not recoverable from the weighed envelope.
//
// Matching is on the `<branch>/<file>` PATH form, never the basename:
// `workflows/verify.md` says bare `UAT.md` eight times for the runtime artifact
// `.planning/phases/<N>/UAT.md`, so basename matching would stop the check
// firing on the one instance it must catch (D-09). One word-boundary-anchored
// literal covers the `${CLAUDE_PLUGIN_ROOT}/cadence-core/`, the `cadence-core/`
// and the bare citation forms at once, since all three end in that same suffix.
//
// Scope: user-invocable COMMANDS only, because the rule consumes
// `commandEagerSets()` and that filter is what keeps contract bytes accounted
// under `roles` (D-12). Deliberately ASYMMETRIC with lib/deferred-reads.mjs,
// which widens TO contract skills in this same phase: no `*-contract/SKILL.md`
// carries an `@`-include today, so the first one is a known uncovered case here
// rather than a surprise.
//
// THE WAIVER REGISTER SHIPS EMPTY. It held exactly one row - `cad-verify`'s
// `templates/UAT.md` include - as a phase-1 bridge, and phase 2 deleted the
// include and the row in the same commit, which is what the DOWNWARD bound
// below demanded. Its size is asserted from this lib's test AND again through
// the self-verify CLI, now at zero, so ADDING a row is a red build rather than
// a reviewer's judgement call. Both bounds remain wired for a future row:
//   DOWNWARD, `staleWaiver`: a waived row whose skill exists here and no longer
//     carries that `@`-include line is itself a problem, so the deletion the
//     waiver was written for turns self-verify red until the row goes with it. A
//     bridge cannot outlive the thing it bridges.
//   UPWARD, `expiredWaiver`: `removeInPhase` is an executable deadline, not a
//     comment. Once `.planning/ROADMAP.md` shows that phase checked off while
//     the row still exists, the row is a problem. Without it a scheduled removal
//     that slips or is dropped would leave the exact defect this check exists to
//     catch suppressed indefinitely with CI green, since `staleWaiver` only ever
//     fires on a deletion that by then has not happened - a hole with paperwork
//     rather than a bridge.
// The remedy for a future FALSE POSITIVE is a waiver row carrying its stated
// reason and its `removeInPhase` deadline, never a widened scan (phase 1 D-16).
//
// Pure rule: no emit, no exit, no Date, no randomness, node builtins only, and
// every read guarded. A waiver row whose skill is absent from this root reports
// nothing, and an absent or unreadable `.planning/ROADMAP.md` reports no
// `expiredWaiver` - the same partial-fixture degradation lib/deferred-reads.mjs
// uses, so a fixture root carrying no `.planning/` arm is not a break.
'use strict';

import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { commandEagerSets } from './resident-weight.mjs';

/** The problem codes this rule files. */
export const CODES = Object.freeze({
  neverNamed: 'include-never-named',
  staleWaiver: 'include-waiver-stale',
  expiredWaiver: 'include-waiver-expired',
});

/**
 * The waiver register. EMPTY, and it ships empty - see the header: the one row
 * it carried died in the same commit that deleted `skills/cad-verify/SKILL.md`'s
 * `templates/UAT.md` include, and both bounds stay wired so a future row cannot
 * become a permanent exemption.
 * @type {ReadonlyArray<{skill: string, surface: string, removeInPhase: number}>}
 */
export const WAIVED = Object.freeze([]);

/** An `@`-include path this rule judges: `cadence-core/<branch>/<file>`. */
const INCLUDE_PATH_RE = /^cadence-core\/(references|templates|workflows)\/([A-Za-z0-9_\-./]+)$/;

/** A line the host expands as an include - dropped from every scan text. */
const INCLUDE_LINE_RE = /^@\$\{CLAUDE_PLUGIN_ROOT\}\//;

/** @param {string} s @returns {string} */
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
 * Every include-consumer issue under `root`.
 *
 * `waived` is a parameter, not a hard-wired read of `WAIVED`, so both arms stay
 * testable while the shipped register is empty: a test drives the suppression
 * path and both bounds from an EXPLICIT one-row list, and the reporting path
 * from the default.
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
      // Anything else is skipped: check 3 already owns path existence, and no
      // live include has another shape.
      if (!m) continue;
      const [, branch, name] = m;
      // The workflow IS the process. See the header (D-08).
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
    // A root that simply does not have this skill is a partial fixture, not a
    // break - the same degradation lib/deferred-reads.mjs applies.
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
