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
 * Every package an `npm install` in a `run:` line names, as written. Comment
 * lines are skipped (they quote the command in prose), a trailing ` # ...` is
 * cut, and option flags are not packages.
 * @param {string} text @returns {string[]}
 */
function installedPackages(text) {
  const out = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*(?:-\s*)?run:\s*(.*)$/);
    if (!m) continue;
    const command = m[1].replace(/\s+#.*$/, '');
    const at = command.search(/\bnpm\s+(?:install|i)\b/);
    if (at < 0) continue;
    const words = command.slice(at).split(/\s+/).slice(2);
    for (const w of words) if (w && !w.startsWith('-')) out.push(w);
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
