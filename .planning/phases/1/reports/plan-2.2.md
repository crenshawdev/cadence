PLAN COMPLETE
Plan: .planning/phases/1/PLAN-2.md
Tasks: 6 of 6
| Task | Commit | Note |
|---|---|---|
| 1: The per-provider creation table, as data | 5bd196fa | CREATE_TABLE + splitSlug in lib/forge-decision.mjs, 7 new cases; `test.mjs other` 910 pass / 0 fail; tsc clean |
| 2: The create face runs the selected CLI, and refuses without a confirmation | f4bc26cc | `create` subcommand + CONTRACTS row (census 180 -> 183); `test.mjs git other` 1323 pass / 0 fail; self-verify ok:true; tsc clean |
| 3: The arms whose argv wires no remote wire origin themselves | d034e6fe | `--remote-url` (census 183 -> 184), refusal ahead of the create, `git remote add origin` after it; `test.mjs git other` 1328 pass / 0 fail; self-verify ok:true; tsc clean |
| 4: The confirmation, and the create arm in the fresh-directory entry point | 52783915 | new-project.md create arm, weight re-pinned 23587 -> 25900, DOCS-CLAIMS NEW-PROJECT-37 filed at run `-`; `test.mjs prose` 280 pass / 0 fail; self-verify ok:true |
| 5: Pin the confirmation ahead of the create, in prose | 3fcca554 | prose-agreement case on offsets plus a falsifier that moves the invocation above the question; `test.mjs prose` 282 pass / 0 fail |
| 6 (added, continuation): the tea create argv is shaped by who tea is logged in as | 3c7fe164 | `needsLogin` row flag + `ownerIsLoginUser`/`loginFlag`, `teaLoginFor` in the seam, AC6 and D-14 amended; `test.mjs` 3067 pass / 0 fail / 1 skipped; self-verify ok:true; tsc clean |

Task 6 detail, since it corrects a shipped defect the first live AC7 run exposed.

WHAT WAS WRONG. D-14's pinned `tea repos create --name <repo> --owner <owner>
--private` (restated as AC6) fails for a personal repository. Ground truth from
the orchestrator's live run on git.jcrenshaw.dev, tea 0.15.1, login user `john`:
`--owner john` exits 1 with `Error: GetOrgByName` - tea resolves `--owner` as an
ORGANIZATION - and the same create with no `--owner` exits 0, creating
`john/cadence-frg-smoke` under the login user. The argv-recording stub could not
catch it because a stub never reaches a server.

WHAT SHIPS. `CREATE_TABLE.forgejo` gains `needsLogin: true` and builds ONE OF
TWO argvs from a login record the seam resolves:
  owner IS the login user   `repos create --name <r> --login <l> --private`
  owner is NOT              `repos create --name <r> --owner <o> --login <l> --private`
`bin/forge.mjs` reads `tea login list --output json` on that arm alone, matches a
record to the host `--remote-url` already carries (via `loginNamesHost`, the
existing predicate, not a second spelling), and refuses BEFORE the create when
none serves it. Everything stays an execFileSync argv (D-03).

WHY `--login` IS IN THE ARGV, since it is a delta from the measured line. The
argv is built by asking ONE login whether the owner is its user; without
`--login`, tea then picks the default or the first in config file order, so the
question could be answered about one account and the create run as another.
Measured here: the user's single login prints `default` as the STRING `'false'`,
so "the default login" is not a value that can be relied on. `--login` is listed
in `tea repos create --help` on 0.15.1 and this repo already runs
`--login <name from tea's own list>` live on `tea issues` (HOST_TABLE's forgejo
row, shipped v3.5.1). With one login configured it names the login that already
answered, so the live re-run's argv is the measured one plus that flag.

D-16 / AC5 HELD. The login list is the one stdout this seam reads; it is parsed
into a decision and never carried out - not the login name, not its user, not
one byte - `detail` is null on every arm including the two new refusals, and
stderr is discarded at the spawn. A login `name` that is empty or opens on `-`
is SKIPPED rather than sanitized, so third-party bytes cannot read as a flag in
the argument vector; `loginFlag` in the pure module is the second door on that.

