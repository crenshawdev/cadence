// @ts-check
// planning/renumber.mjs - `renumber`: phase insert/remove mechanics
// the git and filesystem probes below are this handler's alone, and two of them are pinned by source in the tests because the states they guard can't be reached from one: gitDirUnder has to ask the filesystem with lstatSync and never compare a readdir entry to '.git', and the recursive rm fallback in the apply loop has to run only after both gitDirAbove and gitDirUnder have decided. Weaken either and a phase directory gets deleted whole
'use strict';

import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fail, ok, read } from './core.mjs';
import { runTransition } from '../lib/file-transition.mjs';
import {
  atomicWrite, cutPhaseDetail, findProsePhaseRefs, nextNamesPhase, parseCursor,
  parseRoadmapPhases, renderCursor, shiftNextPhases, shiftPendingReqRows, shiftPhaseTokens,
} from '../lib/planning-files.mjs';
import { requireInt } from '../lib/require-int.mjs';
import { emit } from '../lib/seam-io.mjs';

// structured edits (Phase tokens, phases/K/ paths, dirs, cursor) are automated and lowercase prose refs are reported for the model to repair with judgment; --dry-run computes the full plan and touches nothing, and it's what the confirmation gate shows
// on both ops REQUIREMENTS.md tokens shift only on Pending `## Traceability` rows and remove blanks only Pending orphans; every other line is copied through byte-identical, and frozen rows and capital tokens are left unshifted
function gitMv(from, to) {
  try { execFileSync('git', ['mv', from, to], { stdio: 'pipe' }); return 'git'; }
  catch { renameSync(from, to); return 'fs'; }
}

