---
phase: 40
plan: 3
requirements: ["T6"]
files: ["crates/cadence/src/read/measurement.rs","crates/cadence/src/read/measurement/tests.rs","crates/cadence/src/read/model.rs","crates/cadence/src/read/document.rs"]
directories: []
execution: {"schema":1,"suite":"cargo nextest run --workspace --no-fail-fast","tasks":[{"id":"P40-3-T1","verify":["cargo nextest run -p cadence --lib read::measurement::tests::transcript_reads_are_counted_by_kind"]},{"id":"P40-3-T2","verify":["cargo nextest run -p cadence --lib read::measurement::tests::every_agent_call_in_the_episode_selects_its_worker","cargo nextest run -p cadence --lib read::measurement::tests::an_episode_without_agent_calls_selects_no_worker","cargo nextest run -p cadence --lib read::measurement::tests::the_report_lists_each_kind_with_its_calls_and_bytes","cargo nextest run -p cadence --lib read::measurement::tests::a_rollout_is_selected_by_its_session_id"]}]}
---
## Goal

The read measurement counts reads by kind with the bytes each returned, for a Claude session between two turns with every subagent and for a Codex rollout, and counts what it cannot classify as unclassified.

## Must be true when done

- T6. When the owner measures a host episode, the owner sees for a Claude session episode and a Codex rollout alike, native reads (whole and ranged Read, Grep, Glob, shell reads) and Cadence reads (search, symbol-search, call-search, read, document) counted by kind with the bytes each returned, and records it cannot classify counted as unclassified.

## Context

At HEAD a57528fd, read at that commit. read/measurement.rs:44-151 (resolve) reads $HOME/.claude/projects/<encoded project>/<session>.jsonl, selects the main parent chain between the first and last turn (round_chain, :184-207), and follows workers only from Agent calls whose subagent_type is cad-planner (:88; agent_calls, :230-235), refusing a round with no such worker (:127-129). measure (:237-356) keeps the totals read_count, whole_file_reads and unclassified_reads with the four token components against BASELINE 183,000 (:12); it keeps no per-kind counts and no bytes. classify_read (:368-399) counts every cadence_query call and every Grep and Glob as one read, reads the project file in the middle of judging (source::content, :377) to decide whether a ranged Read covered the file, and counts every Bash outside six build and test prefixes as an unclassified read (:383-391); the test sweep listed it among functions that mix gathering and judging. Its only test, every_query_operation_counts_as_one_read (:401-418), pins the rule D-223 replaces. document.rs:531-542 serves the planner-round identity (model.rs:81-86) as one part, report, classification claude-planner-round; the document resolver's match (document.rs:285) is exhaustive. There is no Codex reader. A Codex rollout, ~/.codex/sessions/YYYY/MM/DD/rollout-<time>-<uuid>.jsonl (read on 2026-09-23), records each nested call as a line {type event_msg, payload {type item_completed, item}}, item.type McpToolCall (server, tool, arguments, result with content text items and structuredContent carrying the same answer) or CommandExecution (command, parsed_cmd entries typed read, search, list_files or unknown, aggregated_output). Counted in rollout-2026-09-23T12-26-12-01a0cf16-cbd7-7910-be17-2003ce72549d.jsonl on 2026-09-23, its item_completed items are McpToolCall 239 (every one cadence/cadence_query), CommandExecution 89, Reasoning 46, FileChange 16, AgentMessage 11 and UserMessage 1; the day's other rollouts add ContextCompaction (the 10:31 run among them) and Extension (kind web.search). Other lines are response_item, token_count and session records. A Claude tool_result's content is a string or an array of blocks whose text items carry the answer.

## Evidence map

