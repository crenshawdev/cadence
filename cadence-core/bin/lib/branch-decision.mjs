// @ts-check
// branch-decision.mjs - the pure, testable core of the two-tier branch model.
// Zero-dep (node builtins only, and it uses none): two total functions that
// decide, from config + the current branch + prose, whether a cycle-start
// workflow should create/switch to a per-milestone integration branch, stay
// put, or ask. This is deliberately separate from the advisory git-guard hook
// (which only advises and cannot run `checkout -b`) and from the git-branch.mjs
// seam that wraps it: the seam and the rail-1 prose it drives share this one
// source of truth, and it runs fully under `node --test` with no live git.
//
// Public surface: `integrationBranchName` and `decideBranch`, and nothing else.
// `activeVersion` and `titleVersion` are module-private inputs to
// `integrationBranchName`. They used to be exported for the release-bump
// derivation to reuse; REL-03 removed that consumer, because a RELEASE number
// read from prose no path keeps current is how the wrong version ships. Branch
// naming keeps the `### Active` -> ROADMAP-title precedence exactly as it was
// (D-11): a misnamed branch is visible and recoverable, a mis-shipped version
// is not.
//
// The published-version comparison (QW-04) enters here as an ARGUMENT, never as
// a read: the seam does the `git tag --list` and hands the answer down, so this
// module stays pure and keeps running under `node --test` with no live git
// (D-23). The comparison itself reuses `compareVersions` from
// `release-decision.mjs` rather than a second semver reader - that module keeps
// one module-private SEMVER_RE explicitly so no second reader can drift from it.
import { compareVersions } from './release-decision.mjs';

// A semver-ish version token: v1.2.3 with an optional prerelease/build suffix
// (v1.1.0-rc.2). Matches the milestone-of-record Cadence names a branch after.
const VERSION_RE = /v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/;

/**
 * The version named in the `### Active` section of PROJECT.md, or null.
 * Scans the section body (from the `### Active` heading to the next level-1..3
 * heading) for the first version token.
 * @param {string} projectText
 */
function activeVersion(projectText) {
  if (!projectText) return null;
  const lines = String(projectText).split('\n');
  const start = lines.findIndex((l) => /^###\s+Active\b/.test(l));
  if (start < 0) return null;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{1,3}\s/.test(lines[i])) break; // next section ends the Active body
    const m = lines[i].match(VERSION_RE);
    if (m) return m[0];
  }
  return null;
}

/**
 * The version named in the first `# ` (level-1) heading of ROADMAP.md, or null.
 * @param {string} roadmapText
 */
function titleVersion(roadmapText) {
  if (!roadmapText) return null;
  const title = String(roadmapText).split('\n').find((l) => /^#\s/.test(l));
  if (!title) return null;
  const m = title.match(VERSION_RE);
  return m ? m[0] : null;
}

/**
 * Drop one leading `v` from a version token: `compareVersions` takes semver and
 * rejects a `v` prefix by design, while both sides here arrive as branch/tag
 * spellings (`v2.4.0`). Anything that is not a string is null - "no comparand".
 * @param {string|null|undefined} v @returns {string|null}
 */
function stripLeadingV(v) {
  return typeof v === 'string' && v ? v.replace(/^v/, '') : null;
}

/**
 * Derive the integration branch name from prose: prefer the milestone-of-record
 * in `PROJECT.md ### Active`, fall back to the `ROADMAP.md` title. Returns
 * `cadence/<version>` or null when no version is found - null (never an invented
 * version) lets the caller surface a naming problem instead of misnaming a branch.
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
 *
 * - trunk mode: never create an integration branch; commits land on the base,
 *   still governed by git.on_protected (git-guard.mjs unchanged). `branch: null`.
 * - milestone mode on a protected base: auto -> create, off -> stay, ask -> ask,
 *   each naming the derived integration branch - what parallel worktree
 *   branches merge back into; where they fork FROM is the host's
 *   worktree.baseRef setting. When no name is derivable, auto/ask downgrade to
 *   a naming-problem `ask` (branch:null) rather than create an unnamed branch.
 * - milestone mode off a protected base: stay - creation is lazy and once per
 *   cycle, and HEAD is already off the base, so the current branch is the one
 *   worktrees merge back into.
 *
 * - milestone mode on a protected base, auto/ask, with a derivable name whose
 *   version does NOT sort above `publishedVersion`: a published-version `ask`
 *   (branch:null) naming both numbers. A branch named after a version the repo
 *   has already tagged is the v2.4.0 collision (#87) - `off`, trunk mode and an
 *   unprovable comparison are untouched by it.
 *
 * @param {{ mode?: string, autoBranch?: string, currentBranch?: string,
 *   protectedBranches?: string[], integrationName?: string | null,
 *   publishedVersion?: string | null }} args
 * @returns {{ action: 'create'|'stay'|'ask', branch: string|null, reason: string }}
 */
export function decideBranch({ mode, autoBranch, currentBranch, protectedBranches, integrationName,
  publishedVersion }) {
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
    // A null integration name (no version derivable) must never become a silent
    // `create` or a `checkout -b <null>`: downgrade auto/ask to a naming-problem
    // ask so rail-1 surfaces it instead of misnaming (or failing to create) a
    // branch. `off` still stays put regardless.
    if (name === null && (autoBranch === 'auto' || autoBranch === 'ask')) {
      return { action: 'ask', branch: null,
        reason: 'naming-problem: no version in PROJECT.md ### Active or ROADMAP title, cannot name the integration branch - set the milestone version, or stay on the base / abort' };
    }
    // A version this repo has ALREADY PUBLISHED must not be offered as a new
    // integration branch: that is the v2.4.0 collision (#87), where a milestone
    // section still described as open named a version already shipped and
    // tagged, and this seam answered `create cadence/v2.4.0`. Only the arms that
    // would act are escalated - `off` stays put and trunk mode never gets here.
    // A null comparison means "I cannot tell" (an out-of-grammar version on
    // either side) and MUST leave every arm exactly as it was: an unprovable
    // comparison is not evidence of a collision.
    const milestoneVersion = name !== null && name.startsWith('cadence/')
      ? stripLeadingV(name.slice('cadence/'.length)) : null;
    const published = stripLeadingV(publishedVersion);
    const order = milestoneVersion === null || published === null
      ? null : compareVersions(milestoneVersion, published);
    if ((order === 0 || order === -1) && (autoBranch === 'auto' || autoBranch === 'ask')) {
      return { action: 'ask', branch: null,
        reason: `already-published: the milestone version ${milestoneVersion} does not sort above ${published}, which this repo has already published as a tag - open the next milestone version in PROJECT.md ### Active, or confirm deliberately that ${name} is the branch you want` };
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
