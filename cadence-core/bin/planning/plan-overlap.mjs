// @ts-check
// planning/plan-overlap.mjs - `plan-overlap`: the parallel-safety invariant as arithmetic
'use strict';

import { join } from 'node:path';
import { fail, phaseSpellingCollision, listPlanFiles, ok, read } from './core.mjs';
import { intersects } from '../lib/lease-grammar.mjs';
import { parsePlanFiles } from '../lib/planning-files.mjs';
import { requirePhaseArg } from '../lib/require-int.mjs';

// intersects the declared file lists of a phase's plans pairwise; cad-execute's choose_path requires empty overlaps before dispatching plans concurrently. Overlaps found is still ok:true, a successful check with a negative answer, and the caller branches on overlaps.length like it does on drift in status

function cmdPlanOverlap(dir, opts) {
  const parsedPhase = requirePhaseArg(opts.phase);
  if (!parsedPhase.ok) {
    return fail('bad-args', 'plan-overlap needs --phase <N>',
      "pass --phase <N> naming the phase whose plans should be compared, then re-run");
  }
  // the tree-aware collision check goes before any read of the phase directory, the rail this file already holds that a flag is validated ahead of the work it names (#42, #45). It refuses only when the normalized spelling names a directory that exists here, so `phases/1.10/` stays addressable on a tree with no `phases/1.1/`
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

  // parsed before the fewer-than-two-plans early return, so a one-plan phase's grammar diagnostic still reaches this envelope and isn't skipped along with the intersection
  const declared = planFiles.map((f) => {
    const { files, issues } = parsePlanFiles(read(join(pdir, f)) || '');
    return { plan: f, files, issues };
  });
  const frontmatterIssues = declared
    .filter((d) => d.issues.length)
    .map((d) => ({ plan: d.plan, issues: d.issues }));

  if (planFiles.length < 2) {
    return ok({
      phase: n, plans: [], overlaps: [],
      note: 'fewer than two plans - nothing to intersect',
      ...(nonconforming.length ? { nonconforming_plans: nonconforming } : {}),
      ...(frontmatterIssues.length ? { frontmatter_issues: frontmatterIssues } : {}),
    });
  }
  // containment is lib/lease-grammar.mjs's to answer: exact string equality here let a phase declaring `src/` in one plan and `src/auth.js` in another report an empty overlap, pass this gate, and then be refused plan by plan at lease-check, which reads the trailing slash as a directory prefix. Two readers of one declaration, one module
  // both spellings of a collision ride `files` as separate strings, since the covering declaration and the covered one are different and the caller needs to see the pair it must resolve; an exact match contributes one string because `seen` is shared across the two passes
  // emission order is plan i's declarations in declaration order, then plan j's, so the reported list is the same on every run
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
  ok({
    phase: n,
    plans: declared.map((d) => ({ plan: d.plan, files: d.files.length })),
    overlaps,
    // a plan declaring no files can't be proven independent, so the check is only as strong as the declarations; the caller treats these as unsafe
    ...(undeclared.length ? { undeclared } : {}),
    ...(nonconforming.length ? { nonconforming_plans: nonconforming } : {}),
    ...(frontmatterIssues.length ? { frontmatter_issues: frontmatterIssues } : {}),
  });
}

export { cmdPlanOverlap };
