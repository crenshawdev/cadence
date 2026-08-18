#!/usr/bin/env node
// @ts-check
// route.mjs - zero-dep routing resolver. Given an agent role and an attempt
// number, resolve the whole quality bundle the spawn-agent seam and the review
// subsystem need: {model, effort, review, verify}. The route-table.json beside
// ../route-table.json is editable data (five grids); this file is the logic.
// DESIGN "model routing" (§ model routing).
//
// The question the table asks is what a break COSTS, not what a dispatch costs:
// the project's stakes level picks the row, and the role picks the cell in it.
// One question in, four knobs out - because quality is not one dial, and effort
// alone cannot express "fire a blocking cross-model review".
//
// Never blocks the spine: on any problem it returns {ok:false,...} and the
// caller dispatches the base agent at the session-default model (no override).
//
// Subcommands (one JSON line on stdout):
//   resolve --role <name> [--attempt N] [--file <config>] [--phase N]
//           [--bracket-read <csv> [--bracket-plan <key>]]
//     With --bracket-read, resolve also writes the worker's lifecycle DISPATCH
//     event (family lifecycle, event dispatch, plan/role/read) before resolving,
//     so a dispatch site pays one seam call instead of two. The CLOSE half
//     (return/checkpoint, --tokens) stays with the caller, which alone sees it.
//   table                                  dump the routing table
//
// Config is layered: a global file (see GLOBAL_CONFIG below) provides defaults,
// the per-repo --file (default .planning/config.json) overrides it, and the
// built-in DEFAULTS backstop both. Precedence: repo > global > defaults.
// Config keys read:
//   stakes                     solo | shipped | critical
//   model.escalate_on_failure  re-dispatch a failed attempt at the retry rung
//                              its own cell names (bool, every stakes level)
//   model.overrides.<role>     pin one role to a model alias, bypassing the cell
//   model.effort.<role>        the rung one role STARTS at, replacing the one
//                              its cell names - never below a computed risk
//                              floor, and never demoted by a retry
//   review.triggers.*.gate     a gate a LAYER set, which must be one of the
//                              table's `gates` and then wins over the level's
//                              gate, reporting the disagreement (D-04); a value
//                              outside that vocabulary loses to the level's gate
//                              and is named in `warnings`
//   review.reviewers           the reviewer backends the fire may go to, which
//                              `resolve` filters per trigger by availability
//                              into the `reviewers` map beside `review`
//   review.triggers.*.tier     the model tier that trigger's cross-model half
//                              runs at, which is also what its availability
//                              test reads, falling back to the LEVEL's row of
//                              the table's `tiers` grid (never to the schema
//                              default, D-04); returned as `reviewer_tiers`
//   review.triggers.*.effort   the reasoning effort that trigger's cross-model
//                              half runs at, falling back to the level's row of
//                              the table's `efforts` grid on the same terms;
//                              returned as `reviewer_efforts`. Both fields are
//                              level-dependent (RVW-03), so raising `stakes`
//                              moves the cross-model half of a panel and not
//                              the subagent half alone
//   review.providers.*.tiers.* the model id a provider is configured with per
//                              tier - a provider with none at the resolved tier
//                              is unavailable, is dropped, and says so in
//                              `warnings`
//   review.triggers.risk_surface.surfaces
//                              the categories the risk_surface fire is scoped
//                              to, returned as `surfaces`. Absent from both
//                              layers means ALL of the table's
//                              `risk_surface_categories`, and
//                              `surfaces_answered` says which of the two it is,
//                              so "chose everything" and "never answered" stay
//                              apart (D-12)
//
// THERE IS NO RISK FLOOR, and this is not the file that computes one. The
// stakes level a config layer set is the baseline and the whole of it: nothing
// here reads a plan's `files:` list, `route-table.json` carries no `surfaces`
// block for one to be matched against, and the `risk.override.<surface>` waiver
// family is retired (lib/retired-keys.mjs) along with the dispatch-time floor
// that gave it something to lower. That floor judged a file by its NAME and
// raised a whole phase on one path token - `tests/ingest_concurrency.rs` took
// six roles to their top rung - which is what it cost, and why the record of it
// outlives it here.
//
// So the `risk_surface_categories` block in route-table.json and the
// `review.triggers.risk_surface.surfaces` key this file now reads are NOT that
// floor returning under a new name. They scope ONE review trigger's fire, which
// is read off the DIFF at the fire site (references/review-triggers.md), and
// they move no role's model and no role's rung. `--phase` is likewise not a
// floor input: it names the phase a resolve's routing event is recorded under,
// and a resolve with no usable phase still returns the whole bundle with
// ok:true.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mergeLayers } from './lib/config-merge.mjs';
import { rungFile, RUNG_FILES } from './lib/rung-agent.mjs';
import { retiredKeysIn } from './lib/retired-keys.mjs';
import { emit as out, DONE } from './lib/seam-io.mjs';
import { requireInt, requirePhaseArg } from './lib/require-int.mjs';
import { cursorPhase } from './lib/phase-plans.mjs';
import { appendEvent } from './lib/trace.mjs';
import { testSeamOpen } from './lib/test-seam.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
// TABLE is loaded lazily, inside the dispatch try block below, so a missing
// or malformed shipped route-table.json degrades to {ok:false} instead of
// crashing at import time. CADENCE_ROUTE_TABLE overrides the path ONLY when
// the `CADENCE_TEST_SEAM` sentinel holds (lib/test-seam.mjs); without it the
// variable is ignored and the shipped file is read, silently - this constant
// resolves at module load, before any dispatch exists to carry a warning. The
// gate is the point: this table sets every review trigger's gate, so an
// ungated override turns a blocking gate off.
let TABLE;
const TABLE_PATH = (testSeamOpen() && process.env.CADENCE_ROUTE_TABLE)
  || join(HERE, '..', 'route-table.json');
