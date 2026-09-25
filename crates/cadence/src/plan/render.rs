//! Canonical plan documents are rendered from typed authoring pieces.
use super::model::{Content, Execution, Task};
use cadence::store::{Error, Result};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Part {
    pub selector: String,
    pub title: String,
    pub body: String,
}

fn finish_document(content: &Content, execution: &Execution, body: &str) -> Result<Vec<u8>> {
    if normalize(content)? != content.body {
        return Err(Error::Invalid("evidence-map-section: approve the complete previewed document before publication".into()));
    }
    // JSON field values are also YAML values. Block keys preserve the native
    // reader's canonical-number span checks without a second schema dialect.
    let mut text = format!("---\nphase: {}\nplan: {}\n", content.phase, content.plan);
    for (key, value) in [
        ("requirements", serde_json::to_value(&content.requirements)?),
        ("files", serde_json::to_value(&content.files)?),
        ("directories", serde_json::to_value(&content.directories)?),
        ("execution", serde_json::to_value(execution)?),
    ] {
        text.push_str(&format!("{key}: {}\n", serde_json::to_string(&value)?));
    }
    text.push_str("---\n");
    text.push_str(body);
    let bytes = text.into_bytes();
    cadence::execution::plan::parse_plan(&bytes, content.phase.get(), content.plan.get())
        .map_err(|error| Error::Invalid(error.to_string()))?;
    Ok(bytes)
}

pub fn document(content: &Content) -> Result<Vec<u8>> {
    if content.execution.is_empty() || content.body.is_empty() {
        return Err(Error::Invalid("typed plan content has not been bound to its rendered document".into()));
    }
    finish_document(content, &content.execution, &content.body)
}

fn push_slot(text: &mut String, value: &str) {
    text.push_str(value);
    if !value.ends_with('\n') { text.push('\n'); }
    text.push('\n');
}

fn task_section(number: usize, task: &Task) -> String {
    let mut text = format!(
        "### Task {number}: {}\n\n- **ID:** {}\n- **Files:** {}\n- **Action:** {}\n- **Verify:**\n",
        task.title,
        task.id,
        task.files.join(", "),
        task.action,
    );
    for command in &task.verify {
        text.push_str(&format!("  - {command}\n"));
    }
    text.push('\n');
    text
}

pub fn body(content: &Content, truths: &[(String, String)]) -> Result<String> {
    let mut text = String::from("## Goal\n\n");
    push_slot(&mut text, &content.goal);
    text.push_str("## Must be true when done\n\n");
    for (id, sentence) in truths {
        text.push_str(&format!("- {id}. {sentence}\n"));
    }
    text.push_str("\n## Context\n\n");
    push_slot(&mut text, &content.context);
    if let Some(map) = &content.evidence_map {
        text.push_str(&section(map)?);
    }
    text.push_str("## Tasks\n\n");
    for (index, task) in content.tasks.iter().enumerate() {
        text.push_str(&task_section(index + 1, task));
    }
    text.push_str("## Notes\n\n");
    text.push_str(&content.notes);
    if !text.ends_with('\n') { text.push('\n'); }
    Ok(text)
}

pub fn bound(content: &Content, truths: &[(String, String)]) -> Result<Content> {
    if !content.execution.is_empty() || !content.body.is_empty() {
        document(content)?;
        return Ok(content.clone());
    }
    let mut retained = content.clone();
    retained.execution = content.derived_execution();
    retained.body = body(content, truths)?;
    document(&retained)?;
    Ok(retained)
}

pub fn draft_document(content: &Content, truths: &[(String, String)]) -> Result<Vec<u8>> {
    document(&bound(content, truths)?)
}

/// Level-two headings outside fenced and indented code, with byte offsets.
fn headings(body: &str) -> Vec<(usize, String)> {
    let mut found = Vec::new();
    let mut fence: Option<(u8, usize)> = None;
    let mut offset = 0;
    for line in body.split_inclusive('\n') {
        let text = line.trim_end_matches(['\r', '\n']);
        let indent = text.bytes().take_while(|b| *b == b' ').count();
        if indent <= 3 {
            let text = &text[indent..];
            let bytes = text.as_bytes();
            if let Some(&(marker, size)) = fence.as_ref() {
                let count = bytes.iter().take_while(|b| **b == marker).count();
                if count >= size && text[count..].trim().is_empty() { fence = None; }
            } else {
                let marker = bytes.first().copied().unwrap_or(0);
                let size = bytes.iter().take_while(|b| **b == marker).count();
                if matches!(marker, b'`' | b'~') && size >= 3
                    && (marker != b'`' || !text[size..].contains('`'))
                {
                    fence = Some((marker, size));
                } else if let Some(rest) = text.strip_prefix("##")
                    && (rest.is_empty() || rest.starts_with([' ', '\t']))
                {
                    let title = rest.trim();
                    let without_hashes = title.trim_end_matches('#');
                    let title = if without_hashes.ends_with([' ', '\t']) { without_hashes.trim_end() } else { title };
                    found.push((offset, title.to_owned()));
                }
            }
        }
        offset += line.len();
    }
    found
}

