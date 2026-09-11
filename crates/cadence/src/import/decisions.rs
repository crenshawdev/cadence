use super::{Source, SourceEvidence};
use cadence::store::{
    Result,
    decisions::historical_observed_effort,
    model::{Decision, DecisionRecord, Evidence, Origin, VERSION, digest},
};
use serde_json::{Value, json};
use std::collections::BTreeMap;

pub struct ImportedDecisions {
    pub records: Vec<DecisionRecord>,
    pub cursor: Value,
    pub evidence: Vec<SourceEvidence>,
    pub warnings: Vec<String>,
}

fn field(row: &Value, key: &str) -> Evidence {
    match row.get(key) {
        None => Evidence::Missing,
        Some(Value::Null) => Evidence::Null,
        Some(Value::String(s)) => Evidence::Text(s.clone()),
        Some(value) => Evidence::Text(value.to_string()),
    }
}

fn cursor(source: Option<&Source>) -> Value {
    let Some(source) = source else {
        return json!({"available":false});
    };
    let Ok(text) = std::str::from_utf8(&source.bytes) else {
        return json!({"available":false});
    };
    let read = |prefix: &str| {
        text.lines()
            .find_map(|line| line.strip_prefix(prefix))
            .map(str::trim)
    };
    let raw = json!({"phase":read("Phase:"),"status":read("Status:"),"next":read("Next:"),"updated":read("Updated:")});
    let parse = || -> Option<Value> {
        let phase = read("Phase:")?;
        let (phase, tail) = phase.split_once(" of ")?;
        let (total, name) = tail.split_once(" (")?;
        let name = name.strip_suffix(')')?;
        let phase_number = phase.parse::<f64>().ok()?;
        let total = total.parse::<u64>().ok()?;
        if !phase_number.is_finite() || phase_number < 0.0 {
            return None;
        }
        Some(
            json!({"available":true,"phase":phase_number,"total":total,"name":name,
            "status":read("Status:")?,"next":read("Next:")?,"updated":read("Updated:")?,"original_fields":raw}),
        )
    };
    parse().unwrap_or_else(|| json!({"available":false,"original_fields":raw}))
}

fn decision(row: &Value) -> Option<Decision> {
    match (row["family"].as_str()?,row["event"].as_str()?) {
        ("routing","resolve") if row.get("phase").is_some_and(|v|!v.is_null()) && row["agent"].as_str().is_some_and(|s|!s.trim().is_empty()) => {
            let choice=json!({"phase":row["phase"],"role":row["role"],"agent":row["agent"],"model":row["model"],
                "escalated":row["escalated"],"pinned":row["pinned"],"attempt":row["attempt"]});
            Some(Decision::Routing {choice:choice.to_string(),config_provenance:BTreeMap::from([("model_source".into(),field(row,"model_source"))]),
                requested_effort:field(row,"effort"),observed_effort:historical_observed_effort(row["agent_id"].as_str(),row.get("observed_effort")),receipt:field(row,"receipt")})
        }
        ("outcome","census_undeclared") if row["censuses"].as_array().is_some_and(|a|!a.is_empty() && a.iter().all(Value::is_string)) => {
            Some(Decision::Refusal {reason:"undeclared-census-files".into(),evidence:Evidence::Text(json!({"phase":row["phase"],"plan":row["plan"],"censuses":row["censuses"]}).to_string())})
        }
        ("outcome","risk_check") if row["checked"].is_boolean() => {
            let mut facts=serde_json::Map::new();
            for key in ["phase","plan","base","head","base_id","head_id","staged","index_id","checked","categories","matches","inconclusive","empty","reason"] {
                if let Some(value)=row.get(key) {facts.insert(key.into(),value.clone());}
            }
            Some(Decision::Gate {outcome:"risk_check".into(),evidence:Evidence::Text(Value::Object(facts).to_string())})
        }
        ("outcome",event) if row["outcome"].is_string() || row["verdict"].is_string() => {
            Some(Decision::Gate {outcome:event.into(),evidence:Evidence::Text(json!({"phase":row["phase"],"plan":row["plan"],"outcome":row["outcome"],"verdict":row["verdict"]}).to_string())})
        }
        _=>None,
    }
}

