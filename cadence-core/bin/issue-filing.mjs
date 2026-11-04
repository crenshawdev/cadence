#!/usr/bin/env node
// @ts-check
// issue-filing.mjs - the seam over lib/filing-decision.mjs for a gate that won't fix a finding now. `unfixed` says what to
// ask about; `file` writes what the user answered: an accepted finding to this repo's tracker, a declined one to
// `.planning/DECLINED.md` and nowhere else. One JSON line on stdout, and no byte of any child's output on an envelope:
// stderr is discarded at the spawn, every child has a timeout, and only the title-scoped lookup's stdout is read.
// The payload rides a file, never a flag or stdin: it's a reviewer's free text with quotes, backticks and newlines.
// A decline is local. As a labelled forge issue it published every refusal on a tracker meant for real work, and the
// dedup key was only as complete as one `issue list` page, so declined findings came back forever once the set outgrew it.
// The only remote write is an accepted finding's create and the only read is the lookup deciding whether to make one,
// one query per LOOKUP_CHUNK fingerprints. A create that doesn't land refuses and names what wasn't filed, so a caller
// is never told "filed" about a finding that isn't on the tracker.
'use strict';

import { execFileSync } from 'node:child_process';
import { lstatSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mergeLayers } from './lib/config-merge.mjs';
import { withPlanningFileLock } from './lib/capture-file.mjs';
import {
  appendDeclinedRow, appendFiledRow, atomicWrite, parseDeclinedRows, parseFiledRows,
} from './lib/planning-files.mjs';
import { emit } from './lib/seam-io.mjs';
import { CONTRACTS, requireFlag } from './lib/arg-contract.mjs';
import { redactUrl } from './lib/redact-url.mjs';
import { onPath } from './lib/on-path.mjs';
import { teaLoginNameForHost } from './lib/issue-decision.mjs';
import { PROVIDER_TABLE, missingForgeKeys } from './lib/forge-decision.mjs';
import {
  FILING_TABLE, LOOKUP_CHUNK, fingerprint, issueBody, issueTitle, normalizeLookup,
  normalizeVisibility, unfixedFindings,
} from './lib/filing-decision.mjs';

/** Bounds the login probe, a local config read. */
const LOGIN_TIMEOUT_MS = 10000;

/** A read, so bounded shorter than a create: giving up on a slow query costs one unanswered chunk, which has an arm. */
const LOOKUP_TIMEOUT_MS = 30000;

/** Bounds the one visibility read the ask face makes. An answer that didn't come reads the same as one that couldn't be read. */
const VISIBILITY_TIMEOUT_MS = 30000;

/** A create writes, so it gets longer than a lookup, but it's still bounded: an unbounded child inside a gate step hangs the run. */
const CREATE_TIMEOUT_MS = 60000;

/**
 * Run a child and say only whether it worked and what it printed on stdout.
 * stderr is ignored at the spawn, as in forge.mjs and issue-check.mjs: a forge CLI's stderr isn't ours to read or buffer.
 * `ok: false` means "this call didn't come back clean", not "the remote did nothing". A nonzero exit, a SIGKILL on the
 * timeout and a transport failure are one value, and on a write the last two can follow a remote that already committed.
 * Callers on a create path carry that ambiguity forward; cmdFile's create-failed hint is where it's spelled out.
 * @param {string} bin @param {string[]} args
 * @param {{cwd: string, timeout: number}} opts
 */
function run(bin, args, { cwd, timeout }) {
  try {
    return {
      ok: true,
      stdout: execFileSync(bin, args, {
        cwd, timeout, killSignal: 'SIGKILL', encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }),
    };
  } catch { return { ok: false, stdout: '' }; }
}

/**
 * The persisted forge record, the row that drives it, the binary and the login it needs, or the one refusal that says
 * which is missing.
 *
 * mergeLayers warnings[]: the one merge in this file, shared by both faces. Its `warnings` goes on every envelope either
 * face emits, from one callsite so there's a single place to keep surfacing them.
 *
 * Every refusal that can precede a create does, so this is called before any spawn: an unconfigured forge, an
 * uninstalled CLI and an unresolvable login are knowable up front, and finding one out halfway through a batch leaves
 * some issues filed and some not.
 *
 * @param {string} dir
 * @returns {{ok: true, provider: string, repo: string, bin: string, login: string|null,
 *   row: any, warnings: string[]}
 *   | {ok: false, reason: string, detail: string, hint: string, warnings: string[]}}
 */
