// @ts-check
// planning/criteria-coverage.mjs - `criteria-coverage`: the CONTEXT acceptance criterion -> UAT item trace, as data
// ORIGIN_EXEMPT, LEGACY_REASON and readCoverageContext live here because nothing else reads them
'use strict';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fail, ok, pluginVersion, read } from './core.mjs';
import {
  UAT_FIELDS_VERSION, classifyAcceptanceCriteria, parseRoadmapPhases, parseUat,
} from '../lib/planning-files.mjs';

// proves every criterion a phase declared reached that phase's checklist; `/cad-audit` folds this into its one verdict
// a subcommand of its own, not an extension of `audit`: a criterion break has no requirement id to filter by milestone
// `breaks` is the only verdict-moving key; `untraced`, `legacy`, `unknown_criterion` and `context_issues` are additive
// break codes: uncovered | missing-uat | fieldless-checklist | unreadable-context
// a `legacy` entry is `{phase, reason}`, never a bare number, since an exemption with no reason reads like a clean pass

// an `origin` for an item built from no criterion; UAT_ORIGINS in lib/planning-files.mjs minus `criterion`
const ORIGIN_EXEMPT = new Set(['verifier', 'smoke']);

// the one sentence every `legacy` entry carries: an exemption that states no reason reads like a clean pass
const LEGACY_REASON = 'pre-field checklist: no `fields_version` frontmatter '
  + 'marker, no `criterion` or `origin` on any item, and its CONTEXT declares '
  + 'no AC<N> ids';

/**
 * criteria-coverage's own CONTEXT reader.
 * `read` collapses every errno to null, so a `chmod 000` CONTEXT looked pruned and the gate passed unchecked.
 * Scoped to this call site: widening the errno set in `read` would break five other commands on a permission problem.
 * `code` is the refusal: null when read or genuinely absent (only ENOENT keeps the exemption), the errno otherwise.
 * @param {string} file
 * @returns {{text: string|null, code: string|null}}
 */
function readCoverageContext(file) {
  try { return { text: readFileSync(file, 'utf8'), code: null }; }
  catch (e) {
    const errno = e && /** @type {any} */ (e).code ? String(/** @type {any} */ (e).code) : 'UNKNOWN';
    return { text: null, code: errno === 'ENOENT' ? null : errno };
  }
}

