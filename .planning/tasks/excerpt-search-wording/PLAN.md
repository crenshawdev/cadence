# Task: excerpt_search as the stated path for code search

Source: the excerpt session's 2026-09-04 measurement, and John's decision on
2026-09-04 to run the contract-wording lever this milestone rather than the
excerpt-side tool-description lever.

`mcp__excerpt__excerpt_search` has been called 0 times in this project. Shell
`grep` ran 207 times in one day. The contracts already say to prefer excerpt
over the built-in Read and Grep TOOLS, and that sentence does not reach the
shell channel where the searches actually go. excerpt's own deny hook cannot
close it either: the hook steps aside on `agent_id` by design, so it never
reaches a subagent, and it cannot see a Bash command's arguments at all. In a
subagent-heavy workflow the contract wording is the only lever that reaches
the agent doing the searching.

Three contracts also carry the opposite instruction in the same file -
"locate with `grep -n`" - which would leave the experiment measuring a
contradiction rather than the wording. Task 2 resolves it.

This is a measurement change. Contract wording is read at session start, so
it reaches live agents only after a Claude Code restart.

## Task 1: claim the shell channel in all six contracts

- **Files:** skills/cad-assumptions-analyzer-contract/SKILL.md,
  skills/cad-executor-contract/SKILL.md,
  skills/cad-plan-checker-contract/SKILL.md,
  skills/cad-planner-contract/SKILL.md,
  skills/cad-reviewer-contract/SKILL.md,
  skills/cad-verifier-contract/SKILL.md
- **Action:** extend the existing "prefer them over built-in Read and Grep"
  sentence so it also names the shell: prefer `excerpt_search` over shell
  `grep`/`rg` for code search, the shell channel is not an exemption. Keep
  the existing "when they are absent, the built-ins are the path" clause
  intact in every one. Three files carry the sentence as a one-line bullet,
  two as a wrapped paragraph, one folded into the reviewer's grounding
  paragraph; match each file's own shape and wrap width.
- **Verify:** `grep -c 'shell .grep./.rg. for code search'` returns 1 for
  each of the six files, and `grep -c 'not a reason to stop\|built-ins are
  the path'` is unchanged from before the edit.

## Task 2: route the locate instruction through excerpt_search

- **Files:** skills/cad-assumptions-analyzer-contract/SKILL.md,
  skills/cad-executor-contract/SKILL.md,
  skills/cad-planner-contract/SKILL.md
- **Action:** rewrite the "Where `skim.mjs` does not apply" paragraph so
  `excerpt_search` is the path when it is on the tool list and `grep -n`
  carrying no `-A`/`-B`/`-C` is the named fallback when it is not. Keep the
  locate-before-reading discipline, the LOOSER PATTERN rule, the `perl -ne`
  boundary-range tip and the `-A40` tell, with the perl tip explicitly
  attached to the no-excerpt path.
- **Verify:** those three files each contain `excerpt_search` inside the
  `skim.mjs does not apply` paragraph, still contain `grep -n` carrying NO,
  `LOOSER PATTERN`, `perl -ne` and `-A40`, and the other three contracts
  gain no `grep -n` instruction.

## Outcome

Both tasks shipped. All six contracts now name the shell channel; the three
that carried a "locate with `grep -n`" instruction (assumptions-analyzer,
executor, planner - not verifier, which carries only the `skim.mjs` line)
route it through `excerpt_search` with `grep -n` as the named fallback.

Deviation: `self-verify` failed with `budget-overrun` on all six contracts,
so the six ceilings in `cadence-core/bin/weight-budgets.json` moved with the
added sentences (108B on three files, 246B on three). That bump landed in
task 2's commit rather than a chore commit of its own, because task 1's
bytes are inside the same six ceilings.

| Task | Commit | Message |
| --- | --- | --- |
| 1 | a4e118da | docs(contracts): claim the shell channel for excerpt_search |
| 2 | 4a165b16 | docs(contracts): locate through excerpt_search before shell grep |

Verification: `node cadence-core/bin/self-verify.mjs` returns `ok: true` with
no problems, and `node cadence-core/bin/test.mjs` passes 3812 with 0 failures
and 1 skipped.
