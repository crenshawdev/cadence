// @ts-check
// trace-suggest.mjs - evidence-backed config suggestions read off the joined
// run record. The pure half of `planning.mjs trace suggest`: renderTrace()
// produces the render, this file turns it into suggestions, and the caller
// owns the envelope. No I/O here, deliberately - every rule is a pure
// function over the render so a test can pin exact outputs to exact traces.
//
// The posture is the triage gate's, applied to configuration: suggestions are
// INPUT to a decision the user makes, never applied by anything. Each carries
// its evidence inline (counts drawn from the record, not adjectives), the
// exact config key it concerns, and a kind:
//   - `suggest` - the record supports changing a key; the user decides.
//   - `info`    - a receipt worth seeing that asks for nothing.
//
// Every rule needs a floor of evidence before it speaks (MIN_* below). A
// suggestion computed from one event is a guess wearing a verdict, and the
// whole point of reading the trace is to not guess.
//
// A keyed suggestion also names WHICH WAY to move the key and what it holds now
// (SGT-01), and that is why `suggestFromRender` takes a second argument. The
// values behind those keys live on disk - the merged config layers, the gate
// ladder in `route-table.json`, the resolved task ceiling - and reading them
// here would end the purity above. So the CALLER resolves them and passes them
// in: `planning.mjs`'s `suggest` arm owns every read, this file owns every
// rule, and the argument is optional so a test can still call
// `suggestFromRender(render(...))` with one argument and get an honest "unset"
// rather than a throw. `direction` is assigned per RULE rather than by the
// caller (phase 5 plan-2 note): the caller cannot know whether R1 fired on its
// gate arm or its reviewer arm until these rules have run.

/**
 * @typedef {{kind: 'suggest'|'info', subject: string, evidence: string,
 *            action: string|null, direction?: 'raise'|'lower',
 *            current?: any, proposed?: any}} Suggestion
 * @typedef {{values?: Record<string, any>, gates?: string[], rungs?: string[],
 *            stakes?: string|null, checkpointTasks?: (number|null)[]}} Resolution
 * @typedef {{counts: Record<string, number>,
 *            roles: Record<string, {dispatches: number, tokens?: number, unrecorded?: number}>,
 *            events: any[],
 *            brackets?: {duration_ms?: number}[],
 *            coordinator?: {wall_ms: number, bracket_ms: number, residue_ms: number,
 *                           steps: {phase: any, step: any, ts: any, residue_ms: number}[]}}} RenderLike
 * @typedef {{roles: {role: string, brackets: number, touches: number, distinct: number,
 *                    ratio: number|null,
 *                    worst: {path: string, count: number, phase: any, plan: any}|null}[],
 *            joined: number, fileCarrying: number, coverage: number|null,
 *            coordinatorFiles: number}} InDispatchReads
 */

// Evidence floors. Below these a rule stays silent rather than extrapolating.
/**
 * R1's floor, counted in UNVETOED EMPTY fires - fires that adjudicated zero
 * survivors and were not the fire a re-arm round came back to fix - never in a
 * trigger's fires overall. A trigger that fires ten times and comes back empty
 * once is not evidence about the gate; two empty fires are the least that can
 * be.
 */
export const MIN_FIRES_FOR_GATE_SUGGESTION = 2;
export const MIN_DISPATCHES_FOR_RUNG_INFO = 4;
export const MIN_ESCALATIONS_FOR_RUNG_SUGGESTION = 2;
export const MIN_CHECKPOINTS_FOR_SIZE_SUGGESTION = 2;
/**
 * The coordinator receipt's floor, in milliseconds. Ten minutes: below that the
 * residue is dominated by the second or two between a step's marker and the
 * dispatch that follows it, which is a measurement artefact rather than time
 * anyone spent. The other floors count events; this one cannot, because one
 * marker can carry a whole afternoon and a hundred can carry nothing.
 */
export const MIN_RESIDUE_MS_FOR_COORDINATOR_INFO = 600000;

/**
 * R7's floor, PER ROLE, and the map is the gate rather than the number: a role
 * this object does not name never produces an in-dispatch entry whatever its
 * ratio.
 *
 * Only two roles are named because only two showed signal.
 * `.planning/spikes/read-set-redundancy/SPIKE.md` measured, in-dispatch:
 * `cad-executor` 3.64 over 78 dispatches, `cad-verifier` 2.05 over 31,
 * `cad-planner` 1.88, `cad-assumptions-analyzer` 1.78, `cad-reviewer` 1.74.
 * The last three sit in a band the spike calls noise - a rule firing on them
 * spends the user's attention to save nothing - so a global threshold picked
 * low enough to keep `cad-verifier` would speak on all five.
 *
 * The two numbers, derived rather than chosen:
 *   - `cad-verifier` sits at the spike's own C2 bar of 2.0, the level at which
 *     it declared the redundancy real, and clears it at 2.05.
 *   - `cad-executor` sits ABOVE that bar because that role legitimately returns
 *     to a file once per task across up to `workflow.max_plan_tasks` tasks in
 *     one dispatch, so the same 2.0 would report ordinary per-task work as
 *     repetition. 3.00 leaves it speaking on today's 3.64 and goes quiet on a
 *     real improvement, which is the whole test of a floor.
 */
