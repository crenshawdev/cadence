// @ts-check
// planning/audit.mjs - `audit`: the requirement -> phase -> plan -> verified trace, as data
// no constants of its own: the two that sat beside this handler are read only by `criteria-coverage` and live there
'use strict';

import { dirname, join } from 'node:path';
import { derivePhases, fail, listPlanFiles, ok, read } from './core.mjs';
// version_drift reuses readers that already exist; normalizeTargetVersion is imported only for its `v`-stripping
import { activeVersion, tagCarrying, titleVersion } from '../lib/branch-decision.mjs';
import { readTags } from '../lib/git-tags.mjs';
import {
  classifyActiveSection, isRequirementId, readFrontmatterList,
} from '../lib/planning-files.mjs';
import { normalizeTargetVersion } from '../lib/release-decision.mjs';
import { loadState, phaseListOf } from './state-import.mjs';

// the ship-blocking verdict stays the model's sentence; this makes it arithmetic
// break codes: no-phase | phase-missing | no-plan | not-verified | drift | unpicked (an `## Active` id with no row)
// `version_drift` is milestone-scoped, no break code or count: the docs name a tagged version while the cycle is open
function cmdAudit(dir) {
  const reqText = read(join(dir, 'REQUIREMENTS.md'));
  if (reqText === null) {
    return fail('no-requirements', `${join(dir, 'REQUIREMENTS.md')} not found`,
      'point --dir at the .planning/ directory that holds REQUIREMENTS.md, or run /cad-new-project'
      + ' if this project has none yet - the audit reads its `## Traceability` table');
  }
  const roadmapText = read(join(dir, 'ROADMAP.md'));
  if (roadmapText === null) {
    return fail('no-roadmap', `${join(dir, 'ROADMAP.md')} not found`,
      'point --dir at the .planning/ directory that holds ROADMAP.md, or run /cad-new-project if'
      + ' this project has no roadmap yet');
  }
  const state = loadState(dir);
  if (!state) return;
  const roadmap = new Map(phaseListOf(state).map((p) => [p.n, p]));

  // requirement id -> the plan file that carries it, per phase dir.
  const planByReq = new Map();
  const planIds = new Map(); // plan file -> ids (for orphan detection)
  const frontmatterIssues = []; // [{file, issues}], plan-file order, omitted when empty
  const nonconformingPlans = []; // phases/<n>/<file>, phase order, omitted when empty
  for (const [n] of roadmap) {
    const pdir = join(dir, 'phases', String(n));
    const { plans: files, nonconforming } = listPlanFiles(pdir);
    for (const f of nonconforming) nonconformingPlans.push(`phases/${n}/${f}`);
    for (const f of files) {
      const rel = `phases/${n}/${f}`;
      const { items: ids, issues } = readFrontmatterList(read(join(pdir, f)) || '', 'requirements');
      planIds.set(rel, ids);
      for (const id of ids) if (!planByReq.has(id)) planByReq.set(id, rel);
      if (issues.length) frontmatterIssues.push({ file: rel, issues });
    }
  }

  const rows = state.requirements;
  // the declared milestone scope, read once, since parseRoadmapPhases carries no id mapping
  const active = classifyActiveSection(reqText);
  const requirements = [];
  const deferred = [];
  for (const r of rows) {
    if (r.status === 'Deferred') { deferred.push(r.id); continue; }
    const entry = { id: r.id, phase: r.phase };
    if (r.phase === null) { entry.break = 'no-phase'; requirements.push(entry); continue; }
    const phase = roadmap.get(r.phase);
    if (!phase) { entry.break = 'phase-missing'; requirements.push(entry); continue; }
    const plan = planByReq.get(r.id) || null;
    entry.plan = plan;
    entry.status = r.status;
    entry.box = phase.checked;
    if (!plan) entry.break = 'no-plan';
    else if (r.status === 'Complete' && phase.checked) { /* fully traced */ }
    else if (r.status !== 'Complete' && !phase.checked) entry.break = 'not-verified';
    else entry.break = 'drift'; // the two status sources contradict
    requirements.push(entry);
  }

  const known = new Set(rows.map((r) => r.id));
  const orphanPlans = [];
  for (const [file, ids] of planIds) {
    const unknown = ids.filter((id) => !known.has(id));
    if (unknown.length) orphanPlans.push({ file, ids: unknown });
  }

  // an `## Active` id with no Traceability row breaks the verdict: milestone.md's ship gate reads only the verdict
  // `## Active` minus the table's ids; never coerce `active.ids` null to [], or old projects become unpassable
  // isRequirementId is load-bearing: the bullet grammar reads any bold span as an id, and `Note` would fail upgrades
  // such a bullet is reported as `active-non-id-bullet` in `active_issues` instead
  const unpicked = (active.ids || []).filter((id) => isRequirementId(id) && !known.has(id));
  // no `phase` key: there's no row, and `phase: null` is `no-phase`'s own datum, so the two breaks would blur
  for (const id of unpicked) requirements.push({ id, break: 'unpicked' });

  // `unseeded` names the `## Active` ids with no row at any row count: one question, and no longer verdict-neutral
  let unseeded;
  if (unpicked.length || rows.length === 0) {
    unseeded = { active_ids: unpicked, ...(active.ids === null ? { no_active_section: true } : {}) };
  }

  const broken = requirements.filter((r) => r.break).length;

  // `version_drift`: the docs name a version already published while its cycle is open (#87); not `docs != manifest`
  // the comparand is git tags, not pluginVersion: its path resolves against the script, not the user's project
  // the manifest couldn't have caught #87: it looked identical to an interrupted close; only phase artifacts differ
  // a version no tag carries is mid-cycle; a tagged one with every phase complete is a close being finished. Membership
  // top level, outside `counts` and `requirements`: it's milestone-scoped, and audit.md does the FAIL arithmetic
  const docVersion = activeVersion(read(join(dir, 'PROJECT.md')) || '')
    || titleVersion(roadmapText);
  // activeVersion returns the token with its `v`, but tagCarrying takes a bare comparand
  // asked from the planning root for the project above it: `.planning` never holds `.git`, so discovery walked past
  const publishedAs = docVersion
    ? tagCarrying(readTags(dir, dirname(dir)), normalizeTargetVersion(docVersion)) : null;
  // derived phase status, not the roadmap checkbox: "finish the close" means the artifacts say complete
  // `blocked` is terminal, so a parked phase would pin the gate at FAIL; nothing answerable left stops holding it too
  // rolled-over work looks like work in flight on disk; only the rows differ, as the close marks them `Deferred`
  // no rows is not exempt: an empty set satisfies "every row is Deferred" vacuously, and unplanned is mid-cycle
  // read off the `rows` the state already supplied, so it's the same row set as the arithmetic above
  const settled = (p) => p.status === 'complete'
    || (p.uat !== null && p.uat.items.length > 0 && p.uat.items.every((i) =>
      i.status === 'pass' || i.status === 'blocked'
      || (i.status === 'skipped' && i.reason)));
  const rolledOver = (p) => {
    const own = rows.filter((r) => r.phase === p.n);
    return own.length > 0 && own.every((r) => r.status === 'Deferred');
  };
  const cycleOpen = publishedAs !== null
    && derivePhases(dir, [...roadmap.values()]).some((p) => !settled(p) && !rolledOver(p));

  ok({
    requirements,
    ...(orphanPlans.length ? { orphans: { plan_ids: orphanPlans } } : {}),
    ...(frontmatterIssues.length ? { frontmatter_issues: frontmatterIssues } : {}),
    ...(nonconformingPlans.length ? { nonconforming_plans: nonconformingPlans } : {}),
    ...(deferred.length ? { deferred } : {}),
    // additive, never a break or a count: a line outside the `## Active` bullet grammar, or a bold span that's no id
    ...(active.issues.length ? { active_issues: active.issues } : {}),
    ...(unseeded ? { unseeded } : {}),
    ...(cycleOpen ? { version_drift: {
      doc_version: docVersion, published_as: publishedAs, cycle_state: 'open',
    } } : {}),
    // total counts rows plus unpicked ids, so total = traced + broken + deferred holds with a break and no row
    counts: {
      total: rows.length + unpicked.length,
      traced: requirements.length - broken,
      broken,
      deferred: deferred.length,
    },
  });
}

export { cmdAudit };
