use super::{Host, Tally, count_reads, report_lines, rollout_for, select_workers};
use serde_json::json;
use std::collections::BTreeMap;

#[test]
fn transcript_reads_are_counted_by_kind() {
    let claude = vec![
        json!({"type": "assistant", "message": {"content": [
            {"type": "tool_use", "id": "r1", "name": "Read", "input": {"file_path": "/p/src/a.rs"}},
            {"type": "tool_use", "id": "r2", "name": "Read", "input": {"file_path": "/p/src/a.rs", "offset": 10, "limit": 20}},
            {"type": "tool_use", "id": "g1", "name": "Grep", "input": {"pattern": "needle"}},
            {"type": "tool_use", "id": "b1", "name": "Bash", "input": {"command": "cat src/a.rs"}},
            {"type": "tool_use", "id": "b2", "name": "Bash", "input": {"command": "make"}},
            {"type": "tool_use", "id": "q1", "name": "mcp__cadence__cadence_query", "input": {"operation": "search"}},
            {"type": "tool_use", "id": "q2", "name": "mcp__cadence__cadence_query", "input": {"operation": "read"}},
            {"type": "tool_use", "id": "q3", "name": "mcp__cadence__cadence_query", "input": {"operation": "document"}}
        ]}}),
        json!({"type": "user", "message": {"content": [
            {"type": "tool_result", "tool_use_id": "r1", "content": "a".repeat(10)},
            {"type": "tool_result", "tool_use_id": "r2", "content": "b".repeat(20)},
            {"type": "tool_result", "tool_use_id": "g1", "content": "c".repeat(8)},
            {"type": "tool_result", "tool_use_id": "b1", "content": "d".repeat(30)},
            {"type": "tool_result", "tool_use_id": "b2", "content": "e".repeat(5)},
            {"type": "tool_result", "tool_use_id": "q1", "content": [{"type": "text", "text": "f".repeat(40)}]},
            {"type": "tool_result", "tool_use_id": "q2", "content": [{"type": "text", "text": "g".repeat(50)}]},
            {"type": "tool_result", "tool_use_id": "q3", "content": [{"type": "text", "text": "h".repeat(60)}]}
        ]}}),
    ];
    let read_lines = BTreeMap::from([("/p/src/a.rs".into(), 100)]);
    assert_eq!(
        count_reads(Host::Claude, &claude, &read_lines).unwrap(),
        BTreeMap::from([
            ("Read whole".into(), Tally { calls: 1, bytes: 10 }),
            ("Read ranged".into(), Tally { calls: 1, bytes: 20 }),
            ("Grep".into(), Tally { calls: 1, bytes: 8 }),
            ("shell read".into(), Tally { calls: 1, bytes: 30 }),
            ("unclassified".into(), Tally { calls: 1, bytes: 5 }),
            ("cadence_query search".into(), Tally { calls: 1, bytes: 40 }),
            ("cadence_query read".into(), Tally { calls: 1, bytes: 50 }),
            ("cadence_query document".into(), Tally { calls: 1, bytes: 60 }),
        ])
    );

    let codex = vec![
        json!({"type": "event_msg", "payload": {"type": "item_completed", "item": {
            "type": "McpToolCall", "server": "cadence", "tool": "cadence_query", "arguments": {"operation": "search"},
            "result": {"content": [{"type": "text", "text": "s".repeat(100)}], "structuredContent": {"k": "v"}}
        }}}),
        json!({"type": "event_msg", "payload": {"type": "item_completed", "item": {
            "type": "McpToolCall", "server": "cadence", "tool": "cadence_query", "arguments": {"operation": "read"},
            "result": {"content": [{"type": "text", "text": "r".repeat(200)}], "structuredContent": {"k": "v"}}
        }}}),
        json!({"type": "event_msg", "payload": {"type": "item_completed", "item": {
            "type": "McpToolCall", "server": "cadence", "tool": "cadence_apply", "arguments": {"operation": "plan-submit"},
            "result": {"content": [{"type": "text", "text": "a".repeat(70)}]}
        }}}),
        json!({"type": "event_msg", "payload": {"type": "item_completed", "item": {
            "type": "CommandExecution", "parsed_cmd": [{"type": "read"}], "aggregated_output": "b".repeat(300)
        }}}),
        json!({"type": "event_msg", "payload": {"type": "item_completed", "item": {
            "type": "CommandExecution", "parsed_cmd": [{"type": "search"}], "aggregated_output": "c".repeat(400)
        }}}),
        json!({"type": "event_msg", "payload": {"type": "item_completed", "item": {
            "type": "CommandExecution", "parsed_cmd": [{"type": "unknown", "cmd": "cargo nextest run"}], "aggregated_output": "d".repeat(7)
        }}}),
        json!({"type": "event_msg", "payload": {"type": "item_completed", "item": {"type": "AgentMessage"}}}),
        json!({"type": "event_msg", "payload": {"type": "item_completed", "item": {"type": "Extension"}}}),
        json!({"type": "event_msg", "payload": {"type": "item_completed"}}),
        json!({"type": "event_msg", "payload": {"type": "token_count"}}),
        json!({"type": "response_item", "payload": {"type": "message"}}),
    ];
    assert_eq!(
        count_reads(Host::Codex, &codex, &BTreeMap::new()).unwrap(),
        BTreeMap::from([
            ("cadence_query search".into(), Tally { calls: 1, bytes: 100 }),
            ("cadence_query read".into(), Tally { calls: 1, bytes: 200 }),
            ("shell read".into(), Tally { calls: 2, bytes: 700 }),
            ("unclassified".into(), Tally { calls: 3, bytes: 7 }),
        ])
    );
}

