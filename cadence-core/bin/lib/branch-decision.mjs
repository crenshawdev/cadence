// @ts-check
// branch-decision.mjs - the pure core of the two-tier branch model: total functions that decide, from config, the current
// branch and prose, whether a cycle-start workflow should create or switch to an integration branch, stay, or ask.
// Kept apart from the advisory git-guard hook and the git-branch.mjs seam so it runs under `node --test` with no live git.
// `activeVersion`, `titleVersion` and `tagCarrying` are exported for `planning.mjs cmdAudit`'s `version_drift` signal: the
// ship gate asks the same question branch naming does, and both must read the same prose with the same precedence.
// Drift detection only: a release number read from prose no path keeps current is how the wrong version ships, so the
// release-bump derivation doesn't use them. A misnamed branch is recoverable; a mis-shipped version isn't.
// Published tags come in as an argument, never a read. The test is membership in the whole list, not "highest tag":
// the scalar refused `cadence/v1.9.1` in a repo tagged `v1.9.0` and `v2.0.0`, a legitimate maintenance milestone nothing
// published. The cad-health version-drift check uses the same membership test and must not drift back to sort order.
import { compareVersions } from './release-decision.mjs';

// a semver-ish token, v1.2.3 with an optional prerelease suffix: the milestone-of-record a branch is named after
const VERSION_RE = /v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/;

// The milestone declaration: a version token opening its line past markdown furniture (bullet, emphasis, backtick,
// blockquote). The anchor separates it from prose that merely mentions a version - "the predecessor `v2.5.0` closed"
// read as the milestone hard-FAILs the ship gate on correct docs.
const DECLARED_VERSION_RE = new RegExp(`^[\\s>*_\`-]*(${VERSION_RE.source})`);

// trailing markdown furniture is transparent when asking if a line closed its sentence: prose here often ends in a code span
const TRAILING_FURNITURE_RE = /[\s`*_)\]"']+$/;

/**
 * Does the body line at `i` open a sentence rather than continue a wrapped one? True at the top of the body, after a
 * blank line, and after a line ending in sentence punctuation past its furniture. False after running prose, which is
 * what markdown wrapping produces and the only way a version token lands at a line start without being declared.
 * @param {string[]} body @param {number} i
 */
function opensSentence(body, i) {
  if (i === 0) return true;
  const prev = body[i - 1];
  if (!prev.trim()) return true;
  return /[.!?]$/.test(prev.replace(TRAILING_FURNITURE_RE, ''));
}

/**
 * The version named in the `### Active` section of PROJECT.md, or null.
 * Reads the section body (heading to the next level 1-3 heading) twice: for the first version token anywhere, and for
 * line-anchored candidates. An anchored one is the declaration only if it agrees with the first token or its line opens
 * a sentence. One on a wrapped continuation line is layout, not a declaration, and reading it hard-FAILs the ship gate
 * on a correct section (it answered `v3.0.0`, forty lines below the opening `v3.2.0`, after a wrap pushed it to a line start).
 * With no candidate the first token anywhere stands, since templates/PROJECT.md's `### Active` names no version at all
 * and the ROADMAP title is no safety net.
 * Shared reader: `git-branch.mjs decide` derives the branch name and its already-published refusal from the same answer,
 * and a second comparand for the audit alone is the drift this module exists to prevent.
 * @param {string} projectText
 */
export function activeVersion(projectText) {
  if (!projectText) return null;
  const lines = String(projectText).split('\n');
  const start = lines.findIndex((l) => /^###\s+Active\b/.test(l));
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{1,3}\s/.test(lines[i])) { end = i; break; }
  }
  const body = lines.slice(start + 1, end);
  let loose = null;
  for (const line of body) {
    const m = line.match(VERSION_RE);
    if (m) { loose = m[0]; break; }
  }
  for (let i = 0; i < body.length; i++) {
    const declared = body[i].match(DECLARED_VERSION_RE);
    if (declared && (declared[1] === loose || opensSentence(body, i))) return declared[1];
  }
  return loose;
}

/**
 * The version named in the first `# ` (level-1) heading of ROADMAP.md, or null.
 * @param {string} roadmapText
 */
