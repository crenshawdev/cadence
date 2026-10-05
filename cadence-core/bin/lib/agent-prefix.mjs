// @ts-check
// agent-prefix.mjs - the rule that gives a bare Cadence agent stem its plugin
// prefix at dispatch, as a safety net (phase 5, D-07). The Cadence module
// (hooks/cadence-mod.mjs) applies it to an Agent `tool.call`.
//
// Cadence's commands dispatch the `agent_type` route.mjs returns, which
// already carries the plugin's prefix (`cadence:cad-planner`), because a bare
// stem belongs to whoever owns that bare name. This rewrite catches the calls
// that still go out bare - route's `{ok:false}` arm dispatches the base stem,
// and a model can drop the prefix - since the host resolves only the prefixed
// name and the listing filter took away the line the model used to read it off
// (spike agent-offer-dispatch, criteria 8 and 9).
//
// Only a value that is exactly one of the stems RUNG_FILES files is rewritten,
// and never one a non-`plugin` `agent.offer` named: a project or user agent
// called `cad-reviewer` is the user's, and it goes through as sent. So a
// user's own unnamespaced `cad-<x>` agent, a name that already carries a
// prefix, and the host's own types all go through as sent, for every name.
//
// Its one import is lib/rung-agent.mjs, which imports nothing; no Node globals,
// because a hooks module may load only relative dependency-free files. The
// stem lookup is rung-agent's own `roleOfAgent`, not a second copy of the map.
'use strict';

import { roleOfAgent } from './rung-agent.mjs';

/**
 * The bare agent name an `agent.offer` says someone other than a plugin owns,
 * or null. Keyed on `source` alone - `projectSettings`, `userSettings`, or any
 * other non-`plugin` source - never on `provider.plugin`. Reads the event's
 * getters, so the caller wraps it: a throw must record nothing.
 * @param {any} offer the `agent.offer` input
 * @returns {string | null}
 */
export function ownedAgent(offer) {
  const { agent, source } = offer;
  if (typeof agent !== 'string' || agent === '' || agent.includes(':')) return null;
  return typeof source === 'string' && source !== 'plugin' ? agent : null;
}

/**
 * The `subagent_type` to dispatch: `<plugin>:<value>` when `value` is exactly
 * one of Cadence's agent stems, `plugin` is a non-empty string, and `owned`
 * does not hold `value`; null when the call stays as sent.
 * @param {unknown} value the Agent call's `subagent_type`
 * @param {unknown} plugin the plugin's own name, from plugin.json
 * @param {ReadonlySet<string>} [owned] bare names a non-plugin offer named
 * @returns {string | null}
 */
export function prefixedAgent(value, plugin, owned) {
  if (typeof value !== 'string' || value.includes(':')) return null;
  if (typeof plugin !== 'string' || plugin === '') return null;
  if (owned !== undefined && owned.has(value)) return null;
  return roleOfAgent(value) === null ? null : `${plugin}:${value}`;
}