function cmdCriteriaCoverage(dir) {
  const roadmapText = read(join(dir, 'ROADMAP.md'));
  if (roadmapText === null) {
    return fail('no-roadmap', `${join(dir, 'ROADMAP.md')} not found`,
      'point --dir at the .planning/ directory that holds ROADMAP.md - the phase list there is what'
      + ' says which phases have criteria to cover');
  }
  // the same phase list cmdAudit walks, so there's one source of truth; milestone.md prunes finished phases from it
  const roadmap = parseRoadmapPhases(roadmapText);

  const phases = [];
  const breaks = [];
  const untraced = [];
  const legacy = [];
  const unknownCriterion = [];
  const contextIssues = [];
  let nCriteria = 0, nCovered = 0, nUncovered = 0;

  for (const p of roadmap) {
    const pdir = join(dir, 'phases', String(p.n));
    const context = readCoverageContext(join(pdir, 'CONTEXT.md'));
    // a CONTEXT that exists and couldn't be read is a break, not the exemption below: its criteria were never read
    if (context.code !== null) {
      breaks.push({ phase: p.n, break: 'unreadable-context', code: context.code,
        file: `phases/${p.n}/CONTEXT.md` });
      continue;
    }
    const contextText = context.text;
    const uatText = read(join(pdir, 'UAT.md'));
    // an absent CONTEXT is nothing to prove: it's optional, and milestone.md runs this gate before the prune
    if (contextText === null) continue;

    const classified = classifyAcceptanceCriteria(contextText);
    // `criteria: null` is an absent heading, "nothing declared"; coerced to [] so the phase still reports
    const criteria = classified.criteria || [];
    if (classified.issues.length) contextIssues.push({ phase: p.n, issues: classified.issues });

    // CONTEXT present, UAT.md absent: a checked phase with criteria and no checklist is the total drop this catches
    // each declared criterion counts uncovered, and on a checked box breaks as `missing-uat`; in flight it never breaks
    if (uatText === null) {
      phases.push({ phase: p.n, criteria: criteria.length, items: 0 });
      nCriteria += criteria.length;
      for (const c of criteria) {
        nUncovered++;
        if (p.checked) breaks.push({ phase: p.n, id: c.id, break: 'missing-uat' });
      }
      continue;
    }

    const uat = parseUat(uatText);
    const items = uat.items;
    phases.push({ phase: p.n, criteria: criteria.length, items: items.length });

    const withCriterion = items.filter((it) => it.criterion !== undefined);
    const withOrigin = items.filter((it) => it.origin !== undefined);
    // `fieldless`: a non-empty checklist with no `fields_version` marker and no traceability field on any item
    // the marker is what's tested, not item fields: `criterion` lines with no `origin` once read as old, green forever
    const fieldless = items.length > 0 && uat.fm.fields_version === undefined
      && withCriterion.length === 0 && withOrigin.length === 0;
    if (fieldless) {
      // legacy has five terms, the fifth being that the CONTEXT declares no criterion ids (ids postdate v1.5.0)
      // so ids beside a fieldless checklist are a dropped link, and `uat init` always writes `fields_version`
      // declared, not parsed: ask the classifier (`declaresIds`), never `criteria.length`, or odd id shapes exempt
      // an id the grammar refused is still declared, and `'unknown'` isn't `'none'`; only a provable `'none'` exempts
      if (classified.declaresIds === 'none') {
        legacy.push({ phase: p.n, reason: LEGACY_REASON });
        continue;
      }
      // one break per phase, naming the file to repair: dozens of `uncovered` entries are one missing marker
      // it fires whatever the checkbox says: `uat init` writes `fields_version` first, so none is transient
      breaks.push({ phase: p.n, break: 'fieldless-checklist', file: `phases/${p.n}/UAT.md` });
      nCriteria += criteria.length;
      nUncovered += criteria.length;
      continue;
    }

    const declared = new Set(criteria.map((c) => c.id));
    const covered = new Set();
    for (const it of items) {
      if (it.criterion !== undefined) {
        const id = String(it.criterion);
        // an item covers the id in its `criterion` field
        if (declared.has(id)) covered.add(id);
        else unknownCriterion.push({ phase: p.n, item: Number(it.k), criterion: id });
        continue;
      }
      // untraced: no `criterion`, and no `origin` declaring none; `origin: criterion` with no id names nothing
      if (!ORIGIN_EXEMPT.has(String(it.origin))) {
        untraced.push({ phase: p.n, item: Number(it.k), name: String(it.name) });
      }
    }
    nCriteria += criteria.length;
    nCovered += covered.size;
    for (const c of criteria) {
      if (covered.has(c.id)) continue;
      nUncovered++;
      // an unchecked roadmap box means verification hasn't started, so uncovered criteria are counted and never break
      if (p.checked) breaks.push({ phase: p.n, id: c.id, break: 'uncovered' });
    }
  }

  ok({
    // first key, always present: a statement about the run. Mid-cycle the manifest lags and `uat_fields` doesn't
    // a stale plugin-root cache silently downgrading this gate had no signal, so the plugin version is recorded
    version: { plugin: pluginVersion(), uat_fields: UAT_FIELDS_VERSION },
    phases,
    ...(breaks.length ? { breaks } : {}),
    ...(untraced.length ? { untraced } : {}),
    ...(legacy.length ? { legacy } : {}),
    ...(unknownCriterion.length ? { unknown_criterion: unknownCriterion } : {}),
    ...(contextIssues.length ? { context_issues: contextIssues } : {}),
    // `criteria === covered + uncovered` with legacy held out; `breaks` is the checked-box subset, so they differ
    counts: {
      criteria: nCriteria,
      covered: nCovered,
      uncovered: nUncovered,
      untraced: untraced.length,
      phases: phases.length,
    },
  });
}

export { cmdCriteriaCoverage };
