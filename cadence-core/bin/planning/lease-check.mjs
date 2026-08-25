// @ts-check
// planning/lease-check.mjs - `lease-check`: the file lease a plan DECLARES,
// enforced at the commit step.
//
// The four git-porcelain readers below - `repoRel`, `splitNul`, `quoteRawPath`
// and `parseStagedNameStatus` - are reached from this handler alone, so they
// travel with it (D-05). `prose-agreement.test.mjs`'s lockfile-lease row reads
// THIS file's source bytes for the `undeclared-files` reason, at its emitting
// site: the reason lives here now, and the assertion follows it rather than
// widening to a search over the tree.
'use strict';

import { execFileSync } from 'node:child_process';
import { join, relative, resolve as resolvePath, sep } from 'node:path';
import { fail, ok, read } from './core.mjs';
import { CENSUSES, censusesAtRisk } from '../lib/census-registry.mjs';
import { covers } from '../lib/lease-grammar.mjs';
import { parsePlanFiles } from '../lib/planning-files.mjs';
import { redactUrl } from '../lib/redact-url.mjs';
import { isReportName } from '../lib/report-rotation.mjs';
import { requireInt, requirePhaseArg } from '../lib/require-int.mjs';
import { appendEvent } from '../lib/trace.mjs';
import { emit } from '../lib/seam-io.mjs';

// ---------------------------------------------------------------------------
// lease-check - the file lease Cadence already DECLARES, enforced. A plan's
// `files:` list is what the parallel-safety gate proves independence from, and
// until now nothing stopped an executor staging a path its own plan never
// named - which silently invalidates that proof for every OTHER plan in the
// phase.
//
// A seam and NOT a PreToolUse hook on Write/Edit (D-01): the hook fires on
// every write in every project the plugin is installed in, and it cannot
// reliably resolve WHICH plan is writing - the branch name is the only signal
// and it is absent on the sequential path and on orchestrator writes. A rail
// that fires wrong gets deleted, not tuned. The seam form covers the sequential
// path too, which the criterion does not require but gets free.
//
// The reader is `parsePlanFiles`, the SAME one cmdPlanOverlap uses, and
// containment is `lib/lease-grammar.mjs`, the same module it asks - so a path
// the pre-flight overlap gate admitted cannot be refused here and vice versa.
// That claim used to be made of the READER alone, and it was false of the
// comparison: the gate intersected two declared lists by exact string equality
// while this step read a trailing slash as a directory prefix, so a phase
// declaring `src/` in one plan and `src/auth.js` in another passed the
// parallel-safety gate and was then refused right here. One module makes it
// true of both halves.
// `declaredPhaseFiles` is the wrong reader: it unions across the PHASE, which
// would let plan 2 stage a file only plan 1 declared.
//
// An unprovable lease is never a pass: a missing plan and an unreadable staged
// set are both ok:false.
//
// Why the CLEAN-STARTING-INDEX check is not here either (moved out of
// `workflows/execute.md`'s git_guard step, v2.6.2): the orchestrator is the only
// actor that can see a clean starting index, because it runs once before
// anything stages anything. This seam reads the whole staged index and has no
// provenance signal - it cannot tell a path the user staged before the run from
// a path this executor staged and did not declare - so a gate placed here could
// only refuse the user's work (halting the phase on files no plan touched) or
// excuse an unknown path (which is no gate). Start the index clean and both
// readings collapse into one: every later `undeclared-files` refusal is provably
// the executor's own doing.
//
// The staged set is read with `--name-status -z -M`, and each of those three is
// load-bearing:
//   -z          git emits paths VERBATIM and unquoted. Without it, at git's
//               default `core.quotePath` a declared `src/café.js` comes back as
//               `"src/caf\303\251.js"` and the lease refuses a path it was
//               itself handed. No `core.quotePath` override is needed, and none
//               should be added.
//   --name-status  a rename carries BOTH sides. `--name-only` reports only the
//               destination, so `git mv src/other.js a.txt` reads as a clean
//               lease while destroying a file some OTHER plan declared.
//   -M          explicit, because `diff.renames` is user-settable config and a
//               gate whose coverage depends on the caller's git config is not a
//               gate.
//
// That stream is read as BYTES and split on 0x00 at the byte level, because
// `execFileSync(..., {encoding:'utf8'})` maps every invalid UTF-8 byte to
// U+FFFD and undoes `-z` one layer below it: `git mv src/caf<0xE9>.js
// src/caf<0xFF>.js` is emitted correctly and paired correctly, then both sides
// decode to the SAME `src/caf<U+FFFD>.js`, collapse in the dedup, and the
// rename source - another plan's file, being destroyed - is licensed by the
// destination's declaration.
//
// So every path must ROUND-TRIP (`Buffer.from(s,'utf8').equals(raw)`), and a
// staged path that does not is a REFUSAL of its own naming that path, not a
// guess. The declared side is read from a utf8 plan file and cannot represent
// such a path either, so neither side of the comparison can be honest about it;
// admitting it on the U+FFFD spelling would silently license every sibling
// differing only in its invalid bytes. Making the DECLARED side byte-aware was
// rejected: the frontmatter reader is shared with the overlap gate, and a lease
// that reads what a plan file cannot write is a wider change than this gate.
// ---------------------------------------------------------------------------

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
 * The one honest way to NAME a path whose bytes no JSON string can carry:
 * C-style double quotes with every byte outside printable ASCII written as a
 * three-digit octal escape, the same spelling git's own `core.quotePath` uses
 * for high bytes - so `src/caf<0xE9>.js` reads back as `"src/caf\351.js"`.
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
 *
 * Records are NUL-separated fields, not NUL-separated LINES: a status token
 * starting with `R` (rename) or `C` (copy) consumes TWO following paths, source
 * then destination; every other status consumes one.
 *
 * The input is a BUFFER and the split is on the 0x00 BYTE: decoding first would
 * fold every invalid UTF-8 byte onto U+FFFD and make two different paths read
 * as one. Each path is decoded and checked to round-trip back to the same
 * bytes; the ones that do not are returned under `unrepresentable`, already in
 * their `quoteRawPath` spelling, for the caller to refuse by name.
 *
 * Returns null on a truncated or otherwise unparseable stream, which the caller
 * turns into `no-staged-set` - an unprovable lease is never a pass.
 *
 * @param {Buffer} out
 * @returns {{
 *   entries: {path: string, status: string, source: string|null}[],
 *   unrepresentable: string[],
 * } | null}
 */
