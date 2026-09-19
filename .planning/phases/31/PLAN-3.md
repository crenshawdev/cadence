---
phase: 31
plan: 3
requirements: ["T6"]
files: ["crates/cadence/src/read/instructions.rs","crates/cadence/src/read/mod.rs","crates/cadence/src/server.rs","crates/cadence/src/main.rs","crates/cadence/src/plan/instructions.rs","crates/cadence/src/context/instructions.rs","crates/cadence/src/execution/instructions.rs","crates/cadence/src/verification/instructions.rs","crates/cadence/src/review/instructions.rs","crates/cadence/src/execution/render.rs","crates/cadence/src/review/invoking.rs","crates/cadence/src/review/provider/payload.rs","docs/architecture/read-layer-hosts.md","crates/cadence/tests/phase31_read_layer.rs","crates/cadence/tests/support/phase31_hosts.rs","crates/cadence/tests/support/phase31.rs","skills/cad-context/SKILL.md","skills/cad-plan/SKILL.md","skills/cad-executor-contract/SKILL.md","skills/cad-execute/SKILL.md","skills/cad-verifier-contract/SKILL.md","skills/cad-verify/SKILL.md","skills/cad-review/SKILL.md","skills/cad-decision-review/SKILL.md","skills/cad-minimalism-review/SKILL.md","skills/cad-plan-review/SKILL.md","skills/cad-audit/SKILL.md","skills/cad-coverage/SKILL.md","skills/cad-read-contract/SKILL.md","agents/cad-assumptions-analyzer-high.md","agents/cad-assumptions-analyzer-low.md","agents/cad-assumptions-analyzer-max.md","agents/cad-assumptions-analyzer-medium.md","agents/cad-assumptions-analyzer.md","agents/cad-executor-low.md","agents/cad-executor-max.md","agents/cad-executor-medium.md","agents/cad-executor-xhigh.md","agents/cad-executor.md","agents/cad-plan-checker-high.md","agents/cad-plan-checker-max.md","agents/cad-plan-checker-medium.md","agents/cad-plan-checker-xhigh.md","agents/cad-plan-checker.md","agents/cad-planner-low.md","agents/cad-planner-max.md","agents/cad-planner-medium.md","agents/cad-planner-xhigh.md","agents/cad-planner.md","agents/cad-reviewer-low.md","agents/cad-reviewer-max.md","agents/cad-reviewer-medium.md","agents/cad-reviewer-xhigh.md","agents/cad-reviewer.md","agents/cad-verifier-low.md","agents/cad-verifier-max.md","agents/cad-verifier-medium.md","agents/cad-verifier-xhigh.md","agents/cad-verifier.md","skills/cad-adopt/SKILL.md","skills/cad-assumptions-analyzer-contract/SKILL.md","skills/cad-capture/SKILL.md","skills/cad-config/SKILL.md","skills/cad-debug/SKILL.md","skills/cad-docs-verify/SKILL.md","skills/cad-health/SKILL.md","skills/cad-help/SKILL.md","skills/cad-land/SKILL.md","skills/cad-milestone/SKILL.md","skills/cad-new-project/SKILL.md","skills/cad-pause/SKILL.md","skills/cad-phase/SKILL.md","skills/cad-plan-checker-contract/SKILL.md","skills/cad-planner-contract/SKILL.md","skills/cad-progress/SKILL.md","skills/cad-report/SKILL.md","skills/cad-review-delivery/SKILL.md","skills/cad-reviewer-contract/SKILL.md","skills/cad-spike/SKILL.md","skills/cad-suggest/SKILL.md","skills/cad-task/SKILL.md","skills/cad-undo/SKILL.md","skills/cad-why/SKILL.md","crates/cadence/tests/mcp.rs"]
directories: []
execution: {"schema":1,"suite":"cargo test --workspace --no-fail-fast","tasks":[{"id":"P31-3-T1","verify":["cargo test -p cadence --test phase31_read_layer phase31_worker_hosts_receive_main_thread_answers -- --exact"]},{"id":"P31-3-T2","verify":["cargo test -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions -- --exact"]}]}
---
# Phase 31: The read layer - Plan 3

