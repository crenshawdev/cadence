#!/usr/bin/env node
// @ts-check
// self-verify.mjs - the prose<->code drift linter, run in CI. The 2026-07-16
// sweep found that nearly every defect in this repo was prose describing a
// flag, key, or path the code did not have; this script makes that whole
// class mechanical. Checks run over the LIVE prose surfaces (workflows,
// references, skills, agents, templates, plus README and INTERNALS -
// deliberately not the historical docs DESIGN/LINEAGE/CHANGELOG, which may
// name cut keys while explaining the cut):
//
//   1. config keys   every dotted config token in prose must exist in
//                    config.schema.json (placeholders <t>/<name> expanded),
//                    and every schema key must be referenced somewhere -
//                    an unreferenced key is inert and gets pruned, not kept.
//   2. invocations   every `<script>.mjs <subcommand> --flag` in prose must
//                    match the real subcommand/flag contract table below.
//                    The table is maintained here, beside the checks; the
//                    scripts' own tests keep the table honest.
//   3. paths         every ${CLAUDE_PLUGIN_ROOT}/<path> must exist in-repo.
//   3b. internals    every backticked repo path cited in INTERNALS.md (the
//                    deep-dive "Read the code" pointers) must exist in-repo.
//   6. agent skills  every skill an agent preloads via `skills:` frontmatter
//                    must resolve on disk and be model-invocable. The host
//                    skips a missing or disabled one SILENTLY, so this check
//                    is what keeps a preloaded contract from vanishing.
//   7. agent body    an agent that preloads a contract (`skills:`) must carry
//                    NO contract section tag in its own body. A rung file is
//                    a pointer at one single-sourced contract; the moment one
//                    grows behaviour, the ladder is N divergent variants
//                    instead of one contract at N efforts.
//   8. routing cells the three grids in route-table.json, cell by cell (every
//                    problem NAMES the cell), the `surfaces` block against the
//                    `risk.override.<surface>` schema keys in both directions,
//                    plus both directions between the grids and agents/: every
//                    rung a cell names must have an agent file, and every
//                    rung-suffixed agent file must be a rung some cell reaches. route.mjs returns an agent name it
//                    never checks exists, so an unbuilt or stale rung would
//                    surface as a failed spawn instead of in CI.
//   9. config reach  references/config-reach.md must carry one reach row per
//                    config.schema.json key, name no key the schema lacks, and
//                    every reach narrower than `universal` must appear in that
//                    key's own `purpose` - where a user setting the value reads
//                    it. This is what makes "no key is resolved and then
//                    silently dropped" re-runnable rather than a one-time sweep.
//
// Seam convention: one JSON line on stdout, exit 0 clean / 1 problems found.
// Usage: self-verify.mjs [--root <repo root>]
'use strict';

import { readFileSync, readdirSync, existsSync, statSync, readlinkSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emit } from './lib/seam-io.mjs';
import { weighAll } from './lib/surface-weight.mjs';
import { rungBodyIssue, rungFile } from './lib/rung-agent.mjs';
import { cellIssues, declaredRoles, routableAgents, surfaceIssues } from './lib/route-cells.mjs';
import { surfacesFromKeys } from './lib/risk-surfaces.mjs';
import { parseReachTable, reachIssues } from './lib/config-reach.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

// The reach table (check 9), root-relative and platform-separated so it can be
// compared against a `relative(root, file)` walk result.
const REACH_DOC = join('cadence-core', 'references', 'config-reach.md');

