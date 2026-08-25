// @ts-check
// planning/audit.mjs - `audit`: the requirement -> phase -> plan -> verified
// trace, as data.
//
// It declares no constants of its own. The two the single-file layout parked
// beside this handler are read only by `criteria-coverage` and moved there
// instead - phase 4's D-06 moves a constant by USE and never by where it
// happened to sit, and this is the case that rule was written for.
'use strict';

import { dirname, join } from 'node:path';
import { derivePhases, fail, listPlanFiles, ok, read } from './core.mjs';
// The version_drift signal (FRI-03) reuses the readers that already exist
// rather than growing second ones: the SAME prose version reader branch naming
// uses (`### Active` -> ROADMAP title), the SAME membership test, and the SAME
// tag reader the branch seam reads. `normalizeTargetVersion` is imported for its
// `v`-stripping alone - the version compared here is REPORTED, never derived
// into anything that ships (REL-03 stands).
import { activeVersion, tagCarrying, titleVersion } from '../lib/branch-decision.mjs';
import { readTags } from '../lib/git-tags.mjs';
import {
  classifyActiveSection, isRequirementId, parsePlanRequirements, parseRequirements,
  parseRoadmapPhases,
} from '../lib/planning-files.mjs';
import { normalizeTargetVersion } from '../lib/release-decision.mjs';

