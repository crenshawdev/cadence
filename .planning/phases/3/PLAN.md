---
phase: 3
plan: 1
requirements: [REL-01, REL-02]
files: [cadence-core/bin/lib/branch-decision.mjs, cadence-core/bin/lib/release-decision.mjs, cadence-core/bin/release-decision.test.mjs, cadence-core/bin/release-bump.mjs, cadence-core/bin/release-bump.test.mjs, cadence-core/bin/self-verify.mjs, cadence-core/workflows/milestone.md, cadence-core/bin/weight-budgets.json]
---

# Phase 3: Release mechanics - Plan

## Goal

A distributed-plugin release bumps its own manifest version and records what
changed as part of the close - not by hand. Phase 3 delivers the mechanism
(seam + wiring + tests); the live rc.2 bump and the real v1.1 changelog prose
are executed by this mechanism at the milestone close, not hand-landed here.

## Must be true when done

- Run against a fixture `plugin.json` at `1.0.0`, the seam rewrites only
  `version` to the milestone's bare semver (`v` stripped, e.g. `1.1.0-rc.2`)
  and preserves every other field; a second run changes nothing (idempotent).
- A sibling manifest with no `version` field (marketplace.json shape) is left
  byte-unchanged - the seam injects no `version` and guards an absent sibling.
- The seam prepends a dated `## [<version>] - <date>` heading plus its
  `[<version>]:` link reference above the existing `[1.0.0]` entry in
  `CHANGELOG.md`, leaving `[1.0.0]` untouched; the entry's bullet prose is left
  for the model to author.
- On a project with no `.claude-plugin/plugin.json`, the seam no-ops cleanly
  (`action:"skip"`, never a crash), so non-plugin closes are unaffected.
- `cadence-core/workflows/milestone.md` runs the bump + changelog step before
  the tag is cut and before step 4 evolves `### Active`; the seam invocation
  validates against the self-verify CONTRACTS table.
- `node --test` and `tsc --checkJs` pass across `cadence-core/bin`, and
  `node cadence-core/bin/self-verify.mjs` exits 0 with the new subcommand
  registered.

## Context

Locked decisions (CONTEXT.md): D-01 version derivation reuses
`branch-decision.mjs` scanners, `v` stripped to bare semver; D-02 D-10 split -
pure core in `bin/lib/` + thin atomic-write I/O seam in `bin/`, zero-dep, not
the external skill; D-03 sibling sync writes `version` only where the field
exists (marketplace.json = guarded no-op); D-04 auto-detect gating (plugin.json
present AND release/tag mode), no new config key; D-05/D-06 seam scaffolds the
dated heading + link ref deterministically, prose is model-authored, CHANGELOG
excluded from self-verify's linted surfaces; D-07 step lives in `milestone.md`
before the tag and before the `### Active` evolve, NOT in `cad-land`; D-09
CONTRACTS entry + sibling `*.test.mjs`, no config key so no inert-config-key
obligation. Mirror the Phase-2 seam-pair shape (`git-publish.mjs` +
`lib/publish-decision.mjs`) and the totality discipline of `close-decision.mjs`
(bad/missing inputs never throw; Phase-1 null-version lesson: never invent a
version, never crash on a version-less project). **Out of scope (D-08):** do
NOT edit this repo's own `.claude-plugin/plugin.json` version or author the real
v1.1 CHANGELOG content - that is the deferred live execution the mechanism runs
at the rc.2 close; Phase 3 verifies against fixtures only. `cad-land` is left
unchanged (D-07); it inherits the step via the milestone chain.

The version-derivation reuse mechanism (D-01, flagged for the planner) is
resolved here as: **export the private `activeVersion`/`titleVersion` scanners
from `branch-decision.mjs`** rather than wrap `integrationBranchName` and strip
`cadence/v`. Rationale: it reuses the exact `$ARGUMENTS -> ### Active ->
ROADMAP-title` precedence directly and legibly, and does not couple release
derivation to the branch-naming prefix convention (if `cadence/` ever changes,
release derivation must not silently break).

## Tasks

