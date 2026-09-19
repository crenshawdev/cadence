//! The record corpus `why` joins commits to, in the shape of the frozen
//! cadence-core/bin/lib/why-record.mjs (the table and section grammar) and
//! why-corpus.mjs (the index tiers and the join).
//!
//! The index is built once per query and has four ordered tiers: the live and
//! archived phase directories on disk, the off-roadmap `tasks/<slug>/`
//! records, and the phases a milestone close pruned, recovered from git
//! history at the prune commit's parent. A commit resolves against the first
//! tier that names it at all, so an archived phase both tiers could claim
//! resolves to the copy a reader can open. Every read fails open into
//! `warnings`: git already said what the commits are, and a summary nobody can
//! read makes the join thinner, not the chain wrong.

use super::git::{self, Entry as RawEntry};
use super::{
    ArchiveRow, Brief, Close, DeclaredJoin, DecisionJoin, DeclaringTask, Entry, Finding, Gap, Join,
    Recovered, Resolved, ReviewJoin,
};
use regex::Regex;
use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};
use std::sync::LazyLock;

fn re(pattern: &str) -> Regex { Regex::new(pattern).expect("static pattern") }

// ---------------------------------------------------------------------------
// The record grammar (why-record.mjs and the planning-files helpers it uses)
// ---------------------------------------------------------------------------

/// The heading whose table carries the commit-to-plan-task edge.
pub const COMMITS_HEADING: &str = "## Commits";
/// The plan section whose cites are plan-scoped rather than task-scoped.
pub const PLAN_CONTEXT_HEADING: &str = "## Context";
/// The second decision section, phase-local by construction.
pub const PHASE_DECISIONS_HEADING: &str = "## Decisions";
/// The section whose bullets are deviations and nothing else.
pub const DEVIATIONS_HEADING: &str = "## Deviations";

/// The statement the deviation field leads with: the write side never emits
/// the marker that would join a deviation to the decision it refuted.
pub const MARKER_GAP: &str = "the `corrected by plan-<k> deviation:` marker \
`workflows/execute.md` prescribes for a deviation that refutes a decision \
is absent from the whole record, so no deviation below is joined to a \
decision - the edge is missing on the WRITE side, not empty here";

/// Strip a BOM and fold every line ending to `\n`.
pub fn normalize(text: &str) -> String {
    text.strip_prefix('\u{feff}').unwrap_or(text).replace("\r\n", "\n").replace('\r', "\n")
}

/// The same without folding a bare `\r`, as `planTaskTitles` reads a plan.
fn normalize_crlf(text: &str) -> String {
    text.strip_prefix('\u{feff}').unwrap_or(text).replace("\r\n", "\n")
}

/// A closure answering "is this line inside a fenced block" for each line fed
/// to it in order.
fn fence_scanner() -> impl FnMut(&str) -> bool {
    static FENCE: LazyLock<Regex> = LazyLock::new(|| re(r"^ {0,3}(`{3,}|~{3,})\s*(.*)$"));
    let mut fence: Option<(char, usize)> = None;
    move |line: &str| {
        let Some(found) = FENCE.captures(line) else { return fence.is_some() };
        let marker = &found[1];
        let (ch, len) = (marker.chars().next().expect("a fence"), marker.len());
        match fence {
            None => fence = Some((ch, len)),
            Some((open, open_len)) if ch == open && len >= open_len && found[2].trim().is_empty() => fence = None,
            Some(_) => {}
        }
        true
    }
}

/// The first `## ` heading outside a fence, or none.
pub fn section_bound(lines: &[&str]) -> Option<usize> {
    let mut fenced = fence_scanner();
    lines.iter().position(|line| !fenced(line) && line.starts_with("## "))
}

/// `(start, end)` of the section under `heading`: the heading line and the
/// next `## ` line outside a fence, or the document's end.
pub fn section_span(lines: &[&str], heading: &str) -> Option<(usize, usize)> {
    let mut fenced = fence_scanner();
    let mut start = None;
    for (index, line) in lines.iter().enumerate() {
        if fenced(line) { continue; }
        match start {
            None => if line.trim() == heading { start = Some(index) },
            Some(at) => if line.starts_with("## ") { return Some((at, index)) },
        }
    }
    start.map(|at| (at, lines.len()))
}

/// The body between `## <heading>` and the next `## ` line, as
/// `parseContextDecisions` reads one; `None` when the heading is absent.
fn section_body(text: &str, heading: &str) -> Option<String> {
    let opener = re(&format!("(?m)^## {heading}\\s*$"));
    let found = opener.find(text)?;
    let rest = &text[found.end()..];
    static NEXT: LazyLock<Regex> = LazyLock::new(|| re(r"(?m)^## "));
    Some(match NEXT.find(rest) { Some(next) => rest[..next.start()].to_owned(), None => rest.to_owned() })
}

/// A markdown table row's cells, split on the pipes the author did not escape.
fn cells(line: &str) -> Vec<String> {
    let mut parts = Vec::new();
    let mut current = String::new();
    let mut previous = None;
    for ch in line.trim().chars() {
        if ch == '|' && previous != Some('\\') {
            parts.push(std::mem::take(&mut current));
        } else {
            current.push(ch);
        }
        previous = Some(ch);
    }
    parts.push(current);
    if parts.first().is_some_and(|first| first.trim().is_empty()) { parts.remove(0); }
    if parts.last().is_some_and(|last| last.trim().is_empty()) { parts.pop(); }
    parts.into_iter().map(|cell| cell.replace("\\|", "|").trim().to_owned()).collect()
}

fn is_hex(text: &str) -> bool { !text.is_empty() && text.chars().all(|c| c.is_ascii_hexdigit()) }

/// Two commit spellings name one commit when the shorter is a prefix of the
/// longer, case-insensitively, and both are hexadecimal.
pub fn sha_matches(a: &str, b: &str) -> bool {
    let (x, y) = (a.trim().to_ascii_lowercase(), b.trim().to_ascii_lowercase());
    if !is_hex(&x) || !is_hex(&y) { return false; }
    if x.len() <= y.len() { y.starts_with(&x) } else { x.starts_with(&y) }
}

/// One row of a `## Commits` table, cells verbatim.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CommitRow {
    pub plan: String,
    pub task: String,
    pub commit: String,
    pub description: String,
}

