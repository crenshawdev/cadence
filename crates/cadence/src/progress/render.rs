use crate::derivation::{AcceptanceOverlay, Lifecycle, LifecycleStatus, RoadmapConflict};
use serde_json::{Value, json};
use std::fmt::Write;

pub fn status(status: LifecycleStatus) -> &'static str {
    match status {
        LifecycleStatus::Unplanned => "unplanned",
        LifecycleStatus::Planned => "planned",
        LifecycleStatus::Executed => "executed",
        LifecycleStatus::Complete => "complete",
    }
}

pub fn answer(
    project: &str, lifecycle: &Lifecycle, overlay: &AcceptanceOverlay,
    issues: &[RoadmapConflict], record: Value, captures: Value, next: &str,
) -> Value {
    let current = lifecycle.current.map_or("none".into(), |id| id.address());
    let name = lifecycle.phases.iter().find(|p| Some(p.id) == lifecycle.current)
        .map_or("Complete", |p| p.name.as_str());
    let mut text = format!("# progress: {project}, phase {current} of {}: {name}\n", lifecycle.total);
    let mut phases = Vec::new();
    for phase in &lifecycle.phases {
        let native = overlay.phases.get(&phase.id.address());
        let label = native.and_then(|p| p.label.as_deref());
        let word = match label.filter(|_| phase.status == LifecycleStatus::Complete) {
            Some("declared-at-import") => "complete (declared at import, unverified)",
            Some("declared-at-adoption") => "complete (declared at adoption, unverified)",
            Some(label) => label,
            None => status(phase.status),
        };
        writeln!(text, "phase {}: {} - {word}{}{}{}", phase.id.address(), phase.name,
            phase.uat.as_ref().filter(|_| native.is_none() || word.contains("declared")).map_or(String::new(), |uat| format!(" - UAT {} pass, {} fail{}", uat.pass, uat.fail,
                if uat.skipped == 0 { String::new() } else { format!(", {} skipped", uat.skipped) })),
            native.filter(|p| p.completion.is_some() && !word.contains("declared"))
                .map_or(String::new(), |p| format!(" - met {}, waived {}", p.met, p.waived)),
            if phase.plans.is_empty() || phase.status != LifecycleStatus::Planned { String::new() } else { format!(" - plans {}", phase.plans.len()) }).unwrap();
        let mut row = serde_json::to_value(phase).expect("phase record");
        if let Some(native) = native { row["acceptance"] = json!(native); }
        phases.push(row);
    }
    writeln!(text, "Issues: {}", issues.len()).unwrap();
    for issue in issues {
        writeln!(text, "  {} declares phase {} {}; derived {}", issue.source, issue.phase.address(),
            if issue.declared == "true" { "complete" } else { "incomplete" }, status(issue.status)).unwrap();
    }
    writeln!(text, "Record (phase {current}): {} routing decisions, {} refusals, {} gate fires",
        record["routing_decisions"], record["refusals"], record["gate_fires"]).unwrap();
    if let Some(refusals) = record["details"].as_array() {
        for refusal in refusals {
            writeln!(text, "  refused {} at {}, {}", refusal["code"].as_str().unwrap_or("unknown"),
                refusal["located"].as_str().unwrap_or("unrecorded"),
                refusal.get("at").map_or("unrecorded".into(), Value::to_string)).unwrap();
        }
    }
    writeln!(text, "Captures: {} active of {}{}", captures["active"], captures["bound"],
        if captures["exceeded"] == true { ", over bound" } else { "" }).unwrap();
    writeln!(text, "Next: {next}").unwrap();
    json!({"status":"ok", "text":text, "phases":phases, "issues":issues,
        "record":record, "dispatch":null, "captures":captures, "next":{"instruction":next}})
}

pub fn with_dispatch(mut answer: Value, dispatch: Option<crate::execution::history::InterruptedDispatch>) -> Value {
    if let Some(dispatch) = dispatch {
        let age = dispatch.generations_since_issue.map_or_else(|| "unknown".into(), |n| n.to_string());
        let line = format!("Dispatch: dispatch {} interrupted, no return; {age} generations since issue\n", dispatch.id);
        if let Some(text) = answer["text"].as_str() {
            // Captures is always the final block before Next; insert by line.
            let offset = text.rfind("\nCaptures:").map(|n| n + 1).expect("progress captures block");
            answer["text"] = json!(format!("{}{}{}", &text[..offset], line, &text[offset..]));
        }
        answer["dispatch"] = json!(dispatch);
    }
    answer
}
