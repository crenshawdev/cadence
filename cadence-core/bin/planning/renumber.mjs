// @ts-check
// planning/renumber.mjs - `renumber`: phase insert/remove mechanics
// the phases it renumbers are the state's; the list in ROADMAP.md is rendered from the state after the last move, so a
// failed apply leaves the state holding the old numbering. The `Phase K` tokens and detail sections are text edits
// two probes below are pinned by source in the tests: the nested one uses lstat, and the rm fallback waits on both
'use strict';

import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fail, intFlag, ok, read } from './core.mjs';
import { runTransition } from '../lib/file-transition.mjs';
import {
  cutPhaseDetail, findProsePhaseRefs, nextNamesPhase,
  parseRequirements, parseRoadmapPhases, shiftNextPhases, shiftPendingReqRows, shiftPhaseTokens,
} from '../lib/planning-files.mjs';
import { atomicWrite, movePath, removeTree } from '../lib/planning-store.mjs';
import { renderTraceability } from '../lib/state-views.mjs';
import { changeState, loadState, phaseListOf, withPhases } from './state-import.mjs';
import { emit } from '../lib/seam-io.mjs';

// structured edits are automated, lowercase prose refs are reported for the model; --dry-run touches nothing
// REQUIREMENTS.md tokens shift only on Pending `## Traceability` rows; every other line is copied byte-identical
function gitMv(from, to) {
  try { execFileSync('git', ['mv', from, to], { stdio: 'pipe' }); return 'git'; }
  catch { movePath(from, to); return 'fs'; }
}

/**
 * Is there a `.git` entry at `from` or any ancestor? A filesystem answer, deliberately not git's: a `.git` at mode 000
 * makes git exit 128 with the same message as no repository, and a free-text diagnostic shouldn't decide control flow.
 * lstatSync, not existsSync: a dangling or unreadable `.git` link is a repository we couldn't read, so it's present.
 * `GIT_DIR`/`GIT_WORK_TREE` and a probe that errors both answer present too, because the permissive arm ends in rmSync.
 * @param {string} from @returns {boolean}
 */
function gitDirAbove(from) {
  if (process.env.GIT_DIR || process.env.GIT_WORK_TREE) return true;
  try {
    let cur = resolvePath(from);
    for (;;) {
      if (lstatSync(join(cur, '.git'), { throwIfNoEntry: false })) return true;
      const up = dirname(cur);
      if (up === cur) return false;
      cur = up;
    }
  } catch { return true; }
}

/**
 * Is there a `.git` entry anywhere inside `target`? The companion to gitDirAbove, which can't see a repository rooted
 * inside `phases/<N>`; without it rmSync takes that nested object store along with the directory.
 * A subtree we can't read answers present; a missing target answers absent. That's an errno test, not a message parse.
 * lstatSync per directory, not a name compare: the filesystem may be case-insensitive and `.GIT` would slip past.
 * Recursion is by isDirectory, which is lstat-shaped, so a symlink is never followed out of the phase directory.
 * @param {string} target @returns {boolean}
 */
function gitDirUnder(target) {
  let entries;
  try {
    if (lstatSync(join(target, '.git'), { throwIfNoEntry: false })) return true;
    entries = readdirSync(target, { withFileTypes: true });
  } catch (e) { return !(e && e.code === 'ENOENT'); }
  for (const e of entries) {
    if (e.isDirectory() && gitDirUnder(join(target, e.name))) return true;
  }
  return false;
}

/**
 * Every path under `relPath` carrying uncommitted state: untracked, ignored, modified, staged or deleted.
 * Any of them makes a remove unsafe: `git rm -r` exits 0 and leaves `??`/`!!` files behind, and for modified or staged
 * files it refuses and the rmSync fallback then deletes the only copy.
 * It returns `{paths, unreadable}` because a failed `git status` is two states, and `[]` for both fails open.
 * Outside a repo that is empty and `unreadable: false`; a `.git` git failed on is `unreadable: true`.
 * `relPath` is relative to `cwd`, so it works whether `--dir` is absolute or relative.
 * @param {string} cwd @param {string} relPath
 * @returns {{paths: string[], unreadable: boolean}}
 */
