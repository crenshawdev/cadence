#!/usr/bin/env node
// @ts-check
// agile.mjs - the agile path's own script: it says what a start still has to ask, starts a release from a Seldon design,
// holds an epic's refinement and says what the open release does next
// not a planning.mjs subcommand: those belong to the old path, and all but a few refuse a project this path owns
//
// Usage: agile.mjs next [--dir <.planning>]
//        agile.mjs check --design <folder> [--dir <.planning>]
//        agile.mjs start --design <folder> [--dir <.planning>]
//        agile.mjs answer|propose|refine --payload <file> [--dir <.planning>]
//
// one JSON object on stdout; a refusal names the next step
// no lock: each start builds in its own folder and one rename decides, and a refinement's last write is the one that counts,
// so a killed run never makes the next one wait
'use strict';

import { lstatSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readDesignFolder } from './planning/design-read.mjs';
import { scanSurfaces } from './planning/detect-surfaces.mjs';
import { invalidHint } from './planning/state-import.mjs';
import { writePolicy } from './planning/testing-policy.mjs';
import { readJsonPayload } from './planning/core.mjs';
import { OLD_PATH, agileBacklogFile, agileDir, buildDir, buildPid, epicFile, releaseFile, requirementsFile, storyFile, storyNumber } from './lib/agile-paths.mjs';
import { limits, renderAnswers, renderAskChanged, renderEpicFile, renderProjectFile, renderRefinedEpic, renderReleaseFile, renderReleaseSplit, renderRequirementsFile, renderSplitEpic, renderStoryFile } from './lib/agile-render.mjs';
import { judgeDesign } from './lib/agile-judge.mjs';
import { STATUSES, readEpicFile, readEpicStatus, readReleaseFile, readRequirementsFile, readStoryFile } from './lib/agile-read.mjs';
import { judgeAnswers, judgeAsk, judgeSplit, judgeStories } from './lib/agile-refine.mjs';
import { namedReviewers, unanswered } from './lib/agile-setup.mjs';
import { CONTRACTS, rowReader } from './lib/arg-contract.mjs';
import { boundedRun } from './lib/bounded-run.mjs';
import { adviseBranch } from './lib/branch-advice.mjs';
import { captureLines, removeCaptures } from './lib/capture-file.mjs';
import { mergeLayers } from './lib/config-merge.mjs';
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
 * What an epic that isn't done does next.
 * @param {string} agile @param {string} epic @param {string} status
 * @returns {{value: {step: string, story?: {id: string, title: string, size: string, status: string}}} | {refusal: Refusal}}
 */
function stepOf(agile, epic, status) {
  if (status !== 'in-progress') return { value: { step: status === 'backlog' ? 'refine' : 'accept' } };
  const stories = storiesOf(agile, epic);
  if ('refusal' in stories) return stories;
  if (!stories.value.length) {
    return { refusal: { reason: 'release-damaged', detail: `${dirname(epicFile(agile, epic))} holds no story, and ${epic} is in progress`,
      hint: 'put its story files back from git or your backup, or set its status to backlog to refine it again, then re-run; nothing was written' } };
  }
  const open = stories.value.find((s) => s.status !== 'done');
  return { value: open ? { step: 'build', story: { id: open.id, title: open.title, size: open.size, status: open.status } } : { step: 'accept' } };
}

/**
 * The open release's next step, or why it can't say. It writes nothing.
 * @param {string} dir
 */