### Task 1: Export the version scanners from branch-decision.mjs

- **Files:** cadence-core/bin/lib/branch-decision.mjs
- **Action:** Add `export` to the two currently-private functions `activeVersion`
  and `titleVersion` so the release-derivation core can reuse them (D-01);
  `integrationBranchName` keeps calling them unchanged. Do not change their
  behavior, signatures, or `VERSION_RE`. Update the file's top-of-file comment
  to note the two scanners are now part of the module's public surface (reused
  by the release-bump derivation), so the reuse is documented, not incidental.
- **Verify:** `node --test cadence-core/bin/branch-decision.test.mjs` still
  passes; `node -e "import('./cadence-core/bin/lib/branch-decision.mjs').then(m => process.exit(typeof m.activeVersion === 'function' && typeof m.titleVersion === 'function' ? 0 : 1))"` exits 0.

### Task 2: Pure release-decision core + its test

- **Files:** cadence-core/bin/lib/release-decision.mjs, cadence-core/bin/release-decision.test.mjs
- **Action:** Create the pure, zero-dep, `// @ts-check` core (node builtins
  only, no I/O, total like `close-decision.mjs`), importing `activeVersion` and
  `titleVersion` from `./branch-decision.mjs`. Export three functions:
  (1) `deriveTargetVersion({ argVersion, projectText, roadmapText })` - precedence
  `argVersion` -> `activeVersion(projectText)` -> `titleVersion(roadmapText)`,
  then strip a single leading `v`, returning bare semver or `null` when none is
  derivable (never invent a version - Phase-1 null lesson).
  (2) `decideManifestBump(currentVersion, targetVersion)` - total, returns
  `{ action, bumped, from, to, reason }`: falsy `targetVersion` ->
  `action:'error'`, reason `no-target-version`, `bumped:false`; `currentVersion`
  `undefined`/absent (manifest has no `version` field) -> `action:'skip'`, reason
  `no-version-field`, `bumped:false` (D-03 sibling guard); `currentVersion ===
  targetVersion` -> `action:'noop'`, `bumped:false` (idempotency); else
  `action:'bump'`, `bumped:true`, `from:currentVersion`, `to:targetVersion`.
  (3) `prependChangelogEntry(changelogText, { version, date, url })` - a PURE text
  rewrite returning `{ text, changed, reason }`: idempotent no-op (`changed:false`)
  when a `## [<version>]` heading already exists; else insert
  `## [<version>] - <date>\n\n` immediately before the first `^## \[` version
  heading and `[<version>]: <url>\n` immediately before the first `^\[...\]:`
  link-reference line (append at end if none exists), never altering any existing
  entry or its link reference. No fenced code blocks in the source; JSDoc only.
  Write the sibling test mirroring `close-decision.test.mjs`: assert
  `deriveTargetVersion` strips the `v`, honors the precedence order, and returns
  `null` on empty inputs; assert `decideManifestBump` returns bump/noop/skip/error
  for the four cases; assert `prependChangelogEntry` inserts the heading and link
  reference above a `[1.0.0]` fixture entry, leaves the `[1.0.0]` heading and its
  link reference byte-unaltered, and is a no-op on a second call (idempotency).
- **Verify:** `node --test cadence-core/bin/release-decision.test.mjs` passes,
  including the idempotent-second-call and `v`-strip assertions.

### Task 3: The release-bump I/O seam + its test

