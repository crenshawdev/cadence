// @ts-check
// planning/seed-reqs.mjs - `seed-reqs`: the Traceability rows a phase's plans declare, added to the state as /cad-plan writes
// the table in REQUIREMENTS.md is rendered from the state; `## Active` is still read from the file
'use strict';

import { join } from 'node:path';
import { fail, ok, phaseSpellingRefusal, read } from './core.mjs';
import { parseActiveIds, readFrontmatterList } from '../lib/planning-files.mjs';
import { requirePhaseArg } from '../lib/require-int.mjs';
import { planFilesIn } from '../lib/phase-plans.mjs';
import { renderTraceability } from '../lib/state-views.mjs';
import { changeState, foldPhase, loadState } from './state-import.mjs';

// bounded by ## Active, called by /cad-plan where the plan is written: the Traceability table had no write path before
function cmdSeedReqs(dir, opts) {
  const parsedPhase = requirePhaseArg(opts.phase);
  if (!parsedPhase.ok) {
    return fail('bad-args', 'seed-reqs needs --phase <N>',
      'pass --phase <N> naming the phase whose requirement ids should be seeded, then re-run');
  }
  // before any read or write, since the two halves of the phase argument have to agree: this face uses both
  const spelling = phaseSpellingRefusal(parsedPhase);
  if (spelling) {
    return fail('bad-args', `seed-reqs ${spelling}`,
      `send --phase ${parsedPhase.value}, or rename the directory to match it - 2, 2.1 and 10 are`
      + ' spellings this face accepts; 02, 1.0 and 1.10 are not');
  }
  const n = parsedPhase.value;
  // the caller's own spelling names the directory and diagnostics; rows and the echoed phase stay numeric for audit
  // a 1.10 phase used to write its rows as 1.1, merging two sub-phases in the audit
  const pname = parsedPhase.raw;

  // the flag is validated before any read
  const reqFile = join(dir, 'REQUIREMENTS.md');
  const reqText = read(reqFile);
  if (reqText === null) {
    return fail('no-requirements', `${reqFile} not found`,
      'point --dir at the .planning/ directory that holds REQUIREMENTS.md, or run /cad-new-project'
      + ' to write one - the seeded rows go in its `## Traceability` table');
  }

  const pdir = join(dir, 'phases', pname);
  const planFiles = planFilesIn(pdir);
  if (planFiles === null) {
    return fail('no-phase-dir', `${pdir} not found`,
      'run /cad-plan <N> first - the ids seeded here come from the `requirements:` lines of the'
      + ' PLAN files in that directory');
  }
  if (!planFiles.length) return fail('no-plans', `no PLAN(-N).md under ${pdir}`, `/cad-plan ${pname}`);

  // ids in plan-file order, first occurrence wins across the phase's plans
  // frontmatter issues use the {file, issues} shape cmdAudit emits, so a malformed requirements: line is loud
  const ids = [];
  const seenIds = new Set();
  const frontmatterIssues = [];
  for (const f of planFiles) {
    const { items: fileIds, issues } = readFrontmatterList(read(join(pdir, f)) || '', 'requirements');
    for (const id of fileIds) if (!seenIds.has(id)) { seenIds.add(id); ids.push(id); }
    if (issues.length) frontmatterIssues.push({ file: `phases/${pname}/${f}`, issues });
  }

  // bound by ## Active: an id with no bullet there is scope creep or a typo, so it's an orphan and never seeded
  const activeIds = parseActiveIds(reqText);
  const noActiveSection = activeIds === null;
  const activeSet = new Set(activeIds || []);
  const rows = [];
  const orphanIds = [];
  for (const id of ids) {
    if (activeSet.has(id)) rows.push({ id, phase: n });
    else orphanIds.push(id);
  }

  // the table is rendered into its heading, so a missing heading or table is the refusal it always was, before any write
  const state = loadState(dir);
  if (!state) return;
  if (renderTraceability(state, reqText).missing) {
    return fail('no-traceability-table', `${reqFile} has no "## Traceability" table with a header separator`,
      'add a `## Traceability` heading to REQUIREMENTS.md with a markdown table under it - a header'
      + ' row and its `| --- |` separator - then re-run; nothing was written');
  }
  // an id the state already holds is skipped, and mismatched when its phase differs (a stale renumber)
  const held = new Map(state.requirements.map((r) => [r.id, r]));
  const res = { inserted: [], skipped: [], mismatched: [] };
  const added = [];
  for (const { id, phase } of rows) {
    const row = held.get(id);
    if (row) {
      res.skipped.push(id);
      if (row.phase !== phase) res.mismatched.push({ id, row_phase: row.phase });
    } else {
      res.inserted.push(id);
      // Pending is a literal, so no writer but cad-verify can create any other Status
      added.push({ id, phase, status: 'Pending' });
    }
  }
  const done = changeState(dir, (s) => ({ ...foldPhase(dir, s, n), requirements: [...s.requirements, ...added] }),
    ['STATE.md', 'ROADMAP.md', 'REQUIREMENTS.md']);
  if (!done) return;

  // seeded and skipped are always present, even empty: a step that failed twice by writing nothing must say so
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
