#!/usr/bin/env node
// @ts-check
// issue-filing.mjs - the workflow-facing seam over lib/filing-decision.mjs
// (CAP-01, CAP-02): the two calls a gate makes when it will not fix a finding
// now. `unfixed` says what to ASK about; `file` writes what the user answered -
// an ACCEPTED finding to this repository's own tracker, a DECLINED one to
// `.planning/DECLINED.md` and nowhere else.
//
// Modelled on bin/forge.mjs: exactly one JSON line on stdout through
// lib/seam-io.mjs's `emit`, every child spawned with its stderr DISCARDED at
// the spawn and bounded by an explicit timeout, and NO BYTE OF ANY CHILD'S
// OUTPUT ON ANY ENVELOPE (CONTEXT D-16). EXACTLY ONE child's stdout is read
// here - the title-scoped lookup below - and it is read by `normalizeLookup`,
// which answers fixed phrases and integers. A create's output is discarded with
// its stderr, because no create face on any of the three CLIs prints anything
// machine-readable to read.
//
// THE PAYLOAD RIDES A FILE ON BOTH FACES, never an inline flag and never
// stdin. It is caller-derived free text - a reviewer's claim carries quotes,
// backticks, newlines and whatever else the model wrote - and
// `references/conventions.md` states the transport for exactly that class. It
// is the same rule `planning.mjs adjudication --payload` already follows, and
// `unfixed`'s payload is meant to be literally the same FILE the adjudication
// record was written from.
//
// A DECLINE IS LOCAL, ON BOTH FACES. `unfixed` reads the decline set from
// `.planning/DECLINED.md` and `file` writes it there, and neither crosses the
// network for it. The record used to be a labelled issue on the forge, which
// meant every refusal a gate ever took was published on a tracker whose whole
// job is to state real work - and it meant the dedup key was only as complete
// as one paginated `issue list`, so a decline set bigger than a page put
// findings the user had already declined back in front of them forever. Both
// problems were the same problem: the answer was being kept somewhere it did
// not belong. A local file has no page and no audience.
//
// SO THE ONLY REMOTE WRITE LEFT IS AN ACCEPTED FINDING'S CREATE, and the only
// remote READ is the lookup that decides whether to make one. `file` asks the
// tracker, before its first create, which of the fire's own fingerprints a
// title already carries; an issue that already holds one is reported by number
// and not filed again. Criterion 11's "no round trip per finding" holds by
// CONSTRUCTION of one query per chunk of `LOOKUP_CHUNK` fingerprints - which is
// a stronger statement than the "trivially" it held by when there was no read
// at all, and a weaker one than a promise of a single call.
//
// AND A CREATE THAT DOES NOT LAND REFUSES, NAMING WHAT WAS NOT FILED
// (criterion 9). The batch stops at the first failure on the `runTransition`
// discipline, and both lists ride the refusal - a caller told "filed" about a
// finding that is not on the tracker has been told the wrong thing, and the
// finding it was told about is the one thing this phase may never drop.
'use strict';

import { execFileSync } from 'node:child_process';
import { lstatSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mergeLayers } from './lib/config-merge.mjs';
import { withPlanningFileLock } from './lib/capture-file.mjs';
import {
  appendDeclinedRow, appendFiledRow, atomicWrite, parseDeclinedRows,
} from './lib/planning-files.mjs';
import { emit } from './lib/seam-io.mjs';
import { CONTRACTS, requireFlag } from './lib/arg-contract.mjs';
import { redactUrl } from './lib/redact-url.mjs';
import { onPath } from './lib/on-path.mjs';
import { teaLoginNameForHost } from './lib/issue-decision.mjs';
import { PROVIDER_TABLE, missingForgeKeys } from './lib/forge-decision.mjs';
import {
  FILING_TABLE, LOOKUP_CHUNK, fingerprint, issueBody, issueTitle, normalizeLookup,
  unfixedFindings,
} from './lib/filing-decision.mjs';

/** The bound on the login probe. Local config read on every arm that needs it. */
const LOGIN_TIMEOUT_MS = 10000;

/** The bound on one title-scoped lookup - the value the lookup's removal took
 * away, restored with it. A READ is bounded shorter than a write because the
 * two failures are not the same: a forge slow to ANSWER a query has nothing at
 * stake in the delay, and giving up on it costs one unanswered chunk, which
 * this seam has an arm for. Giving up on a create that the forge may already
 * have committed costs the ambiguity `run`'s own header states. */
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
 *
 * `ok: false` MEANS "this call did not come back clean", never "the remote did
 * nothing". A nonzero exit, a SIGKILL on the timeout and a transport failure
 * are one value here by construction - stderr is discarded, so there is not
 * even a message to classify - and on a WRITE the second and third can follow a
 * remote that already committed the change. Every caller of this on a create
 * path has to carry that ambiguity forward rather than resolve it; `cmdFile`'s
 * create-failed hint is where it is spelled out for the operator.
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