const fail = (reason, detail) => { out({ ok: false, reason, detail }); throw DONE; };

// Config defaults mirror config.schema.json so a missing/partial config still routes.
const DEFAULTS = { stakes: 'shipped', escalate_on_failure: false,
  reviewers: ['claude-subagent'] };

// The accepted `review.triggers.<t>.gate` vocabulary, used ONLY when the table
// carries no usable `gates` array. Never skip the check on an absent list:
// skipping leaves the hole open on exactly the tables most likely to be wrong -
// an older or hand-edited route-table.json, or one injected through
// CADENCE_ROUTE_TABLE - so a `"blockign"` typo would still reach the bundle
// intact on the very input shape the check exists to cover.
const DEFAULT_GATES = ['off', 'advisory', 'blocking', 'adjudicated'];

// The `--phase` shape rule lives in ONE place (`lib/require-int.mjs`'s
// `requirePhaseArg`, imported above), not in a local regex per script: three
// independent copies is how the same input came to be refused in three
// different wordings, and how the directory component came to be normalized on
// some surfaces and not others.

// Resolve the effective config from global + repo layers (repo wins, via the
// shared merge lib), falling back to DEFAULTS for anything unset. _source
// names the layers that applied, `stakesSet` says whether any layer actually
// carried the key (a default must never be reported as a configured value),
// and _warnings carries what the read found wrong but did not block on: a
// layer that failed to parse, and any key v2.0.0 retired.
function readConfig(file) {
  const { config: c, source, warnings } = mergeLayers(file);
  const m = c.model || {};
  return {
    stakes: c.stakes ?? DEFAULTS.stakes,
    stakesSet: c.stakes !== undefined && c.stakes !== null,
    escalate_on_failure: m.escalate_on_failure ?? DEFAULTS.escalate_on_failure,
    overrides: m.overrides ?? {},
    // Its own map, not folded into `overrides` above: that one is
    // read as `cfg.overrides[opts.role]` for the per-role MODEL pin, so a config
    // carrying both a pin and a start rung would have two writers fighting over
    // one entry - and a start rung read as a model alias would be reported as an
    // unknown alias rather than honoured.
    effort: m.effort ?? {},
    triggerGates: triggerFieldIn(c, 'gate'),
    // The per-trigger model TIER, read the same way and for the same reason:
    // it is the input to the reviewer-availability test below, and a schema
    // default read here would report an availability answer as the user's.
    triggerTiers: triggerFieldIn(c, 'tier'),
    // The per-trigger cross-model EFFORT, the tier's other half (RVW-03).
    // Read through the same generic reader for the third time and for the same
    // reason: the level's `efforts` row answers it when no layer did, and a
    // schema default read here would report the seam's own answer as the
    // user's. Nothing else about it resembles the envelope's `effort`, which
    // is the agent RUNG this dispatch runs at.
    triggerEfforts: triggerFieldIn(c, 'effort'),
    // `review.triggers.risk_surface.surfaces` - the categories the one blocking
    // trigger is scoped to. Read through the same reader for the same reason
    // again: config.schema.json's default for this key is `null` precisely so
    // "nobody has answered" stays a distinguishable state (D-12), and reading a
    // default here would erase it.
    triggerSurfaces: triggerFieldIn(c, 'surfaces'),
    // The configured reviewer SET, or null when no layer named a usable one -
    // DEFAULTS.reviewers backstops it below, the way DEFAULTS backstops every
    // other unset key.
    reviewers: reviewersIn(c),
    // `review.providers.<name>.tiers.<tier>` - the model id a provider is
    // configured with per tier, which is what "available" means for a
    // cross-model reviewer.
    providers: providersIn(c),
    _source: source,
    _warnings: [...(warnings || []), ...retiredKeysIn(c)],
  };
}

