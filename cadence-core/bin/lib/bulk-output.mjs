// @ts-check
// bulk-output.mjs - the register of every prose site that PRESCRIBES a tool
// call whose response is bulk, and the pure rule self-verify runs over it
// (check 20).
//
// THE RULE ITSELF IS NOT HERE. `references/conventions.md` states it once - a
// prescribed call whose measured response crosses the stated byte threshold
// sends that output to a scratch file and hands the transcript a digest of
// what the step actually needs, because a response sitting in the transcript
// is re-paid on every later turn at the cache-read rate - and every converted
// site cites that file. There is no seam and no flag to carry it out: the
// transport is a shell redirect plus a targeted read-back, which is why this
// module has no `lib/*-file.mjs` sibling the way `lib/text-transport.mjs` has
// `lib/text-flag-file.mjs`. This module carries the ENUMERATION and the check
// that holds prose to it, the same split `lib/text-transport.mjs` and
// `lib/deferred-reads.mjs` use: hand-maintained register, mechanical
// enforcement.
//
// WHY A HAND-MAINTAINED REGISTER. Whether a call's response is bulk is not
// derivable from the prose. `planning.mjs trace render --phase <N>` returned
// 14,857 B on this repository and `planning.mjs reads --join` 1,507 B, and the
// two lines look identical; the difference is a MEASUREMENT, taken once,
// against a record that exists. Something has to state it, and a measurement
// stated in a markdown table is a measurement no check reads - which is how
// the enumeration and the enforcement drift apart. So the rows are here,
// beside the rule that consumes them, and a site the register does not
// classify is a REPORTED problem rather than a silent pass.
//
// THE KEY IS `{surface, shape, call}`, NOT A LINE NUMBER, for the reason
// `lib/text-transport.mjs` states about keying on the VALUE: line numbers rot
// on the first paragraph anyone inserts, and the classification is a property
// of the CALL a site prescribes rather than of where it sits. Keying on the
// call is also what keeps two prescriptions of one shape in one surface apart:
// `references/review-triggers.md` prescribes `git diff <base_ref>..<head_ref>`
// with a redirect at its payload composition and DESCRIBES
// `git diff <pre-plan HEAD>..HEAD` as a file another workflow already wrote,
// and a per-shape key would have to call both the same thing. Two occurrences
// of an IDENTICAL call in one surface (`review-triggers.md` names
// `git diff --cached` at shape (b) and again where shape (b) redirects it) are
// one row: they are one prescription written twice, and a second row would be
// a duplicate no reader could tell from a mistake.
//
// A ROW OUTLIVES ITS OCCURRENCE. Once a site is converted, its inline form is
// gone from the prose and the row it left behind matches only the redirected
// call - and it STAYS, because the row is the record of the classification and
// it is what makes the inline form coming back a reported problem instead of
// an unclassified one. Deleting a converted row does not make the tree
// cleaner; it makes the next reintroduction read as a new site.
//
// THE DISCRIMINATOR IS AN INVOCATION LINE, NOT A PROSE MENTION. For the two
// `planning.mjs` shapes the test is the one `bin/trace.test.mjs`'s `traceCalls`
// helper already applies: an occurrence counts only on a line that ALSO names
// `planning.mjs`. That is what keeps `workflows/execute.md`'s and
// `workflows/plan.md`'s sentences ABOUT what `trace render` reports silent -
// they prescribe nothing, and a rule that demanded a row for every sentence
// mentioning a seam would make the register grow with the prose that explains
// it. `git diff` has no such second token, so its prose mentions are settled by
// rows carrying the reason (`references/conventions.md`'s parallel-work
// illustration is one), which is the register acting as the authority the scan
// could not be.
//
// AND WHAT FOLLOWS THE CALL DECIDES WHETHER IT IS ONE. A call closed
// immediately by a backtick or by sentence punctuation - "`planning.mjs
// recall`. Every claim below", the `config-reach.md` table cell - is being
// NAMED and prescribes nothing. A call followed by arguments is a prescription
// and must be classified.
//
// WHAT THE SCAN CANNOT DELIMIT IS REPORTED, NEVER SKIPPED. A call whose
// arguments wrap onto the next line (`workflows/coverage.md` wraps
// `git diff <phase-start>..<phase-end>` mid-call) ends its line with nothing
// after it, so the scan can read neither its form nor whether a redirect
// follows - and a scan that quietly passed over what it cannot read would be
// exactly as reassuring as one that read everything. A register row for that
// surface and SHAPE settles such an occurrence, and when no row exists it is
// its own reported kind.
//
// THE OUTPUT-BOUNDING `git diff` FLAGS ARE EXCLUDED BY CONSTRUCTION, and this
// is the record of it. `--stat`, `--shortstat`, `--numstat`, `--quiet`,
// `--name-only` and `--name-status` each replace the patch with a summary the
// caller asked for, so the form cannot break the rule at all; watching it would
// report every such site as unsafe against a rule none of them can break,
// exactly as `lib/text-transport.mjs` records its path-CSV exclusion. A
// `git diff` that is neither a whole range (`<a>..<b>`) nor `--cached` is out
// of the watched set for the same reason: `references/plan-revision.md`'s
// path-scoped PLAN diff is bounded by the paths it names.
//
// `weight.mjs` AND `weight.mjs resident` ARE NOT WATCHED, at 8,513 B and
// 20,206 B measured 2026-08-17. The only surface prescribing either is
// `docs/EVIDENCE.md`, a human-run measurement recipe that is not on
// self-verify's prose walk and whose output goes to a terminal rather than
// into a model's context. A rule about what a MODEL is handed has nothing to
// say about a command a person runs.
//
// TWO STATED LIMITS. (1) The scan reads one physical line at a time and joins
// no backslash continuations: measured over this tree on 2026-08-17, no
// watched call is written in a continued form, so the join `self-verify.mjs`'s
// check 2 performs would buy nothing here - a continuation introduced later is
// invisible to the scan rather than reported, which is the cost of not
// carrying it. (2) A redirect is recognized as whitespace followed by `>` or
// `>>` and then a non-space, so an angle-bracket placeholder (`--phase <N>`,
// `<base_ref>..<head_ref>`) is never read as one; a redirect written with no
// space before the `>` would be missed.
//
// Pure rule: no disk, no emit, no exit, no Date, no randomness. The caller
// (self-verify.mjs) owns the walk and the envelope.
'use strict';

