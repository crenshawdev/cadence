export const meta = {
  name: 'execute-wave',
  description: 'Run one wave of a phase: one executor agent per plan, each in its own worktree when the wave holds more than one plan, and return each executor\'s digest. Started by /cad-execute with args, never by hand.',
};

// args: { plans: [{ plan, prompt, agent_type, model: string|null }], batch_size }
//   plan is the plan number, unique in the wave. prompt is the whole dispatch the main session composed for that plan. agent_type and model are
//   that plan's own rung, since each plan resolves its route under its own risk floor. batch_size is how many may run at once, from
//   parallelization.max_concurrent_agents.
// Returns { plans: [{ plan, digest: <schema object>|null }] } in the order given, plan copied from args. An executor that died has digest null, and
//   the script judges no digest: a checkpoint is a digest like any other. Each agent is labelled `plan <plan>`, which workflow-run bills on.
//   A wave of more than one plan runs each executor with isolation: 'worktree'; a wave of one runs in the normal tree.

let a = args;
if (typeof a === 'string') { try { a = JSON.parse(a); } catch { a = null; } }
const text = (v) => typeof v === 'string' && v.trim() !== '';
const plain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const keyed = (v) => text(v) || (Number.isSafeInteger(v) && v >= 0);
const usable = a && typeof a === 'object'
  && Array.isArray(a.plans) && a.plans.length > 0
  && a.plans.every((p) => plain(p) && keyed(p.plan) && text(p.prompt) && text(p.agent_type) && (p.model === null || p.model === undefined || text(p.model)))
  && new Set(a.plans.map((p) => String(p.plan))).size === a.plans.length
  && Number.isSafeInteger(a.batch_size) && a.batch_size > 0;
if (!usable) {
  return 'execute-wave runs one executor per plan for /cad-execute. It needs args from that command (plans with a unique plan, prompt, agent_type and model each, and batch_size) and started no agent.';
}

// Loose on purpose: a digest the executor contract allows must never fail validation, because the host restarts an agent that does.
// Only the status line is required. The first five are the contract's digest and the last three its checkpoint fields.
const str = { type: 'string' };
const DIGEST_SCHEMA = {
  type: 'object',
  required: ['status'],
  properties: {
    status: { type: 'string', description: 'The digest\'s first line, PLAN COMPLETE or PLAN PARTIAL.' },
    tasks: str, commits: str, deviations: str, open_items: str,
    checkpoint: str, current_task: str, need: str,
  },
};

const CLOSING = 'When you finish, return your digest through the schema you were given: the fields of your contract\'s report, and its checkpoint fields when you stop at a checkpoint.';
const worktree = a.plans.length > 1;

// A refused spawn or a dead agent costs its one plan and nothing more, and the script never retries.
const ask = async (prompt, opts, what) => {
  try { return await agent(prompt, opts); }
  catch (e) { log(`${what} failed: ${e && e.message ? e.message : e}`); return null; }
};

const run = async (p) => {
  const opts = {
    agentType: p.agent_type,
    ...(text(p.model) ? { model: p.model } : {}),
    schema: DIGEST_SCHEMA,
    label: `plan ${p.plan}`,
    ...(worktree ? { isolation: 'worktree' } : {}),
  };
  const digest = await ask(`${p.prompt}\n\n${CLOSING}`, opts, `executor for plan ${p.plan}`);
  return { plan: p.plan, digest: plain(digest) ? digest : null };
};

// No one pipeline call is assumed to hold a whole wave, so each batch is awaited before the next starts.
const plans = [];
for (let at = 0; at < a.plans.length; at += a.batch_size) {
  const batch = a.plans.slice(at, at + a.batch_size);
  const done = await pipeline(batch, run);
  batch.forEach((p, i) => plans.push(done[i] || { plan: p.plan, digest: null }));
}
return { plans };
