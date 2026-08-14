// @ts-check
// read-trace.mjs - the writer of `.planning/reads.jsonl`, the per-tool-call
// record of what a dispatch actually OPENED once it started working.
//
// Why a SIDECAR and not `trace.jsonl`. lib/trace.mjs declares itself the one
// writer and one reader of that file, its `FAMILIES` list is validated at the
// seam while `renderTrace`'s `counts` is a fixed four-key literal (a fifth
// family writes fine and counts nowhere), and its 1 MiB cap is sized for tens
// of events per phase, not the thousands a per-tool-call record produces. So
// this is a second file with its own cap and its own reader, and `trace.jsonl`
// keeps every contract it already states.
//
// What it exists to answer. `trace.jsonl` records `read` only as the DECLARED
// file list at dispatch. Measured on this repo 2026-08-14, contract plus
// declared reads account for ~12% of an 8.2M-token run; the other ~88% is
// whatever the worker opened afterwards, and nothing recorded it. Every cut
// proposed against that 88% is unfalsifiable until this file exists.
//
// PATHS ONLY, NEVER PAYLOADS. A Bash command line or a grep pattern can carry
// a secret, and this file is written to be read back into a model's context by
// `/cad-report` and `/cad-suggest` - the exact path by which a recorded value
// becomes a leaked one. So a Bash call records `argv[0]` and nothing else, and
// a Grep call records its search SCOPE and never its pattern. Cost accounting
// needs the target and the count; it has never needed the payload.
//
// NEVER throws, never speaks, always exits 0 at the seam. This runs as a
// PostToolUse hook on every tool call: a recorder that can fail a tool call is
// worse than no recorder, the same contract lib/trace.mjs states for the same
// reason.
'use strict';

import { appendFileSync, lstatSync, statSync } from 'node:fs';
import { join, resolve, sep, relative, isAbsolute } from 'node:path';

export const READS_FILE = 'reads.jsonl';

/**
 * Its own ceiling, deliberately larger than `MAX_TRACE_BYTES`: this file takes
 * one line per tool call rather than per dispatch, so the same 1 MiB would cap
 * out inside a single phase and silently stop recording the thing it exists to
 * record.
 */
export const MAX_READS_BYTES = 8388608;

/** The tools whose calls are worth billing. Anything else is not a read. */
export const RECORDED_TOOLS = ['Read', 'Grep', 'Glob', 'Bash', 'NotebookRead'];

/**
 * The most in-repo file paths one Bash call may bill. A glob expansion or a
 * `for f in *` loop can name hundreds; past a dozen the call is a sweep rather
 * than a read of anything in particular, and an unbounded array would put a
 * multi-kilobyte line into a file whose whole point is being cheap to append.
 */
export const MAX_FILES_PER_CALL = 12;

/** @param {string} planningRoot */
export function readsPath(planningRoot) {
  return join(planningRoot, READS_FILE);
}

/**
 * The first token of a command line - the program, without its arguments.
 * A command may carry a secret in a flag value; a program name cannot.
 * @param {string} cmd
 */
export function programOf(cmd) {
  const raw = String(cmd || '').trim();
  if (!raw) return null;
  // Scan LINES, and stop at the heredoc opener. A heredoc body, a quoted
  // script, an inline `python3 - <<EOF` payload - all of it lives on the lines
  // AFTER the opener, and splitting the whole string on separators walks
  // straight into that content. The live hook caught exactly that on its first
  // run, billing a token lifted out of a heredoc, which is the paths-only
  // contract at the top of this file broken by its own parser. Scanning only
  // the first line instead would be safe but useless: nearly every real command
  // here opens with a bare `cd` on its own line.
  const lines = raw.split('\n');
  for (let i = 0; i < lines.length && i < 8; i++) {
    const line = lines[i];
    for (const seg of line.split(/&&|\|\||;|\|/)) {
      // Strip a leading `VAR=value` assignment run so `FOO=bar git status`
      // bills git rather than the assignment - and so a secret assigned inline
      // is never the token that gets recorded.
      const parts = seg.trim().split(/\s+/).filter((p) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(p));
      const head = parts[0];
      if (!head) continue;
      // Segments, so a command opening with a directory change still bills the
      // program that did the work: `cd /a && rg foo` is a Grep, not a `cd`.
      const prog = head.split('/').pop();
      if (!prog || prog === 'cd') continue;
      // The BOUND, and the reason this cannot leak: a program name is a short
      // bare word. Anything carrying a quote, a backtick, a space or a sigil is
      // not a program, it is content, and content is refused outright rather
      // than recorded and hoped about.
      return /^[A-Za-z0-9._+-]{1,64}$/.test(prog) ? prog : null;
    }
    // The opener's own line has already been searched above; everything past it
    // is body, so the scan ends here rather than reading the payload.
    if (line.includes('<<')) break;
  }
  return null;
}