/// The rows of the `## Commits` table whose header names a `commit` column.
pub fn parse_commit_rows(text: &str) -> Vec<CommitRow> {
    static TABLE_ROW: LazyLock<Regex> = LazyLock::new(|| re(r"^\s*\|"));
    static SEPARATOR_ROW: LazyLock<Regex> = LazyLock::new(|| re(r"^\s*\|[\s|:-]*$"));
    let text = normalize(text);
    let lines: Vec<&str> = text.split('\n').collect();
    let Some((start, end)) = section_span(&lines, COMMITS_HEADING) else { return Vec::new() };
    let mut header: Option<BTreeMap<&str, usize>> = None;
    let mut out = Vec::new();
    for line in &lines[start + 1..end] {
        if !TABLE_ROW.is_match(line) || SEPARATOR_ROW.is_match(line) { continue; }
        let cs = cells(line);
        let Some(columns) = &header else {
            let mut found = BTreeMap::new();
            for (index, cell) in cs.iter().enumerate() {
                let key = cell.to_lowercase();
                for name in ["plan", "task", "commit", "description"] {
                    if key == name { found.entry(name).or_insert(index); }
                }
            }
            if !found.contains_key("commit") { return Vec::new(); }
            header = Some(found);
            continue;
        };
        let at = |name: &str| columns.get(name).and_then(|index| cs.get(*index)).cloned().unwrap_or_default();
        let commit = at("commit");
        if !is_hex(&commit) { continue; }
        out.push(CommitRow { plan: at("plan"), task: at("task"), commit, description: at("description") });
    }
    out
}

/// Every distinct decision id in `text`, in first-seen order.
pub fn decision_tokens(text: &str) -> Vec<String> {
    static TOKEN: LazyLock<Regex> = LazyLock::new(|| re(r"\bD-\d+(?:\.\d+)?\b"));
    let mut seen = Vec::new();
    for found in TOKEN.find_iter(text) {
        if !seen.iter().any(|known: &String| known == found.as_str()) { seen.push(found.as_str().to_owned()); }
    }
    seen
}

/// The task headings of a plan, as `planTaskTitles` reads them.
fn plan_task_titles(text: &str) -> Vec<String> {
    static TITLE: LazyLock<Regex> = LazyLock::new(|| re(r"(?m)^### Task\s+[\d.]+\s*:?\s*(.*)$"));
    TITLE.captures_iter(&normalize_crlf(text)).map(|found| found[1].trim().to_owned()).collect()
}

/// One `### Task` block of a plan: its ordinal, title and body up to the next
/// task or `## ` section.
pub struct TaskBody {
    pub ordinal: usize,
    pub title: String,
    pub body: String,
}

pub fn plan_task_bodies(text: &str) -> Vec<TaskBody> {
    let src = normalize(text);
    let lines: Vec<&str> = src.split('\n').collect();
    let titles = plan_task_titles(&src);
    let starts: Vec<usize> = lines.iter().enumerate()
        .filter(|(_, line)| line.starts_with("### Task")).map(|(index, _)| index).collect();
    if starts.is_empty() || starts.len() != titles.len() { return Vec::new(); }
    starts.iter().enumerate().map(|(k, &start)| {
        let next_task = starts.get(k + 1).copied().unwrap_or(lines.len());
        let end = match section_bound(&lines[start + 1..next_task]) {
            None => next_task,
            Some(bound) => start + 1 + bound,
        };
        TaskBody { ordinal: k + 1, title: titles[k].clone(), body: lines[start..end].join("\n") }
    }).collect()
}

/// The decisions a CONTEXT.md carries: its `## Durable decisions` (else
/// `## Decisions`) bullets, then any `## Decisions` bullets not yet seen.
pub fn context_decisions(text: &str) -> Vec<String> {
    static HEAD: LazyLock<Regex> = LazyLock::new(|| re(r"^- D-\d+(?:\.\d+)?\b"));
    static BULLET: LazyLock<Regex> = LazyLock::new(|| re(r"^- (D-\d+(?:\.\d+)?)\b"));
    let src = normalize(text);
    let mut out = Vec::new();
    let durable = section_body(&src, "Durable decisions");
    let body = if durable.is_none() { section_body(&src, "Decisions") } else { durable };
    if let Some(body) = body.filter(|body| !body.is_empty()) {
        for line in body.split('\n') {
            if HEAD.is_match(line) { out.push(line.strip_prefix("- ").unwrap_or(line).to_owned()); }
        }
    }
    let mut seen: BTreeSet<String> = out.iter()
        .filter_map(|decision| BULLET.captures(&format!("- {decision}")).map(|found| found[1].to_owned()))
        .collect();
    let lines: Vec<&str> = src.split('\n').collect();
    let Some((start, end)) = section_span(&lines, PHASE_DECISIONS_HEADING) else { return out };
    for line in &lines[start + 1..end] {
        let Some(found) = BULLET.captures(line) else { continue };
        if !seen.insert(found[1].to_owned()) { continue; }
        out.push(line.strip_prefix("- ").unwrap_or(line).to_owned());
    }
    out
}

fn task_ordinal(cell: &str) -> Option<usize> {
    let cell = cell.trim();
    (!cell.is_empty() && cell.chars().all(|c| c.is_ascii_digit())).then(|| cell.parse().ok()).flatten()
}

/// Each cited id quoted from the phase's decisions, or a stated absence.
fn quote(ids: &[String], decisions: &[String]) -> Vec<String> {
    ids.iter().map(|id| {
        let head = re(&format!("^{id}\\b"));
        decisions.iter().find(|decision| head.is_match(decision)).cloned()
            .unwrap_or_else(|| format!("{id} - cited here, but the phase's CONTEXT.md carries no such decision"))
    }).collect()
}

/// Which decisions a commit's task cites: the task body's ids, else the
/// plan's `## Context` ids, else every decision the phase recorded.
pub fn decisions_for(plan_text: &str, context_text: &str, task_cell: &str) -> DecisionJoin {
    let decisions = context_decisions(context_text);
    let bodies = plan_task_bodies(plan_text);
    let body = task_ordinal(task_cell).and_then(|ordinal| bodies.iter().find(|body| body.ordinal == ordinal));
    let task_ids = body.map(|body| decision_tokens(&body.body)).unwrap_or_default();
    if !task_ids.is_empty() {
        let lines = quote(&task_ids, &decisions);
        return DecisionJoin { scope: "task", ids: task_ids, lines };
    }
    let plan = normalize(plan_text);
    let lines: Vec<&str> = plan.split('\n').collect();
    let plan_ids = section_span(&lines, PLAN_CONTEXT_HEADING)
        .map(|(start, end)| decision_tokens(&lines[start + 1..end].join("\n"))).unwrap_or_default();
    if !plan_ids.is_empty() {
        let lines = quote(&plan_ids, &decisions);
        return DecisionJoin { scope: "plan", ids: plan_ids, lines };
    }
    if decisions.is_empty() { return DecisionJoin { scope: "absent", ids: Vec::new(), lines: Vec::new() }; }
    DecisionJoin { scope: "phase", ids: Vec::new(), lines: decisions }
}