## Goal

Main threads and actual Claude/Codex workers discover one read contract and receive the same answers through their host's shared Cadence server.

## Must be true when done

- T6. When a worker calls the read layer from its own host, the worker gets the same answer the main thread gets.

## Context

Execute after PLAN-2. D-149 is .planning/phases/31/CONTEXT.md:13. The resident entrypoint is crates/cadence/src/main.rs:148 and its public server information currently has no read contract at crates/cadence/src/server.rs:571. The current planner still grants direct read tools at crates/cadence/src/plan/instructions.rs:7, the verifier asks to open artifacts at crates/cadence/src/verification/instructions.rs:12, the executor rung exposes separate readers at agents/cad-executor.md:4, and the old planner contract explicitly falls back to built-ins at skills/cad-planner-contract/SKILL.md:73. The existing metadata regression pins those old tools at crates/cadence/tests/mcp.rs:1219.

The [Claude subagent documentation](https://code.claude.com/docs/en/sub-agents) says named server references share the parent connection; an inline definition opens a separate connection. [Official OpenAI MCP documentation](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) documents stdio configuration and recommends server instructions for cross-tool constraints. These establish configuration mechanisms, not proof that this installed host's worker inherited a resident; T6 supplies that proof. The live untracked .mcp.json registers cadence serve, and is not rewritten or used as a fixture. No subagents are dispatched during this planning pass.

### Host evidence, not model judgment

The actual host worker is part of T6's trigger. Running the same Rust helper twice with different role strings would not cause it. The function compares raw actual tool results with handwritten values and the real parent result; it makes no assertion about the worker's explanation or engineering judgment. Configure host credentials through the owner's existing authorized host integration, keep test-created project/configuration state disposable, and never print credentials. Missing ability to run either real host is a visible execution prerequisite, not permission to weaken T6.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P31-T6-C",
      "spec": {
        "command": "cargo test -p cadence --test phase31_read_layer phase31_worker_hosts_receive_main_thread_answers -- --exact",
        "expected": {
          "kind": "property",
          "value": "Both actual workers discover the same three operations and return the same handwritten search units, slice text/ranges, outline rows, process slice, truncation semantics and named refusals as their host's main thread and the direct stdio oracle. Within each host session the worker can follow the main thread's issued location on that same resident, with no second source reader or new server process. Repeated reads do not become empty because another caller read first. Only opaque ids belonging to distinct independently initialized host episodes may differ; do not normalize away within-session location failures, content, bounds, omissions or refusal rules. Actual host tool results, not final model prose, establish success. Absent host/authentication/worker evidence makes the run explicitly unsuccessful, never skipped or passed."
        },
        "test": {
          "file": "crates/cadence/tests/phase31_read_layer.rs",
          "function": "phase31_worker_hosts_receive_main_thread_answers"
        },
        "setup": "Build a fresh disposable Git project for this function, never copy or initialize the live rewrite. Use tests/support/phase13.rs Client: launch env!(CARGO_BIN_EXE_cadence) serve with the fixture project bound at startup, initialize JSON-RPC and call the real cadence_query/cadence_apply over stdio. Create regular source fixtures with handwritten Rust, JavaScript, Markdown, JSON and C units, ignored and out-of-scope sentinel files, and a Rust file larger than 24,576 bytes. Author a native context and native plan through the real binary's fixture-approved public publication flow so its .planning tree contains binary-rendered CONTEXT and PLAN; do not seed native records or use renderers as expected-value generators. Keep the same resident client alive while following issued locations. Only fixture content, host configuration and caller inputs are controlled. Use actual filesystem, parsers, resident routing, public serialization and child processes; no fake reader, parser, issuer, host, transcript, model response or store. Use the common fresh project and handwritten expected search units, short slice, outline and process truth/task. Configure the real installed Claude host and the real installed Codex host against env!(CARGO_BIN_EXE_cadence) as the sole cadence MCP server in isolated fixture host settings. The Rust support driver establishes the main-thread oracle over real stdio; separately each real host main session issues the same requests and dispatches an actual worker with the generated role/agent material. Capture actual MCP request/results from the host, with parent/worker/session/process identities. Never substitute a synthetic clientInfo/role string, manually replayed worker call or a model-written account of its answer.",
        "call": "For each genuine host, have its main thread search, then its actual worker read the location the host's main thread received and call search and document through the inherited cadence connection. Request an outline and a cut slice too. Repeat the main request after the worker and compare the real tool-result payloads, then run the foreign/unknown-token refusal control. Requests are scripted caller instructions; actual model/host behavior and tool results are not faked.",
        "boundary": "Actual caller -> MCP stdio -> startup-bound resident -> real project records/source -> serialized public answer. Actual host tool invocation and harness-recorded result are also part of the subject.",
        "fakes": []
      },
      "reason": "Instructions or routing that leave a real worker on built-in reads or a separate resident would break the same-answer property.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "Instructions or routing that leave a real worker on built-in reads or a separate resident would break the same-answer property."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P31-A-COMPILED-READ-INSTRUCTIONS",
      "spec": {
        "locators": [
          "crates/cadence/src/read/instructions.rs",
          "crates/cadence/src/server.rs::get_info",
          "crates/cadence/src/main.rs",
          "crates/cadence/src/plan/instructions.rs",
          "crates/cadence/src/context/instructions.rs",
          "crates/cadence/src/execution/instructions.rs",
          "crates/cadence/src/verification/instructions.rs",
          "crates/cadence/src/review/instructions.rs",
          "skills/cad-read-contract/SKILL.md"
        ],
        "substance": "One compiled read contract included in server initialization instructions, tool descriptions, every native role/front-door and dispatched worker instructions. It teaches search to find, read an issued location/name to inspect source, and document by process identity. Examples use issued tokens, identity selectors, continuations and named scopes; no caller file path, guessed range, whole-file request, separate excerpt tool or built-in fallback. The first server instruction paragraph is sufficient for a Codex main thread that has not preloaded a Cadence skill. A project-free read-instructions entry renders the identical contract and its generated internal skill. Preserve the acceptance Planner/Executor/Verifier obligations while explicitly interpreting artifact inspection as binary reads."
      },
      "reason": "A shared implementation cannot establish the boundary if compiled or dispatched instructions still direct a caller to another reader.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "Every real caller must discover and use the same read surface."
        },
        {
          "truth_id": "T7",
          "truth_version": 1,
          "reason": "The measured planner must be instructed to perform no whole-file reads."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P31-A-CALLER-ADAPTERS",
      "spec": {
        "locators": [
          "skills/",
          "agents/",
          "crates/cadence/tests/mcp.rs",
          "docs/architecture/read-layer-hosts.md",
          "crates/cadence/tests/support/phase31_hosts.rs"
        ],
        "substance": "Every skill and every agent rung removes read permissions/instructions for built-in Read/Grep/Glob, shell cat/grep/rg/skim/open-file recipes and separate excerpt MCP tools; it names the compiled cadence read contract and permits cadence_query directly. Source-edit tools remain available only to engineering roles. Native generated skills are regenerated from compiled authorities, not hand edited. Real Claude workers reference the already configured cadence server rather than defining a new one; real Codex workers use their host's shared MCP connection and receive the same server instructions. Host setup examples describe only the cadence server and operate on isolated fixture configuration in tests. Existing regression assertions pin the new metadata and generated bytes without certifying host behavior."
      },
      "reason": "An overlooked rung, stale generated skill or inline private server would leave a second read path or lose issued locations.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "The worker's actual host permissions and shared server must expose the common calls."
        },
        {
          "truth_id": "T7",
          "truth_version": 1,
          "reason": "No shipped instruction may request the direct reads that the planner-round measurement forbids."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Prove the actual worker-host read boundary

- **ID:** P31-3-T1
- **Files:** crates/cadence/src/read/instructions.rs, crates/cadence/src/read/mod.rs, crates/cadence/src/server.rs, crates/cadence/src/main.rs, crates/cadence/src/plan/instructions.rs, crates/cadence/src/context/instructions.rs, crates/cadence/src/execution/instructions.rs, crates/cadence/src/verification/instructions.rs, crates/cadence/src/review/instructions.rs, crates/cadence/src/execution/render.rs, crates/cadence/src/review/invoking.rs, crates/cadence/src/review/provider/payload.rs, docs/architecture/read-layer-hosts.md, crates/cadence/tests/phase31_read_layer.rs, crates/cadence/tests/support/phase31_hosts.rs, crates/cadence/tests/support/phase31.rs, skills/cad-context/SKILL.md, skills/cad-plan/SKILL.md, skills/cad-executor-contract/SKILL.md, skills/cad-execute/SKILL.md, skills/cad-verifier-contract/SKILL.md, skills/cad-verify/SKILL.md, skills/cad-review/SKILL.md, skills/cad-decision-review/SKILL.md, skills/cad-minimalism-review/SKILL.md, skills/cad-plan-review/SKILL.md, skills/cad-audit/SKILL.md, skills/cad-coverage/SKILL.md, skills/cad-read-contract/SKILL.md, agents/cad-assumptions-analyzer-high.md, agents/cad-assumptions-analyzer-low.md, agents/cad-assumptions-analyzer-max.md, agents/cad-assumptions-analyzer-medium.md, agents/cad-assumptions-analyzer.md, agents/cad-executor-low.md, agents/cad-executor-max.md, agents/cad-executor-medium.md, agents/cad-executor-xhigh.md, agents/cad-executor.md, agents/cad-plan-checker-high.md, agents/cad-plan-checker-max.md, agents/cad-plan-checker-medium.md, agents/cad-plan-checker-xhigh.md, agents/cad-plan-checker.md, agents/cad-planner-low.md, agents/cad-planner-max.md, agents/cad-planner-medium.md, agents/cad-planner-xhigh.md, agents/cad-planner.md, agents/cad-reviewer-low.md, agents/cad-reviewer-max.md, agents/cad-reviewer-medium.md, agents/cad-reviewer-xhigh.md, agents/cad-reviewer.md, agents/cad-verifier-low.md, agents/cad-verifier-max.md, agents/cad-verifier-medium.md, agents/cad-verifier-xhigh.md, agents/cad-verifier.md.
- **Action:** Deliver P31-T6-C and the compiled/native-host portions of both artifacts. Write the complete genuine-host T6 function red before changing worker exposure; retain actual host evidence of the failing boundary. Add the single compiled read instruction fragment, include it in MCP ServerInfo instructions and the advertised query contract, and compose it into context/planner/executor/verifier/review role outputs and worker dispatch text. Add a project-free read-instructions renderer. Regenerate affected native skills from the same binary in this task. Do not turn the source modules or generated Markdown into the T6 acceptance subject.

Update every agent rung to permit cadence_query, preload the shared read contract, remove built-in/standalone read tools, and reference the already configured cadence connection. Retain write/edit permissions only for roles already authorized to engineer source. Preserve role selection/model policy and all existing dispatch/approval semantics. A provider prompt gets the same compiled read rule when it is a tool-capable worker; do not invent file access for a provider that has no tools.

The host check must launch actual Claude and Codex host sessions with their real child-worker mechanism, using disposable settings and the real Cadence binary on stdio as tests/support/phase13.rs does. The host's own main/worker requests share its resident; a second test resident may provide the handwritten oracle but cannot be called a worker. Record native request/result events and process/session identities. Claude agents use a named server reference/inheritance, not an inline cadence definition. Codex's MCP transport must likewise stay host-shared; if the installed host cannot preserve this, expose the failure and return it for owner resolution instead of adding an alternate read service or fake bridge. No transcript/model/host stub, manufactured worker return, tool-name substitution, ignored test or silent credential-dependent pass. Document the real host prerequisites and actual supported setup, then obtain green only from both actual worker results.
- **Verify:** cargo test -p cadence --test phase31_read_layer phase31_worker_hosts_receive_main_thread_answers -- --exact.

### Task 2: Remove every remaining direct-file read instruction

- **ID:** P31-3-T2
- **Files:** skills/cad-adopt/SKILL.md, skills/cad-assumptions-analyzer-contract/SKILL.md, skills/cad-capture/SKILL.md, skills/cad-config/SKILL.md, skills/cad-debug/SKILL.md, skills/cad-docs-verify/SKILL.md, skills/cad-health/SKILL.md, skills/cad-help/SKILL.md, skills/cad-land/SKILL.md, skills/cad-milestone/SKILL.md, skills/cad-new-project/SKILL.md, skills/cad-pause/SKILL.md, skills/cad-phase/SKILL.md, skills/cad-plan-checker-contract/SKILL.md, skills/cad-planner-contract/SKILL.md, skills/cad-progress/SKILL.md, skills/cad-report/SKILL.md, skills/cad-review-delivery/SKILL.md, skills/cad-reviewer-contract/SKILL.md, skills/cad-spike/SKILL.md, skills/cad-suggest/SKILL.md, skills/cad-task/SKILL.md, skills/cad-undo/SKILL.md, skills/cad-why/SKILL.md, crates/cadence/tests/mcp.rs, skills/cad-read-contract/SKILL.md.
- **Action:** Finish P31-A-CALLER-ADAPTERS across every remaining skill, including the old planner, checker, assumptions-analyzer and reviewer contracts and the landing/help/support front doors. Remove affirmative instructions and tool permissions for Read, cat, grep, rg, Glob, skim or opening a project file; replace them with concrete search/read/document calls and the shared compiled contract. Remove the rule that a missing excerpt tool licenses built-in reads. Do not globally replace the English word read, change issue-open/publish instructions, or remove source-writing authority. Do not change frozen workflows to new implementations in this task; ensure a surviving skill cannot delegate a project read to those old recipes.

Update the existing skill_contract_matches_wire_patch_and_direct_tool_permissions regression for generated-byte equality and all actual agent rungs. It must inspect the entire skills/ and agents/ surfaces for the removed affirmative read recipes and separately recognize legitimate prohibitions and issue-opening language. This is maintenance of the adapter artifact, not another truth check. Keep the full T6 function unchanged. All changed native generated bytes were produced in task 1; if a shared fragment needs correction, regenerate its outputs in this plan's declared lease before closing.
- **Verify:** cargo test -p cadence --test mcp skill_contract_matches_wire_patch_and_direct_tool_permissions -- --exact.

## Notes

Run these plans strictly in returned target order, one executor dispatch at a time. A later plan extends the committed result of its predecessor. Shared integration files are declared sequential extension leases, not competing implementations: PLAN-1 owns source operations and location issuance; PLAN-2 owns document resolution and named-scope integration; PLAN-3 owns instruction/host exposure; PLAN-4 owns measurement. In the shared test file each plan owns only its named functions; do not rewrite an earlier check's oracle or recorded red/green material. New module and test names are creation specifications, not assertions that those files/functions exist today.

Each task delivering a check writes that complete function first, runs its exact command, records the actual failing-test commit, implements, reruns the same command with unchanged test material, and records its passing commit under that task id. Inspect the red cause: missing credentials, missing host executables, transport setup failure or a skipped test is not a behavioral red. One check per truth, no observation items and no extra acceptance regressions. Existing regressions may be adapted to intentional public-shape changes without replacing the seven truth checks. Run only task verify commands while working; the executor runs the frontmatter suite once at plan close. Planning neither runs nor certifies any command.

All reads stay inside the bound project or a specifically resolved host record; no caller path field, no caller-created source range, no whole-file response or generic process-file fallback. A relative directory/glob in search is only the scoped filter explicitly retained by read-layer.md, never a read address. Process identities must never reveal storage paths in metadata, cursors, errors or wrapper output. The executor may write source and tests with edit tools. Existing native approvals, publication records, occurrence rules, admission, check history and verification stay authoritative. Typed authoring and digest-only publication changes belong to phase 32; dispatch-payload replacement and execution reporting belong to phase 33.
