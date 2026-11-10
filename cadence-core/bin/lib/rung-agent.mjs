// @ts-check
// rung-agent.mjs - the one statement of which agent file carries which rung of which role. route.mjs resolves a rung
// to an agent name from it, self-verify proves every name exists, and read-trace and subagent-trace use
// roleOfAgent and rungOfAgent. Spelling the map twice is the resolved-then-silently-wrong class (#39, #43, #64).
// RUNG_FILES is a stated table, not a naming convention, because no convention is true of all 35 files.
// Pure lib: no fs, no emit, no process, no Date, no randomness. It returns names and problem codes.
'use strict';

import { isPlainObject } from './text-util.mjs';

/**
 * The rung ladder, weakest first: the whole vocabulary of rung names and the order a role's files are listed in.
 * It sits beside RUNG_FILES because the two are one statement (the ladder names rungs, the map says which file
 * carries each), and the rung-agent tests hold them together.
 * @type {readonly string[]}
 */
export const RUNG_ORDER = Object.freeze(['low', 'medium', 'high', 'xhigh', 'max']);

/**
 * The rung -> agent-file map, stated per role and not derived. The unsuffixed `agents/<role>.md` is one rung among the
 * others and a rung's name doesn't say which file carries it: `cad-assumptions-analyzer` is the `xhigh` rung while its
 * `-high` sibling is the lower one.
 * Renaming five of six files to make a convention true would break every exact-fit weight budget. Rungs are listed in
 * RUNG_ORDER, and the map is frozen so a caller can't make route.mjs and self-verify disagree.
 * @type {Readonly<Record<string, Readonly<Record<string, string>>>>}
 */
export const RUNG_FILES = Object.freeze({
  'cad-planner': Object.freeze({
    low: 'cad-planner-low',
    medium: 'cad-planner-medium',
    high: 'cad-planner',
    xhigh: 'cad-planner-xhigh',
    max: 'cad-planner-max',
  }),
  'cad-assumptions-analyzer': Object.freeze({
    low: 'cad-assumptions-analyzer-low',
    medium: 'cad-assumptions-analyzer-medium',
    high: 'cad-assumptions-analyzer-high',
    xhigh: 'cad-assumptions-analyzer',
    max: 'cad-assumptions-analyzer-max',
  }),
  'cad-verifier': Object.freeze({
    low: 'cad-verifier-low',
    medium: 'cad-verifier-medium',
    high: 'cad-verifier',
    xhigh: 'cad-verifier-xhigh',
    max: 'cad-verifier-max',
  }),
  'cad-reviewer': Object.freeze({
    low: 'cad-reviewer-low',
    medium: 'cad-reviewer-medium',
    high: 'cad-reviewer',
    xhigh: 'cad-reviewer-xhigh',
    max: 'cad-reviewer-max',
  }),
  'cad-executor': Object.freeze({
    low: 'cad-executor-low',
    medium: 'cad-executor-medium',
    high: 'cad-executor',
    xhigh: 'cad-executor-xhigh',
    max: 'cad-executor-max',
  }),
  'cad-plan-checker': Object.freeze({
    low: 'cad-plan-checker',
    medium: 'cad-plan-checker-medium',
    high: 'cad-plan-checker-high',
    xhigh: 'cad-plan-checker-xhigh',
    max: 'cad-plan-checker-max',
  }),
  'cad-mapper': Object.freeze({
    low: 'cad-mapper-low',
    medium: 'cad-mapper-medium',
    high: 'cad-mapper',
    xhigh: 'cad-mapper-xhigh',
    max: 'cad-mapper-max',
  }),
});

/**
 * The agent-file stem for one rung of one role, or null when the pair isn't in the map. Null and not a guessed
 * `<role>-<rung>`: a guess names a file that doesn't exist and reads as a real answer.
 * @param {string} role
 * @param {string} rung
 * @returns {string|null}
 */
export function rungFile(role, rung) {
  const map = typeof role === 'string' ? RUNG_FILES[role] : undefined;
  if (!map || typeof rung !== 'string') return null;
  return Object.prototype.hasOwnProperty.call(map, rung) ? map[rung] : null;
}

// Reverse lookups for a recorded `agent_type`; a suffix regex would be a second statement of the map.

