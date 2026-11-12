// @ts-check
// planning/risk-check.mjs - the `risk-check` family: the detector behind the risk_surface gate, and its run record
// cmdRiskCheck calls the other two handlers, which is why all three live in this one file
// RISK_TRIGGER, FIRE_RECEIPTS, surfaceVocabulary and REVIEWER_TEXT_PATHSPECS are read here and nowhere else
// cmdRiskCheckRun carries the merge `warnings` into the envelope, so no header marker is needed
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
import { CATEGORIES, answeredSurfaces, parseSurfaceList } from '../lib/surface-scan.mjs';
import { appendEvent, renderTrace } from '../lib/trace.mjs';

/**
 * The risk-surface vocabulary `config.schema.json` states, the same list route.mjs hands answeredSurfaces.
 * Read from the schema and not CATEGORIES, so this seam and the resolve can't disagree on a valid answer.
 * Falls back to the eight when the table is unreadable, since no vocabulary would refuse every call.
 * @returns {readonly string[]}
 */
function surfaceVocabulary() {
  return routeLadder('risk_surface_categories') || CATEGORIES;
}

/**
 * The four `.planning/phases/` artifacts the range read withholds, as git pathspecs after the `git diff` separator.
 * They store reviewer text verbatim, so a finding quoting a destructive command re-tripped the gate that found it.
 * A pathspec and not a scanDiff exemption: the fix goes at the mention, never at a path. Plan files stay scanned.
 * A range whose changed files are all withheld reads `empty: true` and still clears.
 * `:(top,exclude)` in long form on purpose: `top` anchors at the repo root, not the cwd.
 * Exported so the suite drives off this list.
 * @type {readonly string[]}
 */
const REVIEWER_TEXT_PATHSPECS = Object.freeze([
  ':(top,exclude).planning/phases/*/records/ADJUDICATION-*.json',
  ':(top,exclude).planning/phases/*/records/REVIEW-*.md',
  ':(top,exclude).planning/phases/*/FINDINGS.json',
  ':(top,exclude).planning/phases/*/verifier-findings.json',
]);

// the check used to be prose telling a model to scan a diff, and a skipped one looked the same as a clean one
// run records on every call past arg validation, and status refuses a phase with a completed range and no record

