---
phase: 1
plan: 2
requirements: [FRG-01, FRG-02]
files:
  - cadence-core/bin/lib/forge-decision.mjs
  - cadence-core/bin/forge.mjs
  - cadence-core/bin/forge-decision.test.mjs
  - cadence-core/bin/forge.test.mjs
  - cadence-core/bin/lib/arg-contract.mjs
  - cadence-core/bin/arg-contract.test.mjs
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/workflows/new-project.md
  - cadence-core/bin/weight-budgets.json
  - .planning/DOCS-CLAIMS.md
---

# Phase 1: Pick a forge - Plan 2

## Goal

The repository the user named is created through the CLI they selected, as a
recorded argv rather than composed shell prose, private on every provider, and
never without an explicit confirmation naming what is about to be created.

## Must be true when done

- Creating a repository runs exactly one argv per provider - `gh repo create
  <owner>/<repo> --private`, `glab repo create <owner>/<repo> --private
  --remoteName origin`, `tea repos create --name <repo> --owner <owner>
  --private` - and each is asserted against a stub that records what it was
  called with.
- No creation argv is ever recorded without a prior confirmation naming the
  provider, the owner, the repository name and that it will be PRIVATE; the
  user is never asked to choose visibility.
- The arms whose pinned argv wires no remote - Forgejo and GitHub - wire
  `origin` themselves with a recorded `git remote add origin` after the create.
  The GitLab arm runs no such command, because `--remoteName origin` is already
  in its argv.
- A create on one of those two arms that has been given nowhere for `origin` to
  point refuses BEFORE the repository is created, so no run leaves a created
  repository with no remote.
- No forge-CLI stdout or stderr reaches the envelope on any create arm, `detail`
  is null on every one of them, and every `ok:false` carries a hint.
- (human-verify) One real repository is created end to end on Forgejo, with
  `origin` set and reachable afterward.

## Context

SEQUENTIAL after PLAN-1: this plan extends `bin/forge.mjs`,
`lib/forge-decision.mjs`, the `CONTRACTS` row, `workflows/new-project.md` and
`bin/prose-agreement.test.mjs` that plan 1 creates or amends, so the two share
declared files and must not run concurrently.

CONTEXT.md locks this plan: creation is an `execFileSync` argv from a seam and
never raw Bash the coordinator composes, because the argv-recording stub only
reaches a spawned child and `git-guard.mjs` guards only `git push` and `git
commit` (D-03); visibility is pinned PRIVATE on every provider, stated in the
confirmation, never asked, because `gh` drops to an interactive prompt without
an explicit visibility flag and would hang inside a Bash tool call (D-04); each
provider needs its own argv row, the way `HOST_TABLE` already carries one
(D-14); `tea` wires no git remote, so the Forgejo arm needs an explicit `git
remote add origin` (D-15) - and read against AC6's pinned argvs the GitHub arm
is in exactly that position too, because `gh repo create <owner>/<repo>
--private` carries no `--source`, while `glab`'s `--remoteName origin` does wire
one, so D-15's grouping of `gh` with `glab` holds for `glab` only; the Notes
state which of the two the tasks follow and why; the seam never prompts (D-12); every `ok:false` carries a hint and no third-party bytes reach
the envelope (D-16).

## Tasks

### Task 1: The per-provider creation table, as data

