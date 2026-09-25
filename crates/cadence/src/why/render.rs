//! The chain text, byte-identical to cadence-core/bin/lib/why-render.mjs.
//! Every field the record does not carry says so in fixed words rather than
//! dropping the line, every list is capped by counting with the remainder
//! stated, and the ordering is commit date then sha so the same repository
//! renders the same bytes.

use super::corpus::MARKER_GAP;
use super::git::Excluded;
use super::{Brief, Entry, Finding, Gap, Join, Resolved};

/// The default entry cap, the largest one measurement supports.
pub const DEFAULT_TOP: u32 = 6;

/// The fixed text an absent join field renders as.
const NOT_JOINED: &str = "not yet joined";

/// Characters of the full sha the rendered commit line's abbreviation carries.
const ABBREV_LEN: usize = 8;

/// The rows of ARCHIVE.md residue a gap block lists before counting the rest.
const GAP_ROWS: usize = 3;
/// The paths a gap block lists before counting the rest.
const GAP_PATHS: usize = 10;
/// The excluded commits listed before counting the rest.
const EXCLUDED_ROWS: usize = 3;

/// The sentence an unresolved entry leads with.
const GAP: &str = "NOT RESOLVED - no phase directory on disk and no summary recovered from git \
history names this commit, so the record does not say which phase produced it";

/// The fixed statement an empty deviation list makes.
const NO_DEVIATION_BULLETS: &str = "(this phase's SUMMARY records no deviation)";

fn abbrev(sha: &str) -> &str { &sha[..sha.len().min(ABBREV_LEN)] }

/// One capped list, with the remainder counted rather than dropped.
fn capped(items: &[String], limit: usize) -> Vec<String> {
    let mut out: Vec<String> = items.iter().take(limit).map(|item| format!("  {item}")).collect();
    if items.len() > limit { out.push(format!("  ... and {} more", items.len() - limit)); }
    out
}

/// A label line followed by its indented lines.
fn quoted(label: &str, lines: &[String]) -> String {
    let mut out = vec![label.to_owned()];
    out.extend(lines.iter().map(|line| format!("  {line}")));
    out.join("\n")
}

fn candidate(m: &Brief) -> String {
    let dash = |cell: &str| if cell.is_empty() { "-".to_owned() } else { cell.to_owned() };
    format!("{} (plan {}, task {})", m.label, dash(&m.plan), dash(&m.task))
}

fn gap_lines(g: &Gap) -> String {
    let mut lines = Vec::new();
    match &g.close {
        Some(close) => lines.push(match &close.label {
            Some(label) => format!("the gap sits under the close at {}, labelled {label}", abbrev(&close.commit)),
            None => format!("the gap sits under the close at {}, which bound no milestone label", abbrev(&close.commit)),
        }),
        None => lines.push("no close has pruned this commit yet, so no milestone label covers the gap".into()),
    }
    lines.push(match &g.scope {
        Some(scope) => format!("commit-message scope: {scope} - read off the subject line as corroboration and \
explicitly NOT a resolved phase, because those numbers reset every milestone (D-06)"),
        None => "the commit message carries no conventional-commit scope to corroborate with".into(),
    });
    if g.paths.is_empty() {
        lines.push("git records no paths touched by this commit".into());
    } else {
        lines.push(format!("git records {} path(s) touched by this commit:", g.paths.len()));
        lines.extend(capped(&g.paths, GAP_PATHS));
    }
    if !g.archive.is_empty() {
        lines.push(format!(".planning/ARCHIVE.md keeps {} residue row(s) under that label, \
bound to the label and to no commit (D-04):", g.archive.len()));
        let rows: Vec<String> = g.archive.iter().map(|row| format!("{}: {}", row.origin, row.text)).collect();
        lines.extend(capped(&rows, GAP_ROWS));
    }
    quoted(GAP, &lines)
}

