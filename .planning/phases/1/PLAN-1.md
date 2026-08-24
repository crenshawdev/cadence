---
phase: 1
plan: 1
requirements: [FRG-01, FRG-02]
files:
  - cadence-core/config.schema.json
  - cadence-core/templates/config.json
  - cadence-core/references/config-reach.md
  - cadence-core/references/config-catalog.md
  - cadence-core/bin/weight-budgets.json
  - cadence-core/bin/lib/forge-decision.mjs
  - cadence-core/bin/forge.mjs
  - cadence-core/bin/forge-decision.test.mjs
  - cadence-core/bin/forge.test.mjs
  - cadence-core/bin/lib/arg-contract.mjs
  - cadence-core/bin/arg-contract.test.mjs
  - cadence-core/bin/config.test.mjs
  - cadence-core/bin/self-verify.test.mjs
  - cadence-core/bin/issue-check.mjs
  - cadence-core/bin/lib/issue-decision.mjs
  - cadence-core/bin/issue-check.test.mjs
  - cadence-core/bin/issue-decision.test.mjs
  - cadence-core/bin/prose-agreement.test.mjs
  - cadence-core/workflows/new-project.md
  - cadence-core/workflows/adopt.md
  - README.md
  - docs/EXAMPLE.md
  - .planning/DOCS-CLAIMS.md
---

# Phase 1: Pick a forge - Plan 1

## Goal

Cadence resolves a forge and an issue tracker when it sets a project up, new or
adopted: it detects which forge CLIs are installed, asks the user which provider
to use and what the repository is called, and persists that choice so every
later forge call reads the config rather than re-deriving a host from `origin`.

## Must be true when done

- On a machine where `tea`, `gh` and `glab` all resolve, the setup step names
  all three and the user picks one; where none resolve the step refuses with a
  reason naming what was looked for and a hint naming an install, carrying no
  forge-CLI output and a null `detail`.
- Where providers ARE offered and the user picks none of them, the step refuses
  the same way - a reason naming what was looked for and a hint naming how to
  set the provider later - and persists nothing.
- `/cad-new-project` on a fresh directory and `/cad-adopt` on an existing
  repository each reach the forge question, and a repository whose persisted
  forge record is complete - `git.forge_provider` and `git.forge_repo`, plus
  `git.forge_host` when the provider is `forgejo` - is asked nothing.
- The answers land in `.planning/config.json` through the existing
  `config.mjs set`; a `git.forge_repo` aimed at the user-global layer is refused
  at write time, while `git.forge_provider` and `git.forge_host` are accepted at
  either layer.
- Where `origin` resolves, the repository slug is offered as a default the user
  confirms rather than retypes; where the host is neither `github.com` nor
  `gitlab.com`, no provider is guessed, and the Forgejo instance host is asked
  outright rather than read off the origin URL.
- With the keys set and `origin` deleted, `/cad-land`'s tracker report resolves
  the persisted provider and repository instead of reporting that there is no
  remote, and on Forgejo it NAMES its login from the persisted host rather than
  asking `tea` to discover one from a remote that is gone.
- README's prerequisites name a forge CLI, because a forge is now a
  precondition rather than an option.

## Context

CONTEXT.md locks this plan: config is authoritative and `classifyOrigin` is
demoted to a setup-time default (D-01); the slug key is `repo_only` and the
provider key is not (D-02); "installed" means `onPath` and nothing else (D-06);
the persisted record is provider plus slug, and on Forgejo a third key carrying
the instance host, ASKED at setup and never derived from the origin URL (D-08);
persistence is the existing `config.mjs set`, no new writer seam (D-09); the
keys ship at
explicit `null` (D-10); the keys drag reach, catalog, prose-token and weight
surfaces with them (D-11); the seam never prompts (D-12); the step folds into
the existing single-Bash setup chain in both entry points (D-13); every
`ok:false` carries a hint and no third-party bytes reach the envelope (D-16);
a new bin script declares a `CONTRACTS` row (D-17).

Repository CREATION is plan 2 and is out of scope here. Issue WRITING is phase
2. This plan never runs an auth command and never probes whether a resolved
binary is authenticated.

## Tasks

