#!/usr/bin/env node
// @ts-check
// route.mjs - resolves a role and attempt into {model, effort, review, verify}: config layers (repo > global), then
// config.schema.json's defaults. Move that precedence and a key someone set stops doing anything.
// Never blocks the spine: on any problem it returns ok:false and the caller dispatches the base agent at session
// model. Subcommands: `resolve` and `agent-type --stem <name>`; resolve's flags are in SYNOPSIS below.
// The plan-time risk floor is the only thing that moves an answer after the read: plan review goes blocking and
// deep-verify turns on, never a model or rung. An unreadable scope raises.

import { readFileSync, lstatSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, isAbsolute } from 'node:path';
import { within } from './lib/contained.mjs';
import { GLOBAL_CONFIG, layerIdentity, mergeLayers } from './lib/config-merge.mjs';
import { rungFile, RUNG_FILES, RUNG_ORDER } from './lib/rung-agent.mjs';
import { gateTriggers } from './lib/gate-agreement.mjs';
import { retiredKeysIn } from './lib/retired-keys.mjs';
import { isModelId } from './lib/model-id.mjs';
import { emit as out, DONE } from './lib/seam-io.mjs';
import { evaluateFlag, CONTRACTS } from './lib/arg-contract.mjs';
import { cursorPhase, declaredFilesIn, declaredPhaseFiles, declaredPlanFiles,
  phaseDirsIn } from './lib/phase-plans.mjs';
import { scanDeclared } from './lib/risk-diff.mjs';
import { appendEvent } from './lib/trace.mjs';
import { testSeamOpen } from './lib/test-seam.mjs';
import { answeredSurfaces } from './lib/surface-scan.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
// Loaded lazily inside the dispatch try, so a bad shipped file degrades to ok:false instead of crashing at import. An
// unreadable schema is fatal: every default lives there and nowhere else.
// CADENCE_CONFIG_SCHEMA moves the path only when the `CADENCE_TEST_SEAM` sentinel holds, and is ignored silently
// otherwise (no dispatch exists yet to carry a warning). Ungated, it could turn a blocking gate off. Same shape as
// SCHEMA_PATH in config.mjs, so the two never disagree on when it can move.
let SCHEMA;
const SCHEMA_PATH = (testSeamOpen() && process.env.CADENCE_CONFIG_SCHEMA)
  || join(HERE, '..', 'config.schema.json');

// Agent prefix is plugin.json's `name` (not `provider.plugin`), read relative to the script so `cadence-dev` works.
const MANIFEST_PATH = (testSeamOpen() && process.env.CADENCE_PLUGIN_MANIFEST)
  || join(HERE, '..', '..', '.claude-plugin', 'plugin.json');

/**
 * The one answer to "prefix or failure" for `resolve` and `agent-type`, so the two can't disagree. Never throws: with
 * no readable manifest `agentType` is the bare stem and `reason` names the path, byte for byte the same for both.
 * @param {string} stem
 * @returns {{agentType: string, reason: string|null}}
 */
function prefixedAgentType(stem) {
  try {
    const name = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')).name;
    if (typeof name === 'string' && name !== '') return { agentType: `${name}:${stem}`, reason: null };
  } catch { /* no manifest, so the bare stem below */ }
  return { agentType: stem,
    reason: `agent_type is the bare agent: no plugin name could be read from ${MANIFEST_PATH}` };
}

// `hint` rides as a conditional key, so an absent one adds no key and no shipped assertion moves.
const fail = (reason, detail, hint) => {
  out({ ok: false, reason, detail, ...(hint ? { hint } : {}) });
  throw DONE;
};

// Mirrors config.schema.json so a missing or partial config still routes.
const DEFAULTS = { escalate_on_failure: false, reviewers: ['claude-subagent'] };

// The host's `model` enum, checked 2026-09-04 and the only copy here; a string outside it resolves `model: null` plus a
// warning.
const HOST_MODELS = Object.freeze(['opus', 'sonnet', 'haiku', 'fable']);

// Every `review.triggers.*` read goes through this pair, so a schema missing a row degrades instead of throwing.
const schemaKeys = () => {
  const keys = SCHEMA && typeof SCHEMA === 'object' && !Array.isArray(SCHEMA)
    ? SCHEMA.keys : null;
  return keys && typeof keys === 'object' && !Array.isArray(keys) ? keys : {};
};
const schemaRow = (key) => {
  const keys = schemaKeys();
  const spec = Object.prototype.hasOwnProperty.call(keys, key) ? keys[key] : null;
  return spec && typeof spec === 'object' && !Array.isArray(spec) ? spec : {};
};
// One key's accepted vocabulary, weakest first in the schema, so "below blocking" reads off the array.
const schemaValues = (key) => {
  const v = schemaRow(key).values;
  return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x) : [];
};

// The one gate name spelled here, judged against the plan gate's `values` order, so a schema without it raises nothing.
const FLOOR_GATE = 'blocking';

// The surfaces key's own `values`, so a schema naming fewer categories is honoured.
const riskCategories = () => schemaValues('review.triggers.risk_surface.surfaces');

// The one key that routes below the computed floor. It waives a level, never a review: the blocking `risk_surface` gate
// still fires on the diff.
// A new key, not a revival of the retired `risk.override.<surface>` ones, since a key can't live in the schema and the
// retired registry at once.
const WAIVER_KEY = 'review.triggers.risk_surface.waive_routing_floor';

// Roles dispatched before a plan exists get no floor; one off another phase's file list would be silently wrong.
const PRE_PLAN_ROLES = Object.freeze(['cad-planner', 'cad-assumptions-analyzer']);

// Per-file read cap, since a cloned `files:` list could point a resolve at a device node or a huge file.
const MAX_BODY_BYTES = 512 * 1024;

// `--phase` is judged by `requirePhaseArg` via the flag's row in lib/arg-contract.mjs, not a regex per script (three
// copies disagreed).