function whatsNext(dir) {
  const why = refusal(dir);
  if (why === null) return { release: null, epics: [], next: null };
  if (why.reason !== 'release-open') return { refusal: why };
  const agile = agileDir(dir);
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

/** @param {string} dir */
function next(dir) {
  const at = whatsNext(dir);
  if ('refusal' in at) return refuse(at.refusal);
  emit({ ok: true, release: at.release, next: at.next });
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
  // a dead run's leftovers are all backlog, or too broken to say, and neither counts
  for (const id of storyIds(agile, epic)) {
    const status = readEpicStatus(readFileSync(storyFile(agile, id), 'utf8'));
    if (status !== null && status !== 'backlog') {
      return no({ reason: 'stories-begun', detail: `${epic} is marked backlog and its story ${id} is ${status}`,
        hint: `set the status in ${file} back to in-progress, then re-run; nothing was written` });
    }
  }
  return { agile, file, text, epic, next: at.next, epics: at.epics, release: at.release, requirements: held.value.requirements, payload: payload.value };
}

/** Save what the user answered, as they answer it. @param {string} dir @param {string} payloadFile */
function answer(dir, payloadFile) {
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
  // a rest a run cut short listed already, which the same split finishes rather than lists twice
  const again = from.find((e) => e.read.title === split?.name) ?? null;
  const off = new Set(from.filter((e) => e !== again).flatMap((e) => e.read.requirements));
  let text = '';
  const file = readBack(requirementsFile(up.agile), 'a "# Requirements:" title, then "## Requirements" with "- **ID**: text" lines under "### " categories, then "## Deferred"',
    (t) => { text = t; return readRequirementsFile(t); });
  if ('refusal' in file) return no(file.refusal);
  // what an epic split from this one carries is off this one, as Deferred is off every epic
  const ask = judgeAsk(up.payload, { own: up.requirements.filter((id) => !off.has(id)), file: file.value, named: onEpics });
  if ((ask.defer.length || ask.add.length) && !file.value.whole) {
    return no({ reason: 'release-damaged', detail: `${requirementsFile(up.agile)} holds a line its own writer doesn't, and deferring or adding would rewrite the file without it`,
      hint: 'move that line out of the file, or leave defer and add empty, then re-run; nothing was written' });
  }
  const cut = judgeSplit(split, { ...self, id: up.epic, requirements: ask.requirements, added: ask.add.map((q) => q.id), rest: again?.id ?? nextEpic(up.epics) });
  const list = judgeStories(up.payload, { id: up.epic, requirements: cut.requirements, earlier, backlog: captureLines(agileBacklogFile(up.agile)) });
  const issues = [...ask.issues, ...cut.issues, ...list.issues];
  if (issues.length) return no(payloadRefused('stories-refused', `the stories for ${up.epic} have`, issues));
  // on no epic: one the design left there, or one a refinement cut short added
  const unplaced = file.value.requirements.filter((q) => !onEpics.has(q.id) && !ask.add.some((a) => a.id === q.id)).map(({ id, text: said }) => ({ id, text: said }));
  // a rest a run cut short listed, which this list leaves alone: its requirements leave this epic, its Done when lines can't be told apart
  const stranded = from.filter((e) => e !== again && e.read.requirements.some((id) => up.requirements.includes(id)))
    .map((e) => ({ id: e.id, lines: e.read.done_when.filter((l) => self.done_when.includes(l)) })).filter((e) => e.lines.length);
  return { up, ...list, ask, cut, listed: again !== null, self, stranded, unplaced, asked: { text, read: file.value },
    named: list.stories.map((s) => ({ id: s.id, title: s.title, size: s.size })) };
}

/** Would that list be written? @param {string} dir @param {string} payloadFile */
function propose(dir, payloadFile) {
  const got = judged(dir, payloadFile);
  if (got === null) return;
  emit({ ok: true, epic: got.up.epic, stories: got.named, ...(got.cut.rest ? { split: { id: got.cut.rest.id, name: got.cut.rest.name } } : {}),
    ...(got.unplaced.length ? { unplaced: got.unplaced } : {}) });
}

/**
 * Write the next epic's approved stories and decisions, or refuse with nothing written.
 * @param {string} dir @param {string} payloadFile
 */
function refine(dir, payloadFile) {
  const got = judged(dir, payloadFile);
  if (got === null) return;
  const { up: { agile, file, text, epic, next, release, requirements }, stories, decisions, backlog, named, ask, asked, cut, listed, self, stranded } = got;
  const written = stories.map((s) => storyFile(agile, s.id));
  stories.forEach((s, i) => atomicWrite(written[i], renderStoryFile(s)));
  // a refinement killed before its epic turned leaves stories behind, and a longer list's would read as this one's
  for (const name of readdirSync(dirname(file))) {
    const path = join(dirname(file), name);
    const whole = name.replace(/\.\d+\.\d+\.tmp$/, '');
    const left = whole === basename(file) ? name !== whole : storyNumber(whole, epic) !== null && !written.includes(path);
    if (left) unlinkFile(path);
  }
  for (const name of readdirSync(agile)) if (/^(REQUIREMENTS|release)\.md\.\d+\.\d+\.tmp$/.test(name)) unlinkFile(join(agile, name));
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
  const same = cut.requirements.join() === requirements.join();
  // last, because this is what makes the stories count
  atomicWrite(file, renderRefinedEpic(text, decisions, same ? null : cut.requirements, cut.moves));
  // after it, so a stop here leaves an item in two places and never in none
  const taken = backlog.length ? removeCaptures(agileBacklogFile(agile), backlog) : { ok: true };
  const warnings = [
    ...(taken.ok ? [] : [`the stories are written, and ${agileBacklogFile(agile)} still holds the items they took (${/** @type {any} */ (taken).detail}) - remove them there`]),
    ...stranded.map((e) => `${e.id} was split off ${epic} by a run cut short, and ${file} still holds Done when lines ${e.id} holds too: ${e.lines.map((l) => JSON.stringify(l)).join(', ')} - remove the ones ${e.id} covers`),
  ];
  emit({ ok: true, release, epic, stories: named, ...(cut.rest ? { split: { id: cut.rest.id, name: cut.rest.name } } : {}), next: { ...next, status: 'in-progress', step: 'build', story: { ...named[0], status: stories[0].status } },
    ...(warnings.length ? { warnings } : {}) });
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
    // a dead run's half-built folder, or this pid's own from before a reboot
    if (pid !== null && (pid === process.pid || !alive(pid))) clear(join(dir, name));
  }
  const building = buildDir(dir);
  for (const e of epics) {
    makeDir(dirname(epicFile(building, e.epic)));
    writeFileNew(epicFile(building, e.epic), renderEpicFile(e));
  }
  writeFileNew(join(building, 'project.md'), renderProjectFile(title, brief, epics, decisions));
  writeFileNew(requirementsFile(building), renderRequirementsFile(title, requirements));
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
  else if (argv[0] === 'start') start(planningDir(arg('start', '--dir')), arg('start', '--design'));
  else if (argv[0] === 'answer') answer(planningDir(arg('answer', '--dir')), arg('answer', '--payload'));
  else if (argv[0] === 'propose') propose(planningDir(arg('propose', '--dir')), arg('propose', '--payload'));
  else if (argv[0] === 'refine') refine(planningDir(arg('refine', '--dir')), arg('refine', '--payload'));
  else emit({ ok: false, reason: 'usage', detail: 'subcommand: next [--dir <.planning>] | check|start --design <folder> [--dir <.planning>] | answer|propose|refine --payload <file> [--dir <.planning>]' });
} catch (e) {
  emitCaught(e);
}
