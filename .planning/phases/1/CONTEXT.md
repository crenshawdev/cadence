# Phase 1 Context: Pick a forge

## Scope boundary

**In scope.** Detecting which forge CLIs resolve on PATH; asking the user which
provider and which repository; persisting that choice as new `git.*` config
keys; making the persisted choice authoritative for later forge calls; creating
the repository through the selected CLI behind an explicit confirmation.

**Out of scope.** Anything phase 2 owns - CAPTURE transience, the deferral ask,
the wontfix decline record. Auth setup: this phase never runs `gh auth login`,
`tea login add` or `glab auth login`, and never probes whether a resolved
binary is authenticated. Issue WRITING is phase 2; this phase resolves where
writes will go.

**Deferred.** Nothing deferred at this gate.

## Durable decisions

- **D-01** Config is authoritative for the forge; `classifyOrigin` is demoted to
  building the setup-time default and is never consulted at land time. This is
  what criterion AC4 means by "a repository that temporarily loses its remote
  does not silently change behaviour". It CHANGES the `unrecognized`,
  `no-login` and `no-remote` skip reasons `issue-check.mjs` emits today
  (`cadence-core/bin/issue-check.mjs:210-231`,
  `cadence-core/bin/lib/issue-decision.mjs:500-510`). Rejected: config filling
  gaps only, leaving `github.com`/`gitlab.com` hostname verdicts authoritative -
  it leaves two resolvers able to disagree, which is the failure AC4 exists to
  close.
- **D-02** The slug key is `repo_only`; the provider key is global-settable. The
  schema's own test (`config.schema.json` `_meta.note`) is whether a user-global
  value would AUTHORIZE a change to a repository that never opted in. A global
  slug can never correctly name a per-repo repository, and phase 2 turns these
  writes into real mutations. A provider preference carries no such
  authorization. Rejected: both `repo_only` (over-restricts a genuine
  preference), neither (a global slug would point every repo's issue writes at
  one target).
- **D-03** Repository creation runs as an `execFileSync` argv from a seam, never
  as raw Bash prose the coordinator composes. AC6 requires argv-recording stubs
  on the CHILD's PATH, which only reaches a spawned child
  (`cadence-core/bin/issue-check.test.mjs:62-80`). Note
  `cadence-core/bin/git-guard.mjs` guards only `git push` and `git commit`, so a
  raw Bash `gh repo create` would pass the hook unseen. Rejected: the
  `skills/cad-land/SKILL.md:95-100` prose precedent, under which nothing tests
  the argv.
- **D-04** Visibility is pinned PRIVATE on every provider and stated in the
  confirmation; the user is not asked. Measured 2026-08-24: `gh repo create`
  drops to an interactive prompt without one of `--public`/`--private`/
  `--internal`, which would hang inside a Bash tool call; `glab` defaults
  `internal`; `tea` offers `--private`. Three different defaults, one of them a
  hard non-interactive requirement. Rejected: asking visibility as a fourth
  field.
- **D-05** This phase creates the first deliberate exception to both entry
  workflows' standing "ask no configuration questions" rule, and both files must
  say so (`cadence-core/workflows/new-project.md:59`,
  `cadence-core/workflows/adopt.md:53`). Both sentences are ledgered claims -
  NEW-PROJECT-07 and ADOPT-08 in `.planning/DOCS-CLAIMS.md`.

## Decisions

- **D-06** "Installed" means the bare name resolves as an executable on the
  child's PATH through `onPath` - no `--version`, no login probe, no auth check.
  `cadence-core/bin/lib/on-path.mjs` is pure fs with no subprocess ever.
- **D-07** Provider and slug are two separate defaults with two different
  availabilities. `classifyOrigin` supplies a slug on any parseable origin but a
  provider only for the `github.com`/`gitlab.com` hostname suffixes or a
  `tea login list` record naming the host
  (`cadence-core/bin/lib/issue-decision.mjs:354-378`).
- **D-08** The persisted record is provider + slug, NOT host. On a split SSH
  endpoint the classifier's host is the SSH hostname
  (`ssh.jcrenshaw.dev`), not the instance the user knows
  (`git.jcrenshaw.dev`) - the shape this repository itself has.
- **D-09** Persistence is new `git.*` keys in `cadence-core/config.schema.json`
  written by the existing `config.mjs set` against `.planning/config.json`. No
  new writer seam, so `checkPairs`, `retiredKeyError` and the `repo_only`
  write-time refusal all still apply.
- **D-10** The keys ship in `cadence-core/templates/config.json` at explicit
  `null`. Null means unconfigured, so a scaffolded repo is visibly unasked
  rather than defaulted into a provider, and AC2's "already-configured is not
  re-asked" test has something to read.
