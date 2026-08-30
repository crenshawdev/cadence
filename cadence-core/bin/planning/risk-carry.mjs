// @ts-check
// planning/risk-carry.mjs - `risk-carry`: the risk_surface rulings out of the
// phase directory a close is about to delete, so the land gate can still derive
// its verdict from them.
'use strict';

import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fail, ok, phaseSpellingCollision } from './core.mjs';
import { requirePhaseArg } from '../lib/require-int.mjs';

// ---------------------------------------------------------------------------
// risk-carry - every `risk_surface` REVIEW file and every adjudication record
// beside it, copied OUT of `phases/<N>/` before `milestone-prune` removes that
// directory, so `land-cleanup.mjs gate` still has rulings to read at close time
// (LND-02, D-01).
//
// WHY A SEAM AND NOT A PROSE INSTRUCTION. Same argument
// `planning/deferred-carry.mjs` makes about itself: this runs inside
// `/cad-milestone`, which chains `/cad-land` after the prune with nobody
// watching, and a prose step that half-ran there leaves the only thing that
// can stop that land inside a directory `milestone-prune` is about to delete.
//
// A COPY AND NOT THE MOVE `deferred-carry.mjs` MAKES, and the difference is
// load-bearing. The deferred queue's destination is committed and permanent, so
// a copy there would leave one fire counted twice. THIS destination is
// TRANSIENT - `/cad-milestone` deletes `risk-carry/` when the close resolves -
// so a move would strip `_archive-<label>/<N>/` under `--mode archive` of the
// very records that tier is supposed to keep, which is the tier
// `lib/why-record.mjs` reads to answer `/cad-why`.
//
// SCOPED TO THE `risk_surface` TRIGGER, never every record in the directory. A
// `plan` or `diff` record carried into this set would halt closes on findings
// the land has never halted on - `/cad-land`'s own consumer globs name
// `REVIEW-risk_surface*` and nothing else (land-cleanup.mjs's header).
//
// EVERY ROUND, never the highest alone (D-08). A re-arm is a SECOND fire on the
// same discriminator and its record holds only what round two re-stated;
// measured on `_archive-v3.7.3/1/`, 2 of that fire's 6 findings appear in round
// one's record and nowhere else. Both stems carry the same `-r<n>` suffix rule,
// so the prefix match below takes every round without knowing the rule.
//
// THE BASENAME IS PRESERVED, which is the whole join. The gate's caller pairs a
// `REVIEW-risk_surface-<disc>[-r<n>].md` with the
// `ADJUDICATION-risk_surface-<disc>[-r<n>].json` sitting beside it, and that
// pairing is by NAME - a renamed carry would make every carried review read as
// unruled and halt every close (D-03).
//
// EVERY PATH IS `lstat`ed AND MUST BE WHAT IT LOOKS LIKE, on BOTH sides. The
// two calls this seam makes over a caller-supplied path - `readdirSync` on the
// source and `copyFileSync` between them - FOLLOW a symlink, so a link on the
// source side reads and copies whatever it points at (a credential file
// outside the planning root included) and a link on the destination side is
// left dangling by the prune however its target compares today. The rails
// below are the same rail asked four times: two source components, two
// destination components, then each entry on each side.
//
// THE PHASE STAYS A DIRECTORY LEVEL, for the reason the deferred carry keeps
// one: two phases routinely fire the same trigger on the same `plan-<k>`
// discriminator, so a flat carry would collide and the collision would be one
// fire's rulings silently replacing another's.
// ---------------------------------------------------------------------------

/** The two stems this carry moves, as `[prefix, extension]` pairs. */
const CARRIED = Object.freeze([
  ['REVIEW-risk_surface', '.md'],
  ['ADJUDICATION-risk_surface', '.json'],
]);

/** True for a filename this carry takes - both stems, every round. */
const isCarried = (name) =>
  CARRIED.some(([prefix, ext]) => name.startsWith(prefix) && name.endsWith(ext));

