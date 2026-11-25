#!/usr/bin/env node
// @ts-check
// agile.mjs - the agile path's own script: it starts a release from a Seldon design and says what the open one does next
// not a planning.mjs subcommand: every one of those refuses a project this path owns
//
// Usage: agile.mjs next [--dir <.planning>]
//        agile.mjs start --design <folder> [--dir <.planning>]
//
// one JSON object on stdout; a refusal names the next step
// no lock: each start builds in its own folder and one rename decides, so a killed start never makes the next one wait
'use strict';

import { lstatSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { readDesignFolder } from './planning/design-read.mjs';
import { invalidHint } from './planning/state-import.mjs';
import { agileDir, buildDir, buildPid, epicFile, releaseFile } from './lib/agile-paths.mjs';
import { renderEpicFile, renderProjectFile, renderReleaseFile, renderRequirementsFile } from './lib/agile-render.mjs';
import { judgeDesign } from './lib/agile-judge.mjs';
import { STATUSES, readEpicStatus, readReleaseFile } from './lib/agile-read.mjs';
import { CONTRACTS, rowReader } from './lib/arg-contract.mjs';
import { ensureRecordsIgnore, makeDir, movePath, removeTree, writeFileNew } from './lib/planning-store.mjs';
import { REBUILDABLE, emptyState, markAgile, readState, statePath } from './lib/project-state.mjs';
import { emit, emitCaught } from './lib/seam-io.mjs';

/** @typedef {{reason: string, detail: string, hint: string}} Refusal */

/** What an old-path project keeps at the top of its planning folder; any one of them means the old path owns it. */
const OLD_PATH = ['PROJECT.md', 'REQUIREMENTS.md', 'ROADMAP.md', 'STATE.md', 'phases'];

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
  emit({ ok: false, reason: r.reason, detail: r.detail, hint: r.hint });
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

/** @param {string} dir @param {string} design */
function start(dir, design) {
  const folder = resolve(design);
  if (!statIsDir(folder)) {
    return emit({ ok: false, reason: 'no-design-dir', detail: `${folder} is not a folder`,
      hint: 'point --design at the folder Seldon wrote the design into, then re-run; nothing was written' });
  }
  const early = refusal(dir);
  if (early) return refuse(early);
  const { read, issues } = readDesignFolder(folder);
  const decisions = [...read.decisions.values()];
  // a design with a document missing has no text to judge, and its own issue says so
  if (!issues.length) issues.push(...judgeDesign(read.design.phases, read.lost, read.design.title, read.design.brief, decisions));
  if (issues.length) {
    return emit({ ok: false, reason: 'design-refused',
      detail: `the design in ${folder} has ${issues.length} problem${issues.length === 1 ? '' : 's'} - the issues list names each`,
      issues,
      hint: 'fix each issue in the design folder, by a Seldon rerun of that document or by hand, then re-run; nothing was written' });
  }

  const { title, brief, requirements, phases: epics, uncovered } = read.design;
  makeDir(dir);
  // the marker goes first: a run that dies after it leaves a project the old path refuses, and the next start finishes
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
  else if (argv[0] === 'start') start(planningDir(arg('start', '--dir')), arg('start', '--design'));
  else emit({ ok: false, reason: 'usage', detail: 'subcommand: next [--dir <.planning>] | start --design <folder> [--dir <.planning>]' });
} catch (e) {
  emitCaught(e);
}
