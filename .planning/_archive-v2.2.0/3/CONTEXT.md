# Phase 3: The release seam cannot lie about the release - Context

Gathered: 2026-08-03
Feeds: /cad-plan 3

## Scope boundary

In: REL-03 whole - the downgrade refusal in `decideManifestBump` (#87), the
promotion of staged `## [Unreleased]` content into the dated release heading
(#86), the removal of the prose version derivation, and the refusal envelope
plus its handling in the one calling workflow. Files:
`cadence-core/bin/lib/release-decision.mjs`, `cadence-core/bin/release-bump.mjs`,
their two test files, `cadence-core/workflows/milestone.md`, and
`cadence-core/bin/weight-budgets.json`.

Out: the branch-naming derivation (`activeVersion`, `titleVersion`,
`integrationBranchName` and their consumers `git-branch.mjs` /
`land-cleanup.mjs`) - branch naming keeps reading prose; tag policy; any
`release.*` config key; a self-verify manifest↔changelog version check (D-13);
promoting the live TOK-02 cost statement (the close does that mechanically);
the v2.2.0 manifest bump itself, which `/cad-milestone` owns.

Deferred: `cadence-core/workflows/milestone.md:49-50`'s "create an annotated
tag at HEAD" sentence contradicts the adopted tag-after-merge Key Decision
(PROJECT.md) - out of REL-03's scope; record to CAPTURE.md as a todo at
execution rather than widening this phase into tag policy.

Plan shape: one plan.

## Durable decisions

- D-01 (refusal envelope): every refusal in `release-bump.mjs` - downgrade,
  unparseable version, missing target - emits `ok:false` / exit 1 with a named
  reason, and the existing no-target arm's `ok:true, action:"error"` shape is
  converted to match in the same pass. Matches the sibling `git-publish.mjs`
  refusal precedent so a scripted caller can never read a refusal as success.
  Rejected: `ok:true` plus a `refuse` action (this seam's own prior precedent),
  which leaves the halt entirely to workflow prose. Evidence:
  `cadence-core/bin/release-bump.mjs:92-95`,
  `cadence-core/bin/git-publish.mjs:108,139`.
- D-02 (compare scope): the version compare is hand-rolled in the pure lib to
  full semver §11 precedence - prerelease sorts below its release, numeric
  identifiers compare numerically, build metadata is ignored - so
  `1.1.0-rc.2 → 1.1.0` stays an upgrade and `1.1.0 → 1.1.0-rc.2` refuses. The
  repo ships no comparator and takes zero runtime deps. Rejected: a simplified
  triple-plus-rc rule, wrong for any prerelease shape beyond `-rc.N`.
  Evidence: `.planning/PROJECT.md:188,192`,
  `cadence-core/bin/lib/branch-decision.mjs:19`,
  `cadence-core/bin/release-decision.test.mjs:37-43`, tags `v1.1.0-rc.1/2`.
- D-03 (explicit target): `deriveTargetVersion`'s prose arms - PROJECT.md
  `### Active` and the ROADMAP title - are REMOVED; the shipping number is the
  explicit `--version` the milestone workflow already confirms with the user,
  and its absence refuses. The shipped PROJECT.md template carries no version
  token, so a fresh project could never satisfy the prose arm anyway; this
  repo's live `### Active` prose still described phase 2's reversed premise
  weeks after it changed, which is the staleness REL-03 names. Rejected:
  cross-checking prose against a second source (keeps the stale dependency);
  deriving from manifest + `--level` (computes 2.1.0 this cycle - the manifest
  lags at 2.0.0 while CHANGELOG already carries `## [2.1.0]`). Evidence:
  `cadence-core/bin/lib/release-decision.mjs:26-32`,
  `cadence-core/templates/PROJECT.md:31-37`,
  `cadence-core/workflows/milestone.md:27-31`,
  `cadence-core/bin/self-verify.mjs:134-137` (`--version` already an allowed
  flag - no CONTRACTS change).
- D-04 (promotion semantics): promotion runs on EVERY run whose
  `## [Unreleased]` body is non-empty - heading insertion stays idempotent on
  the dated heading existing, promotion is idempotent on the Unreleased body
  being empty - and the `## [Unreleased]` heading survives as an empty stub at
  the top (Keep a Changelog convention). The byte-identical re-run test is
  scoped to the no-new-content case. Rejected: keeping the heading-exists
  early return (first-run-only promotion), which re-strands content on a
  re-run and fails SC2's "no run" wording literally; deleting the stub, which
  breaks two existing ordering tests and leaves the next cycle nothing to
  stage into. Evidence: `cadence-core/bin/lib/release-decision.mjs:95-98`,
  `cadence-core/bin/release-decision.test.mjs:104-115,146-147,158-159`,
  `CHANGELOG.md:3-4`.

## Decisions

- D-05 (refusal is a verdict, not a throw): `decideManifestBump` stays total -
  a downgrade yields a refusal verdict in the return object, never a throw;
  the seam maps verdicts to the D-01 envelope. The `refuse` vocabulary follows
  `publish-decision.mjs`. Evidence:
  `cadence-core/bin/lib/release-decision.mjs:34-68`,
  `cadence-core/bin/lib/publish-decision.mjs:52,62,123,141`.
- D-06 (unparseable refuses): an unparseable version on either side (`"latest"`,
  `"1.0"`) refuses with a named reason rather than falling back to the old
  `from !== to` bump - the manifests that most need the guard do not keep the
  hole. Evidence: `cadence-core/bin/lib/release-decision.mjs:8-10`,
  `cadence-core/bin/release-bump.mjs:24-26`.
- D-07 (no override): the refusal is absolute - no `--allow-downgrade` flag,
  no config key. An escape hatch no caller passes is the dead-reach pattern
  phase 2 just deleted. Evidence: `.planning/REQUIREMENTS.md:28`,
  `.planning/PROJECT.md:192`, `cadence-core/bin/self-verify.mjs:90-152`.
- D-08 (siblings): the sibling-manifest loop inherits the guard through the
  shared function; a sibling refusal is recorded in `siblings[]` without
  aborting the primary write. `marketplace.json` carries no version field
  today, so this arm is fixture-exercised only. Evidence:
  `cadence-core/bin/release-bump.mjs:106-116`, `.claude-plugin/marketplace.json`.
- D-09 (promotion lives in the pure lib): the text rewrite is an exported
  function in `release-decision.mjs`; the seam stays a thin read/decide/write.
  Evidence: `cadence-core/bin/lib/release-decision.mjs:6-8`,
  `cadence-core/bin/release-bump.mjs:8-10,118-126`.
- D-10 (no hand-promotion this phase): the live TOK-02 cost statement stays
  under `## [Unreleased]`; `/cad-milestone` performs the promotion at the
  close through the capability this phase ships. Evidence:
  `.planning/phases/2/CONTEXT.md` D-13, `cadence-core/workflows/milestone.md:30-47`,
  `CHANGELOG.md:7`.
- D-11 (branch naming untouched): `activeVersion`, `titleVersion` and
  `integrationBranchName` keep their prose derivation - two live consumers and
  a public reference document depend on it; only the release derivation
  changes. Evidence: `cadence-core/bin/lib/branch-decision.mjs:11-15`,
  `cadence-core/bin/git-branch.mjs:24,48`,
  `cadence-core/bin/land-cleanup.mjs:34,80`,
  `cadence-core/references/git.md:56,64`.
- D-12 (no `release.*` config family): the replacement derivation is
  argument-shaped, adding no key across the four config surfaces and keeping
  the phase-2/3 parallel-safety condition moot. Evidence:
  `cadence-core/config.schema.json`, `.planning/ROADMAP.md:95`,
  `CHANGELOG.md:55-60`.
- D-13 (no manifest↔changelog self-verify check): mid-cycle skew is the normal
  state (manifest `2.0.0`, changelog `## [2.1.0]` at HEAD), so a blocking
  check goes red the moment it is written and SC4 could not pass. Evidence:
  `.claude-plugin/plugin.json`, `CHANGELOG.md:62`,
  `cadence-core/bin/self-verify.mjs:501-503`.
- D-14 (the workflow halts on refusal): `workflows/milestone.md` - the seam's
  ONLY caller; nothing in the tree reads its exit status - gains the refusal
  arm: on `ok:false` the close halts before any tagging step. Today it
  documents only the `skip` arm, which is how a refused bump would get tagged
  silently. Evidence: `cadence-core/workflows/milestone.md:34,37-47`,
  `cadence-core/bin/lib/seam-io.mjs:25-28`.
- D-15 (budgets): `milestone.md` sits exactly at its byte budget (7181/7181),
  so `weight-budgets.json` regenerates in the same commit as any prose edit
  there. Evidence: `cadence-core/bin/weight-budgets.json`,
  `cadence-core/bin/self-verify.mjs:501-506`.
- D-16 (test shape): SC1/SC2 are proven by direct-import unit tests in
  `release-decision.test.mjs`; the nothing-was-written refusal behaviour is
  proven end-to-end by a subprocess test in `release-bump.test.mjs`, following
  the existing `action:error, both files byte-unchanged` template. Evidence:
  `cadence-core/bin/release-decision.test.mjs:7-9`,
  `cadence-core/bin/release-bump.test.mjs:76-83,141-154`.

## Acceptance criteria

- [ ] AC1: `decideManifestBump` given a target lower than the manifest's
      current version refuses - the seam exits 1 with `ok:false` and a named
      reason, `plugin.json` and `CHANGELOG.md` byte-unchanged - proven by a
      test that fails against HEAD; the existing upgrade-path tests still
      pass, with `1.1.0-rc.2 → 1.1.0` accepted as a bump and
      `1.1.0 → 1.1.0-rc.2` refused as a downgrade.
- [ ] AC2: An unparseable version on either side (`"latest"`, `"1.0"`) refuses
      with a named reason rather than taking the old any-difference bump path,
      and writes nothing.
- [ ] AC3: On a changelog holding both a non-empty `## [Unreleased]` body and
      no dated heading for the target, one run produces `## [<version>] -
      <date>` containing the promoted content, with `## [Unreleased]`
      remaining as an empty stub above it and no content stranded between the
      two.
- [ ] AC4: A re-run whose Unreleased body gained new content promotes that
      content too; a re-run with an empty Unreleased body leaves both files
      byte-identical.
- [ ] AC5: `release-bump.mjs bump` with no `--version` refuses even when
      `.planning/PROJECT.md`'s `### Active` prose names a version - the prose
      arms are gone (fails against HEAD, which derives from that prose) - and
      the SUMMARY states the replacement derivation and the failure it
      removes.
- [ ] AC6: Every refusal in the seam (downgrade, unparseable, no-target) emits
      `ok:false` / exit 1, and `workflows/milestone.md` documents the refusal
      arm as a halt before any tagging step is reached.
- [ ] AC7: `node --test cadence-core/bin/*.test.mjs` and `npx tsc -p
      tsconfig.ci.json` both exit 0, and `node cadence-core/bin/self-verify.mjs`
      reports `ok:true` with no budget overrun, with `weight-budgets.json`
      regenerated in the same commit as the `milestone.md` edit.

## Flagged assumptions

- `workflows/milestone.md` is the seam's only caller (grepped across
  `cadence-core/`, `skills/`, `agents/`) - Confident; if wrong, another caller
  still reads the old `ok:true` error envelope and misreads the converted
  refusals.
- The sibling-refusal arm is exercised only by fixtures (`marketplace.json`
  has no version field) - Likely; if a sibling manifest ever gains a real
  version, D-08's record-without-abort split-state choice needs revisiting.
- Build metadata (`+meta`) never appears in this repo's manifests and §11
  ignores it in precedence - Likely; if a manifest carries it, the compare's
  ignore behaviour must be pinned by a test rather than assumed.