fn task_headings(body: &str) -> Vec<(usize, String)> {
    let mut found = Vec::new();
    let mut fence: Option<(u8, usize)> = None;
    let mut offset = 0;
    let mut in_tasks = false;
    for line in body.split_inclusive('\n') {
        let text = line.trim_end_matches(['\r', '\n']);
        let indent = text.bytes().take_while(|byte| *byte == b' ').count();
        if indent <= 3 {
            let text = &text[indent..];
            let bytes = text.as_bytes();
            if let Some(&(marker, size)) = fence.as_ref() {
                let count = bytes.iter().take_while(|byte| **byte == marker).count();
                if count >= size && text[count..].trim().is_empty() {
                    fence = None;
                }
            } else {
                let marker = bytes.first().copied().unwrap_or(0);
                let size = bytes.iter().take_while(|byte| **byte == marker).count();
                if matches!(marker, b'`' | b'~') && size >= 3
                    && (marker != b'`' || !text[size..].contains('`'))
                {
                    fence = Some((marker, size));
                } else if let Some(rest) = text.strip_prefix("##")
                    && !rest.starts_with('#')
                    && (rest.is_empty() || rest.starts_with([' ', '\t']))
                {
                    in_tasks = rest.trim().trim_end_matches('#').trim_end() == "Tasks";
                } else if in_tasks
                    && let Some(rest) = text.strip_prefix("###")
                    && !rest.starts_with('#')
                    && (rest.is_empty() || rest.starts_with([' ', '\t']))
                {
                    found.push((offset, rest.trim().trim_end_matches('#').trim_end().to_owned()));
                }
            }
        }
        offset += line.len();
    }
    found
}

/// Fence-aware task spans aligned to the plan's retained execution task ids.
pub fn task_parts(content: &Content) -> Result<Vec<Part>> {
    if !content.tasks.is_empty() {
        return Ok(content.tasks.iter().enumerate().map(|(index, task)| Part {
            selector: format!("task:{}", task.id),
            title: task.title.clone(),
            body: task_section(index + 1, task),
        }).collect());
    }
    let headings = task_headings(&content.body);
    if headings.len() != content.execution.tasks.len() {
        return Err(Error::Invalid(format!(
            "plan task headings are ambiguous: {} headings for {} retained tasks",
            headings.len(),
            content.execution.tasks.len()
        )));
    }
    Ok(headings
        .iter()
        .enumerate()
        .map(|(index, (start, title))| Part {
            selector: format!("task:{}", content.execution.tasks[index].id),
            title: title.clone(),
            body: content.body[*start..headings.get(index + 1).map_or(content.body.len(), |next| next.0)].to_owned(),
        })
        .collect())
}

fn map_span(body: &str) -> Result<Option<std::ops::Range<usize>>> {
    let headings = headings(body);
    let mut spans = headings.iter().enumerate().filter(|(_, (_, title))| title == "Evidence map")
        .map(|(i, (start, _))| *start..headings.get(i + 1).map_or(body.len(), |h| h.0));
    let first = spans.next();
    if spans.next().is_some() {
        return Err(Error::Invalid("evidence-map-section: ambiguous duplicate Evidence map sections".into()));
    }
    Ok(first)
}

pub fn old_section(body: &str) -> Result<Option<String>> {
    Ok(map_span(body)?.map(|range| body[range].to_owned()))
}

pub fn section(map: &super::evidence::Map) -> Result<String> {
    Ok(format!("## Evidence map\n\n```json\n{}\n```\n\n", serde_json::to_string_pretty(map)?))
}

/// Only the unapproved preview inserts text. The commit path compares the
/// already approved bytes with this final form and refuses silent rewriting.
pub fn normalize(content: &Content) -> Result<String> {
    let Some(map @ super::evidence::Map::Attached { .. }) = &content.evidence_map else {
        return Ok(content.body.clone());
    };
    let rendered = section(map)?;
    if let Some(span) = map_span(&content.body)? {
        if content.body[span] != rendered {
            return Err(Error::Invalid("evidence-map-section: typed map disagrees with authored section".into()));
        }
        return Ok(content.body.clone());
    }
    let at = headings(&content.body).iter().find(|(_, title)| title == "Tasks")
        .map_or(content.body.len(), |(offset, _)| *offset);
    let mut body = content.body[..at].to_owned();
    if !body.is_empty() && !body.ends_with('\n') { body.push('\n'); }
    body.push_str(&rendered);
    body.push_str(&content.body[at..]);
    Ok(body)
}