```json
{
  "mode": "attached",
  "items": [
    {
      "kind": "check",
      "id": "check/transcript_reads_are_counted_by_kind",
      "spec": {
        "command": "cargo nextest run -p cadence --lib read::measurement::tests::transcript_reads_are_counted_by_kind",
        "expected": {
          "kind": "literal",
          "value": "Claude, as kind: calls, bytes: Read whole 1, 10; Read ranged 1, 20; Grep 1, 8; shell read 1, 30; unclassified 1, 5; cadence_query search 1, 40; cadence_query read 1, 50; cadence_query document 1, 60. Codex: cadence_query search 1, 100; cadence_query read 1, 200; shell read 2, 700; unclassified 3, 7. No other key in either map."
        },
        "test": {
          "file": "crates/cadence/src/read/measurement/tests.rs",
          "function": "transcript_reads_are_counted_by_kind"
        },
        "setup": "Claude records: one assistant record whose content holds tool_use blocks r1 Read {file_path /p/src/a.rs}, r2 Read {file_path /p/src/a.rs, offset 10, limit 20}, g1 Grep {pattern needle}, b1 Bash {command `cat src/a.rs`}, b2 Bash {command `make`}, and q1, q2, q3 mcp__cadence__cadence_query with operation search, read and document; one user record whose tool_result blocks answer r1 with a string of 10 bytes, r2 20, g1 8, b1 30, b2 5, and q1, q2, q3 with arrays of one text item of 40, 50 and 60 bytes. read_lines maps /p/src/a.rs to 100 lines. Codex records: item_completed McpToolCall server cadence, tool cadence_query, arguments operation search, result content one text item of 100 bytes and structuredContent {k: v}; the same for read with 200; McpToolCall cadence_apply (plan-submit) with 70; CommandExecution parsed_cmd [read] with aggregated_output of 300 bytes; parsed_cmd [search] with 400; parsed_cmd [unknown, `cargo nextest run`] with 7; an item_completed AgentMessage; an item_completed whose item type is Extension; an item_completed with no item; an event_msg token_count; a response_item line. Expected handwritten from D-223: each cadence_query operation its own kind, bytes from one copy of each answer, the unlimited Read whole and the ranged one ranged, `cat` a shell read, `make`, the unknown command, the Extension item and the item-less one unclassified (the last two with 0 bytes), cadence_apply, AgentMessage and the non-call lines not counted.",
        "call": "Call read::measurement::count_reads(Host::Claude, &claude, &read_lines) and count_reads(Host::Codex, &codex, &BTreeMap::new()), and compare each map to the handwritten one. No transcript, rollout, HOME, project file or clock is read.",
        "boundary": "read::measurement::count_reads, the per-kind read tally with returned bytes over one host's supplied transcript records",
        "fakes": []
      },
      "reason": "Catches every cadence_query call counted alike (search, read and document not apart), bytes dropped or Codex's two copies both counted (structuredContent added), a host's records ignored (either map empty), the unlimited Read not counted whole, an unknown command or unlisted Bash guessed as a read kind rather than counted unclassified, and an unrecognized or malformed Codex item dropped rather than counted unclassified.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "count_reads decides what the owner sees for both hosts: native and Cadence reads counted by kind with the bytes each returned, and unclassifiable records unclassified; the episode readers and the report lines are traced in artifact/host-episode-readers and artifact/per-kind-report."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/host-episode-readers",
      "spec": {
        "locators": [
          "crates/cadence/src/read/measurement.rs",
          "crates/cadence/src/read/model.rs",
          "crates/cadence/src/read/document.rs"
        ],
        "substance": "planner-round reads the main chain between two turns and every subagent select_workers reaches from its Agent calls, with no cad-planner restriction, and measures an episode with no worker rather than refusing it (select_workers tested by every_agent_call_in_the_episode_selects_its_worker and an_episode_without_agent_calls_selects_no_worker); DocumentIdentity::CodexRollout {session_id} resolves through document to one report part, selecting the rollout by rollout_for and counting its item_completed records with count_reads(Host::Codex), unrecognized items unclassified; read_lines is gathered before judging and classify_read is gone."
      },
      "reason": "T6 names a Claude session episode and a Codex rollout alike; restoring the cad-planner restriction or dropping the codex-rollout identity breaks this artifact.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "The check proves the tally; this is where each host's records are found and handed to it."
        }
      ]
    },
    {
      "kind": "artifact",
      "id": "artifact/per-kind-report",
      "spec": {
        "locators": [
          "crates/cadence/src/read/measurement.rs"
        ],
        "substance": "report_lines writes one `reads[<kind>]: <calls> calls, <bytes> bytes` line per kind into both reports; read_count, whole_file_reads and unclassified_reads are the tally's totals; SHELL_READ_PROGRAMS is a named constant; tested by the_report_lists_each_kind_with_its_calls_and_bytes and a_rollout_is_selected_by_its_session_id."
      },
      "reason": "The owner sees the counts only through the report body; a kind or its bytes missing from it breaks this artifact.",
      "associations": [
        {
          "truth_id": "T6",
          "truth_version": 1,
          "reason": "T6's observer is the owner, who reads the document report; this artifact is the report text carrying each kind and its bytes."
        }
      ]
    }
  ]
}
```

## Tasks

### Task 1: Count reads by kind with their bytes, delivering transcript_reads_are_counted_by_kind red then green

- **ID:** P40-3-T1
- **Files:** crates/cadence/src/read/measurement.rs, crates/cadence/src/read/measurement/tests.rs
- **Action:** Add to read/measurement.rs Host {Claude, Codex}, Tally {calls: u64, bytes: u64} and count_reads(host: Host, records: &[Value], read_lines: &BTreeMap<String, u64>) -> Result<BTreeMap<String, Tally>, Value>, a judging unit over supplied records that touches no filesystem, process or clock. Kinds, which are the report's keys: `Read whole`, `Read ranged`, `Grep`, `Glob`, `shell read`, `cadence_query <operation>` and `unclassified`.

