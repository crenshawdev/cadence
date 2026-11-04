// @ts-check
// planning/risk-carry.mjs - `risk-carry`: copies the risk_surface rulings out of a phase directory before the close deletes it, so the land gate can still derive its verdict
'use strict';

import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fail, ok, phaseSpellingCollision } from './core.mjs';
import { requirePhaseArg } from '../lib/require-int.mjs';

// every risk_surface review file and adjudication record is copied out of `phases/<N>/` before milestone-prune removes it, so land-cleanup.mjs gate still has rulings to read at close time
// a seam and not a prose step, same as deferred-carry: this runs inside /cad-milestone, which chains /cad-land after the prune with nobody watching, and a half-run prose step would strand the only thing that can stop that land in a directory about to be deleted
// a copy and not deferred-carry's move: that destination is permanent so a copy there would count one fire twice, but this one is deleted when the close resolves, and a move would strip the archive tier of records it exists to keep for /cad-why
// scoped to the risk_surface trigger and nothing else in the directory: a plan or diff record carried in would halt closes on findings the land never halted on
// every round and never the highest alone: a re-arm is a second fire on the same discriminator and its record holds only what round two re-stated, so some findings exist in round one's record and nowhere else
// the basename is preserved, which is the whole join: the gate's caller pairs a review with the adjudication beside it by name, and a renamed carry would read every review as unruled and halt every close
// every path is lstat'ed and has to be what it looks like, on both sides: readdirSync and copyFileSync follow a symlink, so a link on the source side copies whatever it points at and a link on the destination side is left dangling by the prune. The checks below are that one rail asked four times
// the phase stays a directory level, because two phases routinely fire the same trigger on the same plan discriminator and a flat carry would let one fire's rulings silently replace another's

/** The two stems this carry takes, as `[prefix, extension]` pairs. */
const CARRIED = Object.freeze([
  ['REVIEW-risk_surface', '.md'],
  ['ADJUDICATION-risk_surface', '.json'],
]);

/** True for a filename this carry takes - both stems, every round. */
const isCarried = (name) =>
  CARRIED.some(([prefix, ext]) => name.startsWith(prefix) && name.endsWith(ext));

/** The `unlistable-phase` detail for a source path whose stat failed. It never says the path exists, because a failed stat can't know that. */
const unprovable = (label, n) =>
  `${label} could not be inspected (a directory on that path may not be searchable), so this`
  + ` carry cannot prove what phase ${n} has ruled`;

/** The remedy for a source path that couldn't be stat'ed; search (x) is the bit that's missing. */
const UNSEARCHABLE_HINT = 'make every directory on that path readable and searchable (chmod u+rx),'
  + ' then re-run BEFORE milestone-prune, which deletes the phase directory - nothing was copied';

/** The `carry-dest-unsearchable` detail for a destination path whose stat failed; like `unprovable`, it never says the path exists or is missing. */
const undestinable = (label) =>
  `${label} could not be inspected (risk-carry/ or a directory under it may not be searchable),`
  + ' so this carry cannot tell what is already there';

/** The remedy for a destination path that could not be stat'ed. */
const UNSEARCHABLE_DEST_HINT = 'make risk-carry/ and everything under it readable, writable and'
  + ' searchable (chmod u+rwx), then re-run BEFORE milestone-prune - nothing was copied, and the'
  + ' rulings are still in the phase directory the prune deletes';