// Repo over global over DEFAULTS. `_warnings` carries parse failures and retired keys without blocking.
function readConfig(file) {
  const { config: c, source, warnings, layers } = mergeLayers(file);
  const m = c.model || {};
  return {
    escalate_on_failure: m.escalate_on_failure ?? DEFAULTS.escalate_on_failure,
    // Own map, so no entry gets two writers. No per-role merge on purpose: config-merge recurses by key, so global
    // `model` composes with repo `effort`.
    roles: rolesIn(c),
    triggerGates: triggerFieldIn(c, 'gate'),
    // Layers only: a schema default read here would pass the seam's own answer off as the user's.
    triggerTiers: triggerFieldIn(c, 'tier'),
    // Cross-model effort, same layers-only read. Not the envelope's `effort`, which is the agent rung.
    triggerEfforts: triggerFieldIn(c, 'effort'),
    // The risk_surface scope. Its default is `null` so "nobody answered" stays distinguishable.
    triggerSurfaces: triggerFieldIn(c, 'surfaces'),
    // Surfaces whose raise is waived. `null` keeps "waived nothing" and "never answered" one state.
    triggerWaivers: triggerFieldIn(c, 'waive_routing_floor'),
    // null when no layer named a usable set; DEFAULTS backstops it below.
    reviewers: reviewersIn(c),
    // Cross-model names the user-global layer itself lists. `layers.global` is null when that file is absent, torn, not
    // an object or the same file as the repo config, so none of those proves an opt-in.
    reviewersGlobal: (reviewersIn(layers.global) || []).filter((n) => n !== 'claude-subagent'),
    // True when that null was the collapse, so the drop below names the one file.
    layersShared: layerIdentity(file) !== null && layerIdentity(file) === layerIdentity(GLOBAL_CONFIG),
    // Model id per provider and tier; no id at the resolved tier means unavailable.
    providers: providersIn(c),
    _source: source,
    _warnings: [...(warnings || []), ...retiredKeysIn(c)],
  };
}

// A field a layer actually wrote, keyed by trigger. mergeLayers never folds in schema defaults, so this is a user
// assertion: read a default here and "the schema says advisory" becomes "the user asked for advisory".
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

// Reviewer backends a layer named, or null. Non-strings are dropped, and anything but a usable list reads as unset.
function reviewersIn(c) {
  const list = (c && typeof c === 'object' ? (c.review || {}) : {}).reviewers;
  if (!Array.isArray(list)) return null;
  const names = list.filter((x) => typeof x === 'string' && x);
  return names.length ? names : null;
}

// Provider blocks, defensively: anything but a tier -> model id map reads as unavailable instead of throwing.
function providersIn(c) {
  const p = (c && typeof c === 'object' ? (c.review || {}) : {}).providers;
  return p && typeof p === 'object' && !Array.isArray(p) ? p : {};
}

// The same defensive read for `roles`.
function rolesIn(c) {
  const r = c && typeof c === 'object' ? c.roles : undefined;
  return r && typeof r === 'object' && !Array.isArray(r) ? r : {};
}

// `hasOwn`, not a bare index: the map is user data and a prototype member would read as an entry.
function roleEntryIn(rolesBlock, role) {
  const e = Object.prototype.hasOwnProperty.call(rolesBlock, role) ? rolesBlock[role] : undefined;
  return e && typeof e === 'object' && !Array.isArray(e) ? e : {};
}

// The raw id a layer holds for one provider at one tier, or null.
function configuredTierId(providers, name, tier) {
  if (!tier) return null;
  const block = providers[name];
  const tiers = block && typeof block === 'object' && !Array.isArray(block) ? block.tiers : null;
  const id = tiers && typeof tiers === 'object' && !Array.isArray(tiers) ? tiers[tier] : null;
  return typeof id === 'string' ? id : null;
}

// '' is not a model id (a cleared key sent as an empty model is silent substitution), and neither is anything the
// shared predicate refuses.
function providerModel(providers, name, tier) {
  const id = configuredTierId(providers, name, tier);
  return id !== null && isModelId(id) ? id : '';
}

/**
 * The declared paths with whatever body each has, for `scanDeclared`, read against the planning root's parent so a
 * `--file` pointed at another tree can't read this one's files.
 * No body isn't an error, a plan may create the file. A skipped one carries `unread` saying why, or its scope got
 * discounted unopened. Refused unopened: an absolute path or `..`, a non-regular file, a real path outside the
 * root, or over the byte cap. Containment is `realpathSync` on both sides, or a linked `/tmp` root refuses everything.
 * Nothing throws, and `bytes` rides only the arm that read, so a zero isn't an empty file.
 * @param {string} repoRoot @param {string[]} files
 * @returns {Array<{path: string, body?: string, unread?: string, bytes?: number}>}
 */
function declaredBodies(repoRoot, files) {
  // Resolved once, fail-soft: an unresolvable root keeps its spelling, which can only refuse paths, never admit one.
  let root;
  try {
    root = realpathSync(repoRoot);
  } catch {
    root = repoRoot;
  }
  const inside = (/** @type {string} */ real) => within(real, root);
  return files.map((rel) => {
    // Refused by spelling. `unread`, not a bare path: a file left unopened may hold what a discount would call absent.
    if (isAbsolute(rel) || rel.split('/').includes('..')) {
      return { path: rel, unread: 'path climbs out of the repository' };
    }
    const abs = join(repoRoot, rel);
    let st;
    try {
      st = lstatSync(abs);
    } catch {
      // The one arm that isn't `unread`: a plan often creates the file, so nothing was skipped.
      return { path: rel };
    }
    // Refused by what it resolves to: `statSync` follows a link to a character device, size 0, so it passes the byte
    // bound and never hits EOF.
    if (!st.isFile()) return { path: rel, unread: 'not a regular file' };
    // Refused by where it really is: `lstatSync` follows every component but the last, so a symlinked parent can land
    // in another tree.
    // After the regular-file arm so a device link keeps that wording, and before any read.
    let real;
    try {
      real = realpathSync(abs);
    } catch {
      return { path: rel, unread: 'path could not be resolved' };
    }
    if (!inside(real)) {
      return { path: rel, unread: 'path resolves outside the repository' };
    }
    if (st.size > MAX_BODY_BYTES) {
      return { path: rel, unread: `body over ${MAX_BODY_BYTES} bytes` };
    }
    try {
      return { path: rel, body: readFileSync(abs, 'utf8'), bytes: st.size };
    } catch {
      return { path: rel, unread: 'body could not be read' };
    }
  });
}

