// citation-census.test.mjs - pins every LIVE citation of a `planning.mjs`
// line number on a surface that INSTRUCTS a reader, so a line that moved out
// from under a citation fails this suite instead of quietly sending the next
// reader to the wrong code.
//
// TWO GRAMMARS (D-04, phase 4 plan 3). Grammar one: inline
// `` `<path>planning.mjs:<line>` `` or `` `<path>planning/<module>.mjs:<line>` ``
// prose citations, a bare range (`123-456`) included. Grammar two:
// `.planning/DOCS-CLAIMS.md`'s claim table carries its own `doc` and `line`
// COLUMNS, invisible to a grep for grammar one's inline form, and needs its
// own arm rather than a wider regex over the same pattern - only the rows
// whose `doc` cell names this seam (`cadence-core/bin/planning.mjs` or, after
// the split, `cadence-core/bin/planning/<module>.mjs`) are in scope; a claim
// about `lib/trace.mjs` or `self-verify.mjs` is a different seam's record and
// stays out of this census.
//
// THE GUARDED SET is the surfaces that INSTRUCT: `skills/`,
// `cadence-core/workflows/`, `cadence-core/references/`, and the `## Active`
// section of `.planning/REQUIREMENTS.md` (bounded by `sectionBound`, never by
// a second heading search - see `activeSectionLines` below). Two classes are
// deliberately OUT and their citations are left exactly as they were written:
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
import { sectionBound } from './lib/planning-files.mjs';

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

/**
 * `.planning/REQUIREMENTS.md`'s `## Active` section, as an array of lines
 * (the heading line included, the next `## ` heading excluded) - the same
 * `sectionBound`-over-a-slice idiom `lib/why-record.mjs`'s `planTaskBodies`
 * uses for the identical job: `## Active` is this file's FIRST `## `
 * heading, so `sectionBound` over the whole file lands on it directly, and a
 * second call over everything after it finds where the section ends.
 */
function activeSectionLines() {
  const text = readFileSync(join(ROOT, '.planning/REQUIREMENTS.md'), 'utf8');
  const lines = text.split('\n');
  const headingIdx = sectionBound(lines);
  if (headingIdx === -1 || lines[headingIdx].trim() !== '## Active') {
    throw new Error("citation-census: REQUIREMENTS.md's first `## ` heading is no longer `## Active`"
      + ' - update activeSectionLines() to find it some other way');
  }
  const rest = lines.slice(headingIdx + 1);
  const bound = sectionBound(rest);
  const end = bound === -1 ? lines.length : headingIdx + 1 + bound;
  return lines.slice(headingIdx, end);
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
  const activeText = activeSectionLines().join('\n');
  for (const c of citationsIn(activeText)) out.push({ surface: '.planning/REQUIREMENTS.md', ...c });
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
    citation: 'planning/uat.mjs:489-491',
    file: 'cadence-core/bin/planning/uat.mjs',
    start: 489,
    end: 491,
    symbol: 'atomicWrite',
  },
  {
    surface: '.planning/REQUIREMENTS.md',
    citation: 'planning/status.mjs:28',
    file: 'cadence-core/bin/planning/status.mjs',
    start: 28,
    end: 28,
    symbol: 'PHASE_DIR_NAME',
  },
  {
    surface: '.planning/REQUIREMENTS.md',
    citation: 'planning/core.mjs:77',
    file: 'cadence-core/bin/planning/core.mjs',
    start: 77,
    end: 77,
    symbol: 'phaseSpellingRefusal',
  },
];

test('grammar one: every citation on a guarded surface has exactly one pinned row', () => {
  const found = extractGrammarOne();
  const foundKeys = found.map((c) => `${c.surface}::${c.raw}`).sort();
  const declaredKeys = CITATIONS.map((c) => `${c.surface}::${c.citation}`).sort();
  assert.deepEqual(foundKeys, declaredKeys,
    'the citations a walk of skills/, cadence-core/workflows/, cadence-core/references/ and'
    + " REQUIREMENTS.md's ## Active section finds must be exactly the rows CITATIONS declares -"
    + ' an extra citation is unpinned, a missing one is a dead row');
});