/// The `## Deviations` bullets of a SUMMARY.md, template prose skipped.
pub fn parse_deviations(text: &str) -> Vec<String> {
    static BULLET: LazyLock<Regex> = LazyLock::new(|| re(r"^-\s+(.*)$"));
    static PLACEHOLDER: LazyLock<Regex> = LazyLock::new(|| re(r"^(?:None\b|<)"));
    static TAG: LazyLock<Regex> = LazyLock::new(|| re(r"^\[deviation\]\s*"));
    let text = normalize(text);
    let lines: Vec<&str> = text.split('\n').collect();
    let Some((start, end)) = section_span(&lines, DEVIATIONS_HEADING) else { return Vec::new() };
    lines[start + 1..end].iter().filter_map(|line| {
        let raw = BULLET.captures(line)?[1].trim().to_owned();
        if raw.is_empty() || PLACEHOLDER.is_match(&raw) { return None; }
        Some(TAG.replace(&raw, "").into_owned())
    }).collect()
}

/// A task's declared files, as its `- **Files:**` line and continuations
/// spell them.
struct DeclaredFiles {
    ordinal: usize,
    title: String,
    files: Vec<String>,
}

fn task_declared_files(text: &str) -> Vec<DeclaredFiles> {
    static FILES_LINE: LazyLock<Regex> = LazyLock::new(|| re(r"^\s*-\s*\*\*Files:\*\*\s*(.*)$"));
    static CONTINUATION: LazyLock<Regex> = LazyLock::new(|| re(r"^\s+\S"));
    static NEXT_FIELD: LazyLock<Regex> = LazyLock::new(|| re(r"^\s*-\s*\*\*"));
    static TRAILING_PARENTHETICAL: LazyLock<Regex> = LazyLock::new(|| re(r"\s*\(.*\)\s*$"));
    plan_task_bodies(text).into_iter().map(|task| {
        let lines: Vec<&str> = task.body.split('\n').collect();
        let mut files: Vec<String> = Vec::new();
        let mut index = 0;
        while index < lines.len() {
            let Some(found) = FILES_LINE.captures(lines[index]) else { index += 1; continue };
            let mut raw = found[1].to_owned();
            let mut k = index + 1;
            while k < lines.len() && CONTINUATION.is_match(lines[k]) && !NEXT_FIELD.is_match(lines[k]) {
                raw.push(' ');
                raw.push_str(lines[k].trim());
                index = k;
                k += 1;
            }
            for part in raw.split(',') {
                let item = TRAILING_PARENTHETICAL.replace(&part.replace('`', ""), "").trim().to_owned();
                if !item.is_empty() && !item.starts_with('{') && !files.contains(&item) { files.push(item); }
            }
            index += 1;
        }
        DeclaredFiles { ordinal: task.ordinal, title: task.title, files }
    }).collect()
}

/// A declared file names a path outright, or is a directory prefix of it:
/// the record grammar of why-record.mjs, not the lease rule in
/// execution::lease, which is the one coverage definition the lease pins.
pub fn declares(declaration: &str, path: &str) -> bool {
    if !declaration.ends_with('/') { return declaration == path; }
    path.starts_with(declaration)
}

/// The tasks of a plan whose declared files cover `path`.
pub fn declaring_tasks(text: &str, path: &str) -> Vec<DeclaringTask> {
    task_declared_files(text).into_iter().filter_map(|task| {
        let declaration = task.files.iter().find(|file| declares(file, path))?.clone();
        Some(DeclaringTask { ordinal: task.ordinal, title: task.title, declaration })
    }).collect()
}

/// A parsed adjudication record: its range, its surviving findings, and the
/// shape problems a caller warns about.
pub struct Adjudication {
    pub name: String,
    pub base_id: Option<String>,
    pub head_id: Option<String>,
    pub survivors: Vec<Finding>,
    pub issues: Vec<String>,
}

fn text_field(value: &serde_json::Value) -> Option<String> {
    value.as_str().filter(|text| !text.trim().is_empty()).map(str::to_owned)
}

pub fn parse_adjudication(name: &str, text: &str) -> Adjudication {
    let mut record = Adjudication { name: name.to_owned(), base_id: None, head_id: None, survivors: Vec::new(), issues: Vec::new() };
    let value: serde_json::Value = match serde_json::from_str(text) {
        Ok(value) => value,
        Err(_) => { record.issues.push("unparseable-json".into()); return record; }
    };
    let Some(object) = value.as_object() else { record.issues.push("not-a-record-object".into()); return record; };
    record.base_id = object.get("base_id").and_then(text_field);
    record.head_id = object.get("head_id").and_then(text_field);
    let entries = match object.get("entries").and_then(|entries| entries.as_array()) {
        Some(entries) => entries.clone(),
        None => { record.issues.push("no-entries-array".into()); Vec::new() }
    };
    for entry in entries {
        let Some(fields) = entry.as_object() else { record.issues.push("entry-not-an-object".into()); continue };
        if fields.get("ruling").and_then(|ruling| ruling.as_str()) != Some("survived") { continue; }
        let base = fields.get("base_id").and_then(text_field).or_else(|| record.base_id.clone());
        let head = fields.get("head_id").and_then(text_field).or_else(|| record.head_id.clone());
        if base.is_none() || head.is_none() { record.issues.push("survivor-without-a-range".into()); }
        record.survivors.push(Finding {
            claim: fields.get("claim").and_then(text_field).unwrap_or_default(),
            failure_scenario: fields.get("failure_scenario").and_then(text_field).unwrap_or_default(),
            counter_evidence: fields.get("counter_evidence").and_then(text_field),
            fix_commit: fields.get("fix_commit").and_then(text_field),
            file: fields.get("file").and_then(text_field),
            line: fields.get("line").and_then(|line| line.as_i64()),
            severity: fields.get("severity").and_then(text_field),
            base_id: base,
            head_id: head,
            record: name.to_owned(),
        });
    }
    record
}

// ---------------------------------------------------------------------------
// The index tiers (why-corpus.mjs)
// ---------------------------------------------------------------------------

/// One directory of the record: a phase directory on disk, an off-roadmap
/// task directory, or a pruned phase directory recovered from git history
/// (`path` is then `None` and `recovered` says where it was read from).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Dir {
    pub label: String,
    pub path: Option<PathBuf>,
    pub group: String,
    pub phase: Option<String>,
    pub milestone: Option<String>,
    pub recovered: Option<Recovered>,
    pub slug: Option<String>,
}

#[derive(Clone, Debug)]
pub struct Row {
    pub row: CommitRow,
    pub dir: Dir,
}

#[derive(Debug, Default)]
pub struct Tier {
    pub dirs: Vec<Dir>,
    pub rows: Vec<Row>,
    pub warnings: Vec<String>,
}

