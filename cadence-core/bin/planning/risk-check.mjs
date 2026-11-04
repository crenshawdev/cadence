// @ts-check
// planning/risk-check.mjs - the `risk-check` family: the detection the blocking `risk_surface` gate fires on, and the record that proves it ran
// all three handlers live here because cmdRiskCheck calls cmdRiskCheckRun and cmdRiskCheckStatus, the only handler-to-handler call edges left from the single-file days
// surfaceVocabulary, RISK_TRIGGER, FIRE_RECEIPTS and REVIEWER_TEXT_PATHSPECS are read by this family and nothing else; the last is exported so the suite drives off the same list the read uses
// the merge call in cmdRiskCheckRun destructures `warnings` and carries it into the envelope, so the merge-warnings rule needs no header marker
'use strict';

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import {
  RISK_DIFF_MAX_BUFFER, fail, ok, planKey, resolveIndex, resolveRange, resolveRef, riskRef,
  routeLadder,
} from './core.mjs';
import { isPlainObject, mergeLayers } from '../lib/config-merge.mjs';
import { requirePlanKey } from '../lib/plan-key.mjs';
import { redactUrl } from '../lib/redact-url.mjs';
import { requirePhaseArg } from '../lib/require-int.mjs';
import { scanDiff } from '../lib/risk-diff.mjs';
import { emit } from '../lib/seam-io.mjs';
import { CATEGORIES, answeredSurfaces } from '../lib/surface-scan.mjs';
import { appendEvent, renderTrace } from '../lib/trace.mjs';

/**
 * The risk-surface vocabulary `config.schema.json` states, the same list route.mjs hands answeredSurfaces.
 * Read here so the seam that refuses on the surface question and the resolve that reports it can't disagree on what a valid answer is: reading CATEGORIES instead would accept a value route.mjs rejected and narrow a blocking gate to a scope nobody chose.
 * An unreadable or malformed table falls back to the eight, because no vocabulary at all would read every configured answer as invalid and refuse every call.
 * @returns {readonly string[]}
 */
function surfaceVocabulary() {
  return routeLadder('risk_surface_categories') || CATEGORIES;
}

/**
 * The four `.planning/phases/` artifacts the range read withholds, as git pathspecs that go after the `git diff` revision separator.
 * Each stores reviewer text verbatim, so a docs commit landing a finding that quotes a destructive command re-tripped the gate that found it, and the user had to override a gate to file what the gate told them.
 * It's a pathspec and not an exemption in scanDiff because scanDiff reads hunks, where a match is a line someone added, and its rule is that the fix goes at the mention and never at a path. A plan file under the same directory stays scanned, since its Action is text an executor is handed to run.
 * A range whose changed files are all withheld reads `empty: true` and still clears as a completed check; a second unexcluded diff to keep `empty` narrower would double the read on every fire.
 * `:(top,exclude)` in long form on purpose: `top` anchors at the repo root and not the cwd, and the `:!` shorthand doesn't say which two magics are in play.
 * Exported so the suite drives off this list and not a second spelling of it.
 * @type {readonly string[]}
 */
const REVIEWER_TEXT_PATHSPECS = Object.freeze([
  ':(top,exclude).planning/phases/*/ADJUDICATION-*.json',
  ':(top,exclude).planning/phases/*/REVIEW-*.md',
  ':(top,exclude).planning/phases/*/FINDINGS.json',
  ':(top,exclude).planning/phases/*/verifier-findings.json',
]);

// the check used to be prose telling a model to scan a diff, and a non-match wrote nothing, so a skipped check looked the same as a clean one
// run records on every invocation past argument validation, the no-match and git-failure paths included, and status refuses a phase holding a completed executor range with no record