// One field of `review.triggers.<name>.*` that a LAYER actually wrote, keyed by
// trigger name (`gate` for the gate grid, `tier` for the availability test).
// mergeLayers merges the two FILE layers only and never folds in a schema
// default, so everything this returns is a user assertion - which is the whole
// reason D-04 can let a gate win over the level's gate, and the reason the tier
// this feeds may decide a fallback. Reading a default here would turn "the
// schema says advisory" into "the user asked for advisory" and the grid would
// decide nothing; the same read on `tier` would turn "the schema says flagship"
// into a user assertion and report the seam's own answer as the config's.
// Defensive at every hop: this runs on whatever a user's config happens to
// hold, and a scalar where an object belongs contributes nothing rather than
// throwing.
function triggerFieldIn(c, field) {
  const out = {};
  const triggers = (c && typeof c === 'object' ? (c.review || {}) : {}).triggers;
  if (!triggers || typeof triggers !== 'object' || Array.isArray(triggers)) return out;
  for (const [name, spec] of Object.entries(triggers)) {
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) continue;
    if (spec[field] !== undefined && spec[field] !== null) out[name] = spec[field];
  }
  return out;
}

// The reviewer backends a layer named, or null when none did. Non-strings are
// dropped rather than carried into the availability test, where they would be
// looked up as a provider name; a value that is not a usable list at all reads
// as unset, and DEFAULTS.reviewers backstops it the way DEFAULTS backstops
// every other unset key.
function reviewersIn(c) {
  const list = (c && typeof c === 'object' ? (c.review || {}) : {}).reviewers;
  if (!Array.isArray(list)) return null;
  const names = list.filter((x) => typeof x === 'string' && x);
  return names.length ? names : null;
}

// The provider blocks, defensively: `review.providers.<name>.tiers` is a map of
// tier -> model id, and anything else contributes no model id (which reads as
// unavailable) rather than throwing.
function providersIn(c) {
  const p = (c && typeof c === 'object' ? (c.review || {}) : {}).providers;
  return p && typeof p === 'object' && !Array.isArray(p) ? p : {};
}

// The model id one provider is configured with at one tier, or '' for none.
// An empty string is deliberately NOT a model id: a `""` in a config is a key
// somebody cleared, and dispatching a provider call with an empty model is the
// silent-substitution shape RVW-02 opened against.
function providerModel(providers, name, tier) {
  if (!tier) return '';
  const block = providers[name];
  const tiers = block && typeof block === 'object' && !Array.isArray(block) ? block.tiers : null;
  const id = tiers && typeof tiers === 'object' && !Array.isArray(tiers) ? tiers[tier] : null;
  return typeof id === 'string' && id.trim() ? id : '';
}