/** The problem codes this rule files. */
export const CODES = Object.freeze({
  // The register says this site owes the file transport and it is prescribing
  // the call with its output riding the transcript again.
  inline: 'bulk-output-inline',
  // A prescribed watched call no register row classifies at all.
  unregistered: 'bulk-output-unregistered',
  // The scan cannot delimit the occurrence, and no row for that surface and
  // shape settles it.
  unclear: 'bulk-output-unclear',
});

/**
 * The watched call shapes: the ones MEASURED over the 10,000-byte threshold
 * `references/conventions.md` states, or - for `git diff` - unbounded by
 * construction and therefore over it for any range large enough.
 *
 * `seam` is the token that must also appear on the line for the occurrence to
 * be an invocation rather than a sentence about one; `null` means the shape
 * needs no second token. `bounded` are the flags that make the form incapable
 * of breaking the rule. `forms` are the argument shapes that keep it in the
 * watched set; an empty `forms` watches every argument shape.
 * @type {ReadonlyArray<{shape: string, token: RegExp, seam: string|null,
 *   bounded: ReadonlyArray<string>, forms: ReadonlyArray<RegExp>, why: string}>}
 */
export const BULK_SHAPES = Object.freeze([
  Object.freeze({
    shape: 'trace render',
    token: /\btrace\s+render\b/g,
    seam: 'planning.mjs',
    bounded: Object.freeze([]),
    forms: Object.freeze([]),
    why: 'measured 68,044 B unscoped and 14,857 B at --phase 3 on this repository, 2026-08-17 - the largest response any Cadence prose prescribes',
  }),
  Object.freeze({
    shape: 'recall',
    token: /\brecall\b/g,
    seam: 'planning.mjs',
    bounded: Object.freeze([]),
    forms: Object.freeze([]),
    why: 'measured 8,617 B on this repository, 2026-08-17 - UNDER the threshold, and watched anyway because it is the second-largest seam response in the tree and its size is a property of the corpus rather than of the call',
  }),
  Object.freeze({
    shape: 'git diff',
    token: /\bgit diff\b/g,
    seam: null,
    bounded: Object.freeze(['--stat', '--shortstat', '--numstat', '--quiet', '--name-only', '--name-status']),
    forms: Object.freeze([/\.\./, /--cached\b/]),
    why: 'unbounded by construction - the response is the RANGE\'s size, not the site\'s, and the four sites that issue one already write it to a file',
  }),
]);