- **Files:** cadence-core/bin/lib/forge-decision.mjs, cadence-core/bin/forge-decision.test.mjs
- **Action:** Add a frozen create table to `lib/forge-decision.mjs`, one row per
  provider beside the provider-to-binary table plan 1 put there, in the shape
  `HOST_TABLE` in `lib/issue-decision.mjs` already uses: each row carries an
  `argv` builder taking the owner and the repository name, and a stated flag
  saying whether that provider wires the git remote itself. The three argvs are
  fixed and are the whole point of the row - `gh` takes `repo create
  <owner>/<repo> --private`, `glab` takes `repo create <owner>/<repo> --private
  --remoteName origin`, `tea` takes `repos create --name <repo> --owner <owner>
  --private` - three different grammars for one operation, measured on gh 2.98.0,
  glab 1.114.0 and tea 0.15.1. Every row is `--private` and no row takes a
  visibility parameter: the value is pinned, not defaulted, because `gh` with no
  visibility flag drops to an interactive prompt that would hang a Bash tool
  call, `glab` silently defaults to `internal`, and three different defaults are
  not a choice worth asking for (D-04). The wires-the-remote flag is read off
  the argv the row actually carries, never off a provider's reputation: the
  `glab` row DOES wire its own remote, because `--remoteName origin` sits in its
  argv and `glab repo create --help` calls that flag "Remote name for the Git
  repository you're in"; the `tea` row wires none, for the reason D-15 states;
  and the `gh` row wires none either, because AC6's pinned argv carries no
  `--source` and `gh repo create --help` scopes `-r, --remote` to a create made
  FROM a local source directory. Flagging `gh` as wiring one because D-15's
  sentence groups it with `glab` would ship a row that contradicts the argv
  printed beside it - the Notes record which of AC6 and D-15 this plan treats as
  authoritative there. The follow-up that acts on the flag is task 3, not this
  one. Keep the module PURE - no fs, no subprocess, no `emit` - and add the
  owner/name splitter the argv builders need beside the slug grammar plan 1
  already put here, so one predicate decides what a repository reference may be.
- **Verify:** `node cadence-core/bin/test.mjs other` passes, including a case per
  provider asserting the produced argv array element for element against the
  three strings above, a case asserting every row's argv contains `--private` so
  a fourth provider cannot be added without a visibility pin, and a case
  asserting that the row flagged as wiring its own remote is exactly `glab` and
  that its argv is the one carrying `--remoteName` - so the flag cannot drift
  from the argv it describes.

### Task 2: The create face runs the selected CLI, and refuses without a confirmation

- **Files:** cadence-core/bin/forge.mjs, cadence-core/bin/lib/arg-contract.mjs, cadence-core/bin/arg-contract.test.mjs, cadence-core/bin/forge.test.mjs
- **Action:** Add a `create` subcommand to `bin/forge.mjs` taking `--provider`,
  `--repo` and `--confirmed` alongside the `'*'` row's `--dir`. Declare the new
  flags in the `'forge.mjs'` `CONTRACTS` row in `lib/arg-contract.mjs`, keeping
  `detect` as the FIRST non-`'*'` key so the adoption census keeps exercising
  the script-global `--dir` through the face that spawns nothing: `--provider`
  and `--repo` are `string`, required, `refuse` on both axes; `--confirmed` is
  `boolean` and `fallback` on both axes, because a boolean row's whole grammar
  is presence and neither disposition can fire on it - which is exactly why the
  seam keeps its own term for it, the way `issue-check.mjs` keeps positivity for
  `--timeout-ms` outside the shared `int` type. Bump the flag-entry census
  assertion in `arg-contract.test.mjs` to the value the walk now reports. In the
  seam, refuse BEFORE any spawn, each refusal `ok:false` with `detail: null` and
  a hint (D-16): no `--confirmed`, with a hint naming the confirmation the
  caller owes; a `--provider` outside the create table; a `--repo` that fails
  the owner/name grammar; and a provider whose binary does not resolve through
  `onPath`, with a hint naming that install. Then run the row's argv through
  `execFileSync` with `cwd` set to `--dir` and the child's stderr discarded at
  the spawn, the way `run` in `issue-check.mjs` does - never as shell prose the
  coordinator composes, because the argv-recording stub only reaches a spawned
  child and a raw Bash `gh repo create` would pass the git hook unseen (D-03).
  A nonzero exit is `ok:false` with a reason naming the provider and the
  operation, `detail: null`, and a hint - the child's own text never reaches the
  envelope, and the reason already says what failed. On success emit `ok:true`
  naming the provider, the owner, the repository and that it was created
  private.
- **Verify:** `node cadence-core/bin/test.mjs git other` passes, including cases
  proving: `forge.mjs create --provider github --repo o/r --confirmed --dir <d>`
  against a `gh` stub records exactly `repo create o/r --private` in
  `$CAD_ARGV_LOG`; the same call WITHOUT `--confirmed` prints `ok:false` with a
  non-empty hint and leaves `$CAD_ARGV_LOG` absent or empty; a stub exiting
  nonzero with text on stderr yields `ok:false` whose serialized envelope
  contains none of that text and whose `detail` is null; and a provider whose
  stub is absent from the PATH directory refuses naming the install. `node
  cadence-core/bin/self-verify.mjs` prints `ok:true` (no `hintless-refusal`, no
  `unknown-flag` against the new row).

