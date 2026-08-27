// @ts-check
// bm25.mjs - pure, zero-dep BM25 ranking (IR math, not `.planning` grammar;
// that grammar lives in planning-files.mjs). No Date, no randomness, no I/O -
// same corpus + same query always produces the same ranked order. Textbook
// k1=1.2, b=0.75 defaults; lowercase alphanumeric tokenization; a small fixed
// English stopword list; and a deterministic suffix fold - Porter steps 1a and
// 1b, so `seams` and `seam` are ONE term. Consumed by bin/planning.mjs
// cmdRecall.
'use strict';

// A small, fixed English stopword list - deliberately not exhaustive (no NLP
// dependency), just enough to keep function words from drowning out content
// terms in a corpus of dozens of short snippets. Tested against the RAW token,
// never against the folded one; `foldSuffix` below states why.
export const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'is', 'it', 'for', 'on',
  'with', 'as', 'by', 'at', 'be', 'are', 'was', 'were', 'that', 'this',
  'from', 'but', 'not', 'no', 'so', 'if', 'than', 'will', 'can',
]);

// ---------------------------------------------------------------------------
// The suffix fold (RCL-08). `recall` ranked well over the corpus it saw and a
// user who typed `seam` still missed every document that said `seams`, because
// the two were different terms. Porter steps 1a and 1b fold them together.
//
// ONE FOLD SITE, and that is the whole design (D-01). `foldSuffix` is called by
// `tokenize` and by nothing else - not exported, not called from `buildIndex`,
// not from `search`, not from planning/recall.mjs. Both of those reach the
// tokenizer already, so "identical at index time and query time" is a property
// of there being ONE code path rather than of two sites agreeing, and nothing
// in the suite would catch a one-sided edit to two sites. That drift is exactly
// what RCL-08 exists to close.
//
// STEPS 1a AND 1b ONLY, deliberately. Forms outside them stay distinct terms:
// `verifies` folds to `verifi` while `verify` is untouched, `released` to
// `releas`, and `indices` never reaches `index`. Nothing claims otherwise.
//
// No I/O, no Date, no randomness, no dependency - `recall`'s byte-stable output
// rests on this module being a pure function of its input.
// ---------------------------------------------------------------------------

const VOWELS = 'aeiou';

/** Porter's consonant test: `y` is a consonant only at the start of a word or
 * after a vowel, so it is a vowel in `typ` and a consonant in `yes`. */
function isConsonant(w, i) {
  const c = w[i];
  if (VOWELS.includes(c)) return false;
  if (c !== 'y') return true;
  return i === 0 ? true : !isConsonant(w, i - 1);
}

/** Porter's `m`: how many vowel-then-consonant groups the stem holds. */
function measure(w) {
  let m = 0;
  let i = 0;
  while (i < w.length && isConsonant(w, i)) i++;
  while (i < w.length) {
    while (i < w.length && !isConsonant(w, i)) i++;
    if (i >= w.length) break;
    m++;
    while (i < w.length && isConsonant(w, i)) i++;
  }
  return m;
}

/** Porter's `*v*`: the stem contains a vowel. */
function hasVowel(w) {
  for (let i = 0; i < w.length; i++) if (!isConsonant(w, i)) return true;
  return false;
}

/** Porter's `*d*`: the stem ends in a doubled consonant. */
function endsDoubleConsonant(w) {
  return w.length >= 2 && w[w.length - 1] === w[w.length - 2] && isConsonant(w, w.length - 1);
}

/** Porter's `*o*`: the stem ends consonant-vowel-consonant, last not w/x/y. */
function endsCvc(w) {
  const n = w.length;
  if (n < 3) return false;
  if (!isConsonant(w, n - 3) || isConsonant(w, n - 2) || !isConsonant(w, n - 1)) return false;
  return !'wxy'.includes(w[n - 1]);
}

/**
 * Porter step 1a then step 1b over one already-lowercased token.
 *
 * Step 1a, IN THIS ORDER: `sses` -> `ss`, `ies` -> `i`, a final `ss` kept, an
 * otherwise-final `s` dropped. `es` is NEVER a rule of its own - measured
 * 2026-08-27 over this repository's live corpus (1,100 docs, 3,239 distinct
 * types), an `es`-before-`s` strip gives `closes` -> `clos` against `close` ->
 * `close`, a miss on the roadmap's own worked example, and it splits
 * file/files, note/notes, type/types and change/changes.
 *
 * Step 1b: `eed` loses its `d` only when the stem before it has measure above
 * zero (so `agreed` -> `agree` but `freed` stays `freed`); otherwise a final
 * `ed` or `ing` is stripped only when the remaining stem holds a vowel, and a
 * strip that fired takes its cleanup - `at`/`bl`/`iz` take back an `e`, a
 * doubled final consonant other than `l`/`s`/`z` loses a letter, a
 * consonant-vowel-consonant ending takes back an `e`.
 *
 * MEASURED 2026-08-27: the textbook `m == 1` gate on that last restoration is
 * deliberately NOT applied. With it, `refused` folds to `refus` while `refuse`
 * stays `refuse` and the pair splits; without it both reach `refuse`, and
 * remove/removed join too. Every other pair holds either way.
 *
 * Tokens of two characters or fewer are returned untouched: the `s` rule would
 * otherwise empty a one-letter token, and an empty term in the index is a term
 * every document shares.
 * @param {string} term @returns {string}
 */
