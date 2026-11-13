#!/usr/bin/env node
// @ts-check
// skill-preload-proof.mjs - proves the host preloads the SECOND entry of an agent's `skills:` list (D-02).
// The shared skill every Cadence agent carries rests on that claim, so it is a script with its answer stored
// beside it in skill-preload-proof.result.json, and /cad-verify re-runs it on whatever host is installed then.
// Two runs: a tool-less proof agent, then one real generated agent quoting the rule only cad-shared-rules holds.
//
// Usage: skill-preload-proof.mjs [--out <path>]
//   --out   where the result goes. ABSENT means the stored skill-preload-proof.result.json beside this file.
//
// One headless `claude` dispatch, found on PATH. The fixture is a throwaway plugin in a fresh temp dir, never in this
// repo: anything under agents/ or skills/ would be read as part of Cadence by self-verify, the budgets and the host.
// Three things make the returned line provably preloaded text:
//   1. the proof agent says `tools: []` - the host reads the present-but-empty key as none; an absent key is all tools
//   2. the parent gets `--tools Agent`, so it has no file or shell tool to read the skill and answer for the agent
//   3. the counts come from the stream: calls inside the subagent, and the parent's calls beside the one dispatch
// The second run dispatches a table-named agent from this tree as it is. It holds tools, and `--tools Agent` on the
// parent would narrow its pool to none and the host refuses that spawn, so the parent is held by deny rules instead
// and the count inside the subagent is what rules out a Read of the skill's file.
// A run that fails for any reason writes nothing, so the stored file only ever holds a passing run.
// Stream shapes are Claude Code 2.1.323's, captured on 2026-11-13 with --verbose and --forward-subagent-text.
'use strict';

import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { emit, emitCaught } from './lib/seam-io.mjs';
import { CONTRACTS, requireFlag } from './lib/arg-contract.mjs';
import { makeDir, writeFile, removeTree } from './lib/planning-store.mjs';
import { SHARED_RULE, SHARED_SKILL, carriesSharedRule } from './lib/shared-rule.mjs';
import { RUNG_FILES } from './lib/rung-agent.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const STORED_RESULT = join(HERE, 'skill-preload-proof.result.json');
// this tree, never an installed Cadence: the proof is about the files this checkout generates
const PLUGIN_ROOT = join(HERE, '..', '..');

// Each marker lives only in its skill's BODY: the parent sees skill names and descriptions and could pass one down.
export const MARKERS = Object.freeze({ first: 'PRELOAD-FIRST-K7M2QX', second: 'PRELOAD-SECOND-R4T9ZW' });

export const PLUGIN_NAME = 'preload-proof';
export const SKILLS = Object.freeze(['proof-first', 'proof-second']);
/** How the host names a plugin agent in a dispatch: `<plugin>:<agent>`. */
export const AGENT_TYPE = `${PLUGIN_NAME}:preload-proof`;
// The tool_use block says Agent; the init record's tool list still says Task, so either name is the dispatch
const DISPATCH_TOOLS = ['Agent', 'Task'];
const HOST_TIMEOUT_MS = 300_000;

// No marker in here, or an echo would pass
export const PROMPT = `Use the Agent tool exactly once, to dispatch the ${AGENT_TYPE} agent. Ask it to reply with `
  + 'the line each of its preloaded skills holds, verbatim, the second-listed skill\'s line included. '
  + 'Then reply with what it returned.';

// the executor: the rule is for it, and its contract is the biggest first skill, so a cut-short preload shows here first
export const SECOND_AGENT = RUNG_FILES['cad-executor'].rungs.high;
export const SECOND_AGENT_TYPE = `cadence:${SECOND_AGENT}`;
// the parent's file and shell tools, denied so it can't read the skill and hand the rule down
const PARENT_DENY = 'Read,Write,Edit,MultiEdit,NotebookEdit,Bash,Grep,Glob';

// No rule text in here: the marker is the rule itself, so an echo would pass
export const SECOND_PROMPT = `Use the Agent tool exactly once, to dispatch the ${SECOND_AGENT_TYPE} agent. Ask it to answer `
  + 'from what is already in its context and use no tool, and to reply with the rule its preloaded '
  + `${SHARED_SKILL} skill gives about the LSP tool and grep, word for word as plain text, with no quote marks, `
  + 'no formatting and nothing else. Then reply with what it returned.';

