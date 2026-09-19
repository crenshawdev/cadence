use super::model::DocumentIdentity;
use serde_json::Value;

use crate::envelope::Refusal;
use sha2::{Digest, Sha256};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::{Path, PathBuf},
};

const BASELINE: u64 = 183_000;

pub struct Report {
    pub revision: String,
    pub body: String,
    pub worker_ids: Vec<String>,
    pub read_count: u64,
    pub whole_file_reads: u64,
    pub unclassified_reads: u64,
    pub token_total: u64,
}

struct Source {
    label: String,
    path: PathBuf,
    bytes: Vec<u8>,
    records: Vec<Value>,
}

#[derive(Default)]
struct Usage {
    input: u64,
    cache_creation: u64,
    cache_read: u64,
    output: u64,
}

fn refusal(code: &str, reason: impl Into<String>) -> Value {
    Refusal::new(code, reason).rule("D-151").slot("identity").value()
}

pub fn resolve(planning_root: &Path, identity: &DocumentIdentity) -> Result<Report, Value> {
    let DocumentIdentity::PlannerRound { phase, session_id, first_turn, last_turn } = identity else {
        return Err(refusal("document-identity", "the identity is not a planner round"));
    };
    for (field, value) in [("session id", session_id), ("first turn", first_turn), ("last turn", last_turn)] {
        if !valid_uuid(value) {
            return Err(refusal("document-identity", format!("planner-round {field} must be a UUID")));
        }
    }
    let project = planning_root.parent().and_then(|path| fs::canonicalize(path).ok())
        .ok_or_else(|| refusal("document-unavailable", "the bound project is unavailable"))?;
    let home = std::env::var_os("HOME").filter(|value| !value.is_empty())
        .ok_or_else(|| refusal("document-unavailable", "the Claude host home is unavailable"))?;
    let encoded: String = project.to_string_lossy().chars()
        .map(|character| if character.is_alphanumeric() || matches!(character, '-' | '_') {
            character
        } else {
            '-'
        }).collect();
    let host_root = PathBuf::from(home).join(".claude/projects").join(encoded);
    let main_path = host_root.join(format!("{session_id}.jsonl"));
    if !main_path.is_file() {
        return Err(refusal("document-not-found", "the requested Claude planner session is absent"));
    }
    let main_bytes = fs::read(&main_path)
        .map_err(|_| refusal("document-unavailable", "the requested Claude planner session cannot be read"))?;
    let main_records = records(&main_bytes)?;
    validate_record_scope(&main_records, &project, session_id)?;
    let selected_main = round_chain(&main_records, first_turn, last_turn)?;
    if selected_main.first().is_none_or(|record| record["type"] != "user")
        || selected_main.last().is_none_or(|record| record["type"] != "assistant"
            || record["message"]["stop_reason"].is_null())
    {
        return Err(refusal("document-incomplete", "the requested planner-round boundaries are not complete turns"));
    }

    let mut sources = vec![Source {
        label: format!("main:{session_id}.jsonl"),
        path: main_path,
        bytes: main_bytes,
        records: selected_main,
    }];
    let subagents = host_root.join(session_id).join("subagents");
    let candidates = subagent_candidates(&subagents)?;
    let mut pending = agent_calls(&sources[0].records, Some("cad-planner"));
    let mut included = BTreeSet::new();
    loop {
        let mut changed = false;
        for (path, meta_path) in &candidates {
            if included.contains(path) { continue }
            let meta_bytes = fs::read(meta_path)
                .map_err(|_| refusal("document-incomplete", "a planner worker correlation record is unavailable"))?;
            let meta: Value = serde_json::from_slice(&meta_bytes)
                .map_err(|_| refusal("document-incomplete", "a planner worker correlation record is invalid"))?;
            let Some(tool_id) = meta["toolUseId"].as_str() else {
                return Err(refusal("document-incomplete", "a planner worker correlation id is missing"));
            };
            if !pending.contains(tool_id) { continue }
            let bytes = fs::read(path)
                .map_err(|_| refusal("document-incomplete", "a planner worker record is unavailable"))?;
            let worker_records = records(&bytes)?;
            validate_record_scope(&worker_records, &project, session_id)?;
            let file_id = path.file_stem().and_then(|value| value.to_str())
                .and_then(|value| value.strip_prefix("agent-"))
                .filter(|value| !value.is_empty())
                .ok_or_else(|| refusal("document-incomplete", "a planner worker identity is invalid"))?;
            let worker_ids: BTreeSet<_> = worker_records.iter()
                .filter_map(|record| record["agentId"].as_str()).collect();
            if worker_ids != BTreeSet::from([file_id]) {
                return Err(refusal("document-ambiguous", "a planner worker record has inconsistent identity"));
            }
            pending.extend(agent_calls(&worker_records, None));
            sources.push(Source {
                label: format!("worker:{file_id}.jsonl"),
                path: path.clone(),
                bytes,
                records: worker_records,
            });
            included.insert(path.clone());
            changed = true;
        }
        if !changed { break }
    }
    if sources.len() == 1 {
        return Err(refusal("document-incomplete", "the requested round has no correlated Claude planner worker"));
    }
    let correlated_tools: BTreeSet<_> = candidates.iter().filter_map(|(_, meta_path)| {
        let bytes = fs::read(meta_path).ok()?;
        let meta: Value = serde_json::from_slice(&bytes).ok()?;
        meta["toolUseId"].as_str().map(str::to_owned)
    }).collect();
    if pending.iter().any(|tool| correlated_tools.contains(tool) && !sources.iter().skip(1).any(|source| {
        candidates.iter().any(|(path, meta)| path == &source.path && fs::read(meta).ok()
            .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok())
            .and_then(|value| value["toolUseId"].as_str().map(str::to_owned)).as_deref() == Some(tool))
    })) {
        return Err(refusal("document-incomplete", "a descendant planner worker record is missing"));
    }
    if subagent_candidates(&subagents)? != candidates {
        return Err(refusal("document-incomplete", "the Claude planner record changed during measurement"));
    }
    for source in &sources {
        if fs::read(&source.path).ok().as_deref() != Some(source.bytes.as_slice()) {
            return Err(refusal("document-incomplete", "the Claude planner record changed during measurement"));
        }
    }
    measure(&project, phase.get(), session_id, first_turn, last_turn, sources)
}

