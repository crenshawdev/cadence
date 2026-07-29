#!/usr/bin/env node
// @ts-check
// route.mjs - zero-dep model-routing resolver. Given an agent role and an
// attempt number, resolve which model alias and which agent file the
// spawn-agent seam should dispatch. The route-table.json beside
// ../route-table.json is editable data (role tiers + stakes->model matrix);
// this file is the logic. DESIGN "model routing" (§ model routing).
//
// The question the table asks is what a break COSTS, not what a dispatch
// costs: a role's tier picks the column, the project's stakes picks the row.
//
// Never blocks the spine: on any problem it returns {ok:false,...} and the
// caller dispatches the base agent at the session-default model (no override).
//
// Subcommands (one JSON line on stdout):
//   resolve --role <name> [--attempt N] [--file <config>]
//   table                                  dump the routing table
//
// Config is layered: a global file (see GLOBAL_CONFIG below) provides defaults,
// the per-repo --file (default .planning/config.json) overrides it, and the
// built-in DEFAULTS backstop both. Precedence: repo > global > defaults.
// Config keys read:
//   stakes                     solo | shipped | critical
//   model.escalate_on_failure  re-dispatch a failed attempt at the role's
//                              `escalate_to` rung (bool, every stakes level)
//   model.overrides.<role>     pin one role to a model alias, bypassing the matrix
//   review.triggers.*.gate     a gate a LAYER set, which wins over the level's
//                              gate and reports the disagreement (D-04)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mergeLayers } from './lib/config-merge.mjs';
import { agentForRung } from './lib/rung-agent.mjs';
import { retiredKeysIn } from './lib/retired-keys.mjs';
import { emit as out, DONE } from './lib/seam-io.mjs';
import { requireInt } from './lib/require-int.mjs';

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

function resolve(opts) {
  const role = TABLE.roles[opts.role];
  if (!role) { out({ ok: false, reason: 'unknown-role', role: opts.role, detail: `known roles: ${Object.keys(TABLE.roles).join(', ')}` }); return; }

  const cfg = readConfig(opts.file);
  // An honest first reason: `config:<layers>` is a claim that a layer supplied
  // the value, so a default that no layer carried says so instead. Reporting
  // `config:repo` for a value the repo file never held is how a retired key
  // reads as a configured one.
  const reason = [cfg.stakesSet
    ? `config:${cfg._source}`
    : `stakes default "${cfg.stakes}" (unset in layers: ${cfg._source})`];
  const tier = role.tier;
  let agent = opts.role;
  let effort = role.base_effort;
  let escalated = false;

  // Escalation is unconditional: a failed attempt re-dispatches at the role's
  // `escalate_to` rung at EVERY stakes level. Gating it behind a routing mode
  // is what left the rung ladder unreachable on a default install.
  if ((opts.attempt || 1) > 1) {
    if (cfg.escalate_on_failure) {
      // `escalate_to` names the target rung, and the agent FILE for that rung
      // is what carries the effort (route.mjs reports effort, it cannot set it
      // - seams.md). Fail-open by design: rung membership and file existence
      // are self-verify's job, so a malformed spec here still dispatches
      // rather than blocking the spine.
      const target = role.escalate_to;
      if (target && target !== effort) {
        escalated = true;
        agent = agentForRung(opts.role, role, target);
        reason.push(`rung ${effort}->${target} (${agent})`);
        effort = target;
      } else {
        // Honest no-op: a role whose escalate_to IS its base rung has nothing
        // to swap to, and saying so beats reporting an escalation that never
        // happened.
        reason.push(`rung held at ${effort} (escalate_to ${target || 'unset'})`);
      }
    } else {
      reason.push(`rung held at ${effort} (model.escalate_on_failure: false)`);
    }
  }

  const table = TABLE.stakes && TABLE.stakes[cfg.stakes];
  if (!table || !table[tier]) { out({ ok: false, reason: 'unresolved', role: opts.role, stakes: cfg.stakes, tier }); return; }

  // The other two grids (D-01). `review` keys on (level, trigger) because a
  // gate belongs to a trigger, not to an agent; `verify` keys on the level
  // alone because deep_check runs once per phase with no role in hand. A level
  // missing either row is a TORN table, so it degrades the same way a bad
  // stakes value already does rather than emitting a partial bundle - half a
  // bundle read as a whole one is worse than no bundle at all.
  const reviewRow = TABLE.review && TABLE.review[cfg.stakes];
  const verify = TABLE.verify ? TABLE.verify[cfg.stakes] : undefined;
  if (!reviewRow || typeof reviewRow !== 'object' || Array.isArray(reviewRow) || verify === undefined) {
    out({ ok: false, reason: 'unresolved', role: opts.role, stakes: cfg.stakes, tier }); return;
  }

  // `warnings` is an ARRAY (matching config.mjs get): a torn config layer, a
  // retired key, a gate disagreement and an unknown pin alias can all be true
  // at once.
  const warnings = [...cfg._warnings];

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
      warnings.push(`review.triggers.${trigger}.gate="${configured}" (config) wins over the ${cfg.stakes} level gate "${levelGate}"`);
    } else {
      review[trigger] = levelGate;
    }
  }

  // A per-role pin is an explicit user assertion, so it wins over the whole
  // stakes/tier matrix. What it does NOT touch is effort: that is fixed per
  // agent file in frontmatter, so a pinned role keeps its rung escalation
  // (same reasoning depth, user's model). An unknown alias is reported as a
  // warning and the routed model stands - a typo must not silently redirect
  // the spend, nor block the spawn.
  let model = table[tier];
  let pinned = false;
  const pin = cfg.overrides[opts.role];
  if (pin != null) {
    if (TABLE.model_aliases.includes(pin)) {
      if (pin === model) {
        reason.push(`override ${opts.role}=${pin} (already the routed model)`);
      } else {
        reason.push(`override ${opts.role}: ${model} -> ${pin} (config, wins over ${cfg.stakes}/${tier})`);
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
  out({ ok: true, role: opts.role, agent, model, effort, review, verify, tier, stakes: cfg.stakes, escalated, pinned, attempt: opts.attempt || 1, reason, ...(warnings.length ? { warnings } : {}) });
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
    if (!o.role) { out({ ok: false, reason: 'usage', detail: 'resolve --role <name> [--attempt N] [--file <config>]' }); }
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
