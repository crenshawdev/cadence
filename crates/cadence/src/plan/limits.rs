//! Fresh attached-map policy; retained records keep their historical grammar.
use super::{associations::Contribution, evidence::{Expected, Item}, model::Diagnostic};
use cadence::store::{Error, Result};
use serde_json::Value;

/// Refine existing typed decode failures, including the independently supplied
/// approval and replacement copies. This never tests blank content or approval.
pub fn malformed(raw: &Value) -> Option<Diagnostic> {
    for (submission, prefix) in [(&raw["submission"], "submission"),
        (&raw["approval"]["submission"], "approval.submission")]
    {
        let Some(plans) = submission["plans"].as_array() else { continue };
        for (entry, plan) in plans.iter().enumerate() {
            for (content, suffix) in [(&plan["content"], "content"),
                (&plan["replacement"]["content"], "replacement.content")]
            {
                if content["evidence_map"]["mode"] != "attached" { continue; }
                let Some(items) = content["evidence_map"]["items"].as_array() else { continue };
                for (index, item) in items.iter().enumerate() {
                    if !matches!(item["kind"].as_str(), Some("check" | "link")) { continue; }
                    if serde_json::from_value::<Item>(item.clone()).is_ok() { continue; }
                    let field = shape_field(item);
                    let id = item["id"].as_str().map(str::to_owned);
                    let rule = if id.is_some() && item["kind"] == "check" && field == "spec.command" {
                        "check-command"
                    } else if id.is_some() && item["kind"] == "check"
                        && matches!(field.as_str(), "spec.expected" | "spec.expected.kind" | "spec.expected.value") {
                        "check-expected"
                    } else { "evidence-item-shape" };
                    return Some(Diagnostic {
                        rule: rule.into(),
                        slot: format!("{prefix}.plans[{entry}].{suffix}.evidence_map.items[{index}].{field}"),
                        phase: submission["phase"].as_u64().and_then(|n| u32::try_from(n).ok()),
                        entry: Some(entry), id,
                        reason: format!("item {} has missing or malformed {field}; supply the advertised typed field", item["id"]),
                    });
                }
            }
        }
    }
    None
}

fn unknown(value: &Value, allowed: &[&str]) -> Option<String> {
    value.as_object()?.keys().find(|key| !allowed.contains(&key.as_str())).cloned()
}

fn shape_field(item: &Value) -> String {
    for field in ["id", "reason"] {
        if !item[field].is_string() { return field.into(); }
    }
    if let Some(field) = unknown(item, &["kind", "id", "spec", "reason", "associations"]) { return field; }
    let spec = &item["spec"];
    if !spec.is_object() { return "spec".into(); }
    let fields: &[&str] = if item["kind"] == "check" {
        &["command", "expected", "test", "setup", "call", "boundary", "fakes"]
    } else { &["caller", "callee", "value"] };
    for field in fields {
        let value = &spec[*field];
        let suffix = match *field {
            "expected" => {
                if !value.is_object() { Some(String::new()) }
                else if !matches!(value["kind"].as_str(), Some("literal" | "property")) { Some(".kind".into()) }
                else if !value["value"].is_string() { Some(".value".into()) }
                else { unknown(value, &["kind", "value"]).map(|s| format!(".{s}")) }
            }
            "test" => {
                if !value.is_object() { Some(String::new()) }
                else if let Some(key) = ["file", "function"].iter().find(|key| !value[**key].is_string()) {
                    Some(format!(".{key}"))
                } else { unknown(value, &["file", "function"]).map(|s| format!(".{s}")) }
            }
            "fakes" => match value.as_array() {
                None => Some(String::new()),
                Some(values) => values.iter().position(|v| !v.is_string()).map(|n| format!("[{n}]")),
            },
            _ => (!value.is_string()).then(String::new),
        };
        if let Some(suffix) = suffix { return format!("spec.{field}{suffix}"); }
    }
    if let Some(field) = unknown(spec, fields) { return format!("spec.{field}"); }
    if let Some(edges) = item["associations"].as_array() {
        for (index, edge) in edges.iter().enumerate() {
            if !edge.is_object() { return format!("associations[{index}]"); }
            for field in ["truth_id", "truth_version", "reason"] {
                let valid = if field == "truth_version" {
                    edge[field].as_u64().is_some_and(|n| u32::try_from(n).is_ok())
                } else { edge[field].is_string() };
                if !valid { return format!("associations[{index}].{field}"); }
            }
            if let Some(field) = unknown(edge, &["truth_id", "truth_version", "reason"]) {
                return format!("associations[{index}].{field}");
            }
        }
    }
    "associations".into()
}

pub fn base(contribution: &Contribution, index: usize) -> String {
    match contribution.entry {
        Some(entry) => format!("submission.plans[{entry}].content.evidence_map.items[{index}]"),
        None => format!("current.plans[{}].evidence_map.items[{index}]", contribution.plan),
    }
}

pub fn content(phase: u32, contributions: &[Contribution]) -> Result<()> {
    for contribution in contributions {
        for (index, item) in contribution.items.iter().enumerate() {
            if let Item::Check { spec, .. } = item {
                let expected = match &spec.expected { Expected::Literal(value) | Expected::Property(value) => value };
                for (value, rule, field) in [(&spec.command, "check-command", "command"),
                    (expected, "check-expected", "expected.value")]
                {
                    if value.trim().is_empty() {
                        return Err(Diagnostic {
                            rule: rule.into(), slot: format!("{}.spec.{field}", base(contribution, index)),
                            phase: Some(phase), entry: contribution.entry, id: Some(item.id().into()),
                            reason: format!("phase {phase} item {} needs nonblank {field}", item.id()),
                        }.error());
                    }
                }
            }
        }
    }
    Ok(())
}

/// These two transaction boundaries change the ordinary error disposition.
/// Preserve only our typed payload, never parse arbitrary Debug-wrapped text.
pub fn disposition(error: Error, convert: fn(String) -> Error) -> Error {
    match error {
        Error::Invalid(message) | Error::Conflict(message) if message.starts_with("plan-refusal:") => convert(message),
        other => convert(other.to_string()),
    }
}
