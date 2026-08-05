// @ts-check
// dispatch-phrasing.mjs - the pure rule behind self-verify's `unbatched-dispatch`
// check (#88 AC3): a prose block that CLAIMS concurrency for a set of dispatches
// must actually issue them "in one message", and EVERY SENTENCE in that block
// THAT ISSUES THE SET has to hold to it. The disk half - walking
// cadence-core/workflows and cadence-core/references, filing each issue as a CI
// problem - lives in self-verify.mjs, the same split lib/config-reach.mjs and
// lib/route-cells.mjs use.
//
// Why it exists: references/review-triggers.md step 4 read "For each reviewer in
// the set, in parallel where the host allows:" - a loop shape wrapped in a
// capability hedge, which produces the serial behaviour it means to forbid. The
// prose repair alone is UAT-walk-only; without a check the loop-shaped
// restatement returns on the next edit.
//
// The contract, in three steps:
//
//   MASK  - fenced blocks and inline backtick spans become spaces, preserving
//     line count and column positions. A fence opens on three or more backticks
//     or tildes indented under four spaces, and closes ONLY on the marker that
//     opened it, at that length or longer, with nothing after it - so an example
//     that shows a ``` block inside a ~~~ or ```` container cannot end its
//     container early and leak the container's remaining lines back into prose,
//     and an indented ~~~ sample cannot open a fence that blanks the rest of the
//     file. Each block is then split into SENTENCES, and a period that ends a
//     known abbreviation is not a sentence end. A config key like
//     `parallelization.max_concurrent_agents` and a shell command are code, not
//     an instruction, and reading them as prose is what makes a heuristic like
//     this false-positive.
//   BLOCK - a new block starts at a blank line, an ATX heading, a line whose
//     first non-space characters are a list marker (`-`, `*`, `+`, `N.`), or a
//     line whose first non-space character is a table pipe, so one list item's
//     phrasing never excuses its neighbour's and one table row never glues to
//     the next (a whole table read as one block turns unrelated cell labels into
//     a single sentence). Each block is whitespace-collapsed to one line, then
//     split into SENTENCES on a period or semicolon followed by whitespace -
//     those two only, only with whitespace after, and only at BRACKET DEPTH
//     ZERO, which keeps a `seams.md` citation from splitting mid-token and
//     keeps `(conventions.md Parallel work; seams.md concurrent dispatch)` from
//     splitting mid-citation; and never on a colon, which would sever a batch
//     statement from the list it introduces. A line map records where each
//     source line's text begins in the collapsed block, so an issue is reported
//     at the line its OFFENDING SENTENCE starts on.
//   FLAG  - a sentence S inside block B is a problem when B carries a
//     concurrency claim, S ISSUES the set, S does NOT carry the mandated
//     phrasing, and S carries at least one of: a serial shape, a
//     host-capability hedge, or (a concurrency claim of its own AND a
//     distributive marker). All matching is case-insensitive and word-bounded,
//     so `in ONE message` counts. A sentence that only AFFIRMS a batch stated
//     earlier in the item ("reuse it for every executor in the batch") is
//     excused as an elaboration - but the affirmation is not a free pass:
//     a sentence that serializes or hedges is named even when it names the
//     batch, or the rule stops seeing the regression it exists to prevent.
//
// What "ISSUES the set" means, and why it is the load-bearing test: IMPERATIVE
// MOOD. A sentence hands work out when a BARE-FORM dispatch verb (dispatch,
// issue, fire, spawn, launch, send) opens a clause - the sentence itself past
// any list marker, or the position after `|`, `:`, `;`, `,`, `(`, `[`, or a
// conjunction, modal or infinitive `to`. A trailing colon issues the list under
// it and counts for the serial arm, which is the shape #88 filed. Nothing else
// does. That single predicate is what separates an instruction from the three
// things that wear its vocabulary without issuing anything: a RATIONALE
// ("Serializing it - one dispatch per message - only adds latency"), a NEGATION
// (`never` and `not` are absent from the lead set on purpose, so "never for
// each reviewer in turn" excludes itself from the shape it forbids), and a
// DESCRIPTION or catalog row, where the verb is inflected ("every worktree
// issues its own findings"; "after all worktree batches are sent"). Without
// this gate a compliant block reports its own reasons for being compliant.
//
// Why the concurrency claim scopes from the BLOCK while the eager arm does not:
// a claim routinely sits one sentence away from the instruction it governs -
// workflows/execute.md's parallel item said "one dispatch per message" in one
// sentence and "concurrent dispatch" in the next - so a sentence-scoped claim
// leaves the offender unnamed, which is the blind spot this rule was widened to
// close. The eager arm flags a sentence that hands a set out concurrently
// without saying "in one message" at all, and scoping ITS claim to the block
// instead of the sentence false-positives on descriptive prose that merely
// shares a block with the parallel path ("Cadence issues no `git worktree add`
// ... so it pins no fork point per dispatch", references/seams.md).
//
// Why the domain is the CONCURRENCY CLAIM rather than every dispatch
// instruction: prose that DESCRIBES dispatch without issuing it ("parallel
// dispatch without isolation is not supported") and prose that serializes on
// purpose ("For each plan in order: dispatch ONE cad-executor ... and wait")
// must both stay legal, and neither claims concurrency for a set.
//
// Accepted cost: this is a heuristic over prose and it can false-positive on a
// legitimate sentence that describes dispatch without issuing it. The fix then
// is to narrow the pattern HERE - never to bend a correct surface around it.
//
// Pure lib: no fs, no emit, no process, no Date, no randomness. Every issue is
// `{code, detail}` and every detail NAMES the 1-based line its offending
// sentence starts at, so the message points at the sentence to rewrite.
'use strict';