/**
 * The in-repo FILE PATHS a Bash command names, and nothing else.
 *
 * Why this is safe, and why `programOf` above refused to look at arguments at
 * all. A command line can carry a secret in a flag value, so the original rule
 * was to bill `argv[0]` and discard the rest. The cost of that rule, measured
 * on this repo 2026-08-14: 323 of 329 recorded targets were bare program names
 * (`sed`, `grep`, `node`), six named a file, and `redundancy` - the figure this
 * file exists to produce - was measuring how often a shell verb was typed
 * rather than how often a file was re-opened.
 *
 * The filter that recovers the paths without recovering the payload is
 * EXISTENCE, checked against the project tree:
 *
 *   1. the token must LOOK like a path - no quote, sigil, backtick, glob or
 *      redirect, not a `VAR=value` assignment, not a `-flag`, and carrying a
 *      `/` or a `.` so bare shell keywords (`for`, `do`, `then`) never qualify;
 *   2. it must resolve INSIDE the project root - an absolute path elsewhere on
 *      the machine is refused outright, so `~/.config/<service>/credentials`
 *      cannot be recorded even though it exists;
 *   3. it must be an existing regular FILE.
 *
 * A secret VALUE does not satisfy (3): a token, a password or a key is not a
 * file in this repo, so it is dropped before anything is written. That is the
 * whole guarantee - the paths-only contract at the top of this file is enforced
 * by the filesystem rather than by refusing to look.
 *
 * The recorded form is the path RELATIVE to the project root, so an absolute
 * home directory never reaches the record even for a file that qualified.
 *
 * Pure by INJECTION, like `now` on `recordFromHook`: the caller supplies the
 * root and the existence predicate, so the whole rule is testable without a
 * filesystem and the lib keeps doing no I/O of its own. With no `opts` the
 * function returns nothing and the record is byte-identical to what it was
 * before this existed.
 *
 * @param {string} cmd the command line
 * @param {{root?: string, cwd?: string, isFile?: (p: string) => boolean}} [opts]
 * @returns {string[]} project-relative paths, in first-seen order, capped
 */
export function filesOf(cmd, opts) {
  const root = opts && typeof opts.root === 'string' ? opts.root : null;
  const isFile = opts && typeof opts.isFile === 'function' ? opts.isFile : null;
  if (!root || !isFile) return [];
  const raw = String(cmd || '').trim();
  if (!raw) return [];
  // Relative tokens are resolved against the call's own cwd when the caller
  // knows it, because a session working in a subdirectory writes `bin/x.mjs`
  // and means a file the root alone would not find.
  const base = opts && typeof opts.cwd === 'string' && opts.cwd ? opts.cwd : root;

  /** @type {string[]} */
  const out = [];
  const seen = new Set();
  const lines = raw.split('\n');
  // The same heredoc bound `programOf` states: everything past the opener is
  // body, and a body is payload.
  for (let i = 0; i < lines.length && i < 8; i++) {
    const line = lines[i];
    for (const tok of line.split(/\s+/)) {
      if (out.length >= MAX_FILES_PER_CALL) return out;
      if (!tok) continue;
      // Content, not a path: anything quoted, expanded, globbed, redirected or
      // substituted is refused rather than parsed and hoped about.
      if (!/^[A-Za-z0-9._\/@+-]{1,256}$/.test(tok)) continue;
      if (tok.startsWith('-')) continue;          // a flag, not its value
      if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(tok)) continue; // inline assignment
      if (!tok.includes('/') && !tok.includes('.')) continue; // bare shell word
      let abs;
      try {
        abs = isAbsolute(tok) ? resolve(tok) : resolve(base, tok);
      } catch { continue; }
      // Confinement. Checked BEFORE the stat, so a path outside the project is
      // never even probed for existence.
      if (abs !== root && !abs.startsWith(root + sep)) continue;
      let ok = false;
      try { ok = isFile(abs); } catch { ok = false; }
      if (!ok) continue;
      const rel = relative(root, abs);
      if (!rel || seen.has(rel)) continue;
      seen.add(rel);
      out.push(rel);
    }
    if (line.includes('<<')) break;
  }
  return out;
}


