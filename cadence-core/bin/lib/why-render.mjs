// @ts-check
// Deterministic renderer and entry cap for /cad-why. Pure: no disk, no emit, no exit, no Date.now, no randomness. It turns chain entries into the one `text` string the seam emits plus the counts its envelope carries.
// Ordering is explicit, never inherited: renderChain sorts a copy by commit date then full sha, both descending, so two entries sharing a date, or the same array reversed, render byte-identically.
// Every join field is stated, never omitted. When phase, task, decision, deviation or review is absent the entry renders a fixed stated-absence line instead of dropping it, so a chain with no .planning/ join is never a shorter entry or an empty chain.
// The join attaches in one place, entry.join: a plain serializable object the seam hangs off each entry, which the field* functions turn into label lines. Every later edge adds a key and a formatter, never a second traversal. A literal string on the entry still wins, so hand-built entries work unchanged.
// The cap truncates entry count because raw git log bytes already cross the 10,000-byte threshold in conventions.md on two of four sampled paths, and every join field adds more. It follows cmdRecall's --top: a stated default plus the untruncated total beside shown, so a truncated answer reads as truncated.
// The cap doesn't bound the response in bytes. Join fields are unbounded, so a path with few commits and heavy joins crosses the line at any cap that shows its history at all. Lowering the cap only hides the history a reader asked for; relocating the bytes is the real fix and isn't this cap's job.
// Six is the largest cap under which the worst of the three paths measured (capture-file.mjs, issue-decision.mjs, planning.mjs) stays under the 10,000-byte line, with all six join edges filled and the exclusion block rendering; at seven the worst renders over it.
// MEASURED CAP: 6 entries, 2026-08-23.
// why-render.test.mjs parses that line and asserts it equals DEFAULT_TOP, then renders the frozen worst case in fixtures/why.chain-worst.json at the default and one above, so it goes red when the number and its stated reason disagree.
// The truncation note and the exclusion block live inside text, not only the envelope, because the skill relays text verbatim and never prints the envelope fields. The exclusion block goes before the truncation note so the Pass --top line stays last, and an absent or empty report renders nothing, since a line stating a non-event is bytes on every query for no information.
'use strict';

import { MARKER_GAP } from './why-record.mjs';

/** The default entry cap, the largest one measurement supports. See the MEASURED CAP line in this module's header, which why-render.test.mjs parses and pins against this number. */
export const DEFAULT_TOP = 6;

/** The fixed text an absent join field renders as; a field the record doesn't carry says so and is never dropped. */
const NOT_JOINED = 'not yet joined';

/** Characters of the full sha in the rendered abbreviation: the length the newest SUMMARY convention uses, so the two are easy to eyeball against each other. */
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

/** How many ARCHIVE.md residue rows and touched paths an unresolved entry prints before it counts the rest. Both are unbounded in the corpus, and the response is bounded by counting, not by relocating bytes. */
const GAP_ROWS = 3;
const GAP_PATHS = 10;

/** The sentence an unresolved entry leads with. It names which lookups failed, because "not joined" alone doesn't say whether the record is missing or the reader is. */
const GAP = 'NOT RESOLVED - no phase directory on disk and no summary recovered from git '
  + 'history names this commit, so the record does not say which phase produced it';

/** How many excluded commits the block names before it counts the rest, the same disposition as GAP_ROWS; the block names the invocation a reader runs to see all of them. */
const EXCLUDED_ROWS = 3;

/** One capped list, with the remainder counted rather than dropped. */
function capped(items, limit) {
  const out = items.slice(0, limit).map((i) => `  ${i}`);
  if (items.length > limit) out.push(`  ... and ${items.length - limit} more`);
  return out;
}

/**
 * The gap block. Everything in it is either a fact git carries or a fact the record carries under a label. No line names a phase number, and the one number that looks like one, the commit-message scope, is printed with the statement that it's not the answer.
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
 * What git's default history simplification left out, stated in `text` and not only the envelope, for the same reason the truncation note is: the skill relays `text` verbatim, so a gap only the JSON recorded would never reach a reader.
 * An empty report renders nothing at all. A chain with nothing excluded must not grow a line stating a non-event, which is bytes on every query for no information and lands on the entry cap.
 * The merge count is counted from the parent lists the report carries, never asserted: a block saying `--full-history` buys merges without counting would be repeating a measurement instead of making it.
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
 * The `phase:` line: the milestone and phase number read off the resolved directory's own name, never derived from the commit's conventional-commit scope. An ambiguous resolution names every candidate instead of picking one, because picking is the invisible failure the index exists to remove.
 * A resolved task is not a phase. A commit the off-roadmap tasks tier answered names its slug and says so in words, with no phase number or milestone, because a task directory rendering as `tasks phase <slug>` reads as a phase and is a wrong answer instead of a missing one.
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
  // the slug marker, never a label prefix: buildTaskIndex puts it on the directory descriptor so this arm needs no opinion about how a label is spelled. phase and milestone are null on this tier, so the line below couldn't render them anyway
  if (j.slug) return `off-roadmap task ${j.slug} - a /cad-task run, not a roadmap phase (${j.label})`;
  // a recovered resolution says where it was recovered from, since the directory no longer exists and a reader couldn't otherwise tell the two apart. The milestone rides beside the phase number on both tiers because one number under two milestones is two different phases wearing the same label
  const where = /** @type {any} */ (j).recovered;
  if (where) return `${j.milestone} phase ${j.phase} (recovered from ${where.parent.slice(0, 8)}:${where.tree})`;
  return `${j.milestone} phase ${j.phase} (${j.label})`;
}

