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
 *   deviation?: string, review?: string,
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
