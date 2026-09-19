//! Binary-owned projections rendered from retained records, never authored.
//!
//! UAT.md for a native phase is the imported original, verbatim, followed by
//! the native human results. Every renderer here is a pure function of the
//! snapshot so commit and recovery derive the same bytes.
use super::human;
use crate::store::{Error, Result};
use serde_json::Value;
use std::collections::BTreeSet;

pub const UAT_HEADING: &str = "## Native human results";

/// One `## Traceability` row: `| <id> | Phase <n> | <status> |`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TraceRow {
    pub line: usize,
    pub id: String,
    pub phase: String,
    pub status: String,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TraceTable {
    /// Line index of the header separator.
    pub separator: usize,
    /// Line index after which a new row is appended.
    pub anchor: usize,
    pub rows: Vec<TraceRow>,
}

/// Fenced lines never open, close or belong to a section.
fn fenced(line: &str, open: &mut Option<(u8, usize)>) -> bool {
    let indent = line.bytes().take_while(|&b| b == b' ').count();
    let rest = &line[indent..];
    let Some(ch @ (b'`' | b'~')) = rest.bytes().next().filter(|_| indent <= 3) else { return open.is_some() };
    let len = rest.bytes().take_while(|&b| b == ch).count();
    if len < 3 { return open.is_some() }
    match *open {
        None => { *open = Some((ch, len)); true }
        Some((opening, length)) if opening == ch && len >= length && rest[len..].trim().is_empty() => { *open = None; true }
        Some(_) => true,
    }
}

/// The unfenced lines of one `## <name>` section: (heading index, end index).
fn section(lines: &[&str], heading: &str) -> Option<(usize, usize)> {
    let mut open = None;
    let mut start = None;
    for (i, line) in lines.iter().enumerate() {
        if fenced(line, &mut open) { continue }
        match start {
            None => if line.trim() == heading { start = Some(i) },
            Some(s) => if line.starts_with("## ") { return Some((s, i)) },
        }
    }
    start.map(|s| (s, lines.len()))
}

fn separator(line: &str) -> bool {
    if !line.starts_with('|') { return false }
    let cells: Vec<_> = line.split('|').collect();
    let cells = &cells[1..cells.len().saturating_sub(1)];
    cells.len() >= 2 && cells.iter().all(|c| !c.trim().is_empty() && c.bytes().all(|b| matches!(b, b'-' | b':' | b' ' | b'\t' | b'\r')))
}

fn cells(line: &str) -> Option<[String; 3]> {
    let mut parts = line.strip_prefix('|')?.splitn(4, '|');
    let id = parts.next()?.replace('*', "").trim().to_owned();
    let phase = parts.next()?.trim().to_owned();
    let status = parts.next()?.trim().to_owned();
    parts.next()?;
    Some([id, phase, status])
}

/// The `## Traceability` table, when the document has one with a separator.
pub fn traceability(text: &str) -> Option<TraceTable> {
    let lines: Vec<&str> = text.split('\n').collect();
    let (start, end) = section(&lines, "## Traceability")?;
    let header = (start + 1..end).find(|i| separator(lines[*i]))?;
    let mut anchor = header;
    for (i, line) in lines.iter().enumerate().take(end).skip(header + 1) {
        if line.starts_with('|') { anchor = i } else { break }
    }
    let mut rows = Vec::new();
    for (i, line) in lines.iter().enumerate().take(end).skip(start + 1) {
        if i == header { continue }
        let Some([id, phase, status]) = cells(line) else { continue };
        if id.is_empty() || id == "Requirement" || separator(line) { continue }
        rows.push(TraceRow { line: i, id, phase, status });
    }
    Some(TraceTable { separator: header, anchor, rows })
}

