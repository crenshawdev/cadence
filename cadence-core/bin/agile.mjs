#!/usr/bin/env node
// @ts-check
// agile.mjs - the agile path's own script: it says what a start still has to ask, starts a release from a Seldon design,
// holds an epic's refinement, moves a story through its build and runs its checks, gives a finished epic's Evidence and accepts it,
// closes the release, and says what the open release does next
// not a planning.mjs subcommand: those belong to the old path, and all but a few refuse a project this path owns
//
// Usage: agile.mjs next [--dir <.planning>]
//        agile.mjs check --design <folder> [--dir <.planning>]
//        agile.mjs start --design <folder> [--commit-here <branch>] [--dir <.planning>]
//        agile.mjs answer|propose|refine|size|check-commands|note|not-yet --payload <file> [--dir <.planning>]
//        agile.mjs accept|close [--payload <file>] [--dir <.planning>]
//        agile.mjs run-checks [--dir <.planning>]
//        agile.mjs move --to in-progress|review [--dir <.planning>]
//        agile.mjs evidence [--dir <.planning>]
//
// one JSON object on stdout; a refusal names the next step
// no lock: each start builds in its own folder and one rename decides (after a close, its epics' rename), and a refinement's
// last write is the one that counts, so a killed run never makes the next one wait
'use strict';

import { spawn } from 'node:child_process';
import { lstatSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readDesignFolder } from './planning/design-read.mjs';
import { scanSurfaces } from './planning/detect-surfaces.mjs';
import { invalidHint } from './planning/state-import.mjs';
import { writePolicy } from './planning/testing-policy.mjs';
import { readJsonPayload } from './planning/core.mjs';
import { OLD_PATH, agileBacklogFile, agileDir, buildDir, buildPid, closingDir, closingVersion, epicFile, tagSafeVersion as tagSafe, projectFile, releaseFile, releasesDir, requirementsFile, retroFile, storyFile, storyNumber } from './lib/agile-paths.mjs';
import { limits, lessonRecord, renderAnswers, renderAskChanged, renderEpicFile, renderNotYet, renderProjectFile, renderRefinedEpic, renderReleaseFile, renderReleaseSplit, renderRequirementsFile, renderRetro, renderSplitEpic, renderStandingRules, renderStoryFile, renderStoryPlan, renderStoryResult, checkLines, withSize, withStandingRules, withStatus } from './lib/agile-render.mjs';
import { epicEvidence, renderEvidence } from './lib/agile-evidence.mjs';
import { judgeDesign } from './lib/agile-judge.mjs';
import { STATUSES, readChangeNext, readEpicFile, readEpicStatus, readLessonRecords, readNotYet, readReleaseFile, readRequirementsFile, readStoryChecks, readStoryFile, readStoryPlan, readStoryResult } from './lib/agile-read.mjs';
import { judgeAnswers, judgeAsk, judgeLessons, judgeSplit, judgeStories } from './lib/agile-refine.mjs';
import { namedReviewers, unanswered } from './lib/agile-setup.mjs';
import { CONTRACTS, rowReader } from './lib/arg-contract.mjs';
import { boundedRun } from './lib/bounded-run.mjs';
import { adviseBranch } from './lib/branch-advice.mjs';
import { captureLines, removeCaptures } from './lib/capture-file.mjs';
import { mergeLayers } from './lib/config-merge.mjs';
import { readCurrentBranch } from './lib/git-head.mjs';
import { signingProblem } from './lib/git-signing.mjs';
import { atomicWrite, ensureRecordsIgnore, makeDir, movePath, removeTree, unlinkFile, writeFileNew } from './lib/planning-store.mjs';
import { REBUILDABLE, emptyState, markAgile, readState, statePath } from './lib/project-state.mjs';
import { emit, emitCaught } from './lib/seam-io.mjs';
import { interviewOptions } from './lib/surface-scan.mjs';

/** @typedef {{reason: string, detail: string, hint: string, issues?: unknown[]}} Refusal */

/** The identity and reviewer calls are local reads, so this only guards a wedged filesystem. */
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

/** The release folder's closes: one under way, and the versions already closed. @param {string} agile */
function closes(agile) {
  let names = [];
  try { names = readdirSync(releasesDir(agile)); } catch (e) { if (/** @type {any} */ (e).code !== 'ENOENT') throw e; }
  const closing = names.map(closingVersion).filter((v) => v !== null).sort()[0] ?? null;
  return { closing, closed: names.filter((n) => !n.startsWith('.')).sort() };
}