function cmdRiskCheckRun(dir, opts) {
  const parsedPhase = requirePhaseArg(opts.phase);
  if (!parsedPhase.ok) {
    return fail('bad-args', 'risk-check run needs --phase <N>',
      'pass --phase <N> for the phase whose committed range is being checked, then re-run');
  }
  const n = parsedPhase.value;

  // the worker key goes through the one grammar both faces read, and not requireInt: status derives keys from lifecycle brackets, which allow a non-numeric key like `1-fix`, and a key like `1-fix` used to answer bad-args from run, leaving a blocking gate no argv could satisfy
  // a valueless flag arrives as boolean true and Number(true) is 1, so the predicate refuses a non-string first
  let plan;
  if ('plan' in opts) {
    const parsedPlan = requirePlanKey(opts.plan);
    if (!parsedPlan.ok) {
      return fail('bad-args', 'risk-check run --plan needs the worker key after it - a plan number '
        + 'or the key the dispatch was bracketed under (`1-fix`): --plan <k>',
      'send the key this dispatch was bracketed under - the number for PLAN-<k>.md, or the'
      + ' non-numeric key a fix pass used - then re-run');
    }
    plan = parsedPlan.key;
  }

  // one machine spelling per scope: a committed range is `--base <ref> --head <ref>`, the staged scope (the index against a base) is `--base <ref> --staged`
  // neither end is ever defaulted, because a defaulted head is a range the caller never stated and this record is the evidence of what was checked
  // `--staged` is read by presence like `opts['plan-time']` in cmdLeaseCheck: it carries no value, so the arg contract declares it boolean with a fallback on both axes
  const base = riskRef(opts.base);
  const head = riskRef(opts.head);
  const staged = 'staged' in opts;
  // both spellings of one scope is a malformed call and not a precedence question: picking one would answer about a scope the caller didn't ask for, on a gate that defaults to blocking
  // it tests `'head' in opts` and not the validated head, so a flag-shaped `--head` next to `--staged` is refused and not silently dropped
  if ('head' in opts && staged) {
    return fail('bad-args',
      'risk-check run takes --head <ref> or --staged, never both - they are two spellings of one'
      + ' scope',
      'drop whichever one this check does not cover - --head <ref> for a committed range, --staged'
      + ' for the index against --base - then re-run this check');
  }
  if (!base || (!head && !staged)) {
    return fail('bad-args',
      'risk-check run needs --base <ref> and then one of --head <ref> or --staged, with neither'
      + ' ref opening with `-`',
      'name the scope this check covers - --head <ref> for a committed range, or --staged for the'
      + ' index against --base - then re-run this check');
  }

  // mergeLayers warnings[]: a layer that didn't parse is refused here whatever the caller passed, since this envelope is the surfacing and the detail names what tore
  // it sits ahead of the --surfaces branch so a torn layer that only an unflagged call noticed can't be stepped around with a flag
  const { config: surfaceConfig, warnings: surfaceWarnings } = mergeLayers(join(dir, 'config.json'));
  if (surfaceWarnings.length) {
    return fail('surfaces-unanswered',
      `a config layer did not parse, so the surface question cannot be read as answered: ${surfaceWarnings.join('; ')}`,
      'repair the config layer the detail names so it parses as JSON, then re-run - this gate is'
      + ' blocking and there is no arm that proceeds while the answer cannot be read');
  }
  const surfaceTriggers = isPlainObject(surfaceConfig.review)
    && isPlainObject(surfaceConfig.review.triggers) ? surfaceConfig.review.triggers : {};
  const wrote = isPlainObject(surfaceTriggers.risk_surface)
    ? surfaceTriggers.risk_surface.surfaces : undefined;

  let categories = [...CATEGORIES];
  if ('surfaces' in opts) {
    const raw = typeof opts.surfaces === 'string' ? opts.surfaces : '';
    const tokens = raw.split(',').map((t) => t.trim()).filter(Boolean);
    if (!tokens.length) {
      return fail('bad-args', 'risk-check run --surfaces needs a comma-separated list after it: --surfaces <a,b,c>',
        "list this run's scope as one comma-separated value, or drop --surfaces to use the set the"
        + ' project already answered');
    }
    // a token outside the eight is a malformed call, refused with nothing appended (same rule as trace append --tokens): a mistyped scope on a blocking gate has to see a refusal and not a narrowed clean answer
    const unknown = tokens.filter((t) => !CATEGORIES.includes(t));
    if (unknown.length) {
      return fail('bad-args',
        `risk-check run --surfaces names ${unknown.join(', ')}, which is not one of ${CATEGORIES.join(', ')}`,
        'correct the token(s) the detail names against the list beside them, then re-run - dropping'
        + ' one instead would narrow a blocking gate to a scope nobody chose');
    }
    categories = [...new Set(tokens)];
  } else {
    // references/review-triggers.md says a risk_surface fire whose resolve reports `surfaces_answered: false` doesn't go on to detection until the project has answered, and nothing enforced it: detection is this subcommand, so an unanswered project looked identical to an answered one
    // a caller that named --surfaces already resolved the scope; the refusal is for the one that let the default stand, which is the all-eight set nobody chose
    // detail names the two commands that settle it, since detect-surfaces has no other caller in the tree
    const decided = answeredSurfaces(wrote, surfaceVocabulary());
    if (!decided.answered) {
      return fail('surfaces-unanswered',
        'no config layer answered review.triggers.risk_surface.surfaces, so detection would run '
        + `on the ${CATEGORIES.length} categories nobody chose. Run \`detect-surfaces --root .\` `
        + 'and put the choice to the user (references/review-triggers.md), or pass '
        + '--surfaces <a,b,c> to state this run\'s scope explicitly',
        'do one of the two the detail names: put the question to the user and save the answer at'
        + ' review.triggers.risk_surface.surfaces, or pass --surfaces for this run alone. Answering'
        + ' it is what clears this gate - there is no arm that skips the scan');
    }
    categories = [...new Set(decided.surfaces)];
  }

  let body = null;
  let diffError = null;
  // the ids the caller's refs name, resolved before anything is read: they're the record's range identity, and status compares them and not the spellings
  // the end that resolved is kept when the other fails, so a record from a mistyped ref can still say which commit the good end named; resolveRange returns '' for the end git couldn't name, so only the failing end goes null
  let baseId = null;
  let headId = null;
  /** the staged scope's second end, null on every ref range: the index has no commit id, so `git write-tree` names it instead
   * @type {string|null} */
  let indexId = null;
  /**
  /**
   * The `git diff` argv this scope names, or null when the scope didn't resolve and there's nothing to read.
   * Built per arm and read once below so the two scopes share one catch, which is also what holds the `planning-detail-sites` census where it stands.
   * `-C top` so the read is the repository's and not the cwd's, the resolved ids and not the spellings so the body is exactly the scope recorded, and the trailing `--` so a ref that also names a path can't turn into a pathspec. REVIEWER_TEXT_PATHSPECS goes after it for the same reason.
   * `--no-ext-diff --no-textconv` because a `diff=<driver>` attribute in a cloned repo can route the read through a helper in the reader's own git config that prints nothing and exits 0, and scanDiff would then answer a completed clear on a recursive delete. Neither flag changes an id, a range or an exit status.
   * @type {string[] | null}
   */
  let diffArgs = null;
  if (staged) {
    // the staged arm sits before resolveRange so that function never learns a staged spelling and nothing but a rev passes riskRef; the index isn't a commit, so a stand-in head would be a range nobody asked about
    // resolveRef is the single-ref half resolveRange is built on, so both arms resolve a ref through one function and one refusal vocabulary
    // the scope is the index against the base: a file in the worktree and never added is outside it, which is the point, since the gate fires before the commit lands and has to judge what's about to be committed
    // the diff names the index by the tree object write-tree returned and not by `--cached`, for the reason below
    const b = resolveRef('base', base);
    baseId = b.id || null;
    if (!b.ok) diffError = b.error;
    else {
      // the index's identity is taken before the body is read and is the scope's other end: a staged record keyed by the base alone was satisfiable by any later index over that base, so a risky change staged after the run cleared the gate unscanned
      // the body is read from that same tree object and never from `--cached`: two git calls against the live index leave a window where a swapped-and-restored index would record this id against a body that scanned something else. An index that moves after write-tree is just a different tree, and the next status ask reports `stale`
      // an index git can't name fails like an unresolvable ref, with no read, a `no-diff` refusal and the cause on the row, because a staged record without this id could never be matched later
      const ix = resolveIndex(b.top);
      indexId = ix.id || null;
      if (!ix.ok) diffError = ix.error;
      else {
        diffArgs = ['-C', b.top, 'diff', '--no-ext-diff', '--no-textconv', b.id, ix.id, '--',
          ...REVIEWER_TEXT_PATHSPECS];
      }
    }
  } else {
    const range = resolveRange(base, head);
    baseId = range.base || null;
    headId = range.head || null;
    if (!range.ok) diffError = range.error;
    else {
      diffArgs = ['-C', range.top, 'diff', '--no-ext-diff', '--no-textconv', baseId, headId, '--',
        ...REVIEWER_TEXT_PATHSPECS];
    }
  }
  if (diffArgs) {
    try {
      body = execFileSync('git', diffArgs,
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: RISK_DIFF_MAX_BUFFER });
    } catch (e) {
      // redacted like cmdLeaseCheck's no-staged-set detail, since a git failure can carry a remote URL with credentials
      diffError = redactUrl(e && e.message ? e.message : String(e));
    }
  }

  const scan = scanDiff(body, categories);

  // appended before the envelope and on every path past argument validation, refusals included, so the record says the check was attempted; appendEvent never throws, and its written/reason rides the envelope so an unwritten trace is reported, but it can't change the verdict
  // `plan` is the caller's own spelling, as `trace append --plan` stores it: the two have to be one string or the receipt settles nothing, and status stringifies both sides before comparing so `1` and `"1"` still join
  const res = appendEvent(dir, {
    phase: parsedPhase.raw,
    family: 'outcome',
    event: 'risk_check',
    ...(plan === undefined ? {} : { plan }),
    // both spellings and both ids, written even when null, so a run that resolved nothing is visibly unidentifiable and not just missing a field
    base,
    // null on the staged arm, spelling and id: the index isn't a commit, and writing the caller's absent flag as `undefined` would drop the field a reader checks
    head: staged ? null : head,
    base_id: baseId,
    head_id: headId,
    // only the staged arm carries these: a ref-range row from before this arm is honestly not staged, so absent and `false` would say the same thing. index_id rides the same spread, since a ref range has no index end
    // written even when null on this arm, like the two ids above, so a staged record the gate can never match says so
    ...(staged ? { staged: true, index_id: indexId } : {}),
    checked: scan.checked,
    categories: scan.categories,
    // tokens on the record, `{category, signal}` pairs on the envelope: the record is joined and counted, the envelope is read by the fire site that has to state a reason
    matches: scan.matches.map((m) => m.category),
    inconclusive: scan.inconclusive,
    // the range was read and held nothing, which is a completed check and not an unchecked one; it goes on the record and the envelope both so a later status and the coordinator can't disagree
    empty: scan.empty,
    // the cause goes on the row and not on the envelope alone: both failure arms used to append a bare `checked: false, inconclusive: true`, so a trace reader saw an inconclusive it could proceed past and nothing said why the range was never read
    // `detail` is the free-text cause field trace rows already carry, and this is the same redacted string the envelope emits. A run that read its range adds nothing
    ...(diffError === null ? {} : { detail: diffError }),
  });

  const envelope = {
    phase: n,
    ...(plan === undefined ? {} : { plan }),
    base,
    head: staged ? null : head,
    base_id: baseId,
    head_id: headId,
    ...(staged ? { staged: true, index_id: indexId } : {}),
    checked: scan.checked,
    categories: scan.categories,
    matches: scan.matches,
    inconclusive: scan.inconclusive,
    empty: scan.empty,
    trace: { written: res.written, ...(res.reason ? { reason: res.reason } : {}) },
  };

  // a range that couldn't be read is never ok, so a caller can't take "git refused" for "clean"
  if (diffError !== null) {
    return emit({ ok: false, reason: 'no-diff', detail: diffError, ...envelope,
      hint: staged
        ? 'name a --base this repository can resolve, then re-run this check - git could not read'
          + ' the index against it, so nothing here says the staged change is clean'
        : 'name a --base and --head this repository can resolve, then re-run this check - git'
          + ' could not read the range, so nothing here says the diff is clean' });
  }
  return ok(envelope);
}

