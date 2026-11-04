#!/usr/bin/env node
// @ts-check
// land-cleanup.mjs - the workflow-facing seam over lib/close-decision.mjs. It advises cad-land whether a land should clean up (return to base, pull, reap the merged integration branch) and whether an autonomous close halts before merge on a genuinely unfixed risk_surface finding
// like git-branch.mjs and git-guard.mjs it only advises and never runs checkout, pull or branch -D, which is cad-land prose's job. One JSON line on stdout: all advice is ok:true with exit 0 (a refused base, one that begins with - or names no commit, is advice to skip, with returnToBase false even under --merged true) and only a malformed call is ok:false with exit 1, a bad subcommand or an empty or valueless --dir. The tested logic is in lib/close-decision.mjs; this wraps it with config and git-read I/O
// cleanup [--dir <path>] [--branch <name>] [--base <name>] [--merged <true|false>] decides the return-to-base, pull and reap. --dir is the planning root: absent means the cwd, while an empty or valueless one refuses (missing-flag-value, exit 1) and doesn't advise a land in a tree the caller never named, which holds for gate too, whose refusal fires before stdin is read
// base resolves from --base, else git.base_branch, else the first git.protected_branches entry. The reap target is resolveReapBranch(derived, `git branch --merged <base>`), where derived is --branch or else integrationBranchName from PROJECT/ROADMAP, so an already-evolved ### Active or a null-derived name still reaps the cadence/* branch that actually merged. --merged is a test hook forcing the merged-into-base verdict
// gate [--dir <path>] reads {findings} JSON from stdin: an explicit {"findings":[]} (or a bare JSON array) is the only way to say nothing survived. Unreadable stdin, empty stdin, malformed JSON and a valid non-findings envelope are each reported by name and not collapsed to [], and under auto_close each halts. When git.auto_close is set in both layers it decides whether that payload halts the chain before merge
// what rides findings is rulings, not raw review text, and this is the only statement in code of where the gate's input comes from: cad-land unions the entries[] of every ADJUDICATION-risk_surface*.json this branch's fires wrote (every round, since a re-arm is a second fire on the same discriminator and round 2 isn't the record of round 1) from .planning/phases/*/ and, after /cad-milestone prunes those dirs, from the copies planning.mjs risk-carry leaves at .planning/risk-carry/<N>/. This seam classifies them through lib/filing-decision.mjs, so a fixed, refuted, downgraded or overridden finding stops no close and only a genuinely unfixed survivor does. /cad-land fires no review of its own
// the caller also names on unruled every REVIEW-risk_surface*.md it found with no such sibling record (a legacy artifact, another tool's, or a deferred fire, which writes none by design). That's the fifth state, unruled-review, and it halts under auto_close beside the four above: a fire nothing ruled says nothing about what survived. A present unruled that isn't a list halts on that state too and doesn't read as none
// a halt a person already cleared rides back out on overridden and moves nothing: action is unchanged and cad-land keeps branching on it alone. The gate reads stdin and nothing else, so it opens no ADJUDICATION file of its own and --dir still resolves config alone
'use strict';

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { mergeLayers } from './lib/config-merge.mjs';
import { autoCloseLayers } from './lib/repo-auto-close.mjs';
import { emit } from './lib/seam-io.mjs';
import { integrationBranchName } from './lib/branch-decision.mjs';
import { resolveReapBranch, decideCleanup, decideGateHalt } from './lib/close-decision.mjs';
// the one statement of what a record's entries mean to a fire that is settling. It lives here at the seam and not in lib/close-decision.mjs, which promises zero deps and no I/O: this module pulls node:crypto and a validator behind it, and restating the four-field test in the pure core to avoid that would be a second definition
import { unfixedFromEntries } from './lib/filing-decision.mjs';
import { resolveProtectedBranches } from './lib/protected-branches.mjs';
import { refuseBase } from './lib/base-ref.mjs';
// the file reader this file used to define for itself; its ''-on-failure contract lives in lib/seam-input.mjs. readFileSync stays imported for readFindings' fd-0 stdin read, which is a different question from reading a surface and getting '' when it isn't there
import { readText } from './lib/seam-input.mjs';
// flag rules are declared rows in lib/arg-contract.mjs and requireFlag raises the refusal in the throwing form the catch arm at the foot already renders. --dir declares refuse: this seam mutates nothing, but the advice it hands cad-land is acted on, so an answer about the wrong tree is the same defect the mutating seams had. --branch, --base and --merged declare fallback, they legitimately default
import { CONTRACTS, requireFlag } from './lib/arg-contract.mjs';

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
 * What the caller named on `unruled`, and the one place a malformed one is decided. Absent reads as `[]` (an old caller that names nothing isn't an error, and `null` is how JSON spells absent). Present but not a list does not: it used to coerce to `[]` too, which meant a payload carrying evidence of an unadjudicated review (`"unruled": "path/to/REVIEW-risk_surface.md"`, one producer serialization bug or one hostile line away) threw the fifth-state halt away without a word and let the autonomous merge run. It fails closed now: one member standing for the malformation, so the list is non-empty and `unruled-review` halts exactly as a named review would.
 *
 * That member names the value's type and never the value. This payload is untrusted and unreadable at once, so copying its bytes into a reason string on stdout is the one thing not to do; `typeof` is one of eight fixed words, which is bounded by construction.
 *
 * @param {unknown} value
 * @returns {unknown[]}
 */
function readUnruled(value) {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value;
  return [`(unruled: ${typeof value}, not a list of review paths)`];
}

/**
 * The adjudication record entries from stdin, the reviews the caller found that nothing ruled, and which of the four unreadable states was seen when there are no entries. All four used to collapse to `[]`, which `decideGateHalt` then reported as "no surviving blocker/high finding", an affirmative answer about a payload nobody parsed. The names are fixed by lib/close-decision.mjs's JSDoc; a payload that did parse returns `unreadable: null` and the list it carried.
 *
 * `findings` keeps its key and changes its meaning: what rides it is now the union of every `ADJUDICATION-risk_surface*.json` `entries[]` for this branch's fires and not the raw `findings[]` of the REVIEW files (the header says who unions them). The four names, the order they're decided in, the empty-stdin rule and the bare-array form are all unchanged, because they are what the four-name contract is.
 *
 * `unruled` is additive: an absent one reads as `[]` so an old caller that names nothing isn't an error, while a present one that isn't a list fails closed in `readUnruled` below. The fifth state (`unruled-review`) halts on it, and only when it's non-empty.
 *
 * Empty stdin is one of the four: the gate requires an explicit `{"findings":[]}` to proceed, because a forgotten pipe is the likeliest operator error and is otherwise indistinguishable from "adjudication killed everything", the one case the old gate waved through under git.auto_close. A bare JSON array still reads as the entries list, and names no unruled review, the same answer an absent key gives.
 *
 * @returns {{findings: Array<Record<string, any>>, unreadable: string|null, unruled: unknown[]}}
 */
function readFindings() {
  let raw = '';
  try { raw = readFileSync(0, 'utf8'); }
  catch { return { findings: [], unreadable: 'stdin-unreadable', unruled: [] }; }
  raw = raw.trim();
  if (!raw) return { findings: [], unreadable: 'stdin-empty', unruled: [] };
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { return { findings: [], unreadable: 'malformed-json', unruled: [] }; }
  if (Array.isArray(parsed)) return { findings: parsed, unreadable: null, unruled: [] };
  if (parsed && Array.isArray(parsed.findings)) {
    return { findings: parsed.findings, unreadable: null,
      unruled: readUnruled(parsed.unruled) };
  }
  return { findings: [], unreadable: 'not-a-findings-payload', unruled: [] };
}

function cleanup(dir, branchArg, baseArg, mergedArg) {
  // warnings[] rides the envelope: on_land_cleanup, the protected list and the base branch all come off this merge, so a torn layer means this advice is the default cleanup and not the user's
  const { config, warnings } = mergeLayers(join(dir, '.planning', 'config.json'));
  const git = config.git || {};
  const onLandCleanup = git.on_land_cleanup !== false; // default true
  // the one coercion (lib/protected-branches.mjs). Honoring the string form moves base as well, deliberately: base falls back to protectedBranches[0], so protected_branches: "release" now resolves base to release and git branch --merged release becomes the reap query. That's the accepted consequence of one grammar across the four readers, not a regression: a string that named the protected branch used to be dropped here for ['main','master'] while git-guard already honored it
  const protectedBranches = resolveProtectedBranches(git);
  const base = baseArg !== undefined ? baseArg : (git.base_branch || protectedBranches[0]);
  // the resolved base is checked before any git read spends it (lib/base-ref.mjs). A refusal is advice to skip, the field set the on_land_cleanup off arm returns, so /cad-land runs no checkout, and it wins over --merged true, which would otherwise read as returnToBase. baseRefused is how /cad-land step 1, which asks this seam before any git command spells the base, tells this skip from the on_land_cleanup off one
  const refused = refuseBase(dir, base);
  if (refused) {
    return emit({ ok: true, action: 'skip', returnToBase: false, pull: false, reap: false,
      baseRefused: true, branch: null, reason: `${refused}: leave HEAD and the integration branch in place`,
      base, warnings });
  }
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
  // the halt exists only to replace the human who was switched off: proceed isn't this gate waving a blocker through, it's the gate saying a human is at /cad-land's publish ask looking at the survivors this branch's risk_surface fires already reported. That human is switched off only when both layers opt in (/cad-land step 3 branches on git-publish.mjs authorized, which reads autoCloseLayers), so this gate reads that same answer for the same --dir. That stops the old failure, where the skipped ask and this halt read two different values of one key and a blocker merged unhalted on GitLab: there's no second value to diverge from. The same answer is what authorized gives the GitLab arm before glab mr create
  // the merge still runs, for its warnings alone, and they ride the envelope for a sharper reason than elsewhere: a torn layer reads auto_close as not opted in, which is the arm that doesn't halt on a surviving blocker. The caller must be able to tell "no chain is running" from "the file that says so did not parse"
  const { warnings } = mergeLayers(join(dir, '.planning', 'config.json'));
  const autoClose = autoCloseLayers(dir).authorized;
  const { findings, unreadable, unruled } = readFindings();
  // the classification, at the seam and nowhere else. One pass over the entries answers both halves: halting is what's genuinely unfixed (ruled survived at a halting severity, no usable fix commit, nobody overrode it) and haltingSurvivors is the same shape a person already cleared. A fixed, refuted, downgraded or overridden finding is in neither, which is the whole requirement: it no longer stops a close. No disk is read, the entries came in on stdin and --dir still resolves config alone
  const { halting, haltingSurvivors } = unfixedFromEntries(findings);
  const decision = decideGateHalt({ autoClose, findings: halting, unreadable,
    unruled, overridden: haltingSurvivors });
  emit({ ok: true, ...decision, warnings });
}


const argv = process.argv.slice(2);
const cmd = argv[0];
/** This script's declared rows. A subcommand's own row wins over the `'*'` row, where the flags allowed on every arm (here `--dir`) are declared once. */
const ROWS = CONTRACTS['land-cleanup.mjs'];
/** One flag of `sub`, read through its declared row. The row owns the rule and this is an adapter over this file's own argv, never a second statement of what a flag may be. */
const arg = (sub, name) => requireFlag(argv, name, ROWS[sub][name] || ROWS['*'][name]);

try {
  // --dir declares refuse on both axes: a genuinely absent one still reads as undefined and the cwd default is unchanged, while empty, valueless and flag-shaped spellings raise the refusal. It's raised while the argument is built, so gate refuses before it reads stdin, one JSON line out either way. The other three declare fallback, so a spelling carrying no usable value reads as absent and this seam's own defaults answer: the derived integration branch, git.base_branch and the merged list
  if (cmd === 'cleanup') {
    cleanup(arg('cleanup', '--dir') || process.cwd(),
      arg('cleanup', '--branch'), arg('cleanup', '--base'), arg('cleanup', '--merged'));
  } else if (cmd === 'gate') {
    gate(arg('gate', '--dir') || process.cwd());
  } else {
    emit({ ok: false, reason: 'usage',
      detail: 'subcommands: cleanup [--dir <path>] [--branch <name>] [--base <name>] [--merged <true|false>] | gate [--dir <path>]' });
  }
} catch (e) {
  // the seam arm is what a refuse row costs its bin: the raised refusal carries no message, so without it a valueless --dir emits detail "[object Object]". One JSON line on stdout like every verdict, since stderr is a channel no workflow reading this seam parses
  if (e && e.seam) emit({ ok: false, reason: e.seam, detail: e.detail,
    hint: 'the detail names the flag that refused - give it a value of the kind that flag takes and re-run the command' });
  else emit({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
}