Claude records: each tool_use block counts once by id; its bytes are the UTF-8 length of the matching tool_result's content (a string, or the sum of its text items). Read resolves its file_path through read_lines, the line counts of the Read paths the gatherer resolved inside the project: absent is unclassified; no limit is whole; a limit is whole only when the offset is absent or 1 and the limit covers the file's lines, otherwise ranged. Grep and Glob are themselves. Bash, after any leading `cd <dir> && ` segments of its trimmed command: one of the six non-read prefixes is not a read; a first word in SHELL_READ_PROGRAMS is a shell read; any other Bash is unclassified. mcp__cadence__cadence_query is `cadence_query <input.operation>`, unclassified without an operation. Any other tool whose name contains read, search, grep or glob in any case is unclassified; the rest are not reads. A counted read with no tool_result keeps HEAD's document-incomplete refusal.

Codex records: only lines {type event_msg, payload.type item_completed} are read. McpToolCall with server cadence and tool cadence_query is `cadence_query <arguments.operation>`, its bytes the UTF-8 length of result.content's text items only, and unclassified without an arguments.operation; another McpToolCall is unclassified when its tool name contains read, search, grep or glob and otherwise not a read. CommandExecution whose parsed_cmd is non-empty and entirely typed read, search or list_files is a shell read, any other is unclassified; its bytes are the UTF-8 length of aggregated_output. The item types the rollouts show that are not reads are named in KNOWN_NON_READ_ITEMS: AgentMessage, Reasoning, FileChange and UserMessage (rollout 12:26) and ContextCompaction (rollout 10:31). An item_completed whose item is missing, has no type, or has any other type (Extension, for one) is unclassified with 0 bytes, since no field of it is known to hold what it returned (CONTEXT.md:67).

Replace classify_read (:368-399) and route measure through count_reads, with read_lines gathered in resolve from each Read path (canonicalized, confined to the project, counted through source::content), so nothing that judges reads a file; read_count, whole_file_reads and unclassified_reads become the tally's totals (all reads, Read whole, unclassified). Replace the inline tests module (:401-418), whose one test pins every query operation as one read, with `#[cfg(test)] mod tests;` so crates/cadence/src/read/measurement/tests.rs is a tests-only file; write the check transcript_reads_are_counted_by_kind into it and commit it before the red run, with count_reads at its final signature returning an empty map, so the red run ends in the check's assertion failure. Do not edit measurement/tests.rs again before this task's completion commit.
- **Verify:**
  - cargo nextest run -p cadence --lib read::measurement::tests::transcript_reads_are_counted_by_kind

### Task 2: Measure a whole Claude episode and a Codex rollout, and report every kind

- **ID:** P40-3-T2
- **Files:** crates/cadence/src/read/measurement.rs, crates/cadence/src/read/measurement/tests.rs, crates/cadence/src/read/model.rs, crates/cadence/src/read/document.rs
- **Action:** Claude: move worker selection into select_workers(main: &[Value], workers: &[(String, Vec<Value>)]) -> Vec<usize>, a judging function over supplied records. Each worker is (the toolUseId of its .meta.json, its records); it returns, in order, the workers whose toolUseId is an Agent call in the selected main chain or in a worker already selected, followed to a fixed point, with no subagent type filter (agent_calls with None in place of cad-planner at :88). resolve reads every candidate's meta and records first (subagent_candidates, :209-228, unchanged), applies select_workers, validates the selected workers as it does today, and drops the refusal of a round with no worker (:127-129): an episode with none is measured from its main chain. round_chain, file acquisition and the refusals for unreadable, inconsistent or changing records are unchanged. The identity stays planner-round {phase, session_id, first_turn, last_turn} and its phase check stays. Add report_lines(counts: &BTreeMap<String, Tally>) -> String, one line `reads[<kind>]: <calls> calls, <bytes> bytes` per kind in key order, appended to the Claude report after unclassified_reads.

Codex: add DocumentIdentity::CodexRollout {session_id} (kind codex-rollout) to read/model.rs and resolve it in document.rs's match with one part, report, classification codex-rollout, revision the source digest. The gatherer lists the file names under $HOME/.codex/sessions/*/*/*/ and selects through rollout_for(names: &[String], session_id: &str) -> Result<usize, Value>: the one name of the form rollout-<time>-<session_id>.jsonl; none refuses document-not-found, several refuse document-ambiguous; the session id must pass valid_uuid (:153). It reads the rollout (unbounded, as the Claude reader is; GH-283), parses each line, and counts the records with count_reads(Host::Codex, ...). The Codex report is `Codex rollout measurement`, then host codex, session_id, source_digest (SHA-256 of the rollout bytes), read_count and unclassified_reads, then report_lines; it carries no token accounting.