function resolveForge(dir) {
  const { config, warnings } = mergeLayers(join(dir, '.planning', 'config.json'));
  const git = config.git || {};
  const provider = git.forge_provider ?? null;
  const repo = git.forge_repo ?? null;
  const host = git.forge_host ?? null;

  // The forge record's own rule, imported so setup, the land report and this writer agree on what "configured" means.
  const missing = missingForgeKeys({ provider, repo, host });
  if (missing.length) {
    return { ok: false, reason: 'no-forge', warnings,
      detail: `this repository has no forge to file on: ${missing.join(', ')} `
        + `${missing.length === 1 ? 'is' : 'are'} unset`,
      hint: 'run the forge setup step this repository never answered - it is part of '
        + '`/cad-new-project` and `/cad-adopt`, and it is what persists '
        + 'git.forge_provider, git.forge_repo and git.forge_host - then re-run this step' };
  }

  const bin = PROVIDER_TABLE[provider];
  if (!onPath(bin)) {
    return { ok: false, reason: 'no-cli', warnings,
      detail: `${provider} is this repository's forge but ${bin} does not resolve on PATH`,
      hint: `install ${bin} and re-run this step - no finding is dropped, the ask is `
        + 'simply not answerable until a CLI can reach the tracker' };
  }

  const row = FILING_TABLE[provider];
  let login = null;
  if (row.needsLogin) {
    // The persisted host turned into the login name `tea --login` wants; forge.mjs's teaLoginFor classifies an origin URL instead.
    const probe = run(bin, ['login', 'list', '--output', 'json'],
      { cwd: dir, timeout: LOGIN_TIMEOUT_MS });
    let records = null;
    if (probe.ok) { try { records = JSON.parse(probe.stdout); } catch { records = null; } }
    login = teaLoginNameForHost(records, host);
    if (!login) {
      return { ok: false, reason: 'no-login', warnings,
        detail: `no ${bin} login names ${host}, and an unqualified --repo falls back to `
          + 'config file order - which would file this repository\'s findings on a stranger\'s tracker',
        hint: `run \`${bin} login add\` for that instance, or check that git.forge_host names `
          + `the host one of your \`${bin} login list\` records already carries, then re-run this step` };
    }
  }
  return { ok: true, provider, repo, bin, login, row, warnings };
}

/**
 * Read a JSON payload file, or the refusal that says why it couldn't be read.
 * The path redacts on both arms, and so does the message. --payload is caller-supplied and this seam's stdout is the
 * workflow transcript, so a path like `/tmp/cad:s3cr3t-tok@host.invalid/payload.json` would reach `detail` twice: as the
 * path echoed back, and inside the message readFileSync quotes it into.
 * Each part is redacted on its own, because redacting the joined `path: message` could build a `user:secret@host` span
 * out of two clean halves.
 * @param {string} file
 * @returns {{ok: true, value: any} | {ok: false, reason: string, detail: string, hint: string}}
 */
function readPayload(file) {
  const where = redactUrl(file);
  let raw;
  try { raw = readFileSync(file, 'utf8'); } catch (e) {
    return { ok: false, reason: 'no-payload',
      detail: `${where}: ${redactUrl(e && e.message ? e.message : String(e))}`,
      hint: 'pass --payload the path of a file that exists and is readable - the same '
        + 'composed payload file the adjudication record was written from' };
  }
  try { return { ok: true, value: JSON.parse(raw) }; } catch (e) {
    return { ok: false, reason: 'bad-payload',
      detail: `${where} is not JSON: ${redactUrl(e && e.message ? e.message : String(e))}`,
      hint: 'write the payload with JSON.stringify rather than by hand, then re-run - '
        + 'the file must hold one JSON object and nothing else' };
  }
}

/** The decline set, read off `.planning/DECLINED.md`, as fingerprints or a refusal.
 *
 * A missing file is an empty set, not a refusal: nothing declined yet is the state every repository starts in. Any other
 * read error refuses, since a fire that can't tell what was already declined must not guess.
 * No page limit, so no truncation arm. On the forge a page-filling response looked complete, and answering anyway put
 * declined findings back in front of the user forever. A local file can't express that.
 * @param {string} dir
 * @returns {{ok: true, fingerprints: Set<string>}
 *   | {ok: false, reason: string, detail: string, hint: string}} */
