#!/usr/bin/env node
// @ts-check
// route.mjs - zero-dep routing resolver. Given an agent role and an attempt
// number, resolve the whole quality bundle the spawn-agent seam and the review
// subsystem need: {model, effort, review, verify}. The route-table.json beside
// ../route-table.json is editable data (three grids); this file is the logic.
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
//   review.triggers.*.gate     a gate a LAYER set, which wins over the level's
//                              gate and reports the disagreement (D-04)
//
// The stakes level a config layer set is a FLOOR question too (STK-03): the
// phase's own PLAN `files:` list is matched against the table's `surfaces`
// block, and a detected risk surface RAISES the level to that row's floor -
// never lowers it. Lowering back takes a persisted `risk.override.<surface>`,
// one per detected surface. Every unresolvable input (no `--phase` and no
// cursor, no PLAN, an unreadable PLAN) resolves at the baseline with ok:true.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mergeLayers } from './lib/config-merge.mjs';
import { rungFile } from './lib/rung-agent.mjs';
import { retiredKeysIn } from './lib/retired-keys.mjs';
import { emit as out, DONE } from './lib/seam-io.mjs';
import { requireInt } from './lib/require-int.mjs';
import { matchSurfaces, raiseTo } from './lib/risk-surfaces.mjs';
import { cursorPhase, declaredPhaseFiles } from './lib/phase-plans.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
// TABLE is loaded lazily, inside the dispatch try block below, so a missing
// or malformed shipped route-table.json degrades to {ok:false} instead of
// crashing at import time. CADENCE_ROUTE_TABLE overrides the path (hermetic
// test injection only; production always uses the shipped file).
let TABLE;
const TABLE_PATH = process.env.CADENCE_ROUTE_TABLE || join(HERE, '..', 'route-table.json');
const fail = (reason, detail) => { out({ ok: false, reason, detail }); throw DONE; };

// Config defaults mirror config.schema.json so a missing/partial config still routes.
const DEFAULTS = { stakes: 'shipped', escalate_on_failure: true };

// The shape a `--phase` value must have: an integer phase, or a decimal
// insertion (`2.1`), which is the phase directory's own name.
const PHASE_RE = /^\d+(\.\d+)?$/;

// D-09 by ROLE. These two dispatches happen BEFORE the phase they are about has
// a PLAN, so there is no declared file list to floor them off - and the "no PLAN
// yet" mechanism does not deliver that on its own, because the cursor lags:
// workflows/context.md dispatches cad-assumptions-analyzer well before it sets
// the cursor, so during `/cad-context 5` the cursor still reads phase 4 and the
// analyzer would be floored off phase 4's file list. A floor computed from a
// DIFFERENT phase's plan is not a safe-direction superset, and no `reason`
// string would reveal it as wrong. So these two resolve at the project baseline,
// which is what D-09 says.
const PRE_PLAN_ROLES = new Set(['cad-planner', 'cad-assumptions-analyzer']);

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
    triggerGates: triggerGatesIn(c),
    _source: source,
    _warnings: [...(warnings || []), ...retiredKeysIn(c)],
  };
}

// Per-trigger gates a LAYER actually wrote, keyed by trigger name. mergeLayers
// merges the two FILE layers only and never folds in a schema default, so
// everything this returns is a user assertion - which is the whole reason D-04
// can let it win over the level's gate. Reading a default here would turn "the
// schema says advisory" into "the user asked for advisory" and the grid would
// decide nothing. Defensive at every hop: this runs on whatever a user's config
// happens to hold, and a scalar where an object belongs contributes nothing
// rather than throwing.
function triggerGatesIn(c) {
  const out = {};
  const triggers = (c && typeof c === 'object' ? (c.review || {}) : {}).triggers;
  if (!triggers || typeof triggers !== 'object' || Array.isArray(triggers)) return out;
  for (const [name, spec] of Object.entries(triggers)) {
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) continue;
    if (spec.gate !== undefined && spec.gate !== null) out[name] = spec.gate;
  }
  return out;
}

/**
 * The EFFECTIVE stakes level for this dispatch: the configured baseline, raised
 * to the highest floor among the risk surfaces the phase's own declared PLAN
 * `files:` list matches (STK-03). Pushes its own entries onto the `reason` and
 * `warnings` arrays the caller already carries.
 *
 * Every unresolvable input returns the BASELINE with no entry at all - a
 * `{ok:false}` here would make the caller dispatch the base agent at the session
 * default (references/seams.md), routing a possibly-risky phase LOWER than its
 * own baseline, and an entry saying nothing fired would appear on every dispatch
 * of every phase for the life of every project.
 *
 * Reason entries name only what is identical between the two entry points - the
 * phase number, the surface, the path, the pattern - and never HOW the phase was
 * obtained, because a `--phase N` resolve and the cursor fallback must return
 * the same bundle.
 * @param {{role: string, file: string, phase?: string}} opts
 * @param {{stakes: string}} cfg
 * @param {string[]} reason @param {string[]} warnings
 * @returns {string} the effective level
 */