fn valid_uuid(value: &str) -> bool {
    value.len() == 36 && value.bytes().enumerate().all(|(index, byte)| {
        if matches!(index, 8 | 13 | 18 | 23) { byte == b'-' } else { byte.is_ascii_hexdigit() }
    })
}

fn records(bytes: &[u8]) -> Result<Vec<Value>, Value> {
    let text = std::str::from_utf8(bytes)
        .map_err(|_| refusal("document-incomplete", "a Claude planner record is not UTF-8"))?;
    text.lines().map(|line| serde_json::from_str(line)
        .map_err(|_| refusal("document-incomplete", "a Claude planner record contains invalid JSON")))
        .collect()
}

fn validate_record_scope(records: &[Value], project: &Path, session: &str) -> Result<(), Value> {
    if records.is_empty() {
        return Err(refusal("document-incomplete", "a Claude planner record is empty"));
    }
    for record in records {
        if record["sessionId"].as_str().is_some_and(|value| value != session) {
            return Err(refusal("document-ambiguous", "a Claude planner record contains another session"));
        }
        if let Some(cwd) = record["cwd"].as_str()
            && fs::canonicalize(cwd).ok().as_deref() != Some(project)
        {
            return Err(refusal("document-ambiguous", "a Claude planner record belongs to another project"));
        }
    }
    Ok(())
}

fn round_chain(records: &[Value], first: &str, last: &str) -> Result<Vec<Value>, Value> {
    let mut by_uuid = BTreeMap::new();
    for record in records {
        if let Some(uuid) = record["uuid"].as_str()
            && by_uuid.insert(uuid, record).is_some()
        {
            return Err(refusal("document-ambiguous", "the Claude planner record repeats a turn UUID"));
        }
    }
    let mut selected = BTreeSet::new();
    let mut cursor = last;
    loop {
        if !selected.insert(cursor) {
            return Err(refusal("document-ambiguous", "the planner-round parent chain contains a cycle"));
        }
        let record = by_uuid.get(cursor)
            .ok_or_else(|| refusal("document-not-found", "a requested planner-round turn is absent"))?;
        if cursor == first { break }
        cursor = record["parentUuid"].as_str()
            .ok_or_else(|| refusal("document-incomplete", "the planner-round parent chain ends before its first turn"))?;
    }
    Ok(records.iter().filter(|record|
        record["uuid"].as_str().is_some_and(|uuid| selected.contains(uuid))).cloned().collect())
}

fn subagent_candidates(root: &Path) -> Result<Vec<(PathBuf, PathBuf)>, Value> {
    if !root.is_dir() {
        return Ok(Vec::new());
    }
    let mut found = Vec::new();
    for entry in fs::read_dir(root)
        .map_err(|_| refusal("document-unavailable", "the Claude planner workers cannot be listed"))?
    {
        let path = entry.map_err(|_| refusal("document-unavailable", "a Claude planner worker is unavailable"))?.path();
        if path.extension().and_then(|value| value.to_str()) != Some("jsonl") { continue }
        let mut meta = path.clone();
        meta.set_extension("meta.json");
        if !meta.is_file() {
            return Err(refusal("document-incomplete", "a planner worker correlation record is absent"));
        }
        found.push((path, meta));
    }
    found.sort();
    Ok(found)
}

