// @ts-check
// config-preview.mjs - the pure parts of `config.mjs preview`: which file a key lands in, what route decides
// differently, what starts or stops applying, and the preview's answer. No fs, env or spawn: config.mjs runs the
// children and hands this the two reads, so every rule here is tested without a process.
'use strict';

import { isDeepStrictEqual } from 'node:util';
import { dependentsOf } from './setting-conditions.mjs';

/** Keys where a revoke reads off then off in force, so the file's stored value is shown beside it. */
export const STORED_KEYS = Object.freeze(['git.auto_close', 'workflow.use_workflows', 'workflow.multi_workflow', 'review.reviewers']);

// route's reason and warnings are prose about the decision, never part of it, so a wording change isn't a change
const DECISION_SKIP = new Set(['ok', 'reason', 'warnings']);

const isObj = (/** @type {any} */ v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * The layer a key is written to: the user-global file for `src: global`, the repository file for everything else,
 * `repo_only` keys included.
 * @param {any} spec
 * @returns {'repo'|'global'}
 */
export const targetLayer = (spec) => (spec && spec.src === 'global' ? 'global' : 'repo');

/**
 * The roles route is asked about: a `roles.<role>.*` pair resolves that role, any `review.*` pair resolves the
 * reviewer. Every other key is compared by its value in force alone.
 * @param {string[]} keys
 * @returns {string[]}
 */
export function rolesFor(keys) {
  const roles = [];
  for (const key of keys) {
    const m = /^roles\.([^.]+)\./.exec(key);
    const role = m ? m[1] : key.startsWith('review.') ? 'cad-reviewer' : null;
    if (role && !roles.includes(role)) roles.push(role);
  }
  return roles;
}

/**
 * The keys whose applies answer could differ: the pairs themselves and every setting whose `applies_when` names one.
 * A set changes its own leaf only, so a condition can flip only through a key the batch wrote.
 * @param {Record<string, any>} schema
 * @param {string[]} keys
 * @returns {string[]}
 */
export function candidateKeys(schema, keys) {
  const all = [...keys];
  for (const key of keys) for (const dep of dependentsOf(schema, key)) if (!all.includes(dep)) all.push(dep);
  return all;
}

/**
 * What route decides differently between the two sides, field by field. An object field (`review`, `reviewers`)
 * is compared one level down so the answer names `review.plan`, not the whole map.
 * @param {any} before @param {any} after
 * @returns {{field: string, before: any, after: any}[]}
 */
export function diffDecision(before, after) {
  const changes = [];
  const fields = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const field of fields) {
    if (DECISION_SKIP.has(field)) continue;
    const b = before[field];
    const a = after[field];
    if (isObj(b) || isObj(a)) {
      const subs = new Set([...Object.keys(isObj(b) ? b : {}), ...Object.keys(isObj(a) ? a : {})]);
      for (const sub of subs) {
        const bv = isObj(b) ? b[sub] : undefined;
        const av = isObj(a) ? a[sub] : undefined;
        if (!isDeepStrictEqual(bv, av)) changes.push({ field: `${field}.${sub}`, before: bv ?? null, after: av ?? null });
      }
    } else if (!isDeepStrictEqual(b, a)) changes.push({ field, before: b ?? null, after: a ?? null });
  }
  return changes;
}

/**
 * Every setting whose applies answer flips between the two reads. A stop carries the reasons it no longer has an
 * effect; a start carries the reasons it had none.
 * @param {string[]} keys
 * @param {Record<string, any>} before @param {Record<string, any>} after rows by key, from the layer read
 * @returns {{starts: {key: string, why: string[]}[], stops: {key: string, why: string[]}[]}}
 */
export function appliesFlips(keys, before, after) {
  const starts = [];
  const stops = [];
  for (const key of keys) {
    const b = before[key];
    const a = after[key];
    if (!b || !a || b.applies === a.applies) continue;
    if (a.applies) starts.push({ key, why: b.no_effect || [] });
    else stops.push({ key, why: a.no_effect || [] });
  }
  return { starts, stops };
}

/**
 * The preview's answer from the two reads.
 * @param {{
 *   files: {layer: 'repo'|'global', file: string, pairs: {key: string, value: any}[]}[],
 *   otherFile: {repo: string, global: string},
 *   before: {rows: Record<string, any>, decisions: Record<string, any>},
 *   after: {rows: Record<string, any>, decisions: Record<string, any>},
 *   candidates: string[],
 * }} read
 */
export function buildPreview({ files, otherFile, before, after, candidates }) {
  const outFiles = files.map(({ layer, file, pairs }) => ({
    layer,
    file,
    pairs: pairs.map(({ key, value }) => {
      const b = before.rows[key];
      const a = after.rows[key];
      const row = { key, value, before: b.value, after: a.value };
      if (STORED_KEYS.includes(key)) Object.assign(row, { stored: { before: b[layer], after: a[layer] } });
      if (b.both === true && value === true) {
        const other = layer === 'repo' ? 'global' : 'repo';
        const cell = b[other];
        if (!(cell && cell.state === 'set' && cell.value === true)) {
          Object.assign(row, { second_file: { layer: other, file: otherFile[other] }, stays_off: true });
        }
      }
      return row;
    }),
  }));
  const roles = Object.keys(after.decisions);
  const resolves = roles.map((role) => {
    const b = before.decisions[role];
    const a = after.decisions[role];
    if (!b || !a || b.ok !== true || a.ok !== true) {
      return { role, changes: [], unresolved: (a && a.reason) || (b && b.reason) || 'unresolved' };
    }
    return { role, changes: diffDecision(b, a) };
  });
  return { files: outFiles, resolves, ...appliesFlips(candidates, before.rows, after.rows) };
}
