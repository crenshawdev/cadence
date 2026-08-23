// @ts-check
// cite-cited.mjs - the CITED half of the read-back count (RBK-01): which prior
// decisions does a produced PLAN actually name. lib/cite-surfaced.mjs is the
// other half - what the recall pass put in front of the planner - and
// planning.mjs's `cite-count` joins the two per item.
//
// A TEXTUAL SCAN OF THE WHOLE FILE, and fence-awareness is deliberately NOT
// required (D-09). Phase 1's D-10 established that nothing in a PLAN.md
// structurally references a D-NN and that `templates/PLAN.md`'s `## Context` is
// free prose, so there is no field to read. Measured across all 47 `PLAN*.md`
// under `.planning/`, 1041 D-NN mentions appear and NONE of them is inside a
// fenced block, with 43 of the 47 carrying at least one - so a fence rule would
// cost a second grammar to maintain and would change no measured answer.
// Adding a citation field to the template instead would violate this cycle's
// stated "reader before writer" and would make every archived plan uncountable.
//
// SCOPING IS THE WHOLE DIFFICULTY (D-10). D-numbers RESTART per phase, so
// matching by number alone makes the collision rate near-total and the
// legitimate-zero rate this phase exists to measure would be measured against
// noise. A bare `D-NN` is therefore scoped to the plan's OWN phase - the
// convention `.planning/phases/1/PLAN-1.md:51` and `PLAN-2.md:43` both
// establish by opening `## Context` with "Locked by `phases/1/CONTEXT.md`:
// D-08 ..." and leaving every unqualified number after it own-phase - and only
// a mention the text immediately before it QUALIFIES is scoped elsewhere.
// Measured over the same 47 plans, 23 of 1028 mentions are qualified (2.2%).
//
// THE QUALIFIER GRAMMAR IS THE FOUR SPELLINGS THIS CORPUS ACTUALLY USES and
// deliberately nothing wider:
//
//   phase 2 D-02
//   `phases/1/CONTEXT.md` D-13
//   `phases/5/CONTEXT.md`: D-01
//   `phases/2/CONTEXT.md`'s D-01
//
// which is a phase reference followed by a SEPARATOR RUN made only of
// backticks, colons, whitespace and the possessive `'s`. A separator carrying
// any other letter ends the qualification, which is what stops "In phase 5 the
// executor recorded a deviation, and D-01 says otherwise" from binding `D-01`
// to phase 5 - an unrelated number several words back capturing a mention is
// the failure mode that would make a widened rule worse than no rule.
//
// THE LOOK-BACK IS WINDOWED, not run over the whole preceding document. The
// window is longer than any spelling above and the separator run is bounded, so
// the work per mention is constant rather than a function of how far into the
// file the mention sits - a plan file is caller-authored text and a scan over
// it may not degrade with its size.
//
// NOTHING IS DEDUPLICATED HERE. `.planning/phases/1/PLAN-2.md:285` is the
// measured case where ONE line stands for two distinct surfaced rows, so the
// caller owns that arithmetic and needs the mentions in document order rather
// than a set. Pure lib: no fs, no emit, no exit, no `Date`, no randomness, and
// the caller owns every refusal sentence.
'use strict';

/**
 * A D-NN mention. The same number shape `parseContextDecisions` accepts on its
 * own bullets (`/^- D-\d+(?:\.\d+)?\b/`), so a decision this tree can WRITE is
 * a decision this tree can find cited. The leading `\b` is what keeps `AD-08`
 * and `TD-01` out.
 */
const MENTION = /\bD-\d+(?:\.\d+)?\b/g;

/**
 * How far back a qualifier may reach. The longest measured spelling is
 * `` `phases/5/CONTEXT.md`: `` at 23 characters; 160 leaves room for a longer
 * artifact name without letting the look-back become a scan of the file.
 */
const WINDOW = 160;

/**
 * A phase reference at the END of the look-back window, in its two measured
 * forms - the prose `phase <n>` and the path `phases/<n>/<artifact>` - followed
 * by the separator run the four spellings use. Anchored with `$` so it is the
 * text IMMEDIATELY before the mention that qualifies it.
 *
 * The separator class is exactly backtick, colon, whitespace, apostrophe (both
 * spellings) and the possessive's `s`, and it is BOUNDED: a class with an upper
 * bound cannot backtrack super-linearly, which is the property that matters on
 * text a caller wrote.
 */
const QUALIFIER = /(?:phases\/(\d+(?:\.\d+)?)\/[A-Za-z0-9_.-]{0,64}|phase\s{1,4}(\d+(?:\.\d+)?))[`':’s\s]{0,8}$/i;

/**
 * Every D-NN a plan cites, each with the phase it is scoped to.
 *
 * @param {unknown} text the plan file's whole text
 * @param {unknown} ownPhase the plan's OWN phase spelling, as the caller typed it
 * @returns {Array<{number: string, phase: string}>} in document order, NOT
 *   deduplicated - one line may stand for two distinct surfaced rows and the
 *   caller owns that arithmetic.
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
