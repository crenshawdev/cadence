// @ts-check
// scratch-path.mjs - check 21: a bulk-output scratch file belongs to this run, and its read-back refuses a bad file
// the rule is stated once in `references/conventions.md`; this holds prose to it, like lib/bulk-output.mjs
// check 20 sees a redirect exists, never where it points, so a fixed /tmp name and `> /dev/stdout` passed alike
// line-local rules, no register: a line naming TMPDIR without mktemp is a shared path whatever the site
// the gap: a path built through a shell variable isn't caught
// pure, no disk or emit; the caller owns the walk and the envelope
'use strict';

/** The problem codes this rule files. */
export const CODES = Object.freeze({
  // a line names TMPDIR and never calls mktemp: every concurrent run on the machine resolves the same path
  sharedPath: 'scratch-shared-path',
  // a redirect to an absolute literal under /tmp or /var/tmp, the same collision with the directory spelled out
  fixedTarget: 'scratch-fixed-target',
  // a node -e read-back of a file named on its own argv with no stderr reason or no
  // non-zero exit, so a truncated or wrong-shaped file becomes an answer
  unguardedReadback: 'scratch-unguarded-readback',
});

/** A `mktemp` call, which is the only thing that makes a `TMPDIR` line this run's. */
const MKTEMP_RE = /\bmktemp\b/;
/** `>` or `>>`, then optionally a quote, then an absolute literal under a tmp dir. */
const FIXED_TARGET_RE = />>?\s*"?(\/(?:var\/)?tmp\/[^\s"'`]*)/g;
/** A shell-single-quoted `node -e` script. A single quote cannot appear inside one. */
const NODE_E_RE = /node -e '([^']*)'/g;
/** The script reads a path handed to it, which is what makes it a read-back. */
const READS_ARGV_RE = /readFile(?:Sync)?\s*\(|readFileSync/;
/** A reason on stderr. `console.error` is the only spelling any site uses. */
const STDERR_RE = /console\.error\s*\(/;
/** A non-zero exit, set either way Node offers. */
const NONZERO_EXIT_RE = /process\.exit\s*\(\s*[1-9]|process\.exitCode\s*=\s*[1-9]/;

/**
 * Every per-run-scratch issue in one prose surface.
 *
 * @param {string} surface root-relative POSIX path, as self-verify reports it
 * @param {string} text the surface's contents
 * @returns {{kind: string, file: string, detail: string}[]}
 */
export function scratchPathIssues(surface, text) {
  const issues = [];
  for (const line of text.split('\n')) {
    if (line.includes('TMPDIR') && !MKTEMP_RE.test(line)) {
      issues.push({ kind: CODES.sharedPath, file: surface,
        detail: `\`TMPDIR\` names a scratch path on a line that never calls \`mktemp\` - make this run's own directory (\`mktemp -d "\${TMPDIR:-/tmp}/cad-XXXXXX"\`) and write inside it, or another run answers this one's gate (cadence-core/references/conventions.md states the rule)` });
    }
    for (const m of line.matchAll(FIXED_TARGET_RE)) {
      issues.push({ kind: CODES.fixedTarget, file: surface,
        detail: `a redirect targets the fixed shared path \`${m[1]}\` - every concurrent run on this machine resolves it identically; redirect into this run's own \`mktemp -d\` directory instead (cadence-core/references/conventions.md states the rule)` });
    }
    for (const m of line.matchAll(NODE_E_RE)) {
      const script = m[1];
      if (!script.includes('process.argv') || !READS_ARGV_RE.test(script)) continue;
      const missing = [];
      if (!STDERR_RE.test(script)) missing.push('a reason on stderr (`console.error`)');
      if (!NONZERO_EXIT_RE.test(script)) missing.push('a non-zero exit');
      if (!missing.length) continue;
      issues.push({ kind: CODES.unguardedReadback, file: surface,
        detail: `a \`node -e\` read-back reads a file named on its own argv without ${missing.join(' and ')} - a truncated, stale or wrong-shaped scratch file becomes an ANSWER instead of a named refusal (cadence-core/references/conventions.md states the rule)` });
    }
  }
  return issues;
}
