// @ts-check
// planning/core.mjs - the shared core of the planning seam: the envelope helpers
// every command module calls, the readers more than one command family needs, and
// the refusal composers the dispatch door and `trace` both compose.
//
// It exists because the 32 command handlers moved out of planning.mjs into one
// module per subcommand (phase 4, D-01/D-03). `fail` is called by all 32 of them,
// `ok` by 31 and `read` by 24, and a command module cannot import any of them back
// out of planning.mjs, because importing that file RUNS the dispatch at the foot of
// it. So each is declared exactly ONCE - here - and imported everywhere, including
// by planning.mjs itself. A second copy in a command module is the accumulation
// helper-census.test.mjs exists to stop.
//
// What belongs here is decided by USE and never by where a declaration happened to
// sit in the old file (D-06): a helper or constant two handler families reach is
// core, a single-use one travels with its handler. The seam contract itself - one
// JSON object on stdout, ok:false for every parse problem, deterministic and
// additive-only fields - is stated in planning.mjs's header and is unchanged by
// the split.
'use strict';

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync, lstatSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recordName } from '../lib/adjudication-record.mjs';
import { CONTRACTS } from '../lib/arg-contract.mjs';
import { mergeLayers } from '../lib/config-merge.mjs';
import { isQueueName, queueIdentity } from '../lib/deferred-queue.mjs';
import { parseUat, uatComplete } from '../lib/planning-files.mjs';
import { READS_FILE, isReadsRotationMarker } from '../lib/read-trace.mjs';
import { redactUrl } from '../lib/redact-url.mjs';
import { requirePhaseArg, requireInt } from '../lib/require-int.mjs';
import { emit } from '../lib/seam-io.mjs';
import { testSeamOpen } from '../lib/test-seam.mjs';

// The raw argument list, kept beside the envelope helpers because the flags
// that read through lib/arg-contract.mjs need the SPELLING and not parseArgs'
// digest of it: parseArgs mints the boolean `true` for a bare flag, so by the
// time a value reaches `opts` the three spellings a declared row separates -
// bare, empty and flag-shaped - have already collapsed into one.
const ARGV = process.argv.slice(2);

const ok = (o) => emit({ ok: true, ...o });

const fail = (reason, detail, hint) =>
  emit({ ok: false, reason, ...(detail ? { detail } : {}), ...(hint ? { hint } : {}) });

/** Read a file or return null - absence is data here, never a crash. */
function read(file) {
  try { return readFileSync(file, 'utf8'); } catch { return null; }
}

/**
 * The `--phase` spellings the two WRITE faces cannot honour, as a refusal
 * detail - or null when the spelling is one they can.
 *
 * `requirePhaseArg` deliberately returns the caller's OWN spelling beside the
 * numeric value, and most reads in this file address `phases/<raw>/` with it.
 * `cursor set` and `seed-reqs` cannot: both WRITE the numeric half - the
 * cursor's `Phase:` line, and a Traceability cell that `parseRequirements` and
 * `audit` compare against ROADMAP phase NUMBERS. So on a tree holding both
 * `phases/1.1/` and `phases/1.10/`, `--phase 1.10` wrote `Phase: 1.1 of 2
 * (One)` and `| BBB-01 | Phase 1.1 | Pending |` - the OTHER phase's name and
 * the other phase's row, silently, with ok:true (measured 2026-08-18).
 *
 * The rule is the round trip `String(value) === raw`, the same predicate the
 * CAPTURE.md and ARCHIVE.md phase readers carry (D-07), so `1.10`, `1.0` and
 * `01` are refused while `2`, `2.1` and `10` pass. STATED COST: neither face
 * can name a `phases/1.10/` directory any more, a capability
 * `lib/require-int.mjs` deliberately built. The detail carries BOTH spellings
 * because the caller's fix is exactly one of two things - retype the flag, or
 * rename the directory - and nothing else in the envelope says which.
 * @param {{raw: string, value: number}} parsed a `requirePhaseArg` success
 * @returns {string|null}
 */
function phaseSpellingRefusal(parsed) {
  const canonical = String(parsed.value);
  if (canonical === parsed.raw) return null;
  return `--phase "${parsed.raw}" is written here as phase ${canonical}, a different phase`
    + ` - send --phase "${canonical}", or rename phases/${parsed.raw}/ to phases/${canonical}/`;
}


// THE phase-directory grammar: a bare phase integer, or an `N.M` sub-phase
// insertion, with neither part zero-padded and no slug suffix. Checked here and
// resolved NOWHERE - Cadence states the grammar and REPORTS what violates it,
// rather than teaching the seams to resolve `08-meteogram-legend`
// (references/roadmap-phases.md).
//
// The fractional part carries the SAME `[1-9]` lead as the integer part,
// because the fraction is the sub-phase ORDINAL and obeys the same no-padding
// rule: `1.01` is a padded spelling of `1.1`, and `2.0` is not a fraction at
// all rather than a second spelling of phase 2. Deliberately NOT the
// `String(Number(x)) === x` round trip `phaseSpellingRefusal` above uses -
// measured 2026-08-25, `1.01` round-trips and `1.10` does not, so a round-trip
// rule would legalize `1.01` and outlaw `1.10`, inverting the two cases this
// grammar most has to get right. `phases/1.10/` stays a legal directory name.
//
// It lives in core rather than beside its drift walk (`phaseDirGrammarDrift`
// in planning/status.mjs) because a second family reaches it: the two `phases/`
// LISTING filters, in `cmdStatus`'s surviving-directory report and in the
// recall corpus walk. Those two carried a looser `/^\d+(\.\d+)?$/` of their
// own, described here as keeping "a zero-padded directory out of the corpus" -
// untrue, measured 2026-08-25: it matches `08`, `1.01` and `2.0`, and both
// sites key by `Number(...)`, so `phases/08/` landed under phase 8 (D-04).
const PHASE_DIR_NAME = /^[1-9]\d*(?:\.[1-9]\d*)?$/;

