---
phase: 39
plan: 2
requirements: ["T2","T3","T4"]
files: ["crates/cadence/src/plan/instructions.rs","crates/cadence/src/execution/instructions.rs","crates/cadence/src/instruction_lint.rs","skills/cad-plan/SKILL.md","skills/cad-executor-contract/SKILL.md"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P39-2-T1","verify":["cargo nextest run -p cadence --bin cadence instruction_lint::plan_instructions_derive_tests_from_behavior","cargo nextest run -p cadence --bin cadence instruction_lint::plan_instructions_bound_test_dependencies","cargo nextest run -p cadence --bin cadence instruction_lint::plan_instructions_state_the_close_rule","cargo nextest run -p cadence --bin cadence instruction_lint::plan_instructions_keep_live_verification_open"]}]}
---
## Goal

Teach the planner to derive bounded tests from approved behavior, state their language and dependency limits, and disclose the actual whole-file close rule to planners and phase executors.

## Must be true when done

- T2. When the plan instructions are rendered, the planner sees tests derived from approved behavior, one responsibility and one behavior each with at most one simulated seam, expected values taken from the requirement, every case naming the defect it catches, and no case added that catches nothing new.
- T3. When the plan instructions are rendered, the planner sees that a test depends only on the project's language toolchain and that language's own test libraries, starts no program, gives the same result on any machine where the project builds, and may use a fresh temporary directory it creates as its filesystem seam.
- T4. When the plan instructions are rendered, the planner sees that a check's test file holds only tests, that every test of the task is committed before red, and that the file's bytes must be identical at the red commit, the green commit and the task's completion.

## Context

At HEAD d8a9b140, crates/cadence/src/plan/instructions.rs:18 is the one-check-per-truth Planner paragraph and :108 and :116 already require one unit, named fakes, no programs and separated asking/judging. These are credited and kept. :495 renders the complete plan surface. crates/cadence/src/execution/instructions.rs:66 describes red/green only as 'both on unchanged test material'. crates/cadence/src/execution/receipts.rs:475 compares file path, whole-file digest and command; :482 also requires the completion blob digest to equal green. The code already enforces these conditions; this plan adds disclosure only. crates/cadence/src/execution/runner.rs:349 resolves the admitted check's file, and material at :303 captures its committed bytes.

Carrier inspection at HEAD: crates/cadence/src/execution/instructions.rs:375 includes PROTOCOL only in Scope::Phase. contract_markdown at :389 uses it; frontdoor_markdown at :394 uses FRONTDOOR, shared read text and USABILITY, not PROTOCOL. crates/cadence/src/task/instructions.rs:75 calls role_text(Scope::Task), which uses TASK_PROTOCOL. Thus the changed :66 paragraph reaches cad-executor-contract and dispatch_text, but neither cad-execute (16,160 bytes) nor cad-task (12,954 bytes). They are read and confirmed unchanged, not leased or regenerated here. MANIFESTS at crates/cadence/src/execution/instructions.rs:417 has four rows including the managed-project Python vocabulary, as D-230 keeps. All rendered paths/commands are registered at crates/cadence/src/execution/render.rs:160. instruction_lint is tests-only through crates/cadence/src/main.rs:6; compiled_contracts_locate_first at crates/cadence/src/instruction_lint.rs:208 is the in-process handwritten-literal precedent. PLAN-1 will have implemented check-test-file and corrected crates/cadence/src/plan/instructions.rs:146; retain that work.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "check/plan_instructions_derive_tests_from_behavior",
      "spec": {
        "command": "cargo nextest run -p cadence --bin cadence instruction_lint::plan_instructions_derive_tests_from_behavior",
        "expected": {
          "kind": "literal",
          "value": "The plan renderer contains these exact handwritten blocks:\n\nStart from the approved behavior and the changes needed to deliver it. Treat a\nplan step as a container for work; separate its independently testable\nresponsibilities instead of testing the whole step. For each responsibility,\nchoose input classes, decision edges and failure responses justified by the\nrequirement. Take expected values from that requirement; never invent behavior\nto make an answer available. Flag ambiguity for the owner to clarify.\n\nA generated unit test exercises one responsibility and one behavior, using at\nmost one simulated external seam; split a unit that touches two. Run the real\nlogic that owns the decision with supplied observations and independently\njustified expectations. In the one check's existing fields, connect the\napproved truth, production responsibility, inputs or seam, expected observable\nresult and test. Name every other test in the task action with the meaningful\ndefect it would catch. Stop when another case would distinguish no new required\nbehavior or meaningful failure. Reuse adequate existing tests and relevant\nregressions; do not pursue test counts, a test per function, blanket\npermutations or coverage percentages. Use the managed project's approved\nlanguage and test framework; Cadence being written in Rust does not choose the\nproject's language.\n\nClassify an adapter as pure gathering only after separating its owned parsing,\nvalidation, error interpretation and decisions; test those responsibilities,\nand give the pure gatherer no unit test. Use plain values when they suffice.\nJudge a fake against the responsibility being exercised: it must not provide\nthat decision. A domain value can be a supplied observation for a different,\ndownstream decision; its type alone does not disqualify it."
        },
        "test": {
          "file": "crates/cadence/src/instruction_lint.rs",
          "function": "plan_instructions_derive_tests_from_behavior"
        },
        "setup": "Use cadence::plan::instructions::markdown at crates/cadence/src/plan/instructions.rs:495, with no project or supplied dependency. Handwrite the derivation and gathering/fake blocks from this plan into the test as expected strings. They are additions around the credited paragraphs at :108 and :116, not a replacement for them.",
        "call": "Render markdown() once and assert each complete literal block is present, naming the absent block on failure. This is a production render assertion, not a source-pattern classifier and not a test of instruction_lint's checking helpers.",
        "boundary": "plan::instructions::markdown: composition of the planner's behavior-derived test policy",
        "fakes": []
      },
      "reason": "Detects omitted derivation, one-behavior/one-seam limits, independent expectations, ambiguity, named defects, stopping/reuse rules, gathering separation, responsibility-relative fakes or the managed project's language policy.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "The check renders the actual compiled instruction surface in-process and asserts the exact approved policy text; agent behavior remains phase 18's live verification."
        }
      ]
    },
    {
      "kind": "check",
      "id": "check/plan_instructions_bound_test_dependencies",
      "spec": {
        "command": "cargo nextest run -p cadence --bin cadence instruction_lint::plan_instructions_bound_test_dependencies",
        "expected": {
          "kind": "literal",
          "value": "The plan renderer contains this exact handwritten block:\n\nA generated test may rely only on the project's language toolchain and test\nlibraries, including mocking libraries, from that language's package ecosystem.\nIt must need no other language runtime, host-installed program, particular\nhardware or pre-existing machine state, and give the same result wherever the\nproject builds. Test code starts no program. Cadence may launch the approved\ntest runner; that permission does not let test code launch a program.\n\nA test may create a fresh temporary directory as its one filesystem seam. Keep\nits reads and writes inside that directory and start no program there. Make no\nassertion depend on filesystem permissions, case sensitivity, symlink support\nor crash durability. Preserve the current runner boundaries; propose a needed\nrunner change separately rather than adding an unsupported integration."
        },
        "test": {
          "file": "crates/cadence/src/instruction_lint.rs",
          "function": "plan_instructions_bound_test_dependencies"
        },
        "setup": "Use cadence::plan::instructions::markdown at crates/cadence/src/plan/instructions.rs:495. Handwrite the dependency and temporary-directory block below; do not call a runner or create a directory in the test.",
        "call": "Render markdown() in-process and assert the complete dependency block, including the same-result rule, no-program sentence, runner distinction and temporary-directory limits.",
        "boundary": "plan::instructions::markdown: composition of the planner's test dependency policy",
        "fakes": []
      },
      "reason": "Detects missing machine independence, a permitted child program, confusion between runner and test, missing filesystem restrictions or an unsupported runner invitation.",
      "associations": [
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "The check renders the actual compiled instruction surface in-process and asserts the exact approved policy text; agent behavior remains phase 18's live verification."
        }
      ]
    },
    {
      "kind": "check",
      "id": "check/plan_instructions_state_the_close_rule",
      "spec": {
        "command": "cargo nextest run -p cadence --bin cadence instruction_lint::plan_instructions_state_the_close_rule",
        "expected": {
          "kind": "literal",
          "value": "The plan renderer contains the first block and the executor contract renderer contains the second block, exactly:\n\nKeep one check per truth. Its test file holds only tests, with one test per\nresponsibility; never place it beside production code that the task changes in\nthe same file. The check names the test that causes the truth's trigger. Name\nthe task's other tests in its action, with the defect each catches, rather than\nadding checks for them. Commit every test of the task before its red run, with\nproduction code that compiles so red is an assertion failure. The whole check\ntest file must have identical bytes at the red commit, green commit and task\ncompletion commit, and the red and green commands must match, or the task\ncannot close. Freeze that file through the owning task's completion; a later\ntask may add tests only after that close.\n\n   green run at a later green commit, using the same command; and a passing\n   observed run of every named task command at the completion commit. Each\n   check's file contains only tests. Commit all tests owned by this task before\n   red, while production code still compiles. Keep the whole test file byte for\n   byte identical at red, green and the task's completion commit; changing it\n   prevents task close. Hold it fixed until this task closes. A refusal names\n   each unsatisfied check; nothing is manufactured after the fact."
        },
        "test": {
          "file": "crates/cadence/src/instruction_lint.rs",
          "function": "plan_instructions_state_the_close_rule"
        },
        "setup": "Handwrite the two differently worded blocks from this task. Use plan::instructions::markdown (crates/cadence/src/plan/instructions.rs:495) and execution::instructions::contract_markdown (crates/cadence/src/execution/instructions.rs:389). The latter composes PROTOCOL through dispatch_text/role_text (:375); neither renderer reads a project or starts a process.",
        "call": "Render both production carriers in-process and assert their respective complete literal blocks with the carrier name in the failure message. One responsibility: publish the same check-file close rule to its two readers. Do not execute validate_pairs, task close, a command handler or git.",
        "boundary": "compiled disclosure of the check test-file close rule through plan and phase-executor rendering",
        "fakes": []
      },
      "reason": "Detects a rule present on only one carrier, only a vague unchanged-material phrase, missing tests-only/before-red instructions, missing completion equality or omitted command equality.",
      "associations": [
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "The check renders the actual compiled instruction surface in-process and asserts the exact approved policy text; agent behavior remains phase 18's live verification."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/p39-2/planner-test-policy",
      "spec": {
        "locators": [
          "crates/cadence/src/plan/instructions.rs"
        ],
        "substance": "The unchanged Planner paragraph and credited one-unit/fake/no-program paragraphs are extended by the exact derivation, gathering, dependency, close-rule and live-verification blocks in the task. One check per truth remains; other task tests and defects live in the task action and its tests-only file. No new schema or semantic classifier is introduced."
      },
      "reason": "Removing any rule, restating instead of extending the credited paragraphs, or allocating checks per responsibility breaks this artifact.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "This is the production instruction text for deriving meaningful test obligations and preserving their evidence limits."
        },
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "The dependency and temporary-directory block makes the managed project's toolchain and machine limits explicit."
        },
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "The close block reconciles the unchanged one-check-per-truth rule with the task's other tests and frozen file."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/p39-2/executor-close-disclosure",
      "spec": {
        "locators": [
          "crates/cadence/src/execution/instructions.rs"
        ],
        "substance": "Replace only the selected continuation of PROTOCOL item 6 with the exact task block. It names tests-only files, all task tests before red, compiling production, byte equality through completion and the same red/green command. The receipts algorithm, MANIFESTS, EXECUTOR_BLOCK, CLASSICAL_DEFAULT and task-scoped protocol remain unchanged."
      },
      "reason": "A vague unchanged-test-material statement or a statement missing completion leaves the executor unable to plan a closable task.",
      "associations": [
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "The executor who supplies close material reads the same existing rule in its own words."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/p39-2/rendered-planning-and-executor",
      "spec": {
        "locators": [
          "skills/cad-plan/SKILL.md",
          "skills/cad-executor-contract/SKILL.md"
        ],
        "substance": "At completion each file exactly equals its debug renderer: plan-instructions and executor-instructions, respectively. cad-plan starts at projected 50,026 after PLAN-1 and ends at projected 53,790 (HEAD baseline 49,603), ceiling 57,344. cad-executor-contract is 22,267 -> projected 22,563, ceiling 28,672. The executor reports actual before/after sizes. cad-execute and cad-task do not carry the changed PROTOCOL paragraph."
      },
      "reason": "Stale generated text leaves the host without the new policy even if Rust constants are correct; raising a ceiling breaks D-232.",
      "associations": [
        {
          "truth_id": "T2",
          "truth_version": 1,
          "reason": "The planner's installed skill carries the derived-test policy."
        },
        {
          "truth_id": "T3",
          "truth_version": 1,
          "reason": "The same skill carries dependency and filesystem limits."
        },
        {
          "truth_id": "T4",
          "truth_version": 1,
          "reason": "The plan and phase executor skills both carry the full close rule."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Extend the planner policy and disclose the executor close rule, red then green

- **ID:** P39-2-T1
- **Files:** crates/cadence/src/plan/instructions.rs, crates/cadence/src/execution/instructions.rs, crates/cadence/src/instruction_lint.rs, skills/cad-plan/SKILL.md, skills/cad-executor-contract/SKILL.md
- **Action:** After PLAN-1 closes, add these four tests to the tests-only crates/cadence/src/instruction_lint.rs, using actual in-process renderers and handwritten blocks, with no source reads or fake render result: the three allocated checks plan_instructions_derive_tests_from_behavior, plan_instructions_bound_test_dependencies and plan_instructions_state_the_close_rule; plan_instructions_keep_live_verification_open (plan markdown contains exactly the live-verification paragraph below; catches a planner that omits the first-runnable phase's pending observation or closes a live obligation on constituent unit tests). The four tests assert different instruction behaviors. Commit every one before the first red run while production text still compiles and still lacks these blocks. Observe an assertion red for each allocated check, with its own unchanged command. Do not edit instruction_lint.rs again before this task's completion commit; PLAN-3 appends only after this plan closes.

Keep the Planner paragraph at crates/cadence/src/plan/instructions.rs:18 verbatim and immediately follow it with this exact close-rule paragraph:

Keep one check per truth. Its test file holds only tests, with one test per
responsibility; never place it beside production code that the task changes in
the same file. The check names the test that causes the truth's trigger. Name
the task's other tests in its action, with the defect each catches, rather than
adding checks for them. Commit every test of the task before its red run, with
production code that compiles so red is an assertion failure. The whole check
test file must have identical bytes at the red commit, green commit and task
completion commit, and the red and green commands must match, or the task
cannot close. Freeze that file through the owning task's completion; a later
task may add tests only after that close.

Immediately before the credited one-unit paragraph at crates/cadence/src/plan/instructions.rs:108, insert:

Start from the approved behavior and the changes needed to deliver it. Treat a
plan step as a container for work; separate its independently testable
responsibilities instead of testing the whole step. For each responsibility,
choose input classes, decision edges and failure responses justified by the
requirement. Take expected values from that requirement; never invent behavior
to make an answer available. Flag ambiguity for the owner to clarify.

A generated unit test exercises one responsibility and one behavior, using at
most one simulated external seam; split a unit that touches two. Run the real
logic that owns the decision with supplied observations and independently
justified expectations. In the one check's existing fields, connect the
approved truth, production responsibility, inputs or seam, expected observable
result and test. Name every other test in the task action with the meaningful
defect it would catch. Stop when another case would distinguish no new required
behavior or meaningful failure. Reuse adequate existing tests and relevant
regressions; do not pursue test counts, a test per function, blanket
permutations or coverage percentages. Use the managed project's approved
language and test framework; Cadence being written in Rust does not choose the
project's language.

Keep both credited paragraphs (:108 and :116) verbatim. After the sentence ending "The small function that does the asking gets no check of its own.", insert the following three blocks in order, separated by one blank line, before the existing spec-slot explanation:

Classify an adapter as pure gathering only after separating its owned parsing,
validation, error interpretation and decisions; test those responsibilities,
and give the pure gatherer no unit test. Use plain values when they suffice.
Judge a fake against the responsibility being exercised: it must not provide
that decision. A domain value can be a supplied observation for a different,
downstream decision; its type alone does not disqualify it.

A generated test may rely only on the project's language toolchain and test
libraries, including mocking libraries, from that language's package ecosystem.
It must need no other language runtime, host-installed program, particular
hardware or pre-existing machine state, and give the same result wherever the
project builds. Test code starts no program. Cadence may launch the approved
test runner; that permission does not let test code launch a program.

A test may create a fresh temporary directory as its one filesystem seam. Keep
its reads and writes inside that directory and start no program there. Make no
assertion depend on filesystem permissions, case sensitivity, symlink support
or crash durability. Preserve the current runner boundaries; propose a needed
runner change separately rather than adding an unsupported integration.

When this phase first makes a running-program obligation from the context's
Live verification list runnable, add it to this map as a pending observation.
Constituent unit tests cannot establish integration, GUI interaction, real
persistence, performance or an assembled workflow, and passing them does not
close that obligation. Do not waive it, rename it a unit test or weaken the
promise. State what remains unverified.

At crates/cadence/src/execution/instructions.rs:70, replace only the continuation beginning "   green run at a later green commit, both on unchanged test material;" and ending "   unsatisfied check; nothing is manufactured after the fact." with:

   green run at a later green commit, using the same command; and a passing
   observed run of every named task command at the completion commit. Each
   check's file contains only tests. Commit all tests owned by this task before
   red, while production code still compiles. Keep the whole test file byte for
   byte identical at red, green and the task's completion commit; changing it
   prevents task close. Hold it fixed until this task closes. A refusal names
   each unsatisfied check; nothing is manufactured after the fact.

Keep all four MANIFESTS rows at :417 exactly, and do not alter the runner or close validation. These are product instructions for managed projects; they do not change the owner's development rules for Cadence.

Record green for all three checks. Build with RUSTC_WRAPPER= cargo build -p cadence -j 6, then write skills/cad-plan/SKILL.md from target/debug/cadence plan-instructions and skills/cad-executor-contract/SKILL.md from target/debug/cadence executor-instructions. These are the only affected registered files. Report actual before/after sizes and renderer equality; projected sizes are 50,026 -> 53,790 and 22,267 -> 22,563. No ceiling changes. Run each of this task's four new commands at completion and retain the identical whole instruction_lint.rs blob at each check's red, green and this task's completion.
- **Verify:**
  - cargo nextest run -p cadence --bin cadence instruction_lint::plan_instructions_derive_tests_from_behavior
  - cargo nextest run -p cadence --bin cadence instruction_lint::plan_instructions_bound_test_dependencies
  - cargo nextest run -p cadence --bin cadence instruction_lint::plan_instructions_state_the_close_rule
  - cargo nextest run -p cadence --bin cadence instruction_lint::plan_instructions_keep_live_verification_open

## Notes

D-226, D-227, D-230 and D-232. T2's unit is plan rendering of the derivation/fake policy; it catches a missing or weakened named obligation. T3's unit is plan rendering of dependency limits; it catches missing machine, runtime, runner/test or temporary-directory boundaries. T4's unit is disclosure of the one existing close rule on both required carriers; it catches a missing carrier or incomplete file/command equality. One constituent text test pins the live-verification paragraph, which carries D-225's first-runnable observation to the planner. None claims to judge generated tests' semantics. No new tests exercise unchanged runner or receipt logic.

Rendered sizes, preserving exact specified newlines: cad-plan HEAD 49,603, PLAN-1 output 50,026, this plan output projected 53,790 of 57,344; cad-executor-contract 22,267 -> projected 22,563 of 28,672. cad-execute stays 16,160 of 20,480; cad-task stays 12,954 of 32,768 because the edited PROTOCOL is absent from those carriers. That carrier finding sharpens the prompt's candidate list; it does not add the phase-close rule to task-scoped work. The dynamic phase dispatch gets PROTOCOL through dispatch_text; the new check exercises its contract renderer, not a live dispatch.

Unverified: whether Codex and Claude planners follow these rules or write adequate tests in a real project (phase 18); no semantic enforcement or proof of machine-independent dependencies is delivered. No live observation item is appropriate in this map. Whole-file receipt enforcement is credited, not re-tested. The non-Rust runner limitation remains parked under D-230.

Execution order is PLAN-1, PLAN-2, PLAN-3, PLAN-4, one hand dispatch per plan. These are changes to the product instructions for managed projects; the owner's 2026-09-22/23 development rules govern the Rust tests requested here. Tests call the actual production function in-process with supplied values, no process, filesystem, clock, Store writer or live state. They never launch Cadence, git or another test executable. No fake supplies the decision, no tests of a checker or fake are added, and expected text is handwritten from the approved requirement, not imported from a production constant. Existing adequate tests stay in the close suite; no test retrofit is authorized.

Run builds and tests on the owner's six-core allocation. Only the task's named narrow commands run while working; the full close-suite command remains exactly cargo nextest run --workspace --no-fail-fast. Instruction tasks build with RUSTC_WRAPPER= cargo build -p cadence -j 6 after the source change, then regenerate only their affected files from target/debug/cadence using the listed commands, never by hand. Rendering and comparing generated bytes are artifact work, not unit tests or extra verify commands. Preserve the existing name lint and all 24 literal byte ceilings at crates/cadence/src/instruction_lint.rs:172; before committing tests, if any surface would overflow, cut this phase's new prose rather than raise a ceiling and report the revised text and sizes for owner review. Once red has run, the file freeze still applies; a necessary change to test expectations must be reported as a blocked task rather than hidden in green. The name lint at crates/cadence/src/instruction_lint.rs:71 checks config keys, wire operations, skills and hook events. Contrary to the supplied known-fact description, HEAD does not implement general repository-path validation (its candidate loop and authority match have only those four kinds); do not claim that it does.

The byte figures below are HEAD rendered-file measurements and exact projections from replacing the literal blocks specified in this plan in memory. No post-change binary was built by the planner. The executor must measure actual before/after UTF-8 sizes and byte identity to the debug renderer at completion, and report any difference. Existing compiled_instructions_name_only_what_exists and rendered_files_obey_named_byte_ceilings are left unchanged and run in the close suite, not in a task verify that would pass without this work. Each task's tests-only file remains frozen from its red commit through that task's completion; later tasks may append only after the owning task closes.

No architecture document is edited (P3), no hand-authored 3.x skill or agent is edited (P4), and no runner, schema, status reducer or completion gate changes. P1's observation-cap wording and P2's non-Rust verification remain parked. D-230 keeps MANIFESTS, including its managed-project Python row; no Python is added to Cadence code, tests, grammar or contracts. Propose the non-Rust verification limitation as a milestone 13 issue to the owner before anyone files it; this plan does not file it. No observation or link item is added: these truths promise the compiled text or one local refusal, and the specified live episodes belong to phase 18. At handoff state the exercised behaviors, meaningful defects, actual commands/results and anything unverified; unit passage is not assembled-workflow proof.

Require the named filter to select its one intended test; zero selected tests are not a passing verification. The planner executed only the existing release plan-instructions command, read-only queries/reads and in-memory size calculations; no build, Rust test, clippy run, approval, publication or tracked edit occurred in authoring.