### Task 3: The arms whose argv wires no remote wire origin themselves

- **Files:** cadence-core/bin/forge.mjs, cadence-core/bin/lib/forge-decision.mjs, cadence-core/bin/forge.test.mjs, cadence-core/bin/lib/arg-contract.mjs, cadence-core/bin/arg-contract.test.mjs
- **Action:** Act on the create table's wires-no-remote flag. Add a
  `--remote-url` flag to the `create` row in `CONTRACTS` - `string`, not
  required, `refuse` on both axes, because a valueless one would otherwise point
  `origin` at nothing - and bump the flag-entry census assertion again. When the
  selected provider's row says it wires no remote, the seam requires
  `--remote-url` and refuses without it BEFORE the create argv runs, with a hint
  naming the flag: the refusal has to precede the spawn, because refusing
  afterwards would leave a real repository created on the instance with no way
  to reach it, and the seam is given no host of its own to rebuild the URL from
  - `create` takes its inputs as flags and reads no config, so the URL is the
  caller's to supply and the seam's to validate (D-12). Under the task 1 table
  that is `tea` AND `gh`; `glab` is the row that wires its own. Validate the
  value through `classifyOrigin` from `lib/issue-decision.mjs`, refusing what it
  cannot parse into a host and a slug, so one grammar decides what a remote URL
  may be here and at setup. After a successful create on such a provider, run
  `git remote add origin <the validated url>` through the same bounded
  `execFileSync` path, with `cwd` set to `--dir` and stderr discarded, and report
  the remote as wired on the success envelope; a failure of that second call is
  `ok:false` with `detail: null`, a hint, and a reason saying the repository was
  created but the remote was not wired, because a caller that reads "created"
  and finds no origin has been told the wrong thing. Providers whose row wires
  its own remote run no `git` command at all. Task 2's `github` create cases were
  written before this flag existed and now need `--remote-url` to reach a spawn
  at all; update them rather than leaving a red suite, and keep the
  without-`--confirmed` case as it is, since that refusal still precedes this
  one.
- **Verify:** `node cadence-core/bin/test.mjs git other` passes, including cases
  proving: a `tea` create with `--remote-url` records `repos create --name r
  --owner o --private` and then `remote add origin <url>` in `$CAD_ARGV_LOG`
  against `tea` and `git` stubs, in that order; a `gh` create with
  `--remote-url` records `repo create o/r --private` and then `remote add origin
  <url>`, in that order, because its pinned argv wires nothing; either call
  without `--remote-url` prints `ok:false` with a hint naming the flag and
  leaves `$CAD_ARGV_LOG` absent or empty, so nothing was created; and a `glab`
  create, which is not asked for the flag, records `repo create o/r --private
  --remoteName origin` and no `git` line at all. `node cadence-core/bin/self-verify.mjs`
  prints `ok:true`.

### Task 4: The confirmation, and the create arm in the fresh-directory entry point

