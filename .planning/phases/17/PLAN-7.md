---
phase: 17
plan: 7
requirements: ["T7"]
files: ["crates/cadence/src/instruction_surfaces.rs","crates/cadence/src/main.rs","crates/cadence/src/server.rs","crates/cadence/src/review/provider/payload.rs","crates/cadence/src/instruction_lint.rs","crates/cadence/src/config/schema.json","crates/cadence/src/help/table.rs","crates/cadence/src/execution/instructions.rs","crates/cadence/src/verification/instructions.rs","crates/cadence/src/context/instructions.rs","crates/cadence/src/plan/instructions.rs","crates/cadence/src/help/instructions.rs","crates/cadence/src/debug/instructions.rs","crates/cadence/src/spike/instructions.rs","crates/cadence/src/undo/instructions.rs","crates/cadence/src/landing/instructions.rs","crates/cadence/src/milestone/instructions.rs","crates/cadence/src/suggest/instructions.rs","crates/cadence/src/why/instructions.rs","crates/cadence/src/progress/instructions.rs","crates/cadence/src/capture/instructions.rs","crates/cadence/src/review/instructions.rs","crates/cadence/src/read/instructions.rs","crates/cadence/src/task/instructions.rs","skills/cad-help/SKILL.md","skills/cad-spike/SKILL.md","skills/cad-debug/SKILL.md","skills/cad-undo/SKILL.md","skills/cad-land/SKILL.md","skills/cad-milestone/SKILL.md","skills/cad-suggest/SKILL.md","skills/cad-why/SKILL.md","skills/cad-progress/SKILL.md","skills/cad-capture/SKILL.md","skills/cad-context/SKILL.md","skills/cad-plan/SKILL.md","skills/cad-executor-contract/SKILL.md","skills/cad-execute/SKILL.md","skills/cad-verifier-contract/SKILL.md","skills/cad-verify/SKILL.md","skills/cad-review/SKILL.md","skills/cad-decision-review/SKILL.md","skills/cad-minimalism-review/SKILL.md","skills/cad-plan-review/SKILL.md","skills/cad-audit/SKILL.md","skills/cad-coverage/SKILL.md","skills/cad-read-contract/SKILL.md","skills/cad-task/SKILL.md","cadence-core/bin/self-verify.mjs","cadence-core/bin/self-verify.test.mjs","cadence-core/bin/lib/config-reach.mjs","cadence-core/bin/lib/dispatch-phrasing.mjs","cadence-core/bin/lib/route-relay.mjs","cadence-core/bin/lib/merge-warnings.mjs","cadence-core/bin/lib/reference-routers.mjs","cadence-core/bin/lib/include-consumers.mjs","cadence-core/bin/lib/text-transport.mjs","cadence-core/bin/lib/bulk-output.mjs","cadence-core/bin/lib/scratch-path.mjs","cadence-core/bin/lib/capture-writers.mjs","cadence-core/bin/lib/hook-events.mjs","cadence-core/bin/dispatch-phrasing.test.mjs","cadence-core/bin/route-relay.test.mjs","cadence-core/bin/reference-routers.test.mjs","cadence-core/bin/include-consumers.test.mjs","cadence-core/bin/text-transport.test.mjs","cadence-core/bin/bulk-output.test.mjs","cadence-core/bin/scratch-path.test.mjs","cadence-core/bin/capture-writers.test.mjs","cadence-core/bin/hook-events.test.mjs","cadence-core/bin/lib/arg-contract.mjs","cadence-core/bin/arg-contract.test.mjs","cadence-core/bin/test.mjs","cadence-core/bin/helper-census.test.mjs","cadence-core/bin/lib/census-registry.mjs","cadence-core/bin/census-registry.test.mjs","cadence-core/bin/weight-budgets.json","cadence-core/bin/weight.mjs",".github/workflows/release.yml","CONTRIBUTING.md","METHOD.md"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P17-7-T1","verify":["cargo nextest run -p cadence --bin cadence instruction_surfaces::tests::rendered_command_identity_selects_the_requested_surface"]},{"id":"P17-7-T2","verify":["cargo nextest run -p cadence --bin cadence instruction_lint::compiled_instructions_name_only_what_exists","cargo nextest run -p cadence --bin cadence instruction_lint::schema_defaults_match_their_declared_domain"]},{"id":"P17-7-T3","verify":["cargo nextest run -p cadence --bin cadence instruction_lint::rendered_files_obey_named_byte_ceilings"]}]}
---
## Goal

One native lint renders every compiled surface, rejects unresolved names with their surface, and replaces self-verify and its exclusive libraries.

## Must be true when done

- T7. When a compiled instruction names something that does not exist at HEAD (a config key, wire operation, skill, repository path, hook event), the maintainer sees cargo test fail naming the surface and the name, from one test that renders every surface through the binary's own renderers.

## Context

At HEAD 7d492bf3 cad-task is already among the 24 execution/render.rs::RENDERED_PROJECT_FILES. main.rs::run_command calls library renderers directly for every instruction arm and its frontdoor/alias variants. execution/instructions.rs exposes dispatch_text and command_policy with four MANIFESTS plus no-manifest; help/table.rs::COMMANDS holds user command names and descriptions. config::schema() embeds config/schema.json, which contains both live and retired migration keys. server.rs derives QUERY_OPERATIONS/APPLY_OPERATIONS from wire schemas (lines 658 and 464); they remain there for the binary lint to access without relocating review/capture/adoption types. Five hand-written skills under skills/ are absent from both COMMANDS and RENDERED_PROJECT_FILES: cad-assumptions-analyzer-contract, cad-plan-checker-contract, cad-planner-contract, cad-review-delivery and cad-reviewer-contract. The compiled reviewer brief is embedded by review/provider/payload.rs:9 and names cad-reviewer-contract; it belongs in the corpus. landing/instructions.rs:54 names git.remote.base_head as an answer field, not a config key. guard/tests.rs::rendered_skill_files_are_protected already pins 24. The old mcp/help-reference integration targets are absent. self-verify.mjs and its imports remain, and release.yml still invokes it; test.yml runs the workspace nextest suite. The lint must use compiled values and these real renderers in-process, with no checkout read.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "check/compiled_instructions_name_only_what_exists",
      "spec": {
        "command": "cargo nextest run -p cadence --bin cadence instruction_lint::compiled_instructions_name_only_what_exists",
        "expected": {
          "kind": "property",
          "value": "The actual corpus rendered through the production dispatch, including the compiled reviewer brief, has no unresolved config key, wire operation, skill or hook event. Any failure names the actual surface, name kind and token. Only real product output is asserted; no invented-name cases or mutated corpus copies are included. Unknown candidates are captured before membership lookup. Explicitly marked answer/request/dispatch field references are not config keys. This check makes no assertion about repository-path existence, reader callsites, file byte ceilings, installed files or deletion."
        },
        "test": {
          "file": "crates/cadence/src/instruction_lint.rs",
          "function": "compiled_instructions_name_only_what_exists"
        },
        "setup": "In the binary crate's #[cfg(test)] instruction_lint module, build the real corpus using instruction_surfaces and all production RENDERED_PROJECT_FILES, every main.rs instruction variant, executor dispatch_text/command_policy variants, compiled help descriptions, the exact reviewer brief embedded by review::provider::payload. Exclude hooks/hooks.json from the corpus and do not embed it for the checker. Resolve any explicit hook-event mention against the handwritten {PreToolUse} set taken from production guard named-event acceptance as stated in task 2; no compiled instruction names a hook event at HEAD. Use config::schema(), the unchanged server.rs wire registries through small accessors, help/rendered-skill tables and the five verified hand-authored skill names listed in task 2. Candidate extraction/resolution is test code. No handcrafted substitute corpus, runtime file read or invented name.",
        "call": "Call the actual production render functions in-process, extract candidates from their real output with task 2's syntax grammar, and assert that the test-only name resolver returns no located diagnostic. Renderers are the production subject; the checker is not tested. Do not launch a binary, read the checkout, scan source, enumerate installed files or run a command handler.",
        "boundary": "compiled instruction rendering's emitted names, reached through the binary's shared instruction_surfaces dispatch and additional production instruction products; instruction_lint is test-only assertion code",
        "fakes": []
      },
      "reason": "Unit check of compiled instruction rendering's own decision; the running-resident trigger and outcome are left to the phase 18 live gate.",
      "associations": [
        {
          "truth_id": "T7",
          "truth_version": 1,
          "reason": "Unit check of compiled instruction rendering's own decision; the running-resident trigger and outcome are left to the phase 18 live gate."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/compiled-instruction-lint",
      "spec": {
        "locators": [
          "crates/cadence/src/main.rs",
          "crates/cadence/src/instruction_lint.rs",
          "crates/cadence/src/instruction_surfaces.rs",
          "crates/cadence/src/server.rs",
          "crates/cadence/src/review/provider/payload.rs",
          "crates/cadence/src/review/provider/reviewer-brief.md",
          "skills/cad-assumptions-analyzer-contract/SKILL.md",
          "skills/cad-plan-checker-contract/SKILL.md",
          "skills/cad-planner-contract/SKILL.md",
          "skills/cad-review-delivery/SKILL.md",
          "skills/cad-reviewer-contract/SKILL.md",
          "crates/cadence/src/guard/mod.rs",
          "crates/cadence/src/config/schema.json"
        ],
        "substance": "A binary test-only module checks actual compiled instruction output for config, wire-operation, skill and hook-event names. The existing server registries stay in server.rs; the reviewer brief is included, and the five hand-authored skill names in the test registry are traced against skills/. No standing test demonstrates detection of a bad name. T7's repository-path clause is not delivered and has no scheduled home (GH-282). The test's handwritten hook-event set {PreToolUse} is traced against crates/cadence/src/guard/mod.rs:169. D-214's reader clause, every schema key has a reader, is traced once here against crates/cadence/src/config/schema.json and the config readers; it has no standing check and is tracked with the path clause as GH-282."
      },
      "reason": "The real rendered corpus is checked against config, wire-operation, skill and hook authorities without adding a production checker; the verifier traces the test-only skill list and corpus accessors.",
      "associations": [
        {
          "truth_id": "T7",
          "truth_version": 1,
          "reason": "This artifact is required for T7's stated outcome."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/instruction-byte-ceilings",
      "spec": {
        "locators": [
          "crates/cadence/src/instruction_lint.rs",
          "cadence-core/bin/weight-budgets.json"
        ],
        "substance": "Every one of the 24 rendered files has the explicit finite UTF-8 byte ceiling stated in task 3; no missing or derived-at-runtime ceiling can silently pass."
      },
      "reason": "Every one of the 24 rendered files has the explicit finite UTF-8 byte ceiling stated in task 3; no missing or derived-at-runtime ceiling can silently pass.",
      "associations": [
        {
          "truth_id": "T7",
          "truth_version": 1,
          "reason": "This artifact is required for T7's stated outcome."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/self-verify-retirement",
      "spec": {
        "locators": [
          ".github/workflows/release.yml",
          "CONTRIBUTING.md",
          "METHOD.md"
        ],
        "substance": "The release workflow's self-verify invocation and CONTRIBUTING.md/METHOD.md's live command, explanatory claims and table row are retired in favor of the native lint and existing workspace CI consumer. Other present-tense documentation claims wait for GH-279."
      },
      "reason": "Only the release workflow and CONTRIBUTING.md/METHOD.md consumers are retired here; the broader prose crawl is GH-279.",
      "associations": [
        {
          "truth_id": "T7",
          "truth_version": 1,
          "reason": "This artifact is required for T7's stated outcome."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/self-verify-deletions",
      "spec": {
        "locators": [
          "cadence-core/bin/self-verify.mjs",
          "cadence-core/bin/self-verify.test.mjs",
          "cadence-core/bin/lib/config-reach.mjs",
          "cadence-core/bin/lib/dispatch-phrasing.mjs",
          "cadence-core/bin/lib/route-relay.mjs",
          "cadence-core/bin/lib/merge-warnings.mjs",
          "cadence-core/bin/lib/reference-routers.mjs",
          "cadence-core/bin/lib/include-consumers.mjs",
          "cadence-core/bin/lib/text-transport.mjs",
          "cadence-core/bin/lib/bulk-output.mjs",
          "cadence-core/bin/lib/scratch-path.mjs",
          "cadence-core/bin/lib/capture-writers.mjs",
          "cadence-core/bin/lib/hook-events.mjs",
          "cadence-core/bin/dispatch-phrasing.test.mjs",
          "cadence-core/bin/route-relay.test.mjs",
          "cadence-core/bin/reference-routers.test.mjs",
          "cadence-core/bin/include-consumers.test.mjs",
          "cadence-core/bin/text-transport.test.mjs",
          "cadence-core/bin/bulk-output.test.mjs",
          "cadence-core/bin/scratch-path.test.mjs",
          "cadence-core/bin/capture-writers.test.mjs",
          "cadence-core/bin/hook-events.test.mjs",
          "cadence-core/bin/lib/arg-contract.mjs",
          "cadence-core/bin/arg-contract.test.mjs",
          "cadence-core/bin/test.mjs",
          "cadence-core/bin/lib/census-registry.mjs",
          "cadence-core/bin/census-registry.test.mjs",
          "cadence-core/bin/helper-census.test.mjs",
          "cadence-core/bin/weight-budgets.json",
          "cadence-core/bin/weight.mjs"
        ],
        "substance": "Verifier traces deletion of self-verify and its test, exactly eleven exclusive libraries and nine dedicated tests, removal of their live metadata/import references, and preservation of the nine shared libraries and historical fixture strings. These are deletion/artifact locators, not a runtime source scan or absence assertion."
      },
      "reason": "The retirement is incomplete if a named obsolete file or live importer remains; the unit checks do not prove these deletions.",
      "associations": [
        {
          "truth_id": "T7",
          "truth_version": 1,
          "reason": "This artifact is required for T7's stated outcome."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/guard-hook-manifest",
      "spec": {
        "locators": [
          "hooks/hooks.json"
        ],
        "substance": "Verifier traces the shipped PreToolUse matcher Bash|Write|Edit, cadence guard command and 10-second host timeout. No guard-manifest text-pin test is written."
      },
      "reason": "The existing hook contract must remain intact; the verifier traces this artifact independently of the compiled-instruction candidate corpus.",
      "associations": [
        {
          "truth_id": "T7",
          "truth_version": 1,
          "reason": "This artifact is required for T7's stated outcome."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Share the instruction render dispatch with the binary tests

- **ID:** P17-7-T1
- **Files:** crates/cadence/src/instruction_surfaces.rs, crates/cadence/src/main.rs, crates/cadence/src/server.rs, crates/cadence/src/review/provider/payload.rs
- **Action:** Add instruction_surfaces.rs as the binary's shared project-free renderer dispatch keyed by the existing RenderedProjectFile command arrays, including every frontdoor, review alias, audit coverage variant and task-instructions; declare it in main.rs and delegate main.rs's instruction arms to this dispatch. Preserve executor dispatch_text and command_policy as additional compiled products and enumerate RENDERED_PROJECT_FILES, not a copied 24-string corpus. Keep QUERY_OPERATIONS and APPLY_OPERATIONS, their schema walking, routing types and groups in server.rs. Add only crate-visible name accessors needed by the sibling binary test module; do not relocate wire types or introduce wire_contract.rs. Expose the already compiled reviewer brief from review::provider::payload through a small read-only accessor to the existing BRIEF, so the corpus uses exactly the fragment prepare embeds without running the payload workflow. Add instruction_surfaces::tests::rendered_command_identity_selects_the_requested_surface against command-to-renderer selection with representative command arrays and handwritten frontmatter names/headings, including frontdoor/alias controls; it calls no CLI. Reuse adequate existing value tests when moving their owning logic. If a changed decision has no adequate test, write its own in-process Rust value test before changing it; pure forwarding and external output writing get no test. Drop deleted CLI drivers and pins and do not recreate or move their byte bounds.
- **Verify:**
  - cargo nextest run -p cadence --bin cadence instruction_surfaces::tests::rendered_command_identity_selects_the_requested_surface

### Task 2: Deliver the one instruction lint red then green and delete its replaced surface

- **ID:** P17-7-T2
- **Files:** crates/cadence/src/instruction_lint.rs, crates/cadence/src/instruction_surfaces.rs, crates/cadence/src/config/schema.json, crates/cadence/src/help/table.rs, crates/cadence/src/execution/instructions.rs, crates/cadence/src/verification/instructions.rs, crates/cadence/src/context/instructions.rs, crates/cadence/src/plan/instructions.rs, crates/cadence/src/help/instructions.rs, crates/cadence/src/debug/instructions.rs, crates/cadence/src/spike/instructions.rs, crates/cadence/src/undo/instructions.rs, crates/cadence/src/landing/instructions.rs, crates/cadence/src/milestone/instructions.rs, crates/cadence/src/suggest/instructions.rs, crates/cadence/src/why/instructions.rs, crates/cadence/src/progress/instructions.rs, crates/cadence/src/capture/instructions.rs, crates/cadence/src/review/instructions.rs, crates/cadence/src/read/instructions.rs, crates/cadence/src/task/instructions.rs, skills/cad-help/SKILL.md, skills/cad-spike/SKILL.md, skills/cad-debug/SKILL.md, skills/cad-undo/SKILL.md, skills/cad-land/SKILL.md, skills/cad-milestone/SKILL.md, skills/cad-suggest/SKILL.md, skills/cad-why/SKILL.md, skills/cad-progress/SKILL.md, skills/cad-capture/SKILL.md, skills/cad-context/SKILL.md, skills/cad-plan/SKILL.md, skills/cad-executor-contract/SKILL.md, skills/cad-execute/SKILL.md, skills/cad-verifier-contract/SKILL.md, skills/cad-verify/SKILL.md, skills/cad-review/SKILL.md, skills/cad-decision-review/SKILL.md, skills/cad-minimalism-review/SKILL.md, skills/cad-plan-review/SKILL.md, skills/cad-audit/SKILL.md, skills/cad-coverage/SKILL.md, skills/cad-read-contract/SKILL.md, skills/cad-task/SKILL.md, cadence-core/bin/self-verify.mjs, cadence-core/bin/self-verify.test.mjs, cadence-core/bin/lib/config-reach.mjs, cadence-core/bin/lib/dispatch-phrasing.mjs, cadence-core/bin/lib/route-relay.mjs, cadence-core/bin/lib/merge-warnings.mjs, cadence-core/bin/lib/reference-routers.mjs, cadence-core/bin/lib/include-consumers.mjs, cadence-core/bin/lib/text-transport.mjs, cadence-core/bin/lib/bulk-output.mjs, cadence-core/bin/lib/scratch-path.mjs, cadence-core/bin/lib/capture-writers.mjs, cadence-core/bin/lib/hook-events.mjs, cadence-core/bin/dispatch-phrasing.test.mjs, cadence-core/bin/route-relay.test.mjs, cadence-core/bin/reference-routers.test.mjs, cadence-core/bin/include-consumers.test.mjs, cadence-core/bin/text-transport.test.mjs, cadence-core/bin/bulk-output.test.mjs, cadence-core/bin/scratch-path.test.mjs, cadence-core/bin/capture-writers.test.mjs, cadence-core/bin/hook-events.test.mjs, cadence-core/bin/lib/arg-contract.mjs, cadence-core/bin/arg-contract.test.mjs, cadence-core/bin/test.mjs, cadence-core/bin/helper-census.test.mjs, cadence-core/bin/lib/census-registry.mjs, cadence-core/bin/census-registry.test.mjs, cadence-core/bin/weight-budgets.json, cadence-core/bin/weight.mjs, .github/workflows/release.yml, CONTRIBUTING.md, METHOD.md, crates/cadence/src/main.rs
- **Action:** Declare #[cfg(test)] mod instruction_lint; in main.rs and create instruction_lint.rs as a test-only module with top-level #[test] functions. T2's red commit must contain both compiled_instructions_name_only_what_exists and schema_defaults_match_their_declared_domain in instruction_lint.rs, every other T2 test written into that file, and the main.rs mod line declaring instruction_lint. Do not edit instruction_lint.rs again before T2's completion commit. T3 adds rendered_files_obey_named_byte_ceilings only after T2 closes. Deliver compiled_instructions_name_only_what_exists over the real production-rendered corpus; candidate extraction and name resolution are test code, not Cadence features. Do not add a validate_names production API or any test of the checker. Render all RENDERED_PROJECT_FILES through task 1's dispatch, every main.rs instruction variant, executor dispatch_text and command_policy for all four MANIFESTS plus no-manifest, compiled help descriptions and the actual reviewer brief exposed from review::provider::payload. Exclude hooks/hooks.json from the candidate corpus and do not embed it for the checker. Resolve config names against config::schema(), operations against the existing server.rs QUERY_OPERATIONS/APPLY_OPERATIONS name accessors, user skills against help::table::COMMANDS and rendered internal skills against RENDERED_PROJECT_FILES. The test module additionally holds exactly these five hand-authored skill names: cad-assumptions-analyzer-contract, cad-plan-checker-contract, cad-planner-contract, cad-review-delivery, cad-reviewer-contract. This is a registry the verifier traces against skills/, not an exception list of unresolved names. No runtime tree read.

State a syntax-based grammar before membership lookup: config candidates are complete backticked dotted identifiers and dotted JSON object keys, plus single-key fields explicitly introduced as config key. Segments allow identifier letters/digits/underscore/hyphen and indexed field segments; only syntactically marked templates are expanded against compiled role/provider/trigger vocabularies. A path written as answer field `path`, request field `path` or dispatch field `path` is a data-field reference, not a config key; the marker must directly introduce that code span, so a name cannot be excused by membership or a name allowlist. Mark literal file/path mentions and caller-language code examples by their existing path/code context rather than interpreting filenames or language APIs as config. JSON operation string values, operation consts and explicit cadence_query/apply operation references are operation candidates; /cad-* tokens and skills/cad-*/SKILL.md references are skill candidates, while explicitly named agents remain agents. Hook candidates are backticked names directly introduced by the words "hook event" in compiled instructions only; a bare word such as the checkpoint kind Stop (crates/cadence/src/execution/instructions.rs:64, :259-262) is not a candidate. Resolve them against the test's handwritten set {PreToolUse}, taken from the production guard's named-event acceptance in crates/cadence/src/guard/mod.rs:169 and crates/cadence/src/guard/bash.rs:459, not from hooks/hooks.json. At HEAD no compiled instruction names a hook event, so this kind asserts nothing until an instruction names one. Unknown candidates must not disappear through known-name filtering. Annotate the actual instruction text's data-field references as needed, including landing's git.remote.base_head, and regenerate the affected rendered skills. Keep the true config references (including workflow.test_command, workflow.lint_command and debug's memory.backend/review.consult fields) explicit. The notes enumerate the HEAD classification and red-commit procedure. Assert only that the real rendered corpus returns no unresolved config key, wire operation, skill or hook event, with every failure naming its surface, kind and token. No invented-name inputs or mutated corpus copies are written. T7's repository-path clause is not delivered here and has no scheduled home, tracked as GH-282.

Keep other D-214 work separate from this check. Task 3 owns rendered_files_obey_named_byte_ceilings and the unchanged literal ceiling table. Write schema_defaults_match_their_declared_domain using only defaults in the real embedded schema and their declared domains; handle explicit null and retired keys according to existing native schema semantics. No wrong-type/default control and no cloned JSON Schema engine. Check native supported-effort values as a separate value responsibility, reusing existing adequate tests. The verifier traces hooks/hooks.json's matcher, guard command and timeout as an artifact; write no guard-manifest text-pin test. Audit concrete config readers, including dynamic families and migration handling of dead keys, as verifier trace; do not claim a schema mention or static reader-name table proves reachability. Correct actual stale names if found and regenerate affected rendered artifacts; every changed untested production decision gets an independent Rust test under the same rules. Runtime filesystem state, live clocks and external programs are absent from these tests.

HEAD import census: KEEP seam-io (many CLIs), surface-weight (weight/review-provider/prose-agreement), rung-agent (route/planning/core and tests), gate-agreement (route), global-only-keys (config-merge), frontmatter (resident-weight), deferred-reads (prose-agreement and own tests), refusal-hints (reason-census and own tests), arg-contract (many CLIs). DELETE config-reach (only self-verify), dispatch-phrasing, route-relay, merge-warnings, reference-routers, include-consumers, text-transport, bulk-output, scratch-path, capture-writers and hook-events (otherwise only their retiring tests). Recheck imports as artifact tracing and delete self-verify.mjs/self-verify.test.mjs plus those eleven exclusive modules and the nine dedicated tests in the lease. Remove the self-verify CONTRACTS row and corresponding PINNED/count entries, deleted names in test.mjs, and census rows whose holders were deleted. These are retirement edits, not new Node tests or a source-scan suite. Remove release.yml's Node self-verify invocation, CONTRIBUTING's command/claim and METHOD's live path/claims/table row; point maintainers to the native lint and existing workspace CI consumer. Update weight/budget and helper/census metadata only where retirement changes their claims. The verifier traces deletions and surviving imports; no Rust test reads the tree to assert absence.
- **Verify:**
  - cargo nextest run -p cadence --bin cadence instruction_lint::compiled_instructions_name_only_what_exists
  - cargo nextest run -p cadence --bin cadence instruction_lint::schema_defaults_match_their_declared_domain

### Task 3: Check real rendered byte sizes and trace retirement metadata

- **ID:** P17-7-T3
- **Files:** cadence-core/bin/census-registry.test.mjs, cadence-core/bin/lib/census-registry.mjs, cadence-core/bin/helper-census.test.mjs, cadence-core/bin/arg-contract.test.mjs, cadence-core/bin/weight-budgets.json, crates/cadence/src/instruction_lint.rs
- **Action:** Leave the archived-plan self-verify path strings in why-record.test.mjs untouched: they are historical input, not imports or live invocations. Do not run that file: its top-level setup invokes git even when a test-name filter is supplied. Trace remaining imports and retired metadata through the actual patch, recording the eleven library/nine test deletions and nine shared survivors for the verifier. Point retained rendered-file metadata to guard/tests.rs::rendered_skill_files_are_protected, the existing 24 pin, and byte-budget metadata to the new Rust budget unit. Do not register a source-scanning git census; describe plan 6's structural launch gate truthfully. Limit frozen-table/test edits to removing retired entries/references and correcting claims; add no JavaScript test dependency and do not retrofit unrelated frozen suites. If this task changes production judging logic beyond retirement metadata, isolate it in its owning production module and add a Rust one-behavior test of that unit; the lint remains test-only. Check generated-file parity as an artifact comparison by the executor/verifier, outside any unit test; do not feed historical fixture prose into present-tense compiled-name validation. This task owns the new top-level instruction_lint::rendered_files_obey_named_byte_ceilings test, moved from task 2 so its verify names work it delivers. Use only the 24 real rendered outputs from task 1 and their literal UTF-8 ceilings: cad-help 1024; cad-spike 6144; cad-debug 15360; cad-undo 4096; cad-land 8192; cad-milestone 6144; cad-suggest 1536; cad-why 4096; cad-progress 1024; cad-capture 1536; cad-context 24576; cad-plan 57344; cad-executor-contract 28672; cad-execute 20480; cad-verifier-contract 18432; cad-verify 18432; cad-review 12288; cad-decision-review 12288; cad-minimalism-review 12288; cad-plan-review 12288; cad-audit 9216; cad-coverage 9216; cad-read-contract 6144; cad-task 32768. Assert each actual rendered size against its named ceiling; no supplied at-ceiling/one-byte-over inputs, no separate production byte-budget API and no test of the checker. A missing named ceiling fails, and no runtime-derived ceiling may excuse growth. The assertion detects an actual rendered file exceeding its approved ceiling; the deletion and metadata edits are verifier-traced artifacts, not behavior this size assertion proves.
- **Verify:**
  - cargo nextest run -p cadence --bin cadence instruction_lint::rendered_files_obey_named_byte_ceilings

## Notes

D-214 and D-216. T7 uses the same binary instruction_surfaces dispatch as main.rs and renders all 24 registered files, executor dispatch/protocol, command_policy's four manifest variants and no-manifest branch, verification/context/plan, help descriptions and the compiled reviewer brief. hooks/hooks.json is excluded from the candidate corpus and is not embedded for the checker. Existing manifest language descriptions concern managed projects; this task adds no Python implementation, Cadence runner or helper. The check recognizes four compiled name kinds: config key, wire operation, skill and hook event. At HEAD no compiled instruction names a hook event, so the hook-event kind asserts nothing until an instruction names one; its known-name set is the test's handwritten {PreToolUse}, taken from production guard named-event acceptance (crates/cadence/src/guard/mod.rs:169 and crates/cadence/src/guard/bash.rs:459), not from hooks/hooks.json. The lint artifact keeps its id while its description/reason name the four-kind scope. T7's repository-path clause is not delivered by this plan and has no scheduled home, tracked as GH-282. Do not read the checkout or introduce a generated source census to conceal that gap. Byte ceilings, schema/default validity and reader tracing remain work, but independent responsibilities are not bundled into the one name-resolution check: real rendered sizes and real schema defaults get their own assertions; actual config-reader reachability is traced by the executor/verifier and is not inferred from a claimed reader table. Retired schema entries remain migration evidence, not live keys whose defaults or readers can be fabricated. Installed-file parity and deleted-file absence are artifact traces, never runtime filesystem assertions. Shared leases are sequential and disjoint: this plan owns main.rs instruction arms and its instruction_surfaces/test-only instruction_lint declarations, server.rs's small registry accessors and the reviewer-brief accessor; wire registries/types stay where they are and lib.rs needs no change; it preserves plan 4's serve/shutdown work and plan 5/6 registrations. Remove the published references to deleted CLI drivers and per-skill/schema/permission pins; no tools/list byte-bound or mcp pin is moved or recreated, and the existing guard pin stays 24.

Requirement dispositions (no REQUIREMENTS.md edit):
- CWT-02: carried by named per-rendered-file byte ceilings, tested independently of name resolution.
- CWT-03: old agent/frontmatter recognizer retires; no claim of a surviving deleted direct-tool/skill-permission pin.
- #44: compiled surface completeness is retained; the repository-path clause is not delivered and has no scheduled home (GH-282); old install directory census retires.
- #74: compiled skill-name resolution carried by T7; old agent preload mechanism retires.
- RNG-01: rung-file behavior recognizer retires; production renderer selection remains tested in-process.
- RNG-02: rung-file/effort recognizers retire; existing native routing semantics stay credited.
- ENF-02: compiled key/default validity remains; D-214's reader clause (every schema key has a reader) is traced once by the verifier under artifact/compiled-instruction-lint and has no standing check, tracked with the path clause as GH-282; retired-key classification stays intact.
- TRN-01: shell argument text recognizer retires; typed wire values remain the native transport.
- TRN-02: scratch-file/bulk shell redirection recognizer retires; native bounded answers stay credited.
- HNT-02: hint-field recognizer retires under ruling P9; code/reason/rule/slot remains the refusal shape.
- HOK-02: explicit hook-event names in compiled instructions resolve against the handwritten {PreToolUse} set taken from production guard named-event acceptance, not from hooks/hooks.json; at HEAD no compiled instruction names a hook event, so this kind asserts nothing until an instruction names one. hooks/hooks.json remains a verifier-traced artifact.
- CEN-01: retain unrelated frozen census data, retire rows with their holders and name actual Rust holders for render/budget metadata; git deadlines are enforced structurally, without a source census test.

Nine shared self-verify libraries and their surviving tests remain; eleven exclusive modules and nine dedicated tests are deleted as confirmed by the import audit. Historical fixture strings naming self-verify remain history. No Node test is scheduled, and the existing frozen suites are not retrofitted. D-215 heap work, requirement retirement and issue closes are outside this plan. Replaced on 2026-09-23 so its check follows the owner's 2026-09-22 test rules in place of the context's starting check. The check asserts only real rendered output for four name kinds. No standing test shows that the checker catches a bad name; candidate extraction and name resolution are test code, not a Cadence feature. D-214's reader clause (every schema key has a reader) is traced once by the verifier under artifact/compiled-instruction-lint and has no standing check, tracked with the path clause as GH-282. Installed artifact parity and assembled host/CI behavior remain unverified until the phase 18 live acceptance gate. Repository-path checking is undelivered under GH-282, not deferred to that live gate.

HEAD name audit and disposition: the five hand-written skills listed in task 2 exist under skills/ and are added only to the test module's name registry, which the verifier traces. cad-review-delivery (executor/debug) and cad-reviewer-contract (reviewer brief) must resolve through it; the other three are present in that same complete five-name set. No actually nonexistent config, operation, skill or hook name was found in the inspected HEAD corpus after distinguishing data fields from config. In particular workflow.test_command, workflow.lint_command, memory.backend, review.consult.attempt_threshold, review.consult.enabled and review.consult.tier exist in the native schema. No compiled instruction names a hook event; the test's {PreToolUse} comes from crates/cadence/src/guard/mod.rs:169. The brief's cad-reviewer is explicitly an agent, not /cad-* skill syntax. JSON operation names and explicit tool invocations resolve against the native operation declarations.

The strict field-marker grammar would still reject the following real unmarked data-field tokens at HEAD; none is a config key to invent or allowlist. Task 2 marks each occurrence as answer field, request field or dispatch field according to its actual prose, preserving the path value: context: truths.id, durable_decisions.id, decisions.id; execution: suite.state.repair_question, event.kind, lease.files, lease.directories, task.token, task.start, record.risk, record.recording, details.record, approval.submission.request_id, route.choice.agent, route.choice.model; landing: landing.release, git.remote.base_head; milestone: actions.close, actions.prune; plan: content.evidence_map, inventory.basis, plan-read.map_history, spec.expected, submission.plans, current.plans[N].evidence_map.items[j], submission.plans[i].content.evidence_map.items[j]; read: documents[i].identity.phase, documents[i].identity.plan; review: result.kind, result.target, result.material, result.intent, result.admission, dispatch.agent, dispatch.prompt, dispatch.model; task: task.token; verification: attempt.id, route.choice.agent, route.choice.model. Relative .kind/.value and explicitly templated attempt references stay field/template syntax. Debug's unquoted request.request_id, record.version, record.recall, record.consults, record.epoch, record.review and record.review.history; spike's record.version; milestone's newest.tag; plan's content.files; and verification's patch.basis are likewise written with field markers where normalized; the bare debug config references are explicitly marked as config keys. Language API examples (unittest.TestCase, jest.mock) are caller-project language examples, not config. Filename/path mentions remain the undelivered repository-path kind. There are no other unresolved four-kind names from this HEAD audit.

Red/green: under the newly stated strict grammar, the unmodified HEAD output would fail on those unmarked fields, including git.remote.base_head (source inspection, not an executed test); it does not contain an actually nonexistent four-kind name found by this audit. In task 2, first commit the test-only checker, both T2 tests (compiled_instructions_name_only_what_exists and schema_defaults_match_their_declared_domain), every other T2 test written into instruction_lint.rs, and main.rs's #[cfg(test)] mod instruction_lint; declaration against the existing production text; then run the named check and retain that real located assertion failure and commit. Do not edit instruction_lint.rs again before T2's completion commit; T3's later test addition comes only after T2 closes. Then apply the production field-marker corrections, regenerate the affected artifacts and record the green commit. This is a real-output grammar failure, not an invented-name fixture or proof that the checker catches a bad name. If the actual first run has no such assertion failure (for example earlier authorized work already normalized the text), do not manufacture a red by changing test inputs, omitting a real authority, breaking compilation or inventing a stale name: retain the passing result and report the missing red record for owner resolution before execution completion.

The guard matcher/command/timeout is a verifier-traced hooks/hooks.json artifact, not a text-pin test. Task 3 owns the real rendered-byte test and literal ceilings so its sole verify targets its own work; deletion and frozen metadata work remain artifact traces. artifact/self-verify-retirement is limited to the release workflow, CONTRIBUTING.md and METHOD.md. README.md:112, DESIGN.md:335 (and its other current self-verify claims) and docs/EVIDENCE.md:70-77 wait for the prose crawl, GH-279, and are not leased.