/// The commits history simplification dropped, and the invocation that shows them.
fn excluded_block(excluded: &[Excluded], path: &str) -> String {
    let merges = excluded.iter().filter(|e| e.parent_count > 1).count();
    let head = format!("{} commit(s) also touched this path and are NOT listed above. \
Git's default history simplification dropped them, and this chain keeps that \
simplification because --follow, which is how it tracks renames, requires it. \
{merges} of them {}.", excluded.len(), if merges == 1 { "is a merge" } else { "are merges" });
    let rows: Vec<String> = excluded.iter().map(|e| format!("{} ({} parent(s))", abbrev(&e.sha), e.parent_count)).collect();
    let run = format!("  see them with: git log --full-history --{}", if path.is_empty() { " <path>".to_owned() } else { format!(" {path}") });
    let mut out = vec![head];
    out.extend(capped(&rows, EXCLUDED_ROWS));
    out.push(run);
    out.join("\n")
}

fn field_phase(join: &Join) -> Option<String> {
    match join {
        Join::Ambiguous { matches } => {
            let named: Vec<String> = matches.iter().map(candidate).collect();
            Some(format!("AMBIGUOUS - {} records name this commit: {}", matches.len(), named.join("; ")))
        }
        Join::Unresolved { gap } => gap.as_ref().map(gap_lines),
        Join::Resolved(resolved) => {
            let j = &resolved.brief;
            if let Some(slug) = &j.slug {
                return Some(format!("off-roadmap task {slug} - a /cad-task run, not a roadmap phase ({})", j.label));
            }
            let milestone = j.milestone.clone().unwrap_or_else(|| "null".into());
            let phase = j.phase.clone().unwrap_or_else(|| "null".into());
            Some(match &j.recovered {
                Some(at) => format!("{milestone} phase {phase} (recovered from {}:{})", abbrev(&at.parent), at.tree),
                None => format!("{milestone} phase {phase} ({})", j.label),
            })
        }
    }
}

fn field_task(join: &Join) -> Option<String> {
    let Join::Resolved(resolved) = join else { return None };
    let j = &resolved.brief;
    let plan = if j.plan.is_empty() { String::new() } else { format!("plan {}, ", j.plan) };
    let task = if j.task.is_empty() { "task unnamed".to_owned() } else { format!("task {}", j.task) };
    let description = if j.description.is_empty() { String::new() } else { format!(" - {}", j.description) };
    Some(format!("{plan}{task}{description}"))
}

fn field_decision(resolved: &Resolved) -> Option<String> {
    let d = &resolved.decision;
    if d.lines.is_empty() { return None; }
    let announce = match d.scope {
        "task" => format!("cited by this task ({})", d.ids.join(", ")),
        "plan" => format!("PHASE-SCOPED - cited by the plan's ## Context, not by this task ({})", d.ids.join(", ")),
        "phase" => "PHASE-SCOPED - neither the task nor the plan cites a decision, so every decision this phase recorded is listed".to_owned(),
        _ => return None,
    };
    Some(quoted(&announce, &d.lines))
}

fn field_deviation(resolved: &Resolved) -> Option<String> {
    let bullets: Vec<String> = if resolved.deviation.is_empty() {
        vec![NO_DEVIATION_BULLETS.to_owned()]
    } else {
        resolved.deviation.iter().map(|b| format!("- {b}")).collect()
    };
    Some(quoted(&format!("PHASE-SCOPED - {MARKER_GAP}"), &bullets))
}

fn finding_lines(f: &Finding) -> Vec<String> {
    let mut place = Vec::new();
    if let Some(file) = &f.file { place.push(file.clone()); }
    if let Some(line) = f.line { place.push(line.to_string()); }
    let mut head = Vec::new();
    if let Some(severity) = &f.severity { head.push(format!("[{severity}]")); }
    if !place.is_empty() { head.push(place.join(":")); }
    head.push(format!("({})", f.record));
    let mut out = vec![head.join(" "), format!("claim: {}", f.claim), format!("failure_scenario: {}", f.failure_scenario)];
    if let Some(counter) = &f.counter_evidence { out.push(format!("counter_evidence: {counter}")); }
    out.push(match &f.fix_commit {
        Some(fix) => format!("fix: {fix}"),
        None => "fix: none - confirmed and left standing".into(),
    });
    out
}

