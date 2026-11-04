// @ts-check
// capture-writers.mjs - every prose site that issues a .planning/CAPTURE.md write, and self-verify's check 23 over them
// the rule is in references/capture-grammar.md: CAPTURE holds the phase in flight, nothing that accumulates fits
// lib/capture-file.mjs does the write and owns the file's bytes; this holds the enumeration and the check
// it exists because a close step filed every open item into the queue and /cad-plan read all of it on every pass
// hand-maintained: one capture call is fine at a user's request and wrong in a close step, so a row has to say which
// keyed on surface and subcommand, one row per write; every matched row must be non-durable to stay silent
// issuing means planning.mjs plus a write face, with node before it or a --flag after it; a bare mention takes no row
// a shell redirect to CAPTURE.md bypasses lib/capture-file.mjs, so it takes no row and is reported outright
// the cost: prose that says "append the item to CAPTURE.md" in words, with no redirect or subcommand, stays invisible
// pure: no disk or emit, no CONTRACTS row (lib/*.mjs are never invoked from prose)
'use strict';

/** The problem codes this rule files. */
export const CODES = Object.freeze({
  // a site issuing a write face that no register row settles
  unregistered: 'capture-writer-unregistered',
  // a site whose row says its write outlives the phase in flight
  durable: 'capture-writer-durable',
  // a site writing the file without going through lib/capture-file.mjs
  redirect: 'capture-writer-redirect',
});

/**
 * The planning.mjs subcommands that reach lib/capture-file.mjs, the one owner of CAPTURE.md's bytes: capture appends
 * one bullet under the heading its kind owns, debt-harvest rewrites the Debt markers section wholesale.
 * Other capture-prefixed subcommands only read the file and are left out.
 */
export const WRITE_FACES = Object.freeze(['capture', 'debt-harvest']);

/** The path a redirect has to name for the redirect kind to fire. */
export const CAPTURE_PATH = '.planning/CAPTURE.md';

/**
 * The register: one row per prose site that issues a write. surface is a root-relative POSIX path, subcommand
 * the write face, writes the file that site writes in a clause, durable the classification, reason the
 * justification: why a non-durable write can't accumulate, or what makes a durable one survive the phase.
 * durable: false means the write can't accumulate. A user's one-bullet capture and a
 * wholesale section rewrite can't, a per-item append at a phase boundary can.
 * @type {ReadonlyArray<{surface: string, subcommand: string, writes: string,
 *   durable: boolean, reason: string}>}
 */
export const CAPTURE_WRITERS = Object.freeze([
  Object.freeze({
    surface: 'skills/cad-capture/SKILL.md',
    subcommand: 'capture',
    writes: "this project's .planning/CAPTURE.md",
    durable: false,
    reason: "the user's own explicit capture - one bullet per deliberate act, made because the user asked for it, so the queue grows only as fast as the user chooses to fill it",
  }),
  Object.freeze({
    surface: 'skills/cad-capture/SKILL.md',
    subcommand: 'capture',
    writes: "Cadence's own queue beside the global config layer (--file <resolved dir>/CAPTURE.md)",
    durable: false,
    reason: 'the --cadence sibling writes a different file entirely, in the global config directory rather than this project, and is the same one-bullet-per-deliberate-act write as its sibling above',
  }),
  Object.freeze({
    surface: 'cadence-core/workflows/execute.md',
    subcommand: 'debt-harvest',
    writes: "the .planning/CAPTURE.md `## Debt markers` section",
    durable: false,
    reason: 'a wholesale rewrite of one section from the markers in the tracked tree, so it cannot accumulate - deleting a marker from source removes its bullet on the next run - and that section sits outside the recall walk by design (D-03, references/capture-grammar.md)',
  }),
  Object.freeze({
    surface: 'cadence-core/references/conventions.md',
    subcommand: 'debt-harvest',
    writes: "the .planning/CAPTURE.md `## Debt markers` section",
    durable: false,
    reason: 'the same wholesale section rewrite, stated here where the CADENCE-DEBT marker grammar is defined rather than invoked by a step',
  }),
]);