/**
 * Shape a PostToolUse hook payload into one record, or null when the call is
 * not a read. Pure: no I/O, so the whole rule is testable without a hook.
 * @param {any} input the parsed hook JSON
 * @param {string} [now] ISO timestamp, injectable for tests
 * @param {{root?: string, cwd?: string, isFile?: (p: string) => boolean}} [opts]
 *   the project root and existence predicate `filesOf` needs. Omitted - the
 *   shape every existing caller and test uses - no `files` field is added and
 *   the record is exactly what it was.
 */
export function recordFromHook(input, now, opts) {
  if (!input || typeof input !== 'object') return null;
  const tool = input.tool_name;
  if (!RECORDED_TOOLS.includes(tool)) return null;

  const ti = input.tool_input && typeof input.tool_input === 'object' ? input.tool_input : {};
  /** @type {any} */
  const rec = {
    ts: now || new Date().toISOString(),
    tool,
    // `agent_id` is absent on a main-thread call and present inside a subagent,
    // which is exactly the split this file exists to measure: coordinator
    // reading versus worker reading.
    agent: input.agent_type || (input.agent_id ? 'unknown-agent' : 'coordinator'),
  };
  if (input.agent_id) rec.agent_id = input.agent_id;
  if (input.tool_use_id) rec.tool_use_id = input.tool_use_id;

  if (tool === 'Read' || tool === 'NotebookRead') {
    rec.target = ti.file_path ?? ti.notebook_path ?? null;
    if (Number.isFinite(ti.offset)) rec.offset = ti.offset;
    if (Number.isFinite(ti.limit)) rec.limit = ti.limit;
  } else if (tool === 'Glob') {
    rec.target = ti.path ?? null;
  } else if (tool === 'Grep') {
    // SCOPE only. The pattern is the field that can carry a secret.
    rec.target = ti.path ?? null;
    if (ti.output_mode) rec.mode = ti.output_mode;
  } else if (tool === 'Bash') {
    // `target` stays the PROGRAM, unchanged: it is what `byTool`/`topTargets`
    // have always counted and what every record on disk already carries.
    // `files` is the addition, on its own field, so the two quantities are
    // never pooled into one ratio again.
    rec.target = programOf(ti.command);
    const files = filesOf(ti.command, { ...(opts || {}), cwd: (opts && opts.cwd) || input.cwd });
    if (files.length) rec.files = files;
  }

  // Opportunistic: `tool_response` is not documented for PostToolUse. If the
  // host does send one, its size is the only exact byte figure available and
  // it costs nothing to take. If it does not, `bytes` is simply absent - the
  // same posture lib/trace.mjs takes on an absent token figure, and for the
  // same reason: an invented number is worse than a missing one.
  const resp = input.tool_response;
  if (resp != null) {
    try {
      rec.bytes = typeof resp === 'string' ? resp.length : JSON.stringify(resp).length;
    } catch { /* unserializable response: leave `bytes` absent */ }
  }
  return rec;
}

/**
 * Append one record. Mirrors lib/trace.mjs's guarded append: lstat for a
 * planted symlink ahead of the size stat, the cap enforced BEFORE the write
 * because an append-only file has no whole-file rewrite to trim from, and a
 * reason returned rather than thrown on every failure.
 * @param {string} planningRoot
 * @param {any} record
 */
