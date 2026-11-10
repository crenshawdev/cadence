#!/usr/bin/env node
// @ts-check
// self-verify.mjs - the prose kept naming flags, keys and paths the code didn't have, so CI checks all
// three across the live prose surfaces (workflows, references, skills, agents, templates, docs, README,
// INTERNALS, METHOD) and the registers behind the prose rules. DESIGN, LINEAGE and CHANGELOG aren't
// read, they name cut keys on purpose. Each check keeps its reason at its own code.
// Seam convention: one JSON line on stdout, exit 0 clean / 1 problems found.
// Usage: self-verify.mjs [--root <repo root>]
'use strict';

import { readFileSync, readdirSync, existsSync, statSync, lstatSync, readlinkSync, realpathSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emit, emitCaught } from './lib/seam-io.mjs';
import { weighAll } from './lib/surface-weight.mjs';
import {
  rungBodyIssue, rungEffortIssue, rungPrefixIssues, rungFile, effortEnumIssues,
  RUNG_FILES, RUNG_ORDER,
} from './lib/rung-agent.mjs';
import { gateAgreementIssues } from './lib/gate-agreement.mjs';
import { settingExplanationIssues } from './lib/setting-explanations.mjs';
import { settingConditionIssues } from './lib/setting-conditions.mjs';
import { plainWordsIssues } from './lib/plain-words.mjs';
import { parseReachTable, reachIssues } from './lib/config-reach.mjs';
import { globalOnlyMarkerIssues } from './lib/global-only-keys.mjs';
import { dispatchPhrasingIssues } from './lib/dispatch-phrasing.mjs';
import { relayIssues } from './lib/route-relay.mjs';
import { dataRuleIssues } from './lib/data-rule.mjs';
import { mergeWarningIssues } from './lib/merge-warnings.mjs';
import { FRONTMATTER_RE, parseSkillsField } from './lib/frontmatter.mjs';
import { deferredReadIssues, DEFERRED_READS } from './lib/deferred-reads.mjs';
import { referenceRouterIssues } from './lib/reference-routers.mjs';
import { includeConsumerIssues } from './lib/include-consumers.mjs';
import { refusalHintIssues } from './lib/refusal-hints.mjs';
import { textTransportIssues } from './lib/text-transport.mjs';
import { bulkOutputIssues } from './lib/bulk-output.mjs';
import { scratchPathIssues } from './lib/scratch-path.mjs';
import { captureWriterIssues } from './lib/capture-writers.mjs';
import { hookEventIssues } from './lib/hook-events.mjs';
// the flag table, its accessor and the evaluator are defined in lib/arg-contract.mjs and imported, not restated
import { CONTRACTS, flagNames, evaluateFlag, subcommandKey } from './lib/arg-contract.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Check 13's register, or the file CADENCE_DEFERRED_READS points at. Ungated, unlike CADENCE_ROUTE_TABLE and
 * CADENCE_CONFIG_SCHEMA: it redirects what a linter reads, not data a gate decides from. The rule takes its
 * rows as a parameter so a test can anchor a synthetic row at a real workflow file. An unusable override is
 * reported, never swapped for the shipped rows, so a fixture whose seam missed fails loudly.
 * @param {{kind: string, file: string, detail: string}[]} problems
 * @returns {ReadonlyArray<{skill: string, reference: string,
 *   anchors: readonly string[], read_paragraphs: number, file?: string}>}
 */
function deferredRows(problems) {
  const path = process.env.CADENCE_DEFERRED_READS;
  if (!path) return DEFERRED_READS;
  try {
    const rows = JSON.parse(readFileSync(path, 'utf8'));
    if (!Array.isArray(rows)) throw new Error('not an array of register rows');
    return rows;
  } catch (e) {
    problems.push({ kind: 'unreadable-surface', file: path,
      detail: `CADENCE_DEFERRED_READS: ${e && e.message ? e.message : String(e)}` });
    return [];
  }
}

// check 9's reach table, root-relative and platform-separated to match a relative(root, file) result
const REACH_DOC = join('cadence-core', 'references', 'config-reach.md');

// check 10's surfaces; the appended separator keeps a sibling directory with the same prefix from matching
const WORKFLOWS_DIR = join('cadence-core', 'workflows') + sep;
const REFERENCES_DIR = join('cadence-core', 'references') + sep;

// LSP is also on the two cad-executor rungs' tools: lines, and both are needed: a token missing here is never scanned
const KNOWN_TOOLS = ['Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'Grep',
  'Glob', 'Task', 'WebFetch', 'WebSearch', 'NotebookEdit', 'TodoWrite', 'LSP'];

// --- helpers -----------------------------------------------------------------

/**
 * Yield every `.md` surface this linter reads as `{ file }`, plus a `{ file, unreadable }` marker for each
 * directory whose listing threw. Walks entry by entry: one recursive read in a single try returns nothing
 * for the whole subtree when one descendant throws, and the old fallback blamed the branch root with the
 * errno of a failed read (#49.1). Only isDirectory() descends, so symlinked directories are skipped like
 * lib/surface-weight.mjs does and reporting and enforcing see the same set.
 * @param {string} root
 * @returns {Generator<{ file: string, unreadable?: string }>}
 */
