// @ts-check
// planning/seed-reqs.mjs - `seed-reqs`: the Traceability rows a phase's plans
// declare, inserted where /cad-plan writes the plan.
'use strict';

import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fail, ok, phaseSpellingRefusal, read } from './core.mjs';
import {
  atomicWrite, insertReqRows, parseActiveIds, parsePlanRequirements,
} from '../lib/planning-files.mjs';
import { requirePhaseArg } from '../lib/require-int.mjs';

// ---------------------------------------------------------------------------
// seed-reqs - insert Traceability rows for the requirement ids a phase's
// plan(s) declare, bounded by ## Active (D-02/D-04/D-05/D-06). Called by
// /cad-plan right where the plan is written - the write path this table
// never had (git log -S Traceability shows status-flip-only since c34ec8a).
// ---------------------------------------------------------------------------
function cmdSeedReqs(dir, opts) {
  const parsedPhase = requirePhaseArg(opts.phase);
  if (!parsedPhase.ok) {
    return fail('bad-args', 'seed-reqs needs --phase <N>',
      'pass --phase <N> naming the phase whose requirement ids should be seeded, then re-run');
  }
  // Before any read and before any write: the two halves of the phase argument
  // must agree here, because this face uses BOTH.
  const spelling = phaseSpellingRefusal(parsedPhase);
  if (spelling) {
    return fail('bad-args', `seed-reqs ${spelling}`,
      `send --phase ${parsedPhase.value}, or rename the directory to match it - 2, 2.1 and 10 are`
      + ' spellings this face accepts; 02, 1.0 and 1.10 are not');
  }
  const n = parsedPhase.value;
  // The caller's own spelling, for the directory and for every diagnostic that
  // names one (D-02). The Traceability rows and the echoed `phase` below stay
  // NUMERIC because `parseRequirements` and `audit` compare that cell against
  // ROADMAP phase NUMBERS. What used to be a KNOWN identity collision carried
  // here as a cost - `seed-reqs --phase 1.10` reading `phases/1.10` and writing
  // `| <id> | Phase 1.1 | Pending |`, merging the two sub-phases in the audit -
  // is refused above instead (D-07), so the spelling that reaches `pname` is
  // the one the numeric half names.
  const pname = parsedPhase.raw;

  // #42/#45 rail: the flag is validated before any read.
  const reqFile = join(dir, 'REQUIREMENTS.md');
  const reqText = read(reqFile);
  if (reqText === null) {
    return fail('no-requirements', `${reqFile} not found`,
      'point --dir at the .planning/ directory that holds REQUIREMENTS.md, or run /cad-new-project'
      + ' to write one - the seeded rows go in its `## Traceability` table');
  }

  const pdir = join(dir, 'phases', pname);
  let planFiles = [];
  try { planFiles = readdirSync(pdir).filter((f) => /^PLAN(-\d+)?\.md$/.test(f)).sort(); }
  catch {
    return fail('no-phase-dir', `${pdir} not found`,
      'run /cad-plan <N> first - the ids seeded here come from the `requirements:` lines of the'
      + ' PLAN files in that directory');
  }
  if (!planFiles.length) return fail('no-plans', `no PLAN(-N).md under ${pdir}`, `/cad-plan ${pname}`);

  // Ids in plan-file order, union first-occurrence-wins across the phase's
  // plan(s); frontmatter issues carried in the same {file, issues} shape
  // cmdAudit emits, so a malformed requirements: line is loud at the moment
  // its ids are being written, not only at the next audit.
  const ids = [];
  const seenIds = new Set();
  const frontmatterIssues = [];
  for (const f of planFiles) {
    const { ids: fileIds, issues } = parsePlanRequirements(read(join(pdir, f)) || '');
    for (const id of fileIds) if (!seenIds.has(id)) { seenIds.add(id); ids.push(id); }
    if (issues.length) frontmatterIssues.push({ file: `phases/${pname}/${f}`, issues });
  }

  // Bound by ## Active (D-06): an id with no bullet there is scope creep or
  // a typo and stays an orphans.plan_ids entry on purpose, never seeded.
  const activeIds = parseActiveIds(reqText);
  const noActiveSection = activeIds === null;
  const activeSet = new Set(activeIds || []);
  const rows = [];
  const orphanIds = [];
  for (const id of ids) {
    if (activeSet.has(id)) rows.push({ id, phase: n });
    else orphanIds.push(id);
  }

  const res = insertReqRows(reqText, rows);
  if (res.error) {
    return fail('no-traceability-table', `${reqFile} has no "## Traceability" table with a header separator`,
      'add a `## Traceability` heading to REQUIREMENTS.md with a markdown table under it - a header'
      + ' row and its `| --- |` separator - then re-run; nothing was written');
  }
  if (res.inserted.length) atomicWrite(reqFile, res.text);

  // seeded/skipped are ALWAYS present, even empty - contrary to the
  // envelope's omit-empty convention and deliberately so (uat merge's
  // always-present counts precedent): a bookkeeping step that has now
  // failed twice by writing nothing must report writing nothing.
  ok({
    phase: n,
    seeded: res.inserted,
    skipped: res.skipped,
    ...(res.mismatched.length ? { mismatched: res.mismatched } : {}),
    ...(orphanIds.length ? { orphan_ids: orphanIds } : {}),
    ...(frontmatterIssues.length ? { frontmatter_issues: frontmatterIssues } : {}),
    ...(noActiveSection ? { no_active_section: true } : {}),
  });
}

export { cmdSeedReqs };
