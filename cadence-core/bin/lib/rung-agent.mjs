// @ts-check
// rung-agent.mjs - the one statement of which agent file carries which rung of which role. route.mjs resolves a rung to
// an agent name from it, self-verify proves every name exists on disk, and read-trace and subagent-trace use
// roleOfAgent and rungOfAgent. Spelling the map twice is the resolved-then-silently-wrong class (#39, #43, #64):
// route.mjs would name a file the linter never looked for.
// RUNG_FILES is a stated table and not a naming convention, because no convention is true of all 30 files. rungBody,
// normalizeBody and rungBodyIssue state the one legitimate body of a rung file, and rungPrefixIssues that a role's rung
// files carry it byte for byte.
// Pure lib: no fs, no emit, no process, no Date, no randomness. It returns names and problem codes; route.mjs fails
// open on an unmapped rung and self-verify files a problem.
'use strict';

/**
 * The rung ladder, weakest first: the whole vocabulary of rung names and the order `rungFiles` returns a role's files
 * in. It sits beside RUNG_FILES because the two are one statement (the ladder names rungs, the map says which file
 * carries each), and `rungOrderIssues` holds them together.
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
});

/**
 * Whether the map and the ladder still say the same thing: every role's rung keys are exactly RUNG_ORDER, in order.
 * Nothing else compares them. A role missing `xhigh` resolves `rungFile` to null and route.mjs fails open, and
 * reordered keys hand `rungFiles` and `rungPrefixIssues` a tie-break order that isn't the ladder's; both are silent.
 * Takes the map so a caller can hold a drifted one against the ladder.
 * @param {any} [files] the rung map to check, stem values unread
 * @param {any} [order] the ladder to check it against, weakest first
 * @returns {{code: string, role: string, detail: string}[]}
 */
export function rungOrderIssues(files, order) {
  const map = files !== undefined && files !== null ? files : RUNG_FILES;
  const ladder = Array.isArray(order) ? order : RUNG_ORDER;
  /** @type {{code: string, role: string, detail: string}[]} */
  const out = [];
  const read = map !== null && typeof map === 'object' && !Array.isArray(map) ? map : {};
  for (const role of Object.keys(read)) {
    const rungs = read[role];
    const got = rungs !== null && typeof rungs === 'object' && !Array.isArray(rungs)
      ? Object.keys(rungs) : [];
    if (got.length === ladder.length && ladder.every((r, i) => got[i] === r)) continue;
    out.push({ code: 'rung-order-drift', role,
      detail: `${role} files rungs ${JSON.stringify(got)}, but the rung ladder is ${
        JSON.stringify([...ladder])} - the map and RUNG_ORDER are one statement `
        + 'and nothing else holds them together' });
  }
  return out;
}

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

/**
 * Every agent-file stem one role's map names, in rung order. An unknown role yields an empty array, since self-verify
 * calls this on a table it hasn't validated yet.
 * @param {string} role
 * @returns {string[]}
 */
