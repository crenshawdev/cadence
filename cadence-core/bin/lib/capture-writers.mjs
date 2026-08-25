// @ts-check
// capture-writers.mjs - the register of every prose site that ISSUES a
// `.planning/CAPTURE.md` write, and the pure rule self-verify runs over it
// (check 23).
//
// THE RULE ITSELF IS NOT HERE. `references/capture-grammar.md` states it once -
// CAPTURE holds the phase IN FLIGHT, so a write that can ACCUMULATE across
// phases does not belong in it, and a phase's open items live in
// `phases/<N>/SUMMARY.md`'s `## Open items`, which `parseSummarySnippets`
// already indexes into the recall corpus. `lib/capture-file.mjs` carries the
// write out at the seam and is the one owner of the file's bytes. This module
// carries the ENUMERATION and the check that holds prose to it, the same split
// `lib/text-transport.mjs` and `lib/deferred-reads.mjs` use: hand-maintained
// register, mechanical enforcement.
//
// WHY THIS EXISTS. `workflows/execute.md`'s summary step filed every phase open
// item into the queue, one call per item, at every phase close - a durable
// write into the file the close then REPORTS on, and the reason 276 bullets in
// 251,968 bytes were being read by `/cad-plan` on every planning pass. A prose
// edit alone leaves that reachable by the next person who writes a workflow
// step; it survived two plans' leases in this very phase. So the writer set is
// enumerated, and a site no row settles is a REPORTED problem.
//
// WHY A HAND-MAINTAINED REGISTER. Whether a write can accumulate is not
// derivable from the prose. `capture --kind todo` at a user's deliberate
// request is one bullet per deliberate act and `capture --kind todo` in a
// close step is one bullet per open item per phase forever - the same
// invocation, and only a judgement tells them apart. A judgement stated in a
// markdown table is a judgement no check reads, which is how an enumeration and
// its enforcement drift apart, so the rows sit here beside the rule that
// consumes them.
//
// THE KEY IS `{surface, subcommand}`. Line numbers rot on the first paragraph
// anyone inserts, and the classification is a property of the WRITE a site
// makes, not of where it sits. A surface that issues one face TWICE for two
// different writes carries one row per write - `skills/cad-capture/SKILL.md`
// does, its second site writing Cadence's own queue beside the global config
// layer rather than this repository's - and every row matched by an occurrence
// must be non-durable for that occurrence to be silent.
//
// A ROW OUTLIVES ITS OCCURRENCE, for `lib/text-transport.mjs`'s reason: the row
// is the record of the classification, and it is what makes the write coming
// back a reported problem rather than an unclassified one.
//
// WHAT COUNTS AS ISSUING A WRITE (the discriminator). Two shapes, and neither
// is prose shape:
//
//   1. `planning.mjs` followed by one of the two WRITE_FACES, in a form that is
//      EXECUTED - a `node` command word before it on the line, or a `--flag`
//      after it. The subcommand is tokenized the way check 2 tokenizes one, so
//      `capture-check` and `capture-sections` are not `capture`. A bare
//      backticked NAMING mention - `references/capture-grammar.md`'s
//      "written wholesale by `planning.mjs debt-harvest`" - instructs nothing
//      and takes no row, the same courtesy `lib/text-transport.mjs` extends to
//      a flag that is named rather than passed a value. Demanding a row for
//      every mention would make the register grow with every sentence written
//      to DESCRIBE the rule.
//   2. A shell redirect (`>` or `>>`) whose target is `.planning/CAPTURE.md`.
//      This is its own kind and takes no register row at all: it writes the
//      file without going through `lib/capture-file.mjs`, so it cannot be
//      classified as accumulating or not - it is already outside the one owner
//      of the format. Keying on the invocation alone would leave a step reading
//      `printf '%s\n' "<item>" >> .planning/CAPTURE.md` completely invisible,
//      which is the gap this phase's plan review named.
//
// THE COST THAT REMAINS, narrowed to what it actually is: prose instructing a
// hand write in WORDS alone - "append the item to CAPTURE.md" as English, no
// redirect and no subcommand - stays invisible. Widening to that is the
// unbounded-grammar problem, and it is not an oversight: there is no closed set
// of English sentences that mean "write this file", so a check built on one
// would report the sentences it happened to list and call the tree clean.
//
// Pure rule: no disk, no emit, no exit, no Date, no randomness. The caller
// (self-verify.mjs) owns the walk and the envelope. It takes no CONTRACTS row
// and no CLI entry point, for the reason self-verify.mjs check 14 states about
// `lib/*.mjs`.
'use strict';

/** The problem codes this rule files. */
export const CODES = Object.freeze({
  // A site issuing a write face that no register row settles at all.
  unregistered: 'capture-writer-unregistered',
  // A site whose row classifies its write as outliving the phase in flight.
  durable: 'capture-writer-durable',
  // A site writing the file without going through lib/capture-file.mjs.
  redirect: 'capture-writer-redirect',
});

/**
 * The `planning.mjs` subcommands that reach `lib/capture-file.mjs`, the one
 * owner of `.planning/CAPTURE.md`'s bytes. Two, and they are the only faces of
 * that module a prose surface can reach: `capture` appends one bullet under the
 * heading its kind owns, `debt-harvest` rewrites the `## Debt markers` section
 * wholesale. Every other `capture`-prefixed subcommand - `capture-check`,
 * `capture-sections` - READS the file and is deliberately absent.
 */
export const WRITE_FACES = Object.freeze(['capture', 'debt-harvest']);

/** The path a redirect has to name for the redirect kind to fire. */
export const CAPTURE_PATH = '.planning/CAPTURE.md';

/**
 * The register: one row per prose site that issues a write.
 *
 * `surface` is the root-relative POSIX path, `subcommand` the write face,
 * `writes` the file that site actually writes in one clause, `durable` the
 * classification, and `reason` the required justification - on a non-durable
 * row it is why the write cannot accumulate, on a durable one it is what makes
 * it survive the phase.
 *
 * The test for `durable: false` is whether the write can ACCUMULATE: a user's
 * deliberate one-bullet capture and a wholesale section rewrite cannot, a
 * per-item append at a phase boundary can.
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
 * Is this occurrence EXECUTED, or merely named? A `node` command word before
 * it on the line, or a flag after it. Anything else is prose naming the seam.
 * @param {string} before the line up to the match
 * @param {string} after the line from just past the subcommand
 */
function executed(before, after) {
  return /\bnode\b/.test(before) || FLAG_AFTER_RE.test(after);
}

/**
 * Is this occurrence of `.planning/CAPTURE.md` a shell redirect TARGET?
 *
 * Walked backwards over the characters rather than matched by a regex, so the
 * scan cannot be surprised by a path prefix, a quote or a long line: step back
 * over an attached prefix (`"$root/`), then any quote, then horizontal space,
 * and ask whether what remains is `>`. A backtick stops the walk, which is what
 * keeps every prose surface NAMING the file - including this rule's own
 * reference - silent.
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