#[test]
fn every_agent_call_in_the_episode_selects_its_worker() {
    let main = vec![json!({"message": {"content": [
        {"type": "tool_use", "id": "a1", "name": "Agent", "input": {"subagent_type": "general-purpose"}},
        {"type": "tool_use", "id": "a2", "name": "Agent", "input": {"subagent_type": "cad-planner"}}
    ]}})];
    let workers = vec![
        ("a1".into(), vec![json!({"message": {"content": [
            {"type": "tool_use", "id": "a3", "name": "Agent", "input": {"subagent_type": "general-purpose"}}
        ]}})]),
        ("a2".into(), vec![]),
        ("a3".into(), vec![]),
        ("zz".into(), vec![]),
    ];
    assert_eq!(select_workers(&main, &workers), vec![0, 1, 2]);
}

#[test]
fn an_episode_without_agent_calls_selects_no_worker() {
    let main = vec![json!({"message": {"content": [{"type": "text", "text": "planning"}]}})];
    let workers = vec![("a9".into(), vec![])];
    assert_eq!(select_workers(&main, &workers), Vec::<usize>::new());
}

#[test]
fn the_report_lists_each_kind_with_its_calls_and_bytes() {
    let counts = BTreeMap::from([
        ("Grep".into(), Tally { calls: 2, bytes: 30 }),
        ("cadence_query read".into(), Tally { calls: 1, bytes: 50 }),
    ]);
    assert_eq!(report_lines(&counts),
        "reads[Grep]: 2 calls, 30 bytes\nreads[cadence_query read]: 1 calls, 50 bytes\n");
}

#[test]
fn a_rollout_is_selected_by_its_session_id() {
    let names = vec![
        "rollout-2026-09-23T12-26-12-01a0cf16-cbd7-7910-be17-2003ce72549d.jsonl".into(),
        "rollout-2026-09-23T11-53-22-01a0cef8-bb58-7f22-8729-5c0e1e82b0f9.jsonl".into(),
    ];
    assert_eq!(rollout_for(&names, "01a0cf16-cbd7-7910-be17-2003ce72549d").unwrap(), 0);
}

#[test]
fn a_session_id_no_rollout_carries_is_not_found() {
    let names = vec![
        "rollout-2026-09-23T12-26-12-01a0cf16-cbd7-7910-be17-2003ce72549d.jsonl".into(),
        "rollout-2026-09-23T11-53-22-01a0cef8-bb58-7f22-8729-5c0e1e82b0f9.jsonl".into(),
    ];
    assert_eq!(rollout_for(&names, "01a0cf16-cbd7-7910-be17-2003ce725490").unwrap_err()["code"], "document-not-found");
}

#[test]
fn two_rollouts_with_one_session_id_are_ambiguous() {
    let names = vec![
        "rollout-2026-09-23T12-26-12-01a0cf16-cbd7-7910-be17-2003ce72549d.jsonl".into(),
        "rollout-2026-09-23T13-00-00-01a0cf16-cbd7-7910-be17-2003ce72549d.jsonl".into(),
    ];
    assert_eq!(rollout_for(&names, "01a0cf16-cbd7-7910-be17-2003ce72549d").unwrap_err()["code"], "document-ambiguous");
}

#[test]
fn a_session_id_that_is_not_a_uuid_is_refused() {
    let names = vec![
        "rollout-2026-09-23T12-26-12-01a0cf16-cbd7-7910-be17-2003ce72549d.jsonl".into(),
        "rollout-2026-09-23T11-53-22-01a0cef8-bb58-7f22-8729-5c0e1e82b0f9.jsonl".into(),
    ];
    assert_eq!(rollout_for(&names, "01a0cf16").unwrap_err()["code"], "document-identity");
}