export const IN_DISPATCH_FLOORS = Object.freeze({
  'cad-executor': 3.00,
  'cad-verifier': 2.00,
});

/**
 * The three sources the recorded token total DOES NOT include, in the words
 * every reader of that total states.
 *
 * Exported and frozen for the reason `lib/trace.mjs` exports
 * `DISPATCH`/`TERMINAL`/`ANCHOR` rather than letting the bracket census hold
 * its own copy of them: this claim has TWO readers - R5's `evidence` string
 * below, which `/cad-suggest` relays unchanged, and the spend line in
 * `cadence-core/workflows/report.md` - and a second copy of the list is green
 * on the day the two stop claiming the same thing. `prose-agreement.test.mjs`
 * reads THIS array to check the prose, so there is one list and one claim.
 *
 * Why these three, and why they are not a hedge:
 *   1. the orchestrator's own turns - a figure is read off a subagent RETURN
 *      and the coordinator has no return, so it contributes nothing to a total
 *      that most of the run's spend belongs to;
 *   2. cross-model provider calls - no lifecycle bracket and no token field on
 *      that arm at all, by design;
 *   3. figureless returns - a close that carried no `--tokens`, the advisory
 *      fire among them, counted under `unrecorded` rather than as a zero.
 *
 * No fourth entry is a ratio or a correction factor, and none is coming: the
 * terms are what MSR-03 and PLN-01 need, and a stored product is the
 * maintenance loop `v2.7.0` deleted.
 */
export const SPEND_EXCLUDES = Object.freeze([
  "the orchestrator's own turns",
  'cross-model provider calls',
  'figureless returns',
]);

/**
 * A duration in whole minutes, the unit a run record is read in.
 * @param {number} ms
 */
function minutes(ms) {
  return `${Math.round(ms / 60000)} min`;
}

/**
 * The value a config layer (or the caller's schema-default fallback) holds for
 * `key`, or `undefined` when nothing does. `null` reads as nothing on purpose:
 * that is the schema sentinel for "no layer pins this, the stakes level decides
 * it", not a value anybody set.
 * @param {Resolution|undefined} resolution
 * @param {string} key
 */
function resolved(resolution, key) {
  const values = resolution && typeof resolution.values === 'object' && resolution.values
    ? resolution.values
    : null;
  if (!values) return undefined;
  const v = /** @type {any} */ (values)[key];
  return v === undefined || v === null ? undefined : v;
}

/**
 * What an unset key prints as `current`: the refusal `config.mjs get` makes, in
 * the same words and for the same reason (D-06). It names the DECIDER - the
 * stakes level the record carries - and never the value that level would fire,
 * because printing an effective value invites the user to set it and pin the
 * key at every level, which is the pinning the schema's own purpose text warns
 * about. A record carrying no `routing/resolve` event names no level rather
 * than one it does not carry.
 * @param {Resolution|undefined} resolution
 */
function unsetCurrent(resolution) {
  const level = resolution && typeof resolution.stakes === 'string' && resolution.stakes.trim()
    ? resolution.stakes.trim()
    : null;
  return level
    ? `unset: no config layer pins this, so the stakes level (${level}) decides it`
    : 'unset: no config layer pins this, so the stakes level decides it';
}

/**
 * `current` and, where one can be READ rather than guessed, `proposed` - as the
 * fragment a suggestion spreads into itself. `proposed` is OMITTED rather than
 * set to null or 0 (D-07/D-12), the omit-not-zero rule `--turns` already
 * follows: a key nobody computed a target for must be invisible, not zero.
 * @param {Resolution|undefined} resolution
 * @param {string} key
 * @param {(current: any) => any} [target] priced only when the key is SET
 */
function keyState(resolution, key, target) {
  const value = resolved(resolution, key);
  const proposed = value === undefined || !target ? undefined : target(value);
  return {
    current: value === undefined ? unsetCurrent(resolution) : value,
    ...(proposed === undefined ? {} : { proposed }),
  };
}

