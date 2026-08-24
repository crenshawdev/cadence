---
phase: 2
status: complete
completed: 2026-08-24
---

# Phase 2: A repo-scoped key refuses at the layer that cannot honour it - Summary

`config.mjs set` and `check` now refuse a schema-marked repo-layer-only key at
write time when the resolved target file is the user-global layer, off a new
`"repo_only"` marker rather than a hard-coded key list.

## What shipped

- The `"repo_only": true` marker and its meaning - `cadence-core/config.schema.json`, carried today by `git.auto_close` alone; the `_meta.note` states the authorization test a maintainer applies before adding it
- `layerIdentity()` exported so the write face resolves the layer off the target FILE, not the flag - `cadence-core/bin/lib/config-merge.mjs`
- The refusal itself, inside `checkPairs` ahead of every read and write, so a multi-pair `set` leaves the target untouched - `cadence-core/bin/config.mjs`
- `check --global`, declared on the arg contract and reporting the identical per-pair error the write face refuses on - `cadence-core/bin/lib/arg-contract.mjs`
- The schema-derived refusal test and its unmarked negative control - `cadence-core/bin/config.test.mjs`
- The `[repo-layer-only]` legend clause and row marker - `cadence-core/references/config-catalog.md`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | e6b7a8dc | Mark `git.auto_close` repo-layer-only in the schema |
| 1 | 2 | 9e08b203 | Refuse a repo-layer-only key at the resolved user-global layer |
| 1 | 3 | 5e8b4afe | `check --global` reports what the write face refuses |
| 1 | 4 | 498dbb15 | Prove the refused set comes from the schema marker |
| 1 | 5 | a57fdfa4 | State the repo-layer-only marker in the config catalog |
| 1 | 5 | 47be9e04 | Pin the flag census at the 179 entries the table declares |

## Deviations

- [deviation] The plan asserted its seven-path `files:` lease was sufficient for "`node cadence-core/bin/test.mjs` reports 0 failures". It was not: task 3's required `CONTRACTS['config.mjs'].check['--global']` row moved the flag census `arg-contract.test.mjs:303` pins from 178 to 179, and that file was undeclared, so `lease-check` would have refused the commit that fixed it. Raised as a structural checkpoint, approved by the user, and the plan's `files:` frontmatter widened with `cadence-core/bin/arg-contract.test.mjs`. Re-pinned at 179 in `47be9e04`; `lease-check` then returned `ok:true` across 8 declared paths.

## Open items

- The `risk_surface` gate raised one HIGH that the user explicitly OVERRODE rather than fixed: the scope decision is made from a path identity (`config.mjs:277` `layerIdentity(file)`) that is not bound to the file subsequently read (`:285`) and atomically replaced, so a symlink-directory swap between those points writes through a path the check already cleared. Adjudicated real against the cited code. Not a regression - before this phase `set` applied the pair with no layer check at all, so winning the race reaches the pre-diff behaviour. Impact is worse than the reviewer stated: the target is the user-global layer, where global-only keys such as `workflow.test_command` are honoured and that value is a command Cadence later executes. The fd-binding fix is its own work, not a rider on this phase.
- Cadence defect found while recording that override: an adjudication record cannot express an OVERRIDDEN survivor. `lib/adjudication-record.mjs:365` requires a `fix_commit` matching `/^[0-9a-fA-F]{7,40}$/` on every `survived` ruling, so a finding the user overrode has no representation short of downgrading it, which would convert an override into a pass. The `override` receipt was written; no `ADJUDICATION-risk_surface-plan-1.json` exists.
- `config.mjs check --global` ships undocumented in `cadence-core/workflows/config.md`, which measures 15705/15705 with zero headroom. No self-verify check is one-directional here, so nothing reports it.
- Under `CADENCE_GLOBAL_CONFIG` pointed at a repo config (the collapse case `mergeLayers` documents), a `--file` write of a marked key now refuses, since both paths resolve to one `layerIdentity`. No shipped test covers it.

## Goal check

The six commits deliver the goal. Verified live rather than inferred: with
`CADENCE_GLOBAL_CONFIG` at a temp file, `config.mjs set git.auto_close=true
--global` returns `ok:false` / `reason:"invalid"` with a `detail[]` entry naming
the key and telling the user to `set it with --file <repo config> instead`, and
the file afterwards holds only the unrelated `stakes` write, so nothing landed on
the refused arm; `check --global git.auto_close=true` returns that same per-pair
error; `set stakes=critical --global` returns `ok:true` with the value on disk.
The rule is schema-derived rather than key-listed - task 4's test
(`498dbb15`) drives it off a fixture that marks a key the shipped schema
deliberately leaves unmarked, so a literal-list implementation would fail it.
`node cadence-core/bin/test.mjs` reports 2969 pass / 0 fail. What is NOT
delivered is a scope check that survives a hostile local race; the open item
above states that plainly, and it was the user's explicit call to land the phase
with it standing.
