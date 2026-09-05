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
 * `lib/surface-scan.mjs` states its reason for on `CATEGORIES`. The
 * import would drag a 1300-line provider module, its network client included,
 * into a pure classifier; the test is what stops the two lists drifting.
 */
export const RAISED_SEVERITIES = Object.freeze(['blocker', 'high', 'medium', 'low']);

/**
 * The two severities a BLOCKING gate halts over - the only ones asked to name a
 * fix commit when they survive.
 *
 * Carried as this module's own frozen list rather than imported from
 * lib/filing-decision.mjs, where the same pair drives `unfixedFindings`, and
 * PINNED against that file by adjudication-record.test.mjs. The import cannot
 * be taken in this direction at all: filing-decision.mjs imports
 * `buildEntries` from HERE, so reading its list back would close a cycle. So
 * this is the same hand-maintained-then-compared shape `RAISED_SEVERITIES`
 * above already carries against review-provider.mjs, for the same reason - the
 * test is what stops the two drifting.
 */
export const HALTING_SEVERITIES = Object.freeze(['blocker', 'high']);

/**
 * The three rulings, and deliberately no fourth.
 *
 * WHAT `survived` MEANS: the finding STOOD - fixed or not. A `survived`
 * finding RAISED at blocker or high is one a blocking gate is halting to fix,
 * so its entry names the fix commit an auditor spends. A `survived` finding
 * raised BELOW them is one that was confirmed and NOT fixed - reported, moved
 * past, and carrying no commit id because none exists. Both are the same
 * ruling read against the raised severity, which is why there is no fourth
 * value for the unfixed remainder.
 *
 * That remainder is what a blocking gate leaves behind on nearly every fire,
 * and before it was representable here the only way to store it was to
 * DOWNGRADE the finding - which records "the adjudicator lowered it" over "it
 * stood and nobody fixed it". Converting a reported-and-moved-past finding into
 * a passed one is the exact substitution this record exists to prevent, so the
 * record had to be able to hold the state rather than the coordinator having to
 * misreport it.
 *
 * There is no `unadjudicated` value: a finding with no ruling is a REFUSAL, not
 * a ruling of its own, because the record's premise is one entry per finding
 * raised and an unruled finding cannot be silently absent from it.
 */
export const RULINGS = Object.freeze(['survived', 'downgraded', 'refuted']);

/**
 * A gate fire's record filename, as ONE rule every side resolves by.
 *
 * The writer (`planning.mjs`'s `adjudication` seam), the receipt recount in
 * `cmdTrace` and the deferred queue's supersession test have to name the same
 * file, or a cross-check reads a different fire's rulings than the one being
 * settled - and the failure of that is SILENT, since a recount against round
 * one's record passes whenever the two rounds' counts happen to coincide. Round
 * 1 keeps the sibling `REVIEW-<trigger>-<discriminator>.md`'s exact name; every
 * round above it carries its round, so a re-arm lands beside round one rather
 * than on top of it.
 *
 * It lives HERE rather than in the seam that writes it for the reason the rest
 * of this module does: the name is part of what a record IS, and a second
 * spelling of it in a second file is two files with one meaning.
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
 * A fix commit as an auditor has to be able to spend it: `git show <value>`.
 *
 * Abbreviated spellings are accepted because that is what a commit id looks
 * like everywhere else in this tree's records; blank and non-hexadecimal are
 * refused, because a string that cannot be a commit id fails the auditor
 * exactly as an absent one does. AC3 bounds only ABSENCE; this is the wider
 * reading, recorded as a decision rather than inherited silently.
 *
 * TWO SEPARATE RULES OVER THIS KEY, and only one of them is conditional at
 * all. The VALUE check runs wherever the key is SET, on EVERY ruling and at
 * every severity: a junk id fails `git show` identically whether the entry
 * ruled `survived`, `downgraded` or `refuted`, and whether it was raised at a
 * blocker or at a low. `RULING_KEYS` stays one flat allow-list and the key
 * stays representable on a non-survived ruling - a fix that landed while the
 * finding was being downgraded is a real thing to record - so this validates
 * the key there rather than forbidding it. What the RAISED severity gates is
 * the PRESENCE requirement, and only on a `survived` ruling: only
 * `HALTING_SEVERITIES` are asked to carry the key at all, because only they
 * are the findings a blocking gate is halting to fix, and a
 * confirmed-unfixed medium has no commit to name. A medium that DOES name one
 * still has it checked and still stores it: a voluntary fix is allowed to cite
 * itself.
 *
 * PRESENCE MEANS THE KEY IS SET, never that its value is truthy. `fix_commit:
 * ''` and `fix_commit: null` are present and malformed, and reading them as
 * absent would drop the refusal on exactly the values an auditor cannot run
 * `git show` on.
 */
const FIX_COMMIT = /^[0-9a-fA-F]{7,40}$/;