/// One milestone close that deleted phase summaries.
#[derive(Clone, Debug)]
pub struct Prune {
    pub commit: String,
    pub date: String,
    pub at: i64,
    pub parents: Vec<String>,
    pub parent: Option<String>,
    pub label: Option<String>,
    /// `(phase, deleted path)` pairs, path order.
    pub phases: Vec<(String, String)>,
    pub refused: Option<String>,
}

/// The merged, ordered index.
pub struct Index {
    pub tiers: Vec<Tier>,
    pub prunes: Vec<Prune>,
    pub warnings: Vec<String>,
}

impl Index {
    fn dir(&self, label: &str) -> Option<&Dir> {
        self.tiers.iter().flat_map(|tier| tier.dirs.iter()).find(|dir| dir.label == label)
    }
}

/// What reading one planning artifact produced.
enum Artifact {
    Absent,
    Unreadable(String),
    Text(String),
}

fn io_code(error: &std::io::Error) -> String {
    match error.kind() {
        std::io::ErrorKind::PermissionDenied => "EACCES".into(),
        std::io::ErrorKind::NotFound => "ENOENT".into(),
        _ => "EIO".into(),
    }
}

/// Read one artifact by name, judging what the path resolves to: a symlink
/// out of its directory is refused before it is opened, a FIFO is never read.
fn read_artifact(file: &Path) -> Artifact {
    let metadata = match std::fs::metadata(file) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Artifact::Absent,
        Err(error) => return Artifact::Unreadable(io_code(&error)),
    };
    if !metadata.is_file() { return Artifact::Unreadable("ENOTREGULAR".into()); }
    let real = match file.canonicalize() { Ok(real) => real, Err(error) => return Artifact::Unreadable(io_code(&error)) };
    let real_dir = match file.parent().map(Path::canonicalize) {
        Some(Ok(dir)) => dir,
        Some(Err(error)) => return Artifact::Unreadable(io_code(&error)),
        None => return Artifact::Unreadable("ERESOLVE".into()),
    };
    if real != real_dir && !real.starts_with(&real_dir) { return Artifact::Unreadable("EESCAPE".into()); }
    match std::fs::read(&real) {
        Ok(bytes) => Artifact::Text(String::from_utf8_lossy(&bytes).into_owned()),
        Err(error) => Artifact::Unreadable(io_code(&error)),
    }
}

fn entries_in(dir: &Path) -> Vec<String> {
    std::fs::read_dir(dir).map(|entries| entries.filter_map(|entry| entry.ok())
        .map(|entry| entry.file_name().to_string_lossy().into_owned()).collect()).unwrap_or_default()
}

/// The phase directories under `planningRoot`: `phases/<N>` and every
/// `_archive-*/<N>` that carries a plan file, contained by what each path
/// resolves to, in label order.
fn phase_dirs_in(planning_root: &Path) -> Vec<(String, PathBuf)> {
    static PLAN_FILE: LazyLock<Regex> = LazyLock::new(|| re(r"^PLAN(-\d+)?\.md$"));
    let root = planning_root.canonicalize().unwrap_or_else(|_| planning_root.to_path_buf());
    let inside = |dir: &Path| dir.canonicalize().is_ok_and(|real| real == root || real.starts_with(&root));
    let mut groups = vec!["phases".to_owned()];
    groups.extend(entries_in(planning_root).into_iter().filter(|entry| entry.starts_with("_archive-")));
    let mut found = Vec::new();
    for group in groups {
        let dir = planning_root.join(&group);
        if !inside(&dir) { continue; }
        for name in entries_in(&dir) {
            let path = dir.join(&name);
            if !inside(&path) { continue; }
            let plans = entries_in(&path).into_iter().filter(|entry| PLAN_FILE.is_match(entry)).count();
            if plans == 0 { continue; }
            found.push((format!("{group}/{name}"), path));
        }
    }
    found.sort_by(|a, b| a.0.cmp(&b.0));
    found
}

fn describe(label: &str, path: PathBuf) -> Dir {
    let (group, phase) = match label.split_once('/') { Some((group, phase)) => (group, phase), None => (label, "") };
    let milestone = if group == "phases" { "the open milestone".to_owned() } else { group.strip_prefix("_archive-").unwrap_or(group).to_owned() };
    Dir { label: label.to_owned(), path: Some(path), group: group.to_owned(), phase: Some(phase.to_owned()),
        milestone: Some(milestone), recovered: None, slug: None }
}

/// The on-disk tier: every phase directory's `## Commits` rows.
pub fn build_commit_index(planning_root: &Path) -> Tier {
    let mut tier = Tier::default();
    for (label, path) in phase_dirs_in(planning_root) {
        let dir = describe(&label, path.clone());
        match read_artifact(&path.join("SUMMARY.md")) {
            Artifact::Absent => {}
            Artifact::Unreadable(code) => tier.warnings.push(format!("{label}/SUMMARY.md could not be read ({code}); its commits are not indexed")),
            Artifact::Text(text) => for row in parse_commit_rows(&text) { tier.rows.push(Row { row, dir: dir.clone() }); },
        }
        tier.dirs.push(dir);
    }
    tier
}

fn is_task_slug(raw: &str) -> bool {
    static SLUG: LazyLock<Regex> = LazyLock::new(|| re(r"^[a-z0-9]+(?:-[a-z0-9]+)*$"));
    !raw.is_empty() && raw.len() <= 64 && SLUG.is_match(raw)
}

/// The off-roadmap tier: `tasks/<slug>/RECORD.md`, slug order.
pub fn build_task_index(planning_root: &Path) -> Tier {
    let mut tier = Tier::default();
    let root = planning_root.canonicalize().unwrap_or_else(|_| planning_root.to_path_buf());
    let inside = |path: &Path| path.canonicalize().is_ok_and(|real| real == root || real.starts_with(&root));
    let group = planning_root.join("tasks");
    if !inside(&group) { return tier; }
    let mut slugs: Vec<String> = entries_in(&group).into_iter().filter(|slug| is_task_slug(slug)).collect();
    slugs.sort();
    for slug in slugs {
        let dir_path = group.join(&slug);
        let path = dir_path.join("RECORD.md");
        if !inside(&dir_path) || !inside(&path) || !std::fs::metadata(&path).is_ok_and(|m| m.is_file()) { continue; }
        let dir = Dir { label: format!("tasks/{slug}"), path: Some(dir_path), group: "tasks".into(), phase: None,
            milestone: None, recovered: None, slug: Some(slug.clone()) };
        match read_artifact(&path) {
            Artifact::Absent => {}
            Artifact::Unreadable(code) => tier.warnings.push(format!("{}/RECORD.md could not be read ({code}); its commits are not indexed", dir.label)),
            Artifact::Text(text) => for row in parse_commit_rows(&text) { tier.rows.push(Row { row, dir: dir.clone() }); },
        }
        tier.dirs.push(dir);
    }
    tier
}