function resolve(opts) {
  // The planning root and the trace phase, derived ONCE for both events this
  // resolve may write: `--phase` when it parses, the cursor otherwise, and with
  // neither in hand nothing is recorded - an event keyed to no phase joins
  // nothing, and the id it would derive is the empty string.
  const planningRoot = dirname(opts.file);
  let tracePhase = null;
  try {
    const parsed = requirePhaseArg(opts.phase);
    tracePhase = opts.phase !== undefined && parsed.ok
      ? parsed.raw
      : cursorPhase(planningRoot);
  } catch { /* a record of a decision may never change the decision */ }

  // The dispatch half of the worker's lifecycle bracket (`--bracket-read` is
  // the switch; `--bracket-plan` the worker key, defaulting to the role). It is
  // written HERE, before any resolution, because the caller dispatches on every
  // arm of this command - a degraded resolve falls back to the base agent, and
  // a bracket gated on ok:true would leave exactly those dispatches unpaired.
  // The close half stays with the caller: only it sees the return and its token
  // figure. Best effort like the routing event below - `appendEvent` never
  // throws, and a bracket that could not be written changes no envelope byte.
  // (The one unbracketed arm is a route-table that failed to PARSE: that fails
  // before argument dispatch, so the caller's close then shows as unpaired in
  // `trace render` - which is signal, not noise, on an arm that rare.)
  if (opts.bracketRead && tracePhase !== null) {
    try {
      const read = opts.bracketRead.split(',').map((s) => s.trim()).filter(Boolean);
      appendEvent(planningRoot, {
        phase: tracePhase,
        family: 'lifecycle',
        event: 'dispatch',
        plan: opts.bracketPlan || opts.role,
        role: opts.role,
        ...(read.length ? { read } : {}),
      });
    } catch { /* same rule */ }
  }

  // Read the config BEFORE the role check, not after (D-04). `unknown-role`
  // used to return without any layer being read, so a config holding a retired
  // key answered a mistyped role with nothing about the key that is redirecting
  // every OTHER dispatch in the project - the breaking-change notice sitting
  // unread in JSON while a stale config routes.
  const cfg = readConfig(opts.file);

  // The declared role list, not a lookup in a spec object: a role IS routable
  // or it is not, and after this phase the table carries no per-role block for
  // the question to be asked of.
  const roles = Array.isArray(TABLE.roles) ? TABLE.roles : [];
  if (!roles.includes(opts.role)) {
    out({ ok: false, reason: 'unknown-role', role: opts.role,
      detail: `known roles: ${roles.join(', ')}`,
      ...(cfg._warnings.length ? { warnings: cfg._warnings } : {}) });
    return;
  }

  // An honest first reason: `config:<layers>` is a claim that a layer supplied
  // the value, so a default that no layer carried says so instead. Reporting
  // `config:repo` for a value the repo file never held is how a retired key
  // reads as a configured one.
  const reason = [cfg.stakesSet
    ? `config:${cfg._source}`
    : `stakes default "${cfg.stakes}" (unset in layers: ${cfg._source})`];

  // `warnings` is an ARRAY (matching config.mjs get): a torn config layer, a
  // retired key, an unreadable PLAN, a gate disagreement and an unknown pin
  // alias can all be true at once. Built before the floor so the floor's own
  // diagnostics ride on it.
  const warnings = [...cfg._warnings];

  // The stakes LEVEL for this dispatch: the configured baseline, full stop.
  // All four knobs come from the floored row through the one cell grid.
  const stakes = cfg.stakes;

  // The three grids a torn LEVEL is fatal in (D-01). `model`, `effort` and
  // `retry` come from ONE cell keyed on (level, role); `review` keys on
  // (level, trigger) because a gate belongs to a trigger, not to an agent;
  // `verify` keys on the level alone because deep_check runs once per phase
  // with no role in hand. A level missing any of the three is a TORN table, so
  // it degrades the same way a bad stakes value already does rather than
  // emitting a partial bundle - half a bundle read as a whole one is worse than
  // no bundle at all.
  //
  // The table's other two grids - `tiers` and `efforts`, which key on (level,
  // trigger) since RVW-03 - are deliberately NOT in this guard. They answer the
  // cross-model half of a review panel, and a level missing one of them still
  // yields a whole routing bundle: the trigger's entry resolves `null`, the
  // availability test drops the provider with its cause in `warnings[]`, and
  // CI catches the hole (self-verify check 8). Refusing the bundle for them
  // would take the spine down over a field the spine does not use.
  const level = TABLE.cells && TABLE.cells[stakes];
  const cell = level && typeof level === 'object' && !Array.isArray(level) ? level[opts.role] : null;
  const reviewRow = TABLE.review && TABLE.review[stakes];
  const verify = TABLE.verify ? TABLE.verify[stakes] : undefined;
  if (!cell || typeof cell !== 'object' || Array.isArray(cell)
    || !reviewRow || typeof reviewRow !== 'object' || Array.isArray(reviewRow)
    || verify === undefined) {
    // The live array, not `cfg._warnings`: by here it also carries the floor's
    // own diagnostics (an unreadable PLAN, a malformed waiver, a `--phase` out
    // of shape). Dropping them made a torn table answer with the ONE thing the
    // caller cannot act on and none of the things it can.
    out({ ok: false, reason: 'unresolved', role: opts.role, stakes,
      ...(warnings.length ? { warnings } : {}) }); return;
  }

  // The agent FILE is what carries the effort (route.mjs reports effort, it
  // cannot set it - seams.md), and the unsuffixed file is one rung among the
  // others, so the file comes from the explicit map in lib/rung-agent.mjs
  // rather than from a naming convention. Fail-open by design: a rung the map
  // does not carry is self-verify's problem, and this still dispatches - at the
  // unsuffixed file, saying it did, rather than naming a file that is not there.
  const agentFor = (rung) => {
    const stem = rungFile(opts.role, rung);
    if (stem) return stem;
    reason.push(`rung "${rung}" maps to no agent file; dispatching ${opts.role}`);
    return opts.role;
  };

  let effort = cell.effort;

  // The configured START rung (RNG-02). `model.effort.<role>` selects the rung
  // this role begins at, replacing the cell's - the dial the ladder was missing,
  // living in the config LAYERS so a plugin update cannot take it away. Exactly
  // one of four arms fires, and each one SAYS what it did: a rung that silently
  // did not apply is the resolved-then-dropped shape this milestone closes.
  const wanted = cfg.effort[opts.role];
  let startFromConfig = false;
  if (wanted !== null && wanted !== undefined) {
    const key = `model.effort.${opts.role}`;
    const has = Object.keys(RUNG_FILES[opts.role] || {});
    if (!rungFile(opts.role, wanted)) {
      // (a) A rung this role has no FILE for - only a hand-edited config gets
      // past the schema enum. Never hand it to agentFor: that fails open to the
      // base file while `effort` still reports the requested rung, which is the
      // report-a-rung-nothing-ran-at shape `rungEffortIssue` exists to close.
      warnings.push(`${key}=${JSON.stringify(wanted)} names no rung this role has `
        + `(${has.join(', ')}); the ${stakes}/${opts.role} cell's "${effort}" rung stands`);
    } else if (wanted === effort) {
      reason.push(`${key}="${wanted}" (already the routed rung)`);
    } else {
      // (d) The configured rung wins.
      reason.push(`${key}: ${effort} -> ${wanted} (config, wins over the `
        + `${stakes}/${opts.role} cell)`);
      effort = wanted;
      startFromConfig = true;
    }
  }

  let agent = agentFor(effort);
  let escalated = false;

  // Escalation is unconditional: a failed attempt climbs to the rung its OWN
  // cell names, at EVERY stakes level. Gating it behind a routing mode is what
  // left the rung ladder unreachable on a default install; a fixed per-role
  // target beside a cell that also sets effort is what let five of six roles
  // resolve their escalation to a no-op (D-02).
  if ((opts.attempt || 1) > 1) {
    if (cfg.escalate_on_failure) {
      // max(cell.retry, the rung this attempt actually STARTED at) in
      // `rung_order` (D-02): a retry never thinks LESS than the attempt that
      // just failed. lib/route-cells.mjs refuses that inversion inside the
      // TABLE (`rung-demotion`); a configured start rung is the second door onto
      // it, and an xhigh start stepping down to a `high` retry while reporting
      // an escalation is the same defect wearing the config layer's clothes.
      // A rung either index cannot place falls back to `cell.retry` VERBATIM
      // when the start rung is the CELL's own - the pre-phase behavior, where a
      // demotion needs an in-table `rung-demotion` CI catches. A start rung the
      // CONFIG raised is different: swapping it for an incomparable `cell.retry`
      // could demote the retry below the rung that just failed while reporting
      // an escalation, so an unprovable comparison holds the configured start
      // and says why.
      const rungOrder = Array.isArray(TABLE.rung_order) ? TABLE.rung_order : [];
      const ri = rungOrder.indexOf(cell.retry);
      const si = rungOrder.indexOf(effort);
      const torn = ri < 0 || si < 0;
      if (torn && startFromConfig && cell.retry !== effort) {
        warnings.push(`rung_order cannot compare the configured "${effort}" start with `
          + `the ${stakes}/${opts.role} retry rung "${cell.retry}"; the configured start stands`);
      }
      const target = torn
        ? (startFromConfig ? effort : cell.retry)
        : (si > ri ? effort : cell.retry);
      if (target && target !== effort) {
        escalated = true;
        agent = agentFor(target);
        reason.push(`rung ${effort}->${target} (${agent})`);
        effort = target;
      } else if (cell.retry === effort) {
        // Honest no-op, two causes told apart: a cell whose retry IS its
        // starting rung has nothing to climb to - but when the CONFIG raised
        // the start onto the retry rung, the cell's own start was lower and
        // "retry rung is the same rung" would misattribute the hold to cell
        // design (the conflation route.test.mjs pins the messages apart for).
        if (startFromConfig && cell.effort !== effort) {
          reason.push(`rung held at ${effort}: model.effort.${opts.role}="${effort}" `
            + `already sits at the ${stakes}/${opts.role} retry rung`);
        } else {
          reason.push(`rung held at ${effort} (retry rung is the same rung)`);
        }
      } else {
        // Held because the START rung out-ranks the cell's retry rung. Says
        // WHICH rung it out-ranked, so a held retry stays diagnosable rather
        // than reading like the equal-rungs case above.
        const source = effort === wanted
          ? `model.effort.${opts.role}="${effort}"`
          : `the "${effort}" start rung`;
        // On a torn table the out-ranking is exactly what could NOT be proven -
        // the warning above already names rung_order, so the reason must not
        // assert a comparison nothing performed.
        reason.push(torn
          ? `rung held at ${effort}: ${source} stands - rung_order cannot place the `
            + `${stakes}/${opts.role} retry rung "${cell.retry}"`
          : `rung held at ${effort}: ${source} out-ranks the `
            + `${stakes}/${opts.role} retry rung "${cell.retry}"`);
      }
    } else {
      reason.push(`rung held at ${effort} (model.escalate_on_failure: false)`);
    }
  }

  // Config-wins precedence (D-04): a `review.triggers.<t>.gate` a layer SET
  // beats the level's gate, and the disagreement is spoken rather than
  // resolved silently. Level-wins was rejected because it makes a key the user
  // explicitly set stop doing anything, which is the resolved-then-dropped
  // defect this milestone exists to close. The walk is over the LEVEL's row, so
  // a trigger name no level names contributes no gate and no warning - naming
  // the accepted set is config.mjs validate's job, not a dispatch's.
  //
  // A gate must be one of the table's accepted values BEFORE it can win. This
  // adds a validity check in front of that precedence and changes no part of it:
  // a valid gate that disagrees still wins and still warns. Without it a
  // one-character typo (`"blockign"`) silently replaced `critical`'s
  // deliberately-blocking `risk_surface` gate - a silent lowering of the very
  // signal the risk floor rides on.
  const gateNames = Array.isArray(TABLE.gates) && TABLE.gates.length
    && TABLE.gates.every((g) => typeof g === 'string') ? TABLE.gates : DEFAULT_GATES;
  const review = {};
  for (const [trigger, levelGate] of Object.entries(reviewRow)) {
    const configured = cfg.triggerGates[trigger];
    if (configured !== undefined && configured !== levelGate) {
      if (!gateNames.includes(configured)) {
        // Same treatment an unknown model alias gets: name it, let the routed
        // value stand, never block the spawn.
        review[trigger] = levelGate;
        warnings.push(`review.triggers.${trigger}.gate=${JSON.stringify(configured)} is not one of `
          + `[${gateNames.join(', ')}]; the ${stakes} level gate "${levelGate}" stands`);
        continue;
      }
      review[trigger] = configured;
      warnings.push(`review.triggers.${trigger}.gate="${configured}" (config) wins over the ${stakes} level gate "${levelGate}"`);
    } else {
      review[trigger] = levelGate;
    }
  }

  // The OTHER half of a fire (RVW-02). The gate map above says whether a
  // trigger fires; this says WHO it fires to, resolved by the seam instead of
  // by prose at the fire site - the shape that let a blocking risk_surface
  // review go to a same-model subagent on 2026-08-13 with `review.reviewers`
  // set to `openai` and nothing recording the substitution.
  //
  // Its own top-level field, never folded into `review` (D-05): that map's
  // values are gate STRINGS, and turning each into an object would break every
  // reader of the wiring table at once.
  //
  // Availability, per trigger: `claude-subagent` is always available (it is a
  // subagent dispatch, not a provider call); any other name needs a model id at
  // the tier THIS trigger resolves at - the layer's `review.triggers.<t>.tier`
  // when a layer set one, else the LEVEL's row of the table's hand-maintained
  // `tiers` grid (D-04: never config.schema.json's default, which would report
  // the schema's answer as the user's). An empty set falls back to
  // `claude-subagent`, because a blocking trigger with no reviewer is a gate
  // that silently stops gating.
  //
  // Detection, not prevention (D-07): nothing here refuses a dispatch to a
  // reviewer outside this set. The set plus the `reviewer` field on the
  // lifecycle event are what make a substitution visible afterwards.
  //
  // The tier and the effort are RESOLVED here and RETURNED (RVW-03), not merely
  // consumed by the availability test: they are the two fields that reach a
  // cross-model provider call, and before this they were read at the fire site
  // from a config key no layer sets - so the level moved the subagent half of a
  // panel and left the cross-model half on a value nothing resolved. Both ride
  // their own top-level maps beside `reviewers` for the reason `reviewers`
  // itself does (D-05): `review`'s values are gate STRINGS, and turning each
  // into an object would break every reader of the wiring table at once.
  //
  // `reviewer_efforts`, never `efforts`: the envelope already carries a
  // top-level `effort`, which is the agent RUNG this dispatch runs at. These
  // are per-trigger provider-request efforts and are a different quantity, so
  // the names are kept far enough apart that a reader cannot take one for the
  // other.
  const wantedReviewers = cfg.reviewers ?? DEFAULTS.reviewers;
  const levelRow = (grid) => {
    const g = TABLE[grid];
    const row = g && typeof g === 'object' && !Array.isArray(g) ? g[stakes] : null;
    return row && typeof row === 'object' && !Array.isArray(row) ? row : {};
  };
  const tableTiers = levelRow('tiers');
  const tableEfforts = levelRow('efforts');
  const reviewers = {};
  /** @type {Record<string, any>} */
  const reviewerTiers = {};
  /** @type {Record<string, any>} */
  const reviewerEfforts = {};
  for (const trigger of Object.keys(review)) {
    const setTier = cfg.triggerTiers[trigger];
    const tier = setTier !== undefined ? setTier : tableTiers[trigger];
    const tierFrom = setTier !== undefined
      ? `review.triggers.${trigger}.tier`
      : `route-table.json's tiers row for ${stakes}`;
    const setEffort = cfg.triggerEfforts[trigger];
    const effortFor = setEffort !== undefined ? setEffort : tableEfforts[trigger];
    // `null`, never a dropped key: a missing entry in a map the fire site
    // indexes reads as "this trigger has no answer", and an absent key and an
    // unresolved one must not be the same shape to a caller.
    reviewerTiers[trigger] = tier ?? null;
    reviewerEfforts[trigger] = effortFor ?? null;
    const kept = [];
    const dropped = [];
    for (const name of wantedReviewers) {
      if (name === 'claude-subagent') { kept.push(name); continue; }
      if (providerModel(cfg.providers, name, tier)) { kept.push(name); continue; }
      dropped.push(tier
        ? `${name} has no model id at the "${tier}" tier `
          + `(review.providers.${name}.tiers.${tier}, tier from ${tierFrom})`
        : `${name} cannot be placed: the ${trigger} trigger resolves no tier `
          + `(no config layer set one and route-table.json's tiers grid names none `
          + `for ${stakes})`);
    }
    // The cause travels IN the return, never left to be inferred from a set
    // that is smaller than the one the user configured. One warning per
    // trigger, since the tier - and so the answer - is per trigger.
    if (kept.length && dropped.length) {
      warnings.push(`${trigger}: ${dropped.join('; ')}; dropped from the reviewer set, `
        + `leaving [${kept.join(', ')}]`);
    } else if (!kept.length) {
      warnings.push(`${trigger}: no configured reviewer is available `
        + `(${dropped.join('; ')}); falling back to claude-subagent`);
    }
    reviewers[trigger] = kept.length ? kept : ['claude-subagent'];
  }

  // The THIRD half of a fire (CST-02). The gate says whether `risk_surface`
  // fires and `reviewers` says who to, and this says on WHAT: a heuristic match
  // in a category outside the resolved set does not fire the trigger. Resolved
  // here rather than read at the fire site (D-13) - a cost-control key whose
  // enforcement is a model remembering to read a config value is the same shape
  // as the `review.reviewers` substitution the map above closes.
  //
  // Absence means EVERYTHING, never nothing: the table's own category list is
  // the answer when no layer wrote one, and `surfaces_answered` says which of
  // the two it is, so a fire site can tell "the user chose all eight" from
  // "nobody has answered yet" - the second is what the one-time ask keys on.
  // Failing toward all eight is the only safe direction here (D-14): the
  // alternative narrows the only blocking review trigger on evidence nobody
  // supplied.
  const tableCategories = Array.isArray(TABLE.risk_surface_categories)
    ? TABLE.risk_surface_categories.filter((c) => typeof c === 'string' && c) : [];
  const wroteSurfaces = cfg.triggerSurfaces.risk_surface;
  let surfaces = tableCategories;
  let surfacesAnswered = false;
  if (wroteSurfaces !== undefined) {
    // Defensive at every hop, like every other config read here: a scalar where
    // a list belongs, and an entry outside the vocabulary, contribute NOTHING
    // and are named - never a silent narrowing of a blocking gate's scope.
    const list = Array.isArray(wroteSurfaces) ? wroteSurfaces : [];
    const kept = list.filter((x) => typeof x === 'string' && tableCategories.includes(x));
    const bad = list.filter((x) => !(typeof x === 'string' && tableCategories.includes(x)));
    if (!Array.isArray(wroteSurfaces)) {
      warnings.push(`review.triggers.risk_surface.surfaces=${JSON.stringify(wroteSurfaces)} is not a list; `
        + `all ${tableCategories.length} categories stand`);
    } else if (bad.length) {
      warnings.push(`review.triggers.risk_surface.surfaces: ${bad.map((x) => JSON.stringify(x)).join(', ')} `
        + `${bad.length === 1 ? 'is' : 'are'} not one of [${tableCategories.join(', ')}]`);
    }
    // A list carrying ANY unrecognised entry fails SAFE - all categories stand
    // and the question reads as unanswered - rather than resolving to its valid
    // subset. `["auth", "secret"]` is a typo for `secrets`, not a decision to
    // stop reviewing secret handling, and accepting the subset would suppress
    // the one-time question forever while silently shrinking the only blocking
    // gate. Widening is the safe direction; a warning the user may not read is
    // not a substitute for it.
    if (kept.length && !bad.length) {
      surfaces = kept;
      surfacesAnswered = true;
    } else if (bad.length) {
      warnings.push('review.triggers.risk_surface.surfaces carries an unrecognised entry; '
        + `all ${tableCategories.length} stand, and the surface question reads as unanswered`);
    } else if (Array.isArray(wroteSurfaces)) {
      warnings.push('review.triggers.risk_surface.surfaces resolves to no category; '
        + `all ${tableCategories.length} stand, and the surface question reads as unanswered`);
    }
  }

  // A per-role pin is an explicit user assertion, so it wins over the cell's
  // model. What it does NOT touch is effort: that is fixed per agent file in
  // frontmatter, so a pinned role keeps its rung and its rung escalation (same
  // reasoning depth, user's model). An unknown alias is reported as a warning
  // and the routed model stands - a typo must not silently redirect the spend,
  // nor block the spawn.
  let model = cell.model;
  let pinned = false;
  const pin = cfg.overrides[opts.role];
  if (pin != null) {
    if (TABLE.model_aliases.includes(pin)) {
      if (pin === model) {
        reason.push(`override ${opts.role}=${pin} (already the routed model)`);
      } else {
        reason.push(`override ${opts.role}: ${model} -> ${pin} (config, wins over the ${stakes}/${opts.role} cell)`);
        model = pin;
      }
      pinned = true;
    } else {
      warnings.push(`model.overrides.${opts.role}="${pin}" is not a known alias (${TABLE.model_aliases.join(', ')}); routed ${model} stands`);
      reason.push('override ignored (unknown alias)');
    }
  }

  // The routing family of the joined run record, one line per resolve. It
  // carries the DECISION and never the diagnostic TEXT: `warning_count` is a
  // count because the envelope below is what carries the strings, and a second
  // copy of them would drift from it.
  //
  // Best effort in every direction. `appendEvent` never throws and never writes
  // to a stream, and this whole block sits in its own try, so a trace that
  // cannot be written leaves the envelope below byte-identical - a record of a
  // decision may never be able to change the decision.
  try {
    if (tracePhase !== null) {
      appendEvent(planningRoot, {
        phase: tracePhase,
        family: 'routing',
        event: 'resolve',
        role: opts.role,
        stakes,
        agent,
        model,
        effort,
        escalated,
        pinned,
        attempt: opts.attempt || 1,
        warning_count: warnings.length,
      });
    }
  } catch { /* a record of a decision may never change the decision */ }

  // The bundle: four knobs, not a bare model. `review` is the whole
  // trigger->gate map for this level (no --trigger flag: the map rides on one
  // resolve, and a flag would change the CONTRACTS entry for no reader),
  // `reviewers` is the trigger->reviewer-set map beside it, `surfaces` +
  // `surfaces_answered` are the risk_surface fire's scope and whether anyone
  // chose it, and `verify` is the level's two-state deep-verify switch. All
  // three halves of a fire ride on ONE resolve.
  out({ ok: true, role: opts.role, agent, model, effort, review, reviewers, reviewer_tiers: reviewerTiers, reviewer_efforts: reviewerEfforts, surfaces, surfaces_answered: surfacesAnswered, verify, stakes, escalated, pinned, attempt: opts.attempt || 1, reason, ...(warnings.length ? { warnings } : {}) });
}

