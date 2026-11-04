// @ts-check
// The surfaced half of the read-back count: given the recall envelope a planner was handed, which prior decisions, captures, deviations and UAT findings it puts in front of it. cite-cited.mjs is the other half and planning.mjs's `cite-count` joins the two.
// The rule lives in a module, not a handler, because nothing measured whether the record "comes back on its own", and the number is only worth having if the rule producing it is stated.
// The envelope is a file a caller wrote, so nothing is trusted: a row that isn't an object or has no `source` contributes nothing and is reported, never thrown on or silently dropped. No I/O, emit, exit, clock or refusal sentences here.
// Count `results`, never `total`: recall --top defaults to 5 while total is how many rows matched, and counting against it caps the citation rate near 1% on a set the planner never saw.
// A row whose source starts `phases/<the queried spelling>/` is the phase's own context, summary or UAT, which the plan workflow already reads into the dispatch prompt. A plan trivially cites its own context, so admitting those rows would read near 100% and the zero case could never fire.
// Archived same-numbered rows stay in by construction: an ARCHIVE.md row's source is `<label>/phases/<n>/...` and an archived directory's row is its own directory, so neither starts with `phases/`. That's why the check tests the prefix instead of searching for the segment.
// Only a decision carries an id: parseContextDecisions pushes the bullet with its `- ` stripped, so a context snippet begins with its D-NN and the id is readable from text recall already returned. Capture and deviation snippets carry none, so those arms are unjoinable, reported as such rather than as zero.
// An id is never synthesized from corpus position, since numbering the rows would change the answer whenever a bullet is added above one.
// A decision's phase is the `<n>` of the `phases/<n>/` segment of its own source, not the row's `phase` field (for an ARCHIVE.md row that names the phase inside the retired milestone). Every source recall emits has that segment, but a hand-written archived path doesn't, so it reaches the surfaced set with no phase and is unjoinable. Widening to any numeric segment could join it to the wrong phase, and a scoping rule that guesses is worse than one that abstains.
'use strict';

/** The trailing artifact name of a source, mapped to its arm: the four cmdRecall builds its corpus from and nothing else, since a fifth would be a corpus change. */
const ARTIFACT_KINDS = Object.freeze({
  'CONTEXT.md': 'decision',
  'CAPTURE.md': 'capture',
  'SUMMARY.md': 'deviation',
  'UAT.md': 'uat',
});

/** The arms in the fixed order the caller emits them; decision is the only joinable one. */
export const SURFACED_KINDS = Object.freeze(['decision', 'capture', 'deviation', 'uat']);

/** `phases/<n>/` anywhere in a source, `<n>` the integer-or-decimal phase shape. */
const SOURCE_PHASE = /(?:^|\/)phases\/(\d+(?:\.\d+)?)\//;

/** The id at the head of a context snippet, on the same number shape as parseContextDecisions. Anchored so a D-NN later in another decision's prose isn't read as this row's id. */
const DECISION_ID = /^(D-\d+(?:\.\d+)?)\b/;

/**
 * The surfaced set: the recall rows a plan for `ownPhase` could cite.
 *
 * @param {unknown} envelope a parsed recall envelope (`{results: [...]}`)
 * @param {unknown} ownPhase the queried phase's OWN spelling, as the caller typed it
 * @returns {{
 *   rows: Array<{source: string, kind: string, id?: string, number?: string, phase?: string}>,
 *   unkinded: string[],
 *   malformed: number,
 * }} `rows` are the kinded, own-phase-excluded rows in envelope order; `unkinded` names every source
 *   matching none of the four artifacts, reported instead of binned so the breakdown keeps adding up to the headline;
 *   `malformed` is how many rows weren't usable objects.
 */
export function surfacedRows(envelope, ownPhase) {
  const results = envelope && typeof envelope === 'object' && Array.isArray(envelope['results'])
    ? envelope['results']
    : [];
  // the caller's own spelling, so a decimal phase like 1.10 excludes `phases/1.10/` and not the 1.1 rows; an unusable spelling gives a prefix no source can start with instead of an exclusion that quietly matches nothing
  const own = typeof ownPhase === 'string' || typeof ownPhase === 'number' ? String(ownPhase) : '';
  const ownPrefix = `phases/${own}/`;

  const rows = [];
  const unkinded = [];
  let malformed = 0;

  for (const row of results) {
    if (!row || typeof row !== 'object' || Array.isArray(row) || typeof row['source'] !== 'string' || !row['source']) {
      malformed += 1;
      continue;
    }
    const source = row['source'];
    if (own !== '' && source.startsWith(ownPrefix)) continue;

    const artifact = source.slice(source.lastIndexOf('/') + 1);
    const kind = ARTIFACT_KINDS[artifact];
    if (!kind) { unkinded.push(source); continue; }
    if (kind !== 'decision') { rows.push({ source, kind }); continue; }

    // the snippet is the row's own text, so a row with none just has no id: still a surfaced decision, read as uncited, the honest answer for a row nothing can join to
    const snippet = typeof row['snippet'] === 'string' ? row['snippet'] : '';
    const id = DECISION_ID.exec(snippet);
    const phase = SOURCE_PHASE.exec(source);
    rows.push({
      source,
      kind,
      ...(id ? { id: `${source}#${id[1]}`, number: id[1] } : {}),
      ...(phase ? { phase: phase[1] } : {}),
    });
  }

  return { rows, unkinded, malformed };
}
