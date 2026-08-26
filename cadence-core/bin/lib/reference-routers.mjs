// @ts-check
// reference-routers.mjs - the pure rule behind self-verify's reference-router
// check: a reference that was COLD-SPLIT behind a router must still be reachable
// from that router, and the router must not grow a branch nobody registered. The
// disk half - deciding where the check applies and filing each issue as a CI
// problem - lives in self-verify.mjs, the same split lib/deferred-reads.mjs,
// lib/include-consumers.mjs and lib/route-relay.mjs use.
//
// WHAT A ROUTER IS (LOD-06). `cadence-core/workflows/verify.md` and
// `verify-deep.md` were the first pair: a hot file holding the DECISION and the
// RULE, and a cold file holding the PROCEDURE, loaded only once the decision
// picked that branch. `references/seams.md` and `references/review-triggers.md`
// are the same shape - a site that calls one seam, or fires one trigger, reads
// that branch's file and leaves the others unopened. The saving is entirely in
// what is NOT read, which is exactly the property no other check in this tree
// can see: a cold file is reachable from prose and from nowhere else, so
// deleting the Read line leaves a green tree and an unreachable rule.
//
// WHY THE REGISTER IS HAND-MAINTAINED, and what that buys. Whether a file is a
// COLD BRANCH of a router or just another reference the router happens to cite
// is not derivable from a tree snapshot: both look like one prose file naming
// another. The register IS the statement that this pair is a branch - the same
// species of stated table as self-verify's CONTRACTS, lib/rung-agent's
// RUNG_FILES and lib/deferred-reads' DEFERRED_READS - and the check is what
// holds the tree to it afterwards. A row is added in the same commit that makes
// the cut, and deleting a row unwatches the branch.
//
// THREE ARMS, and why the third one exists. The first two watch the REGISTER's
// claims against the tree: the cold file is on disk, and the router still Reads
// it. Those alone would leave the register free to fall behind - a new cut lands,
// nobody registers it, and the tree is green with an unwatched branch. So the
// third arm reads the ROUTER instead: any
// `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/*.md` path a registered router
// names that no row for that router declares is a branch that escaped the
// register. That arm is what keeps the first two honest.
//
// FENCED BLOCKS ARE EXCLUDED from the third arm, and it is load-bearing rather
// than tidy. `references/review-triggers.md` passes
// `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/reviewer-brief.md` as an
// ARGUMENT inside a literal `node -e` command block: that is a path the caller
// hands to a subprocess, not a branch the router routes to, and counting it
// would force a register row describing a file the router never loads on its
// own. Fences are matched with leading whitespace allowed, because that block is
// indented under a bullet and a column-0-only matcher would read it as prose.
//
// PLUGIN-ROOT SPELLING ONLY, deliberately. A bare `references/<file>`
// parenthetical is a CITATION - it tells a reader where a rule lives. A
// `${CLAUDE_PLUGIN_ROOT}` path is what a model can actually Read, and it is the
// only spelling self-verify check 3 proves resolves on disk. A branch index
// entry has to be the second kind or the branch is not loadable, so that is the
// only spelling this rule accepts as a Read and the only one it counts as a
// branch.
//
// `rows` is a parameter for the reason lib/deferred-reads.mjs states about its
// own: a test must be able to anchor a synthetic row at a real surface without
// adding one to the shipped register, which stays at exactly the branches the
// cuts actually made. A test that anchored against the shipped rows would be
// asserting the register against itself.
//
// Pure rule: no emit, no exit, no Date, no randomness, node builtins only, and
// every read guarded so an unreadable file is one reported issue rather than an
// unwound run. It takes no CONTRACTS row and no CLI entry point, for the reason
// self-verify.mjs check 14 states about `lib/*.mjs`: they are modules prose
// never invokes.
'use strict';

import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** The problem codes this rule files. */
export const CODES = Object.freeze({
  /** The register names a cold file the tree does not have. */
  missingCold: 'reference-router-missing-cold',
  /**
   * The router no longer carries a `${CLAUDE_PLUGIN_ROOT}` Read of that cold
   * file, so the branch is unreachable. An unreadable ROUTER files this too:
   * every branch of a router nothing can read is unreachable, and the detail
   * names the cause.
   */
  unread: 'reference-router-branch-unread',
  /** The router names a references/*.md path no row for it declares. */
  unregistered: 'reference-router-unregistered-branch',
});

/**
 * The register: one row per cold branch of a router.
 *
 * `router` and `cold` are root-relative POSIX paths. `branch` is the DECISION
 * that selects this file, spelled the way the router's own branch line spells
 * it, so a reported issue names the arm a reader can find rather than a path
 * they have to go looking for.
 * @type {ReadonlyArray<{router: string, branch: string, cold: string}>}
 */
export const ROUTERS = Object.freeze([
  Object.freeze({
    router: 'cadence-core/references/seams.md',
    branch: 'ask-user',
    cold: 'cadence-core/references/seam-ask-user.md',
  }),
  Object.freeze({
    router: 'cadence-core/references/seams.md',
    branch: 'spawn-agent',
    cold: 'cadence-core/references/seam-spawn-agent.md',
  }),
  Object.freeze({
    router: 'cadence-core/references/seams.md',
    branch: 'call-review-provider',
    cold: 'cadence-core/references/seam-review-provider.md',
  }),
  Object.freeze({
    router: 'cadence-core/references/review-triggers.md',
    branch: 'record (step 5, a survivor list settled under a non-advisory gate)',
    cold: 'cadence-core/references/review-record.md',
  }),
  Object.freeze({
    router: 'cadence-core/references/review-triggers.md',
    branch: "cross-model (step 3's resolved set holds a non-claude-subagent provider)",
    cold: 'cadence-core/references/review-cross-model.md',
  }),
  Object.freeze({
    router: 'cadence-core/references/review-triggers.md',
    branch: 'risk_surface (the trigger contract, and any site running detection)',
    cold: 'cadence-core/references/risk-surface.md',
  }),
  Object.freeze({
    // Not a cut this phase made - step 6's RE-READ predates it. Registering it
    // is what makes "every gate arm is one Read away from the router" a
    // machine-checked property instead of a sentence: the ONE-round cap on a
    // blocking re-arm lives in triage-gate.md and nowhere else, so a deleted
    // Read line is an uncapped re-arm with a green tree.
    router: 'cadence-core/references/review-triggers.md',
    branch: 'triage-gate (step 6, ANY gate)',
    cold: 'cadence-core/references/triage-gate.md',
  }),
]);

