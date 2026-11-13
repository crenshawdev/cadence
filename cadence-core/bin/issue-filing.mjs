#!/usr/bin/env node
// @ts-check
// issue-filing.mjs - the seam over lib/filing-decision.mjs for a gate that won't fix a finding now.
// `unfixed` says what to ask about; `file` writes the answers: accepts to the tracker, declines to DECLINED.md.
// One JSON line on stdout, and no byte of any child's output on an envelope.
// The payload rides a file, never a flag or stdin: it's a reviewer's free text with quotes and newlines.
// A decline stays local: as a forge issue it published every refusal on a tracker meant for real work.
'use strict';

import { lstatSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { boundedRun as run } from './lib/bounded-run.mjs';
import { mergeLayers } from './lib/config-merge.mjs';
import {
  atomicWrite, declinedPath, ensureRecordsDir, filedPath, makeDir, withPlanningFileLock,
} from './lib/planning-store.mjs';
import {
  appendDeclinedRow, appendFiledRow, parseDeclinedRows, parseFiledRows,
} from './lib/planning-files.mjs';
import { emit, emitCaught } from './lib/seam-io.mjs';
import { CONTRACTS, rowReader } from './lib/arg-contract.mjs';
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

/** A read, so shorter than a create: giving up on a slow query costs one unanswered chunk, which has an arm. */
const LOOKUP_TIMEOUT_MS = 30000;

/** Bounds the one visibility read the ask face makes; no answer reads the same as an unreadable one. */
const VISIBILITY_TIMEOUT_MS = 30000;

/** A create writes, so longer than a lookup, but still bounded: an unbounded child in a gate step hangs the run. */
const CREATE_TIMEOUT_MS = 60000;

/**
 * The persisted forge record, the row that drives it, the binary and the login it needs, or the one refusal that says
 * which is missing.
 *
 * mergeLayers warnings[]: the one merge in this file, shared by both faces, so `warnings` rides every envelope.
 *
 * Called before any spawn: an unconfigured forge, an uninstalled CLI and an unresolvable login are knowable up front,
 * and finding one out halfway through a batch leaves some issues filed and some not.
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

  // the forge record's own rule, so setup, the land report and this writer agree on what "configured" means
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
    // the persisted host turned into the login name `tea --login` wants (forge.mjs classifies an origin URL instead)
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
 * The path redacts on both arms, and so does the message: --payload is caller-supplied and stdout is the transcript,
 * so a path like `/tmp/cad:s3cr3t-tok@host.invalid/payload.json` would reach `detail` twice.
 * Each part is redacted on its own, since redacting the joined `path: message` could build a `user:secret@host` span
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

/** The filed ledger's path as a hint spells it, from the write module so the folder's name lives in one place. */
const FILED_AT = filedPath('.planning').split(sep).join('/');

/** The decline set, read off the DECLINED.md ledger under the records folder, as fingerprints or a refusal.
 *
 * A missing file is an empty set: nothing declined yet is how every repository starts. Any other read error refuses,
 * since a fire that can't tell what was already declined must not guess.
 * No page limit, so no truncation arm: a local file can't fill a page the way the forge did.
 * @param {string} dir
 * @returns {{ok: true, fingerprints: Set<string>}
 *   | {ok: false, reason: string, detail: string, hint: string}} */
function readDeclines(dir) {
  const got = readLedger(declinedPath(join(dir, '.planning')), {
    unreadable: { reason: 'declines-unreadable',
      hint: 'this fire cannot tell which findings were already declined, so it refuses rather '
        + 'than re-asking about them: make that file readable - a wrong mode and a dangling '
        + 'symlink are the two common answers - then re-run this step; nothing has been filed '
        + 'and no finding is lost' },
    conflicted: { reason: 'declines-conflicted',
      hint: 'resolve the conflict in that file - every `- ` row from BOTH sides is wanted, '
        + 'the record is append-only and a row on either side is a question somebody already '
        + 'answered - then re-run this step; nothing has been filed and no finding is lost' },
  });
  if (got.ok === false) return got;
  return { ok: true, fingerprints: new Set(got.text === null ? [] : parseDeclinedRows(got.text).map((r) => r.fingerprint)) };
}

/** One ledger file's text, or a refusal: `text` is null for an absent file, so each reader owns what an empty ledger is.
 *
 * ENOENT alone isn't absence: a dangling symlink reads it too, and every row behind that link would resurface.
 * A conflicted record is untrustworthy, not partial: the grammar skips non-row lines, so a row a merge damaged would
 * silently leave the set; conflict markers are the one unambiguous damage, so they refuse.
 * @param {string} file
 * @param {{unreadable: {reason: string, hint: string}, conflicted: {reason: string, hint: string}}} refusals
 * @returns {{ok: true, text: string|null} | {ok: false, reason: string, detail: string, hint: string}} */
function readLedger(file, refusals) {
  let text;
  try { text = readFileSync(file, 'utf8'); } catch (e) {
    const absent = /** @type {any} */ (e)?.code === 'ENOENT' && !entryExists(file);
    if (absent) return { ok: true, text: null };
    return { ok: false, reason: refusals.unreadable.reason,
      detail: `${file}: ${redactUrl(e && e.message ? e.message : String(e))}`,
      hint: refusals.unreadable.hint };
  }
  if (/^(<{7}|={7}|>{7})(\s|$)/m.test(text)) {
    return { ok: false, reason: refusals.conflicted.reason,
      detail: `${file} holds git conflict markers, so its rows cannot be trusted`,
      hint: refusals.conflicted.hint };
  }
  return { ok: true, text };
}

/** The FILED.md ledger, keyed by fingerprint, or a refusal.
 *
 * Same posture as readDeclines: absent is an empty ledger, and any other read error, a dangling symlink or conflict
 * markers refuse, because guessing here means a second issue for a finding that has one.
 * It never gates the ask: it's read on the `file` face only, as the fallback for a lookup that couldn't run and the
 * standing answer for a create nobody could confirm.
 * Two rows for one fingerprint collapse to the first, except an `unconfirmed` row wins, or the retry files a duplicate.
 * @param {string} dir
 * @returns {{ok: true, rows: Map<string, {date: string, unconfirmed: boolean}>}
 *   | {ok: false, reason: string, detail: string, hint: string}} */
function readFiled(dir) {
  const got = readLedger(filedPath(join(dir, '.planning')), {
    unreadable: { reason: 'filed-unreadable',
      hint: 'this fire cannot tell which findings it already filed, so it refuses rather than '
        + 'risking a second issue for one of them: make that file readable - a wrong mode and '
        + 'a dangling symlink are the two common answers - then re-run this step; nothing has '
        + 'been filed and no finding is lost' },
    conflicted: { reason: 'filed-conflicted',
      hint: 'resolve the conflict in that file - every `- ` row from BOTH sides is wanted, the '
        + 'record is append-only and a row on either side points at an issue that exists - '
        + 'then re-run this step; nothing has been filed and no finding is lost' },
  });
  if (got.ok === false) return got;
  /** @type {Map<string, {date: string, unconfirmed: boolean}>} */
  const rows = new Map();
  for (const r of parseFiledRows(got.text ?? '')) {
    if (rows.has(r.fingerprint) && r.unconfirmed !== true) continue;
    rows.set(r.fingerprint, { date: r.date, unconfirmed: r.unconfirmed === true });
  }
  return { ok: true, rows };
}

/** Does the path exist as an entry, whatever it points at? lstat never follows, so a dangling symlink answers true.
 * Any other stat error counts as existing, since "can't tell" shouldn't read as "nothing was declined". @param {string} file */
function entryExists(file) {
  try { lstatSync(file); return true; } catch (e) {
    return /** @type {any} */ (e)?.code !== 'ENOENT';
  }
}

/**
 * A refusal an inner step returned, emitted as this face's one envelope: its reason, detail and hint as they came,
 * then the warnings the forge resolution collected so far.
 * @param {{reason: string, detail: string, hint: string}} x @param {string[]} warnings
 */
function forwardRefusal(x, warnings) {
  emit({ ok: false, reason: x.reason, detail: x.detail, hint: x.hint, warnings });
}

/**
 * `unfixed --payload <file>` - the findings this fire should put to the user.
 * The selection is filing-decision's, off the payload alone; this face adds the entries already declined.
 * @param {string} dir @param {string} payloadFile
 */
function cmdUnfixed(dir, payloadFile) {
  const payload = readPayload(payloadFile);
  if (payload.ok === false) {
    forwardRefusal(payload, []);
    return;
  }

  // judged before the forge is touched: an unreadable payload isn't a tracker problem and shouldn't cost a network call
  const selected = unfixedFindings(payload.value);
  if (selected.ok === false) {
    emit({ ok: false, reason: 'bad-payload', warnings: [],
      detail: `the adjudication payload is not readable: ${selected.detail}`,
      hint: 'fix the payload at the entry the detail names and re-run - this is the same '
        + 'grammar `planning.mjs adjudication --payload` reads, so a payload that seam '
        + 'accepts is one this seam accepts' });
    return;
  }

  // an entry whose fix is already committed isn't a question; `unfixedFindings` decides that, so don't re-filter here

  // the decline set is a local file, read before the forge is resolved: an all-declined fire costs nothing to find out
  const declines = readDeclines(dir);
  if (declines.ok === false) {
    forwardRefusal(declines, []);
    return;
  }

  const forge = resolveForge(dir);
  if (forge.ok === false) {
    forwardRefusal(forge, forge.warnings);
    return;
  }

  // the one forge call this face makes: where the issue would go and who could read it (once per call)
  // a row with no query, a nonzero exit, a timeout kill and unreadable stdout all answer public, not read
  const asked = forge.row.visibility
    ? run(forge.bin, forge.row.visibility(forge.repo, forge.login),
      { cwd: dir, timeout: VISIBILITY_TIMEOUT_MS })
    : { ok: false, stdout: '' };
  const { visibility, read: visibilityRead } = asked.ok
    ? normalizeVisibility(asked.stdout) : { visibility: 'public', read: false };

  // the fingerprint rides beside the finding because findingIssue in adjudication-record.mjs refuses unknown keys
  const findings = selected.findings
    .map((finding) => ({ fingerprint: fingerprint(finding), finding }))
    .filter((e) => !declines.fingerprints.has(e.fingerprint));

  // `already_fixed` is always zero now, since unfixedFindings removes those first; the key stays so the envelope keeps
  // its shape, and raised - already_fixed - already_declined is still findings.length
  emit({ ok: true, provider: forge.provider, repo: forge.repo,
    visibility, visibility_read: visibilityRead,
    raised: selected.findings.length,
    already_fixed: 0,
    already_declined: selected.findings.length - findings.length,
    findings, detail: null, warnings: forge.warnings });
}

/**
 * Turn the confirmed row for `print` into an unconfirmed one in the text held under the lock, leaving every other byte.
 * The line is found by parsing it, never by a second copy of the row grammar. The substitution is the first
 * ` <print>: ` in that line, because the fields before it hold no spaces and anything imitating it sits in the title.
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
 * Mirror the batch into its two records, or say why not: accepts into FILED.md, declines into DECLINED.md.
 * Two files because they mean opposite things and only FILED.md belongs in the recall corpus.
 * The decline row is the dedup key readDeclines reads, so a failed write refuses.
 * One locked read-modify-write per file: reading outside the lock is the lost update.
 * One row per fingerprint in FILED.md, checked before the appender runs; two fires once left a duplicate (#241, #242).
 * An unconfirmed entry on a confirmed row rewrites it in place, or the retry files the same issue again.
 *
 * @param {string} dir @param {string} provider @param {string} repo
 * @param {Array<{fingerprint: string, disposition: string, title: string,
 *   unconfirmed?: boolean}>} filed
 * @returns {{ok: true} | {ok: false, reason: string, detail: string}}
 */
function mirrorFiled(dir, provider, repo, filed) {
  const date = new Date().toISOString().slice(0, 10);
  for (const arm of [
    { name: 'FILED.md', pathOf: filedPath, want: 'accept', append: appendFiledRow, lock: 'filed-locked', dedup: true },
    { name: 'DECLINED.md', pathOf: declinedPath, want: 'decline', append: appendDeclinedRow, lock: 'declined-locked',
      dedup: false },
  ]) {
    const rows = filed.filter((f) => f.disposition === arm.want);
    if (!rows.length) continue;
    const file = arm.pathOf(join(dir, '.planning'));
    try {
      // before the lock: the lock is a sibling of the target, so its create and atomicWrite's rename need the directory
      makeDir(join(dir, '.planning'));
      const records = ensureRecordsDir(join(dir, '.planning'));
      if (!records.ok) {
        return { ok: false, reason: 'write-failed', detail: `${file}: the records folder is not usable (${records.reason})` };
      }
      const guarded = withPlanningFileLock(file, () => {
        // an unreadable file isn't an empty one: catching every read error into `text = ''` erased the rows on write
        let text = '';
        try { text = readFileSync(file, 'utf8'); } catch (e) {
          if (/** @type {any} */ (e)?.code !== 'ENOENT') throw e;
        }
        for (const row of rows) {
          if (arm.dedup) {
            // re-read per row: an earlier row in this batch may already have landed this fingerprint
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
          // the appender refuses by returning the text unchanged, so a rejected row would otherwise report recorded
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
 * findingIssue from adjudication-record.mjs isn't reused: it refuses unknown keys, and `unfixed`'s own answer carries
 * `voice`, `model`, `ruling` and `convergent`, so it would refuse this seam's own output.
 * A filing only needs a `file` and a `claim`, the pair the fingerprint is built from.
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
 * Ask the forge which of these fingerprints a title already carries, one query per `LOOKUP_CHUNK`, and answer per
 * fingerprint, so one failed chunk can't throw away an answer a clean one gave and re-file an issue this call found.
 * Each ends answered with a `number` (hit), answered with `number` null (not held), or unanswered (only the local
 * ledger can speak for it).
 * An incomplete answer refuses the whole fire, before any create: a page-filling response is a truncated page or a
 * forge that ignored the search, and reading either as "not filed" is the duplicate.
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
      // not a refusal: an offline forge refusing every fire would be a gate nobody passes, so fall back to the ledger
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
 * Read the payload into its entries: the file, the dispositions, then one entry per fingerprint.
 * Emits the refusal itself and answers `null` when there is no set to file.
 * @param {string} payloadFile
 * @returns {Array<{finding: any, disposition: string}>|null}
 */
function readEntries(payloadFile) {
  const payload = readPayload(payloadFile);
  if (payload.ok === false) {
    forwardRefusal(payload, []);
    return null;
  }

  const read = readDispositions(payload.value);
  if (read.ok === false) {
    emit({ ok: false, reason: 'bad-payload', warnings: [],
      detail: `the dispositions payload is not readable: ${read.detail}`,
      hint: 'send {"entries": [{"finding": {...}, "disposition": "accept"|"decline"}, ...]} - '
        + "the findings are `unfixed`'s own answer and the disposition is what the user chose" });
    return null;
  }

  // one fingerprint, one entry, first occurrence wins, decided before anything else looks at the set
  // the tracker path can't see it: the second identical entry's create would run before any lookup learned of the first
  const entries = [];
  const seenPrints = new Set();
  for (const e of read.entries) {
    const print = fingerprint(e.finding);
    if (seenPrints.has(print)) continue;
    seenPrints.add(print);
    entries.push(e);
  }
  return entries;
}

/**
 * The ledger, the forge and the tracker's answers a fire files against, all read before the first create.
 * Emits the refusal itself and answers `null` when any of them refuses.
 * @param {string} dir
 * @param {Array<{finding: any, disposition: string}>} entries
 * @returns {{forge: any, ledger: Map<string, {date: string, unconfirmed: boolean}>,
 *   answers: Map<string, {answered: boolean, number: number|null}>}|null}
 */
function prepareFiling(dir, entries) {
  // read before the forge is resolved so its refusal precedes every child this fire spawns; only an accept reads it
  /** @type {Map<string, {date: string, unconfirmed: boolean}>} */
  let ledger = new Map();
  const hasAccept = entries.some((e) => e.disposition === 'accept');
  if (hasAccept) {
    const filedRows = readFiled(dir);
    if (filedRows.ok === false) {
      forwardRefusal(filedRows, []);
      return null;
    }
    ledger = filedRows.rows;
  }

  const forge = resolveForge(dir);
  if (forge.ok === false) {
    forwardRefusal(forge, forge.warnings);
    return null;
  }

  // the tracker is asked once, before the first create, and only when there's an accept: declines alone touch no forge
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
      return null;
    }
    answers = looked.answers;
  }
  return { forge, ledger, answers };
}

/**
 * Whether an accepted entry is already on the tracker or in the ledger, so it is reported and not created; `null`
 * is a create. `ledgerStoodIn` is set when a confirmed ledger row answered instead of the tracker, so the envelope
 * says the local file stood in.
 * Pure: the same fingerprint, answer, row and forge always decide the same way.
 * @param {string} print
 * @param {{answered: boolean, number: number|null}|undefined} answer
 * @param {{date: string, unconfirmed: boolean}|undefined} held
 * @param {any} forge
 * @returns {{issue: number|null, authority: string, filed_on: string|null, ledgerStoodIn: boolean}|null}
 */
function suppressionFor(print, answer, held, forge) {
  // precedence, in this order:
  // 1. an unconfirmed row suppresses whatever the tracker said, since the index couldn't be trusted for it
  // 2. a completed lookup is final, but a miss only where the lookup argv was measured; a hit suppresses everywhere.
  //    On github a miss creates even over a confirmed row, so rows for deleted issues become re-fileable. On
  //    forgejo and gitlab the query is an assumption, so a confirmed row still suppresses
  // 3. the lookup couldn't run, so a confirmed row stands in; with no row the fire creates, or offline drops findings
  const known = answer && answer.answered ? answer.number : null;
  if (held && held.unconfirmed) {
    return { issue: known, authority: 'FILED.md', filed_on: held.date, ledgerStoodIn: false };
  }
  if (answer && answer.answered) {
    if (known !== null) {
      return { issue: known, authority: 'tracker', filed_on: null, ledgerStoodIn: false };
    }
    // a miss is only as good as its query: lookupMeasured is false where the search is assumed, so the ledger decides
    if (held && forge.row.lookupMeasured !== true) {
      return { issue: null, authority: 'FILED.md', filed_on: held.date, ledgerStoodIn: true };
    }
  } else if (held) {
    return { issue: null, authority: 'FILED.md', filed_on: held.date, ledgerStoodIn: true };
  }
  return null;
}

/**
 * The refusal for a create that failed: what is filed, what isn't, and the recall pointer the filed ones still get.
 * @param {string} dir @param {any} forge
 * @param {Array<{finding: any, disposition: string}>} entries
 * @param {number} i the entry whose create failed
 * @param {Array<{fingerprint: string, disposition: string, title: string}>} filed
 * @param {any[]} suppressed
 * @param {boolean} ledgerStoodIn
 */
function emitCreateFailed(dir, forge, entries, i, filed, suppressed, ledgerStoodIn) {
  const { finding, disposition } = entries[i];
  const unfiled = entries.slice(i).map((e) => ({
    fingerprint: fingerprint(e.finding),
    disposition: e.disposition,
    title: issueTitle(e.finding),
  }));
  // the mirror runs before the refusal is emitted: the issues that landed are on the tracker, and a recall pointer
  // they never got is a second loss; its answer rides the envelope so recall and the retry can find them
  // a nonzero create is ambiguous: a refusal, our own SIGKILL and a dropped connection are one {ok: false}, and the
  // last two are where the forge created the issue anyway, so the entry rides the mirror flagged `unconfirmed`
  // a lookup alone can't cover it, since index freshness isn't measurable read-only; a local row has no index
  const failed = unfiled[0].fingerprint;
  const mirror = mirrorFiled(dir, forge.provider, forge.repo,
    [...filed, { fingerprint: fingerprint(finding), disposition, title: issueTitle(finding), unconfirmed: true }]);
  const retry = `run \`${forge.bin}\` yourself in this directory to see why. The create for `
    + `${failed} is AMBIGUOUS rather than known-failed: a timeout, a kill on this step's `
    + 'own bound and a dropped connection all look here exactly like a refusal, and the '
    + `forge may have created that issue anyway. You do not have to resolve that by hand: `
    + `${failed} now has an \`unconfirmed\` row in ${FILED_AT}, and this seam asks `
    + `${forge.repo} for the titles carrying a fire's own fingerprints before it creates `
    + 'anything. So re-run this step with ONLY the unfiled entries this envelope names - '
    + 'the row and the lookup between them suppress the duplicate, and they are still in '
    + 'hand, so none of them is lost.';
  // only when the mirror also failed: a hint that always warns about the recall pointer teaches readers to skip it
  const lostPointer = mirror.ok === false
    ? ` AND the recall pointer was NOT written (${mirror.reason}: ${mirror.detail}), so the `
      + `${filed.length} entries this envelope lists as \`filed\` are on ${forge.repo} with `
      + `NOTHING in ${FILED_AT} pointing at them, and the ambiguous one got no `
      + `\`unconfirmed\` row either - so re-running is NOT safe until this is fixed. Fix `
      + `the write that detail names (a stale ${FILED_AT}.lock is the usual answer) `
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
}

/**
 * The filing loop: a decline is recorded, a suppressed accept is reported, and anything else is created on the forge.
 * Stops at the first failed create, emits its refusal and answers `null`.
 * @param {string} dir
 * @param {Array<{finding: any, disposition: string}>} entries
 * @param {{forge: any, ledger: Map<string, {date: string, unconfirmed: boolean}>,
 *   answers: Map<string, {answered: boolean, number: number|null}>}} prep
 */
function fileEntries(dir, entries, prep) {
  const { forge, ledger, answers } = prep;
  /** @type {Array<{fingerprint: string, disposition: string, title: string}>} */
  const filed = [];
  // an accept the tracker already holds is reported by number, with no create and no FILED.md row, since that file
  // records what this repo's gates opened
  /** @type {Array<{fingerprint: string, disposition: string, title: string,
   *   issue: number|null, authority: string, filed_on: string|null}>} */
  const suppressed = [];
  // set when a confirmed ledger row answered instead of the tracker, so the envelope says the local file stood in
  let ledgerStoodIn = false;
  for (let i = 0; i < entries.length; i += 1) {
    const { finding, disposition } = entries[i];
    const title = issueTitle(finding);
    const print = fingerprint(finding);
    // a decline never touches the forge: filing it too would publish every refusal and keep the dedup key in two places
    if (disposition === 'decline') {
      filed.push({ fingerprint: print, disposition, title });
      continue;
    }
    const skip = suppressionFor(print, answers.get(print), ledger.get(print), forge);
    if (skip) {
      if (skip.ledgerStoodIn) ledgerStoodIn = true;
      suppressed.push({ fingerprint: print, disposition, title,
        issue: skip.issue, authority: skip.authority, filed_on: skip.filed_on });
      continue;
    }
    const argv = forge.row.create(forge.repo, {
      title, body: issueBody(finding), declined: false,
    }, forge.login);
    if (!run(forge.bin, argv, { cwd: dir, timeout: CREATE_TIMEOUT_MS }).ok) {
      emitCreateFailed(dir, forge, entries, i, filed, suppressed, ledgerStoodIn);
      return null;
    }
    filed.push({ fingerprint: print, disposition, title });
  }
  return { filed, suppressed, ledgerStoodIn };
}

/**
 * `file --payload <file>` - one issue per accepted entry, and a DECLINED.md row per declined one.
 * Stops at the first failure and names both halves: a batch of forge creates can't be atomic, so say exactly which
 * findings are on the tracker and which aren't.
 * @param {string} dir @param {string} payloadFile
 */
function cmdFile(dir, payloadFile) {
  const entries = readEntries(payloadFile);
  if (entries === null) return;
  const prep = prepareFiling(dir, entries);
  if (prep === null) return;
  const outcome = fileEntries(dir, entries, prep);
  if (outcome === null) return;
  const { forge } = prep;
  const { filed, suppressed, ledgerStoodIn } = outcome;

  const mirror = mirrorFiled(dir, forge.provider, forge.repo, filed);
  if (mirror.ok === false) {
    // every issue exists but the recall pointer doesn't, which isn't success: /cad-plan's recall finds them through it
    emit({ ok: false, reason: mirror.reason, provider: forge.provider, repo: forge.repo,
      filed, warnings: forge.warnings,
      detail: `every issue was created on ${forge.repo}, but the recall pointer could `
        + `not be written: ${mirror.detail}`,
      hint: 'the issues are FILED and must not be filed again - fix the write the detail '
        + `names (a stale ${FILED_AT}.lock is the usual answer) and add one \`- \` `
        + `row per accepted issue to ${FILED_AT} by hand, or re-run only the `
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

/** Each flag read through its declared row, as forge.mjs does: a refusal raises and the catch below publishes it. */
const arg = rowReader(argv, ROWS);

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
  emitCaught(e, redactUrl);
}