After P40-3-T1 has closed, add to crates/cadence/src/read/measurement/tests.rs: every_agent_call_in_the_episode_selects_its_worker (main-chain Agent calls a1 with subagent_type general-purpose and a2 with cad-planner; workers (a1, records holding an Agent call a3), (a2, no calls), (a3, no calls) and (zz, no calls): indices 0, 1 and 2 selected, not 3; catches the cad-planner filter kept, a descendant not followed or an uncalled worker included); an_episode_without_agent_calls_selects_no_worker (a main chain with no Agent call and one worker (a9, no calls): nothing selected, which resolve measures rather than refuses; catches a worker selected without a call); the_report_lists_each_kind_with_its_calls_and_bytes (counts {Grep: 2 calls, 30 bytes; cadence_query read: 1 call, 50 bytes} give exactly `reads[Grep]: 2 calls, 30 bytes` newline `reads[cadence_query read]: 1 calls, 50 bytes` newline; catches a kind dropped or its bytes left out of what the owner sees) and a_rollout_is_selected_by_its_session_id (names rollout-2026-09-23T12-26-12-01a0cf16-cbd7-7910-be17-2003ce72549d.jsonl and rollout-2026-09-23T11-53-22-01a0cef8-bb58-7f22-8729-5c0e1e82b0f9.jsonl with session 01a0cf16-cbd7-7910-be17-2003ce72549d select index 0; a session id no name carries refuses document-not-found; two names ending in the same id refuse document-ambiguous; catches a prefix match or a silent first pick). Listing directories, reading bytes and digesting them are gathering and get no test.
- **Verify:**
  - cargo nextest run -p cadence --lib read::measurement::tests::every_agent_call_in_the_episode_selects_its_worker
  - cargo nextest run -p cadence --lib read::measurement::tests::an_episode_without_agent_calls_selects_no_worker
  - cargo nextest run -p cadence --lib read::measurement::tests::the_report_lists_each_kind_with_its_calls_and_bytes
  - cargo nextest run -p cadence --lib read::measurement::tests::a_rollout_is_selected_by_its_session_id

## Notes

D-223, D-224. Constants (D-224): SHELL_READ_PROGRAMS = cat, head, tail, less, more, nl, wc, grep, rg, find, ls, tree (a Claude Bash whose first word is one of these is a shell read); the six non-read Bash prefixes (cargo build, cargo check, cargo test, npm test, pnpm test, git status) and BASELINE 183,000 are unchanged.

Choices this plan makes, each within D-223. The kind of a cadence_query call is its operation, so search, symbol-search, call-search, read and document each count apart and any other operation counts under its own name, never as one undifferentiated read. A Read stays whole when it has no limit or when its range covers the file, as at HEAD, but the file's line count is gathered before judging and passed in (the owner's split-first ruling), so count_reads reads no file. Claude shell reads are classified by the command's first word after leading `cd <dir> &&` segments; Codex shell commands by Codex's own parsed_cmd types, where anything unknown is unclassified. The two hosts differ in what they record, and each uses what its record states; nothing is guessed. Codex bytes count result.content's text once and never structuredContent, which repeats the same answer. The Codex item types the rollouts show that are not reads (AgentMessage, Reasoning, FileChange, UserMessage in the 12:26 rollout; ContextCompaction in the 10:31 one) are named in KNOWN_NON_READ_ITEMS; any other or malformed item_completed counts unclassified with 0 bytes, as CONTEXT.md:67 states. Claude worker selection is split out of resolve into select_workers, judged over supplied records. The planner-round identity keeps its name and fields though it no longer requires a cad-planner worker; D-223 renames nothing. The Codex report carries no token accounting: T6 names reads and bytes only, so Codex tokens are not delivered.

Check. transcript_reads_are_counted_by_kind exercises read::measurement::count_reads over supplied records of both hosts: the one tally, applied to the two record formats the truth names. It catches every query counted alike, bytes dropped or counted twice, a host's records ignored, the unlimited Read not counted whole, an unknown command guessed as a read kind, and an unrecognized or malformed Codex item dropped. Constituent tests: the worker selection (every Agent call followed; none selected without one), the report's per-kind lines and the rollout selection.

Unverified or undelivered. Finding and reading the transcript and rollout files, their digests, the unchanged chain walk and the refusals that stay in resolve are gathering or unchanged code, traced and not unit-tested; the before and after numbers themselves (before: the four phase 17 Codex runs of 2026-09-23, rollouts 10:31, 11:07, 11:53 and 12:26, and one Claude episode the owner names; after: the first phase 39 runs) are the owner's to take in phase 18, and the report gates nothing. Transcript reads stay unbounded (GH-283, P5). docs/architecture/read-layer-measurement.md is not edited (P3).