/** A markdown fence, `` ``` `` or `~~~`, indented or not. */
const FENCE_RE = /^\s*(?:`{3,}|~{3,})/;

/**
 * `text` with every fenced block's CONTENT removed, line count preserved so a
 * caller could still report a line number. The fence lines themselves go too.
 * @param {string} text
 * @returns {string}
 */
function outsideFences(text) {
  let inFence = false;
  return text.split('\n').map((line) => {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
      return '';
    }
    return inFence ? '' : line;
  }).join('\n');
}

/** Every `${CLAUDE_PLUGIN_ROOT}/cadence-core/references/<name>.md` path in `text`. */
const BRANCH_RE = /\$\{CLAUDE_PLUGIN_ROOT\}\/(cadence-core\/references\/[A-Za-z0-9_.-]+\.md)/g;

/**
 * Read a file under `root`, or `null` when it is absent or unreadable.
 * @param {string} root @param {string} rel @returns {string|null}
 */
function readRel(root, rel) {
  const file = join(root, ...rel.split('/'));
  try {
    if (!statSync(file).isFile()) return null;
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

/**
 * Every reference-router issue under `root`, at most one entry per failing row
 * plus one per unregistered branch.
 *
 * An absent `cadence-core/references/` directory contributes NOTHING: a
 * `--root` fixture that supplies its own tiny surface set is not a Cadence
 * install with a deleted reference, and reporting the whole register against it
 * would make every fixture unusable. That is the same degradation
 * `deferredReadIssues` makes on an absent `skills/`.
 * @param {string} root
 * @param {ReadonlyArray<{router: string, branch: string, cold: string}>} [rows]
 * @returns {{kind: string, file: string, detail: string}[]}
 */
export function referenceRouterIssues(root, rows = ROUTERS) {
  if (!existsSync(join(root, 'cadence-core', 'references'))) return [];
  const issues = [];

  /** @type {Map<string, {branch: string, cold: string}[]>} rows by router */
  const byRouter = new Map();
  for (const row of rows) {
    const acc = byRouter.get(row.router);
    if (acc) acc.push(row);
    else byRouter.set(row.router, [row]);
  }

  for (const [router, branches] of byRouter) {
    // A root that does not ship the ROUTER at all is out of scope, the way an
    // absent skill directory is for `deferredReadIssues`: a `--root` fixture
    // carrying its own two prose files is not an install with a deleted seam
    // reference, and reporting the whole register against it would make every
    // fixture in the suite unusable. A router that EXISTS and cannot be READ is
    // a break, which is why absence and unreadability are told apart here
    // rather than collapsed into one `null`.
    if (!existsSync(join(root, ...router.split('/')))) continue;
    const text = readRel(root, router);
    // Both arms below read the router's PROSE, never its fenced blocks. A cold
    // path inside a fence is a command's argument, not a branch a reader
    // follows, so it can neither satisfy arm 2's Read nor escape arm 3's
    // register. Arm 2 read the raw text until a fenced example was found to
    // satisfy it with the prose Read deleted.
    const prose = text === null ? null : outsideFences(text);

    for (const row of branches) {
      // Arm 1: the cold file itself. Reported against the COLD path, not the
      // router, because that is the file a reader has to restore.
      if (readRel(root, row.cold) === null) {
        issues.push({
          kind: CODES.missingCold,
          file: row.cold,
          detail: `${router} routes its \`${row.branch}\` branch to ${row.cold}, which is absent or unreadable`,
        });
        continue;
      }
      // Arm 2: the Read line. An unreadable ROUTER lands here too - every one
      // of its branches is unreachable, and the detail says which failure it is
      // rather than silently reporting a deleted Read.
      if (text === null) {
        issues.push({
          kind: CODES.unread,
          file: router,
          detail: `${router} is absent or unreadable, so its \`${row.branch}\` branch cannot reach ${row.cold}`,
        });
        continue;
      }
      if (!prose.includes(`\${CLAUDE_PLUGIN_ROOT}/${row.cold}`)) {
        issues.push({
          kind: CODES.unread,
          file: router,
          detail: `${router} carries no \${CLAUDE_PLUGIN_ROOT} path for ${row.cold}, so its \`${row.branch}\` branch has no Read - the file is reachable from nowhere`,
        });
      }
    }

    if (text === null) continue;

    // Arm 3: the register's own completeness, read off the router. A path the
    // router names OUTSIDE every fenced block that no row declares is a branch
    // that escaped the register. The router naming ITSELF is not a branch.
    const declared = new Set(branches.map((b) => b.cold));
    const seen = new Set();
    for (const m of prose.matchAll(BRANCH_RE)) {
      const rel = m[1];
      if (rel === router || declared.has(rel) || seen.has(rel)) continue;
      seen.add(rel);
      issues.push({
        kind: CODES.unregistered,
        file: router,
        detail: `${router} routes to ${rel}, which no register row for it declares - add the row in the commit that made the cut`,
      });
    }
  }

  return issues;
}
