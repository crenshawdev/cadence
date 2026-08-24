PLAN COMPLETE
Plan: .planning/phases/1/PLAN-2.md
Tasks: 7 of 7
| Task | Commit | Note |
|---|---|---|
| 1: The per-provider creation table, as data | 5bd196fa | CREATE_TABLE + splitSlug in lib/forge-decision.mjs, 7 new cases; `test.mjs other` 910 pass / 0 fail; tsc clean |
| 2: The create face runs the selected CLI, and refuses without a confirmation | f4bc26cc | `create` subcommand + CONTRACTS row (census 180 -> 183); `test.mjs git other` 1323 pass / 0 fail; self-verify ok:true; tsc clean |
| 3: The arms whose argv wires no remote wire origin themselves | d034e6fe | `--remote-url` (census 183 -> 184), refusal ahead of the create, `git remote add origin` after it; `test.mjs git other` 1328 pass / 0 fail; self-verify ok:true; tsc clean |
| 4: The confirmation, and the create arm in the fresh-directory entry point | 52783915 | new-project.md create arm, weight re-pinned 23587 -> 25900, DOCS-CLAIMS NEW-PROJECT-37 filed at run `-`; `test.mjs prose` 280 pass / 0 fail; self-verify ok:true |
| 5: Pin the confirmation ahead of the create, in prose | 3fcca554 | prose-agreement case on offsets plus a falsifier that moves the invocation above the question; `test.mjs prose` 282 pass / 0 fail |
| 6 (added, continuation): the tea create argv is shaped by who tea is logged in as | 3c7fe164 | `needsLogin` row flag + `ownerIsLoginUser`/`loginFlag`, `teaLoginFor` in the seam, AC6 and D-14 amended; `test.mjs` 3067 pass / 0 fail / 1 skipped; self-verify ok:true; tsc clean |
| 7 (added, continuation): the login is picked by host AND port | f70a0443 | `httpPort` carried through `splitOrigin`/`classifyOrigin`, port veto inside `loginNamesHost`, three new seam cases; `test.mjs` 3070 pass / 0 fail / 1 skipped; self-verify ok:true; tsc clean |

Rows 1-6 are carried forward from the previous run; that run's full record is
`.planning/phases/1/reports/plan-2.1.md` and `plan-2.2.md`.

Task 7 detail, since it closes the blocking `risk_surface` finding against
`bin/forge.mjs:405`.

WHAT WAS WRONG. `classifyOrigin` set `host` from `URL`-style hostname parsing,
which excludes the port by construction, and `loginNamesHost` compared that
bare hostname against a login's `name`, its API `url`'s hostname and its
`ssh_host`. The port was dropped on BOTH sides, so `tea` logins `prod-3000`
(`https://forge.example:3000`) and `prod-3001` (`https://forge.example:3001`)
were one instance: a create asked for `--remote-url
https://forge.example:3001/john/r.git` could resolve `prod-3000` by list order,
be pinned to it with `--login`, and create the repository on port 3000 while
the following `git remote add origin` used the port-3001 URL.

WHAT SHIPS. `splitOrigin` captures the scheme and the port through one shared
`AUTHORITY` pattern and a scoped `httpPortOf`; `classifyOrigin` reports it as a
new `httpPort` field beside `host`; `forge.mjs` passes `classified.httpPort`
into `teaLoginFor`, which hands it to `loginNamesHost`. The rule lives in
`loginNamesHost` and NOT in the seam, deliberately: that function's own header
states it is the ONE statement of how a tea login identifies its forge, and a
port-aware second spelling in the create arm is exactly the "two host rules that
can disagree" this codebase already refused once. Both callers therefore reach
it, and the justification is written into the function's header.

THE PORT IS A VETO, WHICH IS WHAT KEEPS THE OTHER CALLER BYTE-IDENTICAL. With
`httpPort` null - every `teaLoginNameForHost` call, since the persisted
`git.forge_host` is a host and states no port - the three-field equality runs
unchanged. With a port, a login is refused only when it names the SAME hostname
under a DIFFERENT http(s) port; it is otherwise judged exactly as before. Two
consequences the task named are held explicitly: the scheme's default IS the
port (`https://h` and `https://h:443` are one endpoint, asserted), and a URL
naming no port still matches a login naming none. An SSH port is carried as
null rather than compared, because a login record's only port is its API url's:
reading `ssh://git@ssh.example.com:2222` as a mismatch against that login's 443
would refuse the split-endpoint shape this repository itself has.

FALSIFIED, NOT JUST OBSERVED PASSING. With the veto line disabled,
`forge.test.mjs` reddens on `create: two logins on ONE hostname are told apart
by the PORT the url names` (at `3000 / reversed` - the loop asserts BOTH list
orders, and the wanted-login-happens-to-be-first combination passes without the
fix, which is why order is asserted both ways) and on `create: the scheme
default port is the SAME endpoint, never a mismatch`. Restored, all pass. Full
suite `node cadence-core/bin/test.mjs` 3070 pass / 0 fail / 1 skipped,
`node cadence-core/bin/self-verify.mjs` ok:true (`refusal-hints` included),
`npx tsc -p tsconfig.ci.json` clean. `detect-commands` reports `lint: null`, so
there is no lint command Cadence can find; typecheck is the static analysis
that ran.

THE FOUR PROPERTIES THE TASK REQUIRED KEPT. No forge-CLI stdout, stderr or
login byte reaches any envelope, reason or hint - the port never reaches an
envelope either, and the refusal reason still names only the host it already
named; `detail` is null on every forge arm (unchanged); creation and
`git remote add` are still `execFileSync` argv vectors from the seam; and no
value can arrive reading as a flag - the port is `\d+` from our own parse and is
compared, never passed, while the login-name `-` skip is untouched. No live
forge was contacted: every new case runs against argv-recording stubs.

Deviations:
[deviation] `lease-check --phase 1 --plan 2` returns `ok:false`,
`undeclared-files`, naming exactly `cadence-core/bin/lib/issue-decision.mjs`.
PLAN-2's `files:` list never declared it; PLAN-1's does. The dispatch directed
this fix at `loginNamesHost`, which lives in that file, and the mechanism cannot
be closed anywhere else: `classifyOrigin` is where the port is dropped, and
rebuilding a port in `forge.mjs` would give the seam the second URL grammar its
own comments forbid. PLAN-1 is complete and this phase's two plans are declared
sequential ("SEQUENTIAL after PLAN-1"), so no live independence proof is
invalidated; this is a sequential dispatch on the normal working tree. The
commit went ahead with the gate's refusal recorded here. The other two staged
paths are declared.

Open items:
- carried from the previous run, unchanged: the `gitlab` arm does not refuse a
  `--remote-url` it will not read; AC6's remote-add clause still names only the
  `tea` arm while the shipped `gh` arm wires one too; CONTEXT's flagged
  assumption about `tea` picking a login is answered in code but its line is
  unedited.
- the land-time path still cannot address a ported instance. `loginNamesHost`
  can now, but `teaLoginNameForHost` passes no port because the persisted
  `git.forge_host` is a host string with no stated port grammar - so a user on
  `forge.example:3001` has no way to say so in config, and a value typed with a
  `:3001` on it matches only a login literally NAMED that. That is a config-key
  grammar question (D-08's key), pre-existing, and outside this task.
- `--owner <org>` remains unmeasured against a real organization, as the
  previous run recorded.

AC7 (human-verify) is still the orchestrator's to run against the live Forgejo.
