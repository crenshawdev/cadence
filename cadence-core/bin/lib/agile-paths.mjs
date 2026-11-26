// @ts-check
// agile-paths.mjs - the one place that spells where the agile path keeps its files, so a planning store can move them later
// pure: a planning root in, a path out
'use strict';

import { join } from 'node:path';

const AGILE_DIR = 'agile';

/** What an old-path project keeps at the top of its planning folder; any one of them means the old path owns it. */
export const OLD_PATH = Object.freeze(['PROJECT.md', 'REQUIREMENTS.md', 'ROADMAP.md', 'STATE.md', 'phases']);

/** @param {string} planningRoot */
export function agileDir(planningRoot) {
  return join(planningRoot, AGILE_DIR);
}

/** Where one start builds the files before a rename puts them in place; the pid keeps two starts apart. @param {string} planningRoot */
export function buildDir(planningRoot, pid = process.pid) {
  return join(planningRoot, `${AGILE_DIR}.new.${pid}`);
}

/** The pid a build folder's name carries, or null when the name isn't one. @param {string} name */
export function buildPid(name) {
  const m = new RegExp(`^${AGILE_DIR}\\.new\\.(\\d+)$`).exec(name);
  return m ? Number(m[1]) : null;
}

/** Where each task's own folder goes. @param {string} agile */
export function agileTasksDir(agile) {
  return join(agile, 'tasks');
}

/** The open todos, seeds and notes a refinement reads. @param {string} agile */
export function agileBacklogFile(agile) {
  return join(agile, 'backlog.md');
}

/** The findings this project's reviews filed as issues. @param {string} agile */
export function agileFiledFile(agile) {
  return join(agile, 'filed.md');
}

/** The findings its reviews raised and the user said no to. @param {string} agile */
export function agileDeclinedFile(agile) {
  return join(agile, 'declined.md');
}

/** The release's requirements and the deferred ones, inside whichever agile folder is being read or built. @param {string} agile */
export function requirementsFile(agile) {
  return join(agile, 'REQUIREMENTS.md');
}

/** The release's own file, inside whichever agile folder is being read or built. @param {string} agile */
export function releaseFile(agile) {
  return join(agile, 'release.md');
}

/** An epic's file, inside whichever agile folder is being read or built. @param {string} agile @param {string} epic */
export function epicFile(agile, epic) {
  return join(agile, 'epics', epic, 'epic.md');
}

/** An epic's retrospective, written as it's accepted. @param {string} agile @param {string} epic */
export function retroFile(agile, epic) {
  return join(agile, 'epics', epic, 'retro.md');
}

/** A story's file, beside its epic's. @param {string} agile @param {string} story */
export function storyFile(agile, story) {
  return join(agile, 'epics', story.replace(/-\d+$/, ''), `${story}.md`);
}

/** The number a story file's name carries in that epic, or null when the name isn't one. @param {string} name @param {string} epic */
export function storyNumber(name, epic) {
  const m = /^(E-\d{2,})-([1-9]\d*)\.md$/.exec(name);
  return m && m[1] === epic ? Number(m[2]) : null;
}
