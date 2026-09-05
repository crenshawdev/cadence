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

import {
  appendFileSync, closeSync, existsSync, linkSync, lstatSync, openSync, readSync, renameSync,
  statSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { join, resolve, sep, relative, isAbsolute } from 'node:path';
// The ONE statement of which agent FILE carries which rung of which role. The
// join below needs the reverse direction - a recorded `agent_type` stem back to
// the role a dispatch event names - and deriving it from a `-<rung>` suffix
// regex would be a SECOND statement of the mapping: `cad-assumptions-analyzer`
// is that role's `xhigh` rung while `cad-assumptions-analyzer-high` is its
// lower one, so no suffix convention is true of all 30 files, and a rung added
// to the table but not to the regex would leave those reads silently unjoined.
// Pure and fs-free, so the hook path this file also serves stays a plain parse.
import { RUNG_FILES } from './rung-agent.mjs';

export const READS_FILE = 'reads.jsonl';

/**
 * Its own ceiling, deliberately larger than `MAX_TRACE_BYTES`: this file takes
 * one line per tool call rather than per dispatch, so the same 1 MiB would cap
 * out inside a single phase and silently stop recording the thing it exists to
 * record.
 */
export const MAX_READS_BYTES = 8388608;

/**
 * The tools whose calls are worth billing. Anything else is not a read.
 *
 * The two `mcp__excerpt__*` entries are named the same way the rung agents name
 * them on their `tools:` lines: a user without excerpt never emits one, so the
 * entry costs them nothing, and a user with it gets the read counted in the
 * same denominator as `Read` and `Bash` instead of vanishing. Without them a
 * dispatch that reads entirely through excerpt records ZERO reads, which is
 * indistinguishable from a dispatch that read nothing.
 */
export const RECORDED_TOOLS = ['Read', 'Grep', 'Glob', 'Bash', 'NotebookRead',
  'mcp__excerpt__excerpt_read', 'mcp__excerpt__excerpt_search'];

/** The longest error text a record may carry. A cause, never a payload. */
export const MAX_ERROR_TEXT = 200;

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
 * Where the rotated generation lives. The spelling is stated ONCE, here, so the
 * writer, the `.gitignore` rule that has to name it and every test read it from
 * one place and cannot drift apart. It keeps the record's own `reads.` prefix
 * because a test that filters the planning root on that prefix is how a leaked
 * temp or a second generation reddens a row rather than going unseen.
 */
export const ROTATED_READS_FILE = 'reads.1.jsonl';

/**
 * The claim SIDECAR's spelling, DERIVED from `ROTATED_READS_FILE` rather than
 * written out again, so the two names cannot come apart either - the reason
 * `lib/trace.mjs:138` states for `ROTATION_CLAIM_FILE`. A caller that has to
 * name the file then names what the writer actually produces.
 */
export const READS_CLAIM_FILE = `${ROTATED_READS_FILE}.claim`;

/**
 * The two PRIVATE paths `rotateReads` writes inside the planning root, DERIVED
 * from the names above for the reason `READS_CLAIM_FILE` is: the fresh record
 * before it is renamed over the live path, and the leftover generation the
 * single-winner eviction renames aside. The `finally` clears both on every arm
 * the process survives, so they are only ever found by a reader when the
 * process died inside the rotation window - which the hook's 5 s timeout makes
 * reachable, and which leaves the evict temp holding a whole generation of up
 * to `MAX_READS_BYTES`. Stated here so the `.gitignore` rules that have to name
 * them read the spelling the writer actually produces rather than repeating it.
 * A PREFIX and not a whole name: each carries the writer's pid and a random
 * suffix, so the rule that covers them can only ever be a pattern.
 */
export const READS_ROTATE_TEMP_FILE = `${READS_FILE}.rotate`;

/** @see READS_ROTATE_TEMP_FILE - the eviction half of the same pair. */
export const READS_EVICT_TEMP_FILE = `${ROTATED_READS_FILE}.evict`;

/**
 * Where the rotated generation lives, joined onto the planning root the way
 * `readsPath` does.
 * @param {string} planningRoot
 */
export function rotatedReadsPath(planningRoot) {
  return join(planningRoot, ROTATED_READS_FILE);
}

/**
 * Where the claim sidecar lives.
 * @param {string} planningRoot
 */
export function readsClaimPath(planningRoot) {
  return join(planningRoot, READS_CLAIM_FILE);
}

/**
 * The rotation marker's `event` value, the one line a fresh record starts with.
 *
 * The same spelling as `lib/trace.mjs`'s `ROTATION` and a SECOND statement of
 * it, deliberately. `bin/read-trace.mjs` loads this module on every Read, Grep,
 * Glob, Bash and NotebookRead call under the 5-second timeout at
 * `hooks/hooks.json:15-25`, and importing 104 KB of trace source to parse for
 * one string is a real per-tool-call cost - the same reason this module's header
 * already gives for being a sidecar rather than a family of `trace.jsonl`.
 */
export const READS_ROTATION = 'record_rotated';

/**
 * Is this record the rotation marker rather than a tool call?
 *
 * The marker is NOT inert here the way `lib/trace.mjs`'s is in its renderer:
 * `summarizeReads` bills every object it is handed and `joinReads` pushes an
 * `unresolved` row for any record with no `agent`, so an unfiltered marker
 * becomes a phantom read that `/cad-report` prints in its Reading line as a
 * real tool call. This predicate is what the folds filter on.
 *
 * `tool`-absence is safe as the second clause because `recordFromHook` writes a
 * `tool` from `RECORDED_TOOLS` on every record it produces and never writes an
 * `event` key at all, so no real read can satisfy both.
 * @param {any} record
 */
export function isReadsRotationMarker(record) {
  return !!record && typeof record === 'object' && !Array.isArray(record)
    && record.event === READS_ROTATION && !('tool' in record);
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
/**
 * Whether a `tool_response` reports failure, or `null` when it does not say.
 *
 * Both spellings are accepted because they come from different layers: the MCP
 * wire shape is `isError`, and the host's own hook payloads use snake_case
 * throughout. Neither is documented for PostToolUse, so this reads whatever is
 * there and returns `null` rather than guessing when neither key exists.
 * @param {any} resp
 * @returns {boolean|null}
 */
export function errorFlagOf(resp) {
  if (!resp || typeof resp !== 'object' || Array.isArray(resp)) return null;
  if (typeof resp.is_error === 'boolean') return resp.is_error;
  if (typeof resp.isError === 'boolean') return resp.isError;
  return null;
}

/**
 * The FIRST LINE of a failed response's text, capped at `MAX_ERROR_TEXT`.
 *
 * One line and a cap, deliberately. The cause is what makes a refusal legible -
 * excerpt writes `<path>: <reason>` - while the rest of a failure is a payload
 * this file has never stored (`:24` - it needs the target and the count, never
 * the payload). A stack trace or a dumped file body in `reads.jsonl` would put
 * bytes nobody reviewed into a record that /cad-report prints.
 * @param {any} resp
 * @returns {string|null}
 */
export function errorTextOf(resp) {
  let raw = null;
  if (typeof resp === 'string') raw = resp;
  else if (resp && typeof resp === 'object') {
    if (typeof resp.error === 'string') raw = resp.error;
    else if (typeof resp.text === 'string') raw = resp.text;
    else if (Array.isArray(resp.content)) {
      const first = resp.content.find((c) => c && typeof c.text === 'string');
      if (first) raw = first.text;
    }
  }
  if (typeof raw !== 'string') return null;
  const line = redactCause(raw.split('\n', 1)[0].trim());
  if (!line) return null;
  return line.length > MAX_ERROR_TEXT ? line.slice(0, MAX_ERROR_TEXT) : line;
}

/**
 * Mask credential-shaped values in a cause line before it is stored.
 *
 * The line is text this process did not author - a failing tool wrote it - and
 * it lands in a durable record `/cad-report` prints. Redaction is by
 * DESTINATION, not by whether the author is trusted, so the same
 * `token|password|secret|key|api|bearer` vocabulary the risk detector uses
 * gates what may be written. The NAME survives and only the VALUE is masked:
 * "auth failed: api_key=<redacted>" still says what went wrong, which is the
 * whole reason the field exists.
 *
 * A blocking `risk_surface` round on 2026-09-04 raised the reverse claim - that
 * a whole non-string response could be serialized here - and its own scenario
 * refuted it, since only three string fields are ever read. This is the part of
 * that objection that survived: one of those three strings can itself carry a
 * credential.
 * @param {string} line
 * @returns {string}
 */
export function redactCause(line) {
  if (typeof line !== 'string') return '';
  return line
    .replace(/\b(bearer)\s+\S+/gi, '$1 <redacted>')
    .replace(/\b([\w.-]*(?:token|password|passwd|secret|key|api)[\w.-]*)\s*[=:]\s*\S+/gi,
      '$1=<redacted>');
}

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
  } else if (tool === 'mcp__excerpt__excerpt_read') {
    rec.target = ti.path ?? ti.file_path ?? null;
    if (Number.isFinite(ti.offset)) rec.offset = ti.offset;
    if (Number.isFinite(ti.limit)) rec.limit = ti.limit;
  } else if (tool === 'mcp__excerpt__excerpt_search') {
    // SCOPE only, exactly as `Grep` above: the pattern is the field that can
    // carry a secret, and an excerpt search takes the same kind of pattern.
    rec.target = ti.path ?? null;
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
    const failed = errorFlagOf(resp);
    // Written ONLY when the response actually says so. An absent flag stays
    // absent rather than defaulting to `false`: a host that sends no response
    // shape at all would otherwise have every call recorded as a success, which
    // is the invented figure `bytes` above already refuses to make.
    if (failed === true) {
      rec.is_error = true;
      const text = errorTextOf(resp);
      if (text) rec.error = text;
    } else if (failed === false) {
      rec.is_error = false;
    }
  }
  return rec;
}

