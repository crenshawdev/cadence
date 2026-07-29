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
// BODY of a rung file, for the same single-source reason.
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
 * The canonical BODY of a rung agent file: the rung line, then a pointer at
 * the contract it preloads. Stated here rather than inside self-verify for the
 * same reason the name mapping is - the check and the files it checks must
 * read ONE source, or they drift and the linter blesses the drift.
 * @param {string} rung the file's frontmatter `effort`
 * @param {string} skill the contract skill the file preloads
 * @returns {string}
 */
export function rungBody(rung, skill) {
  return `Your rung is \`${rung}\`.\n\n`
    + `Follow the preloaded \`${skill}\` skill exactly - it is your full\n`
    + 'contract. This file names that contract and your rung, and adds nothing else.\n';
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
 * @param {string} body the agent file's prose, frontmatter already stripped
 * @param {string} [rung] the file's frontmatter `effort`
 * @param {string[]} [skills] the file's declared `skills:` entries
 * @returns {null|{detail: string}} null when the body IS the template
 */
export function rungBodyIssue(body, rung, skills) {
  const found = normalizeBody(body);
  const declared = (Array.isArray(skills) ? skills : [])
    .filter((s) => typeof s === 'string' && s);
  const names = declared.length ? declared : ['<contract>'];
  const wanted = names.map((s) => normalizeBody(rungBody(rung || '', s)));
  if (wanted.includes(found)) return null;
  return { detail: `body is not the rung template - expected exactly ${JSON.stringify(wanted[0])}` };
}
