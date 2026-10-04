// @ts-check
// listing-filter.mjs - the line rule that takes Cadence's agents and contract
// skills out of the two listings the host shows the model (phase 5, D-01/D-04).
// The Cadence module (hooks/cadence-mod.mjs) applies it to the `prompt.attachment`
// text of those two types. Every other type comes back as it was given: the
// spike's first filter ignored the type and cut lines out of a
// `hook_additional_context` attachment.
//
// No imports, no Node globals: a hooks module may load nothing else. The
// answer depends on the type and the text alone, nothing kept between calls,
// because the host caches the prompt on this text (D-05).
//
// The rule, read off listings 2.1.289 rendered (fixtures/listing.*.json):
// - the text splits on `\n` and the kept lines join on `\n`, so every kept
//   byte, a `\r` included, comes back as it was;
// - an entry starts at a line beginning `- `, and its name runs to the first
//   `: `, or to the end of the line when there is none. Over its character
//   budget the host lists a skill as a bare `- <name>`, least-used first, and
//   the contract skills are never invoked through the Skill tool, so they go
//   bare first;
// - an entry runs on through each line that neither begins `- ` nor is empty.
//   The host prints a description's own newlines raw at column 0, which is
//   how a two-line entry looks;
// - an empty line ends it too. In `agent_listing_delta` the last entry is
//   followed by an empty line and a trailer that belongs to no entry;
// - a target goes with all of its lines. Targets: in `agent_listing_delta`,
//   a name beginning `cadence:`; in `skill_listing`, a name beginning
//   `cadence:` and ending `-contract`. Another plugin's `-contract` skill
//   stays.
//
// Its one limit: a description holding an empty line, or a line beginning
// `- `, can't be told from the listing's own structure by text, so whatever
// follows that line stays in the prompt. All 36 Cadence target descriptions
// are one line today.
'use strict';

/** The agent listing's attachment type, as 2.1.289 names it. */
export const AGENT_LISTING = 'agent_listing_delta';

/** The skill listing's attachment type, as 2.1.289 names it. */
export const SKILL_LISTING = 'skill_listing';

/** The two types this filters: the module's matcher, and nothing else's. */
export const LISTING_TYPES = Object.freeze([AGENT_LISTING, SKILL_LISTING]);

/** An entry's name: after `- `, up to the first `: ` or the end of the line. */
function entryName(/** @type {string} */ line) {
  const rest = line.slice(2);
  const at = rest.indexOf(': ');
  return at < 0 ? rest : rest.slice(0, at);
}

/**
 * Which entry names `type` drops, or null for a type this leaves alone.
 * @param {unknown} type
 * @returns {((name: string) => boolean) | null}
 */
function targetsOf(type) {
  if (type === AGENT_LISTING) return (name) => name.startsWith('cadence:');
  if (type === SKILL_LISTING) return (name) => name.startsWith('cadence:') && name.endsWith('-contract');
  return null;
}

/**
 * The attachment text to send: `text` without Cadence's target entries for
 * the two listing types, and `text` itself for any other type.
 * @param {unknown} type
 * @param {string} text
 * @returns {string}
 */
export function filterListing(type, text) {
  const isTarget = targetsOf(type);
  if (isTarget === null) return text;
  /** @type {string[]} */
  const kept = [];
  let dropping = false;
  for (const line of text.split('\n')) {
    if (line.startsWith('- ')) dropping = isTarget(entryName(line));
    else if (line === '') dropping = false;
    if (!dropping) kept.push(line);
  }
  return kept.join('\n');
}
