// @ts-check
// planning/audit.mjs - `audit`: the requirement -> phase -> plan -> verified trace, as data
// it declares no constants of its own: the two that used to sit beside this handler are read only by `criteria-coverage` and live there, since a constant goes where it's used and not where it happened to sit
'use strict';

import { dirname, join } from 'node:path';
import { derivePhases, fail, listPlanFiles, ok, read } from './core.mjs';
// version_drift reuses readers that already exist: the prose version reader branch naming uses (`### Active` -> ROADMAP title), the same membership test and the same tag reader the branch seam reads. normalizeTargetVersion is imported only for its `v`-stripping, since the version compared here is reported and never derived into anything that ships
import { activeVersion, tagCarrying, titleVersion } from '../lib/branch-decision.mjs';
import { readTags } from '../lib/git-tags.mjs';
import {
  classifyActiveSection, isRequirementId, parsePlanRequirements, parseRequirements,
  parseRoadmapPhases,
} from '../lib/planning-files.mjs';
import { normalizeTargetVersion } from '../lib/release-decision.mjs';

// the ship-blocking verdict stays the model's sentence; this makes it arithmetic
// break codes: no-phase | phase-missing | no-plan | not-verified | drift | unpicked (an `## Active` id no phase picked up: it has no Traceability row at all, so it carries no `phase` key)
// it also emits `version_drift`, milestone-scoped and present-or-absent with no break code and no count, when the planning docs name a version this repo has already tagged while its cycle is still open
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
  const roadmap = new Map(parseRoadmapPhases(roadmapText).map((p) => [p.n, p]));

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
      const { ids, issues } = parsePlanRequirements(read(join(pdir, f)) || '');
      planIds.set(rel, ids);
      for (const id of ids) if (!planByReq.has(id)) planByReq.set(id, rel);
      if (issues.length) frontmatterIssues.push({ file: rel, issues });
    }
  }

  const rows = parseRequirements(reqText);
  // the declared milestone scope, read once with no new file read and no roadmap-side source, since parseRoadmapPhases carries no id mapping
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

  // an `## Active` id with no Traceability row breaks the verdict: it's the quiet failure a per-phase flow can't see and the state a milestone spends most of its life in. This reverses the additive shape shipped a milestone earlier, because milestone.md's ship gate branches on the verdict alone, so an additive field left the gate as permeable as it was
  // the set is `## Active` minus the table's ids, with no plan-side subtraction: an id a plan declares but no row carries is both unpicked here and an `orphans.plan_ids` entry there, the state seed-reqs never wrote, and it has to report from both directions. Never coerce `active.ids` null to []: every project scaffolded before the `## Active` heading existed has none by this grammar, and a coercion would read its whole scope as unpicked and make its audit unpassable
  // isRequirementId is the admission test and it's load-bearing: the bullet grammar reads any bold span as an id (`- **Note**: scope frozen` declares `Note`, and a bold id with a trailing colon declares it with the colon) and must keep doing so for seed-reqs. Without this filter every project with a prose bold-bullet in `## Active` would fail its audit on upgrade, named for a requirement that doesn't exist, and the colon-suffixed id would break while its own row traced separately. Such a bullet is reported instead, as `active-non-id-bullet` in `active_issues`
  const unpicked = (active.ids || []).filter((id) => isRequirementId(id) && !known.has(id));
  // no `phase` key on these entries, on purpose: there's no row, so no Phase cell to report, and `phase: null` is `no-phase`'s own datum (a row that names no phase). Conflating them would make two breaks whose fixes differ (assign the row a phase, versus plan the requirement or defer it) indistinguishable to audit.md's next-action list. They're appended after the row-derived entries, so a fully seeded tree's `requirements` is unchanged
  for (const id of unpicked) requirements.push({ id, break: 'unpicked' });

  // `unseeded` names the `## Active` ids with no row at any row count: one question at two row counts and not two questions. It's no longer verdict-neutral, since every id it names also carries an `unpicked` break above. `rows.length === 0` stays a second trigger on purpose, because the unpicked arm alone would drop the two zero-row reports req-traceability.md documents: a present-but-empty `## Active` ({active_ids: []}) and an absent heading (+ no_active_section: true). The payload carries the same admission test as the break, since `unseeded` names ids a /cad-plan run could seed a row for and a non-id-shaped bold span isn't one; it reports in `active_issues`
  let unseeded;
  if (unpicked.length || rows.length === 0) {
    unseeded = { active_ids: unpicked, ...(active.ids === null ? { no_active_section: true } : {}) };
  }

  const broken = requirements.filter((r) => r.break).length;

  // `version_drift`: the planning docs name a version this repo has already published while the cycle under that number is still open (issue #87, where v2.4.0 was planned, branched and worked under a number already tagged). The predicate is deliberately not `docs != manifest`
  // the comparand is git tags. pluginVersion is not read here, which is the whole reason: its manifest path resolves relative to the script and audit.md invokes the seam through ${CLAUDE_PLUGIN_ROOT}, so in any project that isn't Cadence a manifest predicate would judge the user's milestone against Cadence's release number. Tags are the publication evidence, the rule skills/cad-health/SKILL.md already states
  // the manifest couldn't even have detected #87: at tag v2.4.0 this repo had docs Active `v2.4.0`, tag `v2.4.0` and manifest `2.4.0`, byte-identical on the manifest test to an interrupted close. The cycle's own completeness is what separates them, and only the phase artifacts carry that
  // two different omissions, both correct. A doc version no tag carries is the ordinary ahead-of-manifest mid-cycle state. A tagged doc version with every phase complete is a close interrupted between milestone.md's tag step and its PROJECT.md evolve step, a state the user is already finishing. Membership and not sort order: a version that merely sorts below the newest tag was published by nothing, and tagCarrying gets the whole list to test against
  // present-or-absent, top level, outside `counts` and `requirements`: this signal is milestone-scoped and not per-requirement, and `total = traced + broken + deferred` is an asserted invariant. The FAIL is audit.md's arithmetic over the key, and cmdAudit computes no verdict
  const docVersion = activeVersion(read(join(dir, 'PROJECT.md')) || '')
    || titleVersion(roadmapText);
  // activeVersion returns the prose token with its `v` (`v9.9.0`), while tagCarrying takes a bare comparand and compareVersions returns null, not 0, for a `v`-prefixed operand, so the raw token would match no tag
  // the tag question is asked from the planning root and answered for the project root above it: `dir` defaults to `.planning` and audit.md invokes the seam with no `--dir`, and `.planning` never holds `.git`, so unbounded `git -C` discovery walked past the project entirely. A project inside an unrelated umbrella repository was failed by a version that repository published; now that answer is refused and the tag list is empty, which is the no-repo behaviour
  const publishedAs = docVersion
    ? tagCarrying(readTags(dir, dirname(dir)), normalizeTargetVersion(docVersion)) : null;
  // derived phase status and not the roadmap checkbox: "finish the close" means the artifacts say complete, the same test cmdStatus uses to find the current phase
  // "complete" alone is too narrow for the exemption, because one phase shape can never reach it: `uatComplete` refuses a `blocked` item and verify.md makes `blocked` terminal, so a phase parked there would hold the cycle open forever and pin the gate at FAIL with one of audit.md's two exits unreachable. So a phase also stops holding the cycle open when its checklist has nothing left that can be answered (every item pass, skipped-with-reason or blocked), which is the close's own definition of finished work minus the arm the walk can't revisit. It doesn't weaken #87: a cycle being worked under a published number has pending or failed items, or no checklist at all
  // the other sanctioned state the artifacts can't express is rolled-over work. A close may carry work forward, and such a phase is byte-identical on disk to one still being worked: derivePhases gives unplanned, planned or executed with a possibly absent UAT either way, and the signals that the close already ran (an ARCHIVE.md heading, an archive directory) are written conditionally and are far too sparse to key on. The only surface carrying the answer is the requirement rows: rolling a phase forward marks its rows `Deferred`, which the close already does and this audit already excludes from breaks. So a phase whose rows are all `Deferred` stops holding the cycle open, and one whose rows are still `Pending` keeps the gate armed, which keeps this from weakening #87
  // no rows at all is not exempt: an empty set satisfies "every row is Deferred" vacuously, and an unplanned or unseeded phase is the ordinary mid-cycle state the signal exists to catch, so the exemption needs at least one row
  // read off the `rows` parseRequirements already produced, so there's no second read of REQUIREMENTS.md and it's the same row set the arithmetic above is computed from
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
    // additive, never a break and never a count, for two populations: a line outside the `## Active` bullet grammar (it declares no id, so there's nothing to count) and a line in the grammar whose bold span isn't id-shaped (`active-non-id-bullet`, held out of the arithmetic above). The id named on either line is invisible to `unpicked` until it's rewritten as a bullet whose bold span is exactly the id, and the prose states that cost
    ...(active.issues.length ? { active_issues: active.issues } : {}),
    ...(unseeded ? { unseeded } : {}),
    ...(cycleOpen ? { version_drift: {
      doc_version: docVersion, published_as: publishedAs, cycle_state: 'open',
    } } : {}),
    // total counts Traceability rows plus unpicked ids, which keeps `requirements.length + deferred.length === rows.length + unpicked.length`, i.e. total = traced + broken + deferred, true now that a break can exist without a row
    counts: {
      total: rows.length + unpicked.length,
      traced: requirements.length - broken,
      broken,
      deferred: deferred.length,
    },
  });
}

export { cmdAudit };