/**
 * The register: one row per examined site.
 *
 * `surface` is the root-relative POSIX path, `shape` the watched shape's id,
 * `call` the call as the site writes it with any redirect stripped, `bytes` the
 * measured response size or `'unbounded'` where the response is the range's
 * rather than the site's, `measured` the date that figure was taken, and
 * `transport` how the site meets the rule:
 *
 *   `redirect` - the site prescribes the call with a shell redirect on its own
 *                line. This is the only value the scan ENFORCES: the same call
 *                written without the redirect is a reported regression.
 *   `file`     - the output reaches a file, but the destination is named in
 *                prose off the call's own line, so the register is what settles
 *                the occurrence rather than the scan.
 *   `none`     - no transport owed. Requires a reason.
 *
 * `reason` is REQUIRED on every row that is not `redirect`, for the reason
 * `lib/text-transport.mjs` requires one on every non-derived row: an
 * unexplained exemption is indistinguishable from an oversight.
 * @type {ReadonlyArray<{surface: string, shape: string, call: string,
 *   bytes: number|'unbounded', measured: string,
 *   transport: 'redirect'|'file'|'none', reason?: string}>}
 */
export const BULK_OUTPUT = Object.freeze([
  // --- trace render: the three sites TRN-02 converted ------------------------
  // Each redirects into a scratch path and reads back only the fields its step
  // prints or branches on. The rows keep matching the converted call, which is
  // what makes deleting the redirect a reported regression rather than a new,
  // unclassified site.
  Object.freeze({
    surface: 'cadence-core/references/triage-gate.md',
    shape: 'trace render', call: 'trace render --phase <N>',
    bytes: 14857, measured: '2026-08-17', transport: 'redirect',
  }),
  Object.freeze({
    surface: 'cadence-core/workflows/progress.md',
    shape: 'trace render', call: 'trace render --phase <current>',
    bytes: 14857, measured: '2026-08-17', transport: 'redirect',
  }),
  Object.freeze({
    surface: 'cadence-core/workflows/report.md',
    shape: 'trace render', call: 'trace render [--phase <N>]',
    bytes: 68044, measured: '2026-08-17', transport: 'redirect',
  }),

  // --- recall: three consumers and the reference that documents the envelope -
  Object.freeze({
    surface: 'cadence-core/workflows/context.md',
    shape: 'recall', call: 'recall "<key terms from the phase goal>"',
    bytes: 8617, measured: '2026-08-17', transport: 'none',
    reason: 'under the 10,000-byte threshold, and the step branches on the hits themselves - a digest of a recall result is the recall result',
  }),
  Object.freeze({
    surface: 'cadence-core/workflows/plan.md',
    shape: 'recall', call: 'recall "<key terms from the phase goal>"',
    bytes: 8617, measured: '2026-08-17', transport: 'none',
    reason: 'under the threshold, same call and same reason as the context.md site',
  }),
  Object.freeze({
    surface: 'cadence-core/workflows/debug.md',
    shape: 'recall', call: 'recall "<key terms from the symptom / bug description>"',
    bytes: 8617, measured: '2026-08-17', transport: 'none',
    reason: 'under the threshold, same reason as the other two consumers',
  }),
  Object.freeze({
    surface: 'cadence-core/references/recall.md',
    shape: 'recall', call: 'recall "<terms>"',
    bytes: 8617, measured: '2026-08-17', transport: 'none',
    reason: 'the reference that documents the envelope rather than a step that spends it - the call is written to show what one JSON line holds, and it is under the threshold either way',
  }),

  // --- git diff: the four that already write to a file -----------------------
  Object.freeze({
    surface: 'cadence-core/references/review-triggers.md',
    shape: 'git diff', call: 'git diff <base_ref>..<head_ref>',
    bytes: 'unbounded', measured: '2026-08-17', transport: 'redirect',
  }),
  Object.freeze({
    surface: 'cadence-core/references/review-triggers.md',
    shape: 'git diff', call: 'git diff <pre-plan HEAD>..HEAD',
    bytes: 'unbounded', measured: '2026-08-17', transport: 'file',
    reason: 'shape (c) DESCRIBES what the fire site already did - the orchestrator writes the range to a file and passes that path - so the destination is in the sentence rather than on the call, and workflows/execute.md is the surface that issues it',
  }),
  Object.freeze({
    surface: 'cadence-core/workflows/execute.md',
    shape: 'git diff', call: 'git diff {pre-plan HEAD}..HEAD',
    bytes: 'unbounded', measured: '2026-08-17', transport: 'file',
    reason: 'the step writes it to `<plandir>/reports/plan-<k>-risk.diff` and fires with that path; the destination is on the next line of the same sentence, which is why the row settles the occurrence and the scan does not',
  }),
  Object.freeze({
    surface: 'cadence-core/workflows/task.md',
    shape: 'git diff', call: "git diff <parent of the task's first commit>..HEAD",
    bytes: 'unbounded', measured: '2026-08-17', transport: 'file',
    reason: 'the step writes it to `.planning/tasks/{slug}/risk-task-{slug}.diff` and fires with that path, exactly as execute.md does',
  }),

  // --- git diff: the three that describe a call ANOTHER agent runs -----------
  // A Task-dispatched reviewer inherits the parent's cwd and re-runs the
  // command in its OWN context, so the bytes never enter this side's
  // transcript at all. They are registered rather than omitted precisely
  // because a row outlives its occurrence: re-inlining the biggest transport in
  // the tree has to read as a reported regression, not as a new site.
  Object.freeze({
    surface: 'cadence-core/references/review-triggers.md',
    shape: 'git diff', call: 'git diff --cached',
    bytes: 'unbounded', measured: '2026-08-17', transport: 'none',
    reason: 'shape (b) names the command the REVIEWER re-runs in the cwd it inherits, so this surface issues nothing; the second occurrence, where shape (b) redirects the same command into the payload scratch file, is that one prescription written twice',
  }),
  Object.freeze({
    surface: 'cadence-core/workflows/debug.md',
    shape: 'git diff', call: 'git diff --cached',
    bytes: 'unbounded', measured: '2026-08-17', transport: 'none',
    reason: 'a description of the command the reviewer runs in the cwd it inherits, never one this workflow issues',
  }),
  Object.freeze({
    surface: 'cadence-core/workflows/verify.md',
    shape: 'git diff', call: 'git diff --cached',
    bytes: 'unbounded', measured: '2026-08-17', transport: 'none',
    reason: 'a description of the command the reviewer runs in the cwd it inherits, never one this workflow issues',
  }),

  // --- git diff: the examined sites that prescribe no bulk output ------------
  Object.freeze({
    surface: 'cadence-core/references/plan-revision.md',
    shape: 'git diff', call: 'git diff -- .planning/phases/{N}/PLAN*.md',
    bytes: 'unbounded', measured: '2026-08-17', transport: 'none',
    reason: 'path-scoped to the plan files, so it is outside the watched forms (neither a whole range nor --cached) and its response is bounded by the paths it names - the row records that the site was examined',
  }),
  Object.freeze({
    surface: 'cadence-core/references/conventions.md',
    shape: 'git diff', call: 'git diff <a>..<b>',
    bytes: 'unbounded', measured: '2026-08-17', transport: 'none',
    reason: 'the parallel-work rule\'s own illustration of a call that must be serialized - it prescribes no step and issues nothing, and `git diff` carries no second token the scan could use to tell an illustration from an invocation',
  }),
  Object.freeze({
    // The scan cannot delimit this one: the call opens at the end of one line
    // and its range closes on the next. This row is what settles it.
    surface: 'cadence-core/workflows/coverage.md',
    shape: 'git diff', call: 'git diff <phase-start>..<phase-end>',
    bytes: 'unbounded', measured: '2026-08-17', transport: 'none',
    reason: 'the wrapped mention names the call the batching rule must serialize; the diff this step actually prescribes is the `--stat`-bounded one in the Implementation bullet, which cannot break the rule',
  }),
]);