/** The decline set, read off `.planning/DECLINED.md`, as fingerprints or a
 * refusal.
 *
 * A MISSING FILE IS AN EMPTY SET, NOT A REFUSAL. "Nothing has been declined
 * yet" is a real state and the state every repository starts in, so a fire on a
 * tree with no DECLINED.md asks about every finding, which is correct. Any
 * OTHER read error still refuses: the posture that a fire which cannot tell
 * what was already declined does not guess is the whole point of this lookup,
 * and an unreadable file is exactly that case.
 *
 * NO PAGE LIMIT AND THEREFORE NO TRUNCATION ARM. This used to be a
 * label-filtered `issue list` against the forge, where a response that filled
 * its page was indistinguishable from a complete one, and answering anyway
 * would put findings the user already declined back in front of them forever.
 * That loop is still the loop this seam exists to end; a local file simply
 * cannot express it, so the refusal that guarded it has nothing left to guard.
 * @param {string} dir
 * @returns {{ok: true, fingerprints: Set<string>}
 *   | {ok: false, reason: string, detail: string, hint: string}} */
function readDeclines(dir) {
  const file = join(dir, '.planning', 'DECLINED.md');
  let text;
  try { text = readFileSync(file, 'utf8'); } catch (e) {
    // ENOENT ALONE IS NOT ABSENCE. A DANGLING SYMLINK READS ENOENT TOO, and
    // that is an entry that EXISTS pointing at a record this process cannot
    // reach - every decline in it would resurface. `lstatSync` answers about
    // the LINK rather than its target, so it succeeds exactly where the path is
    // there and the read was not, which is the case that must refuse.
    const absent = /** @type {any} */ (e)?.code === 'ENOENT' && !entryExists(file);
    if (absent) return { ok: true, fingerprints: new Set() };
    return { ok: false, reason: 'declines-unreadable',
      detail: `${file}: ${redactUrl(e && e.message ? e.message : String(e))}`,
      hint: 'this fire cannot tell which findings were already declined, so it refuses rather '
        + 'than re-asking about them: make that file readable - a wrong mode and a dangling '
        + 'symlink are the two common answers - then re-run this step; nothing has been filed '
        + 'and no finding is lost' };
  }
  // A CONFLICTED RECORD IS NOT A PARTIAL ONE, IT IS AN UNTRUSTWORTHY ONE. The
  // grammar skips any line that is not a row, which is right for a human note
  // and wrong for a row a merge damaged: the fingerprint silently leaves the
  // set and the gate re-asks a settled question. Conflict markers are the one
  // damage shape that is unambiguous on sight, so they refuse here rather than
  // being read past. A row corrupted some other way is still skipped silently,
  // and that residual is stated rather than papered over - the grammar cannot
  // tell a mangled row from a sentence somebody wrote.
  if (/^(<{7}|={7}|>{7})(\s|$)/m.test(text)) {
    return { ok: false, reason: 'declines-conflicted',
      detail: `${file} holds git conflict markers, so its rows cannot be trusted`,
      hint: 'resolve the conflict in that file - every `- ` row from BOTH sides is wanted, '
        + 'the record is append-only and a row on either side is a question somebody already '
        + 'answered - then re-run this step; nothing has been filed and no finding is lost' };
  }
  return { ok: true, fingerprints: new Set(parseDeclinedRows(text).map((r) => r.fingerprint)) };
}

/** Does the path exist as an ENTRY, whatever it points at? `lstatSync` never
 * follows, so a dangling symlink answers true here and a genuinely absent path
 * answers false. Any other stat error is treated as existing: the caller is on
 * its refusal arm already and the safe reading of "cannot tell" is "do not
 * claim nothing was declined". @param {string} file */
function entryExists(file) {
  try { lstatSync(file); return true; } catch (e) {
    return /** @type {any} */ (e)?.code !== 'ENOENT';
  }
}

