// @ts-check
// planning/risk-carry.mjs - `risk-carry`: copies risk_surface rulings out of a phase dir before the close deletes it
'use strict';

import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fail, notRealDirDetail, ok, phaseGuard } from './core.mjs';
import { copyFile, ensureRecordsDir, makeDir, phaseRecordsDir, recordsDir, riskCarryDir } from '../lib/planning-store.mjs';

// risk_surface reviews and adjudications are copied out of `phases/<N>/` before the prune removes it
// a seam, not a prose step: /cad-milestone chains /cad-land after the prune unattended
// scoped to that trigger, or a plan or diff record carried in halts closes the land never did
// every round, since a re-arm's record holds only what round two re-stated
// basenames are kept: the gate pairs a review with its adjudication by name
// every path is lstat'ed on both sides, because readdirSync and copyFileSync follow links
// the phase stays a directory level, or two phases firing the same trigger overwrite each other

/** Where the carry lands, relative to the planning directory, as every message and answer here names it. */
const CARRY_REL = relative('.', riskCarryDir('.')).split(sep).join('/');
/** The folder that holds it, which is checked on its own because a link there carries the copies out of the tree. */
const RECORDS_REL = relative('.', recordsDir('.')).split(sep).join('/');

/** Where a phase keeps its records, relative to the phase directory, as an answer names it. */
const posixRecords = relative('.', phaseRecordsDir('.')).split(sep).join('/');

/** The two stems this carry takes, as `[prefix, extension]` pairs. */
const CARRIED = Object.freeze([
  ['REVIEW-risk_surface', '.md'],
  ['ADJUDICATION-risk_surface', '.json'],
]);

/** True for a filename this carry takes - both stems, every round. */
const isCarried = (name) =>
  CARRIED.some(([prefix, ext]) => name.startsWith(prefix) && name.endsWith(ext));

/** The `unlistable-phase` detail for a source path whose stat failed; it never claims the path exists. */
const unprovable = (label, n) =>
  `${label} could not be inspected (a directory on that path may not be searchable), so this`
  + ` carry cannot prove what phase ${n} has ruled`;

/** The remedy for a source path that couldn't be stat'ed; search (x) is the bit that's missing. */
const UNSEARCHABLE_HINT = 'make every directory on that path readable and searchable (chmod u+rx),'
  + ' then re-run BEFORE milestone-prune, which deletes the phase directory - nothing was copied';

/** The `carry-dest-unsearchable` detail for a destination path whose stat failed; it never claims the path exists. */
const undestinable = (label) =>
  `${label} could not be inspected (${CARRY_REL}/ or a directory under it may not be searchable),`
  + ' so this carry cannot tell what is already there';

/** The remedy for a destination path that could not be stat'ed. */
const UNSEARCHABLE_DEST_HINT = `make ${CARRY_REL}/ and everything under it readable, writable and`
  + ' searchable (chmod u+rwx), then re-run BEFORE milestone-prune - nothing was copied, and the'
  + ' rulings are still in the phase directory the prune deletes';

