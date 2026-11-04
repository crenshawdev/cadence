// @ts-check
// deferred-reads.mjs - self-verify's check 13: a reference a skill stopped @-including is still Read by name
// the register is hand-maintained: one snapshot can't tell a removed include from one that never existed
// a promoted row never had an include, so stillEager can't fire, but its anchor is its whole protection: keep the row
// anchors aren't seams.md's consult-site count (steps): they name each arm that needs its own Read sentence
// anchors and not a count: a file-wide quota let a relocated sentence stand in for a deleted Read
// every skill is in scope, contracts too: a subagent can't reach a reference its contract stopped including
// a row's file defaults to skills/<skill>/SKILL.md; skill still targets the include arms, whichever file holds the Read
// the unit is the sentence: cad-land's step 3b is one ~2,900 B paragraph, so a block test passes with the Read deleted
// pure: builtins only, every read guarded so an unreadable file is one issue and not an unwound run
'use strict';

import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { escapeRe } from './text-util.mjs';

/** The problem codes this rule files. */
export const CODES = Object.freeze({
  unread: 'deferred-read-unread',
  stillEager: 'deferred-read-still-eager',
  missingSkill: 'deferred-read-missing-skill',
  // not missingSkill: a row's file may name a workflow, and missingSkill would call that a missing SKILL.md
  missingFile: 'deferred-read-missing-file',
});

/**
 * The register: one row per skill and reference a command consults but no
 * longer `@`-includes. reference is root-relative from cadence-core/.
 * anchors holds the region label (see regionLabels) of every arm that needs its own Read
 * sentence, and read_paragraphs is derived from it so the two can't disagree.
 * file is optional: the surface the anchors resolve against, default skills/<skill>/SKILL.md.
 * @type {ReadonlyArray<{skill: string, reference: string,
 *   anchors: readonly string[], read_paragraphs: number, file?: string}>}
 */
export const DEFERRED_READS = Object.freeze([
  Object.freeze({
    // one consult site by seams.md's count, two anchors here: deleting either arm's Read loses that arm's rails
    skill: 'cad-land',
    reference: 'references/git-publish.md',
    anchors: Object.freeze(['3(a)', '3(b)']),
    read_paragraphs: 2,
  }),
  Object.freeze({
    skill: 'cad-plan-review',
    reference: 'references/review-triggers.md',
    anchors: Object.freeze(['2']),
    read_paragraphs: 1,
  }),
  Object.freeze({
    skill: 'cad-context',
    reference: 'templates/CONTEXT.md',
    anchors: Object.freeze(['write_context']),
    read_paragraphs: 1,
    file: 'cadence-core/workflows/context.md',
  }),
  Object.freeze({
    // two rows, one reference: seams.md's rule is per command and each of these reaches recall at one step,
    // so they're two one-site deferrals and merging them loses a command's anchor
    skill: 'cad-context',
    reference: 'references/recall.md',
    // spend_gate, not analyze: recall runs before the analyzer decision and the skip arm never enters analyze
    anchors: Object.freeze(['spend_gate']),
    read_paragraphs: 1,
    file: 'cadence-core/workflows/context.md',
  }),
  Object.freeze({
    skill: 'cad-debug',
    reference: 'references/recall.md',
    anchors: Object.freeze(['The method loop/1']),
    read_paragraphs: 1,
    file: 'cadence-core/workflows/debug.md',
  }),
  Object.freeze({
    skill: 'cad-execute',
    reference: 'references/execute-parallel.md',
    anchors: Object.freeze(['execute_parallel']),
    read_paragraphs: 1,
    file: 'cadence-core/workflows/execute.md',
  }),
  Object.freeze({
    skill: 'cad-executor-contract',
    reference: 'references/worktree-executor.md',
    anchors: Object.freeze(['worktree_mode']),
    read_paragraphs: 1,
  }),
  Object.freeze({
    skill: 'cad-executor-contract',
    reference: 'references/lean-build.md',
    anchors: Object.freeze(['1']),
    read_paragraphs: 1,
  }),
  Object.freeze({
    skill: 'cad-plan',
    reference: 'references/plan-revision.md',
    anchors: Object.freeze(['check_gate']),
    read_paragraphs: 1,
    file: 'cadence-core/workflows/plan.md',
  }),
]);

/** Sentences split on a terminator plus whitespace, a heuristic: one before markup (.** or .md) does not split. */
function sentences(text) {
  return text.split(/(?<=[.!?])\s+/);
}

/** A block tag on a line of its own: `<tag>` or `<tag key="value" ...>`. */
const OPEN_RE = /^<([a-z_]+)((?:\s+[a-z_-]+="[^"]*")*)\s*>\s*$/;
/** Its close: `</tag>`. `/` is outside `[a-z_]`, so OPEN_RE never matches one. */
const CLOSE_RE = /^<\/([a-z_]+)>\s*$/;
/** The `name=` attribute a `<step name="x">` carries, which becomes its label. */
const NAME_ATTR_RE = /\bname="([^"]*)"/;
/**
 * A markdown heading, level 2 and deeper. An H1 is skipped on purpose: it's
 * the document title and would prefix every label in its file.
 * The title group is written so a long run of spaces can't make it backtrack;
 * the second branch keeps the old result for a whitespace-only title.
 */
