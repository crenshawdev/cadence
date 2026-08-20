// @ts-check
// adjudication-record.mjs - the ONE statement of what a gate fire's
// adjudication record may hold, and the ONE derivation of the counts a reader
// recomputes from it.
//
// THE DEFECT IT CLOSES. A blocking or adjudicated gate settled its findings and
// then summarized itself: the trace kept `<n> survivors of <m> raised` and the
// bodies were never written anywhere. Nobody could recount the survivors, and a
// refutation - the ruling that DELETES a finding - could not be checked against
// the code it claimed to refute, because the claim it refuted was gone by the
// time anyone asked. This module states the shape that makes both mechanical:
// one entry per finding RAISED per raising voice, carrying the raising voice,
// its model, the severity as raised, and the claim and failure scenario as the
// bytes the reviewer returned.
//
// WHY THE PAYLOAD CARRIES BOTH SIDES. Every voice's block holds the reviewer's
// RETURNED findings object verbatim AND the rulings over it, and each ruling
// restates the claim and failure scenario it is ruling on. The restatement is
// not stored - the entry is always copied from the returned side - it exists
// only to be COMPARED. Without a second copy this module has nothing to check a
// paraphrase against, and a paraphrase is the whole tampering surface: a record
// whose stored claim is the adjudicator's summary of the finding rather than
// the reviewer's own words cannot settle a disagreement about what was said.
// So a ruling whose restatement differs by one byte is REFUSED, and the pairing
// is checked twice over - by index and by text - so a ruling attached to the
// wrong finding cannot store the right words under the wrong ruling.
//
// ONE ENTRY PER RAISING VOICE, NEVER ONE PER MERGED FINDING. Two voices raising
// the same finding leave TWO entries, each naming its own voice, with
// convergence DERIVED and marked on both. Collapsing them makes "the raising
// voice" a list and a reviewer's individual hit rate underivable, which is the
// measurable form of this project's claim that its controls are fallible
// machinery. Convergence is never asserted by the caller: the module can see
// every voice in the fire, so it computes the mark itself.
//
// THE RECORD STORES NO COUNT OF ITS OWN. `deriveCounts` recomputes the
// survived, downgraded and refuted totals from the rulings on every read. A
// stored count is a second place for the record to disagree with itself, and
// the cross-check that matters is between the RECORD and the TRACE receipt, not
// between a record and its own header.
//
// FAIL CLOSED ON EVERY UNREADABLE INPUT. Every arm below answers `ok: false`
// with a detail naming the entry and the rule it broke; there is no best-effort
// entry list, because a record silently missing the one finding whose payload
// was malformed is exactly the summarizing this module exists to end.
//
// Pure in the sense lib/report-rotation.mjs and lib/lease-grammar.mjs are -
// classify, never emit, no fs, no git, no env, no process, no randomness. The
// seam that calls it owns every I/O decision, including the git citation check
// and the SHA resolution its entries are decorated with. It takes no CONTRACTS
// row and no CLI entry point, for the reason self-verify.mjs check 14 states
// about `lib/*.mjs`: they are modules prose never invokes.
//
// ONE FLAT RETURN ON BOTH PATHS, never a JSDoc discriminated union: this repo's
// CI typecheck runs `strict: false`, where narrowing a union by its boolean
// literal does not happen, so the union costs every caller a cast. The reason
// is `resolveRange`'s in planning.mjs, and this follows it.
'use strict';

/**
 * The severity vocabulary a finding may be RAISED at.
 *
 * Carried here as this module's own frozen list rather than imported from
 * review-provider.mjs, and PINNED against that file's `FINDING_SCHEMA` enum by
 * adjudication-record.test.mjs - the same hand-maintained-then-compared shape
 * route-table.json states its reason for on `risk_surface_categories`. The
 * import would drag a 1300-line provider module, its network client included,
 * into a pure classifier; the test is what stops the two lists drifting.
 */
export const RAISED_SEVERITIES = Object.freeze(['blocker', 'high', 'medium', 'low']);

/**
 * The three rulings, and deliberately no fourth.
 *
 * There is no `unadjudicated` value: a finding with no ruling is a REFUSAL, not
 * a ruling of its own, because the record's premise is one entry per finding
 * raised and an unruled finding cannot be silently absent from it.
 */
export const RULINGS = Object.freeze(['survived', 'downgraded', 'refuted']);

/** `FINDING_SCHEMA`'s own bound on a cited path. */
const MAX_FILE_CHARS = 1024;
/** `FINDING_SCHEMA`'s own bound on claim and failure_scenario. */
const MAX_TEXT_CHARS = 2000;

