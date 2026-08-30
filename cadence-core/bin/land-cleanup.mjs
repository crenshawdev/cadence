#!/usr/bin/env node
// @ts-check
// land-cleanup.mjs - the workflow-facing seam over lib/close-decision.mjs. It
// ADVISES cad-land whether a land should clean up (return to base + pull + reap
// the merged integration branch) and whether an autonomous close halts before
// merge on a genuinely-unfixed risk_surface finding. Like git-branch.mjs /
// git-guard.mjs it only advises: it NEVER runs `checkout`, `pull`, or
// `branch -D` - that is cad-land prose's job, gated by this advice. One JSON
// line on stdout (seam convention, lib/seam-io.mjs): every piece of ADVICE is
// ok:true and exits 0, and the only ok:false/exit-1 shapes are a malformed
// CALL - a bad subcommand, or an empty or valueless --dir. The tested logic
// lives in lib/close-decision.mjs; this wraps it with config + git-read I/O.
//
// Subcommands (each prints one JSON line):
//   cleanup [--dir <path>] [--branch <name>] [--base <name>] [--merged <true|false>]
//     Decide the return-to-base + pull + reap for a land. --dir is the planning
//     root: ABSENT means the process cwd, while an EMPTY or valueless --dir
//     REFUSES (`missing-flag-value`, exit 1) rather than advising a land in a
//     tree the caller never named (phase 2 D-01) - true of `gate` too, whose
//     refusal fires before stdin is read at all.
//     Base resolves from --base, else git.base_branch, else
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
//     branched on - see gate() below), decide whether that payload halts the
//     chain before merge.
//     WHAT RIDES `findings` IS RULINGS, NOT RAW REVIEW TEXT (LND-02, and this
//     is the only statement in code of where the gate's input comes from).
//     cad-land unions the `entries[]` of every ADJUDICATION-risk_surface*.json
//     this branch's fires wrote - EVERY round of a fire, because a re-arm is a
//     second fire on the same discriminator and round 2 is not the record of
//     round 1 - taken from .planning/phases/*/ and, after /cad-milestone prunes
//     those dirs out from under an autonomous close, from the copies
//     `planning.mjs risk-carry` leaves at .planning/risk-carry/<N>/. This seam
//     classifies them through lib/filing-decision.mjs, so a finding that was
//     fixed, refuted, downgraded or overridden stops no close and only a
//     genuinely-unfixed survivor does. /cad-land fires no review of its own.
//     The caller ALSO names on `unruled` every REVIEW-risk_surface*.md it found
//     carrying no such sibling record - a legacy artifact, another tool's, or a
//     deferred fire, which writes none by design. That is the FIFTH state,
//     `unruled-review`, and it halts under auto_close beside the four above: a
//     fire nothing ruled says nothing about what survived. A PRESENT `unruled`
//     that is not a list halts on that state too rather than reading as none.
//     A halt a person already CLEARED rides back out on `overridden` and moves
//     nothing - `action` is unchanged, and cad-land keeps branching on it alone.
//     The gate reads STDIN AND NOTHING ELSE: it opens no ADJUDICATION file of
//     its own, and --dir still resolves config alone.
'use strict';

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { mergeLayers } from './lib/config-merge.mjs';
import { emit } from './lib/seam-io.mjs';
import { integrationBranchName } from './lib/branch-decision.mjs';
import { resolveReapBranch, decideCleanup, decideGateHalt } from './lib/close-decision.mjs';
// The ONE statement of what a record's entries mean to a fire that is
// settling (LND-02, D-04/D-06). It lives HERE at the seam and not in
// lib/close-decision.mjs, which promises zero deps and no I/O in its own
// header: this module pulls node:crypto and a 543-line validator behind it,
// and restating the four-field test in the pure core to avoid that would be
// the second definition criterion 1 forbids.
import { unfixedFromEntries } from './lib/filing-decision.mjs';
import { resolveProtectedBranches } from './lib/protected-branches.mjs';
// The file reader this file used to define for itself; its ''-on-failure
// contract lives in lib/seam-input.mjs. `readFileSync` stays imported above for
// readFindings' fd-0 stdin read, which is a different question from "read this
// surface, '' if it is not there".
import { readText } from './lib/seam-input.mjs';
// The argument contract (ARG-06). This file states no flag rule of its own any
// more: what each flag may be, and what it costs when it is not, are DECLARED
// rows in lib/arg-contract.mjs, and `requireFlag` raises the refusal in the
// throwing form the catch arm at the foot of this file already renders. `--dir`
// declares `refuse` (D-01): this seam mutates nothing, but the advice it hands
// cad-land is acted on, so an answer about the wrong tree is the same defect
// the mutating seams had. `--branch`, `--base` and `--merged` declare
// `fallback` - they legitimately default.
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
 * What the caller named on `unruled`, and the ONE place a malformed one is
 * decided. ABSENT reads as `[]` - an old caller that names nothing is not an
 * error, and `null` is how JSON spells absent, so it reads the same way.
 * PRESENT BUT NOT A LIST DOES NOT. It used to coerce to `[]` as well, which
 * meant a payload that explicitly carried evidence of an unadjudicated review
 * - `"unruled": ".planning/phases/9/REVIEW-risk_surface-plan-1.md"`, one
 * producer serialization bug or one hostile line away - threw the fifth-state
 * halt away without a word and let the autonomous merge run. It fails CLOSED
 * now: one member standing for the malformation, so the list is non-empty and
 * `unruled-review` halts exactly as a named review would.
 *
 * That member names the value's TYPE and never the value. This payload is
 * untrusted and unreadable at once, so copying its bytes into a reason string
 * on stdout is the one thing not to do; `typeof` is one of eight fixed words,
 * which is bounded by construction.
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
 * The ADJUDICATION RECORD ENTRIES from stdin, the reviews the caller found that
 * nothing ruled, and WHICH of the four unreadable states was seen when there
 * are no entries. All four used to collapse to `[]`, which `decideGateHalt`
 * then reported as "no surviving blocker/high finding" - an affirmative answer
 * about a payload nobody parsed. The names are fixed by lib/close-decision.mjs's
 * JSDoc; a payload that DID parse returns `unreadable: null` and the list it
 * carried.
 *
 * `findings` KEEPS ITS KEY AND CHANGES ITS MEANING (LND-02). What rides it is
 * now the union of every `ADJUDICATION-risk_surface*.json` `entries[]` for this
 * branch's fires rather than the raw `findings[]` of the REVIEW files - see this
 * file's header for who unions them. The four names, the order they are decided
 * in, the empty-stdin rule and the bare-array form are ALL unchanged, because
 * they are what the four-name contract is (D-13).
 *
 * `unruled` IS ADDITIVE: an ABSENT one reads as `[]`, so an old caller that
 * names nothing is not an error here. A PRESENT one that is not a list does
 * NOT read as none - `readUnruled` below fails it closed. It is the FIFTH
 * state (`unruled-review`) that halts on it, and only when it is non-empty.
 *
 * EMPTY stdin is one of the four (D-09): the gate requires an explicit
 * `{"findings":[]}` to proceed, because a forgotten pipe is the likeliest
 * operator error and is otherwise indistinguishable from "adjudication killed
 * everything" - the one case today's gate waved through under git.auto_close.
 * A bare JSON array still reads as the entries list, as it always has - and it
 * names no unruled review, which is the same answer an absent key gives.
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
  const { findings, unreadable, unruled } = readFindings();
  // The classification, at the seam and nowhere else (D-06). One pass over the
  // entries answers both halves: `halting` is what is GENUINELY unfixed - ruled
  // `survived` at a halting severity, no usable fix commit, nobody overrode it -
  // and `haltingSurvivors` is the same shape a person already cleared. A fixed,
  // refuted, downgraded or overridden finding is in neither, which is the whole
  // requirement: it no longer stops a close. No disk is read for this - the
  // entries came in on stdin and `--dir` still resolves config alone (D-07).
  const { halting, haltingSurvivors } = unfixedFromEntries(findings);
  const decision = decideGateHalt({ autoClose, findings: halting, unreadable,
    unruled, overridden: haltingSurvivors });
  emit({ ok: true, ...decision, warnings });
}

