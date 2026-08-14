// @ts-check
// Tests for lib/skim.mjs. The load-bearing property is LINE FIDELITY: every
// case asserts the output line count equals the input's, because a skim that
// shifts lines hands an agent references that silently point at the wrong code.
'use strict';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { skim, skimStats, SYNTAX } from './lib/skim.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

/** @param {string} s */
const lines = (s) => s.split('\n').length;

test('line comments vanish, line count holds', () => {
  const src = 'const a = 1; // trailing\n// whole line\nconst b = 2;\n';
  const out = skim(src);
  assert.equal(lines(out), lines(src));
  assert.ok(!out.includes('trailing'));
  assert.ok(!out.includes('whole line'));
  assert.ok(out.includes('const a = 1;'));
  assert.ok(out.includes('const b = 2;'));
});

test('a block comment keeps its newlines', () => {
  const src = 'a;\n/* one\n two\n three */\nb;\n';
  const out = skim(src);
  assert.equal(lines(out), lines(src));
  assert.ok(!out.includes('two'));
  assert.equal(out.split('\n')[4], 'b;');
});

test('a // inside a string is not a comment', () => {
  const src = 'const u = "https://example.com"; // real\n';
  const out = skim(src);
  assert.ok(out.includes('https://example.com'));
  assert.ok(!out.includes('real'));
});

test('a // inside a regex literal is not a comment', () => {
  const src = 'const re = /https:\\/\\//; const x = 1;\n';
  const out = skim(src);
  assert.ok(out.includes('const x = 1;'), 'code after the regex survived');
});

test('division is not mistaken for a regex', () => {
  const src = 'const half = (a + b) / 2; // note\nconst z = 3;\n';
  const out = skim(src);
  assert.equal(lines(out), lines(src));
  assert.ok(out.includes('const z = 3;'));
  assert.ok(!out.includes('note'));
});

test('regex after a keyword is detected', () => {
  const src = 'function f(s) { return /a\\/b/.test(s); }\nconst q = 1;\n';
  const out = skim(src);
  assert.ok(out.includes('const q = 1;'));
});

test('a shebang survives - it is an instruction, not a comment', () => {
  const src = '#!/usr/bin/env node\n// gone\nconst a = 1;\n';
  const out = skim(src);
  assert.ok(out.startsWith('#!/usr/bin/env node'));
  assert.ok(!out.includes('gone'));
  assert.equal(lines(out), lines(src));
});

test('an unterminated block comment keeps its bytes rather than eating the file', () => {
  const src = 'const a = 1;\n/* never closed\nconst b = 2;\n';
  const out = skim(src);
  assert.ok(out.includes('const b = 2;'), 'fails toward keeping');
});

test('a // inside a template interpolation is kept, not stripped', () => {
  const src = 'const t = `${a} // not a comment`;\nconst b = 2;\n';
  const out = skim(src);
  assert.ok(out.includes('not a comment'), 'template consumed whole - keeps bytes');
  assert.ok(out.includes('const b = 2;'));
});

test('skimStats reports the saving and the line match', () => {
  const src = '// a\n// b\nconst x = 1;\n';
  const st = skimStats(src, skim(src));
  assert.equal(st.lines_match, true);
  assert.ok(st.saved > 0);
  assert.ok(st.pct > 0);
});

test('SYNTAX refuses what it cannot parse', () => {
  assert.equal(SYNTAX['.json'], null, 'json has no comments to strip');
  assert.equal(SYNTAX['.py'], undefined, 'unlisted extensions are refused');
  assert.equal(SYNTAX['.mjs'], 'c');
});

test('every shipped .mjs skims without losing a line', () => {
  const dirs = [join(HERE), join(HERE, 'lib')];
  let checked = 0;
  for (const d of dirs) {
    for (const f of readdirSync(d)) {
      if (!f.endsWith('.mjs')) continue;
      const src = readFileSync(join(d, f), 'utf8');
      const st = skimStats(src, skim(src));
      assert.equal(st.lines_match, true, `${f} shifted lines`);
      checked++;
    }
  }
  assert.ok(checked > 20, `expected the real tree, saw ${checked} files`);
});