function readDeclines(dir) {
  const file = join(dir, '.planning', 'DECLINED.md');
  let text;
  try { text = readFileSync(file, 'utf8'); } catch (e) {
    // ENOENT alone isn't absence: a dangling symlink reads it too, and every decline behind that link would resurface.
    const absent = /** @type {any} */ (e)?.code === 'ENOENT' && !entryExists(file);
    if (absent) return { ok: true, fingerprints: new Set() };
    return { ok: false, reason: 'declines-unreadable',
      detail: `${file}: ${redactUrl(e && e.message ? e.message : String(e))}`,
      hint: 'this fire cannot tell which findings were already declined, so it refuses rather '
        + 'than re-asking about them: make that file readable - a wrong mode and a dangling '
        + 'symlink are the two common answers - then re-run this step; nothing has been filed '
        + 'and no finding is lost' };
  }
  // A conflicted record is an untrustworthy one, not a partial one. The grammar skips any non-row line, which is right for
  // a human note and wrong for a row a merge damaged: the fingerprint silently leaves the set and the gate re-asks. Conflict
  // markers are the one damage shape that's unambiguous, so they refuse. A row mangled any other way is still skipped.
  if (/^(<{7}|={7}|>{7})(\s|$)/m.test(text)) {
    return { ok: false, reason: 'declines-conflicted',
      detail: `${file} holds git conflict markers, so its rows cannot be trusted`,
      hint: 'resolve the conflict in that file - every `- ` row from BOTH sides is wanted, '
        + 'the record is append-only and a row on either side is a question somebody already '
        + 'answered - then re-run this step; nothing has been filed and no finding is lost' };
  }
  return { ok: true, fingerprints: new Set(parseDeclinedRows(text).map((r) => r.fingerprint)) };
}

/** The FILED.md ledger, keyed by fingerprint, or a refusal.
 *
 * Same posture as readDeclines, one file over: absent with no entry is an empty ledger, and any other read error, a
 * dangling symlink or git conflict markers refuse, because guessing here means a second issue for a finding that has one.
 * The reasons are its own tokens so a refusal names the file the operator has to fix.
 * It's not the decline set and never gates the ask: it's read on the `file` face only, as the fallback for a lookup that
 * couldn't run and as the standing answer for a create nobody could confirm.
 * One entry per fingerprint. Two rows for one collapse to the first, except an `unconfirmed` row anywhere wins: losing
 * that marker to an older confirmed row is how the retry files the duplicate.
 * @param {string} dir
 * @returns {{ok: true, rows: Map<string, {date: string, unconfirmed: boolean}>}
 *   | {ok: false, reason: string, detail: string, hint: string}} */
function readFiled(dir) {
  const file = join(dir, '.planning', 'FILED.md');
  let text;
  try { text = readFileSync(file, 'utf8'); } catch (e) {
    const absent = /** @type {any} */ (e)?.code === 'ENOENT' && !entryExists(file);
    if (absent) return { ok: true, rows: new Map() };
    return { ok: false, reason: 'filed-unreadable',
      detail: `${file}: ${redactUrl(e && e.message ? e.message : String(e))}`,
      hint: 'this fire cannot tell which findings it already filed, so it refuses rather than '
        + 'risking a second issue for one of them: make that file readable - a wrong mode and '
        + 'a dangling symlink are the two common answers - then re-run this step; nothing has '
        + 'been filed and no finding is lost' };
  }
  if (/^(<{7}|={7}|>{7})(\s|$)/m.test(text)) {
    return { ok: false, reason: 'filed-conflicted',
      detail: `${file} holds git conflict markers, so its rows cannot be trusted`,
      hint: 'resolve the conflict in that file - every `- ` row from BOTH sides is wanted, the '
        + 'record is append-only and a row on either side points at an issue that exists - '
        + 'then re-run this step; nothing has been filed and no finding is lost' };
  }
  /** @type {Map<string, {date: string, unconfirmed: boolean}>} */
  const rows = new Map();
  for (const r of parseFiledRows(text)) {
    if (rows.has(r.fingerprint) && r.unconfirmed !== true) continue;
    rows.set(r.fingerprint, { date: r.date, unconfirmed: r.unconfirmed === true });
  }
  return { ok: true, rows };
}

/** Does the path exist as an entry, whatever it points at? lstat never follows, so a dangling symlink answers true and a
 * genuinely absent path false. Any other stat error counts as existing: the caller is on its refusal arm already, and
 * "can't tell" shouldn't read as "nothing was declined". @param {string} file */
function entryExists(file) {
  try { lstatSync(file); return true; } catch (e) {
    return /** @type {any} */ (e)?.code !== 'ENOENT';
  }
}

/**
 * `unfixed --payload <file>` - the findings this fire should put to the user.
 * The selection is filing-decision's, off the structured payload alone. This face only adds what that module can't know:
 * the entries already declined, read off DECLINED.md.
 * @param {string} dir @param {string} payloadFile
 */