fn git_args(parts: &[&str]) -> Vec<String> { parts.iter().map(|part| (*part).to_owned()).collect() }

/// The pathspec a milestone close deletes when it prunes a phase directory.
pub const PRUNED_SUMMARY: &str = ".planning/phases/*/SUMMARY.md";

/// Parse the prune search's stdout: `\x01`-separated records, each a header
/// line then the deleted paths.
pub fn parse_prune_records(stdout: &str) -> Vec<Prune> {
    static PRUNED_PATH: LazyLock<Regex> = LazyLock::new(|| re(r"^\.planning/phases/([^/]+)/SUMMARY\.md$"));
    let mut prunes = Vec::new();
    for record in stdout.split('\x01') {
        if record.trim().is_empty() { continue; }
        let mut lines = record.split('\n');
        let header = lines.next().unwrap_or("");
        let mut fields = header.split('\x1f');
        let commit = fields.next().unwrap_or("").to_owned();
        if commit.is_empty() { continue; }
        let date = fields.next().unwrap_or("").to_owned();
        let at = fields.next().unwrap_or("").parse().unwrap_or(0);
        let parents: Vec<String> = fields.next().unwrap_or("").split(' ')
            .map(str::trim).filter(|p| !p.is_empty()).map(str::to_owned).collect();
        let mut phases: Vec<(String, String)> = lines.filter_map(|raw| {
            let path = raw.trim();
            PRUNED_PATH.captures(path).map(|found| (found[1].to_owned(), path.to_owned()))
        }).collect();
        phases.sort_by(|a, b| a.1.cmp(&b.1));
        let refused = match parents.len() {
            0 => Some(format!("the close at {} is a root commit, so there is no parent tree to recover from", &commit[..commit.len().min(8)])),
            1 => None,
            n => Some(format!("the close at {} is a merge with {n} parents, so the tree its phases were deleted from cannot be named without picking one arbitrarily", &commit[..commit.len().min(8)])),
        };
        let parent = (parents.len() == 1).then(|| parents[0].clone());
        prunes.push(Prune { commit, date, at, parents, parent, label: None, phases, refused });
    }
    prunes.sort_by(|a, b| b.date.cmp(&a.date).then_with(|| b.commit.cmp(&a.commit)));
    prunes
}

/// The one `## ` heading each prune commit added to ARCHIVE.md, when exactly
/// one; zero binds nothing and two or more do not say which owns the phases.
fn prune_labels(repo: &Path, commits: &[String]) -> BTreeMap<String, Option<String>> {
    static ADDED_SECTION: LazyLock<Regex> = LazyLock::new(|| re(r"^\+## (.+?)\s*$"));
    let mut added: BTreeMap<String, Vec<String>> = commits.iter().map(|commit| (commit.clone(), Vec::new())).collect();
    if commits.is_empty() { return BTreeMap::new(); }
    let mut args = git_args(&["show", "-U0", "-M", "--format=%x01%H"]);
    args.extend(commits.iter().cloned());
    args.extend(git_args(&["--", ".planning/ARCHIVE.md"]));
    let out = git::run(repo, &args);
    let mut current: Option<String> = None;
    for line in out.stdout.split('\n') {
        if let Some(rest) = line.strip_prefix('\x01') { current = Some(rest.trim().to_owned()); continue; }
        let Some(commit) = &current else { continue };
        let Some(headings) = added.get_mut(commit) else { continue };
        if let Some(found) = ADDED_SECTION.captures(line) { headings.push(found[1].to_owned()); }
    }
    added.into_iter().map(|(commit, headings)| {
        let label = (headings.len() == 1).then(|| headings[0].clone());
        (commit, label)
    }).collect()
}

/// Every close that deleted a phase summary, newest first, labelled.
pub fn find_prune_commits(repo: &Path) -> (Vec<Prune>, Vec<String>) {
    let args = git_args(&["log", "--full-history", "-M", "--diff-filter=D", "--name-only",
        "--format=%x01%H%x1f%cI%x1f%ct%x1f%P", "--", PRUNED_SUMMARY]);
    let out = git::run(repo, &args);
    if !out.ok() && out.stdout.is_empty() { return (Vec::new(), Vec::new()); }
    let mut prunes = parse_prune_records(&out.stdout);
    let labels = prune_labels(repo, &prunes.iter().map(|p| p.commit.clone()).collect::<Vec<_>>());
    for prune in &mut prunes { prune.label = labels.get(&prune.commit).cloned().flatten(); }
    let warnings = prunes.iter().filter_map(|prune| prune.refused.clone()).collect();
    (prunes, warnings)
}

fn recovered_dir(prune: &Prune, phase: &str, path: &str) -> Dir {
    let parent = prune.parent.clone().unwrap_or_default();
    let tree = path[..path.rfind('/').unwrap_or(0)].to_owned();
    Dir {
        label: format!("{}:{tree}", &parent[..parent.len().min(8)]),
        path: None,
        group: "recovered".into(),
        phase: Some(phase.to_owned()),
        milestone: Some(prune.label.clone().unwrap_or_else(|| format!("an unlabelled close ({})", &prune.commit[..prune.commit.len().min(8)]))),
        recovered: Some(Recovered { prune: prune.commit.clone(), parent, tree }),
        slug: None,
    }
}

/// The git-recovered tier: each pruned phase's SUMMARY.md read from the
/// prune's parent, and the prunes themselves for the named gap.
pub fn build_recovered_index(repo: &Path) -> (Tier, Vec<Prune>) {
    let (prunes, warnings) = find_prune_commits(repo);
    let mut tier = Tier { warnings, ..Tier::default() };
    for prune in &prunes {
        let Some(parent) = &prune.parent else { continue };
        for (phase, path) in &prune.phases {
            let dir = recovered_dir(prune, phase, path);
            let out = git::run(repo, &git_args(&["show", &format!("{parent}:{path}")]));
            if !out.ok() {
                tier.warnings.push(format!("{path} could not be recovered from {}; its commits are not indexed", &parent[..parent.len().min(8)]));
                continue;
            }
            for row in parse_commit_rows(&out.stdout) { tier.rows.push(Row { row, dir: dir.clone() }); }
            tier.dirs.push(dir);
        }
    }
    (tier, prunes)
}

/// The four tiers in order, with the prunes riding beside them.
pub fn build_index(repo: &Path) -> Index {
    let planning = repo.join(".planning");
    let disk = build_commit_index(&planning);
    let tasks = build_task_index(&planning);
    let (recovered, prunes) = build_recovered_index(repo);
    let warnings = disk.warnings.iter().chain(&tasks.warnings).chain(&recovered.warnings).cloned().collect();
    Index { tiers: vec![disk, tasks, recovered], prunes, warnings }
}