/**
 * How long a writer that finds a rotation IN FLIGHT waits for it to land before
 * appending anyway. Milliseconds, and a CEILING rather than a deadline: it
 * acquires nothing, blocks nobody, refuses nothing, and it always proceeds when
 * the budget runs out.
 *
 * 250 ms, the figure `lib/trace.mjs:541` uses, restated here rather than a
 * second budget invented for the same posture. The common wait is the one or
 * two milliseconds a rotation actually takes - 1.72, 1.76, 1.76, 2.36 and
 * 3.90 ms measured 2026-08-28 on this repository's real 7,852,530-byte record
 * (D-06) - the ceiling is only ever paid where the winner died holding its
 * claim, and it is 5% of the 5,000 ms this hook gets at `hooks/hooks.json:15-25`.
 */
const READS_ROTATE_WAIT_MS = 250;

/** @param {number} ms */
function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * How old the claim's sidecar has to be before the claim is read as ABANDONED
 * and reclaimed. A constant beside the code that enforces it, never a config
 * key - the posture `MAX_READS_BYTES` and `READS_ROTATE_WAIT_MS` already take.
 *
 * 30 seconds, the figure `lib/trace.mjs:557` uses, and two figures set it for
 * THIS record. It is roughly 7,700x the slowest rotation measured here (3.90 ms
 * over five runs on the real 7,852,530-byte record, 2026-08-28, D-06), so a
 * live claim is nowhere near it - the margin is against a machine suspended
 * mid-rotation, not against a slow write. And it bounds the DEGRADED window: a
 * claim nobody will ever release costs about one `READS_ROTATE_WAIT_MS` per
 * append until it ages out, so a two-minute figure would charge four times as
 * much for the same safety.
 */
const READS_CLAIM_STALE_MS = 30_000;

/**
 * Has the claim that `readsRotationInFlight` just called in flight actually
 * been ABANDONED - taken by a process that was killed or timed out before it
 * could release it?
 *
 * `readsRotationInFlight` cannot answer this and must not be asked to: the
 * claim IS a hard link, so the sibling and the live record are one inode until
 * the swap and every `appendFileSync` into the record bumps that shared inode's
 * timestamps. Only a file written BESIDE the claim can carry the claim's own
 * age (`lib/trace.mjs:120-137`).
 *
 * UNKNOWABLE READS AS LIVE, the same posture `readsRotationInFlight` takes.
 * True only where the sidecar's `mtimeMs` is strictly further in the past than
 * `READS_CLAIM_STALE_MS`; an absent sidecar, a stat that throws and a future
 * mtime from a skewed clock all answer false. The asymmetry is the whole
 * argument: a wrong LIVE answer costs one deferred rotation, and a wrong
 * ABANDONED answer breaks a live claimant and costs the record.
 * @param {string} claim
 */
function readsClaimAbandoned(claim) {
  try {
    return Date.now() - statSync(claim).mtimeMs > READS_CLAIM_STALE_MS;
  } catch {
    return false;
  }
}

/**
 * Is the sibling that already exists a rotation IN FLIGHT, or a generation an
 * earlier rotation left behind?
 *
 * The claim below is a hard LINK, so between the claim and the swap the live
 * path and the sibling are the same inode. That identity is the discriminator,
 * and it has to be one: treating an in-flight claim as a leftover generation
 * would evict a claim a concurrent writer is still holding, and treating a
 * leftover generation as in flight would leave the record unable to rotate a
 * SECOND time - the same write-death this whole arm removes, one indirection
 * down.
 *
 * UNKNOWABLE READS AS IN FLIGHT. Where a platform supplies no inode (Node
 * reports `0`) or either stat fails, the safe answer is the one that never
 * evicts: it costs a deferred rotation, and the append still lands
 * (`lib/trace.mjs:565-588`).
 * @param {string} file @param {string} sibling
 */
function readsRotationInFlight(file, sibling) {
  try {
    const a = statSync(file);
    const b = statSync(sibling);
    if (!a.ino || !b.ino) return true;
    return a.ino === b.ino && a.dev === b.dev;
  } catch {
    return true;
  }
}