/** The trigger a risk receipt has to name; the detector and the gate that fires on it are one trigger, and a second spelling is how the two halves start clearing each other. */
const RISK_TRIGGER = 'risk_surface';
/** The outcome event a caller appends in place of a check for a plan that landed no commits. status reads it so that row is `skipped` and not `missing`; the sites that write it are named on the `skips` map in cmdRiskCheckStatus. */
const RISK_SKIP_EVENT = 'risk_check_skipped';

/**
/**
 * The five `outcome` event names a risk_surface fire can settle at, and everything `risk-check status` accepts as proof the fire happened:
 *   - `adjudication` - the adjudicated arm reported its survivors
 *   - `rearm`        - the one-round re-arm fired a narrowed second round
 *   - `gate_pass`    - the fire came back with nothing blocker/high
 *   - `override`     - the user cleared a FAIL deliberately, reason on file
 *   - `deferral`     - a gate resolved `deferred` queued what it found
 * `gate_pass` is here because a clean pass wrote nothing, so every matched range whose fire found no blocker would be unclearable, and an unclearable gate is one that gets bypassed.
 * `deferral` can't borrow another name: `gate_pass` reads as a clean gate in every recount, and `override` is the coordinator's own say-so, the manufactured clear the receipt machinery exists to refuse. Without a receipt of its own the range reports `unfired` forever and the run halts at the step deferring was meant to let through.
 * The producers are references/triage-gate.md and references/review-triggers.md.
 */