function cmdRiskCarry(dir, opts) {
  const parsed = requirePhaseArg(opts.phase);
  if (!parsed.ok) {
    return fail('bad-args', 'risk-carry needs --phase <N>',
      'pass --phase <N> for the phase whose risk_surface rulings are being carried out, then'
      + ' re-run - this runs BEFORE milestone-prune, which deletes the directory they sit in');
  }
  // The tree-aware collision check, right after the parse and BEFORE the
  // destination rail below - the same order `deferred carry` takes, and for the
  // same reason: a spelling that names one phase in the envelope and another on
  // disk is refused before anything is written.
  const collision = phaseSpellingCollision(dir, parsed);
  if (collision) {
    return fail('bad-args', `risk-carry ${collision}`,
      're-run the carry with one of the two spellings the detail names - nothing was copied');
  }
  const n = parsed.raw;
  if (!existsSync(dir)) return fail('no-planning-dir', `${dir} not found`, '/cad-new-project');

  // THE DESTINATION FIRST, before a single source file has been read. BOTH
  // components, not the last one alone: `lstatSync` does not follow the FINAL
  // path component and follows every one before it, so a check aimed at
  // `risk-carry/<N>` answers "absent, go ahead" while `risk-carry/` is already a
  // link out of the tree - and the `mkdirSync(recursive)` below then builds
  // `<wherever>/<N>` and the copy fills it. Two levels down takes two checks.
  const carryRoot = join(dir, 'risk-carry');
  const dest = join(dir, 'risk-carry', n);
  for (const [path, label] of [[carryRoot, 'risk-carry/'], [dest, `risk-carry/${n}`]]) {
    const stat = lstatSync(path, { throwIfNoEntry: false });
    if (stat && !stat.isDirectory()) {
      return fail('carry-dest-unusable',
        `${label} exists and is not a real directory`
        + `${stat.isSymbolicLink() ? ' (it is a symlink, which copyFileSync would follow out of the planning root)' : ''}`
        + ' - move or remove it, then re-run',
        'clear that path and re-run BEFORE milestone-prune - nothing has been copied yet, and the'
        + ' rulings are still in the phase directory the prune deletes');
    }
  }

  // THE SOURCE SIDE, both components of it, for the reason the destination side
  // gives: `readdirSync` follows every component it is handed, so a linked
  // `phases/` or `phases/<N>` lists some other tree and this carry copies what
  // it finds there in under THIS phase's name - and `existsSync` cannot tell
  // the difference because it follows too.
  const src = join(dir, 'phases', n);
  for (const [path, label] of [[join(dir, 'phases'), 'phases/'], [src, `phases/${n}`]]) {
    const stat = lstatSync(path, { throwIfNoEntry: false });
    if (stat && !stat.isDirectory()) {
      return fail('carry-src-unusable',
        `${label} exists and is not a real directory`
        + `${stat.isSymbolicLink() ? ' (it is a symlink, which readdirSync would follow out of the planning root)' : ''}`
        + ' - move or remove it, then re-run',
        'clear that path and re-run BEFORE milestone-prune - nothing was copied, and this carry'
        + ' reads rulings from the phase directory itself or from nowhere');
    }
  }
  // An absent phase directory is an ANSWER, not a refusal - `milestone-prune`
  // already tolerates one as `dirs.missing`, and a close that ran this carry
  // twice would otherwise fail the second time on a phase it already handled.
  // `lstatSync` and not `existsSync`, so a DANGLING link at `phases/<N>` is the
  // refusal above rather than a quiet "nothing to carry".
  if (!lstatSync(src, { throwIfNoEntry: false })) {
    return ok({ phase: n, carried: [], copied: 0, skipped: 0 });
  }
  let names;
  try { names = readdirSync(src).sort(); }
  catch {
    // SHARPER than a reader's refusal, and for a sharper reason: this call is
    // the last thing that runs before `milestone-prune` DELETES this directory.
    // Carrying what could be listed and saying nothing about the rest would
    // destroy exactly the rulings it could not see.
    return fail('unlistable-phase',
      `phases/${n}/ exists under ${dir} and could not be listed, so this carry cannot prove what`
      + ` phase ${n} has ruled`,
      'make that directory readable and re-run BEFORE milestone-prune, which deletes it - nothing'
      + ' was copied');
  }
  const moving = names.filter(isCarried);
  if (!moving.length) return ok({ phase: n, carried: [], copied: 0, skipped: 0 });

  // EVERY destination decided BEFORE the first write, so a collision refuses the
  // whole carry rather than leaving half the fire at each home.
  //
  // Already-carried is SKIPPED and a differing one REFUSES. The two are not the
  // same case: a close re-runs this carry after a partial one, and refusing on
  // a byte-identical file it wrote itself would make the second run a refusal
  // storm with no remedy. A destination holding DIFFERENT bytes under the same
  // name is another fire's rulings, or a hand edit, and this seam never
  // overwrites either.
  const copying = [];
  const skipped = [];
  for (const name of moving) {
    // THE SOURCE ENTRY FIRST, before this name is read or compared or copied.
    // `copyFileSync` FOLLOWS, which is the thing the destination rail above
    // already says about itself: a link planted in `phases/<N>/` under a
    // carried name copies whatever it points at into a directory the close
    // reads and `--mode archive` keeps. Refused for the WHOLE carry rather
    // than skipped, for the reason `unlistable-phase` gives - this runs last
    // before the prune deletes the directory, so passing over what could not
    // be proved a ruling destroys exactly the rulings it passed over.
    const from = join(src, name);
    const srcStat = lstatSync(from, { throwIfNoEntry: false });
    if (!srcStat || !srcStat.isFile()) {
      return fail('carry-src-unusable',
        `phases/${n}/${name} is not a regular file`
        + `${srcStat && srcStat.isSymbolicLink() ? ' (it is a symlink, which copyFileSync would follow, carrying whatever it points at instead of a ruling this phase wrote)' : ''}`
        + ' - replace it with the file itself, then re-run',
        're-run BEFORE milestone-prune, which deletes that directory - nothing was copied, and a'
        + ' carried ruling is only ever a file the phase it names wrote');
    }
    const to = join(dest, name);
    const destStat = lstatSync(to, { throwIfNoEntry: false });
    if (!destStat) { copying.push(name); continue; }
    // A REGULAR FILE OR NOTHING, asked HERE rather than left to the comparison
    // below - the two-level rail above is the same rail, and this is it
    // reaching the individual entries. `lstatSync` answers "something is here"
    // for a symlink, but the comparison is a `readFileSync` and `readFileSync`
    // FOLLOWS: a link pointed back at `phases/<N>/<name>` compares
    // byte-identical to its own target and would be marked `skipped`, and then
    // `milestone-prune` deletes that target and the carried ruling is a
    // dangling link the gate cannot read at the moment it has to decide.
    if (!destStat.isFile()) {
      return fail('carry-dest-unusable',
        `risk-carry/${n}/${name} exists and is not a regular file`
        + `${destStat.isSymbolicLink() ? ' (it is a symlink, which the prune leaves dangling however its target compares today)' : ''}`
        + ' - move or remove it, then re-run',
        'clear that path and re-run BEFORE milestone-prune - nothing has been copied yet, and the'
        + ' rulings are still in the phase directory the prune deletes');
    }
    let same = false;
    try { same = readFileSync(to).equals(readFileSync(from)); }
    catch { same = false; }
    if (same) { skipped.push(name); continue; }
    return fail('carry-exists',
      `risk-carry/${n}/${name} already exists and differs from phases/${n}/${name} - this seam`
      + ' never overwrites a carried ruling',
      'move or delete it first, then re-run; a differing file under that name is another fire\'s'
      + ' record of what was ruled, and the gate reads it at close time');
  }

  // A plain copy loop, the shape `deferred carry` uses for its rename loop, and
  // no staging directory in front of it. A partial carry here SELF-HEALS on the
  // next run, which is what the skip-identical rule above buys: what already
  // arrived is skipped and the rest is copied. Staging would put a transient
  // directory inside the very destination the gate's caller globs, to protect
  // against a case a re-run already fixes.
  mkdirSync(dest, { recursive: true });
  for (const name of copying) copyFileSync(join(src, name), join(dest, name));
  return ok({
    phase: n,
    carried: copying.map((name) => ({ from: `phases/${n}/${name}`, to: `risk-carry/${n}/${name}` })),
    copied: copying.length,
    skipped: skipped.length,
  });
}

export { cmdRiskCarry };
