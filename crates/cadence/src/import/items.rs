use super::{Source, SourceEvidence};
use cadence::store::{
    Result,
    model::{Disposition, Evidence, ItemRecord, Origin, VERSION, digest},
};
use serde_json::json;
use std::collections::BTreeMap;

#[derive(Clone, Debug, PartialEq)]
pub struct ImportedItems {
    pub records: Vec<ItemRecord>,
    pub evidence: Vec<SourceEvidence>,
    pub warnings: Vec<String>,
}

struct Event {
    id: String,
    source: String,
    original: serde_json::Value,
    text: String,
    kind: String,
    disposition: Disposition,
    completed: bool,
    uncertain: bool,
}

fn position_id(source: &str, start: usize) -> String {
    format!(
        "legacy:{}",
        digest(&serde_json::to_vec(&(source, start)).expect("serializable position"))
    )
}

fn original(source: &Source, start: usize, end: usize, phase: Option<&str>) -> serde_json::Value {
    json!({"path":source.path,"generation":source.generation(),"start":start,"end":end,
        "bytes":source.bytes[start..end],"phase_spelling":phase})
}

/// Fence delimiters close only with matching character and sufficient length.
fn fence(line: &str, state: &mut Option<(u8, usize)>) -> bool {
    let trimmed = line.trim_start();
    let Some(first) = trimmed.bytes().next() else {
        return state.is_some();
    };
    let count = trimmed.bytes().take_while(|b| *b == first).count();
    let was_inside = state.is_some();
    if matches!(first, b'`' | b'~') && count >= 3 {
        match *state {
            Some((kind, len))
                if first == kind && count >= len && trimmed[count..].trim().is_empty() =>
            {
                *state = None
            }
            None => *state = Some((first, count)),
            _ => {}
        }
        return true;
    }
    was_inside
}

fn capture(source: &Source, text: &str) -> Vec<Event> {
    let mut events = Vec::new();
    let mut heading = None;
    let mut in_fence = None;
    let mut offset = 0;
    for line in text.split_inclusive('\n') {
        let start = offset;
        offset += line.len();
        let line = line
            .trim_end_matches(['\r', '\n'])
            .trim_start_matches('\u{feff}');
        if fence(line, &mut in_fence) {
            continue;
        }
        if let Some(name) = line.strip_prefix("## ") {
            heading = match name.trim() {
                "Todos" => Some("todo"),
                "Seeds" => Some("seed"),
                "Notes" => Some("note"),
                _ => None,
            };
            continue;
        }
        if line.starts_with('#') {
            heading = None;
            continue;
        }
        let (Some(kind), Some(body)) = (heading, line.strip_prefix("- ")) else {
            continue;
        };
        if body.trim() == "None." {
            continue;
        }
        let (body, completed) = if let Some(body) = body.strip_prefix("[ ] ") {
            (body, false)
        } else if let Some(body) = body
            .strip_prefix("[x] ")
            .or_else(|| body.strip_prefix("[X] "))
        {
            (body, true)
        } else {
            (body, false)
        };
        let phase = body
            .strip_prefix("(phase ")
            .and_then(|s| s.split_once(") "))
            .map(|(phase, _)| phase);
        let body = if phase.is_some() {
            body.split_once(") ").unwrap().1
        } else {
            body
        };
        if body.trim().is_empty() {
            continue;
        }
        events.push(Event {
            id: position_id(&source.path, start),
            source: source.path.clone(),
            original: original(source, start, offset, phase),
            text: body.into(),
            kind: kind.into(),
            disposition: Disposition::Captured,
            completed,
            uncertain: false,
        });
    }
    events
}

/// Frozen planning-files.mjs:1250, 1366-1367. The optional word, not the
/// ledger filename, determines whether a filing was confirmed.
fn ledger_line(line: &str) -> Option<(&str, &str, &str, &str, bool)> {
    let (prefix, title) = line.strip_prefix("- ")?.split_once(": ")?;
    let parts: Vec<_> = prefix.split_whitespace().collect();
    if !(parts.len() == 4 || (parts.len() == 5 && parts[4] == "unconfirmed")) {
        return None;
    }
    let date = parts[0].as_bytes();
    if date.len() != 10
        || date[4] != b'-'
        || date[7] != b'-'
        || !date
            .iter()
            .enumerate()
            .all(|(i, b)| i == 4 || i == 7 || b.is_ascii_digit())
    {
        return None;
    }
    if parts[1].is_empty()
        || !parts[1].bytes().all(|b| b.is_ascii_lowercase())
        || parts[3].is_empty()
        || !parts[3]
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
        || title.trim().is_empty()
    {
        return None;
    }
    Some((parts[1], parts[2], parts[3], title.trim(), parts.len() == 5))
}