/**
 * Write the throwaway plugin under `root`: one tool-less agent listing both skills, and the two skills.
 * @param {string} root a fresh temp dir @returns {string} the plugin dir to hand `--plugin-dir`
 */
export function writeFixture(root) {
  const plugin = join(root, 'plugin');
  makeDir(join(plugin, '.claude-plugin'));
  writeFile(join(plugin, '.claude-plugin', 'plugin.json'),
    JSON.stringify({ name: PLUGIN_NAME, version: '0.0.0', description: 'Throwaway fixture for a skill preload proof.' }));
  makeDir(join(plugin, 'agents'));
  writeFile(join(plugin, 'agents', 'preload-proof.md'), [
    '---',
    'name: preload-proof',
    'description: Replies with the lines its preloaded skills hold.',
    'tools: []',
    'skills:',
    ...SKILLS.map((s) => `  - ${s}`),
    '---',
    '',
    'Reply with the line each of your preloaded skills holds, verbatim, and nothing else.',
    '',
  ].join('\n'));
  SKILLS.forEach((name, i) => {
    const marker = i === 0 ? MARKERS.first : MARKERS.second;
    makeDir(join(plugin, 'skills', name));
    writeFile(join(plugin, 'skills', name, 'SKILL.md'),
      `---\nname: ${name}\ndescription: Probe skill ${i + 1} of 2; its body holds one line.\n---\n\n`
      + `The line this skill holds: ${marker}\n`);
  });
  return plugin;
}

/**
 * The host's argument list. --setting-sources project in an empty cwd keeps the user's plugins, hooks and model out.
 * @param {string} pluginDir @returns {string[]}
 */
export function hostArgs(pluginDir) {
  return ['-p', PROMPT, '--output-format', 'stream-json', '--verbose', '--forward-subagent-text',
    '--plugin-dir', pluginDir, '--tools', 'Agent', '--allowedTools', 'Agent',
    '--setting-sources', 'project', '--strict-mcp-config', '--no-session-persistence'];
}

/**
 * The second run's argument list: this tree as the plugin, and the parent held by deny rules, not `--tools`.
 * @returns {string[]}
 */
export function secondHostArgs() {
  return ['-p', SECOND_PROMPT, '--output-format', 'stream-json', '--verbose', '--forward-subagent-text',
    '--plugin-dir', PLUGIN_ROOT, '--allowedTools', 'Agent', '--disallowedTools', PARENT_DENY,
    '--setting-sources', 'project', '--strict-mcp-config', '--no-session-persistence'];
}

/** @param {any} content a tool_result's content: a string or an array of blocks @returns {string} */
function textOf(content) {
  if (typeof content === 'string') return content;
  return (Array.isArray(content) ? content : [])
    .filter((b) => b && b.type === 'text').map((b) => b.text).join('\n');
}

/** @param {any} v @returns {string[]} every scalar under v, nested fields included, its whitespace left as it is */
function leaves(v) {
  return v && typeof v === 'object' ? Object.values(v).flatMap(leaves) : [String(v)];
}

/** @param {any} rec @returns {any[]} the tool_use blocks of an assistant record */
function toolUses(rec) {
  const content = rec && rec.type === 'assistant' && rec.message && rec.message.content;
  return Array.isArray(content) ? content.filter((b) => b && b.type === 'tool_use') : [];
}

/**
 * Read the host's stream-json stdout. `dispatched:false` means no dispatch came back with a result, so the check did
 * not run. The return is the subagent's own tool_result, never the parent's final text.
 * @param {string} stdout @param {string} [agentType] the agent the script asked the parent to dispatch
 * @returns {{dispatched: false} | {dispatched: true, hostVersion: string|null, dispatchInput: any, returned: string,
 *   nestedRecords: number, subagentToolCalls: number, countSeen: boolean, parentOtherCalls: number}}
 */