/**
 * The categories this project waives the raise of (`WAIVER_KEY`), validated once per command, not once per phase.
 * A value outside the vocabulary is named and waives nothing, which fails toward raising. Not the fail-safe-whole-list
 * rule its `surfaces` sibling uses: a bad entry there widens the blocking gate, and dropping one here already widens.
 * @param {any} cfg @param {string[]} warnings @returns {string[]}
 */
function waivedSurfaces(cfg, warnings) {
  const wrote = cfg.triggerWaivers.risk_surface;
  if (wrote === undefined) return [];
  const vocab = riskCategories();
  if (!Array.isArray(wrote)) {
    warnings.push(`${WAIVER_KEY}=${JSON.stringify(wrote)} is not a list; `
      + 'no raise is waived');
    return [];
  }
  const kept = wrote.filter((x) => typeof x === 'string' && vocab.includes(x));
  const bad = wrote.filter((x) => !(typeof x === 'string' && vocab.includes(x)));
  if (bad.length) {
    warnings.push(`${WAIVER_KEY}: ${bad.map((x) => JSON.stringify(x)).join(', ')} `
      + `${bad.length === 1 ? 'is' : 'are'} not one of [${vocab.join(', ')}]; `
      + `${bad.length === 1 ? 'it waives' : 'they waive'} nothing`);
  }
  return kept;
}

/**
 * The plan-time risk floor: it makes the plan review blocking and turns deep-verify on, and names no level. It returns
 * whether it raised and why, appending to `reason` and `warnings`, so a gate change can't pass for config.
 * Never `ok:false`, never a model or effort change. No plan or no phase in hand computes nothing and says so.
 * An unread scope raises (fail closed, as lib/phase-plans.mjs states), and `reason` tells it from a surface hit.
 * `planKey` names one plan, so a risky sibling can't raise a clean one; no key means the phase's union, and a key
 * naming no plan file fails closed, not to the union.
 * @param {{role: string, planningRoot: string, phase: any, planKey: any, cfg: any,
 *   surfaces: string[], waived: string[], reason: string[], warnings: string[]}} ctx
 * @returns {{raised: boolean, surface: string|null, signal: string|null,
 *   file: string|null, bytes: number}}
 */
function riskFloor(ctx) {
  const { role, planningRoot, phase, planKey, cfg, surfaces, waived, reason, warnings } = ctx;
  /**
   * Nothing was computed, so no `risk floor: ` prefix: "nothing raised it" and "nothing looked" must not share one
   * spelling.
   */
  const notComputed = (why) => {
    reason.push(`no risk-floor computation: ${why}; the plan review and the `
      + 'deep-verify pass stand where the config leaves them');
    return { raised: false, surface: null, signal: null, file: null, bytes: 0 };
  };

  // No floor is computed for either of these.
  if (PRE_PLAN_ROLES.includes(role)) {
    return notComputed(`${role} is dispatched before a plan exists and reads none`);
  }
  if (phase === null || phase === undefined) {
    return notComputed('no --phase and no readable cursor, so no plan was named');
  }

  const scoped = planKey !== undefined;
  return floorFor({
    scope: scoped
      ? declaredPlanFiles(planningRoot, phase, planKey)
      : declaredPhaseFiles(planningRoot, phase),
    scoped,
    scopeName: scoped ? `phase ${phase} plan ${planKey}` : `phase ${phase}`,
    // Repo root is the planning root's parent, which keeps a `--file` at another tree from reading this one's files.
    repoRoot: dirname(planningRoot),
    surfaces,
    waived,
    reason,
    warnings,
  });
}

/**
 * The scope-to-answer half of the floor, and the only implementation of the rule: given a scope already read off
 * disk, decide whether it's raised and what evidenced it.
 * `scoped` is a rendering fact: one plan or a set, "this plan declared no files" versus "1 of 3 plans declared none".
 * `raised` is true on a non-waived match and on a scope that couldn't be read whole, which carries no surface.
 * `bytes` is the on-disk size of the declared bodies opened, on every arm, so a scope that read 4 MB shows it.
 * @param {{scope: any, scoped: boolean, scopeName: string, repoRoot: string,
 *   surfaces: string[], waived: string[], reason: string[], warnings: string[]}} ctx
 * @returns {{raised: boolean, surface: string|null, signal: string|null,
 *   file: string|null, bytes: number}}
 */