/** `<script>.mjs` then its first word, the shape check 2 already tokenizes. */
const CALL_RE = /([a-z-]+\.mjs)"?[ \t]+([a-z-]+)/g;
/** A flag directly after the subcommand: the site is passing arguments. */
const FLAG_AFTER_RE = /^[ \t]+--[a-z-]/;

/**
 * Is this occurrence executed or just named? A node command word before it on the line,
 * or a flag after it, means executed; anything else is prose naming the seam.
 * @param {string} before the line up to the match
 * @param {string} after the line from just past the subcommand
 */
function executed(before, after) {
  return /\bnode\b/.test(before) || FLAG_AFTER_RE.test(after);
}

/**
 * Is this occurrence of .planning/CAPTURE.md a shell redirect target?
 * Walked backwards over the characters and not matched by a regex, so a path prefix, a
 * quote or a long line can't surprise the scan: step back over an attached prefix, then
 * any quote, then horizontal space, and ask whether what remains is >.
 * A backtick stops the walk, which keeps every prose surface that
 * names the file, this rule's own reference included, silent.
 * @param {string} line @param {number} at index of the path in the line
 */
function isRedirectTarget(line, at) {
  let j = at - 1;
  while (j >= 0 && !' \t"\'`>'.includes(line[j])) j--;
  while (j >= 0 && (line[j] === '"' || line[j] === "'")) j--;
  while (j >= 0 && (line[j] === ' ' || line[j] === '\t')) j--;
  return j >= 0 && line[j] === '>';
}

/**
 * Every capture-writer issue in one prose surface.
 *
 * @param {string} surface root-relative POSIX path, as self-verify reports it
 * @param {string} text the surface's contents
 * @param {ReadonlyArray<{surface: string, subcommand: string, writes: string,
 *   durable: boolean, reason: string}>} [rows]
 * @returns {{kind: string, file: string, detail: string}[]}
 */
export function captureWriterIssues(surface, text, rows = CAPTURE_WRITERS) {
  const here = rows.filter((r) => r.surface === surface);
  const issues = [];
  for (const line of text.split('\n')) {
    for (const m of line.matchAll(CALL_RE)) {
      const [, script, sub] = m;
      if (script !== 'planning.mjs' || !WRITE_FACES.includes(sub)) continue;
      const at = /** @type {number} */ (m.index);
      if (!executed(line.slice(0, at), line.slice(at + m[0].length))) continue;
      const matched = here.filter((r) => r.subcommand === sub);
      if (!matched.length) {
        issues.push({
          kind: CODES.unregistered,
          file: surface,
          detail: `\`planning.mjs ${sub}\` writes ${CAPTURE_PATH} from this surface and no row in lib/capture-writers.mjs settles it - register the site with the reason its write cannot accumulate, or route the item to \`phases/<N>/SUMMARY.md\`'s \`## Open items\``,
        });
        continue;
      }
      const durable = matched.find((r) => r.durable);
      if (durable) {
        issues.push({
          kind: CODES.durable,
          file: surface,
          detail: `\`planning.mjs ${sub}\` is registered here as a write that OUTLIVES the phase in flight (${durable.reason}) - ${CAPTURE_PATH} holds only the phase in flight, so the item belongs in \`phases/<N>/SUMMARY.md\`'s \`## Open items\`, which parseSummarySnippets already indexes into the recall corpus`,
        });
      }
    }
    let at = line.indexOf(CAPTURE_PATH);
    while (at !== -1) {
      if (isRedirectTarget(line, at)) {
        issues.push({
          kind: CODES.redirect,
          file: surface,
          detail: `this surface writes ${CAPTURE_PATH} by shell redirect, bypassing lib/capture-file.mjs, the one owner of the file's format - the write belongs on the \`capture\` seam or nowhere`,
        });
        break;
      }
      at = line.indexOf(CAPTURE_PATH, at + 1);
    }
  }
  return issues;
}
