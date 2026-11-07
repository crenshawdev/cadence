// @ts-check
// planning/plan-overlap.mjs - `plan-overlap`: the parallel-safety invariant as arithmetic
'use strict';

import { join } from 'node:path';
import { fail, phaseSpellingCollision, listPlanFiles, ok, read } from './core.mjs';
import { intersects } from '../lib/lease-grammar.mjs';
import { byPlanNumber, planNumber } from '../lib/phase-plans.mjs';
import { issueText, normalize, parsePlanFiles, readFrontmatterList } from '../lib/planning-files.mjs';
import { requirePhaseArg } from '../lib/require-int.mjs';

// pairwise intersection of a phase's declared file lists; choose_path needs empty overlaps to run plans concurrently
// overlaps found is still ok:true, a successful check with a negative answer: branch on overlaps.length
// `waves` comes back on every call and this seam reads no config: whether to act on it is the caller's
// a `depends_on` entry orders its plan like a shared file does; choose_path reads a second wave with no overlap as sequential

/**
 * A plan's wave is one more than the highest wave of the earlier plans it waits for, and wave 1 when it waits for none.
 * Earlier is the plan number compared as a number, so PLAN-10.md follows PLAN-2.md. Every declared file counts and no
 * code names one, so a housekeeping file two plans both list orders them like any other.
 * @param {string[]} plans the phase's plan files
 * @param {(earlier: string, later: string) => boolean} waitsFor
 * @returns {string[][]} plan files grouped by wave, each wave in plan order
 */
function wavesOf(plans, waitsFor) {
  const ordered = [...plans].sort(byPlanNumber);
  /** @type {number[]} */
  const wave = [];
  /** @type {string[][]} */
  const waves = [];
  ordered.forEach((plan, j) => {
    let w = 0;
    for (let i = 0; i < j; i++) {
      if (waitsFor(ordered[i], plan)) w = Math.max(w, wave[i] + 1);
    }
    wave.push(w);
    (waves[w] ||= []).push(plan);
  });
  return waves;
}

function cmdPlanOverlap(dir, opts) {
  const parsedPhase = requirePhaseArg(opts.phase);
  if (!parsedPhase.ok) {
    return fail('bad-args', 'plan-overlap needs --phase <N>',
      "pass --phase <N> naming the phase whose plans should be compared, then re-run");
  }
  // the tree-aware collision check runs before any phase-directory read (#42, #45); `phases/1.10/` stays addressable
  const collision = phaseSpellingCollision(dir, parsedPhase);
  if (collision) {
    return fail('bad-args', `plan-overlap ${collision}`,
      're-run with one of the two spellings the detail names - nothing was read');
  }
  const n = parsedPhase.value;
  // the directory is the caller's spelling; only the echoed `phase` below is the number
  const pdir = join(dir, 'phases', parsedPhase.raw);
  const { plans: planFiles, nonconforming, missing } = listPlanFiles(pdir);
  if (missing) {
    return fail('no-phase-dir', `${pdir} not found`,
      'run /cad-plan <N> to write this phase\'s plans first - the overlap check compares the'
      + ' `files:` lists in the PLAN files that directory holds');
  }

  // parsed before the fewer-than-two-plans early return, so a one-plan phase's grammar diagnostic still gets out
  // an entry is valid when it's a plain integer naming a plan of this phase with a lower number; anything else is one
  // `invalid-depends-on` issue, which routes the phase sequential, so an invalid entry orders nothing itself
  const numbers = new Set(planFiles.map(planNumber));
  const declared = planFiles.map((f) => {
    const text = read(join(pdir, f)) || '';
    const { files, issues } = parsePlanFiles(text);
    const own = planNumber(f);
    /** @type {Set<number>} */
    const deps = new Set();
    let bad = false;
    for (const e of readFrontmatterList(text, 'depends_on').items) {
      const k = /^\d+$/.test(e) ? Number(e) : NaN;
      if (k < own && numbers.has(k)) deps.add(k);
      else bad = true;
    }
    if (bad) {
      const lines = normalize(text).split('\n');
      const at = lines.findIndex((l) => /^depends_on:(\s|$)/.test(l));
      issues.push({ line: at + 1, code: 'invalid-depends-on', text: issueText(lines[at]) });
    }
    return { plan: f, files, issues, deps };
  });
  const frontmatterIssues = declared
    .filter((d) => d.issues.length)
    .map((d) => ({ plan: d.plan, issues: d.issues }));

  if (planFiles.length < 2) {
    return ok({
      phase: n, plans: [], overlaps: [],
      waves: planFiles.length ? [planFiles] : [],
      note: 'fewer than two plans - nothing to intersect',
      ...(nonconforming.length ? { nonconforming_plans: nonconforming } : {}),
      ...(frontmatterIssues.length ? { frontmatter_issues: frontmatterIssues } : {}),
    });
  }
  // containment is lib/lease-grammar.mjs's: exact equality passed `src/` and `src/auth.js` here, then failed later
  // both spellings of a collision ride `files`, since the caller needs the pair; an exact match is one string
  // emission order is plan i's declarations, then plan j's, so the list is the same on every run
  const collect = (from, against, into, seen) => {
    for (const f of from) {
      if (!against.some((g) => intersects(f, g))) continue;
      if (seen.has(f)) continue;
      seen.add(f);
      into.push(f);
    }
  };
  const overlaps = [];
  for (let i = 0; i < declared.length; i++) {
    for (let j = i + 1; j < declared.length; j++) {
      const shared = [];
      const seen = new Set();
      collect(declared[i].files, declared[j].files, shared, seen);
      collect(declared[j].files, declared[i].files, shared, seen);
      if (shared.length) overlaps.push({ plans: [declared[i].plan, declared[j].plan], files: shared });
    }
  }
  const undeclared = declared.filter((d) => !d.files.length).map((d) => d.plan);
  // "share" is the pairs above, so a directory lease separates waves exactly where it reports an overlap
  const shares = new Set(overlaps.map((o) => o.plans.join('\0')));
  const depsOf = new Map(declared.map((d) => [d.plan, d.deps]));
  const waves = wavesOf(planFiles, (a, b) => shares.has(`${a}\0${b}`) || shares.has(`${b}\0${a}`)
    || Boolean(depsOf.get(b)?.has(planNumber(a))));
  ok({
    phase: n,
    plans: declared.map((d) => ({ plan: d.plan, files: d.files.length })),
    overlaps,
    waves,
    // a plan declaring no files can't be proven independent; the caller treats these as unsafe
    ...(undeclared.length ? { undeclared } : {}),
    ...(nonconforming.length ? { nonconforming_plans: nonconforming } : {}),
    ...(frontmatterIssues.length ? { frontmatter_issues: frontmatterIssues } : {}),
  });
}

export { cmdPlanOverlap };
