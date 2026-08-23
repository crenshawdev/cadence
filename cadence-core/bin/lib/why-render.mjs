// @ts-check
// why-render.mjs - the deterministic renderer and the entry cap for
// `/cad-why` (WHY-01, phase 1 plan 1). A second pure module beside
// lib/why-query.mjs: no disk, no emit, no exit, no Date.now, no randomness.
// It turns an array of chain entries into the ONE `text` string the seam
// emits (CONTEXT D-02) plus the counts the envelope carries.
//
// ORDERING IS EXPLICIT, NEVER INHERITED (D-17). `renderChain` sorts a COPY of
// its input by commit date, then by full 40-character sha, both descending -
// newest first, and a full-sha comparison as the tiebreak rather than trusting
// git's own order or a filesystem listing. That is what makes two entries
// sharing one commit date, or the same array handed in reversed, render
// byte-identically: the order is a property of the DATA, computed here, and
// never of the order the caller happened to collect it in.
//
// FULL SHAS TRAVEL, THE ABBREVIATION IS DERIVED. Each entry carries its full
// 40-character sha; the rendered commit line shows both the full sha and an
// 8-character abbreviation a reader can type back - 8 rather than a shorter
// prefix because that is the length the newest SUMMARY convention already
// uses (CONTEXT D-08), so a sha this command prints and a sha a SUMMARY's
// `## Commits` table prints are the same number of characters to eyeball
// against each other.
//
// EVERY JOIN FIELD IS EXPLICITLY STATED, NEVER OMITTED. `phase`, `task`,
// `decision`, `deviation` and `review` are each optional on an entry; when one
// is absent this module renders a FIXED stated-absence line for it rather than
// dropping the line, because AC5 requires a chain with no `.planning/` join to
// come back with each field stated absent - never a shorter entry and never an
// empty chain. Plans 2 and 3 fill these fields with quoted record text; this
// plan ships the five placeholder lines they will replace.
//
// THE ENTRY CAP IS D-13'S SECOND ARM. Raw `git log` bytes already cross the
// 10,000-byte threshold `references/conventions.md` states on two of four
// sampled paths (`planning.mjs` at 21,684 B over 144 commits), and every join
// field this module will grow to carry only adds bytes per entry - so the
// response is bounded by TRUNCATING THE ENTRY COUNT rather than by relocating
// the bytes to a file, which is what `lib/bulk-output.mjs`'s register does for
// the three call shapes it watches (none of which is this seam). The shape is
// `cmdRecall`'s `--top`: a stated default of 10 and the untruncated `total`
// riding beside the `shown` count, so a truncated answer stays legible as
// truncated. `total` is chosen here and recorded with its reason - ten entries
// is the band that stays under the byte threshold once each entry carries its
// joins, on the same 21,684 B / 144-commit ratio the default was measured
// against.
//
// THAT LAST SENTENCE IS NOW MEASURED FALSE, and is left standing with its
// correction rather than quietly edited, because the number it justifies has
// not moved. With plan 2's six join fields filled, `/cad-why
// cadence-core/bin/lib/capture-file.mjs` renders 10,137 B over EIGHT entries
// (seven of them joined), measured 2026-08-23 - already past the 10,000-byte
// threshold, and a full ten joined entries would be around 13 KB. The cap is
// still D-13's satisfied arm (that decision reads "registers in
// lib/bulk-output.mjs OR the command carries a default entry cap") and lowering
// it is a re-decision with its own cost - a smaller default hides history a
// reader asked for - so the default stays 10 and the discrepancy is recorded
// here for whoever makes that call.
//
// THE TRUNCATION NOTE LIVES INSIDE `text`, not only in the envelope. D-02 has
// the skill relay `text` verbatim and reformat nothing, so a truncated answer
// that only the JSON envelope's `shown`/`total` fields recorded would never
// reach a reader - the skill never prints those fields. The note is therefore
// the last line of `text` itself when the chain was actually cut.
//
// ---------------------------------------------------------------------------
// PLAN 2 ADDS THE JOIN, AND IT ATTACHES IN EXACTLY ONE PLACE: `entry.join`.
//
// The seam resolves each commit against `lib/why-corpus.mjs`'s index and hangs
// ONE plain, serializable object off the entry; the `field*` functions below
// turn that object into the label lines. Every later edge - the D-NN decision,
// the deviation bullets, the surviving review finding, the declaring task -
// adds a KEY to that object and a formatter here, never a second traversal of
// the chain and never a second attach point.
//
// A LITERAL STRING ON THE ENTRY STILL WINS. `entry.phase` and its four siblings
// are read FIRST and the join is only consulted when they are absent, so a
// caller holding a rendered string (the plan-1 shape, and every test that
// builds an entry by hand) keeps working unchanged. That is not back-compat
// ceremony: it is what keeps this module's contract "a field is a string or it
// is stated absent", with the join as one way to compute the string rather than
// a second rendering path.
//
// AND THE STATED ABSENCE IS UNCHANGED. A field the join cannot fill still
// renders `not yet joined` rather than disappearing, because AC5 requires a
// path in history with no `.planning/` join to come back as a chain with each
// field stated absent - never a shorter entry, and never an empty chain.
'use strict';

