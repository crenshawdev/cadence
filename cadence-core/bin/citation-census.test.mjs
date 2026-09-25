// citation-census.test.mjs - pins every LIVE citation of a `planning.mjs`
// line number on a surface that INSTRUCTS a reader, so a line that moved out
// from under a citation fails this suite instead of quietly sending the next
// reader to the wrong code. The grammar is inline
// `` `<path>planning.mjs:<line>` `` or `` `<path>planning/<module>.mjs:<line>` ``
// prose citations, a bare range (`123-456`) included.
//
// THE GUARDED SET is the surfaces that INSTRUCT: `skills/`,
// `cadence-core/workflows/` and `cadence-core/references/`. Two classes are
// deliberately OUT and their citations are left exactly as they were written;
// the `.planning` records named below no longer live in this repository at all:
//
//   - `.planning/_archive-v*/` and `.planning/trace.jsonl` are RECORDS of what
//     a past sweep found, not instructions read forward. `self-verify.mjs`'s
//     check 15 states the precedent directly: guarding them tree-wide "would
//     land red on a record no one may rewrite" (self-verify.mjs:1236).
//   - `.planning/ROADMAP.md` (the executor contract forbids writing it at
//     all), `.planning/ARCHIVE.md`, `REQUIREMENTS.md`'s `## Shipped` rows,
//     `.planning/phases/*/` records and `design-notes/sweep-*.md` cite line
//     numbers inside quotes of what was true when they were written -
//     rewriting those would make a record say something it did not.
//
// Matching is BY SYMBOL, not by landing inside the right file: a citation
// that merely resolves to a valid line in `planning.mjs` proves nothing,
// since that file still has a line 343 after the split moved everything off
// of it. The check opens the cited file, takes the cited line - or, for a
// range, the range's first line - and asserts the text there names the
// SYMBOL the table below declares for that citation. The extracted set and
// the declared table are asserted to have the SAME members: a citation added
// to a guarded surface with no matching row fails as unpinned, and a row
// whose citation text was since deleted or edited fails as dead.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const BIN = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(dirname(BIN));

/** Every `.md` file under `dir`, recursively, as paths relative to ROOT. */
function everyMarkdown(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...everyMarkdown(full));
    else if (entry.name.endsWith('.md')) out.push(relative(ROOT, full));
  }
  return out;
}

/** The three whole-directory guarded surfaces, ROOT-relative. */
const GUARDED_MD_DIRS = ['skills', 'cadence-core/workflows', 'cadence-core/references'];

/**
 * Grammar one, anchored so a DIFFERENT file - `planning-files.mjs`,
 * `planning.test.mjs` - never matches: the literal text right after
 * `planning` must be either `.mjs:` itself or `/<module-name>.mjs:`. `\b`
 * on the near side keeps `phase-planning.mjs` (nothing in this tree, but the
 * grammar should still refuse it) from matching mid-word.
 */
const CITATION_RE = /\bplanning((?:\/[a-zA-Z0-9_-]+)?)\.mjs:(\d+)(?:-(\d+))?\b/g;

/** @returns {{raw: string, module: string, start: number, end: number}[]} */
function citationsIn(text) {
  const out = [];
  CITATION_RE.lastIndex = 0;
  let m;
  while ((m = CITATION_RE.exec(text))) {
    out.push({ raw: m[0], module: m[1] || '', start: Number(m[2]), end: m[3] ? Number(m[3]) : Number(m[2]) });
  }
  return out;
}

/** Every grammar-one citation found on a guarded surface, `{surface, raw, module, start, end}`. */
function extractGrammarOne() {
  const out = [];
  for (const dir of GUARDED_MD_DIRS) {
    for (const rel of everyMarkdown(join(ROOT, dir))) {
      const text = readFileSync(join(ROOT, rel), 'utf8');
      for (const c of citationsIn(text)) out.push({ surface: rel, ...c });
    }
  }
  return out;
}

/**
 * The pinned set. One row per live grammar-one citation, naming the surface
 * it appears on, the citation text exactly as `CITATION_RE` extracts it
 * (never the full doc-quoted path prefix), the file and line/range it now
 * has to resolve to, and the SYMBOL that line - or the range's first line -
 * must carry.
 */
const CITATIONS = [
  {
    surface: 'skills/cad-verifier-contract/SKILL.md',
    citation: 'planning/uat.mjs:499-501',
    file: 'cadence-core/bin/planning/uat.mjs',
    start: 499,
    end: 501,
    symbol: 'atomicWrite',
  },
  // SPL-01 and SPL-02's two `planning/core.mjs` citations retired here at the
  // v3.7.1 close on 2026-08-25: their `## Active` bullets moved to `## Shipped`,
  // and a Shipped row is a one-line summary that carries no line citations. This
  // is grammar one's third remedy, not a lost pin - the code both rows named is
  // unchanged and still asserted by `phase-spelling.test.mjs`.
];

test('grammar one: every citation on a guarded surface has exactly one pinned row', () => {
  const found = extractGrammarOne();
  const foundKeys = found.map((c) => `${c.surface}::${c.raw}`).sort();
  const declaredKeys = CITATIONS.map((c) => `${c.surface}::${c.citation}`).sort();
  assert.deepEqual(foundKeys, declaredKeys,
    'the citations a walk of skills/, cadence-core/workflows/ and cadence-core/references/'
    + ' finds must be exactly the rows CITATIONS declares - an extra citation is unpinned, a'
    + ' missing one is a dead row. Pin the new citation, re-pin a moved one, or DELETE the row'
    + ' when its citation left the surface');
});

test('grammar one: each pinned citation resolves to the code it names', () => {
  // A NON-VACUITY floor of one, never a count. The number of rows here is not
  // a property of this tree: a row retires with the requirement that carried
  // it, and at the close of the cycle that seeded them, two of the three rows
  // above leave `.planning/REQUIREMENTS.md`'s `## Active` section in the same
  // commit - so a hand-written `>= 3` reddens the suite inside the close, the
  // most expensive place to find it, and the only available fix there is to
  // edit the number, which proves the number was never load-bearing. What
  // guarantees this census is not measuring nothing is the separate
  // `grammarOneCount > 0` assertion at the foot of this file, which counts what
  // the WALK found rather than what the table declares.
  assert.ok(CITATIONS.length >= 1, `only ${CITATIONS.length} rows declared`);
  for (const c of CITATIONS) {
    const lines = readFileSync(join(ROOT, c.file), 'utf8').split('\n');
    const lineText = lines[c.start - 1];
    assert.ok(typeof lineText === 'string',
      `${c.surface}'s citation "${c.citation}" points at ${c.file}:${c.start}, past the end of the file`);
    assert.ok(lineText.includes(c.symbol),
      `${c.surface}'s citation "${c.citation}" is pinned to carry \`${c.symbol}\` at ${c.file}:${c.start}, `
      + `but that line reads: ${JSON.stringify(lineText)}`);
  }
});

test('the census reports how many citations it checked', () => {
  // A census whose walk silently matched zero is a census that can be emptied
  // without anyone noticing (D-13's self-claim class, applied to itself).
  const grammarOneCount = extractGrammarOne().length;
  console.log(`citation census: inline planning.mjs:<line> citations on a guarded surface`
    + ` checked ${grammarOneCount}.`);
  assert.ok(grammarOneCount > 0, 'the walk must have matched at least one live citation');
});