function cmdRiskCarry(dir, opts) {
  const parsed = requirePhaseArg(opts.phase);
  if (!parsed.ok) {
    return fail('bad-args', 'risk-carry needs --phase <N>',
      'pass --phase <N> for the phase whose risk_surface rulings are being carried out, then'
      + ' re-run - this runs BEFORE milestone-prune, which deletes the directory they sit in');
  }
  // the tree-aware collision check goes right after the parse and before the destination rail, same order as `deferred carry`: a spelling that names one phase in the envelope and another on disk is refused before anything is written
  const collision = phaseSpellingCollision(dir, parsed);
  if (collision) {
    return fail('bad-args', `risk-carry ${collision}`,
      're-run the carry with one of the two spellings the detail names - nothing was copied');
  }
  const n = parsed.raw;
  if (!existsSync(dir)) return fail('no-planning-dir', `${dir} not found`, '/cad-new-project');

  // the destination first, before any source file is read, and both components and not the last alone: lstatSync doesn't follow the final component but follows every one before it, so a check on `risk-carry/<N>` says "absent, go ahead" while `risk-carry/` is already a link out of the tree, and the mkdir below builds there
  const carryRoot = join(dir, 'risk-carry');
  const dest = join(dir, 'risk-carry', n);
  for (const [path, label] of [[carryRoot, 'risk-carry/'], [dest, `risk-carry/${n}`]]) {
    let stat;
    try { stat = lstatSync(path, { throwIfNoEntry: false }); }
    catch {
      // not absence (GH-302): without its search bit `risk-carry/` can't say whether `<N>` is there, and "absent, go ahead" would send the mkdir below into the same wall as a raw `internal`
      return fail('carry-dest-unsearchable', undestinable(label), UNSEARCHABLE_DEST_HINT);
    }
    if (stat && !stat.isDirectory()) {
      return fail('carry-dest-unusable',
        `${label} exists and is not a real directory`
        + `${stat.isSymbolicLink() ? ' (it is a symlink, which copyFileSync would follow out of the planning root)' : ''}`
        + ' - move or remove it, then re-run',
        'clear that path and re-run BEFORE milestone-prune - nothing has been copied yet, and the'
        + ' rulings are still in the phase directory the prune deletes');
    }
  }

  // the source side gets both components too: readdirSync follows every component, so a linked `phases/` or `phases/<N>` lists some other tree and this copies what it finds there under this phase's name, and existsSync can't tell since it follows too
  const src = join(dir, 'phases', n);
  let phaseStat;
  for (const [path, label] of [[join(dir, 'phases'), 'phases/'], [src, `phases/${n}`]]) {
    let stat;
    try { stat = lstatSync(path, { throwIfNoEntry: false }); }
    catch {
      // throwIfNoEntry already turns ENOENT into undefined, so a throw is something else, most often a `phases/` without its search bit (GH-202), and that's never absence: a false "nothing to carry" lets milestone-prune delete rulings this carry never saw. Same rule as readQueue in core.mjs
      return fail('unlistable-phase', unprovable(label, n), UNSEARCHABLE_HINT);
    }
    if (stat && !stat.isDirectory()) {
      return fail('carry-src-unusable',
        `${label} exists and is not a real directory`
        + `${stat.isSymbolicLink() ? ' (it is a symlink, which readdirSync would follow out of the planning root)' : ''}`
        + ' - move or remove it, then re-run',
        'clear that path and re-run BEFORE milestone-prune - nothing was copied, and this carry'
        + ' reads rulings from the phase directory itself or from nowhere');
    }
    phaseStat = stat; // the last pass is `src`
  }
  // an absent phase directory is an answer and not a refusal: milestone-prune tolerates one as `dirs.missing`, and a close that ran this carry twice would otherwise fail the second time. Only ENOENT is absence, since the loop above refused every other stat failure
  // lstatSync and not existsSync, so a dangling link at `phases/<N>` is the refusal above and not a quiet "nothing to carry"
  if (!phaseStat) {
    return ok({ phase: n, carried: [], copied: 0, skipped: 0 });
  }
  let names;
  try { names = readdirSync(src).sort(); }
  catch {
    // sharper than a reader's refusal, because this is the last call before milestone-prune deletes the directory: carrying what could be listed and saying nothing about the rest would destroy exactly the rulings it couldn't see
    return fail('unlistable-phase',
      `phases/${n}/ exists under ${dir} and could not be listed, so this carry cannot prove what`
      + ` phase ${n} has ruled`,
      'make that directory readable and re-run BEFORE milestone-prune, which deletes it - nothing'
      + ' was copied');
  }
  const moving = names.filter(isCarried);
  if (!moving.length) return ok({ phase: n, carried: [], copied: 0, skipped: 0 });

  // every destination is decided before the first write, so a collision refuses the whole carry and doesn't leave half a fire at each home
  // already-carried is skipped and a differing one refuses: a close re-runs this after a partial carry, so refusing on a byte-identical file it wrote itself would be a refusal storm with no remedy. Different bytes under the same name are another fire's rulings or a hand edit, and this never overwrites either
  const copying = [];
  const skipped = [];
  for (const name of moving) {
    // the source entry first, before the name is read, compared or copied: copyFileSync follows, so a link planted under a carried name would copy whatever it points at into a directory the close reads and `--mode archive` keeps. It refuses the whole carry and doesn't skip, since passing over what couldn't be proved a ruling destroys it when the prune runs
    const from = join(src, name);
    let srcStat;
    try { srcStat = lstatSync(from, { throwIfNoEntry: false }); }
    catch {
      // a `phases/<N>` that lists but can't be searched (0o444, GH-202); this refuses the whole carry too, for the reason above
      return fail('unlistable-phase', unprovable(`phases/${n}/${name}`, n), UNSEARCHABLE_HINT);
    }
    if (!srcStat || !srcStat.isFile()) {
      return fail('carry-src-unusable',
        `phases/${n}/${name} is not a regular file`
        + `${srcStat && srcStat.isSymbolicLink() ? ' (it is a symlink, which copyFileSync would follow, carrying whatever it points at instead of a ruling this phase wrote)' : ''}`
        + ' - replace it with the file itself, then re-run',
        're-run BEFORE milestone-prune, which deletes that directory - nothing was copied, and a'
        + ' carried ruling is only ever a file the phase it names wrote');
    }
    // every source is read here, the ones to copy as well as the ones to compare, so an unreadable ruling refuses before the mkdir below mints a destination (GH-302); left to copyFileSync it threw raw after `risk-carry/<N>/` existed, and left to the comparison it read as "differs"
    let fromBytes;
    try { fromBytes = readFileSync(from); }
    catch {
      return fail('unreadable-ruling',
        `phases/${n}/${name} could not be read, so this carry cannot copy that ruling`,
        'make that file readable (chmod u+r) and re-run BEFORE milestone-prune, which deletes it'
        + ' - nothing was copied');
    }
    const to = join(dest, name);
    let destStat;
    try { destStat = lstatSync(to, { throwIfNoEntry: false }); }
    catch {
      return fail('carry-dest-unsearchable', undestinable(`risk-carry/${n}/${name}`),
        UNSEARCHABLE_DEST_HINT);
    }
    if (!destStat) { copying.push(name); continue; }
    // a regular file or nothing, asked here and not left to the comparison: lstatSync answers "something is here" for a symlink, but the comparison is a readFileSync, which follows, so a link pointed back at `phases/<N>/<name>` would compare byte-identical to its own target and be skipped, and then the prune deletes the target and leaves the gate a dangling link at the moment it has to decide
    if (!destStat.isFile()) {
      return fail('carry-dest-unusable',
        `risk-carry/${n}/${name} exists and is not a regular file`
        + `${destStat.isSymbolicLink() ? ' (it is a symlink, which the prune leaves dangling however its target compares today)' : ''}`
        + ' - move or remove it, then re-run',
        'clear that path and re-run BEFORE milestone-prune - nothing has been copied yet, and the'
        + ' rulings are still in the phase directory the prune deletes');
    }
    // a carried copy that can't be read isn't one that differs (GH-302): `carry-exists` would send the user to delete a file that may be byte-identical, on a comparison that never ran
    let toBytes;
    try { toBytes = readFileSync(to); }
    catch {
      return fail('unreadable-carried-copy',
        `risk-carry/${n}/${name} already exists and could not be read, so this carry cannot tell`
        + ` whether it matches phases/${n}/${name}`,
        'make that file readable (chmod u+r) and re-run BEFORE milestone-prune - nothing was'
        + ' copied, and this seam never overwrites a carried ruling it has not compared');
    }
    if (toBytes.equals(fromBytes)) { skipped.push(name); continue; }
    return fail('carry-exists',
      `risk-carry/${n}/${name} already exists and differs from phases/${n}/${name} - this seam`
      + ' never overwrites a carried ruling',
      'move or delete it first, then re-run; a differing file under that name is another fire\'s'
      + ' record of what was ruled, and the gate reads it at close time');
  }

  // a plain copy loop like deferred carry's rename loop, with no staging directory: a partial carry self-heals on the next run because identical files are skipped, and staging would put a transient directory inside the very destination the gate's caller globs
  // a write that fails is named and never `internal` (GH-302): a `risk-carry/` without its write bit stats fine and then refuses the mkdir. What already arrived is listed, because the re-run the hint asks for skips it
  const done = [];
  let at = `risk-carry/${n}/`;
  try {
    mkdirSync(dest, { recursive: true });
    for (const name of copying) {
      at = `risk-carry/${n}/${name}`;
      copyFileSync(join(src, name), join(dest, name));
      done.push(name);
    }
  } catch {
    return fail('carry-write-failed',
      `${at} could not be written`
      + (done.length ? ` (${done.length} of ${copying.length} copied before it)` : ' - nothing was copied'),
      'make risk-carry/ and everything under it writable and searchable (chmod u+rwx), then re-run'
      + ' BEFORE milestone-prune - a re-run skips what already arrived and copies the rest');
  }
  return ok({
    phase: n,
    carried: copying.map((name) => ({ from: `phases/${n}/${name}`, to: `risk-carry/${n}/${name}` })),
    copied: copying.length,
    skipped: skipped.length,
  });
}

export { cmdRiskCarry };