enum Resolution<'a> {
    Resolved(&'a Row),
    Ambiguous(Vec<&'a Row>),
    Unresolved,
}

/// Ask the tiers in order and take the first that answers at all.
fn resolve_commit<'a>(index: &'a Index, sha: &str) -> Resolution<'a> {
    for tier in &index.tiers {
        let matches: Vec<&Row> = tier.rows.iter().filter(|row| sha_matches(&row.row.commit, sha)).collect();
        if matches.is_empty() { continue; }
        let distinct: BTreeSet<String> = matches.iter()
            .map(|m| format!("{}\x1f{}\x1f{}", m.dir.label, m.row.plan, m.row.task)).collect();
        if distinct.len() > 1 { return Resolution::Ambiguous(matches); }
        return Resolution::Resolved(matches[0]);
    }
    Resolution::Unresolved
}

fn brief(row: &Row) -> Brief {
    Brief {
        label: row.dir.label.clone(),
        milestone: row.dir.milestone.clone(),
        phase: row.dir.phase.clone(),
        plan: row.row.plan.clone(),
        task: row.row.task.clone(),
        description: row.row.description.clone(),
        recovered: row.dir.recovered.clone(),
        slug: row.dir.slug.clone(),
    }
}

/// Read one named artifact of a directory: from disk, or from the recovered
/// tree through `git show`. A disk read that fails for a reason other than
/// absence warns; a recovered read that fails is silently empty.
fn pull(dir: &Dir, repo: &Path, name: &str, warnings: &mut Vec<String>) -> String {
    match &dir.path {
        None => {
            let Some(at) = &dir.recovered else { return String::new() };
            let out = git::run(repo, &git_args(&["show", &format!("{}:{}/{name}", at.parent, at.tree)]));
            if out.ok() { out.stdout } else { String::new() }
        }
        Some(path) => match read_artifact(&path.join(name)) {
            Artifact::Text(text) => text,
            Artifact::Absent => String::new(),
            Artifact::Unreadable(code) => {
                warnings.push(format!("{}/{name} could not be read ({code}); it did not reach the join", dir.label));
                String::new()
            }
        },
    }
}

/// The records of one phase directory for one plan cell.
pub struct PhaseRecords {
    pub context: String,
    pub summary: String,
    pub plan: String,
    pub plan_file: Option<String>,
    pub warnings: Vec<String>,
}

pub fn read_phase_records(dir: Option<&Dir>, plan_cell: &str, repo: &Path) -> PhaseRecords {
    let mut records = PhaseRecords { context: String::new(), summary: String::new(), plan: String::new(), plan_file: None, warnings: Vec::new() };
    let Some(dir) = dir else { return records };
    let key = plan_cell.trim();
    let spellings: Vec<String> = if !key.is_empty() && key != "1" {
        vec![format!("PLAN-{key}.md")]
    } else {
        vec![format!("PLAN-{}.md", if key.is_empty() { "1" } else { key }), "PLAN.md".into()]
    };
    let names: Vec<String> = match &dir.slug {
        Some(_) => std::iter::once("RECORD.md".to_owned()).chain(spellings).collect(),
        None => spellings,
    };
    for name in names {
        let text = pull(dir, repo, &name, &mut records.warnings);
        if !text.is_empty() { records.plan = text; records.plan_file = Some(name); break; }
    }
    records.context = pull(dir, repo, "CONTEXT.md", &mut records.warnings);
    records.summary = pull(dir, repo, "SUMMARY.md", &mut records.warnings);
    records
}

fn list_record_names(dir: &Dir, repo: &Path) -> Vec<String> {
    let mut names: Vec<String> = match &dir.path {
        None => {
            let Some(at) = &dir.recovered else { return Vec::new() };
            let out = git::run(repo, &git_args(&["ls-tree", "--name-only", &format!("{}:{}", at.parent, at.tree)]));
            if !out.ok() { return Vec::new(); }
            out.stdout.split('\n').map(str::trim).filter(|n| !n.is_empty()).map(str::to_owned).collect()
        }
        Some(path) => entries_in(path),
    };
    names.retain(|name| name.starts_with("ADJUDICATION-") && name.ends_with(".json"));
    names.sort();
    names
}

/// Every adjudication record in a directory, parsed, with its issues named.
pub fn read_adjudications(dir: Option<&Dir>, repo: &Path) -> (Vec<Adjudication>, Vec<String>) {
    let mut warnings = Vec::new();
    let mut records = Vec::new();
    let Some(dir) = dir else { return (records, warnings) };
    for name in list_record_names(dir, repo) {
        let before = warnings.len();
        let text = pull(dir, repo, &name, &mut warnings);
        if warnings.len() > before { continue; }
        let parsed = parse_adjudication(&name, &text);
        for issue in &parsed.issues { warnings.push(format!("{}/{name}: {issue}", dir.label)); }
        records.push(parsed);
    }
    (records, warnings)
}

fn is_commit_id(text: &str) -> bool { (4..=40).contains(&text.len()) && is_hex(text) }

/// The commits in `base..head`, or none when the range does not resolve.
pub fn range_members(repo: &Path, base: &str, head: &str) -> Option<BTreeSet<String>> {
    if !is_commit_id(base) || !is_commit_id(head) { return None; }
    let out = git::run(repo, &git_args(&["rev-list", &format!("{base}..{head}")]));
    if !out.ok() { return None; }
    Some(out.stdout.split('\n').map(str::trim).filter(|l| !l.is_empty()).map(str::to_owned).collect())
}

/// The paths each commit touched, one `git show` for the whole set.
pub fn touched_paths(repo: &Path, shas: &[String]) -> BTreeMap<String, Vec<String>> {
    let mut out = BTreeMap::new();
    let mut ids: Vec<String> = Vec::new();
    for sha in shas {
        if is_commit_id(sha) && !ids.contains(sha) { ids.push(sha.clone()); }
    }
    if ids.is_empty() { return out; }
    let mut args = git_args(&["show", "--name-only", "-M", "--format=%x01%H"]);
    args.extend(ids);
    let res = git::run(repo, &args);
    let mut current: Option<String> = None;
    for line in res.stdout.split('\n') {
        if let Some(rest) = line.strip_prefix('\x01') {
            let sha = rest.trim().to_owned();
            out.entry(sha.clone()).or_insert_with(Vec::new);
            current = Some(sha);
            continue;
        }
        let path = line.trim();
        if let (Some(sha), false) = (&current, path.is_empty()) {
            out.get_mut(sha).expect("the current commit is registered").push(path.to_owned());
        }
    }
    for list in out.values_mut() { list.sort(); }
    out
}

/// The earliest close at or after `at`, ties to the smaller commit id.
pub fn close_over(prunes: &[Prune], at: i64) -> Option<Close> {
    let mut found: Option<&Prune> = None;
    for prune in prunes {
        if prune.at < at { continue; }
        let better = match found {
            None => true,
            Some(best) => prune.at < best.at || (prune.at == best.at && prune.commit < best.commit),
        };
        if better { found = Some(prune); }
    }
    found.map(|prune| Close { commit: prune.commit.clone(), label: prune.label.clone(), date: prune.date.clone() })
}