function* mdFiles(root) {
  const dirs = [
    join(root, 'cadence-core', 'workflows'),
    join(root, 'cadence-core', 'references'),
    join(root, 'cadence-core', 'templates'),
    join(root, 'skills'),
    join(root, 'agents'),
    // docs/ holds the published pages; left off the walk, a claim stops being enforced the moment it moves there
    join(root, 'docs'),
  ];
  /** @param {string} dir @returns {Generator<{ file: string, unreadable?: string }>} */
  function* walk(dir) {
    let list;
    try {
      list = readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      // this directory alone is the unreadable surface, with its own errno, and its siblings still get linted
      yield { file: dir, unreadable: e.code || e.message };
      return;
    }
    for (const d of list) {
      const f = join(dir, d.name);
      if (d.isDirectory()) {
        yield* walk(f);
        continue;
      }
      if (!f.endsWith('.md')) continue;
      // optimistic on a throw: a dangling symlink or a cycle still reaches the reporter instead of vanishing
      let isFile;
      try {
        isFile = statSync(f).isFile();
      } catch {
        isFile = true;
      }
      if (isFile) yield { file: f };
    }
  }
  for (const d of dirs) {
    if (!existsSync(d)) continue;
    yield* walk(d);
  }
  // README, INTERNALS and METHOD are live too; the historical docs stay out because they name cut keys
  for (const doc of ['README.md', 'INTERNALS.md', 'METHOD.md']) {
    const p = join(root, doc);
    if (existsSync(p)) yield { file: p };
  }
}

// --- workflow scripts (D-21) ----------------------------------------------------

// strings and comments in one pass, so an apostrophe in a comment can't open a string; strings become "",
// comments a space and a template keeps one backtick, so the purity test still sees it
const SCRIPT_TOKENS = /\/\/[^\n]*|\/\*[\s\S]*?\*\/|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g;
const codeOnly = (/** @type {string} */ t) => t.replace(SCRIPT_TOKENS, (m) => (m.startsWith('/') ? ' ' : m.startsWith('`') ? '`' : '""'));

/**
 * The problems in one workflow script, by kind. The host skips an invalid `meta` with only a log line, and a named
 * workflow can be started with no args, so both are CI's to catch. Parses the text, and evaluates only a `meta`
 * literal that holds no call, name or template; a script's body is never run.
 * @param {string} text @param {string} rel
 */
function workflowScriptIssues(text, rel) {
  /** @type {{kind: string, file: string, detail: string}[]} */
  const out = [];
  const bad = (/** @type {string} */ kind, /** @type {string} */ detail) => out.push({ kind, file: rel, detail });
  const m = /^export const meta = (\{[\s\S]*?\n\});?[ \t]*(?:\n|$)/.exec(text);
  if (!m) {
    bad('workflow-meta-invalid', 'the script must begin with `export const meta = {...}` closed by a } at column 0');
    return out;
  }
  const lit = codeOnly(m[1]);
  const idents = [...lit.matchAll(/[A-Za-z_$][\w$]*/g)];
  const impure = /[()`]|=>|\.\.\./.test(lit)
    || idents.some((i) => !['true', 'false', 'null'].includes(i[0]) && !/^\s*:/.test(lit.slice(i.index + i[0].length)));
  let meta;
  if (!impure) { try { meta = vm.runInNewContext(`(${m[1]})`, Object.create(null), { timeout: 100 }); } catch { /* reported below */ } }
  if (impure || !meta || typeof meta !== 'object') bad('workflow-meta-invalid', 'meta must be a pure literal: no calls, names or templates');
  else for (const k of ['name', 'description']) {
    if (typeof meta[k] !== 'string' || !meta[k].trim()) bad('workflow-meta-invalid', `meta.${k} must be a non-blank string`);
  }
  const body = text.slice(m[0].length);
  try { new vm.Script(`(async function () {\n${body}\n})`); }
  catch (e) { bad('workflow-script-syntax', e && e.message ? e.message : String(e)); }
  const code = codeOnly(body);
  const call = code.search(/\bagent\s*\(/);
  const guard = code.search(/\bargs\b/);
  // a mention of args only guards if a return or throw can stop the script before the first agent( call
  // and a helper's `return await agent(` is the call itself, so that return doesn't count
  if (call >= 0 && (guard < 0 || guard > call || !/\b(?:return|throw)\b/.test(code.slice(guard, call).replace(/\breturn\s+(?:await\s+)?$/, '')))) {
    bad('workflow-no-args-guard', 'args is not tested, with a return or throw to stop on it, before the first agent( call');
  }
  return out;
}

/**
 * Every `.mjs` source under cadence-core/bin, for check 12; mdFiles only walks `.md`. Skips tests, whose
 * fixtures hold any shape, including the ones this rule pins, and lib/config-merge.mjs, which defines
 * mergeLayers and has nothing upstream to surface warnings to. Guarded per entry like mdFiles, so one
 * unreadable descendant hides only its own children. `{ every: true }` drops both skips and the extension
 * filter for check 15: a NUL in a test or a JSON file hides it from grep as well as one in a seam does.
 * @param {string} root
 * @param {{ every?: boolean }} [opts]
 * @returns {Generator<{ file: string, unreadable?: string }>}
 */
function* binFiles(root, opts = {}) {
  const every = opts.every === true;
  const binDir = join(root, 'cadence-core', 'bin');
  const skip = join(binDir, 'lib', 'config-merge.mjs');
  /** @param {string} dir @returns {Generator<{ file: string, unreadable?: string }>} */
  function* walk(dir) {
    let list;
    try {
      list = readdirSync(dir, { withFileTypes: true });
    } catch (e) {
      yield { file: dir, unreadable: e.code || e.message };
      return;
    }
    for (const d of list) {
      const f = join(dir, d.name);
      if (d.isDirectory()) {
        yield* walk(f);
        continue;
      }
      if (every) {
        if (!d.isFile()) continue;
        yield { file: f };
        continue;
      }
      if (!f.endsWith('.mjs') || f.endsWith('.test.mjs') || f === skip) continue;
      yield { file: f };
    }
  }
  if (!existsSync(binDir)) return;
  yield* walk(binDir);
}

/**
 * Expand <t>/<trigger>/<name>/<role> placeholders into every concrete key they stand for, across all of
 * them. `review.triggers.<t>.tier` covers every trigger's tier key, so one representative would under-cover
 * the reverse check. `<role>` is the only way to reach a role-named key: the tokenizer's segment class stops
 * at a hyphen, so `roles.cad-planner.model` reduces to `roles.cad` and matches no key.
 * @param {string} token @param {string[]} triggers @param {string[]} providers
 * @param {string[]} [roles]
 */
function expand(token, triggers, providers, roles) {
  let out = [token];
  const subst = (list, re, values) =>
    list.flatMap((t) => re.test(t) ? values.map((v) => t.replace(re, v)) : [t]);
  out = subst(out, /<t(?:rigger)?>?/g, triggers);
  out = subst(out, /<(?:name|provider)>?/g, providers);
  out = subst(out, /<role>?/g, Array.isArray(roles) ? roles : []);
  return out;
}

// --- check 26: the directory's file limits ----------------------------------

const MAX_FILE_BYTES = 262144;
const MAX_ENTRIES = 512;
// Images and fonts are exempt from the size limit only. SVG counts as an image.
const SIZE_EXEMPT = /\.(png|jpe?g|gif|webp|avif|bmp|ico|svg|tiff?|woff2?|ttf|otf|eot)$/i;

/**
 * Latin1 strings, one char per raw byte, so a name that isn't UTF-8
 * still reaches lstat instead of decoding to U+FFFD and missing.
 * @param {string} root
 * @param {string} rel
 */
const bytePath = (root, rel) =>
  Buffer.concat([Buffer.from(root), Buffer.from(rel ? `/${rel}` : '', 'latin1')]);

/**
 * The files that ship from `root`, as root-relative `/` paths in latin1, plus the folder count: `git
 * ls-files` when root is its work tree's top level, a walk otherwise. Folders are every ancestor of a listed
 * path, so `skills/`, which holds only folders, still counts the way `git ls-tree -r -d` does.
 * @param {string} root
 * @returns {{ files: string[], folders: number }}
 */
function shippedEntries(root) {
  try {
    // the target's own .git/config can set core.fsmonitor to a command, and reading the index would run it
    const git = (/** @type {string[]} */ args) =>
      execFileSync('git', ['-c', 'core.fsmonitor=false', '-C', root, ...args],
        { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
    const top = git(['rev-parse', '--show-toplevel']).toString('utf8').trim();
    if (top && realpathSync(top) === realpathSync(root)) {
      // An unmerged path is listed once per stage.
      const files = [...new Set(git(['ls-files', '-z']).toString('latin1').split('\0').filter(Boolean))];
      const dirs = new Set();
      for (const f of files) {
        for (let i = f.indexOf('/'); i !== -1; i = f.indexOf('/', i + 1)) dirs.add(f.slice(0, i));
      }
      return { files, folders: dirs.size };
    }
  } catch { /* not a git top level, or no git: walk instead */ }
  const files = [];
  let folders = 0;
  const visit = (/** @type {string} */ rel) => {
    let entries;
    try { entries = readdirSync(bytePath(root, rel), { withFileTypes: true, encoding: 'buffer' }); } catch { return; }
    for (const e of entries) {
      const name = e.name.toString('latin1');
      if (!rel && name === '.git') continue;
      const r = rel ? `${rel}/${name}` : name;
      if (e.isDirectory()) { folders++; visit(r); } else files.push(r);
    }
  };
  visit('');
  return { files, folders };
}

/**
 * Check 26's problems: a non-exempt file over MAX_FILE_BYTES, and files plus folders over MAX_ENTRIES.
 * @param {string} root
 */
function directoryLimitIssues(root) {
  const problems = [];
  const { files, folders } = shippedEntries(root);
  for (const f of files) {
    if (SIZE_EXEMPT.test(f)) continue;
    let size;
    try { size = lstatSync(bytePath(root, f)).size; } catch { continue; }
    if (size > MAX_FILE_BYTES) {
      problems.push({ kind: 'oversize-file', file: Buffer.from(f, 'latin1').toString('utf8'),
        detail: `${size} bytes, over the directory's ${MAX_FILE_BYTES}-byte limit for a file that is not an image or font` });
    }
  }
  const total = files.length + folders;
  if (total > MAX_ENTRIES) {
    problems.push({ kind: 'too-many-entries', file: '.',
      detail: `${files.length} files and ${folders} folders make ${total} entries, over the directory's limit of ${MAX_ENTRIES}` });
  }
  return problems;
}

