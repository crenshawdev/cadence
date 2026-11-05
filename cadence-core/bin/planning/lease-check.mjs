// @ts-check
// planning/lease-check.mjs - `lease-check`: the file lease a plan declares, enforced at the commit step
// repoRel, splitNul, quoteRawPath and parseStagedNameStatus live here because this handler is their only caller
// prose-agreement.test.mjs reads this file's bytes for the `undeclared-files` reason at its emitting site
'use strict';

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, relative, resolve as resolvePath, sep } from 'node:path';
import { fail, phaseSpellingCollision, ok, read } from './core.mjs';
import { CENSUSES, censusesAtRisk } from '../lib/census-registry.mjs';
import { covers } from '../lib/lease-grammar.mjs';
import { parsePlanFiles } from '../lib/planning-files.mjs';
import { redactUrl } from '../lib/redact-url.mjs';
import { isReportName } from '../lib/report-rotation.mjs';
import { requireInt, requirePhaseArg } from '../lib/require-int.mjs';
import { appendEvent } from '../lib/trace.mjs';
import { emit } from '../lib/seam-io.mjs';

// the `files:` list is what the parallel gate proves independence from; an unnamed staged path voids it
// a seam, not a Write/Edit hook: a hook can't tell which plan is writing, and a misfiring rail gets deleted
// an unprovable lease is never a pass: a missing plan, unreadable staged set or unreadable `files:` is ok:false
// staged set via `--name-status -z -M`: verbatim paths, both rename sides, and -M since diff.renames is user config
// split on 0x00 bytes, never decoded: invalid UTF-8 folds to U+FFFD; a path failing the round trip is refused by name

/** A path made repo-relative and separator-normalized, for comparison with git. */
function repoRel(top, p) {
  return relative(top, resolvePath(p)).split(sep).join('/');
}

/**
 * Split a NUL-separated stream into its raw field buffers, byte-exactly.
 *
 * @param {Buffer} buf
 * @returns {Buffer[]}
 */
function splitNul(buf) {
  /** @type {Buffer[]} */
  const fields = [];
  for (let start = 0; ;) {
    const i = buf.indexOf(0, start);
    if (i === -1) { fields.push(buf.subarray(start)); break; }
    fields.push(buf.subarray(start, i));
    start = i + 1;
  }
  return fields;
}

/**
 * A path no JSON string can carry, in git's `core.quotePath` spelling: `src/caf<0xE9>.js` is `"src/caf\351.js"`.
 *
 * @param {Buffer} raw
 * @returns {string}
 */
function quoteRawPath(raw) {
  let s = '';
  for (const b of raw) {
    if (b === 0x22 || b === 0x5c) s += `\\${String.fromCharCode(b)}`;
    else if (b >= 0x20 && b < 0x7f) s += String.fromCharCode(b);
    else s += `\\${b.toString(8).padStart(3, '0')}`;
  }
  return `"${s}"`;
}

/**
 * Parse a `git diff --cached --name-status -z -M` stream into staged entries.
 * Records are NUL-separated fields, not lines: `R` (rename) and `C` (copy) take two paths, every other status one.
 * Takes a buffer split on 0x00, since decoding first folds invalid UTF-8 onto U+FFFD and merges two paths into one.
 * Paths that don't round-trip come back under `unrepresentable`, in quoteRawPath spelling, for the caller to refuse.
 * Returns null on a truncated or unparseable stream, which the caller turns into `no-staged-set`.
 *
 * @param {Buffer} out
 * @returns {{
 *   entries: {path: string, status: string, source: string|null}[],
 *   unrepresentable: string[],
 * } | null}
 */
function parseStagedNameStatus(out) {
  const fields = splitNul(out);
  // -z terminates every field with a NUL, so the tail split is empty
  if (fields.length && fields[fields.length - 1].length === 0) fields.pop();
  /** @type {{path: string, status: string, source: string|null}[]} */
  const entries = [];
  /** @type {string[]} */
  const unrepresentable = [];
  /** A path decoded, or null when its bytes are not valid UTF-8. */
  const decodePath = (/** @type {Buffer} */ raw) => {
    const s = raw.toString('utf8');
    if (!Buffer.from(s, 'utf8').equals(raw)) {
      unrepresentable.push(quoteRawPath(raw));
      return null;
    }
    return s;
  };
  for (let i = 0; i < fields.length;) {
    const status = fields[i++].toString('utf8');
    if (!status) return null;
    const paired = status[0] === 'R' || status[0] === 'C';
    if (i + (paired ? 2 : 1) > fields.length) return null;
    const rawSource = paired ? fields[i++] : null;
    const rawPath = fields[i++];
    if (rawPath.length === 0 || (rawSource !== null && rawSource.length === 0)) return null;
    const source = rawSource === null ? null : decodePath(rawSource);
    const path = decodePath(rawPath);
    // a path that didn't round-trip is in `unrepresentable` already; a U+FFFD spelling in `entries` would be a guess
    if (path === null || (rawSource !== null && source === null)) continue;
    entries.push({ path, status, source });
  }
  return { entries, unrepresentable };
}

