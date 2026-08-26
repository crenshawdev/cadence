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
//           [--plan <key>] [--bracket-read <csv> [--bracket-plan <key>]]
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
//   stakes                     solo | shipped | critical - the FLOOR a dispatch
//                              resolves at or above, never the level every
//                              phase pays. Unset floors at "solo" when the
//                              phase's plans were all read clean, and at the
//                              schema default "shipped" when any of them could
//                              not be
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
//                              to, returned as `surfaces` - and the same set
//                              the plan-time floor below is scoped by, so a
//                              project that narrowed the surface question
//                              narrowed what can raise its level too. Absent
//                              from both layers means ALL of the table's
//                              `risk_surface_categories`, and
//                              `surfaces_answered` says which of the two it is,
//                              so "chose everything" and "never answered" stay
//                              apart (D-12)
//
// THE CONFIGURED LEVEL IS A FLOOR, NOT THE ANSWER (CER-01). `stakes` states the
// MINIMUM a project will accept; the phase's own declared `files:`, read here at
// resolve time, are what raise it. So a phase touching nothing on a risk surface
// resolves BELOW what the project default produces today, and a phase touching
// one never resolves lower than it does now. An unset `stakes` floors at `solo`
// and the raise does the work; an EXPLICIT `stakes` is never resolved below, at
// any level.
//
// AND IT FAILS CLOSED, which is the direction that matters. A plan this cannot
// read holds the CONFIGURED stakes and never `ok:false`: an `ok:false` drops the
// caller to the base agent at the host session default with no model override
// (references/seams.md), which is below every floor, so a hard refusal here
// would route a risky phase LOWER than its own baseline. The discount below the
// configured level is earned only by a scope every conforming plan of which was
// found, read clean and declared something to scan, so one member that was not
// read holds the whole scope up.
//
// THIS IS NOT THE DELETED NAME-KEYED FLOOR RETURNING. That one judged a file by
// its NAME and raised a whole phase on one path token - `tests/ingest_concurrency.rs`
// took six roles to their top rung, 15 of 16 resolves floored on opus - and its
// waiver family (`risk.override.<surface>`) stays retired in
// lib/retired-keys.mjs. What runs here is lib/risk-diff.mjs's `scanDeclared`:
// the same anchored construct patterns and whole-path segments the commit-time
// `risk_surface` gate fires on, over the same signal ordering, scoped to the
// categories the project ANSWERED. And the raise target is `shipped`, never
// `critical` - the criterion is that a matched phase resolve no lower than
// today's default, and a `critical` target would put most of a repo's plans on
// the top row and rebuild exactly that raise-tax.
//
// WHICH PHASE, AND WHICH PLAN. `--phase` decides the floor when it is passed and
// the STATE cursor decides it otherwise, so a malformed `--phase` is REFUSED
// rather than answered about another phase's plans. `--plan` narrows the scope
// from the phase's union to ONE plan, which is what an executor dispatch floors
// on: a clean plan in a mixed phase routes below its risky sibling. The two
// roles dispatched BEFORE a plan exists - `cad-planner` and
// `cad-assumptions-analyzer` - are exempt and resolve at the configured stakes,
// because the cursor lags at both their call sites and a floor computed for them
// would be computed off a DIFFERENT phase's file list.

import { readFileSync, lstatSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, isAbsolute, sep } from 'node:path';
import { mergeLayers } from './lib/config-merge.mjs';
import { rungFile, RUNG_FILES } from './lib/rung-agent.mjs';
import { retiredKeysIn } from './lib/retired-keys.mjs';
import { emit as out, DONE } from './lib/seam-io.mjs';
import { evaluateFlag, CONTRACTS } from './lib/arg-contract.mjs';
import { cursorPhase, declaredFilesIn, declaredPhaseFiles, declaredPlanFiles,
  phaseDirsIn } from './lib/phase-plans.mjs';
import { scanDeclared } from './lib/risk-diff.mjs';
import { appendEvent } from './lib/trace.mjs';
import { testSeamOpen } from './lib/test-seam.mjs';
import { answeredSurfaces } from './lib/surface-scan.mjs';

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
// `hint` is the third argument and rides as a conditional key: an absent hint
// adds no key, so no shipped assertion moves (phase-1 D-09/D-10).
const fail = (reason, detail, hint) => {
  out({ ok: false, reason, detail, ...(hint ? { hint } : {}) });
  throw DONE;
};

// Config defaults mirror config.schema.json so a missing/partial config still routes.
const DEFAULTS = { stakes: 'shipped', escalate_on_failure: false,
  reviewers: ['claude-subagent'] };

// The accepted `review.triggers.<t>.gate` vocabulary, used ONLY when the table
// carries no usable `gates` array. Never skip the check on an absent list:
// skipping leaves the hole open on exactly the tables most likely to be wrong -
// an older or hand-edited route-table.json, or one injected through
// CADENCE_ROUTE_TABLE - so a `"blockign"` typo would still reach the bundle
// intact on the very input shape the check exists to cover.
const DEFAULT_GATES = ['off', 'advisory', 'deferred', 'blocking', 'adjudicated'];

// The tier and effort vocabularies get the same fallback the gates do, and for
// the same input shapes: an older or hand-edited route-table.json, or one
// injected through CADENCE_ROUTE_TABLE, that carries no usable list.
const DEFAULT_TIER_NAMES = ['flagship', 'balanced', 'cheap'];
const DEFAULT_EFFORT_NAMES = ['high', 'medium', 'low', 'minimal'];

// The two levels the plan-time floor names, spelled out rather than derived
// from `stakes_order`'s ends. D-07 locks the level vocabulary and the five
// grids, so these are members of a fixed set and not positions in an array a
// hand-edited table could reorder - and each is a decision with its own reason:
//
//   UNSET_FLOOR   what an unset `stakes` floors at once the phase's plans have
//                 been read clean. It is the whole of CER-01's first half: the
//                 schema default `shipped` is what every phase pays today, and
//                 it is what criterion 2's demonstration has to resolve below.
//   RAISE_TARGET  where a matched surface raises to, and deliberately NOT
//                 `critical`. The criterion is that a matched phase resolve no
//                 lower than today's default; raising every match to the top row
//                 is the raise-tax the deleted name-keyed floor died of.
const UNSET_FLOOR = 'solo';
const RAISE_TARGET = 'shipped';