function cmdRiskCheckRun(dir, opts) {
  const parsedPhase = requirePhaseArg(opts.phase);
  if (!parsedPhase.ok) {
    return fail('bad-args', 'risk-check run needs --phase <N>',
      'pass --phase <N> for the phase whose committed range is being checked, then re-run');
  }
  const n = parsedPhase.value;

  // same key grammar as status, which derives keys like `1-fix`; requireInt refused them and left the gate stuck
  // a valueless flag arrives as boolean true and Number(true) is 1, so refuse a non-string first
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

  // a scope is `--base <ref> --head <ref>` for a committed range or `--base <ref> --staged` for the index
  // neither end is defaulted: a defaulted head is a range the caller never stated, and this record is the evidence
  // `--staged` is read by presence like `opts['plan-time']` in cmdLeaseCheck, so the contract declares it boolean
  const base = riskRef(opts.base);
  const head = riskRef(opts.head);
  const staged = 'staged' in opts;
  // both spellings is a malformed call, not a precedence question: picking one answers for a scope nobody asked about
  // tests `'head' in opts`, not the validated head, so a flag-shaped `--head` beside `--staged` is refused, not dropped
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

  // mergeLayers warnings[]: a torn layer is refused whatever the caller passed, and the detail names what tore
  // ahead of the --surfaces branch so a flag can't step around a torn layer
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
    const { tokens, unknown } = parseSurfaceList(opts.surfaces);
    if (!tokens.length) {
      return fail('bad-args', 'risk-check run --surfaces needs a comma-separated list after it: --surfaces <a,b,c>',
        "list this run's scope as one comma-separated value, or drop --surfaces to use the set the"
        + ' project already answered');
    }
    // a token outside the eight is refused with nothing appended: a mistyped scope must not narrow a blocking gate
    if (unknown.length) {
      return fail('bad-args',
        `risk-check run --surfaces names ${unknown.join(', ')}, which is not one of ${CATEGORIES.join(', ')}`,
        'correct the token(s) the detail names against the list beside them, then re-run - dropping'
        + ' one instead would narrow a blocking gate to a scope nobody chose');
    }
    categories = [...new Set(tokens)];
  } else {
    // review-triggers.md says an unanswered project doesn't go on to detection, and nothing enforced it until this
    // a caller that named --surfaces already resolved the scope; this refuses the one that left the all-eight default
    // detail names the two commands that settle it, since detect-surfaces has no other caller
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
  // ids for the caller's refs, resolved before any read: status compares ids, not spellings
  // a failed ref keeps the other end's id: resolveRange returns '' for the end git couldn't name, so only it is null
  let baseId = null;
  let headId = null;
  /** the staged scope's second end, null on a ref range: the index has no commit id, so `git write-tree` names it
   * @type {string|null} */
  let indexId = null;
  /**
   * The `git diff` argv this scope names, or null when it didn't resolve and there's nothing to read.
   * Built per arm and read once so both scopes share one catch, which also holds the `planning-detail-sites` census.
   * `-C top` reads the repo and not the cwd, ids and not spellings, and the trailing `--` stops a ref becoming a path.
   * `--no-ext-diff --no-textconv`: a `diff=<driver>` attribute in a cloned repo can print nothing and fake a clear.
   * @type {string[] | null}
   */
  let diffArgs = null;
  if (staged) {
    // staged sits before resolveRange so that function never learns a staged spelling; the index isn't a commit
    // resolveRef is the single-ref half resolveRange is built on, so both arms share one refusal vocabulary
    // the scope is the index against the base: the gate fires before the commit, so unadded worktree files are outside
    // the diff names the index by the write-tree object and not `--cached`, for the reason below
    const b = resolveRef('base', base);
    baseId = b.id || null;
    if (!b.ok) diffError = b.error;
    else {
      // the index id is taken before the body is read: a record keyed by the base alone satisfied any later index
      // the body comes from that same tree, never `--cached`: two reads of the live index leave a swap window
      // an index git can't name fails like a bad ref: no read and a `no-diff` refusal, as its record could never match
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

  // appended on every path past arg validation, refusals included, so the record says the check was attempted
  // `plan` is the caller's own spelling, like `trace append --plan`; status stringifies both sides, so `1` joins `"1"`
  const res = appendEvent(dir, {
    phase: parsedPhase.raw,
    family: 'outcome',
    event: 'risk_check',
    ...(plan === undefined ? {} : { plan }),
    // both spellings and both ids, written even when null, so an unresolved run is visibly unidentifiable
    base,
    // null on the staged arm: the index isn't a commit, and an `undefined` flag would drop the field a reader checks
    head: staged ? null : head,
    base_id: baseId,
    head_id: headId,
    // only the staged arm writes these, so a row without them reads as a ref range; index_id rides the same spread
    // written even when null, like the ids above, so a staged record the gate can never match says so
    ...(staged ? { staged: true, index_id: indexId } : {}),
    checked: scan.checked,
    categories: scan.categories,
    // tokens on the record, `{category, signal}` pairs on the envelope: the record is counted, the fire site needs why
    matches: scan.matches.map((m) => m.category),
    inconclusive: scan.inconclusive,
    // an empty range was read and held nothing: a completed check, on the record and envelope so both agree
    empty: scan.empty,
    // the cause goes on the row too: a bare `checked: false, inconclusive: true` looked skippable and said nothing why
    // `detail` is the cause field trace rows already carry, the same redacted string the envelope emits
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

/** The trigger a risk receipt has to name; one spelling, or the detector and the gate stop matching. */
const RISK_TRIGGER = 'risk_surface';
/** Appended in place of a check for a plan that landed no commits, so status reads that row as `skipped`. */
const RISK_SKIP_EVENT = 'risk_check_skipped';

/**
 * The five `outcome` events a risk_surface fire can settle at, all accepted by `risk-check status` as proof:
 * `adjudication` (survivors reported), `rearm` (narrowed second round), `gate_pass` (nothing blocker/high),
 * `override` (user cleared a FAIL, reason on file) and `deferral` (a deferred gate queued what it found).
 * `gate_pass` exists because a clean pass wrote nothing, so a matched clean range could never clear.
 * `deferral` has its own name: `gate_pass` reads as clean in every recount, and `override` is the manufactured clear.
 * Producers: references/triage-gate.md and references/review-triggers.md.
 */
const FIRE_RECEIPTS = ['adjudication', 'rearm', 'gate_pass', 'override', 'deferral'];

function cmdRiskCheckStatus(dir, opts) {
  const parsedPhase = requirePhaseArg(opts.phase);
  if (!parsedPhase.ok) {
    return fail('bad-args', 'risk-check status needs --phase <N>',
      'pass --phase <N> for the phase whose fires are being reported, then re-run');
  }
  const n = parsedPhase.value;

  // a named range is all or none: a plan number alone isn't a range identity, and a partial one reads as phase-wide
  // all of it is `--plan <k> --base <ref>` plus one scope, `--head <ref>` or `--staged`, since run records both
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
    // the same predicate risk-check run reads, so enforce and report can't disagree on what a key is
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
    // ids are the identity, so the asked range resolves here; an unresolvable ref is a refusal, never a match
    // a staged ask resolves only its base; head_id stays null, which keeps staged and ref-range rows apart below
    let baseId;
    let headId = null;
    let indexId = null;
    if (staged) {
      const b = resolveRef('base', base);
      // the staged scope has two ends, the index second: a base-only match is the hole an unscanned index slipped in
      // one refusal for both: a bad `--base` answers with its own detail, an unnameable index names `index`
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

  // one reader of the record, through renderTrace; a second reader is how two readers disagree on what closed
  const r = renderTrace(dir, parsedPhase.raw);

  // this cycle, bounded by the phase's own last sign-off and not by the newest anchor alone
  // phase numbers restart every milestone, so an unbounded scan demanded records for old cycles and could never be met
  // renderTrace's corr alone is too narrow: execute.md anchors at the short HEAD, so a resumed session takes a new id
  // the bound is the newest `uat_verdict` `complete` outcome; `partial` isn't one, and no sign-off drops nothing
  // epoch ms, not the raw string: a sign-off stamped "zzzz" sorts above every timestamp. An unparseable one isn't later
  const stamp = (/** @type {any} */ v) => {
    if (typeof v !== 'string') return null;
    const ms = Date.parse(v);
    return Number.isFinite(ms) ? ms : null;
  };

  let signoff = null;
  for (const e of r.events) {
    if (e.family !== 'outcome' || e.event !== 'uat_verdict' || e.detail !== 'complete') continue;
    // an unreadable sign-off isn't a bound: it can't say when the cycle closed, so it requires more, never less
    const ts = stamp(e.ts);
    if (ts === null) continue;
    if (signoff === null || ts > signoff) signoff = ts;
  }
  /** In the cycle unless proven at or before a readable sign-off; a bad `ts` or a tie stays required. */
  const inCycle = (/** @type {{ts?: any}} */ e) => {
    if (signoff === null) return true;
    const ts = stamp(e.ts);
    return ts === null || ts >= signoff;
  };

  /** Row identity is run plus plan, so invocation 2 can't clear invocation 1's ranges by checking its own. */
  const rowKey = (/** @type {any} */ corr, /** @type {any} */ plan) =>
    `${planKey(corr)}\u0000${planKey(plan)}`;

  /** Completed ranges by plan: a bracket ending in `return`; a `checkpoint` requires nothing. */
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
   * The one exception to "status doesn't narrow": no `risk-check run --plan` can write a record for it.
   * Reported on its own `malformed` list and not dropped, which is what made the excluded-key arm fail open.
   * An absent plan isn't malformed: run with no `--plan` writes a record keyed '' and joins it.
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
  // a named range is required whether or not its return landed: a bracket that never paired must not turn the gate off
  if (wanted) planRow(r.corr, wanted.plan);

  /**
   * Every record the phase holds, keyed by plan: `checked: false` is an attempt with no diff read.
   * `checked: true, inconclusive: true` is a completed check that can't judge some of the range; it still satisfies.
   * Refusing it here would leave a binary or submodule range unclearable, and an unclearable gate gets bypassed.
   * @type {Map<string, {base: any, head: any, base_id: string|null, head_id: string|null,
   *   checked: boolean, inconclusive: boolean, staged: boolean, index_id: string|null}[]>}
   */
  const records = new Map();
  /** The same records keyed by plan alone, for the named-range arm: the commit pair beats the run as identity.
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
      // resolved ids the range is identified by; null when the record has none, and null never matches, so it's `stale`
      base_id: typeof e.base_id === 'string' && e.base_id ? e.base_id : null,
      head_id: typeof e.head_id === 'string' && e.head_id ? e.head_id : null,
      // `=== true` because a ref-range row has no such field; it keeps the two scopes from satisfying each other
      staged: e.staged === true,
      // the index a staged record was written over; null on a ref range or an older row, and null never matches
      index_id: typeof e.index_id === 'string' && e.index_id ? e.index_id : null,
      // `=== true` and never truthiness: an older seam wrote neither field, and an absent verdict isn't a passing one
      checked: e.checked === true,
      inconclusive: e.inconclusive === true,
      // an empty range is a check that ran, so it reaches `recorded` unaided; a fifth state would force ok:false
      // `=== true` for the same reason: older events predate the seam telling an empty range from an unread one
      empty: e.empty === true,
      // the category tokens run writes; a record carrying one is a range execute.md fires the blocking gate on
      matches: Array.isArray(e.matches) ? e.matches.filter((m) => typeof m === 'string') : [],
      // non-string matches still matched; filtering them to [] turned a fired range clean, so this flag carries it
      matched_unnamed: Array.isArray(e.matches) && e.matches.length > 0
        && e.matches.filter((m) => typeof m === 'string').length === 0,
    };
    records.get(k).push(rec);
    byPlan.get(p).push(rec);
  }

  /**
   * The skip a caller writes in place of a check.
   * A plan that landed no commits leaves HEAD put, so the workflows append `outcome/risk_check_skipped` with that sha.
   * Unknown to this reader, that row stays `missing` and one skipped plan refuses every later plan's status call.
   * A skip with no sha satisfies nothing. It answers its row as `skipped`, never `recorded`, so unread ranges show.
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
   * "The detector ran" and "the fire happened" are different claims; proving only the first passed a skipped fire.
   * Five event names, the five outcomes a fire can reach; FIRE_RECEIPTS is the list.
   * The trigger is read off the structured `trigger` field, never parsed out of `detail`, where it has four spellings.
   * Each receipt carries its row identity and the range it settled, so a later range can't ride an earlier fire.
   * @type {{key: string, sha: string|null, base: string|null}[]}
   */
  const receipts = [];
  for (const e of r.events) {
    if (!inCycle(e)) continue;
    if (e.family !== 'outcome' || !FIRE_RECEIPTS.includes(e.event)) continue;
    if (e.trigger !== RISK_TRIGGER) continue;
    // override is the one receipt written on a coordinator's own say-so, so it needs a reason
    if (e.event === 'override') {
      const why = typeof e.detail === 'string' ? e.detail.trim() : '';
      if (!why) continue;
    }
    receipts.push({ key: rowKey(e.corr, e.plan), sha: typeof e.sha === 'string' ? e.sha : null, base: typeof e.base === 'string' ? e.base : null });
  }

  /**
   * Does a receipt settle this range?
   * Joining on rowKey alone let one fire clear every later range, so a receipt names its range with `--sha <head>`.
   * Short and full spellings are the same commit, so the compare is prefix-wise in whichever direction is shorter.
   * A receipt with no sha settles nothing; as a wildcard it would reopen the hole.
   */
  const shaMatches = (/** @type {string|null} */ a, /** @type {string|null} */ b) => {
    if (!a || !b) return false;
    const [x, y] = a.length <= b.length ? [a, b] : [b, a];
    return x.length >= 7 && y.startsWith(x);
  };
  /**
   * Does a receipt settle this one record?
   * Both ends of the range, not the head alone: B..C and A..C share a head and are different diffs.
   * A record with no resolved ids joins on run and plan alone, or no receipt could settle it. Only legacy ones.
   */
  const settledBy = (/** @type {any} */ rc, /** @type {any} */ f) => (
    f.head_id === null && f.base_id === null
      ? true
      // both ends required: a receipt with no `--base` matching on head alone let a fire over B..C settle A..C
      : shaMatches(rc.sha, f.head_id) && shaMatches(rc.base, f.base_id));
  /**
   * Every fired record this row answers for needs its own receipt.
   * `.some()` let one receipted range clear a later unreceipted one; the phase-wide arm checks every usable record.
   */
  const settles = (/** @type {string} */ k, /** @type {any[]} */ satisfying) =>
    satisfying
      .filter((f) => f.matches.length > 0 || f.inconclusive || f.matched_unnamed)
      .every((f) => receipts.some((rc) => rc.key === k && settledBy(rc, f)));

  const rows = [...completed.entries()].map(([k, row]) => {
    const asked0 = wanted && planKey(wanted.plan) === planKey(row.plan)
      && row.run === (planKey(r.corr) === '' ? null : planKey(r.corr));
    const found = asked0 ? (byPlan.get(planKey(row.plan)) || []) : (records.get(k) || []);
    // only a record whose read succeeded can satisfy the gate; the rest are reported so an attempt isn't an absence
    const usable = found.filter((f) => f.checked);
    const asked = asked0
      ? { base: wanted.base, head: wanted.head, base_id: wanted.base_id, head_id: wanted.head_id,
        ...(wanted.staged ? { staged: true, index_id: wanted.index_id } : {}) }
      : null;
    // commit ids on both sides: comparing spellings let a record under `--head HEAD` satisfy a later, wider one
    // a staged ask matches a staged row only; a staged row's head_id is null, so the ref arm's two-id test refuses it
    // the index is the second end: without it a benign index's record answered for every later index over that base
    const sameRange = (/** @type {{base_id: string|null, head_id: string|null,
     *   staged: boolean, index_id: string|null}} */ f) =>
      (asked.staged
        ? f.staged && f.base_id !== null && f.base_id === asked.base_id
          && f.index_id !== null && f.index_id === asked.index_id
        : f.base_id !== null && f.head_id !== null
          && f.base_id === asked.base_id && f.head_id === asked.head_id);
    // stale, not satisfied: a plan re-dispatched over a widened range would pass on the record its narrower range left
    // the named-range arm satisfies from a narrower set than `usable`; state and receipt read the same set
    const satisfying = asked ? usable.filter(sameRange) : usable;
    // fired is tokens or `inconclusive: true`, what execute.md fires on; demanding more would refuse a clean phase
    const fired = satisfying.some((f) => f.matches.length > 0 || f.inconclusive || f.matched_unnamed);
    // unfired sits on top of the states above: read and recorded, matched, and no receipt says the fire happened
    // skipped is reached only where no record answers the row; a skip never answers a staged ask, whose index is unread
    // phase-wide, any skip naming its commit stands in for the plan; named-range, only for the range it describes
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
    // matched_unnamed is this reader's own flag, not something a caller wrote, so it stays out of the reported shape
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
    // the hint names the missing step: an unfired row has its record already; a mixed set leads with the record hint
    const unfiredOnly = offending.every((row) => row.state === 'unfired');
    // emitted directly, not through fail: its shape has no channel for the list, and the list is the point
    return emit({
      ok: false,
      reason: unfiredOnly ? 'risk-fire-missing' : 'risk-record-missing',
      phase: n,
      plans: rows,
      missing: offending.map((row) => row.plan),
      // never folded into `missing`: no record can be written for these keys, so run would send the caller to a refusal
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
  // nothing to require isn't a failure, or a gate would block every phase's first plan; a malformed key rides the pass
  ok({ phase: n, plans: rows, ...(malformed.size ? { malformed: [...malformed] } : {}) });
}

function cmdRiskCheck(dir, sub, opts) {
  if (sub === 'run') return cmdRiskCheckRun(dir, opts);
  if (sub === 'status') return cmdRiskCheckStatus(dir, opts);
  return fail('usage', 'risk-check <run|status>');
}

export { REVIEWER_TEXT_PATHSPECS, cmdRiskCheck, cmdRiskCheckRun, cmdRiskCheckStatus };