/**
 * The `--phase` spellings a PATH-RESOLVING face cannot honour on THIS tree, as
 * a refusal detail - or null when the spelling is one it can.
 *
 * The harm is the MIXED callsite, not a wholesale misread (D-06). Every command
 * that opens a phase directory builds `join(dir, 'phases', parsed.raw)`, so
 * `--phase 1.10` reads `phases/1.10/` and never touches `phases/1.1/` content -
 * but the SAME command reports `parsed.value` in its envelope's `phase:` key.
 * On a tree carrying both, that answer says `phase: 1.1` over bytes read out of
 * `phases/1.10/`, and the reader has no way to see which half is which.
 *
 * So the rule is TREE-AWARE, and deliberately not `phaseSpellingRefusal`'s pure
 * one (D-07): it refuses only when the caller's spelling is not the canonical
 * one AND the canonical one names something already on disk. `--phase 1.10`
 * refuses against a tree holding `phases/1.1/` and RESOLVES against a tree
 * holding only `phases/1.10/`, which keeps the sub-phase-ten capability
 * `lib/require-int.mjs` deliberately built. Wiring the pure refusal at these
 * twenty-odd faces instead would make `phases/1.10/` a legal directory name no
 * command can address - the cost stated above for two callsites, generalized.
 *
 * A SYMLINK at the canonical path counts as present, the same disposition
 * `phaseDirGrammarDrift` takes: what matters is that a reader would find
 * something there, not what it resolves to. The detail carries BOTH spellings
 * because the caller's fix is exactly one of two things - retype the flag, or
 * rename the directory - and nothing else in the envelope says which.
 *
 * @param {string} dir the planning directory (`--dir`)
 * @param {{raw: string, value: number}} parsed a `requirePhaseArg` success
 * @returns {string|null}
 */
function phaseSpellingCollision(dir, parsed) {
  const canonical = String(parsed.value);
  if (canonical === parsed.raw) return null;
  let stat = null;
  try { stat = lstatSync(join(dir, 'phases', canonical)); }
  catch { /* absent is the answer, never a throw */ }
  if (!stat || !(stat.isDirectory() || stat.isSymbolicLink())) return null;
  return `--phase "${parsed.raw}" is written here as phase ${canonical}, and phases/${canonical}/`
    + ` already exists on this tree - two different phases - send --phase "${canonical}" for that`
    + ` one, or rename phases/${parsed.raw}/ to a spelling that does not normalize onto ${canonical}`;
}
// `cadence-core/bin`, deliberately NOT this file's own directory. Both
// consumers below walk UP from it - `MANIFEST_PATH` with two `'..'` segments,
// `routeLadder` with one - and both swallow their own read failure, so a `HERE`
// one directory deeper does not crash: `pluginVersion` returns null and the
// route ladder reads as "none declared", each under ok:true with a wrong answer
// (D-03). The `'..'` segments at those two consumers are therefore left exactly
// as they were; compensating there instead would leave two different notions of
// where the bin directory is. `resolve` rather than `join` so the value stays
// the same normalized absolute path planning.mjs computed.
const HERE = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');

// The one path this script resolves outside `--dir`. Read relative to the
// SCRIPT, not the cwd, so it names the plugin actually executing - the whole
// point, given the skew this reports on. CADENCE_PLUGIN_MANIFEST overrides it
// ONLY when the `CADENCE_TEST_SEAM` sentinel holds (lib/test-seam.mjs); without
// it the variable is ignored and the shipped manifest is read, silently - this
// constant resolves at module load, before any dispatch exists to carry a
// warning. Same gate as CADENCE_CONFIG_SCHEMA and CADENCE_ROUTE_TABLE, and for
// the same reason: every version-skew answer is computed from this file, which
// is what QW-04 exists to keep honest.
const MANIFEST_PATH = (testSeamOpen() && process.env.CADENCE_PLUGIN_MANIFEST)
  || join(HERE, '..', '..', '.claude-plugin', 'plugin.json');

/**
 * The running plugin's version, or null when the manifest is unreadable,
 * malformed or version-less. Never throws: this is PROVENANCE, and a statement
 * about the run must not be able to sink the run it describes.
 * @returns {string|null}
 */