function parseStagedNameStatus(out) {
  const fields = splitNul(out);
  // A -z stream terminates every field with a NUL, so the tail split is empty.
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
    // A path that did not round-trip is already recorded under
    // `unrepresentable`; keeping a U+FFFD spelling in `entries` beside it is
    // exactly the guess this refuses to make.
    if (path === null || (rawSource !== null && source === null)) continue;
    entries.push({ path, status, source });
  }
  return { entries, unrepresentable };
}

function cmdLeaseCheck(dir, opts) {
  const parsedPhase = requirePhaseArg(opts.phase);
  if (!parsedPhase.ok) {
    return fail('bad-args', 'lease-check needs --phase <N>',
      'pass --phase <N> for the phase the plan being committed belongs to, then re-run');
  }
  const parsedPlan = requireInt(opts.plan);
  if (!parsedPlan.ok) {
    return fail('bad-args', 'lease-check needs --plan <k>',
      'pass --plan <k>, the number in PLAN-<k>.md - 1 for a bare PLAN.md - then re-run');
  }
  const n = parsedPhase.value;
  const k = parsedPlan.value;

  // `k` is the number in PLAN-<k>.md, and 1 for a bare PLAN.md - the same
  // convention the executor's report path follows.
  //
  // The phase DIRECTORY is the caller's own spelling (D-02): `--phase 1.10`
  // leased against `phases/1.1/PLAN.md` and passed a gate the wrong plan file
  // declared. `common.phase` below stays the number.
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

  // --- the PLAN-TIME arm (CEN-02) ------------------------------------------
  //
  // The same question asked BEFORE an executor runs: not "did this commit stage
  // a path the plan never named" but "will the declared work move a
  // hand-maintained count whose holding file the plan never named". The commit
  // -time arm below catches that too late - by then the census is already red
  // and the fix is a lease amendment mid-run, which
  // `.planning/_archive-v3.7.1` records being overridden rather than obeyed
  // twice.
  //
  // It branches HERE, above the `execFileSync` block, so the two arms share
  // nothing below `parsePlanFiles` (D-11). No `git` call, no staged set, and
  // deliberately NO `no-staged-set` fail-closed rule: that rule is a statement
  // about the STAGED side, and inheriting it would halt planning in any tree
  // where `git diff --cached` fails, on a condition this arm does not measure.
  // `repoRel` has no input here either - registry subjects and lease
  // declarations are both already repo-relative strings, and `planFile` is
  // built from the caller's own `--dir`, so the plan file is named by
  // separator-normalizing that path rather than by resolving a toplevel.
  //
  // Which censuses are at risk is `lib/census-registry.mjs`'s answer and not
  // this function's, for the reason the `covers` block below states about
  // `lib/lease-grammar.mjs`: the replay in `planning-lease-check.test.mjs` asks
  // the same predicate once per historical plan without a seam invocation, and
  // a second copy here is how the two readers come to disagree.
  if (opts['plan-time']) {
    const planPath = planFile.split(sep).join('/');
    const atRisk = censusesAtRisk(declared);
    const base = {
      phase: n,
      plan: k,
      plan_file: planPath,
      declared: declared.length,
      ...frontmatter,
    };
    // A clean lease is a PASS and not a silence: the caller needs to be able to
    // tell "the check ran and found nothing" from "the check never ran".
    if (!atRisk.length) return ok(base);
    // Emitted directly for the reason the `undeclared-files` refusal below is:
    // `fail()`'s reason/detail/hint shape has no channel for the offending
    // list, and naming each missing FILE beside what its count counts and where
    // it is asserted is the whole point - it is what makes the remedy "declare
    // these" rather than "guess".
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
    // NO `encoding` on THIS call, deliberately: paths are bytes, and decoding
    // them here is what would undo `-z` (see the block comment above).
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
    // Fail CLOSED, and name the path rather than guess at it: neither the
    // staged side nor the declared side can spell these bytes, so the gate says
    // so instead of matching two replacement characters.
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
  // BOTH sides of a rename are checked: only the destination is the executor's
  // new file, and the SOURCE is the one another plan may have declared.
  // `staged` counts the distinct paths involved, so a rename counts as two.
  const staged = [...new Set(parsed.entries.flatMap(
    (e) => (e.source === null ? [e.path] : [e.source, e.path])))];

  // Exactly ONE exemption, and nothing else: the plan's own REPORTS, which the
  // contract requires the executor to write and which no plan declares.
  //
  // It used to be one name by byte equality, and that was correct while a plan
  // had exactly one report. Since rotation (#195) an executor holds
  // `plan-<k>.md` and `plan-<k>.<n>.md` at once - it renames the previous run's
  // record aside before its first write - so a re-run staging the rotated
  // sibling during a task commit was refused `undeclared-files`, blocking the
  // executor for obeying its own contract.
  //
  // NOT a directory lease, and the distinction is the whole bound (D-06).
  // `plan-<k>-risk.diff` and `plan-<k>-risk-task-<n>.diff` live in this same
  // directory, and a `risk_surface` checkpoint deliberately leaves flagged
  // changes staged: a directory exemption would let a blocking gate's own
  // evidence ride into a task commit unnamed. So the test is two halves - the
  // path sits DIRECTLY in this plan directory's `reports/` (a further separator
  // disqualifies it, so a nested `reports/old/plan-1.1.md` no executor writes
  // stays refused), and its final component is a name for THIS `k`.
  //
  // Which names those are is `lib/report-rotation.mjs`'s answer and not this
  // function's, for the reason the `covers` block below states: a second copy
  // here is exactly how two seams come to disagree, and the disagreement
  // available here is the rename picker minting a name this gate then refuses.
  const reportsDir = repoRel(top, join(pdir, 'reports'));
  const isOwnReport = (/** @type {string} */ p) => {
    if (!p.startsWith(`${reportsDir}/`)) return false;
    const name = p.slice(reportsDir.length + 1);
    return !name.includes('/') && isReportName(k, name);
  };

  // What a declaration covers is `lib/lease-grammar.mjs`'s answer and not this
  // function's - the same module `cmdPlanOverlap` asks, which is the whole
  // point. The grammar itself (directory lease by trailing slash, everything
  // else byte-identical, and why `src/auth` must never license
  // `src/authority.rs`) is stated in that module's header, once: a second copy
  // here is exactly how the two seams came to disagree, with the pre-flight
  // gate admitting a plan pair this step then refused to separate.
  //
  // The staged side is NOT re-normalized on its way in (D-08): it arrives
  // canonical through `repoRel`, and a second transform over paths that
  // round-tripped through the byte-level guard above is how the non-ASCII hard
  // block gets re-broken.
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
  // Which of the undeclared paths HOLD a hand-maintained count (CEN-02).
  // Joined on the holding file by equality and not through `covers`: a staged
  // path is one file and a holder is one file, so there is no directory lease
  // on either side of this join to interpret.
  //
  // The split is what makes criterion 6's distinction real. An ordinary
  // `undeclared-files` refusal says a path rode a commit its plan never named;
  // this one says the same path is where a count LIVES, so the commit is about
  // to leave a census red with no plan naming the file that would re-pin it.
  // The remedy differs too - amend the lease AND re-pin in the same commit -
  // and a caller cannot act on a difference the envelope does not carry.
  const holders = new Map(CENSUSES.map((e) => [e.holder, e]));
  const censusFiles = undeclared.filter((p) => holders.has(p));

  if (undeclared.length) {
    // Emitted directly: fail()'s reason/detail/hint shape has no channel for
    // the offending list, and the list is the whole point of the refusal.
    if (censusFiles.length) {
      // Appended BEFORE the envelope is emitted, on the `planning/risk-check.mjs`
      // pattern: `appendEvent` never throws and never speaks, its
      // `{written, reason}` rides the envelope so a trace that could not be
      // written is reported rather than silently dropped, and it may NOT change
      // the verdict.
      //
      // On THIS arm alone. Not on the ordinary `undeclared-files` arm and not
      // on the plan-time arm: the append IS the distinguishing signal, and
      // widening it to every refusal destroys the distinction it exists to
      // draw. The record and the envelope carry DIFFERENT halves - the record
      // carries the census IDENTITY, which is what a later reader joins on, and
      // the envelope carries the file list and the hint, which is what the
      // caller in front of the refusal has to act on.
      //
      // `phase` is the caller's OWN spelling, verbatim, the way a prose `trace
      // append --phase` stores it: the two must be one string or the records
      // do not join.
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
