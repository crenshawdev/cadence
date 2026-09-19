VERIFICATION PASSED

Rechecked 2026-09-10 in `/code/cadence`, branch `cadence/binary-owns-process`, HEAD `df43af15275ea47e656d7f082c443c9296d9dd8c`. Both plans were read at their current uncommitted bytes. The complete working-tree diff and the relevant HEAD import/configuration seams were inspected. No Cargo command or mutating Git command was run. No plan, source, fixture, lock or temporary project was created or edited; only this report was overwritten.

## Reviewed plan SHA-256

- `.planning/phases/28/PLAN-1.md`: `0b699dd37e60bfc9303afc9ef1865a317938f58e5a367ddd82dc13e4acd118e2`
- `.planning/phases/28/PLAN-2.md`: `63e6fda1eda65c6803090a036d8d7262a02b5165d06f9415f682182a1ffa5519`

Citation shorthand: P1:n = `.planning/phases/28/PLAN-1.md:n`; P2:n = `.planning/phases/28/PLAN-2.md:n`. Other paths are repository-relative. The previously read design, role contract, independently derived goal-backward obligations and locked decisions continue to govern. The user's dispatch authorizes this further recheck.

## Findings by severity

- BLOCKER: 0. Previous B1 is resolved by preserving the canonical capture/restore root and checking the exact configuration mapping before the case runs.
- WARNING: 0. Previous W1 and W2 are resolved and remain resolved.
- NOTE: 0.

No new finding arose. This verdict checks the executable plan, not a completed fixture capture, implementation, test run or live observation.

## B1 resolution: fixed canonical root and exclusive ownership

P1:296 now requires `/tmp/cadence-phase27-absent-map-df43af15` for capture and every C6 restore, independently of TMPDIR. P2:103 requires exactly that recorded canonical root, keeps both replays and the approved replacement there, and prohibits rewriting or rehashing the fixture. The earlier instruction to restore into an unrelated fresh temporary root is gone.

The resolution matches the actual source:

| Source invariant | Revised setup that satisfies it |
|---|---|
| `SessionFactory::first_touch` resolves the planning root through `reload::identity` before deriving configuration paths (`crates/cadence/src/import/mod.rs:844`). | Capture requires canonical project path equal to the fixed spelling (P1:305); C6 checks both project and planning roots against provenance before starting (P2:108). |
| `reload::identity` canonicalizes existing paths; its fallback also resolves existing parents (`crates/cadence/src/config/reload.rs:10`). | Capture/restore create actual non-symlink directories and restore real file bytes at the same absolute paths, rather than relying on a symlink or TMPDIR alias (P1:301; P2:104). |
| `active_paths` derives the canonical repo configuration sibling named `config.v4.json` (`crates/cadence/src/config/write.rs:19`). | Provenance records the exact active mapping; capture asserts repo = fixed root + `/.planning/config.v4.json` and global absent/null (P1:322). C6 repeats the comparison before replay or replacement (P2:108). |
| The stored import manifest is read and its `active` paths compared with the newly derived paths; inequality causes `invalid import completion or changed layer mapping` (`crates/cadence/src/import/mod.rs:1005`, comparison at :1009). | Both binaries use empty `CADENCE_GLOBAL_CONFIG` and the identical canonical root, so the saved repo/global path values match the new runtime mapping without modifying the manifest (P1:312,325; P2:110). |
| Historical replay returns before writer admission, but replacement reaches `first_touch` (`crates/cadence/src/plan_service.rs:106`, :166). | C6 expressly says replay success alone is insufficient, verifies mapping first, then still requires the real approved replacement and post-replacement replay (P2:112,124). |

On a normal Linux host or Linux CI runner where `/tmp` is the real writable temporary directory, this fixed spelling survives canonicalization. A TMPDIR override does not change a literal `/tmp/...` path; a separate filesystem mounted at `/tmp` also does not by itself rewrite its canonical pathname. A read-only inspection of this host found `/tmp` canonicalizes to `/tmp`, is not a symlink, and has mode 01777. The fixed project root does not currently exist. No fixture directory was created to make this assessment.

The plan does not silently assume unusual aliased or unavailable `/tmp` environments work: canonical-path equality is asserted, and a mismatch, unavailable path or competing lock fails setup rather than skipping the case (P1:305,310; P2:111). No claim of portability to a symlinked `/tmp`, every operating system, or an executed CI run is made. The normal Linux setup requested in this dispatch has no remaining path-mapping contradiction.

The ownership protocol is sufficiently concrete for execution (P1:298; P2:105):

1. Acquire an exclusive OS lock on the fixed sibling `.lock` file before either capture or restore; reject an active holder. Require a regular non-symlink current-user-owned file with mode 0600, retain the lock through cleanup, and leave the lock file in place to avoid locking different inodes.
2. Reject an existing root unless it is a non-symlink directory owned by the current user with the exact regular non-symlink ownership marker. Under the lock, remove only such owned leftovers; create the new root with mode 0700 and the prescribed marker. Never remove an unowned root or follow a symlink.
3. Register failure/unwind cleanup before setup; stop and reap children, remove the owned root, then release the lock. Successful capture and C6 runs use the same cleanup order. Owned hard-kill leftovers are handled at the next locked entry; an unowned or incomplete unmarked directory is refused rather than deleted.
4. Keep the marker and lock outside the captured `.planning` tree, preserving historical snapshot/JSONL/receipt bytes and tree comparisons (P1:328). C6 repeats the same ownership and cleanup requirements for all calls and assertion failure (P2:105,113).