/** Every rung file's stem, mapped back to the role whose rung it is. */
const ROLE_OF_STEM = new Map(
  Object.keys(RUNG_FILES).flatMap(
    (role) => Object.values(RUNG_FILES[role]).map((stem) => [stem, role]),
  ),
);

/** The same stems mapped back to their rung, built off the same import so a new rung reaches both maps or neither. */
const RUNG_OF_STEM = new Map(
  Object.keys(RUNG_FILES).flatMap(
    (role) => Object.entries(RUNG_FILES[role]).map(([rung, stem]) => [stem, rung]),
  ),
);

/**
 * The agent-file stem inside a recorded `agent` value: the host writes `<plugin>:<agent-file-stem>` and a bare stem is
 * accepted as itself. One copy of the split, shared by both readers below, or the role answer and the rung answer start
 * disagreeing about which file a spelling names.
 * @param {any} agent
 * @returns {string|null} null for anything that is not a non-empty string.
 */
function stemOfAgent(agent) {
  if (typeof agent !== 'string' || !agent) return null;
  return agent.includes(':') ? agent.slice(agent.indexOf(':') + 1) : agent;
}

/**
 * The role a recorded `agent` value names, or null. The corpus carries the host's `<plugin>:<agent-file-stem>` spelling
 * (`cadence:cad-verifier-medium`) while a dispatch event carries the bare role. Null for anything else, host types and
 * `coordinator` included, so the caller decides what each absence means.
 * Exported for read-trace's join and subagent-trace's `SubagentStop` self-filter, so two readers of one record can't
 * derive the role independently and disagree about which bracket closed.
 * @param {any} agent
 * @returns {string|null}
 */
export function roleOfAgent(agent) {
  const stem = stemOfAgent(agent);
  if (stem === null) return null;
  return ROLE_OF_STEM.get(stem) || null;
}

/**
 * The rung a recorded `agent` value names, or null: the sibling of `roleOfAgent` over the same table, so
 * `cadence:cad-verifier-medium` is `cad-verifier` at `medium`. Never from a `-<rung>` suffix, since
 * `cad-assumptions-analyzer` is `xhigh` while `-high` is its lower rung and a suffix rule would report the wrong rung
 * for the unsuffixed file of every role.
 * Exported for subagent-trace, whose `SubagentStop` close records the rung a worker was dispatched under beside the
 * effort it ran at.
 * @param {any} agent
 * @returns {string|null}
 */
export function rungOfAgent(agent) {
  const stem = stemOfAgent(agent);
  if (stem === null) return null;
  return RUNG_OF_STEM.get(stem) || null;
}

/**
 * Whether one role's rung files still share one body, byte for byte. Each rung is its own prompt, and a prompt cache
 * reuses only a prefix identical from its first byte, so an edit to one rung file and not its siblings breaks it.
 * Raw bytes on purpose, the one place whitespace is load-bearing: `rungBodyIssue` normalizes it away, but two
 * line-break variants are two cache prefixes. A role with fewer than two bodies yields nothing; an absent file is
 * `missing-rung-agent`'s to report. The detail names the file to open.
 * @param {any} bodies stem -> that file's raw prose, frontmatter already
 *   stripped; entries whose value is not a string are treated as absent
 * @returns {{code: string, role: string, stems: string[], detail: string}[]}
 */
export function rungPrefixIssues(bodies) {
  const read = isPlainObject(bodies)
    ? bodies : {};
  const bodyOf = (stem) => (Object.prototype.hasOwnProperty.call(read, stem)
    && typeof read[stem] === 'string' ? read[stem] : null);

  /** @type {{code: string, role: string, stems: string[], detail: string}[]} */
  const out = [];
  for (const role of Object.keys(RUNG_FILES)) {
    // Declared rung order, so the tie-break and the listed order are reproducible and not filesystem-dependent.
    const stems = Object.values(RUNG_FILES[role]).filter((s) => bodyOf(s) !== null);
    if (stems.length < 2) continue;

    /** @type {Map<string, string[]>} */
    const groups = new Map();
    for (const stem of stems) {
      const body = /** @type {string} */ (bodyOf(stem));
      const seen = groups.get(body);
      if (seen) seen.push(stem);
      else groups.set(body, [stem]);
    }
    if (groups.size === 1) continue;

    // Insertion order is declared rung order and `>` is strict, so a tie keeps the earliest group.
    let rank = [];
    for (const members of groups.values()) {
      if (members.length > rank.length) rank = members;
    }
    const strays = stems.filter((s) => !rank.includes(s));
    const name = (s) => `agents/${s}.md`;
    out.push({ code: 'rung-prefix-split', role, stems: strays,
      detail: `${strays.map(name).join(', ')} ${strays.length === 1 ? 'does' : 'do'} not carry `
        + `the same body BYTE FOR BYTE as ${rank.map(name).join(', ')} - `
        + `${role}'s rungs are dispatched as separate agents and share a cached prefix `
        + 'only while their bodies are identical, so this edit has to land in every '
        + `rung file of ${role} or in none` });
  }
  return out;
}