### Task 1: Add the three forge config keys and every surface they drag

- **Files:** cadence-core/config.schema.json, cadence-core/templates/config.json, cadence-core/references/config-reach.md, cadence-core/references/config-catalog.md, cadence-core/bin/weight-budgets.json
- **Action:** Add `git.forge_provider`, `git.forge_repo` and `git.forge_host` to
  the `keys` object of `config.schema.json`, in the `git.` block beside
  `git.issue_check`.
  `git.forge_provider` is `type: "enum"` over `["forgejo", "github", "gitlab",
  null]` defaulting to `null`, with NO `repo_only` marker - a provider
  preference carries no authorization over a repository that never opted in, so
  it is settable at either layer (D-02). `git.forge_repo` is `type:
  "string_or_null"` defaulting to `null` and carrying `"repo_only": true`,
  because a user-global slug would point every repository's forge calls at one
  target, which is exactly the test `_meta.note` states for that marker.
  `git.forge_host` is `type: "string_or_null"` defaulting to `null` with NO
  `repo_only` marker, for the same reason the provider carries none: it names
  which Forgejo instance the user works with, which is a preference, and it
  authorizes nothing on a repository that never named ITSELF - binding a call to
  a repository is the slug's job and the slug stays `repo_only`. Its `purpose`
  says it is the Forgejo instance host the user confirmed at setup, that it is
  null on `github` and `gitlab` whose hosts are fixed, and that it is never
  derived from the origin URL - on a split SSH endpoint the origin's host is the
  SSH hostname and not the instance (D-08). The enum spelling is the vocabulary
  `HOST_TABLE` in
  `cadence-core/bin/lib/issue-decision.mjs` already uses for its rows
  (`github`, `gitlab`, `forgejo`) - do not invent a second spelling, because the
  next task resolves a `HOST_TABLE` row from this value. Each `purpose` states
  that the record is resolved once at project setup and read at land time in
  place of any host detection, and `null` means unasked. Add all three keys to
  the `git` object of `cadence-core/templates/config.json` at explicit `null`
  (D-10), so a
  scaffolded repository is visibly unasked and the re-entry check in task 4 has
  something to read. Add one `## Reach rows` row per key to
  `references/config-reach.md` naming `bin/forge.mjs` and `bin/issue-check.mjs`
  as the readers; if you judge the reach narrower than `universal`, the key's
  own `purpose` must carry that same phrase verbatim, which is what check 9
  compares. Add one row per key to the **Git** section of
  `references/config-catalog.md`, with the `[repo-layer-only]` marker on
  `git.forge_repo` and none on `git.forge_provider` or `git.forge_host`,
  matching that file's existing legend. The catalog rows are also what keeps check 1b quiet: the
  reach table is excluded from the prose-token scan by construction, so a key
  named ONLY there is still reported `inert-config-key`. Re-pin
  `cadence-core/bin/weight-budgets.json` for `cadence-core/templates/config.json`,
  `cadence-core/references/config-catalog.md` and
  `cadence-core/references/config-reach.md` from `node cadence-core/bin/weight.mjs`.
- **Verify:** `node cadence-core/bin/config.mjs validate --file cadence-core/templates/config.json`
  prints `ok:true` with `errors: []`; `node cadence-core/bin/config.mjs check --global git.forge_repo=owner/name`
  reports an error naming the repository's own config layer while
  `node cadence-core/bin/config.mjs check --global git.forge_provider=forgejo`
  and `node cadence-core/bin/config.mjs check --global git.forge_host=git.example.com`
  each report none; `node cadence-core/bin/self-verify.mjs` prints `ok:true` with an
  empty `problems` (no `inert-config-key`, no `unknown-reach-key`, no budget
  overage); `node cadence-core/bin/test.mjs routing prose` passes.

### Task 2: A forge seam that answers what setup should do