// --- the contract table: script -> subcommand -> allowed flags --------------
// Global flags allowed everywhere on that script are listed under '*'.
const CONTRACTS = {
  'planning.mjs': {
    '*': ['--dir'],
    status: [],
    'cursor get': [],
    'cursor set': ['--phase', '--status', '--next', '--name', '--total'],
    'phase-done': ['--n', '--reqs', '--undo'],
    'uat init': ['--phase', '--sources'],
    'uat refresh': ['--phase'],
    'uat record': ['--phase', '--item', '--result', '--reason', '--reported',
      '--severity', '--cause', '--fix', '--evidence', '--source', '--origin'],
    'uat merge': ['--phase'],
    'uat status': ['--phase'],
    audit: [],
    'criteria-coverage': [],
    'plan-overlap': ['--phase'],
    'seed-reqs': ['--phase'],
    recall: [],
    'renumber insert': ['--at', '--dry-run'],
    'renumber remove': ['--n', '--dry-run'],
  },
  'config.mjs': {
    '*': [],
    validate: ['--file', '--global'],
    check: [],
    set: ['--file', '--global'],
    get: ['--file'],
    keys: [],
  },
  'git-branch.mjs': {
    '*': ['--dir'],
    decide: ['--branch'],
  },
  'git-publish.mjs': {
    '*': ['--dir'],
    publish: ['--remote'],
  },
  'land-cleanup.mjs': {
    '*': ['--dir'],
    cleanup: ['--branch', '--base', '--merged'],
    gate: [],
  },
  'release-bump.mjs': {
    '*': ['--dir'],
    bump: ['--version', '--date'],
  },
  'route.mjs': {
    '*': [],
    resolve: ['--role', '--attempt', '--file', '--phase'],
    table: [],
  },
  'worktree-base.mjs': {
    '*': ['--dir'],
    resolve: [],
  },
  'review-provider.mjs': {
    '*': ['--key-file'],
    review: ['--provider', '--model', '--effort', '--payload'],
    consult: ['--provider', '--model', '--effort', '--payload'],
    'detect-models': ['--provider'],
  },
};

// Subcommands whose first word takes a second word (sub-subcommand).
const TWO_WORD = new Set(['cursor', 'uat', 'renumber']);

// The canonical Claude Code tool vocabulary the agents-only tools lint checks
// against - a FIXED set, not derived from the tree, so a single-agent fixture
// still has a full vocabulary to test with.
const KNOWN_TOOLS = ['Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'Grep',
  'Glob', 'Task', 'WebFetch', 'WebSearch', 'NotebookEdit', 'TodoWrite'];

// --- helpers -----------------------------------------------------------------

function* mdFiles(root) {
  const dirs = [
    join(root, 'cadence-core', 'workflows'),
    join(root, 'cadence-core', 'references'),
    join(root, 'cadence-core', 'templates'),
    join(root, 'skills'),
    join(root, 'agents'),
  ];
  for (const d of dirs) {
    if (!existsSync(d)) continue;
    // The walker never drops an entry it cannot inspect - it yields the
    // path so run()'s read-guard can report it as an unreadable surface,
    // rather than the whole run collapsing to one opaque internal error
    // (#49.1). An unreadable directory is itself the unreadable surface.
    let list;
    try {
      list = readdirSync(d, { recursive: true, encoding: 'utf8' });
    } catch {
      yield d;
      continue;
    }
    for (const e of list) {
      const f = join(d, String(e));
      if (!f.endsWith('.md')) continue;
      // Deliberately optimistic on the throw: a symlink that fails the
      // stat (dangling, cycle) still reaches the reporter as a file,
      // rather than vanishing silently from the walk.
      let isFile;
      try {
        isFile = statSync(f).isFile();
      } catch {
        isFile = true;
      }
      if (isFile) yield f;
    }
  }
  // README, INTERNALS and METHOD name user-facing switches and live file paths -
  // they are live surfaces too. Historical docs (DESIGN/LINEAGE/CHANGELOG) stay
  // out: they legitimately name keys that were later cut, while explaining the cut.
  for (const doc of ['README.md', 'INTERNALS.md', 'METHOD.md']) {
    const p = join(root, doc);
    if (existsSync(p)) yield p;
  }
}

/**
 * Expand <t>/<trigger>/<name>-style placeholders into every concrete key
 * they stand for (cartesian across placeholders). A single representative
 * would under-cover the reverse check: prose that says
 * `review.triggers.<t>.tier` covers ALL triggers' tier keys, not just plan's.
 * @param {string} token @param {string[]} triggers @param {string[]} providers
 * @param {string[]} [surfaces] the risk surfaces `risk.override.<surface>` stands for
 */
function expand(token, triggers, providers, surfaces = []) {
  let out = [token];
  const subst = (list, re, values) =>
    list.flatMap((t) => re.test(t) ? values.map((v) => t.replace(re, v)) : [t]);
  out = subst(out, /<t(?:rigger)?>?/g, triggers);
  out = subst(out, /<(?:name|provider)>?/g, providers);
  out = subst(out, /<surface>?/g, surfaces);
  return out;
}