// --- arg parsing -------------------------------------------------------------

function parseArgs(a) {
  const o = { file: '.planning/config.json', attempt: 1 };
  for (let i = 0; i < a.length; i++) {
    const k = a[i];
    if (k === '--role') o.role = a[++i];
    else if (k === '--attempt') {
      const raw = a[++i];
      const parsed = requireInt(raw);
      if (parsed.ok) o.attempt = parsed.value;
      else { o.attempt = raw; o.attemptInvalid = true; }
    }
    // Stored RAW: a `--phase` outside the accepted shape is a warning at the
    // baseline, never a `usage` refusal (which would route the phase lower than
    // its own baseline), so the check belongs where the floor is computed.
    else if (k === '--phase') o.phase = a[++i];
    // A `--file` with nothing usable after it is refused, not resolved: `o.file`
    // reaches `dirname()` on the way to the layer read, so an undefined value
    // escaped as reason:"internal" carrying a raw Node type error. Both
    // spellings, matching config.mjs's own guard - unquoted `$VAR` drops the
    // token, quoted `"$VAR"` passes an empty one, and defaulting either to
    // .planning/config.json would answer about a file the caller never named.
    else if (k === '--file') { o.file = a[++i]; if (!o.file) o.fileMissing = true; }
    // The bracket pair: `--bracket-read` switches the lifecycle dispatch event
    // on and carries the site's read-set (ONE comma-separated value, like
    // `trace append --read`); `--bracket-plan` is the worker key when it is not
    // the role name (an executor's plan number). Valueless forms are refused
    // like `--file`: recording a bracket for a read-set the caller never named
    // would claim a site read nothing when the token merely went missing.
    else if (k === '--bracket-read') { o.bracketRead = a[++i]; if (!o.bracketRead) o.bracketReadMissing = true; }
    else if (k === '--bracket-plan') { o.bracketPlan = a[++i]; if (!o.bracketPlan) o.bracketPlanMissing = true; }
  }
  return o;
}

