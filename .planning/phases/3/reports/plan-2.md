PLAN COMPLETE
Plan: .planning/phases/3/PLAN-2.md
Tasks: 4 of 4
| Task | Commit | Note |
|---|---|---|
| 1: A document body is prose, not code | b3dbbac | `DOCUMENT_EXTS` + `isDocument` beside `SIGNAL_TABLE_FILES`; body skipped for `.md/.markdown/.mdx/.txt/.rst/.adoc`, path signals unchanged, `scanDiff` untouched. 3 new cases, 83 pass. Live `resolve --phase 2 --plan 3` now names `cadence-core/bin/git-guard.test.mjs`, not `METHOD.md`. |
| 2: A plan-time reason says what it actually read | c199846 | `signalIn` takes `contentPrefix`; declared face says `body line:`, `scanDiff` unmoved at `changed line:`, label bytes identical. 2 new cases (incl. an all-category vocabulary census), 85 pass. Live `resolve --phase 3` reason carries no "changed line". |
| 3: A scope that declared nothing proves nothing | 9129f8c | `undeclared[]` beside `found`/`clean`; joined `riskFloor`'s `read` predicate, one `risk floor:` warning per silent plan, its own withheld-`why` arm. UAT probe reproduced from the shipped template returns `shipped`. 5 + 5 new cases; `test.mjs routing` 407 pass. |
| 4: A declared body outside the repository is not evidence | 13343e6 | `declaredBodies` resolves both sides with `realpathSync` and refuses a path landing outside the root, after the regular-file arm so the device-link finding keeps its wording. 2 new cases; `test.mjs routing prose` 681 pass, `self-verify --root .` ok:true problems []. |

Deviations: none

Open items:
- The two `npx tsc -p tsconfig.ci.json` errors that were on the tree at dispatch (`route.mjs`: `Property 'unread' does not exist on type '{ path: string; body?: string; }'`, PLAN-1's incomplete `declaredBodies` `@returns`) are closed by task 4's docstring edit. Typecheck is clean at 13343e6.
- No `lint` command exists for this project (`detect-commands` answers `lint: null`); static analysis ran as `npx tsc -p tsconfig.ci.json`, clean before every commit.
- Declined a test for a symlinked parent that resolves INSIDE the repository (the boundary check's true arm reached through a link). Task 4's `Verify:` names the outside-link case and an ordinary nested path as its positive, and both are pinned; add the inside-link row if a task ever states that a link within the tree must stay readable.
- Task 1's rule is extension-keyed, so a documentation file with no extension or an unlisted one (`.org`, `.textile`) is still scanned as code. That is the stated safe direction - it fails toward raising - and the residual is PLAN-3's waiver key, not a wider extension list.