/**
 * A fix commit as an auditor has to be able to spend it: `git show <value>`.
 *
 * Abbreviated spellings are accepted because that is what a commit id looks
 * like everywhere else in this tree's records; blank and non-hexadecimal are
 * refused, because a string that cannot be a commit id fails the auditor
 * exactly as an absent one does. AC3 bounds only ABSENCE; this is the wider
 * reading, recorded as a decision rather than inherited silently.
 */
const FIX_COMMIT = /^[0-9a-fA-F]{7,40}$/;

/**
 * A JSON object, as opposed to null, an array or a scalar.
 *
 * Declared as a TYPE PREDICATE rather than a plain boolean: `buildEntries`
 * takes `unknown`, and without the predicate the guard narrows nothing and
 * every field read past it is a TS2339 under this repo's `checkJs` CI
 * typecheck (measured).
 *
 * @param {unknown} v
 * @returns {v is Record<string, any>}
 */
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isText = (v) => typeof v === 'string' && v.trim() !== '';

/**
 * The keys a payload object may carry, per level. Unknown keys are REFUSED
 * rather than ignored, the disposition `FINDING_SCHEMA` already takes with
 * `additionalProperties: false`: a payload whose `fix_commit` is spelled
 * `fix_comit` must be told, not quietly stored as a `survived` entry with no
 * fix commit at all.
 */
const VOICE_KEYS = ['voice', 'model', 'returned', 'rulings'];
const FINDING_KEYS = ['file', 'line', 'severity', 'claim', 'failure_scenario'];
const RULING_KEYS = ['finding', 'ruling', 'claim', 'failure_scenario', 'counter_evidence', 'fix_commit'];
const EVIDENCE_KEYS = ['file', 'line', 'note'];

/**
 * The first key `obj` carries that `allowed` does not name, or ''.
 * @param {Record<string, any>} obj
 * @param {string[]} allowed
 * @returns {string}
 */
function unknownKey(obj, allowed) {
  for (const k of Object.keys(obj)) if (!allowed.includes(k)) return k;
  return '';
}

/** @returns {{raised: number, survived: number, downgraded: number, refuted: number}} */
function emptyCounts() {
  return { raised: 0, survived: 0, downgraded: 0, refuted: 0 };
}

/** A refusal, as the one flat shape. @param {string} detail */
const no = (detail) => ({ ok: false, detail, entries: [], voices: [], counts: emptyCounts() });

/**
 * The counts, DERIVED by counting rulings over an entry list.
 *
 * Exported separately so a reader can recount a record it did not write: that
 * is the whole recomputability claim, and it is only true if the counting runs
 * over the STORED entries rather than over the payload that produced them.
 * Anything that is not one of the three rulings is counted in `raised` and in
 * no ruling bucket, so a hand-edited record cannot inflate a bucket by
 * inventing a fourth word.
 *
 * @param {unknown} entries
 * @returns {{raised: number, survived: number, downgraded: number, refuted: number}}
 */
export function deriveCounts(entries) {
  const counts = emptyCounts();
  if (!Array.isArray(entries)) return counts;
  for (const e of entries) {
    counts.raised += 1;
    if (!isPlainObject(e)) continue;
    if (e.ruling === 'survived') counts.survived += 1;
    else if (e.ruling === 'downgraded') counts.downgraded += 1;
    else if (e.ruling === 'refuted') counts.refuted += 1;
  }
  return counts;
}

/**
 * The convergence key: `file`, `line` and `claim` - the same triple
 * references/review-triggers.md's panel arm already dedupes an exact repeat on.
 * NUL-joined, so no field's own content can spell another field's boundary.
 * @param {{file: string, line: number, claim: string}} f
 */
const convergenceKey = (f) => `${f.file}\u0000${f.line}\u0000${f.claim}`;

/**
 * Classify one composed adjudication payload.
 *
 * @param {unknown} payload the object the orchestrator composed: `{voices: [
 *   {voice, model, returned: {findings: [...]}, rulings: [...]} ]}`, where
 *   `returned` is the reviewer's own object VERBATIM and each ruling names the
 *   finding it rules by index and restates that finding's claim and failure
 *   scenario so they can be compared.
 * @returns {{ok: boolean, detail: string, entries: any[], voices: any[], counts: {raised: number, survived: number, downgraded: number, refuted: number}}}
 *   `ok: false` names the entry and the rule it broke. `ok: true` carries one
 *   entry per finding raised per raising voice, in each voice's own returned
 *   order, the roster of voices that RAN, and the counts derived from the
 *   rulings.
 */