function cmdUnfixed(dir, payloadFile) {
  const payload = readPayload(payloadFile);
  if (payload.ok === false) {
    emit({ ok: false, reason: payload.reason, detail: payload.detail,
      hint: payload.hint, warnings: [] });
    return;
  }

  // Judged before the forge is touched: an unreadable payload isn't a tracker problem and shouldn't cost a network call.
  const selected = unfixedFindings(payload.value);
  if (selected.ok === false) {
    emit({ ok: false, reason: 'bad-payload', warnings: [],
      detail: `the adjudication payload is not readable: ${selected.detail}`,
      hint: 'fix the payload at the entry the detail names and re-run - this is the same '
        + 'grammar `planning.mjs adjudication --payload` reads, so a payload that seam '
        + 'accepts is one this seam accepts' });
    return;
  }

  // An entry whose fix is already committed isn't a question for the user, and filing-decision decides that: `unfixedFindings`
  // reads the commit itself, so what it returns is already the set to ask about. This face used to re-filter and spelled
  // "genuinely unfixed" in two places. It happens before the forge is touched, so an all-fixed fire spends no network call.

  // The decline set is a local file, so it's read before the forge is resolved: an all-declined fire costs nothing to find out.
  const declines = readDeclines(dir);
  if (declines.ok === false) {
    emit({ ok: false, reason: declines.reason, detail: declines.detail,
      hint: declines.hint, warnings: [] });
    return;
  }

  const forge = resolveForge(dir);
  if (forge.ok === false) {
    emit({ ok: false, reason: forge.reason, detail: forge.detail,
      hint: forge.hint, warnings: forge.warnings });
    return;
  }

  // The one forge call this face makes: where the issue would go and who could read it. Read-only, once per call, never
  // per finding. Only the fixed vocabulary and whether it was read ride the envelope. A row with no query, a nonzero exit,
  // a timeout kill and unreadable stdout all answer public, not read.
  const asked = forge.row.visibility
    ? run(forge.bin, forge.row.visibility(forge.repo, forge.login),
      { cwd: dir, timeout: VISIBILITY_TIMEOUT_MS })
    : { ok: false, stdout: '' };
  const { visibility, read: visibilityRead } = asked.ok
    ? normalizeVisibility(asked.stdout) : { visibility: 'public', read: false };

  // The fingerprint rides beside the finding: findingIssue in adjudication-record.mjs refuses any key outside FINDING_KEYS.
  const findings = selected.findings
    .map((finding) => ({ fingerprint: fingerprint(finding), finding }))
    .filter((e) => !declines.fingerprints.has(e.fingerprint));

  // Three numbers, each counting one thing. `raised` is the size of what unfixedFindings returned and `already_declined`
  // counts declines alone, so neither changes meaning. `already_fixed` counts what this face dropped for naming a commit,
  // which is now none: the module removes those first. The key stays at zero so an envelope reader learns no new shape,
  // and raised - already_fixed - already_declined is still findings.length.
  emit({ ok: true, provider: forge.provider, repo: forge.repo,
    visibility, visibility_read: visibilityRead,
    raised: selected.findings.length,
    already_fixed: 0,
    already_declined: selected.findings.length - findings.length,
    findings, detail: null, warnings: forge.warnings });
}

/**
 * Turn the confirmed row for `print` into an unconfirmed one in the text held under the lock, leaving every other byte alone.
 * The line is found by parsing it, never by a second copy of the row grammar: parseFiledRows over one line is the reader
 * that decided the row was there. The substitution is the first ` <print>: ` in that line, the grammar's own position,
 * because the fields before it hold no spaces and anything imitating it sits in the title, after.
 *
 * @param {string} text @param {string} print @returns {string}
 */
function markUnconfirmed(text, print) {
  const lines = text.split('\n');
  const at = lines.findIndex((line) => {
    const [row] = parseFiledRows(line);
    return Boolean(row) && row.fingerprint === print && row.unconfirmed !== true;
  });
  if (at < 0) return text;
  lines[at] = lines[at].replace(`${print}: `, `${print} unconfirmed: `);
  return lines.join('\n');
}

/**
 * Mirror the batch into its two records, or say why not: accepted filings into FILED.md, declined ones into DECLINED.md.
 * Two files because they mean opposite things and only FILED.md belongs in the recall corpus; a declined title there
 * would put a closed question back in front of `/cad-plan`. The decline row is the dedup key readDeclines reads, so a
 * failed write refuses rather than passing quietly.
 * One locked read-modify-write per file, through the guard capture-file.mjs exports: reading outside the lock is the lost
 * update, where two writers append to the same bytes and the second rename erases the first's rows.
 * One row per fingerprint in FILED.md, checked before the appender runs because it refuses by returning its input
 * unchanged. Two fires once left two rows and a duplicate issue (`#241` and `#242`, four seconds apart).
 * An unconfirmed entry landing on a confirmed row rewrites it in place: skipping would swallow the marker, and the retry
 * would file the same issue again.
 *
 * @param {string} dir @param {string} provider @param {string} repo
 * @param {Array<{fingerprint: string, disposition: string, title: string,
 *   unconfirmed?: boolean}>} filed
 * @returns {{ok: true} | {ok: false, reason: string, detail: string}}
 */
