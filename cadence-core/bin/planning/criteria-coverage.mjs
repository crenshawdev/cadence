// @ts-check
// planning/criteria-coverage.mjs - `criteria-coverage`: the CONTEXT acceptance criterion -> UAT item trace, as data
// ORIGIN_EXEMPT, LEGACY_REASON and readCoverageContext are here because this is the only thing that reads them; in the single-file layout the first two sat beside `audit`, and following the layout would have filed them under the wrong command
'use strict';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fail, ok, pluginVersion, read } from './core.mjs';
import {
  UAT_FIELDS_VERSION, classifyAcceptanceCriteria, parseRoadmapPhases, parseUat,
} from '../lib/planning-files.mjs';

// proves every criterion a phase declared reached that phase's checklist, and `/cad-audit` folds this into its one verdict
// a new subcommand and not an extension of `audit`: audit's `counts` identity (total = traced + broken + deferred) is pinned, and audit.md filters `requirements[]` by milestone id, but a criterion break carries no requirement id to filter on, so an out-of-scope phase's break would block a ship it shouldn't
// the two directions are asymmetric: `breaks` is the only verdict-moving key, and `untraced`, `legacy`, `unknown_criterion` and `context_issues` are additive, since every phase in a cycle appended legitimate verifier gap items and making the reverse direction breaking would make the gate unpassable
// break codes: uncovered (a declared id no item covers) | missing-uat (a declared id on a phase with no checklist at all) | fieldless-checklist (one per phase, `{phase, break, file}`: the checklist has items but none of the traceability fields, beside a CONTEXT that declared ids, so nothing in it can be traced either way) | unreadable-context (one per phase, `{phase, break, code, file}`: the CONTEXT file is there and couldn't be read, so the phase's criteria were never looked at). A `legacy` entry is `{phase, reason}` and never a bare phase number, since an exemption that states no reason reads exactly like a clean pass

// an `origin` that declares an item legitimately built from no criterion; mirrors UAT_ORIGINS in lib/planning-files.mjs minus `criterion`, which names no id by itself and so exempts nothing
const ORIGIN_EXEMPT = new Set(['verifier', 'smoke']);

// the one sentence every `legacy` entry carries, fixed and not computed per phase because every term holds identically for each phase the exemption reaches. Naming the conditions is the point: the exemption is a modern seam reporting green over an old file, and a bare phase number gives a reviewer nothing to check it against
const LEGACY_REASON = 'pre-field checklist: no `fields_version` frontmatter '
  + 'marker, no `criterion` or `origin` on any item, and its CONTEXT declares '
  + 'no AC<N> ids';