- **Files:** cadence-core/bin/lib/forge-decision.mjs, cadence-core/bin/forge.mjs, cadence-core/bin/forge-decision.test.mjs, cadence-core/bin/forge.test.mjs, cadence-core/bin/lib/arg-contract.mjs, cadence-core/bin/arg-contract.test.mjs
- **Action:** Write `cadence-core/bin/lib/forge-decision.mjs` as a PURE module in
  the shape of `lib/issue-decision.mjs`: no fs, no subprocess, no `emit`, no
  `process`. It owns a frozen provider table mapping each provider name to its
  binary (`forgejo` to `tea`, `github` to `gh`, `gitlab` to `glab`) in that
  fixed order so the seam's output is deterministic, and one decision function
  that folds the persisted pair and the installed list into a single `action`,
  the way `decideIssueCheck` folds its inputs into `query | skip | off`. Three
  actions and nothing else: `configured` when the persisted record is COMPLETE -
  provider and slug both non-null, and on a `forgejo` provider the instance host
  non-null as well, because a Forgejo row that cannot name its instance is not
  configured (D-08) - `ask` when at least one binary resolved, and `refuse` when
  none did.
  The persisted pair is consulted FIRST, so an already-configured repository is
  never refused for a missing binary it does not need at setup time (AC2 against
  AC5). Write `cadence-core/bin/forge.mjs` as the seam over it, with one
  subcommand `detect [--dir <path>]` printing one JSON line through
  `lib/seam-io.mjs`'s `emit`. Resolve installed binaries through
  `onPath` from `lib/on-path.mjs` and nothing else - no `--version` call, no
  login probe, no auth check (D-06), and that module reads no Cadence
  environment override, which is what makes a PATH-injected stub exercise the
  production resolver. Read the persisted pair through `mergeLayers` on
  `<dir>/.planning/config.json` and BIND `warnings` in the destructuring, which
  is arm (a) of the `undocumented-merge-warnings` check; put that array on every
  envelope. The `ok:true` arms carry `action`, `installed` (one entry per
  resolved provider carrying its provider name and its binary name),
  `provider`, `repo`, `host` and `detail: null` - the three persisted values
  ride the `ask` arm too, so the setup step can ask only what is still null
  rather than re-asking a partly answered record. The `refuse` arm is the only `ok:false`
  one: `installed: []`, `detail: null`, a reason naming the three binaries that
  were looked for, and a hint naming an install (D-16, AC5). Declare a
  `'forge.mjs'` row in `CONTRACTS` in `lib/arg-contract.mjs` with `--dir` on the
  `'*'` row spelled exactly as `issue-check.mjs`'s is - `string`, `refuse` on
  both axes - and an empty `detect` row; state no flag rule of its own in
  `forge.mjs` (D-17), reading the flag through `requireFlag` and rendering the
  raised refusal in the `e.seam` catch arm the sibling seams use. Bump the two
  census assertions in `arg-contract.test.mjs` (the flag-entry total and the
  one-row-per-top-level-bin-script count) to the values the walk now reports.
  Cover the pure module in `forge-decision.test.mjs` and the seam in
  `forge.test.mjs`; the seam file gets its stub-on-PATH harness by importing the
  exported `stub` from `issue-check.test.mjs`, which is exported for exactly
  this reuse and registers no tests when imported.
- **Verify:** `node cadence-core/bin/test.mjs git other` passes, including new
  cases proving: with a temp directory holding executable `gh` and `tea` stubs
  prepended to the child's PATH, `forge.mjs detect --dir <repo>` prints
  `action: "ask"` and an `installed` list naming exactly those two; with a stub
  directory holding none of the three, it prints `ok:false` with a non-empty
  `hint` and `installed: []`; with `.planning/config.json` carrying
  `git.forge_provider=github` and `git.forge_repo` non-null it prints
  `action: "configured"` and those values even when no binary resolves; with
  `git.forge_provider=forgejo` and a slug but a null `git.forge_host` it prints
  `action: "ask"` still carrying the persisted provider and repo, so only the
  missing instance host is outstanding; and in every one of those cases the file named by
  `$CAD_SPAWN_MARKER` is absent or empty, so no forge CLI was spawned (AC1).
  `node cadence-core/bin/self-verify.mjs` prints `ok:true` (no
  `uncontracted-script`, no `hintless-refusal`, no
  `undocumented-merge-warnings`).

### Task 3: Offer the origin-derived defaults the user confirms

