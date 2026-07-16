// @ts-check
// bm25.mjs - pure, zero-dep BM25 ranking (IR math, not `.planning` grammar;
// that grammar lives in planning-files.mjs). No Date, no randomness, no I/O -
// same corpus + same query always produces the same ranked order. Textbook
// k1=1.2, b=0.75 defaults; lowercase alphanumeric tokenization; a small fixed
// English stopword list; no stemming. Consumed by bin/planning.mjs cmdRecall.
'use strict';

// A small, fixed English stopword list - deliberately not exhaustive (no
// stemming, no NLP dependency), just enough to keep function words from
// drowning out content terms in a corpus of dozens of short snippets.
export const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'in', 'is', 'it', 'for', 'on',
  'with', 'as', 'by', 'at', 'be', 'are', 'was', 'were', 'that', 'this',
  'from', 'but', 'not', 'no', 'so', 'if', 'than', 'will', 'can',
]);

/**
 * Lowercase, split on runs of non-alphanumeric characters, drop empties and
 * stopwords. No stemming - "recall" and "recalling" are distinct terms.
 * @param {string} text @returns {string[]}
 */
export function tokenize(text) {
  return String(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t && !STOPWORDS.has(t));
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