- **Files:** cadence-core/bin/release-bump.mjs, cadence-core/bin/release-bump.test.mjs
- **Action:** Create the thin `// @ts-check` mutating seam mirroring
  `land-cleanup.mjs`/`git-publish.mjs` shape and `lib/seam-io.mjs` convention
  (one JSON line on stdout, never `process.exit()` after `emit`). Subcommand:
  `bump [--dir <path>] [--version <v>] [--date <YYYY-MM-DD>]` - `--dir` is the
  repo/planning root (default cwd), `--version` overrides the derived target
  ($ARGUMENTS pass-through), `--date` is a test hook for the changelog date
  (default today's `new Date().toISOString().slice(0,10)`). Flow: read
  `.claude-plugin/plugin.json` at `dir`; if absent, `emit({ ok:true,
  action:'skip', reason:'no-plugin-manifest' })` and return (D-04 auto-detect
  gating; Phase-1 no-crash lesson). Derive the target via `deriveTargetVersion`
  reading `.planning/PROJECT.md` and `.planning/ROADMAP.md` with a
  degrade-to-empty `readText` helper (like `land-cleanup.mjs`), `--version`
  overriding. Primary manifest: parse the JSON object, call
  `decideManifestBump(obj.version, target)`; on `bump` set `obj.version = target`
  and `atomicWrite` (imported from `./lib/planning-files.mjs`)
  `JSON.stringify(obj, null, 2) + '\n'` (preserves field order); on
  `noop`/`skip`/`error` write nothing. Sibling: `.claude-plugin/marketplace.json`
  - parse if present (guard an absent file), call `decideManifestBump(obj.version,
  target)`; its missing `version` yields `skip` so it is left untouched (D-03).
  Changelog: **guard on a derived target first** - when `target` is falsy
  (no-target-version), skip the changelog step entirely and do NOT call
  `prependChangelogEntry` (mirrors the manifest `error` guard; without this a
  null target scaffolds a corrupt `## [null]` heading into `CHANGELOG.md` - the
  Phase-1/Phase-2 null-value lesson). Only with a non-null `target`: read root
  `CHANGELOG.md`, build the link `url` from the manifest's `homepage` (or
  `repository` with a trailing `.git` stripped), as
  `<base>/releases/tag/v<version>`, falling back to `<base>/releases` when no
  base is present; call `prependChangelogEntry` and `atomicWrite` only when
  `changed`. Emit `{ ok:true, action:'bumped'|'noop'|'skip'|'error', target,
  reason, manifest:{ from, to, bumped }, siblings:[...], changelog:{ changed } }`
  - the `error` action carries `reason:'no-target-version'` (manifest present
  but no derivable version) so the milestone.md caller gets an explicit signal
  that nothing was written rather than a silent undefined action.
  Write the sibling test mirroring `land-cleanup.test.mjs` fixture style
  (hermetic global-config env, temp dir): a temp dir with
  `.claude-plugin/plugin.json` at `1.0.0` carrying extra fields, a
  `.claude-plugin/marketplace.json` with no `version`, a root `CHANGELOG.md`
  with a `[1.0.0]` entry + link reference, and `.planning/PROJECT.md` whose
  `### Active` names `v1.1.0-rc.2`. Assert: after `bump --dir <d> --date
  2026-07-17`, the manifest `version` is `1.1.0-rc.2` and every other field is
  unchanged (parse and deep-compare); marketplace.json is byte-unchanged;
  CHANGELOG has `## [1.1.0-rc.2] - 2026-07-17` and a `[1.1.0-rc.2]:` link
  reference above `[1.0.0]`, with the `[1.0.0]` heading line unaltered; a second
  `bump` reports `action:'noop'` and leaves plugin.json and CHANGELOG
  byte-identical (no double bump); a dir with no `plugin.json` returns
  `action:'skip'`, `reason:'no-plugin-manifest'`; and a dir WITH a
  `plugin.json` but no derivable version (a `.planning/PROJECT.md` whose
  `### Active` has no `vX.Y.Z` token and no `ROADMAP.md`, no `--version`)
  returns `action:'error'`, `reason:'no-target-version'` and leaves both
  `plugin.json` and `CHANGELOG.md` byte-unchanged (no `## [null]` heading is
  ever written).
- **Verify:** `node --test cadence-core/bin/release-bump.test.mjs` passes,
  including the null-target no-corruption assertion.

### Task 4: Register the subcommand in self-verify CONTRACTS

- **Files:** cadence-core/bin/self-verify.mjs
- **Action:** Add a `'release-bump.mjs': { '*': ['--dir'], bump: ['--version',
  '--date'] }` entry to the `CONTRACTS` table, placed beside the other
  git-lifecycle seams (`git-publish.mjs`, `land-cleanup.mjs`). Do NOT add
  `release-bump` to `TWO_WORD` (its subcommand is single-word). Add no config
  schema key and no inert-config-key handling - D-04/D-09: the bump is
  auto-detected, there is no new config key.
