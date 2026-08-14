#!/usr/bin/env node
// @ts-check
// land-cleanup.mjs - the workflow-facing seam over lib/close-decision.mjs. It
// ADVISES cad-land whether a land should clean up (return to base + pull + reap
// the merged integration branch) and whether an autonomous close halts before
// merge on a blocking risk_surface finding. Like git-branch.mjs / git-guard.mjs it
// only advises: it NEVER runs `checkout`, `pull`, or `branch -D` - that is
// cad-land prose's job, gated by this advice. One JSON line on stdout, exit 0
// (seam convention, lib/seam-io.mjs). The tested logic lives in
// lib/close-decision.mjs; this wraps it with config + git-read I/O.
//
// Subcommands (each prints one JSON line):
//   cleanup [--dir <path>] [--branch <name>] [--base <name>] [--merged <true|false>]
//     Decide the return-to-base + pull + reap for a land. --dir is the planning
//     root (default cwd). Base resolves from --base, else git.base_branch, else
//     the first git.protected_branches entry (cad-land / references/git-guard.md order). The reap
//     target is resolveReapBranch(derived, `git branch --merged <base>`), where
//     derived = --branch when given, else integrationBranchName(PROJECT/ROADMAP)
//     - so an already-evolved ### Active or a null-derived name still reaps the
//     cadence/* branch that actually merged. --merged is a test hook forcing the
//     merged-into-base verdict (else inferred from the merged list).
//   gate [--dir <path>]
//     Read {findings} JSON from stdin - an explicit `{"findings":[]}` (or a bare
//     JSON array) is the only way to say "nothing survived". Unreadable stdin,
//     EMPTY stdin, malformed JSON and a valid non-findings envelope are each
//     reported by NAME rather than collapsed to [], and under auto_close each
//     halts (D-09). Then, under the MERGED git.auto_close (the value the prose
//     branched on - see gate() below), decide whether a surviving blocker/high
//     risk_surface finding - or a payload that could not be read - halts the
//     chain before merge. cad-land supplies those findings by unioning the
//     .planning/phases/*/REVIEW-risk_surface*.md files this branch's fires
//     persisted PLUS .planning/REVIEW-risk_surface-*.md, which is where
//     /cad-milestone carries them before it prunes the phase dirs out from
//     under an autonomous close; it fires no review of its own.
'use strict';

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { mergeLayers } from './lib/config-merge.mjs';
import { emit } from './lib/seam-io.mjs';
import { integrationBranchName } from './lib/branch-decision.mjs';
import { resolveReapBranch, decideCleanup, decideGateHalt } from './lib/close-decision.mjs';
import { resolveProtectedBranches } from './lib/protected-branches.mjs';
// The argv and file readers this file used to define for itself; both flag
// contracts and the reason there are two of them live in lib/seam-input.mjs.
// `readFileSync` stays imported above for readFindings' fd-0 stdin read, which
// is a different question from "read this surface, '' if it is not there".
import { optionalFlag, readText } from './lib/seam-input.mjs';

/**
 * The branches `git branch --merged <base>` reports at `dir`, or [] if git
 * cannot be read (no repo / bad base) - degrade to empty like git-branch.mjs,
 * never throw.
 */