/**
 * The rung the record shows a role's escalated resolves landing on, kept only
 * where it names an actual RAISE. A rung a config layer SET is compared against
 * it on the caller's rung ladder and must sit strictly BELOW it, so a target
 * equal to the current rung - a retune that changes nothing - or under it -
 * a target contradicting the `raise` it ships beside - is omitted instead.
 * An UNSET key has no rung to compare and keeps the target: the record's rung
 * is still a change from a default nobody stated. No ladder means no
 * comparison and no target, the same omission `oneStepDown` reports.
 * @param {Resolution|undefined} resolution
 * @param {string} key
 * @param {string|undefined} rung
 */
function raiseTarget(resolution, key, rung) {
  if (!rung) return undefined;
  const current = resolved(resolution, key);
  if (current === undefined) return rung;
  const rungs = resolution && Array.isArray(resolution.rungs) ? resolution.rungs : null;
  if (!rungs) return undefined;
  const i = rungs.indexOf(current);
  return i >= 0 && rungs.indexOf(rung) > i ? rung : undefined;
}

/**
 * One step DOWN the gate ladder `route-table.json` states, or `undefined` when
 * there is no ladder, the value is not on it, or it is already the bottom rung.
 * The ladder is the caller's: an absent one omits `proposed`, and that omission
 * IS the report - no ladder is substituted from memory here.
 * @param {string[]|undefined} gates
 * @param {any} value
 */
function oneStepDown(gates, value) {
  if (!Array.isArray(gates)) return undefined;
  const i = gates.indexOf(value);
  return i > 0 ? gates[i - 1] : undefined;
}

/**
 * Parse an adjudication EVENT: the trigger and survivor count out of its
 * `<trigger>: <n> survivors; voices <...>` detail line (review-triggers.md
 * step 5's shape), and the RAISED count - how many findings the reviewers put
 * up before adjudication killed them.
 *
 * A bare detail STRING is accepted as well as the event, because the trigger
 * and survivor half has always been readable from the string alone and callers
 * that only hold one must keep working.
 *
 * Resolution order for `raised`, and it is the whole point of the widening:
 *   1. the event's structured `raised` field (planning.mjs `--raised`);
 *   2. else a legacy `of <m>` clause written into the detail by hand, before
 *      the flag existed - read only immediately after the survivor count, so a
 *      stray "of" further down the voice list cannot be mistaken for one;
 *   3. else `null`, meaning UNKNOWN - never 0. A fire whose raised count
 *      nobody recorded is not a fire that raised nothing, and collapsing the
 *      two is the exact conflation the flag exists to end.
 *
 * The trigger/survivor regex stays as permissive as it has always been: D-03
 * measured that tightening it drops the historical fires already on disk and
 * takes R1's evidence floor down with them.
 *
 * A RE-ARM round's adjudication is spelled `<trigger> rearm:` or
 * `<trigger> re-arm:` on disk - both spellings live in this project's own
 * record, written by hand months apart - and both read as the BASE trigger
 * carrying `rearm: true` (D-04). Never a trigger of its own: that would mint
 * the phantom config key `review.triggers.risk_surface rearm.gate`, which this
 * file's own schema test refuses. Those two spellings are the ONLY embedded
 * space admitted; any other token with a space in it stays unparseable exactly
 * as it is today, because counting it as a fire would feed R1 evidence it does
 * not have.
 * @param {unknown} input an adjudication event, or its detail string
 * @returns {{trigger: string, survivors: number, raised: number|null,
 *            rearm: boolean}|null}
 */
export function parseAdjudication(input) {
  const event = typeof input === 'string' ? { detail: input } : input;
  if (!event || typeof event !== 'object') return null;
  const detail = /** @type {any} */ (event).detail;
  if (typeof detail !== 'string') return null;
  const trimmed = detail.trim();
  const m = /^([a-z_]+)(?:\s+(re-?arm))?:\s*(\d+)\s+survivors?\b/.exec(trimmed);
  if (!m) return null;
  const field = /** @type {any} */ (event).raised;
  let raised = null;
  if (typeof field === 'number' && Number.isInteger(field) && field >= 0) {
    raised = field;
  } else {
    const legacy = /^\s*of\s+(\d+)\b/.exec(trimmed.slice(m[0].length));
    if (legacy) raised = Number(legacy[1]);
  }
  return { trigger: m[1], survivors: Number(m[3]), raised, rearm: Boolean(m[2]) };
}

