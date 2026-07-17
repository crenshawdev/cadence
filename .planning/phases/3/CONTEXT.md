# Phase 3: Release mechanics - Context

Gathered: 2026-07-17
Feeds: /cad-plan 3

## Scope boundary

In: A manifest-version bump folded into the close - a pure `node --test`-covered
decision function in `bin/lib/` (compare current-vs-target, no-op when equal)
plus a thin atomic-write I/O seam in `bin/` with a `self-verify.mjs` CONTRACTS
entry and a sibling test; a CHANGELOG step that prepends a version-stamped entry
to the existing root `CHANGELOG.md`; wiring of both into `workflows/milestone.md`
before the tag cut; the prose mentions self-verify needs.
Out: The LIVE bump of this repo's `plugin.json` and the real-content v1.1
changelog entry (executed by this mechanism at the rc.2 milestone close, not
during Phase 3 - see Deferred); a new config toggle (bump is auto-detected); any
change to `marketplace.json` shape (it carries no `version`); the external
`claude-mem:version-bump` skill (zero-dep constraint); Phase 4's docs
reconciliation / store-submission metadata.
Deferred:
- Live bump of this repo's `.claude-plugin/plugin.json` -> `1.1.0-rc.2`, the
  real-content first v1.1 CHANGELOG entry (documenting the shipped v1.1.0 scope
  incl. the `memory.backend none -> builtin` flip), and confirming `/plugin`
  reports the update - all executed by this mechanism at the rc.2 milestone
  close (roadmap criteria 3+4 live execution). The `/plugin`-reports check is
  human-verify (needs the Claude Code host; pre-release comparator behavior is
  an unverified host unknown).
Plan shape: one plan.

## Decisions

- D-01 (Version derivation): The shipped version derives from `$ARGUMENTS` ->
  `PROJECT.md ### Active` -> `ROADMAP.md` title, reusing `branch-decision.mjs`'s
  existing version scanners; the `v` prefix is stripped so the manifest carries
  bare semver (`1.1.0-rc.2`). Evidence: `cadence-core/bin/lib/branch-decision.mjs`
  (VERSION_RE, `activeVersion`, `titleVersion`, `integrationBranchName`);
  `.claude-plugin/plugin.json` (`"version"` bare, no `v`); Phase 1 D-05.
- D-02 (Bump seam structure): D-10 split - a pure decision function in `bin/lib/`
  (compare current-vs-target, no-op when equal = idempotency) plus a thin
  mutating I/O seam in `bin/` doing an atomic JSON write; a newly-named
  subcommand gains a `self-verify.mjs` CONTRACTS entry and a sibling `*.test.mjs`.
  Zero-dep hand-rolled, not the external `version-bump` skill. Evidence: Phase 2
  D-10; `cadence-core/bin/git-publish.mjs` (+ `lib/publish-decision.mjs`)
  precedent; `cadence-core/bin/config.mjs` atomic-write via `lib/planning-files.mjs`.
- D-03 (Sibling sync = plugin.json only here): The bump writes a `version` field
  only where one already exists; `marketplace.json` carries none (its entry uses
  `source: "./"`), so it is a no-op, and the seam guards against an absent
  sibling. Evidence: `.claude-plugin/marketplace.json` (name/owner/plugins[],
  no `version`).
- D-04 (Bump gating): Auto-detect - the bump fires when
  `.claude-plugin/plugin.json` is present AND the milestone is in release/tag
  mode (reuses `git.create_tag` gating); no new config key is added. Evidence:
  `cadence-core/workflows/milestone.md` step 2 (release-mode detection);
  REQUIREMENTS.md REL-01 ("For a distributed-plugin project").
- D-05 (CHANGELOG convention): The close prepends a version-stamped entry
  `## [1.1.0-rc.2] - <date>` (with its trailing `[1.1.0-rc.2]:` link reference)
  above the existing `[1.0.0]` entry in the root `CHANGELOG.md`, never altering
  the `[1.0.0]` history; format stays Keep a Changelog + SemVer. Evidence:
  `CHANGELOG.md` (exists; `## [1.0.0] - 2026-07-16`, trailing link references);
  REQUIREMENTS.md REL-02.