/**
 * The whole fresh record a cut of this file writes: the rotation marker, one
 * line, and nothing else.
 *
 * ONE SPELLING, TWO CALLERS. `rotateReads` writes this line; `appendRead`'s
 * size arm reserves its width before it decides whether the pending record has
 * room to sit beside it. Building it in one place is what stops the reserve
 * drifting away from the line the rotation actually writes - a reserve short by
 * one byte is exactly the defect the reserve exists to close.
 *
 * `carried_bytes` SEALS THE GENERATION, and it is not telemetry. It is the size
 * the live record had at the instant the cut claimed it - how much of the file
 * that cut carried away and therefore accounted for. Its ONE consumer is the
 * leftover-generation eviction in `rotateReads`: a writer that appended into the
 * old inode after the cut sealed it left its bytes ONLY in the generation, and
 * the next rotation is about to destroy that generation. The sealed number is
 * what tells that writer where the cut stopped accounting, so it can carry the
 * bytes past it rather than guess an offset or re-append a whole generation.
 *
 * A seal of `null` writes NO field rather than a guess, because the eviction
 * reads an absent field as "rescue nothing" and a wrong offset would re-append
 * a whole generation into a record readers actually read.
 *
 * The field rides after `file` as an ordinary trailing one.
 * `isReadsRotationMarker` keys on `event` plus the absence of `tool` and
 * tolerates extra fields, and `planning/core.mjs`'s reads filter reads only
 * `file` and `ts` off the marker, so it reaches no envelope.
 * @param {number|null} sealed the size of the record this cut carried away
 * @returns {string} the marker line, newline included
 */
function readsRotationMarker(sealed) {
  return `${JSON.stringify({
    ts: new Date().toISOString(),
    event: READS_ROTATION,
    file: ROTATED_READS_FILE,
    ...(sealed === null ? {} : { carried_bytes: sealed }),
  })}\n`;
}

/**
 * An UPPER BOUND on the marker's width, not a measurement of one instance.
 *
 * This record's marker is fixed-shape and carries nothing caller-supplied - the
 * opposite of the trace's, which embeds the carried anchor's `corr` and an
 * unvalidated `phase` and so can only be measured (D-07). `ts` is always the 24
 * characters of an ISO instant, so the one field whose printed width varies is
 * `carried_bytes`, and it is rendered here at the widest value a FILE SIZE can
 * take: past `Number.MAX_SAFE_INTEGER` a size is no longer exactly
 * representable and no file system produces one.
 *
 * Do not "correct" this to the width of a real marker. A reserve narrower than
 * the line the rotation writes admits a record that then lands the fresh file
 * over its bound, which is the defect this constant closes.
 *
 * EXPORTED so `read-trace.test.mjs` can pin the admission threshold to this
 * number rather than restating the shape - a second statement of it in a test
 * would go green against a reserve that had drifted.
 */
export const READS_MARKER_BYTES = Buffer.byteLength(readsRotationMarker(Number.MAX_SAFE_INTEGER));

/**
 * The offset the cut that wrote `record` sealed its own generation at, or
 * `null` where that record names none.
 *
 * The HEAD of the file and never the whole of it. A record a rotation wrote
 * starts with the marker and nothing else, so the first line is the only place
 * a seal can be - and this runs on the rotation path, where reading an 8 MB
 * record to find one number would be the cost the bound exists to avoid.
 *
 * `null` is the fail-closed answer for every unreadable, unparseable,
 * marker-less or non-numeric case, including a generation sealed by the code
 * that shipped before `carried_bytes` existed. The consumer rescues nothing
 * there, because a guessed offset re-appends a whole generation.
 * @param {string} record path to a record whose first line may be a marker
 * @returns {number|null}
 */
function sealOf(record) {
  try {
    const buf = Buffer.alloc(4096);
    const fd = openSync(record, 'r');
    let read = 0;
    try { read = readSync(fd, buf, 0, buf.length, 0); } finally { closeSync(fd); }
    const nl = buf.subarray(0, read).indexOf(0x0a);
    if (nl < 0) return null;
    const head = JSON.parse(buf.subarray(0, nl).toString('utf8'));
    if (!isReadsRotationMarker(head)) return null;
    const at = head.carried_bytes;
    return typeof at === 'number' && Number.isFinite(at) && at >= 0 ? at : null;
  } catch {
    return null;
  }
}

/**
 * Claim the record, swap a fresh one in, and hand the old generation to
 * `ROTATED_READS_FILE`.
 *
 * A SECOND rotation, never a generalization of `rotateTrace` (D-01). That
 * function is bound to the trace at four levels - its three path helpers, its
 * re-stat trigger, the carry policy in `freshRecord` and the bound inside it -
 * and fourteen rotation rows in `trace.test.mjs` are the proof it did not
 * change. What is reused here is the TECHNIQUE, restated: the accepted cost is
 * that a copy can drift from the trace's claim semantics on the next fix to
 * either one.
 *
 * NO LOCK (D-05). `withPlanningFileLock` is refused for the reason
 * `lib/trace.mjs:626-631` refuses it and for a stronger one this record has:
 * `bin/read-trace.mjs` may emit nothing on any stream and exits 0
 * unconditionally, so a lock refusal would have no path to be reported on. The
 * concurrency is cross-PROCESS and ordinary rather than theoretical -
 * `hooks/hooks.json:17` matches five tools and one OS process runs per tool
 * call, so parallel subagents are concurrent `appendRead` processes (D-07).
 *
 * THE CLAIM IS `linkSync`, NOT `renameSync`. A rename REPLACES its destination
 * silently, so a writer still holding a stale stat would destroy a generation
 * another writer had already made and exactly one sibling would still exist, so
 * a count-based check would call that healthy. `linkSync` fails `EEXIST`
 * instead, which is atomic, single-winner, and REFUSES the claim rather than
 * detecting the damage after the fact (`lib/trace.mjs:633-641`).
 *
 * NEVER A READ-MODIFY-WRITE. The old generation is produced by the claim
 * itself and the fresh record is written WHOLE to a private path and renamed
 * into place, so the live path is never absent and no concurrent append is
 * trimmed away by a rewrite it did not see (`lib/trace.mjs:642-650`).
 *
 * NO CARRY-BACK, deliberately, where `lib/trace.mjs:884-909` has one. The bar
 * is every record present ACROSS THE PAIR, and a record a loser appended into
 * the sibling during the claim window already satisfies it; copying those bytes
 * back would also put a previous generation's reads into a record D-02 says
 * starts with the marker and nothing else. So a losing writer's record can be
 * in the sibling, which is where this differs from the trace's assertion that
 * every racing writer's event is in the LIVE record.
 *
 * EXACTLY ONE PRIOR GENERATION is the entire retention policy. No dated
 * generations, no keep-N, no config key: the pair on disk is the bound, and a
 * second rotation evicts what the first one left.
 *
 * THE MARKER SEALS THE GENERATION. Its `carried_bytes` is the size the live
 * record had at the instant this call claimed it, so a later writer can tell
 * which of the generation's bytes this cut accounted for. Its only consumer is
 * the leftover-generation eviction below, which is the last moment the bytes
 * past that offset can be carried anywhere.
 *
 * NOTHING CROSSES THE CUT (D-02), with ONE stated exception. The fresh record
 * is one line - the marker - and there is no `freshRecord` analogue and no
 * run-in-flight tail, because nothing scans this record backwards:
 * `readReadsRecords` reads it whole and `joinReads` joins by timestamp
 * containment against the TRACE's brackets. The trace carries a tail only
 * because `correlationId` scans backward for its anchor. The exception is the
 * rescue at the EVICTION of a leftover generation, below: bytes the earlier
 * cut's seal shows no rotation ever accounted for, carried at the last moment
 * they exist. It never runs on the ordinary rotation path.
 *
 * @param {string} planningRoot
 * @param {number} reserve the pending line's byte length, what the fresh record
 *   owes beyond the marker
 * EXPORTED for the reason `rotateTrace` is (`lib/trace.mjs:651-655`): the
 * losing arms cannot be reached through `appendRead`, which re-stats the record
 * and so can never be made to arrive here holding a stale one. Nothing but
 * `appendRead` and the tests may call it.
 * @returns {{rotated: boolean, reason?: string, shortfall?: number|null}}
 *   `reason` ONLY where the rotation failed outright; losing the claim is
 *   `{rotated:false}` and the caller appends, because somebody else already
 *   made room. `shortfall` rides a rotation that DID rotate and states the
 *   bytes of the destroyed generation its rescue could not carry - a number, or
 *   `null` where even their count could not be established. Absent means the
 *   tail is complete.
 */
