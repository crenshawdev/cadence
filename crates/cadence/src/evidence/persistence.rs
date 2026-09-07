//! Native history has an explicit origin and marker; legacy Gate text stays opaque.
use super::{Record, nonblank};
use crate::store::{
    Error, Result,
    model::{Decision, DecisionRecord, Evidence, Origin, VERSION},
};
use serde_json::Value;
use std::collections::BTreeMap;

pub const NAMESPACE: &str = "native_evidence";
const MARKER: &str = "cadence.native_evidence.v1";

pub fn read(data: &Value) -> Result<BTreeMap<String, Record>> {
    let Some(value) = data.get(NAMESPACE) else {
        return Ok(BTreeMap::new());
    };
    let records: BTreeMap<String, Record> = serde_json::from_value(value.clone())?;
    for (key, record) in &records {
        record.validate()?;
        if *key != record.key()? {
            return Err(Error::Invalid("native evidence key mismatch".into()));
        }
    }
    Ok(records)
}

pub fn project(data: &Value, record: &Record) -> Result<Value> {
    record.validate()?;
    let mut records = read(data)?;
    records.insert(record.key()?, record.clone());
    let mut result = if data.is_null() {
        serde_json::json!({})
    } else {
        data.clone()
    };
    result
        .as_object_mut()
        .ok_or_else(|| Error::Invalid("snapshot data must be an object".into()))?
        .insert(NAMESPACE.into(), serde_json::to_value(records)?);
    Ok(result)
}

pub fn history(operation_id: &str, record: &Record) -> Result<DecisionRecord> {
    nonblank("operation identity", operation_id)?;
    record.validate()?;
    Ok(DecisionRecord {
        version: VERSION,
        id: format!("native-evidence:{operation_id}"),
        revision: 1,
        origin: Origin {
            source: MARKER.into(),
            original: Evidence::Missing,
        },
        decision: Decision::Gate {
            outcome: MARKER.into(),
            evidence: Evidence::Text(serde_json::to_string(record)?),
        },
    })
}

pub fn decode_history(decision: &DecisionRecord) -> Result<Option<Record>> {
    if decision.origin.source != MARKER {
        return Ok(None);
    }
    let Decision::Gate {
        outcome,
        evidence: Evidence::Text(text),
    } = &decision.decision
    else {
        return Err(Error::Invalid("malformed native history".into()));
    };
    if outcome != MARKER {
        return Err(Error::Invalid("native history marker mismatch".into()));
    }
    let record: Record = serde_json::from_str(text)?;
    record.validate()?;
    Ok(Some(record))
}