const HEADING_RE = /^(#{2,6})\s+(\S(?:.*\S)?|[^\S\n\r\u2028\u2029](?=[\n\r\u2028\u2029]*$))\s*$/;

/**
 * Label the region a line belongs to from structure alone, so rewriting a sentence can't move an anchor.
 * A block tag on its own line opens a frame, labelled by its name= value, null for process, else the tag name.
 * Outside a frame, headings build a path (## replaces it, deeper levels extend it); the label is the path joined by /.
 * Then a column-0 n. adds a numbered step and an indented **(x) a lettered arm: 3(a), worktree_mode, git_guard(3).
 * Frames win over headings, and they're a stack that a close pops only on a matching top. With scalars,
 * execute.md's step close turned process off for the rest of the file and nothing there could be anchored.
 * A bare n is only emitted inside a frame labelled null. Anywhere else two regions could both be "3" and an
 * anchor would be satisfied by a Read in an unrelated bullet, the file-wide quota defect again.
 * Matching is exact, never a prefix: execute_parallel doesn't match inside execute_parallel(6), nor guardrails 3(b).
 * @param {string} text
 * @returns {(line: number) => string|null} region label per 0-based line index
 */
export function regionLabels(text) {
  const lines = text.split('\n');
  /** @type {(string|null)[]} */
  const labels = [];
  /** @type {{tag: string, label: string|null}[]} the open block frames */
  const stack = [];
  /** @type {string[]} the heading path, index 0 = level 2, index 1 = level 3, ... */
  const path = [];
  let item = null;
  let arm = null;
  for (const line of lines) {
    const open = OPEN_RE.exec(line);
    const close = CLOSE_RE.exec(line);
    if (open) {
      const named = NAME_ATTR_RE.exec(open[2] || '');
      stack.push({
        tag: open[1],
        label: named ? named[1] : (open[1] === 'process' ? null : open[1]),
      });
      // a new block ends the previous block's numbering, so a second 1. can't inherit the first block's arm
      item = null;
      arm = null;
      labels.push(null);
      continue;
    }
    if (close) {
      if (stack.length && stack[stack.length - 1].tag === close[1]) stack.pop();
      item = null;
      arm = null;
      labels.push(null);
      continue;
    }
    // headings only count outside every block, so block frames win
    const heading = stack.length ? null : HEADING_RE.exec(line);
    if (heading) {
      const level = heading[1].length;
      path.length = level - 2;
      path[level - 2] = heading[2];
      // a new heading ends the previous one's numbering, or lines under it would inherit item 6 from the walk above
      item = null;
      arm = null;
      labels.push(null);
      continue;
    }
    const itemM = /^(\d+)\.\s/.exec(line);
    if (itemM) {
      item = itemM[1];
      arm = null;
    } else {
      const armM = /^\s+\*\*\(([a-z])\)/.exec(line);
      if (armM) arm = armM[1];
    }
    const frame = stack.length ? stack[stack.length - 1] : null;
    let label;
    if (!frame) {
      // filtered, not joined raw: a skipped level (## then ####) leaves a hole that renders as an empty path segment
      const kept = path.filter((s) => s !== undefined);
      const p = kept.length ? kept.join('/') : null;
      label = p && item ? `${p}/${item}` : p;
    } else if (frame.label === null) label = item;
    else label = item ? `${frame.label}(${item})` : frame.label;
    labels.push(label && arm ? `${label}(${arm})` : (label ?? null));
  }
  return (i) => labels[i] ?? null;
}

/**
 * Every deferred-read issue under root, one entry per failing register row.
 * An absent skills/ contributes nothing: a --root fixture with its own tiny surface set isn't an
 * install with a missing skill. A row's file degrades the same way: an absent parent directory is a
 * partial fixture, while a parent that exists with the file missing or unreadable is a break.
 * @param {string} root
 * @param {ReadonlyArray<{skill: string, reference: string,
 *   anchors: readonly string[], read_paragraphs: number, file?: string}>} [rows]
 * @returns {{kind: string, file: string, detail: string}[]}
 */
export function deferredReadIssues(root, rows = DEFERRED_READS) {
  const skillsDir = join(root, 'skills');
  if (!existsSync(skillsDir)) return [];
  const issues = [];
  for (const row of rows) {
    const rel = `skills/${row.skill}/SKILL.md`;
    const file = join(skillsDir, row.skill, 'SKILL.md');
    // a skill dir this root lacks is out of scope like an absent skills/; one with no readable SKILL.md is a break
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
    // anchors resolve against the SKILL.md already read, or against a row's own file, read with the same guard
    let anchorRel = rel;
    let anchorText = text;
    if (row.file && row.file !== rel) {
      anchorRel = row.file;
      const anchorFile = join(root, ...row.file.split('/'));
      // an absent parent directory is a partial fixture, like an absent skill directory above
      if (!existsSync(dirname(anchorFile))) continue;
      anchorText = null;
      try {
        if (statSync(anchorFile).isFile()) anchorText = readFileSync(anchorFile, 'utf8');
      } catch { /* reported as missingFile below */ }
      if (anchorText === null) {
        issues.push({
          kind: CODES.missingFile,
          file: anchorRel,
          detail: `register anchors ${row.reference}, deferred out of ${row.skill}, in ${row.file} - but that file is absent or unreadable`,
        });
        continue;
      }
    }
    // per anchor, never file-wide: each anchor's lines split into sentences alone, so a Read elsewhere can't answer
    const labelOf = regionLabels(anchorText);
    /** @type {Map<string, string[]>} */
    const byRegion = new Map();
    anchorText.split('\n').forEach((line, i) => {
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
        file: anchorRel,
        detail: `${row.reference} is deferred out of ${row.skill} but step(s) ${missing.join(', ')} carry no sentence that both names its full \${CLAUDE_PLUGIN_ROOT} path and says Read - a de-preloaded reference that arm never Reads is unreachable from it (${row.anchors.length - missing.length} of ${row.anchors.length} anchors satisfied)`,
      });
    }
  }
  return issues;
}