function floorFor(ctx) {
  const { scope, scoped, scopeName, repoRoot, surfaces, waived, reason, warnings } = ctx;
  /** Set below from the entries this scope opened; declared here so every return arm carries it. */
  let bytes = 0;
  /** Nothing raised the floor - the shape every non-raise arm returns. */
  const none = () => ({ raised: false, surface: null, signal: null, file: null, bytes });

  for (const w of scope.warnings) warnings.push(w);
  const entries = declaredBodies(repoRoot, scope.files);
  bytes = entries.reduce((n, e) => n + (typeof e.bytes === 'number' ? e.bytes : 0), 0);
  const { matches, withheld } = scanDeclared(entries, surfaces);

  // What the line-kind exemption cost this scope, said before any arm because it's true on every arm: a raise that used
  // to rest on an import or a constant now names the file and surface that stopped counting.
  // A `reason`, not a `warning`: warnings are inputs it couldn't read, and this one it read and judged.
  for (const w of withheld) {
    reason.push(`risk floor: ${scopeName}: ${w.path} evidences ${w.category} `
      + 'only on an import or a constant declaration, which no longer counts');
  }

  // Waived per match, not per scan: waiving `secrets` on a phase that also touches `destructive` still raises.
  const waivedHits = matches.filter((m) => waived.includes(m.category));
  const hit = matches.find((m) => !waived.includes(m.category));

  // Which file produced the winning signal; compared on the signal string since files can share a category.
  const evidencedBy = (category, signal) => {
    for (const e of entries) {
      const m = scanDeclared([e], [category]).matches[0];
      if (m && m.signal === signal) return e.path;
    }
    return null;
  };

  // A scope proves itself clean only when it held a conforming plan, every plan read clean and declared a path, and
  // every declared body that exists was opened. Each half was learned separately: `clean === found` so one unreadable
  // plan raises the whole mixed phase, `found > 0` because no plan read is not a clean phase, `undeclared` because a
  // plan copied from the template scanned zero files and passed, `unread` because a plan naming an oversized or
  // symlinked source passed on evidence nobody opened.
  const undeclared = Array.isArray(scope.undeclared) ? scope.undeclared : [];
  for (const f of undeclared) {
    warnings.push(`risk floor: ${scopeName}: ${f} declares no files at all, `
      + 'so the scope did not read clean and the floor is raised');
  }
  const unread = entries.filter((e) => typeof e.unread === 'string');
  for (const e of unread) {
    warnings.push(`risk floor: ${scopeName} declares ${e.path}, unread `
      + `(${e.unread}), so the scope did not read clean and the floor is raised`);
  }
  const read = scope.found > 0 && scope.clean === scope.found
    && undeclared.length === 0 && unread.length === 0;

  // Every waiver applied is stated (key, surface, file): a silent waiver is what this seam refuses everywhere else.
  for (const m of waivedHits) {
    const wat = evidencedBy(m.category, m.signal);
    reason.push(`risk floor: ${scopeName}: `
      + `${wat ? `${wat} touches` : 'a declared file touches'} ${m.category} `
      + `(${m.signal}); the raise is waived by ${WAIVER_KEY}`);
  }

  const plans = (n) => `${n} plan${n === 1 ? '' : 's'}`;

  if (hit) {
    const at = evidencedBy(hit.category, hit.signal);
    const where = at ? `${at} touches` : 'a declared file touches';
    reason.push(`risk floor: ${scopeName}: ${where} ${hit.category} `
      + `(${hit.signal}); the plan review is raised to blocking and the `
      + 'deep-verify pass is turned on');
    return { raised: true, surface: hit.category, signal: hit.signal, file: at, bytes };
  }

  // All matches waived isn't no match, so it gets its own sentence, and it still has to read clean to stand down.
  if (read) {
    if (waivedHits.length) {
      reason.push(`risk floor: ${scopeName}: every matched surface is waived by `
        + `${WAIVER_KEY}, so nothing is raised`);
      return none();
    }
    reason.push('risk floor: '
      + (scoped
        ? `${scopeName} read clean, declaring `
        : `${scopeName}: ${plans(scope.found)} read clean, declaring `)
      + `nothing that touches [${surfaces.join(', ')}], so nothing is raised`);
    return none();
  }

  // No surface and no evidence are different sentences: a scope read whole that matched nothing proved itself clean,
  // and one with nothing readable proved nothing. Calling that clean is how a phase whose risky plan is the unreadable
  // one drops the blocking review.
  const why = scope.found === 0
    ? (scoped
      ? `${scopeName} names no plan file this could read`
      : `${scopeName} holds no plan file this could read`)
    : scope.clean !== scope.found
      ? `${scope.found - scope.clean} of ${plans(scope.found)} in ${scopeName} `
        + 'could not be read'
      // The plans read clean but named nothing to scan; "declaring nothing that touches [...]" would call that clean.
      : undeclared.length
        ? (scoped
          ? `${scopeName} declared no files at all`
          : `${undeclared.length} of ${plans(scope.found)} in ${scopeName} `
            + 'declared no files at all')
        // The plans read clean but a declared body didn't, so "could not be read" about the plans would be false.
        : `${unread.length} declared file${unread.length === 1 ? '' : 's'} in `
          + `${scopeName} went unread`;
  reason.push(`risk floor: ${why}, so no surface could be computed; the plan `
    + 'review is raised to blocking and the deep-verify pass is turned on rather '
    + 'than resting on a scope nobody read');
  // No surface on purpose: nothing was proved, and naming one would cite evidence it never had.
  return { raised: true, surface: null, signal: null, file: null, bytes };
}

