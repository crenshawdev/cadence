#!/usr/bin/env node
// @ts-check
// agile.mjs - the agile path's own script: it says what a start still has to ask, starts a release from a Seldon design
// and says what the open one does next
// not a planning.mjs subcommand: every one of those refuses a project this path owns
//
// Usage: agile.mjs next [--dir <.planning>]
//        agile.mjs check --design <folder> [--dir <.planning>]
//        agile.mjs start --design <folder> [--dir <.planning>]
//
// one JSON object on stdout; a refusal names the next step
// no lock: each start builds in its own folder and one rename decides, so a killed start never makes the next one wait
'use strict';

import { lstatSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readDesignFolder } from './planning/design-read.mjs';
import { scanSurfaces } from './planning/detect-surfaces.mjs';
import { invalidHint } from './planning/state-import.mjs';
import { writePolicy } from './planning/testing-policy.mjs';
import { OLD_PATH, agileDir, buildDir, buildPid, epicFile, releaseFile } from './lib/agile-paths.mjs';
import { limits, renderEpicFile, renderProjectFile, renderReleaseFile, renderRequirementsFile } from './lib/agile-render.mjs';
import { judgeDesign } from './lib/agile-judge.mjs';
import { STATUSES, readEpicStatus, readReleaseFile } from './lib/agile-read.mjs';
import { namedReviewers, unanswered } from './lib/agile-setup.mjs';
import { CONTRACTS, rowReader } from './lib/arg-contract.mjs';
import { boundedRun } from './lib/bounded-run.mjs';
import { mergeLayers } from './lib/config-merge.mjs';
import { ensureRecordsIgnore, makeDir, movePath, removeTree, writeFileNew } from './lib/planning-store.mjs';
import { REBUILDABLE, emptyState, markAgile, readState, statePath } from './lib/project-state.mjs';
import { emit, emitCaught } from './lib/seam-io.mjs';
import { interviewOptions } from './lib/surface-scan.mjs';

/** @typedef {{reason: string, detail: string, hint: string, issues?: unknown[]}} Refusal */

/** Both calls `check` makes out are local reads, so this only guards a wedged filesystem. */
const CHILD_TIMEOUT_MS = 10000;

/** @param {string} path @returns {import('node:fs').Stats | null} */
function lstatOf(path) {
  try { return lstatSync(path); } catch { return null; }
}

/** Remove a folder another start may be removing too. @param {string} path */
function clear(path) {
  try { removeTree(path); } catch (e) { if (/** @type {any} */ (e).code !== 'ENOENT') throw e; }
}

/** @param {Refusal} r */
function refuse(r) {
  emit({ ok: false, reason: r.reason, detail: r.detail, ...(r.issues ? { issues: r.issues } : {}), hint: r.hint });
}

/** Is that process still running? EPERM means it is, and someone else's. @param {number} pid */
function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return /** @type {any} */ (e).code === 'EPERM'; }
}

/** @param {string} dir @returns {Refusal} */
function releaseOpen(dir) {
  return { reason: 'release-open', detail: `${agileDir(dir)} already holds a release`,
    hint: 'run /cad-agile, which names that release\'s next step; nothing was written' };
}

/** @param {string} dir @returns {Refusal} */
function unmarked(dir) {
  return { reason: 'unmarked', detail: `${agileDir(dir)} is there but ${statePath(dir)} does not say the project is on the agile path`,
    hint: 'put the state file back from git or your backup, or move that folder aside, then re-run; nothing was written' };
}

/**
 * Why a release can't start in this planning folder, or null.
 * @param {string} dir @returns {Refusal | null}
 */
function refusal(dir) {
  const st = lstatOf(dir);
  if (st === null) return null;
  if (!st.isDirectory()) {
    return { reason: 'planning-dir', detail: `${dir} is not a real folder`,
      hint: 'move it aside, or point --dir at the real planning folder, then re-run; nothing was written' };
  }
  const state = readState(dir);
  const marked = state.kind === 'invalid' && state.reason === 'agile-path';
  const release = lstatOf(agileDir(dir)) !== null;
  if (marked && release) return releaseOpen(dir);
  // a marker too damaged to read is still this path's, and the old path's hint for one rebuilds it as an old-path state
  if (release && state.kind === 'invalid' && REBUILDABLE.includes(state.reason)) return unmarked(dir);
  // a marked project keeps its own archives there, so only an unmarked one's archives are the old path's
  const old = readdirSync(dir).filter((name) => OLD_PATH.includes(name) || (!marked && name.startsWith('_archive-'))).sort();
  if (!marked && state.kind === 'invalid') {
    return { reason: 'old-path', detail: `${statePath(dir)}: ${state.reason} - ${state.detail}`, hint: invalidHint(state.reason) };
  }
  if (state.kind === 'valid' && !emptyState(state.state)) old.push(statePath(dir));
  if (old.length) {
    return { reason: 'old-path', detail: `${dir} belongs to an old-path project: ${old.join(', ')}`,
      hint: 'close that project\'s release with /cad-milestone and land it with /cad-land before it can leave the old path; nothing was written' };
  }
  return release && !marked ? unmarked(dir) : null;
}