fn agent_calls(records: &[Value], required_type: Option<&str>) -> BTreeSet<String> {
    records.iter().filter_map(|record| record.pointer("/message/content").and_then(Value::as_array))
        .flatten().filter(|block| block["type"] == "tool_use" && block["name"] == "Agent"
            && required_type.is_none_or(|kind| block["input"]["subagent_type"] == kind))
        .filter_map(|block| block["id"].as_str().map(str::to_owned)).collect()
}

fn measure(project: &Path, phase: u32, session_id: &str, first_turn: &str, last_turn: &str,
    sources: Vec<Source>) -> Result<Report, Value>
{
    let mut hasher = Sha256::new();
    let mut tool_ids = BTreeSet::new();
    let mut tool_results = BTreeSet::new();
    let mut read_tool_ids = BTreeSet::new();
    let mut whole_file_reads = 0;
    let mut unclassified_reads = 0;
    let mut assistant_messages = BTreeSet::new();
    let mut usages = BTreeMap::<(String, String), Value>::new();
    let mut worker_ids = Vec::new();
    let mut phase_seen = false;
    for source in &sources {
        hasher.update((source.label.len() as u64).to_be_bytes());
        hasher.update(source.label.as_bytes());
        hasher.update((source.bytes.len() as u64).to_be_bytes());
        hasher.update(&source.bytes);
        if let Some(worker) = source.label.strip_prefix("worker:").and_then(|value| value.strip_suffix(".jsonl")) {
            worker_ids.push(worker.to_owned());
        }
        for record in &source.records {
            let record_session = record["sessionId"].as_str().unwrap_or(session_id).to_owned();
            if let Some(content) = record.pointer("/message/content").and_then(Value::as_array) {
                for block in content {
                    if block["type"] == "tool_result"
                        && let Some(id) = block["tool_use_id"].as_str()
                    {
                        tool_results.insert(id.to_owned());
                    }
                    if block["type"] != "tool_use" { continue }
                    let id = block["id"].as_str()
                        .ok_or_else(|| refusal("document-incomplete", "an actual tool use has no identity"))?;
                    if !tool_ids.insert(id.to_owned()) { continue }
                    let name = block["name"].as_str().unwrap_or("");
                    let input = &block["input"];
                    if name == "mcp__cadence__cadence_query"
                        && (input["phase"].as_u64() == Some(u64::from(phase))
                            || input["phase"].as_str() == Some(&phase.to_string()))
                    {
                        phase_seen = true;
                    }
                    let (reads, whole, unclassified) = classify_read(project, name, input);
                    if reads > 0 { read_tool_ids.insert(id.to_owned()); }
                    whole_file_reads += whole;
                    unclassified_reads += unclassified;
                }
            }
            if record["type"] == "assistant" {
                let Some(message_id) = record.pointer("/message/id").and_then(Value::as_str) else { continue };
                let key = (record_session, message_id.to_owned());
                assistant_messages.insert(key.clone());
                if record["message"]["stop_reason"].is_null() { continue }
                let usage = record.pointer("/message/usage")
                    .ok_or_else(|| refusal("document-incomplete", "an assistant message has no final usage"))?;
                if let Some(previous) = usages.insert(key, usage.clone())
                    && previous != *usage
                {
                    return Err(refusal("document-ambiguous", "an assistant message has inconsistent final usage"));
                }
            }
        }
    }
    if !phase_seen {
        return Err(refusal("document-ambiguous", "the selected planner round does not identify the requested phase"));
    }
    if usages.keys().cloned().collect::<BTreeSet<_>>() != assistant_messages {
        return Err(refusal("document-incomplete", "an assistant message has no final usage"));
    }
    if read_tool_ids.iter().any(|id| !tool_results.contains(id)) {
        return Err(refusal("document-incomplete", "a counted read has no recorded tool result"));
    }
    let mut usage = Usage::default();
    for value in usages.values() {
        usage.input = add(usage.input, usage_field(value, "input_tokens")?)?;
        usage.cache_creation = add(usage.cache_creation, usage_field(value, "cache_creation_input_tokens")?)?;
        usage.cache_read = add(usage.cache_read, usage_field(value, "cache_read_input_tokens")?)?;
        usage.output = add(usage.output, usage_field(value, "output_tokens")?)?;
    }
    let token_total = [usage.input, usage.cache_creation, usage.cache_read, usage.output]
        .into_iter().try_fold(0, add)?;
    if token_total == 0 {
        return Err(refusal("document-incomplete", "the selected planner round has no observed token usage"));
    }
    worker_ids.sort();
    worker_ids.dedup();
    let read_count = read_tool_ids.len() as u64;
    let source_digest = format!("{:x}", hasher.finalize());
    let difference = i128::from(token_total) - i128::from(BASELINE);
    let ratio = token_total as f64 / BASELINE as f64;
    let body = format!(concat!(
        "Claude planner round measurement\n",
        "phase: {phase}\n",
        "host: claude-code\n",
        "session_id: {session_id}\n",
        "first_turn: {first_turn}\n",
        "last_turn: {last_turn}\n",
        "planner_worker_ids: {worker_ids}\n",
        "source_digest: {source_digest}\n",
        "read_count: {read_count}\n",
        "whole_file_reads: {whole_file_reads}\n",
        "unclassified_reads: {unclassified_reads}\n",
        "input_tokens: {input_tokens}\n",
        "cache_creation_input_tokens: {cache_creation_input_tokens}\n",
        "cache_read_input_tokens: {cache_read_input_tokens}\n",
        "output_tokens: {output_tokens}\n",
        "token_total: {token_total}\n",
        "baseline_planner_median: 183000\n",
        "difference_from_baseline: {difference}\n",
        "ratio_to_baseline: {token_total}/183000 = {ratio:.6}\n",
        "baseline_provenance: owner-approved Cadence 3.7 planner median\n",
        "comparison_note: like-for-like savings require the historical aggregation procedure\n",
    ), phase=phase, session_id=session_id, first_turn=first_turn, last_turn=last_turn,
        worker_ids=worker_ids.join(","), source_digest=source_digest, read_count=read_count,
        whole_file_reads=whole_file_reads, unclassified_reads=unclassified_reads,
        input_tokens=usage.input, cache_creation_input_tokens=usage.cache_creation,
        cache_read_input_tokens=usage.cache_read, output_tokens=usage.output,
        token_total=token_total, difference=difference, ratio=ratio);
    Ok(Report { revision: source_digest, body, worker_ids, read_count, whole_file_reads, unclassified_reads, token_total })
}

