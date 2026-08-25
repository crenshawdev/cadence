// @ts-check
// planning/criteria-coverage.mjs - `criteria-coverage`: the CONTEXT acceptance
// criterion -> UAT item trace, as data.
//
// `ORIGIN_EXEMPT` and `LEGACY_REASON` are here because this is what reads them,
// which is D-06's named case: in the single-file layout both sat beside `audit`
// and following the layout would have filed them under the wrong command.
// `readCoverageContext` is single-use in the same way.
'use strict';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fail, ok, pluginVersion, read } from './core.mjs';
import {
  UAT_FIELDS_VERSION, classifyAcceptanceCriteria, parseRoadmapPhases, parseUat,
} from '../lib/planning-files.mjs';

// ---------------------------------------------------------------------------
// criteria-coverage - the CONTEXT acceptance criterion -> UAT item trace, as
// data. Proves the function is TOTAL: every criterion a phase declared reached
// that phase's checklist. `/cad-audit` folds this into its ONE verdict.
//
// A NEW subcommand rather than an extension of `audit` (D-08): audit's
// `counts` identity is pinned at :702-711 with a comment stating why, and
// audit.md section 4 filters `requirements[]` BY milestone id - a criterion
// break carries no requirement id to filter on, so an out-of-scope phase's
// break would block a ship it should not.
//
// The two directions are ASYMMETRIC (D-09): `breaks` is the only verdict-moving
// key; `untraced`, `legacy`, `unknown_criterion` and `context_issues` are
// additive. Four of four phases this cycle appended legitimate verifier gap
// items, so making the reverse direction breaking would make the gate
// unpassable.
//
// break codes: uncovered (a declared id no item covers) | missing-uat (a
// declared id on a phase carrying no checklist at all) | fieldless-checklist
// (ONE per phase, `{phase, break, file}`: the checklist carries items but none
// of the traceability fields, beside a CONTEXT that did declare ids - so nothing
// in it can be traced in either direction) | unreadable-context (ONE per phase,
// `{phase, break, code, file}`: the CONTEXT.md is there and could not be read,
// so the phase's criteria were never looked at). A `legacy` entry is `{phase,
// reason}`, never a bare phase number: an exemption that states no reason reads
// exactly like a clean pass, which is the skew D-04 wants readable.
// ---------------------------------------------------------------------------

// An `origin` value that declares an item legitimately built from no criterion.
// Mirrors UAT_ORIGINS in lib/planning-files.mjs minus `criterion`, which names
// no id by itself and therefore exempts nothing.
const ORIGIN_EXEMPT = new Set(['verifier', 'smoke']);

// The one sentence every `legacy` entry carries. Fixed rather than computed
// per phase: all of the terms hold identically for every phase the exemption
// reaches, so a per-phase string would differ only in wording while costing the
// reader a comparison. Naming the conditions is the point - the exemption is a
// modern seam reporting green over an old file, and a bare phase number gives a
// reviewer nothing to check it against.
const LEGACY_REASON = 'pre-field checklist: no `fields_version` frontmatter '
  + 'marker, no `criterion` or `origin` on any item, and its CONTEXT declares '
  + 'no AC<N> ids';