fn field_review(resolved: &Resolved) -> Option<String> {
    let r = &resolved.review;
    if r.records == 0 { return Some("no adjudication record in this phase's directory".into()); }
    let mut lines = Vec::new();
    for f in &r.findings { lines.extend(finding_lines(f)); }
    for f in &r.unresolved {
        lines.extend(finding_lines(f));
        lines.push(format!("  join UNRESOLVABLE: {}..{} does not resolve in this clone, so whether it covers this commit is unknown",
            f.base_id.clone().unwrap_or_else(|| "(no base_id)".into()), f.head_id.clone().unwrap_or_else(|| "(no head_id)".into())));
    }
    if lines.is_empty() {
        return Some(format!("{} adjudication record(s) read; no surviving finding covers this commit", r.records));
    }
    let mut head = format!("{} surviving finding(s) cover this commit", r.findings.len());
    if !r.unresolved.is_empty() { head.push_str(&format!(", and {} more could not be placed", r.unresolved.len())); }
    Some(quoted(&head, &lines))
}

fn field_declared(resolved: &Resolved) -> Option<String> {
    let d = &resolved.declared;
    let Some(plan_file) = &d.plan_file else { return Some("no plan file for this task's plan in the phase directory".into()) };
    if d.tasks.is_empty() { return Some(format!("no task in {plan_file} declares this path")); }
    let lines: Vec<String> = d.tasks.iter()
        .map(|t| format!("task {}: {} (declares {})", t.ordinal, t.title, t.declaration)).collect();
    Some(quoted(&format!("declared in {plan_file}"), &lines))
}

fn render_entry(entry: &Entry) -> String {
    let resolved = match &entry.join { Join::Resolved(resolved) => Some(resolved.as_ref()), _ => None };
    let field = |value: Option<String>| value.unwrap_or_else(|| NOT_JOINED.to_owned());
    [
        format!("commit {} ({})", entry.sha, abbrev(&entry.sha)),
        format!("date: {}", entry.date),
        format!("subject: {}", entry.subject),
        format!("phase: {}", field(field_phase(&entry.join))),
        format!("plan task: {}", field(field_task(&entry.join))),
        format!("decision: {}", field(resolved.and_then(field_decision))),
        format!("deviation: {}", field(resolved.and_then(field_deviation))),
        format!("review: {}", field(resolved.and_then(field_review))),
        format!("declared by: {}", field(resolved.and_then(field_declared))),
    ].join("\n")
}

/// Newest first by commit date, then by sha descending.
fn sort_entries(entries: &[Entry]) -> Vec<Entry> {
    let mut sorted = entries.to_vec();
    sorted.sort_by(|a, b| b.at.cmp(&a.at).then_with(|| b.sha.cmp(&a.sha)));
    sorted
}

/// The rendered chain and what it kept.
pub struct Rendered {
    pub text: String,
    pub shown: usize,
    pub total: usize,
    pub entries: Vec<Entry>,
}