/**
 * `unfixed --payload <file>` - the findings this fire should PUT TO THE USER.
 *
 * The selection is lib/filing-decision.mjs's, off the structured payload alone;
 * what this face adds are the two removals that module cannot make - the
 * entries already FIXED, read off the payload, and the ones already DECLINED,
 * read off the tracker.
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

  // AN ENTRY WHOSE FIX IS ALREADY COMMITTED IS NOT A QUESTION FOR THE USER,
  // AND lib/filing-decision.mjs IS WHERE THAT IS DECIDED (CONTEXT D-04).
  // `unfixedFindings` reads the commit itself, so the set it answers with is
  // already the set to file: an entry citing one is not in it, whether the
  // commit is a voluntary fix on a medium or a halt somebody also overrode.
  // This face used to re-filter that here, which spelled "genuinely unfixed"
  // in two places - and a close-time gate asking the same question would then
  // have had to restate it a third time, which is the drift LND-02 closes.
  // Opening a tracker issue asking a user about work that is already committed
  // is still the defect the removal exists for; it simply happens one layer
  // down, and it still happens BEFORE the forge is touched, because the module
  // answers before `resolveForge` runs and a fire whose whole remainder is
  // already fixed should not spend a network call to discover it.

  // THE DECLINE SET IS READ BEFORE THE FORGE IS RESOLVED, because it no longer
  // comes from one. It is a local file, so a fire whose whole remainder was
  // already declined costs nothing to discover - the same reasoning the payload
  // check above states for itself, now true one step further down.
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

  // The disposition rides BESIDE the finding and the fingerprint does too:
  // `findingIssue` in lib/adjudication-record.mjs refuses any key outside
  // `FINDING_KEYS`, so a fingerprint written INTO a finding would make every
  // payload carrying it fail the record seam it came from.
  const findings = selected.findings
    .map((finding) => ({ fingerprint: fingerprint(finding), finding }))
    .filter((e) => !declines.fingerprints.has(e.fingerprint));

  // THREE NUMBERS, EACH COUNTING ONE THING, AND THE MIDDLE ONE COUNTS THIS
  // FACE'S OWN REMOVALS. `raised` stays the size of the set `unfixedFindings`
  // answered with and `already_declined` stays a count of DECLINES alone -
  // folding one into the other would make an existing figure mean something
  // new, and `already_declined` is DECLINED.md-derived in particular, so a
  // number that file never said must not land in it. `already_fixed` counts what
  // was dropped HERE for naming a commit, which is now none of them: the
  // module removes them before the set is handed over, so `raised` no longer
  // counts them either and the identity a reader checks - raised minus
  // already_fixed minus already_declined is `findings.length` - reads the same
  // as it always did. The key stays rather than being deleted so an envelope
  // reader learns no new shape, and it stays a REMOVAL count rather than being
  // repointed at the module's answer, because a figure that changed what it
  // counted while keeping its name is worse than one that reads zero.
  emit({ ok: true, provider: forge.provider, repo: forge.repo,
    raised: selected.findings.length,
    already_fixed: 0,
    already_declined: selected.findings.length - findings.length,
    findings, detail: null, warnings: forge.warnings });
}

/**
 * Mirror the batch into its two records, or say why not: the ACCEPTED filings
 * into `.planning/FILED.md`, the DECLINED ones into `.planning/DECLINED.md`.
 *
 * TWO FILES BECAUSE THEY MEAN OPPOSITE THINGS, and only one of them belongs in
 * the recall corpus. A declined finding's title written into FILED.md would put
 * a closed question back in front of `/cad-plan`'s recall - the accumulation
 * that separation exists to prevent - which is why the split is by file and not
 * by a flag on a row. DECLINED.md is outside the corpus by construction:
 * `cmdRecall` names its sources by path and does not name that one.
 *
 * The decline row is not bookkeeping. It IS the dedup key `readDeclines` reads,
 * so a decline that fails to land here is a question the user will be asked
 * again - which is why a failed write refuses rather than passing quietly.
 *
 * ONE LOCKED READ-MODIFY-WRITE PER FILE, through the guard
 * lib/capture-file.mjs exports for exactly this shape and the `atomicWrite` it
 * uses underneath. Reading outside the lock is the lost update it exists to
 * stop: two writers each read the same bytes, each append their own rows, and
 * the second rename erases the first one's. The two files take their own locks
 * rather than one shared lock: they are independent targets, and a batch that
 * is all accepts or all declines then takes exactly one.
 *
 * @param {string} dir @param {string} provider @param {string} repo
 * @param {Array<{fingerprint: string, disposition: string, title: string}>} filed
 * @returns {{ok: true} | {ok: false, reason: string, detail: string}}
 */