/// Ids declared as `- **<ID>**: ...` bullets under `## Active`; None without
/// the section, which seeds nothing rather than inventing scope.
pub fn active_ids(text: &str) -> Option<BTreeSet<String>> {
    let lines: Vec<&str> = text.split('\n').collect();
    let (start, end) = section(&lines, "## Active")?;
    let mut open = None;
    let mut ids = BTreeSet::new();
    for line in lines.iter().take(end).skip(start + 1) {
        if fenced(line, &mut open) { continue }
        // `- **ID**: ...` at column zero, an optional checkbox tolerated.
        let Some(rest) = line.strip_prefix('-') else { continue };
        if !rest.starts_with([' ', '\t']) { continue }
        let rest = rest.trim_start();
        let rest = ["[ ]", "[x]", "[X]"].iter().find_map(|m| rest.strip_prefix(m)).map(str::trim_start).unwrap_or(rest);
        let Some(rest) = rest.strip_prefix("**") else { continue };
        let Some((id, _)) = rest.split_once("**") else { continue };
        let id = id.trim();
        if !id.is_empty() { ids.insert(id.to_owned()); }
    }
    Some(ids)
}

/// Seed `| <id> | Phase <n> | Pending |` for every declared id that is
/// active and has no row yet. Existing rows, their statuses and every other
/// byte are preserved; nothing is seeded without an active bullet, a table
/// or a separator. Returns the new text and the ids inserted, in order.
pub fn seed_requirements(text: &str, phase: u32, declared: &[String]) -> Option<(String, Vec<String>)> {
    let table = traceability(text)?;
    let active = active_ids(text)?;
    let existing: BTreeSet<&str> = table.rows.iter().map(|r| r.id.as_str()).collect();
    let mut inserted = Vec::new();
    for id in declared {
        if active.contains(id) && !existing.contains(id.as_str()) && !inserted.contains(id) { inserted.push(id.clone()); }
    }
    if inserted.is_empty() { return None }
    let mut lines: Vec<String> = text.split('\n').map(str::to_owned).collect();
    let eol = if lines[table.anchor].ends_with('\r') { "\r" } else { "" };
    let rows: Vec<String> = inserted.iter().map(|id| format!("| {id} | Phase {phase} | Pending |{eol}")).collect();
    lines.splice(table.anchor + 1..table.anchor + 1, rows);
    Some((lines.join("\n"), inserted))
}

/// The REQUIREMENTS.md bytes a publication installs, from the exact observed
/// preimage: None when nothing is to be seeded (absent file, no table or no
/// missing active row), an error when the preimage is not text.
pub fn seeded_requirements(preimage: Option<&[u8]>, phase: u32, declared: &[String]) -> Result<Option<(Vec<u8>, Vec<String>)>> {
    let Some(bytes) = preimage else { return Ok(None) };
    let text = std::str::from_utf8(bytes).map_err(|_| Error::Invalid("requirements-projection: REQUIREMENTS.md is not UTF-8 text".into()))?;
    Ok(seed_requirements(text, phase, declared).map(|(text, ids)| (text.into_bytes(), ids)))
}

/// None when the phase has neither a retained original nor a native result.
pub fn uat(data: &Value, phase: u32) -> Result<Option<String>> {
    let originals = human::originals(data)?;
    let history = human::records(data)?;
    let original = originals.get(&phase.to_string());
    if original.is_none() && !history.iter().any(|r| r.submission.phase == phase) {
        return Ok(None);
    }
    let mut out = String::new();
    if let Some(original) = original {
        out.push_str(&original.text);
        if !out.ends_with('\n') { out.push('\n'); }
        out.push('\n');
    }
    out.push_str(UAT_HEADING);
    out.push('\n');
    out.push_str("\nRendered by the binary from attributed verification-human-result records.\nReplies are immutable; a later result supersedes an earlier one and the\nfirst-pass outcome is carried, never rewritten. Edit through the operation.\n");
    for (index, item) in human::items(data, phase)?.iter().filter(|i| i["source"] == "native").enumerate() {
        let history = item["history"].as_array().cloned().unwrap_or_default();
        let latest = history.last().cloned().unwrap_or(Value::Null);
        out.push_str(&format!("\n### {}. {}\n", index + 1, item["id"].as_str().unwrap_or_default()));
        if let Some(name) = item["name"].as_str() { out.push_str(&format!("name: {name}\n")); }
        out.push_str(&format!("status: {}\n", item["status"].as_str().unwrap_or_default()));
        out.push_str(&format!("first_pass: {}\n", item["first_pass"].as_str().unwrap_or_default()));
        out.push_str(&format!("reported: {}\n", serde_json::to_string(&latest["reply"])?));
        out.push_str(&format!("owner: {}\n", latest["owner"].as_str().unwrap_or_default()));
        out.push_str(&format!("at: {}\n", latest["at"].as_str().unwrap_or_default()));
        out.push_str(&format!("record: {}\n", latest["id"].as_str().unwrap_or_default()));
        out.push_str(&format!("results: {}\n", history.len()));
    }
    Ok(Some(out))
}