/**
 * `overridden` - the second way a survived blocker or high settles.
 *
 * A user can OVERRIDE a blocking gate's FAIL, and an override is by definition
 * a blocker or high that stood UNFIXED. That is the exact shape the presence
 * requirement above keeps refusing, so before this marker existed an overridden
 * fire had no adjudication record at all: the `override` receipt landed on the
 * trace with no rulings beside it, and the only way to write the record was to
 * downgrade the finding or invent a commit id. Both are false statements about
 * what happened, and this key exists so neither is needed.
 *
 * IT IS A MARKER, NOT A REASON. The user's own words already ride the
 * `override` receipt through `--detail-file` - see references/triage-gate.md -
 * and a second copy on the entry is a second statement that can drift, so the
 * ruling carries only the fact.
 *
 * ONLY THE BOOLEAN `true` IS ACCEPTED, wherever the key is set and whatever the
 * ruling. A truthy string would buy a clear nobody stated; `false` says the
 * finding was NOT overridden, which is what absence already says without adding
 * a key to the record. The check is not scoped to `survived` or to a severity,
 * for the same reason the `fix_commit` VALUE check is not: a key this module
 * stores has to mean one thing everywhere it appears. What IS scoped is what
 * the marker BUYS - it satisfies the presence requirement, and nothing else.
 */
const OVERRIDE_MARKER = true;

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
 * One RAISED finding against the bounds `FINDING_SCHEMA` states: '' when it
 * passes, or the detail naming the rule it broke, prefixed with `at`.
 *
 * Exported because the adjudication record is not the only artifact that stores
 * a raised finding verbatim - the deferred queue stores the same bytes, and a
 * queue member is triaged later against the record that supersedes it. Two
 * copies of these bounds is two answers to "is this a finding", and the queue
 * would then hold a shape the record refuses, discovered only at adjudication
 * time when the reviewer's return is long gone.
 *
 * Validated at all because only the cross-model arm has a schema between the
 * reviewer and here: references/review-triggers.md has a `claude-subagent`
 * voice's return parsed by the model, so on that arm this is the only
 * validation a raised finding ever gets.
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

    // Every finding validated through `findingIssue` above - the same bounds,
    // in the same words, that the deferred queue stores a finding against.
    for (let i = 0; i < findings.length; i += 1) {
      const issue = findingIssue(findings[i], `${at}.returned.findings[${i}]`);
      if (issue) return no(issue);
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
      if (ruling.overridden !== undefined && ruling.overridden !== OVERRIDE_MARKER) {
        return no(`${rat}.overridden must be the boolean true or be absent, got `
          + `${JSON.stringify(ruling.overridden)} - it is the marker recording that a user `
          + 'OVERRODE a blocking FAIL, so a truthy string would buy a clear nobody stated and '
          + 'false says the finding was not overridden, which absence already says');
      }
      // The VALUE check, on EVERY ruling and unconditional: whenever the key is
      // SET it has to be spendable. Hoisted out of the `survived` arm below,
      // where it let a `downgraded` or `refuted` entry store an arbitrary
      // unspendable string that an auditor's `git show` can do nothing with.
      // Presence is `!== undefined` and never truthiness - '' and null are
      // set-and-malformed, and reading them as absent would drop this refusal
      // on the very values that fail an auditor. This does not forbid the key
      // on a non-survived ruling; `RULING_KEYS` stays flat and it is merely
      // validated there.
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
        // The PRESENCE requirement, gated on the RAISED severity, read off the
        // FINDING and never off the ruling: a ruling carries no severity at
        // all, and a `downgraded` one deliberately does not restate a new
        // level, so the raised severity is the only one there is to read. The
        // VALUE check that used to sit above this one is HOISTED out of this
        // arm - see the `fix_commit` guard before the `refuted` block - because
        // it was never a property of the ruling, only of the key.
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
        // `!== undefined`, never truthiness: this module's rule is that PRESENCE
        // MEANS THE KEY IS SET, and the truthiness read here was the silent drop
        // site - `fix_commit: ''` and `fix_commit: null` were stored as ABSENT
        // under an `ok:true`. After the hoist above the two forms are
        // behaviour-identical, because no falsy value reaches this line.
        ...(ruling.fix_commit !== undefined ? { fix_commit: ruling.fix_commit } : {}),
        // Conditionally spread like the two above, so an ordinary entry gains
        // no key. An entry carrying the marker ALONE has no commit id on it,
        // and that is correct rather than missing: the override settle point in
        // references/triage-gate.md produces a user's reason on the receipt and
        // no commit at all, so a SHA there would have been fabricated. The
        // marker beside a REAL commit is legal and unremarkable - a fix landed
        // and the halt was also overridden - and the value check above is what
        // keeps that combination honest.
        ...(ruling.overridden === OVERRIDE_MARKER ? { overridden: true } : {}),
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
