// @ts-check
// planning/renumber.mjs - `renumber`: phase insert/remove mechanics.
//
// The five git and filesystem probes below are this handler's alone (D-05), and
// two of them are load-bearing enough that planning.test.mjs pins them by
// SOURCE rather than by behaviour, because the states they guard are
// unreachable from a test: `gitDirUnder` must ask the filesystem with
// `lstatSync` and never compare a readdir entry to '.git', and the apply loop's
// recursive rm fallback must run only after BOTH `gitDirAbove` and
// `gitDirUnder` have decided. Those two rows read this file now; a weakened or
// deleted arm here is a fail-open that deletes a phase directory whole.
'use strict';

import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fail, ok, read } from './core.mjs';
import { runTransition } from '../lib/file-transition.mjs';
import {
  atomicWrite, cutPhaseDetail, findProsePhaseRefs, parseCursor, parseRequirements,
  parseRoadmapPhases, renderCursor, shiftPhaseTokens,
} from '../lib/planning-files.mjs';
import { requireInt } from '../lib/require-int.mjs';
import { emit } from '../lib/seam-io.mjs';

// ---------------------------------------------------------------------------
// renumber - phase insert/remove mechanics. Structured edits (Phase tokens,
// phases/K/ paths, dirs, cursor) are automated; lowercase prose refs are
// reported for the model to repair with judgment. --dry-run computes the full
// operation plan and touches nothing - it is what the confirmation gate shows.
// ---------------------------------------------------------------------------
function gitMv(from, to) {
  try { execFileSync('git', ['mv', from, to], { stdio: 'pipe' }); return 'git'; }
  catch { renameSync(from, to); return 'fs'; }
}

