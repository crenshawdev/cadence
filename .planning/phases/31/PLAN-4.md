---
phase: 31
plan: 4
requirements: ["T7"]
files: ["crates/cadence/src/read/measurement.rs","crates/cadence/src/read/model.rs","crates/cadence/src/read/document.rs","crates/cadence/src/read/mod.rs","crates/cadence/src/read_service.rs","crates/cadence/src/server.rs","crates/cadence/tests/phase31_read_layer.rs","crates/cadence/tests/support/phase31_hosts.rs","crates/cadence/tests/support/phase31.rs","docs/architecture/read-layer-measurement.md","crates/cadence/src/read/instructions.rs","crates/cadence/src/plan/instructions.rs","crates/cadence/src/verification/instructions.rs","skills/cad-read-contract/SKILL.md","skills/cad-plan/SKILL.md","skills/cad-verifier-contract/SKILL.md","skills/cad-verify/SKILL.md","skills/cad-audit/SKILL.md","skills/cad-coverage/SKILL.md"]
directories: []
execution: {"schema":1,"suite":"cargo test --workspace --no-fail-fast","tasks":[{"id":"P31-4-T1","verify":["cargo test -p cadence --test phase31_read_layer phase31_planner_round_reports_reads_and_tokens -- --exact"]},{"id":"P31-4-T2","verify":["cargo run -p cadence -- read-instructions"]}]}
---
# Phase 31: The read layer - Plan 4

## Goal

At close the owner sees a real planner round's read count, zero whole-file reads and its observed token total beside the 183,000-token baseline.

## Must be true when done

- T7. When phase 31 closes, the owner sees the planner round's read count, its whole-file reads at zero, and its token total against the 3.7 median.

## Context

Execute after PLAN-3's actual host integration. D-151 and T7 are .planning/phases/31/CONTEXT.md:14 and .planning/phases/31/CONTEXT.md:28; the 183k close baseline is docs/architecture/read-layer.md:69. The stdio fixture boundary remains crates/cadence/tests/support/phase13.rs:22. This pass inspected a real Claude project session record and confirmed top-level session/turn UUIDs, message.id, tool_use blocks for Read/Bash/mcp__cadence__cadence_query, and message.usage with input/cache-creation/cache-read/output counters. That was schema inspection only, not a phase-close measurement.

No new purpose truth or observation is authored. T7's one function must use a real host-created transcript for a fresh real planning episode. Parsing a fixture JSONL, a hand-curated list of calls, or this pre-read-layer authoring pass would not cause T7's promised trigger. Model-generated plan quality is not the oracle; actual tool calls, output shapes and harness usage are.

### Owner-visible measurement contract