function resolve(opts) {
  // Trace phase is `--phase` when it parses, else the cursor; with neither nothing is recorded, since an event keyed to
  // no phase joins nothing.
  // `--planning-root` moves where the phase, the plans and the risk floor are read from, apart from `--file`, which
  // still says which config is read. A scratch config copy would otherwise move the floor's tree with it.
  const planningRoot = opts.planningRoot || dirname(opts.file);
  let tracePhase = null;
  try {
    // Only set when it parsed clean: `parseArgs` already refused a malformed spelling.
    tracePhase = opts.phase !== undefined ? opts.phase : cursorPhase(planningRoot);
  } catch { /* tracing must never change the answer */ }

  // No argument diagnostics here: `--phase` once fell silently through to the cursor, so a typo answered ok:true about
  // a phase nobody named.
  // The floor is why `parseArgs` refuses it now: a typo would compute the floor off the cursor's phase.

  // The dispatch half of the worker's lifecycle bracket, written before any resolution because the caller dispatches on
  // every arm, degraded ones included.
  // Gated on ok:true it would leave those unpaired. The close half stays with the caller, which alone sees the return
  // and its tokens. Best effort: `appendEvent` never throws and a failed bracket changes no envelope byte.
  // The one unbracketed arm is a schema that fails to parse, where the close shows as unpaired in `trace render`; that
  // is signal on an arm so rare.
  // `--no-record` skips both appends whatever `--phase` or `--bracket-read` say: a preview resolves twice and writes nothing.
  const record = !opts.noRecord;
  if (record && opts.bracketRead && tracePhase !== null) {
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
    } catch { /* tracing must never change the answer */ }
  }

  // Read before the role check so a mistyped role still reports a retired key that is redirecting every other dispatch.
  const cfg = readConfig(opts.file);

  // Routable roles are the ones lib/rung-agent.mjs files rungs for; a second list could say ok:true about an impossible
  // dispatch.
  const roles = Object.keys(RUNG_FILES);
  if (!roles.includes(opts.role)) {
    const degraded = [...cfg._warnings];
    out({ ok: false, reason: 'unknown-role', role: opts.role,
      detail: `known roles: ${roles.join(', ')}`,
      hint: 'pass --role as one of the roles the detail lists, spelled exactly, and re-run',
      ...(degraded.length ? { warnings: degraded } : {}) });
    return;
  }

  // Which layers were read, nothing more; the only place a resolve says whether the global file was found.
  const reason = [`config layers: ${cfg._source}`];

  // An array like config.mjs get, since several can be true at once; built before the floor so its diagnostics ride on
  // it.
  const warnings = [...cfg._warnings];

  // Decided here, not at its warning block below, because the floor is scoped by it and runs before the rung and model
  // resolve.
  // Only the decision is hoisted; moving the warnings would reorder `warnings[]` for callers that read it positionally.
  // Unanswered gets all eight, the safe direction.
  const tableCategories = riskCategories();
  const wroteSurfaces = cfg.triggerSurfaces.risk_surface;
  const decided = answeredSurfaces(wroteSurfaces, tableCategories);
  const surfaces = decided.surfaces;
  const surfacesAnswered = decided.answered;

  // The risk floor for this dispatch: it moves no level or rung, only the plan gate and the deep-verify switch below.
  const floor = riskFloor({
    role: opts.role, planningRoot, phase: tracePhase, planKey: opts.plan,
    cfg, surfaces, waived: waivedSurfaces(cfg, warnings), reason, warnings,
  });

  // The agent file carries the effort (route.mjs reports it, can't set it), and the unsuffixed file is one rung among
  // others, so the file comes from the map in lib/rung-agent.mjs.
  // Fail-open: a rung the map lacks is self-verify's problem, and this dispatches the unsuffixed file and says so.
  const agentFor = (rung) => {
    const stem = rungFile(opts.role, rung);
    if (stem) return stem;
    reason.push(`rung "${rung}" maps to no agent file; dispatching ${opts.role}`);
    return opts.role;
  };

  // This role's roles-block entry, read once for the rung here and the model below.
  const roleEntry = roleEntryIn(cfg.roles, opts.role);

  // The start rung comes from the first of two sources naming a rung this role has a file for: `roles.<role>.effort`,
  // then that key's schema default.
  // A source naming a rung this role lacks loses its turn with a warning; only a hand-edited config gets there, and
  // holding the dispatch would drop the caller to the base agent.
  // Never hand an unfiled rung to `agentFor`: it fails open to the unsuffixed file while `effort` still reports the
  // rung asked for.
  const rolesEffortKey = `roles.${opts.role}.effort`;
  const rolesEffort = roleEntry.effort;
  const rolesEffortSet = rolesEffort !== null && rolesEffort !== undefined;
  const hasRungs = Object.keys(RUNG_FILES[opts.role] || {});
  const schemaEffort = schemaRow(rolesEffortKey).default;
  const rungSources = [
    ...(rolesEffortSet ? [{ key: rolesEffortKey, value: rolesEffort, set: true }] : []),
    { key: `config.schema.json's ${rolesEffortKey}`, value: schemaEffort, set: false },
  ];
  /** @type {string|null} */
  let effort = null;
  for (const src of rungSources) {
    if (typeof src.value === 'string' && rungFile(opts.role, src.value)) {
      effort = src.value;
      reason.push(src.set
        ? `${src.key}="${src.value}" (config${src.value === schemaEffort
          ? ', already the schema default rung' : `, over the schema default "${schemaEffort}"`})`
        : `${src.key} default "${src.value}" (unset in layers)`);
      break;
    }
    warnings.push(`${src.key}=${JSON.stringify(src.value)} names no rung this role has `
      + `(${hasRungs.join(', ')}); the next source down answers`);
  }
  if (effort === null) {
    // The schema's own default is broken. Degrade instead of dispatching: half a bundle read as a whole one is worse
    // than none, and `effort` picks the agent file.
    // self-verify's `effort-default-invalid` stops this reaching a user. This uses the live warnings array, which
    // already holds the floor's diagnostics.
    out({ ok: false, reason: 'unresolved', role: opts.role,
      hint: `config.schema.json's ${rolesEffortKey} default names no rung this role has `
        + `(${hasRungs.join(', ')}) - restore the shipped schema, a hand-edited default being `
        + 'the usual cause, then re-run',
      ...(warnings.length ? { warnings } : {}) }); return;
  }

  let agent = agentFor(effort);
  let escalated = false;

  // Escalation is one rung up from where this dispatch started: a retry never thinks less than the failed attempt and
  // never skips. At the top rung it holds and says so, since reporting an escalation that moved nothing is the
  // resolved-then-dropped shape.
  // The ladder is `RUNG_ORDER`, never data, and a rung this role has no file for is stepped over, not dispatched.
  if ((opts.attempt || 1) > 1) {
    if (cfg.escalate_on_failure) {
      const at = RUNG_ORDER.indexOf(effort);
      let target = null;
      for (let i = at + 1; at >= 0 && i < RUNG_ORDER.length; i += 1) {
        if (rungFile(opts.role, RUNG_ORDER[i])) { target = RUNG_ORDER[i]; break; }
      }
      if (target) {
        escalated = true;
        agent = agentFor(target);
        reason.push(`rung ${effort}->${target} (${agent})`);
        effort = target;
      } else {
        reason.push(`rung held at ${effort} (the top rung this role files - `
          + 'a retry cannot climb past it)');
      }
    } else {
      reason.push(`rung held at ${effort} (model.escalate_on_failure: false)`);
    }
  }

  // A gate a layer set beats the schema default, and the disagreement is spoken. Default-wins would make a key the user
  // set stop doing anything.
  // The walk is over the triggers the schema defines a gate for, from `gateTriggers`, shared with self-verify's
  // agreement check.
  // A gate has to be one of the key's own values before it can win: a typo (`"blockign"`) once silently replaced the
  // blocking `risk_surface` gate. `gateWon` records whether a valid configured gate answered, and the floor tests that,
  // not key presence.
  const review = {};
  /** @type {Record<string, boolean>} */
  const gateWon = {};
  for (const trigger of gateTriggers(schemaKeys())) {
    const key = `review.triggers.${trigger}.gate`;
    const gateNames = schemaValues(key);
    const dflt = schemaRow(key).default;
    const configured = cfg.triggerGates[trigger];
    gateWon[trigger] = false;
    if (configured !== undefined && configured !== dflt) {
      if (!gateNames.includes(configured)) {
        // Same as an unknown model alias: name it, let the resolved value stand, never block the spawn.
        review[trigger] = dflt;
        warnings.push(`${key}=${JSON.stringify(configured)} is not one of `
          + `[${gateNames.join(', ')}]; the schema default ${JSON.stringify(dflt)} stands`);
        continue;
      }
      review[trigger] = configured;
      gateWon[trigger] = true;
      reason.push(`${key}="${configured}" (config, wins over the schema default `
        + `${JSON.stringify(dflt)})`);
    } else {
      review[trigger] = dflt;
      if (configured !== undefined) gateWon[trigger] = gateNames.includes(configured);
      if (configured === undefined) reason.push(`${key}: schema default ${JSON.stringify(dflt)}`);
    }
  }

  // The floor's two effects, and only two. `verify` has no config key: it's `on` when the floor raised and `off`
  // otherwise.
  // `workflow.verifier` stays the off switch workflows/verify.md reads, and `--deep` the manual on switch.
  let verify = floor.raised ? 'on' : 'off';
  if (floor.raised) {
    const planKey = 'review.triggers.plan.gate';
    const gates = schemaValues(planKey);
    const answer = review.plan;
    if (gateWon.plan) {
      // A gate the user validly set is what fires, and the floor says it moved nothing.
      reason.push(`risk floor: ${planKey}="${answer}" is configured, so the floor `
        + 'moved no gate');
    } else if (gates.indexOf(answer) < gates.indexOf(FLOOR_GATE)) {
      const wrote = cfg.triggerGates.plan;
      reason.push(`risk floor: plan review ${JSON.stringify(answer)} -> `
        + `"${FLOOR_GATE}"${wrote !== undefined
          ? ` (${planKey}=${JSON.stringify(wrote)} is not one of `
            + `[${gates.join(', ')}], so it never won resolution and does not `
            + 'withhold the raise)'
          : ''}`);
      review.plan = FLOOR_GATE;
    } else {
      reason.push(`risk floor: the plan review already answers ${JSON.stringify(answer)}, `
        + `at or above "${FLOOR_GATE}"`);
    }
  }

  // The other half of a fire: the gate map says whether a trigger fires, this says who it fires to. Resolved here
  // because a blocking risk_surface review once went to a same-model subagent despite `openai` being set.
  // `claude-subagent` is always available. Any other name needs a model id at this trigger's tier and a place in the
  // user-global `review.reviewers`: a repo layer arrives with a clone and would spend their key.
  // An empty set falls back to `claude-subagent`, or a blocking trigger stops gating.
  // Tier and effort get own maps: `reviewer_efforts`, never `efforts`, since `effort` is the agent rung.
  const wantedReviewers = cfg.reviewers ?? DEFAULTS.reviewers;
  const reviewers = {};
  /** @type {Record<string, any>} */
  const reviewerTiers = {};
  /** @type {Record<string, any>} */
  const reviewerEfforts = {};
  // A layer's tier or effort has to be one of the key's own values before it can win, like a gate: review-provider.mjs
  // validates neither, and the OpenAI adapter sends `reasoning.effort` verbatim.
  // A repo layer arrives with a clone, so an out-of-vocabulary string or an object would reach the fire site unwarned.
  // Name it, schema default stands.
  for (const trigger of Object.keys(review)) {
    const tierKey = `review.triggers.${trigger}.tier`;
    const effortKeyName = `review.triggers.${trigger}.effort`;
    const tierNames = schemaValues(tierKey);
    const effortNames = schemaValues(effortKeyName);
    const tierDefault = schemaRow(tierKey).default;
    const effortDefault = schemaRow(effortKeyName).default;
    let setTier = cfg.triggerTiers[trigger];
    if (setTier !== undefined && !tierNames.includes(setTier)) {
      warnings.push(`${tierKey}=${JSON.stringify(setTier)} is not one of `
        + `[${tierNames.join(', ')}]; the schema default `
        + `${JSON.stringify(tierDefault ?? null)} stands`);
      setTier = undefined;
    }
    const tier = setTier !== undefined ? setTier : tierDefault;
    const tierFrom = setTier !== undefined ? tierKey : `${tierKey}'s schema default`;
    let setEffort = cfg.triggerEfforts[trigger];
    if (setEffort !== undefined && !effortNames.includes(setEffort)) {
      warnings.push(`${effortKeyName}=${JSON.stringify(setEffort)} is not one of `
        + `[${effortNames.join(', ')}]; the schema default `
        + `${JSON.stringify(effortDefault ?? null)} stands`);
      setEffort = undefined;
    }
    const effortFor = setEffort !== undefined ? setEffort : effortDefault;
    // `null`, never a dropped key: the fire site indexes these maps, and absent must not look like unresolved.
    reviewerTiers[trigger] = tier ?? null;
    reviewerEfforts[trigger] = effortFor ?? null;
    const kept = [];
    const dropped = [];
    for (const name of wantedReviewers) {
      if (name === 'claude-subagent') { kept.push(name); continue; }
      if (!providerModel(cfg.providers, name, tier)) {
        const held = configuredTierId(cfg.providers, name, tier);
        dropped.push(tier
          ? (held !== null && held.trim()
            ? `${name}'s review.providers.${name}.tiers.${tier} is ${JSON.stringify(held)}, `
              + `which is not a model id (tier from ${tierFrom})`
            : `${name} has no model id at the "${tier}" tier `
              + `(review.providers.${name}.tiers.${tier}, tier from ${tierFrom})`)
          : `${name} cannot be placed: the ${trigger} trigger resolves no tier `
            + `(no config layer set one and ${tierKey} carries no schema default)`);
        continue;
      }
      if (!cfg.reviewersGlobal.includes(name)) {
        dropped.push(cfg.layersShared
          ? `${name} cannot be enabled: the user-global config ${GLOBAL_CONFIG} resolves to the repository's `
            + 'own config file, so the two layers are one file, and one file cannot enable a cross-model '
            + 'provider on its own - point the user-global config at a separate file (CADENCE_GLOBAL_CONFIG, '
            + `or ~/.claude/cadence/config.json when that is unset) and name ${name} in its review.reviewers`
          : `${name} is not named by the user-global config's review.reviewers, `
            + 'and a repository\'s review.reviewers alone cannot enable a cross-model provider');
        continue;
      }
      kept.push(name);
    }
    // The cause travels in the return instead of being inferred from a smaller set; one warning per trigger, as the
    // tier is.
    if (kept.length && dropped.length) {
      warnings.push(`${trigger}: ${dropped.join('; ')}; dropped from the reviewer set, `
        + `leaving [${kept.join(', ')}]`);
    } else if (!kept.length) {
      warnings.push(`${trigger}: no configured reviewer is available `
        + `(${dropped.join('; ')}); falling back to claude-subagent`);
    }
    reviewers[trigger] = kept.length ? kept : ['claude-subagent'];
  }

  // The third half of a fire: a category outside the resolved set doesn't fire `risk_surface`. Resolved here so a
  // cost-control key doesn't depend on a model remembering to read config.
  // Absence means all eight, never none, and `surfaces_answered` says which, so the one-time ask can tell them apart.
  // The predicate lives in lib/surface-scan.mjs because `planning.mjs risk-check run` refuses on the same answer.
  if (wroteSurfaces !== undefined) {
    const { kept, bad } = decided;
    if (!Array.isArray(wroteSurfaces)) {
      warnings.push(`review.triggers.risk_surface.surfaces=${JSON.stringify(wroteSurfaces)} is not a list; `
        + `all ${tableCategories.length} categories stand`);
    } else if (bad.length) {
      warnings.push(`review.triggers.risk_surface.surfaces: ${bad.map((x) => JSON.stringify(x)).join(', ')} `
        + `${bad.length === 1 ? 'is' : 'are'} not one of [${tableCategories.join(', ')}]`);
    }
    // A list with any unrecognised entry fails safe: all categories stand and the question reads as unanswered, not the
    // valid subset. `["auth", "secret"]` is a typo for `secrets`, not a decision to stop reviewing secret handling, and
    // the subset would hush the one-time question for good.
    if (kept.length && !bad.length) {
      // Nothing to set: decided.answered already covers this arm.
    } else if (bad.length) {
      warnings.push('review.triggers.risk_surface.surfaces carries an unrecognised entry; '
        + `all ${tableCategories.length} stand, and the surface question reads as unanswered`);
    } else if (Array.isArray(wroteSurfaces)) {
      warnings.push('review.triggers.risk_surface.surfaces resolves to no category; '
        + `all ${tableCategories.length} stand, and the surface question reads as unanswered`);
    }
  }

  // Model comes from `roles.<role>.model`. Unset is `model: null`, the session's model. It never touches effort, which is
  // fixed per agent file.
  // A string the host won't accept is dropped with a warning: ok:false would lose the rung with the model, and a
  // pass-through fails the host's validation on every dispatch.
  // `pinned` is always false now and stays in the envelope and on the event, because seam JSON is additive only.
  /** @type {string|null} */
  let model = null;
  const pinned = false;
  let modelSource = 'session';
  const rolesModel = roleEntry.model;
  const rolesModelKey = `roles.${opts.role}.model`;
  if (rolesModel !== null && rolesModel !== undefined) {
    if (HOST_MODELS.includes(rolesModel)) {
      reason.push(`${rolesModelKey}=${rolesModel} (config)`);
      model = rolesModel;
      modelSource = rolesModelKey;
    } else {
      warnings.push(`${rolesModelKey}=${JSON.stringify(rolesModel)} is not a model the host `
        + `accepts (${HOST_MODELS.join(', ')}); no model parameter is sent and the dispatch `
        + "runs at the session's model");
      reason.push(`${rolesModelKey} ignored (the host does not accept it); no model parameter`);
    }
  } else {
    reason.push('no model key set; no model parameter, the session\'s model runs');
  }

  // The routing family of the run record, one line per resolve. It carries the decision, not the diagnostic text:
  // `warning_count` is a count because the envelope has the strings.
  // Best effort: `appendEvent` never throws and this sits in its own try, so a trace that can't be written leaves the
  // envelope byte-identical.
  try {
    if (record && tracePhase !== null) {
      appendEvent(planningRoot, {
        phase: tracePhase,
        family: 'routing',
        event: 'resolve',
        role: opts.role,
        agent,
        model,
        // `model_source` took `stakes`'s place: without it a `null` model the user asked for looks like one nothing
        // set.
        model_source: modelSource,
        effort,
        escalated,
        pinned,
        attempt: opts.attempt || 1,
        warning_count: warnings.length,
      });
    }
  } catch { /* tracing must never change the answer */ }

  // `review` is the whole trigger -> gate map, `reviewers` the trigger -> reviewer-set map, `surfaces` and
  // `surfaces_answered` the risk_surface scope, `verify` the deep-verify switch the floor turns on.
  // `model_source` is always present, so `model: null` unset reads differently from `model: null` rejected.
  // `agent_type` is plugin.json's name, `:`, then the final `agent`: a bare stem could be a user's own `cad-reviewer`.
  // `agent` stays the bare stem because it's the trace name.
  const prefixed = prefixedAgentType(agent);
  if (prefixed.reason) reason.push(prefixed.reason);
  out({ ok: true, role: opts.role, agent, agent_type: prefixed.agentType, model, model_source: modelSource, effort, review, reviewers, reviewers_global: cfg.reviewersGlobal, reviewer_tiers: reviewerTiers, reviewer_efforts: reviewerEfforts, surfaces, surfaces_answered: surfacesAnswered, verify, escalated, pinned, attempt: opts.attempt || 1, reason, ...(warnings.length ? { warnings } : {}) });
}

