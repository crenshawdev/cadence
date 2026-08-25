#!/usr/bin/env node
// @ts-check
// issue-filing.mjs - the workflow-facing seam over lib/filing-decision.mjs
// (CAP-01, CAP-02): the two calls a gate makes when it will not fix a finding
// now. `unfixed` says what to ASK about; `file` writes what the user answered
// to this repository's own tracker.
//
// Modelled on bin/forge.mjs: exactly one JSON line on stdout through
// lib/seam-io.mjs's `emit`, every child spawned with its stderr DISCARDED at
// the spawn and bounded by an explicit timeout, and NO BYTE OF ANY CHILD'S
// OUTPUT ON ANY ENVELOPE (CONTEXT D-16). A forge CLI's stdout is read only by
// `normalizeDeclines`, which returns fixed phrases; nothing here slices it.
//
// THE PAYLOAD RIDES A FILE ON BOTH FACES, never an inline flag and never
// stdin. It is caller-derived free text - a reviewer's claim carries quotes,
// backticks, newlines and whatever else the model wrote - and
// `references/conventions.md` states the transport for exactly that class. It
// is the same rule `planning.mjs adjudication --payload` already follows, and
// `unfixed`'s payload is meant to be literally the same FILE the adjudication
// record was written from.
//
// WHY THE LOOKUP IS ONE CALL PER FIRE. The decline set is read with a single
// label-filtered `issue list`, whatever the finding count, and the fingerprints
// are matched in this process. A call per finding is the shape criterion 11
// forbids: it puts N round trips inside a gate step, and on the forgejo arm it
// would multiply a 50-row server clamp by N rather than seeing it once.
//
// AN INCOMPLETE LOOKUP REFUSES THE FIRE (criterion 12). A response that filled
// its page is NOT "nothing was declined": the decline set is bigger than the
// page and this seam cannot tell which of the fire's findings are in the part
// it did not see. Answering anyway puts findings the user already declined back
// in front of them, forever, which is the loop the decline label exists to end.
//
// AND A CREATE THAT DOES NOT LAND REFUSES, NAMING WHAT WAS NOT FILED
// (criterion 9). The batch stops at the first failure on the `runTransition`
// discipline, and both lists ride the refusal - a caller told "filed" about a
// finding that is not on the tracker has been told the wrong thing, and the
// finding it was told about is the one thing this phase may never drop.
'use strict';

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mergeLayers } from './lib/config-merge.mjs';
import { withPlanningFileLock } from './lib/capture-file.mjs';
import { appendFiledRow, atomicWrite } from './lib/planning-files.mjs';
import { emit } from './lib/seam-io.mjs';
import { CONTRACTS, requireFlag } from './lib/arg-contract.mjs';
import { redactUrl } from './lib/redact-url.mjs';
import { onPath } from './lib/on-path.mjs';
import { teaLoginNameForHost } from './lib/issue-decision.mjs';
import { PROVIDER_TABLE, missingForgeKeys } from './lib/forge-decision.mjs';
import {
  DECLINE_LABEL, FILING_TABLE, fingerprint, issueBody, issueTitle,
  normalizeDeclines, unfixedFindings,
} from './lib/filing-decision.mjs';

/** The bound on the login probe. Local config read on every arm that needs it. */
const LOGIN_TIMEOUT_MS = 10000;

/** The bound on the one decline lookup. A list call crosses the network once. */
const LOOKUP_TIMEOUT_MS = 30000;

/** The bound on one create. Longer than the lookup because a create WRITES, and
 * a forge that is slow to accept one is not the same failure as a forge that is
 * slow to answer a query - but bounded all the same: an unbounded child inside
 * a gate step hangs the run, which is the failure `-y` on the gitlab row and
 * `--body` on every row exist to prevent in the first place. */
const CREATE_TIMEOUT_MS = 60000;