// The level ladder, read off TABLE at call time because the table is loaded
// lazily inside the dispatch below. `higherLevel` returns null when
// `stakes_order` cannot place BOTH levels - a torn or hand-edited table - and
// every caller treats that as "the comparison could not be made" rather than as
// an answer, because a floor asserted off an unplaceable level is a silently
// wrong level, which is worse than none.
const stakesOrder = () => (Array.isArray(TABLE.stakes_order) ? TABLE.stakes_order : []);
// The table's own risk-surface vocabulary, which is what `answeredSurfaces`
// scopes a project's answer against - a table naming fewer categories is
// honoured. Read the same way by both faces that compute a floor.
const riskCategories = () => (Array.isArray(TABLE.risk_surface_categories)
  ? TABLE.risk_surface_categories.filter((c) => typeof c === 'string' && c) : []);
const higherLevel = (a, b) => {
  const order = stakesOrder();
  const ia = order.indexOf(a);
  const ib = order.indexOf(b);
  if (ia < 0 || ib < 0) return null;
  return ib > ia ? b : a;
};

// The ONE key that can route a dispatch below the computed floor, spelled once
// so the schema, the reader, the reason and the refusal cannot drift apart. It
// waives a LEVEL and never a REVIEW: the blocking commit-time `risk_surface`
// gate still fires on the actual diff, which is why the name says `routing`.
// D-03: the eight `risk.override.<surface>` keys v2.0.0 retired stay retired -
// a key cannot live in the schema and the retired registry at once - so the
// floor is given back through a NEW key rather than by reviving those.
const WAIVER_KEY = 'review.triggers.risk_surface.waive_routing_floor';

// The roles dispatched BEFORE a plan exists, exempt from the floor. Both read no
// plan and resolve at the configured stakes: `workflows/context.md` dispatches
// the analyzer while the cursor still names the PREVIOUS phase, and `plan.md`
// dispatches the planner to write the plan the floor would read. A floor
// computed for either is computed off a different phase's file list, which is
// not a safe-direction superset and which no reason string would reveal as
// wrong - a silently-wrong level being strictly worse than no level at all.
const PRE_PLAN_ROLES = Object.freeze(['cad-planner', 'cad-assumptions-analyzer']);

// The bytes the content pass will read from ONE declared file. A `files:` list
// arrives in a PLAN that can arrive with a clone, exactly as a repo config layer
// does (lib/config-merge.mjs states that threat model), and this seam may never
// block the spine: an unbounded read of a path a data file names is how a
// resolve comes to hang on a device node or a multi-gigabyte artifact. A file
// over the cap contributes its PATH signals and no content signals - the same
// arm an absent body already takes.
const MAX_BODY_BYTES = 512 * 1024;

// The `--phase` shape rule lives in ONE place (`lib/require-int.mjs`'s
// `requirePhaseArg`), not in a local regex per script: three independent copies
// is how the same input came to be refused in three different wordings, and how
// the directory component came to be normalized on some surfaces and not
// others. This file no longer calls it DIRECTLY - the flag's declared row in
// lib/arg-contract.mjs names `phase` as its type and that table maps the type
// to this one classifier, so the rule is reached through the declaration rather
// than named twice.

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
    // `review.triggers.risk_surface.waive_routing_floor` - the surfaces whose
    // RAISE this project waives, which is the ONE way to route below the
    // computed floor. Read through the same generic reader for the fifth time
    // and for the same reason: `null` is its schema default precisely so
    // "waived nothing" and "never answered" stay one honest state.
    triggerWaivers: triggerFieldIn(c, 'waive_routing_floor'),
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

/**
 * The declared paths with whatever body each currently HAS, for
 * `scanDeclared`. Repo-relative, so they are read against the planning root's
 * PARENT - which is what keeps a `--file` pointed at another tree from reading
 * this one's files.
 *
 * A body that DOES NOT EXIST is not an error and not an inconclusive state:
 * at plan time a declared file frequently does not exist yet because the plan
 * CREATES it, so the path still travels and only the body it does not have is
 * missing (lib/risk-diff.mjs states why at length).
 *
 * A body that EXISTS AND WAS SKIPPED is the opposite state and carries
 * `unread` saying which arm skipped it. The two were one arm until a
 * `risk_surface` review refuted it: a 600 KiB declared file full of
 * `JSON.parse` calls returned a bare path exactly like a file the plan had yet
 * to write, so its content evidence vanished and the caller's discount
 * predicate - which reads PLAN readability and nothing below it - handed the
 * scope a level BELOW the configured stakes on the strength of a file nobody
 * opened. `unread` is what lets `riskFloor` apply D-04's own argument one level
 * down: nothing read is not evidence of nothing there.
 *
 * WHAT IT REFUSES TO OPEN, and neither is tidiness. A path that is ABSOLUTE or
 * that climbs out of the repo root with `..` gets its path signals and no read
 * at all: the `files:` list is data from a file that can arrive with a clone,
 * no legitimate plan declares a path outside the repository, and a resolve is
 * not a place to open one. That check reads the SPELLING, so two more read what
 * the path RESOLVES to. A non-regular file is refused unopened, because
 * `statSync` follows a symlink and a link to a character device reports size 0,
 * clearing the byte bound and then never reaching EOF. And a path whose REAL
 * location sits outside the repository root is refused for the boundary itself:
 * `lstatSync` declines to follow only the FINAL component, so `a/link/file.mjs`
 * where `link` is a symlinked DIRECTORY resolved outside the tree, was read as
 * evidence, and this function's own claim - that a `--file` pointed at another
 * tree cannot read this one's files - was untrue for any repository whose layout
 * carries such a link (raised by the `risk_surface` re-arm round, adjudicated
 * medium). Containment is judged on `realpathSync`, both sides: the ROOT is
 * resolved the same way and once, or a root itself reached through a link - a
 * temp dir on a linked `/tmp` is the everyday case - would refuse every
 * legitimate path in the tree.
 *
 * A file over `MAX_BODY_BYTES` is the same arm for the bound's own reason. Every
 * read sits in its own try - nothing here throws, and a resolve that could not
 * read a body still returns a whole bundle. What is never done is echo the body:
 * a refused path may hold the very evidence a discount would claim is absent, so
 * saying WHICH file was skipped and why is the whole of the report.
 * @param {string} repoRoot @param {string[]} files
 * @returns {Array<{path: string, body?: string, unread?: string}>}
 */
