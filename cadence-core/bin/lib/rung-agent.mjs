// @ts-check
// rung-agent.mjs - the ONE statement of which agent FILE carries which rung of
// which role, imported by route.mjs (which resolves a cell's rung to an agent
// name) and, through lib/route-cells.mjs, by self-verify.mjs (which proves
// every name the grids can produce exists on disk). Spelling the map twice is
// exactly the resolved-then-silently-wrong class this repo keeps closing (#39,
// #43, #64): route.mjs would name a file the linter never looked for.
//
// RUNG_FILES is the whole mapping story - a stated table, not a naming
// convention, because no convention is true of all 19 files.
// `rungBody`/`normalizeBody`/`rungBodyIssue` beside it state the one legitimate
// BODY of a rung file, and `rungPrefixIssues` states that one role's rung files
// all carry it byte for byte, for the same single-source reason.
//
// Pure lib: no fs, no emit, no process, no Date, no randomness. It returns
// names and problem CODES; the callers own the envelope - route.mjs decides
// what an unmapped rung means for a dispatch (nothing: it fails open), and
// self-verify.mjs decides what it means for CI (a problem entry).
'use strict';

/**
 * The rung -> agent-file map, stated per role rather than derived (D-05). The
 * unsuffixed `agents/<role>.md` is one rung among the others, and nothing about
 * a rung's NAME says which file carries it:
 * `cad-assumptions-analyzer` is the `xhigh` rung while its `-high` sibling is
 * the lower one, so any convention would have to lie about one of them. The
 * alternative was renaming five of six files to make a convention true, which
 * invalidates every one of their exact-fit weight budgets and buys nothing a
 * reader of this table cannot already see.
 *
 * Each role's rungs are listed in rung_order (low -> max), which is the order
 * `rungFiles` returns them in. Frozen: this is a statement of what is on disk,
 * and a caller mutating it would make route.mjs and self-verify disagree about
 * the same question.
 * @type {Readonly<Record<string, Readonly<Record<string, string>>>>}
 */
export const RUNG_FILES = Object.freeze({
  'cad-planner': Object.freeze({
    high: 'cad-planner',
    xhigh: 'cad-planner-xhigh',
    max: 'cad-planner-max',
  }),
  'cad-assumptions-analyzer': Object.freeze({
    high: 'cad-assumptions-analyzer-high',
    xhigh: 'cad-assumptions-analyzer',
  }),
  'cad-verifier': Object.freeze({
    medium: 'cad-verifier-medium',
    high: 'cad-verifier',
    xhigh: 'cad-verifier-xhigh',
    max: 'cad-verifier-max',
  }),
  'cad-reviewer': Object.freeze({
    medium: 'cad-reviewer-medium',
    high: 'cad-reviewer',
    xhigh: 'cad-reviewer-xhigh',
    max: 'cad-reviewer-max',
  }),
  'cad-executor': Object.freeze({
    high: 'cad-executor',
    xhigh: 'cad-executor-xhigh',
  }),
  'cad-plan-checker': Object.freeze({
    low: 'cad-plan-checker',
    medium: 'cad-plan-checker-medium',
    high: 'cad-plan-checker-high',
    xhigh: 'cad-plan-checker-xhigh',
  }),
});

/**
 * The agent-file stem for one rung of one role, or null when the pair is not
 * in the map. Null rather than a guessed `<role>-<rung>`: a guess names a file
 * that does not exist and reads as a real answer, while null is a fact the
 * caller can act on - route.mjs degrades the dispatch and says so, self-verify
 * files a problem.
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
 * Every agent-file stem one role's map names, in declared rung order. An
 * unknown role yields an empty array rather than throwing - self-verify calls
 * this on a table it has not validated yet.
 * @param {string} role
 * @returns {string[]}
 */
export function rungFiles(role) {
  const map = typeof role === 'string' ? RUNG_FILES[role] : undefined;
  return map ? Object.values(map) : [];
}

