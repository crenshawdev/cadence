//! Compatibility reads use saved H4 interpretation, never current admission rules.
use super::model::{Acceptance, Attempt, Finding, Original};
use super::persistence;
use cadence::store::writer::Store;
use cadence::store::{Error, Result};
use serde::Serialize;
use serde_json::Value;
use std::collections::BTreeMap;

#[derive(Debug, Serialize)]
pub struct OriginalIdentity {
    pub original: String,
    pub contract: String,
    pub finding_ids: Vec<String>,
}
#[derive(Debug, Serialize)]
pub struct OriginalRead {
    pub identity: OriginalIdentity,
    pub raw_bytes: Vec<u8>,
    pub findings: Option<Vec<Finding>>,
    pub record: Original,
}

pub(crate) fn saved_original(records: &Value, id: &str) -> Result<Original> {
    let mut saved: Value = persistence::get(records, "originals", id)?;
    if saved["contract"]["validator"] != "H4-1" {
        saved["parsed"] = Value::Null;
        saved["acceptance"] = serde_json::to_value(Acceptance::Unverified {
            reason: "unknown-saved-contract".into(),
        })?;
    }
    let original: Original = serde_json::from_value(saved)?;
    if original.original != id {
        return Err(Error::Conflict("original identity mismatch".into()));
    }
    Ok(original)
}

pub async fn read_original(store: &Store, id: &str) -> Result<OriginalRead> {
    let view = persistence::read(store).await?;
    let original = saved_original(&persistence::records(&view.snapshot.data)?, id)?;
    let finding_ids = original
        .citations
        .iter()
        .map(|citation| format!("{}:{}", citation.finding.original, citation.finding.index))
        .collect();
    Ok(OriginalRead {
        identity: OriginalIdentity {
            original: original.original.clone(),
            contract: original.contract.validator.clone(),
            finding_ids,
        },
        raw_bytes: original.raw.clone(),
        findings: original
            .parsed
            .as_ref()
            .map(|parsed| parsed.findings.clone()),
        record: original,
    })
}

#[derive(Debug, Serialize)]
pub struct VoiceOriginals {
    pub originals: BTreeMap<String, String>,
    pub findings: BTreeMap<String, Vec<Finding>>,
}

pub async fn read_voice_originals(store: &Store, fire: &str) -> Result<VoiceOriginals> {
    let view = persistence::read(store).await?;
    let records = persistence::records(&view.snapshot.data)?;
    let attempts: BTreeMap<String, Attempt> = records
        .get("attempts")
        .cloned()
        .map(serde_json::from_value)
        .transpose()?
        .unwrap_or_default();
    let mut result = VoiceOriginals {
        originals: BTreeMap::new(),
        findings: BTreeMap::new(),
    };
    for attempt in attempts.values().filter(|attempt| attempt.fire == fire) {
        if let Some(id) = &attempt.original {
            let original = saved_original(&records, id)?;
            if original.attempt.as_deref() != Some(&attempt.attempt)
                || original.artifact.as_deref() != Some(&attempt.view.manifest)
            {
                return Err(Error::Conflict("original attempt binding mismatch".into()));
            }
            if result
                .originals
                .insert(attempt.slot.clone(), id.clone())
                .is_some()
            {
                return Err(Error::Conflict(
                    "multiple accepted originals for one slot".into(),
                ));
            }
            if let Some(parsed) = original.parsed {
                result
                    .findings
                    .insert(attempt.slot.clone(), parsed.findings);
            }
        }
    }
    Ok(result)
}
