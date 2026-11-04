// @ts-check
// planning/lease-check.mjs - `lease-check`: the file lease a plan declares, enforced at the commit step
// repoRel, splitNul, quoteRawPath and parseStagedNameStatus are reached from this handler alone, so they travel with it; the lockfile-lease row in prose-agreement.test.mjs reads this file's bytes for the `undeclared-files` reason at its emitting site
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

// a plan's `files:` list is what the parallel-safety gate proves independence from, and nothing stopped an executor staging a path its plan never named, which silently invalidates that proof for every other plan in the phase
// a seam and not a PreToolUse hook on Write/Edit: the hook fires on every write in every project the plugin is installed in and can't reliably tell which plan is writing (the branch name is the only signal, and it's absent on the sequential path and on orchestrator writes). A rail that fires wrong gets deleted, not tuned
// the reader is parsePlanFiles, the one cmdPlanOverlap uses, and containment is lib/lease-grammar.mjs, so a path the overlap gate admitted can't be refused here. That used to be true of the reader alone: the gate compared declared lists by exact string while this step read a trailing slash as a directory prefix, so `src/` in one plan and `src/auth.js` in another passed the gate and were then refused here. declaredPhaseFiles is the wrong reader, since it unions across the phase and would let one plan stage a file only another declared
// an unprovable lease is never a pass: a missing plan, an unreadable staged set and a `files:` list that couldn't be read are all ok:false, because a lease nobody can read licenses nothing and ok:true over it reports a gate that examined an empty list as a gate that found nothing wrong
// the clean-starting-index check isn't here either: only the orchestrator can see a clean index, because it runs once before anything stages anything. This seam reads the whole staged index with no provenance, so it can't tell a path the user staged before the run from one this executor staged undeclared, and a gate here could only refuse the user's work or excuse an unknown path. Start the index clean and every later `undeclared-files` refusal is provably the executor's own doing
// the staged set is read with `--name-status -z -M` and each is load-bearing. -z so git emits paths verbatim and unquoted: at the default `core.quotePath` a declared `src/café.js` comes back as `"src/caf\303\251.js"` and the lease would refuse a path it was handed. --name-status because a rename carries both sides, where `--name-only` reports only the destination, so `git mv src/other.js a.txt` would read as a clean lease while destroying another plan's file. -M explicit, because `diff.renames` is user config and a gate whose coverage depends on the caller's git config is not a gate
// the stream is read as bytes and split on 0x00, because execFileSync with utf8 maps every invalid UTF-8 byte to U+FFFD and undoes -z one layer down: a rename from `src/caf<0xE9>.js` to `src/caf<0xFF>.js` is emitted and paired correctly, then both sides decode to the same string, collapse in the dedup, and the source, another plan's file, is licensed by the destination's declaration
// so every path has to round-trip (`Buffer.from(s,'utf8').equals(raw)`), and one that doesn't is a refusal naming that path and not a guess. The declared side is read from a utf8 plan file and can't represent such a path either, so admitting it on the U+FFFD spelling would license every sibling differing only in its invalid bytes. Making the declared side byte-aware was rejected: the frontmatter reader is shared with the overlap gate and that's a wider change than this gate

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
 * The one honest way to name a path whose bytes no JSON string can carry: C-style double quotes with every byte outside printable ASCII as a three-digit octal escape, the spelling git's own `core.quotePath` uses for high bytes, so `src/caf<0xE9>.js` reads back as `"src/caf\351.js"`.
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
 * The records are NUL-separated fields and not lines: a status starting with `R` (rename) or `C` (copy) consumes two paths, source then destination, and every other status consumes one.
 * The input is a buffer split on the 0x00 byte, since decoding first would fold every invalid UTF-8 byte onto U+FFFD and make two different paths read as one. Each path is decoded and checked to round-trip, and the ones that don't come back under `unrepresentable`, already in their quoteRawPath spelling, for the caller to refuse by name.
 * Returns null on a truncated or unparseable stream, which the caller turns into `no-staged-set`, since an unprovable lease is never a pass.
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
    // a path that didn't round-trip is already recorded under `unrepresentable`, and keeping a U+FFFD spelling in `entries` beside it is the guess this refuses to make
    if (path === null || (rawSource !== null && source === null)) continue;
    entries.push({ path, status, source });
  }
  return { entries, unrepresentable };
}