test('grammar one: each pinned citation resolves to the code it names', () => {
  assert.ok(CITATIONS.length >= 3, `only ${CITATIONS.length} rows declared`);
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

// --- grammar two: DOCS-CLAIMS.md's own doc/line columns --------------------

/**
 * Every row of `.planning/DOCS-CLAIMS.md`'s claim table (both Run 1's and Run
 * 2's - the file carries two), as `{id, doc, line}`. Parsed from the FIRST
 * three cells only, by finding each cell boundary in turn rather than
 * splitting the whole line on `|`: 22 claim/resolution cells in this file
 * carry an escaped `\|`, which a naive `line.split('|')` would cut on,
 * shredding every column after it. The claim/verdict/resolution/run cells are
 * never read here - this census pins LOCATION, not content.
 */
function docsClaimsRows() {
  const text = readFileSync(join(ROOT, '.planning/DOCS-CLAIMS.md'), 'utf8');
  const rowRe = /^\|\s*([A-Za-z][A-Za-z0-9-]*)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/gm;
  const out = [];
  let m;
  while ((m = rowRe.exec(text))) {
    if (m[2] === 'doc' && m[3] === 'line') continue; // the header row itself
    out.push({ id: m[1], doc: m[2], line: m[3] });
  }
  return out;
}

/** This seam's `doc` cell, before or after the split: `planning.mjs` itself,
 * or a module under `planning/`. */
function namesThisSeam(doc) {
  return doc === 'cadence-core/bin/planning.mjs' || doc.startsWith('cadence-core/bin/planning/');
}

/**
 * The pinned set for grammar two. One row per `DOCS-CLAIMS.md` id whose `doc`
 * cell names this seam, carrying the file and line/range the row's `line`
 * cell must resolve to and the SYMBOL its first line must carry - the same
 * rule grammar one's table states, applied to a different column.
 */
const DOCS_CLAIMS_CITATIONS = [
  {
    id: 'EXECUTE-10',
    doc: 'cadence-core/bin/planning/lease-check.mjs',
    line: '440-443',
    start: 440,
    end: 443,
    symbol: "'undeclared-files'",
  },
  {
    id: 'EXECUTE-22',
    doc: 'cadence-core/bin/planning/trace.mjs',
    line: '197-199',
    start: 197,
    end: 199,
    symbol: 'TRACE_IGNORE_LINE',
  },
  {
    id: 'VERIFY-11',
    doc: 'cadence-core/bin/planning/uat.mjs',
    line: '113-117',
    start: 113,
    end: 117,
    symbol: 'fields_version',
  },
  {
    id: 'VERIFY-12',
    doc: 'cadence-core/bin/planning/criteria-coverage.mjs',
    line: '57-59',
    start: 57,
    end: 59,
    symbol: 'LEGACY_REASON',
  },
];

test('grammar two: every this-seam DOCS-CLAIMS row has exactly one pinned row', () => {
  const found = docsClaimsRows().filter((r) => namesThisSeam(r.doc));
  const foundKeys = found.map((r) => `${r.id}::${r.doc}::${r.line}`).sort();
  const declaredKeys = DOCS_CLAIMS_CITATIONS.map((r) => `${r.id}::${r.doc}::${r.line}`).sort();
  assert.deepEqual(foundKeys, declaredKeys,
    "every DOCS-CLAIMS.md row whose doc cell names planning.mjs or a planning/ module must be exactly"
    + ' the rows DOCS_CLAIMS_CITATIONS declares - an extra row is unpinned, a missing one is a dead row');
});

test('grammar two: each pinned row resolves to the code it names', () => {
  assert.ok(DOCS_CLAIMS_CITATIONS.length >= 4, `only ${DOCS_CLAIMS_CITATIONS.length} rows declared`);
  for (const c of DOCS_CLAIMS_CITATIONS) {
    const lines = readFileSync(join(ROOT, c.doc), 'utf8').split('\n');
    const lineText = lines[c.start - 1];
    assert.ok(typeof lineText === 'string',
      `DOCS-CLAIMS.md's ${c.id} points at ${c.doc}:${c.start}, past the end of the file`);
    assert.ok(lineText.includes(c.symbol),
      `DOCS-CLAIMS.md's ${c.id} is pinned to carry \`${c.symbol}\` at ${c.doc}:${c.start}, `
      + `but that line reads: ${JSON.stringify(lineText)}`);
  }
});

test('the census reports how many citations each grammar checked', () => {
  // A census whose arm silently matched zero is a census that can be emptied
  // without anyone noticing (D-13's self-claim class, applied to itself).
  const grammarOneCount = extractGrammarOne().length;
  const grammarTwoCount = docsClaimsRows().filter((r) => namesThisSeam(r.doc)).length;
  console.log(`citation census: grammar one (inline planning.mjs:<line> citations on a guarded`
    + ` surface) checked ${grammarOneCount}; grammar two (DOCS-CLAIMS.md rows naming this seam)`
    + ` checked ${grammarTwoCount}.`);
  assert.ok(grammarOneCount > 0 && grammarTwoCount > 0,
    'both grammars must have matched at least one live citation');
});