export function readStream(stdout, agentType = AGENT_TYPE) {
  /** @type {any[]} */
  const recs = [];
  for (const line of stdout.split('\n')) {
    try { recs.push(JSON.parse(line)); } catch { /* a blank or non-JSON line carries nothing to count */ }
  }
  const parentUses = recs.filter((r) => r && r.parent_tool_use_id == null).flatMap(toolUses);
  const dispatch = parentUses.find((b) => DISPATCH_TOOLS.includes(b.name) && b.input && b.input.subagent_type === agentType);
  const handBack = dispatch && recs.find((r) => r && r.type === 'user' && r.parent_tool_use_id == null
    && Array.isArray(r.message && r.message.content)
    && r.message.content.some((b) => b && b.type === 'tool_result' && b.tool_use_id === dispatch.id));
  if (!handBack) return { dispatched: false };
  const block = handBack.message.content.find((b) => b.type === 'tool_result' && b.tool_use_id === dispatch.id);
  // the subagent's own speech: forwarded assistant records; the user record under the same id is just the prompt
  const nested = recs.filter((r) => r && r.type === 'assistant' && r.parent_tool_use_id === dispatch.id);
  const notice = recs.find((r) => r && r.subtype === 'task_notification' && r.tool_use_id === dispatch.id);
  const tally = notice && notice.usage && notice.usage.tool_uses;
  // a forwarded text record says nothing about tool calls; only the host's numeric tally makes 0 an observed 0
  const countSeen = typeof tally === 'number' && Number.isFinite(tally);
  const init = recs.find((r) => r && r.type === 'system' && r.subtype === 'init');
  const result = handBack.tool_use_result;
  return {
    dispatched: true,
    hostVersion: (init && init.claude_code_version) || null,
    dispatchInput: dispatch.input,
    // tool_use_result.content is the report without the host's hand-back frame; the block is the fallback
    returned: textOf((result && result.content) || block.content),
    nestedRecords: nested.length,
    // the host's own tally too, so a host that stops forwarding tool_use blocks can't read as 0
    subagentToolCalls: Math.max(nested.flatMap(toolUses).length, countSeen ? tally : 0),
    countSeen,
    parentOtherCalls: parentUses.length - 1,
  };
}

/**
 * Judge what came back, apart from any host, so a test or the stored result can be handed straight in.
 * @param {{returned: string, subagentToolCalls: number, parentOtherCalls: number}} seen
 * @returns {{reason: string, detail: string}[]} every failure; empty is a pass
 */
export function judge(seen) {
  const out = [];
  if (!String(seen.returned).includes(MARKERS.second)) {
    out.push({ reason: 'second-marker-missing', detail: `the agent's return does not hold ${MARKERS.second}` });
  }
  if (seen.subagentToolCalls !== 0) {
    out.push({ reason: 'subagent-tool-calls', detail: `subagent_tool_calls is ${seen.subagentToolCalls}, not 0` });
  }
  if (seen.parentOtherCalls !== 0) {
    out.push({ reason: 'parent-other-calls', detail: `parent_other_calls is ${seen.parentOtherCalls}, not 0` });
  }
  return out;
}

/**
 * Judge the second run: the rule back, whitespace-collapsed as self-verify reads it, and nothing read to get it.
 * @param {{returned: string, subagentToolCalls: number}} seen
 * @returns {{reason: string, detail: string}[]} every failure; empty is a pass
 */
export function judgeSecond(seen) {
  const out = [];
  if (!carriesSharedRule(seen.returned)) {
    out.push({ reason: 'shared-rule-missing',
      detail: `the second run's return does not hold the rule lib/shared-rule.mjs holds: ${SHARED_RULE}` });
  }
  if (seen.subagentToolCalls !== 0) {
    out.push({ reason: 'subagent-tool-calls',
      detail: `second run: subagent_tool_calls is ${seen.subagentToolCalls}, not 0` });
  }
  return out;
}

/** @typedef {Exclude<ReturnType<typeof readStream>, {dispatched: false}>} Seen */

