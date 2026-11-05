// @ts-check
// what a gate fire's adjudication record may hold, and the one derivation of its counts
//
// bodies are stored, not a summary, so a survivor can be recounted and a refutation checked against its code
// each ruling restates the claim and scenario only to compare byte for byte: a paraphrase is the tampering surface
// two voices on the same finding stay two entries, so a reviewer's hit rate can be worked out
// no stored counts: deriveCounts recounts on every read. Pure: no fs, no git, no env
// one flat return on both paths: with `strict: false` in CI a union keyed on the boolean doesn't narrow
'use strict';

import { isPlainObject } from './text-util.mjs';

/**
 * The severities a finding may be raised at.
 *
 * Our own frozen list rather than an import from review-provider.mjs, whose
 * network client would come along into a pure classifier. The test pins it
 * against that file's `FINDING_SCHEMA` enum so the two can't drift.
 */
export const RAISED_SEVERITIES = Object.freeze(['blocker', 'high', 'medium', 'low']);

/**
 * The two severities a blocking gate halts over, and the only ones asked to
 * name a fix commit when they survive.
 *
 * A copy and not an import, because filing-decision.mjs imports `buildEntries`
 * from here and reading its list back would close a cycle. The test pins it.
 */
export const HALTING_SEVERITIES = Object.freeze(['blocker', 'high']);

/**
 * The three rulings, and deliberately no fourth.
 *
 * `survived` means the finding stood, fixed or not. Raised at blocker or high,
 * its entry names the fix commit; raised below that, it was confirmed and not
 * fixed and carries no commit because none exists. Without this reading the
 * only way to store the unfixed remainder was to downgrade it, which records
 * "the adjudicator lowered it" over "it stood and nobody fixed it".
 *
 * A finding with no ruling is a refusal, not a fourth value.
 */
export const RULINGS = Object.freeze(['survived', 'downgraded', 'refuted']);

/**
 * A gate fire's record filename. The writer, the receipt recount and the
 * deferred queue's supersession test must all name the same file, or a recount
 * reads another fire's rulings and passes whenever two rounds' counts happen to
 * match. Round 1 keeps the sibling `REVIEW-<trigger>-<discriminator>.md` name;
 * later rounds carry `-rN` so a re-arm lands beside round one.
 *
 * @param {string} trigger @param {string} discriminator @param {number} round
 */
export const recordName = (trigger, discriminator, round) =>
  `ADJUDICATION-${trigger}-${discriminator}${round > 1 ? `-r${round}` : ''}.json`;

/** `FINDING_SCHEMA`'s own bound on a cited path. */
const MAX_FILE_CHARS = 1024;
/** `FINDING_SCHEMA`'s own bound on claim and failure_scenario. */
const MAX_TEXT_CHARS = 2000;

/**
 * A fix commit an auditor can spend with `git show <value>`. Abbreviated is fine, blank and non-hex are refused.
 * The value check runs wherever the key is set, on every ruling and severity, since a junk id fails `git show` the
 * same on a refuted entry as a survived one. Only presence is conditional: a survived finding raised at a halting
 * severity must carry the key. Presence means set, not truthy: `''` and `null` are present and malformed.
 */
const FIX_COMMIT = /^[0-9a-fA-F]{7,40}$/;

/**
 * `overridden` is the second way a survived blocker or high settles.
 *
 * An override leaves a blocker or high standing unfixed, which the presence
 * rule above refuses. Before this marker the only way to write that record was
 * to downgrade the finding or invent a commit id, and both are false.
 *
 * It's a marker, not a reason: the user's words already ride the `override`
 * receipt, and a second copy on the entry could drift.
 *
 * Only the boolean `true` is accepted, wherever the key is set. A truthy string
 * would buy a clear nobody stated, and `false` is what absence already says.
 */
const OVERRIDE_MARKER = true;

const isText = (v) => typeof v === 'string' && v.trim() !== '';

/**
 * The keys a payload object may carry, per level. Unknown keys are refused, as
 * `FINDING_SCHEMA` does, so a `fix_comit` typo gets told instead of stored as a
 * survivor with no fix commit.
 */
const VOICE_KEYS = ['voice', 'model', 'returned', 'rulings'];
const FINDING_KEYS = ['file', 'line', 'severity', 'claim', 'failure_scenario'];
const RULING_KEYS = ['finding', 'ruling', 'claim', 'failure_scenario', 'counter_evidence', 'fix_commit', 'overridden'];
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
 * The counts, derived by counting rulings over an entry list. Exported so a
 * reader can recount a record it didn't write, from the stored entries and not
 * the payload. Anything outside the three rulings counts as raised only, so a
 * hand-edited record can't inflate a bucket with a fourth word.
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
 * One raised finding against `FINDING_SCHEMA`'s bounds: '' when it passes, else
 * the detail naming the broken rule, prefixed with `at`.
 *
 * Exported because the deferred queue stores the same bytes, and two copies of
 * these bounds would let the queue hold a shape the record refuses, found only
 * at adjudication time. It runs at all because a `claude-subagent` voice's
 * return is parsed by the model, so this is the only validation that arm gets.
 *
 * @param {unknown} f @param {string} at the payload path, for the detail
 * @returns {string}
 */
