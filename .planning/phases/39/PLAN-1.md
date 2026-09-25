---
phase: 39
plan: 1
requirements: ["T6"]
files: ["crates/cadence/src/plan/limits.rs","crates/cadence/src/plan/limits_tests.rs","crates/cadence/src/plan/instructions.rs","skills/cad-plan/SKILL.md"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P39-1-T1","verify":["cargo nextest run -p cadence --lib plan::limits_tests::a_check_with_a_blank_test_file_is_refused","cargo nextest run -p cadence --lib plan::limits_tests::plan_instructions_require_a_test_file"]}]}
---
## Goal

Refuse a blank check test file in the existing content decision before plan approval, and make the planner's admission and repair text describe that refusal.

## Must be true when done

- T6. When a plan is submitted with a check whose test file is blank, the submitter is refused with a typed refusal naming that check's slot.

## Context

Grounded at HEAD d8a9b14080a043d61e222b5ae40c70ad9e085933, branch cadence/binary-owns-process; its source matches phase 40's 2e55fd13. crates/cadence/src/plan/limits.rs:110 walks every current item of every Contribution and checks command and expected.value with trim().is_empty(); base at :103 gives proposed submission slots or saved current-plan slots. malformed at :8 refines undecodable shapes, not blank content. crates/cadence/src/plan/evidence.rs:49 carries the test locator as strings. crates/cadence/src/plan/associations.rs:136 constructs the candidate from current publication/map records, removing replacements and released definitions, and :282 calls limits::content on the attached union; crates/cadence/src/plan/model.rs:312 packages a Diagnostic as a plan-refusal and :316 gives it the invalid-plan envelope. crates/cadence/src/plan/limits_tests.rs:52 already accepts a nonblank file; :59 and :72 test the existing blank-command and expected rules. crates/cadence/src/plan/mod.rs:13 declares limits_tests under cfg(test), in the library (crates/cadence/src/lib.rs:31); crates/cadence/src/main.rs:6 declares instruction_lint under cfg(test), in the binary. crates/cadence/src/plan/instructions.rs:146 currently says the test locator may be blank, and :324 omits it from old-policy union failures; :443 bars reviewer dispatch at this authoring front door. runner.rs is not changed: crates/cadence/src/execution/runner.rs:367 already refuses an empty locator with 'committed check test locator required'. It checks is_empty there, not trim; the new whitespace refusal is explicitly this planning policy.

Saved-record confirmation: .planning/state.json's current plan_publications has 60 publications over phases 14, 15, 16, 17, 31, 32, 33, 34, 36, 37, 38 and 40. Joining each nonnull map_revision to the same phase's acceptance_maps revision, the 75 check entries all have nonblank test files, including those subsequently excluded by release filtering. Thus the candidate's retained subset also has none. No published PLAN-*.md search match for a blank file was found, but the saved records, not that Markdown search, establish compatibility. Native evidence-read for phase 39 returns no contributions/items; this phase's union has nothing saved to migrate.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "check/a_check_with_a_blank_test_file_is_refused",
      "spec": {
        "command": "cargo nextest run -p cadence --lib plan::limits_tests::a_check_with_a_blank_test_file_is_refused",
        "expected": {
          "kind": "literal",
          "value": "For each test.file value \"\" and \"   \", content returns a plan-refusal Diagnostic with rule \"check-test-file\", slot \"submission.plans[1].content.evidence_map.items[1].spec.test.file\", phase 39, entry 1, id \"check/blank\", and reason \"phase 39 item check/blank needs nonblank test.file\"."
        },
        "test": {
          "file": "crates/cadence/src/plan/limits_tests.rs",
          "function": "a_check_with_a_blank_test_file_is_refused"
        },
        "setup": "Use the supplied-value fixtures check, proposed and refusal at crates/cadence/src/plan/limits_tests.rs:15, :42 and :46. Build proposed plan 3 at submission entry 1, with a nonblank artifact at item 0 and check/blank at item 1 associated with T6 version 1. Its command and expected value are nonblank. In two independent cases set only spec.test.file to the empty string and three spaces. All other fields keep their typed values. No store, snapshot, disk or clock is consulted.",
        "call": "Call plan::limits::content(39, &[contribution]) directly (crates/cadence/src/plan/limits.rs:110), extract its typed diagnostic with the existing refusal helper and compare the fields to the literal values. Do not call plan-submit, validate_candidate or a command handler. The existing a_complete_check_and_link_meet_the_content_rules at crates/cadence/src/plan/limits_tests.rs:52 supplies the nonblank-file control in the close suite, separately from this refusal behavior.",
        "boundary": "plan::limits::content: refusal and precise location of a blank check test file in proposed contributions",
        "fakes": []
      },
      "reason": "Catches accepting an empty or whitespace-only file, or reporting the wrong rule, item index, submission entry or check id. Expected slots and reason are literal values, never computed with base().",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "This is the exact supplied-value content decision used by fresh attached publication; its error identifies the blank check before approval. The publication wiring is inspected as an artifact, not exercised through the Store."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/p39-1/test-file-refusal",
      "spec": {
        "locators": [
          "crates/cadence/src/plan/limits.rs"
        ],
        "substance": "content checks spec.test.file after command and expected.value, trims only for emptiness, emits check-test-file at the exact spec.test.file slot with item id and origin, and otherwise preserves submitted bytes and existing policy. Existing associations::validate_union reaches it for the candidate. malformed and the wire grammar are unchanged; saved records are neither rewritten nor grandfathered."
      },
      "reason": "A new guard outside the union, a generic unlocated error, or acceptance of whitespace breaks this artifact.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "The refusal's production implementation and existing publication/admission call path are the substance behind the unit check."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/p39-1/planner-refusal-text",
      "spec": {
        "locators": [
          "crates/cadence/src/plan/instructions.rs"
        ],
        "substance": "The four exact blocks in the task describe check-test-file, correct the blank-locator disclosure, locate the repair and include saved blank files in union failures. Tested by plan_instructions_require_a_test_file."
      },
      "reason": "A stale legal-blank statement contradicts the new refusal and misleads the planner.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "The submitter is told what blank test-file content is refused and which slot to correct."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/p39-1/rendered-plan",
      "spec": {
        "locators": [
          "skills/cad-plan/SKILL.md"
        ],
        "substance": "Byte-identical to target/debug/cadence plan-instructions at completion; 49,603 bytes at HEAD, projected 50,026 after the exact edits, under the unchanged 57,344 ceiling. Actual before/after sizes and renderer equality reported by the executor."
      },
      "reason": "An unregenerated skill would keep telling the host that blank test locators are legal.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "The managed-project planner reads the installed skill carrying the refusal contract."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Refuse blank check test files and correct the planner text, red then green

- **ID:** P39-1-T1
- **Files:** crates/cadence/src/plan/limits.rs, crates/cadence/src/plan/limits_tests.rs, crates/cadence/src/plan/instructions.rs, skills/cad-plan/SKILL.md
- **Action:** Read this plan's HEAD findings before changing code. In crates/cadence/src/plan/limits_tests.rs add a_check_with_a_blank_test_file_is_refused exactly as its check specifies. Add no saved-origin case: the new rule joins the shared loop that already refuses saved contributions, which the existing a_check_without_a_command_is_refused_at_its_own_slot (:59) and a_check_expecting_nothing_is_refused (:72) exercise at saved slots. Keep the nonblank-file acceptance behavior in the adequate existing a_complete_check_and_link_meet_the_content_rules (:52); do not duplicate it or put an unchanged test in verify.

In the same crates/cadence/src/plan/limits_tests.rs add plan_instructions_require_a_test_file, so the binary's red-to-completion freeze of the check's test file covers it (D-227). Call cadence::plan::instructions::markdown() (crates/cadence/src/plan/instructions.rs:495) in-process and assert the four handwritten blocks below; also assert that the old sentence "Only command and expected output are content-checked on a check.", the old blank-locator permission beginning "Test locator," and the old union clause "blank command/output" are all absent. This detects prose that still permits a blank file or fails to tell the owner how to correct the new refusal. Expected text must be literals in the test, not copied from a production constant at runtime.

Commit both tests, with the existing compiling production functions still unchanged, before the task's red run. Run the allocated check and observe an assertion failure, not a build failure; the content function currently returns Ok for its blank-file cases. Do not edit plan/limits_tests.rs again before this task's completion commit. A later plan can append after this task closes.

Then in crates/cadence/src/plan/limits.rs:115 extend the existing (value, rule, field) list after expected.value with (&spec.test.file, "check-test-file", "test.file"). Reuse the same trim, Diagnostic construction, item id, phase, entry and base; no new validator or schema. Keep malformed (:8) and shape_field (:52) unchanged: a missing or mistyped test file remains evidence-item-shape, whereas typed blank content gets check-test-file. Keep all other check fields unparsed. The same loop covers proposed and saved current contributions. Record green using exactly the check command used for red.

In crates/cadence/src/plan/instructions.rs insert the following bullet after check-expected and before truth-check-limit (:137); replace the complete old content-disclosure paragraph (:146); add the repair bullet before the truth-check-limit repair (:386); replace the old-policy blank-command/output clause (:324) with the fourth block. Keep the rest of the role unchanged.

- `check-test-file`: the check's test file must contain non-whitespace text. The refusal names its test-file slot; this establishes a locator, not that the file exists or contains an adequate test.

Command, expected output and the test file are content-checked on a check. The
test function, setup, call, boundary and fakes keep their typed grammar; blank
strings in those fields and an empty fakes array remain legal. This describes
mechanical admission, not permission to omit the one-unit shape above. Cadence
does not infer test style or assertion strength. Test existence, task/check
bindings, red/green receipts and subject-stub gates belong to execution;
adequacy belongs to the owner and verifier.

- `check-test-file`: supply a nonblank test file at the named item's test-file slot. Whitespace alone is blank; a missing or mistyped file remains an evidence-item-shape failure.

so an old-policy blank command, expected output or test file, an extra check or
an unnamed link blocks that union.

Build the debug binary with RUSTC_WRAPPER= cargo build -p cadence -j 6, then regenerate skills/cad-plan/SKILL.md from target/debug/cadence plan-instructions in this task. Measure before/after and compare generated bytes outside tests; expected 49,603 -> 50,026 bytes, ceiling 57,344. No other renderer reaches these edits. Run the two new named verifies at completion; the close suite separately reuses existing command, expected, typed-shape and valid-content tests. Report the actual red/green/completion test-file digests and unchanged command.
- **Verify:**
  - cargo nextest run -p cadence --lib plan::limits_tests::a_check_with_a_blank_test_file_is_refused
  - cargo nextest run -p cadence --lib plan::limits_tests::plan_instructions_require_a_test_file

## Notes

D-231 first, so later instructional plans describe an implemented refusal. The allocated check exercises only limits::content's blank-file refusal at a proposed item slot. The text constituent, in the same frozen test file, exercises only plan rendering; saved contributions pass through the same content loop the existing saved-slot tests exercise. The nonblank control and pre-existing command/expected failures are reused in the close suite. After its test is added, each new verify must fail against unchanged HEAD production; no authoring test run is claimed, and none drives a publication workflow. No new case tests a fake or a test checker.

Rendered size: cad-plan 49,603 -> projected 50,026 of 57,344 bytes. Only that rendered file changes; PLAN-2 leases it and plan/instructions.rs again after this plan closes. The mechanical refusal is established in-process; the public service, publication transaction, admission and real-host repair conversation are traced, not executed by this check. No semantic file existence, tests-only layout or assertion-quality validator is added. Host behavior belongs to phase 18.

Execution order is PLAN-1, PLAN-2, PLAN-3, PLAN-4, one hand dispatch per plan. These are changes to the product instructions for managed projects; the owner's 2026-09-22/23 development rules govern the Rust tests requested here. Tests call the actual production function in-process with supplied values, no process, filesystem, clock, Store writer or live state. They never launch Cadence, git or another test executable. No fake supplies the decision, no tests of a checker or fake are added, and expected text is handwritten from the approved requirement, not imported from a production constant. Existing adequate tests stay in the close suite; no test retrofit is authorized.

Run builds and tests on the owner's six-core allocation. Only the task's named narrow commands run while working; the full close-suite command remains exactly cargo nextest run --workspace --no-fail-fast. Instruction tasks build with RUSTC_WRAPPER= cargo build -p cadence -j 6 after the source change, then regenerate only their affected files from target/debug/cadence using the listed commands, never by hand. Rendering and comparing generated bytes are artifact work, not unit tests or extra verify commands. Preserve the existing name lint and all 24 literal byte ceilings at crates/cadence/src/instruction_lint.rs:172; before committing tests, if any surface would overflow, cut this phase's new prose rather than raise a ceiling and report the revised text and sizes for owner review. Once red has run, the file freeze still applies; a necessary change to test expectations must be reported as a blocked task rather than hidden in green. The name lint at crates/cadence/src/instruction_lint.rs:71 checks config keys, wire operations, skills and hook events. Contrary to the supplied known-fact description, HEAD does not implement general repository-path validation (its candidate loop and authority match have only those four kinds); do not claim that it does.

The byte figures below are HEAD rendered-file measurements and exact projections from replacing the literal blocks specified in this plan in memory. No post-change binary was built by the planner. The executor must measure actual before/after UTF-8 sizes and byte identity to the debug renderer at completion, and report any difference. Existing compiled_instructions_name_only_what_exists and rendered_files_obey_named_byte_ceilings are left unchanged and run in the close suite, not in a task verify that would pass without this work. Each task's tests-only file remains frozen from its red commit through that task's completion; later tasks may append only after the owning task closes.

No architecture document is edited (P3), no hand-authored 3.x skill or agent is edited (P4), and no runner, schema, status reducer or completion gate changes. P1's observation-cap wording and P2's non-Rust verification remain parked. D-230 keeps MANIFESTS, including its managed-project Python row; no Python is added to Cadence code, tests, grammar or contracts. Propose the non-Rust verification limitation as a milestone 13 issue to the owner before anyone files it; this plan does not file it. No observation or link item is added: these truths promise the compiled text or one local refusal, and the specified live episodes belong to phase 18. At handoff state the exercised behaviors, meaningful defects, actual commands/results and anything unverified; unit passage is not assembled-workflow proof.

Require the named filter to select its one intended test; zero selected tests are not a passing verification. The planner executed only the existing release plan-instructions command, read-only queries/reads and in-memory size calculations; no build, Rust test, clippy run, approval, publication or tracked edit occurred in authoring. The CONTEXT starting check's nonblank control is deliberately reused as an independent existing test, honoring the owner's split-behaviors and adequate-evidence rulings; the new check only owns the blank-file refusal.