FALSIFIED BOTH WAYS, not just observed passing. With the builder reverted to the
always-`--owner` form: `forge-decision.test.mjs` reddens on
`the tea row DROPS --owner when the owner is the login user (the personal case)`
and `the tea row NAMES the login it was asked about`; `forge.test.mjs` reddens on
`create: a repository under the LOGIN USER is created with no --owner at all`,
which asserts the recorded argv through a spawned stub. Restored, all pass.
Full suite `node cadence-core/bin/test.mjs` 3067 pass / 0 fail / 1 skipped,
`node cadence-core/bin/self-verify.mjs` ok:true, `npx tsc -p tsconfig.ci.json`
clean.

Deviations:
[deviation] task 4's Verify says `grep -n "forge.mjs create" cadence-core/workflows/new-project.md` shows exactly one invocation. That string cannot appear in this tree: every seam invocation is written `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/forge.mjs" create`, with a closing quote between the filename and the subcommand - the same shape the existing `forge.mjs" detect` line at :74 uses and what self-verify's invocation check reads. Ran `grep -n 'forge.mjs" create'` instead: exactly one hit, at line 171, and its continuation line carries `--confirmed`. Task 5's case asserts on that same spelling.
[deviation] D-14 and AC6 pinned `tea repos create --name <repo> --owner <owner> --private` as THE tea argv. It is wrong for a personal repository: tea resolves `--owner` as an organization and the create exits 1 with `GetOrgByName` (measured live, tea 0.15.1). Shipped two argvs decided by whether the slug's owner is the authenticated login user, with `--login` naming the login that answered. AC6's wording updated to the argv actually shipped and D-14 annotated with the correction, both in `.planning/phases/1/CONTEXT.md`.
[deviation] the `--owner <org>` arm is NOT measured. Nothing here proves `--owner` succeeds when the owner genuinely IS an organization; it ships as the best reading of tea's own error (a flag that looks a name up as an org is a flag for an org) and is stated as unverified in `CREATE_TABLE`'s header rather than asserted. The first live create into an org confirms or refutes it.
[deviation] `lease-check --phase 1 --plan 2` returns `ok:false`, `undeclared-files`, naming exactly `.planning/phases/1/CONTEXT.md` - PLAN-2's `files:` list never declared it. The dispatch granted that path explicitly for this task and required the AC6/D-14 edits in the same atomic commit, so the commit went ahead with the gate's refusal recorded here rather than stopping. No other path is undeclared, and this is a sequential dispatch on the normal working tree, so no other plan's lease is touched.

Open items:
- declined refusing `--remote-url` when it is passed on the `gitlab` arm, whose row wires its own remote - the flag is simply unread there. Nothing in the plan's `Verify:` or `## Must be true when done` asks for that refusal, and the workflow prose is what states the flag is omitted on that arm; make it a refusal when a task states a caller can get it wrong.
- AC6's remote-add clause still reads "The `tea` arm is followed by a recorded `git remote add origin`", while the shipped `gh` arm wires one too - adjudicated in PLAN-2's Notes, which named AC6's argv authoritative over D-15's grouping. Left as written: this dispatch's CONTEXT grant was the tea argv and D-14, and that clause predates it.
- CONTEXT's flagged assumption "whether `tea repos create` can target a specific configured login when a user has two Forgejo instances logged in, and how it picks when not told" is now answered in the code - it does not have to pick, because `--login` names one - but the assumption line itself is left unedited, being outside this dispatch's CONTEXT grant.

AC7 (human-verify) is the orchestrator's to re-run against the live Forgejo. The
argv it will now record on the personal arm is `tea login list --output json`,
then `tea repos create --name <name> --login <login> --private`, then
`git -C <dir> remote add origin <url>`.
