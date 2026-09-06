use super::*;
use serde_json::{Value, json};

fn space(c: char) -> bool {
    matches!(
        c,
        '\t' | '\n' | '\u{b}' | '\u{c}' | '\r' | ' ' | '\u{a0}' | '\u{1680}' | '\u{2000}'
            ..='\u{200a}'
                | '\u{2028}'
                | '\u{2029}'
                | '\u{202f}'
                | '\u{205f}'
                | '\u{3000}'
                | '\u{feff}'
    )
}

fn trim(text: &str) -> &str {
    text.trim_matches(space)
}

// Native constraints: a field must contain nonblank text on its own line.
// In particular Next cannot borrow Updated, and a spaces-only name is invalid.
fn nonblank_line(text: &str) -> bool {
    !trim(text).is_empty() && !text.contains(['\n', '\r', '\u{2028}', '\u{2029}'])
}

fn date(text: &str) -> bool {
    text.len() == 10
        && text.bytes().enumerate().all(|(i, b)| {
            if i == 4 || i == 7 {
                b == b'-'
            } else {
                b.is_ascii_digit()
            }
        })
}

fn digits(text: &str) -> Option<(&str, &str)> {
    let end = text.bytes().take_while(u8::is_ascii_digit).count();
    (end > 0).then_some((&text[..end], &text[end..]))
}

fn separated(text: &str) -> Option<&str> {
    let rest = text.trim_start_matches(space);
    (rest.len() < text.len()).then_some(rest)
}

fn phase_field(text: &str) -> Option<(PhaseId, u64, String)> {
    if !nonblank_line(text) {
        return None;
    }
    let text = trim(text);
    let (_, mut rest) = digits(text)?;
    if let Some(fraction) = rest.strip_prefix('.') {
        rest = digits(fraction)?.1;
    }
    let phase = text[..text.len() - rest.len()].parse::<f64>().ok()?;
    let rest = separated(rest)?.strip_prefix("of")?;
    let (total, rest) = digits(separated(rest)?)?;
    let name = separated(rest)?.strip_prefix('(')?.strip_suffix(')')?;
    if !phase.is_finite() || !nonblank_line(name) {
        return None;
    }
    Some((PhaseId(phase), total.parse().ok()?, name.into()))
}

fn provenance(raw: &Value) -> CursorProvenance {
    let string = |key| raw.get(key).and_then(Value::as_str).map(str::to_owned);
    CursorProvenance {
        source: "data.cursor".into(),
        original_cursor: raw.clone(),
        source_bytes: None,
        phase: raw.get("phase").and_then(Value::as_f64).map(PhaseId),
        total: raw.get("total").and_then(Value::as_u64),
        name: string("name"),
        original_status: string("status"),
        next: string("next"),
        updated: string("updated"),
        original_fields: raw.get("original_fields").cloned(),
    }
}

fn valid(p: &CursorProvenance) -> Option<()> {
    if !p.original_cursor.get("available")?.as_bool()? {
        return None;
    }
    let phase = p.phase?;
    let total = p.total?;
    let name = p.name.as_deref()?;
    let status = p.original_status.as_deref()?;
    let next = p.next.as_deref()?;
    let updated = p.updated.as_deref()?;
    if !phase.number().is_finite()
        || phase.number() < 0.0
        || ![name, status, next].into_iter().all(nonblank_line)
        || !date(updated)
    {
        return None;
    }
    if let Some(fields) = &p.original_fields {
        let original = phase_field(fields.get("phase")?.as_str()?)?;
        if original != (phase, total, name.into()) {
            return None;
        }
        for (key, structured) in [("status", status), ("next", next), ("updated", updated)] {
            let original = fields.get(key)?.as_str()?;
            if !nonblank_line(original) || trim(original) != trim(structured) {
                return None;
            }
        }
    }
    Some(())
}

fn normalize(p: CursorProvenance) -> Result<CompatibilityCursor, DerivationError> {
    if valid(&p).is_none() {
        return Ok(CompatibilityCursor::Unavailable(p));
    }
    let status = match p.original_status.as_deref().unwrap() {
        "unplanned" | "ready to plan" | "context gathered" => LifecycleStatus::Unplanned,
        "planned" => LifecycleStatus::Planned,
        "executed" => LifecycleStatus::Executed,
        "complete" | "phase complete" => LifecycleStatus::Complete,
        "paused" => return Ok(CompatibilityCursor::Held(p)),
        original_status => {
            return Err(DerivationError::InvalidStatus {
                source: p.source.clone(),
                original_status: original_status.into(),
            });
        }
    };
    Ok(CompatibilityCursor::Assertion {
        status,
        provenance: p,
    })
}

/// Consume the retained imported value; available:true never substitutes for validation.
pub fn normalize_imported_cursor(raw: &Value) -> Result<CompatibilityCursor, DerivationError> {
    normalize(provenance(raw))
}

/// Explicit compatibility adapter only. Native queries never read STATE.md.
pub fn normalize_legacy_state(bytes: &[u8]) -> Result<CompatibilityCursor, DerivationError> {
    let text = String::from_utf8_lossy(bytes);
    let field = |prefix: &str| {
        text.split(['\n', '\r', '\u{2028}', '\u{2029}'])
            .find_map(|line| line.strip_prefix(prefix))
            .map(trim)
    };
    let fields = json!({"phase": field("Phase:"), "status": field("Status:"),
        "next": field("Next:"), "updated": field("Updated:")});
    let mut raw = json!({"available": false, "original_fields": fields});
    if let Some((phase, total, name)) = field("Phase:").and_then(phase_field) {
        raw = json!({"available": true, "phase": phase, "total": total, "name": name,
            "status": field("Status:"), "next": field("Next:"), "updated": field("Updated:"),
            "original_fields": fields});
    }
    let mut p = provenance(&raw);
    p.source = "STATE.md".into();
    p.source_bytes = Some(bytes.to_vec());
    normalize(p)
}