fn usage_field(usage: &Value, field: &str) -> Result<u64, Value> {
    usage[field].as_u64()
        .ok_or_else(|| refusal("document-incomplete", format!("final usage is missing {field}")))
}

fn add(left: u64, right: u64) -> Result<u64, Value> {
    left.checked_add(right)
        .ok_or_else(|| refusal("document-incomplete", "planner-round token arithmetic overflowed"))
}

fn classify_read(project: &Path, name: &str, input: &Value) -> (u64, u64, u64) {
    if name == "mcp__cadence__cadence_query" { return (1, 0, 0) }
    if matches!(name, "Grep" | "Glob") { return (1, 0, 0) }
    if name == "Read" {
        let Some(path) = input["file_path"].as_str() else { return (1, 0, 1) };
        let path = PathBuf::from(path);
        let path = if path.is_absolute() { path } else { project.join(path) };
        let Ok(path) = fs::canonicalize(path) else { return (1, 0, 1) };
        if !path.starts_with(project) { return (1, 0, 1) }
        let Ok(content) = fs::read_to_string(path) else { return (1, 0, 1) };
        let total = content.lines().count() as u64;
        let offset = input["offset"].as_u64().unwrap_or(1).max(1);
        let Some(limit) = input["limit"].as_u64() else { return (1, 1, 0) };
        return (1, u64::from(offset == 1 && limit >= total), 0);
    }
    if name == "Bash" {
        let command = input["command"].as_str().unwrap_or("");
        if ["cargo build", "cargo check", "cargo test", "npm test", "pnpm test", "git status"]
            .iter().any(|prefix| command.trim_start().starts_with(prefix))
        {
            return (0, 0, 0);
        }
        return (1, 0, 1);
    }
    let lower = name.to_ascii_lowercase();
    if lower.contains("read") || lower.contains("search") || lower.contains("grep")
        || lower.contains("glob")
    {
        return (1, 0, 1);
    }
    (0, 0, 0)
}

#[cfg(test)]
mod tests {
    use super::classify_read;
    use serde_json::json;
    use std::path::Path;

    /// Every `cadence_query` operation is a read through the boundary; the
    /// tool is the contract, not a hand-kept list of its operation names.
    #[test]
    fn every_query_operation_counts_as_one_read() {
        let project = Path::new("/nonexistent");
        for operation in ["search", "route", "config-facts", "verify-next", "execute-next", "review-next", "review-roster"] {
            let input = json!({"operation": operation});
            assert_eq!(classify_read(project, "mcp__cadence__cadence_query", &input), (1, 0, 0),
                "{operation} is a cadence_query operation and must count as one classified read");
        }
    }
}