function pluginVersion() {
  try {
    const v = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')).version;
    return typeof v === 'string' ? v : null;
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Shared derivation: phase statuses from artifacts (the progress.md rules).
// no PLAN -> unplanned; PLAN w/o SUMMARY -> planned; SUMMARY w/o fully-passed
// UAT -> executed; SUMMARY + UAT complete -> complete.
// ---------------------------------------------------------------------------
function derivePhases(dir, roadmapPhases) {
  return roadmapPhases.map((p) => {
    const pdir = join(dir, 'phases', String(p.n));
    let plans = [];
    try {
      plans = readdirSync(pdir).filter((f) => /^PLAN(-\d+)?\.md$/.test(f)).sort();
    } catch { /* no dir -> unplanned */ }
    const summary = existsSync(join(pdir, 'SUMMARY.md'));
    const uatText = read(join(pdir, 'UAT.md'));
    const uat = uatText ? parseUat(uatText) : null;
    let status = 'unplanned';
    if (plans.length) status = 'planned';
    if (summary) status = (uat && uatComplete(uat)) ? 'complete' : 'executed';
    return { ...p, plans, status, uat };
  });
}

// ---------------------------------------------------------------------------
// uat - checklist persistence. The script owns the invariants (first_pass
// set-once, verifier never overwrites user results, counts always recomputed,
// atomic writes); the model owns item wording and result inference.
// ---------------------------------------------------------------------------
/**
 * Read a JSON payload from `--payload <file>` when one is named, otherwise from
 * stdin, as a DISCRIMINATED result.
 *
 * The reader this replaces returned `null` for BOTH a parse failure and a
 * legitimate `null` payload, and `merge`'s `if (f === null) return;` then exited
 * 0 having printed NOTHING - from a seam whose entire contract is one JSON line
 * on stdout, so the caller saw neither a result nor a refusal. Distinguishing
 * the two is what lets a `null` payload be refused like any other non-object
 * instead of vanishing. `ok:false` here means a refusal has ALREADY been
 * emitted; the caller returns without emitting a second one.
 *
 * Empty input is `no-payload`, not `bad-payload`: "you handed me nothing" and
 * "what you handed me is not the shape" are different repairs, and the first is
 * what a truncated or never-written findings file actually looks like.
 * @param {string|boolean} [file] `opts.payload`; stdin when undefined
 * @returns {{ok: true, value: any} | {ok: false}}
 */
function readJsonPayload(file) {
  let text;
  let where = 'stdin';
  if (file !== undefined) {
    // parseArgs gives a valueless flag the boolean `true`, so `--payload` with
    // no path must be refused here rather than reaching readFileSync.
    if (typeof file !== 'string' || !file.trim()) {
      fail('no-payload', '--payload needs a file path',
        'write the payload JSON to a file and name it: --payload <path>; this flag reads a file'
        + ' and never a value typed on the command line');
      return { ok: false };
    }
    where = file;
    text = read(file);
    if (text === null) {
      fail('no-payload', `${file} not found or unreadable`,
        'write the payload JSON to that path before re-running, or point --payload at the file that'
        + ' already holds it');
      return { ok: false };
    }
  } else {
    try { text = readFileSync(0, 'utf8'); }
    catch (e) {
      fail('no-payload', `stdin: ${e.message}`,
        'pipe the payload JSON into this command, or send it as a file with --payload <path> where'
        + ' the subcommand takes one');
      return { ok: false };
    }
  }
  if (!text.trim()) {
    fail('no-payload', `${where} is empty`,
      'put the payload JSON there and re-run - an empty payload is what a truncated or'
      + ' never-written findings file looks like, so check the step that was supposed to write it');
    return { ok: false };
  }
  try { return { ok: true, value: JSON.parse(text) }; }
  catch (e) {
    fail('bad-payload', e.message,
      'repair the JSON at the position the detail names - in the file, or in the step that wrote'
      + ' it - then re-run');
    return { ok: false };
  }
}

/**
 * `memory.backend`, effective across the config layers (repo > global), with
 * the layer warnings behind it.
 *
 * ONE reader for the key, not one per command. `cmdRecall` gates its whole
 * corpus walk on it and `cmdCiteCount` records `none` as a third state on the
 * record, and the two must agree by construction: a second inlined
 * `mergeLayers` + `?? 'builtin'` pair is exactly how the off switch comes to
 * mean one thing at the seam that produces the surfaced set and another at the
 * seam that counts it. The schema default is `builtin`, so an unset key is on.
 *
 * `warnings` is RETURNED rather than surfaced here, because this is a reader
 * and the envelope belongs to the caller - both callers put it on theirs, for
 * the reason each states at its own emit: a TORN layer reads the key as absent
 * and defaults a deliberate `none` back to `builtin`.
 */
function memoryBackend(dir) {
  const { config, warnings } = mergeLayers(join(dir, 'config.json'));
  return { backend: config?.memory?.backend ?? 'builtin', warnings };
}

// ---------------------------------------------------------------------------
// listPlanFiles - one phase directory's plan files, split into conforming
// (`PLAN.md`, `PLAN-N.md`) and non-conforming (any other `PLAN*.md`, e.g. a
// `PLAN-gaps.md` shipped by name - phase-1 D-21: invisible to status, audit,
// plan-overlap and executor dispatch alike, so its requirements and files
// were read by nothing while everything reported success).
//
// `missing: true` reports that `pdir` could not be read at all - load-bearing,
// not decoration: cmdAudit and cmdPlanOverlap have OPPOSITE absent-directory
// contracts today (audit swallows it to mean "unplanned"; plan-overlap
// returns `fail('no-phase-dir', ...)`), and a helper with no channel for that
// would turn an absent phase dir into plan-overlap's clean-pass shape, which
// `execute.md`'s choose_path (routes sequential only on `ok:false`) would then
// read as clearance to run parallel. Each caller keeps its own behavior on
// `missing`; this helper only reports it.
// ---------------------------------------------------------------------------
function listPlanFiles(pdir) {
  let entries;
  try { entries = readdirSync(pdir); }
  catch { return { plans: [], nonconforming: [], missing: true }; }
  const plans = [];
  const nonconforming = [];
  for (const f of entries) {
    if (/^PLAN(-\d+)?\.md$/.test(f)) plans.push(f);
    else if (f.startsWith('PLAN') && f.endsWith('.md')) nonconforming.push(f);
  }
  return { plans: plans.sort(), nonconforming: nonconforming.sort() };
}

/**
 * The ONE `.planning/reads.jsonl` line parse in this file. Two arms read that
 * record now - `cmdReads` and the `trace suggest` arm below - and a second copy
 * of the partial-tail rule would be a second place for it to drift.
 *
 * It REPORTS what it hit and decides nothing. `absent` and `unreadable` are
 * handed back separately rather than collapsed, because the two callers take
 * deliberately different postures on them and a helper that picked one would
 * impose it on both: `reads` fails loudly on an unreadable file (it is the face
 * `/cad-report`'s Reading line is composed from, and a silent empty there reads
 * as a project that opened nothing), while `trace suggest` returns no entry and
 * names the file in `warnings[]`. A permissions error loud on one face and
 * invisible on the other is exactly what this split prevents.
 *
 * It also DROPS the rotation marker and reports the cut, because both are the
 * same fact about the same line and every reader crosses this parse. The
 * marker cannot be made inert the way `lib/trace.mjs:276-280` makes the
 * trace's: `summarizeReads` bills every object it is handed into `calls` and
 * `byAgent`, and `joinReads` pushes an `unresolved` row for any record with no
 * `agent`, so an unfiltered marker becomes a phantom read `/cad-report` prints
 * in its Reading line as a real tool call (D-09). Filtering in the two folds
 * instead would be three sites - `inDispatchReads` folds off `joinReads`'s
 * rows - and three places for one predicate to drift.
 *
 * `rotated` is present ONLY where a marker was seen, so a record that never
 * rotated returns exactly the three fields it has always returned.
 *
 * @param {string} dir the planning directory
 * @returns {{status: 'ok'|'absent'|'unreadable', records: any[], file: string,
 *   rotated?: {file: string, ts: string}}}
 */
function readReadsRecords(dir) {
  const file = join(dir, READS_FILE);
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (e) {
    return { status: e && e.code === 'ENOENT' ? 'absent' : 'unreadable', records: [], file };
  }
  const records = [];
  /** @type {{file: string, ts: string}|null} */
  let rotated = null;
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    // A truncated final line is SKIPPED, never fatal: the file is appended to
    // by a hook that can be killed mid-write, and a partial tail must not cost
    // the caller every complete record ahead of it.
    let parsed;
    try { parsed = JSON.parse(t); } catch { continue; /* partial line */ }
    if (isReadsRotationMarker(parsed)) {
      rotated = { file: String(parsed.file || ''), ts: String(parsed.ts || '') };
      continue;
    }
    records.push(parsed);
  }
  return { status: 'ok', records, file, ...(rotated ? { rotated } : {}) };
}

/**
 * The per-role dispatch-window ceilings the `window` arm falls back to when no
 * config layer sets one.
 *
 * `cadence-core/config.schema.json` IS THE SOURCE OF TRUTH for these numbers -
 * its rows carry the defaults, the sample sizes behind them and the reach
 * phrase, and `cadence-core/references/seams.md` carries the argument. This map
 * is the unset-layer fallback and nothing else, the same duplication
 * `cmdRecall`'s `?? 'builtin'` already accepts: this seam reads the merged
 * config, not the schema, so an unset key has to resolve to something here.
 * A number changed in one place and not the other makes the report disagree
 * with the row a user reads before setting the key.
 */
const DISPATCH_WINDOW_DEFAULTS = Object.freeze({
  'cad-planner': 200000,
  'cad-assumptions-analyzer': 150000,
  'cad-verifier': 100000,
  'cad-reviewer': 150000,
  'cad-executor': 200000,
  'cad-plan-checker': 75000,
});

/**
 * One ordered ladder off `route-table.json`, or `undefined` when the table is
 * unreadable, malformed, or names that ladder as anything but a non-empty array
 * of non-empty strings.
 * @param {string} key
 * @returns {string[]|undefined}
 */
function routeLadder(key) {
  try {
    const table = JSON.parse(readFileSync(join(HERE, '..', 'route-table.json'), 'utf8'));
    const ladder = table[key];
    if (Array.isArray(ladder) && ladder.length
      && ladder.every((g) => typeof g === 'string' && g)) return ladder;
  } catch { /* unreadable or malformed: no ladder, and the omission says so */ }
  return undefined;
}

/** The `git diff` body this will read, at most. An oversized range is a
 * REPORTED state (`checked:false`, with the reason on the envelope), never a
 * throw that leaves the caller with no answer at all. */
const RISK_DIFF_MAX_BUFFER = 32 * 1024 * 1024;

/**
 * A ref the caller stated, or null. Refused when it opens with `-`: git would
 * read it as a FLAG, and a gate whose range can be turned into an option by its
 * own argument is a gate that can be told to look at something else.
 * @param {any} raw
 */
function riskRef(raw) {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t || t.startsWith('-')) return null;
  return t;
}

