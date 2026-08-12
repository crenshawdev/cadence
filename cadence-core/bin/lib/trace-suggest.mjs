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
 *            events: any[]}} RenderLike
 */

// Evidence floors. Below these a rule stays silent rather than extrapolating.
export const MIN_FIRES_FOR_GATE_SUGGESTION = 2;
export const MIN_DISPATCHES_FOR_RUNG_INFO = 4;
export const MIN_ESCALATIONS_FOR_RUNG_SUGGESTION = 2;
export const MIN_CHECKPOINTS_FOR_SIZE_SUGGESTION = 2;

/**
 * Parse an adjudication detail line: `<trigger>: <n> survivors; voices <...>`.
 * The shape is review-triggers.md step 5's, and a detail that does not match
 * contributes nothing rather than mis-attributing to a phantom trigger.
 * @param {unknown} detail
 * @returns {{trigger: string, survivors: number}|null}
 */
export function parseAdjudication(detail) {
  if (typeof detail !== 'string') return null;
  const m = /^([a-z_]+):\s*(\d+)\s+survivors?\b/.exec(detail.trim());
  if (!m) return null;
  return { trigger: m[1], survivors: Number(m[2]) };
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
  /** @type {Map<string, {fires: number, survivors: number}>} */
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
      const parsed = parseAdjudication(e.detail);
      if (!parsed) continue;
      const row = triggers.get(parsed.trigger) || { fires: 0, survivors: 0 };
      row.fires++;
      row.survivors += parsed.survivors;
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
  for (const [trigger, row] of [...triggers.entries()].sort()) {
    if (row.fires >= MIN_FIRES_FOR_GATE_SUGGESTION && row.survivors === 0 && !rearmed.has(trigger)) {
      out.push({
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

  out.sort((a, b) => (a.kind === b.kind ? (a.subject < b.subject ? -1 : a.subject > b.subject ? 1 : 0) : a.kind === 'suggest' ? -1 : 1));
  return out;
}