function readMergedBranches(dir, base) {
  try {
    const out = execFileSync('git', ['-C', dir, 'branch', '--merged', base],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split('\n')
      .map((l) => l.replace(/^[*+ ]+/, '').trim()) // strip the `* `/`+ ` markers
      .filter(Boolean);
  } catch { return []; }
}

/**
 * The adjudicated findings from stdin, plus WHICH of the four unreadable states
 * was seen when there are none. All four used to collapse to `[]`, which
 * `decideGateHalt` then reported as "no surviving blocker/high finding" - an
 * affirmative answer about a payload nobody parsed. The names are fixed by
 * lib/close-decision.mjs's JSDoc; a payload that DID parse returns
 * `unreadable: null` and the list it carried.
 *
 * EMPTY stdin is one of the four (D-09): the gate requires an explicit
 * `{"findings":[]}` to proceed, because a forgotten pipe is the likeliest
 * operator error and is otherwise indistinguishable from "adjudication killed
 * everything" - the one case today's gate waved through under git.auto_close.
 * A bare JSON array still reads as the findings list, as it always has.
 *
 * @returns {{findings: Array<{severity?:string}>, unreadable: string|null}}
 */
function readFindings() {
  let raw = '';
  try { raw = readFileSync(0, 'utf8'); }
  catch { return { findings: [], unreadable: 'stdin-unreadable' }; }
  raw = raw.trim();
  if (!raw) return { findings: [], unreadable: 'stdin-empty' };
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { return { findings: [], unreadable: 'malformed-json' }; }
  if (Array.isArray(parsed)) return { findings: parsed, unreadable: null };
  if (parsed && Array.isArray(parsed.findings)) return { findings: parsed.findings, unreadable: null };
  return { findings: [], unreadable: 'not-a-findings-payload' };
}

function cleanup(dir, branchArg, baseArg, mergedArg) {
  // warnings[] rides the envelope: on_land_cleanup, the protected list and the
  // base branch all come off this merge, so a torn layer means this advice is
  // the DEFAULT cleanup rather than the user's.
  const { config, warnings } = mergeLayers(join(dir, '.planning', 'config.json'));
  const git = config.git || {};
  const onLandCleanup = git.on_land_cleanup !== false; // default true
  // The ONE coercion (lib/protected-branches.mjs). Honoring the string form
  // here moves `base` as well, deliberately (D-07): base falls back to
  // protectedBranches[0], so `protected_branches: "release"` now resolves base
  // to `release` and `git branch --merged release` becomes the reap query.
  // That is the accepted consequence of one grammar across the four readers,
  // not a regression - a string that named the protected branch used to be
  // dropped here for ['main','master'] while git-guard already honored it.
  const protectedBranches = resolveProtectedBranches(git);
  const base = baseArg !== undefined ? baseArg : (git.base_branch || protectedBranches[0]);
  const mergedList = readMergedBranches(dir, base);
  const derived = branchArg !== undefined ? branchArg
    : integrationBranchName(
      readText(join(dir, '.planning', 'PROJECT.md')),
      readText(join(dir, '.planning', 'ROADMAP.md')),
    );
  const branch = resolveReapBranch(derived, mergedList);
  const mergedIntoBase = mergedArg !== undefined
    ? mergedArg === 'true'
    : (branch !== null && mergedList.includes(branch));
  const decision = decideCleanup({ onLandCleanup, mergedIntoBase, branch });
  emit({ ok: true, ...decision, base, warnings });
}

function gate(dir) {
  // The MERGED value, deliberately - NOT git-publish.mjs's repo-layer-only read.
  // The two seams ask different questions of one key. `repoAutoClose`
  // (git-publish.mjs:53-61) asks "am I authorized to push unattended HERE", which
  // D-08 answers repo-only so a user-global value starts no close in an unrelated
  // project. This gate asks "is anybody WATCHING", and that answer has to match
  // whatever the prose branched on - skills/cad-land/SKILL.md:24 reads the merged
  // value through `config.mjs get` and skips the publish ask under it
  // (references/triage-gate.md, the git.auto_close carve-out: "land-cleanup.mjs
  // gate's blocker/high halt is the only consequence").
  //
  // So `proceed` on false is not this gate waving a blocker through; it is the
  // gate saying a human is at the publish ask, looking at the survivors this
  // branch's risk_surface fires already reported. The halt exists ONLY to
  // replace the human who was switched off, which makes the skipped ask and the
  // halt a matched pair that must read the SAME value.
  // Narrowing this to `layers.repo` (0b1c322, reverted here) aligned the two
  // seams' VALUES and broke that pairing: with a global-only auto_close the prose
  // still entered the unattended chain and still suppressed triage while this gate
  // believed no chain was running. On GitHub the chain then died at the publish
  // seam; on GitLab nothing gates it at all (`glab mr create` publishes the source
  // branch itself), so a surviving blocker merged with no triage and no halt.
  //
  // warnings[] rides the envelope here for a sharper reason than elsewhere: a
  // torn layer reads auto_close as absent, which is `false`, which is the arm
  // that DOES NOT halt on a surviving blocker - the unattended close's one
  // remaining stop. The caller must be able to tell "no chain is running" from
  // "the file that says so did not parse".
  const { config, warnings } = mergeLayers(join(dir, '.planning', 'config.json'));
  const git = config.git || {};
  const autoClose = git.auto_close === true;
  const { findings, unreadable } = readFindings();
  const decision = decideGateHalt({ autoClose, findings, unreadable });
  emit({ ok: true, ...decision, warnings });
}

// --- dispatch ----------------------------------------------------------------

const argv = process.argv.slice(2);
const cmd = argv[0];
/** Value after a `--flag`, or undefined if the flag is absent. An adapter
 * binding over lib/seam-input.mjs's reader - this file's own argv, so every
 * call site below keeps its spelling - never a second definition of it. */
const flag = (name) => optionalFlag(argv, name);

try {
  if (cmd === 'cleanup') {
    cleanup(flag('--dir') || process.cwd(), flag('--branch'), flag('--base'), flag('--merged'));
  } else if (cmd === 'gate') {
    gate(flag('--dir') || process.cwd());
  } else {
    emit({ ok: false, reason: 'usage',
      detail: 'subcommands: cleanup [--dir <path>] [--branch <name>] [--base <name>] [--merged <true|false>] | gate [--dir <path>]' });
  }
} catch (e) {
  emit({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
}