The executor can implement this protocol with existing dependencies and platform facilities: `libc` is already declared (`crates/cadence/Cargo.toml:38`), and the tree already uses no-follow/close-on-exec opens and OS file locking (`crates/cadence/src/store/filesystem.rs:303`, :318). The plan leaves routine helper names to the executor, not the ownership semantics. The harness lock protects one fixed fixture directory; it is not a new production writer, reader-start guard or acceptance gate. There is no need to edit import, filesystem or configuration source to make the case work.

**B1 resolved.** The same actual canonical root and active configuration mapping can now satisfy writer admission for the required replacement while retaining captured bytes unchanged.

## W1 resolution: historical absent-field case and capture order

The original missing compatibility control remains explicitly inside the existing C6 (P2:101). It checks that the old submission, approval, publication and receipt omit the new map field, replays the exact historical request, performs an approved replacement with the first complete attached map, and replays the original absent-field request again. It requires the original payload digest, receipt serialization, identity, revision, results and historical map absence to survive. Projection is `installed` before replacement and `newer-authorized` afterward; replay must preserve the current attached map and installed new PLAN bytes (P2:118–133). P2 task 2 expressly forbids reconstructing the request with the changed helpers (P2:305).

Capture remains ordered BEFORE any schema/helper edit and uses a binary built from unmodified dispatch HEAD df43af15 (P1:294). The required real setup is executable on that HEAD: phase27_plan.rs supplies actual fixture file contents (:90), a real stdio Client (:21), native context-submit (:109), and the old absent-map request/approval shape (:124, :84). P1 now reuses those file contents at the fixed root rather than allocating a random TempDir. Native context approval precedes allocation and plan publication; acknowledged publication and journal absence precede capture (P1:311–318). No phase-28 code must exist before the capture.

The explicit BEFORE instruction governs the sequence even though it follows the task's general schema-change directives. The binary/source hash, transcript, canonical roots and exact configuration mapping are recorded in fixture provenance (P1:322). Original state/JSONL integrity and receipt bytes are preserved, not synthesized or regenerated under the extended schema (P1:327–332). This remains historical input to the extended binary, not an oracle generated from the new implementation.

The exact fixture path, `crates/cadence/tests/fixtures/phase27_absent_map.json`, is creation-leased in P1 frontmatter (P1:17) and task 1 (P1:284), and declared in P2 frontmatter (P2:18) and task 2 as read-only (P2:288). The fixture is still absent at HEAD/current working tree, correctly awaiting execution. With B1 fixed, the new case is no longer blocked by restoration at a different root.

**W1 resolved.** The required historical control, real pre-extension capture, sequencing, provenance and leases are all concrete without adding another acceptance check.

## W2 resolution: actual-file presence sentinel and read-only exception

C7 still describes the exact actual-file presence sentinel, `{"retained":"pending owner work"}` plus newline at `.planning/.store-intent.json`, in a separate copy of a normally published fixture after stopping its server (P2:199). It explicitly claims presence handling only, not a retained transaction. That is the existing phase-27 sentinel pattern (`crates/cadence/tests/phase27_plan.rs:394`), accurately labelled.

The case starts the actual binary, calls evidence-read, and requires an inconsistent answer naming the outstanding intent with no usable coherent-view input_digest (P2:204). After server exit, it opens and compares PLAN/state/JSONL/sentinel bytes directly, parses the real snapshot, and asserts the whole input tree unchanged; it never opens a recovering Filesystem/Store and disposes of the isolated copy only after assertions (P2:206–210).

The read-only exception remains explicit in the common protocol (P2:65), the case itself (P2:206), and Notes (P2:426), applying P1:85. This avoids recovery at writer startup (`crates/cadence/src/store/writer.rs:288`). No hook, retained-transaction acquisition, timed kill or false recovery claim was reintroduced. The separate real companion-process race remains bounded and does not depend on winning a specific scheduler interleaving (P2:423). This copied fixture is used only for readback, with no replacement requiring import writer admission.

**W2 remains resolved.**

## Structural invariants, leases and new-finding review

Both current files were compared against the original committed plan bytes at HEAD. The complete diff consists of the fixture setup/leases, historical C6 control, fixed-root ownership/mapping remedy and sentinel clarification already assessed here. Source remains unchanged.

