// @ts-check
// Pure, zero-dep BM25 ranking: no Date, no randomness, no I/O, so the same corpus and query always rank the same. The planning grammar lives in planning-files.mjs, not here.
// Textbook k1=1.2, b=0.75, lowercase alphanumeric tokens, a small fixed stopword list and a Porter 1a/1b suffix fold, so `seams` and `seam` are one term. cmdRecall uses it.
'use strict';

// small and fixed on purpose, no NLP dependency; matched against the raw token, never the folded one (see tokenize)
export const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'is', 'it', 'for', 'on',
  'with', 'as', 'by', 'at', 'be', 'are', 'was', 'were', 'that', 'this',
  'from', 'but', 'not', 'no', 'so', 'if', 'than', 'will', 'can',
]);

// The suffix fold: a user who typed `seam` used to miss every document that said `seams`, because they were different terms.
// foldSuffix is called by tokenize and nothing else (not exported, not from buildIndex, search or recall), so index-time and query-time folding can't disagree. One code path, because nothing in the suite would catch a one-sided edit to two sites.
// Steps 1a and 1b only, so other forms stay distinct terms: `verifies` folds to `verifi` while `verify` is untouched, `released` to `releas`, and `indices` never reaches `index`.
// Pure, because recall's byte-stable output rests on it.

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
 * Step 1a runs in order: `sses` to `ss`, `ies` to `i`, a final `ss` kept, an otherwise-final `s` dropped. `es` is never a rule of its own, since stripping it before `s` gives `closes` -> `clos` against `close` -> `close` and splits file/files, note/notes, type/types and change/changes.
 * Step 1b: `eed` loses its `d` only when the stem before it has measure above zero (`agreed` -> `agree`, `freed` stays), otherwise a final `ed` or `ing` is stripped only if the remaining stem holds a vowel. A strip that fired gets its cleanup: `at`/`bl`/`iz` take back an `e`, a doubled final consonant other than `l`/`s`/`z` loses a letter, a consonant-vowel-consonant ending takes back an `e`.
 * The textbook `m == 1` gate on that last restoration is deliberately not applied: with it `refused` folds to `refus` while `refuse` stays `refuse`, and the pair splits.
 * Tokens of two characters or fewer come back untouched, or the `s` rule would empty a one-letter token, and an empty term is one every document shares.
 * @param {string} term @returns {string}
 */
function foldSuffix(term) {
  if (term.length <= 2) return term;
  let w = term;

  if (w.endsWith('sses')) w = w.slice(0, -2);
  else if (w.endsWith('ies')) w = w.slice(0, -2);
  else if (!w.endsWith('ss') && w.endsWith('s')) w = w.slice(0, -1);

  // `eed` is exclusive: when it matches, the ed/ing strips below never run, whether or not its measure condition held
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

  // cleanup after a strip; first match wins
  if (w.endsWith('at') || w.endsWith('bl') || w.endsWith('iz')) return `${w}e`;
  if (endsDoubleConsonant(w) && !'lsz'.includes(w[w.length - 1])) return w.slice(0, -1);
  if (endsCvc(w)) return `${w}e`;
  return w;
}

/**
 * Lowercase, split on runs of non-alphanumerics, drop empties and stopwords, then fold each surviving token's suffix.
 * The stopword filter runs first and the order is load-bearing: folding first sends `being` to `be` and `its` to `it`, onto stopwords, and the filter would then delete them, so a query for `being` would return nothing. Testing the raw token keeps a term whose fold happens to be a stopword in the index; planning-recall-fold.test.mjs pins that both ways.
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
 * Per-doc term frequencies and lengths, the corpus average length and document frequency per term. `docs` are raw strings and index `i` is the doc's corpus position, also search's tie-break key.
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
 * Rank every doc against `query`, textbook BM25: only docs scoring above 0, sorted by score descending then corpus position ascending, a stable total order whatever the insertion order.
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