/** The one problem code this lib files. */
export const CODE = 'unbatched-dispatch';

/** A claim that a set of dispatches happens at the same time. */
const CONCURRENCY = /\b(?:in parallel|parallel|concurrent|concurrently|simultaneously)\b/i;

/**
 * A shape that hands the set out one member at a time. Not only loop heads:
 * "one dispatch per message" is a serialization instruction with no loop in it,
 * and its absence here is why the deleted execute.md sentence went unnamed.
 */
const SERIAL_SHAPE = new RegExp('\\b(?:for each|for every|one at a time|one by one'
  + '|in turn|per reviewer|per message'
  + '|one (?:dispatch|call|request|agent|reviewer|executor|verifier) per)\\b', 'i');

/** A host-capability hedge, which makes the rule optional and so a suggestion. */
const HOST_HEDGE = /\b(?:if|when|where)\s+the\s+host\s+(?:allows|supports|permits)\b/i;

/**
 * A sentence in the IMPERATIVE MOOD: a BARE-FORM dispatch verb in clause-initial
 * position - opening the sentence (past any list marker), or following a clause
 * opening (`|`, `:`, `;`, `,`, `(`, `[`) or a conjunction, modal or infinitive
 * `to`. This is the test that separates a sentence which ISSUES work from one
 * that reasons, forbids, describes or catalogues with the same vocabulary.
 *
 * Bare form only, because an inflection is what marks the other moods: `issues`
 * and `sent` in "every worktree issues its own findings, and all of them land in
 * one report" and in a `| ... | after all worktree batches are sent | ...`
 * catalog row are a third-person verb and a past participle - both report on
 * dispatch already arranged, neither hands a set out.
 *
 * Clause-initial only, because an imperative leads its clause: "Serializing it -
 * one dispatch per message - only adds latency" carries the offending phrase as
 * the OBJECT of a rationale, and `never` and `not` are absent from the lead set
 * on purpose, so a negation ("never for each reviewer in turn") excludes itself
 * from the shape it forbids.
 */
const IMPERATIVE = new RegExp('(?:^\\s*(?:(?:[-*+]|\\d+[.)])\\s+)?'
  + '|[|:;,(\\[]\\s*'
  + '|\\b(?:and|or|then|also|next|first|to|must|should|will|can|may)\\s+)'
  + '(?:dispatch|issue|fire|spawn|launch|send)\\b', 'i');

/**
 * A sentence that ends on a colon issues whatever the list under it holds, so it
 * carries an instruction without carrying its verb - which is the exact shape
 * #88 filed ("For each reviewer in the set, in parallel where the host allows:").
 * It gates the serial arm beside the imperative test, and only that arm: a
 * concurrency claim ending in a colon with no dispatch verb at all is a heading,
 * not an eager dispatch.
 */
const INTRODUCES = /:\s*$/;

/** A marker that the dispatch covers a SET rather than a single target. */
const DISTRIBUTIVE = /\b(?:each|every|all|both|them|the (?:whole )?set|per\s+[a-z]+)\b/i;

/** The mandated phrasing. `in one batch` is the same instruction. */
const MANDATE = /\b(?:in|as) one (?:message|batch)\b/i;

