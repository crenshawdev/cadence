// @ts-check
// the cited half of the read-back count: which prior decisions a PLAN names. cite-surfaced.mjs is the other half.
// no fence awareness on purpose: none of the measured mentions sat in a fence, so a rule would cost a second grammar
// D-numbers restart per phase, so a bare D-NN means the plan's own phase
// qualifiers: `phase 2 D-02` or a `phases/<n>/<artifact>` path before the D-NN; any other letter in between ends it
// the look-back is windowed so work per mention stays constant: a plan file is caller-authored text
// nothing is deduplicated, since one line can stand for two surfaced rows
'use strict';

/** A D-NN mention, on the shape parseContextDecisions accepts. The leading `\b` keeps ids like AD-NN and TD-NN out. */
const MENTION = /\bD-\d+(?:\.\d+)?\b/g;

/** How far back a qualifier may reach: room for a long artifact name, short of a scan of the file. */
const WINDOW = 160;

/**
 * A phase reference ending the look-back window, as `phase <n>` or `phases/<n>/<artifact>`, then the separator run.
 * The separator class is bounded so it can't backtrack super-linearly, which matters on text a caller wrote.
 */
const QUALIFIER = /(?:phases\/(\d+(?:\.\d+)?)\/[A-Za-z0-9_.-]{0,64}|phase\s{1,4}(\d+(?:\.\d+)?))[`':’s\s]{0,8}$/i;

/**
 * Every D-NN a plan cites, each with the phase it is scoped to.
 *
 * @param {unknown} text the plan file's whole text
 * @param {unknown} ownPhase the plan's OWN phase spelling, as the caller typed it
 * @returns {Array<{number: string, phase: string}>} in document order, not deduplicated
 */
export function citedMentions(text, ownPhase) {
  if (typeof text !== 'string' || !text) return [];
  const own = typeof ownPhase === 'string' || typeof ownPhase === 'number' ? String(ownPhase) : '';
  const out = [];
  MENTION.lastIndex = 0;
  for (const m of text.matchAll(MENTION)) {
    const at = m.index ?? 0;
    const before = text.slice(at > WINDOW ? at - WINDOW : 0, at);
    const q = QUALIFIER.exec(before);
    out.push({ number: m[0], phase: q ? (q[1] ?? q[2]) : own });
  }
  return out;
}
