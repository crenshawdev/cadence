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
  appendFileSync, linkSync, lstatSync, renameSync, statSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { join, resolve, sep, relative, isAbsolute } from 'node:path';
// The ONE statement of which agent FILE carries which rung of which role. The
// join below needs the reverse direction - a recorded `agent_type` stem back to
// the role a dispatch event names - and deriving it from a `-<rung>` suffix
// regex would be a SECOND statement of the mapping: `cad-assumptions-analyzer`
// is that role's `xhigh` rung while `cad-assumptions-analyzer-high` is its
// lower one, so no suffix convention is true of all 19 files, and a rung added
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
 * EXACTLY ONE PRIOR GENERATION is the entire retention policy. No dated
 * generations, no keep-N, no config key: the pair on disk is the bound, and a
 * second rotation evicts what the first one left.
 *
 * NOTHING CROSSES THE CUT (D-02). The fresh record is one line - the marker -
 * and there is no `freshRecord` analogue and no run-in-flight tail, because
 * nothing scans this record backwards: `readReadsRecords` reads it whole and
 * `joinReads` joins by timestamp containment against the TRACE's brackets. The
 * trace carries a tail only because `correlationId` scans backward for its
 * anchor.
 *
 * @param {string} planningRoot
 * @param {number} reserve the pending line's byte length, what the fresh record
 *   owes beyond the marker
 * EXPORTED for the reason `rotateTrace` is (`lib/trace.mjs:651-655`): the
 * losing arms cannot be reached through `appendRead`, which re-stats the record
 * and so can never be made to arrive here holding a stale one. Nothing but
 * `appendRead` and the tests may call it.
 * @returns {{rotated: boolean, reason?: string}} `reason` ONLY where the
 *   rotation failed outright; losing the claim is `{rotated:false}` and the
 *   caller appends, because somebody else already made room.
 */
export function rotateReads(planningRoot, reserve) {
  const file = readsPath(planningRoot);
  const sibling = rotatedReadsPath(planningRoot);
  const priv = `${process.pid}.${Math.random().toString(36).slice(2)}`;
  /** @type {string|null} */
  let temp = null;
  /** @type {string|null} */
  let evicted = null;
  // The claim is HELD from the link until the swap. While it is held the
  // sibling is only a second name for the live file, so every failure arm has
  // to release it - a claim left behind reads as a rotation in flight forever
  // and the record never rotates again.
  let held = false;
  try {
    let claimed = false;
    // TWO attempts, never a loop: claim, or evict one leftover generation and
    // claim once more.
    for (let attempt = 0; attempt < 2 && !claimed; attempt++) {
      try {
        linkSync(file, sibling);
        claimed = true;
        held = true;
      } catch (e) {
        const code = e && /** @type {any} */ (e).code;
        // No record to rotate at all: the caller's append is what creates it.
        if (code === 'ENOENT') return { rotated: false };
        if (code !== 'EEXIST') return { rotated: false, reason: code || 'claim-failed' };
        // A sibling already sits at that path, and `EEXIST` alone cannot say
        // which of the two causes put it there.
        if (attempt > 0 || readsRotationInFlight(file, sibling)) {
          // A rotation is genuinely IN FLIGHT and this process lost the claim.
          // Somebody else is making the room and this writer appends into what
          // they leave.
          return { rotated: false };
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
        // Evict SINGLE-WINNER, the way `lib/capture-file.mjs` breaks a stale
        // lock: exactly one contender renames it to a private path and the
        // losers get `ENOENT`. The `finally` drops that private path.
        const path = `${sibling}.evict.${priv}`;
        try { renameSync(sibling, path); } catch { return { rotated: false }; }
        evicted = path;
      }
    }
    if (!claimed) return { rotated: false };
    // The fresh record is written whole to a PRIVATE path - this process's pid
    // and a random suffix, exclusive-create - and renamed over the live path.
    temp = `${file}.rotate.${priv}`;
    const marker = {
      ts: new Date().toISOString(),
      event: READS_ROTATION,
      file: ROTATED_READS_FILE,
    };
    writeFileSync(temp, `${JSON.stringify(marker)}\n`, { flag: 'wx' });
    renameSync(temp, file);
    temp = null;
    held = false;
    return { rotated: true };
  } catch (e) {
    return { rotated: false, reason: (e && /** @type {any} */ (e).code) || 'rotate-failed' };
  } finally {
    // Leave nothing behind on ANY arm: no private temp, no unfinished claim,
    // no evicted generation.
    if (temp) { try { unlinkSync(temp); } catch { /* nothing to clean up */ } }
    if (held) { try { unlinkSync(sibling); } catch { /* nothing to release */ } }
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
    if (pending >= MAX_READS_BYTES) return { written: false, reason: 'oversized-record' };
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
  if (typeof agent !== 'string' || !agent) return null;
  const stem = agent.includes(':') ? agent.slice(agent.indexOf(':') + 1) : agent;
  return ROLE_OF_STEM.get(stem) || null;
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