try {
  try {
    TABLE = JSON.parse(readFileSync(TABLE_PATH, 'utf8'));
  } catch (e) {
    fail('bad-table', `cannot read/parse ${TABLE_PATH}: ${e.message}`);
  }
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (cmd === 'resolve') {
    // The three `usage` refusals below carry no `warnings` on purpose: they fail
    // on ARGUMENT SHAPE before any config file is named, so there is no layer
    // whose diagnostics could ride along. Every other ok:false return does carry
    // them (D-04).
    const o = parseArgs(argv.slice(1));
    if (!o.role) { out({ ok: false, reason: 'usage', detail: 'resolve --role <name> [--attempt N] [--file <config>] [--phase N] [--bracket-read <csv> [--bracket-plan <key>]]' }); }
    else if (o.attemptInvalid) { out({ ok: false, reason: 'usage', detail: 'resolve --attempt must be an integer' }); }
    else if (o.fileMissing) { out({ ok: false, reason: 'usage', detail: 'resolve --file needs a path after it: --file <config file>' }); }
    else if (o.bracketReadMissing) { out({ ok: false, reason: 'usage', detail: 'resolve --bracket-read needs a comma-separated path list after it' }); }
    else if (o.bracketPlanMissing) { out({ ok: false, reason: 'usage', detail: 'resolve --bracket-plan needs a worker key after it' }); }
    else resolve(o);
  } else if (cmd === 'table') {
    out({ ok: true, table: TABLE });
  } else {
    out({ ok: false, reason: 'usage', detail: 'subcommand: resolve | table' });
  }
} catch (e) {
  if (e !== DONE) out({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
}
