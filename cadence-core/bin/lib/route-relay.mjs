// @ts-check
// route-relay.mjs - the pure rule behind self-verify's `unrelayed-route-resolve`: a prose file that issues a
// `route.mjs resolve` must also carry the relay rule for the `warnings[]` it returns. Disk half: self-verify.
// seams.md already mandated the relay and it failed: a bad gate setting warned for days, unread.
// An issue is the `${CLAUDE_PLUGIN_ROOT}` invocation form, never a backticked mention. A relay is one paragraph
// carrying both `relay` and `warnings`, so one in each of two sections can't satisfy each other.
// Presence only, not per dispatch. Delegating without issuing the command is out of reach.
'use strict';

/** The one problem code this rule files. */
export const CODE = 'unrelayed-route-resolve';

// An issuing site is the plugin-root invocation form, with the optional closing quote of a quoted path before the
// subcommand. Braces are optional because `"$CLAUDE_PLUGIN_ROOT/...route.mjs" resolve` expands to the same invocation,
// and a checker keyed to one spelling is a rail a rephrase walks around.
const ISSUE_RE = /\$\{?CLAUDE_PLUGIN_ROOT\}?\/\S*route\.mjs"?\s+resolve\b/g;

const RELAY_RE = /\brelay\b/i;
const WARNINGS_RE = /warnings/i;

/**
 * Whether some paragraph of `text` states the relay rule. A paragraph is a run of non-blank lines, whitespace-collapsed
 * first, so re-wrapping a sentence never changes the answer.
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
 * Every issuing site in a prose file that doesn't also state the relay rule, one entry per site, naming the 1-based
 * line the invocation starts on. A non-string yields `[]`: self-verify hands this whatever the tree holds, and a rule
 * that throws on one bad surface takes the whole run with it.
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
