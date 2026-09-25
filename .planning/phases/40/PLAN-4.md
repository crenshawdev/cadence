---
phase: 40
plan: 4
requirements: ["T5"]
files: ["crates/cadence/src/read/instructions.rs","crates/cadence/src/server.rs","crates/cadence/src/instruction_lint.rs","crates/cadence/src/plan/instructions.rs","crates/cadence/src/verification/instructions.rs","skills/cad-context/SKILL.md","skills/cad-plan/SKILL.md","skills/cad-executor-contract/SKILL.md","skills/cad-execute/SKILL.md","skills/cad-task/SKILL.md","skills/cad-verifier-contract/SKILL.md","skills/cad-verify/SKILL.md","skills/cad-review/SKILL.md","skills/cad-decision-review/SKILL.md","skills/cad-minimalism-review/SKILL.md","skills/cad-plan-review/SKILL.md","skills/cad-audit/SKILL.md","skills/cad-coverage/SKILL.md","skills/cad-read-contract/SKILL.md"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P40-4-T1","verify":["cargo nextest run -p cadence --bin cadence instruction_lint::compiled_contracts_locate_first","cargo nextest run -p cadence --bin cadence instruction_lint::no_compiled_surface_carries_a_phase_31_measurement_paragraph","cargo nextest run -p cadence --bin cadence instruction_lint::the_query_tool_description_says_locate_first"]}]}
---
## Goal

Every carrier of the read contract, the server's initialize instructions and the cadence_query description tell a caller to locate first and read by unit second, with every phase 31 measurement paragraph gone and every rendered file inside its unchanged ceiling.

## Must be true when done

- T5. When the read contract is rendered where it is carried, the reader sees in every compiled surface, the server's initialize instructions and the cadence_query description: locate first with search, symbol-search or call-search, then read by issued location or unit name, with every rendered file inside its ceiling and no phase 31 measurement paragraph.

## Context

At HEAD a57528fd, read at that commit. CONTRACT (read/instructions.rs:5-13) is 5,121 bytes: paragraphs of 423, 905, 1,515, 1,129 and 1,141 bytes with four two-byte separators, measured at HEAD (cad-read-contract renders 5,355 bytes, a 234-byte wrapper around CONTRACT); the figure of 5,155 in the dispatch does not match HEAD. Its last paragraph (:13, 1,141 bytes plus its separator) is phase 31's planner-round close handoff. CONTRACT is the server's initialize instructions (server.rs:894-899) and is embedded by context (context/instructions.rs:206), plan (plan/instructions.rs:512), the executor role and dispatch_text (execution/instructions.rs:375-386) and so the executor contract and cad-task (task/instructions.rs:75-77), the execute front door (execution/instructions.rs:394-396), the verifier contract and front door (verification/instructions.rs:132-135, :199-233), audit and coverage (verification/instructions.rs:140-141), review and its three aliases (review/instructions.rs:43-44), the local reviewer dispatch (review/invoking.rs:37) and the legacy dispatch prompt (execution/render.rs:356). Fourteen of the 24 RENDERED_PROJECT_FILES (execution/render.rs:160-185) embed it: cad-context, cad-plan, cad-executor-contract, cad-execute, cad-task, cad-verifier-contract, cad-verify, cad-review, cad-decision-review, cad-minimalism-review, cad-plan-review, cad-audit, cad-coverage and cad-read-contract. The cadence_query description (server.rs:921) says nothing about locating first; info() (:894) and the tool list built in list_tools (:906-932) are private to server.rs. instruction_lint.rs is the binary's #[cfg(test)] module (main.rs:6-7), holding only tests and test helpers: compiled_instructions_name_only_what_exists (:70-151) resolves every JSON operation value and cadence_query invocation in compiled text against QUERY_OPERATIONS and APPLY_OPERATIONS, and rendered_files_obey_named_byte_ceilings (:169-205) holds the literal ceilings (:171-196). Rendered sizes from the a57528fd release binary, against their ceilings: cad-read-contract 5,355 of 6,144, cad-coverage 7,703 of 9,216, cad-audit 7,625 of 9,216, cad-review 10,611 of 12,288, cad-verify 15,603 and cad-verifier-contract 15,729 of 18,432, cad-execute 16,513 of 20,480, cad-context 20,365 of 24,576, cad-executor-contract 22,620 of 28,672, cad-task 13,307 of 32,768, cad-plan 50,826 of 57,344. So CONTRACT may be at most 5,910 bytes (6,144 less the 234-byte wrapper); every other carrier then stays inside its ceiling. Two more phase 31 planner-round paragraphs live in role text: plan/instructions.rs:330-341 in the plan ROLE (:2-506), rendered into cad-plan, and verification/instructions.rs:72-84 in PROTOCOL (:4-130), rendered into cad-verifier-contract (:135) and cad-verify (:233) and carried into the verifier dispatch prompt through contract_markdown (verification/dispatch.rs:14). Searching src, tests, skills, agents and docs at HEAD, only those three rendered skills carry their text, and no test or lint pins it. plan/instructions.rs:66-71 carries the cycle-purpose truth into a later phase's truth set; it measures nothing. Plans 1 and 2 of this phase add the row answers, symbol-search and call-search that the rewrite names, and plan 1 adds the bounded outline's cursor.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "check/compiled_contracts_locate_first",
      "spec": {
        "command": "cargo nextest run -p cadence --bin cadence instruction_lint::compiled_contracts_locate_first",
        "expected": {
          "kind": "literal",
          "value": "Each of the sixteen surfaces contains the sentence \"Locate first, read second: find source with `search`, `symbol-search` or `call-search`, whose rows carry issued locations and never bodies, then `read` one unit at a time by its issued `location` or by unit name under its issued `file_reference`.\""
        },
        "test": {
          "file": "crates/cadence/src/instruction_lint.rs",
          "function": "compiled_contracts_locate_first"
        },
        "setup": "Sixteen surfaces: the fourteen carrier paths, listed by hand in the test (skills/<name>/SKILL.md for cad-context, cad-plan, cad-executor-contract, cad-execute, cad-task, cad-verifier-contract, cad-verify, cad-review, cad-decision-review, cad-minimalism-review, cad-plan-review, cad-audit, cad-coverage and cad-read-contract), each rendered through instruction_surfaces::render with its RENDERED_PROJECT_FILES command; cadence::execution::instructions::dispatch_text(); and super::server::info().instructions. The locate sentence is handwritten in the test from D-222 and T5, never read from CONTRACT.",
        "call": "Render each surface in-process and assert, per surface and naming it on failure, that the locate sentence is present. No binary is launched, no file is read and no transport runs.",
        "boundary": "compiled read-contract composition: the renderers of the fourteen carrier files, the executor dispatch instructions and the server's initialize answer",
        "fakes": []
      },
      "reason": "Catches a surface composed without the contract, or a contract without the locate-first sentence: a carrier, dispatch_text or the initialize instructions missing it.",
      "associations": [
        {
          "truth_id": "T5",
          "truth_version": 1,
          "reason": "The check renders every compiled carrier and the initialize instructions in-process and looks for locate first with search, symbol-search or call-search, then read by issued location or unit name; the description, the retired paragraphs and the ceilings are traced in artifact/locate-first-contract, artifact/retired-phase-31-paragraphs and artifact/unraised-ceilings."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/locate-first-contract",
      "spec": {
        "locators": [
          "crates/cadence/src/read/instructions.rs",
          "crates/cadence/src/server.rs"
        ],
        "substance": "CONTRACT, at most 5,910 bytes, leads with locate first and read by unit second, describes search, symbol-search and call-search with their limit and cursor, keeps the document and draft paragraphs, and has no planner-round paragraph; it is still the one source of the initialize instructions and every carrier. tools() builds the tool list list_tools returns, and the cadence_query description ends with the locate-first sentence, tested by the_query_tool_description_says_locate_first."
      },
      "reason": "A second copy of the contract, a description built outside tools(), or a surviving planner-round paragraph breaks this artifact.",
      "associations": [
        {
          "truth_id": "T5",
          "truth_version": 1,
          "reason": "D-222 keeps CONTRACT the one source; this artifact is the rewritten constant and the description sentence the check reads through the real composition."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/retired-phase-31-paragraphs",
      "spec": {
        "locators": [
          "crates/cadence/src/read/instructions.rs",
          "crates/cadence/src/plan/instructions.rs",
          "crates/cadence/src/verification/instructions.rs"
        ],
        "substance": "The three phase 31 planner-round paragraphs are gone: CONTRACT's (read/instructions.rs:13), the plan role's (plan/instructions.rs:330-341) and the verifier protocol's (verification/instructions.rs:72-84). no_compiled_surface_carries_a_phase_31_measurement_paragraph checks all 24 rendered files, dispatch_text and the initialize instructions for their opening sentences."
      },
      "reason": "A phase 31 measurement paragraph surviving in any of the three sources, and so in any surface that renders it, breaks this artifact.",
      "associations": [
        {
          "truth_id": "T5",
          "truth_version": 1,
          "reason": "T5's reader sees no phase 31 measurement paragraph in any compiled surface; this is where all three are removed and the test that looks for them."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/regenerated-contract-surfaces",
      "spec": {
        "locators": [
          "skills/cad-context/SKILL.md",
          "skills/cad-plan/SKILL.md",
          "skills/cad-executor-contract/SKILL.md",
          "skills/cad-execute/SKILL.md",
          "skills/cad-task/SKILL.md",
          "skills/cad-verifier-contract/SKILL.md",
          "skills/cad-verify/SKILL.md",
          "skills/cad-review/SKILL.md",
          "skills/cad-decision-review/SKILL.md",
          "skills/cad-minimalism-review/SKILL.md",
          "skills/cad-plan-review/SKILL.md",
          "skills/cad-audit/SKILL.md",
          "skills/cad-coverage/SKILL.md",
          "skills/cad-read-contract/SKILL.md"
        ],
        "substance": "Each installed file is byte-identical to its render command's output at the completion commit, compared by the executor and verifier outside any unit test; the executor's handoff lists each file's size before and after."
      },
      "reason": "An installed skill that still carries the old contract means a host reads stale instructions; a file differing from its render breaks this artifact.",
      "associations": [
        {
          "truth_id": "T5",
          "truth_version": 1,
          "reason": "T5's reader sees the contract where it is carried, which for a skill host is the installed file, not the renderer."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/unraised-ceilings",
      "spec": {
        "locators": [
          "crates/cadence/src/instruction_lint.rs"
        ],
        "substance": "The 24 literal ceilings at instruction_lint.rs:171-196 are unchanged (cad-read-contract 6,144, cad-coverage and cad-audit 9,216, the four review files 12,288, cad-verify and cad-verifier-contract 18,432, cad-execute 20,480, cad-context 24,576, cad-executor-contract 28,672, cad-task 32,768, cad-plan 57,344, and the rest as at HEAD), and rendered_files_obey_named_byte_ceilings passes in the plan-close suite."
      },
      "reason": "Raising any ceiling to fit the rewrite is refused by D-222; a changed number in that table breaks this artifact.",
      "associations": [
        {
          "truth_id": "T5",
          "truth_version": 1,
          "reason": "T5 requires every rendered file inside its ceiling; this is the unchanged table and the existing test that holds it."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Rewrite the read contract to locate first, delivering compiled_contracts_locate_first red then green

- **ID:** P40-4-T1
- **Files:** crates/cadence/src/read/instructions.rs, crates/cadence/src/server.rs, crates/cadence/src/instruction_lint.rs, crates/cadence/src/plan/instructions.rs, crates/cadence/src/verification/instructions.rs, skills/cad-context/SKILL.md, skills/cad-plan/SKILL.md, skills/cad-executor-contract/SKILL.md, skills/cad-execute/SKILL.md, skills/cad-task/SKILL.md, skills/cad-verifier-contract/SKILL.md, skills/cad-verify/SKILL.md, skills/cad-review/SKILL.md, skills/cad-decision-review/SKILL.md, skills/cad-minimalism-review/SKILL.md, skills/cad-plan-review/SKILL.md, skills/cad-audit/SKILL.md, skills/cad-coverage/SKILL.md, skills/cad-read-contract/SKILL.md
- **Action:** Extract the tool list built in list_tools (server.rs:906-932) into pub(crate) fn tools() -> Vec<Tool>, which list_tools returns, and make info() (:894) pub(crate); each stays the one source of what the host receives. Write three top-level #[test] functions in crates/cadence/src/instruction_lint.rs, a tests-only file, and commit them with those two accessors and the unchanged instruction text before the red run, so the red run ends in the check's assertion failure, not a build error: the check compiled_contracts_locate_first; no_compiled_surface_carries_a_phase_31_measurement_paragraph (all 24 RENDERED_PROJECT_FILES rendered through instruction_surfaces::render, executor dispatch_text and the initialize instructions contain none of three handwritten opening sentences, "For the read-layer cycle-purpose close handoff, measure a new real Claude Code planning episode after this read contract is installed." (read/instructions.rs:13), "For the read-layer cycle-purpose close, schedule a new real Claude-host planning" (plan/instructions.rs:330) and "For a read-layer cycle-purpose truth, inspect a new real Claude-host planning" (verification/instructions.rs:72); catches any of the three paragraphs kept); the_query_tool_description_says_locate_first (the cadence_query entry of tools() has a description containing the sentence "Locate source first with search, symbol-search or call-search, then read one unit by its issued location or unit name."; catches the description left without it). Do not edit instruction_lint.rs again before this task's completion commit.

Then rewrite CONTRACT (read/instructions.rs:5-13). It must contain, verbatim, the sentence "Locate first, read second: find source with `search`, `symbol-search` or `call-search`, whose rows carry issued locations and never bodies, then `read` one unit at a time by its issued `location` or by unit name under its issued `file_reference`." It describes the three request shapes with JSON examples ({operation search, pattern, scope}, {operation symbol-search, name, scope}, {operation call-search, name, scope}), the optional limit (default 50, at most 200), case_insensitive for search and symbol-search, the cursor of a bounded search, symbol-search, call-search or outline answer (repeat the identical request with it), reading a row's location, a file reference alone answering a file at or under 24KB or with no grammar whole and a larger one as an outline, and continuation; it keeps the substance of the document, document-search, dispatch and draft paragraphs (:9, :11); it deletes the planner-round paragraph (:13) whole. Delete the two phase 31 planner-round paragraphs of the role text whole as well: plan/instructions.rs:330-341 and verification/instructions.rs:72-84; nothing else pins their text, and plan/instructions.rs:66-71 stays. The rewritten CONTRACT is at most 5,910 bytes; no ceiling in instruction_lint.rs:171-196 changes. Its JSON operation values and cadence_query invocations name only operations that exist, and it carries no backticked dotted identifier, so compiled_instructions_name_only_what_exists still passes. Append to the cadence_query description in tools() the sentence "Locate source first with search, symbol-search or call-search, then read one unit by its issued location or unit name."

Regenerate the fourteen rendered files from the rebuilt binary's own render commands listed in execution/render.rs:160-185, never by hand, so cad-plan, cad-verifier-contract and cad-verify also lose the role paragraphs, and record each one's byte size before and after in the handoff. compiled_instructions_name_only_what_exists and rendered_files_obey_named_byte_ceilings are not edited and must pass in the plan-close suite.
- **Verify:**
  - cargo nextest run -p cadence --bin cadence instruction_lint::compiled_contracts_locate_first
  - cargo nextest run -p cadence --bin cadence instruction_lint::no_compiled_surface_carries_a_phase_31_measurement_paragraph
  - cargo nextest run -p cadence --bin cadence instruction_lint::the_query_tool_description_says_locate_first

## Notes

D-222, D-224. Last in the phase because compiled_instructions_name_only_what_exists refuses a compiled instruction naming an operation that does not exist, and the rewrite names symbol-search and call-search, which plan 2 adds. Bounds (D-224): CONTRACT at most 5,910 bytes, so cad-read-contract stays within its 6,144; no ceiling changes (D-222). HEAD disagrees with two figures the dispatch carried: CONTRACT is 5,121 bytes, not 5,155, and its last paragraph is 1,141 bytes plus a two-byte separator, not 1,145; the plan uses HEAD's.

Checks. compiled_contracts_locate_first is the allocated check: the locate-first sentence in the fourteen carriers, executor dispatch_text and the initialize answer, rendered in-process; it catches a surface composed without the contract. Two constituent tests are split from it because each can fail alone: no_compiled_surface_carries_a_phase_31_measurement_paragraph catches any of the three retired paragraphs kept, over all 24 rendered files, dispatch_text and the initialize instructions; the_query_tool_description_says_locate_first catches the description without its sentence. A ceiling raised to fit is caught by artifact/unraised-ceilings and the unchanged rendered_files_obey_named_byte_ceilings in the plan-close suite; the unchanged name lint runs there too. Neither is in this task's verify, which names only tests this task writes.

T5 says no phase 31 measurement paragraph in every compiled surface, so this plan also removes the two role paragraphs outside CONTRACT, plan/instructions.rs:330-341 and verification/instructions.rs:72-84, and regenerates cad-plan, cad-verifier-contract and cad-verify with them gone. plan/instructions.rs:66-71 carries the cycle-purpose truth into a later phase's truth set, measures nothing, and stays. The local reviewer dispatch (review/invoking.rs:37) and the legacy dispatch prompt (execution/render.rs:356) interpolate the same constant; the check does not render them because each needs an admission or dispatch fixture. The 3.x hand-authored contracts under skills/ and agents/*.md are not touched (P4); docs/architecture/read-layer.md is not edited (P3).

Unverified. That Codex and Claude hosts receive the rewritten initialize instructions, and that agents follow them, is phase 18's live gate; phase 39's first runs are the after numbers T6 counts.
