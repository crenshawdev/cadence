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
// `anchors` is NOT the same quantity as the consult-site count
// `cadence-core/references/seams.md` (File round-trip) makes a deferring skill
// state, and the two names are different on purpose. That rule counts distinct
// consult STEPS, with mutually exclusive arms of ONE step counted once, because
// what it is pricing is how many deferred reads the command actually performs.
// This register names WHICH regions must each carry a Read instruction, because
// what it is protecting is each arm's own sentence. So
// `references/git-publish.md` is ONE site there and TWO anchors here:
// step 4(a) and step 4(b) are mutually exclusive, but deleting either one's Read
// silently loses that arm's rails. A single name for both quantities would
// invite a maintainer to "correct" one against the other, and the correction
// would drop an arm out of the check's coverage.
//
// Anchors, not a COUNT. The register used to state `read_paragraphs: 2` and the
// check counted qualifying sentences FILE-WIDE, which made the number a quota
// any two sentences anywhere could fill: step 4(b)'s Read could be deleted and
// an equivalent sentence relocated into `<guardrails>`, leaving 2 of 2 and
// self-verify ok:true while the `git.auto_close: true` arm reached `gh pr merge`
// with the reference never loaded. Reproduced, not theorised. A count cannot
// express "each arm's own sentence" - only naming the arms can, which is why
// the rows carry region labels now and the check tests them one at a time.
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
 * `anchors` names the region label (see `regionLabel`) of every arm that must
 * carry its OWN Read sentence - `read_paragraphs` is derived from it so the two
 * can never disagree.
 * @type {ReadonlyArray<{skill: string, reference: string,
 *   anchors: readonly string[], read_paragraphs: number}>}
 */
export const DEFERRED_READS = Object.freeze([
  Object.freeze({
    skill: 'cad-land',
    reference: 'references/review-triggers.md',
    anchors: Object.freeze(['3']),
    read_paragraphs: 1,
  }),
  Object.freeze({
    // ONE consult site under seams.md's rule (step 4a or step 4b, never both),
    // but TWO anchors here - each arm carries its own Read and deleting either
    // silently loses that arm's rails.
    skill: 'cad-land',
    reference: 'references/git-publish.md',
    anchors: Object.freeze(['4(a)', '4(b)']),
    read_paragraphs: 2,
  }),
  Object.freeze({
    skill: 'cad-land',
    reference: 'references/triage-gate.md',
    anchors: Object.freeze(['3']),
    read_paragraphs: 1,
  }),
  Object.freeze({
    skill: 'cad-plan-review',
    reference: 'references/review-triggers.md',
    anchors: Object.freeze(['2']),
    read_paragraphs: 1,
  }),
]);

/** Split prose into sentences: a terminator followed by whitespace. */
function sentences(text) {
  return text.split(/(?<=[.!?])\s+/);
}

/**
 * Label the region a line belongs to, walking the file top to bottom.
 *
 * Two markers, both structural rather than wording-dependent, so an editor can
 * rewrite any sentence without moving an anchor:
 *   - `^<n>. ` at column 0 - a top-level numbered step, label `"<n>"`.
 *   - `**(<x>)` on its own indented line - a lettered arm of the current step,
 *     label `"<n>(<x>)"`.
 * Everything before the first step, and everything inside a tag block that is
 * not `<process>` (`<guardrails>`, `<objective>`, ...), gets `null` - a
 * REGIONLESS label that no anchor can match. That is what makes relocating an
 * arm's Read into `<guardrails>` fail instead of filling a quota: the sentence
 * is still in the file, but not in the arm that needs it.
 * @param {string} text
 * @returns {(line: number) => string|null} region label per 0-based line index
 */
function regionLabels(text) {
  const lines = text.split('\n');
  /** @type {(string|null)[]} */
  const labels = [];
  let step = null;
  let arm = null;
  let inProcess = false;
  for (const line of lines) {
    const open = /^<([a-z_]+)>\s*$/.exec(line);
    const close = /^<\/([a-z_]+)>\s*$/.exec(line);
    if (open) {
      inProcess = open[1] === 'process';
      // A new block always ends the previous block's step numbering, so a
      // second `1.` in a later block cannot inherit the first block's arm.
      step = null;
      arm = null;
      labels.push(null);
      continue;
    }
    if (close) {
      inProcess = false;
      step = null;
      arm = null;
      labels.push(null);
      continue;
    }
    const stepM = /^(\d+)\.\s/.exec(line);
    if (stepM) {
      step = stepM[1];
      arm = null;
    } else {
      const armM = /^\s+\*\*\(([a-z])\)/.exec(line);
      if (armM) arm = armM[1];
    }
    labels.push(inProcess && step ? (arm ? `${step}(${arm})` : step) : null);
  }
  return (i) => labels[i] ?? null;
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
    // Per ANCHOR, never file-wide. Each anchor's own lines are gathered and
    // sentence-split on their own, so a Read sentence living in some OTHER
    // region cannot answer for this one. The old file-wide count let exactly
    // that happen (see the header).
    const labelOf = regionLabels(text);
    /** @type {Map<string, string[]>} */
    const byRegion = new Map();
    text.split('\n').forEach((line, i) => {
      const label = labelOf(i);
      if (label === null) return;
      const acc = byRegion.get(label);
      if (acc) acc.push(line);
      else byRegion.set(label, [line]);
    });
    const missing = row.anchors.filter((anchor) => {
      const lines = byRegion.get(anchor);
      if (!lines) return true; // the arm itself is gone
      return !sentences(lines.join('\n'))
        .some((s) => s.includes(full) && /\bRead\b/.test(s));
    });
    if (missing.length) {
      issues.push({
        kind: CODES.unread,
        file: rel,
        detail: `${row.reference} is deferred out of ${row.skill} but step(s) ${missing.join(', ')} carry no sentence that both names its full \${CLAUDE_PLUGIN_ROOT} path and says Read - a de-preloaded reference that arm never Reads is unreachable from it (${row.anchors.length - missing.length} of ${row.anchors.length} anchors satisfied)`,
      });
    }
  }
  return issues;
}
