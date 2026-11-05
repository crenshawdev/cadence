// @ts-check
// deterministic renderer and entry cap for /cad-why. Pure: no disk, emit, exit, Date.now or randomness.
// the cap bounds entry count, not bytes: join fields are unbounded, and lowering it only hides history
// six is the largest cap that keeps the worst measured path under the 10,000-byte line; seven goes over
// MEASURED CAP: 6 entries, 2026-08-23.
// why-render.test.mjs checks that line against DEFAULT_TOP
// the truncation note and exclusion block live inside text because the skill relays text verbatim
'use strict';

import { MARKER_GAP } from './why-record.mjs';

/** The default entry cap; the MEASURED CAP line in the header is pinned to this number by why-render.test.mjs. */
export const DEFAULT_TOP = 6;

/** The fixed text an absent join field renders as; a field the record doesn't carry says so and is never dropped. */
const NOT_JOINED = 'not yet joined';

/** Characters of the sha in the rendered abbreviation: the newest SUMMARY convention's length, easy to eyeball. */
const ABBREV_LEN = 8;

/**
 * @typedef {{
 *   label: string, milestone: string, phase: string,
 *   plan: string, task: string, description: string,
 *   recovered?: {prune: string, parent: string, tree: string},
 *   slug?: string,
 * }} JoinMatch
 * @typedef {{
 *   state: 'resolved'|'ambiguous'|'unresolved',
 *   matches?: JoinMatch[],
 * } & Partial<JoinMatch>} EntryJoin
 * @typedef {{
 *   sha: string, date: string, subject: string,
 *   phase?: string, task?: string, decision?: string,
 *   deviation?: string, review?: string, declared?: string,
 *   join?: EntryJoin,
 * }} ChainEntry
 */

/** One ambiguous candidate, as the entry names it when it refuses to pick. */
const candidate = (/** @type {JoinMatch} */ m) =>
  `${m.label} (plan ${m.plan || '-'}, task ${m.task || '-'})`;

/** How many ARCHIVE.md residue rows and touched paths an unresolved entry prints before counting the rest. */
const GAP_ROWS = 3;
const GAP_PATHS = 10;

/** What an unresolved entry leads with, naming the lookups that failed rather than just "not joined". */
const GAP = 'NOT RESOLVED - no phase directory on disk and no summary recovered from git '
  + 'history names this commit, so the record does not say which phase produced it';

/** How many excluded commits the block names before counting the rest, like GAP_ROWS. */
const EXCLUDED_ROWS = 3;

/** One capped list, with the remainder counted rather than dropped. */
function capped(items, limit) {
  const out = items.slice(0, limit).map((i) => `  ${i}`);
  if (items.length > limit) out.push(`  ... and ${items.length - limit} more`);
  return out;
}

/**
 * The gap block: every line is a fact git carries or the record carries under a label. None names a phase number;
 * the commit-message scope, the one that looks like one, is printed as explicitly not the answer.
 * @param {any} g @returns {string}
 */
function gapLines(g) {
  const lines = [];
  if (g.close) {
    lines.push(g.close.label
      ? `the gap sits under the close at ${g.close.commit.slice(0, ABBREV_LEN)}, labelled ${g.close.label}`
      : `the gap sits under the close at ${g.close.commit.slice(0, ABBREV_LEN)}, which bound no milestone label`);
  } else {
    lines.push('no close has pruned this commit yet, so no milestone label covers the gap');
  }
  lines.push(g.scope
    ? `commit-message scope: ${g.scope} - read off the subject line as corroboration and `
      + 'explicitly NOT a resolved phase, because those numbers reset every milestone (D-06)'
    : 'the commit message carries no conventional-commit scope to corroborate with');
  if (g.paths && g.paths.length) {
    lines.push(`git records ${g.paths.length} path(s) touched by this commit:`, ...capped(g.paths, GAP_PATHS));
  } else {
    lines.push('git records no paths touched by this commit');
  }
  if (g.archive && g.archive.length) {
    lines.push(`.planning/ARCHIVE.md keeps ${g.archive.length} residue row(s) under that label, `
      + 'bound to the label and to no commit (D-04):',
    ...capped(g.archive.map((/** @type {any} */ r) => `${r.origin}: ${r.text}`), GAP_ROWS));
  }
  return quoted(GAP, lines);
}