function mirrorFiled(dir, provider, repo, filed) {
  const date = new Date().toISOString().slice(0, 10);
  for (const arm of [
    { name: 'FILED.md', want: 'accept', append: appendFiledRow, lock: 'filed-locked' },
    { name: 'DECLINED.md', want: 'decline', append: appendDeclinedRow, lock: 'declined-locked' },
  ]) {
    const rows = filed.filter((f) => f.disposition === arm.want);
    if (!rows.length) continue;
    const file = join(dir, '.planning', arm.name);
    try {
      // Before the lock, because the LOCK is a sibling of the target and both
      // its exclusive create and `atomicWrite`'s sibling-temp rename need the
      // parent directory to be there.
      mkdirSync(join(dir, '.planning'), { recursive: true });
      const guarded = withPlanningFileLock(file, () => {
        // AN UNREADABLE EXISTING FILE IS NOT AN EMPTY ONE. This used to catch
        // every read error into `text = ''`, and the write that followed
        // REPLACED the file: a mode-000 record under a writable `.planning`
        // meant one successful-looking run erased every row already in it.
        // ENOENT is the only absence, and on this file that loss is total -
        // DECLINED.md is the sole record of every question already answered.
        let text = '';
        try { text = readFileSync(file, 'utf8'); } catch (e) {
          if (/** @type {any} */ (e)?.code !== 'ENOENT') throw e;
        }
        for (const row of rows) {
          const before = text;
          text = arm.append(text, { date, provider, slug: repo,
            fingerprint: row.fingerprint, title: row.title });
          // THE APPENDER REFUSES BY RETURNING THE TEXT UNCHANGED, which is the
          // right shape for a pure function and the wrong thing to ignore here:
          // a slug or a fingerprint the grammar rejects would leave the row
          // absent while this call still reported the batch recorded. On the
          // decline arm that is a settled question asked again; on the accept
          // arm it is an issue nothing points at.
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
 * Ask the forge which of these fingerprints a title already carries, one query
 * per chunk of `LOOKUP_CHUNK`, and answer PER FINGERPRINT.
 *
 * WHY PER FINGERPRINT AND NOT ONE FLAG FOR THE FIRE. A chunk whose child came
 * back clean keeps its answer even when a sibling chunk's child did not: a
 * fire-wide "the lookup was unavailable" would throw away an answer the forge
 * actually gave and re-file an issue this call had just found. That is the same
 * defect phase 1 fixed in `resolveRange`, where one unresolvable end discarded
 * the end that resolved.
 *
 * So each fingerprint ends in one of three states, and the caller can tell them
 * apart: ANSWERED-HIT (`answered`, with a `number`), ANSWERED-MISS (`answered`,
 * `number` null - the tracker looked and does not hold it) and UNANSWERED
 * (`answered` false - no child came back for this one, and only the local
 * ledger can speak for it).
 *
 * AN INCOMPLETE ANSWER REFUSES THE WHOLE FIRE, and that one IS fire-wide on
 * purpose: it refuses before any create, so no per-fingerprint state survives
 * it to be discarded. A page-filling response to a query naming at most six
 * tokens is either a truncated page or a forge that ignored the search, and
 * reading either as "not filed" is exactly the duplicate this work closes
 * (CONTEXT D-11 keeps this arm separate from the child-failed one).
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
      // NOT A REFUSAL. An offline forge that refused every fire would be a gate
      // nobody can get past, and the local ledger is the fallback for exactly
      // this arm (CONTEXT D-04, D-11).
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

  // THE TRACKER IS ASKED ONCE, BEFORE THE FIRST CREATE, and only when there is
  // an accept to ask about - a fire of declines alone touches no forge at all,
  // which is the same posture `cmdUnfixed` takes about its own local read.
  // `DECLINED.md` is never read on this face: a decline gates the ASK and never
  // the create (CONTEXT D-04), and the user has already answered here.
  /** @type {Map<string, {answered: boolean, number: number|null}>} */
  let answers = new Map();
  const acceptPrints = [...new Set(read.entries
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
  // An accept the tracker already holds: reported by NUMBER, no create child,
  // and deliberately no `.planning/FILED.md` row - the row is a pointer this
  // fire would be minting for an issue it did not file, and criterion 1 makes
  // that file the record of what THIS repository's gates opened.
  /** @type {Array<{fingerprint: string, disposition: string, title: string, issue: number}>} */
  const suppressed = [];
  for (let i = 0; i < read.entries.length; i += 1) {
    const { finding, disposition } = read.entries[i];
    const title = issueTitle(finding);
    const print = fingerprint(finding);
    // A DECLINE NEVER TOUCHES THE FORGE. It used to be created as a labelled
    // issue, because that label was the only place a decline persisted; the row
    // in DECLINED.md is that place now. Filing it on the tracker as well would
    // publish every refusal on a board that is supposed to state real work, and
    // would leave the dedup key in two places that can disagree.
    if (disposition === 'decline') {
      filed.push({ fingerprint: print, disposition, title });
      continue;
    }
    const answer = answers.get(print);
    if (answer && answer.answered && answer.number !== null) {
      suppressed.push({ fingerprint: print, disposition, title, issue: answer.number });
      continue;
    }
    const argv = forge.row.create(forge.repo, {
      title, body: issueBody(finding), declined: false,
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
      //
      // AND ITS ANSWER RIDES THE ENVELOPE. `mirrorFiled` refuses on a held lock
      // (`filed-locked`) and on a failed write, and a discarded refusal here is
      // the worst of the three outcomes silently reported as the middle one:
      // the caller is told these entries are `filed`, and told to re-run only
      // the `unfiled` ones, so an issue that WAS created and never got its
      // `.planning/FILED.md` row is unreachable through recall AND is never
      // revisited by the retry. `mirrored` says which of the two happened and
      // the hint below says what to do about it.
      const mirror = mirrorFiled(dir, forge.provider, forge.repo, filed);
      // A NONZERO CREATE IS AMBIGUOUS, and the instruction says so rather than
      // pretending otherwise. `run` collapses every `execFileSync` throw into
      // one `{ok: false}`: a forge that REFUSED, a SIGKILL on this seam's own
      // CREATE_TIMEOUT_MS bound and a transport failure are indistinguishable
      // here, and the last two are exactly the cases where the forge accepted
      // and created the issue before the client stopped listening.
      //
      // Nothing in this seam can tell them apart, and nothing cheap could:
      // `readDeclines` reads a local file that no create ever writes, so it
      // structurally cannot see an accepted issue, and no row reads a number off
      // a create (there is no `--json` on any create face - task 2's measured
      // fact). A second lookup would be a second network call inside a gate
      // step and a second page-clamp to reason about, for an answer the
      // operator can get by looking. So the hint hands the ambiguity to the
      // human WITH the one token that resolves it: the fingerprint is in the
      // issue TITLE by construction (`issueTitle`), which makes "search for it
      // before re-filing" an instruction that can actually be followed. Without
      // this sentence the retry files a duplicate.
      const failed = unfiled[0].fingerprint;
      const retry = `run \`${forge.bin}\` yourself in this directory to see why. The create for `
        + `${failed} is AMBIGUOUS rather than known-failed: a timeout, a kill on this step's `
        + 'own bound and a dropped connection all look here exactly like a refusal, and the '
        + `forge may have created that issue anyway. So SEARCH ${forge.repo}'s issues for the `
        + `title carrying \`${failed}\` BEFORE re-filing it. Then re-run this step with ONLY `
        + 'the unfiled entries this envelope names, minus any whose fingerprint is already on '
        + 'the tracker - they are still in hand, so none of them is lost.';
      // Only when the mirror ALSO failed, because a hint that always warns
      // about the recall pointer teaches the reader to skip the sentence.
      const lostPointer = mirror.ok === false
        ? ` AND the recall pointer was NOT written (${mirror.reason}: ${mirror.detail}), so the `
          + `${filed.length} entries this envelope lists as \`filed\` are on ${forge.repo} with `
          + 'NOTHING in .planning/FILED.md pointing at them: fix the write that detail names '
          + '(a stale .planning/FILED.md.lock is the usual answer) and add one `- ` row per '
          + 'ACCEPTED filed entry by hand. Do not re-file them - they already exist.'
        : '';
      emit({ ok: false, reason: 'create-failed', provider: forge.provider, repo: forge.repo,
        filed, unfiled, suppressed, warnings: forge.warnings,
        mirrored: mirror.ok === true,
        mirror_reason: mirror.ok === false ? mirror.reason : null,
        mirror_detail: mirror.ok === false ? mirror.detail : null,
        detail: `${forge.bin} could not create the issue for ${unfiled[0].fingerprint} on `
          + `${forge.repo}: ${filed.length} of ${read.entries.length} were filed and `
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
    filed, suppressed,
    accepted: filed.filter((f) => f.disposition === 'accept').length,
    declined: filed.filter((f) => f.disposition === 'decline').length,
    suppressed_count: suppressed.length,
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
