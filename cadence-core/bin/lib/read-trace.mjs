// @ts-check
// reads.jsonl writer: one line per tool call, so billing can see what a dispatch opened after it started.
// Its own file, not a trace.jsonl family: that file has one writer, a fixed set of families and a 1 MiB cap sized for tens of events.
// Paths only, never payloads. A Bash command or grep pattern can carry a secret and /cad-report reads this file back into a model's context, so Bash records argv[0] and Grep records its scope.
// With opts.root a path target is kept as given inside the project, becomes ${CLAUDE_PLUGIN_ROOT}/... inside the plugin and is the word `outside` anywhere else, so no home directory path reaches a report.
// Never throws and exits 0 at the seam: this runs after every tool call and a recorder that can fail one is worse than none.
'use strict';

import {
  appendFileSync, closeSync, existsSync, linkSync, lstatSync, openSync, readSync, renameSync,
  statSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { join, resolve, sep, relative, isAbsolute } from 'node:path';
import { homedir } from 'node:os';
// reverse lookups from an agent_type stem to its role sit beside RUNG_FILES
import { roleOfAgent, rungOfAgent } from './rung-agent.mjs';
import { sleep } from './text-util.mjs';

export const READS_FILE = 'reads.jsonl';

/** Bigger than MAX_TRACE_BYTES on purpose: one line per tool call would fill 1 MiB inside a phase and quietly stop recording. */
export const MAX_READS_BYTES = 8388608;

/** The tools whose calls are worth billing. Anything else is not a read. */
export const RECORDED_TOOLS = ['Read', 'Grep', 'Glob', 'Bash', 'NotebookRead'];

/** The longest error text a record may carry. A cause, never a payload. */
export const MAX_ERROR_TEXT = 200;

/** Past a dozen a Bash call is a sweep (a glob, a `for f in *`), and an unbounded array would bloat a file that has to stay cheap to append to. */
export const MAX_FILES_PER_CALL = 12;

/** @param {string} planningRoot */
export function readsPath(planningRoot) {
  return join(planningRoot, READS_FILE);
}

/** Spelled once so the writer, the .gitignore rule and the tests can't drift. It keeps the `reads.` prefix so a test filtering the planning root on it catches a leaked temp. */
export const ROTATED_READS_FILE = 'reads.1.jsonl';

/** Derived from ROTATED_READS_FILE so the two names can't come apart. */
export const READS_CLAIM_FILE = `${ROTATED_READS_FILE}.claim`;

/**
 * The writer's two private temp paths, derived from the names above. The finally clears both, so a reader only finds them if the process died mid-rotation, which the hook's 5 s timeout makes reachable.
 * The evict temp can then hold a whole generation. Each carries a pid and a random suffix, so the .gitignore rule for them can only be a pattern.
 */
export const READS_ROTATE_TEMP_FILE = `${READS_FILE}.rotate`;

/** @see READS_ROTATE_TEMP_FILE - the eviction half of the same pair. */
export const READS_EVICT_TEMP_FILE = `${ROTATED_READS_FILE}.evict`;

/** @param {string} planningRoot */
export function rotatedReadsPath(planningRoot) {
  return join(planningRoot, ROTATED_READS_FILE);
}

/** @param {string} planningRoot */
export function readsClaimPath(planningRoot) {
  return join(planningRoot, READS_CLAIM_FILE);
}

/** Same string as ROTATION in lib/trace.mjs, copied on purpose: this loads on every tool call and importing the trace for one constant costs too much. */
export const READS_ROTATION = 'record_rotated';

/**
 * Unlike the trace's, this marker isn't inert: summarizeReads bills every object and joinReads makes an `unresolved` row for any record with no agent, so an unfiltered marker shows up in /cad-report as a phantom read.
 * No `tool` is a safe second test because recordFromHook always writes a tool and never an `event`.
 * @param {any} record
 */
export function isReadsRotationMarker(record) {
  return !!record && typeof record === 'object' && !Array.isArray(record)
    && record.event === READS_ROTATION && !('tool' in record);
}

/**
 * The program of a command line, without its arguments: a flag value can carry a secret and a program name can't.
 * @param {string} cmd
 */
export function programOf(cmd) {
  const raw = String(cmd || '').trim();
  if (!raw) return null;
  // scan lines and stop at a heredoc opener, because the body is payload; the live hook once billed a token lifted out of one
  const lines = raw.split('\n');
  for (let i = 0; i < lines.length && i < 8; i++) {
    const line = lines[i];
    for (const seg of line.split(/&&|\|\||;|\|/)) {
      // drop a leading VAR=value so `FOO=bar git status` bills git and an inline secret is never what gets recorded
      const parts = seg.trim().split(/\s+/).filter((p) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(p));
      const head = parts[0];
      if (!head) continue;
      // skip a leading cd so `cd /a && rg foo` bills rg
      const prog = head.split('/').pop();
      if (!prog || prog === 'cd') continue;
      // a program is a short bare word; a quote, backtick, space or sigil means content, and content is refused
      return /^[A-Za-z0-9._+-]{1,64}$/.test(prog) ? prog : null;
    }
    // past the opener is body, so stop
    if (line.includes('<<')) break;
  }
  return null;
}


/**
 * The in-repo file paths a Bash command names, and nothing else.
 * programOf refuses arguments because a flag value can carry a secret, but that left `redundancy` counting how often a shell verb was typed instead of how often a file was re-opened.
 * Existence is the filter that gets paths without payload. A token has to:
 *   1. look like a path: no quote, sigil, backtick, glob or redirect, not VAR=value, not a -flag, and a `/` or `.` so shell keywords never qualify
 *   2. resolve inside the project root, so ~/.config/<service>/credentials can't be recorded even though it exists
 *   3. be an existing regular file
 * A secret value isn't a file in the repo, so it's dropped before anything is written.
 * Recorded relative to the root, so an absolute home path never lands in a record.
 * Pure by injection like `now` on recordFromHook: the caller passes the root and the existence check. With no opts it returns nothing.
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
  // relative tokens resolve against the call's cwd, since a session in a subdirectory writes `bin/x.mjs` and means a file the root alone wouldn't find
  const base = opts && typeof opts.cwd === 'string' && opts.cwd ? opts.cwd : root;

  /** @type {string[]} */
  const out = [];
  const seen = new Set();
  const lines = raw.split('\n');
  // same heredoc bound as programOf: past the opener is body, and a body is payload
  for (let i = 0; i < lines.length && i < 8; i++) {
    const line = lines[i];
    for (const tok of line.split(/\s+/)) {
      if (out.length >= MAX_FILES_PER_CALL) return out;
      if (!tok) continue;
      // quoted, expanded, globbed, redirected or substituted means content, not a path
      if (!/^[A-Za-z0-9._\/@+-]{1,256}$/.test(tok)) continue;
      if (tok.startsWith('-')) continue;          // a flag, not its value
      if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(tok)) continue; // inline assignment
      if (!tok.includes('/') && !tok.includes('.')) continue; // bare shell word
      let abs;
      try {
        abs = isAbsolute(tok) ? resolve(tok) : resolve(base, tok);
      } catch { continue; }
      // confine before the stat so a path outside the project is never probed
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
 * Shape a PostToolUse hook payload into one record, or null when the call isn't a read.
 * @param {any} input the parsed hook JSON
 * @param {string} [now] ISO timestamp, injectable for tests
 * @param {{root?: string, cwd?: string, isFile?: (p: string) => boolean, pluginRoot?: string}} [opts]
 *   root and isFile feed filesOf and pluginRoot tells a plugin file from any other outside path; omit them and no `files` is added and no target is reclassified.
 */
/**
 * Whether a `tool_response` reports failure, or null when it doesn't say.
 * Both keys are read, `isError` from the MCP wire shape and `is_error` from the host's hooks; neither is documented for PostToolUse, so a missing key gives null instead of a guess.
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
 * The first line of a failed response's text, capped at MAX_ERROR_TEXT.
 * Only the cause is kept: a stack trace or file body would put unreviewed bytes into a record /cad-report prints.
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
 * Mask credential-shaped values in a cause line before it's stored.
 * A failing tool wrote that text and it lands in a record /cad-report prints, so it's masked whoever authored it, with the same token|password|secret|key|api|bearer words the risk detector uses.
 * The name survives and only the value is masked, so "auth failed: api_key=<redacted>" still says what went wrong.
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

/**
 * A path target as the record should carry it: lexical only, no realpath and no stat. Relative targets resolve against the call's cwd and `~` is the home directory.
 * Inside the project root it's kept as given, inside the plugin root it's `${CLAUDE_PLUGIN_ROOT}/<relative path>` and anything else is `outside`.
 * The project test runs first, so a plugin root inside the project records as given. With no opts.root the target comes back untouched.
 * @param {unknown} target
 * @param {any} input the parsed hook JSON
 * @param {{root?: string, cwd?: string, pluginRoot?: string}} [opts]
 * @returns {any}
 */
function classifyTarget(target, input, opts) {
  const root = opts && typeof opts.root === 'string' && opts.root ? opts.root : null;
  if (!root || typeof target !== 'string' || !target) return target;
  const cwd = (opts && opts.cwd) || (input && input.cwd);
  const base = typeof cwd === 'string' && cwd ? cwd : root;
  let abs;
  // the host expands a leading ~ for Glob and Grep; resolved against the cwd it would read as a project dir named `~` and another project's path would be recorded as given
  try {
    abs = target === '~' || target.startsWith('~/') ? resolve(homedir(), target.slice(2)) : resolve(base, target);
  } catch { return 'outside'; }
  const within = (dir) => abs === dir || abs.startsWith(dir + sep);
  if (within(root)) return target;
  const plugin = opts && typeof opts.pluginRoot === 'string' && opts.pluginRoot ? opts.pluginRoot : null;
  if (plugin && within(plugin)) {
    const rel = relative(plugin, abs).split(sep).join('/');
    return rel ? '${CLAUDE_PLUGIN_ROOT}/' + rel : '${CLAUDE_PLUGIN_ROOT}';
  }
  return 'outside';
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
    // agent_id is only set inside a subagent, which is the coordinator-versus-worker split this file measures
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
    // scope only; the pattern is what can carry a secret
    rec.target = ti.path ?? null;
    if (ti.output_mode) rec.mode = ti.output_mode;
  } else if (tool === 'Bash') {
    // target stays the program since byTool and topTargets count it and old records carry only that; files gets its own field so the two never pool into one ratio
    rec.target = programOf(ti.command);
    const files = filesOf(ti.command, { ...(opts || {}), cwd: (opts && opts.cwd) || input.cwd });
    if (files.length) rec.files = files;
  }

  const target = rec.target;
  if (tool !== 'Bash') rec.target = classifyTarget(rec.target, input, opts);

  // tool_response isn't documented for PostToolUse; if the host sends one its size is the only exact byte figure, and if not bytes stays absent instead of invented
  const resp = input.tool_response;
  if (resp != null) {
    try {
      rec.bytes = typeof resp === 'string' ? resp.length : JSON.stringify(resp).length;
    } catch { /* unserializable response: leave `bytes` absent */ }
    const failed = errorFlagOf(resp);
    // only written when the response says so; defaulting to false would record every call as a success on a host that sends no shape
    if (failed === true) {
      rec.is_error = true;
      // a hidden target gets no cause: it reads `<path>: <reason>` and would hand back the absolute path `outside` withholds
      const text = errorTextOf(resp);
      if (text && !(rec.target === 'outside' && target !== 'outside')) rec.error = text;
    } else if (failed === false) {
      rec.is_error = false;
    }
  }
  return rec;
}

/**
 * How long, in ms, a writer waits for a rotation in flight before appending anyway.
 * A ceiling, not a lock: it blocks nobody and always proceeds. 250 matches lib/trace.mjs, and a real rotation takes a few ms against the 5000 the hook gets.
 */
const READS_ROTATE_WAIT_MS = 250;

/**
 * How old the claim's sidecar must be before the claim reads as abandoned. A constant, not a config key.
 * 30 s matches lib/trace.mjs and sits far above any live rotation, so it only guards a machine suspended mid-rotation.
 * Longer is worse: a dead claim costs one READS_ROTATE_WAIT_MS per append until it ages out.
 */
const READS_CLAIM_STALE_MS = 30_000;

/**
 * Was the claim in flight abandoned, by a process killed or timed out before it could release it?
 * readsRotationInFlight can't say: the claim is a hard link, so appends keep bumping the shared inode's timestamps. Only a file beside the claim holds its age.
 * Unknowable reads as live (no sidecar, a stat that throws, a future mtime): a wrong "live" costs one deferred rotation, a wrong "abandoned" breaks a live claim and costs the record.
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
 * Is the existing sibling a rotation in flight, or a generation an earlier rotation left?
 * The claim is a hard link, so until the swap the live path and the sibling share an inode. Reading in flight as a leftover evicts a claim someone holds, and the reverse means the record can never rotate a second time.
 * Unknowable reads as in flight (no inode, a failed stat): that only defers a rotation and the append still lands.
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
 * The whole fresh record a rotation writes: the marker, one line, nothing else.
 * rotateReads and appendRead's size arm both build it here, so the width appendRead reserves can't drift from the line that gets written; a reserve one byte short is the bug it exists to prevent.
 * `carried_bytes` seals the generation: the live record's size when the cut claimed it. The eviction in rotateReads uses it to rescue bytes a late writer appended to the old inode.
 * A null seal writes no field, because an absent field means "rescue nothing" and a guessed offset would re-append a whole generation.
 * It rides as a trailing field, so isReadsRotationMarker (keyed on `event` and no `tool`) and the reads filter in planning/core.mjs don't care.
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
 * An upper bound on the marker's width, not a measurement. The only varying field is `carried_bytes`, so it's rendered at the widest value a file size can take.
 * Don't "correct" it to a real marker's width: a reserve narrower than the line the rotation writes lets the fresh file land over its bound.
 * Exported so read-trace.test.mjs can pin the admission threshold to this number instead of restating the shape.
 */
export const READS_MARKER_BYTES = Buffer.byteLength(readsRotationMarker(Number.MAX_SAFE_INTEGER));

/**
 * The offset the cut that wrote `record` sealed its generation at, or null if it names none.
 * Only the head is read: the marker is the first line, and this runs on the rotation path where reading 8 MB for one number is the cost the bound avoids.
 * null on anything unreadable, unparseable or non-numeric, including generations sealed before `carried_bytes` existed, because a guessed offset re-appends a whole generation.
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
 * Claim the record, swap a fresh one in and hand the old generation to ROTATED_READS_FILE.
 * A restated copy of rotateTrace's technique, not a generalization of it (that one is bound to the trace at four levels), so the two can drift on the next fix to either.
 * No lock: withPlanningFileLock can't report a refusal from a hook that has to stay silent, and the concurrency is real, one process per tool call.
 * The claim is linkSync because a rename silently replaces its destination, so a writer with a stale stat could destroy a generation another writer just made. A link fails with EEXIST, atomically.
 * The fresh record is written whole to a private path and renamed in, so the live path is never absent and no concurrent append gets trimmed away.
 * One prior generation is the whole retention policy, and nothing crosses the cut: a loser's record in the sibling is still present across the pair, so there's no carry-back.
 * The one exception is the rescue when evicting a leftover generation: bytes past the earlier cut's seal were never accounted for, so they're carried into the live record while they still exist.
 * Exported for the tests; the losing arms can't be reached through appendRead, which re-stats.
 *
 * @param {string} planningRoot
 * @param {number} reserve the pending line's byte length, what the fresh record owes beyond the marker
 * @returns {{rotated: boolean, reason?: string, shortfall?: number|null}}
 *   `reason` only where the rotation failed outright; losing the claim is `{rotated:false}` and the caller appends.
 *   `shortfall` is the bytes of the destroyed generation the rescue couldn't carry, or null if even the count is unknown; absent means complete.
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
  // set only when the evicted path is a leftover generation, the one eviction with bytes worth rescuing; on an abandoned claim
  // that path is a second name for the live inode and a rescue would re-append the live record to itself
  /** @type {string|null} */
  let leftover = null;
  /** @type {string|null} */
  let dated = null;
  // the mtime this process stamped on the sidecar, so the confirm below can tell its own write from another claimant's refresh
  /** @type {number|null} */
  let mine = null;
  // held from the link until the swap; the sibling is only a second name for the live file meanwhile, so every failure arm releases it or the record never rotates again
  let held = false;
  // our stamp at its private path until the link says we own the claim it dates
  /** @type {string|null} */
  let pending = null;
  // the live record's size when this call claimed it, published as carried_bytes; null seals nothing instead of guessing
  /** @type {number|null} */
  let sealed = null;
  /** Moves the private stamp onto the shared sidecar path, only from the arms that know the claim is ours. */
  const publish = () => {
    if (!pending) return;
    try { renameSync(pending, claim); dated = claim; mine = statSync(claim).mtimeMs; }
    catch { mine = null; /* fail live: an undated claim reads as live */ }
    pending = null;
  };
  try {
    let claimed = false;
    // two attempts, never a loop: claim, or evict one leftover generation (or abandoned claim) and claim once more
    for (let attempt = 0; attempt < 2 && !claimed; attempt++) {
      // read the age before publishing a stamp, since a publish overwrites the only evidence a killed claimant left
      // (declared out here because the catch arm uses it)
      let wasStale = false;
      try {
        wasStale = readsClaimAbandoned(claim);
        // stamp privately and publish only once the claim is ours. The stamp has to exist before the link, or a third process
        // reads the aged file a previous run left and evicts a live claim.
        // Writing straight to `claim` would refresh somebody else's claim on every losing append, and on a busy record that restarts
        // the staleness clock forever so an abandoned claim never ages out. Having the loser put back what it overwrote is a
        // check-then-write on a shared path and can rewind a fresh stamp.
        // Plain overwrite, not `{flag:'wx'}`: the retry after an eviction reuses `priv` and would throw on our own leftover.
        // A failed sidecar write is swallowed, since no sidecar reads as live.
        pending = `${claim}.${priv}`;
        try { writeFileSync(pending, `${new Date().toISOString()}\n`); }
        catch { pending = null; /* fail live: no sidecar reads as a live claim */ }
        // seal before the link, never after: linking doesn't freeze the inode, so a writer appending between the link and a later
        // stat would have its bytes folded into carried_bytes, and the eviction would never rescue them
        try { sealed = statSync(file).size; } catch { sealed = null; }
        linkSync(file, sibling);
        claimed = true;
        held = true;
        // the claim is ours, so publish the stamp that dates it; the eviction arm's confirm covers the gap before this line
        publish();
      } catch (e) {
        const code = e && /** @type {any} */ (e).code;
        // nothing to rotate; the caller's append creates the file
        if (code === 'ENOENT') return { rotated: false };
        if (code !== 'EEXIST') return { rotated: false, reason: code || 'claim-failed' };
        // a sibling is already there, and EEXIST can't say whether it's a claim in flight or a leftover generation
        let abandoned = false;
        if (attempt > 0 || readsRotationInFlight(file, sibling)) {
          // unless the claim was abandoned: a claimant killed or timed out mid-rotation never runs its finally, so the claim stands
          // forever and every append pays the full wait budget. A shorter budget doesn't help, only a completed rotation ends it.
          // The sidecar's age is read only here, where the sibling is the same inode. A different inode is a leftover generation,
          // and that reading is confirmed after the eviction because a writer can link in between.
          abandoned = attempt === 0 && wasStale;
          if (!abandoned) {
          // a rotation really is in flight and we lost the claim. Don't go straight to the append: the live path still names the old
          // inode, so the record would land in the file about to become the sibling. Poll the inode identity until it changes,
          // then report not rotated so the caller appends into what the winner left.
          // No lock, for the reason in the doc comment above: the hook can't speak, so a refusal has nowhere to be reported.
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
        // evicting a leftover generation is the one destructive act on this path, so re-stat first and never rotate a record this writer
        // didn't see over the trigger. Another writer may have rotated since this one took its stat, and carrying that fresh file away
        // destroys the generation it just made. EEXIST can't see that and a check afterwards is too late, so the claim is refused up front.
        let now = null;
        try { now = statSync(file).size; } catch { return { rotated: false }; }
        if (now + reserve < MAX_READS_BYTES) return { rotated: false };
        // publish here and on no other losing arm: either the sibling is a leftover generation and no claim is held, or the sidecar read
        // abandoned and we're about to evict the claim it dates. It has to come before the eviction because the confirm below compares mtimes against what this line leaves.
        publish();
        // evict single-winner, the way lib/capture-file.mjs breaks a stale lock: one contender renames and the losers get ENOENT. The finally drops the private path.
        const path = join(planningRoot, `${READS_EVICT_TEMP_FILE}.${priv}`);
        try { renameSync(sibling, path); } catch { return { rotated: false }; }
        evicted = path;
        if (!abandoned) leftover = path;
        // confirm after claiming, on both eviction arms, before reading or writing anything. A second writer can link in between the
        // discriminator and the rename and stamp a fresh sidecar, so the mtime is no longer the one we wrote, and breaking that claim loses the whole record.
        // The leftover arm needs it too: its discriminator was read before the rename, so a writer that linked in meanwhile reads as a leftover and would be renamed away.
        // `mine === null` counts as unconfirmed, the same fail-live reading as everywhere else.
        // Put the sibling back only if nothing took the path meanwhile (a plain rename would clobber a fourth writer's claim), and clear `evicted` either way so the release can't delete a restored claim.
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
    // the fresh record is written whole to a private path (pid and random suffix, exclusive create) and renamed over the live one
    temp = join(planningRoot, `${READS_ROTATE_TEMP_FILE}.${priv}`);
    writeFileSync(temp, readsRotationMarker(sealed), { flag: 'wx' });
    renameSync(temp, file);
    temp = null;
    held = false;

    // the second window, and the one thing that crosses the cut. A writer that appended into the old inode while an earlier cut held its
    // claim has its bytes only in that generation. A second rotation evicts the generation and the finally unlinks it, so the record
    // ends up in neither file and nothing says so. The writer about to destroy a leftover finishes the carry here, after the swap, whole lines only.
    // The ordinary path still writes just the marker; this runs only at an eviction, over bytes no cut accounted for.
    // It starts at the earlier cut's marker, the first line of sibling, whose carried_bytes is where that cut sealed. Only the head is read, to stay off an 8 MB read.
    // No seal, no rescue: a generation from before the field has no offset to guess, and re-appending a whole one into a record readers use is worse than losing it. It fails closed with shortfall null.
    // A failed rescue never decides whether the rotation rotated, but it can't be silent either: every failure arm reports shortfall, the bytes past the seal not carried (from the stat, since a throwing read
    // established no count), and null if even the stat fails.
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
            // whole lines only, so a torn tail is dropped instead of appended as a half record
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
    // rescued lines may leave the record over MAX_READS_BYTES; they're carried anyway since refusing loses them for good and the next append rotates
    return shortfall === undefined ? { rotated: true } : { rotated: true, shortfall };
  } catch (e) {
    return { rotated: false, reason: (e && /** @type {any} */ (e).code) || 'rotate-failed' };
  } finally {
    // leave nothing behind on any arm: no private temp, stamp, unfinished claim or evicted generation
    if (temp) { try { unlinkSync(temp); } catch { /* nothing to clean up */ } }
    if (held) { try { unlinkSync(sibling); } catch { /* nothing to release */ } }
    // guarded by `held`, never unconditional: held goes false at the swap, so an unconditional unlink would delete the fresh sidecar
    // of a process that took the claim legitimately then, leaving a standing claim with no sidecar. That reads as live forever and defeats the reclaim for good.
    // So a completed rotation leaves its sidecar behind, and that's inert: after the swap the sibling is a separate inode, nothing reads it and the next claimant overwrites it.
    if (held && dated) { try { unlinkSync(dated); } catch { /* nothing to release */ } }
    // a stamp we never published dates nothing and sits at a path with our priv, so nobody else sees it; always dropping it keeps a losing append off the shared sidecar
    if (pending) { try { unlinkSync(pending); } catch { /* nothing to clean up */ } }
    if (evicted) { try { unlinkSync(evicted); } catch { /* nothing to clean up */ } }
  }
}

/**
 * Append one record, guarded the way lib/trace.mjs is: lstat for a planted symlink first, the bound enforced before the write (an append-only file can't be trimmed), a reason returned instead of thrown.
 * The size bound isn't a refusal. At MAX_READS_BYTES the record rotates and the append lands; the other size answers are `oversized-record` for a single line that reaches the bound alone, and whatever code a failed rotation gave.
 * @param {string} planningRoot
 * @param {any} record
 */
export function appendRead(planningRoot, record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { written: false, reason: 'bad-record' };
  }
  const file = readsPath(planningRoot);
  // the symlink guard stays first, so a redirected record is refused whatever its size
  try {
    if (lstatSync(file).isSymbolicLink()) return { written: false, reason: 'symlinked-reads' };
  } catch { /* ENOENT is the ordinary first write */ }
  // rendered ahead of the size arm because that arm needs this line's length: it fires when the record plus this line would reach the bound, not when the record is already there
  let line;
  try {
    line = `${JSON.stringify(record)}\n`;
  } catch (e) {
    return { written: false, reason: 'unserializable-record' };
  }
  const pending = Buffer.byteLength(line);
  // the bound used to be a refusal, and a full record meant silent write-death for the rest of the project, which went four cycles
  // unnoticed because appendRead's return reaches no user-facing surface. Now it rotates and this append lands.
  // An absent file is the ordinary first write; any other stat failure is why this append didn't happen.
  let size = null;
  try {
    size = statSync(file).size;
  } catch (e) {
    const code = e && /** @type {any} */ (e).code;
    if (code !== 'ENOENT') return { written: false, reason: code || 'stat-failed' };
  }
  if (size !== null && size + pending >= MAX_READS_BYTES) {
    // a single line that reaches the bound alone is refused, not rotated: rotating throws the record away for a line that still won't fit, and the next append does it again.
    // The marker is reserved too, not just the pending line. A rotation writes its marker into the fresh record, so a record that fit alone but not beside it
    // used to rotate and then land over the bound on its first write. That moves a narrow band of sizes into the refusal below on purpose; they couldn't be written under the bound either way.
    if (pending + READS_MARKER_BYTES >= MAX_READS_BYTES) {
      return { written: false, reason: 'oversized-record' };
    }
    const rot = rotateReads(planningRoot, pending);
    // losing the claim isn't a failure, somebody else made the room; only a failed rotation carries a reason, and that's reported instead of appended past
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
 * Fold records into the figures the ledger asks for. Pure; callers own the reading.
 * Two redundancies because target and files measure different things. `redundancy` is calls over distinct targets, but a Bash target is the program, so on a Bash-heavy corpus it counts how often a shell verb was typed. It stays because every record already on disk carries only that.
 * `fileRedundancy` is path touches over distinct files, from the `files` array filesOf fills, and it's the one that shows whether in-dispatch reading repeats.
 * A record with no target, or no `files`, counts toward `calls` and not toward the matching distinct count, since an unnamed target can't be shown to repeat. Every record written before `files` existed is that, so `fileCalls` says how much of `calls` the file half covers, like `bytesCoverage`.
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
    // null, not Infinity: no distinct targets is no measurement
    redundancy: distinct ? Number((targeted / distinct).toFixed(2)) : null,
    // withBytes says how much of calls this covers, so a partial capture never reads as a total
    bytes: withBytes ? bytes : null,
    bytesCoverage: calls ? Number((withBytes / calls).toFixed(2)) : 0,
    // null rather than zero for the ratio, same as redundancy
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

/** Host-owned agent types with no dispatch event in trace.jsonl, so their reads are a permanent floor on what the join can attribute, not a gap to close. */
export const HOST_AGENT_TYPES = ['fork', 'general-purpose'];

// re-exported so lib/subagent-trace.mjs and the tests keep importing them from here
export { roleOfAgent, rungOfAgent };

/**
 * Join reads.jsonl records to the trace.jsonl dispatch brackets that caused them, at read time: normalize the agent to a role, then test the timestamp for containment in a closed bracket of that role.
 * Not a corr stamped at hook time: a read inside a subagent would get the coordinator's current corr, so the join would be confidently wrong instead of honestly absent.
 * Ambiguity is reported, not resolved. Same-role brackets really do overlap on the parallel execute path, and picking one is wrong exactly on the costliest path (cad-executor), so a record inside more than one is `ambiguous` and joins to none.
 * Nothing defaults an absent field: a record with no agent gets `agent: null` instead of reading as a coordinator, and agent_id the same, since the host guarantees neither across subagent kinds and versions.
 * Pure by injection like filesOf: the caller supplies the brackets (`renderTrace(...).brackets`).
 *
 * @param {any[]} records the parsed `reads.jsonl` lines
 * @param {any[]} brackets paired dispatch rows, each `{role, ts, end, ...}`
 */
export function joinReads(records, brackets) {
  // grouped by role so each record is tested only against its own role's brackets
  /** @type {Map<string, {a: number, b: number, row: any}[]>} */
  const spansByRole = new Map();
  for (const b of Array.isArray(brackets) ? brackets : []) {
    if (!b || typeof b !== 'object') continue;
    const role = typeof b.role === 'string' ? b.role : '';
    const a = Date.parse(b.ts);
    const z = Date.parse(b.end);
    // a bracket with an unreadable end is dropped, not widened to infinity, which would swallow every read of that role into one confident answer
    if (!role || !Number.isFinite(a) || !Number.isFinite(z)) continue;
    if (!spansByRole.has(role)) spansByRole.set(role, []);
    spansByRole.get(role).push({ a, b: z, row: b });
  }

  const counts = { joined: 0, ambiguous: 0, unjoined: 0, floor: 0, coordinator: 0, unresolved: 0 };
  /** @type {{ts: any, agent: string|null, agent_id: string|null, role: string|null, status: string, bracket: any, files: string[]}[]} */
  const rows = [];

  for (const r of Array.isArray(records) ? records : []) {
    if (!r || typeof r !== 'object') continue;
    const agent = typeof r.agent === 'string' && r.agent ? r.agent : null;
    const agentId = typeof r.agent_id === 'string' && r.agent_id ? r.agent_id : null;
    // the record's files ride the row, normalized once here. The in-dispatch fold needs both the bracket and the paths, and the alternatives
    // are worse: re-testing containment there is a second statement of the join, and zipping rows to records by index goes silently wrong
    // once either side filters a record the other keeps.
    const files = Array.isArray(r.files)
      ? r.files.filter((f) => typeof f === 'string' && f)
      : [];
    const role = roleOfAgent(agent);
    /** @param {string} status @param {any} [bracket] */
    const push = (status, bracket = null) => {
      counts[status]++;
      rows.push({ ts: r.ts ?? null, agent, agent_id: agentId, role, status, bracket, files });
    };

    if (agent === null) { push('unresolved'); continue; }
    if (agent === 'coordinator') { push('coordinator'); continue; }
    if (HOST_AGENT_TYPES.includes(agent)) { push('floor'); continue; }
    // `unknown-agent` lands here: the call had an agent_id and no agent_type, so it's a subagent's read whose role just isn't knowable.
    // Calling it unjoined would claim no bracket contained it, which was never tested.
    if (role === null) { push('unresolved'); continue; }

    const t = Date.parse(r.ts);
    if (!Number.isFinite(t)) { push('unresolved'); continue; }
    const hits = (spansByRole.get(role) || []).filter((s) => t >= s.a && t <= s.b);
    if (hits.length === 1) push('joined', hits[0].row);
    else if (hits.length > 1) push('ambiguous');
    else push('unjoined');
  }

  return { ...counts, rows };
}

/**
 * Per-role in-dispatch file figures, folded off the rows joinReads returned.
 * Group the joined rows by the one bracket each joined to, count touches per path inside it, then per role divide the touches by the sum of the per-bracket distinct counts. Summing distinct per bracket is what makes it in-dispatch: one distinct count over a role's whole corpus can't tell "re-read 20 times in one dispatch" from "read once in each of 20", and only the first is something a per-dispatch lever can act on.
 * It differs from summarizeReads's fileRedundancy on purpose and both stay: that one is whole-corpus over distinct files, this one is per role and per dispatch.
 * Two limits ride the return so callers state them. `coverage` is the share of joined reads that carried `files` at all (older records carry none, so 0.62 is normal, and a figure without it reads as a total). `coordinatorFiles` counts main-thread file reads, which have no bracket by construction and sit outside what this can measure.
 * A null ratio, never 0: no summed distinct is no measurement. Rounded through Number(x.toFixed(2)) like the others.
 *
 * @param {any[]} rows `joinReads(...).rows`
 * @returns {{roles: {role: string, brackets: number, touches: number,
 *            distinct: number, ratio: number|null,
 *            worst: {path: string, count: number, phase: any, plan: any}|null}[],
 *           joined: number, fileCarrying: number, coverage: number|null,
 *           coordinatorFiles: number}}
 */
export function inDispatchReads(rows) {
  // keyed on the bracket object joinReads handed back; two dispatches are two objects, so no key grammar is needed
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
    // a row that didn't join adds nothing, to the ratio or to coverage; counting ambiguous, floor, unjoined or unresolved in the denominator would report a coverage the ratio never had
    if (row.status !== 'joined' || !row.bracket) continue;
    joined++;
    if (files.length) fileCarrying++;
    const role = typeof row.role === 'string' && row.role ? row.role : null;
    if (!role) continue;
    // the role gets a row on its first joined read, before any file question, so a role that recorded no paths shows a null ratio instead of looking like it never ran
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
      // the worst single file in one bracket is the suggestion's named target: "read X N times" in one dispatch is actionable where a role-wide ratio isn't. Ties keep the first seen so the answer is stable.
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
    // null over an empty scope, same as the ratio
    coverage: joined ? Number((fileCarrying / joined).toFixed(2)) : null,
    coordinatorFiles,
  };
}