/**
 * What git's history simplification left out, stated in `text` because the skill relays `text` verbatim.
 * An empty report renders nothing; a line stating a non-event costs bytes on every query for no information.
 * The merge count comes from the parent lists in the report, never asserted.
 * @param {{sha: string, parentCount: number}[]} excluded
 * @param {string} [path] the queried path, named in the invocation line
 * @returns {string}
 */
function excludedBlock(excluded, path) {
  const merges = excluded.filter((e) => e.parentCount > 1).length;
  const head = `${excluded.length} commit(s) also touched this path and are NOT listed above. `
    + "Git's default history simplification dropped them, and this chain keeps that "
    + 'simplification because --follow, which is how it tracks renames, requires it. '
    + `${merges} of them ${merges === 1 ? 'is a merge' : 'are merges'}.`;
  const rows = capped(excluded.map((e) => `${e.sha.slice(0, ABBREV_LEN)} (${e.parentCount} parent(s))`),
    EXCLUDED_ROWS);
  const run = `  see them with: git log --full-history --${path ? ` ${path}` : ' <path>'}`;
  return [head, ...rows, run].join('\n');
}

/**
 * The `phase:` line: milestone and phase number read off the resolved directory's name, never the commit scope.
 * An ambiguous resolution names every candidate; picking one is the invisible failure the index exists to remove.
 * A task tier answer names its slug and says so, with no phase or milestone: `tasks phase <slug>` reads as a phase.
 * @param {EntryJoin} [j] @returns {string|undefined}
 */
function fieldPhase(j) {
  if (!j) return undefined;
  if (j.state === 'ambiguous') {
    const named = (j.matches || []).map(candidate).join('; ');
    return `AMBIGUOUS - ${(j.matches || []).length} records name this commit: ${named}`;
  }
  if (j.state === 'unresolved') return /** @type {any} */ (j).gap ? gapLines(/** @type {any} */ (j).gap) : undefined;
  if (j.state !== 'resolved') return undefined;
  // the slug marker, never a label prefix; phase and milestone are null on this tier anyway
  if (j.slug) return `off-roadmap task ${j.slug} - a /cad-task run, not a roadmap phase (${j.label})`;
  // a recovered resolution says where it came from, since the directory no longer exists
  // the milestone rides beside the phase number because one number under two milestones is two different phases
  const where = /** @type {any} */ (j).recovered;
  if (where) return `${j.milestone} phase ${j.phase} (recovered from ${where.parent.slice(0, 8)}:${where.tree})`;
  return `${j.milestone} phase ${j.phase} (${j.label})`;
}

/**
 * The `plan task:` line: the commits table's plan, task and description cells as written. Task is never an integer,
 * since `fix 1` is a real value. A task record has no Plan column, so `j.plan` is `''` and the `plan ` prefix drops.
 * @param {EntryJoin} [j] @returns {string|undefined}
 */
function fieldTask(j) {
  if (!j || j.state !== 'resolved') return undefined;
  const plan = j.plan ? `plan ${j.plan}, ` : '';
  const task = j.task ? `task ${j.task}` : 'task unnamed';
  const description = j.description ? ` - ${j.description}` : '';
  return `${plan}${task}${description}`;
}

/**
 * A label line followed by the record's own lines, indented under it. The indent is the only byte added,
 * and it keeps a multi-line quote readable as one field's value.
 * @param {string} label @param {string[]} lines @returns {string}
 */
function quoted(label, lines) {
  return [label, ...lines.map((l) => `  ${l}`)].join('\n');
}

