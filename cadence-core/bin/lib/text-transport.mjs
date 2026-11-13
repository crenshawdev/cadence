// @ts-check
// text-transport.mjs - every prose site that hands a seam free text, and self-verify's check 19 over them
// the rule is in references/conventions.md: agent or repo text reaches a seam as a path, since "$(...)" runs first
// hand-maintained: caller-derived isn't visible in the prose, "/cad-execute {N}" and "<resume pointer>" read alike
// keyed on surface, flag and value because line numbers rot; an unclassified site is reported, never passed
// only a quoted value right after the flag prescribes anything; what the scan can't delimit needs a row
// pure: no disk or emit; the caller owns the walk and the envelope
'use strict';

/** The problem codes this rule files. */
export const CODES = Object.freeze({
  // the register says this value is caller-derived and the site still prescribes it inline
  inline: 'text-transport-inline',
  // a prescribed value no register row classifies at all
  unregistered: 'text-transport-unregistered',
  // the scan can't classify the occurrence, and no row for that surface and flag settles it
  unclear: 'text-transport-unclear',
});

/**
 * The seam flags whose value is free text, each with a `--<field>-file` sibling (or the one shared `--fields-file`
 * for `uat record`'s five).
 * Flags validated against a closed enum or an integer can't carry repo prose, so a transport protects nothing there.
 * Path-list flags (--bracket-read, --payload) take paths the workflow builds, which already are the file transport.
 * --read stays watched: its inline form takes a read-set the caller composed.
 * The test is where the value comes from, never the flag's shape.
 */
export const TEXT_FLAGS = Object.freeze([
  'detail', 'read', 'text', 'label', 'next',
  'reason', 'reported', 'cause', 'fix', 'evidence',
]);

/**
 * One register row. The named fields are the keys, written in the order the register has always carried them, and
 * the row comes back frozen. `reason` is a key only when one is given.
 * @param {{surface: string, flag: string, value: string, derived: boolean, reason?: string}} f
 */
const row = ({ surface, flag, value, derived, reason }) => Object.freeze(
  reason === undefined ? { surface, flag, value, derived } : { surface, flag, value, derived, reason });

/**
 * The register: one row per examined site. surface is a root-relative POSIX path, flag the flag as
 * written (-m for the git tag site), value the text the site passes between its quotes verbatim,
 * derived the classification, and reason the justification every non-derived row needs.
 * derived: true doesn't mean the site is broken, only that the value is the caller's and must reach
 * the seam as a path. Converted rows keep it and just stop matching an inline occurrence.
 * @type {ReadonlyArray<{surface: string, flag: string, value: string,
 *   derived: boolean, reason?: string}>}
 */
