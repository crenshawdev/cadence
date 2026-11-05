export const meta = {
  name: 'analyzer',
  description: 'Run the assumptions analyzer for one phase as three readers on three fixed angles and render the contract\'s report from what they return. Started by /cad-context with args, never by hand.',
};

// args: { phase, phase_name, goal, prior_decisions, search_terms, recalled_memory?, agent_type, model: string|null }
//   The fields /cad-context's single-agent prompt carries, plus the analyzer rung the main session resolved. A script can't import, so the
//   report's skeleton is spelled here from skills/cad-assumptions-analyzer-contract's <output_format> and a test reads it back.
// Returns { report: string|null, nulls: [angle names that returned nothing] }. No report when every reader returned nothing, or none found an assumption.

let a = args;
if (typeof a === 'string') { try { a = JSON.parse(a); } catch { a = null; } }
const text = (v) => typeof v === 'string' && v.trim() !== '';
const usable = a && typeof a === 'object'
  && (text(a.phase) || Number.isSafeInteger(a.phase)) && text(a.phase_name) && text(a.goal) && text(a.agent_type)
  && [a.prior_decisions, a.search_terms, a.recalled_memory].every((v) => v === undefined || v === null || typeof v === 'string')
  && (a.model === null || a.model === undefined || text(a.model));
if (!usable) {
  return 'analyzer reads a phase from three angles and renders the assumptions report. It needs args from /cad-context (phase, phase_name, goal, prior_decisions, search_terms, agent_type, model) and started no agent.';
}

const CERTAINTY = ['Confident', 'Likely', 'Unclear'];
const line = (v) => String(v).replace(/\s+/g, ' ').trim();
const body = (description, max = 1000) => ({ type: 'string', minLength: 1, maxLength: max, description });

// The contract's fields per assumption, and the topics the code can't answer.
const READER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['assumptions', 'research'],
  properties: {
    assumptions: {
      type: 'array',
      maxItems: 12,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['area', 'decision', 'certainty', 'evidence', 'if_wrong', 'alternatives'],
        properties: {
          area: body('The area this belongs to, a short name. Assumptions sharing an area share the name.', 120),
          decision: body('The assumption, stated as a decision.'),
          certainty: { type: 'string', enum: CERTAINTY, description: 'Thin evidence is never Confident.' },
          evidence: { type: 'array', minItems: 1, maxItems: 10, items: body('A real file path from this repository that you read.', 300) },
          if_wrong: body('The concrete outcome if this is wrong: what breaks, diverges or gets rebuilt.'),
          alternatives: { type: 'array', maxItems: 2, items: body('Another approach, one line.', 300), description: 'One or two for Likely and Unclear, none for Confident.' },
        },
      },
    },
    research: { type: 'array', maxItems: 8, items: body('A topic the codebase alone can not answer, then a colon and one line on why.', 400) },
  },
};

// Three fixed angles, so nothing scouts the repository first. Each stays in its own lane to keep the wall clock near one analyzer's.
const ANGLES = [
  { id: 'similar', name: 'similar features', brief: 'What similar features in this repository already do, and where following them would be wrong for this phase.' },
  { id: 'flow', name: 'behavior', brief: 'How this area behaves from its entry point through to the record it leaves on disk.' },
  { id: 'keep', name: 'what must stay intact', brief: 'What this change must keep intact: pins, byte budgets, config rules, and whatever reads what these steps write.' },
];

const prompt = (angle) => [
  `Analyze the codebase for Phase ${a.phase}: ${a.phase_name}.`,
  '',
  `<phase_goal>${a.goal}</phase_goal>`,
  `<prior_decisions>${a.prior_decisions || 'none'}</prior_decisions>`,
  `<search_terms>${a.search_terms || ''}</search_terms>`,
  ...(text(a.recalled_memory) ? [`<recalled_memory>${a.recalled_memory}</recalled_memory>`] : []),
  '',
  `You are one of three readers, each on one angle. Yours: ${angle.brief}`,
  'Stay on your angle; the other two cover the rest. Read the 5 to 15 most relevant files at most, then stop reading and answer.',
  'Answer through the schema and not in the report format, because the script renders the report. Raise only decisions that could go more than one way.',
].join('\n');