- **Files:** cadence-core/bin/lib/forge-decision.mjs, cadence-core/bin/forge.mjs, cadence-core/bin/forge-decision.test.mjs, cadence-core/bin/forge.test.mjs
- **Action:** On the `ask` action only, `forge.mjs detect` gains two defaults the
  user confirms rather than retypes. Read the origin with a bounded
  `execFileSync` of `git -C <dir> remote get-url origin` that discards the
  child's stderr and never throws, the way `run` in `issue-check.mjs` does, and
  pass the trimmed output to `classifyOrigin` from `lib/issue-decision.mjs` with
  NO tea logins - this phase probes no login (D-06), and a `git` read writes no
  `$CAD_SPAWN_MARKER`, so AC1's no-forge-CLI-spawned assertion still holds. Add
  a pure function to `lib/forge-decision.mjs` that turns a classification into
  the two defaults, and give provider and slug DIFFERENT availabilities (D-07):
  the provider default is present only for the `github` and `gitlab` verdicts
  and absent otherwise, while the slug default is the classification's `slug`
  whenever one parsed. Offer provider and slug and NO host default at all: D-08
  has the Forgejo instance host asked outright and confirmed by the user, never
  derived here, because on a split SSH endpoint the classifier's host is the SSH
  hostname (`ssh.jcrenshaw.dev`) and not the instance the user knows
  (`git.jcrenshaw.dev`) - the shape this repository itself has, so a derived
  default would be wrong on the first repository that read it. Guard the slug
  default with a stated
  `owner/name` grammar in the same pure module and return no default when it
  does not match: the coordinator interpolates this value into the shell line
  that persists it, the value comes off repository content, and a validated
  slug is what makes that interpolation safe - this is the seam's "validates"
  half of D-12 and the same hazard class `references/conventions.md` states for
  caller-derived text. Both defaults ride the `ask` envelope beside `installed`;
  nothing here changes the `configured` or `refuse` arms.
- **Verify:** `node cadence-core/bin/test.mjs git other` passes, including cases
  proving that against a repository whose origin is
  `ssh://git@ssh.jcrenshaw.dev:2222/crenshawdev/cadence.git` the envelope's slug
  default is `crenshawdev/cadence` and its provider default is absent, and that
  against `https://gitlab.com/g/sub/r.git` the provider default is `gitlab` and
  the slug default is `g/sub/r` (AC3); plus a case proving a slug that fails the
  grammar yields no slug default rather than passing the raw text through.

### Task 4: Both entry points ask the forge question once

- **Files:** cadence-core/workflows/new-project.md, cadence-core/workflows/adopt.md, cadence-core/bin/weight-budgets.json, .planning/DOCS-CLAIMS.md
- **Action:** Fold the forge step into the EXISTING single-Bash setup chain in
  both entry points (D-13) - `new-project.md`'s `setup` step, items 2-5, and
  `adopt.md`'s `setup` step item 3 - by appending one `forge.mjs detect --dir .`
  invocation to the script already there, so neither workflow gains a turn. The
  step branches on `action` alone, the way `/cad-land` step 1 branches on
  `issue-check`'s: on `configured`, say nothing and ask nothing (AC2); on
  `refuse`, print the envelope's `reason` and `hint` and stop the forge step -
  a forge is a precondition (FRG-02), so do not invent a no-tracker mode; on
  `ask`, put the question through the ask-user seam per
  `references/seams.md`, one structured choice over the `installed` entries with
  the provider default marked `(recommended)` when the envelope names one and
  no recommendation label when it does not, then a second question confirming
  the repository as `owner/name` pre-filled from the slug default where one is
  offered, then - ONLY when the chosen provider is `forgejo` and the envelope's
  `host` is null - a third question asking outright which Forgejo instance host
  serves it, open-ended per `references/seams.md` because the value is typed
  rather than picked from a set, with NO default offered and the question saying the
  instance the user reaches in a browser (`git.jcrenshaw.dev`), not an SSH
  endpoint (`ssh.jcrenshaw.dev`), because D-08 forbids deriving this value and
  the two differ on this very repository. `github` and `gitlab` are never asked
  it: their hosts are fixed. Persist the answers with one
  `config.mjs set git.forge_provider=<provider> git.forge_repo=<owner/name>`
  call - carrying `git.forge_host=<host>` as a third pair on the forgejo arm and
  omitting it entirely otherwise - against the default `.planning/config.json`
  target - no new writer, so
  `checkPairs`, `retiredKeyError` and the `repo_only` refusal all still apply
  (D-09). Both files carry the standing "Ask no configuration questions"
  sentence, and both must now state that this one question is a deliberate
  exception and why (D-05): a forge is a precondition, and it is asked once and
  never re-asked. Update the `.planning/DOCS-CLAIMS.md` rows ledgered against
  those two sentences, NEW-PROJECT-07 and ADOPT-08, so their cited lines and
  claim text match what the files now say. Re-pin
  `cadence-core/bin/weight-budgets.json` for both workflow surfaces from
  `node cadence-core/bin/weight.mjs`.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `ok:true` - which
  proves the new invocation's flags match the declared `CONTRACTS` row (check 2)
  and that neither workflow crossed its re-pinned budget; `node
  cadence-core/bin/test.mjs prose` passes; and `grep -n "forge" cadence-core/workflows/new-project.md cadence-core/workflows/adopt.md`
  shows, in each file, the `forge.mjs detect` call inside the existing setup
  script, an arm for each of `configured`, `ask` and `refuse`, the
  `config.mjs set` line naming `git.forge_provider` and `git.forge_repo`, and
  `git.forge_host` named only inside the forgejo arm.

