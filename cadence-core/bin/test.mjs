#!/usr/bin/env node
// @ts-check
// test.mjs - run the suite by GROUP, so editing one seam does not re-run the
// others. `node --test cadence-core/bin/*.test.mjs` is still correct and still
// what CI's full arm runs; this exists because the whole suite is ~26s and a
// routing change has no business re-running the git-publish seams.
//
// Groups are declared HERE rather than in a manifest beside this file: nothing
// else reads them, and a second file would be one more thing to keep in sync
// for no second consumer.
//
// There is deliberately NO coverage check. A stem this file does not name
// lands in `other`, which the default run and CI both execute, so a new test
// file runs from the moment it exists - a manifest that could silently drop a
// file is the failure mode a coverage check would then have to exist to catch.
//
// Usage:
//   node cadence-core/bin/test.mjs                 every group
//   node cadence-core/bin/test.mjs routing         one group
//   node cadence-core/bin/test.mjs routing prose   several
//   node cadence-core/bin/test.mjs --list          the groups and their files
'use strict';

import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Group -> the test stems it owns (`<stem>.test.mjs`). A stem named by no
 * group falls into `other`.
 * @type {Readonly<Record<string, string[]>>}
 */
const GROUPS = Object.freeze({
  // The resolver, its data table, and the config layers that feed it.
  routing: ['route', 'route-cells', 'route-relay', 'rung-agent', 'retired-keys',
    'config', 'config-seams', 'dispatch-phrasing', 'phase-plans'],
  // Everything that touches a real repository.
  git: ['git-guard', 'git-publish', 'git-branch', 'git-segments', 'worktree-base',
    'branch-decision', 'publish-decision', 'close-decision', 'release-decision',
    'release-bump', 'land-cleanup', 'redact-url', 'issue-check', 'issue-decision'],
  // The .planning grammar and the run record. The seam's own arms are one stem
  // per subcommand since phase 4 split planning.test.mjs; `planning` itself is
  // now just the shared fixture harness plus the arms that span several
  // subcommands, and every `planning-*` stem below has to be named here or
  // `node test.mjs planning` - the documented way to run this seam, and the CI
  // matrix cell of that name - would run the harness and leave the bulk of the
  // seam in `other`. `planning-files` covers lib/planning-files.mjs rather than
  // the seam. Measured after the split: 931 arms in ~7.4s wall clock, the stems
  // running in parallel processes, which is why its non-seam members (trace,
  // bm25, debt-markers) stay the cheap ones.
  planning: ['planning', 'planning-adjudication', 'planning-audit',
    'planning-capture-sections', 'planning-cite-count',
    'planning-criteria-coverage', 'planning-criteria-size', 'planning-cursor',
    'planning-debt-harvest', 'planning-deferred', 'planning-detect',
    'planning-files', 'planning-lease-check', 'planning-milestone-prune',
    'planning-phase-done', 'planning-plans', 'planning-recall',
    'planning-renumber', 'planning-seed-reqs', 'planning-status',
    'planning-task-record', 'planning-trace-ignore', 'planning-uat',
    'trace', 'bm25', 'debt-markers'],
  // The prose<->code drift linters. Slow because they read the whole tree.
  prose: ['self-verify', 'prose-agreement', 'weight', 'deferred-reads',
    'include-consumers'],
  // The cross-model call seam.
  review: ['review-provider'],
});

const stems = readdirSync(HERE)
  .filter((f) => f.endsWith('.test.mjs'))
  .map((f) => f.slice(0, -'.test.mjs'.length))
  .sort();

const named = new Set(Object.values(GROUPS).flat());
const other = stems.filter((s) => !named.has(s));
/** @type {Record<string, string[]>} */
const all = { ...GROUPS, ...(other.length ? { other } : {}) };
// A group may name a stem whose file was deleted; run what exists.
for (const [g, list] of Object.entries(all)) all[g] = list.filter((s) => stems.includes(s));

const argv = process.argv.slice(2);

if (argv.includes('--list')) {
  for (const [g, list] of Object.entries(all)) {
    console.log(`${g} (${list.length})\n  ${list.join(' ')}`);
  }
  process.exit(0);
}

const wanted = argv.length ? argv : Object.keys(all);
const unknown = wanted.filter((g) => !(g in all));
if (unknown.length) {
  console.error(`unknown group(s): ${unknown.join(', ')}\n`
    + `known: ${Object.keys(all).join(', ')}`);
  process.exit(2);
}

const files = wanted.flatMap((g) => all[g]).map((s) => join(HERE, `${s}.test.mjs`));
if (!files.length) { console.error('no test files matched'); process.exit(2); }

const r = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(r.status === null ? 1 : r.status);