/**
 * Run a child and say only whether it worked and what it printed on stdout.
 *
 * `stdio[2]` is `ignore` at the SPAWN, the discipline bin/forge.mjs and
 * bin/issue-check.mjs both state: a forge CLI's stderr is not this seam's to
 * read, to buffer or to put anywhere near an envelope.
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
 * The persisted forge record, the row that drives it, the binary that runs it
 * and the login it needs - or the ONE refusal that says which of those is
 * missing.
 *
 * mergeLayers warnings[]: the ONE merge in this file, shared by both faces, and
 * its `warnings` is destructured here and put on every envelope either face
 * emits. One callsite rather than two on purpose - the two faces read the same
 * three keys, and a second merge would be a second thing to keep surfacing.
 *
 * EVERY REFUSAL THAT CAN PRECEDE A CREATE DOES PRECEDE IT, which is what
 * bin/forge.mjs's `create` header states and the reason this resolution is one
 * function called before any spawn: an unconfigured forge, an uninstalled CLI
 * and an unresolvable login are all knowable without writing anything, and
 * finding one out half way through a batch means some issues exist and some do
 * not.
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

  // The forge record's OWN rule, imported rather than restated - the same
  // import lib/issue-decision.mjs makes, so setup, the land report and this
  // writer cannot disagree about what "configured" means.
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
    // The persisted host turned into the login NAME `tea --login` requires.
    // `teaLoginNameForHost` rather than a copy of bin/forge.mjs's `teaLoginFor`:
    // that one resolves a host by CLASSIFYING an origin URL and returns the
    // `{name, user}` pair its owner-vs-org question needs, where the host here
    // was confirmed by a human at setup and the only thing wanted is the name.
    // Both go through `loginNamesHost`, which is the rule that matters.
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
 * Read a JSON payload FILE, or the refusal that says why it could not be read.
 *
 * THE PATH REDACTS, on both arms, and so does the message. `--payload` is
 * caller-supplied argv and this seam's stdout IS its workflow transcript, so a
 * credential-bearing path - `/tmp/cad:s3cr3t-tok@host.invalid/payload.json` -
 * reaches `detail` twice over: once as the path this seam echoes back, and once
 * inside the message `readFileSync` quotes the path into. Both go through
 * `redactUrl`, which is the tree's one credential rule for a `detail` (D-14) and
 * the invariant `planning-lease-check.test.mjs`'s no-staged-set case pins.
 *
 * Each PART is redacted separately rather than the joined sentence, so the
 * `path: message` join cannot manufacture a `user:secret@host` span out of two
 * clean halves. What survives is what that test requires to survive: the host,
 * the path, and this seam's own wording.
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

/** The one label-filtered lookup, as either the fingerprint set or a refusal.
 * @param {string} dir @param {any} forge
 * @returns {{ok: true, fingerprints: Set<string>}
 *   | {ok: false, reason: string, detail: string, hint: string}} */
function readDeclines(dir, forge) {
  const call = run(forge.bin, forge.row.lookup(forge.repo, forge.row.limit, forge.login),
    { cwd: dir, timeout: LOOKUP_TIMEOUT_MS });
  if (!call.ok) {
    return { ok: false, reason: 'lookup-failed',
      detail: `${forge.bin} could not list the ${DECLINE_LABEL} issues on ${forge.repo}`,
      hint: `run \`${forge.bin}\` yourself in this directory to see why - an expired login and `
        + 'an unreachable host are the two common answers - then re-run this step; nothing '
        + 'has been filed and no finding is lost' };
  }
  const read = normalizeDeclines(call.stdout, forge.row.limit);
  if (!read.complete) {
    return { ok: false, reason: 'incomplete-lookup',
      detail: `the ${DECLINE_LABEL} lookup on ${forge.repo} came back incomplete: ${read.detail}`,
      hint: 'this fire cannot tell which findings were already declined, so it refuses rather '
        + 'than re-asking about them: close or re-label some ' + DECLINE_LABEL + ' issues on '
        + 'the tracker so the set fits one page, then re-run this step' };
  }
  return { ok: true, fingerprints: new Set(read.fingerprints) };
}