The report is a small process-record view produced by document, not a caller file and not the transcript itself. It reports the measured values even when the number exceeds 183000; no numerical reduction target was approved. The mandatory test command lacks --nocapture, so the implementation must write the real report through std::io::stdout().write_all and flush it to make successful measurement visible to the owner. A missing host record is unavailable evidence, never zero. Fixture-created host settings are disposable; no task searches unrelated owner sessions or rewrites host transcripts.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "P31-T7-C",
      "spec": {
        "command": "cargo test -p cadence --test phase31_read_layer phase31_planner_round_reports_reads_and_tokens -- --exact",
        "expected": {
          "kind": "property",
          "value": "The real nonempty round reports read_count > 0, whole_file_reads = 0, unclassified_reads = 0, a positive observed token_total, baseline_planner_median = 183000 and the arithmetic difference/ratio against that baseline, with host/session/round boundaries and source digest. Each read count equals the independently counted unique actual tool-use ids, and token_total equals input_tokens + cache_creation_input_tokens + cache_read_input_tokens + output_tokens from one final usage record per actual message id. Details/iterations are not added twice. No metric is estimated from characters or supplied by the model. Missing, incomplete, ambiguous or unclassifiable host records refuse/mark incomplete and cannot produce a zero or a passing phase-close report. The owner-visible stdout report is actually emitted. No assertion requires generated plan prose or a promised percentage saving."
        },
        "test": {
          "file": "crates/cadence/tests/phase31_read_layer.rs",
          "function": "phase31_planner_round_reports_reads_and_tokens"
        },
        "setup": "Build a fresh disposable Git project for this function, never copy or initialize the live rewrite. Use tests/support/phase13.rs Client: launch env!(CARGO_BIN_EXE_cadence) serve with the fixture project bound at startup, initialize JSON-RPC and call the real cadence_query/cadence_apply over stdio. Create regular source fixtures with handwritten Rust, JavaScript, Markdown, JSON and C units, ignored and out-of-scope sentinel files, and a Rust file larger than 24,576 bytes. Author a native context and native plan through the real binary's fixture-approved public publication flow so its .planning tree contains binary-rendered CONTEXT and PLAN; do not seed native records or use renderers as expected-value generators. Keep the same resident client alive while following issued locations. Only fixture content, host configuration and caller inputs are controlled. Use actual filesystem, parsers, resident routing, public serialization and child processes; no fake reader, parser, issuer, host, transcript, model response or store. After PLAN-3, launch a real Claude-host planner round on the function's fresh disposable phase 31 project, with the generated planner/read instructions and the real cadence MCP binary. Ask it to author a small real phase proposal using the known source units and native process records, stopping before owner publication. The harness itself must create its ordinary session JSONL. Capture the actual session id, start/end turn UUIDs, descendant planner-worker ids and record identity from that live run. The Rust fixture setup is outside the measured planner round. Do not synthesize/copy a transcript, replay canned tool calls, relabel this pre-read-layer dispatch as the measurement, or use model-generated numbers.",
        "call": "Use the actual stdio driver to call document for the planner-round identity (phase, Claude session id and actual first/last turn ids), which causes the binary to resolve and count the host record itself. Compare the returned measurement with an independent handwritten traversal/count of the actual JSONL events, using the explicit rules in this plan. Request an unavailable session/round identity as a refusal control. Emit the returned bounded owner report to the test process's real stdout via std::io::Write, so it remains visible on success under the mandated -- --exact command without relying on --nocapture.",
        "boundary": "Actual caller -> MCP stdio -> startup-bound resident -> real project records/source -> serialized public answer. Actual host tool invocation and harness-recorded result are also part of the subject.",
        "fakes": []
      },
      "reason": "Counting only Cadence calls, inventing zero for absent records or double-counting usage would hide direct file reads or misstate the phase's purpose measurement.",
      "associations": [
        {
          "truth_id": "T7",
          "truth_version": 1,
          "reason": "Counting only Cadence calls, inventing zero for absent records or double-counting usage would hide direct file reads or misstate the phase's purpose measurement."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P31-A-PLANNER-MEASUREMENT",
      "spec": {
        "locators": [
          "crates/cadence/src/read/measurement.rs",
          "crates/cadence/src/read/model.rs::DocumentIdentity",
          "crates/cadence/src/read/document.rs",
          "crates/cadence/tests/support/phase31_hosts.rs",
          "docs/architecture/read-layer-measurement.md"
        ],
        "substance": "The document identity planner-round resolves the Claude harness's real ~/.claude/projects/<encoded-bound-project>/<session>.jsonl and its explicitly correlated descendant records internally, without accepting or returning a record path. A bounded binary-rendered report contains read_count, per-channel counts, whole_file_reads, unclassified_reads, the four raw usage components, token_total, baseline 183000, difference and ratio, plus host/session/turn identity and source digest. The report explains the exact deduplication/round-selection grammar and preserves unknowns. The existing transcript is the authority; no third read log, synthetic event writer or model-authored metric is added."
      },
      "reason": "Without attributable raw-record counts the owner could not distinguish the promised zero from missing or fabricated evidence.",
      "associations": [
        {
          "truth_id": "T7",
          "truth_version": 1,
          "reason": "This is the read count and token comparison the owner must see at close."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "P31-A-MEASUREMENT-CLOSE-INSTRUCTIONS",
      "spec": {
        "locators": [
          "crates/cadence/src/read/instructions.rs",
          "crates/cadence/src/plan/instructions.rs",
          "crates/cadence/src/verification/instructions.rs",
          "skills/cad-plan/SKILL.md",
          "skills/cad-read-contract/SKILL.md",
          "skills/cad-verifier-contract/SKILL.md",
          "skills/cad-verify/SKILL.md",
          "docs/architecture/read-layer-measurement.md"
        ],
        "substance": "Compiled close guidance names the actual planner-round record identity and displays its binary-rendered measurement before reporting this purpose truth met. A failed/missing/incomplete measurement remains unmet through the existing item-verdict/completion contract, never a waiver or pass. It carries D-151's cycle-purpose obligation into later phase authoring, preserving owner-approved truth ids/versions rather than inventing an eighth truth or silently revising one. Claude is the specified measurable host here; a Codex round requires an owner-selected record source/adapter before it can replace this evidence."
      },
      "reason": "Closing without the real report or silently dropping the cycle-purpose obligation would make the measurement optional.",
      "associations": [
        {
          "truth_id": "T7",
          "truth_version": 1,
          "reason": "The owner must actually be shown the count and baseline comparison at phase close."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Measure an actual Claude planner round from its harness record

- **ID:** P31-4-T1
- **Files:** crates/cadence/src/read/measurement.rs, crates/cadence/src/read/model.rs, crates/cadence/src/read/document.rs, crates/cadence/src/read/mod.rs, crates/cadence/src/read_service.rs, crates/cadence/src/server.rs, crates/cadence/tests/phase31_read_layer.rs, crates/cadence/tests/support/phase31_hosts.rs, crates/cadence/tests/support/phase31.rs, docs/architecture/read-layer-measurement.md.
- **Action:** Deliver P31-T7-C and P31-A-PLANNER-MEASUREMENT. Write the complete live-round check first, run it and retain the real failing-test commit, then implement the read-only Claude record resolver and measurement as a document identity. Bind the project from server startup and derive the host's encoded project directory internally; accept only validated session/turn identities, never a caller path, supplied transcript or supplied metric. Locate the exact round's first/last UUID and parent chain; include its correlated planner subagents, exclude fixture setup and unrelated sessions/turns, and refuse ambiguity, missing usage, incomplete records or growing/inconsistent snapshots. Snapshot/hash the bytes actually counted without creating another activity log.

Count each unique actual tool_use id once. Read-count channels include native read/search/document calls, built-in Read/Grep/Glob, excerpt calls and Bash/other-tool commands that read project content; include read-only process-content operations if a caller still uses them. Treat direct Read without explicit bounded input, unbounded cat/open/read_text or equivalent shell/interpreter reads, whole-file tool results and any content-bearing fallback exposing a complete file as whole-file reads. Classify explicit ranges against actual served extent/known source identity so a limit covering the file is not mislabeled a slice. Do not whitelist Bash as non-reading or let a script/wrapper hide its contents: an unclassifiable read increments unclassified_reads and prevents a zero-read claim. The actual planner here is instructed to use only the three calls, so it should produce none of those ambiguous direct-read events. Distinguish compile/test child filesystem activity from reads the planner itself requested.

For each unique (session id, message.id) count its final complete message.usage once; sum input_tokens, cache_creation_input_tokens, cache_read_input_tokens and output_tokens. Retain the breakdown, do not sum output_tokens_details, cache-duration subtotals or iterations again, and flag inconsistent duplicate final usages. Render the measurement plus literal 183000 and comparison arithmetic. The baseline comes from the owner's approved design, not a newly measured 3.7 run; make its provenance explicit and avoid a savings assertion until the aggregation basis is matched. The check independently traverses the real record with handwritten rules and emits the actual report via raw stdout despite libtest capture. A canned zero, skipped host, model answer or invented log is never green. Finish the unchanged T7 function green against a real fresh host round.
- **Verify:** cargo test -p cadence --test phase31_read_layer phase31_planner_round_reports_reads_and_tokens -- --exact.

### Task 2: Make the observed number part of the close handoff

- **ID:** P31-4-T2
- **Files:** crates/cadence/src/read/instructions.rs, crates/cadence/src/plan/instructions.rs, crates/cadence/src/verification/instructions.rs, skills/cad-read-contract/SKILL.md, skills/cad-plan/SKILL.md, skills/cad-verifier-contract/SKILL.md, skills/cad-verify/SKILL.md, skills/cad-audit/SKILL.md, skills/cad-coverage/SKILL.md, docs/architecture/read-layer-measurement.md.
- **Action:** Deliver P31-A-MEASUREMENT-CLOSE-INSTRUCTIONS. Compose the close requirement into the shared read contract, planner output and verifier guidance, regenerating every affected skill in this task. Explain the document planner-round identity, selection of the actual round, source digest, raw token components, whole/unclassified counters and the 183000 comparator. Show the owner the actual binary report; retain nonzero or unknown results and let the existing evidence verdict/verification-complete contract refuse unmet T7. Do not add a new completion operation, eighth truth, observation item, synthetic reads store or a model-authored pass field. Later phase contexts must carry the owner-approved cycle-purpose truth in their allowed truth set; never manufacture ids/versions or force it into an already approved set.

Document that this planning dispatch had explicitly required direct reads and therefore is not the qualifying measurement. The close round is a new real Claude-host planning episode after the read layer is installed. A real Codex host is still required for T6, but its planner-round record format/location has not been selected for T7; record that owner decision rather than guessing ~/.codex layouts. Clarify that the historical median's raw samples/aggregation procedure were not supplied: report all measured components and the numeric comparison, and make any claimed like-for-like savings contingent on confirming that procedure. The project-free renderer's output is the narrow validation of this compiled artifact; the full T7 command remains the sole acceptance check.
- **Verify:** cargo run -p cadence -- read-instructions.

## Notes

Run these plans strictly in returned target order, one executor dispatch at a time. A later plan extends the committed result of its predecessor. Shared integration files are declared sequential extension leases, not competing implementations: PLAN-1 owns source operations and location issuance; PLAN-2 owns document resolution and named-scope integration; PLAN-3 owns instruction/host exposure; PLAN-4 owns measurement. In the shared test file each plan owns only its named functions; do not rewrite an earlier check's oracle or recorded red/green material. New module and test names are creation specifications, not assertions that those files/functions exist today.

Each task delivering a check writes that complete function first, runs its exact command, records the actual failing-test commit, implements, reruns the same command with unchanged test material, and records its passing commit under that task id. Inspect the red cause: missing credentials, missing host executables, transport setup failure or a skipped test is not a behavioral red. One check per truth, no observation items and no extra acceptance regressions. Existing regressions may be adapted to intentional public-shape changes without replacing the seven truth checks. Run only task verify commands while working; the executor runs the frontmatter suite once at plan close. Planning neither runs nor certifies any command.

All reads stay inside the bound project or a specifically resolved host record; no caller path field, no caller-created source range, no whole-file response or generic process-file fallback. A relative directory/glob in search is only the scoped filter explicitly retained by read-layer.md, never a read address. Process identities must never reveal storage paths in metadata, cursors, errors or wrapper output. The executor may write source and tests with edit tools. Existing native approvals, publication records, occurrence rules, admission, check history and verification stay authoritative. Typed authoring and digest-only publication changes belong to phase 32; dispatch-payload replacement and execution reporting belong to phase 33.
