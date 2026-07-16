// Reference-value tests for lib/bm25.mjs. Run: node --test cadence-core/bin/bm25.test.mjs
// Only node: builtins, per the repo's zero-dep ethos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, buildIndex, search } from './lib/bm25.mjs';

test('tokenize: lowercases, splits on non-alphanumerics, drops stopwords', () => {
  assert.deepEqual(tokenize('Recall-Engine, for the Cadence Project!'),
    ['recall', 'engine', 'cadence', 'project']);
});

test('search: a doc containing the query term outranks one that does not', () => {
  const docs = [
    'the deviation touched the token-killer race condition',
    'an unrelated snippet about something else entirely',
  ];
  const index = buildIndex(docs);
  const results = search(index, 'token-killer race');
  assert.equal(results.length, 1);
  assert.equal(results[0].i, 0);
});

test('search: a stopword-only query returns no results', () => {
  const index = buildIndex(['the quick fox', 'a slow turtle']);
  assert.deepEqual(search(index, 'the a of'), []);
});

test('search: hand-computed score on a two-doc corpus matches the BM25 formula', () => {
  const docs = ['recall recall memory', 'unrelated words entirely here'];
  const index = buildIndex(docs);
  const [result] = search(index, 'recall', { k1: 1.2, b: 0.75 });
  // Doc 0: term "recall" f=2, len=3. Doc 1: no "recall". N=2, df=1.
  const N = 2, df = 1, f = 2, len = 3, avgLen = (3 + 4) / 2, k1 = 1.2, b = 0.75;
  const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
  const expected = idf * (f * (k1 + 1)) / (f + k1 * (1 - b + (b * len) / avgLen));
  assert.equal(result.i, 0);
  assert.ok(Math.abs(result.score - expected) < 1e-9,
    `expected ${expected}, got ${result.score}`);
});

test('search: two calls on the same index return deep-equal arrays (determinism)', () => {
  const index = buildIndex([
    'the deviation touched auth',
    'a different note about auth too',
    'nothing relevant here at all',
  ]);
  const a = search(index, 'auth deviation');
  const b = search(index, 'auth deviation');
  assert.deepEqual(a, b);
});

test('search: empty query or empty corpus yields no results, never throws', () => {
  const index = buildIndex(['some content here']);
  assert.deepEqual(search(index, ''), []);
  assert.deepEqual(search(buildIndex([]), 'anything'), []);
});