/**
 * One of the release's files, read back. A file that isn't there and one that doesn't read are the same refusal, since
 * both mean the release can't say what's next.
 * @template T @param {string} file @param {string} want @param {(text: string) => T | null} read
 * @returns {{value: T} | {refusal: Refusal}}
 */
function readBack(file, want, read) {
  /** @type {T | null} */
  let value = null;
  let detail = `${file} does not hold ${want}`;
  try { value = read(readFileSync(file, 'utf8')); } catch (e) { detail = `${file} could not be read: ${/** @type {any} */ (e).code}`; }
  return value !== null ? { value } : { refusal: { reason: 'release-damaged', detail,
    hint: 'put that file back from git or your backup, or fix what the detail names, then re-run; nothing was written' } };
}

/** @param {string} dir */
function next(dir) {
  const why = refusal(dir);
  if (why === null) return emit({ ok: true, release: null, next: null });
  if (why.reason !== 'release-open') return refuse(why);
  const release = readBack(releaseFile(agileDir(dir)), 'a "# Release:" title and a "## Epics" list of "- E-01: name" lines', readReleaseFile);
  if ('refusal' in release) return refuse(release.refusal);
  for (const { id, name } of release.value.epics) {
    const status = readBack(epicFile(agileDir(dir), id), `a status of ${STATUSES.join(', ')}`, readEpicStatus);
    if ('refusal' in status) return refuse(status.refusal);
    if (status.value !== 'done') return emit({ ok: true, release: release.value.title, next: { id, name, status: status.value } });
  }
  emit({ ok: true, release: release.value.title, next: null });
}

/**
 * The design and the project's settings, or why no start can go ahead here. It writes nothing.
 * @param {string} dir @param {string} design
 */
function ready(dir, design) {
  const no = (/** @type {Refusal} */ refusal) => ({ refusal });
  const folder = resolve(design);
  if (!statIsDir(folder)) {
    return no({ reason: 'no-design-dir', detail: `${folder} is not a folder`,
      hint: 'point --design at the folder Seldon wrote the design into, then re-run; nothing was written' });
  }
  const early = refusal(dir);
  if (early) return no(early);
  const { read, issues } = readDesignFolder(folder);
  const decisions = [...read.decisions.values()];
  // a design with a document missing has no text to judge, and its own issue says so
  if (!issues.length) issues.push(...judgeDesign(read.design.phases, read.lost, read.design.title, read.design.brief, decisions));
  if (issues.length) {
    return no({ reason: 'design-refused',
      detail: `the design in ${folder} has ${issues.length} problem${issues.length === 1 ? '' : 's'} - the issues list names each`,
      issues,
      hint: 'fix each issue in the design folder, by a Seldon rerun of that document or by hand, then re-run; nothing was written' });
  }
  const { config, warnings, tornLayers } = mergeLayers(join(dir, 'config.json'));
  // a layer that can't be read would ask again for what it already answers
  if (tornLayers.length) {
    return no({ reason: 'config-unreadable', detail: warnings.join('; '),
      hint: 'repair the config file the detail names, then re-run; nothing was written' });
  }
  return { design: read.design, decisions, config };
}

/** Can git say who it would commit as? `git var` judges that the way a commit does. @param {string} root */
function hasIdentity(root) {
  return ['GIT_AUTHOR_IDENT', 'GIT_COMMITTER_IDENT'].every((name) =>
    boundedRun('git', ['var', name], { cwd: root, timeout: CHILD_TIMEOUT_MS }).ok);
}

/** The project's reviewers, read by the resolve every review makes. @param {string} dir @param {any} config */
function reviewersOf(dir, config) {
  // --no-record, or asking would write to the run record before anything is started
  const r = boundedRun(process.execPath, [fileURLToPath(new URL('route.mjs', import.meta.url)), 'resolve', '--role', 'cad-reviewer',
    '--no-record', '--file', join(resolve(dir), 'config.json')], { cwd: dirname(resolve(dir)), timeout: CHILD_TIMEOUT_MS });
  if (!r.ok) throw new Error('route.mjs could not say who reviews this project');
  const resolved = JSON.parse(r.stdout);
  return { ...namedReviewers(config, resolved), warnings: resolved.warnings ?? [] };
}