export function rotateReads(planningRoot, reserve) {
  const file = readsPath(planningRoot);
  const sibling = rotatedReadsPath(planningRoot);
  const priv = `${process.pid}.${Math.random().toString(36).slice(2)}`;
  const claim = readsClaimPath(planningRoot);
  /** @type {string|null} */
  let temp = null;
  /** @type {string|null} */
  let evicted = null;
  // The evicted path, but ONLY where what was evicted is a leftover GENERATION.
  // That is the one eviction with bytes worth rescuing, and it has to be told
  // apart from the abandoned-claim eviction: there the evicted path is a second
  // name for the LIVE inode, so a rescue reading it would re-append the live
  // record to itself at an offset that seals some other generation entirely.
  /** @type {string|null} */
  let leftover = null;
  /** @type {string|null} */
  let dated = null;
  // The `mtime` THIS process stamped on the sidecar, so the confirm below can
  // tell its own write apart from a refresh some other claimant made.
  /** @type {number|null} */
  let mine = null;
  // The claim is HELD from the link until the swap. While it is held the
  // sibling is only a second name for the live file, so every failure arm has
  // to release it - a claim left behind reads as a rotation in flight forever
  // and the record never rotates again.
  let held = false;
  // The stamp this process wrote, at its PRIVATE path, until the link says it
  // owns the claim the stamp dates. Cleared once it is renamed into place.
  /** @type {string|null} */
  let pending = null;
  // The size of the live record at the instant this call claimed it - the
  // number the marker publishes as `carried_bytes`. `null` where the stat
  // could not be taken, which seals nothing rather than guessing.
  /** @type {number|null} */
  let sealed = null;
  /**
   * Move the private stamp onto the shared sidecar path. Called only from the
   * two arms that have established the claim is this process's to date, and
   * `mine` is what the confirm below tells its own publish apart by.
   */
  const publish = () => {
    if (!pending) return;
    try { renameSync(pending, claim); dated = claim; mine = statSync(claim).mtimeMs; }
    catch { mine = null; /* fail live: an undated claim reads as live */ }
    pending = null;
  };
  try {
    let claimed = false;
    // TWO attempts, never a loop: claim, or evict one leftover generation (or
    // one abandoned claim) and claim once more.
    for (let attempt = 0; attempt < 2 && !claimed; attempt++) {
      // READ THE AGE BEFORE PUBLISHING A NEW STAMP. Every publish below
      // overwrites the only evidence a killed claimant left, so an age read
      // after one is this process's own and the reclaim could never fire.
      // Declared out here because the `catch` arm is what consults it.
      let wasStale = false;
      try {
        wasStale = readsClaimAbandoned(claim);
        // STAMP PRIVATE, PUBLISH ONLY WHERE THE CLAIM IS THIS PROCESS'S. The
        // stamp has to exist before the `linkSync`, because the window it
        // closes is the other way round: a stamp written after the link leaves
        // the claim HELD beside the aged file a previous run left, and a third
        // process reading that age concludes ABANDONED and evicts a LIVE claim.
        //
        // But writing it straight to `claim` writes a path this process does
        // not own yet, and then every append that LOSES the link has refreshed
        // somebody else's claim: on a record appended far more often than
        // `READS_CLAIM_STALE_MS` - one process per tool call, D-07 - that
        // restarts the staleness clock on every append and the abandoned claim
        // never ages into a reclaim at all. Having the loser put back what it
        // overwrote is not the remedy either: that is a check-then-write on a
        // shared path, so a writer taking the claim between the check and the
        // rewrite gets its FRESH stamp rewound to the dead claim's age and
        // reads as abandoned while it is live, which costs the record rather
        // than one rotation.
        //
        // A PLAIN overwrite, never `{flag:'wx'}`: the retry that follows an
        // eviction comes back through here with the same `priv`, so an
        // exclusive create would throw on this process's own leftover and turn
        // the reclaim into a failed rotation. A failed sidecar write is
        // SWALLOWED rather than allowed to decide the rotation - no sidecar
        // reads as LIVE.
        pending = `${claim}.${priv}`;
        try { writeFileSync(pending, `${new Date().toISOString()}\n`); }
        catch { pending = null; /* fail live: no sidecar reads as a live claim */ }
        // SEAL THE GENERATION HERE, BEFORE THE LINK, and never after it.
        // Linking does not freeze the inode: the live path still names it until
        // the swap, so a writer appending in the window between the link and a
        // later stat would have its bytes folded into `carried_bytes` - and the
        // eviction below reads that number as already accounted for and never
        // rescues them, which is the exact loss the seal exists to close.
        // Sealing early can only make that rescue window LARGER, and the widest
        // it can be is the bytes appended between this line and the eviction,
        // every one of which is a byte no cut ever accounted for.
        try { sealed = statSync(file).size; } catch { sealed = null; }
        linkSync(file, sibling);
        claimed = true;
        held = true;
        // THE CLAIM IS OURS - publish the stamp that dates it. One atomic
        // rename, and the only window it leaves is between the link and this
        // line, where the sidecar is still the aged one a dead claimant left.
        // The eviction arm's own confirm closes that.
        publish();
      } catch (e) {
        const code = e && /** @type {any} */ (e).code;
        // No record to rotate at all: the caller's append is what creates it.
        if (code === 'ENOENT') return { rotated: false };
        if (code !== 'EEXIST') return { rotated: false, reason: code || 'claim-failed' };
        // A sibling already sits at that path, and `EEXIST` alone cannot say
        // which of the two causes put it there.
        let abandoned = false;
        if (attempt > 0 || readsRotationInFlight(file, sibling)) {
          // UNLESS THE CLAIM WAS ABANDONED. A claimant killed or timed out
          // mid-rotation never runs its `finally`, so the claim stands forever:
          // the record never write-deads, but the bound it promises is gone and
          // every append pays the full wait budget - the state v3.7.4 phase 4's
          // UAT recorded for the trace. Shortening the budget is not the
          // remedy: the trigger is re-read from the record's size on every
          // call, so only a COMPLETED rotation ends the state. The sidecar's
          // age is consulted ONLY here, where the sibling is the same inode;
          // where it is a different one it is a leftover generation, and that
          // reading is CONFIRMED after the eviction rather than trusted, because
          // this line is read before the rename and a writer can link in between.
          abandoned = attempt === 0 && wasStale;
          if (!abandoned) {
          // A rotation is genuinely IN FLIGHT and this process lost the claim.
          // It must NOT hand the caller straight back to its append: while the
          // claim is held the live PATH still names the old inode, so the
          // record would land in the file about to become the sibling rather
          // than in the record. WAIT for the swap by polling the inode
          // identity, stop the moment it changes, and report that this process
          // did not rotate so the caller appends into whatever the winner left.
          //
          // Not a lock (D-05). `withPlanningFileLock` is refused for the reason
          // `lib/trace.mjs:626-631` refuses it and for a stronger one here:
          // `bin/read-trace.mjs:10-16` may emit nothing on any stream and exits
          // 0 unconditionally, so a lock refusal would have no path to be
          // reported on.
            for (
              let waited = 0;
              waited < READS_ROTATE_WAIT_MS && readsRotationInFlight(file, sibling);
              waited++
            ) {
              sleep(1);
            }
            return { rotated: false };
          }
        }
        // A generation an earlier rotation left, and evicting it is the one
        // DESTRUCTIVE act on this path - so RE-STAT first and never rotate a
        // record this writer did not observe over the trigger. The interleaving
        // that makes this load-bearing: another writer rotated while this one
        // was still holding the stat that sent it here, and carrying that fresh
        // file away would destroy the generation the other writer just made and
        // leave the record with nothing in it. `EEXIST` cannot see that case -
        // the sibling exists either way - and a check afterwards is too late,
        // so the claim is REFUSED rather than the damage detected
        // (`lib/trace.mjs:812-825`).
        let now = null;
        try { now = statSync(file).size; } catch { return { rotated: false }; }
        if (now + reserve < MAX_READS_BYTES) return { rotated: false };
        // PUBLISH THE STAMP HERE, and on no other losing arm. Either the
        // sibling is a leftover generation and no claim is held at all, or the
        // sidecar read ABANDONED and this process is about to evict the claim
        // it dates - the one thing every other loser has not established. It
        // also has to happen BEFORE the eviction, because the confirm below
        // tells a second reclaimer's publish from this one's by the mtime this
        // line leaves.
        publish();
        // Evict SINGLE-WINNER, the way `lib/capture-file.mjs` breaks a stale
        // lock: exactly one contender renames it to a private path and the
        // losers get `ENOENT`. The `finally` drops that private path.
        const path = join(planningRoot, `${READS_EVICT_TEMP_FILE}.${priv}`);
        try { renameSync(sibling, path); } catch { return { rotated: false }; }
        evicted = path;
        if (!abandoned) leftover = path;
        // CONFIRM AFTER CLAIMING, on BOTH eviction arms, before anything is read
        // or written. The rename above may have taken the sibling from a
        // claimant that arrived between the discriminator and here: a second
        // writer links, stamps its own fresh sidecar, and the mtime is no longer
        // the one this process wrote. Breaking THAT claim is not a deferred
        // rotation, it is the whole record.
        //
        // THE LEFTOVER ARM GETS IT TOO (D-02), where it used to be excluded on
        // the grounds that its own discriminator already answered. It does not:
        // `readsRotationInFlight(file, sibling)` is read at the top of this
        // catch, BEFORE the eviction rename below, so a writer that linked in
        // between has a live claim that reads as a leftover generation here and
        // is renamed away with no confirm to put it back. The window is small
        // and the cost is the whole record, which is the trade the abandoned arm
        // already refused to take.
        //
        // `mine === null` counts as unconfirmed: a `publish` that could not date
        // the sidecar cannot prove the claim is this process's, and the fail-live
        // reading everywhere else is what this branch is being consistent with.
        // Put the sibling back only where nothing has taken the path meanwhile -
        // a plain rename back would clobber a claim a fourth writer legitimately
        // holds - and either way CLEAR `evicted` so the release cannot delete a
        // claim that was just restored.
        let refreshed = false;
        try { refreshed = mine === null || statSync(claim).mtimeMs !== mine; } catch { refreshed = true; }
        if (refreshed) {
          try {
            if (!existsSync(sibling)) renameSync(path, sibling);
            else unlinkSync(path);
          } catch { /* it vanished under us - there is nothing left to restore */ }
          evicted = null;
          return { rotated: false };
        }
      }
    }
    if (!claimed) return { rotated: false };
    // The fresh record is written whole to a PRIVATE path - this process's pid
    // and a random suffix, exclusive-create - and renamed over the live path.
    temp = join(planningRoot, `${READS_ROTATE_TEMP_FILE}.${priv}`);
    writeFileSync(temp, readsRotationMarker(sealed), { flag: 'wx' });
    renameSync(temp, file);
    temp = null;
    held = false;

    // THE SECOND WINDOW, closed - and the ONE thing that ever crosses the cut
    // (D-05). The loss is a TWO-STEP. This record has no carry-back by design,
    // so a writer that appended into the old inode while an earlier cut held its
    // claim has its bytes ONLY in the generation - which the "present across the
    // pair" bar accepts. Then a second rotation evicts that generation and the
    // `finally` below unlinks it: the record is in NEITHER file, and nothing
    // ever said so. So the writer about to DESTROY a leftover generation
    // finishes the carry the earlier cut never made, here, at the last moment it
    // can - after the swap, into the live path, whole lines only.
    //
    // This does NOT contradict "nothing crosses the cut" above. The ordinary
    // rotation path still writes the marker and nothing else; this arm runs only
    // at an eviction, and only over bytes no cut ever accounted for.
    //
    // WHERE IT STARTS FROM. `sibling` is now the record this cut carried away,
    // which is the record the earlier cut wrote, so its FIRST line is that cut's
    // own marker and `carried_bytes` is the size it sealed the generation at.
    // Reading the head is what keeps this off an 8 MB read on the rotation path.
    //
    // NO SEAL, NO RESCUE - BUT NOT NO ANSWER. A generation left by the code that
    // shipped before this field carries no `carried_bytes`, and no offset can be
    // guessed for it: the choices are failing closed at the cost of one old
    // record, or re-appending a whole generation into a file readers actually
    // read. It fails closed, and states `shortfall: null` on the way out - the
    // same "cut by an unknown amount" the failed-stat arm reports, because a
    // generation destroyed with no field at all is exactly the silence the
    // paragraph below refuses.
    //
    // AND IT NEVER DECIDES WHETHER THE ROTATION ROTATED. `reason` appears only
    // where the rotation failed outright, and a failed rescue is not that. But
    // it must not be SILENT either - a tail that cannot be completed has to be
    // STATED, or the record is short by an amount no reader can learn. Every
    // failure arm - the stat, the read, the line split, the append - reports
    // `shortfall`: the bytes past the sealed offset this call did not carry,
    // taken from the stat rather than from what was read, because a read that
    // threw established no count at all. Where even the stat fails, `shortfall`
    // is `null` - the tail was cut by an unknown amount, which is still an
    // answer. A caller that ignores the field behaves exactly as it did before.
    /** @type {number|null|undefined} */
    let shortfall;
    if (leftover) {
      const at = sealOf(sibling);
      if (at !== null) {
        /** @type {number|null} */
        let beyond = null;
        try { beyond = Math.max(0, statSync(leftover).size - at); } catch { beyond = null; }
        if (beyond === null) shortfall = null;
        else if (beyond > 0) {
          let done = false;
          try {
            const buf = Buffer.alloc(beyond);
            const fd = openSync(leftover, 'r');
            let read = 0;
            try { read = readSync(fd, buf, 0, buf.length, at); } finally { closeSync(fd); }
            const delta = buf.subarray(0, read);
            // WHOLE LINES ONLY, so a torn tail is dropped rather than appended
            // as a half-record the reader would have to skip.
            const cut = delta.lastIndexOf(0x0a);
            if (cut >= 0) {
              appendFileSync(file, delta.subarray(0, cut + 1));
              done = true;
            }
          } catch { /* stated on `shortfall`, never thrown and never a `reason` */ }
          if (!done) shortfall = beyond;
        }
      } else shortfall = null;
    }
    // Where the rescued lines leave the live record over `MAX_READS_BYTES` they
    // are carried anyway: refusing here would lose them for good, and the next
    // append rotates.
    return shortfall === undefined ? { rotated: true } : { rotated: true, shortfall };
  } catch (e) {
    return { rotated: false, reason: (e && /** @type {any} */ (e).code) || 'rotate-failed' };
  } finally {
    // Leave nothing behind on ANY arm: no private temp, no private stamp, no
    // unfinished claim, no evicted generation.
    if (temp) { try { unlinkSync(temp); } catch { /* nothing to clean up */ } }
    if (held) { try { unlinkSync(sibling); } catch { /* nothing to release */ } }
    // GUARDED BY `held`, never unconditional. A claimant may delete only a
    // sidecar it still owns: `held` goes false at the swap, so an unconditional
    // unlink here would delete the FRESH sidecar of a process that took the
    // claim legitimately in that window, leaving a standing claim with no
    // sidecar - which reads as LIVE forever and defeats the reclaim
    // permanently and silently (`lib/trace.mjs:912-932`).
    //
    // The consequence is deliberate: a rotation that COMPLETES leaves its
    // sidecar behind. That residue is INERT - once the swap has happened the
    // sibling is a separate inode, `readsRotationInFlight` is false, nothing
    // reads the sidecar, and the next claimant overwrites it before it links.
    if (held && dated) { try { unlinkSync(dated); } catch { /* nothing to release */ } }
    // A stamp this call never published dates nothing and belongs to nobody
    // else - it is at a path carrying `priv`, so no other process can see it.
    // Dropping it UNCONDITIONALLY is what keeps a losing append from touching
    // the shared sidecar at all. Every arm that DID publish cleared `pending`.
    if (pending) { try { unlinkSync(pending); } catch { /* nothing to clean up */ } }
    if (evicted) { try { unlinkSync(evicted); } catch { /* nothing to clean up */ } }
  }
}