export function rungFiles(role) {
  const map = typeof role === 'string' ? RUNG_FILES[role] : undefined;
  return map ? Object.values(map) : [];
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
 * Whether one role's rung files still share one body, byte for byte. A role's rungs are separate agents whose bodies
 * become separate prompts, and a prompt cache reuses only a prefix identical from its first byte. Deleting the per-rung
 * sentence bought a shared prefix that nothing then held, and an edit landing in one rung file and not its siblings
 * breaks it while every file on its own stays a legal rung file.
 * Raw bytes on purpose, the one place whitespace is load-bearing: `rungBodyIssue` normalizes it away so re-wrapping is
 * free, but two line-break variants are two cache prefixes. A role with fewer than two bodies yields nothing, since an
 * absent file is `missing-rung-agent`'s to report. The majority body is the rank, ties go to the earliest-declared
 * rung, and the detail names the file to open.
 * @param {any} bodies stem -> that file's raw prose, frontmatter already
 *   stripped; entries whose value is not a string are treated as absent
 * @returns {{code: string, role: string, stems: string[], detail: string}[]}
 */
export function rungPrefixIssues(bodies) {
  const read = bodies !== null && typeof bodies === 'object' && !Array.isArray(bodies)
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
 * 200-byte instruction through under any weight budget, and a denylist of contract section tags passed a body of plain
 * prose. A rung file has exactly one legitimate body, so "is it that body" is the only rule that matches what
 * INTERNALS.md claims, and it also refuses a same-size replacement of the pointer paragraph that no byte budget can
 * see.
 * The tag denylist stays in front of this in self-verify, since naming `<process>` is the more actionable message. A
 * file declaring several skills passes if its body points at any one. The template names no rung, so the body isn't
 * held against the file's own `effort:`; `rungEffortIssue` holds that against the rung RUNG_FILES filed it under.
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
export const EFFORT_PREFIX = 'model.effort.';

/** `roles.<role>.effort` is a second spelling of the start rung, not a rename, so both prefixes get the rules below. */
export const ROLES_PREFIX = 'roles.';
/** The last segment that makes a `roles.<role>.*` key a start rung. */
export const ROLES_EFFORT_SUFFIX = '.effort';

/**
 * The two keys one role's start rung can be written under, older spelling first, which is also the order issues come
 * out in.
 * @param {string} role
 * @returns {string[]}
 */
function effortKeyNames(role) {
  return [`${EFFORT_PREFIX}${role}`, `${ROLES_PREFIX}${role}${ROLES_EFFORT_SUFFIX}`];
}

/**
 * The role a start-rung key names, or null when the key is neither spelling. `roles.<role>.model` isn't one: it's
 * `string_or_null` with nothing to drift against.
 * @param {string} key
 * @returns {string|null}
 */
function effortKeyRole(key) {
  if (key.startsWith(EFFORT_PREFIX)) return key.slice(EFFORT_PREFIX.length);
  if (key.startsWith(ROLES_PREFIX) && key.endsWith(ROLES_EFFORT_SUFFIX)) {
    return key.slice(ROLES_PREFIX.length, key.length - ROLES_EFFORT_SUFFIX.length);
  }
  return null;
}

/**
 * Whether the shipped `model.effort.<role>` and `roles.<role>.effort` schema enums still say what RUNG_FILES says.
 * `config.mjs` refuses a start rung by key off these enums, so a drifted enum accepts a rung with no file (which
 * route.mjs then warns its way out of) or refuses one the role really has.
 * Both spellings get the same rules with no shared-enum shortcut: they're separate schema rows and the roles block
 * wins, so checking only the older prefix would leave the winning key unguarded. The default is checked on the roles
 * spelling alone, since it's the rung a project with no config resolves at, while `model.effort.<role>` defaults to
 * null on purpose, meaning "this key does not answer".
 * `rungOrder` is handed in so a caller can hold a drifted ladder against the enums. An empty one skips the vocabulary
 * arm alone, because the schema-vs-map proof matters most when the ladder is unavailable. Every detail names the key to
 * edit, as self-verify never reads a user's config.
 * @param {any} schema the `keys` map of config.schema.json, trusted for nothing
 * @param {any} [rungOrder] the declared rung vocabulary, lowest first
 * @returns {{code: string, detail: string}[]}
 */
export function effortEnumIssues(schema, rungOrder) {
  /** @type {{code: string, detail: string}[]} */
  const out = [];
  const keys = schema !== null && typeof schema === 'object' && !Array.isArray(schema)
    ? schema : {};
  const order = Array.isArray(rungOrder) ? rungOrder.filter((r) => typeof r === 'string') : [];

  for (const role of Object.keys(RUNG_FILES)) {
    for (const key of effortKeyNames(role)) {
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
      // The default half, roles spelling only: it answers when no layer names a rung, so it must name a rung this role
      // has a file for. `model.effort.<role>` is exempt, its null default being the fall-through the precedence is
      // built on.
      if (key.startsWith(ROLES_PREFIX)) {
        const def = spec.default;
        if (typeof def !== 'string'
          || !Object.prototype.hasOwnProperty.call(RUNG_FILES[role], def)) {
          out.push({ code: 'effort-default-invalid',
            detail: `${key} defaults to ${def === undefined ? '(absent)' : JSON.stringify(def)}, `
              + `which is not one of ${role}'s rungs (${Object.keys(RUNG_FILES[role]).join(', ')}) `
              + '- this default IS the rung route.mjs resolves when no layer sets one' });
        }
      }

      if (!order.length) continue;
      const strays = want.filter((v) => v !== null && !order.includes(v));
      if (strays.length) {
        out.push({ code: 'effort-enum-drift',
          detail: `${key} offers ${JSON.stringify(strays)}, which the rung ladder `
            + `(${order.join(', ')}) does not carry` });
      }
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
 * Whether the file a rung is filed under carries a different effort than that rung. A config names a rung, RUNG_FILES
 * turns it into a file name, and the dispatch carries only that name, so the depth that runs is the `effort` in that
 * file's frontmatter. This is the only rule that reads that field against anything: the reachability check reads the
 * rung from the filename, so a file that's internally consistent and externally wrong passes it.
 * Without it a config can name `xhigh`, the map resolve it to a file carrying `effort: high`, and the resolver's JSON,
 * the transcript's `subagent_type` and the escalation reason all report `xhigh` while nothing ran at it. Subagent turns
 * record no effort anywhere, so nothing downstream disagrees. A stem the map doesn't name returns null.
 *
 * @param {string} stem the agent file's basename without `.md`
 * @param {string} [effort] the file's frontmatter `effort`
 * @returns {null|{role: string, rung: string, detail: string}} null when they agree
 */
export function rungEffortIssue(stem, effort) {
  for (const role of Object.keys(RUNG_FILES)) {
    const map = RUNG_FILES[role];
    for (const rung of Object.keys(map)) {
      if (map[rung] !== stem) continue;
      if (effort === rung) return null;
      const found = effort === undefined ? 'carries no effort' : `carries effort: ${effort}`;
      return { role, rung,
        detail: `lib/rung-agent.mjs files this as ${role}'s ${rung} rung, but it ${found}` };
    }
  }
  return null;
}