const RUNS = [
  { name: 'first', agentType: AGENT_TYPE, args: (/** @type {string} */ root) => hostArgs(writeFixture(root)),
    judge, carries: (/** @type {string} */ t) => [MARKERS.first, MARKERS.second].filter((m) => t.includes(m)),
    /** @param {Seen} s */
    stored: (s) => ({ agent: AGENT_TYPE, host_version: s.hostVersion, markers: { ...MARKERS }, returned: s.returned,
      came_back: { first: s.returned.includes(MARKERS.first), second: s.returned.includes(MARKERS.second) },
      subagent_tool_calls: s.subagentToolCalls, parent_other_calls: s.parentOtherCalls }) },
  // its agent holds real tools, so the host's tally is the only thing that shows it used none
  { name: 'second', agentType: SECOND_AGENT_TYPE, args: () => secondHostArgs(), needsTally: true,
    judge: judgeSecond, carries: (/** @type {string} */ t) => (carriesSharedRule(t) ? [SHARED_RULE] : []),
    /** @param {Seen} s */
    stored: (s) => ({ agent: SECOND_AGENT_TYPE, host_version: s.hostVersion, marker: SHARED_RULE, returned: s.returned,
      came_back: carriesSharedRule(s.returned),
      subagent_tool_calls: s.subagentToolCalls, parent_other_calls: s.parentOtherCalls }) },
];

/**
 * One headless dispatch in its own empty cwd; the temp tree goes either way.
 * @param {(root: string) => string[]} args
 */
function spawnHost(args) {
  // a random name stands in for mkdtemp, which lib/planning-store.mjs doesn't offer
  const root = join(tmpdir(), `cad-preload-proof-${randomUUID()}`);
  try {
    const cwd = join(root, 'cwd');
    makeDir(cwd);
    // SIGKILL on the bound, as lib/bounded-run.mjs does; stderr kept here because it's what a refusal says
    return spawnSync('claude', args(root), {
      cwd, timeout: HOST_TIMEOUT_MS, killSignal: 'SIGKILL', encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
    });
  } finally {
    removeTree(root);
  }
}

/** @param {string[]} argv */
function main(argv) {
  const out = requireFlag(argv, '--out', CONTRACTS['skill-preload-proof.mjs']['']['--out']) || STORED_RESULT;
  /** @type {Record<string, any>} */
  const result = {};
  /** @type {{run: string, reason: string, detail: string}[]} */
  const failures = [];
  for (const r of RUNS) {
    const run = spawnHost(r.args);
    if (run.error || run.status !== 0) {
      const why = run.error ? /** @type {any} */ (run.error).code || run.error.message : `exit ${run.status}`;
      emit({ ok: false, run: r.name, reason: 'host-did-not-run',
        detail: `${r.name} run: claude did not run to completion (${why}); nothing written`,
        stderr: String(run.stderr || '').slice(-2000),
        hint: 'run `claude -p hello` in a shell: it must answer before this proof can run; stderr holds what the host said' });
      return;
    }
    const seen = readStream(run.stdout, r.agentType);
    if (!seen.dispatched) {
      emit({ ok: false, run: r.name, reason: 'no-dispatch-result',
        detail: `${r.name} run: the stream holds no hand-back from a ${r.agentType} dispatch; nothing written`,
        hint: 're-run the command; a second miss means the parent no longer dispatches by this name or the stream shape changed' });
      return;
    }
    const mine = r.judge(seen);
    // not JSON.stringify: it turns a newline into \n, and the second run's collapsed comparison would miss the rule
    const input = leaves(seen.dispatchInput || {}).join(' ');
    for (const m of r.carries(input)) {
      mine.push({ reason: 'dispatch-input-carries-marker', detail: `the dispatch input holds ${m}, so it proves nothing` });
    }
    if (seen.nestedRecords === 0) {
      mine.push({ reason: 'no-subagent-record',
        detail: 'the stream holds no record from inside the subagent besides its result, so its tool calls cannot be counted' });
    }
    if (r.needsTally && !seen.countSeen) {
      mine.push({ reason: 'subagent-count-missing',
        detail: 'the host\'s tool_uses tally for the dispatch is absent or not a number, so a Read inside the subagent cannot be ruled out' });
    }
    failures.push(...mine.map((f) => ({ run: r.name, ...f })));
    result[r.name] = r.stored(seen);
  }
  // the file carries no failure field, so a failed run written there would read as a pass
  if (failures.length) {
    emit({ ok: false, run: failures[0].run, reason: failures[0].reason, failures, seen: result,
      hint: `nothing written to ${out}; seen holds what came back; do not adjust the fixture until it passes, plans built on D-02 rest on this answer` });
    return;
  }
  writeFile(out, JSON.stringify(result, null, 2) + '\n');
  emit({ ok: true, result: out, host_version: result.first.host_version });
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try { main(process.argv.slice(2)); } catch (e) { emitCaught(e); }
}