function mirrorFiled(dir, provider, repo, filed) {
  const date = new Date().toISOString().slice(0, 10);
  for (const arm of [
    { name: 'FILED.md', want: 'accept', append: appendFiledRow, lock: 'filed-locked', dedup: true },
    { name: 'DECLINED.md', want: 'decline', append: appendDeclinedRow, lock: 'declined-locked', dedup: false },
  ]) {
    const rows = filed.filter((f) => f.disposition === arm.want);
    if (!rows.length) continue;
    const file = join(dir, '.planning', arm.name);
    try {
      // Before the lock: the lock is a sibling of the target, so its exclusive create and atomicWrite's rename need the directory.
      mkdirSync(join(dir, '.planning'), { recursive: true });
      const guarded = withPlanningFileLock(file, () => {
        // An unreadable file isn't an empty one: this once caught every read error into `text = ''` and the write erased the rows.
        let text = '';
        try { text = readFileSync(file, 'utf8'); } catch (e) {
          if (/** @type {any} */ (e)?.code !== 'ENOENT') throw e;
        }
        for (const row of rows) {
          if (arm.dedup) {
            // Re-read per row: an earlier row in this batch may already have landed this fingerprint.
            const held = parseFiledRows(text).find((r) => r.fingerprint === row.fingerprint);
            if (held) {
              if (row.unconfirmed === true && held.unconfirmed !== true) {
                text = markUnconfirmed(text, row.fingerprint);
              }
              continue;
            }
          }
          const before = text;
          text = arm.append(text, { date, provider, slug: repo,
            fingerprint: row.fingerprint, title: row.title,
            ...(row.unconfirmed === true ? { unconfirmed: true } : {}) });
          // The appender refuses by returning the text unchanged, so a rejected row would otherwise still report recorded.
          if (text === before) {
            throw new Error(`the row for ${row.fingerprint} does not fit ${arm.name}'s grammar `
              + `and was not written (slug ${JSON.stringify(repo)})`);
          }
        }
        atomicWrite(file, text);
      }, arm.lock);
      if (guarded.ok === false) {
        return { ok: false, reason: guarded.reason, detail: guarded.detail };
      }
    } catch (e) {
      return { ok: false, reason: 'write-failed',
        detail: `${file}: ${e && e.message ? e.message : String(e)}` };
    }
  }
  return { ok: true };
}

/**
 * The dispositions payload's grammar, checked before the first create.
 * findingIssue from adjudication-record.mjs isn't reused: it refuses any key outside FINDING_KEYS, and the findings this
 * face gets are `unfixed`'s own answer, which carries `voice`, `model`, `ruling` and `convergent` beside them. Using it
 * would refuse this seam's own output. A filing only needs a `file` and a `claim`, the pair the fingerprint is built from.
 *
 * @param {unknown} value
 * @returns {{ok: true, entries: Array<{finding: any, disposition: string}>}
 *   | {ok: false, detail: string}}
 */
function readDispositions(value) {
  /** @param {string} detail @returns {{ok: false, detail: string}} */
  const bad = (detail) => ({ ok: false, detail });
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return bad('payload is not a JSON object');
  }
  const entries = /** @type {any} */ (value).entries;
  if (!Array.isArray(entries)) {
    return bad('payload.entries must be an array - one {finding, disposition} per answer');
  }
  for (let i = 0; i < entries.length; i += 1) {
    const e = entries[i];
    const at = `entries[${i}]`;
    if (!e || typeof e !== 'object' || Array.isArray(e)) return bad(`${at} is not an object`);
    if (e.disposition !== 'accept' && e.disposition !== 'decline') {
      return bad(`${at}.disposition must be "accept" or "decline", got ${JSON.stringify(e.disposition)}`);
    }
    const f = e.finding;
    if (!f || typeof f !== 'object' || Array.isArray(f)) {
      return bad(`${at}.finding is not an object`);
    }
    for (const key of ['file', 'claim']) {
      if (typeof f[key] !== 'string' || !f[key].trim()) {
        return bad(`${at}.finding.${key} must be a non-blank string - it is half the fingerprint`);
      }
    }
  }
  return { ok: true, entries };
}

/**
 * Ask the forge which of these fingerprints a title already carries, one query per chunk of `LOOKUP_CHUNK`, and answer
 * per fingerprint: a chunk whose child came back clean keeps its answer even when a sibling's didn't, so one failure
 * can't throw away an answer the forge gave and re-file an issue this call just found.
 * Each ends answered with a `number` (hit), answered with `number` null (the tracker looked and doesn't hold it), or
 * unanswered (no child came back, so only the local ledger can speak for it).
 * An incomplete answer refuses the whole fire, before any create. A page-filling response to a query naming at most
 * `LOOKUP_CHUNK` tokens is a truncated page or a forge that ignored the search, and reading either as "not filed" is the duplicate.
 *
 * @param {string} dir @param {any} forge @param {string[]} fingerprints distinct
 * @returns {{ok: true, answers: Map<string, {answered: boolean, number: number|null}>}
 *   | {ok: false, reason: string, detail: string, hint: string}}
 */