| Requirement | Result |
|---|---|
| Truths byte-identical | PASS. Both complete “Must be true when done” sections match HEAD byte-for-byte. Each truth sentence with its continuation bytes matches approved phase-28 CONTEXT. Current anchors: P1:32, P2:33. |
| Seven checks | PASS. Five in P1, two in P2; all seven check IDs, file locators and function names unchanged. C6 still has one function containing its historical/replay controls (P2:101,452). |
| Commands unchanged | PASS. Every check Command and every task Verify command matches HEAD exactly, including artifact-inspection commands. One exact test and `1 passed; 0 failed` remain required (P1:90; P2:75). |
| Task ceiling | PASS. P1 has six tasks, P2 four, both within eight (P1:277–449; P2:248–345). The capture preparation remains part of the first schema task. |
| File lists | PASS. P1 has thirteen frontmatter paths; P2 fourteen. Every task-listed path is declared in its plan. The fixture lease is present at creation and read-only use. |
| Harness writes | PASS. The fixed root, marker and sibling lock are explicit temporary runtime inputs outside the repository/captured tree (P1:296,329). C6 harness code belongs in its already leased test file; no new committed script or dependency is required. |
| Sequencing | PASS. P1 precedes P2, all shared-source work is sequential (P1:472; P2:41,376). Capture precedes schema/helper edits; later restores use the captured bytes and the same fixed root. |
| Evidence discipline | PASS. Seven checks, eleven artifact items and one shared P28-O1 remain. No orphan evidence, unnecessary link, second check or function-level acceptance expansion was introduced. |
| O1 | PASS. Still supplementary to T1/T7, pending/not yet seen, specification provenance only (P1:151; P2:235); no fabricated observer/time/result. |
| Real boundaries/oracles | PASS. Actual binary, stdio, native approved truths, exact plan publication, real snapshot/filesystem and reopened assertions remain mandatory (P1:63,83; P2:55,65). The historical input is captured native authority; new map expected values stay handwritten. |
| Locked decisions/scope | PASS. Production obligations and seams remain unchanged: D-91 combined approval without a self-embedded plan digest; D-93 post-replacement union; D-94 current native ID/version refusals; D-95 authoritative digest/coherence readback; D-97 immutable supersession; D-98 receipt-first exact-payload replay. No relocation support, new writer or phase-29/12/13/26/30 functionality was added. |

All six review dimensions remain satisfied: requirements have tasks; tasks have concrete files/actions/verification; sequencing is explicit; artifacts and public wiring deliver the goal-backward truths; locked scope is preserved; the plan remains within the task ceiling without a new acceptance-test multiplier. The added lock is bounded fixture isolation needed for the fixed-root compatibility input, not tooling to police phase work.

## Per-truth evidence table

Every check remains in the creation-leased `crates/cadence/tests/phase28_evidence.rs`. Commands were inspected, not executed. Grouped artifact IDs retain the same truth prefix; both O1 entries refer to the same observation. The captured JSON is C6 setup data, not another check or standalone evidence item.

| Truth | Its one check | Other items | Command |
|---|---|---|---|
| T1: accepted map attached to published plan | P28-T1-C; `phase28_accepted_map_is_attached_to_published_plan` (P1:101) | P28-T1-A1/A2/A3 (P1:133,138,146); P28-O1 (P1:151) | `cargo test -p cadence --test phase28_evidence phase28_accepted_map_is_attached_to_published_plan -- --exact` (P1:128) |
| T2: uncovered current truth identified in refusal | P28-T2-C; `phase28_uncovered_current_truth_is_refused` (P1:168) | P28-T2-A1 (P1:189) | `cargo test -p cadence --test phase28_evidence phase28_uncovered_current_truth_is_refused -- --exact` (P1:185) |
| T3: current truth without check identified in refusal | P28-T3-C; `phase28_current_truth_without_check_is_refused` (P1:197) | P28-T3-A1 (P1:214) | `cargo test -p cadence --test phase28_evidence phase28_current_truth_without_check_is_refused -- --exact` (P1:210) |
| T4: item without bound-phase truth identified in refusal | P28-T4-C; `phase28_item_without_bound_truth_is_refused` (P1:221) | P28-T4-A1 (P1:241) | `cargo test -p cadence --test phase28_evidence phase28_item_without_bound_truth_is_refused -- --exact` (P1:237) |
| T5: noncurrent association identified in refusal | P28-T5-C; `phase28_noncurrent_truth_version_is_refused` (P1:249) | P28-T5-A1 (P1:269) | `cargo test -p cadence --test phase28_evidence phase28_noncurrent_truth_version_is_refused -- --exact` (P1:265) |
| T6: previous map marked superseded after republication | P28-T6-C; `phase28_republication_supersedes_previous_map` (P2:81), including historical absent-field control at P2:101 | P28-T6-A1/A2 (P2:152,159) | `cargo test -p cadence --test phase28_evidence phase28_republication_supersedes_previous_map -- --exact` (P2:147) |
| T7: authoritative saved set, associations and revisions returned | P28-T7-C; `phase28_readback_returns_authoritative_map_with_input_digest` (P2:170) | P28-T7-A1/A2 (P2:220,227); same P28-O1 (P2:235) | `cargo test -p cadence --test phase28_evidence phase28_readback_returns_authoritative_map_with_input_digest -- --exact` (P2:216) |

B1, W1 and W2 are resolved in the current plan text. No remaining omission was found that makes a truth unverifiable as planned. Actual historical capture, implementation, mapped check execution and artifact inspection remain subsequent work; O1 remains unseen.