/**
 * Whether one role's rung files still share ONE body, byte for byte (RNG-03).
 *
 * A role's rungs are separate registered agents whose bodies are assembled
 * into separate prompts, and a prompt cache can only reuse a prefix that is
 * identical from its first byte. The rung sentence used to make that
 * impossible by construction - every rung file opened with a different line -
 * and deleting it bought a shared prefix that nothing then held. This is what
 * holds it: an edit landing in one rung file and not its siblings re-forecloses
 * the sharing, and it is invisible to every other check, because each file on
 * its own is still a perfectly legal rung file.
 *
 * RAW BYTES, deliberately, and this is the one place in this lib where
 * whitespace is load-bearing (D-04). `rungBodyIssue` normalizes whitespace away
 * so that re-wrapping a paragraph is free - which is right for "does this file
 * carry behaviour of its own" and exactly wrong here, since two line-break
 * variants are two different cache prefixes. Re-wrapping ONE rung file and not
 * its siblings is precisely the edit this rule exists to catch, so the two
 * rules are not duplicates: they disagree about that edit on purpose.
 *
 * Scoped by RUNG_FILES: a stem the map does not name is not this rule's
 * business (check 8's reachability arm owns stale and unreachable files), and
 * a role contributing fewer than two bodies yields nothing - an absent file is
 * already `missing-rung-agent`'s to report, and a second entry would
 * double-count one fault.
 *
 * The majority body is the rank and the minority is what broke it, ties going
 * to whichever group holds the earliest-declared rung, so the detail names the
 * FILE a maintainer would open rather than every file in the role.
 *
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
    // Declared rung order (low -> max), which is what makes the tie-break and
    // the listed order below reproducible rather than filesystem-dependent.
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

    // Insertion order IS declared rung order, and `>` is strict, so a tie
    // leaves the earliest-declared group as the rank.
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
 * The canonical BODY of a rung agent file: a pointer at the contract it
 * preloads, and nothing else. Stated here rather than inside self-verify for
 * the same reason the name mapping is - the check and the files it checks must
 * read ONE source, or they drift and the linter blesses the drift.
 *
 * It names NO rung, and that is the point (RNG-03). The body used to open
 * ``Your rung is `high`.``, which put a per-rung token at body line 1 and gave
 * every rung file of one role a different prefix from its first character - so
 * two rungs of the same role could share no cached prefix at all, however
 * identical the rest. The rung was never lost by deleting it: the frontmatter
 * `effort:` is what the host actually reads and what `rungEffortIssue` holds
 * against this map. A role whose CONTRACT branches on the rung takes it from
 * its dispatch prompt, which is billed fresh and costs no prefix.
 * @param {string} skill the contract skill the file preloads
 * @returns {string}
 */
export function rungBody(skill) {
  return `Follow the preloaded \`${skill}\` skill exactly - it is your full\n`
    + 'contract. This file names that contract and adds nothing else.\n';
}

/**
 * A body in whitespace-insensitive form, so re-wrapping a paragraph is free
 * and only a REWORD counts as a change. Comparing raw text would make the
 * line breaks load-bearing - a CI failure with no fix a maintainer would
 * think of.
 * @param {string} text
 * @returns {string}
 */
export function normalizeBody(text) {
  return String(text === undefined || text === null ? '' : text).replace(/\s+/g, ' ').trim();
}