// ---------------------------------------------------------------------------
// audit - the requirement -> phase -> plan -> verified trace, as data. The
// ship-blocking verdict stays the model's sentence; this makes it arithmetic.
// break codes: no-phase | phase-missing | no-plan | not-verified | drift |
// unpicked (an `## Active` id no phase picked up - it has no Traceability row
// at all, so it carries no `phase` key; see the D-01/D-04 block below).
//
// Also emits `version_drift` - milestone-scoped, present-or-absent, no break
// code and no count - when the planning docs name a version this repo has
// already TAGGED while its cycle is still open. See the block at its site.
// ---------------------------------------------------------------------------
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
  // The declared milestone scope, read ONCE - no new file read, and no
  // roadmap-side source: parseRoadmapPhases carries no id mapping (D-09).
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

  // An `## Active` id with no Traceability row BREAKS the verdict (D-01) - the
  // quiet failure a per-phase flow cannot see, and the state a milestone spends
  // most of its life in. This reverses the additive shape D-07 shipped one
  // milestone earlier: milestone.md's ship gate branches on the verdict alone,
  // so an additive field left the gate exactly as permeable as it was at the
  // v1.2.0 and v1.3.1 closes.
  //
  // The set is `## Active` minus the table's ids - NO plan-side subtraction: an
  // id a plan declares but no row carries is BOTH unpicked here and an
  // `orphans.plan_ids` entry there, which is the seed-reqs-never-wrote state and
  // must report from both directions. Never coerce `active.ids` null to []
  // (D-06): every project scaffolded before v1.4.0 has no `## Active` heading by
  // this grammar, and a coercion would read its whole scope as unpicked and make
  // its audit unpassable.
  //
  // `isRequirementId` is the ADMISSION test, and it is load-bearing: the bullet
  // grammar reads any bold span as an id (`- **Note**: scope frozen` declares
  // `Note`, `- **AUTH-01:**` declares `AUTH-01:`) and must keep doing so for
  // `seed-reqs`. Without this filter every project carrying a prose bold-bullet
  // in `## Active` would FAIL its audit on upgrade, named for a requirement that
  // does not exist - and `AUTH-01:` would break while its own row traced
  // separately, counting one requirement twice. Such a bullet is REPORTED
  // instead, as `active-non-id-bullet` in `active_issues`.
  const unpicked = (active.ids || []).filter((id) => isRequirementId(id) && !known.has(id));
  // No `phase` key on these entries, deliberately: there is no row, so there is
  // no Phase cell to report, and `phase: null` is `no-phase`'s own datum (a row
  // that names no phase). Conflating them would make two breaks whose fixes
  // differ - assign the row a phase, vs plan the requirement or defer it -
  // indistinguishable to audit.md's next-action list. Appended AFTER the
  // row-derived entries, so a fully seeded tree's `requirements` is unchanged.
  for (const id of unpicked) requirements.push({ id, break: 'unpicked' });

  // `unseeded` names the `## Active` ids with no row, at ANY row count (D-04) -
  // one question at two row counts rather than two questions. It is no longer
  // verdict-neutral: every id it names also carries an `unpicked` break above.
  // `rows.length === 0` stays a SECOND trigger on purpose - the unpicked arm
  // alone would drop the two zero-row reports references/req-traceability.md
  // documents: a present-but-empty `## Active` ({active_ids: []}) and an absent
  // heading (+ no_active_section: true). The payload carries the same admission
  // test as the break - `unseeded` names ids a `/cad-plan` run could seed a row
  // for, and a non-id-shaped bold span is not one; it reports in `active_issues`.
  let unseeded;
  if (unpicked.length || rows.length === 0) {
    unseeded = { active_ids: unpicked, ...(active.ids === null ? { no_active_section: true } : {}) };
  }

  const broken = requirements.filter((r) => r.break).length;

  // `version_drift` (FRI-03): the planning docs name a version this repo has
  // ALREADY PUBLISHED while the cycle under that number is still open - issue
  // #87, where v2.4.0 was planned, branched and worked under a number already
  // tagged. The predicate is deliberately NOT `docs != manifest`:
  //
  // - The comparand is git TAGS (D-03). `pluginVersion()` is NOT read here, and
  //   this is the whole reason: MANIFEST_PATH resolves relative to the SCRIPT
  //   and audit.md invokes the seam through ${CLAUDE_PLUGIN_ROOT}, so in any
  //   project that is not Cadence a manifest predicate would judge the user's
  //   milestone against CADENCE's release number. Tags are the publication
  //   evidence - the rule skills/cad-health/SKILL.md already states.
  // - The manifest could not even detect #87. At tag v2.4.0 this repo had docs
  //   Active `v2.4.0`, tag `v2.4.0` AND manifest `2.4.0`: byte-identical, on the
  //   manifest test, to an interrupted close. The cycle's own completeness is
  //   what separates them, and only the phase artifacts carry that.
  //
  // Two different omissions, both correct. A doc version NO tag carries is the
  // ordinary ahead-of-manifest mid-cycle state (this repo is in it now). A
  // tagged doc version with EVERY phase complete is a close interrupted between
  // milestone.md's step 2 (the tag) and step 4 (the PROJECT.md evolve) - D-01's
  // exemption, and a state the user is already finishing. Membership, not sort
  // order (D-04): a version that merely sorts below the newest tag was published
  // by nothing, and `tagCarrying` gets the WHOLE list to test against.
  //
  // Present-or-absent, top level, outside `counts` and `requirements`: this
  // signal is milestone-scoped rather than per-requirement, and `total = traced
  // + broken + deferred` is an asserted invariant. The FAIL is audit.md §4's
  // arithmetic over the key - cmdAudit computes no verdict.
  const docVersion = activeVersion(read(join(dir, 'PROJECT.md')) || '')
    || titleVersion(roadmapText);
  // `activeVersion` returns the prose token WITH its `v` (`v9.9.0`), while
  // `tagCarrying` takes a bare comparand and `compareVersions` returns null -
  // not 0 - for a `v`-prefixed operand, so the raw token would match no tag.
  //
  // The tag question is asked FROM the planning root and answered for the
  // PROJECT root above it (TAG-01/D-07): `dir` defaults to `.planning` and
  // audit.md invokes the seam with no `--dir`, and `.planning` never holds
  // `.git`, so unbounded `git -C` discovery walked past the project entirely. A
  // project sitting inside an unrelated umbrella repository was FAILed by a
  // version that repository published; now that answer is refused and the tag
  // list is empty, which is exactly the no-repo behaviour (D-08).
  const publishedAs = docVersion
    ? tagCarrying(readTags(dir, dirname(dir)), normalizeTargetVersion(docVersion)) : null;
  // Derived phase status, not the roadmap checkbox: "finish the close" means the
  // artifacts say complete. Same test cmdStatus uses to find the current phase.
  //
  // "Complete" alone is too narrow a test for the exemption, because one phase
  // shape can never reach it: `uatComplete` refuses a `blocked` item and
  // verify.md makes `blocked` TERMINAL - nothing returns an item to the walk
  // from it. A phase parked there would hold the cycle open forever and pin the
  // gate at FAIL with one of audit.md's two exits permanently unreachable. So a
  // phase also stops holding the cycle open when its checklist has nothing left
  // that can be ANSWERED: every item pass, skipped-with-reason, or blocked.
  // That is the close's own definition of finished work, minus the arm the walk
  // cannot revisit. It does not weaken #87: a cycle being worked under a
  // published number has pending or failed items, or no checklist at all.
  // The OTHER sanctioned state the artifacts cannot express is rolled-over work
  // (DRF-02/D-04). A close is allowed to carry work forward -
  // `workflows/milestone.md` names it - and such a phase is byte-identical on
  // disk to one still being worked: `derivePhases` gives it
  // unplanned/planned/executed with a possibly absent UAT either way, and the
  // "the close already ran" signals (an ARCHIVE.md heading, an `_archive-<label>`
  // directory) are written conditionally and are far too sparse to key on
  // (D-05). So neither a status derivation nor an archive probe can tell the two
  // apart, and the only surface that carries the answer is the REQUIREMENT ROWS:
  // rolling a phase forward means marking its rows `Deferred`, which the close
  // already does and this audit already excludes from breaks. A phase whose rows
  // are all `Deferred` therefore stops holding the cycle open, and one whose rows
  // are still `Pending` keeps the gate armed - which is the half of D-04 that
  // keeps this from weakening #87.
  //
  // NO rows at all is NOT exempt: an empty set satisfies "every row is Deferred"
  // vacuously, and an unplanned or unseeded phase is the ordinary mid-cycle state
  // the signal exists to catch. The exemption needs at least one row.
  //
  // Read off the `rows` parseRequirements already produced - no second read of
  // REQUIREMENTS.md, and the same row set the arithmetic above is computed from.
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
    // Additive, never a break and never a count - two populations: a line
    // OUTSIDE the `## Active` bullet grammar (it declares no id, so there is
    // nothing to count) and a line IN the grammar whose bold span is not
    // id-shaped (`active-non-id-bullet`, held out of the arithmetic above). The
    // cost is real and stated in the prose rather than implied - the id named on
    // either line is invisible to `unpicked` until the line is rewritten as a
    // bullet whose bold span is exactly the id.
    ...(active.issues.length ? { active_issues: active.issues } : {}),
    ...(unseeded ? { unseeded } : {}),
    ...(cycleOpen ? { version_drift: {
      doc_version: docVersion, published_as: publishedAs, cycle_state: 'open',
    } } : {}),
    // total counts Traceability rows PLUS unpicked ids (D-02), which is what
    // keeps `requirements.length + deferred.length === rows.length +
    // unpicked.length` - i.e. total = traced + broken + deferred - true now that
    // a break can exist without a row.
    counts: {
      total: rows.length + unpicked.length,
      traced: requirements.length - broken,
      broken,
      deferred: deferred.length,
    },
  });
}

export { cmdAudit };