/**
 * Whether the project root is Cadence's own repository: its `.claude-plugin/plugin.json` parses and names `cadence`.
 * CENSUSES holds Cadence's own counts, and its holders sit under `tests/`, a common path in user projects.
 * The check lives here, not in lib/census-registry.mjs, which is pure and leaves file reads to its caller.
 * @param {string} root
 * @returns {boolean}
 */
function censusesApply(root) {
  try {
    const manifest = JSON.parse(readFileSync(join(root, '.claude-plugin', 'plugin.json'), 'utf8'));
    return !!manifest && manifest.name === 'cadence';
  } catch {
    return false;
  }
}

function cmdLeaseCheck(dir, opts) {
  const parsedPhase = requirePhaseArg(opts.phase);
  if (!parsedPhase.ok) {
    return fail('bad-args', 'lease-check needs --phase <N>',
      'pass --phase <N> for the phase the plan being committed belongs to, then re-run');
  }
  // the tree-aware collision check runs before any phase-directory read; `phases/1.10/` stays addressable
  const collision = phaseSpellingCollision(dir, parsedPhase);
  if (collision) {
    return fail('bad-args', `lease-check ${collision}`,
      're-run with one of the two spellings the detail names - nothing was read');
  }
  const parsedPlan = requireInt(opts.plan);
  if (!parsedPlan.ok) {
    return fail('bad-args', 'lease-check needs --plan <k>',
      'pass --plan <k>, the number in PLAN-<k>.md - 1 for a bare PLAN.md - then re-run');
  }
  const n = parsedPhase.value;
  const k = parsedPlan.value;
  // the root is the planning dir's parent on both arms, so plan-time spawns no git; the census table is Cadence's own
  const applyCensuses = censusesApply(resolvePath(dir, '..'));

  // `k` is the number in PLAN-<k>.md, and 1 for a bare PLAN.md, same as the executor's report path
  // the phase dir is the caller's own spelling: 1.10 once leased against `phases/1.1/PLAN.md`
  const pdir = join(dir, 'phases', parsedPhase.raw);
  let planFile = join(pdir, `PLAN-${k}.md`);
  let text = read(planFile);
  if (text === null && k === 1) {
    planFile = join(pdir, 'PLAN.md');
    text = read(planFile);
  }
  if (text === null) {
    return fail('no-plan', `no PLAN-${k}.md or PLAN.md under ${pdir}`, `/cad-plan ${parsedPhase.raw}`);
  }
  const { files: declared, issues } = parsePlanFiles(text);
  const frontmatter = issues.length ? { frontmatter_issues: issues } : {};

  // plan-time asks before an executor runs whether the declared work moves a count whose holder the plan never named
  // no git and no staged set on this arm, so it carries no `no-staged-set` rule: that's about the staged side
  // fails closed on a lease it couldn't read: an empty file list looks like nothing at risk, so two signals cover it
  // two reason tokens, not one with a field: execute.md's choose_path reads `frontmatter_issues` and an empty set apart
  // an empty declared set refuses only where a lease exists: `/cad-task` plans have no frontmatter
  if (opts['plan-time']) {
    const planPath = planFile.split(sep).join('/');
    const base = {
      phase: n,
      plan: k,
      plan_file: planPath,
      declared: declared.length,
      ...frontmatter,
    };
    if (issues.length) {
      return emit({
        ok: false,
        reason: 'unparsed-lease',
        ...base,
        hint: `repair ${planPath}'s frontmatter - each entry in frontmatter_issues`
          + ' names a line that could not be read, and the files: list this gate'
          + ' measures is whatever survived it - then re-run this check',
      });
    }
    if (declared.length === 0) {
      return emit({
        ok: false,
        reason: 'empty-lease',
        ...base,
        hint: `declare this plan's files in ${planPath}'s files: list - a missing`
          + ' or misspelled key reads as a lease of nothing, and no census can be'
          + ' measured against nothing - then re-run this check',
      });
    }
    // the census table is Cadence's own: elsewhere it applies to nothing and a readable lease answers ok:true
    const atRisk = applyCensuses ? censusesAtRisk(declared) : [];
    // a clean lease is a pass, not a silence: the caller can tell "ran and found nothing" from "never ran"
    if (!atRisk.length) return ok(base);
    // emitted directly, as with `undeclared-files` below: fail has no channel for the offending list
    return emit({
      ok: false,
      reason: 'census-at-risk',
      ...base,
      censuses_at_risk: atRisk,
      hint: `add these paths to ${planPath}'s files: list and re-run this check`
        + ' - each one holds a count the declared work would move, and declaring'
        + ' it is what lets the executor re-pin the count in the same commit',
    });
  }

  let top;
  /** @type {Buffer} */
  let stagedOut;
  try {
    top = execFileSync('git', ['rev-parse', '--show-toplevel'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    // no `encoding` on this call, on purpose: paths are bytes, and decoding them here would undo -z
    stagedOut = execFileSync('git',
      ['-C', top, 'diff', '--cached', '--name-status', '-z', '-M'],
      { stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    return fail('no-staged-set',
      `could not read the staged set: ${redactUrl(e && e.message ? e.message : String(e))}`,
      'run this from inside the git repository holding the staged commit - the lease is checked'
      + ' against `git diff --cached`, and this gate is not saying the commit is clean');
  }
  const parsed = parseStagedNameStatus(stagedOut);
  if (parsed === null) {
    return fail('no-staged-set',
      'the staged set could not be parsed: git --name-status -z returned a truncated record',
      'inspect what is staged by hand with `git diff --cached --name-status` and compare it against'
      + " the plan's files: list - the gate could not read it, so it is not saying the commit is"
      + ' clean');
  }
  if (parsed.unrepresentable.length) {
    // neither side can spell these bytes, so refuse instead of matching two replacement characters
    return emit({
      ok: false,
      reason: 'unrepresentable-paths',
      phase: n,
      plan: k,
      plan_file: repoRel(top, planFile),
      unrepresentable: parsed.unrepresentable,
      hint: 'these staged paths are not valid UTF-8 and no plan file can name them'
        + ' - rename or unstage them, then re-run',
    });
  }
  // both sides of a rename are checked: the source is the one another plan may have declared
  const staged = [...new Set(parsed.entries.flatMap(
    (e) => (e.source === null ? [e.path] : [e.source, e.path])))];

  // exactly one exemption: the plan's own reports, which the contract has the executor write and no plan declares
  // not a directory lease: the risk diffs sit in the plan dir, and a gate's evidence mustn't ride a task commit
  // two halves: directly in this plan's `reports/` (nested ones stay refused), and a name for this `k`
  // rotation keeps `plan-<k>.md` and `plan-<k>.<n>.md` at once, so a byte-equal match refused the rotated sibling
  const reportsDir = repoRel(top, join(pdir, 'reports'));
  const isOwnReport = (/** @type {string} */ p) => {
    if (!p.startsWith(`${reportsDir}/`)) return false;
    const name = p.slice(reportsDir.length + 1);
    return !name.includes('/') && isReportName(k, name);
  };

  // what a declaration covers is lib/lease-grammar.mjs's answer: a trailing slash is a directory, the rest exact
  // the staged side isn't re-normalized: it arrives canonical through repoRel, and another pass re-breaks non-ASCII
  const undeclared = staged.filter((p) => !isOwnReport(p)
    && !declared.some((d) => covers(d, p)));

  const common = {
    phase: n,
    plan: k,
    plan_file: repoRel(top, planFile),
    staged: staged.length,
    declared: declared.length,
    ...frontmatter,
  };
  // which undeclared paths hold a hand-maintained count, joined by equality and not `covers`: each side is one file
  // two refusals: a path rode a commit, versus a census about to go red, where the remedy is amend and re-pin
  // Cadence's own table again: another project's `tests/trace.test.mjs` stays plain `undeclared-files`
  const holders = new Map((applyCensuses ? CENSUSES : []).map((e) => [e.holder, e]));
  const censusFiles = undeclared.filter((p) => holders.has(p));

  if (undeclared.length) {
    // emitted directly: fail has no channel for the offending list, and the list is the point of the refusal
    if (censusFiles.length) {
      // appended before the envelope, as risk-check does: appendEvent never throws, its `{written, reason}` rides along
      // this arm alone: the append is the distinguishing signal, and the record carries the census identity to join on
      // `phase` is the caller's own spelling, as `trace append --phase` stores it, so the records join
      const res = appendEvent(dir, {
        phase: parsedPhase.raw,
        plan: k,
        family: 'outcome',
        event: 'census_undeclared',
        censuses: censusFiles.map((f) => holders.get(f).id),
      });
      return emit({
        ok: false,
        reason: 'undeclared-census-files',
        ...common,
        undeclared,
        census_files: censusFiles,
        trace: { written: res.written, ...(res.reason ? { reason: res.reason } : {}) },
        hint: `add these paths to ${common.plan_file}'s files: list, or unstage`
          + ' them - the ones under census_files each hold a hand-maintained'
          + ' count this commit moves, so declaring one is also undertaking to'
          + ' re-pin its count in the same commit',
      });
    }
    return emit({
      ok: false,
      reason: 'undeclared-files',
      ...common,
      undeclared,
      hint: `add these paths to ${common.plan_file}'s files: list, or unstage them`,
    });
  }
  ok(common);
}

export { cmdLeaseCheck };