/** Whitespace, then `>` or `>>`, then something: a redirect, not a placeholder. */
const REDIRECT_RE = /\s>>?\s*\S/;
/** The first non-space character after a call, when the call is only NAMED. */
const NAMED_RE = /^[`,.;:)\]!?]/;

/**
 * What follows one occurrence of a shape's token on its line.
 * @param {string} rest the line from just past the token to its end
 * @returns {{form: 'call', args: string, redirected: boolean}
 *   | {form: 'unclear', why: string} | {form: 'named'}}
 */
function following(rest) {
  if (rest.trim() === '') {
    return { form: 'unclear', why: 'the call ends its line, so its arguments are on another one' };
  }
  if (NAMED_RE.test(rest)) return { form: 'named' };
  // A call written inside inline code ends at the closing backtick; one in a
  // fenced block runs to the end of the line.
  const span = rest.split('`')[0];
  if (span.trim() === '') return { form: 'named' };
  const redirected = REDIRECT_RE.test(span);
  const args = (redirected ? span.slice(0, span.search(REDIRECT_RE)) : span);
  return { form: 'call', args: args.replace(/\s+/g, ' ').trimEnd(), redirected };
}

/**
 * Every bulk-output issue in one prose surface.
 *
 * @param {string} surface root-relative POSIX path, as self-verify reports it
 * @param {string} text the surface's contents
 * @param {ReadonlyArray<{surface: string, shape: string, call: string,
 *   bytes: number|'unbounded', measured: string,
 *   transport: 'redirect'|'file'|'none', reason?: string}>} [rows]
 * @returns {{kind: string, file: string, detail: string}[]}
 */