/**
 * Whether a rung file's body is anything other than the canonical template.
 *
 * An ALLOWLIST, deliberately, and this is the second attempt at the rule.
 * D-04 rejected a size-only check because a 200-byte behavioural instruction
 * fits under any weight budget - but so does a 200-byte instruction carrying
 * no contract section tag, so the tag denylist it chose instead had the same
 * hole: a rung file whose whole body is plain prose passed CI. A rung file has
 * exactly ONE legitimate body, so "is it that body" is the only rule that
 * matches what INTERNALS.md:11 claims - it refuses a rung file carrying any
 * instruction of its own, including a same-size REPLACEMENT of the pointer
 * paragraph, which no byte budget can see.
 *
 * The tag denylist stays in front of this in self-verify: when a body DOES
 * carry `<process>`, naming the tag is the more actionable message.
 *
 * A file declaring several skills passes if its body points at any ONE of
 * them - the template names a single contract, and nothing here rules out a
 * future multi-contract agent.
 *
 * The template no longer names a rung, so this rule no longer holds a body
 * against its own frontmatter `effort:` (RNG-03). That arm is gone, not
 * bypassed, and it was the redundant one: `rungEffortIssue` below holds the
 * file's `effort:` against the rung RUNG_FILES filed it under, which is the
 * link that decides how deep a dispatch actually thinks.
 *
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

/**
 * Whether the shipped `model.effort.<role>` schema enums still say what
 * RUNG_FILES says. It belongs beside the map because the map is the statement
 * it checks against, and because the refusal it protects is one a USER meets:
 * `config.mjs` refuses a start rung by key off these enums, so an enum that
 * drifts from the map starts refusing the wrong values - accepting a rung with
 * no file (which route.mjs then has to warn its way out of) or refusing one
 * this role really has.
 *
 * self-verify never reads a user's config and so cannot refuse a user's value;
 * this is its half of that criterion (D-08), which is why every detail NAMES
 * THE KEY a maintainer would edit.
 *
 * `rungOrder` is the caller's rung vocabulary (route-table.json's `rung_order`).
 * An empty or absent one skips the vocabulary arm ALONE, the way `cellIssues`
 * tolerates an absent vocabulary - the schema-vs-map proof must still run on a
 * tree with no table, which is where a drifted enum is likeliest and least
 * noticed.
 *
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
    const key = `${EFFORT_PREFIX}${role}`;
    const spec = keys[key];
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
      out.push({ code: 'missing-effort-key',
        detail: `${key} is absent, but lib/rung-agent.mjs files ${
          Object.keys(RUNG_FILES[role]).length} rungs for ${role}` });
      continue;
    }
    // Type BEFORE values: `checkValue` enforces an enum's `values` only when
    // `type` IS "enum", so a key whose type drifted to "string" keeps a correct
    // values list while the write face silently accepts any rung - the exact
    // accepting-a-rung-with-no-file drift this function exists to refuse.
    if (spec.type !== 'enum') {
      out.push({ code: 'effort-enum-drift',
        detail: `${key} has type ${JSON.stringify(spec.type)}, must be "enum" - `
          + 'a non-enum type disables the write-face refusal' });
      continue;
    }
    // The map's rungs in DECLARED order, then null - the exact shape D-03 ships,
    // so a reordered enum reads as drift too: the order is what a reader of the
    // refusal message sees, and it is meant to be the ladder's own order.
    const want = [...Object.keys(RUNG_FILES[role]), null];
    const got = Array.isArray(spec.values) ? spec.values : null;
    if (!got || got.length !== want.length || want.some((v, i) => got[i] !== v)) {
      out.push({ code: 'effort-enum-drift',
        detail: `${key} holds ${JSON.stringify(got)}, but lib/rung-agent.mjs files ${
          role} at ${JSON.stringify(want)}` });
      continue;
    }
    if (!order.length) continue;
    const strays = want.filter((v) => v !== null && !order.includes(v));
    if (strays.length) {
      out.push({ code: 'effort-enum-drift',
        detail: `${key} offers ${JSON.stringify(strays)}, which route-table.json's `
          + `rung_order (${order.join(', ')}) does not carry` });
    }
  }

  for (const key of Object.keys(keys)) {
    if (!key.startsWith(EFFORT_PREFIX)) continue;
    const role = key.slice(EFFORT_PREFIX.length);
    if (Object.prototype.hasOwnProperty.call(RUNG_FILES, role)) continue;
    out.push({ code: 'unknown-effort-role',
      detail: `${key} names "${role}", which lib/rung-agent.mjs files no rungs for `
        + `(${Object.keys(RUNG_FILES).join(', ')})` });
  }
  return out;
}

/**
 * Whether the file a rung is filed under carries a DIFFERENT effort than that
 * rung. The third link in the chain, and the one that was open.
 *
 * A cell states a rung, RUNG_FILES turns it into a file NAME, and the dispatch
 * carries only that name - so the depth that actually runs is the `effort` in
 * that file's frontmatter, and since RNG-03 deleted the rung sentence from the
 * body this is the ONLY rule that reads that field against anything. Check 8's
 * reachability arm reads the rung out of the FILENAME rather than out of the
 * file, and `rungBodyIssue` held a file's body against its OWN frontmatter, so
 * a file that was internally consistent and externally wrong passed it
 * anyway - which is why losing that arm loses no coverage this one has, and
 * why this one may not be weakened. Leave the gap and `route-table.json` can
 * name `xhigh`, this map
 * can resolve it to a file carrying `effort: high`, and the resolver's JSON,
 * the transcript's `subagent_type` and the escalation `reason` all report
 * `xhigh` while nothing ran at it. Subagent turns record no effort anywhere,
 * so no observable downstream disagrees either - it is unfalsifiable outside
 * the file. It is also the same invariant CI already holds against the table,
 * where a retry rung may not sit below the rung it started on; this holds it
 * against the filesystem, so a rung cannot think less while every surface
 * reports that it thought more.
 *
 * A stem this map does not name is not this rule's business - check 8's
 * reachability arm owns stale and unreachable files - and returns null.
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
