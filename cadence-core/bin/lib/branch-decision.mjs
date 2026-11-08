// @ts-check
// branch-decision.mjs - the pure core of the branch model: create an integration branch, switch, stay, or ask.
// `activeVersion`, `titleVersion` and `tagCarrying` serve the audit's `version_drift` too, so they read prose one way.
// Drift detection only, never the release-bump derivation: a mis-shipped version isn't recoverable.
// Published tags come in as an argument, tested by membership, not "highest tag", so `v1.9.1` stays open past `v2.0.0`.
import { compareVersions } from './release-decision.mjs';
import { isBranchName } from './config-value.mjs';

// a semver-ish token, v1.2.3 with an optional prerelease suffix: the milestone-of-record a branch is named after
const VERSION_RE = /v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/;

// the milestone declaration: a version token opening its line past markdown furniture; the anchor keeps prose that
// merely mentions one ("the predecessor `v2.5.0` closed") from failing the ship gate on correct docs
const DECLARED_VERSION_RE = new RegExp(`^[\\s>*_\`-]*(${VERSION_RE.source})`);

// trailing markdown furniture is transparent when asking if a line closed its sentence; prose often ends in a code span
const TRAILING_FURNITURE_RE = /[\s`*_)\]"']+$/;

/**
 * Does the body line at `i` open a sentence rather than continue a wrapped one? True at the top of the body, after a
 * blank line, and after sentence punctuation. Wrapping is the only way a version token lands at a line start.
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
 * Reads the section body twice: for the first version token anywhere, and for line-anchored candidates. An anchored one
 * is the declaration only if it agrees with the first token or its line opens a sentence. One on a wrapped continuation
 * line is layout, and reading it as a declaration failed the ship gate on a correct section.
 * With no candidate the first token anywhere stands.
 * Shared with `git-branch.mjs decide`, since a second comparand for the audit alone is the drift this module prevents.
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
 * Drop one leading `v` from a version token, since `compareVersions` rejects the prefix by design.
 * Anything that isn't a string is null - "no comparand".
 * @param {string|null|undefined} v @returns {string|null}
 */
function stripLeadingV(v) {
  return typeof v === 'string' && v ? v.replace(/^v/, '') : null;
}

/**
 * The tag spelling that carries `version`, or null. Membership, not order: only a tag equal in semver precedence says
 * anything about it.
 * `compareVersions` doubles as the parse test, so an out-of-grammar tag like `nightly` matches nothing, and so does
 * a non-string element.
 * A bare string is read as the one tag it is: it can only come from a caller on the old scalar argument, and silently
 * disarming the guard is worse than the sort-order bug it replaced.
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
 * What is wrong with a configured `git.integration_branch_name`, as a sentence, or null when it is unset or sound.
 * Checked on read as well as on write: a hand-edited layer never went through `config.mjs set`, and the value reaches
 * `git checkout -b` and `git branch -D`.
 * @param {unknown} configured
 * @returns {string | null}
 */
export function configuredNameProblem(configured) {
  if (configured === undefined || configured === null || isBranchName(configured)) return null;
  return 'git.integration_branch_name does not hold a usable branch name (letters, digits, `.`, `_`, `-` and `/`, '
    + 'starting with a letter or digit, no `..`, no trailing `/` or `.`, no `.lock` ending, no part starting with `.`)';
}

/**
 * The integration branch name: the configured one when set, otherwise `cadence/<version>` from prose
 * (`PROJECT.md ### Active` first, the `ROADMAP.md` title as fallback).
 * Returns null when there is nothing to name it from, and null for a configured name that fails the grammar:
 * null, never an invented name, lets the caller surface a naming problem.
 * @param {string} projectText @param {string} roadmapText @param {unknown} [configured]
 * @returns {string | null}
 */
export function integrationBranchName(projectText, roadmapText, configured) {
  if (configuredNameProblem(configured) !== null) return null;
  if (typeof configured === 'string') return configured;
  const version = milestoneVersion(projectText, roadmapText);
  return version ? `cadence/${version}` : null;
}

/**
 * The milestone version in prose, `PROJECT.md ### Active` first and the `ROADMAP.md` title as fallback, or null.
 * The already-published guard reads this directly, whatever the branch is called.
 * @param {string} projectText @param {string} roadmapText
 * @returns {string | null}
 */
export function milestoneVersion(projectText, roadmapText) {
  return activeVersion(projectText) || titleVersion(roadmapText);
}

/**
 * What a cycle-start workflow should do about the integration branch.
 * Total: an unknown mode or auto_branch yields `stay`, never a throw.
 * - trunk mode: never create an integration branch; commits land on the base.
 * - milestone on a protected base: auto -> create, off -> stay, ask -> ask. With no derivable name, or a configured
 *   one that failed its grammar (`nameProblem`), auto and ask downgrade to a naming-problem `ask`.
 * - milestone off a protected base: stay. Creation is once per cycle, so this branch is the merge target.
 * - auto/ask where `publishedVersions` carries `version`, the milestone version the caller read from prose: `ask`, since an already-tagged version is the
 *   v2.4.0 collision (#87).
 *
 * @param {{ mode?: string, autoBranch?: string, currentBranch?: string,
 *   protectedBranches?: string[], integrationName?: string | null, nameProblem?: string | null,
 *   version?: string | null,
 *   publishedVersions?: string[] | null }} args
 * @returns {{ action: 'create'|'stay'|'ask', branch: string|null, reason: string }}
 */
export function decideBranch({ mode, autoBranch, currentBranch, protectedBranches, integrationName,
  nameProblem, version, publishedVersions }) {
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
    // a null name must never become a silent `create` or a `checkout -b <null>`, so auto and ask downgrade to an ask
    if (name === null && (autoBranch === 'auto' || autoBranch === 'ask')) {
      return { action: 'ask', branch: null,
        reason: nameProblem
          ? `naming-problem: ${nameProblem} - fix or clear it with config.mjs set, or stay on the base / abort`
          : 'naming-problem: no version in PROJECT.md ### Active or ROADMAP title, cannot name the integration branch - set the milestone version, or stay on the base / abort' };
    }
    // a published version must not be offered as a new integration branch (the v2.4.0 collision, #87)
    // no tag carrying it means "nothing published this", which covers the next cycle and out-of-grammar input alike
    // the version arrives as its own argument: the name is anyone's to choose, so it is never parsed for one (D-24)
    const bareVersion = stripLeadingV(version);
    const publishedAs = bareVersion === null
      ? null : tagCarrying(publishedVersions, bareVersion);
    if (publishedAs !== null && (autoBranch === 'auto' || autoBranch === 'ask')) {
      return { action: 'ask', branch: null,
        reason: `already-published: the milestone version ${bareVersion} is already published as the tag ${publishedAs} - open the next milestone version in PROJECT.md ### Active, or confirm deliberately that ${name} is the branch you want` };
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