function foldSuffix(term) {
  if (term.length <= 2) return term;
  let w = term;

  // Step 1a.
  if (w.endsWith('sses')) w = w.slice(0, -2);
  else if (w.endsWith('ies')) w = w.slice(0, -2);
  else if (!w.endsWith('ss') && w.endsWith('s')) w = w.slice(0, -1);

  // Step 1b. `eed` is exclusive: when it matches, the `ed`/`ing` strips below
  // never run, whether or not its measure condition held.
  if (w.endsWith('eed')) return measure(w.slice(0, -3)) > 0 ? w.slice(0, -1) : w;

  let stripped = false;
  if (w.endsWith('ed') && hasVowel(w.slice(0, -2))) {
    w = w.slice(0, -2);
    stripped = true;
  } else if (w.endsWith('ing') && hasVowel(w.slice(0, -3))) {
    w = w.slice(0, -3);
    stripped = true;
  }
  if (!stripped) return w;

  // Step 1b's cleanup, first match wins.
  if (w.endsWith('at') || w.endsWith('bl') || w.endsWith('iz')) return `${w}e`;
  if (endsDoubleConsonant(w) && !'lsz'.includes(w[w.length - 1])) return w.slice(0, -1);
  if (endsCvc(w)) return `${w}e`;
  return w;
}

/**
 * Lowercase, split on runs of non-alphanumeric characters, drop empties and
 * stopwords, then fold each surviving token's suffix.
 *
 * THE STOPWORD FILTER RUNS FIRST, and the order is load-bearing (D-03).
 * Measured 2026-08-27 against `STOPWORDS`: folding first would send `being` ->
 * `be` (6 occurrences in the live corpus) and `its` -> `it` onto stopwords, and
 * the filter would then delete them - so a query for `being` would return
 * NOTHING rather than return less than it should, which is strictly worse than
 * the no-fold behaviour this replaced. Testing the RAW token keeps a term whose
 * FOLD happens to be a stopword in the index; `planning-recall-fold.test.mjs`
 * pins that in both directions.
 * @param {string} text @returns {string[]}
 */
export function tokenize(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !STOPWORDS.has(t))
    .map(foldSuffix);
}

/**
 * Precompute per-doc term frequencies, lengths, the corpus average length,
 * and document frequency per term. `docs` is an array of raw strings; index
 * `i` is the doc's corpus position (also the tie-break key in search()).
 * @param {string[]} docs
 */
export function buildIndex(docs) {
  const N = docs.length;
  const tfs = [];
  const lens = [];
  /** @type {Map<string, number>} */
  const df = new Map();
  for (const doc of docs) {
    const terms = tokenize(doc);
    lens.push(terms.length);
    /** @type {Map<string, number>} */
    const tf = new Map();
    for (const t of terms) tf.set(t, (tf.get(t) || 0) + 1);
    for (const t of tf.keys()) df.set(t, (df.get(t) || 0) + 1);
    tfs.push(tf);
  }
  const avgLen = N ? lens.reduce((a, b) => a + b, 0) / N : 0;
  return { N, tfs, lens, avgLen, df };
}

/**
 * Rank every doc against `query`, textbook BM25. Returns only docs with
 * score > 0, sorted score descending then corpus position `i` ascending -
 * a stable, deterministic total order regardless of object insertion.
 * @param {ReturnType<typeof buildIndex>} index @param {string} query
 * @param {{k1?:number, b?:number}} [opts]
 * @returns {Array<{i:number, score:number}>}
 */
export function search(index, query, opts = {}) {
  const k1 = opts.k1 !== undefined ? opts.k1 : 1.2;
  const b = opts.b !== undefined ? opts.b : 0.75;
  const qTerms = [...new Set(tokenize(query))];
  if (!qTerms.length || !index.N) return [];
  const idf = new Map(qTerms.map((t) => {
    const dfT = index.df.get(t) || 0;
    return [t, Math.log(1 + (index.N - dfT + 0.5) / (dfT + 0.5))];
  }));
  const results = [];
  for (let i = 0; i < index.N; i++) {
    let score = 0;
    const tf = index.tfs[i];
    const len = index.lens[i];
    for (const t of qTerms) {
      const f = tf.get(t) || 0;
      if (!f) continue;
      const num = f * (k1 + 1);
      const denom = f + k1 * (1 - b + (b * len) / (index.avgLen || 1));
      score += idf.get(t) * (num / denom);
    }
    if (score > 0) results.push({ i, score });
  }
  results.sort((x, y) => y.score - x.score || x.i - y.i);
  return results;
}
