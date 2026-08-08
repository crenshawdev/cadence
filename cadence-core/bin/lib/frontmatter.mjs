// @ts-check
// frontmatter.mjs - the ONE reader of an agent/skill frontmatter block's
// `skills:` value, imported by self-verify.mjs (the preloaded-contract
// resolution check) and lib/resident-weight.mjs (the dispatch-weight
// composition), so the two cannot disagree about which contracts a role
// preloads.
//
// It lives here rather than in self-verify.mjs, which is where it was defined,
// for a mechanical reason: self-verify.mjs's entry block at its foot is bare -
// no `import.meta` guard - so ANY import of that file runs the whole tree lint
// and lib/seam-io.mjs's `emit` writes self-verify's envelope to stdout before
// the importing seam writes its own. That breaks the one-JSON-object-per-run
// convention every bin script follows. No re-export is left behind in
// self-verify.mjs on purpose: a re-export from a file that emits on import
// keeps the same trap alive for the next caller.
//
// Pure lib: no fs, no emit, no process, no Date, no randomness, no top-level
// statements beyond this module's own exports.
'use strict';

/**
 * Parse an agent frontmatter block's `skills:` value into skill names. Accepts
 * the three spellings a hand-written agent file realistically uses: the block
 * list (`skills:\n  - name`), the inline array (`skills: [a, b]`), and a bare
 * scalar (`skills: name`). Anything else yields no names, which the caller
 * treats as "this agent preloads nothing" - the same as an absent key.
 * @param {string} fmText the text BETWEEN the frontmatter fences
 * @returns {string[]}
 */
export function parseSkillsField(fmText) {
  const m = fmText.match(/^skills:[ \t]*(.*)$/m);
  if (!m || m.index === undefined) return [];
  const unquote = (/** @type {string} */ s) => s.trim().replace(/^['"]|['"]$/g, '').trim();
  const inline = m[1].trim();
  if (inline) {
    return inline.replace(/^\[/, '').replace(/\]$/, '')
      .split(',').map(unquote).filter(Boolean);
  }
  const out = [];
  for (const line of fmText.slice(m.index + m[0].length).split('\n')) {
    const item = line.match(/^[ \t]+-[ \t]*(.+)$/);
    if (item) {
      const name = unquote(item[1]);
      if (name) out.push(name);
      continue;
    }
    if (line.trim() === '') continue;
    break; // the next frontmatter key ends the list
  }
  return out;
}