/**
 * Append one record. Mirrors lib/trace.mjs's guarded append: lstat for a
 * planted symlink ahead of the size stat, the bound enforced BEFORE the write
 * because an append-only file has no whole-file rewrite to trim from, and a
 * reason returned rather than thrown on every failure.
 *
 * The SIZE bound is not a refusal. At `MAX_READS_BYTES` the record rotates and
 * this append lands, so no writer is ever again told the record is full; the
 * two remaining size answers are `oversized-record`, for a single line that
 * reaches the bound by itself, and whatever code a rotation that could not
 * complete failed with.
 * @param {string} planningRoot
 * @param {any} record
 */
export function appendRead(planningRoot, record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { written: false, reason: 'bad-record' };
  }
  const file = readsPath(planningRoot);
  // The symlink guard stays FIRST and unchanged, so a redirected record is
  // refused whatever its size.
  try {
    if (lstatSync(file).isSymbolicLink()) return { written: false, reason: 'symlinked-reads' };
  } catch { /* ENOENT is the ordinary first write */ }
  // RENDERED AHEAD of the size arm, which is a reordering and not a
  // rearrangement: the arm now needs this line's own byte length, because it
  // fires when the record PLUS this line would reach the bound rather than when
  // the record is already at it. The old post-hoc arm admitted one last record
  // that carried the file past the bound.
  let line;
  try {
    line = `${JSON.stringify(record)}\n`;
  } catch (e) {
    return { written: false, reason: 'unserializable-record' };
  }
  const pending = Buffer.byteLength(line);
  // THE BOUND, no longer a refusal. A record at the bound used to answer
  // `{written:false}` with a full-record reason to every writer for the rest of
  // the project's life - permanent, silent write-death that went four cycles
  // unnoticed because `appendRead`'s return reaches no user-facing surface
  // (D-12). It ROTATES instead: the old generation becomes
  // `ROTATED_READS_FILE` and this append lands.
  //
  // An absent file is the ordinary first write; any other stat failure is the
  // reason this append did not happen.
  let size = null;
  try {
    size = statSync(file).size;
  } catch (e) {
    const code = e && /** @type {any} */ (e).code;
    if (code !== 'ENOENT') return { written: false, reason: code || 'stat-failed' };
  }
  if (size !== null && size + pending >= MAX_READS_BYTES) {
    // A single line that reaches the bound on its own is REFUSED rather than
    // rotated. Rotating there throws the record away to make room for a line
    // that still would not fit, and the next append does it again
    // (`lib/trace.mjs:1014-1019`).
    // THE MARKER IS RESERVED, not just the pending line. A rotation always
    // writes its marker into the fresh record too, so a record that fits under
    // the bound by itself but not BESIDE the marker used to rotate and then land
    // a file over its bound on the very first write (measured 2026-08-30: 74 B
    // over, against an 82-byte marker). Reserving it DELIBERATELY moves a narrow
    // band of record sizes - between `MAX_READS_BYTES - READS_MARKER_BYTES` and
    // `MAX_READS_BYTES` - from "rotate and land" into the refusal below (D-09).
    // That is the intended change, not a regression: those records cannot be
    // written under the bound either way.
    if (pending + READS_MARKER_BYTES >= MAX_READS_BYTES) {
      return { written: false, reason: 'oversized-record' };
    }
    const rot = rotateReads(planningRoot, pending);
    // Losing the claim is not a failure: somebody else already made the room,
    // and this writer appends into the record they left. Only a rotation that
    // FAILED carries a reason, and it is reported rather than appended past.
    if (rot.reason) return { written: false, reason: rot.reason };
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

/**
 * The agent types the HOST owns rather than Cadence. They have no dispatch
 * event in `trace.jsonl` and never will - nothing in this plugin opens a
 * bracket for them - so their reads are a permanent, statable FLOOR on what the
 * join can attribute (32% of subagent reads, measured 2026-08-14), never a gap
 * to close.
 */
export const HOST_AGENT_TYPES = ['fork', 'general-purpose'];

/** Every rung file's stem, mapped back to the role whose rung it is. */
const ROLE_OF_STEM = new Map(
  Object.keys(RUNG_FILES).flatMap(
    (role) => Object.values(RUNG_FILES[role]).map((stem) => [stem, role]),
  ),
);

/**
 * The same 30 stems, mapped back to the RUNG each one is filed under. Built off
 * the SAME import in the same shape as `ROLE_OF_STEM`, because the two answers
 * are two columns of one table: a rung added to `RUNG_FILES` reaches both maps
 * or neither, and neither can go stale while the other does not.
 */
const RUNG_OF_STEM = new Map(
  Object.keys(RUNG_FILES).flatMap(
    (role) => Object.entries(RUNG_FILES[role]).map(([rung, stem]) => [stem, rung]),
  ),
);

/**
 * The agent-file stem inside a recorded `agent` value - the host writes
 * `<plugin>:<agent-file-stem>` and a bare stem is accepted as itself.
 *
 * ONE copy of the split, called by both readers below. A second copy is how the
 * role answer and the rung answer start disagreeing about which file a spelling
 * names, and `helper-census.test.mjs` matches shared-contract BODY idioms
 * precisely so a paste-back under another name is caught rather than noticed.
 * @param {any} agent
 * @returns {string|null} null for anything that is not a non-empty string.
 */
function stemOfAgent(agent) {
  if (typeof agent !== 'string' || !agent) return null;
  return agent.includes(':') ? agent.slice(agent.indexOf(':') + 1) : agent;
}

/**
 * The role a recorded `agent` value names, or null when it names none.
 *
 * The corpus carries `cadence:cad-executor`, `cadence:cad-planner`,
 * `cadence:cad-verifier-medium` and `cadence:cad-assumptions-analyzer-high` -
 * the host's `<plugin>:<agent-file-stem>` spelling - while a dispatch event
 * carries the bare ROLE. Null for anything else, including the host types and
 * `coordinator`, so the caller decides what each absence means rather than
 * having one of them silently become a role.
 *
 * EXPORTED for `lib/subagent-trace.mjs`, whose `SubagentStop` self-filter asks
 * the same question of the same spelling. It imports this rather than holding a
 * copy: two readers of one record deriving the role independently is how they
 * start disagreeing about which bracket closed.
 * @param {any} agent
 * @returns {string|null}
 */
export function roleOfAgent(agent) {
  const stem = stemOfAgent(agent);
  if (stem === null) return null;
  return ROLE_OF_STEM.get(stem) || null;
}

/**
 * The RUNG a recorded `agent` value names, or null when it names none.
 *
 * The sibling of `roleOfAgent` over the same spelling and the same table:
 * `cadence:cad-verifier-medium` is the `cad-verifier` role at its `medium`
 * rung, so the two functions answer the two halves of one lookup. Null for
 * anything `RUNG_FILES` does not file - the host's own types, `coordinator`, a
 * non-string - so the caller decides what the absence means.
 *
 * NEVER derived from a `-<rung>` filename suffix, for the reason this file's
 * `RUNG_FILES` import already states: `cad-assumptions-analyzer` is that role's
 * `xhigh` rung while `cad-assumptions-analyzer-high` is its lower one, so no
 * suffix convention is true of all 30 files and a suffix rule would report the
 * wrong rung for the unsuffixed file of every role.
 *
 * EXPORTED for `lib/subagent-trace.mjs`, whose `SubagentStop` close records the
 * rung a worker was DISPATCHED under beside the effort its own transcript says
 * it RAN at - the pair the run record exists to let a reader compare.
 * @param {any} agent
 * @returns {string|null}
 */
export function rungOfAgent(agent) {
  const stem = stemOfAgent(agent);
  if (stem === null) return null;
  return RUNG_OF_STEM.get(stem) || null;
}

/**
 * Join `reads.jsonl` records to the `trace.jsonl` dispatch brackets that caused
 * them, by READ-TIME inference: normalize the record's `agent` to a role, then
 * test its timestamp for containment inside a closed bracket of that role.
 *
 * Why not a corr stamped at hook time (D-10). A hook-time stamp gives a read
 * running INSIDE a subagent the coordinator's current corr, which makes the
 * join confidently wrong rather than honestly absent - against a hook whose
 * stated contract (this file's header) is that it never disturbs normal work.
 * Repairing at read time with the writer untouched is the same posture the
 * trace's own pre-anchor repair takes.
 *
 * Why ambiguity is reported rather than resolved (D-11). Same-role brackets
 * genuinely overlap on the parallel execute path: measured over all 100 closed
 * brackets in this repo's record there are 2 overlapping same-role pairs, both
 * `cad-executor` - which is also the largest subagent share of the corpus at
 * 440 records. Picking one would therefore be wrong exactly on the
 * highest-cost path, so a record inside more than one bracket of its role
 * reports AMBIGUOUS and joins to none. `lib/trace.mjs` keys its own pairing on
 * `(corr, phase, plan)` for this same reason.
 *
 * Nothing here defaults an absent field. A record with no `agent` is reported
 * with `agent: null` rather than as a coordinator read, and its `agent_id` the
 * same way: the host guarantees neither field across subagent kinds and
 * versions, and this file's `tool_response` comment already takes that posture.
 *
 * Pure by INJECTION, the way `filesOf` is: the caller supplies the bracket rows
 * (`renderTrace(...).brackets`), and this does no I/O of its own.
 *
 * @param {any[]} records the parsed `reads.jsonl` lines
 * @param {any[]} brackets paired dispatch rows, each `{role, ts, end, ...}`
 */
export function joinReads(records, brackets) {
  /** @type {{role: string, a: number, b: number, row: any}[]} */
  const spans = [];
  for (const b of Array.isArray(brackets) ? brackets : []) {
    if (!b || typeof b !== 'object') continue;
    const role = typeof b.role === 'string' ? b.role : '';
    const a = Date.parse(b.ts);
    const z = Date.parse(b.end);
    // A bracket whose either end is unreadable can contain nothing: it is
    // dropped rather than widened to infinity, which would swallow every read
    // of that role into one confident answer.
    if (!role || !Number.isFinite(a) || !Number.isFinite(z)) continue;
    spans.push({ role, a, b: z, row: b });
  }

  const counts = { joined: 0, ambiguous: 0, unjoined: 0, floor: 0, coordinator: 0, unresolved: 0 };
  /** @type {{ts: any, agent: string|null, agent_id: string|null, role: string|null, status: string, bracket: any, files: string[]}[]} */
  const rows = [];

  for (const r of Array.isArray(records) ? records : []) {
    if (!r || typeof r !== 'object') continue;
    const agent = typeof r.agent === 'string' && r.agent ? r.agent : null;
    const agentId = typeof r.agent_id === 'string' && r.agent_id ? r.agent_id : null;
    // The record's own `files` rides the ROW, normalized once here. The
    // in-dispatch fold below needs both halves - which bracket contained the
    // read, and which paths it opened - and the only two other ways to pair
    // them are worse: re-implementing the containment test in the fold is a
    // second statement of the join, and zipping `rows` to `records` by array
    // position is green today and silently wrong the first time either side
    // filters a record the other keeps (this function already drops a
    // non-object record without pushing a row).
    const files = Array.isArray(r.files)
      ? r.files.filter((f) => typeof f === 'string' && f)
      : [];
    /** @param {string} status @param {any} [bracket] */
    const push = (status, bracket = null) => {
      counts[status]++;
      rows.push({ ts: r.ts ?? null, agent, agent_id: agentId, role: roleOfAgent(agent), status, bracket, files });
    };

    if (agent === null) { push('unresolved'); continue; }
    if (agent === 'coordinator') { push('coordinator'); continue; }
    if (HOST_AGENT_TYPES.includes(agent)) { push('floor'); continue; }
    const role = roleOfAgent(agent);
    // `unknown-agent` lands here: the writer uses it when a call carried an
    // `agent_id` and no `agent_type`, so the read IS a subagent's and its role
    // is simply not knowable. Reporting it unjoined would read as "no bracket
    // contained it", which was never tested.
    if (role === null) { push('unresolved'); continue; }

    const t = Date.parse(r.ts);
    if (!Number.isFinite(t)) { push('unresolved'); continue; }
    const hits = spans.filter((s) => s.role === role && t >= s.a && t <= s.b);
    if (hits.length === 1) push('joined', hits[0].row);
    else if (hits.length > 1) push('ambiguous');
    else push('unjoined');
  }

  return { ...counts, rows };
}

/**
 * Per-ROLE IN-DISPATCH file figures, folded off the rows `joinReads` returned.
 *
 * The arithmetic is `.planning/spikes/read-set-redundancy/SPIKE.md`'s corrected
 * pass, and the correction is the whole point. Group every `joined` row by the
 * ONE bracket it joined to, count how many times each path was touched inside
 * that bracket, then per role sum the touches over the SUM of the per-bracket
 * distinct counts. Summing distinct PER BRACKET is what makes the ratio
 * in-dispatch: one distinct-file count across a role's whole corpus measures
 * the opposite thing and cannot tell "re-read 20 times inside one dispatch"
 * from "read once in each of 20 dispatches", which is exactly the error
 * SPIKE.md records its first pass making. Only that second form says anything a
 * per-dispatch lever could act on.
 *
 * Distinct from `summarizeReads`'s `fileRedundancy`, deliberately, and both
 * stay: that one is whole-corpus over distinct FILES and every record on disk
 * is already read through it; this one is per role, per dispatch, and answers
 * whether one worker kept re-opening one file while it worked.
 *
 * TWO limits ride the return because the callers have to STATE them rather
 * than assume them (SPIKE.md's C1 and its scope-limit recommendation):
 *   - `coverage` - the share of the joined reads in scope that carried a
 *     `files` array at all, which is the denominator the ratio was really
 *     computed over. Every record written before `files` existed carries none,
 *     so a corpus at 0.62 is normal rather than broken, and a figure printed
 *     without its coverage reads as a total.
 *   - `coordinatorFiles` - file-carrying reads on the main thread. Those have
 *     no dispatch bracket BY CONSTRUCTION, so the coordinator's own re-reading
 *     is outside anything this figure can measure or cut. Stated, never
 *     discovered.
 *
 * A `null` ratio and never a `0`: no summed distinct is no measurement, the
 * same posture `summarizeReads` states for both of its own ratios. Rounded
 * through `Number(x.toFixed(2))` so all three print alike.
 *
 * Pure, and does no I/O: the caller supplies the rows, the way it already
 * supplies `joinReads`'s records and brackets.
 *
 * @param {any[]} rows `joinReads(...).rows`
 * @returns {{roles: {role: string, brackets: number, touches: number,
 *            distinct: number, ratio: number|null,
 *            worst: {path: string, count: number, phase: any, plan: any}|null}[],
 *           joined: number, fileCarrying: number, coverage: number|null,
 *           coordinatorFiles: number}}
 */
export function inDispatchReads(rows) {
  // Keyed on the bracket OBJECT `joinReads` handed back, which is the caller's
  // own row: two dispatches are two objects, and no key grammar has to be
  // invented to tell them apart.
  /** @type {Map<any, {role: string, bracket: any, files: Map<string, number>}>} */
  const perBracket = new Map();
  /** @type {Map<string, any>} */
  const byRole = new Map();
  let joined = 0;
  let fileCarrying = 0;
  let coordinatorFiles = 0;

  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row || typeof row !== 'object') continue;
    const files = Array.isArray(row.files) ? row.files : [];
    if (row.status === 'coordinator') {
      if (files.length) coordinatorFiles++;
      continue;
    }
    // Anything that did not join contributes to nothing at all - not to the
    // ratio and not to its coverage. `ambiguous`, `floor`, `unjoined` and
    // `unresolved` all name a read this figure cannot attribute to a dispatch,
    // and counting them in the denominator would report a coverage the ratio
    // was never computed over.
    if (row.status !== 'joined' || !row.bracket) continue;
    joined++;
    if (files.length) fileCarrying++;
    const role = typeof row.role === 'string' && row.role ? row.role : null;
    if (!role) continue;
    // The role gets a row as soon as it has a joined read, BEFORE any file
    // question: a role that read all through a dispatch and recorded no path
    // has a ratio of `null` - no measurement - and dropping it here instead
    // would make that indistinguishable from a role that never ran.
    if (!byRole.has(role)) byRole.set(role, { role, brackets: 0, touches: 0, distinct: 0, worst: null });
    if (!files.length) continue;
    let cell = perBracket.get(row.bracket);
    if (!cell) {
      cell = { role, bracket: row.bracket, files: new Map() };
      perBracket.set(row.bracket, cell);
    }
    for (const f of files) cell.files.set(f, (cell.files.get(f) || 0) + 1);
  }

  for (const { role, bracket, files } of perBracket.values()) {
    if (!files.size) continue;
    const acc = byRole.get(role);
    if (!acc) continue;
    acc.brackets++;
    acc.distinct += files.size;
    for (const [path, count] of files) {
      acc.touches += count;
      // The worst SINGLE file/bracket pair, which is the suggestion's named
      // target: "read `<path>` N times" inside one dispatch is actionable
      // where a role-wide ratio is not. Ties keep the first seen, so the
      // answer is stable for a given input.
      if (!acc.worst || count > acc.worst.count) {
        acc.worst = { path, count, phase: bracket.phase ?? null, plan: bracket.plan ?? null };
      }
    }
  }

  const roles = [...byRole.values()]
    .map((a) => ({ ...a, ratio: a.distinct ? Number((a.touches / a.distinct).toFixed(2)) : null }))
    .sort((x, y) => (x.role < y.role ? -1 : x.role > y.role ? 1 : 0));

  return {
    roles,
    joined,
    fileCarrying,
    // Null rather than 0 over an empty scope, for the reason the ratio is: no
    // joined reads is no coverage measurement, not a coverage of nothing.
    coverage: joined ? Number((fileCarrying / joined).toFixed(2)) : null,
    coordinatorFiles,
  };
}