/** Everything a start needs to ask, and nothing written. @param {string} dir @param {string} design */
function check(dir, design) {
  const got = ready(dir, design);
  if ('refusal' in got) return refuse(got.refusal);
  const root = dirname(resolve(dir));
  if (!hasIdentity(root)) {
    return refuse({ reason: 'no-git-identity', detail: 'git has no name and email to commit with here',
      hint: 'set them with git config --global user.name and git config --global user.email, then re-run; nothing was written' });
  }
  const open = unanswered(got.config);
  /** @type {Record<string, unknown>} */
  const ask = {};
  if (open.includes('surfaces')) {
    const scanned = scanSurfaces(root);
    if ('error' in scanned) throw new Error(`${root} cannot be listed (${scanned.error})`);
    ask.surfaces = interviewOptions(scanned.scan);
  }
  if (open.includes('testing')) ask.constraints = limits(got.decisions);
  emit({ ok: true, release: got.design.title, epics: got.design.phases.length, unanswered: open, ...ask,
    reviewers: reviewersOf(dir, got.config) });
}

/** @param {string} dir @param {string} design */
function start(dir, design) {
  const got = ready(dir, design);
  if ('refusal' in got) return refuse(got.refusal);
  const open = unanswered(got.config);
  if (open.length) {
    return refuse({ reason: 'setup-unanswered', detail: `this project's setup still has ${open.join(', ')} to answer`,
      hint: 'run /cad-agile --brief with this design, which asks for each; nothing was written' });
  }

  const { decisions, design: { title, brief, requirements, phases: epics, uncovered } } = got;
  makeDir(dir);
  // here because `test-policy render` refuses a marked project, so a start that died would leave it unwritten for good
  writePolicy(dirname(resolve(dir)), got.config.testing);
  // of the release, the marker goes first: a run that dies after it leaves a project the old path refuses, and the next start finishes
  const marked = markAgile(dir);
  if (marked.ok === false) {
    return emit({ ok: false, reason: marked.reason, detail: `${statePath(dir)}: ${marked.detail}`,
      hint: marked.reason === 'state-locked'
        ? 'another command is writing here, or one was killed doing it - re-run in two minutes, or remove the lock the detail names now if nothing else is running; no release file was written'
        : 'fix the cause the detail names, then re-run; no release file was written' });
  }
  // a start killed as it made the records folder never got to its ignore file
  ensureRecordsIgnore(dir);
  for (const name of readdirSync(dir)) {
    const pid = buildPid(name);
    // a dead run's half-built folder, or this pid's own from before a reboot
    if (pid !== null && (pid === process.pid || !alive(pid))) clear(join(dir, name));
  }
  const building = buildDir(dir);
  for (const e of epics) {
    makeDir(dirname(epicFile(building, e.epic)));
    writeFileNew(epicFile(building, e.epic), renderEpicFile(e));
  }
  writeFileNew(join(building, 'project.md'), renderProjectFile(title, brief, epics, decisions));
  writeFileNew(join(building, 'REQUIREMENTS.md'), renderRequirementsFile(title, requirements));
  writeFileNew(releaseFile(building), renderReleaseFile(title, brief, epics));
  try {
    movePath(building, agileDir(dir));
  } catch (e) {
    // two starts at once: the first rename won, and a folder never renames over a full one
    if (lstatOf(agileDir(dir)) === null) throw e;
    removeTree(building);
    return refuse(releaseOpen(dir));
  }
  emit({ ok: true, release: title, folder: agileDir(dir), epics: epics.map((e) => ({ id: e.epic, name: e.name })), uncovered,
    next: { id: epics[0].epic, name: epics[0].name, status: 'backlog' } });
}

/** A trailing slash makes lstat follow a link, so it comes off before anything is judged. @param {string | undefined} given */
function planningDir(given) {
  return (given || '.planning').replace(/[/\\]+$/, '') || '/';
}

/** @param {string} path */
function statIsDir(path) {
  try { return statSync(path).isDirectory(); } catch { return false; }
}

const argv = process.argv.slice(2);
const arg = rowReader(argv, CONTRACTS['agile.mjs']);

try {
  if (argv[0] === 'next') next(planningDir(arg('next', '--dir')));
  else if (argv[0] === 'check') check(planningDir(arg('check', '--dir')), arg('check', '--design'));
  else if (argv[0] === 'start') start(planningDir(arg('start', '--dir')), arg('start', '--design'));
  else emit({ ok: false, reason: 'usage', detail: 'subcommand: next [--dir <.planning>] | check|start --design <folder> [--dir <.planning>]' });
} catch (e) {
  emitCaught(e);
}
