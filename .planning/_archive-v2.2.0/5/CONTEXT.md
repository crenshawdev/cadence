# Phase 5: The install path is verified where it actually runs - Context

Gathered: 2026-08-04
Feeds: /cad-plan 5

## Scope boundary

In: HST-02 whole - the live human walk against the Forgejo remote from a fully
cold state (marketplace add, plugin install), verbatim command/output
transcripts in the phase record, and the conditional README install-section
correction (SC3). The phase edits no source; its only possible code-adjacent
change is a README doc commit.

Out: any seam or source change; the unmerged `52f995a` repository-field
repoint and the claudepluginhub.com submission it serves; `marketplace.json`
changes; the v2.2.0 manifest bump (`/cad-milestone` owns it).

Deferred: None.

Plan shape: one plan.

## Durable decisions

None this phase - every decision below governs how this walk runs and is
recorded, not how later phases build.

## Decisions

- D-01 (artifact under test): the walk verifies `origin/main`'s tip - at
  gathering time `0bba96f`, `plugin.json` version `2.0.0` - and the
  version-match check reads `git show origin/main:.claude-plugin/plugin.json`
  at walk time, never a hard-coded number; the record captures the tip sha and
  manifest bytes so a mid-cycle bump cannot fake a mismatch. Evidence:
  `origin/main:.claude-plugin/plugin.json`, `README.md:51-60`,
  `.planning/phases/5/UAT.md` item 2.
- D-02 (52f995a stays out): the unmerged commit repointing `plugin.json`'s
  `repository` field to the GitHub mirror (claudepluginhub.com indexes GitHub
  only; homepage stays Forgejo) is outside this phase. If it merges before the
  walk, the record notes the mirror-indexing rationale so the manifest does
  not read as contradicting HST-01. Evidence: `git show 52f995a`,
  `.planning/ROADMAP.md:117-127`.
- D-03 (clean state is fully cold - user decision 2026-08-04): uninstall
  `cadence@cadence`, remove the `cadence` marketplace, and delete
  `~/.claude/plugins/cache/cadence/` before the walk, so the reinstall can
  only succeed by fetching live from Forgejo. Uninstall precedes marketplace
  removal, so remove-while-installed semantics are never exercised.
  Rejected: marketplace-level clean only (the pre-built UAT items' narrower
  steps), under which a leftover `2.0.0` cache dir could satisfy the version
  check with stale bytes. Cost: the purge removes the plugin driving
  /cad-verify mid-walk - the sequence is uninstall -> add -> install ->
  resume verification. Evidence: `~/.claude/plugins/cache/cadence/cadence/`
  (nine historical version dirs), `~/.claude/plugins/installed_plugins.json`.
- D-04 (prior machine state is inadmissible): a successful add + install
  already happened here (2026-07-30: `known_marketplaces.json`,
  `installed_plugins.json` at `0bba96f`), so the gap is *unrecorded from a
  clean state*, not *never exercised* - the walk is run for real and only the
  fresh walk counts as evidence. Evidence:
  `~/.claude/plugins/known_marketplaces.json`,
  `~/.claude/plugins/installed_plugins.json`, `.planning/CAPTURE.md:167`.
- D-05 (no unwritten auth): anonymous HTTPS clone of
  `git.jcrenshaw.dev/crenshawdev/cadence` is public (user-confirmed for
  third-party reach), and this machine holds no git credential source that
  could silently satisfy it - the README command as written depends on no
  unwritten knowledge going in. Evidence: `git config --list --show-origin`
  (no credential helper), absence of `~/.git-credentials` and
  `/etc/gitconfig`, user confirmation 2026-08-04.
- D-06 (walk vehicle and record): the walk runs through the pre-built
  `.planning/phases/5/UAT.md` via /cad-verify 5; the plan adds no machine
  tasks, scripts, or seams. Verbatim transcripts land in the phase-5 record
  (SUMMARY.md), committed per `planning.commit_docs`. Evidence:
  `.planning/phases/5/UAT.md`, `.planning/phases/3/SUMMARY.md` and
  `.planning/phases/4/SUMMARY.md` (record shape).
- D-07 (SC3 doc target): the install documentation is `README.md`'s install
  section (`README.md:51-60`) and nothing else - `INTERNALS.md` carries no
  install or marketplace prose. A needed correction is committed within this
  phase. Evidence: `README.md:51-60`, grep of `INTERNALS.md` (zero
  install/marketplace hits).
- D-08 (proof form): post-install proof is `installed_plugins.json`'s
  `version` and `gitCommitSha` matched against the `origin/main` tip -
  stronger than `ls` of the cache dir, and unambiguous after D-03's purge.
  Evidence: `~/.claude/plugins/installed_plugins.json`,
  `.planning/phases/5/UAT.md` item 2.

## Acceptance criteria

- [ ] AC1: From a fully cold state - `cadence@cadence` uninstalled, the
      `cadence` marketplace removed, `~/.claude/plugins/cache/cadence/`
      deleted - `/plugin marketplace add
      https://git.jcrenshaw.dev/crenshawdev/cadence.git` succeeds and
      `cadence` appears in `/plugin marketplace list`, with the exact command
      and output recorded verbatim in the phase record. (human-verify: needs
      the live Forgejo remote and the interactive `/plugin` prompt)
- [ ] AC2: `/plugin install cadence@cadence` from that entry succeeds, and
      `installed_plugins.json`'s `version` and `gitCommitSha` equal the
      `version` in `git show origin/main:.claude-plugin/plugin.json` and the
      `origin/main` tip sha at walk time - recorded the same way.
      (human-verify: needs the interactive `/plugin` prompt)
- [ ] AC3: Either the phase record states explicitly that no step failed or
      needed a workaround, or the failure/workaround is written into
      `README.md`'s install section with that doc commit present in `git log`
      within this phase - a verified path that only works with unwritten
      knowledge is not verified.

## Flagged assumptions

- The 2026-07-30 install state arrived via the documented commands - Likely;
  if wrong, the clean-state add can still fail, which is exactly what the
  walk exists to catch - it is never pre-judged a formality.
- `.planning/phases/5/UAT.md` items 1-2 (pre-built 2026-08-03) carry the
  narrower marketplace-only clean steps that predate D-03 - the verify pass
  must walk the stronger cold-state steps from AC1/AC2; `uat refresh` appends
  new items but never rewrites existing `expected` text, so the walk follows
  the criteria, not the stale step text.
- The v2.2.0 cycle may bump the published manifest before the walk runs -
  Likely benign under D-01's walk-time reads; if the walk records a version
  other than `2.0.0`, that is correct behavior, not drift.
