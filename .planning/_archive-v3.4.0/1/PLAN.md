---
phase: 1
plan: 1
requirements:
  - LND-01
files:
  - cadence-core/config.schema.json
  - cadence-core/templates/config.json
  - cadence-core/references/config-catalog.md
  - cadence-core/references/config-reach.md
  - cadence-core/references/COMMANDS.md
  - cadence-core/bin/weight-budgets.json
  - cadence-core/bin/lib/issue-decision.mjs
  - cadence-core/bin/issue-decision.test.mjs
  - cadence-core/bin/issue-check.mjs
  - cadence-core/bin/issue-check.test.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/bin/test.mjs
  - skills/cad-land/SKILL.md
  - README.md
  - .planning/DOCS-CLAIMS.md
---

# Phase 1: The tracker enters the spine - Plan

## Goal

`/cad-land` step 1 names the issues this branch's commits reference and the ones
still open on the detected host, or says in one line why it could not.

## Must be true when done

- Landing a branch whose commits reference issue numbers prints, in step 1
  before any publish ask, a line naming each referenced number and whether it is
  open - "your branch references #42 and #47; #42 is still open".
- Landing a branch whose commits reference no issue prints the open issues on
  the detected host instead, as the fallback rather than the headline.
- Every path that cannot answer - no remote, unrecognized host, forge CLI
  absent, no `tea` login, a nonzero CLI exit, a CLI that never returns - prints
  exactly ONE line naming that reason, lists nothing, and the land continues.
- A forge CLI that never exits cannot delay the land past the seam's stated
  bound.
- `git.issue_check: false` makes step 1 say nothing about the tracker and spawn
  no forge CLI at all; `true` is the default and needs no configuration.
- Nothing on the new path writes to a tracker: landing closes no issue and asks
  about none.
- The report is about THIS repository and is complete or absent: the forge call
  is bound to the repo `--dir` names rather than to the process cwd, and a
  response the seam cannot read as complete degrades to its one line instead of
  reporting a referenced issue as not-found.
- `git.issue_check` is settable through `/cad-config` and named in the schema,
  the catalog, the reach table, `references/COMMANDS.md`, `README.md` and
  `.planning/DOCS-CLAIMS.md`, with `node cadence-core/bin/self-verify.mjs`
  clean.

## Context

No `phases/1/CONTEXT.md` exists; the binding decisions are ROADMAP.md's six
success criteria plus LND-01 in REQUIREMENTS.md. `glab` is NOT installed here
(`gh` and `tea` are, at `/usr/bin`), so the GitLab arm is proven by a
PATH-injected stub binary - the choice is recorded in Notes. Existing patterns
to follow: `lib/close-decision.mjs` and `lib/publish-decision.mjs` for the pure
total core, `land-cleanup.mjs` for the thin seam over it, and
`land-cleanup.test.mjs` for the temp-repo + env-injected harness. Out of scope:
any second config key, any write to a tracker, any change to `git.auto_close`'s
arms in step 3.

## Tasks

### Task 1: Register `git.issue_check` as a config key

- **Files:** cadence-core/config.schema.json, cadence-core/templates/config.json, cadence-core/references/config-catalog.md, cadence-core/references/config-reach.md, cadence-core/bin/weight-budgets.json
- **Action:** Add `git.issue_check` (`type` bool, `default` true) to the `keys`
  object of `config.schema.json`, positioned inside the existing `git.*` run
  beside `git.on_land_cleanup`, and add `"issue_check": true` to the `git` block
  of `templates/config.json`. Add a catalog row under the `**Git**` group of
  `references/config-catalog.md` in that file's stated
  `Key [src] | Type | Purpose (question) | Value → Explanation | Default`
  grammar, and a reach row under `## Reach rows` in `references/config-reach.md`
  following `git.on_land_cleanup`'s row exactly: reach `universal`, with
  `Honoured by` naming the seam task 3 adds. Do not invent a narrower reach
  phrase - `git.on_land_cleanup` is the precedent and its `purpose` scopes
  itself to the land, so a new phrase would add a row to config-reach.md's
  phrases-in-use list for no enforcement gain. The purpose and the catalog
  question must state a READ-ONLY report and must NOT reuse `git.auto_close`'s
  vocabulary - no "close", no "merge", no "unattended", no "auto": that key
  already means "merge the integration branch unattended" across
  `skills/cad-land/SKILL.md` step 3b, `land-cleanup.mjs` `gate` and
  `close-decision.mjs` `decideGateHalt`, and the confusion this key must not
  create is a user reading a tracker report as an authorization to merge. This
  is the ONLY new key in the phase; the call bound is a seam flag, not config
  (see Notes). Finally re-pin `cadence-core/references/config-catalog.md` and
  `cadence-core/templates/config.json` in `cadence-core/bin/weight-budgets.json`
  to their new byte counts.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `ok:true` - which
  means check 1 found the key named in prose, check 9 found its reach row, and
  the surface-budget check accepts both re-pinned counts. `node
  cadence-core/bin/config.mjs get git.issue_check` run against a repo whose
  `.planning/config.json` does not set it reports `true`.