import { MARKER_GAP } from './why-record.mjs';

/** The default entry cap (D-13). */
export const DEFAULT_TOP = 10;

/** The fixed text an absent join field renders as, rather than dropping the
 * line. A field the record does not carry says so; it is never dropped. */
const NOT_JOINED = 'not yet joined';

/** Characters of the full sha the rendered commit line's abbreviation carries
 * (D-08: the length the newest SUMMARY convention already uses). */
const ABBREV_LEN = 8;

/**
 * @typedef {{
 *   label: string, milestone: string, phase: string,
 *   plan: string, task: string, description: string,
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

/**
 * The `phase:` line - the milestone and the phase number READ OFF the resolved
 * directory's own name, never derived from the commit's conventional-commit
 * scope (D-06). An ambiguous resolution names every candidate rather than
 * picking one, because picking is the invisible failure the index exists to
 * remove.
 * @param {EntryJoin} [j] @returns {string|undefined}
 */
function fieldPhase(j) {
  if (!j) return undefined;
  if (j.state === 'ambiguous') {
    const named = (j.matches || []).map(candidate).join('; ');
    return `AMBIGUOUS - ${(j.matches || []).length} records name this commit: ${named}`;
  }
  if (j.state !== 'resolved') return undefined;
  return `${j.milestone} phase ${j.phase} (${j.label})`;
}

/**
 * The `plan task:` line - the commits table's own plan, task and description
 * cells, quoted as the record wrote them. The task cell is NEVER integerized:
 * `fix 1` is a real value in shipped summaries.
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
 * A label line followed by the record's OWN lines, indented under it. The
 * indent is the only byte this module adds to a quoted line: it is what keeps a
 * multi-line quote readable as one field's value rather than as five more
 * fields, and it is fixed rather than computed so two runs render it the same.
 * @param {string} label @param {string[]} lines @returns {string}
 */
function quoted(label, lines) {
  return [label, ...lines.map((l) => `  ${l}`)].join('\n');
}

/** How each decision scope announces itself. `phase` is the one that must not
 * pass itself off as a task-level fact (D-10). */
const DECISION_SCOPE = Object.freeze({
  task: (/** @type {string[]} */ ids) => `cited by this task (${ids.join(', ')})`,
  plan: (/** @type {string[]} */ ids) => `PHASE-SCOPED - cited by the plan's ## Context, not by this task (${ids.join(', ')})`,
  phase: () => 'PHASE-SCOPED - neither the task nor the plan cites a decision, so every decision this phase recorded is listed',
});

/**
 * The `decision:` line (D-10). The scope is announced BEFORE the quoted lines,
 * because a phase-scoped answer presenting itself as a task-level one is the
 * specific wrong this edge exists to avoid.
 * @param {EntryJoin} [j] @returns {string|undefined}
 */
