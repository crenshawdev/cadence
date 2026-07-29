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
    _source: source,
    _warnings: [...(warnings || []), ...retiredKeysIn(c)],
  };
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

  // A per-role pin is an explicit user assertion, so it wins over the whole
  // stakes/tier matrix. What it does NOT touch is effort: that is fixed per
  // agent file in frontmatter, so a pinned role keeps its rung escalation
  // (same reasoning depth, user's model). An unknown alias is reported as a
  // warning and the routed model stands - a typo must not silently redirect
  // the spend, nor block the spawn.
  let model = table[tier];
  let pinned = false;
  const warnings = [...cfg._warnings];
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

  // `warnings` is an ARRAY (matching config.mjs get): a torn config layer, a
  // retired key and an unknown pin alias can all be true at once.
  out({ ok: true, role: opts.role, agent, model, effort, tier, stakes: cfg.stakes, escalated, pinned, attempt: opts.attempt || 1, reason, ...(warnings.length ? { warnings } : {}) });
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