function cmdRiskCarry(dir, opts) {
  // the tree-aware collision check goes right after the parse, before the destination rail, like `deferred carry`
  const parsed = phaseGuard('risk-carry', dir, opts.phase, 'risk-carry needs --phase <N>',
    'pass --phase <N> for the phase whose risk_surface rulings are being carried out, then'
    + ' re-run - this runs BEFORE milestone-prune, which deletes the directory they sit in',
    're-run the carry with one of the two spellings the detail names - nothing was copied');
  if (!parsed) return;
  const n = parsed.raw;
  if (!existsSync(dir)) return fail('no-planning-dir', `${dir} not found`, '/cad-new-project');

  // destination first, both components and not the last alone: lstatSync follows every component before the final one
  // the records folder first: a link there carries everything below it out of the tree
  const carryRoot = riskCarryDir(dir);
  const dest = join(carryRoot, n);
  for (const [path, label] of [[recordsDir(dir), `${RECORDS_REL}/`], [carryRoot, `${CARRY_REL}/`], [dest, `${CARRY_REL}/${n}`]]) {
    let stat;
    try { stat = lstatSync(path, { throwIfNoEntry: false }); }
    catch {
      // not absence (GH-302): without its search bit the carry folder cannot say whether `<N>` is there
      return fail('carry-dest-unsearchable', undestinable(label), UNSEARCHABLE_DEST_HINT);
    }
    if (stat && !stat.isDirectory()) {
      return fail('carry-dest-unusable',
        notRealDirDetail(label, stat, 'copyFileSync'),
        'clear that path and re-run BEFORE milestone-prune - nothing has been copied yet, and the'
        + ' rulings are still in the phase directory the prune deletes');
    }
  }

  // the source side gets both components too: readdirSync follows them, so a linked `phases/` lists some other tree
  // the rulings sit in the phase's records folder, so that is a component too
  const src = phaseRecordsDir(join(dir, 'phases', n));
  const srcRel = `phases/${n}/${posixRecords}`;
  let phaseStat;
  for (const [path, label] of [[join(dir, 'phases'), 'phases/'], [join(dir, 'phases', n), `phases/${n}`],
    [src, srcRel]]) {
    let stat;
    try { stat = lstatSync(path, { throwIfNoEntry: false }); }
    catch {
      // a throw here isn't ENOENT (GH-202) and isn't absence: a false "nothing to carry" lets the prune delete rulings
      return fail('unlistable-phase', unprovable(label, n), UNSEARCHABLE_HINT);
    }
    if (stat && !stat.isDirectory()) {
      return fail('carry-src-unusable',
        notRealDirDetail(label, stat, 'readdirSync'),
        'clear that path and re-run BEFORE milestone-prune - nothing was copied, and this carry'
        + ' reads rulings from the phase directory itself or from nowhere');
    }
    phaseStat = stat; // the last pass is `src`; an absent phase or an absent records folder holds nothing to carry
  }
  // an absent phase directory is an answer, not a refusal: milestone-prune tolerates it, and a re-run would fail
  // lstatSync and not existsSync, so a dangling link at `phases/<N>` is the refusal above and not "nothing to carry"
  if (!phaseStat) {
    return ok({ phase: n, carried: [], copied: 0, skipped: 0 });
  }
  let names;
  try { names = readdirSync(src).sort(); }
  catch {
    // sharper than a reader's refusal: this is the last call before the prune, so carrying part destroys the rest
    return fail('unlistable-phase',
      `${srcRel}/ exists under ${dir} and could not be listed, so this carry cannot prove what`
      + ` phase ${n} has ruled`,
      'make that directory readable and re-run BEFORE milestone-prune, which deletes it - nothing'
      + ' was copied');
  }
  const moving = names.filter(isCarried);
  if (!moving.length) return ok({ phase: n, carried: [], copied: 0, skipped: 0 });

  // every destination is decided before the first write, so a collision refuses the whole carry and leaves no half-fire
  // already-carried is skipped, a differing one refuses: a re-run after a partial carry must not refuse its own files
  const copying = [];
  const skipped = [];
  for (const name of moving) {
    // source entry first: copyFileSync follows, so a planted link would copy its target. Refuse the whole carry
    const from = join(src, name);
    let srcStat;
    try { srcStat = lstatSync(from, { throwIfNoEntry: false }); }
    catch {
      // a `phases/<N>` that lists but can't be searched (0o444, GH-202); refuses the whole carry too
      return fail('unlistable-phase', unprovable(`${srcRel}/${name}`, n), UNSEARCHABLE_HINT);
    }
    if (!srcStat || !srcStat.isFile()) {
      return fail('carry-src-unusable',
        `${srcRel}/${name} is not a regular file`
        + `${srcStat && srcStat.isSymbolicLink() ? ' (it is a symlink, which copyFileSync would follow, carrying whatever it points at instead of a ruling this phase wrote)' : ''}`
        + ' - replace it with the file itself, then re-run',
        're-run BEFORE milestone-prune, which deletes that directory - nothing was copied, and a'
        + ' carried ruling is only ever a file the phase it names wrote');
    }
    // every source is read here so an unreadable ruling refuses before the mkdir mints a destination (GH-302)
    let fromBytes;
    try { fromBytes = readFileSync(from); }
    catch {
      return fail('unreadable-ruling',
        `${srcRel}/${name} could not be read, so this carry cannot copy that ruling`,
        'make that file readable (chmod u+r) and re-run BEFORE milestone-prune, which deletes it'
        + ' - nothing was copied');
    }
    const to = join(dest, name);
    let destStat;
    try { destStat = lstatSync(to, { throwIfNoEntry: false }); }
    catch {
      return fail('carry-dest-unsearchable', undestinable(`${CARRY_REL}/${n}/${name}`),
        UNSEARCHABLE_DEST_HINT);
    }
    if (!destStat) { copying.push(name); continue; }
    // a regular file or nothing: readFileSync follows, so a link back at its own target compares identical
    if (!destStat.isFile()) {
      return fail('carry-dest-unusable',
        `${CARRY_REL}/${n}/${name} exists and is not a regular file`
        + `${destStat.isSymbolicLink() ? ' (it is a symlink, which the prune leaves dangling however its target compares today)' : ''}`
        + ' - move or remove it, then re-run',
        'clear that path and re-run BEFORE milestone-prune - nothing has been copied yet, and the'
        + ' rulings are still in the phase directory the prune deletes');
    }
    // a carried copy that can't be read isn't one that differs (GH-302), or `carry-exists` says delete a good file
    let toBytes;
    try { toBytes = readFileSync(to); }
    catch {
      return fail('unreadable-carried-copy',
        `${CARRY_REL}/${n}/${name} already exists and could not be read, so this carry cannot tell`
        + ` whether it matches ${srcRel}/${name}`,
        'make that file readable (chmod u+r) and re-run BEFORE milestone-prune - nothing was'
        + ' copied, and this seam never overwrites a carried ruling it has not compared');
    }
    if (toBytes.equals(fromBytes)) { skipped.push(name); continue; }
    return fail('carry-exists',
      `${CARRY_REL}/${n}/${name} already exists and differs from ${srcRel}/${name} - this seam`
      + ' never overwrites a carried ruling',
      'move or delete it first, then re-run; a differing file under that name is another fire\'s'
      + ' record of what was ruled, and the gate reads it at close time');
  }

  // a plain copy loop, no staging dir: a partial carry self-heals since identical files are skipped
  // a failed write is named, never `internal` (GH-302); what already arrived is listed because the re-run skips it
  const done = [];
  let at = `${CARRY_REL}/${n}/`;
  try {
    // the folder is made by the write module, which also gives it its .gitignore; a refusal here is a failed write
    if (!ensureRecordsDir(dir).ok) throw new Error('records folder unusable');
    makeDir(dest);
    for (const name of copying) {
      at = `${CARRY_REL}/${n}/${name}`;
      copyFile(join(src, name), join(dest, name));
      done.push(name);
    }
  } catch {
    return fail('carry-write-failed',
      `${at} could not be written`
      + (done.length ? ` (${done.length} of ${copying.length} copied before it)` : ' - nothing was copied'),
      `make ${CARRY_REL}/ and everything under it writable and searchable (chmod u+rwx), then re-run`
      + ' BEFORE milestone-prune - a re-run skips what already arrived and copies the rest');
  }
  return ok({
    phase: n,
    carried: copying.map((name) => ({ from: `${srcRel}/${name}`, to: `${CARRY_REL}/${n}/${name}` })),
    copied: copying.length,
    skipped: skipped.length,
  });
}

export { cmdRiskCarry };
