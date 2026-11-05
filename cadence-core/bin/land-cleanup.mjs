#!/usr/bin/env node
// @ts-check
// the seam over lib/close-decision.mjs: advises cad-land whether to clean up after a land,
// and whether an autonomous close halts before merge on an unfixed risk_surface finding
// it only advises; checkout, pull and branch -D are cad-land prose's job
// one JSON line, exit 0 for all advice; exit 1 only for a malformed call (empty or valueless --dir, bad subcommand)
// gate reads {findings} on stdin; an explicit {"findings":[]} is the only way to say nothing survived
// bad stdin is named, never collapsed to [], and halts under auto_close; unruled reviews halt too
'use strict';

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { mergeLayers } from './lib/config-merge.mjs';
import { autoCloseLayers } from './lib/repo-auto-close.mjs';
import { emit } from './lib/seam-io.mjs';
import { integrationBranchName } from './lib/branch-decision.mjs';
import { resolveReapBranch, decideCleanup, decideGateHalt } from './lib/close-decision.mjs';
// the one statement of what an entry means to a settling fire; here because lib/close-decision.mjs has no deps or I/O
import { unfixedFromEntries } from './lib/filing-decision.mjs';
import { resolveProtectedBranches } from './lib/protected-branches.mjs';
import { refuseBase } from './lib/base-ref.mjs';
// readFileSync stays for readFindings' fd-0 read; readText returns '' on failure, which is a different question
import { readText } from './lib/seam-input.mjs';
// requireFlag raises the refusal the catch at the foot renders; --dir refuses, since wrong-tree advice gets acted on
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
 * What the caller named on `unruled`, and the one place a malformed one is decided. Absent reads as `[]`.
 * Present but not a list used to coerce to `[]` too, which let an autonomous merge run past the fifth-state halt.
 * Now it fails closed: one member stands for the malformation, so `unruled-review` halts as a named review would.
 *
 * That member names the value's type, never the value: the payload is untrusted, so its bytes stay off stdout.
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
 * The adjudication entries from stdin, the reviews nothing ruled, and which unreadable state was seen.
 * All four used to collapse to `[]`, which read as "no surviving blocker" for a payload nobody parsed.
 *
 * `findings` carries the `ADJUDICATION-risk_surface*.json` entries, not raw review findings.
 *
 * Empty stdin is unreadable too: a forgotten pipe is the likeliest operator error, so the gate wants an explicit
 * `{"findings":[]}`. A bare array still reads as the entries list.
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
  // warnings ride the envelope: a torn layer means this advice is the default cleanup, not the user's
  const { config, warnings } = mergeLayers(join(dir, '.planning', 'config.json'));
  const git = config.git || {};
  const onLandCleanup = git.on_land_cleanup !== false; // default true
  // one coercion for all readers, so protected_branches: "release" also makes release the base, like git-guard
  const protectedBranches = resolveProtectedBranches(git);
  const base = baseArg !== undefined ? baseArg : (git.base_branch || protectedBranches[0]);
  // the base is checked before any git read spends it. A refusal is advice to skip and wins over --merged true
  // baseRefused is how /cad-land step 1 tells this skip from the on_land_cleanup off one
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
  // the halt replaces the human who was switched off, and that happens only when both layers opt in
  // so it reads the same autoCloseLayers answer as git-publish authorized; two values once merged a blocker on GitLab
  // the merge runs for its warnings alone: a torn layer reads as not opted in, which isn't the same as no chain
  const { warnings } = mergeLayers(join(dir, '.planning', 'config.json'));
  const autoClose = autoCloseLayers(dir).authorized;
  const { findings, unreadable, unruled } = readFindings();
  // classified here only: halting is what's genuinely unfixed, haltingSurvivors the same shape a person already cleared
  const { halting, haltingSurvivors } = unfixedFromEntries(findings);
  const decision = decideGateHalt({ autoClose, findings: halting, unreadable,
    unruled, overridden: haltingSurvivors });
  emit({ ok: true, ...decision, warnings });
}


const argv = process.argv.slice(2);
const cmd = argv[0];
/** This script's declared rows. A subcommand's own row wins over the `'*'` row, where flags every arm takes live. */
const ROWS = CONTRACTS['land-cleanup.mjs'];
/** One flag of `sub`, read through its declared row. The row owns the rule; this just adapts our argv. */
const arg = (sub, name) => requireFlag(argv, name, ROWS[sub][name] || ROWS['*'][name]);

try {
  // --dir refuses when empty, valueless or flag-shaped, so gate refuses before reading stdin; the rest fall back
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
  // the seam arm: a refusal carries no message, so without this a valueless --dir emits detail "[object Object]"
  if (e && e.seam) emit({ ok: false, reason: e.seam, detail: e.detail,
    hint: 'the detail names the flag that refused - give it a value of the kind that flag takes and re-run the command' });
  else emit({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
}