fn canonical_number(text: &str) -> bool {
    let canonical_int = |part: &str| part == "0" || (!part.is_empty() && !part.starts_with('0'));
    match text.split_once('.') {
        None => canonical_int(text),
        Some((int, frac)) => canonical_int(int) && !frac.is_empty() && !frac.ends_with('0'),
    }
}

/// ARCHIVE.md's residue rows, grouped by the milestone heading above them.
pub fn archive_sections(planning_root: &Path) -> BTreeMap<String, Vec<ArchiveRow>> {
    static SECTION: LazyLock<Regex> = LazyLock::new(|| re(r"^## (.*)$"));
    static ROW: LazyLock<Regex> = LazyLock::new(|| re(r"^- `(phases/(\d+(?:\.\d+)?)/(?:SUMMARY|UAT|CONTEXT)\.md)`: (.*)$"));
    let mut out: BTreeMap<String, Vec<ArchiveRow>> = BTreeMap::new();
    let Artifact::Text(text) = read_artifact(&planning_root.join("ARCHIVE.md")) else { return out };
    let mut label: Option<String> = None;
    for line in normalize(&text).split('\n') {
        if let Some(found) = SECTION.captures(line) { label = Some(found[1].trim().to_owned()); continue; }
        let Some(current) = &label else { continue };
        let Some(found) = ROW.captures(line) else { continue };
        if !canonical_number(&found[2]) { continue; }
        out.entry(current.clone()).or_default().push(ArchiveRow { origin: found[1].to_owned(), text: found[3].to_owned() });
    }
    out
}

/// A conventional commit's scope, corroboration only.
fn commit_scope(subject: &str) -> Option<String> {
    static SCOPE: LazyLock<Regex> = LazyLock::new(|| re(r"^[a-zA-Z]+\(([^)\n]*)\)!?:"));
    SCOPE.captures(subject).map(|found| found[1].trim().to_owned()).filter(|scope| !scope.is_empty())
}