fn rows(source: &Source) -> Vec<(usize, usize, Option<Value>)> {
    let mut offset = 0;
    source
        .bytes
        .split_inclusive(|b| *b == b'\n')
        .map(|bytes| {
            let start = offset;
            offset += bytes.len();
            let value = bytes
                .ends_with(b"\n")
                .then(|| serde_json::from_slice(bytes).ok())
                .flatten();
            (start, offset, value)
        })
        .collect()
}

/// A matching payload alone proves nothing. Only a rotation seal plus an exact
/// full anchored-tail copy proves these source positions are carried events.
/// Under-pressure partial copies stay separate, conservatively.
fn carried_positions(current: &Source, rotated: &Source) -> BTreeMap<usize, usize> {
    let previous = rows(rotated);
    let anchor = previous.iter().rfind(|(_, _, v)| {
        v.as_ref()
            .is_some_and(|v| v["family"] == "lifecycle" && v["event"] == "phase_start")
    });
    let Some((anchor, _, _)) = anchor else {
        return BTreeMap::new();
    };
    let mut tail = Vec::new();
    let mut mapping = BTreeMap::new();
    for (start, end, _) in &previous {
        if start < anchor {
            continue;
        }
        let bytes = &rotated.bytes[*start..*end];
        if bytes.iter().all(u8::is_ascii_whitespace) {
            continue;
        }
        mapping.insert(tail.len(), *start);
        tail.extend_from_slice(bytes);
    }
    for (start, _, row) in rows(current) {
        if row.as_ref().is_some_and(|v| {
            v["family"] == "lifecycle"
                && v["event"] == "record_rotated"
                && v["file"] == "trace.1.jsonl"
                && v["carried_bytes"].as_u64() == Some(rotated.bytes.len() as u64)
        }) && current.bytes[..start] == tail
        {
            return mapping;
        }
    }
    BTreeMap::new()
}

pub fn translate(
    state: Option<&Source>,
    current: Option<&Source>,
    rotated: Option<&Source>,
) -> Result<ImportedDecisions> {
    let mut result = ImportedDecisions {
        records: vec![],
        cursor: cursor(state),
        evidence: vec![],
        warnings: vec![],
    };
    if let Some(state) = state {
        result.evidence.push(SourceEvidence::original(state));
    }
    let carried = match (current, rotated) {
        (Some(c), Some(r)) => carried_positions(c, r),
        _ => BTreeMap::new(),
    };
    let mut index: BTreeMap<String, usize> = BTreeMap::new();
    let mut origins: BTreeMap<String, Vec<Value>> = BTreeMap::new();
    for (is_current, source) in [(true, current), (false, rotated)] {
        let Some(source) = source else {
            continue;
        };
        result.evidence.push(SourceEvidence::original(source));
        for (start, end, row) in rows(source) {
            let Some(row) = row else {
                result.warnings.push(format!(
                    "{}:{start}: malformed/incomplete row retained in original",
                    source.path
                ));
                continue;
            };
            let Some(decision) = decision(&row) else {
                result.warnings.push(format!(
                    "{}:{start}: activity, unknown or incomplete decision excluded",
                    source.path
                ));
                continue;
            };
            let canonical = if is_current {
                carried
                    .get(&start)
                    .and_then(|offset| rotated.map(|r| (r, *offset)))
            } else {
                None
            };
            let (identity_source, position) = canonical.unwrap_or((source, start));
            let id = format!(
                "decision:{}",
                digest(&serde_json::to_vec(&(
                    &identity_source.path,
                    identity_source.generation(),
                    position
                ))?)
            );
            origins.entry(id.clone()).or_default().push(json!({"path":source.path,"generation":source.generation(),"start":start,"end":end}));
            if let Some(&existing) = index.get(&id) {
                if result.records[existing].decision == decision {
                    continue;
                }
                // Proof mismatches must not silently coalesce a decision.
                return Err(cadence::store::Error::Conflict(
                    "carried decision differs from sealed source".into(),
                ));
            }
            index.insert(id.clone(), result.records.len());
            result.records.push(DecisionRecord {
                version: VERSION,
                id,
                revision: 1,
                origin: Origin {
                    source: identity_source.path.clone(),
                    original: Evidence::Missing,
                },
                decision,
            });
        }
    }
    for record in &mut result.records {
        record.origin.original = Evidence::Text(serde_json::to_string(&origins[&record.id])?);
    }
    result.warnings.push("missing routing receipts remain unavailable; source-file order does not establish inter-file chronology".into());
    Ok(result)
}