/**
 * A sentence that AFFIRMS a batch already stated rather than restating the
 * mandate: a compliant item says it once and then ELABORATES ("reuse it for
 * every executor in the batch"). These excuse the elaboration and nothing more.
 * Treating an affirmation as proof of compliance is a hole, not a shorthand -
 * "the whole batch issued one dispatch per message" affirms and violates in the
 * same breath, and a blanket suppressor lets exactly the sentence this rule
 * exists to catch back into the shipped file it was deleted from.
 */
const BATCH_AFFIRMING = /\b(?:in the batch|across the batch|the whole batch)\b/i;

/**
 * The serial shapes that INSTRUCT one-at-a-time delivery, as against the loop
 * heads (`for each`, `for every`) that merely distribute over a set. Only these
 * survive a batch affirmation, so an elaboration stays legal while a
 * serialization wearing one is still named.
 */
const SERIALIZES = new RegExp('\\b(?:one at a time|one by one|in turn|per reviewer'
  + '|per message'
  + '|one (?:dispatch|call|request|agent|reviewer|executor|verifier) per)\\b', 'i');

/** How much of the offending sentence the detail quotes. */
const QUOTE = 200;

/**
 * Abbreviations whose period is not a sentence end. `e.g. ` is house style in
 * the very directories this rule walks (10 files, 4 of them in
 * references/review-triggers.md), so splitting on it cuts a compliant sentence
 * in half and reports the fragment that lost the mandated phrasing.
 */
const ABBREV = /\b(?:e\.g|i\.e|etc|vs|cf|al|approx|resp)$/i;

/** @param {string} s @returns {string} */
const blank = (s) => ' '.repeat(s.length);

/**
 * Replace every code span with spaces. Line count and column positions are
 * preserved, so a reported line number still points at its source line.
 * @param {string} text
 * @returns {string}
 */
