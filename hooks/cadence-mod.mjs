// @ts-check
// cadence-mod.mjs - the Cadence module: the in-process half of the plugin, for
// hosts that load mods. hooks/hooks.json names it under `modules`, beside the
// command hooks. A host without mods ignores that key and keeps the hooks.
//
// It stays thin on purpose. A hooks module may import only relative files and
// `claude-code`: no `node:` module, no Node globals. So every rule it applies
// lives in a dependency-free file under ../cadence-core/bin/lib/, where CI's
// typecheck and test.mjs cover it and the command hooks can share it (the
// `.planning/` walk in lib/git-segments.mjs is the first). This file only wires
// those rules to host events and does its I/O through `$`.
//
// The band above the prompt (Plan 2 of phase 3) and the token capture for
// figureless returns (Plan 3) land here. Until then it registers nothing.
//
// git-guard, read-trace and subagent-trace stay command hooks on every host, so
// this module makes no git decision and stands no hook down.

/** @param {unknown} _on the host's hook registrar */
export function register(_on) {}
