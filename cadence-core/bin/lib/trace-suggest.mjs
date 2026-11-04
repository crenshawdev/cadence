// @ts-check
// trace-suggest.mjs - config suggestions read off the run record, the pure half of `planning.mjs trace
// suggest`.
// No I/O: every rule is a pure function over the render, so a test can pin exact outputs to exact traces.
// Nothing applies a suggestion, the user decides. Each carries its evidence, the config key it concerns and a
// kind: `suggest` or `info` (a receipt).
// Every rule needs a floor of evidence before it speaks, because a suggestion from one event is a guess wearing
// a verdict.
// Keyed suggestions say which way to move the key and what it holds now. The caller resolves that and passes it
// in as the optional second argument, which keeps the rules pure.
// `direction` is set per rule, since the caller can't know which arm of R1 fired.

/**
 * @typedef {{kind: 'suggest'|'info', subject: string, evidence: string,
 *            action: string|null, direction?: 'raise'|'lower',
 *            current?: any, proposed?: any}} Suggestion
 * @typedef {{values?: Record<string, any>, gates?: string[], rungs?: string[],
 *            checkpointTasks?: (number|null)[]}} Resolution
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

/** R1's floor, in unvetoed empty fires: a fire that forced a re-arm round doesn't count. */
export const MIN_FIRES_FOR_GATE_SUGGESTION = 2;
export const MIN_DISPATCHES_FOR_RUNG_INFO = 4;
export const MIN_ESCALATIONS_FOR_RUNG_SUGGESTION = 2;
export const MIN_CHECKPOINTS_FOR_SIZE_SUGGESTION = 2;
/** R9's floor, in override receipts for one trigger: one receipt can't be a second use of an answer. */
export const MIN_OVERRIDES_FOR_AUTHORIZATION_INFO = 2;
/** The coordinator receipt's floor, ten minutes: below it the residue is mostly the gap before a first dispatch. */
export const MIN_RESIDUE_MS_FOR_COORDINATOR_INFO = 600000;

/**
 * R7's floor per role, and the map is the gate: a role it doesn't name never produces an in-dispatch entry.
 * Only two roles are named because only two showed signal; the other three measured 1.74 to 1.88, which the
 * spike called noise.
 * `cad-verifier` sits at 2.0, the spike's bar for real redundancy. `cad-executor` is higher at 3.0 because it
 * legitimately returns to a file once per task in one dispatch, and today's 3.64 still speaks.
 */
export const IN_DISPATCH_FLOORS = Object.freeze({
  'cad-executor': 3.00,
  'cad-verifier': 2.00,
});

/**
 * The two sources the recorded token total doesn't include, worded once for both readers: R5's evidence string
 * and the spend line in `workflows/report.md`.
 * Exported and frozen so `prose-agreement.test.mjs` checks the prose against this one list, not a copy.
 * Cross-model provider calls were dropped in v3.7.10 and must not come back: that usage has its own line in a
 * different denomination, so it isn't excluded.
 * No ratio or correction factor goes in here, a stored product is the maintenance loop v2.7.0 deleted.
 */
export const SPEND_EXCLUDES = Object.freeze([
  "the orchestrator's own turns",
  'figureless returns',
]);

/**
 * Whole minutes, the unit a run record is read in.
 * @param {number} ms
 */
function minutes(ms) {
  return `${Math.round(ms / 60000)} min`;
}

/**
 * The value a config layer (or the caller's schema-default fallback) holds for `key`, or `undefined`.
 * `null` reads as nothing: on these keys it means no layer pins it.
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

/** What an unset key prints as `current`: `config.mjs get`'s refusal, naming the decider and never the value it fires. */
function unsetCurrent() {
  return 'unset: no config layer pins this, so the schema default decides it';
}

/**
 * `current` and, where one can be read rather than guessed, `proposed`, as a fragment a suggestion spreads into
 * itself.
 * `proposed` is omitted, never null or 0: a key nobody computed a target for must be invisible.
 * @param {Resolution|undefined} resolution
 * @param {string} key
 * @param {(current: any) => any} [target] priced only when the key is SET
 */