/** How each decision scope announces itself. `phase` must not pass itself off as a task-level fact. */
const DECISION_SCOPE = Object.freeze({
  task: (/** @type {string[]} */ ids) => `cited by this task (${ids.join(', ')})`,
  plan: (/** @type {string[]} */ ids) => `PHASE-SCOPED - cited by the plan's ## Context, not by this task (${ids.join(', ')})`,
  phase: () => 'PHASE-SCOPED - neither the task nor the plan cites a decision, so every decision this phase recorded is listed',
});

/**
 * The `decision:` line. The scope comes first: a phase-scoped answer posing as task-level is the wrong this avoids.
 * @param {EntryJoin} [j] @returns {string|undefined}
 */
function fieldDecision(j) {
  const d = j && /** @type {any} */ (j).decision;
  if (!d || !d.lines || !d.lines.length) return undefined;
  const announce = DECISION_SCOPE[d.scope];
  if (!announce) return undefined;
  return quoted(announce(d.ids || []), d.lines);
}

/** What an entry says when its phase recorded no deviation: about the SUMMARY, not about any refuted decision. */
const NO_DEVIATION_BULLETS = "(this phase's SUMMARY records no deviation)";

/**
 * The `deviation:` line: always phase-scoped, always with MARKER_GAP. No machine-readable deviation-refutes-decision
 * edge exists, so "none" would report no refutation when what's absent is the marker that could record one.
 * @param {EntryJoin} [j] @returns {string|undefined}
 */
function fieldDeviation(j) {
  const d = j && /** @type {any} */ (j).deviation;
  if (!d || !Array.isArray(d.bullets)) return undefined;
  const bullets = d.bullets.length ? d.bullets.map((/** @type {string} */ b) => `- ${b}`) : [NO_DEVIATION_BULLETS];
  return quoted(`PHASE-SCOPED - ${MARKER_GAP}`, bullets);
}

/**
 * One surviving finding in the reviewer's own words. `counter_evidence` is the adjudicator's note, omitted when absent.
 * `fix:` is printed on every survivor, even empty: a finding confirmed and left standing has no commit id, and without
 * line it would render like a fixed one. "Left standing" is exactly what /cad-why exists to surface.
 * The commit id is there for an auditor to `git show`, which is why adjudication-record.mjs validates the value.
 * @param {any} f @returns {string[]}
 */
function findingLines(f) {
  const where = [f.file, f.line].filter((v) => v !== null && v !== undefined && v !== '').join(':');
  const head = [f.severity ? `[${f.severity}]` : null, where || null, `(${f.record})`]
    .filter(Boolean).join(' ');
  const out = [head, `claim: ${f.claim}`, `failure_scenario: ${f.failure_scenario}`];
  if (f.counter_evidence) out.push(`counter_evidence: ${f.counter_evidence}`);
  out.push(f.fix_commit
    ? `fix: ${f.fix_commit}`
    : 'fix: none - confirmed and left standing');
  return out;
}

/**
 * The `review:` line has three answers: no adjudication record in this phase; no survivor covers this commit;
 * or a survivor's `base_id..head_id` doesn't resolve here, so coverage is unknown, never collapsed into the second.
 * Whether a survivor was fixed is drawn one level down, where findingLines prints `fix:`.
 * @param {EntryJoin} [j] @returns {string|undefined}
 */
function fieldReview(j) {
  const r = j && /** @type {any} */ (j).review;
  if (!r) return undefined;
  if (!r.records) return "no adjudication record in this phase's directory";

  const lines = [];
  for (const f of r.findings) lines.push(...findingLines(f));
  for (const f of r.unresolved) {
    lines.push(...findingLines(f),
      `  join UNRESOLVABLE: ${f.baseId || '(no base_id)'}..${f.headId || '(no head_id)'} `
      + 'does not resolve in this clone, so whether it covers this commit is unknown');
  }
  if (!lines.length) {
    return `${r.records} adjudication record(s) read; no surviving finding covers this commit`;
  }
  const kept = r.findings.length;
  const unknown = r.unresolved.length;
  const head = `${kept} surviving finding(s) cover this commit`
    + (unknown ? `, and ${unknown} more could not be placed` : '');
  return quoted(head, lines);
}

