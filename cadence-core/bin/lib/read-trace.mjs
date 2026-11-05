// @ts-check
// reads.jsonl writer: one line per tool call, so billing can see what a dispatch opened after it started.
// its own file, not a trace.jsonl family: that one has a single writer and a 1 MiB cap sized for tens of events
// paths only, never payloads: a command or grep pattern can carry a secret, and a model reads this file back
// outside the project, a path becomes ${CLAUDE_PLUGIN_ROOT}/... or `outside`, so no home directory reaches a report
// never throws, exits 0: it runs after every tool call and a recorder that can fail one is worse than none
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

/** Bigger than the trace cap on purpose: one line per tool call would fill 1 MiB inside a phase. */
export const MAX_READS_BYTES = 8388608;

/** The tools whose calls are worth billing. Anything else is not a read. */
export const RECORDED_TOOLS = ['Read', 'Grep', 'Glob', 'Bash', 'NotebookRead'];

/** The longest error text a record may carry. A cause, never a payload. */
export const MAX_ERROR_TEXT = 200;

/** Past a dozen a Bash call is a sweep (a glob, a `for f in *`); cap it so the file stays cheap to append to. */
export const MAX_FILES_PER_CALL = 12;

/** @param {string} planningRoot */
export function readsPath(planningRoot) {
  return join(planningRoot, READS_FILE);
}

/** Spelled once so writer, .gitignore and tests agree; the `reads.` prefix lets a test catch a leaked temp. */
export const ROTATED_READS_FILE = 'reads.1.jsonl';

/** Derived from ROTATED_READS_FILE so the two names can't come apart. */
export const READS_CLAIM_FILE = `${ROTATED_READS_FILE}.claim`;

/**
 * The writer's private temp paths. Each has a pid and random suffix, so the .gitignore rule can only be a pattern.
 * A killed hook (5 s timeout) leaves them mid-rotation, and the evict temp can hold a whole generation.
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

/** Copy of ROTATION in lib/trace.mjs, because importing the trace on every tool call for one constant is too much. */
export const READS_ROTATION = 'record_rotated';

/**
 * Not inert like the trace's: unfiltered, summarizeReads bills it and /cad-report shows a phantom read.
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
  // stop at a heredoc opener, because the body is payload; the live hook once billed a token lifted out of one
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
 * The in-repo file paths a Bash command names, and nothing else (programOf alone made `redundancy` count shell verbs).
 * A token counts only if it looks like a path (no quote, glob, redirect, VAR=value or -flag, and a `/` or `.`),
 * resolves inside the project root (so ~/.config/<service>/credentials never counts) and is an existing regular file.
 * Paths are recorded root-relative, so no home path lands in a record.
 * Pure by injection like `now` on recordFromHook: the caller passes the root and isFile, and no opts returns nothing.
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
  // relative tokens resolve against the call's cwd, since a subdirectory session writes `bin/x.mjs`
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
  *   root and isFile feed filesOf, pluginRoot marks plugin files; omit them and nothing is added or reclassified.
 */