/**
 * All suggestions the render supports, most actionable first (`suggest`
 * before `info`, then by subject for a stable order tests can pin).
 * @param {RenderLike} render
 * @param {Resolution} [resolution] the values the caller read off disk for the
 *   keys these rules name - absent, every keyed suggestion still carries a
 *   direction and reports its `current` as unset.
 * @param {InDispatchReads} [reads] the per-role in-dispatch file figures
 *   `lib/read-trace.mjs`'s `inDispatchReads` folded off `.planning/reads.jsonl`,
 *   for the same reason `resolution` is a parameter and not a read: the rules
 *   stay pure and the caller owns every open. Absent - which is every one- and
 *   two-argument call - R7 stays silent and nothing else changes.
 * @returns {Suggestion[]}
 */
export function suggestFromRender(render, resolution, reads) {
  /** @type {Suggestion[]} */
  const out = [];
  const events = Array.isArray(render.events) ? render.events : [];

  // --- gather ---------------------------------------------------------------
  // One row per FIRE, in file order, because that is the unit a re-arm veto
  // acts on (D-03). A trigger's lifetime totals cannot carry the veto: nothing
  // prunes `.planning/trace.jsonl` at a close, so a re-arm recorded in one
  // cycle muted its trigger four cycles after the gate stopped finding
  // anything. The record now ROTATES at its size bound (TRC-08), which bounds
  // "the life of the file" at that cut rather than leaving it permanent - and
  // changes nothing here: a bound measured in mebibytes is not a scoping rule,
  // and one row per fire is what makes the veto act on the fire it belongs to.
  /** @type {{corr: string, trigger: string, survivors: number, raised: number|null,
   *          rearm: boolean, vetoed: boolean}[]} */
  const fires = [];
  /** @type {Set<string>} */
  const rearmed = new Set();
  /**
   * The correlation id an event joins on, as a comparable string.
   * @param {any} e
   */
  const corrOf = (e) => (typeof e.corr === 'string' || typeof e.corr === 'number' ? String(e.corr) : '');
  /**
   * Per role: the resolve counts R3 reads, and the rung its ESCALATED resolves
   * actually landed on, off the `effort` field those events carry. That rung is
   * R3's `proposed` - a rung the routing table really resolved for this role,
   * rather than a legal one it would never produce (D-07).
   * @type {Map<string, {resolves: number, escalated: number, rung?: string}>}
   */
  const rungs = new Map();
  /** @type {Map<string, number>} */
  const checkpoints = new Map();

  for (const e of events) {
    if (!e || typeof e !== 'object') continue;
    if (e.family === 'outcome' && e.event === 'adjudication') {
      const parsed = parseAdjudication(e);
      if (!parsed) continue;
      fires.push({
        corr: corrOf(e),
        trigger: parsed.trigger,
        survivors: parsed.survivors,
        raised: parsed.raised,
        rearm: parsed.rearm,
        vetoed: false,
      });
    } else if (e.family === 'outcome' && e.event === 'rearm') {
      const trigger = typeof e.detail === 'string' ? e.detail.trim() : '';
      if (!trigger) continue;
      rearmed.add(trigger);
      // The veto lands on exactly ONE fire: the nearest fire BEFORE this one in
      // the same `(corr, trigger)` group - the fire that forced the round.
      // Nearest rather than oldest, because an earlier fire in the same phase
      // was answered by its own adjudication and this round says nothing about
      // it. A re-arm round's OWN adjudication is skipped: it is the second
      // round's RESULT, not the fire that forced the round. A fire already
      // vetoed is skipped too, so two re-arms mute two fires rather than one.
      const corr = corrOf(e);
      for (let i = fires.length - 1; i >= 0; i--) {
        const f = fires[i];
        if (f.trigger === trigger && f.corr === corr && !f.rearm && !f.vetoed) {
          f.vetoed = true;
          break;
        }
      }
    } else if (e.family === 'routing' && e.event === 'resolve') {
      const role = typeof e.role === 'string' ? e.role : '';
      if (!role) continue;
      const row = rungs.get(role) || { resolves: 0, escalated: 0 };
      row.resolves++;
      // Either spelling of a climb counts: the seam's own `escalated` flag, or
      // a retry attempt (`--attempt 2`) that lands on the retry rung.
      if (e.escalated === true || (typeof e.attempt === 'number' && e.attempt >= 2)) {
        row.escalated++;
        if (typeof e.effort === 'string' && e.effort.trim()) row.rung = e.effort.trim();
      }
      rungs.set(role, row);
    } else if (e.family === 'lifecycle' && e.event === 'checkpoint') {
      const role = typeof e.role === 'string' ? e.role : '';
      if (!role) continue;
      checkpoints.set(role, (checkpoints.get(role) || 0) + 1);
    }
  }

  // --- rules ----------------------------------------------------------------
  // R1: an adjudicated trigger that keeps coming back empty. Read a FIRE at a
  // time: a fire counts as evidence when it adjudicated zero survivors and no
  // re-arm came back to it - a gate that forced a fix round has already paid
  // for itself on THAT fire, whatever its adjudication said, and says nothing
  // about the other fires the same trigger had. The evidence names the empty
  // count out of the trigger's fires overall, so a reader sees the productive
  // fires beside the empty ones instead of a bare total.
  //
  // Two OUTCOMES on the same evidence floor, because "nothing survived" means
  // two opposite things (D-16). Nothing raised at all is a gate finding
  // nothing; nine raised and nine killed is a gate doing real work in front of
  // a reviewer that cannot tell a finding from an opinion - and proposing to
  // turn that gate off is the wrong move on the same row. The raised total is
  // summed over the EMPTY fires alone, and an UNKNOWN raised count contributes
  // 0 rather than being invented, so every trace written before `--raised`
  // existed keeps landing on the gate arm it lands on today.
  /** @type {Map<string, {total: number, empty: number, raised: number}>} */
  const triggers = new Map();
  for (const f of fires) {
    const row = triggers.get(f.trigger) || { total: 0, empty: 0, raised: 0 };
    row.total++;
    if (!f.vetoed && f.survivors === 0) {
      row.empty++;
      row.raised += f.raised === null ? 0 : f.raised;
    }
    triggers.set(f.trigger, row);
  }
  for (const [trigger, row] of [...triggers.entries()].sort()) {
    if (row.empty >= MIN_FIRES_FOR_GATE_SUGGESTION) {
      // The two arms move OPPOSITE ways, which is the whole reason the split
      // exists: the gate arm's evidence is fires that keep coming back empty,
      // so the move is DOWN the ladder; the reviewer arm's evidence is a gate
      // catching work in front of a reviewer set that killed all of it, so the
      // move is to STRENGTHEN that set. `raise`/`lower` is the whole vocabulary
      // - widening it is a schema-shaped decision, and `lower` on the reviewer
      // arm would name the opposite move.
      out.push(row.raised > 0
        ? {
          kind: 'suggest',
          subject: `${trigger} reviewers`,
          evidence: `${row.empty} of ${row.total} adjudicated fire(s), 0 survivors of ${row.raised} raised`
            + ' - the gate caught work; the reviewer set is what looks miscalibrated',
          action: 'review.reviewers',
          direction: 'raise',
          // No `proposed`: which backend to add is not a thing the record
          // names, and a guessed reviewer set beside two measured targets is
          // the credibility the no-fabricated-figures guardrail protects.
          ...keyState(resolution, 'review.reviewers'),
        }
        : {
          kind: 'suggest',
          subject: trigger,
          evidence: `${row.empty} of ${row.total} adjudicated fire(s), 0 survivors, no re-arm`,
          action: `review.triggers.${trigger}.gate`,
          direction: 'lower',
          // Priced only off a value a LAYER set: an unset gate has no position
          // on the ladder to step down from, and reading the level's value to
          // find one is exactly what D-06 refuses.
          ...keyState(resolution, `review.triggers.${trigger}.gate`,
            (current) => oneStepDown(resolution && resolution.gates, current)),
        });
    }
  }

  // R2: a gate that caught real work. Receipt only - nothing to change.
  for (const trigger of [...rearmed].sort()) {
    out.push({
      kind: 'info',
      subject: trigger,
      evidence: 'a fire FAILed and re-armed on its own fix - the gate caught real work; keep it',
      action: null,
    });
  }

  // R3: escalation pressure per role, both directions.
  for (const [role, row] of [...rungs.entries()].sort()) {
    if (row.escalated >= MIN_ESCALATIONS_FOR_RUNG_SUGGESTION) {
      // The target is a rung the record SHOWS this role's escalated resolves
      // landing on, never a step guessed off `rung_order`: a rung the routing
      // table actually resolved cannot be one the table would never produce.
      // It still has to name a CHANGE against the rung in force - see
      // `raiseTarget`.
      const proposed = raiseTarget(resolution, `model.effort.${role}`, row.rung);
      out.push({
        kind: 'suggest',
        subject: role,
        evidence: `${row.escalated} of ${row.resolves} resolves climbed to the retry rung`,
        action: `model.effort.${role}`,
        direction: 'raise',
        ...keyState(resolution, `model.effort.${role}`),
        ...(proposed ? { proposed } : {}),
      });
    } else if (row.escalated === 0 && row.resolves >= MIN_DISPATCHES_FOR_RUNG_INFO) {
      out.push({
        kind: 'info',
        subject: role,
        evidence: `start rung held across ${row.resolves} resolves, 0 escalations`,
        action: null,
      });
    }
  }

  // R4: executor checkpoint pressure. A checkpoint is a fresh-context
  // continuation paid at full dispatch price; repeated ones say the plans are
  // outrunning one context.
  //
  // SUPPRESSED - not returned with a caveat - when every checkpoint it counted
  // maps to a readable plan whose task count is UNDER the resolved ceiling
  // (D-08). A suggestion the evidence does not support is the thing that made
  // `/cad-suggest` read as a report rather than advice: telling a user to lower
  // a ceiling their plans never reached is a sentence they can only ignore, and
  // a caveat printed beside it still leaves the retune list to be sorted by
  // hand. This is a new class of check, not a tightened floor - the four MIN_*
  // constants above are untouched.
  //
  // The comparison is against the ceiling the suggestion PRINTS as `current`,
  // never a hardcoded 8 (D-10): a project that raised it to 12 must not be told
  // to lower one its plans never touched. An unknown count - a checkpoint whose
  // plan file cannot be read - is never under-ceiling (D-09), so a single one
  // leaves the rule speaking; a count EQUAL to the ceiling is not under it
  // either. And with no ceiling resolved at all, or no per-checkpoint counts
  // passed, there is nothing to bind against and the rule speaks exactly as it
  // did before this check existed.
  const execCp = checkpoints.get('cad-executor') || 0;
  const ceiling = resolved(resolution, 'workflow.max_plan_tasks');
  const counted = resolution && Array.isArray(resolution.checkpointTasks)
    ? resolution.checkpointTasks
    : [];
  const bounded = typeof ceiling === 'number' && Number.isFinite(ceiling)
    && counted.length === execCp && execCp > 0
    && counted.every((n) => typeof n === 'number' && Number.isFinite(n) && n < ceiling);
  if (execCp >= MIN_CHECKPOINTS_FOR_SIZE_SUGGESTION && !bounded) {
    out.push({
      kind: 'suggest',
      subject: 'cad-executor',
      evidence: `${execCp} checkpoint return(s) - plans may exceed one context`,
      action: 'workflow.max_plan_tasks',
      direction: 'lower',
      // No `proposed`, and none is derivable: no field in the record names a
      // plan's task count, so the only target available would be a number
      // invented here (D-07). The key is OMITTED rather than sent as null.
      ...keyState(resolution, 'workflow.max_plan_tasks'),
    });
  }

  // R5: the spend receipt. Names where the recorded tokens went and what that
  // total is NOT - the three `SPEND_EXCLUDES` names ride the evidence string
  // rather than the envelope, because `workflows/suggest.md` relays evidence
  // unchanged and adds no flag, so this is the only way the caveat reaches a
  // `/cad-suggest` reader at all. Asks for nothing: still `kind: 'info'`,
  // still `action: null`, still silent when no role carried a figure, and the
  // only arithmetic is the share it already computed.
  const roles = render.roles && typeof render.roles === 'object' ? render.roles : {};
  let top = null;
  let total = 0;
  for (const [role, row] of Object.entries(roles)) {
    const t = typeof row.tokens === 'number' && Number.isFinite(row.tokens) ? row.tokens : 0;
    total += t;
    if (t > 0 && (!top || t > top.tokens)) top = { role, tokens: t };
  }
  if (top && total > 0) {
    out.push({
      kind: 'info',
      subject: top.role,
      evidence: `largest recorded spend: ${top.tokens.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} recorded tokens (${Math.round((top.tokens / total) * 100)}%); excludes ${SPEND_EXCLUDES.join(', ')}`,
      action: null,
    });
  }

  // R6: the coordinator's own share of the run. The counterpart to R5 - that
  // one names where the TOKENS went, this one names the time no worker was
  // billed for. Receipt only, and `action` is null on purpose: no
  // `config.schema.json` key governs coordinator spend, and this file's own
  // test refuses an action naming a key the schema lacks.
  //
  // The figure it relays is CORR-SCOPED (phase 5 D-01): `lib/trace.mjs` keys the
  // residue accumulators on `corr`, so each run's last marker closes at that
  // run's own last event and no window spans the clock between two runs that
  // share a phase number. A `--phase` render can still pool several runs, and
  // this receipt then relays the sum of their windows - never a span across
  // them. The evidence string below is unchanged byte for byte: D-02 keeps the
  // name, which the corrected arithmetic earns rather than outgrows.
  //
  // SILENT on a render with no `coordinator` block, never an "absent
  // coordinator record" line (D-06). Every trace written before the marker
  // existed - Cadence's own and the committed fixture - would otherwise gain a
  // suggestion line saying nothing about the run it read.
  const coord = render.coordinator;
  const residue = coord && typeof coord.residue_ms === 'number' && Number.isFinite(coord.residue_ms)
    ? coord.residue_ms
    : null;
  if (residue !== null && residue >= MIN_RESIDUE_MS_FOR_COORDINATOR_INFO) {
    // The figures are the render's own (lib/trace.mjs computes the residue
    // once, so this rule and `/cad-report` cannot disagree); the only
    // arithmetic here is the share, and it is skipped rather than divided by a
    // zero or absent wall.
    const steps = Array.isArray(coord.steps) ? coord.steps : [];
    /** @type {{step: any, residue_ms: number}|null} */
    let top = null;
    for (const s of steps) {
      if (!s || typeof s !== 'object') continue;
      const ms = typeof s.residue_ms === 'number' && Number.isFinite(s.residue_ms) ? s.residue_ms : 0;
      if (!top || ms > top.residue_ms) top = { step: s.step, residue_ms: ms };
    }
    const wall = typeof coord.wall_ms === 'number' && Number.isFinite(coord.wall_ms) ? coord.wall_ms : 0;
    const share = wall > 0 ? ` (${Math.round((residue / wall) * 100)}% of wall time)` : '';
    const named = top && typeof top.step === 'string' && top.step
      ? `, most of it at \`${top.step}\` (${minutes(top.residue_ms)})`
      : '';
    out.push({
      kind: 'info',
      subject: 'coordinator',
      evidence: `coordinator time between worker brackets: ${minutes(residue)}${share}${named}`,
      action: null,
    });
  }

  // R7: in-dispatch re-reading, per role. `.planning/reads.jsonl` has recorded
  // what a worker actually OPENED for four cycles and nothing has ever acted on
  // the number; this is the rule that does.
  //
  // `action` is null, and that is this phase's ANSWER rather than an omission:
  // no key in `cadence-core/config.schema.json` governs in-dispatch re-reading.
  // The falsifying check was run over all 78 keys - counted as
  // `Object.keys(schema.keys).length`, so the denominator is re-runnable - and
  // the three closest candidates all fail:
  //   - `workflow.max_dispatch_tokens.<role>` is report-only by its own purpose
  //     text; moving it changes when `trace window` complains, never what a
  //     worker opens.
  //   - `workflow.max_plan_tasks` counts TASKS. It was re-decided at 8 in
  //     `v3.5.3` under PLN-01 against cold-prefix cost and context risk,
  //     neither of which is in-dispatch re-reading, and lowering it moves the
  //     same file opens into MORE dispatches rather than removing them -
  //     improving this ratio while raising the bill. R4 above already moves
  //     that key on checkpoint evidence, so a second rule moving it on
  //     unrelated evidence would put two entries for one key in the same list.
  //   - `model.effort.*` and `model.overrides.*` choose a rung and a model.
  // The remedy that does exist is DISCIPLINE rather than configuration -
  // symbol or line anchors on a plan's `files:` entries, and targeted reads
  // over whole-file ones - filed at `.planning/CAPTURE.md:271` as parts 2 and 3
  // of a three-part fix whose part 1 is the unshipped `workflow.max_plan_tokens`.
  // Minting a key here to have somewhere to point would ship a key nothing
  // reads. So the entry names the remedy in WORDS, exactly the precedent R6
  // sets with its own null action.
  //
  // Everything the entry has to state rides the EVIDENCE string - the
  // direction, the coverage, the scope and the exclusion - because
  // `cadence-core/workflows/suggest.md` relays evidence unchanged and adds no
  // flag, the same reason R5 carries `SPEND_EXCLUDES` there rather than on the
  // envelope. The `Suggestion` vocabulary stays closed: an info entry gains no
  // `direction`, `current` or `proposed`, which this file's own D-12 test pins
  // and which `suggest.md`'s ask step depends on, since it builds
  // `/cad-config <key>=<value>` tokens out of `action` plus `proposed`.
  //
  // SILENT - nothing at all, never an entry saying nothing - when the argument
  // is absent, the role is not in `IN_DISPATCH_FLOORS`, the ratio is null, or
  // the ratio is under the role's floor. A null ratio is never rendered as `0`:
  // that is the reading which says the worker opened each file once.
  const inDispatch = reads && Array.isArray(reads.roles) ? reads.roles : [];
  for (const row of inDispatch) {
    if (!row || typeof row !== 'object') continue;
    const floor = Object.prototype.hasOwnProperty.call(IN_DISPATCH_FLOORS, row.role)
      ? IN_DISPATCH_FLOORS[/** @type {keyof typeof IN_DISPATCH_FLOORS} */ (row.role)]
      : undefined;
    if (floor === undefined) continue;
    const ratio = typeof row.ratio === 'number' && Number.isFinite(row.ratio) ? row.ratio : null;
    if (ratio === null || ratio < floor) continue;
    const worst = row.worst;
    // A non-null ratio has at least one counted file behind it, so this guard
    // is unreachable - it is here so the sentence below can never name a file
    // nothing measured.
    if (!worst || typeof worst.path !== 'string') continue;
    const where = worst.phase == null && worst.plan == null
      ? ''
      : ` (phase ${worst.phase ?? '?'}, plan ${worst.plan ?? '?'})`;
    const coverage = typeof reads.coverage === 'number' && Number.isFinite(reads.coverage)
      ? `${Math.round(reads.coverage * 100)}% of the joined reads in scope, the share that recorded file paths`
      : 'an unmeasured share of the joined reads in scope';
    const excluded = typeof reads.coordinatorFiles === 'number' && Number.isFinite(reads.coordinatorFiles)
      ? reads.coordinatorFiles
      : 0;
    out.push({
      kind: 'info',
      subject: row.role,
      evidence: `in-dispatch re-reading: ${ratio} opens per distinct file inside one dispatch`
        + ` over ${row.brackets} dispatch(es), and DOWN is the direction that helps`
        + ` - worst inside one dispatch: read \`${worst.path}\` ${worst.count} times${where}.`
        + ` Computed over ${coverage}.`
        + ' SCOPE: nothing prunes `.planning/reads.jsonl` at a milestone close, so an unscoped run'
        + ' reaches every milestone still in that file.'
        + ` Excludes ${excluded.toLocaleString('en-US')} coordinator read(s) carrying files:`
        + ' the main thread has no dispatch bracket by construction, so its re-reading cannot be'
        + ' attributed to one and cannot be measured here.'
        + ' No key in `config.schema.json` governs in-dispatch re-reading - the remedy is discipline, not'
        + " configuration: symbol or line anchors on a plan's `files:` entries, and targeted reads"
        + ' over whole-file ones.',
      action: null,
    });
  }

  // R8: the worker wall clock, the receipt denominated in the figure the HOST
  // reported for the worker itself. The counterpart to R6 from the other end:
  // that one names the time no worker was billed for, this one names the time
  // the workers themselves reported. Receipt only, `action` null, for R6's
  // reason - no `config.schema.json` key governs how long a worker runs.
  //
  // The two clocks are named APART in the evidence, the way `lib/trace.mjs`'s
  // `TraceRender` typedef names them under TWO ELAPSED FIGURES: a bracket's
  // `ms` is dispatch-to-close and includes whatever the orchestrator did
  // between the two writes, while `duration_ms` is what the host reported for
  // the worker. A reader handed one figure and no name for it would price a
  // worker with the step's clock.
  //
  // The dispatches whose close carried no wall clock are COUNTED beside the sum
  // rather than folded in as zeros (D-04) - a zero would claim a worker that
  // took no time, which is not a measurement anyone made.
  //
  // SILENT - nothing at all, never an entry saying nothing - when no bracket in
  // scope carries a `duration_ms`. That is R6's posture for a render with no
  // coordinator block, and it is the only reading that fits the record: with 6
  // of 386 live brackets carrying one (measured 2026-08-26), a scope where none
  // does has no figure to denominate a receipt IN, rather than a run that took
  // no worker time. R6's `coordinator.residue_ms` is NOT re-based on this
  // figure for the same measurement (D-02): 380 of those brackets would
  // contribute zero worker time and fire R6 on every run.
  const brackets = Array.isArray(render.brackets) ? render.brackets : [];
  let workerMs = 0;
  let priced = 0;
  let silent = 0;
  for (const b of brackets) {
    if (!b || typeof b !== 'object') continue;
    const d = typeof b.duration_ms === 'number' && Number.isFinite(b.duration_ms)
      ? b.duration_ms : null;
    if (d === null) { silent++; continue; }
    workerMs += d;
    priced++;
  }
  if (priced > 0) {
    out.push({
      kind: 'info',
      subject: 'workers',
      evidence: `worker wall clock reported by the host: ${minutes(workerMs)} across`
        + ` ${priced} dispatch(es)`
        + (silent > 0
          ? `, with ${silent} more whose close carried none - unrecorded, never counted as zero`
          : '')
        + '. This is the WORKER\'s own run time and not the dispatch-to-close `ms`'
        + " /cad-report prints beside it, which includes the orchestrator's own time"
        + ' between the two writes.',
      action: null,
    });
  }

  out.sort((a, b) => (a.kind === b.kind ? (a.subject < b.subject ? -1 : a.subject > b.subject ? 1 : 0) : a.kind === 'suggest' ? -1 : 1));
  return out;
}