/**
 * criteria-coverage's own CONTEXT reader.
 * `read` collapses every errno to null, so the exemption for an absent CONTEXT couldn't tell a phase whose CONTEXT was pruned away from one at `chmod 000` or replaced by a directory, and the second answered `{"ok":true,"phases":[]}` over criteria it never looked at: the gate passing a phase it never checked.
 * Scoped to this one call site on purpose: read's other callers sit behind `|| ''` fallbacks, and widening the errno set there would turn a permission problem into a break across `status`, `audit`, `plan-overlap`, `plan-size` and `seed-reqs` at once.
 * `code` is the refusal: null when the file was read and when it's genuinely absent (only ENOENT keeps the exemption, since absent really is nothing to prove), the errno otherwise, with `text` null on both of those arms.
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
  // the same phase list cmdAudit walks, so there's no new source of truth for which phases exist; milestone.md prunes completed phases out of the live `## Phases` list, so this only ever holds the current cycle's phases
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
    // a CONTEXT that exists and couldn't be read is a break and not the exemption below: the phase's criteria weren't proven absent, they were never read. `breaks` is the only verdict-moving key, and like fieldless-checklist (unlike `uncovered`) it fires whatever the roadmap checkbox says, since an unreadable file is never a transient state of work in flight
    if (context.code !== null) {
      breaks.push({ phase: p.n, break: 'unreadable-context', code: context.code,
        file: `phases/${p.n}/CONTEXT.md` });
      continue;
    }
    const contextText = context.text;
    const uatText = read(join(pdir, 'UAT.md'));
    // an absent CONTEXT file is nothing to prove: CONTEXT is a documented optional artifact, and milestone.md runs this gate before the prune that deletes phase dirs, so a prior milestone's pruned phase must never make the gate unpassable. The prune removes the whole directory, CONTEXT included, which is why the exemption belongs on this arm and not the UAT one below
    if (contextText === null) continue;

    const classified = classifyAcceptanceCriteria(contextText);
    // `criteria: null` is an absent heading, "nothing declared" and not a problem; it's coerced to [] because the phase's CONTEXT exists, so it still reports its `phases[]` entry and its items still trace (to nothing, which is `untraced`'s additive job)
    const criteria = classified.criteria || [];
    if (classified.issues.length) contextIssues.push({ phase: p.n, issues: classified.issues });

    // CONTEXT present, UAT.md absent: exempting this like a pruned phase left the gate's one load-bearing direction with an unnamed hole, since a checked phase that declared criteria and never got a checklist is the total drop this subcommand exists to catch. Every declared criterion counts uncovered, and on a checked box each one breaks as `missing-uat`; a phase still in flight is counted and never breaks
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
    // `fieldless` is the file-shaped half of the old legacy test: a non-empty checklist carrying no `fields_version` marker and no traceability field on any item. An empty checklist isn't fieldless, it's the drop itself, so its criteria all break below
    // the marker is what this tests, not the item fields. The original test (no `criterion` and no `origin`) assumed every post-field checklist carries at least one `origin`, which was false from the start: a checklist with seven `criterion` lines and no `origin` read as an old project the day a verify stopped emitting `criterion`, and the gate stayed green forever, the regression this subcommand exists to catch
    const fieldless = items.length > 0 && uat.fm.fields_version === undefined
      && withCriterion.length === 0 && withOrigin.length === 0;
    if (fieldless) {
      // legacy has five terms, the fifth being that the phase's CONTEXT declares no criterion ids. The id grammar and `fields_version` both shipped after v1.5.0, so no CONTEXT carrying ids can predate the fields, which makes a fieldless checklist beside declared ids a dropped link and not an old file. `uat init` writes `fields_version` unconditionally, so a file this seam produced can never present as legacy however few links its items carry
      // this is the only statement of that reasoning in the tree: verify.md states just the additive consequence (a CONTEXT with no ids yields no `criterion` values and those items report `untraced`) and defers the not-legacy argument to the code that decides it
      // declared and not parsed: the fifth term asks the classifier (`declaresIds`) and never `criteria.length`, which is not the same question, and reading one as the other let this gate pass a phase it never checked. Plain checkbox bullets, bolded ids, ids in headings and numbered or indented lists each parse to zero criteria while `context_issues` names the id in the same envelope, so a fieldless checklist beside any of them collected an exemption whose stated reason claimed the phase declared nothing. An id the grammar refused is still an id the author declared, and `'unknown'` (a near-miss heading whose section is never walked) isn't `'none'` either; only a provable `'none'` may exempt. Admitting those shapes into the grammar is a separate, still-deferred item
      if (classified.declaresIds === 'none') {
        legacy.push({ phase: p.n, reason: LEGACY_REASON });
        continue;
      }
      // one break for the phase, naming the file to repair: nine per-criterion `uncovered` breaks plus seventeen `untraced` entries are all symptoms of one missing marker, so both are suppressed and the phase's criteria are restored to `counts` instead of exempted out of them. It has to be a break, since `breaks` is the only verdict-moving key and an additive-only report would leave the gate as permeable as the exemption it replaces
      // it fires whatever the roadmap checkbox says, unlike `uncovered` and `missing-uat`, which work in flight legitimately passes through: `uat init` writes `fields_version` before it looks at a single item, so no phase is ever transiently fieldless and finishing the work doesn't repair it
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
      // untraced: no `criterion`, and no `origin` that declares the item has none; `origin: criterion` with no id is still untraced, since it names nothing and so proves nothing
      if (!ORIGIN_EXEMPT.has(String(it.origin))) {
        untraced.push({ phase: p.n, item: Number(it.k), name: String(it.name) });
      }
    }
    nCriteria += criteria.length;
    nCovered += covered.size;
    for (const c of criteria) {
      if (covered.has(c.id)) continue;
      nUncovered++;
      // an unchecked roadmap box means the phase hasn't reached verification yet, so its uncovered criteria are counted but never break: a gate run mid-cycle must not fail on work still in flight
      if (p.checked) breaks.push({ phase: p.n, id: c.id, break: 'uncovered' });
    }
  }

  ok({
    // first key and always present, a statement about the run and not an optional finding. Both halves are reported because neither is enough alone: mid-cycle the manifest names the last released version, so `uat_fields` is the half that doesn't lag, while `plugin` names what a user actually has installed
    // the skew this exists for is a modern seam reporting green over an old file. The opposite skew already fails loudly (an old planning.mjs has no `criteria-coverage` subcommand and returns `ok:false, reason:"usage"`); what had no signal was a stale `${CLAUDE_PLUGIN_ROOT}` cache silently downgrading this gate, so the plugin version the check runs against is recorded
    version: { plugin: pluginVersion(), uat_fields: UAT_FIELDS_VERSION },
    phases,
    ...(breaks.length ? { breaks } : {}),
    ...(untraced.length ? { untraced } : {}),
    ...(legacy.length ? { legacy } : {}),
    ...(unknownCriterion.length ? { unknown_criterion: unknownCriterion } : {}),
    ...(contextIssues.length ? { context_issues: contextIssues } : {}),
    // `criteria === covered + uncovered` holds by construction, and legacy phases are held out of these counts to preserve it, the same pinned identity as `audit`'s `total = traced + broken + deferred`. `uncovered` is the count and `breaks` is the subset whose phase box is checked, which is why the two can differ mid-cycle
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
