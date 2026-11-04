// @ts-check
// reference-routers.mjs - the pure rule behind self-verify's reference-router check
// a cold-split reference must stay reachable from its router: a deleted Read line leaves a green tree and a dead rule
// the register is hand-maintained because a cold branch and a cited reference look alike in a snapshot
// three arms: the cold file exists, the router still Reads it, and it names no references/*.md path a row lacks
// that third arm skips fenced blocks: a path passed as an argument inside a node -e block isn't a branch
// only the `${CLAUDE_PLUGIN_ROOT}` spelling counts: that's what a model can Read and what check 3 proves resolves
// pure, builtins only, every read guarded; no CONTRACTS row, lib/*.mjs are never invoked from prose
'use strict';

import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** The problem codes this rule files. */
export const CODES = Object.freeze({
  /** The register names a cold file the tree does not have. */
  missingCold: 'reference-router-missing-cold',
  /**
   * The router no longer Reads that cold file by ${CLAUDE_PLUGIN_ROOT} path, so the branch is
   * unreachable. An unreadable router files this too, with the cause in the detail.
   */
  unread: 'reference-router-branch-unread',
  /** The router names a references/*.md path no row for it declares. */
  unregistered: 'reference-router-unregistered-branch',
});

/**
 * The register: one row per cold branch of a router.
 * router and cold are root-relative POSIX paths. branch is the decision that selects the file, spelled
 * the way the router's own branch line spells it, so an issue names an arm a reader can find.
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
    // not a cut a router split made: registering it makes "every gate
    // arm is one Read from the router" a checked property
    // the one-round cap on a blocking re-arm lives only in triage-gate.md, so
    // a deleted Read line is an uncapped re-arm with a green tree
    router: 'cadence-core/references/review-triggers.md',
    branch: 'triage-gate (step 6, ANY gate)',
    cold: 'cadence-core/references/triage-gate.md',
  }),
]);

/** A markdown fence, `` ``` `` or `~~~`, indented or not. */
const FENCE_RE = /^\s*(?:`{3,}|~{3,})/;

/**
 * text with every fenced block's content and its fence lines blanked,
 * line count kept so a caller could still report a line number.
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
 * Every reference-router issue under root: at most one per failing row, plus one per unregistered branch.
 *
 * An absent references/ directory contributes nothing: a --root fixture with its own tiny surface set
 * isn't an install with a deleted reference, same as deferredReadIssues on an absent skills/.
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
    // a root without the router at all is out of scope, like an absent skill directory for deferredReadIssues.
    // A router that exists and can't be read is a break, so absence and unreadability stay apart
    if (!existsSync(join(root, ...router.split('/')))) continue;
    const text = readRel(root, router);
    // both arms below read the router's prose, never its fences: a path inside a fence is a
    // command's argument, so it can neither satisfy arm 2 nor escape arm 3. Arm 2 once read the
    // raw text, and a fenced example satisfied it with the prose Read deleted
    const prose = text === null ? null : outsideFences(text);

    for (const row of branches) {
      // arm 1: the cold file, reported against its own path because that's the file a reader has to restore
      if (readRel(root, row.cold) === null) {
        issues.push({
          kind: CODES.missingCold,
          file: row.cold,
          detail: `${router} routes its \`${row.branch}\` branch to ${row.cold}, which is absent or unreadable`,
        });
        continue;
      }
      // arm 2: the Read line. An unreadable router lands here too, with a
      // detail that says so instead of reporting a deleted Read
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

    // arm 3: the register's own completeness, read off the router. A path outside every fence
    // that no row declares escaped the register; the router naming itself isn't a branch
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
