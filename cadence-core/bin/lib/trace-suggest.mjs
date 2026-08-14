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

/**
 * @typedef {{kind: 'suggest'|'info', subject: string, evidence: string,
 *            action: string|null}} Suggestion
 * @typedef {{counts: Record<string, number>,
 *            roles: Record<string, {dispatches: number, tokens?: number, unrecorded?: number}>,
 *            events: any[],
 *            coordinator?: {wall_ms: number, bracket_ms: number, residue_ms: number,
 *                           steps: {phase: any, step: any, ts: any, residue_ms: number}[]}}} RenderLike
 */

// Evidence floors. Below these a rule stays silent rather than extrapolating.
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
 * A duration in whole minutes, the unit a run record is read in.
 * @param {number} ms
 */
function minutes(ms) {
  return `${Math.round(ms / 60000)} min`;
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
 * @returns {Suggestion[]}
 */
export function suggestFromRender(render) {
  /** @type {Suggestion[]} */
  const out = [];
  const events = Array.isArray(render.events) ? render.events : [];

  // --- gather ---------------------------------------------------------------
  /** @type {Map<string, {fires: number, survivors: number, raised: number}>} */
  const triggers = new Map();
  /** @type {Set<string>} */
  const rearmed = new Set();
  /** @type {Map<string, {resolves: number, escalated: number}>} */
  const rungs = new Map();
  /** @type {Map<string, number>} */
  const checkpoints = new Map();

  for (const e of events) {
    if (!e || typeof e !== 'object') continue;
    if (e.family === 'outcome' && e.event === 'adjudication') {
      const parsed = parseAdjudication(e);
      if (!parsed) continue;
      const row = triggers.get(parsed.trigger) || { fires: 0, survivors: 0, raised: 0 };
      row.fires++;
      row.survivors += parsed.survivors;
      // An UNKNOWN raised count contributes nothing rather than a zero, which
      // is what keeps a corpus written before the flag existed on R1's
      // gate-suggestion arm exactly as it is today.
      row.raised += parsed.raised === null ? 0 : parsed.raised;
      triggers.set(parsed.trigger, row);
    } else if (e.family === 'outcome' && e.event === 'rearm') {
      if (typeof e.detail === 'string' && e.detail.trim()) rearmed.add(e.detail.trim());
    } else if (e.family === 'routing' && e.event === 'resolve') {
      const role = typeof e.role === 'string' ? e.role : '';
      if (!role) continue;
      const row = rungs.get(role) || { resolves: 0, escalated: 0 };
      row.resolves++;
      // Either spelling of a climb counts: the seam's own `escalated` flag, or
      // a retry attempt (`--attempt 2`) that lands on the retry rung.
      if (e.escalated === true || (typeof e.attempt === 'number' && e.attempt >= 2)) row.escalated++;
      rungs.set(role, row);
    } else if (e.family === 'lifecycle' && e.event === 'checkpoint') {
      const role = typeof e.role === 'string' ? e.role : '';
      if (!role) continue;
      checkpoints.set(role, (checkpoints.get(role) || 0) + 1);
    }
  }

  // --- rules ----------------------------------------------------------------
  // R1: an adjudicated trigger that keeps coming back empty. A rearm anywhere
  // on the same trigger vetoes the suggestion - a gate that forced a fix round
  // has already paid for itself, whatever its adjudications said.
  //
  // Two OUTCOMES on the same evidence floor, because "nothing survived" means
  // two opposite things (D-16). Nothing raised at all is a gate finding
  // nothing; nine raised and nine killed is a gate doing real work in front of
  // a reviewer that cannot tell a finding from an opinion - and proposing to
  // turn that gate off is the wrong move on the same row. An UNKNOWN raised
  // total counts as 0 here, so every trace written before `--raised` existed
  // keeps landing on the gate arm it lands on today.
  for (const [trigger, row] of [...triggers.entries()].sort()) {
    if (row.fires >= MIN_FIRES_FOR_GATE_SUGGESTION && row.survivors === 0 && !rearmed.has(trigger)) {
      out.push(row.raised > 0
        ? {
          kind: 'suggest',
          subject: `${trigger} reviewers`,
          evidence: `${row.fires} adjudicated fire(s), 0 survivors of ${row.raised} raised`
            + ' - the gate caught work; the reviewer set is what looks miscalibrated',
          action: 'review.reviewers',
        }
        : {
          kind: 'suggest',
          subject: trigger,
          evidence: `${row.fires} adjudicated fire(s), 0 survivors, no re-arm`,
          action: `review.triggers.${trigger}.gate`,
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
      out.push({
        kind: 'suggest',
        subject: role,
        evidence: `${row.escalated} of ${row.resolves} resolves climbed to the retry rung`,
        action: `model.effort.${role}`,
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
  const execCp = checkpoints.get('cad-executor') || 0;
  if (execCp >= MIN_CHECKPOINTS_FOR_SIZE_SUGGESTION) {
    out.push({
      kind: 'suggest',
      subject: 'cad-executor',
      evidence: `${execCp} checkpoint return(s) - plans may exceed one context`,
      action: 'workflow.max_plan_tasks',
    });
  }

  // R5: the spend receipt. Names where the tokens went; asks for nothing.
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
      evidence: `largest recorded spend: ${top.tokens.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} recorded tokens (${Math.round((top.tokens / total) * 100)}%)`,
      action: null,
    });
  }

  // R6: the coordinator's own share of the run. The counterpart to R5 - that
  // one names where the TOKENS went, this one names the time no worker was
  // billed for. Receipt only, and `action` is null on purpose: no
  // `config.schema.json` key governs coordinator spend, and this file's own
  // test refuses an action naming a key the schema lacks.
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

  out.sort((a, b) => (a.kind === b.kind ? (a.subject < b.subject ? -1 : a.subject > b.subject ? 1 : 0) : a.kind === 'suggest' ? -1 : 1));
  return out;
}