function declaredBodies(repoRoot, files) {
  // Resolved ONCE, and fail-soft: a root this cannot resolve keeps its literal
  // spelling, which can only ever refuse paths, never admit an outside one.
  let root;
  try {
    root = realpathSync(repoRoot);
  } catch {
    root = repoRoot;
  }
  const inside = (/** @type {string} */ real) =>
    real === root || real.startsWith(root.endsWith(sep) ? root : root + sep);
  return files.map((rel) => {
    // Refused by SPELLING. `unread` and not a bare path: a file this declined
    // to open may hold the very evidence a discount would claim is absent.
    if (isAbsolute(rel) || rel.split('/').includes('..')) {
      return { path: rel, unread: 'path climbs out of the repository' };
    }
    const abs = join(repoRoot, rel);
    let st;
    try {
      st = lstatSync(abs);
    } catch {
      // THE ONE ARM THAT IS NOT `unread`, and the distinction is the whole
      // point: at plan time a declared file frequently does not exist yet
      // because the plan CREATES it. Nothing was skipped, so the path travels
      // with no body and the scope stays discountable.
      return { path: rel };
    }
    // Refused by WHAT THE PATH RESOLVES TO, which the spelling check above
    // cannot see. `statSync` FOLLOWS a symlink, so a link to a character
    // device reports size 0, passes the byte bound below, and is then read to
    // an EOF that never comes - the bounded-I/O guarantee this function claims,
    // escaped by a link the repository itself carries. `lstatSync` + isFile()
    // is that check, and it fails closed: a non-regular declared path is
    // evidence nobody read, never evidence of nothing.
    if (!st.isFile()) return { path: rel, unread: 'not a regular file' };
    // Refused by WHERE IT REALLY IS, which neither check above can see: the
    // spelling is repo-relative and clean, and `lstatSync` followed every
    // component but the last, so a symlinked PARENT directory lands this at a
    // file in another tree. Judged AFTER the regular-file arm on purpose - a
    // link straight to a device is that arm's finding and keeps its wording -
    // and before any read, since the point is that these bytes are not ours.
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
      return { path: rel, body: readFileSync(abs, 'utf8') };
    } catch {
      return { path: rel, unread: 'body could not be read' };
    }
  });
}

/**
 * The categories this project waives the RAISE of (`WAIVER_KEY`), validated
 * ONCE per command against the table's own vocabulary and never per phase - a
 * malformed waiver is a fact about the run, and a replay would otherwise repeat
 * it thirty times.
 *
 * A value outside the vocabulary is NAMED and waives nothing, which is how this
 * file already treats a gate, a tier or an effort outside its own: name it, let
 * the routed value stand. That is also the safe direction here, since the value
 * that fails to parse fails toward RAISING. It is deliberately NOT the
 * fails-safe-whole-list rule its `surfaces` sibling carries: there a bad entry
 * widens the blocking gate's scope, and here dropping one entry is already the
 * widening direction.
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
 * THE PLAN-TIME RISK FLOOR (CER-01). The configured `stakes` is the MINIMUM this
 * dispatch resolves at; the phase's own declared `files:`, scanned here, are
 * what raise it. Returns the level to route on, appends every move it made to
 * `reason` and every input it could not read to `warnings` - both arrays are the
 * caller's own, already built by the time this runs, because a floor that moved
 * a level silently would be indistinguishable from a config that set it.
 *
 * NEVER BELOW THE CONFIGURED LEVEL, and never `ok:false`. Three arms hold the
 * configured level and say so: a role dispatched before a plan exists, no phase
 * in hand at all, and a scope this could not read whole. That last is D-04's
 * aggregation rule - every conforming plan in scope must have been FOUND, read
 * CLEAN and have declared a path to scan before the level may resolve below the
 * configured stakes - and its point is the mixed phase: one member that was not
 * read holds the whole scope up, so a phase whose unreadable plan is the risky
 * one can never resolve below today.
 *
 * PER PLAN FOR AN EXECUTOR, PER PHASE FOR EVERYONE ELSE (D-06). `planKey` names
 * ONE plan of the phase and is what an executor dispatch carries, so a clean
 * plan in a mixed phase routes below its risky sibling; without it the scope is
 * the union of every conforming plan in the phase, which is what a phase-scoped
 * role - `cad-plan-checker`, `cad-verifier`, reviewer resolution - is answering
 * about. A key naming no plan file is NOT the union: it takes the fail-closed
 * arm, because a caller that asked about one plan and was silently answered
 * about six is the wrong answer in the wide direction.
 *
 * THE ADDRESSING HALF ONLY. Which scope this dispatch is about is decided here;
 * what that scope RESOLVES TO is `levelFor` below, which `replay` calls with the
 * same scope addressed by directory instead.
 *
 * WHAT IT RETURNS is `levelFor`'s whole record and not a bare level, because the
 * rung clamp beneath the cell lookup (D-08) fires on a RAISE having fired and on
 * nothing else: a scope that read clean and matched nothing has taken a
 * discount, and clamping the user's configured rung against a discounted cell
 * would take the dial away in exactly the cheap case CER-01 buys.
 *
 * @param {{role: string, planningRoot: string, phase: any, planKey: any, cfg: any,
 *   surfaces: string[], waived: string[], reason: string[], warnings: string[]}} ctx
 * @returns {{level: string, raised: boolean, surface: string|null, signal: string|null,
 *   file: string|null}}
 */