- **D-11** Adding the keys drags four enforced surfaces with them: a
  `## Reach rows` row in `cadence-core/references/config-reach.md`, a prose
  reader token (or `self-verify` reports `inert-config-key`), a
  `references/config-catalog.md` row, and a re-pinned entry in
  `cadence-core/bin/weight-budgets.json` for every prose file that grows.
- **D-12** The question is asked in workflow prose through the ask-user seam;
  the new seam detects, validates and persists but never prompts. A seam
  blocking on stdin inside a Bash tool call would hang the workflow.
- **D-13** The step folds into the EXISTING single-Bash setup chain in both
  entry points (`workflows/new-project.md:30-69`, `workflows/adopt.md:33-45`),
  with re-entry decided by reading the persisted key back.
- **D-14** Repository creation has no single argv shape; each provider needs its
  own row, the way `HOST_TABLE` already carries a per-provider `argv`
  (`cadence-core/bin/lib/issue-decision.mjs:208-248`). Measured 2026-08-24 on
  gh 2.98.0, glab 1.114.0, tea 0.15.1.
- **D-15** `tea` wires no git remote (zero occurrences of "remote" in its help),
  so the Forgejo arm needs an explicit `git remote add origin` after creation
  where `gh` and `glab` do it through a flag.
- **D-16** Every `ok:false` this phase emits carries a hint, and no third-party
  bytes reach the envelope: child stderr discarded at the spawn, `detail` null
  on forge arms, `redactUrl` covering URL position only
  (`cadence-core/bin/issue-check.mjs:47-54,134-149,183-190`).
- **D-17** Any new `bin/*.mjs` declares a row in `CONTRACTS`
  (`cadence-core/bin/lib/arg-contract.mjs`) and states no flag rule of its own.
- **D-18** `README.md:18` is amended to name a forge CLI among the
  prerequisites, since FRG-02 makes a forge a precondition. README-03 and
  README-04 are ledgered against that line.

## Acceptance criteria

- [ ] AC1: With stub executables on the child's PATH, detection reports exactly
  which of `tea`/`gh`/`glab` resolve; with an empty stub dir it reports none. No
  subprocess is spawned during detection, asserted via `$CAD_SPAWN_MARKER`.
- [ ] AC2: `/cad-new-project` on a fresh directory and `/cad-adopt` on an
  existing repository each reach the forge step. Running either again against a
  repository whose forge keys are non-null asks nothing.
- [ ] AC3: Given `ssh://git@ssh.jcrenshaw.dev:2222/crenshawdev/cadence.git` the
  slug default is `crenshawdev/cadence` and the provider default is absent.
  Given `https://gitlab.com/g/sub/r.git` the provider default is `gitlab` and
  the slug is `g/sub/r`.
- [ ] AC4: With the forge keys set and `origin` removed, `issue-check` resolves
  the persisted provider and slug rather than emitting `no-remote`.
- [ ] AC5: Zero providers detected returns `ok:false` with a hint naming an
  install. No forge-CLI stdout or stderr appears anywhere in the envelope and
  `detail` is null on every forge arm. `refusal-hints` passes.
- [ ] AC6: The recorded argv per provider is
  `gh repo create <owner>/<repo> --private`,
  `glab repo create <owner>/<repo> --private --remoteName origin`, and
  `tea repos create --name <repo> --owner <owner> --private`. The `tea` arm is
  followed by a recorded `git remote add origin`. No creation argv is recorded
  without a prior confirmation naming provider, owner, name and visibility.
- [ ] AC7: (human-verify: needs a live forge account) One real repository is
  created end to end on Forgejo, with `origin` set and reachable afterward.

## Flagged assumptions

- Create-grammar stability across versions users actually have. Everything in
  D-14 was measured on ONE machine at gh 2.98.0, glab 1.114.0, tea 0.15.1.
  `glab`'s camelCase `--remoteName` and `tea`'s flag-only `--name`/`--owner` are
  the two most likely to have moved.
- Whether `tea repos create` can target a specific configured login when a user
  has two Forgejo instances logged in, and how it picks when not told.
- Whether `gh` and `glab` honour a non-interactive create against a self-hosted
  instance (GitHub Enterprise, self-managed GitLab) with the same argv - those
  hosts are exactly the ones `classifyOrigin` proves the codebase cannot
  classify.
- Plan shape: BIG - multiple plans in this phase. Detection + persistence +
  schema/docs surfaces is one slice; the per-provider creation argv table with
  its three grammars and the `tea` remote-add asymmetry is another. They touch
  different files and can be leased separately.