function keyState(resolution, key, target) {
  const value = resolved(resolution, key);
  const proposed = value === undefined || !target ? undefined : target(value);
  return {
    current: value === undefined ? unsetCurrent() : value,
    ...(proposed === undefined ? {} : { proposed }),
  };
}

/**
 * The rung the record shows a role's escalated resolves landing on, kept only where it is a real raise.
 * A set rung must sit strictly below it on the ladder, or the target is omitted: a retune that changes nothing,
 * or contradicts the `raise` beside it.
 * An unset key has no rung to compare and keeps the target. No ladder means no comparison and no target.
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
 * One step down the gate ladder from `config.schema.json`, or `undefined` with no ladder, an off-ladder value
 * or the bottom rung.
 * The ladder is the caller's: absent, `proposed` is omitted and that omission is the report.
 * @param {string[]|undefined} gates
 * @param {any} value
 */
function oneStepDown(gates, value) {
  if (!Array.isArray(gates)) return undefined;
  const i = gates.indexOf(value);
  return i > 0 ? gates[i - 1] : undefined;
}

/**
 * Parse an adjudication event: the trigger and survivor count from its `<trigger>: <n> survivors; voices <...>`
 * detail line, plus how many findings were raised before adjudication killed them.
 * A bare detail string works too, for callers that only hold one.
 * `raised` comes from the event's `raised` field, else a hand-written `of <m>` right after the survivor count,
 * else `null` for unknown. Never 0: a fire nobody counted isn't a fire that raised nothing.
 * The trigger regex stays permissive, since tightening it drops historical fires and takes R1's floor down with
 * them.
 * `<trigger> rearm:` and `<trigger> re-arm:` both exist on disk and read as the base trigger with `rearm:
 * true`, never a trigger of their own, which would mint a phantom config key.
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
 * All suggestions the render supports, `suggest` before `info`, then by subject so the order is stable for
 * tests.
 * @param {RenderLike} render
 * @param {Resolution} [resolution] the values the caller read off disk for the keys these rules name; absent, every keyed suggestion still carries a direction and reports `current` as unset.
 * @param {InDispatchReads} [reads] the per-role in-dispatch file figures folded off `.planning/reads.jsonl`, passed in so the rules stay pure. Absent, R7 stays silent and nothing else changes.
 * @returns {Suggestion[]}
 */