// --- checks ------------------------------------------------------------------

function run(root) {
  const problems = [];
  // plugin.json marks a real install; a fixture lacks it and stays lenient, a full tree missing an input fails (#44)
  const isFullTree = existsSync(join(root, '.claude-plugin', 'plugin.json'));
  const schema = JSON.parse(
    readFileSync(join(root, 'cadence-core', 'config.schema.json'), 'utf8')).keys;
  const schemaKeys = Object.keys(schema);
  const FAMILIES = new Set(schemaKeys.map((k) => k.split('.')[0]));
  const NON_KEY_SEGMENT = new Set(['md', 'json', 'mjs', 'test', 'schema']);
  const TRIGGERS = [...new Set(schemaKeys
    .filter((k) => k.startsWith('review.triggers.')).map((k) => k.split('.')[2]))];
  const PROVIDERS = [...new Set(schemaKeys
    .filter((k) => k.startsWith('review.providers.')).map((k) => k.split('.')[2]))];
  // read off the schema like the lists above, so a seventh role is a schema edit and no rule moves
  const ROLES = [...new Set(schemaKeys
    .filter((k) => k.startsWith('roles.')).map((k) => k.split('.')[1]))];
  // keys with no dot never match the dotted-token regex, so a bare-word mention covers them
  const BARE_KEYS = schemaKeys.filter((k) => !k.includes('.'));

  const seenTokens = new Set();

  // 0. a full tree missing a core surface dir is a real break (#44), a fixture that omits one is not
  if (isFullTree) {
    for (const d of ['cadence-core/workflows', 'cadence-core/references',
      'cadence-core/templates', 'skills', 'agents', 'workflows']) {
      if (!existsSync(join(root, d))) {
        problems.push({ kind: 'missing-input', file: d, detail: 'core surface dir absent' });
      }
    }
  }

  // checks 1 to 3 over one text; feedSeen says whether its tokens count as a reader for 1b, tag prefixes each detail
  const lintProse = (text, rel, feedSeen, tag) => {
    // 1. config keys, URLs masked first: a hostname like git.jcrenshaw.dev reads as a `git.*` key and matches nothing
    const scanText = text.replace(/https?:\/\/[^\s)\]}>'"`]*/g, ' ');
    for (const m of scanText.matchAll(/\b([a-z_]+(?:\.[a-z_0-9<>]+)+)/g)) {
      // A closing placeholder bracket can trail the token (`<review.consult.effort>`).
      const raw = m[1].replace(/>+$/, '');
      const family = raw.split('.')[0];
      if (!FAMILIES.has(family)) continue;
      if (raw.split('.').some((seg) => NON_KEY_SEGMENT.has(seg))) continue;
      const expansions = expand(raw, TRIGGERS, PROVIDERS, ROLES);
      // the reach table names every key, so feeding seenTokens would make 1b's inert-config-key unreachable. It
      // still gets the forward scan below, or a dead token in its prose would be scanned by nothing.
      if (feedSeen) for (const t of expansions) seenTokens.add(t);
      // . and - end a token (hyphenated keys tokenize short), _ doesn't, so `git.on` still fails `git.on_protected`
      const known = expansions.some((t) =>
        schemaKeys.some((k) => k === t
          || (k.startsWith(t) && !/[a-z0-9_]/.test(k.charAt(t.length)))));
      if (!known) problems.push({ kind: 'unknown-config-key', file: rel, detail: tag + raw });
    }
    // 2. join backslash continuations so a multi-line command reads as one; `\r?` covers CRLF files. Only an odd run
    // continues the line, an even run ends in a literal backslash, and [ \t]* not \s* so the newline survives.
    const joined = text.replace(/(\\+)(\r?\n)[ \t]*/g, (_m, slashes, nl) => (slashes.length % 2
      ? `${slashes.slice(0, -1)} `
      : `${slashes}${nl}`));
    for (const m of joined.matchAll(/([a-z-]+\.mjs)"?\s+([a-z-]+)(?:\s+([a-z-]+))?([^\n]*)/g)) {
      const [, script, w1, w2, restRaw] = m;
      const contract = CONTRACTS[script];
      // prose names third-party scripts too, and a deleted row looks the same, which is why check 14 exists
      if (!contract) continue;
      // a leading - is a flag (the bare form), not a subcommand, or `weight.mjs --root <path>` is unknown-subcommand
      const bare = w1.startsWith('-');
      const sub = subcommandKey([w1, w2], contract);
      if (!contract[sub]) {
        problems.push({ kind: 'unknown-subcommand', file: rel,
          detail: `${tag}${script} ${bare ? '(bare form)' : sub}` });
        continue;
      }
      const allowed = new Set([...flagNames(contract[sub]), ...flagNames(contract['*'])]);
      // the bare form's first word is a flag and needs scanning; subcommand forms scan from w2
      const rest = bare
        ? ` ${w1} ${w2 || ''}${restRaw}`
        : (sub.includes(' ') ? '' : ` ${w2 || ''}`) + restRaw;
      for (const f of rest.matchAll(/--[a-z-]+/g)) {
        if (!allowed.has(f[0])) {
          problems.push({ kind: 'unknown-flag', file: rel, detail: `${tag}${script} ${sub} ${f[0]}` });
        }
      }
    }

    // 3. plugin-root path references.
    for (const m of text.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([A-Za-z0-9_\-./]+)/g)) {
      const p = m[1].replace(/[.,;:]+$/, '');
      if (p.includes('{')) continue; // templated path, not checkable
      if (!existsSync(join(root, p))) {
        problems.push({ kind: 'missing-path', file: rel, detail: tag + p });
      }
    }
  };

  for (const { file, unreadable } of mdFiles(root)) {
    const rel = relative(root, file);
    // report the unreadable directory itself, with its own errno, before any read is tried on it
    if (unreadable) {
      problems.push({ kind: 'unreadable-surface', file: rel, detail: unreadable });
      continue;
    }
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch (e) {
      // name the link target when there is one; e.code over the message keeps machine-specific paths out of the detail
      let target = null;
      try {
        target = readlinkSync(file);
      } catch { /* not a symlink, or target unreadable too */ }
      const detail = target
        ? `unreadable symlink -> ${target} (${e.code || e.message})`
        : (e.code || e.message);
      problems.push({ kind: 'unreadable-surface', file: rel, detail });
      continue;
    }

    lintProse(text, rel, rel !== REACH_DOC, '');
    if (rel !== REACH_DOC) {
      for (const k of BARE_KEYS) {
        if (new RegExp(`\\b${k}\\b`).test(text)) seenTokens.add(k);
      }
    }


    // 10. dispatch phrasing (rule in lib/dispatch-phrasing.mjs), scoped to where dispatch instructions are authored.
    // skills/ has one too, but widening to it is a separate call, and self-verify.test.mjs pins it out of scope.
    if (rel.startsWith(WORKFLOWS_DIR) || rel.startsWith(REFERENCES_DIR)) {
      for (const { code, detail } of dispatchPhrasingIssues(text)) {
        problems.push({ kind: code, file: rel, detail });
      }
    }

    // 11. a prose file that issues a route.mjs resolve must carry the relay rule for its warnings[]
    // (lib/route-relay.mjs), on every surface: it triggers on a literal invocation form, so widening costs no false
    // positives.
    for (const { code, detail } of relayIssues(text)) {
      problems.push({ kind: code, file: rel, detail });
    }

    // 19. text transport (lib/text-transport.mjs): a caller-derived value goes to a seam as a path, not a quoted shell
    // word. Every surface, since a dispatch in skills/ interpolates agent output the way a workflow does.
    problems.push(...textTransportIssues(rel, text));

    // 20. bulk output (lib/bulk-output.mjs): a bulk tool call redirects to a scratch file and hands back a digest
    problems.push(...bulkOutputIssues(rel, text));

    // 21. per-run scratch (lib/scratch-path.mjs): check 20 sees that a redirect exists, never where it points
    problems.push(...scratchPathIssues(rel, text));

    // 23. capture writers (lib/capture-writers.mjs): a CAPTURE.md write needs a row saying why it can't accumulate
    problems.push(...captureWriterIssues(rel, text));
  }

  // 3b. every backticked repo path in INTERNALS.md must exist; globs and non-path spans are skipped
  const internals = join(root, 'INTERNALS.md');
  if (existsSync(internals)) {
    // guarded like the walkers (#49.1): a throwing read unwinds run() and the catch drops every problem found so far.
    // Nothing is pushed on failure, mdFiles already reported INTERNALS.md and a second entry would double-count it.
    let internalsText = null;
    try {
      internalsText = readFileSync(internals, 'utf8');
    } catch { /* already reported by the mdFiles read-guard */ }
    for (const m of (internalsText || '').matchAll(/`([^`]+)`/g)) {
      const tok = m[1];
      if (!/^[A-Za-z0-9_./-]+$/.test(tok) || !tok.includes('/') || tok.includes('*')) continue;
      if (!existsSync(join(root, tok))) {
        problems.push({ kind: 'missing-internals-path', file: 'INTERNALS.md', detail: tok });
      }
    }
  } else if (isFullTree) {
    problems.push({ kind: 'missing-input', file: 'INTERNALS.md', detail: 'always-expected input absent' });
  }

  // 1 to 3 over the schema's walk text (question, explain text, hint, interacts); forward scan only, so it never feeds 1b
  for (const key of schemaKeys) {
    const spec = schema[key];
    if (!spec || typeof spec !== 'object') continue;
    const texts = [spec.question, ...(Array.isArray(spec.explain) ? spec.explain.map((e) => e && e.text) : []), spec.hint, spec.interacts];
    for (const t of texts) {
      if (typeof t === 'string') lintProse(t, 'cadence-core/config.schema.json', false, `${key}: `);
    }
  }

  // 1b. every schema key needs a prose reader, exactly or through a prefix of two segments or more
  for (const key of schemaKeys) {
    const covered = [...seenTokens].some((t) =>
      key === t || (t.split('.').length >= 2 && key.startsWith(t + '.')));
    if (!covered) problems.push({ kind: 'inert-config-key', file: 'cadence-core/config.schema.json', detail: key });
  }

  // 4. every measured prose surface needs a budget entry, weighed by the lib weight.mjs reports with. A
  // ceiling, not an equality: exactness turned CI red on every prose cut until its row was re-pinned, so
  // it taxed shrinking as much as growth. A surface under its entry just got smaller.
  const budgetPath = join(root, 'cadence-core', 'bin', 'weight-budgets.json');
  if (existsSync(budgetPath)) {
    // same guard as INTERNALS.md above: a malformed manifest used to sink the whole run
    let budgets = null;
    try {
      budgets = JSON.parse(readFileSync(budgetPath, 'utf8')).budgets || {};
    } catch (e) {
      problems.push({ kind: 'unreadable-surface', file: 'cadence-core/bin/weight-budgets.json',
        detail: e.code || e.message });
    }
    for (const { surface, bytes } of (budgets ? weighAll(root) : [])) {
      if (!(surface in budgets)) {
        problems.push({ kind: 'unbudgeted-surface', file: surface, detail: 'no budget entry' });
        continue;
      }
      const budget = budgets[surface];
      // CADENCE-CENSUS: weight-budgets | asserts: weight-budgets.json has a byte ceiling for each budgeted surface
      if (bytes > budget) {
        problems.push({ kind: 'budget-overrun', file: surface,
          detail: `${bytes}B exceeds budget ${budget}B by ${bytes - budget}B` });
      }
    }
  } else if (isFullTree) {
    problems.push({ kind: 'missing-input', file: 'cadence-core/bin/weight-budgets.json', detail: 'always-expected input absent' });
  }

  // 5. an agent's prose may only reference tools it declares in `tools:`. A preloaded
  // contract is that agent's own prose, so it's scanned too, or moving one out of the
  // body (#74) would empty this lint's input. Only backticked mentions count.
  //
  // 6. every name in `skills:` must resolve to skills/<name>/SKILL.md and not set
  // disable-model-invocation: true. The host skips either one silently and the agent
  // runs with no contract, which reads like it ignored its instructions (#74).
  const toolAlt = KNOWN_TOOLS.join('|');
  const backtickRe = new RegExp('`(' + toolAlt + ')`', 'g');
  const theToolRe = new RegExp('\\bthe (' + toolAlt + ') tool\\b', 'g');
  // its own guard (#49.1); mdFiles already reported an unreadable entry, so this skips it without a second problem
  const agentsDir = join(root, 'agents');
  // hoisted: check 8's disk -> map direction needs the same listing, and two reads could disagree
  /** @type {string[]} */
  let agentFiles = [];
  // hoisted: check 7d compares one role's rung bodies against each other, so it can't run inside the per-file loop
  /** @type {Record<string, string>} */
  const agentBodies = {};
  // Check 27: each contract is judged once, however many rung files preload it.
  /** @type {Set<string>} */
  const dataRuleSeen = new Set();
  if (existsSync(agentsDir)) {
    try {
      agentFiles = readdirSync(agentsDir, { encoding: 'utf8' });
    } catch {
      agentFiles = [];
    }
    for (const e of agentFiles) {
      const file = join(agentsDir, e);
      if (!e.endsWith('.md')) continue;
      let isFile;
      try {
        isFile = statSync(file).isFile();
      } catch {
        continue;
      }
      if (!isFile) continue;
      let text;
      try {
        text = readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      const rel = relative(root, file);
      const fm = text.match(FRONTMATTER_RE);
      const declared = new Set();
      if (fm) {
        const toolsLine = fm[1].match(/^tools:\s*(.+)$/m);
        if (toolsLine) {
          for (const t of toolsLine[1].split(',')) {
            const name = t.trim();
            if (name) declared.add(name);
          }
        }
      }
      // 6. resolve each preloaded contract; an unreadable SKILL.md isn't reported, the mdFiles walk already named it
      const preloaded = [];
      for (const skill of (fm ? parseSkillsField(fm[1]) : [])) {
        const skillFile = join(root, 'skills', skill, 'SKILL.md');
        if (!existsSync(skillFile)) {
          problems.push({ kind: 'missing-agent-skill', file: rel,
            detail: `${skill} -> skills/${skill}/SKILL.md absent` });
          continue;
        }
        let skillText;
        try {
          skillText = readFileSync(skillFile, 'utf8');
        } catch {
          continue;
        }
        const skillFm = skillText.match(FRONTMATTER_RE);
        if (skillFm && /^disable-model-invocation:[ \t]*true[ \t]*$/m.test(skillFm[1])) {
          problems.push({ kind: 'unpreloadable-agent-skill', file: rel,
            detail: `${skill} sets disable-model-invocation: true` });
          continue;
        }
        preloaded.push(skillFm ? skillText.slice(skillFm[0].length) : skillText);
        // 27. the data-not-instructions sentence, once per contract.
        if (!dataRuleSeen.has(skill)) {
          dataRuleSeen.add(skill);
          for (const kind of dataRuleIssues(skillText)) {
            problems.push({ kind, file: `skills/${skill}/SKILL.md`,
              detail: 'the preloaded contract lacks the data-not-instructions sentence (lib/data-rule.mjs)' });
          }
        }
      }

      const body = fm ? text.slice(fm[0].length) : text;
      // raw, frontmatter off: 7d compares rung bodies byte for byte, and a normalized copy would forgive a re-wrap
      agentBodies[e.slice(0, -3)] = body;

      // 7. an agent that preloads a contract carries no behaviour of its own. Scans the body only, since the
      // contracts use this vocabulary on purpose. Keyed on `skills:`, not size: a 200-byte instruction fits any
      // budget, and this keeps a one-off agent with inline prose legal. Two arms: a contract section tag is
      // named first as the clearer message, then a tagless body is held to the canonical template, which
      // catches plain-prose behaviour and a same-size replacement of the pointer paragraph.
      if (fm && /^skills:/m.test(fm[1])) {
        const tags = [];
        for (const m of body.matchAll(
          /<(role|stance|process|returns|guardrails|success_criteria|dimensions)>/g)) {
          if (!tags.includes(m[1])) tags.push(m[1]);
        }
        if (tags.length) {
          problems.push({ kind: 'agent-carries-behaviour', file: rel,
            detail: `body carries contract section ${tags.map((t) => `<${t}>`).join(', ')} - the contract belongs in the preloaded skill` });
        } else {
          const issue = rungBodyIssue(body, parseSkillsField(fm[1]));
          if (issue) {
            problems.push({ kind: 'agent-carries-behaviour', file: rel,
              detail: `${issue.detail} - the contract belongs in the preloaded skill` });
          }
        }
      }

      // 7b. a rung file carries the effort the rung map filed it under, checked on every agent file
      // since the map may name any of them. Nothing else reads a rung file's effort (check 8 reads the
      // filename), so the link deciding how deep a dispatch thinks would go unchecked.
      if (fm) {
        const effortLine = fm[1].match(/^effort:[ \t]*(\S+)[ \t]*$/m);
        const mismatch = rungEffortIssue(e.slice(0, -3),
          effortLine ? effortLine[1] : undefined);
        if (mismatch) {
          problems.push({ kind: 'rung-effort-mismatch', file: rel, detail: mismatch.detail });
        }
      }

      // 7c. the verifier's narrow Write grant, both directions, on every cad-verifier rung. Frontmatter can't
      // scope a tool to a path, so this is the only backstop against the one deliberate exception widening:
      // Write granted, Edit and MultiEdit denied. Keyed on name: and filename both, since the host dispatches
      // by name: and the map resolves by filename, so checking one lets a rename slip past.
      if (fm) {
        const nameLine = fm[1].match(/^name:[ \t]*(\S+)[ \t]*$/m);
        // YAML allows a quoted scalar; strip one matched pair or a quoted name matches neither arm and name: goes dead
        const agentName = nameLine ? nameLine[1].replace(/^(['"])([\s\S]*)\1$/, '$2') : '';
        const isVerifier = (id) => id === 'cad-verifier' || id.startsWith('cad-verifier-');
        if (isVerifier(agentName) || isVerifier(e.slice(0, -3))) {
          const denied = new Set();
          const denyLine = fm[1].match(/^disallowedTools:\s*(.+)$/m);
          if (denyLine) {
            for (const t of denyLine[1].split(',')) {
              const name = t.trim();
              if (name) denied.add(name);
            }
          }
          if (!declared.has('Write')) {
            problems.push({ kind: 'verifier-write-grant', file: rel,
              detail: 'Write not in tools: - the verifier cannot write its findings file' });
          }
          for (const tool of ['Edit', 'MultiEdit']) {
            if (!denied.has(tool)) {
              problems.push({ kind: 'verifier-write-grant', file: rel,
                detail: `${tool} not in disallowedTools:` });
            }
            if (declared.has(tool)) {
              problems.push({ kind: 'verifier-write-grant', file: rel,
                detail: `${tool} in tools: - the grant is Write only` });
            }
          }
        }
      }

      const referenced = new Set();
      for (const prose of [body, ...preloaded]) {
        for (const m of prose.matchAll(backtickRe)) referenced.add(m[1]);
        for (const m of prose.matchAll(theToolRe)) referenced.add(m[1]);
      }
      for (const tool of referenced) {
        if (!declared.has(tool)) {
          problems.push({ kind: 'undeclared-tool', file: rel, detail: `${tool} not in tools:` });
        }
      }
    }
  }

  // 7d. one role's rung files carry one body, byte for byte (rule in lib/rung-agent.mjs); cross-file, so after the walk
  for (const issue of rungPrefixIssues(agentBodies)) {
    problems.push({ kind: issue.code, file: `agents/${issue.stems[0]}.md`,
      detail: issue.detail });
  }

  // 8. the rung ladder both ways, RUNG_FILES against the agents/ listing. It iterates the map, so it can't live in that
  // walk. Map -> disk: every file the map names must exist, and route.mjs never checks the agent it returns exists, so
  // a missing rung would fail at dispatch instead of in CI. Gated on isFullTree: RUNG_FILES lives in code, so a fixture
  // can't supply its own and a minimal one would report thirty absent files for a ladder it never claimed.
  if (isFullTree) {
    for (const role of Object.keys(RUNG_FILES)) {
      for (const [rung, stem] of Object.entries(RUNG_FILES[role])) {
        if (!existsSync(join(root, 'agents', `${stem}.md`))) {
          problems.push({ kind: 'missing-rung-agent',
            file: 'cadence-core/bin/lib/rung-agent.mjs',
            detail: `${role} at rung ${rung}: agents/${stem}.md absent` });
        }
      }
    }
  }
  // disk -> map: a rung-suffixed agent file the map files for nobody is stale and still costs standing context in
  // every prompt. Matched only on that shape, since a blanket "not named by the map" would outlaw the one-off agent
  // with inline prose. Longest role name first, so a role that prefixes another can't claim its file.
  const roleNames = Object.keys(RUNG_FILES).sort((a, b) => b.length - a.length);
  for (const e of agentFiles) {
    if (!e.endsWith('.md')) continue;
    const stem = e.slice(0, -3);
    for (const role of roleNames) {
      if (!stem.startsWith(`${role}-`)) continue;
      const rung = stem.slice(role.length + 1);
      if (RUNG_ORDER.includes(rung) && rungFile(role, rung) !== stem) {
        // the fix is always the same: delete the file, or file it in the map
        problems.push({ kind: 'undeclared-rung-agent', file: `agents/${stem}.md`,
          detail: `lib/rung-agent.mjs files ${role}'s ${rung} rung as `
            + `agents/${rungFile(role, rung)}.md, so it maps no file to this one` });
      }
      break;
    }
  }

  // 8b. the shipped roles.<role>.effort enums against RUNG_FILES, filed against the schema a maintainer edits
  for (const { code, detail } of effortEnumIssues(schema, RUNG_ORDER)) {
    problems.push({ kind: code, file: 'cadence-core/config.schema.json', detail });
  }

  // 18. each review.triggers.<t> gate, tier and effort default is a member of its own values and named in its purpose
  for (const { code, detail } of gateAgreementIssues(schema)) {
    problems.push({ kind: code, file: 'cadence-core/config.schema.json', detail });
  }

  // 28. each key's explain entries against the key: a value it refuses, or a walk key's value left unexplained
  for (const { code, detail } of settingExplanationIssues(schema)) {
    problems.push({ kind: code, file: 'cadence-core/config.schema.json', detail });
  }

  // 29. each key's applies_when against the keys it names: a key the schema doesn't hold, a value that key refuses
  for (const { code, detail } of settingConditionIssues(schema)) {
    problems.push({ kind: code, file: 'cadence-core/config.schema.json', detail });
  }

  // 30. what a person reads in the schema: a walked key's label, option text, and a dotted key, backtick or internal term in a question or label
  for (const { code, detail } of plainWordsIssues(schema)) {
    problems.push({ kind: code, file: 'cadence-core/config.schema.json', detail });
  }

  // 9. the reach table against config.schema.json both ways, plus the narrow-reach-must-be-stated rule. Root-relative,
  // so a fixture can supply its own doc, and a full tree missing it is a missing-input. Read and parse are guarded: a
  // malformed table is problems on the table, not an unwind to internal that drops the rest (#49.1).
  const reachPath = join(root, REACH_DOC);
  if (existsSync(reachPath)) {
    let reachText = null;
    try {
      reachText = readFileSync(reachPath, 'utf8');
    } catch { /* already reported by the mdFiles read-guard */ }
    if (reachText !== null) {
      try {
        const { rows, issues } = parseReachTable(reachText);
        for (const { code, detail } of issues) {
          problems.push({ kind: code, file: REACH_DOC, detail });
        }
        // rows === null means the heading is missing, already one problem; every key reported absent would bury it
        if (rows) {
          for (const { code, detail } of reachIssues(schema, rows)) {
            problems.push({ kind: code, file: REACH_DOC, detail });
          }
        }
      } catch (e) {
        problems.push({ kind: 'unreadable-surface', file: REACH_DOC,
          detail: e && e.message ? e.message : String(e) });
      }
    }
  } else if (isFullTree) {
    problems.push({ kind: 'missing-input', file: REACH_DOC,
      detail: 'always-expected input absent' });
  }

  // 17. the global-only key set against the schema's src marker, both ways, each filed against the file a maintainer
  // opens to fix it: an unmarked enforced key is a schema edit, a marked key nothing enforces is a lib edit.
  const GLOBAL_ONLY_FILE = {
    'missing-global-only-marker': join('cadence-core', 'config.schema.json'),
    'undeclared-global-only-key': join('cadence-core', 'bin', 'lib', 'global-only-keys.mjs'),
  };
  for (const { code, detail } of globalOnlyMarkerIssues(schema)) {
    problems.push({ kind: code, file: GLOBAL_ONLY_FILE[code], detail });
  }

  // 12. mergeLayers callsites bind the warnings[] or say in the file header why the envelope
  // is the surfacing (lib/merge-warnings.mjs). An unreadable file is one problem naming it,
  // never an unwind (#49.1), and no second reporter exists here to defer to.
  for (const { file, unreadable } of binFiles(root)) {
    const rel = relative(root, file);
    if (unreadable) {
      problems.push({ kind: 'unreadable-surface', file: rel, detail: unreadable });
      continue;
    }
    let src = null;
    try {
      src = readFileSync(file, 'utf8');
    } catch (e) {
      problems.push({ kind: 'unreadable-surface', file: rel,
        detail: e && e.code ? e.code : String(e) });
      continue;
    }
    for (const { code, detail } of mergeWarningIssues(src)) {
      problems.push({ kind: code, file: rel, detail });
    }
  }

  // 13. every de-preloaded reference is still Read by name at the step that needs it (lib/deferred-reads.mjs)
  for (const issue of deferredReadIssues(root, deferredRows(problems))) problems.push(issue);

  // 24. a cold-split reference stays reachable from its router, which grew no unregistered branch
  for (const issue of referenceRouterIssues(root)) problems.push(issue);

  // 14. every shipped seam is contracted. Check 2 skips a script with no CONTRACTS row, since
  // prose names third-party scripts too, so deleting a row silently opts that script out of
  // the flag lint. Top-level only: lib/*.mjs are never invoked from prose.
  const binDir = join(root, 'cadence-core', 'bin');
  let binList = null;
  try {
    binList = readdirSync(binDir, { withFileTypes: true });
  } catch (e) {
    // an absent bin directory is a partial fixture; one that exists and can't be read is a fault, not a pass
    if (e && e.code !== 'ENOENT') {
      problems.push({ kind: 'unreadable-surface', file: relative(root, binDir),
        detail: e.code || String(e) });
    }
  }
  for (const d of binList || []) {
    if (d.isDirectory()) continue;
    if (!d.name.endsWith('.mjs') || d.name.endsWith('.test.mjs')) continue;
    if (!CONTRACTS[d.name]) {
      problems.push({ kind: 'uncontracted-script',
        file: relative(root, join(binDir, d.name)), detail: d.name });
    }
  }

  // 15. no literal U+0000 under cadence-core/bin. A NUL makes GNU grep -rn print nothing for the
  // file without -a and rg skip it, so it drops out of every search, and git grep doesn't catch it.
  // Extension-blind, since grep doesn't care that a file is a test, and scoped to bin because the
  // phase records elsewhere carry the same bytes and nobody may rewrite them.
  for (const { file, unreadable } of binFiles(root, { every: true })) {
    const rel = relative(root, file);
    if (unreadable) {
      problems.push({ kind: 'unreadable-surface', file: rel, detail: unreadable });
      continue;
    }
    let buf = null;
    try {
      buf = readFileSync(file);
    } catch (e) {
      problems.push({ kind: 'unreadable-surface', file: rel,
        detail: e && e.code ? e.code : String(e) });
      continue;
    }
    const at = buf.indexOf(0);
    if (at < 0) continue;
    let count = 0;
    for (let i = at; i < buf.length; i++) if (buf[i] === 0) count++;
    problems.push({ kind: 'nul-byte-in-source', file: rel,
      detail: `literal U+0000 at byte offset ${at} (${count} in file) - type \\0 instead` });
  }

  // 16. an @-included references/templates surface must be named in the command's eager prose (include-consumers)
  for (const issue of includeConsumerIssues(root)) problems.push(issue);

  // 22. a refusal a user can read must name the next step; the scan and exclusion register are in lib/refusal-hints.mjs
  for (const issue of refusalHintIssues(root)) problems.push(issue);

  // 25. every event hooks/hooks.json registers has a register row (lib/hook-events.mjs)
  for (const issue of hookEventIssues(root)) problems.push(issue);

  // 26. no shipped file but an image or font over 256 KiB, and at most 512 files plus folders, every root included
  for (const issue of directoryLimitIssues(root)) problems.push(issue);

  // 27. workflows/*.js at plugin root: checks 1 to 3 on the text, then the script's own rules (workflowScriptIssues)
  const wfDir = join(root, 'workflows');
  if (existsSync(wfDir)) {
    let names = [];
    try { names = readdirSync(wfDir).filter((n) => n.endsWith('.js')).sort(); }
    catch (e) { problems.push({ kind: 'unreadable-surface', file: 'workflows', detail: e.code || e.message }); }
    for (const n of names) {
      const rel = join('workflows', n);
      let text;
      try { text = readFileSync(join(wfDir, n), 'utf8'); }
      catch (e) { problems.push({ kind: 'unreadable-surface', file: rel, detail: e.code || e.message }); continue; }
      lintProse(text, rel, false, '');
      problems.push(...workflowScriptIssues(text, rel));
    }
  }

  return problems;
}

