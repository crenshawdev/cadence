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
// wrappers that run the word after them; these three and no more, `timeout` first eating its duration
const WRAPPERS = new Set(['command', 'timeout', 'xargs']);
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/;
const SEARCH = /(^|\/)(grep|rg)$/;
// `<<EOF`, `<<-EOF`, `<<'EOF'`, `<< "EOF"`; never the `<<<` here-string
const HEREDOC = /(?<!<)<<(?!<)-?\s*(['"]?)([A-Za-z_][\w.-]*)\1/g;

/**
 * The line with heredoc bodies dropped and each quoted span made one inert `_`, so text an executor writes - a report
 * table, a commit body, a `node -e` program - is never read as a command. Bodies go first, by lines, so a heredoc
 * inside `"$(...)"` loses its body before the quotes around it are paired. Not a shell parser and not to become one.
 * @param {string} command @returns {string}
 */
function codeOnly(command) {
  const kept = [];
  const pending = [];
  for (const line of command.split('\n')) {
    if (pending.length) {
      if (line.trim() === pending[0]) pending.shift();
      continue;
    }
    kept.push(line);
    for (const m of line.matchAll(HEREDOC)) pending.push(m[2]);
  }
  return inertQuotes(kept.join('\n'));
}

/**
 * The index of the `)` closing the `(` at `open`, its own quoted spans skipped. Unclosed runs to the end.
 * @param {string} text @param {number} open @returns {number}
 */
function substitutionEnd(text, open) {
  let depth = 1;
  for (let j = open + 1; j < text.length; j += 1) {
    const ch = text[j];
    if (ch === '\\') j += 1;
    else if (ch === '(') depth += 1;
    else if (ch === ')' && --depth === 0) return j;
    else if (ch === '\'' || ch === '"') {
      let k = j + 1;
      while (k < text.length && text[k] !== ch) k += ch === '"' && text[k] === '\\' ? 2 : 1;
      j = k;
    }
  }
  return text.length;
}

/**
 * Each quoted span made one inert `_`. The one exception (D-17): a `$(...)` or backtick run inside double quotes is
 * code the shell runs, so its text goes on a line of its own after the rest - the `_` keeps its place in the outer line.
 * @param {string} text @returns {string}
 */
function inertQuotes(text) {
  let out = '';
  const ran = [];
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '\\') { out += text.slice(i, i + 2); i += 1; continue; } // `it\'s` opens no quote
    if (ch !== '\'' && ch !== '"') { out += ch; continue; }
    let j = i + 1;
    while (j < text.length && text[j] !== ch) {
      if (ch === '\'') j += 1;
      else if (text[j] === '\\') j += 2;
      else if (text.startsWith('$(', j)) {
        const close = substitutionEnd(text, j + 1);
        ran.push(inertQuotes(text.slice(j + 2, close)));
        j = close + 1;
      } else if (text[j] === '`') {
        let k = j + 1;
        while (k < text.length && text[k] !== '`') k += text[k] === '\\' ? 2 : 1;
        ran.push(inertQuotes(text.slice(j + 1, k)));
        j = k + 1;
      } else j += 1;
    }
    out += '_'; // a word still stands here: `"$BIN" grep` runs $BIN, not grep
    i = j;
  }
  return ran.length ? `${out}\n${ran.join('\n')}` : out;
}

/**
 * Whether a shell line runs grep or rg as a command word anywhere in it. `cat grep-notes.txt` doesn't; `ls | rg x` does.
 * @param {unknown} command @returns {boolean}
 */
export function runsSearch(command) {
  if (typeof command !== 'string') return false;
  for (const segment of codeOnly(command).split(SEPARATOR)) {
    const words = segment.trim().split(/\s+/);
    for (let i = 0; i < words.length; i += 1) {
      const word = words[i];
      if (word === 'timeout') i += 1;
      if (!word || LEADING.has(word) || WRAPPERS.has(word) || ASSIGNMENT.test(word)) continue;
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