- **Verify:** `node cadence-core/bin/self-verify.mjs` emits `ok:true` and exits
  0; `node --test cadence-core/bin/self-verify.test.mjs` passes.

### Task 5: Wire the bump + changelog step into milestone.md before the tag and the evolve

- **Files:** cadence-core/workflows/milestone.md, cadence-core/bin/weight-budgets.json
- **Action:** In step 2 (release mode), after "confirm the version" and BEFORE
  the annotated `git tag -a` line, insert the manifest-bump + changelog-scaffold
  step. Direct the model to run, on its own physical line,
  `node "${CLAUDE_PLUGIN_ROOT}/cadence-core/bin/release-bump.mjs" bump --dir <root>`
  (adding `--version <version>` when the user named one via `$ARGUMENTS`). State
  that the seam auto-detects `.claude-plugin/plugin.json` and returns
  `action:"skip"` when absent (non-plugin projects are unaffected), bumps the
  manifest and any versioned sibling, and scaffolds the dated `## [<version>]`
  CHANGELOG heading + link reference; then the model authors the entry's bullet
  prose (what shipped this milestone, including any default flips) under the
  scaffolded heading - the seam owns the deterministic scaffold, prose owns the
  judgment (D-06). Then commit the manifest + changelog as
  `chore: bump manifest to <version> + changelog` BEFORE the tag, so the tag
  captures the bumped manifest. Add a one-line ordering note: this runs before
  step 4 evolves `### Active`, so derivation reads the shipping version, and the
  `git.auto_close` chain (step 7) inherits it because step 2 always runs pre-tag.
  Match the invocation's flags exactly to the Task-4 CONTRACTS entry.
  Then, because `milestone.md` sits exactly at its self-verify weight budget
  (4755 B, zero headroom), raise its budget entry in
  `cadence-core/bin/weight-budgets.json` to the file's new byte length (use
  `wc -c` on the edited file, set the budget to that value) so the blocking
  budget check passes.
- **Verify:** Reading `milestone.md`, the `release-bump.mjs bump` invocation
  appears within step 2 before the `git tag -a` line and ahead of step 4's
  `### Active` evolve; `node cadence-core/bin/self-verify.mjs` exits 0 (the
  invocation validates against CONTRACTS and no budget-overrun is reported);
  and the repo's configured typecheck `npx tsc -p tsconfig.ci.json` exits 0
  (CI installs `@types/node` ephemerally per `.github/workflows/test.yml`;
  install it locally if absent), so the new `release-decision.mjs`/`release-bump.mjs`
  carry no JSDoc/implicit-any type errors - satisfying the plan's tsc
  done-criterion, which no earlier task's `node --test` would have caught.

## Notes

- D-08 boundary: no task edits this repo's own `.claude-plugin/plugin.json`
  version or writes the real v1.1 CHANGELOG bullet prose. REL-02's "first entry
  documents v1.1.0 scope + the `memory.backend none -> builtin` flip" is the
  deferred live content the mechanism produces at the rc.2 milestone close; the
  scaffold + convention is what Phase 3 delivers and verifies (via fixtures).
- `cad-land` (`skills/cad-land/SKILL.md`) is intentionally left unchanged (D-07):
  the bump lives in `milestone.md` before the tag, and `cad-land` inherits it
  through the `git.auto_close` chain. `cad-milestone/SKILL.md` is also left
  unchanged - it `@`-includes `milestone.md` for its execution context, and it
  sits at exact weight budget (1523 B), so re-summarizing the new step in the
  skill would force a second budget bump for no behavioral gain.
- The recalled backlog root cause (plugin.json shipped stale at `1.0.0` because
  no close bumped it; marketplace.json carries no `version`) is exactly what this
  seam + wiring closes: D-03 makes marketplace a guarded no-op, and D-07 folds
  the bump into the pre-tag close.