/**
 * The repository, and the COMMIT IDS a caller's two refs name.
 *
 * RANGE IDENTITY IS THE COMMIT PAIR, never the ref SPELLING.
 * `workflows/execute.md` documents `--head HEAD` for both the `run` call and
 * the `status` call, so a string compare of spellings lets the record left
 * under one value of `HEAD` satisfy a later, wider `HEAD`: a gate fix, a
 * continuation commit or a concurrent write landing between the two calls was
 * never scanned, and the gate still reports `recorded`. The caller's spelling
 * stays on the record for the READER; the id is what is compared. A ref that
 * cannot be resolved is a refusal at both call sites, never a match.
 *
 * `--verify` with a `^{commit}` suffix, so a tag resolves to the commit it
 * names and a ref naming no commit at all is an ERROR rather than some other
 * object's id. `riskRef` has already refused a `-`-leading spelling, so nothing
 * reaching git here can be read as an option.
 * ONE shape on both paths rather than an `ok`-discriminated union: this repo's
 * CI typecheck runs `strict: false`, where narrowing a JSDoc union by its
 * boolean literal does not happen, so the union costs every caller a cast. A
 * failed resolve reads `{ok: false, base: '', head: '', error: <the redacted
 * git message>}`.
 * @param {string} base @param {string} head
 * @returns {{ok: boolean, top: string, base: string, head: string, error: string}}
 */
