// @ts-check
// scratch-path.mjs - the rule that a prose site's bulk-output scratch file
// belongs to THIS RUN, and that the read-back reading it back REFUSES rather
// than answers from a file it could not read (self-verify check 21).
//
// THE RULE ITSELF IS NOT HERE. `references/conventions.md` states it once - the
// scratch directory is made for this run by `mktemp -d`, the read-back is
// chained to the write with `&&` when they share a Bash invocation and carries
// the directory and a run token the earlier block echoed when they do not, and
// a read-back that cannot read, parse or recognise its file names the refusal
// and exits non-zero instead of answering from it. This module carries the
// mechanical enforcement, the same split `lib/bulk-output.mjs` uses for the
// size rule: prose states the rule, a pure module holds prose to it.
//
// WHY THIS EXISTS BESIDE CHECK 20. Check 20 asserts a redirect EXISTS and
// cannot see what it points AT: `> "${TMPDIR:-/tmp}/cad-rearm.json"` and
// `> /dev/stdout` pass it identically. So the shape SCR-01 was filed against -
// six sites sharing five fixed names under one world-writable directory, where
// a second repository's concurrent run answers this run's blocking `risk_surface`
// re-arm cap - was invisible to every check in the tree. Nothing held the fix
// in place, and the next prose edit would have reverted it green.
//
// WHY LINE-LOCAL RULES RATHER THAN A REGISTER. `lib/bulk-output.mjs` needs a
// hand-maintained register because whether a response is bulk is a MEASUREMENT
// no scan can take. Nothing here is a measurement: a line naming `TMPDIR`
// without calling `mktemp` is a shared path whatever the site, and a `node -e`
// reading a file named on its own argv without an error arm answers from
// whatever bytes it finds whatever the site. A register would only be a list of
// exemptions, and the one shape that would need exempting - the UAT fixture
// paths in `references/acceptance-criteria.md` - is already outside the rules,
// which watch REDIRECT TARGETS and not every mention of `/tmp`.
//
// THE ACCEPTED GAP, stated rather than closed with a fourth rule: a scratch
// path assembled through an intermediate shell variable assigned from a literal
// (`P=/tmp/cad.json` on one line, `> "$P"` on another) is not caught, because
// the rules are line-local and following a shell assignment across a fenced
// block is a parser this check does not have. That is the deliberate bound. The
// regression these rules are built against is a COPY of the old rule - the next
// converted site written from the sentence in `conventions.md`, or a revert of
// one of the six - and not a novel spelling by someone routing around the
// check.
//
// Pure rule: no disk, no emit, no exit, no Date, no randomness, no `process`.
// The caller (self-verify.mjs) owns the walk and the envelope.
'use strict';

/** The problem codes this rule files. */
export const CODES = Object.freeze({
  // A line names `TMPDIR` and never calls `mktemp`: a scratch path every
  // concurrent run in every repository on this machine resolves the same way.
  sharedPath: 'scratch-shared-path',
  // A redirect whose target is an absolute literal under /tmp or /var/tmp -
  // the same collision reached by spelling the directory out.
  fixedTarget: 'scratch-fixed-target',
  // A `node -e` read-back that reads a file named on its own argv without both
  // a reason on stderr and a non-zero exit, so a truncated, foreign or
  // wrong-shaped file becomes an ANSWER.
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
