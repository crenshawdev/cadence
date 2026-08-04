// @ts-check
// route-relay.mjs - the pure rule behind self-verify's `unrelayed-route-resolve`
// check (D-04): a prose file that ISSUES a `route.mjs resolve` must also carry
// the relay rule for the `warnings[]` array that resolve returns. The disk half
// - walking the tree and filing each issue as a CI problem - lives in
// self-verify.mjs, the same split lib/dispatch-phrasing.mjs, lib/config-reach.mjs
// and lib/route-cells.mjs use.
//
// Why it exists: `references/seams.md` already MANDATES the relay, and that
// mandate is what failed. This repo's own config layer set
// `review.triggers.diff.gate` against a written-down decision, and the resolver
// emitted a gate-disagreement warning on every dispatch for days with nobody
// reading it - a diagnostic that reaches JSON and no human is a
// resolved-then-dropped value wearing a diagnostic's clothes. Another prose
// instruction alone was rejected for exactly that reason; a check is what makes
// the instruction's ABSENCE visible.
//
// The contract, in two halves:
//
//   ISSUE   - the `${CLAUDE_PLUGIN_ROOT}` invocation form of `route.mjs resolve`,
//     never a backticked inline mention. `references/config-reach.md`,
//     `workflows/plan.md` and `workflows/execute.md` all NAME `route.mjs resolve`
//     in prose while issuing nothing, and a rule that could not tell those apart
//     would demand a relay rule in a reach table.
//   RELAY   - a PARAGRAPH (a run of non-blank lines, whitespace-collapsed)
//     carrying both `relay` (case-insensitive, word-bounded) and `warnings`.
//     Both in ONE paragraph, so a `relay` in one section and a `warnings` in
//     another cannot satisfy each other.
//
// PRESENCE only, never per-dispatch repetition. The once-per-workflow-run
// scoping `references/seams.md` states is the rule being KEPT, not a phrasing to
// enforce per call: `route.mjs` runs per role per spawn, so a per-dispatch rule
// would turn one deliberate config gate into a notice on every planner,
// executor, verifier and checker dispatch for the life of a project, and warning
// fatigue degrades the same channel the torn-layer and retired-key warnings
// depend on.
//
// Accepted cost, stated so nobody reads the check as covering what it does not:
// prose that DELEGATES to the seam without issuing the command -
// `workflows/plan.md`'s and `workflows/execute.md`'s routing steps - is out of
// reach by construction. Those sites are governed by `seams.md`'s own relay
// rule, which their delegation points at. Widening the trigger to delegation
// phrasing would re-open the unbounded-grammar problem phase 2 closed.
//
// Pure lib: no fs, no emit, no process, no Date, no randomness. It returns
// problem CODES; the caller owns the envelope.
'use strict';

/** The one problem code this rule files. */
export const CODE = 'unrelayed-route-resolve';

// An ISSUING site: the plugin-root invocation form, with the optional closing
// quote of a quoted path between the script and its subcommand.
// Braces optional: `"$CLAUDE_PLUGIN_ROOT/...route.mjs" resolve` expands to the
// same real invocation as the `${...}` house spelling, and a checker keyed to
// one spelling is a rail a rephrase walks around.
const ISSUE_RE = /\$\{?CLAUDE_PLUGIN_ROOT\}?\/\S*route\.mjs"?\s+resolve\b/g;

const RELAY_RE = /\brelay\b/i;
const WARNINGS_RE = /warnings/i;

/**
 * Whether some paragraph of `text` states the relay rule. A paragraph is a run
 * of non-blank lines; it is whitespace-collapsed before the two tests, so
 * re-wrapping a sentence across lines never changes the answer.
 * @param {string} text
 * @returns {boolean}
 */
function statesRelay(text) {
  for (const para of text.split(/\n[ \t]*\n/)) {
    const flat = para.replace(/\s+/g, ' ').trim();
    if (!flat) continue;
    if (RELAY_RE.test(flat) && WARNINGS_RE.test(flat)) return true;
  }
  return false;
}

/**
 * Every issuing site in a prose file that does not also state the relay rule,
 * one entry per site, each naming the 1-BASED line the invocation starts on.
 *
 * A non-string input yields `[]` - self-verify hands this whatever the tree
 * holds, and a rule that throws on one unreadable surface takes the whole run
 * with it.
 * @param {any} text
 * @returns {{code: string, detail: string}[]}
 */
export function relayIssues(text) {
  if (typeof text !== 'string' || !text) return [];
  const sites = [...text.matchAll(ISSUE_RE)];
  if (!sites.length) return [];
  if (statesRelay(text)) return [];
  return sites.map((m) => {
    const line = text.slice(0, m.index).split('\n').length;
    return { code: CODE,
      detail: `line ${line} issues \`route.mjs resolve\` but no paragraph in this file `
        + 'states the relay rule for its `warnings[]` (references/seams.md)' };
  });
}