/**
 * Parse an agent frontmatter block's `skills:` value into skill names. Accepts
 * the three spellings a hand-written agent file realistically uses: the block
 * list (`skills:\n  - name`), the inline array (`skills: [a, b]`), and a bare
 * scalar (`skills: name`). Anything else yields no names, which the caller
 * treats as "this agent preloads nothing" - the same as an absent key.
 * @param {string} fmText the text BETWEEN the frontmatter fences
 * @returns {string[]}
 */
export function parseSkillsField(fmText) {
  const m = fmText.match(/^skills:[ \t]*(.*)$/m);
  if (!m || m.index === undefined) return [];
  const unquote = (/** @type {string} */ s) => s.trim().replace(/^['"]|['"]$/g, '').trim();
  const inline = m[1].trim();
  if (inline) {
    return inline.replace(/^\[/, '').replace(/\]$/, '')
      .split(',').map(unquote).filter(Boolean);
  }
  const out = [];
  for (const line of fmText.slice(m.index + m[0].length).split('\n')) {
    const item = line.match(/^[ \t]+-[ \t]*(.+)$/);
    if (item) {
      const name = unquote(item[1]);
      if (name) out.push(name);
      continue;
    }
    if (line.trim() === '') continue;
    break; // the next frontmatter key ends the list
  }
  return out;
}

// --- checks ------------------------------------------------------------------

function run(root) {
  const problems = [];
  // The plugin manifest is the definitive marker of a real Cadence install -
  // a minimal test fixture never creates one, so fixtures stay lenient about
  // always-expected inputs (D-03) while a full tree with one missing (a core
  // surface dir, weight-budgets.json, INTERNALS.md) fails loud, not silently
  // skips-and-stays-green (#44).
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
  // The risk-surface vocabulary, derived from the schema exactly as TRIGGERS and
  // PROVIDERS are: prose writing `risk.override.<surface>` covers all eight keys
  // in both directions of check 1, and check 8 walks the same list against
  // route-table.json's `surfaces` block.
  const SURFACES = surfacesFromKeys(schemaKeys);
  // Keys with no dot can never match the dotted-token regex; they are covered
  // by a bare-word mention instead.
  const BARE_KEYS = schemaKeys.filter((k) => !k.includes('.'));

  const seenTokens = new Set();

  // 0. always-expected core surface dirs (#44): a full tree missing one of
  // these is a real break (a renamed/deleted dir), not a fixture omitting an
  // optional input - so it is only a hard failure when isFullTree.
  if (isFullTree) {
    for (const d of ['cadence-core/workflows', 'cadence-core/references',
      'cadence-core/templates', 'skills', 'agents']) {
      if (!existsSync(join(root, d))) {
        problems.push({ kind: 'missing-input', file: d, detail: 'core surface dir absent' });
      }
    }
  }

  for (const file of mdFiles(root)) {
    const rel = relative(root, file);
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch (e) {
      // Name the link target when there is one - costs one line here and
      // saves the operator an `ls -l` on a rare failure. Use e.code rather
      // than the full message when a target is known, so the detail stays
      // free of machine-specific absolute paths.
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

    // 1. config-key tokens: family-rooted dotted identifiers.
    // Scanned over a copy with every URL masked out, because a HOSTNAME is
    // shaped exactly like a config key: `https://git.jcrenshaw.dev/...` reads
    // as a `git.*` token under the real `git` schema family, matches no key,
    // and reports unknown-config-key the moment README carries the install
    // URL. The narrowing is bounded to URLs on purpose - a dotted token in
    // ordinary prose is still a key claim, so the check keeps its teeth
    // everywhere a key is actually written; only the span between `https://`
    // and the next whitespace, bracket or quote stops being read as prose.
    // Only this loop uses the masked copy: the BARE_KEYS loop, the invocation
    // join and the ${CLAUDE_PLUGIN_ROOT} loop below are unaffected by
    // hostnames, and masking there would cost coverage for nothing.
    const scanText = text.replace(/https?:\/\/[^\s)\]}>'"`]*/g, ' ');
    for (const m of scanText.matchAll(/\b([a-z_]+(?:\.[a-z_0-9<>]+)+)/g)) {
      // A closing placeholder bracket can trail the token (`<review.consult.effort>`).
      const raw = m[1].replace(/>+$/, '');
      const family = raw.split('.')[0];
      if (!FAMILIES.has(family)) continue;
      if (raw.split('.').some((seg) => NON_KEY_SEGMENT.has(seg))) continue;
      const expansions = expand(raw, TRIGGERS, PROVIDERS, SURFACES);
      // The reach table (check 9) names all 72 keys by construction, so
      // letting it feed seenTokens would make 1b's inert-config-key
      // unreachable forever - a key nothing but the table mentions would
      // read as referenced. It still feeds the FORWARD scan below: class 2
      // (unknown-reach-key) inspects the Key column only, so a dead token in
      // that file's prose or an `Honoured by` cell would otherwise be scanned
      // by nothing at all.
      if (rel !== REACH_DOC) for (const t of expansions) seenTokens.add(t);
      // A token is known when it IS a key or stops at a boundary inside one.
      // The boundary arm is not cosmetic: this tokenizer's segment class is
      // [a-z_0-9<>], so a hyphenated key like `model.overrides.cad-planner`
      // tokenizes to `model.overrides.cad` and would report unknown for the
      // correct spelling of a real key. `.` and `-` both end a token; `_`
      // does not, so `git.on` still fails against `git.on_protected` and the
      // check keeps its teeth on a truncated guess.
      const known = expansions.some((t) =>
        schemaKeys.some((k) => k === t
          || (k.startsWith(t) && !/[a-z0-9_]/.test(k.charAt(t.length)))));
      if (!known) problems.push({ kind: 'unknown-config-key', file: rel, detail: raw });
    }
    if (rel !== REACH_DOC) {
      for (const k of BARE_KEYS) {
        if (new RegExp(`\\b${k}\\b`).test(text)) seenTokens.add(k);
      }
    }

    // 2. script invocations.
    // Join backslash continuations so multi-line commands read as one. The
    // `\r?` arm exists so a CRLF-checked-out prose file joins like an LF one.
    // The RULE this join encodes is shared with the git rails, in two
    // spellings fitted to two inputs: here the input is PROSE, so a regex
    // join is the whole job; in cadence-core/bin/lib/shell-tokens.mjs the
    // input is a shell command string, so the same rule lives as escape state
    // in a left-to-right pass and no regex remains (D-13, D-06). The shared
    // invariant is the PARITY requirement below - an even trailing run is a
    // literal backslash, not a continuation - and it must hold in both. The
    // trailing class is `[ \t]*`, not `\s*`: `\s` matches `\n`, so `\s*`
    // would swallow the newline that ends the continued line and merge the
    // NEXT line into the joined command, letting the flag-checking regex
    // below (bounded by `[^\n]*`) read words that were never on that
    // command line. Parity matters here for the same reason it does in the
    // tokenizer: a trailing RUN of backslashes continues the line only when
    // its length is ODD, so `\\` at EOL is a literal backslash and the newline
    // still ends the command. Joining anyway merges the next line in and
    // reports a flag that was never on this command (a false unknown-flag).
    const joined = text.replace(/(\\+)(\r?\n)[ \t]*/g, (_m, slashes, nl) => (slashes.length % 2
      ? `${slashes.slice(0, -1)} `
      : `${slashes}${nl}`));
    for (const m of joined.matchAll(/([a-z-]+\.mjs)"?\s+([a-z-]+)(?:\s+([a-z-]+))?([^\n]*)/g)) {
      const [, script, w1, w2, restRaw] = m;
      const contract = CONTRACTS[script];
      if (!contract) continue; // not one of ours
      const sub = TWO_WORD.has(w1) && w2 ? `${w1} ${w2}` : w1;
      if (!contract[sub]) {
        problems.push({ kind: 'unknown-subcommand', file: rel, detail: `${script} ${sub}` });
        continue;
      }
      const allowed = new Set([...contract[sub], ...contract['*']]);
      const rest = (TWO_WORD.has(w1) && w2 ? '' : ` ${w2 || ''}`) + restRaw;
      for (const f of rest.matchAll(/--[a-z-]+/g)) {
        if (!allowed.has(f[0])) {
          problems.push({ kind: 'unknown-flag', file: rel, detail: `${script} ${sub} ${f[0]}` });
        }
      }
    }

    // 3. plugin-root path references.
    for (const m of text.matchAll(/\$\{CLAUDE_PLUGIN_ROOT\}\/([A-Za-z0-9_\-./]+)/g)) {
      const p = m[1].replace(/[.,;:]+$/, '');
      if (p.includes('{')) continue; // templated path, not checkable
      if (!existsSync(join(root, p))) {
        problems.push({ kind: 'missing-path', file: rel, detail: p });
      }
    }
  }

  // 3b. INTERNALS repo-path citations: every backticked repo path in
  // INTERNALS.md ("Read the code: `cadence-core/bin/route.mjs`") must exist, so
  // the deep-dive pointers cannot quietly go stale as the tree moves. Unlike
  // check 3 (which only sees ${CLAUDE_PLUGIN_ROOT} paths), these are plain
  // repo-relative paths; globs (`*-decision.mjs`) and non-path spans are skipped.
  const internals = join(root, 'INTERNALS.md');
  if (existsSync(internals)) {
    // Guarded for the same reason the walkers are (#49.1): a read that throws
    // AFTER the walk unwinds run() entirely, and the dispatch catch flattens
    // it to {ok:false,reason:"internal"} with `problems` absent - discarding
    // every problem found so far. Guarding only the walk closes half the
    // class; `chmod 000 INTERNALS.md` still collapsed the whole run.
    // No problem is pushed here: mdFiles yields INTERNALS.md too (:144), so
    // the read-guard above has already reported it and a second entry would
    // double-count one file - the same call the agents lint makes.
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

  // 1b. reverse: every schema key must be referenced by some prose token -
  // exactly, or via a >=2-segment prefix like `review.providers` (a bare
  // family name alone is too weak to count as a reader).
  for (const key of schemaKeys) {
    const covered = [...seenTokens].some((t) =>
      key === t || (t.split('.').length >= 2 && key.startsWith(t + '.')));
    if (!covered) problems.push({ kind: 'inert-config-key', file: 'cadence-core/config.schema.json', detail: key });
  }

  // 4. context-weight budgets: every measured prose surface (agents/skills/
  // workflows, via the SAME lib weight.mjs reports with, so enforced weight
  // cannot diverge from reported weight) must have a budget entry and stay at
  // or under it. The manifest is root-relative like config.schema.json, so a
  // --root fixture can supply its own; an absent manifest skips the check.
  const budgetPath = join(root, 'cadence-core', 'bin', 'weight-budgets.json');
  if (existsSync(budgetPath)) {
    // Same guard as INTERNALS.md above: unreadable OR malformed JSON here
    // used to sink the entire run rather than report one problem.
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
      if (bytes > budget) {
        problems.push({ kind: 'budget-overrun', file: surface,
          detail: `${bytes}B exceeds budget ${budget}B by ${bytes - budget}B` });
      }
    }
  } else if (isFullTree) {
    problems.push({ kind: 'missing-input', file: 'cadence-core/bin/weight-budgets.json', detail: 'always-expected input absent' });
  }

  // 5. agents-only tools-declaration lint, and 6. the preloaded-contract
  // resolution check - one walk of agents/, because both read the same
  // frontmatter and the second supplies the first with prose to scan.
  //
  // 5: an agent's prose may only reference tools it declares in frontmatter
  // `tools:`. Skills declare capability under `allowed-tools:` and are excluded
  // as SKILLS (D-07) - but a contract skill an agent PRELOADS is that agent's
  // own prose, injected verbatim at startup, so it is scanned here as part of
  // the agent. Without that, moving a contract out of the agent body (#74)
  // would silently empty this lint's input. Only backtick-quoted mentions or
  // "the <Tool> tool" phrasing count as references (D-06); bare-word uses
  // (`| Task |`, `Task completeness`, `Write \`None.\``) are ignored, so no
  // current prose needs editing.
  //
  // 6: every name in `skills:` must resolve to skills/<name>/SKILL.md and must
  // NOT set `disable-model-invocation: true`. Both failures are SILENT in the
  // host - a missing or disabled skill is skipped with only a debug-log
  // warning, and a skill that disables model invocation cannot be preloaded at
  // all. Either one produces an agent running with no contract, which reads
  // like an agent that decided to ignore its instructions rather than like a
  // typo. This check is what makes preloading safe to depend on (#74).
  const toolAlt = KNOWN_TOOLS.join('|');
  const backtickRe = new RegExp('`(' + toolAlt + ')`', 'g');
  const theToolRe = new RegExp('\\bthe (' + toolAlt + ') tool\\b', 'g');
  // This site runs AFTER the budget check, on the same agents/ directory
  // the filed repro (#49.1) targets - guarding only mdFiles and the shared
  // surfaces() walker (D-13) would leave the exact repro reachable here,
  // one check later. mdFiles already reported the same file as an
  // unreadable-surface problem, so this loop pushes NO problem of its own
  // for an unreadable entry - just skips it, to avoid double-counting one
  // broken link.
  const agentsDir = join(root, 'agents');
  // Hoisted: check 8's reverse direction (disk -> table) needs the same
  // listing, and reading the directory twice invites the two checks to
  // disagree about what is on disk.
  /** @type {string[]} */
  let agentFiles = [];
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
      // Frontmatter is the block between the first `---` and the next `---`;
      // the rest is the prose body the lint scans.
      const fm = text.match(/^---\n([\s\S]*?)\n---/);
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
      // 6. resolve every preloaded contract, collecting its prose for the
      // tools lint below. An unreadable SKILL.md is NOT reported here: skills/
      // is on the mdFiles walk, so the read-guard above already named it as an
      // unreadable-surface, and a second entry would double-count one file -
      // the same convention checks 3b and 5 follow.
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
        const skillFm = skillText.match(/^---\n([\s\S]*?)\n---/);
        if (skillFm && /^disable-model-invocation:[ \t]*true[ \t]*$/m.test(skillFm[1])) {
          problems.push({ kind: 'unpreloadable-agent-skill', file: rel,
            detail: `${skill} sets disable-model-invocation: true` });
          continue;
        }
        preloaded.push(skillFm ? skillText.slice(skillFm[0].length) : skillText);
      }

      const body = fm ? text.slice(fm[0].length) : text;

      // 7. an agent that preloads a contract carries no behaviour of its own.
      // Scanned on the BODY only, never on the preloaded contract prose - the
      // contracts legitimately use this whole vocabulary, which is the point
      // of them. Gated on the `skills:` key rather than on size: a 200-byte
      // behavioural instruction fits under any budget, so a size check would
      // miss exactly the failure this exists to catch, and gating on `skills:`
      // keeps a future one-off agent with inline prose legal (D-04).
      //
      // TWO arms, denylist first then allowlist, because the denylist alone
      // enforced less than INTERNALS.md:11 and DESIGN.md:378 claim of it. A
      // body carrying `<process>` is named by its tag, which is the more
      // actionable message; a body carrying no tag at all is then held to the
      // canonical template, which is what catches plain-prose behaviour and a
      // same-size REPLACEMENT of the pointer paragraph. Byte budgets were the
      // accidental backstop here - they catch an append and nothing else.
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
          const effortLine = fm[1].match(/^effort:[ \t]*(\S+)[ \t]*$/m);
          const issue = rungBodyIssue(body, effortLine ? effortLine[1] : undefined,
            parseSkillsField(fm[1]));
          if (issue) {
            problems.push({ kind: 'agent-carries-behaviour', file: rel,
              detail: `${issue.detail} - the contract belongs in the preloaded skill` });
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

  // 8. the rung ladder, both directions. This iterates the TABLE, not a
  // directory, so it cannot live inside the agents/ walk above. Root-relative
  // like config.schema.json and weight-budgets.json, so a --root fixture can
  // supply its own; an absent table skips the check (a full tree missing it is
  // a missing-input, matching the other always-expected inputs). The read and
  // the parse are guarded the way the budget manifest's are: a malformed table
  // is ONE problem and the run continues, rather than unwinding run() into
  // {ok:false,reason:"internal"} and discarding every problem found so far
  // (the #49.1 collapse).
  const routeTablePath = join(root, 'cadence-core', 'route-table.json');
  if (existsSync(routeTablePath)) {
    let table = null;
    try {
      table = JSON.parse(readFileSync(routeTablePath, 'utf8'));
    } catch (e) {
      problems.push({ kind: 'unreadable-surface', file: 'cadence-core/route-table.json',
        detail: e.code || e.message });
    }
    if (table && typeof table === 'object' && !Array.isArray(table)) {
      // The grids' own well-formedness, cell by cell. The vocabulary comes from
      // config.schema.json - the file that already defines these names (D-10) -
      // rather than from parsing references/review-triggers.md's Wiring table,
      // which has no stated grammar.
      const gateSpec = schema['review.triggers.plan.gate'] || {};
      const stakesSpec = schema.stakes || {};
      for (const { code, detail } of cellIssues(table, {
        levels: Array.isArray(stakesSpec.values) ? stakesSpec.values : [],
        triggers: TRIGGERS,
        gates: Array.isArray(gateSpec.values) ? gateSpec.values : [],
      })) {
        problems.push({ kind: code, file: 'cadence-core/route-table.json', detail });
      }

      // The `surfaces` block, in BOTH directions against config.schema.json's
      // `risk.override.<surface>` keys. `requiredFloor` is the LAST level of the
      // schema's stakes enum, never the literal "critical": the level names come
      // from the schema everywhere else in this check, and a hardcoded copy here
      // would be the vocabulary drift this walk exists to catch.
      const stakesValues = Array.isArray(stakesSpec.values) ? stakesSpec.values : [];
      for (const { code, detail } of surfaceIssues(table, {
        levels: stakesValues,
        gates: Array.isArray(gateSpec.values) ? gateSpec.values : [],
        overrideSurfaces: SURFACES,
        requiredFloor: stakesValues[stakesValues.length - 1],
      })) {
        problems.push({ kind: code, file: 'cadence-core/route-table.json', detail });
      }

      // table -> disk: every name route.mjs can return must exist. route.mjs
      // never checks the name it returns, so without this an unbuilt or
      // renamed rung fails at dispatch time instead of in CI.
      const routable = routableAgents(table);
      for (const [stem, cell] of routable) {
        if (!existsSync(join(root, 'agents', `${stem}.md`))) {
          problems.push({ kind: 'missing-rung-agent', file: 'cadence-core/route-table.json',
            detail: `${cell}: agents/${stem}.md absent` });
        }
      }
      // disk -> table, which "exactly the files the grids name" needs and the
      // walk above does not give. Matched ONLY on the rung-suffixed shape: a
      // blanket "not named by the table" rule would outlaw the one-off agent
      // with inline prose D-04 deliberately keeps legal. Without this
      // direction, a stale rung file - one no cell reaches - stays green while
      // still paying standing context in every main-session prompt.
      const order = Array.isArray(table.rung_order) ? table.rung_order : [];
      // Longest role name first, so a role that prefixes another cannot claim
      // the other's file.
      const roleNames = declaredRoles(table).sort((a, b) => b.length - a.length);
      for (const e of agentFiles) {
        if (!e.endsWith('.md')) continue;
        const stem = e.slice(0, -3);
        if (routable.has(stem)) continue;
        for (const role of roleNames) {
          if (!stem.startsWith(`${role}-`)) continue;
          const rung = stem.slice(role.length + 1);
          if (order.includes(rung)) {
            // Two faults reach here and want opposite fixes. A file the rung
            // map names is a cell that went missing (add the cell); a file it
            // does not name is a stale rung file (delete it).
            const mapped = rungFile(role, rung) === stem;
            problems.push({ kind: 'undeclared-rung-agent', file: `agents/${stem}.md`,
              detail: mapped
                ? `${rung} is ${role}'s rung in lib/rung-agent.mjs, but no cell at any level resolves to it`
                : `no cell names ${role} at rung ${rung}, and lib/rung-agent.mjs maps no file to it` });
          }
          break;
        }
      }
    }
  } else if (isFullTree) {
    problems.push({ kind: 'missing-input', file: 'cadence-core/route-table.json',
      detail: 'always-expected input absent' });
  }

  // 9. the config-key reach table, against config.schema.json in both
  // directions, plus the narrow-reach-must-be-stated rule. Root-relative like
  // route-table.json and weight-budgets.json, so a --root fixture can supply
  // its own schema AND its own table; an absent doc skips the check, and a
  // full tree missing it is a missing-input like the other always-expected
  // inputs. The read and the parse are guarded the way those two are: a
  // malformed table is problems ON THE TABLE and the run continues, rather
  // than unwinding run() into {ok:false,reason:"internal"} and discarding
  // every problem found so far (the #49.1 collapse). The read failure itself
  // pushes nothing - references/ is on the mdFiles walk, so the read-guard up
  // there already named the file, the convention checks 3b and 5 follow.
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
        // `rows === null` means the section heading is absent, already one
        // problem above - reporting all 72 keys missing on top of it would
        // bury the one fault under copies of another.
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

  return problems;
}

// --- entry ---------------------------------------------------------------------

try {
  const argv = process.argv.slice(2);
  const ri = argv.indexOf('--root');
  const root = ri >= 0 ? argv[ri + 1] : join(HERE, '..', '..');
  const problems = run(root);
  emit({ ok: problems.length === 0, checked: 'config-keys, invocations, paths, internals-paths, budgets, tools, agent-skills, agent-behaviour, routing-cells, risk-surfaces, config-reach', problems });
} catch (e) {
  emit({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
}