### Task 2: The pure issue-decision core

- **Files:** cadence-core/bin/lib/issue-decision.mjs, cadence-core/bin/issue-decision.test.mjs
- **Action:** New zero-dep, pure, TOTAL module on the discipline
  `lib/close-decision.mjs` and `lib/publish-decision.mjs` state in their
  headers: node builtins only, no I/O, no `emit`, unknown or missing inputs
  never throw, `@ts-check` at the top because `tsconfig.ci.json` typechecks
  every non-test file. It holds one frozen per-host table and four exported
  functions. (1) A host classifier taking the `origin` URL text plus the hosts a
  `tea login list` output names, returning github, gitlab, forgejo, or an
  unrecognized/absent verdict; it must read both URL shapes cad-land already
  meets - `https://host/org/repo.git` and the scp-shaped `git@host:org/repo.git`
  - and classify by HOSTNAME, github and gitlab on the hostname and every other
  host only on a `tea` login for that exact host, which is the rule
  `skills/cad-land/SKILL.md` step 1 already states. A host `tea` could serve but
  holds NO login for is its own verdict, distinct from unrecognized: LND-01 and
  criterion 3 name "no login" as a degradation of its own, and a Forgejo origin
  with `tea` installed but unauthenticated must not report "unrecognized host".
  (2) A commit-message scanner
  taking `git log <base>..HEAD` text and returning the referenced numbers,
  deduplicated and ascending, over the three forms the requirement names - bare
  `#N`, `closes #N`, `fixes #N` - minting nothing out of a sha, a `#` inside a
  word, or a markdown heading. (3) A partition taking those numbers and the
  fetched issue records and answering open / closed / not-found per number,
  where not-found is its own answer and is NEVER rendered as closed, because the
  whole value of the check is that "#42 is still open" can be trusted. It may
  answer at all only over a fetch the normalizer reports COMPLETE and parseable;
  handed an incomplete or unreadable one it answers nothing and the caller
  degrades, because a truncated page and an empty tracker produce the same
  records and only one of them means "#42 does not exist". (4) A
  decision function returning `{action, reason}` - `action` one of `query` or
  `skip`, `reason` the ONE line the caller prints - with a distinct named reason
  for each of: the key off, no remote configured, an unrecognized host, a
  recognized host with no `tea` login, the resolved binary absent, a CLI call
  that exited nonzero, and a CLI that exited ZERO carrying a response the
  normalizer could not read as complete. Model that return on `decideGateHalt`'s `{action, ..., reason}`,
  which `/cad-land` already branches on by `action` alone. The table maps each
  host to its CLI binary name (`gh`, `glab`, `tea`), the byte-exact argv for ONE
  bounded call listing issues in EVERY state with number and state, and a
  normalizer turning that CLI's JSON into the `{number, state}` records the
  partition consumes - one call per land covering both facts, never one call per
  referenced number. That argv MUST defeat the CLI's own default page size:
  `gh`, `glab` and `tea` all cap a bare `issue list` at a few dozen rows, and
  this repo's own tracker holds over 170, so an unbounded call reports a
  referenced issue as not-found and returns a short open list while looking
  exactly like a small project. Name the paging flag per CLI from the same
  `--help` reading below, and have the normalizer report completeness - the
  row count against the limit asked for, or the CLI's own truncation signal -
  so a response cut off at the limit reaches the unreadable-response reason
  rather than the partition. The three CLIs' flag spellings and JSON field names are
  external facts: confirm `gh` and `tea` against their installed `--help` output
  before writing their rows and `glab` against its published documentation, and
  invent no flag.
