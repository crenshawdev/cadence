// @ts-check
// dispatch-phrasing.mjs - the pure rule behind self-verify's `unbatched-dispatch` check (#88): a block that claims
// concurrency for a set of dispatches must say "in one message", and every sentence issuing the set must hold to it.
// review-triggers.md step 4 once said "in parallel where the host allows", a hedge that makes the serial behaviour
// it forbids. Sentences split at a period or semicolon, never a colon, which would sever a batch from its list.
// A heuristic: on a false positive, narrow the pattern here and never bend a correct surface around it.
'use strict';

/** The one problem code this lib files. */
export const CODE = 'unbatched-dispatch';

/** A claim that a set of dispatches happens at the same time. */
const CONCURRENCY = /\b(?:in parallel|parallel|concurrent|concurrently|simultaneously)\b/i;

/** The shapes that instruct one-at-a-time delivery, written once for the two patterns built from it. */
const SERIAL_ALTERNATION = 'one at a time|one by one|in turn|per reviewer|per message'
  + '|one (?:dispatch|call|request|agent|reviewer|executor|verifier) per';

/** Hands the set out one member at a time; "one dispatch per message" counts, though it has no loop. */
const SERIAL_SHAPE = new RegExp(`\\b(?:for each|for every|${SERIAL_ALTERNATION})\\b`, 'i');

/** A host-capability hedge, which makes the rule optional and so a suggestion. */
const HOST_HEDGE = /\b(?:if|when|where)\s+the\s+host\s+(?:allows|supports|permits)\b/i;

/**
 * A bare-form dispatch verb opening a clause, which tells a sentence that issues work from one that reasons or forbids.
 * Bare form only: "every worktree issues its own findings" and "batches are sent" report dispatch already arranged.
 * `never` and `not` stay out of the lead set on purpose, so a negation excludes itself from the shape it forbids.
 */
const IMPERATIVE = new RegExp('(?:^\\s*(?:(?:[-*+]|\\d+[.)])\\s+)?'
  + '|[|:;,(\\[]\\s*'
  + '|\\b(?:and|or|then|also|next|first|to|must|should|will|can|may)\\s+)'
  + '(?:dispatch|issue|fire|spawn|launch|send)\\b', 'i');

/** A trailing colon issues the list under it without the verb (the shape #88 filed); serial arm only. */
const INTRODUCES = /:\s*$/;

/** A marker that the dispatch covers a SET rather than a single target. */
const DISTRIBUTIVE = /\b(?:each|every|all|both|them|the (?:whole )?set|per\s+[a-z]+)\b/i;

/** The mandated phrasing. `in one batch` is the same instruction. */
const MANDATE = /\b(?:in|as) one (?:message|batch)\b/i;

/** Affirms a batch already stated: excuses an elaboration, never a serialization wearing one. */
const BATCH_AFFIRMING = /\b(?:in the batch|across the batch|the whole batch)\b/i;

/** The shapes that instruct one-at-a-time delivery, unlike loop heads, which only distribute. */
const SERIALIZES = new RegExp(`\\b(?:${SERIAL_ALTERNATION})\\b`, 'i');

/** How much of the offending sentence the detail quotes. */
const QUOTE = 200;

/** Abbreviations whose period isn't a sentence end; `e.g. ` is house style in the directories this walks. */
const ABBREV = /\b(?:e\.g|i\.e|etc|vs|cf|al|approx|resp)$/i;

/** @param {string} s @returns {string} */
const blank = (s) => ' '.repeat(s.length);

/**
 * Replace every code span with spaces, keeping line count and columns so a reported line still points at its source.
 * @param {string} text
 * @returns {string}
 */
function maskCode(text) {
  /** @type {{marker: string, len: number}|null} */
  let fence = null;
  return text.split('\n').map((line) => {
    // Four or more leading spaces is an indented code block, never a fence, so an indented `~~~` can't blank the file.
    const m = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (m) {
      const marker = m[1][0];
      const len = m[1].length;
      if (fence === null) {
        // A backtick fence's info string can't itself contain a backtick.
        if (!(marker === '`' && m[2].includes('`'))) fence = { marker, len };
      } else if (marker === fence.marker && len >= fence.len && !m[2].trim()) {
        // Only the marker that opened a fence closes it, at its length or longer with nothing after, so a ``` inside a
        // ```` container is content. Closing early leaks the container's lines into prose, where a deliberately wrong
        // example reads as an instruction.
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
 * Split masked text into blocks. A heading, list marker or table pipe ends the previous block and starts its own, so
 * one list item can't excuse the next and table rows don't glue together.
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
      // The joining space sits at cur.text.length, so this line's text starts one past it.
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
 * Mark every character inside a closed bracket span: a period or semicolon there is citation punctuation, and cutting
 * `(conventions.md Parallel work; seams.md concurrent dispatch)` strands the mandated phrasing in the half before the
 * cut. Only a bracket that closes counts, or one stray `(` would glue the rest of the block into one sentence where a
 * compliant clause whitewashes every offender after it.
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
 * A block's sentences, each with the source line it starts on. Splits on a period or semicolon followed by whitespace,
 * at bracket depth zero only, keeping the terminator and any parenthetical citation whole.
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
 * Every sentence of `text` in a block that claims concurrency for a set of dispatches while handing them out one at a
 * time, hedging on the host, or dispatching concurrently without saying one message. A non-string returns `[]` and not
 * a throw, since an unreadable file is already reported by the caller and this shouldn't make one fault two.
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
      // Only a sentence that issues the set can break a rule about issuing it; a trailing colon issues the list below.
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