function riskFloor(ctx) {
  const { role, planningRoot, phase, planKey, cfg, surfaces, waived, reason, warnings } = ctx;
  const baseline = cfg.stakes;
  /**
   * The configured level stands because no floor was computed at all - a
   * DIFFERENT sentence, and deliberately not carrying the `risk floor: ` prefix
   * that marks an entry the floor's own read produced. "Nothing raised it" and
   * "nothing looked" are the two states this seam exists to keep apart, and
   * spelling both with one prefix is how they would collapse again.
   */
  const notComputed = (why) => {
    reason.push(`no risk-floor computation: ${why}; the configured `
      + `"${baseline}" stands`);
    // `raised: false` is what makes the two pre-plan roles exempt from the rung
    // clamp for free: no floor was computed for them, so nothing raised.
    return { level: baseline, raised: false, surface: null, signal: null, file: null };
  };

  if (PRE_PLAN_ROLES.includes(role)) {
    return notComputed(`${role} is dispatched before a plan exists and reads none`);
  }
  if (phase === null || phase === undefined) {
    return notComputed('no --phase and no readable cursor, so no plan was named');
  }

  const scoped = planKey !== undefined;
  return levelFor({
    scope: scoped
      ? declaredPlanFiles(planningRoot, phase, planKey)
      : declaredPhaseFiles(planningRoot, phase),
    scoped,
    scopeName: scoped ? `phase ${phase} plan ${planKey}` : `phase ${phase}`,
    // The repo root is the planning root's PARENT: declared paths are
    // repo-relative, and deriving the root this way is what keeps a `--file`
    // pointed at another tree from reading THIS one's files.
    repoRoot: dirname(planningRoot),
    cfg,
    surfaces,
    waived,
    reason,
    warnings,
  });
}

/**
 * THE SCOPE-TO-LEVEL HALF of the floor, and the ONE implementation of the level
 * arithmetic: given a scope that has already been read off disk, decide the level
 * to route on, whether a surface RAISED it, and what evidenced the raise.
 *
 * `riskFloor` above addresses the scope by phase and plan key, and `replay`
 * addresses it by phase DIRECTORY - live or archived. Both land here, so a rule
 * added on one side reaches the other by construction: a second copy of the
 * discount predicate, the `stakes_order` comparison and the reason vocabulary is
 * exactly how a replay would come to report a level no resolve would produce.
 *
 * `scoped` is a RENDERING fact and not a rule: it says whether the scope is ONE
 * plan or a set of them, which is the difference between "plan 2 declared no
 * files at all" and "1 of 3 plans in phase 3 declared no files at all". The
 * arithmetic is identical either way.
 *
 * `raised` is the trigger for evidence and is NOT the diff between the level and
 * the baseline: `RAISE_TARGET` is `shipped` and so is the schema default, so on
 * most projects a raise lands ON the configured level and a diff-triggered
 * evidence column would be empty for exactly the rows whose surface a reader
 * needs. It is false when nothing matched, false when every match was WAIVED,
 * and false when `stakes_order` could not place the comparison, which is the arm
 * where the surface raised nothing.
 * @param {{scope: any, scoped: boolean, scopeName: string, repoRoot: string, cfg: any,
 *   surfaces: string[], waived: string[], reason: string[], warnings: string[]}} ctx
 * @returns {{level: string, raised: boolean, surface: string|null, signal: string|null,
 *   file: string|null}}
 */