export function bulkOutputIssues(surface, text, rows = BULK_OUTPUT) {
  const here = rows.filter((r) => r.surface === surface);
  const issues = [];
  for (const line of text.split('\n')) {
    for (const shape of BULK_SHAPES) {
      if (shape.seam && !line.includes(shape.seam)) continue;
      for (const m of line.matchAll(shape.token)) {
      const seen = following(line.slice(m.index + m[0].length));
      if (seen.form === 'named') continue;
      const forShape = here.filter((r) => r.shape === shape.shape);
      if (seen.form === 'unclear') {
        // The register is the authority; the scan is only how it is applied.
        if (forShape.length) continue;
        issues.push({ kind: CODES.unclear, file: surface,
          detail: `\`${shape.shape}\` is prescribed where the scan cannot delimit it (${seen.why}) and no register row for \`${shape.shape}\` in this surface settles it - add the row rather than leaving the site unreadable` });
        continue;
      }
      const call = `${m[0].replace(/\s+/g, ' ')}${seen.args ? ` ${seen.args.trimStart()}` : ''}`;
      // A form its own flags already bound cannot break the rule, and a shape
      // whose watched forms none of these arguments match is not the call this
      // register is about.
      if (shape.bounded.some((f) => new RegExp(`${f}\\b`).test(seen.args))) continue;
      if (shape.forms.length && !shape.forms.some((f) => f.test(seen.args))) continue;
      const matched = forShape.filter((r) => r.call === call);
      if (!matched.length) {
        issues.push({ kind: CODES.unregistered, file: surface,
          detail: `\`${call}\` is classified by no row in lib/bulk-output.mjs - register it with its measured response size, or out of scope with the reason, before the prose ships` });
        continue;
      }
      if (!seen.redirected && matched.some((r) => r.transport === 'redirect')) {
        issues.push({ kind: CODES.inline, file: surface,
          detail: `\`${call}\` is registered as riding a scratch file and this line prescribes it with the output in the transcript - restore the redirect and the targeted read-back (cadence-core/references/conventions.md states the rule)` });
      }
      }
    }
  }
  return issues;
}