/// Resolve every commit against the index and hang the record edges off each
/// one: one read per phase directory and plan, one range resolution per
/// distinct range, and one `git show` for every unresolved commit's paths.
pub fn join_chain(repo: &Path, path: &str, index: &Index, raws: &[RawEntry]) -> (Vec<Entry>, Vec<String>) {
    let mut warnings: Vec<String> = Vec::new();
    let warn = |warnings: &mut Vec<String>, text: String| { if !warnings.contains(&text) { warnings.push(text); } };
    let mut memo: BTreeMap<String, PhaseRecords> = BTreeMap::new();
    let mut reviews: BTreeMap<String, Vec<Adjudication>> = BTreeMap::new();
    let mut ranges: BTreeMap<String, Option<BTreeSet<String>>> = BTreeMap::new();

    let mut entries: Vec<Entry> = Vec::new();
    for raw in raws {
        let resolution = resolve_commit(index, &raw.sha);
        let join = match resolution {
            Resolution::Unresolved => Join::Unresolved { gap: None },
            Resolution::Ambiguous(matches) => Join::Ambiguous { matches: matches.iter().map(|m| brief(m)).collect() },
            Resolution::Resolved(row) => {
                let summary = brief(row);
                let key = format!("{}\x1f{}", summary.label, summary.plan);
                let dir = index.dir(&summary.label);
                if !memo.contains_key(&key) { memo.insert(key.clone(), read_phase_records(dir, &summary.plan, repo)); }
                let records = memo.get(&key).expect("memoized records");
                for warning in &records.warnings { warn(&mut warnings, warning.clone()); }
                let decision = decisions_for(&records.plan, &records.context, &summary.task);
                let deviation = parse_deviations(&records.summary);
                if !reviews.contains_key(&summary.label) {
                    let (read, read_warnings) = read_adjudications(dir, repo);
                    for warning in read_warnings { warn(&mut warnings, warning); }
                    reviews.insert(summary.label.clone(), read);
                }
                let read = reviews.get(&summary.label).expect("memoized reviews");
                let mut findings = Vec::new();
                let mut unresolved = Vec::new();
                for record in read {
                    for survivor in &record.survivors {
                        let members = match (&survivor.base_id, &survivor.head_id) {
                            (Some(base), Some(head)) => {
                                let range = format!("{base}..{head}");
                                ranges.entry(range).or_insert_with(|| range_members(repo, base, head)).clone()
                            }
                            _ => None,
                        };
                        match members {
                            None => unresolved.push(survivor.clone()),
                            Some(members) if members.contains(&raw.sha) => findings.push(survivor.clone()),
                            Some(_) => {}
                        }
                    }
                }
                let declared = DeclaredJoin {
                    plan_file: records.plan_file.clone(),
                    tasks: if records.plan.is_empty() { Vec::new() } else { declaring_tasks(&records.plan, path) },
                };
                Join::Resolved(Box::new(Resolved {
                    brief: summary, decision, deviation,
                    review: ReviewJoin { records: read.len(), findings, unresolved },
                    declared,
                }))
            }
        };
        entries.push(Entry { sha: raw.sha.clone(), date: raw.date.clone(), at: raw.at, subject: raw.subject.clone(), join });
    }

    let open: Vec<String> = entries.iter()
        .filter(|entry| matches!(entry.join, Join::Unresolved { .. })).map(|entry| entry.sha.clone()).collect();
    if !open.is_empty() {
        let paths = touched_paths(repo, &open);
        let archive = archive_sections(&repo.join(".planning"));
        for entry in &mut entries {
            if !matches!(entry.join, Join::Unresolved { .. }) { continue; }
            let close = close_over(&index.prunes, entry.at);
            let rows = close.as_ref().and_then(|close| close.label.as_ref()).and_then(|label| archive.get(label)).cloned().unwrap_or_default();
            entry.join = Join::Unresolved { gap: Some(Gap {
                close,
                scope: commit_scope(&entry.subject),
                paths: paths.get(&entry.sha).cloned().unwrap_or_default(),
                archive: rows,
            }) };
        }
    }
    (entries, warnings)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn commit_rows_read_the_header_by_name_and_skip_non_hex_cells() {
        let text = "# S\n\n## Commits\n\n| task | commit | plan |\n|---|---|---|\n| 2 | abcd1234 | 1 |\n| x | (none) | 1 |\n| 3 | a\\|b | 1 |\n\n## Next\n| plan | task | commit |\n| 1 | 1 | ffff |\n";
        assert_eq!(parse_commit_rows(text), vec![CommitRow { plan: "1".into(), task: "2".into(), commit: "abcd1234".into(), description: String::new() }]);
        assert!(parse_commit_rows("## Commits\n| plan | task |\n| 1 | 2 |\n").is_empty());
    }

    #[test]
    fn sha_matches_is_a_case_insensitive_prefix_either_way() {
        assert!(sha_matches("ABCD1234", "abcd1234ef"));
        assert!(sha_matches("abcd1234ef", "abcd"));
        assert!(!sha_matches("abcd", "abce"));
        assert!(!sha_matches("", "abcd"));
        assert!(!sha_matches("xyz", "xyz"));
    }

    #[test]
    fn decisions_prefer_the_task_body_then_the_plan_context_then_the_phase() {
        let context = "# C\n\n## Decisions\n- D-01: keep it\n- D-02: drop it\n";
        let plan = "# P\n\n## Context\nCites D-02.\n\n## Tasks\n\n### Task 1: A\n- **Action:** Follow D-01 and D-09.\n\n### Task 2: B\n- **Action:** nothing\n";
        let task = decisions_for(plan, context, "1");
        assert_eq!(task.scope, "task");
        assert_eq!(task.ids, ["D-01", "D-09"]);
        assert_eq!(task.lines, ["D-01: keep it", "D-09 - cited here, but the phase's CONTEXT.md carries no such decision"]);
        let plan_scope = decisions_for(plan, context, "2");
        assert_eq!((plan_scope.scope, plan_scope.ids.clone()), ("plan", vec!["D-02".to_owned()]));
        let phase = decisions_for("", context, "");
        assert_eq!((phase.scope, phase.lines.len()), ("phase", 2));
        assert_eq!(decisions_for("", "", "").scope, "absent");
    }

    #[test]
    fn durable_decisions_win_and_a_second_section_adds_only_new_ids() {
        let context = "## Durable decisions\n- D-01: one\n\n## Decisions\n- D-01: repeated\n- D-03: three\n";
        assert_eq!(context_decisions(context), ["D-01: one", "D-03: three"]);
    }

    #[test]
    fn deviations_skip_placeholders_and_strip_the_tag() {
        let text = "## Deviations\n\n- None\n- <fill in>\n- [deviation] D-01 held\n-   plain\n\n## After\n- not here\n";
        assert_eq!(parse_deviations(text), ["D-01 held", "plain"]);
    }

    #[test]
    fn declaring_tasks_follow_continuation_lines_and_directory_prefixes() {
        let plan = "## Tasks\n\n### Task 1: One\n\n- **Files:** `src/a.rs` (new),\n  src/lib/\n- **Action:** x\n\n### Task 2: Two\n\n- **Files:** src/b.rs\n";
        let hits = declaring_tasks(plan, "src/lib/deep.rs");
        assert_eq!(hits, vec![DeclaringTask { ordinal: 1, title: "One".into(), declaration: "src/lib/".into() }]);
        assert_eq!(declaring_tasks(plan, "src/b.rs")[0].ordinal, 2);
        assert!(declaring_tasks(plan, "src/c.rs").is_empty());
    }

    #[test]
    fn task_bodies_stop_at_the_next_section_outside_a_fence() {
        let plan = "### Task 1: A\nbody\n```\n## fenced\n```\nmore\n## Real\n### Task 2: B\nx\n";
        let bodies = plan_task_bodies(plan);
        assert_eq!(bodies.len(), 2);
        assert_eq!(bodies[0].body, "### Task 1: A\nbody\n```\n## fenced\n```\nmore");
        assert_eq!(bodies[1].body, "### Task 2: B\nx\n", "the last body keeps the trailing empty line the split leaves");
    }

    #[test]
    fn prune_records_sort_newest_first_and_name_a_merge_or_root() {
        let stdout = "\x01aaaa\x1f2026-01-02T00:00:00+00:00\x1f2\x1fp1\n\n.planning/phases/3/SUMMARY.md\n.planning/phases/12/SUMMARY.md\nother\n\
                      \x01bbbb\x1f2026-01-03T00:00:00+00:00\x1f3\x1fp1 p2\n\n.planning/phases/4/SUMMARY.md\n\
                      \x01cccc\x1f2026-01-01T00:00:00+00:00\x1f1\x1f\n\n.planning/phases/5/SUMMARY.md\n";
        let prunes = parse_prune_records(stdout);
        assert_eq!(prunes.iter().map(|p| p.commit.as_str()).collect::<Vec<_>>(), ["bbbb", "aaaa", "cccc"]);
        assert_eq!(prunes[1].phases, [("12".to_owned(), ".planning/phases/12/SUMMARY.md".to_owned()), ("3".to_owned(), ".planning/phases/3/SUMMARY.md".to_owned())]);
        assert_eq!(prunes[1].parent.as_deref(), Some("p1"));
        assert_eq!(prunes[0].refused.as_deref(), Some("the close at bbbb is a merge with 2 parents, so the tree its phases were deleted from cannot be named without picking one arbitrarily"));
        assert_eq!(prunes[2].refused.as_deref(), Some("the close at cccc is a root commit, so there is no parent tree to recover from"));
    }

    #[test]
    fn close_over_takes_the_earliest_close_at_or_after_the_commit() {
        let prune = |commit: &str, at: i64| Prune { commit: commit.into(), date: at.to_string(), at, parents: vec![],
            parent: None, label: None, phases: vec![], refused: None };
        let prunes = [prune("b", 20), prune("a", 20), prune("c", 30), prune("d", 5)];
        assert_eq!(close_over(&prunes, 10).map(|c| c.commit), Some("a".into()));
        assert_eq!(close_over(&prunes, 25).map(|c| c.commit), Some("c".into()));
        assert_eq!(close_over(&prunes, 31), None);
    }

    #[test]
    fn a_recovered_directory_is_labelled_by_the_close_or_by_its_absence() {
        let mut prune = Prune { commit: "0123456789abcdef".into(), date: String::new(), at: 0, parents: vec!["fedcba9876543210".into()],
            parent: Some("fedcba9876543210".into()), label: None, phases: vec![], refused: None };
        let dir = recovered_dir(&prune, "2", ".planning/phases/2/SUMMARY.md");
        assert_eq!(dir.label, "fedcba98:.planning/phases/2");
        assert_eq!(dir.milestone.as_deref(), Some("an unlabelled close (01234567)"));
        prune.label = Some("v1.2.0".into());
        assert_eq!(recovered_dir(&prune, "2", ".planning/phases/2/SUMMARY.md").milestone.as_deref(), Some("v1.2.0"));
    }

    #[test]
    fn commit_scope_reads_only_a_conventional_subject() {
        assert_eq!(commit_scope("feat(1-3): x"), Some("1-3".into()));
        assert_eq!(commit_scope("feat(): x"), None);
        assert_eq!(commit_scope("plain subject"), None);
    }
}