function levelFor(ctx) {
  const { scope, scoped, scopeName, repoRoot, cfg, surfaces, waived, reason, warnings } = ctx;
  const baseline = cfg.stakes;
  const order = stakesOrder();
  /** A level nothing raised - the shape every non-raise arm returns. */
  const none = (level) => ({ level, raised: false, surface: null, signal: null, file: null });
  /** The configured level stands, for a stated cause the floor COMPUTED. */
  const hold = (why) => {
    reason.push(`risk floor: ${why}, so the configured "${baseline}" stands`);
    return none(baseline);
  };

  for (const w of scope.warnings) warnings.push(w);
  const entries = declaredBodies(repoRoot, scope.files);
  const { matches, withheld } = scanDeclared(entries, surfaces);

  // WHAT THE LINE-KIND EXEMPTION COST THIS SCOPE (RSK-05), said before any arm
  // below decides anything, because it is true on every arm: a raise that used
  // to rest on an import or a literal constant now says which file and which
  // surface stopped counting, instead of moving its evidence silently.
  //
  // A `reason` and not a `warning`, on the distinction this function keeps
  // everywhere else: `warnings[]` is for an input the floor could NOT read - an
  // oversized body, a path outside the tree, a plan out of grammar - and a
  // withheld line is one it read and judged. Measured on this repository
  // 2026-08-26 this fires 5 times across the 28 archived phase directories, so
  // it is a sentence and not a flood.
  for (const w of withheld) {
    reason.push(`risk floor: ${scopeName}: ${w.path} evidences ${w.category} `
      + 'only on an import or a constant declaration, which no longer counts');
  }

  // THE WAIVER, applied per MATCH and not to the scan: a project that waived
  // `secrets` on a phase which also touches `destructive` still routes at the
  // raise, because the next unwaived match is the hit. Waiving the top match is
  // therefore never waiving the floor.
  const waivedHits = matches.filter((m) => waived.includes(m.category));
  const hit = matches.find((m) => !waived.includes(m.category));

  // Which declared file produced the winning signal, so the reason cites
  // EVIDENCE rather than asserting a category. Re-scanned per entry against the
  // one matched category and compared on the signal STRING, because a category
  // can be evidenced by several files and only one of them produced the sentence
  // the user is about to read.
  const evidencedBy = (category, signal) => {
    for (const e of entries) {
      const m = scanDeclared([e], [category]).matches[0];
      if (m && m.signal === signal) return e.path;
    }
    return null;
  };

  // D-04's AGGREGATION RULE, in one predicate: a scope is discountable only when
  // it held at least one conforming plan, every one of them read clean, every
  // one of them declared at least one path, and every declared body that EXISTS
  // was actually opened. All four halves are the SAME argument at four depths,
  // and each one was learned separately. `clean === found` is the mixed-phase
  // case - one unreadable member forces the configured stakes for the WHOLE
  // scope, so a phase whose unreadable plan is the risky one can never resolve
  // below today. `found > 0` is that argument one step earlier: a phase
  // directory holding no plan, or no directory at all, read nothing, and nothing
  // read is not evidence of a clean phase. `undeclared` is it one step further
  // in and is the half the UAT refuted: the shipped templates/PLAN.md ships
  // `files:` with no items, so a plan copied from it parsed perfectly, scanned
  // ZERO files, and took the discount on a scope where nothing was ever looked
  // at - absence of evidence reported as absence of surface. `unread` is the
  // same at the level BELOW the plan, and it is the half a `risk_surface` review
  // refuted: a plan that parsed perfectly while declaring an oversized,
  // symlinked or unreadable SOURCE file discounted the whole scope on evidence
  // nobody had opened. A discount is a claim that the scope was READ; every one
  // of these makes that claim false at its own depth.
  const undeclared = Array.isArray(scope.undeclared) ? scope.undeclared : [];
  for (const f of undeclared) {
    warnings.push(`risk floor: ${scopeName}: ${f} declares no files at all, `
      + `so the discount below "${baseline}" is withheld`);
  }
  const unread = entries.filter((e) => typeof e.unread === 'string');
  for (const e of unread) {
    warnings.push(`risk floor: ${scopeName} declares ${e.path}, unread `
      + `(${e.unread}), so the discount below "${baseline}" is withheld`);
  }
  const read = scope.found > 0 && scope.clean === scope.found
    && undeclared.length === 0 && unread.length === 0;

  let floor = baseline;
  if (!cfg.stakesSet && read) {
    if (order.includes(UNSET_FLOOR)) floor = UNSET_FLOOR;
    else {
      warnings.push(`risk floor: route-table.json's stakes_order does not name `
        + `"${UNSET_FLOOR}", so an unset stakes cannot floor below the schema `
        + `default; "${baseline}" stands`);
    }
  }

  // A SILENT WAIVER is the shape this seam's every other arm exists to refuse,
  // so each one applied is stated: the key, the surface, and the file it would
  // have raised on.
  for (const m of waivedHits) {
    const wat = evidencedBy(m.category, m.signal);
    reason.push(`risk floor: ${scopeName}: `
      + `${wat ? `${wat} touches` : 'a declared file touches'} ${m.category} `
      + `(${m.signal}); the raise is waived by ${WAIVER_KEY}`);
  }
  // EVERY match waived is NOT the same state as no match, and it holds at the
  // CONFIGURED level rather than taking the unset-`solo` discount: the waiver
  // lowers from the computed floor to the level the project stated and no
  // further, because a scope that matched a surface it waived is not a scope
  // that matched nothing.
  if (!hit && waivedHits.length) {
    reason.push(`risk floor: ${scopeName}: every matched surface is waived by `
      + `${WAIVER_KEY}, so the configured "${baseline}" stands and no discount `
      + 'below it is taken');
    return none(baseline);
  }

  // NO SURFACE AND NO EVIDENCE ARE NOT THE SAME SENTENCE, which is the whole of
  // why this arm is three and not one. A scope that was read whole and matched
  // nothing has EARNED the discount; a scope with nothing readable in it has
  // proved nothing at all, and reporting the second as the first is how a phase
  // whose risky plan is the unreadable one would resolve below today.
  const plans = (n) => `${n} plan${n === 1 ? '' : 's'}`;
  if (!hit) {
    if (read) {
      const clean = (scoped
        ? `${scopeName} read clean, declaring `
        : `${scopeName}: ${plans(scope.found)} read clean, declaring `)
        + `nothing that touches [${surfaces.join(', ')}]`;
      if (floor === baseline) return hold(clean);
      reason.push(`risk floor: ${clean}; stakes is unset, so the level floors at `
        + `"${floor}" rather than the "${baseline}" default`);
      return none(floor);
    }
    // Withheld, and WHY - the per-plan warnings already name which file and what
    // went wrong with it, so this says only what it cost.
    const why = scope.found === 0
      ? (scoped
        ? `${scopeName} names no plan file this could read`
        : `${scopeName} holds no plan file this could read`)
      : scope.clean !== scope.found
        ? `${scope.found - scope.clean} of ${plans(scope.found)} in ${scopeName} `
          + 'could not be read'
        // The plans read clean and named nothing to scan. Its OWN sentence, and
        // this is the one arm where the wording is the whole fix: "declaring
        // nothing that touches [...]" is the discount's sentence and would say
        // that a scope nobody looked at was found clean. "No surface" and
        // "nothing was declared" are the two states this seam exists to keep
        // apart, and the second may never be spelled as the first.
        : undeclared.length
          ? (scoped
            ? `${scopeName} declared no files at all`
            : `${undeclared.length} of ${plans(scope.found)} in ${scopeName} `
              + 'declared no files at all')
          // The plans all read clean and a declared BODY did not. Named as its
          // own cause: "2 of 3 plans could not be read" is false here.
          : `${unread.length} declared file${unread.length === 1 ? '' : 's'} in `
            + `${scopeName} went unread`;
    reason.push(`risk floor: ${why}, so no surface was computed and `
      + (cfg.stakesSet
        ? `the configured "${baseline}" stands`
        : `the discount below the "${baseline}" default is withheld`));
    return none(baseline);
  }

  const at = evidencedBy(hit.category, hit.signal);
  const where = at ? `${at} touches` : 'a declared file touches';
  /** The raise's own evidence, carried beside the level for a caller that
   * prints it (`replay`) and for the rung clamp that fires only on a raise. */
  const cite = (level) => ({ level, raised: true, surface: hit.category,
    signal: hit.signal, file: at });
  const raised = higherLevel(floor, RAISE_TARGET);
  if (raised === null) {
    // A reason claiming a baseline is "already at or above" a level nothing
    // could compare would be a flatly false sentence, so the comparison that
    // failed is what gets said.
    warnings.push(`risk floor: route-table.json's stakes_order cannot place `
      + `"${floor}" against "${RAISE_TARGET}", so the ${hit.category} surface `
      + `${scopeName} declares raised nothing; "${baseline}" stands`);
    // NOT `cite`: nothing was raised, so a row that printed this surface as
    // evidence would be citing a move that did not happen.
    return none(baseline);
  }
  if (raised === floor) {
    reason.push(`risk floor: ${scopeName}: ${where} ${hit.category} `
      + `(${hit.signal}); "${floor}" is already at or above the `
      + `"${RAISE_TARGET}" that raises to`);
    return cite(floor);
  }
  reason.push(`risk floor: ${scopeName}: ${where} ${hit.category} `
    + `(${hit.signal}); level ${floor} -> ${raised}`);
  // THE PAIRED ARM of the waiver: the raise carried the level ABOVE what this
  // project configured, and without the key naming this surface that lowering
  // does not take effect. Said rather than left to be inferred, and never an
  // `ok:false` - that drops the caller to the host session default, below every
  // floor, so "refused" here means the lowering did not happen and the record
  // says which key would have made it happen.
  if (higherLevel(baseline, raised) === raised && baseline !== raised) {
    reason.push(`risk floor: ${scopeName}: lowering to the configured `
      + `"${baseline}" is refused - name ${hit.category} in ${WAIVER_KEY} to `
      + 'waive this raise');
  }
  return cite(raised);
}

