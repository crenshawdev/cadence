// @ts-check
// cite-surfaced.mjs - the SURFACED half of the read-back count (RBK-01): given
// the recall envelope a planner was actually handed, which prior decisions,
// captures, deviations and UAT findings does that envelope put in front of it.
// lib/cite-cited.mjs is the other half - what the produced plan cites - and
// planning.mjs's `cite-count` joins the two.
//
// WHY THE COUNT NEEDS A MODULE AT ALL. The Core Value claims the record "comes
// back on its own at the moment it matters", and nothing measured it: a planner
// could receive twelve prior decisions and cite none, and no gate noticed. The
// number is only worth having if the rule producing it is stated, so the rule
// lives here and not inside a handler.
//
// THE ENVELOPE IS A FILE A CALLER WROTE (D-03), so every rule below is written
// against input this module does not trust. A row that is not an object, or
// carries no `source`, contributes NOTHING and is REPORTED - never a throw, and
// never a silent drop. Nothing here does I/O, emits, exits, reads a clock or
// mints a refusal sentence; the caller owns every one of those.
//
// FOUR RULES, each with the measurement behind it:
//
//   `results` AND NEVER `total` (D-11). `recall --top` defaults to 5 while
//   `total` is how many rows MATCHED - the reconstructed phase-1 plan-time
//   query returned `total: 441` against 5 results. Counting against `total`
//   would cap the reported citation rate near 1% on a set the planner was never
//   shown, which is a number about the corpus rather than about the plan.
//
//   THE QUERIED PHASE'S OWN ROWS ARE DROPPED (D-04). A row whose `source`
//   starts `phases/<the queried spelling>/` is the phase's own CONTEXT, SUMMARY
//   or UAT, which `workflows/plan.md` reads into the dispatch prompt before the
//   recall call runs. A plan trivially cites its own CONTEXT - 1028 own-phase
//   D-NN mentions measured across this corpus - so admitting those rows reads
//   near-100% on every phase that ran `/cad-context` and the zero case this
//   phase exists to report could never fire. The roadmap goal says PRIOR
//   decisions.
//
//   ARCHIVED SAME-NUMBERED ROWS STAY IN, and they stay in by CONSTRUCTION
//   rather than by a second rule: an ARCHIVE.md row's `source` is
//   `<label>/phases/<n>/...` (`parseArchiveRows` composes it that way) and an
//   `_archive-v*/<N>/` row's is its own directory, so neither starts with
//   `phases/` and the exclusion above never reaches them. That is the whole
//   point of testing the PREFIX instead of searching for the segment.
//
//   ONLY A DECISION CARRIES AN ID (D-02). `parseContextDecisions` pushes
//   `line.replace(/^- /, '')`, so a CONTEXT snippet BEGINS `D-09 (deviation
//   edge): ...` and its id is readable out of the text recall already returned.
//   `parseSummarySnippets` strips `[deviation] ` and returns bare prose;
//   `parseCaptureSnippets` returns `{text, phase?}` with no identifier at all.
//   So the capture and deviation arms are UNJOINABLE, which the caller reports
//   as unjoinable rather than as zero - absence and silence are different
//   answers here as everywhere in this tree.
//
// AN ID IS NEVER SYNTHESIZED FROM CORPUS POSITION (D-02). Numbering the rows
// would make the answer change the moment a bullet is added above one, which is
// the instability `parseArchiveRows`' "ARCHIVE.md LAST, and the position is
// load-bearing" comment exists to avoid. A row with no readable id simply has
// none.
//
// STATED BOUND: a decision's PHASE is the `<n>` of the `phases/<n>/` segment of
// its own `source` (D-10 compares the SOURCE's phase, not the row's `phase`
// field, which for an ARCHIVE.md row names the phase inside the retired
// milestone and for a CAPTURE row is the tag the capture carried). Every source
// `recall` itself can emit carries that segment - `phases/<n>/...` live,
// `<label>/phases/<n>/...` archived - so the rule is total over real envelopes.
// A hand-written `_archive-v3.5.0/2/CONTEXT.md` has no such segment and reaches
// the surfaced set with NO phase, which makes it unjoinable rather than joined
// to the wrong phase. Widening the pattern to "any numeric segment" would join
// `v2/1/CONTEXT.md` to phase 2 or phase 1 depending on which end it read from,
// and a scoping rule that guesses is worse than one that abstains.
'use strict';

/**
 * The trailing artifact name of a `source`, mapped to the arm it reports in.
 * Exactly the four artifacts `cmdRecall` builds its corpus from, and nothing
 * else: a fifth would be a corpus change, which is out of scope for a reader.
 */
const ARTIFACT_KINDS = Object.freeze({
  'CONTEXT.md': 'decision',
  'CAPTURE.md': 'capture',
  'SUMMARY.md': 'deviation',
  'UAT.md': 'uat',
});

/**
 * The arms, in the fixed order the caller emits them. `decision` is the only
 * joinable one; the other three are the unjoinable arms D-02 names.
 */
export const SURFACED_KINDS = Object.freeze(['decision', 'capture', 'deviation', 'uat']);

/** `phases/<n>/` anywhere in a source, `<n>` the integer-or-decimal phase shape. */
const SOURCE_PHASE = /(?:^|\/)phases\/(\d+(?:\.\d+)?)\//;

/**
 * The id at the HEAD of a CONTEXT snippet, on the same number shape
 * `parseContextDecisions` accepts on its own bullets. Anchored, so a `D-NN`
 * later in the prose of some other decision cannot be read as this row's id.
 */
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
 * }} `rows` are the kinded, own-phase-excluded rows in envelope order;
 *   `unkinded` names every source matching none of the four artifacts, which is
 *   REPORTED rather than binned because a row counted in `surfaced` and in no
 *   arm makes the breakdown stop reconciling with the headline; `malformed` is
 *   how many rows were not usable objects at all.
 */
export function surfacedRows(envelope, ownPhase) {
  const results = envelope && typeof envelope === 'object' && Array.isArray(envelope['results'])
    ? envelope['results']
    : [];
  // The caller's own spelling, so `--phase 1.10` excludes `phases/1.10/` and
  // not phase 1.1's rows. An unusable spelling yields a prefix no source can
  // start with rather than an exclusion that silently reaches nothing.
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

    // The snippet is the row's own text, so a row that carries none simply has
    // no id - it stays a surfaced decision and reads as uncited, which is the
    // honest answer for a row nothing can join to.
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
