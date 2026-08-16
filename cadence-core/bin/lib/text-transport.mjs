// @ts-check
// text-transport.mjs - the register of every prose site that hands a seam a
// free-text value, and the pure rule self-verify runs over it (check 19).
//
// THE RULE ITSELF IS NOT HERE. `references/conventions.md` states it once - a
// value derived from agent output or repository content reaches the seam as a
// PATH, because a double-quoted shell word carrying `$(...)` or a backtick
// executes before Node starts and a path cannot - and every converted site
// cites that file. `lib/text-flag-file.mjs` carries the transport out at the
// seam. This module carries the ENUMERATION and the check that holds prose to
// it, the same split `lib/deferred-reads.mjs` uses: hand-maintained register,
// mechanical enforcement.
//
// WHY A HAND-MAINTAINED REGISTER. Whether a value is caller-derived is not
// derivable from the prose: `--next "/cad-execute {N}"` and
// `--next "<resume pointer>"` are the same shape, and only one of them can
// carry a `$(...)` the workflow never authored. Something has to state the
// judgement, and a judgement stated in a markdown table is a judgement no check
// reads - which is how the enumeration and the enforcement drift apart. So the
// rows are here, beside the rule that consumes them, and a site the register
// does not classify is a REPORTED problem rather than a silent pass.
//
// THE KEY IS `{surface, flag, value}`, NOT A LINE NUMBER. Line numbers rot on
// the first paragraph anyone inserts, and the classification is a property of
// the VALUE a site passes, not of where it sits. Keying on the value is also
// what keeps two uses of one flag in one surface apart:
// `cadence-core/workflows/progress.md` carries a composed `--next` (the routed
// action, which on the paused row is the user's own pause note) and a literal
// `--next "/cad-phase add"` five lines below it, and a per-flag key would have
// to call both the same thing. Two occurrences of an IDENTICAL value in one
// surface (`workflows/plan.md` prescribes the same close detail at two steps)
// are one row: they are one prescription written twice, and a second row would
// be a duplicate no reader could tell from a mistake.
//
// A ROW OUTLIVES ITS OCCURRENCE. Once a site is converted, its `--detail "..."`
// is gone from the prose and the row it left behind matches nothing - and it
// STAYS, because the row is the record of the classification and it is what
// makes the inline form coming back a reported problem instead of an
// unclassified one. Deleting a converted row does not make the tree cleaner; it
// makes the next reintroduction read as site seventeen.
//
// WHY NOT check 2's INVOCATION PARSER. Check 2 joins a `<script>.mjs <word>`
// prefix and skips any line without one (`self-verify.mjs`, `if (!contract)
// continue`). Of the qualifying flag mentions in this tree, thirty sit in prose
// fragments with no such prefix - "adds `--detail \"<what failed>\"` to that
// same line" is a sentence, not an invocation - so a check built on that parser
// would see barely half of the sites and call the tree clean (D-09).
//
// THE DISCRIMINATOR IS THE IMMEDIATELY FOLLOWING QUOTED VALUE (D-10). Prose
// that NAMES a flag - "OMIT `--detail` for a `PLAN COMPLETE` return", "the
// RAISED count travels on the `--raised` FLAG and never inside `--detail`" -
// prescribes no value and needs no row, and that is not a courtesy: a rule that
// demanded a row for every mention would make the register grow with every
// sentence that mentions a flag in order to FORBID it. So a flag followed by a
// backtick, a word, or a sentence is silent; a flag followed by a quote is a
// prescription and must be classified.
//
// AND WHAT IT CANNOT DELIMIT IS REPORTED, NEVER SKIPPED (D-11). An unquoted
// placeholder (`--label <label>`), a value that opens a quote and closes it on
// the next line (`workflows/verify.md`'s two-line `--next`), a flag ending its
// line: the scan cannot read those values, and a scan that quietly passed over
// what it cannot read would be exactly as reassuring as one that read
// everything. A register row for that surface and flag SETTLES such an
// occurrence - the register is the authority, the scan is only how it is
// applied - and when no row exists it is its own reported kind.
//
// `git tag -m` IS WATCHED TOO, on a `git tag` line only. It is the one site in
// the tree that provably puts repository content - a milestone name read out of
// PROJECT.md - into a double-quoted shell word (D-03), and it takes `-F <path>`
// for the same reason every seam flag here takes `--<field>-file <path>`. It
// is scoped to `git tag` because `-m` alone is `git commit -m`, which prose
// names constantly and which carries a message the workflow authors.
//
// Pure rule: no disk, no emit, no exit, no Date, no randomness. The caller
// (self-verify.mjs) owns the walk and the envelope.
'use strict';

