#!/usr/bin/env node
// @ts-check
// self-verify.mjs - the prose<->code drift linter, run in CI. The 2026-07-16
// sweep found that nearly every defect in this repo was prose describing a
// flag, key, or path the code did not have; this script makes that whole
// class mechanical. Three checks over the LIVE prose surfaces (workflows,
// references, skills, agents, templates - deliberately not the historical
// docs DESIGN/LINEAGE/CHANGELOG, which may name cut keys while explaining
// the cut):
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
//
// Seam convention: one JSON line on stdout, exit 0 clean / 1 problems found.
// Usage: self-verify.mjs [--root <repo root>]
'use strict';

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { emit } from './lib/seam-io.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

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
      '--severity', '--cause', '--fix', '--evidence', '--source'],
    'uat merge': ['--phase'],
    'uat status': ['--phase'],
    audit: [],
    'plan-overlap': ['--phase'],
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
  'route.mjs': {
    '*': [],
    resolve: ['--role', '--attempt', '--files', '--ambiguity', '--file'],
    table: [],
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
    for (const e of readdirSync(d, { recursive: true, encoding: 'utf8' })) {
      const f = join(d, String(e));
      if (f.endsWith('.md') && statSync(f).isFile()) yield f;
    }
  }
}

/**
 * Expand <t>/<trigger>/<name>-style placeholders into every concrete key
 * they stand for (cartesian across placeholders). A single representative
 * would under-cover the reverse check: prose that says
 * `review.triggers.<t>.tier` covers ALL triggers' tier keys, not just plan's.
 * @param {string} token @param {string[]} triggers @param {string[]} providers
 */
function expand(token, triggers, providers) {
  let out = [token];
  const subst = (list, re, values) =>
    list.flatMap((t) => re.test(t) ? values.map((v) => t.replace(re, v)) : [t]);
  out = subst(out, /<t(?:rigger)?>?/g, triggers);
  out = subst(out, /<(?:name|provider)>?/g, providers);
  return out;
}

// --- checks ------------------------------------------------------------------

function run(root) {
  const problems = [];
  const schema = JSON.parse(
    readFileSync(join(root, 'cadence-core', 'config.schema.json'), 'utf8')).keys;
  const schemaKeys = Object.keys(schema);
  const FAMILIES = new Set(schemaKeys.map((k) => k.split('.')[0]));
  const NON_KEY_SEGMENT = new Set(['md', 'json', 'mjs', 'test', 'schema']);
  const TRIGGERS = [...new Set(schemaKeys
    .filter((k) => k.startsWith('review.triggers.')).map((k) => k.split('.')[2]))];
  const PROVIDERS = [...new Set(schemaKeys
    .filter((k) => k.startsWith('review.providers.')).map((k) => k.split('.')[2]))];
  // Keys with no dot can never match the dotted-token regex; they are covered
  // by a bare-word mention instead.
  const BARE_KEYS = schemaKeys.filter((k) => !k.includes('.'));

  const seenTokens = new Set();

  for (const file of mdFiles(root)) {
    const text = readFileSync(file, 'utf8');
    const rel = relative(root, file);

    // 1. config-key tokens: family-rooted dotted identifiers.
    for (const m of text.matchAll(/\b([a-z_]+(?:\.[a-z_0-9<>]+)+)/g)) {
      // A closing placeholder bracket can trail the token (`<review.consult.effort>`).
      const raw = m[1].replace(/>+$/, '');
      const family = raw.split('.')[0];
      if (!FAMILIES.has(family)) continue;
      if (raw.split('.').some((seg) => NON_KEY_SEGMENT.has(seg))) continue;
      const expansions = expand(raw, TRIGGERS, PROVIDERS);
      for (const t of expansions) seenTokens.add(t);
      const known = expansions.some((t) =>
        schemaKeys.some((k) => k === t || k.startsWith(t + '.')));
      if (!known) problems.push({ kind: 'unknown-config-key', file: rel, detail: raw });
    }
    for (const k of BARE_KEYS) {
      if (new RegExp(`\\b${k}\\b`).test(text)) seenTokens.add(k);
    }

    // 2. script invocations.
    // Join backslash continuations so multi-line commands read as one.
    const joined = text.replace(/\\\n\s*/g, ' ');
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

  // 1b. reverse: every schema key must be referenced by some prose token -
  // exactly, or via a >=2-segment prefix like `review.providers` (a bare
  // family name alone is too weak to count as a reader).
  for (const key of schemaKeys) {
    const covered = [...seenTokens].some((t) =>
      key === t || (t.split('.').length >= 2 && key.startsWith(t + '.')));
    if (!covered) problems.push({ kind: 'inert-config-key', file: 'cadence-core/config.schema.json', detail: key });
  }

  return problems;
}

// --- entry ---------------------------------------------------------------------

try {
  const argv = process.argv.slice(2);
  const ri = argv.indexOf('--root');
  const root = ri >= 0 ? argv[ri + 1] : join(HERE, '..', '..');
  const problems = run(root);
  emit({ ok: problems.length === 0, checked: 'config-keys, invocations, paths', problems });
} catch (e) {
  emit({ ok: false, reason: 'internal', detail: e && e.message ? e.message : String(e) });
}
