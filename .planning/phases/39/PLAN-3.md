---
phase: 39
plan: 3
requirements: ["T1"]
files: ["crates/cadence/src/context/instructions.rs","crates/cadence/src/instruction_lint.rs","skills/cad-context/SKILL.md"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P39-3-T1","verify":["cargo nextest run -p cadence --bin cadence instruction_lint::context_instructions_separate_the_live_part"]}]}
---
## Goal

Tell context authors to name the project's owned decision in a truth and keep its running-program obligation explicitly open in the approved live-verification scope.

## Must be true when done

- T1. When the context instructions are rendered, the context author sees that each truth names the decision the project owns and that the part only a running program shows is listed apart as live verification, which passing unit tests do not close.

## Context

HEAD d8a9b140's crates/cadence/src/context/instructions.rs:4 owns the ROLE literal and :202 renders it with the compiled schema and read contract. Its only live section at :185 is 'Live-host evidence', about the interview's own O1; it does not give the general truth/live separation rule. This confirms the context's inventory. The shape remains the existing eight slots, with no live field added. The new section belongs before that O1 section, and leaves the existing O1, attestations and schema intact. docs/architecture/acceptance.md:166 places an observation in the map of the phase that first makes it runnable; the approved phase 39 scope assigns the real Codex/Claude author, planner and reviewer episodes to phase 18. The document's older broad test-style prose at :196 waits for the owner's cleanup phase (P3). crates/cadence/src/instruction_lint.rs:208 demonstrates exact handwritten render assertions; crates/cadence/src/main.rs:6 confirms the module is tests-only in the binary. crates/cadence/src/execution/render.rs:171 maps context-instructions to skills/cad-context/SKILL.md.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "check/context_instructions_separate_the_live_part",
      "spec": {
        "command": "cargo nextest run -p cadence --bin cadence instruction_lint::context_instructions_separate_the_live_part",
        "expected": {
          "kind": "literal",
          "value": "context::instructions::markdown() contains the exact following section:\n\n## Owned decisions and live verification\n\nName the decision the project owns in each truth, while keeping its trigger and\noutcome observable to the named party. List the part that requires a running\nprogram separately under a Live verification heading in the context scope.\nThat part becomes an observation in the evidence map of the phase that first\nmakes it runnable; do not add a field to the truth. Passing unit tests do not\nclose this live obligation."
        },
        "test": {
          "file": "crates/cadence/src/instruction_lint.rs",
          "function": "context_instructions_separate_the_live_part"
        },
        "setup": "Handwrite the section below as the test's expected literal. Use context::instructions::markdown at crates/cadence/src/context/instructions.rs:202; no project input, files, time, schema mutation or process.",
        "call": "Render cadence::context::instructions::markdown() in-process and assert the exact entire section is present. It must name the owned decision, Live verification in scope, the first-runnable phase's observation and the fact unit passage does not close it. This tests the instruction product, not a linter or an author model.",
        "boundary": "context::instructions::markdown: composition of the context author's owned-decision and live-verification instructions",
        "fakes": []
      },
      "reason": "Catches missing the owned-decision rule, folding the live part into the truth, omitting the observation's phase or suggesting unit passage closes it.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "The context author receives the rule through the compiled context renderer; live author conduct stays a phase 18 obligation."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/p39-3/context-live-rule",
      "spec": {
        "locators": [
          "crates/cadence/src/context/instructions.rs"
        ],
        "substance": "ROLE contains exactly the task's new section immediately before Live-host evidence. Existing truth fields, attestations, O1 section and rendering remain intact. No architecture doc or new schema is part of this change."
      },
      "reason": "Without the new source rule, every context author still has to invent this separation by hand.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "The context author receives the rule through the compiled context renderer; live author conduct stays a phase 18 obligation."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/p39-3/rendered-context",
      "spec": {
        "locators": [
          "skills/cad-context/SKILL.md"
        ],
        "substance": "Byte-identical to target/debug/cadence context-instructions at completion, with HEAD 20,012 -> projected 20,470 bytes under the unchanged 24,576 ceiling; actual sizes and byte identity reported by the executor."
      },
      "reason": "A stale generated skill omits the instruction even when ROLE has it; an increased ceiling violates D-232.",
      "associations": [
        {
          "truth_id": "T1",
          "truth_version": 1,
          "reason": "The context author receives the rule through the compiled context renderer; live author conduct stays a phase 18 obligation."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Add the context rule separating owned decisions and live verification, red then green

- **ID:** P39-3-T1
- **Files:** crates/cadence/src/context/instructions.rs, crates/cadence/src/instruction_lint.rs, skills/cad-context/SKILL.md
- **Action:** After PLAN-2 closes, add context_instructions_separate_the_live_part to the tests-only crates/cadence/src/instruction_lint.rs. It calls the real context renderer and asserts the complete handwritten section below, with no source read or model call. Commit this task's one test with the unchanged compiling context renderer before red. Observe the allocated check fail on its text assertion. Do not edit instruction_lint.rs again before this task's completion commit.

Insert exactly this section, followed by one blank line, immediately before "## Live-host evidence" in ROLE at crates/cadence/src/context/instructions.rs:185:

## Owned decisions and live verification

Name the decision the project owns in each truth, while keeping its trigger and
outcome observable to the named party. List the part that requires a running
program separately under a Live verification heading in the context scope.
That part becomes an observation in the evidence map of the phase that first
makes it runnable; do not add a field to the truth. Passing unit tests do not
close this live obligation.

Do not alter the context schema, observable/fixed-oracle attestations or the O1 section. The context author lists the live remainder in scope prose; no new field, gate or observation record is created by rendering.

Record green using the same check command. Build with RUSTC_WRAPPER= cargo build -p cadence -j 6 and regenerate skills/cad-context/SKILL.md from target/debug/cadence context-instructions in this task. Record actual before/after UTF-8 byte sizes, projected 20,012 -> 20,470, and byte equality to that renderer. Keep the 24,576-byte ceiling. Run the task's new narrow verify at completion, with the same whole test-file bytes at red, green and completion.
- **Verify:**
  - cargo nextest run -p cadence --bin cadence instruction_lint::context_instructions_separate_the_live_part

## Notes

D-225 and D-232. One text-composition unit, one behavior: the context author is told where the owned decision and live remainder belong. The check would catch an absent or weakened sentence; it cannot establish that a model follows it. It uses the existing renderer and no external seam. Rendered size: cad-context 20,012 -> projected 20,470 of 24,576 bytes. No other registered rendered surface contains this ROLE.

Unverified: a context author on each real host actually listing a running-program part apart from its truth is explicitly retained for phase 18, together with that phase's planner/reviewer episodes. Passing this render test does not observe those episodes. There is no observation item in this phase's map, no change to truth reduction, and no architecture cleanup.

Execution order is PLAN-1, PLAN-2, PLAN-3, PLAN-4, one hand dispatch per plan. These are changes to the product instructions for managed projects; the owner's 2026-09-22/23 development rules govern the Rust tests requested here. Tests call the actual production function in-process with supplied values, no process, filesystem, clock, Store writer or live state. They never launch Cadence, git or another test executable. No fake supplies the decision, no tests of a checker or fake are added, and expected text is handwritten from the approved requirement, not imported from a production constant. Existing adequate tests stay in the close suite; no test retrofit is authorized.

Run builds and tests on the owner's six-core allocation. Only the task's named narrow commands run while working; the full close-suite command remains exactly cargo nextest run --workspace --no-fail-fast. Instruction tasks build with RUSTC_WRAPPER= cargo build -p cadence -j 6 after the source change, then regenerate only their affected files from target/debug/cadence using the listed commands, never by hand. Rendering and comparing generated bytes are artifact work, not unit tests or extra verify commands. Preserve the existing name lint and all 24 literal byte ceilings at crates/cadence/src/instruction_lint.rs:172; before committing tests, if any surface would overflow, cut this phase's new prose rather than raise a ceiling and report the revised text and sizes for owner review. Once red has run, the file freeze still applies; a necessary change to test expectations must be reported as a blocked task rather than hidden in green. The name lint at crates/cadence/src/instruction_lint.rs:71 checks config keys, wire operations, skills and hook events. Contrary to the supplied known-fact description, HEAD does not implement general repository-path validation (its candidate loop and authority match have only those four kinds); do not claim that it does.

The byte figures below are HEAD rendered-file measurements and exact projections from replacing the literal blocks specified in this plan in memory. No post-change binary was built by the planner. The executor must measure actual before/after UTF-8 sizes and byte identity to the debug renderer at completion, and report any difference. Existing compiled_instructions_name_only_what_exists and rendered_files_obey_named_byte_ceilings are left unchanged and run in the close suite, not in a task verify that would pass without this work. Each task's tests-only file remains frozen from its red commit through that task's completion; later tasks may append only after the owning task closes.

No architecture document is edited (P3), no hand-authored 3.x skill or agent is edited (P4), and no runner, schema, status reducer or completion gate changes. P1's observation-cap wording and P2's non-Rust verification remain parked. D-230 keeps MANIFESTS, including its managed-project Python row; no Python is added to Cadence code, tests, grammar or contracts. Propose the non-Rust verification limitation as a milestone 13 issue to the owner before anyone files it; this plan does not file it. No observation or link item is added: these truths promise the compiled text or one local refusal, and the specified live episodes belong to phase 18. At handoff state the exercised behaviors, meaningful defects, actual commands/results and anything unverified; unit passage is not assembled-workflow proof.

Require the named filter to select its one intended test; zero selected tests are not a passing verification. The planner executed only the existing release plan-instructions command, read-only queries/reads and in-memory size calculations; no build, Rust test, clippy run, approval, publication or tracked edit occurred in authoring.
