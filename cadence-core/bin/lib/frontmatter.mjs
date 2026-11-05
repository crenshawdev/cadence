// @ts-check
// frontmatter.mjs - the one reader of an agent/skill frontmatter block's `skills:` value, shared by self-verify.mjs
// and lib/resident-weight.mjs so the two can't disagree about which contracts a role preloads.
// It lives here because self-verify.mjs's entry block has no `import.meta` guard, so any import runs the whole lint.
// Don't leave a re-export there either, it keeps the trap alive for the next caller.
// Pure lib: no fs, no emit, no process, no Date, no randomness, nothing at top level beyond the exports.
'use strict';

/** A leading frontmatter block; group 1 is the text between the fences. */
export const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---/;

/**
 * Parse a frontmatter block's `skills:` value into skill names. It takes the three spellings a hand-written
 * agent file uses: the block list (`skills:\n  - name`), the inline array (`skills: [a, b]`) and a bare scalar
 * (`skills: name`). Anything else yields no names, same as an absent key.
 * @param {string} fmText the text between the frontmatter fences
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
