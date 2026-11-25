// @ts-check
// agile-setup.mjs - which of a project's setup questions are still open, so a start asks each one once and before it writes
// pure: merged config and a resolve in, names out
'use strict';

import { isAcceptedTestScope, isPlainObject } from './config-merge.mjs';
import { forgeRecordComplete } from './forge-decision.mjs';
import { answeredSurfaces } from './surface-scan.mjs';

/** @param {any} config @param {string[]} path */
function at(config, ...path) {
  return path.reduce((v, key) => (isPlainObject(v) ? v[key] : undefined), config);
}

/**
 * The questions no config layer answers, in the order they're asked. Testing is last because an answered surface is one
 * of the places its policy tests harder.
 * @param {any} config the merged layers @returns {('forge' | 'surfaces' | 'testing')[]}
 */
export function unanswered(config) {
  /** @type {['forge' | 'surfaces' | 'testing', boolean][]} */
  const questions = [
    ['forge', forgeRecordComplete({ provider: at(config, 'git', 'forge_provider'), repo: at(config, 'git', 'forge_repo'),
      host: at(config, 'git', 'forge_host') })],
    ['surfaces', answeredSurfaces(at(config, 'review', 'triggers', 'risk_surface', 'surfaces')).answered],
    ['testing', isAcceptedTestScope(at(config, 'testing', 'scope'))],
  ];
  return questions.filter(([, answered]) => !answered).map(([name]) => name);
}

/**
 * The reviewers a project names. `dropped` are the outside ones no review that fires would run; one a single review drops
 * still reviews, so it isn't there.
 * @param {any} config the merged layers @param {any} resolved what `route.mjs resolve --role cad-reviewer` answered
 * @returns {{list: string[], outside: string[], dropped: string[]}}
 */
export function namedReviewers(config, resolved) {
  const wrote = at(config, 'review', 'reviewers');
  /** @type {string[]} */
  const list = [...new Set(Array.isArray(wrote) ? wrote.filter((n) => typeof n === 'string' && n) : [])];
  const firing = Object.keys(resolved.review).filter((trigger) => resolved.review[trigger] !== 'off');
  const runs = new Set(firing.flatMap((trigger) => resolved.reviewers[trigger] ?? []));
  const named = list.filter((n) => n !== 'claude-subagent');
  return { list, outside: named.filter((n) => runs.has(n)), dropped: named.filter((n) => !runs.has(n)) };
}