/**
 * The `declared by:` line: which task's `- **Files:**` line claimed the queried path, and through which declaration,
 * since a directory lease claims a file it doesn't name. Stated when known, stated absent when not.
 * @param {EntryJoin} [j] @returns {string|undefined}
 */
function fieldDeclared(j) {
  const d = j && /** @type {any} */ (j).declared;
  if (!d) return undefined;
  if (!d.planFile) return "no plan file for this task's plan in the phase directory";
  if (!d.tasks.length) return `no task in ${d.planFile} declares this path`;
  return quoted(`declared in ${d.planFile}`, d.tasks.map(
    (/** @type {any} */ t) => `task ${t.ordinal}: ${t.title} (declares ${t.declaration})`,
  ));
}

/**
 * Fill every join field the entry does not already carry as a literal string.
 * Never mutates its argument.
 * @param {ChainEntry} e @returns {ChainEntry}
 */
function decorate(e) {
  const j = e.join;
  if (!j) return e;
  return {
    ...e,
    phase: e.phase ?? fieldPhase(j),
    task: e.task ?? fieldTask(j),
    decision: e.decision ?? fieldDecision(j),
    deviation: e.deviation ?? fieldDeviation(j),
    review: e.review ?? fieldReview(j),
    declared: e.declared ?? fieldDeclared(j),
  };
}

/**
 * Sort a copy of `entries` newest first: commit date descending, full sha descending as tiebreak. Never mutates.
 * @param {ChainEntry[]} entries @returns {ChainEntry[]}
 */
function sortEntries(entries) {
  return [...entries].sort((a, b) => {
    const ta = Date.parse(a.date);
    const tb = Date.parse(b.date);
    if (ta !== tb) return tb - ta;
    if (a.sha === b.sha) return 0;
    return a.sha > b.sha ? -1 : 1;
  });
}

/** @param {ChainEntry} raw @returns {string} */
function renderEntry(raw) {
  const e = decorate(raw);
  const abbrev = e.sha.slice(0, ABBREV_LEN);
  return [
    `commit ${e.sha} (${abbrev})`,
    `date: ${e.date}`,
    `subject: ${e.subject}`,
    `phase: ${e.phase ?? NOT_JOINED}`,
    `plan task: ${e.task ?? NOT_JOINED}`,
    `decision: ${e.decision ?? NOT_JOINED}`,
    `deviation: ${e.deviation ?? NOT_JOINED}`,
    `review: ${e.review ?? NOT_JOINED}`,
    `declared by: ${e.declared ?? NOT_JOINED}`,
  ].join('\n');
}

/**
 * Render `entries` into the one `text` string the seam emits, plus the envelope's counts and the sorted, capped list.
 * `excluded` is the simplification report. Absent or empty renders nothing; it comes before the truncation note so
 * the `Pass --top` line stays last.
 *
 * @param {ChainEntry[]} entries
 * @param {{top?: number, excluded?: {sha: string, parentCount: number}[]|null, path?: string}} [opts]
 * @returns {{text: string, shown: number, total: number, entries: ChainEntry[]}}
 */
export function renderChain(entries, opts = {}) {
  const top = Number.isInteger(opts.top) && opts.top > 0 ? opts.top : DEFAULT_TOP;
  const sorted = sortEntries(entries);
  const total = sorted.length;
  const capped = sorted.slice(0, top);

  if (capped.length === 0) return { text: 'No commits in this chain.', shown: 0, total, entries: [] };

  let text = capped.map(renderEntry).join('\n\n');
  const excluded = Array.isArray(opts.excluded) ? opts.excluded : [];
  if (excluded.length) text += `\n\n${excludedBlock(excluded, opts.path)}`;
  if (total > capped.length) {
    text += `\n\nShowing ${capped.length} of ${total} commit(s). Pass --top ${total} to see the rest.`;
  }
  return { text, shown: capped.length, total, entries: capped };
}