/**
 * The canonical body of a rung agent file: a pointer at the contract it preloads and nothing else, stated here so the
 * check and the files read one source. It names no rung on purpose: a rung token at body line 1 gave every rung file of
 * a role a different prefix, so no two shared a cached one.
 * The frontmatter `effort:` is what the host reads, and `rungEffortIssue` holds it against this map. A contract that
 * branches on rung takes it from its dispatch prompt, which is billed fresh.
 * @param {string} skill the contract skill the file preloads
 * @returns {string}
 */
export function rungBody(skill) {
  return `Follow the preloaded \`${skill}\` skill exactly - it is your full\n`
    + 'contract. This file names that contract and adds nothing else.\n';
}

/**
 * A body in whitespace-insensitive form, so re-wrapping a paragraph is free and only a reword counts. Raw comparison
 * would make line breaks load-bearing, a CI failure with no fix a maintainer would think of.
 * @param {string} text
 * @returns {string}
 */
function normalizeBody(text) {
  return String(text === undefined || text === null ? '' : text).replace(/\s+/g, ' ').trim();
}

/**
 * Whether a rung file's body is anything other than the canonical template. An allowlist on purpose: a size check let a
 * 200-byte instruction through, and a denylist of contract section tags passed a body of plain prose.
 * The tag denylist stays in front of this in self-verify, since naming `<process>` is the more actionable message.
 * A file declaring several skills passes if its body points at any one. The template names no rung, so
 * `rungEffortIssue` holds the file's `effort:` against the rung RUNG_FILES filed it under.
 * @param {string} body the agent file's prose, frontmatter already stripped
 * @param {string[]} [skills] the file's declared `skills:` entries
 * @returns {null|{detail: string}} null when the body IS the template
 */
export function rungBodyIssue(body, skills) {
  const found = normalizeBody(body);
  const declared = (Array.isArray(skills) ? skills : [])
    .filter((s) => typeof s === 'string' && s);
  const names = declared.length ? declared : ['<contract>'];
  const wanted = names.map((s) => normalizeBody(rungBody(s)));
  if (wanted.includes(found)) return null;
  return { detail: `body is not the rung template - expected exactly ${JSON.stringify(wanted[0])}` };
}

/** The config-key prefix every per-role start rung is written under. */
export const ROLES_PREFIX = 'roles.';
/** The last segment that makes a `roles.<role>.*` key a start rung. */
export const ROLES_EFFORT_SUFFIX = '.effort';

/**
 * The key one role's start rung is written under.
 * @param {string} role
 * @returns {string}
 */
function effortKey(role) {
  return `${ROLES_PREFIX}${role}${ROLES_EFFORT_SUFFIX}`;
}

/**
 * The role a start-rung key names, or null when the key isn't one. `roles.<role>.model` isn't one: it's
 * `string_or_null` with nothing to drift against.
 * @param {string} key
 * @returns {string|null}
 */
function effortKeyRole(key) {
  if (key.startsWith(ROLES_PREFIX) && key.endsWith(ROLES_EFFORT_SUFFIX)) {
    return key.slice(ROLES_PREFIX.length, key.length - ROLES_EFFORT_SUFFIX.length);
  }
  return null;
}