- D-06 (Changelog prose is model-authored): The seam scaffolds the dated heading
  and link reference deterministically; the entry's bullet prose is authored by
  the model (judgment about what changed). CHANGELOG is deliberately excluded
  from self-verify's linted prose surfaces, so the seam boundary is manifest JSON
  + changelog scaffold, not prose. Evidence: `cadence-core/bin/self-verify.mjs`
  (CHANGELOG excluded from linted surfaces).
- D-07 (Close-flow placement): The bump + changelog step lives in
  `cadence-core/workflows/milestone.md` before the tag is cut AND before step 4
  evolves `PROJECT.md ### Active` to the next version - so the tag captures the
  bumped manifest and derivation still reads the shipping version;
  `git.auto_close` routes through the same pre-tag step. Not placed in
  `skills/cad-land/SKILL.md` (chained after the evolve). Evidence:
  `cadence-core/workflows/milestone.md` steps 2/4/7; Phase 2 D-06.
- D-08 (Scope - mechanism only): Phase 3 builds the mechanism (seam + wiring +
  tests + prose). The live bump of this repo's `plugin.json` -> `1.1.0-rc.2` and
  the real-content v1.1 CHANGELOG entry are executed by the mechanism at the
  rc.2 milestone close, not hand-landed during Phase 3 (dogfoods the seam).
  Evidence: roadmap criterion 4 wording ("bumped ... at this round's close");
  user decision this pass.
- D-09 (self-verify / test wiring): The new subcommand gets a CONTRACTS entry in
  `self-verify.mjs` plus a sibling `*.test.mjs`; no new config key means no
  `inert-config-key` obligation; `tsc --checkJs` stays green. Evidence:
  `cadence-core/bin/self-verify.mjs` CONTRACTS table + inert-config-key reverse
  check; Phase 2 D-02/D-10; `cadence-core/bin/land-cleanup.test.mjs` fixture
  pattern.

## Acceptance criteria

- [ ] Given milestone version `v1.1.0-rc.2`, the bump decision function returns
      target `1.1.0-rc.2` (bare, `v` stripped); given a manifest already at the
      target, it returns a no-op (`bumped:false`)
- [ ] The bump seam, run against a fixture `plugin.json` at `1.0.0`, rewrites
      only `version` to the target and preserves every other field; a second run
      is a no-op with no double-bump
- [ ] Given a sibling manifest with no `version` field (marketplace.json shape),
      the seam leaves it unchanged and injects no `version`
- [ ] The changelog step, run against a fixture, prepends
      `## [1.1.0-rc.2] - <date>` plus its `[1.1.0-rc.2]:` link reference above
      the `[1.0.0]` entry, leaving `[1.0.0]` unaltered
- [ ] `node cadence-core/bin/self-verify.mjs` exits 0 with the new subcommand in
      CONTRACTS; `node --test` and `tsc --checkJs` pass across `cadence-core/bin`
- [ ] `cadence-core/workflows/milestone.md` orders the bump + changelog step
      before both the tag cut and the `### Active` evolve (verifiable by reading
      the step sequence)

## Flagged assumptions

- Pre-release comparator: whether Claude Code's `/plugin` orders
  `1.0.0 < 1.1.0-rc.2` correctly (so an update is reported) is a host behavior
  the codebase cannot settle. Version stays honest `1.1.0-rc.2` (semver-honesty
  is a locked PROJECT.md constraint; the plain-`1.1.0` fallback is rejected);
  "/plugin reports the update" is a human-verify at the rc.2 close.
- Version-derivation reuse mechanism is the planner's call - export the private
  `activeVersion`/`titleVersion` scanners from `branch-decision.mjs`, or wrap
  `integrationBranchName` and strip the `cadence/v` prefix.