// --- arg parsing -------------------------------------------------------------

// The whole synopsis, printed when `--role` is absent rather than valueless: with no role there's no call to describe,
// so the refusal is the help.
// A role with nothing usable after it gets the specific sentence in the table below.
const SYNOPSIS = 'resolve --role <name> [--attempt N] [--file <config>] [--phase N]'
  + ' [--plan <key>] [--bracket-read <csv> [--bracket-plan <key>]] [--no-record] [--planning-root <dir>]';

// The rows in lib/arg-contract.mjs own each flag's rule and this table owns only the sentence, since route.mjs mints
// no reason code of its own: every refusal is `usage`. Order is load-bearing, the first failing flag names the refusal.
// `--phase` refuses instead of warning, because a warning would compute a floor off the cursor's phase unnoticed.
const RESOLVE_FLAGS = {
  '--role': ['role', 'resolve --role needs a role name after it: --role <name>'],
  '--attempt': ['attempt', 'resolve --attempt must be an integer'],
  // `o.file` reaches `dirname()`, so a valueless one used to escape as "internal" with a raw Node type error. Refuses
  // both spellings, like config.mjs: unquoted `$VAR` drops the token, quoted `"$VAR"` passes an empty one, and
  // defaulting either would answer about a file nobody named.
  '--file': ['file', 'resolve --file needs a path after it: --file <config file>'],
  // `--bracket-read` switches the lifecycle dispatch event on and carries the site's read-set (one comma-separated
  // value); `--bracket-plan` is the worker key when it isn't the role name.
  // Recording a bracket for a read-set nobody named would claim a site read nothing when a token merely went missing.
  '--bracket-read': ['bracketRead', 'resolve --bracket-read needs a comma-separated path list after it'],
  '--bracket-plan': ['bracketPlan', 'resolve --bracket-plan needs a worker key after it'],
  // The floor's scope. Refused when valueless, unlike `--bracket-plan`: it would silently widen to the whole phase.
  '--plan': ['plan', 'resolve --plan needs a plan key after it: --plan <k>'],
  // Last, so the older flags still name the refusal first on a call malformed in two places.
  '--phase': ['phase', 'resolve --phase must be a phase number: --phase <N|N.M>'],
  // Presence only. A valueless `--planning-root` refuses: it would read plans off the wrong tree unnoticed.
  '--no-record': ['noRecord', 'resolve --no-record takes no value'],
  '--planning-root': ['planningRoot', 'resolve --planning-root needs a directory after it: --planning-root <.planning dir>'],
};

