// @ts-check
// agent-prefix.mjs - the rule that gives a bare Cadence agent stem its plugin
// prefix at dispatch (phase 5, D-07). The Cadence module (hooks/cadence-mod.mjs)
// applies it to an Agent `tool.call`.
//
// Cadence commands dispatch the `agent` route.mjs returns, a bare agents/*.md
// stem such as `cad-planner`, and the host resolves only the plugin's
// `cadence:cad-planner`. The model used to add the prefix by reading the agent
// listing, which lib/listing-filter.mjs now takes out, and a bare stem then
// fails as an unknown type (spike agent-offer-dispatch, criteria 8 and 9).
//
// Only a value that is exactly one of the stems RUNG_FILES files is rewritten,
// so a user's own unnamespaced `cad-<x>` agent, a name that already carries a
// prefix, and the host's own types all go through as sent.
//
// Its one import is lib/rung-agent.mjs, which imports nothing; no Node globals,
// because a hooks module may load only relative dependency-free files. The
// stem lookup is rung-agent's own `roleOfAgent`, not a second copy of the map.
'use strict';

import { roleOfAgent } from './rung-agent.mjs';

/**
 * The `subagent_type` to dispatch: `<plugin>:<value>` when `value` is exactly
 * one of Cadence's agent stems and `plugin` is a non-empty string, and null
 * when the call stays as sent.
 * @param {unknown} value the Agent call's `subagent_type`
 * @param {unknown} plugin the plugin's own name, from plugin.json
 * @returns {string | null}
 */
export function prefixedAgent(value, plugin) {
  if (typeof value !== 'string' || value.includes(':')) return null;
  if (typeof plugin !== 'string' || plugin === '') return null;
  return roleOfAgent(value) === null ? null : `${plugin}:${value}`;
}