const FIRE_RECEIPTS = ['adjudication', 'rearm', 'gate_pass', 'override', 'deferral'];

function cmdRiskCheckStatus(dir, opts) {
  const parsedPhase = requirePhaseArg(opts.phase);
  if (!parsedPhase.ok) {
    return fail('bad-args', 'risk-check status needs --phase <N>',
      'pass --phase <N> for the phase whose fires are being reported, then re-run');
  }
  const n = parsedPhase.value;

  // a named range is all of it or none of it: a plan number alone isn't a range identity, and a partly named one would read as the phase-wide arm and pass on a record some other range left
  // all of it is `--plan <k> --base <ref>` plus exactly one scope, `--head <ref>` for a committed range or `--staged` for the index; run records a staged scope, so status has to be able to ask about one or a staged run would be written and never found
  const given = ['plan', 'base', 'head', 'staged'].filter((f) => f in opts);
  const staged = 'staged' in opts;
  /** @type {{plan: string, base: string, head: string|null, base_id: string,
   *   head_id: string|null, staged?: boolean, index_id?: string|null} | null} */
  let wanted = null;
  if (given.length) {
    const scopes = ['head', 'staged'].filter((f) => f in opts);
    if (!('plan' in opts) || !('base' in opts) || scopes.length !== 1) {
      return fail('bad-args',
        'risk-check status takes --plan <k> --base <ref> and exactly one of --head <ref> or'
        + ' --staged, or none of the four',
        'send --plan and --base with ONE scope - --head <ref> for a committed range, --staged for'
        + ' the index against --base - or none of them for the phase-wide answer; a half-named'
        + ' range would report on a record some other range left');
    }
    // the same predicate risk-check run reads, so the face that enforces the question and the face that reports it can't disagree about which spellings are keys
    const parsedPlan = requirePlanKey(opts.plan);
    if (!parsedPlan.ok) {
      return fail('bad-args', 'risk-check status --plan needs the worker key after it - a plan '
        + 'number or the key the dispatch was bracketed under (`1-fix`): --plan <k>',
      'send the key the dispatch was bracketed under - the number for PLAN-<k>.md, or the'
      + ' non-numeric key a fix pass used - then re-run');
    }
    const base = riskRef(opts.base);
    const head = staged ? null : riskRef(opts.head);
    if (!base || (!staged && !head)) {
      return fail('bad-args',
        'risk-check status needs --base <ref>, and --head <ref> unless --staged names the scope,'
        + ' with neither ref opening with `-`',
        'name the scope you are asking about, as refs this repository can resolve - --base <ref>'
        + ' --head <ref>, or --base <ref> --staged - then re-run this check');
    }
    // the commit pair is the identity and not the spelling, so the asked range is resolved here and compared as ids below; an unresolvable ref is a refusal and never a match, since a gate that shrugged at it would answer about a range nobody can point at
    // the staged ask resolves its base alone through the single-ref half and never reaches resolveRange, because the index isn't a commit. Its head_id stays null, which is also what keeps a staged record and a ref-range record from matching each other below
    let baseId;
    let headId = null;
    let indexId = null;
    if (staged) {
      const b = resolveRef('base', base);
      // both ends of the staged scope, the index being the second: a staged ask that couldn't name its index could only match on the base, and the base alone is the identity a later unscanned index satisfied
      // one refusal for both ends: the base's own error rides through the stand-in, so a bad `--base` answers with the detail that names it and an unnameable index names `index`
      const ix = b.ok ? resolveIndex(b.top) : { ok: false, id: '', error: b.error };
      if (!ix.ok) {
        return emit({
          ok: false,
          reason: 'unresolved-range',
          phase: n,
          plan: parsedPlan.key,
          base,
          head: null,
          staged: true,
          detail: ix.error,
          hint: b.ok
            ? 'git could not name this repository\'s index, so there is no staged scope to ask'
              + ' about - an unmerged index has no single identity, so finish or abort the merge'
              + ' and re-run this check'
            : 'name a --base this repository can resolve, then re-run this check',
        });
      }
      baseId = b.id;
      indexId = ix.id;
    } else {
      const resolved = resolveRange(base, head);
      if (!resolved.ok) {
        return emit({
          ok: false,
          reason: 'unresolved-range',
          phase: n,
          plan: parsedPlan.key,
          base,
          head,
          detail: resolved.error,
          hint: 'name a --base and --head this repository can resolve, then re-run this check',
        });
      }
      baseId = resolved.base;
      headId = resolved.head;
    }
    wanted = { plan: parsedPlan.key, base, head, base_id: baseId, head_id: headId,
      ...(staged ? { staged: true, index_id: indexId } : {}) };
  }

  // one reader of the record, through renderTrace and nothing else; a second reader is how two readers start disagreeing about what closed
  const r = renderTrace(dir, parsedPhase.raw);

  // this cycle, bounded by the phase's own last sign-off and not by the newest anchor alone
  // trace.jsonl is append-only and phase numbers restart every milestone, so a phase number reaches every earlier milestone's phase of the same number; scanning all of them demanded records for ranges from old cycles and made the gate unsatisfiable on any project with more than one milestone of history
  // scoping to renderTrace's corr alone is too narrow the other way: execute.md anchors each invocation at the short HEAD, so a resumed session takes a different id once its first commits land and the ranges the earlier invocation completed would fall out of the filter
  // the bound is the phase's newest `uat_verdict` `complete` outcome and everything after it is the cycle in hand. `partial` isn't a bound, since a partial UAT is the middle of a cycle. A phase with no sign-off drops nothing
  // epoch milliseconds and never the raw string: a lexicographic compare over `ts` opens on a typo, since a sign-off stamped "zzzz" sorts above every real timestamp and the phase would report clean with no rows. An unparseable timestamp isn't a later one
  const stamp = (/** @type {any} */ v) => {
    if (typeof v !== 'string') return null;
    const ms = Date.parse(v);
    return Number.isFinite(ms) ? ms : null;
  };

  let signoff = null;
  for (const e of r.events) {
    if (e.family !== 'outcome' || e.event !== 'uat_verdict' || e.detail !== 'complete') continue;
    // an unreadable sign-off isn't a bound: it can't say when the cycle closed, and "I don't know" has to mean no cycle closed, which requires more and never less
    const ts = stamp(e.ts);
    if (ts === null) continue;
    if (signoff === null || ts > signoff) signoff = ts;
  }
  /** Everything is in the cycle unless it can be proved to sit at or before a readable sign-off: an event with no `ts`, an unparseable one or a backwards clock stays required, and `>=` because an event on the sign-off's own instant is ambiguous and ambiguity resolves toward requiring the record. */
  const inCycle = (/** @type {{ts?: any}} */ e) => {
    if (signoff === null) return true;
    const ts = stamp(e.ts);
    return ts === null || ts >= signoff;
  };

  /** A row identity is the run and the plan together, so a multi-invocation phase answers per invocation: invocation 1's completed ranges need invocation 1's records, and invocation 2 can't clear them by checking its own. */
  const rowKey = (/** @type {any} */ corr, /** @type {any} */ plan) =>
    `${planKey(corr)}\u0000${planKey(plan)}`;

  /** Completed ranges, keyed by plan. Completed means an executor bracket whose terminal is a `return`; a `checkpoint` closed an unfinished dispatch and requires nothing. Grouping by plan makes a checkpoint-then-return continuation count once. */
  /** @type {Map<string, {run: string|null, plan: string|null, completed: number}>} */
  const completed = new Map();
  const planRow = (/** @type {any} */ corr, /** @type {any} */ plan) => {
    const k = rowKey(corr, plan);
    let row = completed.get(k);
    if (!row) {
      row = {
        run: planKey(corr) === '' ? null : planKey(corr),
        plan: planKey(plan) === '' ? null : planKey(plan),
        completed: 0,
      };
      completed.set(k, row);
    }
    return row;
  };
  /**
   * A bracket carrying a key the worker-key grammar refuses.
   * The one bounded exception to "status doesn't narrow": a key lib/plan-key.mjs refuses can never get a record from `risk-check run --plan`, so demanding one leaves a blocking gate unsatisfiable with no exit but an override. It's reported on its own `malformed` list and not silently dropped, which is what made the excluded-key arm fail open.
   * An absent plan isn't malformed and keeps its row: run with no `--plan` writes a record keyed '' and joins it. Nothing in the tree mints a refused key today; this guards the write face, where `trace append --plan` still stores any non-empty string.
   * @type {Set<string>}
   */
  const malformed = new Set();
  for (const b of r.brackets) {
    if (!inCycle(b)) continue;
    if (b.role !== 'cad-executor' || b.event !== 'return') continue;
    const spelled = planKey(b.plan);
    if (spelled !== '' && !requirePlanKey(b.plan).ok) { malformed.add(spelled); continue; }
    planRow(b.corr, b.plan).completed++;
  }
  // a named range is required whether or not its return has landed yet: the caller states the range it just committed, and a bracket that never paired must not turn the gate off. It rides this invocation's id
  if (wanted) planRow(r.corr, wanted.plan);

  /**
   * Every record the phase holds, keyed by plan, with its verdict fields beside its refs, because a record isn't a check: run appends on every path past validation, so `checked: false` means attempted and no diff read, and matching a ref pair off one of those would report `recorded` for a range nobody saw.
   * `inconclusive` is the opposite call. A `checked: true, inconclusive: true` record is a completed check that honestly says part of the range can't be judged, so it satisfies this gate and rides the row with the flag visible. "An unjudged range is not a cleared one" is enforced at the fire site, where a response exists; refusing here would make a range holding a binary file or a submodule bump unclearable, and an unclearable gate is one that gets bypassed.
   * @type {Map<string, {base: any, head: any, base_id: string|null, head_id: string|null,
   *   checked: boolean, inconclusive: boolean, staged: boolean, index_id: string|null}[]>}
   */
  const records = new Map();
  /** The same records keyed by plan alone, for the named-range arm: the resolved commit pair is a stronger identity than the invocation that wrote it, so a record for exactly those two commits satisfies it wherever in the cycle it was written.
   * @type {Map<string, any[]>} */
  const byPlan = new Map();
  for (const e of r.events) {
    if (!inCycle(e)) continue;
    if (e.family !== 'outcome' || e.event !== 'risk_check') continue;
    const k = rowKey(e.corr, e.plan);
    if (!records.has(k)) records.set(k, []);
    const p = planKey(e.plan);
    if (!byPlan.has(p)) byPlan.set(p, []);
    const rec = {
      base: e.base === undefined ? null : e.base,
      head: e.head === undefined ? null : e.head,
      // the resolved ids the range is identified by, null when the record carries none (written before run resolved its refs, or its refs didn't resolve); null never matches, so the record reports `stale` and the range is re-run, since the spelling can't say which commits it meant
      base_id: typeof e.base_id === 'string' && e.base_id ? e.base_id : null,
      head_id: typeof e.head_id === 'string' && e.head_id ? e.head_id : null,
      // the scope the record was written over; `=== true` because a ref-range row has no such field and absent isn't staged. It keeps the two scopes from satisfying each other in sameRange
      staged: e.staged === true,
      // the index a staged record was written over, which is what makes a staged scope a scope since its base can sit unmoved across many indexes; null on a ref range, on a staged row whose run couldn't name the index, and on one that predates the field, and null never matches, the same safe direction as the ids above
      index_id: typeof e.index_id === 'string' && e.index_id ? e.index_id : null,
      // `=== true` and never truthiness: an older seam wrote neither field, and an absent verdict isn't a passing one
      checked: e.checked === true,
      inconclusive: e.inconclusive === true,
      // an empty range is a check that ran, so it arrives checked:true, inconclusive:false, matches:[] and reaches `recorded` unaided; a fifth state name would turn into an automatic ok:false through `offending`. The flag is only here so an auditor can see why a row is `recorded` with nothing matched
      // `=== true` for the same reason: older events were written before the seam told an empty range from an unread one
      empty: e.empty === true,
      // the category tokens run writes and this reader used to drop; a record carrying one is a range execute.md had to fire the blocking risk_surface gate on. A non-array reads as no tokens, never as a match nobody can name
      matches: Array.isArray(e.matches) ? e.matches.filter((m) => typeof m === 'string') : [],
      // a non-empty `matches` of non-strings is a range the detector matched and this reader can't name; filtering it to [] silently turned a fired range into a clean one, so this flag carries "something matched" on its own. Widening is the only safe direction on a gate that defaults to blocking, same as `inconclusive`
      matched_unnamed: Array.isArray(e.matches) && e.matches.length > 0
        && e.matches.filter((m) => typeof m === 'string').length === 0,
    };
    records.get(k).push(rec);
    byPlan.get(p).push(rec);
  }

  /**
   * The skip a caller writes in place of a check.
   * A plan that landed no commits leaves HEAD where it was, so execute.md, task.md and execute-parallel.md append `outcome/risk_check_skipped` with that commit as `sha` and don't ask `run` for an empty row over nothing. This reader has to know the event or that row stays `missing`: every executor return in the cycle is a row, so on a multi-plan phase one skipped plan refused every later plan's own status call, with no exit but an override.
   * A skip with no sha satisfies nothing, same as a fire receipt: it can't say which range it stood in for. It satisfies its row as `skipped` and never `recorded`, so a range nobody had to read stays distinguishable from one the detector cleared.
   * @type {Map<string, {sha: string}[]>}
   */
  const skips = new Map();
  /** The same skips keyed by plan alone, for the named-range arm. @type {Map<string, {sha: string}[]>} */
  const skipsByPlan = new Map();
  for (const e of r.events) {
    if (!inCycle(e)) continue;
    if (e.family !== 'outcome' || e.event !== RISK_SKIP_EVENT) continue;
    if (typeof e.sha !== 'string' || !e.sha.trim()) continue;
    const k = rowKey(e.corr, e.plan);
    if (!skips.has(k)) skips.set(k, []);
    const p = planKey(e.plan);
    if (!skipsByPlan.has(p)) skipsByPlan.set(p, []);
    const skip = { sha: e.sha.trim() };
    skips.get(k).push(skip);
    skipsByPlan.get(p).push(skip);
  }

  /**
   * The fire's own receipts, keyed the same way the records are.
   * status used to prove a range was read and recorded and stop there, so a coordinator could run the detector, watch it match `secrets`, skip the blocking fire entirely and still get ok:true. "The detector ran" and "the fire happened" are different claims, so this reader demands a receipt for each.
   * Five event names, the five outcomes a fire can reach; FIRE_RECEIPTS is the list and its comment says why each is on it.
   * The trigger is read off the structured `trigger` field and never parsed out of `detail`: in free text it's spelled four different ways, so a parser would clear a range on one spelling and refuse an identical one on another.
   * Each receipt carries the row identity it was written under plus the range it settled, so a later matched range can't ride in on an earlier fire.
   * @type {{key: string, sha: string|null, base: string|null}[]}
   */
  const receipts = [];
  for (const e of r.events) {
    if (!inCycle(e)) continue;
    if (e.family !== 'outcome' || !FIRE_RECEIPTS.includes(e.event)) continue;
    if (e.trigger !== RISK_TRIGGER) continue;
    // override is the one receipt a coordinator writes on its own say-so and not as the settled outcome of a review, so it has to carry a reason; without one, `trace append --event override --trigger risk_surface` with no detail mints a clear for a fire nobody made
    if (e.event === 'override') {
      const why = typeof e.detail === 'string' ? e.detail.trim() : '';
      if (!why) continue;
    }
    receipts.push({ key: rowKey(e.corr, e.plan), sha: typeof e.sha === 'string' ? e.sha : null, base: typeof e.base === 'string' ? e.base : null });
  }

  /**
   * Does a receipt settle this range?
   * Joining on rowKey alone cleared every later matched range for the plan on one earlier fire: run the detector, fire once, fix something, re-run on the widened range, skip the second fire, and status still said ok:true. So a receipt names the range it settles, with `trace append --sha <head>`.
   * Short and full spellings resolve to the same commit, so the compare is prefix-wise in whichever direction is shorter.
   * A receipt with no sha settles nothing; accepting it as a wildcard would leave the hole open under another name.
   */
  const shaMatches = (/** @type {string|null} */ a, /** @type {string|null} */ b) => {
    if (!a || !b) return false;
    const [x, y] = a.length <= b.length ? [a, b] : [b, a];
    return x.length >= 7 && y.startsWith(x);
  };
  /**
   * Does a receipt settle this one record?
   * Both ends of the range, not the head alone: two records can share a head and differ at the base, and those are different diffs over different risk surfaces. A receipt for B..C must not settle A..C.
   * A record with no resolved ids has no range identity to bind to, so the join falls back to the run and plan for that record alone. The alternative is a range no receipt can settle, and an unclearable gate is one that gets bypassed. Every record run writes today carries the ids, so this arm is only as wide as the legacy records.
   */
  const settledBy = (/** @type {any} */ rc, /** @type {any} */ f) => (
    f.head_id === null && f.base_id === null
      ? true
      // both ends required and never "matched if supplied": letting a receipt with no `--base` pass on the head alone reopened the widened-range bypass, since a fire over B..C would settle A..C
      : shaMatches(rc.sha, f.head_id) && shaMatches(rc.base, f.base_id));
  /**
   * Every fired record this row answers for needs its own receipt.
   * `.some()` here let one receipted range clear a later unreceipted one, because on the phase-wide arm `satisfying` is every usable record for the plan.
   */
  const settles = (/** @type {string} */ k, /** @type {any[]} */ satisfying) =>
    satisfying
      .filter((f) => f.matches.length > 0 || f.inconclusive || f.matched_unnamed)
      .every((f) => receipts.some((rc) => rc.key === k && settledBy(rc, f)));

  const rows = [...completed.entries()].map(([k, row]) => {
    const asked0 = wanted && planKey(wanted.plan) === planKey(row.plan)
      && row.run === (planKey(r.corr) === '' ? null : planKey(r.corr));
    const found = asked0 ? (byPlan.get(planKey(row.plan)) || []) : (records.get(k) || []);
    // only a record whose read succeeded can satisfy the gate; the rest are reported so the reader sees an attempt and not an absence
    const usable = found.filter((f) => f.checked);
    const asked = asked0
      ? { base: wanted.base, head: wanted.head, base_id: wanted.base_id, head_id: wanted.head_id,
        ...(wanted.staged ? { staged: true, index_id: wanted.index_id } : {}) }
      : null;
    // commit ids on both sides: comparing spellings let a record left under `--head HEAD` satisfy a later, wider `--head HEAD`, the very spelling execute.md documents for both calls
    // a staged ask matches a staged row and nothing else; a ref-range row over the same base is a different scope. The reverse needs no clause, since a staged row's head_id is null and the ref arm's two-id test already refuses it
    // two ends on this arm too, the second being the index: matching on base and scope alone left the mutable half out of the identity, so a record from a benign index answered for every later index over that base. index_id is the tree git write-tree names, so one changed staged byte makes the row stale and the detector runs again. A row with no index id never matches
    const sameRange = (/** @type {{base_id: string|null, head_id: string|null,
     *   staged: boolean, index_id: string|null}} */ f) =>
      (asked.staged
        ? f.staged && f.base_id !== null && f.base_id === asked.base_id
          && f.index_id !== null && f.index_id === asked.index_id
        : f.base_id !== null && f.head_id !== null
          && f.base_id === asked.base_id && f.head_id === asked.head_id);
    // stale and not satisfied: a plan re-dispatched over a widened range would otherwise pass on the record its narrower range left. Unchecked is the third state: the range was named and attempted and nothing was read
    // the records that satisfy the row are a narrower set than `usable` on the named-range arm, and both the state and the fire receipt read this same set, so a row can't be `recorded` on one record and judged fired on another
    const satisfying = asked ? usable.filter(sameRange) : usable;
    // fired means the detector read it and came back with category tokens or `inconclusive: true`, the two conditions execute.md fires the blocking gate on; demanding a receipt for anything else would refuse a clean phase
    const fired = satisfying.some((f) => f.matches.length > 0 || f.inconclusive || f.matched_unnamed);
    // unfired sits on top of the states above and not in place of them: it's reached only where the range was read and recorded, matched, and no receipt says the fire happened. The join is the row's own rowKey, which for the asked row is the planRow this invocation registered
    // skipped is reached only where no record answers the row, since a detector record is always the stronger claim. On the phase-wide arm any skip that names its commit stands in for the plan; on the named-range arm it answers only for the range it describes (both asked ends are the one commit it names), and never for a staged ask, whose index has bytes the skip didn't read. A staged ask carries head_id null, so the equal-ends test already refuses it
    const skipped = asked ? (skipsByPlan.get(planKey(row.plan)) || []) : (skips.get(k) || []);
    const skipMatches = (/** @type {{sha: string}} */ s) =>
      (asked
        ? !asked.staged && asked.base_id !== null && asked.base_id === asked.head_id
          && shaMatches(s.sha, asked.base_id)
        : true);
    const state = asked
      ? (usable.some(sameRange) ? (fired && !settles(k, satisfying) ? 'unfired' : 'recorded')
        : found.some(sameRange) ? 'unchecked'
          : found.length ? 'stale'
            : skipped.some(skipMatches) ? 'skipped' : 'missing')
      : (usable.length ? (fired && !settles(k, satisfying) ? 'unfired' : 'recorded')
        : found.length ? 'unchecked'
          : skipped.some(skipMatches) ? 'skipped' : 'missing');
    // matched_unnamed is this reader's own conservative flag and not part of what a caller wrote, so it stays out of the reported shape
    // report what the trace holds.
    const pub = found.map(({ matched_unnamed: _u, ...rest }) => rest);
    // skips ride the row only where one exists, so a row without them keeps the shape every reader of it already pins
    return {
      ...row, state, records: pub,
      ...(skipped.length ? { skips: skipped.map((s) => s.sha) } : {}),
      ...(asked ? { wanted: asked } : {}),
    };
  });

  const offending = rows.filter((row) => row.state !== 'recorded' && row.state !== 'skipped');
  if (offending.length) {
    // the hint names the step that's actually missing: an unfired row already has its record, and sending that caller to re-run the detector would redo the half it did and refuse again. When the set is mixed the record hint leads, since a fire can't be recorded for a range nothing has read
    const unfiredOnly = offending.every((row) => row.state === 'unfired');
    // emitted directly and not through fail, whose reason/detail/hint shape has no channel for the list, and the list is the point of the refusal (same as cmdLeaseCheck's undeclared-files arm)
    return emit({
      ok: false,
      reason: unfiredOnly ? 'risk-fire-missing' : 'risk-record-missing',
      phase: n,
      plans: rows,
      missing: offending.map((row) => row.plan),
      // never folded into `missing`: these keys can't have a record written, and a caller sent to `risk-check run --plan <one of them>` would be sent to a refusal
      ...(malformed.size ? { malformed: [...malformed] } : {}),
      hint: unfiredOnly
        ? `fire the blocking ${RISK_TRIGGER} review for each plan listed and record its outcome`
          + ` (one of ${FIRE_RECEIPTS.join(', ')}) under this phase's correlation id and that plan,`
          + ' then re-run this check'
        : `run risk-check run --phase ${parsedPhase.raw} --plan <k> --base <ref> --head <ref>`
          + ' for each plan listed (or, for a plan that landed no commits,'
          + ` trace append --family outcome --event ${RISK_SKIP_EVENT} --plan <k> --sha <that end>),`
          + ' then re-run this check',
    });
  }
  // nothing to require isn't a failure, or a gate here would block the first plan of every phase; a malformed key rides the pass too, so the reader can see a bracket was skipped and not judged, which is the silent exclusion we refused
  ok({ phase: n, plans: rows, ...(malformed.size ? { malformed: [...malformed] } : {}) });
}

function cmdRiskCheck(dir, sub, opts) {
  if (sub === 'run') return cmdRiskCheckRun(dir, opts);
  if (sub === 'status') return cmdRiskCheckStatus(dir, opts);
  return fail('usage', 'risk-check <run|status>');
}

export { REVIEWER_TEXT_PATHSPECS, cmdRiskCheck, cmdRiskCheckRun, cmdRiskCheckStatus };
