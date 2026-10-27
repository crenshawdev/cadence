// Zero-dep test: every package `.github/workflows/test.yml` installs from npm
// names an exact version (gap 14, D-24). The repo has no package.json and no
// lockfile, so the version on the command line is the only pin there is; an
// unpinned install runs whatever the registry serves that day, in a job holding
// a checkout. Lands in the `other` group (D-25). Run:
// node --test cadence-core/bin/ci-install-pins.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEST_YML = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.github', 'workflows', 'test.yml');

/**
 * Every package an `npm install` in a `run:` step names, as written. The command
 * is the text on the `run:` line OR, for a block scalar (`run: |`, `run: >-`),
 * the lines indented under it. Comment lines are skipped (they quote the command
 * in prose), a trailing ` # ...` is cut, a `\` continuation joins its next
 * line, a folded (`>`) block is one command, and a word stops at a shell
 * separator. Option flags are not packages.
 * @param {string} text @returns {string[]}
 */
function installedPackages(text) {
  const out = [];
  const lines = text.split('\n');
  /** @type {string[]} */
  const commands = [];
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(/^(\s*(?:-\s*)?)run:\s*(.*)$/);
    if (!m) continue;
    const keyIndent = m[1].length;
    const block = m[2].match(/^([|>])[+-]?\d*\s*(?:#.*)?$/);
    if (!block) {
      commands.push(m[2]);
      continue;
    }
    const body = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      if (lines[j].trim() !== '' && lines[j].search(/\S/) <= keyIndent) break;
      body.push(lines[j]);
    }
    commands.push(...(block[1] === '>' ? [body.join(' ')] : body));
  }
  // A `\` at the end of a line continues the command on the next one.
  const joined = commands.join('\n').replace(/\\\s*\n/g, ' ').split('\n');
  for (const line of joined) {
    if (/^\s*#/.test(line)) continue;
    const command = line.replace(/\s+#.*$/, '');
    const at = command.search(/\bnpm\s+(?:install|i)\b/);
    if (at < 0) continue;
    const words = command.slice(at).split(/\s+/).slice(2);
    for (const w of words) {
      if (/^(?:&&|\|\||;|\|)$/.test(w)) break;
      if (w && !w.startsWith('-')) out.push(w);
    }
  }
  return out;
}

test('test.yml: at least one npm install is found, so an empty parse cannot pass', () => {
  assert.ok(installedPackages(readFileSync(TEST_YML, 'utf8')).length >= 1);
});

test('test.yml: every npm install names an exact @<version>', () => {
  const unpinned = installedPackages(readFileSync(TEST_YML, 'utf8'))
    // For a scoped package the version `@` is the one after its name.
    .filter((p) => !/^(?:@[^/@\s]+\/)?[^/@\s]+@\d+\.\d+\.\d+(?:[-+][\w.+-]+)?$/.test(p));
  assert.deepEqual(unpinned, [], `unpinned in test.yml: ${unpinned.join(', ')}`);
});

test('installedPackages: reads a scoped package, skips flags and comment lines', () => {
  const sample = [
    '      # a global npm install has no lockfile',
    '      - run: npm install --no-save --no-package-lock typescript@7.0.2 @types/node@26.6.5',
    '      - run: npm install -g @anthropic-ai/claude-code # no pin',
  ].join('\n');
  assert.deepEqual(installedPackages(sample),
    ['typescript@7.0.2', '@types/node@26.6.5', '@anthropic-ai/claude-code']);
});

test('installedPackages: reads an install inside a `run: |` or `run: >` block', () => {
  const sample = [
    '    steps:',
    '      - run: |',
    '          echo start',
    '          npm install -g some-tool',
    '          npm install --no-save pinned@1.2.3 \\',
    '            other-tool@2.0.0 && npm test',
    '',
    '      - name: folded',
    '        run: >-',
    '          npm install',
    '          folded-tool',
    '      - run: node a.mjs',
    '        env:',
    '          npm_note: npm install not-a-step',
  ].join('\n');
  assert.deepEqual(installedPackages(sample),
    ['some-tool', 'pinned@1.2.3', 'other-tool@2.0.0', 'folded-tool']);
});