/** @param {string} dir @param {string[]} closed @returns {Refusal} */
function releaseClosed(dir, closed) {
  return { reason: 'release-closed', detail: `${agileDir(dir)} holds the release closed as ${closed.at(-1)}, and a start makes that folder new`,
    hint: `move ${agileDir(dir)} aside to start the next release here; nothing was written` };
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
  if (marked && release) {
    // closed: its files went to releases/, and only a close under way still counts as open
    const { closing, closed } = closes(agileDir(dir));
    return closing === null && closed.length && lstatOf(releaseFile(agileDir(dir))) === null ? releaseClosed(dir, closed) : releaseOpen(dir);
  }
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

/** An epic's stories are the story files in its folder, in number order. @param {string} agile @param {string} epic */
function storyIds(agile, epic) {
  return readdirSync(dirname(epicFile(agile, epic))).map((name) => storyNumber(name, epic)).filter((n) => n !== null)
    .sort((a, b) => a - b).map((n) => `${epic}-${n}`);
}

/** @param {string} agile @param {string} epic */
function storiesOf(agile, epic) {
  /** @type {import('./lib/agile-read.mjs').Story[]} */
  const value = [];
  for (const id of storyIds(agile, epic)) {
    const story = readBack(storyFile(agile, id), `the story ${id}`, (text) => {
      const read = readStoryFile(text);
      return read?.id === id ? read : null;
    });
    if ('refusal' in story) return story;
    value.push(story.value);
  }
  return { value };
}

/**
 * The highest story number the epic has used: its story files and the IDs its own file names, so one a refinement
 * replaced and removed is never handed out again.
 * @param {string} agile @param {string} epic
 */
function usedNumber(agile, epic) {
  const named = [...readFileSync(epicFile(agile, epic), 'utf8').matchAll(new RegExp(`\\b${epic}-(\\d+)\\b`, 'g'))].map((m) => Number(m[1]));
  return Math.max(0, ...storyIds(agile, epic).map((id) => Number(id.slice(epic.length + 1))), ...named);
}

/**
 * What an epic that isn't done does next. An L is never built, so an epic holding one is refined again.
 * @param {string} agile @param {string} epic @param {string} status
 * @returns {{value: {step: string, first?: string, story?: {id: string, title: string, size: string, status: string}}} | {refusal: Refusal}}
 */
function stepOf(agile, epic, status) {
  if (status !== 'in-progress') return { value: { step: status === 'backlog' ? 'refine' : 'accept' } };
  const stories = storiesOf(agile, epic);
  if ('refusal' in stories) return stories;
  if (!stories.value.length) {
    return { refusal: { reason: 'release-damaged', detail: `${dirname(epicFile(agile, epic))} holds no story, and ${epic} is in progress`,
      hint: 'put its story files back from git or your backup, then re-run; nothing was written' } };
  }
  // one already being built is finished before anything is cut again, or its work would be replaced
  const begun = stories.value.find((s) => s.status === 'in-progress' || s.status === 'review');
  const open = begun ?? stories.value.find((s) => s.status !== 'done');
  if (!begun && stories.value.some((s) => s.status !== 'done' && s.size === 'L')) return { value: { step: 'refine', first: `${epic}-${usedNumber(agile, epic) + 1}` } };
  // the user said what's missing, so it's cut again before the epic is asked about again; until the cut's line closes it,
  // a story not done is one a cut stopped short left, and the cut replaces it rather than building it
  if (!begun && readNotYet(readFileSync(epicFile(agile, epic), 'utf8')) !== null) return { value: { step: 'refine', first: `${epic}-${usedNumber(agile, epic) + 1}` } };
  return { value: open ? { step: 'build', story: { id: open.id, title: open.title, size: open.size, status: open.status } } : { step: 'accept' } };
}

/**
 * The open release's next step, or why it can't say. It writes nothing.
 * @param {string} dir
 */
function whatsNext(dir) {
  const why = refusal(dir);
  if (why === null || why.reason === 'release-closed') return { release: null, epics: [], next: null };
  if (why.reason !== 'release-open') return { refusal: why };
  const agile = agileDir(dir);
  // a close stopped while its files moved: release.md may be either side, and only finishing the move is left
  const { closing } = closes(agile);
  if (closing !== null) {
    const title = [releaseFile(agile), releaseFile(closingDir(agile, closing))].map((f) => { try { return readReleaseFile(readFileSync(f, 'utf8'))?.title; } catch { return undefined; } }).find(Boolean);
    return { release: title ?? closing, epics: [], next: { id: closing, name: title ?? closing, status: 'done', step: 'close', story: undefined, closing } };
  }
  const release = readBack(releaseFile(agile), 'a "# Release:" title and a "## Epics" list of "- E-01: name" lines', readReleaseFile);
  if ('refusal' in release) return release;
  const { title, epics } = release.value;
  for (const { id, name } of epics) {
    const status = readBack(epicFile(agile, id), `a status of ${STATUSES.join(', ')}`, readEpicStatus);
    if ('refusal' in status) return status;
    if (status.value === 'done') continue;
    const step = stepOf(agile, id, status.value);
    if ('refusal' in step) return step;
    return { release: title, epics, next: { id, name, status: status.value, ...step.value } };
  }
  return { release: title, epics, next: null };
}

/**
 * The Change next lines of each accepted epic's retrospective, up to the one being refined, that no epic's Decisions
 * records yet. An epic accepted with no retrospective has none.
 * @param {string} agile @param {{id: string}[]} epics @param {string} epic
 * @returns {{value: {from: string, line: number, text: string}[]} | {refusal: Refusal}}
 */
function openLessons(agile, epics, epic) {
  const recorded = new Set();
  /** @type {{from: string, line: number, text: string}[]} */
  const said = [];
  for (const { id } of epics.slice(0, epics.findIndex((e) => e.id === epic) + 1)) {
    const text = readFileSync(epicFile(agile, id), 'utf8');
    for (const key of readLessonRecords(text)) recorded.add(key);
    if (readEpicStatus(text) !== 'done' || lstatOf(retroFile(agile, id)) === null) continue;
    const retro = readBack(retroFile(agile, id), 'a "## Change next" section', readChangeNext);
    if ('refusal' in retro) return retro;
    said.push(...retro.value.map((l) => ({ from: id, line: l.line, text: l.text })));
  }
  return { value: said.filter((l) => !recorded.has(`${l.from} ${l.line}`)) };
}

/**
 * Each requirement of the release, done, deferred or open: done when a story names it and every story naming it is
 * done in an epic that's done, deferred when it's under Deferred, open otherwise. It writes nothing.
 * @param {string} agile @param {{id: string}[]} epics
 */
function traced(agile, epics) {
  // the close is gated on this count, so a line its writer wouldn't write is one it can't count and nothing passes over it
  const file = readBack(requirementsFile(agile), 'only its writer\'s lines: a "# Requirements:" title, then "## Requirements" with "- **ID**: text" lines under "### " categories, then "## Deferred"', (t) => {
    const read = readRequirementsFile(t);
    return read.title === null || !read.whole ? null : read;
  });
  if ('refusal' in file) return file;
  const listed = new Set([...file.value.requirements, ...file.value.deferred].map((q) => q.id));
  /** @type {Map<string, {story: string, done: boolean}[]>} */
  const on = new Map();
  for (const { id } of epics) {
    const epic = readBack(epicFile(agile, id), `a status of ${STATUSES.join(', ')}, a requirements line and a "## Decisions" section`, (t) => {
      const status = readEpicStatus(t);
      const read = readEpicFile(t);
      return status && read ? { status, requirements: read.requirements } : null;
    });
    if ('refusal' in epic) return epic;
    const stories = storiesOf(agile, id);
    if ('refusal' in stories) return stories;
    // a requirement dropped from the file would otherwise read as nothing left open
    for (const [where, ids] of [[epicFile(agile, id), epic.value.requirements], ...stories.value.map((s) => [storyFile(agile, s.id), s.requirements])]) {
      const lost = /** @type {string[]} */ (ids).filter((q) => !listed.has(q));
      if (lost.length) {
        return { refusal: { reason: 'release-damaged', detail: `${where} names ${lost.join(', ')}, which ${requirementsFile(agile)} lists nowhere`,
          hint: 'put the requirement back in REQUIREMENTS.md from git or your backup, or take it off that file, then re-run; nothing was written' } };
      }
    }
    for (const s of stories.value) {
      for (const q of s.requirements) on.set(q, [...(on.get(q) ?? []), { story: s.id, done: s.status === 'done' && epic.value.status === 'done' }]);
    }
  }
  const row = (/** @type {{id: string, text: string}} */ q, /** @type {string} */ status) => ({ id: q.id, text: q.text, status, stories: (on.get(q.id) ?? []).map((s) => s.story) });
  return { value: [...file.value.requirements.map((q) => row(q, (on.get(q.id) ?? []).length && /** @type {{done: boolean}[]} */ (on.get(q.id)).every((s) => s.done) ? 'done' : 'open')),
    ...file.value.deferred.map((q) => row(q, 'deferred'))] };
}

/** @param {string} dir */
function next(dir) {
  const at = whatsNext(dir);
  if ('refusal' in at) return refuse(at.refusal);
  // every epic done: what's left is the close, and it needs each requirement done or deferred
  if (at.next === null && at.release !== null) {
    const trace = traced(agileDir(dir), at.epics);
    if ('refusal' in trace) return refuse(trace.refusal);
    return emit({ ok: true, release: at.release, next: { step: 'close', requirements: trace.value } });
  }
  if (at.next?.step !== 'refine') return emit({ ok: true, release: at.release, next: at.next });
  const lessons = openLessons(agileDir(dir), at.epics, at.next.id);
  if ('refusal' in lessons) return refuse(lessons.refusal);
  emit({ ok: true, release: at.release, next: { ...at.next, ...(lessons.value.length ? { change_next: lessons.value } : {}) } });
}

/** @param {string} detail @returns {Refusal} */
function notRefinable(detail) {
  return { reason: 'not-refinable', detail, hint: 'run /cad-agile, which does the next step; nothing was written' };
}

/** @param {string} reason @param {string} what @param {unknown[]} issues @returns {Refusal} */
function payloadRefused(reason, what, issues) {
  return { reason, issues, detail: `${what} ${issues.length} problem${issues.length === 1 ? '' : 's'} - the issues list names each`,
    hint: 'fix each issue in the payload, then re-run; nothing was written' };
}

/**
 * The epic up for refinement and the payload about it, or null when the refusal is already out.
 * @param {string} dir @param {string} payloadFile
 */
function refinement(dir, payloadFile) {
  const no = (/** @type {Refusal} */ r) => { refuse(r); return null; };
  const at = whatsNext(dir);
  if ('refusal' in at) return no(at.refusal);
  if (at.next?.step !== 'refine') {
    const now = at.next ? `to ${at.next.step} ${at.next.story?.id ?? at.next.id}` : at.release === null ? 'to start a release' : 'to close the release';
    return no(notRefinable(`no epic is up for refinement - the next step here is ${now}`));
  }
  const epic = at.next.id;
  const payload = readJsonPayload(payloadFile);
  if (!payload.ok) return null;
  // a list drafted for one epic must not land on another; one that names none is the payload's own problem
  const named = payload.value?.epic;
  if (typeof named === 'string' && named !== epic) return no(notRefinable(`the payload's epic is ${named}, and the one up for refinement is ${epic}`));
  const agile = agileDir(dir);
  const file = epicFile(agile, epic);
  let text = '';
  const held = readBack(file, 'a requirements line and a "## Decisions" section', (t) => { text = t; return readEpicFile(t); });
  if ('refusal' in held) return no(held.refusal);
  const again = at.next.status === 'in-progress';
  // a dead run's leftovers are all backlog, or too broken to say, and neither counts; cut again, a done story stays as it is
  for (const id of storyIds(agile, epic)) {
    const status = readEpicStatus(readFileSync(storyFile(agile, id), 'utf8'));
    if (status === null || status === 'backlog' || (again && status === 'done')) continue;
    return no(again
      ? { reason: 'stories-begun', detail: `${epic} holds an L to cut again, and its story ${id} is ${status}`,
        hint: `run /cad-agile, which builds ${id} before ${epic} is cut again; nothing was written` }
      : { reason: 'stories-begun', detail: `${epic} is marked backlog and its story ${id} is ${status}`,
        hint: `set the status in ${file} back to in-progress, then re-run; nothing was written` });
  }
  return { agile, file, text, epic, next: at.next, epics: at.epics, release: at.release, requirements: held.value.requirements, payload: payload.value };
}

/** The question an epic's first build asks, and its two answers as agile-build.md words them. */
const FINDINGS_RULE = Object.freeze({ question: 'How are review findings handled?', answers: Object.freeze(['Fix them, ask about lows', 'Ask me each time']) });

/** Save what the user answered, as they answer it: at refinement, or the findings rule at an epic's first build. @param {string} dir @param {string} payloadFile */
function answer(dir, payloadFile) {
  const at = whatsNext(dir);
  if (!('refusal' in at) && at.next?.step === 'build') {
    const epic = at.next.id;
    const payload = readJsonPayload(payloadFile);
    if (!payload.ok) return undefined;
    const named = payload.value?.epic;
    if (typeof named === 'string' && named !== epic) return refuse(notRefinable(`the payload's epic is ${named}, and the one being built is ${epic}`));
    const file = epicFile(agileDir(dir), epic);
    let text = '';
    const held = readBack(file, 'a requirements line and a "## Decisions" section', (t) => { text = t; return readEpicFile(t); });
    if ('refusal' in held) return refuse(held.refusal);
    const { issues, answers } = judgeAnswers(payload.value, epic);
    // a build asks one question, and any other answer here would write over what its refinement decided
    if (!issues.length && (answers.length !== 1 || answers[0].question !== FINDINGS_RULE.question || !FINDINGS_RULE.answers.includes(answers[0].answer))) {
      issues.push({ field: 'answers', problem: `while ${epic} is built, the one answer saved is to ${JSON.stringify(FINDINGS_RULE.question)}, and it is ${FINDINGS_RULE.answers.map((a) => JSON.stringify(a)).join(' or ')}` });
    }
    if (issues.length) return refuse(payloadRefused('answers-refused', `the answers for ${epic} have`, issues));
    atomicWrite(file, renderAnswers(text, answers));
    return emit({ ok: true, epic, saved: answers.length });
  }
  const up = refinement(dir, payloadFile);
  if (up === null) return undefined;
  const { issues, answers } = judgeAnswers(up.payload, up.epic);
  if (issues.length) return refuse(payloadRefused('answers-refused', `the answers for ${up.epic} have`, issues));
  atomicWrite(up.file, renderAnswers(up.text, answers));
  emit({ ok: true, epic: up.epic, saved: answers.length });
}

/** The ID one past the release's highest epic, at the width its IDs are written. @param {{id: string}[]} epics */
function nextEpic(epics) {
  const top = epics.map((e) => e.id.slice(2)).sort((a, b) => Number(b) - Number(a))[0];
  return `E-${String(Number(top) + 1).padStart(top.length, '0')}`;
}

/**
 * The payload's list judged, or null when the refusal is already out. It writes nothing.
 * @param {string} dir @param {string} payloadFile
 */
function judged(dir, payloadFile) {
  const up = refinement(dir, payloadFile);
  if (up === null) return null;
  const no = (/** @type {Refusal} */ r) => { refuse(r); return null; };
  /** @type {string[]} */
  const earlier = [];
  for (const { id } of up.epics.slice(0, up.epics.findIndex((e) => e.id === up.epic))) {
    const stories = storiesOf(up.agile, id);
    if ('refusal' in stories) return no(stories.refusal);
    earlier.push(id, ...stories.value.map((s) => s.id));
  }
  /** @type {Set<string>} */
  const onEpics = new Set();
  /** @type {{id: string, read: import('./lib/agile-read.mjs').EpicRead}[]} */
  const read = [];
  for (const { id } of up.epics) {
    const line = readBack(epicFile(up.agile, id), 'a requirements line and a "## Decisions" section', readEpicFile);
    if ('refusal' in line) return no(line.refusal);
    for (const q of line.value.requirements) onEpics.add(q);
    read.push({ id, read: line.value });
  }
  const self = /** @type {import('./lib/agile-read.mjs').EpicRead} */ (read.find((e) => e.id === up.epic)?.read);
  const split = up.payload !== null && typeof up.payload === 'object' ? up.payload.split : undefined;
  const from = read.filter((e) => e.read.split_from === up.epic);
  // a run cut short's rest: this epic hasn't turned, so its line still names all the rest carries
  const stopped = from.filter((e) => e.read.requirements.every((id) => up.requirements.includes(id)));
  // one the same split finishes rather than lists twice
  const again = stopped.find((e) => e.read.title === split?.name) ?? null;
  const left = stopped.filter((e) => e !== again);
  const off = new Set(from.filter((e) => e !== again).flatMap((e) => e.read.requirements));
  let text = '';
  const file = readBack(requirementsFile(up.agile), 'a "# Requirements:" title, then "## Requirements" with "- **ID**: text" lines under "### " categories, then "## Deferred"',
    (t) => { text = t; return readRequirementsFile(t); });
  if ('refusal' in file) return no(file.refusal);
  // cut again: done stories stay, carry what they carry and may be built on, and the list numbers past every ID used
  const mine = up.next.status === 'in-progress' ? storiesOf(up.agile, up.epic) : { value: [] };
  if ('refusal' in mine) return no(mine.refusal);
  const done = mine.value.filter((s) => s.status === 'done');
  const kept = done.flatMap((s) => s.requirements);
  // what an epic split from this one carries is off this one, as Deferred is off every epic
  const ask = judgeAsk(up.payload, { own: up.requirements.filter((id) => !off.has(id)), file: file.value, named: onEpics, kept });
  if ((ask.defer.length || ask.add.length) && !file.value.whole) {
    return no({ reason: 'release-damaged', detail: `${requirementsFile(up.agile)} holds a line its own writer doesn't, and deferring or adding would rewrite the file without it`,
      hint: 'move that line out of the file, or leave defer and add empty, then re-run; nothing was written' });
  }
  const cut = judgeSplit(split, { ...self, id: up.epic, requirements: ask.requirements, added: ask.add.map((q) => q.id), kept, rest: again?.id ?? nextEpic(up.epics) });
  const list = judgeStories(up.payload, { id: up.epic, requirements: cut.requirements, earlier: [...earlier, ...done.map((s) => s.id)],
    backlog: captureLines(agileBacklogFile(up.agile)), start: mine.value.length ? usedNumber(up.agile, up.epic) + 1 : 1,
    covered: kept, again: mine.value.length > 0 });
  const open = openLessons(up.agile, up.epics, up.epic);
  if ('refusal' in open) return no(open.refusal);
  const taken = judgeLessons(up.payload, open.value);
  // read before anything is written, since the standing ones go there
  const project = taken.lessons.length ? readBack(projectFile(up.agile), 'the project\'s own file', (t) => t) : { value: '' };
  if ('refusal' in project) return no(project.refusal);
  const issues = [...ask.issues, ...cut.issues, ...list.issues, ...taken.issues];
  if (issues.length) {
    for (const e of left) {
      issues.push({ field: 'split', problem: `${e.id} ${e.read.title} was split off ${up.epic} by a run cut short and carries ${e.read.requirements.join(', ')} - leave those to it, or give a split named ${JSON.stringify(e.read.title)} to finish it` });
    }
    return no(payloadRefused('stories-refused', `the stories for ${up.epic} have`, issues));
  }
  // on no epic: one the design left there, or one a refinement cut short added
  const unplaced = file.value.requirements.filter((q) => !onEpics.has(q.id) && !ask.add.some((a) => a.id === q.id)).map(({ id, text: said }) => ({ id, text: said }));
  // a stopped run's rest this list leaves alone takes its requirements, and which shared Done when lines it took can't be told
  const warnings = left.map((e) => [e.id, e.read.done_when.filter((l) => self.done_when.includes(l))])
    .filter(([, lines]) => lines.length)
    .map(([id, lines]) => `${id} was split off ${up.epic} by a run cut short, and ${up.epic} still holds these Done when lines ${id} holds too: ${/** @type {string[]} */ (lines).map((l) => JSON.stringify(l)).join(', ')} - remove from ${up.epic} the ones only ${id} needs`);
  const splits = [...(cut.rest ? [{ ...cut.rest, outcome: undefined }] : []),
    ...left.map((e) => ({ id: e.id, name: e.read.title, requirements: e.read.requirements, done_when: e.read.done_when, cut_short: true }))];
  const replaced = mine.value.filter((s) => s.status !== 'done');
  return { up, ...list, ask, cut, listed: again !== null, self, warnings, splits, unplaced, replaced, asked: { text, read: file.value },
    lessons: taken.lessons, project: project.value,
    named: list.stories.map((s) => ({ id: s.id, title: s.title, size: s.size })) };
}

/** Would that list be written? @param {string} dir @param {string} payloadFile */
function propose(dir, payloadFile) {
  const got = judged(dir, payloadFile);
  if (got === null) return;
  emit({ ok: true, epic: got.up.epic, stories: got.named, ...(got.replaced.length ? { replaces: got.replaced.map((s) => s.id) } : {}),
    ...(got.splits.length ? { splits: got.splits } : {}),
    ...(got.unplaced.length ? { unplaced: got.unplaced } : {}), ...(got.warnings.length ? { warnings: got.warnings } : {}) });
}

/**
 * Write the next epic's approved stories and decisions, or refuse with nothing written.
 * @param {string} dir @param {string} payloadFile
 */
function refine(dir, payloadFile) {
  const got = judged(dir, payloadFile);
  if (got === null) return;
  const { up: { agile, file, text, epic, release, requirements }, stories, decisions, backlog, named, ask, asked, cut, listed, self, splits, replaced, lessons, project } = got;
  const written = stories.map((s) => storyFile(agile, s.id));
  stories.forEach((s, i) => atomicWrite(written[i], renderStoryFile(s)));
  // cut again, whether for an L or for what was missing, every story it doesn't replace stays
  const kept = new Set(got.up.next.status === 'in-progress' ? storyIds(agile, epic).filter((id) => !replaced.some((s) => s.id === id)).map((id) => storyFile(agile, id)) : []);
  const large = replaced.filter((s) => s.size === 'L').map((s) => storyFile(agile, s.id));
  // a refinement killed before its epic turned leaves stories behind, and a longer list's would read as this one's
  for (const name of readdirSync(dirname(file))) {
    const path = join(dirname(file), name);
    const whole = name.replace(/\.\d+\.\d+\.tmp$/, '');
    const left = whole === basename(file) ? name !== whole
      : storyNumber(whole, epic) !== null && (name !== whole || (!written.includes(path) && !kept.has(path) && !large.includes(path)));
    if (left) unlinkFile(path);
  }
  for (const name of readdirSync(agile)) if (/^(REQUIREMENTS|release|project)\.md\.\d+\.\d+\.tmp$/.test(name)) unlinkFile(join(agile, name));
  // the rest before release.md lists it, so a stop between them leaves a folder nothing reads and the next split writes over
  if (cut.rest) {
    const home = dirname(epicFile(agile, cut.rest.id));
    makeDir(home);
    for (const name of readdirSync(home)) if (/^epic\.md\.\d+\.\d+\.tmp$/.test(name)) unlinkFile(join(home, name));
    atomicWrite(epicFile(agile, cut.rest.id), renderSplitEpic(cut.rest, { ...self, id: epic }));
    if (!listed) atomicWrite(releaseFile(agile), renderReleaseSplit(readFileSync(releaseFile(agile), 'utf8'), epic, cut.rest));
  }
  // before the epic, so a stop between them leaves a deferred one off every epic and an added one on none
  if (ask.defer.length || ask.add.length) {
    const changed = renderAskChanged(asked.text, asked.read, ask.defer, ask.add);
    if (changed !== asked.text) atomicWrite(requirementsFile(agile), changed);
  }
  // before the epic, which records each line, so a stop between them is redone from the next list
  const standing = lessons.length ? renderStandingRules(project, lessons) : project;
  if (standing !== project) atomicWrite(projectFile(agile), standing);
  const same = cut.requirements.join() === requirements.join();
  const span = stories.length > 1 ? `${stories[0].id} to ${stories[stories.length - 1].id}` : stories[0]?.id;
  const missing = readNotYet(text) !== null;
  const recut = replaced.length ? [`Cut again: ${replaced.map((s) => s.id).join(', ')} ${span ? `became ${span}` : 'left with no story in its place'}.`]
    : missing ? [`Cut again for what was missing: ${span ?? 'no story'}.`] : [];
  // last of the first cut, because this is what makes the stories count
  atomicWrite(file, renderRefinedEpic(text, [...lessons.map(lessonRecord), ...decisions, ...recut], same ? null : cut.requirements, cut.moves));
  // cut again, the epic reads as one to refine while an L is on disk, so the L goes last
  for (const path of large) unlinkFile(path);
  // after it, so a stop here leaves an item in two places and never in none
  const taken = backlog.length ? removeCaptures(agileBacklogFile(agile), backlog) : { ok: true };
  const warnings = [
    ...(taken.ok ? [] : [`the stories are written, and ${agileBacklogFile(agile)} still holds the items they took (${/** @type {any} */ (taken).detail}) - remove them there`]),
    ...got.warnings,
  ];
  // read back, since a cut again that left no story has the epic to accept, not a story to build
  const now = whatsNext(dir);
  emit({ ok: true, release, epic, stories: named, ...(splits.length ? { splits } : {}), next: 'refusal' in now ? null : now.next,
    ...(warnings.length ? { warnings } : {}) });
}

/** @param {string} detail @returns {Refusal} */
function notAccepting(detail) {
  return { reason: 'not-accepting', detail, hint: 'run /cad-agile, which asks for acceptance once every story of the epic is done; nothing was written' };
}

/**
 * The stories of an epic `next` has at accept, refused unless there's one and every one is done: an epic marked review
 * by hand answers accept with its stories unread.
 * @param {string} agile @param {string} id
 */
function finishedStories(agile, id) {
  const stories = storiesOf(agile, id);
  if ('refusal' in stories) return stories;
  if (!stories.value.length) return { refusal: notAccepting(`${id} has no story, so nothing of it was built`) };
  const open = stories.value.filter((s) => s.status !== 'done');
  if (open.length) return { refusal: notAccepting(`${open.map((s) => s.id).join(', ')} of ${id} ${open.length > 1 ? 'aren\'t' : 'isn\'t'} done`) };
  return stories;
}

/** Where the release is, when it isn't at an epic's acceptance. @param {{release: string | null, next: {id: string, step: string} | null}} got */
const whereNot = (got) => (got.next ? `${got.next.id} is at ${got.next.step}, not accept` : got.release ? 'every epic is done' : 'no release is open');

/** @param {string} dir @param {string} id @param {import('./lib/agile-read.mjs').Story[]} stories */
function evidenceOf(dir, id, stories) {
  const done = stories.map((s) => ({ id: s.id, title: s.title, size: s.size, base: readStoryResult(readFileSync(storyFile(agileDir(dir), s.id), 'utf8')).base }));
  return epicEvidence({ planning: dir, root: dirname(resolve(dir)), epic: id, stories: done });
}

/**
 * A finished epic's Evidence, for its retrospective, from git, its stories' review records and the run record. It
 * writes nothing.
 * @param {string} dir
 */
function evidence(dir) {
  const got = whatsNext(dir);
  if ('refusal' in got) return refuse(got.refusal);
  if (got.next?.step !== 'accept') return refuse(notAccepting(whereNot(got)));
  const agile = agileDir(dir);
  const { id } = got.next;
  const stories = finishedStories(agile, id);
  if ('refusal' in stories) return refuse(stories.refusal);
  const found = evidenceOf(dir, id, stories.value);
  emit({ ok: true, epic: id, evidence: found, text: renderEvidence(found) });
}

/** A line of text a Markdown list item can hold. @param {unknown} v */
const oneLine = (v) => typeof v === 'string' && v.trim() !== '' && !/[\u0000-\u001f\u007f\u2028\u2029]/.test(v);

/** The sections of a retrospective the user approves, in the order `retro.md` holds them. */
const RETRO_SECTIONS = Object.freeze(['went_well', 'do_better', 'change_next']);

/** @param {Date} d */
const day = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * The user accepts the epic `next` names to accept, with the retrospective they approved. `retro.md` goes first and the
 * status line last, so a run stopped between them leaves one the next run finishes without asking again.
 * @param {string} dir @param {string | undefined} payloadFile
 */
function accept(dir, payloadFile) {
  const got = whatsNext(dir);
  if ('refusal' in got) return refuse(got.refusal);
  if (got.next?.step !== 'accept') return refuse(notAccepting(whereNot(got)));
  const agile = agileDir(dir);
  const { id, name } = got.next;
  const stories = finishedStories(agile, id);
  if ('refusal' in stories) return refuse(stories.refusal);
  const retro = retroFile(agile, id);
  if (payloadFile === undefined) {
    if (!lstatOf(retro)?.isFile()) {
      return refuse({ reason: 'no-retrospective', detail: `${id} has no retrospective at ${retro}, and none was given`,
        hint: 'run /cad-agile, which drafts it and asks you to approve it; nothing was written' });
    }
  } else {
    const payload = readJsonPayload(payloadFile);
    if (!payload.ok) return undefined;
    const p = payload.value;
    /** @type {{field: string, problem: string}[]} */
    const issues = [];
    if (p === null || typeof p !== 'object' || Array.isArray(p)) issues.push({ field: 'payload', problem: `is an object with epic and ${RETRO_SECTIONS.join(', ')}` });
    else {
      for (const key of Object.keys(p)) if (key !== 'epic' && !RETRO_SECTIONS.includes(key)) issues.push({ field: key, problem: 'is not a field of this payload' });
      if (p.epic !== undefined && p.epic !== id) issues.push({ field: 'epic', problem: `is ${JSON.stringify(p.epic)}, and the epic up for acceptance is ${id}` });
      for (const field of RETRO_SECTIONS) {
        if (!Array.isArray(p[field])) issues.push({ field, problem: 'is a list of the lines the user approved, an empty one for none' });
        else p[field].forEach((/** @type {unknown} */ l, /** @type {number} */ i) => { if (!oneLine(l)) issues.push({ field: `${field}[${i}]`, problem: 'is one line of text' }); });
      }
    }
    if (issues.length) return refuse(payloadRefused('retro-refused', `the retrospective for ${id} has`, issues));
    const found = evidenceOf(dir, id, stories.value);
    const lines = (/** @type {string} */ field) => /** @type {string[]} */ (p[field]).map((l) => l.trim());
    atomicWrite(retro, renderRetro({ id, name, date: day(new Date()), evidence: renderEvidence(found),
      went_well: lines('went_well'), do_better: lines('do_better'), change_next: lines('change_next') }));
  }
  const file = epicFile(agile, id);
  atomicWrite(file, withStatus(readFileSync(file, 'utf8'), 'done'));
  // a damaged epic after it is only read now, and a null next would read as the release's end
  const now = whatsNext(dir);
  emit({ ok: true, epic: id, status: 'done', retro, next: 'refusal' in now ? null : now.next ?? { step: 'close' }, ...('refusal' in now ? { next_refusal: now.refusal } : {}) });
}

/**
 * The user didn't accept the epic `next` names to accept, and says what's missing. It goes under Decisions, and the
 * epic is cut again for it before it's asked about again.
 * @param {string} dir @param {string} payloadFile
 */
function notYet(dir, payloadFile) {
  const got = whatsNext(dir);
  if ('refusal' in got) return refuse(got.refusal);
  if (got.next?.step !== 'accept') return refuse(notAccepting(whereNot(got)));
  const { id } = got.next;
  // only an epic in progress is sent back to a cut once a Not yet is saved; one marked review by hand would be asked again
  if (got.next.status !== 'in-progress') {
    return refuse({ reason: 'not-accepting', detail: `${id} is marked ${got.next.status}, which only a hand edit sets`,
      hint: `set the status in ${epicFile(agileDir(dir), id)} back to in-progress, then re-run; nothing was written` });
  }
  // the user approved its retrospective and the run stopped before the epic turned, so the next run finishes it
  if (lstatOf(retroFile(agileDir(dir), id)) !== null) {
    return refuse({ reason: 'not-accepting', detail: `${id}'s retrospective is written, so it was accepted and the run stopped before it turned done`,
      hint: 'run /cad-agile, which finishes the acceptance; nothing was written' });
  }
  const payload = readJsonPayload(payloadFile);
  if (!payload.ok) return undefined;
  const p = payload.value;
  /** @type {{field: string, problem: string}[]} */
  const issues = [];
  if (p === null || typeof p !== 'object' || Array.isArray(p)) issues.push({ field: 'payload', problem: 'is an object with epic and missing' });
  else {
    for (const key of Object.keys(p)) if (key !== 'epic' && key !== 'missing') issues.push({ field: key, problem: 'is not a field of this payload' });
    if (p.epic !== undefined && p.epic !== id) issues.push({ field: 'epic', problem: `is ${JSON.stringify(p.epic)}, and the epic up for acceptance is ${id}` });
    if (!oneLine(p.missing)) {
      issues.push({ field: 'missing', problem: 'is what the user says is missing, on one line' });
    }
  }
  if (issues.length) return refuse(payloadRefused('not-yet-refused', `the Not yet for ${id} has`, issues));
  const file = epicFile(agileDir(dir), id);
  atomicWrite(file, renderNotYet(readFileSync(file, 'utf8'), p.missing.trim()));
  const now = whatsNext(dir);
  emit({ ok: true, epic: id, missing: p.missing.trim(), next: 'refusal' in now ? null : now.next, ...('refusal' in now ? { next_refusal: now.refusal } : {}) });
}

/**
 * Move the release's files into its close's folder, the epics first and release.md last, then rename that folder to
 * the version: the one rename that closes it. A move a stopped run already made is passed over.
 * @param {string} agile @param {string} version
 */
function moveRelease(agile, version) {
  const staging = closingDir(agile, version);
  makeDir(staging);
  for (const name of ['epics', 'REQUIREMENTS.md', 'release.md']) if (lstatOf(join(agile, name)) !== null) movePath(join(agile, name), join(staging, name));
  movePath(staging, join(releasesDir(agile), version));
  return join(releasesDir(agile), version);
}

/**
 * Close the release once every epic is done: the open requirements the user deferred go under Deferred, then its
 * release.md, REQUIREMENTS.md and epics move to releases/<version>/. With no payload it finishes a close a stopped run
 * left under way.
 * @param {string} dir @param {string | undefined} payloadFile
 */
function close(dir, payloadFile) {
  const at = whatsNext(dir);
  if ('refusal' in at) return refuse(at.refusal);
  const agile = agileDir(dir);
  const no = (/** @type {string} */ detail, hint = 'run /cad-agile, which closes the release once every epic is done; nothing was written') => refuse({ reason: 'not-closing', detail, hint });
  const closing = at.next?.step === 'close' ? /** @type {{closing?: string}} */ (at.next).closing : undefined;
  if (closing !== undefined) {
    if (payloadFile !== undefined) return no(`the close of ${closing} is under way`, 'run close with no payload, which finishes it; nothing was written');
    return emit({ ok: true, version: closing, folder: moveRelease(agile, closing), deferred: [], finished: true });
  }
  if (at.release === null) return no('no release is open');
  if (at.next !== null) return no(`the next step here is ${at.next.step} ${at.next.story?.id ?? at.next.id}`);
  if (payloadFile === undefined) return no('no close is under way, and no version was given', 'run /cad-agile, which asks the version; nothing was written');
  const payload = readJsonPayload(payloadFile);
  if (!payload.ok) return undefined;
  const p = payload.value;
  const trace = traced(agile, at.epics);
  if ('refusal' in trace) return refuse(trace.refusal);
  const open = trace.value.filter((q) => q.status === 'open').map((q) => q.id);
  /** @type {{field: string, problem: string}[]} */
  const issues = [];
  if (p === null || typeof p !== 'object' || Array.isArray(p)) issues.push({ field: 'payload', problem: 'is an object with version and defer' });
  else {
    for (const key of Object.keys(p)) if (key !== 'version' && key !== 'defer') issues.push({ field: key, problem: 'is not a field of this payload' });
    const { closed } = closes(agile);
    if (typeof p.version !== 'string' || !tagSafe(p.version)) issues.push({ field: 'version', problem: 'is one version git takes as a tag: letters, digits and ._+- only, starting with a letter or digit, with no "..", and not ending in "." or ".lock"' });
    else if (closed.includes(p.version)) issues.push({ field: 'version', problem: `${p.version} is closed already, in ${join(releasesDir(agile), p.version)}` });
    const defer = p.defer ?? [];
    if (!Array.isArray(defer) || defer.some((d) => typeof d !== 'string') || new Set(defer).size !== defer.length) issues.push({ field: 'defer', problem: 'is a list of the open requirements the user deferred, each once, empty when none' });
    else {
      for (const id of defer) if (!open.includes(id)) issues.push({ field: 'defer', problem: `names ${id}, which isn't open${open.length ? ` - those are ${open.join(', ')}` : ', and none is'}` });
      for (const id of open) if (!defer.includes(id)) issues.push({ field: 'defer', problem: `${id} is open, so the release can't close without it - defer it, or build it first` });
    }
  }
  if (issues.length) return refuse(payloadRefused('close-refused', 'the close has', issues));
  /** @type {string[]} */
  const defer = p.defer ?? [];
  // before the move, so a stop between them leaves them deferred and the next close asks only the version
  if (defer.length) {
    const text = readFileSync(requirementsFile(agile), 'utf8');
    atomicWrite(requirementsFile(agile), renderAskChanged(text, readRequirementsFile(text), defer, []));
  }
  emit({ ok: true, version: p.version, folder: moveRelease(agile, p.version), deferred: defer });
}

/** A check that hangs is a failed one, and a headless run of a command fits in this. */
const CHECK_TIMEOUT_MS = 600000;
const CHECK_OUTPUT_BYTES = 32 * 1024 * 1024;

/**
 * The story up to be built, its file and what it holds, or null when the refusal is already out.
 * @param {string} dir @param {string} [named] the story a payload names, which has to be that one
 */
function building(dir, named) {
  const no = (/** @type {Refusal} */ r) => { refuse(r); return null; };
  const at = whatsNext(dir);
  if ('refusal' in at) return no(at.refusal);
  const id = at.next?.step === 'build' ? /** @type {{id: string}} */ (at.next.story).id : null;
  if (id === null) {
    const now = at.next ? `to ${at.next.step} ${at.next.id}` : at.release === null ? 'to start a release' : 'to close the release';
    return no({ reason: 'not-building', detail: `no story is up to be built - the next step here is ${now}`,
      hint: 'run /cad-agile, which does the next step; nothing was written' });
  }
  if (named !== undefined && named !== id) {
    return no({ reason: 'not-building', detail: `the payload's story is ${named}, and the one up to be built is ${id}`,
      hint: `name ${id} in the payload, then re-run; nothing was written` });
  }
  const file = storyFile(agileDir(dir), id);
  const text = readFileSync(file, 'utf8');
  return { id, file, text, story: /** @type {import('./lib/agile-read.mjs').Story} */ (readStoryFile(text)) };
}

/** Record the command that checks each of the story's Accepted when lines, before the review reads them. @param {string} dir @param {string} payloadFile */
function checkCommands(dir, payloadFile) {
  const payload = readJsonPayload(payloadFile);
  if (!payload.ok) return undefined;
  const p = payload.value;
  const named = p !== null && typeof p === 'object' && typeof p.story === 'string' ? p.story : undefined;
  const up = building(dir, named);
  if (up === null) return undefined;
  const lines = up.story.accepted_when;
  const commands = p !== null && typeof p === 'object' ? p.commands : undefined;
  /** @type {{field: string, problem: string}[]} */
  const issues = [];
  if (named === undefined) issues.push({ field: 'story', problem: `name the story the commands check, ${up.id}` });
  if (!Array.isArray(commands)) issues.push({ field: 'commands', problem: `give a list of ${lines.length} commands, one for each Accepted when line in order` });
  else {
    if (commands.length !== lines.length) issues.push({ field: 'commands', problem: `${up.id} has ${lines.length} Accepted when lines and the list has ${commands.length} commands - give one for each, in order` });
    commands.forEach((c, i) => {
      if (typeof c !== 'string' || c.trim() === '') issues.push({ field: `commands[${i}]`, problem: `give the command that checks "${lines[i] ?? 'a line that isn\'t there'}"` });
      // a control character can't sit in a Markdown line, and a NUL can't reach the shell
      else if (/[`\x00-\x1f\x7f]/.test(c)) issues.push({ field: `commands[${i}]`, problem: 'a command is one line with no backtick or control character - use $(...) for a substitution' });
    });
  }
  if (issues.length) return refuse(payloadRefused('commands-refused', `the commands for ${up.id} have`, issues));
  // recorded while the story is built or reviewed, so a review that finds a weak command can have it fixed
  if (up.story.status !== 'in-progress' && up.story.status !== 'review') {
    return refuse({ reason: 'commands-closed', detail: `${up.id} is ${up.story.status}, and commands are recorded while it's being built`,
      hint: `run /cad-agile, which records them once ${up.id} is being built; nothing was written` });
  }
  // during the review it's that review's own fix; once the review is noted or a check ran, nobody reviewed the new one,
  // so the story goes back to being built and owes the review
  const after = readStoryResult(up.text).review !== null || readStoryChecks(up.text).some((c) => c.result !== 'not run');
  const checks = /** @type {string[]} */ (commands).map((command, i) => ({ n: i + 1, command: command.trim(), result: 'not run' }));
  const cleared = after ? [{ kind: 'Review', line: '' }] : [];
  atomicWrite(up.file, renderStoryResult(up.text, [...checkLines(checks), ...cleared], after ? 'in-progress' : up.story.status));
  emit({ ok: true, story: up.id, commands: checks.length, ...(after ? { review_cleared: true } : {}) });
}

/** The story's commits since it began, oldest first. @param {string} dir @param {string} base */
function commitsSince(dir, base) {
  const log = boundedRun('git', ['log', '--reverse', '--format=%h', `${base}..HEAD`], { cwd: dirname(resolve(dir)), timeout: CHILD_TIMEOUT_MS });
  if (!log.ok) throw new Error(`git can't list the commits since ${base}`);
  return log.stdout.split('\n').filter(Boolean);
}

/** The most tasks an M's plan holds; anything more is an L. */
const PLAN_TASKS = 3;

/**
 * Size the story `next` names as it's begun: an M gets its short plan, and one bigger than an M goes back to backlog as
 * an L, for the next run to cut again. An S is built as one change, so it never takes a plan. One write.
 * @param {string} dir @param {string} payloadFile
 */
function size(dir, payloadFile) {
  const payload = readJsonPayload(payloadFile);
  if (!payload.ok) return undefined;
  const p = payload.value !== null && typeof payload.value === 'object' ? payload.value : {};
  const up = building(dir, typeof p.story === 'string' ? p.story : undefined);
  if (up === null) return undefined;
  const from = up.story.size;
  const line = (/** @type {unknown} */ v) => typeof v === 'string' && v.trim() !== '' && !/[\x00-\x1f\x7f]/.test(v);
  /** @type {{field: string, problem: string}[]} */
  const issues = [];
  if (typeof p.story !== 'string') issues.push({ field: 'story', problem: `name the story being sized, ${up.id}` });
  if (p.size !== 'M' && p.size !== 'L') issues.push({ field: 'size', problem: 'give "M" with its plan, or "L" with why it\'s bigger than an M' });
  if (p.size === 'M' && from !== 'M') issues.push({ field: 'size', problem: `${up.id} is an ${from}, and only an M has a plan - an S is built as one change, and one bigger than an M is sized "L"` });
  if (p.size === 'L' && p.plan !== undefined) issues.push({ field: 'plan', problem: 'an L is never built, so it takes no plan - leave plan out' });
  if (p.size === 'M') {
    if (!Array.isArray(p.plan) || !p.plan.length) issues.push({ field: 'plan', problem: `give ${up.id}'s plan, one to ${PLAN_TASKS} tasks of one line each` });
    else if (p.plan.length > PLAN_TASKS) issues.push({ field: 'plan', problem: `${p.plan.length} tasks is more than an M holds - size it "L" with why, and the next run cuts it again` });
    else p.plan.forEach((t, i) => { if (!line(t)) issues.push({ field: `plan[${i}]`, problem: 'a task is one line of text' }); });
  }
  if (p.size === 'L' && !line(p.why)) issues.push({ field: 'why', problem: `say in one line why ${up.id} is bigger than an M` });
  if (p.size === 'M' && p.why !== undefined) issues.push({ field: 'why', problem: 'an M is planned at the size refinement gave it - leave why out' });
  if (issues.length) return refuse(payloadRefused('size-refused', `sizing ${up.id} has`, issues));
  const stuck = (/** @type {string} */ why, /** @type {string} */ hint) => refuse({ reason: 'not-sizable', detail: `${up.id} is ${up.story.status}, ${why}`, hint });
  const { base } = readStoryResult(up.text);
  if (p.size === 'M') {
    if (up.story.status !== 'in-progress') return stuck('and its plan is written once it\'s begun and before it\'s built', 'run /cad-agile, which begins it first; nothing was written');
    if (readStoryPlan(up.text) !== null) return stuck('and its plan is written already', 'build it from the plan its file holds; nothing was written');
    if (readStoryChecks(up.text).length) return stuck('and its commands are recorded, so it\'s built already', 'finish it at its size with /cad-agile; nothing was written');
    atomicWrite(up.file, renderStoryPlan(up.text, /** @type {string[]} */ (p.plan).map((t) => t.trim())));
    return emit({ ok: true, story: up.id, size: 'M', tasks: p.plan.length });
  }
  if (up.story.status !== 'backlog' && up.story.status !== 'in-progress') return stuck('and only a story not yet reviewed goes back to be cut again', 'finish it at its size with /cad-agile; nothing was written');
  // a cut again replaces the story, and its commits would be left on none
  const made = base === null ? [] : commitsSince(dir, base);
  if (made.length) return stuck(`and ${made.length} commit${made.length === 1 ? ' is' : 's are'} past its Base, which a cut again would leave on no story`, 'finish it at its size with /cad-agile; nothing was written');
  // nor what's half made, which a later story's fix round would take for its own
  const tree = boundedRun('git', ['status', '--porcelain', '--untracked-files=all', '--', '.', ':(exclude).planning'], { cwd: dirname(resolve(dir)), timeout: CHILD_TIMEOUT_MS });
  if (!tree.ok) throw new Error('git can\'t say what the tree holds');
  if (tree.stdout.trim()) return stuck('and the tree holds changes outside .planning/, which a cut again would leave on no story', 'finish it at its size with /cad-agile, or undo those changes; nothing was written');
  atomicWrite(up.file, renderStoryResult(withSize(up.text, 'L'), [{ kind: 'Base', line: '' }, { kind: 'Commits', line: '' },
    { kind: 'Resized', line: `- Resized: ${from} to L - ${p.why.trim()}` }], 'backlog'));
  const now = whatsNext(dir);
  emit({ ok: true, story: up.id, size: 'L', status: 'backlog', next: 'refusal' in now ? null : now.next });
}

/** Where the work starts, or null with no commit to start from. @param {string} root */
function headOf(root) {
  const r = boundedRun('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, timeout: CHILD_TIMEOUT_MS });
  return r.ok ? r.stdout.trim() : null;
}

/**
 * Begin the story `next` names, or hand it to the review. Begun, its Result says where it started; reviewed, it holds a
 * command for every Accepted when line, so the review reads them. Done only comes from its checks.
 * @param {string} dir @param {string | undefined} to
 */
function move(dir, to) {
  if (to !== 'in-progress' && to !== 'review') {
    return refuse({ reason: 'bad-args', detail: `--to is ${JSON.stringify(to)}`, hint: 'pass --to in-progress or --to review; nothing was written' });
  }
  const up = building(dir);
  if (up === null) return undefined;
  const from = up.story.status;
  if (from === to) return emit({ ok: true, story: up.id, status: to, already: true });
  const stuck = (/** @type {string} */ why) => refuse({ reason: 'not-movable', detail: `${up.id} is ${from}, ${why}`,
    hint: 'run /cad-agile, which moves a story when its step is done; nothing was written' });
  if (to === 'in-progress') {
    if (from !== 'backlog') return stuck('and only a story in backlog is begun');
    const base = headOf(dirname(resolve(dir)));
    if (base === null) {
      return refuse({ reason: 'no-commit', detail: 'git has no commit here to start the story from',
        hint: 'commit the release with /cad-agile, then re-run; nothing was written' });
    }
    atomicWrite(up.file, renderStoryResult(up.text, [{ kind: 'Base', line: `- Base: ${base}` }], to));
    return emit({ ok: true, story: up.id, status: to, base });
  }
  if (from !== 'in-progress') return stuck('and only a story being built is reviewed');
  const recorded = readStoryChecks(up.text).map((c) => c.n);
  if (!up.story.accepted_when.every((_, i) => recorded.includes(i + 1))) {
    return refuse({ reason: 'checks-missing', detail: `${up.id} records a command for ${recorded.length} of its ${up.story.accepted_when.length} Accepted when lines`,
      hint: 'record one for each with agile.mjs check-commands, so the review reads them, then re-run; nothing was written' });
  }
  atomicWrite(up.file, renderStoryResult(up.text, [], to));
  emit({ ok: true, story: up.id, status: to });
}

/**
 * Note what the build did in the story's Result: its commits since it began, worked out here, and what the payload says.
 * @param {string} dir @param {string} payloadFile
 */
function note(dir, payloadFile) {
  const payload = readJsonPayload(payloadFile);
  if (!payload.ok) return undefined;
  const p = payload.value !== null && typeof payload.value === 'object' ? payload.value : {};
  const up = building(dir, typeof p.story === 'string' ? p.story : undefined);
  if (up === null) return undefined;
  const fields = /** @type {const} */ ([['review', 'Review'], ['fix_round', 'Fix round'], ['differently', 'Done differently']]);
  /** @type {{field: string, problem: string}[]} */
  const issues = [];
  if (typeof p.story !== 'string') issues.push({ field: 'story', problem: `name the story the note is about, ${up.id}` });
  for (const [field] of fields) {
    const v = p[field];
    if (v !== undefined && (typeof v !== 'string' || v.trim() === '' || /[\x00-\x1f\x7f]/.test(v))) issues.push({ field, problem: 'give one line of text, or leave the field out' });
  }
  if (issues.length) return refuse(payloadRefused('note-refused', `the note for ${up.id} has`, issues));
  const { base } = readStoryResult(up.text);
  if (base === null || (up.story.status !== 'in-progress' && up.story.status !== 'review')) {
    return refuse({ reason: 'not-begun', detail: `${up.id} is ${up.story.status}${base === null ? ' and its Result names no Base' : ''}`,
      hint: 'run /cad-agile, which begins the story first; nothing was written' });
  }
  const commits = commitsSince(dir, base);
  // a round's fix makes what the checks showed stale, so they're owed again, and a run cut short after this runs them
  const owed = p.fix_round === undefined ? [] : checkLines(readStoryChecks(up.text).map((c) => ({ ...c, result: 'not run' })));
  const lines = [{ kind: 'Commits', line: `- Commits: ${commits.length ? commits.join(', ') : 'none'}` },
    ...fields.filter(([field]) => p[field] !== undefined).map(([field, kind]) => ({ kind, line: `- ${kind}: ${String(p[field]).trim()}` })), ...owed];
  atomicWrite(up.file, renderStoryResult(up.text, lines));
  emit({ ok: true, story: up.id, commits });
}

/** One line of what a check printed, for its Result line. @param {string} out */
function lastLine(out) {
  const lines = out.replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '').split(/\r?\n/).map((l) => l.replace(/[\x00-\x1f\x7f]/g, ' ').trim()).filter(Boolean);
  const last = lines.at(-1) ?? '';
  return last.length > 200 ? `${last.slice(0, 199)}…` : last;
}

/** Kill a check and whatever it started, which a timeout's kill of the shell alone would leave running. @param {import('node:child_process').ChildProcess} child */
function killTree(child) {
  try { process.kill(process.platform === 'win32' ? /** @type {number} */ (child.pid) : -(/** @type {number} */ (child.pid)), 'SIGKILL'); } catch { /* gone already */ }
}

/**
 * One check, in a shell at the root, in its own process group. Done when the shell exits, since a server it left in the
 * background would hold its output open; the group goes then, and at the timeout.
 * @param {string} command @param {string} root
 * @returns {Promise<{status: number | null, signal: string | null, out: string, err: string, how: string | null}>}
 */
function runOne(command, root) {
  return new Promise((done) => {
    const child = spawn(command, { cwd: root, shell: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'] });
    /** @type {string | null} */
    let how = null;
    let size = 0;
    const out = { stdout: '', stderr: '' };
    for (const name of /** @type {const} */ (['stdout', 'stderr'])) {
      child[name].setEncoding('utf8');
      child[name].on('data', (chunk) => {
        size += chunk.length;
        if (size > CHECK_OUTPUT_BYTES) { how ??= `stopped at ${CHECK_OUTPUT_BYTES / 1048576} MiB of output`; killTree(child); } else out[name] += chunk;
      });
    }
    const timer = setTimeout(() => { how ??= `timed out after ${CHECK_TIMEOUT_MS / 1000} s`; killTree(child); }, CHECK_TIMEOUT_MS);
    /** @type {{status: number | null, signal: string | null}} */
    let ended = { status: null, signal: null };
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      done({ ...ended, out: out.stdout, err: out.stderr, how });
    };
    child.on('error', (e) => { how ??= `could not run: ${/** @type {any} */ (e).code ?? e.message}`; finish(); });
    child.on('exit', (status, signal) => { ended = { status, signal }; clearTimeout(timer); killTree(child); });
    child.on('close', finish);
  });
}

/**
 * Run the story's recorded checks and write what each showed. They run once it's reviewed: every one exiting 0 turns it
 * done, and a failure sends it back to in-progress. The one write comes after the last check, so a run stopped midway
 * leaves the file alone.
 * @param {string} dir
 */
async function runChecks(dir) {
  const up = building(dir);
  if (up === null) return undefined;
  if (up.story.status !== 'review' || readStoryResult(up.text).review === null) {
    return refuse({ reason: 'not-reviewed', detail: up.story.status !== 'review' ? `${up.id} is ${up.story.status}, and its checks run once it's reviewed`
      : `${up.id}'s Result notes no review of its commands`,
    hint: 'run /cad-agile, which runs them after the review; nothing was written' });
  }
  const recorded = readStoryChecks(up.text);
  const lines = up.story.accepted_when;
  const missing = lines.map((_, i) => i + 1).filter((n) => !recorded.some((c) => c.n === n));
  if (missing.length || recorded.length !== lines.length) {
    return refuse({ reason: 'checks-missing', detail: `${up.file} records a command for ${recorded.length} of its ${lines.length} Accepted when lines`,
      hint: 'record one for each with agile.mjs check-commands while the story is being built, then re-run; nothing was written' });
  }
  const root = dirname(resolve(dir));
  const ran = [];
  for (const c of recorded.sort((a, b) => a.n - b.n)) {
    const r = await runOne(c.command, root);
    const said = (r.status !== 0 && lastLine(r.err)) || lastLine(r.out) || lastLine(r.err) || 'no output';
    const how = r.how ?? (r.status === null ? `killed by ${r.signal}` : `exit ${r.status}`);
    ran.push({ n: c.n, command: c.command, result: `${how}, ${said}`, passed: r.how === null && r.status === 0 });
  }
  const failed = ran.filter((c) => !c.passed);
  const status = failed.length ? 'in-progress' : 'done';
  atomicWrite(up.file, renderStoryResult(up.text, checkLines(ran), status));
  emit({ ok: true, story: up.id, status, passed: ran.length - failed.length,
    failed: failed.map((c) => ({ check: c.n, line: lines[c.n - 1], result: c.result })) });
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
  // a closed release is where the next one starts
  if (early && early.reason !== 'release-closed') return no(early);
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
  const closed = early === null ? null : closedRelease(dir);
  if (closed !== null && 'refusal' in closed) return no(closed.refusal);
  const carried = closed !== null && 'value' in closed ? closed.value : null;
  const epics = carried === null ? { epics: read.design.phases } : renumbered(read.design.phases, carried.top);
  if ('refusal' in epics) return no(epics.refusal);
  return { design: { ...read.design, phases: epics.epics }, decisions, config, closed: carried };
}

/**
 * What a start after a close carries: the highest epic number a closed release used, and project.md. Both were written by
 * an earlier run or by hand, so a name that isn't an epic's is passed over and a project.md that isn't a file is refused.
 * @param {string} dir @returns {{value: {top: number, project: string | null}} | {refusal: Refusal}}
 */
function closedRelease(dir) {
  const agile = agileDir(dir);
  let top = 0;
  for (const v of closes(agile).closed) {
    const epics = join(releasesDir(agile), v, 'epics');
    if (!lstatOf(join(releasesDir(agile), v))?.isDirectory() || !lstatOf(epics)?.isDirectory()) continue;
    for (const name of readdirSync(epics)) {
      const n = Number(/^E-(\d{2,})$/.exec(name)?.[1]);
      if (Number.isSafeInteger(n)) top = Math.max(top, n);
    }
  }
  const project = lstatOf(projectFile(agile));
  if (project !== null && !project.isFile()) {
    return { refusal: { reason: 'project-file', detail: `${projectFile(agile)} is not a file`,
      hint: 'put project.md back as a plain file from git, or remove it, then re-run; nothing was written' } };
  }
  return { value: { top, project: project === null ? null : readFileSync(projectFile(agile), 'utf8') } };
}

/**
 * The design's epics numbered after `top`: a story's task folder is named by its ID and outlives its release.
 * @param {import('./lib/seldon-design.mjs').Phase[]} epics @param {number} top
 * @returns {{epics: import('./lib/seldon-design.mjs').Phase[]} | {refusal: Refusal}}
 */
function renumbered(epics, top) {
  const at = epics.map((e) => Number(e.epic.slice(2)));
  const shift = Math.max(0, top + 1 - Math.min(...at));
  if (shift === 0) return { epics };
  const moved = at.map((n) => n + shift);
  // E-01 and E-001 are two IDs and one number, and a number past 2^53 rounds into its neighbour
  if (new Set(moved).size !== moved.length || !moved.every(Number.isSafeInteger)) {
    return { refusal: { reason: 'epic-numbers', detail: `numbered after E-${top}, the highest a closed release used, the design's ${epics.map((e) => e.epic).join(', ')} don't each get an ID of their own`,
      hint: 'give each epic in epics.md its own number, or rename the closed release\'s epic folder the detail names, then re-run; nothing was written' } };
  }
  const ids = new Map(epics.map((e, i) => [e.epic, `E-${String(moved[i]).padStart(2, '0')}`]));
  return { epics: epics.map((e) => ({ ...e, epic: /** @type {string} */ (ids.get(e.epic)), builds_on: e.builds_on.map((b) => ids.get(b) ?? b) })) };
}

/** Is that folder empty, or gone? @param {string} path */
function empty(path) {
  try { return readdirSync(path).length === 0; } catch (e) { if (/** @type {any} */ (e).code === 'ENOENT') return true; throw e; }
}

/**
 * Another start that is moving files in: a live pid whose build folder still holds some. An empty one has nothing left to
 * move, and its pid may be another process's by now.
 * @param {string} dir @returns {Refusal | null}
 */
function otherStart(dir) {
  const pid = readdirSync(dir).map(buildPid).find((p) => p !== null && p !== process.pid && alive(p) && !empty(buildDir(dir, p)));
  return pid === undefined ? null : { reason: 'start-running', detail: `another start (pid ${pid}) is writing ${buildDir(dir, pid)}`,
    hint: `let it finish and run /cad-agile; if no start is running here, remove ${buildDir(dir, pid)} and re-run; nothing was written` };
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
  const unsigned = signingProblem(root);
  if (unsigned !== null) {
    return refuse({ reason: 'signing-failed', detail: `git can't make a signed commit here: ${unsigned}`,
      hint: 'fix the key, or the commit.gpgsign, user.signingkey and gpg.format settings behind it, then re-run; in a folder git doesn\'t know yet, making it a repository first lets its own settings apply; the check wrote nothing' });
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
    decide: adviseBranch(root, got.config.git || {}, { title: got.design.title }),
    reviewers: reviewersOf(dir, got.config) });
}

/** @param {string} dir @param {string} design @param {string} [commitHere] the user's "Commit here anyway" */
function start(dir, design, commitHere) {
  const got = ready(dir, design);
  if ('refusal' in got) return refuse(got.refusal);
  const open = unanswered(got.config);
  if (open.length) {
    return refuse({ reason: 'setup-unanswered', detail: `this project's setup still has ${open.join(', ')} to answer`,
      hint: 'run /cad-agile --brief with this design, which asks for each; nothing was written' });
  }
  // the answer was given about the branch the start is on, and keeping it for any other would be consent nobody gave
  const on = commitHere === undefined ? '' : readCurrentBranch(dirname(resolve(dir)));
  if (commitHere !== undefined && commitHere !== on) {
    return refuse({ reason: 'commit-here-not-current', detail: `--commit-here names ${commitHere}, and the start is on ${on || 'no branch'}`,
      hint: 'pass the branch the start is on, the one the user said to commit on anyway; nothing was written' });
  }

  const { decisions, closed, design: { title, brief, requirements, phases: epics, uncovered } } = got;
  // another start is moving its files in, and the leftover epics/ cleared below may be its
  const running = closed === null ? null : otherStart(dir);
  if (running !== null) return refuse(running);
  makeDir(dir);
  // part of the start, so one that died before it gets it written by the next
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
    // a dead run's half-built folder, this pid's own from before a reboot, or one with nothing left to move
    if (pid !== null && (pid === process.pid || !alive(pid) || empty(join(dir, name)))) clear(join(dir, name));
  }
  if (closed !== null) {
    // asked again just before the clear: a start that finished since the first ask opened its release, and one still moving holds its folder
    if (lstatOf(releaseFile(agileDir(dir))) !== null) return refuse(releaseOpen(dir));
    const late = otherStart(dir);
    if (late !== null) return refuse(late);
    // no release.md, no close under way and no start moving, so only a start that died moving its files in left epics/ there
    clear(join(agileDir(dir), 'epics'));
  }
  const building = buildDir(dir);
  for (const e of epics) {
    makeDir(dirname(epicFile(building, e.epic)));
    writeFileNew(epicFile(building, e.epic), renderEpicFile(e));
  }
  writeFileNew(projectFile(building), withStandingRules(renderProjectFile(title, brief, epics, decisions), closed?.project ?? null));
  writeFileNew(requirementsFile(building), renderRequirementsFile(title, requirements));
  writeFileNew(releaseFile(building), renderReleaseFile(title, brief, epics, commitHere));
  // after a close agile/ holds the releases, ledgers and tasks, so the new files go in one by one and release.md opens it last
  const [from, to] = closed === null ? [building, agileDir(dir)] : [join(building, 'epics'), join(agileDir(dir), 'epics')];
  try {
    movePath(from, to);
  } catch (e) {
    // two starts at once: the first rename won, and a folder never renames over a full one
    if (lstatOf(to) === null) throw e;
    removeTree(building);
    return refuse(releaseOpen(dir));
  }
  if (closed !== null) {
    for (const file of [requirementsFile, projectFile, releaseFile]) movePath(file(building), file(agileDir(dir)));
    // emptied, so a start begun meanwhile may have cleared it already
    clear(building);
  }
  emit({ ok: true, release: title, folder: agileDir(dir), epics: epics.map((e) => ({ id: e.epic, name: e.name })), uncovered,
    next: { id: epics[0].epic, name: epics[0].name, status: 'backlog', step: 'refine' } });
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
  // read first, so its own refusal names it even with --design missing
  else if (argv[0] === 'start') { const commitHere = arg('start', '--commit-here'); start(planningDir(arg('start', '--dir')), arg('start', '--design'), commitHere); }
  else if (argv[0] === 'answer') answer(planningDir(arg('answer', '--dir')), arg('answer', '--payload'));
  else if (argv[0] === 'propose') propose(planningDir(arg('propose', '--dir')), arg('propose', '--payload'));
  else if (argv[0] === 'refine') refine(planningDir(arg('refine', '--dir')), arg('refine', '--payload'));
  else if (argv[0] === 'size') size(planningDir(arg('size', '--dir')), arg('size', '--payload'));
  else if (argv[0] === 'check-commands') checkCommands(planningDir(arg('check-commands', '--dir')), arg('check-commands', '--payload'));
  else if (argv[0] === 'run-checks') runChecks(planningDir(arg('run-checks', '--dir'))).catch(emitCaught);
  else if (argv[0] === 'move') move(planningDir(arg('move', '--dir')), arg('move', '--to'));
  else if (argv[0] === 'note') note(planningDir(arg('note', '--dir')), arg('note', '--payload'));
  else if (argv[0] === 'accept') accept(planningDir(arg('accept', '--dir')), arg('accept', '--payload'));
  else if (argv[0] === 'not-yet') notYet(planningDir(arg('not-yet', '--dir')), arg('not-yet', '--payload'));
  else if (argv[0] === 'evidence') evidence(planningDir(arg('evidence', '--dir')));
  else if (argv[0] === 'close') close(planningDir(arg('close', '--dir')), arg('close', '--payload'));
  else emit({ ok: false, reason: 'usage', detail: 'subcommand: next [--dir <.planning>] | check|start --design <folder> [--commit-here <branch>, start only] [--dir <.planning>] | answer|propose|refine|size|check-commands|note|not-yet --payload <file> [--dir <.planning>] | run-checks [--dir <.planning>] | move --to in-progress|review [--dir <.planning>] | accept|close [--payload <file>] [--dir <.planning>] | evidence [--dir <.planning>]' });
} catch (e) {
  emitCaught(e);
}
