---
phase: 15
plan: 7
requirements: ["T7"]
files: ["crates/cadence/src/milestone/release.rs","crates/cadence/src/milestone/model.rs","crates/cadence/src/milestone/mod.rs","crates/cadence/src/milestone_service.rs","crates/cadence/src/landing/cleanup.rs","crates/cadence/src/rail/commit.rs","crates/cadence/src/rail/git.rs","crates/cadence/src/store/writer.rs","crates/cadence/src/store/transaction.rs","crates/cadence/src/store/filesystem.rs","crates/cadence/src/server.rs","crates/cadence/src/recall/mod.rs","crates/cadence/tests/phase15_landing.rs","crates/cadence/tests/support/phase15.rs","crates/cadence/src/milestone/instructions.rs","skills/cad-milestone/SKILL.md","crates/cadence/src/landing/instructions.rs","skills/cad-land/SKILL.md","crates/cadence/tests/mcp.rs","cadence-core/bin/release-bump.mjs","cadence-core/bin/release-bump.test.mjs","cadence-core/bin/lib/release-decision.mjs","cadence-core/bin/release-decision.test.mjs","cadence-core/bin/test.mjs","cadence-core/bin/prose-agreement.test.mjs","cadence-core/bin/lib/arg-contract.mjs","cadence-core/bin/arg-contract.test.mjs","cadence-core/bin/arg-contract-adoption.test.mjs","cadence-core/bin/lib/refusal-hints.mjs","cadence-core/bin/helper-census.test.mjs","cadence-core/bin/lib/census-registry.mjs"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P15-7-T1","verify":["cargo nextest run -p cadence --test phase15_landing phase15_version_drift_is_reported_before_bump_or_tag"]},{"id":"P15-7-T2","verify":["cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions"]},{"id":"P15-7-T3","verify":["node --test --test-name-pattern='every flag in every row declares a complete grammar' cadence-core/bin/arg-contract.test.mjs","cargo nextest run -p cadence --test phase15_landing phase15_version_drift_is_reported_before_bump_or_tag"]}]}
---
## Goal

Read version collision and manifest/tag drift before release writes; wait for confirmation of the exact drift report before bumping.

## Must be true when done

- T7. When a milestone release names a version, the owner sees a collision with an existing tag, and a disagreement between the manifest's version and the newest tag, each reported before anything is bumped or tagged.

## Context

Finish D-199 using the close/committer from plans 1/2 and tag-after-merge from plan 5. The frozen release-bump helper writes a plugin manifest and changelog, while lib/git-tags.mjs collapses read failures to an empty tag list; the new prewrite release read must distinguish failure from no tags. The explicit manifest path/format belongs to the release request; phase 19 decides which project manifest is the default. lib/release-decision.mjs has surviving consumers: cadence-core/bin/lib/branch-decision.mjs imports compareVersions, and cadence-core/bin/planning/audit.mjs imports normalizeTargetVersion. Delete the replaced writer/tests without breaking those imports.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P15-T7-C",
      "spec": {
        "command": "cargo nextest run -p cadence --test phase15_landing phase15_version_drift_is_reported_before_bump_or_tag",
        "expected": {
          "kind": "literal",
          "value": "Version 1.2.0: status refused, collision names v1.2.0, manifest remains exactly at 1.1.0, HEAD/index/tags unchanged. Version 1.3.0: report explicitly names manifest 1.1.0 versus newest tag v1.2.0 and awaits confirmation; all bytes/refs unchanged before it. Valid exact confirmation produces one bump commit setting the named manifest to 1.3.0, with v1.3.0 still absent locally/remotely. Repeating the request creates no second bump. Changed-input confirmation refuses without bump or tag. Tagging remains unavailable until the separately recorded merge confirmation and ordered pull/tag step."
        },
        "test": {
          "file": "crates/cadence/tests/phase15_landing.rs",
          "function": "phase15_version_drift_is_reported_before_bump_or_tag"
        },
        "setup": "Use the actual Client::open stdio launch at crates/cadence/tests/support/phase13.rs:22; compare authored document bytes with crates/cadence/tests/support/phase14.rs:225 where required. Use support/phase15.rs to create a real repository with explicit JSON release manifest {version:'1.1.0'} (actual file uses JSON double quotes), fixed commits and a real tag v1.2.0. Capture manifest bytes, HEAD/index and tag refs. The release request explicitly names that manifest and v-prefixed tag policy; no manifest auto-detection or fake tag reader.",
        "call": "milestone-release version 1.2.0; then milestone-release version 1.3.0. Restart and re-read the drift report, confirm its exact manifest/tag/head binding via milestone-release-confirm, then read the real manifest, commit and tags. Also change a bound input in an independent fixture between report and confirmation and request that stale confirmation.",
        "boundary": "Real cadence serve over stdio; actual store journal, filesystem, Git child processes and local bare repository; forge effects, when present, cross an executable on PATH.",
        "fakes": [
          "Caller inputs and fixed clock/Git date inputs",
          "Caller-named JSON manifest and real local release tags"
        ]
      },
      "reason": "Causes the trigger of approved T7 version 1 and observes its stated outcome; this is its only check.",
      "associations": [
        {
          "truth_id": "T7",
          "truth_version": 1,
          "reason": "Causes the trigger of approved T7 version 1 and observes its stated outcome; this is its only check."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P15-T7-A1",
      "spec": {
        "locators": [
          "crates/cadence/src/milestone/release.rs",
          "crates/cadence/src/milestone_service.rs"
        ],
        "substance": "Prewrite version read naming exact proposed-tag collision and manifest-versus-newest-release-tag disagreement, with distinguishable unreadable inputs and immutable report binding."
      },
      "reason": "This artifact implements the owner-visible T7 outcome, including the named durable boundary.",
      "associations": [
        {
          "truth_id": "T7",
          "truth_version": 1,
          "reason": "This artifact implements the owner-visible T7 outcome, including the named durable boundary."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P15-T7-A2",
      "spec": {
        "locators": [
          "crates/cadence/src/milestone/model.rs",
          "crates/cadence/src/store/transaction.rs",
          "crates/cadence/src/landing/cleanup.rs",
          "crates/cadence/src/milestone/instructions.rs"
        ],
        "substance": "Owner-attributed confirmation of the exact drift report, one journaled binary-owned manifest bump commit, and binding to the post-merge tag step; no bump before confirmation and no tag at release preparation."
      },
      "reason": "This artifact implements the owner-visible T7 outcome, including the named durable boundary.",
      "associations": [
        {
          "truth_id": "T7",
          "truth_version": 1,
          "reason": "This artifact implements the owner-visible T7 outcome, including the named durable boundary."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Deliver the version-drift check and confirmed bump writer

- **ID:** P15-7-T1
- **Files:** crates/cadence/src/milestone/release.rs, crates/cadence/src/milestone/model.rs, crates/cadence/src/milestone/mod.rs, crates/cadence/src/milestone_service.rs, crates/cadence/src/landing/cleanup.rs, crates/cadence/src/rail/commit.rs, crates/cadence/src/rail/git.rs, crates/cadence/src/store/writer.rs, crates/cadence/src/store/transaction.rs, crates/cadence/src/store/filesystem.rs, crates/cadence/src/server.rs, crates/cadence/src/recall/mod.rs, crates/cadence/tests/phase15_landing.rs, crates/cadence/tests/support/phase15.rs
- **Action:** Deliver P15-T7-C and A1/A2 red then green. Add milestone-release read/propose behavior and a typed milestone-release-confirm writer, with exact version, tag name, contained explicit manifest path/format, observed manifest bytes, tag inventory and release id/digest. Read the real tag refs/peeled commits and the manifest version before any bump/tag write; errors are named refusals, not empty inventory. Reject an existing proposed tag/version collision even if it already targets HEAD. Report drift with both manifest version and chosen newest release tag/version; record no bump until the owner supplies attributed confirmation of that exact read result. At write time re-read/revalidate the manifest/tag/HEAD basis, refuse changed inputs, apply only the named manifest version update and create one binary-owned bump commit through the shared journal/committer and existing branch rail. An idempotent same request does not bump again. Do not auto-discover or bump sibling manifests. A separate explicitly named changelog may be preserved as input, but no inferred changelog rewrite is needed for this truth. Bind the resulting release/version/tag intent to the landing used by plan 5; the bump creates no tag. Plan-5 tag creation rechecks collisions on the pulled, confirmed merged base. Test the exact collision, drift and confirmation sequence with literal versions and byte/ref snapshots.
- **Verify:**
  - cargo nextest run -p cadence --test phase15_landing phase15_version_drift_is_reported_before_bump_or_tag

### Task 2: Expose release drift and tag-after-merge through the milestone door

- **ID:** P15-7-T2
- **Files:** crates/cadence/src/milestone/instructions.rs, skills/cad-milestone/SKILL.md, crates/cadence/src/landing/instructions.rs, skills/cad-land/SKILL.md, crates/cadence/tests/mcp.rs
- **Action:** Extend the existing compiled milestone front door to display the named manifest, requested version, collision or both drift values and ask for confirmation of the exact report before sending the writer operation. Report the actual bump commit and explicitly leave the tag for the already-confirmed landing cleanup step; the skill never calls release-bump.mjs or raw git tag. Update both affected rendered skill pins/bytes without introducing a second role authority or authorizing publish from version confirmation.
- **Verify:**
  - cargo nextest run -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions

### Task 3: Delete release-bump and retire only its private tests and contracts

- **ID:** P15-7-T3
- **Files:** cadence-core/bin/release-bump.mjs, cadence-core/bin/release-bump.test.mjs, cadence-core/bin/lib/release-decision.mjs, cadence-core/bin/release-decision.test.mjs, cadence-core/bin/test.mjs, cadence-core/bin/prose-agreement.test.mjs, cadence-core/bin/lib/arg-contract.mjs, cadence-core/bin/arg-contract.test.mjs, cadence-core/bin/arg-contract-adoption.test.mjs, cadence-core/bin/lib/refusal-hints.mjs, cadence-core/bin/helper-census.test.mjs, cadence-core/bin/lib/census-registry.mjs
- **Action:** Delete release-bump.mjs and release-bump.test.mjs with their replaced writer surface. Remove its executable contract/runner/refusal rows, file-transition consumer census entries, and old release-bump prose-agreement assertions. Remove unreferenced bump/changelog-only functions and corresponding cases from the mixed release-decision module/test; retain normalizeTargetVersion, compareVersions and their needed parsing/helpers and tests because branch-decision and planning/audit still import them. Keep git-tags and its surviving callers; replacing all frozen tag readers is outside phase 15. Keep issue-check untouched.
- **Verify:**
  - node --test --test-name-pattern='every flag in every row declares a complete grammar' cadence-core/bin/arg-contract.test.mjs
  - cargo nextest run -p cadence --test phase15_landing phase15_version_drift_is_reported_before_bump_or_tag

## Notes

P5 remains phase 19: no hard-coded decision that the Rust rewrite ships .claude-plugin/plugin.json or Cargo.toml. Read and bump the single explicitly named release manifest's existing version field, initially supporting the JSON shape exercised here, and report unsupported input instead of guessing. 'Newest tag' for this release read means the highest valid release-version tag under semantic version precedence, independent of tag-name lexical order or creation timestamps; report the chosen exact tag and peeled commit. Non-version labels are not release versions. Collision is checked against the exact proposed release tag and normalized version aliases, including an existing tag at the same target. No automatic fetch/push is introduced by this local read. Revalidate tags/manifest bytes at the write boundary and again before plan-5 tagging. Keep the shared release-decision comparison/normalization exports and their tests for surviving branch/audit consumers; remove only release-bump-specific transform code/tests when no consumer remains.

Execute plans 1 through 7 in order, never concurrently. Repeated file leases are sequential: retain earlier operations/tests and edit only this plan's named surface. New Rust paths and test functions are creation specifications, not claims about HEAD. The suite field renders execution.schema=1 and execution.suite; task ids and verify arrays render its task contract. Every task that delivers the one check commits its failing test first, records the real failing run, implements the behavior, then records the same narrow command passing. Do not add another evidence check for this truth. No observation items. All phase records and refusal/step receipts use the existing store writer and its sole journal; no separate authority or sidecar journal. Inputs are root-bound and versioned; retries bind the same request and exact inputs, and changed inputs refuse. Keep tracker writes, deferred-member ruling, generic absence proofs and manifest selection in their parked phases.