#[cfg(test)]
mod tests {
    use super::*;

    const DOCUMENT: &str = "# Requirements\n\n## Active\n\n- **A-01**: first\n- [ ] **B-02**: second\n- **Note**: prose bullet\n  - **C-03**: indented, not declared\n\n```markdown\n## Active\n- **F-99**: fenced example\n## Traceability\n| F-99 | Phase 1 | Pending |\n```\n\n## Traceability\n\nProse before the table.\n\n| Requirement | Phase | Status |\n|-------------|-------|--------|\n| **A-01** | Phase 2 | Complete |\n| D-04 | Phase 3 | Pending |\n\nTrailing prose.\n\n## Shipped\n\n| Requirement | Phase | Status | Milestone |\n|---|---|---|---|\n| OLD-01 | 1 | Complete | v1 |\n";

    #[test]
    fn active_ids_read_column_zero_bold_bullets_outside_fences() {
        assert_eq!(active_ids(DOCUMENT).unwrap().into_iter().collect::<Vec<_>>(), ["A-01", "B-02", "Note"]);
        assert_eq!(active_ids("# No active section\n"), None);
    }

    #[test]
    fn traceability_reads_only_the_unfenced_section_rows() {
        let table = traceability(DOCUMENT).unwrap();
        assert_eq!(table.rows.iter().map(|r| (r.id.as_str(), r.phase.as_str(), r.status.as_str())).collect::<Vec<_>>(),
            [("A-01", "Phase 2", "Complete"), ("D-04", "Phase 3", "Pending")]);
        assert_eq!(table.rows[1].line, table.anchor);
        assert_eq!(traceability("## Traceability\n\nno table here\n"), None);
    }

    #[test]
    fn seeding_appends_only_missing_active_rows_after_the_last_row() {
        let declared = ["B-02", "A-01", "Z-09", "Note", "B-02"].map(String::from);
        let (text, inserted) = seed_requirements(DOCUMENT, 7, &declared).unwrap();
        assert_eq!(inserted, ["B-02", "Note"]);
        assert_eq!(text, DOCUMENT.replace("| D-04 | Phase 3 | Pending |\n", "| D-04 | Phase 3 | Pending |\n| B-02 | Phase 7 | Pending |\n| Note | Phase 7 | Pending |\n"));
        assert_eq!(seed_requirements(DOCUMENT, 7, &["A-01".to_owned(), "Z-09".to_owned()]), None);
        assert_eq!(seed_requirements("## Active\n- **A-01**: x\n", 7, &["A-01".to_owned()]), None);
        let crlf = "## Active\r\n- **A-01**: x\r\n\r\n## Traceability\r\n\r\n| Requirement | Phase | Status |\r\n|---|---|---|\r\n";
        let (text, _) = seed_requirements(crlf, 2, &["A-01".to_owned()]).unwrap();
        assert_eq!(text, format!("{crlf}| A-01 | Phase 2 | Pending |\r\n"));
    }
}