function riskFloor(opts, cfg, reason, warnings) {
  const baseline = cfg.stakes;
  if (PRE_PLAN_ROLES.has(opts.role)) return baseline; // D-09
  const root = dirname(opts.file);

  // A `--phase` that was PASSED but is out of shape does NOT fall through to the
  // cursor: answering a typo with a floor computed from a different phase is
  // worse than the value the user typed. Only an ABSENT flag reaches the cursor.
  let phase = null;
  if (opts.phase !== undefined) {
    if (!PHASE_RE.test(String(opts.phase))) {
      warnings.push(`--phase "${opts.phase}" is not a phase number; no risk floor was `
        + `computed and this resolved at the ${baseline} baseline`);
      return baseline;
    }
    phase = String(opts.phase);
  } else {
    const cursor = cursorPhase(root);
    if (cursor === null) return baseline; // no phase in hand: no floor, silently
    phase = String(cursor);
  }

  const declared = declaredPhaseFiles(root, phase);
  warnings.push(...declared.warnings);
  const matches = matchSurfaces(declared.files, TABLE.surfaces);
  if (!matches.length) return baseline;

  const order = Array.isArray(TABLE.stakes_order) ? TABLE.stakes_order : [];
  let effective = baseline;
  for (const m of matches) effective = raiseTo(effective, m.floor, order);
  for (const m of matches) {
    if (raiseTo(baseline, m.floor, order) !== baseline) {
      reason.push(`risk floor: phase ${phase} surface "${m.surface}" matched ${m.path} `
        + `(pattern "${m.pattern}"); stakes ${baseline} -> ${effective}`);
    } else {
      // Criterion 3, the raise-never-caps behaviour: a detected surface whose
      // floor sits at or below the baseline changes no knob and says so.
      reason.push(`risk floor: phase ${phase} surface "${m.surface}" detected `
        + `(floor ${m.floor}); baseline ${baseline} already at or above it`);
    }
  }
  return effective;
}

function resolve(opts) {
  // The declared role list, not a lookup in a spec object: a role IS routable
  // or it is not, and after this phase the table carries no per-role block for
  // the question to be asked of.
  const roles = Array.isArray(TABLE.roles) ? TABLE.roles : [];
  if (!roles.includes(opts.role)) { out({ ok: false, reason: 'unknown-role', role: opts.role, detail: `known roles: ${roles.join(', ')}` }); return; }

  const cfg = readConfig(opts.file);
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

  // The computed floor (STK-03), BEFORE the grid lookups: a detected risk
  // surface pins the stakes LEVEL, so all four knobs come from the floored
  // row through the one cell grid rather than from a second ladder beside it.
  // The baseline stays visible in `reason` - a bundle that reports the baseline
  // level while dispatching the floored cell is worse than no floor.
  const stakes = riskFloor(opts, cfg, reason, warnings);

  // The three grids (D-01). `model`, `effort` and `retry` come from ONE cell
  // keyed on (level, role); `review` keys on (level, trigger) because a gate
  // belongs to a trigger, not to an agent; `verify` keys on the level alone
  // because deep_check runs once per phase with no role in hand. A level
  // missing any of the three is a TORN table, so it degrades the same way a bad
  // stakes value already does rather than emitting a partial bundle - half a
  // bundle read as a whole one is worse than no bundle at all.
  const level = TABLE.cells && TABLE.cells[stakes];
  const cell = level && typeof level === 'object' && !Array.isArray(level) ? level[opts.role] : null;
  const reviewRow = TABLE.review && TABLE.review[stakes];
  const verify = TABLE.verify ? TABLE.verify[stakes] : undefined;
  if (!cell || typeof cell !== 'object' || Array.isArray(cell)
    || !reviewRow || typeof reviewRow !== 'object' || Array.isArray(reviewRow)
    || verify === undefined) {
    out({ ok: false, reason: 'unresolved', role: opts.role, stakes }); return;
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
  let agent = agentFor(effort);
  let escalated = false;

  // Escalation is unconditional: a failed attempt climbs to the rung its OWN
  // cell names, at EVERY stakes level. Gating it behind a routing mode is what
  // left the rung ladder unreachable on a default install; a fixed per-role
  // target beside a cell that also sets effort is what let five of six roles
  // resolve their escalation to a no-op (D-02).
  if ((opts.attempt || 1) > 1) {
    if (cfg.escalate_on_failure) {
      const target = cell.retry;
      if (target && target !== effort) {
        escalated = true;
        agent = agentFor(target);
        reason.push(`rung ${effort}->${target} (${agent})`);
        effort = target;
      } else {
        // Honest no-op: a cell whose retry IS its starting rung has nothing to
        // climb to, and saying so beats reporting an escalation that never
        // happened.
        reason.push(`rung held at ${effort} (retry rung is the same rung)`);
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
  const review = {};
  for (const [trigger, levelGate] of Object.entries(reviewRow)) {
    const configured = cfg.triggerGates[trigger];
    if (configured !== undefined && configured !== levelGate) {
      review[trigger] = configured;
      warnings.push(`review.triggers.${trigger}.gate="${configured}" (config) wins over the ${stakes} level gate "${levelGate}"`);
    } else {
      review[trigger] = levelGate;
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

  // The bundle: four knobs, not a bare model. `review` is the whole
  // trigger->gate map for this level (no --trigger flag: the map rides on one
  // resolve, and a flag would change the CONTRACTS entry for no reader), and
  // `verify` is the level's two-state deep-verify switch.
  out({ ok: true, role: opts.role, agent, model, effort, review, verify, stakes, escalated, pinned, attempt: opts.attempt || 1, reason, ...(warnings.length ? { warnings } : {}) });
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
    else if (k === '--file') o.file = a[++i];
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
    const o = parseArgs(argv.slice(1));
    if (!o.role) { out({ ok: false, reason: 'usage', detail: 'resolve --role <name> [--attempt N] [--file <config>] [--phase N]' }); }
    else if (o.attemptInvalid) { out({ ok: false, reason: 'usage', detail: 'resolve --attempt must be an integer' }); }
    else resolve(o);
  } else if (cmd === 'table') {
    out({ ok: true, table: TABLE });
  } else {
    out({ ok: false, reason: 'usage', detail: 'subcommand: resolve | table' });
  }
} catch (e) {
  if (e !== DONE) out({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
}
