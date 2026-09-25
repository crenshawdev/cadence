//! Binary-owned projections for a rooted task: RECORD.md at done, PLAN.md at a
//! planned open. Both are deterministic renders of the store record; a host
//! Write or Edit to either is refused by the guard. Never hand-edited.
use super::model::{Mode, Risk, StoreRecord};
use std::fmt::Write;

fn mode_word(mode: Mode) -> &'static str {
    match mode { Mode::Inline => "inline", Mode::Planned => "planned" }
}

fn risk_line(risk: &Risk) -> String {
    match risk {
        Risk::Skipped => "skipped: no commits landed".into(),
        Risk::Clear { surfaces, gate, .. } =>
            format!("clear (surfaces: {}; gate: {gate})", surfaces.join(", ")),
        Risk::Advisory { matched, gate, .. } =>
            format!("advisory (matched: {}; gate: {gate})", matched.join(", ")),
        Risk::Blocked { matched, gate, .. } =>
            format!("blocked (matched: {}; gate: {gate})", matched.join(", ")),
    }
}

/// `.planning/tasks/<slug>/RECORD.md` for a done task.
pub fn record_markdown(store: &StoreRecord) -> String {
    let record = store.record.as_ref().expect("a done task carries its record");
    let mut out = format!("# Task: {}\n\n{}\n\nMode: {}\nBranch: {}\nRange: {}..{}\n",
        record.slug, record.description, mode_word(record.mode), record.branch, record.start, record.head);
    out.push_str("\n## Commits\n");
    for commit in &record.commits {
        writeln!(out, "\n- {} {}", commit.id, commit.subject).unwrap();
        for file in &commit.files { writeln!(out, "  - {file}").unwrap(); }
    }
    out.push_str("\n## Files\n\n");
    for file in &record.files { writeln!(out, "- {file}").unwrap(); }
    if record.files.is_empty() { out.push_str("- none\n"); }
    write!(out, "\n## Risk\n\n{}\n", risk_line(&record.risk)).unwrap();
    if let Some(outcomes) = &store.outcomes {
        out.push_str("\n## Outcomes\n");
        for outcome in outcomes { writeln!(out, "\n- {}: {}", outcome.task, outcome.result).unwrap(); }
    }
    write!(out, "\n## Report\n\n{}\n", record.report).unwrap();
    out
}

/// `.planning/tasks/<slug>/PLAN.md` for a planned task at open.
pub fn plan_markdown(store: &StoreRecord) -> String {
    let plan = store.plan.as_ref().expect("a planned task carries its plan");
    let mut out = format!("# Task plan: {}\n\n{}\n\n## Steps\n", store.slug, store.description);
    for (index, step) in plan.iter().enumerate() {
        writeln!(out, "\n{}. {}\n   Action: {}\n   Verify: {}", index + 1, step.id, step.action, step.verify).unwrap();
    }
    out
}