function lookupFiled(dir, forge, fingerprints) {
  /** @type {Map<string, {answered: boolean, number: number|null}>} */
  const answers = new Map();
  for (let i = 0; i < fingerprints.length; i += LOOKUP_CHUNK) {
    const chunk = fingerprints.slice(i, i + LOOKUP_CHUNK);
    const call = run(forge.bin,
      forge.row.lookup(forge.repo, forge.row.limit, chunk, forge.login),
      { cwd: dir, timeout: LOOKUP_TIMEOUT_MS });
    if (!call.ok) {
      // Not a refusal: an offline forge that refused every fire would be a gate nobody can get past, so the ledger is the fallback.
      for (const fp of chunk) answers.set(fp, { answered: false, number: null });
      continue;
    }
    const read = normalizeLookup(call.stdout, forge.row.limit, forge.row.numberKey);
    if (!read.complete) {
      return { ok: false, reason: 'incomplete-lookup',
        detail: `the title-scoped lookup on ${forge.repo} came back incomplete: ${read.detail}`,
        hint: 'NOTHING has been filed and no finding is lost. A page-filling answer to a '
          + `search naming at most ${LOOKUP_CHUNK} tokens is one of two things - a truncated `
          + 'page, or a forge that did not apply the search at all and listed the tracker - '
          + `and re-filing on either would duplicate an issue that already exists. Run \`${forge.bin}\` `
          + 'yourself in this directory with that same search to see which it is, then re-run '
          + 'this step' };
    }
    const hits = new Map(read.records.map((r) => [r.fingerprint, r.number]));
    for (const fp of chunk) {
      answers.set(fp, { answered: true, number: hits.has(fp) ? hits.get(fp) : null });
    }
  }
  return { ok: true, answers };
}

/**
 * `file --payload <file>` - one issue per accepted entry, and a DECLINED.md row per declined one.
 * Stops at the first failure and names both halves. A batch of forge creates can't be atomic, so the honest shape is to
 * say exactly which findings are on the tracker and which aren't, not a count.
 * @param {string} dir @param {string} payloadFile
 */