- **Verify:** `node --test cadence-core/bin/issue-decision.test.mjs` passes,
  with cases covering both URL shapes for github / gitlab / a tea-login host /
  an unknown host / an absent origin; a fabricated multi-commit log carrying
  `#N`, `closes #N`, `fixes #N`, a duplicate and a sha-shaped near-miss; a
  partition where one referenced number is open, one closed and one absent from
  the fetched list, asserting the third answers not-found; a partition handed an
  INCOMPLETE fetch, asserting it answers nothing rather than not-found; a
  normalizer fed a response truncated at the limit and one with a renamed field,
  each reporting unreadable rather than an empty record set; every row's argv
  asserted to carry its paging flag; all seven reasons returned as distinct
  strings; and the gitlab row's argv and normalizer asserted against a captured
  sample of `glab`'s documented JSON output with no `glab` process spawned.

### Task 3: The `issue-check` seam, bounded and PATH-resolved

- **Files:** cadence-core/bin/issue-check.mjs, cadence-core/bin/issue-check.test.mjs, cadence-core/bin/self-verify.mjs, cadence-core/bin/test.mjs
- **Action:** New top-level seam with ONE subcommand `check`, built on
  `land-cleanup.mjs`'s mold: `@ts-check`, `'use strict'`, a thin I/O wrapper
  over task 2's core, one JSON line on stdout through `emit` from
  `lib/seam-io.mjs`, exit 0 always, and a header comment saying what it advises
  and why it is a separate file from `land-cleanup.mjs` - that one is advisory
  over git state, this one reads a THIRD-PARTY CLI, a different failure and
  freshness class. Flags: `--dir` (planning root, default cwd), `--base` (the
  base ref, resolved on absence exactly the way `land-cleanup.mjs cleanup`
  resolves it - `--base`, else `git.base_branch`, else the first entry
  `resolveProtectedBranches` returns) and `--timeout-ms`. Read config through
  `mergeLayers` and bind the `warnings[]` it returns onto the envelope, because
  self-verify check 12 walks every `mergeLayers(` callsite for exactly that;
  read flags through `optionalFlag` from `lib/seam-input.mjs` with the same
  one-line adapter binding the other bins use, never a second definition, which
  `helper-census.test.mjs` fails tree-wide. Live reads are
  `execFileSync('git', ['-C', dir, ...])` with an argv array and never a command
  string: the `origin` URL, and `git log <base>..HEAD` for the commit text.
  Forge-CLI resolution happens in ONE place - look the table's binary name up on
  `PATH` and treat absence as the core's cli-absent reason. The CLI call is
  bound to the SAME repository the git reads used, two ways together: `cwd: dir`
  on the spawn, and the explicit repo selector each CLI takes, `owner/name`
  parsed from the `origin` URL by task 2's classifier. Neither alone is enough -
  `gh` and `glab` infer the repo from the cwd remote, so a `--dir` pointing
  elsewhere silently reports another project's tracker, and `tea` does not infer
  at all: run outside a configured checkout it exits `Error: remote repository
  required: specify id via --repo` (observed in this repo, 2026-08-15). A PATH
  stub that ignores its cwd would let a cwd-only implementation pass, which is
  why the selector is asserted directly in the tests below. No Cadence env-var
  override and no `--cli-dir` flag: `review-provider.mjs:445-460` and EXP-01
  already refused a test-only env override honoured in production, and `PATH` is
  the OS's own lookup, so a test injects a stub without the product gaining a
  switch. Every subprocess - the `tea login list` probe and the single
  issue-list call - carries the `timeout` option and a kill signal the child
  cannot ignore; the default is a named constant in this file's header, 10000
  ms, overridable by `--timeout-ms`. Add the `issue-check.mjs` row to
  `self-verify.mjs`'s `CONTRACTS` table (`'*'` carrying `--dir`, `check`
  carrying `--base` and `--timeout-ms`), since check 14 fails a top-level bin
  with no row and check 2 silently skips one. Add the `issue-check` and
  `issue-decision` stems to `test.mjs`'s `git` group, the group for everything
  that touches a real repository.
- **Verify:** `node --test cadence-core/bin/issue-check.test.mjs` passes with,
  for each of github, gitlab and forgejo, a temp git repo whose `origin` names
  that host and whose branch carries commits referencing issues, plus a stub
  `gh` / `glab` / `tea` executable in a temp dir prepended to the child's `PATH`
  (`env: { ...process.env, PATH: stubDir + ':' + process.env.PATH }`, the
  harness style `land-cleanup.test.mjs` already uses for
  `CADENCE_GLOBAL_CONFIG`), asserting the emitted line carries each referenced
  number with its state and the open list; plus a run whose `--dir` names the
  temp repo while the process cwd is a DIFFERENT temp repo with its own origin,
  where the stub records the argv it received and the test asserts the repo
  selector names the `--dir` repo; plus a stub that sleeps forever,
  where `--timeout-ms 500` returns a one-line degraded envelope and the whole
  invocation completes in under 5 seconds. `node cadence-core/bin/self-verify.mjs`
  prints `ok:true` and `npx tsc -p tsconfig.ci.json` exits clean.

