// @ts-check
// pure, zero-dep BM25: no Date, randomness or I/O, so the same corpus and query always rank the same
// textbook k1=1.2 and b=0.75, lowercase alphanumeric tokens, a small stopword list and a Porter 1a/1b suffix fold
'use strict';

// small and fixed on purpose, no NLP dependency; matched against the raw token, never the folded one (see tokenize)
export const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'is', 'it', 'for', 'on',
  'with', 'as', 'by', 'at', 'be', 'are', 'was', 'were', 'that', 'this',
  'from', 'but', 'not', 'no', 'so', 'if', 'than', 'will', 'can',
]);

// suffix fold: `seam` used to miss every document that said `seams`
// foldSuffix is called only by tokenize, so index-time and query-time folding can't disagree
// steps 1a and 1b only, so other forms stay distinct: `verifies` folds to `verifi` while `verify` is untouched
// pure, because recall's byte-stable output rests on it

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
 * 1a: `sses` to `ss`, `ies` to `i`, a final `ss` kept, other final `s` dropped. No `es` rule: it splits file/files.
 * 1b: `eed` loses its `d` if the stem's measure is above zero; `ed`/`ing` strip only if a vowel remains, then cleanup.
 * The textbook `m == 1` gate on the final `e` restoration is skipped, or `refused` -> `refus` while `refuse` stays.
 * Tokens of two characters or fewer come back untouched, or the `s` rule would empty them and match every document.
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
 * The order is load-bearing: folding first sends `being` to the stopword `be`, so a query for `being` finds nothing.
 * planning-recall-fold.test.mjs pins it both ways.
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
 * Per-doc term frequencies and lengths, the corpus average length and per-term document frequency.
 * `docs` are raw strings; index `i` is the corpus position, also search's tie-break key.
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
 * Textbook BM25 over every doc: only scores above 0, sorted by score descending then corpus position, a total order.
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