/**
 * `unfixed --payload <file>` - the findings this fire should PUT TO THE USER.
 *
 * The selection is lib/filing-decision.mjs's, off the structured payload alone;
 * what this face adds is the one lookup that removes the ones already declined.
 * @param {string} dir @param {string} payloadFile
 */
function cmdUnfixed(dir, payloadFile) {
  const payload = readPayload(payloadFile);
  if (payload.ok === false) {
    emit({ ok: false, reason: payload.reason, detail: payload.detail,
      hint: payload.hint, warnings: [] });
    return;
  }

  // The payload is judged BEFORE the forge is touched: an unreadable payload is
  // not a tracker problem and must not cost a network call to discover.
  const selected = unfixedFindings(payload.value);
  if (selected.ok === false) {
    emit({ ok: false, reason: 'bad-payload', warnings: [],
      detail: `the adjudication payload is not readable: ${selected.detail}`,
      hint: 'fix the payload at the entry the detail names and re-run - this is the same '
        + 'grammar `planning.mjs adjudication --payload` reads, so a payload that seam '
        + 'accepts is one this seam accepts' });
    return;
  }

  const forge = resolveForge(dir);
  if (forge.ok === false) {
    emit({ ok: false, reason: forge.reason, detail: forge.detail,
      hint: forge.hint, warnings: forge.warnings });
    return;
  }

  const declines = readDeclines(dir, forge);
  if (declines.ok === false) {
    emit({ ok: false, reason: declines.reason, detail: declines.detail,
      hint: declines.hint, warnings: forge.warnings });
    return;
  }

  // The disposition rides BESIDE the finding and the fingerprint does too:
  // `findingIssue` in lib/adjudication-record.mjs refuses any key outside
  // `FINDING_KEYS`, so a fingerprint written INTO a finding would make every
  // payload carrying it fail the record seam it came from.
  const findings = selected.findings
    .map((finding) => ({ fingerprint: fingerprint(finding), finding }))
    .filter((e) => !declines.fingerprints.has(e.fingerprint));

  emit({ ok: true, provider: forge.provider, repo: forge.repo,
    raised: selected.findings.length,
    already_declined: selected.findings.length - findings.length,
    findings, detail: null, warnings: forge.warnings });
}

/**
 * Mirror the ACCEPTED filings into `.planning/FILED.md`, or say why not.
 *
 * ACCEPTED ONLY, and that is criterion 1 rather than a filter for tidiness. A
 * declined finding's title written here would put it back inside the recall
 * corpus - the accumulation this phase removes, one indirection later. The
 * decline label on the forge is the only place a decline persists.
 *
 * ONE LOCKED READ-MODIFY-WRITE for the whole batch, through the guard
 * lib/capture-file.mjs exports for exactly this shape and the `atomicWrite` it
 * uses underneath. Reading outside the lock is the lost update it exists to
 * stop: two writers each read the same bytes, each append their own rows, and
 * the second rename erases the first one's.
 *
 * @param {string} dir @param {string} provider @param {string} repo
 * @param {Array<{fingerprint: string, disposition: string, title: string}>} filed
 * @returns {{ok: true} | {ok: false, reason: string, detail: string}}
 */
function mirrorFiled(dir, provider, repo, filed) {
  const rows = filed.filter((f) => f.disposition === 'accept');
  if (!rows.length) return { ok: true };
  const file = join(dir, '.planning', 'FILED.md');
  const date = new Date().toISOString().slice(0, 10);
  try {
    // Before the lock, because the LOCK is a sibling of the target and both its
    // exclusive create and `atomicWrite`'s sibling-temp rename need the parent
    // directory to be there.
    mkdirSync(join(dir, '.planning'), { recursive: true });
    const guarded = withPlanningFileLock(file, () => {
      let text = '';
      try { text = readFileSync(file, 'utf8'); } catch { text = ''; }
      for (const row of rows) {
        text = appendFiledRow(text, { date, provider, slug: repo,
          fingerprint: row.fingerprint, title: row.title });
      }
      atomicWrite(file, text);
    }, 'filed-locked');
    if (guarded.ok === false) {
      return { ok: false, reason: guarded.reason, detail: guarded.detail };
    }
  } catch (e) {
    return { ok: false, reason: 'write-failed',
      detail: `${file}: ${e && e.message ? e.message : String(e)}` };
  }
  return { ok: true };
}