function fieldDecision(j) {
  const d = j && /** @type {any} */ (j).decision;
  if (!d || !d.lines || !d.lines.length) return undefined;
  const announce = DECISION_SCOPE[d.scope];
  if (!announce) return undefined;
  return quoted(announce(d.ids || []), d.lines);
}

/** What an entry says when its phase recorded no deviation at all. It is a
 * statement about the SUMMARY, never about whether a decision was refuted -
 * `MARKER_GAP`, printed beside it, is what carries that. */
const NO_DEVIATION_BULLETS = "(this phase's SUMMARY records no deviation)";

/**
 * The `deviation:` line (D-09). ALWAYS phase-scoped and ALWAYS carrying
 * `MARKER_GAP`: the deviation-refutes-a-decision edge does not exist in
 * machine-readable form, and an entry that quietly printed "none" would be
 * reporting the absence of a refutation when what is actually absent is the
 * marker that could have recorded one.
 * @param {EntryJoin} [j] @returns {string|undefined}
 */
function fieldDeviation(j) {
  const d = j && /** @type {any} */ (j).deviation;
  if (!d || !Array.isArray(d.bullets)) return undefined;
  const bullets = d.bullets.length ? d.bullets.map((/** @type {string} */ b) => `- ${b}`) : [NO_DEVIATION_BULLETS];
  return quoted(`PHASE-SCOPED - ${MARKER_GAP}`, bullets);
}

/**
 * One surviving finding, quoted in the reviewer's own returned words (D-11).
 * `counter_evidence` is optional in the record and is omitted when absent
 * rather than rendered empty - it is the adjudicator's note, not a field every
 * entry has.
 * @param {any} f @returns {string[]}
 */
function findingLines(f) {
  const where = [f.file, f.line].filter((v) => v !== null && v !== undefined && v !== '').join(':');
  const head = [f.severity ? `[${f.severity}]` : null, where || null, `(${f.record})`]
    .filter(Boolean).join(' ');
  const out = [head, `claim: ${f.claim}`, `failure_scenario: ${f.failure_scenario}`];
  if (f.counter_evidence) out.push(`counter_evidence: ${f.counter_evidence}`);
  return out;
}

/**
 * The `review:` line (D-11). Three distinct answers, because they are three
 * different facts: this phase kept no adjudication record; it kept records and
 * none of their survivors covers this commit; and a survivor exists whose
 * `base_id..head_id` does not resolve in this clone, so whether it covers this
 * commit is UNKNOWN. The third is never collapsed into the second - a finding
 * dropped for want of a resolvable range would read as a finding that does not
 * apply.
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
 * The `declared by:` line (D-12) - which task's `- **Files:**` line claimed the
 * queried path, and through which declaration, since a directory lease claims a
 * file it does not name. It is a SIXTH join field, and it obeys the same rule
 * as the other five: stated when known, stated absent when not, never dropped.
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
 * Sort a COPY of `entries` newest first: commit date descending, full sha
 * descending as the tiebreak. Never mutates its argument.
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
 * Render `entries` into the one `text` string the seam emits, plus the counts
 * its envelope carries beside it and the SORTED, CAPPED entries themselves -
 * why.mjs (task 3) carries both `text` and `entries` on its envelope (D-02),
 * and returning the already-sorted slice here is what keeps the sort a single
 * computation rather than a second copy of it in the seam.
 *
 * @param {ChainEntry[]} entries @param {{top?: number}} [opts]
 * @returns {{text: string, shown: number, total: number, entries: ChainEntry[]}}
 */
export function renderChain(entries, opts = {}) {
  const top = Number.isInteger(opts.top) && opts.top > 0 ? opts.top : DEFAULT_TOP;
  const sorted = sortEntries(entries);
  const total = sorted.length;
  const capped = sorted.slice(0, top);

  if (capped.length === 0) return { text: 'No commits in this chain.', shown: 0, total, entries: [] };

  let text = capped.map(renderEntry).join('\n\n');
  if (total > capped.length) {
    text += `\n\nShowing ${capped.length} of ${total} commit(s). Pass --top ${total} to see the rest.`;
  }
  return { text, shown: capped.length, total, entries: capped };
}
