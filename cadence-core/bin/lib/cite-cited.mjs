// @ts-check
// The cited half of the read-back count: which prior decisions a produced PLAN names. cite-surfaced.mjs is the other half, what recall put in front of the planner, and planning.mjs's `cite-count` joins the two per item.
// A textual scan of the whole file, with no fence awareness on purpose: nothing in a PLAN.md structurally references a D-NN (its Context section is free prose), and across every plan measured none of the mentions sat inside a fenced block, so a fence rule would cost a second grammar and change no answer. A citation field in the template would make every archived plan uncountable.
// Scoping is the hard part. D-numbers restart per phase, so matching by number alone collides almost every time. A bare D-NN is scoped to the plan's own phase (a plan opens its Context section naming its phase's context file, and every unqualified number after it is own-phase), and only a mention the text just before it qualifies is scoped elsewhere.
// The qualifier forms this corpus uses and nothing wider: `phase 2 D-02`, or a `phases/<n>/<artifact>` path before the D-NN, with a separator run made only of backticks, colons, whitespace and the possessive 's. Any other letter in the separator ends the qualification, so an unrelated phase number several words back can't capture a mention.
// The look-back is windowed instead of run over the whole preceding document, so work per mention stays constant: a plan file is caller-authored text and a scan over it may not degrade with its size.
// Nothing is deduplicated here, because one line can stand for two distinct surfaced rows; the caller owns that arithmetic and needs the mentions in document order. Pure: no fs, emit, exit, Date or randomness.
'use strict';

/** A D-NN mention, on the same number shape parseContextDecisions accepts on its bullets, so a decision this tree can write is one it can find cited. The leading `\b` keeps ids like AD-NN and TD-NN out. */
const MENTION = /\bD-\d+(?:\.\d+)?\b/g;

/** How far back a qualifier may reach: room for a longer artifact name, short enough that the look-back never becomes a scan of the file. */
const WINDOW = 160;

/**
 * A phase reference at the end of the look-back window, as prose `phase <n>` or path `phases/<n>/<artifact>`, then the separator run. Anchored with `$` so it's the text immediately before the mention.
 * The separator class is bounded so it can't backtrack super-linearly, which matters on text a caller wrote.
 */
const QUALIFIER = /(?:phases\/(\d+(?:\.\d+)?)\/[A-Za-z0-9_.-]{0,64}|phase\s{1,4}(\d+(?:\.\d+)?))[`':’s\s]{0,8}$/i;

/**
 * Every D-NN a plan cites, each with the phase it is scoped to.
 *
 * @param {unknown} text the plan file's whole text
 * @param {unknown} ownPhase the plan's OWN phase spelling, as the caller typed it
 * @returns {Array<{number: string, phase: string}>} in document order and not deduplicated, since one line may stand for two surfaced rows
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