export function suggestFromRender(render, resolution, reads) {
  /** @type {Suggestion[]} */
  const out = [];
  const events = Array.isArray(render.events) ? render.events : [];

  // --- gather ---
  // one row per fire, in file order: a re-arm veto acts on a fire, and lifetime totals once muted a trigger
  // four cycles after it stopped being empty
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
   * The authorization an override receipt descends from, as a string, guarded like `corrOf` so an object can't
   * become the group key `[object Object]`.
   * Empty means unlabelled, which R9 reads as unknown, not a shared answer. Trimmed so a padded copy of an id
   * isn't a second decision.
   * @param {any} e
   */
  const authOf = (e) => (typeof e.authorization_id === 'string' || typeof e.authorization_id === 'number'
    ? String(e.authorization_id).trim()
    : '');
  /**
   * Per role: the resolve counts R3 reads, and the rung its escalated resolves landed on, off the `effort` they
   * carry.
   * That rung is R3's `proposed`: one the routing table really resolved, not a legal one it would never
   * produce.
   * @type {Map<string, {resolves: number, escalated: number, rung?: string}>}
   */
  const rungs = new Map();
  /** @type {Map<string, number>} */
  const checkpoints = new Map();
  /**
   * Per trigger, R9's two figures: override receipts written, and the distinct authorizations behind them.
   * Labelled ids go in the set and the rest are counted, since an unlabelled receipt is its own decision.
   * @type {Map<string, {writes: number, ids: Set<string>, unlabelled: number}>}
   */
  const overrides = new Map();

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
      // veto the nearest earlier fire in the same `(corr, trigger)`, skipping re-arm rounds and fires already vetoed
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
      // a climb is either the `escalated` flag or a retry attempt (`--attempt 2`) landing on the retry rung
      if (e.escalated === true || (typeof e.attempt === 'number' && e.attempt >= 2)) {
        row.escalated++;
        if (typeof e.effort === 'string' && e.effort.trim()) row.rung = e.effort.trim();
      }
      rungs.set(role, row);
    } else if (e.family === 'lifecycle' && e.event === 'checkpoint') {
      const role = typeof e.role === 'string' ? e.role : '';
      if (!role) continue;
      checkpoints.set(role, (checkpoints.get(role) || 0) + 1);
    } else if (e.family === 'outcome' && e.event === 'override') {
      // read the trigger off the structured field, never `detail`: that free text spells it four different ways
      const trigger = typeof e.trigger === 'string' ? e.trigger.trim() : '';
      if (!trigger) continue;
      const row = overrides.get(trigger) || { writes: 0, ids: new Set(), unlabelled: 0 };
      row.writes++;
      const id = authOf(e);
      if (id) row.ids.add(id);
      else row.unlabelled++;
      overrides.set(trigger, row);
    }
  }

  // R1: an adjudicated trigger that keeps coming back empty, read a fire at a time. A fire counts when it
  // adjudicated zero survivors and no re-arm came back to it: a gate that forced a fix round paid for itself on
  // that fire.
  // Two outcomes on the same floor, because "nothing survived" means opposite things. Nothing raised is a gate
  // finding nothing; nine raised and nine killed is a gate working in front of a reviewer that can't tell a
  // finding from an opinion, and turning it off is the wrong move.
  // The raised total sums the empty fires only, and an unknown raised count adds 0, so traces from before
  // `--raised` land on the gate arm as they always did.
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
      // the arms move opposite ways: empty fires lower the gate, a reviewer set that killed real work gets strengthened
      out.push(row.raised > 0
        ? {
          kind: 'suggest',
          subject: `${trigger} reviewers`,
          evidence: `${row.empty} of ${row.total} adjudicated fire(s), 0 survivors of ${row.raised} raised`
            + ' - the gate caught work; the reviewer set is what looks miscalibrated',
          action: 'review.reviewers',
          direction: 'raise',
          // no `proposed`: which backend to add isn't in the record, and a guess costs credibility
          ...keyState(resolution, 'review.reviewers'),
        }
        : {
          kind: 'suggest',
          subject: trigger,
          evidence: `${row.empty} of ${row.total} adjudicated fire(s), 0 survivors, no re-arm`,
          action: `review.triggers.${trigger}.gate`,
          direction: 'lower',
          // priced only off a value a layer set: an unset gate has no position on the ladder to step down from
          ...keyState(resolution, `review.triggers.${trigger}.gate`,
            (current) => oneStepDown(resolution && resolution.gates, current)),
        });
    }
  }

  // R2: a gate that caught real work. Receipt only.
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
      // the target is a rung the record shows, never a guessed step; `raiseTarget` makes it a real change
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

  // R4: executor checkpoint pressure. A checkpoint is a fresh-context continuation at full dispatch price, and
  // repeats say plans are outrunning one context.
  // Suppressed, not returned with a caveat, when every counted checkpoint maps to a readable plan under the
  // resolved ceiling: telling someone to lower a ceiling their plans never reached is a sentence they can only
  // ignore.
  // It compares against the ceiling this prints as `current`, never a hardcoded 8. An unknown count is never
  // under it, and neither is one equal to it.
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
      // no `proposed`: nothing in the record names a plan's task count, so any target would be invented
      ...keyState(resolution, 'workflow.max_plan_tasks'),
    });
  }

  // R5: spend receipt; the `SPEND_EXCLUDES` caveat rides the evidence string, which `suggest.md` relays unchanged
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

  // R6: the coordinator's own share of the run, R5's counterpart: time no worker was billed for. Receipt only,
  // `action` null because no schema key governs coordinator spend.
  // Scoped by `corr`, so no window spans the clock between two runs sharing a phase number. Silent without a
  // `coordinator` block, or every older trace would gain a line saying nothing.
  const coord = render.coordinator;
  const residue = coord && typeof coord.residue_ms === 'number' && Number.isFinite(coord.residue_ms)
    ? coord.residue_ms
    : null;
  if (residue !== null && residue >= MIN_RESIDUE_MS_FOR_COORDINATOR_INFO) {
    // the figures are the render's own, so this and `/cad-report` can't disagree; the share skips a zero wall
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

  // R7: in-dispatch re-reading, per role, off `.planning/reads.jsonl`, which nothing had ever acted on.
  // `action` is null: no schema key governs it. `workflow.max_plan_tasks` is closest, but lowering it turns the
  // same opens into more dispatches, a better ratio with a bigger bill.
  // The remedy is discipline (anchors on a plan's `files:` entries, targeted reads), so the entry says it in
  // words, as R6 does. Silent without a floor for the role; a null ratio is never rendered as 0.
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
    // unreachable with a non-null ratio; it keeps the sentence from naming a file nothing measured
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
        + ' SCOPE: nothing prunes `.planning/reads.jsonl` at a milestone close, and the one thing'
        + ' that ever shortens it is the cut at its size bound, which moves the older generation'
        + ' to a sibling no fold here reads - so an unscoped run reaches every milestone still in'
        + ' the LIVE record, and `reads.rotated` on this envelope says whether the record was cut.'
        + ` Excludes ${excluded.toLocaleString('en-US')} coordinator read(s) carrying files:`
        + ' the main thread has no dispatch bracket by construction, so its re-reading cannot be'
        + ' attributed to one and cannot be measured here.'
        + ' No key in `config.schema.json` governs in-dispatch re-reading - the remedy is discipline, not'
        + " configuration: symbol or line anchors on a plan's `files:` entries, and targeted reads"
        + ' over whole-file ones.',
      action: null,
    });
  }

  // R8: the worker wall clock, in the figure the host reported for the worker itself. R6's counterpart from the
  // other end. Receipt only, `action` null.
  // The two clocks are named apart in the evidence: a bracket's `ms` is dispatch-to-close and includes the
  // orchestrator's time between the writes, `duration_ms` is the worker's own run. One unnamed figure would
  // price a worker with the step's clock.
  // Dispatches whose close carried no wall clock are counted beside the sum, not folded in as zeros: zero would
  // claim a worker that took no time.
  // Silent when no bracket in scope carries a `duration_ms`. R6 isn't re-based on this figure either: most
  // brackets carry none and it would fire on every run.
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

  // R9: one human authorization, written as two receipts. An override re-applied to a second range is two
  // events by construction (`risk-check status` wants a receipt per fired range), so nothing said the pair came
  // from one answer.
  // `trace append --authorization-id` carries the id the coordinator minted at the answer, and this counts
  // decisions against writes.
  // An unlabelled receipt counts as its own decision: every override from before the flag has no id, and
  // reading those as one shared answer would report a reuse on every old trace.
  // Silent where the two figures agree, or every render would gain a "2 decisions from 2 writes" line. `action`
  // is null, no schema key governs this.
  for (const [trigger, row] of [...overrides.entries()].sort()) {
    if (row.writes < MIN_OVERRIDES_FOR_AUTHORIZATION_INFO) continue;
    const decisions = row.ids.size + row.unlabelled;
    if (decisions >= row.writes) continue;
    out.push({
      kind: 'info',
      subject: trigger,
      evidence: `${row.writes} override receipt(s) on ${decisions} authorization(s)`
        + ` - ${decisions} decision(s) from ${row.writes} writes, so one answer applied to a`
        + ' second range is distinguishable from a duplicate write of one range. The shared id'
        + ' LABELS that pair only: every fired range still carries a receipt naming its own'
        + ' base and head.',
      action: null,
    });
  }

  out.sort((a, b) => (a.kind === b.kind ? (a.subject < b.subject ? -1 : a.subject > b.subject ? 1 : 0) : a.kind === 'suggest' ? -1 : 1));
  return out;
}