function resolve(opts) {
  // The planning root and the trace phase, derived ONCE for both events this
  // resolve may write: `--phase` when it parses, the cursor otherwise, and with
  // neither in hand nothing is recorded - an event keyed to no phase joins
  // nothing, and the id it would derive is the empty string.
  const planningRoot = dirname(opts.file);
  let tracePhase = null;
  try {
    // `opts.phase` is set ONLY when it parsed clean: `parseArgs` already judged
    // it against its declared row, and that row REFUSES now, so a malformed
    // spelling never reaches this function at all.
    tracePhase = opts.phase !== undefined ? opts.phase : cursorPhase(planningRoot);
  } catch { /* a record of a decision may never change the decision */ }

  // NO ARGUMENT-LEVEL DIAGNOSTICS RIDE HERE ANY MORE, and the history is the
  // point. `--phase` used to warn and continue, and before THAT it produced
  // nothing at all: `requirePhaseArg(opts.phase)` sat inside the try above and
  // its `!parsed.ok` arm fell silently through to the cursor, so measured
  // 2026-08-19 `resolve --role cad-planner --phase 1.10.3` returned ok:true with
  // no mention of `--phase` - the routing event keyed to a phase the caller never
  // named. The warning closed that. What the warning could NOT close is a floor
  // computed off the cursor's phase, so the flag now REFUSES at `parseArgs` and
  // never reaches this function malformed (CER-01 D-09).

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
    const degraded = [...cfg._warnings];
    out({ ok: false, reason: 'unknown-role', role: opts.role,
      detail: `known roles: ${roles.join(', ')}`,
      hint: 'pass --role as one of the roles the detail lists, spelled exactly, and re-run',
      ...(degraded.length ? { warnings: degraded } : {}) });
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

  // THE ANSWERED SURFACE SET, decided here rather than at its warning block
  // below, because the plan-time floor is scoped by it (D-10) and the floor runs
  // before the cell lookup. The DECISION is hoisted and the DIAGNOSTICS are not:
  // `answeredSurfaces` is pure, so reading it twice would be free and reading it
  // once is honest, while moving the warning block would reorder `warnings[]`
  // for every caller that reads it positionally. `resolve` narrows the floor to
  // this set on the same terms the commit-time trigger already uses - a project
  // that answered the surface question narrowed what can raise its level, and an
  // unanswered one gets all eight, which is the safe direction on both.
  const tableCategories = riskCategories();
  const wroteSurfaces = cfg.triggerSurfaces.risk_surface;
  const decided = answeredSurfaces(wroteSurfaces, tableCategories);
  const surfaces = decided.surfaces;
  const surfacesAnswered = decided.answered;

  // THE STAKES LEVEL for this dispatch: the configured level as a FLOOR, raised
  // by what the phase's own declared `files:` touch (CER-01). All four knobs
  // then come from the floored row through the one cell grid.
  const floor = riskFloor({
    role: opts.role, planningRoot, phase: tracePhase, planKey: opts.plan,
    cfg, surfaces, waived: waivedSurfaces(cfg, warnings), reason, warnings,
  });
  const stakes = floor.level;

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
      hint: 'route-table.json carries no cell for this role at this stakes level - restore the shipped table, a hand-edited or partial `cells` block being the usual cause, then re-run',
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
      // (d) The configured rung wins - UNLESS a surface raised the level, which
      // floors the rung too (D-08). The floor already picked the ROW before this
      // lookup ran, so the clamp is against `cell.effort`: the rung the FLOORED
      // cell names. A project that pinned a cheap rung for a role otherwise
      // keeps it on the one phase the floor just raised, which is the standing
      // `references/config-reach.md` claim this makes true again.
      //
      // GATED ON A RAISE, never on a floor merely having been computed: a scope
      // that read clean and matched nothing has taken a DISCOUNT, and clamping
      // the user's rung against a discounted cell would take the dial away in
      // exactly the cheap case CER-01 buys. The two pre-plan roles are exempt
      // for free (no floor is computed for them at all) and a waived surface
      // raised nothing, so it clamps nothing.
      const rungOrder = Array.isArray(TABLE.rung_order) ? TABLE.rung_order : [];
      const ci = rungOrder.indexOf(effort);
      const wi = rungOrder.indexOf(wanted);
      if (floor.raised && ci >= 0 && wi >= 0 && wi < ci) {
        // SAYS what it did, in the voice the other three arms of this block
        // already use: a rung that silently did not apply is the
        // resolved-then-dropped shape this block exists to close.
        reason.push(`${key}="${wanted}" does not apply: ${floor.file || 'a declared file'} `
          + `touches ${floor.surface}, and the raised ${stakes}/${opts.role} cell's `
          + `"${effort}" rung is the floor`);
      } else {
        // An unprovable comparison holds the CONFIGURED rung and says so, the
        // precedent being the retry block below, which holds a configured start
        // rung for exactly that reason. Clamping on a comparison nothing made
        // would take a user's dial away on the strength of a torn table.
        if (floor.raised && (ci < 0 || wi < 0)) {
          warnings.push(`rung_order cannot compare ${key}="${wanted}" with the `
            + `${stakes}/${opts.role} cell's "${effort}" rung, so the `
            + `${floor.surface} surface floors no rung; the configured rung stands`);
        }
        reason.push(`${key}: ${effort} -> ${wanted} (config, wins over the `
          + `${stakes}/${opts.role} cell)`);
        effort = wanted;
        startFromConfig = true;
      }
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
  // A config-layer tier or effort must be one of the table's accepted values
  // BEFORE it can win, exactly as a gate must (the check above): these two are
  // the fields review-triggers.md step 4 interpolates into a provider command
  // line, and review-provider.mjs validates neither - the OpenAI adapter sends
  // `reasoning.effort` verbatim. A repo layer arrives with a clone
  // (lib/config-merge.mjs states the threat), so without this check an
  // out-of-vocabulary string - or an object - reaches the fire site unwarned.
  // Same treatment as a bad gate: name it, let the level's value stand.
  const tierNames = Array.isArray(TABLE.tier_names) && TABLE.tier_names.length
    && TABLE.tier_names.every((t) => typeof t === 'string') ? TABLE.tier_names : DEFAULT_TIER_NAMES;
  const effortNames = Array.isArray(TABLE.effort_names) && TABLE.effort_names.length
    && TABLE.effort_names.every((e) => typeof e === 'string') ? TABLE.effort_names : DEFAULT_EFFORT_NAMES;
  for (const trigger of Object.keys(review)) {
    let setTier = cfg.triggerTiers[trigger];
    if (setTier !== undefined && !tierNames.includes(setTier)) {
      warnings.push(`review.triggers.${trigger}.tier=${JSON.stringify(setTier)} is not one of `
        + `[${tierNames.join(', ')}]; the ${stakes} level tier `
        + `${JSON.stringify(tableTiers[trigger] ?? null)} stands`);
      setTier = undefined;
    }
    const tier = setTier !== undefined ? setTier : tableTiers[trigger];
    const tierFrom = setTier !== undefined
      ? `review.triggers.${trigger}.tier`
      : `route-table.json's tiers row for ${stakes}`;
    let setEffort = cfg.triggerEfforts[trigger];
    if (setEffort !== undefined && !effortNames.includes(setEffort)) {
      warnings.push(`review.triggers.${trigger}.effort=${JSON.stringify(setEffort)} is not one of `
        + `[${effortNames.join(', ')}]; the ${stakes} level effort `
        + `${JSON.stringify(tableEfforts[trigger] ?? null)} stands`);
      setEffort = undefined;
    }
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
  // The predicate itself lives in lib/surface-scan.mjs, because
  // `planning.mjs risk-check run` REFUSES on the same answer this block
  // REPORTS: two copies would let the seam that enforces the one-time question
  // disagree with the resolve that names it. The wording of the warnings here
  // stays in this file - the diagnostics are this face's, the rule is not, and
  // the ANSWER itself was decided above the floor that is scoped by it.
  if (wroteSurfaces !== undefined) {
    const { kept, bad } = decided;
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
      // decided.answered already carried this arm; nothing to set here.
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

/**
 * WHAT THE FLOOR DOES TO THIS PROJECT'S OWN PHASES, printed rather than asserted
 * (AC3). One row per phase directory the planning root holds - live under
 * `phases/<N>/` and archived under `_archive-<label>/<N>/`, because a milestone
 * close moves the evidence and 27 of this repository's 30 phases are already
 * there - carrying today's level, the computed one, and the surface, signal and
 * declared file behind any raise.
 *
 * TODAY'S LEVEL is the CONFIGURED `stakes` (the schema default `shipped` when no
 * layer set it), and the row must not pretend a second code path ran: before
 * CER-01 a resolve returned exactly that for every phase, so it IS the honest
 * second resolver.
 *
 * THE RAISE IS WHAT CARRIES EVIDENCE, never the diff between the two columns.
 * `RAISE_TARGET` and the schema default are both `shipped`, so most raises land
 * ON today's level; keying the evidence off a difference would blank the column
 * for exactly the rows whose surface a reader needs and would leave "matched an
 * answered surface, already at target" and "touched nothing" spelled
 * identically. A row that did not raise says `raised: false` and cites nothing.
 *
 * `regressions` is ALWAYS present, empty on a healthy tree - the record shape
 * `risk-check` established, where the answer is written whether or not anything
 * matched so that "nothing regressed" and "nothing looked" stay apart. A
 * regression is a phase whose declared files touched an answered surface and
 * whose computed level is nonetheless BELOW today's, which is the one thing AC3
 * forbids.
 *
 * The computed column is `levelFor`'s, the same helper `resolve` routes on: this
 * command re-addresses the scope and re-implements none of the arithmetic.
 */
function replay(opts) {
  const planningRoot = dirname(opts.file);
  const cfg = readConfig(opts.file);
  const warnings = [...cfg._warnings];
  const decided = answeredSurfaces(cfg.triggerSurfaces.risk_surface, riskCategories());
  const surfaces = decided.surfaces;
  // Validated once for the whole run, never per row (`waivedSurfaces` states
  // why), and applied to every row: a replay that ignored the waiver would
  // print raises this project has already declined to route on.
  const waived = waivedSurfaces(cfg, warnings);
  const today = cfg.stakes;
  // The repo root is the planning root's PARENT, on `riskFloor`'s own reasoning:
  // declared paths are repo-relative, and a `--file` pointed at another tree
  // reads that tree's files rather than this one's.
  const repoRoot = dirname(planningRoot);
  const rows = [];
  const regressions = [];
  for (const { label, path } of phaseDirsIn(planningRoot)) {
    // Per row, so one phase's diagnostics never read as another's. The
    // envelope's own `warnings` stays the CONFIG's, which is a fact about the
    // run and not about any phase.
    const reason = [];
    const rowWarnings = [];
    const scope = declaredFilesIn(path);
    const r = levelFor({ scope, scoped: false, scopeName: label, repoRoot, cfg,
      surfaces, waived, reason, warnings: rowWarnings });
    rows.push({
      label,
      today,
      computed: r.level,
      raised: r.raised,
      ...(r.raised ? { surface: r.surface, signal: r.signal, file: r.file } : {}),
      // The counts the discount predicate read, so a row that held at today's
      // level is diagnosable without re-running the read.
      plans_found: scope.found,
      plans_clean: scope.clean,
      reason,
      ...(rowWarnings.length ? { warnings: rowWarnings } : {}),
    });
    const higher = higherLevel(r.level, today);
    if (r.raised && higher === today && r.level !== today) {
      regressions.push({ label, today, computed: r.level, surface: r.surface, file: r.file });
    }
  }
  // A planning root holding no phase directory answers with an empty row list,
  // never a refusal: "this project has no phases yet" is an answer.
  out({ ok: true, stakes: today, surfaces, surfaces_answered: decided.answered,
    rows, regressions, ...(warnings.length ? { warnings } : {}) });
}

// --- arg parsing -------------------------------------------------------------

// The whole synopsis, printed when `--role` is ABSENT rather than merely
// valueless: with no role there is no call to describe, so the refusal is the
// help. A role present with nothing usable after it gets the specific sentence
// in the table below instead - the caller who wrote `--role "$R"` against an
// unset variable knows what a role is and needs to be told which token vanished.
const SYNOPSIS = 'resolve --role <name> [--attempt N] [--file <config>] [--phase N]'
  + ' [--plan <key>] [--bracket-read <csv> [--bracket-plan <key>]]'
  + ' | replay [--file <config>]';

// The five value-carrying flags of `resolve`, each read through its DECLARED
// row in lib/arg-contract.mjs (ARG-06). The rows own the RULE - required-ness,
// which classifier judges the value, and what a malformed or valueless one
// costs - and this table owns only the SENTENCE, because route.mjs mints no
// reason code of its own (D-07): every refusal here is this bin's own `usage`,
// in the wording it already published.
//
// THE DEFECT THIS ENDS. The loop this replaced read a value as `a[++i]` with no
// flag-shape test, so a flag ate the flag after it: measured 2026-08-19,
// `route.mjs resolve --role --attempt 2` returned
// `{"ok":false,"reason":"unknown-role","role":"--attempt"}` - a refusal about a
// role the caller never named, with the attempt silently reverted to 1, which
// is the exact shape lib/seam-input.mjs's `flagValue` was written against. The
// declared rows refuse the missing, empty and flag-shaped spellings by one rule.
//
// ORDER IS LOAD-BEARING: the first failing flag names the refusal, and this is
// the order the five `else if` arms ran in, so a call malformed in two places
// still reports the same one it reported before.
//
// `--phase` IS here now, and that is a reversal worth naming. It declared `warn`
// and was read separately, on the reasoning that a `usage` refusal would route
// the phase lower than its own risk baseline - which was true while it named
// only the phase a trace event is keyed to. It is a FLOOR input since CER-01, so
// warn-and-continue answers a typo by computing a floor from the CURSOR's phase:
// a different phase's declared files, at a level the resolved bundle gives the
// caller no way to notice is wrong. Refusing is loud at the call site, and the
// lower-than-baseline objection does not survive the change - an ok:false there
// is a caller that must FIX its argument, not a caller that silently proceeds.
const RESOLVE_FLAGS = {
  '--role': ['role', 'resolve --role needs a role name after it: --role <name>'],
  '--attempt': ['attempt', 'resolve --attempt must be an integer'],
  // `o.file` reaches `dirname()` on the way to the layer read, so a valueless
  // one escaped as reason:"internal" carrying a raw Node type error. Both
  // spellings, matching config.mjs's own guard - unquoted `$VAR` drops the
  // token, quoted `"$VAR"` passes an empty one - and defaulting either to
  // .planning/config.json would answer about a file the caller never named.
  '--file': ['file', 'resolve --file needs a path after it: --file <config file>'],
  // The bracket pair: `--bracket-read` switches the lifecycle dispatch event on
  // and carries the site's read-set (ONE comma-separated value, like `trace
  // append --read`); `--bracket-plan` is the worker key when it is not the role
  // name (an executor's plan number). Recording a bracket for a read-set the
  // caller never named would claim a site read nothing when the token merely
  // went missing.
  '--bracket-read': ['bracketRead', 'resolve --bracket-read needs a comma-separated path list after it'],
  '--bracket-plan': ['bracketPlan', 'resolve --bracket-plan needs a worker key after it'],
  // The risk floor's SCOPE: with it the floor reads that one plan's declared
  // files, without it the phase's union. Refused on both axes, unlike
  // `--bracket-plan` above, because a valueless one would silently widen a
  // caller that asked about one plan to the whole phase.
  '--plan': ['plan', 'resolve --plan needs a plan key after it: --plan <k>'],
  // Last, so the four flags that were already refused keep naming the refusal
  // first on a call malformed in two places (see ORDER IS LOAD-BEARING above).
  '--phase': ['phase', 'resolve --phase must be a phase number: --phase <N|N.M>'],
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
    // A `fallback` or absent flag reads as undefined and leaves this object's
    // own default in place; no row here declares `warn`, so no value arrives
    // carrying a diagnostic.
    if (parsed.value !== undefined) o[key] = parsed.value;
  }
  // An ABSENT `--phase` still falls to the STATE cursor, unchanged: the loop
  // above is a VALUE door and a flag nobody passed reaches no row.
  return o;
}

// `replay` takes ONE flag and it is `--file`, declared exactly as `resolve`'s is
// so the same spelling is refused at both doors. There is deliberately no
// `--role`: the floor differs by role only through the pre-plan exemption, and a
// replay is a question about phases. No `--phase` either - the whole answer is
// every phase directory the project holds.
function parseReplayArgs(a) {
  const o = { file: '.planning/config.json' };
  const parsed = evaluateFlag(a, '--file', CONTRACTS['route.mjs'].replay['--file']);
  if (!parsed.ok) o.usage = 'replay --file needs a path after it: --file <config file>';
  else if (parsed.value !== undefined) o.file = parsed.value;
  return o;
}

try {
  try {
    TABLE = JSON.parse(readFileSync(TABLE_PATH, 'utf8'));
  } catch (e) {
    fail('bad-table', `cannot read/parse ${TABLE_PATH}: ${e.message}`,
      'restore route-table.json at the path the detail names - a partial or damaged plugin install is the usual cause - then re-run');
  }
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (cmd === 'resolve') {
    // The argument-shape refusal carries no `warnings` on purpose: it fails on
    // ARGUMENT SHAPE before any config file is named, so there is no layer whose
    // diagnostics could ride along. Every other ok:false return does carry them
    // (D-04). One arm where five stood, because `parseArgs` now names the
    // refusal from the declared row that produced it.
    const o = parseArgs(argv.slice(1));
    if (o.usage) out({ ok: false, reason: 'usage', detail: o.usage });
    else resolve(o);
  } else if (cmd === 'replay') {
    const o = parseReplayArgs(argv.slice(1));
    if (o.usage) out({ ok: false, reason: 'usage', detail: o.usage });
    else replay(o);
  } else if (cmd === 'table') {
    out({ ok: true, table: TABLE });
  } else {
    out({ ok: false, reason: 'usage', detail: 'subcommand: resolve | replay | table' });
  }
} catch (e) {
  if (e !== DONE) out({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
}