export const TEXT_TRANSPORT = Object.freeze([
  // --- lifecycle close details: what the dispatch said when it failed --------
  // each is a line the failed subagent produced, quoted into the orchestrator's next shell command
  row({ surface: 'cadence-core/workflows/verify-deep.md', flag: '--detail', value: '<what failed>', derived: true }),
  row({ surface: 'cadence-core/workflows/context.md', flag: '--detail', value: '<what failed>', derived: true }),
  row({ surface: 'cadence-core/workflows/decision-review.md', flag: '--detail', value: '<what failed>', derived: true }),
  row({ surface: 'cadence-core/workflows/minimalism-review.md', flag: '--detail', value: '<what failed>', derived: true }),
  // moved to review-inline.md with step 4's by-hand reviewer dispatch
  row({ surface: 'cadence-core/references/review-inline.md', flag: '--detail', value: '<what failed>', derived: true }),
  // one row, two occurrences (handle_return and the checker's close): the same prescription written twice
  row({ surface: 'cadence-core/workflows/plan.md', flag: '--detail', value: '<empty or unmarked return>', derived: true }),
  row({
    surface: 'cadence-core/references/plan-revision.md', flag: '--detail', value: '<empty or unmarked revision return>', derived: true,
  }),
  row({
    surface: 'cadence-core/references/plan-revision.md', flag: '--detail', value: '<empty or unmarked narrowed return>', derived: true,
  }),
  row({ surface: 'cadence-core/workflows/execute.md', flag: '--detail', value: '<one line>', derived: true }),
  // a trigger name and a count joined to a voice list the model composes from which reviewers ran
  // cold-split out of review-triggers.md, and the row moved with its prescription
  row({
    surface: 'cadence-core/references/review-record.md', flag: '--detail', value: '<trigger>: <n> survivors; voices <the reviewers that actually ran>', derived: true,
  }),

  // --- dispatch read-sets: what this site causes the worker to read ----------
  // `/cad-decision-review` resolves its target from `$ARGUMENTS`.
  row({ surface: 'cadence-core/workflows/decision-review.md', flag: '--read', value: '<the decision doc path>', derived: true }),
  // Same: `/cad-minimalism-review`'s target is the user's argument, resolved.
  row({
    surface: 'cadence-core/workflows/minimalism-review.md', flag: '--read', value: '<the resolved target reference>', derived: true,
  }),
  row({
    surface: 'cadence-core/references/review-inline.md', flag: '--read', value: '<the payload reference>', derived: false,
    reason: 'step 2 assembles this reference itself - the plan/diff file paths for shape (c), the <base_ref>..<head_ref> pair for shapes (a) and (b), the named scope for an in-context artifact - so it is composed from paths and git refs this workflow derives, never from agent output or repository prose (D-08 scopes the two user-supplied --read sites in, this one out)',
  }),

  // --- uat record: the free-text half of a failing item ----------------------
  row({
    surface: 'cadence-core/workflows/verify.md', flag: '--evidence', value: '<the command and the output that settles it>', derived: true,
  }),
  row({ surface: 'cadence-core/workflows/verify.md', flag: '--reported', value: '<verbatim reply>', derived: true }),
  row({ surface: 'cadence-core/workflows/verify.md', flag: '--reason', value: '<why>', derived: true }),
  row({ surface: 'cadence-core/workflows/verify.md', flag: '--cause', value: '<root cause>', derived: true }),
  row({
    surface: 'cadence-core/workflows/verify.md', flag: '--fix', value: '{hash}, retest', derived: false,
    reason: 'the workflow authors this string; its one interpolation is the hash of the commit it just made, which is hex from git and carries no shell metacharacter',
  }),
  row({
    surface: 'cadence-core/workflows/verify.md', flag: '--fix', value: 'routed to /cad-plan', derived: false,
    reason: 'a literal the workflow authors, with nothing interpolated into it at all',
  }),

  // --- outcome details the workflow authors ---------------------------------
  row({
    surface: 'cadence-core/workflows/verify.md', flag: '--detail', value: '<complete or partial>', derived: false,
    reason: "the seam's own `uat status` result word, one of two literals this workflow reads back off an ok:true envelope",
  }),
  row({
    surface: 'cadence-core/references/triage-gate-blocking.md', flag: '--detail', value: '<trigger>', derived: false,
    reason: 'a trigger name, drawn from the closed set config.schema.json declares under review.triggers.<t> - the same class of value D-01 puts out of scope at an enum-validated flag',
  }),

  // --- cursor pointers ------------------------------------------------------
  // The one-line "where I was", from `$ARGUMENTS` or the user's own answer.
  row({ surface: 'skills/cad-pause/SKILL.md', flag: '--next', value: '<resume pointer>', derived: true }),
  // the route table's first row resumes at the cursor's next action, which is the user's pause note copied forward
  row({ surface: 'cadence-core/workflows/progress.md', flag: '--next', value: '<routed action from below>', derived: true }),
  row({
    surface: 'cadence-core/workflows/progress.md', flag: '--next', value: '/cad-phase add', derived: false,
    reason: 'a literal slash command this workflow authors (D-02: the literal --next sites stay inline)',
  }),
  row({
    surface: 'cadence-core/workflows/adopt.md', flag: '--next', value: '/cad-context 1', derived: false,
    reason: 'a literal slash command this workflow authors (D-02)',
  }),
  row({
    surface: 'cadence-core/workflows/new-project.md', flag: '--next', value: '/cad-context 1', derived: false,
    reason: 'a literal slash command this workflow authors (D-02)',
  }),
  row({
    surface: 'cadence-core/workflows/milestone.md', flag: '--next', value: '/cad-phase add', derived: false,
    reason: 'a literal slash command this workflow authors (D-02)',
  }),
  row({
    surface: 'cadence-core/workflows/plan.md', flag: '--next', value: '/cad-execute {N}', derived: false,
    reason: 'a literal slash command this workflow authors, interpolating only the phase number (D-02)',
  }),
  row({
    surface: 'cadence-core/workflows/context.md', flag: '--next', value: '/cad-plan {N}', derived: false,
    reason: 'a literal slash command this workflow authors, interpolating only the phase number (D-02)',
  }),
  row({
    surface: 'cadence-core/workflows/execute.md', flag: '--next', value: '/cad-verify <N>', derived: false,
    reason: 'a literal slash command this workflow authors, interpolating only the phase number (D-02)',
  }),
  row({
    surface: 'cadence-core/workflows/execute.md', flag: '--next', value: '/cad-execute <N>', derived: false,
    reason: 'a literal slash command this workflow authors, interpolating only the phase number (D-02)',
  }),
  row({
    surface: 'cadence-core/workflows/undo.md', flag: '--next', value: '<the redo step>', derived: false,
    reason: 'the slash command that re-runs the phase from the status this same call sets - /cad-plan <N> after a full revert, /cad-execute <N> after a partial one - so it is the same workflow-authored routing pointer as the literal sites, written as a placeholder because the status picks which one',
  }),
  // the scan can't delimit this one, the value opens on one line and closes on the next, so this row settles it
  row({
    surface: 'cadence-core/workflows/verify.md', flag: '--next', value: "<next phase's /cad-context, or /cad-milestone if this was the last - the audit gate precedes any ship>", derived: false,
    reason: 'a literal slash command this workflow authors, chosen by whether a next phase exists (D-02)',
  }),

  // --- the two sites that name `--text` in order to FORBID it ---------------
  // both already prescribe --text-file and name the inline form only to say
  // why it isn't used; registered so the enumeration stays complete
  row({
    surface: 'cadence-core/workflows/execute.md', flag: '--text', value: '<item>', derived: false,
    reason: 'the site already prescribes --text-file and names the inline form only to state what it would do to a `$(...)` in a captured item',
  }),
  row({
    surface: 'skills/cad-capture/SKILL.md', flag: '--text', value: '<text>', derived: false,
    reason: 'the site already prescribes --text-file and names the inline form only to state what it would do to a `$(...)` in a captured sentence',
  }),

  // --- the milestone label, one value at two sites --------------------------
  // unquoted at the site, so the scan can't delimit it; this row settles it, as the value the check exists for
  row({ surface: 'cadence-core/workflows/milestone.md', flag: '--label', value: '<label>', derived: true }),
  // a milestone name read out of PROJECT.md, quoted into a shell word
  row({ surface: 'skills/cad-land/SKILL.md', flag: '-m', value: '<milestone label>', derived: true }),
]);

