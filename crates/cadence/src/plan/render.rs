//! Only strict frontmatter is rendered; the authored body is appended unchanged.
use super::model::Content;
use cadence::store::{Error, Result};

pub fn document(content: &Content) -> Result<Vec<u8>> {
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
        ("execution", serde_json::to_value(&content.execution)?),
    ] {
        text.push_str(&format!("{key}: {}\n", serde_json::to_string(&value)?));
    }
    text.push_str("---\n");
    text.push_str(&content.body);
    let bytes = text.into_bytes();
    cadence::execution::plan::parse_plan(&bytes, content.phase.get(), content.plan.get())
        .map_err(|error| Error::Invalid(error.to_string()))?;
    Ok(bytes)
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