function uncommittedUnder(cwd, relPath) {
  try {
    const out = execFileSync('git', ['status', '--porcelain', '--ignored', '--', relPath],
      { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return {
      paths: out.split('\n').filter((l) => l.trim()).map((l) => l.slice(3).trim()),
      unreadable: false,
    };
  } catch {
    return { paths: [], unreadable: gitDirAbove(cwd) };
  }
}

// existsSync reads a dangling symlink as free and the apply dies mid-flight on renameSync; lstatSync sees the link
function occupied(p) { return existsSync(p) || !!lstatSync(p, { throwIfNoEntry: false }); }

function cmdRenumber(dir, sub, opts) {
  if (sub !== 'insert' && sub !== 'remove') return fail('usage', 'renumber <insert --at N | remove --n N> [--dry-run]');
  const roadmapFile = join(dir, 'ROADMAP.md');
  const roadmapText = read(roadmapFile);
  if (roadmapText === null) {
    return fail('no-roadmap', `${roadmapFile} not found`,
      'point --dir at the .planning/ directory that holds ROADMAP.md - renumbering is computed FROM'
      + ' the roadmap, so there is nothing to renumber against without it');
  }
  // the phases are the state's: a line added to the list by hand is not a phase, and one taken out is not a removal
  const state = loadState(dir);
  if (!state) return;
  const phases = phaseListOf(state);
  if (!phases.length) {
    return fail('unparseable-roadmap', 'the project has no phases to renumber',
      'add a phase to the project first (/cad-phase add), then re-run - nothing was moved');
  }
  const total = phases.length;
  // dir-move ceiling is integer phases only: a decimal ceiling would walk fractional ks past every integer dir (#36)
  const maxN = Math.max(...phases.filter((p) => Number.isInteger(p.n)).map((p) => p.n));

  const flag = sub === 'insert' ? 'at' : 'n';
  const rawAt = sub === 'insert' ? opts.at : opts.n;
  // a valueless flag is boolean true and Number(true) is 1, so `renumber remove --n` cut the first phase
  // the decimal answer stays its own diagnostic: 2.1 neither displaces integers nor is displaced by them
  // absent only: a present `--at`/`--n` was already judged by its declared row at the dispatch door
  const parsedAt = intFlag(rawAt, null, `renumber ${sub} needs --${flag} <N>`,
    `pass --${flag} <N> as a whole phase number, then re-run - nothing was moved; a valueless`
    + ' flag arrives here as `true` and would otherwise have meant phase 1');
  if (!parsedAt.ok) return;
  const at = parsedAt.value;
  if (sub === 'insert' && (at < 1 || at > total + 1)) {
    return fail('out-of-range', `--at must be 1..${total + 1}`,
      `pick a position inside that range - ${total + 1} appends after the last phase - then re-run;`
      + ' nothing was moved');
  }
  if (sub === 'remove' && !phases.some((p) => p.n === at)) {
    return fail('unknown-phase', `phase ${at} is not in the project's phase list`,
      "re-run with a phase number that appears in the `## Phases` list of ROADMAP.md; nothing was"
      + ' moved');
  }

  const delta = sub === 'insert' ? 1 : -1;
  const shiftFrom = sub === 'insert' ? at : at + 1;

  // Directory moves, in collision-safe order.
  const dirMoves = [];
  const existingDir = (k) => existsSync(join(dir, 'phases', String(k)));
  if (sub === 'insert') {
    for (let k = maxN; k >= at; k--) if (existingDir(k)) dirMoves.push([k, k + 1]);
  } else {
    for (let k = at + 1; k <= maxN; k++) if (existingDir(k)) dirMoves.push([k, k - 1]);
  }

  // refuse before any write if a move's destination is occupied by something this renumber doesn't vacate
  // `vacated` is numbers freed by checked moves, plus `at` on a remove, or an insert's 3->4, 2->3 chain refuses itself
  // runs before the `git rm` below: on a remove the rm destroys a phase directory first, so later is too late
  // seeded only when the rm will run: existingDir is existsSync, false for a dangling link that lstatSync catches
  const vacated = new Set(sub === 'remove' && existingDir(at) ? [String(at)] : []);
  for (const [f, t] of dirMoves) {
    const dest = join(dir, 'phases', String(t));
    if (occupied(dest) && !vacated.has(String(t))) {
      return fail('collision',
        `phases/${t} already exists and is not a phase this renumber vacates - move or delete it first`,
        'ls .planning/phases');
    }
    vacated.add(String(f));
  }

  // `vacated` assumes the rm frees phases/<at>, but `git rm -r -q` exits 0 and leaves untracked files behind
  if (sub === 'remove' && existingDir(at)) {
    const dirty = uncommittedUnder(dir, join('phases', String(at)));
    // a git that couldn't answer is its own refusal, never `uncommitted-work`, whose remedy it can't do
    if (dirty.unreadable) {
      return fail('unreadable-git-state',
        `phases/${at} sits under a git repository whose state could not be read, so whether it holds uncommitted work is unknown - removing it could destroy work only git can recover`,
        `restore read access to the repository's git directory (ls -ld .git), then re-run; the removal stays refused until git can answer for .planning/phases/${at}`);
    }
    if (dirty.paths.length) {
      return fail('uncommitted-work',
        `phases/${at} holds ${dirty.paths.length} file(s) with uncommitted state (e.g. ${dirty.paths[0]}) - commit or discard them first; removing the phase would destroy work git cannot recover`,
        `git status --porcelain --ignored -- .planning/phases/${at}`);
    }
  }

  // File edits, computed up front.
  let newRoadmap = roadmapText;
  if (sub === 'remove') {
    newRoadmap = newRoadmap.split('\n')
      .filter((l) => !new RegExp(`^- \\[( |x)\\] \\*\\*Phase ${at}: `).test(l)).join('\n');
    newRoadmap = cutPhaseDetail(newRoadmap, at);
  }
  const roadmapShift = shiftPhaseTokens(newRoadmap, shiftFrom, delta);
  newRoadmap = roadmapShift.text;

  const reqFile = join(dir, 'REQUIREMENTS.md');
  const reqText = read(reqFile);
  /** @type {string[]} */
  let orphanedReqs = [];
  /** @type {Array<{line: number, before: string, after: string}>} */
  let reqRowChanges = [];
  /** @type {string[]} */
  let movedComplete = [];
  /** @type {Array<{line: number, text: string}> | null} */
  let reqRefs = null;
  /** @type {Array<{id: string, phase: number | null, status: string}> | null} */
  let newReqs = null;
  if (reqText !== null) {
    // the rows are the state's: the shift runs over the table as the state renders it, so a hand edit to a row is not
    // moved, and the state takes the shifted rows back
    // both ops leave shipped history alone (GH-259, GH-301): only Pending Traceability rows move or get blanked
    const shown = renderTraceability(state, reqText);
    const base = shown.missing ? reqText : shown.text;
    const shifted = shiftPendingReqRows(base, at, delta);
    ({ movedComplete, refs: reqRefs, orphans: orphanedReqs } = shifted);
    reqRowChanges = shifted.changes;
    if (!shown.missing) {
      newReqs = parseRequirements(shifted.text);
      // each changed row as the regenerated file shows it, which is the form the renderer writes
      const after = renderTraceability({ ...state, requirements: newReqs }, reqText).text.split('\n');
      const bare = (/** @type {string} */ l) => l.replace(/\r$/, '');
      reqRowChanges = base.split('\n').flatMap((before, i) => (before === after[i]
        ? [] : [{ line: i + 1, before: bare(before), after: bare(after[i]) }]));
    }
  }

  // the cursor it re-points is the state's; STATE.md is rendered from the state afterwards, never read
  const cursor = state.cursor;
  let newCursor = null;
  let warn;
  // one rule for the report here and for the write under the lock, which applies it to the cursor it finds then
  // `Next:` keeps naming the same work, so its phase numbers shift by the same rule, a decimal cursor too
  // the number only shifts for an integer cursor: a decimal cursor's own token and dir never shift. total still moves
  const shiftCursor = (c) => ({
    ...c,
    next: shiftNextPhases(c.next, shiftFrom, delta),
    ...(c.phase >= shiftFrom && Number.isInteger(c.phase) ? { phase: c.phase + delta } : {}),
  });
  if (cursor) {
    newCursor = shiftCursor(cursor);
    if (cursor.phase >= shiftFrom && !Number.isInteger(cursor.phase)) {
      warn = `cursor sits on decimal phase ${cursor.phase}, which renumber ` +
        `never shifts (its ROADMAP token and phases/${cursor.phase}/ did not ` +
        `move either); total is now ${total + delta} - re-point it (cursor set)`;
    }
    if (sub === 'remove' && cursor.phase === at) {
      warn = `cursor points at removed phase ${at}; number left as-is - re-point it (cursor set)`;
    }
    // a Next: naming the removed phase keeps its number and is never blanked: empty makes parseCursor return null
    if (sub === 'remove' && nextNamesPhase(cursor.next, at)) {
      const nextWarn = `Next: names removed phase ${at}; left as written - re-point it (cursor set)`;
      warn = warn ? `${warn}; ${nextWarn}` : nextWarn;
    }
  }
  // Complete rows citing a moved phase, or the removed one, are left as written; say so by id, after any cursor warning
  if (movedComplete.length) {
    const completeWarn = sub === 'insert'
      ? `Complete requirement row(s) ${movedComplete.join(', ')} cite a phase this ` +
        'insert moves and were left unchanged, so each may now name a different phase than the one ' +
        'it shipped in - re-point a row by hand only if it belongs to the open milestone'
      : `Complete requirement row(s) ${movedComplete.join(', ')} cite a phase this remove deletes ` +
        'or renumbers and were left unchanged, so each may now name a missing or different phase - ' +
        're-point a row by hand only if it belongs to the open milestone';
    warn = warn ? `${warn}; ${completeWarn}` : completeWarn;
  }

  // prose refs the shift leaves alone are for the model to repair; REQUIREMENTS refs come from the pass above
  const inTextRefs = [];
  const readEarlier = { 'ROADMAP.md': roadmapText, 'REQUIREMENTS.md': reqText };
  for (const f of ['ROADMAP.md', 'REQUIREMENTS.md', 'STATE.md', 'PROJECT.md']) {
    const t = f in readEarlier ? readEarlier[f] : read(join(dir, f));
    if (t === null) continue;
    const refs = f === 'REQUIREMENTS.md' && reqRefs ? reqRefs : findProsePhaseRefs(t, shiftFrom);
    for (const ref of refs) inTextRefs.push({ file: f, ...ref });
  }

  // decimal phases are never shifted (see shiftPhaseTokens), so report them and let the caller re-place them
  const decimalPhases = phases.filter((p) => !Number.isInteger(p.n)).map((p) => p.n);

  const ops = [
    ...dirMoves.map(([f, t]) => ({ git_mv: [`phases/${f}`, `phases/${t}`] })),
    ...(sub === 'remove' && existingDir(at) ? [{ rm: `phases/${at}` }] : []),
    { edit: 'ROADMAP.md', changes: roadmapShift.count + (sub === 'remove' ? 1 : 0) },
    // both ops count changed lines, same as req_row_changes below
    ...(reqText !== null ? [{ edit: 'REQUIREMENTS.md', changes: reqRowChanges.length }] : []),
    ...(newCursor ? [{ edit: 'STATE.md', changes: 1 }] : []),
  ];

  // one list for the dry-run and the apply, so the apply can be checked against what the gate showed
  const result = {
    ops,
    ...(reqRowChanges.length ? { req_row_changes: reqRowChanges } : {}),
    ...(inTextRefs.length ? { in_text_refs: inTextRefs } : {}),
    ...(orphanedReqs.length ? { orphaned_reqs: orphanedReqs } : {}),
    ...(decimalPhases.length ? { decimal_phases: decimalPhases } : {}),
    ...(warn ? { warn } : {}),
    ...(sub === 'insert' ? { slot: `add the new "- [ ] **Phase ${at}: ...**" line and its detail section` } : {}),
  };
  if ('dry-run' in opts) return ok({ dry_run: true, ...result });

  // apply is an ordered step list: rm first, then the moves, which isn't the order `ops` displays (a test pins that)
  // `ops` is what the dry-run gate shows and `completed` is what ran; replaying `ops` by hand on a remove nests a dir
  // a partial-state report, not a rollback: remove destroys phases/<at> before the first move and can't undo it
  /** @type {Array<[Record<string, any>, () => void]>} */
  const steps = [];
  if (sub === 'remove' && existingDir(at)) {
    steps.push([{ rm: `phases/${at}` }, () => {
      // `cwd: dir`, like the pre-flight's git status: else git finds the caller's repo and every remove fell to rm
      try { execFileSync('git', ['rm', '-r', '-q', join(dir, 'phases', String(at))], { cwd: dir, stdio: 'pipe' }); }
      catch {
        // the recursive delete is the destructive act here, so it gets its own gate and doesn't trust the pre-flight's
        // no repository at, above or inside the target means no object store to consult, so rm is the only remover
        const target = join(dir, 'phases', String(at));
        if (gitDirAbove(dir) || gitDirUnder(target)) {
          // worded to what is known: a failed `git rm` proves the git state went unread, nothing stronger
          throw new Error(`git rm -r failed for phases/${at} and a git repository sits at, above or inside it, so the git state this delete depends on is unread - refusing the recursive fallback, since the object store may hold the only copy; run \`git rm -r -- .planning/phases/${at}\` from the repository to see git's own answer`);
        }
        removeTree(target);
      }
    }]);
  }
  for (const [f, t] of dirMoves) {
    steps.push([{ git_mv: [`phases/${f}`, `phases/${t}`] },
      () => gitMv(join(dir, 'phases', String(f)), join(dir, 'phases', String(t)))]);
  }
  steps.push([{ edit: 'ROADMAP.md' }, () => atomicWrite(roadmapFile, newRoadmap)]);
  // last: the state takes the renumbered phases and cursor, then the list in ROADMAP.md and STATE.md are rendered from it
  // the shifted text above already shows the new numbers, so a render keeps those lines as they are
  steps.push([newCursor ? { edit: 'STATE.md' } : { edit: 'state.json' }, () => {
    // applied to the state as the lock finds it, never to the snapshot read at the top: a phase, cursor or row another seam
    // committed while the directories moved is shifted, not overwritten
    changeState(dir, (s) => {
      const renumbered = s.phases
        .filter((p) => !(sub === 'remove' && p.n === at))
        .map((p) => (Number.isInteger(p.n) && p.n >= shiftFrom ? { ...p, n: p.n + delta } : p));
      let requirements = s.requirements;
      if (reqText !== null) {
        const shown = renderTraceability(s, reqText);
        if (!shown.missing) requirements = parseRequirements(shiftPendingReqRows(shown.text, at, delta).text);
      }
      return { ...withPhases(s, renumbered), cursor: s.cursor ? shiftCursor(s.cursor) : s.cursor, requirements };
    }, ['STATE.md', 'ROADMAP.md', 'REQUIREMENTS.md'], {
      onFail: (res) => { throw new Error(`the state file was ${res.stateWritten ? 'written, the generated files were not' : 'not written'}: ${res.reason} - ${res.detail}`); },
    });
  }]);

  // stop at the first throw: once a step fails the tree no longer matches the plan, and running on would compound it
  const applied = runTransition({ steps, discipline: 'stop-at-first-failure' });
  if (!applied.ok) {
    const { key: op, error: e } = applied.failures[0];
    // bypasses the dispatch-level catch (which flattens to `internal`), since a completed-ops list needs its own emit
    return emit({
      ok: false, reason: 'partial-apply', completed: applied.completed, failed: op,
      detail: e && e.message ? e.message : String(e),
      // deliberately no "re-run": it recomputes from a half-applied tree and, on a remove, rm's the next phase's work
      hint: applied.completed.length
        ? 'the tree is partly renumbered - reverse the completed directory moves and text edits by hand before any further renumber, and never the phase list, the traceability table or STATE.md, which are rendered from the state file; it still holds the old numbering unless the detail says it was written; re-running this command against the half-applied tree can destroy a phase directory'
        : 'nothing was written - the first step failed, so the tree is unchanged and safe to re-run once the cause is fixed',
    });
  }

  // Sanity recount: every ROADMAP phase maps to at most one dir, none stray.
  const after = parseRoadmapPhases(read(roadmapFile) || '');
  ok({ ...result, total: after.length });
}

export { cmdRenumber };