fn ledger(source: &Source, text: &str, declined: bool) -> Vec<Event> {
    let mut events = Vec::new();
    let mut offset = 0;
    let mut in_fence = None;
    let mut in_decisions = false;
    let mut prose: Option<(usize, String)> = None;
    let finish_prose =
        |prose: &mut Option<(usize, String)>, end: usize, events: &mut Vec<Event>| {
            if let Some((start, title)) = prose.take() {
                let reason = String::from_utf8_lossy(&source.bytes[start..end]).into_owned();
                events.push(Event {
                    id: position_id(&source.path, start),
                    source: source.path.clone(),
                    original: original(source, start, end, None),
                    text: title,
                    kind: "decline_decision".into(),
                    disposition: Disposition::Declined { reason },
                    completed: false,
                    uncertain: false,
                });
            }
        };
    for line in text.split_inclusive('\n') {
        let start = offset;
        offset += line.len();
        let line = line
            .trim_end_matches(['\r', '\n'])
            .trim_start_matches('\u{feff}');
        if fence(line, &mut in_fence) {
            continue;
        }
        if declined && line == "## Decisions" {
            in_decisions = true;
            continue;
        }
        if declined
            && in_decisions
            && let Some(title) = line.strip_prefix("### ")
        {
            finish_prose(&mut prose, start, &mut events);
            prose = Some((start, title.into()));
            continue;
        }
        if let Some((provider, slug, fingerprint, title, uncertain)) = ledger_line(line) {
            finish_prose(&mut prose, start, &mut events);
            let identity = serde_json::to_vec(&(provider, slug, fingerprint))
                .expect("serializable ledger identity");
            let pointer = format!("{provider} {slug} {fingerprint}");
            events.push(Event {
                id: format!("ledger:{}", digest(&identity)),
                source: source.path.clone(),
                original: original(source, start, offset, None),
                text: title.into(),
                kind: "finding".into(),
                disposition: if declined {
                    Disposition::Declined {
                        reason: title.into(),
                    }
                } else {
                    Disposition::Filed { pointer }
                },
                completed: false,
                uncertain,
            });
        }
    }
    finish_prose(&mut prose, source.bytes.len(), &mut events);
    events
}

pub fn translate(
    capture_source: Option<&Source>,
    filed: Option<&Source>,
    declined: Option<&Source>,
) -> Result<ImportedItems> {
    let mut result = ImportedItems {
        records: vec![],
        evidence: vec![],
        warnings: vec![],
    };
    let mut events = Vec::new();
    for (kind, source) in [(0, capture_source), (1, filed), (2, declined)] {
        let Some(source) = source else {
            continue;
        };
        result.evidence.push(SourceEvidence::original(source));
        let Ok(text) = std::str::from_utf8(&source.bytes) else {
            result.warnings.push(format!(
                "{}: non-UTF8 bytes retained as non-effective evidence",
                source.path
            ));
            continue;
        };
        let translated = if kind == 0 {
            capture(source, text)
        } else {
            ledger(source, text, kind == 2)
        };
        result.warnings.push(format!("{}: recognized {} source events; original bytes retain all unclassified fragments, continuations and fences non-effectively",source.path,translated.len()));
        events.extend(translated);
    }
    let mut origins: BTreeMap<&str, Vec<&Event>> = BTreeMap::new();
    for event in &events {
        origins.entry(&event.id).or_default().push(event);
    }
    for (id, group) in &origins {
        if group
            .iter()
            .any(|e| matches!(e.disposition, Disposition::Filed { .. }))
            && group
                .iter()
                .any(|e| matches!(e.disposition, Disposition::Declined { .. }))
        {
            result.warnings.push(format!(
                "{id}: FILED/DECLINED conflict; declined wins, no inter-file chronology inferred"
            ));
        }
    }
    let mut revisions: BTreeMap<&str, u64> = BTreeMap::new();
    for event in &events {
        let group = &origins[event.id.as_str()];
        let revision = revisions.entry(&event.id).or_default();
        *revision += 1;
        // One immutable identity carries all source events, while revisions
        // retain each event's disposition and uncertainty in source order.
        let first = group[0];
        result.records.push(ItemRecord {
            version: VERSION,
            id: event.id.clone(),
            revision: *revision,
            origin: Origin {
                source: first.source.clone(),
                original: Evidence::Text(serde_json::to_string(
                    &group.iter().map(|e| &e.original).collect::<Vec<_>>(),
                )?),
            },
            text: first.text.clone(),
            kind: first.kind.clone(),
            disposition: event.disposition.clone(),
            completed: event.completed,
            filing_uncertain: event.uncertain,
        });
    }
    cadence::store::model::validate_items(&result.records)?;
    Ok(result)
}