function maskCode(text) {
  /** @type {{marker: string, len: number}|null} */
  let fence = null;
  return text.split('\n').map((line) => {
    // Indent, run of fence characters, info string. Four or more leading spaces
    // is an indented code block and never a fence, which keeps an indented
    // `~~~` sample from opening one and blanking the rest of the file.
    const m = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (m) {
      const marker = m[1][0];
      const len = m[1].length;
      if (fence === null) {
        // A backtick fence's info string may not itself contain a backtick.
        if (!(marker === '`' && m[2].includes('`'))) fence = { marker, len };
      } else if (marker === fence.marker && len >= fence.len && !m[2].trim()) {
        // Only the marker that opened the fence closes it, only at its length
        // or longer, and only with nothing after it - so a ``` shown inside a
        // ```` container, or a `~~~ not a fence` line, is content and not a
        // boundary. Closing on the short form leaks the container's remaining
        // lines back into prose, where a deliberately-wrong example reads as
        // an instruction.
        fence = null;
      }
      return blank(line);
    }
    if (fence !== null) return blank(line);
    return line.replace(/`[^`]*`/g, blank);
  }).join('\n');
}

/**
 * @typedef {object} Block
 * @property {number} line 1-based source line the block starts at
 * @property {string} text the block's lines, whitespace-collapsed to one
 * @property {{at: number, line: number}[]} map offset in `text` -> source line
 */

/**
 * @typedef {object} Sentence
 * @property {number} line 1-based source line the sentence starts on
 * @property {string} text the sentence, terminator included
 */

/**
 * Split masked text into blocks. A blank line ends a block without starting
 * one; a heading, a list marker or a table pipe all end the previous block and
 * start their own, which is what keeps a compliant list item from excusing the
 * next one and one table row from gluing to the next.
 * @param {string} masked
 * @returns {Block[]}
 */
function blocks(masked) {
  /** @type {Block[]} */
  const out = [];
  /** @type {Block|null} */
  let cur = null;
  const lines = masked.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { cur = null; continue; }
    const piece = line.replace(/\s+/g, ' ').trim();
    const startsOne = /^\s*(?:[-*+]|\d+\.)\s/.test(line) || /^\s*#{1,6}\s/.test(line)
      || /^\s*\|/.test(line);
    if (cur === null || startsOne) {
      cur = { line: i + 1, text: piece, map: [{ at: 0, line: i + 1 }] };
      out.push(cur);
    } else {
      // The joining space sits at cur.text.length, so this line's text begins
      // one past it - the offset a sentence starting here would report.
      cur.map.push({ at: cur.text.length + 1, line: i + 1 });
      cur.text += ` ${piece}`;
    }
  }
  return out;
}

/**
 * The source line the character at `at` came from.
 * @param {Block} b
 * @param {number} at
 * @returns {number}
 */
function lineAt(b, at) {
  let line = b.line;
  for (const entry of b.map) {
    if (entry.at > at) break;
    line = entry.line;
  }
  return line;
}

/** Bracket pairs, opener and closer at the same index. */
const OPENERS = '([{';
const CLOSERS = ')]}';

/**
 * Mark every character sitting inside a CLOSED bracket span. A period or
 * semicolon there is punctuation within a citation, not a sentence end -
 * `(conventions.md Parallel work; seams.md concurrent dispatch)` is one
 * citation, and cutting it strands the mandated phrasing in the half before the
 * cut while the half after it reads as an unbatched instruction.
 *
 * Only a bracket that actually closes counts. Counting depth naively would let
 * one stray `(` in prose glue the rest of its block into a single sentence,
 * where any compliant clause whitewashes every offender after it - the exact
 * hole per-sentence evaluation exists to close.
 * @param {string} t
 * @returns {boolean[]}
 */
function bracketed(t) {
  /** @type {boolean[]} */
  const inside = new Array(t.length).fill(false);
  /** @type {{kind: number, at: number}[]} */
  const open = [];
  for (let i = 0; i < t.length; i++) {
    const o = OPENERS.indexOf(t[i]);
    if (o >= 0) { open.push({ kind: o, at: i }); continue; }
    const c = CLOSERS.indexOf(t[i]);
    if (c < 0) continue;
    for (let k = open.length - 1; k >= 0; k--) {
      if (open[k].kind !== c) continue;
      for (let j = open[k].at; j <= i; j++) inside[j] = true;
      open.length = k;
      break;
    }
  }
  return inside;
}

/**
 * A block's sentences, each carrying the source line it starts on. Splitting on
 * a period or semicolon followed by whitespace, at bracket depth zero only,
 * keeps the terminator with the sentence it ends and keeps a parenthetical
 * citation whole.
 * @param {Block} b
 * @returns {Sentence[]}
 */
function sentences(b) {
  /** @type {Sentence[]} */
  const out = [];
  const t = b.text;
  const inside = bracketed(t);
  let start = 0;
  for (let i = 0; i < t.length - 1; i++) {
    const c = t[i];
    if ((c !== '.' && c !== ';') || inside[i] || !/\s/.test(t[i + 1])) continue;
    if (ABBREV.test(t.slice(start, i))) continue;
    out.push({ line: lineAt(b, start), text: t.slice(start, i + 1) });
    let j = i + 1;
    while (j < t.length && /\s/.test(t[j])) j++;
    start = j;
    i = j - 1;
  }
  if (start < t.length) out.push({ line: lineAt(b, start), text: t.slice(start) });
  return out;
}

/**
 * Every sentence of `text` that sits in a block claiming concurrency for a set
 * of dispatches while handing them out one at a time, hedging on the host, or
 * dispatching the set concurrently without saying the set goes out in one
 * message.
 *
 * A non-string input returns `[]` rather than throwing: the caller reads files
 * off disk and a read that degrades is already reported as an unreadable
 * surface, so this side never turns one fault into two.
 * @param {any} text
 * @returns {{code: string, detail: string}[]}
 */
export function dispatchPhrasingIssues(text) {
  if (typeof text !== 'string') return [];
  /** @type {{code: string, detail: string}[]} */
  const out = [];
  for (const b of blocks(maskCode(text))) {
    if (!CONCURRENCY.test(b.text)) continue;
    for (const s of sentences(b)) {
      if (MANDATE.test(s.text)) continue;
      // An affirmation excuses an elaboration, never a serialization or a hedge.
      if (BATCH_AFFIRMING.test(s.text)
        && !SERIALIZES.test(s.text) && !HOST_HEDGE.test(s.text)) continue;
      // Only a sentence that ISSUES the set can violate a rule about how the
      // set is issued. Both arms require it; the serial arm also accepts a
      // trailing colon, which issues the list below it.
      const imperative = IMPERATIVE.test(s.text);
      const serial = (SERIAL_SHAPE.test(s.text) || HOST_HEDGE.test(s.text))
        && (imperative || INTRODUCES.test(s.text));
      const eager = imperative && CONCURRENCY.test(s.text) && DISTRIBUTIVE.test(s.text);
      if (!serial && !eager) continue;
      out.push({ code: CODE, detail: `line ${s.line}: ${s.text.slice(0, QUOTE)}` });
    }
  }
  return out;
}
