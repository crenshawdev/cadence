//! Identity disagreements remain visible; approval never authorizes retargeting.
use super::model::{Answer, Submission, refused};

pub fn arguments(raw: &serde_json::Value) -> Option<Answer> {
    // Inspect only destination-bearing contract positions, never authored body
    // text or the plan's source lease. These are forbidden fields, not an API.
    let mut objects = vec![raw, &raw["submission"]];
    if let Some(plans) = raw["submission"]["plans"].as_array() {
        for plan in plans {
            objects.extend([plan, &plan["target"]]);
        }
    }
    for object in objects {
        for field in ["destination", "path", "target_path", "project_root", "root"] {
            if let Some(value) = object.get(field) {
                return Some(refused(
                    "path-confinement",
                    format!(
                        "forbidden {field} {value}; publication derives its canonical PLAN path from the bound phase and plan number"
                    ),
                ));
            }
        }
    }
    None
}

pub fn identities(submission: &Submission) -> Option<Answer> {
    for entry in &submission.plans {
        if entry.content.phase != entry.target.phase
            || entry.content.plan != entry.target.plan
            || entry.target.phase != submission.phase
        {
            return Some(refused(
                "identity-mismatch",
                format!(
                    "submitted phase {} plan {}, target phase {} plan {}, bound phase {}",
                    entry.content.phase,
                    entry.content.plan,
                    entry.target.phase,
                    entry.target.plan,
                    submission.phase
                ),
            ));
        }
    }
    None
}
