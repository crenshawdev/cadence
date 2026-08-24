PLAN CHECKPOINT: human-verify
Plan: .planning/phases/1/PLAN-2.md
Tasks: 5 of 5
| Task | Commit | Note |
|---|---|---|
| 1: The per-provider creation table, as data | 5bd196fa | CREATE_TABLE + splitSlug in lib/forge-decision.mjs, 7 new cases; `test.mjs other` 910 pass / 0 fail; tsc clean |
| 2: The create face runs the selected CLI, and refuses without a confirmation | f4bc26cc | `create` subcommand + CONTRACTS row (census 180 -> 183); `test.mjs git other` 1323 pass / 0 fail; self-verify ok:true; tsc clean |
| 3: The arms whose argv wires no remote wire origin themselves | d034e6fe | `--remote-url` (census 183 -> 184), refusal ahead of the create, `git remote add origin` after it; `test.mjs git other` 1328 pass / 0 fail; self-verify ok:true; tsc clean |
| 4: The confirmation, and the create arm in the fresh-directory entry point | 52783915 | new-project.md create arm, weight re-pinned 23587 -> 25900, DOCS-CLAIMS NEW-PROJECT-37 filed at run `-`; `test.mjs prose` 280 pass / 0 fail; self-verify ok:true |
| 5: Pin the confirmation ahead of the create, in prose | 3fcca554 | prose-agreement case on offsets plus a falsifier that moves the invocation above the question; `test.mjs prose` 282 pass / 0 fail |

Full suite after task 5: `node cadence-core/bin/test.mjs` 3058 pass / 0 fail / 1 skipped. `node cadence-core/bin/self-verify.mjs` ok:true. `npx tsc -p tsconfig.ci.json` clean.

Deviations: [deviation] task 4's Verify says `grep -n "forge.mjs create" cadence-core/workflows/new-project.md` shows exactly one invocation. That string cannot appear in this tree: every seam invocation is written `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/forge.mjs" create`, with a closing quote between the filename and the subcommand - the same shape the existing `forge.mjs" detect` line at :74 uses and what self-verify's invocation check reads. Ran `grep -n 'forge.mjs" create'` instead: exactly one hit, at line 171, and its continuation line carries `--confirmed`. Task 5's case asserts on that same spelling.

Open items: declined refusing `--remote-url` when it is passed on the `gitlab` arm, whose row wires its own remote - the flag is simply unread there. Nothing in the plan's `Verify:` or `## Must be true when done` asks for that refusal, and the workflow prose is what states the flag is omitted on that arm; make it a refusal when a task states a caller can get it wrong.

HUMAN-VERIFY OUTSTANDING (AC7 / the plan's last `## Must be true when done` line): one real repository created end to end on Forgejo, with `origin` set and reachable afterward. Not attempted here - it is an outward-facing action against the user's live forge. Everything it needs is on disk: `forge.mjs create --provider forgejo --repo <owner/name> --confirmed --remote-url https://<host>/<owner>/<name>.git --dir <dir>`, or the fresh-directory path through `/cad-new-project`.
