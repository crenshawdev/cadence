// @ts-check
// deferred-reads.mjs - the pure rule behind self-verify's deferred-read checks
// (check 13): a reference a skill deliberately stopped `@`-including must still
// be Read by name at the step that needs it. The disk half - deciding where the
// check applies and filing each issue as a CI problem - lives in
// self-verify.mjs, the same split lib/merge-warnings.mjs, lib/route-relay.mjs
// and lib/config-reach.mjs use.
//
// Why the register is HAND-MAINTAINED. Whether a reference was REMOVED from an
// include is not derivable from a single tree snapshot: a skill that cites a
// reference and never included it looks byte-identical to one that used to
// include it and stopped. The register IS the record of the removal, the same
// species of stated table as self-verify's CONTRACTS and lib/rung-agent's
// RUNG_FILES, and the check is what holds the prose to it afterwards. Delete a
// row and the deferral stops being watched, which is why a row is added in the
// same commit that makes the cut.
//
// `read_paragraphs` is NOT the same quantity as the consult-site count
// `cadence-core/references/seams.md` (File round-trip) makes a deferring skill
// state, and the two names are different on purpose. That rule counts distinct
// consult STEPS, with mutually exclusive arms of ONE step counted once, because
// what it is pricing is how many deferred reads the command actually performs.
// This register counts how many distinct PARAGRAPHS must carry a Read
// instruction, because what it is protecting is each arm's own sentence. So
// `references/git-publish.md` is ONE site there and TWO read paragraphs here:
// step 4a and step 4b are mutually exclusive, but deleting either one's Read
// silently loses that arm's rails. A single name for both quantities would
// invite a maintainer to "correct" one against the other, and the correction
// would drop an arm out of the check's coverage.
//
// Scope: user-invocable COMMAND skills only. `skills/cad-executor-contract`
// names `references/review-triggers.md` in a full path with no Read verb, and
// it is dispatch prose whose bytes never touch the main thread at all - so
// widening this rule to contract skills would force a prose edit that ADDS
// bytes to a dispatch that never paid the residency this rule exists to price.
//
// The matching unit is the SENTENCE, not the blank-line block. That bound is
// load-bearing: `skills/cad-land/SKILL.md` step 4b is a single ~2,900 B
// paragraph, so a block-level test passes when the real instruction is deleted
// as long as any other line in those 46 lines names the path and any unrelated
// `Read` survives - and `do NOT Read <path>` passes a block-level test
// identically. Sentences are split on a terminator followed by whitespace,
// which is a prose heuristic and not a parser: a terminator immediately
// followed by markup (`.**`, `.md\``) does not split, which is why a bolded
// lead-in and its following clause count as one sentence here.
//
// Pure rule: no emit, no exit, no Date, no randomness, node builtins only, and
// every read guarded so an unreadable file is one reported issue rather than an
// unwound run.
'use strict';

import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** The problem codes this rule files. */
export const CODES = Object.freeze({
  unread: 'deferred-read-unread',
  stillEager: 'deferred-read-still-eager',
  missingSkill: 'deferred-read-missing-skill',
});

/**
 * The register: one row per `{skill, reference}` pair a command skill consults
 * but deliberately no longer `@`-includes. `reference` is root-relative from
 * `cadence-core/`, the way it is spelled in a `${CLAUDE_PLUGIN_ROOT}` path.
 * @type {ReadonlyArray<{skill: string, reference: string, read_paragraphs: number}>}
 */
export const DEFERRED_READS = Object.freeze([
  Object.freeze({
    skill: 'cad-land',
    reference: 'references/review-triggers.md',
    read_paragraphs: 1,
  }),
  Object.freeze({
    // ONE consult site under seams.md's rule (step 4a or step 4b, never both),
    // but TWO read paragraphs here - each arm carries its own Read and deleting
    // either silently loses that arm's rails.
    skill: 'cad-land',
    reference: 'references/git-publish.md',
    read_paragraphs: 2,
  }),
  Object.freeze({
    skill: 'cad-land',
    reference: 'references/triage-gate.md',
    read_paragraphs: 1,
  }),
  Object.freeze({
    skill: 'cad-plan-review',
    reference: 'references/review-triggers.md',
    read_paragraphs: 1,
  }),
]);

/** Split prose into sentences: a terminator followed by whitespace. */
function sentences(text) {
  return text.split(/(?<=[.!?])\s+/);
}

/** @param {string} s @returns {string} */
function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Every deferred-read issue under `root`, one entry per failing register row.
 *
 * An absent `skills/` directory contributes NOTHING: a `--root` fixture that
 * supplies its own tiny surface set is not a Cadence install with a missing
 * skill, and reporting the whole register against it would make every fixture
 * unusable.
 * @param {string} root
 * @returns {{kind: string, file: string, detail: string}[]}
 */
export function deferredReadIssues(root) {
  const skillsDir = join(root, 'skills');
  if (!existsSync(skillsDir)) return [];
  const issues = [];
  for (const row of DEFERRED_READS) {
    const rel = `skills/${row.skill}/SKILL.md`;
    const file = join(skillsDir, row.skill, 'SKILL.md');
    // A skill directory this root does not have at all is out of scope for the
    // same reason an absent skills/ is: a partial fixture is not a break. A
    // directory that EXISTS with no readable SKILL.md in it is a break.
    if (!existsSync(join(skillsDir, row.skill))) continue;
    let text = null;
    try {
      if (statSync(file).isFile()) text = readFileSync(file, 'utf8');
    } catch { /* reported as missingSkill below */ }
    if (text === null) {
      issues.push({
        kind: CODES.missingSkill,
        file: rel,
        detail: `register names ${row.reference} deferred out of ${row.skill}, but that SKILL.md is absent or unreadable`,
      });
      continue;
    }
    const full = `\${CLAUDE_PLUGIN_ROOT}/cadence-core/${row.reference}`;
    if (new RegExp(`^@${escapeRe(full)}\\s*$`, 'm').test(text)) {
      issues.push({
        kind: CODES.stillEager,
        file: rel,
        detail: `${row.reference} is registered as deferred out of ${row.skill} but is still an @-include there - correct the register or drop the include`,
      });
    }
    const found = sentences(text)
      .filter((s) => s.includes(full) && /\bRead\b/.test(s)).length;
    if (found < row.read_paragraphs) {
      issues.push({
        kind: CODES.unread,
        file: rel,
        detail: `${row.reference} is deferred out of ${row.skill} but only ${found} of ${row.read_paragraphs} sentence(s) both name its full \${CLAUDE_PLUGIN_ROOT} path and say Read - a de-preloaded reference nothing Reads is unreachable`,
      });
    }
  }
  return issues;
}