export function findingIssue(f, at) {
  if (!isPlainObject(f)) return `${at} is not an object`;
  const badFindingKey = unknownKey(f, FINDING_KEYS);
  if (badFindingKey) return `${at} carries an unknown key: ${badFindingKey}`;
  if (!isText(f.file) || f.file.length > MAX_FILE_CHARS) {
    return `${at}.file must be a non-blank path of at most ${MAX_FILE_CHARS} characters`;
  }
  if (!Number.isSafeInteger(f.line) || f.line < 1) {
    return `${at}.line must be an integer of at least 1`;
  }
  if (!RAISED_SEVERITIES.includes(f.severity)) {
    return `${at}.severity must be one of ${RAISED_SEVERITIES.join(' | ')}`;
  }
  for (const key of ['claim', 'failure_scenario']) {
    if (!isText(f[key]) || f[key].length > MAX_TEXT_CHARS) {
      return `${at}.${key} must be non-blank and at most ${MAX_TEXT_CHARS} characters`;
    }
  }
  return '';
}

/**
 * The convergence key: `file`, `line` and `claim`, the triple the panel arm
 * dedupes an exact repeat on. NUL-joined so no field can spell another's
 * boundary.
 * @param {{file: string, line: number, claim: string}} f
 */
const convergenceKey = (f) => `${f.file}\u0000${f.line}\u0000${f.claim}`;

/**
 * Classify one composed adjudication payload.
 *
 * @param {unknown} payload the orchestrator's `{voices: [
 *   {voice, model, returned: {findings: [...]}, rulings: [...]} ]}`; `returned`
 *   is the reviewer's own object verbatim, and each ruling names its finding by
 *   index and restates the claim and failure scenario for comparison.
 * @returns {{ok: boolean, detail: string, entries: any[], voices: any[], counts: {raised: number, survived: number, downgraded: number, refuted: number}}}
 *   `ok: false` names the entry and the rule it broke. `ok: true` carries one
 *   entry per finding per raising voice in returned order, the roster of voices
 *   that ran, and the counts derived from the rulings.
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
  // the roster is separate: a fire where every voice returned nothing has no entries, but the record must say who ran
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
    // the same voice twice would make convergence a voice agreeing with itself and double its hit rate
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

    // same bounds and words the deferred queue stores a finding against
    for (let i = 0; i < findings.length; i += 1) {
      const issue = findingIssue(findings[i], `${at}.returned.findings[${i}]`);
      if (issue) return no(issue);
    }

    // pair by index, and refuse both directions: a ruling over nothing, or a finding with no ruling silently absent
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
      // compare and discard: the entry is copied from the returned side, so a paraphrase is refused before one exists
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
      if (ruling.overridden !== undefined && ruling.overridden !== OVERRIDE_MARKER) {
        return no(`${rat}.overridden must be the boolean true or be absent, got `
          + `${JSON.stringify(ruling.overridden)} - it is the marker recording that a user `
          + 'OVERRODE a blocking FAIL, so a truthy string would buy a clear nobody stated and '
          + 'false says the finding was not overridden, which absence already says');
      }
      // checked on every ruling that sets the key, or a refuted entry could store a string `git show` can't use
      // `!== undefined` and not truthiness: '' and null are set and malformed
      if (ruling.fix_commit !== undefined
        && (typeof ruling.fix_commit !== 'string' || !FIX_COMMIT.test(ruling.fix_commit))) {
        return no(`${rat} is ${ruling.ruling} and carries no usable fix_commit - an auditor runs `
          + `git show on that value, so ${JSON.stringify(ruling.fix_commit)} fails them exactly `
          + 'as an absent one does');
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
        // gated on the finding's raised severity, since a ruling carries none and a downgrade doesn't restate it
        if (HALTING_SEVERITIES.includes(f.severity)
          && ruling.fix_commit === undefined && ruling.overridden !== OVERRIDE_MARKER) {
          return no(`${rat} survived and carries neither a usable fix_commit nor overridden: `
            + `true - a finding raised at ${HALTING_SEVERITIES.join(' or ')} that STOOD is one a `
            + 'blocking gate is halting over, so its entry either names the commit that fixed it '
            + 'or marks the user override that let it stand. Only those two severities are '
            + 'asked: a survived finding raised below them was confirmed and NOT fixed, and '
            + 'carries no commit id because none exists');
        }
      }
    }
    for (let i = 0; i < findings.length; i += 1) {
      if (!byFinding.has(i)) {
        return no(`${at}.returned.findings[${i}] has no ruling - the record holds one entry per `
          + 'finding RAISED, so an unruled finding cannot be absent from it');
      }
    }

    // returned order, not the rulings' order: the returned side is the verbatim half
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
        // `!== undefined`: the old truthiness read stored `fix_commit: ''` and null as absent under `ok: true`
        ...(ruling.fix_commit !== undefined ? { fix_commit: ruling.fix_commit } : {}),
        // marker alone is legal and leaves no commit id: an override has only a user's reason, so no SHA exists
        ...(ruling.overridden === OVERRIDE_MARKER ? { overridden: true } : {}),
      });
    }
  }

  // derived and never collapsed: a finding one voice raised twice isn't convergence, so the mark counts distinct voices
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