export function titleVersion(roadmapText) {
  if (!roadmapText) return null;
  const title = String(roadmapText).split('\n').find((l) => /^#\s/.test(l));
  if (!title) return null;
  const m = title.match(VERSION_RE);
  return m ? m[0] : null;
}

/**
 * Drop one leading `v` from a version token: `compareVersions` takes semver and rejects a `v` prefix by design, while both
 * sides here arrive as branch or tag spellings. Anything that isn't a string is null - "no comparand".
 * @param {string|null|undefined} v @returns {string|null}
 */
function stripLeadingV(v) {
  return typeof v === 'string' && v ? v.replace(/^v/, '') : null;
}

/**
 * The tag spelling that carries `version`, or null. Membership, not order: a tag equal in semver precedence is a
 * publication of this exact version, and every other tag (higher, lower, out of grammar) says nothing about it.
 * `compareVersions` doubles as the parse test, so an out-of-grammar tag like `nightly` compares null and matches nothing,
 * which is why no second SEMVER_RE appears here; a non-string element is skipped the same way (it's `git tag --list` output).
 * A bare string is read as the one tag it is, not as "nothing published": it can only come from a caller left on the old
 * scalar argument, and silently disarming the guard is worse than the sort-order bug it replaced.
 * @param {any} publishedVersions @param {string} version
 * @returns {string|null}
 */
export function tagCarrying(publishedVersions, version) {
  const tags = Array.isArray(publishedVersions) ? publishedVersions
    : (typeof publishedVersions === 'string' && publishedVersions ? [publishedVersions] : []);
  for (const tag of tags) {
    const bare = stripLeadingV(tag);
    if (bare !== null && compareVersions(bare, version) === 0) return tag;
  }
  return null;
}

/**
 * Derive the integration branch name from prose: `PROJECT.md ### Active` first, the `ROADMAP.md` title as fallback.
 * Returns `cadence/<version>` or null; null (never an invented version) lets the caller surface a naming problem
 * instead of misnaming a branch.
 * @param {string} projectText @param {string} roadmapText
 * @returns {string | null}
 */
export function integrationBranchName(projectText, roadmapText) {
  const version = activeVersion(projectText) || titleVersion(roadmapText);
  return version ? `cadence/${version}` : null;
}

/**
 * Decide what a cycle-start workflow should do about the integration branch.
 * Total: an unknown mode or auto_branch yields `stay` rather than throwing.
 * - trunk mode: never create an integration branch; commits land on the base, still governed by git.on_protected.
 * - milestone on a protected base: auto -> create, off -> stay, ask -> ask, each naming the derived branch (what parallel
 *   worktree branches merge back into; where they fork from is the host's worktree.baseRef). With no derivable name,
 *   auto and ask downgrade to a naming-problem `ask` rather than create an unnamed branch.
 * - milestone off a protected base: stay. Creation is lazy and once per cycle, so the current branch is the merge target.
 * - milestone on a protected base, auto/ask, where `publishedVersions` carries the derived version: a published-version
 *   `ask` naming the version and tag. Branching on an already-tagged version is the v2.4.0 collision (#87); `off`,
 *   trunk mode and a version no tag carries are untouched.
 *
 * @param {{ mode?: string, autoBranch?: string, currentBranch?: string,
 *   protectedBranches?: string[], integrationName?: string | null,
 *   publishedVersions?: string[] | null }} args
 * @returns {{ action: 'create'|'stay'|'ask', branch: string|null, reason: string }}
 */
export function decideBranch({ mode, autoBranch, currentBranch, protectedBranches, integrationName,
  publishedVersions }) {
  const protectedList = Array.isArray(protectedBranches) ? protectedBranches : [];
  const name = integrationName ?? null;

  if (mode === 'trunk') {
    return { action: 'stay', branch: null,
      reason: 'trunk mode: no integration branch, commits land on the base governed by on_protected' };
  }
  if (mode === 'milestone') {
    if (!protectedList.includes(currentBranch)) {
      return { action: 'stay', branch: currentBranch ?? null,
        reason: 'already off the protected base; once-per-cycle integration-branch creation has happened, this is the branch worktrees merge back into - where they fork from is the host\'s worktree.baseRef setting' };
    }
    // a null name (no version derivable) must never become a silent `create` or a `checkout -b <null>`: downgrade auto and
    // ask to a naming-problem ask so rail 1 surfaces it. `off` still stays put.
    if (name === null && (autoBranch === 'auto' || autoBranch === 'ask')) {
      return { action: 'ask', branch: null,
        reason: 'naming-problem: no version in PROJECT.md ### Active or ROADMAP title, cannot name the integration branch - set the milestone version, or stay on the base / abort' };
    }
    // a version this repo already published must not be offered as a new integration branch: that's the v2.4.0 collision
    // (#87), where a milestone section still described as open named a shipped, tagged version and this said `create`.
    // Only the arms that would act escalate. No tag carrying the version means "nothing published this", which covers the
    // ordinary next cycle and the unprovable case (out-of-grammar on either side): neither is evidence of a collision.
    const milestoneVersion = name !== null && name.startsWith('cadence/')
      ? stripLeadingV(name.slice('cadence/'.length)) : null;
    const publishedAs = milestoneVersion === null
      ? null : tagCarrying(publishedVersions, milestoneVersion);
    if (publishedAs !== null && (autoBranch === 'auto' || autoBranch === 'ask')) {
      return { action: 'ask', branch: null,
        reason: `already-published: the milestone version ${milestoneVersion} is already published as the tag ${publishedAs} - open the next milestone version in PROJECT.md ### Active, or confirm deliberately that ${name} is the branch you want` };
    }
    switch (autoBranch) {
      case 'auto':
        return { action: 'create', branch: name,
          reason: 'auto: create and switch to the integration branch silently before the first commit' };
      case 'off':
        return { action: 'stay', branch: name,
          reason: 'off: stay on the protected base, create no integration branch' };
      case 'ask':
        return { action: 'ask', branch: name,
          reason: 'ask: prompt once before creating the integration branch' };
      default:
        return { action: 'stay', branch: null,
          reason: `unknown auto_branch "${autoBranch}"; staying put` };
    }
  }
  return { action: 'stay', branch: null,
    reason: `unknown integration_branch mode "${mode}"; staying put` };
}
