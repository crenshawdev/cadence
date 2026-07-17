---
phase: 1
plan: 1
requirements: [GIT-01]
files:
  - cadence-core/config.schema.json
  - cadence-core/templates/config.json
  - cadence-core/workflows/config.md
  - cadence-core/bin/config.test.mjs
  - cadence-core/bin/lib/branch-decision.mjs
  - cadence-core/bin/branch-decision.test.mjs
  - cadence-core/bin/git-branch.mjs
  - cadence-core/bin/git-branch.test.mjs
  - cadence-core/bin/self-verify.mjs
  - cadence-core/references/git.md
---

# Phase 1: Integration-branch model - Plan

## Goal

Cadence owns a two-tier branch model: a per-milestone integration branch - the
reconciliation point parallel worktrees fork from and merge into, off `main` -
created and switched to at cycle start, with `trunk` as the escape hatch that
composes with the existing protected-branch guard.

## Must be true when done

- `config.mjs get git.integration_branch` returns `milestone` and
  `git.auto_branch` returns `ask` on a default config; both reject values
  outside their enums.
- `node cadence-core/bin/self-verify.mjs` exits 0 with both new keys present
  (no `inert-config-key` problem for either).
- A deterministic pure function decides `create | stay | ask` from
  (`integration_branch` mode, `auto_branch` mode, current branch, protected
  list), and derives a version-named integration branch (`cadence/v1.1.0-rc.2`)
  from `PROJECT.md ### Active` (fallback: the `ROADMAP.md` title).
- In `milestone` mode on a protected base: `auto` yields `create` (switch to the
  named branch before the first commit), `off` yields `stay`, `ask` yields
  `ask`; off a protected base the decision is `stay` (lazy, once per cycle).
- In `trunk` mode no integration branch is created (decision is `stay`); commits
  on the base stay governed by `git.on_protected`, `git-guard.mjs` unchanged.
- The branch decision reports the integration branch (its tip) as the worktree
  fork point in `milestone` mode; `references/git.md` rail 1 performs the
  create/switch so every cycle-start workflow inherits it.
- `node --test 'cadence-core/bin/*.test.mjs'` passes, covering both new config
  keys and the branch-decision function.

## Context

Locked decisions (CONTEXT.md, authoritative): D-01/D-02 add two schema-only keys
plus one prose mention each (no `config.mjs` code change, no CONTRACTS change to
`config.mjs`). D-03 composes create/switch into `references/git.md` rail 1, not a
single workflow. D-04 defines `ask|auto|off` and lazy once-per-cycle creation
inferred from HEAD on a protected base. D-05 derives the name from prose. D-06:
no worktree plumbing change - worktrees already fork from HEAD, so switching HEAD
is enough. D-07: `trunk` creates nothing, `git-guard.mjs` unchanged. D-09: the
decision is a testable pure function separate from the advisory hook. Module
location is the planner's call: this plan adds a new lib module
`lib/branch-decision.mjs` (pure, imported by tests) plus a thin workflow-facing
seam `git-branch.mjs` that rail 1 invokes - keeping the tested logic and the
prose it drives as one source of truth. `config.mjs` is schema-driven; new enum
keys need no code change (see the `git.on_protected` enum for the shape to copy).

## Tasks

### Task 1: Add the two config keys and cover them with tests

- **Files:** cadence-core/config.schema.json, cadence-core/templates/config.json, cadence-core/workflows/config.md, cadence-core/bin/config.test.mjs
- **Action:** In `config.schema.json` under `keys`, beside the existing `git.*`
  entries, add `git.integration_branch` as `{ "type": "enum", "values":
  ["milestone", "trunk"], "default": "milestone", "src": "repo", "purpose":
  "..." }` (purpose: milestone = per-milestone integration branch as the
  worktree reconciliation point; trunk = no integration branch, commit on the
  base under `on_protected`) and `git.auto_branch` as `{ "type": "enum",
  "values": ["ask", "auto", "off"], "default": "ask", "src": "repo", "purpose":
  "..." }` (purpose: how the integration branch is created at cycle start - ask
  prompts once, auto creates silently, off stays put). In
  `templates/config.json` add `"integration_branch": "milestone"` and
  `"auto_branch": "ask"` to the `git` block, keeping valid JSON. In
  `workflows/config.md` add two rows to the **Git** section of the Catalog
  table (after `git.on_protected`), each naming the dotted key in backticks with
  its purpose and per-value copy - these live prose mentions satisfy the reverse
  `inert-config-key` check (D-02); do not touch the `config.mjs` CONTRACTS
  table. In `config.test.mjs` extend the existing `keys:` test to assert
  `r.keys['git.integration_branch']` and `r.keys['git.auto_branch']` exist with
  the right `.values`, and add a test that `get` on an absent config returns
  `milestone` / `ask` for the two keys and that `check git.integration_branch=x`
  and `check git.auto_branch=x` (out-of-enum) return `ok:false` with a
  `must be one of` error. No change to `config.mjs` itself.
