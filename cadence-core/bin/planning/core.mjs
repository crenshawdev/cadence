// @ts-check
// planning/core.mjs - shared core of the planning seam: envelope helpers, shared readers and the refusal composers
// ok, fail and read live here once; planning.mjs can't export them because importing it runs the dispatch
// a helper moves here once two handler families reach it; a second copy elsewhere is what helper-census.test.mjs stops
'use strict';

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync, lstatSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recordName } from '../lib/adjudication-record.mjs';
import { CONTRACTS } from '../lib/arg-contract.mjs';
import { mergeLayers } from '../lib/config-merge.mjs';
import { isQueueName, queueIdentity } from '../lib/deferred-queue.mjs';
import { PLAN_FILE } from '../lib/phase-plans.mjs';
import { parseUat, planName, uatComplete } from '../lib/planning-files.mjs';
import { READS_FILE, isReadsRotationMarker } from '../lib/read-trace.mjs';
import { redactUrl } from '../lib/redact-url.mjs';
import { requirePhaseArg, requireInt } from '../lib/require-int.mjs';
import { emit } from '../lib/seam-io.mjs';
import { testSeamOpen } from '../lib/test-seam.mjs';

// raw argument list: arg-contract flags need the spelling, and parseArgs collapses bare, empty and flag-shaped into one
const ARGV = process.argv.slice(2);

const ok = (o) => emit({ ok: true, ...o });

const fail = (reason, detail, hint) =>
  emit({ ok: false, reason, ...(detail ? { detail } : {}), ...(hint ? { hint } : {}) });

/** Read a file or return null - absence is data here, never a crash. */
function read(file) {
  try { return readFileSync(file, 'utf8'); } catch { return null; }
}

/**
 * Refusal detail for a `--phase` spelling the two write faces can't honour, or null.
 * `cursor set` and `seed-reqs` write the numeric half, so with both `phases/1.1/` and `phases/1.10/`, 1.10 hit 1.1.
 * The rule is the round trip `String(value) === raw`: `1.10`, `1.0` and `01` are refused, `2`, `2.1` and `10` pass.
 * Neither face can name `phases/1.10/` any more, and that's the price.
 * @param {{raw: string, value: number}} parsed a `requirePhaseArg` success
 * @returns {string|null}
 */
function phaseSpellingRefusal(parsed) {
  const canonical = String(parsed.value);
  if (canonical === parsed.raw) return null;
  return `--phase "${parsed.raw}" is written here as phase ${canonical}, a different phase`
    + ` - send --phase "${canonical}", or rename phases/${parsed.raw}/ to phases/${canonical}/`;
}


// the phase-directory grammar: a bare integer or an `N.M` sub-phase, neither part zero-padded, no slug suffix
// checked and reported here, never resolved, so the seams don't have to learn `08-meteogram-legend`
// the fraction gets the same `[1-9]` lead: `1.01` is a padded `1.1` and `2.0` isn't a fraction at all
// not the `String(Number(x)) === x` round trip, which passes `1.01` and fails `1.10`, legalizing the wrong one
// lives in core because status and recall use it too; their looser `/^\d+(\.\d+)?$/` let `phases/08/` land under 8
const PHASE_DIR_NAME = /^[1-9]\d*(?:\.[1-9]\d*)?$/;

/**
 * Refusal detail for a `--phase` spelling a path-resolving face can't honour on this tree, or null.
 * The harm is the mixed callsite: asking for 1.10 reads `phases/1.10/` but the envelope says `phase: 1.1`.
 * Unlike `phaseSpellingRefusal` it's tree-aware: it refuses only when the canonical spelling already exists on disk.
 * A symlink at the canonical path counts as present, since a reader would find something there.
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
// `cadence-core/bin`, not this directory: its consumers swallow read failures, so a wrong level answers ok:true
// resolve and not join, so it stays the same normalized absolute path planning.mjs computed
const HERE = resolvePath(dirname(fileURLToPath(import.meta.url)), '..');

// the one path read outside --dir, resolved from the script and not the cwd, so it names the plugin that's running
// CADENCE_PLUGIN_MANIFEST overrides it only under the test seam, silently: this resolves before a warning can go out
const MANIFEST_PATH = (testSeamOpen() && process.env.CADENCE_PLUGIN_MANIFEST)
  || join(HERE, '..', '..', '.claude-plugin', 'plugin.json');

/**
 * The running plugin's version, or null when the manifest is unreadable, malformed or has none.
 * Never throws: it's provenance, and a statement about the run mustn't be able to sink the run.
 * @returns {string|null}
 */
