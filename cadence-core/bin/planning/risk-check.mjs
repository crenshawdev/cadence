// @ts-check
// planning/risk-check.mjs - the `risk-check` family: the detection the blocking
// `risk_surface` gate fires on, and the record that proves it ran.
//
// All THREE handlers live here because `cmdRiskCheck` dispatches to
// `cmdRiskCheckRun` and `cmdRiskCheckStatus` - the second of the two
// handler-to-handler call edges the single-file layout had (D-07).
//
// `surfaceVocabulary`, `RISK_TRIGGER`, `FIRE_RECEIPTS` and
// `REVIEWER_TEXT_PATHSPECS` are read by this family and nothing else, so they
// travel with it (D-05). The last of the four is EXPORTED, for its own stated
// reason: the suite has to drive itself off the same list the read uses.
//
// The `mergeLayers(` callsite in `cmdRiskCheckRun` destructures
// `warnings: surfaceWarnings` and carries it into the envelope, which is arm (a)
// of self-verify check 12 - no header marker needed (D-11).
'use strict';

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import {
  RISK_DIFF_MAX_BUFFER, fail, ok, planKey, resolveRange, resolveRef, riskRef, routeLadder,
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
 * The risk-surface vocabulary `route-table.json` states - the SAME list
 * `route.mjs` hands `answeredSurfaces`, read here so the seam that REFUSES on
 * the one-time surface question and the resolve that REPORTS it cannot
 * disagree about which tokens are a valid answer. A table naming a proper
 * subset is the case that separates them: a configured category outside it is
 * unanswered to `route.mjs`, and reading `CATEGORIES` here instead would let
 * this seam accept that same value and narrow a blocking gate's scope to a set
 * the routing authority had rejected.
 *
 * An unreadable or malformed table falls back to the eight rather than to
 * nothing: no vocabulary at all would read every configured answer as invalid
 * and refuse every call.
 * @returns {readonly string[]}
 */
function surfaceVocabulary() {
  return routeLadder('risk_surface_categories') || CATEGORIES;
}

/**
 * The four `.planning/phases/` artifacts the range read WITHHOLDS, spelled as
 * git pathspecs that append after the `git diff` revision separator (D-01,
 * D-02).
 *
 * WHY A PATHSPEC AND NOT AN EXEMPTION INSIDE `scanDiff`. `lib/risk-diff.mjs`
 * states at `:424-433`, `:464-470` and `:500-505` that the exemptions
 * `scanDeclared` carries are SCOPED TO THAT FACE and deliberately not to
 * `scanDiff`, because `scanDiff` reads a HUNK where a match is a line someone
 * actually ADDED, and its rule is that the fix belongs at the MENTION and never
 * at a path or a filename. Withholding the file from the DIFF honours that rule
 * instead of bending it: `scanDiff` never receives the hunk, its face is
 * untouched, and no signal leaves the table (D-03).
 *
 * WHY THESE FOUR SHAPES AND NOT `.planning/`. Each of the four stores reviewer
 * text VERBATIM by design - `references/review-record.md` requires a stored
 * restatement to match the reviewer's returned text byte for byte - so a docs
 * commit landing a finding that quotes a destructive command re-tripped the
 * very gate that found it, and the user had to override a gate to file what the
 * gate had told them. The scope stops at these four filename shapes: a
 * destructive command written into a PLAN.md Action is the text an executor is
 * handed to RUN, so a plan file under the same directory stays scanned, and
 * nothing outside `.planning/phases/` is withheld at all.
 *
 * WHAT IT DOES TO `empty`. A range whose changed files are ALL withheld now
 * reads `empty: true` - the SCANNED range held nothing, rather than the range
 * itself being empty - and that answer still clears as a COMPLETED check, the
 * arm `risk-check status` already treats as recorded. Taking a SECOND
 * unexcluded `git diff` to keep `empty` meaning what it meant before is
 * deliberately not done: it doubles the read on every gate fire to make one
 * boolean narrower, and no decision here asks for it.
 *
 * `:(top,exclude)` in long form on purpose. `top` anchors each pattern at the
 * working-tree root rather than at the process cwd, so the answer is the
 * repository's and not the caller's. The `:!` shorthand says the same thing
 * without naming which two magics are in play, at the site where a reader is
 * deciding whether to widen the list.
 *
 * EXPORTED so the suite drives itself off this list rather than off a second
 * spelling of it (D-04) - a second spelling is how a list and its test drift
 * apart.
 * @type {readonly string[]}
 */
const REVIEWER_TEXT_PATHSPECS = Object.freeze([
  ':(top,exclude).planning/phases/*/ADJUDICATION-*.json',
  ':(top,exclude).planning/phases/*/REVIEW-*.md',
  ':(top,exclude).planning/phases/*/FINDINGS.json',
  ':(top,exclude).planning/phases/*/verifier-findings.json',
]);

// ---------------------------------------------------------------------------
// risk-check - the detection the blocking `risk_surface` gate fires on, and the
// record that proves it ran (RSK-01/RSK-02).
//
// The defect it closes: detection was `workflows/execute.md` telling a model to
// check a diff against the eight-category prose list in
// references/review-triggers.md. A fire wrote a lifecycle event and a NON-match
// wrote nothing, so the run record could not tell "the detection step was
// skipped" from "it ran and matched nothing", and an omitted check was
// indistinguishable from a clean one.
//
// What changed is not the heuristics - those stay heuristics, in lib/
// risk-diff.mjs - it is that the answer is computed by something that always
// returns one and always appends it. `run` records on EVERY invocation that got
// past argument validation, including the no-match path and the git-failure
// path; `status` refuses a phase holding a completed executor range with no
// record.
// ---------------------------------------------------------------------------

function cmdRiskCheckRun(dir, opts) {
  const parsedPhase = requirePhaseArg(opts.phase);
  if (!parsedPhase.ok) {
    return fail('bad-args', 'risk-check run needs --phase <N>',
      'pass --phase <N> for the phase whose committed range is being checked, then re-run');
  }
  const n = parsedPhase.value;

  // THE WORKER KEY, through the one grammar both faces read (RSK-03, D-02).
  // Not `requireInt`: `status` derives what it demands from the lifecycle
  // brackets, where `references/seams.md` permits a non-numeric worker key, so
  // a fix pass bracketed `1-fix` used to leave a blocking gate no argv could
  // satisfy - `run --plan 1-fix` answered `bad-args`. The VAL-01 rail
  // `requireInt` was standing for survives inside the predicate: a VALUELESS
  // flag arrives as the boolean `true`, `Number(true)` is `1`, and a non-string
  // is refused first.
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

  // THE SCOPE, IN EXACTLY ONE MACHINE SPELLING PER SHAPE (OQ-1).
  //
  // A COMMITTED range is `--base <ref> --head <ref>`. The STAGED scope - the
  // index against a base, which is what `workflows/verify.md` and
  // `workflows/debug.md` describe in prose and what two projects improvised
  // `HEAD..STAGED` for (verbatim 2026-08-30T18:28:50, weathervane
  // 2026-08-31T11:21:11) - is `--base <ref> --staged`. Neither end is ever
  // defaulted on either shape: a defaulted head is a range the caller never
  // stated, and this record is the evidence of what was checked.
  //
  // `--staged` is read by PRESENCE, the way `cmdLeaseCheck` reads
  // `opts['plan-time']`: it carries no value at all, and the arg contract
  // declares it boolean with `fallback` on both axes for that reason.
  const base = riskRef(opts.base);
  const head = riskRef(opts.head);
  const staged = 'staged' in opts;
  // TWO SPELLINGS OF ONE SCOPE is a malformed call, never a precedence
  // question. Picking one would hand the caller a verdict over a scope it did
  // not ask about, on the one gate that is blocking at every stakes level. The
  // test is `'head' in opts` and not the VALIDATED head, so a flag-shaped
  // `--head` beside `--staged` is refused here rather than silently dropped.
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

  // The scope of the check, narrowed only by what the caller named. A token
  // outside the eight is a malformed CALL - refused, with NOTHING appended, the
  // rule `trace append --tokens` already states - because a caller who mistyped
  // the scope of a blocking gate must see a refusal rather than a narrowed
  // clean answer.
  // THE ONE-TIME SURFACE QUESTION, read BEFORE the `--surfaces` branch so both
  // arms see the same two facts.
  //
  // mergeLayers warnings[]: a layer that did not PARSE is refused here whatever
  // the caller passed - this envelope is the surfacing, and the detail names
  // what tore. It sits ahead of the branch deliberately: a torn layer that only
  // an unflagged call noticed would be a fail-closed rule an explicit flag
  // could step around, which is not a rule.
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
    const unknown = tokens.filter((t) => !CATEGORIES.includes(t));
    if (unknown.length) {
      return fail('bad-args',
        `risk-check run --surfaces names ${unknown.join(', ')}, which is not one of ${CATEGORIES.join(', ')}`,
        'correct the token(s) the detail names against the list beside them, then re-run - dropping'
        + ' one instead would narrow a blocking gate to a scope nobody chose');
    }
    categories = [...new Set(tokens)];
  } else {
    // THE TEETH ON THE ONE-TIME SURFACE QUESTION.
    // `references/review-triggers.md` states that a `risk_surface` fire whose
    // resolve reports `surfaces_answered: false` "does not proceed to detection
    // until the project has answered". Detection is THIS subcommand, and until
    // now that sentence was enforced by nothing: `route.mjs` emitted the flag,
    // every consumer read the surfaces array beside it, and an unanswered
    // project was byte-identical to an answered one at every point after the
    // resolve. Measured on a sibling project 2026-08-19: seven blocking
    // `risk_surface` fires across three phases, the question never put to the
    // user, found only because the user asked why no scan had happened.
    //
    // A caller that NAMED `--surfaces` has already resolved the scope and is
    // untouched by this arm - the refusal is precisely for the caller that
    // let the default stand, because that default is the all-eight set nobody
    // chose. `detail` names the two commands that settle it rather than only
    // reporting the state, since the ask lives on this path alone
    // (`detect-surfaces` has no other caller in the tree).
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
  // The IDS the caller's refs name, resolved before anything is read: they are
  // this record's range identity, and `risk-check status` compares them rather
  // than the spellings (see resolveRange).
  //
  // THE END THAT RESOLVED IS KEPT whichever way the other one went. Both ids
  // used to be dropped the moment either ref failed, so a record left by a
  // caller who mistyped one end could not say which commit the OTHER end named,
  // and its reader could not tell a bad ref from a bad repository.
  // `resolveRange` returns `''` for the end git could not name and the full id
  // for the end it could, so only the FAILING end goes null here.
  let baseId = null;
  let headId = null;
  /**
   * The `git diff` argv this run's scope names, or null when the scope did not
   * resolve and there is nothing to read. Built per arm and READ once below, so
   * the two scopes share one catch rather than one each - which is also what
   * holds the `planning-detail-sites` census where it stands.
   *
   * Common to both: `-C top`, the way cmdLeaseCheck reads its staged set, so the
   * read is the repository's and not the cwd's, and the resolved IDS rather than
   * the spellings, so the body read is exactly the scope recorded. The trailing
   * `--` ends the revision list: a ref that also names a path cannot turn into a
   * pathspec here. REVIEWER_TEXT_PATHSPECS goes AFTER that separator, so that
   * rule holds for those arguments too, and the four record artifacts that store
   * reviewer text verbatim never reach `scanDiff` at all. See the constant for
   * why the fix is here and not in that face.
   *
   * `--no-ext-diff --no-textconv` are what make the EMPTY answer mean what
   * scanDiff reports it to mean. A `diff=<driver>` attribute in a checked-in
   * `.gitattributes` binds to a `diff.<driver>.command` or `.textconv` in the
   * reader's OWN git config, so a repository the user merely cloned can route
   * this read through a helper that prints nothing and exits 0 - and no attacker
   * is needed for it, since a `textconv` for pdf/docx in `~/.gitconfig` does it
   * by accident. `git diff <base> <head> --` then emits zero bytes for a file
   * whose changed line is a recursive delete, and scanDiff answers
   * `checked: true, empty: true, matches: []`: a COMPLETED clear on the one gate
   * that is blocking at every stakes level. Both flags are diff-generation
   * switches only - they change no id, no range and no exit status, so the
   * empty/unreadable split is untouched.
   * @type {string[] | null}
   */
  let diffArgs = null;
  if (staged) {
    // THE STAGED SCOPE, RESOLVED AS ONE END (the locked OQ-1 answer). This arm
    // sits BEFORE `resolveRange` is ever reached, so that function learns no
    // staged spelling and nothing that is not a rev passes `riskRef`: the index
    // is not a commit, so there is no ref a caller could have named for it and
    // a stand-in head would be a range nobody asked about. `resolveRef` is the
    // single-ref half `resolveRange` is itself built on, so both arms resolve a
    // ref through one function and one refusal vocabulary.
    //
    // `--cached` is what makes the scope the INDEX against the base: a file
    // written into the worktree and never added is outside this diff, which is
    // the point - the gate fires before the commit lands (git-guard.md:123) and
    // what it must judge is what is about to be committed.
    const b = resolveRef('base', base);
    baseId = b.id || null;
    if (!b.ok) diffError = b.error;
    else {
      diffArgs = ['-C', b.top, 'diff', '--cached', '--no-ext-diff', '--no-textconv', b.id, '--',
        ...REVIEWER_TEXT_PATHSPECS];
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
      // redactUrl first, the EXP-01 rail cmdLeaseCheck's `no-staged-set`
      // applies: a git failure detail can carry a remote URL with credentials.
      diffError = redactUrl(e && e.message ? e.message : String(e));
    }
  }

  const scan = scanDiff(body, categories);

  // Appended BEFORE the envelope is emitted, and on every path past argument
  // validation - the no-match path and the git-failure path included - so even
  // a refusal leaves the record saying the check was ATTEMPTED. `appendEvent`
  // never throws and never speaks; its `{written, reason}` rides the envelope
  // so a trace that could not be written is reported rather than silently
  // dropped, and it may NOT change the verdict.
  //
  // `plan` is the caller's OWN spelling, verbatim, exactly as a prose
  // `trace append --plan` stores it - the two must be one string or the receipt
  // settles nothing (D-01's stated cost). `risk-check status` stringifies both
  // sides before comparing, the way lib/trace.mjs's own `key()` does, so a
  // record written `1` and a bracket written `"1"` still join.
  const res = appendEvent(dir, {
    phase: parsedPhase.raw,
    family: 'outcome',
    event: 'risk_check',
    ...(plan === undefined ? {} : { plan }),
    // Both spellings AND both ids, always: the spelling is what the reader
    // recognises, the id is the range's identity. Written even when null, so a
    // record from a run that resolved nothing is visibly unidentifiable rather
    // than silently absent a field.
    base,
    // HONESTLY NULL on the staged arm, both spelling and id: the index is not a
    // commit, so there is no head this run had and writing the caller's absent
    // flag as `undefined` would drop the field a reader checks.
    head: staged ? null : head,
    base_id: baseId,
    head_id: headId,
    // ONLY THE STAGED ARM CARRIES IT. A ref-range row written before this arm
    // existed is honestly not staged, so its absence and a `false` would say the
    // same thing - which is not the case `empty` was in (D-03), where an absent
    // field marked a record the seam could not speak for.
    ...(staged ? { staged: true } : {}),
    checked: scan.checked,
    categories: scan.categories,
    // TOKENS on the record, the `{category, signal}` pairs on the envelope: the
    // record is joined and counted, the envelope is read by the fire site that
    // has to state a reason.
    matches: scan.matches.map((m) => m.category),
    inconclusive: scan.inconclusive,
    // The range was READ and held nothing - a completed check, not an
    // unchecked one (D-01/D-02). Written beside `checked` on the record and on
    // the envelope both, so the record a later `status` joins and the envelope
    // the coordinator reads cannot disagree about it.
    empty: scan.empty,
    // THE CAUSE, ON THE ROW and not on the envelope alone. Both failure arms -
    // an unresolved range and the `git diff` catch - appended a bare
    // `checked: false, inconclusive: true` with the redacted message reaching
    // only the envelope's `detail`, so a trace reader saw an inconclusive it
    // could proceed past and nothing on the record said why the range was never
    // read (smithers 2026-08-27T23:55:38 and 2026-08-28T14:28:12). `detail` is
    // the field trace rows already carry a free-text cause on - `override`'s
    // reason, `uat_verdict`'s result word - and this is the SAME redacted string
    // the envelope emits, so the record and the envelope cannot disagree about
    // the cause. A run that READ its range adds nothing.
    ...(diffError === null ? {} : { detail: diffError }),
  });

  const envelope = {
    phase: n,
    ...(plan === undefined ? {} : { plan }),
    base,
    head: staged ? null : head,
    base_id: baseId,
    head_id: headId,
    ...(staged ? { staged: true } : {}),
    checked: scan.checked,
    categories: scan.categories,
    matches: scan.matches,
    inconclusive: scan.inconclusive,
    empty: scan.empty,
    trace: { written: res.written, ...(res.reason ? { reason: res.reason } : {}) },
  };

  // A range that could not be READ is never ok: a caller must not be able to
  // take "git refused" for "clean".
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

/** The trigger a risk RECEIPT has to name. One constant, because the detector
 * that writes the record and the gate that fires on it are the same trigger,
 * and a second spelling is how the two halves start clearing each other. */
const RISK_TRIGGER = 'risk_surface';

/**
 * The five `outcome` event names a `risk_surface` fire can settle at, and the
 * whole vocabulary `risk-check status` accepts as proof the fire HAPPENED
 * (GAT-04):
 *   - `adjudication` - the adjudicated arm reported its survivors
 *   - `rearm`        - the one-round re-arm fired a narrowed second round
 *   - `gate_pass`    - the fire came back with nothing blocker/high
 *   - `override`     - the user cleared a FAIL deliberately, reason on file
 *   - `deferral`     - a gate resolved `deferred` queued what it found
 * `gate_pass` is here because the roadmap's stated acceptance set has no arm
 * for a clean pass and a blocking PASS wrote nothing: without it, every matched
 * range whose fire found no blocker would be permanently unclearable, and this
 * tree has already stated its verdict on that shape - an unclearable gate is
 * one that gets bypassed.
 *
 * `deferral` is the FIFTH name this list once said nothing produces, and what
 * produces it is the `deferred` gate mode: that arm runs the reviewer, persists
 * the findings and writes a queue member, then lets the run continue - it
 * settles by QUEUING rather than by adjudicating, so none of the four names
 * above describes it. It cannot borrow one either: `gate_pass` reads as a clean
 * gate in every downstream recount, and `override` is the coordinator's own
 * say-so, which is the manufactured clear the receipt machinery exists to
 * refuse. Without an accepted receipt of its own, `cmdRiskCheckStatus` reports
 * the matched range `unfired` forever and the run halts at exactly the step
 * deferring it was meant to let through.
 *
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

  // A NAMED RANGE IS ALL OF IT OR NONE OF IT. A plan number alone is not a
  // range identity, and a partly named one would read as the phase-wide arm and
  // pass on a record some other range left.
  //
  // What "all of it" is: `--plan <k> --base <ref>` plus EXACTLY ONE scope -
  // `--head <ref>` for a committed range, `--staged` for the index against the
  // base. The second is the OTHER half of the locked OQ-1 answer: `run` records
  // a staged scope, so the gate that reports on records has to be able to ask
  // about one, or a staged run would be written and never found.
  const given = ['plan', 'base', 'head', 'staged'].filter((f) => f in opts);
  const staged = 'staged' in opts;
  /** @type {{plan: string, base: string, head: string|null, base_id: string,
   *   head_id: string|null, staged?: boolean} | null} */
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
    // The SAME predicate `risk-check run` reads (D-02). One consultation each,
    // so the face that enforces the question and the face that reports it
    // cannot disagree about which spellings are keys at all.
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
    // The COMMIT PAIR is the identity, not the spelling (see resolveRange), so
    // the asked range is resolved here and compared as ids below. A ref that
    // cannot be resolved is a REFUSAL and never a match: a gate that shrugged
    // at an unresolvable range would answer about a range nobody can point at,
    // and the only safe answer to "which commits are these" is the one git
    // gives.
    //
    // The STAGED ask resolves its base ALONE, through the single-ref half
    // `resolveRange` is built on, and never reaches `resolveRange` at all: the
    // index is not a commit, so there is no second ref to hand it and a stand-in
    // head would be a range nobody asked about. Its `head_id` stays null, which
    // is also what makes a staged record and a ref-range record unable to match
    // each other below.
    let baseId;
    let headId = null;
    if (staged) {
      const b = resolveRef('base', base);
      if (!b.ok) {
        return emit({
          ok: false,
          reason: 'unresolved-range',
          phase: n,
          plan: parsedPlan.key,
          base,
          head: null,
          staged: true,
          detail: b.error,
          hint: 'name a --base this repository can resolve, then re-run this check',
        });
      }
      baseId = b.id;
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
      ...(staged ? { staged: true } : {}) };
  }

  // ONE reader of the record, through renderTrace and nothing else: a second
  // reader is how two readers of one record start disagreeing about what
  // closed, which is the reason renderTrace exposes its paired `brackets` at
  // all.
  const r = renderTrace(dir, parsedPhase.raw);

  /**
   * THIS RUN, not every cycle that ever used this phase number.
   *
   * `.planning/trace.jsonl` is append-only across the whole project and phase
   * numbers restart every milestone, so `--phase 1` reaches every previous
   * cycle's phase 1 - on this repository, seven prior runs' executor brackets,
   * two of them for a plan 2 that predates this seam. Scanning all of them
   * demanded a risk record for ranges committed under a v3.4.x cycle and made
   * the gate unsatisfiable on any project with more than one milestone of
   * history: the check built to stop "not run" passing as "ran clean" never
   * passed at all.
   *
   * The scope is `renderTrace`'s own `corr` - the id derived from the phase's
   * NEWEST anchor - which is the same identity the ONE-round re-arm cap in
   * references/triage-gate.md keys on ("a `rearm` outcome for this trigger
   * already recorded under that same id"), and the same id `appendEvent`
   * stamped on the record `risk-check run` wrote moments earlier. Both scans
   * take it, for one reason: a record left under a previous cycle's id must not
   * satisfy this cycle's range either, or scoping the brackets alone would
   * trade an unsatisfiable gate for a forgeable one.
   *
   * A trace with no readable id to scope by (`corr` null or empty, which
   * `requirePhaseArg` should already have made impossible) keeps the unscoped
   * behaviour: requiring MORE is the safe direction here, and silently matching
   * nothing would turn the whole gate into a blanket pass.
   */
  /**
   * THIS CYCLE, bounded by the phase's own last sign-off - not the newest
   * anchor alone.
   *
   * Scoping to `renderTrace`'s `corr` alone was too narrow in the other
   * direction. `workflows/execute.md` anchors each invocation at
   * `git rev-parse --short HEAD`, so a phase run across more than one
   * /cad-execute - a resumed session, a continuation after a checkpoint - takes
   * a DIFFERENT id the moment its first commits land, and every range the
   * earlier invocation completed fell outside the filter. That is the same
   * silence this gate exists to break, arriving as an exemption rather than an
   * absence.
   *
   * The bound is the phase's own `uat_verdict` `complete` outcome, which
   * `workflows/verify.md` appends when the phase passes: everything after the
   * newest one is the cycle in hand, everything at or before it belongs to a
   * cycle that was already signed off. `partial` is deliberately not a bound -
   * a partial UAT session is the middle of a cycle, and cutting there would
   * exempt the work that preceded it. A phase with no sign-off at all has
   * never completed, so its whole history IS the current cycle and nothing is
   * dropped.
   */
  // EPOCH MILLISECONDS, never the raw string. A lexicographic compare over
  // whatever `ts` happens to hold is a gate that opens on a typo: a sign-off
  // stamped `"zzzz"` sorts above every real ISO timestamp, so every completed
  // range in the file falls before the bound and the phase reports clean with
  // no rows at all. An unparseable timestamp is not a later one.
  const stamp = (/** @type {any} */ v) => {
    if (typeof v !== 'string') return null;
    const ms = Date.parse(v);
    return Number.isFinite(ms) ? ms : null;
  };

  let signoff = null;
  for (const e of r.events) {
    if (e.family !== 'outcome' || e.event !== 'uat_verdict' || e.detail !== 'complete') continue;
    // An unreadable sign-off is NOT a bound. It cannot say when the cycle
    // closed, and the only safe reading of "I do not know" here is that no
    // cycle closed - which requires more, never less.
    const ts = stamp(e.ts);
    if (ts === null) continue;
    if (signoff === null || ts > signoff) signoff = ts;
  }
  /**
   * Everything is in the cycle unless it can be PROVED to sit at or before a
   * readable sign-off. The direction is the whole point: an event carrying no
   * `ts`, an unparseable one, or one written by a clock that moved backwards
   * stays REQUIRED rather than silently exempt, because a completed range this
   * gate cannot place is exactly the range it must not clear. `>=`, not `>`,
   * for the same reason - an event sharing the sign-off's own instant is
   * ambiguous, and ambiguity resolves toward requiring the record.
   */
  const inCycle = (/** @type {{ts?: any}} */ e) => {
    if (signoff === null) return true;
    const ts = stamp(e.ts);
    return ts === null || ts >= signoff;
  };

  /** A row identity is the RUN and the plan together. Pairing a bracket with a
   * record under its own `corr` is what makes a multi-invocation phase answer
   * per invocation: the ranges invocation 1 completed need invocation 1's
   * records, and invocation 2 cannot clear them by checking its own. */
  const rowKey = (/** @type {any} */ corr, /** @type {any} */ plan) =>
    `${planKey(corr)}\u0000${planKey(plan)}`;

  /** Completed ranges, keyed by plan. A COMPLETED range is an executor bracket
   * whose terminal is a `return`; a `checkpoint` closed a dispatch that came
   * back unfinished and requires nothing. Grouping by plan is what makes a
   * checkpoint-then-return continuation count once rather than twice. */
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
   * A bracket carrying a key the worker-key grammar REFUSES (RSK-03).
   *
   * The ONE bounded exception to "status does not narrow" (D-01), and it is the
   * opposite of the exclusion arm that decision rejected. A key `lib/plan-key.mjs`
   * refuses is not a legal worker key at all, so `risk-check run --plan <it>`
   * can never write the record this gate would demand: requiring one leaves a
   * gate that is blocking at every stakes level permanently unsatisfiable, with
   * no exit but an `override`. So it is REPORTED, on its own `malformed` list,
   * rather than silently dropped - which is exactly what made the excluded-key
   * arm fail-open. A key the predicate ACCEPTS is never dropped.
   *
   * An ABSENT plan is NOT malformed and keeps its row: `risk-check run` with no
   * `--plan` writes a record that keys to '' and joins it, so an unidentified
   * completed range stays required, exactly as the row comment above says.
   * Nothing in the tree mints a refused key today - `workflows/execute.md` now
   * states the continuation key - so this guards the write face D-03 leaves
   * open on purpose, where `trace append --plan` still stores any non-empty
   * string.
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
  // A named range is required whether or not its return has landed yet: the
  // caller states the range it just committed, and a bracket that never paired
  // must not turn the gate off. It rides THIS invocation's id, which is the
  // one the caller is reporting for.
  if (wanted) planRow(r.corr, wanted.plan);

  /**
   * Every record the phase holds, keyed by plan, carrying its VERDICT fields
   * beside its refs - because a record is not the same thing as a check.
   * `risk-check run` appends on every path past argument validation, the
   * git-failure path included, so a `checked:false` line means the check was
   * ATTEMPTED and read no diff at all. Matching a ref pair off one of those and
   * reporting `recorded` is the exact state RSK-02 exists to refuse: completion
   * would pass on a check that never saw the range.
   *
   * `inconclusive` is the OPPOSITE call, deliberately. A `checked:true,
   * inconclusive:true` record IS a completed check - the seam read the range
   * and honestly reported that part of it cannot be judged - so it satisfies
   * this gate and rides the row with the flag visible rather than collapsed.
   * "An unjudged range is not a cleared one" is enforced at the FIRE site,
   * which is where a response to it exists: `workflows/execute.md` fires
   * `risk_surface` on `inconclusive: true` exactly as it does on a match.
   * Refusing here instead would make a range holding a binary file or a
   * submodule bump permanently unclearable - the caller cannot make git render
   * it - and an unclearable gate is one that gets bypassed.
   * @type {Map<string, {base: any, head: any, base_id: string|null, head_id: string|null,
   *   checked: boolean, inconclusive: boolean, staged: boolean}[]>}
   */
  const records = new Map();
  /** The same records keyed by PLAN alone, for the named-range arm. That arm
   * identifies a range by its resolved commit pair, which is a stronger
   * identity than the invocation that wrote it, so a record for exactly those
   * two commits satisfies it wherever in the cycle it was written.
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
      // The resolved ids the range is IDENTIFIED by, null when the record does
      // not carry them - a record written before `run` resolved its refs, or by
      // a run whose refs did not resolve. Null never matches, so such a record
      // reports `stale` and the range is re-run: the safe direction, and the
      // only one available, since the spelling it does carry cannot say which
      // commits it meant.
      base_id: typeof e.base_id === 'string' && e.base_id ? e.base_id : null,
      head_id: typeof e.head_id === 'string' && e.head_id ? e.head_id : null,
      // THE SCOPE THE RECORD WAS WRITTEN OVER. `=== true` for the reason every
      // verdict field below is: a ref-range row carries no such field at all,
      // and an absent one is not a staged scope. It is what keeps the two
      // scopes from satisfying each other in `sameRange`.
      staged: e.staged === true,
      // `=== true`, never truthiness: a record written by an older seam carries
      // neither field, and an absent verdict is not a passing one.
      checked: e.checked === true,
      inconclusive: e.inconclusive === true,
      // WHY a range with nothing in it is `recorded` and not a refusal. An
      // empty committed range is a check that RAN, so it arrives here
      // `checked: true, inconclusive: false, matches: []` and reaches
      // `recorded` through the arms below unaided - no fifth state name, which
      // `offending` (`row.state !== 'recorded'`) would turn into an automatic
      // `ok:false`, and no extra clause in `fired`. The flag is read for the
      // reader's sake alone: it rides the reported `records` array so an
      // auditor can see WHY a row is `recorded` with nothing matched.
      //
      // `=== true` for the reason stated two fields up: 69 `outcome/risk_check`
      // events on this repository's own trace were written before the seam
      // separated an empty range from an unread one, and an absent field is not
      // an empty range.
      empty: e.empty === true,
      // The category TOKENS `cmdRiskCheckRun` writes onto every record and this
      // reader used to drop. They are what makes a range FIRED: a record
      // carrying one is a range workflows/execute.md was obliged to fire the
      // blocking `risk_surface` gate on. A non-array (an older seam, a
      // hand-edited line) reads as no tokens, never as a match nobody can name.
      matches: Array.isArray(e.matches) ? e.matches.filter((m) => typeof m === 'string') : [],
      // A non-empty `matches` whose elements are not strings is a range the
      // detector MATCHED and this reader cannot name. Filtering it to `[]`
      // silently turned a fired range into a clean one, so the two cases are
      // separated: `matches` stays the tokens that can be reported, and this
      // flag carries "something matched" independently. Widening is the only
      // safe direction on the one gate that is blocking at every stakes level,
      // which is the same rule `inconclusive` already encodes.
      matched_unnamed: Array.isArray(e.matches) && e.matches.length > 0
        && e.matches.filter((m) => typeof m === 'string').length === 0,
    };
    records.get(k).push(rec);
    byPlan.get(p).push(rec);
  }

  /**
   * THE FIRE'S OWN RECEIPTS, keyed the same way the records are (GAT-04).
   *
   * The defect: `risk-check status` proved a range was READ and RECORDED, and
   * stopped there. A coordinator could run the detector, watch it match
   * `secrets`, skip the blocking `risk_surface` fire entirely and still be told
   * `ok:true` - the gate reporting success for the one thing it exists to make
   * unskippable. "The detector ran" and "the fire happened" are two different
   * claims, so they are two different receipts and this reader demands both.
   *
   * Five event names, because those are the five outcomes a fire can reach: the
   * adjudicated arm's `adjudication`, the capped re-arm's `rearm`,
   * references/triage-gate.md's two settle points - `gate_pass` when nothing
   * blocker/high survived, `override` when the user cleared a FAIL deliberately
   * - and `deferral`, which the `deferred` gate mode writes when it queues what
   * it found instead of halting. The list itself is FIRE_RECEIPTS, one
   * consultation, and its block comment states why each name is on it.
   *
   * The trigger is read off the STRUCTURED `trigger` field and never parsed out
   * of `detail` (D-12): measured on this repository's 35 `outcome/adjudication`
   * events the trigger is spelled four different ways in that free text, so a
   * reader that parsed it would clear a range on a spelling and refuse an
   * identical one on another.
   * Each receipt carries the row identity it was written under plus the RANGE
   * it settled, so a later matched range cannot ride in on an earlier fire.
   * @type {{key: string, sha: string|null, base: string|null}[]}
   */
  const receipts = [];
  for (const e of r.events) {
    if (!inCycle(e)) continue;
    if (e.family !== 'outcome' || !FIRE_RECEIPTS.includes(e.event)) continue;
    if (e.trigger !== RISK_TRIGGER) continue;
    // An `override` is the one receipt a coordinator writes on its OWN say-so
    // rather than as the settled outcome of a review, so it is the one that has
    // to carry a reason. Without this, `trace append --family outcome --event
    // override --trigger risk_surface --plan k` with no detail at all mints a
    // clear for a fire nobody made - the same manufactured-receipt shape the
    // structured `--trigger` field exists to refuse (D-12).
    if (e.event === 'override') {
      const why = typeof e.detail === 'string' ? e.detail.trim() : '';
      if (!why) continue;
    }
    receipts.push({ key: rowKey(e.corr, e.plan), sha: typeof e.sha === 'string' ? e.sha : null, base: typeof e.base === 'string' ? e.base : null });
  }

  /**
   * Does a receipt settle THIS range?
   *
   * The join used to be `rowKey(corr, plan)` alone, and that cleared every later
   * matched range for the plan on the strength of one earlier fire: run the
   * detector, fire once, fix something, re-run the detector on the widened
   * range, skip the second fire - and status still answered `ok:true`. That is
   * the defect GAT-04 exists to close, one level up inside the control itself.
   *
   * So a receipt names the range it settles, with `trace append --sha <head>`.
   * Short and full spellings both resolve to the same commit, so the comparison
   * is prefix-wise in whichever direction is shorter, exactly as a caller who
   * passed `git rev-parse --short HEAD` would expect.
   *
   * A receipt carrying NO sha settles nothing. That is the transition cost,
   * stated rather than hidden: a receipt that cannot say which range it judged
   * is the ambiguity this fix removes, and accepting it as a wildcard would
   * leave the hole open under a different name.
   */
  const shaMatches = (/** @type {string|null} */ a, /** @type {string|null} */ b) => {
    if (!a || !b) return false;
    const [x, y] = a.length <= b.length ? [a, b] : [b, a];
    return x.length >= 7 && y.startsWith(x);
  };
  /**
   * Does a receipt settle THIS ONE record?
   *
   * Both ends of the range, not the head alone: two records can share a head
   * and differ at the base, and they are then different diffs over different
   * risk surfaces. A receipt for `B..C` must not settle `A..C`.
   *
   * A record that carries no resolved ids has no range identity to bind to - it
   * predates those fields, or its refs did not resolve - so the join falls back
   * to the run and the plan for THAT record alone. The alternative is a range
   * no receipt can ever settle, and an unclearable gate is one that gets
   * bypassed. Every record `risk-check run` writes today carries the ids, so
   * this is the legacy arm, exactly as wide as the records that lack them.
   */
  const settledBy = (/** @type {any} */ rc, /** @type {any} */ f) => (
    f.head_id === null && f.base_id === null
      ? true
      // Both ends REQUIRED, never "matched if supplied". Letting a receipt with
      // no `--base` pass on the head alone reopened the widened-range bypass
      // under a different name: a fire over `B..C` would settle `A..C`, which
      // is a different diff over a different surface.
      : shaMatches(rc.sha, f.head_id) && shaMatches(rc.base, f.base_id));
  /**
   * EVERY fired record this row answers for needs its own receipt.
   *
   * `.some()` here was the blocker's second half: on the phase-wide arm
   * `satisfying` is every usable record for the plan, so one receipted range
   * cleared a later unreceipted one - the same defect the range binding closed
   * on the named arm, still open one branch over.
   */
  const settles = (/** @type {string} */ k, /** @type {any[]} */ satisfying) =>
    satisfying
      .filter((f) => f.matches.length > 0 || f.inconclusive || f.matched_unnamed)
      .every((f) => receipts.some((rc) => rc.key === k && settledBy(rc, f)));

  const rows = [...completed.entries()].map(([k, row]) => {
    const asked0 = wanted && planKey(wanted.plan) === planKey(row.plan)
      && row.run === (planKey(r.corr) === '' ? null : planKey(r.corr));
    const found = asked0 ? (byPlan.get(planKey(row.plan)) || []) : (records.get(k) || []);
    // Only a record whose read SUCCEEDED can satisfy the gate; the rest are
    // reported so the reader sees an attempt rather than an absence.
    const usable = found.filter((f) => f.checked);
    const asked = asked0
      ? { base: wanted.base, head: wanted.head, base_id: wanted.base_id, head_id: wanted.head_id,
        ...(wanted.staged ? { staged: true } : {}) }
      : null;
    // COMMIT IDS on both sides. Comparing the spellings is what let a record
    // left under `--head HEAD` satisfy a later, wider `--head HEAD` - the very
    // spelling workflows/execute.md documents for both calls.
    //
    // A STAGED ASK MATCHES A STAGED ROW AND NOTHING ELSE. The index has no
    // commit id, so its identity is the base it was read against plus the fact
    // that it WAS the index: a ref-range row over the same base is a different
    // scope entirely and must not answer for it. The reverse needs no clause -
    // a staged row's `head_id` is null, so the ref arm's own two-id test already
    // refuses it.
    const sameRange = (/** @type {{base_id: string|null, head_id: string|null, staged: boolean}} */ f) =>
      (asked.staged
        ? f.staged && f.base_id !== null && f.base_id === asked.base_id
        : f.base_id !== null && f.head_id !== null
          && f.base_id === asked.base_id && f.head_id === asked.head_id);
    // STALE, not satisfied: a plan re-dispatched over a widened range
    // (execute.md's "re-dispatch the remainder" arm) is exactly the case that
    // would otherwise pass on the record its earlier, narrower range left. Both
    // ref pairs are named so the reader can see which one it has. UNCHECKED is
    // the third state: the range was named and attempted, and nothing was read.
    //
    // The records that actually SATISFY the row, which is a narrower set than
    // `usable` on the named-range arm: only a record for the asked commit pair
    // answers there. Both the state below and the fire receipt read this same
    // set, so the row cannot be `recorded` on one record and judged fired on
    // another.
    const satisfying = asked ? usable.filter(sameRange) : usable;
    // A FIRED range: the detector read it and came back with category tokens or
    // with `inconclusive: true`, which is the pair of conditions
    // workflows/execute.md fires the blocking `risk_surface` gate on. Anything
    // else is a range the gate had no reason to fire on, and demanding a
    // receipt for it would refuse a clean phase.
    const fired = satisfying.some((f) => f.matches.length > 0 || f.inconclusive || f.matched_unnamed);
    // UNFIRED is the fifth state, and it sits ON TOP of the four above rather
    // than in place of any of them: a record that never read its range is still
    // `unchecked`, a stale one is still `stale`. This one is reached only where
    // the range WAS read and recorded, matched, and no receipt says the fire
    // that had to follow ever happened. The join is the row's own identity -
    // `rowKey(corr, plan)`, which for the asked row is the
    // `planRow(r.corr, wanted.plan)` this invocation registered.
    const state = asked
      ? (usable.some(sameRange) ? (fired && !settles(k, satisfying) ? 'unfired' : 'recorded')
        : found.some(sameRange) ? 'unchecked'
          : found.length ? 'stale' : 'missing')
      : (usable.length ? (fired && !settles(k, satisfying) ? 'unfired' : 'recorded')
        : (found.length ? 'unchecked' : 'missing'));
    // `matched_unnamed` is this reader's own conservative flag, not part of the
    // record a caller wrote, so it stays out of the reported shape - the rows
    // report what the trace holds.
    const pub = found.map(({ matched_unnamed: _u, ...rest }) => rest);
    return { ...row, state, records: pub, ...(asked ? { wanted: asked } : {}) };
  });

  const offending = rows.filter((row) => row.state !== 'recorded');
  if (offending.length) {
    // The hint names the step that is actually MISSING. Every offending row in
    // the `unfired` state has its record already: telling that caller to re-run
    // the detector would send it to re-do the half it did, and leave the gate
    // refusing for the same reason a second time. Where the offending set is
    // mixed, the record hint leads - the fire cannot be recorded for a range
    // nothing has read.
    const unfiredOnly = offending.every((row) => row.state === 'unfired');
    // Emitted directly rather than through fail(): its reason/detail/hint shape
    // has no channel for the list, and the list is the whole point of the
    // refusal - exactly as cmdLeaseCheck's `undeclared-files` arm reasons.
    return emit({
      ok: false,
      reason: unfiredOnly ? 'risk-fire-missing' : 'risk-record-missing',
      phase: n,
      plans: rows,
      missing: offending.map((row) => row.plan),
      // Never folded into `missing`: these are not ranges awaiting a record,
      // they are keys no record can be written for, and a caller sent to
      // `risk-check run --plan <one of them>` would be sent to a refusal.
      ...(malformed.size ? { malformed: [...malformed] } : {}),
      hint: unfiredOnly
        ? `fire the blocking ${RISK_TRIGGER} review for each plan listed and record its outcome`
          + ` (one of ${FIRE_RECEIPTS.join(', ')}) under this phase's correlation id and that plan,`
          + ' then re-run this check'
        : `run risk-check run --phase ${parsedPhase.raw} --plan <k> --base <ref> --head <ref>`
          + ' for each plan listed, then re-run this check',
    });
  }
  // Nothing to require is not a failure: a phase with no completed executor
  // range at all is ok:true with an empty list, or a gate here would block the
  // first plan of every phase. A malformed key rides the PASS too, for the
  // reason it exists: the reader has to be able to see that a bracket was
  // skipped rather than judged, and a pass that said nothing about it would be
  // the silent exclusion D-01 refused.
  ok({ phase: n, plans: rows, ...(malformed.size ? { malformed: [...malformed] } : {}) });
}

function cmdRiskCheck(dir, sub, opts) {
  if (sub === 'run') return cmdRiskCheckRun(dir, opts);
  if (sub === 'status') return cmdRiskCheckStatus(dir, opts);
  return fail('usage', 'risk-check <run|status>');
}

export { REVIEWER_TEXT_PATHSPECS, cmdRiskCheck, cmdRiskCheckRun, cmdRiskCheckStatus };