/**
 * Is there a `.git` entry at `from` or at any ancestor? A FILESYSTEM answer,
 * and deliberately not git's own: a `.git` at mode 000 makes `git status` and
 * `git rev-parse` alike exit 128 with `fatal: not a git repository`, byte-
 * identical to a directory that genuinely has no repository above it. So git's
 * exit code and its stderr cannot separate "unreadable" from "absent" at all,
 * and reading the message to try would be a parser over free text - the thing
 * `review-provider.mjs`'s "a diagnostic string never decides control flow" ban
 * exists to stop. The precedent for probing rather than parsing is
 * `gitIgnoreState` above.
 *
 * `lstatSync`, never `existsSync`: a dangling or unreadable symlink named
 * `.git` is still a repository this process could not read, and must count as
 * PRESENT. `existsSync` follows the link, finds nothing, and answers with the
 * permissive arm - the same failure mode `occupied` below was written for.
 *
 * Two states this walk cannot see on its own, both of which would otherwise
 * report ABSENT for a repository that is present:
 *   - `GIT_DIR`/`GIT_WORK_TREE` in the environment select a repository with no
 *     lexical `.git` anywhere above the work tree. The walk finds nothing while
 *     an object store holding the only copy of the work is very much there.
 *   - a probe that ERRORS - EACCES on an ancestor we may not stat, EIO, ESTALE -
 *     is a repository we could not rule OUT, never one we ruled out.
 * Both answer PRESENT. This gate's permissive arm ends in `rmSync`, so
 * "could not tell" and "definitely none" must not share it: the whole point of
 * the check is that an unread git state never reads as a clean one.
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
 * Is there a `.git` entry anywhere INSIDE `target`? The companion to
 * `gitDirAbove`, which starts at the planning root and looks UP - so a
 * repository rooted inside `phases/<N>` is invisible to it, an otherwise
 * non-repository tree answers ABSENT, and `rmSync` takes that nested object
 * store along with the directory. It is the same failure the caller's refusal
 * exists to stop, reached from the other side.
 *
 * Bounded by the phase directory's own size - a handful of markdown files and
 * a reports dir. A subtree we cannot read answers PRESENT for `gitDirAbove`'s
 * reason; a target that is not there at all answers ABSENT, since there is
 * nothing under it to protect. That is an errno test and not a message parse:
 * `review-provider.mjs`'s ban is on a diagnostic STRING deciding control flow.
 *
 * `lstatSync` per directory, never `e.name === '.git'` over the readdir: a
 * name comparison is case-SENSITIVE while the filesystem underneath may not be,
 * so an admin directory stored as `.GIT` on APFS or NTFS still resolves for git
 * and would be scanned straight past. Probing inherits the filesystem's own
 * case semantics, which is what `gitDirAbove` has always done - a guard whose
 * two halves disagree about what `.git` matches is one half open.
 *
 * Directory recursion is by `isDirectory()`, which is lstat-shaped, so a
 * symlink is never followed and the scan cannot leave the phase directory.
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
 * Every path under `relPath` carrying uncommitted state - untracked (`??`),
 * ignored (`!!`), modified, staged, or deleted. All of them make a `remove`
 * unsafe, for two different reasons:
 *   - `??`/`!!`: `git rm -r` exits 0 and LEAVES them, so the directory
 *     survives a removal that reported success and the next move nests into
 *     it.
 *   - modified/staged: `git rm -r` REFUSES ("file has local modifications")
 *     and the caller's `rmSync` fallback then deletes the work anyway, with
 *     no copy in the object store to recover from.
 * Refusing on any porcelain output covers both, and leaves git's own
 * safety check intact instead of overriding it.
 *
 * Return shape: `{paths, unreadable}`, because a failed `git status` is TWO
 * states and answering `[]` for both is a fail-open that deletes. Outside a git
 * repo the call fails and `paths` is empty with `unreadable:false` - correctly,
 * since nothing is tracked there, the `rmSync` fallback removes the directory
 * whole, and no residue can survive to be nested into. But when `gitDirAbove`
 * finds a `.git` the call still failed against, the state is UNREADABLE: the
 * directory may hold tracked work whose only copy is in an object store this
 * process cannot open, and `[]` would classify it as clean and delete it.
 * `unreadable:true` is that third answer, and the caller refuses on it.
 * A record rather than a bare array costs nothing: this has exactly one caller.
 * `relPath` is relative to `cwd`, so this works whether the caller's `--dir`
 * is absolute or relative.
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

// `existsSync` alone follows a symlink and reads a DANGLING one as free -
// the pre-flight would then pass and the apply dies mid-flight (renameSync
// onto a dangling symlink throws ENOTDIR). `lstatSync` catches the link
// itself even when its target is gone.
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
  // Dir-move ceiling: integer phases only. Decimals are never shifted (see
  // below), and a decimal ceiling would walk fractional ks (2.1, 1.1, ...)
  // past every integer dir - moving nothing it should and the one dir it
  // must not (#36).
  const maxN = Math.max(...phases.filter((p) => Number.isInteger(p.n)).map((p) => p.n));

  const flag = sub === 'insert' ? 'at' : 'n';
  const rawAt = sub === 'insert' ? opts.at : opts.n;
  // A valueless flag parses as the boolean `true` and `Number(true)` is 1, so
  // `renumber remove --n` with no value cut phase 1's line, its detail section
  // and shifted its directory away - ok:true, and only the NaN screen stood
  // between the flag and the apply. requireInt refuses that shape and every
  // non-numeric one.
  //
  // The decimal answer stays a SEPARATE diagnostic (renumbering is integer
  // arithmetic; a decimal insertion like 2.1 neither displaces integers nor is
  // displaced by them, so operating ON one would only half-shift the tree).
  // requireInt refuses `2.1` and `--n` alike, and those are different repairs,
  // so a well-formed decimal is re-tested here and keeps its own wording.
  const parsedAt = requireInt(rawAt);
  // ABSENT only: a PRESENT `--at`/`--n` was already judged by its declared row
  // at the dispatch door, decimal wording included (see `decimalRefusal`), so
  // the well-formed-decimal re-test that used to sit here can no longer be
  // reached and is not left behind as a second home for that sentence.
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

  // Pre-flight: refuse before any write if a move's destination is occupied
  // by something this renumber does not itself vacate (D-04). `vacated`
  // tracks numbers freed by moves already checked (plus `at` on a remove,
  // freed by the rm before any move runs) - without it, an ordinary insert's
  // OWN chain of destinations (e.g. 3->4 then 2->3, where phases/3 exists at
  // check time as move 1's still-unmoved source) would refuse itself. This
  // must run before the `git rm` below: on a remove, the rm destroys a phase
  // directory before the first move, so a check placed after it would report
  // the collision only once the data is already gone.
  // Seeded only when the rm will actually RUN: `existingDir` is existsSync,
  // which is false for a dangling symlink at phases/<at>, so seeding
  // unconditionally waved through exactly the occupant `occupied()`/lstatSync
  // was added to catch - the apply then died on the first move and reported a
  // half-renumbered tree when nothing had been written at all.
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

  // The `vacated` seeding above assumes the rm actually FREES phases/<at>.
  // `git rm -r -q` breaks that assumption silently: it exits 0 while leaving
  // untracked and ignored files behind, so the directory survives, the first
  // move NESTS the next phase inside it (phases/1/2/PLAN.md), and the command
  // still exits ok:true with ROADMAP naming a phase whose dir has no plan -
  // the exact D-04 nesting hazard, reached through the rm rather than a stray
  // dir. Verified live. Refuse before any write instead of deleting the
  // residue: it is the caller's uncommitted work, and `remove` is not a
  // licence to discard it.
  if (sub === 'remove' && existingDir(at)) {
    const dirty = uncommittedUnder(dir, join('phases', String(at)));
    // A git that could not ANSWER is its own refusal, never `uncommitted-work`:
    // that reason's remedy is "commit or discard them first", which is the one
    // thing a caller whose repository is unreadable cannot do. This sits above
    // the dry-run return below, so both arms refuse - the dry-run is what the
    // workflow's confirmation gate shows, and a gate that displays a clean plan
    // is what talks the caller into the apply.
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
  const orphanedReqs = [];
  let newReqText = null;
  if (reqText !== null) {
    let t = reqText;
    if (sub === 'remove') {
      for (const r of parseRequirements(t)) if (r.phase === at) orphanedReqs.push(r.id);
      // Blank the orphaned rows' Phase cell so they surface as no-phase in
      // audit rather than silently pointing at the shifted neighbor.
      t = t.split('\n').map((line) => {
        const cells = line.match(/^(\|[^|]*\|)([^|]*)(\|[^|]*\|.*)$/);
        if (cells && new RegExp(`\\bPhase ${at}\\b`).test(cells[2])) return `${cells[1]}  ${cells[3]}`;
        return line;
      }).join('\n');
    }
    newReqText = shiftPhaseTokens(t, shiftFrom, delta).text;
  }

  const stateFile = join(dir, 'STATE.md');
  const cursor = parseCursor(read(stateFile) || '');
  let newCursor = null;
  let warn;
  if (cursor) {
    newCursor = { ...cursor, total: total + delta };
    // The phase NUMBER only ever shifts for an integer cursor. A decimal
    // cursor's own ROADMAP token and phases/<phase>/ dir are never shifted
    // either (see decimalPhases below), so moving just the cursor's number
    // would desync it from the phase it actually names - shifting nowhere
    // else is exactly why the number stays put here too. total still moves:
    // the roadmap genuinely gained or lost a phase, so the denominator is
    // still true even while the numerator is left for the caller to re-point.
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
  }

  // Prose refs the shift leaves alone - the model repairs these with judgment.
  const inTextRefs = [];
  for (const f of ['ROADMAP.md', 'REQUIREMENTS.md', 'STATE.md', 'PROJECT.md']) {
    const t = read(join(dir, f));
    if (t === null) continue;
    for (const ref of findProsePhaseRefs(t, shiftFrom)) inTextRefs.push({ file: f, ...ref });
  }

  // Decimal phases are never shifted (see shiftPhaseTokens) - report them so
  // the caller re-places them deliberately instead of discovering the gap.
  const decimalPhases = phases.filter((p) => !Number.isInteger(p.n)).map((p) => p.n);

  const ops = [
    ...dirMoves.map(([f, t]) => ({ git_mv: [`phases/${f}`, `phases/${t}`] })),
    ...(sub === 'remove' && existingDir(at) ? [{ rm: `phases/${at}` }] : []),
    { edit: 'ROADMAP.md', changes: roadmapShift.count + (sub === 'remove' ? 1 : 0) },
    ...(newReqText !== null ? [{ edit: 'REQUIREMENTS.md', changes: orphanedReqs.length ? orphanedReqs.length : undefined }] : []),
    ...(newCursor ? [{ edit: 'STATE.md', changes: 1 }] : []),
  ];

  const result = {
    ops,
    ...(inTextRefs.length ? { in_text_refs: inTextRefs } : {}),
    ...(orphanedReqs.length ? { orphaned_reqs: orphanedReqs } : {}),
    ...(decimalPhases.length ? { decimal_phases: decimalPhases } : {}),
    ...(warn ? { warn } : {}),
    ...(sub === 'insert' ? { slot: `add the new "- [ ] **Phase ${at}: ...**" line and its detail section` } : {}),
  };
  if ('dry-run' in opts) return ok({ dry_run: true, ...result });

  // Apply: an ordered step list, run under one guard. NOTE the order is the
  // rm first, then the moves - which is NOT the order `ops` above displays
  // (it lists moves first, and a shipped test pins that). `ops` is the plan
  // shown at the dry-run gate; `completed` below is the record of what
  // actually ran, and it is the authority when the two disagree. Replaying
  // the printed `ops` order by hand on a remove would `git mv` onto a
  // still-present directory and NEST it (the D-04 hazard). This is a
  // partial-state REPORT, not a rollback - `remove` destroys phases/<at>
  // before the first move runs, so step one can never be undone. Advertising
  // a rollback the code lacks would be worse than a generic failure, because
  // the caller would stop checking the tree by hand (D-03).
  /** @type {Array<[Record<string, any>, () => void]>} */
  const steps = [];
  if (sub === 'remove' && existingDir(at)) {
    steps.push([{ rm: `phases/${at}` }, () => {
      // `cwd: dir`, matching the pre-flight's own `git status` call. Without it
      // git discovers the repository from the CALLER's cwd, which for any
      // `--dir` outside it is a different repository or none - git answers
      // `'<path>' is outside repository` and every remove fell through to the
      // `rmSync` below, tracked work and all. The pre-flight has always read
      // the right repo; this step did not, so the two disagreed about which
      // repository the phase belongs to.
      try { execFileSync('git', ['rm', '-r', '-q', join(dir, 'phases', String(at))], { cwd: dir, stdio: 'pipe' }); }
      catch {
        // The recursive delete is the destructive act this whole command is
        // built around, so it gets its OWN gate rather than trusting the
        // pre-flight's. The guard is repeated here deliberately: the pre-flight
        // ran before the roadmap was even computed, and a git state can become
        // unreadable between the two - and this arm also fires on a `git rm`
        // failure the pre-flight did not predict at all, which inside a
        // repository means git disagrees with the clean answer the pre-flight
        // got. Either way the object store is the only copy of what is about to
        // go, and `rmSync` is a delete with nothing behind it. With no
        // repository at, above OR inside the target there is no object store to
        // consult and no residue that could survive to be nested into, so the
        // fallback stays the only remover - the bare-tree path every renumber
        // fixture runs on. `gitDirUnder` carries the "inside" half: looking up
        // from the planning root cannot see a repository rooted in the very
        // directory this is about to delete recursively.
        const target = join(dir, 'phases', String(at));
        if (gitDirAbove(dir) || gitDirUnder(target)) {
          // Worded to what is actually known. `git rm` failing does not prove
          // the repository is unreadable - it proves the git state this delete
          // depends on went UNREAD, which covers both a `.git` we cannot open
          // and an answer we did not predict. Claiming the stronger fact would
          // be this milestone's own defect: a verdict the check did not earn.
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

  // Stop at the FIRST throw: once a step fails the tree no longer matches the
  // plan every later step was computed from, so running them on would compound
  // the disagreement rather than salvage anything. lib/file-transition.mjs
  // keeps the ordering and the completed/failed record; the envelope below is
  // this seam's own, because prune's is a different shape entirely (D-02).
  const applied = runTransition({ steps, discipline: 'stop-at-first-failure' });
  if (!applied.ok) {
    const { key: op, error: e } = applied.failures[0];
    // Bypasses the dispatch-level catch (which flattens to `internal`) and
    // fail()'s reason/detail/hint-only shape - a completed-ops list needs
    // its own emit (D-11).
    return emit({
      ok: false, reason: 'partial-apply', completed: applied.completed, failed: op,
      detail: e && e.message ? e.message : String(e),
      // Deliberately does NOT say "re-run". The half-applied tree no longer
      // matches ROADMAP, and a re-run recomputes its plan FROM ROADMAP: on
      // a remove it would rm phases/<at>, which now holds the NEXT phase's
      // work, and exit ok:true having destroyed it. Verified live.
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