/** The problem codes this rule files. */
export const CODES = Object.freeze({
  // The register says this value is caller-derived and the site still
  // prescribes the inline form.
  inline: 'text-transport-inline',
  // Site seventeen: a prescribed value no register row classifies at all.
  unregistered: 'text-transport-unregistered',
  // The scan can classify the occurrence as neither safe nor unsafe, and no row
  // for that surface and flag settles it.
  unclear: 'text-transport-unclear',
});

/**
 * The seam flags whose value is free text - every one has a `--<field>-file`
 * sibling (or, for `uat record`'s five, one shared `--fields-file`). Flags the
 * seam validates against a closed enum or an integer grammar are deliberately
 * absent: `--phase`, `--status`, `--result`, `--severity`, `--origin`,
 * `--family`, `--event` and `--tokens` carry values that cannot be arbitrary
 * repository prose, so no transport can protect them from anything (D-01).
 */
export const TEXT_FLAGS = Object.freeze([
  'detail', 'read', 'text', 'label', 'next',
  'reason', 'reported', 'cause', 'fix', 'evidence',
]);

/**
 * The register: one row per examined site.
 *
 * `surface` is the root-relative POSIX path, `flag` the flag as written
 * (`--detail`, or `-m` for the git-tag site), `value` the text the site passes
 * VERBATIM between its quotes, `derived` the classification, and `reason` the
 * required justification on every row that is not derived.
 *
 * `derived: true` does NOT mean the site is broken - it means the value is the
 * caller's, so the site must hand the seam a path. Rows converted by this phase
 * keep `derived: true` and simply no longer match any inline occurrence.
 * @type {ReadonlyArray<{surface: string, flag: string, value: string,
 *   derived: boolean, reason?: string}>}
 */