const base = { agentType: a.agent_type, ...(text(a.model) ? { model: a.model } : {}) };
// A refused spawn or a dead agent costs its one slot, and parallel never sees the throw.
const ask = async (angle) => {
  try { return await agent(prompt(angle), { ...base, schema: READER_SCHEMA, label: `reader ${angle.id}` }); }
  catch (e) { log(`reader ${angle.id} failed: ${e && e.message ? e.message : e}`); return null; }
};

const got = await parallel(ANGLES.map((angle) => () => ask(angle)));
// An object with no assumptions array is a reader that returned nothing.
const ok = got.map((r) => (r && typeof r === 'object' && Array.isArray(r.assumptions) ? r : null));
const nulls = ANGLES.filter((_, i) => !ok[i]).map((x) => x.name);

const rank = (c) => CERTAINTY.indexOf(c);
const same = (v) => line(v).toLowerCase();
const uniq = (list, key = same) => { const seen = new Set(); return list.filter((v) => { const k = key(v); if (seen.has(k)) return false; seen.add(k); return true; }); };

// Identical decisions merge; near-duplicates are left for close_gray_areas. The least certain reading wins, every distinct path stays.
const areas = new Map();
const byDecision = new Map();
for (const r of ok.filter(Boolean)) {
  for (const x of r.assumptions) {
    const key = same(x.decision);
    const paths = x.evidence.map((p) => line(String(p).replace(/`/g, ''))).filter(Boolean);
    const merged = byDecision.get(key);
    if (merged) {
      if (rank(x.certainty) > rank(merged.certainty)) merged.certainty = x.certainty;
      merged.evidence = uniq([...merged.evidence, ...paths], (p) => p);
      merged.if_wrong = uniq([merged.if_wrong, line(x.if_wrong)]).join(' ');
      merged.alternatives = uniq([...merged.alternatives, ...x.alternatives.map(line)]);
      continue;
    }
    const entry = { decision: line(x.decision), certainty: x.certainty, evidence: uniq(paths, (p) => p), if_wrong: line(x.if_wrong), alternatives: uniq(x.alternatives.map(line)) };
    byDecision.set(key, entry);
    const area = same(x.area);
    if (!areas.has(area)) areas.set(area, { name: line(x.area), items: [] });
    areas.get(area).items.push(entry);
  }
}

if (byDecision.size === 0) {
  log(nulls.length === ANGLES.length ? 'every reader returned nothing, so there is no report' : 'the readers that returned found no assumption, so there is no report');
  return { report: null, nulls };
}

const research = uniq(ok.filter(Boolean).flatMap((r) => (Array.isArray(r.research) ? r.research : [])).map(line).filter(Boolean));
const render = (e) => [
  `- **Decision:** ${e.decision}`,
  `  **Certainty:** ${e.certainty}`,
  `  **Evidence:** ${e.evidence.map((p) => `\`${p}\``).join(', ')}`,
  `  **If wrong:** ${e.if_wrong}`,
  // The contract wants one or two for Likely and Unclear; merging can give more, and a reader can send none.
  ...(e.certainty !== 'Confident' ? ['  **Alternatives:**', ...(e.alternatives.length ? e.alternatives.slice(0, 2) : ['None named.']).map((alt) => `  - ${alt}`)] : []),
].join('\n');

const report = [
  '## Assumptions',
  '',
  ...[...areas.values()].flatMap((area) => [`### Area: ${area.name}`, '', area.items.map(render).join('\n\n'), '']),
  '## Needs external research',
  '',
  ...(research.length ? research.map((t) => `- ${t}`) : ['None.']),
  '',
].join('\n');
return { report, nulls };