### Task 4: Wire the report into `/cad-land` step 1

- **Files:** skills/cad-land/SKILL.md, cadence-core/bin/weight-budgets.json
- **Action:** In step 1 of `<process>`, after the existing git-state report and
  the remote-host detection sentence, invoke the seam on its own physical line -
  `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/issue-check.mjs" check --dir <root> --base <base>`
  - and state what to do with each `action`. On the reporting action, print the
  referenced issues and their states as ONE sentence naming the numbers and
  which are still open, and print the open-issue list ONLY when no commit on the
  branch referenced one: the list is the fallback and never the headline,
  because a bare list is what the requirement says is easy to skim past. On the
  skip action, print the envelope's `reason` verbatim as ONE line and continue -
  never block, never retry, never ask, never list issues it did not read. State
  once, here, that landing closes no issue and that closing one stays an
  explicit ask at publish time. Keep it short: this is step 1 of the heaviest
  command in the plugin by eager bytes and `pre_ship` was deleted out of this
  skill for cost (CAPTURE.md, phase 2), so the addition is prose measured in a
  dozen lines with no `@`-include and no new reference file. It belongs in step
  1 above the step-3 arm split, not inside an arm: the publish-rails Read
  regression (CAPTURE.md, phase 2) sat under arm (b) where the default manual
  arm never reached it, and step 1 runs on both arms by construction. Then
  re-pin `skills/cad-land/SKILL.md` in `cadence-core/bin/weight-budgets.json`.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `ok:true` - check 2
  matches the new invocation against the CONTRACTS row task 3 added, check 1
  accepts `git.issue_check` in the prose, and the budget check accepts the
  re-pinned count. `grep -c 'issue-check.mjs' skills/cad-land/SKILL.md` returns
  1, and `grep -n 'issue-check.mjs\|3\. \*\*Publish' skills/cad-land/SKILL.md`
  shows the invocation's line number BELOW the `1. **Report git state`
  line and ABOVE the `3. **Publish` line.

### Task 5: Fault-inject every degradation path

- **Files:** cadence-core/bin/issue-check.test.mjs, cadence-core/bin/issue-check.mjs, cadence-core/bin/lib/issue-decision.mjs, cadence-core/bin/issue-decision.test.mjs
- **Action:** Prove what the caller sees on each degradation the requirement
  names, and fix the seam or the core wherever a path does not yet produce its
  own named reason: `git.issue_check: false` in the repo layer; a repo with no
  `origin` remote; an origin on a host that is neither github nor gitlab and
  that `tea login list` does not name; an origin on a host `tea` COULD serve
  where `tea login list` returns no login for it, which is its own reason and
  not the unrecognized one; the resolved binary absent from the injected `PATH`;
  a stub CLI exiting nonzero; a stub CLI exiting ZERO with output truncated at
  its page limit and one with a renamed field; and the ref-scan git read itself
  failing, which a `--base` naming a ref this repo does not have produces. The
  key-off case carries an assertion the others do not: the plan's own done
  condition says it spawns NO forge CLI, so every stub on the injected `PATH`
  appends its name to a marker file and that case asserts the marker does not
  exist - a test reading only the reason and the empty list also passes an
  implementation that probed `tea login list` before consulting the key. Each
  must emit `ok:true`, exit 0, and carry a distinct `reason`, so cad-land's
  one-line arm is what gets reached rather than an error path, and no degraded
  envelope may carry a non-empty issue list - the rule this tree already learned
  in GAT-01 and states in `decideGateHalt`'s JSDoc is that a seam never returns
  an affirmative answer about input it could not read. Route any CLI stderr that
  reaches a `detail` field through `redactUrl` from `lib/redact-url.mjs` rather
  than a new regex: that helper's header names the four existing sites and says
  a duplicated security regex is how the copies drift, and a fifth unredacted
  site would reopen EXP-01 on a forge CLI whose remote URL can carry a token.
- **Verify:** `node --test cadence-core/bin/issue-check.test.mjs
  cadence-core/bin/issue-decision.test.mjs` passes with one test per path above,
  each asserting exit status 0, `ok` true, a `reason` string unique across the
  matrix, and an empty issue array; the key-off case additionally asserting the
  spawn-marker file was never created; plus a stub whose stderr prints a remote URL
  carrying userinfo, whose envelope contains `<redacted>` and does not contain
  the token text.