function parseArgs(a) {
  const rows = CONTRACTS['route.mjs'].resolve;
  const o = { file: '.planning/config.json', attempt: 1 };
  for (const [flag, [key, detail]] of Object.entries(RESOLVE_FLAGS)) {
    const parsed = evaluateFlag(a, flag, rows[flag]);
    if (!parsed.ok) {
      o.usage = flag === '--role' && !a.includes(flag) ? SYNOPSIS : detail;
      return o;
    }
    // A `fallback` or absent flag reads undefined and leaves this object's default; no row here declares `warn`.
    if (parsed.value !== undefined) o[key] = parsed.value;
  }
  // An absent `--phase` still falls to the STATE cursor: the loop above is a value door, and a flag nobody passed
  // reaches no row.
  return o;
}

// Every agent file stem Cadence ships. A typo or an already-prefixed name is refused instead of doubling the prefix.
const AGENT_STEMS = new Set(Object.values(RUNG_FILES).flatMap((rungs) => Object.values(rungs)));

/**
 * `agent-type --stem <name>`: the prefixed name for a dispatch that resolves no routing (`/cad-minimalism-review`,
 * `/cad-decision-review`). Reads no config, picks no rung and appends no trace event, so those workflows' "resolves no
 * routing at all" stays true. Prefix and fallback come from the same `prefixedAgentType` `resolve` calls. Every refusal
 * is `usage` and names `--stem`.
 * @param {string[]} a
 */