export function buildEntries(payload) {
  if (!isPlainObject(payload)) return no('payload is not a JSON object');
  const badTopKey = unknownKey(payload, ['voices']);
  if (badTopKey) return no(`payload carries an unknown key: ${badTopKey}`);
  const voices = payload.voices;
  if (!Array.isArray(voices) || voices.length === 0) {
    return no('payload.voices must be a non-empty array - one block per voice that RAN');
  }

  /** @type {any[]} */
  const entries = [];
  // The ROSTER, separately from the entries, because a fire where every voice
  // returned nothing has no entries at all - the `gate_pass` case - and a
  // record that cannot say which voices ran is not evidence that anything ran.
  // references/review-triggers.md calls the voice list load-bearing for exactly
  // that reason: the survivor count alone cannot show a panel silently reduced
  // to one voice while the gate reports clean. No per-voice COUNT rides it -
  // that is derived from the entries, like every other figure here.
  /** @type {any[]} */
  const roster = [];
  /** @type {Set<string>} */
  const seenVoices = new Set();

  for (let v = 0; v < voices.length; v += 1) {
    const block = voices[v];
    const at = `voices[${v}]`;
    if (!isPlainObject(block)) return no(`${at} is not an object`);
    const badKey = unknownKey(block, VOICE_KEYS);
    if (badKey) return no(`${at} carries an unknown key: ${badKey}`);
    if (!isText(block.voice)) return no(`${at}.voice must name the reviewer that ran`);
    if (!isText(block.model)) return no(`${at}.model must name the model that voice used`);
    // Two blocks under one voice name would make convergence read as agreement
    // between a voice and itself, and would double that voice's hit rate.
    if (seenVoices.has(block.voice)) return no(`${at}.voice ${block.voice} appears twice`);
    seenVoices.add(block.voice);
    roster.push({ voice: block.voice, model: block.model });

    const returned = block.returned;
    if (!isPlainObject(returned)) {
      return no(`${at}.returned must be the reviewer's returned object, verbatim`);
    }
    const badReturnedKey = unknownKey(returned, ['findings']);
    if (badReturnedKey) {
      return no(`${at}.returned carries an unknown key: ${badReturnedKey} - it must be the `
        + '{findings: [...]} object the reviewer returned and nothing else');
    }
    const findings = returned.findings;
    if (!Array.isArray(findings)) return no(`${at}.returned.findings must be an array`);
    const rulings = block.rulings;
    if (!Array.isArray(rulings)) return no(`${at}.rulings must be an array`);

    // Every finding validated against the same bounds FINDING_SCHEMA states,
    // because only the cross-model arm has a schema between the reviewer and
    // here: references/review-triggers.md has a `claude-subagent` voice's
    // return parsed by the model, so on that arm this is the only validation
    // the raised finding ever gets.
    for (let i = 0; i < findings.length; i += 1) {
      const f = findings[i];
      const fat = `${at}.returned.findings[${i}]`;
      if (!isPlainObject(f)) return no(`${fat} is not an object`);
      const badFindingKey = unknownKey(f, FINDING_KEYS);
      if (badFindingKey) return no(`${fat} carries an unknown key: ${badFindingKey}`);
      if (!isText(f.file) || f.file.length > MAX_FILE_CHARS) {
        return no(`${fat}.file must be a non-blank path of at most ${MAX_FILE_CHARS} characters`);
      }
      if (!Number.isSafeInteger(f.line) || f.line < 1) {
        return no(`${fat}.line must be an integer of at least 1`);
      }
      if (!RAISED_SEVERITIES.includes(f.severity)) {
        return no(`${fat}.severity must be one of ${RAISED_SEVERITIES.join(' | ')}`);
      }
      for (const key of ['claim', 'failure_scenario']) {
        if (!isText(f[key]) || f[key].length > MAX_TEXT_CHARS) {
          return no(`${fat}.${key} must be non-blank and at most ${MAX_TEXT_CHARS} characters`);
        }
      }
    }

    // The pairing, by INDEX: a ruling names the finding it rules. Both
    // directions are refusals - a ruling naming no returned finding is a ruling
    // over nothing, and a returned finding with no ruling would be silently
    // absent from a record whose premise is one entry per finding RAISED.
    /** @type {Map<number, any>} */
    const byFinding = new Map();
    for (let r = 0; r < rulings.length; r += 1) {
      const ruling = rulings[r];
      const rat = `${at}.rulings[${r}]`;
      if (!isPlainObject(ruling)) return no(`${rat} is not an object`);
      const badRulingKey = unknownKey(ruling, RULING_KEYS);
      if (badRulingKey) return no(`${rat} carries an unknown key: ${badRulingKey}`);
      const idx = ruling.finding;
      if (!Number.isSafeInteger(idx) || idx < 0 || idx >= findings.length) {
        return no(`${rat}.finding names no returned finding: ${JSON.stringify(idx)} is not an `
          + `index into the ${findings.length} findings ${block.voice} returned`);
      }
      if (byFinding.has(idx)) return no(`${rat}.finding ${idx} is ruled twice`);
      byFinding.set(idx, ruling);

      if (!RULINGS.includes(ruling.ruling)) {
        return no(`${rat}.ruling must be one of ${RULINGS.join(' | ')}, got `
          + `${JSON.stringify(ruling.ruling)}`);
      }
      // THE VERBATIM COMPARISON. The restatement is compared and discarded; the
      // entry below is copied from the RETURNED side either way, so a paraphrase
      // can never reach the record - it is refused before one is built.
      const f = findings[idx];
      for (const key of ['claim', 'failure_scenario']) {
        if (typeof ruling[key] !== 'string') {
          return no(`${rat}.${key} must restate the finding's ${key} verbatim so it can be compared`);
        }
        if (ruling[key] !== f[key]) {
          return no(`${rat}.${key} is not byte-identical to the ${key} ${block.voice} returned at `
            + `finding ${idx} - the record stores the reviewer's own words, never a restatement`);
        }
      }
      if (ruling.ruling === 'refuted') {
        const ev = ruling.counter_evidence;
        if (!isPlainObject(ev)) {
          return no(`${rat} is refuted and carries no counter_evidence - a refutation names the `
            + 'code that contradicts the claim, or there is nothing to audit it against');
        }
        const badEvidenceKey = unknownKey(ev, EVIDENCE_KEYS);
        if (badEvidenceKey) {
          return no(`${rat}.counter_evidence carries an unknown key: ${badEvidenceKey}`);
        }
        if (!isText(ev.file) || ev.file.length > MAX_FILE_CHARS) {
          return no(`${rat}.counter_evidence.file must name the contradicting code`);
        }
        if (ev.line !== undefined && (!Number.isSafeInteger(ev.line) || ev.line < 1)) {
          return no(`${rat}.counter_evidence.line must be an integer of at least 1 when present`);
        }
        if (ev.note !== undefined && !isText(ev.note)) {
          return no(`${rat}.counter_evidence.note must be non-blank when present`);
        }
      }
      if (ruling.ruling === 'survived') {
        if (typeof ruling.fix_commit !== 'string' || !FIX_COMMIT.test(ruling.fix_commit)) {
          return no(`${rat} survived and carries no usable fix_commit - an auditor runs git show `
            + `on that value, so ${JSON.stringify(ruling.fix_commit)} fails them exactly as an `
            + 'absent one does');
        }
      }
    }
    for (let i = 0; i < findings.length; i += 1) {
      if (!byFinding.has(i)) {
        return no(`${at}.returned.findings[${i}] has no ruling - the record holds one entry per `
          + 'finding RAISED, so an unruled finding cannot be absent from it');
      }
    }

    // Emitted in the reviewer's OWN returned order, never the rulings' order:
    // the returned side is the verbatim half, and the record reads in the order
    // the voice raised things.
    for (let i = 0; i < findings.length; i += 1) {
      const f = findings[i];
      const ruling = byFinding.get(i);
      entries.push({
        voice: block.voice,
        model: block.model,
        file: f.file,
        line: f.line,
        severity: f.severity,
        claim: f.claim,
        failure_scenario: f.failure_scenario,
        ruling: ruling.ruling,
        convergent: false,
        ...(ruling.counter_evidence ? { counter_evidence: ruling.counter_evidence } : {}),
        ...(ruling.fix_commit ? { fix_commit: ruling.fix_commit } : {}),
      });
    }
  }

  // CONVERGENCE IS DERIVED, NEVER ASSERTED, and never collapsed: both entries
  // stay, each naming its own voice, and both are marked. A finding one voice
  // raised twice is not convergence - the mark counts distinct VOICES.
  /** @type {Map<string, Set<string>>} */
  const raisedBy = new Map();
  for (const e of entries) {
    const key = convergenceKey(e);
    const set = raisedBy.get(key) || new Set();
    set.add(e.voice);
    raisedBy.set(key, set);
  }
  for (const e of entries) {
    const voicesForKey = raisedBy.get(convergenceKey(e));
    e.convergent = Boolean(voicesForKey && voicesForKey.size > 1);
  }

  return { ok: true, detail: '', entries, voices: roster, counts: deriveCounts(entries) };
}