/**
 * Whether the shipped `roles.<role>.effort` schema enums still say what RUNG_FILES says.
 * `config.mjs` takes start rungs from them, so a drifted enum accepts a rung with no file or refuses a real one.
 * `rungOrder` lets a caller hold a drifted ladder against the enums; an empty one skips that arm.
 * Every detail names the key to edit.
 * @param {any} schema the `keys` map of config.schema.json, trusted for nothing
 * @param {any} [rungOrder] the declared rung vocabulary, lowest first
 * @returns {{code: string, detail: string}[]}
 */
export function effortEnumIssues(schema, rungOrder) {
  /** @type {{code: string, detail: string}[]} */
  const out = [];
  const keys = isPlainObject(schema)
    ? schema : {};
  const order = Array.isArray(rungOrder) ? rungOrder.filter((r) => typeof r === 'string') : [];

  for (const role of Object.keys(RUNG_FILES)) {
    const key = effortKey(role);
    const spec = keys[key];
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
      out.push({ code: 'missing-effort-key',
        detail: `${key} is absent, but lib/rung-agent.mjs files ${
          Object.keys(RUNG_FILES[role]).length} rungs for ${role}` });
      continue;
    }
    // Type first: `checkValue` enforces `values` only for "enum", so a key drifted to "string" accepts any rung.
    if (spec.type !== 'enum') {
      out.push({ code: 'effort-enum-drift',
        detail: `${key} has type ${JSON.stringify(spec.type)}, must be "enum" - `
          + 'a non-enum type disables the write-face refusal' });
      continue;
    }
    // Declared order then null, so a reordered enum reads as drift; the order is what the refusal message shows.
    const want = [...Object.keys(RUNG_FILES[role]), null];
    const got = Array.isArray(spec.values) ? spec.values : null;
    if (!got || got.length !== want.length || want.some((v, i) => got[i] !== v)) {
      out.push({ code: 'effort-enum-drift',
        detail: `${key} holds ${JSON.stringify(got)}, but lib/rung-agent.mjs files ${
          role} at ${JSON.stringify(want)}` });
      continue;
    }
    // The default answers when no layer names a rung, so it must name a rung this role has a file for.
    const def = spec.default;
    if (typeof def !== 'string'
      || !Object.prototype.hasOwnProperty.call(RUNG_FILES[role], def)) {
      out.push({ code: 'effort-default-invalid',
        detail: `${key} defaults to ${def === undefined ? '(absent)' : JSON.stringify(def)}, `
          + `which is not one of ${role}'s rungs (${Object.keys(RUNG_FILES[role]).join(', ')}) `
          + '- this default IS the rung route.mjs resolves when no layer sets one' });
    }

    if (!order.length) continue;
    const strays = want.filter((v) => v !== null && !order.includes(v));
    if (strays.length) {
      out.push({ code: 'effort-enum-drift',
        detail: `${key} offers ${JSON.stringify(strays)}, which the rung ladder `
          + `(${order.join(', ')}) does not carry` });
    }
  }

  for (const key of Object.keys(keys)) {
    const role = effortKeyRole(key);
    if (role === null) continue;
    if (Object.prototype.hasOwnProperty.call(RUNG_FILES, role)) continue;
    out.push({ code: 'unknown-effort-role',
      detail: `${key} names "${role}", which lib/rung-agent.mjs files no rungs for `
        + `(${Object.keys(RUNG_FILES).join(', ')})` });
  }
  return out;
}

/**
 * Whether the file a rung is filed under carries a different effort than that rung. The dispatch carries only the file
 * name, so the depth that runs is the `effort` in that file's frontmatter, and nothing else reads that field.
 * Without this a config can name `xhigh`, resolve to a file carrying `effort: high`, and every report says `xhigh`
 * while nothing ran at it. A stem the map doesn't name returns null.
 *
 * @param {string} stem the agent file's basename without `.md`
 * @param {string} [effort] the file's frontmatter `effort`
 * @returns {null|{role: string, rung: string, detail: string}} null when they agree
 */
export function rungEffortIssue(stem, effort) {
  const rung = RUNG_OF_STEM.get(stem);
  if (rung === undefined || effort === rung) return null;
  const role = ROLE_OF_STEM.get(stem);
  const found = effort === undefined ? 'carries no effort' : `carries effort: ${effort}`;
  return { role, rung,
    detail: `lib/rung-agent.mjs files this as ${role}'s ${rung} rung, but it ${found}` };
}
