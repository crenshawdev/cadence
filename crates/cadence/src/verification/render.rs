//! The binary renders the owner's report from derived rows; no role authors it.
use serde_json::Value;

fn evidence(row: &Value) -> String {
    let items: Vec<_> = row["items"].as_array().map(|items| items.iter()
        .map(|i| format!("{} {}", i["id"].as_str().unwrap_or_default(), i["verdict"].as_str().unwrap_or_default())).collect())
        .unwrap_or_default();
    if items.is_empty() { "-".into() } else { items.join("; ") }
}

fn statuses(rows: &Value) -> String {
    rows.as_array().map(|rows| rows.iter()
        .map(|r| format!("; {} {}", r["id"].as_str().unwrap_or_default(), r["status"].as_str().unwrap_or_default())).collect())
        .unwrap_or_default()
}

pub fn text(report: &Value) -> String {
    let mut out = format!("# Verification report: phase {}\n", report["phase"]);
    let current = &report["current"];
    if current["applicable"] == true {
        out.push_str(&format!("Current: attempt {}, patch {}, HEAD {}, map {}\n",
            current["attempt"].as_str().unwrap_or_default(), current["patch"].as_str().unwrap_or_default(),
            current["verified_at"]["source"]["head"].as_str().unwrap_or_default(),
            current["verified_at"]["map_digest"].as_str().unwrap_or_default()));
    } else {
        out.push_str(&format!("Current: none - {}\n", current["reason"].as_str().unwrap_or_default()));
    }
    out.push_str("| truth | status | evidence |\n");
    for row in report["truths"].as_array().into_iter().flatten() {
        let status = match row["derived"].as_str() {
            Some(derived) => format!("{} (derived {derived})", row["status"].as_str().unwrap_or_default()),
            None => row["status"].as_str().unwrap_or_default().to_owned(),
        };
        out.push_str(&format!("| {} | {status} | {} |\n", row["id"].as_str().unwrap_or_default(), evidence(row)));
    }
    let counts = &report["counts"];
    if counts.is_object() {
        out.push_str(&format!("Counts: met {}, concerns {}, unmet {}, pending {}, waived {}\n",
            counts["met"], counts["concerns"], counts["unmet"], counts["pending"], counts["waived"]));
    }
    for row in report["truths"].as_array().into_iter().flatten().filter(|r| r["status"] == "waived") {
        out.push_str(&format!("Waived: {} by {} at {} - {}\n", row["id"].as_str().unwrap_or_default(),
            row["waiver"]["owner"].as_str().unwrap_or_default(), row["waiver"]["at"].as_str().unwrap_or_default(),
            row["waiver"]["reason"].as_str().unwrap_or_default()));
    }
    if let Some(advice) = report["advice"].as_str() {
        let mut sentence: Vec<char> = advice.chars().collect();
        if let Some(first) = sentence.first_mut() { *first = first.to_ascii_uppercase(); }
        out.push_str(&format!("{}.\n", sentence.into_iter().collect::<String>()));
    }
    out.push_str("History:\n");
    for entry in report["history"].as_array().into_iter().flatten() {
        out.push_str(&format!("- attempt {}: {} - {}{}\n", entry["attempt"].as_str().unwrap_or_default(),
            entry["applicability"].as_str().unwrap_or_default(), entry["reason"].as_str().unwrap_or_default(),
            statuses(&entry["truths"])));
    }
    let present = |document: &str| if report["legacy"][document] == true { "present" } else { "absent" };
    out.push_str(&format!("Legacy: SUMMARY {}, UAT {} - historical classification only, never native evidence.\n",
        present("summary_document"), present("uat_document")));
    out
}

/// One truth of a trace: its status, with the derived status and the
/// negative items when a waiver or a rejection is behind it.
fn truth_summary(row: &Value) -> String {
    let negatives: Vec<_> = row["items"].as_array().into_iter().flatten().filter(|i| i["verdict"] != "accepted")
        .map(|i| format!("{} {}", i["id"].as_str().unwrap_or_default(), i["verdict"].as_str().unwrap_or_default())).collect();
    let id = row["id"].as_str().unwrap_or_default();
    let status = row["status"].as_str().unwrap_or_default();
    match (row["derived"].as_str(), negatives.is_empty()) {
        (Some(derived), false) => format!("{id} {status} (derived {derived}: {})", negatives.join(", ")),
        (Some(derived), true) => format!("{id} {status} (derived {derived})"),
        (None, false) => format!("{id} {status} ({})", negatives.join(", ")),
        (None, true) => format!("{id} {status}"),
    }
}

/// The audit rendered from its derived traces; no role authors it.
pub fn audit_text(audit: &Value) -> String {
    let mut out = format!("# Verification audit: phase {}\n", audit["phase"]);
    out.push_str(&format!("Association: {} - {}\n", audit["association"]["kind"].as_str().unwrap_or_default(), audit["association"]["note"].as_str().unwrap_or_default()));
    let verification = &audit["sources"]["verification"];
    if verification["applicable"] == true {
        out.push_str(&format!("Verification: attempt {}, patch {}\n", verification["attempt"].as_str().unwrap_or_default(), verification["patch"].as_str().unwrap_or_default()));
    } else {
        out.push_str(&format!("Verification: none - {}\n", verification["reason"].as_str().unwrap_or_default()));
    }
    out.push_str("| requirement | outcome | break | detail |\n");
    for trace in audit["traces"].as_array().into_iter().flatten() {
        let (edge, detail) = match trace["breaks"].as_array().and_then(|b| b.first()) {
            Some(first) => (first["edge"].as_str().unwrap_or_default().to_owned(), first["reason"].as_str().unwrap_or_default().to_owned()),
            None => ("-".to_owned(), trace["truths"].as_array().into_iter().flatten().map(truth_summary).collect::<Vec<_>>().join("; ")),
        };
        out.push_str(&format!("| {} | {} | {edge} | {detail} |\n", trace["requirement"].as_str().unwrap_or_default(), trace["outcome"].as_str().unwrap_or_default()));
    }
    let counts = &audit["counts"];
    out.push_str(&format!("Counts: met {}, waived {}, concerns {}, unmet {}, pending {}, broken {}, out of scope {}\n",
        counts["met"], counts["waived"], counts["concerns"], counts["unmet"], counts["pending"], counts["broken"], counts["out_of_scope"]));
    for row in audit["out_of_scope"].as_array().into_iter().flatten() {
        out.push_str(&format!("Out of scope: {} ({}) - {}\n", row["requirement"].as_str().unwrap_or_default(), row["phase"].as_str().unwrap_or_default(), row["reason"].as_str().unwrap_or_default()));
    }
    for limit in audit["limits"].as_array().into_iter().flatten() {
        out.push_str(&format!("Limit: {}\n", limit.as_str().unwrap_or_default()));
    }
    out
}
