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
// Public surface: `integrationBranchName` and `decideBranch`, plus the three
// readers they are built from - `activeVersion`, `titleVersion` and
// `tagCarrying` - exported for exactly ONE other consumer, `planning.mjs
// cmdAudit`'s `version_drift` signal (FRI-03). That consumer asks this module's
// own question at a second moment: branch naming asks it before a cycle starts,
// the audit asks it at the ship gate, and both must read the SAME prose with the
// SAME `### Active` -> ROADMAP-title precedence. A second reader beside this one
// is the drift this module's single-reader discipline exists to prevent.
//
// FOR DRIFT DETECTION ONLY. `activeVersion` and `titleVersion` used to be
// exported for the release-bump derivation to reuse; REL-03 removed that
// consumer, because a RELEASE number read from prose no path keeps current is
// how the wrong version ships, and that ban STANDS - re-exporting them here
// licenses reading the planning docs to REPORT a mismatch, never to derive a
// number anything ships under. Branch naming keeps the precedence exactly as it
// was (D-11): a misnamed branch is visible and recoverable, a mis-shipped
// version is not.
//
// The published-version comparison (QW-04) enters here as an ARGUMENT, never as
// a read: the seam does the `git tag --list` and hands the answer down, so this
// module stays pure and keeps running under `node --test` with no live git
// (D-23). The comparison itself reuses `compareVersions` from
// `release-decision.mjs` rather than a second semver reader - that module keeps
// one module-private SEMVER_RE explicitly so no second reader can drift from it.
//
// That argument is the WHOLE TAG LIST (`publishedVersions`), and the test is
// MEMBERSHIP. This supersedes D-23's scalar `publishedVersion` shape, which the
// seam filled with the highest semver tag: a scalar can only express a sort
// order, and sort order answers a question nobody asked. It refused
// `cadence/v1.9.1` in a repo tagged `v1.9.0` and `v2.0.0` - a legitimate
// maintenance milestone published nowhere - with a reason asserting a
// publication that never happened, while `readTags` had already returned the
// list that answers it exactly. D-23's other half is kept intact: the seam
// reads, this module stays pure.
import { compareVersions } from './release-decision.mjs';

// A semver-ish version token: v1.2.3 with an optional prerelease/build suffix
// (v1.1.0-rc.2). Matches the milestone-of-record Cadence names a branch after.
const VERSION_RE = /v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/;

// The milestone DECLARATION: a version token opening its line, past nothing but
// markdown furniture (bullet, emphasis, backtick, blockquote). The shipped
// PROJECT.md shape is ``**`v2.6.0 - name`**, opened <date>``, and the anchor is
// what separates that declaration from prose in the same section that merely
// MENTIONS a version - a "the predecessor `v2.5.0` closed" sentence is a
// mention, and reading it as the milestone hard-FAILs the ship gate on correct
// docs (`version_drift` compares this against the tag list).
const DECLARED_VERSION_RE = new RegExp(`^[\\s>*_\`-]*(${VERSION_RE.source})`);

/**
 * The version named in the `### Active` section of PROJECT.md, or null.
 * Scans the section body (from the `### Active` heading to the next level-1..3
 * heading) for the milestone declaration - the first LINE-ANCHORED version
 * token. Falls back to the first token anywhere in the body when no line
 * declares one, so a section that only ever mentions its version in prose still
 * answers rather than going silent.
 * @param {string} projectText
 */
export function activeVersion(projectText) {
  if (!projectText) return null;
  const lines = String(projectText).split('\n');
  const start = lines.findIndex((l) => /^###\s+Active\b/.test(l));
  if (start < 0) return null;
  let loose = null;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^#{1,3}\s/.test(lines[i])) break; // next section ends the Active body
    const declared = lines[i].match(DECLARED_VERSION_RE);
    if (declared) return declared[1];
    if (loose === null) {
      const m = lines[i].match(VERSION_RE);
      if (m) loose = m[0];
    }
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
 * Drop one leading `v` from a version token: `compareVersions` takes semver and
 * rejects a `v` prefix by design, while both sides here arrive as branch/tag
 * spellings (`v2.4.0`). Anything that is not a string is null - "no comparand".
 * @param {string|null|undefined} v @returns {string|null}
 */
function stripLeadingV(v) {
  return typeof v === 'string' && v ? v.replace(/^v/, '') : null;
}

/**
 * The tag SPELLING that carries `version`, or null when none does. Membership,
 * not order: a tag equal in semver precedence is a publication of this exact
 * version, and every other tag - higher, lower, out of grammar - is silent
 * about it.
 *
 * `compareVersions` doubles as the parse test on the tag side: an out-of-grammar
 * tag (`nightly`, `2024-06-release`) compares null against everything and so
 * matches nothing, which is why no second SEMVER_RE appears here. A non-string
 * element is skipped the same way - this list is `git tag --list` output, data
 * this module did not write.
 *
 * A bare STRING is read as the one tag it is rather than as "not a list,
 * therefore nothing published". That shape can only arrive from a caller left on
 * the superseded scalar argument, and disarming the guard silently is a worse
 * failure than the sort-order bug it replaced.
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
 *   version IS carried by one of `publishedVersions`: a published-version `ask`
 *   (branch:null) naming both the version and the tag spelling that carries it.
 *   A branch named after a version the repo has already tagged is the v2.4.0
 *   collision (#87) - `off`, trunk mode and a version no tag carries are
 *   untouched by it.
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
    // No tag carrying the version means "nothing published this", which covers
    // both the ordinary next cycle and the unprovable case (an out-of-grammar
    // version on either side): neither is evidence of a collision, and both
    // leave every arm exactly as it was.
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