- **Verify:** `node cadence-core/bin/config.mjs get git.integration_branch git.auto_branch`
  prints `{"ok":true,...,"git.integration_branch":"milestone","git.auto_branch":"ask"...}`;
  `node cadence-core/bin/config.mjs check git.auto_branch=sometimes` prints
  `ok:false` with `must be one of: ask, auto, off`;
  `node cadence-core/bin/self-verify.mjs` exits 0 (no `inert-config-key` for
  either key); `node --test cadence-core/bin/config.test.mjs` passes.

### Task 2: Pure branch-decision and naming module with unit tests

- **Files:** cadence-core/bin/lib/branch-decision.mjs, cadence-core/bin/branch-decision.test.mjs
- **Action:** Create `lib/branch-decision.mjs` exporting two pure functions,
  zero-dep, node builtins only. (1) `integrationBranchName(projectText,
  roadmapText)`: locate the `### Active` heading in `projectText`, scan its
  section body for the first token matching `/v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/`;
  if none, scan the first `# ` heading line of `roadmapText` for the same
  pattern; return `cadence/<version>` or `null` when no version is found (do not
  invent a version - null lets the caller surface a naming problem). (2)
  `decideBranch({ mode, autoBranch, currentBranch, protectedBranches,
  integrationName })` returning `{ action, branch, reason }` where `action` is
  `create | stay | ask`: if `mode === 'trunk'` return `stay` (reason: trunk mode
  composes with on_protected, no integration branch) with `branch: null`; if
  `mode === 'milestone'` and `currentBranch` is in `protectedBranches`, map
  `autoBranch` to `auto -> create`, `off -> stay`, `ask -> ask`, each carrying
  `branch: integrationName`; if `currentBranch` is not protected return `stay`
  (reason: already off the base, once-per-cycle creation already happened). In
  `create`/`ask` the `branch` field names the integration branch that becomes
  the worktree fork point (D-06). Keep it total - an unknown `mode` or
  `autoBranch` returns `stay` rather than throwing. Add `branch-decision.test.mjs`
  in the sibling style of `config.test.mjs` (node:test, node:assert/strict)
  covering: name derived from a `### Active` fixture, ROADMAP-title fallback,
  null when no version; and `decideBranch` for every case - trunk=stay,
  milestone+protected+{auto=create, off=stay, ask=ask} with the right
  `integrationName` branch, milestone+non-protected=stay.
- **Verify:** `node --test cadence-core/bin/branch-decision.test.mjs` passes;
  `node -e "import('./cadence-core/bin/lib/branch-decision.mjs').then(m=>console.log(m.integrationBranchName('### Active\n\n`+"`v1.1.0-rc.2`"+` round','')))"`
  prints `cadence/v1.1.0-rc.2`.

### Task 3: git-branch.mjs seam plus its contract entry and seam test

