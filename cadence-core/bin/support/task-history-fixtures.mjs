// Real-repository fixtures for the authored historical task record. Split out
// of planning-task-record.test.mjs when phase 17 retired the JavaScript
// task-record writer: the writer and its arms are gone, but a test that reads
// a historical `.planning/tasks/<slug>/RECORD.md` back out still wants a real
// repository with real commits to plant that record into. This module registers
// no tests; it only exports the fixture builders its readers ask for.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GIT_FIXTURE_ENV } from '../planning-audit.test.mjs';

/**
 * A scratch git repository holding `commits`, each a `{file, text, subject}`,
 * plus a `.planning` directory unless `planning` is false. Returns
 * `{root, dir, shas}` - `shas` in the order the commits were made.
 */
export function taskRepo(commits, { planning = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'cad-task-record-'));
  const git = (...args) => execFileSync('git', ['-C', root, ...args],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: GIT_FIXTURE_ENV }).trim();
  git('init', '-q');
  git('commit', '--allow-empty', '-q', '-m', 'root');
  const shas = [];
  for (const c of commits) {
    writeFileSync(join(root, c.file), c.text);
    git('add', c.file);
    git('commit', '-q', '-m', c.subject);
    shas.push(git('rev-parse', 'HEAD'));
  }
  const dir = join(root, '.planning');
  if (planning) mkdirSync(dir, { recursive: true });
  return { root, dir, shas };
}

export const TASK_COMMITS = [
  { file: 'alpha.txt', text: 'a\n', subject: 'feat: the first thing' },
  { file: 'beta.txt', text: 'b\n', subject: 'fix: the second | thing' },
];