/**
 * Is there a `.git` entry at `from` or any ancestor? A filesystem answer and deliberately not git's: a `.git` at mode 000 makes `git status` and `git rev-parse` exit 128 with "not a git repository", byte-identical to a directory with no repository above it, and reading the message to tell them apart would let a free-text diagnostic decide control flow.
 * lstatSync and never existsSync: a dangling or unreadable symlink named `.git` is a repository this process couldn't read and has to count as present, where existsSync follows the link and answers with the permissive arm.
 * Two states the walk can't see on its own, both answered present: `GIT_DIR`/`GIT_WORK_TREE` select a repository with no lexical `.git` above the work tree, and a probe that errors (EACCES, EIO, ESTALE) is a repository we couldn't rule out. The permissive arm ends in rmSync, so "could not tell" and "definitely none" must not share it.
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
 * Is there a `.git` entry anywhere inside `target`? The companion to gitDirAbove, which looks up from the planning root and so can't see a repository rooted inside `phases/<N>`; without this, rmSync takes that nested object store along with the directory.
 * It's bounded by the phase directory's own size. A subtree we can't read answers present, for gitDirAbove's reason, and a target that isn't there answers absent since there's nothing under it to protect. That's an errno test and not a message parse.
 * lstatSync per directory and never `e.name === '.git'` over the readdir: a name compare is case-sensitive while the filesystem may not be, so an admin directory stored as `.GIT` on APFS or NTFS resolves for git and would be scanned straight past. A guard whose two halves disagree about what `.git` matches is one half open.
 * Recursion is by isDirectory, which is lstat-shaped, so a symlink is never followed and the scan can't leave the phase directory.
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
 * Every path under `relPath` carrying uncommitted state: untracked (`??`), ignored (`!!`), modified, staged or deleted. All of them make a remove unsafe: `git rm -r` exits 0 and leaves `??`/`!!` files, so the directory survives a removal that reported success and the next move nests into it, and for modified or staged files it refuses, after which the caller's rmSync fallback deletes the work with no copy in the object store. Refusing on any porcelain output covers both and leaves git's own safety check intact.
 * It returns `{paths, unreadable}` because a failed `git status` is two states and answering `[]` for both fails open. Outside a repo the call fails with empty paths and `unreadable: false`, which is right: nothing is tracked and the fallback removes the directory whole. But when gitDirAbove finds a `.git` the call still failed against, the directory may hold tracked work whose only copy is in an object store this process can't open, so that's `unreadable: true` and the caller refuses.
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

// existsSync follows a symlink and reads a dangling one as free, so the pre-flight would pass and the apply die mid-flight (renameSync onto a dangling symlink throws ENOTDIR); lstatSync catches the link itself even when its target is gone
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
  const phases = parseRoadmapPhases(roadmapText);
  if (!phases.length) {
    return fail('unparseable-roadmap', 'no phase lines under ## Phases',
      'give ROADMAP.md at least one phase line spelled'
      + ' `- [ ] **Phase <n>: <name>** - <description>` under `## Phases`, then re-run - nothing was'
      + ' moved');
  }
  const total = phases.length;
  // dir-move ceiling is integer phases only: decimals are never shifted, and a decimal ceiling would walk fractional ks (2.1, 1.1, ...) past every integer dir, moving nothing it should and the one dir it must not (#36)
  const maxN = Math.max(...phases.filter((p) => Number.isInteger(p.n)).map((p) => p.n));

  const flag = sub === 'insert' ? 'at' : 'n';
  const rawAt = sub === 'insert' ? opts.at : opts.n;
  // a valueless flag parses as boolean true and Number(true) is 1, so `renumber remove --n` with no value cut the first phase's line and detail section and shifted its directory away, ok:true; requireInt refuses that shape and every non-numeric one
  // the decimal answer stays a separate diagnostic: renumbering is integer arithmetic, and a decimal insertion like 2.1 neither displaces integers nor is displaced by them, so acting on one would only half-shift the tree
  const parsedAt = requireInt(rawAt);
  // absent only: a present `--at`/`--n` was already judged by its declared row at the dispatch door, decimal wording included (see decimalRefusal), so there's no second home for that sentence here
  if (!parsedAt.ok) {
    return fail('bad-args', `renumber ${sub} needs --${flag} <N>`,
      `pass --${flag} <N> as a whole phase number, then re-run - nothing was moved; a valueless`
      + ' flag arrives here as `true` and would otherwise have meant phase 1');
  }
  const at = parsedAt.value;
  if (sub === 'insert' && (at < 1 || at > total + 1)) {
    return fail('out-of-range', `--at must be 1..${total + 1}`,
      `pick a position inside that range - ${total + 1} appends after the last phase - then re-run;`
      + ' nothing was moved');
  }
  if (sub === 'remove' && !phases.some((p) => p.n === at)) {
    return fail('unknown-phase', `phase ${at} is not in ROADMAP.md`,
      "re-run with a phase number that appears in ROADMAP.md's `## Phases` list; nothing was"
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

  // refuse before any write if a move's destination is occupied by something this renumber doesn't itself vacate. `vacated` tracks numbers freed by moves already checked, plus `at` on a remove (freed by the rm before any move runs); without it an ordinary insert's own chain of destinations (3->4 then 2->3) would refuse itself
  // this has to run before the `git rm` below: on a remove the rm destroys a phase directory before the first move, so a check after it would report the collision only once the data is gone
  // seeded only when the rm will actually run: existingDir is existsSync, false for a dangling symlink at phases/<at>, so seeding unconditionally waved through the very occupant lstatSync was added to catch, and the apply died on the first move reporting a half-renumbered tree when nothing had been written
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

  // the `vacated` seeding assumes the rm actually frees phases/<at>, and `git rm -r -q` breaks that silently: it exits 0 while leaving untracked and ignored files behind, so the directory survives, the first move nests the next phase inside it (phases/1/2/PLAN.md), and the command still exits ok:true with ROADMAP naming a phase whose dir has no plan. Refuse instead of deleting the residue, since it's the caller's uncommitted work and `remove` is no licence to discard it
  if (sub === 'remove' && existingDir(at)) {
    const dirty = uncommittedUnder(dir, join('phases', String(at)));
    // a git that couldn't answer is its own refusal and never `uncommitted-work`, whose remedy is "commit or discard them first", the one thing a caller with an unreadable repository can't do. It sits above the dry-run return so both arms refuse: the dry-run is what the confirmation gate shows, and a gate that displays a clean plan talks the caller into the apply
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
  let newReqText = null;
  if (reqText !== null) {
    // both ops leave shipped history alone (GH-259, GH-301): only Pending Traceability rows move, and on remove only a Pending row citing the removed phase is blanked and orphaned, so it surfaces as no-phase in audit and doesn't silently point at the shifted neighbour
    ({ text: newReqText, changes: reqRowChanges, movedComplete, refs: reqRefs, orphans: orphanedReqs } =
      shiftPendingReqRows(reqText, at, delta));
  }

  const stateFile = join(dir, 'STATE.md');
  const cursor = parseCursor(read(stateFile) || '');
  let newCursor = null;
  let warn;
  if (cursor) {
    // `Next:` keeps naming the same work, so its phase numbers shift by the same rule as everything else, for a decimal cursor too. Accepted tradeoff: after `insert --at N+1` from a completed phase N, `Next:` names the old N+1's work, and /cad-progress still routes to the inserted phase
    newCursor = { ...cursor, total: total + delta, next: shiftNextPhases(cursor.next, shiftFrom, delta) };
    // the phase number only shifts for an integer cursor: a decimal cursor's own ROADMAP token and phases/<phase>/ dir are never shifted (see decimalPhases below), so moving just the number would desync it from the phase it names. total still moves, because the roadmap really did gain or lose a phase
    if (cursor.phase >= shiftFrom) {
      if (Number.isInteger(cursor.phase)) {
        newCursor.phase = cursor.phase + delta;
      } else {
        warn = `cursor sits on decimal phase ${cursor.phase}, which renumber ` +
          `never shifts (its ROADMAP token and phases/${cursor.phase}/ did not ` +
          `move either); total is now ${total + delta} - re-point it (cursor set)`;
      }
    }
    if (sub === 'remove' && cursor.phase === at) {
      warn = `cursor points at removed phase ${at}; number left as-is - re-point it (cursor set)`;
    }
    // a Next: naming the removed phase keeps the number (shiftNextPhases leaves K < shiftFrom alone) and is never blanked, since an empty Next: makes parseCursor return null; say so in a warning instead, after the notice above
    if (sub === 'remove' && nextNamesPhase(cursor.next, at)) {
      const nextWarn = `Next: names removed phase ${at}; left as written - re-point it (cursor set)`;
      warn = warn ? `${warn}; ${nextWarn}` : nextWarn;
    }
  }
  // Complete rows citing a moved phase, or on remove the removed one, are left as written. Say so by id, after any cursor warning and without touching its text, since callers match `warn` as one string. No promise that status or audit flags these later: neither does when the old number now lands on another completed phase
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

  // prose refs the shift leaves alone are for the model to repair with judgment; REQUIREMENTS refs come from the pass above on both ops, which leaves out the frozen rows
  const inTextRefs = [];
  for (const f of ['ROADMAP.md', 'REQUIREMENTS.md', 'STATE.md', 'PROJECT.md']) {
    const t = read(join(dir, f));
    if (t === null) continue;
    const refs = f === 'REQUIREMENTS.md' && reqRefs ? reqRefs : findProsePhaseRefs(t, shiftFrom);
    for (const ref of refs) inTextRefs.push({ file: f, ...ref });
  }

  // decimal phases are never shifted (see shiftPhaseTokens), so report them and the caller re-places them deliberately instead of discovering the gap
  const decimalPhases = phases.filter((p) => !Number.isInteger(p.n)).map((p) => p.n);

  const ops = [
    ...dirMoves.map(([f, t]) => ({ git_mv: [`phases/${f}`, `phases/${t}`] })),
    ...(sub === 'remove' && existingDir(at) ? [{ rm: `phases/${at}` }] : []),
    { edit: 'ROADMAP.md', changes: roadmapShift.count + (sub === 'remove' ? 1 : 0) },
    // both ops count changed lines, same as req_row_changes below
    ...(newReqText !== null ? [{ edit: 'REQUIREMENTS.md', changes: reqRowChanges.length }] : []),
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

  // apply is an ordered step list run under one guard. The order is rm first, then the moves, which is not the order `ops` displays (moves first, and a test pins that): `ops` is the plan shown at the dry-run gate and `completed` below is the record of what ran, the authority when the two disagree. Replaying the printed order by hand on a remove would `git mv` onto a still-present directory and nest it
  // this is a partial-state report and not a rollback: remove destroys phases/<at> before the first move, so step one can never be undone, and advertising a rollback the code lacks would stop the caller checking the tree by hand
  /** @type {Array<[Record<string, any>, () => void]>} */
  const steps = [];
  if (sub === 'remove' && existingDir(at)) {
    steps.push([{ rm: `phases/${at}` }, () => {
      // `cwd: dir`, matching the pre-flight's own git status call: without it git discovers the repository from the caller's cwd, which for any `--dir` outside it is a different repository or none, so git answered "outside repository" and every remove fell through to the rmSync below, tracked work and all
      try { execFileSync('git', ['rm', '-r', '-q', join(dir, 'phases', String(at))], { cwd: dir, stdio: 'pipe' }); }
      catch {
        // the recursive delete is the destructive act this command is built around, so it gets its own gate and doesn't trust the pre-flight's: that ran before the roadmap was computed, a git state can become unreadable between the two, and this arm also fires on a `git rm` failure the pre-flight didn't predict, which inside a repository means git disagrees with its clean answer. Either way the object store may be the only copy of what's about to go
        // with no repository at, above or inside the target there's no object store to consult and no residue to nest into, so the fallback stays the only remover (the bare-tree path every renumber fixture runs on). gitDirUnder carries the "inside" half, since looking up from the planning root can't see a repository rooted in the directory being deleted
        const target = join(dir, 'phases', String(at));
        if (gitDirAbove(dir) || gitDirUnder(target)) {
          // worded to what is known: `git rm` failing doesn't prove the repository is unreadable, it proves the git state this delete depends on went unread, which covers both a `.git` we can't open and an answer we didn't predict. Claiming the stronger fact would be a verdict the check didn't earn
          throw new Error(`git rm -r failed for phases/${at} and a git repository sits at, above or inside it, so the git state this delete depends on is unread - refusing the recursive fallback, since the object store may hold the only copy; run \`git rm -r -- .planning/phases/${at}\` from the repository to see git's own answer`);
        }
        rmSync(target, { recursive: true });
      }
    }]);
  }
  for (const [f, t] of dirMoves) {
    steps.push([{ git_mv: [`phases/${f}`, `phases/${t}`] },
      () => gitMv(join(dir, 'phases', String(f)), join(dir, 'phases', String(t)))]);
  }
  steps.push([{ edit: 'ROADMAP.md' }, () => atomicWrite(roadmapFile, newRoadmap)]);
  if (newReqText !== null) steps.push([{ edit: 'REQUIREMENTS.md' }, () => atomicWrite(reqFile, newReqText)]);
  if (newCursor) steps.push([{ edit: 'STATE.md' }, () => atomicWrite(stateFile, renderCursor(newCursor))]);

  // stop at the first throw: once a step fails the tree no longer matches the plan the later steps were computed from, and running them on would compound the disagreement. lib/file-transition.mjs keeps the ordering and the completed/failed record; the envelope below is this seam's own since prune's is a different shape
  const applied = runTransition({ steps, discipline: 'stop-at-first-failure' });
  if (!applied.ok) {
    const { key: op, error: e } = applied.failures[0];
    // bypasses the dispatch-level catch (which flattens to `internal`) and fail's reason/detail/hint-only shape, since a completed-ops list needs its own emit
    return emit({
      ok: false, reason: 'partial-apply', completed: applied.completed, failed: op,
      detail: e && e.message ? e.message : String(e),
      // deliberately doesn't say "re-run": the half-applied tree no longer matches ROADMAP and a re-run recomputes its plan from it, so on a remove it would rm phases/<at>, which now holds the next phase's work, and exit ok:true having destroyed it
      hint: applied.completed.length
        ? 'the tree is partly renumbered and no longer matches ROADMAP - reconcile the completed ops by hand before any further renumber; re-running this command against the half-applied tree can destroy a phase directory'
        : 'nothing was written - the first step failed, so the tree is unchanged and safe to re-run once the cause is fixed',
    });
  }

  // Sanity recount: every ROADMAP phase maps to at most one dir, none stray.
  const after = parseRoadmapPhases(read(roadmapFile) || '');
  ok({ ...result, total: after.length });
}

export { cmdRenumber };