### Task 5: Providers offered and none picked is a refusal, not a fall-through

- **Files:** cadence-core/workflows/new-project.md, cadence-core/workflows/adopt.md, cadence-core/bin/prose-agreement.test.mjs, cadence-core/bin/weight-budgets.json
- **Action:** The `ask` arm task 4 wrote has one more answer than it has
  providers, and that answer needs an arm rather than a fall-through. Give the
  provider question in BOTH entry points an always-present NONE option -
  `references/seams.md` states that shape and states that such an option
  consumes one of the four slots, which three providers plus NONE exactly fill,
  so no question split is needed. On NONE the step REFUSES in the shape the
  `refuse` action already uses and stops: a reason naming what was looked for -
  the binaries that resolved, read off the envelope's `installed` - and a hint
  naming how to set the provider later, `config.mjs set
  git.forge_provider=<provider>` against the repository's own
  `.planning/config.json`. It runs NO `config.mjs set` on that arm, so nothing
  is half-persisted for the next run to read back as configured. This is the
  second half of roadmap phase-1 criterion 5 ("no provider detected, OR NONE
  SELECTED"), and it cannot be left to the ask-user seam's own behaviour:
  `references/seams.md` forbids fabricating or defaulting an answer the seam was
  supposed to collect, so a declined question has no answer at all, and prose
  that does not say what happens next lets setup run on past a question it never
  got. Both files state that a forge is a precondition (FRG-02) and that the fix
  is to re-run the entry point once a provider is picked - do not invent a
  no-forge mode, and do not re-ask inside the same run. Re-pin
  `cadence-core/bin/weight-budgets.json` for both workflow surfaces from `node
  cadence-core/bin/weight.mjs`.
- **Verify:** `node cadence-core/bin/test.mjs prose` passes, including a new
  `prose-agreement.test.mjs` case in the shape of the file's existing `cad-land
  3(b): the GitLab arm consults the authorization seam BEFORE it creates` case,
  asserting for EACH of `cadence-core/workflows/new-project.md` and
  `cadence-core/workflows/adopt.md` that the provider question offers a
  none-of-these option, that the file states a stop arm for it carrying both a
  reason and a hint, and that the stop arm sits at an EARLIER offset than the
  `config.mjs set git.forge_provider` invocation - offsets in the file's own
  text, never line numbers, so an inserted paragraph does not redden it.
  Re-running that case against a scratch copy of either workflow with the NONE
  arm deleted fails with a message naming the missing arm. `node
  cadence-core/bin/self-verify.mjs` prints `ok:true`, so neither workflow
  crossed its re-pinned budget.

### Task 6: The tracker resolves the persisted forge, not the origin host

- **Files:** cadence-core/bin/issue-check.mjs, cadence-core/bin/lib/issue-decision.mjs, cadence-core/bin/issue-check.test.mjs, cadence-core/bin/issue-decision.test.mjs, cadence-core/config.schema.json, docs/EXAMPLE.md, .planning/DOCS-CLAIMS.md
- **Action:** Make the persisted choice authoritative at land time (D-01, AC4).
  In `issue-check.mjs`'s `check`, read `git.forge_provider`, `git.forge_repo`
  and `git.forge_host` off the merge it already performs and resolve the
  `HOST_TABLE` row from the persisted provider, with the persisted slug as the
  `--repo` selector; the origin URL is no longer read for classification and
  `classifyOrigin` is no longer called from this seam at all. The `tea login
  list` probe STAYS, with a different job, and `teaLogins` stays with it: it no
  longer guards a classification, it turns the persisted host into the login
  NAME `tea` needs. Measured on the installed tea 0.15.1: `--login` takes a
  configured login's name and nothing else (`--login git.example.com` against a
  config holding that URL answers `login name 'git.example.com' does not
  exist`), `--remote` takes a git REMOTE name, and `--repo` carries no host in
  any spelling (`host/owner/repo` is read as owner `host`) - so a persisted host
  reaches `tea` only by way of the `tea login list --output json` record whose
  `url` names it, and that record's fields are `name,url,ssh_host,user,default`
  with no token among them. Move `loginNamesHost` out of `classifyOrigin`'s
  private use and export a resolver from `lib/issue-decision.mjs` that returns
  the FIRST matching record's `name` - first in tea's own list order, so two
  logins naming one host resolve the same way on every land - or null when none
  matches, keeping that predicate's exact-equality
  vocabulary UNCHANGED - equality is what needs no public suffix list, and the
  host it is now handed was confirmed by the user rather than parsed off an SSH
  endpoint, which is the failure its header records. Rebind the forgejo row's
  `argv` and its `resolve.argv` to carry `--login <name>` where they carry
  `--remote origin` today, so the call NAMES its instance instead of discovering
  one from a remote that may be gone - that is what closes AC4 on Forgejo, and
  the row header's `--remote origin` reasoning is rewritten to say so rather
  than left asserting a binding the row no longer has. The `github` and `gitlab`
  rows are untouched, and the existing assertions that neither carries
  `--remote` still hold. Only THEN delete `classifyOrigin`'s `teaLogins`
  parameter and its `no-login` and login-derived `forgejo` arms: after this
  change the function has exactly one caller, `forge.mjs`, which passes no
  logins, so those arms are reachable from nothing. In `decideIssueCheck`,
  replace the two classification skip reasons `no-remote` and `unrecognized`
  with ONE skip whose reason says the repository has no forge configured and
  names the forge keys that are unset - `git.forge_host` among them when the
  provider is `forgejo` and the host is null, which is the same not-configured
  condition rather than a second degradation. KEEP the `no-login` arm and rebind
  it: the host it names is now the persisted `git.forge_host`, and its meaning
  is that no `tea` login serves that instance, so the fix the line points at is
  still a login. Both keep the existing sentence shape ending "no tracker
  report" so `/cad-land` step 1 prints either unchanged as one line. Everything
  below those arms is untouched: the log read, the CLI-presence arm, the nonzero and timed-out arms, the
  incomplete-list arm, the per-issue resolve budget and the `report` envelope
  all keep their current reasons and shapes, and no reason token elsewhere in
  the seam is renamed. `detail` stays null on every arm and no forge-CLI bytes
  reach the envelope. Correct the two prose surfaces this falsifies: the
  `git.issue_check` `purpose` in `config.schema.json`, which says the report is
  "on the detected host", and `docs/EXAMPLE.md`'s sentence about the host the
  origin points at; then update the `.planning/DOCS-CLAIMS.md` rows carrying
  those claims (README-85 and CONFIG-CATALOG-13's neighbours - locate them by
  claim text, not by line number) so no ledger row asserts the behaviour that
  just changed. Rewrite the `classifyOrigin` cases in `issue-decision.test.mjs`
  that exercise the deleted arms rather than leaving them asserting a shape the
  function no longer has, and rewrite the forgejo `argv` and `resolve.argv`
  cases there - the file asserts both element for element - against the
  `--login` form.
- **Verify:** `node cadence-core/bin/test.mjs git prose` passes, including a new
  `issue-check.test.mjs` case proving that a repository with all three forge keys
  set and `origin` REMOVED produces `action: "report"` against a `tea` stub whose
  `login` answer names a login whose `url` host equals the persisted
  `git.forge_host` - not a skip naming a missing remote (AC4) - and that
  `$CAD_ARGV_LOG` records an `issues list` carrying `--login <that login's
  name>` and NO `--remote`, which is what proves the call resolved an instance
  with no `origin` present; a case proving the same repository against a login
  list naming no such host skips with the rebound `no-login` reason rather than
  calling `tea` at all; and a case proving a repository with the keys unset skips
  with the new configured-forge reason. `node cadence-core/bin/self-verify.mjs`
  prints `ok:true`. `git diff` of the literal `reason` strings under
  `cadence-core/bin/` shows the two replaced classification reasons and the
  rebound `no-login` one, and nothing else.

### Task 7: README names a forge CLI among the prerequisites

- **Files:** README.md, .planning/DOCS-CLAIMS.md
- **Action:** Amend the prerequisites sentence in `README.md` - the one that
  today requires Claude Code with plugin support plus `node` and `git` on PATH -
  to name a forge CLI as well, one of `tea`, `gh` or `glab`, because FRG-02
  makes a forge a precondition rather than an option (D-18). Do not turn the
  sentence into a section and do not restate the install instructions:
  `README.md` is a decision document, and one clause is what this change is
  worth. Keep the existing zero-dependency claim in the same sentence true - a
  forge CLI is a host prerequisite, not an npm install. Update the
  `.planning/DOCS-CLAIMS.md` rows ledgered against that line, README-03 and
  README-04, so their claim text and cited line match the amended sentence.
- **Verify:** `node cadence-core/bin/self-verify.mjs` prints `ok:true` (README is
  a linted surface, so a mis-typed key token or a broken plugin-root path would
  report here); `node cadence-core/bin/test.mjs prose` passes; and
  `grep -n "tea\|gh\|glab" README.md` shows the three binaries named in the
  prerequisites sentence.

## Notes

- Key names are the planner's choice, since CONTEXT D-09 fixes only that they
  are new `git.*` keys: `git.forge_provider`, `git.forge_repo` and
  `git.forge_host`. No one of the three is a prefix of another, which keeps
  self-verify's dotted-token scan and its reverse `inert-config-key` arm
  unambiguous, and none reuses the `auto_close` vocabulary the LND-01 naming
  trap warns about.
- How the persisted host actually reaches `tea`, measured on the installed tea
  0.15.1 rather than assumed, because D-08 names the key but no source states
  the flag: `--login` resolves a configured login BY NAME only (`--login
  git.example.com` against a config whose login `beta` holds
  `https://beta.invalid` answers `login name 'git.example.com' does not
  exist`), `--repo` accepts no host in any spelling (`beta.invalid/o/r` is read
  as owner `beta.invalid`), and `--remote` names a git remote, which is the
  dependency D-08 exists to remove. So the host is turned into a login name
  through `tea login list --output json`, whose records are
  `name,url,ssh_host,user,default` - no token among them - matched by the exact
  host equality `loginNamesHost` already implements. That is why task 6 keeps
  the login probe instead of deleting it, and why the probe's job changes rather
  than its existence.
- `git.forge_host` is NOT `repo_only`, unlike `git.forge_repo`. It is the same
  judgment D-02 makes about the provider under the schema's own `_meta.note`
  test: naming which instance the user works with authorizes nothing on a
  repository that never named itself, because the slug is what binds a call to a
  repository and the slug stays repo-layer-only. A user with one self-hosted
  Forgejo can therefore set the host once, globally, and every repository that
  sets its OWN provider and slug inherits it.
- Plan 2 is SEQUENTIAL after this one: it extends `bin/forge.mjs`,
  `lib/forge-decision.mjs`, the `CONTRACTS` row, `workflows/new-project.md` and
  `bin/prose-agreement.test.mjs`, so the two plans share declared files by
  construction and must not run concurrently.
