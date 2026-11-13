#!/usr/bin/env node
// @ts-check
// executor-counts.mjs - prints one executor's LSP calls, grep calls, turns and tokens: the before and after record (D-13).
// Tool calls come from the executor's own transcript; turns and tokens from its `cad-executor` return in the trace.
//
// Usage: executor-counts.mjs --transcript <agent-*.jsonl> --trace <trace.jsonl>
//
// The grep figure is Grep tool calls plus Bash calls that run grep or rg as a command word, each Bash call once.
// Reads two files, writes nothing. No return for the agent is a refusal, never a half-filled answer.
'use strict';

import { readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { DONE, emit, emitCaught } from './lib/seam-io.mjs';
import { CONTRACTS, evaluateRow, requireFlag } from './lib/arg-contract.mjs';
import { missingFlagValue } from './lib/seam-input.mjs';
import { transcriptEntries } from './lib/subagent-transcript.mjs';

const ROW = CONTRACTS['executor-counts.mjs'];

// git-segments' separators, plus the openers a command word can sit behind: `$(`, `(` and a backtick
const SEPARATOR = /&&|\|\||\$\(|[;|&\n(`]/;
// words that stand before a command word without being one
const LEADING = new Set(['if', 'then', 'else', 'elif', 'do', 'while', 'until', '!', 'time', '{']);
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const SEARCH = /(^|\/)(grep|rg)$/;

/**
 * Whether a shell line runs grep or rg as a command word anywhere in it. `cat grep-notes.txt` doesn't; `ls | rg x` does.
 * @param {unknown} command @returns {boolean}
 */
export function runsSearch(command) {
  if (typeof command !== 'string') return false;
  for (const segment of command.split(SEPARATOR)) {
    for (const word of segment.trim().split(/\s+/)) {
      if (!word || LEADING.has(word) || ASSIGNMENT.test(word)) continue;
      if (SEARCH.test(word)) return true;
      break; // the first real word is the command; the rest are its arguments
    }
  }
  return false;
}

/**
 * The tool-call figures from a transcript's assistant lines. A call is counted once by its id, since the host writes
 * one line per content block and a repeated block must not count twice.
 * @param {any[]} entries what `transcriptEntries` returned
 */
export function toolCounts(entries) {
  const seen = new Set();
  let tools = 0;
  let lsp = 0;
  let grep = 0;
  for (const entry of entries) {
    const content = entry.message && Array.isArray(entry.message.content) ? entry.message.content : [];
    for (const block of content) {
      if (!block || block.type !== 'tool_use') continue;
      if (typeof block.id === 'string' && block.id) {
        if (seen.has(block.id)) continue;
        seen.add(block.id);
      }
      tools += 1;
      if (block.name === 'LSP') lsp += 1;
      else if (block.name === 'Grep') grep += 1;
      else if (block.name === 'Bash' && runsSearch(block.input && block.input.command)) grep += 1;
    }
  }
  return { tools, lsp, grep };
}

/** @param {string} reason @param {string} detail @param {string} hint @returns {never} */
function refuse(reason, detail, hint) {
  emit({ ok: false, reason, detail, hint });
  throw DONE;
}

/** @param {string} path @param {string} flag */
function readOrRefuse(path, flag) {
  try {
    return readFileSync(path, 'utf8');
  } catch (e) {
    return refuse('unreadable-file', `${flag} ${path}: ${e && e.code ? e.code : String(e)}`,
      `give ${flag} a path to a readable file and re-run the command`);
  }
}

/** @param {string[]} argv */
function main(argv) {
  const door = evaluateRow(argv, ROW, '');
  if (!door.ok) throw missingFlagValue(door.detail);
  const transcriptPath = requireFlag(argv, '--transcript', ROW['']['--transcript']);
  const tracePath = requireFlag(argv, '--trace', ROW['']['--trace']);

  const entries = transcriptEntries(readOrRefuse(transcriptPath, '--transcript'));
  const agent = entries.map((e) => e.agentId).find((id) => typeof id === 'string' && id);
  if (!agent) {
    refuse('no-agent-id', `${transcriptPath} carries no agentId on any assistant line`,
      'pass --transcript the agent-<id>.jsonl file of the executor itself, not a session transcript');
  }

  let ret = null;
  for (const line of readOrRefuse(tracePath, '--trace').split('\n')) {
    let event;
    try { event = JSON.parse(line); } catch { continue; } // a blank or torn line is no event
    if (event && event.event === 'return' && event.role === 'cad-executor' && event.agent_id === agent) ret = event;
  }
  if (!ret || !Number.isSafeInteger(ret.turns) || !Number.isSafeInteger(ret.tokens)) {
    refuse('no-return', `no cad-executor return with turns and tokens for agent ${agent} in ${tracePath}`,
      'pass --trace the trace.jsonl that recorded this executor\'s return; tool counts alone are not the record');
  }

  const { tools, lsp, grep } = toolCounts(entries);
  emit({ ok: true, agent_id: agent, lsp, grep, turns: ret.turns, tokens: ret.tokens, tool_calls: tools });
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try { main(process.argv.slice(2)); } catch (e) { if (e !== DONE) emitCaught(e); }
}