// --- dispatch ----------------------------------------------------------------

const argv = process.argv.slice(2);
const cmd = argv[0];
/** This script's declared rows. A subcommand's own row wins over the `'*'` row,
 * where the flags allowed on every arm - here `--dir` - are declared once. */
const ROWS = CONTRACTS['land-cleanup.mjs'];
/** One flag of `sub`, read through its DECLARED row. The row owns the rule and
 * this binding owns nothing: it is an adapter over this file's own argv, never
 * a second statement of what a flag may be. */
const arg = (sub, name) => requireFlag(argv, name, ROWS[sub][name] || ROWS['*'][name]);

try {
  // `--dir` declares `refuse` on both axes: a genuinely ABSENT one still reads
  // as undefined and the cwd default is unchanged, while the empty, valueless
  // and flag-shaped spellings raise the refusal. It is raised while the
  // argument is built, so `gate` refuses BEFORE it reads stdin - one JSON line
  // out either way. The other three declare `fallback` (D-12), so a spelling
  // carrying no usable value reads as ABSENT and this seam's own defaults
  // answer: the derived integration branch, `git.base_branch`, and the merged
  // list. That is the answer a bare `--branch` already gave.
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
  // The seam arm is what a `refuse` row costs its bin (D-08/D-09): the raised
  // refusal object carries no `message`, so without it a valueless --dir emits
  // detail "[object Object]". One JSON line on stdout like every other verdict
  // (D-02) - stderr is a channel no workflow reading this seam parses.
  if (e && e.seam) emit({ ok: false, reason: e.seam, detail: e.detail,
    hint: 'the detail names the flag that refused - give it a value of the kind that flag takes and re-run the command' });
  else emit({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
}