export const TEXT_TRANSPORT = Object.freeze([
  // --- lifecycle close details: what the dispatch said when it failed --------
  // Every one of these is a line the failed SUBAGENT produced, quoted into the
  // orchestrator's next shell command. That is agent output by definition.
  Object.freeze({
    surface: 'cadence-core/workflows/verify-deep.md',
    flag: '--detail', value: '<what failed>', derived: true,
  }),
  Object.freeze({
    surface: 'cadence-core/workflows/context.md',
    flag: '--detail', value: '<what failed>', derived: true,
  }),
  Object.freeze({
    surface: 'cadence-core/workflows/decision-review.md',
    flag: '--detail', value: '<what failed>', derived: true,
  }),
  Object.freeze({
    surface: 'cadence-core/workflows/minimalism-review.md',
    flag: '--detail', value: '<what failed>', derived: true,
  }),
  Object.freeze({
    surface: 'cadence-core/references/review-triggers.md',
    flag: '--detail', value: '<what failed>', derived: true,
  }),
  Object.freeze({
    // ONE row, TWO occurrences (`handle_return` and the checker's close): the
    // same prescription written at two steps, not two prescriptions.
    surface: 'cadence-core/workflows/plan.md',
    flag: '--detail', value: '<empty or unmarked return>', derived: true,
  }),
  Object.freeze({
    surface: 'cadence-core/references/plan-revision.md',
    flag: '--detail', value: '<empty or unmarked revision return>', derived: true,
  }),
  Object.freeze({
    surface: 'cadence-core/references/plan-revision.md',
    flag: '--detail', value: '<empty or unmarked narrowed return>', derived: true,
  }),
  Object.freeze({
    surface: 'cadence-core/workflows/execute.md',
    flag: '--detail', value: '<one line>', derived: true,
  }),
  Object.freeze({
    // The composite the phase exists for: a trigger name and a count, joined to
    // a voice list the MODEL composes from which reviewers actually ran.
    surface: 'cadence-core/references/review-triggers.md',
    flag: '--detail',
    value: '<trigger>: <n> survivors; voices <the reviewers that actually ran>',
    derived: true,
  }),

  // --- dispatch read-sets: what this site causes the worker to read ----------
  Object.freeze({
    // `/cad-decision-review` resolves its target from `$ARGUMENTS`.
    surface: 'cadence-core/workflows/decision-review.md',
    flag: '--read', value: '<the decision doc path>', derived: true,
  }),
  Object.freeze({
    // Same: `/cad-minimalism-review`'s target is the user's argument, resolved.
    surface: 'cadence-core/workflows/minimalism-review.md',
    flag: '--read', value: '<the resolved target reference>', derived: true,
  }),
  Object.freeze({
    surface: 'cadence-core/references/review-triggers.md',
    flag: '--read', value: '<the payload reference>', derived: false,
    reason: 'step 2 assembles this reference itself - the plan/diff file paths for shape (c), the <base_ref>..<head_ref> pair for shapes (a) and (b), the named scope for an in-context artifact - so it is composed from paths and git refs this workflow derives, never from agent output or repository prose (D-08 scopes the two user-supplied --read sites in, this one out)',
  }),

  // --- uat record: the free-text half of a failing item ----------------------
  Object.freeze({
    surface: 'cadence-core/workflows/verify.md',
    flag: '--evidence',
    value: '<the command and the output that settles it>', derived: true,
  }),
  Object.freeze({
    surface: 'cadence-core/workflows/verify.md',
    flag: '--reported', value: '<verbatim reply>', derived: true,
  }),
  Object.freeze({
    surface: 'cadence-core/workflows/verify.md',
    flag: '--reason', value: '<why>', derived: true,
  }),
  Object.freeze({
    surface: 'cadence-core/workflows/verify.md',
    flag: '--cause', value: '<root cause>', derived: true,
  }),
  Object.freeze({
    surface: 'cadence-core/workflows/verify.md',
    flag: '--fix', value: '{hash}, retest', derived: false,
    reason: 'the workflow authors this string; its one interpolation is the hash of the commit it just made, which is hex from git and carries no shell metacharacter',
  }),
  Object.freeze({
    surface: 'cadence-core/workflows/verify.md',
    flag: '--fix', value: 'routed to /cad-plan', derived: false,
    reason: 'a literal the workflow authors, with nothing interpolated into it at all',
  }),

  // --- outcome details the workflow authors ---------------------------------
  Object.freeze({
    surface: 'cadence-core/workflows/verify.md',
    flag: '--detail', value: '<complete or partial>', derived: false,
    reason: "the seam's own `uat status` result word, one of two literals this workflow reads back off an ok:true envelope",
  }),
  Object.freeze({
    surface: 'cadence-core/references/triage-gate.md',
    flag: '--detail', value: '<trigger>', derived: false,
    reason: 'a trigger name, drawn from the closed set config.schema.json declares under review.triggers.<t> - the same class of value D-01 puts out of scope at an enum-validated flag',
  }),

  // --- cursor pointers ------------------------------------------------------
  Object.freeze({
    // The one-line "where I was", from `$ARGUMENTS` or the user's own answer.
    surface: 'skills/cad-pause/SKILL.md',
    flag: '--next', value: '<resume pointer>', derived: true,
  }),
  Object.freeze({
    // The route table's first row resumes "at the cursor's next action" - which
    // is the pause note above, the user's own sentence, copied forward.
    surface: 'cadence-core/workflows/progress.md',
    flag: '--next', value: '<routed action from below>', derived: true,
  }),
  Object.freeze({
    surface: 'cadence-core/workflows/progress.md',
    flag: '--next', value: '/cad-phase add', derived: false,
    reason: 'a literal slash command this workflow authors (D-02: the seven literal --next sites stay inline)',
  }),
  Object.freeze({
    surface: 'cadence-core/workflows/adopt.md',
    flag: '--next', value: '/cad-context 1', derived: false,
    reason: 'a literal slash command this workflow authors (D-02)',
  }),
  Object.freeze({
    surface: 'cadence-core/workflows/new-project.md',
    flag: '--next', value: '/cad-context 1', derived: false,
    reason: 'a literal slash command this workflow authors (D-02)',
  }),
  Object.freeze({
    surface: 'cadence-core/workflows/milestone.md',
    flag: '--next', value: '/cad-phase add', derived: false,
    reason: 'a literal slash command this workflow authors (D-02)',
  }),
  Object.freeze({
    surface: 'cadence-core/workflows/plan.md',
    flag: '--next', value: '/cad-execute {N}', derived: false,
    reason: 'a literal slash command this workflow authors, interpolating only the phase number (D-02)',
  }),
  Object.freeze({
    surface: 'cadence-core/workflows/context.md',
    flag: '--next', value: '/cad-plan {N}', derived: false,
    reason: 'a literal slash command this workflow authors, interpolating only the phase number (D-02)',
  }),
  Object.freeze({
    surface: 'cadence-core/workflows/execute.md',
    flag: '--next', value: '/cad-verify <N>', derived: false,
    reason: 'a literal slash command this workflow authors, interpolating only the phase number (D-02)',
  }),
  Object.freeze({
    surface: 'cadence-core/workflows/undo.md',
    flag: '--next', value: '<the redo step>', derived: false,
    reason: 'the slash command that re-runs the phase from the status this same call sets - /cad-plan <N> after a full revert, /cad-execute <N> after a partial one - so it is the same workflow-authored routing pointer as the seven literal sites, written as a placeholder because the status picks which one',
  }),
  Object.freeze({
    // The scan cannot delimit this one: the value opens on `:306` and closes on
    // `:307`. This row is what settles it (D-11).
    surface: 'cadence-core/workflows/verify.md',
    flag: '--next',
    value: "<next phase's /cad-context, or /cad-milestone if this was the last - the audit gate precedes any ship>",
    derived: false,
    reason: 'a literal slash command this workflow authors, chosen by whether a next phase exists (D-02)',
  }),

  // --- the two sites that name `--text` in order to FORBID it ---------------
  // Both already prescribe `--text-file`; the inline form appears only in the
  // sentence explaining why it is not used. They are registered rather than
  // exempted so the enumeration stays complete.
  Object.freeze({
    surface: 'cadence-core/workflows/execute.md',
    flag: '--text', value: '<item>', derived: false,
    reason: 'the site already prescribes --text-file and names the inline form only to state what it would do to a `$(...)` in a captured item',
  }),
  Object.freeze({
    surface: 'skills/cad-capture/SKILL.md',
    flag: '--text', value: '<text>', derived: false,
    reason: 'the site already prescribes --text-file and names the inline form only to state what it would do to a `$(...)` in a captured sentence',
  }),

  // --- the milestone label, one value at two sites --------------------------
  Object.freeze({
    // Unquoted at the site, so the scan cannot delimit it either; this row is
    // what settles it, and it settles it as the value the phase exists for.
    surface: 'cadence-core/workflows/milestone.md',
    flag: '--label', value: '<label>', derived: true,
  }),
  Object.freeze({
    // The goal statement's own example (D-03): a milestone name read out of
    // PROJECT.md, quoted into a shell word.
    surface: 'skills/cad-land/SKILL.md',
    flag: '-m', value: '<milestone label>', derived: true,
  }),
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
      // A delimited value is matched on the value itself; an undelimitable one
      // falls back to the rows for that flag, which is the register acting as
      // the authority the scan could not be.
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
