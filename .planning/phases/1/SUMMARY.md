---
phase: 1
status: complete
completed: 2026-08-27
---

# Phase 1: Land on a forge that is not on port 22 - Summary

`git.forge_host` grew a `host[:port]` grammar enforced at the config write face,
carried whole into the `tea` login match and into `forge.mjs create`, which now
refuses a `--remote-url` naming a port the configured instance does not serve.

## What shipped

- `splitForgeHost` - the one grammar that judges and splits a `host[:port]`, in `cadence-core/bin/lib/forge-decision.mjs`
- A grammar gate at the config write face - `checkType` + `checkGrammar` over a frozen `GRAMMARS` registry, with `grammar` markers on `git.forge_repo` and `git.forge_host`, in `cadence-core/bin/config.mjs` and `cadence-core/config.schema.json`
- The port as a login VETO - `teaLoginNameForHost` splits the persisted value and passes both halves to `loginNamesHost`, in `cadence-core/bin/lib/issue-decision.mjs`
- `portSpelled` on every `classifyOrigin` shape, so "named no port" and "named 443" stay different facts
- Two `create` refusals that spawn nothing at all - a `--remote-url` whose port disagrees with the instance, and a `--remote-url` on a row whose create wires `origin` itself - in `cadence-core/bin/forge.mjs`
- The port asked for and carried whole in both setup workflows, and stated on `references/config-catalog.md` and `references/config-reach.md`

## Commits

| Plan | Task | Commit | Description |
|---|---|---|---|
| 1 | 1 | 94207af4 | `splitForgeHost` beside the slug grammar; portless answers a null port, bracketed IPv6 refused as a stated decision |
| 1 | 2 | 6688a816 | `checkValue` split into `checkType` + `checkGrammar` over a frozen `GRAMMARS` registry; `grammar` markers on the two typed forge keys |
| 1 | 3 | 8812ecf5 | `teaLoginNameForHost` splits with `splitForgeHost` and passes both halves to `loginNamesHost` |
| 1 | 4 | a3b7b4a5 | `portSpelled` derived in `splitOrigin` off the same `AUTHORITY` port group, carried on all four `classifyOrigin` shapes |
| 1 | 5 | 6fec1600 | `create` refuses a `--remote-url` whose port the configured instance does not serve, before the PATH check and before the login probe |
| 1 | 6 | 9a81077d | The gitlab arm refuses a `--remote-url`, naming the `--remoteName origin` conflict, keyed on the table and never on the string |
| 1 | 7 | a6719247 | Both setup workflows ask for the instance port and carry it whole into the `--remote-url` they build |
| 1 | 8 | e8a964b0 | The port grammar stated on `config-catalog.md`; `bin/forge.mjs create` added as a reader on `config-reach.md` |
| 1 | risk gate | bc6a0460 | Fold case when comparing the persisted forge host to the origin's - the `risk_surface` review's one blocker/high finding |

## Deviations

None - plans executed as written.

## Open items

- No `lint` command exists in this project: `planning.mjs detect-commands` reports `lint:null`, `typecheck:"npx tsc -p tsconfig.ci.json"`. The typecheck was run and was clean after every task; there was no lint to run.
- Declined a general `validateValue`-style extension point on the schema: the `grammar` marker resolves through one frozen registry of two named predicates, because task 2's `Verify:` exercises exactly those two plus the unregistered-marker error. Make it pluggable when a task states a third grammar a registry entry cannot express.
- Declined widening `create`'s config read beyond `git.forge_host`: the merge is already bound and its `config` object is in hand, so a future task needing another persisted key adds a line rather than a read.
- `## Must be true when done` line 8 (AC7's reachable clause) is folded in as a UAT verification per the plan's own Notes, not as a task. Re-measured during execution: `GIT_SSH_COMMAND="ssh -o BatchMode=yes -o StrictHostKeyChecking=yes" git ls-remote --exit-code ssh://git@ssh.jcrenshaw.dev:2222/crenshawdev/cadence-archived.git HEAD` exits 0, so the unattended host-key blocker that left it unproven at the v3.7.1 close is gone. A PORTED-instance origin wired by `create` itself still needs a live ported Forgejo, which this environment does not have; that half belongs to the phase's UAT.
- `HOST_LABEL` bounds no individual label length while `FORGE_HOST_MAX` bounds only the 253-octet total, so a 64-octet label is accepted and persisted as an address DNS cannot resolve (`cadence-core/bin/lib/forge-decision.mjs:287`). Raised by the `risk_surface` review, ruled `downgraded` (real, below the gate's blocker/high threshold) and filed with the decline label on `crenshawdev/cadence`.

## Goal check

The sum of these commits delivers the phase goal. The first clause is proved
directly: in a scratch planning root, `config.mjs set git.forge_host=forge.example:3001`
answers `changed`, `config.mjs get` reads back `forge.example:3001` byte for byte,
and `git.forge_host=forge.example:0443` is refused naming the key and the
no-leading-zero rule with the file on disk unchanged. The refusal clauses are
covered by `forge.test.mjs` arms that assert both ports appear in the reason and
that `calls(log)` is empty - nothing spawned - for the http(s) wrong-port case,
the scp-implied-22 case and the gitlab `--remoteName origin` conflict, with the
accept arms (configured port, SSH port over a non-http scheme, a different host
entirely) still reaching `tea repos create`. The port reaches the login match
through `splitForgeHost` in `teaLoginNameForHost`, and `loginNamesHost` compares
the port it is now given rather than a half it never was. `node cadence-core/bin/test.mjs`
is 3457 pass, 0 fail, 1 skipped, and `self-verify` reports `ok:true` with empty
problems. One clause is NOT proved here and is named as an open item rather than
claimed: that the origin `create` wires against a ported instance actually
ANSWERS needs a live ported Forgejo this environment does not have, so it is the
phase's UAT to settle. The blocking `risk_surface` review found one high finding
against the new refusal itself - the persisted host was compared case-sensitively
against a host `splitOrigin` had already lowercased, so a single capital letter
in `git.forge_host` skipped the whole check - fixed in bc6a0460 with a regression
test, and the capped re-arm round confirmed it closed and introduced nothing new.