// --- entry ---------------------------------------------------------------------

// a const: helper-census.test.mjs pins that literal throw body to lib/seam-input.mjs, so a copy would redden it
const MISSING_FLAG_VALUE = 'missing-flag-value';

try {
  const argv = process.argv.slice(2);
  // the tracer bullet for the whole contract: declaration -> evaluator -> CLI refusal -> envelope. The empty,
  // valueless and flag-shaped spellings refuse where they used to return ok:true about a tree nobody named.
  const rooted = evaluateFlag(argv, '--root', CONTRACTS['self-verify.mjs']['*']['--root']);
  if (!rooted.ok) throw { seam: MISSING_FLAG_VALUE, detail: rooted.detail };
  const root = rooted.value || join(HERE, '..', '..');
  const problems = run(root);
  emit({ ok: problems.length === 0, checked: 'config-keys, invocations, paths, internals-paths, budgets, tools, agent-skills, agent-behaviour, rung-effort, rung-prefix, verifier-write-grant, rung-ladder, effort-enums, config-reach, dispatch-phrasing, route-relay, merge-warnings, deferred-reads, reference-routers, script-contracts, nul-bytes, include-consumers, global-only-key-scope, gate-agreement, text-transport, bulk-output, scratch-path, refusal-hints, capture-writers, hook-events, directory-limits, data-rule, setting-explanations, setting-conditions, plain-words, workflow-scripts', problems });
} catch (e) {
  emitCaught(e);
}
