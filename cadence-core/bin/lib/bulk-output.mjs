// @ts-check
// bulk-output.mjs - every prose site that prescribes a bulk-response tool call, and self-verify's check 20 over them
// the rule is in references/conventions.md, where it's stated once
// hand-maintained, because bulk is a measurement the prose can't show: trace render and reads --join look identical
// keyed on surface, shape and call; a row outlives its occurrence, so the inline form returning is a regression
// an invocation, not a mention; git diff with a bounding flag, or neither a range nor --cached, is excluded
// one line at a time with no continuations joined, and a redirect needs whitespace before the >
'use strict';

/** The problem codes this rule files. */
export const CODES = Object.freeze({
  // the register says this site owes the file transport and prescribes the call with its output in the transcript
  inline: 'bulk-output-inline',
  // a prescribed watched call no register row classifies
  unregistered: 'bulk-output-unregistered',
  // the scan can't delimit the occurrence, and no row for that surface and shape settles it
  unclear: 'bulk-output-unclear',
});

/**
 * The watched call shapes: measured over the byte threshold in
 * references/conventions.md or, for git diff, unbounded by construction.
 * seam is the token that must also be on the line for an occurrence to be an invocation and not a
 * sentence about one (null needs none); bounded are the flags that make the form unable to break the
 * rule; forms are the argument shapes that keep it watched, and empty watches every shape.
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
    shape: 'config catalog',
    token: /\bcatalog\b/g,
    seam: 'config.mjs',
    bounded: Object.freeze([]),
    forms: Object.freeze([]),
    why: 'measured 60,763 B on a template repository, 2026-11-08 - every setting\'s label, text and value in force, which the sentence match reads from a file',
  }),
  Object.freeze({
    shape: 'codemap slice',
    token: /\bcodemap\s+slice\b/g,
    seam: 'planning.mjs',
    bounded: Object.freeze([]),
    forms: Object.freeze([]),
    why: 'bounded at 10,000 B by the seam itself (D-20), with rows measured at p50 333 B and max 22,998 B before the bound - watched so a site that prescribes it is a decision on the register',
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
 * The register: one row per examined site. surface is a root-relative POSIX path, shape the watched shape's id, call
 * the call as written with any redirect stripped, bytes the measured response size or 'unbounded' where the range
 * sets it, measured the date of that figure.
 * transport is how the site meets the rule: redirect (on the call's own line, the only value the scan enforces), file
 * (the output reaches a file but the destination is in prose off the call's line), none (no transport owed).
 * reason is required on every row that isn't redirect, because an unexplained exemption looks like an oversight.
 * @type {ReadonlyArray<{surface: string, shape: string, call: string,
 *   bytes: number|'unbounded', measured: string,
 *   transport: 'redirect'|'file'|'none', reason?: string}>}
 */
export const BULK_OUTPUT = Object.freeze([
  // --- trace render: the three converted sites ------------------------------
  // each redirects to a scratch path and reads back only what its step prints or branches on; the
  // rows keep matching the converted call, so deleting the redirect is a reported regression
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

  // --- codemap slice: the planner's reference ---------------------------------
  Object.freeze({
    surface: 'cadence-core/references/code-map.md',
    shape: 'codemap slice', call: 'codemap slice --files a.mjs,b.mjs --symbols parseThing --terms billing,retry',
    bytes: 10000, measured: '2026-11-06', transport: 'none',
    reason: 'the seam bounds its whole answer at or under 10,000 B and reports truncated (D-20), so the answer is never the bulk; measured with 10 callers per symbol, an oversized row sheds callers first',
  }),

  // --- config catalog: the sentence match ------------------------------------
  Object.freeze({
    surface: 'cadence-core/workflows/config-menu.md',
    shape: 'config catalog', call: 'catalog',
    bytes: 60763, measured: '2026-11-08', transport: 'redirect',
  }),

  // --- git diff: the four that already write to a file -----------------------
  Object.freeze({
    // the cross-model arm was cold-split out of review-triggers.md with its
    // composition block; the row moved, the prescription is byte-identical
    surface: 'cadence-core/references/review-cross-model.md',
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
    reason: 'the step writes it to `<plandir>/records/reports/plan-<k>-risk.diff` and fires with that path; the destination is on the next line of the same sentence, which is why the row settles the occurrence and the scan does not',
  }),
  Object.freeze({
    surface: 'cadence-core/workflows/task.md',
    shape: 'git diff', call: "git diff <parent of the task's first commit>..HEAD",
    bytes: 'unbounded', measured: '2026-08-17', transport: 'file',
    reason: 'the step writes it to `.planning/tasks/{slug}/risk-task-{slug}.diff` and fires with that path, exactly as execute.md does',
  }),

  // --- git diff: the three that describe a call another agent runs -----------
  // a Task-dispatched reviewer inherits the cwd and re-runs the command in
  // its own context, so the bytes never reach this transcript
  // registered anyway, because a row outlives its occurrence and
  // re-inlining the biggest transport has to read as a regression
  Object.freeze({
    surface: 'cadence-core/references/review-triggers.md',
    shape: 'git diff', call: 'git diff --cached',
    bytes: 'unbounded', measured: '2026-08-17', transport: 'none',
    reason: 'shape (b) names the command the REVIEWER re-runs in the cwd it inherits, so this surface issues nothing; the second occurrence moved to references/review-cross-model.md with the cold split and carries its own row there',
  }),
  Object.freeze({
    // the other half of what used to be one row's two occurrences: the cold split put the sentence
    // describing shape (b)'s redirect in review-cross-model.md and left the definition in
    // review-triggers.md, and each file needs its own row since the key is surface, shape and call
    surface: 'cadence-core/references/review-cross-model.md',
    shape: 'git diff', call: 'git diff --cached',
    bytes: 'unbounded', measured: '2026-08-17', transport: 'none',
    reason: 'the arm names the command the REVIEWER re-runs in the cwd it inherits, and where shape (b) redirects it into the payload scratch file it is that same prescription written again, so this surface issues nothing of its own',
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
    // the scan can't delimit this one, the call opens at the end of one
    // line and its range closes on the next; this row settles it
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
  // inside inline code a call ends at the closing backtick; in a fenced block it runs to the end of the line
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
      // a form its own flags already bound can't break the rule, and a shape whose
      // watched forms these arguments miss isn't the call this register is about
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