function cmdFile(dir, payloadFile) {
  const payload = readPayload(payloadFile);
  if (payload.ok === false) {
    emit({ ok: false, reason: payload.reason, detail: payload.detail,
      hint: payload.hint, warnings: [] });
    return;
  }

  const read = readDispositions(payload.value);
  if (read.ok === false) {
    emit({ ok: false, reason: 'bad-payload', warnings: [],
      detail: `the dispositions payload is not readable: ${read.detail}`,
      hint: 'send {"entries": [{"finding": {...}, "disposition": "accept"|"decline"}, ...]} - '
        + "the findings are `unfixed`'s own answer and the disposition is what the user chose" });
    return;
  }

  // One fingerprint, one entry, decided before anything else looks at the set. First occurrence wins, so the lookup, the
  // loop, `filed`, `unfiled` and every count run over the collapsed set. Not in readDispositions, which validates shape,
  // and not in the tracker path, which can't see it: two identical entries in one fire are one query and one answer, and
  // the second's create would run before any lookup could learn of the first (`#241` and `#242` fit that as well as a retry).
  const entries = [];
  const seenPrints = new Set();
  for (const e of read.entries) {
    const print = fingerprint(e.finding);
    if (seenPrints.has(print)) continue;
    seenPrints.add(print);
    entries.push(e);
  }

  // Read before the forge is resolved so a refusal it raises precedes every child this fire would spawn, as in cmdUnfixed.
  // Only a fire with an accept reads it; a decline never consults what was filed.
  /** @type {Map<string, {date: string, unconfirmed: boolean}>} */
  let ledger = new Map();
  const hasAccept = entries.some((e) => e.disposition === 'accept');
  if (hasAccept) {
    const filedRows = readFiled(dir);
    if (filedRows.ok === false) {
      emit({ ok: false, reason: filedRows.reason, detail: filedRows.detail,
        hint: filedRows.hint, warnings: [] });
      return;
    }
    ledger = filedRows.rows;
  }

  const forge = resolveForge(dir);
  if (forge.ok === false) {
    emit({ ok: false, reason: forge.reason, detail: forge.detail,
      hint: forge.hint, warnings: forge.warnings });
    return;
  }

  // The tracker is asked once, before the first create, and only when there's an accept to ask about: a fire of declines
  // alone touches no forge. DECLINED.md is never read on this face, since a decline gates the ask and never the create.
  /** @type {Map<string, {answered: boolean, number: number|null}>} */
  let answers = new Map();
  const acceptPrints = [...new Set(entries
    .filter((e) => e.disposition === 'accept')
    .map((e) => fingerprint(e.finding)))];
  if (acceptPrints.length) {
    const looked = lookupFiled(dir, forge, acceptPrints);
    if (looked.ok === false) {
      emit({ ok: false, reason: looked.reason, provider: forge.provider, repo: forge.repo,
        detail: looked.detail, hint: looked.hint, warnings: forge.warnings });
      return;
    }
    answers = looked.answers;
  }

  /** @type {Array<{fingerprint: string, disposition: string, title: string}>} */
  const filed = [];
  // An accept the tracker already holds is reported by number, with no create and no FILED.md row: the row would point at
  // an issue this fire didn't file, and that file is the record of what this repo's gates opened.
  /** @type {Array<{fingerprint: string, disposition: string, title: string,
   *   issue: number|null, authority: string, filed_on: string|null}>} */
  const suppressed = [];
  // Set when a confirmed ledger row answered instead of the tracker, so the envelope says the local file stood in.
  let ledgerStoodIn = false;
  for (let i = 0; i < entries.length; i += 1) {
    const { finding, disposition } = entries[i];
    const title = issueTitle(finding);
    const print = fingerprint(finding);
    // A decline never touches the forge. It used to be a labelled issue because that was the only place a decline
    // persisted. The DECLINED.md row is that place now, and filing it too would publish every refusal and keep the
    // dedup key in two places that can disagree.
    if (disposition === 'decline') {
      filed.push({ fingerprint: print, disposition, title });
      continue;
    }
    // Precedence, in this order:
    // 1. An unconfirmed row suppresses whatever the tracker said. It exists because the index couldn't be trusted for
    //    this fingerprint (the duplicate landed four seconds after its twin), so a miss is the case it was written for.
    //    The number is still reported if the lookup returned one.
    // 2. Otherwise a completed lookup is final, but a miss only where the lookup argv was measured. A hit suppresses
    //    everywhere. On github a miss creates even over a confirmed row, so ledger rows whose issues were deleted become
    //    re-fileable. On forgejo and gitlab the query is an assumption (each space-joins tokens and a phrase read returns
    //    nothing for an issue that exists), so a confirmed row still suppresses.
    // 3. Otherwise the lookup couldn't run and a confirmed row stands in. With no row the fire creates: an offline forge
    //    that suppressed everything would drop findings.
    const answer = answers.get(print);
    const known = answer && answer.answered ? answer.number : null;
    const held = ledger.get(print);
    if (held && held.unconfirmed) {
      suppressed.push({ fingerprint: print, disposition, title,
        issue: known, authority: 'FILED.md', filed_on: held.date });
      continue;
    }
    if (answer && answer.answered) {
      if (known !== null) {
        suppressed.push({ fingerprint: print, disposition, title,
          issue: known, authority: 'tracker', filed_on: null });
        continue;
      }
      // A miss is only as good as the query behind it: lookupMeasured is false where the search is assumed, and there the ledger keeps the last word.
      if (held && forge.row.lookupMeasured !== true) {
        ledgerStoodIn = true;
        suppressed.push({ fingerprint: print, disposition, title,
          issue: null, authority: 'FILED.md', filed_on: held.date });
        continue;
      }
    } else if (held) {
      ledgerStoodIn = true;
      suppressed.push({ fingerprint: print, disposition, title,
        issue: null, authority: 'FILED.md', filed_on: held.date });
      continue;
    }
    const argv = forge.row.create(forge.repo, {
      title, body: issueBody(finding), declined: false,
    }, forge.login);
    if (!run(forge.bin, argv, { cwd: dir, timeout: CREATE_TIMEOUT_MS }).ok) {
      const unfiled = entries.slice(i).map((e) => ({
        fingerprint: fingerprint(e.finding),
        disposition: e.disposition,
        title: issueTitle(e.finding),
      }));
      // The mirror runs before the refusal is emitted: the issues that did land are on the tracker, and a recall pointer
      // they never got is a second loss. Its answer rides the envelope, since a discarded refusal would call these
      // entries `filed` while a created issue has no FILED.md row, so recall never finds it and the retry never revisits it.
      // A nonzero create is ambiguous, and recorded as such rather than dropped. run folds a refusal, a SIGKILL on our own
      // bound and a transport failure into one {ok: false}, and the last two are where the forge created the issue anyway.
      // So the entry rides the mirror flagged `unconfirmed`, and the retry suppresses on that row without asking anybody.
      // A lookup alone can't cover it: the duplicate landed four seconds after its twin, and index freshness isn't
      // measurable read-only. A row is local, so it has no index and no latency. A human who finds the issue deletes the
      // marker, and one who finds nothing deletes the row.
      const failed = unfiled[0].fingerprint;
      const mirror = mirrorFiled(dir, forge.provider, forge.repo,
        [...filed, { fingerprint: print, disposition, title, unconfirmed: true }]);
      const retry = `run \`${forge.bin}\` yourself in this directory to see why. The create for `
        + `${failed} is AMBIGUOUS rather than known-failed: a timeout, a kill on this step's `
        + 'own bound and a dropped connection all look here exactly like a refusal, and the '
        + `forge may have created that issue anyway. You do not have to resolve that by hand: `
        + `${failed} now has an \`unconfirmed\` row in .planning/FILED.md, and this seam asks `
        + `${forge.repo} for the titles carrying a fire's own fingerprints before it creates `
        + 'anything. So re-run this step with ONLY the unfiled entries this envelope names - '
        + 'the row and the lookup between them suppress the duplicate, and they are still in '
        + 'hand, so none of them is lost.';
      // Only when the mirror also failed: a hint that always warns about the recall pointer teaches the reader to skip it.
      const lostPointer = mirror.ok === false
        ? ` AND the recall pointer was NOT written (${mirror.reason}: ${mirror.detail}), so the `
          + `${filed.length} entries this envelope lists as \`filed\` are on ${forge.repo} with `
          + 'NOTHING in .planning/FILED.md pointing at them, and the ambiguous one got no '
          + `\`unconfirmed\` row either - so re-running is NOT safe until this is fixed. Fix `
          + 'the write that detail names (a stale .planning/FILED.md.lock is the usual answer) '
          + 'and add one `- ` row per ACCEPTED filed entry by hand, plus one carrying '
          + `\`${failed} unconfirmed:\` for the ambiguous one. Do not re-file them - they `
          + 'already exist.'
        : '';
      emit({ ok: false, reason: 'create-failed', provider: forge.provider, repo: forge.repo,
        filed, unfiled, suppressed, ledger_stood_in: ledgerStoodIn,
        warnings: forge.warnings,
        mirrored: mirror.ok === true,
        mirror_reason: mirror.ok === false ? mirror.reason : null,
        mirror_detail: mirror.ok === false ? mirror.detail : null,
        detail: `${forge.bin} could not create the issue for ${unfiled[0].fingerprint} on `
          + `${forge.repo}: ${filed.length} of ${entries.length} were filed and `
          + `${unfiled.length} were not`
          + (suppressed.length
            ? `, and ${suppressed.length} were already on ${forge.repo} and not filed again`
            : ''),
        hint: retry + lostPointer });
      return;
    }
    filed.push({ fingerprint: print, disposition, title });
  }

  const mirror = mirrorFiled(dir, forge.provider, forge.repo, filed);
  if (mirror.ok === false) {
    // Every issue exists but the recall pointer doesn't, and that's not a success: that file is how /cad-plan's recall reaches a finding.
    emit({ ok: false, reason: mirror.reason, provider: forge.provider, repo: forge.repo,
      filed, warnings: forge.warnings,
      detail: `every issue was created on ${forge.repo}, but the recall pointer could `
        + `not be written: ${mirror.detail}`,
      hint: 'the issues are FILED and must not be filed again - fix the write the detail '
        + 'names (a stale .planning/FILED.md.lock is the usual answer) and add one `- ` '
        + 'row per accepted issue to .planning/FILED.md by hand, or re-run only the '
        + 'mirror once the path is writable' });
    return;
  }

  emit({ ok: true, provider: forge.provider, repo: forge.repo,
    filed, suppressed, ledger_stood_in: ledgerStoodIn,
    accepted: filed.filter((f) => f.disposition === 'accept').length,
    declined: filed.filter((f) => f.disposition === 'decline').length,
    suppressed_count: suppressed.length,
    detail: null, warnings: forge.warnings });
}

const argv = process.argv.slice(2);
const cmd = argv[0];

const ROWS = CONTRACTS['issue-filing.mjs'];

/** Each flag read through its declared row, as forge.mjs does: a refusal raises and the catch arm below publishes it on one line. */
const arg = (sub, name) => requireFlag(argv, name, ROWS[sub][name] || ROWS['*'][name]);

try {
  if (cmd === 'unfixed' || cmd === 'file') {
    const dir = arg(cmd, '--dir') || process.cwd();
    const payload = arg(cmd, '--payload');
    if (cmd === 'unfixed') cmdUnfixed(dir, payload);
    else cmdFile(dir, payload);
  } else {
    emit({ ok: false, reason: 'usage',
      detail: 'subcommands: unfixed --payload <file> [--dir <path>] | '
        + 'file --payload <file> [--dir <path>]' });
  }
} catch (e) {
  if (e && e.seam) {
    emit({ ok: false, reason: e.seam, detail: e.detail,
      hint: 'the detail names the flag that refused - give it a value of the kind that flag takes and re-run the command' });
  } else {
    emit({ ok: false, reason: 'internal', detail: redactUrl(e && e.message ? e.message : String(e)) });
  }
}