### Task 6: Register the key and the check on the public surfaces

- **Files:** cadence-core/references/COMMANDS.md, README.md, .planning/DOCS-CLAIMS.md, cadence-core/bin/weight-budgets.json
- **Action:** Update the `/cad-land [base]` row in
  `cadence-core/references/COMMANDS.md` - the file `skills/cad-help`
  `@`-includes, and the whole of what `/cad-help` shows - so the tracker report
  AND `git.issue_check` as the switch that turns it off are both named in that
  row's description without growing it into a paragraph, since BUD-01 cut these
  surfaces to one routing line each. The key is not optional here: criterion 6
  names the `/cad-help` surface, `COMMANDS.md` is the whole of what `/cad-help`
  shows, and a row describing the report while naming no key leaves a reader
  unable to turn it off from the only place they were told to look. In `README.md`, extend the
  existing `/cad-land` sentence in `## The loop` and its `## The commands` entry
  so a reader learns the land reports the tracker and that `git.issue_check`
  turns it off, in the README's demands-not-labels voice rather than a feature
  bullet. Add rows to `.planning/DOCS-CLAIMS.md` under `## Claims added after
  run 1`, in that section's `| id | doc | line | claim | verdict | resolution |
  run |` grammar with ids continuing each doc's own ordinal - read `## Reading
  this ledger` and the section's own preamble first - one row per new factual
  claim: the COMMANDS row, each README sentence, the config-catalog row, and
  cad-land step 1's degrade-in-one-line and never-closes-an-issue statements. Do
  not fold any of them into run 1's 547 counts; the preamble states why. Then
  re-pin `cadence-core/references/COMMANDS.md` in
  `cadence-core/bin/weight-budgets.json`.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `ok:true` with
  README and COMMANDS.md both inside the linted surface set, and `node
  cadence-core/bin/test.mjs prose` passes. `grep -c issue_check README.md
  cadence-core/references/config-catalog.md .planning/DOCS-CLAIMS.md
  cadence-core/references/COMMANDS.md` reports at least 1 for each of the four,
  and `grep -n 'cad-land' cadence-core/references/COMMANDS.md` shows the row
  naming both the issue report and the key.

## Notes

- **GitLab arm, decided:** a PATH-injected stub binary named `glab`, placed in a
  temp dir prepended to the child process's `PATH` in `issue-check.test.mjs`.
  NOT an injected resolver and NOT a `--cli-dir` flag. The dispatch required this
  be stated: `glab` is absent at `/usr/bin` (`gh` and `tea` are present), and
  PATH injection exercises the real production resolver rather than a
  test-only branch beside it, while adding no Cadence-owned override of the kind
  EXP-01 refused.
- **The call bound is a flag, not a second config key.** ROADMAP criterion 5
  licenses exactly one new key, so the timeout ships as `--timeout-ms` over a
  named default constant in the seam header. Recalled prior art (CAPTURE.md):
  a hardcoded 120000 ms timeout was the tell of a live failure precisely because
  nothing could reach it; a flag over a named constant is reachable at the call
  site and directly testable, and the dev-symlink remedy that same line
  prescribed was rejected and is not reproposed here.
- **Step-1 siting is prior art, not preference.** CAPTURE.md phase 2 records the
  publish-rails Read landing under arm (b) of step 3, where the default manual
  arm never reached it. Step 1 runs before the arm split, which is why LND-01
  puts the check there and why task 4's Verify pins the line's position.
- **No CONTEXT.md for this phase**, and no `Plan shape` directive was given; one
  PLAN.md, six tasks, under the ceiling of 8. No deviation to record.
- **Adjudicated `plan` review, 2026-08-15** (openai `gpt-5.6-sol` @ high): 7
  raised, 5 survived adjudication and all five were applied above - the paging
  bound and the unreadable-response reason (task 2), the repo binding on the
  forge call (task 3), the no-login reason (tasks 2 and 5), the key-off
  no-spawn assertion (task 5), and `git.issue_check` in the `/cad-help` surface
  (task 6). Killed: a task-ordering finding arguing tasks 4 and 5 leave the tree
  broken between commits, which holds only if task 3 already shipped a bug it is
  responsible for not shipping.
- **Not automatable, for the verify walk:** a live `/cad-land` run in this repo
  (Forgejo origin with a `tea` login present) is the only way to observe the
  step-1 line in situ. The executor cannot invoke a slash command, so that
  observation belongs to `/cad-verify`'s UAT walk, and every task above is
  verified by a command the executor can run.