/// Render the chain: the capped entries, then the exclusions the bare arm
/// measured, then the truncation note when the cap dropped any.
pub fn render_chain(entries: &[Entry], top: Option<u32>, excluded: Option<&[Excluded]>, path: &str) -> Rendered {
    let top = top.filter(|top| *top > 0).unwrap_or(DEFAULT_TOP) as usize;
    let sorted = sort_entries(entries);
    let total = sorted.len();
    let capped: Vec<Entry> = sorted.into_iter().take(top).collect();
    if capped.is_empty() {
        return Rendered { text: "No commits in this chain.".into(), shown: 0, total, entries: Vec::new() };
    }
    let mut text = capped.iter().map(render_entry).collect::<Vec<_>>().join("\n\n");
    if let Some(excluded) = excluded.filter(|excluded| !excluded.is_empty()) {
        text.push_str("\n\n");
        text.push_str(&excluded_block(excluded, path));
    }
    if total > capped.len() {
        text.push_str(&format!("\n\nShowing {} of {total} commit(s). Pass --top {total} to see the rest.", capped.len()));
    }
    Rendered { shown: capped.len(), text, total, entries: capped }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::why::{ArchiveRow, Close, DeclaredJoin, DecisionJoin, Gap, ReviewJoin};

    fn entry(sha: &str, at: i64, join: Join) -> Entry {
        Entry { sha: sha.into(), date: format!("d{at}"), at, subject: "s".into(), join }
    }

    fn resolved(brief: Brief) -> Join {
        Join::Resolved(Box::new(Resolved {
            brief,
            decision: DecisionJoin { scope: "absent", ids: vec![], lines: vec![] },
            deviation: vec![],
            review: ReviewJoin { records: 0, findings: vec![], unresolved: vec![] },
            declared: DeclaredJoin { plan_file: None, tasks: vec![] },
        }))
    }

    fn brief(label: &str) -> Brief {
        Brief { label: label.into(), milestone: Some("v1".into()), phase: Some("3".into()), plan: "2".into(),
            task: "".into(), description: "".into(), recovered: None, slug: None }
    }

    fn capped_chain() -> Rendered {
        let entries = [entry("bbbb", 5, Join::Unresolved { gap: None }), entry("aaaa", 9, Join::Unresolved { gap: None }),
            entry("cccc", 5, Join::Unresolved { gap: None })];
        render_chain(&entries, Some(2), None, "p")
    }

    #[test]
    fn the_cap_orders_by_date_then_sha_and_states_the_remainder() {
        let rendered = capped_chain();
        assert_eq!(rendered.entries.iter().map(|e| e.sha.as_str()).collect::<Vec<_>>(), ["aaaa", "cccc"]);
        assert_eq!((rendered.shown, rendered.total), (2, 3));
        assert!(rendered.text.ends_with("\n\nShowing 2 of 3 commit(s). Pass --top 3 to see the rest."));
    }

    #[test]
    fn an_unjoined_entry_spells_every_missing_field_as_not_yet_joined() {
        assert!(capped_chain().text.starts_with("commit aaaa (aaaa)\ndate: d9\nsubject: s\nphase: not yet joined\nplan task: not yet joined\n"));
    }

    #[test]
    fn an_empty_chain_renders_no_commits() {
        assert_eq!(render_chain(&[], None, None, "p").text, "No commits in this chain.");
    }

    #[test]
    fn a_labelled_close_and_archive_residue_render_in_the_gap_block() {
        let gap = Gap {
            close: Some(Close { commit: "0123456789ab".into(), label: Some("v1.0".into()), date: String::new() }),
            scope: None,
            paths: (0..12).map(|n| format!("p{n:02}")).collect(),
            archive: (0..5).map(|n| ArchiveRow { origin: format!("phases/{n}/SUMMARY.md"), text: "kept".into() }).collect(),
        };
        let text = field_phase(&Join::Unresolved { gap: Some(gap) }).unwrap();
        let lines: Vec<&str> = text.split('\n').collect();
        assert_eq!(lines[1], "  the gap sits under the close at 01234567, labelled v1.0");
        assert_eq!(lines[2], "  the commit message carries no conventional-commit scope to corroborate with");
        assert_eq!(lines[3], "  git records 12 path(s) touched by this commit:");
        assert_eq!(lines[4], "    p00");
        assert_eq!(lines[14], "    ... and 2 more");
        assert_eq!(lines[15], "  .planning/ARCHIVE.md keeps 5 residue row(s) under that label, bound to the label and to no commit (D-04):");
        assert_eq!(lines[16], "    phases/0/SUMMARY.md: kept");
        assert_eq!(lines[19], "    ... and 2 more");
        assert_eq!(lines.len(), 20);
    }

    #[test]
    fn an_ambiguous_phase_line_lists_every_candidate() {
        let matches = vec![brief("phases/3"), Brief { plan: String::new(), ..brief("_archive-v1/3") }];
        assert_eq!(field_phase(&Join::Ambiguous { matches }).unwrap(),
            "AMBIGUOUS - 2 records name this commit: phases/3 (plan 2, task -); _archive-v1/3 (plan -, task -)");
    }

    #[test]
    fn an_off_roadmap_task_phase_line_names_the_slug_and_label() {
        let task = resolved(Brief { slug: Some("fix-it".into()), ..brief("tasks/fix-it") });
        assert_eq!(field_phase(&task).unwrap(), "off-roadmap task fix-it - a /cad-task run, not a roadmap phase (tasks/fix-it)");
    }

    #[test]
    fn an_empty_task_cell_reads_task_unnamed() {
        let task = resolved(Brief { slug: Some("fix-it".into()), ..brief("tasks/fix-it") });
        assert_eq!(field_task(&task).unwrap(), "plan 2, task unnamed");
    }

    #[test]
    fn a_resolved_phase_line_names_milestone_phase_and_label() {
        assert_eq!(field_phase(&resolved(brief("phases/3"))).unwrap(), "v1 phase 3 (phases/3)");
    }

    #[test]
    fn the_exclusion_block_counts_merges_and_names_the_invocation() {
        let excluded = vec![Excluded { sha: "aaaaaaaaaaaa".into(), parent_count: 2 }, Excluded { sha: "bbbbbbbbbbbb".into(), parent_count: 1 }];
        assert_eq!(excluded_block(&excluded, "src/a.rs"), "2 commit(s) also touched this path and are NOT listed above. \
Git's default history simplification dropped them, and this chain keeps that simplification because --follow, \
which is how it tracks renames, requires it. 1 of them is a merge.\n  aaaaaaaa (2 parent(s))\n  bbbbbbbb (1 parent(s))\n  see them with: git log --full-history -- src/a.rs");
    }

    fn finding(fix: Option<&str>) -> Finding {
        Finding { claim: "c".into(), failure_scenario: "f".into(), counter_evidence: None,
            fix_commit: fix.map(str::to_owned), file: Some("a.rs".into()), line: Some(4), severity: Some("high".into()),
            base_id: None, head_id: Some("h".into()), record: "ADJUDICATION-x-1.json".into() }
    }

    fn resolved_phase_3() -> Resolved {
        let Join::Resolved(inner) = resolved(brief("phases/3")) else { unreachable!() };
        *inner
    }

    #[test]
    fn the_review_field_lists_covering_findings_and_flags_unresolvable_ranges() {
        let mut inner = resolved_phase_3();
        inner.review = ReviewJoin { records: 2, findings: vec![finding(Some("abc"))], unresolved: vec![finding(None)] };
        // Every line under the head is indented once by `quoted`; the
        // UNRESOLVABLE note carries its own indent on top of that.
        assert_eq!(field_review(&inner).unwrap(), "1 surviving finding(s) cover this commit, and 1 more could not be placed\n\
\x20 [high] a.rs:4 (ADJUDICATION-x-1.json)\n  claim: c\n  failure_scenario: f\n  fix: abc\n\
\x20 [high] a.rs:4 (ADJUDICATION-x-1.json)\n  claim: c\n  failure_scenario: f\n  fix: none - confirmed and left standing\n\
\x20   join UNRESOLVABLE: (no base_id)..h does not resolve in this clone, so whether it covers this commit is unknown");
    }

    #[test]
    fn the_decision_field_announces_plan_scope_and_quotes_its_lines() {
        let mut inner = resolved_phase_3();
        inner.decision = DecisionJoin { scope: "plan", ids: vec!["D-02".into()], lines: vec!["D-02: two".into()] };
        assert_eq!(field_decision(&inner).unwrap(), "PHASE-SCOPED - cited by the plan's ## Context, not by this task (D-02)\n  D-02: two");
    }

    #[test]
    fn a_review_field_with_records_but_no_covering_finding_says_so() {
        let mut inner = resolved_phase_3();
        inner.review = ReviewJoin { records: 1, findings: vec![], unresolved: vec![] };
        assert_eq!(field_review(&inner).unwrap(), "1 adjudication record(s) read; no surviving finding covers this commit");
    }
}
