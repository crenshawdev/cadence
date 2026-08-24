// citation-census.test.mjs - pins every LIVE citation of a `planning.mjs`
// line number on a surface that INSTRUCTS a reader, so a line that moved out
// from under a citation fails this suite instead of quietly sending the next
// reader to the wrong code.
//
// TWO GRAMMARS (D-04, phase 4 plan 3). Grammar one, checked here: inline
// `` `<path>planning.mjs:<line>` `` or `` `<path>planning/<module>.mjs:<line>` ``
// prose citations, a bare range (`123-456`) included. Grammar two -
// `.planning/DOCS-CLAIMS.md`'s separate line-range table COLUMN, invisible to
// a grep for grammar one - is added in phase 4 plan 3's task 2.
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