/**
 * Whether the project root is Cadence's own repository: its `.claude-plugin/plugin.json` parses and names `cadence`. An absent, unreadable or unparsable manifest, or any other name, is false.
 * CENSUSES holds Cadence's own hand-maintained counts, and many of its holders sit under `tests/`, a common path in user projects. Applying the table everywhere would refuse a user's `tests/trace.test.mjs` as a census file, the way the `weight-budgets` row's `agents/` and `skills/` subjects already reached user paths. The check lives here and not in lib/census-registry.mjs, which is pure and leaves file reads to its caller.
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
  // the tree-aware collision check goes before any read of the phase directory, the rail this file already holds that a flag is validated ahead of the work it names (#42, #45). It refuses only when the normalized spelling names a directory that exists here, so `phases/1.10/` stays addressable on a tree with no `phases/1.1/`
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
  // the project root is the parent of the planning directory on both arms, so the plan-time arm still spawns no git; the census table is Cadence's own and applies only when that root is Cadence's repository
  const applyCensuses = censusesApply(resolvePath(dir, '..'));

  // `k` is the number in PLAN-<k>.md, and 1 for a bare PLAN.md, same as the executor's report path
  // the phase directory is the caller's own spelling: a phase spelled 1.10 once leased against `phases/1.1/PLAN.md` and passed a gate the wrong plan file declared. `common.phase` below stays the number
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

  // the plan-time arm asks the same question before an executor runs: not "did this commit stage a path the plan never named" but "will the declared work move a hand-maintained count whose holding file the plan never named". The commit-time arm below catches that too late, with the census already red and the fix a lease amendment mid-run, which has been overridden rather than obeyed before
  // it branches above the execFileSync block so the two arms share nothing below parsePlanFiles. No git call, no staged set, and deliberately no `no-staged-set` fail-closed rule: that's a statement about the staged side, and inheriting it would halt planning in any tree where `git diff --cached` fails, on a condition this arm doesn't measure. repoRel has no input here either, since registry subjects and lease declarations are already repo-relative and planFile comes from the caller's own `--dir`
  // which censuses are at risk is lib/census-registry.mjs's answer and not this function's: the replay in planning-lease-check.test.mjs asks the same predicate once per historical plan without a seam invocation, and a second copy here is how the two readers come to disagree
  // it fails closed on a lease it couldn't read, on two signals, because censusesAtRisk of an empty list is empty by construction and an unread lease looks the same as one that puts nothing at risk, so the gate would answer ok:true precisely when it read nothing. A garbage frontmatter line returns a non-empty file list beside one `unknown-line` issue, while a misspelled `filez:` key is a valid key line that returns an empty list with zero issues, so each signal catches the case the other misses. The frontmatter signal is read first, since it names why the lease couldn't be read
  // two new reason tokens and not one token with a field naming which fired, because execute.md's choose_path already reads `frontmatter_issues` and an empty declared set as separate clauses. Neither existing token fits: the census refusal below is defined by a non-empty `censuses_at_risk`, empty here by construction, and `undeclared-files` is about the staged side this arm never reads
  // refusing an empty declared set isn't a blanket refusal: the plans declaring nothing are `/cad-task` plans with no YAML frontmatter at all, which check_census never runs against
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
    // the census table is Cadence's own: in another project's root it applies to nothing, and a readable lease answers ok:true
    const atRisk = applyCensuses ? censusesAtRisk(declared) : [];
    // a clean lease is a pass and not a silence, so the caller can tell "the check ran and found nothing" from "the check never ran"
    if (!atRisk.length) return ok(base);
    // emitted directly for the same reason as the `undeclared-files` refusal below: fail has no channel for the offending list, and naming each missing file beside what its count counts and where it's asserted is what makes the remedy "declare these" and not "guess"
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
    // no `encoding` on this call, on purpose: paths are bytes, and decoding them here would undo -z (see the comment above)
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
    // fail closed and name the path rather than guess: neither the staged side nor the declared side can spell these bytes, so the gate says so instead of matching two replacement characters
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
  // both sides of a rename are checked: only the destination is the executor's new file, and the source is the one another plan may have declared. `staged` counts distinct paths, so a rename counts as two
  const staged = [...new Set(parsed.entries.flatMap(
    (e) => (e.source === null ? [e.path] : [e.source, e.path])))];

  // exactly one exemption, the plan's own reports, which the contract requires the executor to write and no plan declares
  // it used to be one name by byte equality, right while a plan had one report. Since rotation (#195) an executor holds `plan-<k>.md` and `plan-<k>.<n>.md` at once, so a re-run staging the rotated sibling during a task commit was refused `undeclared-files`, blocking the executor for obeying its own contract
  // not a directory lease, and that distinction is the whole bound: `plan-<k>-risk.diff` and `plan-<k>-risk-task-<n>.diff` live in the same directory, and a risk_surface checkpoint deliberately leaves flagged changes staged, so a directory exemption would let a blocking gate's own evidence ride into a task commit unnamed. The test is two halves: the path sits directly in this plan directory's `reports/` (a further separator disqualifies it, so a nested `reports/old/plan-1.1.md` stays refused), and its final component is a name for this `k`
  // which names those are is lib/report-rotation.mjs's answer and not this function's, since a second copy is how the rename picker ends up minting a name this gate then refuses
  const reportsDir = repoRel(top, join(pdir, 'reports'));
  const isOwnReport = (/** @type {string} */ p) => {
    if (!p.startsWith(`${reportsDir}/`)) return false;
    const name = p.slice(reportsDir.length + 1);
    return !name.includes('/') && isReportName(k, name);
  };

  // what a declaration covers is lib/lease-grammar.mjs's answer, the same module cmdPlanOverlap asks: a directory lease is a trailing slash, everything else is byte-identical, and `src/auth` must never license `src/authority.rs`. A second copy here is how the two seams came to disagree
  // the staged side is not re-normalized on its way in: it arrives canonical through repoRel, and a second transform over paths that round-tripped through the byte-level guard above is how the non-ASCII hard block gets re-broken
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
  // which of the undeclared paths hold a hand-maintained count, joined on the holding file by equality and not through `covers`: a staged path is one file and a holder is one file, so neither side has a directory lease to interpret
  // the split is what separates the two refusals: an ordinary `undeclared-files` says a path rode a commit its plan never named, this one says the path is where a count lives, so the commit is about to leave a census red with no plan naming the file that would re-pin it. The remedy differs too (amend the lease and re-pin in the same commit), and a caller can't act on a difference the envelope doesn't carry
  // Cadence's own table again: another project's `tests/trace.test.mjs` is refused as plain `undeclared-files` and appends no `census_undeclared`
  const holders = new Map((applyCensuses ? CENSUSES : []).map((e) => [e.holder, e]));
  const censusFiles = undeclared.filter((p) => holders.has(p));

  if (undeclared.length) {
    // emitted directly: fail's reason/detail/hint shape has no channel for the offending list, and the list is the point of the refusal
    if (censusFiles.length) {
      // appended before the envelope is emitted, the way risk-check does: appendEvent never throws and never speaks, its `{written, reason}` rides the envelope so an unwritten trace is reported, and it can't change the verdict
      // on this arm alone, not the ordinary `undeclared-files` arm and not the plan-time arm: the append is the distinguishing signal, and widening it to every refusal destroys the distinction. The record carries the census identity, which a later reader joins on, and the envelope carries the file list and the hint, which the caller in front of the refusal acts on
      // `phase` is the caller's own spelling, as a prose `trace append --phase` stores it, since the two must be one string or the records don't join
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