- **Files:** cadence-core/workflows/new-project.md, cadence-core/bin/weight-budgets.json, .planning/DOCS-CLAIMS.md
- **Action:** Extend the forge step plan 1 put in `new-project.md`'s `setup` with
  the creation arm, in `new-project.md` ONLY - `/cad-adopt` runs against a
  repository that already exists, and AC6 scopes creation to the path that does
  not have one. After the provider and repository answers are persisted, and
  only when there is no `origin` to point at, offer creation through the
  ask-user seam as a plain confirm whose text names the provider, the owner, the
  repository name and that it will be created PRIVATE - four facts in the
  question itself, because that sentence is the confirmation AC6 requires and
  nothing else in the run states them together. A plain confirm carries no
  `(recommended)` label per `references/seams.md`. Only on the affirmative
  answer, invoke `forge.mjs create` with `--provider`, `--repo`, `--confirmed`
  and, on the two providers whose row wires no remote, `--remote-url`: on
  Forgejo the URL is built from the `git.forge_host` plan 1 has just persisted
  and confirmed with the user plus the answered slug, and on GitHub from the
  fixed `github.com` plus the same slug, so neither is a fourth question and
  neither host is guessed. The GitLab arm passes no `--remote-url`. State in the
  prose that `--confirmed` is what the user's answer buys and is never passed
  ahead of it. Say plainly that visibility is not a
  question: every repository Cadence creates is private (D-04). On an `ok:false`
  create, print the envelope's `reason` and `hint` and stop the forge step
  rather than continuing as though a repository exists. Add a
  `.planning/DOCS-CLAIMS.md` row for the new claim this prose makes - that
  creation is private on every provider and never runs without the confirmation
  - and re-pin `cadence-core/bin/weight-budgets.json` for
  `cadence-core/workflows/new-project.md` from `node cadence-core/bin/weight.mjs`.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `ok:true`, which
  proves the new invocation's flags match the declared `CONTRACTS` row and that
  `new-project.md` is inside its re-pinned budget; `node
  cadence-core/bin/test.mjs prose` passes; and `grep -n "forge.mjs create"
  cadence-core/workflows/new-project.md` shows exactly one invocation, carrying
  `--confirmed`.

### Task 5: Pin the confirmation ahead of the create, in prose

- **Files:** cadence-core/bin/prose-agreement.test.mjs
- **Action:** Add a case to `prose-agreement.test.mjs` asserting the ordering
  AC6 requires, in the shape the file's existing `cad-land 3(b): the GitLab arm
  consults the authorization seam BEFORE it creates` case uses: read
  `cadence-core/workflows/new-project.md` and assert that the confirmation
  naming provider, owner, repository and private visibility appears at an
  earlier offset than the single `forge.mjs create` invocation, and that the
  invocation carries `--confirmed`. This is the half the seam's own gate cannot
  hold: `--confirmed` proves a caller passed a flag, and only the prose can say
  the flag follows a question the user actually answered. Assert the ordering by
  offsets in the file's own text, never by a line number, so an inserted
  paragraph does not redden it.
- **Verify:** `node cadence-core/bin/test.mjs prose` passes, and re-running it
  after moving the `forge.mjs create` invocation above the confirmation in a
  scratch copy of the workflow fails with a message naming the ordering.

## Notes

- Human-required, AC7: creating one real repository end to end on Forgejo needs
  a live forge account and a logged-in `tea`, which no task in this plan can
  supply. After the plan lands, run the fresh-directory path against a real
  Forgejo instance and confirm the repository exists, is private, and that
  `git remote -v` in the new directory names it. That is a `/cad-verify` UAT
  item, not a task here.
- `--remote-url` is the planner's choice and CONTEXT names no source for it. It
  stays a flag rather than something the seam looks up, because `create` reads
  no config at all and `tea repos create`'s pinned argv carries no `--output
  json` to read a clone URL back from - reading the child's stdout for one would
  sit against D-16. What the caller builds it from is now settled rather than
  typed: D-08 as amended persists the Forgejo instance host the user confirmed,
  and `github.com` is fixed, so the workflow composes the URL from a host it
  already holds and the seam validates it through `classifyOrigin`.
- WHICH SOURCE IS AUTHORITATIVE FOR THE `gh` ROW, since AC6 and D-15 disagree
  there: AC6. Its pinned argv - `gh repo create <owner>/<repo> --private` - is a
  measured recording, and `gh repo create --help` confirms that `-r, --remote`
  only applies to a create made from a local `--source`, so that argv wires no
  `origin` and the GitHub arm needs the explicit `git remote add origin` exactly
  as Forgejo does. D-15's clause is right about `glab`, whose `--remoteName
  origin` does wire one, and wrong about `gh` only in grouping the two. Nothing
  here is papered over: if the intent was for `gh` to wire the remote through a
  flag, then AC6's argv is what needs amending - to `gh repo create
  <owner>/<repo> --private --source . --remote origin`, which additionally
  requires a local git repository to exist at `--dir` before the create, a
  precondition the fresh-directory path does not state today. That is a CONTEXT
  amendment and a re-cut of tasks 1, 3 and 4, not something these tasks can
  decide.
