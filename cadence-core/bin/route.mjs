#!/usr/bin/env node
// @ts-check
// route.mjs - zero-dep model-routing resolver. Given an agent role (and, for
// `auto`, difficulty signals + attempt number), resolve which model alias and
// which agent file the spawn-agent seam should dispatch. The route-table.json
// beside ../route-table.json is editable data (role tiers + profile->model
// matrix); this file is the logic. DESIGN "model routing" (§ model routing).
//
// Never blocks the spine: on any problem it returns {ok:false,...} and the
// caller dispatches the base agent at the session-default model (no override).
//
// Subcommands (one JSON line on stdout):
//   resolve --role <name> [--attempt N] [--files N] [--ambiguity 0..1] [--file <config>]
//   table                                  dump the routing table
//
// Config is layered: a global file (see GLOBAL_CONFIG below) provides defaults,
// the per-repo --file (default .planning/config.json) overrides it, and the
// built-in DEFAULTS backstop both. Precedence: repo > global > defaults.
// Config keys read:
//   model.profile          fast | balanced | quality | auto
//   model.auto.ceiling     highest profile auto may escalate to
//   model.auto.escalate_on_failure (bool), model.auto.max_escalations (int)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mergeLayers } from './lib/config-merge.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const TABLE = JSON.parse(readFileSync(join(HERE, '..', 'route-table.json'), 'utf8'));

// Seam convention: the JSON line is the contract; the exit code mirrors ok
// for shell-side chaining (0 ok, 1 degraded).
const out = (o) => { process.stdout.write(JSON.stringify(o) + '\n'); process.exitCode = o.ok === false ? 1 : 0; };

// Config defaults mirror config.schema.json so a missing/partial config still routes.
const DEFAULTS = { profile: 'balanced', ceiling: 'quality', escalate_on_failure: true, max_escalations: 1 };

// Resolve the effective config from global + repo layers (repo wins, via the
// shared merge lib), falling back to DEFAULTS for anything unset. _source
// names the layers that applied.
function readConfig(file) {
  const { config: c, source } = mergeLayers(file);
  const m = c.model || {};
  const a = m.auto || {};
  return {
    profile: m.profile ?? DEFAULTS.profile,
    ceiling: a.ceiling ?? DEFAULTS.ceiling,
    escalate_on_failure: a.escalate_on_failure ?? DEFAULTS.escalate_on_failure,
    max_escalations: a.max_escalations ?? DEFAULTS.max_escalations,
    _source: source,
  };
}

/** @param {number} i @param {number} lo @param {number} hi */
const clampIdx = (i, lo, hi) => Math.max(lo, Math.min(hi, i));

/** @param {string} tier @param {number} n */
function bumpTier(tier, n) {
  const order = TABLE.tier_order;
  return order[clampIdx(order.indexOf(tier) + n, 0, order.length - 1)];
}

// Step from base profile UP toward ceiling by `steps`, never overshooting.
// Escalation only ever raises: a ceiling at or below the base profile
// disables it entirely (re-running a FAILED attempt on a weaker model would
// be a demotion, not an escalation). Unknown names also resolve at base.
/** @param {string} base @param {string} ceiling @param {number} steps */
function stepProfile(base, ceiling, steps) {
  const order = TABLE.profile_order;
  const b = order.indexOf(base);
  const c = order.indexOf(ceiling);
  if (b < 0 || c <= b) return base;
  return order[clampIdx(b + steps, b, c)];
}

function resolve(opts) {
  const role = TABLE.roles[opts.role];
  if (!role) { out({ ok: false, reason: 'unknown-role', role: opts.role, detail: `known roles: ${Object.keys(TABLE.roles).join(', ')}` }); return; }

  const cfg = readConfig(opts.file);
  const reason = [`config:${cfg._source}`];
  let profile = cfg.profile;
  let tier = role.tier;
  let agent = opts.role;
  let effort = role.base_effort;
  let escalated = false;

  if (profile === 'auto') {
    const A = TABLE.auto;
    // difficulty -> tier bump (capped)
    let bumps = 0;
    const sig = [];
    if (opts.files != null && opts.files >= A.signals.files.threshold) { bumps++; sig.push(`files>=${A.signals.files.threshold}`); }
    if (opts.ambiguity != null && opts.ambiguity >= A.signals.ambiguity.threshold) { bumps++; sig.push(`ambiguity>=${A.signals.ambiguity.threshold}`); }
    bumps = Math.min(bumps, A.max_tier_bump);
    if (bumps > 0) { tier = bumpTier(role.tier, bumps); escalated = true; reason.push(`tier +${bumps} (${sig.join(', ')})`); }
    // failure -> profile escalation toward ceiling (bounded by max_escalations)
    const steps = cfg.escalate_on_failure ? Math.min(Math.max((opts.attempt || 1) - 1, 0), cfg.max_escalations) : 0;
    const resolveProfile = stepProfile(A.base_profile, cfg.ceiling, steps);
    if (steps > 0) {
      // `escalated` reflects what actually changed: a ceiling at/below base
      // holds the profile (stepProfile), but a failure still swaps the
      // effort-variant - same model spend, harder reasoning.
      if (resolveProfile !== A.base_profile) {
        escalated = true;
        reason.push(`profile ${A.base_profile}->${resolveProfile} (attempt ${opts.attempt}, ceiling ${cfg.ceiling}, max ${cfg.max_escalations})`);
      } else {
        reason.push(`profile held at ${A.base_profile} (ceiling ${cfg.ceiling} at/below base - escalation never demotes)`);
      }
      if (role.escalate_effort_variant) { escalated = true; agent = role.escalate_effort_variant; effort = 'high'; reason.push(`effort-variant ${agent}`); }
    }
    profile = resolveProfile;
    if (!escalated) reason.push(`auto base ${A.base_profile}`);
  } else {
    reason.push('explicit profile (no escalation; user pick wins)');
  }

  const table = TABLE.profiles[profile];
  if (!table || !table[tier]) { out({ ok: false, reason: 'unresolved', role: opts.role, profile, tier }); return; }
  out({ ok: true, role: opts.role, agent, model: table[tier], effort, tier, profile, escalated, attempt: opts.attempt || 1, reason });
}

// --- arg parsing -------------------------------------------------------------

function parseArgs(a) {
  const o = { file: '.planning/config.json', attempt: 1 };
  for (let i = 0; i < a.length; i++) {
    const k = a[i];
    if (k === '--role') o.role = a[++i];
    else if (k === '--attempt') o.attempt = parseInt(a[++i], 10);
    else if (k === '--files') o.files = parseInt(a[++i], 10);
    else if (k === '--ambiguity') o.ambiguity = parseFloat(a[++i]);
    else if (k === '--file') o.file = a[++i];
  }
  return o;
}

try {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (cmd === 'resolve') {
    const o = parseArgs(argv.slice(1));
    if (!o.role) { out({ ok: false, reason: 'usage', detail: 'resolve --role <name> [--attempt N] [--files N] [--ambiguity 0..1]' }); }
    else resolve(o);
  } else if (cmd === 'table') {
    out({ ok: true, table: TABLE });
  } else {
    out({ ok: false, reason: 'usage', detail: 'subcommand: resolve | table' });
  }
} catch (e) {
  out({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
}
