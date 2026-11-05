// @ts-check
// the surfaced half of the read-back count: what recall put in front of the planner
// count `results`, never `total`: --top defaults to 5, and total counts rows the planner never saw
// the phase's own `phases/<spelling>/` rows are already in the prompt; counting them reads near 100%
// archived same-numbered rows stay in: their source never starts with `phases/`
// only a decision carries an id, read off its snippet; the other arms are reported unjoinable, not zero
// a decision's phase comes from `phases/<n>/` in its own source; without that segment it's unjoinable, not guessed
'use strict';

/** A source's trailing artifact name mapped to its arm: the four cmdRecall builds its corpus from, and no more. */
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

/** The id at the head of a context snippet. Anchored, so a D-NN later in another decision's prose isn't this row's. */
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
  // the caller's own spelling, so 1.10 excludes `phases/1.10/` and not 1.1; an unusable one matches nothing
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

    // a row with no snippet has no id: still a surfaced decision, read as uncited
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