function agentType(a) {
  const parsed = evaluateFlag(a, '--stem', CONTRACTS['route.mjs']['agent-type']['--stem']);
  if (!parsed.ok) {
    out({ ok: false, reason: 'usage', detail: 'agent-type --stem needs an agent file stem after it: --stem <name>' });
    return;
  }
  if (!AGENT_STEMS.has(parsed.value)) {
    out({ ok: false, reason: 'usage',
      detail: `agent-type --stem ${JSON.stringify(parsed.value)} names no Cadence agent file; pass a bare stem such as cad-reviewer` });
    return;
  }
  const { agentType: prefixed, reason } = prefixedAgentType(parsed.value);
  out({ ok: true, agent: parsed.value, agent_type: prefixed, reason: reason ? [reason] : [] });
}

try {
  // Fatal: every gate, tier, effort and start rung is a schema default, and a hand-kept copy would be a second opinion.
  try {
    SCHEMA = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'));
  } catch (e) {
    fail('bad-schema', `cannot read/parse ${SCHEMA_PATH}: ${e.message}`,
      'restore config.schema.json at the path the detail names - a partial or damaged plugin install is the usual cause - then re-run');
  }
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (cmd === 'resolve') {
    // The argument-shape refusal carries no `warnings`: it fails before any config file is named, so no layer was read.
    const o = parseArgs(argv.slice(1));
    if (o.usage) out({ ok: false, reason: 'usage', detail: o.usage });
    else resolve(o);
  } else if (cmd === 'agent-type') {
    agentType(argv.slice(1));
  } else {
    out({ ok: false, reason: 'usage', detail: 'subcommand: resolve | agent-type' });
  }
} catch (e) {
  if (e !== DONE) out({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
}