/** A watched flag, followed by neither another flag character nor a letter. */
const FLAG_RE = new RegExp(`--(?:${TEXT_FLAGS.join('|')})(?![a-z0-9-])`, 'g');
/** `-m` on a `git tag` line, which is the only line where it carries a label. */
const TAG_M_RE = /\bgit tag\b[^\n]*?(-m)(?![a-z0-9-])/g;

/**
 * What follows a flag on its own line: a delimited value, an undelimitable one,
 * or nothing that reads as a value at all.
 * @param {string} rest the line from just past the flag to its end
 * @returns {{shape: 'value', value: string}
 *   | {shape: 'unclear', why: string} | {shape: 'named'}}
 */
function following(rest) {
  const tail = rest.replace(/^[ \t]+/, '');
  if (tail.startsWith('"')) {
    const end = tail.indexOf('"', 1);
    if (end === -1) return { shape: 'unclear', why: 'its value opens a quote that never closes on this line' };
    return { shape: 'value', value: tail.slice(1, end) };
  }
  // An unquoted placeholder. The value is real and the scan cannot read it.
  if (tail.startsWith('<') || tail.startsWith('{')) {
    return { shape: 'unclear', why: 'its value is an unquoted placeholder' };
  }
  if (tail === '') return { shape: 'unclear', why: 'nothing follows it on this line' };
  // A backtick, a word, a comma: the flag is being NAMED, not passed a value.
  return { shape: 'named' };
}

/**
 * Every text-transport issue in one prose surface.
 *
 * @param {string} surface root-relative POSIX path, as self-verify reports it
 * @param {string} text the surface's contents
 * @param {ReadonlyArray<{surface: string, flag: string, value: string,
 *   derived: boolean, reason?: string}>} [rows]
 * @returns {{kind: string, file: string, detail: string}[]}
 */
export function textTransportIssues(surface, text, rows = TEXT_TRANSPORT) {
  const here = rows.filter((r) => r.surface === surface);
  const issues = [];
  for (const line of text.split('\n')) {
    /** @type {{flag: string, rest: string}[]} */
    const hits = [];
    for (const m of line.matchAll(FLAG_RE)) {
      hits.push({ flag: m[0], rest: line.slice(m.index + m[0].length) });
    }
    for (const m of line.matchAll(TAG_M_RE)) {
      hits.push({ flag: '-m', rest: line.slice(m.index + m[0].length) });
    }
    for (const { flag, rest } of hits) {
      const seen = following(rest);
      if (seen.shape === 'named') continue;
      const forFlag = here.filter((r) => r.flag === flag);
      // a delimited value is matched on itself; an undelimitable one falls back to that
      // flag's rows, the register acting as the authority the scan couldn't be
      const matched = seen.shape === 'value'
        ? forFlag.filter((r) => r.value === seen.value)
        : forFlag;
      if (!matched.length) {
        issues.push(seen.shape === 'value'
          ? { kind: CODES.unregistered, file: surface,
            detail: `\`${flag} "${seen.value}"\` is classified by no row in lib/text-transport.mjs - register it as caller-derived, or out of scope with the reason, before the prose ships` }
          : { kind: CODES.unclear, file: surface,
            detail: `\`${flag}\` prescribes a value the scan cannot delimit (${seen.why}) and no register row for \`${flag}\` in this surface settles it - add the row rather than leaving the site unreadable` });
        continue;
      }
      if (matched.some((r) => r.derived)) {
        issues.push({ kind: CODES.inline, file: surface,
          detail: `\`${flag}\` still prescribes an inline value (\`${matched[0].value}\`) the register classifies caller-derived - it must reach the seam as a PATH (cadence-core/references/conventions.md states the transport)` });
      }
    }
  }
  return issues;
}