/**
 * The `plan task:` line: the commits table's own plan, task and description cells, quoted as the record wrote them. The task cell is never integerized, since `fix 1` is a real value in shipped summaries.
 * No arm is needed for a task record: its table has no Plan column, so `j.plan` is `''` and the `plan ` prefix drops by the same rule the three-column SUMMARY era needs.
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
 * A label line followed by the record's own lines, indented under it. The indent is the only byte this module adds to a quoted line; it keeps a multi-line quote readable as one field's value instead of five more fields, and it's fixed so two runs render it the same.
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
 * The `decision:` line. The scope is announced before the quoted lines, because a phase-scoped answer presenting itself as a task-level one is the specific wrong this edge exists to avoid.
 * @param {EntryJoin} [j] @returns {string|undefined}
 */
function fieldDecision(j) {
  const d = j && /** @type {any} */ (j).decision;
  if (!d || !d.lines || !d.lines.length) return undefined;
  const announce = DECISION_SCOPE[d.scope];
  if (!announce) return undefined;
  return quoted(announce(d.ids || []), d.lines);
}

/** What an entry says when its phase recorded no deviation: a statement about the SUMMARY, never about whether a decision was refuted. MARKER_GAP, printed beside it, carries that. */
const NO_DEVIATION_BULLETS = "(this phase's SUMMARY records no deviation)";

/**
 * The `deviation:` line: always phase-scoped and always carrying MARKER_GAP. The deviation-refutes-a-decision edge doesn't exist in machine-readable form, and an entry that quietly printed "none" would report the absence of a refutation when what's absent is the marker that could have recorded one.
 * @param {EntryJoin} [j] @returns {string|undefined}
 */
function fieldDeviation(j) {
  const d = j && /** @type {any} */ (j).deviation;
  if (!d || !Array.isArray(d.bullets)) return undefined;
  const bullets = d.bullets.length ? d.bullets.map((/** @type {string} */ b) => `- ${b}`) : [NO_DEVIATION_BULLETS];
  return quoted(`PHASE-SCOPED - ${MARKER_GAP}`, bullets);
}

/**
 * One surviving finding, quoted in the reviewer's own returned words. `counter_evidence` is the adjudicator's note and is omitted when absent instead of rendered empty.
 * `fix:` is printed on every survivor, absent value and all, the one line here not omitted when the record carries nothing. A survived finding raised at blocker or high names the commit that fixed it; one raised below was confirmed and not fixed and has no commit id. Same ruling, so without this line the two render identically and a reader can't tell a fix that landed from a finding the gate confirmed and moved past. Omitting it would make absence the statement, and "this was left standing" is exactly the fact /cad-why exists to surface.
 * The commit id is printed where one exists because an auditor runs `git show` on it, which is why adjudication-record.mjs validates the value and not merely its presence.
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
 * The `review:` line. Three distinct answers, because they're three different facts: this phase kept no adjudication record; it kept records and none of their survivors covers this commit; and a survivor exists whose `base_id..head_id` doesn't resolve in this clone, so whether it covers this commit is unknown. The third is never collapsed into the second, since a finding dropped for want of a resolvable range would read as one that doesn't apply.
 * Whether a survivor was fixed isn't a fourth answer. It's drawn one level down, on the survivor line, where findingLines prints `fix:`. A confirmed-and-unfixed finding still covers this commit and belongs in `kept`, so the head sentence is unchanged.
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
 * The `declared by:` line: which task's `- **Files:**` line claimed the queried path, and through which declaration, since a directory lease claims a file it doesn't name. It's the sixth join field and obeys the same rule as the other five: stated when known, stated absent when not, never dropped.
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
 * Sort a copy of `entries` newest first: commit date descending, full sha descending as the tiebreak. Never mutates its argument.
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
 * Render `entries` into the one `text` string the seam emits, plus the counts its envelope carries and the sorted, capped entries themselves. Returning the already-sorted slice is what keeps the sort one computation instead of a second copy in the seam.
 * `excluded` is the seam's simplification report: the commits a `--full-history` comparand carries and this chain doesn't. Absent or empty renders nothing, and when it renders it goes before the truncation note so the `Pass --top` line stays last on a truncated chain.
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