/**
 * `criteria-coverage`'s OWN CONTEXT.md reader (D-12).
 *
 * `read()` collapses every errno to `null`, so the D-10 exemption below could
 * not tell a phase whose CONTEXT was pruned away from one at `chmod 000` or
 * replaced by a directory - and the second answered `{"ok":true,"phases":[]}`
 * over criteria it had never looked at, which is precisely the shape of "the
 * gate passed a phase it never checked".
 *
 * Scoped to this ONE call site deliberately: `read()`'s 38 other callers sit
 * behind `|| ''` fallbacks, and widening the errno set there would turn a
 * permission problem into a break across `status`, `audit`, `plan-overlap`,
 * `plan-size` and `seed-reqs` all at once.
 * `code` is the refusal: null when the file was read AND when it is genuinely
 * absent (ENOENT alone keeps the exemption - absent really is nothing to
 * prove), the errno otherwise, with `text` null on both of those arms.
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
  // The same phase list `cmdAudit` walks - no new source of truth for which
  // phases exist. `milestone.md` step 3 prunes completed phases out of the live
  // `## Phases` list, so this only ever holds the current cycle's phases.
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
    // A CONTEXT that EXISTS and could not be read is a break, never D-10's
    // exemption below: the phase's criteria were not proven absent, they were
    // never read. `breaks` is the only verdict-moving key in this envelope, the
    // same reasoning the `fieldless-checklist` break states - and like it (and
    // unlike `uncovered`) it fires whatever the roadmap checkbox says, because
    // an unreadable file is never a transient state of work in flight.
    if (context.code !== null) {
      breaks.push({ phase: p.n, break: 'unreadable-context', code: context.code,
        file: `phases/${p.n}/CONTEXT.md` });
      continue;
    }
    const contextText = context.text;
    const uatText = read(join(pdir, 'UAT.md'));
    // An absent CONTEXT.md is nothing to prove (D-10): CONTEXT is a documented
    // optional artifact, and `milestone.md` runs this gate at step 1 while the
    // prune that DELETES phase dirs runs at step 3, so a prior milestone's
    // pruned phase must never make the gate unpassable. The prune removes the
    // whole directory, so it always takes CONTEXT with it - which is why this
    // arm, and not the UAT one below, is where D-10's exemption belongs.
    if (contextText === null) continue;

    const classified = classifyAcceptanceCriteria(contextText);
    // `criteria: null` is an absent heading - "nothing declared", not a
    // problem. Coerced to [] here because the phase's CONTEXT exists, so it
    // still reports its `phases[]` entry and its items still trace (to nothing,
    // which is `untraced`'s additive job).
    const criteria = classified.criteria || [];
    if (classified.issues.length) contextIssues.push({ phase: p.n, issues: classified.issues });

    // CONTEXT present, UAT.md absent. Exempting this the way a pruned phase is
    // exempted left the gate's one load-bearing direction with an unnamed hole:
    // a checked phase that declared criteria and never got a checklist is the
    // total drop this subcommand exists to catch, and it reported nothing at
    // all. Every declared criterion counts uncovered, and on a CHECKED box each
    // one breaks as `missing-uat` - the same unchecked-box rule as below, so a
    // phase still in flight is counted and never breaks.
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
    // `fieldless` is the FILE-shaped half of the old legacy test (D-16): a
    // non-empty checklist carrying no `fields_version` marker and no traceability
    // field on any item. An EMPTY checklist is not fieldless - an empty checklist
    // is the drop itself, so its criteria all break below.
    //
    // The marker is what this tests, not the item fields. The original
    // conjunction (no `criterion` AND no `origin`) reasoned that every post-field
    // checklist carries at least one `origin`, and that premise was false the day
    // it shipped: `.planning/phases/3/UAT.md` carries 7 `criterion` lines and 0
    // `origin` lines, so a `/cad-verify` that silently stopped emitting
    // `criterion` on a phase-3-shaped checklist read as "an old project" and the
    // gate stayed green forever - exactly the regression this subcommand exists
    // to catch.
    const fieldless = items.length > 0 && uat.fm.fields_version === undefined
      && withCriterion.length === 0 && withOrigin.length === 0;
    if (fieldless) {
      // Legacy is now FIVE terms, the fifth being D-01's: the phase's CONTEXT
      // declares no `AC<N>` ids. The AC-id grammar (`5a3327a`) and
      // `fields_version` (`fd31c04`) both shipped after `v1.5.0`, so no CONTEXT
      // carrying AC ids can predate the fields - which makes a fieldless
      // checklist beside declared ids a DROPPED LINK, not an old file. `uat init`
      // writes `fields_version` unconditionally, so a file this seam produced
      // can never present as legacy however few links its items carry.
      //
      // This is the ONLY statement of that reasoning in the tree (v2.6.2):
      // `workflows/verify.md` states just the additive consequence - a CONTEXT
      // with no `AC<N>` ids yields no `criterion` values and those items report
      // `untraced` - and defers the not-legacy argument here, to the code that
      // decides it.
      //
      // DECLARED, not parsed - the fifth term asks the classifier
      // (`declaresIds`), never `criteria.length`. Those two are not the same
      // question, and reading the second as the first is what let this gate
      // pass a phase it never checked: `- [ ] AC1 the feature works`,
      // `- [ ] **AC1**: x`, `- AC1: x`, `* [ ] AC1: x`, `### AC1: x`,
      // `1. AC1: x` and an indented bullet each parse to ZERO criteria while
      // `context_issues` names the id in the same envelope, so a fieldless
      // checklist beside any of them collected an exemption whose stated reason
      // asserted the phase declared nothing. An id this grammar REFUSED is
      // still an id the author declared, and `'unknown'` (a near-miss heading,
      // whose section is never walked) is not `'none'` either. Only a provable
      // `'none'` may exempt. Widening the grammar to ADMIT those shapes is a
      // separate, still-deferred item; this only stops the exemption inheriting
      // the gap.
      if (classified.declaresIds === 'none') {
        legacy.push({ phase: p.n, reason: LEGACY_REASON });
        continue;
      }
      // ONE break for the phase (D-02), naming the file to repair. Nine
      // per-criterion `uncovered` breaks plus seventeen `untraced` entries are
      // all symptoms of one missing marker, so both are suppressed here and the
      // phase's criteria are restored to `counts` instead of exempted out of
      // them. It has to be a BREAK: `breaks` is the only verdict-moving key, so
      // an additive-only report would leave the gate exactly as permeable as the
      // exemption it replaces.
      //
      // It fires REGARDLESS of the roadmap checkbox, deliberately unlike
      // `uncovered` and `missing-uat`. Those two are box-gated because work in
      // flight legitimately passes through them; this one is not, because `uat
      // init` writes `fields_version` before it looks at a single item. No phase
      // is ever transiently fieldless, and finishing the work does not repair it.
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
        // An item COVERS the id in its `criterion` field.
        if (declared.has(id)) covered.add(id);
        else unknownCriterion.push({ phase: p.n, item: Number(it.k), criterion: id });
        continue;
      }
      // Untraced: no `criterion`, and no `origin` that declares the item has
      // none. `origin: criterion` with no id is still untraced - it names
      // nothing, so it proves nothing.
      if (!ORIGIN_EXEMPT.has(String(it.origin))) {
        untraced.push({ phase: p.n, item: Number(it.k), name: String(it.name) });
      }
    }
    nCriteria += criteria.length;
    nCovered += covered.size;
    for (const c of criteria) {
      if (covered.has(c.id)) continue;
      nUncovered++;
      // An UNCHECKED roadmap box means the phase has not reached verification
      // yet, so its uncovered criteria are counted but never break: a gate run
      // mid-cycle must not FAIL on work still in flight.
      if (p.checked) breaks.push({ phase: p.n, id: c.id, break: 'uncovered' });
    }
  }

  ok({
    // FIRST key, and always present: a statement about the run, not an optional
    // finding. BOTH halves are reported (D-03) because neither is sufficient
    // alone - mid-cycle the manifest names the last RELEASED version (`2.0.0`
    // today, on a tree running v2.1.0-dev code), so `uat_fields` is the half
    // that does not lag, while `plugin` is the half that names what a user
    // actually has installed.
    //
    // The skew this exists for is a MODERN seam reporting green over an old
    // file (D-04). The opposite skew already fails loudly: `v1.5.0`'s
    // planning.mjs has no `criteria-coverage` subcommand at all, so an old seam
    // returns `ok:false, reason:"usage"` rather than a quiet pass. What had no
    // signal was a stale `${CLAUDE_PLUGIN_ROOT}`-resolved cache silently
    // downgrading this gate, which is the unclosed half of phase 5's human
    // verify: record the plugin version the check runs against.
    version: { plugin: pluginVersion(), uat_fields: UAT_FIELDS_VERSION },
    phases,
    ...(breaks.length ? { breaks } : {}),
    ...(untraced.length ? { untraced } : {}),
    ...(legacy.length ? { legacy } : {}),
    ...(unknownCriterion.length ? { unknown_criterion: unknownCriterion } : {}),
    ...(contextIssues.length ? { context_issues: contextIssues } : {}),
    // `criteria === covered + uncovered` holds by construction, and it is what
    // legacy phases are held OUT of these counts to preserve - the same pinned
    // identity `audit`'s `total = traced + broken + deferred` carries above.
    // `uncovered` is the count; `breaks` is the subset of it whose phase box is
    // checked, which is why the two can differ mid-cycle.
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