/**
 * Whether a `tool_response` reports failure, or null when it doesn't say.
 *   root and isFile feed filesOf, pluginRoot marks plugin files; omit them and nothing is added or reclassified.
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
 * A failing tool wrote this text and /cad-report prints it, so mask it with the risk detector's credential words.
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
 * A path target as the record carries it: lexical only, no realpath, no stat. Relative paths resolve against the cwd.
 * Project paths stay as given, plugin paths become `${CLAUDE_PLUGIN_ROOT}/<relative path>`, anything else is `outside`.
 * The project test runs first, so a plugin root inside the project records as given. No opts.root leaves it untouched.
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
  // the host expands a leading ~ for Glob and Grep; left alone it would read as a project dir named `~`
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
    // target stays the program (old records carry only that); files is its own field so the two never pool
    rec.target = programOf(ti.command);
    const files = filesOf(ti.command, { ...(opts || {}), cwd: (opts && opts.cwd) || input.cwd });
    if (files.length) rec.files = files;
  }

  const target = rec.target;
  if (tool !== 'Bash') rec.target = classifyTarget(rec.target, input, opts);

  // tool_response isn't documented for PostToolUse; when the host sends none, bytes stays absent instead of invented
  const resp = input.tool_response;
  if (resp != null) {
    try {
      rec.bytes = typeof resp === 'string' ? resp.length : JSON.stringify(resp).length;
    } catch { /* unserializable response: leave `bytes` absent */ }
    const failed = errorFlagOf(resp);
    // only written when the response says so; a default false would mark every call a success
    if (failed === true) {
      rec.is_error = true;
      // a hidden target gets no cause: it reads `<path>: <reason>` and would hand back the path `outside` withholds
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
 * A ceiling, not a lock: it blocks nobody and always proceeds. Same 250 as lib/trace.mjs.
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
 * readsRotationInFlight can't say: the claim is a hard link, so appends keep bumping the inode's times.
 * Only the sidecar holds the claim's age. Unknowable reads as live: a wrong "live" defers one rotation,
 * a wrong "abandoned" breaks a live claim and loses the record.
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
 * Until the swap the claim is a hard link, so the live path and the sibling share an inode.
 * Reading in flight as a leftover evicts a held claim, and the reverse means the record never rotates again.
 * Unknowable reads as in flight: that only defers a rotation and the append still lands.
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
 * rotateReads and appendRead's size arm both build it here, so the reserve can't drift from the line written.
 * `carried_bytes` is the live record's size at the cut; rotateReads uses it to rescue bytes a late writer appended.
 * A null seal writes no field: absent means "rescue nothing", and a guessed offset would re-append a whole generation.
 * It rides as a trailing field, so isReadsRotationMarker and the reads filter in planning/core.mjs don't care.
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
 * Upper bound on the marker's width: `carried_bytes` is rendered at the widest value a file size can take.
 * Don't "correct" it to a real marker's width: a narrower reserve lets the fresh file land over its bound.
 * Exported so read-trace.test.mjs can pin the admission threshold to this number instead of restating the shape.
 */
export const READS_MARKER_BYTES = Buffer.byteLength(readsRotationMarker(Number.MAX_SAFE_INTEGER));

/**
 * The offset the cut that wrote `record` sealed its generation at, or null if it names none.
 * Reads only the head: the marker is line one, and 8 MB for one number is too much on the rotation path.
 * null for anything unreadable or non-numeric, old generations included: a guessed offset re-appends a whole one.
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
 * A copy of rotateTrace's technique, not a shared one, so a fix to either has to be made in both.
 * No lock: a hook has to stay silent, so withPlanningFileLock has nowhere to report a refusal.
 * The claim is a linkSync because a rename silently replaces its target; a link fails with EEXIST, atomically.
 * Exported for the tests; the losing arms can't be reached through appendRead, which re-stats.
 *
 * @param {string} planningRoot
 * @param {number} reserve the pending line's byte length
 * @returns {{rotated: boolean, reason?: string, shortfall?: number|null}}
 *   `reason` only on an outright failure. `shortfall` is bytes the rescue couldn't carry, null if unknown.
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
  // set only for a leftover generation, the one eviction worth rescuing; on an abandoned claim
  // the evicted path is the live inode, and a rescue would re-append it to itself
  /** @type {string|null} */
  let leftover = null;
  /** @type {string|null} */
  let dated = null;
  // the mtime we stamped on the sidecar, so the confirm below can tell it from another claimant's refresh
  /** @type {number|null} */
  let mine = null;
  // held from link to swap; every failure arm must release it or the record never rotates again
  let held = false;
  // our stamp at its private path until the link says we own the claim it dates
  /** @type {string|null} */
  let pending = null;
  // the live record's size at the claim, published as carried_bytes; null seals nothing rather than guess
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
        // stamp at a private path and publish only once the claim is ours: it has to exist before the link, or a third
        // process reads the old aged file and evicts a live claim. Writing straight to `claim` would refresh
        // somebody else's claim on every losing append, and an abandoned claim would never age out.
        // not `{flag:'wx'}`: the retry after an eviction reuses `priv` and would throw on our own leftover
        // a failed sidecar write is swallowed, since no sidecar reads as live
        pending = `${claim}.${priv}`;
        try { writeFileSync(pending, `${new Date().toISOString()}\n`); }
        catch { pending = null; /* fail live: no sidecar reads as a live claim */ }
        // seal before the link, or a late writer's bytes fold into carried_bytes and never get rescued
        try { sealed = statSync(file).size; } catch { sealed = null; }
        linkSync(file, sibling);
        claimed = true;
        held = true;
        // the claim is ours, so publish the stamp that dates it
        publish();
      } catch (e) {
        const code = e && /** @type {any} */ (e).code;
        // nothing to rotate; the caller's append creates the file
        if (code === 'ENOENT') return { rotated: false };
        if (code !== 'EEXIST') return { rotated: false, reason: code || 'claim-failed' };
        // a sibling is already there, and EEXIST can't say whether it's a claim in flight or a leftover generation
        let abandoned = false;
        if (attempt > 0 || readsRotationInFlight(file, sibling)) {
          // unless abandoned: a killed claimant never runs its finally, and only a completed rotation ends the wait
          // the sidecar's age counts only on the same inode; a leftover is confirmed after the eviction
          abandoned = attempt === 0 && wasStale;
          if (!abandoned) {
          // a rotation is in flight and we lost: appending now would land in the file about to become the sibling,
          // so poll until the inode changes, then report not rotated and let the caller append into the winner's file
          // no lock, because the hook can't speak and a refusal would have nowhere to go
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
        // evicting a leftover is the one destructive act here, so re-stat first: another writer may have rotated
        // since our stat, and carrying its fresh file away destroys the generation it just made. EEXIST can't see that
        let now = null;
        try { now = statSync(file).size; } catch { return { rotated: false }; }
        if (now + reserve < MAX_READS_BYTES) return { rotated: false };
        // publish before the eviction, because the confirm below compares mtimes against what this leaves
        publish();
        // evict single-winner, the way lib/capture-file.mjs breaks a stale lock: one renames, the losers get ENOENT
        const path = join(planningRoot, `${READS_EVICT_TEMP_FILE}.${priv}`);
        try { renameSync(sibling, path); } catch { return { rotated: false }; }
        evicted = path;
        if (!abandoned) leftover = path;
        // confirm on both eviction arms before touching anything: a writer that linked in after the check
        // may have stamped a fresh sidecar, and breaking that claim loses the record. `mine === null` is unconfirmed.
        // restore the sibling only if nothing took the path, and clear `evicted` either way so release can't delete it
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
    // the fresh record goes to a private path (exclusive create) and is renamed over the live one
    temp = join(planningRoot, `${READS_ROTATE_TEMP_FILE}.${priv}`);
    writeFileSync(temp, readsRotationMarker(sealed), { flag: 'wx' });
    renameSync(temp, file);
    temp = null;
    held = false;

    // rescue, the one thing that crosses the cut: bytes a writer appended to the old inode while an earlier cut held
    // its claim live only in that generation; evicting it would lose them, so the evictor carries whole lines
    // past the earlier seal over, after the swap. The ordinary path still writes just the marker.
    // no seal, no rescue: re-appending a whole generation into a record readers use is worse than losing it
    // a failed rescue never decides whether the rotation rotated, but it reports shortfall (null if the stat fails too)
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
    // rescued lines may leave the record over MAX_READS_BYTES; carry them anyway, the next append rotates
    return shortfall === undefined ? { rotated: true } : { rotated: true, shortfall };
  } catch (e) {
    return { rotated: false, reason: (e && /** @type {any} */ (e).code) || 'rotate-failed' };
  } finally {
    // leave nothing behind on any arm: no private temp, stamp, unfinished claim or evicted generation
    if (temp) { try { unlinkSync(temp); } catch { /* nothing to clean up */ } }
    if (held) { try { unlinkSync(sibling); } catch { /* nothing to release */ } }
    // guarded by `held`: it goes false at the swap, and unlinking later would eat the next claimant's sidecar
    // and leave a claim that reads as live forever. The sidecar a completed rotation leaves behind is inert.
    if (held && dated) { try { unlinkSync(dated); } catch { /* nothing to release */ } }
    // an unpublished stamp dates nothing and sits at our private path, so always drop it
    if (pending) { try { unlinkSync(pending); } catch { /* nothing to clean up */ } }
    if (evicted) { try { unlinkSync(evicted); } catch { /* nothing to clean up */ } }
  }
}

/**
 * Append one record, guarded like lib/trace.mjs: symlink check, bound enforced before the write, reason returned.
 * The size bound rotates instead of refusing; `oversized-record` is for a single line that reaches the bound alone.
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
  // rendered first because the size arm needs this line's length: it fires when record plus line reach the bound
  let line;
  try {
    line = `${JSON.stringify(record)}\n`;
  } catch (e) {
    return { written: false, reason: 'unserializable-record' };
  }
  const pending = Buffer.byteLength(line);
  // the bound used to refuse, which silently killed writes for the rest of the project; now it rotates
  // an absent file is the ordinary first write; any other stat failure is why this append didn't happen
  let size = null;
  try {
    size = statSync(file).size;
  } catch (e) {
    const code = e && /** @type {any} */ (e).code;
    if (code !== 'ENOENT') return { written: false, reason: code || 'stat-failed' };
  }
  if (size !== null && size + pending >= MAX_READS_BYTES) {
    // a line that reaches the bound alone is refused: rotating would discard the record and it still wouldn't fit
    // reserve the marker too, or a line that fit alone would rotate and still land over the bound
    if (pending + READS_MARKER_BYTES >= MAX_READS_BYTES) {
      return { written: false, reason: 'oversized-record' };
    }
    const rot = rotateReads(planningRoot, pending);
    // losing the claim isn't a failure, someone else made room; only a failed rotation carries a reason
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
 * `redundancy` is calls over distinct targets; a Bash target is only the program, and old records carry nothing else.
 * `fileRedundancy` is path touches over distinct `files`, the one that shows whether in-dispatch reading repeats.
 * A record with no target or no `files` counts toward `calls` but not the distinct count; `fileCalls` is the share.
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

/** Host-owned agent types with no dispatch event in trace.jsonl: their reads are a floor, not a gap to close. */
export const HOST_AGENT_TYPES = ['fork', 'general-purpose'];

// re-exported so lib/subagent-trace.mjs and the tests keep importing them from here
export { roleOfAgent, rungOfAgent };

/**
 * Join reads.jsonl records to the trace.jsonl dispatch brackets at read time, by role and timestamp containment.
 * Not a corr stamped at hook time: a subagent read would get the coordinator's corr and be confidently wrong.
 * Same-role brackets overlap on the parallel path, so a record in more than one is `ambiguous` and joins to none.
 * An absent field stays null instead of defaulting to coordinator; the host guarantees neither field across versions.
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
    // a bracket with an unreadable end is dropped, not widened, or it would swallow every read of that role
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
    // the record's files ride the row so the in-dispatch fold has both bracket and paths; re-testing containment there
    // would restate the join, and zipping rows to records by index breaks once either side filters
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
    // `unknown-agent` (an agent_id with no agent_type) lands here: its role isn't knowable,
    // and calling it unjoined would claim a bracket test that never ran
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
 * Touches per path inside each bracket, per role over the sum of per-bracket distinct counts. One distinct count over a
 * corpus can't tell "re-read 20 times in one dispatch" from "read once in each of 20"; only the first is actionable.
 * Unlike summarizeReads's fileRedundancy (whole corpus), this is per role and per dispatch.
 * `coverage` is the share of joined reads that carried `files`; `coordinatorFiles` has no bracket to join.
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
    // a row that didn't join adds nothing to the ratio or coverage, or coverage would claim more than the ratio had
    if (row.status !== 'joined' || !row.bracket) continue;
    joined++;
    if (files.length) fileCarrying++;
    const role = typeof row.role === 'string' && row.role ? row.role : null;
    if (!role) continue;
    // the role gets its row on the first joined read, so one that recorded no paths shows a null ratio, not absence
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
      // the worst file in one bracket is the suggestion's target ("read X N times"); ties keep the first seen
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
