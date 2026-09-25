---
phase: 39
plan: 4
requirements: ["T5","T7"]
files: ["crates/cadence/src/review/instructions.rs","crates/cadence/src/review/provider/reviewer-brief.md","crates/cadence/src/instruction_lint.rs","skills/cad-review/SKILL.md","skills/cad-decision-review/SKILL.md","skills/cad-minimalism-review/SKILL.md","skills/cad-plan-review/SKILL.md","crates/cadence/src/verification/instructions.rs","skills/cad-verifier-contract/SKILL.md","skills/cad-verify/SKILL.md"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P39-4-T1","verify":["cargo nextest run -p cadence --bin cadence instruction_lint::plan_review_asks_the_test_questions","cargo nextest run -p cadence --bin cadence instruction_lint::plan_review_keeps_existing_completion_judgments"]},{"id":"P39-4-T2","verify":["cargo nextest run -p cadence --bin cadence instruction_lint::verifier_contract_states_what_is_not_evidence"]}]}
---
## Goal

Make plan reviewers ask the three test-quality questions and make verifiers distinguish actual execution from declarations, passing output and unsupported conclusions.

## Must be true when done

- T5. When a plan review is rendered, the reviewer sees requirement fidelity, assertion adequacy and whether a fake supplies the decision under test as the questions to answer.
- T7. When the verifier contract is rendered, the verifier sees that a test name, declaration, comment or model assertion is not execution evidence, that a passing run alone does not show the assertion tests the right behavior, and that an unsupported or inconclusive check is reported as such.

## Context

HEAD d8a9b140: crates/cadence/src/review/instructions.rs:12 is PLAN, selected by intent for an ordinary plan trigger (:20) and intent_for(Kind::Plan) (:31). frontdoor_markdown (:43) includes all three intents in every alias (:147), so all of cad-review, cad-decision-review, cad-minimalism-review and cad-plan-review carry PLAN. crates/cadence/src/review/invoking.rs:22 composes the local dispatch with intent(admission); crates/cadence/src/review/provider/payload.rs:9 embeds reviewer-brief.md as BRIEF, :12 returns those exact compiled bytes through brief(), and :29 inserts BRIEF and intent(admission) in provider instructions. The brief's :39 plan line has requirement fidelity but no assertion/fake questions. No registered rendered-file ceiling pins the brief: crates/cadence/src/instruction_lint.rs:170 checks only crates/cadence/src/execution/render.rs:160's 24 registered files. The brief is in the name-lint corpus at crates/cadence/src/instruction_lint.rs:43 and the assembled provider prompt retains its existing check_cap (crates/cadence/src/review/provider/payload.rs:128); no provider behavior is changed here.

crates/cadence/src/verification/instructions.rs:2 already rejects a check that could not have failed; :35 says never fake the promised boundary; :51 requires actual observations and :62 assertion strength; :65 retains the observation cap. contract_markdown at :118 and frontdoor_markdown at :185 both include PROTOCOL. This plan adds explicit evidence limits there and preserves those credited rules. crates/cadence/src/execution/history.rs:1171 already requires closed tasks, owner check inspections and suite/risk settlement for plan completion; crates/cadence/src/verification/completion.rs:246 requires a current patch and :258 met or waived truths. They are traced, not modified. The local dispatch and provider consumers confirm the context's assumption that changing PLAN reaches plan reviewers; no extra dispatch mechanism is necessary. The reviewer brief has no rendered-file byte ceiling, confirming assumption 2, though the assembled payload remains token-capped.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "check/plan_review_asks_the_test_questions",
      "spec": {
        "command": "cargo nextest run -p cadence --bin cadence instruction_lint::plan_review_asks_the_test_questions",
        "expected": {
          "kind": "literal",
          "value": "Each of the four review front doors and intent_for(Kind::Plan) contain the first exact block; payload::brief() contains the second exact block:\n\nFor each proposed test, ask: does it serve the approved requirement, can its assertion catch the defect it names, and does a fake provide the very decision being tested? Judge the fake relative to the responsibility the test exercises, using plain inputs where they suffice.\n\n  For its tests, ask whether each serves the approved requirement, whether the\n  assertion can expose the stated defect, and whether a fake supplies the\n  decision the test is meant to exercise. Assess the fake relative to the\n  responsibility that test exercises, not merely the type of value it returns."
        },
        "test": {
          "file": "crates/cadence/src/instruction_lint.rs",
          "function": "plan_review_asks_the_test_questions"
        },
        "setup": "Hand-list cad-review, cad-decision-review, cad-minimalism-review and cad-plan-review. Call cadence::review::instructions::frontdoor_markdown for each (crates/cadence/src/review/instructions.rs:43); use cadence::review::provider::payload::brief() (:12 in payload.rs), the production accessor for the exact BRIEF embedded in prepare at :29. Handwrite the two respective wording blocks below in the test. No Admission/Attempt workflow, retained material store, provider or clock is needed.",
        "call": "Render each front door and get the compiled brief in-process. Assert the appropriate complete handwritten question block in each, naming the carrier on failure. This checks delivery of one plan-review question policy across its carriers, not whether a fabricated bad plan fools a checker. Also call cadence::review::instructions::intent_for(Kind::Plan) (crates/cadence/src/review/instructions.rs:31) and assert the first block in its result, because local_dispatch and prepare build the reviewer's prompt through intent(), not through the front door.",
        "boundary": "compiled plan-review question composition: review front doors and the provider's embedded brief",
        "fakes": []
      },
      "reason": "Detects missing requirement fidelity, assertion adequacy or fake-decision questions on any review front door or on the compiled provider brief; prevents a one-carrier-only change.",
      "associations": [
        {
          "truth_id": "T5",
          "truth_version": 1,
          "reason": "The three plan-test questions are composed for review readers by the same compiled intent and provider brief; actual reviewer conduct is phase 18's."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/p39-4/review-questions",
      "spec": {
        "locators": [
          "crates/cadence/src/review/instructions.rs",
          "crates/cadence/src/review/provider/reviewer-brief.md"
        ],
        "substance": "PLAN preserves its existing goal/truth/locked-decision sentence and gains the exact questions and completion-judgment sentence in task 1. The brief's plan bullet gains its own wording. intent, intent_for, local_dispatch and prepare continue to consume the existing fragments. No prepublication review gate, provider renderer refactor or new record is added; required owner/verifier completion judgments stay on the existing gates."
      },
      "reason": "Editing only a hand-authored review skill or only one source fragment would leave a reviewer without the questions.",
      "associations": [
        {
          "truth_id": "T5",
          "truth_version": 1,
          "reason": "The three plan-test questions are composed for review readers by the same compiled intent and provider brief; actual reviewer conduct is phase 18's."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/p39-4/rendered-review",
      "spec": {
        "locators": [
          "skills/cad-review/SKILL.md",
          "skills/cad-decision-review/SKILL.md",
          "skills/cad-minimalism-review/SKILL.md",
          "skills/cad-plan-review/SKILL.md"
        ],
        "substance": "All four files exactly equal their debug renderers at completion: review-instructions and its --alias forms. Projected bytes: cad-review 10,258 -> 10,768; cad-decision-review 10,152 -> 10,662; cad-minimalism-review 10,235 -> 10,745; cad-plan-review 10,162 -> 10,672. Each unchanged ceiling is 12,288. The compiled brief is 2,692 -> projected 2,998 bytes, with no registered rendered-file ceiling. Actual measurements belong in the executor handoff."
      },
      "reason": "A stale alias or altered byte ceiling breaks the delivered instruction contract.",
      "associations": [
        {
          "truth_id": "T5",
          "truth_version": 1,
          "reason": "The three plan-test questions are composed for review readers by the same compiled intent and provider brief; actual reviewer conduct is phase 18's."
        }
      ]
    },
    {
      "kind": "check",
      "id": "check/verifier_contract_states_what_is_not_evidence",
      "spec": {
        "command": "cargo nextest run -p cadence --bin cadence instruction_lint::verifier_contract_states_what_is_not_evidence",
        "expected": {
          "kind": "literal",
          "value": "Both verifier renderers contain the exact following block:\n\nKeep the stages of evidence distinct: planned, written, reviewed, executed and\npassed. A test name, declaration, comment or model assertion is not evidence\nthat a test executed. A passing run alone does not establish that its assertion\nexamines the required behavior. Inspect the actual assertion against its\nrequirement and named defect, including whether a fake supplies the decision.\n\nNames, type labels, declared boundaries, source patterns and a passing runner\ndo not prove semantic correctness or the absence of indirect dependencies.\nReport an unsupported or inconclusive check with that limitation; never turn\nincomplete analysis into a compliance claim. Record rejected\nwhen a check ran but does not establish the behavior, and not_seen only when\nthe evidence was unavailable, stating what was observed; never invent a new\nstatus or accept unsupported evidence."
        },
        "test": {
          "file": "crates/cadence/src/instruction_lint.rs",
          "function": "verifier_contract_states_what_is_not_evidence"
        },
        "setup": "Use cadence::verification::instructions::contract_markdown and frontdoor_markdown at crates/cadence/src/verification/instructions.rs:118 and :185. Handwrite this task's evidence block as the expected literal. No check run, records, files or verdict workflow is supplied.",
        "call": "Render both production verifier surfaces in-process and assert the full literal block, reporting the carrier when missing. Do not infer evidence from a test's name or feed invented plans to a test-only classifier.",
        "boundary": "verification::instructions rendering: disclosure of what is and is not sufficient evidence",
        "fakes": []
      },
      "reason": "Detects a missing execution-evidence distinction, an instruction equating passing output with adequate assertions, an unsupported-compliance claim, or a surface that drops the limitations.",
      "associations": [
        {
          "truth_id": "T7",
          "truth_version": 1,
          "reason": "The actual verifier renderers carry the evidence distinctions and unsupported/inconclusive limitation; they make no semantic-compliance decision themselves."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/p39-4/verifier-evidence-policy",
      "spec": {
        "locators": [
          "crates/cadence/src/verification/instructions.rs"
        ],
        "substance": "PROTOCOL contains the exact evidence block in task 2 before Record an observation. VERIFIER, the existing promised-boundary instruction, assertion-strength requirement, status sentence, verdict fields and runner grammar stay intact. Unsupported/inconclusive is explanatory text attached to existing verdicts, never a new status or a compliance classifier."
      },
      "reason": "A weak evidence statement or new invented verdict would contradict D-229 and the existing protocol.",
      "associations": [
        {
          "truth_id": "T7",
          "truth_version": 1,
          "reason": "The actual verifier renderers carry the evidence distinctions and unsupported/inconclusive limitation; they make no semantic-compliance decision themselves."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/p39-4/rendered-verifier",
      "spec": {
        "locators": [
          "skills/cad-verifier-contract/SKILL.md",
          "skills/cad-verify/SKILL.md"
        ],
        "substance": "Each file exactly equals target/debug/cadence verifier-instructions with its respective --frontdoor option at completion. Projected bytes: cad-verifier-contract 14,381 -> 15,253; cad-verify 14,255 -> 15,127. Each unchanged ceiling is 18,432. Report actual before/after sizes and rendered byte identity."
      },
      "reason": "An unregenerated verifier skill would still lack the evidence limitation, and raising its ceiling would violate D-232.",
      "associations": [
        {
          "truth_id": "T7",
          "truth_version": 1,
          "reason": "The actual verifier renderers carry the evidence distinctions and unsupported/inconclusive limitation; they make no semantic-compliance decision themselves."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Publish the three plan-review questions on every carrier, red then green

- **ID:** P39-4-T1
- **Files:** crates/cadence/src/review/instructions.rs, crates/cadence/src/review/provider/reviewer-brief.md, crates/cadence/src/instruction_lint.rs, skills/cad-review/SKILL.md, skills/cad-decision-review/SKILL.md, skills/cad-minimalism-review/SKILL.md, skills/cad-plan-review/SKILL.md
- **Action:** After PLAN-3 closes, add plan_review_asks_the_test_questions and plan_review_keeps_existing_completion_judgments to the tests-only crates/cadence/src/instruction_lint.rs. The check is exactly the evidence specification. The constituent calls cadence::review::instructions::frontdoor_markdown("cad-plan-review") and asserts the exact completion-judgment sentence below; it catches the advisory sentence being dropped or reworded, or the owner and verifier judgments going unnamed; it cannot detect a gate added in plan-submit code. It tests new instruction text, not the old gate implementations. Neither test invokes a reviewer, reads a retained file or tests a linter with made-up bad input.

Commit both tests with the existing compiling production text before the check's red run. Red must be an assertion failure on absent wording. Do not edit instruction_lint.rs again before this task's completion commit. Task 2 can append only after task 1 closes.

In PLAN at crates/cadence/src/review/instructions.rs:12, keep the existing first sentence, insert these exact two blocks immediately before "Return findings; edit nothing.", separated by single spaces in the string:

For each proposed test, ask: does it serve the approved requirement, can its assertion catch the defect it names, and does a fake provide the very decision being tested? Judge the fake relative to the responsibility the test exercises, using plain inputs where they suffice.

These questions are advisory to plan submission and add no plan-submit gate. The owner's exact check inspection at execution-plan-complete and the verifier's item verdicts at verification-complete remain required completion judgments.

Append the following exact lines to the existing For a plan bullet at crates/cadence/src/review/provider/reviewer-brief.md:39, preserving the old two lines and the two-space continuation indentation:

  For its tests, ask whether each serves the approved requirement, whether the
  assertion can expose the stated defect, and whether a fake supplies the
  decision the test is meant to exercise. Assess the fake relative to the
  responsibility that test exercises, not merely the type of value it returns.

Read the existing intent -> local_dispatch and intent/BRIEF -> prepare consumers to confirm the changed fragment reaches both, but do not refactor or drive those workflows in tests. brief() already exposes the precise compiled provider fragment; no new accessor is required.

Record green using the identical check command. Build with RUSTC_WRAPPER= cargo build -p cadence -j 6, then regenerate skills/cad-review/SKILL.md with target/debug/cadence review-instructions and the other three files with target/debug/cadence review-instructions --alias cad-decision-review, --alias cad-minimalism-review and --alias cad-plan-review, respectively. Report each actual before/after size and equality with its renderer. Each stays below 12,288; the projected sizes are in this plan's notes. Measure the brief itself too (2,692 -> projected 2,998); it is compiled source, not a generated file. Run both new named verifies at completion with instruction_lint.rs unchanged since red.
- **Verify:**
  - cargo nextest run -p cadence --bin cadence instruction_lint::plan_review_asks_the_test_questions
  - cargo nextest run -p cadence --bin cadence instruction_lint::plan_review_keeps_existing_completion_judgments

### Task 2: State the verifier's evidence limits, red then green

- **ID:** P39-4-T2
- **Files:** crates/cadence/src/verification/instructions.rs, crates/cadence/src/instruction_lint.rs, skills/cad-verifier-contract/SKILL.md, skills/cad-verify/SKILL.md
- **Action:** Only after P39-4-T1 closes, add verifier_contract_states_what_is_not_evidence to the tests-only crates/cadence/src/instruction_lint.rs. Use both production verifier renderers and handwrite the entire literal block below. Commit this task's one test with the unchanged compiling verifier source before red. Observe an assertion failure, then freeze instruction_lint.rs through this task's completion commit; do not alter the already closed review tests.

Insert this exact block, followed by one blank line, before "Record an observation as seen or not seen, by whom and when, in observed." at crates/cadence/src/verification/instructions.rs:64:

Keep the stages of evidence distinct: planned, written, reviewed, executed and
passed. A test name, declaration, comment or model assertion is not evidence
that a test executed. A passing run alone does not establish that its assertion
examines the required behavior. Inspect the actual assertion against its
requirement and named defect, including whether a fake supplies the decision.

Names, type labels, declared boundaries, source patterns and a passing runner
do not prove semantic correctness or the absence of indirect dependencies.
Report an unsupported or inconclusive check with that limitation; never turn
incomplete analysis into a compliance claim. Record rejected
when a check ran but does not establish the behavior, and not_seen only when
the evidence was unavailable, stating what was observed; never invent a new
status or accept unsupported evidence.

Keep the existing VERIFIER, promised-boundary sentence, actual-output/assertion-strength rule and truth-status sentence. Do not add a status, runner integration, test-dependency scanner or new gate. The text uses rejected or not_seen with observed limitations in the current protocol; it cannot mechanically classify assertion semantics.

Record green with the identical check command. Build with RUSTC_WRAPPER= cargo build -p cadence -j 6 and regenerate skills/cad-verifier-contract/SKILL.md from target/debug/cadence verifier-instructions and skills/cad-verify/SKILL.md from target/debug/cadence verifier-instructions --frontdoor. Measure and report actual before/after sizes and byte identity (projected 14,381 -> 15,253 and 14,255 -> 15,127, each under 18,432). Run this task's new named verify at completion, retaining identical check-file bytes at red, green and completion.
- **Verify:**
  - cargo nextest run -p cadence --bin cadence instruction_lint::verifier_contract_states_what_is_not_evidence

## Notes

D-228, D-229, D-230, D-232. Task 1's check exercises only delivery of the plan-review questions through four compiled front doors and the exact embedded provider brief; it catches any missing carrier or question. Its constituent separately pins the new advisory/completion-judgment statement. No review result is fabricated and no fake or checker is tested. Task 2's check exercises only verifier instruction composition; it catches declarations called execution, passing output called adequate assertions or unsupported analysis called compliance. Local dispatch and provider prepare consumers are read, not run; the check sees brief()'s embedded source fragment, not the complete provider payload, framing or transport. This is an explicit limit of the starting check, avoiding a complete provider workflow.

Rendered byte sizes before -> projected after: cad-review 10,258 -> 10,768; cad-decision-review 10,152 -> 10,662; cad-minimalism-review 10,235 -> 10,745; cad-plan-review 10,162 -> 10,672, all of 12,288. The brief source is 2,692 -> 2,998, with no rendered-file ceiling. cad-verifier-contract 14,381 -> 15,253 and cad-verify 14,255 -> 15,127, each of 18,432. Other rendered surfaces are unaffected. The provider's overall existing token cap is unchanged; absence of a brief-file ceiling is not absence of a payload cap.

Unverified: whether real Codex and Claude reviewers raise a fake that supplies the decision, and whether agents follow the evidence rules, remain live work in phase 18. No end-to-end review, provider transport, execution completion or verification completion is run by these tests. D-228 does not recast existing owner inspection as a mechanically proven assertion-quality review; the binary holds the required records, while people/models judge their adequacy. Non-Rust independent verification stays limited to the current cargo/nextest recognition (crates/cadence/src/verification/runner.rs:46); the milestone 13 issue is proposed to the owner before filing, not filed by this plan.

Execution order is PLAN-1, PLAN-2, PLAN-3, PLAN-4, one hand dispatch per plan. These are changes to the product instructions for managed projects; the owner's 2026-09-22/23 development rules govern the Rust tests requested here. Tests call the actual production function in-process with supplied values, no process, filesystem, clock, Store writer or live state. They never launch Cadence, git or another test executable. No fake supplies the decision, no tests of a checker or fake are added, and expected text is handwritten from the approved requirement, not imported from a production constant. Existing adequate tests stay in the close suite; no test retrofit is authorized.

Run builds and tests on the owner's six-core allocation. Only the task's named narrow commands run while working; the full close-suite command remains exactly cargo nextest run --workspace --no-fail-fast. Instruction tasks build with RUSTC_WRAPPER= cargo build -p cadence -j 6 after the source change, then regenerate only their affected files from target/debug/cadence using the listed commands, never by hand. Rendering and comparing generated bytes are artifact work, not unit tests or extra verify commands. Preserve the existing name lint and all 24 literal byte ceilings at crates/cadence/src/instruction_lint.rs:172; before committing tests, if any surface would overflow, cut this phase's new prose rather than raise a ceiling and report the revised text and sizes for owner review. Once red has run, the file freeze still applies; a necessary change to test expectations must be reported as a blocked task rather than hidden in green. The name lint at crates/cadence/src/instruction_lint.rs:71 checks config keys, wire operations, skills and hook events. Contrary to the supplied known-fact description, HEAD does not implement general repository-path validation (its candidate loop and authority match have only those four kinds); do not claim that it does.

The byte figures below are HEAD rendered-file measurements and exact projections from replacing the literal blocks specified in this plan in memory. No post-change binary was built by the planner. The executor must measure actual before/after UTF-8 sizes and byte identity to the debug renderer at completion, and report any difference. Existing compiled_instructions_name_only_what_exists and rendered_files_obey_named_byte_ceilings are left unchanged and run in the close suite, not in a task verify that would pass without this work. Each task's tests-only file remains frozen from its red commit through that task's completion; later tasks may append only after the owning task closes.

No architecture document is edited (P3), no hand-authored 3.x skill or agent is edited (P4), and no runner, schema, status reducer or completion gate changes. P1's observation-cap wording and P2's non-Rust verification remain parked. D-230 keeps MANIFESTS, including its managed-project Python row; no Python is added to Cadence code, tests, grammar or contracts. Propose the non-Rust verification limitation as a milestone 13 issue to the owner before anyone files it; this plan does not file it. No observation or link item is added: these truths promise the compiled text or one local refusal, and the specified live episodes belong to phase 18. At handoff state the exercised behaviors, meaningful defects, actual commands/results and anything unverified; unit passage is not assembled-workflow proof.

Require the named filter to select its one intended test; zero selected tests are not a passing verification. The planner executed only the existing release plan-instructions command, read-only queries/reads and in-memory size calculations; no build, Rust test, clippy run, approval, publication or tracked edit occurred in authoring.
