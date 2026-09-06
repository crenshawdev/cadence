//! Synchronous record algebra. No runtime or ambient inputs are used here.
use super::{Error, Result};
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

pub const VERSION: u32 = 1;
pub const ITEMS: &str = "items.jsonl";
pub const DECISIONS: &str = "decisions.jsonl";
pub const STATE: &str = "state.json";

/// Missing evidence, explicit null, and uninterpreted source text are distinct.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Evidence {
    #[default]
    Missing,
    Null,
    Text(String),
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Origin {
    pub source: String,
    #[serde(default)]
    pub original: Evidence,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum Disposition {
    Captured,
    Filed { pointer: String },
    Declined { reason: String },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct ItemRecord {
    pub version: u32,
    pub id: String,
    pub revision: u64,
    pub origin: Origin,
    pub text: String,
    pub kind: String,
    pub disposition: Disposition,
    pub completed: bool,
    pub filing_uncertain: bool,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "class", rename_all = "snake_case")]
pub enum Decision {
    Routing {
        choice: String,
        config_provenance: BTreeMap<String, Evidence>,
        requested_effort: Evidence,
        observed_effort: Evidence,
        receipt: Evidence,
    },
    Gate {
        outcome: String,
        evidence: Evidence,
    },
    Refusal {
        reason: String,
        evidence: Evidence,
    },
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct DecisionRecord {
    pub version: u32,
    pub id: String,
    pub revision: u64,
    pub origin: Origin,
    pub decision: Decision,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Snapshot {
    pub version: u32,
    pub generation: u64,
    pub items_digest: String,
    pub decisions_digest: String,
    pub data: Value,
    pub integrity: String,
}

pub fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

impl Snapshot {
    pub fn new(generation: u64, items: &[u8], decisions: &[u8], data: Value) -> Result<Self> {
        let mut snapshot = Self {
            version: VERSION,
            generation,
            items_digest: digest(items),
            decisions_digest: digest(decisions),
            data,
            integrity: String::new(),
        };
        snapshot.integrity = snapshot.content_digest()?;
        Ok(snapshot)
    }

    fn content_digest(&self) -> Result<String> {
        let mut content = self.clone();
        content.integrity.clear();
        Ok(digest(&serde_json::to_vec(&content)?))
    }

    pub fn validate(&self, items: &[u8], decisions: &[u8]) -> Result<()> {
        if self.version != VERSION
            || self.items_digest != digest(items)
            || self.decisions_digest != digest(decisions)
            || self.integrity != self.content_digest()?
        {
            return Err(Error::Conflict(
                "snapshot integrity or version mismatch".into(),
            ));
        }
        Ok(())
    }

    pub fn parse(bytes: &[u8], items: &[u8], decisions: &[u8]) -> Result<Self> {
        let snapshot: Self = serde_json::from_slice(bytes)?;
        snapshot.validate(items, decisions)?;
        Ok(snapshot)
    }

    pub fn render(&self) -> Result<Vec<u8>> {
        Ok(serde_json::to_vec(self)?)
    }
}

pub fn parse_lines<T: DeserializeOwned>(bytes: &[u8]) -> Result<Vec<T>> {
    if !bytes.is_empty() && !bytes.ends_with(b"\n") {
        return Err(Error::Invalid("unterminated JSONL record".into()));
    }
    if bytes.is_empty() {
        return Ok(Vec::new());
    }
    bytes[..bytes.len() - 1]
        .split(|byte| *byte == b'\n')
        .map(|line| serde_json::from_slice(line).map_err(Error::from))
        .collect()
}

pub fn render_lines<T: Serialize>(records: &[T]) -> Result<Vec<u8>> {
    let mut bytes = Vec::new();
    for record in records {
        serde_json::to_writer(&mut bytes, record)?;
        bytes.push(b'\n');
    }
    Ok(bytes)
}

pub fn validate_items(records: &[ItemRecord]) -> Result<()> {
    let mut latest: BTreeMap<&str, &ItemRecord> = BTreeMap::new();
    for record in records {
        let previous = latest.get(record.id.as_str());
        validate_revision(
            record.version,
            &record.id,
            record.revision,
            previous.map(|r| r.revision),
        )?;
        if previous.is_some_and(|old| {
            old.origin != record.origin || old.text != record.text || old.kind != record.kind
        }) {
            return Err(Error::Invalid("revision changed capture identity".into()));
        }
        latest.insert(&record.id, record);
    }
    Ok(())
}

pub fn validate_decisions(records: &[DecisionRecord]) -> Result<()> {
    let mut revisions = BTreeMap::new();
    for record in records {
        validate_revision(
            record.version,
            &record.id,
            record.revision,
            revisions.get(&record.id).copied(),
        )?;
        revisions.insert(&record.id, record.revision);
    }
    Ok(())
}

fn validate_revision(version: u32, id: &str, revision: u64, previous: Option<u64>) -> Result<()> {
    if version != VERSION
        || id.trim().is_empty()
        || previous.unwrap_or(0).checked_add(1) != Some(revision)
    {
        return Err(Error::Invalid(
            "unsupported version, empty identity, or inconsistent revision".into(),
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item() -> ItemRecord {
        ItemRecord {
            version: VERSION,
            id: "capture-1".into(),
            revision: 1,
            origin: Origin {
                source: "capture".into(),
                original: Evidence::Missing,
            },
            text: "first".into(),
            kind: "todo".into(),
            disposition: Disposition::Captured,
            completed: false,
            filing_uncertain: false,
        }
    }

    #[test]
    fn records_and_snapshot_round_trip() {
        let items = vec![item()];
        let bytes = render_lines(&items).unwrap();
        let parsed: Vec<ItemRecord> = parse_lines(&bytes).unwrap();
        validate_items(&parsed).unwrap();
        assert_eq!(parsed, items);
        let decisions = vec![DecisionRecord {
            version: VERSION,
            id: "gate-1".into(),
            revision: 1,
            origin: item().origin,
            decision: Decision::Gate {
                outcome: "pass".into(),
                evidence: Evidence::Null,
            },
        }];
        let decision_bytes = render_lines(&decisions).unwrap();
        let parsed: Vec<DecisionRecord> = parse_lines(&decision_bytes).unwrap();
        validate_decisions(&parsed).unwrap();
        assert_eq!(parsed, decisions);
        let snapshot =
            Snapshot::new(1, &bytes, &decision_bytes, serde_json::json!({"phase":3})).unwrap();
        assert_eq!(
            Snapshot::parse(&snapshot.render().unwrap(), &bytes, &decision_bytes).unwrap(),
            snapshot
        );
    }

    #[test]
    fn invalid_versions_revisions_and_integrity_are_rejected() {
        let mut bad = item();
        bad.version = 99;
        assert!(validate_items(&[bad]).is_err());
        let mut skipped = item();
        skipped.revision = 3;
        assert!(validate_items(&[item(), skipped]).is_err());
        assert!(parse_lines::<ItemRecord>(b"{}\n\n").is_err());
        let mut snapshot = Snapshot::new(0, b"", b"", Value::Null).unwrap();
        snapshot.data = serde_json::json!("edited");
        assert!(snapshot.validate(b"", b"").is_err());
        snapshot = Snapshot::new(0, b"", b"", Value::Null).unwrap();
        snapshot.version = 99;
        assert!(snapshot.validate(b"", b"").is_err());
        assert!(snapshot.validate(b"edited", b"").is_err());
    }

    #[test]
    fn evidence_keeps_absence_null_and_unknown_text_distinct() {
        let absent: Origin = serde_json::from_str(r#"{"source":"legacy"}"#).unwrap();
        assert_eq!(absent.original, Evidence::Missing);
        for original in [
            Evidence::Missing,
            Evidence::Null,
            Evidence::Text("  unfamiliar host text  ".into()),
        ] {
            let origin = Origin {
                source: "legacy".into(),
                original,
            };
            assert_eq!(
                serde_json::from_slice::<Origin>(&serde_json::to_vec(&origin).unwrap()).unwrap(),
                origin
            );
        }
        assert_ne!(Evidence::Missing, Evidence::Null);
    }
}