export function appendRead(planningRoot, record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { written: false, reason: 'bad-record' };
  }
  const file = readsPath(planningRoot);
  try {
    if (lstatSync(file).isSymbolicLink()) return { written: false, reason: 'symlinked-reads' };
  } catch { /* ENOENT is the ordinary first write */ }
  try {
    if (statSync(file).size >= MAX_READS_BYTES) return { written: false, reason: 'size-cap' };
  } catch (e) {
    const code = e && /** @type {any} */ (e).code;
    if (code !== 'ENOENT') return { written: false, reason: code || 'stat-failed' };
  }
  let line;
  try {
    line = `${JSON.stringify(record)}\n`;
  } catch (e) {
    return { written: false, reason: 'unserializable-record' };
  }
  try {
    appendFileSync(file, line);
  } catch (e) {
    return { written: false, reason: (e && /** @type {any} */ (e).code) || 'append-failed' };
  }
  return { written: true };
}

/**
 * Fold records into the figures the ledger asks for. Pure, so the shape is
 * tested without a file: callers own the reading.
 *
 * TWO redundancies, deliberately, because `target` and `files` measure
 * different things and one ratio over both is a category error:
 *
 * - `redundancy` is calls over distinct TARGETS. For Read/Grep/Glob a target
 *   is a path, but for Bash it is the PROGRAM, so on a Bash-heavy corpus this
 *   number reports how often a shell verb was typed. Measured here 2026-08-14
 *   at 12.96 over 25 "targets" that were 14 shell verbs and a couple of files.
 *   Kept, unchanged, because every record already on disk carries only this.
 * - `fileRedundancy` is path-touches over distinct FILES, from the `files`
 *   array `filesOf` fills. THIS is the figure the file was written to expose -
 *   whether in-dispatch reading repeats the way `trace.jsonl`'s declared
 *   read-sets did at 7.0x - and it is the one to read on any corpus recorded
 *   after `files` existed.
 *
 * A record with no target (a Bash call whose program could not be parsed)
 * counts toward `calls` and not toward `distinct`, because an unnamed target
 * cannot be shown to repeat. A record with no `files` counts the same way
 * against the file figures, and every record written before this field existed
 * is exactly that - so `fileCalls` is how much of `calls` the file half
 * actually covers, the same posture `bytesCoverage` already takes.
 *
 * @param {any[]} records
 */
export function summarizeReads(records) {
  const byAgent = new Map();
  const byTool = new Map();
  const targets = new Map();
  const files = new Map();
  let calls = 0;
  let bytes = 0;
  let withBytes = 0;
  let fileCalls = 0;

  for (const r of records) {
    if (!r || typeof r !== 'object') continue;
    calls++;
    const a = r.agent || 'coordinator';
    byAgent.set(a, (byAgent.get(a) || 0) + 1);
    if (r.tool) byTool.set(r.tool, (byTool.get(r.tool) || 0) + 1);
    if (r.target) targets.set(r.target, (targets.get(r.target) || 0) + 1);
    if (Array.isArray(r.files) && r.files.length) {
      fileCalls++;
      for (const f of r.files) {
        if (typeof f === 'string' && f) files.set(f, (files.get(f) || 0) + 1);
      }
    }
    if (Number.isFinite(r.bytes)) { bytes += r.bytes; withBytes++; }
  }

  const distinct = targets.size;
  const targeted = [...targets.values()].reduce((a, b) => a + b, 0);
  const distinctFiles = files.size;
  const fileTouches = [...files.values()].reduce((a, b) => a + b, 0);
  const desc = (m) => [...m.entries()].sort((x, y) => y[1] - x[1]);

  return {
    calls,
    distinct,
    // Absent rather than Infinity when nothing carried a target: a ratio over
    // zero distinct targets is not a redundancy of infinity, it is no measurement.
    redundancy: distinct ? Number((targeted / distinct).toFixed(2)) : null,
    // Only meaningful if the host sent responses at all; `withBytes` is how much
    // of `calls` the figure actually covers, so a partial capture never reads as
    // a total.
    bytes: withBytes ? bytes : null,
    bytesCoverage: calls ? Number((withBytes / calls).toFixed(2)) : 0,
    // The file half. Absent-as-null rather than zero for the ratio, for the
    // same reason `redundancy` is: no distinct files is no measurement, not a
    // redundancy of nothing.
    fileCalls,
    distinctFiles,
    fileTouches,
    fileRedundancy: distinctFiles ? Number((fileTouches / distinctFiles).toFixed(2)) : null,
    byAgent: desc(byAgent),
    byTool: desc(byTool),
    topTargets: desc(targets).slice(0, 15),
    topFiles: desc(files).slice(0, 15),
  };
}