function resolveRange(base, head) {
  try {
    const top = execFileSync('git', ['rev-parse', '--show-toplevel'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    const id = (/** @type {string} */ ref) => execFileSync('git',
      ['-C', top, 'rev-parse', '--verify', `${ref}^{commit}`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    return { ok: true, top, base: id(base), head: id(head), error: '' };
  } catch (e) {
    // redactUrl first, the EXP-01 rail cmdLeaseCheck's `no-staged-set` applies:
    // a git failure detail can carry a remote URL with credentials in it.
    return {
      ok: false,
      top: '',
      base: '',
      head: '',
      error: redactUrl(e && e.message ? e.message : String(e)),
    };
  }
}

/**
 * A plan identity as ONE spelling. `trace append --plan` stores the caller's
 * string and `risk-check run` stores the parsed number, so both sides of every
 * comparison are stringified - the rule lib/trace.mjs's own `key()` follows for
 * the same reason. A row with no plan at all keys to '' and is still carried:
 * an unidentified completed range is not an exempt one. The correlation id is
 * compared through this too - one normalization for both identity fields, so a
 * `corr` that arrived as a non-string cannot compare unequal to its own value.
 * @param {any} v
 */
const planKey = (v) => (v === undefined || v === null ? '' : String(v));

/**
 * The spelling `--trigger` and `--discriminator` may carry: the character set
 * the `REVIEW-<trigger>-<discriminator>.md` filenames already on disk use.
 *
 * VALIDATED AND REFUSED, never sanitized, because both reach a FILENAME.
 * `milestone-prune --label` was only TRIMMED before `join(dir, '_archive-' +
 * label)` and a label read out of PROJECT.md escaped the tree (VAL-01);
 * sanitizing silently writes a record under a name the caller did not choose,
 * which is the same class of answer about something nobody asked for. No path
 * separator, no `.` - which takes `..` with it and keeps the `.json` suffix
 * this seam's own - and no leading `-`, so the name can never be read as an
 * option by whatever later walks the directory.
 */
const RECORD_TOKEN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/**
 * The identity a fire's artifact is filed under, validated ONCE for both faces
 * that write one: the phase as the caller spells it, the two filename tokens,
 * the re-arm round, and the two refs.
 *
 * Shared rather than restated, because `adjudication` and `deferred record`
 * name the SAME fire and the two files land in one directory: two copies of
 * this preamble is two chances for the record and the queue member to disagree
 * about which fire they belong to, and the rails here - a token that reaches a
 * FILENAME, a round that keeps a re-arm off round one's file - are exactly the
 * ones where a divergence is silent.
 *
 * It EMITS its own refusal and answers `null`, the shape `readJsonPayload`
 * already takes: the caller's arm is `if (!id) return;`.
 *
 * @param {string} face the subcommand's spelling, for every refusal's wording
 * @param {string} dir the planning directory, for the tree-aware spelling check
 * @param {any} opts
 * @returns {{n: string, trigger: string, discriminator: string, round: number,
 *            base: string, head: string} | null}
 */
function fireIdentity(face, dir, opts) {
  const parsedPhase = requirePhaseArg(opts.phase);
  if (!parsedPhase.ok) {
    fail('bad-args', `${face} needs --phase <N>`,
      `pass --phase <N> for the phase this fire belongs to, then re-run the ${face}`);
    return null;
  }
  // AHEAD of the token rails and well ahead of `fireHome`, because this is a
  // question about the FLAG and the rails below are questions about other
  // flags. `fireHome`'s `no-phase-dir` is not a substitute even where it would
  // also fire: it names the right directory but neither of the two fixes.
  const collision = phaseSpellingCollision(dir, parsedPhase);
  if (collision) {
    fail('bad-args', `${face} ${collision}`,
      `re-run the ${face} with one of those two spellings - nothing was written`);
    return null;
  }
  // The caller's OWN spelling, the way `uatFile` addresses a phase: every use
  // of it is a path or a label, never arithmetic.
  const n = parsedPhase.raw;

  const trigger = opts.trigger;
  const discriminator = opts.discriminator;
  for (const [flag, raw] of [['--trigger', trigger], ['--discriminator', discriminator]]) {
    if (typeof raw !== 'string' || !RECORD_TOKEN.test(raw)) {
      fail('bad-args',
        `${face} ${flag} reaches a FILENAME, so it takes letters, digits, _ and - `
        + 'only, opening with a letter or a digit and at most 64 characters - got '
        + `${typeof raw === 'string' ? JSON.stringify(raw) : 'nothing'}`,
        `re-send ${flag} spelled with those characters only - it becomes part of this artifact's`
        + ' filename, so nothing else can be stored; nothing was written');
      return null;
    }
  }

  // THE RE-ARM'S ROUND. A blocking re-arm (references/triage-gate.md caps it at
  // ONE) is a SECOND fire of the same trigger on the same plan, so it resolves
  // to the same discriminator: without this flag round two's artifact would
  // replace round one's, and round one is exactly the record an auditor reads
  // to see the finding a fix was claimed to close.
  let round = 1;
  if ('round' in opts) {
    const parsedRound = requireInt(opts.round);
    if (!parsedRound.ok || parsedRound.value < 1) {
      fail('bad-args',
        `${face} --round needs the re-arm round after it, a whole number of at `
        + 'least 1: --round 2',
        'send --round 2 for the first re-arm of this trigger, or leave the flag off for a first'
        + " fire - without it a re-arm would overwrite round one's record, which is the one an"
        + ' auditor reads');
      return null;
    }
    round = parsedRound.value;
  }

  // BOTH required and neither defaulted, the rule `risk-check run` already
  // states: a defaulted head is a range the caller never stated, and these
  // artifacts ARE the evidence of what was reviewed.
  const base = riskRef(opts.base);
  const head = riskRef(opts.head);
  if (!base || !head) {
    fail('bad-args', `${face} needs --base <ref> and --head <ref>, neither opening with \`-\``,
      `name both ends of the range this fire reviewed, as refs this repository can resolve, then`
      + ` re-run the ${face}`);
    return null;
  }

  // THE TASK'S OWN HOME, optional and held to the same rail as `--trigger` and
  // `--discriminator` above, because it reaches a PATH: `.planning/tasks/<slug>/`.
  // Absent is the ordinary phase fire; present is `/cad-task`, whose records
  // never join a phase's.
  let task;
  if ('task' in opts) {
    if (typeof opts.task !== 'string' || !RECORD_TOKEN.test(opts.task)) {
      fail('bad-args',
        `${face} --task reaches a DIRECTORY name, so it takes letters, digits, _ and - `
        + 'only, opening with a letter or a digit and at most 64 characters - got '
        + `${typeof opts.task === 'string' ? JSON.stringify(opts.task) : 'nothing'}`,
        're-send --task with the task slug spelled with those characters only - it addresses'
        + ' .planning/tasks/<slug>/ verbatim; nothing was written');
      return null;
    }
    task = opts.task;
  }

  // PHASE 0 IS THE TASK NUMBER, so it does not resolve a phase home. `/cad-task`
  // fires with it precisely because no roadmap phase carries it, and its
  // artifacts live under `.planning/tasks/<slug>/`. Left unenforced, a task fire
  // that FORGOT `--task` fell through to the ordinary phase branch, and a repo
  // that happens to hold a `phases/0/` took the record into it and answered
  // ok:true while the sibling REVIEW file under the slug stayed unsettled - a
  // fire reported as recorded, filed where nothing reads it.
  if (n === '0' && task === undefined) {
    fail('bad-args',
      `${face} --phase 0 is a TASK's number and resolves no phase home - a task keeps its `
      + 'record beside the sibling REVIEW file under .planning/tasks/<slug>/',
      'pass --task <slug> naming the task directory. `deferred record` does not take it: the '
      + 'queue enumeration reads the two phase homes only, so a member written under a slug '
      + 'would never be found, and a blocking gate is the one that has to be');
    return null;
  }

  return { n, trigger, discriminator, round, base, head, task };
}

/**
 * The directory a fire's artifact is written into, or `null` once the refusal
 * has been emitted.
 *
 * BESIDE THE SIBLING REVIEW FILE (D-06), and never inside `<plandir>/reports/`:
 * `cmdLeaseCheck` exempts exactly one path under that directory by byte
 * equality, so anything else staged from there answers `undeclared-files`. The
 * directory has to already exist - these seams record a fire that HAPPENED, and
 * minting one for a mistyped flag would leave a directory nothing else in the
 * tree accounts for. `lstatSync` on whichever home is chosen AND on the parent
 * it sits under, so a SYMLINK sitting where either belongs is refused rather
 * than followed out of the tree, the disposition the read side of this file
 * already takes. The parent half is not belt-and-braces: `lstatSync` declines to
 * follow only its OWN last component, so a symlinked `tasks` (or `phases`, or
 * `deferred`) was resolved on the way past and the leaf test then reported the
 * TARGET's directory.
 *
 * A TASK NAMES ITS OWN HOME (#167 GH-227). `/cad-task` deliberately fires with
 * `--phase 0`, because 0 is the one number no roadmap phase carries and a task's
 * records must never join a phase's - and it just as deliberately writes its
 * artifacts to `.planning/tasks/<slug>/`, so there is no `phases/0/` and there
 * never will be. The two halves disagreed by construction: the REVIEW file
 * landed under `tasks/<slug>/` with no complaint and the record beside it was
 * refused `no-phase-dir`, which left the hand-append as the only way to settle a
 * blocking gate on a task - a receipt no guard can see, which is worse than a
 * refusal. `task` is that home, named by the caller rather than derived, because
 * the slug is not recoverable from the phase number or the discriminator. When
 * it is given it is the ONLY home tried: a task run is not a phase run that
 * happens to have no directory yet, and falling back to `phases/0/` would put a
 * task's rulings wherever a phase 0 happened to exist.
 *
 * TWO HOMES OTHERWISE, IN ORDER: `phases/<N>/` while the phase is live, else
 * `.planning/deferred/<N>/` once `deferred carry` has moved that phase's queue
 * out ahead of `milestone-prune`. Without the second, a carried queue member is
 * PERMANENTLY unclearable - `adjudication` refuses on the deleted phase
 * directory, so the finding that stops the land can never be ruled on, and an
 * unclearable gate is one that gets bypassed. `deferred record` resolves the
 * same way and in the same order, because a triage that rules a `blocker`/
 * `high` survived has to re-arm, and a re-arm with nowhere to write its round-2
 * member leaves the cap reading unspent off a queue that could never gain one.
 *
 * `recordForFire` deliberately does NOT widen with them. It resolves the
 * receipt RECOUNT, whose own contract already states that an unresolvable
 * record OMITS the check rather than failing the append - so a carried fire
 * degrades to no cross-check instead of to a wrong one, and that is the safe
 * direction there while it is the unsafe one here.
 *
 * @param {string} dir @param {string} n the phase as the caller spelled it
 * @param {string} what the artifact, for the refusal's wording
 * @param {string} [task] the task slug, when this fire is a task's
 * @returns {string|null}
 */
/**
 * Is `<dir>/<name>` a REAL directory - present, and not a symlink?
 *
 * The check `fireHome` used to make was on the LEAF alone, and `lstatSync`
 * refuses to follow only its own final component: with `.planning/tasks` (or
 * `phases`, or `deferred`) a symlink out of the tree, an `lstat` of
 * `tasks/<slug>` resolves that symlink on the way past and reports the TARGET's
 * directory, so the leaf test passed and the write landed outside the planning
 * tree it names. So the parent is tested too, on the same disposition the leaf
 * takes - a symlink where a directory belongs is refused rather than followed.
 * @param {string} dir @param {string} name @returns {boolean}
 */
function realDir(dir, name) {
  let stat = null;
  try { stat = lstatSync(join(dir, name)); } catch { return false; }
  return stat.isDirectory();
}

function fireHome(dir, n, what, task) {
  if (task) {
    const tdir = join(dir, 'tasks', task);
    let tstat = null;
    if (realDir(dir, 'tasks')) {
      try { tstat = lstatSync(tdir); } catch { /* absent is the answer, never a throw */ }
    }
    if (tstat && tstat.isDirectory()) return tdir;
    fail('no-task-dir',
      `tasks/${task}/ is not a directory under ${dir} - the ${what} is written BESIDE the `
      + 'sibling REVIEW file, and a task keeps both under its own slug, so that directory has '
      + 'to exist already',
      `check the --task spelling first - it addresses tasks/${task}/ verbatim. A task that `
      + 'never wrote a PLAN.md has no directory: the inline path writes no plan, so a blocking '
      + 'gate there is settled by the user rather than recorded here');
    return null;
  }
  for (const home of QUEUE_HOMES) {
    if (!realDir(dir, home)) continue;
    const hdir = join(dir, home, String(n));
    let hstat = null;
    try { hstat = lstatSync(hdir); } catch { /* absent is the answer, never a throw */ }
    if (hstat && hstat.isDirectory()) return hdir;
  }
  fail('no-phase-dir',
    `neither phases/${n}/ nor deferred/${n}/ is a directory under ${dir} - the ${what} is `
    + 'written BESIDE the sibling REVIEW file, or beside the queue member a milestone close '
    + 'carried out of that phase, so one of the two has to exist already',
    `check the --phase spelling first - it addresses phases/${n}/ verbatim. If the milestone close `
    + `already carried this phase's queue out, run \`deferred carry --phase ${n}\`, which is what `
    + 'creates the second home');
  return null;
}

/** The two directories under `.planning/` a queue member may live in. */
const QUEUE_HOMES = ['phases', 'deferred'];

/**
 * Every unadjudicated queue member under `dir`, and everything in the two homes
 * that could not be proven to hold none.
 *
 * ONE derivation with TWO callers - `deferred list` and the `status` envelope -
 * so `/cad-land` and `/cad-progress` cannot disagree about what is queued.
 *
 * @param {string} dir the planning directory
 * @param {string|null} wantPhase a phase as the caller spelled it, or null for
 *   the whole tree
 * @returns {{members: {phase: string, trigger: string, discriminator: string,
 *            round: number, path: string, findings: number}[],
 *            findings: number, unreadable: {path: string, detail: string}[]}}
 */
function readQueue(dir, wantPhase) {
  /** @type {{phase: string, trigger: string, discriminator: string, round: number, path: string, findings: number}[]} */
  const members = [];
  /** @type {{path: string, detail: string}[]} */
  const unreadable = [];
  // redactUrl on every message, the EXP-01 rail: these strings are printed by
  // a land refusal and can carry a path a caller would rather not publish.
  const why = (/** @type {any} */ e) => redactUrl(e && e.message ? e.message : String(e));

  for (const home of QUEUE_HOMES) {
    let entries;
    try { entries = readdirSync(join(dir, home), { withFileTypes: true }); } catch (e) {
      // ENOENT is ABSENCE and absence is data: `.planning/deferred/` exists only
      // once a close has carried something, and a project with no `phases/` at
      // all has no fires. Every OTHER error is a home that might hold a queue.
      if (e && /** @type {any} */ (e).code === 'ENOENT') continue;
      unreadable.push({ path: `${home}/`, detail: why(e) });
      continue;
    }
    for (const ent of entries) {
      if (wantPhase !== null && ent.name !== wantPhase) continue;
      const rel = `${home}/${ent.name}`;
      // `withFileTypes` classifies the LINK, never its target, the disposition
      // `fireHome` takes at the write face: a symlink where a phase
      // directory should be is refused rather than followed out of the tree.
      if (ent.isSymbolicLink()) {
        unreadable.push({ path: rel, detail: 'a symlink where a phase directory should be - not followed' });
        continue;
      }
      // A regular file under `phases/` holds no queue member and is some other
      // reader's business; only a directory can.
      if (!ent.isDirectory()) continue;
      const pdir = join(dir, home, ent.name);
      /** @type {string[]} */
      let names;
      try { names = readdirSync(pdir); } catch (e) {
        unreadable.push({ path: rel, detail: why(e) });
        continue;
      }
      const present = new Set(names);
      for (const name of names) {
        if (!isQueueName(name)) continue;
        const path = `${rel}/${name}`;
        const file = join(pdir, name);
        let stat = null;
        try { stat = lstatSync(file); } catch (e) {
          unreadable.push({ path, detail: why(e) });
          continue;
        }
        if (!stat.isFile()) {
          unreadable.push({ path, detail: 'not a regular file - a symlink wearing a queue member\'s name is not a queue member' });
          continue;
        }
        let parsed;
        try { parsed = JSON.parse(readFileSync(file, 'utf8')); } catch (e) {
          unreadable.push({ path, detail: why(e) });
          continue;
        }
        const id = queueIdentity(name, parsed);
        if (!id.ok) {
          unreadable.push({ path, detail: id.detail });
          continue;
        }
        // The member's own `phase` against the directory holding it. They are
        // written together - the write face resolves `phases/<N>/` from the
        // same `--phase` it stores, and `deferred carry` preserves both - so a
        // disagreement means the file was moved by hand, and `--phase` would
        // then narrow to a phase the member does not claim.
        if (id.phase !== ent.name) {
          unreadable.push({ path, detail: `queue member says phase ${id.phase} but sits in ${rel}/` });
          continue;
        }
        // THE SUPERSESSION TEST, as one filename comparison (D-01). A REGULAR
        // FILE only, the disposition `recordForFire` already states: a symlink
        // is not a record, and accepting one here would let a queue be cleared
        // by a link to anything at all.
        const record = recordName(id.trigger, id.discriminator, id.round);
        if (present.has(record)) {
          let rstat = null;
          try { rstat = lstatSync(join(pdir, record)); } catch { /* unreadable is not superseded */ }
          if (rstat && rstat.isFile()) continue;
        }
        members.push({
          phase: id.phase,
          trigger: id.trigger,
          discriminator: id.discriminator,
          round: id.round,
          path,
          findings: id.findings,
        });
      }
    }
  }
  // Stable and derivation-owned rather than readdir's order, so a refusal
  // prints the same list twice running and two homes interleave by phase.
  members.sort((a, b) => a.path.localeCompare(b.path));
  unreadable.sort((a, b) => a.path.localeCompare(b.path));
  return { members, findings: members.reduce((n, m) => n + m.findings, 0), unreadable };
}

// Dispatch. Adding a subcommand = one entry here + its tests.
// ---------------------------------------------------------------------------
// The refusal SENTENCE for a flag this script's rows declare, and the ONE home
// for that wording. lib/arg-contract.mjs names the FLAG and nothing else
// (D-07): this file owns its refusal vocabulary - `bad-args`, never the
// `missing-flag-value` throw, which has no `e.seam` catch arm here to render it
// as anything but `internal`.
//
// Only the spellings that already SHIP are listed. Everything else COMPOSES
// from the flag's own name and its declared type, so a row added to the table
// tomorrow refuses with a sentence naming its flag rather than with an entry
// somebody has to remember to write here - which is the second table this
// requirement exists to prevent, one wording over.
const FLAG_SENTENCES = {
  '--dir': 'needs a path after it: --dir <planning dir>',
  '--root': 'needs a path after it: --root <project root>',
  '--role': 'needs a role name after it: --role <name>',
  '--step': 'needs a step name after it: --step <name>',
  '--reviewer': 'needs a reviewer name after it: --reviewer <name>',
  '--trigger': 'needs a trigger name after it: --trigger <name>',
};

/**
 * The sentence a refused flag carries, without its subcommand prefix.
 *
 * The `-file` arm composes lib/text-flag-file.mjs's own wording character for
 * character, because the door refuses a bare `--<field>-file` BEFORE that
 * module is reached and its callers must see no change. The `int`/`cursor` arm
 * is the sentence the four hand-written integer guards in this file already
 * publish.
 *
 * `spec` may be ABSENT, and that is not a missing row: the shared `trace
 * append|close` body validates flags the `trace close` row deliberately does
 * not declare, because a flag row is a prose allowlist that never widens what
 * a subcommand accepts. Such a flag is named by `FLAG_SENTENCES` and needs no
 * type at all; the `string` default is what keeps the arm total.
 * @param {string} flag @param {{type: string}|undefined} spec @returns {string}
 */
function flagSentence(flag, spec) {
  const type = spec ? spec.type : 'string';
  if (FLAG_SENTENCES[flag]) return FLAG_SENTENCES[flag];
  if (flag.endsWith('-file')) return `needs a path after it: ${flag} <path>`;
  if (type === 'int' || type === 'cursor') return 'needs a non-negative integer';
  if (type === 'phase') return `needs a phase number: ${flag} <N>`;
  return `needs a value after it: ${flag} <value>`;
}

/**
 * The one refusal in this script whose wording depends on the VALUE rather than
 * on the flag, and which a declaration therefore cannot state at all.
 *
 * `renumber` is integer arithmetic - a decimal insertion like 2.1 neither
 * displaces integers nor is displaced by them - so a WELL-FORMED decimal is a
 * different repair from a missing or non-numeric value, and cmdRenumber
 * re-tested the value to say so. The declared `int` row refuses both spellings
 * at the door before that re-test can run, so the wording moved HERE rather
 * than being lost: without it a caller whose real problem is that 2.1 has to be
 * re-placed by hand is told "needs a non-negative integer". It is the same
 * species as the PRESENCE carve-out - a diagnostic no row can express stays
 * with the bin that owns the wording - and it reads a raw token the door
 * itself judged.
 *
 * The DECIMAL test is explicit rather than implied by `requirePhaseArg`, which
 * accepts a plain integer as readily as `2.1`. Implied, this sentence fired on
 * a well-formed `--at 1`, telling a caller to re-place a decimal they never
 * typed - reachable the moment the door began judging every occurrence of a
 * flag rather than its first, since `--at 1 --at` is a refusal whose first
 * token is an integer.
 * @param {string} key @param {string|undefined} raw @returns {string}
 */
function decimalRefusal(key, raw) {
  return key.startsWith('renumber ') && typeof raw === 'string'
    && raw.includes('.') && requirePhaseArg(raw).ok
    ? 'renumber operates on integer phases; re-place decimal phases by hand'
    : '';
}

/**
 * Compose the whole refusal detail for the flag the door refused.
 *
 * A flag on the script-global `'*'` row carries NO subcommand prefix - `--dir
 * needs a path after it` is the line every caller of every subcommand sees -
 * while a flag on a subcommand's own row is prefixed with that subcommand, the
 * way `detect-commands --root ...` and `trace append --role ...` already read.
 * @param {string} key the subcommand key the words resolved to
 * @param {string} flag @returns {string}
 */
function argRefusal(key, flag) {
  const table = CONTRACTS['planning.mjs'];
  const global = table['*'][flag];
  const spec = global || (table[key] || {})[flag];
  // EVERY occurrence is offered to the domain wording, because `evaluateRow`
  // names only the flag (D-07) and now judges every occurrence: the decimal a
  // caller has to re-place by hand is not always the first one they typed.
  let domain = '';
  for (let i = 0; i < ARGV.length && !domain; i++) {
    if (ARGV[i] === flag) domain = decimalRefusal(key, ARGV[i + 1]);
  }
  if (domain) return domain;
  return `${global ? '' : `${key} `}${flag} ${flagSentence(flag, spec)}`;
}

// The shared surface, exported as ONE list rather than by prefixing each
// declaration: every body above is then byte-identical to the one planning.mjs
// shipped, and `grep '^function <name>'` still finds each under its own name.
export {
  ARGV,
  DISPATCH_WINDOW_DEFAULTS,
  FLAG_SENTENCES,
  HERE,
  MANIFEST_PATH,
  PHASE_DIR_NAME,
  QUEUE_HOMES,
  RECORD_TOKEN,
  RISK_DIFF_MAX_BUFFER,
  argRefusal,
  decimalRefusal,
  derivePhases,
  fail,
  fireHome,
  fireIdentity,
  flagSentence,
  listPlanFiles,
  memoryBackend,
  ok,
  phaseSpellingCollision,
  phaseSpellingRefusal,
  planKey,
  pluginVersion,
  read,
  readJsonPayload,
  readQueue,
  readReadsRecords,
  resolveRange,
  riskRef,
  routeLadder,
};