function pluginVersion() {
  try {
    const v = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')).version;
    return typeof v === 'string' ? v : null;
  } catch { return null; }
}

// status from artifacts: no PLAN unplanned, PLAN planned, SUMMARY without a fully passed UAT executed, else complete
function derivePhases(dir, roadmapPhases) {
  return roadmapPhases.map((p) => {
    const pdir = join(dir, 'phases', String(p.n));
    let plans = [];
    try {
      plans = readdirSync(pdir).filter((f) => PLAN_FILE.test(f)).sort();
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

// uat persistence: the script owns the invariants, the model owns the wording
/**
 * Reads a JSON payload from `--payload <file>`, else stdin, and returns a discriminated result.
 * A parse failure and a real `null` payload used to look alike, so `merge` exited 0 having printed nothing.
 * `ok:false` means a refusal is already emitted, so the caller returns without a second one.
 * Empty input is `no-payload`, not `bad-payload`: handing over nothing and the wrong shape are different repairs.
 * @param {string|boolean} [file] `opts.payload`; stdin when undefined
 * @returns {{ok: true, value: any} | {ok: false}}
 */
function readJsonPayload(file) {
  let text;
  let where = 'stdin';
  if (file !== undefined) {
    // a valueless flag parses as boolean true, so refuse it here before it reaches readFileSync
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
 * `memory.backend` effective across the config layers (repo over global), plus the layer warnings.
 * One reader so `cmdRecall` and `cmdCiteCount` can't disagree on the off switch; unset means on (`builtin`).
 * Warnings are returned, not surfaced: a torn layer reads as absent and flips a deliberate `none` back to `builtin`.
 */
function memoryBackend(dir) {
  const { config, warnings } = mergeLayers(join(dir, 'config.json'));
  return { backend: config?.memory?.backend ?? 'builtin', warnings };
}

// one phase dir's plan files, conforming (`PLAN.md`, `PLAN-N.md`) apart from other `PLAN*.md`, which once went unseen
// `missing: true` flags an unreadable dir, or plan-overlap would read it as a clean pass and execute would run parallel
function listPlanFiles(pdir) {
  let entries;
  try { entries = readdirSync(pdir); }
  catch { return { plans: [], nonconforming: [], missing: true }; }
  const plans = [];
  const nonconforming = [];
  for (const f of entries) {
    if (PLAN_FILE.test(f)) plans.push(f);
    else if (f.startsWith('PLAN') && f.endsWith('.md')) nonconforming.push(f);
  }
  return { plans: plans.sort(), nonconforming: nonconforming.sort() };
}

// one definition of "this plan's report says it is complete", since replay-check and status both decide from it
// `report` is relative to pdir, and the caller owns the `phases/<spelling>/` prefix: replay-check and status differ
/** `PLAN-<k>.md` is k and a bare `PLAN.md` is 1, matching the path the executor writes its report to. */
const planNumber = (f) => Number(/^PLAN-(\d+)\.md$/.exec(f)?.[1] ?? 1);

/** Only the first line, trimmed: a `PLAN COMPLETE` quoted in a Note is prose about a status, not a claim of one. */
const firstLine = (body) => (body == null ? null
  : body.slice(0, body.indexOf('\n') === -1 ? undefined : body.indexOf('\n')).trim());

/**
 * @param {string} pdir the phase directory
 * @param {string[]} plans that directory's conforming plan filenames
 * @returns {{plan: string, k: number, report: string, exists: boolean,
 *   status: string|null, complete: boolean}[]}
 */
function readPlanReports(pdir, plans) {
  return plans.map((plan) => {
    const k = planNumber(plan);
    // the exact filename, never a plan-*.md glob: report-rotation mints plan-<k>.<n>.md siblings an old one would win
    const report = join('reports', `plan-${k}.md`);
    const status = firstLine(read(join(pdir, report)));
    return { plan, k, report, exists: status !== null, status,
      complete: status === 'PLAN COMPLETE' };
  });
}

// where one phase's plans stand: the plan to run next, by position
// K is the lowest plan number whose report isn't complete, not the first list entry: listPlanFiles sorts lexically
// J is the count of conforming plans, and the name comes from planName and is left off when the heading gives none
// null when the dir is missing, has no plan or every plan is complete; `cursor set` and `status` share it
// @param {string} pdir the phase directory
// @returns {{k: number, j: number, name?: string}|null}
function planPosition(pdir) {
  const { plans } = listPlanFiles(pdir);
  const next = readPlanReports(pdir, plans).filter((r) => !r.complete)
    .sort((a, b) => a.k - b.k)[0];
  if (!next) return null;
  const name = planName(read(join(pdir, next.plan)) ?? '');
  return { k: next.k, j: plans.length, ...(name ? { name } : {}) };
}

/**
 * The one `.planning/reads.jsonl` parse, shared by `cmdReads` and `trace suggest`, so the partial-tail rule lives once.
 * It reports `absent` and `unreadable` apart and decides nothing: `reads` fails on unreadable, `trace suggest` warns.
 * The rotation marker is dropped and reported as `rotated`, or it bills as a call and shows up as a phantom read.
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
    // a truncated last line is skipped, not fatal: a hook appends this file and can be killed mid-write
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
 * Per-role dispatch-window ceilings the `window` arm falls back to when no config layer sets one.
 * `config.schema.json` is the source of truth; this map is here because the seam reads merged config, not the schema.
 * Change one place and not the other and the report disagrees with the row a user reads before setting the key.
 */
const DISPATCH_WINDOW_DEFAULTS = Object.freeze({
  'cad-planner': 200000,
  'cad-assumptions-analyzer': 150000,
  'cad-verifier': 100000,
  'cad-reviewer': 150000,
  'cad-executor': 200000,
  'cad-plan-checker': 75000,
});

// the schema row whose `values` array is each named ladder
// explicit map, no default branch: a fall-through gave risk-check the gate ladder for its surface list
const LADDER_ROWS = Object.freeze({
  gates: 'review.triggers.plan.gate',
  risk_surface_categories: 'review.triggers.risk_surface.surfaces',
});

/**
 * One ordered ladder, or undefined when it isn't a non-empty array of non-empty strings.
 * The `values` arrays of the LADDER_ROWS rows in schema order, gates weakest first; route.mjs depends on that.
 * It ignores CADENCE_CONFIG_SCHEMA: an env-supplied ladder would decide what a gate suggestion says to set.
 * An unreadable schema means no ladder, so the gate arm omits `proposed`, and nothing is ever substituted from memory.
 * @param {string} key
 * @returns {string[]|undefined}
 */
function routeLadder(key) {
  const ok = (ladder) => (Array.isArray(ladder) && ladder.length
    && ladder.every((g) => typeof g === 'string' && g) ? [...ladder] : undefined);
  const row = Object.prototype.hasOwnProperty.call(LADDER_ROWS, key) ? LADDER_ROWS[key] : null;
  if (!row) return undefined;
  try {
    const schema = JSON.parse(readFileSync(join(HERE, '..', 'config.schema.json'), 'utf8'));
    return ok(schema?.keys?.[row]?.values);
  } catch { /* unreadable schema: no ladder, and the omission says so */ }
  return undefined;
}

/** Most of a `git diff` we read. Oversize is a reported state (`checked:false`), never a throw with no answer. */
const RISK_DIFF_MAX_BUFFER = 32 * 1024 * 1024;

/**
 * A ref the caller stated, or null.
 * A leading `-` is refused: git would read it as an option, and the gate could be told to look at something else.
 * @param {any} raw
 */
function riskRef(raw) {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t || t.startsWith('-')) return null;
  return t;
}

/**
 * One git read, and the only catch in this region, so the failure shape is built once.
 * redactUrl on the message because a git failure can carry a remote URL with credentials.
 * One wrapped catch also keeps the `planning-detail-sites` census where it stands.
 * @param {string[]} args
 * @returns {{ok: boolean, out: string, error: string}}
 */
function gitLine(args) {
  try {
    return {
      ok: true,
      out: execFileSync('git', args,
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(),
      error: '',
    };
  } catch (e) {
    return { ok: false, out: '', error: redactUrl(e && e.message ? e.message : String(e)) };
  }
}

/**
 * One end of a range: the repository, and the commit id one caller ref names.
 * Separate because `risk-check`'s staged arms call it for a lone `--base`, and resolveRange must stay rev-only.
 * `error` opens with `base` or `head`, then the spelling, then git's message, so a refusal says which half to fix.
 * `^{commit}` makes a tag resolve to its commit and a ref naming no commit an error; a leading `-` is already refused.
 * `top` is probed here unless the caller resolved it; an unreadable toplevel fails with git's message, no end name.
 * @param {string} end @param {string} ref @param {string} [top]
 * @returns {{ok: boolean, top: string, id: string, error: string}}
 */
function resolveRef(end, ref, top) {
  let where = top;
  if (where === undefined) {
    const probe = gitLine(['rev-parse', '--show-toplevel']);
    if (!probe.ok) return { ok: false, top: '', id: '', error: probe.error };
    where = probe.out;
  }
  const r = gitLine(['-C', where, 'rev-parse', '--verify', `${ref}^{commit}`]);
  return r.ok
    ? { ok: true, top: where, id: r.out, error: '' }
    : { ok: false, top: where, id: '', error: `${end} ${ref}: ${r.error}` };
}

/**
 * The other end of a staged scope: the index's content identity.
 * The index is mutable, so keying on the base alone let `status` match a record over contents nothing ever scanned.
 * `git write-tree` names the contents and writes only a tree object, no ref or index change, so reporting can use it.
 * An index git can't name (unmerged entries) is a refusal whose error opens with `index`, since it has no identity.
 * `top` is the caller's resolved toplevel, so identity and diff come from one repository and one index file.
 * @param {string} top
 * @returns {{ok: boolean, id: string, error: string}}
 */
function resolveIndex(top) {
  const r = gitLine(['-C', top, 'write-tree']);
  return r.ok
    ? { ok: true, id: r.out, error: '' }
    : { ok: false, id: '', error: `index: ${r.error}` };
}

/**
 * The repository, and the commit ids a caller's two refs name.
 * Range identity is the commit pair, never the ref spelling, or a record from one HEAD satisfies a later, wider one.
 * An unresolvable ref is a refusal at both call sites, never a match.
 * `base` and `head` hold the id of the end that resolved and '' for the one that didn't; `error` names the failing end.
 * One shape, no `ok` union: CI typechecks with strict off, where JSDoc unions don't narrow and callers need casts.
 * @param {string} base @param {string} head
 * @returns {{ok: boolean, top: string, base: string, head: string, error: string}}
 */
function resolveRange(base, head) {
  const probe = gitLine(['rev-parse', '--show-toplevel']);
  if (!probe.ok) return { ok: false, top: '', base: '', head: '', error: probe.error };
  const b = resolveRef('base', base, probe.out);
  const h = resolveRef('head', head, probe.out);
  return {
    ok: b.ok && h.ok,
    top: probe.out,
    base: b.id,
    head: h.id,
    // both failures joined, base first: told about one bad end, a caller fixes it and meets the second next run
    error: [b, h].filter((e) => !e.ok).map((e) => e.error).join('; '),
  };
}

/**
 * A plan identity as one spelling: `trace append --plan` stores a string, `risk-check run` a number, so stringify both.
 * No plan keys to '' and is still carried, since an unidentified range isn't an exempt one. `corr` is stringified too.
 * @param {any} v
 */
const planKey = (v) => (v === undefined || v === null ? '' : String(v));

/**
 * The spelling `--trigger` and `--discriminator` may carry: the character set the on-disk REVIEW names already use.
 * Refused, never sanitized, because both reach a filename: a merely trimmed `--label` once escaped the tree.
 * No separator, no `.` (the `.json` suffix stays ours) and no leading `-`, so nothing later reads it as an option.
 */
const RECORD_TOKEN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/**
 * The identity a fire's artifact is filed under, validated once: phase as spelled, two tokens, re-arm round, two refs.
 * Shared because `adjudication` and `deferred record` write into one directory and could disagree on the fire.
 * It emits its own refusal and answers null, like readJsonPayload, so the caller's arm is `if (!id) return;`.
 * @param {string} face the subcommand's spelling, for every refusal's wording
 * @param {string} dir the planning directory, for the tree-aware spelling check
 * @param {any} opts
 * @returns {{n: string, trigger: string, discriminator: string, round: number,
 *            base: string, head: string, task?: string} | null}
 *   `task` is only there when the fire named one.
 */
function fireIdentity(face, dir, opts) {
  const parsedPhase = requirePhaseArg(opts.phase);
  if (!parsedPhase.ok) {
    fail('bad-args', `${face} needs --phase <N>`,
      `pass --phase <N> for the phase this fire belongs to, then re-run the ${face}`);
    return null;
  }
  // before the token rails and fireHome, whose `no-phase-dir` names the right directory but neither fix
  const collision = phaseSpellingCollision(dir, parsedPhase);
  if (collision) {
    fail('bad-args', `${face} ${collision}`,
      `re-run the ${face} with one of those two spellings - nothing was written`);
    return null;
  }
  // the caller's own spelling, as uatFile addresses a phase: only ever a path or a label, never arithmetic
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

  // the re-arm round: without it a blocking re-arm's artifact replaces round one's, the record an auditor reads
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

  // both required, neither defaulted, like `risk-check run`: a defaulted head is a range the caller never stated
  const base = riskRef(opts.base);
  const head = riskRef(opts.head);
  if (!base || !head) {
    fail('bad-args', `${face} needs --base <ref> and --head <ref>, neither opening with \`-\``,
      `name both ends of the range this fire reviewed, as refs this repository can resolve, then`
      + ` re-run the ${face}`);
    return null;
  }

  // the task's home gets the same rail because it reaches a path; absent is an ordinary phase fire
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

  // 0 is the task number, not a phase: `/cad-task` fires with it because no roadmap phase carries it
  // without this guard a task fire that forgot --task fell into the phase branch and a `phases/0/` took the record
  if (n === '0' && task === undefined) {
    fail('bad-args',
      `${face} --phase 0 is a TASK's number and resolves no phase home - a task keeps its `
      + 'record beside the sibling REVIEW file under .planning/tasks/<slug>/',
      'pass --task <slug> naming the task directory. `deferred record` does not take it: the '
      + 'queue enumeration reads the two phase homes only, so a member written under a slug '
      + 'would never be found, and a blocking gate is the one that has to be');
    return null;
  }

  // the converse: --task with a phase other than 0 filed under the slug and left the phase's REVIEW file unsettled
  // fireHome can't catch it: task is taken as the chosen home, and `0.1` is a phase since it's compared as spelled
  if (n !== '0' && task !== undefined) {
    fail('bad-args',
      `${face} --task is a TASK's home and --phase ${n} is a roadmap phase's - one fire cannot `
      + 'be both, and the record would land under the slug while the sibling REVIEW file under '
      + `phases/${n}/ stayed unsettled`,
      'a task fire passes --phase 0 with --task <slug>, because 0 is the one number no roadmap '
      + `phase carries; a phase fire passes --phase ${n} and no --task at all. Drop whichever of `
      + 'the two names the fire this is not');
    return null;
  }

  return { n, trigger, discriminator, round, base, head, task };
}

/**
 * The directory a fire's artifact is written into, or null once the refusal is out.
 * It sits beside the sibling REVIEW file, never in `<plandir>/reports/`, where lease-check exempts only one path.
 * A task names its own home (`.planning/tasks/<slug>/`), the only one tried; else `phases/<N>/`, then `deferred/<N>/`.
 * @param {string} dir @param {string} n the phase as the caller spelled it
 * @param {string} what the artifact, for the refusal's wording
 * @param {string} [task] the task slug, when this fire is a task's
 * @returns {string|null}
 */
/**
 * Is `<dir>/<name>` a real directory, present and not a symlink?
 * lstat follows a symlinked parent in passing, so the parent gets the same test as the leaf.
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
 * Every unadjudicated queue member under dir, and everything in the two homes that couldn't be proven to hold none.
 * One derivation for `deferred list` and `status`, so `/cad-land` and `/cad-progress` can't disagree on what's queued.
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
  // redactUrl on every message: a land refusal prints these, and they can carry a path nobody wants published
  const why = (/** @type {any} */ e) => redactUrl(e && e.message ? e.message : String(e));

  for (const home of QUEUE_HOMES) {
    let entries;
    try { entries = readdirSync(join(dir, home), { withFileTypes: true }); } catch (e) {
      // ENOENT is absence (`deferred/` only exists once a close carried something); anything else might hide a queue
      if (e && /** @type {any} */ (e).code === 'ENOENT') continue;
      unreadable.push({ path: `${home}/`, detail: why(e) });
      continue;
    }
    for (const ent of entries) {
      if (wantPhase !== null && ent.name !== wantPhase) continue;
      const rel = `${home}/${ent.name}`;
      // withFileTypes classifies the link, not its target: a symlink where a phase directory belongs is refused
      if (ent.isSymbolicLink()) {
        unreadable.push({ path: rel, detail: 'a symlink where a phase directory should be - not followed' });
        continue;
      }
      // a regular file here holds no queue member, only a directory can
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
        // a member's phase must match its directory, or a hand move makes --phase narrow to a phase it doesn't claim
        if (id.phase !== ent.name) {
          unreadable.push({ path, detail: `queue member says phase ${id.phase} but sits in ${rel}/` });
          continue;
        }
        // supersession is one filename comparison, regular files only, or a link to anything could clear a queue
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
  // sorted so a refusal prints the same list twice running and the two homes interleave by phase
  members.sort((a, b) => a.path.localeCompare(b.path));
  unreadable.sort((a, b) => a.path.localeCompare(b.path));
  return { members, findings: members.reduce((n, m) => n + m.findings, 0), unreadable };
}

// refusal wording for the flags this script's rows declare: arg-contract names the flag and nothing else
// bad-args, never the missing-flag-value throw: this file has no e.seam catch arm, so that would read as internal
// only the spellings that already ship are listed; the rest compose from the flag's name and declared type
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
 * The `-file` arm repeats lib/text-flag-file.mjs's wording exactly: the door refuses a bare `--<field>-file` first.
 * `spec` can be absent: the shared `trace append|close` body validates flags `trace close` doesn't declare.
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
 * The one refusal whose wording depends on the value, not the flag, so no declaration can state it.
 * `renumber` is integer arithmetic, so a well-formed decimal like 2.1 is a different repair from a bad value.
 * The decimal test is explicit: `requirePhaseArg` accepts `1` as readily as `2.1`, and `--at 1 --at` fired on it.
 * @param {string} key @param {string|undefined} raw @returns {string}
 */
function decimalRefusal(key, raw) {
  return key.startsWith('renumber ') && typeof raw === 'string'
    && raw.includes('.') && requirePhaseArg(raw).ok
    ? 'renumber operates on integer phases; re-place decimal phases by hand'
    : '';
}

/**
 * Composes the whole refusal detail for the flag the door refused.
 * A flag on the global `'*'` row has no subcommand prefix (`--dir needs a path after it`); others get one.
 * @param {string} key the subcommand key the words resolved to
 * @param {string} flag @returns {string}
 */
function argRefusal(key, flag) {
  const table = CONTRACTS['planning.mjs'];
  const global = table['*'][flag];
  const spec = global || (table[key] || {})[flag];
  // every occurrence goes to the domain wording: evaluateRow names only the flag, and the decimal may not be first
  let domain = '';
  for (let i = 0; i < ARGV.length && !domain; i++) {
    if (ARGV[i] === flag) domain = decimalRefusal(key, ARGV[i + 1]);
  }
  if (domain) return domain;
  return `${global ? '' : `${key} `}${flag} ${flagSentence(flag, spec)}`;
}

// one export list, so every body above stays byte-identical to what planning.mjs shipped
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
  readPlanReports,
  planPosition,
  readQueue,
  readReadsRecords,
  resolveIndex,
  resolveRange,
  resolveRef,
  riskRef,
  routeLadder,
};