- **Files:** cadence-core/bin/git-branch.mjs, cadence-core/bin/self-verify.mjs, cadence-core/bin/git-branch.test.mjs
- **Action:** Create `git-branch.mjs`, a zero-dep seam printing one JSON line
  (follow `git-guard.mjs`/`config.mjs` conventions: import `mergeLayers` from
  `lib/config-merge.mjs`, `emit` from `lib/seam-io.mjs`, and the pure functions
  from `lib/branch-decision.mjs`). One subcommand `decide` with flags `--dir`
  (planning root, default cwd) and `--branch` (override the current branch;
  when absent, read it via `git -C <dir> rev-parse --abbrev-ref HEAD`, degrading
  to empty string on failure). `decide` reads effective config from
  `<dir>/.planning/config.json` via `mergeLayers` (fields `git.integration_branch`
  default `milestone`, `git.auto_branch` default `ask`, `git.protected_branches`
  default `["main","master"]`), reads `<dir>/.planning/PROJECT.md` and
  `<dir>/.planning/ROADMAP.md` (missing file -> empty string), computes
  `integrationBranchName` then `decideBranch`, and emits
  `{ ok:true, action, branch, mode, currentBranch, reason }`. This seam never
  runs `checkout -b` itself (that is rail 1's job); it only advises, exactly as
  `git-guard.mjs` only advises. In `self-verify.mjs` add a `'git-branch.mjs'`
  entry to the `CONTRACTS` table: `{ '*': ['--dir'], decide: ['--branch'] }` so
  the rail-1 invocation added in Task 4 passes the invocation check; make no
  other change to that file. Add `git-branch.test.mjs` in the fixture style of
  `git-guard.test.mjs` (build a temp `.planning` dir with a `config.json`,
  `PROJECT.md`, `ROADMAP.md`, run `node git-branch.mjs decide --dir <fixture>
  --branch <name>`): assert milestone+auto on `main` -> `action:"create"` with
  `branch:"cadence/<version>"`, milestone+ask on `main` -> `action:"ask"`,
  milestone+off on `main` -> `action:"stay"`, milestone on a work branch ->
  `action:"stay"`, and trunk on `main` -> `action:"stay"` with `branch:null`.
- **Verify:** `node --test cadence-core/bin/git-branch.test.mjs` passes;
  `node cadence-core/bin/git-branch.mjs decide --dir . --branch main` prints
  `{"ok":true,"action":"ask","branch":"cadence/v1.1.0-rc.2","mode":"milestone",...}`
  against this repo's `.planning`; `node cadence-core/bin/self-verify.mjs` exits 0.

### Task 4: Compose create/switch into references/git.md rail 1

- **Files:** cadence-core/references/git.md
- **Action:** In rail 1 (the "before the FIRST commit" guard), after the
  protected-branch/base-integrity checks, add an **Integration branch**
  subsection stating: at cycle start, before the first commit, run
  `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/git-branch.mjs" decide` and act
  on `action` - `create` means `git checkout -b <branch>` then continue on it
  (the per-milestone integration branch, e.g. `cadence/v1.1.0-rc.2`); `ask`
  means prompt once via the ask-user seam (create the named integration branch /
  stay on the base / abort), no preselected default; `stay` means do nothing.
  State that `git.integration_branch` chooses `milestone` (create the integration
  branch, the reconciliation point parallel worktrees fork from and merge into)
  vs `trunk` (create nothing - commits land on the base still governed by
  `git.on_protected`, `git-guard.mjs` unchanged), and that `git.auto_branch`
  chooses `ask` / `auto` / `off`. Note that because worktrees already fork from
  HEAD and self-reap (`workflows/execute.md`), switching HEAD to the integration
  branch makes its tip the worktree fork point with no worktree change (D-06),
  and that `git.base_branch` remains the landing/guard base, distinct from the
  integration branch (D-08). Reference the two new keys by their dotted names so
  the mention is unambiguous. Keep it directive prose; do not restate rail 3/4.
- **Verify:** `node cadence-core/bin/self-verify.mjs` exits 0 (the
  `git-branch.mjs decide` invocation and the `${CLAUDE_PLUGIN_ROOT}` path both
  resolve, and no `inert-config-key` remains); `grep -n "git-branch.mjs" cadence-core/references/git.md`
  shows the invocation, and the section names all three `auto_branch` behaviors
  and the `trunk` composition.

## Notes

- Branch naming reads the milestone version from prose (`PROJECT.md ### Active`,
  fallback `ROADMAP.md` title); if that version is stale the branch is
  misnamed - wrong name, not wrong behavior (CONTEXT flagged assumption, low
  consequence).
- The interactive create/switch and once-per-cycle prompting are workflow
  behavior driven by rail 1; the falsifiable proof of the decision lives in the
  pure function and the `git-branch.mjs decide` seam output (Tasks 2-3), which
  run fully under `node` with no live git checkout required.