/**
 * The dispositions payload's grammar, checked before the first create.
 *
 * `findingIssue` from lib/adjudication-record.mjs is deliberately NOT reused
 * here: it refuses any key outside `FINDING_KEYS`, and the findings this face
 * is handed are `unfixed`'s own answer, which carries `voice`, `model`,
 * `ruling` and `convergent` beside them. Validating with it would refuse this
 * seam's own output and break the round trip the two faces exist to make. What
 * a filing actually needs is what it asserts: a `file` and a `claim`, the pair
 * the fingerprint and the title are built from.
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
 * `file --payload <file>` - one issue per entry, the declined ones labelled.
 *
 * STOP AT THE FIRST FAILURE, on lib/file-transition.mjs's `runTransition`
 * discipline, and name both halves. There is no way to make a batch of forge
 * creates atomic - each one is a separate remote write - so the honest shape is
 * to stop and say exactly which findings are on the tracker and which are not,
 * rather than to continue and report a count.
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

  const forge = resolveForge(dir);
  if (forge.ok === false) {
    emit({ ok: false, reason: forge.reason, detail: forge.detail,
      hint: forge.hint, warnings: forge.warnings });
    return;
  }

  /** @type {Array<{fingerprint: string, disposition: string, title: string}>} */
  const filed = [];
  for (let i = 0; i < read.entries.length; i += 1) {
    const { finding, disposition } = read.entries[i];
    const title = issueTitle(finding);
    const argv = forge.row.create(forge.repo, {
      title, body: issueBody(finding), declined: disposition === 'decline',
    }, forge.login);
    if (!run(forge.bin, argv, { cwd: dir, timeout: CREATE_TIMEOUT_MS }).ok) {
      const unfiled = read.entries.slice(i).map((e) => ({
        fingerprint: fingerprint(e.finding),
        disposition: e.disposition,
        title: issueTitle(e.finding),
      }));
      // The mirror runs before the refusal is emitted: the issues that DID land
      // are on the tracker, and a recall pointer they never got is a second
      // loss on top of the first.
      mirrorFiled(dir, forge.provider, forge.repo, filed);
      emit({ ok: false, reason: 'create-failed', provider: forge.provider, repo: forge.repo,
        filed, unfiled, warnings: forge.warnings,
        detail: `${forge.bin} could not create the issue for ${unfiled[0].fingerprint} on `
          + `${forge.repo}: ${filed.length} of ${read.entries.length} were filed and `
          + `${unfiled.length} were not`,
        hint: `run \`${forge.bin}\` yourself in this directory to see why, then re-run this `
          + 'step with ONLY the unfiled entries - they are named on this envelope and they '
          + 'are still in hand, so none of them is lost' });
      return;
    }
    filed.push({ fingerprint: fingerprint(finding), disposition, title });
  }

  const mirror = mirrorFiled(dir, forge.provider, forge.repo, filed);
  if (mirror.ok === false) {
    // Every issue exists; the RECALL POINTER does not. That is not a success:
    // CAP-01's shipped guarantee is that a finding stays reachable by
    // `/cad-plan`'s recall, and this file is where that reachability lives now.
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
    filed, accepted: filed.filter((f) => f.disposition === 'accept').length,
    declined: filed.filter((f) => f.disposition === 'decline').length,
    detail: null, warnings: forge.warnings });
}

const argv = process.argv.slice(2);
const cmd = argv[0];

const ROWS = CONTRACTS['issue-filing.mjs'];

/** Each flag read through its declared row, the entry point bin/forge.mjs uses:
 * a refusal RAISES and the catch arm below publishes it on one line. */
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
